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
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { parseModel } from '@buildapp/model'
import { checkHouseDescription } from '@buildapp/source-vision'
import { reconstructFromHouseDescription } from '@buildapp/reconstruction'
import { readFileSync } from 'node:fs'
import type { StructuredVision } from '@buildapp/source-vision'
import { AnalysisError, analyseLink, identityOf, anchorsOfDrawings, describedFollowUp, drawingsModelUnanchored, drawingsWeaknesses, runDescribedAnalysis, compareSources, comparableOf, comparisonMarkdown, geometryFingerprint, hashesOf, runAnalysis } from '../src/index.js'

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

describe('after a drawings model: the description only where the model is weak by its own account (v3.53.1)', () => {
  const summary = (codes: string[], over: { outcome?: string; roofs?: number; walls?: number; warnings?: string[] } = {}) =>
    ({ preview: { outcome: over.outcome ?? 'COMPLETE', built: { walls: over.walls ?? 12, roofs: over.roofs ?? 1 }, provisional: codes.map((code) => ({ code, what: '' })) }, warningDetails: (over.warnings ?? []).map((code) => ({ code, severity: 'LIMITING', message: '' })) }) as never

  it('no anchor at all is a weakness only when BOTH the scale is unverified and the heights are a convention', () => {
    expect(drawingsModelUnanchored(summary(['SCALE_NOT_VERIFIED', 'HEIGHT_ASSUMED_FOR_PREVIEW']))).toBe(true)
    expect(drawingsModelUnanchored(summary(['SCALE_NOT_VERIFIED']))).toBe(false)
    expect(drawingsWeaknesses(summary(['HEIGHT_ASSUMED_FOR_PREVIEW']))).toEqual([])
    expect(drawingsWeaknesses(summary([]))).toEqual([])
  })

  it('an anchor does not confirm the architecture: a verified scale with a lost body, a partial model or no roof is still weak', () => {
    expect(drawingsWeaknesses(summary([], { warnings: ['BODY_MISSING_FROM_MODEL'] }))).toEqual(['BODY_MISSING'])
    expect(drawingsWeaknesses(summary([], { warnings: ['LAYOUT_BLOCKING_UNRESOLVED'] }))).toEqual(['BODY_MISSING'])
    expect(drawingsWeaknesses(summary([], { outcome: 'PARTIAL_3D_PREVIEW' }))).toEqual(['PARTIAL_MODEL'])
    expect(drawingsWeaknesses(summary([], { roofs: 0 }))).toEqual(['NO_ROOF_BUILT'])
    expect(drawingsWeaknesses(summary(['SCALE_NOT_VERIFIED', 'HEIGHT_ASSUMED_FOR_PREVIEW'], { roofs: 0, outcome: 'PARTIAL_3D_PREVIEW' }))).toEqual(['NO_METRIC_ANCHOR', 'PARTIAL_MODEL', 'NO_ROOF_BUILT'])
  })

  const description = JSON.parse(readFileSync(new URL('../../reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>
  const counting = (): StructuredVision & { asked: string[] } => {
    const asked: string[] = []
    return {
      asked,
      provider: { id: 'house-reader.test', model: 'none', triageModel: 'none', version: 'test' },
      available: () => true,
      ask: async (request) => {
        asked.push(request.purpose)
        return { output: request.purpose === 'HOUSE_TRIAGE' ? { pictures: request.pictures.map((p) => ({ picture: p.number, kind: 'ELEVATION', duplicateOf: 0 })) } : description, usage: { latencyMs: 0, model: 'none' } }
      },
    }
  }
  const options = (site: ReturnType<typeof unknownPublisher>) => ({ adapters: [genericProjectPageAdapter], deps: site.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })

  it('a complete, anchored drawings model is the answer and the reader is never asked — and with a correct anchor but no roof, the description is built ON the drawings\' measures', async () => {
    const r = counting()
    const progress: number[] = []
    const cache = memoryByteCache()
    const run = await analyseLink({ kind: 'URL', url: PAGE }, { ...options(unknownPublisher()), cache, houseReader: r, progress: (p) => progress.push(p.progress) })
    expect(run.basis).toBe('DRAWINGS')
    expect(r.asked).toEqual([])
    if (run.basis !== 'DRAWINGS') return
    expect(describedFollowUp(run)).toBeNull()
    // with a reader at hand the drawings' path uses its share of the scale and leaves the rest
    expect(Math.max(...progress)).toBeLessThanOrEqual(0.7)

    // the same run, had it built no roof: its scale and its storey height are still measured, and they are kept
    const anchors = anchorsOfDrawings(run)
    expect(anchors.footprint?.widthM).toBeGreaterThan(5)
    expect(anchors.storeyHeightM?.value).toBeGreaterThan(2.2)
    const roofless = { ...run, result: { ...run.result, preview: { ...run.result.preview, built: { ...run.result.preview.built, roofs: 0 } } } }
    const next = describedFollowUp(roofless)
    expect(next?.after).toEqual({ code: 'DRAWINGS_MODEL_WEAK', reasonCode: 'NO_ROOF_BUILT' })
    expect(next?.anchors).toEqual(anchors)

    // the description of a house of another proportion cannot be forced onto the measured footprint: refused by name
    const events: string[] = []
    const described = await runDescribedAnalysis({ pkg: run.pkg, cache, reader: counting(), identity: identityOf(run.pkg), after: next?.after, anchors: next?.anchors, onDescribing: (e) => events.push(`${e.phase}:${e.pictures.length}`) })
    const codes = described.adjustments.map((a) => a.code)
    expect(codes.includes('SCALED_TO_DRAWINGS_MEASURE') || codes.includes('DRAWINGS_MEASURE_NOT_APPLIED')).toBe(true)
    expect(codes).toContain('HEIGHT_FROM_DRAWINGS_MEASURE')
    expect(described.adjustments.find((a) => a.code === 'HEIGHT_FROM_DRAWINGS_MEASURE')?.why).toContain(`${(anchors.storeyHeightM?.value ?? 0).toFixed(2)} m high`)
    const provisional = described.result.preview.provisional.map((p) => p.code)
    expect(provisional.includes('SCALE_NOT_VERIFIED')).toBe(!codes.includes('SCALED_TO_DRAWINGS_MEASURE'))
    expect(events[0]).toBe('SORTING_PICTURES:0')
    expect(events.some((e) => e.startsWith('DESCRIBING_HOUSE:') && !e.endsWith(':0'))).toBe(true)
    expect(events[events.length - 1]).toMatch(/^BUILDING_MODEL:/)
  })
})

describe('a described house\'s parts meet: the joint audit on the synthetic fixture (v3.53.1)', () => {
  it('a gabled body with a flat-roofed garage, an entrance canopy, a terrace, a balcony, dormers and a chimney compiles with no error and no exterior finding', () => {
    const description = JSON.parse(readFileSync(new URL('../../reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as never
    const checked = checkHouseDescription(description)
    expect(checked.ok).toBe(true)
    if (!checked.ok) return
    const built = reconstructFromHouseDescription(checked.description, 'joints')
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const model = parseModel(built.modelJson)
    const scene = compileBuilding(model)
    expect(scene.diagnostics.filter((d) => d.severity === 'ERROR')).toEqual([])
    const exterior = geometryClosureAudit(model, scene).findings.filter((f) => f.scope === 'EXTERIOR').map((f) => `${f.code} ${f.objects.join(' / ')}`)
    expect(exterior).toEqual([])
  })
})
