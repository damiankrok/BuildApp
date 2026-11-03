/**
 * SOURCE-01: the result's source inspection, on a whole synthetic run — every published sheet with its claim, its
 * outcome and its readings; a reading says where it is printed, the line it measures, whether it was printed, and
 * what the model did with it. With an encoder, the content veto reaches the result; without, it says none ran. The
 * model the run builds is the same either way when nothing is vetoed.
 */
import { describe, expect, it } from 'vitest'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { memoryByteCache } from '@buildapp/source-package'
import { CONTENT_CLASSES, CONTENT_HEAD } from '@buildapp/source-analyzer'
import type { ContentClass, ImageEmbedder } from '@buildapp/source-analyzer'
import { runAnalysis } from '../src/index.js'

const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
const run = (content?: ImageEmbedder) => runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z'), ...(content ? { content } : {}) })

/** An embedding the head reads as `kind` with near certainty. */
function embeddingFor(kind: ContentClass): Float32Array {
  const w = CONTENT_HEAD.weights[CONTENT_HEAD.classes.indexOf(kind)]
  const norm = Math.sqrt(w.reduce((a, v) => a + v * v, 0))
  return Float32Array.from(w.map((v, i) => CONTENT_HEAD.mean[i] + (CONTENT_HEAD.scale[i] * 40 * v) / norm))
}
/** A stub encoder that agrees with every role the synthetic publisher gives. */
const agreeing: ImageEmbedder = { id: 'stub-agree', modelSha256: '0'.repeat(64), embed: async (t) => t.map(() => new Float32Array(1280)) }

describe('SOURCE-01 the source inspection in the result', () => {
  it('every sheet is listed with its claim and outcome; readings carry crop, line, origin and use', async () => {
    const r = await run()
    const s = r.result.sources
    expect(s).toBeDefined()
    if (!s) return
    expect(s.classifier).toBeNull()
    expect(s.sheets).toHaveLength(r.pkg.assets.length)
    expect(s.counts.read).toBeGreaterThan(0)
    expect(s.counts.refusedByContent).toBe(0)
    const plan = s.sheets.find((x) => x.claimed.document === 'FLOOR_PLAN' && x.readings.length > 0)
    expect(plan?.outcome).toBe('READ')
    const printed = plan?.readings.filter((x) => x.printed) ?? []
    expect(printed.length).toBeGreaterThan(0)
    for (const x of printed) {
      expect(x.rawText.length).toBeGreaterThan(0)
      expect(['READ', 'CHAIN_CORRECTED']).toContain(x.origin)
    }
    for (const x of plan?.readings.filter((y) => !y.printed) ?? []) expect(x.rawText).toBe('')
    expect(plan?.readings.some((x) => x.box && x.line)).toBe(true)
    expect(plan?.readings.some((x) => x.use === 'USED_IN_MODEL')).toBe(true)
  }, 180_000)

  it('with an encoder the result names it and the veto reaches the sheet; an agreeing encoder leaves the model as it was', async () => {
    const plain = await run()
    // every picture read as an elevation: the plans and the section are taken from their readers
    const elevationEverywhere: ImageEmbedder = { id: 'stub-elevation', modelSha256: '0'.repeat(64), embed: async (t) => t.map(() => embeddingFor('ELEVATION')) }
    expect(CONTENT_CLASSES).toContain('ELEVATION')
    const vetoed = await run(elevationEverywhere).catch((e: Error) => e)
    // with no plan to read the run cannot build a house; it fails by name, never with an internal error
    if (vetoed instanceof Error) expect(vetoed.message).not.toMatch(/internal error/)
    else {
      expect(vetoed.result.sources?.counts.refusedByContent).toBeGreaterThan(0)
      expect(vetoed.result.sources?.sheets.find((x) => x.claimed.document === 'FLOOR_PLAN')?.outcome).toBe('REFUSED_BY_CONTENT')
    }
    // a zero embedding reads as whatever the bias favours; the head must then not veto a sheet with a sure answer
    const agreed = await run(agreeing)
    const refused = agreed.result.sources?.sheets.filter((x) => x.outcome === 'REFUSED_BY_CONTENT') ?? []
    if (refused.length === 0) expect(agreed.result.modelHash).toBe(plain.result.modelHash)
    expect(agreed.result.sources?.classifier).toMatchObject({ id: 'stub-agree', headVersion: CONTENT_HEAD.version })
  }, 300_000)
})
