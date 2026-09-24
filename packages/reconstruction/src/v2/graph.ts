/**
 * ArchitecturalEvidenceGraph — feature identity from sighting to model object.
 *
 * The observation graph says what was SEEN on each drawing and the metric
 * evidence set says what was PRINTED. Neither says which sightings are the
 * same architectural feature, which hypotheses compete for the same ink, which
 * of them was solved, or which model objects that solution became. Those are
 * the questions a reviewer asks first, and the questions the previous analyzer
 * could not answer: a zone was detected, a recess was never built, and no
 * record said where the chain broke.
 *
 * So every feature the v2 analyzer works on lives here as a chain:
 *
 *   SourceSighting ─► MetricMeasurement ─► FeatureHypothesis ─► SolvedFeature ─► SemanticObjectBinding
 *
 * with typed relations between features (SAME_FEATURE_AS across views,
 * HOSTED_BY, PART_OF, ALIGNED_WITH, CONTINUES_AS, ABOVE/BELOW, PROJECTS_FROM,
 * RECESSED_FROM, SUPPORTS, CONTRADICTS, CORROBORATES). Nothing here knows any
 * project; it is the bookkeeping the solver fills in as it works.
 */
import { z } from 'zod'
import { hashArtifact } from '@buildapp/source-common'
import { PixelRectSchema } from '@buildapp/source-common'

export const FEATURE_GRAPH_SCHEMA = 'buildapp.architectural-evidence-graph' as const
export const FEATURE_GRAPH_SCHEMA_VERSION = '1.0.0' as const

/** The families of architectural feature the analyzer solves. */
export const FeatureFamilySchema = z.enum([
  'LEVEL',
  'MASS',
  'EXTERIOR_WALL',
  'RECESS',
  'RETURN_WALL',
  'INTERIOR_WALL',
  'ROOM',
  'INTERIOR_DOOR',
  'OPENING',
  'ROOF',
  'ATTACHED_ROOF',
  'ROOF_MEMBER',
  'CHIMNEY',
  'ROOFLIGHT',
  'STAIR',
  'BALCONY',
  'RAILING',
  'FACADE_MEMBER',
  'FACADE_ASSEMBLY',
  'SURFACE_REGION',
  'CAMERA',
])
export type FeatureFamily = z.infer<typeof FeatureFamilySchema>

export const ViewFamilySchema = z.enum(['PLAN', 'ELEVATION', 'SECTION', 'PERSPECTIVE', 'SITE', 'PAGE'])
export type ViewFamily = z.infer<typeof ViewFamilySchema>

