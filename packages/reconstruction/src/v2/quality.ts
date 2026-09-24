/**
 * Per-feature quality (§1, §20): what kind of statement each solved feature is.
 *
 *  L0  the feature exists here, as topology, with placeholder metrics;
 *  L1  its metrics were solved from one view family, or derived;
 *  L2  its metrics are printed, or corroborated across independent views.
 *
 * The level is COMPUTED from the solved feature's coverage and provenance, so
 * a solver cannot award itself a level it did not earn. The report is written
 * beside the candidate and read by the evaluation and the viewers.
 */
import { z } from 'zod'
import { hashArtifact } from '@buildapp/source-common'
import { FeatureFamilySchema, ProvenanceStatusSchema, QualityLevelSchema, SourceCoverageSchema } from './graph.js'
import type { QualityLevel, SolvedFeature } from './graph.js'

export const QUALITY_SCHEMA = 'buildapp.feature-quality-report' as const
export const QUALITY_SCHEMA_VERSION = '1.0.0' as const

export const FeatureQualityRecordSchema = z
  .object({
    featureId: z.string().min(1),
    family: FeatureFamilySchema,
    level: QualityLevelSchema,
    provenance: ProvenanceStatusSchema,
    sourceCoverage: SourceCoverageSchema,
    uncertainty: z.object({ m: z.number().nonnegative().optional(), deg: z.number().nonnegative().optional() }).strict(),
    unresolvedProperties: z.array(z.string().min(1)),
    objectIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type FeatureQualityRecord = z.infer<typeof FeatureQualityRecordSchema>

export const FeatureQualityReportSchema = z
  .object({
    schema: z.literal(QUALITY_SCHEMA),
    schemaVersion: z.literal(QUALITY_SCHEMA_VERSION),
    id: z.string().min(1),
    featureGraphHash: z.string().min(1),
    records: z.array(FeatureQualityRecordSchema),
    /** Counts by family and level: `{ OPENING: { L2: 9, L1: 3 } }`. */
    summary: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type FeatureQualityReport = z.infer<typeof FeatureQualityReportSchema>

/** The level a solved feature has EARNED, from its coverage and provenance. */
export function qualityLevelOf(feature: Pick<SolvedFeature, 'provenance' | 'sourceCoverage' | 'parameters' | 'unresolvedProperties'>): QualityLevel {
  const c = feature.sourceCoverage
  if (feature.provenance === 'UNRESOLVED' || feature.provenance === 'ASSUMED_FOR_RENDERING') return 'L0'
  if (Object.keys(feature.parameters).length === 0) return 'L0'
  if (c.printed || c.independentAssets >= 2) return feature.provenance === 'VISUAL_SEMANTIC' ? 'L1' : 'L2'
  return 'L1'
}

export function sealQualityReport(id: string, featureGraphHash: string, solved: readonly SolvedFeature[], objectIdsOf: (featureId: string) => string[]): FeatureQualityReport {
  const records: FeatureQualityRecord[] = solved
    .map((s) => ({
      featureId: s.id,
      family: s.family,
      level: qualityLevelOf(s),
      provenance: s.provenance,
      sourceCoverage: s.sourceCoverage,
      uncertainty: s.uncertainty,
      unresolvedProperties: [...s.unresolvedProperties],
      objectIds: objectIdsOf(s.id).sort(),
      why: s.why,
    }))
    .sort((a, b) => a.featureId.localeCompare(b.featureId))
  const summary: Record<string, Record<string, number>> = {}
  for (const r of records) {
    summary[r.family] ??= {}
    summary[r.family][r.level] = (summary[r.family][r.level] ?? 0) + 1
  }
  const contentHash = hashArtifact(QUALITY_SCHEMA, QUALITY_SCHEMA_VERSION, [{ label: 'graph', ordered: featureGraphHash }, { label: 'records', unordered: records }])
  return { schema: QUALITY_SCHEMA, schemaVersion: QUALITY_SCHEMA_VERSION, id, featureGraphHash, records, summary, contentHash }
}
