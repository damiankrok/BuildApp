/**
 * TOPOLOGY → METRIC SOLVE → DSL: what an accepted (or unknown) hypothesis
 * states, as Building DSL commands.
 *
 * Topology first — which member stands on which, which plane joins which,
 * which wall a cover is attached to — then the metric solve: every height,
 * pitch and size is resolved by source authority (authority.ts), each joint
 * decided by the higher authority of its two sides, and every value that
 * lost is recorded as a conflict. The commands are the only output: the model
 * is written by `applyCommands`, re-validated there, and drawn by the
 * compiler. Nothing here makes a triangle.
 */
import type { BuildingCommand } from '@buildapp/commands'
import {
  roofJoinShape,
  roofPlaneDrop,
  roofPlaneTopAt,
  segmentOnBoundaries,
  sharedBoundarySegments,
  type Assembly,
  type CanonicalBuildingModel,
  type Evidence,
  type RoofClassification,
  type RoofEdgeSide,
  type RoofPlane,
  type Vec2,
  type Vec3,
  type Wall,
} from '@buildapp/model'
import { authorityRank, evidenceStatusOf, resolveQuantity, type QuantityCandidate, type ResolvedQuantity, type SourceAuthority } from '../authority.js'
import { classifyRoofGraph } from '../graphs/roof-graph.js'
import type { SemanticProposal } from '../proposals.js'
import { boxOf, dist2, plan, pointInPolygon, pointSegmentDistance2, r6, r9, signedArea, unit2, upwardNormal } from './geometry.js'
import type { Family, Hypothesis, PipelineLog } from './types.js'

type Cmd = BuildingCommand

export type EmitContext = {
  model: CanonicalBuildingModel
  prefix: string
  quantities: ResolvedQuantity[]
  commands: Cmd[]
  log: PipelineLog
  /** Ids the program has defined so far (materials, evidence sources), on top of the context model's. */
  defined: Set<string>
}

export type EmitOutcome = { ok: true; assemblyIds: string[]; objectIds: string[] } | { ok: false; reason: string }

// ---------------------------------------------------------------------------
// shared
// ---------------------------------------------------------------------------

const MATERIALS: Record<string, { name: string; color: string }> = {
  'mat-member': { name: 'exterior member (finish not observed)', color: '#8c8279' },
  'mat-cover': { name: 'cover (finish not observed)', color: '#6b6661' },
  'mat-roofing': { name: 'roofing (finish not observed)', color: '#4a4541' },
  'mat-exterior-paving': { name: 'exterior paving (finish not observed)', color: '#a39a8f' },
}

function material(ctx: EmitContext, id: keyof typeof MATERIALS | string): string {
  if (ctx.model.materials.some((m) => m.id === id) || ctx.defined.has(id)) return id
  const m = MATERIALS[id]
  ctx.commands.push({ type: 'defineMaterial', id, name: m.name, color: m.color })
  ctx.defined.add(id)
  return id
}

const SOURCE_KIND: Record<SourceAuthority, 'DRAWING' | 'RENDER' | 'OTHER' | 'DERIVATION'> = {
  PRINTED_DIMENSION: 'DRAWING',
  TECHNICAL_GEOMETRY: 'DRAWING',
  CROSS_VIEW: 'DERIVATION',
  PERSPECTIVE: 'RENDER',
  VISUAL_INFERENCE: 'OTHER',
  CONVENTION: 'DERIVATION',
}

/** The model evidence source standing for one frame, added on first use. */
export function frameSource(ctx: EmitContext, ps: readonly SemanticProposal[], frame: string): string {
  const id = `src-frame-${frame}`
  if (ctx.model.evidenceSources.some((s) => s.id === id) || ctx.defined.has(id)) return id
  const mine = ps.filter((p) => p.sourceFrameId === frame)
  const best = [...mine].sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority))[0]
  const detectors = [...new Set(mine.map((p) => p.detector))].sort().join(', ')
  ctx.commands.push({ type: 'addEvidenceSource', id, kind: mine.some((p) => p.detector === 'OWNER') ? 'MANUAL' : SOURCE_KIND[best?.authority ?? 'VISUAL_INFERENCE'], label: `frame ${frame} (${detectors || 'no detector'})` })
  ctx.defined.add(id)
  return id
}

function evidence(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[], authority: SourceAuthority, corroborated: boolean, what: string): Evidence {
  const frames = [...new Set(ps.map((p) => p.sourceFrameId))].sort()
  return {
    status: evidenceStatusOf(authority, corroborated),
    source: 'architecture hypothesis pipeline',
    locator: `${h.id}: ${what}`,
    interpretation: `${h.family ? h.family.toLowerCase() : 'unknown feature'} from proposals ${ps.map((p) => p.id).join(', ')}`,
    confidence: Math.round(h.confidence * 1000) / 1000,
    sourceIds: frames.map((f) => frameSource(ctx, ps, f)),
  }
}

function resolve(ctx: EmitContext, h: Hypothesis, key: string, candidates: readonly QuantityCandidate[]): ResolvedQuantity | null {
  const r = resolveQuantity(`${h.id}.${key}`, candidates)
  if (!r) return null
  ctx.quantities.push(r)
  ctx.log.push({ stage: 'METRIC_SOLVE', hypothesisId: h.id, message: `${key} = ${r6(r.value)} (${r.authority.toLowerCase()}${r.corroboratedBy.length ? `, corroborated by ${r.corroboratedBy.join(', ')}` : ''}${r.conflicts.length ? `; ${r.conflicts.length} conflict${r.conflicts.length > 1 ? 's' : ''} recorded` : ''})` })
  return r
}

const printed = (ps: readonly SemanticProposal[], quantity: string): QuantityCandidate[] =>
  ps.flatMap((p) => (p.geometry.type === 'VALUE' && p.geometry.quantity === quantity ? [{ value: p.geometry.value, authority: p.authority, sourceId: p.id, tolerance: p.geometry.tolerance }] : []))

const convention = (key: string, value: number): QuantityCandidate => ({ value, authority: 'CONVENTION', sourceId: `convention:${key}` })

/** The level a feature at world height `y` belongs to: the highest one at or below it. */
function levelFor(m: CanonicalBuildingModel, y: number): { id: string; elevation: number } {
  const sorted = [...m.levels].sort((a, b) => a.elevation - b.elevation)
  const below = sorted.filter((l) => l.elevation <= y + 0.01)
  const l = below[below.length - 1] ?? sorted[0]
  return { id: l.id, elevation: l.elevation }
}

/** The context walls whose outer face runs along the plan segment a–b (within `tol`), with where along the wall. */
function wallsAlong(m: CanonicalBuildingModel, a: Vec2, b: Vec2, tol = 0.05): Wall[] {
  return m.walls.filter((w) => pointSegmentDistance2(a, w.start, w.end) <= tol && pointSegmentDistance2(b, w.start, w.end) <= tol)
}

/** The side of a plan rectangle-ish polygon an edge lies on, as a roof edge side. */
function sideOf(poly: readonly Vec2[], a: Vec2, b: Vec2): RoofEdgeSide | null {
  const xs = poly.map((p) => p.x)
  const zs = poly.map((p) => p.z)
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  const t = 1e-6
  if (Math.abs(a.x - x0) < t && Math.abs(b.x - x0) < t) return 'MIN_X'
  if (Math.abs(a.x - x1) < t && Math.abs(b.x - x1) < t) return 'MAX_X'
  if (Math.abs(a.z - z0) < t && Math.abs(b.z - z0) < t) return 'MIN_Z'
  if (Math.abs(a.z - z1) < t && Math.abs(b.z - z1) < t) return 'MAX_Z'
  return null
}

