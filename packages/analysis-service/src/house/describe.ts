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
import { HOUSE_DOCUMENT_SCHEMA, HOUSE_DOCUMENT_VERSION, heightAgainstFigure, housePoly, parseHouseDocument, resolveHouse } from '@buildapp/reconstruction'
import type { HouseDocument } from '@buildapp/reconstruction'
import { buildHouse, headCapFor } from './build.js'
import type { BuiltHouse, HeadCap } from './build.js'
import { measureScene } from './measure.js'
import type { SceneMeasure, SceneOpening, SideFeatures } from './measure.js'
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
export function documentFromReading(input: { id: string; project?: string; sourcePackageHash?: string; model: string; selection: Selection; planSent: SentPicture[]; facadesSent?: SentPicture[]; answers: ReadingAnswers; published: Published; at?: string; /** Which elevation pictures were asked about, how often, and with what result (`readFacades`). */ coverage?: FacadeCoverage[]; /** Pictures of the package that were not sent at all, with the reason. */ skipped?: Array<{ assetId: string; why: string; role?: string; code?: string }> }): { document: unknown; notes: ConversionNote[] } {
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
        return [{ id, kind: x.kind, box: B(x.box), ...(bodyOf(x.bodyId) ? { bodyId: bodyOf(x.bodyId) } : {}), ...(typeof x.eavesY === 'number' ? { eavesY: r1(x.eavesY * k) } : {}), ...(typeof x.apexY === 'number' ? { apexY: r1(x.apexY * k) } : {}), ...(typeof x.bandPx === 'number' && x.bandPx > 0 ? { bandPx: r1(x.bandPx * k) } : {}), ...(typeof x.legPx === 'number' && x.legPx > 0 ? { legPx: r1(x.legPx * k) } : {}), ...(typeof x.legBottomY === 'number' ? { legBottomY: r1(x.legBottomY * k) } : {}), ...(typeof x.posts === 'boolean' ? { posts: x.posts } : {}), ...(x.note ? { note: x.note } : {}) }]
      })
      const bodies = (e.bodies ?? []).flatMap((b) => {
        const eb = bodyOf(b.bodyId)
        if (!eb) {
          notes.push({ code: 'WRONG_BINDING', ref: `elevation ${i + 1} body ${b.bodyId}`, why: 'no such body on the plan' })
          return []
        }
        return [{ bodyId: eb, leftX: r1(Math.min(b.leftX, b.rightX) * k), rightX: r1(Math.max(b.leftX, b.rightX) * k), eavesY: typeof b.eavesY === 'number' ? r1(b.eavesY * k) : null, ridgeY: typeof b.ridgeY === 'number' ? r1(b.ridgeY * k) : null }]
      })
      const openings = (e.openings ?? []).map((x, j) => ({ id: `o${j + 1}`, kind: x.kind, box: B(x.box), ...(bodyOf(x.bodyId) ? { bodyId: bodyOf(x.bodyId) } : {}), ...(typeof x.level === 'number' ? { level: x.level } : {}), ...(x.inFeature && featureIds.has(x.inFeature.toLowerCase()) ? { inFeature: x.inFeature.toLowerCase() } : {}), ...(typeof x.headLeftY === 'number' && typeof x.headRightY === 'number' ? { headLeftY: r1(x.headLeftY * k), headRightY: r1(x.headRightY * k) } : {}), ...(typeof x.apexX === 'number' ? { apexX: r1(x.apexX * k) } : {}) }))
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
    // v3.54.6: a drawing the page names that the picture limit left out was NOT SENT, not unpublished; pictures of unknown
    // role the limit left out are counted, so that a side without a source says how far it was looked for
    ...(input.skipped ?? []).filter((x) => (x.role === 'ELEVATION' || x.role === 'SECTION') && x.code !== 'SAME_PICTURE').map((x) => ({ what: `${x.role?.toLowerCase()} picture ${x.assetId.slice(-40)}: ${x.why}`, status: x.code === 'LIMIT' ? ('NOT_SENT' as const) : ('NOT_READABLE' as const) })),
    ...((n) => (n > 0 ? [{ what: `${n} picture(s) of unresolved role not sent: more than the reading takes — whether one of them shows a side is not known`, status: 'NOT_SENT' as const }] : []))((input.skipped ?? []).filter((x) => x.code === 'LIMIT' && x.role !== 'ELEVATION' && x.role !== 'SECTION' && x.role !== 'FLOOR_PLAN').length),
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
  const errorsOf = (sc: ReturnType<typeof compileBuilding>): CompiledHouse['compileErrors'] => sc.diagnostics.filter((d) => d.severity === 'ERROR').map((d) => ({ code: d.code, ...((d as { objectId?: string }).objectId ? { objectId: (d as { objectId?: string }).objectId } : {}), message: String((d as { message?: string }).message ?? '').slice(0, 240) }))
  let built = buildHouse(doc, modelId)
  let modelJson = serializeModel(built.model)
  let scene = compileBuilding(parseModel(modelJson) as never)
  let compileErrors = errorsOf(scene)
  // v3.54.6: a head above its wall's top, measured by the compiler, is lowered to it once — within the opening rule — and
  // the house built and compiled again; what the rule does not allow stays out, with the measure that says why
  const caps = new Map<string, HeadCap>()
  const capWhy = new Map<string, string>()
  for (const e of compileErrors) {
    if (e.code !== 'OPENING_ABOVE_WALL_TOP' || !e.objectId) continue
    const cmd = built.fitted.find((c) => (c as unknown as { type: string; id?: string }).type === 'cutOpening' && (c as unknown as { id?: string }).id === e.objectId) as unknown as { sill: number; height: number; head?: { kind: string } } | undefined
    const r = cmd ? headCapFor(cmd, e.message) : undefined
    if (r?.ok) caps.set(e.objectId, r.cap)
    else if (r) capWhy.set(e.objectId, r.why)
  }
  if (caps.size > 0) {
    built = buildHouse(doc, modelId, caps)
    modelJson = serializeModel(built.model)
    scene = compileBuilding(parseModel(modelJson) as never)
    compileErrors = errorsOf(scene)
  }
  for (const e of compileErrors) if (e.objectId && capWhy.has(e.objectId)) e.message = `${e.message} — ${capWhy.get(e.objectId)}`.slice(0, 600)
  const bundle = buildMobileSceneBundle(built.model, { scene })
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
      // v3.54.6: an opening dropped with the wall it was cut in says so — the kernel's refusal of its host is its reason
      const host = built.kernelRefusals.find((r) => r.dropped.includes(o.id))
      const why = v.held.find((h) => h.ref === o.id || h.ref === `geometry.openings[${o.id}]`)?.why ?? (host ? `its host wall ${host.id} was refused by the kernel (${host.codes.join(', ')}): ${host.message.slice(0, 160)} — the opening went with it` : undefined)
      return { ...base, built: null, cut: null, fit: 'NOT_BUILT' as const, ...(why ? { why: why.slice(0, 300) } : {}) }
    }
    const off = builtOf(`geometry.openings[${o.id}].offsetM`)
    const wid = builtOf(`geometry.openings[${o.id}].widthM`)
    const hei = builtOf(`geometry.openings[${o.id}].heightM`)
    const b = { offsetM: off?.built ?? agreed.offsetM, widthM: wid?.built ?? agreed.widthM, heightM: hei?.fit ? (hei.built ?? agreed.heightM) : agreed.heightM, sillM: agreed.sillM }
    cut += 1
    // v3.54.7: a raked head's hole is as tall as its taller end; a pointed one as its apex (both measured from the sill)
    // (what was CUT: a pointed head is two raked halves beside a mullion, whose tops stop short of the apex)
    const cuts = built.fitted.filter((c) => (c as { type?: string }).type === 'cutOpening' && ((c as { id?: string }).id === o.id || (c as { id?: string }).id === `${o.id}--b`)) as unknown as Array<{ height: number; head?: { kind: string; heightFar?: number } }>
    const tall = o.head && cuts.length > 0 ? Math.max(...cuts.map((c) => Math.max(c.height, c.head?.heightFar ?? c.height))) : b.heightM
    if (Math.abs(hole.widthM - b.widthM) > 0.02 || Math.abs(hole.heightM - tall) > 0.02) mismatched += 1
    const fits = [wid?.fit, off?.fit, hei?.fit]
    const fit = (fits.includes('APPROXIMATED') ? 'APPROXIMATED' : fits.includes('ADJUSTED') ? 'ADJUSTED' : 'EXACT') as 'EXACT' | 'ADJUSTED' | 'APPROXIMATED'
    const why = [wid?.why, off?.why, hei?.fit ? hei.why : undefined].filter(Boolean).join('; ') || undefined
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

