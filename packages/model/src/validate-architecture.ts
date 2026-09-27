/**
 * Semantic validation of the schema 1.6.0 vocabulary: roof planes and the
 * roof graph, wall panels, platforms, exterior step runs, member roles,
 * assemblies and typed relationships.
 *
 * Nothing here repairs anything. A roof edge that does not lie on the planes
 * it names, a ridge that is not level, a pergola a roof covers, an assembly
 * that claims to be complete while a component it needs is missing — each is
 * reported by name, with the id it is about, and the model is refused.
 * Warnings are kept for readings the evidence may legitimately overrule: a
 * terrace that sits high enough to read as a balcony is worth saying, not
 * worth refusing.
 */
import { polygonIsSimple, type Vec2 } from './geometry-types.js'
import { fmtNumber, type ValidationCode, type ValidationIssue } from './issues.js'
import { linearSolidBasis } from './linear-solid.js'
import { findObject } from './query.js'
import {
  ROOF_GRAPH_TOLERANCE,
  pointInPolygonStrict,
  polygonBounds,
  roofJoinShape,
  roofOpeningOutline,
  roofPlaneBoundaries,
  roofPlaneTopAt,
  segmentOnBoundaries,
  vec2Length,
} from './roof-plane.js'
import {
  HORIZONTAL_MEMBER_ROLES,
  ROOF_JOIN_KINDS,
  VERTICAL_MEMBER_ROLES,
  type Assembly,
  type CanonicalBuildingModel,
  type MemberRole,
  type RoofPlane,
  type SemanticKind,
  type WallPanelProfilePoint,
} from './schema.js'

const EPS = 1e-9
const HEIGHT_TOL = 1e-6
const fmt = fmtNumber

/** Points inside a plane's material: inside its outer boundary and outside every hole it hosts. */
function inPlaneMaterial(p: Vec2, boundaries: readonly (readonly Vec2[])[]): boolean {
  if (!pointInPolygonStrict(p, boundaries[0])) return false
  for (const h of boundaries.slice(1)) if (pointInPolygonStrict(p, h)) return false
  return true
}

/** A unit plan normal to ab pointing into the plane's material, or null. */
function intoPlane(a: Vec2, b: Vec2, boundaries: readonly (readonly Vec2[])[]): Vec2 | null {
  const L = Math.hypot(b.x - a.x, b.z - a.z)
  if (L <= EPS) return null
  const n = { x: -(b.z - a.z) / L, z: (b.x - a.x) / L }
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const step = Math.min(0.01, L / 10)
  if (inPlaneMaterial({ x: mid.x + n.x * step, z: mid.z + n.z * step }, boundaries)) return n
  if (inPlaneMaterial({ x: mid.x - n.x * step, z: mid.z - n.z * step }, boundaries)) return { x: -n.x, z: -n.z }
  return null
}

/** Piecewise-linear profile value at u (clamped to its ends). */
export function profileAt(points: readonly WallPanelProfilePoint[], u: number): number {
  if (u <= points[0].u) return points[0].y
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (u <= b.u) return b.u - a.u <= EPS ? b.y : a.y + ((u - a.u) / (b.u - a.u)) * (b.y - a.y)
  }
  return points[points.length - 1].y
}

/**
 * How a platform-like object reads, from elevation and topology alone: a
 * LOGGIA when it lies inside the plan of a wall ring at or above its level
 * (the building stands over it or around it), else a BALCONY when its top is
 * well above the lowest floor, else a TERRACE. The thresholds are stated,
 * not hidden: within 0.6 m of the lowest floor is at grade, more than 1.5 m
 * above it is elevated, between is read by topology alone.
 */
