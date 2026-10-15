#!/usr/bin/env node
/**
 * freeze-manifest.mjs — BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT production freeze (RESEARCH ONLY; never imported by
 * production). Copied from research/analyzer-005r-router/freeze-manifest.mjs; the allowlist and scope are this stage's.
 *
 *   node research/analyzer-005r-router-n1/freeze-manifest.mjs write <out.json>
 *   node research/analyzer-005r-router-n1/freeze-manifest.mjs check <start.json>   exits 1 on any change
 *   node research/analyzer-005r-router-n1/freeze-manifest.mjs check <start.json> --allow-scope
 *        tolerates differences ONLY in the itemised scope files (the one candidate patch) and lists them
 *
 * Allowlist here: research/analyzer-005r-router-n1/**, stage-reports/artifacts/analyzer-005r-router-n1/**,
 * stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_ROUTER_N1_*.md, PROJECT_STATUS.md, and the round-13 holdout files
 * (holdout/excluded-families-round-13.txt, holdout/LEDGER.ndjson, holdout/select.mjs). Scope (itemised): every tracked
 * file of packages/source-analyzer and packages/source-vision — the only packages the candidate may touch.
 *
 * (005R-ROUTER header follows.)
 *
 * Two layers:
 *  1. Per named production path (packages/, apps/, .github/, manifests, lockfile, holdout/, docs/, tests/ other than
 *     the one 005R isolation test): tracked file count, SHA-256 over `git ls-files -s` (mode, blob, path) and a
 *     SHA-256 of every tracked file's bytes on disk, so an uncommitted edit fails too.
 *  2. EVERYTHING tracked outside the 005R-ROUTER allowlist, as one digest: research/analyzer-005r-router/**,
 *     stage-reports/artifacts/analyzer-005r-router/**, stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_ROUTER_*.md, PROJECT_STATUS.md and
 *     tests/architecture/research-isolation.test.ts are the only paths 005R may touch.
 * Plus the untracked embedded runtime assets (PP-OCRv6 model and dictionary, local-analyzer bundle, onnxruntime-web
 * WASM, loader and package.json) — the "models, dictionary, WASM and binaries" of the brief.
 * The 005R-ROUTER stage starts at 8d414567e16e9a790bcf56cbebc10d778c6eb268. The ONE patch this stage may make is confined to
 * packages/source-package and packages/source-analyzer (brief §6); `scopeFiles` lists each of their tracked files by
 * SHA-256 so the end check can itemise a guarded change instead of reporting one opaque digest.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const PATHS = ['apps', '.github', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json', 'vitest.config.ts',
  'docs', 'packages/architecture', 'packages/source-package',
  'packages/source-observations', 'packages/reconstruction', 'packages/numeric-recogniser-ort', 'apps/local-analyzer', 'apps/android']
const ALLOWED = [/^research\/analyzer-005r-router-n1\//, /^stage-reports\/artifacts\/analyzer-005r-router-n1\//, /^stage-reports\/STAGE_BUILDPLAN_ANALYZER_005R_ROUTER_N1_[A-Z0-9_]+\.md$/,
  /^PROJECT_STATUS\.md$/, /^holdout\/excluded-families-round-13\.txt$/, /^holdout\/LEDGER\.ndjson$/, /^holdout\/select\.mjs$/,
  /^packages\/source-analyzer\//, /^packages\/source-vision\//]
const ASSET_DIRS = ['packages/numeric-recogniser-ort/models', 'apps/local-analyzer/dist']
const ASSET_FILES = ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'node_modules/onnxruntime-web/package.json']
const sha = (b) => createHash('sha256').update(b).digest('hex')
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })

function digestOf(files) {
  const disk = createHash('sha256')
  for (const f of files) {
    const abs = join(REPO, f)
    disk.update(f + '\0' + (existsSync(abs) ? sha(readFileSync(abs)) : 'MISSING') + '\n')
  }
  return disk.digest('hex')
}

function manifest() {
  const out = { paths: {}, outsideAllowlist: null, assets: {} }
  for (const p of PATHS) {
    const files = git('ls-files', '-z', '--', p).split('\0').filter(Boolean)
    out.paths[p] = { files: files.length, index: sha(git('ls-files', '-s', '--', p)), disk: digestOf(files) }
  }
  const tests = git('ls-files', '-z', '--', 'tests').split('\0').filter(Boolean)
  out.paths['tests'] = { files: tests.length, disk: digestOf(tests) }
  const outside = git('ls-files', '-z').split('\0').filter((f) => f && !ALLOWED.some((r) => r.test(f)))
  out.outsideAllowlist = { files: outside.length, disk: digestOf(outside) }
  for (const d of ASSET_DIRS) {
    const abs = join(REPO, d)
    if (!existsSync(abs)) { out.assets[d] = 'ABSENT'; continue }
    const walk = (dir) => readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
    out.assets[d] = Object.fromEntries(walk(abs).map((f) => [f.slice(REPO.length + 1), sha(readFileSync(f))]))
  }
  out.scopeFiles = {}
  // untracked files under the scope too (a new test file is part of the one patch)
  const scope = new Set([...git('ls-files', '-z', '--', 'packages/source-analyzer', 'packages/source-vision').split('\0'), ...git('ls-files', '-z', '--others', '--exclude-standard', '--', 'packages/source-analyzer', 'packages/source-vision').split('\0')].filter(Boolean))
  for (const f of [...scope].sort())
    out.scopeFiles[f] = existsSync(join(REPO, f)) ? sha(readFileSync(join(REPO, f))) : 'MISSING'
  for (const f of ASSET_FILES) out.assets[f] = existsSync(join(REPO, f)) ? sha(readFileSync(join(REPO, f))) : 'ABSENT'
  return out
}

const [cmd, file] = process.argv.slice(2)
const now = manifest()
if (cmd === 'write') {
  writeFileSync(file, JSON.stringify({ head: git('rev-parse', 'HEAD').trim(), ...now }, null, 1) + '\n')
  console.log(`written ${file}`)
} else if (cmd === 'check') {
  const start = JSON.parse(readFileSync(file, 'utf8'))
  const diffs = []
  for (const k of ['paths', 'assets']) for (const p of new Set([...Object.keys(start[k]), ...Object.keys(now[k])]))
    if (JSON.stringify(start[k][p]) !== JSON.stringify(now[k][p])) diffs.push(`${k}:${p}`)
  if (JSON.stringify(start.outsideAllowlist) !== JSON.stringify(now.outsideAllowlist)) diffs.push('outsideAllowlist')
  const scopeDiffs = []
  for (const f of new Set([...Object.keys(start.scopeFiles ?? {}), ...Object.keys(now.scopeFiles)]))
    if ((start.scopeFiles ?? {})[f] !== now.scopeFiles[f]) scopeDiffs.push(`scope:${f}`)
  const allowScope = process.argv.includes('--allow-scope')
  const all = [...diffs, ...scopeDiffs]
  console.log(all.length === 0 ? 'FREEZE: IDENTICAL' : diffs.length === 0 && allowScope ? `FREEZE: IDENTICAL OUTSIDE SCOPE; scope changed: ${scopeDiffs.join(' ')}` : `FREEZE: CHANGED ${all.join(' ')}`)
  process.exit(diffs.length || (scopeDiffs.length && !allowScope) ? 1 : 0)
} else {
  console.error('usage: freeze-manifest.mjs write|check <file>')
  process.exit(2)
}
