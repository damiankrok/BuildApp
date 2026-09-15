import { describe, expect, it } from 'vitest'
import { DEFAULT_FETCH_POLICY, FetchRefused, assertFetchable, isBlockedIPv6, safeFetch, type FetchPolicy } from '../src/index.js'
import { loopbackResolver, publicResolver, pngBytes, stubFetch, utf8 } from './helpers.js'

/**
 * A URL a user pastes is an attack surface. Every case here is a target that a
 * server acting for a user must never reach, and each is spelled a DIFFERENT
 * way — by name, by literal, by IPv6, by IPv4-mapped IPv6, by a public name
 * that resolves somewhere private — because a guard that only pattern-matches
 * the string "localhost" stops none of the others.
 *
 * No test here touches a real resolver or a real socket: `resolve` and
 * `fetchImpl` are injected, so a private service cannot be contacted even by a
 * test that is wrong.
 */

/** Run `fn` and return the FetchRefused it must throw. Fails the test if it returns or throws anything else. */
async function refusal(fn: () => Promise<unknown>): Promise<FetchRefused> {
  let caught: unknown
  try {
    await fn()
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(FetchRefused)
  return caught as FetchRefused
}

describe('assertFetchable — SSRF refusals, by every spelling of the same target', () => {
  it('refuses a non-https scheme and a URL carrying credentials before it looks at the host at all', () => {
    // an http: hop is refused even to a host that would otherwise be fine: the content
    // could be rewritten in flight, and the policy is https-only by default
    return Promise.all([
      refusal(() => assertFetchable('http://www.archon.pl/x', DEFAULT_FETCH_POLICY, publicResolver)).then((e) => expect(e.code).toBe('SCHEME_NOT_ALLOWED')),
      refusal(() => assertFetchable('file:///etc/passwd', DEFAULT_FETCH_POLICY, publicResolver)).then((e) => expect(e.code).toBe('SCHEME_NOT_ALLOWED')),
      // userinfo in a URL is how a fetcher is tricked into authenticating somewhere
      refusal(() => assertFetchable('https://admin:hunter2@www.archon.pl/x', DEFAULT_FETCH_POLICY, publicResolver)).then((e) => expect(e.code).toBe('URL_HAS_CREDENTIALS')),
      refusal(() => assertFetchable('not a url at all', DEFAULT_FETCH_POLICY, publicResolver)).then((e) => expect(e.code).toBe('URL_INVALID')),
    ])
  })

  it('refuses loopback, private, link-local and cloud-metadata targets written as literals or as names', async () => {
    const blocked = [
      'https://localhost/admin', // by name
      'https://127.0.0.1/admin', // loopback, by literal
      'https://10.0.0.1/admin', // RFC1918 class A
      'https://192.168.1.1/admin', // RFC1918 class C — a home router's admin page
      'https://172.16.0.1/admin', // RFC1918 class B, the range most often forgotten
      'https://169.254.169.254/latest/meta-data/', // the cloud metadata endpoint: credentials live here
      'https://[::1]/admin', // loopback over IPv6
      'https://vault.internal/secret', // an internal naming convention, never publicly routable
    ]
    for (const url of blocked) {
      const e = await refusal(() => assertFetchable(url, DEFAULT_FETCH_POLICY, publicResolver))
      expect([url, e.code]).toEqual([url, 'HOST_BLOCKED'])
    }
  })

  it('classifies an IPv4-mapped IPv6 address by the IPv4 address inside it, not by the IPv6 prefix', () => {
    // `::ffff:127.0.0.1` IS the loopback interface; a guard that only knew the dotted
    // IPv4 forms would wave it through. This is the form `dns.lookup` hands back for an
    // AAAA record written that way, which is the shape the resolver check below sees.
    //
    // NOTE: the bracketed URL literal `https://[::ffff:127.0.0.1]/` is NOT caught today,
    // because the URL parser normalises it to `[::ffff:7f00:1]` and the mapped-address
    // rule only recognises the dotted spelling. That gap is reported, not asserted here.
    expect(isBlockedIPv6('::ffff:127.0.0.1')).toBe(true)
    expect(isBlockedIPv6('::ffff:10.0.0.5')).toBe(true)
    expect(isBlockedIPv6('fe80::1')).toBe(true) // link-local
    expect(isBlockedIPv6('fd00::1')).toBe(true) // unique local
    expect(isBlockedIPv6('2606:4700:4700::1111')).toBe(false) // an ordinary public address
  })

  it('refuses a public name whose AAAA answer is an IPv4-mapped loopback address', async () => {
    const e = await refusal(() => assertFetchable('https://sneaky.example.com/x', DEFAULT_FETCH_POLICY, async () => ['::ffff:127.0.0.1']))
    expect(e.code).toBe('HOST_BLOCKED')
  })

  it('refuses a name as soon as ONE of its addresses is private, even when the others are public', async () => {
    // a multi-homed answer is only as safe as its worst address: the connect picks one
    const e = await refusal(() => assertFetchable('https://mixed.example.com/x', DEFAULT_FETCH_POLICY, async () => ['93.184.216.34', '10.1.2.3']))
    expect(e.code).toBe('HOST_BLOCKED')
    expect(e.message).toContain('10.1.2.3')
  })

  it('refuses a name that resolves to nothing, rather than letting the fetch decide', async () => {
    const empty = await refusal(() => assertFetchable('https://void.example.com/x', DEFAULT_FETCH_POLICY, async () => []))
    expect(empty.code).toBe('DNS_FAILED')
    const failing = await refusal(() =>
      assertFetchable('https://broken.example.com/x', DEFAULT_FETCH_POLICY, async () => {
        throw new Error('ENOTFOUND')
      }),
    )
    expect(failing.code).toBe('DNS_FAILED')
  })

  it('refuses a perfectly public NAME that resolves to a private address, because the name is not the target', async () => {
    // This is the case a string-matching guard cannot see: the host is a normal public
    // name, and only the resolved address says it points at the loopback interface.
    const e = await refusal(() => assertFetchable('https://totally-legit.example.com/x', DEFAULT_FETCH_POLICY, loopbackResolver))
    expect(e.code).toBe('HOST_BLOCKED')
    expect(e.message).toContain('127.0.0.1')
  })

  it('accepts an ordinary public https URL whose every resolved address is publicly routable', async () => {
    const url = await assertFetchable('https://www.archon.pl/projekty-domow/projekt-x-m2fa281446a8ca', DEFAULT_FETCH_POLICY, publicResolver)
    expect(url.hostname).toBe('www.archon.pl')
    expect(url.protocol).toBe('https:')
  })
})

describe('safeFetch — every redirect hop is re-validated', () => {
  const policy: FetchPolicy = { ...DEFAULT_FETCH_POLICY, maxRedirects: 2 }

  it('refuses a redirect from a public host into a private one, on the hop rather than after it', async () => {
    // The whole point of following redirects by hand: the FIRST hop is a public page
    // and passes every check, and the target it names is the attack.
    const toHttpLocalhost = stubFetch({ 'https://www.archon.pl/a': { status: 302, location: 'http://localhost/admin' } })
    const e1 = await refusal(() => safeFetch('https://www.archon.pl/a', policy, { fetchImpl: toHttpLocalhost.fetchImpl, resolve: publicResolver }))
    expect(e1.code).toBe('SCHEME_NOT_ALLOWED')
    expect(e1.target).toBe('http://localhost/admin')

    const toHttpsLocalhost = stubFetch({ 'https://www.archon.pl/a': { status: 302, location: 'https://localhost/admin' } })
    const e2 = await refusal(() => safeFetch('https://www.archon.pl/a', policy, { fetchImpl: toHttpsLocalhost.fetchImpl, resolve: publicResolver }))
    expect(e2.code).toBe('HOST_BLOCKED')
  })

  it('stops a redirect chain longer than the policy allows instead of following it forever', async () => {
    // a redirect loop is otherwise an unbounded fetch; the cap is what makes the
    // acquisition's cost knowable in advance
    const net = stubFetch({
      'https://www.archon.pl/1': { status: 302, location: 'https://www.archon.pl/2' },
      'https://www.archon.pl/2': { status: 302, location: 'https://www.archon.pl/3' },
      'https://www.archon.pl/3': { status: 302, location: 'https://www.archon.pl/4' },
      'https://www.archon.pl/4': { status: 302, location: 'https://www.archon.pl/5' },
    })
    const e = await refusal(() => safeFetch('https://www.archon.pl/1', policy, { fetchImpl: net.fetchImpl, resolve: publicResolver }))
    expect(e.code).toBe('TOO_MANY_REDIRECTS')
    // maxRedirects = 2 means three requests were made and the fourth hop was refused
    expect(net.calls.map((c) => c.url)).toEqual(['https://www.archon.pl/1', 'https://www.archon.pl/2', 'https://www.archon.pl/3'])
  })

  it('follows an allowed redirect and records every hop it took', async () => {
    const bytes = pngBytes(4, 4)
    const net = stubFetch({
      'https://www.archon.pl/old': { status: 301, location: 'https://assets.archon.pl/new.png' },
      'https://assets.archon.pl/new.png': { bytes, mediaType: 'image/png' },
    })
    const r = await safeFetch('https://www.archon.pl/old', policy, { fetchImpl: net.fetchImpl, resolve: publicResolver })
    expect(r.url).toBe('https://assets.archon.pl/new.png')
    expect(r.requestedUrl).toBe('https://www.archon.pl/old')
    expect(r.redirects).toEqual(['https://assets.archon.pl/new.png'])
    expect(r.bytes).toEqual(bytes)
  })
})

describe('safeFetch — caps, allowlists, and what is never sent', () => {
  const policy: FetchPolicy = { ...DEFAULT_FETCH_POLICY, maxBytes: 1000 }

  it('refuses a response whose declared content-length is over the cap, without reading the body', async () => {
    const net = stubFetch({
      'https://assets.archon.pl/huge.png': { bytes: pngBytes(4, 4), mediaType: 'image/png', headers: { 'content-length': '50000000' } },
    })
    const e = await refusal(() => safeFetch('https://assets.archon.pl/huge.png', policy, { fetchImpl: net.fetchImpl, resolve: publicResolver }))
    expect(e.code).toBe('TOO_LARGE')
    expect(e.message).toContain('declared')
  })

  it('refuses a response whose BODY exceeds the cap even when it declared nothing, because the header is the server’s claim', async () => {
    // A server that omits content-length (or lies about it) must not be able to make the
    // fetcher buffer an unbounded body; the cap is enforced as the bytes arrive.
    const net = stubFetch({ 'https://assets.archon.pl/sneaky.png': { bytes: pngBytes(40, 40), mediaType: 'image/png' } })
    const e = await refusal(() => safeFetch('https://assets.archon.pl/sneaky.png', policy, { fetchImpl: net.fetchImpl, resolve: publicResolver }))
    expect(e.code).toBe('TOO_LARGE')
    expect(e.message).toContain('exceeded')
  })

  it('refuses a media type outside the allowlist, so an acquisition cannot be pointed at an arbitrary download', async () => {
    const net = stubFetch({ 'https://assets.archon.pl/plans.zip': { bytes: utf8('PK'), mediaType: 'application/zip' } })
    const e = await refusal(() => safeFetch('https://assets.archon.pl/plans.zip', DEFAULT_FETCH_POLICY, { fetchImpl: net.fetchImpl, resolve: publicResolver }))
    expect(e.code).toBe('MEDIA_TYPE_NOT_ALLOWED')
    expect(e.message).toContain('application/zip')
  })

  it('reports an HTTP error status as a refusal rather than treating the error page as content', async () => {
    const net = stubFetch({})
    const e = await refusal(() => safeFetch('https://assets.archon.pl/gone.png', DEFAULT_FETCH_POLICY, { fetchImpl: net.fetchImpl, resolve: publicResolver }))
    expect(e.code).toBe('HTTP_STATUS')
    expect(e.message).toContain('404')
  })

  it('sends no cookies, no credentials and no authorization — this is an anonymous read of a public page', async () => {
    const net = stubFetch({ 'https://assets.archon.pl/a.png': { bytes: pngBytes(4, 4), mediaType: 'image/png' } })
    await safeFetch('https://assets.archon.pl/a.png', DEFAULT_FETCH_POLICY, { fetchImpl: net.fetchImpl, resolve: publicResolver })
    expect(net.calls).toHaveLength(1)
    const init = net.calls[0].init
    // whatever ambient credentials the process holds, none of them may ride along
    expect(init.credentials).toBe('omit')
    expect(init.referrerPolicy).toBe('no-referrer')
    // redirects are followed by hand so each hop can be re-validated; the platform must not do it for us
    expect(init.redirect).toBe('manual')
    const headerNames = Object.keys(init.headers as Record<string, string>).map((k) => k.toLowerCase())
    expect(headerNames.sort()).toEqual(['accept', 'user-agent'])
    expect(headerNames).not.toContain('cookie')
    expect(headerNames).not.toContain('authorization')
  })
})
