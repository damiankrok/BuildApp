/**
 * v3.54.3 — from a post-build proposal to a correction the analyzer can apply, and from a rebuilt candidate to a
 * decision about the property the correction was for.
 *
 * detection → binding → proposal → validation → application → geometry → review are kept apart:
 *   - the consultant DETECTS a difference and PROPOSES where a feature is, in one elevation picture's pixels;
 *   - `bindRoofFeature` VALIDATES the proposal (revision, picture, kind, numbers, uncertainty) and BINDS it: pixels become
 *     shares of the side and of the roof's rise, the side is checked against the analyzer's own registration of that
 *     picture, and the feature gets a stable id the consultant never chose;
 *   - the analyzer APPLIES it (`@buildapp/reconstruction` roof-feature.ts) inside its own pipeline and reports what it
 *     built or why it refused;
 *   - `compareGeometry` decides on the candidate by the property the correction was for: the feature must have been built,
 *     and everything the correction was not about — scale, footprint, storeys, exterior walls, openings — must be what
 *     it was. A better-settled scale is NOT asked of a roof correction.
 *   - the consultant REVIEWS the new revision's render; a feature it then calls wrong is taken out again.
 */
import { createHash } from 'node:crypto'
import type { RoofFeatureCorrection, RoofFeatureOutcome } from '@buildapp/reconstruction'
import type { AnalysisRun } from '../run.js'
import { GEOMETRY_OPERATIONS } from './contract.js'
import type { AppliedReview, ProposedCorrection } from './contract.js'

export type CheckPicture = { n: number; what: 'PLAN' | 'ELEVATION' | 'OTHER_SOURCE' | 'MODEL_VIEWS'; frameId?: string; projection?: string; width: number; height: number; label: string }

export type GeometryVerdict = {
  proposalId: string
  operation: string
  targetId: string
  /** ACCEPTED: bound and handed to the analyzer. HELD: kept as a hypothesis (uncertain, or in conflict). */
  status: 'ACCEPTED' | 'REJECTED' | 'HELD' | 'CAPABILITY_MISSING'
  code?: 'STALE_REVISION' | 'DUPLICATE_PROPOSAL_ID' | 'NO_FEATURE' | 'KIND_WITHOUT_CONSUMER' | 'NOT_AN_ELEVATION' | 'NOT_ORTHOGRAPHIC' | 'OUT_OF_PICTURE' | 'INCONSISTENT_GEOMETRY' | 'HIGH_UNCERTAINTY' | 'VIEW_CONFLICT' | 'ALREADY_PRESENT' | 'NO_CONSUMER'
  why: string
  featureId?: string
}

const SIDE_OF_REGISTRATION: Record<string, string> = { FRONT: 'FRONT', REAR: 'REAR', LEFT: 'LEFT', RIGHT: 'RIGHT', WEST: 'LEFT', EAST: 'RIGHT' }
const DORMER_KINDS = new Set(['GABLE_DORMER', 'SHED_DORMER', 'FLAT_DORMER'])

/** The stable id of a roof feature: its kind's family, its side and where along that side its middle is, in twentieths. */
export const roofFeatureId = (side: string, fromShare: number, toShare: number): string => `dormer-${side.toLowerCase()}-c${String(Math.round(((fromShare + toShare) / 2) * 20) * 5).padStart(2, '0')}`

/**
 * One proposal of the post-build check, validated and bound. `revision` is the model the consultant was shown;
 * `registeredSides` what the analyzer's own view registration made of each elevation frame; `present` the features the
 * model already holds.
 */
