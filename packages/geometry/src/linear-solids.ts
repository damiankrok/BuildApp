/**
 * Linear solids: a straight member with a rectangular cross-section, swept
 * along its own centreline.
 *
 * The compilation is deliberately the simplest thing that is a closed solid:
 * an oriented box. It is not a swept profile with mitres, because a member
 * that needs mitres is two members meeting, and stating them as two is both
 * truer and easier to argue with than stating one with a hidden joint rule.
 * Where two members do meet in a cut (verge boards at a gable apex), the
 * model states the cut plane on each (`startCut` / `endCut`), and the box's
 * arrises end in it: still two members, and the joint is data, not a rule.
 *
 * The cross-section axes come from `linearSolidBasis` in the model package —
 * the same function the validator and the reconstruction solver use — so the
 * shape the compiler draws is the shape the model states, not a second
 * interpretation of the same numbers.
 */
import { linearSolidBasis, linearSolidCorners, type LinearSolid } from '@buildapp/model'
import { frameBox, quadOut } from './primitives.js'
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
  if (solid.startCut || solid.endCut) {
    // A stated end cut: the same four arrises, ending in the cut planes.
    const c = linearSolidCorners(solid)
    const p = basis.pathDir
    const w = basis.widthAxis
    const d = basis.depthAxis
    const neg = (v: Vec3): Vec3 => ({ x: -v.x, y: -v.y, z: -v.z })
    quadOut(out, c[0], c[1], c[2], c[3], neg(p))
    quadOut(out, c[4], c[5], c[6], c[7], p)
    quadOut(out, c[0], c[3], c[7], c[4], neg(w))
    quadOut(out, c[1], c[2], c[6], c[5], w)
    quadOut(out, c[0], c[1], c[5], c[4], neg(d))
    quadOut(out, c[3], c[2], c[6], c[7], d)
    return out
  }
  // The box's origin is the start face's (−width/2, −depth/2) corner, so the
  // stated centreline really is the centre of the member rather than one of
  // its arrises.
  const origin = add(solid.start, add(scale(basis.widthAxis, -solid.width / 2), scale(basis.depthAxis, -solid.depth / 2)))
  frameBox(out, origin, scale(basis.pathDir, basis.length), scale(basis.widthAxis, solid.width), scale(basis.depthAxis, solid.depth))
  return out
}
