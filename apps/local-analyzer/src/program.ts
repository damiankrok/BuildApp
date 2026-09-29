/**
 * The local analyzer as a PROGRAM: what the app's embedded Node runtime runs,
 * one job per process.
 *
 *   node main.mjs --job <32 hex> --url <https://…> --work <dir> --out <dir>
 *                 [--events-fd <n>] [--control-fd <n>]
 *
 * The Android app starts the runtime in a process of its own (`:analyzer`) and
 * talks to this program over two pipes it creates and hands over by number —
 * no socket, no port, no HTTP between the app and the analyzer:
 *
 *  - **events** (`--events-fd`, else stdout): one JSON object per line —
 *    `hello` (runtime facts), `progress` (the pipeline's own stage event plus
 *    the elapsed time and resident memory), `telemetry` (protocol 3: the phase,
 *    its counts and a heartbeat from inside the long loops, at most once a
 *    second), then exactly one of `done`, `failed` or `cancelled`. Written
 *    synchronously, so a report made in the middle of a long synchronous stage
 *    reaches the app when it is made; a telemetry line the app is too slow to
 *    take is dropped rather than waited for.
 *  - **control** (`--control-fd`): a line `cancel` aborts the run; the pipe
 *    closing does too (the app went away). Since protocol 3 the pipe is also
 *    polled from inside the long loops, so a cancel is honoured within a
 *    fraction of a second even while the analyzer computes.
 *
 * On `done`, the four delivery files are in `--out`, each written to a
 * temporary name and renamed into place: `result.json` (the summary, whose
 * `sceneSha256` names `scene.json`'s exact bytes), `scene.json`, `model.json`,
 * `candidate.json`. The source bytes never leave `--work/bytes`, which is
 * removed before any terminal event is written.
 */
