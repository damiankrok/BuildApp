/**
 * Source-addressable evidence records of the boundary's open questions (BUILDPLAN-ANALYZER-005K).
 *
 * A gap the boundary classified WEAK is a question its own drawing did not settle: a doorway or the mouth of a recess,
 * glazing or a paving edge, a face line or a slab edge. Each one is recorded here with enough to replay its decision
 * without a picture: where it is (the wall line, the wall's axis and the jamb that gave it, both ends in the frame's
 * pixels), how wide (in pixels and in metres at the decomposition's scale), what is drawn across it (the strokes, the
 * signature before and after the pattern and runs-past rules, the width rule), how much wall-thick ink stands at its
 * jambs and lies in its wall band, the crop of the frame around it — as a rectangle and the hash of the ink mask
 * inside it, never the pixels — what the classification, a callout or a shut garage mouth made of it, and what the
 * outline did with it.
 *
 * The bare gap id (`gap-<axis>-<line>-<from>-<to>`) names a gap within one decomposition only: the same id recurs on
 * another copy of the plan, at another scale, under another reading. A record is therefore always read with its
 * decomposition id (a hash of the reading's frame geometry and scale) and, in the digest and the Evidence Pack, the
 * frame and copy it was read on.
 *
 * Observational: nothing here is read by a decision. Every value comes from the drawing, the wall line and the
 * decomposition's own scale — never a published figure, an area, a refusal or an outcome.
 */
import { round6, sha256Bytes, sha256Hex, stableJson } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Mask } from '@buildapp/source-cv'
import type { BoundaryGap, BoundaryStrength, DrawnGapCheck, GapClass, GapReason, GapTrace, WallLine } from './boundary-evidence.js'
import type { OutlineResult } from './boundary-outline.js'

/** At most this many records per decomposition; the rest are counted (`gapEvidenceOmitted`). */
export const MAX_GAP_RECORDS = 400

/** What the outline did with a gap. */
export type GapOutlineFate = 'BRIDGED_STRONG' | 'BRIDGED_WEAK' | 'POCKET_MOUTH' | 'NOT_REACHED' | 'NOT_ON_OUTLINE'

export type GapEvidenceRecord = {
  gapId: string
  decompositionId: string
  /** X: a vertical wall line (x fixed) running along y; Y: a horizontal one. */
  axis: 'X' | 'Y'
  linePx: number
  axisPx: number
  axisFrom: GapTrace['axisFrom']
  fromPx: number
  toPx: number
  /** Both ends of the gap on the wall's axis, in the frame's pixels. */
  start: { x: number; y: number }
  end: { x: number; y: number }
  widthPx: number
  widthM: number
  /** Metres per pixel along the line, at this decomposition's scale. */
  mppAlong: number
  wallPx: number
  jambs: BoundaryGap['jambs']
  jambAlong: [boolean, boolean]
  jambInk: [number, number]
  bandInk: number
  /** The frame's pixels around the gap, at least 1.5 m (and four walls) past it on every side, clipped to the frame. */
  crop: PixelRect
  /** SHA-256 of the binarised ink mask inside `crop` (row-major, one bit a pixel, rows padded to a byte, after a `w×h` header). */
  inkCropSha256: string
  strokes: { count: number; inWall: number; continuous: number; runsPast: number; maxCoverage: number; offsetsPx: number[] }
  signature: BoundaryGap['signature']
  signatureRaw: BoundaryGap['signature']
  signatureLoose: BoundaryGap['signature']
  patternAcross: boolean
  runsPast: boolean
  widthRule: GapTrace['widthRule']
  classified: { cls: GapClass; boundary: BoundaryStrength }
  final: { cls: GapClass; boundary: BoundaryStrength; occupancy: BoundaryGap['occupancy'] }
  callout: { widthCm: number; confidence: number } | null
  outline: GapOutlineFate
  drawnGapRule: { mode: 'OFF' | 'ON'; check: DrawnGapCheck | null; upgraded: boolean }
  reasons: GapReason[]
}

/** A decomposition's identity: the frame geometry and scale it was read at (and whether pocket mouths were shut). */
export function decompositionIdOf(input: { extent: PixelRect; mppX: number; mppY: number; wallPx: number; linesX: readonly number[]; linesY: readonly number[]; shutPocketMouths: boolean }): string {
  return `dec-${sha256Hex(stableJson({ extent: input.extent, mppX: input.mppX, mppY: input.mppY, wallPx: input.wallPx, linesX: input.linesX, linesY: input.linesY, shutPocketMouths: input.shutPocketMouths }, 0)).slice(0, 16)}`
}

/** The crop around a gap, clipped to the frame: at least 1.5 m and four walls past the gap on every side. */
export function gapCrop(gap: Pick<BoundaryGap, 'axis' | 'fromPx' | 'toPx'>, axisPx: number, mppAlong: number, mppAcross: number, wallPx: number, width: number, height: number): PixelRect {
  const marginAlong = Math.ceil(Math.max(1.5 / Math.max(mppAlong, 1e-9), wallPx * 4))
  const marginAcross = Math.ceil(Math.max(1.5 / Math.max(mppAcross, 1e-9), wallPx * 4))
  const a0 = Math.floor(gap.fromPx) - marginAlong
  const a1 = Math.ceil(gap.toPx) + marginAlong
  const c0 = Math.floor(axisPx) - marginAcross
  const c1 = Math.ceil(axisPx) + marginAcross
  const [x0, x1, y0, y1] = gap.axis === 'X' ? [c0, c1, a0, a1] : [a0, a1, c0, c1]
  return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(width - 1, x1), y1: Math.min(height - 1, y1) }
}

