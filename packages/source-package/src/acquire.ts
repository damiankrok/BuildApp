/**
 * Acquisition — the ONE authoritative path from a URL to a sealed
 * SourcePackage.
 *
 * Every consumer (CLI, benchmark, browser debug surface) reads the package
 * this function produces. None of them scrapes, none of them chooses a
 * resolution, none of them classifies a role. That is the whole point: when
 * two consumers disagreed about a building it was because each had silently
 * picked a different copy of the same drawing, and nothing recorded which.
 *
 * The order of the steps is load-bearing:
 *
 *   discover (generous, dumb)
 *     -> fetch and DECODE every candidate
 *       -> group into logical assets
 *         -> select within each group, on measured pixels
 *           -> classify roles
 *             -> seal with a content hash
 *
 * Selection happens AFTER measurement, so a choice is never made on a URL's
 * shape. A candidate that fails is recorded as a failure, never dropped: a
 * hole with a reason is worth more than a quietly substituted thumbnail, and
 * a 404 on a conventional address is positive evidence that no larger copy is
 * published.
 */
import { round6, stableId } from '@buildapp/source-common'
import { CHANNEL_TRUST, type DiscoveredCandidate } from './discovery.js'
import { DecodeFailed, probeImage } from './image.js'
import { DEFAULT_FETCH_POLICY, FetchRefused, safeFetch, type FetchDeps, type FetchPolicy } from './net.js'
import { mergeRoleClaims, normalizeRoles, type RoleClaim } from './roles.js'
import { SOURCE_PACKAGE_SCHEMA, SOURCE_PACKAGE_SCHEMA_VERSION, SourcePackageSchema, type AcquisitionFailure, type SourceAsset, type SourcePackage, type SourceVariant } from './schema.js'
import { aspectOf, pixelArea, sameShape, selectionOrder, selectionReason } from './variants.js'
import { sourcePackageContentHash } from './hash.js'
import type { SourceAdapter } from './adapter.js'
import { sha256Bytes } from '@buildapp/source-common'

export type AcquireOptions = {
  policy?: FetchPolicy
  deps?: FetchDeps
  /** Try each adapter's resolution convention for a larger copy. On by default: it is how a publisher's originals are found. */
  probeResolutionCandidates?: boolean
  /** Bytes for addresses already on disk, so an acquisition can replay offline. */
  cache?: SourceByteCache
  /** Refuse to touch the network; every byte must come from the cache. */
  offline?: boolean
}

/** Somewhere fetched bytes live, addressed by URL. */
export type SourceByteCache = {
  get: (url: string) => Promise<{ bytes: Uint8Array; mediaType: string } | null>
  put: (url: string, bytes: Uint8Array, mediaType: string) => Promise<void>
}

type Measured = {
  candidate: DiscoveredCandidate
  variant: SourceVariant
}

