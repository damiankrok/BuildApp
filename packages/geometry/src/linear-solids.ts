/**
 * Linear solids: a straight member with a rectangular cross-section, swept
 * along its own centreline.
 *
 * The compilation is deliberately the simplest thing that is a closed solid:
 * an oriented box. It is not a swept profile with mitres, because a member
 * that needs mitres is two members meeting, and stating them as two is both
 * truer and easier to argue with than stating one with a hidden joint rule.
 *
 * The cross-section axes come from `linearSolidBasis` in the model package —
 * the same function the validator and the reconstruction solver use — so the
 * shape the compiler draws is the shape the model states, not a second
 * interpretation of the same numbers.
 */
import { linearSolidBasis, type LinearSolid } from '@buildapp/model'
import { frameBox } from './primitives.js'
import type { Triangle, Vec3 } from './types.js'

const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k })
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

/**
 * Triangles for one member, wound outward. Returns an empty array for a
 * degenerate member — one whose ends coincide — which the caller reports
 * rather than drawing as nothing.
 */
export function compileLinearSolid(solid: LinearSolid): Triangle[] {
  const basis = linearSolidBasis(solid)
  if (basis.length <= 0) return []
  const out: Triangle[] = []
  // The box's origin is the start face's (−width/2, −depth/2) corner, so the
  // stated centreline really is the centre of the member rather than one of
  // its arrises.
  const origin = add(solid.start, add(scale(basis.widthAxis, -solid.width / 2), scale(basis.depthAxis, -solid.depth / 2)))
  frameBox(out, origin, scale(basis.pathDir, basis.length), scale(basis.widthAxis, solid.width), scale(basis.depthAxis, solid.depth))
  return out
}
