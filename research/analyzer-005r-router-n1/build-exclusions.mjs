#!/usr/bin/env node
/**
 * build-exclusions.mjs — BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT round-13 excluded families (RESEARCH ONLY).
 *
 *   node research/analyzer-005r-router-n1/build-exclusions.mjs <out.txt> <cached html dir> ...
 *
 * The union, over-merging being the safe direction, of:
 *  1. holdout/excluded-families-round-12.txt (every earlier list and its sources);
 *  2. the families of every draw in holdout/LEDGER.ndjson (round 12's two houses are development material now);
 *  3. `developmentFamilies`: every sealed source-package.json / *.pkg.json under stage-reports/ and holdout/;
 *  4. every ARCHON project address or slug named in any tracked text file (research/, stage-reports/, docs/, tests/,
 *     holdout/ — never the pool lists themselves, which name every address), which covers the 005R corpus, the 005R-ROUTER research and every DEV row;
 *  5. every ARCHON project address inside cached HTML under the given directories (the 005R corpus pages and
 *     carousels: families those pages link to were on screen during development).
 * No candidate page is opened. Output: sorted, one family per line.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { developmentFamilies, family } from '../../holdout/select.mjs'

const REPO = resolve(import.meta.dirname, '../..')
const [out, ...htmlDirs] = process.argv.slice(2)
const SLUG = /projekt-([a-z0-9]+(?:-[a-z0-9]+)*?)-m[0-9a-f]{13}/g
const fams = new Set()
const add = (why) => (f) => { if (f) { fams.add(f); counts[why] = (counts[why] ?? 0) + 1 } }
const counts = {}
for (const l of readFileSync(join(REPO, 'holdout/excluded-families-round-12.txt'), 'utf8').split('\n')) add('round12')(l.trim())
for (const l of readFileSync(join(REPO, 'holdout/LEDGER.ndjson'), 'utf8').split('\n').filter(Boolean)) for (const f of JSON.parse(l).families ?? []) add('drawn')(f)
for (const f of developmentFamilies(REPO)) add('sealed')(f)
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'research', 'stage-reports', 'docs', 'tests', 'holdout'], { cwd: REPO, maxBuffer: 1 << 28 }).toString().split('\0').filter((f) => f && !/^holdout\/pool(-dobredomy)?\.txt$/.test(f) && /\.(md|json|txt|ndjson|ts|mjs|py|csv|tsv)$/.test(f))
for (const f of tracked) for (const m of readFileSync(join(REPO, f), 'utf8').matchAll(SLUG)) add('text')(family(`projekt-${m[1]}`))
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [] })
for (const d of htmlDirs) for (const f of walk(resolve(d))) for (const m of readFileSync(f, 'utf8').matchAll(SLUG)) add('html')(family(`projekt-${m[1]}`))
const list = [...fams].sort()
writeFileSync(out, list.join('\n') + '\n')
process.stdout.write(JSON.stringify({ families: list.length, contributions: counts }) + '\n')
