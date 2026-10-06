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
import { NO_CHECKPOINT, round6, stableId } from '@buildapp/source-common'
import type { Checkpoint } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import { adaptiveInkMask, bandThicknessQuantile, inkChannel, runLengthBands } from '@buildapp/source-cv'
import type { Mask } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import { chainsFromLines, chainId, solveFrameChains } from './chains.js'
import type { RawChain, ScalePlausibility, SolvedChain } from './chains.js'
import { DIMENSION_TOPOLOGY_NAME, DIMENSION_TOPOLOGY_VERSION, findDimensionLines, findStraightRuns, markLabelInk } from './dimension-lines.js'
import type { DimensionLine, LabelInk } from './dimension-lines.js'
import { AXIS_TOPOLOGY_NAME, AXIS_TOPOLOGY_VERSION, dimensionAxisGroups, measurementChain } from './axis-topology.js'
import type { ChainAxisTopology, LabelAssignmentDecision, SideConventions } from './axis-topology.js'
import { readNumbers } from './ocr.js'
import { METRIC_SOLVER_NAME, METRIC_SOLVER_VERSION, labelHeightOf, solveFrameMetric, textRegions } from './metric-solution.js'
import { NUMERIC_LATTICE_ENSEMBLE_VERSION, NUMERIC_LATTICE_NAME, NUMERIC_LATTICE_VERSION, dimensionStyleOf, labelLattice, styleFor } from './numeric-lattice.js'
import type { LatticeCache } from './numeric-lattice.js'
import { OCR_ENSEMBLE_NAME, OCR_ENSEMBLE_VERSION, ensembleOf } from './ensemble.js'
import type { EnsembledLattice as LabelLattice } from './ensemble.js'
import { labelCrop } from './recogniser.js'
import type { ExternalReading, LabelCrop, LabelRecogniser } from './recogniser.js'
import { textAxisOf } from './ocr.js'
import { readOpeningCallouts } from './callouts.js'
import type { OcrResult, TextToken } from './ocr.js'
import { parseNumber, readingLattice } from './parse.js'
import { registerFrame, solveLevelLadder } from './registration.js'
import type { ScaleAnchorInput } from './registration.js'
import { readSpecifications, SPEC_READER_NAME, SPEC_READER_VERSION } from './specifications.js'
import type { PublishedSpecificationInput } from './specifications.js'
import { sealMetricEvidence } from './hash.js'
import type { MetricEvidenceDraft } from './hash.js'
import { METRIC_EVIDENCE_TOPOLOGY_ENSEMBLE_SCHEMA_VERSION, METRIC_EVIDENCE_TOPOLOGY_SCHEMA_VERSION } from './schema.js'
import type { Association, ChainRelation, DimensionChain, DimensionObservation, DimensionTopologyRecord, FrameMetricSolution, LabelAssignmentRecord, MetricConflict, MetricEvidence, MetricEvidenceSet, NumericLatticeRecord, OcrToken, RegistrationPlane, UnresolvedMetric } from './schema.js'

/** 1.4.0 (005I): labels are assigned to chains globally, and label-ink marks are no measurement points. */
export const METRIC_READER_VERSION = '1.4.0' as const

/** The bytes of one asset variant, decoded. Returning nothing means the variant could not be read, which is recorded as a gap. */
export type RasterSource = (frame: SourceCoordinateFrame) => Raster | undefined

