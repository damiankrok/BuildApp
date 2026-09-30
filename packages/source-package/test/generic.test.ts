/**
 * The generic project-page reader, on pages that exist only in this file.
 *
 * Ten holdout fixtures (BUILDPLAN-INTEGRATION-004A §13), each a page shape a
 * publisher this analyzer has never seen might publish: structured data,
 * plain tables, `<picture>` sources, drawings on linked subpages, galleries
 * mixed with drawings, a missing section, marketing renders only, a page
 * about something else, a CDN redirect and a private redirect. The reader
 * must work from what the markup SAYS, never from a selector copied off a
 * site; the fixtures use no class name the live sites use.
 *
 * Nothing here touches the network: a stub `fetchImpl` serves bytes made in
 * this process, and a stub resolver puts every public name on a public
 * address and every private name on a private one.
 */
import { canonicalJson } from '@buildapp/source-common'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FETCH_POLICY,
  MAX_CRAWL_PAGES,
  SourceAcquisitionError,
  acquireSourcePackage,
  archonAdapter,
  classifyProjectPage,
  genericProjectPageAdapter,
  memoryByteCache,
  readPageFacts,
  registrableDomain,
  routeSourceAcquisition,
  selectedVariant,
  sizeStem,
  type AcquireOptions,
  type AddressResolver,
  type SourcePackage,
} from '../src/index.js'
import { PAGE_URL, forbiddenFetch, jpegBytes, pngBytes, stubFetch, utf8, type StubNet, type StubRoute } from './helpers.js'

const SITE = 'https://domy.przyklad-wydawcy.test'
const PAGE = `${SITE}/projekty/dom-pod-lipa`
const CDN = 'https://cdn.przyklad-wydawcy.test'

/** Public names resolve publicly; `intranet.*` and `*.corp.test` resolve privately. */
const resolver: AddressResolver = async (host) => {
  if (host.startsWith('intranet.') || host.endsWith('.corp.test')) return ['10.0.0.5']
  return ['93.184.216.34']
}

const adapters = [archonAdapter, genericProjectPageAdapter]

const acquire = (net: StubNet, url = PAGE, options: AcquireOptions = {}): Promise<SourcePackage> => acquireSourcePackage(url, adapters, { deps: { fetchImpl: net.fetchImpl, resolve: resolver }, ...options })

const html = (body: string, head = ''): string => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Dom pod Lipą | Przykładowy Wydawca</title>${head}</head><body>${body}</body></html>`

const FACTS_TABLE = `<table><tr><td>Powierzchnia użytkowa</td><td>128,40 m²</td></tr><tr><td>Powierzchnia zabudowy</td><td>164,50 m²</td></tr><tr><td>Wysokość</td><td>6,49 m</td></tr><tr><td>Kubatura</td><td>620,00 m³</td></tr><tr><td>Kąt nachylenia dachu</td><td>35°</td></tr></table>`
const ROOMS_TABLE = `<h3>Zestawienie pomieszczeń</h3><table><tr><th></th><th>PARTER</th><th>Pow. użytkowa</th></tr><tr><td>1.</td><td>Wiatrołap</td><td>4,10</td></tr><tr><td>2.</td><td>Salon</td><td>31,20</td></tr><tr><td>3.</td><td>Kuchnia</td><td>12,00</td></tr><tr><td>4. Sypialnia</td><td>14,30</td></tr></table>`
const SPEC_LIST = `<ul><li>Dach: dwuspadowy, nachylenie 35 st., dachówka</li><li>Ściany: pustak 25 cm, styropian 20 cm</li><li>Strop: żelbetowy</li></ul>`

const img = (src: string, alt: string, extra = ''): string => `<img src="${src}" alt="${alt}" ${extra}>`

const codeOf = async (p: Promise<unknown>): Promise<{ code: string; classification?: unknown }> => {
  try {
    await p
    return { code: 'RESOLVED' }
  } catch (e) {
    expect(e).toBeInstanceOf(SourceAcquisitionError)
    return { code: (e as SourceAcquisitionError).code, classification: (e as SourceAcquisitionError).classification }
  }
}

const documents = (pkg: SourcePackage): string[] => pkg.assets.map((a) => a.roles.document).sort()

// ---------------------------------------------------------------------------

describe('fixture 1 — JSON-LD + OpenGraph project page', () => {
  const routes = (): Record<string, StubRoute> => ({
    [PAGE]: {
      mediaType: 'text/html; charset=utf-8',
      bytes: utf8(
        html(
          `<h1>Projekt domu Dom pod Lipą</h1>${FACTS_TABLE}<figure>${img(`${SITE}/media/plan-parter.png`, 'Rzut parteru')}<figcaption>Rzut parteru</figcaption></figure>${img(`${SITE}/media/front.png`, 'Elewacja frontowa')}${img(`${SITE}/media/przekroj-a-a.png`, 'Przekrój A-A')}`,
          `<meta property="og:title" content="Dom pod Lipą"><meta property="og:type" content="product"><meta property="og:image" content="${SITE}/media/hero.jpg"><link rel="canonical" href="${PAGE}"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Dom pod Lipą","sku":"DPL-2024-07","offers":{"@type":"Offer","price":"2990"}}</script>`,
        ),
      ),
    },
    [`${SITE}/media/plan-parter.png`]: { bytes: pngBytes(900, 700, 1), mediaType: 'image/png' },
    [`${SITE}/media/front.png`]: { bytes: pngBytes(800, 400, 2), mediaType: 'image/png' },
    [`${SITE}/media/przekroj-a-a.png`]: { bytes: pngBytes(700, 500, 3), mediaType: 'image/png' },
    [`${SITE}/media/hero.jpg`]: { bytes: jpegBytes(1200, 800, 4), mediaType: 'image/jpeg' },
  })

  it('is routed to the generic reader with a PROJECT_PAGE verdict carrying its evidence', async () => {
    const seen: string[] = []
    const pkg = await acquire(stubFetch(routes()), PAGE, { onRoute: (r) => seen.push(`${r.kind}:${r.adapter.id}${r.kind === 'GENERIC' ? `:${r.classification.verdict}:${r.classification.evidence.map((e) => e.signal).join('+')}` : ''}`) })
    expect(seen).toEqual(['GENERIC:generic.project-page:PROJECT_PAGE:area+plan-imagery+dimensions+elevation-imagery+json-ld+project-code+roof+section-imagery+title+og:type'])
    expect(pkg.adapter).toEqual({ id: 'generic.project-page', version: '1.1.0' })
  })

  it('takes the project identity from the structured data and the page, and the publisher from the host', async () => {
    const pkg = await acquire(stubFetch(routes()))
    expect(pkg.project).toEqual({ externalId: 'DPL-2024-07', name: 'Dom pod Lipą', publisher: 'domy.przyklad-wydawcy.test' })
    expect(pkg.canonicalUrl).toBe(PAGE)
  })

  it('classifies the drawings by the words around them and the share image as a render', async () => {
    const pkg = await acquire(stubFetch(routes()))
    expect(documents(pkg)).toEqual(['ELEVATION', 'FLOOR_PLAN', 'PERSPECTIVE_RENDER', 'SECTION'])
    const plan = pkg.assets.find((a) => a.roles.document === 'FLOOR_PLAN')!
    expect(plan.roles).toMatchObject({ document: 'FLOOR_PLAN', storey: 'GROUND', projection: 'ORTHOGRAPHIC_PLAN' })
    expect(selectedVariant(plan).decoded).toEqual({ width: 900, height: 700 })
    expect(pkg.assets.find((a) => a.roles.document === 'ELEVATION')!.roles.view).toBe('FRONT')
    expect(pkg.assets.find((a) => a.roles.document === 'SECTION')!.roles.projection).toBe('ORTHOGRAPHIC_SECTION')
  })

  it('reads the published figures and specification lines from a plain table', async () => {
    const pkg = await acquire(stubFetch(routes()))
    expect(pkg.publishedFacts.map((f) => [f.key, f.value, f.unit])).toEqual([
      ['building_height', 6.49, 'm'],
      ['footprint_area', 164.5, 'm2'],
      ['roof_pitch', 35, 'deg'],
      ['usable_area', 128.4, 'm2'],
      ['volume', 620, 'none'],
    ])
  })
})

