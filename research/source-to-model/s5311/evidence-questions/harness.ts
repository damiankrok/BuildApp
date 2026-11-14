/**
 * s5311 — narrow evidence questions about published plans, asked of a vision model. RESEARCH, not product.
 *
 * Two variants with the SAME system prompt, question text, JSON schema and model:
 *   B  picture 1 = the original published picture, unchanged
 *   C  picture 1 = the same original, picture 2 = a picture derived from it that points at the region
 *      (an enlarged crop with a red rectangle, or a copy of the sheet with everything outside the region faded)
 *
 * The provider seam is the product's `StructuredVision` (packages/source-vision/src/house-reader.ts): the live
 * adapter, the fixture replayer and `structuredVisionKey` are reused as they are. Every request goes out with purpose
 * 'HOUSE_TRIAGE': that is the BILLING CLASS of the spend books (short question, small answer ceiling, triage model
 * slot), not a claim that these are triage questions.
 *
 * An answer is an OBSERVATION. It is stored with its provenance (model, request key, the sha256 and transform of every
 * picture) and scored against the frozen references in questions.json; `verifiedOnOriginal` is computed locally from
 * the package's own measurements where such a signal exists, and is UNVERIFIED where none does — never invented.
 */
import { createHash } from 'node:crypto'
import { PNG } from 'pngjs'
import { decodeImage } from '@buildapp/source-package'
import type { Raster } from '@buildapp/source-package'
import { HouseReaderUnavailable, fixtureStructuredVision, structuredVisionKey } from '@buildapp/source-vision'
import type { ReaderPicture, StructuredVision, StructuredVisionRequest } from '@buildapp/source-vision'
import type { JsonSchemaNode } from '@buildapp/source-vision'

export const HARNESS_VERSION = 's5311-evidence-questions-0.1.0'
export const PURPOSE = 'HOUSE_TRIAGE' as const

// --- questions -------------------------------------------------------------------------------------------------------

export type Box = { x0: number; y0: number; x1: number; y1: number }
export type Sheet = { packageId: string; assetId: string; byteHash: string; mediaType: string; width: number; height: number } & Record<string, unknown>
export type ExtraField = 'relation' | 'spanFrom' | 'spanTo'
export type ScoredField = 'answerClass' | 'printedText' | ExtraField
export type Question = {
  id: string
  sheet: string
  kind: 'CLASS' | 'DIMENSION'
  pointer: 'CROP' | 'MASK'
  axis?: 'HORIZONTAL' | 'VERTICAL'
  region: Box
  classes: string[]
  extraFields: ExtraField[]
  prompt: string
  scoredFields: ScoredField[]
  reference: { answerClass: string; printedText?: string; unit?: string; relation?: string; spanFrom?: string; spanTo?: string; note?: string }
  verification: { method: 'NONE' | 'CHAIN_SPAN' | 'CALLOUT_READING' }
}
export type QuestionSet = { schema: string; version: number; sheets: Record<string, Sheet>; questions: Question[] } & Record<string, unknown>

export const sha256 = (data: Uint8Array | string): string => createHash('sha256').update(data).digest('hex')

/** The questions, only if they are the sealed ones. */
export function checkSeal(questionsText: string, seal: { sha256?: string }): QuestionSet {
  const actual = sha256(questionsText)
  if (seal.sha256 !== actual) throw new Error(`QUESTIONS_NOT_SEALED: questions.json has sha256 ${actual} but the seal says ${seal.sha256 ?? 'nothing'}; a changed question set needs a new seal, it is never scored under the old one`)
  return JSON.parse(questionsText) as QuestionSet
}

export const SYSTEM = 'You answer narrow questions about one architectural drawing, in the given vocabulary only. Each answer is an observation that will be checked against the drawing; UNKNOWN is a correct answer whenever the drawing does not show it.'

const RELATION = ['TOUCHING', 'SEPARATE', 'UNKNOWN']
const SPAN_END = ['LEFT_OUTER_FACE', 'RIGHT_OUTER_FACE', 'TOP_OUTER_FACE', 'BOTTOM_OUTER_FACE', 'INNER_FACE', 'OTHER', 'UNKNOWN']
const VIEW = ['PLAN', 'ELEVATION', 'UNKNOWN']
const CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW']

/** The text of a question: identical in B and C (it names picture 1's pixels and says what a further picture is). */
export function questionText(q: Question, sheet: Sheet): string {
  const r = q.region
  return [
    `Question ${q.id}.`,
    `Picture 1 is the original sheet as published (${sheet.width} x ${sheet.height} pixels). A further picture, when there is one, is made from picture 1 only to point at the region: either an enlarged crop with a red rectangle drawn around the region, or a copy of the sheet with everything outside the region faded. The red mark and the fading are not part of the drawing.`,
    `The region is x ${r.x0} to ${r.x1}, y ${r.y0} to ${r.y1} in picture 1's pixels (origin top-left, x to the right, y down).`,
    q.prompt,
    'Answer only from what is drawn or printed; if the drawing does not show it, answer UNKNOWN rather than what is typical. alternatives: other classes the drawing also allows, else an empty list. printedText is copied character for character as printed, or UNKNOWN. evidencePicture: the number of the picture your evidenceBox is in; evidenceBox: the box, in that picture\'s own pixels, holding what you based the answer on. view: what kind of drawing picture 1 is. note: one short sentence.',
  ].join('\n')
}

