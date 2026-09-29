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
import { LARCHFIELD, renderSheets, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { genericProjectPageAdapter, memoryByteCache } from '@buildapp/source-package'
import type { FetchDeps } from '@buildapp/source-package'
import { compileBuilding } from '@buildapp/geometry'
import { AnalysisError, compareSources, comparableOf, comparisonMarkdown, geometryFingerprint, hashesOf, runAnalysis } from '../src/index.js'

const HOST = 'domy.nieznany-wydawca.test'
const PAGE = `https://${HOST}/oferta/dom-larchfield`
const PUBLIC = '93.184.215.14'

/** The specialist's side of the comparison: the same house through the adapter that knows its page. */
const specialist = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })

/**
 * A site with no adapter: the synthetic sheets under its own file names, on a
 * page written the way a small publisher writes one. The captions carry the
 * drawing words; nothing about this markup is shared with any real site.
 */
function unknownPublisher(options: { drawings?: boolean; shell?: boolean; project?: boolean } = {}): { deps: FetchDeps; requests: string[] } {
  const sheets = renderSheets(LARCHFIELD)
  const requests: string[] = []
  const files = new Map<string, Uint8Array>()
  const captions: Record<string, string> = {
    'rzut-parteru': 'Rzut parteru',
    'rzut-pietra': 'Rzut piętra',
    'elewacja-frontowa': 'Elewacja frontowa',
    'elewacja-tylna': 'Elewacja ogrodowa',
    'elewacja-lewa': 'Elewacja boczna',
    'elewacja-prawa': 'Elewacja boczna',
    przekroj: 'Przekrój A-A',
  }
  const pictures: string[] = []
  sheets.forEach((s, i) => {
    const file = `/media/${i + 1}.png`
    files.set(file, s.bytes)
    pictures.push(`<figure><img src="${file}" alt="Dom Larchfield – ${captions[s.slug] ?? s.slug}"><figcaption>${captions[s.slug] ?? s.slug}</figcaption></figure>`)
  })
  const drawings = options.drawings === false ? '' : pictures.join('\n')
  // Renders only where the case is about renders: as pictures they carry the bytes of two
  // sheets, which is fine on a page that publishes no sheet (distinct bytes, distinct assets).
  const renders = options.drawings === false || options.project === false ? `<h2>Wizualizacje</h2><img src="/media/render-1.png" alt="Dom Larchfield – wizualizacja 1"><img src="/media/render-2.png" alt="Dom Larchfield – widok od ogrodu">` : ''
  files.set('/media/render-1.png', sheets[0].bytes)
  files.set('/media/render-2.png', sheets[1].bytes)
  // No figure is printed that the drawings do not state: an invented footprint is exactly what the
  // layout gate refuses, and rightly. The page's words are the title, the roof and the drawings.
  const body = options.project === false
    ? `<h1>Wycieczka do Larchfield</h1><p>Zdjęcia z weekendu.</p>${renders}`
    : `<h1>Dom Larchfield</h1><p>Projekt domu jednorodzinnego.</p><ul><li>Dach: dwuspadowy</li><li>Ściany: murowane</li></ul><h2>Rzuty i elewacje</h2>${drawings}${renders}`
  const html = options.shell
    ? `<!doctype html><html><head><title>Larchfield</title><script src="/app.js"></script></head><body><noscript>Włącz JavaScript.</noscript><div id="root"></div></body></html>`
    : `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Dom Larchfield | Nieznany Wydawca</title></head><body>${body}</body></html>`
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    requests.push(url.toString())
    if (url.hostname !== HOST) return new Response('not found', { status: 404 })
    if (url.pathname === '/oferta/dom-larchfield') return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    const bytes = files.get(url.pathname)
    return bytes ? new Response(Buffer.from(bytes), { status: 200, headers: { 'content-type': 'image/png' } }) : new Response('no', { status: 404 })
  }) as typeof fetch
  const resolve = async (name: string): Promise<string[]> => {
    if (name === HOST) return [PUBLIC]
    throw new Error(`ENOTFOUND ${name}`)
  }
  return { deps: { fetchImpl, resolve }, requests }
}

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
