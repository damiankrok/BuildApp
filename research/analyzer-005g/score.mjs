/**
 * BUILDPLAN-ANALYZER-005G — bake-off scoring (research only).
 *
 * Reads the dataset manifest (build-dataset.ts) and the engines' outputs (run-external.mjs) and writes
 * `ocr-bakeoff.json`: per-engine metrics by set and regime, the three integration architectures (replacement,
 * ensemble, fallback), and per-label text facts (ids, page hashes, boxes, crop pixel hashes, the printed value, each
 * engine's reading, confidence and time). No pixel is written.
 *
 *   node score.mjs --dataset /home/user/work005g/dataset --runs /home/user/work005g/runs \
 *        --serial /home/user/work005g/runs-serial --out ../../stage-reports/artifacts/analyzer-005g/ocr-bakeoff.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const DATASET = arg('dataset', '/home/user/work005g/dataset')
const RUNS = arg('runs', '/home/user/work005g/runs')
const SERIAL = arg('serial', '/home/user/work005g/runs-serial')
const OUT = arg('out', '/home/user/work005g/ocr-bakeoff.json')

const labels = JSON.parse(readFileSync(join(DATASET, 'labels.json'), 'utf8')).records.filter((r) => r.printed)
const byId = new Map(labels.map((r) => [r.id, r]))

const ENGINES = [
  { key: 'paddle_en_PP-OCRv5_mobile_rec_onnx-node-x1', name: 'paddle:en_PP-OCRv5_mobile_rec', short: 'en_v5m' },
  { key: 'paddle_latin_PP-OCRv5_mobile_rec_onnx-node-x1', name: 'paddle:latin_PP-OCRv5_mobile_rec', short: 'latin_v5m' },
  { key: 'paddle_PP-OCRv5_mobile_rec_onnx-node-x1', name: 'paddle:PP-OCRv5_mobile_rec', short: 'v5m' },
  { key: 'paddle_PP-OCRv6_tiny_rec_onnx-node-x1', name: 'paddle:PP-OCRv6_tiny_rec', short: 'v6t' },
  { key: 'paddle_PP-OCRv6_small_rec_onnx-node-x1', name: 'paddle:PP-OCRv6_small_rec', short: 'v6s' },
  { key: 'paddle_PP-OCRv6_medium_rec_onnx-node-x1', name: 'paddle:PP-OCRv6_medium_rec', short: 'v6m' },
  { key: 'tesseract_best_int-node-x1', name: 'tesseract:5/LSTM best_int (x1)', short: 'tess_x1' },
  { key: 'tesseract_best_int-node-x3', name: 'tesseract:5/LSTM best_int (x3 upscale)', short: 'tess_x3' },
]
const runs = {}
for (const e of ENGINES) {
  const p = join(RUNS, `${e.key}.json`)
  if (!existsSync(p)) continue
  const d = JSON.parse(readFileSync(p, 'utf8'))
  runs[e.short] = { meta: d, by: new Map(d.results.map((x) => [x.id, x])) }
}

/** The BuildPlan production lattice, as an engine: as-read text, its class, its ranked values. */
const bp = (r) => r.buildplan
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/**
 * One reading per engine per label, normalised:
 *   text   — the engine's own top-1 (BuildPlan: as-read; Paddle: digit-constrained CTC beam top-1; Tesseract: whitelisted)
 *   native — Paddle's unconstrained greedy text (what the model says with its full alphabet)
 *   conf   — the engine's own confidence (BuildPlan: as-read p; Paddle: beam posterior of top-1; Tesseract: mean conf)
 *   confident — the engine's own "trust this" bucket (BuildPlan: CLEAR|SUPPORTED; Paddle: posterior ≥ 0.9 and greedy
 *               mean char prob ≥ 0.9; Tesseract: conf ≥ 0.8)
 *   topK   — ranked candidate texts
 */
