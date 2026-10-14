#!/usr/bin/env node
/**
 * freeze-manifest.mjs — BUILDPLAN-ANALYZER-005Q-CHAIN production freeze (RESEARCH ONLY; never imported by production).
 *
 *   node research/analyzer-005q-chain/freeze-manifest.mjs write <out.json>
 *   node research/analyzer-005q-chain/freeze-manifest.mjs check <start.json>     exits 1 on any change
 *
 * Per production path: tracked file count and SHA-256 over `git ls-files -s` (mode, blob, path) of the WORKING
 * TREE's committed index, plus a SHA-256 of every tracked file's bytes on disk (so an uncommitted edit also fails),
 * plus the untracked, git-ignored embedded OCR assets (PP-OCRv6 model, dictionary) and the built local-analyzer
 * bundle when present, and (005Q-CHAIN) the onnxruntime-web WASM binary, loader and package.json from node_modules. The 005Q-CHAIN stage starts at cd0c513bcbbb5a00dc7115c887daada1800f9172.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const PATHS = ['packages', 'apps', '.github', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json', 'vitest.config.ts',
  'packages/source-metrics', 'packages/source-cv', 'packages/reconstruction', 'packages/numeric-recogniser-ort', 'packages/analysis-service', 'apps/local-analyzer', 'apps/android']
const ASSET_DIRS = ['packages/numeric-recogniser-ort/models', 'apps/local-analyzer/dist']
// 005Q-CHAIN: the shipped OCR runtime (WASM binary and loader) the recogniser verifies against its pins, from node_modules
const ASSET_FILES = ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'node_modules/onnxruntime-web/package.json']
const sha = (b) => createHash('sha256').update(b).digest('hex')
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })

function manifest() {
  const out = { paths: {}, assets: {} }
  for (const p of PATHS) {
    const files = git('ls-files', '-z', '--', p).split('\0').filter(Boolean)
    const disk = createHash('sha256')
    for (const f of files) {
      const abs = join(REPO, f)
      disk.update(f + '\0' + (existsSync(abs) ? sha(readFileSync(abs)) : 'MISSING') + '\n')
    }
    out.paths[p] = { files: files.length, index: sha(git('ls-files', '-s', '--', p)), disk: disk.digest('hex') }
  }
  for (const d of ASSET_DIRS) {
    const abs = join(REPO, d)
    if (!existsSync(abs)) { out.assets[d] = 'ABSENT'; continue }
    const walk = (dir) => readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
    out.assets[d] = Object.fromEntries(walk(abs).map((f) => [f.slice(REPO.length + 1), sha(readFileSync(f))]))
  }
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
  console.log(diffs.length ? `FREEZE: CHANGED ${diffs.join(' ')}` : 'FREEZE: IDENTICAL')
  process.exit(diffs.length ? 1 : 0)
} else {
  console.error('usage: freeze-manifest.mjs write|check <file>')
  process.exit(2)
}
