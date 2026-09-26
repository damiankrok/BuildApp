/**
 * Roof compiler: GABLE and FLAT, with structural roof openings.
 *
 * A gable is built from the eave height, the pitch and the footprint's
 * half-span; the ridge height is a consequence. Both slopes are emitted as one
 * closed solid: the two slabs meet at the ridge, so the internal ridge faces
 * are not emitted and the whole roof is a single manifold prism with a
 * chevron cross-section. Thickness is perpendicular to the slope: a vertical
 * drop of `t / cos(pitch)` is a perpendicular depth of `t`.
 *
 * ## Roof openings
 *
 * A `RoofOpening` removes the vertical prism over its plan rectangle from the
 * roof. Each slope (or the flat plate) is tiled on a grid in plan
 * coordinates — `along` the ridge, `cross` it — whose breaks are the hole
 * edges: bands across the slope at every hole's cross edges, and inside a band
 * that holds holes, cells at their along edges. A band without holes is one
 * cell, so the eave, ridge and gable-end edges stay single segments wherever
 * no hole touches them; the gable end faces are split on the same bands, so
 * every shared edge is computed from identical values and the solid stays
 * watertight. A hole's four reveals are vertical quads between the top
 * surface and the underside; they belong to the opening and close the roof's
 * solid, exactly like wall reveals. Because the prism is vertical, the hole
 * has the same plan outline on the top surface and on the underside, and a
 * chimney whose footprint is the hole passes through without sharing volume.
 *
 * A hole cut NORMAL_TO_ROOF has sides perpendicular to the roof plane: its
 * underside outline is the footprint shifted uphill by `t · sin pitch`
 * (`roofOpeningUndersideShift`, model package), so both outlines are breaks
 * of the same grid, the top surface skips the footprint's cells and the
 * underside skips the shifted ones. The reveals across the ridge direction
 * are tilted quads between the two outlines (planar: both edges run along
 * the ridge); the reveals at the hole's along-ends are one planar polygon
 * each, zipped between the top and underside edge chains, so every vertex
 * is shared with the cells beside it. A VERTICAL cut is the shift-zero case
 * and compiles exactly as before.
 *
 * `roofGeometry` also exposes the roof's underside as a function of plan
 * position, which is what lets a wall die into the roof (FOLLOW_ROOF).
 */
import { roofOpeningUndersideShift, type Level, type PlanRect, type Roof, type RoofOpening, type Vec2, type RoofEdgeSide } from '@buildapp/model'
import { quadOut, triOut, worldBox } from './primitives.js'
import { v3, type Triangle, type Vec3 } from './types.js'

export type RoofGeometry = {
  kind: Roof['kind']
  /** World y of the top surface at the footprint edge. */
  eaveY: number
  /** World y of the ridge (== eaveY for a flat roof). */
  ridgeY: number
  slope: number
  pitchDeg: number
  /** Vertical distance between the top surface and the underside. */
  verticalDrop: number
  /** Plan rectangle actually covered, overhang included. */
  covered: { minX: number; maxX: number; minZ: number; maxZ: number }
  covers(x: number, z: number): boolean
  /** World y of the top surface; only meaningful where `covers`. */
  topAt(x: number, z: number): number
  /** World y of the underside; only meaningful where `covers`. */
  undersideAt(x: number, z: number): number
  /**
   * Plan lines across which the underside changes slope (the ridge), or
   * changes level (the inner edge of a verge or fascia strip), as
   * `{ axis, value }`: the line `z = value` when axis is 'Z', `x = value`
   * when axis is 'X'.
   */
  creaseLines: Array<{ axis: 'X' | 'Z'; value: number }>
  /** The plate: the covered rectangle less the edge members' strips and the plate insets. */
  plate: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** The strips the edge members occupy, in plan, each with the member's underside height at a point in it. */
  memberStrips: Array<{ kind: 'VERGE' | 'FASCIA'; side: RoofEdgeSide; minX: number; maxX: number; minZ: number; maxZ: number; undersideAt: (x: number, z: number) => number }>
}

