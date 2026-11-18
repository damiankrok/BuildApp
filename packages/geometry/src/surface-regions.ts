/**
 * Surface regions: a finish rectangle on one face of a wall -> a thin skin
 * standing just proud of that face, clipped to the wall's real material.
 *
 * The skin's outline is the region's rectangle on the wall's face, bounded
 * above by the wall's own top function (a roof soffit, a gable line) and
 * along by the face's physical extent; every opening the wall carries is
 * cut out of it (clipped to the rectangle, so an opening straddling the
 * rectangle's edge becomes a notch). The outline is extruded a few
 * millimetres in front of the face — `OFFSET` clear of the wall so the two
 * surfaces never z-fight, `SKIN` thick so the skin is a closed solid a ray
 * can measure — as one manifold through the region tessellation. It is
 * appearance: non-structural, no wall volume changed, and hidden with its
 * host wall.
 */
import { openingHeadAt, wallFrame, wallPoint, type Level, type Opening, type SurfaceRegion, type Wall, type WallExtent } from '@buildapp/model'
import { extrudeLocalRegion } from './region.js'
import type { TopFunction } from './wall-compiler.js'
import type { Triangle, Vec3 } from './types.js'

/** Clearance between the wall face and the skin's back. */
export const SURFACE_REGION_OFFSET = 0.003
/** Thickness of the skin solid. */
export const SURFACE_REGION_SKIN = 0.002

const EPS = 1e-9

type AB = { a: number; b: number }

/** Sutherland–Hodgman clip of a convex polygon against an axis-aligned rectangle in (a, b). */
function clipToRect(poly: AB[], a0: number, a1: number, b0: number, b1: number): AB[] {
  const clip = (pts: AB[], inside: (p: AB) => boolean, cut: (p: AB, q: AB) => AB): AB[] => {
    const out: AB[] = []
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      const pin = inside(p)
      const qin = inside(q)
      if (pin) out.push(p)
      if (pin !== qin) out.push(cut(p, q))
    }
    return out
  }
  const lerpA = (p: AB, q: AB, a: number): AB => ({ a, b: p.b + ((a - p.a) * (q.b - p.b)) / (q.a - p.a) })
  const lerpB = (p: AB, q: AB, b: number): AB => ({ a: p.a + ((b - p.b) * (q.a - p.a)) / (q.b - p.b), b })
  let out = clip(poly, (p) => p.a >= a0 - EPS, (p, q) => lerpA(p, q, a0))
  out = clip(out, (p) => p.a <= a1 + EPS, (p, q) => lerpA(p, q, a1))
  out = clip(out, (p) => p.b >= b0 - EPS, (p, q) => lerpB(p, q, b0))
  out = clip(out, (p) => p.b <= b1 + EPS, (p, q) => lerpB(p, q, b1))
  // drop repeated points
  const dedup: AB[] = []
  for (const p of out) {
    const last = dedup[dedup.length - 1]
    if (!last || Math.abs(last.a - p.a) > EPS || Math.abs(last.b - p.b) > EPS) dedup.push(p)
  }
  if (dedup.length > 1 && Math.abs(dedup[0].a - dedup[dedup.length - 1].a) <= EPS && Math.abs(dedup[0].b - dedup[dedup.length - 1].b) <= EPS) dedup.pop()
  return dedup
}

const area = (p: readonly AB[]): number => {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const x = p[i]
    const y = p[(i + 1) % p.length]
    s += x.a * y.b - y.a * x.b
  }
  return Math.abs(s) / 2
}

/**
 * v3.54.12 — a finish on a wall's END CAP (`face` START or END): the face across the wall's thickness where its
 * material stops, e.g. the end of a wall that holds a corner and so stands in the plane of the facade it meets. The
 * rect's `a` is ACROSS the thickness here (0 = the outer face, T = the inner face), `b` up as on the faces. The cap
 * plane is the wall's resolved end cut (`extent`), so a cap hidden by the neighbour that owns the corner is skinned
 * inside it and stays invisible; nothing is drawn where the wall's material is not. Openings do not cross a cap.
 */
