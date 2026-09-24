/**
 * Reading a whole project's metric evidence.
 *
 * This is the pass that turns sealed source bytes and a sealed observation
 * graph into a sealed set of metric claims. Everything it does is a
 * consequence of one decision made at the top of the stage, and repeated here
 * because it is easy to lose: **this layer reads DRAWINGS, not a building.**
 * It knows about dimension lines, tick marks, level datums, degree signs and
 * slash callouts. It does not know what a wall is, it never places anything in
 * three dimensions, and it produces no geometry.
 *
 * Its inputs are both named by hash and both are required. The bytes are where
 * the numbers are printed; the graph is what they are printed ON, and without
 * it a number is just a number. Reading the bytes a second time is not a second
 * scrape — it is the same sealed variant, decoded again, and the set records
 * the hash of every one of them so that can be checked rather than believed.
 *
 * The raster comes in through a callback rather than being fetched. That keeps
 * this package pure and browser-safe, keeps decoding in the one place that
 * already owns it, and — more usefully than either — lets the whole pipeline be
 * driven by synthetic drawings in a test, which is the only way to know that
 * what comes out is a reading of the page rather than a memory of one project.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import { chainsFromLines, chainId, solveFrameChains } from './chains.js'
import type { RawChain, SolvedChain } from './chains.js'
import { findDimensionLines, findStraightRuns } from './dimension-lines.js'
import type { DimensionLine } from './dimension-lines.js'
import { readNumbers } from './ocr.js'
import { readOpeningCallouts } from './callouts.js'
import type { TextToken } from './ocr.js'
import { parseNumber, readingLattice } from './parse.js'
import { registerFrame, solveLevelLadder } from './registration.js'
import type { ScaleAnchorInput } from './registration.js'
import { readSpecifications, SPEC_READER_NAME, SPEC_READER_VERSION } from './specifications.js'
import type { PublishedSpecificationInput } from './specifications.js'
import { sealMetricEvidence } from './hash.js'
import type { MetricEvidenceDraft } from './hash.js'
import { METRIC_EVIDENCE_SCHEMA_VERSION } from './schema.js'
import type { Association, DimensionChain, MetricConflict, MetricEvidence, MetricEvidenceSet, OcrToken, RegistrationPlane, UnresolvedMetric } from './schema.js'

export const METRIC_READER_VERSION = '1.0.0' as const

/** The bytes of one asset variant, decoded. Returning nothing means the variant could not be read, which is recorded as a gap. */
export type RasterSource = (frame: SourceCoordinateFrame) => Raster | undefined

export type ExtractOptions = {
  sourcePackageId: string
  sourcePackageHash: string
  graph: SourceObservationGraph
  raster: RasterSource
  /** A short, stable slug for the set's id. */
  slug: string
  /** How far a chain reading may miss its span, in pixels. */
  tolerancePx?: number
  /** Frames to read. Defaults to every frame whose projection is orthographic. */
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
  /**
   * The publisher's printed technical specification, when the package carries
   * one. It is read for the numbers in it — a roof pitch above all — because a
   * printed angle is worth more than one measured off a raster.
   */
  specifications?: readonly PublishedSpecificationInput[]
  /** Sha-256 of the page the specification was printed on. Required to read one. */
  pageHash?: string
}

/** Orthographic sheets carry printed measurements; renders and site plans do not, and reading numbers off them invents scale. */
const DEFAULT_FRAME_FILTER = (frame: SourceCoordinateFrame): boolean =>
  frame.roles.projection === 'ORTHOGRAPHIC_PLAN' || frame.roles.projection === 'ORTHOGRAPHIC_ELEVATION' || frame.roles.projection === 'ORTHOGRAPHIC_SECTION'

const planeOf = (frame: SourceCoordinateFrame): RegistrationPlane | undefined => {
  if (frame.roles.projection === 'ORTHOGRAPHIC_PLAN') return 'PLAN_XZ'
  if (frame.roles.projection === 'ORTHOGRAPHIC_SECTION') return 'SECTION_HY'
  if (frame.roles.projection === 'ORTHOGRAPHIC_ELEVATION') return 'ELEVATION_HY'
  return undefined
}

const rectCentre = (r: PixelRect): PixelPoint => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 })
const distance = (a: PixelPoint, b: PixelPoint): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Every point an observation is made of, for judging what a number sits beside. */
function pointsOf(o: SourceObservation): PixelPoint[] {
  const g = o.pixelGeometry
  if (g.type === 'POINT') return [g.point]
  if (g.type === 'SEGMENT') return [g.a, g.b]
  if (g.type === 'POLYLINE' || g.type === 'POLYGON') return g.points
  if (g.type === 'RECT') return [{ x: g.rect.x0, y: g.rect.y0 }, { x: g.rect.x1, y: g.rect.y1 }, { x: g.rect.x0, y: g.rect.y1 }, { x: g.rect.x1, y: g.rect.y0 }]
  return g.lines.flatMap((l) => [l.a, l.b])
}

