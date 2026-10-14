/**
 * G10 at unit level (BUILDPLAN-ANALYZER-005Q, preregistration Addendum C): `wallStripsOf` on a hand-built reading, its
 * mirror images and quarter turns, its bands in any order, and ±0.2 px perturbations of every band face and end, of the
 * extent, of the envelope and of the bodies, away from the bounds, gives the same (transformed) decision.
 *
 * End to end the decision depends on orientation, because the band claim upstream (`plan-decomposition.ts`, identical
 * in the 005Q base) breaks a face tie toward the lower pixel, so the base cuts the body on a wall's inner face in some
 * orientations and not in others (`wall-strip.test.ts` family 13, `wall-strip-invariance.test.ts`). G10 is about the
 * rule, so it is held here, on the rule's own input: a `PlanReading` reduced to the fields `wallStripsOf` and
 * `envelopeStrips` read (bands, decomposition.wallThickness.px, wallPx, extent, frame.id and the registration's
 * metres per pixel) — `tests/architecture/wall-strip.test.ts` holds that list. Chain order is not an input of the rule
 * (it reads no chain); it is held end to end in `wall-strip-invariance.test.ts`.
 *
 * The reading's numbers are points of the plane, not pixel indices: a mirror maps x to W − x for every coordinate
 * (bands, extent, envelope, bodies), a quarter turn maps (x, y) to (H − y, x) or (y, W − x) and swaps the band axes and
 * the two scales. The half-pixel conventions of a raster are upstream of the rule and not under test here.
 *
 * What a decision is: the set of sides named; for each, the gap's `what`, status, frame and reason — so its depth text
 * (metres, at the scale across the strip) and its cover (a whole percent) — and the gap id's side prefix; `backOn` on
 * every body. The cover is exposed only as the reason's whole percent, so the stretches the wall ink covers are held
 * through `backOn` itself: the strip's back edge, and at nine points along the strip the shortest probe from there
 * (each way) that covers more than a wall — found by bisection, compared to 1e-9 px after the transform.
 *
 * Four made-up readings (no house, no published figure; every dimension invented):
 *   A — two bodies on one front strip: the wall ink (two overlapping pieces) covers the house's stretch only;
 *   B — two strips, front and east, with a door gap in the front wall and a body standing on the front strip only;
 *   C — a front strip deeper than the modal wall (a 24 px front wall over 18 px walls), reachable only at unit level;
 *   D — the cover bound itself (exactly 0.25): the one place a ±0.2 px move may flip the decision.
 */
import { describe, expect, it } from 'vitest'
import { wallStripsOf } from '../src/layout.js'
import type { PlanReading, WallStrip } from '../src/layout.js'

type Rect = { x0: number; y0: number; x1: number; y1: number }
type Side = 'MIN_X' | 'MAX_X' | 'MIN_Z' | 'MAX_Z'
type Axis = 'HORIZONTAL' | 'VERTICAL'
type BandSpec = { axis: Axis; bounds: Rect }
type Case = { W: number; H: number; wallPx: number; mppX: number; mppY: number; bands: BandSpec[]; extent: Rect; envelope: Rect; bodies: Record<string, Rect> }

const FRAME = 'frame-unit'
const NAMES: Record<Side, string> = { MIN_X: 'west', MAX_X: 'east', MIN_Z: 'rear', MAX_Z: 'front' }
const SIDES: readonly Side[] = ['MAX_X', 'MAX_Z', 'MIN_X', 'MIN_Z']
const MOVE = 0.2

const H_ = (x0: number, y0: number, x1: number, y1: number): BandSpec => ({ axis: 'HORIZONTAL', bounds: { x0, y0, x1, y1 } })
const V_ = (x0: number, y0: number, x1: number, y1: number): BandSpec => ({ axis: 'VERTICAL', bounds: { x0, y0, x1, y1 } })

