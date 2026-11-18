/**
 * v3.54.9 — placing an interior from another source of the same pages (LOCAL) into the described house.
 *
 * An interior is never pasted by bounding box. It is placed only through a transform that is checked: which way the
 * source's plan lies (mirrored or not along each axis), ONE scale for both axes (a source whose two axes need two
 * scales contradicts the house's metric and is refused, never stretched), and a shift; the transformed ground footprint
 * must cover the house's ground outline (overlap ≥ INTERIOR_RULES.overlap). Each source level goes to the house level
 * at the same floor height (within INTERIOR_RULES.levelM) or is not placed. Then each element is fitted to the house's
 * own faces: a partition's end that falls short of or runs into the house's exterior wall is brought to its inner face;
 * a partition, room or stair outside the new outline is dropped with its reason; a door is kept on its partition only
 * where it still fits. Identities are the source's (rooms keep their ids, and with them their links).
 */
import type { HouseGeometry, HouseInterior, HouseInteriorSource, HouseObservations } from './document.js'
import { bbox, contains, offset, pt, signedArea, toSegment } from './poly.js'
import type { P2 } from './poly.js'

export const INTERIOR_RULES = {
  /** The two axes' scales may differ by this share at most (a scan's skew); beyond, the metric is in conflict. */
  axisRatio: 0.02,
  /** The transformed footprint must cover this share of the house's ground outline, and the outline that of it. */
  overlap: 0.9,
  /** A source level and a house level are the same floor when their elevations differ by no more than this. */
  levelM: 0.15,
  /** A partition's end within this distance of the house's inner face is brought onto it. */
  snapM: 0.45,
  /** A room's corner within this distance of the house's inner face is brought onto it. */
  roomSnapM: 0.25,
} as const

type Tf = { mirrorX: boolean; mirrorZ: boolean; scale: number; dx: number; dz: number }
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

/** Share of polygon A covered by polygon B, by sampling A's box on a grid. */
function covered(a: readonly P2[], b: readonly P2[], step = 0.1): number {
  const bb = bbox(a)
  let n = 0
  let k = 0
  for (let x = bb.x0 + step / 2; x < bb.x1; x += step)
    for (let z = bb.z0 + step / 2; z < bb.z1; z += step) {
      const p = pt(x, z)
      if (!contains(a, p)) continue
      n += 1
      if (contains(b, p)) k += 1
    }
  return n === 0 ? 0 : k / n
}
const coveredByAny = (a: readonly P2[], bs: readonly P2[][]): number => {
  const bb = bbox(a)
  let n = 0
  let k = 0
  const step = 0.1
  for (let x = bb.x0 + step / 2; x < bb.x1; x += step)
    for (let z = bb.z0 + step / 2; z < bb.z1; z += step) {
      const p = pt(x, z)
      if (!contains(a, p)) continue
      n += 1
      if (bs.some((b) => contains(b, p))) k += 1
    }
  return n === 0 ? 0 : k / n
}

export type InteriorResolution = { interior: HouseInterior; checks: Array<{ id: string; what: string; expected: string; measured: string; status: 'PASS' | 'FAIL' | 'UNKNOWN' }>; knownDefects: Array<{ code: string; what: string }> }

