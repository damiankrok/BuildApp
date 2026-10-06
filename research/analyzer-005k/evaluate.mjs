#!/usr/bin/env node
/**
 * evaluate.mjs — BUILDPLAN-ANALYZER-005K: BASELINE / CONSTANT / DRAWN_RULE on the sealed fresh-sheet gap set (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/evaluate.mjs --manifest <gap-set-manifest.json> --labels <gap-set-labels.json> \
 *       --runs <gapset/runs> --replay <gapset/replay> --out-results <gap-set-results.json> --out-constant <constant-control.json>
 *
 * Run only after the manifest and the labels are sealed (gap-set-protocol.md §4–§5). For each gap of the manifest:
 *   - BASELINE   the frozen classification (WEAK) and the outline's fate in the frozen run;
 *   - CONSTANT   OPENING for every gap (the deliberate naive control);
 *   - DRAWN_RULE OPENING exactly when the frozen record's `DrawnGapCheck.eligible` (the rule's decision is local: the same
 *                record ON is upgraded iff eligible — checked against the ON replay where the reading recurs).
 * Outcome: each project re-solved by the solver alone on its own sealed evidence, OFF / ON / CONSTANT
 * (`gapset/replay/<mode>/<project>`). A false upgrade is OUTCOME_CRITICAL when its project's arm replay differs from the
 * OFF replay in model hash or failure code (conservative: every false upgrade of such a project counts).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null)
const manifest = readJson(resolve(arg('manifest', 'gap-set-manifest.json')))
const labels = readJson(resolve(arg('labels', 'gap-set-labels.json')))
const runs = resolve(arg('runs', '/home/user/work005k/gapset/runs'))
const replay = resolve(arg('replay', '/home/user/work005k/gapset/replay'))

/** Wilson score interval, 95 %. */
export function wilson(k, n, z = 1.959964) {
  if (n === 0) return { k, n, rate: null, lo: null, hi: null }
  const p = k / n
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  const r = (x) => Math.round(x * 10000) / 10000
  return { k, n, rate: r(p), lo: r(Math.max(0, c - h)), hi: r(Math.min(1, c + h)) }
}

const digestOf = (dir) => readJson(join(dir, 'plan-diagnostics', 'digest.json')) ?? readJson(join(dir, 'failure.json'))?.plans ?? null
const recordsOf = (dir) => {
  const out = new Map()
  for (const p of digestOf(dir)?.plans ?? []) for (const r of p.boundary?.gapEvidence ?? []) out.set(`${p.frameId}/${r.decompositionId}/${r.gapId}`, r)
  return out
}
const outcomeOf = (dir) => {
  const s = readJson(join(dir, 'result-summary.json'))
  if (s) return `COMPLETED:${s.modelHash}`
  const f = readJson(join(dir, 'failure.json'))
  return f ? `FAILED:${f.code}/${f.reasonCode ?? '-'}` : 'NO_RUN'
}

const labelOf = new Map(labels.labels.map((l) => [l.key, l]))
const frozen = new Map()
const projects = [...new Set(manifest.gaps.map((g) => g.project))]
for (const p of projects) for (const [k, r] of recordsOf(join(runs, p))) frozen.set(`${p}/${k}`, r)
const onRecords = new Map()
for (const p of projects) for (const [k, r] of recordsOf(join(replay, 'ON', p))) onRecords.set(`${p}/${k}`, r)
const outcome = Object.fromEntries(projects.map((p) => [p, { live: outcomeOf(join(runs, p)), OFF: outcomeOf(join(replay, 'OFF', p)), ON: outcomeOf(join(replay, 'ON', p)), CONSTANT: outcomeOf(join(replay, 'CONSTANT', p)) }]))

const rows = manifest.gaps.map((g) => {
  const r = frozen.get(g.key)
  if (!r) throw new Error(`no frozen record for ${g.key}`)
  const label = labelOf.get(g.key)?.label ?? 'UNRESOLVED'
  const check = r.drawnGapRule.check
  const on = onRecords.get(g.key)
  return {
    key: g.key,
    qid: g.qid,
    project: g.project,
    publisher: g.publisher,
    label,
    labelSource: labelOf.get(g.key)?.label_source ?? 'UNRESOLVED',
    widthM: g.widthM,
    mppAlong: g.mppAlong,
    density: g.mppAlong < 0.02 ? 'FINE (< 0.02 m/px)' : 'COARSE (≥ 0.02 m/px)',
    width: g.widthM <= 1.2 ? 'NARROW (≤ 1.2 m)' : 'WIDE (> 1.2 m)',
    drawnVia: check?.drawnVia ?? null,
    signature: r.signature,
    baseline: { boundary: r.classified.boundary, outline: r.outline },
    constant: true,
    rule: check?.eligible === true,
    ruleConditions: check,
    onReplay: on ? { upgraded: on.drawnGapRule.upgraded, outline: on.outline } : null,
  }
})
for (const x of rows) if (x.onReplay && x.onReplay.upgraded !== x.rule) throw new Error(`the ON replay disagrees with the frozen check on ${x.key}`)

