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
 *    `hello` (runtime facts), `progress` (the pipeline's own event plus the
 *    elapsed time and resident memory), then exactly one of `done`, `failed`
 *    or `cancelled`. Written synchronously, so a report made in the middle of
 *    a long synchronous stage reaches the app when it is made.
 *  - **control** (`--control-fd`): a line `cancel` aborts the run; the pipe
 *    closing does too (the app went away). The pipeline checks between stages
 *    and inside every fetch; a stage that is computing is not interrupted by
 *    this — the app ends the process for that, and deletes the job directory.
 *
 * On `done`, the four delivery files are in `--out`, each written to a
 * temporary name and renamed into place: `result.json` (the summary, whose
 * `sceneSha256` names `scene.json`'s exact bytes), `scene.json`, `model.json`,
 * `candidate.json`. The source bytes never leave `--work/bytes`, which is
 * removed before any terminal event is written.
 */
import { writeSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, totalmem } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { Socket } from 'node:net'
import { ANALYSIS_SERVICE_VERSION, toAnalysisError } from '@buildapp/analysis-service'
import type { AnalysisErrorCode, AnalysisProgress, AnalysisTimings, LinkAnalysisSummary } from '@buildapp/analysis-service'
import { SOLVER_V2_VERSION } from '@buildapp/reconstruction'
import { selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { runLocalAnalysis } from './local.js'
import type { LocalWiring } from './local.js'
import { memorySample } from './memory.js'
import type { MemorySample } from './memory.js'

/** Bumped when the event or argument shape changes; the app refuses a runtime that speaks another. */
export const LOCAL_ANALYZER_PROTOCOL = 1 as const

export const OUTPUT_FILES = { summary: 'result.json', scene: 'scene.json', model: 'model.json', candidate: 'candidate.json' } as const

export type ProgramArgs = { jobId: string; url: string; workDir: string; outDir: string; eventsFd: number | null; controlFd: number | null }

export type RuntimeFacts = {
  node: string
  v8: string
  icu: string | null
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
}

export type LocalAnalyzerEvent =
  | { type: 'hello'; protocol: typeof LOCAL_ANALYZER_PROTOCOL; jobId: string; pid: number; runtime: RuntimeFacts; analyzer: { service: string; solver: string } }
  | { type: 'progress'; event: AnalysisProgress; elapsedMs: number; rssBytes: number }
  | { type: 'done'; summary: LinkAnalysisSummary; files: typeof OUTPUT_FILES; metrics: RunMetrics; sources: SourceHashes }
  | { type: 'failed'; code: AnalysisErrorCode | 'BAD_ARGUMENTS' | 'OUTPUT_FAILED'; message: string; metrics: RunMetrics }
  | { type: 'cancelled'; metrics: RunMetrics }

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

export function runtimeFacts(): RuntimeFacts {
  return {
    node: process.version,
    v8: process.versions.v8,
    icu: process.versions.icu ?? null,
    platform: platform(),
    arch: arch(),
    cpus: cpus().length,
    totalMemoryBytes: totalmem(),
    collatorLocale: new Intl.Collator().resolvedOptions().locale,
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
function eventSink(fd: number | null): { emit: (event: LocalAnalyzerEvent) => void } {
  if (fd === null) return { emit: (event) => void process.stdout.write(`${JSON.stringify(event)}\n`) }
  return {
    emit: (event) => {
      const line = Buffer.from(`${JSON.stringify(event)}\n`, 'utf8')
      let at = 0
      while (at < line.length) {
        try {
          at += writeSync(fd, line, at, line.length - at)
        } catch (error) {
          // a non-blocking descriptor whose buffer is full: wait a moment and write the rest
          if ((error as NodeJS.ErrnoException).code !== 'EAGAIN') throw error
          Atomics.wait(PAUSE, 0, 0, 2)
        }
      }
    },
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
  const metrics = (extra: Partial<RunMetrics> = {}): RunMetrics => ({ elapsedMs: elapsed(), memory: memorySample(), ...extra })

  try {
    sink.emit({ type: 'hello', protocol: LOCAL_ANALYZER_PROTOCOL, jobId: args.jobId, pid: process.pid, runtime: runtimeFacts(), analyzer: { service: ANALYSIS_SERVICE_VERSION, solver: SOLVER_V2_VERSION } })
    const output = await runLocalAnalysis({
      url: args.url,
      workDir: args.workDir,
      wiring,
      jobId: args.jobId,
      signal: controller.signal,
      now: options.now,
      progress: (event) => sink.emit({ type: 'progress', event, elapsedMs: elapsed(), rssBytes: process.memoryUsage().rss }),
    })
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
    sink.emit({ type: 'done', summary: output.files.parsed, files: OUTPUT_FILES, metrics: { elapsedMs: elapsed(), memory: output.memory, timings: output.timings, sceneBytes: output.files.parsed.sceneBytes }, sources: sourceHashesOf(output.run.pkg) })
    return EXIT.DONE
  } catch (error) {
    const e = toAnalysisError(error, controller.signal)
    if (e.code === 'CANCELLED') {
      sink.emit({ type: 'cancelled', metrics: metrics() })
      return EXIT.CANCELLED
    }
    sink.emit({ type: 'failed', code: e.code, message: e.message, metrics: metrics() })
    return EXIT.FAILED
  } finally {
    stopListening()
  }
}