export function roofGeometry(roof: Roof, level: Level): RoofGeometry {
  const f = roof.footprint
  const oh = roof.overhang
  const eaveY = level.elevation + roof.eaveOffset
  const covered = { minX: f.minX - oh, maxX: f.maxX + oh, minZ: f.minZ - oh, maxZ: f.maxZ + oh }
  const covers = (x: number, z: number): boolean => x >= covered.minX - 1e-9 && x <= covered.maxX + 1e-9 && z >= covered.minZ - 1e-9 && z <= covered.maxZ + 1e-9
  const flat = roof.kind === 'FLAT'
  const slope = flat ? 0 : Math.tan((roof.pitchDeg * Math.PI) / 180)
  const alongX = flat ? true : roof.ridgeAxis === 'X'
  const crossMin = alongX ? f.minZ : f.minX
  const crossMax = alongX ? f.maxZ : f.maxX
  const mid = (crossMin + crossMax) / 2
  const halfSpan = (crossMax - crossMin) / 2
  const ridgeY = flat ? eaveY : eaveY + halfSpan * slope
  const verticalDrop = flat ? roof.thickness : roof.thickness / Math.cos((roof.pitchDeg * Math.PI) / 180)
  const topAt = (x: number, z: number): number => {
    if (flat) return eaveY
    const cross = alongX ? z : x
    return eaveY + (halfSpan - Math.abs(cross - mid)) * slope
  }
  const plateUnderside = (x: number, z: number): number => topAt(x, z) - verticalDrop

  // The edge members' strips, and what stands under each: a wall under a
  // verge or fascia board stops at the board's underside, not the plate's.
  const strips: RoofGeometry['memberStrips'] = []
  const creaseLines: RoofGeometry['creaseLines'] = flat ? [] : [{ axis: alongX ? 'Z' : 'X', value: mid }]
  const plate = { ...covered }
  const sideOf = (side: RoofEdgeSide): { axis: 'X' | 'Z'; edge: number; inward: 1 | -1 } => (side === 'MIN_X' ? { axis: 'X', edge: covered.minX, inward: 1 } : side === 'MAX_X' ? { axis: 'X', edge: covered.maxX, inward: -1 } : side === 'MIN_Z' ? { axis: 'Z', edge: covered.minZ, inward: 1 } : { axis: 'Z', edge: covered.maxZ, inward: -1 })
  const stripRect = (side: RoofEdgeSide, depth: number): { minX: number; maxX: number; minZ: number; maxZ: number } => {
    const { axis, edge, inward } = sideOf(side)
    const inner = edge + inward * depth
    return axis === 'X' ? { minX: Math.min(edge, inner), maxX: Math.max(edge, inner), minZ: covered.minZ, maxZ: covered.maxZ } : { minX: covered.minX, maxX: covered.maxX, minZ: Math.min(edge, inner), maxZ: Math.max(edge, inner) }
  }
  const shrink = (side: RoofEdgeSide, by: number): void => {
    if (side === 'MIN_X') plate.minX += by
    else if (side === 'MAX_X') plate.maxX -= by
    else if (side === 'MIN_Z') plate.minZ += by
    else plate.maxZ -= by
    const { axis, edge, inward } = sideOf(side)
    creaseLines.push({ axis, value: edge + inward * by })
  }
  const verge = roof.edgeMembers?.verge
  if (verge && !flat) {
    for (const end of vergeEnds(roof)) {
      strips.push({ kind: 'VERGE', side: end.side, ...stripRect(end.side, end.depth), undersideAt: (x, z) => topAt(x, z) - end.width })
      shrink(end.side, end.depth)
    }
  }
  const fascia = roof.edgeMembers?.fascia
  if (fascia) {
    for (const side of fascia.sides) {
      const bottom = eaveY + fascia.topOffset - fascia.height
      strips.push({ kind: 'FASCIA', side, ...stripRect(side, fascia.depth), undersideAt: () => bottom })
      shrink(side, fascia.depth)
    }
  }
  for (const side of ['MIN_X', 'MAX_X', 'MIN_Z', 'MAX_Z'] as const) {
    const by = roof.plateInset?.[side === 'MIN_X' ? 'minX' : side === 'MAX_X' ? 'maxX' : side === 'MIN_Z' ? 'minZ' : 'maxZ']
    if (by !== undefined && by > 0) shrink(side, by)
  }
  const inStrip = (s: RoofGeometry['memberStrips'][number], x: number, z: number): boolean => x >= s.minX - 1e-9 && x <= s.maxX + 1e-9 && z >= s.minZ - 1e-9 && z <= s.maxZ + 1e-9
  const undersideAt = (x: number, z: number): number => {
    let y = plateUnderside(x, z)
    for (const strip of strips) if (inStrip(strip, x, z)) y = Math.min(y, strip.undersideAt(x, z))
    return y
  }
  return {
    kind: flat ? 'FLAT' : 'GABLE',
    eaveY,
    ridgeY,
    slope,
    pitchDeg: flat ? 0 : roof.pitchDeg,
    verticalDrop,
    covered,
    covers,
    topAt,
    undersideAt,
    creaseLines,
    plate,
    memberStrips: strips,
  }
}

