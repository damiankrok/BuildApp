/**
 * Deterministic ids for the observation graph.
 *
 * An id is a function of WHAT was observed and never of when it was observed,
 * which extractor ran first, or how many observations came before it. That is
 * what makes two runs of the same extractors over the same bytes produce a
 * byte-identical graph, and what makes two graphs diffable: an id that
 * survives from one run to the next names the same reading.
 *
 * Free text never enters an id. `provenance.detail` and `note` are prose for a
 * human reader — rewording them must not rename the thing they describe.
 */
import { stableId } from '@buildapp/source-common'
import type { NormGeometry, ObservationKind, ObservationValue, Provenance, RelationKind, SemanticHint, SourceObservation, ObservationRelation } from './schema.js'

/** The identity-bearing part of a provenance record: which extractor, at which version. Not its prose. */
const provenanceKey = (p: Provenance): unknown => ({ extractor: p.extractor, name: p.name, region: p.region ?? null })

/**
 * A coordinate frame is one asset's bytes. Two resolutions of the same drawing
 * are two frames, on purpose.
 */
export const frameId = (assetId: string, variantByteHash: string): string => stableId('frame', assetId, { assetId, variantByteHash })

export type ObservationIdentity = {
  assetId: string
  variantByteHash: string
  kind: ObservationKind
  semanticHints: readonly SemanticHint[]
  normGeometry: NormGeometry
  value?: ObservationValue
  provenance: Provenance
}

/**
 * The id of an observation.
 *
 * Identity is: the bytes it was seen on, what it is, where it is (normalized,
 * so a rescale of the same drawing does not rename it), what it measures, and
 * which extractor saw it. Two extractors that independently see the same edge
 * produce two observations, deliberately — that they agree is a relation
 * (`CORROBORATES`), not a silent merge.
 *
 * `confidence`, `uncertainty` and `alternatives` are NOT part of the identity:
 * an extractor that grows more or less sure of the same edge has changed its
 * reading of that edge, not found a different one.
 */
export const observationId = (o: ObservationIdentity): string =>
  stableId('obs', `${o.kind.toLowerCase()}-${[...o.semanticHints].sort().join('-')}`, {
    assetId: o.assetId,
    variantByteHash: o.variantByteHash,
    kind: o.kind,
    semanticHints: [...o.semanticHints].sort(),
    normGeometry: o.normGeometry,
    value: o.value ?? null,
    provenance: provenanceKey(o.provenance),
  })

/**
 * The id of a relation. Direction matters: `A PROUD_OF B` is not `B PROUD_OF
 * A`, so the endpoints are ordered as given.
 */
export const relationId = (kind: RelationKind, from: string, to: string, provenance: Provenance): string =>
  stableId('rel', kind.toLowerCase(), { kind, from, to, provenance: provenanceKey(provenance) })

/** The id of a conflict. The disagreeing observations are a SET, so the id does not depend on which one was noticed first. */
export const conflictId = (kind: string, what: string, observationIds: readonly string[]): string =>
  stableId('cnf', `${kind.toLowerCase()}-${what}`, { kind, what, observationIds: [...observationIds].sort() })

/** The id of a named gap. */
export const unresolvedId = (what: string, assetId: string | undefined): string => stableId('gap', what, { what, assetId: assetId ?? null })

/** The id of the whole graph: the package it reads plus the content hash of what was read off it. */
export const graphId = (sourcePackageId: string, contentHash: string): string => stableId('obsgraph', sourcePackageId, { sourcePackageId, contentHash })

/** Recompute an observation's id from its own content — the check that a graph's ids were not hand-written. */
export const recomputeObservationId = (o: SourceObservation): string =>
  observationId({ assetId: o.assetId, variantByteHash: o.variantByteHash, kind: o.kind, semanticHints: o.semanticHints, normGeometry: o.normGeometry, value: o.value, provenance: o.provenance })

export const recomputeRelationId = (r: ObservationRelation): string => relationId(r.kind, r.from, r.to, r.provenance)
