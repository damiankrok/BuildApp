// SOURCE-01 (research): one manifest of labelled images for the classifier study, split by HOUSE FAMILY (split.json).
// DEV = 005R corpus images of non-TEST families + the eight regression houses' cached images; TEST = the ten TEST
// packages. An image whose bytes appear on both sides is dropped from DEV. Paths point outside the repository.
//   node research/analyzer-source-01/dataset.mjs > /home/user/work-s01/dataset.json
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { assetsOf } from './assets-of.mjs'
const split = JSON.parse(readFileSync('research/analyzer-source-01/split.json', 'utf8'))
const testFamilies = new Set(split.test.map((t) => t.family))
const label = new Map()
for (const f of ['labels-archon.json', 'labels-archon-final.json', 'labels-archon-iu03a.json', 'labels-archon-iu03b.json']) for (const r of JSON.parse(readFileSync(`research/image-understanding/data/${f}`, 'utf8')).rows) label.set(r.sha256, r.label)
for (const f of ['labels-test-new.json', 'labels-dev-new.json']) { const p = `research/analyzer-source-01/${f}`; if (existsSync(p)) for (const r of JSON.parse(readFileSync(p, 'utf8')).rows) label.set(r.sha256, r.label) }
const key = (u) => createHash('sha256').update(u).digest('hex').slice(0, 32)
const test = new Map()
for (const r of assetsOf('/home/user/work-s01/test-pkgs')) if (label.has(r.sha256)) test.set(r.sha256, { sha256: r.sha256, path: `/home/user/work-s01/cache/${key(r.url)}.bin`, family: r.house, split: 'TEST', label: label.get(r.sha256), w: r.width, h: r.height })
const dev = new Map()
for (const r of JSON.parse(readFileSync('/home/user/work-s01/corpus/index.json', 'utf8'))) {
  if (r.missing || testFamilies.has(r.family) || test.has(r.sha256) || !label.has(r.sha256)) continue
  dev.set(r.sha256, { sha256: r.sha256, path: `/home/user/work-s01/corpus/img/${r.file}`, family: r.family, split: 'DEV', label: label.get(r.sha256), w: r.width, h: r.height })
}
const known = { a01: 'archon:dom-w-jarzmiankach', gozd: 'archon:dom-w-gozdzikowcach', marcowki: 'archon:dom-w-marcowkach', ciesz: 'archon:dom-w-cieszyniankach', rary: 'archon:dom-w-rarytasach', trytomach: 'archon:dom-w-trytomach', arganiach: 'archon:dom-w-arganiach', sasankach3: 'archon:dom-w-sasankach' }
let devUnlabelled = []
for (const [h, fam] of Object.entries(known)) {
  const p = JSON.parse(readFileSync(`/home/user/workfix02/base/${h}/source-package.json`, 'utf8'))
  for (const a of p.assets) {
    const v = a.variants.find((x) => x.id === a.selectedVariantId) ?? a.variants[0]
    if (test.has(v.byteHash) || dev.has(v.byteHash)) continue
    const path = `/home/user/workfix02/cache/${key(v.url)}.bin`
    if (!existsSync(path)) continue
    if (!label.has(v.byteHash)) { devUnlabelled.push({ sha256: v.byteHash, path, w: v.decoded.width, h: v.decoded.height, family: fam }); continue }
    dev.set(v.byteHash, { sha256: v.byteHash, path, family: fam, split: 'DEV', label: label.get(v.byteHash), w: v.decoded.width, h: v.decoded.height })
  }
}
const rows = [...dev.values(), ...test.values()].sort((a, b) => a.split.localeCompare(b.split) || a.sha256.localeCompare(b.sha256))
process.stdout.write(`${JSON.stringify({ rows, devUnlabelled }, null, 1)}\n`)
