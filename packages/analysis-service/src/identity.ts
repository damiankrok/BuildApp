/**
 * What an analysis is called, from what it analysed.
 *
 * The label and the model id are PART OF THE MODEL, so they are part of its
 * hash. They are therefore derived from the source package alone — never from
 * the job id, the clock or the request — so that one sealed input gives one
 * model hash however many times, through whichever door, it is analysed.
 */
import { sha256Hex } from '@buildapp/source-common'
import type { SourceAdapter, SourcePackage } from '@buildapp/source-package'
import { AnalysisError } from './errors.js'

export type AnalysisIdentity = {
  /** File-name-safe, used for artifact names. */
  slug: string
  modelId: string
  /** The model's label: "<project title> (analysis)". */
  label: string
  /** The project as a person names it. */
  title: string
}

const MAX_URL_LENGTH = 2048

const safeSlug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

export function identityOf(pkg: SourcePackage, adapters: readonly SourceAdapter[] = []): AnalysisIdentity {
  const fromId = pkg.project.externalId ? safeSlug(pkg.project.externalId) : ''
  const slug = fromId.length >= 3 ? fromId : `u${sha256Hex(pkg.canonicalUrl).slice(0, 12)}`
  const adapter = adapters.find((a) => a.id === pkg.adapter.id)
  const title = (adapter?.displayTitle?.(pkg.project) ?? pkg.project.name ?? '').trim() || new URL(pkg.canonicalUrl).hostname
  return { slug, modelId: `m-analysis-${slug}`, label: `${title} (analysis)`, title }
}

/**
 * The address checks that need no network: run before a job is queued, so a
 * bad request is answered at once and never costs a worker.
 *
 * The SSRF checks that DO need the network — what the host resolves to, where
 * each redirect goes — run inside the acquisition on every hop; this is the
 * cheap outer fence, not the only one.
 */
export function validateAnalysisUrl(raw: unknown, adapters: readonly SourceAdapter[]): URL {
  if (typeof raw !== 'string' || raw.trim() === '') throw new AnalysisError('INVALID_URL', 'give the project page address as "url"')
  const text = raw.trim()
  if (text.length > MAX_URL_LENGTH) throw new AnalysisError('INVALID_URL', `the address is longer than ${MAX_URL_LENGTH} characters`)
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new AnalysisError('INVALID_URL', 'the address is not a valid URL')
  }
  if (url.protocol !== 'https:') throw new AnalysisError('INVALID_URL', 'only https project pages are analysed')
  if (url.username !== '' || url.password !== '') throw new AnalysisError('INVALID_URL', 'an address carrying credentials is never fetched')
  if (url.port !== '' && url.port !== '443') throw new AnalysisError('INVALID_URL', 'a project page on a non-standard port is not fetched')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (/^[0-9.]+$/.test(host) || host.includes(':')) throw new AnalysisError('INVALID_URL', 'give the publisher’s address, not an IP address')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new AnalysisError('INVALID_URL', 'a local address is never fetched')
  if (!adapters.some((a) => a.matches(url))) throw new AnalysisError('UNSUPPORTED_PUBLISHER', `${url.hostname} is not a publisher this analyzer reads`)
  url.hash = ''
  return url
}
