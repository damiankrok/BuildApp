/**
 * Projection verification: does the candidate still agree with the drawings?
 *
 * The candidate was built FROM the sources, so it agrees with them by
 * construction in the places the solver looked. This pass looks in the places
 * it did not: it projects the solved model back into each registered view and
 * measures how far the result lands from the observations that view actually
 * contains.
 *
 * Two deliberate limits, both of which make the number mean something:
 *
 * - **It is not iterative.** Nothing here feeds back into the solve. A
 *   verification that adjusts the thing it is verifying measures its own
 *   convergence, not the model's accuracy, and there is no honest way to
 *   report the result.
 * - **It never compares RGB.** A rendered model and a published drawing are
 *   different kinds of picture — different line weights, different hatching,
 *   a watermark — and any pixel metric between them measures the rendering
 *   style. So the comparison is between GEOMETRY and OBSERVATIONS: a wall's
 *   projected outline against the silhouette that was traced, an opening's
 *   projected box against the opening that was found.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { rectIoU } from '@buildapp/source-common'
import type { SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ElevationRegistration } from './views.js'

export type ProjectionMatch = {
  objectId: string
  kind: string
  frameId: string
  /** Where the solved object projects to, in the frame's pixels. */
  projected: PixelRect
  /** The observation it was matched against, when one was near enough. */
  observationId?: string
  observed?: PixelRect
  /** Overlap of the two boxes, 0..1. */
  iou: number
  /** How far their centres are apart, in the frame's pixels and in metres. */
  centrePx: number
  centreM: number
  status: 'MATCHED' | 'UNMATCHED' | 'NO_OBSERVATION'
}

export type ProjectionAudit = {
  /** The candidate this audits, by hash: an audit of a different candidate is a different audit. */
  candidateHash: string
  observationGraphHash: string
  views: Array<{
    frameId: string
    side: string
    metresPerPixel: number
    matched: number
    unmatched: number
    /** Observations on this view that nothing in the model explains. */
    unexplained: number
    iouMean: number
    centreRmsM: number
  }>
  matches: ProjectionMatch[]
  /** Across every view. */
  summary: {
    objects: number
    matched: number
    unmatched: number
    unexplained: number
    iouMean: number
    centreRmsM: number
    centreMaxM: number
  }
}

const rectOf = (o: SourceObservation): PixelRect | undefined => {
  const g = o.pixelGeometry
  if (g.type === 'RECT') return g.rect
  const points = g.type === 'POLYGON' || g.type === 'POLYLINE' ? g.points : g.type === 'SEGMENT' ? [g.a, g.b] : g.type === 'POINT' ? [g.point] : g.lines.flatMap((l) => [l.a, l.b])
  if (points.length === 0) return undefined
  return { x0: Math.min(...points.map((p) => p.x)), y0: Math.min(...points.map((p) => p.y)), x1: Math.max(...points.map((p) => p.x)), y1: Math.max(...points.map((p) => p.y)) }
}

const centre = (r: PixelRect): { x: number; y: number } => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 })

/** Where a metric position on a wall lands in a registered elevation's pixels. */
const toPixels = (registration: ElevationRegistration, u: number, v: number): { x: number; y: number } => ({
  x: registration.extent.x0 + (u + registration.overhangM) / registration.metresPerPixelU,
  y: registration.extent.y1 - v / registration.metresPerPixelV,
})

const WALL_SIDE: Record<number, string> = { 0: 'REAR', 1: 'RIGHT', 2: 'FRONT', 3: 'LEFT' }

/**
 * Project the candidate's openings back into the elevations they were read
 * from, and measure the disagreement.
 *
 * Openings are the right thing to audit: they are numerous, they are found
 * independently on each facade, and their position is the first thing a
 * mirrored or mis-scaled registration gets wrong. A model whose openings land
 * on the observed ones is a model whose facade registration is sound; one
 * whose openings are reflected about the centre of every wall is a model with
 * a handedness bug, and the audit says so in one number per view.
 */
