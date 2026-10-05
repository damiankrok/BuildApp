/**
 * The recogniser on the calling thread (tests and research harnesses): one ONNX Runtime session for every batch, kept
 * until `release`. The analyzer never uses it — it runs the same engine in a worker that exits (`client.ts`).
 */
import type { ExternalReading } from '@buildapp/source-metrics'
import { openEngine } from './engine.js'
import type { Engine } from './engine.js'
import { abortError, recogniserIdentity } from './client.js'
import type { BatchStats, OrtRecogniser } from './client.js'
import type { RecogniserAssetPaths } from './manifest.js'

/** The same engine on the calling thread: one session, kept until `release`. Tests and research only. */
export function inlineRecogniser(options: { paths: RecogniserAssetPaths; clock?: () => number }): OrtRecogniser {
  const clock = options.clock ?? (() => performance.now())
  const history: BatchStats[] = []
  let engine: Promise<Engine> | undefined
  return {
    ...recogniserIdentity,
    async recognise(crops, o = {}) {
      if (crops.length === 0) return []
      if (o.signal?.aborted) throw abortError(o.signal)
      const fresh = engine === undefined
      engine ??= openEngine(options.paths, clock)
      let e: Engine
      try {
        e = await engine
      } catch (error) {
        // a load that failed is not kept: the next batch tries again, and `release` has nothing to rethrow
        engine = undefined
        throw error
      }
      const started = clock()
      const out: ExternalReading[] = []
      const perCropMs: number[] = []
      for (const [i, crop] of crops.entries()) {
        if (o.signal?.aborted) throw abortError(o.signal)
        const t0 = clock()
        out.push(await e.read(crop))
        perCropMs.push(Math.round(clock() - t0))
        o.onProgress?.(i + 1, crops.length)
      }
      history.push({ crops: crops.length, loadMs: fresh ? e.loadMs : 0, ocrMs: Math.round(clock() - started), perCropMs, mode: 'INLINE', outcome: 'READ' })
      return out
    },
    stats: () => history.slice(),
    release: async () => {
      const held = engine
      engine = undefined
      if (held) await (await held).release()
    },
  }
}
