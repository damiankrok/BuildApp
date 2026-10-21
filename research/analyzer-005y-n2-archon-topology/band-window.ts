/**
 * 005Y-N2 diagnostics: the wall bands a plan raster yields under the sheet's thickness window and under a wider one —
 * the bands only the wider window admits, with their length and thickness. Reads a PNG outside the repository.
 *   npx vite-node research/analyzer-005y-n2-archon-topology/band-window.ts -- <plan.png> [wallPx]
 */
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { adaptiveInkMask, inkChannel, runLengthBands } from '@buildapp/source-cv'
import { bandWallThickness } from '../../packages/reconstruction/src/plan-decomposition.js'

const [path] = process.argv.slice(2).filter((a) => a !== '--')
const png = PNG.sync.read(readFileSync(path))
const raster = { width: png.width, height: png.height, channels: 4 as const, data: new Uint8ClampedArray(png.data) }
const mask = adaptiveInkMask(inkChannel(raster as never), {})
const survey = runLengthBands(mask, { minThickness: 6, maxThickness: 40, minLength: 24 })
const wallPx = bandWallThickness(survey, 12)
const narrow = runLengthBands(mask, { minThickness: Math.max(3, Math.round(wallPx * 0.45)), maxThickness: Math.max(6, Math.round(wallPx * 1.9)), minLength: Math.max(8, Math.round(wallPx * 1.6)) })
const wide = runLengthBands(mask, { minThickness: Math.max(3, Math.round(wallPx * 0.45)), maxThickness: Math.max(6, Math.round(wallPx * 1.9), Math.round(wallPx * 2) + 1), minLength: Math.max(8, Math.round(wallPx * 1.6)) })
const key = (b: (typeof wide)[number]) => `${b.axis}:${b.bounds.x0},${b.bounds.y0},${b.bounds.x1},${b.bounds.y1}`
const had = new Set(narrow.map(key))
console.log(JSON.stringify({ wallPx, narrow: narrow.length, wide: wide.length }))
for (const b of wide.filter((b) => !had.has(key(b)))) console.log(JSON.stringify({ axis: b.axis, bounds: b.bounds, thickness: b.thickness, length: b.length }))
