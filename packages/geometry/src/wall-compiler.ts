/**
 * Wall compiler: one wall, its own openings, a top function, its physical
 * extent -> a closed, outward-wound solid with every opening really cut
 * through it.
 *
 * ## The idea (adapted from the reference wall-local compiler)
 *
 * A wall is described in its own frame: `a` along the wall from `start`,
 * `b` up from the wall base, `c` inward from the outer face. Nothing here
 * reads any other wall, any bounding box or any facade: a recessed wall and a
 * flush wall compile to the same local triangles.
 *
 * ## Physical extent
 *
 * The wall's material does not necessarily span its nominal `0..L`: junction
 * resolution (packages/model/src/topology.ts) states where the material
 * stops at each end, separately on the outer face and on the inner face
 * (`EndCut { outer, inner }`). Equal values give the usual end face
 * perpendicular to the wall; different values give an end cut that lies in
 * another wall's face plane, which is how corners at any angle close without
 * gap or overlap. The wall then consists of a *core* `[max(start), min(end)]`
 * that both faces share — the only place openings may be — and up to two
 * skewed *end zones* where only one face continues.
 *
 * ## Why it is watertight
 *
 * The core boundary is tiled on one grid. Breaks along `a` are the core ends,
 * every opening edge, every point where the top changes slope, and every
 * point where the top crosses a height break; breaks along `b` are the base
 * and every opening sill and head; the top boundary is the top function
 * itself. Outer and inner faces are tiled cell by cell on that grid, skipping
 * cells inside a hole and clipping cells to the top; the bottom, the top
 * ribbon and the sill/head reveals are split per strip; the jamb reveals are
 * split on the height breaks. An end zone adds one more face strip on the
 * longer face, a bottom triangle, a top triangle and the skewed end face; a
 * plain end adds the perpendicular end face. End faces are triangulated
 * between the outer and inner edge chains using only grid vertices. Two
 * faces that share an edge therefore compute it from identical local values,
 * which is what lets the manifold oracle compare vertices exactly.
 *
 * ## Top function
 *
 * `top(u, c)` is the wall's height at position `u` on the face `c` metres in
 * from the outer face. A flat wall returns a constant; a gable end returns a
 * peaked polyline; a wall that dies into a sloping roof soffit returns a
 * height that differs between its two faces, which closes the eave wedge.
 * Between two consecutive `topBreaks` the function must be linear in `u`.
 */
import { nominalExtent, wallFrame, wallPoint, type Level, type Opening, type Wall, type WallExtent, type WallFrame } from '@buildapp/model'
import { quadOut, triOut } from './primitives.js'
import { scale, type CompileDiagnostic, type Triangle, type Vec3 } from './types.js'

export type TopFunction = (u: number, c: number) => number

export type WallCompileInput = {
  wall: Wall
  level: Level
  /** Openings hosted by this wall; already validated as inside the physical core and non-overlapping. */
  openings: readonly Opening[]
  top: TopFunction
  /** `u` values where `top` changes slope, in addition to the wall ends. */
  topBreaks: readonly number[]
  /** Physical extent from topology resolution; the nominal `0..L` when absent. */
  extent?: WallExtent
}

export type WallCompileOutput = {
  frame: WallFrame
  extent: WallExtent
  /** Faces, ends, bottom and top of the wall itself. */
  wallTriangles: Triangle[]
  /** Reveal faces lining each cut opening, by opening id. */
  reveals: Map<string, Triangle[]>
  cutOpeningIds: string[]
  diagnostics: CompileDiagnostic[]
}

const EPS = 1e-9

function uniqueSorted(values: number[], lo: number, hi: number): number[] {
  const all = values.filter((x) => Number.isFinite(x) && x >= lo - EPS && x <= hi + EPS).sort((a, b) => a - b)
  const out: number[] = []
  for (const x of all) if (out.length === 0 || x - out[out.length - 1] > EPS) out.push(x)
  if (out.length > 0) {
    out[0] = lo
    out[out.length - 1] = hi
  }
  return out
}