/** The top of whatever exterior floor in the context lies under plan point p: a terrace, a platform, a balcony — or the level's floor. */
function groundUnder(m: CanonicalBuildingModel, p: Vec2, level: { id: string; elevation: number }): { y: number; id?: string } {
  for (const t of m.terraces) if (pointInPolygon(p, t.polygon)) return { y: (m.levels.find((l) => l.id === t.levelId)?.elevation ?? 0) + t.topOffset, id: t.id }
  for (const t of m.platforms) if (pointInPolygon(p, t.polygon) && !t.slope) return { y: (m.levels.find((l) => l.id === t.levelId)?.elevation ?? 0) + t.topOffset, id: t.id }
  return { y: level.elevation }
}

type PlaneSpec = { id: string; levelId: string; boundary: Vec2[]; datum: Vec3; pitchDeg: number; downslope: Vec2; thickness: number }

const asPlane = (s: PlaneSpec): RoofPlane => ({ id: s.id, levelId: s.levelId, boundary: s.boundary, datum: s.datum, pitchDeg: s.pitchDeg, downslope: s.downslope, thickness: s.thickness }) as RoofPlane

/** The free (unjoined) pieces of every plane's boundary, typed: an eave the plane falls to, a verge along the slope, a boundary otherwise. */
function freeEdges(planes: readonly PlaneSpec[]): Array<{ planeId: string; kind: 'EAVE' | 'VERGE' | 'BOUNDARY'; a: Vec2; b: Vec2 }> {
  const out: Array<{ planeId: string; kind: 'EAVE' | 'VERGE' | 'BOUNDARY'; a: Vec2; b: Vec2 }> = []
  for (const p of planes) {
    const others = planes.filter((q) => q.id !== p.id).map((q) => q.boundary)
    const ccw = signedArea(p.boundary) > 0
    for (let i = 0; i < p.boundary.length; i++) {
      const a = p.boundary[i]
      const b = p.boundary[(i + 1) % p.boundary.length]
      if (segmentOnBoundaries(a, b, others)) continue
      const d = unit2({ x: b.x - a.x, z: b.z - a.z })
      if (!d) continue
      const outward = ccw ? { x: d.z, z: -d.x } : { x: -d.z, z: d.x }
      const pl = asPlane(p)
      const level = Math.abs(roofPlaneTopAt(pl, a.x, a.z) - roofPlaneTopAt(pl, b.x, b.z)) <= 1e-4
      const falls = p.pitchDeg > 1e-6 && outward.x * p.downslope.x + outward.z * p.downslope.z > 0.5
      out.push({ planeId: p.id, kind: !level ? 'VERGE' : falls ? 'EAVE' : 'BOUNDARY', a, b })
    }
  }
  return out
}

/** The joins between planes, each with the kind CONNECT_ROOF_PLANES AUTO will read. */
function joinsOf(planes: readonly PlaneSpec[]): Array<{ a: string; b: string; seg: { start: Vec2; end: Vec2 }; kind: 'RIDGE' | 'HIP' | 'VALLEY' | 'ROOF_STEP' | 'FLUSH' }> {
  const out: Array<{ a: string; b: string; seg: { start: Vec2; end: Vec2 }; kind: 'RIDGE' | 'HIP' | 'VALLEY' | 'ROOF_STEP' | 'FLUSH' }> = []
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (const seg of sharedBoundarySegments([planes[i].boundary], [planes[j].boundary])) {
        const A = asPlane(planes[i])
        const B = asPlane(planes[j])
        const d = unit2({ x: seg.b.x - seg.a.x, z: seg.b.z - seg.a.z })
        if (!d) continue
        const mid = { x: (seg.a.x + seg.b.x) / 2, z: (seg.a.z + seg.b.z) / 2 }
        const n = { x: d.z, z: -d.x }
        const into = pointInPolygon({ x: mid.x + n.x * 0.01, z: mid.z + n.z * 0.01 }, A.boundary) ? n : { x: -n.x, z: -n.z }
        const shape = roofJoinShape(A, B, seg.a, seg.b, into)
        const level = Math.abs(roofPlaneTopAt(A, seg.a.x, seg.a.z) - roofPlaneTopAt(A, seg.b.x, seg.b.z)) <= 1e-6
        const kind = shape === 'STEP' ? 'ROOF_STEP' : shape === 'CONCAVE' ? 'VALLEY' : shape === 'FLUSH' ? 'FLUSH' : level ? 'RIDGE' : 'HIP'
        out.push({ a: planes[i].id, b: planes[j].id, seg: { start: seg.a, end: seg.b }, kind })
      }
    }
  }
  return out
}

/** A roof plane from an observed planar region: its fall and pitch fitted, the pitch resolved by authority, turned about its lowest point. */
function planeFrom(ctx: EmitContext, h: Hypothesis, p: SemanticProposal, ps: readonly SemanticProposal[], id: string, levelId: string, thickness: number, what: string): PlaneSpec | null {
  if (p.geometry.type !== 'POLYGON') return null
  const pts = p.geometry.points
  const n = upwardNormal(pts)
  if (!n) return null
  const fitted = (Math.atan2(Math.hypot(n.x, n.z), n.y) * 180) / Math.PI
  const pitched = fitted > 0.5
  const pitch = pitched ? resolve(ctx, h, `${what}.pitchDeg`, [{ value: r6(fitted), authority: p.authority, sourceId: p.id, tolerance: 0.5 }, ...printed(ps, 'roof.pitchDeg').map((c) => ({ ...c, tolerance: c.tolerance ?? 0.5 }))]) : null
  const pitchDeg = pitched && pitch ? pitch.value : 0
  const downslope = pitched ? (unit2({ x: n.x, z: n.z }) as Vec2) : { x: 0, z: -1 }
  const low = [...pts].sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z)[0]
  return { id, levelId, boundary: pts.map((q) => ({ x: r9(q.x), z: r9(q.z) })), datum: { x: r9(low.x), y: r9(low.y), z: r9(low.z) }, pitchDeg: r9(pitchDeg), downslope: { x: r9(downslope.x), z: r9(downslope.z) }, thickness }
}

