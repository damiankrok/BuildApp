#!/usr/bin/env node
/**
 * mutations.mjs — 005R-ROUTER mutation check of the projection gate (RESEARCH ONLY).
 *
 *   node research/analyzer-005r-router/mutations.mjs <out.json>
 *
 * Each mutant rewrites one line of packages/source-analyzer/src/analyze.ts, runs the analyzer's gate and mutation
 * tests, records whether they fail (KILLED) or pass (SURVIVED), and restores the file byte for byte.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const FILE = join(REPO, 'packages/source-analyzer/src/analyze.ts')
const GATE = "const perspectiveRefused = document === 'PERSPECTIVE_RENDER' && asset.roles.projection !== 'ORTHOGRAPHIC_ELEVATION'"
const MUTANTS = [
  { id: 'M1-no-gate', what: 'interior leakage: perspective frames read as facades again', from: GATE, to: 'const perspectiveRefused = false' },
  { id: 'M2-document-only', what: 'gate ignores the projection an adapter claims', from: GATE, to: "const perspectiveRefused = document === 'PERSPECTIVE_RENDER'" },
  { id: 'M3-gate-elevations', what: 'lost technical facade: elevations gated by projection too', from: GATE, to: "const perspectiveRefused = (document === 'PERSPECTIVE_RENDER' || document === 'ELEVATION') && asset.roles.projection !== 'ORTHOGRAPHIC_ELEVATION'" },
  { id: 'M4-false-missing', what: 'refused frame also reported as read-and-found-nothing', from: '&& !analysis.visionAttempted && !perspectiveRefused) {', to: '&& !analysis.visionAttempted) {' },
  { id: 'M5-silent-skip', what: 'fail-closed without a typed refusal', from: "builder.unresolved(`facade observations on the perspective render ${asset.id}`", to: "void (`facade observations on the perspective render ${asset.id}`" },
  { id: 'M6-gate-everything', what: 'all facade reading stopped', from: GATE, to: "const perspectiveRefused = document === 'PERSPECTIVE_RENDER' || document === 'ELEVATION'" },
]
const original = readFileSync(FILE)
const results = []
try {
  for (const m of MUTANTS) {
    const src = original.toString('utf8')
    if (!src.includes(m.from)) throw new Error(`${m.id}: anchor not found`)
    writeFileSync(FILE, src.replace(m.from, m.to))
    const run = spawnSync('npx', ['vitest', 'run', 'packages/source-analyzer/test/projection-gate.test.ts', 'packages/source-analyzer/test/mutations-02.test.ts'], { cwd: REPO, encoding: 'utf8' })
    results.push({ id: m.id, what: m.what, outcome: run.status === 0 ? 'SURVIVED' : 'KILLED', failed: (run.stdout.match(/Tests\s+(\d+) failed/) ?? [])[1] ?? '0' })
    process.stdout.write(`${m.id} ${results.at(-1).outcome}\n`)
  }
} finally {
  writeFileSync(FILE, original)
}
if (!readFileSync(FILE).equals(original)) throw new Error('analyze.ts was not restored')
writeFileSync(process.argv[2], JSON.stringify({ schema: 'research.005r-router.mutations.0.1', killed: results.filter((r) => r.outcome === 'KILLED').length, total: results.length, results }, null, 1) + '\n')
