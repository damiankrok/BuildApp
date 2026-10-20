/**
 * 005X-N2: the tinted-callout prefilter must not change what is read. Runs `readTintedCallouts` with and without it on
 * plan pictures given on the command line (kept OUTSIDE the repository) and prints, per picture, the time of each and
 * whether the readings are identical.
 *
 *   npx vite-node research/analyzer-005x-n2-photo-generalization/callout-prefilter-check.ts -- <minR> <maxR> <picture>...
 */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { readTintedCallouts } from '@buildapp/source-metrics'

const [minR, maxR, ...pictures] = process.argv.slice(2)
for (const p of pictures) {
  const raster = decodeImage(new Uint8Array(readFileSync(p))) as never
  const t0 = performance.now()
  const full = readTintedCallouts(raster, { minRadiusPx: Number(minR), maxRadiusPx: Number(maxR), prefilter: false })
  const t1 = performance.now()
  const fast = readTintedCallouts(raster, { minRadiusPx: Number(minR), maxRadiusPx: Number(maxR) })
  const t2 = performance.now()
  const same = JSON.stringify(full) === JSON.stringify(fast)
  console.log(JSON.stringify({ picture: p.split('/').pop(), callouts: full.length, read: full.filter((c) => c.widthCm !== null).length, fullMs: Math.round(t1 - t0), prefilterMs: Math.round(t2 - t1), identical: same }))
}
