#!/usr/bin/env node
// BUILDPLAN-005A blind holdout: enumerate + select. Deterministic, network only for robots.txt + sitemap.xml.
// It NEVER fetches a project page. usage:
//   node holdout/select.mjs enumerate --out holdout/           (needs network; run BEFORE the freeze commit)
//   node holdout/select.mjs select --pool holdout/pool.txt --pool-sha256 <hex> --pre-holdout-sha <40hex>
//   node holdout/select.mjs select --round 2 --pool holdout/pool.txt --pool-sha256 <hex> --pre-holdout-sha <40hex>
// Round 2 (BUILDPLAN-005B) draws with its own label from the same committed pool, less
// holdout/excluded-families-round-2.txt: every round-1 exclusion, the two round-1 draws, and every family the
// development pages (round-1 draws included) link to.
// Round 3 (BUILDPLAN-005C) draws ONE unseen ARCHON project from the same pool, less
// holdout/excluded-families-round-3.txt, and ONE unseen DobreDomy project from holdout/pool-dobredomy.txt, less
// holdout/excluded-families-dobredomy.txt, each with its own label:
//   node holdout/select.mjs enumerate-dobredomy --out holdout/          (robots.txt + sitemap.xml only; before the freeze)
//   node holdout/select.mjs select --round 3 --pool holdout/pool.txt --pool-sha256 <hex> \
//        --dd-pool holdout/pool-dobredomy.txt --dd-pool-sha256 <hex> --pre-holdout-sha <40hex>
// The DobreDomy draw is checked for technical material (README, round 3) by reading the drawn page's markup and
// nothing else; an ineligible draw is recorded and the next one is `SHA256(seed + ":next:" + k)`.
// Round 4 (BUILDPLAN-005D) draws TWO unseen ARCHON families from the same pool, less
// holdout/excluded-families-round-4.txt (round 3's families and the round-3 ARCHON draw, now a development house),
// exactly as rounds 1 and 2 draw, with seed = SHA256(PRE_HOLDOUT_4_SHA + "BUILDPLAN-005D-DIMENSION-CHAIN-HOLDOUT"):
//   node holdout/select.mjs select --round 4 --pool holdout/pool.txt --pool-sha256 <hex> --pre-holdout-sha <40hex>
// Round 5 (BUILDPLAN-005E) draws two ARCHON families the same way, less holdout/excluded-families-round-5.txt (round 4's
// families and the two round-4 draws, now development houses), with seed = SHA256(PRE_HOLDOUT_5_SHA + "BUILDPLAN-005E-NUMERIC-OCR-HOLDOUT"):
//   node holdout/select.mjs select --round 5 --pool holdout/pool.txt --pool-sha256 <hex> --pre-holdout-sha <40hex>
// `select` draws from the committed pool less the committed excluded families (holdout/excluded-families.txt:
// families the development pages link to), and refuses unless HEAD is the declared SHA, the tree is clean, and
// the pool is the tracked holdout/pool.txt whose hash both the operator and pool.meta.json declare.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const LABEL = 'BUILDPLAN-005A-BLIND-HOLDOUT'
const ROUNDS = {
  1: { label: LABEL, excluded: 'excluded-families.txt' },
  2: { label: 'BUILDPLAN-005B-BLIND-HOLDOUT-ROUND-2', excluded: 'excluded-families-round-2.txt' },
  3: { label: 'BUILDPLAN-005C-ARCHON-HOLDOUT', excluded: 'excluded-families-round-3.txt', picks: 1 },
  4: { label: 'BUILDPLAN-005D-DIMENSION-CHAIN-HOLDOUT', excluded: 'excluded-families-round-4.txt' },
  5: { label: 'BUILDPLAN-005E-NUMERIC-OCR-HOLDOUT', excluded: 'excluded-families-round-5.txt' },
}
const DOBREDOMY = {
  host: 'https://www.dobredomy.pl',
  label: 'BUILDPLAN-005C-DOBREDOMY-HOLDOUT',
  pool: 'pool-dobredomy.txt',
  meta: 'pool-dobredomy.meta.json',
  excluded: 'excluded-families-dobredomy.txt',
  // canonical sitemap form: one path segment under /projekt/, trailing slash, no query or fragment
  urlRe: /^https:\/\/www\.dobredomy\.pl\/projekt\/([A-Za-z][A-Za-z0-9]*)\/$/,
  // a garage or an outbuilding, decided from the slug alone (`G1`, `G2` …)
  notAHouse: /^G\d+$/,
  maxRedraws: 10,
}
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

/**
 * A DobreDomy family: the name stem before the first capital or digit (`asterVIII2g` → `aster`,
 * `justynianMalyIIp` → `justynian`). Over-merging is the safe direction for an exclusion.
 */
export function ddFamily(slug) {
  const m = /^[a-z]+/.exec(slug)
  return (m ? m[0] : slug).toLowerCase()
}

/**
 * Round 3's DobreDomy eligibility, fixed before the freeze and applied to the drawn page's markup only: the page
 * publishes technical material when a section headed as floor plans ("rzut") and a section headed as elevations
 * ("elewacj") each carry at least one image. Nothing else about the page is read.
 */
