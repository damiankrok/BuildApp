/**
 * §11B and §12. Where the camera was, and what you can measure without one.
 *
 * A homography measures a PLANE. It is exact for a facade and useless for
 * anything that stands off one — a balcony's depth, an eaves projection, the
 * set-back of a garage — because those are the one thing a single plane cannot
 * express. For those the camera itself has to be solved.
 *
 * `solveCamera` does it by resection: the 3×4 projection matrix has eleven
 * degrees of freedom, six correspondences over-determine it, and the matrix
 * factors into an intrinsic K, a rotation R and a translation t. Then the pose
 * is polished by minimising reprojection error directly, because the algebraic
 * error the linear solve minimises is not the geometric one anybody cares
 * about.
 *
 * The configuration matters more than the count. Six points on ONE PLANE do
 * not determine a camera however well they are measured — the system is rank
 * deficient and the solve returns a confident answer to a question that has
 * none. That is checked for and refused, because §21's twelfth mutation is
 * exactly this and the failure is otherwise invisible.
 *
 * `vanishingPoint` is the other end of the same idea: where a camera cannot be
 * solved, a family of parallel lines still meets at a point, and that point is
 * a direction in space. It is what makes a single photograph measurable at all
 * when nothing in it has a known size.
 */
import { round6 } from '@buildapp/source-common'
import { leastSquares, median, smallestSingularVector, solveLinear } from './linalg.js'

export type WorldCorrespondence = {
  id: string
  /** Where it is in the world, in metres. */
  world: { x: number; y: number; z: number }
  /** And where it appears in the picture. */
  pixel: { u: number; v: number }
}

export type CameraSolution = {
  /** Row-major 3×4 projection matrix, as solved. */
  projection: number[]
  focalPx: { x: number; y: number }
  principal: { u: number; v: number }
  /** Row-major 3×3. */
  rotation: number[]
  translation: number[]
  /** Where the camera is, in world metres. */
  centre: { x: number; y: number; z: number }
  errorsPx: number[]
  rmsPx: number
  maxPx: number
  inlierIds: string[]
  why: string
}

export type CameraOptions = {
  tolerancePx?: number
  /** How many rounds of pose polishing. */
  rounds?: number
  /** How far from coplanar the points must be, as a share of their own spread. */
  minDepthSpread?: number
}

const DEFAULTS: Required<CameraOptions> = { tolerancePx: 4, rounds: 40, minDepthSpread: 0.02 }

const project = (p: readonly number[], w: { x: number; y: number; z: number }): { u: number; v: number } | null => {
  const s = p[8] * w.x + p[9] * w.y + p[10] * w.z + p[11]
  if (!Number.isFinite(s) || Math.abs(s) < 1e-12) return null
  return { u: (p[0] * w.x + p[1] * w.y + p[2] * w.z + p[3]) / s, v: (p[4] * w.x + p[5] * w.y + p[6] * w.z + p[7]) / s }
}

/**
 * How far from a plane these points are, relative to how spread out they are.
 *
 * The best-fitting plane through them is found by least squares, and what
 * comes back is the worst distance from it over the points' own extent. Near
 * zero means they are coplanar and no camera can be resected from them.
 */
export function planarity(points: ReadonlyArray<{ x: number; y: number; z: number }>): number {
  if (points.length < 4) return 0
  const cx = points.reduce((a, p) => a + p.x, 0) / points.length
  const cy = points.reduce((a, p) => a + p.y, 0) / points.length
  const cz = points.reduce((a, p) => a + p.z, 0) / points.length
  const rows = points.map((p) => [p.x - cx, p.y - cy, p.z - cz])
  const normal = smallestSingularVector(rows)
  if (!normal) return 0
  const distances = rows.map((r) => Math.abs(r[0] * normal[0] + r[1] * normal[1] + r[2] * normal[2]))
  const extent = Math.max(...rows.map((r) => Math.hypot(r[0], r[1], r[2])))
  return extent > 1e-9 ? Math.max(...distances) / extent : 0
}

