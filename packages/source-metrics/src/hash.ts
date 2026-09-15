/**
 * The metric evidence set's content hash.
 *
 * The rule is the same one the observation graph holds, applied to a different
 * kind of fact: two runs of the same readers over the same sealed bytes must
 * produce the same digest, in any order and on any machine, and two runs that
 * READ THE DRAWING DIFFERENTLY must not.
 *
 * HASHED — the reading itself:
 *   - both inputs, by id and by content hash: a set of metric claims is only
 *     valid for the exact package and the exact observation graph it was made
 *     from, and naming them by hash is what makes that checkable;
 *   - every reader that contributed, with its version;
 *   - each OCR token: the characters, the box, the size and slant it was read
 *     at, and each glyph's own score, decidedness and runners-up. The raw text
 *     is part of the identity because a reader that sees different characters
 *     has read a different drawing;
 *   - each piece of evidence: what it measures, its value and unit, its
 *     origin, its raw text, the geometry it is attached to and how, the
 *     alternatives it kept, and its confidence;
 *   - each chain: its axis, its ticks, every segment with its value and origin,
 *     the derived total and the scale;
 *   - each registration: the plane, both scales, the origin, the flips, every
 *     anchor with its residual, and every anchor that was rejected;
 *   - every conflict and every named gap.
 *
 * NOT HASHED — commentary and bookkeeping:
 *   - `provenance.detail`, `note`, `association.why` and a rejection's `why`:
 *     prose for a human. Rewording an explanation is not a different reading;
 *   - any id: every id is already a function of hashed content;
 *   - anything wall-clock. No timestamp or latency reaches this function,
 *     because nothing carries one into the set in the first place.
 */
import { hashArtifact } from '@buildapp/source-common'
import { METRIC_EVIDENCE_SCHEMA, METRIC_EVIDENCE_SCHEMA_VERSION } from './schema.js'
import type { CoordinateRegistration, DimensionChain, MetricConflict, MetricEvidence, MetricEvidenceSet, OcrToken, UnresolvedMetric } from './schema.js'

/** A set before it is sealed: everything but the derived id and hash. */
export type MetricEvidenceDraft = Omit<MetricEvidenceSet, 'id' | 'contentHash'>

const tokenMember = (t: OcrToken): unknown => ({
  frame: t.variantByteHash,
  text: t.text,
  score: t.score,
  confidence: t.confidence,
  box: t.box,
  heightPx: t.heightPx,
  shearDeg: t.shearDeg,
  glyphs: t.glyphs.map((g) => ({ char: g.char, score: g.score, confidence: g.confidence, box: g.box, alternatives: g.alternatives })),
})

const evidenceMember = (e: MetricEvidence): unknown => ({
  frame: e.variantByteHash,
  kind: e.kind,
  value: e.value,
  unit: e.unit,
  origin: e.origin,
  rawText: e.rawText,
  textBox: e.textBox ?? null,
  measuredGeometry: e.measuredGeometry ?? null,
  pixelLength: e.pixelLength ?? null,
  association: { kind: e.association.kind, score: e.association.score, observationIds: [...e.association.observationIds].sort() },
  alternatives: e.alternatives.map((a) => ({ value: a.value, unit: a.unit, rawText: a.rawText, confidence: a.confidence })),
  confidence: e.confidence,
  extractor: { extractor: e.provenance.extractor, name: e.provenance.name },
})

const chainMember = (c: DimensionChain): unknown => ({
  frame: c.frameId,
  axis: c.axis,
  baselinePx: c.baselinePx,
  ticksPx: c.ticksPx,
  segments: c.segments.map((s) => ({ index: s.index, fromPx: s.fromPx, toPx: s.toPx, pixelLength: s.pixelLength, valueCm: s.valueCm ?? null, origin: s.origin ?? null, confidence: s.confidence, residualCm: s.residualCm ?? null })),
  derivedTotalCm: c.derivedTotalCm ?? null,
  printedTotal: c.printedTotal ? { valueCm: c.printedTotal.valueCm } : null,
  scale: c.scale ?? null,
  closes: c.closes,
})

const registrationMember = (r: CoordinateRegistration): unknown => ({
  frame: r.variantByteHash,
  plane: r.plane,
  metresPerPixelX: r.metresPerPixelX,
  metresPerPixelY: r.metresPerPixelY,
  anisotropy: r.anisotropy,
  originPx: r.originPx,
  flipX: r.flipX,
  flipY: r.flipY,
  anchors: r.anchors.map((a) => ({ kind: a.kind, axis: a.axis, pixelSpan: a.pixelSpan, metricSpan: a.metricSpan, residualM: a.residualM, weight: a.weight })),
  rejected: r.rejected.map((x) => ({ residualM: x.residualM })),
  residual: r.residual,
  confidence: r.confidence,
})

const conflictMember = (c: MetricConflict): unknown => ({ kind: c.kind, what: c.what, magnitude: c.magnitude ?? null, unit: c.unit ?? null })

const gapMember = (u: UnresolvedMetric): unknown => ({ what: u.what, frameId: u.frameId ?? null, status: u.status })

export function metricEvidenceContentHash(draft: MetricEvidenceDraft): string {
  return hashArtifact(METRIC_EVIDENCE_SCHEMA, METRIC_EVIDENCE_SCHEMA_VERSION, [
    { label: 'package', ordered: { id: draft.sourcePackageId, hash: draft.sourcePackageHash } },
    { label: 'observations', ordered: { id: draft.observationGraphId, hash: draft.observationGraphHash } },
    { label: 'extractors', unordered: draft.extractors.map((e) => ({ name: e.name, version: e.version })) },
    { label: 'tokens', unordered: draft.ocrTokens.map(tokenMember) },
    { label: 'evidence', unordered: draft.evidence.map(evidenceMember) },
    { label: 'chains', unordered: draft.chains.map(chainMember) },
    { label: 'registrations', unordered: draft.coordinateRegistrations.map(registrationMember) },
    { label: 'conflicts', unordered: draft.conflicts.map(conflictMember) },
    { label: 'unresolved', unordered: draft.unresolved.map(gapMember) },
  ])
}

/** Seal a draft: give it its content hash and the id derived from it. */
export function sealMetricEvidence(draft: MetricEvidenceDraft, slug: string): MetricEvidenceSet {
  const contentHash = metricEvidenceContentHash(draft)
  return { ...draft, id: `metrics-${slug}-${contentHash.slice(0, 16)}`, contentHash }
}
