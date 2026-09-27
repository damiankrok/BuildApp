/**
 * ROOF GRAPH export: the machine-readable, debuggable view of every roof in a
 * model — planes (pitch, normal, fall, datum, support area), ridges, hips,
 * valleys, verges, eaves, steps, boundaries, fasciae, openings, dormers,
 * chimneys, unknown sub-assemblies, source evidence and quality.
 *
 * Roof assemblies are read as they are. A legacy rectangular Roof (the form
 * the production analyzer still emits) has no plane records; its plane
 * graph is DERIVED here from its parameters, with the same arithmetic the
 * compiler uses, and marked `source: 'LEGACY_ROOF'` — so the real regression
 * projects get a roof graph too, without the model being said to hold one.
 *
 * `derivedClassification` reads a label off the graph's structure. It is a
 * description, checked against the stated one; it is never used to build.
 */
import {
  polygonArea,
  roofPlaneNormal,
  roofOpeningOutline,
  type Assembly,
  type AssemblyOf,
  type CanonicalBuildingModel,
  type EvidenceStatus,
  type Roof,
  type RoofClassification,
  type RoofEdgeKind,
  type RoofPlane,
  type Vec2,
  type Vec3,
} from '@buildapp/model'

type EvidenceSummary = { status?: EvidenceStatus; confidence?: number; sourceIds: string[] }
const evidenceOf = (o: { evidence?: { status?: EvidenceStatus; confidence?: number; sourceIds?: string[] } }): EvidenceSummary => ({ status: o.evidence?.status, confidence: o.evidence?.confidence, sourceIds: o.evidence?.sourceIds ?? [] })

export type RoofGraphPlane = { id: string; pitchDeg: number; normal: Vec3; downslope: Vec2; datum: Vec3; planArea: number; boundary: Vec2[]; thickness: number; evidence: EvidenceSummary }
export type RoofGraphEdge = { id: string; kind: RoofEdgeKind; planeIds: string[]; start: Vec3; end: Vec3; length: number; evidence: EvidenceSummary }

export type RoofGraph = {
  id: string
  source: 'ROOF_ASSEMBLY' | 'LEGACY_ROOF'
  /** Stated classification (an assembly's) or, for a legacy roof, its kind. */
  classification: RoofClassification
  derivedClassification: RoofClassification
  quality: string
  planes: RoofGraphPlane[]
  ridges: RoofGraphEdge[]
  hips: RoofGraphEdge[]
  valleys: RoofGraphEdge[]
  verges: RoofGraphEdge[]
  eaves: RoofGraphEdge[]
  steps: RoofGraphEdge[]
  boundaries: RoofGraphEdge[]
  fasciae: Array<{ id: string; hostEdgeId?: string; role: string }>
  openings: Array<{ id: string; kind: string; planeId: string; outline: Vec2[] }>
  dormers: Array<{ id: string; dormerType: string; hostPlaneIds: string[]; localRoofAssemblyId?: string; quality: string; valleys: string[] }>
  chimneys: string[]
  unknownSubassemblies: Array<{ id: string; unresolvedReason: string; alternatives: string[] }>
  /** Typed relationships that involve the roof's planes or edges. */
  relationships: Array<{ id: string; kind: string; from: string; to: string }>
  /** For a dormer's local roof: the dormer. */
  localRoofOf?: string
  evidence: EvidenceSummary
}

const len3 = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
const round = (v: number): number => Math.round(v * 1e6) / 1e6
const r3 = (p: Vec3): Vec3 => ({ x: round(p.x), y: round(p.y), z: round(p.z) })
const r2 = (p: Vec2): Vec2 => ({ x: round(p.x), z: round(p.z) })

function planeEntry(p: RoofPlane): RoofGraphPlane {
  const n = roofPlaneNormal(p)
  return { id: p.id, pitchDeg: round(p.pitchDeg), normal: r3(n), downslope: r2(p.downslope), datum: r3(p.datum), planArea: round(polygonArea(p.boundary)), boundary: p.boundary.map(r2), thickness: p.thickness, evidence: evidenceOf(p) }
}

