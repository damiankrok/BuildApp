#!/usr/bin/env node
// BUILDPLAN-005A blind holdout: enumerate + select. Deterministic, network only for robots.txt + sitemap.xml.
// It NEVER fetches a project page. usage:
//   node holdout-select.mjs enumerate --out holdout/           (needs network; run BEFORE the freeze commit)
//   node holdout-select.mjs select --pool holdout/pool.txt --pool-sha256 <hex> --pre-holdout-sha <40hex> [--no-git-check]
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const LABEL = 'BUILDPLAN-005A-BLIND-HOLDOUT'
const HOST = 'https://www.archon.pl'
const URL_RE = /^https:\/\/www\.archon\.pl\/projekty-domow\/(projekt-[a-z0-9-]+)-(m[0-9a-f]{13})$/   // canonical form, no query/fragment/slash
const PREP = new Set(['w', 'we', 'pod', 'przy', 'na', 'nad', 'u', 'za', 'przed', 'obok', 'ze', 'z', 'do', 'o', 'po'])
const NOT_A_HOUSE = /^(garaz|wiata|g\d+-|budynek|altana|domek-gospodarczy)/                            // decided from the slug alone
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined }

/** name stem before any number or variant suffix. Over-merging is the safe direction for an exclusion. */
export function family(slug) {
  const t = slug.replace(/^projekt-/, '').split('-')
  return (t.length > 2 && PREP.has(t[1]) ? t.slice(0, 3) : t.slice(0, 2)).join('-')
}

/** Every family ever analysed in development, from the sealed packages committed anywhere under stage-reports/ and holdout/. */
export function developmentFamilies(root) {
  const out = new Set(); const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (e === 'source-package.json' || e.endsWith('.pkg.json')) { const m = URL_RE.exec(String(JSON.parse(readFileSync(p, 'utf8')).canonicalUrl ?? '').split('?')[0]); if (m) out.add(family(m[1])) } } }
  for (const d of ['stage-reports', 'holdout']) if (existsSync(join(root, d))) walk(join(root, d))
  return out
}

async function enumerate(outDir, root) {
  const robots = await (await fetch(`${HOST}/robots.txt`)).text()
  if (/^Disallow:\s*\/projekty-domow\/?\s*$/m.test(robots)) throw new Error('robots.txt disallows /projekty-domow/')
  const xmlBytes = Buffer.from(await (await fetch(`${HOST}/sitemap.xml`)).arrayBuffer())
  const locs = [...xmlBytes.toString('utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const all = [...new Set(locs.filter((u) => URL_RE.test(u)))]
  const dev = developmentFamilies(root)
  const pool = all.filter((u) => { const slug = URL_RE.exec(u)[1]; return !NOT_A_HOUSE.test(slug.replace(/^projekt-/, '')) && !dev.has(family(slug)) }).sort()   // default sort = UTF-16 code units; ASCII only
  const text = pool.map((u) => `${u}\n`).join('')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'pool.txt'), text)
  writeFileSync(join(outDir, 'pool.meta.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), sitemapSha256: sha256(xmlBytes), robotsSha256: sha256(robots), sitemapUrls: locs.length, projectUrls: all.length, developmentFamilies: [...dev].sort(), poolSize: pool.length, poolFamilies: new Set(pool.map((u) => family(URL_RE.exec(u)[1]))).size, poolSha256: sha256(text) }, null, 2))
  console.log(`pool ${pool.length} urls, sha256 ${sha256(text)}`)
}

export function select(poolText, preHoldoutSha) {
  if (!/^[0-9a-f]{40}$/.test(preHoldoutSha)) throw new Error('PRE_HOLDOUT_SHA must be 40 lowercase hex')
  const pool = poolText.split('\n').filter(Boolean)
  const sorted = [...pool].sort()
  if (sorted.join('\n') !== pool.join('\n')) throw new Error('pool is not in canonical order')
  const seed = sha256(preHoldoutSha + LABEL)
  const n = BigInt(pool.length)
  const i1 = Number(BigInt(`0x${seed}`) % n)
  const f1 = family(URL_RE.exec(pool[i1])[1])
  let i2 = -1
  for (let k = 1; k < pool.length; k++) { const j = (i1 + k) % pool.length; if (family(URL_RE.exec(pool[j])[1]) !== f1) { i2 = j; break } }
  if (i2 < 0) throw new Error('pool has a single family')
  return { seed, n: pool.length, i1, i2, urls: [pool[i1], pool[i2]], families: [f1, family(URL_RE.exec(pool[i2])[1])] }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2]
  if (mode === 'enumerate') await enumerate(arg('out') ?? 'holdout', process.cwd())
  else if (mode === 'select') {
    const sha = arg('pre-holdout-sha')
    if (!process.argv.includes('--no-git-check')) {
      const head = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim()
      if (head !== sha) throw new Error(`HEAD ${head} is not the declared PRE_HOLDOUT_SHA`)
      if (execFileSync('git', ['status', '--porcelain']).toString().trim()) throw new Error('working tree is not clean')
    }
    const text = readFileSync(arg('pool'), 'utf8')
    if (sha256(text) !== arg('pool-sha256')) throw new Error('pool hash does not match the committed POOL_SHA256')
    const r = select(text, sha)
    appendFileSync(join(process.cwd(), 'holdout', 'LEDGER.ndjson'), JSON.stringify({ at: new Date().toISOString(), preHoldoutSha: sha, poolSha256: arg('pool-sha256'), ...r }) + '\n')   // append-only: a draw is burned once written
    console.log(JSON.stringify(r, null, 2))
  }
}