export async function acquireSourcePackage(requestedUrl: string, adapters: readonly SourceAdapter[], options: AcquireOptions = {}): Promise<SourcePackage> {
  const policy = options.policy ?? DEFAULT_FETCH_POLICY
  const failures: AcquisitionFailure[] = []

  // --- the page -----------------------------------------------------------
  const page = await fetchBytes(requestedUrl, policy, options, 'PAGE', failures)
  if (!page) throw new SourceAcquisitionError(`the page could not be fetched: ${failures[failures.length - 1]?.message ?? 'unknown'}`, failures)
  const html = new TextDecoder('utf-8').decode(page.bytes)
  const pageUrl = page.url

  const adapter = adapters.find((a) => a.matches(new URL(pageUrl)))
  if (!adapter) throw new SourceAcquisitionError(`no adapter understands ${pageUrl}`, failures)

  const ctx = {
    url: pageUrl,
    html,
    fetchText: async (url: string): Promise<string | null> => {
      const r = await fetchBytes(url, policy, options, 'DISCOVERY', failures)
      return r ? new TextDecoder('utf-8').decode(r.bytes) : null
    },
  }

  const identity = adapter.identify(ctx)
  const published = safely(() => adapter.parsePublished(ctx), { facts: [], rooms: [] }, failures, 'FACTS', pageUrl)

  // --- discovery ----------------------------------------------------------
  let candidates = await adapter.discover(ctx)
  if (options.probeResolutionCandidates !== false) {
    const known = new Set(candidates.map((c) => c.url))
    const guesses: DiscoveredCandidate[] = []
    for (const c of candidates) {
      for (const guess of adapter.resolutionCandidates(c.url)) {
        if (known.has(guess)) continue
        known.add(guess)
        // the guess inherits the identity of the copy it was derived from: the publisher's
        // original often has no descriptive name of its own
        guesses.push({ url: guess, channel: 'VARIANT_CONVENTION', exposedBy: c.url, locator: 'resolution-convention', caption: c.caption, groupKey: c.groupKey })
      }
    }
    candidates = [...candidates, ...guesses]
  }

  // Fetch in a deterministic, PRIORITISED order so a budget cut removes the least
  // trustworthy candidates rather than whichever sorted last alphabetically.
  const ordered = [...candidates].sort((a, b) => CHANNEL_TRUST[b.channel] - CHANNEL_TRUST[a.channel] || a.url.localeCompare(b.url) || a.locator.localeCompare(b.locator))
  const budget = ordered.slice(0, policy.maxAssets)
  for (const dropped of ordered.slice(policy.maxAssets)) {
    failures.push({ stage: 'ASSET_FETCH', target: dropped.url, code: 'BUDGET_EXCEEDED', message: `beyond the ${policy.maxAssets} asset budget; ${dropped.channel} candidates are fetched in trust order` })
  }

  // --- fetch and decode ---------------------------------------------------
  const measured: Measured[] = []
  const byUrl = new Map<string, SourceVariant>()
  for (const candidate of budget) {
    const existing = byUrl.get(candidate.url)
    if (existing) {
      measured.push({ candidate, variant: existing })
      continue
    }
    const fetched = await fetchBytes(candidate.url, policy, options, 'ASSET_FETCH', failures)
    if (!fetched) continue
    const probe = probeImage(fetched.bytes)
    if (!probe) {
      failures.push({ stage: 'DECODE', target: candidate.url, code: 'UNSUPPORTED_FORMAT', message: `${fetched.bytes.length} bytes served as ${fetched.mediaType} are not an image this layer can measure` })
      continue
    }
    const byteHash = sha256Bytes(fetched.bytes)
    const declared = candidate.declaredWidth !== undefined || candidate.declaredHeight !== undefined ? { width: candidate.declaredWidth, height: candidate.declaredHeight } : undefined
    // The page's claim is recorded and then set aside. On the live benchmark an elevation is
    // served with height="213" and really is 256 pixels tall: believing the markup mis-scales
    // every measurement taken off that drawing, and does so silently.
    const declaredMismatch =
      declared !== undefined && ((declared.width !== undefined && declared.width !== probe.size.width) || (declared.height !== undefined && declared.height !== probe.size.height))
    const variant: SourceVariant = {
      id: stableId('var', candidate.url.split('/').pop() ?? 'asset', { byteHash }),
      url: candidate.url,
      discoveredVia: `${candidate.channel}:${candidate.locator}@${candidate.exposedBy}`,
      mediaType: `image/${probe.format}`,
      byteLength: fetched.bytes.length,
      byteHash,
      decoded: probe.size,
      declared,
      declaredMismatch,
      aspect: aspectOf(probe.size.width, probe.size.height),
    }
    byUrl.set(candidate.url, variant)
    measured.push({ candidate, variant })
  }

  // --- group into logical assets -----------------------------------------
  const assets = buildAssets(measured, adapter, failures)

  const draft: Omit<SourcePackage, 'contentHash'> = {
    schema: SOURCE_PACKAGE_SCHEMA,
    schemaVersion: SOURCE_PACKAGE_SCHEMA_VERSION,
    id: stableId('src', identity.externalId ?? new URL(pageUrl).hostname, { canonicalUrl: pageUrl }),
    canonicalUrl: pageUrl,
    requestedUrl: pageUrl === requestedUrl ? undefined : requestedUrl,
    pageHash: sha256Bytes(page.bytes),
    project: identity,
    adapter: { id: adapter.id, version: adapter.version },
    assets,
    publishedFacts: published.facts,
    publishedRooms: published.rooms,
    failures: failures.slice().sort((a, b) => a.stage.localeCompare(b.stage) || a.target.localeCompare(b.target) || a.code.localeCompare(b.code)),
  }
  const pkg: SourcePackage = { ...draft, contentHash: sourcePackageContentHash(draft) }
  return SourcePackageSchema.parse(pkg)
}

