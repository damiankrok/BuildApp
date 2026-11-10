/**
 * The generic project-page reader, end to end through the production
 * pipeline (BUILDPLAN-INTEGRATION-004A).
 *
 * The same synthetic house is published twice on an in-memory internet: by
 * the synthetic specialist publisher, and by a site nobody has written an
 * adapter for — plain markup with a title, a figures table, a room schedule
 * and the drawings as pictures with Polish captions. The generic reader must
 * reconstruct the same building from the second site, and the cross-source
 * comparison must say so: SOURCE_EQUIVALENT, by geometry, never by name.
 *
 * The other cases are the honest answers: a project page with only renders,
 * a page that is not a project, a page that needs a browser, an address that
 * is not safe.
 */
import { describe, expect, it } from 'vitest'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { genericProjectPageAdapter, memoryByteCache } from '@buildapp/source-package'
import { compileBuilding } from '@buildapp/geometry'
import { readFileSync } from 'node:fs'
import type { StructuredVision } from '@buildapp/source-vision'
import { AnalysisError, analyseLink, drawingsModelUnanchored, compareSources, comparableOf, comparisonMarkdown, geometryFingerprint, hashesOf, runAnalysis } from '../src/index.js'

import { HOST, PAGE, unknownPublisher } from './support/unknown-publisher.js'

/** The specialist's side of the comparison: the same house through the adapter that knows its page. */
const specialist = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })

const codeOf = async (p: Promise<unknown>): Promise<AnalysisError> => {
  try {
    await p
    throw new Error('resolved')
  } catch (e) {
    expect(e).toBeInstanceOf(AnalysisError)
    return e as AnalysisError
  }
}

