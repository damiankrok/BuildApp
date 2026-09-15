/**
 * Fusing raw source candidates into a small set of hypotheses.
 *
 * The problem this solves, stated concretely: a deterministic CV pass over
 * four elevations finds 138 thick linear bands. Most of them are the same
 * member seen at three resolutions, or one member found twice by two
 * detectors, or one long member found as four pieces because a downpipe
 * crossed it, or a shadow, or a hatch. A reconstruction that turns 138 bands
 * into 138 beams has not reconstructed anything — it has transcribed its own
 * detector's noise into three dimensions and called the result a building.
 *
 * Five reductions, in order, each with a stated reason:
 *
 *  1. **Duplicate suppression.** Two candidates on the same frame whose boxes
 *     overlap heavily are one candidate. The better-supported one absorbs the
 *     other and keeps both traces.
 *  2. **Clustering.** Candidates on DIFFERENT renderings of the same drawing
 *     are the same feature: they are compared in normalized coordinates, which
 *     is the whole reason the observation graph carries them.
 *  3. **Continuity merging.** Two collinear candidates with a small gap
 *     between them are one member interrupted, not two members — provided the
 *     gap is small against their own length, because two genuinely separate
 *     fins are also collinear.
 *  4. **Source-role weighting.** An orthographic elevation is authoritative
 *     about position and extent; a perspective render is authoritative about
 *     DEPTH and about nothing else. Weighting by what a view can actually see
 *     is what keeps a render's foreshortened band from setting a length.
 *  5. **Cross-view corroboration.** A member seen in two views that agree is
 *     worth much more than one seen once. This is where the count finally
 *     collapses: a facade frame appears on the front elevation and in two
 *     renders, and those three sightings become one hypothesis with three
 *     traces rather than three hypotheses.
 *
 * Everything dropped is counted and the reason is kept, so the fusion ratio is
 * a reported number rather than a claim.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { rectIoU } from '@buildapp/source-common'

/** A raw candidate, before anything has been decided about it. */
export type RawCandidate<T = unknown> = {
  id: string
  frameId: string
  /** Which asset this frame renders, so two resolutions of one drawing can be recognised as one. */
  assetKey: string
  /** In the frame's own pixels. */
  box: PixelRect
  /** In the frame's normalized coordinates, so two resolutions are comparable. */
  norm: { x0: number; y0: number; x1: number; y1: number }
  /** Along the feature: a horizontal band and a vertical fin are different things. */
  orientation: 'HORIZONTAL' | 'VERTICAL' | 'OTHER'
  confidence: number
  depthLayer: 'FRONT' | 'PROUD_OF_WALL' | 'HOST_PLANE' | 'RECESSED' | 'BACK' | 'UNKNOWN'
  /** What kind of view this is, which decides what it is allowed to be authoritative about. */
  viewRole: 'ORTHOGRAPHIC_ELEVATION' | 'ORTHOGRAPHIC_PLAN' | 'ORTHOGRAPHIC_SECTION' | 'PERSPECTIVE' | 'UNKNOWN'
  observationIds: string[]
  payload?: T
}

export type FusedCandidate<T = unknown> = {
  id: string
  members: Array<RawCandidate<T>>
  /** The representative box, from the highest-authority sighting. */
  box: PixelRect
  norm: { x0: number; y0: number; x1: number; y1: number }
  orientation: RawCandidate['orientation']
  /** How many DISTINCT drawings back it, not how many sightings. */
  viewSupport: number
  /** What the views collectively say about depth, and how strongly. */
  depthLayer: RawCandidate['depthLayer']
  depthSupport: number
  confidence: number
  observationIds: string[]
  trace: string[]
}

export type FusionCounts = {
  rawCandidates: number
  afterDuplicateSuppression: number
  afterClustering: number
  afterContinuityMerge: number
  accepted: number
  rejected: Array<{ why: string; count: number }>
}

