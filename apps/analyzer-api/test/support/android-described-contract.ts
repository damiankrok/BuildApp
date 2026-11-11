/**
 * v3.53.2 — what the Android client's fixtures for the DESCRIBED path are made of: the REAL responses of this API,
 * captured over HTTP, for a page the drawings' path refuses, with the pilot's token, without it, with a wrong one,
 * and cancelled while the house is being read. Only what is not deterministic is normalised (job ids, the clock).
 *
 * The house reader is a stand-in that answers with the hand-written synthetic description of the reconstruction
 * tests: no provider is reached and nothing is paid for. These fixtures therefore pin the CONTRACT a phone parses —
 * the token, the `describing` member, the hashes, the refusals — not what a live reader would say about any house.
 *
 * `scripts/capture-android-described-contract.ts` writes them into the Android test resources;
 * `test/android-described-contract.test.ts` regenerates them and fails when the committed copies no longer match.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { genericProjectPageAdapter } from '@buildapp/source-package'
import type { StructuredVision } from '@buildapp/source-vision'
import type { SyntheticPublisher } from '@buildapp/synthetic-drawings'
import { PAGE, unknownPublisher } from '../../../../packages/analysis-service/test/support/unknown-publisher.js'
import { InProcessExecutor } from '../../src/executor.js'
import type { JobRecord } from '../../src/job.js'
import { statusBodyOf } from '../../src/http.js'
import { FileJobStore } from '../../src/store.js'
import { call, pollJob, startApi } from './harness.js'

export const DESCRIBED_CONTRACT_DIR = resolve(import.meta.dirname, '../../../android/app/src/test/resources/analyzer-described')
/** The token of these fixtures: a placeholder that exists nowhere else. The phone's tests send exactly this. */
export const DESCRIBED_PILOT_TOKEN = 'fixture-pilot-token-0123456789abcdef'
const IDS = { described: 'd'.repeat(32), anonymous: 'a'.repeat(32), cancelled: 'c'.repeat(32) }
const TIME = '2026-01-01T00:00:00.000Z'
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g

const description = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../packages/reconstruction/test/fixtures/described-house-a.json'), 'utf8')) as unknown

/** A reader that answers at once, or — `held` — waits on its description until the job is cancelled. */
function standIn(held = false): StructuredVision {
  return {
    provider: { id: 'house-reader.stand-in', model: 'stand-in-description', triageModel: 'stand-in-sorting', version: 'fixture' },
    available: () => true,
    ask: async (request) => {
      if (request.purpose === 'HOUSE_TRIAGE') return { output: { pictures: request.pictures.map((p) => ({ picture: p.number, kind: 'EXTERIOR_VIEW', duplicateOf: 0 })) }, usage: { latencyMs: 0, model: 'stand-in-sorting' } }
      if (held) await new Promise<never>((_, reject) => request.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }))
      return { output: description, usage: { latencyMs: 0, model: 'stand-in-description' } }
    },
  }
}

/** A store that keeps the first record written in each phase of the reading: real mid-run statuses. */
class Watching extends FileJobStore {
  readonly phases = new Map<string, JobRecord>()
  override async update(jobId: string, change: (job: JobRecord) => JobRecord): Promise<JobRecord | null> {
    const next = await super.update(jobId, change)
    const phase = next?.describing?.phase
    if (next && phase && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(next.status) && !this.phases.has(phase)) this.phases.set(phase, next)
    return next
  }
}

const tidy = (record: unknown): unknown => {
  // a running record's activity is whichever heartbeat was last written: not part of what these fixtures pin
  const { activity: _activity, ...rest } = record as Record<string, unknown>
  return rest
}

