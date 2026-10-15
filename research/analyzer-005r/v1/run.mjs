#!/usr/bin/env node
/**
 * run.mjs — 005R V1 router and the V0b pixel stump (RESEARCH ONLY; never imported by production).
 *
 *   node run.mjs features <inputs.json> <out.jsonl>                 decode + features, one line per asset
 *   node run.mjs fit-v1   <features.jsonl> <truth.json> <model.json> CART depth 4 on DEV, all features
 *   node run.mjs fit-v0b  <features.jsonl> <truth.json> <v0.json> <model.json>
 *                                                                    depth-1 stump on DEV assets V0 calls PERSPECTIVE_RENDER,
 *                                                                    scene features only: the "best simple non-AI heuristic"
 *   node run.mjs predict  <features.jsonl> <model.json> <out.jsonl>
 *
 * Fitting rows: DEV split only, truth roles other than UNKNOWN / TRUTH_CONFLICT, scored size only, and ONE row per
 * lineage group (the asset with the smallest assetId), so a picture published ten times by sibling editions weighs once.
 * EVAL rows are never read by a fit. inputs.json: [{assetId, path}].
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { FEATURE_NAMES, FEATURE_VERSION, decode, features } from './features.mjs'
import { fit, predict, rules, TREE_VERSION } from './tree.mjs'

const [cmd, ...args] = process.argv.slice(2)
const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const SCENE = ['skyBlue', 'skyBright', 'skyEdge', 'vegetation', 'warm', 'ceilingSmooth']

function trainingRows(feats, truth, filter = () => true) {
  const t = new Map(truth.rows.map((r) => [r.assetId, r]))
  const byGroup = new Map()
  for (const f of feats) {
    if (f.error) continue
    const r = t.get(f.assetId)
    if (!r || r.split !== 'DEV' || !r.scoredSize || ['UNKNOWN', 'TRUTH_CONFLICT'].includes(r.roleTruth) || !filter(f, r)) continue
    const prev = byGroup.get(r.lineageGroup)
    if (!prev || f.assetId < prev.id) byGroup.set(r.lineageGroup, { id: f.assetId, x: f.features, y: r.roleTruth })
  }
  return [...byGroup.values()]
}

if (cmd === 'features') {
  const [inputs, out] = args
  const lines = []
  for (const it of JSON.parse(readFileSync(inputs, 'utf8'))) {
    const t0 = performance.now()
    try {
      const img = decode(readFileSync(it.path))
      const t1 = performance.now()
      const f = features(img)
      lines.push(JSON.stringify({ assetId: it.assetId, width: img.width, height: img.height, features: f, ms: { decode: Math.round(t1 - t0), features: Math.round(performance.now() - t1) } }))
    } catch (e) {
      lines.push(JSON.stringify({ assetId: it.assetId, error: String(e.message ?? e) }))
    }
  }
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(`features ${lines.length} (${FEATURE_VERSION}, node ${process.version}, peak rss ${Math.round(process.resourceUsage().maxRSS / 1024)} MB)`)
} else if (cmd === 'fit-v1') {
  const [featsP, truthP, outP] = args
  const rows = trainingRows(readJsonl(featsP), JSON.parse(readFileSync(truthP, 'utf8')))
  const model = { contender: 'V1', featureVersion: FEATURE_VERSION, treeVersion: TREE_VERSION, trainedOn: 'DEV lineage groups', nTrain: rows.length, ...fit(rows, FEATURE_NAMES) }
  model.rules = rules(model)
  writeFileSync(outP, JSON.stringify(model, null, 1) + '\n')
  console.log(model.rules.join('\n'))
} else if (cmd === 'fit-v0b') {
  const [featsP, truthP, v0P, outP] = args
  const v0 = new Map(JSON.parse(readFileSync(v0P, 'utf8')).rows.map((r) => [r.assetId, r]))
  const rows = trainingRows(readJsonl(featsP), JSON.parse(readFileSync(truthP, 'utf8')),
    (f, r) => v0.get(f.assetId)?.v0Document === 'PERSPECTIVE_RENDER' && ['EXTERIOR_RENDER', 'INTERIOR_RENDER'].includes(r.roleTruth))
  const model = { contender: 'V0b', featureVersion: FEATURE_VERSION, treeVersion: TREE_VERSION, trainedOn: 'DEV lineage groups that V0 calls PERSPECTIVE_RENDER', nTrain: rows.length, ...fit(rows, SCENE, { maxDepth: 1 }) }
  model.rules = rules(model)
  writeFileSync(outP, JSON.stringify(model, null, 1) + '\n')
  console.log(model.rules.join('\n'))
} else if (cmd === 'predict') {
  const [featsP, modelP, outP] = args
  const model = JSON.parse(readFileSync(modelP, 'utf8'))
  const out = readJsonl(featsP).map((f) => (f.error ? { assetId: f.assetId, error: f.error } : { assetId: f.assetId, ...predict(model, f.features) }))
  writeFileSync(outP, out.map((o) => JSON.stringify(o)).join('\n') + '\n')
  console.log(`predicted ${out.length} with ${model.contender}`)
} else if (cmd === 'cues') {
  // Task-B cues on every input; assemble.py keeps them only where V1 routed TECHNICAL_ELEVATION
  const { cues, CUES_VERSION } = await import('./cues.mjs')
  const [inputs, out] = args
  const lines = []
  for (const it of JSON.parse(readFileSync(inputs, 'utf8'))) {
    const t0 = performance.now()
    try {
      lines.push(JSON.stringify({ assetId: it.assetId, cues: cues(decode(readFileSync(it.path))), ms: Math.round(performance.now() - t0) }))
    } catch (e) {
      lines.push(JSON.stringify({ assetId: it.assetId, error: String(e.message ?? e) }))
    }
  }
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(`cues ${lines.length} (${CUES_VERSION}, node ${process.version})`)
} else {
  console.error('usage: run.mjs features|fit-v1|fit-v0b|predict|cues ...')
  process.exit(2)
}
