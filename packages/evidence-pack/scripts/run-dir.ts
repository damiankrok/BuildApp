/**
 * Reading one analyzer run's directory into a `RunRecord`, and writing a pack (Node only).
 *
 * The directory is what `analysis:second-house` writes. The preview is the run's own render of
 * the model (`scene-views.png`), downscaled to the pack's bound — an analyzer picture, never a
 * publisher's. Plan overlays (which draw over the publisher's raster) are never read.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { EVIDENCE_PACK_VERSION, PACK_BOUNDS, buildEvidencePack } from '../src/index.js'
import type { EvidencePack, RunRecord } from '../src/index.js'

const readJson = <T>(dir: string, name: string): T | undefined => (existsSync(join(dir, name)) ? (JSON.parse(readFileSync(join(dir, name), 'utf8')) as T) : undefined)

/** The analyzer's own render, at most `previewWidth` wide, nearest-neighbour: small, deterministic, ours. */
export function boundedPreview(file: string): Uint8Array | undefined {
  if (!existsSync(file)) return undefined
  const src = PNG.sync.read(readFileSync(file))
  const k = Math.max(1, Math.ceil(src.width / PACK_BOUNDS.previewWidth))
  const out = new PNG({ width: Math.floor(src.width / k), height: Math.floor(src.height / k) })
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const si = ((y * k) * src.width + x * k) * 4
      const di = (y * out.width + x) * 4
      for (let c = 0; c < 4; c += 1) out.data[di + c] = src.data[si + c]
    }
  }
  return new Uint8Array(PNG.sync.write(out, { colorType: 6 }))
}

/** The versions a run declared about itself, plus (optionally) the code's own. */
export function versionsOfRun(record: Omit<RunRecord, 'provenance'>, extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of record.metrics?.extractors ?? []) out[e.name] = e.version
  if (record.metrics?.schemaVersion) out['metric-evidence-schema'] = record.metrics.schemaVersion
  if (record.pkg.adapter) out[`adapter:${record.pkg.adapter.id}`] = record.pkg.adapter.version
  for (const [k, v] of Object.entries(record.summary?.analyzer ?? {})) out[`analyzer-${k}`] = String(v)
  const resolver = record.trace?.entries?.map((e) => e.counts?.resolverVersion).find((v) => v !== undefined)
  if (resolver !== undefined) out['plan-resolver'] = String(resolver)
  return { ...out, ...extra }
}

export function readRunDir(dir: string, runId: string, provenance: { gitSha?: string; versions?: Record<string, string> } = {}): RunRecord {
  const pkg = readJson<RunRecord['pkg']>(dir, 'source-package.json')
  if (!pkg) throw new Error(`${dir}: no source-package.json — not a run directory`)
  const base: Omit<RunRecord, 'provenance'> = {
    runId,
    pkg,
    metrics: readJson(dir, 'metric-evidence.json'),
    digest: readJson(dir, 'plan-diagnostics/digest.json'),
    trace: readJson(dir, 'analysis-trace.json'),
    summary: readJson(dir, 'result-summary.json'),
    failure: readJson(dir, 'failure.json'),
    model: readJson(dir, 'model.json'),
    performance: readJson(dir, 'performance.json'),
    preview: boundedPreview(join(dir, 'scene-views.png')),
  }
  return { ...base, provenance: { gitSha: provenance.gitSha, versions: versionsOfRun(base, provenance.versions), evidenceModeVersion: EVIDENCE_PACK_VERSION } }
}

/** Write a pack to a directory (replacing what was there): every file, and nothing else. */
export function writePack(pack: EvidencePack, out: string): void {
  if (existsSync(out)) rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const [name, content] of pack.files) writeFileSync(join(out, name), content)
}

export function packRunDir(dir: string, out: string, runId: string, provenance: { gitSha?: string; versions?: Record<string, string> } = {}): { pack: EvidencePack; ms: number } {
  const t0 = performance.now()
  const pack = buildEvidencePack(readRunDir(dir, runId, provenance))
  writePack(pack, out)
  return { pack, ms: Math.round(performance.now() - t0) }
}