/**
 * What a view is entitled to be believed about.
 *
 * A technical elevation is drawn orthographically, so a band's position and
 * length on it are measurements. A perspective render foreshortens everything,
 * so its extents are worthless — but it is the ONLY view that shows whether
 * something stands proud of the wall, which no elevation can. Weighting each
 * view by what it can actually see is the difference between using a render
 * and being misled by one.
 */
const EXTENT_AUTHORITY: Record<RawCandidate['viewRole'], number> = {
  ORTHOGRAPHIC_ELEVATION: 1,
  ORTHOGRAPHIC_PLAN: 0.9,
  ORTHOGRAPHIC_SECTION: 0.9,
  PERSPECTIVE: 0.15,
  UNKNOWN: 0.3,
}

const DEPTH_AUTHORITY: Record<RawCandidate['viewRole'], number> = {
  ORTHOGRAPHIC_ELEVATION: 0.2,
  ORTHOGRAPHIC_PLAN: 0.8,
  ORTHOGRAPHIC_SECTION: 0.8,
  PERSPECTIVE: 1,
  UNKNOWN: 0.2,
}

/** How much of the smaller box lies inside the larger. */
function containment(a: PixelRect, b: PixelRect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  if (w <= 0 || h <= 0) return 0
  const areaA = Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0))
  const areaB = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0))
  return (w * h) / Math.min(areaA, areaB)
}

const normIoU = (a: FusedCandidate['norm'], b: FusedCandidate['norm']): number =>
  rectIoU({ x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1 }, { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })

const normLength = (n: FusedCandidate['norm'], orientation: RawCandidate['orientation']): number => (orientation === 'VERTICAL' ? n.y1 - n.y0 : n.x1 - n.x0)

const merge = (a: FusedCandidate['norm'], b: FusedCandidate['norm']): FusedCandidate['norm'] => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) })

export type FusionOptions = {
  /** Overlap above which two candidates on one frame are the same thing. */
  duplicateIoU?: number
  /** Overlap above which two candidates on two renderings of one drawing are the same thing. */
  clusterIoU?: number
  /** Gap, as a fraction of the shorter member's length, below which two collinear pieces are one member. */
  continuityGap?: number
  /** How far apart, in normalized units, two collinear members may sit across their axis and still be the same line. */
  collinearTolerance?: number
  /** Minimum fused confidence to accept. */
  minConfidence?: number
  /** Minimum number of distinct drawings that must show it. */
  minViewSupport?: number
}

const DEFAULTS: Required<FusionOptions> = { duplicateIoU: 0.45, clusterIoU: 0.35, continuityGap: 0.35, collinearTolerance: 0.02, minConfidence: 0.35, minViewSupport: 1 }

