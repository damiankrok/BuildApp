/**
 * Tying a drawing's pixels to metres.
 *
 * The map is deliberately the simplest one that can be true: a scale for each
 * pixel axis, a sign for each, and an origin. No rotation, no perspective, no
 * camera. A published orthographic sheet is axis-aligned by construction — the
 * draughtsman drew it that way and the publisher exported it that way — so the
 * degrees of freedom a camera model would add have nothing in the data to
 * constrain them, and fitting them means fitting noise and calling it a
 * calibration.
 *
 * Where each number comes from:
 *
 * - A PLAN is registered from its dimension chains. Every chain segment whose
 *   number the chain solver endorsed is an anchor: so many pixels, so many
 *   centimetres. The two axes are fitted separately, so a sheet that was
 *   cropped or resized unevenly states its anisotropy instead of hiding it in
 *   everybody's residuals.
 * - A SECTION is registered from its level datums. Two printed levels at two
 *   heights give the vertical scale directly, and they give it in the one
 *   place a section is authoritative: heights above the drawing's zero.
 * - An ELEVATION usually states neither, and this layer says so rather than
 *   inventing one. Registering it needs a fact from another view — that this
 *   elevation shows a side whose length the plan gives — and that is a claim
 *   about the BUILDING, which is the solver's business and not the reader's.
 *
 * Outliers are reported, never absorbed. An anchor that disagrees with the fit
 * by more than the tolerance is listed in `rejected` with its residual, so a
 * reader can see what the registration chose not to believe.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelPoint } from '@buildapp/source-common'
import type { CoordinateRegistration, MetricEvidence, RegistrationAnchor, RegistrationPlane } from './schema.js'

/** One statement of the form "this many pixels is that many metres, along this axis". */
export type ScaleAnchorInput = {
  id: string
  kind: RegistrationAnchor['kind']
  evidenceIds: string[]
  axis: 'X' | 'Y'
  pixelSpan: number
  metricSpan: number
  /** How much to trust it, 0..1. */
  weight: number
}

export type RegistrationInput = {
  frameId: string
  assetId: string
  variantByteHash: string
  plane: RegistrationPlane
  anchors: readonly ScaleAnchorInput[]
  /** The pixel that maps to the metric origin, and which way each axis runs. */
  originPx: PixelPoint
  flipX: boolean
  flipY: boolean
  /** How far an anchor may miss the fit before it is called an outlier, in pixels. */
  tolerancePx?: number
  detail: string
  note?: string
}

/**
 * A weighted least-squares scale for one axis, with one round of outlier
 * rejection.
 *
 * The estimator is `metres = s * pixels` through the origin, because a
 * dimension of zero pixels is a dimension of zero metres and an intercept
 * would be free to absorb a systematic error that belongs in the residuals.
 * Weighting by span as well as by confidence follows from where the error is:
 * the ends of a span are located to about a pixel however long it is, so a long
 * span states the scale proportionally more precisely than a short one.
 */