/** The observation of a given kind nearest a point, and how near. */
function nearest(observations: readonly SourceObservation[], kinds: readonly string[], at: PixelPoint): { observation: SourceObservation; distance: number } | undefined {
  let best: { observation: SourceObservation; distance: number } | undefined
  for (const o of observations) {
    if (!kinds.includes(o.kind)) continue
    let d = Infinity
    for (const p of pointsOf(o)) d = Math.min(d, distance(p, at))
    // A level line is a long horizontal: the distance that matters is to the
    // LINE, not to its far end.
    if (o.pixelGeometry.type === 'SEGMENT') {
      const { a, b } = o.pixelGeometry
      if (Math.abs(b.y - a.y) < 2 && at.x >= Math.min(a.x, b.x) - 8 && at.x <= Math.max(a.x, b.x) + 8) d = Math.min(d, Math.abs(at.y - (a.y + b.y) / 2))
      if (Math.abs(b.x - a.x) < 2 && at.y >= Math.min(a.y, b.y) - 8 && at.y <= Math.max(a.y, b.y) + 8) d = Math.min(d, Math.abs(at.x - (a.x + b.x) / 2))
    }
    if (!best || d < best.distance) best = { observation: o, distance: round6(d) }
  }
  return best
}

const tokenId = (frameId: string, token: TextToken): string => stableId('ocr', token.text.replace(/[^0-9a-z]/gi, '') || 'token', { frameId, box: token.box, text: token.text, orientation: token.orientation })

const toOcrToken = (frame: SourceCoordinateFrame, token: TextToken): OcrToken => ({
  id: tokenId(frame.id, token),
  frameId: frame.id,
  assetId: frame.assetId,
  variantByteHash: frame.variantByteHash,
  text: token.text,
  score: token.score,
  confidence: token.confidence,
  box: token.box,
  heightPx: Math.max(1, token.height),
  shearDeg: token.shearDeg,
  glyphs: token.glyphs.map((g) => ({ char: g.char, score: g.score, confidence: g.confidence, box: g.box, alternatives: g.alternatives })),
})


/**
 * The horizontal rule a level datum is printed against.
 *
 * Convention, stated so it can be argued with: the height is written just
 * ABOVE the line it marks and starts near its left end. So the rule is looked
 * for below the text and overlapping it horizontally, and the nearest long one
 * wins.
 */
function nearestRule(runs: readonly DimensionLine[], box: PixelRect): { line: DimensionLine; distance: number } | undefined {
  const height = Math.max(1, box.y1 - box.y0)
  let best: { line: DimensionLine; distance: number } | undefined
  for (const line of runs) {
    if (line.axis !== 'HORIZONTAL') continue
    if (line.toPx - line.fromPx < height * 2) continue
    const distance = line.baselinePx - box.y1
    if (distance < 0 || distance > height * 1.6) continue
    if (box.x1 < line.fromPx - height || box.x0 > line.toPx + height) continue
    if (!best || distance < best.distance) best = { line, distance: round6(distance) }
  }
  return best
}

const UNATTACHED: Association = { kind: 'UNATTACHED', score: 0, why: 'read on the sheet but not attached to any measurable feature', observationIds: [] }

/**
 * Read one project's printed measurements.
 *
 * Frame by frame: read the numbers, find the dimension lines, let the chains
 * decide which readings are consistent with one scale, attach the level datums
 * and angles and callouts to what they mark, and register whatever can be
 * registered. Everything that could not be turned into evidence is named in
 * `unresolved` rather than dropped, and everything that contradicts something
 * else is named in `conflicts` rather than averaged.
 */
