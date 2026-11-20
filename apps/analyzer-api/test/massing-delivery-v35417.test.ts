import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { CONSULT_PRICES, analyseLink, anthropicConsultant, readExchangeRecord } from '@buildapp/analysis-service'
import type { AnalysisRun, ConsultantWiring } from '@buildapp/analysis-service'
import { fileByteCache } from '@buildapp/source-package'
import { parseModel } from '@buildapp/model'
import { createHash } from 'node:crypto'
import { InProcessExecutor } from '../src/executor.js'
import type { AnalysisWiring } from '../src/executor.js'
import { call, pollJob, startApi } from './support/harness.js'

// v3.54.17 R2 (audit §3, P0) — a CONTROLLED TEST, labelled as such, not an organic result. Through the host's public entry,
// LOCAL builds and its model is WITHHELD (`withholdLocalModel`, test-only), so the path without a LOCAL model runs: the
// plan outline and the four elevation sketches (answered by a stub that reads them off the synthetic drawings' own
// registrations, as an ideal reader would) → BUILD_MASSING → the ordinary result, model and scene the host stores → the
// final look sees exactly that revision → a repeat gives the same bytes and states.
const TOKEN = 'm'.repeat(32)
const price = CONSULT_PRICES['claude-sonnet-5-5']
const sha = (s: string): string => createHash('sha256').update(s).digest('hex')

type Answers = { outline: Array<[number, number]>; sketches: Map<string, Record<string, unknown>> }

/** What an ideal reader would answer, from LOCAL's own run of the same synthetic package (its plan envelope and views). */
function answersOf(run: AnalysisRun, house: SyntheticHouse): Answers {
  const k = (w: number, h: number): number => Math.max(1, Math.ceil(Math.max(w, h) / 1400))
  const planId = run.planDiagnostics.selectedPlanFrameId as string
  const plan = run.planDiagnostics.plans.find((p) => p.frameId === planId) as unknown as { envelope: { x0: number; y0: number; x1: number; y1: number }; sizePx: { width: number; height: number } }
  const kp = k(plan.sizePx.width, plan.sizePx.height)
  const e = plan.envelope
  const outline: Array<[number, number]> = [[e.x0 / kp, e.y0 / kp], [e.x1 / kp, e.y0 / kp], [e.x1 / kp, e.y1 / kp], [e.x0 / kp, e.y1 / kp]]
  const m = run.reconstruction.model
  const xs = m.walls.filter((w) => w.kind === 'EXTERIOR').flatMap((w) => [w.start.x, w.end.x])
  const zs = m.walls.filter((w) => w.kind === 'EXTERIOR').flatMap((w) => [w.start.z, w.end.z])
  const eaves = house.storeys.reduce((s, x) => s + x.height, 0)
  const ridgeAxis = house.roof?.ridgeAxis ?? 'X'
  const depth = ridgeAxis === 'X' ? house.depth : house.width
  const ridge = eaves + (depth / 2) * Math.tan(((house.roof?.pitchDeg ?? 30) * Math.PI) / 180)
  const sketches = new Map<string, Record<string, unknown>>()
  for (const v of run.reconstruction.facadeAlignment.views) {
    const frame = run.graph.coordinateFrames.find((f) => f.id === v.frameId)
    if (!frame?.size) continue
    const kk = k(frame.size.width, frame.size.height)
    const p = v.projection
    const alongX = v.facade === 'FRONT' || v.facade === 'REAR'
    const [lo, hi] = alongX ? [Math.min(...xs), Math.max(...xs)] : [Math.min(...zs), Math.max(...zs)]
    const px = (a: number): number => (a - p.alongAtPx0) / (p.alongSign * p.mpp) / kk
    const row = (y: number): number => (p.zeroRow - y / ((p as { mppV?: number }).mppV ?? p.mpp)) / kk
    const c0 = Math.min(px(lo), px(hi))
    const c1 = Math.max(px(lo), px(hi))
    const along = alongX === (ridgeAxis === 'X')
    const roof = along ? [[c0, row(eaves)], [c1, row(eaves)], [c1, row(ridge)], [c0, row(ridge)]] : [[c0, row(eaves)], [c1, row(eaves)], [(c0 + c1) / 2, row(ridge)]]
    const asset = run.pkg.assets.find((a) => a.id === frame.assetId)
    sketches.set((asset?.caption ?? '').slice(0, 120), { groundRow: row(0), silhouette: null, roofs: [{ polygon: roof }], walls: [{ class: 'LIGHT_RENDER', polygon: [[c0, row(0)], [c1, row(0)], [c1, row(eaves)], [c0, row(eaves)]], host: 'main', visibility: 'VISIBLE' }], openings: [], elements: [] })
  }
  return { outline, sketches }
}

