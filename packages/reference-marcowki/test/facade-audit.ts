/**
 * The four-facade comparison harness (STAGE BUILDAPP-01A §16).
 *
 * For every registered elevation reading in `ELEVATION_FEATURES` the model is
 * measured the same way an orthographic elevation would show it — bounds of
 * the compiled solids along the facade's across axis and up, the top of a wall
 * or the roof at a station, an opening's span, a finish region's edges — and
 * the difference is reported against the reading's tolerance. Every model
 * figure comes from the compiled triangles or the model records, never from
 * a render; no RGB is compared. Readings are in the reference frame
 * (x east, y up, z south), so the side facades convert BuildApp z with the
 * one documented transform `z_ref = 13.60 − z_app`.
 */
import { solidTriangles } from '@buildapp/geometry'
import { boundsOf, materialRuns, type OTri } from '@buildapp/verification'
import { ELEVATION_CALIBRATIONS, ELEVATION_FEATURES, EXPECTED_OPENINGS, refPlanToApp, type ElevationCalibration, type ElevationFeature } from '../src/index.js'
import { openingNearIsLow, structuralSolids, type Scene } from './measure.js'

export type FeatureStatus = 'PASS' | 'DEVIATION' | 'NOT_MODELLED' | 'NOT_FOUND'

export type FacadeFeatureResult = {
  id: string
  facade: ElevationFeature['facade']
  group: ElevationFeature['group']
  what: string
  at: string
  authority: ElevationFeature['authority']
  objectId: string
  measure: ElevationFeature['model']['measure']
  reading: { across?: [number, number]; up?: [number, number]; point?: { across: number; up: number } }
  model: { across?: [number, number]; up?: [number, number]; point?: { across: number; up: number } } | null
  /** The worst absolute difference between the reading and the model, in metres. */
  delta: number | null
  tolerance: number
  status: FeatureStatus
  note?: string
}

export type FacadeAudit = {
  generatedFrom: { modelId: string; schemaVersion: string; triangles: number }
  method: string
  calibrations: ElevationCalibration[]
  features: FacadeFeatureResult[]
  summary: { features: number; pass: number; deviation: number; notModelled: number; notFound: number; worstDelta: number }
}

/** Reference z ↔ BuildApp z. */
const zAppToRef = (z: number): number => 13.6 - z
const round = (v: number): number => Math.round(v * 1e4) / 1e4

/** The bounds of a set of triangles along the facade's across axis, in the reference frame. */
function acrossOf(tris: readonly OTri[], facade: ElevationFeature['facade']): [number, number] | null {
  const b = boundsOf(tris)
  if (!b) return null
  if (facade === 'FRONT' || facade === 'REAR') return [round(b.min.x), round(b.max.x)]
  return [round(zAppToRef(b.max.z)), round(zAppToRef(b.min.z))]
}
const upOf = (tris: readonly OTri[]): [number, number] | null => {
  const b = boundsOf(tris)
  return b ? [round(b.min.y), round(b.max.y)] : null
}


