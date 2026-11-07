/** v3.45 DEV ring batch: for every ring the PRZED reader recorded on a plan, read its halves as cut (a) at the found circle
 * and (b) at the refitted circle; count halves/rings passing the gate. args: <cases.json: [{project,path,evidence,sha256}]> */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { inkChannel } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { judgeCalloutHalf, refineRingCircle, ringHalfCrops } from '@buildapp/source-metrics'
const cases = JSON.parse(readFileSync(process.argv[process.argv.length - 1], 'utf8')) as Array<{ project: string; path: string; evidence: string; sha256: string; frameId: string }>
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
const tot = { rings: 0, a: { w: 0, h: 0, both: 0 }, b: { w: 0, h: 0, both: 0 }, flips: 0 }
for (const c of cases) {
  const raster = decodeImage(new Uint8Array(readFileSync(c.path)))
  const ink = inkChannel(raster)
  const rings = (JSON.parse(readFileSync(c.evidence, 'utf8')).calloutRings as Array<{ frameId: string; centrePx: { x: number; y: number }; radiusPx: number; barY: number }>).filter((r) => r.frameId === c.frameId)
  const crops = []; const meta: Array<{ i: number; v: 'a' | 'b'; u?: number; l?: number }> = []
  for (const [i, r] of rings.entries()) {
    const circle = { cx: r.centrePx.x, cy: r.centrePx.y, radiusPx: r.radiusPx }
    for (const [v, cc] of [['a', circle], ['b', refineRingCircle(ink, circle)]] as const) {
      const h = ringHalfCrops(ink, cc, r.barY, `${v}${i}`)
      if (h.upper) crops.push(h.upper.crop); if (h.lower) crops.push(h.lower.crop)
      meta.push({ i, v, u: h.upper?.glyphs, l: h.lower?.glyphs })
    }
  }
  const rd = await rec.recognise(crops); const by = new Map(rd.map((x) => [x.key, x]))
  const out: string[] = []
  for (const [i, r] of rings.entries()) {
    tot.rings += 1
    const res: Record<string, { w: boolean; h: boolean; t: string }> = {}
    for (const v of ['a', 'b'] as const) {
      const m = meta.find((q) => q.i === i && q.v === v)!
      const w = judgeCalloutHalf(by.get(`${v}${i}u`), m.u ?? 0, 'width'); const h = judgeCalloutHalf(by.get(`${v}${i}l`), m.l ?? 0, 'height')
      tot[v].w += +w.accepted; tot[v].h += +h.accepted; tot[v].both += +(w.accepted && h.accepted)
      res[v] = { w: w.accepted, h: h.accepted, t: `${w.accepted ? w.text : '-'}/${h.accepted ? h.text : '-'}` }
    }
    if (res.a.w && res.b.w && res.a.t.split('/')[0] !== res.b.t.split('/')[0]) tot.flips += 1
    if (res.a.t !== res.b.t) out.push(`${Math.round(r.centrePx.x)},${Math.round(r.centrePx.y)} ${res.a.t} -> ${res.b.t}`)
  }
  console.log(c.project.slice(0, 26).padEnd(26), rings.length, 'rings |', out.join('; '))
}
console.log(JSON.stringify(tot))
await rec.release?.()