function reading(engine, r) {
  if (engine === 'buildplan') {
    const b = bp(r)
    if (!b.found) return { text: null, conf: 0, confident: false, topK: [], cls: 'NOT_FOUND' }
    return { text: b.asRead, conf: b.asReadP ?? 0, confident: b.cls === 'CLEAR' || b.cls === 'SUPPORTED', topK: (b.ranked ?? []).map((x) => x.t), cls: b.cls }
  }
  const x = runs[engine]?.by.get(r.id)
  if (!x) return null
  if (engine.startsWith('tess')) {
    const t = x.text.replace(/[^0-9]/g, '')
    return { text: t || null, conf: x.conf, confident: x.conf >= 0.8 && !!t, topK: [t, ...x.top.map((s) => s.t)].filter((v, i, a) => v && a.indexOf(v) === i), ms: x.ms }
  }
  const top = x.top[0]
  return { text: top?.t ?? null, native: x.text, conf: top?.p ?? 0, greedyConf: x.conf, confident: !!top && top.p >= 0.9 && x.conf >= 0.9, topK: x.top.map((s) => s.t), ms: x.ms }
}

function metrics(engine, recs) {
  const R = recs.map((r) => ({ r, o: reading(engine, r) })).filter((x) => x.o)
  const n = R.length
  if (!n) return null
  const exact = R.filter((x) => x.o.text === x.r.printed).length
  const nativeExact = R.filter((x) => (x.o.native ?? x.o.text) === x.r.printed).length
  const digitAcc = R.reduce((a, x) => a + Math.max(0, 1 - lev(x.o.text ?? '', x.r.printed) / x.r.printed.length), 0) / n
  const top3 = R.filter((x) => x.o.topK.slice(0, 3).includes(x.r.printed)).length
  const top5 = R.filter((x) => x.o.topK.slice(0, 5).includes(x.r.printed)).length
  const conf = R.filter((x) => x.o.confident)
  const confWrong = conf.filter((x) => x.o.text !== x.r.printed)
  const wrongCount = confWrong.filter((x) => (x.o.text ?? '').length !== x.r.printed.length).length
  const ms = R.map((x) => x.o.ms).filter((v) => v != null)
  return {
    n,
    exact,
    exactRate: +(exact / n).toFixed(4),
    nativeExact,
    digitAccuracy: +digitAcc.toFixed(4),
    truthInTop3: top3,
    truthInTop5: top5,
    confident: conf.length,
    confidentWrong: confWrong.length,
    confidentWrongRate: +(confWrong.length / n).toFixed(4),
    confidentPrecision: conf.length ? +((conf.length - confWrong.length) / conf.length).toFixed(4) : null,
    confidentWrongAtWrongCount: wrongCount,
    confidentWrongExamples: confWrong.slice(0, 12).map((x) => ({ id: x.r.id, printed: x.r.printed, read: x.o.text, conf: +x.o.conf.toFixed(4) })),
    meanMsContended: ms.length ? +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1) : null,
  }
}

/** Accuracy at matched coverage: rank by the engine's own confidence and take as many as BuildPlan trusts. */
function riskAtCoverage(engine, recs, k) {
  const R = recs.map((r) => ({ r, o: reading(engine, r) })).filter((x) => x.o && x.o.text)
  const key = (x) => (engine === 'buildplan' ? (x.o.cls === 'CLEAR' ? 2 : x.o.cls === 'SUPPORTED' ? 1 : 0) + x.o.conf : Math.min(x.o.conf, x.o.greedyConf ?? x.o.conf))
  const top = [...R].sort((a, b) => key(b) - key(a)).slice(0, k)
  return { k, wrong: top.filter((x) => x.o.text !== x.r.printed).length }
}

