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
import type { FacadeCoverage, FacadesAnswer, InventoryAnswer, PlanAnswer, Selection } from './read.js'
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
export function documentFromReading(input: { id: string; project?: string; sourcePackageHash?: string; model: string; selection: Selection; planSent: SentPicture[]; facadesSent?: SentPicture[]; answers: ReadingAnswers; published: Published; at?: string; /** Which elevation pictures were asked about, how often, and with what result (`readFacades`). */ coverage?: FacadeCoverage[]; /** Pictures of the package that were not sent at all, with the reason. */ skipped?: Array<{ assetId: string; why: string; role?: string }> }): { document: unknown; notes: ConversionNote[] } {
  const notes: ConversionNote[] = []
  const { selection, answers } = input
  const plan = answers.plan
  const k0 = 1 / input.planSent[0].scale
  const P = (p: { x: number; y: number }): { x: number; y: number } => ({ x: r1(p.x * k0), y: r1(p.y * k0) })
  // the side the inventory named for an elevation picture (from its caption or its content): a hint, used only to tell two claims of one side apart
  const named = (n: number): { captionSide?: string } => {
    const sd = answers.inventory?.pictures.find((e) => e.n === n)?.side
    return sd === 'FRONT' || sd === 'RIGHT' || sd === 'REAR' || sd === 'LEFT' ? { captionSide: sd } : {}
  }
  const hash = (p: { byteHash: string }): { byteHash?: string } => (p.byteHash ? { byteHash: p.byteHash } : {})
  const pictures = [
    { id: selection.ground.id, assetId: selection.ground.assetId, role: 'PLAN', level: 0, widthPx: selection.ground.width, heightPx: selection.ground.height, reduction: input.planSent[0].scale, sent: 'DETAIL', ...hash(selection.ground) },
    ...selection.upperPlans.map((p, i) => ({ id: p.id, assetId: p.assetId, role: 'PLAN', level: i + 1, widthPx: p.width, heightPx: p.height, sent: 'CONTEXT', ...hash(p) })),
    ...selection.sections.map((p) => ({ id: p.id, assetId: p.assetId, role: 'SECTION', widthPx: p.width, heightPx: p.height, sent: answers.facades ? 'DETAIL' : 'THUMB_ONLY', ...hash(p) })),
    ...selection.elevations.map((p) => ({ id: p.id, assetId: p.assetId, role: 'ELEVATION', widthPx: p.width, heightPx: p.height, sent: answers.facades ? 'DETAIL' : 'THUMB_ONLY', ...hash(p), ...named(p.n) })),
    ...(selection.unsentElevations ?? []).map((p) => ({ id: p.id, assetId: p.assetId, role: 'ELEVATION', widthPx: p.width, heightPx: p.height, sent: 'THUMB_ONLY', notSentWhy: 'more elevation pictures than one reading takes: seen small in the inventory only', ...hash(p), ...named(p.n) })),
    ...selection.views.map((p) => ({ id: p.id, assetId: p.assetId, role: 'RENDER', widthPx: p.width, heightPx: p.height, sent: 'CONTEXT', ...hash(p) })),
    ...selection.notThisHouse.map((p) => ({ id: p.id, assetId: p.assetId, role: 'OTHER', widthPx: p.width, heightPx: p.height, thisHouse: false, sent: 'THUMB_ONLY', ...hash(p) })),
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
      const cov = input.coverage?.find((c) => c.pictureId === sent.picture.id)
      elevations.push({ id: `el-${sent.picture.id}`, picture: sent.picture.id, side: e.side, sideHow: e.sideHow ?? '', alternatives: (e.alternatives ?? []).filter((s) => s !== e.side), mirrored: e.mirrored === true, groundY: r1(e.groundY * k), bodies, openings, features, origin: 'API', ...(typeof e.floorY === 'number' ? { floorY: r1(e.floorY * k) } : {}), ...(typeof e.blind === 'boolean' ? { blind: e.blind } : {}), ...(e.limits === 'NONE' || e.limits === 'PARTLY_HIDDEN' || e.limits === 'TOO_SMALL' ? { limits: e.limits } : {}), ...(cov?.readIn ? { readIn: cov.readIn } : {}) })
    })
  }
  const published = input.published.filter((p) => ['building_height', 'footprint_area', 'roof_pitch', 'building_width', 'building_depth'].includes(p.key)).map((p) => ({ key: p.key, value: p.value, unit: p.unit, ...(p.raw ? { raw: p.raw } : {}) }))
  // every elevation and section picture of this house, with what became of it
  const views = [
    ...selection.elevations.map((p) => {
      const c = input.coverage?.find((x) => x.pictureId === p.id)
      const described = elevations.some((e) => (e as { picture: string }).picture === p.id)
      return { picture: p.id, role: 'ELEVATION' as const, asked: c?.asked ?? (f ? 1 : 0), answer: described ? ('DESCRIBED' as const) : !f ? ('NOT_ASKED' as const) : (c?.answer ?? ('ASKED_NOT_ANSWERED' as const)), ...(c?.why && !described ? { why: c.why } : {}) }
    }),
    ...(selection.unsentElevations ?? []).map((p) => ({ picture: p.id, role: 'ELEVATION' as const, asked: 0, answer: 'NOT_SENT' as const, why: 'more elevation pictures than one reading takes' })),
    ...selection.sections.map((p) => ({ picture: p.id, role: 'SECTION' as const, asked: f ? 1 : 0, answer: f ? (levels.some((l) => (l as { picture: string }).picture === p.id) ? ('DESCRIBED' as const) : ('ASKED_NOT_ANSWERED' as const)) : ('NOT_ASKED' as const) })),
  ]
  const missing = [
    ...(input.skipped ?? []).filter((x) => x.role === 'ELEVATION' || x.role === 'SECTION').map((x) => ({ what: `${x.role?.toLowerCase()} picture ${x.assetId.slice(-40)}: ${x.why}`, status: 'NOT_READABLE' as const })),
    ...(selection.sections.length === 0 ? [{ what: 'a section', status: 'NOT_PUBLISHED' as const }] : []),
    ...(selection.elevations.length === 0 ? [{ what: 'elevations', status: 'NOT_PUBLISHED' as const }] : []),
    ...(!f ? [{ what: 'the section and the elevations were not read', status: 'NOT_SENT' as const }] : []),
  ]
  const document = {
    schema: HOUSE_DOCUMENT_SCHEMA,
    schemaVersion: HOUSE_DOCUMENT_VERSION,
    id: input.id,
    origin: 'API_SOURCE_DESCRIPTION',
    source: { ...(input.sourcePackageHash ? { sourcePackageHash: input.sourcePackageHash } : {}), ...(input.project ? { project: input.project } : {}), pictures, missing, views },
    reader: { engine: `${HOUSE_READING_CONTRACT}@${HOUSE_READING_VERSION}`, model: input.model, ...(input.at ? { at: input.at } : {}) },
    observations: { front: { planEdge: plan.front?.planEdge, how: plan.front?.how ?? '', origin: 'API' }, dimensions, levels, outlines, elevations, roofs, published, unknowns: [...(plan.unknowns ?? []), ...(f?.unknowns ?? [])].slice(0, 16) },
  }
  return { document, notes }
}