/** SHA-256 of the ink mask inside a rectangle (inclusive), one bit a pixel, after a `w×h` header. */
export function inkCropHash(mask: Mask, r: PixelRect): string {
  const w = Math.max(0, r.x1 - r.x0 + 1)
  const h = Math.max(0, r.y1 - r.y0 + 1)
  const header = new TextEncoder().encode(`${w}x${h}\n`)
  const stride = Math.ceil(w / 8)
  const bytes = new Uint8Array(header.length + stride * h)
  bytes.set(header, 0)
  for (let y = 0; y < h; y += 1) {
    const row = (r.y0 + y) * mask.width
    for (let x = 0; x < w; x += 1) if (mask.data[row + r.x0 + x] === 1) bytes[header.length + y * stride + (x >> 3)] |= 0x80 >> (x & 7)
  }
  return sha256Bytes(bytes)
}

/**
 * One record per gap the classification or a later decision left WEAK, and per gap the drawn-gap rule upgraded, in a
 * canonical order (axis, line, start, end, id): the same drawing gives the same records whatever order its lines,
 * gaps or callouts were read in.
 */
export function gapEvidenceRecords(input: {
  mask: Mask
  wallsX: readonly WallLine[]
  wallsY: readonly WallLine[]
  mppX: number
  mppY: number
  wallPx: number
  decompositionId: string
  outline: OutlineResult
  drawnGapRule: 'OFF' | 'ON'
}): { records: GapEvidenceRecord[]; omitted: number } {
  const { mask, mppX, mppY, wallPx, decompositionId, outline } = input
  const strong = new Set(outline.bridged.strong.map((g) => g.id))
  const weak = new Set(outline.bridged.weak.map((b) => b.gap.id))
  const mouths = new Set(outline.pocketMouths.map((b) => b.gap.id))
  // the gaps the outline's flood could reach: those on an edge it judged or bridged; a WEAK gap it never judged is interior
  const fate = (g: BoundaryGap): GapOutlineFate =>
    strong.has(g.id) ? 'BRIDGED_STRONG' : weak.has(g.id) ? 'BRIDGED_WEAK' : mouths.has(g.id) ? 'POCKET_MOUTH' : g.boundary === 'WEAK' ? 'NOT_REACHED' : 'NOT_ON_OUTLINE'
  const all: GapEvidenceRecord[] = []
  for (const line of [...input.wallsX, ...input.wallsY]) {
    for (const g of line.gaps) {
      const trace = g.trace
      if (!trace) continue
      const upgraded = trace.reasons.includes('DRAWN_GAP_UPGRADE')
      if (trace.classified.boundary !== 'WEAK' && g.boundary !== 'WEAK' && !upgraded) continue
      const mppAlong = g.axis === 'X' ? mppY : mppX
      const mppAcross = g.axis === 'X' ? mppX : mppY
      const at = (s: number): { x: number; y: number } => (g.axis === 'X' ? { x: trace.axisPx, y: round6(s) } : { x: round6(s), y: trace.axisPx })
      const crop = gapCrop(g, trace.axisPx, mppAlong, mppAcross, wallPx, mask.width, mask.height)
      all.push({
        gapId: g.id,
        decompositionId,
        axis: g.axis,
        linePx: g.linePx,
        axisPx: trace.axisPx,
        axisFrom: trace.axisFrom,
        fromPx: g.fromPx,
        toPx: g.toPx,
        start: at(g.fromPx),
        end: at(g.toPx),
        widthPx: round6(g.toPx - g.fromPx),
        widthM: g.widthM,
        mppAlong: round6(mppAlong),
        wallPx: round6(wallPx),
        jambs: g.jambs,
        jambAlong: trace.jambAlong,
        jambInk: trace.jambInk,
        bandInk: trace.bandInk,
        crop,
        inkCropSha256: inkCropHash(mask, crop),
        strokes: {
          count: g.strokes.length,
          inWall: g.strokes.filter((k) => k.inWall).length,
          continuous: g.strokes.filter((k) => k.continuous).length,
          runsPast: g.strokes.filter((k) => k.runsPast).length,
          maxCoverage: round6(Math.max(0, ...g.strokes.map((k) => k.coverage))),
          offsetsPx: g.strokes.map((k) => k.offsetPx).slice(0, 12),
        },
        signature: g.signature,
        signatureRaw: trace.signatureRaw,
        signatureLoose: trace.signatureLoose,
        patternAcross: trace.patternAcross,
        runsPast: trace.runsPast,
        widthRule: trace.widthRule,
        classified: trace.classified,
        final: { cls: g.cls, boundary: g.boundary, occupancy: g.occupancy },
        callout: g.callout ? { widthCm: g.callout.widthCm, confidence: g.callout.confidence } : null,
        outline: fate(g),
        drawnGapRule: { mode: input.drawnGapRule, check: trace.drawnGapRule ?? null, upgraded },
        reasons: trace.reasons,
      })
    }
  }
  all.sort((p, q) => (p.axis < q.axis ? -1 : p.axis > q.axis ? 1 : 0) || p.linePx - q.linePx || p.fromPx - q.fromPx || p.toPx - q.toPx || (p.gapId < q.gapId ? -1 : p.gapId > q.gapId ? 1 : 0))
  return { records: all.slice(0, MAX_GAP_RECORDS), omitted: Math.max(0, all.length - MAX_GAP_RECORDS) }
}
