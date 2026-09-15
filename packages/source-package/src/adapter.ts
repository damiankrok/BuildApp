/**
 * Source adapters.
 *
 * An adapter knows one publisher: how to tell its project pages apart from
 * everything else, where its assets hide, what its filenames mean, and how to
 * read its published figures. Everything an adapter returns is a CLAIM with
 * evidence; nothing it returns is geometry, and nothing it returns is trusted
 * about size — dimensions always come from the bytes.
 *
 * The generic pipeline (`acquire.ts`) owns fetching, decoding, grouping,
 * selection and sealing, so a new publisher costs one adapter and changes
 * nothing about how a package behaves.
 */
import type { DiscoveredCandidate, DiscoveryChannel } from './discovery.js'
import type { PublishedFact, PublishedRoom } from './schema.js'
import type { RoleClaim } from './roles.js'

export type ProjectIdentity = { externalId?: string; name?: string; publisher: string }

export type AdapterContext = {
  /** The page URL, after redirects. */
  url: string
  html: string
  /** Fetch more markup from a discovery endpoint the adapter asks for. Returns null when the fetch failed. */
  fetchText: (url: string) => Promise<string | null>
}

export type SourceAdapter = {
  id: string
  version: string
  /** True when this adapter understands the URL. */
  matches: (url: URL) => boolean
  identify: (ctx: AdapterContext) => ProjectIdentity
  /** Every candidate address the page and its endpoints expose. */
  discover: (ctx: AdapterContext) => Promise<DiscoveredCandidate[]>
  /**
   * Other addresses worth TRYING for a known one, under a publisher's
   * naming convention. A guess is a hypothesis: it costs one request, and a
   * failure is recorded as positive evidence that no such copy is published.
   */
  resolutionCandidates: (url: string) => string[]
  /** What this address is, from its name and the channel it arrived through. */
  roleClaims: (candidate: DiscoveredCandidate) => RoleClaim[]
  /** A key that forces candidates into the same logical asset regardless of naming, or undefined. */
  groupKey?: (candidate: DiscoveredCandidate) => string | undefined
  parsePublished: (ctx: AdapterContext) => { facts: PublishedFact[]; rooms: PublishedRoom[] }
}

/** Claims derived purely from the channel, common to every publisher. */
export function channelClaims(channel: DiscoveryChannel): RoleClaim[] {
  if (channel === 'DOCUMENT_LINK') return [{ document: 'UNKNOWN', signal: 'channel', detail: 'a linked document, not an image', confidence: 0.3 }]
  return []
}
