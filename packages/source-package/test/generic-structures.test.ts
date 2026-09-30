/**
 * The generic reader on page STRUCTURES it had not met before 005C.
 *
 * One fixture per structure, never per site: a fact list built from blocks
 * instead of a table, a tooltip between a label and its value, an ARIA grid, a
 * card linking to another project, a superscript unit, a download list whose
 * drawing word sits on the parent item, a caption that belongs to one figure,
 * consent prose in a form. The pages exist only in this file; they use no
 * class name or address any live site uses, and no figure of any real house.
 */
import { describe, expect, it } from 'vitest'
import {
  SOURCE_PACKAGE_SCHEMA_VERSION,
  SOURCE_PACKAGE_SCHEMA_VERSION_WITH_DOCUMENTS,
  acquireSourcePackage,
  archonAdapter,
  classifyProjectPage,
  genericProjectPageAdapter,
  readPageFacts,
  sourcePackageContentHash,
  type AddressResolver,
  type SourcePackage,
} from '../src/index.js'
import { genericDocuments } from '../src/adapters/generic/index.js'
import { pngBytes, stubFetch, utf8, type StubRoute } from './helpers.js'

const SITE = 'https://domy.przyklad-wydawcy.test'
const PAGE = `${SITE}/katalog/dom-pod-grabem/`
const resolver: AddressResolver = async () => ['93.184.216.34']
const adapters = [archonAdapter, genericProjectPageAdapter]
const page = (body: string, head = ''): string => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Dom pod Grabem | Przykładowy Wydawca</title>${head}</head><body>${body}</body></html>`
const facts = (html: string) => genericProjectPageAdapter.parsePublished({ url: PAGE, html, fetchText: async () => null }).facts
const factOf = (html: string, key: string) => facts(html).find((f) => f.key === key)
const DRAWINGS = `<h2>Rzuty</h2><img src="${SITE}/m/rzut-parteru.png" alt="Rzut parteru"><h2>Elewacje</h2><img src="${SITE}/m/elewacja-przod.png" alt="Elewacja przód"><img src="${SITE}/m/elewacja-tyl.png" alt="Elewacja tył">`
const drawingRoutes = (): Record<string, StubRoute> => ({
  [`${SITE}/m/rzut-parteru.png`]: { bytes: pngBytes(900, 700, 1), mediaType: 'image/png' },
  [`${SITE}/m/elewacja-przod.png`]: { bytes: pngBytes(800, 400, 2), mediaType: 'image/png' },
  [`${SITE}/m/elewacja-tyl.png`]: { bytes: pngBytes(800, 400, 3), mediaType: 'image/png' },
})
const acquire = (routes: Record<string, StubRoute>): Promise<SourcePackage> => acquireSourcePackage(PAGE, adapters, { deps: { fetchImpl: stubFetch(routes).fetchImpl, resolve: resolver } })

describe('facts printed as blocks, not a table', () => {
  it('a label block and a value block: the value is read, with its unit', () => {
    const f = factOf(page(`<div><div><span>Powierzchnia użytkowa</span></div><div><span>131,70 m²</span></div></div>`), 'usable_area')
    expect(f).toMatchObject({ value: 131.7, unit: 'm2' })
  })

  it('a tooltip between the label and its value is skipped, and stops nothing', () => {
    const html = page(`<div>Powierzchnia zabudowy</div><button aria-label="więcej">?</button><div><h4>Czym jest powierzchnia zabudowy</h4><p>To powierzchnia terenu zajęta przez budynek w stanie wykończonym, liczona po obrysie ścian zewnętrznych.</p><button>zamknij</button></div><div>158,20 m²</div>`)
    expect(factOf(html, 'footprint_area')).toMatchObject({ value: 158.2, unit: 'm2' })
  })

  it('a label and its value inline in one block', () => {
    expect(factOf(page(`<p>Wysokość budynku 7,35 m</p>`), 'building_height')).toMatchObject({ value: 7.35, unit: 'm' })
  })

  it('a superscript unit is m², in a table as in a block (never "m")', () => {
    expect(factOf(page(`<table><tr><td>Powierzchnia zabudowy</td><td>142,60 m<sup>2</sup></td></tr></table>`), 'footprint_area')).toMatchObject({ value: 142.6, unit: 'm2' })
    expect(factOf(page(`<div>Powierzchnia użytkowa</div><div>121,30 m<sup>2</sup></div>`), 'usable_area')).toMatchObject({ value: 121.3, unit: 'm2' })
  })

  it('a qualified roof area is its own figure, and neither part is the roof area', () => {
    const f = facts(page(`<div>Powierzchnia dachu skośnego</div><div>201,40 m²</div><div>Powierzchnia dachu płaskiego</div><div>18,60 m²</div>`))
    expect(f.find((x) => x.key === 'sloped_roof_area')?.value).toBe(201.4)
    expect(f.find((x) => x.key === 'flat_roof_area')?.value).toBe(18.6)
    expect(f.find((x) => x.key === 'roof_area')).toBeUndefined()
  })

  it('counts are whole numbers, as the publisher counts them', () => {
    const f = facts(page(`<div>Liczba pokoi</div><div>5</div><div>Liczba łazienek</div><div>2</div>`))
    expect(f.find((x) => x.key === 'room_count')).toMatchObject({ value: 5, unit: 'count' })
    expect(f.find((x) => x.key === 'bathroom_count')).toMatchObject({ value: 2, unit: 'count' })
  })

  it('a plot printed one dimension per line', () => {
    const f = facts(page(`<div>Min. wymiary działki szer.</div><div>21,15 m</div><div>Min. wymiary działki dł.</div><div>24,60 m</div>`))
    expect(f.find((x) => x.key === 'plot_min_width')?.value).toBe(21.15)
    expect(f.find((x) => x.key === 'plot_min_depth')?.value).toBe(24.6)
  })

  it('two different block readings of one key are a question: the key is left out', () => {
    expect(factOf(page(`<div>Powierzchnia użytkowa</div><div>131,70 m²</div><div>Powierzchnia użytkowa</div><div>118,20 m²</div>`), 'usable_area')).toBeUndefined()
  })

  it('a card linking to another project is that project: its figures are not this house', () => {
    expect(factOf(page(`<h2>Podobne projekty</h2><a href="${SITE}/katalog/inny-dom/"><div>Dom pod Klonem</div><div>Powierzchnia użytkowa</div><div>99,40 m²</div></a>`), 'usable_area')).toBeUndefined()
  })

  it('an ARIA grid is a table, never a run of label blocks', () => {
    expect(factOf(page(`<div role="grid"><div role="row"><div role="gridcell">Powierzchnia użytkowa</div><div role="gridcell">131,70 m²</div></div></div>`), 'usable_area')).toBeUndefined()
  })

  it('prose with a number in it is not a value', () => {
    expect(factOf(page(`<div>Powierzchnia użytkowa</div><p>zależy od wybranej wersji, od 120 do 140 m² w zależności od poddasza</p>`), 'usable_area')).toBeUndefined()
  })
})

describe('technical documents: recorded, drawings fetched and hashed, none parsed', () => {
  const LIST = `<ul><li>Obrys budynku w skali 1:500<ul><li><a href="${SITE}/pliki/obrys.pdf">PDF podstawa</a></li><li><a href="${SITE}/pliki/obrys-l.pdf">PDF lustro</a></li><li><a href="${SITE}/pliki/obrys.dwg">DWG</a></li></ul></li><li><a href="${SITE}/pliki/energia.pdf">Charakterystyka energetyczna</a></li></ul>`

  it('the words on the parent list item name the documents under it', () => {
    const docs = genericDocuments({ url: PAGE, html: page(LIST), fetchText: async () => null })
    expect(docs.map((d) => [d.url.split('/').pop(), d.format, d.kind, d.variant, d.statedScale ?? '-'])).toEqual([
      ['energia.pdf', 'PDF', 'ENERGY_CERTIFICATE', 'UNKNOWN', '-'],
      ['obrys-l.pdf', 'PDF', 'OUTLINE', 'MIRRORED', '1:500'],
      ['obrys.dwg', 'DWG', 'OUTLINE', 'UNKNOWN', '1:500'],
      ['obrys.pdf', 'PDF', 'OUTLINE', 'BASE', '1:500'],
    ])
  })

  it('a package that links documents is sealed as 1.3.0 with them hashed, and never an image asset', async () => {
    const pdf = utf8('%PDF-1.4 a document this layer never opens')
    const pkg = await acquire({
      [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`<h1>Dom pod Grabem</h1><div>Powierzchnia użytkowa</div><div>131,70 m²</div>${DRAWINGS}${LIST}`)) },
      ...drawingRoutes(),
      [`${SITE}/pliki/obrys.pdf`]: { bytes: pdf, mediaType: 'application/pdf' },
      [`${SITE}/pliki/obrys-l.pdf`]: { bytes: pdf, mediaType: 'application/pdf' },
      [`${SITE}/pliki/obrys.dwg`]: { bytes: utf8('AC1027 not a drawing this layer reads'), mediaType: 'application/octet-stream' },
    })
    expect(pkg.schemaVersion).toBe(SOURCE_PACKAGE_SCHEMA_VERSION_WITH_DOCUMENTS)
    expect(pkg.adapter).toEqual({ id: 'generic.project-page', version: '1.1.0' })
    expect(pkg.documents?.map((d) => [d.url.split('/').pop(), d.status, d.code ?? '-'])).toEqual([
      ['energia.pdf', 'NOT_FETCHED', 'NOT_A_DRAWING'],
      ['obrys-l.pdf', 'FETCHED', '-'],
      ['obrys.dwg', 'FETCHED', '-'],
      ['obrys.pdf', 'FETCHED', '-'],
    ])
    expect(pkg.documents?.every((d) => d.status !== 'FETCHED' || /^[0-9a-f]{64}$/.test(d.byteHash ?? ''))).toBe(true)
    expect(pkg.assets.some((a) => a.variants.some((v) => /\.(pdf|dwg)$/.test(v.url)))).toBe(false)
  })

  it('a document served as a page or a picture is not the document it named', async () => {
    const pkg = await acquire({
      [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`<h1>Dom pod Grabem</h1>${DRAWINGS}${LIST}`)) },
      ...drawingRoutes(),
      [`${SITE}/pliki/obrys.pdf`]: { bytes: utf8('<html>zaloguj się</html>'), mediaType: 'text/html' },
    })
    const obrys = pkg.documents?.find((d) => d.url.endsWith('/obrys.pdf'))
    expect(obrys?.status).toBe('NOT_FETCHED')
    expect(obrys?.byteHash).toBeUndefined()
  })

  it('a page that links no document is sealed and hashed exactly as before (1.2.0, no documents field)', async () => {
    const pkg = await acquire({ [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`<h1>Dom pod Grabem</h1>${DRAWINGS}`)) }, ...drawingRoutes() })
    expect(pkg.schemaVersion).toBe(SOURCE_PACKAGE_SCHEMA_VERSION)
    expect('documents' in pkg).toBe(false)
    const { contentHash, ...draft } = pkg
    expect(sourcePackageContentHash(draft)).toBe(contentHash)
    expect(sourcePackageContentHash({ ...draft, documents: [] })).toBe(contentHash)
  })
})

describe('captions, views and storeys', () => {
  it('"przód" and "tył" are the front and the rear', async () => {
    const pkg = await acquire({ [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`<h1>Dom pod Grabem</h1>${DRAWINGS}`)) }, ...drawingRoutes() })
    const views = pkg.assets.filter((a) => a.roles.document === 'ELEVATION').map((a) => a.roles.view).sort()
    expect(views).toEqual(['FRONT', 'REAR'])
  })

  it('"parterowy" names a house type, not the ground storey', async () => {
    const pkg = await acquire({
      [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`<h1>Dom pod Grabem</h1><img src="${SITE}/m/wiz.jpg" alt="Nowoczesny dom parterowy – wizualizacja">${DRAWINGS}`)) },
      ...drawingRoutes(),
      [`${SITE}/m/wiz.jpg`]: { bytes: pngBytes(1200, 800, 9), mediaType: 'image/png' },
    })
    const render = pkg.assets.find((a) => a.variants.some((v) => v.url.endsWith('/wiz.jpg')))
    expect(render?.roles.storey).not.toBe('GROUND')
  })

  it('a figure caption belongs to its own figure, never to the one before it', async () => {
    const pkg = await acquire({
      [PAGE]: {
        mediaType: 'text/html',
        bytes: utf8(page(`<h1>Dom pod Grabem</h1><h2>Galeria</h2><figure><img src="${SITE}/m/a.png" alt=""></figure><figure><img src="${SITE}/m/rzut-parteru.png" alt=""><figcaption>Rzut parteru</figcaption></figure><h2>Elewacje</h2><img src="${SITE}/m/elewacja-przod.png" alt="Elewacja przód">`)),
      },
      ...drawingRoutes(),
      [`${SITE}/m/a.png`]: { bytes: pngBytes(1000, 700, 7), mediaType: 'image/png' },
    })
    const a = pkg.assets.find((x) => x.variants.some((v) => v.url.endsWith('/a.png')))
    expect(a?.roles.document).not.toBe('FLOOR_PLAN')
    expect(pkg.assets.find((x) => x.variants.some((v) => v.url.endsWith('/rzut-parteru.png')))?.roles.document).toBe('FLOOR_PLAN')
  })
})

describe('the page itself', () => {
  it('only links about this project are followed for drawings: not the root, a listing above it or a guide elsewhere', async () => {
    const html = page(`<h1>Dom pod Grabem</h1><nav><a href="/">Projekty domów z rzutami</a><a href="/katalog/">Katalog: rzuty i elewacje</a><a href="/katalog/dom-pod-grabem/rzuty">Rzuty</a><a href="/poradnik/elewacja-domu-jak-wybrac">Elewacja domu – poradnik</a><a href="/rysunki/dom-pod-grabem">Rysunki</a></nav>`)
    const { drawingLinks } = await import('../src/adapters/generic/assets.js')
    // under the page's own path, or naming the project; never the root, a listing above it or a guide elsewhere
    expect(drawingLinks(readPageFacts(html, PAGE), PAGE)).toEqual([`${SITE}/katalog/dom-pod-grabem/rzuty`, `${SITE}/rysunki/dom-pod-grabem`])
  })

  it('a description never comes from consent prose in a form', () => {
    const consent = 'Wyrażam zgodę na przetwarzanie moich danych osobowych w celu przesłania oferty projektu domu oraz kontaktu w sprawie zakupu, zgodnie z polityką prywatności.'
    const specs = genericProjectPageAdapter.parsePublished({ url: PAGE, html: page(`<h1>Dom pod Grabem</h1><form><p>${consent}</p></form>`), fetchText: async () => null }).specifications
    expect(specs.find((s) => s.key === 'description')).toBeUndefined()
  })

  it('the project is named by its h1 when the title adds the site to it', () => {
    const identity = genericProjectPageAdapter.identify({ url: PAGE, html: page(`<h1>Dom pod Grabem</h1>`, `<meta property="og:title" content="Dom pod Grabem – Przykładowy Wydawca">`), fetchText: async () => null })
    expect(identity.name).toBe('Dom pod Grabem')
  })

  it('a drawing heading with no picture under it is said to be empty, and still counts for the page', () => {
    const c = classifyProjectPage(readPageFacts(page(`<h1>Dom pod Grabem</h1><div>Powierzchnia użytkowa</div><div>131,70 m²</div><h2>Rzuty</h2><p>wkrótce</p><h2>Opis</h2><p>tekst</p>`), PAGE))
    expect(c.evidence.find((e) => e.signal === 'empty-drawing-heading')).toMatchObject({ weight: 0 })
    expect(c.evidence.some((e) => e.signal === 'plan-imagery')).toBe(true)
  })
})