export type RoofTrim = { id: string; kind: 'VERGE' | 'FASCIA'; side: RoofEdgeSide; triangles: Triangle[]; materialId?: string }

export type RoofCompileOutput = {
  /** Faces of the roof plate itself. */
  triangles: Triangle[]
  /** Reveal faces lining each cut roof opening, by opening id. */
  reveals: Map<string, Triangle[]>
  cutOpeningIds: string[]
  geometry: RoofGeometry
  /** The edge members, one closed solid each, compiled from the same geometry as the plate they trim. */
  trims: RoofTrim[]
}

const EPS = 1e-9

function uniqueSorted(values: number[]): number[] {
  const all = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const x of all) if (out.length === 0 || x - out[out.length - 1] > EPS) out.push(x)
  return out
}

/** A hole in plate coordinates: `a` along the ridge, `c` across; `shift` moves the underside outline across (a normal cut), 0 for a vertical cut. */
type Hole = { id: string; a0: number; a1: number; c0: number; c1: number; shift: number }

/**
 * One plate — a slope of a gable or a flat roof — in plan coordinates `along`
 * (with the ridge / any axis) and `cross`, with a top surface `topY(cross)`
 * that is linear in `cross`, a vertical thickness `drop`, and rectangular
 * holes. Emits the top and underside faces, the two end faces at `along0` and
 * `along1`, and the reveals of every hole. The faces across the plate at
 * `cross0` / `cross1` are the caller's (an eave face; nothing at a ridge).
 */