describe('fixture 2 — plain HTML tables with plan and elevation images', () => {
  const routes = (): Record<string, StubRoute> => ({
    [PAGE]: {
      mediaType: 'text/html',
      bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${ROOMS_TABLE}${SPEC_LIST}<h2>Rzuty</h2>${img(`${SITE}/i/p1.png`, 'rzut parteru z powierzchniami')}${img(`${SITE}/i/p2.png`, 'rzut poddasza')}<h2>Elewacje</h2>${img(`${SITE}/i/e1.png`, 'elewacja frontowa')}${img(`${SITE}/i/e2.png`, 'elewacja ogrodowa')}${img(`${SITE}/i/e3.png`, 'elewacja boczna')}${img(`${SITE}/i/e4.png`, 'elewacja boczna')}`)),
    },
    [`${SITE}/i/p1.png`]: { bytes: pngBytes(600, 600, 11), mediaType: 'image/png' },
    [`${SITE}/i/p2.png`]: { bytes: pngBytes(600, 600, 12), mediaType: 'image/png' },
    [`${SITE}/i/e1.png`]: { bytes: pngBytes(500, 250, 13), mediaType: 'image/png' },
    [`${SITE}/i/e2.png`]: { bytes: pngBytes(500, 250, 14), mediaType: 'image/png' },
    [`${SITE}/i/e3.png`]: { bytes: pngBytes(400, 250, 15), mediaType: 'image/png' },
    [`${SITE}/i/e4.png`]: { bytes: pngBytes(400, 250, 16), mediaType: 'image/png' },
  })

  it('reads two storeys of plans, four elevations with their views, the room schedule and the specifications', async () => {
    const pkg = await acquire(stubFetch(routes()))
    expect(pkg.assets.map((a) => `${a.roles.document}/${a.roles.storey}/${a.roles.view}/${a.roles.annotation}`).sort()).toEqual([
      'ELEVATION/NOT_APPLICABLE/FRONT/UNKNOWN',
      'ELEVATION/NOT_APPLICABLE/REAR/UNKNOWN',
      'ELEVATION/NOT_APPLICABLE/SIDE_UNSPECIFIED/UNKNOWN',
      'ELEVATION/NOT_APPLICABLE/SIDE_UNSPECIFIED/UNKNOWN',
      'FLOOR_PLAN/ATTIC/NOT_APPLICABLE/UNKNOWN',
      'FLOOR_PLAN/GROUND/NOT_APPLICABLE/AREA_TABLE',
    ])
    // rows with the number in its own cell and rows with "4. Sypialnia" in one cell are both read
    expect(pkg.publishedRooms.map((r) => `${r.storey} ${r.index} ${r.label} ${r.area}`)).toEqual(['GROUND 1 Wiatrołap 4.1', 'GROUND 2 Salon 31.2', 'GROUND 3 Kuchnia 12', 'GROUND 4 Sypialnia 14.3'])
    expect(pkg.publishedSpecifications.map((s) => s.key)).toEqual(['floor_structure', 'roof', 'walls'])
    expect(pkg.publishedSpecifications.find((s) => s.key === 'roof')!.text).toBe('dwuspadowy, nachylenie 35 st., dachówka')
    expect(pkg.failures).toEqual([])
  })
})

describe('fixture 3 — <picture> and srcset', () => {
  const routes = (): Record<string, StubRoute> => ({
    [PAGE]: {
      mediaType: 'text/html',
      bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}<picture><source srcset="${CDN}/plan-parter-1600.png 1600w, ${CDN}/plan-parter-800.png 800w"><img src="${CDN}/plan-parter-400.png" srcset="${CDN}/plan-parter-400.png 1x, ${CDN}/plan-parter-800.png 2x" alt="Rzut parteru"></picture>${img(`${CDN}/elewacja.png`, 'Elewacja frontowa')}`)),
    },
    [`${CDN}/plan-parter-1600.png`]: { bytes: pngBytes(1600, 1200, 21), mediaType: 'image/png' },
    [`${CDN}/plan-parter-800.png`]: { bytes: pngBytes(800, 600, 22), mediaType: 'image/png' },
    [`${CDN}/plan-parter-400.png`]: { bytes: pngBytes(400, 300, 23), mediaType: 'image/png' },
    [`${CDN}/elewacja.png`]: { bytes: pngBytes(700, 300, 24), mediaType: 'image/png' },
  })

  it('collects every source as a variant of ONE plan and selects the largest by its decoded pixels', async () => {
    const pkg = await acquire(stubFetch(routes()))
    const plans = pkg.assets.filter((a) => a.roles.document === 'FLOOR_PLAN')
    expect(plans).toHaveLength(1)
    expect(plans[0].variants.map((v) => `${v.decoded.width}x${v.decoded.height}`)).toEqual(['1600x1200', '800x600', '400x300'])
    expect(selectedVariant(plans[0]).url).toBe(`${CDN}/plan-parter-1600.png`)
    expect(plans[0].selectionReason).toMatch(/largest decoded raster/)
  })

  it('groups by the size stem, never by a hostname — and never by a bare number, which may be a drawing’s own id', () => {
    // `-1600` / `-400` are grouped by the <picture> structure above, not by the stem: a
    // publisher that numbers its drawings `__264`, `__265` would otherwise lose a drawing.
    expect(sizeStem(`${CDN}/plan-parter-1600.png`)).not.toBe(sizeStem(`${CDN}/plan-parter-400.png`))
    expect(sizeStem('https://x.test/a/rzut__264.jpg')).not.toBe(sizeStem('https://x.test/a/rzut__265.jpg'))
    expect(sizeStem('https://x.test/a/rzut-parteru__706lo.gif')).toBe(sizeStem('https://x.test/a/rzut-parteru__706.gif'))
    expect(sizeStem('https://x.test/a/plan_thumb.jpg')).toBe(sizeStem('https://x.test/a/plan.jpg'))
    expect(sizeStem('https://x.test/a/plan@2x.png')).toBe(sizeStem('https://x.test/a/plan.png'))
    expect(sizeStem('https://x.test/a/plan.png')).not.toBe(sizeStem('https://x.test/b/plan.png'))
    expect(sizeStem('https://x.test/a/p.png')).toBeUndefined()
  })
})

