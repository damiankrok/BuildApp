#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT mutation check of the candidate routing policy (RESEARCH ONLY).
 *
 *   node research/analyzer-005r-router-n1/mutations.mjs <out.json>
 *
 * Runs on a working tree that carries the candidate (candidate/n1v-production.patch). Each mutant rewrites anchored
 * text in the candidate's production files, runs the focused behavioural tests, records KILLED / SURVIVED and whether
 * the kill came from a behavioural assertion (an AssertionError / expect failure in vitest's output) rather than a
 * crash at import time, and restores every file byte for byte. M1–M6 are the six 005R-ROUTER mutants re-anchored to
 * the candidate; M7–M8 are new and cover the vision path, the only critical path the six did not reach.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const ANALYZE = 'packages/source-analyzer/src/analyze.ts'
const TASKS = 'packages/source-vision/src/tasks.ts'
const APPLY = 'packages/source-vision/src/apply.ts'
const GATE = "const perspectiveRefused = document === 'PERSPECTIVE_RENDER' && !readsAsFacade(asset.roles)"
const RULE = "roles.document === 'ELEVATION' || (roles.document === 'PERSPECTIVE_RENDER' && roles.projection === 'ORTHOGRAPHIC_ELEVATION')"
const GUARD = "  if (task === 'FACADE_DECOMPOSITION' && !readsAsFacade(frame.roles)) throw new Error("
const MUTANTS = [
  { id: 'M1-no-gate', what: 'projection bypass: perspective frames read as facades again', edits: [[ANALYZE, GATE, 'const perspectiveRefused = false']] },
  { id: 'M2-document-only', what: 'orthographic evidence deleted: a render an adapter declares orthographic is refused', edits: [[ANALYZE, GATE, "const perspectiveRefused = document === 'PERSPECTIVE_RENDER'"]] },
  { id: 'M3-gate-elevations', what: 'lost technical facade: elevations gated by projection too', edits: [[TASKS, RULE, "roles.projection === 'ORTHOGRAPHIC_ELEVATION'"], [ANALYZE, GATE, "const perspectiveRefused = (document === 'PERSPECTIVE_RENDER' || document === 'ELEVATION') && !readsAsFacade(asset.roles)"]] },
  { id: 'M4-false-missing', what: 'refused frame also reported as read-and-found-nothing', edits: [[ANALYZE, '&& !analysis.visionAttempted && !perspectiveRefused) {', '&& !analysis.visionAttempted) {']] },
  { id: 'M5-silent-skip', what: 'fail-closed without a typed refusal', edits: [[ANALYZE, 'builder.unresolved(`facade observations on the perspective render ${asset.id}`', 'void (`facade observations on the perspective render ${asset.id}`']] },
  { id: 'M6-gate-everything', what: 'over-broad drop: all facade reading stopped', edits: [[ANALYZE, GATE, "const perspectiveRefused = document === 'PERSPECTIVE_RENDER' || document === 'ELEVATION'"]] },
  { id: 'M7-vision-bypass', what: 'live vision bypass: the facade task is requested and applied on perspective frames (false facade evidence the ledger would then call corroboration)', edits: [[ANALYZE, 'const tasks = tasksForRoles(asset.roles)', 'const tasks = tasksForDocument(document)'], [ANALYZE, 'readsAsFacade, tasksForRoles }', 'readsAsFacade, tasksForDocument, tasksForRoles }'], [APPLY, GUARD, '  if (false) throw new Error(']] },
  { id: 'M8-apply-guard-removed', what: 'the apply boundary lands a facade answer on a perspective frame', edits: [[APPLY, GUARD, '  if (false) throw new Error(']] },
]
const TESTS = ['packages/source-analyzer/test/projection-gate.test.ts', 'packages/source-analyzer/test/mutations-02.test.ts', 'packages/source-analyzer/test/vision-path.test.ts', 'packages/source-vision/test/vision.test.ts']
const files = [ANALYZE, TASKS, APPLY]
const originals = Object.fromEntries(files.map((f) => [f, readFileSync(join(REPO, f))]))
const restore = () => { for (const f of files) writeFileSync(join(REPO, f), originals[f]) }
const results = []
try {
  for (const m of MUTANTS) {
    restore()
    for (const [f, from, to] of m.edits) {
      const src = readFileSync(join(REPO, f), 'utf8')
      if (!src.includes(from)) throw new Error(`${m.id}: anchor not found in ${f}`)
      writeFileSync(join(REPO, f), src.replace(from, to))
    }
    const run = spawnSync('npx', ['vitest', 'run', ...TESTS], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
    const out = `${run.stdout}\n${run.stderr}`
    const failedTests = [...out.matchAll(/^\s*[×✗] (.+?)(?:\s+\d+ms)?$/gm)].map((x) => x[1].trim())
    results.push({
      id: m.id, what: m.what, outcome: run.status === 0 ? 'SURVIVED' : 'KILLED',
      failed: Number((out.match(/Tests\s+(\d+) failed/) ?? [])[1] ?? 0),
      behavioural: /AssertionError|expected .* to |toThrow|toBe|toEqual|toHaveLength/.test(out) && !/Failed to load|SyntaxError|Transform failed/.test(out),
      failedTests: failedTests.slice(0, 12),
    })
    process.stdout.write(`${m.id} ${results.at(-1).outcome} failed=${results.at(-1).failed} behavioural=${results.at(-1).behavioural}\n`)
  }
} finally {
  restore()
}
for (const f of files) if (!readFileSync(join(REPO, f)).equals(originals[f])) throw new Error(`${f} was not restored`)
writeFileSync(process.argv[2], JSON.stringify({ schema: 'research.005r-router-n1.mutations.1', killed: results.filter((r) => r.outcome === 'KILLED' && r.behavioural).length, total: results.length, tests: TESTS, results }, null, 1) + '\n')
