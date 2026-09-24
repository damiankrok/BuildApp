/**
 * The v2 analyzer, end to end (§11 passes A–N).
 *
 *  A  acquisition is upstream (the SourcePackage);          B  the atlas is the graph's frames;
 *  C  view registration: plans by chains / outer faces, renders by ridge datum, the section by its walls;
 *  D  observations: the graph plus the v2 raster readers;    E  metric evidence: the metric set plus v2 measurements;
 *  F  cross-view identity: the feature graph's relations;    G  topology: masses, recesses, returns, interior, stair, roof;
 *  H  metric solve: the readers' figures against printed ones;  I  secondary assemblies: fascias, verges, portal, balconies;
 *  J  DSL emission;  K  geometry: the sealed candidate's replay;  L  source-view verification;  M  repair;  N  quality.
 *
 * Everything here is generic. It knows drawings and buildings, and no project.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import type { Raster } from '@buildapp/source-cv'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { CONVENTIONS, SOLVER_NAME, levelsFrom, registerElevationFrames } from '../solve.js'
import { composeStructuralLayout } from '../structural.js'
import type { PublishedArea } from '../layout-gate.js'
import { ringBounds } from '../structural-layout.js'
import type { StructuralLayoutHypothesisSet } from '../structural-layout.js'
import type { PlanReading } from '../layout.js'
import { sealCandidate } from '../candidate.js'
import type { ReconstructionCandidate, UnresolvedCandidate, SolverStep, PrimitiveTrace } from '../candidate.js'
import { HYPOTHESIS_SET_SCHEMA, HYPOTHESIS_SET_SCHEMA_VERSION } from '../hypotheses.js'
import type { PrimitiveHypothesisSet } from '../hypotheses.js'
import { hashArtifact } from '@buildapp/source-common'
import { elevationFrameFromV2, flipZ, planFrameByOuterFaces, planFrameV2, registerElevationV2, worldFrameFrom } from './frame.js'
import type { ElevationFrameV2, ElevationRegistrationV2, PlanFrameV2, WorldFrameV2 } from './frame.js'
import { scanZoneForReturns } from './recesses.js'
import type { RecessTopology, ZoneSide } from './recesses.js'
import { readInterior } from './interior.js'
import type { InteriorReading, LabelToken } from './interior.js'
import { assembleStair, findTreadLadders, poolLadders } from './stair-topology.js'
import { readWallOpenings } from './openings-v2.js'
import type { OpeningV2, WallHost } from './openings-v2.js'
import { readAttachedRoof, readChimneys, readRooflights, registerSection } from './roof-details.js'
import { readFasciaBand, readRailing, readVergeMember } from './facade.js'
import type { FacadeAssemblyHypothesis, FacadeMember } from './facade.js'
import { solvePerspectiveCamera } from './camera.js'
import type { PerspectiveCameraV2 } from './camera.js'
import { emitBuilding } from './emit.js'
import type { BuildingV2, MassV2, ReturnWallV2 } from './building.js'
import { featureGraphViolations, sealFeatureGraph } from './graph.js'
import type { ArchitecturalEvidenceGraph, FeatureFamily, FeatureGraphDraft, ProvenanceStatus, SolvedFeature, SourceSighting, ViewFamily } from './graph.js'
import { ledgerViolations, sealLedger } from './ledger.js'
import type { EvidenceConsumptionLedger, EvidenceConsumptionRecord } from './ledger.js'
import { qualityLevelOf, sealQualityReport } from './quality.js'
import type { FeatureQualityReport } from './quality.js'
import { repairFromResiduals, verifyAgainstViews } from './verify.js'
import type { RepairTrace, SourceViewResidual } from './verify.js'
import { dominantTone } from './scan.js'

export const SOLVER_V2_VERSION = '2.0.0' as const

export type ReconstructionV2Options = {
  label: string
  slug: string
  sourcePackageId: string
  sourcePackageHash: string
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  raster: (frame: SourceCoordinateFrame) => Raster | undefined
  publishedAreas?: readonly PublishedArea[]
  publishedRooms?: ReadonlyArray<{ storey: string; index: number; label: string; area: number }>
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
}

export type ReconstructionV2Result = {
  layout: StructuralLayoutHypothesisSet
  building: BuildingV2
  candidate: ReconstructionCandidate
  model: CanonicalBuildingModel
  hypotheses: PrimitiveHypothesisSet
  featureGraph: ArchitecturalEvidenceGraph
  ledger: EvidenceConsumptionLedger
  quality: FeatureQualityReport
  residuals: SourceViewResidual[]
  repair: RepairTrace
  registrations: { plans: PlanFrameV2[]; elevations: ElevationRegistrationV2[]; section?: { frameId: string; mpp: number; originCol: number; zeroRow: number }; cameras: Array<{ frameId: string; solved: boolean; residualPx?: number; why: string }> }
  world: WorldFrameV2
  steps: SolverStep[]
  unresolved: UnresolvedCandidate[]
  violations: { graph: string[]; ledger: string[] }
}

type Ctx = {
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

const viewFamilyOf = (frame: SourceCoordinateFrame): ViewFamily => (frame.roles.projection === 'ORTHOGRAPHIC_PLAN' ? (frame.roles.document === 'SITE_PLAN' ? 'SITE' : 'PLAN') : frame.roles.projection === 'ORTHOGRAPHIC_ELEVATION' ? 'ELEVATION' : frame.roles.projection === 'ORTHOGRAPHIC_SECTION' ? 'SECTION' : frame.roles.projection === 'PERSPECTIVE' ? 'PERSPECTIVE' : 'PAGE')

export function reconstructV2(options: ReconstructionV2Options): ReconstructionV2Result {
  const { graph, metrics } = options
  const keep = options.frameFilter
  const ctx: Ctx = { sightings: [], measurements: [], hypotheses: [], alternatives: [], solved: [], relations: [], ledger: [], steps: [], unresolved: [], traces: [], consumed: new Map() }
  const step = (s: Omit<SolverStep, 'index'>): void => {
    ctx.steps.push({ ...s, index: ctx.steps.length })
  }
  const gap = (u: Omit<UnresolvedCandidate, 'id'>): void => {
    ctx.unresolved.push({ ...u, id: stableId('gap', u.what.slice(0, 40).replace(/[^a-z0-9]+/gi, '-'), { what: u.what, status: u.status }) })
  }
  const frameById = new Map(graph.coordinateFrames.map((f) => [f.id, f]))
  const record = (r: EvidenceConsumptionRecord): void => {
    const held = ctx.consumed.get(r.evidenceId)
    // A stronger disposition replaces a weaker one; nothing is recorded twice.
    const rank: Record<EvidenceConsumptionRecord['disposition'], number> = { USED_IN_MODEL: 5, USED_AS_CORROBORATION: 4, CONFLICTED: 3, UNRESOLVED: 2, REJECTED_WITH_REASON: 1, IGNORED_WITH_REASON: 0 }
    if (held && rank[held.disposition] >= rank[r.disposition]) return
    ctx.consumed.set(r.evidenceId, r)
  }
  const sighting = (frame: SourceCoordinateFrame, what: string, confidence: number, observationIds: string[] = [], pixelRect?: SourceSighting['pixelRect']): string => {
    const id = stableId('sight', `${what.slice(0, 24)}-${frame.id.slice(-8)}`, { frame: frame.id, what, pixelRect: pixelRect ?? null })
    if (!ctx.sightings.some((s) => s.id === id)) ctx.sightings.push({ id, frameId: frame.id, assetId: frame.assetId, viewFamily: viewFamilyOf(frame), observationIds, ...(pixelRect ? { pixelRect } : {}), what, confidence: round6(confidence) })
    return id
  }
  const feature = (family: FeatureFamily, key: string, params: Record<string, { value: number; low: number; high: number; unit?: 'm' | 'deg' | 'count' | 'none' }>, sightingIds: string[], provenance: ProvenanceStatus, why: string, extra: { storeyIndex?: number; hostId?: string; unresolvedProperties?: string[]; printed?: boolean; uncertaintyM?: number; parameterProvenance?: Record<string, ProvenanceStatus>; confidence?: number } = {}): string => {
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
  const relate = (kind: FeatureGraphDraft['relations'][number]['kind'], fromId: string, toId: string, why: string, confidence = 0.8): void => {
    ctx.relations.push({ id: stableId('rel', `${kind}-${fromId.slice(-10)}-${toId.slice(-10)}`, { kind, fromId, toId }), kind, fromId, toId, confidence, why })
  }

  // ---------------------------------------------------------------------------
  // A/B/C. composition (03R), world frame, registrations
  // ---------------------------------------------------------------------------
  const sectionFrame = graph.coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION' && (keep ? keep(f) : true))
  const levels = levelsFrom(metrics, sectionFrame?.id)
  const { draft, layout } = composeStructuralLayout({ slug: options.slug, sourcePackageId: options.sourcePackageId, sourcePackageHash: options.sourcePackageHash, graph, metrics, raster: options.raster, frameFilter: keep, levels, publishedAreas: options.publishedAreas })
  const world = worldFrameFrom(draft)
  if (!world || layout.masses.length === 0) throw new Error('no walled body could be decomposed from the plans; the v2 analyzer has nothing to register against')
  step({ stage: 'massing', what: 'the bodies the plans enclose, in the v2 frame', method: 'DISCRETE_SELECTION', detail: `${layout.masses.length} bodies; front outer plane at z = 0 (${world.why})`, inputs: draft.plans.length, outputs: layout.masses.length })
  for (const hole of layout.unresolved) gap({ what: hole.what, reason: hole.reason, status: hole.status === 'REFUSED' ? 'REFUSED' : hole.status, observationIds: [], evidenceIds: [] })

  const T = draft.base?.decomposition.wallThickness.m && draft.base.decomposition.wallThickness.m >= 0.15 && draft.base.decomposition.wallThickness.m <= 0.7 ? round6(draft.base.decomposition.wallThickness.m) : CONVENTIONS.wallThickness
  const slabT = levels.measured && levels.floors.length > 1 ? round6(Math.min(0.4, Math.max(0.2, levels.floors[1] - levels.floors[0] - 2.72))) : CONVENTIONS.slabThickness

  // Masses in the v2 frame.
  const masses: MassV2[] = layout.masses.map((m) => {
    const b = ringBounds(m.ring)
    const z0 = flipZ(world, b.z1)
    const z1 = flipZ(world, b.z0)
    const id = m.role === 'MAIN' ? 'main' : `attached-${layout.masses.filter((x) => x.role !== 'MAIN').indexOf(m)}`
    const storeys: number[] = []
    for (let s = m.storeySpan.fromIndex; s <= m.storeySpan.toIndex; s += 1) storeys.push(s)
    const featureId = feature('MASS', id, { width: { value: b.x1 - b.x0, low: m.widthM.low, high: m.widthM.high }, depth: { value: z1 - z0, low: m.depthM.low, high: m.depthM.high } }, [], m.widthM.basis === 'MEASURED' ? 'SOURCE_EXACT' : 'SOURCE_DERIVED', m.why, { printed: m.widthM.basis === 'MEASURED', uncertaintyM: 0.02 })
    for (const e of m.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'a chain segment of the body', authority: 'HIGH', featureId, disposition: 'USED_IN_MODEL', reason: 'the body’s span', stage: 'TOPOLOGY' })
    return { id, role: m.role === 'MAIN' ? 'MAIN' : 'ATTACHED', x0: round6(b.x0), z0: round6(z0), x1: round6(b.x1), z1: round6(z1), storeys, featureId, sourceMassId: m.id }
  })
  const main = masses.find((m) => m.role === 'MAIN') ?? masses[0]
  const topStorey = Math.max(...main.storeys)

  // Levels.
  const ridgeY = levels.topDatum
  const levelsV2: BuildingV2['levels'] = []
  main.storeys.forEach((index, i) => {
    const elevation = levels.floors[i] ?? round6((levels.floors[levels.floors.length - 1] ?? 0) + CONVENTIONS.storeyHeight * (i - levels.floors.length + 1))
    const stated = levels.heights[i] ?? CONVENTIONS.storeyHeight
    const pitched = layout.roofSupports.some((r) => r.massId === main.sourceMassId && r.kind !== 'FLAT' && r.kind !== 'UNKNOWN')
    const height = index === topStorey && pitched && ridgeY !== undefined && ridgeY > elevation + stated ? round6(ridgeY - elevation) : round6(stated)
    const featureId = feature('LEVEL', `level-${index}`, { elevation: { value: elevation, low: elevation - 0.02, high: elevation + 0.02 }, height: { value: stated, low: stated - 0.05, high: stated + 0.05 } }, sectionFrame ? [sighting(sectionFrame, `level datum of storey ${index}`, 0.9, [])] : [], levels.measured ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING', levels.measured ? 'a printed level datum on the section' : 'a conventional storey height', { printed: levels.measured, unresolvedProperties: levels.measured ? [] : ['elevation', 'height'] })
    levelsV2.push({ index, id: `lvl-${i}`, elevation, height, wallTop: round6(elevation + stated), featureId })
  })
  for (const e of levels.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'a level datum', authority: 'HIGH', featureId: levelsV2[0]?.featureId, disposition: 'USED_IN_MODEL', reason: 'the storey levels and the ridge', stage: 'METRIC_SOLVE' })
  const levelOf = (index: number) => levelsV2.find((l) => l.index === index)

  // Plan frames per storey.
  const planFrames: PlanFrameV2[] = []
  const planByStorey = new Map<number, { plan: PlanReading; frame: PlanFrameV2; raster: Raster }>()
  const storeyIndexOf = (plan: PlanReading): number => ({ BASEMENT: -1, GROUND: 0, UPPER: 1, ATTIC: 1, ROOF: 2 })[plan.storey] ?? 0
  for (const plan of draft.plans) {
    const raster = options.raster(plan.frame)
    if (!raster) continue
    const index = storeyIndexOf(plan)
    const isBase = draft.base?.frame.id === plan.frame.id
    let frame = isBase ? planFrameV2(plan, index, world, draft) : undefined
    let why = 'chain-registered base plan'
    if (!frame) {
      // The body this storey covers: the mass reaching it with the largest area.
      const covers = masses.filter((m) => m.storeys.includes(index)).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0] ?? main
      frame = planFrameByOuterFaces(plan, index, world, { x0: covers.x0, z0: covers.z0, x1: covers.x1, z1: covers.z1 }, raster)
      why = frame ? frame.why : 'no outer faces found'
      if (!frame) frame = planFrameV2(plan, index, world, draft)
    }
    if (!frame) {
      gap({ what: `a registration for the storey ${index} plan`, reason: 'neither its chains, its outer faces nor an alignment onto the base plan fixed a scale for it', status: 'MISSING', observationIds: [], evidenceIds: [] })
      continue
    }
    planFrames.push(frame)
    planByStorey.set(index, { plan, frame, raster })
    step({ stage: 'registration', what: `storey ${index} plan registered`, method: 'DIRECT', detail: `${frame.mppX} m/px; ${why}`, inputs: 1, outputs: 1 })
  }

  // Elevation registrations (v2): silhouettes from the 03R extents, scales from the plan width and the ridge datum.
  const terrain = metrics.evidence.filter((e) => e.kind === 'LEVEL_DATUM' && e.value < 0 && e.value > -1.5).sort((a, b) => b.confidence - a.confidence)[0]?.value
  const { registrations: legacy } = registerElevationFrames(graph, { width: main.x1 - main.x0 + masses.filter((m) => m.id !== main.id).reduce((a, m) => a + Math.max(0, m.x1 - main.x1) + Math.max(0, main.x0 - m.x0), 0), depth: world.walled.z1 - world.walled.z0, totalHeight: ridgeY ?? levelsV2[levelsV2.length - 1].wallTop }, keep, options.raster)
  const elevations: ElevationRegistrationV2[] = []
  const views: Array<{ view: ElevationFrameV2; raster: Raster }> = []
  const sideEaves = layout.roofSupports.find((r) => r.massId === main.sourceMassId)?.overhangM?.value ?? 0
  for (const r of legacy) {
    if (!r.side) continue
    const frame = frameById.get(r.frameId)
    const raster = frame ? options.raster(frame) : undefined
    if (!frame || !raster || ridgeY === undefined) continue
    const reg = registerElevationV2({ id: r.frameId, assetId: r.assetId }, r.extent, r.side, r.sideConfidence, r.sideWhy, world, ridgeY, sideEaves, terrain)
    if (!reg) {
      gap({ what: `a v2 registration for the ${r.side.toLowerCase()} elevation`, reason: 'its silhouette fits neither the walled nor the characteristic span with the ridge at its apex', status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
      continue
    }
    elevations.push(reg)
    views.push({ view: elevationFrameFromV2(reg, world), raster })
    for (const o of graph.observations.filter((x) => x.frameId === r.frameId && (x.kind === 'SILHOUETTE' || x.kind === 'MASS_REGION'))) record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: `${o.kind} on the ${r.side.toLowerCase()} render`, authority: 'MEDIUM', disposition: 'USED_AS_CORROBORATION', reason: 'the silhouette the render was registered by; every feature read on the render rests on it', stage: 'REGISTRATION' })
  }
  step({ stage: 'registration', what: 'renders registered on the ridge datum', method: 'DIRECT', detail: elevations.map((e) => `${e.side}: ${e.mpp} m/px, ground at ${e.bottomY} (${e.spanWhy})`).join('; ') || 'none', inputs: legacy.length, outputs: elevations.length })
  const viewsOf = (facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'): Array<{ view: ElevationFrameV2; raster: Raster }> => views.filter((v) => v.view.side === (facade === 'WEST' ? 'LEFT' : facade === 'EAST' ? 'RIGHT' : facade))

  // ---------------------------------------------------------------------------
  // G1. the main roof and whether it covers the zones
  // ---------------------------------------------------------------------------
  const support = layout.roofSupports.find((r) => r.massId === main.sourceMassId)
  let mainRoof: BuildingV2['mainRoof']
  if (support && support.kind !== 'FLAT' && support.kind !== 'UNKNOWN' && support.pitchDeg && ridgeY !== undefined) {
    const pitch = support.pitchDeg.value
    const ridgeAxis = support.ridgeAxis ?? 'Z'
    const ridgeAt = ridgeAxis === 'Z' ? round6((main.x0 + main.x1) / 2) : round6((main.z0 + main.z1) / 2)
    const halfSpan = ridgeAxis === 'Z' ? (main.x1 - main.x0) / 2 : (main.z1 - main.z0) / 2
    const derivedEave = round6(ridgeY - halfSpan * Math.tan((pitch * Math.PI) / 180))
    const eaveY = derivedEave
    const sideViews = views.filter((v) => (ridgeAxis === 'Z' ? v.view.side === 'LEFT' || v.view.side === 'RIGHT' : v.view.side === 'FRONT' || v.view.side === 'REAR'))
    const zoneVotes = sideViews.map((v) => elevations.find((e) => e.frameId === v.view.registration.frameId)?.spanM ?? 0)
    const walledSpan = ridgeAxis === 'Z' ? world.walled.z1 - world.walled.z0 : world.walled.x1 - world.walled.x0
    const coversZones = zoneVotes.length > 0 && zoneVotes.every((s) => s > walledSpan + 0.2)
    const footprint = ridgeAxis === 'Z' ? { x0: main.x0, x1: main.x1, z0: coversZones ? world.envelope.z0 : main.z0, z1: coversZones ? world.envelope.z1 : main.z1 } : { x0: coversZones ? world.envelope.x0 : main.x0, x1: coversZones ? world.envelope.x1 : main.x1, z0: main.z0, z1: main.z1 }
    const sids = sideViews.map((v) => sighting(frameById.get(v.view.registration.frameId) as SourceCoordinateFrame, 'roof silhouette spanning the zones', 0.8))
    if (sectionFrame) sids.push(sighting(sectionFrame, 'roof pitch and ridge', 0.9))
    const featureId = feature('ROOF', 'roof-main', { pitchDeg: { value: pitch, low: pitch - 0.5, high: pitch + 0.5, unit: 'deg' }, ridgeY: { value: ridgeY, low: ridgeY - 0.02, high: ridgeY + 0.02 }, eaveY: { value: eaveY, low: eaveY - 0.05, high: eaveY + 0.05 }, extent: { value: footprint.z1 - footprint.z0, low: footprint.z1 - footprint.z0 - 0.1, high: footprint.z1 - footprint.z0 + 0.1 } }, sids, support.authority === 'PUBLISHED_SPECIFICATION' || support.authority === 'PRINTED_ANGLE' ? 'SOURCE_EXACT' : 'SOURCE_DERIVED', support.why, { printed: true, uncertaintyM: 0.05, parameterProvenance: { extent: coversZones ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', eaveY: 'SOURCE_DERIVED' } })
    mainRoof = { massId: main.id, kind: 'GABLE', pitchDeg: pitch, ridgeAxis, ridgeAt, eaveY, ridgeY, footprint, coversZones, coversZonesWhy: coversZones ? `both side renders span the characteristic depth at the ridge scale, so the roof reaches the outer planes` : 'the side renders span the walled depth only', buildUpVerticalM: round6(Math.max(0.15, eaveY - (levelOf(topStorey)?.wallTop ?? eaveY))), thicknessM: CONVENTIONS.roofThickness, authority: support.authority, featureId, provenance: support.authority === 'PUBLISHED_SPECIFICATION' || support.authority === 'PRINTED_ANGLE' ? 'SOURCE_EXACT' : 'SOURCE_DERIVED' }
    for (const e of support.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'the roof pitch statement', authority: 'HIGH', featureId, disposition: 'USED_IN_MODEL', reason: 'the main roof pitch', stage: 'METRIC_SOLVE' })
    step({ stage: 'roof', what: 'the main roof', method: 'DISCRETE_SELECTION', detail: `${pitch}° ${support.kind.toLowerCase()} ridge along ${ridgeAxis}, eave ${eaveY}, ${mainRoof.coversZonesWhy}`, inputs: sideViews.length, outputs: 1 })
  } else {
    gap({ what: 'the main roof', reason: 'no pitched roof with a stated pitch and a ridge datum was inferred over the main body', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }

  // ---------------------------------------------------------------------------
  // G2. recesses and returns from the zones, per storey
  // ---------------------------------------------------------------------------
  const zoneRegions = layout.footprintRegions.filter((r) => r.kind === 'ZONE')
  const recesses: RecessTopology[] = []
  const returns: ReturnWallV2[] = []
  const sideOfZone = (id: string): ZoneSide | undefined => (id.endsWith('min_z') ? 'REAR' : id.endsWith('max_z') ? 'FRONT' : id.endsWith('min_x') ? 'WEST' : id.endsWith('max_x') ? 'EAST' : undefined)
  for (const zone of zoneRegions) {
    const side = sideOfZone(zone.id)
    if (!side) continue
    const zb = ringBounds(zone.ring)
    const zoneV2 = { x0: zb.x0, x1: zb.x1, z0: flipZ(world, zb.z1), z1: flipZ(world, zb.z0) }
    // Masses whose face lies on the zone's back plane.
    const backAt = side === 'FRONT' ? zoneV2.z1 : side === 'REAR' ? zoneV2.z0 : side === 'WEST' ? zoneV2.x1 : zoneV2.x0
    const mouthAt = side === 'FRONT' ? zoneV2.z0 : side === 'REAR' ? zoneV2.z1 : side === 'WEST' ? zoneV2.x0 : zoneV2.x1
    const onFace = masses.filter((m) => (side === 'FRONT' ? Math.abs(m.z0 - backAt) : side === 'REAR' ? Math.abs(m.z1 - backAt) : side === 'WEST' ? Math.abs(m.x0 - backAt) : Math.abs(m.x1 - backAt)) < 0.15)
    if (onFace.length === 0) continue
    for (const [index, entry] of planByStorey) {
      const reaching = onFace.filter((m) => m.storeys.includes(index))
      if (reaching.length === 0) continue
      const from = Math.min(...reaching.map((m) => (side === 'FRONT' || side === 'REAR' ? m.x0 : m.z0)))
      const to = Math.max(...reaching.map((m) => (side === 'FRONT' || side === 'REAR' ? m.x1 : m.z1)))
      const topology = scanZoneForReturns(entry.raster, entry.frame, world, { side, from, to, backAt, mouthAt }, index)
      recesses.push(topology)
      const sid = sighting(entry.plan.frame, `${side.toLowerCase()} zone on the storey ${index} plan`, topology.confidence, [], undefined)
      const recessFeature = feature('RECESS', `recess-${side.toLowerCase()}-${index}`, { depth: { value: topology.depthM, low: topology.depthM - 0.05, high: topology.depthM + 0.05 }, mouthAt: { value: mouthAt, low: mouthAt - 0.05, high: mouthAt + 0.05 } }, [sid], topology.returns.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', topology.why, { storeyIndex: index, printed: true, uncertaintyM: 0.04, hostId: reaching[0].featureId })
      relate('HOSTED_BY', recessFeature, reaching[0].featureId, 'the recess opens through this body’s face')
      for (const e of zone.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'the zone’s printed depth', authority: 'HIGH', featureId: recessFeature, disposition: 'USED_IN_MODEL', reason: 'the recess depth', stage: 'TOPOLOGY' })
      topology.returns.forEach((r, i) => {
        const id = `return-${side.toLowerCase()}-${index}-${i}`
        // A return's outer face stands in the plane at the zone's outer end; it runs from the mouth to the wall face.
        const along = side === 'FRONT' || side === 'REAR' ? 'X' : 'Z'
        const outerAtLow = r.from <= from + 0.05
        const faceAt = outerAtLow ? r.from : r.to
        let start: { x: number; z: number }
        let end: { x: number; z: number }
        if (side === 'FRONT') {
          start = outerAtLow ? { x: faceAt, z: backAt } : { x: faceAt, z: mouthAt }
          end = outerAtLow ? { x: faceAt, z: mouthAt } : { x: faceAt, z: backAt }
        } else if (side === 'REAR') {
          start = outerAtLow ? { x: faceAt, z: mouthAt } : { x: faceAt, z: backAt }
          end = outerAtLow ? { x: faceAt, z: backAt } : { x: faceAt, z: mouthAt }
        } else if (side === 'WEST') {
          start = outerAtLow ? { x: mouthAt, z: faceAt } : { x: backAt, z: faceAt }
          end = outerAtLow ? { x: backAt, z: faceAt } : { x: mouthAt, z: faceAt }
        } else {
          start = outerAtLow ? { x: backAt, z: faceAt } : { x: mouthAt, z: faceAt }
          end = outerAtLow ? { x: mouthAt, z: faceAt } : { x: backAt, z: faceAt }
        }
        // A return in the middle of the zone (not at an outer end) has its material on the side away from the recess it closes; taken as the low side.
        void along
        const rsid = sighting(entry.plan.frame, `return wall ink in the ${side.toLowerCase()} zone`, r.support / r.scanLines, [], r.pixelRect)
        const returnFeature = feature('RETURN_WALL', id, { from: { value: r.from, low: r.from - 0.04, high: r.from + 0.04 }, to: { value: r.to, low: r.to - 0.04, high: r.to + 0.04 }, thickness: { value: r.thicknessM, low: r.thicknessM - 0.05, high: r.thicknessM + 0.05 } }, [rsid], 'SOURCE_DERIVED', `wall-thick ink on ${r.support} of ${r.scanLines} scan lines across the zone`, { storeyIndex: index, hostId: recessFeature, uncertaintyM: 0.04 })
        relate('PART_OF', returnFeature, recessFeature, 'a return of the recess')
        returns.push({ id, side, storeyIndex: index, start: { x: round6(start.x), z: round6(start.z) }, end: { x: round6(end.x), z: round6(end.z) }, thicknessM: r.thicknessM, recessId: topology.id, featureId: returnFeature, provenance: 'SOURCE_DERIVED', why: `a ${r.thicknessM.toFixed(2)} m return standing in the ${topology.depthM.toFixed(2)} m ${side.toLowerCase()} zone on the storey ${index} plan` })
      })
    }
  }
  step({ stage: 'recesses', what: 'recess topology from the zones', method: 'DISCRETE_SELECTION', detail: recesses.map((r) => `${r.side} storey ${r.storeyIndex}: ${r.returns.length} returns, open ${r.open.map((o) => `${o.from.toFixed(2)}..${o.to.toFixed(2)}`).join('/')}`).join('; ') || 'no zones', inputs: zoneRegions.length, outputs: recesses.length })

  // ---------------------------------------------------------------------------
  // G3. the stair: ladders on every plan, pooled
  // ---------------------------------------------------------------------------
  const rise = levelsV2.length > 1 ? round6(levelsV2[1].elevation - levelsV2[0].elevation) : 0
  const ladderPool: Array<{ ladder: ReturnType<typeof findTreadLadders>[number]; storeyIndex: number }> = []
  for (const [index, entry] of planByStorey) {
    const body = { x0: main.x0, z0: main.z0, x1: main.x1, z1: main.z1 }
    for (const ladder of findTreadLadders(entry.raster, entry.frame, body)) ladderPool.push({ ladder, storeyIndex: index })
  }
  const pooled = poolLadders(ladderPool)
  let stair: BuildingV2['stair']
  const stairPlan = planByStorey.get(topStorey) ?? planByStorey.get(0)
  if (pooled.length > 0 && stairPlan && levelsV2.length > 1) {
    const hypothesis = assembleStair(stairPlan.raster, stairPlan.frame, pooled.map((p) => p.ladder), 0, rise)
    if (hypothesis) {
      const sids = [...new Set(pooled.flatMap((p) => p.storeyIndices))].map((s) => planByStorey.get(s)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => sighting(e.plan.frame, 'tread ladders of the stair', 0.8))
      const sectionStair = graph.observations.filter((o) => o.kind === 'STAIR' && frameById.get(o.frameId)?.roles.projection === 'ORTHOGRAPHIC_SECTION')
      if (sectionFrame && sectionStair.length > 0) {
        sids.push(sighting(sectionFrame, 'step profile of the stair', 0.7, sectionStair.map((o) => o.id)))
        for (const o of sectionStair) record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: 'the section’s step profile', authority: 'MEDIUM', disposition: 'USED_AS_CORROBORATION', reason: 'corroborates the riser count of the lowest flight', stage: 'IDENTITY' })
      }
      const exact = hypothesis.unresolved.length === 0 && hypothesis.directionEvidence === 'ARROW'
      const featureId = feature('STAIR', 'stair-main', { risers: { value: hypothesis.risersTotal, low: hypothesis.riserCountInterval.low, high: hypothesis.riserCountInterval.high, unit: 'count' }, width: { value: hypothesis.widthM, low: hypothesis.widthM - 0.05, high: hypothesis.widthM + 0.05 } }, sids, exact ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', hypothesis.why, { storeyIndex: 0, uncertaintyM: 0.04, unresolvedProperties: hypothesis.unresolved })
      // The hole in the upper slab: the flights and landings that end within a head-height of the upper floor, plus the well between them.
      const top = levelsV2[1].elevation
      let cumulative = 0
      const riserM = rise / Math.max(1, hypothesis.risersTotal)
      const parts: Array<{ x0: number; z0: number; x1: number; z1: number }> = []
      hypothesis.flights.forEach((f, i) => {
        const endRise = (cumulative + f.risers) * riserM
        const rect = f.direction === 'PLUS_X' || f.direction === 'MINUS_X' ? { x0: Math.min(f.from, f.to), x1: Math.max(f.from, f.to), z0: f.band.from, z1: f.band.to } : { x0: f.band.from, x1: f.band.to, z0: Math.min(f.from, f.to), z1: Math.max(f.from, f.to) }
        if (top - endRise < 2.0) parts.push(rect)
        const landing = hypothesis.landings[i]
        if (landing && top - endRise < 2.0) parts.push(landing)
        cumulative += f.risers
      })
      const inner = { x0: Math.min(...hypothesis.flights.map((f) => f.band.from), ...hypothesis.landings.map((l) => l.x0)), x1: Math.max(...hypothesis.landings.map((l) => l.x1), ...hypothesis.flights.map((f) => f.band.to)) }
      void inner
      const holeParts = parts.length > 0 ? parts : [hypothesis.shaft]
      const slabHole = { x0: round6(Math.min(...holeParts.map((p) => p.x0))), z0: round6(Math.min(...holeParts.map((p) => p.z0))), x1: round6(Math.max(...holeParts.map((p) => p.x1))), z1: round6(Math.max(...holeParts.map((p) => p.z1))) }
      stair = { hypothesis, emit: exact ? 'FLIGHTS' : 'PLACEHOLDER', fromLevel: 0, toLevel: 1, slabHole, featureId, provenance: exact ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED' }
      step({ stage: 'stair', what: 'the stair, from its tread ladders', method: exact ? 'DISCRETE_SELECTION' : 'REFUSED', detail: hypothesis.why, inputs: pooled.length, outputs: 1 })
      if (!exact) gap({ what: 'the exact steps of the stair', reason: `the ladders give the topology but ${hypothesis.unresolved.join('; ')}; a placeholder is built over the shaft`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    }
  } else if (levelsV2.length > 1) {
    step({ stage: 'stair', what: 'a stair between the storeys', method: 'REFUSED', detail: 'no tread ladder was found on any plan', inputs: 0, outputs: 0 })
    gap({ what: 'the stair between the storeys', reason: 'no run of evenly spaced tread lines was found on any plan', status: 'MISSING', observationIds: [], evidenceIds: [] })
  }

  // ---------------------------------------------------------------------------
  // G4. interior per storey (with the stair as a barrier where it is not floor)
  // ---------------------------------------------------------------------------
  const interior: InteriorReading[] = []
  const publishedRooms = options.publishedRooms ?? []
  for (const [index, entry] of planByStorey) {
    const tokens: LabelToken[] = metrics.ocrTokens.filter((t) => t.frameId === entry.plan.frame.id).map((t) => ({ text: t.text, box: t.box, heightPx: t.heightPx, confidence: t.confidence }))
    const storeyLabel = index === 0 ? 'GROUND' : index < 0 ? 'BASEMENT' : 'ATTIC'
    const rooms = publishedRooms.filter((r) => r.storey === storeyLabel || (index > 0 && r.storey === 'UPPER')).map((r) => ({ number: String(r.index), label: r.label, areaM2: r.area }))
    const barriers: Array<{ x0: number; z0: number; x1: number; z1: number }> = []
    if (stair) {
      const riserM = rise / Math.max(1, stair.hypothesis.risersTotal)
      let cumulative = 0
      stair.hypothesis.flights.forEach((f, i) => {
        const startRise = cumulative * riserM
        const endRise = (cumulative + f.risers) * riserM
        const rect = f.direction === 'PLUS_X' || f.direction === 'MINUS_X' ? { x0: Math.min(f.from, f.to), x1: Math.max(f.from, f.to), z0: f.band.from, z1: f.band.to } : { x0: f.band.from, x1: f.band.to, z0: Math.min(f.from, f.to), z1: Math.max(f.from, f.to) }
        const landing = stair.hypothesis.landings[i]
        if (index === 0 && startRise < 2.0) {
          barriers.push(rect)
          if (landing && endRise < 2.0) barriers.push(landing)
        }
        if (index > 0) {
          barriers.push(stair.slabHole)
        }
        cumulative += f.risers
      })
    }
    for (const m of masses.filter((x) => x.storeys.includes(index))) {
      const reading = readInterior(entry.raster, entry.frame, { x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1 }, T, index, tokens, rooms, { extraBarriers: barriers })
      reading.walls = reading.walls.map((w) => ({ ...w, id: `${m.id}-${w.id}` }))
      reading.doors = reading.doors.map((d) => ({ ...d, id: `${m.id}-${d.id}`, betweenIds: [d.betweenIds[0].includes(':') ? d.betweenIds[0] : `${m.id}-${d.betweenIds[0]}`, d.betweenIds[1].includes(':') ? d.betweenIds[1] : `${m.id}-${d.betweenIds[1]}`] as [string, string] }))
      reading.rooms = reading.rooms.map((r) => ({ ...r, id: `${m.id}-${r.id}`, doorIds: r.doorIds.map((d) => `${m.id}-${d}`) }))
      reading.blocks = reading.blocks.map((b) => ({ ...b, id: `${m.id}-${b.id}` }))
      interior.push(reading)
      const sid = sighting(entry.plan.frame, `interior ink of ${m.id} on storey ${index}`, 0.7)
      for (const w of reading.walls) feature('INTERIOR_WALL', w.id, { at: { value: w.at, low: w.at - 0.04, high: w.at + 0.04 }, from: { value: w.from, low: w.from - 0.05, high: w.from + 0.05 }, to: { value: w.to, low: w.to - 0.05, high: w.to + 0.05 }, thickness: { value: w.thicknessM, low: w.thicknessM - 0.03, high: w.thicknessM + 0.03 } }, [sid], 'SOURCE_DERIVED', w.why, { storeyIndex: index, hostId: m.featureId, uncertaintyM: 0.05, confidence: w.confidence })
      for (const d of reading.doors) feature('INTERIOR_DOOR', d.id, { from: { value: d.from, low: d.from - 0.05, high: d.from + 0.05 }, width: { value: d.widthM, low: d.widthM - 0.08, high: d.widthM + 0.08 } }, [sid], 'SOURCE_DERIVED', d.why, { storeyIndex: index, uncertaintyM: 0.06, unresolvedProperties: ['height'], parameterProvenance: { height: 'ASSUMED_FOR_RENDERING' }, confidence: d.confidence })
      for (const r of reading.rooms) feature('ROOM', r.id, { area: { value: r.areaM2, low: r.areaM2 * 0.9, high: r.areaM2 * 1.1 } }, [sid], r.number && r.publishedAreaM2 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', r.why, { storeyIndex: index, hostId: m.featureId, printed: !!r.publishedAreaM2, uncertaintyM: 0.06, unresolvedProperties: r.openPlan ? ['subdivision (open plan)'] : [], confidence: r.confidence })
      for (const u of reading.unresolved) gap({ what: u.what, reason: u.reason, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
    }
  }
  step({ stage: 'interior', what: 'partitions, doors and rooms', method: 'DISCRETE_SELECTION', detail: interior.map((i) => `storey ${i.storeyIndex}: ${i.walls.length} walls, ${i.doors.length} doors, ${i.rooms.length} rooms, ${i.blocks.length} blocks`).join('; '), inputs: planByStorey.size, outputs: interior.reduce((a, i) => a + i.rooms.length, 0) })

  // ---------------------------------------------------------------------------
  // G5/H. openings on every exterior wall, cross-view
  // ---------------------------------------------------------------------------
  const openings: OpeningV2[] = []
  const sharedDoors: BuildingV2['sharedDoors'] = []
  const isGableEnd = (m: MassV2, facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'): boolean => !!mainRoof && m.id === main.id && ((mainRoof.ridgeAxis === 'Z' && (facade === 'FRONT' || facade === 'REAR')) || (mainRoof.ridgeAxis === 'X' && (facade === 'WEST' || facade === 'EAST')))
  let hostIndex = 0
  for (const m of masses) {
    for (const index of m.storeys) {
      const entry = planByStorey.get(index)
      const l = levelOf(index)
      if (!entry || !l) continue
      const callouts = metrics.evidence.filter((e) => e.kind === 'OPENING_CALLOUT' && e.frameId === entry.plan.frame.id)
      for (const facade of ['FRONT', 'EAST', 'REAR', 'WEST'] as const) {
        const planeAt = facade === 'FRONT' ? m.z0 : facade === 'REAR' ? m.z1 : facade === 'WEST' ? m.x0 : m.x1
        const inward = facade === 'FRONT' || facade === 'WEST' ? 1 : -1
        const from = facade === 'FRONT' || facade === 'REAR' ? m.x0 : m.z0
        const to = facade === 'FRONT' || facade === 'REAR' ? m.x1 : m.z1
        const gable = isGableEnd(m, facade) && index === topStorey && mainRoof ? { eaveY: mainRoof.eaveY, pitchDeg: mainRoof.pitchDeg, ridgeAlongAt: mainRoof.ridgeAt, eaveAtLow: from, eaveAtHigh: to, buildUpVerticalM: mainRoof.buildUpVerticalM } : undefined
        const host: WallHost = { massId: m.id, facade, planeAt, from, to, centreAt: round6(planeAt + (inward * T) / 2), storeyIndex: index, ...(gable ? { gable } : {}), floorY: l.elevation, storeyHeightM: gable ? round6(mainRoof!.ridgeY - l.elevation) : l.height }
        const found = readWallOpenings({ plan: entry.frame, planRaster: entry.raster, host, wallThicknessM: T, callouts, views: viewsOf(facade), attachedSingleStorey: m.role === 'ATTACHED' && m.storeys.length === 1, index: hostIndex++ })
        for (const o of found) {
          // A gap on a face another body stands against is a door between the two bodies, not a facade opening.
          const other = masses.find((x) => x.id !== m.id && x.storeys.includes(index) && (facade === 'EAST' ? Math.abs(x.x0 - m.x1) < 0.05 && o.interval[0] >= x.z0 - 0.05 && o.interval[1] <= x.z1 + 0.05 : facade === 'WEST' ? Math.abs(x.x1 - m.x0) < 0.05 && o.interval[0] >= x.z0 - 0.05 && o.interval[1] <= x.z1 + 0.05 : facade === 'FRONT' ? Math.abs(x.z1 - m.z0) < 0.05 && o.interval[0] >= x.x0 - 0.05 && o.interval[1] <= x.x1 + 0.05 : Math.abs(x.z0 - m.z1) < 0.05 && o.interval[0] >= x.x0 - 0.05 && o.interval[1] <= x.x1 + 0.05))
          if (other) {
            if (m.role === 'MAIN') sharedDoors.push({ ...o, id: `shared-${o.id}`, family: 'DOOR', headY: round6(o.sillY + CONVENTIONS.doorHeight), otherMassId: other.id, why: `${o.why}; this face is shared with ${other.id}, so the gap is a doorway between the two bodies` })
            continue
          }
          openings.push(o)
        }
      }
    }
  }
  for (const o of [...openings, ...sharedDoors]) {
    const entry = planByStorey.get(o.storeyIndex)
    const sids = entry ? [sighting(entry.plan.frame, `wall gap ${o.interval[0].toFixed(2)}..${o.interval[1].toFixed(2)} on the ${o.facade.toLowerCase()} wall`, 0.7, [], o.planGap.pixelRect)] : []
    if (o.elevation) {
      const f = frameById.get(o.elevation.frameId)
      if (f) sids.push(sighting(f, `opening extent on the ${o.facade.toLowerCase()} render`, o.elevation.confidence))
    }
    const printed = !!o.callout
    const mass = masses.find((m) => m.id === o.massId)
    feature('OPENING', o.id, { from: { value: o.interval[0], low: o.interval[0] - o.uncertaintyM, high: o.interval[0] + o.uncertaintyM }, width: { value: o.widthM, low: o.widthM - o.uncertaintyM, high: o.widthM + o.uncertaintyM }, sillY: { value: o.sillY, low: o.sillY - 0.1, high: o.sillY + 0.1 }, headY: { value: o.headY, low: o.headY - 0.1, high: o.headY + 0.1 } }, sids, o.provenance.head === 'SOURCE_CORROBORATED' ? 'SOURCE_CORROBORATED' : printed ? 'SOURCE_EXACT' : o.elevation ? 'IMAGE_METRIC_REGISTERED' : 'SOURCE_DERIVED', o.why, { storeyIndex: o.storeyIndex, hostId: mass?.featureId, printed, uncertaintyM: o.uncertaintyM, unresolvedProperties: o.unresolved, parameterProvenance: { sillY: o.provenance.sill, headY: o.provenance.head, width: o.provenance.width, profile: o.provenance.profile, family: o.provenance.family }, confidence: o.confidence })
    if (mass) relate('HOSTED_BY', `feat-${o.id}`, mass.featureId, `an opening in the ${o.facade.toLowerCase()} wall`)
    if (o.callout) record({ evidenceId: o.callout.evidenceId, evidenceKind: 'METRIC', what: `callout ${o.callout.widthCm}/${o.callout.heightCm}`, authority: 'HIGH', featureId: `feat-${o.id}`, disposition: 'USED_IN_MODEL', reason: 'the opening’s printed width and height', stage: 'METRIC_SOLVE' })
  }
  step({ stage: 'openings', what: 'openings cut from the plans, sized by callouts and elevations', method: 'DISCRETE_SELECTION', detail: `${openings.length} facade openings (${openings.filter((o) => o.callout).length} with a printed callout, ${openings.filter((o) => o.elevation).length} read on an elevation, ${openings.filter((o) => o.profile === 'RAKED_SINGLE').length} raked) and ${sharedDoors.length} doorway${sharedDoors.length === 1 ? '' : 's'} between bodies`, inputs: masses.length * 4, outputs: openings.length + sharedDoors.length })

  // ---------------------------------------------------------------------------
  // G6. roof details: attached roofs, chimneys, rooflights
  // ---------------------------------------------------------------------------
  const attachedRoofs: BuildingV2['attachedRoofs'] = []
  let sectionReg: ReturnType<typeof registerSection>
  if (sectionFrame) {
    const raster = options.raster(sectionFrame)
    const reg = metrics.coordinateRegistrations.find((r) => r.frameId === sectionFrame.id && r.plane === 'SECTION_HY')
    if (raster && reg) sectionReg = registerSection(raster, reg.metresPerPixelY, reg.originPx.y, [{ axis: 'X', from: world.envelope.x0, to: world.envelope.x1 }, { axis: 'Z', from: world.walled.z0, to: world.walled.z1 }], sectionFrame.id, ridgeY)
    if (sectionReg) step({ stage: 'registration', what: 'section registered by its wall columns', method: 'DIRECT', detail: `${sectionReg.mpp.toFixed(6)} m/px, a cross-section along ${sectionReg.axis}`, inputs: 1, outputs: 1 })
  }
  for (const m of masses.filter((x) => x.role === 'ATTACHED')) {
    const sup = layout.roofSupports.find((r) => r.massId === m.sourceMassId)
    if (sup && sup.kind !== 'FLAT' && sup.kind !== 'UNKNOWN') continue
    const l = levelOf(Math.max(...m.storeys))
    if (!l) continue
    let reading: ReturnType<typeof readAttachedRoof>
    if (sectionReg && sectionFrame) {
      const raster = options.raster(sectionFrame)
      const span = sectionReg.axis === 'X' ? { from: m.x0, to: m.x1 } : { from: m.z0, to: m.z1 }
      if (raster) reading = readAttachedRoof(raster, sectionReg, m.id, span, l.elevation, l.wallTop + 1.5)
    }
    // Does the roof project over the zone in front of the body? The top storey plan draws its outline into the zone.
    const zoneInFront = recesses.find((r) => r.side === 'FRONT' && r.storeyIndex === topStorey)
    let projects = false
    const topPlan = planByStorey.get(topStorey)
    if (zoneInFront && topPlan && !m.storeys.includes(topStorey)) {
      // A drawn line near the zone's mouth across the body's width on the top storey's plan.
      const y = topPlan.frame.toPixel(m.x0, zoneInFront.mouthAt + 0.08).y
      const x0 = topPlan.frame.toPixel(m.x0 + 0.3, 0).x
      const x1 = topPlan.frame.toPixel(m.x1 - 0.3, 0).x
      let dark = 0
      let n = 0
      for (let px = Math.min(x0, x1); px <= Math.max(x0, x1); px += 1) {
        n += 1
        for (let dy = -5; dy <= 5; dy += 1) {
          const o = (Math.round(y + dy) * topPlan.raster.width + Math.round(px)) * 4
          const lum = 0.299 * topPlan.raster.data[o] + 0.587 * topPlan.raster.data[o + 1] + 0.114 * topPlan.raster.data[o + 2]
          if (lum < 205) {
            dark += 1
            break
          }
        }
      }
      projects = n > 0 && dark / n > 0.6
    }
    const slabTopY = reading ? reading.slabTopY : l.wallTop
    const slabSoffitY = reading ? reading.slabSoffitY : round6(l.wallTop - CONVENTIONS.roofThickness)
    const footprint = { x0: m.x0, x1: m.x1, z0: projects && zoneInFront ? zoneInFront.mouthAt : m.z0, z1: m.z1 }
    const sids = sectionFrame && reading ? [sighting(sectionFrame, `flat roof slab over ${m.id}`, reading.confidence)] : []
    if (projects && topPlan) sids.push(sighting(topPlan.plan.frame, `roof outline of ${m.id} reaching the zone`, 0.7))
    const featureId = feature('ATTACHED_ROOF', `roof-${m.id}`, { slabTopY: { value: slabTopY, low: slabTopY - 0.05, high: slabTopY + 0.05 }, ...(reading?.parapetTopY !== undefined ? { parapetTopY: { value: reading.parapetTopY, low: reading.parapetTopY - 0.05, high: reading.parapetTopY + 0.05 } } : {}) }, sids, reading ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING', reading ? reading.why : 'no section draws this roof; its slab is taken at the storey top', { hostId: m.featureId, uncertaintyM: 0.04, unresolvedProperties: reading ? [] : ['slabTopY'], printed: !!reading })
    relate('SUPPORTS', m.featureId, featureId, 'the body carries its roof')
    attachedRoofs.push({ massId: m.id, reading, slabTopY, slabSoffitY, parapetTopY: reading?.parapetTopY, footprint, projectsOverZone: projects, featureId, provenance: reading ? 'SOURCE_EXACT' : 'ASSUMED_FOR_RENDERING' })
    if (reading) for (const e of levels.evidenceIds) record({ evidenceId: e, evidenceKind: 'METRIC', what: 'a level datum', authority: 'HIGH', disposition: 'USED_IN_MODEL', reason: 'the section scale the attached roof was read at', stage: 'METRIC_SOLVE' })
  }
  // Chimneys.
  const roofTopY = (x: number, z: number): number => {
    if (!mainRoof) return levelsV2[levelsV2.length - 1].wallTop
    const tan = Math.tan((mainRoof.pitchDeg * Math.PI) / 180)
    const across = mainRoof.ridgeAxis === 'Z' ? x : z
    const half = mainRoof.ridgeAxis === 'Z' ? (main.x1 - main.x0) / 2 : (main.z1 - main.z0) / 2
    return mainRoof.ridgeY - Math.min(half, Math.abs(across - mainRoof.ridgeAt)) * tan
  }
  const chimneyViews = views.filter((v) => (mainRoof?.ridgeAxis === 'Z' ? v.view.side === 'FRONT' || v.view.side === 'REAR' : v.view.side === 'LEFT' || v.view.side === 'RIGHT'))
  const chimneyReadings = readChimneys(interior.filter((i) => masses.find((m) => i.walls.some((w) => w.id.startsWith(m.id)) || true)).map((i) => ({ storeyIndex: i.storeyIndex, blocks: i.blocks })), chimneyViews, roofTopY).filter((c) => c.renderFrames.length > 0 || c.storeysSeen.length >= 2)
  const chimneys: BuildingV2['chimneys'] = chimneyReadings.map((c) => {
    const sids = c.storeysSeen.map((s) => planByStorey.get(s)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => sighting(e.plan.frame, 'solid block of a chimney', 0.7, [], undefined))
    for (const f of c.renderFrames) {
      const frame = frameById.get(f)
      if (frame) sids.push(sighting(frame, 'chimney above the roof line', 0.7))
    }
    const featureId = feature('CHIMNEY', c.id, { x0: { value: c.x0, low: c.x0 - 0.06, high: c.x0 + 0.06 }, z0: { value: c.z0, low: c.z0 - 0.06, high: c.z0 + 0.06 }, ...(c.topY !== undefined ? { topY: { value: c.topY, low: c.topY - 0.1, high: c.topY + 0.1 } } : {}) }, sids, c.renderFrames.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', c.why, { uncertaintyM: 0.06, unresolvedProperties: c.topY === undefined ? ['topY'] : [], parameterProvenance: { topY: c.topY === undefined ? 'ASSUMED_FOR_RENDERING' : 'IMAGE_METRIC_REGISTERED' } })
    if (c.storeysSeen.length >= 2) relate('SAME_FEATURE_AS', sids[0], sids[1], 'the same block on both storeys’ plans')
    return { ...c, featureId, provenance: c.renderFrames.length > 0 ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED' }
  })
  // Rooflights on the side renders.
  const rooflights: BuildingV2['rooflights'] = []
  if (mainRoof) {
    for (const v of views) {
      const eaveSide = mainRoof.ridgeAxis === 'Z' ? (v.view.side === 'LEFT' ? 'LOW' : v.view.side === 'RIGHT' ? 'HIGH' : undefined) : v.view.side === 'FRONT' ? 'LOW' : v.view.side === 'REAR' ? 'HIGH' : undefined
      if (!eaveSide) continue
      const eaveAlong = mainRoof.ridgeAxis === 'Z' ? (eaveSide === 'LOW' ? main.x0 : main.x1) : eaveSide === 'LOW' ? main.z0 : main.z1
      const walledAlong = mainRoof.ridgeAxis === 'Z' ? { from: world.walled.z0, to: world.walled.z1 } : { from: world.walled.x0, to: world.walled.x1 }
      const found = readRooflights(v.view, v.raster, { eaveY: mainRoof.eaveY, ridgeY: mainRoof.ridgeY, pitchDeg: mainRoof.pitchDeg, eaveAlong, ridgeAlong: mainRoof.ridgeAt, slope: eaveSide }, walledAlong)
      for (const r of found) {
        // Not a chimney: no chimney block within 0.4 m along the ridge on this slope.
        const chimneyThere = chimneys.some((c) => {
          const along = mainRoof.ridgeAxis === 'Z' ? [c.z0, c.z1] : [c.x0, c.x1]
          const across = mainRoof.ridgeAxis === 'Z' ? (c.x0 + c.x1) / 2 : (c.z0 + c.z1) / 2
          const onThisSlope = eaveSide === 'LOW' ? across < mainRoof.ridgeAt : across > mainRoof.ridgeAt
          return onThisSlope && Math.min(along[1], r.alongTo) - Math.max(along[0], r.alongFrom) > -0.4
        })
        if (chimneyThere) continue
        const frame = frameById.get(r.frameId)
        const sid = frame ? [sighting(frame, 'a light patch in the roof plane', r.confidence)] : []
        const widthM = round6(r.alongTo - r.alongFrom)
        const lengthM = round6(Math.hypot(r.slopeTo - r.slopeFrom, r.yTo - r.yFrom))
        const featureId = feature('ROOFLIGHT', r.id, { along: { value: r.alongFrom, low: r.alongFrom - 0.1, high: r.alongFrom + 0.1 }, width: { value: widthM, low: widthM - 0.1, high: widthM + 0.1 }, length: { value: lengthM, low: lengthM - 0.15, high: lengthM + 0.15 } }, sid, 'IMAGE_METRIC_REGISTERED', r.why, { uncertaintyM: 0.1, unresolvedProperties: ['exact position up the slope'] })
        rooflights.push({ ...r, featureId, provenance: 'IMAGE_METRIC_REGISTERED', widthM, lengthM })
      }
    }
  }
  step({ stage: 'roof-details', what: 'attached roofs, chimneys, rooflights', method: 'DISCRETE_SELECTION', detail: `${attachedRoofs.length} attached roof${attachedRoofs.length === 1 ? '' : 's'} (${attachedRoofs.filter((r) => r.reading).length} from the section), ${chimneys.length} chimney${chimneys.length === 1 ? '' : 's'}, ${rooflights.length} rooflight${rooflights.length === 1 ? '' : 's'}`, inputs: views.length, outputs: attachedRoofs.length + chimneys.length + rooflights.length })

  // ---------------------------------------------------------------------------
  // I. secondary assemblies: verges, balconies with fascias, railings, portal heads, terraces
  // ---------------------------------------------------------------------------
  const verges: BuildingV2['verges'] = []
  const balconies: BuildingV2['balconies'] = []
  const railings: BuildingV2['railings'] = []
  const portalHeads: BuildingV2['portalHeads'] = []
  const assemblies: FacadeAssemblyHypothesis[] = []
  const members: FacadeMember[] = []
  if (mainRoof && mainRoof.ridgeAxis === 'Z') {
    for (const side of ['FRONT', 'REAR'] as const) {
      const recess = recesses.find((r) => r.side === side && r.storeyIndex === topStorey) ?? recesses.find((r) => r.side === side)
      for (const v of viewsOf(side)) {
        const member = readVergeMember(v.raster, v.view, { along0: main.x0, along1: main.x1, ridgeAlong: mainRoof.ridgeAt, eaveY: mainRoof.eaveY, ridgeY: mainRoof.ridgeY }, recess)
        if (!member) continue
        members.push(member)
        const frame = frameById.get(v.view.registration.frameId)
        const sids = frame ? [sighting(frame, 'verge band along the rake', member.confidence)] : []
        const featureId = feature('ROOF_MEMBER', member.id, { width: { value: member.widthM ?? 0.5, low: (member.widthM ?? 0.5) - 0.08, high: (member.widthM ?? 0.5) + 0.08 } }, sids, recess && recess.returns.length > 0 ? 'SOURCE_CORROBORATED' : 'IMAGE_METRIC_REGISTERED', member.why, { uncertaintyM: 0.06, unresolvedProperties: ['depth'], parameterProvenance: { depth: 'ASSUMED_FOR_RENDERING' } })
        verges.push({ id: member.id, side, planeAt: side === 'FRONT' ? world.envelope.z0 : world.envelope.z1, member, depthM: 0.3, featureId, provenance: recess && recess.returns.length > 0 ? 'SOURCE_CORROBORATED' : 'IMAGE_METRIC_REGISTERED' })
        // The assembly: returns + verge = the gable frame.
        const frameReturns = returns.filter((r) => r.side === side)
        if (frameReturns.length > 0) {
          const id = `assembly-gable-${side.toLowerCase()}`
          assemblies.push({ id, facadeId: side, kind: 'GABLE_FRAME', memberHypothesisIds: [featureId, ...frameReturns.map((r) => r.featureId)], planeOffsets: { [featureId]: 0, ...Object.fromEntries(frameReturns.map((r) => [r.featureId, 0])) }, evidenceIds: sids, continuityRelations: frameReturns.map((r) => ({ from: r.featureId, to: featureId, kind: 'CONTINUES_AS' as const })), confidence: round6(Math.min(member.confidence, 0.85)), why: `the returns of the ${side.toLowerCase()} recess continue as the verge band along the rakes in the same plane` })
          for (const r of frameReturns) relate('CONTINUES_AS', r.featureId, featureId, 'the return continues into the verge member')
          const fa = feature('FACADE_ASSEMBLY', id, {}, sids, 'SOURCE_CORROBORATED', assemblies[assemblies.length - 1].why, { unresolvedProperties: [] })
          for (const r of frameReturns) relate('PART_OF', r.featureId, fa, 'a member of the gable frame')
          relate('PART_OF', featureId, fa, 'a member of the gable frame')
        }
        break
      }
    }
  }
  // Balconies: an upper-storey recess with a slab across its open interval, read as a fascia at the floor level on the render.
  for (const recess of recesses.filter((r) => r.storeyIndex > 0)) {
    const l = levelOf(recess.storeyIndex)
    const lower = recesses.find((r) => r.side === recess.side && r.storeyIndex === recess.storeyIndex - 1)
    if (!l) continue
    for (const v of viewsOf(recess.side)) {
      for (const open of recess.open) {
        const fascia = readFasciaBand(v.raster, v.view, { along0: open.from, along1: open.to }, l.elevation, recess.mouthAt)
        if (!fascia) continue
        // Where along the mouth the fascia actually runs: the columns that carry the band.
        const extent = fasciaExtent(v.raster, v.view, open, fascia.y)
        if (!extent) continue
        members.push(fascia)
        const frame = frameById.get(v.view.registration.frameId)
        const sids = frame ? [sighting(frame, 'balcony fascia band', fascia.confidence)] : []
        const plan = planByStorey.get(recess.storeyIndex)
        if (plan) sids.push(sighting(plan.plan.frame, 'balcony floor in the zone', 0.6))
        const thickness = round6(fascia.y[1] - fascia.y[0])
        const topY = round6(Math.min(l.elevation + 0.05, fascia.y[1]))
        const id = `balcony-${recess.side.toLowerCase()}-${recess.storeyIndex}`
        const featureId = feature('BALCONY', id, { from: { value: extent.from, low: extent.from - 0.1, high: extent.from + 0.1 }, to: { value: extent.to, low: extent.to - 0.1, high: extent.to + 0.1 }, topY: { value: topY, low: topY - 0.05, high: topY + 0.05 }, thickness: { value: thickness, low: thickness - 0.08, high: thickness + 0.08 } }, sids, 'IMAGE_METRIC_REGISTERED', `${fascia.why}; the slab top is the storey floor`, { storeyIndex: recess.storeyIndex, uncertaintyM: 0.05, unresolvedProperties: ['slab section (fascia only)'] })
        const z0 = recess.side === 'FRONT' ? recess.mouthAt : recess.backAt
        const z1 = recess.side === 'FRONT' ? recess.backAt : recess.mouthAt
        balconies.push({ id, kind: 'BALCONY', storeyIndex: recess.storeyIndex, x0: extent.from, z0: Math.min(z0, z1), x1: extent.to, z1: Math.max(z0, z1), topY, thicknessM: thickness, fascia, featureId, provenance: 'IMAGE_METRIC_REGISTERED', why: fascia.why })
        const rail = readRailing(v.raster, v.view, { along0: extent.from, along1: extent.to }, topY, recess.mouthAt)
        if (rail) {
          const rid = `railing-${recess.side.toLowerCase()}-${recess.storeyIndex}`
          const rf = feature('RAILING', rid, { height: { value: rail.y[1] - rail.y[0], low: rail.y[1] - rail.y[0] - 0.08, high: rail.y[1] - rail.y[0] + 0.08 } }, sids, 'IMAGE_METRIC_REGISTERED', rail.why, { storeyIndex: recess.storeyIndex, hostId: featureId, uncertaintyM: 0.05, unresolvedProperties: ['post spacing'] })
          relate('SUPPORTS', featureId, rf, 'the balustrade stands on the slab')
          const zr = recess.side === 'FRONT' ? recess.mouthAt + 0.05 : recess.mouthAt - 0.05
          railings.push({ id: rid, storeyIndex: recess.storeyIndex, start: { x: round6(extent.from + 0.05), z: round6(zr) }, end: { x: round6(extent.to - 0.05), z: round6(zr) }, baseY: topY, heightM: round6(rail.y[1] - rail.y[0]), featureId: rf, provenance: 'IMAGE_METRIC_REGISTERED', why: rail.why })
        }
        // A fascia that runs on past the balcony over an attached body's zone is that body's roof edge: the portal head.
        for (const m of masses.filter((x) => x.role === 'ATTACHED')) {
          const roof = attachedRoofs.find((r) => r.massId === m.id)
          if (!roof || !roof.projectsOverZone) continue
          // The head belongs to the side the roof projects towards: the zone in front of the body.
          if (recess.side !== 'FRONT' || portalHeads.some((h) => h.massId === m.id)) continue
          const across = fasciaExtent(v.raster, v.view, { from: m.x0, to: m.x1 }, fascia.y)
          if (!across || across.to - across.from < (m.x1 - m.x0) * 0.6) continue
          const pid = `portal-head-${m.id}`
          const pf = feature('FACADE_MEMBER', pid, { y0: { value: fascia.y[0], low: fascia.y[0] - 0.05, high: fascia.y[0] + 0.05 }, y1: { value: fascia.y[1], low: fascia.y[1] - 0.05, high: fascia.y[1] + 0.05 } }, sids, 'SOURCE_CORROBORATED', `the fascia band continues across ${m.id}’s zone at the same level: the projecting roof’s edge`, { uncertaintyM: 0.05 })
          relate('CONTINUES_AS', featureId, pf, 'the balcony fascia continues as the portal head')
          relate('SUPPORTS', m.featureId, pf, 'the attached body carries the head')
          portalHeads.push({ id: pid, massId: m.id, x0: m.x0, x1: m.x1, z0: roof.footprint.z0, z1: lower ? lower.backAt : roof.footprint.z0 + 1, y0: fascia.y[0], y1: fascia.y[1], featureId: pf, provenance: 'SOURCE_CORROBORATED', why: `the roof of ${m.id} projects over its zone; its edge is the ${(fascia.y[1] - fascia.y[0]).toFixed(2)} m band` })
          assemblies.push({ id: `assembly-portal-${m.id}`, facadeId: recess.side, kind: 'PORTAL_FRAME', memberHypothesisIds: [pf, featureId, ...returns.filter((r) => r.side === recess.side && r.storeyIndex === 0).map((r) => r.featureId)], planeOffsets: {}, evidenceIds: sids, continuityRelations: [{ from: featureId, to: pf, kind: 'CONTINUES_AS' }], confidence: 0.7, why: 'the balcony fascia, the projecting roof edge and the ground-storey returns frame the portal' })
        }
        break
      }
    }
  }
  // Terraces: the recess floors at the ground storey, from the floor to the terrain datum.
  for (const recess of recesses.filter((r) => r.storeyIndex === 0)) {
    const l = levelOf(0)
    if (!l) continue
    for (const open of recess.open) {
      const id = `terrace-${recess.side.toLowerCase()}-${Math.round(open.from * 100)}`
      const plinth = terrain !== undefined ? round6(l.elevation - terrain) : 0.2
      const sids = sectionFrame && terrain !== undefined ? [sighting(sectionFrame, 'terrain datum', 0.8)] : []
      const featureId = feature('BALCONY', id, { plinth: { value: plinth, low: plinth - 0.05, high: plinth + 0.05 } }, sids, terrain !== undefined ? 'SOURCE_DERIVED' : 'ASSUMED_FOR_RENDERING', 'the recess floor at the storey level, standing on the plinth to the terrain', { storeyIndex: 0, unresolvedProperties: terrain === undefined ? ['plinth'] : [] })
      const z0 = recess.side === 'FRONT' ? recess.mouthAt : recess.side === 'REAR' ? recess.backAt : main.z0
      const z1 = recess.side === 'FRONT' ? recess.backAt : recess.side === 'REAR' ? recess.mouthAt : main.z1
      const x0 = recess.side === 'WEST' ? recess.mouthAt : recess.side === 'EAST' ? recess.backAt : open.from
      const x1 = recess.side === 'WEST' ? recess.backAt : recess.side === 'EAST' ? recess.mouthAt : open.to
      balconies.push({ id, kind: 'TERRACE', storeyIndex: 0, x0: round6(Math.min(x0, x1)), z0: round6(Math.min(z0, z1)), x1: round6(Math.max(x0, x1)), z1: round6(Math.max(z0, z1)), topY: l.elevation, thicknessM: plinth, featureId, provenance: terrain !== undefined ? 'SOURCE_DERIVED' : 'ASSUMED_FOR_RENDERING', why: 'the floor of the recess' })
    }
  }
  step({ stage: 'facade', what: 'verge members, balconies, railings, portal heads', method: 'DISCRETE_SELECTION', detail: `${verges.length} verge members, ${balconies.filter((b) => b.kind === 'BALCONY').length} balconies, ${railings.length} railings, ${portalHeads.length} portal heads, ${assemblies.length} assemblies`, inputs: views.length, outputs: verges.length + balconies.length + railings.length + portalHeads.length })
  // The stripe rule, recorded: every LINEAR_VOLUME_CANDIDATE that no member accounts for is a stripe.
  for (const o of graph.observations.filter((x) => x.kind === 'LINEAR_VOLUME_CANDIDATE')) {
    const frame = frameById.get(o.frameId)
    const v = views.find((x) => x.view.registration.frameId === o.frameId)
    if (!frame || !v) {
      record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: 'a linear volume candidate on an unregistered view', authority: 'LOW', disposition: 'IGNORED_WITH_REASON', reason: 'the view carries no metric registration (a perspective, or an unassigned render)', stage: 'ASSEMBLY' })
      continue
    }
    const g = o.pixelGeometry
    const rect = g.type === 'RECT' ? g.rect : undefined
    const hit = rect && members.some((m) => m.frameIds.includes(o.frameId) && (() => { const y0 = v.view.yOf(rect.y1); const y1 = v.view.yOf(rect.y0); return Math.min(y1, m.y[1]) - Math.max(y0, m.y[0]) > 0.1 })())
    record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: 'a linear volume candidate', authority: 'MEDIUM', disposition: hit ? 'USED_AS_CORROBORATION' : 'REJECTED_WITH_REASON', reason: hit ? 'it lies on a member the plan or a recess gives depth to' : 'no plan return, recess or slab level gives it depth: a stripe, not a volume', stage: 'ASSEMBLY' })
  }

  // ---------------------------------------------------------------------------
  // Perspective cameras (§17): attempted on every perspective view; used only when solved.
  // ---------------------------------------------------------------------------
  const cameras: ReconstructionV2Result['registrations']['cameras'] = []
  const solvedCameras: PerspectiveCameraV2[] = []
  for (const frame of graph.coordinateFrames.filter((f) => f.roles.projection === 'PERSPECTIVE' && (keep ? keep(f) : true))) {
    const raster = options.raster(frame)
    if (!raster || !mainRoof) continue
    const cam = solvePerspectiveCamera(raster, frame.id, { x0: world.envelope.x0, x1: world.envelope.x1, z0: world.envelope.z0, z1: world.envelope.z1, eaveY: mainRoof.eaveY, ridgeY: mainRoof.ridgeY, ridgeAxis: mainRoof.ridgeAxis, ridgeAt: mainRoof.ridgeAt, groundY: 0, attached: attachedRoofs.map((r) => ({ x0: r.footprint.x0, x1: r.footprint.x1, z0: r.footprint.z0, z1: r.footprint.z1, topY: r.parapetTopY ?? r.slabTopY })) })
    cameras.push({ frameId: frame.id, solved: !!cam, residualPx: cam?.residualPx.rms, why: cam ? cam.why : 'no camera hypothesis aligned enough silhouette corners with a plausible residual' })
    if (cam) {
      solvedCameras.push(cam)
      feature('CAMERA', `camera-${frame.id.slice(-10)}`, { residualPx: { value: cam.residualPx.rms, low: 0, high: cam.residualPx.max, unit: 'none' } }, [sighting(frame, 'silhouette corners of the perspective', cam.confidence)], 'IMAGE_METRIC_REGISTERED', cam.why)
    }
    for (const o of graph.observations.filter((x) => x.frameId === frame.id)) record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: `${o.kind} on a perspective render`, authority: 'LOW', disposition: cam ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON', reason: cam ? 'the perspective is registered; depth order was checked against it' : 'no camera could be solved for this render, so nothing on it can be placed', stage: 'REGISTRATION' })
  }
  step({ stage: 'camera', what: 'perspective cameras', method: solvedCameras.length > 0 ? 'BOUNDED_SEARCH' : 'REFUSED', detail: cameras.map((c) => `${c.frameId.slice(-12)}: ${c.solved ? `solved, ${c.residualPx?.toFixed(1)} px rms` : 'unsolved'}`).join('; ') || 'no perspective views', inputs: cameras.length, outputs: solvedCameras.length })

  // ---------------------------------------------------------------------------
  // Finish regions (colour, never geometry): the dominant tones of the recessed walls and the side bands.
  // ---------------------------------------------------------------------------
  const surfaceRegions: BuildingV2['surfaceRegions'] = []
  for (const recess of recesses.filter((r) => r.storeyIndex === 0)) {
    for (const v of viewsOf(recess.side)) {
      for (const open of recess.open) {
        const l = levelOf(0)
        if (!l) continue
        const along: [number, number] = [open.from, open.to]
        const y: [number, number] = [l.elevation + 0.4, l.elevation + 2.0]
        const x0 = v.view.pxOf(along[0])
        const x1 = v.view.pxOf(along[1])
        const y0 = v.view.pyOf(y[1])
        const y1 = v.view.pyOf(y[0])
        const tone = dominantTone(v.raster, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), 2)
        if (tone.share < 0.35) continue
        const massOn = masses.find((m) => m.storeys.includes(0) && (recess.side === 'FRONT' ? Math.abs(m.z0 - recess.backAt) < 0.1 : recess.side === 'REAR' ? Math.abs(m.z1 - recess.backAt) < 0.1 : true) && open.from < (recess.side === 'FRONT' || recess.side === 'REAR' ? m.x1 : m.z1) && open.to > (recess.side === 'FRONT' || recess.side === 'REAR' ? m.x0 : m.z0))
        if (!massOn) continue
        const clipped: [number, number] = [Math.max(open.from, recess.side === 'FRONT' || recess.side === 'REAR' ? massOn.x0 : massOn.z0), Math.min(open.to, recess.side === 'FRONT' || recess.side === 'REAR' ? massOn.x1 : massOn.z1)]
        if (clipped[1] - clipped[0] < 0.5) continue
        const id = `finish-${recess.side.toLowerCase()}-${Math.round(clipped[0] * 100)}`
        const featureId = feature('SURFACE_REGION', id, {}, [sighting(frameById.get(v.view.registration.frameId) as SourceCoordinateFrame, 'finish tone of the recessed wall', tone.share)], 'VISUAL_SEMANTIC', `the recessed wall reads ${tone.tone.toLowerCase()} on ${Math.round(tone.share * 100)} % of its area`, { storeyIndex: 0 })
        surfaceRegions.push({ id, wallRef: { massId: massOn.id, storeyIndex: 0, side: recess.side }, along: clipped, y: [l.elevation, l.elevation + l.height], tone: tone.tone, featureId })
      }
      break
    }
  }

  // ---------------------------------------------------------------------------
  // J. emit, K. seal, L. verify, M. repair, N. quality
  // ---------------------------------------------------------------------------
  const building: BuildingV2 = { label: options.label, wallThicknessM: T, slabThicknessM: slabT, levels: levelsV2, masses, mainRoof, attachedRoofs, recesses, returns, balconies, railings, portalHeads, verges, chimneys, rooflights, openings, sharedDoors, interior, stair, assemblies, surfaceRegions, terrainY: terrain }
  const residualsBefore = verifyAgainstViews({ building, views })
  const repair = repairFromResiduals(building, residualsBefore, 2)
  const residuals = verifyAgainstViews({ building, views })
  step({ stage: 'verification', what: 'the model projected into the registered views', method: 'DIRECT', detail: `${residuals.length} residuals, ${residuals.filter((r) => !r.withinTolerance).length} outside tolerance after ${repair.iterations.length} repair round${repair.iterations.length === 1 ? '' : 's'} (${repair.iterations.reduce((a, i) => a + i.applied.length, 0)} applied, ${repair.iterations.reduce((a, i) => a + i.refused.length, 0)} refused)`, inputs: residualsBefore.length, outputs: residuals.length })
  for (const it of repair.iterations) for (const op of it.applied) ctx.traces.push({ objectId: op.featureId, kind: 'repair', hypothesisId: `hyp-${op.featureId}`, evidenceIds: [], observationIds: [], rejected: [], why: op.why })

  const { program, bindings, dropped } = emitBuilding(building, options.label)
  for (const d of dropped) {
    const solved = ctx.solved.find((s) => s.id === `feat-${d.featureId}`)
    if (!solved) continue
    solved.quality = 'L0'
    solved.provenance = 'UNRESOLVED'
    solved.unresolvedProperties = [...solved.unresolvedProperties, `not built: ${d.why}`]
  }
  const modelId = `m-auto-v2-${options.slug}`.replace(/[^A-Za-z0-9_.:-]+/g, '-')
  const hypothesisSet: PrimitiveHypothesisSet = {
    schema: HYPOTHESIS_SET_SCHEMA,
    schemaVersion: HYPOTHESIS_SET_SCHEMA_VERSION,
    id: '',
    sourcePackageId: options.sourcePackageId,
    sourcePackageHash: options.sourcePackageHash,
    observationGraphId: graph.id,
    observationGraphHash: graph.contentHash,
    metricEvidenceId: metrics.id,
    metricEvidenceHash: metrics.contentHash,
    proposers: [{ name: 'analyzer-v2', version: SOLVER_V2_VERSION }],
    hypotheses: [],
    unresolved: [],
    fusion: { rawCandidates: 0, afterDuplicateSuppression: 0, afterClustering: 0, afterContinuityMerge: 0, accepted: 0, rejected: [] },
    contentHash: '',
  } as unknown as PrimitiveHypothesisSet
  const hypothesesHash = hashArtifact('buildapp.analyzer-v2-hypotheses', SOLVER_V2_VERSION, [{ label: 'features', unordered: ctx.hypotheses }])
  hypothesisSet.id = `hypotheses-v2-${hypothesesHash.slice(0, 16)}`
  hypothesisSet.contentHash = hypothesesHash

  // Traces: one per bound object.
  for (const b of bindings) {
    const solved = ctx.solved.find((s) => s.id === b.featureId || s.id === `feat-${b.featureId}`)
    if (!solved) continue
    const obs = solved.sourceCoverage.sightings > 0 ? ctx.sightings.filter((s) => ctx.hypotheses.find((h) => h.id === solved.hypothesisId)?.sightingIds.includes(s.id)).flatMap((s) => s.observationIds) : []
    ctx.traces.push({ objectId: b.objectId, kind: b.objectKind, hypothesisId: solved.hypothesisId, evidenceIds: [], observationIds: [...new Set(obs)], rejected: [], why: solved.why })
  }
  const { candidate, model } = sealCandidate(
    {
      schema: 'buildapp.reconstruction-candidate',
      schemaVersion: '1.1.0',
      sourcePackageId: options.sourcePackageId,
      sourcePackageHash: options.sourcePackageHash,
      observationGraphId: graph.id,
      observationGraphHash: graph.contentHash,
      metricEvidenceId: metrics.id,
      metricEvidenceHash: metrics.contentHash,
      hypothesisSetId: hypothesisSet.id,
      hypothesisSetHash: hypothesisSet.contentHash,
      structuralLayoutId: layout.id,
      structuralLayoutHash: layout.contentHash,
      structuralStatus: layout.gate.status,
      modelId,
      label: options.label,
      solver: { name: `${SOLVER_NAME}.v2`, version: SOLVER_V2_VERSION },
      program,
      quantities: [],
      contradictions: [],
      unresolved: ctx.unresolved,
      traces: ctx.traces,
      steps: ctx.steps,
      residuals: { metricRmsM: round6(Math.sqrt(residuals.reduce((a, r) => a + r.residualM * r.residualM, 0) / Math.max(1, residuals.length))), metricMaxM: round6(residuals.reduce((a, r) => Math.max(a, Math.abs(r.residualM)), 0)), hard: ctx.solved.filter((s) => s.provenance === 'SOURCE_EXACT').length, soft: ctx.solved.filter((s) => s.provenance !== 'SOURCE_EXACT' && s.provenance !== 'UNRESOLVED').length, unresolved: ctx.solved.filter((s) => s.provenance === 'UNRESOLVED' || s.unresolvedProperties.length > 0).length },
    },
    options.slug,
  )

  // The remaining evidence, every id with a disposition.
  for (const o of graph.observations) {
    if (ctx.consumed.has(o.id)) continue
    const frame = frameById.get(o.frameId)
    const fam = frame ? viewFamilyOf(frame) : 'PAGE'
    let disposition: EvidenceConsumptionRecord['disposition'] = 'IGNORED_WITH_REASON'
    let reason = 'read for the record; the v2 passes read this drawing’s pixels directly'
    if (o.kind === 'WALL_BAND') { disposition = 'USED_AS_CORROBORATION'; reason = 'the plan’s wall bands corroborate the bodies and partitions the v2 pass read from the same raster' }
    else if (o.kind === 'OPENING_INTERVAL') { disposition = 'USED_AS_CORROBORATION'; reason = 'a gap the plan reader also found, or a doorway inside the body' }
    else if (o.kind === 'OPENING') { disposition = fam === 'ELEVATION' ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON'; reason = fam === 'ELEVATION' ? 'a rectangle on a registered render; openings were placed from the plan gaps and sized on the render' : 'on a view without a metric registration' }
    else if (o.kind === 'ROOF_EDGE' || o.kind === 'RIDGE') { disposition = 'USED_AS_CORROBORATION'; reason = 'the roof line the render registration was checked against' }
    else if (o.kind === 'LOGGIA') { disposition = fam === 'ELEVATION' ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON'; reason = fam === 'ELEVATION' ? 'a recess mouth on a render; the recess topology came from the plan zones' : 'on a view without a metric registration' }
    else if (o.kind === 'SURFACE_REGION' || o.kind === 'WALL_REGION') { disposition = 'IGNORED_WITH_REASON'; reason = 'colour, not geometry: finish regions are read from the registered renders directly' }
    else if (o.kind === 'PARALLEL_LINE_FAMILY') { disposition = 'IGNORED_WITH_REASON'; reason = 'dimension chains are read by the metric layer from the raster' }
    else if (o.kind === 'STAIR' || o.kind === 'STAIR_SYMBOL' || o.kind === 'POLYLINE') { disposition = 'USED_AS_CORROBORATION'; reason = 'a stair reading on a plan or section, corroborating the ladders' }
    else if (o.kind === 'LEVEL_DATUM') { disposition = 'USED_AS_CORROBORATION'; reason = 'the datum lines the metric ladder was fitted through' }
    record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: `${o.kind} on ${fam.toLowerCase()} ${o.frameId.slice(-10)}`, authority: o.confidence >= 0.75 ? 'MEDIUM' : 'LOW', disposition, reason, stage: 'OBSERVATION' })
  }
  for (const e of metrics.evidence) {
    if (ctx.consumed.has(e.id)) continue
    const plan = planFrames.find((p) => p.frameId === e.frameId)
    let disposition: EvidenceConsumptionRecord['disposition'] = 'USED_AS_CORROBORATION'
    let reason = 'a printed figure on a registered drawing that corroborates the frame it was read through'
    if (e.kind === 'OPENING_CALLOUT') { disposition = 'UNRESOLVED'; reason = 'a printed opening callout that matched no wall gap within reach' }
    else if (e.kind === 'LINEAR_DIMENSION' && !plan) { disposition = 'IGNORED_WITH_REASON'; reason = 'a dimension on a drawing the v2 frame does not register (a variant, the section, the site plan)' }
    else if (e.kind === 'ANGLE') { disposition = 'USED_AS_CORROBORATION'; reason = 'an angle reading beside the printed pitch' }
    record({ evidenceId: e.id, evidenceKind: 'METRIC', what: `${e.kind} ${e.rawText} on ${e.frameId.slice(-10)}`, authority: e.confidence >= 0.6 ? 'HIGH' : 'MEDIUM', disposition, reason, stage: 'METRIC' })
  }
  for (const a of options.publishedAreas ?? []) {
    record({ evidenceId: `page:${a.key}`, evidenceKind: 'PAGE_FACT', what: `${a.label} ${a.value} ${a.unit}`, authority: 'HIGH', disposition: a.key.includes('footprint') ? 'USED_AS_CORROBORATION' : 'IGNORED_WITH_REASON', reason: a.key.includes('footprint') ? 'checked against the bodies’ area by the layout gate' : 'an aggregate: no geometry may be derived from it', stage: 'QUALITY' })
  }
  for (const r of publishedRooms) {
    const matched = interior.some((i) => i.rooms.some((x) => x.number === String(r.index) && x.label === r.label))
    record({ evidenceId: `page:room:${r.storey}:${r.index}`, evidenceKind: 'PAGE_ROOM', what: `${r.storey} ${r.index} ${r.label} ${r.area}`, authority: 'MEDIUM', disposition: matched ? 'USED_AS_CORROBORATION' : 'UNRESOLVED', reason: matched ? 'the room number was read inside a room polygon and the area compared' : 'no room polygon carries this number', stage: 'QUALITY' })
  }
  ctx.ledger = [...ctx.consumed.values()]

  const graphDraft: FeatureGraphDraft = { id: `feature-graph-${options.slug}`, sourcePackageHash: options.sourcePackageHash, observationGraphHash: graph.contentHash, metricEvidenceHash: metrics.contentHash, sightings: ctx.sightings, measurements: ctx.measurements, hypotheses: ctx.hypotheses, alternatives: ctx.alternatives, solved: ctx.solved, bindings: bindings.map((b) => ({ id: `bind-${b.objectId}`, solvedFeatureId: ctx.solved.find((s) => s.id === b.featureId || s.id === `feat-${b.featureId}`)?.id ?? `feat-${b.featureId}`, objectId: b.objectId, objectKind: b.objectKind, commandIndex: b.commandIndex })), relations: ctx.relations }
  const featureGraph = sealFeatureGraph(graphDraft)
  const ledger = sealLedger(`ledger-${options.slug}`, featureGraph.contentHash, ctx.ledger)
  const quality = sealQualityReport(`quality-${options.slug}`, featureGraph.contentHash, ctx.solved, (fid) => featureGraph.bindings.filter((b) => b.solvedFeatureId === fid).map((b) => b.objectId))
  const violations = { graph: featureGraphViolations(graphDraft), ledger: ledgerViolations(ctx.ledger, [...graph.observations.map((o) => o.id), ...metrics.evidence.map((e) => e.id)]) }
  step({ stage: 'quality', what: 'per-feature quality', method: 'DIRECT', detail: Object.entries(quality.summary).map(([fam, levels]) => `${fam} ${Object.entries(levels).map(([l, n]) => `${l}:${n}`).join('/')}`).join(', '), inputs: ctx.solved.length, outputs: quality.records.length })

  return { layout, building, candidate, model, hypotheses: hypothesisSet, featureGraph, ledger, quality, residuals, repair, registrations: { plans: planFrames, elevations, section: sectionReg ? { frameId: sectionReg.frameId, mpp: sectionReg.mpp, originCol: sectionReg.originCol, zeroRow: sectionReg.zeroRow } : undefined, cameras }, world, steps: ctx.steps, unresolved: ctx.unresolved, violations }
}

/** The columns of a render across which a band of the given rows carries dark tone: the band's along extent. */
function fasciaExtent(raster: Raster, view: ElevationFrameV2, span: { from: number; to: number }, y: [number, number]): { from: number; to: number } | undefined {
  const rowTop = Math.round(view.pyOf(y[1] - 0.05))
  const rowBottom = Math.round(view.pyOf(y[0] + 0.05))
  const px0 = Math.round(view.pxOf(span.from))
  const px1 = Math.round(view.pxOf(span.to))
  const cols: boolean[] = []
  const lo = Math.min(px0, px1)
  const hi = Math.max(px0, px1)
  for (let px = lo; px <= hi; px += 1) {
    let dark = 0
    let n = 0
    for (let py = Math.min(rowTop, rowBottom); py <= Math.max(rowTop, rowBottom); py += 2) {
      const o = (py * raster.width + px) * 4
      if (o < 0 || o + 2 >= raster.data.length) continue
      const l = 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2]
      n += 1
      if (l < 150) dark += 1
    }
    cols.push(n > 0 && dark / n >= 0.6)
  }
  // The longest run of dark columns.
  let best: [number, number] | undefined
  let start: number | undefined
  for (let i = 0; i <= cols.length; i += 1) {
    const v = i < cols.length && cols[i]
    if (v && start === undefined) start = i
    if (!v && start !== undefined) {
      if (!best || i - start > best[1] - best[0]) best = [start, i - 1]
      start = undefined
    }
  }
  if (!best) return undefined
  const a = view.alongOf(lo + best[0])
  const b = view.alongOf(lo + best[1] + 1)
  if (Math.abs(b - a) < 0.8) return undefined
  return { from: round6(Math.min(a, b)), to: round6(Math.max(a, b)) }
}