function tilePlate(
  out: Triangle[],
  reveals: Map<string, Triangle[]>,
  p: {
    along0: number
    along1: number
    cross0: number
    cross1: number
    holes: Hole[]
    /** Every along-break of the whole roof (all holes on every slope), so bands, slopes and eave faces split their shared edges identically. */
    alongBreaks: number[]
    topY: (cross: number) => number
    drop: number
    P: (along: number, cross: number, y: number) => Vec3
    outTop: Vec3
    alongDir: Vec3
    crossDir: Vec3
  },
): void {
  const crossBreaks = uniqueSorted([p.cross0, p.cross1, ...p.holes.flatMap((h) => [h.c0, h.c1, h.c0 + h.shift, h.c1 + h.shift])])
  const ys = crossBreaks.map((c) => p.topY(c))
  const snap = (v: number, list: number[]): number => list.find((x) => Math.abs(x - v) <= EPS) ?? v
  const alongBreaks = p.alongBreaks
  const holes = p.holes.map((h) => ({
    ...h,
    a0: snap(h.a0, alongBreaks),
    a1: snap(h.a1, alongBreaks),
    c0: snap(h.c0, crossBreaks),
    c1: snap(h.c1, crossBreaks),
    u0: snap(h.c0 + h.shift, crossBreaks),
    u1: snap(h.c1 + h.shift, crossBreaks),
  }))
  const neg = (a: Vec3): Vec3 => v3(-a.x, -a.y, -a.z)
  const outBottom = neg(p.outTop)
  const yOf = (c: number): number => ys[crossBreaks.indexOf(c)]
  for (let k = 0; k + 1 < crossBreaks.length; k++) {
    const c0 = crossBreaks[k]
    const c1 = crossBreaks[k + 1]
    const y0 = ys[k]
    const y1 = ys[k + 1]
    const topInBand = holes.filter((h) => h.c0 <= c0 + EPS && h.c1 >= c1 - EPS)
    const underInBand = holes.filter((h) => h.u0 <= c0 + EPS && h.u1 >= c1 - EPS)
    for (let i = 0; i + 1 < alongBreaks.length; i++) {
      const a0 = alongBreaks[i]
      const a1 = alongBreaks[i + 1]
      const mid = (a0 + a1) / 2
      if (!topInBand.some((h) => h.a0 <= mid && mid <= h.a1)) quadOut(out, p.P(a0, c0, y0), p.P(a1, c0, y0), p.P(a1, c1, y1), p.P(a0, c1, y1), p.outTop)
      if (!underInBand.some((h) => h.a0 <= mid && mid <= h.a1)) quadOut(out, p.P(a0, c0, y0 - p.drop), p.P(a1, c0, y0 - p.drop), p.P(a1, c1, y1 - p.drop), p.P(a0, c1, y1 - p.drop), outBottom)
    }
    // End faces at along0 and along1, one per band so they share the top and underside edges exactly.
    quadOut(out, p.P(p.along0, c0, y0), p.P(p.along0, c1, y1), p.P(p.along0, c1, y1 - p.drop), p.P(p.along0, c0, y0 - p.drop), neg(p.alongDir))
    quadOut(out, p.P(p.along1, c0, y0), p.P(p.along1, c1, y1), p.P(p.along1, c1, y1 - p.drop), p.P(p.along1, c0, y0 - p.drop), p.alongDir)
  }
  // Reveals: faces around each hole, facing into it, split on the same breaks
  // as the cells beside them so that every edge is shared exactly. Across the
  // ridge direction they run from the top outline down to the underside
  // outline (vertical for a vertical cut, tilted for a normal cut); at the
  // hole's along-ends they are one planar polygon zipped between the top and
  // underside edge chains.
  for (const h of holes) {
    const list = reveals.get(h.id) ?? []
    const as = alongBreaks.filter((a) => a >= h.a0 - EPS && a <= h.a1 + EPS)
    for (let i = 0; i + 1 < as.length; i++) {
      quadOut(list, p.P(as[i], h.c0, yOf(h.c0)), p.P(as[i + 1], h.c0, yOf(h.c0)), p.P(as[i + 1], h.u0, yOf(h.u0) - p.drop), p.P(as[i], h.u0, yOf(h.u0) - p.drop), p.crossDir)
      quadOut(list, p.P(as[i], h.c1, yOf(h.c1)), p.P(as[i + 1], h.c1, yOf(h.c1)), p.P(as[i + 1], h.u1, yOf(h.u1) - p.drop), p.P(as[i], h.u1, yOf(h.u1) - p.drop), neg(p.crossDir))
    }
    const topChain = crossBreaks.filter((c) => c >= h.c0 - EPS && c <= h.c1 + EPS)
    const underChain = crossBreaks.filter((c) => c >= h.u0 - EPS && c <= h.u1 + EPS)
    for (const [a, outward] of [
      [h.a0, p.alongDir],
      [h.a1, neg(p.alongDir)],
    ] as const) {
      const T = topChain.map((c) => ({ c, pt: p.P(a, c, yOf(c)) }))
      const U = underChain.map((c) => ({ c, pt: p.P(a, c, yOf(c) - p.drop) }))
      let i = 0
      let j = 0
      while (i < T.length - 1 || j < U.length - 1) {
        const advanceT = j === U.length - 1 || (i < T.length - 1 && T[i + 1].c <= U[j + 1].c)
        if (advanceT) {
          triOut(list, T[i].pt, T[i + 1].pt, U[j].pt, outward)
          i++
        } else {
          triOut(list, T[i].pt, U[j + 1].pt, U[j].pt, outward)
          j++
        }
      }
    }
    reveals.set(h.id, list)
  }
}

