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
import { DEFAULT_SPEND_LIMITS, openSpendLedger, spendGuardedStructuredVision } from '../src/house-reader-spend.js'
import { call, pollJob, startApi } from './support/harness.js'
import type { Api, Json } from './support/harness.js'
import { dictionaryViolations } from './support/contract-shape.js'

const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')
const description = JSON.parse(readFileSync(new URL('../../../packages/reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>

const SECRET = 'sk-ant-test-0123456789-not-a-real-key'
const TOKEN = 'pilot-token-for-tests-0123456789abcdef'
const PILOT = { authorization: `Bearer ${TOKEN}` }

function reader(answer: unknown): StructuredVision & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    provider: { id: 'house-reader.test', model: 'm', triageModel: 't', version: 'test', maxOutputTokens: { HOUSE_TRIAGE: 1000, HOUSE_DESCRIPTION: 4000 } },
    available: () => true,
    ask: async (request) => {
      asked.push(request.purpose)
      return { output: request.purpose === 'HOUSE_TRIAGE' ? { pictures: request.pictures.map((p) => ({ picture: p.number, kind: 'EXTERIOR_VIEW', duplicateOf: 0 })) } : answer, usage: { inputTokens: 2000, outputTokens: 800, latencyMs: 0, model: 'none' } }
    },
  }
}

async function apiWith(houseReader: StructuredVision | undefined, token = TOKEN): Promise<Api> {
  const site = unknownPublisher({ drawings: false })
  const wiring = () => ({ adapters: [genericProjectPageAdapter], deps: site.deps, ...(houseReader ? { houseReader } : {}) })
  return startApi({ adapter: genericProjectPageAdapter, deps: site.deps } as unknown as SyntheticPublisher, { houseReaderToken: token }, { executor: new InProcessExecutor(wiring) })
}

const run = async (api: Api, headers: Record<string, string> = {}): Promise<{ jobId: string; polls: Json[]; final: Json }> => {
  const r = await call(api, 'POST', '/v1/analyses', { url: PAGE }, headers)
  expect(r.status).toBe(202)
  const polls = await pollJob(api, r.json.jobId)
  return { jobId: r.json.jobId as string, polls, final: polls[polls.length - 1] }
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
      const { final } = await run(api, PILOT)
      expect(final.status).toBe('FAILED')
      expect(final.error.code).toBe('NO_DRAWINGS')
      expect(final.describing).toBeUndefined()
    } finally {
      await api.close()
    }
  })

  it('a submission without the pilot\'s token never reaches the paid reader, whatever the host has', async () => {
    const r0 = reader(description)
    const api = await apiWith(r0)
    try {
      const { final } = await run(api)
      expect(final.status).toBe('FAILED')
      expect(final.error.code).toBe('NO_DRAWINGS')
      expect(r0.asked).toEqual([])
      // a wrong token is named, not silently served the free path
      const wrong = await call(api, 'POST', '/v1/analyses', { url: PAGE }, { authorization: 'Bearer not-the-token' })
      expect(wrong.status).toBe(401)
      expect(wrong.json.error?.code ?? wrong.json.code).toBe('PILOT_TOKEN_INVALID')
      expect(r0.asked).toEqual([])
    } finally {
      await api.close()
    }
    // and with no token configured on the host nobody is granted it
    const closed = await apiWith(r0, '')
    try {
      expect((await call(closed, 'POST', '/v1/analyses', { url: PAGE }, PILOT)).status).toBe(401)
      expect(r0.asked).toEqual([])
    } finally {
      await closed.close()
    }
  })

  it('with the token the job completes with a model that says what it was built from, and shows what it read', async () => {
    const r0 = reader(description)
    const api = await apiWith(r0)
    try {
      const { jobId, polls, final } = await run(api, PILOT)
      bodies.push(...polls.map((p) => JSON.stringify(p)))
      expect(final.status).toBe('COMPLETED')
      expect(final.error).toBeNull()
      expect(final.progress).toBe(1)
      // neither the progress nor the stage ever moves back when the second path starts, and no stage is left open
      const order = ['QUEUED', ...ANALYSIS_STAGES, 'COMPLETED']
      for (let i = 1; i < polls.length; i++) {
        expect(polls[i].progress).toBeGreaterThanOrEqual(polls[i - 1].progress)
        expect(order.indexOf(polls[i].status)).toBeGreaterThanOrEqual(order.indexOf(polls[i - 1].status))
      }
      expect(final.stages.map((s: Json) => s.id)).toEqual([...ANALYSIS_STAGES])
      expect(final.stages.filter((s: Json) => s.state === 'FAILED' || s.state === 'RUNNING')).toEqual([])
      expect(r0.asked[0]).toBe('HOUSE_TRIAGE')
      expect(r0.asked[r0.asked.length - 1]).toBe('HOUSE_DESCRIPTION')

      // what was being read, on the record: the phase, the reason, and each picture twice — the original the page
      // published and the smaller JPEG that was sent, each with its own hash. No marks on either.
      const d = final.describing
      expect(d.phase).toBe('BUILDING_MODEL')
      expect(d.after.code).toBe('NO_DRAWINGS')
      expect(d.provider).toEqual({ id: 'house-reader.test', model: 'm', triageModel: 't' })
      expect(d.pictures.length).toBeGreaterThan(0)
      expect(d.picturesOnPage).toBeGreaterThanOrEqual(d.pictures.length)
      for (const p of d.pictures as Json[]) {
        expect(p.original.url).toMatch(new RegExp(`^https://${HOST}/media/`))
        expect(p.original.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(p.sent.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(p.sent.sha256).not.toBe(p.original.sha256)
        expect(p.sent.mediaType).toBe('image/jpeg')
        expect(p.sent.bytes).toBeGreaterThan(0)
        expect(Object.keys(p).sort()).toEqual(['assetId', 'kind', 'number', 'original', 'sent'])
      }
      const seenPhases = new Set(polls.map((p) => p.describing?.phase).filter(Boolean))
      expect(seenPhases.has('BUILDING_MODEL')).toBe(true)

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
      const { jobId, final } = await run(api, PILOT)
      bodies.push(JSON.stringify(final))
      expect(final.status).toBe('FAILED')
      expect(final.error.code).toBe('NO_DRAWINGS')
      expect((await call(api, 'GET', `/v1/analyses/${jobId}/scene`)).status).not.toBe(200)
    } finally {
      await api.close()
    }
  })

  it('the host\'s spend books bound the jobs: past the ceiling nothing is asked and the job keeps the drawings path\'s answer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'house-reader-spend-api-'))
    const prices = { m: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }, t: { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 } }
    const inner = reader(description)
    try {
      // room for one job's two reservations (the sorting and the description), not for a second description
      const limits = { ...DEFAULT_SPEND_LIMITS, maxUsd: 0.12 }
      const ledger = openSpendLedger({ dir, limits })
      const api = await apiWith(spendGuardedStructuredVision(inner, ledger, { limits, prices }))
      try {
        expect((await run(api, PILOT)).final.status).toBe('COMPLETED')
        const booked = ledger.read()
        expect(booked.requests).toBe(2)
        expect(booked.descriptions).toBe(1)
        // settled to the usage the answers stated: (2000 in, 800 out) on each model
        expect(booked.cumulativeUsd).toBeCloseTo((2000 * 0.1 + 800 * 0.5) / 1e6 + (2000 * 2 + 800 * 10) / 1e6, 6)
      } finally {
        await api.close()
      }
      // a restart of the service on the same books, with a ceiling the next description does not fit under
      const tight = { ...limits, maxUsd: 0.05 }
      const again = await apiWith(spendGuardedStructuredVision(inner, openSpendLedger({ dir, limits: tight }), { limits: tight, prices }))
      try {
        const asked = inner.asked.length
        const second = (await run(again, PILOT)).final
        expect(second.status).toBe('FAILED')
        expect(second.error.code).toBe('NO_DRAWINGS')
        // the sorting was still affordable and was asked; the description was not sent
        expect(inner.asked.slice(asked)).toEqual(['HOUSE_TRIAGE'])
        expect(openSpendLedger({ dir, limits: tight }).read().descriptions).toBe(1)
      } finally {
        await again.close()
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no body this suite received names the key, the pilot\'s token or a server path', () => {
    const all = bodies.join('\n')
    expect(all).not.toContain(SECRET)
    expect(all).not.toContain(TOKEN)
    expect(all).not.toMatch(/\/tmp\/|\/home\//)
  })
})
