/**
 * v3.46 research probe (DEV design data; no production effect by itself): run the section-heights reader on each
 * section's original bytes with the template OCR tokens and the level-ladder registration stored in a run's metric
 * evidence, and print what it admits and refuses next to the annotated vertical dimensions (section-signs.txt, H).
 * usage: vite-node research/reading-v346/section-heights-probe.ts -- <cases.json>
 *   cases: [{project, path, evidence, sha256, signs: [{value, x, y}]}]
 */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { toGray } from '@buildapp/source-cv'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'
import { judgeSectionHeights, sectionHeightCrops, sectionHeightLabels } from '../../packages/source-metrics/src/section-heights.js'

type Box = { x0: number; x1: number; y0: number; y1: number }
const cases = JSON.parse(readFileSync(process.argv[process.argv.length - 1], 'utf8')) as Array<{ project: string; path: string; evidence: string; sha256: string; signs: Array<{ value: number; x: number; y: number }> }>
const rec = inlineRecogniser({ paths: workspaceAssetPaths() })
const tot = { signs: 0, right: 0, wrong: 0, refusedOnSign: 0, admittedOff: 0, noScale: 0 }
for (const c of cases) {
  const gray = toGray(decodeImage(new Uint8Array(readFileSync(c.path))))
  const m = JSON.parse(readFileSync(c.evidence, 'utf8'))
  const reg = (m.coordinateRegistrations as Array<{ variantByteHash: string; plane: string; metresPerPixelY: number }>).find((r) => r.variantByteHash === c.sha256 && r.plane === 'SECTION_HY')
  tot.signs += c.signs.length
  if (!reg) {
    tot.noScale += c.signs.length
    console.log(`## ${c.project}: no section registration (${c.signs.length} signs)`)
    continue
  }
  const cmPerPx = reg.metresPerPixelY * 100
  const toks = (m.ocrTokens as Array<{ id: string; text: string; box: Box; orientation: string; variantByteHash: string }>).filter((t) => t.variantByteHash === c.sha256)
  const labels = sectionHeightLabels(toks)
  const readings = labels.length ? await rec.recognise(sectionHeightCrops(gray, labels)) : []
  const sheet = judgeSectionHeights(gray, labels, readings, cmPerPx)
  const verdicts = sheet.verdicts
  console.log(`  turn: ${sheet.why}`)
  const on = (b: Box, s: { x: number; y: number }): boolean => s.x >= b.x0 - 6 && s.x <= b.x1 + 6 && s.y >= b.y0 - 6 && s.y <= b.y1 + 6
  console.log(`## ${c.project} ${cmPerPx.toFixed(4)} cm/px`)
  for (const s of c.signs) {
    const here = verdicts.filter((v) => on(v.label.token.box, s))
    const adm = here.filter((v) => v.admitted)
    if (adm.some((v) => v.valueCm === s.value)) tot.right += 1
    else if (adm.length > 0) tot.wrong += 1
    else if (here.length > 0) tot.refusedOnSign += 1
    console.log(`  sign ${s.value} @${s.x},${s.y}: ${here.length === 0 ? 'no label read on it' : here.map((v) => `${v.admitted ? 'ADMIT' : 'refuse'} ${(v.text ?? v.label.token.text)}: ${v.why}`).join(' | ')}`)
  }
  for (const v of verdicts.filter((v) => v.admitted && !c.signs.some((s) => on(v.label.token.box, s)))) {
    tot.admittedOff += 1
    console.log(`  ADMITTED OFF-SIGN ${(v.text ?? v.label.token.text)} at ${JSON.stringify(v.label.token.box)}: ${v.why}`)
  }
}
console.log(JSON.stringify(tot))