function roofCommands(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[], planes: readonly PlaneSpec[], prefix: string, materialId: string): { commands: Cmd[]; edgeIds: string[]; classification: RoofClassification } {
  const cmds: Cmd[] = []
  const ev = (what: string, auth: SourceAuthority): Evidence => evidence(ctx, h, ps, auth, false, what)
  const regionAuth = [...ps].filter((p) => p.kind === 'ROOF_PLANE_REGION' || p.kind === 'COVER_SURFACE').sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority))[0]?.authority ?? 'VISUAL_INFERENCE'
  for (const p of planes) cmds.push({ type: 'createRoofPlane', id: p.id, levelId: p.levelId, boundary: p.boundary, datum: p.datum, pitchDeg: p.pitchDeg, downslope: p.downslope, thickness: p.thickness, materialId, evidence: ev(`plane ${p.id}`, regionAuth) })
  const joins = joinsOf(planes).filter((j) => j.kind !== 'FLUSH')
  const lines = ps.filter((p) => p.kind === 'ROOF_LINE' && p.geometry.type === 'SEGMENT')
  const edgeIds: string[] = []
  const counts = { RIDGE: 0, HIP: 0, VALLEY: 0, ROOF_STEP: 0 } as Record<string, number>
  joins.forEach((j, i) => {
    const id = `${prefix}-join-${i + 1}`
    const seen = lines.filter((l) => l.geometry.type === 'SEGMENT' && pointSegmentDistance2(plan(l.geometry.start), j.seg.start, j.seg.end) <= 0.05 && pointSegmentDistance2(plan(l.geometry.end), j.seg.start, j.seg.end) <= 0.05)
    ctx.log.push({ stage: 'TOPOLOGY', hypothesisId: h.id, message: `${j.a} and ${j.b} share an edge: a ${j.kind.toLowerCase().replace('_', ' ')}${seen.length ? `, corroborated by the roof line${seen.length > 1 ? 's' : ''} ${seen.map((l) => l.id).join(', ')}` : ', seen in no roof line'}` })
    cmds.push({ type: 'connectRoofPlanes', id, kind: 'AUTO', planeIds: [j.a, j.b], segment: j.seg, evidence: ev(`${j.kind.toLowerCase()} ${j.a}/${j.b}`, seen.length ? 'CROSS_VIEW' : regionAuth) })
    edgeIds.push(id)
    counts[j.kind] += 1
  })
  freeEdges(planes).forEach((e, i) => {
    const id = `${prefix}-${e.kind.toLowerCase()}-${i + 1}`
    cmds.push({ type: 'createRoofEdge', id, kind: e.kind, planeId: e.planeId, start: e.a, end: e.b, evidence: ev(`free edge of ${e.planeId}`, regionAuth) })
    edgeIds.push(id)
  })
  const n = (k: string): number[] => Array.from({ length: counts[k] }, (_, i) => i)
  const classification = classifyRoofGraph({ planes, ridges: n('RIDGE'), hips: n('HIP'), valleys: n('VALLEY'), steps: n('ROOF_STEP') })
  return { commands: cmds, edgeIds, classification }
}

// ---------------------------------------------------------------------------
// ROOF
// ---------------------------------------------------------------------------

export function emitRoof(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[]): EmitOutcome {
  const regions = ps.filter((p) => p.kind === 'ROOF_PLANE_REGION').sort((a, b) => (a.id < b.id ? -1 : 1))
  const minY = Math.min(...regions.flatMap((p) => (p.geometry.type === 'POLYGON' ? p.geometry.points.map((q) => q.y) : [])))
  const level = levelFor(ctx.model, Number.isFinite(minY) ? minY - 0.5 : 0)
  const thickness = resolve(ctx, h, 'roof.thickness', [...printed(ps, 'roof.thickness'), convention('roof.thickness', 0.25)])?.value ?? 0.25
  const prefix = `${ctx.prefix}-${h.id}-roof`
  const planes: PlaneSpec[] = []
  regions.forEach((r, i) => {
    const p = planeFrom(ctx, h, r, ps, `${prefix}-plane-${i + 1}`, level.id, thickness, `plane-${i + 1}`)
    if (p) planes.push(p)
  })
  if (planes.length === 0) return { ok: false, reason: 'no roof region is planar' }
  const roofMat = ctx.model.roofPlanes[0]?.materialId ?? material(ctx, 'mat-roofing')
  const r = roofCommands(ctx, h, ps, planes, prefix, roofMat)
  ctx.commands.push(...r.commands)
  const assembly: Assembly = { id: prefix, kind: 'ROOF', name: `${r.classification.toLowerCase()} roof (hypothesis ${h.id})`, evidence: evidence(ctx, h, ps, 'TECHNICAL_GEOMETRY', false, 'roof'), classification: r.classification, planeIds: planes.map((p) => p.id), edgeIds: r.edgeIds, openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: [], quality: 'COMPLETE' }
  ctx.commands.push({ type: 'createAssembly', assembly })
  ctx.log.push({ stage: 'DSL', hypothesisId: h.id, message: `roof ${prefix}: ${planes.length} planes, ${r.edgeIds.length} edges, read as ${r.classification}` })
  return { ok: true, assemblyIds: [prefix], objectIds: [...planes.map((p) => p.id), ...r.edgeIds] }
}

// ---------------------------------------------------------------------------
// DORMER
// ---------------------------------------------------------------------------

