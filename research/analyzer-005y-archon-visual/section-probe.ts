/** 005Y-N1 diagnostic (research only): the two-anchor section registration on one decoded section PNG. */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { registerSection, registerSectionByTwoAnchors } from '../../packages/reconstruction/src/v2/roof-details.js'
const [png, levelsJson, spansJson] = process.argv.slice(-3)
const raster = decodeImage(readFileSync(png))
const levels = JSON.parse(levelsJson)
const spans = JSON.parse(spansJson)
for (const hint of [0.0143, 0.0148]) {
  const r = registerSection(raster, hint, 600, spans, 'f')
  console.log('hint', hint, r ? { mpp: r.mpp, origin: r.originCol, axis: r.axis } : 'none')
}
console.log(registerSectionByTwoAnchors(raster, levels, spans, 'f')?.why ?? 'two-anchor none')
import { sectionStackOver } from '../../packages/reconstruction/src/v2/roof-details.js'
const two = registerSectionByTwoAnchors(raster, levels, spans, 'f')
if (two && process.env.BLOCKS) for (const b of JSON.parse(process.env.BLOCKS)) {
  const s = two.section
  console.log('block', b, 'px', s.pxOf(b.from), s.pxOf(b.to), 'roof row', s.pyOf(b.roofY + 0.1), '->', sectionStackOver(raster, s, b, b.roofY))
}
