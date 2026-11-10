/**
 * v3.53: the described path through the service a phone talks to — the production server, runner, store and executor
 * over a real socket; only the wiring differs (an unknown publisher on an in-memory internet, and a house reader that
 * answers with a recorded synthetic description instead of a paid provider).
 *
 * What this proves: a page the drawings' path refuses is a COMPLETED job in the same contract, with a scene the viewer
 * loads, that says in its warnings what it was built from. What it does not prove: a live provider's answer (no key
 * exists in these checks) or anything on a device.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { genericProjectPageAdapter } from '@buildapp/source-package'
import { loadBundle } from '@buildapp/mobile-scene'
import type { StructuredVision } from '@buildapp/source-vision'
import type { SyntheticPublisher } from '@buildapp/synthetic-drawings'
import { ANALYSIS_STAGES } from '@buildapp/analysis-service'
import { HOST, PAGE, unknownPublisher } from '../../../packages/analysis-service/test/support/unknown-publisher.js'
import { InProcessExecutor } from '../src/executor.js'
import { cappedStructuredVision, readHouseReaderUsage } from '../src/house-reader-budget.js'
import { call, pollJob, startApi } from './support/harness.js'
import type { Api, Json } from './support/harness.js'
import { dictionaryViolations } from './support/contract-shape.js'

const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')
const description = JSON.parse(readFileSync(new URL('../../../packages/reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>

const SECRET = 'sk-ant-test-0123456789-not-a-real-key'

function reader(answer: unknown): StructuredVision & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    provider: { id: 'house-reader.test', model: 'none', triageModel: 'none', version: 'test' },
    available: () => true,
    ask: async (request) => {
      asked.push(request.purpose)
      return { output: request.purpose === 'HOUSE_TRIAGE' ? { pictures: request.pictures.map((p) => ({ picture: p.number, kind: 'EXTERIOR_VIEW', duplicateOf: 0 })) } : answer, usage: { latencyMs: 0, model: 'none' } }
    },
  }
}

async function apiWith(houseReader: StructuredVision | undefined): Promise<Api> {
  const site = unknownPublisher({ drawings: false })
  const wiring = () => ({ adapters: [genericProjectPageAdapter], deps: site.deps, ...(houseReader ? { houseReader } : {}) })
  return startApi({ adapter: genericProjectPageAdapter, deps: site.deps } as unknown as SyntheticPublisher, {}, { executor: new InProcessExecutor(wiring) })
}

describe('a page with pictures and no drawings, through the service', () => {
  let previousKey: string | undefined
  const bodies: string[] = []
  beforeAll(() => {
    previousKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = SECRET
  })
  afterAll(() => {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = previousKey
  })

  it('without a house reader on the host the job fails with the drawings path\'s own refusal', async () => {
    const api = await apiWith(undefined)
    try {
      const r = await call(api, 'POST', '/v1/analyses', { url: PAGE })
      expect(r.status).toBe(202)
      const polls = await pollJob(api, r.json.jobId)
      const final = polls[polls.length - 1]
      expect(final.status).toBe('FAILED')
      expect(final.error.code).toBe('NO_DRAWINGS')
    } finally {
      await api.close()
    }
  })

  it('with a house reader the job completes with a model that says what it was built from', async () => {
    const r0 = reader(description)
    const api = await apiWith(r0)
    try {
      const r = await call(api, 'POST', '/v1/analyses', { url: PAGE })
      expect(r.status).toBe(202)
      const jobId = r.json.jobId as string
      const polls = await pollJob(api, jobId)
      bodies.push(...polls.map((p) => JSON.stringify(p)))
      const final = polls[polls.length - 1]
      expect(final.status).toBe('COMPLETED')
      expect(final.error).toBeNull()
      expect(final.progress).toBe(1)
      // the second path never takes the phone's progress back, and no stage is left running or failed
      for (let i = 1; i < polls.length; i++) expect(polls[i].progress).toBeGreaterThanOrEqual(polls[i - 1].progress)
      expect(final.stages.map((s: Json) => s.id)).toEqual([...ANALYSIS_STAGES])
      expect(final.stages.filter((s: Json) => s.state === 'FAILED' || s.state === 'RUNNING')).toEqual([])
      expect(r0.asked[0]).toBe('HOUSE_TRIAGE')
      expect(r0.asked[r0.asked.length - 1]).toBe('HOUSE_DESCRIPTION')

      const result = await call(api, 'GET', `/v1/analyses/${jobId}/result`)
      bodies.push(result.text)
      expect(result.status).toBe(200)
      const codes = (result.json.warningDetails as Json[]).map((w) => w.code)
      expect(codes).toContain('MODEL_FROM_SOURCE_DESCRIPTION')
      expect((result.json.warningDetails as Json[]).find((w) => w.code === 'MODEL_FROM_SOURCE_DESCRIPTION')?.severity).toBe('LIMITING')
      expect((result.json.preview.provisional as Json[]).map((p) => p.code)).toEqual(expect.arrayContaining(['SCALE_NOT_VERIFIED', 'HEIGHT_ASSUMED_FOR_PREVIEW']))
      expect(result.json.label).toContain('model z opisu źródeł')
      expect(result.json.counts.masses).toBe(2)
      expect(dictionaryViolations(result.json)).toEqual([])

      // the scene is the bytes the result names, and the viewer's own loader takes it
      const scene = await fetch(`${api.base}/v1/analyses/${jobId}/scene`)
      const sceneText = await scene.text()
      expect(sha256(sceneText)).toBe(result.json.sceneSha256)
      const loaded = loadBundle(sceneText)
      expect(loaded.ok && loaded.bundle.contentHash).toBe(result.json.sceneContentHash)
      const model = await fetch(`${api.base}/v1/analyses/${jobId}/model`)
      expect(sha256(await model.text())).toBe(result.json.modelSha256)
    } finally {
      await api.close()
    }
  })

  it('a description that cannot be built is the drawings path\'s refusal, never a half-made model', async () => {
    const api = await apiWith(reader({ ...description, bodies: [] }))
    try {
      const r = await call(api, 'POST', '/v1/analyses', { url: PAGE })
      const polls = await pollJob(api, r.json.jobId)
      const final = polls[polls.length - 1]
      bodies.push(JSON.stringify(final))
      expect(final.status).toBe('FAILED')
      expect(final.error.code).toBe('NO_DRAWINGS')
      expect((await call(api, 'GET', `/v1/analyses/${r.json.jobId}/scene`)).status).not.toBe(200)
    } finally {
      await api.close()
    }
  })

  it('the host\'s daily ceiling: the description past it is not asked for, and the job keeps the drawings path\'s answer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'house-reader-usage-'))
    const file = join(dir, 'usage.json')
    let today = new Date('2026-03-01T10:00:00Z')
    const inner = reader(description)
    const api = await apiWith(cappedStructuredVision(inner, { file, maxDescriptionsPerDay: 1, now: () => today }))
    try {
      const status = async (): Promise<Json> => {
        const r = await call(api, 'POST', '/v1/analyses', { url: PAGE })
        const polls = await pollJob(api, r.json.jobId)
        return polls[polls.length - 1]
      }
      expect((await status()).status).toBe('COMPLETED')
      expect(readHouseReaderUsage(file, today)).toEqual({ day: '2026-03-01', descriptions: 1 })
      const asked = inner.asked.length
      const second = await status()
      expect(second.status).toBe('FAILED')
      expect(second.error.code).toBe('NO_DRAWINGS')
      // nothing at all was asked of the provider for the second job: not the description, not the sorting before it
      expect(inner.asked.length).toBe(asked)
      // the next day starts at zero
      today = new Date('2026-03-02T00:00:01Z')
      expect((await status()).status).toBe('COMPLETED')
      expect(readHouseReaderUsage(file, today)).toEqual({ day: '2026-03-02', descriptions: 1 })
    } finally {
      await api.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no body this suite received names the key, a server path or the publisher\'s host beyond the job\'s own URL', () => {
    const all = bodies.join('\n')
    expect(all).not.toContain(SECRET)
    expect(all).not.toMatch(/\/tmp\/|\/home\//)
    expect(all.split(HOST).length - 1).toBeLessThanOrEqual(bodies.length * 6)
  })
})
