/**
 * v3.51 ANY-LINK: what a project page exposes in ways the first readers did not look for — pictures behind addresses
 * without an extension, plans drawn as SVG, galleries stated only as structured data, dimensions in feet — and the
 * counter-cases that keep each rule from reading a tracking pixel, an icon or a product name as a drawing.
 *
 * Every page here is synthetic: no publisher, no project.
 */
import { describe, expect, it } from 'vitest'
import { decodeImage, genericProjectPageAdapter, genericRoleClaims, probeImage, startDecoders, svgIntrinsicSize, svgRasterSize, SVG_MIN_LONG_SIDE_PX, SVG_MAX_LONG_SIDE_PX } from '../src/index.js'
import { imperialMetres } from '../src/adapters/generic/published.js'
import { withRoofPitchLine } from '../src/adapters/generic/index.js'

const SITE = 'https://plans.example'
const PAGE = `${SITE}/projekt/dom-testowy`
const page = (body: string, head = ''): string => `<!doctype html><html><head><title>Dom Testowy</title>${head}</head><body><h1>Projekt domu Dom Testowy</h1>${body}</body></html>`
const ctx = (html: string) => ({ url: PAGE, html, fetchText: async () => null })
const discover = async (html: string) => genericProjectPageAdapter.discover(ctx(html))
const facts = (html: string) => Object.fromEntries(genericProjectPageAdapter.parsePublished(ctx(html)).facts.map((f) => [f.key, f.value]))

describe('a picture behind an address without an extension', () => {
  it('is a candidate on a named img, with every lazy form of its address', async () => {
    const found = await discover(page(`<img data-src="https://img.example/c/x150/media/7/source" data-srcset="https://img.example/c/x150/media/7/source 150w, https://img.example/c/x200/media/7/source 350w" alt="Dom Testowy - elewacja frontowa">`))
    expect(found.map((c) => `${c.channel} ${c.url}`).sort()).toEqual([
      'IMG_LAZY_ATTR https://img.example/c/x150/media/7/source',
      'IMG_SRCSET https://img.example/c/x150/media/7/source',
      'IMG_SRCSET https://img.example/c/x200/media/7/source',
    ])
    expect(genericRoleClaims(found[0]).some((c) => c.document === 'ELEVATION')).toBe(true)
  })

  it('counter-case: an unnamed one is not — that is how a tracking pixel looks', async () => {
    expect(await discover(page(`<img src="https://tracker.example/tr?id=1&ev=PageView" width="1" height="1"><img src="https://img.example/media/9/source" alt="">`))).toEqual([])
  })

  it('counter-case: a data: placeholder is never an address', async () => {
    expect(await discover(page(`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="Dom Testowy - rzut parteru">`))).toEqual([])
  })

  it('is the original a lightbox link around the picture opens', async () => {
    const found = await discover(page(`<a data-fslightbox="elevations" href="https://img.example/c/x1200/media/7/source"><img data-src="https://img.example/c/x150/media/7/source" alt="Dom Testowy - elewacja tylna"></a>`))
    const original = found.find((c) => c.channel === 'ANCHOR_HREF')
    expect(original?.url).toBe('https://img.example/c/x1200/media/7/source')
    expect(original?.caption).toContain('elewacja tylna')
    // the link and the picture it wraps are one asset
    expect(new Set(found.map((c) => c.groupKey)).size).toBe(1)
  })

  it('counter-case: a plain link around a picture, to an address without an extension, is a page', async () => {
    const found = await discover(page(`<a href="${SITE}/projekt/inny-dom"><img src="https://img.example/thumbs/inny.jpg" alt="rzut parteru"></a>`))
    expect(found.some((c) => c.channel === 'ANCHOR_HREF')).toBe(false)
  })
})

