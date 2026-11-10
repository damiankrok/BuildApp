/**
 * A site nobody has written an adapter for, on an in-memory internet: the synthetic sheets under its own file names,
 * on a page written the way a small publisher writes one. Shared by the analysis-service tests and the analyzer API's.
 */
import { LARCHFIELD, renderSheets } from '@buildapp/synthetic-drawings'
import type { FetchDeps } from '@buildapp/source-package'

export const HOST = 'domy.nieznany-wydawca.test'
export const PAGE = `https://${HOST}/oferta/dom-larchfield`
const PUBLIC = '93.184.215.14'

/**
 * A site with no adapter: the synthetic sheets under its own file names, on a
 * page written the way a small publisher writes one. The captions carry the
 * drawing words; nothing about this markup is shared with any real site.
 */
export function unknownPublisher(options: { drawings?: boolean; shell?: boolean; project?: boolean } = {}): { deps: FetchDeps; requests: string[] } {
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
