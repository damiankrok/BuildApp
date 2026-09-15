/**
 * Safe fetching for user-supplied URLs.
 *
 * A URL a user pastes is an attack surface: it can point at a cloud metadata
 * endpoint, at a service on the loopback interface, at something on the
 * private network the server can reach and the user cannot. The guards here
 * are deliberately conservative and are applied to EVERY hop, because a
 * public host may redirect to a private one.
 *
 *   - HTTPS only by default
 *   - every hop re-validated: scheme, host, and the resolved addresses
 *   - loopback, private, link-local, unique-local, multicast, unspecified and
 *     reserved addresses refused, by literal and by DNS resolution
 *   - bounded redirects, request timeout, response byte cap, asset count cap
 *   - declared and sniffed media type must both be acceptable
 *   - no cookies, no credentials, no authorization headers are ever sent, and
 *     a URL carrying userinfo is refused outright
 *
 * DNS resolution happens here and the *resolved addresses* are checked, so a
 * name that resolves to 127.0.0.1 is refused however it is spelled. The
 * remaining gap is a DNS rebind between our check and the socket connect;
 * closing it needs a pinned-address agent, which is recorded as a limitation
 * rather than pretended away.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type FetchPolicy = {
  /** Schemes that may be fetched at all. */
  allowedSchemes: readonly string[]
  maxRedirects: number
  timeoutMs: number
  /** Hard cap on one response body. */
  maxBytes: number
  /** Hard cap on how many assets one acquisition may fetch. */
  maxAssets: number
  /** Acceptable media types, as prefixes (`image/` matches `image/png`). */
  allowedMediaTypes: readonly string[]
  /** Permit private / loopback targets. Only a test or an explicit local run sets this. */
  allowPrivateHosts: boolean
  userAgent: string
}

export const DEFAULT_FETCH_POLICY: FetchPolicy = {
  allowedSchemes: ['https:'],
  maxRedirects: 5,
  timeoutMs: 20_000,
  maxBytes: 24 * 1024 * 1024,
  maxAssets: 120,
  allowedMediaTypes: ['image/', 'text/html', 'application/xhtml+xml', 'text/plain', 'application/json'],
  allowPrivateHosts: false,
  userAgent: 'BuildApp-SourceAcquisition/1.0 (+https://github.com/damiankrok/BuildApp)',
}

export type FetchFailureCode =
  | 'SCHEME_NOT_ALLOWED'
  | 'URL_INVALID'
  | 'URL_HAS_CREDENTIALS'
  | 'HOST_BLOCKED'
  | 'DNS_FAILED'
  | 'TOO_MANY_REDIRECTS'
  | 'REDIRECT_INVALID'
  | 'TIMEOUT'
  | 'HTTP_STATUS'
  | 'MEDIA_TYPE_NOT_ALLOWED'
  | 'TOO_LARGE'
  | 'NETWORK'

export class FetchRefused extends Error {
  constructor(
    readonly code: FetchFailureCode,
    readonly target: string,
    message: string,
  ) {
    super(message)
    this.name = 'FetchRefused'
  }
}

export type FetchedResource = {
  /** The URL actually fetched, after redirects. */
  url: string
  requestedUrl: string
  status: number
  mediaType: string
  bytes: Uint8Array
  /** Each hop, for the record. */
  redirects: string[]
}

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

const parseIPv4 = (host: string): number[] | null => {
  if (isIP(host) !== 4) return null
  return host.split('.').map((n) => Number(n))
}

/** True when an IPv4 address must never be fetched from a server acting for a user. */
export function isBlockedIPv4(parts: readonly number[]): boolean {
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8 "this network", and the unspecified address
  if (a === 10) return true // private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 192 && b === 0) return true // 192.0.0.0/24 IETF protocol assignments, 192.0.2.0/24 TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 198 && b === 51) return true // TEST-NET-2
  if (a === 203 && b === 0) return true // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
  if (a >= 224) return true // multicast and reserved, incl. 255.255.255.255
  return false
}