export function emitDormer(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[]): EmitOutcome {
  const m = ctx.model
  const cut = ps.find((p) => p.kind === 'ROOF_INTERRUPTION' && p.geometry.type === 'POLYGON')
  if (!cut || cut.geometry.type !== 'POLYGON') return { ok: false, reason: 'no interruption outline to place the dormer' }
  const cutPts = cut.geometry.points
  const centre = { x: cutPts.reduce((a, q) => a + q.x, 0) / cutPts.length, z: cutPts.reduce((a, q) => a + q.z, 0) / cutPts.length }
  const host = m.roofPlanes.find((p) => pointInPolygon(centre, p.boundary) && cutPts.every((q) => Math.abs(roofPlaneTopAt(p, q.x, q.z) - q.y) <= 0.3))
  if (!host) return { ok: false, reason: 'no roof plane in the model carries the interruption: a dormer needs a host roof' }
  const hostRoof = m.assemblies.find((a) => a.kind === 'ROOF' && a.planeIds.includes(host.id))
  ctx.log.push({ stage: 'TOPOLOGY', hypothesisId: h.id, message: `the interruption lies in ${host.id}${hostRoof ? ` (roof ${hostRoof.id})` : ''}` })
  const facades = ps.filter((p) => p.kind === 'VERTICAL_FACADE' && p.geometry.type === 'SEGMENT').sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority) || (a.id < b.id ? -1 : 1))
  const face = facades[0]
  if (!face || face.geometry.type !== 'SEGMENT') return { ok: false, reason: 'no dormer front was measured' }
  let a = plan(face.geometry.start)
  let b = plan(face.geometry.end)
  // the front runs across the slope, left to right looking up it (the dormer layout's frame)
  const u = { x: -host.downslope.z, z: host.downslope.x }
  if ((b.x - a.x) * u.x + (b.z - a.z) * u.z < 0) [a, b] = [b, a]
  const eave = resolve(ctx, h, 'dormer.eaveY', [...facades.map((f) => (f.geometry.type === 'SEGMENT' ? { value: r6((f.geometry.start.y + f.geometry.end.y) / 2), authority: f.authority, sourceId: f.id } : null)).filter((c): c is QuantityCandidate => c !== null), ...printed(ps, 'dormer.eaveY')])
  if (!eave) return { ok: false, reason: 'the dormer eave height is unknown' }
  const lines = ps.filter((p) => p.kind === 'ROOF_LINE' && p.geometry.type === 'SEGMENT')
  const front = unit2({ x: b.x - a.x, z: b.z - a.z }) as Vec2
  const ridges = lines.filter((l) => {
    if (l.geometry.type !== 'SEGMENT') return false
    const d = unit2({ x: l.geometry.end.x - l.geometry.start.x, z: l.geometry.end.z - l.geometry.start.z })
    return d !== null && Math.abs(d.x * front.x + d.z * front.z) < 0.2 && Math.max(l.geometry.start.y, l.geometry.end.y) > eave.value + 0.05
  })
  const localPlane = ps.find((p) => p.kind === 'ROOF_PLANE_REGION')
  let dormerType: 'GABLE' | 'SHED' | 'FLAT' = 'FLAT'
  let ridgeY: number | undefined
  let shedPitchDeg: number | undefined
  if (ridges.length > 0) {
    dormerType = 'GABLE'
    const r = resolve(ctx, h, 'dormer.ridgeY', [...ridges.map((l) => (l.geometry.type === 'SEGMENT' ? { value: r6(Math.max(l.geometry.start.y, l.geometry.end.y)), authority: l.authority, sourceId: l.id } : null)).filter((c): c is QuantityCandidate => c !== null), ...printed(ps, 'dormer.ridgeY')])
    ridgeY = r?.value
  } else if (localPlane && localPlane.geometry.type === 'POLYGON') {
    const n = upwardNormal(localPlane.geometry.points)
    const fitted = n ? (Math.atan2(Math.hypot(n.x, n.z), n.y) * 180) / Math.PI : 0
    if (fitted > 0.5) {
      dormerType = 'SHED'
      shedPitchDeg = resolve(ctx, h, 'dormer.shedPitchDeg', [{ value: r6(fitted), authority: localPlane.authority, sourceId: localPlane.id, tolerance: 0.5 }, ...printed(ps, 'dormer.shedPitchDeg')])?.value
    }
  }
  ctx.log.push({ stage: 'TOPOLOGY', hypothesisId: h.id, message: `dormer type ${dormerType}: ${dormerType === 'GABLE' ? `a roof line runs back from the front above the eave (${ridges.map((l) => l.id).join(', ')})` : dormerType === 'SHED' ? `its own roof region falls to the front (${localPlane?.id})` : 'no ridge or pitched local roof was seen'}` })
  const opening = ps.find((p) => p.kind === 'OPENING' && p.geometry.type === 'POLYGON')
  const frontTop = roofPlaneTopAt(host, (a.x + b.x) / 2, (a.z + b.z) / 2)
  let window: { width: number; height: number; sillAboveRoof: number } | undefined
  if (opening && opening.geometry.type === 'POLYGON') {
    const along = opening.geometry.points.map((q) => (q.x - a.x) * front.x + (q.z - a.z) * front.z)
    const ys = opening.geometry.points.map((q) => q.y)
    window = { width: r6(Math.max(...along) - Math.min(...along)), height: r6(Math.max(...ys) - Math.min(...ys)), sillAboveRoof: r6(Math.max(0.05, Math.min(...ys) - frontTop)) }
  }
  const id = `${ctx.prefix}-${h.id}-dormer`
  const ev = evidence(ctx, h, ps, eave.authority, eave.corroboratedBy.length > 0, 'dormer')
  ctx.commands.push({
    type: 'createDormer',
    id,
    name: `${dormerType.toLowerCase()} dormer (hypothesis ${h.id})`,
    evidence: ev,
    hostPlaneId: host.id,
    ...(hostRoof ? { hostRoofAssemblyId: hostRoof.id } : {}),
    dormerType,
    front: { start: { x: r9(a.x), z: r9(a.z) }, end: { x: r9(b.x), z: r9(b.z) } },
    eaveY: r9(eave.value),
    ...(ridgeY !== undefined ? { ridgeY: r9(ridgeY) } : {}),
    ...(shedPitchDeg !== undefined ? { shedPitchDeg: r9(shedPitchDeg) } : {}),
    ...(host.materialId ? { roofMaterialId: host.materialId } : {}),
    ...(m.walls[0] ? { wallMaterialId: m.walls[0].materialId } : {}),
    ...(window ? { window } : {}),
  })
  ctx.log.push({ stage: 'DSL', hypothesisId: h.id, message: `createDormer ${id} (${dormerType}) on ${host.id}` })
  return { ok: true, assemblyIds: [id], objectIds: [`${id}-cut`, `${id}-front`] }
}

// ---------------------------------------------------------------------------
// PERGOLA / CANOPY / CARPORT — posts, beams and (for the covered two) a cover
// ---------------------------------------------------------------------------

type Post = { id: string; at: Vec2; base: number; top: ResolvedQuantity; size: number; sources: SemanticProposal[] }
type Beam = { id: string; a: Vec2; b: Vec2; centreY: number; height: number; breadth: number; sources: SemanticProposal[] }

/** One member per physical member: observations of the same member in several frames merged, the most authoritative position kept. */
function clusterMembers(ps: readonly SemanticProposal[], kind: 'VERTICAL_MEMBER' | 'HORIZONTAL_MEMBER', reach: number): SemanticProposal[][] {
  const ms = ps.filter((p) => p.kind === kind && p.geometry.type === 'SEGMENT').sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority) || (a.id < b.id ? -1 : 1))
  const clusters: SemanticProposal[][] = []
  const key = (p: SemanticProposal): { m: Vec2; y: number } => (p.geometry.type === 'SEGMENT' ? { m: { x: (p.geometry.start.x + p.geometry.end.x) / 2, z: (p.geometry.start.z + p.geometry.end.z) / 2 }, y: (p.geometry.start.y + p.geometry.end.y) / 2 } : { m: { x: 0, z: 0 }, y: 0 })
  for (const p of ms) {
    const k = key(p)
    const hit = clusters.find((c) => {
      const q = key(c[0])
      return dist2(q.m, k.m) <= reach && (kind === 'VERTICAL_MEMBER' || Math.abs(q.y - k.y) <= reach)
    })
    if (hit) hit.push(p)
    else clusters.push([p])
  }
  return clusters.sort((a, b) => {
    const ka = key(a[0])
    const kb = key(b[0])
    return ka.m.x - kb.m.x || ka.m.z - kb.m.z || ka.y - kb.y
  })
}

