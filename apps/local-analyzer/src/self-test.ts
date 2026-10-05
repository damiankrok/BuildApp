/**
 * The OCR parity self-test (BUILDPLAN-ANALYZER-005H): the external recogniser, exactly as an analysis runs it — the
 * bundle's worker, its ONNX Runtime WebAssembly and its pinned model — over a fixed synthetic corpus, answered as a
 * few hashes a person can compare with the desktop's.
 *
 *   node main.mjs --self-test ocr --job <32 hex> --out <dir> [--events-fd <n>] [--control-fd <n>]
 *
 * The corpus is drawn here, on the device, from our own stroke faces (`@buildapp/synthetic-drawings/ocr-corpus`):
 * every seventh of the 672 labels 005G measured, 96 labels, never a publisher's pixel. Its hash says the device drew
 * the same pixels; the output hash says the recogniser read them the same way — greedy text, mean probability, top-K
 * strings and posteriors (six decimals), the stability flag and every bracket variant's top value, per label.
 * Two devices with the same three hashes ran the same reader on the same input and got the same answer.
 *
 * Events: `self-test-progress` per label, then `self-test` (the compact record, also written to
 * `<out>/self-test.json`) or `failed` / `cancelled`. It fetches nothing and writes nothing else.
 *
 * It ships as its own bundle (`ocr-self-test.mjs`, from `self-test-entry.ts`), which `main.mjs` loads only for
 * `--self-test`: the synthetic corpus it draws is never part of the analyzer a phone runs on a project.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { arch, platform } from 'node:os'
import { join } from 'node:path'
import { cropForToken } from '@buildapp/source-metrics/recogniser'
import type { ExternalReading, LabelCrop, LabelRecogniser } from '@buildapp/source-metrics/recogniser'
import { ocrBakeoffCorpus, renderLabel } from '@buildapp/synthetic-drawings/ocr-corpus'
import { memorySample } from './memory.js'
import { eventSink, listenForCancel } from './pipes.js'
import expectedJson from './self-test-expected.json'

/** The desktop's answer, committed: what a device must reproduce (`self-test-expected.json`). */
export const OCR_PARITY_EXPECTED = expectedJson as { recogniser: string; modelSha256: string; wasmSha256: string; corpusSha256: string; outputSha256: string; exact: number; labels: number }

/** The corpus, named and versioned: a different stride or generator is a different corpus. */
export const OCR_PARITY_CORPUS = { name: 'buildapp.ocr-parity-corpus', version: 1, of: 672, stride: 7 } as const

export type ParityLabel = LabelCrop & { printed: string }

/** The parity corpus: every `stride`-th label of the 672, drawn and cut at its own box (the recogniser's crop rule). */
export function parityCorpus(): ParityLabel[] {
  return ocrBakeoffCorpus()
    .filter((_, i) => i % OCR_PARITY_CORPUS.stride === 0)
    .map((s) => {
      const r = renderLabel(s.text, s.style)
      const n = r.raster.width * r.raster.height
      const gray = { width: r.raster.width, height: r.raster.height, data: new Uint8ClampedArray(n) }
      for (let i = 0; i < n; i += 1) gray.data[i] = r.raster.data[i * 4]
      return { key: s.id, gray: cropForToken(gray, r.box), capPx: Math.max(1, Math.round(r.box.y1 - r.box.y0)), printed: s.text }
    })
}

const sha256 = (h: ReturnType<typeof createHash>): string => h.digest('hex')

/** The crops' pixels, by key, size and bytes. */
export function cropsHash(crops: readonly LabelCrop[]): string {
  const h = createHash('sha256')
  for (const c of crops) h.update(`${c.key}|${c.gray.width}x${c.gray.height}|`).update(Buffer.from(c.gray.data.buffer, c.gray.data.byteOffset, c.gray.data.byteLength))
  return sha256(h)
}

