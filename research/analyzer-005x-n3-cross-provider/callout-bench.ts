/**
 * 005X-N3: what the rooflight-only `requireBar` gate of `readTintedCallouts` saves, and that it loses nothing. On the
 * plan the v2 solver reads under a gable roof (same frame, region and radii as `reconstruct-v2.ts` passes), runs the
 * reader without the gate (the 005X-N2 behaviour) and with it, alternately, `reps` times each; prints median times, how
 * many circles reached the bar test and how many were sent to digit OCR, and whether the gated readings are exactly
 * the barred readings of the ungated run, in the same order. Bytes come from the offline cache; nothing is written.
 *
 *   npx vite-node research/analyzer-005x-n3-cross-provider/callout-bench.ts -- \
 *        --run <dir with observation-graph.json.gz> --package <source-package.json> --cache <dir> \
 *        --frame <frameId> --region x0,y0,x1,y1 --radii minR,maxR [--reps 5]
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import { readTintedCallouts } from '@buildapp/source-metrics'

const value = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}
const graph = JSON.parse(gunzipSync(readFileSync(join(value('run'), 'observation-graph.json.gz'))).toString('utf8'))
const frame = graph.coordinateFrames.find((f: { id: string }) => f.id === value('frame'))
if (!frame) throw new Error('frame not in the graph')
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const cache = fileByteCache(value('cache'))
let raster: ReturnType<typeof decodeImage> | undefined
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  if (variant.byteHash !== frame.variantByteHash) continue
  const got = await cache.get(variant.url)
  if (got) raster = decodeImage(got.bytes)
}
if (!raster) throw new Error('plan bytes not in the cache')
const [x0, y0, x1, y1] = value('region').split(',').map(Number)
const [minRadiusPx, maxRadiusPx] = value('radii').split(',').map(Number)
const reps = Number(value('reps', '5'))
const base = { region: { x0, y0, x1, y1 }, frameId: frame.id, minRadiusPx, maxRadiusPx }
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const times = { ungated: [] as number[], gated: [] as number[] }
let ungated: ReturnType<typeof readTintedCallouts> = []
let gated: ReturnType<typeof readTintedCallouts> = []
const stats = { ungated: { rings: 0, ocr: 0 }, gated: { rings: 0, ocr: 0 } }
for (let k = 0; k < reps; k++) {
  for (const mode of k % 2 === 0 ? (['ungated', 'gated'] as const) : (['gated', 'ungated'] as const)) {
    const s = { rings: 0, ocr: 0 }
    const t0 = performance.now()
    const r = readTintedCallouts(raster as never, { ...base, ...(mode === 'gated' ? { requireBar: true } : {}), stats: s })
    times[mode].push(performance.now() - t0)
    stats[mode] = s
    if (mode === 'gated') gated = r
    else ungated = r
  }
}
const barred = ungated.filter((c) => c.bar !== null)
console.log(
  JSON.stringify({
    frame: frame.id,
    reps,
    ungatedMs: Math.round(median(times.ungated)),
    gatedMs: Math.round(median(times.gated)),
    saving: +(1 - median(times.gated) / median(times.ungated)).toFixed(3),
    circles: stats.ungated.rings,
    ocrUngated: stats.ungated.ocr,
    ocrGated: stats.gated.ocr,
    readingsUngated: ungated.length,
    readingsBarred: barred.length,
    readingsGated: gated.length,
    barlessKept: ungated.length - barred.length,
    gatedEqualsBarred: JSON.stringify(gated) === JSON.stringify(barred),
    coherentPairsGated: gated.filter((c) => c.widthCm !== null).length,
  }),
)