export function emitFrame(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[], family: Extract<Family, 'PERGOLA' | 'CANOPY' | 'CARPORT'>): EmitOutcome {
  const m = ctx.model
  const pfx = `${ctx.prefix}-${h.id}`
  const pergola = family === 'PERGOLA'
  const verticals = clusterMembers(ps, 'VERTICAL_MEMBER', 0.15)
  const horizontals = clusterMembers(ps, 'HORIZONTAL_MEMBER', 0.15)
  const coverP = ps.filter((p) => p.kind === 'COVER_SURFACE' && p.geometry.type === 'POLYGON').sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority) || (a.id < b.id ? -1 : 1))[0]
  const allY = ps.flatMap((p) => (p.geometry.type === 'SEGMENT' ? [p.geometry.start.y, p.geometry.end.y] : p.geometry.type === 'POLYGON' ? p.geometry.points.map((q) => q.y) : []))
  const level = levelFor(m, allY.length > 0 ? Math.min(...allY) : 0)
  const memberMat = material(ctx, 'mat-member')

  // --- topology: posts, beams, and which carries which
  const posts: Post[] = verticals.map((c, i) => {
    const g = c[0].geometry as Extract<SemanticProposal['geometry'], { type: 'SEGMENT' }>
    const at = { x: r9((g.start.x + g.end.x) / 2), z: r9((g.start.z + g.end.z) / 2) }
    const ground = groundUnder(m, at, level)
    const top = resolve(ctx, h, `post-${i + 1}.top`, [...c.map((p) => (p.geometry.type === 'SEGMENT' ? { value: r6(Math.max(p.geometry.start.y, p.geometry.end.y)), authority: p.authority, sourceId: p.id } : null)).filter((x): x is QuantityCandidate => x !== null), ...printed(ps, 'post.top'), ...printed(ps, `post-${i + 1}.top`)]) as ResolvedQuantity
    return { id: `${pfx}-post-${i + 1}`, at, base: ground.y, top, size: g.width ?? 0.14, sources: c }
  })
  const beamsRaw: Beam[] = horizontals.map((c, i) => {
    const g = c[0].geometry as Extract<SemanticProposal['geometry'], { type: 'SEGMENT' }>
    return { id: '', a: { x: r9(g.start.x), z: r9(g.start.z) }, b: { x: r9(g.end.x), z: r9(g.end.z) }, centreY: (g.start.y + g.end.y) / 2, height: g.width ?? 0.2, breadth: g.depth ?? 0.12, sources: c, index: i } as Beam & { index: number }
  })
  const onPosts = (bm: Beam): Post[] => posts.filter((p) => pointSegmentDistance2(p.at, bm.a, bm.b) <= bm.breadth / 2 + p.size / 2 + 0.02)
  // the beams that bear on the posts are the lowest tier over them; members above that tier rest on the beams,
  // even where one passes over a post
  const bottom = (bm: Beam): number => bm.centreY - bm.height / 2
  const bearing = beamsRaw.filter((bm) => onPosts(bm).length > 0)
  const lowest = bearing.length > 0 ? Math.min(...bearing.map(bottom)) : Infinity
  const primary = bearing.filter((bm) => bottom(bm) <= lowest + 0.05)
  const secondary = beamsRaw.filter((bm) => !primary.includes(bm))
  primary.forEach((bm, i) => (bm.id = `${pfx}-beam-${i + 1}`))
  secondary.forEach((bm, i) => (bm.id = `${pfx}-${pergola ? 'rafter' : 'secondary'}-${i + 1}`))
  ctx.log.push({ stage: 'TOPOLOGY', hypothesisId: h.id, message: `${posts.length} posts; ${primary.length} beams on posts (${primary.map((bm) => `${bm.id} on ${onPosts(bm).map((p) => p.id).join('+')}`).join('; ') || 'none'}); ${secondary.length} members on the beams` })
  if (posts.length === 0 && family !== 'CANOPY') return { ok: false, reason: 'no support was located' }

  // --- metric solve: one datum for the whole frame. Every member that meets
  // another states the same joint height (post top = beam underside, beam top =
  // cover underside, rafter underside = beam top), so every observed height is
  // a candidate for the one beam-top datum, and the most authoritative decides.
  const primaryHeight = primary[0]?.height ?? 0.2
  let coverThickness = 0
  let coverDrop = 0
  if (coverP && coverP.geometry.type === 'POLYGON') {
    coverThickness = resolve(ctx, h, 'cover.thickness', [...printed(ps, 'cover.thickness'), convention('cover.thickness', 0.12)])?.value ?? 0.12
    const cn = upwardNormal(coverP.geometry.points)
    coverDrop = roofPlaneDrop({ pitchDeg: cn ? (Math.atan2(Math.hypot(cn.x, cn.z), cn.y) * 180) / Math.PI : 0, thickness: coverThickness })
  }
  const datumCandidates: QuantityCandidate[] = [
    ...primary.flatMap((bm) => bm.sources.map((p) => (p.geometry.type === 'SEGMENT' ? { value: r6((p.geometry.start.y + p.geometry.end.y) / 2 + bm.height / 2), authority: p.authority, sourceId: p.id } : null))),
    ...secondary.flatMap((bm) => bm.sources.map((p) => (p.geometry.type === 'SEGMENT' ? { value: r6((p.geometry.start.y + p.geometry.end.y) / 2 - bm.height / 2), authority: p.authority, sourceId: p.id } : null))),
    ...(primary.length > 0 ? posts.flatMap((pt) => pt.sources.map((p) => (p.geometry.type === 'SEGMENT' ? { value: r6(Math.max(p.geometry.start.y, p.geometry.end.y) + primaryHeight), authority: p.authority, sourceId: p.id } : null))) : []),
    ...(coverP && coverP.geometry.type === 'POLYGON' ? [{ value: r6(Math.min(...coverP.geometry.points.map((q) => q.y)) - coverDrop), authority: coverP.authority, sourceId: coverP.id }] : []),
    ...printed(ps, 'beam.top'),
    ...printed(ps, 'post.top').map((c) => ({ ...c, value: r6(c.value + primaryHeight) })),
    ...printed(ps, 'cover.top').map((c) => ({ ...c, value: r6(c.value - coverDrop) })),
  ].filter((x): x is QuantityCandidate => x !== null)
  const datum = primary.length > 0 || coverP ? resolve(ctx, h, 'frame.beamTop', datumCandidates.map((c) => ({ ...c, tolerance: c.tolerance ?? (c.authority === 'PRINTED_DIMENSION' ? 0.01 : 0.03) }))) : null
  const beamTop = datum?.value ?? 0
  const postTop = primary.length > 0 ? r9(beamTop - primaryHeight) : undefined
  const coverTop = datum && coverP ? { ...datum, value: r9(beamTop + coverDrop) } : null

  // --- DSL
  const cmds: Cmd[] = []
  const objectIds: string[] = []
  const rels: Cmd[] = []
  const rel = (kind: Extract<Cmd, { type: 'createRelationship' }>['kind'], from: string, to: string): void => {
    rels.push({ type: 'createRelationship', kind, from, to, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, `${from} ${kind} ${to}`) })
  }
  const role = pergola ? 'PERGOLA_POST' : family === 'CARPORT' ? 'POST' : 'POST'
  for (const p of posts) {
    const top = postTop ?? p.top.value
    cmds.push({ type: 'createColumn', id: p.id, levelId: level.id, role: p.size >= 0.2 && !pergola ? 'COLUMN' : role, base: p.at, baseOffset: r9(p.base - level.elevation), height: r9(top - p.base), width: p.size, depth: p.size, materialId: memberMat, evidence: evidence(ctx, h, p.sources, postTop !== undefined && datum ? datum.authority : p.top.authority, p.sources.length > 1, `post ${p.id}`) })
    objectIds.push(p.id)
    const ground = groundUnder(m, p.at, level)
    if (ground.id) rel('SUPPORTED_BY', p.id, ground.id)
  }
  const extend = (bm: Beam): { a: Vec2; b: Vec2 } => {
    // a beam runs past the posts it rests on by at least half a post, so it bears on their whole top
    const d = unit2({ x: bm.b.x - bm.a.x, z: bm.b.z - bm.a.z }) as Vec2
    const along = (q: Vec2): number => (q.x - bm.a.x) * d.x + (q.z - bm.a.z) * d.z
    const sup = onPosts(bm)
    const lo = Math.min(0, ...sup.map((p) => along(p.at) - p.size / 2))
    const hi = Math.max(along(bm.b), ...sup.map((p) => along(p.at) + p.size / 2))
    return { a: { x: r9(bm.a.x + d.x * lo), z: r9(bm.a.z + d.z * lo) }, b: { x: r9(bm.a.x + d.x * hi), z: r9(bm.a.z + d.z * hi) } }
  }
  for (const bm of primary) {
    const e = extend(bm)
    const y = r9(beamTop - bm.height / 2)
    cmds.push({ type: 'createBeam', id: bm.id, levelId: level.id, role: pergola ? 'PERGOLA_BEAM' : 'BEAM', start: { x: e.a.x, y, z: e.a.z }, end: { x: e.b.x, y, z: e.b.z }, width: bm.height, depth: bm.breadth, materialId: memberMat, evidence: evidence(ctx, h, bm.sources, datum?.authority ?? 'VISUAL_INFERENCE', bm.sources.length > 1, `beam ${bm.id}`) })
    objectIds.push(bm.id)
    for (const p of onPosts(bm)) rel('SUPPORTED_BY', bm.id, p.id)
  }
  for (const bm of secondary) {
    const y = r9(beamTop + bm.height / 2)
    cmds.push({ type: 'createBeam', id: bm.id, levelId: level.id, role: pergola ? 'PERGOLA_BEAM' : 'RAFTER', start: { x: bm.a.x, y, z: bm.a.z }, end: { x: bm.b.x, y, z: bm.b.z }, width: bm.height, depth: bm.breadth, materialId: memberMat, evidence: evidence(ctx, h, bm.sources, datum?.authority ?? 'VISUAL_INFERENCE', bm.sources.length > 1, `member ${bm.id}`) })
    objectIds.push(bm.id)
    for (const pb of primary) {
      const d = unit2({ x: pb.b.x - pb.a.x, z: pb.b.z - pb.a.z }) as Vec2
      const e = unit2({ x: bm.b.x - bm.a.x, z: bm.b.z - bm.a.z }) as Vec2
      // crosses it in plan
      const den = d.x * e.z - d.z * e.x
      if (Math.abs(den) < 1e-6) continue
      const t = ((bm.a.x - pb.a.x) * e.z - (bm.a.z - pb.a.z) * e.x) / den
      const s = ((bm.a.x - pb.a.x) * d.z - (bm.a.z - pb.a.z) * d.x) / den
      const Lp = dist2(pb.a, pb.b)
      const Lb = dist2(bm.a, bm.b)
      if (t >= -0.01 && t <= Lp + 0.01 && s >= -0.01 && s <= Lb + 0.01) rel('SUPPORTED_BY', bm.id, pb.id)
    }
  }

  const assemblyIds: string[] = []
  const missing = [...h.missing]
  if (pergola) {
    const terrace = posts.map((p) => groundUnder(m, p.at, level).id).find((x) => x !== undefined)
    const a: Assembly = { id: `${pfx}-pergola`, kind: 'PERGOLA', name: `pergola (hypothesis ${h.id})`, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'pergola'), postIds: posts.map((p) => p.id), primaryBeamIds: primary.map((b) => b.id), secondaryBeamIds: secondary.map((b) => b.id), ...(terrace ? { slabOrTerraceId: terrace } : {}), coverage: 'OPEN', hostIds: [], quality: missing.length ? 'PARTIAL' : 'COMPLETE', ...(missing.length ? { missing } : {}) }
    ctx.commands.push(...cmds, { type: 'createAssembly', assembly: a }, ...rels)
    assemblyIds.push(a.id)
    ctx.log.push({ stage: 'DSL', hypothesisId: h.id, message: `pergola ${a.id}: ${posts.length} posts, ${primary.length} beams, ${secondary.length} rafters, open (no roof)` })
    return { ok: true, assemblyIds, objectIds }
  }

  // a covered frame: the cover is a roof plane, attached to the facade it abuts
  if (!coverP || coverP.geometry.type !== 'POLYGON' || !coverTop) return { ok: false, reason: 'a covered frame without an observed cover' }
  const pts = coverP.geometry.points.map((q) => ({ ...q }))
  const boundary = pts.map((q) => ({ x: r9(q.x), z: r9(q.z) }))
  let host: Wall | undefined
  let hostEdge: [Vec2, Vec2] | undefined
  for (let i = 0; i < boundary.length && !host; i++) {
    const a = boundary[i]
    const b = boundary[(i + 1) % boundary.length]
    const w = wallsAlong(m, a, b)
    if (w.length > 0) {
      host = w[0]
      hostEdge = [a, b]
    }
  }
  const n = upwardNormal(pts) as Vec3
  const pitchDeg = r9((Math.atan2(Math.hypot(n.x, n.z), n.y) * 180) / Math.PI)
  const flat = pitchDeg < 0.5
  const downslope = flat ? { x: 0, z: -1 } : (unit2({ x: n.x, z: n.z }) as Vec2)
  const low = [...pts].sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z)[0]
  // the cover's low top follows the frame datum, so its underside meets the beams' tops
  const topAtLow = r9(coverTop.value)
  const plane: PlaneSpec = { id: `${pfx}-cover`, levelId: level.id, boundary, datum: { x: r9(low.x), y: topAtLow, z: r9(low.z) }, pitchDeg: flat ? 0 : pitchDeg, downslope: { x: r9(downslope.x), z: r9(downslope.z) }, thickness: coverThickness }
  const roofId = `${pfx}-cover-roof`
  const edges = freeEdges([plane]).map((e) => (hostEdge && dist2(e.a, hostEdge[0]) < 1e-9 && dist2(e.b, hostEdge[1]) < 1e-9 ? { ...e, kind: 'ABUTMENT' as const } : e))
  cmds.push({ type: 'createRoofPlane', id: plane.id, levelId: plane.levelId, boundary: plane.boundary, datum: plane.datum, pitchDeg: plane.pitchDeg, downslope: plane.downslope, thickness: plane.thickness, materialId: material(ctx, 'mat-cover'), evidence: evidence(ctx, h, [coverP], coverTop.authority, coverTop.corroboratedBy.length > 0, 'cover') })
  const edgeIds: string[] = []
  edges.forEach((e, i) => {
    const id = `${pfx}-cover-${e.kind.toLowerCase()}-${i + 1}`
    cmds.push({ type: 'createRoofEdge', id, kind: e.kind, planeId: plane.id, start: e.a, end: e.b, evidence: evidence(ctx, h, [coverP], coverP.authority, false, `cover edge ${i + 1}`) })
    edgeIds.push(id)
  })
  objectIds.push(plane.id, ...edgeIds)
  for (const bm of primary) rel('SUPPORTED_BY', plane.id, bm.id)
  if (host) rel('ATTACHED_TO', plane.id, host.id)
  const covered = [...m.platforms, ...m.terraces].find((f) => f.polygon.some((q) => pointInPolygon(q, boundary)) || boundary.some((q) => pointInPolygon(q, f.polygon)))
  if (covered) rel('COVERS', plane.id, covered.id)
  const roof: Assembly = { id: roofId, kind: 'ROOF', name: `${family.toLowerCase()} cover`, evidence: evidence(ctx, h, [coverP], coverTop.authority, false, 'cover roof'), classification: flat ? 'FLAT' : 'SHED', planeIds: [plane.id], edgeIds, openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: host ? [host.id] : [], quality: 'COMPLETE' }
  const sides = (['MIN_X', 'MAX_X', 'MIN_Z', 'MAX_Z'] as const).filter((s) => !hostEdge || sideOf(boundary, hostEdge[0], hostEdge[1]) !== s)
  const door = host ? m.openings.find((o) => o.wallId === (host as Wall).id && o.kind === 'DOOR') : undefined
  const usage = family === 'CANOPY' ? (!host ? 'SHELTER' : door ? 'ENTRANCE' : 'UNKNOWN') : undefined
  const frame: Assembly =
    family === 'CANOPY'
      ? { id: `${pfx}-canopy`, kind: 'CANOPY', name: `canopy (hypothesis ${h.id})`, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'canopy'), usage: usage as 'ENTRANCE' | 'SHELTER' | 'UNKNOWN', supportIds: posts.map((p) => p.id), beamIds: primary.map((b) => b.id), roofAssemblyId: roofId, openSides: [...sides], hostIds: host ? [host.id] : [], quality: missing.length ? 'PARTIAL' : 'COMPLETE', ...(missing.length ? { missing } : {}) }
      : { id: `${pfx}-carport`, kind: 'CARPORT', name: `carport (hypothesis ${h.id})`, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'carport'), supportIds: posts.map((p) => p.id), beamIds: primary.map((b) => b.id), roofAssemblyId: roofId, openSides: [...sides], hostIds: host ? [host.id] : [], quality: missing.length ? 'PARTIAL' : 'COMPLETE', ...(missing.length ? { missing } : {}) }
  ctx.commands.push(...cmds, { type: 'createAssembly', assembly: roof }, { type: 'createAssembly', assembly: frame }, ...rels)
  assemblyIds.push(roofId, frame.id)
  ctx.log.push({ stage: 'DSL', hypothesisId: h.id, message: `${family.toLowerCase()} ${frame.id}: ${posts.length} posts, ${primary.length} beams, a ${flat ? 'flat' : `${pitchDeg.toFixed(1)}°`} cover${host ? ` attached to ${host.id}` : ', free-standing'}` })
  return { ok: true, assemblyIds, objectIds }
}