describe('a plan drawn as SVG', () => {
  it('is a candidate where the element names a drawing', async () => {
    const found = await discover(page(`<svg data-svg-src="https://cdn.example/designs/1/plan.svg" data-svg-loaded="false" alt="Dom Testowy - rzut parteru"></svg>`))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ channel: 'VECTOR_DRAWING', url: 'https://cdn.example/designs/1/plan.svg' })
    const claims = genericRoleClaims(found[0])
    expect(claims.some((c) => c.document === 'FLOOR_PLAN')).toBe(true)
    expect(claims.some((c) => c.storey === 'GROUND')).toBe(true)
  })

  it('counter-case: a pictogram that names a kind of drawing and no sheet is not', async () => {
    expect(await discover(page(`<a href="${SITE}/floor-plans"><img src="${SITE}/img/component/plans.svg" alt="Floor Plans"></a><img src="${SITE}/img/modify/confirm.svg" alt="Confirm the plan">`))).toEqual([])
    // the same picture named for a side, or for this very project, is a sheet
    expect((await discover(page(`<img src="${SITE}/media/dom/el1.svg" alt="elewacja frontowa">`))).map((c) => c.channel)).toEqual(['VECTOR_DRAWING'])
    expect((await discover(page(`<img src="${SITE}/media/dom/plan.svg" alt="Projekt domu Dom Testowy - plan">`))).map((c) => c.channel)).toEqual(['VECTOR_DRAWING'])
  })

  it('counter-case: an icon, a logo and a payment mark are not', async () => {
    expect(await discover(page(`<img src="${SITE}/img/svg/visa.svg" alt="Visa"><svg data-src="${SITE}/img/svg/logo.svg"></svg><img src="${SITE}/img/svg/arrow.svg" alt="">`))).toEqual([])
  })

  it('states its own size; the raster it is given keeps the aspect within the reading range', () => {
    const svg = (attrs: string): Uint8Array => new TextEncoder().encode(`<?xml version="1.0"?><!-- exported --><svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect width="10" height="10"/></svg>`)
    expect(svgIntrinsicSize(svg('width="1728" height="1646" viewBox="0 0 1728 1646"'))).toEqual({ width: 1728, height: 1646 })
    expect(probeImage(svg('width="1728" height="1646"'))).toEqual({ format: 'svg', size: { width: 1728, height: 1646 } })
    // no width/height: the viewBox; a small sheet is brought up, a huge one down
    expect(probeImage(svg('viewBox="0 0 800 400"'))?.size).toEqual({ width: SVG_MIN_LONG_SIDE_PX, height: SVG_MIN_LONG_SIDE_PX / 2 })
    expect(svgRasterSize(9600, 4800)).toEqual({ width: SVG_MAX_LONG_SIDE_PX, height: SVG_MAX_LONG_SIDE_PX / 2 })
  })

  it('counter-case: an icon-sized or banner-shaped SVG, or one that states no size, is not a sheet', () => {
    const svg = (attrs: string): Uint8Array => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}></svg>`)
    expect(probeImage(svg('width="24" height="24" viewBox="0 0 24 24"'))).toBeNull()
    expect(probeImage(svg('viewBox="0 0 4000 300"'))).toBeNull()
    expect(probeImage(svg('width="100%" height="100%"'))).toBeNull()
    expect(probeImage(new TextEncoder().encode('<html><body><svg width="900" height="900"></svg></body></html>'))).toBeNull()
  })

  it('rasterises to exactly the probed size, white where nothing is drawn', async () => {
    await startDecoders()
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1001"><rect x="0" y="0" width="1000" height="1001" fill="#000"/></svg>')
    const probe = probeImage(bytes)
    const raster = decodeImage(bytes)
    expect({ width: raster.width, height: raster.height }).toEqual(probe?.size)
    const at = (x: number, y: number): number[] => Array.from(raster.data.subarray((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4))
    expect(at(10, 10)).toEqual([0, 0, 0, 255])
    expect(at(1990, 10)).toEqual([255, 255, 255, 255])
  })
})

describe('a gallery stated only as structured data', () => {
  const ld = (node: object): string => `<script type="application/ld+json">${JSON.stringify(node)}</script>`

  it('gives the pictures of the page’s own product, and their filenames say what they are', async () => {
    const found = await discover(page('<p>opis</p>', ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Product', name: 'Dom Testowy', image: [`${SITE}/media/dom/parter-4.webp`, `${SITE}/media/dom/vis1.webp`, { '@type': 'ImageObject', contentUrl: `${SITE}/media/dom/strych-3.webp` }] }] })))
    expect(found.map((c) => c.url.split('/').pop())).toEqual(['parter-4.webp', 'strych-3.webp', 'vis1.webp'])
    expect(found.every((c) => c.channel === 'STRUCTURED_DATA_IMAGE')).toBe(true)
    expect(genericRoleClaims(found[0]).some((c) => c.storey === 'GROUND')).toBe(true)
    expect(genericRoleClaims(found[1]).some((c) => c.storey === 'ATTIC')).toBe(true)
  })

  it('counter-case: the site’s own logo is nobody’s drawing', async () => {
    expect(await discover(page('<p>opis</p>', ld({ '@type': 'Organization', name: 'Plans', image: `${SITE}/img/logo.png`, logo: `${SITE}/img/logo.png` })))).toEqual([])
  })

  it('gives the properties it lists, read by the same vocabulary and the same unit rule as a table', () => {
    const html = page('<p>opis</p>', ld({ '@type': 'Product', name: 'Dom Testowy', additionalProperty: [
      { '@type': 'PropertyValue', name: 'Powierzchnia zabudowy', value: 95, unitCode: 'MTK' },
      { '@type': 'PropertyValue', name: 'Szerokość budynku', value: 9.75, unitCode: 'MTR' },
      { '@type': 'PropertyValue', name: 'Kąt nachylenia dachu', value: 35, unitCode: 'DD' },
      { '@type': 'PropertyValue', name: 'Garaż', value: 'Nie' },
      // a unit that is not the key's states no fact
      { '@type': 'PropertyValue', name: 'Długość budynku', value: 1210, unitCode: 'CMT' },
    ] }))
    expect(facts(html)).toEqual({ footprint_area: 95, building_width: 9.75, roof_pitch: 35 })
    // the pitch it lists is a statement about the roof: filed with the roof's lines, as stated
    expect(genericProjectPageAdapter.parsePublished(ctx(html)).specifications.filter((s) => s.key === 'roof')).toEqual([{ key: 'roof', label: 'Kąt nachylenia dachu', text: '35 °' }])
  })
})

describe('the building’s plan dimensions as a page states them', () => {
  it('filed under the elevation, or under a bare width and depth', () => {
    expect(facts(page('<table><tr><td>Szerokość elewacji</td><td>13,84 m</td></tr><tr><td>Długość elewacji</td><td>9,34 m</td></tr></table>'))).toEqual({ building_width: 13.84, building_length: 9.34 })
    expect(facts(page(`<dl><dt>Width</dt><dd>95'</dd><dt>Depth</dt><dd>97' 4"</dd></dl>`))).toEqual({ building_width: 28.956, building_length: 29.667 })
  })

  it('counter-case: a plot’s dimensions stay the plot’s', () => {
    expect(facts(page('<table><tr><td>Min. szerokość działki</td><td>20,84 m</td></tr></table>'))).toEqual({ plot_min_width: 20.84 })
  })

  it('reads feet and inches to the millimetre, and nothing that is not one length', () => {
    expect(imperialMetres(`95'`)).toBe(28.956)
    expect(imperialMetres(`97' 4"`)).toBe(29.667)
    expect(imperialMetres(`9'-6"`)).toBe(2.896)
    expect(imperialMetres('40 ft 6 in')).toBe(12.344)
    expect(imperialMetres(`9' 13"`)).toBeNull()
    expect(imperialMetres('6:12')).toBeNull()
    expect(imperialMetres('3355 sq ft')).toBeNull()
  })

  it('counter-case: feet do not state an area or an angle', () => {
    expect(facts(page(`<dl><dt>Roof pitch</dt><dd>6'</dd><dt>Footprint</dt><dd>40'</dd></dl>`))).toEqual({})
  })
})

