/** v3.45 DEV: dump the recogniser's half crops of chosen rings as PGM (to look at). args: <image> <metric-evidence> <frameSha> <cx,cy;...> <outdir> */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { inkChannel } from '@buildapp/source-cv'
import { ringHalfCrops } from '@buildapp/source-metrics'
const [img, ev, sha, pts, out] = process.argv.slice(-5)
mkdirSync(out, { recursive: true })
const raster = decodeImage(new Uint8Array(readFileSync(img)))
const ink = inkChannel(raster)
const rings = (JSON.parse(readFileSync(ev, 'utf8')).calloutRings as Array<{ frameId: string; centrePx: { x: number; y: number }; radiusPx: number; barY: number }>)
for (const p of pts.split(';')) {
  const [x, y] = p.split(',').map(Number)
  const r = rings.reduce((a, b) => (Math.hypot(b.centrePx.x - x, b.centrePx.y - y) < Math.hypot(a.centrePx.x - x, a.centrePx.y - y) ? b : a))
  for (const rad of [r.radiusPx, 12]) {
    const h = ringHalfCrops(ink, { cx: r.centrePx.x, cy: r.centrePx.y, radiusPx: rad }, r.barY, 'k')
    for (const [n, c] of [['u', h.upper], ['l', h.lower]] as const) {
      if (!c) continue
      const g = c.crop.gray
      writeFileSync(`${out}/${x}_${y}_r${rad}_${n}.pgm`, Buffer.concat([Buffer.from(`P5 ${g.width} ${g.height} 255\n`), Buffer.from(g.data)]))
    }
    console.log(x, y, 'radius', rad, 'bar', r.barY, 'centre', r.centrePx)
  }
}
