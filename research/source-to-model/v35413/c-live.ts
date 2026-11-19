/**
 * v3.54.13 — C-live: the four ORIGINAL elevations read by the provider's Messages API into the bounded appearance
 * contract (outlines and material classes in each picture's own pixels, as JSON — no raster is edited, no code or SVG
 * from the reply is executed), then applied by the same consumer as C-offline to the same base geometry.
 *
 *   BUILDPLAN_ANTHROPIC_API_KEY=… npx vite-node research/source-to-model/v35413/c-live.ts -- --plan-only | --run
 *
 * The plan (model, prompt version, schema, sources, requests, limits and the worst-case cost) is written before any
 * request. Each request reserves its worst case (input estimate bound + max_tokens at the output price) in the ledger
 * first and is not sent if the reservation would pass the ceiling; it is settled at the reported usage. One retry in
 * total for an unusable reply. The key is read from the environment only and written nowhere.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { stableJson } from '@buildapp/source-common'
import { APPEARANCE_CLASSES, APPEARANCE_OBSERVATION_SCHEMA, APPEARANCE_OBSERVATION_VERSION, parseAppearanceObservation } from '../../../packages/analysis-service/src/appearance/index.js'
import type { AppearanceObservation } from '../../../packages/analysis-service/src/appearance/index.js'

const ROOT = '/home/user/BuildApp'
const PRIVATE = '/home/user/rd/v35413/live'
const SCRATCH = '/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/v35412-real'
const LEDGER = join(ROOT, 'research/ai-assist/spend-ledger-v35413.json')
const PLAN = join(ROOT, 'research/source-to-model/v35413/live-plan.json')
const MODEL = 'claude-sonnet-5-5'
const PRICE = { inPerM: 2, outPerM: 10 } // USD per million tokens, the provider's published price for this model
const OPENING_USD = 23.808382
const CEILING_USD = 24.11036
const MAX_TOKENS = 4000
const INPUT_BOUND_TOKENS = 4000 // a 1280 × ~600 picture is ≈ 1 020 tokens; with the prompt well under this bound
const MAX_REQUESTS = 5 // four sides and one retry in total
const PROMPT_VERSION = 'appearance-contours-1'

const SIDES = [
  { facade: 'FRONT', file: 'front-orig-130edece.png', sourceByteHash: '130edece308d06a680c969633cfcd27c9f8ddd6052b3cf7b608b77cd12d00142' },
  { facade: 'REAR', file: 'x2-84ebf5b3.png', sourceByteHash: '84ebf5b30670882bd566c8b9bd0ab1f848f3252fa5fa28cda053ab5d5c9ce26e' },
  { facade: 'EAST', file: 'x3-93e15087.png', sourceByteHash: '93e150872f599485c653ceba5d54655d6e117780c088cb3aff4b9390625562dd' },
  { facade: 'WEST', file: 'x1-0015dfde.png', sourceByteHash: '0015dfde66b5657c771e703e2cfdb3e068f6e30ff2f8e1435ce950e98a3b11c6' },
] as const

const SYSTEM = 'You read architectural elevation pictures and return the outlines of finish materials as JSON. Reply with one JSON object and nothing else.'
const userText = (facade: string, w: number, h: number): string => `This is the ${facade.toLowerCase()} elevation of a single-family house, ${w}×${h} pixels.
Trace the outlines of the FINISH MATERIALS on the building's visible facade surfaces, in this image's own pixel coordinates (x to the right from the left edge, y down from the top edge; integers).
Classes: LIGHT_RENDER (light or white render, a light frame), DARK_RENDER (dark grey or anthracite render or cladding), TIMBER (wood cladding), GLASS (windows, glazed doors, glass balustrades), ROOF (roof covering), METAL (gates, metal sheet, gutters, flashings).
Rules: one region per continuous area of one material; a region continues across a floor line when the material does — do not split it at storeys, and do not join areas the picture separates. Sky, trees, ground, shadows, reflections and any watermark or logo are not materials: leave them out. Mark a region PARTLY_OCCLUDED where a tree or an object hides part of it, UNCERTAIN where you are unsure. uncertaintyPx is your honest edge error in pixels. hostHint is one of WALL, FRAME, BAND, SLAB, ROOF, OPENING, GATE.
At most 16 regions, at most 24 points per outline, each outline a simple polygon.
Return exactly: {"regions":[{"regionId":"r1","class":"TIMBER","outline":[[x,y],...],"visibility":"VISIBLE","uncertaintyPx":6,"hostHint":"WALL"}]}`

type LedgerEntry = { at: string; phase: string; house: string; variant: string; note: string; model: string; requestId: string; inputTokens: number; outputTokens: number; costUsd: number; reservedUsd: number }
type Ledger = { schema: string; currency: 'USD'; costBasis: 'USAGE_PRICED'; billing: 'NOT_RECONCILED_WITH_INVOICE'; openingUsd: number; ceilingUsd: number; openingNote: string; entries: LedgerEntry[]; totalUsd: number; requests: number }
const loadLedger = (): Ledger =>
  existsSync(LEDGER)
    ? (JSON.parse(readFileSync(LEDGER, 'utf8')) as Ledger)
    : { schema: 'buildapp.ai-spend-ledger.v35413', currency: 'USD', costBasis: 'USAGE_PRICED', billing: 'NOT_RECONCILED_WITH_INVOICE', openingUsd: OPENING_USD, ceilingUsd: CEILING_USD, openingNote: 'the cumulative books as v3.54.10 left them (v3.54.11 and v3.54.12 spent nothing); this ledger lists the v3.54.13 requests only; ceiling 24.11036 USD cumulative, not raised', entries: [], totalUsd: OPENING_USD, requests: 0 }
const saveLedger = (l: Ledger): void => writeFileSync(LEDGER, `${JSON.stringify(l, null, 1)}\n`)
const worstCase = (): number => (INPUT_BOUND_TOKENS * PRICE.inPerM + MAX_TOKENS * PRICE.outPerM) / 1e6

const argv = process.argv.slice(2)
const pictures = SIDES.map((s) => {
  const bytes = readFileSync(join(SCRATCH, s.file))
  const png = PNG.sync.read(bytes)
  return { ...s, bytes, w: png.width, h: png.height, sha: createHash('sha256').update(bytes).digest('hex') }
})
const plan = {
  schema: 'buildapp.v35413-live-plan/1',
  model: MODEL,
  promptVersion: PROMPT_VERSION,
  contract: `${APPEARANCE_OBSERVATION_SCHEMA} ${APPEARANCE_OBSERVATION_VERSION} (classes ${APPEARANCE_CLASSES.join(', ')})`,
  thinking: 'between_tools (no extended thinking), effort medium',
  maxTokensPerRequest: MAX_TOKENS,
  inputBoundTokensPerRequest: INPUT_BOUND_TOKENS,
  priceUsdPerMTok: PRICE,
  requests: `${SIDES.length} (one per original elevation) + at most ${MAX_REQUESTS - SIDES.length} retry in total`,
  worstCaseUsdPerRequest: Math.round(worstCase() * 1e6) / 1e6,
  worstCaseUsdTotal: Math.round(worstCase() * MAX_REQUESTS * 1e6) / 1e6,
  booksBefore: { spentUsd: OPENING_USD, ceilingUsd: CEILING_USD, leftUsd: Math.round((CEILING_USD - OPENING_USD) * 1e6) / 1e6 },
  sources: pictures.map((p) => ({ facade: p.facade, sourceByteHash: p.sourceByteHash, sentImageSha256: p.sha, size: `${p.w}x${p.h}`, note: 'the source variant decoded to PNG (same pixels), sent at its own size: no resize, no padding' })),
  system: SYSTEM,
  userTemplate: userText('{facade}', 0, 0).replace('0×0', '{W}×{H}'),
  safety: 'no code, SVG or markup from the reply is executed; only JSON numbers and enumerated strings are kept, validated against the contract; points outside the picture are refused',
}
writeFileSync(PLAN, `${stableJson(plan)}\n`)
process.stdout.write(`plan written: worst case ${plan.worstCaseUsdTotal} USD for ${MAX_REQUESTS} requests; ${plan.booksBefore.leftUsd} USD left\n`)
if (!argv.includes('--run')) process.exit(0)
if (plan.worstCaseUsdTotal > plan.booksBefore.leftUsd) throw new Error('the worst case does not fit the books: not run')

const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY ?? ''
if (!key) throw new Error('no key in the environment: no request sent')
mkdirSync(PRIVATE, { recursive: true })
const mod = (await import('@anthropic-ai/sdk')) as unknown as { default: new (o: { apiKey: string; maxRetries: number; timeout: number }) => { messages: { create(b: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number }; stop_reason: string; model: string; _request_id?: string | null }> } } }
const client = new mod.default({ apiKey: key, maxRetries: 0, timeout: 240_000 })
const ledger = loadLedger()
let sent = ledger.entries.length
let retriesLeft = MAX_REQUESTS - SIDES.length
const observations: AppearanceObservation[] = []
const scrub = (t: string): string => t.split(key).join('[key]')
for (const p of pictures) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (sent >= MAX_REQUESTS) throw new Error('request limit reached')
    const reserve = worstCase()
    if (ledger.totalUsd + reserve > CEILING_USD + 1e-9) throw new Error(`a reservation of ${reserve} USD would pass the ceiling: stopped`)
    const t0 = Date.now()
    let r
    try {
      r = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'between_tools' },
        output_config: { effort: 'medium' },
        system: SYSTEM,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: p.bytes.toString('base64') } }, { type: 'text', text: userText(p.facade, p.w, p.h) }] }],
      })
    } catch (e) {
      const status = (e as { status?: number }).status
      throw new Error(scrub(`request failed (${status ?? 'transport'}): ${(e as Error).message}`).slice(0, 300))
    }
    sent++
    const cost = (r.usage.input_tokens * PRICE.inPerM + r.usage.output_tokens * PRICE.outPerM) / 1e6
    ledger.entries.push({ at: new Date().toISOString(), phase: 'c-live', house: 'marcowki-ge', variant: `C-live ${p.facade}${attempt ? ' retry' : ''}`, note: `appearance contours (${PROMPT_VERSION}), ${Date.now() - t0} ms, stop ${r.stop_reason}`, model: r.model, requestId: r._request_id ?? `local:${createHash('sha256').update(`${p.sha}${attempt}`).digest('hex').slice(0, 16)}`, inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens, costUsd: Math.round(cost * 1e6) / 1e6, reservedUsd: Math.round(reserve * 1e6) / 1e6 })
    ledger.totalUsd = Math.round((OPENING_USD + ledger.entries.reduce((s, e) => s + e.costUsd, 0)) * 1e6) / 1e6
    ledger.requests = ledger.entries.length
    saveLedger(ledger)
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
    writeFileSync(join(PRIVATE, `raw-${p.facade}-${attempt}.json`), `${JSON.stringify({ stop: r.stop_reason, usage: r.usage, model: r.model, text }, null, 1)}\n`)
    try {
      if (r.stop_reason !== 'end_turn') throw new Error(`stop reason ${r.stop_reason}`)
      const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { regions: Array<Record<string, unknown>> }
      const regions = json.regions.map((x, i) => ({
        regionId: String(x.regionId ?? `r${i + 1}`).replace(/[^A-Za-z0-9_.:-]/g, '-'),
        class: x.class,
        outline: (x.outline as Array<[number, number]>).map(([a, b]) => [Number(a), Number(b)] as [number, number]),
        visibility: x.visibility ?? 'VISIBLE',
        uncertaintyPx: Number(x.uncertaintyPx ?? 8),
        ...(typeof x.hostHint === 'string' ? { hostHint: x.hostHint } : {}),
      }))
      const obs = parseAppearanceObservation({
        schema: APPEARANCE_OBSERVATION_SCHEMA,
        schemaVersion: APPEARANCE_OBSERVATION_VERSION,
        observationId: `c-live-${p.facade.toLowerCase()}-${p.sourceByteHash.slice(0, 12)}-${PROMPT_VERSION}`,
        facade: p.facade,
        source: { sourceByteHash: p.sourceByteHash, imageSha256: p.sha, imageWidth: p.w, imageHeight: p.h, sourceWidth: p.w, sourceHeight: p.h },
        toSource: [[1, 0, 0], [0, 1, 0]],
        toSourceWhy: 'the source elevation itself, sent at its own size (no resize, no padding)',
        regions,
        producer: { kind: 'API_CONTOUR_READING', version: PROMPT_VERSION, model: r.model, promptVersion: PROMPT_VERSION },
      })
      observations.push(obs)
      process.stdout.write(`${p.facade}: ${obs.regions.length} regions, ${r.usage.input_tokens} in / ${r.usage.output_tokens} out, ${cost.toFixed(6)} USD\n`)
      break
    } catch (e) {
      process.stdout.write(`${p.facade}: unusable reply (${(e as Error).message.slice(0, 160)})\n`)
      if (retriesLeft <= 0 || attempt === 1) break
      retriesLeft--
    }
  }
}
writeFileSync(join(PRIVATE, 'observations.json'), `${stableJson(observations)}\n`)
process.stdout.write(`books: ${ledger.totalUsd} of ${CEILING_USD} USD after ${ledger.requests} requests; ${observations.length} of ${SIDES.length} sides usable\n`)
