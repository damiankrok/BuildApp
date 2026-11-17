/**
 * v3.54.7 — a step of an outline narrower than two walls is a solid return, not a ring of walls.
 *
 * A traced body outline often carries the returns that frame a recess (a loggia, a portal): the outline runs out to the
 * outer plane along the return, across its face and back to the recessed wall. Built as walls of the house's thickness
 * on each edge, a 0.65 m wide return makes three walls of 0.45 m that cross each other and the long wall beside it; the
 * kernel refuses one (`WALLS_OVERLAP`) and the openings on it go with it. A protrusion whose clear width between two
 * walls would be under `minClearM` holds no room: it is solid. It is built as ONE wall whose outer face is the step's
 * face and whose thickness is the step's depth — the return — and the ring of walls runs along the recessed line.
 *
 * Pure plan arithmetic on the polygon; no name, no number of any house.
 */
export type P2 = { x: number; z: number }
export type OutlineStep = { /** The step's face: its outer face line, in the outline's own direction. */ a: P2; b: P2; widthM: number; depthM: number }

/** The clear width a protrusion must leave between two walls to hold a room (less is solid). */
export const STEP_MIN_CLEAR_M = 0.3
/** A deeper protrusion is a wing, whatever its width. */
export const STEP_MAX_DEPTH_M = 3

const sub = (p: P2, q: P2): P2 => ({ x: p.x - q.x, z: p.z - q.z })
const len = (v: P2): number => Math.hypot(v.x, v.z)
const unit = (v: P2): P2 => {
  const l = len(v) || 1
  return { x: v.x / l, z: v.z / l }
}
const area2 = (p: readonly P2[]): number => p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].z - p[(i + 1) % p.length].x * a.z, 0)

function clean(p: P2[]): P2[] {
  let out = p.filter((q, i) => len(sub(q, p[(i + 1) % p.length])) > 1e-6)
  for (let changed = true; changed && out.length > 3; ) {
    changed = false
    for (let i = 0; i < out.length; i += 1) {
      const a = out[(i + out.length - 1) % out.length]
      const b = out[i]
      const c = out[(i + 1) % out.length]
      const u = sub(b, a)
      const v = sub(c, b)
      if (Math.abs(u.x * v.z - u.z * v.x) < 1e-6 * Math.max(1, len(u) * len(v))) {
        out = out.filter((_, k) => k !== i)
        changed = true
        break
      }
    }
  }
  return out
}

/**
 * The steps of a polygon narrower than two walls of thickness `wallM` and the clearance, and the polygon with them cut
 * back to the recessed line (`core`). A step is a face edge whose two neighbours are antiparallel and square to it, both
 * corners convex; its depth is the shorter neighbour (a step flush with a long side wall is that wall's continuation).
 */