/** One place a feature was seen: a frame, an asset, the pixels, the observations behind it. */
export const SourceSightingSchema = z
  .object({
    id: z.string().min(1),
    frameId: z.string().min(1),
    assetId: z.string().min(1),
    viewFamily: ViewFamilySchema,
    /** The observation-graph observations this sighting rests on; empty when the v2 pass read the raster itself. */
    observationIds: z.array(z.string().min(1)),
    pixelRect: PixelRectSchema.optional(),
    what: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict()
export type SourceSighting = z.infer<typeof SourceSightingSchema>

export const MeasurementMethodSchema = z.enum(['PRINTED', 'CHAIN', 'REGISTERED_PIXEL', 'CROSS_VIEW', 'DERIVED', 'CONVENTION'])
export type MeasurementMethod = z.infer<typeof MeasurementMethodSchema>

/** One metric statement about a feature, with the sightings and metric evidence that back it. */
export const MetricMeasurementSchema = z
  .object({
    id: z.string().min(1),
    sightingIds: z.array(z.string().min(1)),
    /** Metric-evidence ids (LINEAR_DIMENSION, LEVEL_DATUM, OPENING_CALLOUT, ANGLE…) the number rests on. */
    evidenceIds: z.array(z.string().min(1)),
    quantity: z.string().min(1),
    value: z.number().finite(),
    low: z.number().finite(),
    high: z.number().finite(),
    unit: z.enum(['m', 'deg', 'count', 'none']),
    method: MeasurementMethodSchema,
    why: z.string().min(1),
  })
  .strict()
export type MetricMeasurement = z.infer<typeof MetricMeasurementSchema>

export const FeatureParameterSchema = z.object({ value: z.number().finite(), low: z.number().finite(), high: z.number().finite(), unit: z.enum(['m', 'deg', 'count', 'none']) }).strict()
export type FeatureParameter = z.infer<typeof FeatureParameterSchema>

/** A claim that a feature of some family exists with these parameters. Several may compete; an AlternativeGroup says which. */
export const FeatureHypothesisSchema = z
  .object({
    id: z.string().min(1),
    family: FeatureFamilySchema,
    storeyIndex: z.number().int().optional(),
    /** The feature this one is hosted by or part of (a wall for an opening, a mass for a recess), when known. */
    hostId: z.string().min(1).optional(),
    sightingIds: z.array(z.string().min(1)),
    measurementIds: z.array(z.string().min(1)),
    parameters: z.record(z.string(), FeatureParameterSchema),
    alternativeGroupId: z.string().min(1).optional(),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type FeatureHypothesis = z.infer<typeof FeatureHypothesisSchema>

/** Rival readings of one thing, and the one taken. */
export const FeatureAlternativeGroupSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    hypothesisIds: z.array(z.string().min(1)).min(1),
    chosenId: z.string().min(1).optional(),
    why: z.string().min(1),
  })
  .strict()
export type FeatureAlternativeGroup = z.infer<typeof FeatureAlternativeGroupSchema>

/** The §1 quality levels: what kind of statement the solved feature is. */
export const QualityLevelSchema = z.enum([
  /** Topology only: the feature exists here, with placeholder metrics. */
  'L0',
  /** Metric, from one view family or derived; not corroborated. */
  'L1',
  /** Metric and corroborated across independent views or printed. */
  'L2',
])
export type QualityLevel = z.infer<typeof QualityLevelSchema>

/** The provenance vocabulary the source truth and the model share. */
export const ProvenanceStatusSchema = z.enum(['SOURCE_EXACT', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED', 'IMAGE_METRIC_REGISTERED', 'VISUAL_SEMANTIC', 'ASSUMED_FOR_RENDERING', 'UNRESOLVED'])
export type ProvenanceStatus = z.infer<typeof ProvenanceStatusSchema>

export const SourceCoverageSchema = z
  .object({
    viewFamilies: z.array(ViewFamilySchema),
    sightings: z.number().int().nonnegative(),
    /** Distinct assets (not variants of one drawing) the feature was seen on. */
    independentAssets: z.number().int().nonnegative(),
    printed: z.boolean(),
  })
  .strict()
export type SourceCoverage = z.infer<typeof SourceCoverageSchema>

/** A feature the solver settled: the hypothesis taken, at what quality, with what left open. */
export const SolvedFeatureSchema = z
  .object({
    id: z.string().min(1),
    family: FeatureFamilySchema,
    hypothesisId: z.string().min(1),
    storeyIndex: z.number().int().optional(),
    hostId: z.string().min(1).optional(),
    quality: QualityLevelSchema,
    provenance: ProvenanceStatusSchema,
    /** Per-parameter provenance where it differs from the feature's. */
    parameterProvenance: z.record(z.string(), ProvenanceStatusSchema),
    sourceCoverage: SourceCoverageSchema,
    uncertainty: z.object({ m: z.number().nonnegative().optional(), deg: z.number().nonnegative().optional() }).strict(),
    parameters: z.record(z.string(), FeatureParameterSchema),
    /** Properties the sources do not settle, by name. Never empty when something is assumed. */
    unresolvedProperties: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type SolvedFeature = z.infer<typeof SolvedFeatureSchema>

/** Which model object a solved feature became, and by which command. */
export const SemanticObjectBindingSchema = z
  .object({
    id: z.string().min(1),
    solvedFeatureId: z.string().min(1),
    objectId: z.string().min(1),
    /** The model collection the object lives in: walls, openings, rooms… */
    objectKind: z.string().min(1),
    commandIndex: z.number().int().nonnegative(),
  })
  .strict()
export type SemanticObjectBinding = z.infer<typeof SemanticObjectBindingSchema>

export const FeatureRelationKindSchema = z.enum(['SAME_FEATURE_AS', 'HOSTED_BY', 'PART_OF', 'ALIGNED_WITH', 'CONTINUES_AS', 'ABOVE', 'BELOW', 'PROJECTS_FROM', 'RECESSED_FROM', 'SUPPORTS', 'CONTRADICTS', 'CORROBORATES'])
export type FeatureRelationKind = z.infer<typeof FeatureRelationKindSchema>

export const FeatureRelationSchema = z
  .object({
    id: z.string().min(1),
    kind: FeatureRelationKindSchema,
    /** Ids of sightings, hypotheses or solved features, as the kind requires. */
    fromId: z.string().min(1),
    toId: z.string().min(1),
    confidence: z.number().min(0).max(1),
    why: z.string().min(1),
  })
  .strict()
export type FeatureRelation = z.infer<typeof FeatureRelationSchema>

export const ArchitecturalEvidenceGraphSchema = z
  .object({
    schema: z.literal(FEATURE_GRAPH_SCHEMA),
    schemaVersion: z.literal(FEATURE_GRAPH_SCHEMA_VERSION),
    id: z.string().min(1),
    sourcePackageHash: z.string().min(1),
    observationGraphHash: z.string().min(1),
    metricEvidenceHash: z.string().min(1),
    sightings: z.array(SourceSightingSchema),
    measurements: z.array(MetricMeasurementSchema),
    hypotheses: z.array(FeatureHypothesisSchema),
    alternatives: z.array(FeatureAlternativeGroupSchema),
    solved: z.array(SolvedFeatureSchema),
    bindings: z.array(SemanticObjectBindingSchema),
    relations: z.array(FeatureRelationSchema),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type ArchitecturalEvidenceGraph = z.infer<typeof ArchitecturalEvidenceGraphSchema>

export type FeatureGraphDraft = Omit<ArchitecturalEvidenceGraph, 'schema' | 'schemaVersion' | 'contentHash'>

export function sealFeatureGraph(draft: FeatureGraphDraft): ArchitecturalEvidenceGraph {
  const contentHash = hashArtifact(FEATURE_GRAPH_SCHEMA, FEATURE_GRAPH_SCHEMA_VERSION, [
    { label: 'inputs', ordered: { sourcePackageHash: draft.sourcePackageHash, observationGraphHash: draft.observationGraphHash, metricEvidenceHash: draft.metricEvidenceHash } },
    { label: 'sightings', unordered: draft.sightings },
    { label: 'measurements', unordered: draft.measurements },
    { label: 'hypotheses', unordered: draft.hypotheses },
    { label: 'alternatives', unordered: draft.alternatives },
    { label: 'solved', unordered: draft.solved },
    { label: 'bindings', unordered: draft.bindings },
    { label: 'relations', unordered: draft.relations },
  ])
  return { schema: FEATURE_GRAPH_SCHEMA, schemaVersion: FEATURE_GRAPH_SCHEMA_VERSION, ...draft, contentHash }
}

/**
 * The structural invariants a feature graph must hold, as a list of
 * violations. Empty means sound. Architecture tests run this on every sealed
 * v2 candidate.
 */
export function featureGraphViolations(graph: FeatureGraphDraft): string[] {
  const out: string[] = []
  const sightings = new Set(graph.sightings.map((s) => s.id))
  const measurements = new Set(graph.measurements.map((m) => m.id))
  const hypotheses = new Map(graph.hypotheses.map((h) => [h.id, h]))
  const solved = new Map(graph.solved.map((s) => [s.id, s]))
  const ids = new Set<string>([...sightings, ...measurements, ...hypotheses.keys(), ...solved.keys()])
  for (const m of graph.measurements) for (const s of m.sightingIds) if (!sightings.has(s)) out.push(`measurement ${m.id} cites unknown sighting ${s}`)
  for (const h of graph.hypotheses) {
    for (const s of h.sightingIds) if (!sightings.has(s)) out.push(`hypothesis ${h.id} cites unknown sighting ${s}`)
    for (const m of h.measurementIds) if (!measurements.has(m)) out.push(`hypothesis ${h.id} cites unknown measurement ${m}`)
    if (h.alternativeGroupId && !graph.alternatives.some((a) => a.id === h.alternativeGroupId)) out.push(`hypothesis ${h.id} names unknown alternative group ${h.alternativeGroupId}`)
  }
  for (const a of graph.alternatives) {
    for (const h of a.hypothesisIds) if (!hypotheses.has(h)) out.push(`alternative group ${a.id} names unknown hypothesis ${h}`)
    if (a.chosenId && !a.hypothesisIds.includes(a.chosenId)) out.push(`alternative group ${a.id} chose ${a.chosenId}, which is not one of its members`)
  }
  for (const s of graph.solved) {
    const h = hypotheses.get(s.hypothesisId)
    if (!h) out.push(`solved feature ${s.id} names unknown hypothesis ${s.hypothesisId}`)
    else if (h.family !== s.family) out.push(`solved feature ${s.id} is ${s.family} but its hypothesis is ${h.family}`)
    // A feature that assumes something must say so: an ASSUMED provenance with nothing unresolved is a contradiction.
    const assumed = s.provenance === 'ASSUMED_FOR_RENDERING' || Object.values(s.parameterProvenance).includes('ASSUMED_FOR_RENDERING')
    if (assumed && s.unresolvedProperties.length === 0) out.push(`solved feature ${s.id} assumes a value and names nothing unresolved`)
    // L2 needs corroboration or a printed figure; L0 may not claim a source-exact provenance.
    if (s.quality === 'L2' && !(s.sourceCoverage.printed || s.sourceCoverage.independentAssets >= 2)) out.push(`solved feature ${s.id} claims L2 with ${s.sourceCoverage.independentAssets} independent asset(s) and nothing printed`)
    if (s.quality === 'L0' && (s.provenance === 'SOURCE_EXACT' || s.provenance === 'SOURCE_CORROBORATED') && Object.keys(s.parameters).length > 0) out.push(`solved feature ${s.id} is L0 (topology only) yet claims ${s.provenance}`)
  }
  const boundFeatures = new Set(graph.bindings.map((b) => b.solvedFeatureId))
  for (const b of graph.bindings) if (!solved.has(b.solvedFeatureId)) out.push(`binding ${b.id} names unknown solved feature ${b.solvedFeatureId}`)
  for (const r of graph.relations) {
    if (!ids.has(r.fromId)) out.push(`relation ${r.id} starts at unknown ${r.fromId}`)
    if (!ids.has(r.toId)) out.push(`relation ${r.id} ends at unknown ${r.toId}`)
  }
  // Topological features are expressed through their members: a recess through its returns and floor, an assembly through its members, a camera through nothing.
  const throughMembers = new Set<string>(['CAMERA', 'FACADE_ASSEMBLY', 'RECESS'])
  for (const s of graph.solved) if (s.quality !== 'L0' && !boundFeatures.has(s.id) && !throughMembers.has(s.family)) out.push(`solved feature ${s.id} (${s.family}, ${s.quality}) became no model object`)
  return out
}
