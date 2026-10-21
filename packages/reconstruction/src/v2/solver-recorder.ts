/**
 * What the v2 solver writes as it reads a house, kept in one place: the steps it took, the gaps it could not close,
 * the sightings of features in the sources, the features it solved and how they relate, and how each piece of evidence
 * was consumed. Every stage of `reconstructV2` records through these functions; none of them decides anything.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import type { PrimitiveTrace, SolverStep, UnresolvedCandidate } from '../candidate.js'
import type { FeatureFamily, FeatureGraphDraft, ProvenanceStatus, SolvedFeature, SourceSighting, ViewFamily } from './graph.js'
import type { EvidenceConsumptionRecord } from './ledger.js'
import { qualityLevelOf } from './quality.js'

export type SolverRecord = {
  sightings: SourceSighting[]
  measurements: FeatureGraphDraft['measurements']
  hypotheses: FeatureGraphDraft['hypotheses']
  alternatives: FeatureGraphDraft['alternatives']
  solved: SolvedFeature[]
  relations: FeatureGraphDraft['relations']
  ledger: EvidenceConsumptionRecord[]
  steps: SolverStep[]
  unresolved: UnresolvedCandidate[]
  traces: PrimitiveTrace[]
  consumed: Map<string, EvidenceConsumptionRecord>
}

export const emptySolverRecord = (): SolverRecord => ({ sightings: [], measurements: [], hypotheses: [], alternatives: [], solved: [], relations: [], ledger: [], steps: [], unresolved: [], traces: [], consumed: new Map() })

export const viewFamilyOf = (frame: SourceCoordinateFrame): ViewFamily => (frame.roles.projection === 'ORTHOGRAPHIC_PLAN' ? (frame.roles.document === 'SITE_PLAN' ? 'SITE' : 'PLAN') : frame.roles.projection === 'ORTHOGRAPHIC_ELEVATION' ? 'ELEVATION' : frame.roles.projection === 'ORTHOGRAPHIC_SECTION' ? 'SECTION' : frame.roles.projection === 'PERSPECTIVE' ? 'PERSPECTIVE' : 'PAGE')

export type FeatureParameters = Record<string, { value: number; low: number; high: number; unit?: 'm' | 'deg' | 'count' | 'none' }>
export type FeatureExtra = { storeyIndex?: number; hostId?: string; unresolvedProperties?: string[]; printed?: boolean; uncertaintyM?: number; parameterProvenance?: Record<string, ProvenanceStatus>; confidence?: number }

/** A stronger disposition of a piece of evidence replaces a weaker one; nothing is recorded twice. */
const DISPOSITION_RANK: Record<EvidenceConsumptionRecord['disposition'], number> = { USED_IN_MODEL: 5, USED_AS_CORROBORATION: 4, CONFLICTED: 3, UNRESOLVED: 2, REJECTED_WITH_REASON: 1, IGNORED_WITH_REASON: 0 }

export function createSolverRecorder(ctx: SolverRecord) {
  /** A step the solver took, in order. */
  const step = (s: Omit<SolverStep, 'index'>): void => {
    ctx.steps.push({ ...s, index: ctx.steps.length })
  }
  /** Something the sources do not settle, and why. */
  const gap = (u: Omit<UnresolvedCandidate, 'id'>): void => {
    ctx.unresolved.push({ ...u, id: stableId('gap', u.what.slice(0, 40).replace(/[^a-z0-9]+/gi, '-'), { what: u.what, status: u.status }) })
  }
  /** How one piece of evidence was used. */
  const record = (r: EvidenceConsumptionRecord): void => {
    const held = ctx.consumed.get(r.evidenceId)
    if (held && DISPOSITION_RANK[held.disposition] >= DISPOSITION_RANK[r.disposition]) return
    ctx.consumed.set(r.evidenceId, r)
  }
  /** Where a feature was seen; returns the sighting's id (one per frame, what and box). */
  const sighting = (frame: SourceCoordinateFrame, what: string, confidence: number, observationIds: string[] = [], pixelRect?: SourceSighting['pixelRect']): string => {
    const id = stableId('sight', `${what.slice(0, 24)}-${frame.id.slice(-8)}`, { frame: frame.id, what, pixelRect: pixelRect ?? null })
    if (!ctx.sightings.some((s) => s.id === id)) ctx.sightings.push({ id, frameId: frame.id, assetId: frame.assetId, viewFamily: viewFamilyOf(frame), observationIds, ...(pixelRect ? { pixelRect } : {}), what, confidence: round6(confidence) })
    return id
  }
  /** A solved feature with its parameters, the sightings behind it and its provenance; returns the feature's id. */
  const feature = (family: FeatureFamily, key: string, params: FeatureParameters, sightingIds: string[], provenance: ProvenanceStatus, why: string, extra: FeatureExtra = {}): string => {
    const hypothesisId = `hyp-${key}`
    const featureId = `feat-${key}`
    const parameters = Object.fromEntries(Object.entries(params).map(([k, p]) => [k, { value: round6(p.value), low: round6(p.low), high: round6(p.high), unit: p.unit ?? 'm' }]))
    ctx.hypotheses.push({ id: hypothesisId, family, ...(extra.storeyIndex !== undefined ? { storeyIndex: extra.storeyIndex } : {}), ...(extra.hostId ? { hostId: extra.hostId } : {}), sightingIds, measurementIds: [], parameters, confidence: round6(extra.confidence ?? 0.7), why })
    const frames = new Set(sightingIds.map((s) => ctx.sightings.find((x) => x.id === s)?.assetId).filter(Boolean))
    const families = [...new Set(sightingIds.map((s) => ctx.sightings.find((x) => x.id === s)?.viewFamily).filter((f): f is ViewFamily => !!f))]
    const solved: SolvedFeature = {
      id: featureId,
      family,
      hypothesisId,
      ...(extra.storeyIndex !== undefined ? { storeyIndex: extra.storeyIndex } : {}),
      ...(extra.hostId ? { hostId: extra.hostId } : {}),
      quality: 'L0',
      provenance,
      parameterProvenance: extra.parameterProvenance ?? {},
      sourceCoverage: { viewFamilies: families, sightings: sightingIds.length, independentAssets: frames.size, printed: extra.printed ?? false },
      uncertainty: extra.uncertaintyM !== undefined ? { m: extra.uncertaintyM } : {},
      parameters,
      unresolvedProperties: extra.unresolvedProperties ?? [],
      why,
    }
    solved.quality = qualityLevelOf(solved)
    ctx.solved.push(solved)
    return featureId
  }
  /** A relation between two features. */
  const relate = (kind: FeatureGraphDraft['relations'][number]['kind'], fromId: string, toId: string, why: string, confidence = 0.8): void => {
    ctx.relations.push({ id: stableId('rel', `${kind}-${fromId.slice(-10)}-${toId.slice(-10)}`, { kind, fromId, toId }), kind, fromId, toId, confidence, why })
  }
  return { step, gap, record, sighting, feature, relate }
}

export type SolverRecorder = ReturnType<typeof createSolverRecorder>
