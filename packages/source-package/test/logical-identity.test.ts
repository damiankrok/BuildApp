import { canonicalJson } from '@buildapp/source-common'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FETCH_POLICY,
  FetchRefused,
  acquireSourcePackage,
  archonAdapter,
  declaredCanonicalUrl,
  isAttributionParameter,
  logicalSourceUrl,
  memoryByteCache,
  normaliseSourceUrl,
  type AcquireOptions,
  type FetchPolicy,
  type SourcePackage,
} from '../src/index.js'
import { PAGE_URL, assetUrl, pngBytes, projectPage, publicResolver, utf8, type StubRoute } from './helpers.js'

/**
 * BUILDPLAN-ANALYZER-005A: one project, many spellings.
 *
 * The OWNER opened the same house from an advertisement (`?_gl=…&gclid=…`) and
 * from the address bar. Before this stage the two sealed different package
 * ids and content hashes, so every later stage saw two sources. These are
 * metamorphic tests: each changes something that must not matter and asserts
 * that nothing that identifies the source moved — and, as a control, that
 * something that does matter still does.
 */

const HASH_PLAN = '7056fa04af38f4015f8f19d40910c89c'
const HASH_ELEVATION = 'b165fc1dadc0b7ef46c3d1d74725aea3'
const PLAN = assetUrl('rzut-parteru-projekt-test', 915, HASH_PLAN)
const PLAN_ORIGINAL = assetUrl('rzut-parteru-projekt-test', 11915, HASH_PLAN)
const ELEVATION = assetUrl('elewacja-frontowa-projekt-test', 264, HASH_ELEVATION)
const ELEVATION_ORIGINAL = assetUrl('elewacja-frontowa-projekt-test', 11264, HASH_ELEVATION)

const POLICY: FetchPolicy = { ...DEFAULT_FETCH_POLICY, retryDelayMs: 0 }

type Server = { fetchImpl: typeof fetch; calls: string[] }

/**
 * A server that, like a real one, ignores the query and the fragment of a
 * request when choosing what to serve — so an address with tracking
 * parameters gets the same page — and records every request as sent.
 */