export function outlineSteps(poly: readonly P2[], wallM: number): { core: P2[]; steps: OutlineStep[] } {
  let p = clean([...poly])
  const steps: OutlineStep[] = []
  const sign = Math.sign(area2(p)) || 1
  const maxWidth = 2 * wallM + STEP_MIN_CLEAR_M
  for (let guard = 0; guard < 16 && p.length >= 5; guard += 1) {
    let found = -1
    let depth = 0
    for (let i = 0; i < p.length; i += 1) {
      const n = p.length
      const P0 = p[(i + n - 1) % n]
      const P1 = p[i]
      const P2_ = p[(i + 1) % n]
      const P3 = p[(i + 2) % n]
      const e0 = sub(P1, P0)
      const e1 = sub(P2_, P1)
      const e2 = sub(P3, P2_)
      const w = len(e1)
      if (w > maxWidth || w < 0.05) continue
      const u0 = unit(e0)
      const u1 = unit(e1)
      const u2 = unit(e2)
      if (u0.x * u2.x + u0.z * u2.z > -0.999 || Math.abs(u0.x * u1.x + u0.z * u1.z) > 0.001) continue
      const convex = (a: P2, b: P2): boolean => Math.sign(a.x * b.z - a.z * b.x) === sign
      if (!convex(e0, e1) || !convex(e1, e2)) continue
      const d = Math.min(len(e0), len(e2))
      if (d > STEP_MAX_DEPTH_M || d < 0.05) continue
      found = i
      depth = d
      break
    }
    if (found < 0) break
    const n = p.length
    const P0 = p[(found + n - 1) % n]
    const P1 = p[found]
    const P2_ = p[(found + 1) % n]
    const P3 = p[(found + 2) % n]
    steps.push({ a: { ...P1 }, b: { ...P2_ }, widthM: len(sub(P2_, P1)), depthM: depth })
    const q1 = { x: P1.x - unit(sub(P1, P0)).x * depth, z: P1.z - unit(sub(P1, P0)).z * depth }
    const q2 = { x: P2_.x + unit(sub(P3, P2_)).x * depth, z: P2_.z + unit(sub(P3, P2_)).z * depth }
    const next = [...p]
    next[found] = q1
    next[(found + 1) % n] = q2
    p = clean(next)
  }
  return { core: p, steps }
}

export type OutlineJog = { at: P2; offsetM: number; movedLengthM: number; keptLengthM: number }

/**
 * v3.54.7 — a jog of a wall line shallower than the wall is thick (two parallel stretches joined by an edge shorter than
 * `wallM`) cannot be built: the wall that would join them has no material once its corners are resolved
 * (`WALL_CONSUMED`). The shorter stretch is moved onto the line of the longer — the plan changes by less than one wall
 * thickness, and the change is returned so that it is said.
 */
export function straightenJogs(poly: readonly P2[], wallM: number, /** A point another body stands on: a stretch through it is not moved (the neighbour would lose its wall). */ fixed: (p: P2) => boolean = () => false): { poly: P2[]; jogs: OutlineJog[] } {
  let p = clean([...poly])
  const jogs: OutlineJog[] = []
  for (let guard = 0; guard < 16 && p.length >= 5; guard += 1) {
    let done = true
    for (let i = 0; i < p.length; i += 1) {
      const n = p.length
      const P0 = p[(i + n - 1) % n]
      const P1 = p[i]
      const P2_ = p[(i + 1) % n]
      const P3 = p[(i + 2) % n]
      const e0 = sub(P1, P0)
      const e1 = sub(P2_, P1)
      const e2 = sub(P3, P2_)
      const j = len(e1)
      if (j >= wallM || j < 1e-6) continue
      const u0 = unit(e0)
      const u2 = unit(e2)
      if (u0.x * u2.x + u0.z * u2.z < 0.999) continue
      const next = [...p]
      const moveFirst = len(e0) <= len(e2)
      // the stretch that would move, sampled along: shared with another body, it stays where it is
      const moved = moveFirst ? [P0, P1] : [P2_, P3]
      if ([0, 0.25, 0.5, 0.75, 1].some((t) => fixed({ x: moved[0].x + (moved[1].x - moved[0].x) * t, z: moved[0].z + (moved[1].z - moved[0].z) * t }))) continue
      if (moveFirst) {
        // move P0..P1 by +e1 (onto the line of P2..P3)
        next[(i + n - 1) % n] = { x: P0.x + e1.x, z: P0.z + e1.z }
        next[i] = { ...P2_ }
        jogs.push({ at: { ...P1 }, offsetM: j, movedLengthM: len(e0), keptLengthM: len(e2) })
      } else {
        next[(i + 1) % n] = { ...P1 }
        next[(i + 2) % n] = { x: P3.x - e1.x, z: P3.z - e1.z }
        jogs.push({ at: { ...P2_ }, offsetM: j, movedLengthM: len(e2), keptLengthM: len(e0) })
      }
      p = clean(next)
      done = false
      break
    }
    if (done) break
  }
  return { poly: p, jogs }
}
