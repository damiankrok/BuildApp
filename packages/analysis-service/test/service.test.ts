/**
 * The link-analysis service, end to end, against a publisher that lives in
 * memory: a URL goes in through the SAME acquisition code a real one does,
 * and a verified, hashed building comes out.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { fileByteCache, memoryByteCache } from '@buildapp/source-package'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { loadBundle, sha256 } from '@buildapp/mobile-scene'
import { serializeModel } from '@buildapp/model'
import { verifyReplay } from '@buildapp/reconstruction'
import { ANALYSIS_STAGES, AnalysisError, hashesOf, progressAt, runAnalysis, runLinkAnalysis, summaryOf, validateAnalysisUrl } from '../src/index.js'
import type { AnalysisProgress } from '../src/index.js'
import { cli } from '../scripts/reconstruct-v2.js'

const publisher = syntheticPublisher({
  projects: [
    { code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD },
    { code: 'sections-only', title: 'Only a section', house: LARCHFIELD, only: (slug) => slug === 'przekroj' },
  ],
  hosts: { 'intranet.synthetic-publisher.test': '10.0.0.5' },
  redirects: {
    'https://drawings.synthetic-publisher.test/projects/moved': 'https://intranet.synthetic-publisher.test/projects/larchfield-lf01',
  },
})
const optionsFor = (extra: Partial<Parameters<typeof runAnalysis>[1]> = {}): Parameters<typeof runAnalysis>[1] => ({
  adapters: [publisher.adapter],
  deps: publisher.deps,
  cache: memoryByteCache(),
  now: () => new Date('2026-01-01T00:00:00Z'),
  ...extra,
})

const scratch = mkdtempSync(join(tmpdir(), 'analysis-service-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const events: AnalysisProgress[] = []
const cache = memoryByteCache()
const first = runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, optionsFor({ cache, jobId: 'job-a', progress: (e) => events.push(e) }))
// started once, awaited by every test below; a failure is reported by the first of them
first.catch(() => undefined)

describe('runAnalysis on a URL', () => {
  it('produces a verified, hashed building from the page alone', async () => {
    const { result, sceneText } = await first
    expect(result.jobId).toBe('job-a')
    expect(result.title).toBe('Larchfield')
    expect(result.label).toBe('Larchfield (analysis)')
    expect(result.modelId).toBe('m-analysis-larchfield-lf01')
    expect(result.publisher).toBe('synthetic-publisher')
    expect(result.counts.masses).toBeGreaterThanOrEqual(1)
    expect(result.counts.openings).toBeGreaterThan(0)
    expect(result.counts.meshes).toBeGreaterThan(0)
    expect(result.verification.replay).toBe('BYTE_IDENTICAL')
    expect(verifyReplay(result.candidate).ok).toBe(true)
    // the hashes describe the bytes a client downloads
    expect(result.sceneSha256).toBe(sha256(sceneText))
    expect(result.sceneBytes).toBe(Buffer.byteLength(sceneText))
    const loaded = loadBundle(sceneText)
    expect(loaded.ok && loaded.bundle.contentHash).toBe(result.sceneContentHash)
    expect(result.modelSha256).toBe(sha256(serializeModel(result.model)))
    expect(result.scene.generatedFrom.modelId).toBe(result.modelId)
    expect(result.quality.levels.L0 + result.quality.levels.L1 + result.quality.levels.L2).toBeGreaterThan(0)
  })

  it('says that no vision provider ran, rather than implying one did', async () => {
    const { result } = await first
    expect(result.vision.mode).toBe('DETERMINISTIC_ONLY')
    expect(result.vision.provider).toBeNull()
    expect(result.warnings.some((w) => /no vision provider ran/.test(w))).toBe(true)
  })

  it('reports every stage, in order, with progress that only moves forward and ends at 1', async () => {
    await first
    const stages = [...new Set(events.map((e) => e.stage))]
    expect(stages).toEqual([...ANALYSIS_STAGES])
    for (let i = 1; i < events.length; i++) expect(events[i].progress).toBeGreaterThanOrEqual(events[i - 1].progress)
    expect(events[0].progress).toBe(0)
    expect(events[events.length - 1].progress).toBe(1)
    // reading the drawings reports each one, not a timer
    expect(events.filter((e) => e.stage === 'EXTRACTING_OBSERVATIONS' && /^drawing \d+ of \d+$/.test(e.detail ?? '')).length).toBeGreaterThanOrEqual(3)
    for (const e of events) expect(e.detail ?? '').not.toMatch(/\/(home|tmp|root|usr)\//)
  })

  it('is deterministic: a second run of the same page gives the same hashes', async () => {
    const again = await runLinkAnalysis({ url: publisher.pageUrl('larchfield-lf01'), jobId: 'job-b', options: optionsFor() })
    const { result } = await first
    expect(hashesOf(again)).toEqual(hashesOf(result))
    expect(again.jobId).toBe('job-b')
  })

  it('the summary a client polls carries no candidate, model or scene', async () => {
    const summary = summaryOf((await first).result) as Record<string, unknown>
    expect(summary.candidate).toBeUndefined()
    expect(summary.model).toBeUndefined()
    expect(summary.scene).toBeUndefined()
    expect(summary.candidateHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('one pipeline: the CLI, the service and a sealed replay agree', () => {
  it('replaying the sealed package and graph gives the same building as the URL run', async () => {
    const { result, pkg, graph } = await first
    const replay = await runAnalysis({ kind: 'PACKAGE', pkg, graph }, optionsFor({ cache }))
    expect(hashesOf(replay.result)).toEqual(hashesOf(result))
    expect(replay.result.vision.mode).toBe('REPLAYED_GRAPH')
  })

  it('the CLI is a thin adapter: same sealed input, byte-identical hashes', async () => {
    const { result, pkg, graph } = await first
    // the CLI reads a package, a graph and a byte cache from disk, as it does for Marcówki
    const packagePath = join(scratch, 'package.json')
    const graphPath = join(scratch, 'graph.json')
    writeFileSync(packagePath, JSON.stringify(pkg))
    writeFileSync(graphPath, JSON.stringify(graph))
    const cacheDir = join(scratch, 'bytes')
    const disk = fileByteCache(cacheDir)
    for (const asset of pkg.assets) for (const v of asset.variants) {
      const hit = await cache.get(v.url)
      if (hit) await disk.put(v.url, hit.bytes, hit.mediaType)
    }
    const out = join(scratch, 'out')
    const lines: string[] = []
    const run = await cli(['--package', packagePath, '--graph', graphPath, '--cache', cacheDir, '--out', out, '--slug', 'larchfield-lf01', '--label', result.label, '--model-id', result.modelId], (l) => lines.push(l))
    expect(hashesOf(run.result)).toEqual(hashesOf(result))
    const written = JSON.parse(readFileSync(join(out, 'larchfield-lf01-auto-v2.json'), 'utf8'))
    expect(written.contentHash).toBe(result.candidateHash)
    expect(lines.join('')).toContain(result.candidateHash)
  })
})

describe('what is refused, and how it is said', () => {
  const codeOf = async (p: Promise<unknown>): Promise<string> => {
    try {
      await p
      return 'RESOLVED'
    } catch (e) {
      expect(e).toBeInstanceOf(AnalysisError)
      // a message is about the source, never about the machine
      expect((e as Error).message).not.toMatch(/\/(home|tmp|root|usr|app)\/|node_modules|at .*\(|\.ts:\d+/)
      return (e as AnalysisError).code
    }
  }
  const run = (url: string, extra: Partial<Parameters<typeof runAnalysis>[1]> = {}): Promise<unknown> => runAnalysis({ kind: 'URL', url }, optionsFor(extra))

  it.each([
    ['http://drawings.synthetic-publisher.test/projects/larchfield-lf01', 'INVALID_URL'],
    ['file:///etc/passwd', 'INVALID_URL'],
    ['https://user:pw@drawings.synthetic-publisher.test/projects/x', 'INVALID_URL'],
    ['https://drawings.synthetic-publisher.test:8443/projects/x', 'INVALID_URL'],
    ['https://127.0.0.1/projects/x', 'INVALID_URL'],
    ['https://[::1]/projects/x', 'INVALID_URL'],
    ['https://localhost/projects/x', 'INVALID_URL'],
    ['not a url', 'INVALID_URL'],
    ['https://example.com/projects/x', 'UNSUPPORTED_PUBLISHER'],
  ])('%s → %s, before anything is fetched', async (url, code) => {
    const before = publisher.requests.length
    expect(await codeOf(run(url))).toBe(code)
    expect(publisher.requests.length).toBe(before)
  })

  it('a redirect to a private address is refused on the hop, not followed', async () => {
    expect(await codeOf(run('https://drawings.synthetic-publisher.test/projects/moved'))).toBe('SOURCE_REFUSED')
    expect(publisher.requests).not.toContain('https://intranet.synthetic-publisher.test/projects/larchfield-lf01')
  })

  it('a page that is not there is SOURCE_UNREACHABLE', async () => {
    expect(await codeOf(run(publisher.pageUrl('no-such-project')))).toBe('SOURCE_UNREACHABLE')
  })

  it('a page with no plan and no elevation stops at classification', async () => {
    const seen: string[] = []
    expect(await codeOf(run(publisher.pageUrl('sections-only'), { progress: (e) => seen.push(e.stage) }))).toBe('NO_DRAWINGS')
    expect(seen).not.toContain('EXTRACTING_OBSERVATIONS')
  })

  it('cancelling stops the run and says CANCELLED', async () => {
    const controller = new AbortController()
    const slow = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }], beforeRespond: () => controller.abort() })
    const p = runAnalysis({ kind: 'URL', url: slow.pageUrl('larchfield-lf01') }, { adapters: [slow.adapter], deps: slow.deps, cache: memoryByteCache(), signal: controller.signal })
    expect(await codeOf(p)).toBe('CANCELLED')
  })

  it('a run past its time limit says TIMEOUT', async () => {
    const controller = new AbortController()
    const slow = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }], beforeRespond: () => controller.abort(new DOMException('limit', 'TimeoutError')) })
    const p = runAnalysis({ kind: 'URL', url: slow.pageUrl('larchfield-lf01') }, { adapters: [slow.adapter], deps: slow.deps, cache: memoryByteCache(), signal: controller.signal })
    expect(await codeOf(p)).toBe('TIMEOUT')
  })

  it('the cheap URL fence is the same function the API calls before queueing', () => {
    expect(validateAnalysisUrl(`${publisher.pageUrl('larchfield-lf01')}#frag`, [publisher.adapter]).toString()).toBe(publisher.pageUrl('larchfield-lf01'))
    expect(() => validateAnalysisUrl(42, [publisher.adapter])).toThrow(AnalysisError)
  })
})

describe('progress is a position in the pipeline', () => {
  it('weights sum to one and every stage starts where the last one ended', () => {
    expect(progressAt('ACQUIRING_SOURCE', 0)).toBe(0)
    expect(progressAt('VERIFYING', 1)).toBe(1)
    for (let i = 1; i < ANALYSIS_STAGES.length; i++) expect(progressAt(ANALYSIS_STAGES[i], 0)).toBeCloseTo(progressAt(ANALYSIS_STAGES[i - 1], 1), 4)
    expect(progressAt('SOLVING_METRICS', Number.NaN)).toBe(progressAt('SOLVING_METRICS', 0))
  })
})
