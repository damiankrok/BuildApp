/**
 * v3.54.14 R2 — the sketch step (L-MS), one implementation for the host's consultant path and the research driver:
 * on the run that stands (its package, graph and metric evidence — the metric facts are reused, never read again):
 *   1. every registered elevation read by the API into typed contours (`readElevationSketch`);
 *   2. each drawn locally at its frame's size and checked for proportions against the printed levels both readers
 *      agree on (the API's section read and the analyzer's datum OCR) and the plans' extent (`checkProportions`);
 *   3. FORM: a candidate built by the analyzer with the accepted sketches in place of those elevations
 *      (`elevationSketches`) — accepted when it completes on the same scale with no fewer storeys, bodies or openings;
 *   4. FINISH: the accepted sketches' wall zones on the model that stands, each by the sketch's own registration
 *      (usable-geometry fingerprint guarded by the consumer).
 */
import { compileBuilding } from '@buildapp/geometry'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import { usableGeometryFingerprint } from '../appearance/consumer.js'
import type { AppearanceObservation } from '../appearance/contract.js'
import { checkProportions, readElevationSketch, renderSketch, sketchToAppearance } from '../appearance/elevation-sketch.js'
import type { ElevationSketch, ProportionCheck } from '../appearance/elevation-sketch.js'
import { facadeAxes } from '../appearance/visibility.js'
import type { Facade } from '../appearance/visibility.js'
import { measureBuilt } from './metric-read.js'
import type { BuiltMeasure, IndependentRead } from './metric-read.js'
import type { ConsultSpend, ConsultantModel, Price } from './loop.js'

export const SKETCH_STEP_VERSION = '1.1.0' as const

export type SketchStepInput = {
  metrics: MetricEvidenceSet
  model: CanonicalBuildingModel
  views: ReadonlyArray<{ facade: Facade; frameId: string; projection: { alongAtPx0: number; alongSign: number; mpp: number; zeroRow: number } }>
  /** The metric consultant's reads (for the section's printed levels), when it ran. */
  metricReads?: readonly IndependentRead[]
  rasterOf: (frameId: string) => Promise<{ raster: Raster; caption: string; sourceByteHash: string } | undefined>
  ctx: { model: ConsultantModel; price: Price; spend?: ConsultSpend; signal?: AbortSignal }
}
export type SketchReading = {
  version: string
  printedLevels: Array<{ literal: string; value: number; hint: string; role?: string; roleFrom?: string }>
  sketches: Array<{ facade: Facade; frameId: string; sketch?: ElevationSketch; check?: ProportionCheck; raw?: unknown; usd: number; failed?: string; requestId?: string }>
  /** For the shape reader: the accepted sketches drawn at their frames' size. */
  elevationSketches: Array<{ frameId: string; raster: Raster }>
  /** For the finish consumer: the accepted sketches' zones and each one's own registration, by source byte hash. */
  appearance: { observations: AppearanceObservation[]; projections: Record<string, { alongAtPx0: number; alongSign: number; mpp: number; zeroRow: number }> }
  usd: number
}

