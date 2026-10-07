#!/usr/bin/env node
/**
 * exclusions.mjs — BUILDPLAN-ANALYZER-005L blind round 9: the exclusion manifest (RESEARCH ONLY).
 *
 *   node research/analyzer-005l/exclusions.mjs --caches <dir,dir,...> --runs <dir,dir,...> --out <json> --list <txt>
 *
 * Recorded BEFORE the freeze and the draw (brief §36). Both round-9 picks are ARCHON pool addresses, so the list is
 * of ARCHON families (`family`, holdout/select.mjs). A family is excluded when it is, or might be, already known:
 *
 *   - every family a committed exclusion list names (holdout/excluded-families*.txt), rounds 1–8;
 *   - every family a blind round drew (holdout/LEDGER.ndjson);
 *   - every family of the 005K fresh-sheet gap set — its exclusion manifest (the 005J/005K benchmark and development
 *     families) and its draw ledger (the 14 projects drawn, now development material);
 *   - every family with a sealed package committed under stage-reports/ or holdout/, or in a development run outside
 *     the repository (`--runs`);
 *   - every project page linked from ANY page a development cache holds (`--caches`) — the similar-project and
 *     related links of the development, blind, benchmark and gap-set pages, swept from their cached markup.
 * Over-exclusion is the safe direction. Aliases and variants of a family share it by construction.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { developmentFamilies, family } from '../../holdout/select.mjs'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const ARCHON = /https?:\/\/(?:www\.)?archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13}/g
const ARCHON_REL = /["'](\/projekty-domow\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13})/g

const archon = new Map() // family -> reasons
const add = (fam, why) => archon.set(fam, [...new Set([...(archon.get(fam) ?? []), why])])
const sources = []

// 1. committed exclusion lists (the DobreDomy list names DobreDomy stems, not ARCHON families)
for (const f of readdirSync(join(REPO, 'holdout')).filter((f) => /^excluded-families.*\.txt$/.test(f) && !f.includes('dobredomy') && !f.includes('round-9')).sort()) {
  const text = readFileSync(join(REPO, 'holdout', f), 'utf8')
  sources.push({ kind: 'COMMITTED_EXCLUSION_LIST', path: `holdout/${f}`, sha256: sha256(text) })
  for (const line of text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) add(line, `holdout/${f}`)
}

// 2. every blind draw
const ledger = readFileSync(join(REPO, 'holdout/LEDGER.ndjson'), 'utf8')
sources.push({ kind: 'BLIND_LEDGER', path: 'holdout/LEDGER.ndjson', sha256: sha256(ledger) })
for (const m of ledger.matchAll(ARCHON)) add(family(m[1]), 'blind draw (LEDGER)')

// 3. the 005K fresh-sheet gap set: its exclusion manifest and every project it drew
const K = 'stage-reports/artifacts/analyzer-005k'
const kManifest = readFileSync(join(REPO, K, 'gap-set-exclusion-manifest.json'), 'utf8')
sources.push({ kind: 'GAP_SET_EXCLUSION_MANIFEST', path: `${K}/gap-set-exclusion-manifest.json`, sha256: sha256(kManifest) })
for (const fam of JSON.parse(kManifest).archon.list) add(fam, '005K gap-set exclusion manifest')
const kLedger = readFileSync(join(REPO, K, 'gap-set-draw-ledger.ndjson'), 'utf8')
sources.push({ kind: 'GAP_SET_DRAW_LEDGER', path: `${K}/gap-set-draw-ledger.ndjson`, sha256: sha256(kLedger) })
for (const m of kLedger.matchAll(ARCHON)) add(family(m[1]), '005K gap-set draw (now development material)')

// 4. sealed packages: committed, and the development runs outside the repository
for (const fam of developmentFamilies(REPO)) add(fam, 'sealed package committed under stage-reports/ or holdout/')
const packageUrl = (p) => String(JSON.parse(readFileSync(p, 'utf8')).canonicalUrl ?? '')
const walkPackages = (dir, depth = 0) => {
  if (!existsSync(dir) || depth > 4) return []
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) return walkPackages(p, depth + 1)
    return e === 'source-package.json' ? [p] : []
  })
}
for (const run of (arg('runs', '') || '').split(',').filter(Boolean)) {
  const pkgs = walkPackages(run)
  sources.push({ kind: 'DEVELOPMENT_RUNS', path: run, packages: pkgs.length })
  for (const p of pkgs) for (const m of packageUrl(p).matchAll(ARCHON)) add(family(m[1]), 'sealed development package')
}

// 5. every project page linked from any cached page of any development cache
for (const cache of (arg('caches', '') || '').split(',').filter(Boolean)) {
  if (!existsSync(cache)) continue
  let pages = 0
  for (const f of readdirSync(cache).filter((f) => f.endsWith('.type'))) {
    if (!readFileSync(join(cache, f), 'utf8').includes('html')) continue
    const bin = join(cache, f.replace(/\.type$/, '.bin'))
    if (!existsSync(bin)) continue
    const html = readFileSync(bin, 'utf8')
    pages += 1
    for (const m of html.matchAll(ARCHON)) add(family(m[1]), 'linked from a cached development page')
    for (const m of html.matchAll(ARCHON_REL)) add(family(m[2]), 'linked from a cached development page')
  }
  sources.push({ kind: 'DEVELOPMENT_CACHE', path: cache, htmlPages: pages })
}

const list = [...archon.keys()].sort()
const pool = readFileSync(join(REPO, 'holdout/pool.txt'), 'utf8').split('\n').filter(Boolean)
const URL_RE = /^https:\/\/www\.archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13}$/
const excludedAddresses = pool.filter((u) => archon.has(family(URL_RE.exec(u)[1]))).length
const text = `${list.join('\n')}\n`
writeFileSync(resolve(arg('list', join(REPO, 'holdout/excluded-families-round-9.txt'))), text)
const doc = {
  stage: 'BUILDPLAN-ANALYZER-005L',
  kind: 'blind round 9: exclusion manifest, recorded before the freeze and the draw',
  rule: 'an ARCHON family is excluded when a committed exclusion list names it, a blind round drew it, the 005K gap set excluded or drew it, a sealed development package is of it, or any page a development cache holds links to it (holdout/select.mjs `family`)',
  sources,
  archon: { families: list.length, poolAddresses: pool.length, excludedAddresses, drawable: pool.length - excludedAddresses, sha256: sha256(text), list: list.map((f) => ({ family: f, why: archon.get(f) })) },
}
writeFileSync(resolve(arg('out', 'exclusion-manifest.json')), `${JSON.stringify(doc, null, 1)}\n`)
process.stdout.write(`archon ${list.length} families, ${excludedAddresses} of ${pool.length} pool addresses excluded, ${pool.length - excludedAddresses} drawable; list sha256 ${sha256(text)}\n`)