export async function captureDescribedContract(): Promise<Record<string, string | Uint8Array>> {
  const out: Record<string, string | Uint8Array> = {}
  const site = unknownPublisher({ drawings: false })
  const start = (reader: StructuredVision, watching?: (dir: string) => FileJobStore) =>
    startApi({ adapter: genericProjectPageAdapter, deps: site.deps } as unknown as SyntheticPublisher, { houseReaderToken: DESCRIBED_PILOT_TOKEN }, { executor: new InProcessExecutor(() => ({ adapters: [genericProjectPageAdapter], deps: site.deps, houseReader: reader })), ...(watching ? { store: watching } : {}) })
  const pilot = { authorization: `Bearer ${DESCRIBED_PILOT_TOKEN}` }
  const normaliser = (map: Record<string, string>) => (text: string): string => {
    let t = text
    for (const [from, to] of Object.entries(map)) t = t.replaceAll(from, to)
    return `${JSON.stringify(JSON.parse(t.replace(ISO, TIME)), null, 2)}\n`
  }

  // --- with the token: the job that is described --------------------------------------------------------------------
  let watching: Watching | null = null
  const api = await start(standIn(), (dir) => (watching = new Watching(dir)))
  try {
    const submitted = await call(api, 'POST', '/v1/analyses', { url: PAGE }, pilot)
    const jobId = submitted.json.jobId as string
    const n = normaliser({ [jobId]: IDS.described })
    const final = (await pollJob(api, jobId)).pop() as Record<string, unknown>
    if (final.status !== 'COMPLETED') throw new Error(`the described job did not complete: ${JSON.stringify(final.error)}`)
    const result = await call(api, 'GET', `/v1/analyses/${jobId}/result`)
    const scene = await fetch(`${api.base}/v1/analyses/${jobId}/scene`)
    const sceneText = Buffer.from(await scene.arrayBuffer()).toString('utf8')
    const seen = (watching as Watching | null)?.phases ?? new Map<string, JobRecord>()
    for (const [phase, file] of [['SORTING_PICTURES', 'status-sorting.json'], ['DESCRIBING_HOUSE', 'status-describing.json'], ['BUILDING_MODEL', 'status-building.json']] as const) {
      const record = seen.get(phase)
      if (!record) throw new Error(`no status was captured in phase ${phase}`)
      out[file] = n(JSON.stringify(tidy(statusBodyOf(record))))
    }
    out['submitted.json'] = n(submitted.text)
    out['status-completed.json'] = n(JSON.stringify(final))
    out['result.json'] = n(result.text)
    out['scene.json'] = sceneText
    // one original, exactly as the page serves it (a synthetic sheet of this repository's own generator): what the
    // phone must download and find to have the hash the status names
    const first = (final.describing as { pictures: Array<{ number: number; original: { url: string; sha256: string } }> }).pictures[0]
    const original = await site.deps.fetchImpl?.(first.original.url)
    if (!original || !original.ok) throw new Error('the first described picture could not be fetched from the fixture site')
    out['picture-original.bin'] = new Uint8Array(await original.arrayBuffer())

    // --- a wrong token: refused, nothing started ---------------------------------------------------------------------
    const wrong = await call(api, 'POST', '/v1/analyses', { url: PAGE }, { authorization: 'Bearer not-the-token-of-this-host-0000' })
    out['refusal-wrong-token.json'] = n(wrong.text)

    // --- no token: the drawings' path alone, which refuses this page -------------------------------------------------
    const anonymous = await call(api, 'POST', '/v1/analyses', { url: PAGE })
    const anonymousFinal = (await pollJob(api, anonymous.json.jobId as string)).pop()
    out['status-failed-without-token.json'] = normaliser({ [anonymous.json.jobId as string]: IDS.anonymous })(JSON.stringify(anonymousFinal))
    out['meta.json'] = `${JSON.stringify({ jobId: IDS.described, page: PAGE, pilotToken: DESCRIBED_PILOT_TOKEN, sceneSha256Header: scene.headers.get('x-content-sha256'), wrongTokenStatus: wrong.status, firstPicture: { number: first.number, url: first.original.url, sha256: first.original.sha256 } }, null, 2)}\n`
  } finally {
    await api.close()
  }

  // --- cancelled while the house is being read ------------------------------------------------------------------------
  const holding = await start(standIn(true))
  try {
    const submitted = await call(holding, 'POST', '/v1/analyses', { url: PAGE }, pilot)
    const jobId = submitted.json.jobId as string
    const n = normaliser({ [jobId]: IDS.cancelled })
    const reading = (await pollJob(holding, jobId, (job) => job.describing?.phase === 'DESCRIBING_HOUSE')).pop()
    if (reading?.describing?.phase !== 'DESCRIBING_HOUSE') throw new Error('the job to cancel never reached the reading phase')
    const cancel = await call(holding, 'DELETE', `/v1/analyses/${jobId}`)
    const cancelled = (await pollJob(holding, jobId)).pop()
    out['cancel-response.json'] = n(cancel.text)
    out['status-cancelled.json'] = n(JSON.stringify(cancelled))
  } finally {
    await holding.close()
  }
  return out
}