/** A descriptive label read off the graph's structure. */
export function classifyRoofGraph(g: { planes: ReadonlyArray<{ pitchDeg: number }>; ridges: readonly unknown[]; hips: readonly unknown[]; valleys: readonly unknown[]; steps: readonly unknown[] }): RoofClassification {
  const pitched = g.planes.filter((p) => p.pitchDeg > 0)
  if (g.planes.length === 0) return 'UNKNOWN'
  if (g.steps.length > 0) return 'STEPPED'
  if (pitched.length === 0) return 'FLAT'
  if (g.valleys.length > 0) return 'INTERSECTING'
  if (g.hips.length > 0) return 'HIP'
  if (pitched.length === 1 && g.planes.length === 1) return 'SHED'
  if (pitched.length === 2 && g.planes.length === 2 && g.ridges.length === 1) return 'GABLE'
  return 'COMPOSITE'
}

/** The roof graph of one roof assembly. Edges joining one of its planes to another assembly's (a dormer's valleys) are listed with that dormer, not as the host's own. */
export function roofAssemblyGraph(m: CanonicalBuildingModel, a: AssemblyOf<'ROOF'>): RoofGraph {
  const planes = a.planeIds.map((id) => m.roofPlanes.find((p) => p.id === id)).filter((p): p is RoofPlane => p !== undefined)
  const own = new Set(a.planeIds)
  const edges = m.roofEdges.filter((e) => a.edgeIds.includes(e.id))
  const entry = (e: (typeof m.roofEdges)[number]): RoofGraphEdge => ({ id: e.id, kind: e.kind, planeIds: [...e.planeIds], start: r3(e.start), end: r3(e.end), length: round(len3(e.start, e.end)), evidence: evidenceOf(e) })
  const internal = edges.filter((e) => e.planeIds.every((p) => own.has(p)))
  const byKind = (k: RoofEdgeKind): RoofGraphEdge[] => internal.filter((e) => e.kind === k).map(entry)
  const dormers = a.dormerIds.map((id) => m.assemblies.find((x) => x.id === id)).filter((d): d is AssemblyOf<'DORMER'> => d?.kind === 'DORMER')
  const localRoofOf = m.assemblies.find((d) => d.kind === 'DORMER' && d.localRoofAssemblyId === a.id)?.id
  const touches = new Set([...a.planeIds, ...a.edgeIds, a.id])
  const graph: RoofGraph = {
    id: a.id,
    source: 'ROOF_ASSEMBLY',
    classification: a.classification,
    derivedClassification: 'UNKNOWN',
    quality: a.quality,
    planes: planes.map(planeEntry),
    ridges: byKind('RIDGE'),
    hips: byKind('HIP'),
    valleys: byKind('VALLEY'),
    verges: byKind('VERGE'),
    eaves: byKind('EAVE'),
    steps: byKind('ROOF_STEP'),
    boundaries: [...byKind('BOUNDARY'), ...byKind('ABUTMENT')],
    fasciae: a.trimIds.map((id) => ({ id, hostEdgeId: m.linearSolids.find((s) => s.id === id)?.hostId, role: m.linearSolids.find((s) => s.id === id)?.role ?? m.wallPanels.find((p) => p.id === id)?.role ?? 'TRIM' })),
    openings: a.openingIds.map((id) => m.roofOpenings.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => o !== undefined).map((o) => ({ id: o.id, kind: o.kind, planeId: o.roofId, outline: roofOpeningOutline(o).map(r2) })),
    dormers: dormers.map((d) => {
      const local = m.assemblies.find((x) => x.id === d.localRoofAssemblyId)
      const localEdges = local?.kind === 'ROOF' ? local.edgeIds : []
      return { id: d.id, dormerType: d.dormerType, hostPlaneIds: d.hostPlaneIds, localRoofAssemblyId: d.localRoofAssemblyId, quality: d.quality, valleys: localEdges.filter((id) => m.roofEdges.find((e) => e.id === id)?.kind === 'VALLEY') }
    }),
    chimneys: [...a.chimneyIds],
    unknownSubassemblies: m.assemblies
      .filter((u): u is AssemblyOf<'UNKNOWN'> => u.kind === 'UNKNOWN' && u.hostIds.some((h) => touches.has(h)))
      .map((u) => ({ id: u.id, unresolvedReason: u.unresolvedReason, alternatives: (u.alternatives ?? []).map((x) => `${x.kind}:${x.confidence}`) })),
    relationships: m.relationships.filter((r) => touches.has(r.from) || touches.has(r.to)).map((r) => ({ id: r.id, kind: r.kind, from: r.from, to: r.to })),
    ...(localRoofOf ? { localRoofOf } : {}),
    evidence: evidenceOf(a),
  }
  graph.derivedClassification = classifyRoofGraph(graph)
  return graph
}