export function auditProjection(model: CanonicalBuildingModel, graph: SourceObservationGraph, registrations: readonly ElevationRegistration[], candidateHash: string): ProjectionAudit {
  const matches: ProjectionMatch[] = []
  const views: ProjectionAudit['views'] = []

  for (const registration of registrations) {
    if (!registration.side) continue
    const observed = graph.observations.filter((o) => o.frameId === registration.frameId && (o.kind === 'OPENING' || o.kind === 'WINDOW' || o.kind === 'DOOR'))
    const claimed = new Set<string>()
    const mine: ProjectionMatch[] = []

    for (const opening of model.openings) {
      const wall = model.walls.find((w) => w.id === opening.wallId)
      if (!wall) continue
      const index = Number(wall.id.slice(-1))
      if (WALL_SIDE[index] !== registration.side) continue
      const level = model.levels.find((l) => l.id === wall.levelId)
      const floor = level?.elevation ?? 0
      const a = toPixels(registration, opening.offset, floor + opening.sill)
      const b = toPixels(registration, opening.offset + opening.width, floor + opening.sill + opening.height)
      const projected: PixelRect = { x0: round6(Math.min(a.x, b.x)), y0: round6(Math.min(a.y, b.y)), x1: round6(Math.max(a.x, b.x)), y1: round6(Math.max(a.y, b.y)) }

      let best: { observation: SourceObservation; box: PixelRect; iou: number } | undefined
      for (const o of observed) {
        if (claimed.has(o.id)) continue
        const box = rectOf(o)
        if (!box) continue
        const iou = rectIoU(projected, box)
        if (!best || iou > best.iou) best = { observation: o, box, iou }
      }
      if (best && best.iou > 0.1) {
        claimed.add(best.observation.id)
        const dx = centre(projected).x - centre(best.box).x
        const dy = centre(projected).y - centre(best.box).y
        const centrePx = round6(Math.hypot(dx, dy))
        mine.push({ objectId: opening.id, kind: 'opening', frameId: registration.frameId, projected, observationId: best.observation.id, observed: best.box, iou: round6(best.iou), centrePx, centreM: round6(centrePx * registration.metresPerPixelU), status: 'MATCHED' })
      } else {
        mine.push({ objectId: opening.id, kind: 'opening', frameId: registration.frameId, projected, iou: 0, centrePx: 0, centreM: 0, status: observed.length === 0 ? 'NO_OBSERVATION' : 'UNMATCHED' })
      }
    }

    const matched = mine.filter((m) => m.status === 'MATCHED')
    views.push({
      frameId: registration.frameId,
      side: registration.side,
      metresPerPixel: registration.metresPerPixelU,
      matched: matched.length,
      unmatched: mine.length - matched.length,
      unexplained: observed.length - claimed.size,
      iouMean: round6(matched.length === 0 ? 0 : matched.reduce((a, m) => a + m.iou, 0) / matched.length),
      centreRmsM: round6(matched.length === 0 ? 0 : Math.sqrt(matched.reduce((a, m) => a + m.centreM ** 2, 0) / matched.length)),
    })
    matches.push(...mine)
  }

  const matched = matches.filter((m) => m.status === 'MATCHED')
  return {
    candidateHash,
    observationGraphHash: graph.contentHash,
    views: views.sort((a, b) => a.side.localeCompare(b.side)),
    matches: matches.sort((a, b) => a.objectId.localeCompare(b.objectId)),
    summary: {
      objects: matches.length,
      matched: matched.length,
      unmatched: matches.length - matched.length,
      unexplained: views.reduce((a, v) => a + v.unexplained, 0),
      iouMean: round6(matched.length === 0 ? 0 : matched.reduce((a, m) => a + m.iou, 0) / matched.length),
      centreRmsM: round6(matched.length === 0 ? 0 : Math.sqrt(matched.reduce((a, m) => a + m.centreM ** 2, 0) / matched.length)),
      centreMaxM: round6(Math.max(0, ...matched.map((m) => m.centreM))),
    },
  }
}
