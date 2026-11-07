/** v3.45 DEV: read chosen rings' halves at given radii with the shipped recogniser and print the gate's verdicts. args: <image> <metric-evidence> <cx,cy;...> <radii csv> */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { inkChannel } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { judgeCalloutHalf, ringHalfCrops } from '@buildapp/source-metrics'
const [img, ev, pts, radii] = process.argv.slice(-4)
const raster = decodeImage(new Uint8Array(readFileSync(img)))
const ink = inkChannel(raster)
const rings = JSON.parse(readFileSync(ev, 'utf8')).calloutRings as Array<{ centrePx: { x: number; y: number }; radiusPx: number; barY: number }>
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
/** the ring's own stroke: darkness on the circle against paper just inside it, best over centre ±4 px and radius r0-1..r0+4 */
function refine(c: { cx: number; cy: number; r: number }): { cx: number; cy: number; r: number; score: number } {
  const g = (x: number, y: number): number => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= ink.width || yi >= ink.height ? 255 : ink.data[yi * ink.width + xi] }
  let best = { cx: c.cx, cy: c.cy, r: c.r, score: -1e9 }
  for (let dx = -4; dx <= 4; dx += 0.5) for (let dy = -4; dy <= 4; dy += 0.5) for (let r = c.r - 1; r <= c.r + 4; r += 0.5) {
    let on = 0, inside = 0
    for (let k = 0; k < 72; k += 1) { const a = (k / 72) * 2 * Math.PI; on += 255 - g(c.cx + dx + r * Math.cos(a), c.cy + dy + r * Math.sin(a)); inside += 255 - g(c.cx + dx + (r - 2.5) * Math.cos(a), c.cy + dy + (r - 2.5) * Math.sin(a)) }
    const score = (on - 0.6 * inside) / 72
    if (score > best.score) best = { cx: c.cx + dx, cy: c.cy + dy, r, score }
  }
  return best
}
for (const p of pts.split(';')) {
  const [x, y] = p.split(',').map(Number)
  const r = rings.reduce((a, b) => (Math.hypot(b.centrePx.x - x, b.centrePx.y - y) < Math.hypot(a.centrePx.x - x, a.centrePx.y - y) ? b : a))
  const rf = refine({ cx: r.centrePx.x, cy: r.centrePx.y, r: Math.max(r.radiusPx, Number(radii.split(',').slice(-1)[0]) - 2) })
  console.log('refined', JSON.stringify(rf))
  for (const rad of [-1, -2, -3]) {
    const circle = { cx: rf.cx, cy: rf.cy, radiusPx: rf.r }
    const h = ringHalfCrops(ink, circle, r.barY, 'k', rad === -1 ? 2.5 : rad === -2 ? 2.0 : 1.6)
    const rd = await rec.recognise([h.upper?.crop, h.lower?.crop].filter((c): c is NonNullable<typeof c> => !!c))
    const w = judgeCalloutHalf(rd.find((q) => q.key === 'ku'), h.upper?.glyphs ?? 0, 'width')
    const hh = judgeCalloutHalf(rd.find((q) => q.key === 'kl'), h.lower?.glyphs ?? 0, 'height')
    console.log(`${x},${y} variant${rad} bar ${r.barY}: W ${w.text} acc=${w.accepted} (${w.why.slice(0, 70)}) g=${h.upper?.glyphs} | H ${hh.text} acc=${hh.accepted} (${hh.why.slice(0, 70)}) g=${h.lower?.glyphs}`)
  }
}
await rec.release?.()
