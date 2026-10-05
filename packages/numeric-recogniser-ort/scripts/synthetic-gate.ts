/**
 * The synthetic quality gate of the external recogniser (BUILDPLAN-ANALYZER-005H §15): 005G's 672 synthetic labels
 * (`@buildapp/synthetic-drawings` ocr-corpus — no publisher's pixel), each read the way the analyzer reads a label:
 *
 *   readNumbers (every hypothesis, the pass fields kept) → the label's token → labelLattice → labelCrop(token.passBox)
 *   → the recogniser (its four bracket reads) → ensembleOf (P2)
 *
 * and scored against the printed value. "Exact" is the external reader's top value; "confident" is the ensemble's
 * reading read CLEAR or SUPPORTED, and "confident-wrong" one of those that is not the printed value. The gate — exact
 * ≥ 650 of 672 and confident-wrong ≤ 2 of 672 — was fixed by the stage brief before this ran; nothing is tuned to it.
 * Also reported: the truth in the external top-3 / top-5, how many external readings were confident and wrong
 * ("false high confidence", before the bracket and the lattice weigh in), per set and per stratum.
 *
 *   npx vite-node packages/numeric-recogniser-ort/scripts/synthetic-gate.ts -- [--out file.json] [--limit N] [--crop pass|drawn] [--check]
 *
 * `--check` exits 1 when the gate fails (CI). Two crops:
 *
 *  - `--crop drawn` — 005G's protocol, the one the gate's numbers were fixed against: every label cut at its drawn box,
 *    read by the recogniser whether or not the custom reader found a token there. CI holds the gate on this; it
 *    measures the recogniser.
 *  - `--crop pass` (default) — the production path: only labels the custom reader tokenised reach the recogniser, cut
 *    at the token's box. It measures the recogniser AND the token finder in front of it; CI records it beside the gate
 *    and does not gate on it (the finder's misses — every cap-25 stress label — are not the recogniser's to answer).
 */
import { writeFileSync } from 'node:fs'
import { dimensionValueOf, ensembleOf, labelCrop, labelLattice, readNumbers } from '@buildapp/source-metrics'
import type { LabelCrop } from '@buildapp/source-metrics'
import { ocrBakeoffCorpus, renderLabel } from '@buildapp/synthetic-drawings'
import { inlineRecogniser } from '../src/inline.js'
import { workspaceAssetPaths } from '../src/manifest.js'

export const SYNTHETIC_GATE = { exactAtLeast: 650, confidentWrongAtMost: 2, of: 672 } as const

const argv = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const limit = Number(value('limit') ?? '0')
const cropMode = value('crop') ?? 'pass'
const corpus = ocrBakeoffCorpus().slice(0, limit > 0 ? limit : undefined)

type Row = { id: string; set: string; stratum: string; printed: string; found: boolean; lattice?: { asRead: string; ocrClass: string }; external?: { top: string; p: number; meanP: number; stable: boolean; top3: string[]; top5: string[] }; decision?: string; read?: { asRead: string; ocrClass: string }; ms: number }
const rows: Row[] = []
const crops: Array<{ crop: LabelCrop; row: Row; lattice: ReturnType<typeof labelLattice> }> = []
const t0 = performance.now()
for (const s of corpus) {
  const r = renderLabel(s.text, s.style)
  const t1 = performance.now()
  const read = readNumbers(r.raster, { orientations: ['HORIZONTAL'], hypotheses: true, retainPasses: true })
  const field = read.passes?.HORIZONTAL
  // the label's token: the widest upright one (005E/005F/005G harness rule; the synthetic page holds one label)
  const token = (read.raw ?? []).filter((t) => t.orientation === 'HORIZONTAL' && t.passBox).sort((a, b) => b.box.x1 - b.box.x0 - (a.box.x1 - a.box.x0) || a.box.x0 - b.box.x0)[0]
  const row: Row = { id: s.id, set: s.set, stratum: s.stratum, printed: s.text, found: Boolean(token && field), ms: 0 }
  rows.push(row)
  if (cropMode === 'drawn') {
    // 005G's protocol: every label is cut at its drawn box from the pass field (the page's channel when no pass), read
    // by the lattice when the reader found its token, and by the recogniser whether or not it did.
    const page = field ?? { width: r.raster.width, height: r.raster.height, data: Uint8ClampedArray.from({ length: r.raster.width * r.raster.height }, (_, i) => r.raster.data[i * 4]) }
    const lattice = token && field && token.passBox ? labelLattice({ orientation: 'HORIZONTAL', ink: field, page: { width: r.raster.width, height: r.raster.height } }, token) : undefined
    if (lattice) row.lattice = { asRead: lattice.asRead, ocrClass: lattice.ocrClass }
    crops.push({ crop: labelCrop(s.id, page, r.box), row, lattice })
    row.ms = Math.round(performance.now() - t1)
    continue
  }
  if (!token || !field || !token.passBox) continue
  const lattice = labelLattice({ orientation: 'HORIZONTAL', ink: field, page: { width: r.raster.width, height: r.raster.height } }, token)
  if (lattice) row.lattice = { asRead: lattice.asRead, ocrClass: lattice.ocrClass }
  crops.push({ crop: labelCrop(s.id, field, token.passBox), row, lattice })
  row.ms = Math.round(performance.now() - t1)
}
const recogniser = inlineRecogniser({ paths: workspaceAssetPaths() })
const readings = await recogniser.recognise(crops.map((c) => c.crop))
await recogniser.release()
const byKey = new Map(readings.map((x) => [x.key, x]))
for (const { row, lattice } of crops) {
  const x = byKey.get(row.id)
  if (!x) continue
  row.external = { top: x.topK[0]?.text ?? '', p: x.topK[0]?.p ?? 0, meanP: x.greedy.meanP, stable: x.stable, top3: x.topK.slice(0, 3).map((c) => c.text), top5: x.topK.slice(0, 5).map((c) => c.text) }
  const e = ensembleOf(lattice ? { asRead: lattice.asRead, asReadValueCm: lattice.asReadValueCm, ocrClass: lattice.ocrClass } : { asRead: '', asReadValueCm: undefined, ocrClass: 'LOW_QUALITY' }, x)
  row.decision = e.decision
  row.read = { asRead: e.asRead, ocrClass: e.ocrClass }
}