describe('"plan" the drawing, never the product', () => {
  const claimsOf = (caption: string) => genericRoleClaims({ url: 'https://cdn.example/p/abc/w1024.jpg', channel: 'IMG_SRC', exposedBy: PAGE, locator: 'img[src]', caption })

  it('a floor plan is one; a photograph "for Modern House Plan #892-47" and a tile "Plan 892-47" are not', () => {
    expect(claimsOf('Floor Plan - Main Floor for Modern House Plan #892-47').some((c) => c.document === 'FLOOR_PLAN')).toBe(true)
    expect(claimsOf('Interior - Laundry for Modern House Plan #892-47').some((c) => c.document === 'FLOOR_PLAN')).toBe(false)
    expect(claimsOf('Plan 892-47').some((c) => c.document === 'FLOOR_PLAN')).toBe(false)
    expect(claimsOf('Plan parteru').some((c) => c.document === 'FLOOR_PLAN')).toBe(true)
  })

  it('the storeys as a house-plan page names them', () => {
    expect(claimsOf('Floor Plan - Main Floor').find((c) => c.storey)?.storey).toBe('GROUND')
    expect(claimsOf('Floor Plan - Second Floor').find((c) => c.storey)?.storey).toBe('UPPER')
    expect(claimsOf('Floor Plan - Lower Level').find((c) => c.storey)?.storey).toBe('BASEMENT')
    // "main" alone names no storey: the main bedroom is not the ground floor
    expect(claimsOf('Interior - Main Bedroom').some((c) => c.storey)).toBe(false)
  })
})

describe('the roof pitch printed as a figure of its own', () => {
  const specs = (html: string) => genericProjectPageAdapter.parsePublished(ctx(html)).specifications.filter((s) => s.key === 'roof')

  it('is filed with the roof\'s specification lines, as printed', () => {
    expect(specs(page('<table><tr><td>Kąt dachu</td><td>30°</td></tr></table>'))).toEqual([{ key: 'roof', label: 'Kąt dachu', text: '30°' }])
  })

  it('counter-case: a roof line that already states an angle is not doubled; without a pitch nothing is added', () => {
    expect(specs(page('<table><tr><td>Dach</td><td>dwuspadowy 40°</td></tr><tr><td>Kąt nachylenia dachu</td><td>40°</td></tr></table>'))).toEqual([{ key: 'roof', label: 'Dach', text: 'dwuspadowy 40°' }])
    expect(specs(page('<table><tr><td>Powierzchnia zabudowy</td><td>95 m²</td></tr></table>'))).toEqual([])
    expect(withRoofPitchLine([], [{ key: 'roof_pitch', label: 'Kąt dachu', value: 30, unit: 'deg', raw: '30°' }])).toHaveLength(1)
  })
})
