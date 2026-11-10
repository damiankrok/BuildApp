/**
 * v3.53 S53-E1, arm B: one source package -> (triage of its pictures) -> one whole-house description -> the builder,
 * emitter, validator, compiler -> renders. The source package and the cached bytes are the ones arm A (the cascade)
 * read. No reference, no expected value and no page identity reaches the prompts: the reader gets numbered pictures
 * and the page's published figures, nothing else.
 *
 * vite-node describe-house.ts -- --package <source-package.json> --cache <dir> --out <dir> --model <id>
 *   [--triage-model <id>] [--effort <level>] [--ledger <spend-ledger.json>] [--replay] [--title]
 * `--replay`: no call; build again from the description already in <out>.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import jpeg from 'jpeg-js'
import { decodeImage, fileByteCache, startDecoders } from '@buildapp/source-package'
import { resampleRaster } from '@buildapp/source-cv'
import { HOUSE_DESCRIPTION_SYSTEM, HOUSE_DESCRIPTION_VERSION, buildHouseDescriptionPrompt, houseDescriptionJsonSchema } from '@buildapp/source-vision'
import type { PublishedFigure } from '@buildapp/source-vision'
import { ledgerGuard } from '../../ai-assist/spend-ledger.js'
import { claudeCodeMulti } from './cc-multi.js'
import type { NumberedImage } from './cc-multi.js'
import { buildDescribed } from './build-described.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`)

type Asset = { id: string; roles: Record<string, string>; selectedVariantId?: string; variants: Array<{ id: string; url: string; mediaType?: string; byteHash?: string }> }
type Kind = 'FLOOR_PLAN' | 'ELEVATION' | 'SECTION' | 'EXTERIOR_VIEW' | 'INTERIOR' | 'SITE_PLAN' | 'OTHER'

const TRIAGE_SYSTEM = 'You sort pictures from a house-plan web page by what they are. You answer only in the given vocabulary.'
const TRIAGE_PROMPT = (n: number): string =>
  [
    `You are given ${n} small pictures from one project page, each preceded by its number. For each say what it is:`,
    '- FLOOR_PLAN: an architectural plan of a storey seen from above (walls, rooms).',
    '- ELEVATION: a flat, orthographic drawing or flat render of one facade.',
    '- SECTION: a vertical cut through the building.',
    '- EXTERIOR_VIEW: a perspective picture, render or photo of the building from outside.',
    '- INTERIOR: a room seen from inside.',
    '- SITE_PLAN: the building on its plot, a roof plan or a location plan.',
    '- OTHER: logos, icons, adverts, people, maps, details, anything else.',
    '`duplicateOf`: the number of an EARLIER picture that shows the same picture (another size or crop of it), else 0.',
    'Answer for every picture, in order.',
  ].join('\n')
const TRIAGE_SCHEMA = { type: 'object', additionalProperties: false, required: ['pictures'], properties: { pictures: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['picture', 'kind', 'duplicateOf'], properties: { picture: { type: 'integer' }, kind: { type: 'string', enum: ['FLOOR_PLAN', 'ELEVATION', 'SECTION', 'EXTERIOR_VIEW', 'INTERIOR', 'SITE_PLAN', 'OTHER'] }, duplicateOf: { type: 'integer' } } } } } }

const fit = (w: number, h: number, max: number): { width: number; height: number } => {
  const k = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

async function main(): Promise<void> {
  const pkgPath = arg('package') as string
  const out = arg('out') as string
  const model = arg('model') ?? 'claude-sonnet-5-5'
  const triageModel = arg('triage-model') ?? 'claude-haiku-5-5'
  mkdirSync(out, { recursive: true })
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { canonicalUrl: string; assets: Asset[]; publishedFacts?: PublishedFigure[]; project?: { title?: string } }
  const published = (pkg.publishedFacts ?? []).filter((f) => typeof f.value === 'number')
  const descPath = join(out, 'description.json')
  if (flag('replay')) {
    const r = buildDescribed(JSON.parse(readFileSync(descPath, 'utf8')), out, 'described', published)
    console.log(JSON.stringify(r.summary))
    return
  }
  const cache = fileByteCache(arg('cache') as string)
  await startDecoders()
  const guard = ledgerGuard(arg('ledger') ?? 'research/ai-assist/spend-ledger.json', 'S53-E1 whole-house description')
  const calls: unknown[] = []
  const t0 = Date.now()

  // every asset's chosen variant, decoded once
  const decoded: Array<{ n: number; asset: Asset; raster: ReturnType<typeof decodeImage>; byteHash?: string }> = []
  const undecodable: Array<{ assetId: string; why: string }> = []
  for (const asset of pkg.assets) {
    const v = asset.variants.find((x) => x.id === asset.selectedVariantId) ?? asset.variants[0]
    const hit = v ? await cache.get(v.url) : null
    if (!v || !hit) {
      undecodable.push({ assetId: asset.id, why: 'bytes not in the cache' })
      continue
    }
    try {
      const raster = decodeImage(hit.bytes)
      if (Math.min(raster.width, raster.height) < 120) {
        undecodable.push({ assetId: asset.id, why: `${raster.width}x${raster.height}: an icon` })
        continue
      }
      decoded.push({ n: decoded.length + 1, asset, raster, byteHash: v.byteHash })
    } catch (e) {
      undecodable.push({ assetId: asset.id, why: (e as Error).message.slice(0, 120) })
    }
  }
  const toJpeg = (raster: ReturnType<typeof decodeImage>, max: number, quality: number): { bytes: Uint8Array; width: number; height: number } => {
    const size = fit(raster.width, raster.height, max)
    const r = resampleRaster(raster, size)
    // flatten transparency onto white: drawings are often transparent PNGs
    const data = Buffer.alloc(r.width * r.height * 4)
    for (let i = 0; i < r.width * r.height; i += 1) {
      const a = r.data[i * 4 + 3] / 255
      data[i * 4] = Math.round(r.data[i * 4] * a + 255 * (1 - a))
      data[i * 4 + 1] = Math.round(r.data[i * 4 + 1] * a + 255 * (1 - a))
      data[i * 4 + 2] = Math.round(r.data[i * 4 + 2] * a + 255 * (1 - a))
      data[i * 4 + 3] = 255
    }
    return { bytes: new Uint8Array(jpeg.encode({ data, width: r.width, height: r.height }, quality).data), width: r.width, height: r.height }
  }

  // --- triage: which pictures are this building's plans, elevations, section and exterior -------------------------
  let kinds = new Map<number, { kind: Kind; duplicateOf: number }>()
  const batches: Array<typeof decoded> = []
  for (let i = 0; i < decoded.length; i += 40) batches.push(decoded.slice(i, i + 40))
  for (const [bi, batch] of batches.entries()) {
    const thumbs: NumberedImage[] = batch.map((d) => ({ number: d.n, bytes: toJpeg(d.raster, 320, 70).bytes, mediaType: 'image/jpeg' }))
    const { output, call } = await claudeCodeMulti({ model: triageModel, system: TRIAGE_SYSTEM, images: thumbs, text: TRIAGE_PROMPT(batch.length), schema: TRIAGE_SCHEMA, capUsd: 0.08, guard, what: `triage ${bi + 1}/${batches.length} ${out}` })
    calls.push({ step: 'triage', batch: bi + 1, ...call, raw: undefined })
    for (const p of (output as { pictures: Array<{ picture: number; kind: Kind; duplicateOf: number }> }).pictures) kinds.set(p.picture, { kind: p.kind, duplicateOf: p.duplicateOf })
  }
  kinds = new Map([...kinds].filter(([n]) => decoded.some((d) => d.n === n)))
  const area = (d: (typeof decoded)[number]): number => d.raster.width * d.raster.height
  const pick = (kind: Kind, max: number): typeof decoded => decoded.filter((d) => kinds.get(d.n)?.kind === kind && !(kinds.get(d.n)?.duplicateOf ?? 0)).sort((a, b) => area(b) - area(a)).slice(0, max)
  const chosen = [...pick('FLOOR_PLAN', 4), ...pick('ELEVATION', 6), ...pick('SECTION', 1), ...pick('SITE_PLAN', 1), ...pick('EXTERIOR_VIEW', 4)].sort((a, b) => a.n - b.n)
  writeFileSync(join(out, 'triage.json'), JSON.stringify({ decoded: decoded.map((d) => ({ n: d.n, assetId: d.asset.id, size: `${d.raster.width}x${d.raster.height}`, byteHash: d.byteHash, packageRoles: d.asset.roles, triage: kinds.get(d.n) ?? null })), undecodable, chosen: chosen.map((d) => d.n) }, null, 1))
  if (chosen.length === 0) {
    writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'NO_USABLE_PICTURE', calls }, null, 1))
    console.log(JSON.stringify({ outcome: 'NO_USABLE_PICTURE' }))
    return
  }

  // --- the description: one request over the chosen pictures, renumbered 1..k ----------------------------------------
  const sent = chosen.map((d, i) => {
    const kind = kinds.get(d.n)?.kind
    const j = toJpeg(d.raster, kind === 'EXTERIOR_VIEW' ? 1100 : 1568, 88)
    return { number: i + 1, n: d.n, assetId: d.asset.id, byteHash: d.byteHash, ...j }
  })
  // the exact bytes the reader is sent, kept beside the run (private: publisher pictures never go to Git)
  for (const x of sent) writeFileSync(join(out, `sent-${String(x.number).padStart(2, '0')}.jpg`), x.bytes)
  const prompt = buildHouseDescriptionPrompt({ images: sent.map((s) => ({ number: s.number, widthPx: s.width, heightPx: s.height })), published, ...(flag('title') && pkg.project?.title ? { pageTitle: pkg.project.title } : {}) })
  let description: unknown
  try {
    const { output, call } = await claudeCodeMulti({ model, system: HOUSE_DESCRIPTION_SYSTEM, images: sent.map((s) => ({ number: s.number, bytes: s.bytes, mediaType: 'image/jpeg' })), text: prompt, schema: houseDescriptionJsonSchema(), capUsd: Number(arg('cap') ?? 0.7), ...(arg('effort') ? { effort: arg('effort') as string } : {}), guard, what: `describe ${model} ${out}` })
    calls.push({ step: 'describe', ...call, raw: undefined })
    description = output
  } catch (e) {
    calls.push({ step: 'describe', ...((e as { call?: object }).call ?? {}), error: (e as Error).message })
    writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: 'DESCRIBE_FAILED', error: (e as Error).message, calls }, null, 1))
    console.log(JSON.stringify({ outcome: 'DESCRIBE_FAILED', error: (e as Error).message }))
    return
  }
  writeFileSync(descPath, JSON.stringify(description, null, 1))
  const readMs = Date.now() - t0
  const built = buildDescribed(description, out, 'described', published)
  const cost = (calls as Array<{ estimatedCostUsd?: number | null }>).reduce((s, c) => s + (c.estimatedCostUsd ?? 0), 0)
  writeFileSync(join(out, 'run.json'), JSON.stringify({ outcome: built.ok ? 'MODEL' : 'NO_MODEL', url: pkg.canonicalUrl, model, triageModel, descriptionVersion: HOUSE_DESCRIPTION_VERSION, picturesSent: sent.map((s) => ({ number: s.number, n: s.n, assetId: s.assetId, byteHash: s.byteHash, size: `${s.width}x${s.height}`, triage: kinds.get(s.n)?.kind })), readMs, totalMs: Date.now() - t0, estimatedCostUsd: cost, calls, summary: built.summary }, null, 1))
  console.log(JSON.stringify({ outcome: built.ok ? 'MODEL' : 'NO_MODEL', readMs, cost, summary: built.summary }).slice(0, 3000))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
