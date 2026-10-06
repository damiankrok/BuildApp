#!/usr/bin/env node
/**
 * dev-matrix.mjs — BUILDPLAN-ANALYZER-005K development replay (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005k/dev-matrix.mjs run --work <dir> --modes OFF,ON[,ON_DECOY] [--rows a,b] [--par 3]
 *   node research/analyzer-005k/dev-matrix.mjs report --work <dir> --out <json>
 *
 * Every development row (`dev-rows.json`) is re-solved with the solver alone on its sealed package, observation graph
 * and metric evidence (`second-house.ts --package --graph --metrics`), so OCR and metric are held fixed:
 *
 *   OFF       the code under test with the drawn-gap rule OFF — it must reproduce the sealed model hash or failure code
 *             (the per-gap records changed no decision);
 *   ON        the drawn-gap rule ON (`--drawn-gap-rule ON`);
 *   ON_DECOY  ON with the published footprint multiplied by 1.25 (`--decoy-footprint 1.25`): the non-circularity
 *             control — every reading the two runs share must carry the same gap records.
 *
 * Run outputs live outside the repository. After each run the copied inputs (package, metric evidence) and the plan
 * overlays (publisher-derived pictures) are deleted; the digest, summary, failure, trace and model stay.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const cmd = process.argv[2]
const work = resolve(arg('work', '/home/user/work005k/dev'))
const rows = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005k/dev-rows.json'), 'utf8')).rows

/** The dimensioned GROUND/UNKNOWN plan frames of a sealed graph (the 005I matrix's `dimensioned`). */
const dimensioned = (graphPath) =>
  JSON.parse(readFileSync(join(REPO, graphPath), 'utf8'))
    .coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN' && ['GROUND', 'UNKNOWN'].includes(f.roles.storey) && f.roles.annotation === 'DIMENSIONED')
    .map((f) => f.id)
    .join(',')

const argsOf = (row, mode, out) => {
  const p = (x) => (x.startsWith('/') ? x : join(REPO, x))
  const a = ['--package', p(row.inputs.package), '--graph', p(row.inputs.graph), '--metrics', p(row.inputs.metrics), '--cache', row.cache, '--out', out]
  if (row.dropDimensionedGroundFrames) a.push('--drop-frames', dimensioned(row.inputs.graph))
  if (mode === 'ON' || mode === 'ON_DECOY') a.push('--drawn-gap-rule', 'ON')
  if (mode === 'ON_DECOY') a.push('--decoy-footprint', '1.25')
  return a
}

/** Keep the decisions, drop the copies and the pictures. */
const prune = (out) => {
  for (const f of ['source-package.json', 'metric-evidence.json', 'observation-graph.json']) rmSync(join(out, f), { force: true })
  const diag = join(out, 'plan-diagnostics')
  if (existsSync(diag)) for (const f of readdirSync(diag)) if (f.endsWith('.png')) rmSync(join(diag, f), { force: true })
}

const runOne = (row, mode) =>
  new Promise((done) => {
    const out = join(work, mode, row.row)
    rmSync(out, { recursive: true, force: true })
    mkdirSync(out, { recursive: true })
    const t0 = Date.now()
    const child = spawn('npx', ['vite-node', 'packages/analysis-service/scripts/second-house.ts', '--', ...argsOf(row, mode, out)], { cwd: REPO, env: { ...process.env, OFFLINE: '1' } })
    let log = ''
    child.stdout.on('data', (d) => (log += d))
    child.stderr.on('data', (d) => (log += d))
    child.on('close', (code) => {
      writeFileSync(join(work, mode, `${row.row}.log`), `${log}\nexit ${code} wall ${((Date.now() - t0) / 1000).toFixed(1)}\n`)
      prune(out)
      process.stdout.write(`${mode} ${row.row} exit ${code} ${((Date.now() - t0) / 1000).toFixed(1)} s\n`)
      done()
    })
  })