export function bindRoofFeature(p: ProposedCorrection, ctx: { revision: string; pictures: readonly CheckPicture[]; registeredSides: ReadonlyMap<string, string>; present: ReadonlySet<string>; seen: Set<string> }): { verdict: GeometryVerdict; correction?: RoofFeatureCorrection } {
  const v = (status: GeometryVerdict['status'], code: GeometryVerdict['code'] | undefined, why: string, featureId?: string): { verdict: GeometryVerdict } => ({ verdict: { proposalId: p.proposalId, operation: p.operation, targetId: p.targetId, status, ...(code ? { code } : {}), why, ...(featureId ? { featureId } : {}) } })
  if (ctx.seen.has(p.proposalId)) return v('REJECTED', 'DUPLICATE_PROPOSAL_ID', 'this proposal id was already given: a repeated proposal is not applied twice')
  ctx.seen.add(p.proposalId)
  if (!(GEOMETRY_OPERATIONS as readonly string[]).includes(p.operation)) return v('CAPABILITY_MISSING', 'NO_CONSUMER', `${p.operation}: the analyzer has no consumer for this correction family (named gap; the finding stays on the record)`)
  if (p.baseRevision !== ctx.revision) return v('REJECTED', 'STALE_REVISION', `names model ${p.baseRevision}; the analyzer is at ${ctx.revision}: a proposal about another revision is never applied silently`)
  const f = p.feature
  if (!f) return v('REJECTED', 'NO_FEATURE', 'a ROOF_FEATURE proposal states where the feature is (`feature`); this one does not')
  if (!DORMER_KINDS.has(f.kind)) return v('CAPABILITY_MISSING', 'KIND_WITHOUT_CONSUMER', `${f.kind}: the analyzer builds dormers on a slope (gable, shed, flat); a ${f.kind.toLowerCase().replace(/_/g, ' ')} has no consumer yet`)
  const pic = ctx.pictures.find((x) => x.n === f.picture)
  if (!pic || pic.what !== 'ELEVATION') return v('REJECTED', 'NOT_AN_ELEVATION', `picture ${f.picture} is not one of the source elevation drawings shown: a feature is placed from an elevation, never from the model's own views or a plan`)
  if (pic.projection !== 'ORTHOGRAPHIC_ELEVATION') return v('REJECTED', 'NOT_ORTHOGRAPHIC', `picture ${f.picture} is not an orthographic elevation (${pic.projection ?? 'unknown projection'}): shares of a perspective picture are not shares of a facade`)
  const nums = [f.facade.leftX, f.facade.rightX, f.facade.eavesY, f.facade.ridgeY, f.box.x0, f.box.y0, f.box.x1, f.box.y1]
  if (!nums.every((x) => typeof x === 'number' && Number.isFinite(x))) return v('REJECTED', 'INCONSISTENT_GEOMETRY', 'a coordinate is missing or not a number')
  const inPic = (x: number, y: number): boolean => x >= -2 && y >= -2 && x <= pic.width + 2 && y <= pic.height + 2
  if (!inPic(f.facade.leftX, f.facade.eavesY) || !inPic(f.facade.rightX, f.facade.ridgeY) || !inPic(f.box.x0, f.box.y0) || !inPic(f.box.x1, f.box.y1)) return v('REJECTED', 'OUT_OF_PICTURE', `a coordinate lies outside picture ${f.picture} (${pic.width} × ${pic.height} px)`)
  const width = f.facade.rightX - f.facade.leftX
  const rise = f.facade.eavesY - f.facade.ridgeY
  if (!(width > 40) || !(rise > 20)) return v('REJECTED', 'INCONSISTENT_GEOMETRY', 'the facade box is degenerate: its right edge must lie right of its left, and the ridge above the eaves (y grows downwards)')
  if (!(f.box.x1 > f.box.x0) || !(f.box.y1 > f.box.y0)) return v('REJECTED', 'INCONSISTENT_GEOMETRY', "the feature's box is degenerate (x0 < x1, and its top y0 above its eaves y1)")
  if (f.box.x0 < f.facade.leftX - 0.05 * width || f.box.x1 > f.facade.rightX + 0.05 * width) return v('REJECTED', 'INCONSISTENT_GEOMETRY', 'the feature lies outside the facade it is said to be on')
  if (f.box.y1 > f.facade.eavesY + 0.08 * rise || f.box.y0 < f.facade.ridgeY - 0.1 * rise) return v('REJECTED', 'INCONSISTENT_GEOMETRY', "the feature's eaves lie below the main roof's eaves, or its top above the ridge: that is not a feature on this roof")
  if (p.uncertainty === 'HIGH') return v('HELD', 'HIGH_UNCERTAINTY', 'HIGH uncertainty: kept as a hypothesis, not applied')
  const registered = pic.frameId ? ctx.registeredSides.get(pic.frameId) : undefined
  const analyzerSide = registered ? SIDE_OF_REGISTRATION[registered] : undefined
  if (analyzerSide && analyzerSide !== f.modelSide) return v('HELD', 'VIEW_CONFLICT', `the analyzer registered picture ${f.picture} as the ${analyzerSide.toLowerCase()} side; the proposal reads it as the ${f.modelSide.toLowerCase()} side. Which side the drawing shows is not settled (ASSIGN_VIEW has no consumer), so the feature is not placed on either`)
  let fromShare = (f.box.x0 - f.facade.leftX) / width
  let toShare = (f.box.x1 - f.facade.leftX) / width
  if (f.mirrored) [fromShare, toShare] = [1 - toShare, 1 - fromShare]
  const r4 = (x: number): number => Math.round(x * 1e4) / 1e4
  const eaveShare = r4(Math.max(0, (f.facade.eavesY - f.box.y1) / rise))
  const ridgeShare = r4((f.facade.eavesY - f.box.y0) / rise)
  const id = roofFeatureId(f.modelSide, fromShare, toShare)
  if (ctx.present.has(id)) return v('REJECTED', 'ALREADY_PRESENT', `the model already holds ${id} there: the same feature is not added twice`, id)
  const correction: RoofFeatureCorrection = {
    id,
    proposalId: p.proposalId,
    kind: f.kind as RoofFeatureCorrection['kind'],
    side: f.modelSide,
    fromShare: r4(fromShare),
    toShare: r4(toShare),
    eaveShare,
    ...(f.kind === 'GABLE_DORMER' ? { ridgeShare } : {}),
    front: f.front === 'SET_BACK_ON_SLOPE' ? 'SET_BACK' : 'FLUSH',
    glazed: f.glazed,
    why: `a ${f.kind.toLowerCase().replace(/_/g, ' ')} the consultant sees on source picture ${f.picture}${analyzerSide ? ` (which the analyzer's own registration also reads as the ${analyzerSide.toLowerCase()} side)` : ' (a side the analyzer did not register itself)'}: ${p.justification.slice(0, 240)}`,
  }
  return { ...v('ACCEPTED', undefined, `bound to ${id}: ${(fromShare * 100).toFixed(0)}–${(toShare * 100).toFixed(0)} % of the ${f.modelSide.toLowerCase()} side, eaves at ${(eaveShare * 100).toFixed(0)} % and top at ${(ridgeShare * 100).toFixed(0)} % of the roof's rise; handed to the analyzer`, id), correction }
}

// ---------------------------------------------------------------------------------------------------------------
// what a geometry correction must leave alone, and what it must have changed
// ---------------------------------------------------------------------------------------------------------------

export type GeometryState = {
  modelHash: string
  /** Digests of what a roof correction is not about. Equal digests: that part of the model is byte for byte the same. */
  protected: { levels: string; slabs: string; exteriorWalls: string; openings: string; rooms: string }
  interiorWalls: number
  roofFeatures: string[]
  previewFailures: number
}

const digest = (x: unknown): string => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16)