/** One reading as the parity record holds it: rounded to six decimals, every field that could differ between runtimes. */
export const readingLine = (r: ExternalReading): string =>
  [r.key, r.greedy.text, r.greedy.meanP.toFixed(6), r.topK.map((c) => `${c.text}:${c.p.toFixed(6)}`).join(','), r.stable ? 'STABLE' : 'UNSTABLE', r.variants.map((v) => `${v.variant}=${v.top}`).join(',')].join('|')

export const readingsHash = (readings: readonly ExternalReading[]): string => sha256(createHash('sha256').update(readings.map(readingLine).join('\n')))

export type SelfTestRecord = {
  kind: 'ocr-parity'
  recogniser: { id: string; modelSha256: string; runtime: string }
  wasmSha256: string | null
  corpus: { name: string; version: number; labels: number; sha256: string }
  outputSha256: string
  /** Labels whose top reading is the printed value — on the corpus 005G chose its policy on: a parity count, not an accuracy. */
  exact: number
  /** `drawMs`: drawing the corpus on the device (a 4×4-supersampled stroke renderer); `totalMs`: the recogniser's batch alone. */
  timing: { drawMs: number; totalMs: number; loadMs: number | null; perLabelMeanMs: number; perLabelP95Ms: number }
  peakRssBytes: number
  runtime: { node: string; v8: string; arch: string; platform: string }
  /**
   * Against the desktop's committed answer: MATCH when the recogniser, model, runtime binary (hashed here — unknown is
   * not equal), corpus and output all equal it; CORPUS_DIFFERS when this device drew other pixels (then the output says nothing about the reader);
   * MISMATCH otherwise.
   */
  parity: 'MATCH' | 'MISMATCH' | 'CORPUS_DIFFERS'
  expected: { corpusSha256: string; outputSha256: string }
}

/** Run the corpus through a recogniser. `wasmPath`, when given, is hashed as it lies on disk. */
export async function ocrSelfTest(recogniser: LabelRecogniser & { stats?: () => unknown[] }, options: { wasmPath?: string; signal?: AbortSignal; onProgress?: (done: number, total: number) => void; clock?: () => number } = {}): Promise<SelfTestRecord & { readings: ExternalReading[] }> {
  const clock = options.clock ?? (() => performance.now())
  const drawing = clock()
  const corpus = parityCorpus()
  const drawMs = Math.round(clock() - drawing)
  const started = clock()
  const readings = await recogniser.recognise(corpus, { signal: options.signal, onProgress: options.onProgress })
  const totalMs = Math.round(clock() - started)
  const byKey = new Map(readings.map((r) => [r.key, r]))
  const ordered = corpus.flatMap((c) => byKey.get(c.key) ?? [])
  const stats = (recogniser.stats?.() ?? []) as Array<{ loadMs?: number; perCropMs?: number[] }>
  const last = stats[stats.length - 1]
  const per = [...(last?.perCropMs ?? [])].sort((a, b) => a - b)
  let wasmSha256: string | null = null
  if (options.wasmPath) {
    try {
      wasmSha256 = createHash('sha256').update(readFileSync(options.wasmPath)).digest('hex')
    } catch {
      wasmSha256 = null
    }
  }
  const corpusSha256 = cropsHash(corpus)
  const outputSha256 = readingsHash(ordered)
  const E = OCR_PARITY_EXPECTED
  // MATCH needs every hash known and equal: a WebAssembly binary this test could not hash is not the desktop's (red team B3)
  const parity = corpusSha256 !== E.corpusSha256 ? 'CORPUS_DIFFERS' : outputSha256 === E.outputSha256 && recogniser.id === E.recogniser && recogniser.model.sha256 === E.modelSha256 && wasmSha256 === E.wasmSha256 ? 'MATCH' : 'MISMATCH'
  return {
    kind: 'ocr-parity',
    recogniser: { id: recogniser.id, modelSha256: recogniser.model.sha256, runtime: recogniser.runtime },
    wasmSha256,
    corpus: { name: OCR_PARITY_CORPUS.name, version: OCR_PARITY_CORPUS.version, labels: corpus.length, sha256: corpusSha256 },
    outputSha256,
    exact: corpus.filter((c) => byKey.get(c.key)?.topK[0]?.text === c.printed).length,
    timing: { drawMs, totalMs, loadMs: last?.loadMs ?? null, perLabelMeanMs: per.length ? Math.round(per.reduce((a, b) => a + b, 0) / per.length) : 0, perLabelP95Ms: per.length ? per[Math.min(per.length - 1, Math.floor(per.length * 0.95))] : 0 },
    peakRssBytes: memorySample().peakRssBytes,
    runtime: { node: process.version, v8: process.versions.v8, arch: arch(), platform: platform() },
    parity,
    expected: { corpusSha256: E.corpusSha256, outputSha256: E.outputSha256 },
    readings: ordered,
  }
}

