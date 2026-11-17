/**
 * v3.54.4 — from a house document's OBSERVATIONS (pixels of the pictures) to its agreed GEOMETRY (metres, model frame).
 *
 * The same function for every origin of the observations — a reader's, the drawings' path's or a hand-checked diagnostic:
 * nothing here knows who read them, a publisher or a house. It is deterministic, and it decides in the order the things
 * depend on one another (Master Plan v3.54.4 §7.4):
 *   metric and frame → bodies and levels → roofs → elevations registered to the bodies → openings → dependent features.
 * A check that fails holds what depends on it — a dormer on a roof whose body is in doubt, the openings of an elevation
 * that does not register — and leaves the rest standing; what is held is kept in `verification.held` for rebinding.
 *
 * What it will not do: fit a traced part to a published area by changing the scale of a plan that prints a dimension;
 * stretch an elevation separately along and up to make openings land; read metres off a perspective picture; give an
 * estimate the basis of a print. An UNKNOWN stays `null`.
 */
import type { Basis, HouseCheck, HouseDocument, HouseGeometry, HouseObservations, HouseSide, HouseVerification, HouseViewRecord, Num } from './document.js'
import { num, unknown } from './document.js'
import { area, bbox, canonical, contains, edgeOf, isSimple, onBoundary, pt, squareUp, unionTiling } from './poly.js'
import type { P2 } from './poly.js'

export const HOUSE_RESOLVER_NAME = 'reconstruction.house-resolver' as const
export const HOUSE_RESOLVER_VERSION = '0.2.0' as const

/** Fixed before any confirmation; each with what it means. */
export const RESOLVE = {
  /** Two printed dimensions on the two axes of one plan may differ this much in the scale they give (the drawing is one scale). */
  isotropy: 0.03,
  /** A dimension line's end counts as standing on the outline's end within this share of the extent (and never under 6 px). */
  dimensionOnOutline: 0.015,
  /** The bodies traced one by one must cover the whole traced outline within this share of its area. */
  bodiesCoverWhole: 0.04,
  /** An elevation's wall ends, mapped along the side by ONE scale, must land on the bodies' ends within this (m) or this share. */
  elevationAlongM: 0.45,
  elevationAlongShare: 0.04,
  /** The ridge height an elevation shows at that same scale must agree with the house's ridge height within this share. */
  elevationRise: 0.12,
  /** The printed total height and the published building height must agree with ridge − terrain within this (m). */
  heightAgreeM: 0.35,
  /** A printed ridge may leave the eaves this far above one storey over the top floor before it is not this roof's ridge. */
  ridgeOverStoreyM: 1.2,
  /** A door threshold or a ridge anchor is taken as the picture's ±0,00 only within this of what the ground line gives (m). */
  datumAgreeM: 0.6,
  /** Two boxes read side by side at one height with less than this between them are the panels of ONE opening: half a brick — no masonry pier is thinner. */
  mullionM: 0.125,
  /** Wall lines of traced outlines closer than this are one line (a reader's pixel is 1–2 cm; its hand is ±10 px). */
  mergeCoordinatesM: 0.2,
  bay: { maxDepthM: 2.5, maxWidthM: 6, maxShare: 0.2 },
  defaults: { wallThicknessM: 0.4, slabThicknessM: 0.3, storeyHeightM: 2.8, kneeWallM: 1.0, pitchDeg: 35, overhangM: 0.5, terrainY: -0.3, sillM: 0.9, balconyDepthM: 1.2 },
} as const

export type ResolveResult = { geometry?: HouseGeometry; verification: HouseVerification }

const r3 = (v: number): number => Math.round(v * 1000) / 1000
const SIDE_NORMAL: Record<HouseSide, P2> = { FRONT: { x: 0, z: -1 }, REAR: { x: 0, z: 1 }, LEFT: { x: -1, z: 0 }, RIGHT: { x: 1, z: 0 } }

/** A body outline without its splayed bays, and the bays: each chain that leaves a straight wall line by a slanted wall and returns to it. */
export function splitBays(poly: P2[]): { core: P2[]; bays: P2[][] } {
  const n = poly.length
  const slanted = (i: number): boolean => {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const dx = Math.abs(b.x - a.x)
    const dz = Math.abs(b.z - a.z)
    return Math.min(dx, dz) > 0.105 * Math.max(dx, dz)
  }
  const total = area(poly)
  const bays: P2[][] = []
  const drop = new Set<number>()
  for (let i = 0; i < n; i += 1) {
    if (!slanted(i) || drop.has(i) || drop.has((i + 1) % n)) continue
    // from vertex i, follow until the outline is back on the line vertex i stands on
    const start = poly[i]
    for (let len = 2; len <= 5 && len < n - 2; len += 1) {
      const e = (i + len) % n
      const end = poly[e]
      const onX = Math.abs(end.x - start.x) < 0.08
      const onZ = Math.abs(end.z - start.z) < 0.08
      if (!onX && !onZ) continue
      if (!slanted((e + n - 1) % n)) continue
      const chain = Array.from({ length: len + 1 }, (_, k) => poly[(i + k) % n])
      const width = Math.hypot(end.x - start.x, end.z - start.z)
      const depth = Math.max(...chain.map((q) => (onX ? Math.abs(q.x - start.x) : Math.abs(q.z - start.z))))
      const a = area(chain)
      if (width > RESOLVE.bay.maxWidthM || depth > RESOLVE.bay.maxDepthM || depth < 0.3 || a > RESOLVE.bay.maxShare * total || a < 0.3) continue
      // the bay must stand OUT of the body: the chord start→end lies inside or on the outline
      const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }
      const bayMid = chain.reduce((s, q) => ({ x: s.x + q.x / chain.length, z: s.z + q.z / chain.length }), { x: 0, z: 0 })
      const probe = { x: mid.x + (mid.x - bayMid.x) * 0.2, z: mid.z + (mid.z - bayMid.z) * 0.2 }
      if (!contains(poly, probe)) continue
      bays.push(canonical(chain))
      for (let k = 1; k < len; k += 1) drop.add((i + k) % n)
      break
    }
  }
  if (bays.length === 0) return { core: poly, bays }
  const core = canonical(poly.filter((_, i) => !drop.has(i)))
  return isSimple(core) && core.length >= 3 ? { core, bays } : { core: poly, bays: [] }
}

