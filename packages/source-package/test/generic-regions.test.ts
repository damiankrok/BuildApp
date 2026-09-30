/**
 * 005C post-review (source): whose figure is it, and is it a figure at all?
 *
 * A value belongs to a label only inside the smallest element holding both;
 * a card, a control or the site's chrome states nobody's figure; a bound, an
 * estimate or a blank holds a label's place and states none; a figure's unit
 * is its key's. And the documents and the crawl, read the same way: the
 * nearest words decide. One fixture per structure, none per site: the pages
 * exist only here, with no class name, address or figure of any real house.
 */
import { describe, expect, it } from 'vitest'
import { acquireSourcePackage, archonAdapter, classifyProjectPage, genericProjectPageAdapter, readPageFacts, type AddressResolver, type SourceByteCache } from '../src/index.js'
import { documentSignatureMatches } from '../src/acquire.js'
import { drawingLinks } from '../src/adapters/generic/assets.js'
import { genericDocuments } from '../src/adapters/generic/index.js'
import { safeDecode } from '../src/text.js'
import { pngBytes, stubFetch, utf8, type StubRoute } from './helpers.js'

const SITE = 'https://domy.przyklad-wydawcy.test'
const PAGE = `${SITE}/katalog/dom-pod-grabem/`
const resolver: AddressResolver = async () => ['93.184.216.34']
const page = (body: string): string => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Dom pod Grabem | Przykładowy Wydawca</title></head><body>${body}</body></html>`
const read = (body: string): string[] =>
  genericProjectPageAdapter
    .parsePublished({ url: PAGE, html: page(body), fetchText: async () => null })
    .facts.map((f) => `${f.key}=${f.value}${f.unit === 'none' ? '' : ` ${f.unit}`}`)
    .sort()

describe('a value belongs to a label only inside its own row', () => {
  it('value-first rows (a counter, an icon box) pair within each row, never one row over', () => {
    expect(read(`<div><div>131,70 m²</div><div>Powierzchnia użytkowa</div></div><div><div>158,20 m²</div><div>Powierzchnia zabudowy</div></div><div><div>7,35 m</div><div>Wysokość budynku</div></div>`)).toEqual([
      'building_height=7.35 m',
      'footprint_area=158.2 m2',
      'usable_area=131.7 m2',
    ])
    expect(read(`<div><p>158,20 m²</p><p>powierzchnia zabudowy</p></div><div><p>612 m³</p><p>kubatura</p></div>`)).toEqual(['footprint_area=158.2 m2', 'volume=612'])
  })

  it('a flat list is read only when it alternates label, figure from its first block to its last', () => {
    expect(read(`<div>Powierzchnia użytkowa</div><div>131,70 m²</div><div>Kąt nachylenia dachu</div><div>35°</div>`)).toEqual(['roof_pitch=35 deg', 'usable_area=131.7 m2'])
    // value first: the direction is a guess, so nothing
    expect(read(`<div>131,70 m²</div><div>Powierzchnia użytkowa</div><div>158,20 m²</div><div>Powierzchnia zabudowy</div>`)).toEqual([])
  })

  it('a blank, a bound, an estimate or a range holds its label’s place and states nothing', () => {
    expect(read(`<div>Powierzchnia zabudowy</div><div>—</div><div>Powierzchnia użytkowa (bez garażu i kotłowni)</div><div>131,70 m²</div>`)).toEqual(['usable_area=131.7 m2'])
    expect(read(`<div>Powierzchnia zabudowy</div><div>ok. 160 m²</div>`)).toEqual([])
    expect(read(`<p>Kubatura - około 600 m³</p><p>Powierzchnia zabudowy - do 150 m²</p>`)).toEqual([])
    expect(read(`<p>Powierzchnia zabudowy nie może przekroczyć 150 m²</p><h3>Ile wynosi maksymalna powierzchnia zabudowy?</h3><p>Maksymalna powierzchnia zabudowy 150 m²</p>`)).toEqual([])
  })

  it('a tooltip’s example value makes the row ambiguous; its definition prose is passed over', () => {
    expect(read(`<div>Wysokość budynku</div><div><p>Liczona od poziomu terenu do najwyższego punktu dachu, np. dla domu parterowego:</p><p>6,50 m</p></div><div>9,10 m</div>`)).toEqual([])
    expect(read(`<div><div>Wysokość budynku</div><div><h4>Wysokość budynku</h4><p>Wysokość budynku – liczona jako najwyższy punkt dachu nad terenem</p><button>Zamknij</button></div><div>7,35 m</div></div>`)).toEqual(['building_height=7.35 m'])
  })
})

describe('a card, a control or the chrome states nobody’s figure', () => {
  it('a related-project tile linked only on its title or its picture', () => {
    expect(read(`<div>Powierzchnia użytkowa</div><div>131,70 m²</div><h2>Podobne projekty</h2><div><h3><a href="/katalog/dom-pod-lipa/">Dom pod Lipą</a></h3><div>Powierzchnia zabudowy</div><div>99,40 m²</div></div>`)).toEqual(['usable_area=131.7 m2'])
    expect(read(`<div>Powierzchnia zabudowy</div><div>158,20 m²</div><div><a href="/katalog/dom-pod-lipa/"><img src="/m/lipa.jpg" alt="Dom pod Lipą"></a><div>Pow. zabudowy</div><div>99,40 m²</div></div>`)).toEqual(['footprint_area=158.2 m2'])
    // a structured reader's pair in a tile, too
    expect(read(`<div>Powierzchnia użytkowa</div><div>131,70 m²</div><div><a href="/katalog/dom-pod-lipa/">Dom pod Lipą</a><dl><dt>Pow. użytkowa</dt><dd>99,40 m²</dd></dl></div>`)).toEqual(['usable_area=131.7 m2'])
  })

  it('a link in small print makes nothing a card', () => {
    expect(read(`<div><div><div>Powierzchnia zabudowy</div><div>158,20 m²</div></div><p>Dane przetwarzamy zgodnie z <a href="/polityka-prywatnosci/">polityką prywatności</a> wydawcy.</p></div>`)).toEqual(['footprint_area=158.2 m2'])
  })

  it('a filter form, a select, a footer widget', () => {
    expect(read(`<aside><form><div>Powierzchnia zabudowy</div><div>50 m²</div><div>300 m²</div><button>Szukaj</button></form></aside><h1>Dom pod Grabem</h1><div>Powierzchnia użytkowa</div><div>131,70 m²</div>`)).toEqual(['usable_area=131.7 m2'])
    expect(read(`<header><form action="/szukaj"><label>Powierzchnia użytkowa od</label><select><option>60 m²</option></select></form></header><div>Powierzchnia zabudowy</div><div>158,20 m²</div>`)).toEqual(['footprint_area=158.2 m2'])
    expect(read(`<div>Powierzchnia użytkowa</div><div>131,70 m²</div><footer><h3>Ostatnio oglądane</h3><div>Powierzchnia zabudowy</div><div>99,40 m²</div></footer>`)).toEqual(['usable_area=131.7 m2'])
  })

  it('a catalogue listing is not a project page', () => {
    const card = (slug: string, u: string, f: string): string => `<article><a href="/projekt/${slug}/"><img src="/m/${slug}.jpg" alt="Projekt"></a><h3><a href="/projekt/${slug}/">${slug}</a></h3><div>Powierzchnia użytkowa</div><div>${u} m²</div><div>Powierzchnia zabudowy</div><div>${f} m²</div></article>`
    const html = `<!doctype html><html><head><title>Projekty domów parterowych | Wydawca</title></head><body><h1>Projekty domów parterowych</h1><form><label>Powierzchnia użytkowa do</label><select><option>100 m²</option></select></form>${card('a', '99,40', '120,10')}${card('b', '118,20', '140,00')}<h2>Jak czytać rzuty?</h2></body></html>`
    expect(classifyProjectPage(readPageFacts(html, `${SITE}/projekty-domow/parterowe/`)).verdict).toBe('NOT_PROJECT')
  })
})

describe('a figure’s unit is its key’s, whatever the reader', () => {
  it('a percentage, centimetres, a count or a garage door are no area, height or pitch', () => {
    expect(read(`<ul><li>Maksymalna powierzchnia zabudowy: 30%</li><li>Wysokość budynku: 745 cm</li><li>Kąt nachylenia dachu: 35%</li><li>Nachylenie terenu: 5%</li><li>Liczba miejsc w garażu: 2</li><li>Brama garażowa: 2,5 m</li></ul>`)).toEqual([])
    expect(read(`<table><tr><td>Wskaźnik powierzchni zabudowy</td><td>0,3</td></tr></table>`)).toEqual([])
    expect(read(`<div>Kąt nachylenia dachu garażu</div><div>15°</div><div>Kąt nachylenia dachu</div><div>40°</div>`)).toEqual(['roof_pitch=40 deg'])
  })

  it('a unit or a standard in the label is not a digit in the label', () => {
    expect(read(`<table><tr><td>Powierzchnia użytkowa (m2)</td><td>131,70</td></tr><tr><td>Kubatura (m3)</td><td>612,00</td></tr></table>`)).toEqual(['usable_area=131.7 m2', 'volume=612'])
    expect(read(`<table><tr><td>Powierzchnia użytkowa wg PN-ISO 9836:1997</td><td>131,70 m²</td></tr></table>`)).toEqual(['usable_area=131.7 m2'])
  })

  it('two readings of one key that differ leave it out, whichever readers they come from', () => {
    expect(read(`<table><tr><td>Powierzchnia zabudowy</td><td>158,20 m²</td></tr></table><div>Powierzchnia zabudowy</div><div>142,00 m²</div>`)).toEqual([])
    expect(read(`<table><tr><td>Powierzchnia zabudowy</td><td>158,20 m²</td></tr></table><div>Powierzchnia zabudowy</div><div>158,20 m²</div>`)).toEqual(['footprint_area=158.2 m2'])
    // a storey's area is not the house's
    expect(read(`<ul><li>Powierzchnia użytkowa parteru: 90,10 m²</li><li>Powierzchnia użytkowa poddasza: 70,20 m²</li></ul>`)).toEqual([])
  })

  it('a plot in the words publishers use for it', () => {
    expect(read(`<div>Minimalna szerokość działki</div><div>21,15 m</div><div>Minimalna długość działki</div><div>24,60 m</div>`)).toEqual(['plot_min_depth=24.6 m', 'plot_min_width=21.15 m'])
    expect(read(`<div>Minimalne wymiary działki</div><div>21,15 x 24,60 m</div>`)).toEqual(['plot_min_depth=24.6 m', 'plot_min_width=21.15 m'])
  })
})

const docs = (body: string): string[] =>
  genericDocuments({ url: PAGE, html: page(`<h1>Dom pod Grabem</h1>${body}`), fetchText: async () => null }).map((d) => `${d.url.replace(SITE, '')} ${d.kind}/${d.variant}${d.statedScale ? ` ${d.statedScale}` : ''}`)

describe('a document is what its nearest words say', () => {
  it('the row it is filed in: a table row, a dt, a heading, an inline label', () => {
    expect(docs(`<table><tr><td>Obrys budynku 1:500</td><td><a href="/pliki/pk.pdf">PDF</a></td><td><a href="/pliki/pkl.pdf">PDF lustro</a></td></tr></table>`)).toEqual(['/pliki/pk.pdf OUTLINE/UNKNOWN 1:500', '/pliki/pkl.pdf OUTLINE/MIRRORED 1:500'])
    expect(docs(`<dl><dt>Obrys budynku 1:500</dt><dd><a href="/pliki/pk.pdf">PDF</a></dd></dl>`)).toEqual(['/pliki/pk.pdf OUTLINE/UNKNOWN 1:500'])
    expect(docs(`<h3>Obrys budynku (skala 1:500)</h3><p><a href="/pliki/pk.pdf">pobierz PDF</a> · <a href="/pliki/pk.dwg">pobierz DWG</a></p>`)).toEqual(['/pliki/pk.dwg OUTLINE/UNKNOWN 1:500', '/pliki/pk.pdf OUTLINE/UNKNOWN 1:500'])
    expect(docs(`<ul><li>Obrys budynku w skali 1:500: <a href="/pliki/pk.pdf">PDF</a>, <a href="/pliki/pkl.pdf">PDF lustro</a></li></ul>`)).toEqual(['/pliki/pk.pdf OUTLINE/UNKNOWN 1:500', '/pliki/pkl.pdf OUTLINE/MIRRORED 1:500'])
  })

  it('its own words before its row’s, and before its filename', () => {
    expect(docs(`<ul><li>Dokumentacja do pobrania<ul><li><a href="/pliki/prezentacja.pdf">Prezentacja projektu</a></li></ul></li></ul>`)).toEqual(['/pliki/prezentacja.pdf BROCHURE/UNKNOWN'])
    expect(docs(`<ul><li><a href="/pliki/obrys-i-charakterystyka.pdf">Charakterystyka energetyczna</a></li></ul>`)).toEqual(['/pliki/obrys-i-charakterystyka.pdf ENERGY_CERTIFICATE/UNKNOWN'])
  })

  it('a row naming both variants names neither; "nie lustrzana" is the base', () => {
    expect(docs(`<ul><li>Obrys budynku – wersja podstawowa i lustrzana<ul><li><a href="/pliki/a.pdf">PDF</a></li><li><a href="/pliki/b.pdf">PDF (lustro)</a></li></ul></li></ul>`)).toEqual(['/pliki/a.pdf OUTLINE/UNKNOWN', '/pliki/b.pdf OUTLINE/MIRRORED'])
    expect(docs(`<ul><li><a href="/pliki/pk.pdf">Obrys – wersja standardowa (nie lustrzana)</a></li></ul>`)).toEqual(['/pliki/pk.pdf OUTLINE/BASE'])
  })

  it('a guide, a sample, a catalogue, the footer and another house’s tile are nobody’s documents', () => {
    expect(docs(`<header><a href="/pliki/przykladowy-projekt.pdf">Zobacz przykładową dokumentację projektu</a> <a href="/pliki/jak-czytac-rzuty.pdf">Poradnik: jak czytać rzuty</a></header>`)).toEqual(['/pliki/jak-czytac-rzuty.pdf UNKNOWN/UNKNOWN', '/pliki/przykladowy-projekt.pdf UNKNOWN/UNKNOWN'])
    expect(docs(`<footer><a href="/pliki/regulamin.pdf">Regulamin (PDF)</a></footer>`)).toEqual([])
    expect(docs(`<h2>Podobne</h2><div><a href="/katalog/dom-pod-lipa/">Dom pod Lipą</a> <a href="/katalog/dom-pod-lipa/obrys.pdf">Obrys (PDF)</a></div>`)).toEqual([])
  })
})

describe('a document fetch keeps only what opens as its format', () => {
  const OUTLINE = `<ul><li>Obrys budynku 1:500<ul><li><a href="/pliki/a.pdf">PDF</a></li></ul></li></ul>`
  const body = `<h1>Dom pod Grabem</h1><div>Powierzchnia użytkowa</div><div>131,70 m²</div><h2>Rzuty</h2><img src="${SITE}/m/rzut-parteru.png" alt="Rzut parteru">`
  const routes = (doc: StubRoute, extra = ''): Record<string, StubRoute> => ({
    [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`${body}${OUTLINE}${extra}`)) },
    [`${SITE}/m/rzut-parteru.png`]: { bytes: pngBytes(900, 700, 1), mediaType: 'image/png' },
    [`${SITE}/pliki/a.pdf`]: doc,
  })
  const acquire = (r: Record<string, StubRoute>, cache?: SourceByteCache) => acquireSourcePackage(PAGE, [archonAdapter, genericProjectPageAdapter], { deps: { fetchImpl: stubFetch(r).fetchImpl, resolve: resolver }, cache })

  it('the signatures', () => {
    expect(documentSignatureMatches('PDF', utf8('%PDF-1.4\n'))).toBe(true)
    expect(documentSignatureMatches('PDF', utf8('<html>zaloguj się</html>'))).toBe(false)
    expect(documentSignatureMatches('DWG', utf8('AC1032\u0000\u0000'))).toBe(true)
    expect(documentSignatureMatches('DXF', utf8('  0\nSECTION\n  2\nHEADER'))).toBe(true)
  })

  it('HTML served as a PDF is not the PDF', async () => {
    const pkg = await acquire(routes({ bytes: utf8('<html><body>zaloguj się</body></html>'), mediaType: 'application/pdf' }))
    expect(pkg.documents?.map((d) => `${d.status} ${d.code ?? ''}`)).toEqual(['NOT_FETCHED SIGNATURE_MISMATCH'])
    const ok = await acquire(routes({ bytes: utf8('%PDF-1.4\n%synthetic\n'), mediaType: 'application/pdf' }))
    expect(ok.documents?.map((d) => d.status)).toEqual(['FETCHED'])
  })

  it('bytes a cache returns meet the document allowlist again', async () => {
    const store = new Map<string, { bytes: Uint8Array; mediaType: string; url?: string }>()
    const cache = { get: async (u: string) => store.get(u) ?? null, put: async (u: string, bytes: Uint8Array, mediaType: string, url?: string) => void store.set(u, { bytes, mediaType, url }) } as unknown as SourceByteCache
    store.set(`${SITE}/pliki/a.pdf`, { bytes: utf8('%PDF-1.4 but served as a page'), mediaType: 'text/html' })
    const pkg = await acquire(routes({ bytes: utf8('%PDF-1.4\n'), mediaType: 'application/pdf' }), cache)
    expect(pkg.documents?.map((d) => `${d.status} ${d.code ?? ''}`)).toEqual(['NOT_FETCHED MEDIA_TYPE_NOT_ALLOWED'])
  })

  it('a brochure or a site PDF is not recorded, so a page without technical documents stays 1.2.0', async () => {
    const pkg = await acquireSourcePackage(PAGE, [archonAdapter, genericProjectPageAdapter], {
      deps: {
        fetchImpl: stubFetch({
          [PAGE]: { mediaType: 'text/html', bytes: utf8(page(`${body}<footer><a href="/pliki/regulamin.pdf">Regulamin</a></footer><a href="/projekt,dom.pdf">Drukuj</a>`)) },
          [`${SITE}/m/rzut-parteru.png`]: { bytes: pngBytes(900, 700, 1), mediaType: 'image/png' },
        }).fetchImpl,
        resolve: resolver,
      },
    })
    expect(pkg.documents).toBeUndefined()
    expect(pkg.schemaVersion).toBe('1.2.0')
  })
})

describe('the crawl follows this project’s pages, by whole tokens of its name', () => {
  const links = (url: string, body: string): string[] => drawingLinks(readPageFacts(`<html><body><h1>Dom</h1>${body}</body></html>`, url), url).map((u) => u.replace(SITE, ''))

  it('real subpages: a sibling .html, a query id, a short slug, the name only in the link text', () => {
    expect(links(`${SITE}/projekty/dom-pod-grabem.html`, `<a href="/projekty/dom-pod-grabem-rzuty.html">Rzuty</a>`)).toEqual(['/projekty/dom-pod-grabem-rzuty.html'])
    expect(links(`${SITE}/projekt.php?id=4711`, `<a href="/rzuty.php?id=4711">Rzuty</a>`)).toEqual(['/rzuty.php?id=4711'])
    expect(links(`${SITE}/projekty/z12/`, `<a href="/rzuty/z12/">Rzuty</a>`)).toEqual(['/rzuty/z12/'])
    expect(links(`${SITE}/katalog/dom-pod-grabem/`, `<a href="/plany/4711">Rzuty – Dom pod Grabem</a>`)).toEqual(['/plany/4711'])
  })

  it('not another project whose name extends or contains this one', () => {
    expect(links(`${SITE}/katalog/dom-pod-grabem/`, `<a href="/katalog/dom-pod-grabem-lustro/rzuty">Rzuty w odbiciu</a><a href="/katalog/dom-pod-grabem-2/">Dom pod Grabem 2 – rzuty</a>`)).toEqual([])
    expect(links(`${SITE}/projekty/4711/`, `<a href="/rysunki/47110">Rysunki</a>`)).toEqual([])
    expect(links(`${SITE}/projekty/lipa/`, `<a href="/poradnik/filipa-i-rzuty">Rzuty u Filipa</a>`)).toEqual([])
  })

  it('a CAD file is never crawled as a page, and a malformed escape never throws', () => {
    expect(links(PAGE, `<a href="${PAGE}pliki/rzuty.dwg">Rzuty – DWG</a>`)).toEqual([])
    expect(() => links(PAGE, `<a href="/katalog/dom-pod-grabem/rzuty?rabat=10%">Rzuty</a><a href="/rysunki/%B3ad.html">Rzuty</a>`)).not.toThrow()
    expect(safeDecode('obrys-bry%B3a')).toBe('obrys-bry%B3a')
    expect(safeDecode('dom-pod-%C5%9Bwierkiem')).toBe('dom-pod-świerkiem')
  })
})