export type ExtractOptions = {
  /** Told at each frame and inside the long readers, for progress and cancellation; nothing it does reaches the evidence. */
  checkpoint?: Checkpoint
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
  /** Sha-256 of the specification text as published (`publishedSpecificationsHash`). Required to read one. */
  specificationHash?: string
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

/**
 * The one drawing convention this layer leans on to CHECK a plan's scale.
 *
 * A floor plan draws its walls as the heaviest continuous strokes on the
 * sheet, and its outer walls as the heaviest of those. An outer wall has a
 * thickness a person can build: 15 cm of timber frame, 50 of insulated
 * masonry, 75 of rubble — not a metre and a half, and not 4 cm. So a scale is
 * plausible for a plan only if it makes the thickness its heavier walls are
 * drawn at (the upper quartile of the drawn wall length, so that a plan full
 * of partitions is still judged by its outer walls) a thickness an outer wall
 * can have. Nothing is measured or derived from this: it only tells the chain
 * vote which of the scales the printed numbers support this drawing can be at.
 *
 * Where the sheet draws no heavy bands to judge by, nothing is ruled out.
 */
export const PLAN_OUTER_WALL_M = { min: 0.15, max: 0.8 } as const

export function planScalePlausibility(mask: Mask): ScalePlausibility | undefined {
  const survey = runLengthBands(mask, { minThickness: 6, maxThickness: 40, minLength: 24 })
  if (survey.length === 0) return undefined
  const outerPx = bandThicknessQuantile(survey, 0.75, 0)
  if (outerPx < 3) return undefined
  return (cmPerPixel: number) => {
    const m = round6((outerPx * cmPerPixel) / 100)
    const plausible = m >= PLAN_OUTER_WALL_M.min && m <= PLAN_OUTER_WALL_M.max
    return {
      plausible,
      why: plausible
        ? `the plan's heavier walls, drawn ${outerPx} px thick, come out ${m} m`
        : `it would make the plan's heavier walls, drawn ${outerPx} px thick, ${m} m thick, outside the ${PLAN_OUTER_WALL_M.min}–${PLAN_OUTER_WALL_M.max} m an outer wall can be`,
    }
  }
}

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

const toOcrToken = (frame: SourceCoordinateFrame, token: TextToken, pageVote?: OcrToken['pageVote']): OcrToken => ({
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
  orientation: token.orientation,
  ...(pageVote ? { pageVote } : {}),
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

/**
 * The apex of a level symbol printed under a height: the small triangle
 * pointing down at the level (▽), usually drawn in a thin, light line with a
 * rule along its top.
 *
 * Searched on the raster itself rather than the ink mask, because the symbol
 * is drawn lighter than anything else on the sheet and anti-aliasing breaks
 * its edges into dots the mask drops. Found as a POINT: the apex is the place
 * below the text from which two edges run up and outwards at the symbol's
 * angle to the row of its top, each edge seen on most rows between. A digit
 * does not have two symmetric edges converging on a point below it; a rule
 * has no edges at all.
 */
export function markerApexBelow(raster: Raster, box: PixelRect): { row: number; x: number; distance: number } | undefined {
  const h = Math.max(1, box.y1 - box.y0)
  const dark = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return false
    const i = (y * raster.width + x) * 4
    return 0.299 * raster.data[i] + 0.587 * raster.data[i + 1] + 0.114 * raster.data[i + 2] < 225
  }
  const near = (x: number, y: number): boolean => dark(Math.round(x) - 1, y) || dark(Math.round(x), y) || dark(Math.round(x) + 1, y)
  const x0 = Math.round(box.x0 - h * 0.6)
  const x1 = Math.round(box.x1 + h * 0.6)
  // The symbol's top: the first row under the text with a stroke at least a
  // third of a character long, breaks of two pixels forgiven.
  let top = -1
  for (let y = Math.round(box.y1) + 1; y <= Math.round(box.y1 + h * 0.8) && top < 0; y += 1) {
    let run = 0
    let gap = 0
    for (let x = x0; x <= x1; x += 1) {
      if (dark(x, y)) {
        run += 1 + gap
        gap = 0
      } else if (run > 0 && gap < 2) gap += 1
      else {
        run = 0
        gap = 0
      }
      if (run >= h * 0.35) {
        top = y
        break
      }
    }
  }
  if (top < 0) return undefined
  let best: { row: number; x: number; score: number } | undefined
  for (let ya = top + Math.max(3, Math.round(h * 0.2)); ya <= top + Math.round(h * 0.9); ya += 1) {
    for (let xa = x0; xa <= x1; xa += 1) {
      if (!near(xa, ya)) continue
      for (const t of [0.45, 0.577, 0.72]) {
        let seen = 0
        let rows = 0
        for (let y = top + 1; y < ya; y += 1) {
          rows += 1
          const d = (ya - y) * t
          if (near(xa - d, y) && near(xa + d, y)) seen += 1
        }
        if (rows < 3) continue
        const score = seen / rows
        // The deeper apex wins a tie: the symbol's point, not a crossing halfway down its edges.
        if (score >= 0.6 && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && ya > best.row))) best = { row: ya, x: xa, score }
      }
    }
  }
  return best ? { row: best.row, x: best.x, distance: round6(best.row - box.y1) } : undefined
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
 *
 * Synchronous, and reads with the numeric lattice alone: what every caller had
 * before 005H, byte for byte. `extractMetricEvidenceAsync` is the same reading
 * with an external recogniser heard as a second witness.
 */
export function extractMetricEvidence(options: ExtractOptions): MetricEvidenceSet {
  const step = metricEvidenceSteps(options, undefined).next()
  // Without a recogniser the reading never waits on one: the first step is the end.
  if (!step.done) throw new Error('extractMetricEvidence: a reading without a recogniser asked for one')
  return step.value
}

/** 005H: one frame's labels, handed to the recogniser in one batch. */
export type RecogniserRequest = { frameId: string; crops: LabelCrop[] }

export type ExtractAsyncOptions = ExtractOptions & {
  /** The external numeric recogniser (005H). Absent: exactly `extractMetricEvidence`. */
  recogniser?: LabelRecogniser
  signal?: AbortSignal
  /** Told before each frame's batch and after each label of it: telemetry only. */
  onRecognise?: (event: { frameId: string; done: number; total: number }) => void
}

/**
 * 005H: the same reading with an external recogniser heard beside the lattice. Each plan frame's dimension labels
 * are cut from the pass fields the lattice read (`labelCrop`) and handed to the recogniser in ONE batch, before the
 * frame's scale, chains or metric solution exist; its readings come back as candidates and the ensemble rule
 * (`ensembleOf`) records what the two witnesses make of each label. Everything after that is the synchronous reading.
 * With no recogniser it is `extractMetricEvidence`, and returns the same bytes.
 */
export async function extractMetricEvidenceAsync(options: ExtractAsyncOptions): Promise<MetricEvidenceSet> {
  const { recogniser } = options
  if (!recogniser) return extractMetricEvidence(options)
  const steps = metricEvidenceSteps(options, recogniser)
  let step = steps.next()
  while (!step.done) {
    const { frameId, crops } = step.value
    options.onRecognise?.({ frameId, done: 0, total: crops.length })
    const readings = crops.length === 0 ? [] : await recogniser.recognise(crops, { signal: options.signal, onProgress: (done, total) => options.onRecognise?.({ frameId, done, total }) })
    step = steps.next(readings)
  }
  return step.value
}

/**
 * The reading itself, as steps: it yields once per plan frame that has dimension labels when a recogniser is given,
 * and is handed back that frame's external readings; with none it never yields. One implementation for both callers.
 */
function* metricEvidenceSteps(options: ExtractOptions, recogniser: Pick<LabelRecogniser, 'id' | 'model' | 'runtime' | 'runtimeSha256'> | undefined): Generator<RecogniserRequest, MetricEvidenceSet, ExternalReading[]> {
  const { graph } = options
  const keep = options.frameFilter ?? DEFAULT_FRAME_FILTER
  const tolerancePx = options.tolerancePx ?? 2.2

  const ocrTokens: OcrToken[] = []
  const evidence: MetricEvidence[] = []
  const chains: DimensionChain[] = []
  const registrations: MetricEvidenceSet['coordinateRegistrations'] = []
  const conflicts: MetricConflict[] = []
  const unresolved: UnresolvedMetric[] = []
  const dimensionObservations: DimensionObservation[] = []
  const metricSolutions: FrameMetricSolution[] = []
  const chainRelations: ChainRelation[] = []
  const numericLattices: NumericLatticeRecord[] = []
  const dimensionTopology: DimensionTopologyRecord[] = []
  // 005H: how many labels the external recogniser read; none, and the set is the 1.5.0 set it was before.
  let heard = 0
  // 005E: identical label crops are read once in a run; a hit is verified byte for byte. (Twin copies of a published
  // plan are seldom byte-identical crops: on the development rows the cache never hit.)
  const latticeCache: LatticeCache = new Map()

  const checkpoint = options.checkpoint ?? NO_CHECKPOINT
  const frames = [...graph.coordinateFrames].sort((a, b) => a.id.localeCompare(b.id)).filter((f) => keep(f))
  for (const [frameIndex, frame] of frames.entries()) {
    checkpoint.tick({ done: frameIndex, total: frames.length, assetIndex: frameIndex + 1, assetTotal: frames.length, subphase: { id: 'FRAME', label: `${frame.roles.document.toLowerCase().replace(/_/g, ' ')}` }, counters: { tokens: ocrTokens.length, chains: chains.length, evidence: evidence.length } })
    const plane = planeOf(frame)
    const raster = options.raster(frame)
    if (!raster) {
      unresolved.push({ id: stableId('gap', 'undecodable', { frameId: frame.id }), what: `metric evidence on ${frame.assetId}`, frameId: frame.id, reason: 'the variant could not be decoded in this environment', status: 'MISSING' })
      continue
    }
    const observations = graph.observations.filter((o) => o.frameId === frame.id)
    let ladderOrigin: PixelPoint | undefined
    // A floor plan's dimensions are read every way up and kept every way up (005B): which way
    // up a label is printed is decided on the chain, from evidence, not by a page-wide vote.
    const isPlan = frame.roles.document === 'FLOOR_PLAN' && plane === 'PLAN_XZ'
    const read = readNumbers(raster, { checkpoint, hypotheses: isPlan, retainPasses: isPlan })
    const tokensById = new Map<TextToken, OcrToken>()
    const keptByVote = new Set(read.tokens)
    for (const token of read.raw ?? read.tokens) {
      const record = toOcrToken(frame, token, read.raw ? (keptByVote.has(token) ? 'KEPT' : 'DISCARDED') : undefined)
      tokensById.set(token, record)
      ocrTokens.push(record)
    }

    // --- dimension chains ---
    const chainStep = (): void => checkpoint.tick({ subphase: { id: 'CHAINS', label: 'reading dimension chains' } })
    const grey = inkChannel(raster)
    const mask = adaptiveInkMask(grey, {})
    chainStep()
    const runs = findStraightRuns(mask)
    chainStep()
    // 005D: every crossing mark measured against the line it sits on, and classified.
    const { allChains, rawChains, measured, labelInkLines } = dimensionChainsOf(findDimensionLines(mask, { raster, grey }), read.raw ?? read.tokens, mask, observations)
    chainStep()
    const plausibility = frame.roles.document === 'FLOOR_PLAN' && plane === 'PLAN_XZ' ? planScalePlausibility(mask) : undefined
    chainStep()
    const solution = solveFrameChains(measured, read.tokens, { tolerancePx, plausibility, checkpoint })
    if (solution.scaleDecision) {
      const d = solution.scaleDecision
      unresolved.push({
        id: stableId('gap', 'scale-implausible', { frameId: frame.id }),
        what: `the sheet scale of ${frame.assetId}`,
        frameId: frame.id,
        reason: d.chosen
          ? `the chains' strongest vote, ${d.rejected.cmPerPixel} cm/px (${d.rejected.support} numbers on ${d.rejected.chains} chains), is ruled out: ${d.rejected.why}; ${d.chosen.cmPerPixel} cm/px was taken instead — ${d.chosen.why}`
          : `the chains' strongest vote, ${d.rejected.cmPerPixel} cm/px, is ruled out (${d.rejected.why}) and no other scale is stated by three numbers on two chains, so this plan carries no scale`,
        status: 'AMBIGUOUS',
      })
    }
    const usedTokens = new Set<TextToken>()
    const anchors: ScaleAnchorInput[] = []

    // --- the independent metric solution (005B) ---
    // The legacy vote's solution is the incumbent. The frame's own readings, as read and bound to
    // their ticks, confirm it, replace it or leave it unconfirmed, and each chain is read in the
    // orientation its own evidence chose. Where nothing changes, the chains are the legacy ones.
    let solvedChains = solution.solved
    let orientationOf: Array<{ orientation: TextToken['orientation'] | null; dependsOnScale: boolean }> | undefined
    let reread = new Set<number>()
    let scaleStands = true
    const ids = rawChains.map((c) => chainId(frame.id, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
    // 005I: neighbouring parallel lines, and each chain's place among them (from marks and label heights only).
    const labelHeightPx = labelHeightOf(measured, read.raw ?? read.tokens)
    const axisGroups = dimensionAxisGroups(frame.id, measured, ids, labelHeightPx)
    let finalAssignment: LabelAssignmentDecision[] | undefined
    let finalConventions: SideConventions | undefined
    if (isPlan && read.raw) {
      // 005E: the numeric lattice of every ink that lies on a dimension line — the geometric test the label assignment
      // makes, before any scale — re-read from the very ink field its pass read. Image only.
      const lattices = new Map<TextToken, { id: string; lattice: LabelLattice }>()
      const read5e = dimensionLabelLattices(read, allChains, { width: raster.width, height: raster.height }, {
        cache: latticeCache,
        onLabel: (label, labelsTotal) => checkpoint.tick({ subphase: { id: 'OCR_LATTICE', label: 'reading dimension labels' }, counters: { label, labelsTotal } }),
      })
      for (const [token, lattice] of read5e) {
        const id = stableId('ocr-lattice', token.text.replace(/[^0-9a-z]/gi, '') || 'token', { frameId: frame.id, box: token.box, orientation: token.orientation })
        lattices.set(token, { id, lattice })
      }
      // 005H: the external recogniser reads the same labels, from the same pass fields, before anything below knows a
      // scale: one batch for the frame. Its readings are candidates; the ensemble rule says what the two witnesses make
      // of each label, and the lattice's own reading stays on the record beside it.
      // The crops are keyed opaquely (`c0`, `c1`, …): a lattice id carries the custom reader's text, and nothing but
      // pixels may reach the other reader (red team A5).
      if (recogniser && lattices.size > 0) {
        const crops: LabelCrop[] = []
        const tokenOf = new Map<string, TextToken>()
        for (const [token] of lattices) {
          const field = read.passes?.[token.orientation]
          if (!field || !token.passBox) continue
          const key = `c${crops.length}`
          tokenOf.set(key, token)
          crops.push(labelCrop(key, field, token.passBox))
        }
        const readings: ExternalReading[] = yield { frameId: frame.id, crops }
        for (const reading of readings) {
          const token = tokenOf.get(reading.key)
          const held = token && lattices.get(token)
          if (!token || !held || held.lattice.external) continue
          const external = { ...reading, key: held.id }
          const reader = { name: NUMERIC_LATTICE_NAME, version: NUMERIC_LATTICE_ENSEMBLE_VERSION }
          lattices.set(token, { id: held.id, lattice: { ...held.lattice, reader, external, ensemble: ensembleOf(held.lattice, external) } })
          heard += 1
        }
      }
      for (const [token, { id, lattice }] of lattices) numericLattices.push(latticeRecord(id, frame.id, token, lattice))
      const metric = solveFrameMetric({ frameId: frame.id, assetId: frame.assetId, chains: measured, chainIds: ids, raw: read.raw, legacyTokens: read.tokens, legacy: solution, tolerancePx, plausibility, checkpoint, lattices })
      solvedChains = metric.solved
      finalAssignment = metric.assignment
      finalConventions = metric.assignmentConventions
      orientationOf = metric.chainOrientation
      scaleStands = metric.solution.relation !== 'REPLACED' && metric.solution.relation !== 'ADDED'
      reread = new Set(ids.map((id, i) => (metric.solution.rereadChainIds.includes(id) || !scaleStands ? i : -1)).filter((i) => i >= 0))
      metricSolutions.push(metric.solution)
      dimensionObservations.push(...metric.observations)
      chainRelations.push(...metric.relations)
    }

    rawChains.forEach((chain, index) => {
      const solved = solvedChains[index]
      if (solved.segments.length === 0) return
      // Where the page vote's scale stands, a chain read again the right way up adds its readings
      // as evidence but anchors the registration only with the segments the vote's own reading
      // anchored: a confirmed scale is not re-fitted, so confirming it never moves a model.
      const legacySolved = solution.solved[index]
      const anchorable =
        scaleStands && reread.has(index)
          ? (g: SolvedChain['segments'][number]): boolean => legacySolved.segments.some((l) => l.fromPx === g.fromPx && l.toPx === g.toPx && l.origin === g.origin && l.valueCm === g.valueCm && l.confidence === g.confidence)
          : undefined
      const record = buildChain(frame, chain, solved, tokensById, evidence, anchors, usedTokens, orientationOf?.[index], anchorable, axisGroups.perChain[index])
      if (record) chains.push(record)
    })
    if (isPlan) {
      const assignmentRecord = (list: readonly LabelAssignmentDecision[]): LabelAssignmentRecord[] =>
        list
          .map((d) => ({
            text: d.text,
            orientation: d.orientation,
            box: d.box,
            status: d.status,
            ...(d.chosen ? { chosen: { chainId: ids[d.chosen.chain], interval: d.chosen.interval } } : {}),
            ...(d.margin !== undefined ? { margin: d.margin } : {}),
            ...(d.bounded ? { bounded: true as const } : {}),
            candidates: d.candidates.map((c) => ({ chainId: ids[c.chain], interval: c.interval, offset: c.offset, side: c.side, againstConvention: c.againstConvention, centred: c.centred, cost: c.cost })),
          }))
          .sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0 || (a.orientation < b.orientation ? -1 : a.orientation > b.orientation ? 1 : 0) || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
      dimensionTopology.push({
        frameId: frame.id,
        labelHeightPx: round6(labelHeightPx),
        labelInkMarks: rawChains
          .flatMap((c, i) => c.ticks.filter((t) => (t.reasons ?? []).includes('TEXT_INK')).map((t) => ({ chainId: ids[i], atPx: t.atPx, class: t.class === 'REJECTED' ? ('REJECTED' as const) : ('QUESTIONABLE' as const) })))
          .sort((a, b) => (a.chainId < b.chainId ? -1 : a.chainId > b.chainId ? 1 : a.atPx - b.atPx)),
        labelInkLines: labelInkLines.map((c) => ({ axis: c.axis, baselinePx: c.baselinePx, fromPx: c.ticks[0].atPx, toPx: c.ticks[c.ticks.length - 1].atPx, marks: c.ticks.length })),
        groups: axisGroups.groups.map((g) => ({
          id: g.id,
          axis: g.axis,
          chainIds: g.members.map((m) => ids[m]),
          separations: g.separations.map((x) => ({ fromChainId: ids[x.from], toChainId: ids[x.to], px: x.px, heights: x.heights })),
          relations: g.relations.map((r) => ({ aChainId: ids[r.a], bChainId: ids[r.b], kind: r.kind, alignedEnds: r.alignedEnds })),
        })),
        assignment: { legacy: assignmentRecord(solution.assignment), ...(finalAssignment ? { final: assignmentRecord(finalAssignment) } : {}) },
        sideConventions: { legacy: solution.assignmentConventions, ...(finalConventions ? { final: finalConventions } : {}) },
      })
    }
    // A label a re-read chain took in another orientation is the same ink as the page vote's token
    // for it: that token is used too, and must not be read again as a datum, an angle or a gap.
    if (reread.size > 0 && read.raw) {
      const { regionOf } = textRegions(frame.id, read.raw)
      const usedRegions = new Set([...usedTokens].map((t) => regionOf.get(t)?.id).filter((id): id is string => id !== undefined))
      for (const t of read.tokens) if (usedRegions.has(regionOf.get(t)?.id ?? '')) usedTokens.add(t)
    }

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
        // No line to mark: a ridge, an eaves corner, a level on a slope. The
        // symbol printed under the height still points at it.
        const apex = attached || rule ? undefined : markerApexBelow(raster, token.box)
        const geometry =
          attached && near.observation.pixelGeometry.type === 'SEGMENT'
            ? near.observation.pixelGeometry
            : rule
              ? ({ type: 'SEGMENT', a: { x: rule.line.fromPx, y: rule.line.baselinePx }, b: { x: rule.line.toPx, y: rule.line.baselinePx } } as const)
              : apex
                ? ({ type: 'SEGMENT', a: { x: apex.x - 1, y: apex.row }, b: { x: apex.x + 1, y: apex.row } } as const)
                : undefined
        datumCandidates.push({
          token,
          record,
          parsed,
          alternatives,
          geometry,
          observationId: attached ? near.observation.id : undefined,
          associationScore: attached ? round6(Math.max(0.1, 1 - near.distance / Math.max(1, token.height * 1.6))) : rule ? round6(Math.max(0.1, 0.8 - rule.distance / Math.max(1, token.height * 2))) : apex ? 0.5 : 0,
          why: attached
            ? `${near.distance} px from a level line on the same sheet`
            : rule
              ? `printed ${rule.distance} px above a ${round6(rule.line.toPx - rule.line.fromPx)} px horizontal rule read from the same bytes`
              : apex
                ? `printed above a level symbol whose apex, ${apex.distance} px below the text, marks the row`
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
      for (const ring of readOpeningCallouts(raster, { frameId: frame.id, checkpoint })) {
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
  const spec = options.specifications && options.specifications.length > 0 && options.specificationHash ? readSpecifications(options.specifications, options.specificationHash) : undefined
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
    // 005H: a set in which the recogniser read at least one label says so in its version, its readers and its
    // `recogniser`. 005I: every set carries the dimension topology — 1.8.0 when the recogniser read a label, 1.7.0 when
    // it read nothing (no recogniser, or no dimensioned plan). Before 005I the latter was a 1.5.0 set.
    schemaVersion: heard > 0 ? METRIC_EVIDENCE_TOPOLOGY_ENSEMBLE_SCHEMA_VERSION : METRIC_EVIDENCE_TOPOLOGY_SCHEMA_VERSION,
    sourcePackageId: options.sourcePackageId,
    sourcePackageHash: options.sourcePackageHash,
    observationGraphId: graph.id,
    observationGraphHash: graph.contentHash,
    extractors: [
      { name: 'metrics.numeric-ocr', version: METRIC_READER_VERSION },
      { name: 'metrics.dimension-lines', version: METRIC_READER_VERSION },
      { name: DIMENSION_TOPOLOGY_NAME, version: DIMENSION_TOPOLOGY_VERSION },
      { name: AXIS_TOPOLOGY_NAME, version: AXIS_TOPOLOGY_VERSION },
      { name: 'metrics.chain-solver', version: METRIC_READER_VERSION },
      { name: 'metrics.axis-aligned-affine', version: '1' },
      { name: SPEC_READER_NAME, version: SPEC_READER_VERSION },
      { name: METRIC_SOLVER_NAME, version: METRIC_SOLVER_VERSION },
      { name: NUMERIC_LATTICE_NAME, version: heard > 0 ? NUMERIC_LATTICE_ENSEMBLE_VERSION : NUMERIC_LATTICE_VERSION },
      ...(heard > 0 ? [{ name: OCR_ENSEMBLE_NAME, version: OCR_ENSEMBLE_VERSION }] : []),
    ],
    ocrTokens: ocrTokens.sort((a, b) => a.id.localeCompare(b.id)),
    evidence: evidence.sort((a, b) => a.id.localeCompare(b.id)),
    chains: chains.sort((a, b) => a.id.localeCompare(b.id)),
    coordinateRegistrations: registrations.sort((a, b) => a.id.localeCompare(b.id)),
    specificationFindings: (spec?.findings ?? []).slice(),
    conflicts: conflicts.sort((a, b) => a.id.localeCompare(b.id)),
    unresolved: unresolved.sort((a, b) => a.id.localeCompare(b.id)),
    dimensionObservations: dimensionObservations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    metricSolutions: metricSolutions.sort((a, b) => (a.frameId < b.frameId ? -1 : a.frameId > b.frameId ? 1 : 0)),
    chainRelations,
    numericLattices: numericLattices.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    ...(recogniser && heard > 0 ? { recogniser: { id: recogniser.id, model: { name: recogniser.model.name, sha256: recogniser.model.sha256 }, runtime: recogniser.runtime, ...(recogniser.runtimeSha256 ? { runtimeSha256: recogniser.runtimeSha256 } : {}) } } : {}),
    dimensionTopology: dimensionTopology.sort((a, b) => (a.frameId < b.frameId ? -1 : a.frameId > b.frameId ? 1 : 0)),
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
  orientation?: { orientation: TextToken['orientation'] | null; dependsOnScale: boolean },
  anchorable?: (segment: SolvedChain['segments'][number]) => boolean,
  topology?: ChainAxisTopology,
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
        // What the reader saw, never the value it was turned into (005B; the schema always said so).
        rawText: segment.token?.text ?? segment.text ?? '',
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
          detail: segment.origin === 'CHAIN_CORRECTED' ? `the reader read "${segment.token?.text ?? ''}"; at the frame's scale "${segment.text}" fits the span` : association.why,
        },
        ...(segment.token && segment.text !== undefined && (segment.origin === 'CHAIN_CORRECTED' || orientation?.dependsOnScale)
          ? {
              derivation: {
                rawText: segment.token.text,
                orientation: segment.token.orientation,
                valueText: segment.text,
                substitutions: [...segment.text].filter((ch, i) => ch !== segment.token?.text[i]).length + Math.abs(segment.text.length - segment.token.text.length),
                dependsOnScale: true,
                why:
                  segment.origin === 'CHAIN_CORRECTED'
                    ? 'a substitution chosen because it fits the scale the frame was solved at: a value downstream of that scale, never a witness for it'
                    : 'read the way up the other axis’s scale chose: not a witness of the two axes agreeing',
              },
            }
          : {}),
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
        ...(segment.token ? { labelled: true as const } : {}),
      })
      // Only a segment whose number was actually READ anchors a registration.
      // A derived segment is the scale restated, and fitting a scale to its own
      // output is how a registration comes to report a residual of zero while
      // being wrong.
      if (segment.origin !== 'DERIVED' && segment.confidence > 0) fittedCount += 1
      if (segment.origin !== 'DERIVED' && segment.confidence > 0 && (anchorable?.(segment) ?? true)) {
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
      segments.push({ index: segment.index, fromPx: segment.fromPx, toPx: segment.toPx, pixelLength: segment.pixelLength, confidence: 0, ...(segment.token ? { labelled: true as const } : {}) })
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
    ...(chain.ticks.some((t) => t.class !== undefined) ? { marks: chain.ticks.map((t) => ({ atPx: t.atPx, class: t.class ?? 'TICK', reasons: [...(t.reasons ?? [])].sort() })) } : {}),
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
    ...(topology ? { topology: { groupId: topology.groupId, roles: [...topology.roles], alignedEnds: [topology.alignedEnds[0], topology.alignedEnds[1]] as [boolean, boolean] } } : {}),
  }
}

/**
 * 005I: a frame's dimension lines as chains — the one path `extractMetricEvidence` takes, exported so the synthetic
 * corpus runs exactly it. A crossing mark that is only the ink of printed labels beside its line is no measurement
 * point (`markLabelInk`): it stays on the record (`rawChains`, with its class and `TEXT_INK`), and the solvers read the
 * chains without it (`measured`, index for index). A line whose every mark was label ink measures nothing and is no
 * chain (`labelInkLines`). `allChains` is every line as found: what the numeric lattices are read against, so the
 * labels read are the ones 005H read.
 */
export function dimensionChainsOf(lines: readonly DimensionLine[], tokens: readonly TextToken[], mask: Mask, observations: readonly SourceObservation[] = []): { allChains: RawChain[]; rawChains: RawChain[]; measured: RawChain[]; labelInkLines: RawChain[] } {
  const allChains = chainsFromLines(markLabelInk(lines, labelInkOf(tokens), mask), observations)
  const kept = allChains.map((c, i) => ({ c, i, m: measurementChain(c) })).filter((x) => x.m.ticks.length >= 2)
  const keptIndex = new Set(kept.map((x) => x.i))
  return { allChains, rawChains: kept.map((x) => x.c), measured: kept.map((x) => x.m), labelInkLines: allChains.filter((_, i) => !keptIndex.has(i)) }
}

/**
 * 005I: the ink of every printed label on a sheet — tokens of two to six glyphs (the labels the numeric lattice would
 * read), every way up — as boxes, with the axis their text runs along. What `markLabelInk` traces a crossing mark's ink
 * to. A label is a numeral: at least two of its glyphs are digits and at most one is not (post-review: a reader that
 * forms tokens out of linework — `±+-+`, `0/5/` — made a real tick's stroke "label ink"). Whether a glyph is a digit is
 * all that is asked of what was read; no value, reading or lattice is used.
 */
function labelInkOf(tokens: readonly TextToken[]): LabelInk[] {
  const numeral = (t: TextToken): boolean => {
    const digits = t.glyphs.filter((g) => g.char >= '0' && g.char <= '9').length
    return digits >= 2 && t.glyphs.length - digits <= 1
  }
  return tokens.filter((t) => t.glyphs.length >= 2 && t.glyphs.length <= LATTICE_LABEL_GLYPHS && numeral(t)).map((t) => ({ box: t.box, glyphs: t.glyphs.map((g) => g.box), axis: textAxisOf(t.orientation) }))
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

/** 005E: labels longer than this many glyphs are no dimension (the grammar takes 2–4 digits, or a decimal). */
const LATTICE_LABEL_GLYPHS = 6

/**
 * 005E: the numeric lattice of every ink that lies on a dimension line — the geometric test the label assignment
 * makes, before any scale — re-read from the very ink field its pass read (`readNumbers` with `retainPasses`).
 * Image only: nothing here knows a scale, a span's length or another label's value. In the reader's token order.
 */
export function dimensionLabelLattices(
  read: Pick<OcrResult, 'raw' | 'passes'>,
  chains: readonly RawChain[],
  page: { width: number; height: number },
  options: { cache?: LatticeCache; onLabel?: (label: number, labelsTotal: number) => void } = {},
): Map<TextToken, LabelLattice> {
  const out = new Map<TextToken, LabelLattice>()
  if (!read.passes || !read.raw) return out
  const onLine = read.raw.filter((t) => t.glyphs.length >= 2 && t.glyphs.length <= LATTICE_LABEL_GLYPHS && t.passBox && chains.some((chain) => onDimensionLine(chain, t)))
  // 005F: the plan's dimension-font style, from every raw token of the plan (image only), once; each label sees it at its own cap.
  const style = onLine.length > 0 ? dimensionStyleOf(read) : { samples: [] }
  for (const [i, token] of onLine.entries()) {
    options.onLabel?.(i + 1, onLine.length)
    const ink = read.passes[token.orientation]
    if (!ink) continue
    const lattice = labelLattice({ orientation: token.orientation, ink, page }, token, options.cache, styleFor(style, token.height))
    if (lattice) out.set(token, lattice)
  }
  return out
}

/** An ink lies on a dimension line: set along it, within its span, within a couple of its own heights of the line (`assignTokens`' test). */
function onDimensionLine(chain: RawChain, t: TextToken): boolean {
  if (textAxisOf(t.orientation) !== chain.axis) return false
  const cx = (t.box.x0 + t.box.x1) / 2
  const cy = (t.box.y0 + t.box.y1) / 2
  const along = chain.axis === 'HORIZONTAL' ? cx : cy
  const across = chain.axis === 'HORIZONTAL' ? cy : cx
  return Math.abs(across - chain.baselinePx) / Math.max(1, t.height) <= 2.2 && along >= chain.ticks[0].atPx && along <= chain.ticks[chain.ticks.length - 1].atPx
}

/** The evidence record of one lattice: numbers only, bounded by the lattice's own bounds. */
function latticeRecord(id: string, frameId: string, token: TextToken, l: LabelLattice): NumericLatticeRecord {
  const asReadPath = l.paths.find((p) => p.kind === 'ANCHOR' && p.variant === l.asReadVariant) ?? l.paths[0]
  return {
    id,
    frameId,
    orientation: token.orientation,
    box: token.box,
    reader: l.reader,
    rawTopText: l.rawTopText,
    asRead: l.asRead,
    ...(l.asReadValueCm !== undefined ? { asReadValueCm: l.asReadValueCm } : {}),
    asReadVariant: l.asReadVariant,
    ocrClass: l.ocrClass,
    classWhy: l.classWhy,
    asReadP: l.asReadP,
    probabilityMargin: l.probabilityMargin,
    sequenceMargin: l.sequenceMargin,
    minGlyphScore: l.minGlyphScore,
    maxRunnerRatio: l.maxRunnerRatio,
    entropy: l.entropy,
    capHeightPx: l.capHeightPx,
    sequences: l.sequences.map((q) => ({ text: q.text, ...(q.valueCm !== undefined ? { valueCm: q.valueCm } : {}), logP: q.logP, p: q.p, imageScore: q.imageScore, nonTop: q.nonTop, minGlyphMargin: q.minGlyphMargin, avgGlyphMargin: q.avgGlyphMargin, variants: q.variants, pathIds: q.pathIds, asRead: q.asRead })),
    glyphs: asReadPath.glyphs.map((g, i) => ({ box: l.glyphBoxes[i] ?? token.box, candidates: g.candidates, runnerRatio: g.runnerRatio, topologyRunnerRatio: g.topologyRunnerRatio, holes: g.holes, touching: g.touching, broken: g.broken })),
    paths: l.paths.map((p) => ({ id: p.id, variant: p.variant, kind: p.kind, text: p.glyphs.map((g) => g.candidates[0]?.char ?? '').join('') || '?', slope: p.slope, cuts: p.cuts, changedBoundaries: p.changedBoundaries, segScore: p.segScore, ratioToBest: p.ratioToBest })),
    expansions: l.expansions,
    truncatedBy: l.truncatedBy,
    mergedCount: l.mergedCount,
    emittedMass: l.emittedMass,
    asReadStability: l.asReadStability,
    countAmbiguity: l.countAmbiguity,
    tail: l.tail,
    segmentation: l.segmentation,
    cache: l.cache,
    ...(l.external ? { external: externalRecord(l.external) } : {}),
    ...(l.ensemble ? { ensemble: l.ensemble } : {}),
  }
}

/** 005H: the external reading as recorded — its key is the lattice's id, so it is not repeated. */
const externalRecord = (x: ExternalReading): NonNullable<NumericLatticeRecord['external']> => ({ engine: x.engine, modelSha256: x.modelSha256, runtime: x.runtime, topK: x.topK.map((c) => ({ text: c.text, p: c.p })), greedy: { text: x.greedy.text, meanP: x.greedy.meanP }, stable: x.stable, variants: x.variants.map((v) => ({ variant: v.variant, top: v.top, p: v.p })) })