describe('fixture 4 — drawings on separate linked subpages', () => {
  const routes = (): Record<string, StubRoute> => ({
    [PAGE]: {
      mediaType: 'text/html',
      bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${ROOMS_TABLE}<nav><a href="/projekty/dom-pod-lipa/rzuty">Rzuty</a><a href="/projekty/dom-pod-lipa/elewacje" title="Elewacje">Zobacz</a><a href="/o-nas">O nas</a><a href="https://inna-strona.test/rzuty">Rzuty u kogoś innego</a></nav>${img(`${SITE}/i/hero.jpg`, 'Dom pod Lipą – wizualizacja')}`)),
    },
    [`${PAGE}/rzuty`]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Rzuty – Dom pod Lipą</h1>${img(`${SITE}/i/plan-0.png`, 'Rzut parteru')}${img(`${SITE}/i/plan-1.png`, 'Rzut piętra')}`)) },
    [`${PAGE}/elewacje`]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Elewacje</h1>${img(`${SITE}/i/el-front.png`, 'Elewacja frontowa')}${img(`${SITE}/i/el-rear.png`, 'Elewacja tylna')}`)) },
    [`${SITE}/o-nas`]: { mediaType: 'text/html', bytes: utf8(html(`<h1>O nas</h1>${img(`${SITE}/i/team.jpg`, 'Zespół')}`)) },
    ['https://inna-strona.test/rzuty']: { mediaType: 'text/html', bytes: utf8(html(`<h1>Rzuty</h1>${img('https://inna-strona.test/plan.png', 'Rzut parteru')}`)) },
    [`${SITE}/i/hero.jpg`]: { bytes: jpegBytes(1000, 700, 31), mediaType: 'image/jpeg' },
    [`${SITE}/i/plan-0.png`]: { bytes: pngBytes(800, 800, 32), mediaType: 'image/png' },
    [`${SITE}/i/plan-1.png`]: { bytes: pngBytes(800, 800, 33), mediaType: 'image/png' },
    [`${SITE}/i/el-front.png`]: { bytes: pngBytes(800, 400, 34), mediaType: 'image/png' },
    [`${SITE}/i/el-rear.png`]: { bytes: pngBytes(800, 400, 35), mediaType: 'image/png' },
  })

  it('follows the same-site links that promise drawings, and only those, one level deep', async () => {
    const net = stubFetch(routes())
    const pkg = await acquire(net)
    expect(documents(pkg)).toEqual(['ELEVATION', 'ELEVATION', 'FLOOR_PLAN', 'FLOOR_PLAN', 'PERSPECTIVE_RENDER'])
    expect(pkg.assets.find((a) => a.roles.storey === 'UPPER')).toBeDefined()
    const fetched = net.calls.map((c) => c.url)
    expect(fetched).toContain(`${PAGE}/rzuty`)
    expect(fetched).toContain(`${PAGE}/elewacje`)
    expect(fetched).not.toContain(`${SITE}/o-nas`)
    expect(fetched).not.toContain('https://inna-strona.test/rzuty')
    expect(fetched).not.toContain('https://inna-strona.test/plan.png')
    // the subpage is recorded as where the drawing was found
    expect(selectedVariant(pkg.assets.find((a) => a.roles.storey === 'GROUND')!).discoveredVia).toContain(`@${PAGE}/rzuty`)
  })
})

describe('fixture 5 — a decorative gallery mixed with technical drawings', () => {
  const routes = (): Record<string, StubRoute> => ({
    [PAGE]: {
      mediaType: 'text/html',
      bytes: utf8(
        html(
          `<header><a href="/">${img(`${SITE}/assets/logo.png`, 'Przykładowy Wydawca')}</a></header><h1>Dom pod Lipą</h1>${FACTS_TABLE}<h2>Galeria</h2>${img(`${SITE}/g/salon.jpg`, 'Salon – aranżacja')}${img(`${SITE}/g/kuchnia.jpg`, 'Kuchnia – inspiracja')}${img(`${SITE}/g/ogrod.jpg`, 'Ogród wieczorem')}<h2>Rysunki techniczne</h2>${img(`${SITE}/d/rzut.png`, 'Rzut parteru')}${img(`${SITE}/d/elewacja.png`, 'Elewacja frontowa')}<h2>Podobne projekty</h2><a href="/projekty/dom-pod-brzoza">${img(`${SITE}/t/brzoza.jpg`, 'Dom pod Brzozą')}</a><a href="/projekty/dom-pod-debem">${img(`${SITE}/t/dab.jpg`, 'Dom pod Dębem')}</a><footer>${img(`${SITE}/assets/payment-visa.png`, 'Visa')}</footer>`,
        ),
      ),
    },
    [`${SITE}/g/salon.jpg`]: { bytes: jpegBytes(900, 600, 41), mediaType: 'image/jpeg' },
    [`${SITE}/g/kuchnia.jpg`]: { bytes: jpegBytes(900, 600, 42), mediaType: 'image/jpeg' },
    [`${SITE}/g/ogrod.jpg`]: { bytes: jpegBytes(900, 600, 43), mediaType: 'image/jpeg' },
    [`${SITE}/d/rzut.png`]: { bytes: pngBytes(900, 900, 44), mediaType: 'image/png' },
    [`${SITE}/d/elewacja.png`]: { bytes: pngBytes(900, 450, 45), mediaType: 'image/png' },
    [`${SITE}/t/brzoza.jpg`]: { bytes: jpegBytes(300, 200, 46), mediaType: 'image/jpeg' },
    [`${SITE}/t/dab.jpg`]: { bytes: jpegBytes(300, 200, 47), mediaType: 'image/jpeg' },
    [`${SITE}/assets/logo.png`]: { bytes: pngBytes(200, 60, 48), mediaType: 'image/png' },
    [`${SITE}/assets/payment-visa.png`]: { bytes: pngBytes(60, 40, 49), mediaType: 'image/png' },
  })

  it('keeps the drawings, keeps the gallery as UNKNOWN pictures, and never fetches chrome or the tiles of other projects', async () => {
    const net = stubFetch(routes())
    const pkg = await acquire(net)
    expect(documents(pkg)).toEqual(['ELEVATION', 'FLOOR_PLAN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN'])
    const fetched = net.calls.map((c) => c.url)
    for (const chrome of [`${SITE}/assets/logo.png`, `${SITE}/assets/payment-visa.png`, `${SITE}/t/brzoza.jpg`, `${SITE}/t/dab.jpg`]) expect(fetched).not.toContain(chrome)
    // the gallery pictures are not drawings, and are not pretended to be
    for (const a of pkg.assets.filter((x) => x.roles.document === 'UNKNOWN')) expect(a.roles.projection).toBe('UNKNOWN')
  })
})

describe('fixture 6 — a missing section', () => {
  it('seals a package with plans and elevations and no SECTION, and says nothing about one', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}${img(`${SITE}/i/elewacja-ogrodowa.png`, 'Elewacja ogrodowa')}`)) },
      [`${SITE}/i/rzut-parteru.png`]: { bytes: pngBytes(800, 800, 51), mediaType: 'image/png' },
      [`${SITE}/i/elewacja-frontowa.png`]: { bytes: pngBytes(800, 400, 52), mediaType: 'image/png' },
      [`${SITE}/i/elewacja-ogrodowa.png`]: { bytes: pngBytes(800, 400, 53), mediaType: 'image/png' },
    }
    const pkg = await acquire(stubFetch(routes))
    expect(documents(pkg)).toEqual(['ELEVATION', 'ELEVATION', 'FLOOR_PLAN'])
    expect(pkg.assets.some((a) => a.roles.document === 'SECTION')).toBe(false)
  })
})