export function resolveInterior(src: HouseInteriorSource, g: Pick<HouseGeometry, 'outlines' | 'levels' | 'wallThicknessM'> & { openings?: HouseGeometry['openings'] }, opt: { registerLevel?: number; /** v3.54.10: the source's orientation is read (a plan's front edge), not guessed: no mirror is tried. */ oriented?: boolean } = {}): InteriorResolution {
  const checks: InteriorResolution['checks'] = []
  const knownDefects: InteriorResolution['knownDefects'] = []
  const none = (note: string): InteriorResolution => ({ interior: { status: 'NOT_BUILT', note, source: { origin: src.origin, modelHash: src.modelHash }, levels: [] }, checks, knownDefects })
  // the outline it registers to: the ground's (LOCAL's footprint), or the storey's own for one plan read alone (v3.54.10)
  const ground = g.outlines.find((o) => o.level === (opt.registerLevel ?? 0))?.polygon.map((p) => pt(p.x, p.z))
  if (!ground) return none('the house has no ground outline to place an interior in')
  const H = bbox(ground)
  const S = src.extent
  const sx = (H.x1 - H.x0) / (S.x1 - S.x0)
  const sz = (H.z1 - H.z0) / (S.z1 - S.z0)
  const ratio = Math.abs(sx - sz) / ((sx + sz) / 2)
  const scale = (sx + sz) / 2
  checks.push({ id: 'interior-metric', what: 'the interior source and the house have one scale on both axes', expected: `the two axes' scales within ${INTERIOR_RULES.axisRatio * 100} % of each other`, measured: `${sx.toFixed(4)} along x, ${sz.toFixed(4)} along z (${(ratio * 100).toFixed(2)} %)`, status: ratio <= INTERIOR_RULES.axisRatio ? 'PASS' : 'FAIL' })
  if (ratio > INTERIOR_RULES.axisRatio) {
    knownDefects.push({ code: 'INTERIOR_METRIC_CONFLICT', what: `the interior source's extent (${(S.x1 - S.x0).toFixed(2)} × ${(S.z1 - S.z0).toFixed(2)} m) would need ${sx.toFixed(3)} along x and ${sz.toFixed(3)} along z to fit the house (${(H.x1 - H.x0).toFixed(2)} × ${(H.z1 - H.z0).toFixed(2)} m): two scales are a metric conflict, not a fit — the interior is not stretched into place` })
    return none('the interior source and the house disagree on the metric (two scales); not stretched')
  }
  // which way round: each mirror is tried, the one whose footprint covers the outline best is taken (and must be good)
  const make = (mirrorX: boolean, mirrorZ: boolean): Tf => ({ mirrorX, mirrorZ, scale, dx: H.x0, dz: H.z0 })
  const apply = (t: Tf) => (p: { x: number; z: number }): P2 => {
    const u = t.mirrorX ? S.x1 - p.x : p.x - S.x0
    const v = t.mirrorZ ? S.z1 - p.z : p.z - S.z0
    return pt(r6(t.dx + u * t.scale), r6(t.dz + v * t.scale))
  }
  const tried = (opt.oriented ? [make(false, false)] : [make(false, false), make(true, false), make(false, true), make(true, true)]).map((t) => {
    const fp = src.footprint.map((poly) => poly.map(apply(t)))
    const out = coveredByAny(ground, fp)
    const into = Math.min(...fp.map((poly) => covered(poly, ground)))
    return { t, overlap: Math.min(out, into) }
  })
  tried.sort((p, q) => q.overlap - p.overlap)
  // a footprint that lies the same every way round (a rectangle) does not say which way: the openings do. The centres of
  // the house's exterior openings (read on its elevations, registered) against the source's (read on its plan), each
  // way round that fits the outline as well as the best: the way round that puts more of them together is taken, and
  // only if clearly better; otherwise which way it lies is not decided.
  const centres = (g.openings ?? []).flatMap((op) => {
    const m = /^wall-(\d+)-(\d+)$/.exec(op.hostWall)
    const poly = m ? g.outlines.find((o) => o.level === Number(m[1]))?.polygon : undefined
    if (!m || !poly || op.offsetM.value === null || op.widthM.value === null) return []
    const a = poly[Number(m[2]) % poly.length]
    const b = poly[(Number(m[2]) + 1) % poly.length]
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const t = op.offsetM.value + op.widthM.value / 2
    return [{ level: op.level, door: op.kind === 'DOOR', at: pt(a.x + ((b.x - a.x) * t) / L, a.z + ((b.z - a.z) * t) / L) }]
  })
  // the mean distance from each of the house's opening centres to the nearest of the source's on the same level (each
  // counted up to 1 m): small when they lie together
  const apart = (t: Tf): number => {
    if (centres.length === 0 || src.exteriorOpenings.length === 0) return 1
    const theirs = src.exteriorOpenings.map((o) => ({ level: o.level, at: apply(t)(o.at) }))
    return centres.reduce((sum, c) => sum + Math.min(1, ...theirs.filter((o) => o.level === c.level).map((o) => Math.hypot(o.at.x - c.at.x, o.at.z - c.at.z))), 0) / centres.length
  }
  // and the doors alone (an entrance is rarely symmetric): from each of the house's doors to the source's nearest door
  const doorsApart = (t: Tf): number => {
    const ours = centres.filter((c) => c.door)
    const theirs = src.exteriorOpenings.filter((o) => o.door).map((o) => ({ level: o.level, at: apply(t)(o.at) }))
    if (ours.length === 0 || theirs.length === 0) return Number.POSITIVE_INFINITY
    return ours.reduce((sum, c) => sum + Math.min(3, ...theirs.filter((o) => o.level === c.level).map((o) => Math.hypot(o.at.x - c.at.x, o.at.z - c.at.z))), 0) / ours.length
  }
  const tied = tried.filter((x) => tried[0].overlap - x.overlap < 0.03).map((x) => ({ ...x, openings: apart(x.t), doors: doorsApart(x.t) })).sort((p, q) => p.openings - q.openings)
  const byAll = tied.length > 1 && centres.length >= 3 && tied[0].openings <= 0.35 && tied[1].openings - tied[0].openings >= 0.15
  const byDoor = !byAll && tied.length > 1 ? [...tied].sort((p, q) => p.doors - q.doors) : []
  const doorDecides = byDoor.length > 1 && byDoor[0].doors <= 0.5 && byDoor[1].doors - byDoor[0].doors >= 0.5 && byDoor[0].openings <= 0.35
  if (doorDecides) tied.splice(0, tied.length, ...byDoor)
  const byOpenings = byAll || doorDecides
  const best = byOpenings ? tied[0] : tried[0]
  const second = byOpenings ? { overlap: tried[0].overlap - 0.03 - 1e-9, t: tied[1].t } : (tried[1] ?? { overlap: 0, t: tried[0].t })
  if (tied.length > 1) checks.push({ id: 'interior-orientation', what: 'which way the interior source lies, where the outline alone does not say', expected: 'the house\'s exterior openings (its elevations) and the source\'s (its plan) within 0.35 m on average one way round, the next ≥ 0.15 m further apart — or, where they are symmetric, its doors within 0.5 m one way round and ≥ 0.5 m further the next', measured: tied.map((x) => `${x.t.mirrorX || x.t.mirrorZ ? `mirrored${x.t.mirrorX ? ' x' : ''}${x.t.mirrorZ ? ' z' : ''}` : 'as drawn'} openings ${x.openings.toFixed(2)} m, doors ${Number.isFinite(x.doors) ? `${x.doors.toFixed(2)} m` : 'none'}`).join('; ') + (doorDecides ? '; the doors decide (the openings alone do not)' : '') + ` (${centres.length} opening(s) of the house)`, status: byOpenings ? 'PASS' : 'FAIL' })
  checks.push({ id: 'interior-register', what: 'the interior source lies on the house\'s ground outline', expected: `its footprint and the outline cover each other ≥ ${INTERIOR_RULES.overlap * 100} %, one way round clearly best`, measured: `${(best.overlap * 100).toFixed(1)} % ${best.t.mirrorX || best.t.mirrorZ ? `mirrored${best.t.mirrorX ? ' in x' : ''}${best.t.mirrorZ ? ' in z' : ''}` : 'as drawn'}; next way round ${(second.overlap * 100).toFixed(1)} %`, status: best.overlap >= INTERIOR_RULES.overlap && best.overlap - second.overlap >= 0.03 ? 'PASS' : 'FAIL' })
  if (best.overlap < INTERIOR_RULES.overlap || best.overlap - second.overlap < 0.03) {
    knownDefects.push({ code: 'INTERIOR_NOT_REGISTERED', what: `the interior source's footprint covers the house's outline ${(best.overlap * 100).toFixed(1)} % at best (next ${(second.overlap * 100).toFixed(1)} %): it is not this outline, or which way it lies is not decided — the interior is not placed (it would have to be read from the plans again)` })
    return none('the interior source does not register to the house\'s outline')
  }
  const T = g.wallThicknessM.value ?? 0.4
  const to = apply(best.t)
  const mapDir = (d: 'PLUS_X' | 'MINUS_X' | 'PLUS_Z' | 'MINUS_Z'): 'PLUS_X' | 'MINUS_X' | 'PLUS_Z' | 'MINUS_Z' => (best.t.mirrorX && d === 'PLUS_X' ? 'MINUS_X' : best.t.mirrorX && d === 'MINUS_X' ? 'PLUS_X' : best.t.mirrorZ && d === 'PLUS_Z' ? 'MINUS_Z' : best.t.mirrorZ && d === 'MINUS_Z' ? 'PLUS_Z' : d)
  const flipTurns = best.t.mirrorX !== best.t.mirrorZ
  const levelMap: NonNullable<HouseInterior['transform']>['levels'] = []
  const levels: HouseInterior['levels'] = []
  let placed = 0
  let dropped = 0
  for (const sl of src.levels) {
    const hl = g.levels.map((l) => ({ l, gap: Math.abs((l.elevation.value ?? Number.NaN) - sl.elevation) })).filter((x) => Number.isFinite(x.gap)).sort((p, q) => p.gap - q.gap)[0]
    const outline = hl ? g.outlines.find((o) => o.level === hl.l.index)?.polygon.map((p) => pt(p.x, p.z)) : undefined
    if (!hl || hl.gap > INTERIOR_RULES.levelM || !outline) {
      knownDefects.push({ code: 'INTERIOR_LEVEL_NOT_PLACED', what: `the interior source's floor at +${sl.elevation.toFixed(2)} m has no house level within ${INTERIOR_RULES.levelM} m${hl ? ` (nearest +${(hl.l.elevation.value ?? 0).toFixed(2)} m)` : ''}: its ${sl.rooms.length} room(s) and ${sl.walls.length} partition(s) are not placed` })
      dropped += sl.rooms.length + sl.walls.length
      continue
    }
    levelMap.push({ source: sl.index, house: hl.l.index, elevationGapM: r6(hl.gap) })
    // the house's inner faces on this level: its outline brought in by its wall thickness
    const inner = offset(outline, outline.map(() => -T))
    const innerOk = inner.length >= 3 && signedArea(inner) > 1
    const face = innerOk ? inner : outline
    const edges = face.map((a, i) => [a, face[(i + 1) % face.length]] as const)
    const lv: HouseInterior['levels'][number] = { level: hl.l.index, walls: [], doors: [], rooms: [], stairs: [], voids: [], dropped: [] }
    const drop = (id: string, kind: string, why: string): void => {
      lv.dropped.push({ id, kind, why })
      dropped += 1
    }
    // the point where the line through a → b (beyond b, or short of it) meets the inner face nearest to b
    const toFace = (a: P2, b: P2): { p: P2; moved: number } | undefined => {
      const L = Math.hypot(b.x - a.x, b.z - a.z)
      if (L < 1e-9) return undefined
      const u = { x: (b.x - a.x) / L, z: (b.z - a.z) / L }
      let bestT: number | undefined
      for (const [p, q] of edges) {
        const ex = q.x - p.x
        const ez = q.z - p.z
        const den = u.x * ez - u.z * ex
        if (Math.abs(den) < 1e-9) continue
        const t = ((p.x - a.x) * ez - (p.z - a.z) * ex) / den
        const s = ((p.x - a.x) * u.z - (p.z - a.z) * u.x) / den
        if (s < -1e-6 || s > 1 + 1e-6) continue
        if (Math.abs(t - L) <= INTERIOR_RULES.snapM && (bestT === undefined || Math.abs(t - L) < Math.abs(bestT - L))) bestT = t
      }
      return bestT === undefined ? undefined : { p: pt(r6(a.x + u.x * bestT), r6(a.z + u.z * bestT)), moved: bestT - L }
    }
    const wallShift = new Map<string, { startMoved: number; length: number }>()
    for (const w of sl.walls) {
      let a = to(w.a)
      let b = to(w.b)
      const mid = pt((a.x + b.x) / 2, (a.z + b.z) / 2)
      if (!contains(face, mid)) {
        drop(w.id, 'wall', 'it stands outside the house\'s inner faces on this level')
        continue
      }
      const eb = toFace(a, b)
      const ea = toFace(b, a)
      let startMoved = 0
      const hows: string[] = []
      if (ea) {
        startMoved = -ea.moved
        a = ea.p
        hows.push(`start brought ${ea.moved >= 0 ? 'out' : 'in'} ${Math.abs(ea.moved).toFixed(2)} m to the inner face`)
      }
      if (eb) {
        b = eb.p
        hows.push(`end brought ${eb.moved >= 0 ? 'out' : 'in'} ${Math.abs(eb.moved).toFixed(2)} m to the inner face`)
      }
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (length < 0.3) {
        drop(w.id, 'wall', `only ${length.toFixed(2)} m of it is left inside the house`)
        continue
      }
      wallShift.set(w.id, { startMoved, length })
      lv.walls.push({ id: w.id, a, b, thickness: r6(w.thickness * scale), how: `${best.t.mirrorX || best.t.mirrorZ ? 'mirrored, ' : ''}×${scale.toFixed(4)}${hows.length ? `; ${hows.join('; ')}` : ''}` })
      placed += 1
    }
    for (const d of sl.doors) {
      const sh = wallShift.get(d.wallId)
      if (!sh) {
        drop(d.id, 'door', `its partition ${d.wallId} was not placed`)
        continue
      }
      const w = sl.walls.find((x) => x.id === d.wallId)
      const srcLen = w ? Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) : 0
      // a mirror along the wall's own axis reverses where along it the door stands — the wall keeps its own start
      const off = d.offset * scale - sh.startMoved
      const width = d.width * scale
      if (off < 0.05 || off + width > sh.length - 0.05) {
        drop(d.id, 'door', `on the fitted partition (${sh.length.toFixed(2)} m) it would stand at ${off.toFixed(2)}–${(off + width).toFixed(2)} m: it no longer fits`)
        continue
      }
      void srcLen
      lv.doors.push({ id: d.id, wallId: d.wallId, offset: r6(off), width: r6(width), height: d.height })
      placed += 1
    }
    const snapRoom = (poly: P2[]): P2[] =>
      poly.map((p) => {
        let bestP: P2 | undefined
        let bestD: number = INTERIOR_RULES.roomSnapM
        for (const [a, b] of edges) {
          const s = toSegment(p, a, b)
          if (s.d < bestD) {
            bestD = s.d
            bestP = pt(r6(a.x + (b.x - a.x) * s.t), r6(a.z + (b.z - a.z) * s.t))
          }
        }
        return bestP ?? p
      })
    for (const r of sl.rooms) {
      const poly = snapRoom(r.polygon.map(to))
      const ccw = signedArea(poly) < 0 ? [...poly].reverse() : poly
      const c = ccw.reduce((s, p) => pt(s.x + p.x / ccw.length, s.z + p.z / ccw.length), pt(0, 0))
      if (!contains(face, c) || Math.abs(signedArea(ccw)) < 0.5) {
        drop(r.id, 'room', 'it lies outside the house\'s inner faces on this level')
        continue
      }
      const inside = covered(ccw, face)
      if (inside < 0.85) {
        drop(r.id, 'room', `only ${(inside * 100).toFixed(0)} % of it lies inside the house's inner faces`)
        continue
      }
      lv.rooms.push({ id: r.id, polygon: ccw, ...(r.holes && r.holes.length ? { holes: r.holes.map((h) => h.map(to)) } : {}), ...(r.usage ? { usage: r.usage } : {}) })
      placed += 1
    }
    for (const st of sl.stairs) {
      const tl = g.levels.map((l) => ({ l, gap: Math.abs((l.elevation.value ?? Number.NaN) - (src.levels.find((x) => x.index === st.toLevel)?.elevation ?? Number.NaN)) })).filter((x) => Number.isFinite(x.gap)).sort((p, q) => p.gap - q.gap)[0]
      if (!tl || tl.gap > INTERIOR_RULES.levelM) {
        drop(st.id, 'stair', 'the level it climbs to has no house level at that height')
        continue
      }
      const start = to(st.start)
      const fp = st.footprint ? [to({ x: st.footprint.minX, z: st.footprint.minZ }), to({ x: st.footprint.maxX, z: st.footprint.maxZ })] : undefined
      const c = fp ? pt((fp[0].x + fp[1].x) / 2, (fp[0].z + fp[1].z) / 2) : start
      if (!contains(face, c)) {
        drop(st.id, 'stair', 'it stands outside the house\'s inner faces')
        continue
      }
      const segments = st.segments.map((sg) => (sg.kind === 'FLIGHT' ? { ...sg, going: r6(sg.going * scale) } : sg.kind === 'LANDING' ? { ...sg, length: r6(sg.length * scale), ...(flipTurns && sg.turn !== 'NONE' ? { turn: sg.turn === 'LEFT' ? ('RIGHT' as const) : ('LEFT' as const) } : {}) } : flipTurns ? { ...sg, turn: sg.turn === 'LEFT' ? ('RIGHT' as const) : ('LEFT' as const) } : sg))
      lv.stairs.push({ id: st.id, toLevel: tl.l.index, start, direction: mapDir(st.direction), width: r6(st.width * scale), ...(st.waist ? { waist: st.waist } : {}), ...(fp ? { footprint: { minX: Math.min(fp[0].x, fp[1].x), maxX: Math.max(fp[0].x, fp[1].x), minZ: Math.min(fp[0].z, fp[1].z), maxZ: Math.max(fp[0].z, fp[1].z) } } : {}), segments })
      placed += 1
    }
    for (const v of sl.voids) lv.voids.push(v.map(to))
    levels.push(lv)
  }
  const status = placed === 0 ? 'NOT_BUILT' : dropped === 0 ? 'BUILT' : 'PARTIAL'
  if (dropped > 0) knownDefects.push({ code: 'INTERIOR_PARTLY_PLACED', what: `${dropped} element(s) of the interior source were not placed (each with its reason in geometry.interior.levels[].dropped)` })
  return {
    interior: {
      status,
      note: `placed from ${src.origin} (${src.modelHash.slice(0, 12)}) through a checked transform: ${placed} element(s) placed, ${dropped} not`,
      source: { origin: src.origin, modelHash: src.modelHash },
      transform: { ...best.t, scale: r6(scale), dx: r6(best.t.dx), dz: r6(best.t.dz), axisRatio: r6(ratio), overlap: r6(best.overlap), levels: levelMap, how: `one scale ${scale.toFixed(4)} from the two extents (x ${sx.toFixed(4)}, z ${sz.toFixed(4)}), shifted onto the outline's corner; ${best.t.mirrorX || best.t.mirrorZ ? 'mirrored' : 'as drawn'} (footprint overlap ${(best.overlap * 100).toFixed(1)} %)` },
      levels,
    },
    checks,
    knownDefects,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// v3.54.10 — the interior read from each storey's own plan, placed by the same checked transform, and merged with an
// import from LOCAL without removing what the import placed.
// ---------------------------------------------------------------------------------------------------------------------

type StoreyObs = NonNullable<HouseObservations['storeys']>[number]
export const PLAN_INTERIOR_RULES = {
  /** A partition thickness the plan does not give, and a door width: conventions, said. */
  partitionM: 0.12,
  doorWidthM: 0.9,
  doorHeightM: 2.05,
  /** A door belongs to the partition whose middle line passes within this distance of it. */
  doorToWallM: 0.4,
  /** Two partitions are one when parallel (within 10°), this close and overlapping half the shorter. */
  sameWallM: 0.25,
  /** A plan room splits an imported room when this share of it lies inside that room. */
  splitShare: 0.7,
} as const

/** Pixels of a plan as printed → the house's orientation (x left→right seen from the front, z from the front back). */
function oriented(edge: StoreyObs['frontEdge'], p: { x: number; y: number }): P2 {
  return edge === 'BOTTOM' ? pt(p.x, -p.y) : edge === 'TOP' ? pt(-p.x, p.y) : edge === 'LEFT' ? pt(p.y, p.x) : pt(-p.y, -p.x)
}

/** One storey's plan reading as an interior source (pre-scaled to metres by its outline against the house's), for `resolveInterior`. */
export function storeySource(st: StoreyObs, g: Pick<HouseGeometry, 'outlines' | 'levels' | 'wallThicknessM'>): HouseInteriorSource | undefined {
  return storeyFrame(st, g)?.src
}
/** The same, with the map from the plan's pixels into the source's frame (for points read on that plan, like callouts). */
export function storeyFrame(st: StoreyObs, g: Pick<HouseGeometry, 'outlines' | 'levels' | 'wallThicknessM'>): { src: HouseInteriorSource; map: (p: { x: number; y: number }) => { x: number; z: number } } | undefined {
  const house = g.outlines.find((o) => o.level === st.level)?.polygon
  const lvl = g.levels.find((l) => l.index === st.level)
  if (!house || !lvl) return undefined
  const O = (p: { x: number; y: number }) => oriented(st.frontEdge, p)
  const out = st.outline.map(O)
  const S = bbox(out)
  const H = bbox(house.map((p) => pt(p.x, p.z)))
  const s = ((H.x1 - H.x0) / Math.max(1e-6, S.x1 - S.x0) + (H.z1 - H.z0) / Math.max(1e-6, S.z1 - S.z0)) / 2
  const M = (p: { x: number; y: number }): { x: number; z: number } => {
    const q = O(p)
    return { x: r6(q.x * s), z: r6(q.z * s) }
  }
  const walls = st.partitions.map((w) => ({ id: w.id, a: M(w.a), b: M(w.b), thickness: r6(Math.min(0.3, Math.max(0.06, w.thicknessPx ? w.thicknessPx * s : PLAN_INTERIOR_RULES.partitionM))) }))
  const doors = st.doors.flatMap((d) => {
    const c = M(d.at)
    const best = walls.map((w) => ({ w, ...toSegment(pt(c.x, c.z), pt(w.a.x, w.a.z), pt(w.b.x, w.b.z)) })).filter((x) => x.d <= PLAN_INTERIOR_RULES.doorToWallM).sort((p, q) => p.d - q.d)[0]
    if (!best) return []
    const L = Math.hypot(best.w.b.x - best.w.a.x, best.w.b.z - best.w.a.z)
    const width = d.widthPx ? d.widthPx * s : PLAN_INTERIOR_RULES.doorWidthM
    return [{ id: d.id, wallId: best.w.id, offset: r6(Math.max(0, best.t * L - width / 2)), width: r6(width), height: PLAN_INTERIOR_RULES.doorHeightM }]
  })
  const ext = out.map((p) => pt(p.x * s, p.z * s))
  const E = bbox(ext)
  const src: HouseInteriorSource = {
    origin: 'PLAN',
    modelHash: `${st.picture}#${st.id}`,
    extent: { x0: E.x0, x1: E.x1, z0: E.z0, z1: E.z1 },
    footprint: [ext.map((p) => ({ x: r6(p.x), z: r6(p.z) }))],
    exteriorThicknessM: g.wallThicknessM.value ?? 0.4,
    exteriorOpenings: [],
    levels: [{ index: st.level, elevation: lvl.elevation.value ?? 0, walls, doors, rooms: st.rooms.map((r) => ({ id: r.id, polygon: r.polygon.map(M), ...(r.name ? { usage: r.name } : {}) })), stairs: [], voids: st.voids.map((v) => v.map(M)) }],
  }
  return { src, map: M }
}

/** A point of an interior source's frame placed through the transform `resolveInterior` chose for it. */
export function placeThrough(src: HouseInteriorSource, t: { mirrorX: boolean; mirrorZ: boolean; scale: number; dx: number; dz: number }, p: { x: number; z: number }): P2 {
  const S = src.extent
  const u = t.mirrorX ? S.x1 - p.x : p.x - S.x0
  const v = t.mirrorZ ? S.z1 - p.z : p.z - S.z0
  return pt(r6(t.dx + u * t.scale), r6(t.dz + v * t.scale))
}

/** Is wall b the same partition as wall a (parallel, close, overlapping)? */
function sameWall(a: { a: { x: number; z: number }; b: { x: number; z: number } }, b: { a: { x: number; z: number }; b: { x: number; z: number } }): boolean {
  const ua = { x: a.b.x - a.a.x, z: a.b.z - a.a.z }
  const ub = { x: b.b.x - b.a.x, z: b.b.z - b.a.z }
  const la = Math.hypot(ua.x, ua.z)
  const lb = Math.hypot(ub.x, ub.z)
  if (la < 1e-6 || lb < 1e-6) return false
  if (Math.abs(ua.x * ub.z - ua.z * ub.x) / (la * lb) > Math.sin((10 * Math.PI) / 180)) return false
  const ta = toSegment(pt(b.a.x, b.a.z), pt(a.a.x, a.a.z), pt(a.b.x, a.b.z))
  const tb = toSegment(pt(b.b.x, b.b.z), pt(a.a.x, a.a.z), pt(a.b.x, a.b.z))
  // perpendicular distance of b's line from a's, and the overlap of their projections on a
  const dist = Math.abs(((b.a.x - a.a.x) * ua.z - (b.a.z - a.a.z) * ua.x) / la)
  const t0 = Math.max(0, Math.min(ta.t, tb.t))
  const t1 = Math.min(1, Math.max(ta.t, tb.t))
  return dist <= PLAN_INTERIOR_RULES.sameWallM && (t1 - t0) * la >= 0.5 * Math.min(la, lb)
}

/**
 * Merge a storey's plan reading into what an import placed on that level. Nothing the import placed is removed: a plan
 * partition that is not already there is added (with its doors), a door the plan shows on a partition the import has
 * without a door there is added, an imported room the plan's partitions split is replaced by the plan's rooms inside it
 * (the largest keeps the imported id, so links to it survive), floor openings the import lacks are added. Open zones
 * never add a wall.
 */
export function mergePlanLevel(local: HouseInterior['levels'][number] | undefined, plan: HouseInterior['levels'][number], openRooms: ReadonlySet<string>): { level: HouseInterior['levels'][number]; added: { walls: number; doors: number; rooms: number; voids: number } } {
  if (!local) return { level: { ...plan, origin: 'PLAN' }, added: { walls: plan.walls.length, doors: plan.doors.length, rooms: plan.rooms.length, voids: plan.voids.length } }
  const lv: HouseInterior['levels'][number] = { ...local, walls: [...local.walls], doors: [...local.doors], rooms: [...local.rooms], voids: [...local.voids], dropped: [...local.dropped], origin: 'LOCAL+PLAN' }
  const added = { walls: 0, doors: 0, rooms: 0, voids: 0 }
  const newWalls = new Set<string>()
  for (const w of plan.walls) {
    const twin = local.walls.find((x) => sameWall(x, w))
    if (twin) {
      for (const d of plan.doors.filter((q) => q.wallId === w.id)) {
        // the door's middle on the plan partition, then on the imported twin
        const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) || 1
        const m = pt(w.a.x + ((w.b.x - w.a.x) * (d.offset + d.width / 2)) / L, w.a.z + ((w.b.z - w.a.z) * (d.offset + d.width / 2)) / L)
        const on = toSegment(m, pt(twin.a.x, twin.a.z), pt(twin.b.x, twin.b.z))
        const TL = Math.hypot(twin.b.x - twin.a.x, twin.b.z - twin.a.z)
        const at = on.t * TL
        if (local.doors.some((q) => q.wallId === twin.id && Math.abs(q.offset + q.width / 2 - at) < 0.6)) continue
        const off = at - d.width / 2
        if (off < 0.05 || off + d.width > TL - 0.05) continue
        lv.doors.push({ id: `${twin.id}-${d.id}`, wallId: twin.id, offset: r6(off), width: d.width, height: d.height })
        added.doors += 1
      }
      continue
    }
    // the parts of it a collinear partition already holds are not built twice: only the rest is added, in pieces
    const WL = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z)
    const wu = { x: (w.b.x - w.a.x) / (WL || 1), z: (w.b.z - w.a.z) / (WL || 1) }
    const taken: Array<[number, number]> = []
    for (const x of local.walls) {
      const xl = Math.hypot(x.b.x - x.a.x, x.b.z - x.a.z) || 1
      if (Math.abs((wu.x * (x.b.z - x.a.z) - wu.z * (x.b.x - x.a.x)) / xl) > Math.sin((10 * Math.PI) / 180)) continue
      const dist = Math.abs((x.a.x - w.a.x) * wu.z - (x.a.z - w.a.z) * wu.x)
      if (dist > (x.thickness + w.thickness) / 2 + 0.02) continue
      const t0 = (x.a.x - w.a.x) * wu.x + (x.a.z - w.a.z) * wu.z
      const t1 = (x.b.x - w.a.x) * wu.x + (x.b.z - w.a.z) * wu.z
      const lo = Math.max(0, Math.min(t0, t1) - w.thickness / 2)
      const hi = Math.min(WL, Math.max(t0, t1) + w.thickness / 2)
      if (hi - lo > 0.01) taken.push([lo, hi])
    }
    taken.sort((p, q) => p[0] - q[0])
    const free: Array<[number, number]> = []
    let cur = 0
    for (const [lo, hi] of taken) {
      if (lo > cur) free.push([cur, lo])
      cur = Math.max(cur, hi)
    }
    if (cur < WL) free.push([cur, WL])
    const pieces = free.filter(([lo, hi]) => hi - lo >= 0.3)
    if (pieces.length !== 1 || pieces[0][1] - pieces[0][0] < WL - 0.01) {
      newWalls.delete(w.id)
      pieces.forEach(([lo, hi], k) => {
        const piece = { ...w, id: `${w.id}-${k + 1}`, a: { x: r6(w.a.x + wu.x * lo), z: r6(w.a.z + wu.z * lo) }, b: { x: r6(w.a.x + wu.x * hi), z: r6(w.a.z + wu.z * hi) }, how: `${w.how ? `${w.how}; ` : ''}the part ${lo.toFixed(2)}–${hi.toFixed(2)} m not already built` }
        lv.walls.push({ ...piece, id: `plan-${piece.id}`, how: `from the storey's plan reading; ${piece.how}` })
        added.walls += 1
        for (const d of plan.doors.filter((q) => q.wallId === w.id && q.offset >= lo && q.offset + q.width <= hi)) {
          lv.doors.push({ ...d, id: `plan-${d.id}`, wallId: `plan-${piece.id}`, offset: r6(d.offset - lo) })
          added.doors += 1
        }
      })
      for (const d of plan.doors.filter((q) => q.wallId === w.id && !pieces.some(([lo, hi]) => q.offset >= lo && q.offset + q.width <= hi))) lv.dropped.push({ id: d.id, kind: 'door', why: `its partition ${w.id} is partly built already; the door does not lie wholly on the part added nor on a partition there` })
      continue
    }
    // an end that stops on a partition already there is a butt joint: brought back to that partition's face (never
    // into it — the kernel refuses two walls sharing plan area — and never removed)
    const ends = [w.a, w.b].map((end, i) => {
      const other = i === 0 ? w.b : w.a
      const L = Math.hypot(other.x - end.x, other.z - end.z) || 1
      const u = { x: (other.x - end.x) / L, z: (other.z - end.z) / L }
      for (const x of local.walls) {
        const on = toSegment(pt(end.x, end.z), pt(x.a.x, x.a.z), pt(x.b.x, x.b.z))
        const reach = x.thickness / 2 + w.thickness / 2 + 0.03
        if (on.d > reach || on.t < -0.02 || on.t > 1.02) continue
        const xl = Math.hypot(x.b.x - x.a.x, x.b.z - x.a.z) || 1
        const along = Math.abs((u.x * (x.b.x - x.a.x) + u.z * (x.b.z - x.a.z)) / xl)
        if (along > 0.2) continue
        // the signed distance of the end from the other wall's middle line, moved to its face plus a hair
        const nx = -(x.b.z - x.a.z) / xl
        const nz = (x.b.x - x.a.x) / xl
        const sd = (end.x - x.a.x) * nx + (end.z - x.a.z) * nz
        const side = Math.sign((other.x - x.a.x) * nx + (other.z - x.a.z) * nz) || 1
        const want = side * (x.thickness / 2 + 0.002)
        const dt = (want - sd) / (u.x * nx + u.z * nz || 1)
        return { p: { x: r6(end.x + u.x * dt), z: r6(end.z + u.z * dt) }, how: `end ${i === 0 ? 'a' : 'b'} butts on ${x.id}` }
      }
      return { p: end, how: '' }
    })
    const hows = ends.map((e) => e.how).filter(Boolean)
    lv.walls.push({ ...w, a: ends[0].p, b: ends[1].p, id: `plan-${w.id}`, how: `from the storey's plan reading${w.how ? `; ${w.how}` : ''}${hows.length ? `; ${hows.join('; ')}` : ''}` })
    newWalls.add(w.id)
    added.walls += 1
    for (const d of plan.doors.filter((q) => q.wallId === w.id)) {
      lv.doors.push({ ...d, id: `plan-${d.id}`, wallId: `plan-${w.id}` })
      added.doors += 1
    }
  }
  if (added.walls > 0) {
    const rooms: typeof lv.rooms = []
    for (const r of lv.rooms) {
      const inside = plan.rooms.filter((p) => !openRooms.has(p.id) && covered(p.polygon, r.polygon) >= PLAN_INTERIOR_RULES.splitShare)
      if (inside.length < 2) {
        rooms.push(r)
        continue
      }
      const byArea = [...inside].sort((p, q) => Math.abs(signedArea(q.polygon)) - Math.abs(signedArea(p.polygon)))
      byArea.forEach((p, i) => rooms.push({ id: i === 0 ? r.id : `${r.id}-${p.id}`, polygon: p.polygon, ...(p.usage ?? r.usage ? { usage: (p.usage ?? r.usage) as string } : {}) }))
      added.rooms += byArea.length - 1
    }
    lv.rooms = rooms
  }
  if (local.voids.length === 0 && plan.voids.length > 0) {
    lv.voids.push(...plan.voids)
    added.voids += plan.voids.length
  }
  return { level: lv, added }
}