export function readPlatformSemantics(m: CanonicalBuildingModel, platformId: string): { reading: 'TERRACE' | 'BALCONY' | 'LOGGIA' | 'UNKNOWN'; heightAboveLowestFloor?: number; insideEnvelope: boolean; why: string } {
  const hit = findObject(m, platformId)
  if (!hit || !['balcony', 'terrace', 'platform'].includes(hit.kind)) return { reading: 'UNKNOWN', insideEnvelope: false, why: 'not a platform' }
  const o = hit.object as unknown as { levelId: string; topOffset: number; footprint?: { minX: number; maxX: number; minZ: number; maxZ: number }; polygon?: Vec2[] }
  const level = m.levels.find((l) => l.id === o.levelId)
  if (!level || m.levels.length === 0) return { reading: 'UNKNOWN', insideEnvelope: false, why: 'no level' }
  const lowest = Math.min(...m.levels.map((l) => l.elevation))
  const height = level.elevation + o.topOffset - lowest
  const poly = o.polygon ?? (o.footprint ? [{ x: o.footprint.minX, z: o.footprint.minZ }, { x: o.footprint.maxX, z: o.footprint.minZ }, { x: o.footprint.maxX, z: o.footprint.maxZ }, { x: o.footprint.minX, z: o.footprint.maxZ }] : [])
  const centroid = poly.reduce((s, p) => ({ x: s.x + p.x / poly.length, z: s.z + p.z / poly.length }), { x: 0, z: 0 })
  const rings = m.wallRings.filter((r) => {
    const l = m.levels.find((x) => x.id === r.levelId)
    return l !== undefined && l.elevation >= level.elevation - EPS
  })
  const insideEnvelope = rings.some((r) => {
    const ringPoly = r.wallIds.map((id) => m.walls.find((w) => w.id === id)?.start).filter((p): p is Vec2 => p !== undefined)
    return ringPoly.length >= 3 && pointInPolygonStrict(centroid, ringPoly)
  })
  if (insideEnvelope) return { reading: 'LOGGIA', heightAboveLowestFloor: height, insideEnvelope, why: 'it lies inside the plan of a storey that stands over or around it' }
  if (height > 1.5) return { reading: 'BALCONY', heightAboveLowestFloor: height, insideEnvelope, why: `its top is ${fmt(height)} m above the lowest floor, outside the envelope` }
  if (height < 0.6) return { reading: 'TERRACE', heightAboveLowestFloor: height, insideEnvelope, why: `its top is ${fmt(height)} m from the lowest floor, outside the envelope` }
  return { reading: 'UNKNOWN', heightAboveLowestFloor: height, insideEnvelope, why: `its top is ${fmt(height)} m above the lowest floor: neither at grade nor clearly elevated` }
}

