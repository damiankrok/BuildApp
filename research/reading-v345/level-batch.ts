/** v3.45 DEV batch: the production level-mark path (labels → recogniser → hearing → drawing checks) on every case. args: <cases.json> <out.json> */
import { readFileSync, writeFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { toGray } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { checkLevelReadings, levelCrops, levelLabels, levelReadingsFrom } from '@buildapp/source-metrics'
const [casesPath, outPath] = process.argv.slice(-2)
const cases = JSON.parse(readFileSync(casesPath, 'utf8')) as Array<{ project: string; path: string; evidence: string; sha256: string }>
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
const out: unknown[] = []
for (const c of cases) {
  const raster = decodeImage(new Uint8Array(readFileSync(c.path)))
  const gray = toGray(raster)
  const toks = (JSON.parse(readFileSync(c.evidence, 'utf8')).ocrTokens as Array<{ box: { x0: number; x1: number; y0: number; y1: number }; orientation: string; variantByteHash: string }>).filter((t) => t.variantByteHash === c.sha256)
  const labels = levelLabels(raster, gray, toks.map((t) => ({ box: t.box, upright: t.orientation === 'HORIZONTAL' })))
  const rd = await rec.recognise(levelCrops(gray, labels))
  const { readings, refused } = levelReadingsFrom(labels, rd)
  const v = checkLevelReadings(raster, readings, undefined, toks.map((t) => t.box))
  const admitted = v.admitted ? v.checks.filter((k) => k.status === 'ON_LADDER').map((k) => k.value) : []
  console.log(c.project.slice(0, 28).padEnd(28), v.admitted ? 'ADMITTED' : 'refused ', JSON.stringify(admitted), '| heard', readings.map((r) => r.text).join(' '), '|', v.admitted ? '' : v.why.slice(0, 90))
  out.push({ project: c.project, sha256: c.sha256, admitted: v.admitted, zeroAnchor: v.zeroAnchor, values: admitted, heard: readings.map((r) => r.text), refused: refused.map((r) => r.why), checks: v.checks })
}
writeFileSync(outPath, JSON.stringify(out, null, 1))
await rec.release?.()