/**
 * The plane graph a legacy rectangular Roof stands for, derived from its
 * parameters exactly as the compiler builds its top surface: a GABLE is two
 * planes over the covered rectangle meeting at the ridge through the
 * footprint's middle, with an eave on each long side and a verge on each
 * rake; a FLAT roof is one level plane with four boundary edges.
 */
export function legacyRoofGraph(m: CanonicalBuildingModel, roof: Roof): RoofGraph {
  const level = m.levels.find((l) => l.id === roof.levelId)
  const elevation = level?.elevation ?? 0
  const f = roof.footprint
  const o = roof.overhang
  const c = { minX: f.minX - o, maxX: f.maxX + o, minZ: f.minZ - o, maxZ: f.maxZ + o }
  const eaveY = elevation + roof.eaveOffset
  const ev = evidenceOf(roof)
  const planes: RoofGraphPlane[] = []
  const edges: RoofGraphEdge[] = []
  const edge = (id: string, kind: RoofEdgeKind, planeIds: string[], a: Vec3, b: Vec3): void => {
    edges.push({ id, kind, planeIds, start: r3(a), end: r3(b), length: round(len3(a, b)), evidence: ev })
  }
  if (roof.kind === 'FLAT') {
    const id = `${roof.id}:plane`
    const p: RoofPlane = { id, levelId: roof.levelId, boundary: [{ x: c.minX, z: c.minZ }, { x: c.maxX, z: c.minZ }, { x: c.maxX, z: c.maxZ }, { x: c.minX, z: c.maxZ }], datum: { x: c.minX, y: eaveY, z: c.minZ }, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: roof.thickness }
    planes.push({ ...planeEntry(p), evidence: ev })
    const corners = p.boundary.map((q) => ({ x: q.x, y: eaveY, z: q.z }))
    for (let i = 0; i < 4; i++) edge(`${roof.id}:edge-${i}`, 'BOUNDARY', [id], corners[i], corners[(i + 1) % 4])
  } else {
    const t = Math.tan((roof.pitchDeg * Math.PI) / 180)
    const alongX = roof.ridgeAxis === 'X'
    const cross0 = alongX ? c.minZ : c.minX
    const cross1 = alongX ? c.maxZ : c.maxX
    const along0 = alongX ? c.minX : c.minZ
    const along1 = alongX ? c.maxX : c.maxZ
    const mid = alongX ? (f.minZ + f.maxZ) / 2 : (f.minX + f.maxX) / 2
    const half = alongX ? (f.maxZ - f.minZ) / 2 : (f.maxX - f.minX) / 2
    const topAtCross = (cross: number): number => eaveY + (half - Math.abs(cross - mid)) * t
    const P = (along: number, cross: number): Vec3 => (alongX ? { x: along, y: topAtCross(cross), z: cross } : { x: cross, y: topAtCross(cross), z: along })
    const P2 = (along: number, cross: number): Vec2 => (alongX ? { x: along, z: cross } : { x: cross, z: along })
    const a = `${roof.id}:plane-low`
    const b = `${roof.id}:plane-high`
    const mk = (id: string, c0: number, c1: number, down: Vec2, datumCross: number): RoofPlane => ({ id, levelId: roof.levelId, boundary: [P2(along0, c0), P2(along1, c0), P2(along1, c1), P2(along0, c1)], datum: P(along0, datumCross), pitchDeg: roof.pitchDeg, downslope: down, thickness: roof.thickness })
    const pa = mk(a, cross0, mid, alongX ? { x: 0, z: -1 } : { x: -1, z: 0 }, cross0)
    const pb = mk(b, mid, cross1, alongX ? { x: 0, z: 1 } : { x: 1, z: 0 }, cross1)
    planes.push({ ...planeEntry(pa), evidence: ev }, { ...planeEntry(pb), evidence: ev })
    edge(`${roof.id}:ridge`, 'RIDGE', [a, b], P(along0, mid), P(along1, mid))
    edge(`${roof.id}:eave-low`, 'EAVE', [a], P(along0, cross0), P(along1, cross0))
    edge(`${roof.id}:eave-high`, 'EAVE', [b], P(along0, cross1), P(along1, cross1))
    edge(`${roof.id}:verge-low-start`, 'VERGE', [a], P(along0, cross0), P(along0, mid))
    edge(`${roof.id}:verge-low-end`, 'VERGE', [a], P(along1, cross0), P(along1, mid))
    edge(`${roof.id}:verge-high-start`, 'VERGE', [b], P(along0, mid), P(along0, cross1))
    edge(`${roof.id}:verge-high-end`, 'VERGE', [b], P(along1, mid), P(along1, cross1))
  }
  const kinds = (k: RoofEdgeKind): RoofGraphEdge[] => edges.filter((e) => e.kind === k)
  const openings = m.roofOpenings.filter((x) => x.roofId === roof.id)
  const graph: RoofGraph = {
    id: roof.id,
    source: 'LEGACY_ROOF',
    classification: roof.kind === 'FLAT' ? 'FLAT' : 'GABLE',
    derivedClassification: 'UNKNOWN',
    quality: 'DERIVED',
    planes,
    ridges: kinds('RIDGE'),
    hips: [],
    valleys: [],
    verges: kinds('VERGE'),
    eaves: kinds('EAVE'),
    steps: [],
    boundaries: kinds('BOUNDARY'),
    fasciae: [
      ...(roof.edgeMembers?.fascia?.sides ?? []).map((s) => ({ id: `${roof.id}:fascia-${s.toLowerCase().replace('_', '-')}`, role: 'FASCIA' })),
      ...(roof.edgeMembers?.verge ? [{ id: `${roof.id}:verge`, role: 'VERGE_BOARD' }] : []),
    ],
    openings: openings.map((x) => ({ id: x.id, kind: x.kind, planeId: roof.id, outline: roofOpeningOutline(x).map(r2) })),
    dormers: [],
    chimneys: openings.filter((x) => x.throughId).map((x) => x.throughId as string),
    unknownSubassemblies: [],
    relationships: m.relationships.filter((r) => r.from === roof.id || r.to === roof.id).map((r) => ({ id: r.id, kind: r.kind, from: r.from, to: r.to })),
    evidence: ev,
  }
  graph.derivedClassification = classifyRoofGraph(graph)
  return graph
}

/** Every roof graph of a model: its roof assemblies (dormers' local roofs included), then its legacy roofs, by id. */
export function roofGraphsOf(m: CanonicalBuildingModel): RoofGraph[] {
  const assemblies = [...m.assemblies].filter((a): a is AssemblyOf<'ROOF'> => a.kind === 'ROOF').sort((a, b) => (a.id < b.id ? -1 : 1))
  const legacy = [...m.roofs].sort((a, b) => (a.id < b.id ? -1 : 1))
  return [...assemblies.map((a) => roofAssemblyGraph(m, a)), ...legacy.map((r) => legacyRoofGraph(m, r))]
}

/** Planes in the model that belong to no roof assembly: a plane graph with no roof around it. */
export const orphanRoofPlanes = (m: CanonicalBuildingModel): string[] => {
  const owned = new Set(m.assemblies.flatMap((a: Assembly) => (a.kind === 'ROOF' ? a.planeIds : [])))
  return m.roofPlanes.filter((p) => !owned.has(p.id)).map((p) => p.id)
}
