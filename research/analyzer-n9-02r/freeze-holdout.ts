/**
 * N9-02R (research only): draws the synthetic facade holdout, writes its manifest (seed, truth, sha256 of every
 * raster's RGBA bytes) and, for inspection outside the repo, a PNG of each sheet with its truth drawn over it.
 *   npx vite-node research/analyzer-n9-02r/freeze-holdout.ts -- --manifest <file.json> [--png <dir outside repo>]
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { encodePng } from '../../packages/analysis-service/src/diagnostics.js'
import { HOLDOUT_SEED, HOLDOUT_VERSION, holdoutCases } from '../../packages/analysis-service/test/fixtures/facade-holdout.js'

const arg = (n: string): string | undefined => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : undefined)
const cases = holdoutCases()
const manifest = {
  version: HOLDOUT_VERSION,
  seed: HOLDOUT_SEED,
  generator: 'packages/analysis-service/test/fixtures/facade-holdout.ts',
  cases: cases.map((c) => ({ ...c.truth, size: { width: c.raster.width, height: c.raster.height }, sha256: createHash('sha256').update(c.raster.data).digest('hex') })),
  counts: { total: cases.length, accept: cases.filter((c) => c.truth.expected === 'ACCEPT').length, refuse: cases.filter((c) => c.truth.expected === 'REFUSE').length, either: cases.filter((c) => c.truth.expected === 'EITHER').length },
}
writeFileSync(arg('manifest') as string, JSON.stringify(manifest, null, 1))
const png = arg('png')
if (png) {
  mkdirSync(png, { recursive: true })
  for (const c of cases) {
    const d = new Uint8ClampedArray(c.raster.data)
    const mark = (x: number, y: number, rgb: [number, number, number]): void => {
      if (x < 0 || y < 0 || x >= c.raster.width || y >= c.raster.height) return
      const o = (y * c.raster.width + x) * 4
      d[o] = rgb[0]
      d[o + 1] = rgb[1]
      d[o + 2] = rgb[2]
    }
    for (let y = c.truth.eaveRow; y < c.truth.groundRow; y += 3) for (const x of [c.truth.wallX0, c.truth.wallX1]) mark(x, y, [255, 0, 255])
    for (let x = c.truth.outline.x0; x <= c.truth.outline.x1; x += 2) mark(x, c.truth.outline.y0, [255, 160, 0])
    writeFileSync(join(png, `${c.truth.id}.png`), encodePng({ width: c.raster.width, height: c.raster.height, data: d }))
  }
}
console.log(JSON.stringify(manifest.counts))
