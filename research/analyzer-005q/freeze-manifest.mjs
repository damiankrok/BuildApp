#!/usr/bin/env node
/**
 * freeze-manifest.mjs — BUILDPLAN-ANALYZER-005Q production diff and freeze record (RESEARCH ONLY).
 *
 *   node research/analyzer-005q/freeze-manifest.mjs --out stage-reports/artifacts/analyzer-005q/production-diff-manifest.json
 *
 * Compares the working tree with the 005Q base: every changed path with its status, line counts and sha-256 at the base
 * and now; and, for each protected path, whether it is byte-identical to the base (tracked diff empty and no untracked
 * file under it). Text only; no output of a replay is read.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const BASE = '04d5568a4a36d2b850998f2848d06e2179218872'
const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const out = resolve(REPO, arg('out', 'stage-reports/artifacts/analyzer-005q/production-diff-manifest.json'))
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const atBase = (p) => {
  try {
    return sha(execFileSync('git', ['show', `${BASE}:${p}`], { cwd: REPO, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }))
  } catch {
    return null
  }
}
const now = (p) => (existsSync(join(REPO, p)) ? sha(readFileSync(join(REPO, p))) : null)

const numstat = new Map(
  git('diff', '--numstat', BASE)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [a, d, p] = l.split('\t')
      return [p, { added: Number(a), deleted: Number(d) }]
    }),
)
const tracked = git('diff', '--name-status', BASE)
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [status, path] = l.split('\t')
    return { path, status }
  })
const untracked = git('ls-files', '--others', '--exclude-standard')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((path) => ({ path, status: 'A (untracked)' }))
const changed = [...tracked, ...untracked]
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((c) => {
    const lines = numstat.get(c.path) ?? { added: readFileSync(join(REPO, c.path), 'utf8').split('\n').length - 1, deleted: 0 }
    const area = c.path.startsWith('packages/') && c.path.includes('/src/') ? 'PRODUCTION' : c.path.startsWith('packages/') || c.path.startsWith('tests/') ? 'TEST' : c.path.startsWith('holdout/') ? 'HOLDOUT_PROTOCOL' : c.path.startsWith('research/') ? 'RESEARCH' : c.path.startsWith('stage-reports/') ? 'REPORT' : 'OTHER'
    return { ...c, area, ...lines, sha256Base: atBase(c.path), sha256Now: now(c.path) }
  })

const PROTECTED = [
  'apps',
  '.github',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'vitest.config.ts',
  'packages/model',
  'packages/commands',
  'packages/architecture',
  'packages/source-metrics',
  'packages/source-cv',
  'packages/source-common',
  'packages/numeric-recogniser-ort',
  'packages/analysis-service',
  'holdout/pool.txt',
  'holdout/verdict.mjs',
]
const protectedPaths = PROTECTED.map((p) => {
  const diff = git('diff', '--name-only', BASE, '--', p).trim()
  const extra = git('ls-files', '--others', '--exclude-standard', '--', p).trim()
  return { path: p, identicalToBase: diff === '' && extra === '', changed: [...diff.split('\n'), ...extra.split('\n')].filter(Boolean) }
})
const productionFiles = changed.filter((c) => c.area === 'PRODUCTION')
const manifest = {
  stage: 'BUILDPLAN-ANALYZER-005Q',
  base: BASE,
  head: git('rev-parse', 'HEAD').trim(),
  workingTreeClean: git('status', '--porcelain').trim() === '',
  production: {
    packages: [...new Set(productionFiles.map((c) => c.path.split('/').slice(0, 2).join('/')))],
    files: productionFiles.length,
    added: productionFiles.reduce((s, c) => s + c.added, 0),
    deleted: productionFiles.reduce((s, c) => s + c.deleted, 0),
  },
  changed,
  protectedPaths,
  allProtectedIdentical: protectedPaths.every((p) => p.identicalToBase),
}
writeFileSync(out, `${JSON.stringify(manifest, null, 1)}\n`)
console.log(JSON.stringify({ production: manifest.production, allProtectedIdentical: manifest.allProtectedIdentical, changed: changed.length }))
