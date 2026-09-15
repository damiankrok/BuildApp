/**
 * Roof-cut arithmetic shared by validation and the compiler: where a roof
 * opening's outline lies on the underside of the plate for each cut mode.
 *
 * A NORMAL_TO_ROOF cut has sides perpendicular to the roof plane. Moving
 * from the top surface to the underside along the inward normal of a plane
 * pitched at θ travels `t · sin θ` uphill in plan (towards the ridge) for a
 * perpendicular thickness `t`; the underside outline is the footprint shifted
 * by that much on the cross axis, towards the ridge. A VERTICAL cut has the
 * same outline on both surfaces. A flat roof has no uphill: both modes agree.
 */
import type { PlanRect } from './geometry-types.js'
import { roofCreaseLine } from './query.js'
import type { Roof, RoofOpening } from './schema.js'

export const roofCutMode = (o: Pick<RoofOpening, 'cut'>): 'VERTICAL' | 'NORMAL_TO_ROOF' => o.cut ?? 'VERTICAL'

/** Plan shift (dx, dz) of a NORMAL_TO_ROOF opening's underside outline relative to its footprint; zero for VERTICAL or on a flat roof. */
export function roofOpeningUndersideShift(roof: Pick<Roof, 'kind' | 'footprint' | 'ridgeAxis' | 'pitchDeg' | 'thickness'>, o: Pick<RoofOpening, 'footprint' | 'cut'>): { dx: number; dz: number } {
  if (roofCutMode(o) === 'VERTICAL' || roof.kind !== 'GABLE') return { dx: 0, dz: 0 }
  const crease = roofCreaseLine(roof)
  if (!crease) return { dx: 0, dz: 0 }
  const s = roof.thickness * Math.sin((roof.pitchDeg * Math.PI) / 180)
  const centre = crease.axis === 'X' ? (o.footprint.minX + o.footprint.maxX) / 2 : (o.footprint.minZ + o.footprint.maxZ) / 2
  const uphill = centre < crease.value ? 1 : -1
  return crease.axis === 'X' ? { dx: uphill * s, dz: 0 } : { dx: 0, dz: uphill * s }
}

/** The opening's outline on the roof underside, in plan. */
export function roofOpeningUndersideRect(roof: Pick<Roof, 'kind' | 'footprint' | 'ridgeAxis' | 'pitchDeg' | 'thickness'>, o: Pick<RoofOpening, 'footprint' | 'cut'>): PlanRect {
  const { dx, dz } = roofOpeningUndersideShift(roof, o)
  const f = o.footprint
  return { minX: f.minX + dx, maxX: f.maxX + dx, minZ: f.minZ + dz, maxZ: f.maxZ + dz }
}
