/**
 * What an analysis is called, from what it analysed.
 *
 * The label and the model id are PART OF THE MODEL, so they are part of its
 * hash. They are therefore derived from the source package alone — never from
 * the job id, the clock or the request — so that one sealed input gives one
 * model hash however many times, through whichever door, it is analysed.
 */
import { sha256Hex } from '@buildapp/source-common'
import { SourceUrlRefused, routableBeforeFetch, validatePublicSourceUrlSecurity } from '@buildapp/source-package'
import type { SourceAdapter, SourcePackage } from '@buildapp/source-package'
import { AnalysisError } from './errors.js'
import type { AnalysisErrorCode } from './errors.js'

export type AnalysisIdentity = {
  /** File-name-safe, used for artifact names. */
  slug: string
  modelId: string
  /** The model's label: "<project title> (analysis)". */
  label: string
  /** The project as a person names it. */
  title: string
}

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
 * Two questions, answered separately since BUILDPLAN-INTEGRATION-004A:
 *
 *   1. Is the address SAFE to fetch? `validatePublicSourceUrlSecurity` in the
 *      source package — https, no credentials, the default port, a public
 *      host name. It requires no publisher. The SSRF checks that DO need the
 *      network (what the host resolves to, where each redirect and asset
 *      goes) run inside the acquisition on every hop; this is the cheap
 *      outer fence, not the only one.
 *   2. Can anything READ it? With a generic adapter registered, any safe page
 *      is inspected, and whether it is a house project is decided from the
 *      page (`routeSourceAcquisition`). Only a registry with no generic
 *      strategy refuses an unrecognised host before the fetch — a test, or a
 *      locked-down deployment that registers specialists alone.
 */
export function validateAnalysisUrl(raw: unknown, adapters: readonly SourceAdapter[]): URL {
  let url: URL
  try {
    url = validatePublicSourceUrlSecurity(raw).url
  } catch (e) {
    if (e instanceof SourceUrlRefused) {
      const code: AnalysisErrorCode = e.code === 'URL_INVALID' || e.code === 'SCHEME_NOT_ALLOWED' ? 'INVALID_URL' : 'SOURCE_UNSAFE'
      throw new AnalysisError(code, e.message)
    }
    throw e
  }
  if (!routableBeforeFetch(url, adapters)) throw new AnalysisError('UNSUPPORTED_PUBLISHER', `${url.hostname} is not a publisher this analyzer reads, and no generic reader is registered`)
  return url
}
