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
 * `--check` exits 1 when the gate fails (CI); `--check-cw` when confident-wrong alone exceeds its bound. Two crops:
 *
 *  - `--crop drawn` — 005G's protocol, the one the gate's numbers were fixed against: every label cut at its drawn box,
 *    read by the recogniser whether or not the custom reader found a token there. CI holds the gate on this; it
 *    measures the recogniser.
 *  - `--crop pass` (default) — the production path: only labels the custom reader tokenised reach the recogniser, cut
 *    at the token's box. It measures the recogniser AND the token finder in front of it; CI records it beside the gate
 *    and does not gate on it (the finder's misses — every cap-25 stress label — are not the recogniser's to answer).
 *
 * `--page WxH` draws each label on a larger page — the same label pixels, more paper. On 005G's 420 × 140 page the
 * cap-25 stress labels exceed the reader's glyph bound (6 % of the page's larger side, 25.2 px), which on a plan sheet
 * thousands of pixels wide is no bound at all; a larger page measures the production path without that artefact.
 *
 * `--corpus fresh` reads a corpus no policy was chosen on (red team D6): seed 7001, every stratum, plus two-digit
 * labels, each drawn upright and turned a quarter either way, through the production path (`--crop pass`) only. It is
 * recorded, never gated.
 */
import { writeFileSync } from 'node:fs'
import { dimensionValueOf, ensembleOf, labelCrop, labelLattice, readNumbers } from '@buildapp/source-metrics'
import type { LabelCrop } from '@buildapp/source-metrics'
import { DEFAULT_LABEL_STYLE, digitCorpus, ocrBakeoffCorpus, renderLabel } from '@buildapp/synthetic-drawings'
import type { LabelStyle } from '@buildapp/synthetic-drawings'
import { inlineRecogniser } from '../src/inline.js'
import { workspaceAssetPaths } from '../src/manifest.js'

export const SYNTHETIC_GATE = { exactAtLeast: 650, confidentWrongAtMost: 2, of: 672 } as const

const argv = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const limit = Number(value('limit') ?? '0')
const corpusName = value('corpus') ?? 'bakeoff'
const cropMode = corpusName === 'fresh' ? 'pass' : (value('crop') ?? 'pass')
const pageArg = value('page')
const page = pageArg ? { width: Number(pageArg.split('x')[0]), height: Number(pageArg.split('x')[1]) } : undefined

type Turn = 'UPRIGHT' | 'CW' | 'CCW'
type Specimen = { id: string; set: string; text: string; stratum: string; style: Partial<LabelStyle>; turn: Turn }

/** Seed 7001 (no policy was chosen on it), every stratum, and two-digit labels — each upright and turned either way. */
function freshCorpus(): Specimen[] {
  let state = 7001
  const rnd = (): number => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
  const base: Array<Omit<Specimen, 'turn'>> = [
    ...digitCorpus(7001, 6).map((x) => ({ id: x.id, set: 'FRESH7001', text: x.text, stratum: x.stratum, style: x.style })),
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `two-digit-7001-${i}`,
      set: 'FRESH7001',
      text: String(10 + Math.floor(rnd() * 90)),
      stratum: 'TWO_DIGIT',
      style: { ...DEFAULT_LABEL_STYLE, capHeight: 12 + Math.floor(rnd() * 6), slant: rnd() * 0.25, pen: 1.3 + rnd() * 0.5, seed: 1 + Math.floor(rnd() * 1e9), face: i % 2 === 0 ? ('A' as const) : ('B' as const) },
    })),
  ]
  return base.flatMap((x) => (['UPRIGHT', 'CW', 'CCW'] as const).map((turn) => ({ ...x, id: `${x.id}-${turn.toLowerCase()}`, turn })))
}

/** The page turned a quarter: clockwise or counter-clockwise (RGBA). */
function turned(r: { width: number; height: number; data: Uint8ClampedArray }, turn: Turn): { width: number; height: number; data: Uint8ClampedArray } {
  if (turn === 'UPRIGHT') return r
  const W = r.height
  const H = r.width
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const [sx, sy] = turn === 'CW' ? [y, r.height - 1 - x] : [r.width - 1 - y, x]
      data.set(r.data.subarray((sy * r.width + sx) * 4, (sy * r.width + sx) * 4 + 4), (y * W + x) * 4)
    }
  return { width: W, height: H, data }
}

