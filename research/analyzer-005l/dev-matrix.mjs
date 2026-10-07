#!/usr/bin/env node
/**
 * dev-matrix.mjs — BUILDPLAN-ANALYZER-005L development replay (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005l/dev-matrix.mjs run --work <dir> [--rows a,b] [--par 3] [--label NEW]
 *   node research/analyzer-005l/dev-matrix.mjs report --work <dir> --out <json>
 *
 * Every row of `rows.json` (005K's 26 development rows and the 14 fresh 005K projects, development material since
 * 005K) is re-solved by the solver alone on its sealed package, observation graph and metric evidence
 * (`second-house.ts --package --graph --metrics`), so OCR and metric are held fixed. The drawn-gap rule is never
 * asked for (OFF). The old side is 005K's own solver-alone replay of the same inputs at the starting code (dev rows:
 * `work005k/dev/OFF`, fresh rows: `work005k/gapset/replay/OFF`), which reproduced every sealed outcome.
 *
 * The verdict is the committed predicates (`holdout/verdict.mjs`) on each run, with the row's sealed inputs beside
 * it; plus 005L's own measures of the emitted storeys: each level's wall-ring area and slab area, and whether an
 * upper storey's walls are a copy of the ground storey's.
 *
 * Run outputs live outside the repository; plan overlays (publisher-derived pictures) are deleted after each run.
 */
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const cmd = process.argv[2]
const work = resolve(arg('work', '/home/user/work005l/dev'))
const rows = JSON.parse(readFileSync(join(REPO, 'research/analyzer-005l/rows.json'), 'utf8')).rows
const p = (x) => (x.startsWith('/') ? x : join(REPO, x))

const argsOf = (row, out) => {
  const a = ['--package', p(row.inputs.package), '--graph', p(row.inputs.graph), '--metrics', p(row.inputs.metrics), '--cache', row.cache, '--out', out]
  if (row.dropFrames?.length) a.push('--drop-frames', row.dropFrames.join(','))
  return a
}

const prune = (out) => {
  const diag = join(out, 'plan-diagnostics')
  if (existsSync(diag)) for (const f of readdirSync(diag)) if (f.endsWith('.png')) rmSync(join(diag, f), { force: true })
}

const runOne = (row, label) =>
  new Promise((done) => {
    const out = join(work, label, row.row)
    rmSync(out, { recursive: true, force: true })
    mkdirSync(out, { recursive: true })
    const t0 = Date.now()
    const child = spawn('npx', ['vite-node', 'packages/analysis-service/scripts/second-house.ts', '--', ...argsOf(row, out)], { cwd: REPO, env: { ...process.env, OFFLINE: '1' } })
    let log = ''
    child.stdout.on('data', (d) => (log += d))
    child.stderr.on('data', (d) => (log += d))
    child.on('close', (code) => {
      writeFileSync(join(work, label, `${row.row}.log`), `${log}\nexit ${code} wall ${((Date.now() - t0) / 1000).toFixed(1)}\n`)
      prune(out)
      process.stdout.write(`${label} ${row.row} exit ${code} ${((Date.now() - t0) / 1000).toFixed(1)} s\n`)
      done()
    })
  })

async function run() {
  const only = arg('rows', '')
  const par = Number(arg('par', '3'))
  const label = arg('label', 'NEW')
  const todo = rows.filter((r) => !only || only.split(',').includes(r.row))
  mkdirSync(join(work, label), { recursive: true })
  let next = 0
  const lane = async () => {
    while (next < todo.length) await runOne(todo[next++], label)
  }
  await Promise.all(Array.from({ length: par }, lane))
}

const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null)
const outcomeOf = (dir) => {
  const s = readJson(join(dir, 'result-summary.json'))
  if (s) return { outcome: 'COMPLETED', modelHash: s.modelHash, code: null }
  const f = readJson(join(dir, 'failure.json'))
  return { outcome: f ? 'FAILED' : 'NO_RUN', modelHash: null, code: f ? `${f.code}/${f.reasonCode ?? '-'}` : null }
}
const oldDirOf = (row) => (row.set === 'FRESH_005K' ? join('/home/user/work005k/gapset/replay/OFF', row.row) : join('/home/user/work005k/dev/OFF', row.row))

