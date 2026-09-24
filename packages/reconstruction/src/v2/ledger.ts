/**
 * EvidenceConsumptionLedger — every piece of evidence, and what became of it.
 *
 * The analyzer's worst failure mode is silent: a zone is detected, its return
 * stubs are drawn on the plan, and the model has no recess. Nothing errored;
 * the evidence was simply never consumed and nothing recorded that. The ledger
 * makes that impossible to do quietly. Every observation, every metric
 * reading, every page fact and every v2 sighting gets exactly one
 * disposition, and the invariants below hold that no high-authority evidence
 * disappears without a reason a reader can check.
 */
import { z } from 'zod'
import { hashArtifact } from '@buildapp/source-common'

export const LEDGER_SCHEMA = 'buildapp.evidence-consumption-ledger' as const
export const LEDGER_SCHEMA_VERSION = '1.0.0' as const

export const EvidenceDispositionSchema = z.enum(['USED_IN_MODEL', 'USED_AS_CORROBORATION', 'CONFLICTED', 'UNRESOLVED', 'REJECTED_WITH_REASON', 'IGNORED_WITH_REASON'])
export type EvidenceDisposition = z.infer<typeof EvidenceDispositionSchema>

export const EvidenceKindSchema = z.enum(['OBSERVATION', 'METRIC', 'PAGE_FACT', 'PAGE_ROOM', 'SIGHTING', 'MEASUREMENT'])
export type LedgerEvidenceKind = z.infer<typeof EvidenceKindSchema>

/** The §11 passes, as stages a disposition can be taken at. */
export const PipelineStageSchema = z.enum(['ACQUISITION', 'ATLAS', 'REGISTRATION', 'OBSERVATION', 'METRIC', 'IDENTITY', 'TOPOLOGY', 'METRIC_SOLVE', 'ASSEMBLY', 'DSL', 'GEOMETRY', 'VERIFICATION', 'REPAIR', 'QUALITY'])
export type PipelineStage = z.infer<typeof PipelineStageSchema>

export const EvidenceAuthoritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export type EvidenceAuthority = z.infer<typeof EvidenceAuthoritySchema>

export const EvidenceConsumptionRecordSchema = z
  .object({
    evidenceId: z.string().min(1),
    evidenceKind: EvidenceKindSchema,
    /** What the evidence describes, for a reader: "LINEAR_DIMENSION 790 on the ground plan". */
    what: z.string().min(1),
    authority: EvidenceAuthoritySchema,
    featureId: z.string().min(1).optional(),
    disposition: EvidenceDispositionSchema,
    reason: z.string().min(1),
    stage: PipelineStageSchema,
  })
  .strict()
export type EvidenceConsumptionRecord = z.infer<typeof EvidenceConsumptionRecordSchema>

export const EvidenceConsumptionLedgerSchema = z
  .object({
    schema: z.literal(LEDGER_SCHEMA),
    schemaVersion: z.literal(LEDGER_SCHEMA_VERSION),
    id: z.string().min(1),
    featureGraphHash: z.string().min(1),
    records: z.array(EvidenceConsumptionRecordSchema),
    summary: z.record(z.string(), z.number().int().nonnegative()),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type EvidenceConsumptionLedger = z.infer<typeof EvidenceConsumptionLedgerSchema>

export function sealLedger(id: string, featureGraphHash: string, records: readonly EvidenceConsumptionRecord[]): EvidenceConsumptionLedger {
  const summary: Record<string, number> = {}
  for (const r of records) summary[r.disposition] = (summary[r.disposition] ?? 0) + 1
  const sorted = [...records].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId) || a.stage.localeCompare(b.stage))
  const contentHash = hashArtifact(LEDGER_SCHEMA, LEDGER_SCHEMA_VERSION, [{ label: 'graph', ordered: featureGraphHash }, { label: 'records', unordered: sorted }])
  return { schema: LEDGER_SCHEMA, schemaVersion: LEDGER_SCHEMA_VERSION, id, featureGraphHash, records: sorted, summary, contentHash }
}

/**
 * The §8 invariants, as violations. Empty means the ledger is honest:
 *
 *  1. every evidence id has exactly one disposition;
 *  2. no HIGH-authority evidence is dropped without a stated reason — its
 *     disposition is one of the six and, if it was not used, the reason is
 *     more than a placeholder;
 *  3. every USED_IN_MODEL record names the feature it was used in.
 */
export function ledgerViolations(records: readonly EvidenceConsumptionRecord[], expectedEvidenceIds: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Map<string, number>()
  for (const r of records) seen.set(r.evidenceId, (seen.get(r.evidenceId) ?? 0) + 1)
  for (const [id, n] of seen) if (n > 1) out.push(`evidence ${id} has ${n} dispositions`)
  for (const id of expectedEvidenceIds) if (!seen.has(id)) out.push(`evidence ${id} has no disposition`)
  for (const r of records) {
    if (r.disposition === 'USED_IN_MODEL' && !r.featureId) out.push(`${r.evidenceId} is USED_IN_MODEL but names no feature`)
    if (r.authority === 'HIGH' && (r.disposition === 'REJECTED_WITH_REASON' || r.disposition === 'IGNORED_WITH_REASON') && r.reason.trim().length < 12) out.push(`${r.evidenceId} (HIGH authority) was dropped with no real reason`)
  }
  return out
}