export function ddEligible(html) {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  const heads = [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[2].replace(/<[^>]*>/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }))
  const imagesUnder = (test) => heads.some((h, i) => test.test(h.text) && /<img\b/i.test(body.slice(h.end, heads[i + 1]?.at ?? body.length)))
  const plans = imagesUnder(/\brzut/)
  const elevations = imagesUnder(/\belewacj/)
  return { eligible: plans && elevations, plans, elevations }
}

/** One draw from a pool less its excluded families: `seed mod n` over the drawable list, in pool order. */
export function selectOne(poolText, preHoldoutSha, label, familyOf, excludedFamilies = new Set()) {
  if (!/^[0-9a-f]{40}$/.test(preHoldoutSha)) throw new Error('PRE_HOLDOUT_SHA must be 40 lowercase hex')
  const pool = poolText.split('\n').filter(Boolean)
  const sorted = [...pool].sort()
  if (sorted.join('\n') !== pool.join('\n')) throw new Error('pool is not in canonical order')
  const drawable = pool.filter((u) => !excludedFamilies.has(familyOf(u)))
  if (drawable.length === 0) throw new Error('nothing drawable')
  const seed = sha256(preHoldoutSha + label)
  const i1 = Number(BigInt(`0x${seed}`) % BigInt(drawable.length))
  return { seed, n: drawable.length, excluded: pool.length - drawable.length, i1, url: drawable[i1], family: familyOf(drawable[i1]), drawable }
}

/** The k-th re-draw after an ineligible DobreDomy draw: uniform over the drawable list, never the burned ones. */
export function redraw(seed, drawable, burned, k) {
  const left = drawable.filter((u) => !burned.has(u))
  if (left.length === 0) throw new Error('nothing left to draw')
  const i = Number(BigInt(`0x${sha256(`${seed}:next:${k}`)}`) % BigInt(left.length))
  return { k, index: i, url: left[i] }
}

