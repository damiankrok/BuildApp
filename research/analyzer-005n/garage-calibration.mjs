#!/usr/bin/env node
/**
 * garage-calibration.mjs — BUILDPLAN-ANALYZER-005N blind round 10 (RESEARCH ONLY): the garage stratum (`archonGarage`,
 * holdout/select.mjs) read on every cached ARCHON project page of the development caches, before the freeze and the
 * draw, against what each page's own published figures say (`archonPublished`'s `garage_area`). Offline: cached markup
 * only. Addresses, families and figures only.
 *
 *   node research/analyzer-005n/garage-calibration.mjs --caches <dir,dir,...> --out <json>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { archonGarage, family } from '../../holdout/select.mjs'

const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const CANON = /<link[^>]+rel="canonical"[^>]+href="(https:\/\/www\.archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-m[0-9a-f]{13})"/i
const rows = new Map()
for (const cache of arg('caches', '').split(',').filter(Boolean)) {
  if (!existsSync(cache)) continue
  for (const f of readdirSync(cache).filter((x) => x.endsWith('.type'))) {
    if (!readFileSync(join(cache, f), 'utf8').includes('html')) continue
    const html = readFileSync(join(cache, f.replace(/\.type$/, '.bin')), 'utf8')
    const m = CANON.exec(html)
    if (!m || rows.has(m[1])) continue
    // the published figure as the page labels it, independently of the predicate's own reading
    const labelled = /powierzchni[ae] gara[zż]u[\s\S]{0,400}?product-data__value[^>]*>\s*([\d\s,.]+)/i.exec(html)
    rows.set(m[1], { url: m[1], family: family(m[2]), ...archonGarage(html), labelledGarageM2: labelled ? Number(labelled[1].replace(/\s/g, '').replace(',', '.')) : null })
  }
}
const list = [...rows.values()].sort((a, b) => (a.url < b.url ? -1 : 1))
const agree = list.filter((r) => (r.labelledGarageM2 !== null && r.labelledGarageM2 > 0) === r.garage).length
writeFileSync(resolve(arg('out')), JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005N', kind: 'round-10 garage stratum calibrated on cached development pages, before the freeze and the draw', pages: list.length, withGarage: list.filter((r) => r.garage).length, agreesWithLabel: agree, rows: list }, null, 1) + '\n')
process.stdout.write(`${list.length} pages, ${list.filter((r) => r.garage).length} with a garage, ${agree} agree with the labelled figure\n`)