/**
 * RQ decomposition of a 3×3 by Givens rotations: `M = R · Q`, with R upper
 * triangular and Q orthogonal.
 *
 * This is how a projection matrix becomes a camera. Its left 3×3 block is
 * `K · R` — the intrinsics times the rotation — and those are exactly an
 * upper-triangular matrix times an orthogonal one, so factoring it recovers
 * both. Three rotations, each chosen to put one zero below the diagonal, in
 * the order (2,1), (2,0), (1,0) so that no later one disturbs an earlier one's
 * zero.
 */
function rq3(m: readonly number[]): { r: number[]; q: number[] } {
  const mul = (x: readonly number[], y: readonly number[]): number[] => {
    const out = new Array<number>(9).fill(0)
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) for (let k = 0; k < 3; k += 1) out[i * 3 + j] += x[i * 3 + k] * y[k * 3 + j]
    return out
  }
  const at = (a: readonly number[], row: number, col: number): number => a[row * 3 + col]
  let r = [...m]

  const dx = Math.hypot(at(r, 2, 2), at(r, 2, 1))
  const cx = dx < 1e-15 ? 1 : -at(r, 2, 2) / dx
  const sx = dx < 1e-15 ? 0 : at(r, 2, 1) / dx
  const qx = [1, 0, 0, 0, cx, -sx, 0, sx, cx]
  r = mul(r, qx)

  const dy = Math.hypot(at(r, 2, 2), at(r, 2, 0))
  const cy = dy < 1e-15 ? 1 : at(r, 2, 2) / dy
  const sy = dy < 1e-15 ? 0 : at(r, 2, 0) / dy
  const qy = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  r = mul(r, qy)

  const dz = Math.hypot(at(r, 1, 1), at(r, 1, 0))
  const cz = dz < 1e-15 ? 1 : -at(r, 1, 1) / dz
  const sz = dz < 1e-15 ? 0 : at(r, 1, 0) / dz
  const qz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1]
  r = mul(r, qz)

  return { r, q: mul(transpose3(qz), mul(transpose3(qy), transpose3(qx))) }
}

const transpose3 = (m: readonly number[]): number[] => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]

/**
 * Solve the camera from world points and their images.
 *
 * Returns `null` rather than a number when the points are coplanar, when there
 * are too few of them, or when nothing the solve produces explains where they
 * were actually seen.
 */