/** Fuse raw candidates into hypotheses' worth of evidence, counting everything dropped. */
export function fuseCandidates<T>(raw: readonly RawCandidate<T>[], options: FusionOptions = {}): { fused: FusedCandidate<T>[]; counts: FusionCounts } {
  const opt = { ...DEFAULTS, ...options }
  const rejected = new Map<string, number>()
  const reject = (why: string, count = 1): void => {
    rejected.set(why, (rejected.get(why) ?? 0) + count)
  }

  // Deterministic order: the result must not depend on detection order.
  const ordered = [...raw].sort((a, b) => b.confidence - a.confidence || a.frameId.localeCompare(b.frameId) || a.id.localeCompare(b.id))

  // 1. duplicates within one frame
  const perFrame = new Map<string, Array<FusedCandidate<T>>>()
  for (const candidate of ordered) {
    const list = perFrame.get(candidate.frameId) ?? []
    // Overlap OR containment. A band detector finds one beam as a stack of
    // sub-bands — the top edge, the whole thing, the bottom edge — and their
    // intersection over union is low precisely because one is inside another.
    // Containment catches that; overlap alone leaves three beams where the
    // drawing has one.
    const twin = list.find((f) => f.orientation === candidate.orientation && (rectIoU(f.box, candidate.box) >= opt.duplicateIoU || containment(f.box, candidate.box) >= 0.7))
    if (twin) {
      twin.members.push(candidate)
      twin.observationIds.push(...candidate.observationIds)
      reject('a second detection of the same feature on the same drawing')
      continue
    }
    list.push({
      id: candidate.id,
      members: [candidate],
      box: candidate.box,
      norm: candidate.norm,
      orientation: candidate.orientation,
      viewSupport: 1,
      depthLayer: candidate.depthLayer,
      depthSupport: DEPTH_AUTHORITY[candidate.viewRole] * (candidate.depthLayer === 'UNKNOWN' ? 0 : 1),
      confidence: candidate.confidence,
      observationIds: [...candidate.observationIds],
      trace: [],
    })
    perFrame.set(candidate.frameId, list)
  }
  const afterDuplicates = [...perFrame.values()].flat()

  // 2. the same feature on two renderings of one drawing
  const perAsset = new Map<string, Array<FusedCandidate<T>>>()
  for (const candidate of afterDuplicates.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))) {
    const assetKey = candidate.members[0].assetKey
    const list = perAsset.get(assetKey) ?? []
    const twin = list.find((f) => f.orientation === candidate.orientation && (normIoU(f.norm, candidate.norm) >= opt.clusterIoU || containment({ x0: f.norm.x0, y0: f.norm.y0, x1: f.norm.x1, y1: f.norm.y1 }, { x0: candidate.norm.x0, y0: candidate.norm.y0, x1: candidate.norm.x1, y1: candidate.norm.y1 }) >= 0.7))
    if (twin) {
      twin.members.push(...candidate.members)
      twin.observationIds.push(...candidate.observationIds)
      // The better-resolved sighting keeps the box; the other adds support.
      if (candidate.box.x1 - candidate.box.x0 > twin.box.x1 - twin.box.x0) twin.box = candidate.box
      twin.confidence = Math.max(twin.confidence, candidate.confidence)
      reject('the same feature on a second rendering of the same drawing')
      continue
    }
    list.push(candidate)
    perAsset.set(assetKey, list)
  }
  const afterClustering = [...perAsset.values()].flat()

  // 3. collinear pieces of one interrupted member
  const byGroup = new Map<string, Array<FusedCandidate<T>>>()
  for (const candidate of afterClustering) {
    const key = `${candidate.members[0].assetKey}|${candidate.orientation}`
    byGroup.set(key, [...(byGroup.get(key) ?? []), candidate])
  }
  const afterContinuity: Array<FusedCandidate<T>> = []
  for (const [, group] of [...byGroup].sort((a, b) => a[0].localeCompare(b[0]))) {
    const axis = group[0].orientation === 'VERTICAL' ? 'y' : 'x'
    const sorted = [...group].sort((a, b) => (axis === 'x' ? a.norm.x0 - b.norm.x0 : a.norm.y0 - b.norm.y0))
    const kept: Array<FusedCandidate<T>> = []
    for (const candidate of sorted) {
      const last = kept[kept.length - 1]
      if (last) {
        const across = axis === 'x' ? Math.abs((last.norm.y0 + last.norm.y1) / 2 - (candidate.norm.y0 + candidate.norm.y1) / 2) : Math.abs((last.norm.x0 + last.norm.x1) / 2 - (candidate.norm.x0 + candidate.norm.x1) / 2)
        const gap = axis === 'x' ? candidate.norm.x0 - last.norm.x1 : candidate.norm.y0 - last.norm.y1
        const shorter = Math.min(normLength(last.norm, candidate.orientation), normLength(candidate.norm, candidate.orientation))
        if (across <= opt.collinearTolerance && gap <= Math.max(shorter * opt.continuityGap, opt.collinearTolerance) && gap > -opt.collinearTolerance) {
          last.norm = merge(last.norm, candidate.norm)
          last.box = { x0: Math.min(last.box.x0, candidate.box.x0), y0: Math.min(last.box.y0, candidate.box.y0), x1: Math.max(last.box.x1, candidate.box.x1), y1: Math.max(last.box.y1, candidate.box.y1) }
          last.members.push(...candidate.members)
          last.observationIds.push(...candidate.observationIds)
          last.confidence = Math.max(last.confidence, candidate.confidence)
          reject('a collinear piece of a member interrupted by something crossing it')
          continue
        }
      }
      kept.push(candidate)
    }
    afterContinuity.push(...kept)
  }

  // 4 and 5. cross-view corroboration and role weighting
  const crossView: Array<FusedCandidate<T>> = []
  for (const candidate of afterContinuity.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))) {
    const twin = crossView.find((f) => f.orientation === candidate.orientation && normIoU(f.norm, candidate.norm) >= opt.clusterIoU && f.members[0].assetKey !== candidate.members[0].assetKey)
    if (twin) {
      twin.members.push(...candidate.members)
      twin.observationIds.push(...candidate.observationIds)
      twin.viewSupport += 1
      // A corroborated member is much more likely to be real, but never
      // certain: two views of the same shadow are still a shadow.
      twin.confidence = round6(Math.min(0.97, 1 - (1 - twin.confidence) * (1 - candidate.confidence * 0.6)))
      // Depth comes from whichever view can actually see depth.
      const support = DEPTH_AUTHORITY[candidate.members[0].viewRole] * (candidate.depthLayer === 'UNKNOWN' ? 0 : 1)
      if (support > twin.depthSupport) {
        twin.depthLayer = candidate.depthLayer
        twin.depthSupport = round6(support)
      }
      // Extents come from whichever view can actually measure them.
      if (EXTENT_AUTHORITY[candidate.members[0].viewRole] > EXTENT_AUTHORITY[twin.members[0].viewRole]) twin.norm = candidate.norm
      // Counted, because every candidate that goes in must be accounted for on
      // the way out. This one is not an error — it is the same member seen from
      // a second drawing, which is the best thing that can happen to it.
      reject('the same feature corroborated from a second drawing')
      continue
    }
    crossView.push(candidate)
  }

  const fused: FusedCandidate<T>[] = []
  for (const candidate of crossView) {
    const extentAuthority = Math.max(...candidate.members.map((m) => EXTENT_AUTHORITY[m.viewRole]))
    const confidence = round6(Math.min(0.97, candidate.confidence * (0.5 + 0.5 * extentAuthority) * (candidate.viewSupport > 1 ? 1.15 : 1)))
    if (confidence < opt.minConfidence) {
      reject('too weak to stand, even after fusion')
      continue
    }
    if (candidate.viewSupport < opt.minViewSupport) {
      reject('seen on only one drawing, where corroboration was required')
      continue
    }
    fused.push({
      ...candidate,
      confidence,
      depthSupport: round6(candidate.depthSupport),
      observationIds: [...new Set(candidate.observationIds)].sort(),
      trace: [
        `${candidate.members.length} sighting${candidate.members.length === 1 ? '' : 's'} across ${candidate.viewSupport} drawing${candidate.viewSupport === 1 ? '' : 's'}`,
        `extent from a ${candidate.members.reduce((a, m) => (EXTENT_AUTHORITY[m.viewRole] > EXTENT_AUTHORITY[a.viewRole] ? m : a)).viewRole.toLowerCase().replace(/_/g, ' ')}`,
        candidate.depthSupport > 0 ? `depth ${candidate.depthLayer.toLowerCase().replace(/_/g, ' ')}, from a view that can see it` : 'no view states its depth',
      ],
    })
  }

  fused.sort((a, b) => a.norm.x0 - b.norm.x0 || a.norm.y0 - b.norm.y0 || a.id.localeCompare(b.id))
  return {
    fused,
    counts: {
      rawCandidates: raw.length,
      afterDuplicateSuppression: afterDuplicates.length,
      afterClustering: afterClustering.length,
      afterContinuityMerge: afterContinuity.length,
      accepted: fused.length,
      rejected: [...rejected].map(([why, count]) => ({ why, count })).sort((a, b) => b.count - a.count || a.why.localeCompare(b.why)),
    },
  }
}
