/**
 * The PRIMITIVE REGISTRY: the architectural vocabulary, and where each word
 * lives in the CanonicalBuildingModel.
 *
 * A primitive is the smallest semantic thing a building is made of — a wall,
 * a post, a ridge, a step. Most are existing model records (a Wall is a
 * `wall`); several are one record read by its role (a Column is a
 * `linearSolid` whose role is COLUMN; a Valley is a `roofEdge` of kind
 * VALLEY); a few are stable parts of a record (step `k` of an exterior step
 * run is `<run>:step-<k>`; flight `i` of a stair is `<stair>:flight-<i>`).
 * Nothing here invents an object: `primitivesOf` reads a model and says what
 * each of its objects IS in this vocabulary, with the five things every
 * primitive keeps — a stable id, its source lineage, its quality and
 * confidence, its metric geometry, and its host and relationships.
 */
import {
  assembliesContaining,
  type CanonicalBuildingModel,
  type EvidenceStatus,
  type SemanticKind,
} from '@buildapp/model'

export const PRIMITIVE_TYPES = [
  'Wall',
  'Slab',
  'Column',
  'Post',
  'Beam',
  'Lintel',
  'Parapet',
  'SurfaceRegion',
  'Opening',
  'Window',
  'Door',
  'GarageDoor',
  'RoofOpening',
  'RoofPlane',
  'Ridge',
  'HipEdge',
  'Valley',
  'Verge',
  'Eave',
  'Fascia',
  'RoofStep',
  'RoofBoundary',
  'Step',
  'ExteriorStepRun',
  'StairFlight',
  'Landing',
  'Ramp',
  'RailingRun',
  'Guard',
  'Handrail',
  'TerraceSurface',
  'BalconySlab',
  'PergolaBeam',
  'PergolaPost',
] as const
export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number]

export type PrimitiveEntry = {
  type: PrimitiveType
  /** The model kind that holds it. */
  kind: SemanticKind
  /** How it is told apart within that kind, in words: the field or role that makes it this primitive. */
  selector: string
  /** Its metric geometry, as the model states it. */
  geometry: string
  /** Where its host and relationships live. */
  host: string
  /** The model schema version from which it is representable. */
  since: string
}