/** The committed verdict predicates, on a run directory with the row's sealed inputs beside it (copied to a temp dir). */
function verdictOf(row, dir) {
  if (!existsSync(dir)) return null
  const tmp = mkdtempSync(join(tmpdir(), 'v005l-'))
  try {
    for (const f of readdirSync(dir)) if (f.endsWith('.json')) copyFileSync(join(dir, f), join(tmp, f))
    if (existsSync(join(dir, 'plan-diagnostics', 'digest.json'))) {
      mkdirSync(join(tmp, 'plan-diagnostics'))
      copyFileSync(join(dir, 'plan-diagnostics', 'digest.json'), join(tmp, 'plan-diagnostics', 'digest.json'))
    }
    copyFileSync(p(row.inputs.package), join(tmp, 'source-package.json'))
    copyFileSync(p(row.inputs.graph), join(tmp, 'observation-graph.json'))
    copyFileSync(p(row.inputs.metrics), join(tmp, 'metric-evidence.json'))
    return JSON.parse(execFileSync('node', [join(REPO, 'holdout/verdict.mjs'), tmp], { encoding: 'utf8' }))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const ringArea = (poly) => Math.abs(poly.reduce((a, q, i) => a + q.x * poly[(i + 1) % poly.length].z - poly[(i + 1) % poly.length].x * q.z, 0)) / 2
const r2 = (v) => Math.round(v * 100) / 100

/** 005L: what each emitted level is — its exterior wall rings (polygons) and slabs — and whether an upper level's rings copy the lowest's. */
function storeysOf(dir) {
  const m = readJson(join(dir, 'model.json'))
  if (!m?.levels?.length) return null
  const levels = [...m.levels].sort((a, b) => a.index - b.index)
  const walls = new Map((m.walls ?? []).map((w) => [w.id, w]))
  const rings = m.wallRings ?? []
  const out = levels.map((l) => {
    const own = rings.filter((r) => r.levelId === l.id)
    const boxes = own
      .map((r) => r.wallIds.map((id) => walls.get(id)).filter(Boolean))
      .filter((ws) => ws.length > 0)
      .map((ws) => {
        const xs = ws.flatMap((w) => [w.start.x, w.end.x])
        const zs = ws.flatMap((w) => [w.start.z, w.end.z])
        return [r2(Math.min(...xs)), r2(Math.min(...zs)), r2(Math.max(...xs)), r2(Math.max(...zs))]
      })
    return {
      index: l.index,
      rings: boxes.length,
      ringAreaM2: r2(boxes.reduce((a, b) => a + (b[2] - b[0]) * (b[3] - b[1]), 0)),
      ringBoxes: boxes,
      slabAreaM2: r2((m.slabs ?? []).filter((s) => s.levelId === l.id).reduce((a, s) => a + ringArea(s.polygon), 0)),
    }
  })
  const key = (l) => JSON.stringify([...l.ringBoxes].sort())
  return out.map((l, i) => ({ ...l, copiesLowest: i > 0 && key(l) === key(out[0]) }))
}

function report() {
  const label = arg('label', 'NEW')
  const out = []
  for (const row of rows) {
    const newDir = join(work, label, row.row)
    if (!existsSync(newDir)) continue
    const oldDir = oldDirOf(row)
    const vo = verdictOf(row, oldDir)
    const vn = verdictOf(row, newDir)
    const old = { ...outcomeOf(oldDir), verdict: vo?.verdict ?? null, storeys: vo?.conditions?.storeys ?? null, footprint: vo?.conditions?.footprint ?? null, openings: vo?.conditions?.openingsAllBuilt?.holds ?? null, emitted: storeysOf(oldDir) }
    const now = { ...outcomeOf(newDir), verdict: vn?.verdict ?? null, storeys: vn?.conditions?.storeys ?? null, footprint: vn?.conditions?.footprint ?? null, openings: vn?.conditions?.openingsAllBuilt?.holds ?? null, emitted: storeysOf(newDir) }
    out.push({
      row: row.row,
      set: row.set,
      old,
      new: now,
      modelChanged: old.modelHash !== now.modelHash || old.code !== now.code,
      verdictChanged: old.verdict !== now.verdict,
    })
  }
  const doc = { stage: 'BUILDPLAN-ANALYZER-005L', kind: 'development replay: the solver alone on each row’s sealed evidence, old (005K replay at the starting code) against new; committed verdict predicates; research harness', gitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(), rows: out }
  writeFileSync(resolve(arg('out', join(work, 'development-matrix.json'))), `${JSON.stringify(doc, null, 1)}\n`)
  process.stdout.write(`${out.length} rows\n`)
}

if (cmd === 'run') await run()
else if (cmd === 'report') report()
else {
  process.stderr.write('usage: dev-matrix.mjs run|report --work <dir> ...\n')
  process.exit(2)
}