describe('fixture 7 — only marketing renders, no plans', () => {
  it('is a project page (name, figures, renders) whose package has no drawing at all — the pipeline, not the reader, says so', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${SPEC_LIST}${img(`${SITE}/r/1.jpg`, 'Dom pod Lipą – wizualizacja 1')}${img(`${SITE}/r/2.jpg`, 'Dom pod Lipą – wizualizacja 2')}${img(`${SITE}/r/3.jpg`, 'Widok od ogrodu')}`)) },
      [`${SITE}/r/1.jpg`]: { bytes: jpegBytes(1200, 800, 61), mediaType: 'image/jpeg' },
      [`${SITE}/r/2.jpg`]: { bytes: jpegBytes(1200, 800, 62), mediaType: 'image/jpeg' },
      [`${SITE}/r/3.jpg`]: { bytes: jpegBytes(1200, 800, 63), mediaType: 'image/jpeg' },
    }
    const pkg = await acquire(stubFetch(routes))
    expect(documents(pkg)).toEqual(['PERSPECTIVE_RENDER', 'PERSPECTIVE_RENDER', 'PERSPECTIVE_RENDER'])
    expect(pkg.publishedFacts.length).toBeGreaterThan(2)
  })
})

describe('fixture 8 — a page about something else, with many pictures', () => {
  it('is refused as SOURCE_NOT_PROJECT after the page alone was fetched, with the evidence that was weighed', async () => {
    const pictures = Array.from({ length: 12 }, (_, i) => img(`${SITE}/blog/zdjecie-${i}.jpg`, `Zdjęcie ${i} z wycieczki`)).join('')
    const routes: Record<string, StubRoute> = {
      [`${SITE}/blog/wycieczka`]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Wycieczka w góry — nasz dom na weekend</h1><p>Zdjęcia z wyjazdu, plan trasy i kilka słów o pogodzie.</p>${pictures}`)) },
    }
    const net = stubFetch(routes)
    const refused = await codeOf(acquire(net, `${SITE}/blog/wycieczka`))
    expect(refused.code).toBe('SOURCE_NOT_PROJECT')
    expect((refused.classification as { verdict: string }).verdict).toBe('NOT_PROJECT')
    expect(net.calls.map((c) => c.url)).toEqual([`${SITE}/blog/wycieczka`])
  })

  it('one weak keyword is not a house: a title with "dom" and nothing else scores below the threshold', () => {
    const facts = readPageFacts(html('<h1>Dom kultury zaprasza</h1><p>Koncert w sobotę.</p>'), `${SITE}/x`)
    const c = classifyProjectPage(facts)
    expect(c.verdict).toBe('NOT_PROJECT')
    expect(c.evidence[0].detail).toMatch(/needs at least/)
  })
})