export const PRIMITIVE_REGISTRY: readonly PrimitiveEntry[] = [
  { type: 'Wall', kind: 'wall', selector: 'any wall; also a wall panel of role DORMER_CHEEK, GABLE_INFILL, UPSTAND, KNEE_WALL, SCREEN or UNKNOWN_PANEL', geometry: 'outer-face line, thickness, height and top profile (a panel: bottom and top polylines)', host: 'levelId; junctions and rings; panel hostId; relationships', since: '1.0.0' },
  { type: 'Slab', kind: 'slab', selector: 'any slab', geometry: 'plan polygon with holes, top offset, thickness', host: 'levelId; relationships', since: '1.0.0' },
  { type: 'Column', kind: 'linearSolid', selector: 'role COLUMN', geometry: 'vertical centreline, rectangular section', host: 'hostId; SUPPORTED_BY relationships', since: '1.6.0' },
  { type: 'Post', kind: 'linearSolid', selector: 'role POST', geometry: 'vertical centreline, rectangular section', host: 'hostId; SUPPORTED_BY relationships', since: '1.6.0' },
  { type: 'Beam', kind: 'linearSolid', selector: 'role BEAM or RAFTER', geometry: 'centreline, rectangular section', host: 'hostId; SUPPORTED_BY relationships', since: '1.6.0' },
  { type: 'Lintel', kind: 'linearSolid', selector: 'role LINTEL', geometry: 'level centreline over an opening, rectangular section', host: 'hostId (the wall)', since: '1.6.0' },
  { type: 'Parapet', kind: 'wallPanel', selector: 'role PARAPET', geometry: 'outer-face line, thickness, bottom and top polylines', host: 'hostId (the wall below); SUPPORTED_BY the roof plane', since: '1.6.0' },
  { type: 'SurfaceRegion', kind: 'surfaceRegion', selector: 'any surface region', geometry: 'wall-local rectangle on one face (no thickness)', host: 'hostId (the wall)', since: '1.3.0' },
  { type: 'Opening', kind: 'opening', selector: 'any wall opening', geometry: 'offset, sill, width, height, head, leaves', host: 'wallId (and leaf walls)', since: '1.0.0' },
  { type: 'Window', kind: 'window', selector: 'any window', geometry: 'frame and glazing in its opening', host: 'openingId', since: '1.0.0' },
  { type: 'Door', kind: 'door', selector: 'a door that is not a garage door', geometry: 'frame, leaf or panel assembly in its opening', host: 'openingId; OPENS_INTO relationships', since: '1.0.0' },
  { type: 'GarageDoor', kind: 'door', selector: 'usage GARAGE, or an assembly of PANEL panels only', geometry: 'frame and panels in its opening', host: 'openingId', since: '1.0.0' },
  { type: 'RoofOpening', kind: 'roofOpening', selector: 'any roof opening (rooflight, penetration, dormer cut)', geometry: 'plan rectangle or outline, cut mode', host: 'roofId (a roof or a roof plane); throughId', since: '1.2.0' },
  { type: 'RoofPlane', kind: 'roofPlane', selector: 'any roof plane', geometry: 'support polygon, datum, pitch, downslope, thickness', host: 'levelId; roof edges; SUPPORTED_BY relationships', since: '1.6.0' },
  { type: 'Ridge', kind: 'roofEdge', selector: 'kind RIDGE', geometry: 'world segment on both planes', host: 'planeIds (two)', since: '1.6.0' },
  { type: 'HipEdge', kind: 'roofEdge', selector: 'kind HIP', geometry: 'world segment on both planes', host: 'planeIds (two)', since: '1.6.0' },
  { type: 'Valley', kind: 'roofEdge', selector: 'kind VALLEY', geometry: 'world segment on both planes', host: 'planeIds (two)', since: '1.6.0' },
  { type: 'Verge', kind: 'roofEdge', selector: 'kind VERGE', geometry: 'world segment on its plane', host: 'planeIds (one); a board hosted on it', since: '1.6.0' },
  { type: 'Eave', kind: 'roofEdge', selector: 'kind EAVE', geometry: 'world segment on its plane', host: 'planeIds (one); a fascia hosted on it', since: '1.6.0' },
  { type: 'Fascia', kind: 'linearSolid', selector: 'role FASCIA or VERGE_BOARD (and a legacy roof\'s edge members, as `<roof>:fascia-<side>` / `<roof>:verge-<side>`)', geometry: 'board along an edge, rectangular section', host: 'hostId (the roof edge)', since: '1.5.0' },
  { type: 'RoofStep', kind: 'roofEdge', selector: 'kind ROOF_STEP', geometry: 'world segment on the upper plane', host: 'planeIds (upper, lower)', since: '1.6.0' },
  { type: 'RoofBoundary', kind: 'roofEdge', selector: 'kind BOUNDARY or ABUTMENT', geometry: 'world segment on its plane', host: 'planeIds (one); the wall it abuts', since: '1.6.0' },
  { type: 'Step', kind: 'stepRun', selector: 'step k of an exterior step run: `<run>:step-<k>`', geometry: 'tread k·going along the run, k·rise above its base', host: 'its step run', since: '1.6.0' },
  { type: 'ExteriorStepRun', kind: 'stepRun', selector: 'any step run', geometry: 'first riser line, direction, width, steps × going × rise', host: 'levelId; TERMINATES_AT relationships', since: '1.6.0' },
  { type: 'StairFlight', kind: 'stair', selector: 'flight i of a FLIGHTS stair: `<stair>:flight-<i>`', geometry: 'risers × going, laid out by layoutStair', host: 'its stair (levelId → toLevelId)', since: '1.3.0' },
  { type: 'Landing', kind: 'platform', selector: 'a platform of role LANDING or PORCH (and a stair LANDING segment, `<stair>:landing-<i>`)', geometry: 'plan polygon, top offset, thickness', host: 'levelId; hostWallIds; relationships', since: '1.6.0' },
  { type: 'Ramp', kind: 'platform', selector: 'role RAMP', geometry: 'plan polygon, top plane falling along its slope', host: 'levelId; hostWallIds', since: '1.6.0' },
  { type: 'RailingRun', kind: 'railing', selector: 'a railing without a GUARD or HANDRAIL role', geometry: 'plan polyline, base, height, infill', host: 'hostId (what it guards)', since: '1.0.0' },
  { type: 'Guard', kind: 'railing', selector: 'role GUARD or BALUSTRADE', geometry: 'plan polyline, base, height, infill', host: 'hostId; GUARDS relationships', since: '1.6.0' },
  { type: 'Handrail', kind: 'railing', selector: 'role HANDRAIL', geometry: 'plan polyline, base, height', host: 'hostId; relationships', since: '1.6.0' },
  { type: 'TerraceSurface', kind: 'terrace', selector: 'any terrace (and a balcony record of kind TERRACE)', geometry: 'plan polygon, top offset, thickness, surface, edge', host: 'levelId; hostWallIds', since: '1.5.0' },
  { type: 'BalconySlab', kind: 'balcony', selector: 'a balcony record of kind BALCONY or LOGGIA', geometry: 'plan rectangle, top offset, thickness', host: 'levelId; railings guarding it', since: '1.0.0' },
  { type: 'PergolaBeam', kind: 'linearSolid', selector: 'role PERGOLA_BEAM', geometry: 'level centreline, rectangular section', host: 'SUPPORTED_BY its posts or primary beams', since: '1.6.0' },
  { type: 'PergolaPost', kind: 'linearSolid', selector: 'role PERGOLA_POST', geometry: 'vertical centreline, rectangular section', host: 'SUPPORTED_BY the terrace or ground', since: '1.6.0' },
]