// ---------------------------------------------------------------------------
// EXTERIOR STEPS (and the entrance they serve)
// ---------------------------------------------------------------------------

export function emitSteps(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[]): EmitOutcome {
  const m = ctx.model
  const pfx = `${ctx.prefix}-${h.id}`
  const nosings = ps.filter((p) => p.kind === 'STEP_EDGE' && p.geometry.type === 'SEGMENT')
  // one nosing per physical edge: merge the frames' readings of the same line
  const lines: SemanticProposal[][] = []
  for (const p of [...nosings].sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority) || (a.id < b.id ? -1 : 1))) {
    const g = p.geometry as Extract<SemanticProposal['geometry'], { type: 'SEGMENT' }>
    const mid = { x: (g.start.x + g.end.x) / 2, z: (g.start.z + g.end.z) / 2 }
    const hit = lines.find((l) => {
      const q = l[0].geometry as Extract<SemanticProposal['geometry'], { type: 'SEGMENT' }>
      return dist2(mid, { x: (q.start.x + q.end.x) / 2, z: (q.start.z + q.end.z) / 2 }) <= 0.1
    })
    if (hit) hit.push(p)
    else lines.push([p])
  }
  const seg = (l: SemanticProposal[]): Extract<SemanticProposal['geometry'], { type: 'SEGMENT' }> => l[0].geometry as Extract<SemanticProposal['geometry'], { type: 'SEGMENT' }>
  lines.sort((a, b) => (seg(a).start.y + seg(a).end.y) / 2 - (seg(b).start.y + seg(b).end.y) / 2)
  const landingP = ps.filter((p) => p.kind === 'LEVEL_SURFACE' && p.geometry.type === 'POLYGON').sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority))[0]
  if (lines.length === 0 || !landingP || landingP.geometry.type !== 'POLYGON') return { ok: false, reason: 'the steps have no landing to arrive at' }
  const landingPoly = landingP.geometry.points.map((q) => ({ x: r9(q.x), z: r9(q.z) }))
  const level = levelFor(m, Math.min(...landingP.geometry.points.map((q) => q.y)))
  const landingTop = resolve(ctx, h, 'landing.top', [{ value: r6(landingP.geometry.points.reduce((a, q) => a + q.y, 0) / landingP.geometry.points.length), authority: landingP.authority, sourceId: landingP.id }, ...printed(ps, 'landing.top')]) as ResolvedQuantity
  const first = seg(lines[0])
  const nd = unit2({ x: first.end.x - first.start.x, z: first.end.z - first.start.z }) as Vec2
  const cx = landingPoly.reduce((a, q) => a + q.x, 0) / landingPoly.length
  const cz = landingPoly.reduce((a, q) => a + q.z, 0) / landingPoly.length
  let dir = { x: nd.z, z: -nd.x }
  const mid0 = { x: (first.start.x + first.end.x) / 2, z: (first.start.z + first.end.z) / 2 }
  if ((cx - mid0.x) * dir.x + (cz - mid0.z) * dir.z < 0) dir = { x: -dir.x, z: -dir.z }
  const along = (q: Vec2): number => (q.x - mid0.x) * dir.x + (q.z - mid0.z) * dir.z
  // the landing's near edge: where the last tread ends
  const edgeAt = Math.min(...landingPoly.map(along))
  const positions = [...lines.map((l) => along({ x: (seg(l).start.x + seg(l).end.x) / 2, z: (seg(l).start.z + seg(l).end.z) / 2 })), edgeAt]
  const spacings = positions.slice(1).map((v, i) => v - positions[i])
  if (spacings.some((s) => s <= 0.1)) return { ok: false, reason: 'the nosings do not step towards the landing' }
  const going = resolve(ctx, h, 'steps.going', [{ value: r6(spacings.reduce((a, b) => a + b, 0) / spacings.length), authority: [...lines.flat()].sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority))[0].authority, sourceId: lines[0][0].id }, ...printed(ps, 'steps.going')]) as ResolvedQuantity
  const heights = lines.map((l) => (seg(l).start.y + seg(l).end.y) / 2)
  const risesSeen = [...heights.slice(1).map((v, i) => v - heights[i]), landingTop.value - heights[heights.length - 1]]
  const steps = lines.length
  // printed datums at the landing and at the grade state the rise exactly: their difference over the risers
  const grade = [...printed(ps, 'site.grade')].sort((a, b) => authorityRank(a.authority) - authorityRank(b.authority))[0]
  const fromDatums: QuantityCandidate[] = grade && landingTop.authority === 'PRINTED_DIMENSION' ? [{ value: r6((landingTop.value - grade.value) / (steps + 1)), authority: 'PRINTED_DIMENSION', sourceId: `${landingTop.sourceId}−${grade.sourceId}`, tolerance: 0.005 }] : []
  const rise = resolve(ctx, h, 'steps.rise', [{ value: r6(risesSeen.reduce((a, b) => a + b, 0) / risesSeen.length), authority: lines[0][0].authority, sourceId: lines[0][0].id }, ...printed(ps, 'steps.rise'), ...fromDatums]) as ResolvedQuantity
  const base = landingTop.value - (steps + 1) * rise.value
  if (grade) resolve(ctx, h, 'steps.base', [{ value: r6(base), authority: rise.authority, sourceId: rise.sourceId }, grade])
  const width = resolve(ctx, h, 'steps.width', [{ value: r6(dist2(plan(first.start), plan(first.end))), authority: lines[0][0].authority, sourceId: lines[0][0].id }, ...printed(ps, 'steps.width')]) as ResolvedQuantity
  // the run's start: the end of the first riser line from which `width` extends to the right of the direction
  const right = { x: dir.z, z: -dir.x }
  const ends = [plan(first.start), plan(first.end)]
  const startPt = ends.sort((a, b) => (a.x - mid0.x) * right.x + (a.z - mid0.z) * right.z - ((b.x - mid0.x) * right.x + (b.z - mid0.z) * right.z))[0]
  const startAtRiser = { x: r9(startPt.x), z: r9(startPt.z) }
  ctx.log.push({ stage: 'TOPOLOGY', hypothesisId: h.id, message: `${steps} nosing${steps > 1 ? 's' : ''} climbing towards ${landingP.id}: ${steps} steps of ${r6(rise.value)} m over ${r6(going.value)} m goings` })

  const landingId = `${pfx}-landing`
  const runId = `${pfx}-steps`
  const paving = material(ctx, 'mat-exterior-paving')
  // the landing stands against the facade it serves
  let host: Wall | undefined
  for (let i = 0; i < landingPoly.length && !host; i++) host = wallsAlong(m, landingPoly[i], landingPoly[(i + 1) % landingPoly.length])[0]
  const cmds: Cmd[] = [
    { type: 'createPlatform', id: landingId, levelId: level.id, role: 'LANDING', polygon: landingPoly, topOffset: r9(landingTop.value - level.elevation), thickness: r9(landingTop.value - base), hostWallIds: host ? [host.id] : [], materialId: paving, evidence: evidence(ctx, h, [landingP], landingTop.authority, landingTop.corroboratedBy.length > 0, 'landing') },
    { type: 'createStepRun', id: runId, levelId: level.id, role: 'ENTRANCE_STEPS', start: startAtRiser, direction: { x: r9(dir.x), z: r9(dir.z) }, width: r9(width.value), steps, going: r9(going.value), rise: r9(rise.value), baseOffset: r9(base - level.elevation), materialId: paving, evidence: evidence(ctx, h, lines.flat(), rise.authority, rise.corroboratedBy.length > 0, 'steps') },
  ]
  const rels: Cmd[] = [{ type: 'createRelationship', kind: 'TERMINATES_AT', from: runId, to: landingId, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'steps arrive at the landing') }]
  if (host) rels.push({ type: 'createRelationship', kind: 'ATTACHED_TO', from: landingId, to: host.id, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'landing against the facade') })
  const stair: Assembly = { id: `${pfx}-exterior-stair`, kind: 'EXTERIOR_STAIR', name: `exterior steps (hypothesis ${h.id})`, evidence: evidence(ctx, h, ps, rise.authority, false, 'exterior stair'), stepRunIds: [runId], landingIds: [landingId], railingIds: [], hostIds: host ? [host.id] : [], quality: h.missing.length ? 'PARTIAL' : 'COMPLETE', ...(h.missing.length ? { missing: [...h.missing] } : {}) }
  const assemblies: Assembly[] = [stair]
  // the entrance: the door in that facade over the landing
  const door = host
    ? m.doors.find((d) => {
        const o = m.openings.find((x) => x.id === d.openingId)
        if (!o || o.wallId !== (host as Wall).id) return false
        const w = host as Wall
        const L = dist2(w.start, w.end)
        const u = { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
        const at = (q: Vec2): number => (q.x - w.start.x) * u.x + (q.z - w.start.z) * u.z
        const lo = Math.min(...landingPoly.map(at))
        const hi = Math.max(...landingPoly.map(at))
        return o.offset >= lo - 1e-6 && o.offset + o.width <= hi + 1e-6
      })
    : undefined
  if (door) {
    assemblies.push({ id: `${pfx}-entrance`, kind: 'ENTRANCE', name: `entrance (hypothesis ${h.id})`, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'entrance'), doorId: door.id, landingId, stepRunIds: [runId], supportIds: [], railingIds: [], hostIds: host ? [host.id] : [], quality: 'COMPLETE' })
    rels.push({ type: 'createRelationship', kind: 'OPENS_INTO', from: door.id, to: landingId, evidence: evidence(ctx, h, ps, 'CROSS_VIEW', false, 'the door opens onto the landing') })
  }
  ctx.commands.push(...cmds, ...assemblies.map((a): Cmd => ({ type: 'createAssembly', assembly: a })), ...rels)
  ctx.log.push({ stage: 'DSL', hypothesisId: h.id, message: `exterior steps ${runId} up to ${landingId}${door ? `, the entrance of ${door.id}` : ''}` })
  return { ok: true, assemblyIds: assemblies.map((a) => a.id), objectIds: [landingId, runId] }
}

