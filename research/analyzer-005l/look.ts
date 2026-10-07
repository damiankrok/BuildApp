/**
 * look.ts — BUILDPLAN-ANALYZER-005L (RESEARCH ONLY): a plan raster with rectangles drawn on it, for a developer's eyes.
 *
 *   npx vite-node research/analyzer-005l/look.ts -- --package <pkg.json> --graph <graph.json> --cache <dir> --frame <frameId>
 *        --rects <json [[x0,y0,x1,y1,"#rrggbb"],...]> --out <png outside the repository>
 *
 * The picture is publisher-derived and is written outside the repository only; nothing here is committed but code.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { PNG } from 'pngjs'

const arg = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) throw new Error(`--${name} is required`)
  return process.argv[i + 1]
}
const out = resolve(arg('out'))
if (out.startsWith(resolve(import.meta.dirname, '../..'))) throw new Error('pictures stay outside the repository')
const pkg = JSON.parse(readFileSync(arg('package'), 'utf8')) as SourcePackage
const graph = JSON.parse(readFileSync(arg('graph'), 'utf8')) as SourceObservationGraph
const frame = graph.coordinateFrames.find((f) => f.id === arg('frame'))
if (!frame) throw new Error('no such frame')
const variant = pkg.assets.flatMap((a) => a.variants).find((v) => v.byteHash === frame.variantByteHash)
if (!variant) throw new Error('no such variant')
const got = await fileByteCache(arg('cache')).get(variant.url)
if (!got) throw new Error('not cached')
const raster = decodeImage(got.bytes)
const png = new PNG({ width: raster.width, height: raster.height })
for (let i = 0; i < raster.width * raster.height; i += 1) {
  // RGBA, composited over white: a transparent GIF background decodes as black with alpha 0
  const alpha = raster.data[i * 4 + 3] / 255
  for (let k = 0; k < 3; k += 1) png.data[i * 4 + k] = Math.round(raster.data[i * 4 + k] * alpha + 255 * (1 - alpha))
  png.data[i * 4 + 3] = 255
}
const rects = JSON.parse(arg('rects')) as Array<[number, number, number, number, string]>
for (const [x0, y0, x1, y1, colour] of rects) {
  const r = parseInt(colour.slice(1, 3), 16)
  const g = parseInt(colour.slice(3, 5), 16)
  const b = parseInt(colour.slice(5, 7), 16)
  const put = (x: number, y: number): void => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= raster.width || yi >= raster.height) return
    const k = (yi * raster.width + xi) * 4
    png.data[k] = r
    png.data[k + 1] = g
    png.data[k + 2] = b
  }
  for (let x = x0; x <= x1; x += 1) for (const y of [y0, y0 + 1, y1 - 1, y1]) put(x, y)
  for (let y = y0; y <= y1; y += 1) for (const x of [x0, x0 + 1, x1 - 1, x1]) put(x, y)
}
writeFileSync(out, PNG.sync.write(png))
process.stdout.write(`${out}\n`)
