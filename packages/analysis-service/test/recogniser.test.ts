/**
 * BUILDPLAN-ANALYZER-005H at the service: what a run does with an external recogniser that fails, that cannot be
 * released, or that reads nothing — with fixture recognisers, no ONNX Runtime.
 *
 *  - a recogniser that fails (its worker out of memory, exited, refused its files, silent past its watchdog) ends the
 *    run as ANALYSIS_FAILED / EXTERNAL_RECOGNISER_FAILED in EXTRACTING_OBSERVATIONS / OCR_EXTERNAL, its kind named —
 *    not an unexpected internal error, and never a quiet fall back to the custom reader alone;
 *  - a recogniser that fails to release after reading is recorded on the result and never replaces the outcome;
 *  - a recogniser that reads nothing leaves the run's hashes those of a run without one;
 *  - the summary counts corroboration as the rule defines it.
 */
import { describe, expect, it } from 'vitest'
import { memoryByteCache } from '@buildapp/source-package'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { ExternalReading, LabelRecogniser } from '@buildapp/source-metrics'
import { AnalysisError, hashesOf, recogniserFailureKind, runAnalysis } from '../src/index.js'

const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
const run = (recogniser?: LabelRecogniser) => runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z'), ...(recogniser ? { recogniser } : {}) })

const identity = { id: 'ocr.fixture@0', model: { name: 'fixture', sha256: 'c'.repeat(64) }, runtime: 'fixture' }
const failingWith = (error: Error): LabelRecogniser => ({ ...identity, recognise: async () => Promise.reject(error) })
const oom = Object.assign(new Error('Worker terminated due to reaching memory limit: JS heap out of memory'), { code: 'ERR_WORKER_OUT_OF_MEMORY' })

describe('a recogniser that fails stops the run by name', () => {
  it('out of memory: ANALYSIS_FAILED / EXTERNAL_RECOGNISER_FAILED, in the stage and sub-phase it happened, its kind named', async () => {
    const error = await run(failingWith(oom)).then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(AnalysisError)
    expect((error as AnalysisError).failure()).toMatchObject({
      code: 'ANALYSIS_FAILED',
      reasonCode: 'EXTERNAL_RECOGNISER_FAILED',
      stage: 'EXTRACTING_OBSERVATIONS',
      substage: 'OCR_EXTERNAL',
      diagnostics: { recogniserFailure: 'OUT_OF_MEMORY' },
    })
    // the raw message never crosses to a client; its code does
    expect(JSON.stringify((error as AnalysisError).failure())).not.toContain('heap')
    expect((error as AnalysisError).failure().diagnostics).toMatchObject({ recogniserError: 'ERR_WORKER_OUT_OF_MEMORY' })
  }, 120_000)

  it('a failure with a path in its message carries its code and never the path', async () => {
    const error = await run(failingWith(Object.assign(new Error("the recogniser worker failed: ENOENT: no such file or directory, mkdtemp '/data/user/0/app/files/x'"), { code: 'ENOENT' }))).then(
      () => undefined,
      (e: unknown) => e,
    )
    const failure = (error as AnalysisError).failure()
    expect(failure).toMatchObject({ reasonCode: 'EXTERNAL_RECOGNISER_FAILED', diagnostics: { recogniserFailure: 'FAILED', recogniserError: 'ENOENT' } })
    expect(JSON.stringify(failure)).not.toContain('/data/')
  }, 120_000)

  it('names each kind of failure', () => {
    expect(recogniserFailureKind(oom)).toBe('OUT_OF_MEMORY')
    expect(recogniserFailureKind(new RangeError('WebAssembly.Memory(): could not allocate memory'))).toBe('OUT_OF_MEMORY')
    expect(recogniserFailureKind(Object.assign(new Error('the recogniser worker failed: the model is missing'), { name: 'RecogniserAssetError' }))).toBe('ASSETS_REFUSED')
    expect(recogniserFailureKind(Object.assign(new Error('no sign of life'), { name: 'RecogniserTimeout' }))).toBe('TIMEOUT')
    expect(recogniserFailureKind(new Error('the recogniser worker exited (1) before it answered'))).toBe('WORKER_EXITED')
    expect(recogniserFailureKind(new Error('something else'))).toBe('FAILED')
    // a worker that answered with an error did not exit: it failed, and says how by its code
    expect(recogniserFailureKind(Object.assign(new Error("the recogniser worker failed: ENOENT: no such file or directory, mkdtemp '/tmp/x'"), { code: 'ENOENT' }))).toBe('FAILED')
  })

  it('a cancel is still a cancel, not a recogniser failure', async () => {
    const controller = new AbortController()
    const cancelling: LabelRecogniser = {
      ...identity,
      recognise: async () => {
        controller.abort()
        throw new DOMException('the recognition was cancelled', 'AbortError')
      },
    }
    const error = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), recogniser: cancelling, signal: controller.signal }).then(
      () => undefined,
      (e: unknown) => e,
    )
    expect((error as AnalysisError).code).toBe('CANCELLED')
  }, 120_000)
})

describe('what a run with a recogniser records', () => {
  it('a release that fails after the reading is recorded, and the run completes as it would have', async () => {
    const reading = (key: string, text: string): ExternalReading => ({ key, engine: identity.id, modelSha256: identity.model.sha256, runtime: 'fixture', topK: [{ text, p: 0.99 }], greedy: { text, meanP: 0.99 }, stable: true, variants: (['BASE', 'PAD2', 'TRIM1', 'SCALE90'] as const).map((variant) => ({ variant, top: text, p: 0.99 })) })
    const noisy: LabelRecogniser = {
      ...identity,
      recognise: async (crops) => crops.map((c) => reading(c.key, '9999')),
      release: async () => {
        throw new Error('the recogniser worker exited (1) before it answered')
      },
    }
    const { result } = await run(noisy)
    expect(result.recogniser).toMatchObject({ id: identity.id, releaseFailure: 'WORKER_EXITED' })
    expect(result.recogniser?.crops).toBeGreaterThan(0)
    // a confident, stable 9999 that is the model's own reading corroborates; it disagrees with every label, so none agrees
    expect(result.recogniser?.corroborating).toBe(result.recogniser?.crops)
    expect(result.recogniser?.agrees).toBe(0)
    expect((result.recogniser?.disagreements ?? 0) + (result.recogniser?.leads ?? 0)).toBeGreaterThan(0)
  }, 120_000)

  it('a recogniser that reads nothing leaves every hash of a run without one', async () => {
    const silent: LabelRecogniser = { ...identity, recognise: async () => [] }
    const [off, on] = [await run(), await run(silent)]
    expect(hashesOf(on.result)).toEqual(hashesOf(off.result))
    expect(on.result.recogniser).toMatchObject({ crops: 0, corroborating: 0 })
  }, 120_000)
})
