/** E12 probe (research): which rings the opening-callout reader keeps around a point of a plan. Prints ring geometry and readings only. */
import { readFileSync } from 'node:fs'
import { decodeImage as decodeRaster } from '@buildapp/source-package'
import { readOpeningCallouts } from '@buildapp/source-metrics'
const [file, cx, cy, half] = process.argv.slice(2).filter((a) => a !== '--')
const raster = decodeRaster(new Uint8Array(readFileSync(file)))
const x = Number(cx), y = Number(cy), h = Number(half ?? 40)
for (const c of readOpeningCallouts(raster, { region: { x0: x - h, y0: y - h, x1: x + h, y1: y + h } })) console.log(JSON.stringify({ at: (c as unknown as { ring?: unknown }).ring ?? null, c: JSON.stringify(c).slice(0, 300) }))