export function resolveHouse(doc: HouseDocument): ResolveResult {
  const o: HouseObservations = doc.observations
  const checks: HouseCheck[] = []
  const held: HouseVerification['held'] = []
  const knownDefects: HouseVerification['knownDefects'] = []
  const parameters: HouseVerification['parameters'] = []
  const check = (id: string, scope: HouseCheck['scope'], what: string, expected: string, measured: string, status: HouseCheck['status'], blocks: string[] = []): boolean => {
    checks.push({ id, scope, what, expected, measured, status, blocks })
    return status === 'PASS'
  }
  const fail = (): ResolveResult => ({ verification: { parameters, checks, held, knownDefects, coverage: {}, quantities: 'NOT_USABLE', views: [], openings: [] } })

  // --- 0. identity: the pictures read are this house's ---------------------------------------------------------------
  const pictures = new Map(doc.source.pictures.map((p) => [p.id, p]))
  const foreign = doc.source.pictures.filter((p) => !p.thisHouse)
  check('identity', 'IDENTITY', 'every observation comes from a picture of this house', 'no observation on a picture marked as another house', `${foreign.length} picture(s) marked as not this house; observations on them: ${[...o.dimensions, ...o.levels, ...o.outlines, ...o.elevations].filter((x) => foreign.some((f) => f.id === x.picture)).length}`, [...o.dimensions, ...o.levels, ...o.outlines, ...o.elevations].some((x) => foreign.some((f) => f.id === x.picture)) ? 'FAIL' : 'PASS')

  // --- 1. the plan: frame and metric -----------------------------------------------------------------------------------
  const whole = o.outlines.find((x) => x.what === 'WHOLE' && x.level === 0)
  const bodyObs = o.outlines.filter((x) => x.what === 'BODY' && x.bodyId)
  const groundBodies = bodyObs.filter((x) => x.level === 0)
  const planPic = whole?.picture ?? groundBodies[0]?.picture
  if (!planPic || (!whole && groundBodies.length === 0)) {
    check('plan', 'BODIES', 'a ground-floor outline', 'a traced outline of the ground storey', 'none observed', 'FAIL', ['geometry'])
    return fail()
  }
  const tracedPx = whole?.polygon ?? groundBodies.flatMap((b) => b.polygon)
  const box = { x0: Math.min(...tracedPx.map((p) => p.x)), x1: Math.max(...tracedPx.map((p) => p.x)), y0: Math.min(...tracedPx.map((p) => p.y)), y1: Math.max(...tracedPx.map((p) => p.y)) }
  const edge = o.front?.planEdge ?? 'BOTTOM'
  const horizontalIsX = edge === 'BOTTOM' || edge === 'TOP'
  // metres per pixel along the sheet's two axes
  const dims = o.dimensions.filter((d) => d.picture === planPic && d.valueM !== null)
  type AxisScale = { mpp: number; basis: Basis; refs: string[]; how: string }
  const scaleOf = (sheetAxis: 'H' | 'V'): AxisScale | undefined => {
    const ext = sheetAxis === 'H' ? box.x1 - box.x0 : box.y1 - box.y0
    const lo = sheetAxis === 'H' ? box.x0 : box.y0
    const hi = sheetAxis === 'H' ? box.x1 : box.y1
    const tol = Math.max(6, RESOLVE.dimensionOnOutline * ext)
    const cands = dims
      .filter((d) => (Math.abs(d.to.x - d.from.x) >= Math.abs(d.to.y - d.from.y)) === (sheetAxis === 'H'))
      .map((d) => {
        const a = sheetAxis === 'H' ? Math.min(d.from.x, d.to.x) : Math.min(d.from.y, d.to.y)
        const b = sheetAxis === 'H' ? Math.max(d.from.x, d.to.x) : Math.max(d.from.y, d.to.y)
        return { d, a, b, len: b - a, onOutline: Math.abs(a - lo) <= tol && Math.abs(b - hi) <= tol }
      })
      .filter((c) => c.len > 10)
    // a dimension whose two ends stand on the outline's two ends measures the outline: the outline is its object
    const overall = cands.filter((c) => c.onOutline && c.d.measures !== 'PART').sort((p, q) => q.len - p.len)[0]
    if (overall) return { mpp: (overall.d.valueM as number) / ext, basis: 'DERIVED', refs: [overall.d.id], how: `the printed ${overall.d.literal} ${overall.d.unit} = ${overall.d.valueM} m ends on the traced outline's two ends (${Math.round(ext)} px)` }
    const other = cands.sort((p, q) => q.len - p.len)[0]
    if (other) return { mpp: (other.d.valueM as number) / other.len, basis: 'DERIVED', refs: [other.d.id], how: `the printed ${other.d.literal} ${other.d.unit} = ${other.d.valueM} m over its own ${Math.round(other.len)} px (it does not end on the outline: ${other.d.includes ?? other.d.measures})` }
    return undefined
  }
  const sH = scaleOf('H')
  const sV = scaleOf('V')
  let mppH: number
  let mppV: number
  let metricBasis: Basis = 'DERIVED'
  let metricRefs: string[] = []
  let metricHow = ''
  if (sH && sV) {
    const ratio = sH.mpp / sV.mpp
    const ok = Math.abs(Math.log(ratio)) <= RESOLVE.isotropy
    check('metric', 'METRIC', 'the plan has one scale on its two axes', `the two printed dimensions give scales within ${RESOLVE.isotropy * 100} %`, `${(sH.mpp * 100).toFixed(4)} and ${(sV.mpp * 100).toFixed(4)} cm/px (ratio ${ratio.toFixed(4)}); ${sH.how}; ${sV.how}`, ok ? 'PASS' : 'FAIL', ok ? [] : ['quantities'])
    if (ok) {
      mppH = sH.mpp
      mppV = sV.mpp
    } else {
      // one of the two does not measure what it was taken to measure: the longer line is kept for both axes, and it is said
      const keep = sH.mpp * (box.x1 - box.x0) >= sV.mpp * (box.y1 - box.y0) ? sH : sV
      mppH = keep.mpp
      mppV = keep.mpp
      metricBasis = 'ESTIMATED'
      knownDefects.push({ code: 'PLAN_DIMENSIONS_DISAGREE', what: `the two printed dimensions give different scales (${ratio.toFixed(3)}): one of them does not measure the traced outline; the model stands on ${keep.how}` })
    }
    metricRefs = [...sH.refs, ...sV.refs]
    metricHow = `${sH.how}; ${sV.how}`
  } else if (sH || sV) {
    const s = (sH ?? sV) as AxisScale
    mppH = s.mpp
    mppV = s.mpp
    metricRefs = s.refs
    metricHow = `${s.how}; the other axis has no printed dimension: one scale is assumed for both`
    check('metric', 'METRIC', 'the plan has one scale on its two axes', 'a printed dimension on each axis', 'one axis only: isotropy assumed, not measured', 'UNKNOWN')
  } else {
    const published = o.published.find((p) => p.key === 'footprint_area')
    if (!published || !whole) {
      check('metric', 'METRIC', 'a metric for the plan', 'a printed dimension with its two ends', 'no printed dimension on the plan, and no published footprint over a whole traced outline', 'FAIL', ['geometry'])
      return fail()
    }
    const pxArea = area(whole.polygon.map((p) => ({ x: p.x, z: p.y })))
    mppH = Math.sqrt(published.value / pxArea)
    mppV = mppH
    metricBasis = 'ESTIMATED'
    metricHow = `no dimension is printed on the plan: the WHOLE traced outline (${Math.round(pxArea)} px²) is taken to be the published footprint ${published.value} m² — an estimate of size, not a measurement`
    knownDefects.push({ code: 'SCALE_FROM_PUBLISHED_AREA', what: metricHow })
    check('metric', 'METRIC', 'a metric for the plan', 'a printed dimension with its two ends', 'none: scale estimated from the published footprint over the whole outline', 'UNKNOWN', ['quantities'])
  }
  parameters.push({ path: 'geometry.frame#metresPerPixel', state: 'ACCEPTED', consumer: 'resolveHouse/metric', programIds: [], meshIds: [], built: r3(mppH * 100) / 100, why: metricHow })
  // sheet pixel → model plan point (x along the front from the left seen from outside; z from the front into the house)
  const toModel = (p: { x: number; y: number }): P2 =>
    edge === 'BOTTOM' ? pt((p.x - box.x0) * mppH, (box.y1 - p.y) * mppV) : edge === 'TOP' ? pt((box.x1 - p.x) * mppH, (p.y - box.y0) * mppV) : edge === 'LEFT' ? pt((p.y - box.y0) * mppV, (p.x - box.x0) * mppH) : pt((box.y1 - p.y) * mppV, (box.x1 - p.x) * mppH)
  check('front', 'ORIENTATION', 'the plan edge the front facade is on', 'stated with how it is known', o.front ? `${o.front.planEdge}: ${o.front.how}` : 'not stated: the sheet bottom is assumed', o.front ? 'PASS' : 'UNKNOWN')
  void horizontalIsX

  // --- 2. bodies ---------------------------------------------------------------------------------------------------------
  const ids = [...new Set(bodyObs.map((b) => b.bodyId as string))]
  const raw = ids.map((id) => {
    const at0 = groundBodies.find((b) => b.bodyId === id) ?? bodyObs.find((b) => b.bodyId === id)
    const every = bodyObs.filter((b) => b.bodyId === id)
    const storeys = [...new Set([...every.map((b) => b.level), ...every.flatMap((b) => b.storeys ?? [])])].sort((p, q) => p - q)
    return { id, role: at0?.role ?? 'OTHER', storeys, px: (at0 as NonNullable<typeof at0>).polygon, ref: (at0 as NonNullable<typeof at0>).id }
  })
  if (raw.length === 0 && whole) raw.push({ id: 'main', role: 'MAIN', storeys: [...new Set([0, ...(whole.storeys ?? [])])], px: whole.polygon, ref: whole.id })
  const wholeM = whole ? canonical(whole.polygon.map(toModel)) : undefined
  const squaredAll = squareUp([...raw.map((b) => canonical(b.px.map(toModel))), ...(wholeM ? [wholeM] : [])], 6, RESOLVE.mergeCoordinatesM)
  const wholeSq = wholeM ? canonical(squaredAll[squaredAll.length - 1]) : undefined
  // A splayed bay traced as part of a body is its own body: its walls are not that body's eaves walls and the body's
  // roof does not widen over it. The chain between two corners of one straight wall line, leaving it by a slanted wall
  // and coming back by another, is cut off along that line.
  const bodyPolys: P2[][] = []
  // as traced, bays included: what an elevation's wall ends of that body stand on
  const tracedPolys: P2[][] = []
  raw.slice().forEach((b, i) => {
    const cut = splitBays(canonical(squaredAll[i]))
    bodyPolys[i] = cut.core
    tracedPolys[i] = canonical(squaredAll[i])
    cut.bays.forEach((bay, n) => {
      raw.push({ id: `${b.id}-bay${cut.bays.length > 1 ? `-${n + 1}` : ''}`, role: 'BAY', storeys: [Math.min(...b.storeys)], px: b.px, ref: b.ref })
      bodyPolys[raw.length - 1] = bay
      knownDefects.push({ code: 'BAY_SPLIT_FROM_BODY', what: `body ${b.id}: a splayed bay of ${area(bay).toFixed(1)} m² traced inside its outline is built as a body of its own` })
    })
  })
  const bad = bodyPolys.findIndex((p) => !isSimple(p))
  if (bad >= 0) {
    check('bodies', 'BODIES', 'every body outline is a simple polygon', 'simple polygons', `body ${raw[bad].id} is not`, 'FAIL', ['geometry'])
    return fail()
  }
  const outlineOf = (level: number): P2[] | undefined => {
    const here = bodyPolys.filter((_, i) => raw[i].storeys.includes(level))
    if (here.length === 0) return undefined
    const loops = unionTiling(here, 0.05)
    return loops.length > 0 ? canonical(loops[0]) : undefined
  }
  const levelIndices = [...new Set(raw.flatMap((b) => b.storeys))].sort((p, q) => p - q)
  const outlines = levelIndices.map((level) => ({ level, polygon: outlineOf(level) })).filter((x): x is { level: number; polygon: P2[] } => x.polygon !== undefined && isSimple(x.polygon))
  const ground = outlines.find((x) => x.level === 0)
  if (!ground) {
    check('bodies', 'BODIES', 'the bodies make one ground outline', 'one closed outline', 'the bodies traced do not join into one outline', 'FAIL', ['geometry'])
    return fail()
  }
  const sumBodies = bodyPolys.filter((_, i) => raw[i].storeys.includes(0)).reduce((s, p) => s + area(p), 0)
  let bodiesOk = true
  if (wholeSq) {
    const aw = area(wholeSq)
    const au = area(ground.polygon)
    const cover = Math.abs(au - aw) / aw
    const overlap = Math.abs(sumBodies - au) / au
    bodiesOk = cover <= RESOLVE.bodiesCoverWhole && overlap <= RESOLVE.bodiesCoverWhole
    check('bodies', 'BODIES', 'the bodies traced one by one are the whole traced outline', `their union within ${RESOLVE.bodiesCoverWhole * 100} % of the whole outline's area, without overlap`, `whole ${aw.toFixed(1)} m², union ${au.toFixed(1)} m², sum of bodies ${sumBodies.toFixed(1)} m²`, bodiesOk ? 'PASS' : 'FAIL', bodiesOk ? [] : ['roofs', 'openings', 'features', 'quantities'])
    if (!bodiesOk) knownDefects.push({ code: 'BODIES_DO_NOT_COVER_OUTLINE', what: `the bodies' union is ${au.toFixed(1)} m² where the whole outline traced is ${aw.toFixed(1)} m²: a body is missing, doubled or misplaced` })
  } else check('bodies', 'BODIES', 'the bodies traced one by one are the whole traced outline', 'a whole outline to compare with', 'no whole outline was traced: the union of the bodies stands unchecked', 'UNKNOWN')
  const gb = bbox(ground.polygon)
  // the built extent against every OVERALL dimension, like with like
  for (const d of dims.filter((x) => x.measures === 'OVERALL')) {
    const alongSheetH = Math.abs(d.to.x - d.from.x) >= Math.abs(d.to.y - d.from.y)
    const modelX = (edge === 'BOTTOM' || edge === 'TOP') === alongSheetH
    const ext = modelX ? gb.x1 - gb.x0 : gb.z1 - gb.z0
    const err = Math.abs(ext - (d.valueM as number))
    // a printed overall dimension whose line runs past the traced walls (it takes in a porch, a terrace, steps) measures
    // more than the walled outline: at the plan's own scale its line is longer than the outline by what it takes in.
    // That is not a contradiction; an outline LONGER than a printed overall dimension is.
    const pxLen = alongSheetH ? Math.abs(d.to.x - d.from.x) : Math.abs(d.to.y - d.from.y)
    const pxOutline = alongSheetH ? box.x1 - box.x0 : box.y1 - box.y0
    const lineM = pxLen * (alongSheetH ? mppH : mppV)
    if (err > Math.max(0.1, 0.01 * (d.valueM as number)) && ext < (d.valueM as number) && pxLen > pxOutline * 1.03 && Math.abs(lineM - (d.valueM as number)) <= 0.04 * (d.valueM as number)) {
      check(`extent-${d.id}`, 'METRIC', `the outline's ${modelX ? 'width' : 'depth'} against the printed ${d.literal}`, `${d.valueM} m (what it includes: ${d.includes ?? 'not said'})`, `${ext.toFixed(2)} m of walls; the dimension line is ${lineM.toFixed(2)} m long at the plan's scale and runs ${(lineM - ext).toFixed(2)} m past the walled outline: it measures more than the walls`, 'PASS')
      continue
    }
    check(`extent-${d.id}`, 'METRIC', `the outline's ${modelX ? 'width' : 'depth'} against the printed ${d.literal}`, `${d.valueM} m (what it includes: ${d.includes ?? 'the walled outline'})`, `${ext.toFixed(2)} m`, err <= Math.max(0.1, 0.01 * (d.valueM as number)) ? 'PASS' : 'FAIL', err <= Math.max(0.1, 0.01 * (d.valueM as number)) ? [] : ['quantities'])
  }
  const footprint = o.published.find((p) => p.key === 'footprint_area')
  if (footprint && metricBasis !== 'ESTIMATED') check('footprint', 'BODIES', 'the ground outline against the published footprint (a check, never a scale)', `${footprint.value} m² (a published figure; what it counts is the publisher's)`, `${area(ground.polygon).toFixed(1)} m²`, Math.abs(area(ground.polygon) - footprint.value) / footprint.value <= 0.1 ? 'PASS' : 'UNKNOWN')

  // --- 3. levels ---------------------------------------------------------------------------------------------------------
  const D = RESOLVE.defaults
  const lv = (meaning: string): typeof o.levels => o.levels.filter((x) => x.meaning === meaning && x.valueM !== null)
  const floors = [...lv('UPPER_FLOOR')].sort((p, q) => (p.valueM as number) - (q.valueM as number))
  const ridges = lv('RIDGE')
  const terrainObs = lv('TERRAIN').sort((p, q) => (p.valueM as number) - (q.valueM as number))[0]
  const terrainY: Num = terrainObs ? num(terrainObs.valueM as number, 'PRINTED', `the terrain mark ${terrainObs.literal}`, [terrainObs.id]) : num(D.terrainY, 'DEFAULT', 'no terrain mark read: a convention, for drawing only')
  const clear = lv('CLEAR_HEIGHT')
  const levels: HouseGeometry['levels'] = levelIndices.map((index, i) => {
    const printed = index === 0 ? lv('GROUND_FLOOR')[0] : floors[index - 1]
    const elevation: Num = index === 0 ? num(0, printed ? 'PRINTED' : 'DERIVED', printed ? `the ±0,00 mark ${printed.literal}` : 'the datum the levels are measured from', printed ? [printed.id] : []) : printed ? num(printed.valueM as number, 'PRINTED', `the floor mark ${printed.literal}`, [printed.id]) : num(r3(index * D.storeyHeightM), 'DEFAULT', 'no floor mark read for this storey: a conventional storey height below it')
    const next = floors[index]
    const cl = clear.find((c) => c.level === index)
    const height: Num =
      i + 1 < levelIndices.length && next && elevation.value !== null
        ? num(r3((next.valueM as number) - elevation.value), 'DERIVED', `between the floor marks ${printed?.literal ?? '±0,00'} and ${next.literal}`, [next.id, ...(printed ? [printed.id] : [])])
        : cl
          ? num(r3((cl.valueM as number) + D.slabThicknessM), 'DERIVED', `the printed clear height ${cl.literal} and a floor build-up of ${D.slabThicknessM} m`, [cl.id])
          : num(D.storeyHeightM, 'DEFAULT', 'no height printed for this storey: a convention')
    return { id: `L${index}`, index, elevation, height }
  })
  const topElevation = (b: { storeys: number[] }): number => levels.find((l) => l.index === Math.max(...b.storeys))?.elevation.value ?? 0

  // --- 4. roofs ----------------------------------------------------------------------------------------------------------
  const pitchObs = lv('ROOF_PITCH_DEG')[0]
  const pitchPub = o.published.find((p) => p.key === 'roof_pitch')
  const publishedHeight = o.published.find((p) => p.key === 'building_height')
  const total = lv('TOTAL_HEIGHT')[0]
  const mainId = raw.find((b) => b.role === 'MAIN')?.id ?? raw.slice().sort((p, q) => area(bodyPolys[raw.indexOf(q)]) - area(bodyPolys[raw.indexOf(p)]))[0].id
  // --- 5. elevations registered to the bodies (needed by the roofs of bodies no section measures) ---
  type Reg = { obs: (typeof o.elevations)[number]; side: HouseSide; s: number; t: number; ok: boolean; why: string; yOf: (py: number) => number; alongOf: (px: number) => number; res: number; n: number; unresolved?: string; zeroRow: number; zeroHow: string }
  const alongOfPoint = (side: HouseSide, p: P2): number => (side === 'FRONT' ? p.x - gb.x0 : side === 'REAR' ? gb.x1 - p.x : side === 'LEFT' ? gb.z1 - p.z : p.z - gb.z0)
  const bodyExtent = (side: HouseSide, id: string): [number, number] | undefined => {
    const i = raw.findIndex((b) => b.id === id)
    if (i < 0) return undefined
    const a = (tracedPolys[i] ?? bodyPolys[i]).map((p) => alongOfPoint(side, p))
    return [Math.min(...a), Math.max(...a)]
  }
  const fit = (obs: (typeof o.elevations)[number], side: HouseSide): { s: number; t: number; maxRes: number; n: number } | undefined => {
    const pts: Array<[number, number]> = []
    for (const b of obs.bodies) {
      const ext = bodyExtent(side, b.bodyId)
      if (!ext) continue
      const [l, r] = obs.mirrored ? [b.rightX, b.leftX] : [b.leftX, b.rightX]
      pts.push([l, ext[0]], [r, ext[1]])
    }
    if (pts.length < 2) return undefined
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const ma = pts.reduce((s, p) => s + p[1], 0) / pts.length
    const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0)
    if (sxx < 1) return undefined
    const s = pts.reduce((q, p) => q + (p[0] - mx) * (p[1] - ma), 0) / sxx
    const t = ma - s * mx
    return { s, t, maxRes: Math.max(...pts.map((p) => Math.abs(s * p[0] + t - p[1]))), n: pts.length }
  }
  /** The bodies a viewer on `side` has nearest in front, each with the share of that side's length it is the nearest over. */
  const sideShows = (side: HouseSide): Array<{ bodyId: string; share: number }> => {
    const span = side === 'FRONT' || side === 'REAR' ? gb.x1 - gb.x0 : gb.z1 - gb.z0
    const depthAt = (p: P2): number => (side === 'FRONT' ? p.z : side === 'REAR' ? -p.z : side === 'LEFT' ? p.x : -p.x)
    const count = new Map<string, number>()
    const N = 40
    for (let k = 0; k < N; k += 1) {
      const a = ((k + 0.5) / N) * span
      let pick: { id: string; d: number } | undefined
      raw.forEach((b, i) => {
        const poly = bodyPolys[i]
        for (let j = 0; j < poly.length; j += 1) {
          const p = poly[j]
          const q = poly[(j + 1) % poly.length]
          const ap = alongOfPoint(side, p)
          const aq = alongOfPoint(side, q)
          if (Math.min(ap, aq) > a || Math.max(ap, aq) < a || Math.abs(ap - aq) < 1e-9) continue
          const t = (a - ap) / (aq - ap)
          const d = depthAt({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
          if (!pick || d < pick.d - 1e-6) pick = { id: b.id, d }
        }
      })
      if (pick) count.set(pick.id, (count.get(pick.id) ?? 0) + 1)
    }
    return [...count.entries()].map(([bodyId, n]) => ({ bodyId, share: n / N }))
  }
  const ridgePrintedMain = ridges.find((r) => r.bodyId === mainId) ?? (ridges.length > 0 ? ridges.slice().sort((p, q) => (q.valueM as number) - (p.valueM as number))[0] : undefined)
  const regs: Reg[] = []
  const notRegistered: Array<{ obs: (typeof o.elevations)[number]; why: string }> = []
  for (const obs of o.elevations) {
    const pic = pictures.get(obs.picture)
    if (obs.projection !== 'ORTHOGRAPHIC' || pic?.thisHouse === false) {
      check(`elevation-${obs.id}`, 'ORIENTATION', `elevation ${obs.id} registers to the plan`, 'an orthographic picture of this house', obs.projection !== 'ORTHOGRAPHIC' ? `${obs.projection}: no metre is read off it` : 'a picture of another house', 'FAIL', ['openings', 'features'])
      for (const x of [...obs.openings, ...obs.features]) held.push({ ref: `${obs.id}/${x.id}`, code: 'HELD_BY_DEPENDENCY', why: obs.projection !== 'ORTHOGRAPHIC' ? 'seen on a perspective picture: presence only, no position in metres' : 'seen on a picture of another house' })
      notRegistered.push({ obs, why: obs.projection !== 'ORTHOGRAPHIC' ? 'a perspective picture: no metre is read off it' : 'a picture of another house' })
      continue
    }
    const tries: HouseSide[] = [obs.side, ...obs.alternatives.filter((a) => a !== obs.side)]
    let best: { side: HouseSide; f: NonNullable<ReturnType<typeof fit>> } | undefined
    for (const side of tries) {
      const f = fit(obs, side)
      if (!f || f.s <= 0) continue
      const span = side === 'FRONT' || side === 'REAR' ? gb.x1 - gb.x0 : gb.z1 - gb.z0
      if (f.maxRes <= Math.max(RESOLVE.elevationAlongM, RESOLVE.elevationAlongShare * span) && (!best || f.maxRes < best.f.maxRes)) best = { side, f }
    }
    // A side shows the bodies that stand nearest the viewer there. An elevation read as a side whose nearest body (over
    // half of that side) it does not name, while it names the bodies of the OPPOSITE side and fits there, is the
    // opposite side: two gable ends of one house fit a plain plan equally, and only what stands in front tells them apart.
    if (best && best.side === obs.side) {
      const opposite: HouseSide = obs.side === 'LEFT' ? 'RIGHT' : obs.side === 'RIGHT' ? 'LEFT' : obs.side === 'FRONT' ? 'REAR' : 'FRONT'
      const named = new Set(obs.bodies.map((b) => b.bodyId))
      const misses = (sd: HouseSide): string[] => sideShows(sd).filter((x) => x.share >= 0.5 && !named.has(x.bodyId)).map((x) => x.bodyId)
      const fo = fit(obs, opposite)
      const span = opposite === 'FRONT' || opposite === 'REAR' ? gb.x1 - gb.x0 : gb.z1 - gb.z0
      if (misses(obs.side).length > 0 && misses(opposite).length === 0 && fo && fo.s > 0 && fo.maxRes <= Math.max(RESOLVE.elevationAlongM, RESOLVE.elevationAlongShare * span)) {
        knownDefects.push({ code: 'SIDE_BY_BODIES', what: `${obs.id}: stated ${obs.side}, but the body that stands in front on that side (${misses(obs.side).join(', ')}) is not on the picture; the bodies it names are those of the ${opposite} side, where it fits as well: taken as ${opposite}` })
        best = { side: opposite, f: fo }
      }
    }
    // A stated side that does not register is NOT tried on the other sides: a mirrored front elevation fits the rear of
    // the plan perfectly, and would put a mirrored house's openings there. It is held, and said.
    const f0 = fit(obs, obs.side)
    if (!best) {
      const why = !f0 ? 'no body of the plan is named on it' : f0.s <= 0 ? 'its bodies stand in the opposite order to the plan seen from that side: mirrored, or another side' : `its wall ends land ${f0.maxRes.toFixed(2)} m off the bodies' ends at one scale`
      check(`elevation-${obs.id}`, 'ORIENTATION', `elevation ${obs.id} (${obs.side}) registers to the plan's bodies`, 'its wall ends on the bodies\' ends at ONE scale, in the plan\'s order', why, 'FAIL', ['openings', 'features'])
      knownDefects.push({ code: 'ELEVATION_NOT_REGISTERED', what: `${obs.id} (${obs.side}): ${why}; its ${obs.openings.length} opening(s) and ${obs.features.length} feature(s) are held` })
      for (const x of [...obs.openings, ...obs.features]) held.push({ ref: `${obs.id}/${x.id}`, code: 'HELD_BY_DEPENDENCY', why: `elevation ${obs.id} does not register to the plan: ${why}` })
      notRegistered.push({ obs, why })
      continue
    }
    const { side, f } = best
    // Where ±0,00 is on this picture (v3.54.5). The row read as the ground line is the terrain on one drawing and the
    // floor line on another; taking it for the terrain put every window a terrain step too low and cut every door that
    // much too short. The thresholds of the ground-floor doors ARE the floor: with one read, the datum is theirs.
    // Without one, the printed ridge seen on this picture gives it; else the ground line and the terrain mark. An anchor
    // more than `datumAgreeM` from the ground-line reading is not taken (a door on a plinth, a chimney for a ridge).
    const zeroByTerrain = obs.groundY + (terrainY.value ?? 0) / f.s
    const yByTerrain = (py: number): number => (zeroByTerrain - py) * f.s
    const thresholds = obs.openings.filter((x) => (x.kind === 'DOOR' || x.kind === 'GLAZED_DOOR') && (x.level === undefined || x.level === 0)).map((x) => Math.max(x.box.y0, x.box.y1)).filter((row) => Math.abs((zeroByTerrain - row) * f.s) <= RESOLVE.datumAgreeM).sort((p, q) => p - q)
    const mainSeen = obs.bodies.find((b) => b.bodyId === mainId && b.ridgeY !== null)
    const zeroByRidge = mainSeen && ridgePrintedMain ? (mainSeen.ridgeY as number) + (ridgePrintedMain.valueM as number) / f.s : undefined
    // No single anchor is trusted: an entrance door stands a step below the floor on one drawing, a glazed door on a
    // raised sill on another, a garage door at the garage's lower floor. The datum is the MIDDLE of the anchors the
    // picture offers — the ground line with the terrain mark, the printed ridge, each door threshold.
    const ridgeAnchor = zeroByRidge !== undefined && Math.abs((zeroByTerrain - zeroByRidge) * f.s) <= RESOLVE.datumAgreeM ? [zeroByRidge] : []
    const floorAnchor = typeof obs.floorY === 'number' && Math.abs((zeroByTerrain - obs.floorY) * f.s) <= RESOLVE.datumAgreeM ? [obs.floorY] : []
    const anchors = [zeroByTerrain, ...ridgeAnchor, ...floorAnchor, ...thresholds].sort((p, q) => p - q)
    const mid = anchors.length % 2 === 1 ? anchors[(anchors.length - 1) / 2] : (anchors[anchors.length / 2 - 1] + anchors[anchors.length / 2]) / 2
    const zero = { row: mid, how: anchors.length === 1 ? `the ground line and the terrain ${terrainY.basis === 'PRINTED' ? 'mark' : 'convention'}` : `the middle of ${anchors.length} anchors: the ground line with the terrain${ridgeAnchor.length ? `, the printed ridge ${ridgePrintedMain?.literal ?? ''}` : ''}${floorAnchor.length ? ', the floor row the reader named' : ''}${thresholds.length ? `, ${thresholds.length} door threshold(s)` : ''}` }
    const yOf = (py: number): number => (zero.row - py) * f.s
    // an anchor the fit did not use: the ridge row at the along scale against the house's ridge height
    const mainOn = obs.bodies.find((b) => b.bodyId === mainId && b.ridgeY !== null)
    let riseOk: boolean | undefined
    let riseSays = 'no printed ridge to compare with'
    const refRidge = ridgePrintedMain ? (ridgePrintedMain.valueM as number) : publishedHeight ? publishedHeight.value + (terrainY.value ?? 0) : undefined
    if (mainOn && refRidge !== undefined) {
      // the check stays independent of the datum chosen above: the ground line and the terrain, as before
      const seen = yByTerrain(mainOn.ridgeY as number)
      riseOk = Math.abs(seen - refRidge) <= RESOLVE.elevationRise * Math.max(1, refRidge - (terrainY.value ?? 0))
      riseSays = `the ridge row gives +${seen.toFixed(2)} m at the along scale; the ${ridgePrintedMain ? 'section prints' : 'published height gives'} +${refRidge.toFixed(2)} m`
    }
    const ok = riseOk !== false
    check(`elevation-${obs.id}`, 'ORIENTATION', `elevation ${obs.id} (${side}${side !== obs.side ? `, stated ${obs.side}` : ''}) registers to the plan's bodies`, `wall ends within ${RESOLVE.elevationAlongM} m at one scale; the ridge height at that scale within ${RESOLVE.elevationRise * 100} %`, `${f.n} wall ends, worst ${f.maxRes.toFixed(2)} m, ${(f.s * 100).toFixed(3)} cm/px; ${riseSays}`, ok ? (riseOk === undefined && f.n <= 2 ? 'UNKNOWN' : 'PASS') : 'FAIL', ok ? [] : ['openings', 'features'])
    if (!ok) {
      knownDefects.push({ code: 'ELEVATION_SCALE_INCONSISTENT', what: `${obs.id}: ${riseSays}: the picture is not at one scale with the plan (cropped, perspective or another variant); what is on it is held` })
      for (const x of [...obs.openings, ...obs.features]) held.push({ ref: `${obs.id}/${x.id}`, code: 'HELD_BY_DEPENDENCY', why: `elevation ${obs.id}: ${riseSays}` })
    }
    regs.push({ obs, side, s: f.s, t: f.t, ok, why: riseSays, yOf, alongOf: (px: number) => f.s * px + f.t, res: f.maxRes, n: f.n, zeroRow: zero.row, zeroHow: zero.how })
  }
  // One picture per side (v3.54.5). Two pictures that both register as the same side are not two sides: the one the
  // page's own caption names for that side stands, else the better fit; the other is not built from — its side is not
  // settled by the plan (a plain rectangle takes a left and a right gable end equally well), and the opposite side is
  // not filled in by elimination unless the page's caption says so.
  const captionSide = (obs: (typeof o.elevations)[number]): HouseSide | undefined => pictures.get(obs.picture)?.captionSide
  for (const side of ['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const) {
    const claim = regs.filter((r) => r.ok && r.side === side)
    if (claim.length < 2) continue
    claim.sort((p, q) => Number(captionSide(q.obs) === side) - Number(captionSide(p.obs) === side) || p.res - q.res || q.n - p.n || q.obs.openings.length - p.obs.openings.length)
    const keeper = claim[0]
    for (const r of claim.slice(1)) {
      const cap = captionSide(r.obs)
      const free = cap && cap !== side && !regs.some((x) => x.ok && x.side === cap) ? cap : undefined
      const f = free ? fit(r.obs, free) : undefined
      const span = free === 'FRONT' || free === 'REAR' ? gb.x1 - gb.x0 : gb.z1 - gb.z0
      if (free && f && f.s > 0 && f.maxRes <= Math.max(RESOLVE.elevationAlongM, RESOLVE.elevationAlongShare * span)) {
        r.side = free
        r.s = f.s
        r.t = f.t
        r.res = f.maxRes
        r.n = f.n
        r.alongOf = (px: number) => f.s * px + f.t
        const zeroRow = r.obs.groundY + (terrainY.value ?? 0) / f.s
        r.zeroRow = zeroRow
        r.zeroHow = 'the ground line and the terrain'
        r.yOf = (py: number) => (zeroRow - py) * f.s
        knownDefects.push({ code: 'SIDE_FROM_CAPTION', what: `${r.obs.id}: read as ${side}, which ${keeper.obs.id} already shows; the page's caption names it ${free} and it registers there` })
        continue
      }
      r.ok = false
      r.unresolved = `read as ${side}, which ${keeper.obs.id} already shows; which side it is is not settled`
      check(`side-${r.obs.id}`, 'ORIENTATION', `elevation ${r.obs.id} shows a side no other picture shows`, 'one picture per side', r.unresolved, 'FAIL', ['openings', 'features'])
      knownDefects.push({ code: 'SIDE_CLAIMED_TWICE', what: `${r.obs.id}: ${r.unresolved}; its ${r.obs.openings.length} opening(s) and ${r.obs.features.length} feature(s) are held` })
      for (const x of [...r.obs.openings, ...r.obs.features]) held.push({ ref: `${r.obs.id}/${x.id}`, code: 'CONFLICT_OPEN', why: `elevation ${r.obs.id}: ${r.unresolved}` })
    }
  }

  const bodies: HouseGeometry['bodies'] = raw.map((b, i) => {
    const poly = bodyPolys[i]
    const bb = bbox(poly)
    const ro = o.roofs.find((r) => r.bodyId === b.id)
    const kind = ro && (ro.kind === 'GABLE' || ro.kind === 'HIP' || ro.kind === 'SHED' || ro.kind === 'FLAT') ? ro.kind : b.role === 'BAY' ? 'FLAT' : 'GABLE'
    if (b.role === 'BAY' && !ro) knownDefects.push({ code: 'ROOF_KIND_ASSUMED', what: `body ${b.id}: no roof was read for this bay; a flat top at its storey's ceiling is drawn — a stand-in, said, not a reading` })
    else if (!ro || kind !== ro.kind) knownDefects.push({ code: 'ROOF_KIND_ASSUMED', what: `body ${b.id}: ${ro ? `the roof was read as ${ro.kind}` : 'no roof was read'}; a gable is drawn — a stand-in, said, not a reading` })
    const ridgeAxis: 'X' | 'Z' = ro?.ridge === 'ALONG_FRONT' ? 'X' : ro?.ridge === 'FRONT_TO_BACK' ? 'Z' : bb.x1 - bb.x0 >= bb.z1 - bb.z0 ? 'X' : 'Z'
    const pitchDeg: Num = kind === 'FLAT' ? num(0, 'DERIVED', 'a flat roof') : pitchObs ? num(pitchObs.valueM as number, 'PRINTED', `the pitch printed on the section: ${pitchObs.literal}`, [pitchObs.id]) : pitchPub ? num(pitchPub.value, 'PRINTED', `the published roof pitch ${pitchPub.raw ?? pitchPub.value}`) : num(D.pitchDeg, 'DEFAULT', 'no pitch printed or published: a convention')
    const half = (ridgeAxis === 'X' ? bb.z1 - bb.z0 : bb.x1 - bb.x0) / 2
    const printedRidge = ridges.find((r) => r.bodyId === b.id) ?? (b.id === mainId ? ridgePrintedMain : undefined)
    // what registered elevations show of this body's eaves and ridge
    const seen = regs.filter((r) => r.ok).flatMap((r) => r.obs.bodies.filter((x) => x.bodyId === b.id).map((x) => ({ r, x })))
    const seenRidge = seen.filter((q) => q.x.ridgeY !== null).map((q) => q.r.yOf(q.x.ridgeY as number))
    const seenEaves = seen.filter((q) => q.x.eavesY !== null && SIDE_NORMAL[q.r.side][ridgeAxis === 'X' ? 'z' : 'x'] !== 0).map((q) => q.r.yOf(q.x.eavesY as number))
    const mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length
    let ridgeY: Num
    if (kind === 'FLAT') ridgeY = seenRidge.length > 0 ? num(r3(mean(seenRidge)), 'DERIVED', 'the top of the flat roof, measured on registered elevations', seen.map((q) => q.r.obs.id), 0.2) : num(r3(topElevation(b) + (levels.find((l) => l.index === Math.max(...b.storeys))?.height.value ?? D.storeyHeightM) + 0.3), 'DEFAULT', 'no elevation shows its top: the storey height and a roof build-up')
    else if (printedRidge) ridgeY = num(printedRidge.valueM as number, 'PRINTED', `the ridge mark ${printedRidge.literal}`, [printedRidge.id])
    else if (seenRidge.length > 0) {
      // A level mark printed on the section whose meaning the reader did not give (or gave without a body), standing
      // where the registered elevations measure the top of THIS body's roof, is that roof's mark: the print is taken,
      // the raster measure is what bound it. Exactly one such mark, or none.
      const m = mean(seenRidge)
      const loose = o.levels.filter((x) => x.valueM !== null && /^\s*\+/.test(x.literal) && (x.meaning === 'OTHER' || x.meaning === 'RIDGE') && x.id !== ridgePrintedMain?.id && (x.bodyId === undefined || x.bodyId === b.id) && Math.abs((x.valueM as number) - m) <= RESOLVE.elevationAlongM && (x.valueM as number) > topElevation(b) + 0.5)
      const values = [...new Set(loose.map((x) => x.valueM as number))]
      ridgeY = values.length === 1 ? num(values[0], 'PRINTED', `the mark ${loose[0].literal} printed on the section, which ${seenRidge.length} registered elevation(s) place at the top of this body's roof (measured +${m.toFixed(2)} m)`, [loose[0].id, ...seen.map((q) => q.r.obs.id)]) : num(r3(m), 'DERIVED', `measured on ${seenRidge.length} registered elevation(s) at the plan's scale`, seen.map((q) => q.r.obs.id), 0.25)
    }
    else if (seenEaves.length > 0 && pitchDeg.value !== null) ridgeY = num(r3(mean(seenEaves) + (half + D.overhangM) * Math.tan((pitchDeg.value * Math.PI) / 180)), 'DERIVED', 'the eaves measured on a registered elevation, the half span and the pitch', seen.map((q) => q.r.obs.id), 0.3)
    else if (b.id === mainId && publishedHeight) ridgeY = num(r3(publishedHeight.value + (terrainY.value ?? 0)), 'DERIVED', `the published building height ${publishedHeight.raw ?? publishedHeight.value} above the terrain`, [], 0.3)
    else if (pitchDeg.value !== null) ridgeY = num(r3(topElevation(b) + (Math.max(...b.storeys) > 0 ? D.kneeWallM : (levels[0].height.value ?? D.storeyHeightM)) + half * Math.tan((pitchDeg.value * Math.PI) / 180)), 'DEFAULT', 'no ridge printed, published or seen on a registered elevation: the top storey\'s wall, the half span and the pitch — for drawing only')
    else ridgeY = unknown('no ridge height and no pitch')
    return { id: b.id, role: b.role === 'PORCH' ? 'OTHER' : b.role, storeys: b.storeys, outline: poly, outlineBasis: metricBasis === 'ESTIMATED' ? 'ESTIMATED' : 'DERIVED', refs: [b.ref, ...metricRefs], roof: { kind, ...(kind === 'GABLE' || kind === 'HIP' ? { ridgeAxis } : {}), ...(kind === 'SHED' ? { highSide: 'REAR' as const } : {}), pitchDeg, ridgeY, overhangM: num(kind === 'FLAT' ? 0 : D.overhangM, 'DEFAULT', 'a conventional eaves overhang') } }
  })
  // the heights against what the source prints of the whole
  const mainBody = bodies.find((b) => b.id === mainId)
  const mainRidge = mainBody?.roof.ridgeY.value ?? null
  if (mainRidge !== null && terrainY.value !== null) {
    const built = mainRidge - terrainY.value
    if (total) check('height-printed', 'LEVELS', 'ridge − terrain against the total height printed on the section', `${total.valueM} m (${total.literal})`, `${built.toFixed(2)} m`, Math.abs(built - (total.valueM as number)) <= RESOLVE.heightAgreeM ? 'PASS' : 'FAIL', Math.abs(built - (total.valueM as number)) <= RESOLVE.heightAgreeM ? [] : ['roofs', 'features'])
    if (publishedHeight) check('height-published', 'LEVELS', 'ridge − terrain against the published building height', `${publishedHeight.value} m`, `${built.toFixed(2)} m`, Math.abs(built - publishedHeight.value) <= RESOLVE.heightAgreeM + 0.25 ? 'PASS' : 'FAIL', Math.abs(built - publishedHeight.value) <= RESOLVE.heightAgreeM + 0.25 ? [] : ['roofs', 'features'])
    if (!total && !publishedHeight) check('height', 'LEVELS', 'the house\'s height against an independent figure', 'a printed total height or a published building height', 'neither is given', 'UNKNOWN')
  }
  // v3.54.5 — a printed ridge mark must be a roof this house can have: the printed pitch over the plan's span leaves the
  // eaves some way above the top floor, and that way is not more than a storey. A mark read ten metres too high (a
  // stroke of the level symbol taken for a digit) puts a wall of several storeys over a floor that has none; such a
  // mark is refused whoever read it. No absolute height is assumed: a tall house has its storeys read.
  if (mainBody && mainRidge !== null && mainBody.roof.ridgeY.basis === 'PRINTED' && mainBody.roof.pitchDeg.basis === 'PRINTED' && mainBody.roof.pitchDeg.value && (mainBody.roof.kind === 'GABLE' || mainBody.roof.kind === 'HIP')) {
    // the most generous roof this house could have: the pitch over half of its LONGER extent (which way the ridge runs,
    // and how the bodies share the roof, is not assumed — a wide single-storey house under one big roof passes)
    const halfSpan = Math.max(gb.x1 - gb.x0, gb.z1 - gb.z0) / 2
    const eaves = mainRidge - halfSpan * Math.tan((mainBody.roof.pitchDeg.value * Math.PI) / 180)
    const over = eaves - topElevation(mainBody)
    const storey = levels.find((l) => l.index === Math.max(...mainBody.storeys))?.height.value ?? D.storeyHeightM
    const tooHigh = over > storey + RESOLVE.ridgeOverStoreyM
    check('ridge-roof', 'LEVELS', 'the printed ridge against the roof the printed pitch makes over the plan', `the eaves no more than a storey (${storey.toFixed(2)} m) and ${RESOLVE.ridgeOverStoreyM} m above the top floor`, `ridge +${mainRidge.toFixed(2)} m, pitch ${mainBody.roof.pitchDeg.value}°, at most ${halfSpan.toFixed(2)} m of half span: the eaves would stand at least ${over.toFixed(2)} m above the top floor (+${topElevation(mainBody).toFixed(2)} m)`, tooHigh ? 'FAIL' : over < -0.6 ? 'UNKNOWN' : 'PASS', tooHigh ? ['roofs', 'features'] : [])
  }
  const heightsOk = !checks.some((c) => c.scope === 'LEVELS' && c.status === 'FAIL')
  if (!heightsOk) knownDefects.push({ code: 'HEIGHT_CONTRADICTS_SOURCE', what: checks.filter((c) => c.scope === 'LEVELS' && c.status === 'FAIL').map((c) => `${c.what}: ${c.measured} against ${c.expected}`).join('; ') })

  // --- 6. openings and features, from registered elevations, on host walls ----------------------------------------------
  const hostsOf = (level: number): Array<{ id: string; a: P2; b: P2; len: number; u: P2; out: P2; bodyId?: string }> => {
    const poly = outlines.find((x) => x.level === level)?.polygon
    if (!poly) return []
    return poly.map((_, i) => {
      const e = edgeOf(poly, i)
      const m = { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2 }
      const owner = raw.find((b, k) => b.storeys.includes(level) && onBoundary(bodyPolys[k], m, 0.03) >= 0 && contains(bodyPolys[k], { x: m.x - e.out.x * 0.05, z: m.z - e.out.z * 0.05 }))
      return { id: `wall-${level}-${i}`, ...e, ...(owner ? { bodyId: owner.id } : {}) }
    })
  }
  const depthOf = (side: HouseSide, p: P2): number => (side === 'FRONT' ? p.z : side === 'REAR' ? -p.z : side === 'LEFT' ? p.x : -p.x)
  /** The wall of `level` that faces `side` and holds the along-position; the nearest to the viewer, or the named body's. */
  const hostAt = (side: HouseSide, level: number, along: number, bodyId?: string, span?: [number, number]): { h: ReturnType<typeof hostsOf>[number]; a0: number; sign: number; cos: number } | undefined => {
    const n = SIDE_NORMAL[side]
    const cands = hostsOf(level)
      .map((h) => {
        const cos = h.out.x * n.x + h.out.z * n.z
        const a0 = alongOfPoint(side, h.a)
        const a1 = alongOfPoint(side, h.b)
        return { h, cos, a0, a1, lo: Math.min(a0, a1), hi: Math.max(a0, a1), depth: Math.min(depthOf(side, h.a), depthOf(side, h.b)) }
      })
      .map((c) => ({ ...c, share: span ? Math.min(c.hi, span[1]) - Math.max(c.lo, span[0]) : along >= c.lo - 0.05 && along <= c.hi + 0.05 ? 1 : 0 }))
      .filter((c) => c.cos > 0.5 && c.share > 0.02)
    // a wall that holds the whole of what is placed comes before one that holds a part of it (a short return wall nearer
    // the viewer); with no such wall, the one that holds most of it — not the one under its middle (v3.54.5)
    const whole = span ? cands.filter((c) => c.lo <= span[0] + 0.1 && c.hi >= span[1] - 0.1 && c.hi - c.lo >= span[1] - span[0] + 2 * (RESOLVE.defaults.wallThicknessM + 0.05)) : []
    const most = cands.length > 0 ? Math.max(...cands.map((c) => c.share)) : 0
    const pool = whole.length > 0 ? whole : cands.filter((c) => c.share >= most - 0.05)
    const named = bodyId ? pool.filter((c) => c.h.bodyId === bodyId) : []
    const pick = (named.length > 0 ? named : pool).sort((p, q) => p.depth - q.depth)[0]
    return pick ? { h: pick.h, a0: pick.a0, sign: pick.a1 >= pick.a0 ? 1 : -1, cos: pick.cos } : undefined
  }
  const rooflights: HouseGeometry['rooflights'] = []
  const chimneys: HouseGeometry['chimneys'] = []
  /** The slope of a pitched body that falls toward `side`: plan distance from its ridge for a height, and the plan point for an along-position. */
  const slopeToward = (body: HouseGeometry['bodies'][number], side: HouseSide): { half: number; fromRidge: (y: number) => number; at: (along: number, d: number) => P2; ridgeLine: number } | undefined => {
    const axis = body.roof.ridgeAxis
    const pitch = body.roof.pitchDeg.value
    const ridgeY = body.roof.ridgeY.value
    if ((body.roof.kind !== 'GABLE' && body.roof.kind !== 'HIP') || !axis || !pitch || ridgeY === null) return undefined
    if ((axis === 'X') !== (side === 'FRONT' || side === 'REAR')) return undefined
    const bb = bbox(body.outline)
    const tan = Math.tan((pitch * Math.PI) / 180)
    const ridgeLine = axis === 'X' ? (bb.z0 + bb.z1) / 2 : (bb.x0 + bb.x1) / 2
    const half = (axis === 'X' ? bb.z1 - bb.z0 : bb.x1 - bb.x0) / 2
    const out = side === 'FRONT' || side === 'LEFT' ? -1 : 1
    // along-positions run west→east on FRONT, east→west on REAR, rear→front on LEFT, front→rear on RIGHT
    const along = (a: number): number => (side === 'FRONT' ? gb.x0 + a : side === 'REAR' ? gb.x1 - a : side === 'LEFT' ? gb.z1 - a : gb.z0 + a)
    return { half, ridgeLine, fromRidge: (y) => (ridgeY - y) / tan, at: (a, d) => (axis === 'X' ? { x: along(a), z: ridgeLine + out * d } : { x: ridgeLine + out * d, z: along(a) }) }
  }
  const openings: HouseGeometry['openings'] = []
  const dormers: HouseGeometry['dormers'] = []
  const balconies: HouseGeometry['balconies'] = []
  const canopies: HouseGeometry['canopies'] = []
  // roofed open zones traced on the ground plan (a porch, a portico, a covered terrace): what stands over one is on an elevation
  const openZones = o.outlines.filter((x) => x.what === 'OPEN' && x.level === 0).map((x) => ({ id: x.id, poly: canonical(x.polygon.map(toModel)), usedBy: undefined as string | undefined }))
  /** The open zone that lies against wall `h` under the stretch from..to of it: its rectangle and its outer corners. */
  const zoneAt = (h: { a: P2; u: P2; out: P2 }, from: number, to: number): { zone: (typeof openZones)[number]; rect: { x0: number; z0: number; x1: number; z1: number }; posts: P2[] } | undefined => {
    for (const zone of openZones) {
      const uv = zone.poly.map((q) => ({ u: (q.x - h.a.x) * h.u.x + (q.z - h.a.z) * h.u.z, v: (q.x - h.a.x) * h.out.x + (q.z - h.a.z) * h.out.z, q }))
      const u0 = Math.min(...uv.map((q) => q.u))
      const u1 = Math.max(...uv.map((q) => q.u))
      const v0 = Math.min(...uv.map((q) => q.v))
      const v1 = Math.max(...uv.map((q) => q.v))
      const overlap = Math.min(u1, to) - Math.max(u0, from)
      if (Math.abs(v0) > 0.35 || v1 < 0.4 || overlap < 0.5 * Math.min(to - from, u1 - u0)) continue
      const corner = (u: number, v: number): P2 => ({ x: h.a.x + h.u.x * u + h.out.x * v, z: h.a.z + h.u.z * u + h.out.z * v })
      const a = corner(u0, 0)
      const b = corner(u1, v1)
      const inset = 0.15
      return { zone, rect: { x0: r3(Math.min(a.x, b.x)), z0: r3(Math.min(a.z, b.z)), x1: r3(Math.max(a.x, b.x)), z1: r3(Math.max(a.z, b.z)) }, posts: [corner(u0 + inset, v1 - inset), corner(u1 - inset, v1 - inset)].map((q) => ({ x: r3(q.x), z: r3(q.z) })) }
    }
    return undefined
  }
  const featuresBlocked = !bodiesOk || !heightsOk
  for (const r of regs.filter((x) => x.ok)) {
    const { obs, side } = r
    const flip = obs.mirrored ? -1 : 1
    void flip
    for (const f of obs.features) {
      const ref = `${obs.id}/${f.id}`
      if (featuresBlocked) {
        held.push({ ref, code: 'HELD_BY_DEPENDENCY', why: !bodiesOk ? 'the bodies do not cover the traced outline: a feature is not placed on a body in doubt' : 'the heights contradict the source: a feature is not placed on a roof in doubt' })
        continue
      }
      const a = [r.alongOf(f.box.x0), r.alongOf(f.box.x1)].sort((p, q) => p - q)
      if (f.kind === 'WALL_DORMER_GABLE' || f.kind === 'CROSS_GABLE' || f.kind === 'ROOF_DORMER_GABLE' || f.kind === 'ROOF_DORMER_SHED') {
        const body = bodies.find((b) => b.id === (f.bodyId ?? mainId))
        const at = body ? hostAt(side, Math.max(...body.storeys), (a[0] + a[1]) / 2, body.id, [a[0], a[1]]) : undefined
        if (!body || !at || at.cos < 0.99) {
          held.push({ ref, code: 'WRONG_BINDING', why: 'no eaves wall of its body faces this side at its place' })
          continue
        }
        const from = at.sign > 0 ? a[0] - at.a0 : at.a0 - a[1]
        const apex = f.apexY ?? f.box.y0
        // a gabled dormer whose front comes down to the eaves of its roof stands on the wall, not on the slope
        const eavesRow = obs.bodies.find((x) => x.bodyId === body.id)?.eavesY
        const onWall = f.kind === 'WALL_DORMER_GABLE' || f.kind === 'CROSS_GABLE' || (f.kind === 'ROOF_DORMER_GABLE' && typeof eavesRow === 'number' && r.yOf(Math.max(f.box.y0, f.box.y1)) <= r.yOf(eavesRow) + 0.35)
        let eaves = f.eavesY ?? null
        if (eaves === null && apex !== null && body.roof.pitchDeg.value) {
          // not read: a dormer roof of the host roof's pitch, from its apex down to its two sides
          eaves = apex + (((a[1] - a[0]) / 2) * Math.tan((body.roof.pitchDeg.value * Math.PI) / 180)) / Math.abs(r.s)
          knownDefects.push({ code: 'DORMER_EAVES_ASSUMED', what: `${ref}: where its own roof meets its side walls was not read; drawn at the host roof's pitch from its apex` })
        }
        if (eaves === null || apex === null) {
          held.push({ ref, code: 'SOURCE_UNKNOWN', why: 'where its own roof begins was not read' })
          continue
        }
        dormers.push({ id: `dormer-${side.toLowerCase()}-${dormers.filter((d) => d.id.startsWith(`dormer-${side.toLowerCase()}`)).length + 1}`, bodyId: body.id, kind: onWall ? 'WALL_GABLE' : f.kind === 'ROOF_DORMER_GABLE' ? 'ROOF_GABLE' : 'ROOF_SHED', hostWall: at.h.id, fromM: num(r3(from), 'DERIVED', `its two sides on elevation ${obs.id}, at the plan's scale`, [ref], r3(2 * r.s)), toM: num(r3(from + (a[1] - a[0])), 'DERIVED', `its two sides on elevation ${obs.id}`, [ref], r3(2 * r.s)), eaveY: num(r3(r.yOf(eaves)), 'DERIVED', `the row its own roof begins at on elevation ${obs.id}`, [ref], 0.15), ridgeY: num(r3(r.yOf(apex)), 'DERIVED', `its apex on elevation ${obs.id}`, [ref], 0.15), refs: [ref] })
      } else if (f.kind === 'BALCONY') {
        const level = levels.filter((l) => (l.elevation.value ?? 0) <= r.yOf(f.box.y1) + 0.6).sort((p, q) => q.index - p.index)[0]
        const at = level ? hostAt(side, level.index, (a[0] + a[1]) / 2, f.bodyId, [a[0], a[1]]) : undefined
        if (!level || !at || at.cos < 0.99) {
          held.push({ ref, code: 'WRONG_BINDING', why: 'no wall faces this side at its place' })
          continue
        }
        const from = at.sign > 0 ? a[0] - at.a0 : at.a0 - a[1]
        const p0 = { x: at.h.a.x + at.h.u.x * from, z: at.h.a.z + at.h.u.z * from }
        const p1 = { x: at.h.a.x + at.h.u.x * (from + a[1] - a[0]), z: at.h.a.z + at.h.u.z * (from + a[1] - a[0]) }
        const q = { x: p1.x + at.h.out.x * D.balconyDepthM, z: p1.z + at.h.out.z * D.balconyDepthM }
        const id = `balcony-${side.toLowerCase()}-${balconies.length + 1}`
        const topY = num(level.elevation.value ?? 0, level.elevation.basis === 'UNKNOWN' ? 'DEFAULT' : level.elevation.basis, 'at the floor of its storey')
        // a balcony over a roofed open zone of the ground plan is that zone's roof: its depth and its posts are on the plan
        const over = level.index > 0 ? zoneAt(at.h, from, from + a[1] - a[0]) : undefined
        if (over && !over.zone.usedBy) {
          over.zone.usedBy = id
          balconies.push({ id, level: level.index, rect: over.rect, topY, thicknessM: num(0.2, 'DEFAULT', 'a conventional slab'), railing: true, posts: over.posts, basis: 'DERIVED', refs: [ref, over.zone.id] })
          continue
        }
        balconies.push({ id, level: level.index, rect: { x0: r3(Math.min(p0.x, q.x)), z0: r3(Math.min(p0.z, q.z)), x1: r3(Math.max(p0.x, q.x)), z1: r3(Math.max(p0.z, q.z)) }, topY: num(level.elevation.value ?? 0, level.elevation.basis === 'UNKNOWN' ? 'DEFAULT' : level.elevation.basis, 'at the floor of its storey'), thicknessM: num(0.2, 'DEFAULT', 'a conventional slab'), railing: true, posts: [], basis: 'ESTIMATED', refs: [ref] })
        knownDefects.push({ code: 'BALCONY_DEPTH_ASSUMED', what: `${ref}: an elevation shows a balcony's width, not how far it projects: ${D.balconyDepthM} m is drawn` })
      } else if (f.kind === 'CANOPY') {
        const at = hostAt(side, 0, (a[0] + a[1]) / 2, f.bodyId)
        const from = at ? (at.sign > 0 ? a[0] - at.a0 : at.a0 - a[1]) : 0
        const over = at && at.cos >= 0.99 ? zoneAt(at.h, from, from + a[1] - a[0]) : undefined
        if (!over || over.zone.usedBy) {
          held.push({ ref, code: 'SOURCE_UNKNOWN', why: 'a canopy on an elevation without a roofed open zone traced under it on the plan: how far it projects is not known' })
          continue
        }
        const id = `canopy-${side.toLowerCase()}-${canopies.length + 1}`
        over.zone.usedBy = id
        canopies.push({ id, kind: 'PORCH_ROOF', rect: over.rect, undersideY: num(r3(r.yOf(f.box.y1)), 'DERIVED', `its underside row on elevation ${obs.id}`, [ref], 0.15), thicknessM: num(0.2, 'DEFAULT', 'a conventional plate'), posts: over.posts, basis: 'DERIVED', refs: [ref, over.zone.id] })
      } else if (f.kind === 'CHIMNEY') {
        // an elevation shows where along the ridge a chimney stands and how high; not how far from the ridge: it is drawn on it
        const body = bodies.find((b) => b.id === (f.bodyId ?? mainId))
        const slope = body ? slopeToward(body, side) : undefined
        if (!body || !slope) {
          held.push({ ref, code: 'SOURCE_UNKNOWN', why: 'a chimney seen from a gable end, or on a roof without a ridge: where it stands along the building is not on this picture' })
          continue
        }
        const w = Math.min(1.2, Math.max(0.4, a[1] - a[0]))
        const c = slope.at((a[0] + a[1]) / 2, 0)
        const axisX = body.roof.ridgeAxis === 'X'
        const rect = axisX ? { x0: r3(c.x - w / 2), z0: r3(c.z - 0.3), x1: r3(c.x + w / 2), z1: r3(c.z + 0.3) } : { x0: r3(c.x - 0.3), z0: r3(c.z - w / 2), x1: r3(c.x + 0.3), z1: r3(c.z + w / 2) }
        // the same chimney seen from the other side of the ridge is one chimney
        if (chimneys.some((q) => Math.abs((q.rect.x0 + q.rect.x1) / 2 - (rect.x0 + rect.x1) / 2) < 0.8 && Math.abs((q.rect.z0 + q.rect.z1) / 2 - (rect.z0 + rect.z1) / 2) < 0.8)) continue
        chimneys.push({ id: `chimney-${chimneys.length + 1}`, rect, topY: num(r3(r.yOf(Math.min(f.box.y0, f.box.y1))), 'DERIVED', `its top row on elevation ${obs.id}`, [ref], 0.2), basis: 'ESTIMATED', refs: [ref] })
        knownDefects.push({ code: 'CHIMNEY_DEPTH_ASSUMED', what: `${ref}: an elevation shows where along the ridge a chimney stands, not how far from it: it is drawn on the ridge` })
      } else held.push({ ref, code: 'CAPABILITY_MISSING', why: `${f.kind}: seen on the elevation; this resolver places no ${f.kind.toLowerCase()} from one elevation (its depth is not on the picture)` })
    }
    // panels of one opening (v3.54.5): two boxes of one kind, at one height, with less than a mullion between them, are
    // the sashes of ONE hole in the wall — cut as one, with both readings as its sources. A pier one can build stays a pier.
    const family = (k: string): string => (k === 'WINDOW' ? 'W' : k === 'GARAGE_DOOR' ? 'G' : k === 'ROOF_WINDOW' ? 'R' : 'D')
    const panels: Array<{ x: (typeof obs.openings)[number]; also: string[]; panes: number }> = []
    for (const x of [...obs.openings].sort((p, q) => Math.min(p.box.x0, p.box.x1) - Math.min(q.box.x0, q.box.x1))) {
      const last = panels.find((q) => {
        const a = q.x
        if (family(a.kind) !== family(x.kind) || a.kind === 'ROOF_WINDOW' || a.kind === 'GARAGE_DOOR' || (a.level ?? -1) !== (x.level ?? -1) || (a.inFeature ?? '') !== (x.inFeature ?? '')) return false
        const gap = (Math.min(x.box.x0, x.box.x1) - Math.max(a.box.x0, a.box.x1)) * Math.abs(r.s)
        return gap >= -0.02 && gap < RESOLVE.mullionM && Math.abs(Math.min(a.box.y0, a.box.y1) - Math.min(x.box.y0, x.box.y1)) * Math.abs(r.s) <= 0.12 && Math.abs(Math.max(a.box.y0, a.box.y1) - Math.max(x.box.y0, x.box.y1)) * Math.abs(r.s) <= 0.12
      })
      if (last) {
        last.x = { ...last.x, box: { x0: Math.min(last.x.box.x0, last.x.box.x1, x.box.x0, x.box.x1), y0: Math.min(last.x.box.y0, x.box.y0), x1: Math.max(last.x.box.x0, last.x.box.x1, x.box.x0, x.box.x1), y1: Math.max(last.x.box.y1, x.box.y1) } }
        last.also.push(`${obs.id}/${x.id}`)
        last.panes += 1
      } else panels.push({ x, also: [], panes: 1 })
    }
    for (const { x, also, panes } of panels) {
      const ref = `${obs.id}/${x.id}`
      if (!bodiesOk) {
        held.push({ ref, code: 'HELD_BY_DEPENDENCY', why: 'the bodies do not cover the traced outline: an opening is not cut in a wall in doubt' })
        continue
      }
      if (x.kind === 'ROOF_WINDOW') {
        // on the slope that faces this side: its two columns give where along the eaves, its two rows how far up the slope
        const body = bodies.find((b) => b.id === (x.bodyId ?? mainId))
        const slope = body ? slopeToward(body, side) : undefined
        if (!body || !slope || !heightsOk) {
          held.push({ ref, code: !heightsOk ? 'HELD_BY_DEPENDENCY' : 'WRONG_BINDING', why: !heightsOk ? 'the heights contradict the source: nothing is placed on a roof in doubt' : 'no roof slope of its body faces this side' })
          continue
        }
        const al = [r.alongOf(x.box.x0), r.alongOf(x.box.x1)].sort((p, q) => p - q)
        const d0 = slope.fromRidge(r.yOf(Math.min(x.box.y0, x.box.y1)))
        const d1 = slope.fromRidge(r.yOf(Math.max(x.box.y0, x.box.y1)))
        if (!(d0 > 0.25 && d1 > d0 + 0.3 && d1 < slope.half + 0.2 && al[1] - al[0] > 0.3)) {
          held.push({ ref, code: 'WRONG_READ', why: `its rows put it ${d0.toFixed(2)}–${d1.toFixed(2)} m from the ridge of a slope ${slope.half.toFixed(2)} m long in plan: not on that slope` })
          continue
        }
        const p0 = slope.at(al[0], d0)
        const p1 = slope.at(al[1], d1)
        rooflights.push({ id: `rooflight-${side.toLowerCase()}-${rooflights.length + 1}`, bodyId: body.id, rect: { x0: r3(Math.min(p0.x, p1.x)), z0: r3(Math.min(p0.z, p1.z)), x1: r3(Math.max(p0.x, p1.x)), z1: r3(Math.max(p0.z, p1.z)) }, basis: 'DERIVED', refs: [ref] })
        continue
      }
      const a = [r.alongOf(x.box.x0), r.alongOf(x.box.x1)].sort((p, q) => p - q)
      const sillY = r.yOf(x.box.y1)
      const headY = r.yOf(x.box.y0)
      const level = x.level !== undefined ? levels.find((l) => l.index === x.level) : levels.filter((l) => (l.elevation.value ?? 0) <= sillY + 0.35).sort((p, q) => q.index - p.index)[0]
      // the wall that holds it: the top storey's wall holds what stands in a dormer above the eaves
      const wallLevel = level && outlines.some((q) => q.level === level.index) ? level.index : Math.max(...outlines.map((q) => q.level))
      const at = hostAt(side, wallLevel, (a[0] + a[1]) / 2, x.bodyId, [a[0], a[1]])
      if (!level || !at) {
        held.push({ ref, code: 'WRONG_BINDING', why: `no wall of level ${wallLevel} faces ${side} at ${((a[0] + a[1]) / 2).toFixed(2)} m along it` })
        continue
      }
      const width = (a[1] - a[0]) / at.cos
      const from = (at.sign > 0 ? a[0] - at.a0 : at.a0 - a[1]) / at.cos
      const door = x.kind !== 'WINDOW'
      const sill = Math.max(0, sillY - (level.elevation.value ?? 0))
      if (width < 0.3 || headY - sillY < 0.3) {
        held.push({ ref, code: 'PARSE_REJECTED', why: `${width.toFixed(2)} × ${(headY - sillY).toFixed(2)} m is not an opening` })
        continue
      }
      // what the reading can tell: two pixels of the picture, and the residual its picture registered to the plan with
      const u = r3(Math.min(RESOLVE.elevationAlongM, Math.max(0.05, 2 * r.s, r.res)))
      openings.push({ id: `opening-${side.toLowerCase()}-${openings.filter((q) => q.id.startsWith(`opening-${side.toLowerCase()}`)).length + 1}`, kind: x.kind as 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR', level: level.index, hostWall: at.h.id, offsetM: num(r3(from), 'DERIVED', `its two sides on elevation ${obs.id}, at the plan's scale`, [ref], u), widthM: num(r3(width), 'DERIVED', `its two sides on elevation ${obs.id}`, [ref], u), heightM: num(r3(headY - (door && sill < 0.25 ? (level.elevation.value ?? 0) : sillY)), 'DERIVED', `its head and sill rows on elevation ${obs.id}`, [ref], u), sillM: num(door && sill < 0.25 ? 0 : r3(sill), 'DERIVED', door && sill < 0.25 ? 'a door: its threshold at the floor' : `its sill row on elevation ${obs.id} above the floor of its storey`, [ref], u), ...(panes > 1 ? { panes } : {}), refs: [ref, ...also] })
    }
  }

  // An opening seen inside a wall dormer stands under that dormer's roof: a reading of where the dormer's roof begins that
  // would put the roof through the opening is moved up until the opening fits (the row read was the tip of the overhanging
  // roof, not the top of the dormer's side wall). Bounded; a larger disagreement is left for the compiler to name.
  for (const d of dormers) {
    if (d.kind !== 'WALL_GABLE' || d.fromM.value === null || d.toM.value === null || d.eaveY.value === null || d.ridgeY.value === null) continue
    const from = Math.min(d.fromM.value, d.toM.value)
    const to = Math.max(d.fromM.value, d.toM.value)
    const half = (to - from) / 2
    let eave = d.eaveY.value
    for (const x of openings) {
      if (x.hostWall !== d.hostWall || x.offsetM.value === null || x.widthM.value === null || x.sillM.value === null || x.heightM.value === null) continue
      const lo = x.offsetM.value
      const hi = lo + x.widthM.value
      if (hi <= from || lo >= to) continue
      const floor = levels.find((l) => l.index === x.level)?.elevation.value
      if (floor === null || floor === undefined) continue
      const head = floor + x.sillM.value + x.heightM.value
      const k = Math.max(0, Math.min(0.95, Math.min(lo - from, to - hi) / half))
      const need = (head + 0.4 - d.ridgeY.value * k) / (1 - k)
      if (need > eave) eave = need
    }
    if (eave > d.eaveY.value + 1e-6 && eave - d.eaveY.value <= 0.8 && eave < d.ridgeY.value - 0.3) {
      knownDefects.push({ code: 'DORMER_EAVES_RAISED', what: `${d.id}: its roof was read as beginning at +${d.eaveY.value.toFixed(2)} m, which would cut the opening seen in it; drawn from +${eave.toFixed(2)} m, under which the opening fits` })
      d.eaveY = num(r3(eave), 'DERIVED', `raised from the row read (+${d.eaveY.value.toFixed(2)} m) so that the opening seen in it stands under its roof`, d.refs, 0.3)
    }
  }

  // --- 7. the register of views (v3.54.5): each side of the house from its source picture to what was agreed on it -------
  const facing = (side: HouseSide): string[] => [...new Set(outlines.flatMap((q) => hostsOf(q.level).filter((h) => h.out.x * SIDE_NORMAL[side].x + h.out.z * SIDE_NORMAL[side].z > 0.99).map((h) => h.id)))]
  const undescribed = doc.source.views.filter((v) => v.role === 'ELEVATION' && v.answer !== 'DESCRIBED')
  const agreedOn = (id: string): { openings: number; features: number } => {
    const of = (refs: string[]): boolean => refs.some((x) => x.startsWith(`${id}/`))
    return { openings: openings.filter((x) => of(x.refs)).length + rooflights.filter((x) => of(x.refs)).length, features: dormers.filter((x) => of(x.refs)).length + balconies.filter((x) => of(x.refs)).length + canopies.filter((x) => of(x.refs)).length + chimneys.filter((x) => of(x.refs)).length }
  }
  const readState = (obs: (typeof o.elevations)[number]): { state: HouseViewRecord['state']; why?: string } => {
    if (obs.limits === 'TOO_SMALL' && obs.openings.length === 0 && obs.features.length === 0) return { state: 'UNREADABLE', why: 'the reader stated the picture is too small to read' }
    if (obs.openings.length === 0 && obs.blind !== true) return { state: 'PARTIAL', why: 'no opening was listed and the side was not stated to be blind: an empty list is not a wall without windows' }
    if (obs.limits === 'PARTLY_HIDDEN') return { state: 'PARTIAL', why: 'the reader stated a part of this side is hidden on the picture' }
    return { state: 'READ_COMPLETE' }
  }
  const views: HouseViewRecord[] = (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const).map((side) => {
    const base = { side, walls: facing(side), alsoClaimedBy: [] as string[], bodies: [] as string[], registered: false, read: { openings: 0, features: 0, blindStated: false }, agreed: { openings: 0, features: 0 }, built: { openings: 0, features: 0 }, notBuilt: [] as string[], build: 'NOT_ASSESSED' as const }
    const reg = regs.find((r) => r.ok && r.side === side)
    const others = [...regs.filter((r) => r !== reg && (r.side === side || r.obs.side === side)).map((r) => ({ obs: r.obs, why: r.unresolved ?? r.why, unresolved: r.unresolved !== undefined })), ...notRegistered.filter((x) => x.obs.side === side).map((x) => ({ ...x, unresolved: false }))]
    if (reg) {
      const rs = readState(reg.obs)
      return { ...base, ...rs, picture: reg.obs.picture, elevation: reg.obs.id, alsoClaimedBy: others.map((x) => x.obs.id), registered: true, transform: { mPerPx: r3(reg.s), alongAtPx0: r3(reg.t), groundRowPx: reg.obs.groundY, zeroRowPx: r3(reg.zeroRow), zeroHow: reg.zeroHow, mirrored: reg.obs.mirrored, wallEnds: reg.n, residualM: r3(reg.res), checkAnchor: reg.why }, bodies: reg.obs.bodies.map((x) => x.bodyId), read: { openings: reg.obs.openings.length, features: reg.obs.features.length, blindStated: reg.obs.blind === true }, agreed: agreedOn(reg.obs.id) }
    }
    if (others.length > 0) {
      const x = others[0]
      const rs = x.unresolved ? { state: 'ASSIGNMENT_UNRESOLVED' as const, why: x.why } : { ...readState(x.obs), why: `described, and not placed on the plan: ${x.why}` }
      return { ...base, ...rs, picture: x.obs.picture, elevation: x.obs.id, alsoClaimedBy: others.slice(1).map((q) => q.obs.id), bodies: x.obs.bodies.map((q) => q.bodyId), read: { openings: x.obs.openings.length, features: x.obs.features.length, blindStated: x.obs.blind === true } }
    }
    // an undescribed picture whose caption names this side; else one whose side nothing tells (no caption, or a caption
    // naming a side another picture already shows): the side it is cannot be said, and it is not called absent
    const taken = (sd: HouseSide | undefined): boolean => sd !== undefined && regs.some((r) => r.ok && r.side === sd)
    const named = undescribed.find((v) => pictures.get(v.picture)?.captionSide === side) ?? undescribed.find((v) => pictures.get(v.picture)?.captionSide === undefined || taken(pictures.get(v.picture)?.captionSide))
    if (named) {
      const byCaption = pictures.get(named.picture)?.captionSide === side
      const state = named.answer === 'NOT_SENT' ? ('NOT_SENT' as const) : ('SENT_NOT_ANSWERED' as const)
      return { ...base, state, why: `${byCaption ? `picture ${named.picture}, captioned as this side,` : `${undescribed.length} elevation picture(s) of a side not known`} ${named.answer === 'NOT_SENT' ? 'was not sent' : named.answer === 'REPLAY_WITHOUT_FOLLOW_UP' ? 'was sent and not described; the recorded reading holds no follow-up for it' : 'was sent and not described'}${named.why ? `: ${named.why}` : ''}`, ...(byCaption ? { picture: named.picture } : {}) }
    }
    return { ...base, state: 'NO_SOURCE' as const, why: o.elevations.length === 0 && doc.source.views.every((v) => v.role !== 'ELEVATION') ? 'the page publishes no elevation' : 'no published elevation shows this side' }
  })

  for (const z of openZones) if (!z.usedBy) held.push({ ref: z.id, code: 'SOURCE_UNKNOWN', why: 'a roofed open zone traced on the plan; no registered elevation shows a balcony or a canopy over it' })
  const geometry: HouseGeometry = {
    frame: { units: 'm', up: 'Y', plan: 'XZ', origin: 'x = 0 at the leftmost outer wall face seen from the front; z = 0 at the frontmost outer wall face; y = 0 at the finished ground floor', front: `the plan's ${edge} edge` },
    wallThicknessM: num(D.wallThicknessM, 'DEFAULT', 'the wall thickness is not read: a convention'),
    slabThicknessM: num(D.slabThicknessM, 'DEFAULT', 'the floor build-up is not read: a convention'),
    terrainY,
    levels,
    bodies,
    outlines,
    openings,
    dormers,
    balconies,
    canopies,
    chimneys,
    rooflights,
    interior: { status: 'NOT_BUILT', note: 'this document describes the exterior; the interior is not built from it and is not checked' },
  }
  const coverage: HouseVerification['coverage'] = {
    metric: sH && sV ? 'CHECKED' : sH || sV ? 'PARTLY_CHECKED' : 'NOT_CHECKED',
    bodies: wholeSq ? 'CHECKED' : 'NOT_CHECKED',
    levels: total || publishedHeight ? 'CHECKED' : 'NOT_CHECKED',
    roofs: o.roofs.length > 0 ? 'PARTLY_CHECKED' : 'NOT_CHECKED',
    openings: (['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const).every((s) => regs.some((r) => r.ok && r.side === s)) ? 'CHECKED' : regs.some((r) => r.ok) ? 'PARTLY_CHECKED' : 'NOT_CHECKED',
    interior: 'NOT_CHECKED',
  }
  const quantities: HouseVerification['quantities'] = metricBasis === 'ESTIMATED' || checks.some((c) => c.status === 'FAIL' && c.blocks.includes('quantities')) ? 'NOT_USABLE' : checks.some((c) => c.status === 'FAIL') || knownDefects.length > 0 ? 'LIMITED' : 'USABLE_IN_SCOPE'
  return { geometry, verification: { parameters, checks, held, knownDefects, coverage, quantities, views, openings: [] } }
}
