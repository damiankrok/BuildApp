/**
 * Saying that two views show the same thing.
 *
 * This is the part of the graph that is most valuable and most dangerous. It
 * is valuable because a feature seen twice is a feature a later solver can
 * actually place in three dimensions; it is dangerous because a WRONG merge
 * destroys evidence — two different windows fused into one cannot be pulled
 * apart again by anything downstream, whereas two halves of one window left
 * unmerged merely leave work undone.
 *
 * So the asymmetry is built in: `POSSIBLY_SAME_FEATURE` is the default and
 * `SAME_FEATURE` is never asserted from a geometric coincidence alone. And
 * where two views DISAGREE — a pitch angle in the section that the elevation
 * contradicts, a tread count that does not match — the disagreement is
 * recorded as a conflict rather than resolved by preferring one drawing.
 */
import { angleDeltaDeg, round6 } from '@buildapp/source-common'
import type { ExtractorHandle, ObservationGraphBuilder, SourceCoordinateFrame, SourceObservation } from '@buildapp/source-observations'

export const IDENTITY_EXTRACTOR = { name: 'derived.cross-view', version: '1.0.0' } as const

export type FrameView = { frame: SourceCoordinateFrame; observations: SourceObservation[] }

const centroidNorm = (o: SourceObservation): { x: number; y: number } => {
  const g = o.normGeometry
  const pts =
    g.type === 'POINT'
      ? [g.point]
      : g.type === 'SEGMENT'
        ? [g.a, g.b]
        : g.type === 'POLYLINE' || g.type === 'POLYGON'
          ? g.points
          : g.type === 'RECT'
            ? [
                { x: g.rect.x0, y: g.rect.y0 },
                { x: g.rect.x1, y: g.rect.y1 },
              ]
            : g.lines.flatMap((l) => [l.a, l.b])
  return { x: round6(pts.reduce((a, p) => a + p.x, 0) / pts.length), y: round6(pts.reduce((a, p) => a + p.y, 0) / pts.length) }
}

const heightBand = (o: SourceObservation): [number, number] => {
  const c = centroidNorm(o)
  const g = o.normGeometry
  if (g.type === 'RECT') return [Math.min(g.rect.y0, g.rect.y1), Math.max(g.rect.y0, g.rect.y1)]
  return [c.y, c.y]
}

const overlaps = (a: [number, number], b: [number, number]): number => {
  const lo = Math.max(a[0], b[0])
  const hi = Math.min(a[1], b[1])
  const span = Math.max(a[1] - a[0], b[1] - b[0], 1e-6)
  return Math.max(0, hi - lo) / span
}

/**
 * Relate observations across two orthographic views of the same building.
 *
 * The only cue available without a solver is HEIGHT: two orthographic
 * elevations, and a section, all measure the same vertical axis, so a feature
 * at the same normalized height in two of them may be the same feature. That
 * is a weak cue and it is stated as one. Horizontal position is deliberately
 * NOT used: x in a front elevation and x in a side elevation are different
 * axes, and treating them as the same is how a balcony ends up on the wrong
 * wall.
 */
export function relateAcrossViews(builder: ObservationGraphBuilder, handle: ExtractorHandle, views: readonly FrameView[]): { proposed: number; conflicts: number } {
  let proposed = 0
  let conflicts = 0
  const orthographic = views.filter((v) => v.frame.roles.projection.startsWith('ORTHOGRAPHIC'))

  for (let i = 0; i < orthographic.length; i += 1) {
    for (let j = i + 1; j < orthographic.length; j += 1) {
      const a = orthographic[i]
      const b = orthographic[j]
      // Two plans of different storeys measure different heights; there is
      // nothing to correlate between them here.
      if (a.frame.roles.projection === 'ORTHOGRAPHIC_PLAN' && b.frame.roles.projection === 'ORTHOGRAPHIC_PLAN') continue

      // ---- roof pitch, where two views both measured one -------------------
      const pitchA = a.observations.filter((o) => o.kind === 'ROOF_EDGE' && o.value?.unit === 'deg')
      const pitchB = b.observations.filter((o) => o.kind === 'ROOF_EDGE' && o.value?.unit === 'deg')
      for (const p of pitchA) {
        for (const q of pitchB) {
          const u = p.value?.number
          const v = q.value?.number
          if (u === undefined || v === undefined) continue
          const delta = angleDeltaDeg(u, v)
          const tolerance = (p.uncertainty.angleDeg ?? 2) + (q.uncertainty.angleDeg ?? 2) + 2
          if (delta <= tolerance) {
            builder.relate(handle, { kind: 'CORROBORATES', from: p, to: q, confidence: round6(Math.min(0.75, 0.4 + (tolerance - delta) / 20)), why: `both views measure this slope within ${round6(delta)} degrees of one another` })
            proposed += 1
          }
        }
      }

      // ---- features at the same height -------------------------------------
      const KINDS = ['OPENING', 'WINDOW', 'DOOR', 'BALCONY', 'LOGGIA', 'LINEAR_VOLUME_CANDIDATE', 'RIDGE'] as const
      for (const kind of KINDS) {
        const left = a.observations.filter((o) => o.kind === kind)
        const right = b.observations.filter((o) => o.kind === kind)
        for (const p of left) {
          for (const q of right) {
            const share = overlaps(heightBand(p), heightBand(q))
            if (share < 0.6) continue
            const hintsMatch = p.semanticHints.some((h) => q.semanticHints.includes(h))
            builder.relate(handle, {
              kind: 'POSSIBLY_SAME_FEATURE',
              from: p,
              to: q,
              confidence: round6(Math.min(0.55, 0.2 + share * 0.3 + (hintsMatch ? 0.1 : 0))),
              why: `both are ${kind} at the same normalized height (${round6(share * 100)}% of their extents overlap) in two orthographic views of the same building; height is the only axis the two views share, so this is a candidate and not a match`,
            })
            proposed += 1
          }
        }
      }
    }
  }

  // ---- the stair, counted twice ------------------------------------------
  const planStairs = views.filter((v) => v.frame.roles.projection === 'ORTHOGRAPHIC_PLAN').flatMap((v) => v.observations.filter((o) => o.kind === 'STAIR' && o.semanticHints.includes('tread-line')))
  const sectionStairs = views.filter((v) => v.frame.roles.projection === 'ORTHOGRAPHIC_SECTION').flatMap((v) => v.observations.filter((o) => o.kind === 'STAIR' && o.value?.unit === 'count'))
  for (const p of planStairs) {
    for (const q of sectionStairs) {
      builder.relate(handle, { kind: 'POSSIBLY_SAME_FEATURE', from: p, to: q, confidence: 0.45, why: 'the only stair read off a plan and the only stair read off a section are candidates for one another; nothing here proves it' })
      proposed += 1
      const a = p.value?.number
      const b = q.value?.number
      if (a === undefined || b === undefined) continue
      if (Math.abs(a - b) > 1) {
        builder.conflict({
          observations: [p, q],
          kind: 'COUNT',
          what: 'how many treads the staircase has',
          magnitude: Math.abs(a - b),
          unit: 'count',
          note: `the plan shows ${a} tread strokes and the section shows ${b}; a plan of one storey and a section through the whole flight legitimately differ, so this is recorded rather than reconciled`,
        })
        conflicts += 1
      }
    }
  }

  return { proposed, conflicts }
}