type ModelParts = { levels?: unknown[]; slabs?: unknown[]; walls?: Array<{ id: string; kind?: string; start: unknown; end: unknown; thickness: number; height: number; levelId: string }>; openings?: Array<{ id: string; wallId: string }>; rooms?: unknown[]; windows?: unknown[]; doors?: unknown[]; assemblies?: Array<{ id: string; kind?: string }> }

/** The parts of a run's model a roof correction must not move, each as a digest, and the roof features it holds. */
export function geometryStateOf(run: AnalysisRun, featureIds: readonly string[] = []): GeometryState {
  const m = run.reconstruction.model as unknown as ModelParts
  const own = (id: string): boolean => featureIds.some((f) => id === f || id.startsWith(`${f}-`))
  // an exterior wall's nominal box; its top profile names roof planes, which a roof correction restates
  const ext = (m.walls ?? []).filter((w) => w.kind === 'EXTERIOR' && !own(w.id)).map((w) => ({ id: w.id, start: w.start, end: w.end, thickness: w.thickness, height: w.height, levelId: w.levelId }))
  const openings = (m.openings ?? []).filter((o) => !own(o.id) && !own(o.wallId))
  return {
    modelHash: run.reconstruction.candidate.modelHash,
    protected: { levels: digest(m.levels ?? []), slabs: digest(m.slabs ?? []), exteriorWalls: digest(ext), openings: digest(openings), rooms: digest(m.rooms ?? []) },
    interiorWalls: (m.walls ?? []).filter((w) => w.kind !== 'EXTERIOR').length,
    roofFeatures: (run.reconstruction.building.dormers ?? []).map((d) => d.id).sort(),
    previewFailures: run.reconstruction.partialPreview?.failures.length ?? 0,
  }
}