/** The plan readings of every storey, placed and merged into `interior` (which may hold a LOCAL import). */
export function interiorFromStoreys(storeys: readonly StoreyObs[], g: Pick<HouseGeometry, 'outlines' | 'levels' | 'wallThicknessM'>, interior: HouseInterior): InteriorResolution {
  const checks: InteriorResolution['checks'] = []
  const knownDefects: InteriorResolution['knownDefects'] = []
  const out: HouseInterior = { ...interior, levels: [...interior.levels], read: [...(interior.read ?? [])] }
  for (const st of storeys) {
    const src = storeySource(st, g)
    if (!src) {
      out.read?.push({ level: st.level, status: 'NOT_PLACED', how: `the house has no level ${st.level} outline to register the plan on` })
      continue
    }
    const ir = resolveInterior(src, g, { registerLevel: st.level, oriented: true })
    checks.push(...ir.checks.map((c) => ({ ...c, id: `${c.id}-plan-${st.level}` })))
    const placed = ir.interior.levels.find((l) => l.level === st.level)
    if (ir.interior.transform && (!placed || placed.walls.length + placed.rooms.length + placed.doors.length + placed.voids.length === 0)) {
      out.read?.push({ level: st.level, status: 'PLACED', how: `${ir.interior.transform.how}; registered, nothing of its interior to place`, added: { walls: 0, doors: 0, rooms: 0, voids: 0 } })
      continue
    }
    if (!placed || ir.interior.status === 'NOT_BUILT') {
      knownDefects.push(...ir.knownDefects.map((k) => ({ ...k, what: `storey ${st.level} plan: ${k.what}` })))
      out.read?.push({ level: st.level, status: 'NOT_PLACED', how: ir.interior.note ?? 'not placed' })
      continue
    }
    const at = out.levels.findIndex((l) => l.level === st.level)
    const merged = mergePlanLevel(at >= 0 ? out.levels[at] : undefined, placed, new Set(st.rooms.filter((r) => r.open).map((r) => r.id)))
    if (at >= 0) out.levels[at] = merged.level
    else out.levels.push(merged.level)
    out.read?.push({ level: st.level, status: 'PLACED', how: `${ir.interior.transform?.how ?? ''}; ${merged.level.origin === 'PLAN' ? 'the level comes from the plan reading' : 'merged with the LOCAL import (nothing it placed removed)'}`, added: merged.added })
  }
  out.levels.sort((p, q) => p.level - q.level)
  const any = out.levels.some((l) => l.walls.length + l.rooms.length > 0)
  if (any && out.status === 'NOT_BUILT') out.status = 'PARTIAL'
  if (out.read?.some((r) => r.status === 'PLACED')) out.note = `${out.note ? `${out.note}; ` : ''}plan readings: ${out.read.map((r) => `storey ${r.level} ${r.status}${r.added ? ` (+${r.added.walls} partition(s), +${r.added.doors} door(s), +${r.added.rooms} room(s))` : ''}`).join(', ')}`
  return { interior: out, checks, knownDefects }
}
