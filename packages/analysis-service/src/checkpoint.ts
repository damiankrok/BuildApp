/**
 * The run's checkpoint: the one place the loops' ticks become telemetry.
 *
 * Every long loop in the pipeline calls `tick` with the counts it holds
 * (`@buildapp/source-common` progress.ts). Here those calls become events a
 * phone can show — which phase, which frame of how many, how many rings of a
 * callout search — and a heartbeat that proves the thread is still crossing
 * loop boundaries. The overall percent is a secondary summary; the counts are
 * the progress.
 *
 * Three rules keep it honest:
 *
 *   - Write-only. Nothing recorded here is read back by the computation; a run
 *     with telemetry and without it produce the same bytes.
 *   - Cheap. A tick is a few assignments and one clock read; an event goes out
 *     at most once a second, and cancellation is polled at most every 200 ms.
 *   - Honest about silence. A heartbeat is emitted by the loop itself, so a
 *     heartbeat means "the thread just crossed a boundary", and its absence
 *     means the thread is inside one step — the phone decides how long that
 *     may take before it says so.
 *
 * A listener that fails is the listener's problem, never the run's: a sink or
 * a memory probe that throws is not asked again, the phase's record counts it
 * (`telemetrySinkFailed`, `rssProbeFailed`), and the computation goes on to
 * the same bytes. Only the cancel poll may end a run from here.
 */
import type { Checkpoint, ProgressUnit, WorkUpdate } from '@buildapp/source-common'
import { ANALYSIS_STAGES } from './stages.js'
import type { AnalysisStage } from './stages.js'

/** Every phase the pipeline reports, the stage it belongs to, and what it counts. Closed: a phone may key its own words by id. */
export const ANALYSIS_PHASES = {
  ACQUIRE_PAGE: { stage: 'ACQUIRING_SOURCE', label: 'fetching the project page', unit: 'STEP' },
  ACQUIRE_ASSETS: { stage: 'ACQUIRING_SOURCE', label: 'fetching the drawings', unit: 'ADDRESS' },
  CLASSIFY: { stage: 'CLASSIFYING_SOURCES', label: 'sorting the drawings', unit: 'ASSET' },
  OBSERVE_ASSETS: { stage: 'EXTRACTING_OBSERVATIONS', label: 'reading the drawings', unit: 'ASSET' },
  DECODE_RASTERS: { stage: 'EXTRACTING_OBSERVATIONS', label: 'decoding the drawings for measuring', unit: 'ASSET' },
  METRIC_FRAMES: { stage: 'EXTRACTING_OBSERVATIONS', label: 'reading printed dimensions and callouts', unit: 'FRAME' },
  REGISTER_VIEWS: { stage: 'REGISTERING_VIEWS', label: 'reading the plans and registering the views', unit: 'STEP' },
  PLAN_RESOLUTION: { stage: 'REGISTERING_VIEWS', label: 'weighing other readings of the plan', unit: 'CANDIDATE' },
  SOLVE_TOPOLOGY: { stage: 'SOLVING_TOPOLOGY', label: 'solving bodies, roof, recesses, stair and rooms', unit: 'STEP' },
  SOLVE_METRICS: { stage: 'SOLVING_METRICS', label: 'sizing openings, roof details and facades', unit: 'STEP' },
  BUILD_MODEL: { stage: 'BUILDING_MODEL', label: 'building the model', unit: 'STEP' },
  COMPILE_SCENE: { stage: 'COMPILING_SCENE', label: 'compiling the 3D scene', unit: 'STEP' },
  VERIFY: { stage: 'VERIFYING', label: 'checking replay, hashes and joints', unit: 'STEP' },
} as const satisfies Record<string, { stage: AnalysisStage; label: string; unit: ProgressUnit }>

export type AnalysisPhaseId = keyof typeof ANALYSIS_PHASES