async function enumerateDobreDomy(outDir) {
  const robots = await (await fetch(`${DOBREDOMY.host}/robots.txt`)).text()
  if (/^Disallow:\s*\/projekt\/?\s*$/m.test(robots)) throw new Error('robots.txt disallows /projekt/')
  const xmlBytes = Buffer.from(await (await fetch(`${DOBREDOMY.host}/sitemap.xml`)).arrayBuffer())
  const locs = [...xmlBytes.toString('utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const all = [...new Set(locs.filter((u) => DOBREDOMY.urlRe.test(u)))]
  const pool = all.filter((u) => !DOBREDOMY.notAHouse.test(DOBREDOMY.urlRe.exec(u)[1])).sort()
  const text = pool.map((u) => `${u}\n`).join('')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, DOBREDOMY.pool), text)
  writeFileSync(join(outDir, DOBREDOMY.meta), JSON.stringify({ fetchedAt: new Date().toISOString(), sitemapSha256: sha256(xmlBytes), robotsSha256: sha256(robots), sitemapUrls: locs.length, projectUrls: all.length, notAHouse: all.length - pool.length, poolSize: pool.length, poolFamilies: new Set(pool.map((u) => ddFamily(DOBREDOMY.urlRe.exec(u)[1]))).size, poolSha256: sha256(text) }, null, 2))
  console.log(`dobredomy pool ${pool.length} urls, sha256 ${sha256(text)}`)
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

/**
 * Two draws from the pool less the excluded families. The first is `seed mod n`; the second is uniform over
 * every address of ANOTHER family (`SHA256(seed + ":second") mod m`) — not "the next index", which could only
 * ever reach the first address of each family. Indices are into the drawable list, which is in pool order.
 */
export function select(poolText, preHoldoutSha, excludedFamilies = new Set(), label = LABEL) {
  if (!/^[0-9a-f]{40}$/.test(preHoldoutSha)) throw new Error('PRE_HOLDOUT_SHA must be 40 lowercase hex')
  const pool = poolText.split('\n').filter(Boolean)
  const sorted = [...pool].sort()
  if (sorted.join('\n') !== pool.join('\n')) throw new Error('pool is not in canonical order')
  const familyOf = (u) => family(URL_RE.exec(u)[1])
  const drawable = pool.filter((u) => !excludedFamilies.has(familyOf(u)))
  const seed = sha256(preHoldoutSha + label)
  const i1 = Number(BigInt(`0x${seed}`) % BigInt(drawable.length))
  const f1 = familyOf(drawable[i1])
  const others = drawable.map((u, i) => i).filter((i) => familyOf(drawable[i]) !== f1)
  if (others.length === 0) throw new Error('pool has a single family')
  const i2 = others[Number(BigInt(`0x${sha256(`${seed}:second`)}`) % BigInt(others.length))]
  return { seed, n: drawable.length, excluded: pool.length - drawable.length, i1, i2, urls: [drawable[i1], drawable[i2]], families: [f1, familyOf(drawable[i2])] }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2]
  if (mode === 'enumerate') await enumerate(arg('out') ?? 'holdout', process.cwd())
  else if (mode === 'enumerate-dobredomy') await enumerateDobreDomy(arg('out') ?? 'holdout')
  else if (mode === 'select') {
    const sha = arg('pre-holdout-sha')
    const git = (...a) => execFileSync('git', a).toString().trim()
    const root = git('rev-parse', '--show-toplevel')
    const head = git('rev-parse', 'HEAD')
    if (head !== sha) throw new Error(`HEAD ${head} is not the declared PRE_HOLDOUT_SHA`)
    if (git('status', '--porcelain')) throw new Error('working tree is not clean')
    if (resolve(arg('pool') ?? '') !== join(root, 'holdout', 'pool.txt')) throw new Error('the pool is the tracked holdout/pool.txt, nothing else')
    const round = ROUNDS[arg('round') ?? '1']
    if (!round) throw new Error('--round is 1, 2, 3, 4 or 5')
    git('ls-files', '--error-unmatch', 'holdout/pool.txt', 'holdout/pool.meta.json', `holdout/${round.excluded}`)
    const text = readFileSync(join(root, 'holdout', 'pool.txt'), 'utf8')
    const declared = JSON.parse(readFileSync(join(root, 'holdout', 'pool.meta.json'), 'utf8')).poolSha256
    if (sha256(text) !== arg('pool-sha256') || sha256(text) !== declared) throw new Error('pool hash does not match the declared and committed POOL_SHA256')
    const exclusions = readFileSync(join(root, 'holdout', round.excluded), 'utf8')
    if (round.picks === 1) {
      // Round 3: one ARCHON draw, one DobreDomy draw, each with its own label and pool.
      git('ls-files', '--error-unmatch', `holdout/${DOBREDOMY.pool}`, `holdout/${DOBREDOMY.meta}`, `holdout/${DOBREDOMY.excluded}`)
      if (resolve(arg('dd-pool') ?? '') !== join(root, 'holdout', DOBREDOMY.pool)) throw new Error(`the DobreDomy pool is the tracked holdout/${DOBREDOMY.pool}, nothing else`)
      const ddText = readFileSync(join(root, 'holdout', DOBREDOMY.pool), 'utf8')
      const ddDeclared = JSON.parse(readFileSync(join(root, 'holdout', DOBREDOMY.meta), 'utf8')).poolSha256
      if (sha256(ddText) !== arg('dd-pool-sha256') || sha256(ddText) !== ddDeclared) throw new Error('DobreDomy pool hash does not match the declared and committed hash')
      const ddExclusions = readFileSync(join(root, 'holdout', DOBREDOMY.excluded), 'utf8')
      const archonFamily = (u) => family(URL_RE.exec(u)[1])
      const a = selectOne(text, sha, round.label, archonFamily, new Set(exclusions.split('\n').filter(Boolean)))
      const ddFamilyOf = (u) => ddFamily(DOBREDOMY.urlRe.exec(u)[1])
      const d = selectOne(ddText, sha, DOBREDOMY.label, ddFamilyOf, new Set(ddExclusions.split('\n').filter(Boolean)))
      const checks = []
      const burned = new Set()
      let pick = { k: 0, index: d.i1, url: d.url }
      for (let k = 1; ; k += 1) {
        const html = await (await fetch(pick.url)).text()
        const e = ddEligible(html)
        checks.push({ ...pick, ...e })
        if (e.eligible) break
        burned.add(pick.url)
        if (k > DOBREDOMY.maxRedraws) throw new Error('no eligible DobreDomy draw within the re-draw budget')
        pick = redraw(d.seed, d.drawable, burned, k)
      }
      const line = {
        at: new Date().toISOString(), label: 'BUILDPLAN-005C-BLIND-HOLDOUT-ROUND-3', preHoldoutSha: sha,
        archon: { label: round.label, excludedFamiliesFile: round.excluded, poolSha256: declared, excludedFamiliesSha256: sha256(exclusions), seed: a.seed, n: a.n, excluded: a.excluded, i1: a.i1, url: a.url, family: a.family },
        dobredomy: { label: DOBREDOMY.label, excludedFamiliesFile: DOBREDOMY.excluded, poolSha256: ddDeclared, excludedFamiliesSha256: sha256(ddExclusions), seed: d.seed, n: d.n, excluded: d.excluded, i1: d.i1, eligibility: checks, url: pick.url, family: ddFamilyOf(pick.url) },
      }
      appendFileSync(join(root, 'holdout', 'LEDGER.ndjson'), JSON.stringify(line) + '\n')
      console.log(JSON.stringify(line, null, 2))
      process.exit(0)
    }
    const r = select(text, sha, new Set(exclusions.split('\n').filter(Boolean)), round.label)
    appendFileSync(join(root, 'holdout', 'LEDGER.ndjson'), JSON.stringify({ at: new Date().toISOString(), ...(round.label !== LABEL ? { label: round.label, excludedFamiliesFile: round.excluded } : {}), preHoldoutSha: sha, poolSha256: declared, excludedFamiliesSha256: sha256(exclusions), ...r }) + '\n')   // append-only: a draw is burned once written, and committed after the runs
    console.log(JSON.stringify(r, null, 2))
  }
}