export function extractMetricEvidence(options: ExtractOptions): MetricEvidenceSet {
  const { graph } = options
  const keep = options.frameFilter ?? DEFAULT_FRAME_FILTER
  const tolerancePx = options.tolerancePx ?? 2.2

  const ocrTokens: OcrToken[] = []
  const evidence: MetricEvidence[] = []
  const chains: DimensionChain[] = []
  const registrations: MetricEvidenceSet['coordinateRegistrations'] = []
  const conflicts: MetricConflict[] = []
  const unresolved: UnresolvedMetric[] = []

  for (const frame of [...graph.coordinateFrames].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!keep(frame)) continue
    const plane = planeOf(frame)
    const raster = options.raster(frame)
    if (!raster) {
      unresolved.push({ id: stableId('gap', 'undecodable', { frameId: frame.id }), what: `metric evidence on ${frame.assetId}`, frameId: frame.id, reason: 'the variant could not be decoded in this environment', status: 'MISSING' })
      continue
    }
    const observations = graph.observations.filter((o) => o.frameId === frame.id)
    let ladderOrigin: PixelPoint | undefined
    const read = readNumbers(raster)
    const tokensById = new Map<TextToken, OcrToken>()
    for (const token of read.tokens) {
      const record = toOcrToken(frame, token)
      tokensById.set(token, record)
      ocrTokens.push(record)
    }

    // --- dimension chains ---
    const mask = adaptiveInkMask(inkChannel(raster), {})
    const runs = findStraightRuns(mask)
    const lines = findDimensionLines(mask)
    const rawChains = chainsFromLines(lines, observations)
    const solution = solveFrameChains(rawChains, read.tokens, { tolerancePx })
    const usedTokens = new Set<TextToken>()
    const anchors: ScaleAnchorInput[] = []

    rawChains.forEach((chain, index) => {
      const solved = solution.solved[index]
      if (solved.segments.length === 0) return
      const record = buildChain(frame, chain, solved, tokensById, evidence, anchors, usedTokens)
      if (record) chains.push(record)
    })

    // --- level datums, angles and callouts ---
    type DatumDraft = {
      token: TextToken
      record: OcrToken
      parsed: ReturnType<typeof parseNumber>[number]
      alternatives: MetricEvidence['alternatives']
      geometry?: { type: 'SEGMENT'; a: PixelPoint; b: PixelPoint }
      observationId?: string
      associationScore: number
      why: string
    }
    const datumCandidates: DatumDraft[] = []
    for (const token of read.tokens) {
      if (usedTokens.has(token)) continue
      const record = tokensById.get(token)
      if (!record) continue
      const parsed = parseNumber(token.text)[0]
      if (!parsed) continue
      const centre = rectCentre(token.box)
      const alternatives = parseAlternatives(token)
      if (parsed.kind === 'LEVEL_DATUM') {
        const near = nearest(observations, ['LEVEL_DATUM', 'LINE', 'POLYLINE'], centre)
        const attached = near !== undefined && near.distance <= Math.max(10, token.height * 1.6)
        // A level datum that the sealed graph did not happen to see a line for
        // is still a level datum, and the sheet still draws the rule it marks.
        // Reading that rule out of the same bytes is not a second scrape and it
        // is not a guess: it is the line the number is printed against, and
        // without it the height is a number with no row, which anchors nothing.
        const rule = attached ? undefined : nearestRule(runs, token.box)
        const geometry =
          attached && near.observation.pixelGeometry.type === 'SEGMENT'
            ? near.observation.pixelGeometry
            : rule
              ? ({ type: 'SEGMENT', a: { x: rule.line.fromPx, y: rule.line.baselinePx }, b: { x: rule.line.toPx, y: rule.line.baselinePx } } as const)
              : undefined
        datumCandidates.push({
          token,
          record,
          parsed,
          alternatives,
          geometry,
          observationId: attached ? near.observation.id : undefined,
          associationScore: attached ? round6(Math.max(0.1, 1 - near.distance / Math.max(1, token.height * 1.6))) : rule ? round6(Math.max(0.1, 0.8 - rule.distance / Math.max(1, token.height * 2))) : 0,
          why: attached
            ? `${near.distance} px from a level line on the same sheet`
            : rule
              ? `printed ${rule.distance} px above a ${round6(rule.line.toPx - rule.line.fromPx)} px horizontal rule read from the same bytes`
              : UNATTACHED.why,
        })
        usedTokens.add(token)
        continue
      }
      if (parsed.kind === 'ANGLE') {
        const near = nearest(observations, ['ROOF_EDGE', 'RIDGE', 'LINE', 'EAVE'], centre)
        const attached = near !== undefined && near.distance <= Math.max(14, token.height * 2.5)
        evidence.push({
          id: stableId('metric', 'angle', { frameId: frame.id, box: token.box, value: parsed.value }),
          kind: 'ANGLE',
          frameId: frame.id,
          assetId: frame.assetId,
          variantByteHash: frame.variantByteHash,
          value: parsed.value,
          unit: 'deg',
          origin: 'READ',
          rawText: token.text,
          textBox: token.box,
          measuredGeometry: attached ? near.observation.pixelGeometry : undefined,
          association: attached
            ? { kind: 'ANGLE_MARKER', score: round6(Math.max(0.1, 1 - near.distance / Math.max(1, token.height * 2.5))), why: `${near.distance} px from a sloping edge on the same sheet`, observationIds: [near.observation.id] }
            : UNATTACHED,
          ocrTokenIds: [record.id],
          observationIds: attached ? [near.observation.id] : [],
          alternatives,
          confidence: round6(token.confidence * (attached ? 1 : 0.35)),
          provenance: { extractor: 'NUMERIC_OCR', name: `metrics.numeric-ocr@${METRIC_READER_VERSION}`, detail: parsed.why },
        })
        usedTokens.add(token)
        continue
      }
      if (parsed.kind === 'OPENING_CALLOUT') {
        const near = nearest(observations, ['OPENING', 'WINDOW', 'DOOR', 'OPENING_INTERVAL'], centre)
        const attached = near !== undefined && near.distance <= Math.max(18, token.height * 3)
        evidence.push({
          id: stableId('metric', 'callout', { frameId: frame.id, box: token.box, value: parsed.value, second: parsed.secondValue }),
          kind: 'OPENING_CALLOUT',
          frameId: frame.id,
          assetId: frame.assetId,
          variantByteHash: frame.variantByteHash,
          value: parsed.value,
          unit: 'cm',
          origin: 'READ',
          rawText: token.text,
          textBox: token.box,
          measuredGeometry: attached ? near.observation.pixelGeometry : undefined,
          association: attached
            ? { kind: 'OPENING_SYMBOL', score: round6(Math.max(0.1, 1 - near.distance / Math.max(1, token.height * 3))), why: `${near.distance} px from an opening symbol on the same sheet`, observationIds: [near.observation.id] }
            : UNATTACHED,
          ocrTokenIds: [record.id],
          observationIds: attached ? [near.observation.id] : [],
          alternatives: [
            ...alternatives,
            ...(parsed.secondValue === undefined ? [] : [{ value: parsed.secondValue, unit: 'cm' as const, rawText: token.text, confidence: round6(token.confidence), why: 'the height half of a `width/height` callout' }]),
          ],
          confidence: round6(token.confidence * (attached ? 1 : 0.3)),
          provenance: { extractor: 'NUMERIC_OCR', name: `metrics.numeric-ocr@${METRIC_READER_VERSION}`, detail: parsed.why },
          note: parsed.secondValue === undefined ? undefined : `width ${parsed.value} cm over height ${parsed.secondValue} cm`,
        })
        usedTokens.add(token)
      }
    }

    // --- ring callouts on plan sheets ---
    // The circled `width / height` beside each opening is one symbol, not a
    // token: the ring reader finds the circles and reads the halves, and each
    // half arrives as a short list of readings rather than one number, so the
    // reconstruction can pick the one its own evidence — the plan gap, the
    // elevation — agrees with.
    if (plane === 'PLAN_XZ') {
      for (const ring of readOpeningCallouts(raster, { frameId: frame.id })) {
        if (ring.widthCandidates.length === 0 || ring.heightCandidates.length === 0) continue
        const centre: PixelPoint = { x: ring.circle.cx, y: ring.circle.cy }
        const near = nearest(observations, ['OPENING', 'WINDOW', 'DOOR', 'OPENING_INTERVAL'], centre)
        const attached = near !== undefined && near.distance <= ring.circle.radiusPx * 6
        const width = ring.widthCandidates[0]
        const height = ring.heightCandidates[0]
        const readable = ring.widthCm !== null && ring.heightCm !== null
        evidence.push({
          id: stableId('metric', 'callout-ring', { frameId: frame.id, cx: ring.circle.cx, cy: ring.circle.cy }),
          kind: 'OPENING_CALLOUT',
          frameId: frame.id,
          assetId: frame.assetId,
          variantByteHash: frame.variantByteHash,
          value: width.value,
          unit: 'cm',
          origin: 'READ',
          rawText: `${width.text}/${height.text}`,
          textBox: ring.box,
          measuredGeometry: attached ? near.observation.pixelGeometry : undefined,
          association: attached
            ? { kind: 'OPENING_SYMBOL', score: round6(Math.max(0.1, 1 - near.distance / Math.max(1, ring.circle.radiusPx * 6))), why: `${near.distance} px from an opening symbol on the same sheet`, observationIds: [near.observation.id] }
            : UNATTACHED,
          ocrTokenIds: [],
          observationIds: attached ? [near.observation.id] : [],
          alternatives: [
            ...ring.widthCandidates.map((c) => ({ value: c.value, unit: 'cm' as const, rawText: c.text, confidence: round6(Math.min(1, c.score)), why: `width candidate: the upper half read as ${c.text} (match ${c.score})` })),
            ...ring.heightCandidates.map((c) => ({ value: c.value, unit: 'cm' as const, rawText: c.text, confidence: round6(Math.min(1, c.score)), why: `height candidate: the lower half read as ${c.text} (match ${c.score})` })),
          ],
          confidence: round6(Math.min(1, Math.max(0.05, Math.min(width.score, height.score))) * (ring.bar ? 1 : 0.5) * (readable ? 1 : 0.6)),
          provenance: { extractor: 'NUMERIC_OCR', name: `metrics.callout-ring@${METRIC_READER_VERSION}`, detail: ring.why },
          note: `width ${width.value} cm over height ${height.value} cm, from a ${2 * ring.circle.radiusPx} px ring callout${readable ? '' : ' (halves not read as one coherent pair)'}`,
        })
      }
    }

    // --- the ladder of level datums ---
    const placed = datumCandidates.filter((d) => d.geometry !== undefined)
    const ladder = solveLevelLadder(
      placed.map((d) => ({
        tokenId: d.record.id,
        rowPx: (d.geometry as { a: PixelPoint; b: PixelPoint }).a.y,
        // The reader's own first choice is the baseline the runners-up are
        // measured against, so it enters at 1 and they enter below it. Giving
        // the primary the token's absolute confidence instead would let a
        // runner-up outrank it for no better reason than that the token was a
        // hard one, which is how a ladder comes to move a ridge by a
        // centimetre in order to fit slightly better.
        readings: readingLattice(d.token).flatMap((candidate) =>
          parseNumber(candidate.text)
            .filter((parsed) => parsed.kind === 'LEVEL_DATUM')
            .map((parsed) => ({ value: parsed.value, rawText: candidate.text, confidence: candidate.confidence, substitutions: candidate.substitutions })),
        ),
      })),
    )
    placed.forEach((d, i) => {
      const solved = ladder.datums[i]
      const value = solved.value ?? d.parsed.value
      const corrected = solved.origin === 'CHAIN_CORRECTED'
      evidence.push({
        id: stableId('metric', 'level', { frameId: frame.id, box: d.token.box, value }),
        kind: 'LEVEL_DATUM',
        frameId: frame.id,
        assetId: frame.assetId,
        variantByteHash: frame.variantByteHash,
        value,
        unit: 'm',
        origin: solved.origin === 'UNRESOLVED' ? 'READ' : solved.origin,
        rawText: d.token.text,
        textBox: d.token.box,
        measuredGeometry: d.geometry,
        association: { kind: 'LEVEL_MARKER', score: d.associationScore, why: d.why, observationIds: d.observationId ? [d.observationId] : [] },
        ocrTokenIds: [d.record.id],
        observationIds: d.observationId ? [d.observationId] : [],
        alternatives: [
          ...d.alternatives,
          ...solved.rejected.slice(0, 3).map((r) => ({ value: r.value, unit: 'm' as const, rawText: r.rawText, confidence: 0.2, why: r.why })),
        ].slice(0, 5),
        confidence: round6(solved.origin === 'UNRESOLVED' ? d.token.confidence * 0.4 : Math.max(solved.confidence, 0.1) * Math.max(0.4, d.associationScore + 0.3)),
        provenance: {
          extractor: corrected ? 'CHAIN_SOLVER' : 'NUMERIC_OCR',
          name: corrected ? `metrics.level-ladder@${METRIC_READER_VERSION}` : `metrics.numeric-ocr@${METRIC_READER_VERSION}`,
          detail: corrected
            ? `the reader first read "${d.token.text}"; the other heights on this section put this rule at ${solved.rawText}`
            : d.parsed.why,
        },
        note: solved.origin === 'UNRESOLVED' && ladder.fitted > 0 ? 'no reading of this height agrees with the vertical scale the rest of the section states' : undefined,
      })
    })
    for (const d of datumCandidates.filter((x) => x.geometry === undefined)) {
      unresolved.push({
        id: stableId('gap', 'datum-row', { frameId: frame.id, box: d.token.box }),
        what: `the rule marked by the height "${d.token.text}" on ${frame.assetId}`,
        frameId: frame.id,
        reason: 'the height is printed but no line was found for it to mark, so it fixes no row',
        status: 'AMBIGUOUS',
        ocrTokenIds: [d.record.id],
      })
    }
    if (ladder.metresPerPixel !== undefined && ladder.zeroRowPx !== undefined && ladder.fitted >= 2) {
      // One anchor per RUNG, not one for the ladder.
      //
      // The ladder has already found the zero row, so each height above it is
      // an independent statement of the form "this many pixels is that many
      // metres" — which is exactly what a registration anchor is, and what
      // lets the registration report a residual per height instead of
      // inheriting one number from a fit it cannot see inside.
      placed.forEach((d, i) => {
        const solved = ladder.datums[i]
        if (solved.value === undefined || solved.value <= 0) return
        const pixelSpan = Math.abs((ladder.zeroRowPx as number) - solved.rowPx)
        if (pixelSpan < 20) return
        anchors.push({
          id: stableId('anchor', 'level', { frameId: frame.id, row: solved.rowPx, value: solved.value }),
          kind: 'LEVEL_DATUM_PAIR',
          evidenceIds: [stableId('metric', 'level', { frameId: frame.id, box: d.token.box, value: solved.value })],
          axis: 'Y',
          pixelSpan: round6(pixelSpan),
          metricSpan: solved.value,
          weight: round6(Math.max(0.1, solved.confidence)),
        })
      })
      ladderOrigin = { x: 0, y: ladder.zeroRowPx }
    }

    // --- the numbers nothing could be done with ---
    const orphaned = read.tokens.filter((t) => !usedTokens.has(t) && t.score >= 0.25)
    if (orphaned.length > 0) {
      unresolved.push({
        id: stableId('gap', 'unattached', { frameId: frame.id, count: orphaned.length }),
        what: `${orphaned.length} number-like token${orphaned.length === 1 ? '' : 's'} on ${frame.assetId}`,
        frameId: frame.id,
        reason: 'read, but not on a dimension line, a level marker, an angle marker or an opening symbol',
        status: 'AMBIGUOUS',
        ocrTokenIds: orphaned.map((t) => tokensById.get(t)?.id).filter((id): id is string => id !== undefined),
      })
    }

    // --- registration ---
    // One anchor is not a registration. A single "so many pixels is so many
    // metres" cannot be checked against anything, so it produces a scale with
    // a residual of exactly zero and no reason whatsoever to believe it; two
    // that agree are evidence, and two that disagree are at least honest.
    if (plane && anchors.length >= 2) {
      const registration = registerFrame({
        frameId: frame.id,
        assetId: frame.assetId,
        variantByteHash: frame.variantByteHash,
        plane,
        anchors,
        originPx: ladderOrigin ?? originFor(plane, chains.filter((c) => c.frameId === frame.id), evidence.filter((e) => e.frameId === frame.id)),
        flipX: false,
        // Image rows grow downwards; a building's height grows upwards. A plan's
        // second axis is depth, and the same flip keeps a plan right-handed.
        flipY: true,
        detail: `${anchors.length} anchor${anchors.length === 1 ? '' : 's'} from ${plane === 'PLAN_XZ' ? 'dimension chains' : 'level datums'} on ${frame.assetId}`,
      })
      if (registration) registrations.push(registration)
      else unresolved.push({ id: stableId('gap', 'registration', { frameId: frame.id }), what: `a metric registration for ${frame.assetId}`, frameId: frame.id, reason: 'the anchors did not determine a scale', status: 'AMBIGUOUS' })
    } else if (plane) {
      unresolved.push({
        id: stableId('gap', 'registration', { frameId: frame.id }),
        what: `a metric registration for ${frame.assetId}`,
        frameId: frame.id,
        reason:
          anchors.length === 1
            ? 'only one measured span on this sheet survived the chain solver; a single anchor fixes a scale without checking it'
            : plane === 'PLAN_XZ'
              ? 'no dimension chain on this sheet yielded a consistent scale'
              : 'this sheet prints no level datum and no dimension, so it states no scale of its own',
        status: anchors.length === 1 ? 'AMBIGUOUS' : 'MISSING',
      })
    }
  }

  // --- what the publisher wrote down, as against what it drew ---
  const spec = options.specifications && options.specifications.length > 0 && options.pageHash ? readSpecifications(options.specifications, options.pageHash) : undefined
  if (spec) {
    evidence.push(...spec.evidence)
    for (const line of spec.unread) {
      unresolved.push({
        id: stableId('gap', 'specification', { key: line.key }),
        what: `a measurement from the published specification line "${line.label}"`,
        reason: line.why,
        status: 'AMBIGUOUS',
      })
    }
  } else if (options.specifications && options.specifications.length > 0) {
    unresolved.push({
      id: stableId('gap', 'specification', { key: 'page-hash' }),
      what: "the publisher's printed technical specification",
      reason: 'the specification was supplied without the hash of the page it was printed on, and a reading is only valid for the bytes it came from',
      status: 'NOT_ATTEMPTED',
    })
  }

  // --- disagreements between sheets ---
  conflicts.push(...scaleConflicts(registrations, graph.coordinateFrames))

  const draft: MetricEvidenceDraft = {
    schema: 'buildapp.metric-evidence-set',
    schemaVersion: METRIC_EVIDENCE_SCHEMA_VERSION,
    sourcePackageId: options.sourcePackageId,
    sourcePackageHash: options.sourcePackageHash,
    observationGraphId: graph.id,
    observationGraphHash: graph.contentHash,
    extractors: [
      { name: 'metrics.numeric-ocr', version: METRIC_READER_VERSION },
      { name: 'metrics.dimension-lines', version: METRIC_READER_VERSION },
      { name: 'metrics.chain-solver', version: METRIC_READER_VERSION },
      { name: 'metrics.axis-aligned-affine', version: '1' },
      { name: SPEC_READER_NAME, version: SPEC_READER_VERSION },
    ],
    ocrTokens: ocrTokens.sort((a, b) => a.id.localeCompare(b.id)),
    evidence: evidence.sort((a, b) => a.id.localeCompare(b.id)),
    chains: chains.sort((a, b) => a.id.localeCompare(b.id)),
    coordinateRegistrations: registrations.sort((a, b) => a.id.localeCompare(b.id)),
    specificationFindings: (spec?.findings ?? []).slice(),
    conflicts: conflicts.sort((a, b) => a.id.localeCompare(b.id)),
    unresolved: unresolved.sort((a, b) => a.id.localeCompare(b.id)),
  }
  return sealMetricEvidence(draft, options.slug)
}