function measureFeature(s: Scene, f: ElevationFeature): FacadeFeatureResult['model'] {
  const m = f.model
  /** The triangles an elevation would show for an object: the whole silhouette for '*', a solid, a railing's glass, a rooflight unit. */
  const solidsOf = (id: string): OTri[] => {
    if (id === '*') return [...structuralSolids(s.scene).values()].flat()
    if (s.model.railings.some((r) => r.id === id)) return s.scene.meshes.filter((x) => x.objectId === id && x.part === 'RAILING_INFILL').flatMap((x) => x.triangles)
    if (s.model.rooflights.some((r) => r.id === id)) return s.scene.meshes.filter((x) => x.objectId === id).flatMap((x) => x.triangles)
    return solidTriangles(s.scene, id)
  }
  switch (m.measure) {
    case 'NONE':
      return null
    case 'BOUNDS_ACROSS': {
      const t = solidsOf(m.objectId)
      const a = acrossOf(t, f.facade)
      return a ? { across: a } : null
    }
    case 'BOUNDS_UP': {
      const t = solidsOf(m.objectId)
      const u = upOf(t)
      return u ? { up: u } : null
    }
    case 'RIDGE': {
      const u = upOf(solidsOf(m.objectId))
      return u ? { up: [u[1], u[1]] } : null
    }
    case 'WALL_TOP_AT':
    case 'ROOF_TOP_AT': {
      // the top of the object at the station: a vertical ray at `across`, placed on the object's own footprint (a return
      // stands in the recess, an eave wall's top is read at its outer face where the elevation shows it)
      const t = solidsOf(m.objectId)
      const b = boundsOf(t)
      if (!b) return null
      const p = f.facade === 'FRONT' || f.facade === 'REAR' ? { x: m.at!, z: (b.min.z + b.max.z) / 2 } : { x: f.facade === 'WEST' ? b.min.x + 0.02 : b.max.x - 0.02, z: refPlanToApp({ x: 0, z: m.at! }).z }
      const runs = materialRuns(t, { x: p.x, y: -1, z: p.z }, { x: 0, y: 1, z: 0 })
      if (runs.length === 0) return null
      const top = round(runs[runs.length - 1].t1 - 1)
      return { up: [top, top] }
    }
    case 'GLASS_SPAN': {
      // the pane inside the frame, as a render shows it
      const t = s.scene.meshes.filter((x) => x.objectId === m.objectId && (x.part === 'WINDOW_GLASS' || x.part === 'DOOR_GLASS')).flatMap((x) => x.triangles)
      const a = acrossOf(t, f.facade)
      const u = upOf(t)
      return a && u ? { across: a, up: u } : null
    }
    case 'OPENING_SPAN': {
      const e = EXPECTED_OPENINGS.find((o) => o.id === m.objectId)
      if (!e) return null
      const o = s.model.openings.find((x) => x.id === e.id)
      if (!o) return null
      const across: [number, number] = f.facade === 'FRONT' || f.facade === 'REAR' ? [round(e.span[0]), round(e.span[1])] : [round(zAppToRef(e.span[1])), round(zAppToRef(e.span[0]))]
      return { across, up: [round(e.sill), round(Math.max(e.headNear, e.headFar))] }
    }
    case 'OPENING_HEIGHTS': {
      // the structural head at the station `at`, linear between the two printed heights of a raked head
      const e = EXPECTED_OPENINGS.find((o) => o.id === m.objectId)
      if (!e || m.at === undefined) return null
      const nearIsLow = openingNearIsLow(s.model, e)
      const [u0, u1] = e.span
      const station = f.facade === 'FRONT' || f.facade === 'REAR' ? m.at : refPlanToApp({ x: 0, z: m.at }).z
      const fr = Math.min(1, Math.max(0, (station - u0) / (u1 - u0)))
      const hLow = nearIsLow ? e.headNear : e.headFar
      const hHigh = nearIsLow ? e.headFar : e.headNear
      const head = hLow + fr * (hHigh - hLow)
      return { point: { across: m.at, up: round(head) }, up: [round(head), round(head)] }
    }
    case 'REGION_ACROSS':
    case 'REGION_TOP': {
      // a finish region's skin; for a door, its glazed panel; for a window, its mullion
      const region = s.model.surfaceRegions.find((r) => r.id === m.objectId)
      const door = s.model.doors.find((d) => d.id === m.objectId)
      const win = s.model.windows.find((w) => w.id === m.objectId)
      const part = region ? 'SURFACE_REGION' : door ? 'DOOR_GLASS' : win ? 'WINDOW_MULLION' : null
      if (!part) return null
      const t = s.scene.meshes.filter((x) => x.objectId === m.objectId && x.part === part).flatMap((x) => x.triangles)
      if (t.length === 0) return null
      const a = acrossOf(t, f.facade)
      const u = upOf(t)
      if (!a || !u) return null
      if (m.measure === 'REGION_TOP') return { up: [u[1], u[1]] }
      // a single-station reading (a mullion) compares against the centre of the part's extent
      return f.across && f.across[0] === f.across[1] ? { across: [round((a[0] + a[1]) / 2), round((a[0] + a[1]) / 2)] } : { across: a, up: u }
    }
  }
}

/** A range reading against a range: both ends; a single-value reading (one edge) against a range: the nearer end. */
function rangeDelta(reading: [number, number], model: [number, number]): number[] {
  if (reading[0] === reading[1] && model[0] !== model[1]) return [Math.min(Math.abs(reading[0] - model[0]), Math.abs(reading[0] - model[1]))]
  return [Math.abs(reading[0] - model[0]), Math.abs(reading[1] - model[1])]
}

function deltaOf(f: ElevationFeature, model: FacadeFeatureResult['model']): number | null {
  if (!model) return null
  const ds: number[] = []
  if (f.across && model.across) ds.push(...rangeDelta(f.across, model.across))
  if (f.up && model.up) ds.push(...rangeDelta(f.up, model.up))
  if (f.point && model.point) ds.push(Math.abs(f.point.up - model.point.up))
  return ds.length ? round(Math.max(...ds)) : null
}

export function facadeAudit(s: Scene): FacadeAudit {
  const features = ELEVATION_FEATURES.map((f): FacadeFeatureResult => {
    const base = { id: f.id, facade: f.facade, group: f.group, what: f.what, at: f.at, authority: f.authority, objectId: f.model.objectId, measure: f.model.measure, reading: { ...(f.across ? { across: f.across } : {}), ...(f.up ? { up: f.up } : {}), ...(f.point ? { point: f.point } : {}) }, tolerance: f.tolerance, ...(f.note ? { note: f.note } : {}) }
    if (f.model.measure === 'NONE' || f.authority === 'NOT_MODELLED') return { ...base, model: null, delta: null, status: 'NOT_MODELLED' }
    const model = measureFeature(s, f)
    if (!model) return { ...base, model: null, delta: null, status: 'NOT_FOUND' }
    const delta = deltaOf(f, model)
    return { ...base, model, delta, status: delta !== null && delta <= f.tolerance + 1e-9 ? 'PASS' : 'DEVIATION' }
  })
  const count = (st: FeatureStatus): number => features.filter((x) => x.status === st).length
  return {
    generatedFrom: { modelId: s.model.id, schemaVersion: s.model.schemaVersion, triangles: s.scene.stats.triangleCount },
    method: 'Each registered elevation reading (metres in the reference frame, from the calibrated 1280 px renders) is compared with the compiled model measured orthographically along the same facade axis: solid bounds, wall and roof tops at stations by vertical rays, opening spans and raked heads from the printed callouts, finish-region skins, door glazing and window mullions from the compiled parts. No pixels are compared.',
    calibrations: [...ELEVATION_CALIBRATIONS],
    features,
    summary: { features: features.length, pass: count('PASS'), deviation: count('DEVIATION'), notModelled: count('NOT_MODELLED'), notFound: count('NOT_FOUND'), worstDelta: Math.max(0, ...features.filter((x) => x.status === 'PASS' || x.status === 'DEVIATION').map((x) => x.delta ?? 0)) },
  }
}