/** One primitive found in a model: what it is, and the five things every primitive keeps. */
export type PrimitiveRecord = {
  type: PrimitiveType
  /** The stable semantic id: the object's own id, or a stable sub-id of it (`<run>:step-2`). */
  id: string
  /** The model object it is, or is part of. */
  objectId: string
  kind: SemanticKind
  lineage: { status?: EvidenceStatus; source?: string; locator?: string; sourceIds: string[] }
  confidence?: number
  /** Its host, when its record names one. */
  hostId?: string
  /** Typed relationships it takes part in, as `KIND→to` / `from→KIND`. */
  relationships: string[]
  /** Assemblies it is a component of. */
  assemblies: string[]
}

type Ev = { status?: EvidenceStatus; source?: string; locator?: string; confidence?: number; sourceIds?: string[] }

/**
 * Every primitive a model holds, in a fixed order (by type, then id). Legacy
 * roofs are not plane-graph primitives here: their plane graph is DERIVED
 * (see `legacyRoofGraph`), so the model is never said to hold what it does not.
 */
export function primitivesOf(m: CanonicalBuildingModel): PrimitiveRecord[] {
  const out: PrimitiveRecord[] = []
  const rels = (id: string): string[] => [
    ...m.relationships.filter((r) => r.from === id).map((r) => `${r.kind}→${r.to}`),
    ...m.relationships.filter((r) => r.to === id).map((r) => `${r.from}→${r.kind}`),
  ]
  const push = (type: PrimitiveType, objectId: string, kind: SemanticKind, ev: Ev | undefined, hostId?: string, id = objectId): void => {
    out.push({
      type,
      id,
      objectId,
      kind,
      lineage: { status: ev?.status, source: ev?.source, locator: ev?.locator, sourceIds: ev?.sourceIds ?? [] },
      confidence: ev?.confidence,
      hostId,
      relationships: rels(objectId),
      assemblies: assembliesContaining(m, objectId).map((a) => a.id),
    })
  }
  for (const w of m.walls) push('Wall', w.id, 'wall', w.evidence)
  for (const p of m.wallPanels) push(p.role === 'PARAPET' ? 'Parapet' : 'Wall', p.id, 'wallPanel', p.evidence, p.hostId)
  for (const s of m.slabs) push('Slab', s.id, 'slab', s.evidence)
  for (const s of m.linearSolids) {
    const t: PrimitiveType | undefined =
      s.role === 'COLUMN' ? 'Column' : s.role === 'POST' ? 'Post' : s.role === 'BEAM' || s.role === 'RAFTER' ? 'Beam' : s.role === 'LINTEL' ? 'Lintel' : s.role === 'PERGOLA_BEAM' ? 'PergolaBeam' : s.role === 'PERGOLA_POST' ? 'PergolaPost' : s.role === 'FASCIA' || s.role === 'VERGE_BOARD' ? 'Fascia' : undefined
    // an unclassified facade member is a linear solid, not yet a named primitive: it is not listed as one
    if (t) push(t, s.id, 'linearSolid', s.evidence, s.hostId)
  }
  for (const r of m.roofs) {
    for (const side of r.edgeMembers?.fascia?.sides ?? []) push('Fascia', r.id, 'roof', r.evidence, r.id, `${r.id}:fascia-${side.toLowerCase().replace('_', '-')}`)
  }
  for (const r of m.surfaceRegions) push('SurfaceRegion', r.id, 'surfaceRegion', r.evidence, r.hostId)
  for (const o of m.openings) push('Opening', o.id, 'opening', o.evidence, o.wallId)
  for (const w of m.windows) push('Window', w.id, 'window', w.evidence, w.openingId)
  for (const d of m.doors) {
    const panels = d.assembly?.panels ?? []
    const garage = d.usage === 'GARAGE' || (panels.length > 0 && panels.every((p) => p.kind === 'PANEL'))
    push(garage ? 'GarageDoor' : 'Door', d.id, 'door', d.evidence, d.openingId)
  }
  for (const o of m.roofOpenings) push('RoofOpening', o.id, 'roofOpening', o.evidence, o.roofId)
  for (const p of m.roofPlanes) push('RoofPlane', p.id, 'roofPlane', p.evidence)
  for (const e of m.roofEdges) {
    const t: PrimitiveType = e.kind === 'RIDGE' ? 'Ridge' : e.kind === 'HIP' ? 'HipEdge' : e.kind === 'VALLEY' ? 'Valley' : e.kind === 'VERGE' ? 'Verge' : e.kind === 'EAVE' ? 'Eave' : e.kind === 'ROOF_STEP' ? 'RoofStep' : 'RoofBoundary'
    push(t, e.id, 'roofEdge', e.evidence, e.planeIds[0])
  }
  for (const s of m.stepRuns) {
    push('ExteriorStepRun', s.id, 'stepRun', s.evidence)
    for (let k = 1; k <= s.steps; k++) push('Step', s.id, 'stepRun', s.evidence, s.id, `${s.id}:step-${k}`)
  }
  for (const s of m.stairs) {
    if (s.kind !== 'FLIGHTS') continue
    s.segments.forEach((seg, i) => {
      if (seg.kind === 'FLIGHT') push('StairFlight', s.id, 'stair', s.evidence, s.id, `${s.id}:flight-${i + 1}`)
      if (seg.kind === 'LANDING') push('Landing', s.id, 'stair', s.evidence, s.id, `${s.id}:landing-${i + 1}`)
    })
  }
  for (const p of m.platforms) {
    if (p.role === 'LANDING' || p.role === 'PORCH') push('Landing', p.id, 'platform', p.evidence)
    else if (p.role === 'RAMP') push('Ramp', p.id, 'platform', p.evidence)
  }
  for (const r of m.railings) push(r.role === 'HANDRAIL' ? 'Handrail' : r.role === 'GUARD' || r.role === 'BALUSTRADE' ? 'Guard' : 'RailingRun', r.id, 'railing', r.evidence, r.hostId)
  for (const t of m.terraces) push('TerraceSurface', t.id, 'terrace', t.evidence)
  for (const b of m.balconies) push(b.kind === 'TERRACE' ? 'TerraceSurface' : 'BalconySlab', b.id, 'balcony', b.evidence)
  const order = new Map(PRIMITIVE_TYPES.map((t, i) => [t, i]))
  return out.sort((a, b) => (order.get(a.type) as number) - (order.get(b.type) as number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** How many of each primitive type a model holds. */
export function primitiveCounts(m: CanonicalBuildingModel): Partial<Record<PrimitiveType, number>> {
  const out: Partial<Record<PrimitiveType, number>> = {}
  for (const p of primitivesOf(m)) out[p.type] = (out[p.type] ?? 0) + 1
  return out
}
