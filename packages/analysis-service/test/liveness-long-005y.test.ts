/**
 * BUILDPLAN-ANALYZER-005Y: a long analysis is not a failed one. Time alone never ends a run: a computation that keeps
 * crossing loop boundaries for twelve minutes keeps sending heartbeats and finishes, and one that stays inside a single
 * step for fifty seconds is reported as exactly that — a silence the phone can name — and still finishes. Only a
 * cancel ends a run early, and it lands at the next loop boundary.
 */
import { describe, expect, it } from 'vitest'
import { createCheckpoint } from '../src/checkpoint.js'
import type { AnalysisTelemetry } from '../src/checkpoint.js'

/** A clock the test moves by hand: the computation "takes" exactly the time the test says it does. */
function manualClock(): { clock: () => number; advance: (ms: number) => void } {
  let t = 0
  return { clock: () => t, advance: (ms) => (t += ms) }
}

describe('005Y long analyses and liveness', () => {
  it('a twelve-minute computation that ticks keeps its heartbeat and is never stopped by time', () => {
    const c = manualClock()
    const events: AnalysisTelemetry[] = []
    const cp = createCheckpoint({ clock: c.clock, emit: (e) => events.push(e) })
    cp.phase('SOLVE_METRICS')
    const minutes = 12
    for (let i = 0; i < minutes * 60 * 2; i += 1) {
      c.advance(500)
      cp.tick({ subphase: { id: 'TINTED_CALLOUT_RINGS', label: 'reading callouts on a tinted field' }, counters: { places: i + 1 } })
    }
    cp.end()
    const stats = cp.stats().find((s) => s.phaseId === 'SOLVE_METRICS')
    expect(stats?.durationMs).toBe(minutes * 60_000)
    expect(stats?.maxTickGapMs).toBeLessThanOrEqual(500)
    const beats = events.filter((e) => e.kind === 'HEARTBEAT')
    // a heartbeat at most once a second, and never more than a second and a half apart
    expect(beats.length).toBeGreaterThan(minutes * 60 * 0.9)
    for (let i = 1; i < beats.length; i += 1) expect(beats[i].elapsedMs - beats[i - 1].elapsedMs).toBeLessThanOrEqual(1_500)
    expect(beats.at(-1)?.heartbeatSeq).toBeGreaterThan(beats[0].heartbeatSeq)
  })

  it('fifty seconds inside one step is a silence the record names, not a stop', () => {
    const c = manualClock()
    const events: AnalysisTelemetry[] = []
    const cp = createCheckpoint({ clock: c.clock, emit: (e) => events.push(e) })
    cp.phase('SOLVE_METRICS')
    c.advance(1_000)
    cp.tick()
    c.advance(50_000) // a step with no loop boundary inside it
    cp.tick()
    c.advance(1_000)
    cp.tick()
    cp.end()
    const stats = cp.stats().find((s) => s.phaseId === 'SOLVE_METRICS')
    expect(stats?.maxTickGapMs).toBe(50_000)
    const beats = events.filter((e) => e.kind === 'HEARTBEAT').map((e) => e.elapsedMs)
    const gaps = beats.slice(1).map((t, i) => t - beats[i])
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(45_000)
    expect(stats?.durationMs).toBe(52_000)
  })

  it('a cancel, not the clock, ends a long run, at the next loop boundary', () => {
    const c = manualClock()
    let asked = false
    const cp = createCheckpoint({ clock: c.clock, pollCancel: () => asked })
    cp.phase('SOLVE_METRICS')
    let crossed = 0
    const run = (): void => {
      for (let i = 0; i < 100_000; i += 1) {
        c.advance(250)
        if (i === 4_000) asked = true // after more than sixteen minutes
        cp.tick()
        crossed += 1
      }
    }
    expect(run).toThrow()
    expect(crossed).toBeGreaterThanOrEqual(4_000)
    expect(crossed).toBeLessThanOrEqual(4_001)
  })
})