function server(routes: Readonly<Record<string, StubRoute>>, options: { failFirst?: Record<string, number> } = {}): Server {
  const calls: string[] = []
  const failures = new Map(Object.entries(options.failFirst ?? {}))
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const sent = String(input)
    calls.push(sent)
    const url = new URL(sent)
    const key = `${url.origin}${url.pathname}`
    const pending = failures.get(key)
    if (pending !== undefined) {
      failures.delete(key)
      return new Response(null, { status: pending })
    }
    const route = routes[key]
    if (!route) return new Response(null, { status: 404 })
    const status = route.status ?? 200
    const headers: Record<string, string> = {}
    if (route.location !== undefined) headers.location = route.location
    if (route.mediaType !== undefined) headers['content-type'] = route.mediaType
    if (status >= 300 && status < 400) return new Response(null, { status, headers })
    return new Response(route.bytes ?? new Uint8Array(0), { status, headers })
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

const page = (images: string[], head = ''): StubRoute => ({
  bytes: utf8(projectPage(images.join('')).replace('</head>', `${head}</head>`)),
  mediaType: 'text/html; charset=utf-8',
})

function routes(images = [`<img src="${PLAN}" alt="rzut parteru">`, `<img src="${ELEVATION}" alt="elewacja frontowa">`], head = ''): Record<string, StubRoute> {
  return {
    [PAGE_URL]: page(images, head),
    [PLAN]: { bytes: pngBytes(320, 240, 1), mediaType: 'image/png' },
    [PLAN_ORIGINAL]: { bytes: pngBytes(640, 480, 2), mediaType: 'image/png' },
    [ELEVATION]: { bytes: pngBytes(400, 256, 3), mediaType: 'image/png' },
    [ELEVATION_ORIGINAL]: { bytes: pngBytes(800, 512, 4), mediaType: 'image/png' },
  }
}

const acquire = (url: string, net: Server, options: AcquireOptions = {}): Promise<SourcePackage> =>
  acquireSourcePackage(url, [archonAdapter], { policy: POLICY, deps: { fetchImpl: net.fetchImpl, resolve: publicResolver }, ...options })

/** Everything that identifies the source and its evidence; `requestedUrl` and `fetchedUrl` are provenance and may differ. */
const identity = (pkg: SourcePackage) => ({ id: pkg.id, canonicalUrl: pkg.canonicalUrl, contentHash: pkg.contentHash, evidence: canonicalJson({ assets: pkg.assets, facts: pkg.publishedFacts, rooms: pkg.publishedRooms, specifications: pkg.publishedSpecifications, failures: pkg.failures }) })

describe('the normalised spelling of an address', () => {
  it.each([
    ['gclid', `${PAGE_URL}?gclid=Cj0KCQjw`],
    ['the Google cross-domain linker', `${PAGE_URL}?_gl=1*2x916*_up*MQ..*_ga*MTIz`],
    ['utm_*', `${PAGE_URL}?utm_source=facebook&utm_medium=cpc&utm_campaign=wiosna`],
    ['fbclid and msclkid', `${PAGE_URL}?fbclid=IwAR0&msclkid=abc`],
    ['gbraid, wbraid, srsltid, mc_*', `${PAGE_URL}?gbraid=0AAA&wbraid=CjkK&srsltid=AfmB&mc_cid=1&mc_eid=2`],
    ['a fragment', `${PAGE_URL}#rzuty`],
    ['a trailing slash', `${PAGE_URL}/`],
    ['an upper-case host', PAGE_URL.replace('www.archon.pl', 'WWW.ARCHON.PL')],
    ['all of it at once', `${PAGE_URL.replace('www.archon.pl', 'Www.Archon.PL')}/?utm_source=x&gclid=y&_gl=z#top`],
  ])('drops %s', (_why, spelling) => {
    expect(normaliseSourceUrl(spelling)).toBe(PAGE_URL)
  })

  it('keeps a parameter that may select content, and sorts what it keeps', () => {
    expect(normaliseSourceUrl('https://example.pl/projekt?id=12&wariant=b&gclid=x')).toBe('https://example.pl/projekt?id=12&wariant=b')
    expect(normaliseSourceUrl('https://example.pl/projekt?wariant=b&id=12')).toBe('https://example.pl/projekt?id=12&wariant=b')
    // two projects that differ only in a query parameter stay two projects
    expect(normaliseSourceUrl('https://example.pl/projekt?id=12')).not.toBe(normaliseSourceUrl('https://example.pl/projekt?id=13'))
    // `ref` alone is not an attribution family: it stays
    expect(normaliseSourceUrl('https://example.pl/projekt?ref=7')).toBe('https://example.pl/projekt?ref=7')
  })

  it('classifies attribution by family, not by a list of two keys', () => {
    for (const key of ['utm_term', 'UTM_Content', 'gclid', 'dclid', 'yclid', 'ttclid', 'twclid', 'msclkid', '_gl', '_ga', 'mc_cid', '_hsenc', 'pk_campaign', 'mtm_source']) expect(isAttributionParameter(key), key).toBe(true)
    for (const key of ['id', 'page', 'wariant', 'ref', 'client', 'lang', 'q']) expect(isAttributionParameter(key), key).toBe(false)
  })
})

describe("the page's own canonical link", () => {
  const head = (href: string): string => `<!doctype html><html><head><link rel="canonical" href="${href}"></head><body></body></html>`

  it('is believed on the same registrable domain, resolved against the page', () => {
    expect(declaredCanonicalUrl(head('/projekty-domow/projekt-x-m0123456789abc'), 'https://www.archon.pl/a?b=1')).toBe('https://www.archon.pl/projekty-domow/projekt-x-m0123456789abc')
    expect(declaredCanonicalUrl(head('https://archon.pl/p'), 'https://www.archon.pl/p?x=1')).toBe('https://archon.pl/p')
  })

  it('is ignored when it names another site, a private host or plain http — a page may name itself, not claim to be another', () => {
    expect(declaredCanonicalUrl(head('https://evil.example/p'), 'https://www.archon.pl/p')).toBeUndefined()
    expect(declaredCanonicalUrl(head('https://localhost/p'), 'https://localhost.archon.pl/p')).toBeUndefined()
    expect(declaredCanonicalUrl(head('http://www.archon.pl/p'), 'https://www.archon.pl/p')).toBeUndefined()
    expect(declaredCanonicalUrl('<html><head></head></html>', 'https://www.archon.pl/p')).toBeUndefined()
  })

  it('wins over the fetched address, whose non-attribution parameters it can then name away', () => {
    const html = head('https://www.archon.pl/p')
    expect(logicalSourceUrl('https://www.archon.pl/p?sesja=42', html)).toEqual({ url: 'https://www.archon.pl/p', basis: 'DECLARED_CANONICAL' })
    expect(logicalSourceUrl('https://www.archon.pl/p?sesja=42', '<html></html>')).toEqual({ url: 'https://www.archon.pl/p?sesja=42', basis: 'FETCHED_ADDRESS' })
  })
})

describe('acquisition is invariant to how the page was reached', () => {
  it.each([
    ['an advertisement link', `${PAGE_URL}?_gl=1*2x916*_up*MQ..&gclid=Cj0KCQjw`],
    ['the same parameters in another order', `${PAGE_URL}?gclid=Cj0KCQjw&_gl=1*2x916*_up*MQ..`],
    ['a social link', `${PAGE_URL}?utm_source=facebook&utm_medium=social&fbclid=IwAR0`],
    ['an upper-case host', PAGE_URL.replace('www.archon.pl', 'WWW.ARCHON.PL')],
  ])('%s seals the same package as the clean address', async (_why, spelling) => {
    const clean = await acquire(PAGE_URL, server(routes()))
    const other = await acquire(spelling, server(routes()))
    expect(identity(other)).toEqual(identity(clean))
    expect(clean.requestedUrl).toBeUndefined()
    expect(other.canonicalUrl).toBe(PAGE_URL)
  })

  it('keeps the address the person gave as provenance, never as identity', async () => {
    const tracked = `${PAGE_URL}?gclid=Cj0KCQjw`
    const pkg = await acquire(tracked, server(routes()))
    expect(pkg.requestedUrl).toBe(tracked)
    expect(pkg.canonicalUrl).toBe(PAGE_URL)
  })

  it('a canonical redirect (trailing slash → the page) is the same package', async () => {
    const withRedirect = { ...routes(), [`${PAGE_URL}/`]: { status: 301, location: PAGE_URL } }
    const redirected = await acquire(`${PAGE_URL}/`, server(withRedirect))
    const clean = await acquire(PAGE_URL, server(routes()))
    expect(identity(redirected)).toEqual(identity(clean))
  })

  it('a page that declares its canonical address is named by it, whatever parameter reached it', async () => {
    const declared = routes(undefined, `<link rel="canonical" href="${PAGE_URL}">`)
    const viaParameter = await acquire(`${PAGE_URL}?sesja=42`, server(declared))
    const direct = await acquire(PAGE_URL, server(declared))
    expect(identity(viaParameter)).toEqual(identity(direct))
  })

  it('the order the page lists its drawings in does not change the package', async () => {
    const forward = await acquire(PAGE_URL, server(routes([`<img src="${PLAN}" alt="rzut parteru">`, `<img src="${ELEVATION}" alt="elewacja frontowa">`])))
    const reversed = await acquire(PAGE_URL, server(routes([`<img src="${ELEVATION}" alt="elewacja frontowa">`, `<img src="${PLAN}" alt="rzut parteru">`])))
    expect(identity(reversed)).toEqual(identity(forward))
  })

  it('CONTROL: a different project page is a different source', async () => {
    const otherPage = PAGE_URL.replace('projekt-test-', 'projekt-inny-')
    const other = await acquire(otherPage, server({ ...routes(), [otherPage]: routes()[PAGE_URL] }))
    const clean = await acquire(PAGE_URL, server(routes()))
    expect(other.canonicalUrl).not.toBe(clean.canonicalUrl)
    expect(other.id).not.toBe(clean.id)
  })
})

describe('an offline replay names the page as the live run did', () => {
  it('after a redirect, the cache remembers where the bytes were served from', async () => {
    const moved = `${PAGE_URL}/`
    const redirecting = { ...routes(), [PAGE_URL]: { status: 302, location: moved }, [moved]: routes()[PAGE_URL] }
    // the server strips nothing here: the slash is part of the path it serves
    const cache = memoryByteCache()
    const live = await acquire(PAGE_URL, server(redirecting), { cache })
    const replay = await acquire(PAGE_URL, server({}), { cache, offline: true })
    expect(live.fetchedUrl).toBe(moved)
    expect(live.canonicalUrl).toBe(PAGE_URL)
    expect(canonicalJson(replay)).toBe(canonicalJson(live))
  })
})

describe('a transient failure is tried once more; a definite one is evidence', () => {
  it('a plan copy that answers 503 once arrives on the second try, and the package equals the clean one', async () => {
    const clean = await acquire(PAGE_URL, server(routes()))
    const flaky = server(routes(), { failFirst: { [PLAN]: 503 } })
    const pkg = await acquire(PAGE_URL, flaky)
    expect(identity(pkg)).toEqual(identity(clean))
    expect(flaky.calls.filter((c) => c === PLAN)).toHaveLength(2)
  })

  it('a 404 on a guessed larger copy is not retried', async () => {
    const net = server({ ...routes(), [PLAN_ORIGINAL]: { status: 404 } })
    const pkg = await acquire(PAGE_URL, net)
    expect(net.calls.filter((c) => c === PLAN_ORIGINAL)).toHaveLength(1)
    const guess = pkg.failures.find((f) => f.target === PLAN_ORIGINAL)
    expect(guess?.code).toBe('HTTP_STATUS')
    expect(guess?.attempts).toBeUndefined()
    expect(guess?.claim?.channel).toBe('VARIANT_CONVENTION')
  })

  it('an exposed plan that fails twice is recorded with what it claimed to be and how often it was tried', async () => {
    const net = server(routes(), { failFirst: { [PLAN]: 503 } })
    // a second failure: wrap the server so the plan fails again
    const failing = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      String(input) === PLAN ? new Response(null, { status: 503 }) : net.fetchImpl(input, init)) as unknown as typeof fetch
    const pkg = await acquireSourcePackage(PAGE_URL, [archonAdapter], { policy: POLICY, deps: { fetchImpl: failing, resolve: publicResolver } })
    const lost = pkg.failures.find((f) => f.target === PLAN)
    expect(lost).toMatchObject({ code: 'HTTP_STATUS', attempts: 2, claim: { document: 'FLOOR_PLAN', storey: 'GROUND' } })
    expect(lost?.claim?.channel).not.toBe('VARIANT_CONVENTION')
  })
})

