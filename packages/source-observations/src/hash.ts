/**
 * The observation graph's content hash.
 *
 * Two runs of the same extractors over the same sealed bytes must produce the
 * same hash, in any order, on any machine. Two runs that read the sources
 * DIFFERENTLY must not. Everything in this file exists to hold that line, and
 * the split between what is hashed and what is not is stated explicitly rather
 * than left to whatever the object happened to contain.
 *
 * HASHED — the reading itself:
 *   - the package identity and its content hash (source bytes identity);
 *   - every contributing extractor's name, version and kind;
 *   - each frame: its asset, its bytes, its decoded size, its roles;
 *   - each observation: bytes, kind, hints, BOTH geometries, value, depth
 *     layer, confidence, uncertainty, alternatives, and which extractor
 *     produced it;
 *   - every relation, conflict and named gap.
 *
 * NOT HASHED — commentary and bookkeeping:
 *   - `provenance.detail` and `note`: prose for a human. Rewording an
 *     explanation is not a different reading;
 *   - any id: every id is already a function of hashed content, so hashing it
 *     would only double-count;
 *   - anything wall-clock. No timestamp, latency, token count, request id or
 *     model-response header reaches this function, because nothing carries
 *     them into the graph in the first place.
 *
 * The provider-metadata rule that follows from this, and is tested both ways:
 * changing a vision provider's VERSION changes the hash (it is a different
 * reader, so it is a different reading), while changing how long its call
 * took, or how it narrated its answer, does not.
 *
 * Observations, relations, conflicts, frames, extractors and gaps are all
 * SETS: `hashUnordered` hashes each member alone, sorts the digests and hashes
 * the sorted list, so extraction order is invisible to the result.
 */
import { hashArtifact } from '@buildapp/source-common'
import { OBSERVATION_GRAPH_SCHEMA, OBSERVATION_GRAPH_SCHEMA_VERSION } from './schema.js'
import type { ObservationConflict, ObservationRelation, SourceCoordinateFrame, SourceObservation, SourceObservationGraph, UnresolvedObservation } from './schema.js'

/** A graph before it is sealed: everything but the derived id and hash. */
export type ObservationGraphDraft = Omit<SourceObservationGraph, 'id' | 'contentHash'>

const frameMember = (f: SourceCoordinateFrame): unknown => ({ assetId: f.assetId, variantByteHash: f.variantByteHash, size: f.size, roles: f.roles })

const observationMember = (o: SourceObservation): unknown => ({
  assetId: o.assetId,
  variantByteHash: o.variantByteHash,
  // The frame is named by its content rather than its id, so the member is
  // self-contained: a graph whose frame ids were rewritten still hashes the same.
  frame: { assetId: o.assetId, variantByteHash: o.variantByteHash },
  kind: o.kind,
  semanticHints: [...o.semanticHints].sort(),
  pixelGeometry: o.pixelGeometry,
  normGeometry: o.normGeometry,
  value: o.value ?? null,
  depthLayer: o.depthLayer,
  confidence: o.confidence,
  uncertainty: { positionPx: o.uncertainty.positionPx, angleDeg: o.uncertainty.angleDeg ?? null },
  alternatives: o.alternatives.map((a) => ({ confidence: a.confidence, pixelGeometry: a.pixelGeometry ?? null, count: a.count ?? null, semanticHints: a.semanticHints ? [...a.semanticHints].sort() : null })),
  extractor: { kind: o.provenance.extractor, name: o.provenance.name, region: o.provenance.region ?? null },
})

const relationMember = (r: ObservationRelation): unknown => ({ kind: r.kind, from: r.from, to: r.to, confidence: r.confidence, extractor: { kind: r.provenance.extractor, name: r.provenance.name } })

const conflictMember = (c: ObservationConflict): unknown => ({ kind: c.kind, what: c.what, observationIds: [...c.observationIds].sort(), magnitude: c.magnitude ?? null, unit: c.unit ?? null })

const gapMember = (u: UnresolvedObservation): unknown => ({ what: u.what, assetId: u.assetId ?? null, status: u.status })

export function observationGraphContentHash(draft: ObservationGraphDraft): string {
  return hashArtifact(OBSERVATION_GRAPH_SCHEMA, OBSERVATION_GRAPH_SCHEMA_VERSION, [
    { label: 'source', ordered: { schema: draft.schema, schemaVersion: draft.schemaVersion, sourcePackageId: draft.sourcePackageId, sourcePackageHash: draft.sourcePackageHash } },
    { label: 'extractors', unordered: draft.extractors.map((e) => ({ name: e.name, version: e.version, kind: e.kind })) },
    { label: 'frames', unordered: draft.coordinateFrames.map(frameMember) },
    { label: 'observations', unordered: draft.observations.map(observationMember) },
    { label: 'relations', unordered: draft.relations.map(relationMember) },
    { label: 'conflicts', unordered: draft.conflicts.map(conflictMember) },
    { label: 'unresolved', unordered: draft.unresolved.map(gapMember) },
  ])
}

/** True when a sealed graph's recorded hash still matches its content. */
export const graphHashIsIntact = (graph: SourceObservationGraph): boolean => observationGraphContentHash(stripSeal(graph)) === graph.contentHash

export function stripSeal(graph: SourceObservationGraph): ObservationGraphDraft {
  const { id: _id, contentHash: _hash, ...draft } = graph
  return draft
}