/**
 * Group measured candidates into logical assets, then select within each.
 *
 * The reference copy of a group is its highest-TRUST member, not its largest:
 * the page's own element is where the descriptive name and the caption live,
 * so it defines what the asset is and what shape it is. A candidate whose
 * aspect ratio disagrees with the reference is a different CROP, and becomes
 * its own asset with the disagreement recorded — measuring a crop as though it
 * were the whole drawing puts every coordinate in the wrong place.
 */
function buildAssets(measured: readonly Measured[], adapter: SourceAdapter, failures: AcquisitionFailure[]): SourceAsset[] {
  // claims per URL, merged across every channel that exposed it
  const claimsByUrl = new Map<string, RoleClaim[]>()
  const bestCandidateByUrl = new Map<string, DiscoveredCandidate>()
  for (const m of measured) {
    const list = claimsByUrl.get(m.variant.url) ?? []
    list.push(...adapter.roleClaims(m.candidate))
    claimsByUrl.set(m.variant.url, list)
    const prev = bestCandidateByUrl.get(m.variant.url)
    if (!prev || CHANNEL_TRUST[m.candidate.channel] > CHANNEL_TRUST[prev.channel]) bestCandidateByUrl.set(m.variant.url, m.candidate)
  }

  // Structural grouping by union-find. Three rules link two addresses into one logical
  // asset, and none of them is filename resemblance:
  //   - the adapter's own key (a publisher's resolution convention, an anchor that wraps an image)
  //   - a candidate's discovery-time group key
  //   - BYTE-IDENTICAL content: one copy published at two addresses is one asset, not two.
  //     The publisher serves the same original both by convention (`…-<pageHash>__11264.jpg`)
  //     and under its own undescribed name (`…-<otherHash>__11264.jpg`); without this rule
  //     every elevation appears twice, once described and once anonymous.
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!
    let c = x
    while (parent.get(c) !== undefined && parent.get(c) !== c) {
      const next = parent.get(c)!
      parent.set(c, r)
      c = next
    }
    return r
  }
  const union = (a: string, b: string): void => {
    parent.set(a, parent.get(a) ?? a)
    parent.set(b, parent.get(b) ?? b)
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb)
  }
  const urls = [...new Set(measured.map((m) => m.variant.url))].sort()
  for (const u of urls) parent.set(u, u)
  const byKey = new Map<string, string>()
  for (const m of measured) {
    const key = (adapter.groupKey ? adapter.groupKey(m.candidate) : undefined) ?? m.candidate.groupKey
    if (key === undefined) continue
    const first = byKey.get(key)
    if (first === undefined) byKey.set(key, m.variant.url)
    else union(first, m.variant.url)
  }
  const byBytes = new Map<string, string>()
  for (const m of [...measured].sort((a, b) => a.variant.url.localeCompare(b.variant.url))) {
    const first = byBytes.get(m.variant.byteHash)
    if (first === undefined) byBytes.set(m.variant.byteHash, m.variant.url)
    else union(first, m.variant.url)
  }
  const groups = new Map<string, { urls: string[] }>()
  for (const u of urls) {
    const root = find(u)
    const g = groups.get(root) ?? { urls: [] }
    g.urls.push(u)
    groups.set(root, g)
  }

  const out: SourceAsset[] = []
  for (const [key, group] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const all = group.urls.map((u) => byUrlOf(measured, u)).filter((v): v is SourceVariant => v !== null)
    if (all.length === 0) continue
    // one copy published at two addresses is one variant: keep the highest-trust address for it
    const variants: SourceVariant[] = []
    for (const v of all) {
      const twin = variants.find((x) => x.byteHash === v.byteHash)
      if (!twin) {
        variants.push(v)
        continue
      }
      // `target` names the address that was DROPPED, so a consumer filtering
      // failures by target is looking at the copy that is no longer in the
      // package rather than at the one that survived.
      const replace = trustOf(bestCandidateByUrl, v) > trustOf(bestCandidateByUrl, twin)
      if (replace) variants[variants.indexOf(twin)] = v
      const dropped = replace ? twin : v
      const keptVariant = replace ? v : twin
      failures.push({ stage: 'ROLE', target: dropped.url, code: 'BYTE_IDENTICAL', message: `byte-identical to ${keptVariant.url}: one copy published at two addresses, counted once` })
    }
    // the reference: highest channel trust, then most pixels, then byte hash
    const reference = [...variants].sort((a, b) => trustOf(bestCandidateByUrl, b) - trustOf(bestCandidateByUrl, a) || pixelArea(b) - pixelArea(a) || a.byteHash.localeCompare(b.byteHash))[0]
    const kept: SourceVariant[] = []
    const rejected: SourceVariant[] = []
    for (const v of variants) {
      if (v.byteHash === reference.byteHash || sameShape(v.aspect, reference.aspect)) kept.push(v)
      else rejected.push(v)
    }
    const claims = kept.flatMap((v) => claimsByUrl.get(v.url) ?? [])
    out.push(makeAsset(key, kept, claims, bestCandidateByUrl))
    for (const v of rejected) {
      failures.push({
        stage: 'ROLE',
        target: v.url,
        code: 'DIFFERENT_CROP',
        message: `aspect ${v.aspect} against the reference copy's ${reference.aspect}: a different crop, not a larger copy of the same drawing; kept as its own asset`,
      })
      out.push(makeAsset(`${key}#crop-${v.byteHash.slice(0, 8)}`, [v], claimsByUrl.get(v.url) ?? [], bestCandidateByUrl))
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

const byUrlOf = (measured: readonly Measured[], url: string): SourceVariant | null => measured.find((m) => m.variant.url === url)?.variant ?? null
const trustOf = (best: Map<string, DiscoveredCandidate>, v: SourceVariant): number => {
  const c = best.get(v.url)
  return c ? CHANNEL_TRUST[c.channel] : 0
}

function makeAsset(key: string, variants: readonly SourceVariant[], claims: readonly RoleClaim[], best: Map<string, DiscoveredCandidate>): SourceAsset {
  const ordered = selectionOrder(variants)
  const merged = mergeRoleClaims(claims)
  const roles = normalizeRoles(merged.roles)
  const caption = ordered.map((v) => best.get(v.url)?.caption).find((c) => c !== undefined && c !== '')
  return {
    id: stableId('asset', captionSlugOf(caption, ordered[0].url), { key, byteHashes: ordered.map((v) => v.byteHash).sort() }),
    caption,
    roles,
    roleEvidence: merged.evidence,
    variants: [...ordered],
    selectedVariantId: ordered[0].id,
    selectionReason: selectionReason(ordered),
  }
}

const captionSlugOf = (caption: string | undefined, url: string): string => caption ?? (url.split('/').pop() ?? 'asset').replace(/-[0-9a-f]{16,}__\d+\.[a-z0-9]+$/i, '')

// ---------------------------------------------------------------------------

export class SourceAcquisitionError extends Error {
  constructor(
    message: string,
    readonly failures: readonly AcquisitionFailure[],
  ) {
    super(message)
    this.name = 'SourceAcquisitionError'
  }
}

async function fetchBytes(
  url: string,
  policy: FetchPolicy,
  options: AcquireOptions,
  stage: AcquisitionFailure['stage'],
  failures: AcquisitionFailure[],
): Promise<{ url: string; bytes: Uint8Array; mediaType: string } | null> {
  const cached = options.cache ? await options.cache.get(url) : null
  if (cached) return { url, bytes: cached.bytes, mediaType: cached.mediaType }
  if (options.offline) {
    failures.push({ stage, target: url, code: 'OFFLINE_CACHE_MISS', message: 'offline acquisition and this address is not in the cache' })
    return null
  }
  try {
    const r = await safeFetch(url, policy, options.deps)
    if (options.cache) await options.cache.put(url, r.bytes, r.mediaType)
    return { url: r.url, bytes: r.bytes, mediaType: r.mediaType }
  } catch (e) {
    const err = e as FetchRefused
    failures.push({ stage, target: url, code: err.code ?? 'NETWORK', message: err.message })
    return null
  }
}

function safely<T>(fn: () => T, fallback: T, failures: AcquisitionFailure[], stage: AcquisitionFailure['stage'], target: string): T {
  try {
    return fn()
  } catch (e) {
    failures.push({ stage, target, code: e instanceof DecodeFailed ? e.code : 'ADAPTER_ERROR', message: (e as Error).message })
    return fallback
  }
}

export { round6 }
