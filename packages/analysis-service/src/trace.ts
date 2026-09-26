/**
 * What one analysis did, step by step, whatever became of it.
 *
 * The progress events say where a run IS; the trace says what each step
 * ESTABLISHED — how many drawings were fetched, how many wall bands a plan
 * showed, how many cells its flood fill could not reach — and, when a step
 * stops the run, the code it stopped with. It exists for a completed run, a
 * failed one and a cancelled one alike, because the question "how far did it
 * get" matters most when the answer is "not far enough".
 *
 * Two kinds of number live here and are kept apart: `counts`, `status`,
 * `reasonCode` and `detail` are functions of the sources and are the same on
 * every machine; `startedAtMs` and `durationMs` are the clock's and are not.
 * `deterministicTrace` drops the second kind for comparing two runs.
 */
import type { AnalysisStage } from './stages.js'

export type TraceStatus = 'PASSED' | 'DEGRADED' | 'FAILED' | 'CANCELLED'

export type TraceCounts = Record<string, number | string | boolean>

export type AnalysisTraceEntry = {
  stage: AnalysisStage
  /** The step inside the stage: PLAN_DECOMPOSITION, METRIC_EVIDENCE, REPLAY … */
  substage: string
  status: TraceStatus
  /** Milliseconds from the start of the run, by a monotonic clock. Not deterministic. */
  startedAtMs: number
  durationMs: number
  counts: TraceCounts
  reasonCode?: string
  /** A sentence about the SOURCE; never a path or a stack. */
  detail?: string
}

export type AnalysisTrace = {
  schema: 'buildapp.analysis-trace'
  schemaVersion: '1.0.0'
  outcome: 'COMPLETED' | 'FAILED' | 'CANCELLED'
  entries: AnalysisTraceEntry[]
}

/** The trace without its clock: equal for equal sources, on any machine. */
export function deterministicTrace(trace: AnalysisTrace): Omit<AnalysisTrace, 'entries'> & { entries: Array<Omit<AnalysisTraceEntry, 'startedAtMs' | 'durationMs'>> } {
  return { ...trace, entries: trace.entries.map(({ startedAtMs: _s, durationMs: _d, ...rest }) => rest) }
}

/**
 * Collects trace entries as a run proceeds.
 *
 * `mark` opens a step and `close` finishes it; `record` adds a step that
 * finished just now (the solver reports its own steps that way), timed from
 * the end of the previous one.
 */
export class TraceRecorder {
  private readonly entries: AnalysisTraceEntry[] = []
  private last: number

  constructor(private readonly clock: () => number, private readonly t0: number) {
    this.last = t0
  }

  private since(from: number): { startedAtMs: number; durationMs: number } {
    const now = this.clock()
    const entry = { startedAtMs: Math.max(0, Math.round(from - this.t0)), durationMs: Math.max(0, Math.round(now - from)) }
    this.last = now
    return entry
  }

  /** A step that began when the previous one ended and has ended now. */
  record(stage: AnalysisStage, substage: string, status: TraceStatus, counts: TraceCounts = {}, extra: { reasonCode?: string; detail?: string } = {}): void {
    this.entries.push({ stage, substage, status, ...this.since(this.last), counts, ...(extra.reasonCode ? { reasonCode: extra.reasonCode } : {}), ...(extra.detail ? { detail: extra.detail } : {}) })
  }

  /** Whether any step of this stage has been recorded. */
  has(stage: AnalysisStage): boolean {
    return this.entries.some((e) => e.stage === stage)
  }

  hasFailure(): boolean {
    return this.entries.some((e) => e.status === 'FAILED' || e.status === 'CANCELLED')
  }

  finish(outcome: AnalysisTrace['outcome']): AnalysisTrace {
    return { schema: 'buildapp.analysis-trace', schemaVersion: '1.0.0', outcome, entries: this.entries.map((e) => ({ ...e, counts: { ...e.counts } })) }
  }
}