/** The model's extent along a side (outer faces of every wall) and its openings facing that side. */
function sideFacts(model: CanonicalBuildingModel, facade: Facade): { lo: number; hi: number; openings: Array<{ id: string; a0: number; a1: number; b0: number; b1: number }> } {
  const scene = compileBuilding(model)
  const ax = facadeAxes(facade)
  let lo = Infinity
  let hi = -Infinity
  const openings: Array<{ id: string; a0: number; a1: number; b0: number; b1: number }> = []
  for (const m of scene.meshes) {
    if (m.part === 'WALL') for (const t of m.triangles) for (const p of [t.a, t.b, t.c]) {
      const a = ax.along(p.x, p.z)
      lo = Math.min(lo, a)
      hi = Math.max(hi, a)
    }
    if (m.openingId && /GLASS|LEAF|PANEL/.test(m.part) && m.triangles.length > 0 && !openings.some((o) => o.id === m.openingId)) {
      const t = m.triangles[0]
      const ux = t.b.x - t.a.x
      const uy = t.b.y - t.a.y
      const uz = t.b.z - t.a.z
      const vx = t.c.x - t.a.x
      const vy = t.c.y - t.a.y
      const vz = t.c.z - t.a.z
      const nx = uy * vz - uz * vy
      const nz = ux * vy - uy * vx
      const len = Math.hypot(nx, uz * vx - ux * vz, nz) || 1
      if (Math.abs((nx * ax.toViewer.x + nz * ax.toViewer.z) / len) < 0.9) continue
      const pts = m.triangles.flatMap((q) => [q.a, q.b, q.c])
      const as = pts.map((p) => ax.along(p.x, p.z))
      const ys = pts.map((p) => p.y)
      openings.push({ id: m.openingId, a0: Math.min(...as), a1: Math.max(...as), b0: Math.min(...ys), b1: Math.max(...ys) })
    }
  }
  return { lo, hi, openings }
}

/** Steps 1–2: read every registered elevation, draw it, check its proportions; what passes is handed out. */
export async function readSketches(input: SketchStepInput): Promise<SketchReading> {
  // v3.54.15: a printed level is usable when the run that stands holds it as a LEVEL_DATUM — admitted by the drawing
  // (the analyzer's own reading, or the consultant's admitted by the section's ladder) — no longer only when LOCAL read it
  const admitted = ((input.metrics as { evidence?: Array<{ kind: string; value?: number }> }).evidence ?? []).filter((e) => e.kind === 'LEVEL_DATUM' && typeof e.value === 'number').map((e) => e.value as number)
  const agreed = (input.metricReads ?? []).flatMap((r) => r.observations).filter((o) => o.kind === 'LEVEL' && o.value !== null && admitted.some((v) => Math.abs(v - (o.value as number)) <= 0.005))
  const printedLevels = agreed.map((o) => ({ literal: o.literal, value: o.value as number, hint: o.hostHint ?? '', ...(o.role ? { role: o.role, roleFrom: o.roleFrom ?? 'API' } : {}) }))
  // the ridge and the eaves by their role, never "the highest mark" (a chimney top or another body's level is not the ridge);
  // two different values for one role are a dispute: no ridge
  const byRole = (role: string): number | undefined => {
    const vs = [...new Set(agreed.filter((o) => o.role === role).map((o) => o.value as number))]
    return vs.length === 1 ? vs[0] : undefined
  }
  const ridge = byRole('RIDGE')
  const eaves = byRole('EAVES')
  const sketches: SketchReading['sketches'] = []
  const elevationSketches: SketchReading['elevationSketches'] = []
  const appearance: SketchReading['appearance'] = { observations: [], projections: {} }
  for (const view of input.views) {
    const fr = await input.rasterOf(view.frameId)
    if (!fr) {
      sketches.push({ facade: view.facade, frameId: view.frameId, usd: 0, failed: "the elevation could not be decoded from the run's bytes" })
      continue
    }
    const r = await readElevationSketch(input.ctx, { frameId: view.frameId, raster: fr.raster, caption: fr.caption })
    if (!r.sketch) {
      sketches.push({ facade: view.facade, frameId: view.frameId, usd: r.usd, ...(r.failed ? { failed: r.failed } : {}), raw: r.raw })
      continue
    }
    const f = sideFacts(input.model, view.facade)
    const check = checkProportions(r.sketch, { alongSign: view.projection.alongSign, alongMin: f.lo, alongMax: f.hi, ...(ridge !== undefined ? { ridge } : {}), ...(eaves !== undefined && eaves !== null ? { eaves } : {}), openings: f.openings, local: view.projection })
    sketches.push({ facade: view.facade, frameId: view.frameId, sketch: r.sketch, check, raw: r.raw, usd: r.usd, ...(r.requestId ? { requestId: r.requestId } : {}) })
    // the form reader takes only a sketch whose form passed; the finish consumer also takes a PARTIAL one (finish only)
    if (check.verdict === 'ACCEPTED') elevationSketches.push({ frameId: view.frameId, raster: renderSketch(r.sketch) })
    if (check.properties.finish === 'ACCEPTED' && check.projection) {
      appearance.observations.push(sketchToAppearance(r.sketch, view.facade, fr.sourceByteHash))
      appearance.projections[fr.sourceByteHash] = check.projection
    }
  }
  return { version: SKETCH_STEP_VERSION, printedLevels, sketches, elevationSketches, appearance, usd: Math.round(sketches.reduce((a, s) => a + s.usd, 0) * 1e6) / 1e6 }
}

