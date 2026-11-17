/**
 * v3.54.4 — from a whole-house reading to a compiled scene, and the decision between that house and LOCAL's.
 *
 *   answers (pixels of the sent pictures) → observations (pixels of the published pictures) → house document
 *     → resolveHouse (metres, checks, holds) → buildHouse (kernel commands) → compile → measured scene
 *
 * No step here reads a picture or asks a model: the readings come in as data (`read.ts`), and everything after them is
 * deterministic, so the same recorded answers give the same model hash. The decision between the described house and
 * LOCAL's model (`arbitrate`) rests on source facts both can be measured against — printed overall dimensions whose ends
 * were verified on the traced outline, the published building height, the bodies — not on who produced which.
 */
import { createHash } from 'node:crypto'
import { parseModel, serializeModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import type { MobileSceneBundle } from '@buildapp/mobile-scene'
import { HOUSE_DOCUMENT_SCHEMA, HOUSE_DOCUMENT_VERSION, housePoly, parseHouseDocument, resolveHouse } from '@buildapp/reconstruction'
import type { HouseDocument } from '@buildapp/reconstruction'
import { buildHouse } from './build.js'
import type { BuiltHouse } from './build.js'
import { measureScene } from './measure.js'
import type { SceneMeasure } from './measure.js'
import { HOUSE_READING_CONTRACT, HOUSE_READING_VERSION, levelLiteralToMetres, literalToMetres } from './read.js'
import type { FacadesAnswer, InventoryAnswer, PlanAnswer, Selection } from './read.js'
import type { SentPicture } from './pictures.js'

export type Published = ReadonlyArray<{ key: string; value: number; unit: string; raw?: string }>
export type ReadingAnswers = { inventory?: InventoryAnswer; plan: PlanAnswer; facades?: FacadesAnswer }
export type ConversionNote = { code: 'PARSE_REJECTED' | 'WRONG_READ' | 'WRONG_BINDING' | 'SOURCE_UNKNOWN'; ref: string; why: string }

const idOk = (s: string): boolean => /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(s)
const r1 = (v: number): number => Math.round(v * 10) / 10
const LEVEL_MARKS = new Set(['GROUND_FLOOR', 'UPPER_FLOOR', 'RIDGE', 'EAVES', 'TERRAIN', 'FLOOR_BELOW_ZERO'])

/** A height printed on a section (a decimal number of metres, or a bare whole number) to metres: a bare whole number is centimetres. */
function heightLiteral(literal: string): number | null {
  const t = literal.trim().replace(/\s+/g, '')
  if (/^\d+[.,]\d+m?$/.test(t)) return Number(t.replace('m', '').replace(',', '.'))
  if (/^\d{2,4}$/.test(t)) return Number(t) / 100
  return null
}

/** The answers as the observation layer of a house document. What cannot be taken is named in `notes`, never repaired. */
export function documentFromReading(input: { id: string; project?: string; sourcePackageHash?: string; model: string; selection: Selection; planSent: SentPicture[]; facadesSent?: SentPicture[]; answers: ReadingAnswers; published: Published; at?: string }): { document: unknown; notes: ConversionNote[] } {
  const notes: ConversionNote[] = []
  const { selection, answers } = input
  const plan = answers.plan
  const k0 = 1 / input.planSent[0].scale
  const P = (p: { x: number; y: number }): { x: number; y: number } => ({ x: r1(p.x * k0), y: r1(p.y * k0) })
  const pictures = [
    { id: selection.ground.id, assetId: selection.ground.assetId, role: 'PLAN', level: 0, widthPx: selection.ground.width, heightPx: selection.ground.height, reduction: input.planSent[0].scale },
    ...selection.upperPlans.map((p, i) => ({ id: p.id, assetId: p.assetId, role: 'PLAN', level: i + 1, widthPx: p.width, heightPx: p.height })),
    ...selection.sections.map((p) => ({ id: p.id, assetId: p.assetId, role: 'SECTION', widthPx: p.width, heightPx: p.height })),
    ...selection.elevations.map((p) => ({ id: p.id, assetId: p.assetId, role: 'ELEVATION', widthPx: p.width, heightPx: p.height })),
    ...selection.views.map((p) => ({ id: p.id, assetId: p.assetId, role: 'RENDER', widthPx: p.width, heightPx: p.height })),
    ...selection.notThisHouse.map((p) => ({ id: p.id, assetId: p.assetId, role: 'OTHER', widthPx: p.width, heightPx: p.height, thisHouse: false })),
  ]
  const bodyIds = new Set<string>()
  const outlines: unknown[] = [{ id: 'ol-whole', picture: selection.ground.id, level: 0, what: 'WHOLE', polygon: (plan.whole ?? []).map(P), origin: 'API' }]
  for (const b of plan.bodies ?? []) {
    if (!idOk(b.id) || bodyIds.has(b.id) || !Array.isArray(b.polygon) || b.polygon.length < 3) {
      notes.push({ code: 'PARSE_REJECTED', ref: `body ${b.id}`, why: 'no usable id or outline' })
      continue
    }
    bodyIds.add(b.id)
    outlines.push({ id: `ol-${b.id}`, picture: selection.ground.id, level: 0, what: 'BODY', bodyId: b.id, role: b.role, storeys: [...new Set(b.storeys.includes(0) ? b.storeys : [0, ...b.storeys])].sort((p, q) => p - q), polygon: b.polygon.map(P), origin: 'API', ...(b.note ? { note: b.note } : {}) })
  }
  ;(plan.openZones ?? []).forEach((z, i) => {
    if (Array.isArray(z.polygon) && z.polygon.length >= 3) outlines.push({ id: `open-${i + 1}`, picture: selection.ground.id, level: 0, what: 'OPEN', role: 'PORCH', polygon: z.polygon.map(P), origin: 'API', ...(z.what ? { note: z.what } : {}) })
  })
  const dimensions: unknown[] = []
  ;(plan.dimensions ?? []).forEach((d, i) => {
    const own = literalToMetres(d.literal, d.unit)
    const value = own ?? (typeof d.valueM === 'number' && d.valueM > 0 ? d.valueM : null)
    if (own !== null && typeof d.valueM === 'number' && Math.abs(own - d.valueM) > 0.011 * Math.max(own, d.valueM)) notes.push({ code: 'WRONG_READ', ref: `dimension ${d.literal}`, why: `the reader converted "${d.literal}" ${d.unit} to ${d.valueM} m; the program reads ${own} m and uses that` })
    if (value === null) {
      notes.push({ code: 'SOURCE_UNKNOWN', ref: `dimension ${d.literal}`, why: `"${d.literal}" in unit ${d.unit} is not a length the program can read` })
      return
    }
    dimensions.push({ id: `dim-${i + 1}`, picture: selection.ground.id, literal: d.literal, unit: d.unit, valueM: value, from: P(d.from), to: P(d.to), measures: d.measures, ...(d.includes ? { includes: d.includes } : {}), ...(d.bodyId && bodyIds.has(d.bodyId) ? { bodyId: d.bodyId } : {}), origin: 'API' })
  })
  // the reader names bodies by the plan's ids; letter case is not a different body
  const bodyOf = (id: string | undefined): string | undefined => (id === undefined ? undefined : bodyIds.has(id) ? id : [...bodyIds].find((b) => b.toLowerCase() === id.toLowerCase()))
  const levels: unknown[] = []
  const roofs: unknown[] = []
  const elevations: unknown[] = []
  const f = answers.facades
  const fs = input.facadesSent ?? []
  if (f) {
    ;(f.levels ?? []).forEach((l, i) => {
      const sent = fs[l.picture - 1]
      const mark = LEVEL_MARKS.has(l.meaning)
      const own = mark ? levelLiteralToMetres(l.literal) : l.meaning === 'ROOF_PITCH_DEG' ? Number((/(\d+(?:[.,]\d+)?)/.exec(l.literal)?.[1] ?? '').replace(',', '.')) || null : heightLiteral(l.literal)
      const value = own ?? (typeof l.valueM === 'number' ? l.valueM : null)
      if (own !== null && typeof l.valueM === 'number' && Math.abs(own - l.valueM) > 0.011) notes.push({ code: 'WRONG_READ', ref: `level ${l.literal}`, why: `the reader gave ${l.valueM} for "${l.literal}"; the program reads ${own} and uses that` })
      if (!sent) return void notes.push({ code: 'WRONG_BINDING', ref: `level ${l.literal}`, why: `picture ${l.picture} is not one of the pictures sent` })
      levels.push({ id: `lv-${i + 1}`, picture: sent.picture.id, literal: l.literal || '?', valueM: value, meaning: l.meaning, ...(bodyOf(l.bodyId) ? { bodyId: bodyOf(l.bodyId) } : {}), ...(typeof l.level === 'number' ? { level: l.level } : {}), origin: 'API' })
    })
    for (const r of f.roofs ?? []) {
      const rb = bodyOf(r.bodyId)
      if (!rb) {
        notes.push({ code: 'WRONG_BINDING', ref: `roof of ${r.bodyId}`, why: 'no such body on the plan' })
        continue
      }
      roofs.push({ id: `roof-${rb}`, bodyId: rb, kind: r.kind, ridge: r.ridge, pictures: [], origin: 'API', ...(r.note ? { note: r.note } : {}) })
    }
    const seenPictures = new Set<string>()
    ;(f.elevations ?? []).forEach((e, i) => {
      const sent = fs[e.picture - 1]
      if (!sent || !selection.elevations.includes(sent.picture) || seenPictures.has(sent.picture.id)) {
        notes.push({ code: 'WRONG_BINDING', ref: `elevation ${i + 1}`, why: `picture ${e.picture} is not an elevation sent for measuring, or was described twice` })
        return
      }
      seenPictures.add(sent.picture.id)
      const k = 1 / sent.scale
      const B = (b: { x0: number; y0: number; x1: number; y1: number }): { x0: number; y0: number; x1: number; y1: number } => ({ x0: r1(Math.min(b.x0, b.x1) * k), y0: r1(Math.min(b.y0, b.y1) * k), x1: r1(Math.max(b.x0, b.x1) * k), y1: r1(Math.max(b.y0, b.y1) * k) })
      const featureIds = new Set<string>()
      const features = (e.features ?? []).flatMap((x, j) => {
        const id = idOk(x.id) && !featureIds.has(x.id.toLowerCase()) ? x.id.toLowerCase() : `feature-${j + 1}`
        featureIds.add(id)
        return [{ id, kind: x.kind, box: B(x.box), ...(bodyOf(x.bodyId) ? { bodyId: bodyOf(x.bodyId) } : {}), ...(typeof x.eavesY === 'number' ? { eavesY: r1(x.eavesY * k) } : {}), ...(typeof x.apexY === 'number' ? { apexY: r1(x.apexY * k) } : {}), ...(x.note ? { note: x.note } : {}) }]
      })
      const bodies = (e.bodies ?? []).flatMap((b) => {
        const eb = bodyOf(b.bodyId)
        if (!eb) {
          notes.push({ code: 'WRONG_BINDING', ref: `elevation ${i + 1} body ${b.bodyId}`, why: 'no such body on the plan' })
          return []
        }
        return [{ bodyId: eb, leftX: r1(Math.min(b.leftX, b.rightX) * k), rightX: r1(Math.max(b.leftX, b.rightX) * k), eavesY: typeof b.eavesY === 'number' ? r1(b.eavesY * k) : null, ridgeY: typeof b.ridgeY === 'number' ? r1(b.ridgeY * k) : null }]
      })
      const openings = (e.openings ?? []).map((x, j) => ({ id: `o${j + 1}`, kind: x.kind, box: B(x.box), ...(bodyOf(x.bodyId) ? { bodyId: bodyOf(x.bodyId) } : {}), ...(typeof x.level === 'number' ? { level: x.level } : {}), ...(x.inFeature && featureIds.has(x.inFeature.toLowerCase()) ? { inFeature: x.inFeature.toLowerCase() } : {}) }))
      elevations.push({ id: `el-${sent.picture.id}`, picture: sent.picture.id, side: e.side, sideHow: e.sideHow ?? '', alternatives: (e.alternatives ?? []).filter((s) => s !== e.side), mirrored: e.mirrored === true, groundY: r1(e.groundY * k), bodies, openings, features, origin: 'API' })
    })
  }
  const published = input.published.filter((p) => ['building_height', 'footprint_area', 'roof_pitch', 'building_width', 'building_depth'].includes(p.key)).map((p) => ({ key: p.key, value: p.value, unit: p.unit, ...(p.raw ? { raw: p.raw } : {}) }))
  const missing = [
    ...(selection.sections.length === 0 ? [{ what: 'a section', status: 'NOT_PUBLISHED' as const }] : []),
    ...(selection.elevations.length === 0 ? [{ what: 'elevations', status: 'NOT_PUBLISHED' as const }] : []),
    ...(!f ? [{ what: 'the section and the elevations were not read', status: 'NOT_SENT' as const }] : []),
  ]
  const document = {
    schema: HOUSE_DOCUMENT_SCHEMA,
    schemaVersion: HOUSE_DOCUMENT_VERSION,
    id: input.id,
    origin: 'API_SOURCE_DESCRIPTION',
    source: { ...(input.sourcePackageHash ? { sourcePackageHash: input.sourcePackageHash } : {}), ...(input.project ? { project: input.project } : {}), pictures, missing },
    reader: { engine: `${HOUSE_READING_CONTRACT}@${HOUSE_READING_VERSION}`, model: input.model, ...(input.at ? { at: input.at } : {}) },
    observations: { front: { planEdge: plan.front?.planEdge, how: plan.front?.how ?? '', origin: 'API' }, dimensions, levels, outlines, elevations, roofs, published, unknowns: [...(plan.unknowns ?? []), ...(f?.unknowns ?? [])].slice(0, 16) },
  }
  return { document, notes }
}

export type CompiledHouse = {
  document: HouseDocument
  built?: BuiltHouse
  bundle?: MobileSceneBundle
  modelJson?: string
  modelHash?: string
  measured?: SceneMeasure
  compileErrors: Array<{ code: string; objectId?: string; message: string }>
  /** Blocking checks that failed: the description is not accepted as this house. */
  failed: Array<{ scope: string; what: string; measured: string; expected: string }>
  rejected?: string[]
}

/** A house document (observations, or observations with agreed geometry) through the resolver, the builder and the compiler. */
export function compileHouse(input: unknown, modelId: string): CompiledHouse {
  const parsed = parseHouseDocument(input)
  if (!parsed.ok) return { document: { id: 'rejected' } as HouseDocument, compileErrors: [], failed: [], rejected: parsed.issues }
  const doc = parsed.document
  if (!doc.geometry) {
    const r = resolveHouse(doc)
    if (r.geometry) doc.geometry = r.geometry
    doc.verification = r.verification
  }
  // What stops the description from standing as this house: a failed check of identity, metric, bodies or levels. An
  // elevation that does not register holds what was read on it and nothing else — unless none registers at all, which
  // leaves the sides of the house unverified.
  const checks = doc.verification.checks
  const failed = checks.filter((c) => c.status === 'FAIL' && (c.scope === 'IDENTITY' || c.scope === 'METRIC' || c.scope === 'BODIES' || c.scope === 'LEVELS' || c.blocks.includes('geometry'))).map((c) => ({ scope: c.scope, what: c.what, measured: c.measured, expected: c.expected }))
  const registrations = checks.filter((c) => c.scope === 'ORIENTATION' && c.id.startsWith('elevation-'))
  if (registrations.length > 0 && registrations.every((c) => c.status === 'FAIL')) failed.push({ scope: 'ORIENTATION', what: 'no elevation registers to the plan: which side is which is not verified', measured: registrations.map((c) => c.measured).join(' | ').slice(0, 300), expected: 'at least one elevation at the plan\'s scale' })
  if (!doc.geometry) return { document: doc, compileErrors: [], failed }
  const built = buildHouse(doc, modelId)
  const modelJson = serializeModel(built.model)
  const scene = compileBuilding(parseModel(modelJson) as never)
  const bundle = buildMobileSceneBundle(built.model, { scene })
  const compileErrors = scene.diagnostics.filter((d) => d.severity === 'ERROR').map((d) => ({ code: d.code, ...((d as { objectId?: string }).objectId ? { objectId: (d as { objectId?: string }).objectId } : {}), message: String((d as { message?: string }).message ?? '').slice(0, 240) }))
  const measured = measureScene(bundle, doc.geometry)
  doc.verification.parameters = [...doc.verification.parameters, ...built.trace]
  for (const r of built.refusals) doc.verification.held.push({ ref: r.path, code: r.code, why: r.why })
  for (const r of built.kernelRefusals) doc.verification.held.push({ ref: r.id ?? r.type, code: 'COMPILE_CONFLICT', why: `${r.codes.join(',')}: ${r.message.slice(0, 200)}` })
  for (const e of compileErrors) doc.verification.held.push({ ref: e.objectId ?? e.code, code: 'COMPILE_CONFLICT', why: `${e.code}: ${e.message}` })
  const modelHash = createHash('sha256').update(modelJson).digest('hex')
  doc.verification.modelHash = modelHash
  return { document: doc, built, bundle, modelJson, modelHash, measured, compileErrors, failed }
}

// ---------------------------------------------------------------------------------------------------------------------
// the decision between the described house and LOCAL's
// ---------------------------------------------------------------------------------------------------------------------

export const ARBITRATION = { extentShare: 0.04, extentM: 0.35, heightM: 0.45, footprintShare: 0.12, outlineOverlap: 0.85 } as const
export type LocalMeasure = { widthM: number; depthM: number; heightAboveTerrainM: number | null; topAboveGroundFloorM: number | null; groundAreaM2: number | null; roofPlanes: number; /** The ground slab outline(s), in LOCAL's own frame (x right seen from the front, z back). */ groundPolygons?: Array<Array<{ x: number; z: number }>> }

/** How much two ground outlines are the same shape in the same place, each set against its own front-left corner: area in both over area in either. */
export function outlineOverlap(a: Array<Array<{ x: number; z: number }>>, b: Array<Array<{ x: number; z: number }>>, cell = 0.15): number {
  const norm = (polys: Array<Array<{ x: number; z: number }>>): { polys: Array<Array<{ x: number; z: number }>>; w: number; d: number } => {
    const xs = polys.flat().map((p) => p.x)
    const zs = polys.flat().map((p) => p.z)
    const x0 = Math.min(...xs)
    const z0 = Math.min(...zs)
    return { polys: polys.map((poly) => poly.map((p) => ({ x: p.x - x0, z: p.z - z0 }))), w: Math.max(...xs) - x0, d: Math.max(...zs) - z0 }
  }
  const A = norm(a)
  const B = norm(b)
  const inside = (polys: Array<Array<{ x: number; z: number }>>, p: { x: number; z: number }): boolean => polys.some((poly) => housePoly.contains(poly, p))
  let both = 0
  let either = 0
  for (let x = cell / 2; x < Math.max(A.w, B.w); x += cell) {
    for (let z = cell / 2; z < Math.max(A.d, B.d); z += cell) {
      const ia = inside(A.polys, { x, z })
      const ib = inside(B.polys, { x, z })
      if (ia && ib) both += 1
      if (ia || ib) either += 1
    }
  }
  return either === 0 ? 0 : both / either
}
export type ArbitrationFinding = { fact: string; source: string; local: string; described: string; localOk: boolean; describedOk: boolean }
export type Arbitration = { accepted: 'DESCRIBED' | 'LOCAL' | 'NONE'; why: string; findings: ArbitrationFinding[] }

/**
 * Which house stands. The described house must first pass its own blocking checks (its printed dimensions stand on its
 * outline, its bodies tile it, its heights agree with the page). Then both are held against the same source facts. LOCAL
 * stays when it meets every one of them — a correct base is not replaced by a second opinion. The described house
 * replaces LOCAL only where LOCAL contradicts a source fact that the described house meets.
 */
export function arbitrate(described: CompiledHouse, local: LocalMeasure | undefined, published: Published): Arbitration {
  const findings: ArbitrationFinding[] = []
  const g = described.document.geometry
  const m = described.measured
  if (described.rejected) return { accepted: local ? 'LOCAL' : 'NONE', why: `the description was rejected by the document schema: ${described.rejected.slice(0, 2).join('; ')}`, findings }
  if (!g || !m || !m.exteriorWalls || !described.built) return { accepted: local ? 'LOCAL' : 'NONE', why: `the description did not resolve to a geometry${described.failed.length ? `: ${described.failed.map((f) => f.what).join('; ').slice(0, 300)}` : ''}`, findings }
  if (described.failed.length > 0) return { accepted: local ? 'LOCAL' : 'NONE', why: `the description fails its own source checks: ${described.failed.map((f) => `${f.what} (${f.measured})`).join('; ').slice(0, 400)}`, findings }
  if (!local) return { accepted: 'DESCRIBED', why: 'the description passes its source checks and there is no LOCAL model', findings }
  const walls = m.exteriorWalls
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(ARBITRATION.extentM, ARBITRATION.extentShare * b)
  const fmt = (v: number | null): string => (v === null ? 'not built' : `${v.toFixed(2)} m`)
  const obs = described.document.observations
  const overall = obs.dimensions.filter((d) => d.measures === 'OVERALL' && d.valueM !== null)
  const horizontal = (d: (typeof overall)[number]): boolean => Math.abs(d.to.x - d.from.x) >= Math.abs(d.to.y - d.from.y)
  const frontOnSheetX = obs.front?.planEdge === 'BOTTOM' || obs.front?.planEdge === 'TOP'
  for (const d of overall) {
    const isWidth = horizontal(d) === frontOnSheetX
    const value = d.valueM as number
    const localV = isWidth ? local.widthM : local.depthM
    const mine = isWidth ? walls.widthM : walls.depthM
    findings.push({ fact: isWidth ? 'overall width' : 'overall depth', source: `printed "${d.literal}" = ${value} m`, local: fmt(localV), described: fmt(mine), localOk: near(localV, value), describedOk: near(mine, value) })
  }
  const H = published.filter((p) => p.key === 'building_height' && p.unit === 'm')
  if (H.length === 1) {
    const mine = m.heightAboveTerrainM
    const loc = local.heightAboveTerrainM ?? (local.topAboveGroundFloorM !== null ? local.topAboveGroundFloorM + 0.3 : null)
    findings.push({ fact: 'building height', source: `published ${H[0].value} m`, local: local.roofPlanes === 0 ? 'no roof built' : fmt(loc), described: fmt(mine), localOk: local.roofPlanes > 0 && loc !== null && Math.abs(loc - H[0].value) <= ARBITRATION.heightM + 0.3, describedOk: mine !== null && Math.abs(mine - H[0].value) <= ARBITRATION.heightM })
  }
  const ground = g.outlines.find((o) => o.level === 0)?.polygon
  const area = ground ? housePoly.area(ground) : undefined
  if (typeof area === 'number' && local.groundAreaM2 !== null) {
    const ok = Math.abs(local.groundAreaM2 - area) <= ARBITRATION.footprintShare * area
    findings.push({ fact: 'walled ground outline', source: `traced outline verified against the printed dimensions: ${area.toFixed(1)} m²`, local: `${local.groundAreaM2.toFixed(1)} m²`, described: `${area.toFixed(1)} m²`, localOk: ok, describedOk: true })
  }
  // the same area in the same box is not yet the same house: a body on the other side (a mirrored plan) has both
  if (ground && local.groundPolygons && local.groundPolygons.length > 0) {
    const share = outlineOverlap([ground], local.groundPolygons)
    findings.push({ fact: 'where the walled outline lies', source: 'traced outline verified against the printed dimensions', local: `${(share * 100).toFixed(0)} % of the two outlines coincide, each set against its own front-left corner`, described: 'the traced outline', localOk: share >= ARBITRATION.outlineOverlap, describedOk: true })
  }
  const localFails = findings.filter((f) => !f.localOk && f.describedOk)
  const describedFails = findings.filter((f) => !f.describedOk)
  if (describedFails.length > 0) return { accepted: 'LOCAL', why: `the built description misses a source fact: ${describedFails.map((f) => `${f.fact} ${f.described} against ${f.source}`).join('; ')}`, findings }
  if (findings.length === 0) return { accepted: 'LOCAL', why: 'no source fact both models can be held against (no overall printed dimension, no published height): LOCAL is not replaced on an unverified description', findings }
  if (localFails.length === 0) return { accepted: 'LOCAL', why: 'LOCAL meets every source fact the description meets: a correct base is kept', findings }
  return { accepted: 'DESCRIBED', why: `LOCAL contradicts the source where the description meets it: ${localFails.map((f) => `${f.fact} ${f.local} against ${f.source}`).join('; ')}`, findings }
}
