/** v3.45 DEV debug: the production level-mark path on one section, every step printed. args: <image> <metric-evidence.json> <sha256> */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { toGray } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { checkLevelReadings, levelCrops, levelLabels, levelReadingsFrom } from '@buildapp/source-metrics'
const [img, ev, sha] = process.argv.slice(-3)
const raster = decodeImage(new Uint8Array(readFileSync(img)))
const gray = toGray(raster)
const toks = (JSON.parse(readFileSync(ev, 'utf8')).ocrTokens as Array<{ text: string; box: { x0: number; x1: number; y0: number; y1: number }; orientation: string; variantByteHash: string }>).filter((t) => t.variantByteHash === sha)
console.log('tokens', toks.map((t) => `${t.text}@${t.orientation[0]}${Math.round(t.box.x0)},${Math.round(t.box.y0)},h${Math.round(t.box.y1 - t.box.y0)}`).join(' '))
const labels = levelLabels(raster, gray, toks.map((t) => ({ box: t.box, upright: t.orientation === 'HORIZONTAL' })))
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
const rd = await rec.recognise(levelCrops(gray, labels))
for (const l of labels) { const r = rd.find((x) => x.key === l.key); console.log(l.key, JSON.stringify(l.box), 'apex', l.apexRow, JSON.stringify(r?.greedy), r?.topK.slice(0, 2).map((k) => k.text).join(',')) }
const { readings, refused } = levelReadingsFrom(labels, rd)
console.log('heard', readings.map((r) => r.text).join(' '), '| refused', refused.map((r) => r.why).join(' ; '))
const v = checkLevelReadings(raster, readings, undefined, toks.map((t) => t.box))
console.log(v.why); for (const c of v.checks) console.log('  ', c.text, c.status, c.rowPx, c.residualPx, c.why.slice(0, 120))
await rec.release?.()
