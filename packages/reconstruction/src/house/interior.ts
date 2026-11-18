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
import type { HouseGeometry, HouseInterior, HouseInteriorSource } from './document.js'
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

export function resolveInterior(src: HouseInteriorSource, g: Pick<HouseGeometry, 'outlines' | 'levels' | 'wallThicknessM'> & { openings?: HouseGeometry['openings'] }): InteriorResolution {
  const checks: InteriorResolution['checks'] = []
  const knownDefects: InteriorResolution['knownDefects'] = []
  const none = (note: string): InteriorResolution => ({ interior: { status: 'NOT_BUILT', note, source: { origin: src.origin, modelHash: src.modelHash }, levels: [] }, checks, knownDefects })
  const ground = g.outlines.find((o) => o.level === 0)?.polygon.map((p) => pt(p.x, p.z))
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
  const tried = [make(false, false), make(true, false), make(false, true), make(true, true)].map((t) => {
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
  const second = byOpenings ? { overlap: tried[0].overlap - 0.03 - 1e-9, t: tied[1].t } : tried[1]
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