/** One telemetry event: where the run is, by counts, and that it is alive. */
export type AnalysisTelemetry = {
  kind: 'PHASE_START' | 'HEARTBEAT'
  stage: AnalysisStage
  stageIndex: number
  stageCount: number
  phaseId: string
  phaseLabel: string
  subphaseId?: string
  subphaseLabel?: string
  /** COMPUTE: a loop just crossed a boundary. IO_WAIT: the run is waiting on the network or the disk. */
  activity: 'COMPUTE' | 'IO_WAIT'
  workDone: number
  /** Null while the total is not known yet: the phone shows no fraction rather than a guess. */
  workTotal: number | null
  unit: ProgressUnit
  assetIndex?: number
  assetTotal?: number
  candidateIndex?: number
  candidateTotal?: number
  /** +1 on every event; a hole means a dropped line. */
  heartbeatSeq: number
  elapsedMs: number
  phaseElapsedMs: number
  timestamp: string
  diagnosticCounters?: Record<string, number>
  /** The overall position, 0..1, never decreasing; secondary to the counts. */
  overall: number
}

/** What one phase cost: the performance record's input. Never hashed, never in the trace. */
export type PhaseStats = {
  phaseId: string
  stage: AnalysisStage
  startedAtMs: number
  durationMs: number
  ticks: number
  /** The longest the phase went without crossing a loop boundary: what a phone sees as silence. */
  maxTickGapMs: number
  workDone: number
  workTotal: number | null
  unit: ProgressUnit
  counters: Record<string, number>
  peakRssBytes?: number
}

export type RunCheckpoint = Checkpoint & {
  /** A heartbeat from a timer while the run awaits I/O; emitted only when one is due. */
  idle(): void
  /** Close the phase in hand, for the performance record. */
  end(): void
  stats(): PhaseStats[]
}

export type CheckpointOptions = {
  /** Monotonic milliseconds. */
  clock: () => number
  now?: () => Date
  signal?: AbortSignal
  /** Asked at most every `checkMs`; true means "cancel now". It may abort the run's controller itself. */
  pollCancel?: () => boolean
  emit?: (event: AnalysisTelemetry) => void
  /** The overall position, as the stage reports have it. */
  overall?: () => number
  /** Resident memory, sampled when an event goes out, for the performance record. */
  rss?: () => number
  heartbeatMs?: number
  checkMs?: number
}

const abortError = (signal: AbortSignal | undefined): Error => {
  const reason = signal?.reason
  if (reason instanceof Error && reason.name === 'AbortError') return reason
  return new DOMException('the analysis was cancelled', 'AbortError')
}