/** The roof as one closed solid, with every roof opening cut through it. */
export function compileRoofTriangles(roof: Roof, level: Level, openings: readonly RoofOpening[] = []): RoofCompileOutput {
  const g = roofGeometry(roof, level)
  const out: Triangle[] = []
  const reveals = new Map<string, Triangle[]>()
  const trims = compileRoofTrims(roof, g)
  // The plate bears on its walls and stops where its edge members begin.
  const c = g.plate
  const alongX = roof.kind === 'FLAT' ? true : roof.ridgeAxis === 'X'
  const P = (along: number, cross: number, y: number): Vec3 => (alongX ? v3(along, y, cross) : v3(cross, y, along))
  const alongDir = alongX ? v3(1, 0, 0) : v3(0, 0, 1)
  const crossDir = alongX ? v3(0, 0, 1) : v3(1, 0, 0)
  const along0 = alongX ? c.minX : c.minZ
  const along1 = alongX ? c.maxX : c.maxZ
  const cross0 = alongX ? c.minZ : c.minX
  const cross1 = alongX ? c.maxZ : c.maxX
  const holeOf = (o: RoofOpening): Hole => {
    const sh = roofOpeningUndersideShift(roof, o)
    return {
      id: o.id,
      a0: alongX ? o.footprint.minX : o.footprint.minZ,
      a1: alongX ? o.footprint.maxX : o.footprint.maxZ,
      c0: alongX ? o.footprint.minZ : o.footprint.minX,
      c1: alongX ? o.footprint.maxZ : o.footprint.maxX,
      shift: alongX ? sh.dz : sh.dx,
    }
  }
  const holes = openings.map(holeOf)
  const drop = g.verticalDrop
  const alongBreaks = uniqueSorted([along0, along1, ...holes.flatMap((h) => [h.a0, h.a1])])
  /** A face across the plate at one cross value, split at every along-break so it shares the plate's edge vertex for vertex. */
  const crossFace = (cross: number, yTop: number, outward: Vec3): void => {
    for (let i = 0; i + 1 < alongBreaks.length; i++) {
      const a0 = alongBreaks[i]
      const a1 = alongBreaks[i + 1]
      quadOut(out, P(a0, cross, yTop - drop), P(a1, cross, yTop - drop), P(a1, cross, yTop), P(a0, cross, yTop), outward)
    }
  }

  if (roof.kind === 'FLAT') {
    const y1 = g.eaveY
    tilePlate(out, reveals, { along0, along1, cross0, cross1, holes, alongBreaks, topY: () => y1, drop, P, outTop: v3(0, 1, 0), alongDir, crossDir })
    // the two faces across the plate
    crossFace(cross0, y1, v3(-crossDir.x, 0, -crossDir.z))
    crossFace(cross1, y1, crossDir)
    return { triangles: out, reveals, cutOpeningIds: openings.map((o) => o.id), geometry: g, trims }
  }

  const mid = (cross0 + cross1) / 2
  const topOf = (cross: number): number => (alongX ? g.topAt(0, cross) : g.topAt(cross, 0))
  const eaveTop = topOf(cross0) // the same at cross1 by symmetry, and used for both so the two eaves share one value
  const ridgeTop = g.ridgeY

  for (const side of [-1, 1] as const) {
    const eaveCross = side < 0 ? cross0 : cross1
    // Top slope surface: outward is up and towards the eave. Underside: down and towards the ridge.
    const outTop = v3(crossDir.x * side, 1, crossDir.z * side)
    const slopeHoles = holes.filter((h) => (side < 0 ? Math.max(h.c1, h.c1 + h.shift) <= mid + EPS : Math.min(h.c0, h.c0 + h.shift) >= mid - EPS))
    // The eave and ridge values are the shared ones, so the eave face and the other slope compute identical vertices.
    const topY = (cross: number): number => (cross === eaveCross ? eaveTop : cross === mid ? ridgeTop : topOf(cross))
    tilePlate(out, reveals, {
      along0,
      along1,
      cross0: side < 0 ? cross0 : mid,
      cross1: side < 0 ? mid : cross1,
      holes: slopeHoles,
      alongBreaks,
      topY,
      drop,
      P,
      outTop,
      alongDir,
      crossDir,
    })
    // Eave end face: vertical, outward along ±cross.
    crossFace(eaveCross, eaveTop, v3(crossDir.x * side, 0, crossDir.z * side))
  }
  return { triangles: out, reveals, cutOpeningIds: openings.map((o) => o.id), geometry: g, trims }
}