/** Write the record where the app reads it: `<out>/self-test.json`, atomically. */
export async function writeSelfTest(outDir: string, record: SelfTestRecord): Promise<void> {
  await mkdir(outDir, { recursive: true })
  const target = join(outDir, 'self-test.json')
  await writeFile(`${target}.partial`, `${JSON.stringify(record, null, 2)}\n`)
  await rename(`${target}.partial`, target)
}

export type SelfTestEvent =
  | { type: 'self-test-progress'; done: number; total: number; elapsedMs: number; rssBytes: number }
  | { type: 'self-test'; record: SelfTestRecord }
  | { type: 'failed'; code: 'BAD_ARGUMENTS' | 'NO_RECOGNISER' | 'SELF_TEST_FAILED'; message: string }
  | { type: 'cancelled' }

const JOB_ID = /^[0-9a-f]{32}$/

/**
 * The self-test as a program (`main.mjs --self-test ocr …`): the same pipes and the same cancel as an analysis, no URL,
 * no fetch. Resolves to the exit code (0 done, 1 failed, 2 cancelled, 3 bad arguments); never throws.
 */
export async function runSelfTestProgram(argv: readonly string[], recogniser: (() => LabelRecogniser & { stats?: () => unknown[]; release?: () => Promise<void> }) | undefined, options: { wasmPath?: string } = {}): Promise<number> {
  const value = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
  }
  const fd = (name: string): number | null => {
    const v = value(name)
    return v === undefined || !Number.isInteger(Number(v)) || Number(v) < 0 ? null : Number(v)
  }
  const sink = eventSink<SelfTestEvent>(fd('events-fd'))
  const jobId = value('job') ?? ''
  const outDir = value('out') ?? ''
  if (value('self-test') !== 'ocr' || !JOB_ID.test(jobId) || !outDir.startsWith('/')) {
    sink.emit({ type: 'failed', code: 'BAD_ARGUMENTS', message: '--self-test ocr needs --job <32 hex> and an absolute --out' })
    return 3
  }
  const started = performance.now()
  const controller = new AbortController()
  const stopListening = listenForCancel(fd('control-fd'), controller)
  const reader = recogniser?.()
  try {
    if (!reader) {
      sink.emit({ type: 'failed', code: 'NO_RECOGNISER', message: 'this runtime ships no external recogniser' })
      return 1
    }
    const { readings: _readings, ...record } = await ocrSelfTest(reader, {
      wasmPath: options.wasmPath,
      signal: controller.signal,
      onProgress: (done, total) => sink.emitBestEffort({ type: 'self-test-progress', done, total, elapsedMs: Math.round(performance.now() - started), rssBytes: process.memoryUsage.rss() }),
    })
    await writeSelfTest(outDir, record)
    sink.emit({ type: 'self-test', record })
    return 0
  } catch (error) {
    if (controller.signal.aborted) {
      sink.emit({ type: 'cancelled' })
      return 2
    }
    sink.emit({ type: 'failed', code: 'SELF_TEST_FAILED', message: `the OCR self-test failed: ${(error as Error).message}` })
    return 1
  } finally {
    stopListening()
    await reader?.release?.()
  }
}