/** The readings: walls 18 px, a 0.012 × 0.01 m/px registration (the depth texts sit mid-way between their roundings). */
const CASES: Record<'A' | 'B' | 'C', Case> = {
  A: {
    W: 760,
    H: 600,
    wallPx: 18,
    mppX: 0.012,
    mppY: 0.01,
    extent: { x0: 60, y0: 60, x1: 660, y1: 420 },
    envelope: { x0: 60, y0: 60, x1: 660, y1: 403 },
    bands: [
      H_(60, 60, 660, 78), // the rear wall
      V_(60, 60, 78, 420), // the west wall
      V_(642, 60, 660, 420), // the east wall
      V_(300, 60, 307, 403), // a partition, 7 px: thinner than 0.7 of a wall
      H_(400, 385, 642, 402), // the garage's own front wall, its outer face on the strip's back edge
      H_(60, 403, 250, 420), // the front wall in front of the house, in two overlapping pieces
      H_(230, 403, 395, 420),
    ],
    bodies: { house: { x0: 60, y0: 60, x1: 400, y1: 403 }, garage: { x0: 400, y0: 250, x1: 660, y1: 403 }, behind: { x0: 60, y0: 60, x1: 400, y1: 200 } },
  },
  B: {
    W: 760,
    H: 600,
    wallPx: 18,
    mppX: 0.012,
    mppY: 0.01,
    extent: { x0: 60, y0: 60, x1: 660, y1: 420 },
    envelope: { x0: 60, y0: 60, x1: 642.5, y1: 403 },
    bands: [
      H_(60, 60, 660, 78),
      V_(60, 60, 78, 420),
      V_(643, 60, 660, 420), // the east wall, filling the east strip
      V_(300, 60, 307, 403),
      H_(60, 403, 472, 420), // the front wall, a 58 px door in it
      H_(530, 403, 660, 420),
    ],
    bodies: { main: { x0: 60, y0: 60, x1: 642.5, y1: 403 }, setBack: { x0: 300, y0: 250, x1: 600, y1: 403 } },
  },
  C: {
    W: 760,
    H: 600,
    wallPx: 18,
    mppX: 0.012,
    mppY: 0.01,
    extent: { x0: 60, y0: 60, x1: 660, y1: 427 },
    envelope: { x0: 60, y0: 60, x1: 660, y1: 403 },
    bands: [H_(60, 60, 660, 78), V_(60, 60, 78, 427), V_(642, 60, 660, 427), H_(60, 403, 660, 427)],
    bodies: { house: { x0: 60, y0: 60, x1: 660, y1: 403 } },
  },
}

/** The reading `wallStripsOf` is handed: only the fields it and `envelopeStrips` read; the rest of a PlanReading is never touched, hence the cast through `unknown`. */
function readingOf(c: Case): PlanReading {
  const bands = c.bands.map((b) => {
    const across = b.axis === 'HORIZONTAL' ? b.bounds.y1 - b.bounds.y0 : b.bounds.x1 - b.bounds.x0
    const along = b.axis === 'HORIZONTAL' ? b.bounds.x1 - b.bounds.x0 : b.bounds.y1 - b.bounds.y0
    const axisPx = b.axis === 'HORIZONTAL' ? (b.bounds.y0 + b.bounds.y1) / 2 : (b.bounds.x0 + b.bounds.x1) / 2
    return { axis: b.axis, bounds: { ...b.bounds }, thickness: across, length: along, fill: 1, axisPx, pieces: 1, segments: [] }
  })
  return { frame: { id: FRAME }, wallPx: c.wallPx, decomposition: { wallThickness: { px: c.wallPx } }, extent: { ...c.extent }, bands, registration: { metresPerPixelX: c.mppX, metresPerPixelY: c.mppY } } as unknown as PlanReading
}
const stripsOf = (c: Case): WallStrip[] => wallStripsOf(readingOf(c), { ...c.envelope })