function fitAxis(anchors: readonly ScaleAnchorInput[], tolerancePx: number): { scale?: number; kept: ScaleAnchorInput[]; rejected: Array<{ anchor: ScaleAnchorInput; residualM: number }> } {
  const usable = anchors.filter((a) => a.pixelSpan > 0 && Number.isFinite(a.metricSpan) && a.metricSpan > 0)
  if (usable.length === 0) return { kept: [], rejected: [] }
  const fit = (list: readonly ScaleAnchorInput[]): number | undefined => {
    let num = 0
    let den = 0
    for (const a of list) {
      const w = a.weight * a.pixelSpan
      num += w * a.metricSpan * a.pixelSpan
      den += w * a.pixelSpan * a.pixelSpan
    }
    return den > 0 ? num / den : undefined
  }
  const inliers = (scale: number): ScaleAnchorInput[] => usable.filter((a) => Math.abs(a.metricSpan / scale - a.pixelSpan) <= tolerancePx)

  // Seed from each anchor in turn and keep the largest set that agrees with it.
  //
  // Fitting everything first and rejecting the outliers afterwards is the
  // obvious procedure and it fails exactly when it matters: one badly misread
  // level datum drags the least-squares scale far enough that EVERY anchor
  // misses the tolerance, and the frame ends up with no registration at all
  // rather than the one four of its five anchors agree on. Starting from each
  // anchor's own ratio costs nothing at these sizes and cannot be dragged.
  let best: { scale: number; kept: ScaleAnchorInput[]; weight: number } | undefined
  for (const seed of usable) {
    const scale = seed.metricSpan / seed.pixelSpan
    const kept = inliers(scale)
    const weight = kept.reduce((a, x) => a + x.weight * x.pixelSpan, 0)
    if (!best || kept.length > best.kept.length || (kept.length === best.kept.length && weight > best.weight)) best = { scale, kept, weight }
  }
  if (!best) return { kept: [], rejected: [] }
  let scale = best.scale
  let kept = best.kept
  for (let round = 0; round < 3; round += 1) {
    const refined = fit(kept)
    if (refined === undefined) break
    const next = inliers(refined)
    if (next.length === 0) break
    const settled = Math.abs(refined - scale) < 1e-12 && next.length === kept.length
    scale = refined
    kept = next
    if (settled) break
  }
  const keptIds = new Set(kept.map((a) => a.id))
  const rejected = usable.filter((a) => !keptIds.has(a.id)).map((a) => ({ anchor: a, residualM: round6(a.metricSpan - scale * a.pixelSpan) }))
  return { scale, kept, rejected }
}

/** Build a frame's registration from its anchors, reporting what it fitted and what it refused. */
export function registerFrame(input: RegistrationInput): CoordinateRegistration | undefined {
  const tolerancePx = input.tolerancePx ?? 3
  const x = fitAxis(
    input.anchors.filter((a) => a.axis === 'X'),
    tolerancePx,
  )
  const y = fitAxis(
    input.anchors.filter((a) => a.axis === 'Y'),
    tolerancePx,
  )
  // A frame with only one axis measured is still registered, on the standing
  // assumption that a published sheet's pixels are square. The assumption is
  // recorded in `anisotropy` (exactly 1) and in the note, so a reader can tell
  // a measured isotropy from an assumed one.
  const metresPerPixelX = x.scale ?? y.scale
  const metresPerPixelY = y.scale ?? x.scale
  if (metresPerPixelX === undefined || metresPerPixelY === undefined) return undefined
  if (!(metresPerPixelX > 0) || !(metresPerPixelY > 0)) return undefined

  const anchors: RegistrationAnchor[] = []
  let sumSquareM = 0
  let sumSquarePx = 0
  let maxM = 0
  for (const a of [...x.kept, ...y.kept]) {
    const scale = a.axis === 'X' ? metresPerPixelX : metresPerPixelY
    const residualM = round6(a.metricSpan - scale * a.pixelSpan)
    sumSquareM += residualM * residualM
    sumSquarePx += (residualM / scale) ** 2
    maxM = Math.max(maxM, Math.abs(residualM))
    anchors.push({ id: a.id, kind: a.kind, evidenceIds: a.evidenceIds, axis: a.axis, pixelSpan: round6(a.pixelSpan), metricSpan: round6(a.metricSpan), residualM, weight: round6(a.weight) })
  }
  const n = Math.max(1, anchors.length)
  const measuredBothAxes = x.scale !== undefined && y.scale !== undefined
  const anisotropy = round6(Math.max(metresPerPixelX, metresPerPixelY) / Math.min(metresPerPixelX, metresPerPixelY))
  const rejected = [...x.rejected, ...y.rejected].map((r) => ({
    id: r.anchor.id,
    evidenceIds: r.anchor.evidenceIds,
    why: `misses the fitted scale by ${round6(Math.abs(r.residualM))} m, beyond the ${tolerancePx} px tolerance`,
    residualM: r.residualM,
  }))

  // A registration is as trustworthy as the number and spread of the anchors
  // that survived, and no more.
  const confidence = round6(Math.max(0.05, Math.min(0.95, (measuredBothAxes ? 0.5 : 0.35) + 0.08 * Math.min(5, anchors.length) - Math.min(0.3, Math.sqrt(sumSquareM / n) * 2))))

  return {
    id: stableId('registration', input.plane.toLowerCase(), { frameId: input.frameId, plane: input.plane, anchors: anchors.map((a) => [a.id, a.pixelSpan, a.metricSpan]) }),
    frameId: input.frameId,
    assetId: input.assetId,
    variantByteHash: input.variantByteHash,
    plane: input.plane,
    metresPerPixelX: round6(metresPerPixelX),
    metresPerPixelY: round6(metresPerPixelY),
    anisotropy,
    originPx: { x: round6(input.originPx.x), y: round6(input.originPx.y) },
    flipX: input.flipX,
    flipY: input.flipY,
    anchors: anchors.sort((a, b) => a.id.localeCompare(b.id)),
    rejected: rejected.sort((a, b) => a.id.localeCompare(b.id)),
    residual: { rmsM: round6(Math.sqrt(sumSquareM / n)), maxM: round6(maxM), rmsPx: round6(Math.sqrt(sumSquarePx / n)) },
    confidence,
    provenance: { extractor: 'REGISTRATION', name: 'metrics.axis-aligned-affine@1', detail: input.detail },
    note: measuredBothAxes ? input.note : [input.note, 'only one pixel axis was measured; the other is assumed equal (square pixels)'].filter(Boolean).join('; '),
  }
}

