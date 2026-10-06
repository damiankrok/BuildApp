#!/usr/bin/env node
/**
 * exclusions.mjs — BUILDPLAN-ANALYZER-005K fresh-sheet gap set: the exclusion manifest (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/exclusions.mjs --caches <dir,dir,...> --runs <dir,dir,...> --out <json>
 *
 * Recorded BEFORE any sheet is drawn (brief §11). A family is excluded when it is, or might be, already known:
 *
 *   - every family a committed exclusion list names (holdout/excluded-families*.txt: the development pages' similar
 *     projects, round by round, ARCHON and DobreDomy);
 *   - every family ever drawn for a blind round (holdout/LEDGER.ndjson) — the blind houses, now development houses;
 *   - every family with a sealed package committed under stage-reports/ or holdout/ (`developmentFamilies`), and every
 *     family whose sealed package lives in a development run outside the repository (`--runs`);
 *   - every project page linked from ANY page a development cache holds (`--caches`): the similar-project and
 *     related links of the development, blind and benchmark pages (005G and 005J read only those houses), swept from
 *     the cached markup, whichever stage fetched it. Over-exclusion is the safe direction.
 *
 * Families: `family` (ARCHON: the first two slug tokens, three after a preposition) and `ddFamily` (DobreDomy: the
 * name stem before the first capital or digit), as every blind round counted them. Aliases and variants of a family
 * share it by construction.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ddFamily, developmentFamilies, family } from '../../holdout/select.mjs'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const ARCHON = /https?:\/\/(?:www\.)?archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13}/g
const DOBREDOMY = /https?:\/\/(?:www\.)?dobredomy\.pl\/projekt\/([A-Za-z][A-Za-z0-9]*)\/?/g
const ARCHON_REL = /["'](\/projekty-domow\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13})/g
const DOBREDOMY_REL = /["']\/projekt\/([A-Za-z][A-Za-z0-9]*)\/?["'?#]/g

const archon = new Map() // family -> reasons
const dobredomy = new Map()
const add = (map, fam, why) => map.set(fam, [...new Set([...(map.get(fam) ?? []), why])])
const sources = []

// 1. committed exclusion lists
for (const f of readdirSync(join(REPO, 'holdout')).filter((f) => /^excluded-families.*\.txt$/.test(f)).sort()) {
  const text = readFileSync(join(REPO, 'holdout', f), 'utf8')
  sources.push({ kind: 'COMMITTED_EXCLUSION_LIST', path: `holdout/${f}`, sha256: sha256(text) })
  for (const line of text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) add(f.includes('dobredomy') ? dobredomy : archon, line, `holdout/${f}`)
}

// 2. every blind draw
const ledger = readFileSync(join(REPO, 'holdout/LEDGER.ndjson'), 'utf8')
sources.push({ kind: 'BLIND_LEDGER', path: 'holdout/LEDGER.ndjson', sha256: sha256(ledger) })
for (const m of ledger.matchAll(ARCHON)) add(archon, family(m[1]), 'blind draw (LEDGER)')
for (const m of ledger.matchAll(DOBREDOMY)) add(dobredomy, ddFamily(m[1]), 'blind draw (LEDGER)')

// 3. sealed packages: committed, and the development runs outside the repository
for (const fam of developmentFamilies(REPO)) add(archon, fam, 'sealed package committed under stage-reports/ or holdout/')
const packageUrl = (p) => String(JSON.parse(readFileSync(p, 'utf8')).canonicalUrl ?? '')
const walkPackages = (dir, depth = 0) => {
  if (!existsSync(dir) || depth > 3) return []
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) return walkPackages(p, depth + 1)
    return e === 'source-package.json' ? [p] : []
  })
}
for (const run of (arg('runs', '') || '').split(',').filter(Boolean)) {
  const pkgs = walkPackages(run)
  sources.push({ kind: 'DEVELOPMENT_RUNS', path: run, packages: pkgs.length })
  for (const p of pkgs) {
    const url = packageUrl(p)
    for (const m of url.matchAll(ARCHON)) add(archon, family(m[1]), 'sealed development package')
    for (const m of url.matchAll(DOBREDOMY)) add(dobredomy, ddFamily(m[1]), 'sealed development package')
  }
}
// the committed DobreDomy packages (developmentFamilies counts ARCHON only)
const walkCommitted = (d) =>
  readdirSync(d).flatMap((e) => {
    const p = join(d, e)
    return statSync(p).isDirectory() ? walkCommitted(p) : e === 'source-package.json' || e.endsWith('.pkg.json') ? [p] : []
  })
for (const p of walkCommitted(join(REPO, 'stage-reports'))) for (const m of packageUrl(p).matchAll(DOBREDOMY)) add(dobredomy, ddFamily(m[1]), 'sealed package committed under stage-reports/')

// 4. every project page linked from any cached page of any development cache
for (const cache of (arg('caches', '') || '').split(',').filter(Boolean)) {
  if (!existsSync(cache)) continue
  let pages = 0
  for (const f of readdirSync(cache).filter((f) => f.endsWith('.type'))) {
    if (!readFileSync(join(cache, f), 'utf8').includes('html')) continue
    const bin = join(cache, f.replace(/\.type$/, '.bin'))
    if (!existsSync(bin)) continue
    const html = readFileSync(bin, 'utf8')
    pages += 1
    for (const m of html.matchAll(ARCHON)) add(archon, family(m[1]), 'linked from a cached development page')
    for (const m of html.matchAll(ARCHON_REL)) add(archon, family(m[2]), 'linked from a cached development page')
    for (const m of html.matchAll(DOBREDOMY)) add(dobredomy, ddFamily(m[1]), 'linked from a cached development page')
    if (/dobredomy\.pl/.test(html)) for (const m of html.matchAll(DOBREDOMY_REL)) add(dobredomy, ddFamily(m[1]), 'linked from a cached development page')
  }
  sources.push({ kind: 'DEVELOPMENT_CACHE', path: cache, htmlPages: pages })
}

const listOf = (map) => [...map.keys()].sort()
const doc = {
  stage: 'BUILDPLAN-ANALYZER-005K',
  kind: 'fresh-sheet gap set: exclusion manifest, recorded before any sheet is drawn',
  rule: 'a family is excluded when a committed exclusion list names it, a blind round drew it, a sealed development package is of it, or any page a development cache holds links to it; ARCHON families by `family`, DobreDomy by `ddFamily` (holdout/select.mjs)',
  sources,
  archon: { families: listOf(archon).length, sha256: sha256(listOf(archon).join('\n')), list: listOf(archon) },
  dobredomy: { families: listOf(dobredomy).length, sha256: sha256(listOf(dobredomy).join('\n')), list: listOf(dobredomy) },
}
writeFileSync(resolve(arg('out', 'gap-set-exclusion-manifest.json')), `${JSON.stringify(doc, null, 1)}\n`)
process.stdout.write(`archon ${doc.archon.families} families, dobredomy ${doc.dobredomy.families} families\n`)
