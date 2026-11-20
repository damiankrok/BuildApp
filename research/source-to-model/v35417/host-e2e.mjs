#!/usr/bin/env node
/**
 * v3.54.17 (from v3.54.16): the same harness on the final v3.54.17 commit; the report reads the body/roof records (SET_ROOF, BUILD_MASSING, SET_OUTLINE) from the served summary. The books are research/ai-assist/spend-ledger-v35417.json (via book-host.ts).
 *
 * v3.54.16 (from v3.54.15): integration and quality are checked apart. Integration: the result names the correction
 * registry, at least one patch was COMMITTED by the shared executor and delivered (its revision is the served model's),
 * and a look judged the revision that carries it. Quality: the result carries a quality state of its own (never inferred
 * from CHECKED or from reuse), and the repeat keeps that state and its defect list with the same bytes.
 *
 * v3.54.15 (from v3.54.14): the pilot with strict tools (ANALYZER_STRICT_TOOLS=on) and the 5-minute prompt cache
 * (ANALYZER_PROMPT_CACHE=5m) switched on as well; the books journal carries the cache split.
 *
 * v3.54.14 (from v3.54.3) — the host's real public entrypoint, end to end, for the consultant pilot with the metric
 * consultant (ANALYZER_METRIC_CONSULTANT=on) and the automatic sketches (ANALYZER_SKETCHES=on), built from the final
 * commit (`--commit` is recorded beside every artifact). `--repeat` submits the FIRST url a second time with the token
 * and checks that it reuses the accepted consulted revision: the same model bytes, no request, 0 USD in the books.
 *
 *   node research/source-to-model/v35415/host-e2e.mjs --commit <sha> --out <dir> --data <host data dir> --max-usd <cumulative ceiling>
 *        --spent-usd <the campaign books' balance now> [--timeout-s 2400] [--repeat] [--default <url>] <project url> ...
 *
 * Starts the built server (apps/analyzer-api/dist/server.mjs — build it first) on a free loopback port with the pilot
 * switched on, then for each project URL: POST /v1/analyses with the pilot's access token → poll the status → GET the
 * result summary, the scene and the model → check the scene's bytes against the summary's hash and the response header,
 * and that the result came through the consultant's path with the global description DISABLED. `--default <url>` also
 * submits one job WITHOUT the token and checks that it runs on the drawings' path alone and books no request.
 *
 * The provider key is read by the server from BUILDPLAN_ANTHROPIC_API_KEY in the environment this script is started
 * with; it is never an argument and never printed. The access token is random, made here, held in memory, and never
 * written anywhere. Everything written under --out is text: status records, summaries, hashes, the books' journal.
 */
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const value = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const flags = new Set(['out', 'data', 'max-usd', 'spent-usd', 'timeout-s', 'default', 'commit'])
const urls = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && flags.has(argv[i - 1].slice(2))))
const out = value('out')
const dataDir = value('data')
if (!out || !dataDir || !value('max-usd') || !value('spent-usd')) throw new Error('give --out, --data, --max-usd and --spent-usd')
mkdirSync(out, { recursive: true })
mkdirSync(dataDir, { recursive: true })
const here = dirname(fileURLToPath(import.meta.url))
const server = join(here, '../../../apps/analyzer-api/dist/server.mjs')
const key = process.env.BUILDPLAN_ANTHROPIC_API_KEY ?? ''
const token = randomBytes(24).toString('hex')
const scrub = (t) => (key ? String(t).split(key).join('[key]') : String(t)).split(token).join('[token]')
const log = (line) => process.stdout.write(`${scrub(line)}\n`)
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const timeoutS = Number(value('timeout-s') ?? '1500')