/** Where a pixel lands in the frame's metric plane. Never 3D: a plan gives (x, z), an elevation or section (horizontal, y). */
export function toMetric(registration: CoordinateRegistration, p: PixelPoint): { u: number; v: number } {
  const du = (p.x - registration.originPx.x) * registration.metresPerPixelX
  const dv = (p.y - registration.originPx.y) * registration.metresPerPixelY
  return { u: round6(registration.flipX ? -du : du), v: round6(registration.flipY ? -dv : dv) }
}

/** The inverse, for drawing a solved model back over its own source. */
export function toPixels(registration: CoordinateRegistration, m: { u: number; v: number }): PixelPoint {
  const du = (registration.flipX ? -m.u : m.u) / registration.metresPerPixelX
  const dv = (registration.flipY ? -m.v : m.v) / registration.metresPerPixelY
  return { x: round6(registration.originPx.x + du), y: round6(registration.originPx.y + dv) }
}

/** A length in the frame's pixels, in metres, along whichever axis it mostly runs. */
export function metricLength(registration: CoordinateRegistration, a: PixelPoint, b: PixelPoint): number {
  const dx = (b.x - a.x) * registration.metresPerPixelX
  const dy = (b.y - a.y) * registration.metresPerPixelY
  return round6(Math.hypot(dx, dy))
}

/** Level datums, in the order the drawing stacks them, with the pixel row each sits on. */
export type LevelPair = { lower: MetricEvidence; upper: MetricEvidence; metresApart: number; pixelsApart: number }

/**
 * Pair up the level datums on a section so each pair states the vertical scale.
 *
 * Only pairs that are far apart in BOTH metres and pixels are worth anything: a
 * finished floor and a structural floor thirty millimetres apart state the
 * scale to no precision at all, and including them would let a two-pixel
 * misplacement dominate the fit.
 */