export function solveCamera(points: readonly WorldCorrespondence[], options: CameraOptions = {}): CameraSolution | null {
  const opt = { ...DEFAULTS, ...options }
  const ordered = [...points].sort((a, b) => a.id.localeCompare(b.id))
  if (ordered.length < 6) return null
  const spread = planarity(ordered.map((p) => p.world))
  if (spread < opt.minDepthSpread) return null

  // Normalise both sides, or the eleven unknowns are solved in units that
  // differ by four orders of magnitude.
  const cu = ordered.reduce((a, p) => a + p.pixel.u, 0) / ordered.length
  const cv = ordered.reduce((a, p) => a + p.pixel.v, 0) / ordered.length
  const su = Math.SQRT2 / Math.max(1e-9, ordered.reduce((a, p) => a + Math.hypot(p.pixel.u - cu, p.pixel.v - cv), 0) / ordered.length)
  const cw = { x: ordered.reduce((a, p) => a + p.world.x, 0) / ordered.length, y: ordered.reduce((a, p) => a + p.world.y, 0) / ordered.length, z: ordered.reduce((a, p) => a + p.world.z, 0) / ordered.length }
  const sw = Math.sqrt(3) / Math.max(1e-9, ordered.reduce((a, p) => a + Math.hypot(p.world.x - cw.x, p.world.y - cw.y, p.world.z - cw.z), 0) / ordered.length)

  const rows: number[][] = []
  for (const p of ordered) {
    const X = (p.world.x - cw.x) * sw
    const Y = (p.world.y - cw.y) * sw
    const Z = (p.world.z - cw.z) * sw
    const u = (p.pixel.u - cu) * su
    const v = (p.pixel.v - cv) * su
    rows.push([X, Y, Z, 1, 0, 0, 0, 0, -u * X, -u * Y, -u * Z, -u])
    rows.push([0, 0, 0, 0, X, Y, Z, 1, -v * X, -v * Y, -v * Z, -v])
  }
  const solved = smallestSingularVector(rows)
  if (!solved) return null

  // Un-normalise: P = T_pixel^-1 · P̂ · T_world
  const tPixelInverse = [1 / su, 0, cu, 0, 1 / su, cv, 0, 0, 1]
  const tWorld = [sw, 0, 0, -sw * cw.x, 0, sw, 0, -sw * cw.y, 0, 0, sw, -sw * cw.z, 0, 0, 0, 1]
  const scaled: number[] = new Array<number>(12).fill(0)
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      let sum = 0
      for (let k = 0; k < 3; k += 1) sum += tPixelInverse[i * 3 + k] * solved[k * 4 + j]
      scaled[i * 4 + j] = sum
    }
  }
  const projection: number[] = new Array<number>(12).fill(0)
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += scaled[i * 4 + k] * tWorld[k * 4 + j]
      projection[i * 4 + j] = sum
    }
  }
  if (!projection.every((x) => Number.isFinite(x))) return null

  const errorsOf = (p: readonly number[]): number[] =>
    ordered.map((point) => {
      const got = project(p, point.world)
      return got ? Math.hypot(got.u - point.pixel.u, got.v - point.pixel.v) : Number.POSITIVE_INFINITY
    })

  // Polish: the linear solve minimises an algebraic error, and the one that
  // matters is how far each point lands from where it was seen. Gauss-Newton
  // on the eleven free parameters, with the twelfth fixed by the scale.
  let best = projection
  let bestCost = errorsOf(best).reduce((a, e) => a + e * e, 0)
  for (let round = 0; round < opt.rounds; round += 1) {
    const jacobian: number[][] = []
    const residuals: number[] = []
    const step = 1e-6 * Math.max(1, Math.hypot(...best))
    for (const point of ordered) {
      const got = project(best, point.world)
      if (!got) return null
      residuals.push(point.pixel.u - got.u, point.pixel.v - got.v)
      const rowU: number[] = []
      const rowV: number[] = []
      for (let i = 0; i < 12; i += 1) {
        const bumped = [...best]
        bumped[i] += step
        const moved = project(bumped, point.world)
        if (!moved) return null
        rowU.push((moved.u - got.u) / step)
        rowV.push((moved.v - got.v) / step)
      }
      jacobian.push(rowU, rowV)
    }
    const delta = leastSquares(jacobian, residuals, jacobian.map(() => 1))
    if (!delta) break
    const next = best.map((x, i) => x + (delta[i] ?? 0))
    const cost = errorsOf(next).reduce((a, e) => a + e * e, 0)
    if (!Number.isFinite(cost) || cost >= bestCost - 1e-12) break
    best = next
    bestCost = cost
  }

  const errors = errorsOf(best)
  const m = [best[0], best[1], best[2], best[4], best[5], best[6], best[8], best[9], best[10]]
  const { r, q } = rq3(m)
  // K's diagonal must be positive; absorb the signs into R.
  const signs = [Math.sign(r[0]) || 1, Math.sign(r[4]) || 1, Math.sign(r[8]) || 1]
  const k = [...r]
  const rot = [...q]
  for (let c = 0; c < 3; c += 1) {
    for (let row = 0; row < 3; row += 1) k[row * 3 + c] *= signs[c]
    for (let col = 0; col < 3; col += 1) rot[c * 3 + col] *= signs[c]
  }
  const kScale = k[8] === 0 ? 1 : k[8]
  const intrinsics = k.map((x) => x / kScale)
  const translationSolve = solveLinear(
    [
      [intrinsics[0], intrinsics[1], intrinsics[2]],
      [0, intrinsics[4], intrinsics[5]],
      [0, 0, 1],
    ],
    [best[3] / kScale, best[7] / kScale, best[11] / kScale],
  )
  const translation = translationSolve ?? [0, 0, 0]
  const centreSolve = solveLinear(
    [
      [rot[0], rot[1], rot[2]],
      [rot[3], rot[4], rot[5]],
      [rot[6], rot[7], rot[8]],
    ],
    translation.map((x) => -x),
  )
  const centre = centreSolve ?? [0, 0, 0]
  const rms = Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / errors.length)
  if (!Number.isFinite(rms)) return null
  return {
    projection: best.map(round6),
    focalPx: { x: round6(Math.abs(intrinsics[0])), y: round6(Math.abs(intrinsics[4])) },
    principal: { u: round6(intrinsics[2]), v: round6(intrinsics[5]) },
    rotation: rot.map(round6),
    translation: translation.map(round6),
    centre: { x: round6(centre[0]), y: round6(centre[1]), z: round6(centre[2]) },
    errorsPx: errors.map(round6),
    rmsPx: round6(rms),
    maxPx: round6(Math.max(...errors)),
    inlierIds: ordered.filter((_, i) => errors[i] <= opt.tolerancePx).map((p) => p.id),
    why:
      `${ordered.length} world points, ${(spread * 100).toFixed(1)}% off coplanar, resect a camera at ` +
      `(${round6(centre[0])}, ${round6(centre[1])}, ${round6(centre[2])}) m with a ${Math.abs(intrinsics[0]).toFixed(0)} px focal length; ` +
      `they reproject ${rms.toFixed(2)} px rms and ${Math.max(...errors).toFixed(2)} px worst`,
  }
}

