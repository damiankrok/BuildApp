/**
 * The logical address of a project page: what a page IS, as opposed to how it
 * was reached.
 *
 * One project is reached through many spellings of its address: a link from
 * an advertisement carries click identifiers (`gclid`, `_gl`, `utm_*`), a
 * shared link keeps a fragment, a bookmark gains a trailing slash, a browser
 * reorders nothing but a person pasting does. None of that is a different
 * page, and before this module each spelling sealed a different package id and
 * a different content hash — so the same house analysed from an advertisement
 * and from the address bar looked, to every later stage, like two sources.
 *
 * The rule is structural, never a list of known pages:
 *
 *   1. The page's OWN `<link rel="canonical">` wins, when it is a safe public
 *      https address on the same registrable domain as the page that declared
 *      it. A page may say what it is called; it may not claim to be another
 *      site.
 *   2. Otherwise the address the page was fetched from, normalised: host in
 *      lower case, default port and fragment dropped, the parameters that
 *      analytics and ad networks append for attribution removed by family,
 *      the remaining parameters sorted, a trailing slash folded.
 *
 * Parameters that are not attribution stay: a page whose project lives in its
 * query (`?id=123`) is a different page per value, and merging two houses into
 * one identity is worse than analysing one house twice.
 *
 * What is FETCHED never changes: the request goes to the address as given (a
 * CDN may need its query). Only the name of the result is logical.
 */
import { validatePublicSourceUrlSecurity } from './security.js'
import { decodeEntities } from './discovery.js'
import { compareCodeUnits } from './text.js'

/**
 * Attribution parameters, by family. Each entry is a convention published by
 * an analytics or advertising system for marking where a click came from; none
 * of them selects content.
 */
const ATTRIBUTION_PREFIXES = ['utm_', 'mc_', '_hs', 'pk_', 'mtm_', 'ga_'] as const
const ATTRIBUTION_KEYS = new Set([
  // click identifiers of ad networks (`…clid` is matched as a suffix below; these do not end in it)
  'gbraid',
  'wbraid',
  'gad_source',
  'gad_campaignid',
  'srsltid',
  'igshid',
  'mkt_tok',
  'li_fat_id',
  'epik',
  // Google's cross-domain linker and analytics client ids
  '_gl',
  '_ga',
  '_gac',
  '_gid',
  // referral markers that name the linking site, not the page
  'ref_src',
  'ref_url',
])

/** True when a query parameter only records where a visitor came from. */
export function isAttributionParameter(key: string): boolean {
  const k = key.toLowerCase()
  if (ATTRIBUTION_KEYS.has(k)) return true
  if (ATTRIBUTION_PREFIXES.some((p) => k.startsWith(p))) return true
  // gclid, dclid, fbclid, msclkid, yclid, ttclid, twclid, ...
  return /^[a-z]{0,6}cli?k?id$/.test(k)
}

/**
 * The normalised spelling of an address. Pure; throws only on a string that
 * is not a URL at all.
 */
export function normaliseSourceUrl(raw: string | URL): string {
  const url = new URL(raw.toString())
  url.hash = ''
  const kept = [...url.searchParams.entries()].filter(([key]) => !isAttributionParameter(key))
  kept.sort(([ka, va], [kb, vb]) => compareCodeUnits(ka, kb) || compareCodeUnits(va, vb))
  url.search = ''
  for (const [k, v] of kept) url.searchParams.append(k, v)
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  // `URL` keeps a bare `?` when the search is emptied through `searchParams`
  const text = url.toString()
  return text.endsWith('?') ? text.slice(0, -1) : text
}

/**
 * The registrable part of a host name: `www.example.co.uk` → `example.co.uk`,
 * `assets.example.pl` → `example.pl`. An approximation of the public suffix
 * list, on the side of caution: a two-letter country code under a short
 * second level (`co`, `com`, `org`, `net`, `edu`, `gov`, `ac`) takes three
 * labels, everything else two.
 */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const [tld, second] = [labels[labels.length - 1], labels[labels.length - 2]]
  const three = tld.length === 2 && ['co', 'com', 'org', 'net', 'edu', 'gov', 'ac'].includes(second)
  return labels.slice(three ? -3 : -2).join('.')
}

const attribute = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined
}

/**
 * The canonical address a page declares for itself, when it may be believed:
 * resolved against the page, a public https address, same registrable domain.
 * Undefined otherwise — an absent, relative-garbage or foreign canonical link
 * is ignored, never an error.
 */
export function declaredCanonicalUrl(html: string, pageUrl: string): string | undefined {
  const head = /<head\b[\s\S]*?<\/head>/i.exec(html)?.[0] ?? html
  for (const m of head.matchAll(/<link\b([^>]*)>/gi)) {
    const rel = attribute(m[1], 'rel')?.toLowerCase().split(/\s+/)
    if (!rel?.includes('canonical')) continue
    const href = attribute(m[1], 'href')?.trim()
    if (!href) return undefined
    let resolved: URL
    try {
      resolved = validatePublicSourceUrlSecurity(new URL(href, pageUrl).toString()).url
    } catch {
      return undefined
    }
    return registrableDomain(resolved.hostname) === registrableDomain(new URL(pageUrl).hostname) ? resolved.toString() : undefined
  }
  return undefined
}

/** How the logical address was decided, for the package's provenance. */
export type LogicalUrlBasis = 'DECLARED_CANONICAL' | 'FETCHED_ADDRESS'

/** The page's logical address, and what decided it. */
export function logicalSourceUrl(pageUrl: string, html: string): { url: string; basis: LogicalUrlBasis } {
  const declared = declaredCanonicalUrl(html, pageUrl)
  return declared !== undefined ? { url: normaliseSourceUrl(declared), basis: 'DECLARED_CANONICAL' } : { url: normaliseSourceUrl(pageUrl), basis: 'FETCHED_ADDRESS' }
}