export const ARBITRATION = {
  extentShare: 0.04,
  extentM: 0.35,
  heightM: 0.45,
  footprintShare: 0.12,
  outlineOverlap: 0.85,
  levelM: 0.35,
  /**
   * v3.54.6 — the openings a registered elevation shows, held against each model's holes on that side: a hole is that
   * opening when its middle lies within `openingAlongM` (or a quarter of its width) along the side; a side is met when
   * `openingMatchShare` of what the elevation shows is there and no more than `openingFalseShare` of it (and at least one)
   * is extra.
   */
  openingAlongM: 0.5,
  openingMatchShare: 0.7,
  openingFalseShare: 0.3,
} as const

/** v3.54.6 — what one registered elevation shows, against one model's holes on that side. */
export function openingsAgainstElevation(read: Array<{ a0: number; a1: number }>, holes: ReadonlyArray<SceneOpening>): { matched: number; extra: number; ok: boolean } {
  const free = holes.filter((h) => h.alongM !== null).map((h) => ({ c: (h.alongM as number) + h.widthM / 2, w: h.widthM, used: false }))
  let matched = 0
  for (const r of [...read].sort((p, q) => p.a0 - q.a0)) {
    const c = (r.a0 + r.a1) / 2
    const tol = Math.max(ARBITRATION.openingAlongM, 0.25 * (r.a1 - r.a0))
    const best = free.filter((h) => !h.used && Math.abs(h.c - c) <= tol).sort((p, q) => Math.abs(p.c - c) - Math.abs(q.c - c))[0]
    if (best) {
      best.used = true
      matched += 1
    }
  }
  const extra = free.filter((h) => !h.used).length
  return { matched, extra, ok: matched >= Math.ceil(ARBITRATION.openingMatchShare * read.length) && extra <= Math.max(1, Math.floor(ARBITRATION.openingFalseShare * read.length)) }
}
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
  /** v3.54.6: LOCAL's holes by side, measured by the same ruler as the described house's. */
  openings?: SceneOpening[]
  /** v3.54.7: LOCAL's characteristic features by side, by the same ruler (`sideFeatures`). */
  sides?: SideFeatures[]
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
export type ArbitrationFinding = { fact: string; source: string; local: string; described: string; localOk: boolean; describedOk: boolean; /** v3.54.7: the side of a characteristic feature (D41). */ featureSide?: string }
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
  /**
   * v3.54.6 — the check made on the revision actually handed back (D38): its model hash against the one the decision
   * measured, and its extents and top measured again on it. Set by the link, not by `arbitrate`.
   */
  delivered?: { which: 'DESCRIBED' | 'LOCAL'; modelHash: string; measuredModelHash: string; same: boolean; widthM: number | null; depthM: number | null; topM: number | null }
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
  /** v3.54.7 (D40/D41): the quality of what was delivered — its characteristic features per side, and the review's defects still open. */
  quality?: DeliveredQuality
}
export type DeliveredQuality = {
  status: 'FEATURES_CHECKED' | 'FEATURES_PARTIAL' | 'FEATURES_NOT_CHECKED'
  why: string
  sides: Array<{ side: string; met: string[]; failing: string[]; openDefects: string[] }>
  notAssessable: string[]
}

