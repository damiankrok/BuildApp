// SOURCE-01 (research): re-fetch the 005R ARCHON corpus images listed in its manifest into a work directory OUTSIDE
// the repository, verifying each file's SHA-256 against the manifest. Publisher pixels never enter Git.
//   node research/analyzer-source-01/fetch-corpus.mjs <out-dir> [maxPerFamily]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
const out = resolve(process.argv[2] ?? '')
if (!process.argv[2] || out.startsWith(resolve('.'))) { console.error('REFUSED: the output must be outside the repository'); process.exit(2) }
const cap = Number(process.argv[3] ?? 1e9)
const m = JSON.parse(readFileSync('stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json', 'utf8'))
mkdirSync(join(out, 'img'), { recursive: true })
const perFamily = new Map(); const jobs = []
for (const a of Object.values(m.assets).sort((x, y) => x.assetId.localeCompare(y.assetId))) {
  const n = perFamily.get(a.family) ?? 0
  if (n >= cap) continue
  perFamily.set(a.family, n + 1)
  jobs.push(a)
}
const index = []; let ok = 0, bad = 0, failed = 0
const one = async (a) => {
  const sha = a.variantSha256
  const ext = (a.format || 'jpg').toLowerCase().replace('jpeg', 'jpg')
  const file = join(out, 'img', `${sha}.${ext}`)
  const row = { sha256: sha, file: `${sha}.${ext}`, family: a.family, editions: a.editions, width: a.width, height: a.height, url: a.memberships[0]?.url, channel: a.memberships[0]?.channel }
  if (existsSync(file)) { ok++; index.push(row); return }
  for (const mem of a.memberships) {
    try {
      const r = await fetch(mem.url, { headers: { 'user-agent': 'BuildPlan-research/1.0' } })
      if (!r.ok) continue
      const b = new Uint8Array(await r.arrayBuffer())
      const h = createHash('sha256').update(b).digest('hex')
      if (h !== sha) { bad++; row.mismatch = h; continue }
      writeFileSync(file, b); ok++; index.push(row); return
    } catch { /* try the next membership */ }
  }
  failed++; index.push({ ...row, missing: true })
}
for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map(one))
writeFileSync(join(out, 'index.json'), JSON.stringify(index.sort((x, y) => x.sha256.localeCompare(y.sha256)), null, 1))
console.log(`assets ${jobs.length}: ok ${ok}, hash mismatch ${bad}, failed ${failed}`)