import { readSync, writeSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, totalmem } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { Socket } from 'node:net'
import { ANALYSIS_SERVICE_VERSION, AnalysisError, toAnalysisError } from '@buildapp/analysis-service'
import type { AnalysisErrorCode, AnalysisFailure, AnalysisProgress, AnalysisTelemetry, AnalysisTimings, AnalysisTrace, DiagnosticsBundle, LinkAnalysisSummary, PhaseStats } from '@buildapp/analysis-service'
import { stableJson } from '@buildapp/source-common'
import { SOLVER_V2_VERSION } from '@buildapp/reconstruction'
import { selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { runLocalAnalysis } from './local.js'
import type { LocalWiring } from './local.js'
import { memorySample } from './memory.js'
import type { MemorySample } from './memory.js'
import { installTextAdapter, textRefusal } from './text.js'
import type { TextSupport } from './text.js'

/**
 * Bumped when the event or argument shape changes; the app refuses a runtime that speaks another.
 * 2 (BUILDAPP-03Y2G): `failed` carries the structured failure and names its diagnostics files; every
 * terminal event names the run's `trace.json`.
 * 3 (BUILDPLAN-ANALYZER-005A): `telemetry` events from inside the long loops, so silence now means
 * something (the app may call it a stall); cancel polled during computation; every terminal event
 * carries what each phase cost.
 */
export const LOCAL_ANALYZER_PROTOCOL = 3 as const

/** What this runtime can do beyond its protocol, for additive changes that need no protocol bump. */
export const LOCAL_ANALYZER_CAPABILITIES = ['telemetry.v1', 'control.poll'] as const

export const OUTPUT_FILES = { summary: 'result.json', scene: 'scene.json', model: 'model.json', candidate: 'candidate.json' } as const

/**
 * What a run leaves in `--out/diagnostics` besides its delivery files: the
 * trace always, and on a failure the diagnostics and the plan overlay. The app
 * keeps these after it removes the job's folder, so a phone failure can be
 * shared without a cable.
 */
export const DIAGNOSTICS_DIR = 'diagnostics' as const
export const DIAGNOSTICS_FILES = { trace: 'trace.json', diagnostics: 'diagnostics.json', overlay: 'plan-overlay.png', performance: 'performance.json' } as const

/** Bounds on what a failure leaves behind, so a bundle is always small enough to keep and to share. */
export const DIAGNOSTICS_LIMITS = { jsonBytes: 1_500_000, overlayBytes: 1_500_000 } as const

export type DiagnosticsFiles = { dir: typeof DIAGNOSTICS_DIR; files: string[]; bytes: number }

export type ProgramArgs = { jobId: string; url: string; workDir: string; outDir: string; eventsFd: number | null; controlFd: number | null }

export type RuntimeFacts = {
  node: string
  v8: string
  icu: string | null
  /** 'icu' where the runtime's own ICU is used; 'embedded-tables' where src/text.ts stands in for it (Android). */
  text: TextSupport
  platform: string
  arch: string
  cpus: number
  totalMemoryBytes: number
  collatorLocale: string
}

/**
 * Which bytes the run read, by hash only — never the bytes. Two runs that list
 * the same hashes read the same drawings, which is what lets a run on a phone
 * be compared with a run on a desktop from the same sources.
 */
export type SourceHashes = { packageHash: string; pageHash: string; assets: Array<{ id: string; document: string; byteHash: string }> }

export const sourceHashesOf = (pkg: SourcePackage): SourceHashes => ({
  packageHash: pkg.contentHash,
  pageHash: pkg.pageHash,
  assets: pkg.assets.map((a) => ({ id: a.id, document: a.roles.document, byteHash: selectedVariant(a).byteHash })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
})

export type RunMetrics = {
  elapsedMs: number
  memory: MemorySample
  timings?: AnalysisTimings
  sceneBytes?: number
  /** What each phase cost and its longest silence (protocol 3); on failures too, so a failing phone run carries its timings. */
  phases?: Array<{ phaseId: string; durationMs: number; maxTickGapMs: number; workDone: number; workTotal: number | null }>
}

export type LocalAnalyzerEvent =
  | { type: 'hello'; protocol: typeof LOCAL_ANALYZER_PROTOCOL; capabilities: readonly string[]; jobId: string; pid: number; runtime: RuntimeFacts; analyzer: { service: string; solver: string } }
  | { type: 'progress'; event: AnalysisProgress; elapsedMs: number; rssBytes: number }
  | { type: 'telemetry'; event: AnalysisTelemetry; rssBytes: number }
  | { type: 'done'; summary: LinkAnalysisSummary; files: typeof OUTPUT_FILES; metrics: RunMetrics; sources: SourceHashes; diagnostics?: DiagnosticsFiles }
  | { type: 'failed'; code: AnalysisErrorCode | 'BAD_ARGUMENTS' | 'OUTPUT_FAILED' | 'TEXT_NOT_SUPPORTED_ON_DEVICE'; message: string; metrics: RunMetrics; failure?: AnalysisFailure; diagnostics?: DiagnosticsFiles }
  | { type: 'cancelled'; metrics: RunMetrics; diagnostics?: DiagnosticsFiles }

export const EXIT = { DONE: 0, FAILED: 1, CANCELLED: 2, BAD_ARGUMENTS: 3 } as const

const JOB_ID = /^[0-9a-f]{32}$/

const PAUSE = new Int32Array(new SharedArrayBuffer(4))

export class ProgramArgsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProgramArgsError'
  }
}

export function parseProgramArgs(argv: readonly string[]): ProgramArgs {
  const value = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
  }
  const required = (name: string): string => {
    const v = value(name)
    if (v === undefined || v === '') throw new ProgramArgsError(`--${name} is required`)
    return v
  }
  const fd = (name: string): number | null => {
    const v = value(name)
    if (v === undefined) return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0) throw new ProgramArgsError(`--${name} must be a file descriptor number`)
    return n
  }
  const jobId = required('job')
  if (!JOB_ID.test(jobId)) throw new ProgramArgsError('--job must be 32 lowercase hex characters')
  const workDir = required('work')
  const outDir = required('out')
  if (!isAbsolute(workDir) || !isAbsolute(outDir)) throw new ProgramArgsError('--work and --out must be absolute paths')
  return { jobId, url: required('url'), workDir, outDir, eventsFd: fd('events-fd'), controlFd: fd('control-fd') }
}

/** Facts about the runtime, for the record. A probe that fails reports a blank; it never fails the run. */
export function runtimeFacts(text: TextSupport): RuntimeFacts {
  const probe = <T>(read: () => T, fallback: T): T => {
    try {
      return read()
    } catch {
      return fallback
    }
  }
  return {
    node: process.version,
    v8: process.versions.v8,
    icu: process.versions.icu ?? null,
    text,
    platform: probe(() => platform(), ''),
    arch: probe(() => arch(), ''),
    cpus: probe(() => cpus().length, 0),
    totalMemoryBytes: probe(() => totalmem(), 0),
    // Android's nodejs-mobile has no Intl at all
    collatorLocale: probe(() => (typeof Intl === 'undefined' ? 'none (no Intl)' : new Intl.Collator().resolvedOptions().locale), ''),
  }
}