/** One transport for every role: it answers by the tool it is offered, like the provider would, and counts what it is asked. */
function stubTransport(a: Answers, asked: string[]) {
  return anthropicConsultant({
    model: 'claude-sonnet-5-5',
    apiKey: 'sk-test-not-a-key',
    maxOutputTokens: 6000,
    createClient: async () => ({ messages: { create: async (body: Record<string, unknown>) => {
      const tool = ((body.tools as Array<{ name: string }>) ?? []).map((t) => t.name)
      const text = JSON.stringify(body.messages)
      const answer = (name: string, input: unknown) => ({ id: `msg_${asked.length}`, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'tool_use', id: `toolu_${asked.length}`, name, input }], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 200 } })
      if (tool.includes('report_outline')) {
        asked.push('OUTLINE')
        return answer('report_outline', { outline: a.outline, parts: ['MAIN'], orthogonal: true })
      }
      if (tool.includes('report_elevation')) {
        const caption = /An elevation of a house — \\"([^"\\]*)\\"/.exec(text)?.[1] ?? ''
        const sk = a.sketches.get(caption)
        asked.push(`SKETCH:${sk ? 'known' : 'unknown'}`)
        return answer('report_elevation', sk ?? { groundRow: null, silhouette: null, roofs: [], walls: [], openings: [], elements: [] })
      }
      asked.push('CHECK')
      const revision = /Model revision ([0-9a-f]+)/.exec(text)?.[1] ?? ''
      return answer('submit_review', { status: 'ISSUE_FOUND', observations: [{ about: 'openings', seen: `revision ${revision}: the body has no window or door; the drawings show several`, certainty: 'CERTAIN' }], requestedEvidence: [], proposedCorrections: [], checked: ['massing', 'roof'], notChecked: ['interior'] })
    } } }),
  })
}