export function levelPairs(datums: readonly MetricEvidence[], options: { minMetres?: number; minPixels?: number } = {}): LevelPair[] {
  const minMetres = options.minMetres ?? 0.8
  const minPixels = options.minPixels ?? 20
  const withRow = datums
    .filter((d) => d.kind === 'LEVEL_DATUM' && d.measuredGeometry?.type === 'SEGMENT')
    .map((d) => ({ evidence: d, row: d.measuredGeometry?.type === 'SEGMENT' ? (d.measuredGeometry.a.y + d.measuredGeometry.b.y) / 2 : 0 }))
    .sort((a, b) => a.evidence.value - b.evidence.value)
  const pairs: LevelPair[] = []
  for (let i = 0; i < withRow.length; i += 1) {
    for (let j = i + 1; j < withRow.length; j += 1) {
      const metresApart = withRow[j].evidence.value - withRow[i].evidence.value
      const pixelsApart = withRow[i].row - withRow[j].row
      if (metresApart < minMetres) continue
      if (pixelsApart < minPixels) continue
      pairs.push({ lower: withRow[i].evidence, upper: withRow[j].evidence, metresApart: round6(metresApart), pixelsApart: round6(pixelsApart) })
    }
  }
  return pairs
}

// ---------------------------------------------------------------------------
// the ladder of level datums
// ---------------------------------------------------------------------------

/** One height printed on a section, with the row it marks and every value it might be. */
export type DatumCandidate = {
  tokenId: string
  /** The pixel row of the rule the height is printed against. */
  rowPx: number
  readings: Array<{ value: number; rawText: string; confidence: number; substitutions: number }>
}

export type SolvedDatum = {
  tokenId: string
  rowPx: number
  value?: number
  rawText?: string
  origin: 'READ' | 'CHAIN_CORRECTED' | 'UNRESOLVED'
  confidence: number
  residualPx?: number
  rejected: Array<{ value: number; rawText: string; why: string }>
}

export type SolvedLadder = {
  /** Metres per pixel up the sheet. */
  metresPerPixel?: number
  /** The pixel row the heights are measured from. */
  zeroRowPx?: number
  datums: SolvedDatum[]
  residualPx: number
  fitted: number
}

/**
 * The heights on a section are a ladder, and a ladder can check itself.
 *
 * Every printed level states a height above the drawing's zero, and every one
 * of them is printed against a rule at a known row. So the pairs (row, height)
 * must fall on ONE straight line — the sheet's vertical scale — and a height
 * whose leading digit was misread falls off it by metres. That is the same
 * redundancy a dimension chain has, in the vertical, and it is exploited the
 * same way: fit the line from a pair, count how many other heights some
 * admissible reading puts on it, keep the best-supported line, and let it
 * choose a reading for each rung.
 *
 * `+3,06` misread as `+5,06` is not a subtle failure. It is two metres, and
 * it survives every check a single reading can be given — the characters are
 * clean, the association is good, the value is plausible. It does not survive
 * being asked to agree with the other three heights on the same sheet.
 */
