/**
 * N8-03A (research only, offline): every opening of one house through five states, so that "every emitted opening is
 * cut" cannot pass for "every opening of the plan is there":
 *
 *   SOURCE_OBSERVED     a gap the plan reader traced in an exterior wall's band, or a door gap read in the partitions
 *   SELECTED_FOR_MODEL  the reconstruction kept it as an opening of the building (`building.openings`, `sharedDoors`,
 *                       an interior door of a kept partition)
 *   EMITTED             the model carries an opening of that id
 *   CUT_IN_GEOMETRY     a ray through its centre across its host wall meets no triangle of that wall in the compiled
 *                       BuildWorld geometry
 *   OMITTED_WITH_REASON observed and not selected, with the reason the run gave (a step or a gap that names its
 *                       interval)
 *
 * The run is replayed from its sealed inputs through this checkout's solver (rasters from the byte cache); the model is
 * the one the production replay wrote. Prints JSON; nothing is written.
 *   npx vite-node research/analyzer-n8-03a/opening-ledger.ts -- --run <dir> --cache <dir> --model <model.json>
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import type { Triangle, Vec3 } from '@buildapp/geometry'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const value = (name: string): string => process.argv[process.argv.indexOf(`--${name}`) + 1]
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try {
    rasters.set(variant.byteHash, decodeImage(got.bytes))
  } catch {
    rasters.set(variant.byteHash, undefined)
  }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
type Trace = { kind: string; id: string; massId: string; storey: number; facade: string; intervalM: [number, number]; widthPlanM: number; family: string; provenanceFamily?: string; sillY: number; headY: number; callout: unknown; elevation: unknown; unresolved: string[] }
const traces: Trace[] = []
const r = reconstructV2({ featureTrace: (t: Record<string, unknown>) => traces.push(t as Trace), modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const b = r.building as unknown as { openings: Array<{ id: string; family: string }>; sharedDoors: Array<{ id: string }>; interior: Array<{ storeyIndex: number; doors: Array<{ id: string; widthM: number; from: number; to: number; at: number; wallAxis: string; why: string }>; walls: Array<{ id: string }> }> }

// the compiled model: which openings are cut
function hits(t: Triangle, p: Vec3, q: Vec3): boolean {
  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z }
  const e1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z }
  const e2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z }
  const h = { x: d.y * e2.z - d.z * e2.y, y: d.z * e2.x - d.x * e2.z, z: d.x * e2.y - d.y * e2.x }
  const a = e1.x * h.x + e1.y * h.y + e1.z * h.z
  if (Math.abs(a) < 1e-12) return false
  const f = 1 / a
  const s = { x: p.x - t.a.x, y: p.y - t.a.y, z: p.z - t.a.z }
  const u = f * (s.x * h.x + s.y * h.y + s.z * h.z)
  if (u < 0 || u > 1) return false
  const qq = { x: s.y * e1.z - s.z * e1.y, y: s.z * e1.x - s.x * e1.z, z: s.x * e1.y - s.y * e1.x }
  const v = f * (d.x * qq.x + d.y * qq.y + d.z * qq.z)
  if (v < 0 || u + v > 1) return false
  const tt = f * (e2.x * qq.x + e2.y * qq.y + e2.z * qq.z)
  return tt >= 0 && tt <= 1
}
const model = parseModel(readFileSync(value('model'), 'utf8'))
const scene = compileBuilding(model)
const levels = new Map(model.levels.map((l) => [l.id, l]))
const bySolid = new Map<string, Triangle[]>()
for (const m of scene.meshes) if (m.part === 'WALL' || m.part === 'WALL_REVEAL') bySolid.set(m.solidId, [...(bySolid.get(m.solidId) ?? []), ...m.triangles])
const cut = (id: string): { emitted: boolean; cut: boolean; kind?: string; wallId?: string; widthM?: number; sillM?: number; heightM?: number } => {
  const o = model.openings.find((x) => x.id === id)
  if (!o) return { emitted: false, cut: false }
  const w = model.walls.find((x) => x.id === o.wallId)
  if (!w) return { emitted: true, cut: false, kind: o.kind, wallId: o.wallId }
  const l = levels.get(w.levelId)
  const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
  const u = { x: (w.end.x - w.start.x) / len, z: (w.end.z - w.start.z) / len }
  const n = { x: -u.z, z: u.x }
  const along = o.offset + o.width / 2
  const y = (l?.elevation ?? 0) + w.baseOffset + o.sill + o.height / 2
  const base = { x: w.start.x + u.x * along, z: w.start.z + u.z * along }
  const p = { x: base.x - n.x * 0.05, y, z: base.z - n.z * 0.05 }
  const q = { x: base.x + n.x * (w.thickness + 0.05), y, z: base.z + n.z * (w.thickness + 0.05) }
  return { emitted: true, cut: !(bySolid.get(w.id) ?? []).some((t) => hits(t, p, q)), kind: o.kind, wallId: o.wallId, widthM: o.width, sillM: o.sill, heightM: o.height }
}

// why an observed gap was left out: the run's steps and gaps that name its interval on its face
const reasons = (t: Trace): string[] => {
  const iv = `${t.intervalM[0].toFixed(2)}..${t.intervalM[1].toFixed(2)}`
  const face = `${t.facade.toLowerCase()}`
  const fromSteps = r.steps.filter((s) => s.what.includes(iv) && s.what.includes(face) && s.what.includes(t.massId)).map((s) => `${s.what}: ${s.detail}`)
  const fromGaps = r.unresolved.filter((u) => u.what.includes(iv) && u.what.includes(face) && u.what.includes(t.massId)).map((u) => `${u.what}: ${u.reason}`)
  return [...fromSteps, ...fromGaps]
}
const selectedIds = new Set([...b.openings.map((o) => o.id), ...b.sharedDoors.map((o) => o.id)])
const rows: Array<Record<string, unknown>> = []
for (const t of traces.filter((x) => x.kind === 'OPENING_GAP')) {
  const id = selectedIds.has(t.id) ? t.id : selectedIds.has(`shared-${t.id}`) ? `shared-${t.id}` : undefined
  const c = id ? cut(id) : { emitted: false, cut: false }
  const why = id ? [] : reasons(t)
  const state = !id ? 'OMITTED_WITH_REASON' : !c.emitted ? 'SELECTED_NOT_EMITTED' : c.cut ? 'CUT_IN_GEOMETRY' : 'EMITTED_NOT_CUT'
  rows.push({ id: t.id, where: `${t.massId} storey ${t.storey} ${t.facade}`, intervalM: t.intervalM, widthPlanM: t.widthPlanM, observedAs: t.family, heights: { sillY: t.sillY, headY: t.headY }, callout: t.callout, elevation: t.elevation, states: { SOURCE_OBSERVED: true, SELECTED_FOR_MODEL: !!id, EMITTED: c.emitted, CUT_IN_GEOMETRY: c.cut }, state, ...(id ? { modelId: id, model: c } : {}), ...(why.length > 0 ? { omittedBecause: why } : !id ? { omittedBecause: ['no step or gap of the run names this interval'] } : {}) })
}
for (const storey of b.interior) {
  for (const d of storey.doors) {
    const c = cut(d.id)
    rows.push({ id: d.id, where: `interior storey ${storey.storeyIndex}`, intervalM: [d.from, d.to], widthPlanM: d.widthM, observedAs: 'INTERIOR_DOOR', why: d.why, states: { SOURCE_OBSERVED: true, SELECTED_FOR_MODEL: true, EMITTED: c.emitted, CUT_IN_GEOMETRY: c.cut }, state: !c.emitted ? 'SELECTED_NOT_EMITTED' : c.cut ? 'CUT_IN_GEOMETRY' : 'EMITTED_NOT_CUT', model: c })
  }
}
// openings the model carries that no traced gap or interior door accounts for (doorways read on a shared band, …)
const accounted = new Set(rows.flatMap((x) => [x.id as string, (x.modelId as string | undefined) ?? '']))
for (const o of model.openings.filter((x) => !accounted.has(x.id))) {
  const c = cut(o.id)
  rows.push({ id: o.id, where: o.wallId, observedAs: 'NOT_TRACED', states: { SOURCE_OBSERVED: false, SELECTED_FOR_MODEL: true, EMITTED: true, CUT_IN_GEOMETRY: c.cut }, state: c.cut ? 'CUT_IN_GEOMETRY' : 'EMITTED_NOT_CUT', model: c })
}
const count = (s: string): number => rows.filter((x) => x.state === s).length
const rr = r as unknown as { modelCompleteness?: unknown; partyWalls?: unknown }
console.log(JSON.stringify({ modelId: model.id, modelCompleteness: rr.modelCompleteness, contacts: rr.partyWalls, unresolved: r.unresolved.map((u) => `${u.status}: ${u.what}: ${u.reason}`), counts: { observed: rows.filter((x) => (x.states as { SOURCE_OBSERVED: boolean }).SOURCE_OBSERVED).length, selected: rows.filter((x) => (x.states as { SELECTED_FOR_MODEL: boolean }).SELECTED_FOR_MODEL).length, emitted: model.openings.length, cut: count('CUT_IN_GEOMETRY'), emittedNotCut: count('EMITTED_NOT_CUT'), selectedNotEmitted: count('SELECTED_NOT_EMITTED'), omitted: count('OMITTED_WITH_REASON') }, rows }, null, 1))