const sets = {
  REAL: labels.filter((r) => r.set === 'REAL'),
  REAL_BLIND: labels.filter((r) => r.set === 'REAL' && (r.split === 'TARGET' || r.split?.startsWith('BLIND'))),
  REAL_CAP_11_13: labels.filter((r) => r.set === 'REAL' && r.capPx <= 13),
  REAL_CAP_14_17: labels.filter((r) => r.set === 'REAL' && r.capPx >= 14 && r.capPx <= 17),
  REAL_CAP_18_PLUS: labels.filter((r) => r.set === 'REAL' && r.capPx >= 18),
  SYN5001: labels.filter((r) => r.set === 'SYN5001'),
  SYN9017: labels.filter((r) => r.set === 'SYN9017'),
  STRESS: labels.filter((r) => r.set === 'STRESS'),
  STRESS_CONDENSED: labels.filter((r) => r.set === 'STRESS' && r.stratum.startsWith('CONDENSED')),
  STRESS_CONDENSED_ITALIC: labels.filter((r) => r.set === 'STRESS' && r.stratum === 'CONDENSED_ITALIC'),
  STRESS_CAP_11_13: labels.filter((r) => r.set === 'STRESS' && r.capPx <= 13),
  STRESS_CAP_20_25: labels.filter((r) => r.set === 'STRESS' && r.capPx >= 20),
  STRESS_TOUCHING: labels.filter((r) => r.set === 'STRESS' && r.stratum === 'TOUCHING'),
  STRESS_BROKEN: labels.filter((r) => r.set === 'STRESS' && r.stratum === 'BROKEN'),
  STRESS_BLURRED: labels.filter((r) => r.set === 'STRESS' && r.stratum === 'BLURRED'),
  CONFUSABLE_PAIRS: labels.filter((r) => r.set === 'STRESS' && /94|49|40|04|86|68|35|53/.test(r.printed)),
  ALL: labels,
}
for (const h of [...new Set(labels.filter((r) => r.set === 'REAL').map((r) => r.house))]) sets[`HOUSE:${h}`] = labels.filter((r) => r.house === h)

const engines = ['buildplan', ...Object.keys(runs)]
const table = {}
for (const [s, recs] of Object.entries(sets)) {
  table[s] = {}
  for (const e of engines) table[s][e] = metrics(e, recs)
}
const coverage = {}
for (const s of ['REAL', 'SYN5001', 'SYN9017', 'STRESS', 'ALL']) {
  const k = table[s].buildplan.confident
  coverage[s] = Object.fromEntries(engines.map((e) => [e, riskAtCoverage(e, sets[s], k)]))
}

/**
 * Integration architectures (contract: an external reading is a CANDIDATE; the metric resolver decides).
 * OCR-1 replacement: the external top-K replaces the lattice; confident = the external's own bucket.
 * OCR-2 ensemble: both candidate sets go to the resolver; a value is corroborated only when BOTH engines' top-1 agree
 *   (and is then the only confident value); a disagreement is AMBIGUOUS with both values as candidates.
 * OCR-3 fallback: BuildPlan first; the external engine runs only when BuildPlan is LOW_QUALITY / AMBIGUOUS / not
 *   found or the cap is under 14 px (a metric conflict is not observable per label here — stated, not simulated).
 */
function architectures(ext, recs) {
  const R = recs.map((r) => ({ r, b: reading('buildplan', r), x: reading(ext, r) })).filter((v) => v.x)
  const n = R.length
  const one = { confident: 0, confidentWrong: 0, exact: 0, truthInCandidates: 0, externalCalls: n }
  const two = { agreed: 0, agreedWrong: 0, disagreed: 0, truthInUnionTop3: 0, exactIfResolverPicksExternalOnDisagreement: 0, externalCalls: n }
  const three = { externalCalls: 0, exact: 0, confident: 0, confidentWrong: 0, buildplanConfidentWrongNeverRetried: 0 }
  for (const { r, b, x } of R) {
    one.exact += x.text === r.printed ? 1 : 0
    one.truthInCandidates += x.topK.slice(0, 5).includes(r.printed) ? 1 : 0
    if (x.confident) {
      one.confident += 1
      one.confidentWrong += x.text !== r.printed ? 1 : 0
    }
    if (b.text && b.text === x.text) {
      two.agreed += 1
      two.agreedWrong += b.text !== r.printed ? 1 : 0
    } else two.disagreed += 1
    two.truthInUnionTop3 += [...b.topK.slice(0, 3), ...x.topK.slice(0, 3)].includes(r.printed) ? 1 : 0
    two.exactIfResolverPicksExternalOnDisagreement += (b.text === x.text ? b.text : x.text) === r.printed ? 1 : 0
    const trigger = !b.text || b.cls === 'LOW_QUALITY' || b.cls === 'AMBIGUOUS' || b.cls === 'NOT_FOUND' || r.capPx < 14
    if (trigger) {
      three.externalCalls += 1
      three.exact += x.text === r.printed ? 1 : 0
      if (x.confident) {
        three.confident += 1
        three.confidentWrong += x.text !== r.printed ? 1 : 0
      }
    } else {
      three.exact += b.text === r.printed ? 1 : 0
      if (b.confident) {
        three.confident += 1
        if (b.text !== r.printed) {
          three.confidentWrong += 1
          three.buildplanConfidentWrongNeverRetried += 1
        }
      }
    }
  }
  return { n, OCR1_replacement: one, OCR2_ensemble: two, OCR3_fallback: three }
}
const arch = {}
for (const ext of Object.keys(runs)) arch[ext] = Object.fromEntries(['REAL', 'SYN5001', 'SYN9017', 'STRESS', 'ALL'].map((s) => [s, architectures(ext, sets[s])]))