const confident = (r: Row): boolean => r.read?.ocrClass === 'CLEAR' || r.read?.ocrClass === 'SUPPORTED'
const tally = (rs: Row[]) => {
  const ext = rs.filter((r) => r.external)
  return {
    n: rs.length,
    found: rs.filter((r) => r.found).length,
    exact: rs.filter((r) => r.external?.top === r.printed).length,
    top3: rs.filter((r) => r.external?.top3.includes(r.printed)).length,
    top5: rs.filter((r) => r.external?.top5.includes(r.printed)).length,
    stable: ext.filter((r) => r.external?.stable).length,
    externalConfident: ext.filter((r) => (r.external?.p ?? 0) >= 0.9 && (r.external?.meanP ?? 0) >= 0.9).length,
    falseHighConfidence: ext.filter((r) => (r.external?.p ?? 0) >= 0.9 && (r.external?.meanP ?? 0) >= 0.9 && r.external?.top !== r.printed).length,
    falseHighConfidenceStable: ext.filter((r) => (r.external?.p ?? 0) >= 0.9 && (r.external?.meanP ?? 0) >= 0.9 && r.external?.stable && r.external?.top !== r.printed).length,
    confident: rs.filter(confident).length,
    confidentWrong: rs.filter((r) => confident(r) && r.read?.asRead !== r.printed).length,
    latticeConfident: rs.filter((r) => r.lattice?.ocrClass === 'CLEAR' || r.lattice?.ocrClass === 'SUPPORTED').length,
    latticeConfidentWrong: rs.filter((r) => (r.lattice?.ocrClass === 'CLEAR' || r.lattice?.ocrClass === 'SUPPORTED') && r.lattice.asRead !== r.printed).length,
    dimensionsOnlyConfidentWrong: rs.filter((r) => confident(r) && r.read?.asRead !== r.printed && dimensionValueOf(r.read?.asRead ?? '') !== undefined).length,
  }
}
const sets = ['SYN5001', 'SYN9017', 'STRESS']
const all = tally(rows)
const strata = [...new Set(rows.map((r) => r.stratum))].sort()
const decisions: Record<string, number> = {}
for (const r of rows) if (r.decision) decisions[r.decision] = (decisions[r.decision] ?? 0) + 1
const pass = corpus.length === SYNTHETIC_GATE.of && all.exact >= SYNTHETIC_GATE.exactAtLeast && all.confidentWrong <= SYNTHETIC_GATE.confidentWrongAtMost
const out = {
  schema: 'buildapp.ocr-synthetic-gate',
  version: 1,
  recogniser: { id: recogniser.id, modelSha256: recogniser.model.sha256, runtime: recogniser.runtime, runtimeSha256: recogniser.runtimeSha256 },
  crop: cropMode === 'drawn' ? 'DRAWN_BOX (005G)' : 'TOKEN_PASS_BOX (production)',
  gate: SYNTHETIC_GATE,
  pass,
  node: process.version,
  ms: Math.round(performance.now() - t0),
  all,
  bySet: Object.fromEntries(sets.map((s) => [s, tally(rows.filter((r) => r.set === s))])),
  byStratum: Object.fromEntries(strata.map((s) => [s, tally(rows.filter((r) => r.stratum === s))])),
  decisions,
  confidentWrong: rows.filter((r) => confident(r) && r.read?.asRead !== r.printed).map((r) => ({ id: r.id, printed: r.printed, read: r.read, lattice: r.lattice, external: r.external, decision: r.decision })),
  externalWrong: rows.filter((r) => r.external && r.external.top !== r.printed).map((r) => ({ id: r.id, printed: r.printed, external: r.external, decision: r.decision })),
  notFound: rows.filter((r) => !r.found).map((r) => r.id),
}
const file = value('out')
if (file) writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`)
process.stdout.write(`${JSON.stringify({ pass, crop: out.crop, all, decisions, ms: out.ms })}\n`)
if (argv.includes('--check') && !pass) process.exitCode = 1
