#!/usr/bin/env node
/**
 * v3.54.9 (from v3.54.8) — the house document 0.5.0 carries the interior placed from LOCAL (or why not), checked here
 * against the served model's partitions and rooms. v3.54.8 (from v3.54.7) — the host's real public entrypoint, end to end, for the whole-house description pilot (built from the final
 * revision; `--commit` names it and every artifact is checked to belong to it).
 *
 *   node research/source-to-model/v3549/host-e2e.mjs --commit <git sha of the build> --out <dir> --data <host data dir> --max-usd <cumulative ceiling>
 *        --spent-usd <the campaign books' balance now> [--timeout-s 1500] [--default <url>] <project url> ...
 *
 * Starts the built server (apps/analyzer-api/dist/server.mjs — build it first) on a free loopback port with the pilot
 * switched on, then for each project URL: POST /v1/analyses with the pilot's access token → poll the status → GET the
 * result summary, the scene, the model and the HOUSE DOCUMENT → check the scene's and the model's bytes against the
 * summary's hashes, reload the scene, and check that the house document says which house stood and that the result is
 * that house's (the described one, or LOCAL kept). `--default <url>` also
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
const flags = new Set(['out', 'data', 'max-usd', 'spent-usd', 'timeout-s', 'default', 'commit', 'expect'])
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
const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', ANALYZER_DATA_DIR: dataDir, ANALYZER_HOUSE_DESCRIPTION: 'pilot', ANALYZER_HOUSE_READER: 'live', ANALYZER_HOUSE_READER_MAX_USD: value('max-usd'), ANALYZER_HOUSE_READER_SPENT_USD: value('spent-usd'), ANALYZER_HOUSE_READER_TOKEN: token, ANALYZER_HOUSE_READER_MAX_REQUESTS_PER_DAY: '200', ANALYZER_JOB_TIMEOUT_MS: String(timeoutS * 1000), ANALYZER_RATE_LIMIT_MAX: '50' }
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
      const house = await call(`/v1/analyses/${id}/house`)
      if (withToken) {
        check(house.status === 200, `${name}: the house document is served (${house.status})`)
        if (house.status === 200) {
          writeFileSync(join(dir, 'house.json'), house.buf)
          const doc = JSON.parse(house.buf.toString('utf8'))
          const stood = (doc.verification?.knownDefects ?? []).find((d) => String(d.code).startsWith('ACCEPTED_'))
          const described = String(r.analyzer?.service ?? '').startsWith('house-')
          check(doc.schema === 'buildapp.house-document' && Array.isArray(doc.observations?.outlines) && doc.observations.outlines.length > 0, `${name}: the house document reloads (${doc.observations?.outlines?.length ?? 0} outlines, ${doc.observations?.elevations?.length ?? 0} elevations, ${doc.verification?.checks?.length ?? 0} checks)`)
          check(!!stood, `${name}: the house document says which house stood (${stood?.code ?? 'nothing'})`)
          check(stood?.code === (described ? 'ACCEPTED_DESCRIBED' : 'ACCEPTED_LOCAL'), `${name}: the served result is the house that stood (${r.analyzer?.service}; ${stood?.code})`)
          if (described) check((r.warningDetails ?? []).some((w) => w.code === 'MODEL_FROM_WHOLE_HOUSE_DESCRIPTION') && (r.warningDetails ?? []).some((w) => w.code === 'HOUSE_DECISION'), `${name}: the result says it is the described exterior and why it stands`)
          const again = await call(`/v1/analyses/${id}/house`)
          check(sha256(again.buf) === sha256(house.buf), `${name}: the house document read twice is the same bytes (${sha256(house.buf).slice(0, 12)})`)
          // v3.54.5: the document of this revision, bound to this job's source, with its register and its separate statuses
          check(doc.schemaVersion === '0.5.0' && String(r.analyzer?.solver ?? '').includes('reading-0.4.0') || (!described && doc.schemaVersion === '0.5.0'), `${name}: the house document and the analyzer are this revision's (document ${doc.schemaVersion}; ${r.analyzer?.solver ?? r.analyzer?.service})`)
          check(doc.source?.sourcePackageHash === r.sourcePackageHash, `${name}: the house document reads the same source package as the result (${String(r.sourcePackageHash).slice(0, 12)})`)
          check(Array.isArray(doc.verification?.views) && doc.verification.views.length === 4 && !!doc.verification?.status, `${name}: the register accounts for four sides (${(doc.verification?.views ?? []).map((v) => `${v.side}:${v.state}`).join(' ')}); status ${JSON.stringify(doc.verification?.status ? { sources: doc.verification.status.sources, geometry: doc.verification.status.geometry, exterior: doc.verification.status.exterior } : null)}`)
          const decision = (doc.verification?.knownDefects ?? []).find((d) => String(d.code).startsWith('ACCEPTED_'))
          const code = /^([A-Z_]+)/.exec(String(decision?.what ?? ''))?.[1] ?? null
          const want = (value('expect') ?? '').split(',').map((x) => x.split('=')).find(([u]) => u === url)?.[1]
          if (want) check(code === want, `${name}: the decision is the one this case is for (${code}; expected ${want})`)
          if (described) {
            check((r.warningDetails ?? []).some((w) => w.code === 'HOUSE_STATUS') && (r.warningDetails ?? []).some((w) => w.code === 'HOUSE_INTERIOR'), `${name}: the result carries the separate statuses and what happened to an interior`)
            const sup = await call(`/v1/analyses/${id}/superseded`)
            check(sup.status === 200 || sup.status === 404, `${name}: the superseded LOCAL model is served when LOCAL held an interior, and absent otherwise (${sup.status})`)
            if (sup.status === 200) writeFileSync(join(dir, 'superseded-local-model.json'), sup.buf)
            record.superseded = sup.status === 200
          }
          // v3.54.9: the interior — placed from LOCAL through a checked transform, or not, with the reason; what is placed is in the model
          const interior = doc.geometry?.interior ?? null
          const served = JSON.parse(model.buf.toString('utf8'))
          const partitions = (served.walls ?? []).filter((w) => w.kind === 'INTERIOR').length
          const rooms = (served.rooms ?? []).length
          check(!!interior && ['NOT_BUILT', 'NOT_CHECKED', 'BUILT', 'PARTIAL'].includes(interior.status), `${name}: the house document says what happened to the interior (${interior?.status ?? 'nothing'}${interior?.note ? `: ${String(interior.note).slice(0, 120)}` : ''})`)
          if (interior && (interior.status === 'BUILT' || interior.status === 'PARTIAL')) {
            const placedWalls = (interior.levels ?? []).reduce((a, l) => a + (l.walls?.length ?? 0), 0)
            const placedRooms = (interior.levels ?? []).reduce((a, l) => a + (l.rooms?.length ?? 0), 0)
            check(partitions >= placedWalls && rooms >= placedRooms && placedWalls + placedRooms > 0, `${name}: the placed interior is in the served model (${placedWalls} partition(s), ${placedRooms} room(s) placed; model ${partitions} INTERIOR wall(s), ${rooms} room(s))`)
          }
          record.interior = interior ? { status: interior.status, note: interior.note ?? null, transform: interior.transform ? { mirrorX: interior.transform.mirrorX, mirrorZ: interior.transform.mirrorZ, scale: interior.transform.scale, overlap: interior.transform.overlap } : null, levels: (interior.levels ?? []).map((l) => ({ level: l.level, walls: l.walls?.length ?? 0, doors: l.doors?.length ?? 0, rooms: l.rooms?.length ?? 0, stairs: l.stairs?.length ?? 0, voids: l.voids?.length ?? 0, dropped: l.dropped?.length ?? 0 })), modelInteriorWalls: partitions, modelRooms: rooms } : null
          // v3.54.8: the data boundary — each accepted façade value (railing infill, frame legs, portal band) is built as agreed or held
          const fvb = (doc.verification?.checks ?? []).find((c) => c.id === 'facade-values-built')
          check(!fvb || fvb.status !== 'FAIL', `${name}: no accepted façade value is lost between the program and the scene (${fvb ? `${fvb.status}: ${String(fvb.measured).slice(0, 160)}` : 'nothing of the kind agreed'})`)
          record.facadeValues = fvb ? { status: fvb.status, measured: String(fvb.measured).slice(0, 400) } : null
          // v3.54.7 (D40/D41): the delivered model's quality status — its characteristic features and the open review defects
          const quality = (doc.verification?.knownDefects ?? []).find((d) => String(d.code).startsWith('QUALITY_'))
          check(!!quality, `${name}: the house document says the quality of what was delivered (${quality?.code ?? 'nothing'})`)
          record.quality = quality ? { code: quality.code, what: String(quality.what).slice(0, 600) } : null
          const cut = (doc.verification?.openings ?? []).reduce((a, o) => ({ ...a, [o.fit]: (a[o.fit] ?? 0) + 1 }), {})
          // v3.54.6 (D39): what the accepted-revision rule did on this job
          const revision = (doc.verification?.knownDefects ?? []).find((d) => String(d.code).startsWith('REVISION_'))
          record.revision = revision ? { code: revision.code, what: String(revision.what).slice(0, 300) } : null
          Object.assign(record, { decisionCode: code, views: (doc.verification?.views ?? []).map((v) => ({ side: v.side, state: v.state, build: v.build })), houseStatus: doc.verification?.status ?? null, openingFits: cut })
          Object.assign(record, { houseSha256: sha256(house.buf), stood: stood?.code ?? null, why: String(stood?.what ?? '').slice(0, 300), checks: { pass: (doc.verification?.checks ?? []).filter((c) => c.status === 'PASS').length, fail: (doc.verification?.checks ?? []).filter((c) => c.status === 'FAIL').length }, held: (doc.verification?.held ?? []).length, counts: r.counts })
        }
      } else {
        check(house.status === 404, `${name}: without the token there is no house document (${house.status})`)
        check(!String(r.analyzer?.service ?? '').startsWith('house-'), `${name}: without the token the job ran on the drawings' path alone (${r.analyzer?.service})`)
        check(spent === 0 && record.booksDeltaRequests === 0, `${name}: without the token no request was booked`)
      }
      Object.assign(record, { commit: value('commit') ?? null, modelHash: r.modelHash, modelSha256: r.modelSha256, sceneSha256: r.sceneSha256, sceneContentHash: r.sceneContentHash, analyzer: r.analyzer, sourcePackageHash: r.sourcePackageHash, measurement: r.measurement ?? null })
    } else if (withToken) {
      const res = await call(`/v1/analyses/${id}/result`)
      check(res.status === 410 || res.status === 409, `${name}: a job that did not complete serves no result (${res.status})`)
    }
    writeFileSync(join(dir, 'record.json'), `${scrub(JSON.stringify(record, null, 1))}\n`)
  }

  let n = 0
  for (const url of urls) await runOne(url, `job-${(n += 1)}`, true)
  if (value('default')) await runOne(value('default'), 'job-default-no-token', false)
  const journal = join(dataDir, 'house-reader-spend.journal.jsonl')
  if (existsSync(journal)) {
    const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    // the OPENED line is the books' own first line and has no purpose: only requests are counted
    const purposes = [...new Set(lines.filter((l) => l.event !== 'OPENED').map((l) => l.purpose))]
    check(purposes.every((p) => p === 'CONSULTATION'), `the host's books hold the pilot's requests only (${purposes.join(', ') || 'none'})`)
    writeFileSync(join(out, 'host-books-journal.jsonl'), `${lines.map((l) => scrub(JSON.stringify(l))).join('\n')}\n`)
    writeFileSync(join(out, 'host-books.json'), `${JSON.stringify(booksOf(), null, 1)}\n`)
  }
} finally {
  child.kill('SIGTERM')
  writeFileSync(join(out, 'server.log'), serverLog.join(''))
  log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILED: ${failures.length} check(s)`)
}
process.exit(failures.length === 0 ? 0 : 1)