const port = await new Promise((resolve) => {
  const s = createServer().listen(0, '127.0.0.1', () => {
    const { port: p } = s.address()
    s.close(() => resolve(p))
  })
})
const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', ANALYZER_DATA_DIR: dataDir, ANALYZER_CONSULTANT: 'pilot', ANALYZER_METRIC_CONSULTANT: 'on', ANALYZER_SKETCHES: 'on', ANALYZER_STRICT_TOOLS: 'on', ANALYZER_PROMPT_CACHE: '5m', ANALYZER_HOUSE_READER: 'live', ANALYZER_HOUSE_READER_MAX_USD: value('max-usd'), ANALYZER_HOUSE_READER_SPENT_USD: value('spent-usd'), ANALYZER_HOUSE_READER_TOKEN: token, ANALYZER_HOUSE_READER_MAX_REQUESTS_PER_DAY: '200', ANALYZER_JOB_TIMEOUT_MS: String(timeoutS * 1000), ANALYZER_RATE_LIMIT_MAX: '50' }
const serverLog = []
const child = spawn(process.execPath, [server], { env, stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.on('data', (d) => serverLog.push(scrub(d)))
child.stderr.on('data', (d) => serverLog.push(scrub(d)))
const base = `http://127.0.0.1:${port}`
const call = async (path, init) => {
  const res = await fetch(`${base}${path}`, init)
  const buf = Buffer.from(await res.arrayBuffer())
  let json = {}
  try {
    json = JSON.parse(buf.toString('utf8'))
  } catch {}
  return { status: res.status, json, buf, headers: res.headers }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []
const check = (ok, what) => {
  log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures.push(what)
}
const booksOf = () => {
  const f = join(dataDir, 'house-reader-spend.json')
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
}

try {
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await call('/health')).status === 200) break
    } catch {}
    await sleep(200)
  }
  const health = await call('/health')
  check(health.status === 200, `the host answers /health (analyzer ${JSON.stringify(health.json.analyzer ?? {})})`)
  writeFileSync(join(out, 'health.json'), `${JSON.stringify(health.json, null, 1)}\n`)

  const runOne = async (url, name, withToken) => {
    const dir = join(out, name)
    mkdirSync(dir, { recursive: true })
    const before = booksOf()
    const t0 = Date.now()
    const sub = await call('/v1/analyses', { method: 'POST', headers: { 'content-type': 'application/json', ...(withToken ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ url }) })
    check(sub.status === 202, `${name}: POST /v1/analyses → ${sub.status}`)
    if (sub.status !== 202) {
      writeFileSync(join(dir, 'submit.json'), `${JSON.stringify(sub.json, null, 1)}\n`)
      return
    }
    const id = sub.json.jobId
    let status
    for (;;) {
      status = (await call(`/v1/analyses/${id}`)).json
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.status)) break
      if (Date.now() - t0 > timeoutS * 1000) break
      await sleep(5000)
    }
    writeFileSync(join(dir, 'status.json'), `${scrub(JSON.stringify(status, null, 1))}\n`)
    const after = booksOf()
    // before the first request the host has no books file yet: its opening balance is the --spent-usd it was started with
    const spent = after ? Math.round((after.cumulativeUsd - (before ? before.cumulativeUsd : Number(value('spent-usd')))) * 1e6) / 1e6 : 0
    log(`${name}: ${status.status}${status.error ? ` ${status.error.code}` : ''} in ${Math.round((Date.now() - t0) / 1000)} s; books +${spent} USD, +${(after?.requests ?? 0) - (before?.requests ?? 0)} requests`)
    const record = { name, url, withToken, jobId: id, status: status.status, error: status.error ? { code: status.error.code, message: String(status.error.message ?? '').slice(0, 400) } : null, seconds: Math.round((Date.now() - t0) / 1000), booksDeltaUsd: spent, booksDeltaRequests: (after?.requests ?? 0) - (before?.requests ?? 0) }
    if (status.status === 'COMPLETED') {
      const result = await call(`/v1/analyses/${id}/result`)
      const scene = await call(`/v1/analyses/${id}/scene`)
      const model = await call(`/v1/analyses/${id}/model`)
      writeFileSync(join(dir, 'result.json'), `${scrub(JSON.stringify(result.json, null, 1))}\n`)
      writeFileSync(join(dir, 'model.json'), model.buf)
      writeFileSync(join(dir, 'scene.json'), scene.buf)
      const r = result.json
      check(result.status === 200 && scene.status === 200 && model.status === 200, `${name}: result, scene and model are served`)
      check(sha256(scene.buf) === r.sceneSha256 && scene.headers.get('x-content-sha256') === r.sceneSha256, `${name}: the scene's bytes are the summary's sceneSha256 and the response header's`)
      check(sha256(model.buf) === r.modelSha256, `${name}: the model's bytes are the summary's modelSha256`)
      // the scene read back as a client reads it: its own content hash names the same bundle
      const bundle = JSON.parse(scene.buf.toString('utf8'))
      check(bundle.contentHash === r.sceneContentHash && Array.isArray(bundle.scene?.meshes) && bundle.scene.meshes.length > 0, `${name}: the scene reloads (${bundle.scene?.meshes?.length ?? 0} meshes) with the summary's content hash`)
      if (withToken) {
        check(r.consultation?.globalDescription === 'DISABLED', `${name}: the result came through the consultant's path; the global description is DISABLED`)
        check(r.vision?.attempted !== true, `${name}: no vision reasoner or house reader was attempted (vision ${JSON.stringify(r.vision ?? {})})`)
        check(r.sourceCheck !== undefined, `${name}: the consumed result carries the source check (${r.sourceCheck?.status}, ${r.sourceCheck?.knownDefects?.length ?? 0} known defects)`)
        const dormers = (JSON.parse(model.buf.toString('utf8')).assemblies ?? []).filter((a) => a.kind === 'DORMER' || a.type === 'DORMER').map((a) => a.id)
        check(r.consultation?.metricRead !== undefined, `${name}: the metric consultant ran (${r.consultation?.metricRead?.decision}: ${r.consultation?.metricRead?.corrected} corrected, ${r.consultation?.metricRead?.agrees} agree)`)
        check(r.consultation?.sketches !== undefined, `${name}: the sketch step ran (${(r.consultation?.sketches?.sides ?? []).join(' ')}; form ${r.consultation?.sketches?.form}, finish ${r.consultation?.sketches?.finish})`)
        check(r.consultation?.accepted !== undefined, `${name}: the accepted-revision rule was applied (${r.consultation?.accepted?.state})`)
        // v3.54.16 — integration: the shared executor ran, kept a patch and delivered it; a look judged that revision
        const runsC = r.sourceCheck?.correctionRuns ?? []
        const committedC = runsC.flatMap((x) => (x.records ?? []).filter((y) => y.status === 'COMMITTED').map((y) => ({ stage: x.stage, ...y })))
        const delivered = runsC.some((x) => x.delivered && (x.records ?? []).some((y) => y.status === 'COMMITTED'))
        check(r.consultation?.corrections?.registry === '1.0.0', `${name}: the result names the correction registry (${r.consultation?.corrections?.registry})`)
        check(committedC.length > 0 && delivered, `${name}: at least one patch was COMMITTED by the shared executor and delivered (${committedC.map((c) => `${c.stage}:${c.operation} ${c.targetId}`).join(', ') || 'none'})`)
        check(r.sourceCheck?.quality?.reviewCompleted === true && r.sourceCheck?.checkedRevision === r.sourceCheck?.deliveredRevision, `${name}: a look judged the delivered revision that carries the patches (checked ${r.sourceCheck?.checkedRevision}, delivered ${r.sourceCheck?.deliveredRevision})`)
        // quality, apart: a state of its own, with its defects
        check(['SOURCE_VERIFIED_IN_SCOPE', 'RECOGNIZABLE_PARTIAL', 'NEEDS_EVIDENCE', 'UNSUPPORTED_OPERATION', 'NO_IMPROVEMENT', 'BUDGET_OR_ROUND_LIMIT', 'NOT_REVIEWED'].includes(r.sourceCheck?.quality?.state), `${name}: the result carries a quality state of its own (${r.sourceCheck?.quality?.state}: ${r.sourceCheck?.quality?.why ?? ''})`)
        Object.assign(record, { consultation: r.consultation, sourceCheck: { status: r.sourceCheck?.status, checkedRevision: r.sourceCheck?.checkedRevision, deliveredRevision: r.sourceCheck?.deliveredRevision, corrections: r.sourceCheck?.corrections, knownDefects: r.sourceCheck?.knownDefects, quality: r.sourceCheck?.quality }, committed: committedC.map((c) => ({ stage: c.stage, proposalId: c.proposalId, operation: c.operation, targetId: c.targetId, origin: c.origin, ids: c.bound?.ids ?? [], measure: c.measure ?? null, gate: c.gate ?? null })), dormersInModel: dormers })
      } else {
        check(r.consultation === undefined && r.sourceCheck === undefined, `${name}: without the token the job ran on the drawings' path alone (no consultation in the result)`)
        check(spent === 0 && record.booksDeltaRequests === 0, `${name}: without the token no request was booked`)
      }
      Object.assign(record, { modelHash: r.modelHash, modelSha256: r.modelSha256, sceneSha256: r.sceneSha256, sceneContentHash: r.sceneContentHash, analyzer: r.analyzer, sourcePackageHash: r.sourcePackageHash, measurement: r.measurement ?? null })
    } else if (withToken) {
      const res = await call(`/v1/analyses/${id}/result`)
      check(res.status === 410 || res.status === 409, `${name}: a job that did not complete serves no result (${res.status})`)
    }
    writeFileSync(join(dir, 'record.json'), `${scrub(JSON.stringify(record, null, 1))}\n`)
  }

  let n = 0
  for (const url of urls) await runOne(url, `job-${(n += 1)}`, true)
  if (argv.includes('--repeat') && urls[0]) {
    const first = JSON.parse(readFileSync(join(out, 'job-1', 'record.json'), 'utf8'))
    await runOne(urls[0], 'job-1-repeat', true)
    const again = JSON.parse(readFileSync(join(out, 'job-1-repeat', 'record.json'), 'utf8'))
    check(first.consultation?.accepted?.state === 'ACCEPTED_NOW', `the first run's consultation was accepted (${first.consultation?.accepted?.state}${first.consultation?.accepted?.why ? `: ${first.consultation.accepted.why}` : ''})`)
    check(again.consultation?.accepted?.state === 'REUSED' && again.consultation?.accepted?.sameGeometry === true && again.consultation?.accepted?.missing === 0, `the second run of the same URL reused the accepted revision (${again.consultation?.accepted?.state}, ${again.consultation?.accepted?.answersReplayed} answers replayed, ${again.consultation?.accepted?.missing} missing, same geometry ${again.consultation?.accepted?.sameGeometry})`)
    check(again.booksDeltaUsd === 0 && again.booksDeltaRequests === 0, `the second run booked nothing (${again.booksDeltaUsd} USD, ${again.booksDeltaRequests} requests)`)
    check(again.modelSha256 === first.modelSha256 && again.sceneSha256 === first.sceneSha256, `the second run served the same model and scene bytes`)
    check(again.sourceCheck?.quality?.state === first.sourceCheck?.quality?.state && JSON.stringify((again.sourceCheck?.quality?.defects ?? []).map((d) => [d.id, d.settlement])) === JSON.stringify((first.sourceCheck?.quality?.defects ?? []).map((d) => [d.id, d.settlement])), `the reuse kept the quality state and its defect list (${again.sourceCheck?.quality?.state}; ${(again.sourceCheck?.quality?.defects ?? []).length} defects): reuse did not improve the label`)
  }
  if (value('default')) await runOne(value('default'), 'job-default-no-token', false)
  const journal = join(dataDir, 'house-reader-spend.journal.jsonl')
  if (existsSync(journal)) {
    const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    // the OPENED line is the books' own first line and has no purpose: only requests are counted
    const purposes = [...new Set(lines.filter((l) => l.event !== 'OPENED').map((l) => l.purpose))]
    check(purposes.every((p) => p === 'CONSULTATION'), `the host's books hold CONSULTATION requests only (${purposes.join(', ') || 'none'}): the house reader was never asked`)
    writeFileSync(join(out, 'host-books-journal.jsonl'), `${lines.map((l) => scrub(JSON.stringify(l))).join('\n')}\n`)
    writeFileSync(join(out, 'host-books.json'), `${JSON.stringify(booksOf(), null, 1)}\n`)
  }
} finally {
  child.kill('SIGTERM')
  writeFileSync(join(out, 'server.log'), serverLog.join(''))
  writeFileSync(join(out, 'commit.txt'), `${value('commit') ?? 'unknown'}\n`)
  log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILED: ${failures.length} check(s)`)
}
process.exit(failures.length === 0 ? 0 : 1)