/**
 * The edge members as closed solids.
 *
 * A verge is a chevron-section board at a gable end: its top follows both
 * slopes from eave to ridge to eave, its underside lies `width` below
 * (vertically), it is `depth` deep along the ridge, and its outer face
 * stands in the plane of the gable end — the plane the return walls under
 * it share. A fascia is a plain board along a named edge, `depth` deep into
 * the footprint, from `height` below its top to `topOffset` above the plate.
 */
export function compileRoofTrims(roof: Roof, g: RoofGeometry): RoofTrim[] {
  const trims: RoofTrim[] = []
  const members = roof.edgeMembers
  if (!members) return trims
  const c = g.covered
  const flat = roof.kind === 'FLAT'
  const alongX = flat ? true : roof.ridgeAxis === 'X'
  if (members.verge && !flat) {
    const v = members.verge
    const ends = vergeEnds(roof).map((end) => ({ ...end, e: end.side === 'MIN_X' ? c.minX : end.side === 'MAX_X' ? c.maxX : end.side === 'MIN_Z' ? c.minZ : c.maxZ, inward: (end.side === 'MIN_X' || end.side === 'MIN_Z' ? 1 : -1) as 1 | -1 }))
    const cross0 = alongX ? c.minZ : c.minX
    const cross1 = alongX ? c.maxZ : c.maxX
    const mid = (cross0 + cross1) / 2
    const P = (along: number, cross: number, y: number): Vec3 => (alongX ? v3(along, y, cross) : v3(cross, y, along))
    const topOf = (cross: number): number => (alongX ? g.topAt(0, cross) : g.topAt(cross, 0))
    for (const end of ends) {
      const tris: Triangle[] = []
      const a0 = end.e
      const a1 = end.e + end.inward * end.depth
      const outerN = alongX ? v3(-end.inward, 0, 0) : v3(0, 0, -end.inward)
      const innerN = v3(-outerN.x, 0, -outerN.z)
      const t0 = topOf(cross0)
      const tm = g.ridgeY
      const w = end.width
      // The chevron at along = a: two planar quads, eave-to-ridge each side.
      const chevron = (a: number, outward: Vec3): void => {
        quadOut(tris, P(a, cross0, t0), P(a, mid, tm), P(a, mid, tm - w), P(a, cross0, t0 - w), outward)
        quadOut(tris, P(a, mid, tm), P(a, cross1, t0), P(a, cross1, t0 - w), P(a, mid, tm - w), outward)
      }
      chevron(a0, outerN)
      chevron(a1, innerN)
      // Top surfaces, one per slope, outward up and towards that eave.
      const crossDir = alongX ? v3(0, 0, 1) : v3(1, 0, 0)
      quadOut(tris, P(a0, cross0, t0), P(a1, cross0, t0), P(a1, mid, tm), P(a0, mid, tm), v3(-crossDir.x, 1, -crossDir.z))
      quadOut(tris, P(a0, mid, tm), P(a1, mid, tm), P(a1, cross1, t0), P(a0, cross1, t0), v3(crossDir.x, 1, crossDir.z))
      // Undersides, outward down and towards the ridge.
      quadOut(tris, P(a0, cross0, t0 - w), P(a1, cross0, t0 - w), P(a1, mid, tm - w), P(a0, mid, tm - w), v3(crossDir.x, -1, crossDir.z))
      quadOut(tris, P(a0, mid, tm - w), P(a1, mid, tm - w), P(a1, cross1, t0 - w), P(a0, cross1, t0 - w), v3(-crossDir.x, -1, -crossDir.z))
      // The two eave ends: vertical quads facing out along ±cross.
      quadOut(tris, P(a0, cross0, t0), P(a1, cross0, t0), P(a1, cross0, t0 - w), P(a0, cross0, t0 - w), v3(-crossDir.x, 0, -crossDir.z))
      quadOut(tris, P(a0, cross1, t0), P(a1, cross1, t0), P(a1, cross1, t0 - w), P(a0, cross1, t0 - w), crossDir)
      trims.push({ id: `${roof.id}:verge-${end.side.toLowerCase().replace('_', '-')}`, kind: 'VERGE', side: end.side, triangles: tris, materialId: v.materialId })
    }
  }
  if (members.fascia) {
    const fa = members.fascia
    for (const side of fa.sides) {
      const tris: Triangle[] = []
      const top = g.eaveY + fa.topOffset
      const bottom = top - fa.height
      const box = side === 'MIN_X' ? { minX: c.minX, maxX: c.minX + fa.depth, minZ: c.minZ, maxZ: c.maxZ } : side === 'MAX_X' ? { minX: c.maxX - fa.depth, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ } : side === 'MIN_Z' ? { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.minZ + fa.depth } : { minX: c.minX, maxX: c.maxX, minZ: c.maxZ - fa.depth, maxZ: c.maxZ }
      worldBox(tris, box.minX, box.maxX, bottom, top, box.minZ, box.maxZ)
      trims.push({ id: `${roof.id}:fascia-${side.toLowerCase().replace('_', '-')}`, kind: 'FASCIA', side, triangles: tris, materialId: fa.materialId })
    }
  }
  return trims
}

