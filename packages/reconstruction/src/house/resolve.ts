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
import type { Basis, HouseCheck, HouseDocument, HouseGeometry, HouseObservations, HouseSide, HouseVerification, Num } from './document.js'
import { num, unknown } from './document.js'
import { area, bbox, canonical, contains, edgeOf, isSimple, onBoundary, pt, squareUp, unionTiling } from './poly.js'
import type { P2 } from './poly.js'

export const HOUSE_RESOLVER_NAME = 'reconstruction.house-resolver' as const
export const HOUSE_RESOLVER_VERSION = '0.1.0' as const

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
  defaults: { wallThicknessM: 0.4, slabThicknessM: 0.3, storeyHeightM: 2.8, kneeWallM: 1.0, pitchDeg: 35, overhangM: 0.5, terrainY: -0.3, sillM: 0.9, balconyDepthM: 1.2 },
} as const

export type ResolveResult = { geometry?: HouseGeometry; verification: HouseVerification }

const r3 = (v: number): number => Math.round(v * 1000) / 1000
const SIDE_NORMAL: Record<HouseSide, P2> = { FRONT: { x: 0, z: -1 }, REAR: { x: 0, z: 1 }, LEFT: { x: -1, z: 0 }, RIGHT: { x: 1, z: 0 } }

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
  const fail = (): ResolveResult => ({ verification: { parameters, checks, held, knownDefects, coverage: {}, quantities: 'NOT_USABLE' } })

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
  const squared = squareUp([...raw.map((b) => canonical(b.px.map(toModel))), ...(wholeM ? [wholeM] : [])])
  const bodyPolys = raw.map((_, i) => canonical(squared[i]))
  const wholeSq = wholeM ? canonical(squared[squared.length - 1]) : undefined
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
  type Reg = { obs: (typeof o.elevations)[number]; side: HouseSide; s: number; t: number; ok: boolean; why: string; yOf: (py: number) => number; alongOf: (px: number) => number }
  const alongOfPoint = (side: HouseSide, p: P2): number => (side === 'FRONT' ? p.x - gb.x0 : side === 'REAR' ? gb.x1 - p.x : side === 'LEFT' ? gb.z1 - p.z : p.z - gb.z0)
  const bodyExtent = (side: HouseSide, id: string): [number, number] | undefined => {
    const i = raw.findIndex((b) => b.id === id)
    if (i < 0) return undefined
    const a = bodyPolys[i].map((p) => alongOfPoint(side, p))
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
  const ridgePrintedMain = ridges.find((r) => r.bodyId === mainId) ?? (ridges.length > 0 ? ridges.slice().sort((p, q) => (q.valueM as number) - (p.valueM as number))[0] : undefined)
  const regs: Reg[] = []
  for (const obs of o.elevations) {
    const pic = pictures.get(obs.picture)
    if (obs.projection !== 'ORTHOGRAPHIC' || pic?.thisHouse === false) {
      check(`elevation-${obs.id}`, 'ORIENTATION', `elevation ${obs.id} registers to the plan`, 'an orthographic picture of this house', obs.projection !== 'ORTHOGRAPHIC' ? `${obs.projection}: no metre is read off it` : 'a picture of another house', 'FAIL', ['openings', 'features'])
      for (const x of [...obs.openings, ...obs.features]) held.push({ ref: `${obs.id}/${x.id}`, code: 'HELD_BY_DEPENDENCY', why: obs.projection !== 'ORTHOGRAPHIC' ? 'seen on a perspective picture: presence only, no position in metres' : 'seen on a picture of another house' })
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
    const f0 = fit(obs, obs.side)
    if (!best) {
      const why = !f0 ? 'no body of the plan is named on it' : f0.s <= 0 ? 'its bodies stand in the opposite order to the plan seen from that side: mirrored, or another side' : `its wall ends land ${f0.maxRes.toFixed(2)} m off the bodies' ends at one scale`
      check(`elevation-${obs.id}`, 'ORIENTATION', `elevation ${obs.id} (${obs.side}) registers to the plan's bodies`, 'its wall ends on the bodies\' ends at ONE scale, in the plan\'s order', why, 'FAIL', ['openings', 'features'])
      knownDefects.push({ code: 'ELEVATION_NOT_REGISTERED', what: `${obs.id} (${obs.side}): ${why}; its ${obs.openings.length} opening(s) and ${obs.features.length} feature(s) are held` })
      for (const x of [...obs.openings, ...obs.features]) held.push({ ref: `${obs.id}/${x.id}`, code: 'HELD_BY_DEPENDENCY', why: `elevation ${obs.id} does not register to the plan: ${why}` })
      continue
    }
    const { side, f } = best
    const yOf = (py: number): number => (obs.groundY - py) * f.s + (terrainY.value ?? 0)
    // an anchor the fit did not use: the ridge row at the along scale against the house's ridge height
    const mainOn = obs.bodies.find((b) => b.bodyId === mainId && b.ridgeY !== null)
    let riseOk: boolean | undefined
    let riseSays = 'no printed ridge to compare with'
    const refRidge = ridgePrintedMain ? (ridgePrintedMain.valueM as number) : publishedHeight ? publishedHeight.value + (terrainY.value ?? 0) : undefined
    if (mainOn && refRidge !== undefined) {
      const seen = yOf(mainOn.ridgeY as number)
      riseOk = Math.abs(seen - refRidge) <= RESOLVE.elevationRise * Math.max(1, refRidge - (terrainY.value ?? 0))
      riseSays = `the ridge row gives +${seen.toFixed(2)} m at the along scale; the ${ridgePrintedMain ? 'section prints' : 'published height gives'} +${refRidge.toFixed(2)} m`
    }
    const ok = riseOk !== false
    check(`elevation-${obs.id}`, 'ORIENTATION', `elevation ${obs.id} (${side}${side !== obs.side ? `, stated ${obs.side}` : ''}) registers to the plan's bodies`, `wall ends within ${RESOLVE.elevationAlongM} m at one scale; the ridge height at that scale within ${RESOLVE.elevationRise * 100} %`, `${f.n} wall ends, worst ${f.maxRes.toFixed(2)} m, ${(f.s * 100).toFixed(3)} cm/px; ${riseSays}`, ok ? (riseOk === undefined && f.n <= 2 ? 'UNKNOWN' : 'PASS') : 'FAIL', ok ? [] : ['openings', 'features'])
    if (!ok) {
      knownDefects.push({ code: 'ELEVATION_SCALE_INCONSISTENT', what: `${obs.id}: ${riseSays}: the picture is not at one scale with the plan (cropped, perspective or another variant); what is on it is held` })
      for (const x of [...obs.openings, ...obs.features]) held.push({ ref: `${obs.id}/${x.id}`, code: 'HELD_BY_DEPENDENCY', why: `elevation ${obs.id}: ${riseSays}` })
    }
    regs.push({ obs, side, s: f.s, t: f.t, ok, why: riseSays, yOf, alongOf: (px: number) => f.s * px + f.t })
  }

  const bodies: HouseGeometry['bodies'] = raw.map((b, i) => {
    const poly = bodyPolys[i]
    const bb = bbox(poly)
    const ro = o.roofs.find((r) => r.bodyId === b.id)
    const kind = ro && (ro.kind === 'GABLE' || ro.kind === 'HIP' || ro.kind === 'SHED' || ro.kind === 'FLAT') ? ro.kind : 'GABLE'
    if (!ro || kind !== ro.kind) knownDefects.push({ code: 'ROOF_KIND_ASSUMED', what: `body ${b.id}: ${ro ? `the roof was read as ${ro.kind}` : 'no roof was read'}; a gable is drawn — a stand-in, said, not a reading` })
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
    else if (seenRidge.length > 0) ridgeY = num(r3(mean(seenRidge)), 'DERIVED', `measured on ${seenRidge.length} registered elevation(s) at the plan's scale`, seen.map((q) => q.r.obs.id), 0.25)
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
  const hostAt = (side: HouseSide, level: number, along: number, bodyId?: string): { h: ReturnType<typeof hostsOf>[number]; a0: number; sign: number; cos: number } | undefined => {
    const n = SIDE_NORMAL[side]
    const cands = hostsOf(level)
      .map((h) => {
        const cos = h.out.x * n.x + h.out.z * n.z
        const a0 = alongOfPoint(side, h.a)
        const a1 = alongOfPoint(side, h.b)
        return { h, cos, a0, a1, lo: Math.min(a0, a1), hi: Math.max(a0, a1), depth: Math.min(depthOf(side, h.a), depthOf(side, h.b)) }
      })
      .filter((c) => c.cos > 0.5 && along >= c.lo - 0.05 && along <= c.hi + 0.05)
    const named = bodyId ? cands.filter((c) => c.h.bodyId === bodyId) : []
    const pick = (named.length > 0 ? named : cands).sort((p, q) => p.depth - q.depth)[0]
    return pick ? { h: pick.h, a0: pick.a0, sign: pick.a1 >= pick.a0 ? 1 : -1, cos: pick.cos } : undefined
  }
  const openings: HouseGeometry['openings'] = []
  const dormers: HouseGeometry['dormers'] = []
  const balconies: HouseGeometry['balconies'] = []
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
      if (f.kind === 'WALL_DORMER_GABLE' || f.kind === 'ROOF_DORMER_GABLE' || f.kind === 'ROOF_DORMER_SHED') {
        const body = bodies.find((b) => b.id === (f.bodyId ?? mainId))
        const at = body ? hostAt(side, Math.max(...body.storeys), (a[0] + a[1]) / 2, body.id) : undefined
        if (!body || !at || at.cos < 0.99) {
          held.push({ ref, code: 'WRONG_BINDING', why: 'no eaves wall of its body faces this side at its place' })
          continue
        }
        const from = at.sign > 0 ? a[0] - at.a0 : at.a0 - a[1]
        const apex = f.apexY ?? f.box.y0
        const eaves = f.eavesY ?? null
        if (eaves === null || apex === null) {
          held.push({ ref, code: 'SOURCE_UNKNOWN', why: 'where its own roof begins was not read' })
          continue
        }
        dormers.push({ id: `dormer-${side.toLowerCase()}-${dormers.filter((d) => d.id.startsWith(`dormer-${side.toLowerCase()}`)).length + 1}`, bodyId: body.id, kind: f.kind === 'WALL_DORMER_GABLE' ? 'WALL_GABLE' : f.kind === 'ROOF_DORMER_GABLE' ? 'ROOF_GABLE' : 'ROOF_SHED', hostWall: at.h.id, fromM: num(r3(from), 'DERIVED', `its two sides on elevation ${obs.id}, at the plan's scale`, [ref], r3(2 * r.s)), toM: num(r3(from + (a[1] - a[0])), 'DERIVED', `its two sides on elevation ${obs.id}`, [ref], r3(2 * r.s)), eaveY: num(r3(r.yOf(eaves)), 'DERIVED', `the row its own roof begins at on elevation ${obs.id}`, [ref], 0.15), ridgeY: num(r3(r.yOf(apex)), 'DERIVED', `its apex on elevation ${obs.id}`, [ref], 0.15), refs: [ref] })
      } else if (f.kind === 'BALCONY') {
        const level = levels.filter((l) => (l.elevation.value ?? 0) <= r.yOf(f.box.y1) + 0.6).sort((p, q) => q.index - p.index)[0]
        const at = level ? hostAt(side, level.index, (a[0] + a[1]) / 2, f.bodyId) : undefined
        if (!level || !at || at.cos < 0.99) {
          held.push({ ref, code: 'WRONG_BINDING', why: 'no wall faces this side at its place' })
          continue
        }
        const from = at.sign > 0 ? a[0] - at.a0 : at.a0 - a[1]
        const p0 = { x: at.h.a.x + at.h.u.x * from, z: at.h.a.z + at.h.u.z * from }
        const p1 = { x: at.h.a.x + at.h.u.x * (from + a[1] - a[0]), z: at.h.a.z + at.h.u.z * (from + a[1] - a[0]) }
        const q = { x: p1.x + at.h.out.x * D.balconyDepthM, z: p1.z + at.h.out.z * D.balconyDepthM }
        balconies.push({ id: `balcony-${side.toLowerCase()}-${balconies.length + 1}`, level: level.index, rect: { x0: r3(Math.min(p0.x, q.x)), z0: r3(Math.min(p0.z, q.z)), x1: r3(Math.max(p0.x, q.x)), z1: r3(Math.max(p0.z, q.z)) }, topY: num(level.elevation.value ?? 0, level.elevation.basis === 'UNKNOWN' ? 'DEFAULT' : level.elevation.basis, 'at the floor of its storey'), thicknessM: num(0.2, 'DEFAULT', 'a conventional slab'), railing: true, basis: 'ESTIMATED', refs: [ref] })
        knownDefects.push({ code: 'BALCONY_DEPTH_ASSUMED', what: `${ref}: an elevation shows a balcony's width, not how far it projects: ${D.balconyDepthM} m is drawn` })
      } else held.push({ ref, code: 'CAPABILITY_MISSING', why: `${f.kind}: seen on the elevation; this resolver places no ${f.kind.toLowerCase()} from one elevation (its depth is not on the picture)` })
    }
    for (const x of obs.openings) {
      const ref = `${obs.id}/${x.id}`
      if (!bodiesOk) {
        held.push({ ref, code: 'HELD_BY_DEPENDENCY', why: 'the bodies do not cover the traced outline: an opening is not cut in a wall in doubt' })
        continue
      }
      if (x.kind === 'ROOF_WINDOW') {
        held.push({ ref, code: 'CAPABILITY_MISSING', why: 'a roof window: seen; not placed by this resolver' })
        continue
      }
      const a = [r.alongOf(x.box.x0), r.alongOf(x.box.x1)].sort((p, q) => p - q)
      const sillY = r.yOf(x.box.y1)
      const headY = r.yOf(x.box.y0)
      const level = x.level !== undefined ? levels.find((l) => l.index === x.level) : levels.filter((l) => (l.elevation.value ?? 0) <= sillY + 0.35).sort((p, q) => q.index - p.index)[0]
      // the wall that holds it: the top storey's wall holds what stands in a dormer above the eaves
      const wallLevel = level && outlines.some((q) => q.level === level.index) ? level.index : Math.max(...outlines.map((q) => q.level))
      const at = hostAt(side, wallLevel, (a[0] + a[1]) / 2, x.bodyId)
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
      const u = r3(Math.max(0.05, 2 * r.s))
      openings.push({ id: `opening-${side.toLowerCase()}-${openings.filter((q) => q.id.startsWith(`opening-${side.toLowerCase()}`)).length + 1}`, kind: x.kind as 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR', level: level.index, hostWall: at.h.id, offsetM: num(r3(from), 'DERIVED', `its two sides on elevation ${obs.id}, at the plan's scale`, [ref], u), widthM: num(r3(width), 'DERIVED', `its two sides on elevation ${obs.id}`, [ref], u), heightM: num(r3(headY - (door && sill < 0.25 ? (level.elevation.value ?? 0) : sillY)), 'DERIVED', `its head and sill rows on elevation ${obs.id}`, [ref], u), sillM: num(door && sill < 0.25 ? 0 : r3(sill), 'DERIVED', door && sill < 0.25 ? 'a door: its threshold at the floor' : `its sill row on elevation ${obs.id} above the floor of its storey`, [ref], u), refs: [ref] })
    }
  }

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
    canopies: [],
    chimneys: [],
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
  return { geometry, verification: { parameters, checks, held, knownDefects, coverage, quantities } }
}
