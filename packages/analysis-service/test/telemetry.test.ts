/**
 * BUILDPLAN-ANALYZER-005A: the run tells what it is doing, by counts, while it
 * does it — and watching it changes nothing.
 *
 *   - telemetry is write-only: a run that emits it and a run that does not
 *     produce the same bytes;
 *   - every event names a phase from the closed list, in its stage; the
 *     heartbeat sequence has no holes; the overall position never goes back;
 *   - a cancel asked for from outside lands inside the long metric pass, at
 *     the next loop boundary, not at the end of the stage;
 *   - every phase's cost is recorded, and the longest silence is measured.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { ANALYSIS_PHASES, ANALYSIS_STAGES, AnalysisError, hashesOf, runAnalysis } from '../src/index.js'
import type { AnalysisTelemetry, PhaseStats } from '../src/index.js'

const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
const url = publisher.pageUrl('larchfield-lf01')

/** A clock that moves 50 ms each time it is read: heartbeats become dense and reproducible. */
const steppingClock = (): (() => number) => {
  let t = 0
  return () => (t += 50)
}

const base = (extra: Partial<Parameters<typeof runAnalysis>[1]> = {}): Parameters<typeof runAnalysis>[1] => ({
  adapters: [publisher.adapter],
  deps: publisher.deps,
  cache: memoryByteCache(),
  now: () => new Date('2026-01-01T00:00:00Z'),
  ...extra,
})

describe('run telemetry', () => {
  it('is write-only: the same bytes with and without it, and the events are well formed', async () => {
    const events: AnalysisTelemetry[] = []
    let stats: PhaseStats[] = []
    const [quiet, watched] = await Promise.all([
      runAnalysis({ kind: 'URL', url }, base({ jobId: 'job-t' })),
      runAnalysis({ kind: 'URL', url }, base({ jobId: 'job-t', clock: steppingClock(), telemetry: (e) => events.push(e), pollCancel: () => false, rss: () => 1, onPhaseStats: (s) => (stats = s) })),
    ])
    expect(hashesOf(watched.result)).toEqual(hashesOf(quiet.result))
    expect(watched.sceneText).toBe(quiet.sceneText)

    expect(events.some((e) => e.kind === 'HEARTBEAT')).toBe(true)
    const known = ANALYSIS_PHASES as Record<string, { stage: string; unit: string }>
    for (const [i, e] of events.entries()) {
      expect(e.heartbeatSeq).toBe(i + 1)
      expect(known[e.phaseId]?.stage).toBe(e.stage)
      expect(e.stageIndex).toBe(ANALYSIS_STAGES.indexOf(e.stage))
      if (e.workTotal !== null) expect(e.workDone).toBeLessThanOrEqual(e.workTotal)
      if (i > 0) expect(e.overall).toBeGreaterThanOrEqual(events[i - 1].overall)
      expect(e.phaseElapsedMs).toBeLessThanOrEqual(e.elapsedMs)
    }
    // the phases a phone shows, in pipeline order, each announced as it starts
    const starts = events.filter((e) => e.kind === 'PHASE_START').map((e) => e.phaseId)
    for (const id of ['ACQUIRE_PAGE', 'ACQUIRE_ASSETS', 'CLASSIFY', 'OBSERVE_ASSETS', 'DECODE_RASTERS', 'METRIC_FRAMES', 'REGISTER_VIEWS', 'SOLVE_TOPOLOGY', 'BUILD_MODEL', 'COMPILE_SCENE', 'VERIFY']) {
      expect(starts).toContain(id)
    }
    const order = starts.map((id) => Object.keys(ANALYSIS_PHASES).indexOf(id))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    // inside the metric pass the counts are real: which frame of how many
    const metric = events.filter((e) => e.phaseId === 'METRIC_FRAMES' && e.kind === 'HEARTBEAT')
    expect(metric.length).toBeGreaterThan(0)
    for (const e of metric) {
      expect(e.unit).toBe('FRAME')
      expect(e.assetTotal).toBe(e.workTotal)
    }

    // the performance record: every phase, its ticks and its longest silence
    expect(stats.map((s) => s.phaseId)).toEqual(watched.phases.map((s) => s.phaseId))
    for (const s of stats) {
      expect(s.durationMs).toBeGreaterThanOrEqual(0)
      expect(s.maxTickGapMs).toBeLessThanOrEqual(s.durationMs)
    }
    expect(stats.find((s) => s.phaseId === 'METRIC_FRAMES')?.ticks).toBeGreaterThan(0)
  })

  it('a listener that fails does not fail the run: a throwing sink and memory probe leave the same bytes, and the record says so', async () => {
    let calls = 0
    let stats: PhaseStats[] = []
    const [quiet, broken] = await Promise.all([
      runAnalysis({ kind: 'URL', url }, base({ jobId: 'job-s' })),
      runAnalysis(
        { kind: 'URL', url },
        base({
          jobId: 'job-s',
          clock: steppingClock(),
          telemetry: () => {
            calls += 1
            if (calls === 3) throw new Error('the pipe to the phone closed')
          },
          rss: () => {
            throw new Error('no memory probe on this runtime')
          },
          onPhaseStats: (s) => (stats = s),
        }),
      ),
    ])
    expect(hashesOf(broken.result)).toEqual(hashesOf(quiet.result))
    expect(broken.sceneText).toBe(quiet.sceneText)
    // a sink that threw is not called again
    expect(calls).toBe(3)
    expect(stats.filter((s) => s.counters.telemetrySinkFailed === 1)).toHaveLength(1)
    expect(stats.filter((s) => s.counters.rssProbeFailed === 1)).toHaveLength(1)
    expect(stats.every((s) => s.peakRssBytes === undefined)).toBe(true)
  })

  it('a cancel lands inside the metric pass, at the next loop boundary', async () => {
    let asked = false
    let seenAfter = 0
    const run = runAnalysis(
      { kind: 'URL', url },
      base({
        clock: steppingClock(),
        telemetry: (e) => {
          if (asked) seenAfter += 1
          if (e.phaseId === 'METRIC_FRAMES' && e.kind === 'HEARTBEAT') asked = true
        },
        pollCancel: () => asked,
      }),
    )
    const error = await run.then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(AnalysisError)
    expect((error as AnalysisError).code).toBe('CANCELLED')
    expect((error as AnalysisError).detail.stage).toBe('EXTRACTING_OBSERVATIONS')
    // at most one more event: the cancel is honoured at the next poll, not at the end of the stage
    expect(seenAfter).toBeLessThanOrEqual(1)
  })

  it('a cancel while the plans are read lands in that stage (the resolver cancel itself: plan-resolution.test.ts, on a sheet that reaches it)', async () => {
    let asked = false
    const run = runAnalysis(
      { kind: 'URL', url },
      base({
        clock: steppingClock(),
        telemetry: (e) => {
          if (e.phaseId === 'REGISTER_VIEWS') asked = true
        },
        pollCancel: () => asked,
      }),
    )
    const error = await run.then(
      () => undefined,
      (e: unknown) => e,
    )
    expect((error as AnalysisError).code).toBe('CANCELLED')
    expect((error as AnalysisError).detail.stage).toBe('REGISTERING_VIEWS')
  })
})
