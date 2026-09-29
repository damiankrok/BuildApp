/**
 * The SourcePackage content hash.
 *
 * What is hashed is what makes one acquisition DIFFERENT from another as a
 * description of published material. What is excluded is everything that
 * varies between two runs looking at the same material: a reworded
 * explanation is not a different source, and neither is a different machine.
 *
 * Included, explicitly:
 *   schema and version, the project identity, the adapter identity, and per
 *   asset its roles, its caption and every variant's url, media type, byte
 *   length, byte hash and DECODED size, plus which variant was selected; the
 *   published figures; and the CODES of the failures.
 *
 * Excluded, explicitly:
 *   `selectionReason` and failure `message` (prose about the same facts),
 *   `roleEvidence` (prose about roles that are themselves hashed),
 *   `discoveredVia` (the channel a copy was found through can change without
 *   the copy changing), a failure's `attempts` and `claim` (how hard a fetch
 *   was tried and what the address was exposed as; the code says what was
 *   lost), the package id and the hash itself; and, since 1.2.0, the
 *   ADDRESSES of the page (`canonicalUrl`, `requestedUrl`, `fetchedUrl`) and
 *   the page bytes' hash. The page is where the evidence was found, not the
 *   evidence: a publisher serves different page bytes on every request
 *   (tokens, timestamps), and a tracking parameter spells the same page
 *   another way. Everything the analysis reads from the page — the figures,
 *   the rooms, the specifications, the drawings — is hashed as itself. Both
 *   stay in the package as provenance.
 *
 * The exclusion list is not a comment that can drift from the code: it IS the
 * code below, and the tests assert both directions — that stamping a
 * different reason does not move the hash, and that a different decoded size,
 * role, selection or byte hash does.
 */
import { hashArtifact } from '@buildapp/source-common'
import type { SourceAsset, SourcePackage } from './schema.js'

type Draft = Omit<SourcePackage, 'contentHash'>

const assetView = (a: SourceAsset) => ({
  caption: a.caption,
  roles: a.roles,
  selected: a.variants.find((v) => v.id === a.selectedVariantId)?.byteHash,
  variants: [...a.variants]
    .map((v) => ({ url: v.url, mediaType: v.mediaType, byteLength: v.byteLength, byteHash: v.byteHash, width: v.decoded.width, height: v.decoded.height, declaredMismatch: v.declaredMismatch }))
    .sort((x, y) => x.byteHash.localeCompare(y.byteHash)),
})

export function sourcePackageContentHash(draft: Draft): string {
  return hashArtifact(draft.schema, draft.schemaVersion, [
    { label: 'identity', ordered: { project: draft.project, adapter: draft.adapter } },
    { label: 'assets', unordered: draft.assets.map(assetView) },
    { label: 'publishedFacts', unordered: draft.publishedFacts.map((f) => ({ key: f.key, value: f.value, unit: f.unit })) },
    { label: 'publishedSpecifications', unordered: draft.publishedSpecifications.map((s) => ({ key: s.key, label: s.label, text: s.text })) },
    { label: 'publishedRooms', unordered: draft.publishedRooms.map((r) => ({ storey: r.storey, index: r.index, label: r.label, area: r.area })) },
    { label: 'failures', unordered: draft.failures.map((f) => ({ stage: f.stage, target: f.target, code: f.code })) },
  ])
}

/**
 * The sha-256 of a page's specification list as published: what a reading of
 * the specification is valid for. Order-free, and independent of everything
 * else on the page, so the same printed text has the same provenance however
 * often and through whichever address the page is fetched.
 */
export function publishedSpecificationsHash(specifications: SourcePackage['publishedSpecifications']): string {
  return hashArtifact('buildapp.published-specifications', '1.0.0', [{ label: 'specifications', unordered: specifications.map((s) => ({ key: s.key, label: s.label, text: s.text })) }])
}