const corpus: Specimen[] = (corpusName === 'fresh' ? freshCorpus() : ocrBakeoffCorpus().map((x) => ({ ...x, turn: 'UPRIGHT' as const }))).slice(0, limit > 0 ? limit : undefined)

type Row = { id: string; set: string; stratum: string; printed: string; found: boolean; lattice?: { asRead: string; ocrClass: string }; external?: { top: string; p: number; meanP: number; stable: boolean; top3: string[]; top5: string[] }; decision?: string; read?: { asRead: string; ocrClass: string }; ms: number }
const rows: Row[] = []
const crops: Array<{ crop: LabelCrop; row: Row; lattice: ReturnType<typeof labelLattice> }> = []
const t0 = performance.now()
for (const s of corpus) {
  const r = page ? renderLabel(s.text, s.style, 24, page) : renderLabel(s.text, s.style)
  const t1 = performance.now()
  if (s.turn !== 'UPRIGHT') {
    // a turned label: read in every orientation, as a plan is. Both quarter-turn passes find it — one the right way up,
    // one upside down — and on a plan the page's orientation vote picks between them; here the vote is taken as right
    // (a label turned clockwise reads in the ROTATED_CCW pass, and the other way round). The longest token of that pass.
    const raster = turned(r.raster, s.turn)
    const read = readNumbers(raster, { hypotheses: true, retainPasses: true })
    const want = s.turn === 'CW' ? 'ROTATED_CCW' : 'ROTATED_CW'
    const along = (t: { box: { x0: number; x1: number; y0: number; y1: number } }): number => Math.max(t.box.x1 - t.box.x0, t.box.y1 - t.box.y0)
    const token = (read.raw ?? []).filter((t) => t.orientation === want && t.passBox && read.passes?.[t.orientation]).sort((a, b) => along(b) - along(a))[0]
    const field = token ? read.passes?.[token.orientation] : undefined
    const row: Row = { id: s.id, set: s.set, stratum: `${s.stratum}:${s.turn}`, printed: s.text, found: Boolean(token && field), ms: 0 }
    rows.push(row)
    if (!token || !field || !token.passBox) continue
    const lattice = labelLattice({ orientation: token.orientation, ink: field, page: { width: raster.width, height: raster.height } }, token)
    if (lattice) row.lattice = { asRead: lattice.asRead, ocrClass: lattice.ocrClass }
    crops.push({ crop: labelCrop(s.id, field, token.passBox), row, lattice })
    row.ms = Math.round(performance.now() - t1)
    continue
  }
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
const sets = [...new Set(rows.map((r) => r.set))]
const all = tally(rows)
const strata = [...new Set(rows.map((r) => r.stratum))].sort()
const decisions: Record<string, number> = {}
for (const r of rows) if (r.decision) decisions[r.decision] = (decisions[r.decision] ?? 0) + 1
const gated = corpusName === 'bakeoff'
const pass = gated && corpus.length === SYNTHETIC_GATE.of && all.exact >= SYNTHETIC_GATE.exactAtLeast && all.confidentWrong <= SYNTHETIC_GATE.confidentWrongAtMost
const out = {
  schema: 'buildapp.ocr-synthetic-gate',
  version: 1,
  recogniser: { id: recogniser.id, modelSha256: recogniser.model.sha256, runtime: recogniser.runtime, runtimeSha256: recogniser.runtimeSha256 },
  crop: cropMode === 'drawn' ? 'DRAWN_BOX (005G)' : 'TOKEN_PASS_BOX (production)',
  corpus: corpusName === 'fresh' ? 'FRESH7001 (seed 7001 + two-digit, upright and turned; recorded, never gated)' : 'BAKEOFF672 (005G)',
  page: page ?? { width: 420, height: 140 },
  gate: gated ? SYNTHETIC_GATE : null,
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
// `--check-cw`: the safety bound alone (confident-wrong ≤ 2 of the 672), for the production path's crops (red team D2)
if (argv.includes('--check-cw') && !(gated && corpus.length === SYNTHETIC_GATE.of && all.confidentWrong <= SYNTHETIC_GATE.confidentWrongAtMost)) process.exitCode = 1