export function createCheckpoint(options: CheckpointOptions): RunCheckpoint {
  const heartbeatMs = options.heartbeatMs ?? 1000
  const checkMs = options.checkMs ?? 200
  const now = options.now ?? (() => new Date())
  const t0 = options.clock()
  let seq = 0
  let lastEmit = -Infinity
  let nextCheck = t0
  const done: PhaseStats[] = []
  type Current = {
    id: string
    stage: AnalysisStage
    label: string
    unit: ProgressUnit
    startedAt: number
    lastTickAt: number
    ticks: number
    maxGap: number
    workDone: number
    workTotal: number | null
    assetIndex?: number
    assetTotal?: number
    candidateIndex?: number
    candidateTotal?: number
    subphase?: { id: string; label: string }
    counters: Record<string, number>
    peakRss?: number
  }
  let current: Current | undefined
  let sinkFailed = false
  let rssFailed = false

  const sampleRss = (c: Current): void => {
    if (!options.rss || rssFailed) return
    try {
      const rss = options.rss()
      c.peakRss = Math.max(c.peakRss ?? 0, rss)
    } catch {
      rssFailed = true
      c.counters.rssProbeFailed = 1
    }
  }

  const emit = (kind: AnalysisTelemetry['kind'], activity: AnalysisTelemetry['activity'], at: number): void => {
    if (!current || !options.emit || sinkFailed) return
    lastEmit = at
    seq += 1
    const c = current
    sampleRss(c)
    try {
      send(kind, activity, at, c, options.emit)
    } catch {
      sinkFailed = true
      c.counters.telemetrySinkFailed = 1
    }
  }

  const send = (kind: AnalysisTelemetry['kind'], activity: AnalysisTelemetry['activity'], at: number, c: Current, sink: (event: AnalysisTelemetry) => void): void => {
    sink({
      kind,
      stage: c.stage,
      stageIndex: ANALYSIS_STAGES.indexOf(c.stage),
      stageCount: ANALYSIS_STAGES.length,
      phaseId: c.id,
      phaseLabel: c.label,
      ...(c.subphase ? { subphaseId: c.subphase.id, subphaseLabel: c.subphase.label } : {}),
      activity,
      workDone: c.workDone,
      workTotal: c.workTotal,
      unit: c.unit,
      ...(c.assetIndex !== undefined ? { assetIndex: c.assetIndex, assetTotal: c.assetTotal } : {}),
      ...(c.candidateIndex !== undefined ? { candidateIndex: c.candidateIndex, candidateTotal: c.candidateTotal } : {}),
      heartbeatSeq: seq,
      elapsedMs: Math.round(at - t0),
      phaseElapsedMs: Math.round(at - c.startedAt),
      timestamp: now().toISOString(),
      ...(Object.keys(c.counters).length > 0 ? { diagnosticCounters: { ...c.counters } } : {}),
      overall: options.overall?.() ?? 0,
    })
  }

  const close = (at: number): void => {
    if (!current) return
    done.push({
      phaseId: current.id,
      stage: current.stage,
      startedAtMs: Math.round(current.startedAt - t0),
      durationMs: Math.round(at - current.startedAt),
      ticks: current.ticks,
      maxTickGapMs: Math.round(Math.max(current.maxGap, at - current.lastTickAt)),
      workDone: current.workDone,
      workTotal: current.workTotal,
      unit: current.unit,
      counters: { ...current.counters },
      ...(current.peakRss !== undefined ? { peakRssBytes: current.peakRss } : {}),
    })
    current = undefined
  }

  const merge = (w: WorkUpdate): void => {
    if (!current) return
    if (w.done !== undefined) current.workDone = w.done
    if (w.total !== undefined) current.workTotal = w.total
    if (w.assetIndex !== undefined) {
      current.assetIndex = w.assetIndex
      current.assetTotal = w.assetTotal
    }
    if (w.candidateIndex !== undefined) {
      current.candidateIndex = w.candidateIndex
      current.candidateTotal = w.candidateTotal
    }
    if (w.subphase) current.subphase = w.subphase
    if (w.counters) Object.assign(current.counters, w.counters)
  }

  const check = (at: number): void => {
    if (at < nextCheck) return
    nextCheck = at + checkMs
    if (options.signal?.aborted || options.pollCancel?.()) throw abortError(options.signal)
  }

  return {
    phase(id, o = {}) {
      const at = options.clock()
      close(at)
      const known = (ANALYSIS_PHASES as Record<string, { stage: AnalysisStage; label: string; unit: ProgressUnit }>)[id]
      current = {
        id,
        stage: known?.stage ?? 'EXTRACTING_OBSERVATIONS',
        label: known?.label ?? id.toLowerCase().replace(/_/g, ' '),
        unit: o.unit ?? known?.unit ?? 'STEP',
        startedAt: at,
        lastTickAt: at,
        ticks: 0,
        maxGap: 0,
        workDone: 0,
        workTotal: o.total ?? null,
        counters: {},
        ...(o.subphase ? { subphase: o.subphase } : {}),
      }
      emit('PHASE_START', 'COMPUTE', at)
      check(at)
    },
    tick(update) {
      if (update) merge(update)
      const at = options.clock()
      if (current) {
        current.ticks += 1
        const gap = at - current.lastTickAt
        if (gap > current.maxGap) current.maxGap = gap
        current.lastTickAt = at
      }
      if (at < nextCheck && at - lastEmit < heartbeatMs) return
      check(at)
      if (at - lastEmit >= heartbeatMs) emit('HEARTBEAT', 'COMPUTE', at)
    },
    idle() {
      const at = options.clock()
      if (at - lastEmit >= heartbeatMs) emit('HEARTBEAT', 'IO_WAIT', at)
    },
    end() {
      close(options.clock())
    },
    stats() {
      return [...done]
    },
  }
}