async function writeAtomically(dir: string, name: string, text: string): Promise<void> {
  const target = join(dir, name)
  const temporary = `${target}.partial`
  await writeFile(temporary, text)
  await rename(temporary, target)
}

/**
 * Where events go: a file descriptor the app handed over, or this process's
 * stdout. The descriptor stays the app's: it is never closed here, because the
 * app closes it itself once the runtime has returned, and that close is what
 * tells its reader the program is over.
 */
function eventSink(fd: number | null): { emit: (event: LocalAnalyzerEvent) => void; emitBestEffort: (event: LocalAnalyzerEvent) => void } {
  if (fd === null) {
    const write = (event: LocalAnalyzerEvent): void => void process.stdout.write(`${JSON.stringify(event)}\n`)
    return { emit: write, emitBestEffort: write }
  }
  const writeFrom = (line: Buffer, from: number): void => {
    let at = from
    while (at < line.length) {
      try {
        at += writeSync(fd, line, at, line.length - at)
      } catch (error) {
        // a non-blocking descriptor whose buffer is full: wait a moment and write the rest
        if ((error as NodeJS.ErrnoException).code !== 'EAGAIN') throw error
        Atomics.wait(PAUSE, 0, 0, 2)
      }
    }
  }
  return {
    emit: (event) => writeFrom(Buffer.from(`${JSON.stringify(event)}\n`, 'utf8'), 0),
    // A heartbeat the app is too slow to take is dropped, never waited for: a stalled reader must
    // not stall the analysis. A line once started is finished, so the app never sees half of one.
    emitBestEffort: (event) => {
      const line = Buffer.from(`${JSON.stringify(event)}\n`, 'utf8')
      let first: number
      try {
        first = writeSync(fd, line, 0, line.length)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EAGAIN') return
        throw error
      }
      if (first < line.length) writeFrom(line, first)
    },
  }
}

/**
 * The control pipe, read from inside the analysis's own loops. A computing
 * stage never yields to the event loop, so the socket below never sees a
 * `cancel` written while the analyzer computes; this reads the same pipe
 * without waiting (it is non-blocking since the socket opened it) and aborts
 * the run itself. Whichever reader takes the bytes, the run is cancelled.
 */
function controlPoller(fd: number | null, controller: AbortController): () => boolean {
  if (fd === null) return () => controller.signal.aborted
  const buffer = Buffer.alloc(64)
  let text = ''
  const cancel = (): true => {
    if (!controller.signal.aborted) controller.abort(new DOMException('the analysis was cancelled', 'AbortError'))
    return true
  }
  return () => {
    if (controller.signal.aborted) return true
    let n: number
    try {
      n = readSync(fd, buffer, 0, buffer.length, null)
    } catch (error) {
      // nothing written yet: carry on
      if ((error as NodeJS.ErrnoException).code === 'EAGAIN') return false
      return cancel()
    }
    // the app closed its end: it went away
    if (n === 0) return cancel()
    text = (text + buffer.toString('utf8', 0, n)).slice(-64)
    return text.split('\n').some((line) => line.trim() === 'cancel') ? cancel() : false
  }
}

/** A `cancel` line, or the pipe closing, aborts the run. Returns a function that stops listening. */
function listenForCancel(fd: number | null, controller: AbortController): () => void {
  if (fd === null) return () => undefined
  const socket = new Socket({ fd, readable: true, writable: false })
  let text = ''
  const cancel = (): void => {
    if (!controller.signal.aborted) controller.abort(new DOMException('the analysis was cancelled', 'AbortError'))
  }
  socket.on('data', (chunk: Buffer) => {
    text += chunk.toString('utf8')
    if (text.split('\n').some((line) => line.trim() === 'cancel')) cancel()
    text = text.slice(-64)
  })
  socket.on('end', cancel)
  socket.on('error', cancel)
  return () => socket.destroy()
}