describe('fixture 9 — a drawing that redirects to a CDN', () => {
  it('follows the redirect under the same policy and keeps the address the page named', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}`)) },
      [`${SITE}/i/rzut-parteru.png`]: { status: 302, location: `${CDN}/x/rzut-parteru.png` },
      [`${CDN}/x/rzut-parteru.png`]: { bytes: pngBytes(1000, 1000, 71), mediaType: 'image/png' },
      [`${SITE}/i/elewacja-frontowa.png`]: { bytes: pngBytes(800, 400, 72), mediaType: 'image/png' },
    }
    const net = stubFetch(routes)
    const pkg = await acquire(net)
    const plan = pkg.assets.find((a) => a.roles.document === 'FLOOR_PLAN')!
    expect(selectedVariant(plan).decoded).toEqual({ width: 1000, height: 1000 })
    expect(net.calls.map((c) => c.url)).toContain(`${CDN}/x/rzut-parteru.png`)
    expect(pkg.failures).toEqual([])
  })
})

describe('fixture 10 — an unsafe redirect', () => {
  it('refuses the hop into a private network, records it, and seals the rest', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}`)) },
      [`${SITE}/i/rzut-parteru.png`]: { status: 302, location: 'https://intranet.przyklad-wydawcy.test/rzut-parteru.png' },
      ['https://intranet.przyklad-wydawcy.test/rzut-parteru.png']: { bytes: pngBytes(1000, 1000, 81), mediaType: 'image/png' },
      [`${SITE}/i/elewacja-frontowa.png`]: { bytes: pngBytes(800, 400, 82), mediaType: 'image/png' },
    }
    const net = stubFetch(routes)
    const pkg = await acquire(net)
    expect(documents(pkg)).toEqual(['ELEVATION'])
    expect(pkg.failures).toEqual([
      {
        stage: 'ASSET_FETCH',
        target: `${SITE}/i/rzut-parteru.png`,
        code: 'HOST_BLOCKED',
        message: expect.stringMatching(/not publicly routable/),
        // the loss says what was lost: an exposed floor plan, not a guessed copy
        claim: expect.objectContaining({ document: 'FLOOR_PLAN' }),
      },
    ])
    expect(net.calls.map((c) => c.url)).not.toContain('https://intranet.przyklad-wydawcy.test/rzut-parteru.png')
  })

  it('a redirect to a non-default port is refused on the hop too', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}`)) },
      [`${SITE}/i/rzut-parteru.png`]: { status: 302, location: `${SITE}:8443/i/rzut-parteru.png` },
      [`${SITE}:8443/i/rzut-parteru.png`]: { bytes: pngBytes(1000, 1000, 83), mediaType: 'image/png' },
    }
    const net = stubFetch(routes)
    const pkg = await acquire(net)
    expect(pkg.failures.map((f) => f.code)).toEqual(['PORT_NOT_ALLOWED'])
    expect(net.calls.map((c) => c.url)).not.toContain(`${SITE}:8443/i/rzut-parteru.png`)
  })
})

describe('a page that needs a browser', () => {
  it('is SOURCE_REQUIRES_RENDERING, not "unsupported publisher" and not "not a project"', async () => {
    const shell = `<!doctype html><html><head><title>Projekty domów</title><script src="/app.js"></script></head><body><noscript>Włącz JavaScript, aby zobaczyć projekt.</noscript><div id="root"></div></body></html>`
    const net = stubFetch({ [`${SITE}/app/projekt/123`]: { mediaType: 'text/html', bytes: utf8(shell) } })
    const refused = await codeOf(acquire(net, `${SITE}/app/projekt/123`))
    expect(refused.code).toBe('SOURCE_REQUIRES_RENDERING')
    expect(net.calls).toHaveLength(1)
    expect(net.calls[0].url).not.toMatch(/app\.js/)
  })
})

// ---------------------------------------------------------------------------

describe('ordering without ICU (INTEGRATION-004A, cycle 2)', () => {
  const PAGE_W = `${SITE}/projekty/wrzosowa-3`
  const routesW = (): Record<string, StubRoute> => ({
    [PAGE_W]: {
      mediaType: 'text/html; charset=utf-8',
      bytes: utf8(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Projekt domu „Wrzosowa 3” – dane projektu</title>
      <meta name="description" content="Dom parterowy z poddaszem… „przytulny” i ‘jasny’, projekt nr WRZ-3"><meta property="og:title" content="Projekt domu „Wrzosowa 3”"></head><body>
      <h1>Projekt domu „Wrzosowa 3”</h1>
      <table><tr><td>Powierzchnia użytkowa</td><td>118,40 m²</td></tr><tr><td>Powierzchnia zabudowy</td><td>132,10 m²</td></tr>
      <tr><td>Wysokość budynku</td><td>8,10 m</td></tr><tr><td>Kąt nachylenia dachu</td><td>35°</td></tr></table>
      <ul><li>Dach: dwuspadowy… „prosty”</li><li>Ściany: pustak 25 cm</li></ul>
      <h2>Rzuty</h2><figure>${img(`${SITE}/media/rzut-parteru.png`, 'Rzut parteru… „skala 1:100”')}<figcaption>Rzut parteru — „strefa dzienna”</figcaption></figure>
      <figure>${img(`${SITE}/media/rzut-poddasza.png`, 'Rzut poddasza')}<figcaption>Rzut poddasza ‘sypialnie’</figcaption></figure>
      <h2>Elewacje</h2>${img(`${SITE}/media/elewacja-frontowa.png`, 'Elewacja frontowa…')}${img(`${SITE}/media/przekroj-a-a.png`, 'Przekrój A–A')}
      <h3>Zestawienie pomieszczeń</h3><table><tr><th></th><th>PARTER</th><th>Pow.</th></tr><tr><td>1.</td><td>Wiatrołap…</td><td>4,20</td></tr><tr><td>2.</td><td>Salon „duży”</td><td>28,50</td></tr></table>
      </body></html>`),
    },
    [`${SITE}/media/rzut-parteru.png`]: { bytes: pngBytes(900, 700, 11), mediaType: 'image/png' },
    [`${SITE}/media/rzut-poddasza.png`]: { bytes: pngBytes(900, 700, 12), mediaType: 'image/png' },
    [`${SITE}/media/elewacja-frontowa.png`]: { bytes: pngBytes(800, 400, 13), mediaType: 'image/png' },
    [`${SITE}/media/przekroj-a-a.png`]: { bytes: pngBytes(700, 500, 14), mediaType: 'image/png' },
  })

  it('reads a page whose text carries an ellipsis, low-9 quotes and curly quotes with localeCompare forbidden — as the phone must', async () => {
    const original = String.prototype.localeCompare
    // The phone's runtime has no ICU; its replacement (apps/local-analyzer/src/text.ts) orders Latin text
    // and ASCII punctuation as ICU does and REFUSES anything outside that repertoire — an ellipsis, curly
    // or low-9 quotes. Model that: addresses and ids may still be ordered, page prose may not.
    const outside = /[\u2018-\u201F\u2026]|[^\u0000-\u02FF]/
    // eslint-disable-next-line no-extend-native
    String.prototype.localeCompare = function (this: string, other: string) {
      if (outside.test(this) || outside.test(other)) throw new Error(`localeCompare refused on this runtime: ${JSON.stringify(this)} vs ${JSON.stringify(other)}`)
      return original.call(this, other)
    }
    try {
      const pkg = await acquire(stubFetch(routesW()), PAGE_W)
      expect(pkg.adapter.id).toBe('generic.project-page')
      expect(documents(pkg)).toEqual(['ELEVATION', 'FLOOR_PLAN', 'FLOOR_PLAN', 'SECTION'])
      expect(pkg.publishedFacts.find((f) => f.key === 'usable_area')?.value).toBe(118.4)
      expect(pkg.publishedFacts.find((f) => f.key === 'building_height')?.value).toBe(8.1)
      expect(pkg.publishedRooms.map((r) => r.label)).toEqual(['Wiatrołap…', 'Salon „duży”'])
      expect(pkg.failures.filter((f) => f.code === 'ADAPTER_ERROR')).toEqual([])
    } finally {
      String.prototype.localeCompare = original
    }
  })

  const PAGE_M = `${SITE}/projekty/modrzewiowy-2`
  const routesM = (): Record<string, StubRoute> => ({
    [PAGE_M]: {
      mediaType: 'text/html; charset=utf-8',
      bytes: utf8(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Projekt domu Modrzewiowy 2</title></head><body><h1>Projekt domu Modrzewiowy 2</h1>
      <table><tr><td>Powierzchnia użytkowa</td><td>101,20 m²</td></tr><tr><td>Powierzchnia zabudowy</td><td>120,00 m²</td></tr>
      <tr><td>Wysokość ścianki kolankowej</td><td>0,90 m</td></tr><tr><td>Wysokość pomieszczeń</td><td>2,70 m</td></tr>
      <tr><td>Wysokość całkowita</td><td>8,27 m</td></tr><tr><td>Powierzchnia całkowita</td><td>171,00 m²</td></tr><tr><td>Kąt nachylenia dachu</td><td>40°</td></tr></table>
      <h2>Rysunki</h2>${img(`${SITE}/media/plan-zagospodarowania.png`, 'Plan zagospodarowania działki')}${img(`${SITE}/media/rzut-parteru-m.png`, 'Rzut parteru')}
      ${img(`${SITE}/media/elewacja-prawa.png`, 'Elewacja prawa, prawie gotowa')}${img(`${SITE}/media/przekroj-m.png`, 'Przekrój')}</body></html>`),
    },
    [`${SITE}/media/plan-zagospodarowania.png`]: { bytes: pngBytes(800, 800, 21), mediaType: 'image/png' },
    [`${SITE}/media/rzut-parteru-m.png`]: { bytes: pngBytes(900, 700, 22), mediaType: 'image/png' },
    [`${SITE}/media/elewacja-prawa.png`]: { bytes: pngBytes(800, 400, 23), mediaType: 'image/png' },
    [`${SITE}/media/przekroj-m.png`]: { bytes: pngBytes(700, 500, 24), mediaType: 'image/png' },
  })

  it('does not key a knee wall or a room height as the building height, nor a site plan as a floor plan', async () => {
    const pkg = await acquire(stubFetch(routesM()), PAGE_M)
    const fact = (key: string) => pkg.publishedFacts.find((f) => f.key === key)?.value
    expect(fact('building_height')).toBe(8.27)
    expect(fact('total_area')).toBe(171)
    expect(pkg.publishedFacts.filter((f) => f.value === 0.9 || f.value === 2.7)).toEqual([])
    const byName = (stem: string) => pkg.assets.find((a) => a.variants.some((v) => v.url.includes(stem)))
    expect(byName('plan-zagospodarowania')?.roles.document).toBe('SITE_PLAN')
    expect(byName('rzut-parteru-m')?.roles.document).toBe('FLOOR_PLAN')
    expect(byName('elewacja-prawa')?.roles.view).toBe('SIDE_RIGHT')
  })
})

describe('determinism', () => {
  const routes = (): Record<string, StubRoute> => ({
    [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${ROOMS_TABLE}${SPEC_LIST}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}${img(`${SITE}/i/przekroj.png`, 'Przekrój')}`)) },
    [`${SITE}/i/rzut-parteru.png`]: { bytes: pngBytes(800, 800, 91), mediaType: 'image/png' },
    [`${SITE}/i/elewacja-frontowa.png`]: { bytes: pngBytes(800, 400, 92), mediaType: 'image/png' },
    [`${SITE}/i/przekroj.png`]: { bytes: pngBytes(600, 400, 93), mediaType: 'image/png' },
  })

  it('the same bytes seal the same package, byte for byte, every time', async () => {
    const a = await acquire(stubFetch(routes()))
    const b = await acquire(stubFetch(routes()))
    expect(canonicalJson(a)).toBe(canonicalJson(b))
  })

  it('replays offline from a byte cache with no network, to the same package', async () => {
    const cache = memoryByteCache()
    const live = await acquire(stubFetch(routes()), PAGE, { cache })
    const replayed = await acquireSourcePackage(PAGE, adapters, { cache, offline: true, deps: { fetchImpl: forbiddenFetch, resolve: resolver } })
    expect(replayed.contentHash).toBe(live.contentHash)
    expect(canonicalJson(replayed)).toBe(canonicalJson(live))
  })

  it('discovery order does not depend on markup order', async () => {
    const swapped: Record<string, StubRoute> = { ...routes(), [PAGE]: { mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${img(`${SITE}/i/przekroj.png`, 'Przekrój')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${SPEC_LIST}${ROOMS_TABLE}${FACTS_TABLE}`)) } }
    const a = await acquire(stubFetch(routes()))
    const b = await acquire(stubFetch(swapped))
    expect(a.assets.map((x) => `${x.roles.document}:${selectedVariant(x).byteHash}`)).toEqual(b.assets.map((x) => `${x.roles.document}:${selectedVariant(x).byteHash}`))
    expect(a.publishedFacts).toEqual(b.publishedFacts)
    expect(a.publishedRooms).toEqual(b.publishedRooms)
  })
})

// ---------------------------------------------------------------------------

describe('security — flexibility never reduces it', () => {
  const page = (body: string): StubRoute => ({ mediaType: 'text/html', bytes: utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${body}`)) })

  it('the crawl is bounded: at most MAX_CRAWL_PAGES linked pages, in a deterministic order', async () => {
    const links = Array.from({ length: 10 }, (_, i) => `<a href="/projekty/dom-pod-lipa/rzuty-${i}">Rzuty ${i}</a>`).join('')
    const routes: Record<string, StubRoute> = { [PAGE]: page(links) }
    for (let i = 0; i < 10; i++) routes[`${PAGE}/rzuty-${i}`] = { mediaType: 'text/html', bytes: utf8(html(`<h1>Rzuty ${i}</h1>`)) }
    const net = stubFetch(routes)
    await acquire(net)
    const followed = net.calls.map((c) => c.url).filter((u) => u.includes('/rzuty-'))
    expect(followed).toHaveLength(MAX_CRAWL_PAGES)
    expect(followed).toEqual([...followed].sort())
  })

  it('the crawl cannot jump to an unrelated site, however the link is worded', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: page(`<a href="https://rzuty-domow.test/dom-pod-lipa/rzuty">Rzuty, elewacje, przekroje i rysunki techniczne</a><a href="https://przyklad-wydawcy.test.evil.example/rzuty">Rzuty</a>`),
      ['https://rzuty-domow.test/dom-pod-lipa/rzuty']: { mediaType: 'text/html', bytes: utf8(html(`<h1>Rzuty</h1>${img('https://rzuty-domow.test/plan.png', 'Rzut parteru')}`)) },
      ['https://przyklad-wydawcy.test.evil.example/rzuty']: { mediaType: 'text/html', bytes: utf8(html(`<h1>Rzuty</h1>`)) },
    }
    const net = stubFetch(routes)
    await acquire(net)
    expect(net.calls.map((c) => c.url)).toEqual([PAGE])
  })

  it('a crawl link with credentials, on a port or into a private name is refused before any request', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: page(`<a href="https://user:pw@domy.przyklad-wydawcy.test/projekty/dom-pod-lipa/rzuty">Rzuty</a><a href="${SITE}:8443/projekty/dom-pod-lipa/elewacje">Elewacje</a><a href="https://intranet.przyklad-wydawcy.test/projekty/dom-pod-lipa/przekroje">Przekroje</a>`),
    }
    const net = stubFetch(routes)
    const pkg = await acquire(net)
    expect(net.calls.map((c) => c.url)).toEqual([PAGE])
    expect(pkg.failures.map((f) => f.code).sort()).toEqual(['HOST_BLOCKED', 'PORT_NOT_ALLOWED', 'URL_HAS_CREDENTIALS'])
  })

  it('oversized HTML is refused as the page, and an oversized asset is refused as a failure', async () => {
    const policy = { ...DEFAULT_FETCH_POLICY, maxBytes: 4000 }
    const big = utf8(html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${'<p>lorem ipsum dolor sit amet</p>'.repeat(200)}`))
    expect(big.byteLength).toBeGreaterThan(4000)
    const refused = await codeOf(acquire(stubFetch({ [PAGE]: { mediaType: 'text/html', bytes: big } }), PAGE, { policy }))
    expect(refused.code).toBe('PAGE_NOT_FETCHED')

    const routes: Record<string, StubRoute> = {
      [PAGE]: page(`${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}`),
      [`${SITE}/i/rzut-parteru.png`]: { bytes: pngBytes(1200, 1200, 101), mediaType: 'image/png' },
      [`${SITE}/i/elewacja-frontowa.png`]: { bytes: pngBytes(60, 30, 102), mediaType: 'image/png' },
    }
    const pkg = await acquire(stubFetch(routes), PAGE, { policy: { ...DEFAULT_FETCH_POLICY, maxBytes: 20_000 } })
    expect(pkg.failures.map((f) => [f.target, f.code])).toEqual([[`${SITE}/i/rzut-parteru.png`, 'TOO_LARGE']])
    expect(documents(pkg)).toEqual(['ELEVATION'])
  })

  it('a wrong media type is refused: a page served as an image, an asset served as HTML', async () => {
    const asImage = await codeOf(acquire(stubFetch({ [PAGE]: { mediaType: 'application/octet-stream', bytes: pngBytes(10, 10) } })))
    expect(asImage.code).toBe('PAGE_NOT_FETCHED')
    const routes: Record<string, StubRoute> = {
      [PAGE]: page(`${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}${img(`${SITE}/i/elewacja-frontowa.png`, 'Elewacja frontowa')}`),
      [`${SITE}/i/rzut-parteru.png`]: { bytes: utf8('<html>not an image</html>'), mediaType: 'text/html' },
      [`${SITE}/i/elewacja-frontowa.png`]: { bytes: pngBytes(800, 400, 111), mediaType: 'image/png' },
    }
    const pkg = await acquire(stubFetch(routes))
    expect(pkg.failures.map((f) => f.code)).toEqual(['UNSUPPORTED_FORMAT'])
    expect(documents(pkg)).toEqual(['ELEVATION'])
  })

  it('scripts are data: JSON-LD is parsed, a script that would throw is never run, and no script address is fetched', async () => {
    const routes: Record<string, StubRoute> = {
      [PAGE]: {
        mediaType: 'text/html',
        bytes: utf8(
          html(
            `<h1>Dom pod Lipą</h1>${FACTS_TABLE}${img(`${SITE}/i/rzut-parteru.png`, 'Rzut parteru')}<script>throw new Error("executed"); document.body.innerHTML = "<img src=\\"${SITE}/i/injected.png\\" alt=\\"Rzut parteru\\">"</script>`,
            `<script type="application/ld+json">{"@type":"Product","sku":"X-1"}</script><script src="${SITE}/app.js"></script>`,
          ),
        ),
      },
      [`${SITE}/i/rzut-parteru.png`]: { bytes: pngBytes(800, 800, 121), mediaType: 'image/png' },
      [`${SITE}/i/injected.png`]: { bytes: pngBytes(800, 800, 122), mediaType: 'image/png' },
      [`${SITE}/app.js`]: { bytes: utf8('throw 1'), mediaType: 'text/javascript' },
    }
    const net = stubFetch(routes)
    const pkg = await acquire(net)
    expect(pkg.project.externalId).toBe('X-1')
    expect(net.calls.map((c) => c.url).sort()).toEqual([PAGE, `${SITE}/i/rzut-parteru.png`].sort())
  })

  it('registrable domains: subdomains of one site are one site; a lookalike is not', () => {
    expect(registrableDomain('www.przyklad.pl')).toBe('przyklad.pl')
    expect(registrableDomain('cdn.assets.przyklad.pl')).toBe('przyklad.pl')
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk')
    expect(registrableDomain('przyklad.pl.evil.example')).toBe('evil.example')
  })
})

// ---------------------------------------------------------------------------

describe('the router', () => {
  const ctx = (url: string, markup: string) => ({ url, html: markup, fetchText: async () => null })

  it('prefers the specialist for an address it recognises, even with the generic reader registered', () => {
    const route = routeSourceAcquisition(ctx(PAGE_URL, html('<h1>Dom</h1>')), adapters)
    expect(route.kind).toBe('SPECIALIST')
    expect(route.kind === 'SPECIALIST' && route.adapter.id).toBe('archon.pl')
  })

  it('asks the generic reader about an unknown host, and reports its verdict', () => {
    const route = routeSourceAcquisition(ctx(PAGE, html(`<h1>Dom pod Lipą</h1>${FACTS_TABLE}${img(`${SITE}/i/rzut.png`, 'Rzut parteru')}`)), adapters)
    expect(route.kind).toBe('GENERIC')
    const refused = routeSourceAcquisition(ctx(PAGE, html('<h1>Sklep</h1>')), adapters)
    expect(refused.kind).toBe('UNSUPPORTED_CONTENT')
    expect(refused.kind === 'UNSUPPORTED_CONTENT' && refused.code).toBe('SOURCE_NOT_PROJECT')
  })

  it('with specialists only, an unknown host has no adapter — and says so as NO_ADAPTER, never as a project verdict', () => {
    expect(routeSourceAcquisition(ctx(PAGE, html('<h1>Dom pod Lipą</h1>')), [archonAdapter]).kind).toBe('NO_ADAPTER')
  })

  it('the generic reader mentions no publisher: an unknown host and a known one get the same reading rules', () => {
    // The specialist is chosen by URL; the generic reader has no `matches` beyond "https with a host".
    expect(genericProjectPageAdapter.matches(new URL('https://anything.example/x'))).toBe(true)
    expect(genericProjectPageAdapter.matches(new URL('http://anything.example/x'))).toBe(false)
    expect(genericProjectPageAdapter.strategy).toBe('GENERIC')
    expect(genericProjectPageAdapter.resolutionCandidates('https://anything.example/x__264.jpg')).toEqual([])
  })
})
