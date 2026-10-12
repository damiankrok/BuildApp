/**
 * glyph-read.ts — BUILDPLAN-ANALYZER-005O: the frozen readers on the 005O glyph corpus (RESEARCH ONLY).
 *
 *   npx vite-node research/analyzer-005o/glyph-read.ts -- --dir /home/user/work005o/glyphs --out /home/user/work005o/glyph-reads.json
 *
 * Every page of `glyph_corpus.py` is read the way the analyzer reads a plan label (the 005H synthetic gate's path):
 * readNumbers (all hypotheses, pass fields kept) → the label's token (the longest in the pass that reads it upright) →
 * the classic token text → labelLattice → labelCrop(passBox) → the deployed PP-OCRv6 (four-variant bracket) → the frozen
 * ensembleOf. Nothing is scored here; `glyph_score.py` holds the printed values.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { ensembleOf, labelCrop, labelLattice, readNumbers } from '@buildapp/source-metrics'
import type { LabelCrop } from '@buildapp/source-metrics'
import { inlineRecogniser, workspaceAssetPaths } from '@buildapp/numeric-recogniser-ort'

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const dir = arg('dir')!
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { rows: Array<{ id: string; turn: 'UPRIGHT' | 'CW' | 'CCW' }> }
type Out = { id: string; found: boolean; token?: string; tokenOrientation?: string; lattice?: { asRead: string; asReadValueCm?: number; ocrClass: string }; external?: unknown; ensemble?: unknown }
const rows: Out[] = []
const crops: Array<{ crop: LabelCrop; row: Out; lattice: ReturnType<typeof labelLattice> }> = []
for (const m of manifest.rows) {
  const png = PNG.sync.read(readFileSync(join(dir, `${m.id}.png`)))
  const raster = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }
  const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
  // a label turned clockwise reads upright in the ROTATED_CCW pass and the other way round (the 005H gate's rule)
  const want = m.turn === 'UPRIGHT' ? 'HORIZONTAL' : m.turn === 'CW' ? 'ROTATED_CCW' : 'ROTATED_CW'
  const along = (t: { box: { x0: number; x1: number; y0: number; y1: number } }): number => Math.max(t.box.x1 - t.box.x0, t.box.y1 - t.box.y0)
  const token = (read.raw ?? []).filter((t) => t.orientation === want && t.passBox && read.passes?.[t.orientation]).sort((a, b) => along(b) - along(a))[0]
  const row: Out = { id: m.id, found: Boolean(token) }
  rows.push(row)
  if (!token || !token.passBox) continue
  const field = read.passes![token.orientation]!
  row.token = token.text
  row.tokenOrientation = token.orientation
  const lattice = labelLattice({ orientation: token.orientation, ink: field, page: { width: raster.width, height: raster.height } }, token)
  if (lattice) row.lattice = { asRead: lattice.asRead, ...(lattice.asReadValueCm !== undefined ? { asReadValueCm: lattice.asReadValueCm } : {}), ocrClass: lattice.ocrClass }
  crops.push({ crop: labelCrop(m.id, field, token.passBox), row, lattice })
}
const recogniser = inlineRecogniser({ paths: workspaceAssetPaths() })
const t0 = performance.now()
const readings = await recogniser.recognise(crops.map((c) => c.crop))
const ms = performance.now() - t0
await recogniser.release()
const byKey = new Map(readings.map((x) => [x.key, x]))
for (const { row, lattice } of crops) {
  const x = byKey.get(row.id)
  if (!x) continue
  row.external = { topK: x.topK, greedy: x.greedy, stable: x.stable, variants: x.variants }
  row.ensemble = ensembleOf(lattice ? { asRead: lattice.asRead, asReadValueCm: lattice.asReadValueCm, ocrClass: lattice.ocrClass } : { asRead: '', asReadValueCm: undefined, ocrClass: 'LOW_QUALITY' }, x)
}
writeFileSync(arg('out')!, `${JSON.stringify({ schema: 'buildapp.005o.glyph-reads', recogniser: { id: recogniser.id, model: recogniser.model }, node: process.version, recogniseMs: Math.round(ms), crops: crops.length, rows }, null, 0)}\n`)
process.stdout.write(`${rows.length} pages, ${rows.filter((r) => r.found).length} tokens found, ${crops.length} crops read in ${Math.round(ms)} ms\n`)
