/**
 * v3.54.3: the correction loop through the service a phone talks to — the production server, runner, store and
 * executor over a real socket. Only the wiring differs: a synthetic publisher on an in-memory internet, and a consultant
 * that answers from a script (no key, no provider, no project's data).
 *
 * What this proves: a job submitted with the pilot's token goes LOCAL → look at the built model → a bound ROOF_FEATURE
 * → the analyzer's own rebuild → review of the new revision, and the stored result — the one an app downloads — carries
 * the dormer in its model and scene, the consultation's decisions and the source check with its known defects; a job
 * without the token never reaches the consultant; a feature the review rejects is taken out again; a proposal on a
 * gable end, on the model's own views or on a stale revision changes nothing. What it does not prove: what a live
 * provider answers, or anything on a device.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '@buildapp/mobile-scene'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { MODEL_CHECK_SYSTEM, runAnalysis } from '@buildapp/analysis-service'
import type { ConsultantModel, ConsultantWiring, ModelTurn } from '@buildapp/analysis-service'
import { memoryByteCache } from '@buildapp/source-package'
import { InProcessExecutor } from '../src/executor.js'
import { call, pollJob, startApi } from './support/harness.js'
import type { Api, Json } from './support/harness.js'

const TOKEN = 'pilot-token-for-tests-0123456789abcdef'
const PILOT = { authorization: `Bearer ${TOKEN}` }
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex')
const publisher = (): ReturnType<typeof syntheticPublisher> => syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })

type Look = { revision: string; elevations: Array<{ n: number; width: number; height: number }>; applied: boolean }
/** What the scripted consultant can read off a look's request: the revision named, and the numbered elevation pictures. */
function lookOf(messages: unknown[]): Look {
  const text = JSON.stringify(messages)
  const revision = /Model revision ([0-9a-f]{12})/.exec(text)?.[1] ?? ''
  const elevations = [...text.matchAll(/Picture (\d+) \((\d+) × (\d+) px\): a publisher's elevation drawing/g)].map((m) => ({ n: Number(m[1]), width: Number(m[2]), height: Number(m[3]) }))
  return { revision, elevations, applied: /the analyzer applied: /.test(text) }
}
const review = (input: Record<string, unknown>): ModelTurn => ({ content: [{ type: 'tool_use', id: `t${Math.random()}`, name: 'submit_review', input: { status: 'ISSUE_FOUND', observations: [], requestedEvidence: [], proposedCorrections: [], checked: [], notChecked: [], ...input } }], usage: { inputTokens: 1000, outputTokens: 100 }, model: 'scripted', latencyMs: 1 })

/** A consultant that proposes one dormer on the first look and answers the review of it as told. */
function scripted(plan: { side: string; picture: (l: Look) => number; verdict?: string; mutate?: (p: Record<string, unknown>, l: Look) => void }): ConsultantModel & { looks: Look[]; metricAsked: number } {
  const looks: Look[] = []
  const self = {
    id: 'scripted',
    model: 'scripted',
    maxOutputTokens: 1000,
    looks,
    metricAsked: 0,
    send: async (req: { system: string; messages: unknown[] }): Promise<ModelTurn> => {
      if (req.system !== MODEL_CHECK_SYSTEM) {
        self.metricAsked += 1
        return review({ status: 'UNKNOWN' })
      }
      const l = lookOf(req.messages)
      looks.push(l)
      if (l.applied) return review({ status: 'VERIFIED_IN_SCOPE', appliedReview: [{ id: 'dormer-front-c50', verdict: plan.verdict ?? 'MATCHES', note: 'scripted' }, { id: 'dormer-rear-c50', verdict: plan.verdict ?? 'MATCHES', note: 'scripted' }, { id: 'dormer-left-c50', verdict: plan.verdict ?? 'MATCHES', note: 'scripted' }, { id: 'dormer-right-c50', verdict: plan.verdict ?? 'MATCHES', note: 'scripted' }] })
      const n = plan.picture(l)
      const pic = l.elevations.find((e) => e.n === n) ?? { n, width: 1000, height: 600 }
      const facade = { leftX: pic.width * 0.1, rightX: pic.width * 0.9, eavesY: pic.height * 0.6, ridgeY: pic.height * 0.2 }
      const proposal: Record<string, unknown> = {
        proposalId: 'P1',
        baseRevision: l.revision,
        operation: 'ROOF_FEATURE',
        targetId: `${plan.side} roof`,
        proposed: { literal: 'a gable dormer', unit: 'unknown' },
        feature: { kind: 'GABLE_DORMER', modelSide: plan.side, picture: n, facade, box: { x0: pic.width * 0.42, x1: pic.width * 0.58, y0: pic.height * 0.32, y1: pic.height * 0.48 }, front: 'SET_BACK_ON_SLOPE', glazed: true, mirrored: false },
        evidence: [{ sourceId: `picture ${n}` }],
        justification: 'scripted: the elevation shows a dormer the model lacks',
        alternatives: [],
        uncertainty: 'LOW',
        expectedEffect: 'a dormer',
      }
      plan.mutate?.(proposal, l)
      return review({ proposedCorrections: [proposal] })
    },
  }
  return self
}

/** The synthetic house as the analyzer reads it alone: which sides are eaves sides, and which elevation shows one. */
async function facts(): Promise<{ eaves: string; gableEnd: string; pictureFor: (side: string) => (l: Look) => number; localHash: string }> {
  const p = publisher()
  const run = await runAnalysis({ kind: 'URL', url: p.pageUrl('larchfield-lf01') }, { adapters: [p.adapter], deps: p.deps, cache: memoryByteCache() })
  const b = run.reconstruction.building
  const axis = b.mainRoof?.ridgeAxis ?? b.planeRoofs?.[0]?.ridgeAxis
  expect(axis, 'the synthetic house has a pitched main roof').toBeDefined()
  const eavesSides = axis === 'X' ? ['FRONT', 'REAR'] : ['LEFT', 'RIGHT']
  const frames = run.graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_ELEVATION')
  expect(frames.length, 'the synthetic page publishes elevation drawings').toBeGreaterThan(0)
  const registered = new Map(run.reconstruction.registrations.elevations.map((e) => [e.frameId, e.side as string]))
  // sources are numbered: the plan, the other plans, then the elevations in the graph's order
  const first = 1 + run.reconstruction.registrations.plans.length
  const pictureFor = (side: string) => (l: Look): number => {
    const i = frames.findIndex((f) => registered.get(f.id) === side)
    const j = i >= 0 ? i : frames.findIndex((f) => !registered.has(f.id))
    return l.elevations[Math.max(0, j)]?.n ?? first
  }
  const eaves = eavesSides.find((s) => frames.some((f) => registered.get(f.id) === s)) ?? eavesSides[0]
  return { eaves, gableEnd: axis === 'X' ? 'LEFT' : 'FRONT', pictureFor, localHash: run.reconstruction.candidate.modelHash }
}

async function apiWith(model: ConsultantModel, variant: 'C' | 'R' = 'C'): Promise<Api> {
  const p = publisher()
  const consultant: ConsultantWiring = { model, price: { inputUsdPerMTok: 2, outputUsdPerMTok: 10 }, variant }
  return startApi(p, { houseReaderToken: TOKEN }, { executor: new InProcessExecutor(() => ({ adapters: [p.adapter], deps: p.deps, consultant })) })
}
const submit = async (api: Api, headers: Record<string, string> = {}): Promise<{ jobId: string; final: Json }> => {
  const r = await call(api, 'POST', '/v1/analyses', { url: publisher().pageUrl('larchfield-lf01') }, headers)
  expect(r.status).toBe(202)
  const polls = await pollJob(api, r.json.jobId)
  return { jobId: r.json.jobId as string, final: polls[polls.length - 1] }
}

describe('v3.54.3 the correction loop through the host', () => {
  it('a look proposes a dormer, the analyzer builds it, the next look reviews it; the stored result carries all of it', async () => {
    const f = await facts()
    const model = scripted({ side: f.eaves, picture: f.pictureFor(f.eaves) })
    const api = await apiWith(model)
    try {
      const { jobId, final } = await submit(api, PILOT)
      expect(final.status).toBe('COMPLETED')
      const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
      const id = `dormer-${f.eaves.toLowerCase()}-c50`
      // the consultation as the consumed result carries it
      expect(result.consultation).toMatchObject({ globalDescription: 'DISABLED', variant: 'C', roofFeatures: [id] })
      expect(result.consultation.looks.map((l: Json) => l.decision)).toEqual(['ACCEPT', 'REVIEW_ONLY'])
      expect(result.consultation.local.modelHash).toBe(f.localHash)
      expect(result.modelHash).not.toBe(f.localHash)
      // the second look was of exactly the revision the first one's correction made, and it is the one delivered
      expect(model.looks).toHaveLength(2)
      expect(model.looks[1].revision).toBe(result.modelHash.slice(0, 12))
      expect(result.sourceCheck).toMatchObject({ status: 'CHECKED', checkedRevision: result.modelHash.slice(0, 12), deliveredRevision: result.modelHash.slice(0, 12) })
      expect(result.sourceCheck.corrections).toEqual([expect.objectContaining({ operation: 'ROOF_FEATURE', featureId: id, state: 'APPLIED', review: 'MATCHES' })])
      expect(result.sourceCheck.knownDefects.map((d: Json) => d.code)).toContain('ROOF_FEATURE_APPROXIMATE')
      expect(result.sourceCheck.axes).toMatchObject({ roof: 'CORRECTED_APPROXIMATE', interior: 'NOT_CHECKED', sourceCheck: 'CHECKED' })
      // the model an app downloads holds the dormer under its stable id, and survives serialisation
      const modelRes = await fetch(`${api.base}/v1/analyses/${jobId}/model`)
      const modelBytes = Buffer.from(await modelRes.arrayBuffer())
      expect(sha256(modelBytes)).toBe(result.modelSha256)
      const stored = JSON.parse(modelBytes.toString('utf8')) as { assemblies: Array<{ id: string; kind: string; hostPlaneIds?: string[] }>; walls: Array<{ id: string }>; roofPlanes: Array<{ id: string }> }
      expect(stored.assemblies.find((a) => a.kind === 'DORMER')).toMatchObject({ id })
      expect(stored.walls.some((w) => w.id === `${id}-front`)).toBe(true)
      expect(stored.roofPlanes.some((p) => p.id.startsWith(`${id}-roof`))).toBe(true)
      const sceneRes = await fetch(`${api.base}/v1/analyses/${jobId}/scene`)
      const sceneBytes = Buffer.from(await sceneRes.arrayBuffer())
      expect(sha256(sceneBytes)).toBe(result.sceneSha256)
      const bundle = loadBundle(sceneBytes.toString('utf8'))
      expect(bundle.ok && bundle.bundle.contentHash).toBe(result.sceneContentHash)
    } finally {
      await api.close()
    }
  }, 240_000)

  it('without the pilot\'s token the job never reaches the consultant, and is the LOCAL model', async () => {
    const f = await facts()
    const model = scripted({ side: f.eaves, picture: f.pictureFor(f.eaves) })
    const api = await apiWith(model)
    try {
      const { jobId, final } = await submit(api)
      expect(final.status).toBe('COMPLETED')
      const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
      expect(result.consultation).toBeUndefined()
      expect(result.sourceCheck).toBeUndefined()
      expect(result.modelHash).toBe(f.localHash)
      expect(model.looks).toHaveLength(0)
      expect(model.metricAsked).toBe(0)
    } finally {
      await api.close()
    }
  }, 240_000)

  it('counter-trials: a gable end, the model\'s own views, a stale revision — the model stays the LOCAL one, the finding stays on the record', async () => {
    const f = await facts()
    const cases: Array<{ name: string; model: ReturnType<typeof scripted>; state: string; code?: string }> = [
      // an ordinary gable end proposed as a feature: the analyzer refuses it, typed
      { name: 'gable end', model: scripted({ side: f.gableEnd, picture: f.pictureFor(f.gableEnd) }), state: 'REFUSED_BY_ANALYZER', code: 'GABLE_END_SIDE' },
      // the model's own picture cited as the source
      { name: 'model views', model: scripted({ side: f.eaves, picture: (l) => Math.max(...l.elevations.map((e) => e.n)) + 2 }), state: 'REJECTED' },
      { name: 'stale revision', model: scripted({ side: f.eaves, picture: f.pictureFor(f.eaves), mutate: (p) => void (p.baseRevision = '000000000000') }), state: 'REJECTED' },
      { name: 'high uncertainty', model: scripted({ side: f.eaves, picture: f.pictureFor(f.eaves), mutate: (p) => void (p.uncertainty = 'HIGH') }), state: 'HELD' },
    ]
    for (const c of cases) {
      const api = await apiWith(c.model)
      try {
        const { jobId, final } = await submit(api, PILOT)
        expect(final.status, c.name).toBe('COMPLETED')
        const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
        expect(result.modelHash, c.name).toBe(f.localHash)
        expect(result.consultation.roofFeatures, c.name).toEqual([])
        expect(result.sourceCheck.corrections[0], c.name).toMatchObject({ state: c.state })
        if (c.code) expect(result.sourceCheck.corrections[0].why, c.name).toMatch(c.code)
        // the difference is still known, and the result says so beside the model
        expect(result.sourceCheck.axes.roof, c.name).toBe('DIFFERENCE_OPEN')
      } finally {
        await api.close()
      }
    }
  }, 480_000)

  it('a feature the review of the rebuilt revision rejects is taken out again: the delivered model is the one before', async () => {
    const f = await facts()
    const model = scripted({ side: f.eaves, picture: f.pictureFor(f.eaves), verdict: 'SHOULD_NOT_EXIST' })
    const api = await apiWith(model)
    try {
      const { jobId, final } = await submit(api, PILOT)
      expect(final.status).toBe('COMPLETED')
      const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
      expect(result.modelHash).toBe(f.localHash)
      expect(result.consultation.roofFeatures).toEqual([])
      expect(result.consultation.looks.map((l: Json) => l.decision)).toEqual(['ACCEPT', 'ROLLBACK'])
      expect(result.sourceCheck.corrections[0]).toMatchObject({ state: 'ROLLED_BACK' })
      // the delivered revision is not the one last looked at
      expect(result.sourceCheck.status).toBe('PARTLY_CHECKED')
    } finally {
      await api.close()
    }
  }, 240_000)

  it('variant R looks and records, and changes nothing', async () => {
    const f = await facts()
    const model = scripted({ side: f.eaves, picture: f.pictureFor(f.eaves) })
    const api = await apiWith(model, 'R')
    try {
      const { jobId } = await submit(api, PILOT)
      const result = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json
      expect(result.modelHash).toBe(f.localHash)
      expect(result.consultation.looks.map((l: Json) => l.decision)).toEqual(['NOT_RUN'])
      expect(model.looks).toHaveLength(1)
    } finally {
      await api.close()
    }
  }, 240_000)
})