/** Alternative readings of one token, as metric values. Kept so a later stage can revisit this one's decision. */
function parseAlternatives(token: TextToken): MetricEvidence['alternatives'] {
  const out: MetricEvidence['alternatives'] = []
  const seen = new Set<string>()
  for (const glyph of token.glyphs) {
    for (const alt of glyph.alternatives.slice(0, 2)) {
      const text = token.glyphs.map((g) => (g === glyph ? alt.char : g.char)).join('')
      if (text === token.text || seen.has(text)) continue
      seen.add(text)
      const parsed = parseNumber(text)[0]
      if (!parsed) continue
      out.push({ value: parsed.value, unit: parsed.unit, rawText: text, confidence: round6(Math.min(1, glyph.score <= 0 ? 0 : alt.score / glyph.score)), why: `a runner-up reading of one character` })
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence || a.rawText.localeCompare(b.rawText)).slice(0, 4)
}

/** Turn a solved chain into a record, its segments into evidence, and its fitted segments into registration anchors. */
function buildChain(
  frame: SourceCoordinateFrame,
  chain: RawChain,
  solved: SolvedChain,
  tokensById: Map<TextToken, OcrToken>,
  evidence: MetricEvidence[],
  anchors: ScaleAnchorInput[],
  usedTokens: Set<TextToken>,
): DimensionChain | undefined {
  const id = chainId(frame.id, chain.axis, chain.baselinePx, chain.ticks.map((t) => t.atPx))
  const axis = chain.axis === 'HORIZONTAL' ? 'X' : 'Y'
  const tokenIds: string[] = []
  const segments: DimensionChain['segments'] = []
  let fittedCount = 0

  for (const segment of solved.segments) {
    const record = segment.token ? tokensById.get(segment.token) : undefined
    if (segment.token) usedTokens.add(segment.token)
    if (record) tokenIds.push(record.id)
    const along = (at: number): PixelPoint => (chain.axis === 'HORIZONTAL' ? { x: at, y: chain.baselinePx } : { x: chain.baselinePx, y: at })
    if (segment.valueCm !== undefined && segment.origin !== 'UNRESOLVED') {
      const evidenceId = stableId('metric', 'dimension', { frameId: frame.id, chain: id, from: segment.fromPx, to: segment.toPx })
      const association: Association = {
        kind: segment.token ? 'WITNESS_LINE_PAIR' : 'DIMENSION_LINE',
        score: round6(segment.token ? Math.max(0.15, 1 - (segment.residualPx ?? 0) / 2.2) : 0.3),
        why: segment.token
          ? `printed between the tick marks ${segment.pixelLength} px apart on the ${chain.axis.toLowerCase()} chain at ${chain.baselinePx}, missing the chain's own scale by ${segment.residualPx ?? 0} px`
          : `nothing is printed on this ${segment.pixelLength} px span; its value follows from the scale the rest of the chain agrees on`,
        observationIds: chain.observationIds,
      }
      evidence.push({
        id: evidenceId,
        kind: 'LINEAR_DIMENSION',
        frameId: frame.id,
        assetId: frame.assetId,
        variantByteHash: frame.variantByteHash,
        value: segment.valueCm,
        unit: 'cm',
        origin: segment.origin,
        rawText: segment.text ?? '',
        textBox: segment.token?.box,
        measuredGeometry: { type: 'SEGMENT', a: along(segment.fromPx), b: along(segment.toPx) },
        pixelLength: segment.pixelLength,
        association,
        chainId: id,
        ocrTokenIds: record ? [record.id] : [],
        observationIds: chain.observationIds,
        alternatives: segment.rejected.slice(0, 4).map((r) => ({ value: r.valueCm, unit: 'cm' as const, rawText: r.text, confidence: 0.2, why: r.why })),
        confidence: segment.confidence,
        provenance: {
          extractor: segment.origin === 'DERIVED' ? 'DERIVED' : 'CHAIN_SOLVER',
          name: `metrics.chain-solver@${METRIC_READER_VERSION}`,
          detail: segment.origin === 'CHAIN_CORRECTED' ? `the reader first read "${segment.token?.text ?? ''}"; the chain's scale endorses "${segment.text}"` : association.why,
        },
      })
      segments.push({
        index: segment.index,
        fromPx: segment.fromPx,
        toPx: segment.toPx,
        pixelLength: segment.pixelLength,
        evidenceId,
        valueCm: segment.valueCm,
        origin: segment.origin,
        confidence: segment.confidence,
        residualCm: segment.residualCm,
      })
      // Only a segment whose number was actually READ anchors a registration.
      // A derived segment is the scale restated, and fitting a scale to its own
      // output is how a registration comes to report a residual of zero while
      // being wrong.
      if (segment.origin !== 'DERIVED' && segment.confidence > 0) {
        fittedCount += 1
        anchors.push({
          id: stableId('anchor', 'chain-segment', { frameId: frame.id, chain: id, from: segment.fromPx, to: segment.toPx }),
          kind: 'CHAIN_SEGMENT',
          evidenceIds: [evidenceId],
          axis,
          pixelSpan: segment.pixelLength,
          metricSpan: round6(segment.valueCm / 100),
          weight: segment.confidence,
        })
      }
    } else {
      segments.push({ index: segment.index, fromPx: segment.fromPx, toPx: segment.toPx, pixelLength: segment.pixelLength, confidence: 0 })
    }
  }

  if (segments.length === 0) return undefined
  const closes = solved.derivedTotalCm !== undefined && solved.readSegments > 0 && solved.residualPx <= 1.2
  return {
    id,
    frameId: frame.id,
    assetId: frame.assetId,
    axis: chain.axis,
    baselinePx: chain.baselinePx,
    ticksPx: chain.ticks.map((t) => t.atPx),
    segments,
    derivedTotalCm: solved.derivedTotalCm,
    scale: solved.cmPerPixel === undefined ? undefined : { cmPerPixel: solved.cmPerPixel, residualRatio: round6(solved.residualPx), readSegments: solved.readSegments },
    closes,
    observationIds: chain.observationIds,
    ocrTokenIds: [...new Set(tokenIds)].sort(),
    note:
      solved.skippedTicks.length > 0
        ? `${solved.skippedTicks.length} detected tick${solved.skippedTicks.length === 1 ? '' : 's'} were not measurement points: no reading on this chain is consistent with a division there`
        : fittedCount > 0
          ? undefined
          : 'no number on this chain could be reconciled with the sheet scale',
  }
}

/**
 * Where a frame's metric origin sits.
 *
 * For a plan it is the corner of the dimensioned extent: the first tick of the
 * longest chain on each axis, which is the point every printed dimension on the
 * sheet is ultimately measured from. For a section or elevation it is the zero
 * datum if one is printed, because that is what the sheet itself calls zero.
 */
function originFor(plane: RegistrationPlane, chains: readonly DimensionChain[], evidence: readonly MetricEvidence[]): PixelPoint {
  if (plane === 'PLAN_XZ') {
    const longest = (axis: 'HORIZONTAL' | 'VERTICAL'): DimensionChain | undefined =>
      chains.filter((c) => c.axis === axis).sort((a, b) => b.ticksPx[b.ticksPx.length - 1] - b.ticksPx[0] - (a.ticksPx[a.ticksPx.length - 1] - a.ticksPx[0]))[0]
    const h = longest('HORIZONTAL')
    const v = longest('VERTICAL')
    return { x: round6(h?.ticksPx[0] ?? 0), y: round6(v?.ticksPx[0] ?? 0) }
  }
  const zero = evidence
    .filter((e) => e.kind === 'LEVEL_DATUM' && Math.abs(e.value) < 1e-6 && e.measuredGeometry?.type === 'SEGMENT')
    .sort((a, b) => b.confidence - a.confidence)[0]
  if (zero && zero.measuredGeometry?.type === 'SEGMENT') return { x: round6(zero.measuredGeometry.a.x), y: round6((zero.measuredGeometry.a.y + zero.measuredGeometry.b.y) / 2) }
  return { x: 0, y: 0 }
}

/**
 * Two sheets that state different scales for the same building.
 *
 * Recorded, never reconciled here. Which sheet is right is a question about
 * the project, and this layer has no way to answer it; what it can do is make
 * sure the disagreement reaches the stage that does.
 */
function scaleConflicts(registrations: readonly MetricEvidenceSet['coordinateRegistrations'][number][], frames: readonly SourceCoordinateFrame[]): MetricConflict[] {
  const sizeOf = new Map(frames.map((f) => [f.id, f.size]))
  const out: MetricConflict[] = []
  // Only two readings of the SAME drawing are comparable. Two different sheets
  // legitimately differ in metres per pixel — that is what a different
  // resolution IS — and calling that a conflict would bury the real ones. Two
  // variants of one asset, though, are the same drawing at two sizes, so the
  // metres they say the sheet is wide must agree.
  const byAsset = new Map<string, typeof registrations>()
  for (const r of registrations) byAsset.set(r.assetId, [...(byAsset.get(r.assetId) ?? []), r])
  for (const [assetId, group] of [...byAsset].sort((a, b) => a[0].localeCompare(b[0]))) {
    const widths = group
      .map((r) => ({ r, width: (sizeOf.get(r.frameId)?.width ?? 0) * r.metresPerPixelX }))
      .filter((w) => w.width > 0)
      .sort((a, b) => a.width - b.width)
    for (let i = 0; i + 1 < widths.length; i += 1) {
      const a = widths[i]
      const b = widths[i + 1]
      const ratio = Math.abs(Math.log(a.width / b.width))
      if (ratio < 0.02) continue
      out.push({
        id: stableId('conflict', 'scale', { a: a.r.id, b: b.r.id }),
        evidenceIds: [...a.r.anchors.flatMap((x) => x.evidenceIds), ...b.r.anchors.flatMap((x) => x.evidenceIds)].sort(),
        kind: 'SCALE_DISAGREEMENT',
        what: `two renderings of ${assetId} disagree about how wide the sheet is, by ${round6((Math.exp(ratio) - 1) * 100)} per cent`,
        magnitude: round6(Math.abs(a.width - b.width)),
        unit: 'm',
        note: `one reads ${round6(a.width)} m across, the other ${round6(b.width)} m`,
      })
    }
  }
  return out
}
