/**
 * What the Android client's contract fixtures are made of: the REAL responses
 * of this API for one synthetic job, captured over HTTP and normalised only
 * where a response is not deterministic (the random job id, the clock).
 *
 * `scripts/capture-android-contract.ts` writes them into the Android test
 * resources; `test/android-contract.test.ts` regenerates them and fails if the
 * committed copies no longer match what the server says. The phone's parser
 * is therefore tested against the server, not against a transcription of it.
 */
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { JobRecord } from '../../src/job.js'
import { statusBodyOf } from '../../src/http.js'
import { FileJobStore } from '../../src/store.js'
import { call, pollJob, startApi } from './harness.js'

export const CONTRACT_JOB_ID = '0123456789abcdef0123456789abcdef'
export const CONTRACT_TIME = '2026-01-01T00:00:00.000Z'
export const CONTRACT_PROJECT = 'https://drawings.synthetic-publisher.test/projects/larchfield-lf01'

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g

export type ContractFiles = Record<string, string>

/** A store that keeps the first record written while the job reads its second drawing: a real mid-run status. */
class Watching extends FileJobStore {
  running: JobRecord | null = null
  override async update(jobId: string, change: (job: JobRecord) => JobRecord): Promise<JobRecord | null> {
    const next = await super.update(jobId, change)
    if (!this.running && next?.status === 'EXTRACTING_OBSERVATIONS' && next.stage?.detail?.startsWith('drawing 2 of')) this.running = next
    return next
  }
}

export async function captureAndroidContract(): Promise<ContractFiles> {
  const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
  let watching: Watching | null = null
  const api = await startApi(publisher, {}, { store: (dir) => (watching = new Watching(dir)) })
  try {
    const submitted = await call(api, 'POST', '/v1/analyses', { url: CONTRACT_PROJECT })
    const jobId = submitted.json.jobId as string
    const polled = await pollJob(api, jobId)
    const final = polled[polled.length - 1]
    if (final.status !== 'COMPLETED') throw new Error(`the contract job did not complete: ${JSON.stringify(final.error)}`)
    const result = await call(api, 'GET', `/v1/analyses/${jobId}/result`)
    const scene = await fetch(`${api.base}/v1/analyses/${jobId}/scene`)
    const sceneText = Buffer.from(await scene.arrayBuffer()).toString('utf8')
    const refusal = await call(api, 'POST', '/v1/analyses', { url: 'https://example.com/house' })
    const notFound = await call(api, 'GET', `/v1/analyses/${'f'.repeat(32)}`)
    const mid = (watching as Watching | null)?.running
    if (!mid) throw new Error('no mid-run status was captured')
    const normalise = (text: string): string => `${JSON.stringify(JSON.parse(text.replaceAll(jobId, CONTRACT_JOB_ID).replace(ISO, CONTRACT_TIME)), null, 2)}\n`
    return {
      'submitted.json': normalise(submitted.text),
      'status-running.json': normalise(JSON.stringify(statusBodyOf(mid))),
      'status-completed.json': normalise(JSON.stringify(final)),
      'result.json': normalise(result.text),
      // the scene is served as exact bytes and hashed as such: never re-serialised
      'scene.json': sceneText,
      'refusal-unsupported-publisher.json': normalise(refusal.text),
      'not-found.json': normalise(notFound.text),
      'meta.json': `${JSON.stringify({ jobId: CONTRACT_JOB_ID, project: CONTRACT_PROJECT, sceneSha256Header: scene.headers.get('x-content-sha256'), refusalStatus: refusal.status, notFoundStatus: notFound.status }, null, 2)}\n`,
    }
  } finally {
    await api.close()
  }
}
