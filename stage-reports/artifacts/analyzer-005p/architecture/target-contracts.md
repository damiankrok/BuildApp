# 005P — target contracts (PROPOSED architecture; not a refactor authorised in 005P)

These are conceptual TypeScript-like interfaces. They are NOT shipping types. They name what each subsystem may
assert, what it may only propose, and what must travel with a value so that a wrong house can be traced back to the
first decision that turned an observation into asserted geometry. Where today's code already has the shape, the
existing type is named (see `current-system-map.md` for files and lines).

## 1. Identity, hashing, correlation

```ts
type Sha256 = string            // lowercase hex of the bytes
type EvidenceId = string        // stable, content-derived (`stableId(kind, key, payload)` today, source-common)

/** Which observations share a failure mode. Two observations in one group are never two witnesses. */
type CorrelationGroup = {
  id: string
  /** e.g. 'RASTER:<variant sha>/CROP:<box>' — every reader of one crop shares it */
  rasterCrop?: string
  /** e.g. 'READER_FAMILY:classic-template' — TOKEN and LATTICE share bitmaps */
  readerFamily?: string
  /** the same drawing on two frames (a copy) shares the drawing group */
  drawing?: string
}

type SourceRef = {
  packageSha: Sha256             // source-package.json content hash (exists: SourcePackage identity)
  variantSha: Sha256             // the raster variant bytes the observation was read from (exists: cache key)
  frameId: string                // coordinate frame (exists)
  transform?: { rotationQuarterTurns: 0 | 1 | 2 | 3; mirrored: false; scaleToFrame: number }
  box?: { x0: number; y0: number; x1: number; y1: number }   // in frame pixels
}
```

Invariants: identity is derived from bytes and ordered inputs only (no clock, no path, no locale); the same inputs give
the same ids on a phone and on a server.

## 2. Observation, claim, decision

```ts
/** What a producer SAW. Never a fact about the building. */
type SourceObservation<T> = {
  id: EvidenceId
  kind: 'OCR_TOKEN' | 'NUMERIC_LATTICE' | 'EXTERNAL_READING' | 'TICK' | 'DIMENSION_LINE' | 'WALL_BAND' | 'WALL_BLOCK' | 'GAP' | 'CALLOUT' | 'FRAME_ROLE' | string
  producer: { name: string; version: string; modelSha?: Sha256 }   // e.g. 'metrics.numeric-ocr@1.4.0', PP-OCRv6 9ef676d6…
  source: SourceRef
  correlation: CorrelationGroup
  value: T                      // the producer's raw value, as produced (token text, not a parsed scale-chosen number)
  alternatives: Array<{ value: T; score?: number }>   // what else the producer considered; never silently dropped
  uncertainty: { calibrated: false; producerScore?: number } | { calibrated: true; posterior: number; stable: boolean }
  missing?: 'NOT_DETECTED' | 'BELOW_LEGIBILITY' | 'OUT_OF_SCOPE'    // explicit absence, not an empty list by accident
}

/** What a subsystem ASSERTS or PROPOSES from observations. */
type EvidenceClaim<T> = {
  id: EvidenceId
  status: 'ASSERTED' | 'DERIVED' | 'PROPOSED' | 'UNRESOLVED'
  value?: T                     // absent when UNRESOLVED
  dependsOn: EvidenceId[]       // every observation / claim it rests on — including a scale it was corrected toward
  dependsOnScale?: EvidenceId   // set for CHAIN_CORRECTED / orientation-by-other-axis values: they may never vote for that scale
  independentGroups: string[]   // correlation groups of the supporting observations, de-duplicated — never a reader count
  owner: 'METRIC_SOLUTION' | 'PLAN_RESOLUTION' | 'TOPOLOGY' | 'EMISSION' | string
}

/** A choice among candidates, with the losers kept. */
type Decision<T> = {
  id: EvidenceId
  rule: { name: string; version: string }          // e.g. 'plan-resolution.sourceConflictOf@1.4.0'
  candidates: Array<{ id: EvidenceId; value: T }>
  chosen?: EvidenceId
  rejected: Array<{ id: EvidenceId; reason: string }>
  supporting: string[]           // independent correlation groups for the chosen candidate
  refuting: string[]             // independent correlation groups against it
  tie?: { between: EvidenceId[] }                  // a tie is named, never broken by order
  reason: string                 // a versioned reason code + human text
  unresolved?: { code: string; missing: string }   // typed UNRESOLVED: what evidence would decide it
  usedBy: string[]               // the downstream decisions that consumed this one
}
```

## 3. The metric statement view (the 005P seam)

Today plan resolution's `Statement` (`plan-resolution.ts:185`) carries one number for every consumer. Proposed:

```ts
/** One printed dimension as plan resolution may use it. Computed once, pure, from the metric evidence. */
type MetricStatementView = {
  evidenceId: EvidenceId
  frameId: string; axis: 'X' | 'Y'; pixelLength: number
  /** what was printed, as each confident reader read the SAME ink (one correlation group: rasterCrop) */
  readings: Array<{ reader: 'TOKEN' | 'LATTICE' | 'EXTERNAL'; value: number; confident: true }>
  /** the frozen "as printed" value (token text / READ value); empty when the incumbent states nothing */
  asPrinted: number[]
  /** a value the chain solver chose because it fits a scale: never a reading for that scale */
  scaleCorrected?: { value: number; towardScaleOf: string }
  contest: 'UNCONTESTED' | 'CONTESTED'   // |{distinct confident values}| >= 2
}

/** Consumers are named; each has its own policy; there is no hidden all-consumer override. */
type MetricConsumer =
  | 'CONFLICT_REGISTRATION_REFUTED' | 'CONFLICT_RIVAL_REFUTED' | 'CONFLICT_OUTER_TOTALS_ACCUSE' | 'CONFLICT_OUTER_TOTALS_DEFEND'
  | 'RANKING_REFUTED_SHARE' | 'LATTICE_SCALES' | 'ISOTROPY_SUPPORT'
type StatementPolicy = (view: MetricStatementView, consumer: MetricConsumer) =>
  | { use: 'AS_PRINTED' }                       // the frozen list
  | { use: 'NONE' }                             // states nothing for this consumer
  | { use: 'ANY_OF'; values: number[] }         // refutes only if no value fits (benefit of doubt to the accused)
  | { use: 'ALL_OF'; values: number[] }         // supports an accusation only if every value fits
```

Rules: a policy can withhold or widen a reading; it can never create one (no value outside `readings` ∪ `asPrinted`,
nothing for a statement whose `asPrinted` is empty), and it can never turn readers of one ink into two witnesses.

## 4. Scale ownership

```ts
type ScaleAssertion = EvidenceClaim<{ cmPerPxX: number; cmPerPxY: number }> & {
  owner: 'METRIC_SOLUTION'                     // the ONLY owner (source-metrics `metricSolutions` + registration)
  confidence: 'STRONG' | 'SUPPORTED' | 'WEAK' | 'INCONCLUSIVE'
  relation: 'CONFIRMED' | 'REPLACED' | 'ADDED' | 'LEGACY_UNCONFIRMED'
}
type SourceConflict = Decision<'REGISTRATION_CONTRADICTED'> & {
  owner: 'PLAN_RESOLUTION'                      // may ACCUSE a scale; may not assert one
  triggers: Array<'AS_READ_REFUTATION' | 'PARTIAL_BINDING' | 'OUTER_TOTALS'>
  accusers: EvidenceId[]; contestedAccusers: EvidenceId[]
}
```

Plan resolution may propose another of the metric solution's hypotheses (it does: `metricScales`) and may accuse the
registration; only the metric solution asserts a scale. The published footprint may verify or veto, never choose.

## 5. Topology (three graphs, typed closures)

```ts
type TopologyObservation = SourceObservation<{ kind: 'WALL_BAND' | 'WALL_BLOCK' | 'PIER' | 'GAP' | 'OPENING_SYMBOL' | 'LINE'; rect: Box }>
type HostWallGraph   = { walls: Array<{ id: EvidenceId; axis: Segment; thicknessM: number; from: EvidenceId[] }> }      // structural hosts
type SolidGraph      = { solids: Array<{ id: EvidenceId; hostId: EvidenceId; intervals: Interval[] }>; openings: Array<{ id: EvidenceId; hostId: EvidenceId; kind: 'DOOR' | 'WINDOW' | 'GARAGE_DOOR' | 'WIDE_OPENING' }> }
type CompartmentGraph = { cells: Array<{ id: EvidenceId; boundary: Array<{ edge: Segment; by: 'SOLID' | 'OPENING' | 'VIRTUAL_CLOSURE' }> }> }
type BoundaryDecision = Decision<'OPEN_SIDE' | 'OPENING_IN_WALL' | 'RECESS_MOUTH' | 'CARPORT' | 'COVERED_TERRACE' | 'UNRESOLVED'>
```

A `VIRTUAL_CLOSURE` closes a compartment for area and naming only; it never emits a physical wall. A missing primitive
stays missing (`missing: 'NOT_DETECTED'`); no area match fills it.

## 6. Canonical emission

```ts
type CanonicalEmission = {
  consumes: Array<Decision<unknown>>      // accepted semantic decisions only
  emits: 'CanonicalBuildingModel'         // packages/model, schema unchanged
  onFailure: { code: string; upstreamDigest: EvidenceId[] }   // the plan digest and every decision id survive a failure
}
```

Emission never fills an unknown (a chimney with no roof datum fails with the roof decision named, it does not invent a
roof). The failure record keeps the upstream decision ids (today it loses the plan digest: `current-system-map.md` §10).

## 7. Uncertain, missing, malformed

- Uncertain: carried as alternatives + uncertainty; a consumer policy decides use, never the producer.
- Missing: an explicit `missing` reason; never an empty array standing for "not looked at".
- Malformed (schema violation, NaN, wrong unit): rejected at the boundary that reads it (Zod today), with the evidence
  id; never coerced.

## 8. Why a plausible alternative can be wrong (built into the contracts)

- Two readers of one crop agreeing is one estimate (CorrelationGroup), so an alternative "supported twice" may be
  supported once.
- A value corrected toward a scale (`dependsOnScale`) agrees with that scale by construction.
- Another copy of the same drawing is the same drawing group: it corroborates extent (CROSS_COPY measures the copy's
  own wall ink), not the reading of a label.
- The published footprint is one number; matching it is consistent with many wrong houses (005A decoy control).