/**
 * The stability bracket for an external recogniser (the analogue of the lattice's STABILITY_BRACKET): the same crop
 * re-read with 2 px more paper (pad2), 1 px less (trim1) and at 90 % size (scale90). A reading is STABLE when the
 * digit-constrained top-1 is the same in all four. Policies, all of which keep the external reading a candidate:
 *   P1 strict ensemble   — confident only when BuildPlan's as-read equals the external top-1 and the external is confident
 *   P2 external + bracket — confident when the external is confident AND stable; a disagreeing BuildPlan CLEAR/SUPPORTED
 *                           reading contests it (→ not confident)
 *   P3 two models        — confident when PP-OCRv6 tiny and en PP-OCRv5 mobile agree, both confident and stable
 */
const STAB = arg('stab', '/home/user/work005g/runs-stab')
const stab = {}
const STAB_MODELS = { v6t: 'PP-OCRv6_tiny_rec_onnx', en_v5m: 'en_PP-OCRv5_mobile_rec_onnx', v6s: 'PP-OCRv6_small_rec_onnx' }
for (const [short, m] of Object.entries(STAB_MODELS)) {
  const vs = ['pad2', 'trim1', 'scale90'].map((v) => join(STAB, `${m}-${v}.json`)).filter(existsSync)
  if (vs.length !== 3) continue
  stab[short] = vs.map((p) => new Map(JSON.parse(readFileSync(p, 'utf8')).results.map((x) => [x.id, x.top[0]?.t ?? null])))
}
const stable = (e, r) => {
  const o = reading(e, r)
  return !!stab[e] && !!o && stab[e].every((m) => m.get(r.id) === o.text)
}
function bracket(e, recs) {
  if (!stab[e]) return null
  const R = recs.map((r) => ({ r, o: reading(e, r), s: stable(e, r) }))
  const wrong = R.filter((x) => x.o.text !== x.r.printed)
  return {
    n: R.length,
    stable: R.filter((x) => x.s).length,
    wrong: wrong.length,
    wrongFlaggedUnstable: wrong.filter((x) => !x.s).length,
    confidentAndStable: R.filter((x) => x.s && x.o.confident).length,
    confidentAndStableWrong: R.filter((x) => x.s && x.o.confident && x.o.text !== x.r.printed).length,
    rightButUnstable: R.filter((x) => !x.s && x.o.text === x.r.printed).length,
  }
}
function policies(recs) {
  const out = {}
  const tally = (name, f) => {
    const R = recs.map((r) => ({ r, v: f(r) })).filter((x) => x.v)
    out[name] = { confident: R.length, confidentWrong: R.filter((x) => x.v !== x.r.printed).length, coverage: +(R.length / recs.length).toFixed(4) }
  }
  for (const e of Object.keys(stab)) {
    tally(`P1_strict_ensemble_${e}`, (r) => {
      const b = reading('buildplan', r)
      const x = reading(e, r)
      return x && x.confident && b.text === x.text ? x.text : null
    })
    tally(`P2_external_bracket_${e}`, (r) => {
      const b = reading('buildplan', r)
      const x = reading(e, r)
      if (!x || !x.confident || !stable(e, r)) return null
      if (b.confident && b.text && b.text !== x.text) return null
      return x.text
    })
  }
  if (stab.v6t && stab.en_v5m)
    tally('P3_two_models_v6t_en_v5m', (r) => {
      const a = reading('v6t', r)
      const b = reading('en_v5m', r)
      return a && b && a.confident && b.confident && stable('v6t', r) && stable('en_v5m', r) && a.text === b.text ? a.text : null
    })
  tally('BASELINE_buildplan_CLEAR_SUPPORTED', (r) => {
    const b = reading('buildplan', r)
    return b.confident ? b.text : null
  })
  return out
}
const stability = Object.fromEntries(['REAL', 'REAL_BLIND', 'SYN5001', 'SYN9017', 'STRESS', 'ALL'].map((s) => [s, { bracket: Object.fromEntries(Object.keys(stab).map((e) => [e, bracket(e, sets[s])])), policies: policies(sets[s]) }]))