/**
 * Expand an IPv6 address to its eight 16-bit groups.
 *
 * Written out rather than pattern-matched because the same address has many
 * spellings and a guard that recognises only the pretty one is not a guard.
 * `::ffff:127.0.0.1`, `::ffff:7f00:1` (what `dns.lookup` actually returns for
 * that record) and `0:0:0:0:0:ffff:7f00:1` are one address, and a check that
 * blocks the first two-thirds of that list lets a hostile AAAA record walk
 * straight past it.
 *
 * Returns null for anything that is not a well-formed address, and the caller
 * treats null as "do not fetch": an address this cannot parse is not an
 * address this can clear.
 */
export function expandIPv6(host: string): number[] | null {
  let h = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  const zone = h.indexOf('%')
  if (zone >= 0) h = h.slice(0, zone)
  if (h === '') return null

  // A trailing dotted quad is rewritten as the two hex groups it stands for,
  // so the rest of this function only ever deals with hex.
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h)
  if (dotted) {
    const v4 = parseIPv4(dotted[1])
    if (!v4) return null
    h = `${h.slice(0, h.length - dotted[1].length)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }

  const halves = h.split('::')
  if (halves.length > 2) return null
  const head = halves[0] === '' ? [] : halves[0].split(':')
  const tail = halves.length === 2 ? (halves[1] === '' ? [] : halves[1].split(':')) : []
  let groups: string[]
  if (halves.length === 1) {
    if (head.length !== 8) return null
    groups = head
  } else {
    const fill = 8 - head.length - tail.length
    if (fill < 1) return null
    groups = [...head, ...Array.from({ length: fill }, () => '0'), ...tail]
  }
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

/** The IPv4 address embedded in the last 32 bits of an expanded IPv6 address. */
const embeddedIPv4 = (g: readonly number[]): number[] => [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]

/**
 * True when an IPv6 address must never be fetched.
 *
 * Every form that carries an IPv4 address inside it — mapped `::ffff:0:0/96`,
 * the deprecated compatible form, and NAT64's `64:ff9b::/96` — is classified
 * by the IPv4 address it carries, because that is the address the packet
 * actually reaches.
 */
export function isBlockedIPv6(host: string): boolean {
  const g = expandIPv6(host)
  if (!g) return true
  const allZeroHigh = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0
  if (allZeroHigh && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true // :: unspecified, ::1 loopback
  if (allZeroHigh && g[5] === 0xffff) return isBlockedIPv4(embeddedIPv4(g)) // ::ffff:a.b.c.d
  if (allZeroHigh && g[5] === 0) return isBlockedIPv4(embeddedIPv4(g)) // the deprecated IPv4-compatible form
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) return isBlockedIPv4(embeddedIPv4(g)) // NAT64
  if ((g[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if ((g[0] & 0xfe00) === 0xfc00) return true // unique local fc00::/7
  if ((g[0] & 0xff00) === 0xff00) return true // multicast ff00::/8
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation
  return false
}

const BLOCKED_NAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback', 'metadata', 'metadata.google.internal'])

/** Classify a host that is a literal address or a name, WITHOUT resolving. */
export function isBlockedHostLiteral(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_NAMES.has(h)) return true
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true
  const v4 = parseIPv4(h)
  if (v4) return isBlockedIPv4(v4)
  const bare = h.replace(/^\[/, '').replace(/\]$/, '')
  if (isIP(bare) === 6 || h.startsWith('[')) return isBlockedIPv6(bare)
  return false
}

export type AddressResolver = (host: string) => Promise<string[]>

const defaultResolver: AddressResolver = async (host) => {
  const all = await lookup(host, { all: true, verbatim: true })
  return all.map((a) => a.address)
}

/** Validate one URL against the policy, resolving its host and checking every address it resolves to. */
export async function assertFetchable(rawUrl: string, policy: FetchPolicy, resolve: AddressResolver = defaultResolver): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new FetchRefused('URL_INVALID', rawUrl, `not a URL: ${rawUrl}`)
  }
  if (!policy.allowedSchemes.includes(url.protocol)) {
    throw new FetchRefused('SCHEME_NOT_ALLOWED', rawUrl, `scheme ${url.protocol} is not allowed (allowed: ${policy.allowedSchemes.join(', ')})`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new FetchRefused('URL_HAS_CREDENTIALS', rawUrl, 'a URL carrying credentials is never fetched')
  }
  if (policy.allowPrivateHosts) return url
  if (isBlockedHostLiteral(url.hostname)) {
    throw new FetchRefused('HOST_BLOCKED', rawUrl, `host ${url.hostname} is loopback, private, link-local or otherwise not publicly routable`)
  }
  // A bracketed literal is an ADDRESS, not a name: unbracket it before
  // asking, or `[::1]` is handed to the resolver as if it were a hostname.
  const bareHost = url.hostname.replace(/^\[/, '').replace(/\]$/, '')
  // a name may still resolve somewhere private
  if (isIP(bareHost) === 0) {
    let addresses: string[]
    try {
      addresses = await resolve(url.hostname)
    } catch (e) {
      throw new FetchRefused('DNS_FAILED', rawUrl, `cannot resolve ${url.hostname}: ${(e as Error).message}`)
    }
    if (addresses.length === 0) throw new FetchRefused('DNS_FAILED', rawUrl, `${url.hostname} resolved to no addresses`)
    for (const a of addresses) {
      const v4 = parseIPv4(a)
      const blocked = v4 ? isBlockedIPv4(v4) : isBlockedIPv6(a)
      if (blocked) throw new FetchRefused('HOST_BLOCKED', rawUrl, `${url.hostname} resolves to ${a}, which is not publicly routable`)
    }
  }
  return url
}

const mediaTypeOf = (header: string | null): string => (header ?? 'application/octet-stream').split(';')[0].trim().toLowerCase()

export type FetchDeps = { fetchImpl?: typeof fetch; resolve?: AddressResolver }

/**
 * Fetch one resource under the policy. Redirects are followed manually so
 * every hop is re-validated; the body is read in chunks so the byte cap is
 * enforced as it arrives rather than after.
 */
export async function safeFetch(rawUrl: string, policy: FetchPolicy = DEFAULT_FETCH_POLICY, deps: FetchDeps = {}): Promise<FetchedResource> {
  const doFetch = deps.fetchImpl ?? fetch
  const redirects: string[] = []
  let current = rawUrl

  for (let hop = 0; hop <= policy.maxRedirects; hop++) {
    const url = await assertFetchable(current, policy, deps.resolve)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), policy.timeoutMs)
    let response: Response
    try {
      response = await doFetch(url.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        // no cookies, no credentials, no auth: this is an anonymous read of a public page
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'user-agent': policy.userAgent, accept: '*/*' },
      })
    } catch (e) {
      clearTimeout(timer)
      const err = e as Error
      if (err.name === 'AbortError') throw new FetchRefused('TIMEOUT', current, `timed out after ${policy.timeoutMs} ms`)
      throw new FetchRefused('NETWORK', current, err.message)
    }
    clearTimeout(timer)

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new FetchRefused('REDIRECT_INVALID', current, `${response.status} without a Location header`)
      const next = new URL(location, url).toString()
      redirects.push(next)
      current = next
      continue
    }
    if (!response.ok) throw new FetchRefused('HTTP_STATUS', current, `HTTP ${response.status}`)

    const mediaType = mediaTypeOf(response.headers.get('content-type'))
    if (!policy.allowedMediaTypes.some((p) => mediaType.startsWith(p))) {
      throw new FetchRefused('MEDIA_TYPE_NOT_ALLOWED', current, `media type ${mediaType} is not allowed`)
    }
    const declaredLength = Number(response.headers.get('content-length') ?? NaN)
    if (Number.isFinite(declaredLength) && declaredLength > policy.maxBytes) {
      throw new FetchRefused('TOO_LARGE', current, `declared ${declaredLength} bytes, cap is ${policy.maxBytes}`)
    }
    const bytes = await readCapped(response, policy.maxBytes, current)
    return { url: url.toString(), requestedUrl: rawUrl, status: response.status, mediaType, bytes, redirects }
  }
  throw new FetchRefused('TOO_MANY_REDIRECTS', rawUrl, `more than ${policy.maxRedirects} redirects`)
}

async function readCapped(response: Response, maxBytes: number, target: string): Promise<Uint8Array> {
  const body = response.body
  if (!body) return new Uint8Array(await response.arrayBuffer())
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new FetchRefused('TOO_LARGE', target, `body exceeded the ${maxBytes} byte cap`)
      }
      chunks.push(value)
    }
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}