export function compileWall(input: WallCompileInput): WallCompileOutput {
  const { wall, level, openings } = input
  const frame = wallFrame(wall, level)
  const T = wall.thickness
  const extent = input.extent ?? nominalExtent(wall)
  const diagnostics: CompileDiagnostic[] = []
  const wallTriangles: Triangle[] = []
  const reveals = new Map<string, Triangle[]>()
  const P = (a: number, b: number, c: number): Vec3 => wallPoint(frame, a, b, c)
  const up = frame.up
  const down = scale(up, -1)
  const nOut = frame.n
  const nIn = scale(frame.n, -1)
  const uPlus = frame.u
  const uMinus = scale(frame.u, -1)
  const empty = (): WallCompileOutput => ({ frame, extent, wallTriangles: [], reveals: new Map(), cutOpeningIds: [], diagnostics })

  // --- Physical core and end zones -----------------------------------------
  const A0 = Math.max(extent.start.outer, extent.start.inner)
  const A1 = Math.min(extent.end.outer, extent.end.inner)
  if (A1 - A0 <= EPS) {
    diagnostics.push({
      code: 'WALL_CONSUMED',
      severity: 'ERROR',
      message: `wall ${wall.id}: its junctions leave no material (physical core ${A0.toFixed(3)}..${A1.toFixed(3)} m); it was not compiled`,
      objectId: wall.id,
    })
    return empty()
  }
  type Zone = { at: 'start' | 'end'; face: number; other: number; uFar: number; uCore: number }
  const zones: Zone[] = []
  if (Math.abs(extent.start.outer - extent.start.inner) > EPS) {
    const face = extent.start.outer < extent.start.inner ? 0 : T
    zones.push({ at: 'start', face, other: T - face, uFar: Math.min(extent.start.outer, extent.start.inner), uCore: A0 })
  }
  if (Math.abs(extent.end.outer - extent.end.inner) > EPS) {
    const face = extent.end.outer > extent.end.inner ? 0 : T
    zones.push({ at: 'end', face, other: T - face, uFar: Math.max(extent.end.outer, extent.end.inner), uCore: A1 })
  }

  // --- Height breaks come from the openings; the top function is snapped to them ---
  const candidateBreaks = uniqueSorted([A0, A1, ...input.topBreaks, ...openings.flatMap((o) => [o.offset, o.offset + o.width])], A0, A1)

  // Accept openings whose head clears the top everywhere along their span, on both faces.
  const accepted: Opening[] = []
  for (const o of openings) {
    const a0 = o.offset
    const a1 = o.offset + o.width
    const head = o.sill + o.height
    const us = [a0, a1, ...candidateBreaks.filter((u) => u > a0 + EPS && u < a1 - EPS)]
    let lowest = Infinity
    for (const u of us) for (const c of [0, T]) lowest = Math.min(lowest, input.top(u, c))
    if (head > lowest + EPS) {
      diagnostics.push({
        code: 'OPENING_ABOVE_WALL_TOP',
        severity: 'ERROR',
        message: `opening ${o.id} reaches ${head.toFixed(3)} m above the base of wall ${wall.id}, whose top is only ${lowest.toFixed(3)} m there; the opening was not cut and not clipped`,
        objectId: o.id,
      })
      continue
    }
    accepted.push(o)
  }

  // Height breaks: the base and every sill and head. The top function is the upper boundary.
  const bBreaks: number[] = [0]
  for (const b of accepted.flatMap((o) => [o.sill, o.sill + o.height]).sort((x, y) => x - y)) {
    if (b - bBreaks[bBreaks.length - 1] > EPS) bBreaks.push(b)
  }

  // Every opening's sill and head, snapped to the canonical break values so
  // that 0.8 + 1 and 1.2 + 0.6 are the same height everywhere they are used.
  const snapB = (b: number): number => {
    for (const x of bBreaks) if (Math.abs(x - b) <= EPS) return x
    return b
  }
  const band = new Map<string, { s: number; h: number }>()
  for (const o of accepted) band.set(o.id, { s: snapB(o.sill), h: snapB(o.sill + o.height) })
  const sillOf = (o: Opening): number => band.get(o.id)!.s
  const headOf = (o: Opening): number => band.get(o.id)!.h

  const topCache = new Map<string, number>()
  const topAt = (u: number, c: number): number => {
    const key = `${u},${c}`
    const hit = topCache.get(key)
    if (hit !== undefined) return hit
    let t = input.top(u, c)
    for (const b of bBreaks) if (Math.abs(t - b) <= EPS) t = b
    topCache.set(key, t)
    return t
  }

  // The wall must have material everywhere along its physical length.
  const probes: Array<[number, number]> = candidateBreaks.flatMap((u) => [[u, 0] as [number, number], [u, T] as [number, number]])
  for (const z of zones) probes.push([z.uFar, z.face])
  for (const [u, c] of probes) {
    const t = topAt(u, c)
    if (!Number.isFinite(t) || t <= EPS) {
      diagnostics.push({
        code: 'WALL_TOP_BELOW_BASE',
        severity: 'ERROR',
        message: `wall ${wall.id}: its top is ${Number.isFinite(t) ? t.toFixed(3) : t} m above the base at u = ${u.toFixed(3)}, so the wall has no material there; it was not compiled`,
        objectId: wall.id,
      })
      return empty()
    }
  }

  /** Where the top on face `c` crosses a height break between two `u` values. */
  const crossingsBetween = (u0: number, u1: number, faces: readonly number[]): number[] => {
    const out: number[] = []
    for (const c of faces) {
      const t0 = topAt(u0, c)
      const t1 = topAt(u1, c)
      for (const b of bBreaks) {
        if (b <= 0) continue
        const d0 = t0 - b
        const d1 = t1 - b
        if ((d0 < -EPS && d1 > EPS) || (d0 > EPS && d1 < -EPS)) out.push(u0 + (d0 / (d0 - d1)) * (u1 - u0))
      }
    }
    return out
  }

  // --- a-breaks: candidates plus every crossing of the top with a height break ---
  const crossings: number[] = []
  for (let i = 0; i + 1 < candidateBreaks.length; i++) crossings.push(...crossingsBetween(candidateBreaks[i], candidateBreaks[i + 1], [0, T]))
  const aBreaks = uniqueSorted([...candidateBreaks, ...crossings], A0, A1)

  const covering = (u0: number, u1: number): Opening[] => accepted.filter((o) => o.offset <= u0 + EPS && o.offset + o.width >= u1 - EPS)
  const isVoid = (strip: Opening[], lo: number, hi: number): boolean =>
    Number.isFinite(hi) && strip.some((o) => sillOf(o) <= lo + EPS && headOf(o) >= hi - EPS)

  /** One face strip `[u0, u1]` on face `c`, split on the height breaks, skipping hole cells. */
  const tileFace = (u0: number, u1: number, c: number, strip: Opening[]): void => {
    const outward = c === 0 ? nOut : nIn
    const t0 = topAt(u0, c)
    const t1 = topAt(u1, c)
    for (let j = 0; j < bBreaks.length; j++) {
      const lo = bBreaks[j]
      const hi = j + 1 < bBreaks.length ? bBreaks[j + 1] : Infinity
      if (t0 <= lo + EPS && t1 <= lo + EPS) continue
      if (isVoid(strip, lo, hi)) continue
      const top0 = Math.min(hi, t0)
      const top1 = Math.min(hi, t1)
      quadOut(wallTriangles, P(u0, lo, c), P(u1, lo, c), P(u1, top1, c), P(u0, top0, c), outward)
    }
  }

  // --- Core: faces, bottom, top ribbon, sill and head reveals, per strip ---
  for (let i = 0; i + 1 < aBreaks.length; i++) {
    const u0 = aBreaks[i]
    const u1 = aBreaks[i + 1]
    const strip = covering(u0, u1)
    tileFace(u0, u1, 0, strip)
    tileFace(u0, u1, T, strip)
    const openToBase = strip.some((o) => sillOf(o) <= EPS)
    if (!openToBase) quadOut(wallTriangles, P(u0, 0, 0), P(u1, 0, 0), P(u1, 0, T), P(u0, 0, T), down)
    quadOut(wallTriangles, P(u0, topAt(u0, 0), 0), P(u1, topAt(u1, 0), 0), P(u1, topAt(u1, T), T), P(u0, topAt(u0, T), T), up)
    for (const o of strip) {
      const list = reveals.get(o.id) ?? []
      const s = sillOf(o)
      const h = headOf(o)
      if (s > EPS) quadOut(list, P(u0, s, 0), P(u1, s, 0), P(u1, s, T), P(u0, s, T), up)
      quadOut(list, P(u0, h, 0), P(u1, h, 0), P(u1, h, T), P(u0, h, T), down)
      reveals.set(o.id, list)
    }
  }

  // --- Jambs: split on the height breaks between sill and head ---
  for (const o of accepted) {
    const list = reveals.get(o.id) ?? []
    const s = sillOf(o)
    const h = headOf(o)
    const bs = [s, ...bBreaks.filter((b) => b > s + EPS && b < h - EPS), h]
    for (const [a, outward] of [
      [o.offset, uPlus],
      [o.offset + o.width, uMinus],
    ] as const) {
      for (let j = 0; j + 1 < bs.length; j++) {
        quadOut(list, P(a, bs[j], 0), P(a, bs[j], T), P(a, bs[j + 1], T), P(a, bs[j + 1], 0), outward)
      }
    }
    reveals.set(o.id, list)
  }

  // --- End faces: zip the outer and inner edge chains, using grid vertices only ---
  const chainAt = (u: number, c: number): Vec3[] => {
    const t = topAt(u, c)
    const hs = [0, ...bBreaks.filter((b) => b > EPS && b < t - EPS), t]
    return hs.map((b) => P(u, b, c))
  }
  const zip = (A: Vec3[], B: Vec3[], outward: Vec3): void => {
    let i = 0
    let j = 0
    const hA = A.map((p) => p.y)
    const hB = B.map((p) => p.y)
    while (i < A.length - 1 || j < B.length - 1) {
      const advanceA = j === B.length - 1 || (i < A.length - 1 && hA[i + 1] <= hB[j + 1])
      if (advanceA) {
        triOut(wallTriangles, A[i], A[i + 1], B[j], outward)
        i++
      } else {
        triOut(wallTriangles, B[j], B[j + 1], A[i], outward)
        j++
      }
    }
  }

  for (const at of ['start', 'end'] as const) {
    const outward = at === 'start' ? uMinus : uPlus
    const zone = zones.find((z) => z.at === at)
    if (!zone) {
      const u = at === 'start' ? A0 : A1
      zip(chainAt(u, 0), chainAt(u, T), outward)
      continue
    }
    // The longer face continues alone through the zone.
    const lo = Math.min(zone.uFar, zone.uCore)
    const hi = Math.max(zone.uFar, zone.uCore)
    const zoneBreaks = uniqueSorted([lo, hi, ...input.topBreaks, ...crossingsBetween(lo, hi, [zone.face])], lo, hi)
    for (let i = 0; i + 1 < zoneBreaks.length; i++) tileFace(zoneBreaks[i], zoneBreaks[i + 1], zone.face, [])
    // Bottom and top close the wedge between the two faces' ends.
    triOut(wallTriangles, P(zone.uFar, 0, zone.face), P(zone.uCore, 0, zone.face), P(zone.uCore, 0, zone.other), down)
    triOut(wallTriangles, P(zone.uFar, topAt(zone.uFar, zone.face), zone.face), P(zone.uCore, topAt(zone.uCore, zone.face), zone.face), P(zone.uCore, topAt(zone.uCore, zone.other), zone.other), up)
    // The skewed end face joins the far end of the longer face to the core end of the other face.
    const A = chainAt(zone.uFar, zone.face)
    const B = chainAt(zone.uCore, zone.other)
    zip(zone.face === 0 ? A : B, zone.face === 0 ? B : A, outward)
  }

  return { frame, extent, wallTriangles, reveals, cutOpeningIds: accepted.map((o) => o.id), diagnostics }
}