/**
 * Step 3: does the candidate the shape reader built with the sketches stand? It must complete and keep the plan's
 * outline (5 cm), its storeys, exterior walls and openings (no fewer), and change the usable geometry (else there is
 * nothing of the form to take). Finish-only candidates are judged by the consumer's fingerprint guard.
 */
export function judgeForm(before: CanonicalBuildingModel, after: CanonicalBuildingModel | undefined, sketches: number): { decision: 'ACCEPT' | 'ROLLBACK'; why: string; measuredBefore: BuiltMeasure; measuredAfter?: BuiltMeasure; changed?: boolean } {
  const measuredBefore = measureBuilt(before, compileBuilding(before))
  if (!after) return { decision: 'ROLLBACK', why: 'the candidate with the sketches did not complete: the model before stands', measuredBefore }
  const measuredAfter = measureBuilt(after, compileBuilding(after))
  const changed = usableGeometryFingerprint(after) !== usableGeometryFingerprint(before)
  const lost = [measuredAfter.levels.length < measuredBefore.levels.length ? 'storeys' : '', measuredAfter.walls < measuredBefore.walls ? 'exterior walls' : '', measuredAfter.openings < measuredBefore.openings ? 'openings' : '', Math.abs(measuredAfter.outlineX - measuredBefore.outlineX) > 0.05 || Math.abs(measuredAfter.outlineZ - measuredBefore.outlineZ) > 0.05 ? 'the plan outline' : ''].filter(Boolean)
  // v3.54.15: identity, not only counts — every opening of the model before has its counterpart in the candidate on the
  // same level within 0.30 m of its centre and 0.30 m of its width; the same count with an opening lost or moved is a loss
  const centres = (m: CanonicalBuildingModel): Array<{ id: string; level: string; x: number; z: number; y: number; w: number }> => m.openings.flatMap((o) => {
    const w = m.walls.find((x) => x.id === o.wallId)
    if (!w) return []
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) || 1
    const t = (o.offset + o.width / 2) / L
    return [{ id: o.id, level: w.levelId, x: w.start.x + (w.end.x - w.start.x) * t, z: w.start.z + (w.end.z - w.start.z) * t, y: o.sill + o.height / 2, w: o.width }]
  })
  const afterCentres = centres(after)
  const unmatched = centres(before).filter((b) => !afterCentres.some((a) => a.level === b.level && Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y) <= 0.3 && Math.abs(a.w - b.w) <= 0.3))
  if (unmatched.length > 0) lost.push(`${unmatched.length} opening(s) of the model before lost or moved (${unmatched.slice(0, 4).map((u) => u.id).join(', ')})`)
  if (lost.length > 0) return { decision: 'ROLLBACK', why: `the sketches cost ${lost.join(', ')}: the model before stands`, measuredBefore, measuredAfter, changed }
  if (!changed) return { decision: 'ROLLBACK', why: 'the same usable geometry: nothing of the form changed', measuredBefore, measuredAfter, changed }
  return { decision: 'ACCEPT', why: `${sketches} sketch(es) read by the shape reader; outline ${measuredAfter.outlineX} × ${measuredAfter.outlineZ}, storeys, exterior walls and openings kept (openings ${measuredBefore.openings} → ${measuredAfter.openings})`, measuredBefore, measuredAfter, changed }
}