// ---------------------------------------------------------------------------
// the eight symmetries of the sheet
// ---------------------------------------------------------------------------
type T = 'id' | 'mirrorX' | 'mirrorY' | 'turn90' | 'turn180' | 'turn270' | 'transpose' | 'antitranspose'
const SYMMETRIES: readonly T[] = ['id', 'mirrorX', 'mirrorY', 'turn90', 'turn180', 'turn270', 'transpose', 'antitranspose']
const swapsAxes = (t: T): boolean => t === 'turn90' || t === 'turn270' || t === 'transpose' || t === 'antitranspose'
const pointMap = (t: T, W: number, H: number) => (x: number, y: number): [number, number] => {
  switch (t) {
    case 'id':
      return [x, y]
    case 'mirrorX':
      return [W - x, y]
    case 'mirrorY':
      return [x, H - y]
    case 'turn90':
      return [H - y, x]
    case 'turn180':
      return [W - x, H - y]
    case 'turn270':
      return [y, W - x]
    case 'transpose':
      return [y, x]
    case 'antitranspose':
      return [H - y, W - x]
  }
}
const rectMap = (t: T, W: number, H: number) => (r: Rect): Rect => {
  const p = pointMap(t, W, H)
  const [ax, ay] = p(r.x0, r.y0)
  const [bx, by] = p(r.x1, r.y1)
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) }
}
/** Where a side goes: its outward normal under the transform's linear part. */
function sideAfter(t: T, side: Side): Side {
  const p = pointMap(t, 1000, 1000)
  const [ox, oy] = p(0, 0)
  const n: [number, number] = side === 'MIN_X' ? [-1, 0] : side === 'MAX_X' ? [1, 0] : side === 'MIN_Z' ? [0, -1] : [0, 1]
  const [mx, my] = p(n[0], n[1])
  const [dx, dy] = [mx - ox, my - oy]
  return dx < 0 ? 'MIN_X' : dx > 0 ? 'MAX_X' : dy < 0 ? 'MIN_Z' : 'MAX_Z'
}
function transformCase(c: Case, t: T): Case {
  const r = rectMap(t, c.W, c.H)
  const swap = swapsAxes(t)
  const axis = (a: Axis): Axis => (swap ? (a === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL') : a)
  return {
    W: swap ? c.H : c.W,
    H: swap ? c.W : c.H,
    wallPx: c.wallPx,
    mppX: swap ? c.mppY : c.mppX,
    mppY: swap ? c.mppX : c.mppY,
    bands: c.bands.map((b) => ({ axis: axis(b.axis), bounds: r(b.bounds) })),
    extent: r(c.extent),
    envelope: r(c.envelope),
    bodies: Object.fromEntries(Object.entries(c.bodies).map(([k, v]) => [k, r(v)])),
  }
}

// ---------------------------------------------------------------------------
// the decision, and what it must be after a transform
// ---------------------------------------------------------------------------
type StripDecision = { side: Side; sideName: string; what: string; status: string; frameIds: string[]; reason: string; depth: string; percent: number; idPrefix: string; backOn: Record<string, boolean> }
const REASON = /^wall-thick ink (\d+\.\d\d) m deep fills the strip between the body and the plan's extent on its (west|east|rear|front) side, along (\d+)% of that side: the body stops on that wall's inner face \(the body's own wall, or another wall layer\); the wall's outer face is not resolved, its thickness is not built there, and the strip is read as no recess, no return and no terrace$/
const idPrefixOf = (side: Side): string => `gap-outer-face-zone-${side.toLowerCase().replace('_', '-')}-`

function decisionOf(c: Case, strips: WallStrip[] = stripsOf(c)): StripDecision[] {
  return strips
    .map((s) => {
      const m = REASON.exec(s.gap.reason)
      if (!m) throw new Error(`unexpected reason: ${s.gap.reason}`)
      const prefix = idPrefixOf(s.side)
      return {
        side: s.side,
        sideName: s.sideName,
        what: s.gap.what,
        status: s.gap.status,
        frameIds: s.gap.frameIds ?? [],
        reason: s.gap.reason,
        depth: m[1],
        percent: Number(m[3]),
        idPrefix: s.gap.id.startsWith(prefix) && /^[0-9a-f]{10}$/.test(s.gap.id.slice(prefix.length)) ? prefix : s.gap.id,
        backOn: Object.fromEntries(Object.entries(c.bodies).map(([k, r]) => [k, s.backOn(r)])),
      }
    })
    .sort((p, q) => p.side.localeCompare(q.side))
}
/** The decision `d` (of a reading) as it must read after the reading is transformed by `t`. */
function transformedDecision(d: StripDecision[], t: T): StripDecision[] {
  return d
    .map((s) => {
      const side = sideAfter(t, s.side)
      const name = NAMES[side]
      return { ...s, side, sideName: name, what: s.what.replace(`’s ${s.sideName} wall`, `’s ${name} wall`), reason: s.reason.replace(`on its ${s.sideName} side`, `on its ${name} side`), idPrefix: idPrefixOf(side) }
    })
    .sort((p, q) => p.side.localeCompare(q.side))
}

// ---------------------------------------------------------------------------
// the covered stretches and the back edge, through backOn (bisection)
// ---------------------------------------------------------------------------
const isX = (side: Side): boolean => side === 'MIN_X' || side === 'MAX_X'
const backOf = (env: Rect, side: Side): number => (side === 'MIN_X' ? env.x0 : side === 'MAX_X' ? env.x1 : side === 'MIN_Z' ? env.y0 : env.y1)
const spanOf = (env: Rect, side: Side): [number, number] => (isX(side) ? [env.y0, env.y1] : [env.x0, env.x1])
/** A body whose `side` face is at `face`, running over [a, b] along the strip. */
function probe(side: Side, face: number, a: number, b: number): Rect {
  if (side === 'MAX_Z') return { x0: a, x1: b, y0: face - 50, y1: face }
  if (side === 'MIN_Z') return { x0: a, x1: b, y0: face, y1: face + 50 }
  if (side === 'MIN_X') return { x0: face, x1: face + 50, y0: a, y1: b }
  return { x0: face - 50, x1: face, y0: a, y1: b }
}
/** The boundary between `lo` (where `pred` is `atLo`) and `hi`, to the last bit. */
function bisect(pred: (v: number) => boolean, lo: number, hi: number): number {
  const atLo = pred(lo)
  let [a, b] = [lo, hi]
  for (let i = 0; i < 200 && a !== b; i += 1) {
    const m = (a + b) / 2
    if (m === a || m === b) break
    if (pred(m) === atLo) a = m
    else b = m
  }
  return (a + b) / 2
}
type Fingerprint = { side: Side; back: number | null; reach: Array<[number | null, number | null]> }
const GRID = 9
/**
 * The strip's back edge (the centre of the faces backOn accepts) and, at nine points `a` along it, the end of the
 * shortest probe from `a` forward and backward that backOn accepts (null where none does): a function of the stretches
 * the wall ink covers, to the last bit.
 */
function fingerprintOf(c: Case, s: WallStrip): Fingerprint {
  const back0 = backOf(c.envelope, s.side)
  const [s0, s1] = spanOf(c.envelope, s.side)
  const full = (face: number): boolean => s.backOn(probe(s.side, face, s0, s1))
  let back: number | null = null
  if (full(back0)) {
    const lo = bisect(full, back0 - 3 * c.wallPx, back0)
    const hi = bisect(full, back0, back0 + 3 * c.wallPx)
    back = (lo + hi) / 2
  }
  const reach: Array<[number | null, number | null]> = []
  for (let k = 0; k < GRID; k += 1) {
    const a = s0 + ((s1 - s0) * k) / (GRID - 1)
    const fwd = s.backOn(probe(s.side, back0, a, s1)) ? bisect((b) => s.backOn(probe(s.side, back0, a, b)), a, s1) : null
    const bwd = s.backOn(probe(s.side, back0, s0, a)) ? bisect((b) => s.backOn(probe(s.side, back0, b, a)), a, s0) : null
    reach.push([fwd, bwd])
  }
  return { side: s.side, back, reach }
}
/** The fingerprint `f` (of a reading) as it must read after the reading is transformed by `t`. */
function transformedFingerprint(c: Case, f: Fingerprint, t: T): Fingerprint {
  const p = pointMap(t, c.W, c.H)
  const side = sideAfter(t, f.side)
  const back0 = backOf(c.envelope, f.side)
  // a point on the back line at `along`, and its coordinates after the transform
  const at = (along: number, across: number): [number, number] => (isX(f.side) ? p(across, along) : p(along, across))
  const acrossAfter = (pt: [number, number]): number => (isX(side) ? pt[0] : pt[1])
  const alongAfter = (pt: [number, number]): number => (isX(side) ? pt[1] : pt[0])
  const [s0] = spanOf(c.envelope, f.side)
  const back = f.back === null ? null : acrossAfter(at(s0, f.back))
  const reach = f.reach.map(([fwd, bwd]) => {
    const m = (v: number | null): number | null => (v === null ? null : alongAfter(at(v, back0)))
    return [m(fwd), m(bwd)] as [number | null, number | null]
  })
  return { side, back, reach }
}
/** Two fingerprints agree: the same side, the back edge and every reach to 1e-9 px (a reach pair compared as a set: a transform may reverse the strip). */
function expectSameFingerprint(actual: Fingerprint, expected: Fingerprint, label: string): void {
  expect(actual.side, label).toBe(expected.side)
  if (expected.back === null) expect(actual.back, label).toBeNull()
  else expect(Math.abs((actual.back ?? Number.NaN) - expected.back), `${label}: back`).toBeLessThan(1e-9)
  const norm = (pair: [number | null, number | null]): Array<number | null> => [...pair].sort((p, q) => (p === null ? 1 : q === null ? -1 : p - q))
  // the grid points map onto the transformed grid in the same or the reverse order
  const mapped = expected.reach.map(norm)
  const got = actual.reach.map(norm)
  const reversed = [...got].reverse()
  const close = (xs: Array<Array<number | null>>, ys: Array<Array<number | null>>): boolean => xs.every((x, i) => x.every((v, j) => (v === null ? ys[i][j] === null : ys[i][j] !== null && Math.abs((ys[i][j] as number) - v) < 1e-9)))
  expect(close(mapped, got) || close(mapped, reversed), `${label}: reach ${JSON.stringify(got)} vs ${JSON.stringify(mapped)}`).toBe(true)
}

// ---------------------------------------------------------------------------
// perturbations
// ---------------------------------------------------------------------------
type Coord = { what: string; get: (c: Case) => number; set: (c: Case, v: number) => void }
const KEYS = ['x0', 'y0', 'x1', 'y1'] as const
function coordsOf(c: Case): Coord[] {
  const out: Coord[] = []
  c.bands.forEach((_, i) => {
    for (const k of KEYS) out.push({ what: `band ${i} ${k}`, get: (x) => x.bands[i].bounds[k], set: (x, v) => (x.bands[i].bounds[k] = v) })
  })
  for (const k of KEYS) out.push({ what: `extent ${k}`, get: (x) => x.extent[k], set: (x, v) => (x.extent[k] = v) })
  for (const k of KEYS) out.push({ what: `envelope ${k}`, get: (x) => x.envelope[k], set: (x, v) => (x.envelope[k] = v) })
  for (const name of Object.keys(c.bodies)) for (const k of KEYS) out.push({ what: `body ${name} ${k}`, get: (x) => x.bodies[name][k], set: (x, v) => (x.bodies[name][k] = v) })
  return out
}
const clone = (c: Case): Case => JSON.parse(JSON.stringify(c)) as Case
/** Every coordinate moved by a fixed pseudo-random amount in [−0.2, 0.2] px (a linear congruential walk: the same jitter on every run). */
function jittered(c: Case, seed: number): Case {
  const out = clone(c)
  let s = seed
  for (const co of coordsOf(out)) {
    s = (s * 1103515245 + 12345) % 2147483648
    co.set(out, co.get(out) + MOVE * (2 * (s / 2147483648) - 1))
  }
  return out
}
function shuffled<X>(xs: readonly X[], seed: number): X[] {
  const out = [...xs]
  let s = seed
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483648
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------------------------------------------------------------------------
// the margins: how far each reading sits from every bound of the rule, against how far ±0.2 px can move it
// ---------------------------------------------------------------------------
type Margin = { bound: string; slack: number; move: number }
function marginsOf(c: Case): Margin[] {
  const out: Margin[] = []
  const wp = c.wallPx
  const minCell = Math.max(2, c.wallPx / 2)
  for (const side of SIDES) {
    const e = c.envelope
    const x = c.extent
    const rect = side === 'MIN_Z' ? { x0: e.x0, y0: x.y0, x1: e.x1, y1: e.y0 } : side === 'MAX_Z' ? { x0: e.x0, y0: e.y1, x1: e.x1, y1: x.y1 } : side === 'MIN_X' ? { x0: x.x0, y0: e.y0, x1: e.x0, y1: e.y1 } : { x0: e.x1, y0: e.y0, x1: x.x1, y1: e.y1 }
    const dims = [rect.x1 - rect.x0, rect.y1 - rect.y0]
    const cellSlack = Math.min(...dims.map((d) => Math.abs(d - minCell)))
    out.push({ bound: `${NAMES[side]}: strip size vs max(2, wallPx/2)`, slack: cellSlack, move: 2 * MOVE })
    if (dims.some((d) => d < minCell)) continue
    const across = isX(side)
    const [e0, e1] = across ? [rect.x0, rect.x1] : [rect.y0, rect.y1]
    const [s0, s1] = across ? [rect.y0, rect.y1] : [rect.x0, rect.x1]
    const runs: Array<[number, number]> = []
    c.bands.forEach((b, i) => {
      if ((b.axis === 'VERTICAL') !== across) return
      const [f0, f1] = across ? [b.bounds.x0, b.bounds.x1] : [b.bounds.y0, b.bounds.y1]
      const [a0, a1] = across ? [b.bounds.y0, b.bounds.y1] : [b.bounds.x0, b.bounds.x1]
      const thickness = f1 - f0
      const length = a1 - a0
      const window = Math.max(5, thickness * 0.35)
      const windowMove = 0.35 * 2 * MOVE
      // each test of the band, as [slack, move, passes]
      const tests: Array<[string, number, number, boolean]> = [
        ['thickness vs 0.7 wallPx', Math.abs(thickness - 0.7 * wp), 2 * MOVE, thickness >= 0.7 * wp],
        ['length vs 2.5 wallPx', Math.abs(length - 2.5 * wp), 2 * MOVE, length >= 2.5 * wp],
        ['inner face vs window', Math.abs(window - Math.abs(f0 - e0)), 2 * MOVE + windowMove, Math.abs(f0 - e0) <= window],
        ['outer face vs window', Math.abs(window - Math.abs(f1 - e1)), 2 * MOVE + windowMove, Math.abs(f1 - e1) <= window],
        ['strip depth − thickness vs window', Math.abs(window - (e1 - e0 - thickness)), 4 * MOVE + windowMove, e1 - e0 - thickness <= window],
        ['overlap along the strip vs 0', Math.abs(Math.min(a1, s1) - Math.max(a0, s0)), 4 * MOVE, Math.min(a1, s1) > Math.max(a0, s0)],
      ]
      const passes = tests.every((t) => t[3])
      // a band that counts must keep passing every test; one that does not must keep failing at least one
      const decisive = passes ? tests : tests.filter((t) => !t[3]).sort((p, q) => q[1] - q[2] - (p[1] - p[2])).slice(0, 1)
      for (const [name, slack, move] of decisive) out.push({ bound: `${NAMES[side]}: band ${i} ${passes ? 'counts' : 'does not count'} (${name})`, slack, move })
      if (passes) runs.push([Math.max(a0, s0), Math.min(a1, s1)])
    })
    runs.sort((p, q) => p[0] - q[0])
    const covered: Array<[number, number]> = []
    for (const [a, b] of runs) {
      const last = covered[covered.length - 1]
      if (last && a <= last[1]) last[1] = Math.max(last[1], b)
      else covered.push([a, b])
    }
    const len = s1 - s0
    const coveredLength = covered.reduce((sum, [a, b]) => sum + (b - a), 0)
    const coverMove = 2 * MOVE * (covered.length + 1)
    out.push({ bound: `${NAMES[side]}: cover vs 0.25 (px of the strip)`, slack: Math.abs(coveredLength - 0.25 * len), move: coverMove })
    if (coveredLength < 0.25 * len) continue
    // a whole percent and a depth in hundredths of a metre change where the value crosses a half: the distance to the nearest one
    const toHalf = (v: number): number => Math.abs(v - Math.floor(v) - 0.5)
    const pct = (coveredLength / len) * 100
    out.push({ bound: `${NAMES[side]}: cover's whole percent vs its rounding (px)`, slack: (toHalf(pct) * len) / 100, move: coverMove })
    const mpp = across ? c.mppX : c.mppY
    out.push({ bound: `${NAMES[side]}: depth text vs its rounding (px)`, slack: (toHalf((e1 - e0) * mpp * 100) * 0.01) / mpp, move: 2 * MOVE })
    const back = side === 'MIN_X' ? rect.x1 : side === 'MAX_X' ? rect.x0 : side === 'MIN_Z' ? rect.y1 : rect.y0
    for (const [name, r] of Object.entries(c.bodies)) {
      const face = side === 'MIN_X' ? r.x0 : side === 'MAX_X' ? r.x1 : side === 'MIN_Z' ? r.y0 : r.y1
      const [r0, r1] = across ? [r.y0, r.y1] : [r.x0, r.x1]
      const along = covered.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(r1, b) - Math.max(r0, a)), 0)
      const faceOk = Math.abs(face - back) <= wp
      const alongOk = along > wp
      const faceTest: [string, number, number] = ['face vs back edge within wallPx', Math.abs(wp - Math.abs(face - back)), 2 * MOVE]
      const alongTest: [string, number, number] = ['overlap with the covered stretches vs wallPx', Math.abs(along - wp), 2 * MOVE * (covered.length + 1)]
      const tests = faceOk && alongOk ? [faceTest, alongTest] : [!faceOk ? faceTest : alongTest]
      for (const [what, slack, move] of tests) out.push({ bound: `${NAMES[side]}: body ${name} ${faceOk && alongOk ? 'on' : 'not on'} the strip (${what})`, slack, move })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// the tests
// ---------------------------------------------------------------------------
const FRONT_A = "wall-thick ink 0.17 m deep fills the strip between the body and the plan's extent on its front side, along 56% of that side: the body stops on that wall's inner face (the body's own wall, or another wall layer); the wall's outer face is not resolved, its thickness is not built there, and the strip is read as no recess, no return and no terrace"
/** What each reading decides as drawn: written out, so a rule that is consistently wrong in every orientation is caught too. */
const AS_DRAWN: Record<keyof typeof CASES, Array<Pick<StripDecision, 'side' | 'what' | 'status' | 'depth' | 'percent' | 'backOn'>>> = {
  A: [{ side: 'MAX_Z', what: 'the outer face of the building’s front wall', status: 'AMBIGUOUS', depth: '0.17', percent: 56, backOn: { house: true, garage: false, behind: false } }],
  B: [
    { side: 'MAX_X', what: 'the outer face of the building’s east wall', status: 'AMBIGUOUS', depth: '0.21', percent: 100, backOn: { main: true, setBack: false } },
    { side: 'MAX_Z', what: 'the outer face of the building’s front wall', status: 'AMBIGUOUS', depth: '0.17', percent: 90, backOn: { main: true, setBack: true } },
  ],
  C: [{ side: 'MAX_Z', what: 'the outer face of the building’s front wall', status: 'AMBIGUOUS', depth: '0.24', percent: 100, backOn: { house: true } }],
}

describe('005Q G10 (unit) — the readings as drawn', () => {
  for (const name of Object.keys(CASES) as Array<keyof typeof CASES>) {
    it(`case ${name}: the strips, their words and the bodies on them, as written out`, () => {
      const d = decisionOf(CASES[name])
      expect(d.map(({ side, what, status, depth, percent, backOn }) => ({ side, what, status, depth, percent, backOn }))).toEqual(AS_DRAWN[name])
      for (const s of d) {
        expect(s.frameIds).toEqual([FRAME])
        expect(s.idPrefix).toBe(idPrefixOf(s.side))
        expect(s.sideName).toBe(NAMES[s.side])
      }
    })
    it(`case ${name}: backOn’s back edge is the envelope’s side (to 1e-9 px), and a body is on the strip exactly within a wall of it`, () => {
      for (const s of stripsOf(CASES[name])) {
        const f = fingerprintOf(CASES[name], s)
        expect(f.back, s.side).not.toBeNull()
        expect(Math.abs((f.back ?? 0) - backOf(CASES[name].envelope, s.side)), s.side).toBeLessThan(1e-9)
      }
    })
  }
  it('case A: the reason, whole', () => {
    expect(stripsOf(CASES.A).map((s) => s.gap.reason)).toEqual([FRONT_A])
  })
})

describe('005Q G10 (unit) — every reading sits away from every bound by more than ±0.2 px can move it', () => {
  for (const name of Object.keys(CASES) as Array<keyof typeof CASES>) {
    const margins = marginsOf(CASES[name])
    const tightest = [...margins].sort((p, q) => p.slack - p.move - (q.slack - q.move))[0]
    it(`case ${name}: ${margins.length} bounds, the tightest ${tightest.slack.toFixed(2)} px from its bound where ±0.2 px moves it at most ${tightest.move.toFixed(2)} px (${tightest.bound})`, () => {
      for (const m of margins) expect(m.slack, `${m.bound}: slack ${m.slack} px, move ${m.move} px`).toBeGreaterThan(m.move)
    })
  }
})

describe('005Q G10 (unit) — mirrored, turned and transposed: the same decision, transformed', () => {
  for (const name of Object.keys(CASES) as Array<keyof typeof CASES>) {
    const base = CASES[name]
    const decision = decisionOf(base)
    const fingerprints = stripsOf(base).map((s) => fingerprintOf(base, s))
    for (const t of SYMMETRIES) {
      it(`case ${name}, ${t}: the sides named, the words (depth and cover), the gap id's side, backOn on every body, and the covered stretches and back edge to 1e-9 px`, () => {
        const c = transformCase(base, t)
        const strips = stripsOf(c)
        expect(decisionOf(c, strips)).toEqual(transformedDecision(decision, t))
        const got = strips.map((s) => fingerprintOf(c, s))
        const want = fingerprints.map((f) => transformedFingerprint(base, f, t)).sort((p, q) => p.side.localeCompare(q.side))
        got.sort((p, q) => p.side.localeCompare(q.side))
        expect(got.map((f) => f.side)).toEqual(want.map((f) => f.side))
        got.forEach((f, i) => expectSameFingerprint(f, want[i], `${name} ${t} ${f.side}`))
      })
    }
  }

  it('the eight symmetries map the four sides as the sheet does (front ↔ rear under a top–bottom mirror, front → west under a quarter turn clockwise on screen, …)', () => {
    expect(SIDES.map((s) => sideAfter('mirrorX', s))).toEqual(['MIN_X', 'MAX_Z', 'MAX_X', 'MIN_Z'])
    expect(SIDES.map((s) => sideAfter('mirrorY', s))).toEqual(['MAX_X', 'MIN_Z', 'MIN_X', 'MAX_Z'])
    expect(SIDES.map((s) => sideAfter('turn90', s))).toEqual(['MAX_Z', 'MIN_X', 'MIN_Z', 'MAX_X'])
    expect(SIDES.map((s) => sideAfter('turn270', s))).toEqual(['MIN_Z', 'MAX_X', 'MAX_Z', 'MIN_X'])
    expect(SIDES.map((s) => sideAfter('turn180', s))).toEqual(['MIN_X', 'MIN_Z', 'MAX_X', 'MAX_Z'])
    // and the readings exercise every side once transformed: all four sides are named somewhere
    const named = new Set(SYMMETRIES.flatMap((t) => (Object.keys(CASES) as Array<keyof typeof CASES>).flatMap((n) => stripsOf(transformCase(CASES[n], t)).map((s) => s.side))))
    expect([...named].sort()).toEqual(['MAX_X', 'MAX_Z', 'MIN_X', 'MIN_Z'])
  })
})

describe('005Q G10 (unit) — the bands in any order', () => {
  for (const name of Object.keys(CASES) as Array<keyof typeof CASES>) {
    const base = CASES[name]
    const strips = stripsOf(base)
    const fingerprints = strips.map((s) => fingerprintOf(base, s))
    for (const [order, f] of [
      ['reversed', (bs: BandSpec[]) => [...bs].reverse()],
      ['rotated by one', (bs: BandSpec[]) => [...bs.slice(1), ...bs.slice(0, 1)]],
      ['shuffled (seed 7)', (bs: BandSpec[]) => shuffled(bs, 7)],
      ['shuffled (seed 1009)', (bs: BandSpec[]) => shuffled(bs, 1009)],
      ['shuffled (seed 65537)', (bs: BandSpec[]) => shuffled(bs, 65537)],
    ] as const) {
      it(`case ${name}, bands ${order}: the same decision, the same gap ids, the same covered stretches to the bit`, () => {
        const c = { ...base, bands: f(base.bands) }
        const again = stripsOf(c)
        expect(decisionOf(c, again)).toEqual(decisionOf(base, strips))
        expect(again.map((s) => s.gap)).toEqual(strips.map((s) => s.gap))
        expect(again.map((s) => fingerprintOf(c, s))).toEqual(fingerprints)
      })
    }
  }
})

describe('005Q G10 (unit) — ±0.2 px at the face-pair tolerances, away from the bounds', () => {
  for (const name of Object.keys(CASES) as Array<keyof typeof CASES>) {
    const base = CASES[name]
    const decision = decisionOf(base)
    const coords = coordsOf(base)
    it(`case ${name}: each of its ${coords.length} coordinates (every band face and end, the extent, the envelope, every body) moved by +0.2 and by −0.2 px alone: the same decision`, () => {
      for (const co of coords) {
        for (const delta of [MOVE, -MOVE]) {
          const c = clone(base)
          co.set(c, co.get(c) + delta)
          expect(decisionOf(c), `${co.what} ${delta > 0 ? '+' : ''}${delta}`).toEqual(decision)
        }
      }
    })
    it(`case ${name}: every coordinate jittered at once within ±0.2 px (twelve seeds), as drawn and under the eight symmetries: the same (transformed) decision, and the transformed covered stretches of the jittered reading to 1e-9 px`, () => {
      for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]) {
        const j = jittered(base, seed)
        const jd = decisionOf(j)
        expect(jd, `seed ${seed}`).toEqual(decision)
        const jf = stripsOf(j).map((s) => fingerprintOf(j, s))
        for (const t of SYMMETRIES) {
          const c = transformCase(j, t)
          const strips = stripsOf(c)
          expect(decisionOf(c, strips), `seed ${seed} ${t}`).toEqual(transformedDecision(decision, t))
          const got = strips.map((s) => fingerprintOf(c, s)).sort((p, q) => p.side.localeCompare(q.side))
          const want = jf.map((f) => transformedFingerprint(j, f, t)).sort((p, q) => p.side.localeCompare(q.side))
          got.forEach((f, i) => expectSameFingerprint(f, want[i], `seed ${seed} ${t} ${f.side}`))
        }
      }
    })
  }
})

describe('005Q G10 (unit) — at a bound, and only there, ±0.2 px may flip the decision', () => {
  // D: the front strip of case A with one piece of wall, 150 of the strip's 600 px: a cover of exactly 0.25 (the bound
  // is inclusive). A move of the piece's end by +0.2 px keeps it (150.2 px), −0.2 px drops it (149.8 px, 24.97 %). That
  // is what a bound is; G10 asks for the same decision away from the bounds, and every symmetry of the reading at the
  // bound still gives the same decision as the reading itself.
  const D: Case = { ...CASES.A, bands: [H_(60, 60, 660, 78), V_(60, 60, 78, 420), V_(642, 60, 660, 420), H_(60, 403, 210, 420)], bodies: { house: { x0: 60, y0: 60, x1: 660, y1: 403 } } }
  it('case D: a cover of exactly 0.25 names the strip (25%); the piece 0.2 px longer still does, 0.2 px shorter does not', () => {
    expect(decisionOf(D).map((s) => [s.side, s.percent])).toEqual([['MAX_Z', 25]])
    const longer = clone(D)
    longer.bands[3].bounds.x1 += MOVE
    expect(decisionOf(longer).map((s) => [s.side, s.percent])).toEqual([['MAX_Z', 25]])
    const shorter = clone(D)
    shorter.bands[3].bounds.x1 -= MOVE
    expect(decisionOf(shorter)).toEqual([])
  })
  it('case D: at the bound, the eight symmetries still agree (the rule is symmetric even where it is on the edge)', () => {
    const d = decisionOf(D)
    for (const t of SYMMETRIES) expect(decisionOf(transformCase(D, t)), t).toEqual(transformedDecision(d, t))
  })
  it('case A: a body whose stretch overlaps the covered one by exactly a wall (18 px) is not on the strip; 0.2 px more and it is', () => {
    const edge = { ...CASES.A, bodies: { edge: { x0: 377, y0: 250, x1: 660, y1: 403 } } }
    expect(decisionOf(edge).map((s) => s.backOn)).toEqual([{ edge: false }])
    const more = clone(edge)
    more.bodies.edge.x0 -= MOVE
    expect(decisionOf(more).map((s) => s.backOn)).toEqual([{ edge: true }])
  })
})
