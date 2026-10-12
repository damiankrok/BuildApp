/**
 * reread.ts — BUILDPLAN-ANALYZER-005O M1b targeted crop re-read (RESEARCH ONLY; never imported by production).
 *
 *   npx vite-node research/analyzer-005o/reread.ts -- --cases research/analyzer-005o/cases.json \
 *       --index /home/user/work005o/byte-index.json --out /home/user/work005o/reread.json [--validate 40]
 *
 * For every statement (as `as_printed_views.py` defines it) whose token has NO numeric lattice — so no external
 * reading exists for it — the deployed PP-OCRv6 recogniser (`inlineRecogniser`, the pinned model and WASM, verified
 * against their manifest) reads the statement's own token crop, cut exactly as production cuts a label crop: the raster
 * decoded from the sealed bytes (`decodeImage`), every pass read by the frozen `readNumbers(raster, { hypotheses: true,
 * retainPasses: true })`, the raw token with the same page box and orientation, `labelCrop(field, passBox)`.
 * A reading is CORROBORATING by the frozen ensemble's own three tests (posterior and mean p ≥ 0.9, the top value the same
 * under all four bracket variants, the model's unconstrained answer equal to the digits) — `ensembleOf` without a lattice.
 *
 * `--validate N` first re-reads N statements that DO carry a sealed external reading and requires the re-read to equal
 * the sealed one exactly (top-K texts and posteriors, greedy text and mean p, every variant): the crop pipeline is the
 * production one, or M1b is not run. Timing: the session's load and every crop's read time are recorded.
 *
 * No pixel is written anywhere; the output holds numbers and texts only.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { decodeImage } from '@buildapp/source-package'
import { EXTERNAL_VARIANTS, OCR_ENSEMBLE_BOUNDS, dimensionValueOf, labelCrop, readNumbers } from '@buildapp/source-metrics'
import type { ExternalReading, LabelCrop, MetricEvidenceSet, TextToken } from '@buildapp/source-metrics'
import { bundledAssetPaths, inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'

const arg = (n: string, f?: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
type Case = { case: string; metrics: string }
const cases: Case[] = JSON.parse(readFileSync(arg('cases')!, 'utf8')).cases
const index: Record<string, string> = JSON.parse(readFileSync(arg('index')!, 'utf8'))
const validateN = Number(arg('validate', '40'))
const only = arg('only', '')

const key = (f: string, b: { x0: number; x1: number; y0: number; y1: number }, o?: string): string => [f, b.x0, b.x1, b.y0, b.y1, o ?? ''].join('|')
const digits = (t: string): string => t.replace(/[^0-9]/g, '')
const corroborating = (r: ExternalReading): { value?: number; confident: boolean; stable: boolean; heard: boolean } => {
  const top = r.topK[0]
  const text = top?.text ?? ''
  const confident = (top?.p ?? 0) >= OCR_ENSEMBLE_BOUNDS.posterior && r.greedy.meanP >= OCR_ENSEMBLE_BOUNDS.meanP
  const stable = r.stable && text !== '' && EXTERNAL_VARIANTS.every((v) => r.variants.some((x) => x.variant === v && x.top === text))
  const heard = text !== '' && r.greedy.text === text && digits(text) !== ''
  const value = dimensionValueOf(text)
  return { ...(value !== undefined ? { value } : {}), confident, stable, heard }
}

const reads = new Map<string, ReturnType<typeof readNumbers>>()
const readOf = (hash: string): ReturnType<typeof readNumbers> | undefined => {
  if (reads.has(hash)) return reads.get(hash)
  const path = index[hash]
  if (!path) return undefined
  const r = readNumbers(decodeImage(new Uint8Array(readFileSync(path))), { hypotheses: true, retainPasses: true })
  reads.set(hash, r)
  return r
}

type Job = { case: string; evidenceId: string; crop: LabelCrop; sealed?: ExternalReading }
const jobs: Job[] = []
const validation: Job[] = []
const missing: Array<{ case: string; evidenceId: string; why: string }> = []
for (const c of cases) {
  if (only && !only.split(',').includes(c.case)) continue
  const m: MetricEvidenceSet = JSON.parse(readFileSync(c.metrics, 'utf8'))
  const ev = new Map(m.evidence.map((e) => [e.id, e]))
  const tok = new Map(m.ocrTokens.map((t) => [t.id, t]))
  const lat = new Map((m.numericLattices ?? []).map((l) => [key(l.frameId, l.box, l.orientation), l]))
  const seen = new Set<string>()
  for (const chain of m.chains) {
    for (const s of chain.segments) {
      const e = s.evidenceId ? ev.get(s.evidenceId) : undefined
      if (!e || e.unit !== 'cm' || (e.origin !== 'READ' && e.origin !== 'CHAIN_CORRECTED') || e.ocrTokenIds.length !== 1 || seen.has(e.id)) continue
      seen.add(e.id)
      const t = tok.get(e.ocrTokenIds[0])
      if (!t) continue
      const l = lat.get(key(t.frameId, t.box, t.orientation))
      if (l && !l.external) continue
      if (l && validation.length >= validateN && l.external) continue
      const r = readOf(e.variantByteHash)
      if (!r || !r.passes) {
        missing.push({ case: c.case, evidenceId: e.id, why: 'raster not decodable from the sealed bytes' })
        continue
      }
      const orientation = (t.orientation ?? 'HORIZONTAL') as TextToken['orientation']
      const raw = (r.raw ?? r.tokens).find((x) => x.orientation === orientation && x.box.x0 === t.box.x0 && x.box.x1 === t.box.x1 && x.box.y0 === t.box.y0 && x.box.y1 === t.box.y1)
      const field = r.passes[orientation]
      if (!raw || !raw.passBox || !field) {
        missing.push({ case: c.case, evidenceId: e.id, why: raw ? 'no pass field for its orientation' : 'the frozen reader does not re-find this token on the decoded bytes' })
        continue
      }
      const job = { case: c.case, evidenceId: e.id, crop: labelCrop(`k${jobs.length + validation.length}`, field, raw.passBox), ...(l?.external ? { sealed: l.external as ExternalReading } : {}) }
      if (l?.external) validation.push(job)
      else jobs.push(job)
    }
  }
}

// `--asset-dir <dir>`: the shipped layout (models/ and the runtime beside it) — for a bundled run under Node 18
const assetDir = arg('asset-dir')
const recogniser = inlineRecogniser({ paths: assetDir ? bundledAssetPaths(assetDir) : workspaceAssetPaths() })
const t0 = performance.now()
const first = await recogniser.recognise(validation.length > 0 ? [validation[0].crop] : jobs.length > 0 ? [jobs[0].crop] : [])
const coldMs = performance.now() - t0
const readAll = async (list: Job[]): Promise<Array<{ job: Job; reading: ExternalReading; ms: number }>> => {
  const out = []
  for (const job of list) {
    const a = performance.now()
    const [reading] = await recogniser.recognise([job.crop])
    out.push({ job, reading, ms: performance.now() - a })
  }
  return out
}
const v = await readAll(validation)
// key order differs between a live reading and a sealed (stable-JSON) one: compare canonically
const canon = (x: unknown): string => JSON.stringify(x, (_, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1))) : val))
const mismatches = v.filter(({ job, reading }) => canon({ topK: reading.topK, greedy: reading.greedy, stable: reading.stable, variants: reading.variants }) !== canon({ topK: job.sealed!.topK, greedy: job.sealed!.greedy, stable: job.sealed!.stable, variants: job.sealed!.variants }))
const valid = validation.length > 0 && mismatches.length === 0
const r = valid ? await readAll(jobs) : []
await recogniser.release?.()
const ms = [...v, ...r].map((x) => x.ms).sort((a, b) => a - b)
const q = (p: number): number => (ms.length ? Math.round(ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] * 10) / 10 : 0)
const byCase: Record<string, Record<string, unknown>> = {}
for (const { job, reading } of r) {
  const c = corroborating(reading)
  ;(byCase[job.case] ??= {})[job.evidenceId] = { top: reading.topK[0]?.text ?? '', p: reading.topK[0]?.p ?? 0, greedy: reading.greedy, stable: reading.stable, ...c }
}
const out = {
  schema: 'buildapp.005o.reread',
  recogniser: { id: recogniser.id, model: recogniser.model, runtime: recogniser.runtime, runtimeSha256: recogniser.runtimeSha256 },
  node: process.version,
  validation: { asked: validateN, read: validation.length, mismatches: mismatches.map((x) => ({ case: x.job.case, evidenceId: x.job.evidenceId, reread: x.reading.topK[0], sealed: x.job.sealed!.topK[0] })), valid },
  timing: { coldFirstCropMs: Math.round(coldMs), warmPerCropMs: { n: ms.length, p50: q(0.5), p95: q(0.95), max: q(1) }, rssMb: Math.round(process.memoryUsage().rss / 1e6) },
  jobs: jobs.length,
  missing,
  // the view generator reads `byCase[case][evidenceId].value` when the reading corroborates
  byCase: Object.fromEntries(Object.entries(byCase).map(([c, m]) => [c, Object.fromEntries(Object.entries(m).map(([id, x]) => [id, x]))])),
  firstReadKeys: first.length,
}
writeFileSync(arg('out')!, `${JSON.stringify(out, null, 1)}\n`)
process.stdout.write(`validation ${validation.length} read, ${mismatches.length} mismatches -> ${valid ? 'VALID' : 'NOT VALID'}; re-read ${r.length}/${jobs.length}; missing ${missing.length}; cold ${Math.round(coldMs)} ms, warm p50 ${q(0.5)} p95 ${q(0.95)} ms\n`)
