/**
 * SHAPE-LIVE-01: the live source stream on a whole synthetic run. The sheet a step names is one the run read, by the
 * hash of its exact bytes; sheets and marks arrive before the run ends; a step that reads no picture names none and
 * keeps the last; a mark that went into the model names an element the model has; counts never run backwards.
 */
import { describe, expect, it } from 'vitest'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { memoryByteCache, selectedVariant } from '@buildapp/source-package'
import { runAnalysis } from '../src/index.js'
import type { LiveSourceEvent } from '../src/index.js'

const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })

describe('SHAPE-LIVE-01 the live source stream', () => {
  it('sheets and marks stream while the run reads; every sheet is a read picture by its byte hash; elements are real', async () => {
    const events: LiveSourceEvent[] = []
    const r = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z'), live: (e) => events.push(e) })
    expect(events.length).toBeGreaterThan(3)
    // sequence numbers in order, the first step before any sheet
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1))
    expect(events[0].step).toBe('FETCHING')
    expect(events[0].sheet).toBeNull()
    // every sheet named is one of the package's pictures, by the hash of the bytes the run read
    const hashes = new Map(r.pkg.assets.map((a) => [a.id, selectedVariant(a).byteHash]))
    const withSheet = events.filter((e) => e.sheet)
    expect(withSheet.length).toBeGreaterThan(0)
    for (const e of withSheet) expect(e.sheet?.byteHash).toBe(hashes.get(e.sheet?.assetId ?? ''))
    // a sheet is on screen before the solver starts: the reading is shown while it happens, not after
    const firstSheet = events.findIndex((e) => e.sheet)
    const firstSolve = events.findIndex((e) => e.step === 'SOLVING')
    expect(firstSheet).toBeGreaterThan(-1)
    expect(firstSheet).toBeLessThan(firstSolve)
    expect(events.some((e) => e.step === 'NUMBERS_READ' && e.marks.length > 0)).toBe(true)
    // a step that reads no picture keeps the last sheet as the last one
    for (const e of events.filter((x) => x.step === 'SOLVING' || x.step === 'COMPILING' || x.step === 'VERIFYING')) {
      expect(e.sheet).toBeNull()
      expect(e.keepsLastSheet).toBe(true)
    }
    // the model's readings: each mark's state is one of four, an element it names is in the model
    const built = events.filter((e) => e.step === 'BUILT_FROM')
    expect(built.length).toBeGreaterThan(0)
    const ids = new Set<string>()
    const model = r.reconstruction.model as unknown as Record<string, unknown>
    for (const v of Object.values(model)) if (Array.isArray(v)) for (const o of v) if (o && typeof o === 'object' && typeof (o as { id?: unknown }).id === 'string') ids.add((o as { id: string }).id)
    const named = built.flatMap((e) => e.marks).filter((m) => m.elementId)
    expect(named.length).toBeGreaterThan(0)
    for (const m of named) expect(ids.has(m.elementId as string)).toBe(true)
    for (const m of built.flatMap((e) => e.marks)) expect(['CANDIDATE', 'READ', 'ACCEPTED', 'REJECTED']).toContain(m.status)
    // counts never run backwards, and the solver's own once it is done
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].counts.ocrCandidates).toBeGreaterThanOrEqual(events[i - 1].counts.ocrCandidates)
      expect(events[i].counts.measurementsRead).toBeGreaterThanOrEqual(events[i - 1].counts.measurementsRead)
    }
    const last = events[events.length - 1]
    expect(last.counts.openingsBuilt).toBeGreaterThan(0)
    expect(last.counts.elementsFromReadings).toBeGreaterThan(0)
    // the stream is write-only: the result carries no trace of it, and the source inspection names elements too
    expect(JSON.stringify(r.result)).not.toContain('keepsLastSheet')
    expect(r.result.sources?.sheets.some((s) => s.readings.some((x) => x.elementIds.length > 0))).toBe(true)
    expect(r.result.sources?.counts.openings?.model).toBeGreaterThan(0)
  }, 240_000)

  it('a listener that throws never fails the run', async () => {
    const r = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z'), live: () => { throw new Error('a broken listener') } })
    expect(r.result.modelId).toBeTruthy()
  }, 240_000)
})
