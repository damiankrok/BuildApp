/**
 * Is this URL safe to fetch on a user's behalf? — and nothing else.
 *
 * Until BUILDPLAN-INTEGRATION-004A one function answered two questions at
 * once: whether an address was SAFE (https, no credentials, no private host)
 * and whether a publisher adapter RECOGNISED it. A page on an unknown host
 * was refused before a byte of it had been looked at, which turned the list
 * of specialist adapters into an allowlist. The two questions are separate
 * and are answered here separately: this module is the security fence, and
 * publisher recognition (`router.ts`) runs only after it, on the fetched page.
 *
 * This is the fence that needs no network. It runs before a job is queued,
 * so a bad address costs nothing. The checks that DO need the network — what
 * a host resolves to, where each redirect goes, what each discovered asset
 * points at — run inside `safeFetch` (`net.ts`) on every hop, with the same
 * policy: this is the outer fence, not the only one, and neither one asks
 * which publisher a page belongs to.
 */
import type { FetchPolicy } from './net.js'
import { DEFAULT_FETCH_POLICY, isBlockedHostLiteral } from './net.js'
import { isIP } from 'node:net'

export type SourceUrlRefusalCode =
  /** Not a URL at all, or longer than a project page address has any reason to be. */
  | 'URL_INVALID'
  /** Not https. */
  | 'SCHEME_NOT_ALLOWED'
  /** `https://user:pw@…` — never fetched, whatever the host. */
  | 'URL_HAS_CREDENTIALS'
  /** A port other than the scheme's default. */
  | 'PORT_NOT_ALLOWED'
  /** A bare IP address instead of a host name: a project page has a publisher's name. */
  | 'HOST_IS_ADDRESS'
  /** localhost, `.local`, `.internal`, a private or link-local literal, a metadata name. */
  | 'HOST_BLOCKED'

export class SourceUrlRefused extends Error {
  constructor(
    readonly code: SourceUrlRefusalCode,
    readonly target: string,
    message: string,
  ) {
    super(message)
    this.name = 'SourceUrlRefused'
  }
}

export const MAX_SOURCE_URL_LENGTH = 2048

export type SourceUrlSecurity = {
  /** The address as it will be fetched: fragment removed, otherwise as given. */
  url: URL
  /** Which checks it passed, for a log or a test. */
  checks: readonly string[]
}

/**
 * The no-network safety checks for a user-supplied project page address.
 *
 * Throws `SourceUrlRefused` with a code that names the check that failed.
 * Returns the URL to fetch. Requires no publisher: an address on a host this
 * analyzer has never seen is as safe as one it knows, provided it is a public
 * https name — whether the page behind it is a house project is the ROUTER's
 * question, asked of the page, not of the host.
 */
export function validatePublicSourceUrlSecurity(raw: unknown, policy: Pick<FetchPolicy, 'allowedSchemes' | 'allowedPorts'> = DEFAULT_FETCH_POLICY): SourceUrlSecurity {
  if (typeof raw !== 'string' || raw.trim() === '') throw new SourceUrlRefused('URL_INVALID', String(raw ?? ''), 'give the project page address')
  const text = raw.trim()
  if (text.length > MAX_SOURCE_URL_LENGTH) throw new SourceUrlRefused('URL_INVALID', text.slice(0, 80), `the address is longer than ${MAX_SOURCE_URL_LENGTH} characters`)
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new SourceUrlRefused('URL_INVALID', text, 'the address is not a valid URL')
  }
  const checks: string[] = ['parsed']
  if (!policy.allowedSchemes.includes(url.protocol)) throw new SourceUrlRefused('SCHEME_NOT_ALLOWED', text, 'only https project pages are fetched')
  checks.push('https')
  if (url.username !== '' || url.password !== '') throw new SourceUrlRefused('URL_HAS_CREDENTIALS', text, 'an address carrying credentials is never fetched')
  checks.push('no-credentials')
  if (!policy.allowedPorts.includes(url.port)) throw new SourceUrlRefused('PORT_NOT_ALLOWED', text, 'a project page on a non-standard port is not fetched')
  checks.push('default-port')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === '') throw new SourceUrlRefused('URL_INVALID', text, 'the address names no host')
  if (isIP(host) !== 0 || /^[0-9.]+$/.test(host)) throw new SourceUrlRefused('HOST_IS_ADDRESS', text, 'give the publisher’s address, not an IP address')
  checks.push('named-host')
  if (isBlockedHostLiteral(url.hostname)) throw new SourceUrlRefused('HOST_BLOCKED', text, 'a local or private address is never fetched')
  checks.push('public-name')
  url.hash = ''
  return { url, checks }
}