async function runCase(house: SyntheticHouse, code: string): Promise<void> {
  const publisher = syntheticPublisher({ projects: [{ code, title: house.name, house }] })
  const url = publisher.pageUrl(code)
  // LOCAL's own run of the package, only to know what an ideal reader would answer
  const reference = await analyseLink({ kind: 'URL', url }, { adapters: [publisher.adapter], deps: publisher.deps, cache: fileByteCache(mkdtempSync(join(tmpdir(), 'r2-ref-'))) })
  const answers = answersOf(reference as AnalysisRun, house)
  expect(answers.sketches.size).toBeGreaterThanOrEqual(2)
  const runs: Array<{ summary: Record<string, unknown>; model: string; scene: string; asked: string[]; exchanges: ReturnType<typeof readExchangeRecord> }> = []
  for (let i = 0; i < 2; i += 1) {
    const dataDir = mkdtempSync(join(tmpdir(), 'r2-massing-'))
    const asked: string[] = []
    const t = stubTransport(answers, asked)
    const consultant: ConsultantWiring = { model: t, price, variant: 'C', sketches: 'ON', sketchModel: t, sketchPrice: price, outlineModel: t, outlinePrice: price, check: 'ON', maxGeometryRounds: 0, withholdLocalModel: true }
    const wiring: AnalysisWiring = { adapters: [publisher.adapter], deps: publisher.deps, exchangeDir: join(dataDir, 'consult-exchanges'), consultant }
    const api = await startApi(publisher, { houseReaderToken: TOKEN }, { dataDir, executor: new InProcessExecutor(() => wiring) })
    try {
      const posted = await call(api, 'POST', '/v1/analyses', { url }, { authorization: `Bearer ${TOKEN}` })
      expect(posted.status).toBe(202)
      const jobId = String(posted.json.jobId)
      const seen = await pollJob(api, jobId, () => false, 400_000)
      if (seen[seen.length - 1].status !== 'COMPLETED') process.stderr.write(`JOB ${JSON.stringify(seen[seen.length - 1]).slice(0, 1500)}\nJOURNAL ${JSON.stringify(readExchangeRecord(join(dataDir, "consult-exchanges", jobId)).journal.slice(-4))}\nASKED ${asked.join(',')}\n`)
      expect(seen[seen.length - 1].status).toBe('COMPLETED')
      const summary = (await call(api, 'GET', `/v1/analyses/${jobId}/result`)).json as Record<string, unknown>
      const model = (await call(api, 'GET', `/v1/analyses/${jobId}/model`)).text
      const scene = (await call(api, 'GET', `/v1/analyses/${jobId}/scene`)).text
      runs.push({ summary, model, scene, asked, exchanges: readExchangeRecord(join(dataDir, 'consult-exchanges', jobId)) })
    } finally {
      await api.close()
    }
  }
  const [a, b] = runs
  // the ordinary delivery: a result whose hashes name the model and scene the phone downloads
  expect(sha(a.model)).toBe(a.summary.modelSha256)
  expect(sha(a.scene)).toBe(a.summary.sceneSha256)
  const warnings = (a.summary.warningDetails as Array<{ code: string; severity: string }>).map((w) => w.code)
  expect(warnings).toContain('MODEL_FROM_PLAN_OUTLINE_AND_ELEVATIONS')
  expect(warnings).toContain('MASSING_INTERIOR_NOT_CHECKED')
  expect((a.summary.unresolved as Array<{ what: string; reason: string }>).some((u) => /NOT_CHECKED/.test(u.reason))).toBe(true)
  expect((a.summary.unresolved as Array<{ reason: string }>).some((u) => /LOCAL_MODEL_WITHHELD_TEST/.test(u.reason))).toBe(true)
  expect((a.summary.measurement as { quantities: string }).quantities).not.toBe('USABLE_IN_SCOPE')
  // a supported body with a roof, and nothing invented inside
  const m = parseModel(a.model) as unknown as { roofs: Array<{ kind?: string; type?: string }>; walls: unknown[]; rooms?: unknown[] }
  expect(m.roofs.length).toBeGreaterThanOrEqual(1)
  expect(m.walls.length).toBeGreaterThanOrEqual(4)
  expect(m.rooms ?? []).toHaveLength(0)
  // the final look saw exactly this revision
  const sourceCheck = a.summary.sourceCheck as { checkedRevision: string | null; deliveredRevision: string | null; looks: number }
  expect(sourceCheck.looks).toBeGreaterThanOrEqual(1)
  expect(sourceCheck.checkedRevision).toBe(sourceCheck.deliveredRevision)
  expect(a.asked.filter((x) => x === 'CHECK').length).toBeGreaterThanOrEqual(1)
  expect(a.asked).toContain('OUTLINE')
  // the exchange record holds the outline, the sketches and the look, and ends COMPLETED
  expect(a.exchanges.journal[a.exchanges.journal.length - 1]).toMatchObject({ event: 'END', state: 'COMPLETED', modelSha256: a.summary.modelSha256 })
  // a repeat: the same bytes and the same states
  expect(b.model).toBe(a.model)
  expect(b.scene).toBe(a.scene)
  expect(b.asked).toEqual(a.asked)
  expect((b.summary.consultation as { quality?: unknown }).quality).toEqual((a.summary.consultation as { quality?: unknown }).quality)
}

describe('v3.54.17 R2 the body built without a LOCAL model is delivered through the host (controlled test)', () => {
  it('one gabled body (Larchfield): result, model and scene delivered; the final look judged that revision; a repeat is byte-identical', async () => {
    await runCase(LARCHFIELD, 'larchfield-lf01')
  }, 900_000)
})