// Serial (uncontended) latency, parity of WASM-on-Node-18 against native, and model/runtime facts.
const serial = {}
if (existsSync(SERIAL)) {
  for (const m of ['PP-OCRv6_tiny_rec_onnx', 'en_PP-OCRv5_mobile_rec_onnx', 'PP-OCRv6_small_rec_onnx', 'latin_PP-OCRv5_mobile_rec_onnx']) {
    const load = (k) => (existsSync(join(SERIAL, `${m}-${k}.json`)) ? JSON.parse(readFileSync(join(SERIAL, `${m}-${k}.json`), 'utf8')) : null)
    const nat = load('node22-native')
    const w18 = load('node18-wasm')
    const w22 = load('node22-wasm')
    if (!nat) continue
    const stat = (d) => {
      if (!d) return null
      const ms = d.results.map((x) => x.ms).sort((a, b) => a - b)
      return { runtime: d.runtime, node: d.node, loadMs: d.loadMs, meanMs: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), p50Ms: ms[Math.floor(ms.length / 2)], p95Ms: ms[Math.floor(ms.length * 0.95)], rssPeakMiB: d.rssPeakMiB, rssBeforeMiB: d.rssBeforeMiB, modelBytes: d.modelBytes, modelSha256: d.modelSha256 }
    }
    const parity = (a, b) => {
      if (!a || !b) return null
      const B = new Map(b.results.map((x) => [x.id, x]))
      let sameText = 0
      let sameTop = 0
      let maxConf = 0
      let maxP = 0
      for (const x of a.results) {
        const y = B.get(x.id)
        sameText += x.text === y.text ? 1 : 0
        sameTop += JSON.stringify(x.top.map((t) => t.t)) === JSON.stringify(y.top.map((t) => t.t)) ? 1 : 0
        maxConf = Math.max(maxConf, Math.abs(x.conf - y.conf))
        maxP = Math.max(maxP, ...x.top.map((t, i) => Math.abs(t.p - (y.top[i]?.p ?? 0))))
      }
      return { n: a.results.length, sameGreedyText: sameText, sameTopKOrder: sameTop, maxAbsGreedyConfDelta: +maxConf.toExponential(3), maxAbsBeamPDelta: +maxP.toExponential(3) }
    }
    serial[m] = { native_node22: stat(nat), wasm_node18: stat(w18), wasm_node22: stat(w22), parity_native_vs_wasm18: parity(nat, w18), parity_wasm18_vs_wasm22: parity(w18, w22) }
  }
  const t18 = join(SERIAL, 'tess-x3-node18.json')
  if (existsSync(t18)) {
    const d = JSON.parse(readFileSync(t18, 'utf8'))
    const ms = d.results.map((x) => x.ms).sort((a, b) => a - b)
    serial.tesseract_x3_node18 = { runtime: d.runtime, node: d.node, loadMs: d.loadMs, meanMs: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), p95Ms: ms[Math.floor(ms.length * 0.95)], rssPeakMiB: d.rssPeakMiB, sameTextAsNode22: d.results.filter((x) => runs.tess_x3?.by.get(x.id)?.text === x.text).length, n: d.results.length }
  }
}
const rapid = existsSync('/home/user/work005g/runs/rapid-en_v5.json') ? JSON.parse(readFileSync('/home/user/work005g/runs/rapid-en_v5.json', 'utf8')) : null