function compileEndCapRegion(
  out: Triangle[],
  region: SurfaceRegion,
  f: ReturnType<typeof wallFrame>,
  T: number,
  ctx: { top: TopFunction; extent: WallExtent },
): Triangle[] {
  const start = region.face === 'START'
  const cut = start ? ctx.extent.start : ctx.extent.end
  const sign = start ? -1 : 1
  const p0 = Math.max(region.rect.a0, 0)
  const p1 = Math.min(region.rect.a1, T)
  const b0 = Math.max(region.rect.b0, 0)
  if (p1 - p0 <= EPS || T <= EPS) return out
  const aAt = (p: number): number => cut.outer + ((cut.inner - cut.outer) * p) / T
  const topAt = (p: number): number => Math.min(region.rect.b1, ctx.top(aAt(p), p))
  const t0 = topAt(p0)
  const t1 = topAt(p1)
  if (Math.max(t0, t1) - b0 <= 1e-6) return out
  // local frame: a across the thickness (world −n), b up, the extrusion away from the cap along the wall's axis
  const frame = { u: { x: -f.n.x, y: -f.n.y, z: -f.n.z }, up: f.up, n: { x: -sign * f.u.x, y: -sign * f.u.y, z: -sign * f.u.z } }
  const point = (p: number, b: number, s: number): Vec3 => wallPoint(f, aAt(p) + sign * s, b, p)
  const poly: AB[] = [
    { a: p0, b: b0 },
    { a: p1, b: b0 },
    { a: p1, b: Math.max(b0, t1) },
    { a: p0, b: Math.max(b0, t0) },
  ]
  extrudeLocalRegion(out, frame, point, poly, [], SURFACE_REGION_OFFSET, SURFACE_REGION_OFFSET + SURFACE_REGION_SKIN)
  return out
}

export function compileSurfaceRegion(
  region: SurfaceRegion,
  wall: Wall,
  level: Level,
  ctx: { top: TopFunction; topBreaks: readonly number[]; openings: readonly Opening[]; extent: WallExtent },
): Triangle[] {
  const out: Triangle[] = []
  const f = wallFrame(wall, level)
  const T = wall.thickness
  if (region.face === 'START' || region.face === 'END') return compileEndCapRegion(out, region, f, T, ctx)
  const outer = region.face === 'OUTER'
  const cFace = outer ? 0 : T
  const cLo = outer ? -(SURFACE_REGION_OFFSET + SURFACE_REGION_SKIN) : T + SURFACE_REGION_OFFSET
  const cHi = outer ? -SURFACE_REGION_OFFSET : T + SURFACE_REGION_OFFSET + SURFACE_REGION_SKIN
  const faceA0 = outer ? ctx.extent.start.outer : ctx.extent.start.inner
  const faceA1 = outer ? ctx.extent.end.outer : ctx.extent.end.inner
  const a0 = Math.max(region.rect.a0, faceA0)
  const a1 = Math.min(region.rect.a1, faceA1)
  const b0 = Math.max(region.rect.b0, 0)
  const b1 = region.rect.b1
  if (a1 - a0 <= EPS || b1 - b0 <= EPS) return out
  const top = (u: number): number => ctx.top(u, cFace)

  // a-breaks: the ends, the wall's top breaks inside, and every crossing of the top with b0 / b1
  const base = [a0, a1, ...ctx.topBreaks.filter((u) => u > a0 + EPS && u < a1 - EPS)].sort((x, y) => x - y)
  const crossings: number[] = []
  for (let i = 0; i + 1 < base.length; i++) {
    for (const b of [b0, b1]) {
      const d0 = top(base[i]) - b
      const d1 = top(base[i + 1]) - b
      if ((d0 < -EPS && d1 > EPS) || (d0 > EPS && d1 < -EPS)) crossings.push(base[i] + (d0 / (d0 - d1)) * (base[i + 1] - base[i]))
    }
  }
  const breaks = [...new Set([...base, ...crossings])].sort((x, y) => x - y)

  // runs of strips where the region has height (the top above b0)
  const alive = (u: number): boolean => Math.min(b1, top(u)) > b0 + 1e-6
  const runs: Array<[number, number]> = []
  for (let i = 0; i + 1 < breaks.length; i++) {
    if (!(alive(breaks[i]) && alive(breaks[i + 1]))) continue
    const last = runs[runs.length - 1]
    if (last && Math.abs(last[1] - breaks[i]) <= EPS) last[1] = breaks[i + 1]
    else runs.push([breaks[i], breaks[i + 1]])
  }
  const point = (a: number, b: number, c: number): Vec3 => wallPoint(f, a, b, c)
  for (const [ua, ub] of runs) {
    const us = breaks.filter((u) => u >= ua - EPS && u <= ub + EPS)
    const poly: AB[] = [
      { a: ua, b: b0 },
      { a: ub, b: b0 },
    ]
    for (let i = us.length - 1; i >= 0; i--) poly.push({ a: us[i], b: Math.min(b1, top(us[i])) })
    // holes: every opening of this wall, clipped to the run's rectangle
    const holes: AB[][] = []
    for (const o of ctx.openings) {
      const hole = clipToRect(
        [
          { a: o.offset, b: o.sill },
          { a: o.offset + o.width, b: o.sill },
          { a: o.offset + o.width, b: openingHeadAt(o, o.offset + o.width) },
          { a: o.offset, b: openingHeadAt(o, o.offset) },
        ],
        ua,
        ub,
        b0,
        b1,
      )
      if (hole.length >= 3 && area(hole) > 1e-9) holes.push(hole)
    }
    extrudeLocalRegion(out, f, point, poly, holes, cLo, cHi)
  }
  return out
}