/** The diagnostics as written: the plan digest is dropped before the bundle is allowed to grow past its bound. */
function boundedJson(value: unknown, limit: number, trim: () => unknown): string {
  const text = `${stableJson(value)}\n`
  if (Buffer.byteLength(text, 'utf8') <= limit) return text
  return `${stableJson(trim())}\n`
}

/**
 * Write the run's trace and, when there is one, its diagnostics bundle into
 * `--out/diagnostics`. Never throws: a diagnostics file that cannot be written
 * is a diagnostics file the app does not get, and the run's outcome stands.
 */
async function writeDiagnostics(outDir: string, trace: AnalysisTrace | undefined, bundle: DiagnosticsBundle | undefined, extra: Record<string, unknown>, performance?: Record<string, unknown>): Promise<DiagnosticsFiles | undefined> {
  if (!trace && !bundle && !performance) return undefined
  const dir = join(outDir, DIAGNOSTICS_DIR)
  const files: string[] = []
  let bytes = 0
  try {
    await mkdir(dir, { recursive: true })
    if (trace) {
      const text = `${stableJson(trace)}\n`
      await writeAtomically(dir, DIAGNOSTICS_FILES.trace, text)
      files.push(DIAGNOSTICS_FILES.trace)
      bytes += Buffer.byteLength(text, 'utf8')
    }
    if (performance) {
      const text = boundedJson(performance, DIAGNOSTICS_LIMITS.jsonBytes, () => ({ ...performance, phases: [], trimmed: true }))
      await writeAtomically(dir, DIAGNOSTICS_FILES.performance, text)
      files.push(DIAGNOSTICS_FILES.performance)
      bytes += Buffer.byteLength(text, 'utf8')
    }
    if (bundle) {
      const full = { ...bundle.diagnostics, ...extra }
      const text = boundedJson(full, DIAGNOSTICS_LIMITS.jsonBytes, () => ({ ...full, plans: full.plans ? { ...full.plans, plans: full.plans.plans.map((p) => ({ ...p, cells: [], bands: [], chains: [] })), trimmed: true } : null }))
      await writeAtomically(dir, DIAGNOSTICS_FILES.diagnostics, text)
      files.push(DIAGNOSTICS_FILES.diagnostics)
      bytes += Buffer.byteLength(text, 'utf8')
      if (bundle.overlay && bundle.overlay.png.byteLength <= DIAGNOSTICS_LIMITS.overlayBytes) {
        const target = join(dir, DIAGNOSTICS_FILES.overlay)
        await writeFile(`${target}.partial`, bundle.overlay.png)
        await rename(`${target}.partial`, target)
        files.push(DIAGNOSTICS_FILES.overlay)
        bytes += bundle.overlay.png.byteLength
      }
    }
    return { dir: DIAGNOSTICS_DIR, files, bytes }
  } catch {
    return files.length > 0 ? { dir: DIAGNOSTICS_DIR, files, bytes } : undefined
  }
}

/**
 * Run one job and report it. Resolves to the exit code; never throws, and
 * always writes exactly one terminal event (unless the arguments are unusable,
 * in which case there is nowhere trustworthy to write one but stderr).
 */
