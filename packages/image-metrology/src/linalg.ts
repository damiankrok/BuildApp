/**
 * The small amount of linear algebra this package needs, written out.
 *
 * Least squares, Gaussian elimination with partial pivoting, and a symmetric
 * eigen/SVD-substitute by inverse iteration. Nothing here is clever; it is
 * here so that a metric result never depends on a dependency's iteration
 * order, and so that a singular system fails by returning `null` rather than
 * by returning infinity and building a wall out of it.
 */

/** Solve `A x = b` for a square A by Gaussian elimination with partial pivoting. `null` when A is singular. */
export function solveLinear(a: readonly number[][], b: readonly number[]): number[] | null {
  const n = b.length
  if (a.length !== n || a.some((row) => row.length !== n)) return null
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    if (Math.abs(m[pivot][col]) < 1e-12) return null
    if (pivot !== col) {
      const swap = m[pivot]
      m[pivot] = m[col]
      m[col] = swap
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = m[row][col] / m[col][col]
      if (factor === 0) continue
      for (let k = col; k <= n; k += 1) m[row][k] -= factor * m[col][k]
    }
  }
  return m.map((row, i) => row[n] / row[i])
}

/**
 * Weighted least squares: minimise `sum_i w_i (A_i x - b_i)^2`.
 *
 * Solved through the normal equations, which is the right trade here — the
 * systems are 3 to 8 unknowns with well-conditioned image coordinates once
 * they have been centred, and a QR would buy accuracy nobody can measure at
 * the cost of code nobody can check.
 */
export function leastSquares(rows: ReadonlyArray<readonly number[]>, values: readonly number[], weights?: readonly number[]): number[] | null {
  if (rows.length === 0) return null
  const n = rows[0].length
  if (rows.length < n) return null
  const ata: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const atb: number[] = new Array<number>(n).fill(0)
  for (let i = 0; i < rows.length; i += 1) {
    const w = weights?.[i] ?? 1
    if (w === 0) continue
    const row = rows[i]
    for (let j = 0; j < n; j += 1) {
      for (let k = 0; k < n; k += 1) ata[j][k] += w * row[j] * row[k]
      atb[j] += w * row[j] * values[i]
    }
  }
  return solveLinear(ata, atb)
}

/**
 * The unit vector minimising `|A v|` — the null space of an over-determined
 * homogeneous system, which is what a homography solve comes down to.
 *
 * Found by inverse iteration on `AᵀA`: repeatedly solve `(AᵀA - εI) y = v` and
 * renormalise. For the well-conditioned, normalised systems here it converges
 * in a handful of steps, and it is deterministic because it starts from a
 * fixed vector rather than a random one.
 */
export function smallestSingularVector(rows: ReadonlyArray<readonly number[]>, iterations = 64): number[] | null {
  if (rows.length === 0) return null
  const n = rows[0].length
  const ata: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (const row of rows) {
    for (let j = 0; j < n; j += 1) for (let k = 0; k < n; k += 1) ata[j][k] += row[j] * row[k]
  }
  // A shift just inside the smallest eigenvalue makes inverse iteration pull
  // towards it. Trace/n scaled small is a safe, scale-aware choice.
  let trace = 0
  for (let j = 0; j < n; j += 1) trace += ata[j][j]
  const shift = (trace / Math.max(1, n)) * 1e-9
  const shifted = ata.map((row, j) => row.map((value, k) => (j === k ? value - shift : value)))
  let v = new Array<number>(n).fill(0).map((_, i) => 1 / Math.sqrt(n) + i * 1e-6)
  for (let step = 0; step < iterations; step += 1) {
    const next = solveLinear(shifted, v)
    if (!next) return normalise(v)
    const norm = Math.hypot(...next)
    if (!Number.isFinite(norm) || norm === 0) return normalise(v)
    const unit = next.map((x) => x / norm)
    const delta = Math.hypot(...unit.map((x, i) => x - v[i]))
    const flipped = Math.hypot(...unit.map((x, i) => x + v[i]))
    v = unit
    if (Math.min(delta, flipped) < 1e-12) break
  }
  return normalise(v)
}

const normalise = (v: readonly number[]): number[] => {
  const norm = Math.hypot(...v)
  return norm === 0 ? [...v] : v.map((x) => x / norm)
}

/** Median of a list. Used everywhere a mean would let one bad detection move a wall. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The value at a percentile, 0..1, by linear interpolation. */
export function percentileOf(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const at = Math.min(sorted.length - 1, Math.max(0, p * (sorted.length - 1)))
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)
}

/**
 * A robust scale estimate: the median absolute deviation, scaled so that on
 * clean Gaussian residuals it reads as a standard deviation.
 */
export function robustSigma(residuals: readonly number[]): number {
  if (residuals.length === 0) return 0
  const centre = median(residuals)
  return 1.4826 * median(residuals.map((r) => Math.abs(r - centre)))
}

/** Huber weights for one round of iteratively reweighted least squares. */
export function huberWeights(residuals: readonly number[], k = 1.345): number[] {
  const sigma = Math.max(1e-9, robustSigma(residuals))
  return residuals.map((r) => {
    const scaled = Math.abs(r) / sigma
    return scaled <= k ? 1 : k / scaled
  })
}