describe('the same house on an unknown site', () => {
  it('is read by the generic adapter, reconstructs, and is SOURCE_EQUIVALENT to the specialist’s reading by geometry', async () => {
    const site = unknownPublisher()
    const generic = await runAnalysis({ kind: 'URL', url: PAGE }, { adapters: [specialist.adapter, genericProjectPageAdapter], deps: site.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    expect(generic.pkg.adapter.id).toBe('generic.project-page')
    expect(generic.pkg.project).toEqual({ name: 'Dom Larchfield', publisher: HOST })
    expect(generic.result.counts.assetsByDocument).toMatchObject({ FLOOR_PLAN: 2, ELEVATION: 4, SECTION: 1 })
    expect(generic.pkg.publishedSpecifications.map((s) => s.key)).toEqual(['roof', 'walls'])
    expect(generic.result.verification.replay).toBe('BYTE_IDENTICAL')

    const known = await runAnalysis({ kind: 'URL', url: specialist.pageUrl('larchfield-lf01') }, { adapters: [specialist.adapter, genericProjectPageAdapter], deps: specialist.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    expect(known.pkg.adapter.id).toBe('synthetic-publisher')

    // identity differs (publisher, address, label), the building does not
    expect(known.result.modelHash).not.toBe(generic.result.modelHash)
    const a = comparableOf(known.pkg, { model: known.result.model, scene: compileBuilding(known.result.model) })
    const b = comparableOf(generic.pkg, { model: generic.result.model, scene: compileBuilding(generic.result.model) })
    const comparison = compareSources(a, b)
    expect(comparison.rows.find((r) => r.aspect === 'geometry fingerprint')?.verdict).toBe('MATCH')
    expect(comparison.equivalence).toBe('SOURCE_EQUIVALENT')
    expect(comparisonMarkdown(comparison, ['specialist', 'generic'])).toContain('SOURCE_EQUIVALENT')
    expect(geometryFingerprint(compileBuilding(known.result.model))).toBe(geometryFingerprint(compileBuilding(generic.result.model)))
  }, 240_000)

  it('a tracked link to a page with no publisher id is the same analysis, down to the model id (005A)', async () => {
    // Without a publisher id the model id is derived from the page's address; before 005A a
    // newsletter's `utm_*` or an advertisement's `gclid` gave the same house another id,
    // another label hash and another model hash.
    const run = (url: string) => runAnalysis({ kind: 'URL', url }, { adapters: [genericProjectPageAdapter], deps: unknownPublisher().deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
    const clean = await run(PAGE)
    const tracked = await run(`${PAGE}?utm_source=newsletter&utm_medium=email&gclid=Cj0KCQjw#rzuty`)
    expect(tracked.pkg.project.externalId).toBeUndefined()
    expect(tracked.pkg.canonicalUrl).toBe(PAGE)
    expect(tracked.result.modelId).toBe(clean.result.modelId)
    expect(hashesOf(tracked.result)).toEqual(hashesOf(clean.result))
  }, 240_000)

  it('compares symmetrically and never by title alone', () => {
    const a = comparableOf({ ...specialistPackageStub(), project: { name: 'Dom Larchfield', publisher: 'a' } } as never)
    const b = comparableOf({ ...specialistPackageStub(), project: { name: 'Dom Larchfield', publisher: 'b' } } as never)
    const c = compareSources(a, b)
    expect(c.equivalence).toBe('NOT_ENOUGH_EVIDENCE')
    expect(compareSources(b, a).equivalence).toBe(c.equivalence)
  })
})

/** An empty package's comparable view: a title and nothing else to compare. */
function specialistPackageStub() {
  return { assets: [], publishedFacts: [], publishedRooms: [], publishedSpecifications: [] }
}

describe('the honest answers for an unknown site', () => {
  const options = (site: ReturnType<typeof unknownPublisher>) => ({ adapters: [specialist.adapter, genericProjectPageAdapter], deps: site.deps, cache: memoryByteCache() })

  it('a project page with only renders is NO_DRAWINGS, said after the page was inspected', async () => {
    const site = unknownPublisher({ drawings: false })
    const e = await codeOf(runAnalysis({ kind: 'URL', url: PAGE }, options(site)))
    expect(e.code).toBe('NO_DRAWINGS')
    expect(e.failure().stage).toBe('CLASSIFYING_SOURCES')
    expect(site.requests[0]).toBe(PAGE)
  })

  it('a page that is not a house project is SOURCE_NOT_PROJECT, with the evidence that was weighed, and nothing else fetched', async () => {
    const site = unknownPublisher({ project: false })
    const e = await codeOf(runAnalysis({ kind: 'URL', url: PAGE }, options(site)))
    expect(e.code).toBe('SOURCE_NOT_PROJECT')
    expect(e.failure().diagnostics).toMatchObject({ verdict: 'NOT_PROJECT' })
    expect(site.requests).toEqual([PAGE])
  })

  it('a page that needs a browser is SOURCE_REQUIRES_RENDERING, and its scripts are never fetched', async () => {
    const site = unknownPublisher({ shell: true })
    const e = await codeOf(runAnalysis({ kind: 'URL', url: PAGE }, options(site)))
    expect(e.code).toBe('SOURCE_REQUIRES_RENDERING')
    expect(site.requests).toEqual([PAGE])
  })

  it('an unsafe address is SOURCE_UNSAFE before any fetch, whatever the site', async () => {
    const site = unknownPublisher()
    for (const url of [`https://user:pw@${HOST}/oferta/dom-larchfield`, `https://${HOST}:8443/oferta/dom-larchfield`, 'https://10.0.0.5/oferta', 'https://localhost/oferta']) {
      expect((await codeOf(runAnalysis({ kind: 'URL', url }, options(site)))).code).toBe('SOURCE_UNSAFE')
    }
    expect(site.requests).toEqual([])
  })

  it('a specialist keeps its own pages even with the generic reader registered', async () => {
    const run = await runAnalysis({ kind: 'URL', url: specialist.pageUrl('larchfield-lf01') }, { adapters: [specialist.adapter, genericProjectPageAdapter], deps: specialist.deps, cache: memoryByteCache() })
    expect(run.pkg.adapter.id).toBe('synthetic-publisher')
  }, 240_000)
})

/**
 * v3.53: a page the drawings' path refuses, read as a whole. The reader here is a stand-in that answers the two
 * questions the path asks (sort the pictures; describe the house) with a hand-written description of a synthetic
 * house — it tests the path, not a provider.
 */
describe('a refused page is described from its pictures when the host has a house reader (v3.53)', () => {
  const description = JSON.parse(readFileSync(new URL('../../reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>
  const reader = (answer: unknown = description): StructuredVision & { asked: string[] } => {
    const asked: string[] = []
    return {
      asked,
      provider: { id: 'house-reader.test', model: 'none', triageModel: 'none', version: 'test' },
      available: () => true,
      ask: async (request) => {
        asked.push(`${request.purpose}:${request.pictures.length}`)
        // nothing but numbered pictures, the instructions and the published figures reaches a reader
        expect(request.text).not.toContain(HOST)
        const output = request.purpose === 'HOUSE_TRIAGE' ? { pictures: request.pictures.map((p) => ({ picture: p.number, kind: 'EXTERIOR_VIEW', duplicateOf: 0 })) } : answer
        return { output, usage: { latencyMs: 0, model: 'none' } }
      },
    }
  }
  const options = (site: ReturnType<typeof unknownPublisher>) => ({ adapters: [genericProjectPageAdapter], deps: site.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })

  it('without a reader the answer is the drawings path\'s own refusal', async () => {
    const e = await analyseLink({ kind: 'URL', url: PAGE }, options(unknownPublisher({ drawings: false }))).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(AnalysisError)
    expect((e as AnalysisError).code).toBe('NO_DRAWINGS')
  })

  it('with a reader the page yields a described model that says what it is, in the drawings path\'s contract', async () => {
    const r = reader()
    const progress: number[] = []
    const run = await analyseLink({ kind: 'URL', url: PAGE }, { ...options(unknownPublisher({ drawings: false })), houseReader: r, progress: (p) => progress.push(p.progress) })
    expect(run.basis).toBe('DESCRIPTION')
    if (run.basis !== 'DESCRIPTION') return
    expect(run.after?.code).toBe('NO_DRAWINGS')
    expect(r.asked[0]).toMatch(/^HOUSE_TRIAGE:/)
    expect(r.asked[r.asked.length - 1]).toMatch(/^HOUSE_DESCRIPTION:/)
    const codes = run.result.warningDetails.map((w) => w.code)
    expect(codes).toContain('MODEL_FROM_SOURCE_DESCRIPTION')
    expect(run.result.warningDetails.find((w) => w.code === 'MODEL_FROM_SOURCE_DESCRIPTION')?.severity).toBe('LIMITING')
    expect(run.result.vision.mode).toBe('LIVE_PROVIDER')
    expect(run.result.quality.levels.L1 + run.result.quality.levels.L2).toBe(0)
    expect(run.result.assessment.sourceFidelity.status).toBe('UNCHECKED')
    expect(run.result.preview.provisional.map((p) => p.code)).toContain('SCALE_NOT_VERIFIED')
    expect(run.result.counts.masses).toBe(2)
    expect(run.result.counts.openings).toBe(8)
    expect(run.result.sceneSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(compileBuilding(run.result.model).diagnostics.filter((d) => d.severity === 'ERROR')).toEqual([])
    // the overall progress never moves back when the second path starts
    expect(progress.every((v, i) => i === 0 || v >= progress[i - 1])).toBe(true)
    // the same sources and the same answer give the same model, byte for byte
    const again = await analyseLink({ kind: 'URL', url: PAGE }, { ...options(unknownPublisher({ drawings: false })), houseReader: reader() })
    expect(again.basis === 'DESCRIPTION' && again.result.modelSha256).toBe(run.result.modelSha256)
  })

  it('a description that cannot be built leaves the drawings path\'s refusal standing, with the reason attached', async () => {
    const e = await analyseLink({ kind: 'URL', url: PAGE }, { ...options(unknownPublisher({ drawings: false })), houseReader: reader({ ...description, bodies: [] }) }).catch((x: unknown) => x)
    expect((e as AnalysisError).code).toBe('NO_DRAWINGS')
    expect((e as AnalysisError).attachments?.described?.code).toBe('DESCRIPTION_REFUSED')
  })

  it('a page that is not a project is never described', async () => {
    const r = reader()
    const e = await analyseLink({ kind: 'URL', url: PAGE }, { ...options(unknownPublisher({ project: false })), houseReader: r }).catch((x: unknown) => x)
    expect((e as AnalysisError).code).toBe('SOURCE_NOT_PROJECT')
    expect(r.asked).toEqual([])
  })
})

describe('a drawings model with no metric anchor gives way to the description (v3.53)', () => {
  const preview = (codes: string[]) => ({ preview: { provisional: codes.map((code) => ({ code, what: '' })) } }) as never
  it('only when BOTH its scale is unverified and its heights are a convention', () => {
    expect(drawingsModelUnanchored(preview(['SCALE_NOT_VERIFIED', 'HEIGHT_ASSUMED_FOR_PREVIEW']))).toBe(true)
    expect(drawingsModelUnanchored(preview(['SCALE_NOT_VERIFIED']))).toBe(false)
    expect(drawingsModelUnanchored(preview(['HEIGHT_ASSUMED_FOR_PREVIEW']))).toBe(false)
    expect(drawingsModelUnanchored(preview([]))).toBe(false)
  })
})