export function questionSchema(q: Question): JsonSchemaNode {
  const str = (values: string[]): JsonSchemaNode => ({ type: 'string', enum: values })
  const properties: Record<string, JsonSchemaNode> = {
    questionId: str([q.id]),
    answerClass: str(q.classes),
    alternatives: { type: 'array', items: str(q.classes) },
    printedText: { type: 'string' },
    unit: { type: 'string' },
    evidencePicture: { type: 'integer' },
    evidenceBox: { type: 'object', additionalProperties: false, required: ['x0', 'y0', 'x1', 'y1'], properties: { x0: { type: 'integer' }, y0: { type: 'integer' }, x1: { type: 'integer' }, y1: { type: 'integer' } } },
    view: str(VIEW),
    confidence: str(CONFIDENCE),
    note: { type: 'string' },
  }
  if (q.extraFields.includes('relation')) properties.relation = str(RELATION)
  if (q.extraFields.includes('spanFrom')) properties.spanFrom = str(SPAN_END)
  if (q.extraFields.includes('spanTo')) properties.spanTo = str(SPAN_END)
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties }
}

// --- pictures --------------------------------------------------------------------------------------------------------

/** picture px -> original px: x_o = offsetX + x / scale (likewise y). */
export type Transform = { offsetX: number; offsetY: number; scale: number }
export type PictureRole = 'ORIGINAL' | 'CROP' | 'MASK'
export type ApiTokens = { rule: string; sentWidth: number; sentHeight: number; downscaled: boolean; tokens: number }
export type PreparedPicture = { number: number; role: PictureRole; mediaType: string; sha256: string; bytes: number; width: number; height: number; file: string; transform: Transform; regionInPicture: Box; tokens: ApiTokens[] }

/**
 * What one picture costs in input tokens, under the two published rules: tokens ~ width x height / 750, after the API
 * downscales (aspect kept) to its limits. LEGACY: long edge <= 1568 px and ~1600 tokens (<= ~1.15 MP). HIGH_RES (the
 * 2576-px tier of the current models): long edge <= 2576 px, <= 3.75 MP, ~4784 tokens. Estimates, not counts:
 * `count_tokens` on the host gives the real figure and was not run here (no key).
 */
export function apiImageTokens(width: number, height: number): ApiTokens[] {
  const rules: Array<[string, number, number]> = [['LEGACY_1568', 1568, 1600 * 750], ['HIGH_RES_2576', 2576, Math.min(3_750_000, 4784 * 750)]]
  return rules.map(([rule, edge, pixels]) => {
    const s = Math.min(1, edge / Math.max(width, height), Math.sqrt(pixels / (width * height)))
    const w = Math.floor(width * s)
    const h = Math.floor(height * s)
    return { rule, sentWidth: w, sentHeight: h, downscaled: s < 1, tokens: Math.ceil((w * h) / 750) }
  })
}

const RED: [number, number, number] = [230, 0, 0]

function flattenOnWhite(r: Raster): Raster {
  const data = new Uint8ClampedArray(r.data.length)
  for (let i = 0; i < r.data.length; i += 4) {
    const a = r.data[i + 3] / 255
    for (let c = 0; c < 3; c += 1) data[i + c] = Math.round(r.data[i + c] * a + 255 * (1 - a))
    data[i + 3] = 255
  }
  return { width: r.width, height: r.height, data }
}