export function architectureIssues(m: CanonicalBuildingModel, seen: ReadonlySet<string>): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const err = (code: ValidationCode, message: string, objectId?: string, path?: string, measured?: number): void => {
    out.push({ code, severity: 'ERROR', message, objectId, path, measured })
  }
  const warn = (code: ValidationCode, message: string, objectId?: string, path?: string): void => {
    out.push({ code, severity: 'WARNING', message, objectId, path })
  }
  const levelIds = new Set(m.levels.map((l) => l.id))
  const materialIds = new Set(m.materials.map((x) => x.id))
  const sourceIds = new Set(m.evidenceSources.map((s) => s.id))
  const planes = new Map(m.roofPlanes.map((p) => [p.id, p]))
  const kindOf = (id: string): SemanticKind | undefined => findObject(m, id)?.kind
  const common = (o: { id: string; levelId?: string; materialId?: string; evidence?: { sourceIds?: string[] } }, what: string): void => {
    if (o.levelId !== undefined && !levelIds.has(o.levelId)) err('UNKNOWN_LEVEL', `${what} ${o.id} refers to level "${o.levelId}", which does not exist`, o.id, 'levelId')
    if (o.materialId !== undefined && !materialIds.has(o.materialId)) err('UNKNOWN_MATERIAL', `${o.id} refers to material "${o.materialId}", which does not exist`, o.id, 'materialId')
    for (const s of o.evidence?.sourceIds ?? []) if (!sourceIds.has(s)) err('UNKNOWN_EVIDENCE_SOURCE', `${o.id} cites evidence source "${s}", which does not exist`, o.id, 'evidence.sourceIds')
  }
  const unit = (v: Vec2): boolean => Math.abs(vec2Length(v) - 1) <= 1e-6

  // --- walls that die into roof planes ---
  for (const w of m.walls) {
    if (w.topProfile?.kind !== 'FOLLOW_ROOF_PLANES') continue
    for (const id of w.topProfile.planeIds) if (!planes.has(id)) err('UNKNOWN_ROOF_PLANE', `wall ${w.id} follows roof plane "${id}", which does not exist`, w.id, 'topProfile.planeIds')
  }

  // --- roof planes ---
  for (const p of m.roofPlanes) {
    common(p, 'roof plane')
    if (!polygonIsSimple(p.boundary)) err('MALFORMED_POLYGON', `roof plane ${p.id} boundary is not a simple polygon with area`, p.id, 'boundary')
    if (!unit(p.downslope)) err('ROOF_PLANE_INVALID', `roof plane ${p.id}: its downslope (${fmt(p.downslope.x)}, ${fmt(p.downslope.z)}) is not a unit vector`, p.id, 'downslope')
  }

  // --- roof openings hosted by a plane ---
  const holesByPlane = new Map<string, Array<{ id: string; outline: Vec2[] }>>()
  for (const o of m.roofOpenings) {
    const plane = planes.get(o.roofId)
    if (!plane) continue
    const outline = roofOpeningOutline(o)
    if (o.outline) {
      if (!polygonIsSimple(o.outline)) {
        err('ROOF_OPENING_OUTLINE_INVALID', `roof opening ${o.id}: its outline is not a simple polygon with area`, o.id, 'outline')
        continue
      }
      const b = polygonBounds(o.outline)
      const f = o.footprint
      if (Math.abs(b.minX - f.minX) > 1e-6 || Math.abs(b.maxX - f.maxX) > 1e-6 || Math.abs(b.minZ - f.minZ) > 1e-6 || Math.abs(b.maxZ - f.maxZ) > 1e-6) {
        err('ROOF_OPENING_OUTLINE_INVALID', `roof opening ${o.id}: its footprint must be its outline's bounding rectangle`, o.id, 'footprint')
      }
    }
    if ((o.cut ?? 'VERTICAL') !== 'VERTICAL') err('ROOF_OPENING_CUT_UNSUPPORTED', `roof opening ${o.id}: a roof plane takes vertical cuts only`, o.id, 'cut')
    if (!polygonIsSimple(plane.boundary)) continue
    const outside = outline.filter((q) => !pointInPolygonStrict(q, plane.boundary))
    if (outside.length > 0) {
      err('ROOF_OPENING_OUTSIDE_HOST', `roof opening ${o.id} is not strictly inside roof plane ${plane.id} (${outside.length} of its corners are on or outside the boundary)`, o.id)
      continue
    }
    for (const other of holesByPlane.get(plane.id) ?? []) {
      const touching = outline.some((q) => pointInPolygonStrict(q, other.outline)) || other.outline.some((q) => pointInPolygonStrict(q, outline))
      if (touching) err('ROOF_OPENINGS_OVERLAP', `roof openings ${o.id} and ${other.id} overlap on roof plane ${plane.id}`, o.id)
    }
    holesByPlane.set(plane.id, [...(holesByPlane.get(plane.id) ?? []), { id: o.id, outline }])
    if (o.kind === 'PENETRATION' && o.throughId !== undefined) {
      const chimney = m.chimneys.find((c) => c.id === o.throughId)
      if (!chimney) err(seen.has(o.throughId) ? 'ROOF_PENETRATION_MISMATCH' : 'UNKNOWN_TARGET', `roof opening ${o.id} lets "${o.throughId}" through, which is not a chimney`, o.id, 'throughId')
      else {
        const cf = chimney.footprint
        const corners = [{ x: cf.minX, z: cf.minZ }, { x: cf.maxX, z: cf.minZ }, { x: cf.maxX, z: cf.maxZ }, { x: cf.minX, z: cf.maxZ }]
        if (!corners.every((q) => onOrIn(q, outline))) err('ROOF_PENETRATION_MISMATCH', `roof opening ${o.id} does not contain the footprint of chimney ${chimney.id} it lets through`, o.id, 'footprint')
      }
    } else if (o.throughId !== undefined) err('ROOF_PENETRATION_MISMATCH', `roof opening ${o.id} names "${o.throughId}" but is a ${o.kind}; only a PENETRATION lets an element through`, o.id, 'kind')
  }

  // --- roof edges ---
  for (const e of m.roofEdges) {
    common(e, 'roof edge')
    const named = e.planeIds.map((id) => planes.get(id))
    if (named.some((p) => !p)) {
      for (const id of e.planeIds) if (!planes.has(id)) err('UNKNOWN_ROOF_PLANE', `roof edge ${e.id} bounds roof plane "${id}", which does not exist`, e.id, 'planeIds')
      continue
    }
    const ps = named as RoofPlane[]
    const join = ROOF_JOIN_KINDS.includes(e.kind)
    if (join && ps.length !== 2) {
      err('ROOF_EDGE_INVALID', `roof edge ${e.id} is a ${e.kind}, which joins two planes; it names ${ps.length}`, e.id, 'planeIds')
      continue
    }
    if (!join && ps.length !== 1) {
      err('ROOF_EDGE_INVALID', `roof edge ${e.id} is a ${e.kind}, a free edge of one plane; it names ${ps.length}`, e.id, 'planeIds')
      continue
    }
    if (join && e.planeIds[0] === e.planeIds[1]) {
      err('ROOF_EDGE_INVALID', `roof edge ${e.id} joins plane ${e.planeIds[0]} to itself`, e.id, 'planeIds')
      continue
    }
    const a = { x: e.start.x, z: e.start.z }
    const b = { x: e.end.x, z: e.end.z }
    if (Math.hypot(b.x - a.x, b.z - a.z) <= ROOF_GRAPH_TOLERANCE) {
      err('ROOF_EDGE_INVALID', `roof edge ${e.id} has no length in plan`, e.id, 'end')
      continue
    }
    let placed = true
    for (const p of ps) {
      if (!segmentOnBoundaries(a, b, roofPlaneBoundaries(m, p))) {
        err('ROOF_EDGE_INVALID', `roof edge ${e.id} does not lie on the boundary of roof plane ${p.id}`, e.id)
        placed = false
      }
    }
    if (!placed) continue
    const [A, B] = ps
    const dy0 = Math.max(Math.abs(roofPlaneTopAt(A, a.x, a.z) - e.start.y), Math.abs(roofPlaneTopAt(A, b.x, b.z) - e.end.y))
    if (dy0 > HEIGHT_TOL) {
      err('ROOF_EDGE_INVALID', `roof edge ${e.id} is ${fmt(dy0)} m off the top surface of roof plane ${A.id}`, e.id, 'start', dy0)
      continue
    }
    const level = Math.abs(e.start.y - e.end.y) <= HEIGHT_TOL
    const into = intoPlane(a, b, roofPlaneBoundaries(m, A))
    if (!into) {
      err('ROOF_EDGE_INVALID', `roof edge ${e.id}: roof plane ${A.id} has material on neither side of it`, e.id)
      continue
    }
    const mismatch = (why: string): void => err('ROOF_EDGE_KIND_MISMATCH', `roof edge ${e.id} is stated as a ${e.kind}, but ${why}`, e.id, 'kind')
    if (join) {
      const shape = roofJoinShape(A, B, a, b, into)
      if (e.kind === 'ROOF_STEP') {
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
        if (shape !== 'STEP') mismatch(`planes ${A.id} and ${B.id} meet at one height along it`)
        else if (roofPlaneTopAt(A, mid.x, mid.z) <= roofPlaneTopAt(B, mid.x, mid.z)) mismatch(`the first plane named (${A.id}) is not the upper one`)
      } else if (shape === 'STEP') mismatch(`planes ${A.id} and ${B.id} stand at different heights along it: a roof step`)
      else if (e.kind === 'VALLEY' && shape !== 'CONCAVE') mismatch(`planes ${A.id} and ${B.id} meet ${shape === 'CONVEX' ? 'convexly' : 'flush'} there, not in a valley`)
      else if ((e.kind === 'RIDGE' || e.kind === 'HIP') && shape !== 'CONVEX') mismatch(`planes ${A.id} and ${B.id} meet ${shape === 'CONCAVE' ? 'concavely' : 'flush'} there`)
      else if (e.kind === 'RIDGE' && !level) mismatch('it is not level (a sloping convex crease is a hip)')
      else if (e.kind === 'HIP' && level) mismatch('it is level (a level convex crease is a ridge)')
    } else {
      const outward = { x: -into.x, z: -into.z }
      const along = A.downslope.x * outward.x + A.downslope.z * outward.z
      if (e.kind === 'EAVE') {
        if (!level) mismatch('it is not level')
        else if (A.pitchDeg > 0 && along <= 1e-6) mismatch(`plane ${A.id} does not slope down to it`)
      } else if (e.kind === 'VERGE') {
        if (A.pitchDeg === 0) mismatch(`plane ${A.id} is flat; a flat roof's free edge is an eave or a boundary`)
        else if (Math.abs(along) > 0.05 || level) mismatch(`the slope of plane ${A.id} does not run along it`)
      }
    }
  }

  // --- wall panels ---
  for (const p of m.wallPanels) {
    common(p, 'wall panel')
    const L = Math.hypot(p.end.x - p.start.x, p.end.z - p.start.z)
    if (L <= 1e-6) {
      err('WALL_PANEL_INVALID', `wall panel ${p.id} has no length`, p.id, 'end')
      continue
    }
    let ok = true
    for (const [name, prof] of [['bottom', p.bottom], ['top', p.top]] as const) {
      for (let i = 1; i < prof.length; i++) if (prof[i].u <= prof[i - 1].u + EPS) ok = false
      if (Math.abs(prof[0].u) > 1e-6 || Math.abs(prof[prof.length - 1].u - L) > 1e-6) ok = false
      if (!ok) {
        err('WALL_PANEL_INVALID', `wall panel ${p.id}: its ${name} profile must run strictly along u from 0 to its length ${fmt(L)} m`, p.id, name)
        break
      }
    }
    if (!ok) continue
    const us = [...new Set([...p.bottom, ...p.top].map((q) => q.u))].sort((x, y) => x - y)
    for (let i = 0; i < us.length; i++) {
      if (profileAt(p.top, us[i]) < profileAt(p.bottom, us[i]) - EPS) ok = false
      if (i + 1 < us.length) {
        const mid = (us[i] + us[i + 1]) / 2
        if (profileAt(p.top, mid) <= profileAt(p.bottom, mid) + 1e-6) ok = false
      }
    }
    if (!ok) err('WALL_PANEL_INVALID', `wall panel ${p.id}: its top must stand above its bottom along its whole length (it may meet it only at a point)`, p.id, 'top')
    if (p.hostId !== undefined && !seen.has(p.hostId)) err('UNKNOWN_TARGET', `wall panel ${p.id} names host "${p.hostId}", which does not exist`, p.id, 'hostId')
  }

  // --- platforms ---
  for (const p of m.platforms) {
    common(p, 'platform')
    if (!polygonIsSimple(p.polygon)) err('MALFORMED_POLYGON', `platform ${p.id} polygon is not a simple polygon with area`, p.id, 'polygon')
    if ((p.role === 'RAMP') !== (p.slope !== undefined)) err('PLATFORM_INVALID', `platform ${p.id}: ${p.role === 'RAMP' ? 'a ramp needs a slope' : `a ${p.role.toLowerCase()} is level; only a ramp has a slope`}`, p.id, 'slope')
    if (p.slope && !unit(p.slope.downhill)) err('PLATFORM_INVALID', `platform ${p.id}: its slope's downhill direction is not a unit vector`, p.id, 'slope.downhill')
    for (const w of p.hostWallIds ?? []) if (!m.walls.some((x) => x.id === w)) err('UNKNOWN_WALL', `platform ${p.id} lies against wall "${w}", which does not exist`, p.id, 'hostWallIds')
  }

  // --- exterior step runs ---
  for (const s of m.stepRuns) {
    common(s, 'step run')
    if (!unit(s.direction)) err('STEP_RUN_INVALID', `step run ${s.id}: its direction is not a unit vector`, s.id, 'direction')
    if (s.construction === 'OPEN_TREADS') {
      if (s.treadThickness === undefined) err('STEP_RUN_INVALID', `step run ${s.id}: open treads need a tread thickness`, s.id, 'treadThickness')
      else if (s.treadThickness > s.rise + EPS) err('STEP_RUN_INVALID', `step run ${s.id}: treads ${fmt(s.treadThickness)} m thick would overlap at a rise of ${fmt(s.rise)} m`, s.id, 'treadThickness')
    } else if (s.treadThickness !== undefined) err('STEP_RUN_INVALID', `step run ${s.id}: a solid run has no separate tread thickness`, s.id, 'treadThickness')
  }

  // --- member roles ---
  for (const s of m.linearSolids) {
    if (!s.role) continue
    const dir = linearSolidBasis(s).pathDir
    if (VERTICAL_MEMBER_ROLES.includes(s.role) && Math.abs(dir.y) < Math.cos((1 * Math.PI) / 180)) err('MEMBER_ORIENTATION_INVALID', `linear solid ${s.id} is a ${s.role.toLowerCase().replace('_', ' ')}, which stands vertically; it leans ${fmt((Math.acos(Math.min(1, Math.abs(dir.y))) * 180) / Math.PI)}°`, s.id, 'end')
    if (HORIZONTAL_MEMBER_ROLES.includes(s.role) && Math.abs(dir.y) > Math.sin((1 * Math.PI) / 180)) err('MEMBER_ORIENTATION_INVALID', `linear solid ${s.id} is a ${s.role.toLowerCase().replace('_', ' ')}, which lies level; it slopes ${fmt((Math.asin(Math.min(1, Math.abs(dir.y))) * 180) / Math.PI)}°`, s.id, 'end')
  }

  // --- assemblies ---
  const assemblies = new Map(m.assemblies.map((a) => [a.id, a]))
  const roofOf = new Map<string, string>()
  for (const a of m.assemblies) {
    common(a, 'assembly')
    const ref = (field: string, id: string | undefined, allowed: readonly SemanticKind[], extra?: (id: string) => string | undefined): void => {
      if (id === undefined) return
      if (id === a.id) return err('ASSEMBLY_REFERENCE_INVALID', `assembly ${a.id} lists itself in ${field}`, a.id, field)
      const k = kindOf(id)
      if (!k) return err('ASSEMBLY_REFERENCE_INVALID', `assembly ${a.id} ${field} names "${id}", which does not exist`, a.id, field)
      if (!allowed.includes(k)) return err('ASSEMBLY_MEMBER_INVALID', `assembly ${a.id} ${field} names ${id}, a ${k}; it takes ${allowed.join(' / ')}`, a.id, field)
      const problem = extra?.(id)
      if (problem) err('ASSEMBLY_MEMBER_INVALID', `assembly ${a.id} ${field}: ${problem}`, a.id, field)
    }
    const refs = (field: string, ids: readonly string[], allowed: readonly SemanticKind[], extra?: (id: string) => string | undefined): void => {
      const dup = ids.find((x, i) => ids.indexOf(x) !== i)
      if (dup) err('ASSEMBLY_REFERENCE_INVALID', `assembly ${a.id} lists ${dup} twice in ${field}`, a.id, field)
      for (const id of ids) ref(field, id, allowed, extra)
    }
    const assemblyOfKind = (kinds: readonly Assembly['kind'][]) => (id: string): string | undefined => {
      const other = assemblies.get(id)
      return other && !kinds.includes(other.kind) ? `${id} is a ${other.kind} assembly, not ${kinds.join(' / ')}` : undefined
    }
    const memberRole = (roles: readonly MemberRole[], what: string) => (id: string): string | undefined => {
      const s = m.linearSolids.find((x) => x.id === id)
      if (!s) return undefined
      return s.role && roles.includes(s.role) ? undefined : `${id} is a linear solid ${s.role ? `with role ${s.role}` : 'without a role'}; a ${what} takes ${roles.join(' / ')}`
    }
    const vertical = memberRole(VERTICAL_MEMBER_ROLES, 'support')
    const beam = memberRole(['BEAM', 'LINTEL', 'PERGOLA_BEAM', 'RAFTER'], 'beam')
    for (const h of a.hostIds) if (!seen.has(h)) err('ASSEMBLY_REFERENCE_INVALID', `assembly ${a.id} is hosted by "${h}", which does not exist`, a.id, 'hostIds')
    let complete = true
    const requireFor = (ok: boolean): void => {
      if (!ok) complete = false
    }
    switch (a.kind) {
      case 'ROOF': {
        refs('planeIds', a.planeIds, ['roofPlane'])
        for (const p of a.planeIds) {
          const prev = roofOf.get(p)
          if (prev && prev !== a.id) err('ASSEMBLY_MEMBER_INVALID', `roof plane ${p} belongs to two roof assemblies, ${prev} and ${a.id}`, a.id, 'planeIds')
          roofOf.set(p, a.id)
        }
        refs('edgeIds', a.edgeIds, ['roofEdge'], (id) => {
          const e = m.roofEdges.find((x) => x.id === id)
          return e && !e.planeIds.some((p) => a.planeIds.includes(p)) ? `edge ${id} bounds none of the assembly's planes` : undefined
        })
        refs('openingIds', a.openingIds, ['roofOpening'], (id) => {
          const o = m.roofOpenings.find((x) => x.id === id)
          return o && !a.planeIds.includes(o.roofId) ? `roof opening ${id} is cut in ${o.roofId}, not in one of the assembly's planes` : undefined
        })
        refs('dormerIds', a.dormerIds, ['assembly'], (id) => {
          const d = assemblies.get(id)
          if (!d) return undefined
          if (d.kind !== 'DORMER') return `${id} is a ${d.kind} assembly, not a DORMER`
          return d.hostPlaneIds.every((p) => a.planeIds.includes(p)) ? undefined : `dormer ${id} stands in planes that are not this roof's`
        })
        refs('chimneyIds', a.chimneyIds, ['chimney'])
        refs('trimIds', a.trimIds, ['linearSolid', 'wallPanel'])
        break
      }
      case 'DORMER': {
        ref('hostRoofAssemblyId', a.hostRoofAssemblyId, ['assembly'], (id) => {
          const r = assemblies.get(id)
          if (!r) return undefined
          if (r.kind !== 'ROOF') return `${id} is a ${r.kind} assembly, not a ROOF`
          return a.hostPlaneIds.every((p) => r.planeIds.includes(p)) ? undefined : `its host planes are not all planes of roof ${id}`
        })
        refs('hostPlaneIds', a.hostPlaneIds, ['roofPlane'])
        refs('wallIds', a.wallIds, ['wall', 'wallPanel'])
        ref('localRoofAssemblyId', a.localRoofAssemblyId, ['assembly'], assemblyOfKind(['ROOF']))
        ref('cutOpeningId', a.cutOpeningId, ['roofOpening'], (id) => {
          const o = m.roofOpenings.find((x) => x.id === id)
          if (!o) return undefined
          if (o.kind !== 'DORMER') return `${id} is a ${o.kind} roof opening, not a DORMER cut`
          return a.hostPlaneIds.includes(o.roofId) ? undefined : `the cut ${id} is in ${o.roofId}, not in a host plane`
        })
        refs('openingIds', a.openingIds, ['opening'], (id) => {
          const o = m.openings.find((x) => x.id === id)
          return o && !a.wallIds.includes(o.wallId) ? `opening ${id} is in wall ${o.wallId}, which is not one of the dormer's walls` : undefined
        })
        if (!polygonIsSimple(a.footprintOnRoof)) err('MALFORMED_POLYGON', `dormer ${a.id}: its footprint on the roof is not a simple polygon`, a.id, 'footprintOnRoof')
        requireFor(a.cutOpeningId !== undefined && a.localRoofAssemblyId !== undefined && a.wallIds.length > 0)
        break
      }
      case 'BALCONY':
      case 'TERRACE':
      case 'LOGGIA': {
        const floor: readonly SemanticKind[] = a.kind === 'BALCONY' ? ['balcony'] : a.kind === 'TERRACE' ? ['terrace', 'balcony', 'platform'] : ['balcony', 'terrace']
        ref('platformId', a.platformId, floor, (id) => {
          const b = m.balconies.find((x) => x.id === id)
          return a.kind === 'TERRACE' && b && b.kind !== 'TERRACE' ? `${id} is a ${b.kind.toLowerCase()} slab, not a terrace` : undefined
        })
        refs('railingIds', a.railingIds, ['railing'])
        refs('supportIds', a.supportIds, ['linearSolid', 'wall', 'wallPanel'])
        if (a.kind === 'LOGGIA') refs('recessWallIds', a.recessWallIds, ['wall'])
        const vertexCount = a.platformId ? (m.terraces.find((x) => x.id === a.platformId)?.polygon.length ?? m.platforms.find((x) => x.id === a.platformId)?.polygon.length ?? 4) : 0
        for (const c of a.edgeConditions ?? []) {
          if (c.edgeIndex >= vertexCount) err('ASSEMBLY_REFERENCE_INVALID', `assembly ${a.id}: edge condition on edge ${c.edgeIndex}, but its floor has ${vertexCount} edges`, a.id, 'edgeConditions')
          if (c.targetId !== undefined && !seen.has(c.targetId)) err('ASSEMBLY_REFERENCE_INVALID', `assembly ${a.id}: edge ${c.edgeIndex} meets "${c.targetId}", which does not exist`, a.id, 'edgeConditions')
        }
        requireFor(a.platformId !== undefined)
        if (a.platformId && seen.has(a.platformId)) {
          const r = readPlatformSemantics(m, a.platformId)
          if (r.reading !== 'UNKNOWN' && r.reading !== a.kind) warn('ASSEMBLY_KIND_CONTRADICTED', `assembly ${a.id} is stated as a ${a.kind.toLowerCase()}, but its floor reads as a ${r.reading.toLowerCase()}: ${r.why}`, a.id, 'kind')
        }
        break
      }
      case 'CANOPY':
      case 'CARPORT': {
        refs('supportIds', a.supportIds, ['linearSolid', 'wall', 'wallPanel'], vertical)
        refs('beamIds', a.beamIds, ['linearSolid'], beam)
        ref('roofAssemblyId', a.roofAssemblyId, ['assembly'], assemblyOfKind(['ROOF']))
        ref('slabId', a.slabId, ['slab', 'platform'])
        requireFor((a.roofAssemblyId !== undefined || a.slabId !== undefined) && a.supportIds.length + a.hostIds.length > 0)
        break
      }
      case 'PERGOLA': {
        refs('postIds', a.postIds, ['linearSolid'], vertical)
        refs('primaryBeamIds', a.primaryBeamIds, ['linearSolid'], beam)
        refs('secondaryBeamIds', a.secondaryBeamIds, ['linearSolid'], beam)
        ref('slabOrTerraceId', a.slabOrTerraceId, ['terrace', 'platform', 'slab', 'balcony'])
        const members = new Set([a.id, ...a.postIds, ...a.primaryBeamIds, ...a.secondaryBeamIds])
        const isRoof = (id: string): boolean => planes.has(id) || assemblies.get(id)?.kind === 'ROOF' || m.roofs.some((r) => r.id === id)
        for (const r of m.relationships) {
          if ((r.kind === 'COVERS' && members.has(r.to) && isRoof(r.from)) || (r.kind === 'SUPPORTED_BY' && members.has(r.to) && isRoof(r.from))) {
            err('PERGOLA_HAS_ROOF', `pergola ${a.id} is open, but ${r.from} (a roof) ${r.kind === 'COVERS' ? 'covers' : 'is supported by'} ${r.to}; a covered frame is a canopy`, a.id, 'coverage')
          }
        }
        requireFor(a.postIds.length + a.hostIds.length > 0 && a.primaryBeamIds.length > 0)
        break
      }
      case 'ENTRANCE': {
        ref('doorId', a.doorId, ['door'])
        ref('landingId', a.landingId, ['platform', 'terrace', 'balcony'])
        refs('stepRunIds', a.stepRunIds, ['stepRun'])
        ref('canopyId', a.canopyId, ['assembly'], assemblyOfKind(['CANOPY']))
        refs('supportIds', a.supportIds, ['linearSolid', 'wall', 'wallPanel'])
        refs('railingIds', a.railingIds, ['railing'])
        requireFor(a.doorId !== undefined)
        break
      }
      case 'EXTERIOR_STAIR': {
        refs('stepRunIds', a.stepRunIds, ['stepRun'])
        refs('landingIds', a.landingIds, ['platform', 'terrace'])
        refs('railingIds', a.railingIds, ['railing'])
        requireFor(a.stepRunIds.length > 0)
        break
      }
      case 'FACADE': {
        refs('wallIds', a.wallIds, ['wall', 'wallPanel'])
        refs('openingIds', a.openingIds, ['opening'])
        refs('memberIds', a.memberIds, ['linearSolid'])
        refs('regionIds', a.regionIds, ['surfaceRegion'])
        break
      }
      case 'GARAGE': {
        refs('wallIds', a.wallIds, ['wall'])
        refs('doorIds', a.doorIds, ['door'])
        ref('roofAssemblyId', a.roofAssemblyId, ['assembly'], assemblyOfKind(['ROOF']))
        refs('roofIds', a.roofIds, ['roof'])
        requireFor(a.wallIds.length > 0 && a.doorIds.length > 0)
        break
      }
      case 'UNKNOWN': {
        for (const s of a.sourceEvidenceIds) if (!sourceIds.has(s)) err('UNKNOWN_EVIDENCE_SOURCE', `unknown assembly ${a.id} rests on evidence source "${s}", which does not exist`, a.id, 'sourceEvidenceIds')
        const { min, max } = a.metricExtent
        const spans = [max.x - min.x, max.y - min.y, max.z - min.z]
        if (spans.some((v) => v < 0) || spans.filter((v) => v > 1e-6).length < 2) err('UNKNOWN_ASSEMBLY_INVALID', `unknown assembly ${a.id}: its extent must span at least two axes, min before max`, a.id, 'metricExtent')
        const inside = (p: { x: number; y: number; z: number }): boolean => p.x >= min.x - 1e-6 && p.x <= max.x + 1e-6 && p.y >= min.y - 1e-6 && p.y <= max.y + 1e-6 && p.z >= min.z - 1e-6 && p.z <= max.z + 1e-6
        for (const [i, f] of a.observedPlanesOrSegments.entries()) {
          const pts = f.kind === 'PLANE' ? f.outline : [f.start, f.end]
          if (!pts.every(inside)) err('UNKNOWN_ASSEMBLY_INVALID', `unknown assembly ${a.id}: observed ${f.kind.toLowerCase()} ${i} lies outside its stated extent`, a.id, `observedPlanesOrSegments.${i}`)
          if (f.kind === 'PLANE' && !planarOutline(f.outline)) err('UNKNOWN_ASSEMBLY_INVALID', `unknown assembly ${a.id}: observed plane ${i} is not planar or has no area`, a.id, `observedPlanesOrSegments.${i}`)
        }
        if (a.quality === 'COMPLETE') err('ASSEMBLY_QUALITY_OVERSTATED', `unknown assembly ${a.id} cannot be complete: what it is, is the thing that is not known`, a.id, 'quality')
        break
      }
    }
    if (a.kind !== 'UNKNOWN' && a.quality === 'COMPLETE' && !complete) err('ASSEMBLY_QUALITY_OVERSTATED', `${a.kind.toLowerCase()} assembly ${a.id} claims to be complete but lacks a component its kind requires`, a.id, 'quality')
    if (a.kind !== 'UNKNOWN' && a.quality !== 'COMPLETE' && (a.missing ?? []).length === 0) err('ASSEMBLY_QUALITY_UNEXPLAINED', `${a.kind.toLowerCase()} assembly ${a.id} is ${a.quality.toLowerCase()} but does not name what it lacks`, a.id, 'missing')
  }

  // --- relationships ---
  const keys = new Set<string>()
  for (const r of m.relationships) {
    common(r, 'relationship')
    if (!seen.has(r.from) || !seen.has(r.to)) {
      err('RELATIONSHIP_INVALID', `relationship ${r.id}: ${!seen.has(r.from) ? `"${r.from}"` : `"${r.to}"`} does not exist`, r.id, !seen.has(r.from) ? 'from' : 'to')
      continue
    }
    if (r.from === r.to) err('RELATIONSHIP_INVALID', `relationship ${r.id} relates ${r.from} to itself`, r.id)
    const key = `${r.kind}|${r.from}|${r.to}`
    if (keys.has(key)) err('DUPLICATE_RELATIONSHIP', `relationship ${r.id} restates ${r.from} ${r.kind} ${r.to}`, r.id)
    keys.add(key)
    const fromKind = kindOf(r.from)
    if (r.kind === 'GUARDS' && !['railing', 'wallPanel', 'linearSolid'].includes(fromKind ?? '')) err('RELATIONSHIP_INVALID', `relationship ${r.id}: ${r.from} is a ${fromKind}; only a railing, a panel or a member guards`, r.id, 'from')
    if (r.kind === 'OPENS_INTO' && !['door', 'opening', 'window'].includes(fromKind ?? '')) err('RELATIONSHIP_INVALID', `relationship ${r.id}: ${r.from} is a ${fromKind}; only a door, a window or an opening opens into something`, r.id, 'from')
  }
  return out
}