export function solveLevelLadder(candidates: readonly DatumCandidate[], options: { tolerancePx?: number } = {}): SolvedLadder {
  const tolerance = options.tolerancePx ?? 6
  const datums: SolvedDatum[] = candidates.map((c) => ({ tokenId: c.tokenId, rowPx: c.rowPx, origin: 'UNRESOLVED', confidence: 0, rejected: [] }))
  if (candidates.length < 2) return { datums, residualPx: 0, fitted: 0 }

  type Line = { scale: number; zeroRow: number }
  /** How many rungs a line explains, and how well. */
  const support = (line: Line): { count: number; weight: number; picks: Map<number, { reading: DatumCandidate['readings'][number]; missPx: number }> } => {
    const picks = new Map<number, { reading: DatumCandidate['readings'][number]; missPx: number }>()
    let weight = 0
    candidates.forEach((c, i) => {
      let best: { reading: DatumCandidate['readings'][number]; missPx: number; merit: number } | undefined
      for (const reading of c.readings) {
        const expectedRow = line.zeroRow - reading.value / line.scale
        const missPx = Math.abs(expectedRow - c.rowPx)
        if (missPx > tolerance) continue
        const merit = reading.confidence * Math.max(0.02, 1 - missPx / tolerance) * 0.7 ** reading.substitutions
        if (!best || merit > best.merit) best = { reading, missPx, merit }
      }
      if (!best) return
      picks.set(i, { reading: best.reading, missPx: best.missPx })
      weight += best.merit
    })
    return { count: picks.size, weight, picks }
  }

  let best: { line: Line; count: number; weight: number; picks: Map<number, { reading: DatumCandidate['readings'][number]; missPx: number }> } | undefined
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = 0; j < candidates.length; j += 1) {
      if (i === j) continue
      const dRow = candidates[j].rowPx - candidates[i].rowPx
      if (Math.abs(dRow) < 20) continue
      for (const a of candidates[i].readings) {
        for (const b of candidates[j].readings) {
          const dValue = b.value - a.value
          if (Math.abs(dValue) < 0.5) continue
          // Rows grow downwards and heights grow upwards, so the scale is
          // positive only when the higher number sits on the higher row.
          const scale = -dValue / dRow
          if (!(scale > 0) || !Number.isFinite(scale)) continue
          const line: Line = { scale, zeroRow: candidates[i].rowPx + a.value / scale }
          const s = support(line)
          if (s.count < 2) continue
          if (!best || s.count > best.count || (s.count === best.count && s.weight > best.weight)) best = { line, ...s }
        }
      }
    }
  }
  if (!best) return { datums, residualPx: 0, fitted: 0 }

  // Refit the line by weighted least squares over the rungs it explains.
  let line = best.line
  for (let round = 0; round < 3; round += 1) {
    const s = support(line)
    if (s.count < 2) break
    let sw = 0
    let sx = 0
    let sy = 0
    let sxx = 0
    let sxy = 0
    for (const [i, pick] of s.picks) {
      const w = pick.reading.confidence
      const x = candidates[i].rowPx
      const y = pick.reading.value
      sw += w
      sx += w * x
      sy += w * y
      sxx += w * x * x
      sxy += w * x * y
    }
    const den = sw * sxx - sx * sx
    if (Math.abs(den) < 1e-9) break
    const slope = (sw * sxy - sx * sy) / den
    if (!(slope < 0)) break
    const intercept = (sy - slope * sx) / sw
    const next: Line = { scale: -slope, zeroRow: -intercept / slope }
    if (Math.abs(next.scale - line.scale) < 1e-12) {
      line = next
      break
    }
    line = next
  }

  const final = support(line)
  let sumSquare = 0
  candidates.forEach((c, i) => {
    const pick = final.picks.get(i)
    for (const reading of c.readings) {
      if (pick && reading.rawText === pick.reading.rawText) continue
      const expectedRow = line.zeroRow - reading.value / line.scale
      datums[i].rejected.push({
        value: reading.value,
        rawText: reading.rawText,
        why: Math.abs(expectedRow - c.rowPx) > tolerance ? `would put this rule ${round6(Math.abs(expectedRow - c.rowPx))} px from where it is drawn` : 'a weaker reading of the same characters',
      })
    }
    if (!pick) return
    datums[i].value = pick.reading.value
    datums[i].rawText = pick.reading.rawText
    datums[i].origin = pick.reading.substitutions === 0 ? 'READ' : 'CHAIN_CORRECTED'
    datums[i].residualPx = round6(pick.missPx)
    datums[i].confidence = round6(Math.min(1, pick.reading.confidence * 0.85 ** pick.reading.substitutions * Math.max(0.3, 1 - pick.missPx / tolerance / 2)))
    sumSquare += pick.missPx ** 2
  })
  return { metresPerPixel: round6(line.scale), zeroRowPx: round6(line.zeroRow), datums, residualPx: final.count > 0 ? round6(Math.sqrt(sumSquare / final.count)) : 0, fitted: final.count }
}