/**
 * What the plan says the facades must show, as text for the facade reading (v3.54.5): each body's box in metres, and
 * for each side of the house the bodies a viewer outside has in front, in the order and at the places they are seen.
 * It is the plan's own geometry, given so that an elevation is matched to its side by what stands on it — two gable
 * ends of one house differ only by that.
 */
export function planFactsForFacades(g: NonNullable<HouseDocument['geometry']>): string {
  const xs = g.bodies.flatMap((b) => b.outline.map((p) => p.x))
  const zs = g.bodies.flatMap((b) => b.outline.map((p) => p.z))
  const X0 = Math.min(...xs)
  const X1 = Math.max(...xs)
  const Z0 = Math.min(...zs)
  const Z1 = Math.max(...zs)
  const boxes = g.bodies.map((b) => `${b.id}: x ${Math.min(...b.outline.map((p) => p.x)).toFixed(1)}–${Math.max(...b.outline.map((p) => p.x)).toFixed(1)}, z ${Math.min(...b.outline.map((p) => p.z)).toFixed(1)}–${Math.max(...b.outline.map((p) => p.z)).toFixed(1)}`).join('; ')
  const sideText = (side: 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'): string => {
    const span = side === 'FRONT' || side === 'REAR' ? X1 - X0 : Z1 - Z0
    const along = (p: { x: number; z: number }): number => (side === 'FRONT' ? p.x - X0 : side === 'REAR' ? X1 - p.x : side === 'LEFT' ? Z1 - p.z : p.z - Z0)
    const depth = (p: { x: number; z: number }): number => (side === 'FRONT' ? p.z - Z0 : side === 'REAR' ? Z1 - p.z : side === 'LEFT' ? p.x - X0 : X1 - p.x)
    const N = 60
    const runs: Array<{ id: string; from: number; to: number; back: number }> = []
    for (let k = 0; k < N; k += 1) {
      const a = ((k + 0.5) / N) * span
      let pick: { id: string; d: number } | undefined
      for (const b of g.bodies) {
        for (let j = 0; j < b.outline.length; j += 1) {
          const p = b.outline[j]
          const q = b.outline[(j + 1) % b.outline.length]
          const ap = along(p)
          const aq = along(q)
          if (Math.min(ap, aq) > a || Math.max(ap, aq) < a || Math.abs(ap - aq) < 1e-9) continue
          const t = (a - ap) / (aq - ap)
          const d = depth({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
          if (!pick || d < pick.d - 1e-6) pick = { id: b.id, d }
        }
      }
      if (!pick) continue
      const last = runs[runs.length - 1]
      if (last && last.id === pick.id && Math.abs(last.back - pick.d) < 0.3) last.to = a + span / (2 * N)
      else runs.push({ id: pick.id, from: a - span / (2 * N), to: a + span / (2 * N), back: pick.d })
    }
    return runs.filter((r) => r.to - r.from >= 0.4).map((r) => `${r.id} ${r.from.toFixed(1)}–${r.to.toFixed(1)} m${r.back > 0.3 ? ` (set back ${r.back.toFixed(1)} m)` : ''}`).join(', ')
  }
  return `On the plan, in metres (x from the building's left end seen from the front, z from the front back): ${boxes}.
What each side shows, by the plan (the wall nearest the viewer, left to right as that viewer sees it, measured along that side): FRONT: ${sideText('FRONT')}. RIGHT (the front corner is at the picture's left): ${sideText('RIGHT')}. REAR (the plan's right end is at the picture's left): ${sideText('REAR')}. LEFT (the rear corner is at the picture's left): ${sideText('LEFT')}. Name an elevation's side by which of these it shows; a side whose front body is missing from the picture is not that side.`
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
  for (const r of built.kernelRefusals) {
    // an opening whose head stands above the top of its wall belongs to a dormer or a gable that was not built: a dependency, not a clash
    const above = r.codes.includes('OPENING_ABOVE_WALL_TOP')
    doc.verification.held.push({ ref: r.id ?? r.type, code: above ? 'HELD_BY_DEPENDENCY' : 'COMPILE_CONFLICT', why: `${above ? 'it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — ' : ''}${r.codes.join(',')}: ${r.message.slice(0, 200)}` })
  }
  for (const a of built.approximated) doc.verification.knownDefects.push({ code: 'OPENING_APPROXIMATED', what: `${a.id}: ${a.what}` })
  for (const e of compileErrors) doc.verification.held.push({ ref: e.objectId ?? e.code, code: e.code === 'OPENING_ABOVE_WALL_TOP' ? 'HELD_BY_DEPENDENCY' : 'COMPILE_CONFLICT', why: `${e.code === 'OPENING_ABOVE_WALL_TOP' ? 'it stands above the top of its wall: the dormer or gable it belongs to was not read or is not built — ' : ''}${e.code}: ${e.message}` })
  accountForBuild(doc, built, measured)
  const modelHash = createHash('sha256').update(modelJson).digest('hex')
  doc.verification.modelHash = modelHash
  return { document: doc, built, bundle, modelJson, modelHash, measured, compileErrors, failed }
}

/**
 * v3.54.5 — after the build: each agreed opening against the hole the compiled scene holds, each side of the house
 * against what was read on it, and five separate statuses. A number in the document is not a hole in a wall; this is
 * where the two are compared.
 */
function accountForBuild(doc: HouseDocument, built: BuiltHouse, measured: SceneMeasure): void {
  const g = doc.geometry
  const v = doc.verification
  if (!g) return
  const cutIds = new Set(built.fitted.map((c) => (c as unknown as { id?: string }).id).filter((x): x is string => typeof x === 'string'))
  const has = (id: string): boolean => cutIds.has(id) || [...cutIds].some((x) => x.startsWith(`${id}-`))
  const builtOf = (path: string): { built?: number | null; fit?: string; why?: string } | undefined => v.parameters.find((q) => q.path === path)
  const sideOfWall = new Map<string, 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'>()
  for (const view of v.views) for (const w of view.walls) sideOfWall.set(w, view.side)
  let mismatched = 0
  let cut = 0
  v.openings = g.openings.map((o) => {
    const agreed = { offsetM: o.offsetM.value ?? 0, widthM: o.widthM.value ?? 0, heightM: o.heightM.value ?? 0, sillM: o.sillM.value ?? 0 }
    const hole = measured.openings.find((x) => x.id === o.id)
    const base = { id: o.id, ...(o.refs[0] ? { ref: o.refs[0] } : {}), ...(hole?.side ? { side: hole.side } : sideOfWall.get(o.hostWall) ? { side: sideOfWall.get(o.hostWall) } : {}), hostWall: o.hostWall, level: o.level, kind: o.kind, agreed }
    if (!cutIds.has(o.id) || !hole) {
      const why = v.held.find((h) => h.ref === o.id || h.ref === `geometry.openings[${o.id}]`)?.why
      return { ...base, built: null, cut: null, fit: 'NOT_BUILT' as const, ...(why ? { why: why.slice(0, 300) } : {}) }
    }
    const off = builtOf(`geometry.openings[${o.id}].offsetM`)
    const wid = builtOf(`geometry.openings[${o.id}].widthM`)
    const b = { offsetM: off?.built ?? agreed.offsetM, widthM: wid?.built ?? agreed.widthM, heightM: agreed.heightM, sillM: agreed.sillM }
    cut += 1
    if (Math.abs(hole.widthM - b.widthM) > 0.02 || Math.abs(hole.heightM - b.heightM) > 0.02) mismatched += 1
    const fit = (wid?.fit === 'APPROXIMATED' || off?.fit === 'APPROXIMATED' ? 'APPROXIMATED' : wid?.fit === 'ADJUSTED' || off?.fit === 'ADJUSTED' ? 'ADJUSTED' : 'EXACT') as 'EXACT' | 'ADJUSTED' | 'APPROXIMATED'
    const why = wid?.why ?? off?.why
    return { ...base, built: b, cut: { widthM: hole.widthM, heightM: hole.heightM, bottomY: hole.bottomY, alongSideM: hole.alongM }, fit, ...(why ? { why: why.slice(0, 300) } : {}) }
  })
  v.checks.push({ id: 'openings-cut', scope: 'COMPILE', what: 'each opening the program cut is a hole of that size in the compiled scene', expected: 'width and height of the hole within 2 cm of what was cut', measured: `${cut - mismatched} of ${cut} holes agree; ${g.openings.length - cut} agreed opening(s) were not cut`, status: cut === 0 ? 'NOT_CHECKED' : mismatched === 0 ? 'PASS' : 'FAIL', blocks: mismatched === 0 ? [] : ['quantities'] })
  for (const view of v.views) {
    if (!view.elevation) {
      view.build = 'NOT_BUILT'
      continue
    }
    const mine = (refs: string[]): boolean => refs.some((x) => x.startsWith(`${view.elevation}/`))
    const openings = v.openings.filter((x) => x.ref?.startsWith(`${view.elevation}/`))
    const lights = g.rooflights.filter((x) => mine(x.refs))
    const features = [...g.dormers, ...g.balconies, ...g.canopies, ...g.chimneys].filter((x) => mine(x.refs))
    view.built = { openings: openings.filter((x) => x.fit !== 'NOT_BUILT').length + lights.filter((x) => has(x.id)).length, features: features.filter((x) => has(x.id)).length }
    view.notBuilt = [...new Set([...v.held.filter((h) => h.ref.startsWith(`${view.elevation}/`)).map((h) => `${h.ref} (${h.code})`), ...openings.filter((x) => x.fit === 'NOT_BUILT').map((x) => `${x.id} (not cut)`), ...lights.filter((x) => !has(x.id)).map((x) => `${x.id} (not cut)`), ...features.filter((x) => !has(x.id)).map((x) => `${x.id} (not built)`)])].slice(0, 40)
    const read = view.read.openings + view.read.features
    view.build = !view.registered ? 'NOT_BUILT' : read === 0 ? 'NOTHING_TO_BUILD' : view.built.openings + view.built.features >= read && view.notBuilt.length === 0 ? 'BUILT_COMPLETE' : view.built.openings + view.built.features > 0 ? 'BUILT_PARTIAL' : 'NOT_BUILT'
  }
  const withSource = v.views.filter((x) => x.state !== 'NO_SOURCE')
  const read = withSource.filter((x) => x.state === 'READ_COMPLETE')
  const sources = withSource.length > 0 && read.length === withSource.length ? 'READ_COMPLETE' : read.length > 0 || withSource.some((x) => x.state === 'PARTIAL') ? 'READ_PARTIAL' : 'NOT_READ'
  const toBuild = v.views.filter((x) => x.read.openings + x.read.features > 0)
  const geometry = toBuild.length > 0 && toBuild.every((x) => x.build === 'BUILT_COMPLETE') && built.complete ? 'BUILT_COMPLETE' : toBuild.some((x) => x.build === 'BUILT_COMPLETE' || x.build === 'BUILT_PARTIAL') || measured.exteriorWalls ? 'BUILT_PARTIAL' : 'NOT_BUILT'
  const missing = [
    ...v.views.filter((x) => x.state !== 'READ_COMPLETE').map((x) => `${x.side}: ${x.state}${x.why ? ` — ${x.why}` : ''}`),
    ...v.views.filter((x) => x.state === 'READ_COMPLETE' && x.build !== 'BUILT_COMPLETE' && x.build !== 'NOTHING_TO_BUILD').map((x) => `${x.side}: read, ${x.build}: ${x.built.openings + x.built.features} of ${x.read.openings + x.read.features} built${x.notBuilt.length ? ` (not built: ${x.notBuilt.slice(0, 6).join(', ')})` : ''}`),
  ]
  v.status = {
    computation: built.complete ? 'DONE' : 'PARTIAL',
    sources,
    geometry,
    exterior: sources === 'READ_COMPLETE' && withSource.length === 4 && geometry === 'BUILT_COMPLETE' && v.knownDefects.length === 0 && !v.checks.some((c) => c.status === 'FAIL') ? 'COMPLETE_IN_SCOPE' : 'PARTIAL',
    missing: missing.slice(0, 24),
  }
  // a side that was not read or not built limits what may be measured off the model on that side
  if (v.quantities === 'USABLE_IN_SCOPE' && (sources !== 'READ_COMPLETE' || geometry !== 'BUILT_COMPLETE')) v.quantities = 'LIMITED'
}

// ---------------------------------------------------------------------------------------------------------------------
// the decision between the described house and LOCAL's
// ---------------------------------------------------------------------------------------------------------------------

export const ARBITRATION = { extentShare: 0.04, extentM: 0.35, heightM: 0.45, footprintShare: 0.12, outlineOverlap: 0.85, levelM: 0.35 } as const
export type LocalMeasure = {
  widthM: number
  depthM: number
  heightAboveTerrainM: number | null
  topAboveGroundFloorM: number | null
  groundAreaM2: number | null
  roofPlanes: number
  /** The ground slab outline(s), in LOCAL's own frame (x right seen from the front, z back). */
  groundPolygons?: Array<Array<{ x: number; z: number }>>
  /** v3.54.5: the floor levels LOCAL built, above ±0,00, and what of an interior it holds (rooms, interior walls). */
  levelElevations?: number[]
  rooms?: number
  interiorWalls?: number
}

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
export type ArbitrationCode =
  | 'DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS'
  | 'LOCAL_MEETS_SOURCE'
  | 'NO_COMMON_FACT_LOCAL_KEPT'
  | 'DESCRIBED_ONLY'
  | 'DESCRIBED_REJECTED_LOCAL_KEPT'
  | 'DESCRIBED_REJECTED_LOCAL_CONTRADICTS'
  | 'BOTH_CONTRADICT'
  | 'NO_MODEL'
export type Arbitration = {
  accepted: 'DESCRIBED' | 'LOCAL' | 'NONE'
  why: string
  findings: ArbitrationFinding[]
  /** v3.54.5. Why, as a code; whether the accepted model is known to contradict a source fact (then it is a partial preview, not a correct house). */
  code: ArbitrationCode
  partial: boolean
  /** Source facts the ACCEPTED model contradicts, and things about the house that no fact here settles. */
  contradictions: string[]
  unknown: string[]
  /** What happens to an interior LOCAL had when the described exterior stands. */
  interior: string
}

/**
 * The ridge mark of the section as a source fact (v3.54.5). A level mark is taken for the height of the roof only when
 * something other than the mark itself says so: the same mark on a second section, a registered elevation that shows
 * the ridge at that height at the plan's scale, a printed total height that agrees with it over the terrain, or the
 * roof the printed pitch makes over the plan's span. A mark with none of these is a number, not a fact — whoever read it.
 */
export function supportedRidge(doc: HouseDocument): { valueM: number; literal: string; support: string[] } | undefined {
  const g = doc.geometry
  const main = g?.bodies.find((b) => b.role === 'MAIN') ?? g?.bodies[0]
  if (!g || !main || main.roof.ridgeY.basis !== 'PRINTED' || main.roof.ridgeY.value === null) return undefined
  const value = main.roof.ridgeY.value
  const marks = doc.observations.levels.filter((l) => l.meaning === 'RIDGE' && l.valueM !== null && Math.abs((l.valueM as number) - value) <= 0.011)
  if (marks.length === 0) return undefined
  const support: string[] = []
  const pics = new Set(marks.map((m) => m.picture))
  if (pics.size >= 2) support.push(`printed on ${pics.size} pictures`)
  const seen = doc.verification.checks.filter((c) => c.id.startsWith('elevation-') && c.status === 'PASS' && c.measured.includes('the section prints'))
  if (seen.length > 0) support.push(`${seen.length} registered elevation(s) show the ridge at that height at the plan's scale`)
  const total = doc.verification.checks.find((c) => c.id === 'height-printed')
  if (total?.status === 'PASS') support.push(`the total height printed on the section agrees (${total.expected})`)
  const roof = doc.verification.checks.find((c) => c.id === 'ridge-roof')
  if (roof?.status === 'PASS') support.push('the printed pitch over the plan\'s span makes a roof of that height')
  if (roof?.status === 'FAIL') return undefined
  return support.length > 0 ? { valueM: value, literal: marks[0].literal, support } : undefined
}

/**
 * Which house stands (v3.54.5). Both candidates are held against the same source facts, each a fact with its own
 * support: printed overall dimensions verified on the traced outline; the published building height (above the
 * terrain); the section's ridge mark (above ±0,00 — a different quantity, compared separately); a printed upper floor
 * level; the area and the place of the walled outline. The described house must first pass its own blocking checks.
 *
 *   - LOCAL meets every fact → LOCAL stays: a correct base is not replaced by a second opinion.
 *   - LOCAL contradicts a fact the described house meets, and the described house contradicts none → DESCRIBED.
 *   - both contradict a fact, or the description is rejected while LOCAL contradicts one → the one with fewer
 *     contradictions stands as a PARTIAL preview and its contradictions are named: an old contradiction does not
 *     become correct because the alternative was refused.
 * What neither can be held against (an unbuilt dormer, a held opening) is `unknown`: it limits the model, it does not
 * choose one.
 */
export function arbitrate(described: CompiledHouse, local: LocalMeasure | undefined, published: Published): Arbitration {
  const findings: ArbitrationFinding[] = []
  const g = described.document.geometry
  const m = described.measured
  const interiorOf = (accepted: Arbitration['accepted']): string => {
    const rooms = local?.rooms ?? 0
    const walls = local?.interiorWalls ?? 0
    if (accepted !== 'DESCRIBED') return accepted === 'LOCAL' ? 'LOCAL stands with whatever interior it has: nothing is removed' : 'no model stands'
    if (!local) return 'there was no LOCAL model: no interior existed to carry over'
    return rooms + walls === 0 ? 'LOCAL held no rooms or interior walls: nothing of an interior is lost' : `LOCAL held ${rooms} room(s) and ${walls} interior wall(s); the described house is an exterior and they are NOT carried into it (their fit to the new outline is not checked) — LOCAL's model is kept beside the result as the superseded revision`
  }
  const out = (accepted: Arbitration['accepted'], code: ArbitrationCode, why: string, partial = false, contradictions: string[] = [], unknown: string[] = []): Arbitration => ({ accepted, code, why, findings, partial, contradictions, unknown, interior: interiorOf(accepted) })
  const H = published.filter((p) => p.key === 'building_height' && p.unit === 'm')
  const fmt = (v: number | null): string => (v === null ? 'not built' : `${v.toFixed(2)} m`)
  // --- the facts LOCAL can be held against even when the description gives no geometry: what the PAGE states -----------
  const localAlone: string[] = []
  if (local && H.length === 1) {
    const loc = local.heightAboveTerrainM ?? (local.topAboveGroundFloorM !== null ? local.topAboveGroundFloorM + 0.3 : null)
    if (local.roofPlanes === 0 || loc === null || Math.abs(loc - H[0].value) > ARBITRATION.heightM + 0.3) localAlone.push(`building height ${local.roofPlanes === 0 ? 'no roof built' : fmt(loc)} against published ${H[0].value} m`)
  }
  const rejectedWhy = described.rejected
    ? `the description was rejected by the document schema: ${described.rejected.slice(0, 2).join('; ')}`
    : !g || !m || !m.exteriorWalls || !described.built
      ? `the description did not resolve to a geometry${described.failed.length ? `: ${described.failed.map((f) => f.what).join('; ').slice(0, 300)}` : ''}`
      : described.failed.length > 0
        ? `the description fails its own source checks: ${described.failed.map((f) => `${f.what} (${f.measured})`).join('; ').slice(0, 400)}`
        : undefined
  if (rejectedWhy) {
    if (!local) return out('NONE', 'NO_MODEL', rejectedWhy)
    // the refusal of the description is not a verdict on LOCAL: what LOCAL contradicts on the page is still said
    return localAlone.length > 0 ? out('LOCAL', 'DESCRIBED_REJECTED_LOCAL_CONTRADICTS', `${rejectedWhy}; LOCAL is the only model and it contradicts the source: ${localAlone.join('; ')} — shown as a partial preview, not as a correct house`, true, localAlone) : out('LOCAL', 'DESCRIBED_REJECTED_LOCAL_KEPT', rejectedWhy)
  }
  if (!g || !m || !m.exteriorWalls) return out(local ? 'LOCAL' : 'NONE', local ? 'DESCRIBED_REJECTED_LOCAL_KEPT' : 'NO_MODEL', 'the description gave no measured scene')
  const unknown = [...new Set(described.document.verification.held.map((h) => h.code))].map((c) => `${described.document.verification.held.filter((h) => h.code === c).length} item(s) read and not built (${c})`)
  if (!local) return out('DESCRIBED', 'DESCRIBED_ONLY', 'the description passes its source checks and there is no LOCAL model', false, [], unknown)
  const walls = m.exteriorWalls
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(ARBITRATION.extentM, ARBITRATION.extentShare * b)
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
  if (H.length === 1) {
    const mine = m.heightAboveTerrainM
    const loc = local.heightAboveTerrainM ?? (local.topAboveGroundFloorM !== null ? local.topAboveGroundFloorM + 0.3 : null)
    findings.push({ fact: 'building height above the terrain', source: `published ${H[0].value} m`, local: local.roofPlanes === 0 ? 'no roof built' : fmt(loc), described: fmt(mine), localOk: local.roofPlanes > 0 && loc !== null && Math.abs(loc - H[0].value) <= ARBITRATION.heightM + 0.3, describedOk: mine !== null && Math.abs(mine - H[0].value) <= ARBITRATION.heightM })
  }
  // the ridge above ±0,00, from the section: a fact of its own, with or without a height on the page
  const ridge = supportedRidge(described.document)
  if (ridge) {
    const mine = m.roofTopByBody[(g.bodies.find((b) => b.role === 'MAIN') ?? g.bodies[0]).id] ?? m.roofTopY
    const loc = local.topAboveGroundFloorM
    findings.push({ fact: 'top of the roof above ±0,00', source: `section mark "${ridge.literal}" = ${ridge.valueM} m (${ridge.support.join('; ')})`, local: local.roofPlanes === 0 ? 'no roof built' : fmt(loc), described: fmt(mine), localOk: local.roofPlanes > 0 && loc !== null && Math.abs(loc - ridge.valueM) <= ARBITRATION.heightM, describedOk: mine !== null && Math.abs(mine - ridge.valueM) <= ARBITRATION.heightM })
  }
  // a printed floor level of a storey whose plan is published
  const upperPlans = described.document.source.pictures.filter((p) => p.role === 'PLAN' && (p.level ?? 0) >= 1 && p.thisHouse !== false).length
  if (upperPlans > 0 && local.levelElevations) {
    for (const l of g.levels.filter((x) => x.index >= 1 && x.elevation.basis === 'PRINTED' && x.elevation.value !== null)) {
      const value = l.elevation.value as number
      const nearest = local.levelElevations.filter((e) => e > 0.5).sort((p, q) => Math.abs(p - value) - Math.abs(q - value))[0]
      findings.push({ fact: `floor level of storey ${l.index} above ±0,00`, source: `${l.elevation.how ?? 'a printed floor mark'} = ${value} m; a plan of that storey is published`, local: nearest === undefined ? 'no storey above the ground built' : fmt(nearest), described: fmt(value), localOk: nearest !== undefined && Math.abs(nearest - value) <= ARBITRATION.levelM, describedOk: true })
    }
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
  const say = (f: ArbitrationFinding, who: 'local' | 'described'): string => `${f.fact} ${f[who]} against ${f.source}`
  const localBad = findings.filter((f) => !f.localOk)
  const describedBad = findings.filter((f) => !f.describedOk)
  if (findings.length === 0) return out('LOCAL', 'NO_COMMON_FACT_LOCAL_KEPT', 'no source fact both models can be held against (no overall printed dimension, no published height, no supported section mark): LOCAL is not replaced on an unverified description — and is not thereby verified', false, [], ['no common source fact: neither model is checked against the source here', ...unknown])
  if (localBad.length === 0) return out('LOCAL', 'LOCAL_MEETS_SOURCE', 'LOCAL meets every source fact the description meets: a correct base is kept', false, [], unknown)
  if (describedBad.length === 0) return out('DESCRIBED', 'DESCRIBED_MEETS_SOURCE_LOCAL_CONTRADICTS', `LOCAL contradicts the source where the description meets it: ${localBad.map((f) => say(f, 'local')).join('; ')}`, false, [], unknown)
  // both contradict the source: neither is a correct house. The one with fewer contradictions is shown, as a partial preview.
  const takeDescribed = describedBad.length < localBad.length
  const bad = takeDescribed ? describedBad.map((f) => say(f, 'described')) : localBad.map((f) => say(f, 'local'))
  return out(takeDescribed ? 'DESCRIBED' : 'LOCAL', 'BOTH_CONTRADICT', `both models contradict the source (LOCAL: ${localBad.map((f) => say(f, 'local')).join('; ')} | described: ${describedBad.map((f) => say(f, 'described')).join('; ')}); the one with fewer contradictions is shown as a partial preview, not as a correct house`, true, bad, unknown)
}