describe('a cancelled run is not a slow network', () => {
  it('an abort the fetch did not start propagates as ABORTED and is never retried', async () => {
    let calls = 0
    const cancelled = (async (input: Parameters<typeof fetch>[0]) => {
      if (String(input) === PAGE_URL) return new Response(routes()[PAGE_URL].bytes, { headers: { 'content-type': 'text/html' } })
      calls += 1
      throw new DOMException('the run was cancelled', 'AbortError')
    }) as unknown as typeof fetch
    await expect(acquireSourcePackage(PAGE_URL, [archonAdapter], { policy: POLICY, deps: { fetchImpl: cancelled, resolve: publicResolver } })).rejects.toMatchObject({ code: 'ABORTED' })
    expect(calls).toBe(1)
  })

  it('a body that stops arriving times out instead of hanging the acquisition', async () => {
    const stalled = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(utf8('<html><head>'))
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body, { headers: { 'content-type': 'text/html' } })
    }) as unknown as typeof fetch
    const error = await acquireSourcePackage(PAGE_URL, [archonAdapter], { policy: { ...POLICY, timeoutMs: 60 }, deps: { fetchImpl: stalled, resolve: publicResolver } }).catch((e: unknown) => e)
    expect((error as { failures?: Array<{ code: string; attempts?: number }> }).failures?.[0]).toMatchObject({ code: 'TIMEOUT', attempts: 2 })
    expect(error).not.toBeInstanceOf(FetchRefused)
  })
})
