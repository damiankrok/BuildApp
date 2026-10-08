/**
 * trace-record.ts — BUILDPLAN-ANALYZER-005N (RESEARCH ONLY; never imported by production): one decomposition, written out
 * as numbers and ids — its frame, extent, scale, grid, wide openings, bays, regions, the boundary record's bodies and,
 * re-read with the real `boundaryExtension`, every wall line's ink pieces and gaps. Shared by the replay wrapper
 * (`trace-decompositions.mjs`) and the fixture tracer (`fixture-trace.ts`). No pixel leaves the process.
 */
import { boundaryExtension, decomposePlan } from '../../packages/reconstruction/src/plan-decomposition.js'
import type { PlanDecomposition, PlanDecompositionOptions } from '../../packages/reconstruction/src/plan-decomposition.js'

const r = (x: number): number => Math.round(x * 1000) / 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export function traceRecord(mask: Any, chains: Any, bands: Any, registration: Any, extent: Any, options: PlanDecompositionOptions, d: PlanDecomposition, label = ''): Record<string, unknown> {
  let walls: Any = null
  try {
    const ext = boundaryExtension(mask, bands, registration, extent, { ...d, boundary: undefined }, options, chains)
    const line = (l: Any) => ({
      axis: l.axis,
      px: r(l.px),
      from: r(l.from),
      to: r(l.to),
      pieces: l.pieces.map((p: Any) => [r(p.from), r(p.to), p.kind, p.along ? 1 : 0, r(p.axisPx)]),
      gaps: l.gaps.map((g: Any) => ({ id: g.id, from: r(g.fromPx), to: r(g.toPx), w: r(g.widthM), jambs: g.jambs, sig: g.signature, cls: g.cls, b: g.boundary, occ: g.occupancy, callout: g.callout ? { id: g.callout.id, cm: g.callout.widthCm } : null })),
    })
    walls = {
      x: ext.walls.x.map(line),
      y: ext.walls.y.map(line),
      pocketMouths: ext.outline.pocketMouths.map((p: Any) => ({ id: p.gap.id, exposedM2: r(p.exposedM2), limitM2: r(p.limitM2) })),
      bridgedWeak: ext.outline.bridged.weak.map((p: Any) => ({ id: p.gap.id, exposedM2: r(p.exposedM2), limitM2: r(p.limitM2) })),
      bridgedStrong: ext.outline.bridged.strong.map((g: Any) => g.id),
    }
  } catch (e) {
    walls = { error: String(e) }
  }
  const b = d.boundary
  // the incumbent reading (the box, before the opening-aware boundary), whose cells the boundary is weighed against
  let incumbent: Any = null
  try {
    const i = decomposePlan(mask, chains, bands, registration, extent, { ...options, openingAware: false })
    incumbent = { regions: i.regions.map((g) => [g.classification, g.rect.x0, g.rect.y0, g.rect.x1, g.rect.y1]), wide: i.wideOpenings.map((w) => [w.axis, w.linePx, w.fromPx, w.toPx, w.widthM, w.decision, w.evidence.pocketM2 ?? null, w.compound?.role ?? null]), compound: i.compoundFacades ?? null, linesY: i.linesY.map((l) => r(l.px)), linesX: i.linesX.map((l) => r(l.px)) }
  } catch (e) {
    incumbent = { error: String(e) }
  }
  return {
    incumbent,
    label,
    key: [registration.frameId, extent.x0, extent.y0, extent.x1, extent.y1, registration.metresPerPixelX, registration.metresPerPixelY, options.shutPocketMouths ? 'S' : ''].join('|'),
    frameId: registration.frameId,
    decompositionId: b?.decompositionId ?? null,
    extent,
    mpp: { x: registration.metresPerPixelX, y: registration.metresPerPixelY },
    shutPocketMouths: !!options.shutPocketMouths,
    wallPx: d.wallThickness.px,
    envelope: d.envelope ? { rect: d.envelope.rect, outline: d.envelope.outline ? d.envelope.outline.length : 0 } : null,
    linesX: d.linesX.map((l) => [r(l.px), l.support.chainIds.length, r(l.support.bandCoverage), l.support.bandSpans ? 1 : 0]),
    linesY: d.linesY.map((l) => [r(l.px), l.support.chainIds.length, r(l.support.bandCoverage), l.support.bandSpans ? 1 : 0]),
    bands: (bands as Any[]).map((x: Any) => [x.axis[0], r(x.axisPx), r(x.thickness), x.bounds.x0, x.bounds.y0, x.bounds.x1, x.bounds.y1]),
    wideOpenings: d.wideOpenings,
    compound: (d as Any).compoundFacades ?? null,
    bays: d.bays.map((x) => ({ side: x.side, rect: x.rect, wallAxesPx: x.wallAxesPx, mouth: x.mouth })),
    cells: d.cells.map((c) => [c.ix, c.iy, c.classification[0], c.rect.x0, c.rect.y0, c.rect.x1, c.rect.y1]),
    regions: d.regions.map((g) => [g.classification, g.rect.x0, g.rect.y0, g.rect.x1, g.rect.y1]),
    chosenHypothesis: d.chosenHypothesis,
    unresolved: d.unresolved,
    boundary: b
      ? {
          accepted: b.accepted,
          why: b.why,
          box: b.box,
          gaps: b.gaps,
          bridged: b.bridged,
          bodies: b.bodies.map((x) => ({ relation: x.relation, enclosed: x.enclosed, built: x.built, areaM2: r(x.areaM2), rect: x.rect, junction: x.junction, sides: x.sides, mouth: x.mouth })),
          completions: b.completions.map((c: Any) => ({ kind: c.kind, decision: c.decision, reason: c.reason, rect: c.rect, areaM2: c.areaM2 })),
          extentConflicts: b.extentConflicts,
          policies: { strict: b.policies.strict.accepted, exclusion: b.policies.exclusion.accepted },
        }
      : null,
    walls,
  }
}