/**
 * Parameter values along a plan segment (from `p` in direction `d`, length
 * `L`) where it crosses a roof's crease lines or the edges of the covered
 * rectangle. These are the places a wall under this roof changes top slope.
 */
export function roofBreaksAlong(g: RoofGeometry, p: Vec2, d: Vec2, L: number): number[] {
  const out: number[] = []
  const lines: Array<{ axis: 'X' | 'Z'; value: number }> = [
    ...g.creaseLines,
    { axis: 'X', value: g.covered.minX },
    { axis: 'X', value: g.covered.maxX },
    { axis: 'Z', value: g.covered.minZ },
    { axis: 'Z', value: g.covered.maxZ },
  ]
  for (const ln of lines) {
    const p0 = ln.axis === 'X' ? p.x : p.z
    const dd = ln.axis === 'X' ? d.x : d.z
    if (Math.abs(dd) < 1e-12) continue
    const t = (ln.value - p0) / dd
    if (t > 1e-9 && t < L - 1e-9) out.push(t)
  }
  return out
}

// ---------------------------------------------------------------------------
// Rooflight fills
// ---------------------------------------------------------------------------

export type RooflightPiece = { part: 'ROOFLIGHT_FRAME' | 'ROOFLIGHT_GLASS'; triangles: Triangle[] }

const rectCorners = (r: PlanRect): Vec2[] => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
]

/** A prism over a plan rectangle capped by two sloped (or level) planes, its bottom outline shifted by `shift` in plan (sheared for a normal cut). One closed solid. */
function prismBetweenPlanes(out: Triangle[], r: PlanRect, yTop: (x: number, z: number) => number, yBot: (x: number, z: number) => number, shift: Vec2 = { x: 0, z: 0 }): void {
  const C = rectCorners(r)
  const T = C.map((p) => v3(p.x, yTop(p.x, p.z), p.z))
  const B = C.map((p) => v3(p.x + shift.x, yBot(p.x + shift.x, p.z + shift.z), p.z + shift.z))
  quadOut(out, T[0], T[1], T[2], T[3], v3(0, 1, 0))
  quadOut(out, B[0], B[1], B[2], B[3], v3(0, -1, 0))
  const cx = (r.minX + r.maxX) / 2
  const cz = (r.minZ + r.maxZ) / 2
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const mx = (C[i].x + C[j].x) / 2 - cx
    const mz = (C[i].z + C[j].z) / 2 - cz
    quadOut(out, B[i], B[j], T[j], T[i], v3(mx, 0, mz))
  }
}