/** Project a world point through a solved camera. */
export const projectThrough = (solution: CameraSolution, world: { x: number; y: number; z: number }): { u: number; v: number } | null => project(solution.projection, world)

// ---------------------------------------------------------------------------
// §12. Vanishing points
// ---------------------------------------------------------------------------

export type ImageLine = { id: string; a: { u: number; v: number }; b: { u: number; v: number } }

export type VanishingPoint = {
  /** Homogeneous, so a truly parallel family can return a point at infinity without dividing by zero. */
  homogeneous: [number, number, number]
  /** And in pixels, where it is finite. */
  pixel: { u: number; v: number } | null
  /** How far each line passes from it, in pixels at the line's own midpoint. */
  errorsPx: number[]
  rmsPx: number
  why: string
}

/**
 * Where a family of parallel lines meets.
 *
 * Each line is a homogeneous vector `l = a × b`, and a point on all of them is
 * the null vector of the matrix of those lines — the same solve as a
 * homography, one dimension smaller. Lines that really are parallel in the
 * picture give a vector whose third component is near zero, which is a point
 * at infinity and correct rather than a failure, so it is returned in
 * homogeneous form and only converted to pixels where that is meaningful.
 */
export function vanishingPoint(lines: readonly ImageLine[]): VanishingPoint | null {
  if (lines.length < 2) return null
  const rows = lines.map((line) => {
    const a = [line.a.u, line.a.v, 1]
    const b = [line.b.u, line.b.v, 1]
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  })
  const v = smallestSingularVector(rows)
  if (!v) return null
  const homogeneous: [number, number, number] = [v[0], v[1], v[2]]
  const finite = Math.abs(v[2]) > 1e-9
  const pixel = finite ? { u: round6(v[0] / v[2]), v: round6(v[1] / v[2]) } : null
  // How far each line passes from the point, measured where the line is.
  const errors = rows.map((l, i) => {
    const norm = Math.hypot(l[0], l[1])
    if (norm < 1e-12) return Number.POSITIVE_INFINITY
    if (!pixel) {
      // At infinity the meaningful error is angular; express it as the
      // pixel offset it would cause over the line's own length.
      const line = lines[i]
      const length = Math.hypot(line.b.u - line.a.u, line.b.v - line.a.v)
      const direction = Math.atan2(line.b.v - line.a.v, line.b.u - line.a.u)
      const family = Math.atan2(v[1], v[0])
      const angle = Math.abs(Math.atan2(Math.sin(direction - family), Math.cos(direction - family)))
      return Math.abs(Math.sin(Math.min(angle, Math.PI - angle)) * length)
    }
    return Math.abs(l[0] * pixel.u + l[1] * pixel.v + l[2]) / norm
  })
  const rms = Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / errors.length)
  return {
    homogeneous: homogeneous.map(round6) as [number, number, number],
    pixel,
    errorsPx: errors.map(round6),
    rmsPx: round6(rms),
    why: pixel
      ? `${lines.length} lines meet at (${pixel.u.toFixed(1)}, ${pixel.v.toFixed(1)}) px, passing it by ${rms.toFixed(2)} px rms`
      : `${lines.length} lines are parallel in the picture to within ${rms.toFixed(2)} px, so their vanishing point is at infinity and this direction is not foreshortened`,
  }
}