/** Chimney corners on the boundary of the hole count as inside it. */
function onOrIn(q: Vec2, poly: readonly Vec2[]): boolean {
  if (pointInPolygonStrict(q, poly)) return true
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = (b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x)
    if (Math.abs(cross) <= 1e-9 && q.x >= Math.min(a.x, b.x) - 1e-9 && q.x <= Math.max(a.x, b.x) + 1e-9 && q.z >= Math.min(a.z, b.z) - 1e-9 && q.z <= Math.max(a.z, b.z) + 1e-9) return true
  }
  return false
}

/** True when a 3D outline is planar (every vertex within 1 mm of the plane of its first three non-collinear vertices) and has area. */
function planarOutline(pts: readonly { x: number; y: number; z: number }[]): boolean {
  const o = pts[0]
  let n: { x: number; y: number; z: number } | undefined
  for (let i = 1; i + 1 < pts.length && !n; i++) {
    const u = { x: pts[i].x - o.x, y: pts[i].y - o.y, z: pts[i].z - o.z }
    const v = { x: pts[i + 1].x - o.x, y: pts[i + 1].y - o.y, z: pts[i + 1].z - o.z }
    const c = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }
    const l = Math.hypot(c.x, c.y, c.z)
    if (l > 1e-9) n = { x: c.x / l, y: c.y / l, z: c.z / l }
  }
  if (!n) return false
  const nn = n
  return pts.every((p) => Math.abs((p.x - o.x) * nn.x + (p.y - o.y) * nn.y + (p.z - o.z) * nn.z) <= 1e-3)
}