export async function runProgram(argv: readonly string[], wiring: LocalWiring, options: { now?: () => Date } = {}): Promise<number> {
  let args: ProgramArgs
  try {
    args = parseProgramArgs(argv)
  } catch (error) {
    process.stderr.write(`local analyzer: ${(error as Error).message}\n`)
    return EXIT.BAD_ARGUMENTS
  }
  const started = performance.now()
  const elapsed = (): number => Math.round(performance.now() - started)
  const sink = eventSink(args.eventsFd)
  const controller = new AbortController()
  const stopListening = listenForCancel(args.controlFd, controller)
  const pollCancel = controlPoller(args.controlFd, controller)
  let phaseStats: PhaseStats[] = []
  const phases = (): RunMetrics['phases'] => phaseStats.map((p) => ({ phaseId: p.phaseId, durationMs: p.durationMs, maxTickGapMs: p.maxTickGapMs, workDone: p.workDone, workTotal: p.workTotal }))
  const metrics = (extra: Partial<RunMetrics> = {}): RunMetrics => ({ elapsedMs: elapsed(), memory: memorySample(), phases: phases(), ...extra })
  // What each phase cost, beside the trace: never hashed, kept on failures and cancels too.
  const performanceRecord = (): Record<string, unknown> => ({ node: process.version, arch: arch(), elapsedMs: elapsed(), memory: memorySample(), phases: phaseStats })

  try {
    // before any analyzer code runs: ICU's text behaviour where the runtime lacks ICU (src/text.ts)
    const text = installTextAdapter()
    sink.emit({ type: 'hello', protocol: LOCAL_ANALYZER_PROTOCOL, capabilities: LOCAL_ANALYZER_CAPABILITIES, jobId: args.jobId, pid: process.pid, runtime: runtimeFacts(text), analyzer: { service: ANALYSIS_SERVICE_VERSION, solver: SOLVER_V2_VERSION } })
    const output = await runLocalAnalysis({
      url: args.url,
      workDir: args.workDir,
      wiring,
      jobId: args.jobId,
      signal: controller.signal,
      now: options.now,
      progress: (event) => sink.emit({ type: 'progress', event, elapsedMs: elapsed(), rssBytes: process.memoryUsage().rss }),
      telemetry: (event) => sink.emitBestEffort({ type: 'telemetry', event, rssBytes: process.memoryUsage.rss() }),
      pollCancel,
      onPhaseStats: (stats) => {
        phaseStats = stats
      },
    })
    // A refused comparison that something in the pipeline caught and survived still means this run
    // may not be the desktop's: it is not delivered.
    if (textRefusal()) throw textRefusal()
    try {
      await mkdir(args.outDir, { recursive: true })
      // the scene first and the summary last: a result.json on disk means every file it names is complete
      await writeAtomically(args.outDir, OUTPUT_FILES.scene, output.files.scene)
      await writeAtomically(args.outDir, OUTPUT_FILES.model, output.files.model)
      await writeAtomically(args.outDir, OUTPUT_FILES.candidate, output.files.candidate)
      await writeAtomically(args.outDir, OUTPUT_FILES.summary, output.files.summary)
    } catch {
      sink.emit({ type: 'failed', code: 'OUTPUT_FAILED', message: 'the result could not be written to the app storage', metrics: metrics({ timings: output.timings }) })
      return EXIT.FAILED
    }
    const diagnostics = await writeDiagnostics(args.outDir, output.run.trace, undefined, {}, performanceRecord())
    sink.emit({ type: 'done', summary: output.files.parsed, files: OUTPUT_FILES, metrics: { elapsedMs: elapsed(), memory: output.memory, timings: output.timings, sceneBytes: output.files.parsed.sceneBytes, phases: phases() }, sources: sourceHashesOf(output.run.pkg), ...(diagnostics ? { diagnostics } : {}) })
    return EXIT.DONE
  } catch (error) {
    const e = error instanceof AnalysisError ? error : toAnalysisError(error, controller.signal)
    const refusal = textRefusal()
    const runMetrics = metrics()
    // What the phone knows about itself, and nothing about where anything lives on it.
    const extra = { runtime: { node: process.version, arch: arch(), platform: platform() }, metrics: runMetrics }
    if (refusal && e.code !== 'CANCELLED') {
      const message = `the project's text contains a character (${refusal.message.split(' ')[0]}) this phone's runtime cannot sort or normalise exactly as the analyzer service does; analyse this project with the service`
      const diagnostics = await writeDiagnostics(args.outDir, e.attachments?.trace, e.attachments?.bundle, extra, performanceRecord())
      sink.emit({ type: 'failed', code: 'TEXT_NOT_SUPPORTED_ON_DEVICE', message, metrics: runMetrics, ...(diagnostics ? { diagnostics } : {}) })
      return EXIT.FAILED
    }
    if (e.code === 'CANCELLED') {
      const diagnostics = await writeDiagnostics(args.outDir, e.attachments?.trace, undefined, {}, performanceRecord())
      sink.emit({ type: 'cancelled', metrics: runMetrics, ...(diagnostics ? { diagnostics } : {}) })
      return EXIT.CANCELLED
    }
    const diagnostics = await writeDiagnostics(args.outDir, e.attachments?.trace, e.attachments?.bundle, extra, performanceRecord())
    sink.emit({ type: 'failed', code: e.code, message: e.message, metrics: runMetrics, failure: e.failure(), ...(diagnostics ? { diagnostics } : {}) })
    return EXIT.FAILED
  } finally {
    stopListening()
  }
}