export type GeometryDecision = { decision: 'ACCEPT' | 'ROLLBACK' | 'NO_CHANGE'; why: string; applied: string[]; refused: Array<{ id: string; code?: string; why: string }> }

/**
 * The decision on a candidate rebuilt with roof corrections, by the property they are for. ACCEPT needs every new
 * feature built by the analyzer and present in the model, nothing the model newly refuses, and every protected part
 * unchanged. The scale is not weighed: it was not what the correction was about, and the metric revision is the same.
 */
export function compareGeometry(before: GeometryState, after: GeometryState | undefined, asked: readonly RoofFeatureCorrection[], outcomes: readonly RoofFeatureOutcome[] | undefined, failure?: string): GeometryDecision {
  const refused = (outcomes ?? []).filter((o) => o.status === 'REFUSED').map((o) => ({ id: o.id, ...(o.code ? { code: o.code } : {}), why: o.why }))
  if (!after) return { decision: 'ROLLBACK', why: `the candidate did not build (${failure ?? 'no model'}) where the model before did: kept the model before`, applied: [], refused }
  const built = asked.filter((c) => (outcomes ?? []).some((o) => o.id === c.id && o.status === 'APPLIED') && after.roofFeatures.includes(c.id)).map((c) => c.id)
  if (built.length === 0) return { decision: 'NO_CHANGE', why: `the analyzer applied none of the ${asked.length} correction(s): ${refused.map((r) => `${r.id} ${r.code ?? ''}`).join('; ') || 'not built by the model'}`, applied: [], refused }
  const moved = (Object.keys(before.protected) as Array<keyof GeometryState['protected']>).filter((k) => before.protected[k] !== after.protected[k])
  if (moved.length > 0) return { decision: 'ROLLBACK', why: `the correction was about the roof, and the candidate also changed ${moved.join(', ')}: a correction may not move what it is not about — kept the model before`, applied: [], refused }
  if (after.previewFailures > before.previewFailures) return { decision: 'ROLLBACK', why: `the model refuses ${after.previewFailures - before.previewFailures} more object(s) than before: the correction costs a part of the house — kept the model before`, applied: [], refused }
  const lost = before.roofFeatures.filter((id) => !after.roofFeatures.includes(id))
  if (lost.length > 0) return { decision: 'ROLLBACK', why: `the candidate lost ${lost.join(', ')}, which the model before held`, applied: [], refused }
  return { decision: 'ACCEPT', why: `the analyzer built ${built.join(', ')}; levels, slabs, exterior walls, openings and rooms are byte for byte what they were (the scale and the metric revision are the same by construction)`, applied: built, refused }
}

/** What the consultant's review of the new revision says of each applied feature: keep it, or take it out again. */
export function reviewOutcome(applied: readonly string[], review: readonly AppliedReview[] | undefined): Array<{ id: string; verdict: AppliedReview['verdict'] | 'NOT_REVIEWED'; keep: boolean; note: string }> {
  return applied.map((id) => {
    const r = (review ?? []).find((x) => x.id === id)
    if (!r) return { id, verdict: 'NOT_REVIEWED' as const, keep: true, note: 'the review did not name it: it stays, marked not reviewed' }
    // a feature in the wrong place or of the wrong size is still the feature the source shows; one of the wrong kind,
    // or one the source does not show, is not
    const keep = r.verdict !== 'SHOULD_NOT_EXIST' && r.verdict !== 'WRONG_KIND'
    return { id, verdict: r.verdict, keep, note: r.note }
  })
}
