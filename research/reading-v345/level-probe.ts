/**
 * v3.45 research probe (no production effect): on a section's original bytes, take the template reader's horizontal
 * tokens that stand over a level symbol, widen each to the ink run of its row, and read the crop with the shipped
 * numeric recogniser. Prints what each reader read, so the level-mark reader can be designed on DEV sections only.
 * usage: vite-node research/reading-v345/level-probe.ts -- <cases.json>   cases: [{project, path, evidence, sha256}]
 */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { toGray } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { labelCrop, markerApexBelow } from '@buildapp/source-metrics'

type Box = { x0: number; x1: number; y0: number; y1: number }
const cases = JSON.parse(readFileSync(process.argv[process.argv.length - 1], 'utf8')) as Array<{ project: string; path: string; evidence: string; sha256: string }>
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
for (const c of cases) {
  const raster = decodeImage(new Uint8Array(readFileSync(c.path)))
  const gray = toGray(raster)
  const m = JSON.parse(readFileSync(c.evidence, 'utf8'))
  const toks = (m.ocrTokens as Array<{ text: string; box: Box; orientation: string; heightPx: number }>).filter((t) => t.variantByteHash === c.sha256 && t.orientation === 'HORIZONTAL' && t.heightPx >= 10)
  const dark = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < gray.width && y < gray.height && gray.data[y * gray.width + x] < 170
  const colInk = (x: number, b: Box): boolean => { for (let y = Math.round(b.y0); y <= Math.round(b.y1); y += 1) if (dark(x, y)) return true; return false }
  const widen = (b: Box): Box => {
    const h = b.y1 - b.y0; const gap = Math.max(3, Math.round(h * 0.45))
    let x0 = Math.round(b.x0); let x1 = Math.round(b.x1)
    for (let miss = 0, x = x0 - 1; miss <= gap && x >= 0; x -= 1) { if (colInk(x, b)) { x0 = x; miss = 0 } else miss += 1 }
    for (let miss = 0, x = x1 + 1; miss <= gap && x < gray.width; x += 1) { if (colInk(x, b)) { x1 = x; miss = 0 } else miss += 1 }
    return { x0, x1, y0: b.y0, y1: b.y1 }
  }
  const crops = []; const meta = []
  for (const t of toks) {
    const apex = markerApexBelow(raster, t.box)
    if (!apex) continue
    const box = widen(t.box)
    meta.push({ t, box, apex }); crops.push(labelCrop(`k${crops.length}`, gray, box))
  }
  const readings = await rec.recognise(crops)
  console.log(`## ${c.project} ${c.sha256.slice(0, 10)} tokens=${toks.length} withSymbol=${meta.length}`)
  for (const r of readings) {
    const i = Number(r.key.slice(1)); const { t, box, apex } = meta[i]
    console.log(`  template=${JSON.stringify(t.text).padEnd(10)} greedy=${JSON.stringify(r.greedy.text).padEnd(10)} p=${r.greedy.meanP} top=${r.topK.slice(0, 2).map((k) => `${k.text}:${k.p}`).join(',')} stable=${r.stable} box=${Math.round(box.x0)}-${Math.round(box.x1)},${Math.round(box.y0)}-${Math.round(box.y1)} apexRow=${apex.row}`)
  }
}
await rec.release?.()