const NEG = new Set(['OPEN', 'NOT_A_WALL_LINE'])
const metrics = (set, predict, name) => {
  const resolved = set.filter((x) => x.label !== 'UNRESOLVED')
  const pos = resolved.filter((x) => x.label === 'OPENING')
  const neg = resolved.filter((x) => NEG.has(x.label))
  const tp = pos.filter(predict).length
  const fp = neg.filter(predict)
  const critical = name === 'BASELINE' ? [] : fp.filter((x) => outcome[x.project][name === 'CONSTANT' ? 'CONSTANT' : 'ON'] !== outcome[x.project].OFF)
  return {
    total: set.length,
    resolved: resolved.length,
    coverage: set.length ? Math.round((resolved.length / set.length) * 10000) / 10000 : null,
    opening: pos.length,
    negatives: neg.length,
    upgraded: set.filter(predict).length,
    openingRecall: wilson(tp, pos.length),
    negativeRecall: wilson(neg.length - fp.length, neg.length),
    falseUpgrades: wilson(fp.length, neg.length),
    falseUpgradeKeys: fp.map((x) => `${x.qid} ${x.label} ${x.key}`),
    outcomeCriticalFalseBridges: critical.length,
    outcomeCriticalKeys: critical.map((x) => `${x.qid} ${x.key}`),
  }
}
const ARMS = { BASELINE: () => false, CONSTANT: () => true, DRAWN_RULE: (x) => x.rule }
const split = (by) => Object.fromEntries([...new Set(rows.map(by))].sort().map((v) => [v, Object.fromEntries(Object.entries(ARMS).map(([n, f]) => [n, metrics(rows.filter((x) => by(x) === v), f, n)]))]))
const result = {
  stage: 'BUILDPLAN-ANALYZER-005K',
  kind: 'fresh-sheet gap set: three-way comparison (evaluated after the manifest and labels were sealed)',
  freezeSha: manifest.freezeSha,
  labelsNote: labels.note,
  classes: Object.fromEntries(['OPENING', 'OPEN', 'NOT_A_WALL_LINE', 'UNRESOLVED'].map((c) => [c, rows.filter((x) => x.label === c).length])),
  arms: Object.fromEntries(Object.entries(ARMS).map(([n, f]) => [n, metrics(rows, f, n)])),
  splits: { publisher: split((x) => x.publisher), density: split((x) => x.density), width: split((x) => x.width), drawnVia: split((x) => x.drawnVia ?? 'NONE') },
  baselineDownstream: Object.fromEntries(['OPENING', 'OPEN', 'NOT_A_WALL_LINE', 'UNRESOLVED'].map((c) => [c, Object.fromEntries([...new Set(rows.map((x) => x.baseline.outline))].sort().map((o) => [o, rows.filter((x) => x.label === c && x.baseline.outline === o).length]))])),
  projects: outcome,
  rows,
}
writeFileSync(resolve(arg('out-results', 'gap-set-results.json')), `${JSON.stringify(result, null, 1)}\n`)
writeFileSync(resolve(arg('out-constant', 'constant-control.json')), `${JSON.stringify({ stage: result.stage, kind: 'CONSTANT control: every eligible drawn weak gap is an OPENING (never a candidate)', freezeSha: result.freezeSha, labelsNote: result.labelsNote, arm: result.arms.CONSTANT, vsRule: result.arms.DRAWN_RULE, splits: Object.fromEntries(Object.entries(result.splits).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([g, arms]) => [g, arms.CONSTANT]))])), projects: outcome }, null, 1)}\n`)
process.stdout.write(`${rows.length} gaps; ${JSON.stringify(result.classes)}\n`)
for (const [n, m] of Object.entries(result.arms)) process.stdout.write(`${n}: upgraded ${m.upgraded}, OPENING recall ${m.openingRecall.k}/${m.openingRecall.n}, false upgrades ${m.falseUpgrades.k}/${m.falseUpgrades.n} [${m.falseUpgrades.lo}, ${m.falseUpgrades.hi}], outcome-critical ${m.outcomeCriticalFalseBridges}\n`)
