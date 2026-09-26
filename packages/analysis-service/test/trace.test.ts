/**
 * What a run established, step by step, whatever became of it (BUILDAPP-03Y2G).
 *
 * A completed, a failed and a cancelled run each leave a trace; an expected
 * solver failure leaves RECONSTRUCTION_FAILED with the solver's own reason
 * code, the stage and step it stopped in, the counts, and a diagnostics bundle
 * whose plan overlay is a real picture of the decomposition.
 */
import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { memoryByteCache } from '@buildapp/source-package'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { ANALYSIS_STAGES, AnalysisError, deterministicTrace, runAnalysis } from '../src/index.js'

const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
const cache = memoryByteCache()
const options = { adapters: [publisher.adapter], deps: publisher.deps, cache, now: () => new Date('2026-01-01T00:00:00Z') }
const first = runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, options)
first.catch(() => undefined)

const failure = async (p: Promise<unknown>): Promise<AnalysisError> => {
  try {
    await p
  } catch (e) {
    if (e instanceof AnalysisError) return e
    throw e
  }
  throw new Error('expected the run to fail')
}

describe('a completed run', () => {
  it('traces every stage, each step PASSED or DEGRADED, and says COMPLETED', async () => {
    const { trace } = await first
    expect(trace.outcome).toBe('COMPLETED')
    for (const stage of ANALYSIS_STAGES) expect(trace.entries.some((e) => e.stage === stage), stage).toBe(true)
    expect(trace.entries.every((e) => e.status === 'PASSED' || e.status === 'DEGRADED')).toBe(true)
    const decomposition = trace.entries.find((e) => e.substage === 'PLAN_DECOMPOSITION')
    expect(decomposition?.counts.enclosedCells).toBeGreaterThan(0)
    expect(decomposition?.counts.masses).toBeGreaterThanOrEqual(1)
  })

  it('is deterministic where its values are: the same sources give the same trace without its clock', async () => {
    const { pkg, graph, trace } = await first
    const again = await runAnalysis({ kind: 'PACKAGE', pkg, graph }, options)
    const strip = (t: typeof trace) => deterministicTrace(t).entries.filter((e) => e.stage !== 'ACQUIRING_SOURCE' && e.substage !== 'OBSERVATIONS')
    expect(strip(again.trace)).toEqual(strip(trace))
  })
})

describe('a run the solver cannot finish says why, where, and how far it got', () => {
  it('no floor plan: RECONSTRUCTION_FAILED / PLAN_NOT_FOUND in REGISTERING_VIEWS, traced, with a bundle', async () => {
    const { pkg, graph } = await first
    const noPlans = { ...graph, coordinateFrames: graph.coordinateFrames.filter((f) => f.roles.document !== 'FLOOR_PLAN') }
    const e = await failure(runAnalysis({ kind: 'PACKAGE', pkg, graph: noPlans }, options))
    expect(e.code).toBe('RECONSTRUCTION_FAILED')
    expect(e.failure()).toMatchObject({ code: 'RECONSTRUCTION_FAILED', reasonCode: 'PLAN_NOT_FOUND', stage: 'REGISTERING_VIEWS', substage: 'PLAN_READ', title: 'No floor plan to read' })
    expect(e.attachments?.trace?.outcome).toBe('FAILED')
    expect(e.attachments?.trace?.entries.at(-1)).toMatchObject({ stage: 'REGISTERING_VIEWS', status: 'FAILED', reasonCode: 'PLAN_NOT_FOUND' })
    expect(e.attachments?.bundle?.diagnostics.failure?.reasonCode).toBe('PLAN_NOT_FOUND')
    expect(e.attachments?.bundle?.diagnostics.source?.assets.length).toBe(pkg.assets.length)
  })

  it('a body that contradicts the published footprint: PLAN_LAYOUT_REJECTED, and the bundle carries the plan overlay as a PNG', async () => {
    const { pkg, graph } = await first
    const lying = { ...pkg, publishedFacts: [...pkg.publishedFacts.filter((f) => f.key !== 'footprint_area'), { key: 'footprint_area', label: 'Footprint', raw: '5 m2', unit: 'm2', value: 5 }] }
    const e = await failure(runAnalysis({ kind: 'PACKAGE', pkg: lying as typeof pkg, graph }, options))
    expect(e.failure()).toMatchObject({ reasonCode: 'PLAN_LAYOUT_REJECTED', stage: 'REGISTERING_VIEWS', substage: 'STRUCTURAL_LAYOUT' })
    expect(e.failure().diagnostics?.masses).toBeGreaterThanOrEqual(1)
    const overlay = e.attachments?.bundle?.overlay
    expect(overlay?.name).toBe('plan-overlay.png')
    const png = PNG.sync.read(Buffer.from(overlay!.png))
    expect(png.width).toBeGreaterThan(100)
    // nothing machine-specific in what a client may be shown
    expect(JSON.stringify(e.failure())).not.toMatch(/\/home|\/tmp|node_modules|at [A-Za-z]+ \(/)
  })

  it('a cancelled run traces CANCELLED in the stage it was cancelled in', async () => {
    const controller = new AbortController()
    const slow = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }], beforeRespond: () => controller.abort() })
    const e = await failure(runAnalysis({ kind: 'URL', url: slow.pageUrl('larchfield-lf01') }, { adapters: [slow.adapter], deps: slow.deps, cache: memoryByteCache(), signal: controller.signal }))
    expect(e.code).toBe('CANCELLED')
    expect(e.attachments?.trace?.outcome).toBe('CANCELLED')
    expect(e.attachments?.trace?.entries.at(-1)).toMatchObject({ stage: 'ACQUIRING_SOURCE', status: 'CANCELLED' })
  })
})
