/**
 * The one documented transform from the reference research frame to the
 * BuildApp world frame.
 *
 * Reference frame (Web-analizer-builder, STAGE WEB-PIVOT-02 onwards): +X east,
 * +Y up, +Z south; origin at the outer face of the main body's north-west
 * corner at ground finished floor level; the entrance facade is at maximum Z
 * and faces +Z. Right-handed.
 *
 * BuildApp frame (`MODEL_FRAME`): x right when looking at the front facade,
 * y up, z away from the front facade into the building; finished ground floor
 * at y = 0; the front facade's outer face at z = 0. Left-handed as specified.
 *
 * Handedness check, done against the plans rather than assumed: standing
 * south of the house (reference +Z) looking north at the entrance facade,
 * east is on the observer's right (forward −Z, up +Y gives right = forward ×
 * up = +X). So BuildApp x = reference X with no mirror: the garage, which the
 * ground plan draws on the east (+X) side, stays on the right of the front
 * view, as the hero render shows it. Depth runs the other way: the
 * characteristic front outer plane (the returns' faces at reference Z 13.60)
 * is BuildApp z = 0, and z grows towards the rear. One reflection turns the
 * right-handed reference frame into BuildApp's left-handed one, which is the
 * expected relation between the two, not a defect.
 *
 *     x_app = x_ref
 *     y_app = y_ref
 *     z_app = FRONT_OUTER_PLANE_REF_Z − z_ref = 13.60 − z_ref
 *
 * Depth planes, reference → BuildApp:
 *   front outer projection plane   13.60 →  0.00
 *   front back wall plane          12.60 →  1.00
 *   rear back wall plane            0.00 → 13.60
 *   rear outer projection plane    −1.00 → 14.60
 */
import type { Vec2, Vec3 } from '@buildapp/model'

/** Reference Z of the characteristic front outer plane (the front returns' outer faces). */
export const FRONT_OUTER_PLANE_REF_Z = 13.6

export type RefPoint = { x: number; y: number; z: number }
export type RefPlanPoint = { x: number; z: number }

export const refToApp = (p: RefPoint): Vec3 => ({ x: p.x, y: p.y, z: FRONT_OUTER_PLANE_REF_Z - p.z })
export const appToRef = (p: Vec3): RefPoint => ({ x: p.x, y: p.y, z: FRONT_OUTER_PLANE_REF_Z - p.z })

/** Plan-only transform: x unchanged, z mirrored about the front outer plane. */
export const refPlanToApp = (p: RefPlanPoint): Vec2 => ({ x: p.x, z: FRONT_OUTER_PLANE_REF_Z - p.z })
export const appPlanToRef = (p: Vec2): RefPlanPoint => ({ x: p.x, z: FRONT_OUTER_PLANE_REF_Z - p.z })

/** A reference z-range `[z0, z1]` becomes the BuildApp range `[13.60 − z1, 13.60 − z0]`. */
export const refZRangeToApp = (z0: number, z1: number): [number, number] => [FRONT_OUTER_PLANE_REF_Z - Math.max(z0, z1), FRONT_OUTER_PLANE_REF_Z - Math.min(z0, z1)]

/** A reference plan rectangle in BuildApp coordinates. */
export const refRectToApp = (r: { minX: number; maxX: number; minZ: number; maxZ: number }): { minX: number; maxX: number; minZ: number; maxZ: number } => {
  const [minZ, maxZ] = refZRangeToApp(r.minZ, r.maxZ)
  return { minX: r.minX, maxX: r.maxX, minZ, maxZ }
}

/** A reference polygon in BuildApp coordinates (the winding reverses; polygons are orientation-free in the model). */
export const refPolygonToApp = (poly: ReadonlyArray<readonly [number, number]>): Vec2[] => poly.map(([x, z]) => refPlanToApp({ x, z }))

/**
 * Round to the millimetre-scale precision the source carries, so that
 * transformed coordinates such as `13.6 − 12.15` come out as `1.45` and not
 * `1.4499999999999993`. Every transcribed figure has at most five decimals
 * (the derived eave and build-up), so five is exact for all of them.
 */
export const q = (v: number): number => Math.round(v * 1e5) / 1e5
