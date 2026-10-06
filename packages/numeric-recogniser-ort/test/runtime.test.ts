/**
 * The runtime, end to end: ONNX Runtime Web loads only the verified files it is handed and reaches no network; the
 * worker the analyzer runs reads exactly what the in-process engine reads; a batch reports its progress, can be
 * cancelled at once, and leaves no worker behind.
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cropForToken } from '@buildapp/source-metrics'
import type { LabelCrop } from '@buildapp/source-metrics'
import { renderLabel } from '@buildapp/synthetic-drawings'
import { RecogniserAssetError, forbidNetwork, inlineRecogniser, openEngine, workerRecogniser, workspaceAssetPaths } from '../src/index.js'
// @ts-expect-error — a plain ES module without type declarations
import { bundleRecogniserWorker } from '../build.mjs'

const labels = ['1950', '648', '2590', '1173', '1580', '850']
const crops: LabelCrop[] = labels.map((text, i) => {
  const r = renderLabel(text, { capHeight: 12 + (i % 3), slant: 0.1 * (i % 2), seed: 7 + i })
  const g = { width: r.raster.width, height: r.raster.height, data: Uint8ClampedArray.from({ length: r.raster.width * r.raster.height }, (_, k) => r.raster.data[k * 4]) }
  return { key: `label-${text}`, gray: cropForToken(g, r.box), capPx: Math.round(r.box.y1 - r.box.y0) }
})

const realFetch = globalThis.fetch
const fetched: string[] = []
beforeAll(() => {
  globalThis.fetch = (async (input: unknown) => {
    fetched.push(String(input))
    throw new Error(`network: ${String(input)}`)
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = realFetch
})

describe('the engine', () => {
  it('loads from the verified files alone and reads the labels, with no network', async () => {
    const engine = await openEngine(workspaceAssetPaths())
    try {
      const out = []
      for (const c of crops) out.push(await engine.read(c))
      expect(out.map((r) => r.topK[0]?.text)).toEqual(labels)
      for (const r of out) {
        expect(r.variants.map((v) => v.variant)).toEqual(['BASE', 'PAD2', 'TRIM1', 'SCALE90'])
        expect(r.stable).toBe(r.variants.every((v) => v.top === r.variants[0].top))
        expect(r.engine).toBe('ocr.ppocrv6-tiny-rec@9ef676d6')
      }
    } finally {
      await engine.release()
    }
    expect(fetched).toEqual([])
  })

  it('refuses a missing runtime rather than looking for it anywhere else', async () => {
    await expect(openEngine({ ...workspaceAssetPaths(), wasm: join(tmpdir(), 'no-such-ort.wasm') })).rejects.toThrow(RecogniserAssetError)
    expect(fetched).toEqual([])
  })
})

describe('the worker the analyzer runs', () => {
  let workerUrl: URL
  beforeAll(async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ocr-worker-')), 'ocr-worker.mjs')
    await bundleRecogniserWorker(file)
    workerUrl = pathToFileURL(file)
  }, 60_000)

  it('reads what the in-process engine reads, label for label, and reports each label', async () => {
    const inline = inlineRecogniser({ paths: workspaceAssetPaths() })
    const expected = await inline.recognise(crops)
    await inline.release()
    const worker = workerRecogniser({ workerUrl, paths: workspaceAssetPaths() })
    const progress: number[] = []
    const got = await worker.recognise(crops, { onProgress: (done) => progress.push(done) })
    expect(got).toEqual(expected)
    // while it loads it says so (0 of n: the files verified, the session created), then each label once, forward
    expect(progress).toEqual([0, 0, ...crops.map((_, i) => i + 1)])
    const [stats] = worker.stats()
    expect(stats).toMatchObject({ crops: crops.length, mode: 'WORKER', outcome: 'READ' })
    expect(stats.rss?.afterLoadBytes).toBeGreaterThan(0)
    expect(stats.rss?.afterOcrBytes).toBeGreaterThan(0)
    expect(stats.rss?.afterExitBytes).toBeGreaterThan(0)
    await worker.release()
    await worker.release()
  })

  it('a cancel ends the batch at once and the worker with it', async () => {
    const worker = workerRecogniser({ workerUrl, paths: workspaceAssetPaths() })
    const controller = new AbortController()
    const started = performance.now()
    const run = worker.recognise([...crops, ...crops, ...crops, ...crops], { signal: controller.signal, onProgress: (done) => (done === 1 ? controller.abort() : undefined) })
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(performance.now() - started).toBeLessThan(30_000)
    // the cancelled batch is on the record too, with what memory it reached (red team C7)
    const [stats] = worker.stats()
    expect(stats).toMatchObject({ outcome: 'CANCELLED', error: 'AbortError', perCropMs: [] })
    expect(stats.rss?.afterLoadBytes).toBeGreaterThan(0)
    expect(stats.rss?.afterOcrBytes).toBeUndefined()
  })

  it('a worker silent past its watchdog is ended, by name (red team C3)', async () => {
    const worker = workerRecogniser({ workerUrl, paths: workspaceAssetPaths(), watchdog: { loadMs: 1, cropMs: 1 } })
    await expect(worker.recognise(crops)).rejects.toMatchObject({ name: 'RecogniserTimeout' })
    expect(worker.stats()[0]).toMatchObject({ outcome: 'FAILED', error: 'RecogniserTimeout' })
  })

  it('release ends every batch in flight, as a cancel (red team C9)', async () => {
    const worker = workerRecogniser({ workerUrl, paths: workspaceAssetPaths() })
    // both outcomes are held before the release, so neither rejection is ever unhandled
    const outcomes = Promise.allSettled([worker.recognise(crops), worker.recognise(crops)])
    await worker.release()
    const [a, b] = await outcomes
    expect(a).toMatchObject({ status: 'rejected', reason: { name: 'AbortError' } })
    expect(b).toMatchObject({ status: 'rejected', reason: { name: 'AbortError' } })
    expect(worker.stats().map((x) => x.outcome)).toEqual(['CANCELLED', 'CANCELLED'])
  })

  it('where no private copy of the loader can be written (no $TMPDIR, as on Android), it reads from the verified file', async () => {
    const before = process.env.TMPDIR
    process.env.TMPDIR = join(tmpdir(), 'no-such-scratch-dir', 'deeper')
    try {
      // the worker's environment is the parent's, copied when it starts
      const worker = workerRecogniser({ workerUrl, paths: workspaceAssetPaths() })
      const inline = inlineRecogniser({ paths: workspaceAssetPaths() })
      const expected = await inline.recognise(crops)
      await inline.release()
      expect(await worker.recognise(crops)).toEqual(expected)
    } finally {
      if (before === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = before
    }
  })

  it('a worker that fails says how, by code (never a path) — not that it exited', async () => {
    const worker = workerRecogniser({ workerUrl, paths: { ...workspaceAssetPaths(), dictionary: join(tmpdir(), 'no-such-dictionary.json') } })
    const error = await worker.recognise(crops).then(
      () => undefined,
      (e: unknown) => e as Error & { code?: string },
    )
    expect(error?.name).toBe('RecogniserAssetError')
    expect(error?.message).not.toMatch(/exited \(/)
  })

  it('in the worker, fetch fails by name: no code path can reach the network (red team B4)', async () => {
    const scope: { fetch?: unknown } = { fetch: () => Promise.resolve('network') }
    forbidNetwork(scope)
    await expect((scope.fetch as () => Promise<unknown>)()).rejects.toThrow(/no network/)
    // and the bundled worker installs that guard before it opens the engine
    const source = readFileSync(fileURLToPath(workerUrl), 'utf8')
    expect(source.indexOf('the recogniser has no network')).toBeGreaterThan(0)
  })

  it('a listener that throws (the analysis cancelling from its checkpoint) ends the batch with that error', async () => {
    const worker = workerRecogniser({ workerUrl, paths: workspaceAssetPaths() })
    await expect(
      worker.recognise(crops, {
        onProgress: () => {
          throw new Error('cancelled at a checkpoint')
        },
      }),
    ).rejects.toThrow('cancelled at a checkpoint')
  })

  it('an unpinned file fails the batch in the worker, by name', async () => {
    const worker = workerRecogniser({ workerUrl, paths: { ...workspaceAssetPaths(), model: join(tmpdir(), 'no-such-model.onnx') } })
    await expect(worker.recognise(crops)).rejects.toThrow(/model .* is missing/)
  })
})