function cropScale(r: Raster, box: Box, k: number): Raster {
  const w = (box.x1 - box.x0) * k
  const h = (box.y1 - box.y0) * k
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    const sy = box.y0 + Math.floor(y / k)
    for (let x = 0; x < w; x += 1) {
      const sx = box.x0 + Math.floor(x / k)
      const si = (sy * r.width + sx) * 4
      const di = (y * w + x) * 4
      data[di] = r.data[si]
      data[di + 1] = r.data[si + 1]
      data[di + 2] = r.data[si + 2]
      data[di + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

function drawRect(r: Raster, b: Box, t: number): void {
  const set = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return
    const i = (y * r.width + x) * 4
    r.data[i] = RED[0]
    r.data[i + 1] = RED[1]
    r.data[i + 2] = RED[2]
    r.data[i + 3] = 255
  }
  for (let d = 0; d < t; d += 1) {
    for (let x = b.x0 - d; x <= b.x1 + d; x += 1) {
      set(x, b.y0 - d)
      set(x, b.y1 + d)
    }
    for (let y = b.y0 - d; y <= b.y1 + d; y += 1) {
      set(b.x0 - d, y)
      set(b.x1 + d, y)
    }
  }
}

export const encodePng = (r: Raster): Uint8Array => new Uint8Array(PNG.sync.write({ width: r.width, height: r.height, data: Buffer.from(r.data.buffer, r.data.byteOffset, r.data.byteLength) } as unknown as PNG, { colorType: 2 }))

const clampBox = (b: Box, w: number, h: number): Box => ({ x0: Math.max(0, Math.floor(b.x0)), y0: Math.max(0, Math.floor(b.y0)), x1: Math.min(w, Math.ceil(b.x1)), y1: Math.min(h, Math.ceil(b.y1)) })
export const toOriginal = (b: Box, t: Transform): Box => ({ x0: t.offsetX + b.x0 / t.scale, y0: t.offsetY + b.y0 / t.scale, x1: t.offsetX + b.x1 / t.scale, y1: t.offsetY + b.y1 / t.scale })
export const toPicture = (b: Box, t: Transform): Box => ({ x0: Math.round((b.x0 - t.offsetX) * t.scale), y0: Math.round((b.y0 - t.offsetY) * t.scale), x1: Math.round((b.x1 - t.offsetX) * t.scale), y1: Math.round((b.y1 - t.offsetY) * t.scale) })

/** Long edge a crop is enlarged to at most: under the legacy 1568-px limit, so no model downscales it again. */
export const CROP_MAX_EDGE = 1560

/** The pointer picture of variant C, derived from the original's decoded pixels only. */
export function pointerPicture(original: Raster, region: Box, kind: 'CROP' | 'MASK'): { bytes: Uint8Array; width: number; height: number; transform: Transform } {
  const flat = flattenOnWhite(original)
  if (kind === 'MASK') {
    const out: Raster = { width: flat.width, height: flat.height, data: new Uint8ClampedArray(flat.data) }
    const keep = clampBox({ x0: region.x0 - 3, y0: region.y0 - 3, x1: region.x1 + 3, y1: region.y1 + 3 }, flat.width, flat.height)
    for (let y = 0; y < out.height; y += 1)
      for (let x = 0; x < out.width; x += 1) {
        if (x >= keep.x0 && x < keep.x1 && y >= keep.y0 && y < keep.y1) continue
        const i = (y * out.width + x) * 4
        for (let c = 0; c < 3; c += 1) out.data[i + c] = Math.round(out.data[i + c] * 0.4 + 255 * 0.6)
      }
    drawRect(out, { x0: keep.x0 - 1, y0: keep.y0 - 1, x1: keep.x1, y1: keep.y1 }, 2)
    return { bytes: encodePng(out), width: out.width, height: out.height, transform: { offsetX: 0, offsetY: 0, scale: 1 } }
  }
  const w = region.x1 - region.x0
  const h = region.y1 - region.y0
  // a margin from the SHORT side: a long thin region (a dimension line) keeps a crop it can be enlarged in
  const margin = Math.max(24, Math.round(0.5 * Math.min(w, h)))
  const crop = clampBox({ x0: region.x0 - margin, y0: region.y0 - margin, x1: region.x1 + margin, y1: region.y1 + margin }, flat.width, flat.height)
  const k = Math.max(1, Math.min(4, Math.floor(CROP_MAX_EDGE / Math.max(crop.x1 - crop.x0, crop.y1 - crop.y0))))
  const out = cropScale(flat, crop, k)
  const transform = { offsetX: crop.x0, offsetY: crop.y0, scale: k }
  const r = toPicture(region, transform)
  const t = Math.max(2, k)
  drawRect(out, { x0: r.x0 - 2 - t, y0: r.y0 - 2 - t, x1: r.x1 + 1 + t, y1: r.y1 + 1 + t }, t)
  return { bytes: encodePng(out), width: out.width, height: out.height, transform }
}

// --- prepared requests -----------------------------------------------------------------------------------------------

export type PreparedRequest = {
  id: string
  questionId: string
  sheet: string
  variant: 'B' | 'C'
  purpose: typeof PURPOSE
  system: string
  text: string
  schema: JsonSchemaNode
  pictures: PreparedPicture[]
  /** `structuredVisionKey` of the request: what a fixture answer is filed under. */
  requestKey: string
}
export type LoadedRequest = PreparedRequest & { bytes: Record<number, Uint8Array> }

export const extOf = (mediaType: string): string => mediaType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'

/** B and C for every question, from the original bytes of each sheet (checked against the sealed byte hash). */
export function prepareRequests(set: QuestionSet, originals: Record<string, Uint8Array>): { requests: LoadedRequest[]; files: Record<string, Uint8Array> } {
  const files: Record<string, Uint8Array> = {}
  const requests: LoadedRequest[] = []
  const decoded = new Map<string, Raster>()
  for (const q of set.questions) {
    const sheet = set.sheets[q.sheet]
    const bytes = originals[q.sheet]
    if (!sheet || !bytes) throw new Error(`no sheet or original bytes for ${q.sheet}`)
    if (sha256(bytes) !== sheet.byteHash) throw new Error(`the bytes given for ${q.sheet} are not the sealed original (${sha256(bytes).slice(0, 12)} != ${sheet.byteHash.slice(0, 12)})`)
    if (!decoded.has(q.sheet)) decoded.set(q.sheet, decodeImage(bytes))
    const raster = decoded.get(q.sheet) as Raster
    if (raster.width !== sheet.width || raster.height !== sheet.height) throw new Error(`${q.sheet} decodes to ${raster.width}x${raster.height}, sealed as ${sheet.width}x${sheet.height}`)
    const originalFile = `pictures/${sheet.byteHash}.${extOf(sheet.mediaType)}`
    files[originalFile] = bytes
    const identity = { offsetX: 0, offsetY: 0, scale: 1 }
    const original: PreparedPicture = { number: 1, role: 'ORIGINAL', mediaType: sheet.mediaType, sha256: sheet.byteHash, bytes: bytes.byteLength, width: raster.width, height: raster.height, file: originalFile, transform: identity, regionInPicture: q.region, tokens: apiImageTokens(raster.width, raster.height) }
    const pointer = pointerPicture(raster, q.region, q.pointer)
    const pointerHash = sha256(pointer.bytes)
    const pointerFile = `pictures/${pointerHash}.png`
    files[pointerFile] = pointer.bytes
    const second: PreparedPicture = { number: 2, role: q.pointer, mediaType: 'image/png', sha256: pointerHash, bytes: pointer.bytes.byteLength, width: pointer.width, height: pointer.height, file: pointerFile, transform: pointer.transform, regionInPicture: toPicture(q.region, pointer.transform), tokens: apiImageTokens(pointer.width, pointer.height) }
    const text = questionText(q, sheet)
    const schema = questionSchema(q)
    for (const [variant, pictures] of [['B', [original]], ['C', [original, second]]] as const) {
      const byNumber: Record<number, Uint8Array> = pictures.length > 1 ? { 1: bytes, 2: pointer.bytes } : { 1: bytes }
      const request = { purpose: PURPOSE, system: SYSTEM, text, schema, pictures: pictures.map((p) => ({ number: p.number, bytes: byNumber[p.number], mediaType: p.mediaType })) }
      requests.push({ id: `${q.id}-${variant}`, questionId: q.id, sheet: q.sheet, variant, purpose: PURPOSE, system: SYSTEM, text, schema, pictures: [...pictures], requestKey: structuredVisionKey(request), bytes: byNumber })
    }
  }
  return { requests, files }
}

export const toVisionRequest = (r: LoadedRequest): StructuredVisionRequest => ({ purpose: r.purpose, system: r.system, text: r.text, schema: r.schema, pictures: r.pictures.map((p): ReaderPicture => ({ number: p.number, bytes: r.bytes[p.number], mediaType: p.mediaType })) })

/** Read a prepared request and its pictures from disk, refusing pictures whose bytes are not the ones it was made with. */
export function loadRequest(prepared: PreparedRequest, read: (file: string) => Uint8Array): LoadedRequest {
  const bytes: Record<number, Uint8Array> = {}
  for (const p of prepared.pictures) {
    const b = read(p.file)
    if (sha256(b) !== p.sha256) throw new Error(`PAYLOAD_ALTERED: ${p.file} is not the picture ${prepared.id} was prepared with`)
    bytes[p.number] = b
  }
  return { ...prepared, bytes }
}

// --- estimates -------------------------------------------------------------------------------------------------------

export type Price = { inputUsdPerMTok: number; outputUsdPerMTok: number; above?: { promptTokens: number; inputUsdPerMTok: number; outputUsdPerMTok: number } }
/** Expected (not reserved) answer size: the JSON (~150 tokens) plus adaptive thinking at the model's default effort. An assumption. */
export const EXPECTED_OUTPUT_TOKENS = 600
const EXPECTED_CHARS_PER_TOKEN = 3.5
/** Per request: the "Picture n:" labels, the structured-output preamble and message framing (assumed). */
const EXPECTED_OVERHEAD_TOKENS = 400

export const usd = (price: Price, inputTokens: number, outputTokens: number): number => {
  const tier = price.above && inputTokens > price.above.promptTokens ? price.above : price
  return Math.round(((inputTokens * tier.inputUsdPerMTok + outputTokens * tier.outputUsdPerMTok) / 1e6) * 1e6) / 1e6
}

export function expectedInputTokens(r: Pick<PreparedRequest, 'system' | 'text' | 'schema' | 'pictures'>): { imageTokens: number; textTokens: number; total: number } {
  // the larger of the two rules' image counts (they agree at these sizes: nothing is downscaled)
  const imageTokens = r.pictures.reduce((s, p) => s + Math.max(...p.tokens.map((t) => t.tokens)), 0)
  const textTokens = Math.ceil((r.system.length + r.text.length + JSON.stringify(r.schema).length) / EXPECTED_CHARS_PER_TOKEN)
  return { imageTokens, textTokens, total: imageTokens + textTokens + EXPECTED_OVERHEAD_TOKENS }
}

// --- scoring and local verification ----------------------------------------------------------------------------------

export type Answer = {
  questionId: string
  answerClass: string
  alternatives: string[]
  printedText: string
  unit: string
  evidencePicture: number
  evidenceBox: Box
  view: string
  confidence: string
  note: string
  relation?: string
  spanFrom?: string
  spanTo?: string
}
export type FieldScore = 'CORRECT' | 'WRONG' | 'UNKNOWN'
export type Score = { result: FieldScore; fields: Partial<Record<ScoredField, FieldScore>>; admitted: boolean; why?: string }

/** The answer, only if it has the schema's shape; anything else is not admitted and counts as UNKNOWN. */
export function admit(q: Question, raw: unknown): Answer | null {
  const a = raw as Record<string, unknown> | null
  if (!a || typeof a !== 'object') return null
  const isStr = (v: unknown): v is string => typeof v === 'string'
  const box = a.evidenceBox as Record<string, unknown> | undefined
  const ok =
    a.questionId === q.id && isStr(a.answerClass) && q.classes.includes(a.answerClass) && Array.isArray(a.alternatives) && a.alternatives.every((x) => isStr(x) && q.classes.includes(x)) && isStr(a.printedText) && isStr(a.unit) && Number.isInteger(a.evidencePicture) &&
    !!box && ['x0', 'y0', 'x1', 'y1'].every((k) => Number.isFinite(box[k])) && isStr(a.view) && VIEW.includes(a.view) && isStr(a.confidence) && CONFIDENCE.includes(a.confidence) && isStr(a.note) &&
    (!q.extraFields.includes('relation') || (isStr(a.relation) && RELATION.includes(a.relation))) && (!q.extraFields.includes('spanFrom') || (isStr(a.spanFrom) && SPAN_END.includes(a.spanFrom))) && (!q.extraFields.includes('spanTo') || (isStr(a.spanTo) && SPAN_END.includes(a.spanTo)))
  return ok ? (a as unknown as Answer) : null
}

export const numbersOf = (text: string): string[] => text.match(/\d+/g) ?? []
const isUnknownText = (t: string): boolean => t.trim() === '' || t.trim().toUpperCase() === 'UNKNOWN'

/** Printed text compared as its digit groups: '1 400' is '1400' where one number is expected; '500 / 225' is '500/225'. */
export function sameLiteral(answer: string, reference: string): boolean {
  const a = numbersOf(answer)
  const r = numbersOf(reference)
  if (r.length === 0) return answer.trim().toLowerCase() === reference.trim().toLowerCase()
  if (r.length === 1) return a.join('') === r[0]
  return a.length === r.length && a.every((n, i) => n === r[i])
}

export function score(q: Question, raw: unknown): Score {
  const a = admit(q, raw)
  if (!a) return { result: 'UNKNOWN', fields: {}, admitted: false, why: 'the answer does not have the schema\'s shape' }
  const fields: Partial<Record<ScoredField, FieldScore>> = {}
  for (const f of q.scoredFields) {
    const ref = q.reference[f]
    const got = a[f]
    if (ref === undefined) continue
    if (f === 'printedText') fields[f] = isUnknownText(a.printedText) ? 'UNKNOWN' : sameLiteral(a.printedText, ref) ? 'CORRECT' : 'WRONG'
    else fields[f] = got === undefined || got === 'UNKNOWN' ? 'UNKNOWN' : got === ref ? 'CORRECT' : 'WRONG'
  }
  const values = Object.values(fields)
  const result: FieldScore = fields.answerClass === 'UNKNOWN' ? 'UNKNOWN' : values.includes('WRONG') ? 'WRONG' : values.every((v) => v === 'CORRECT') ? 'CORRECT' : 'UNKNOWN'
  return { result, fields, admitted: true }
}

export type BoxCheck = { picture: number; box: Box; pictureKnown: boolean; insideImage: boolean; boxInOriginal: Box | null; overlapsReference: boolean; iou: number }

export function checkEvidenceBox(q: Question, a: Answer | null, pictures: PreparedPicture[]): BoxCheck | null {
  if (!a) return null
  const p = pictures.find((x) => x.number === a.evidencePicture)
  const b = a.evidenceBox
  if (!p) return { picture: a.evidencePicture, box: b, pictureKnown: false, insideImage: false, boxInOriginal: null, overlapsReference: false, iou: 0 }
  const inside = b.x0 >= 0 && b.y0 >= 0 && b.x1 <= p.width && b.y1 <= p.height && b.x0 < b.x1 && b.y0 < b.y1
  const o = toOriginal(b, p.transform)
  const r = q.region
  const iw = Math.max(0, Math.min(o.x1, r.x1) - Math.max(o.x0, r.x0))
  const ih = Math.max(0, Math.min(o.y1, r.y1) - Math.max(o.y0, r.y0))
  const inter = iw * ih
  const area = (x: Box): number => Math.max(0, x.x1 - x.x0) * Math.max(0, x.y1 - x.y0)
  const union = area(o) + area(r) - inter
  return { picture: p.number, box: b, pictureKnown: true, insideImage: inside, boxInOriginal: o, overlapsReference: inter > 0, iou: union > 0 ? Math.round((inter / union) * 1e4) / 1e4 : 0 }
}

/** The parts of a package's metric-evidence.json the local check reads. */
export type MetricEvidence = {
  chains: Array<{ id: string; assetId: string; axis: 'HORIZONTAL' | 'VERTICAL'; baselinePx: number; ticksPx: number[] }>
  coordinateRegistrations: Array<{ id: string; assetId: string; plane: string; metresPerPixelX: number; metresPerPixelY: number; confidence?: number }>
  calloutRings?: Array<{ id: string; frameId: string; accepted: boolean; centrePx: { x: number; y: number }; width?: { text?: string; accepted?: boolean }; height?: { text?: string; accepted?: boolean } }>
}
export type Verification = { status: 'VERIFIED' | 'CONTRADICTED' | 'UNVERIFIED'; method: string; reason: string; detail?: Record<string, unknown> }

export const SCALE_TOLERANCE = 0.03

/**
 * Checked on the original, by the package's own measurements, never by the reference:
 *  - a dimension literal: the chain the package detected inside the question's region (its baseline in the region, its
 *    ticks inside it) must be split, from its first tick to its last, into consecutive spans — one per printed number,
 *    in order — each of whose implied scale (value / pixel span) agrees with the sheet's registration within 3 %.
 *    CONTRADICTED means the literal and the registration disagree; it says which scale each implies, because a
 *    registration can itself be wrong.
 *  - a callout literal: an ACCEPTED local callout reading inside the region, if the package has one.
 *  - a class: nothing local tells a window from a wall, so UNVERIFIED.
 */
export function verifyOnOriginal(q: Question, sheet: Sheet, a: Answer | null, metric: MetricEvidence | null): Verification {
  const method = q.verification.method
  if (!a) return { status: 'UNVERIFIED', method, reason: 'NOT_ADMITTED' }
  if (method === 'NONE') return { status: 'UNVERIFIED', method, reason: 'NO_LOCAL_SIGNAL_FOR_CLASS' }
  if (isUnknownText(a.printedText)) return { status: 'UNVERIFIED', method, reason: 'NO_LITERAL' }
  if (!metric) return { status: 'UNVERIFIED', method, reason: 'NO_METRIC_EVIDENCE' }
  const r = q.region
  if (method === 'CALLOUT_READING') {
    const ring = (metric.calloutRings ?? []).find((c) => c.accepted && c.frameId.includes(sheet.assetId) && c.centrePx.x >= r.x0 && c.centrePx.x <= r.x1 && c.centrePx.y >= r.y0 && c.centrePx.y <= r.y1)
    if (!ring) return { status: 'UNVERIFIED', method, reason: 'NO_ACCEPTED_LOCAL_READING' }
    const local = `${ring.width?.text ?? ''}/${ring.height?.text ?? ''}`
    return { status: sameLiteral(a.printedText, local) ? 'VERIFIED' : 'CONTRADICTED', method, reason: 'ACCEPTED_LOCAL_READING', detail: { ring: ring.id, local } }
  }
  const numbers = numbersOf(a.printedText).map(Number)
  if (numbers.length === 0) return { status: 'UNVERIFIED', method, reason: 'NO_NUMBER' }
  const axis = q.axis ?? 'HORIZONTAL'
  const [lo, hi, across0, across1] = axis === 'HORIZONTAL' ? [r.x0, r.x1, r.y0, r.y1] : [r.y0, r.y1, r.x0, r.x1]
  const slack = 6
  const chains = metric.chains
    .filter((c) => c.assetId === sheet.assetId && c.axis === axis && c.baselinePx >= across0 && c.baselinePx <= across1)
    .map((c) => ({ id: c.id, baselinePx: c.baselinePx, ticks: c.ticksPx.filter((t) => t >= lo - slack && t <= hi + slack).sort((x, y) => x - y) }))
    .filter((c) => c.ticks.length >= 2)
    .sort((x, y) => y.ticks[y.ticks.length - 1] - y.ticks[0] - (x.ticks[x.ticks.length - 1] - x.ticks[0]))
  if (chains.length === 0) return { status: 'UNVERIFIED', method, reason: 'NO_CHAIN_SPANS_REGION' }
  const reg = metric.coordinateRegistrations.find((g) => g.assetId === sheet.assetId && g.plane === 'PLAN_XZ')
  if (!reg) return { status: 'UNVERIFIED', method, reason: 'NO_REGISTRATION' }
  const cmPerPx = (axis === 'HORIZONTAL' ? reg.metresPerPixelX : reg.metresPerPixelY) * 100
  const chain = chains[0]
  const t = chain.ticks
  // consecutive spans from the first tick to the last, one per number, each within tolerance; best by worst deviation
  type Span = { fromPx: number; toPx: number; valueCm: number; impliedCmPerPx: number; deviation: number }
  const search: { best: { worst: number; spans: Span[] } | null } = { best: null }
  const walk = (start: number, k: number, acc: Span[]): void => {
    if (k === numbers.length) {
      if (start !== t.length - 1) return
      const worst = Math.max(...acc.map((s) => Math.abs(s.deviation)))
      if (!search.best || worst < search.best.worst) search.best = { worst, spans: [...acc] }
      return
    }
    for (let j = start + 1; j < t.length; j += 1) {
      if (numbers.length - k - 1 > t.length - 1 - j) break
      const implied = numbers[k] / (t[j] - t[start])
      acc.push({ fromPx: t[start], toPx: t[j], valueCm: numbers[k], impliedCmPerPx: Math.round(implied * 1e4) / 1e4, deviation: Math.round((implied / cmPerPx - 1) * 1e4) / 1e4 })
      walk(j, k + 1, acc)
      acc.pop()
    }
  }
  walk(0, 0, [])
  const found = search.best
  const detail = { chain: chain.id, baselinePx: chain.baselinePx, ticksPx: t, registration: reg.id, registrationCmPerPx: Math.round(cmPerPx * 1e4) / 1e4, registrationConfidence: reg.confidence ?? null, tolerance: SCALE_TOLERANCE, spans: found?.spans ?? null }
  if (!found) return { status: 'UNVERIFIED', method, reason: 'MORE_NUMBERS_THAN_SPANS', detail }
  return found.worst <= SCALE_TOLERANCE
    ? { status: 'VERIFIED', method, reason: 'CHAIN_SPAN_AGREES_WITH_REGISTRATION', detail }
    : { status: 'CONTRADICTED', method, reason: 'CHAIN_SPAN_DISAGREES_WITH_REGISTRATION', detail: { ...detail, worstDeviation: found.worst, caution: 'the literal or the registration is wrong; this check cannot tell which' } }
}

// --- running ---------------------------------------------------------------------------------------------------------

export type Observation = {
  kind: 'OBSERVATION'
  harnessVersion: string
  requestId: string
  questionId: string
  sheet: string
  variant: 'B' | 'C'
  provenance: { provider: string; providerVersion: string; modelRequested: string; modelServed: string | null; requestKey: string; pictures: Array<{ number: number; role: PictureRole; sha256: string; width: number; height: number; transform: Transform }>; fromCache: boolean; usage: Record<string, unknown> | null }
  output: unknown
  error: { reason: string; message: string } | null
  score: Score
  evidenceBox: BoxCheck | null
  verifiedOnOriginal: Verification
}

export type AnswerCache = { get(key: string): { output: unknown; usage: Record<string, unknown> } | null; put(key: string, value: { output: unknown; usage: Record<string, unknown> }): void }

/** What a cached answer is filed under: the pictures' bytes, the question, the schema, the model and this harness. */
export const answerCacheKey = (r: PreparedRequest, model: string): string => sha256(JSON.stringify({ v: HARNESS_VERSION, model, questionId: r.questionId, system: r.system, text: r.text, schema: r.schema, pictures: r.pictures.map((p) => [p.number, p.mediaType, p.sha256]) }))

/** A provider failure that ends the run: another request would meet the same wall or spend on a broken path. */
const STOPS = new Set(['BUDGET', 'TRANSPORT', 'REJECTED_UNBILLED', 'NO_CREDENTIALS', 'REQUEST_TOO_LARGE', 'NO_PROVIDER'])

export async function askAll(input: { set: QuestionSet; requests: LoadedRequest[]; reader: StructuredVision; model: string; metricBySheet: Record<string, MetricEvidence | null>; cache?: AnswerCache; onRecord?: (o: Observation) => void }): Promise<{ observations: Observation[]; stoppedBy: { reason: string; message: string } | null }> {
  const observations: Observation[] = []
  let stoppedBy: { reason: string; message: string } | null = null
  for (const r of input.requests) {
    const q = input.set.questions.find((x) => x.id === r.questionId)
    const sheet = input.set.sheets[r.sheet]
    if (!q || !sheet) throw new Error(`request ${r.id} names no sealed question`)
    const request = toVisionRequest(r)
    const requestKey = structuredVisionKey(request)
    const cacheKey = answerCacheKey(r, input.model)
    let output: unknown = null
    let usage: Record<string, unknown> | null = null
    let error: Observation['error'] = null
    let fromCache = false
    const cached = input.cache?.get(cacheKey) ?? null
    if (cached) {
      output = cached.output
      usage = cached.usage
      fromCache = true
    } else {
      try {
        const answer = await input.reader.ask(request)
        output = answer.output
        usage = answer.usage as unknown as Record<string, unknown>
        input.cache?.put(cacheKey, { output, usage })
      } catch (e) {
        // a fixture that has no answer for these bytes is a loud miss, never an answer about other pictures
        if (e instanceof HouseReaderUnavailable && e.reason === 'FIXTURE_MISS') throw e
        error = { reason: e instanceof HouseReaderUnavailable ? e.reason : 'ERROR', message: String((e as Error).message).slice(0, 300) }
      }
    }
    const a = error ? null : admit(q, output)
    const o: Observation = {
      kind: 'OBSERVATION',
      harnessVersion: HARNESS_VERSION,
      requestId: r.id,
      questionId: q.id,
      sheet: r.sheet,
      variant: r.variant,
      provenance: { provider: input.reader.provider.id, providerVersion: input.reader.provider.version, modelRequested: input.model, modelServed: typeof usage?.model === 'string' ? usage.model : null, requestKey, pictures: r.pictures.map((p) => ({ number: p.number, role: p.role, sha256: p.sha256, width: p.width, height: p.height, transform: p.transform })), fromCache, usage },
      output: error ? null : output,
      error,
      score: error ? { result: 'UNKNOWN', fields: {}, admitted: false, why: `no answer (${error.reason})` } : score(q, output),
      evidenceBox: checkEvidenceBox(q, a, r.pictures),
      verifiedOnOriginal: verifyOnOriginal(q, sheet, a, input.metricBySheet[r.sheet] ?? null),
    }
    observations.push(o)
    input.onRecord?.(o)
    if (error && STOPS.has(error.reason)) {
      stoppedBy = error
      break
    }
  }
  return { observations, stoppedBy }
}

export type Summary = Record<'B' | 'C', { asked: number; CORRECT: number; WRONG: number; UNKNOWN: number; VERIFIED: number; CONTRADICTED: number; UNVERIFIED: number; boxInside: number; boxOverlapsReference: number }>

export function summarise(observations: Observation[]): { byVariant: Summary; byQuestion: Array<Record<string, unknown>> } {
  const empty = () => ({ asked: 0, CORRECT: 0, WRONG: 0, UNKNOWN: 0, VERIFIED: 0, CONTRADICTED: 0, UNVERIFIED: 0, boxInside: 0, boxOverlapsReference: 0 })
  const byVariant: Summary = { B: empty(), C: empty() }
  for (const o of observations) {
    const s = byVariant[o.variant]
    s.asked += 1
    s[o.score.result] += 1
    s[o.verifiedOnOriginal.status] += 1
    if (o.evidenceBox?.insideImage) s.boxInside += 1
    if (o.evidenceBox?.overlapsReference) s.boxOverlapsReference += 1
  }
  const byQuestion = observations.map((o) => ({ request: o.requestId, score: o.score.result, fields: o.score.fields, verified: o.verifiedOnOriginal.status, verifyReason: o.verifiedOnOriginal.reason, boxInside: o.evidenceBox?.insideImage ?? null, boxOverlaps: o.evidenceBox?.overlapsReference ?? null, iou: o.evidenceBox?.iou ?? null, error: o.error?.reason ?? null }))
  return { byVariant, byQuestion }
}

// --- fixtures (synthetic answers that exercise the path; never model answers) ----------------------------------------

export type FixtureKind = 'all-correct' | 'wrong-hint' | 'all-unknown'
export type FixtureFile = { schema: 'buildapp.evidence-questions-fixture'; kind: FixtureKind; synthetic: true; note: string; questionsSha256: string; recordedFrom: { model: string; triageModel: string }; hints: Record<string, Partial<Answer>>; answers: Record<string, unknown> }

/** The deliberately wrong hint: Q1 read as an open gap, Q3 read as 1100 (which its chain contradicts). */
export const WRONG_HINTS: Record<string, Partial<Answer>> = { Q1: { answerClass: 'OPEN_GAP' }, Q3: { printedText: '1100' } }

export function fixtureAnswer(q: Question, r: PreparedRequest, kind: FixtureKind, hints: Record<string, Partial<Answer>> = WRONG_HINTS): Answer {
  const evidence = r.pictures[r.pictures.length - 1]
  if (kind === 'all-unknown') {
    const p = r.pictures[0]
    return { questionId: q.id, answerClass: 'UNKNOWN', alternatives: [], printedText: 'UNKNOWN', unit: 'UNKNOWN', evidencePicture: 1, evidenceBox: { x0: 0, y0: 0, x1: p.width, y1: p.height }, view: 'PLAN', confidence: 'LOW', note: 'SYNTHETIC FIXTURE: not a model answer', ...(q.extraFields.includes('relation') ? { relation: 'UNKNOWN' } : {}), ...(q.extraFields.includes('spanFrom') ? { spanFrom: 'UNKNOWN' } : {}), ...(q.extraFields.includes('spanTo') ? { spanTo: 'UNKNOWN' } : {}) }
  }
  const ref = q.reference
  const correct: Answer = {
    questionId: q.id,
    answerClass: ref.answerClass,
    alternatives: [],
    printedText: ref.printedText ?? 'UNKNOWN',
    unit: ref.unit ?? 'UNKNOWN',
    evidencePicture: evidence.number,
    evidenceBox: evidence.regionInPicture,
    view: 'PLAN',
    confidence: 'HIGH',
    note: 'SYNTHETIC FIXTURE: not a model answer',
    ...(q.extraFields.includes('relation') ? { relation: ref.relation ?? 'UNKNOWN' } : {}),
    ...(q.extraFields.includes('spanFrom') ? { spanFrom: ref.spanFrom ?? 'UNKNOWN' } : {}),
    ...(q.extraFields.includes('spanTo') ? { spanTo: ref.spanTo ?? 'UNKNOWN' } : {}),
  }
  return kind === 'wrong-hint' && hints[q.id] ? { ...correct, ...hints[q.id] } : correct
}

export function makeFixture(set: QuestionSet, questionsSha256: string, requests: LoadedRequest[], kind: FixtureKind, recordedFrom = { model: 'claude-sonnet-5-5', triageModel: 'claude-sonnet-5-5' }): FixtureFile {
  const answers: Record<string, unknown> = {}
  for (const r of requests) {
    const q = set.questions.find((x) => x.id === r.questionId) as Question
    answers[structuredVisionKey(toVisionRequest(r))] = fixtureAnswer(q, r, kind)
  }
  return { schema: 'buildapp.evidence-questions-fixture', kind, synthetic: true, note: 'SYNTHETIC answers written from the frozen references to exercise the replay path; never a model answer and never evidence of what a model reads.', questionsSha256, recordedFrom, hints: kind === 'wrong-hint' ? WRONG_HINTS : {}, answers }
}

export const fixtureReader = (f: FixtureFile): StructuredVision => fixtureStructuredVision(f.answers, f.recordedFrom)