// ---------------------------------------------------------------------------
// UNKNOWN
// ---------------------------------------------------------------------------

const planar = (pts: readonly Vec3[]): boolean => {
  const n = upwardNormal(pts)
  if (!n) return false
  const o = pts[0]
  return pts.every((q) => Math.abs((q.x - o.x) * n.x + (q.y - o.y) * n.y + (q.z - o.z) * n.z) <= 1e-3)
}

export function emitUnknown(ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[]): EmitOutcome {
  const m = ctx.model
  const spatial = ps.filter((p) => p.geometry.type !== 'VALUE')
  const box = boxOf(spatial)
  if (!box) return { ok: false, reason: 'nothing located' }
  type Observed = Extract<Assembly, { kind: 'UNKNOWN' }>['observedPlanesOrSegments'][number]
  const r3 = (q: Vec3): Vec3 => ({ x: r9(q.x), y: r9(q.y), z: r9(q.z) })
  const observed: Observed[] = spatial.flatMap((p): Observed[] => {
    if (p.geometry.type === 'POLYGON') return planar(p.geometry.points) ? [{ kind: 'PLANE', outline: p.geometry.points.map(r3) }] : []
    if (p.geometry.type === 'SEGMENT') return [{ kind: 'SEGMENT', start: r3(p.geometry.start), end: r3(p.geometry.end) }]
    return []
  })
  const topology = observed.some((o) => o.kind === 'PLANE') ? 'PLANAR' : observed.length > 0 ? 'LINEAR' : 'UNKNOWN'
  const centre = { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 }
  const hostPlane = m.roofPlanes.find((p) => pointInPolygon(centre, p.boundary) && Math.abs(roofPlaneTopAt(p, centre.x, centre.z) - (box.min.y + box.max.y) / 2) <= 1.5)
  const frames = [...new Set(ps.map((p) => p.sourceFrameId))].sort()
  const pad = 1e-3
  const id = `${ctx.prefix}-${h.id}-unknown`
  const a: Assembly = {
    id,
    kind: 'UNKNOWN',
    name: `unclassified feature (hypothesis ${h.id})`,
    evidence: { ...evidence(ctx, h, ps, 'VISUAL_INFERENCE', false, 'unknown feature'), status: 'VISUAL_INFERRED' },
    hostIds: hostPlane ? [hostPlane.id] : [],
    sourceEvidenceIds: frames.map((f) => frameSource(ctx, ps, f)),
    metricExtent: { min: { x: r9(box.min.x - pad), y: r9(box.min.y - pad), z: r9(box.min.z - pad) }, max: { x: r9(box.max.x + pad), y: r9(box.max.y + pad), z: r9(box.max.z + pad) } },
    approximateTopology: topology,
    observedPlanesOrSegments: observed,
    unresolvedReason: h.reasons.join('; '),
    alternatives: h.alternatives.slice(0, 4),
    quality: 'FRAGMENTARY',
  }
  ctx.commands.push({ type: 'createAssembly', assembly: a })
  ctx.log.push({ stage: 'DSL', hypothesisId: h.id, message: `unknown assembly ${id}: ${observed.length} observed pieces, ${a.alternatives?.length ?? 0} alternatives` })
  return { ok: true, assemblyIds: [id], objectIds: [] }
}

export const EMITTERS: Record<Family, (ctx: EmitContext, h: Hypothesis, ps: readonly SemanticProposal[]) => EmitOutcome> = {
  ROOF: emitRoof,
  DORMER: emitDormer,
  PERGOLA: (c, h, ps) => emitFrame(c, h, ps, 'PERGOLA'),
  CANOPY: (c, h, ps) => emitFrame(c, h, ps, 'CANOPY'),
  CARPORT: (c, h, ps) => emitFrame(c, h, ps, 'CARPORT'),
  EXTERIOR_STEPS: emitSteps,
}