async function run() {
  const modes = arg('modes', 'OFF,ON').split(',')
  const only = arg('rows', '')
  const par = Number(arg('par', '3'))
  const todo = []
  for (const mode of modes) for (const row of rows) if (!only || only.split(',').includes(row.row)) todo.push([row, mode])
  for (const mode of modes) mkdirSync(join(work, mode), { recursive: true })
  let next = 0
  const lane = async () => {
    while (next < todo.length) {
      const [row, mode] = todo[next++]
      await runOne(row, mode)
    }
  }
  await Promise.all(Array.from({ length: par }, lane))
}

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null)
/** What a run decided: completed with a model, or failed with a code. */
const outcomeOf = (dir) => {
  const s = readJson(join(dir, 'result-summary.json'))
  if (s) return { outcome: 'COMPLETED', modelHash: s.modelHash, code: null }
  const f = readJson(join(dir, 'failure.json'))
  return { outcome: 'FAILED', modelHash: null, code: f ? `${f.code}/${f.reasonCode ?? '-'}` : 'NO_RUN' }
}
/** The sealed run's own decision (005I m-on or blind round 8). */
const sealedOf = (row) => {
  const s = readJson(join(row.sealed, 'result-summary.json'))
  if (s) return { outcome: s.outcome ?? 'COMPLETED', modelHash: s.modelHash ?? null, code: null }
  const f = readJson(join(row.sealed, 'failure.json'))
  return { outcome: 'FAILED', modelHash: null, code: f ? `${f.code}/${f.reasonCode ?? '-'}` : 'NO_RUN' }
}
const digestOf = (dir) => readJson(join(dir, 'plan-diagnostics', 'digest.json')) ?? readJson(join(dir, 'failure.json'))?.plans ?? null
/** Every gap record of every plan copy in a run's digest, keyed by frame / decomposition / gap. */
const recordsOf = (dir) => {
  const d = digestOf(dir)
  const out = new Map()
  for (const p of d?.plans ?? []) for (const r of p.boundary?.gapEvidence ?? []) out.set(`${p.frameId}/${r.decompositionId}/${r.gapId}`, { ...r, frameId: p.frameId, storey: p.storey })
  return out
}
/** The lowest-storey footprint of a completed run's model (the verdict's measure: slabs of the lowest level). */
const footprintOf = (dir) => {
  const m = readJson(join(dir, 'model.json'))
  if (!m?.levels?.length) return null
  const lowest = [...m.levels].sort((a, b) => a.index - b.index)[0]
  const ring = (poly) => Math.abs(poly.reduce((a, p, i) => a + p.x * poly[(i + 1) % poly.length].z - poly[(i + 1) % poly.length].x * p.z, 0)) / 2
  return Math.round((m.slabs ?? []).filter((s) => s.levelId === lowest.id).reduce((a, s) => a + ring(s.polygon), 0) * 100) / 100
}
const storeysOf = (dir) => readJson(join(dir, 'model.json'))?.levels?.length ?? null

function report() {
  const out = []
  for (const row of rows) {
    const dirs = Object.fromEntries(['OFF', 'ON', 'ON_DECOY'].map((m) => [m, join(work, m, row.row)]))
    if (!existsSync(dirs.OFF)) continue
    const sealed = sealedOf(row)
    const off = outcomeOf(dirs.OFF)
    const on = existsSync(dirs.ON) ? outcomeOf(dirs.ON) : null
    const recOff = recordsOf(dirs.OFF)
    const recOn = existsSync(dirs.ON) ? recordsOf(dirs.ON) : new Map()
    const upgraded = [...recOn.values()].filter((r) => r.drawnGapRule?.upgraded)
    const eligibleOff = [...recOff.values()].filter((r) => r.drawnGapRule?.check?.eligible)
    // non-circularity: every reading OFF and ON_DECOY share carries the same rule conditions on the same gaps
    let decoy = null
    if (existsSync(dirs.ON_DECOY)) {
      const recDecoy = recordsOf(dirs.ON_DECOY)
      const shared = [...recDecoy.keys()].filter((k) => recOn.has(k))
      const differ = shared.filter((k) => JSON.stringify(recOn.get(k)) !== JSON.stringify(recDecoy.get(k)))
      decoy = { outcome: outcomeOf(dirs.ON_DECOY), sharedRecords: shared.length, differingRecords: differ.length, differing: differ.slice(0, 10) }
    }
    // the first changed decision: the first gap (in canonical order) the rule upgraded on a reading OFF also read
    const firstChanged = upgraded.find((r) => recOff.has(`${r.frameId}/${r.decompositionId}/${r.gapId}`))
    out.push({
      row: row.row,
      sealed,
      off: { ...off, footprintM2: footprintOf(dirs.OFF), storeys: storeysOf(dirs.OFF), gapRecords: recOff.size, eligible: eligibleOff.length },
      offReproducesSealed: off.outcome === sealed.outcome && off.modelHash === sealed.modelHash && (off.code === sealed.code || sealed.code === null),
      on: on ? { ...on, footprintM2: footprintOf(dirs.ON), storeys: storeysOf(dirs.ON), gapRecords: recOn.size, upgraded: upgraded.length } : null,
      modelChanged: on ? on.modelHash !== off.modelHash || on.code !== off.code : null,
      upgradedGaps: upgraded.map((r) => ({ frameId: r.frameId, storey: r.storey, decompositionId: r.decompositionId, gapId: r.gapId, widthM: r.widthM, signature: r.signature, drawnVia: r.drawnGapRule.check?.drawnVia ?? null, outlineOff: recOff.get(`${r.frameId}/${r.decompositionId}/${r.gapId}`)?.outline ?? 'READING_NOT_IN_OFF', outlineOn: r.outline })),
      firstChangedDecision: firstChanged ? { stage: 'BOUNDARY_GAPS', object: `gap:${firstChanged.frameId}/${firstChanged.decompositionId}/${firstChanged.gapId}`, before: `WEAK:${recOff.get(`${firstChanged.frameId}/${firstChanged.decompositionId}/${firstChanged.gapId}`)?.outline}`, after: `STRONG:${firstChanged.outline}` } : null,
      decoy,
    })
  }
  const doc = { stage: 'BUILDPLAN-ANALYZER-005K', kind: 'development replay (solver alone on sealed evidence; research harness, production unchanged by it)', gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(), rows: out }
  writeFileSync(resolve(arg('out', join(work, 'development-matrix.json'))), `${JSON.stringify(doc, null, 1)}\n`)
  process.stdout.write(`${out.length} rows\n`)
}

if (cmd === 'run') await run()
else if (cmd === 'report') report()
else {
  process.stderr.write('usage: dev-matrix.mjs run|report --work <dir> ...\n')
  process.exit(2)
}