/**
 * v3.54.7 — the quality status of the delivered model: every characteristic feature the source shows met by the model
 * handed back, and no KEY or MAJOR defect of the review left open on it, is FEATURES_CHECKED; a feature failing or a
 * defect open is FEATURES_PARTIAL and names them; no feature to check is FEATURES_NOT_CHECKED — not "correct". The
 * review's defects are about the described house: they bind only when it is the one delivered.
 */
export function deliveredQuality(decision: Arbitration, defects: readonly ReviewDefectLike[] = []): DeliveredQuality {
  const who = decision.accepted === 'DESCRIBED' ? 'describedOk' : 'localOk'
  const bySide = new Map<string, { side: string; met: string[]; failing: string[]; openDefects: string[] }>()
  const at = (side: string) => bySide.get(side) ?? (bySide.set(side, { side, met: [], failing: [], openDefects: [] }).get(side) as { side: string; met: string[]; failing: string[]; openDefects: string[] })
  for (const f of decision.findings.filter((x) => x.featureSide)) (f[who] ? at(f.featureSide as string).met : at(f.featureSide as string).failing).push(`${f.fact}: ${decision.accepted === 'DESCRIBED' ? f.described : f.local}`.slice(0, 200))
  // the last record of each defect stands
  const last = new Map<string, ReviewDefectLike>()
  for (const d of defects) last.set(`${d.side}|${d.feature}|${d.meaning}`, d)
  if (decision.accepted === 'DESCRIBED') for (const d of last.values()) if (d.weight !== 'MINOR' && d.state !== 'IMPROVED' && d.state !== 'MEASURED_PRESENT') at(d.side).openDefects.push(`${d.id} ${d.feature} ${d.meaning} (${d.weight}, ${d.state})`)
  const sides = [...bySide.values()].sort((p, q) => p.side.localeCompare(q.side))
  const notAssessable = decision.unknown.filter((u) => /^(FRONT|REAR|LEFT|RIGHT):/.test(u))
  const checked = decision.findings.some((x) => x.featureSide)
  const failing = sides.flatMap((x) => x.failing)
  const open = sides.flatMap((x) => x.openDefects)
  if (decision.accepted === 'NONE') return { status: 'FEATURES_NOT_CHECKED', why: 'no model was delivered', sides, notAssessable }
  if (failing.length || open.length) return { status: 'FEATURES_PARTIAL', why: `the delivered model (${decision.accepted}) ${[failing.length ? `fails ${failing.length} characteristic feature(s) the source shows` : '', open.length ? `keeps ${open.length} review defect(s) open` : ''].filter(Boolean).join(' and ')}`, sides, notAssessable }
  if (!checked) return { status: 'FEATURES_NOT_CHECKED', why: 'no characteristic feature was read or reported for this source: nothing of the form was checked beyond the massing facts', sides, notAssessable }
  return { status: 'FEATURES_CHECKED', why: `every characteristic feature read on the source is met by the delivered model (${decision.accepted}) and no important review defect is open${notAssessable.length ? `; ${notAssessable.length} side(s) not assessable` : ''}`, sides, notAssessable }
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
/**
 * v3.54.7 (D41) — the characteristic features a source shows on a side, as claims both models are held to by the same
 * scene ruler (`SideFeatures`): from what was READ on the elevations (a gable frame, a loggia, a balcony drawn without
 * supports, a glazing whose head follows the roof), and from the defects a review recorded against the source (a frame
 * MISSING from the model is a frame the source shows). The absence of a feature is never claimed: a model is not
 * faulted here for a frame the source does not show (that is the review's to find, as an EXTRA defect).
 */
export type FeatureClaim = { side: string; feature: 'GABLE_FRAME' | 'LOGGIA' | 'NO_SUPPORTS' | 'SHAPED_GLAZING'; from: string; count?: number }
export type ReviewDefectLike = { id: string; side: string; feature: string; meaning: string; weight: string; state: string; round: number }
export function featureClaims(doc: HouseDocument, defects: readonly ReviewDefectLike[] = []): FeatureClaim[] {
  const out: FeatureClaim[] = []
  const add = (c: FeatureClaim): void => {
    if (!['FRONT', 'REAR', 'LEFT', 'RIGHT'].includes(c.side) || out.some((x) => x.side === c.side && x.feature === c.feature)) return
    out.push(c)
  }
  for (const el of doc.observations.elevations) {
    const view = (doc.verification.views ?? []).find((v) => v.elevation === el.id)
    const side = String(view?.side ?? el.side)
    for (const f of el.features) {
      if (f.kind === 'GABLE_FRAME') add({ side, feature: 'GABLE_FRAME', from: `elevation ${el.id} reads a gable frame (${f.id})` })
      if (f.kind === 'LOGGIA') add({ side, feature: 'LOGGIA', from: `elevation ${el.id} reads a recessed loggia (${f.id})` })
      if ((f.kind === 'LOGGIA' || f.kind === 'BALCONY') && f.posts === false) add({ side, feature: 'NO_SUPPORTS', from: `elevation ${el.id} draws ${f.id} without supports` })
    }
    const shaped = el.openings.filter((o) => (typeof o.headLeftY === 'number' && typeof o.headRightY === 'number' && Math.abs(o.headLeftY - o.headRightY) > 2) || typeof o.apexX === 'number')
    if (shaped.length > 0) add({ side, feature: 'SHAPED_GLAZING', from: `elevation ${el.id} reads ${shaped.length} glazing(s) whose head follows the roof (${shaped.map((o) => o.id).join(', ')})`, count: shaped.length })
  }
  // the last round's record of a defect is what stands; a defect a correction fixed still says what the source shows
  for (const d of defects) {
    if (d.weight === 'MINOR') continue
    const from = `review defect ${d.id} (round ${d.round}, ${d.weight}): the source shows it on ${d.side.toLowerCase()}`
    if (d.feature === 'GABLE_FRAME' && d.meaning !== 'EXTRA') add({ side: d.side, feature: 'GABLE_FRAME', from })
    if (d.feature === 'LOGGIA_OR_RECESS' && d.meaning !== 'EXTRA') add({ side: d.side, feature: 'LOGGIA', from })
    if (d.feature === 'SUPPORTS' && d.meaning === 'EXTRA') add({ side: d.side, feature: 'NO_SUPPORTS', from })
    if (d.feature === 'GLAZING_SHAPE' && d.meaning !== 'EXTRA') add({ side: d.side, feature: 'SHAPED_GLAZING', from })
  }
  return out
}
export function claimMet(c: FeatureClaim, sides: readonly SideFeatures[] | undefined): { ok: boolean; says: string } | undefined {
  const s = sides?.find((x) => x.side === c.side)
  if (!sides) return undefined
  if (!s) return { ok: false, says: 'that side not measured' }
  switch (c.feature) {
    case 'GABLE_FRAME':
      return s.frame ? { ok: true, says: `frame of ${s.frame.pieces} piece(s), ${s.frame.depthM.toFixed(2)} m deep, ${s.frame.bottomY.toFixed(2)}–${s.frame.topY.toFixed(2)} m` } : { ok: false, says: 'no frame on that gable (plain roof edge)' }
    case 'LOGGIA': {
      const l = s.balconies.filter((b) => b.recessed && b.posts === 0)
      return l.length ? { ok: true, says: `${l.length} recessed slab(s) without supports` } : { ok: false, says: s.balconies.length ? `balcony ${s.balconies.map((b) => `${b.id} ${b.recessed ? 'in the plane' : `${b.projectsM.toFixed(2)} m out`}${b.posts ? ` on ${b.posts} post(s)` : ''}`).join(', ')}` : 'no balcony or loggia' }
    }
    case 'NO_SUPPORTS': {
      const p = s.balconies.filter((b) => b.posts > 0)
      return p.length ? { ok: false, says: `${p.map((b) => `${b.id} on ${b.posts} post(s)`).join(', ')}` } : { ok: true, says: 'no free supports' }
    }
    case 'SHAPED_GLAZING': {
      const need = c.count ?? 1
      return s.shapedOpenings.length >= need ? { ok: true, says: `${s.shapedOpenings.length} hole(s) with a raked or pointed head` } : { ok: false, says: `${s.shapedOpenings.length} of ${need} hole(s) with a raked or pointed head (the rest level or not cut)` }
    }
  }
}

export function arbitrate(described: CompiledHouse, local: LocalMeasure | undefined, published: Published, review: { defects?: readonly ReviewDefectLike[] } = {}): Arbitration {
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
  // v3.54.6: one definition of the building height for both models (`heightAgainstFigure`): the figure is the top above
  // the terrain, and a terrain the source does not print is a band, not a convention added to one model only
  const terrainOf = (): { value: number | null; basis: string } => (g?.terrainY ? { value: g.terrainY.value, basis: g.terrainY.basis } : { value: null, basis: 'DEFAULT' })
  // LOCAL's own height above the terrain, when it knows its terrain, is that figure's quantity already; else its top above ±0,00
  const localHeight = (l: LocalMeasure, figure: number): { ok: boolean; says: string } | undefined =>
    l.heightAboveTerrainM !== null ? { ok: Math.abs(l.heightAboveTerrainM - figure) <= ARBITRATION.heightM, says: `${l.heightAboveTerrainM.toFixed(2)} m above its own terrain` } : l.topAboveGroundFloorM !== null ? heightAgainstFigure(l.topAboveGroundFloorM, terrainOf(), figure, ARBITRATION.heightM) : undefined
  if (local && H.length === 1) {
    const h = localHeight(local, H[0].value)
    if (local.roofPlanes === 0 || !h || !h.ok) localAlone.push(`building height ${local.roofPlanes === 0 ? 'no roof built' : h ? h.says : 'not built'} against published ${H[0].value} m`)
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
  // v3.54.6: a plan whose scale no printed dimension gives is not verified in metres — the elevations register at whatever
  // scale the plan has, so they cannot confirm it: what is delivered then is a partial preview, said
  const metric = described.document.verification.checks.find((c) => c.id === 'metric')
  const metricUnverified = metric?.status === 'UNKNOWN' ? `the plan's scale is not verified: ${metric.measured}` : undefined
  if (metricUnverified) unknown.unshift(metricUnverified)
  if (!local) return out('DESCRIBED', 'DESCRIBED_ONLY', `the description passes its source checks and there is no LOCAL model${metricUnverified ? `; ${metricUnverified} — shown as a partial preview` : ''}`, !!metricUnverified, [], unknown)
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
    const topMine = m.roofTopY ?? m.buildingTopY
    const hMine = topMine !== null ? heightAgainstFigure(topMine, terrainOf(), H[0].value, ARBITRATION.heightM) : undefined
    const hLocal = localHeight(local, H[0].value)
    findings.push({ fact: 'building height above the terrain', source: `published ${H[0].value} m (one definition for both: top above ±0,00 against the figure and the terrain)`, local: local.roofPlanes === 0 ? 'no roof built' : hLocal ? hLocal.says : 'not built', described: hMine ? hMine.says : 'not built', localOk: local.roofPlanes > 0 && !!hLocal?.ok, describedOk: !!hMine?.ok })
  }
  // v3.54.6 — the openings each registered elevation shows, against each model's holes on that side: the same evidence
  // for both. An elevation that does not register gives no positions, and a side without one is not compared.
  const notAssessable: string[] = []
  for (const view of described.document.verification.views ?? []) {
    if (!view.elevation) continue
    const tf = view.transform
    if (!view.registered || !tf) {
      if (view.read.openings > 0) notAssessable.push(`${view.side}: elevation ${view.elevation} does not register — its openings are not held against either model`)
      continue
    }
    const el = obs.elevations.find((e) => e.id === view.elevation)
    if (!el) continue
    const boxOf = new Map(el.openings.map((x) => [`${el.id}/${x.id}`, x.box]))
    const read = g.openings.filter((o) => o.refs.some((r) => boxOf.has(r))).map((o) => {
      const xs = o.refs.flatMap((r) => (boxOf.has(r) ? [(boxOf.get(r) as { x0: number }).x0, (boxOf.get(r) as { x1: number }).x1] : []))
      const a = [Math.min(...xs), Math.max(...xs)].map((px) => tf.mPerPx * px + tf.alongAtPx0).sort((p, q) => p - q)
      return { a0: a[0], a1: a[1] }
    })
    if (read.length === 0) continue
    const mine = openingsAgainstElevation(read, m.openings.filter((x) => x.side === view.side))
    if (!local.openings) {
      notAssessable.push(`${view.side}: LOCAL's holes were not measured — its openings are not held against elevation ${view.elevation}`)
      continue
    }
    const theirs = openingsAgainstElevation(read, (local.openings ?? []).filter((x) => x.side === view.side))
    findings.push({ fact: `openings on the ${view.side.toLowerCase()} side`, source: `${read.length} opening(s) on registered elevation ${view.elevation}`, local: `${theirs.matched} of ${read.length} there, ${theirs.extra} not on the elevation`, described: `${mine.matched} of ${read.length} there, ${mine.extra} not on the elevation`, localOk: theirs.ok, describedOk: mine.ok })
  }
  // v3.54.7 (D41) — the characteristic features the source shows, each held against both compiled models by one ruler
  for (const c of featureClaims(described.document, review.defects ?? [])) {
    const mine = claimMet(c, m.sides)
    const theirs = claimMet(c, local.sides)
    if (!mine) continue
    if (!theirs) {
      notAssessable.push(`${c.side}: LOCAL's ${c.feature.toLowerCase().replace('_', ' ')} was not measured — not held against ${c.from}`)
      continue
    }
    findings.push({ fact: `${c.feature.toLowerCase().replace('_', ' ')} on the ${c.side.toLowerCase()} side`, source: c.from, local: theirs.says, described: mine.says, localOk: theirs.ok, describedOk: mine.ok, featureSide: c.side })
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
  unknown.push(...notAssessable)
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