/** A ring between an outer and an inner plan rectangle, capped by two sloped planes, its bottom outlines shifted by `shift` in plan (vertical sides when the shift is zero, sides normal to the slope otherwise). One closed solid. */
function ringBetweenPlanes(out: Triangle[], outer: PlanRect, inner: PlanRect, yTop: (x: number, z: number) => number, yBot: (x: number, z: number) => number, shift: Vec2 = { x: 0, z: 0 }): void {
  const O = rectCorners(outer)
  const I = rectCorners(inner)
  const cx = (outer.minX + outer.maxX) / 2
  const cz = (outer.minZ + outer.maxZ) / 2
  const top = (p: Vec2): Vec3 => v3(p.x, yTop(p.x, p.z), p.z)
  const bot = (p: Vec2): Vec3 => v3(p.x + shift.x, yBot(p.x + shift.x, p.z + shift.z), p.z + shift.z)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    quadOut(out, top(O[i]), top(O[j]), top(I[j]), top(I[i]), v3(0, 1, 0))
    quadOut(out, bot(O[i]), bot(O[j]), bot(I[j]), bot(I[i]), v3(0, -1, 0))
    const mx = (O[i].x + O[j].x) / 2 - cx
    const mz = (O[i].z + O[j].z) / 2 - cz
    quadOut(out, bot(O[i]), bot(O[j]), top(O[j]), top(O[i]), v3(mx, 0, mz))
    quadOut(out, bot(I[i]), bot(I[j]), top(I[j]), top(I[i]), v3(-mx, 0, -mz))
  }
}

/**
 * A rooflight in a cut roof opening: a frame ring filling the hole between
 * the roof's top surface and its underside (its outer sides coincide with the
 * reveals, vertical or normal to the slope as the opening's cut is), and a
 * pane parallel to the roof at mid-depth inside the frame. Both are
 * separate, non-structural solids.
 */
export function compileRooflightFill(fill: { frameWidth: number; glassThickness: number }, opening: RoofOpening, g: RoofGeometry, roof: Roof): RooflightPiece[] {
  const fw = fill.frameWidth
  const outer = opening.footprint
  const inner = { minX: outer.minX + fw, maxX: outer.maxX - fw, minZ: outer.minZ + fw, maxZ: outer.maxZ - fw }
  const top = (x: number, z: number): number => g.topAt(x, z)
  const bottom = (x: number, z: number): number => g.undersideAt(x, z)
  const shift = roofOpeningUndersideShift(roof, opening)
  const frame: Triangle[] = []
  ringBetweenPlanes(frame, outer, inner, top, bottom, { x: shift.dx, z: shift.dz })
  const glass: Triangle[] = []
  const midDepth = g.verticalDrop / 2
  const gt = fill.glassThickness / 2
  // the pane sits at mid-depth along the cut: half the underside shift across, for a normal cut
  const paneRect = { minX: inner.minX + shift.dx / 2, maxX: inner.maxX + shift.dx / 2, minZ: inner.minZ + shift.dz / 2, maxZ: inner.maxZ + shift.dz / 2 }
  prismBetweenPlanes(
    glass,
    paneRect,
    (x, z) => top(x, z) - midDepth + gt,
    (x, z) => top(x, z) - midDepth - gt,
  )
  return [
    { part: 'ROOFLIGHT_FRAME', triangles: frame },
    { part: 'ROOFLIGHT_GLASS', triangles: glass },
  ]
}


/** The gable ends that carry a verge board, with each end's width and depth. */
export function vergeEnds(roof: Roof): Array<{ side: RoofEdgeSide; width: number; depth: number }> {
  const v = roof.edgeMembers?.verge
  if (!v || roof.kind === 'FLAT') return []
  if (v.ends && v.ends.length > 0) return v.ends.map((e) => ({ side: e.side, width: e.width, depth: e.depth }))
  const sides: RoofEdgeSide[] = roof.ridgeAxis === 'X' ? ['MIN_X', 'MAX_X'] : ['MIN_Z', 'MAX_Z']
  return sides.map((side) => ({ side, width: v.width, depth: v.depth }))
}