/**
 * §12's fallback: how tall something is, from a photograph with no scale in it.
 *
 * The classic single-view construction. Given the vanishing point of the
 * vertical direction, the horizon of the ground plane, and ONE vertical of
 * known height, the height of any other vertical standing on the same ground
 * follows from a cross-ratio — no camera, no focal length and no plane fit.
 *
 * It is a fallback and it is ranked as one: it needs the horizon and the
 * vertical vanishing point to be well conditioned, and both come from line
 * families that a facade at a shallow angle barely constrains. What it must
 * never do is outrank a printed dimension.
 */
export function heightByCrossRatio(input: {
  vertical: VanishingPoint
  /** Two points on the horizon of the ground plane. */
  horizon: [{ u: number; v: number }, { u: number; v: number }]
  /** A vertical of known height: its foot, its top, and how tall it is. */
  reference: { foot: { u: number; v: number }; top: { u: number; v: number }; heightM: number }
  /** And the one being measured. */
  target: { foot: { u: number; v: number }; top: { u: number; v: number } }
}): { heightM: number; why: string } | null {
  const cross = (a: readonly number[], b: readonly number[]): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const horizonLine = cross([input.horizon[0].u, input.horizon[0].v, 1], [input.horizon[1].u, input.horizon[1].v, 1])
  const vz = input.vertical.homogeneous
  // Ratio of a vertical's image length to its true height, transferred
  // between the two feet through the horizon.
  const ratio = (foot: { u: number; v: number }, top: { u: number; v: number }): number | null => {
    const b = [foot.u, foot.v, 1]
    const t = [top.u, top.v, 1]
    const numerator = Math.hypot(t[0] / t[2] - b[0] / b[2], t[1] / t[2] - b[1] / b[2])
    const denominatorScale = Math.abs(dot(horizonLine, b)) / Math.hypot(horizonLine[0], horizonLine[1])
    const toVanishing = Math.hypot(vz[0] / (vz[2] || 1e-12) - t[0] / t[2], vz[1] / (vz[2] || 1e-12) - t[1] / t[2])
    if (!Number.isFinite(numerator) || !Number.isFinite(denominatorScale) || denominatorScale < 1e-9 || !Number.isFinite(toVanishing) || toVanishing < 1e-9) return null
    return numerator / (denominatorScale * toVanishing)
  }
  const referenceRatio = ratio(input.reference.foot, input.reference.top)
  const targetRatio = ratio(input.target.foot, input.target.top)
  if (referenceRatio === null || targetRatio === null || referenceRatio < 1e-12) return null
  const heightM = (targetRatio / referenceRatio) * input.reference.heightM
  if (!Number.isFinite(heightM) || heightM <= 0) return null
  return {
    heightM: round6(heightM),
    why:
      `by cross-ratio against a ${input.reference.heightM} m reference standing on the same ground, ` +
      `with the vertical vanishing point ${input.vertical.pixel ? `at (${input.vertical.pixel.u.toFixed(0)}, ${input.vertical.pixel.v.toFixed(0)}) px` : 'at infinity'}: ${heightM.toFixed(3)} m`,
  }
}

/** The median of a set of reprojection errors, for a caller reporting on a batch. */
export const medianError = (errors: readonly number[]): number => median(errors)