const perLabel = labels.map((r) => ({
  id: r.id,
  set: r.set,
  house: r.house,
  split: r.split,
  frameId: r.frameId,
  variantByteHash: r.variantByteHash,
  boxPage: r.boxPage,
  orientation: r.orientation,
  stratum: r.stratum,
  capPx: r.capPx,
  cropPixelSha256: r.crop.pixelSha256,
  cropSize: [r.crop.width, r.crop.height],
  printed: r.printed,
  buildplan: { t: bp(r).asRead ?? null, cls: bp(r).cls ?? 'NOT_FOUND', p: bp(r).asReadP ?? null, top3: (bp(r).ranked ?? []).slice(0, 3).map((x) => x.t), ms: bp(r).latticeMs ?? null },
  ...Object.fromEntries(
    Object.keys(runs).map((e) => {
      const o = reading(e, r)
      return [e, o ? { t: o.text, native: o.native, p: +o.conf.toFixed(4), g: o.greedyConf != null ? +o.greedyConf.toFixed(4) : undefined, top3: o.topK.slice(0, 3), ms: o.ms } : null]
    }),
  ),
}))

const result = {
  schema: 'buildapp.analyzer-005g.ocr-bakeoff',
  version: '1.0.0',
  what: 'The production numeric reader and external recognisers on the SAME crops: 103 real labels (81 from 005E development-labels.json, 22 transcribed for 005G on the round-5/6 blind houses) and 672 synthetic labels (005E corpora 5001/9017 and a 005G stress corpus). Text facts only: no pixel is in this file or in the repository.',
  definitions: {
    exact: "top-1 equals the printed value (BuildPlan: the lattice's as-read; Paddle: digit-constrained CTC beam top-1; Tesseract: digit-whitelisted text)",
    nativeExact: 'Paddle only: the unconstrained greedy text (full alphabet) equals the printed value',
    digitAccuracy: 'mean of 1 − Levenshtein(read, printed)/len(printed), floored at 0',
    confident: "the engine's own trust bucket: BuildPlan CLEAR|SUPPORTED; Paddle beam posterior ≥ 0.9 AND greedy mean char prob ≥ 0.9; Tesseract mean confidence ≥ 0.8",
    confidentWrong: 'a confident reading that is not the printed value — the primary metric',
    riskAtCoverage: "each engine's k most confident readings, k = BuildPlan's confident count on the set; wrong = how many of those k are wrong",
    meanMsContended: 'per-crop time while three engines ran in parallel on 4 cores (see serialLatency for uncontended numbers)',
  },
  engines: Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, { engine: v.meta.engine, runtime: v.meta.runtime, modelSha256: v.meta.modelSha256, modelBytes: v.meta.modelBytes ?? null, loadMs: v.meta.loadMs, rssPeakMiB: v.meta.rssPeakMiB }])),
  sets: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])),
  table,
  riskAtCoverage: coverage,
  architectures: arch,
  stabilityBracket: stability,
  serialLatencyAndParity: serial,
  rapidocrReference: rapid ? { model: rapid.model, rapidocr: rapid.rapidocr, onnxruntime: rapid.onnxruntime, n: rapid.n, sameTextAsNodeHarness: rapid.sameText, maxAbsConfDelta: +rapid.maxAbsConfDelta.toFixed(4), disagreements: rapid.results.filter((x) => x.text !== x.node).map((x) => ({ id: x.id, printed: byId.get(x.id).printed, rapidocr: x.text, node: x.node })) } : null,
  perLabel,
}
writeFileSync(OUT, JSON.stringify(result))
const show = (s) => {
  console.log(`\n${s} (n=${sets[s].length})`)
  for (const e of engines) {
    const m = table[s][e]
    if (m) console.log(`  ${e.padEnd(10)} exact ${String(m.exact).padStart(4)} (${(m.exactRate * 100).toFixed(1)}%) digit ${(m.digitAccuracy * 100).toFixed(1)}% top3 ${m.truthInTop3} top5 ${m.truthInTop5} | confident ${m.confident} wrong ${m.confidentWrong} (wrong count ${m.confidentWrongAtWrongCount})`)
  }
}
for (const s of ['REAL', 'REAL_BLIND', 'REAL_CAP_11_13', 'SYN5001', 'SYN9017', 'STRESS', 'STRESS_CONDENSED_ITALIC', 'STRESS_CAP_11_13', 'CONFUSABLE_PAIRS']) show(s)
console.log('\nstability', JSON.stringify(stability.REAL, null, 0))
console.log('\nstability ALL', JSON.stringify(stability.ALL.policies, null, 0))
console.log('\nserial', JSON.stringify(serial, null, 0))
console.log('\nrisk at BuildPlan coverage', JSON.stringify(coverage.REAL), JSON.stringify(coverage.ALL))
