/**
 * Runtime validation of a CanonicalBuildingModel.
 *
 * Two layers: the Zod schema (shape, numeric domains, enumerations) and the
 * semantic checks below (references resolve, openings sit inside their host
 * wall, polygons are simple, no two objects share an id, ...). Nothing here
 * repairs anything: a problem is reported with the id of the object it is
 * about and the code a caller can act on.
 */
import { polygonIsSimple, rectIsValid, rectWidth, rectDepth, type PlanRect, type Vec2 } from './geometry-types.js'
import { fmtNumber, type ValidationCode, type ValidationIssue, type ValidationResult } from './issues.js'
import { migrateModelInput } from './migrate.js'
import { allObjectIds, openingHeadRange, openingIsRaked, openingLeaves, roofCoveredRect, roofCreaseLine, wallLength } from './query.js'
import { roofCutMode, roofOpeningUndersideRect } from './roof-cut.js'
import {
  CanonicalBuildingModelSchema,
  OBJECT_COLLECTIONS,
  type CanonicalBuildingModel,
  type Opening,
  type Wall,
} from './schema.js'
import { layoutStair } from './stair-layout.js'
import { physicalCore, resolveWallTopology, wallOverlapIssues } from './topology.js'

export type { ValidationCode, ValidationIssue, ValidationResult } from './issues.js'

const EPS = 1e-9

/**
 * Validate an unknown value as a model. Older supported schema versions are
 * migrated first and the migration reported; then the Zod schema; then the
 * semantic checks, only if the shape is right.
 */
export function validateModel(input: unknown): ValidationResult & { model?: CanonicalBuildingModel; migrated?: boolean } {
  const migration = migrateModelInput(input)
  if (migration.issues.some((i) => i.severity === 'ERROR')) return { ok: false, issues: migration.issues }
  const parsed = CanonicalBuildingModelSchema.safeParse(migration.input)
  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((i) => ({
      code: 'SCHEMA',
      severity: 'ERROR',
      message: i.message,
      path: i.path.join('.'),
    }))
    return { ok: false, issues: [...migration.issues, ...issues] }
  }
  const issues = [...migration.issues, ...semanticIssues(parsed.data)]
  return { ok: !issues.some((i) => i.severity === 'ERROR'), issues, model: parsed.data, migrated: migration.migrated }
}

/** Semantic checks over a model whose shape is already known to be right. */
export function semanticIssues(m: CanonicalBuildingModel): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const err = (code: ValidationCode, message: string, objectId?: string, path?: string, measured?: number): void => {
    out.push({ code, severity: 'ERROR', message, objectId, path, measured })
  }
  const warn = (code: ValidationCode, message: string, objectId?: string, path?: string): void => {
    out.push({ code, severity: 'WARNING', message, objectId, path })
  }

  // Ids are unique across every collection, the building included.
  const seen = new Set<string>()
  for (const id of allObjectIds(m)) {
    if (seen.has(id)) err('DUPLICATE_ID', `id "${id}" is used by more than one object`, id)
    seen.add(id)
  }

  const levelIds = new Set(m.levels.map((l) => l.id))
  const wallIds = new Set(m.walls.map((w) => w.id))
  const openingIds = new Set(m.openings.map((o) => o.id))
  const roofIds = new Set(m.roofs.map((r) => r.id))
  const materialIds = new Set(m.materials.map((x) => x.id))
  const sourceIds = new Set(m.evidenceSources.map((s) => s.id))

  const needLevel = (objectId: string, levelId: string): void => {
    if (!levelIds.has(levelId)) err('UNKNOWN_LEVEL', `${objectId} refers to level "${levelId}", which does not exist`, objectId, 'levelId')
  }
  const needMaterial = (objectId: string, materialId: string | undefined): void => {
    if (materialId !== undefined && !materialIds.has(materialId)) {
      err('UNKNOWN_MATERIAL', `${objectId} refers to material "${materialId}", which does not exist`, objectId, 'materialId')
    }
  }
  const needSources = (objectId: string, ids: readonly string[] | undefined): void => {
    for (const s of ids ?? []) {
      if (!sourceIds.has(s)) err('UNKNOWN_EVIDENCE_SOURCE', `${objectId} cites evidence source "${s}", which does not exist`, objectId, 'evidence.sourceIds')
    }
  }
  const needRect = (objectId: string, r: PlanRect, what: string): void => {
    if (!rectIsValid(r)) err('INVALID_RECT', `${objectId}: ${what} ${JSON.stringify(r)} has no area`, objectId, what)
  }

  if (m.levels.length > 0 && !m.building) err('MISSING_BUILDING', 'levels exist but the model has no building')

  const indexes = new Map<number, string>()
  for (const l of m.levels) {
    if (!m.building || l.buildingId !== m.building.id) {
      err('UNKNOWN_BUILDING', `level ${l.id} refers to building "${l.buildingId}", which is not the model's building`, l.id, 'buildingId')
    }
    const prev = indexes.get(l.index)
    if (prev) warn('DUPLICATE_LEVEL_INDEX', `levels ${prev} and ${l.id} share index ${l.index}`, l.id, 'index')
    indexes.set(l.index, l.id)
    needSources(l.id, l.evidence?.sourceIds)
  }

  for (const r of m.rooms) {
    needLevel(r.id, r.levelId)
    if (!polygonIsSimple(r.polygon)) err('MALFORMED_POLYGON', `room ${r.id} polygon is not a simple polygon with area`, r.id, 'polygon')
    needSources(r.id, r.evidence?.sourceIds)
  }

  for (const w of m.walls) {
    needLevel(w.id, w.levelId)
    needMaterial(w.id, w.materialId)
    needSources(w.id, w.evidence?.sourceIds)
    if (wallLength(w) <= EPS) err('DEGENERATE_WALL', `wall ${w.id} has zero length`, w.id, 'end')
    if (w.topProfile?.kind === 'FOLLOW_ROOF' && !roofIds.has(w.topProfile.roofId)) {
      err('UNKNOWN_ROOF', `wall ${w.id} follows roof "${w.topProfile.roofId}", which does not exist`, w.id, 'topProfile.roofId')
    }
    if (w.topProfile?.kind === 'POLYLINE') {
      const pts = w.topProfile.points
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].u < pts[i - 1].u - EPS) {
          err('SCHEMA', `wall ${w.id} top profile points must be sorted along u`, w.id, 'topProfile.points')
          break
        }
      }
    }
  }

  // Wall topology: junctions and rings resolve to physical extents (see topology.ts).
  const topology = resolveWallTopology(m)
  out.push(...topology.issues)
  out.push(...wallOverlapIssues(m, topology.extents))

  // Openings inside their host, not touching its side or top edges, not reaching
  // into a junction zone, not overlapping each other. An opening with further
  // leaves is checked once per leaf: every leaf is a real cut in its own wall.
  type Cut = { openingId: string; a0: number; a1: number; b0: number; b1: number }
  const byWall = new Map<string, Cut[]>()
  const wallDirection = (w: Wall): { x: number; z: number } => {
    const L = wallLength(w)
    return { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
  }
  for (const o of m.openings) {
    needSources(o.id, o.evidence?.sourceIds)
    const host = m.walls.find((w) => w.id === o.wallId)
    if (!host) {
      err('UNKNOWN_WALL', `opening ${o.id} refers to wall "${o.wallId}", which does not exist`, o.id, 'wallId')
      continue
    }
    const leaves = openingLeaves(o)
    const seenLeaf = new Set<string>()
    let leafOk = true
    for (let i = 1; i < leaves.length; i++) {
      const leaf = leaves[i]
      if (leaf.wallId === o.wallId || seenLeaf.has(leaf.wallId)) {
        err('OPENING_LEAF_INVALID', `opening ${o.id} names wall ${leaf.wallId} as a further leaf more than once (or as its own host)`, o.id, 'leaves')
        leafOk = false
        continue
      }
      seenLeaf.add(leaf.wallId)
      const w = m.walls.find((x) => x.id === leaf.wallId)
      if (!w) {
        err('UNKNOWN_WALL', `opening ${o.id} names leaf wall "${leaf.wallId}", which does not exist`, o.id, 'leaves')
        leafOk = false
        continue
      }
      if (w.levelId !== host.levelId) {
        err('OPENING_LEAF_LEVEL_MISMATCH', `opening ${o.id} is hosted on level ${host.levelId} but its leaf wall ${w.id} stands on level ${w.levelId}`, o.id, 'leaves')
        leafOk = false
      }
      const u0 = wallDirection(host)
      const u1 = wallDirection(w)
      if (Math.abs(u0.x * u1.z - u0.z * u1.x) > 1e-9) {
        err('OPENING_LEAF_NOT_PARALLEL', `opening ${o.id} passes through wall ${w.id}, which is not parallel to its host wall ${host.id}; one opening cuts parallel leaves only`, o.id, 'leaves')
        leafOk = false
      }
    }
    if (!leafOk) continue
    const range = openingHeadRange(o)
    for (const leaf of leaves) {
      const wall = m.walls.find((w) => w.id === leaf.wallId)!
      const where = leaf.wallId === o.wallId ? `wall ${wall.id}` : `leaf wall ${wall.id}`
      const L = wallLength(wall)
      const a0 = leaf.offset
      const a1 = leaf.offset + o.width
      const b0 = o.sill
      const b1 = range.max
      if (a0 < -EPS || a1 > L + EPS || b0 < -EPS || b1 > wall.height + EPS) {
        err(
          'OPENING_OUTSIDE_HOST',
          `opening ${o.id} spans ${fmt(a0)}..${fmt(a1)} along and ${fmt(b0)}..${fmt(b1)} up ${where}, which is ${fmt(L)} x ${fmt(wall.height)}`,
          o.id,
        )
        continue
      }
      if (a0 <= EPS || a1 >= L - EPS || b1 >= wall.height - EPS) {
        err(
          'OPENING_TOUCHES_WALL_EDGE',
          `opening ${o.id} touches a side or the top edge of ${where}; an opening must leave wall material on both sides and above it (a sill at the base is allowed)`,
          o.id,
        )
        continue
      }
      const extent = topology.extents.get(wall.id)
      if (extent) {
        const core = physicalCore(extent)
        if (a0 <= core.a0 + EPS || a1 >= core.a1 - EPS) {
          const intrusion = Math.max(core.a0 - a0, a1 - core.a1)
          err(
            'OPENING_IN_JUNCTION_ZONE',
            `opening ${o.id} spans ${fmt(a0)}..${fmt(a1)} m along ${where}, but junctions leave that wall material only between ${fmt(core.a0)} and ${fmt(core.a1)} m; the opening reaches ${fmt(intrusion)} m into a consumed junction zone and was not shrunk`,
            o.id,
            undefined,
            intrusion,
          )
          continue
        }
      }
      const list = byWall.get(wall.id) ?? []
      for (const p of list) {
        if (a0 < p.a1 - EPS && p.a0 < a1 - EPS && b0 < p.b1 - EPS && p.b0 < b1 - EPS) {
          err('OPENINGS_OVERLAP', `openings ${o.id} and ${p.openingId} overlap on ${where}`, o.id)
        }
      }
      list.push({ openingId: o.id, a0, a1, b0, b1 })
      byWall.set(wall.id, list)
    }
  }

  // Fills: one per opening, of the matching kind.
  const filled = new Map<string, string>()
  const fill = (id: string, openingId: string, want: Opening['kind'], sizeCheck: (o: Opening) => string | undefined): void => {
    const o = m.openings.find((x) => x.id === openingId)
    if (!o) {
      err('UNKNOWN_OPENING', `${id} refers to opening "${openingId}", which does not exist`, id, 'openingId')
      return
    }
    if (o.kind !== want) err('FILL_KIND_MISMATCH', `${id} fills opening ${o.id}, which is a ${o.kind} opening, not ${want}`, id)
    const prev = filled.get(openingId)
    if (prev) err('OPENING_FILLED_TWICE', `opening ${openingId} is filled by both ${prev} and ${id}`, id)
    filled.set(openingId, id)
    const problem = sizeCheck(o)
    if (problem) err('FILL_TOO_LARGE', `${id}: ${problem}`, id)
  }
  for (const w of m.windows) {
    needMaterial(w.id, w.materialId)
    needSources(w.id, w.evidence?.sourceIds)
    if (w.mullions) {
      for (let i = 1; i < w.mullions.length; i++) {
        if (w.mullions[i] <= w.mullions[i - 1]) {
          err('SCHEMA', `window ${w.id}: mullion fractions must be strictly increasing`, w.id, 'mullions')
          break
        }
      }
    }
    fill(w.id, w.openingId, 'WINDOW', (o) => {
      const lowest = openingHeadRange(o).min - o.sill
      if (2 * w.frameWidth >= o.width) return `frame width ${w.frameWidth} leaves no glazing in a ${o.width} m wide opening`
      if (2 * w.frameWidth >= lowest) return `frame width ${w.frameWidth} leaves no glazing in an opening only ${fmt(lowest)} m tall at its lowest edge`
      const wall = m.walls.find((x) => x.id === o.wallId)
      if (wall && w.frameInset + w.frameDepth > wall.thickness + EPS) return `frame reaches ${w.frameInset + w.frameDepth} m into a ${wall.thickness} m wall`
      return undefined
    })
  }
  for (const d of m.doors) {
    needMaterial(d.id, d.materialId)
    needSources(d.id, d.evidence?.sourceIds)
    const op = m.openings.find((x) => x.id === d.openingId)
    if (op && openingIsRaked(op)) err('FILL_PROFILE_UNSUPPORTED', `door ${d.id} fills opening ${op.id}, whose head is raked; door fills take level heads only`, d.id)
    if (d.assembly) {
      const sum = d.assembly.panels.reduce((a, p) => a + p.fraction, 0)
      if (Math.abs(sum - 1) > 1e-6) err('DOOR_ASSEMBLY_INVALID', `door ${d.id}: the assembly's panel fractions sum to ${fmt(sum)}, not 1`, d.id, 'assembly.panels')
      if (op) {
        const mullions = (d.assembly.panels.length - 1) * d.assembly.mullionWidth
        if (mullions + 2 * d.frameWidth >= op.width) err('DOOR_ASSEMBLY_INVALID', `door ${d.id}: frame and mullions leave no panel width in a ${op.width} m wide opening`, d.id, 'assembly.mullionWidth')
        for (const [i, panel] of d.assembly.panels.entries()) {
          const clear = panel.fraction * op.width - (i === 0 ? d.frameWidth : d.assembly.mullionWidth / 2) - (i === d.assembly.panels.length - 1 ? d.frameWidth : d.assembly.mullionWidth / 2)
          if (clear <= 0.02) err('DOOR_ASSEMBLY_INVALID', `door ${d.id}: panel ${i} (${panel.kind}) is only ${fmt(clear)} m wide once its frame members are taken out`, d.id, 'assembly.panels')
        }
      }
    }
    fill(d.id, d.openingId, 'DOOR', (o) => {
      if (2 * d.frameWidth >= o.width) return `frame width ${d.frameWidth} leaves no leaf in a ${o.width} m wide opening`
      if (d.frameWidth >= o.height) return `frame width ${d.frameWidth} leaves no leaf in a ${o.height} m tall opening`
      const wall = m.walls.find((x) => x.id === o.wallId)
      if (wall && d.frameInset + d.frameDepth > wall.thickness + EPS) return `frame reaches ${d.frameInset + d.frameDepth} m into a ${wall.thickness} m wall`
      return undefined
    })
  }

  for (const s of m.slabs) {
    needLevel(s.id, s.levelId)
    needMaterial(s.id, s.materialId)
    needSources(s.id, s.evidence?.sourceIds)
    const outerOk = polygonIsSimple(s.polygon)
    if (!outerOk) err('MALFORMED_POLYGON', `slab ${s.id} polygon is not a simple polygon with area`, s.id, 'polygon')
    const holes = s.holes ?? []
    for (const [i, h] of holes.entries()) {
      if (!polygonIsSimple(h)) {
        err('MALFORMED_POLYGON', `slab ${s.id} hole ${i} is not a simple polygon with area`, s.id, `holes.${i}`)
        continue
      }
      if (!outerOk) continue
      // every hole vertex inside or on the outer polygon, no hole edge crossing an outer edge
      const outside = h.filter((q) => !pointInOrOnPolygon(q, s.polygon))
      const crossing = polygonsEdgesCross(h, s.polygon)
      if (outside.length > 0 || crossing) {
        err('SLAB_HOLE_OUTSIDE', `slab ${s.id} hole ${i} is not inside the slab polygon (${outside.length} vertices outside${crossing ? ', edges crossing the outline' : ''})`, s.id, `holes.${i}`)
        continue
      }
      for (let j = 0; j < i; j++) {
        const other = holes[j]
        if (!polygonIsSimple(other)) continue
        const inside = h.some((q) => pointStrictlyInPolygon(q, other)) || other.some((q) => pointStrictlyInPolygon(q, h))
        if (inside || polygonsEdgesCross(h, other)) err('SLAB_HOLES_OVERLAP', `slab ${s.id} holes ${j} and ${i} overlap`, s.id, `holes.${i}`)
      }
    }
  }
  for (const r of m.roofs) {
    needLevel(r.id, r.levelId)
    needMaterial(r.id, r.materialId)
    needSources(r.id, r.evidence?.sourceIds)
    needRect(r.id, r.footprint, 'footprint')
    if (r.kind === 'GABLE' && r.pitchDeg <= 0) err('INVALID_ROOF', `gable roof ${r.id} needs a positive pitch`, r.id, 'pitchDeg')
    if (r.kind === 'FLAT' && r.pitchDeg !== 0) err('INVALID_ROOF', `flat roof ${r.id} must have pitch 0`, r.id, 'pitchDeg')
  }

  // Roof openings: inside the roof's covered area (never touching its edges), within one
  // slope of a gable, not overlapping each other; a penetration's element fits its hole.
  const byRoof = new Map<string, PlanRect[]>()
  for (const o of m.roofOpenings) {
    needSources(o.id, o.evidence?.sourceIds)
    needRect(o.id, o.footprint, 'footprint')
    const roof = m.roofs.find((r) => r.id === o.roofId)
    if (!roof) {
      err('UNKNOWN_ROOF', `roof opening ${o.id} refers to roof "${o.roofId}", which does not exist`, o.id, 'roofId')
      continue
    }
    if (!rectIsValid(o.footprint) || !rectIsValid(roof.footprint)) continue
    const c = roofCoveredRect(roof)
    const f = o.footprint
    // a normal cut's underside outline is shifted uphill: both outlines must lie inside the slope
    const under = roofOpeningUndersideRect(roof, o)
    const hull: PlanRect = { minX: Math.min(f.minX, under.minX), maxX: Math.max(f.maxX, under.maxX), minZ: Math.min(f.minZ, under.minZ), maxZ: Math.max(f.maxZ, under.maxZ) }
    const where = roofCutMode(o) === 'NORMAL_TO_ROOF' ? ' (its underside outline included)' : ''
    if (hull.minX <= c.minX + EPS || hull.maxX >= c.maxX - EPS || hull.minZ <= c.minZ + EPS || hull.maxZ >= c.maxZ - EPS) {
      err(
        'ROOF_OPENING_OUTSIDE_HOST',
        `roof opening ${o.id} spans x ${fmt(hull.minX)}..${fmt(hull.maxX)} z ${fmt(hull.minZ)}..${fmt(hull.maxZ)}${where}, which is not strictly inside the area x ${fmt(c.minX)}..${fmt(c.maxX)} z ${fmt(c.minZ)}..${fmt(c.maxZ)} covered by roof ${roof.id}`,
        o.id,
      )
      continue
    }
    const crease = roofCreaseLine(roof)
    if (crease) {
      const lo = crease.axis === 'X' ? hull.minX : hull.minZ
      const hi = crease.axis === 'X' ? hull.maxX : hull.maxZ
      if (lo < crease.value - EPS ? hi >= crease.value - EPS : lo <= crease.value + EPS) {
        err('ROOF_OPENING_CROSSES_RIDGE', `roof opening ${o.id}${where} crosses or touches the ridge of roof ${roof.id} at ${crease.axis.toLowerCase()} = ${fmt(crease.value)}; an opening lies strictly within one slope`, o.id)
        continue
      }
    }
    if (o.kind === 'PENETRATION' && roofCutMode(o) === 'NORMAL_TO_ROOF') {
      err('ROOF_PENETRATION_MISMATCH', `roof opening ${o.id} is a PENETRATION cut NORMAL_TO_ROOF; a vertical element passes through a VERTICAL cut`, o.id, 'cut')
    }
    for (const p of byRoof.get(roof.id) ?? []) {
      if (f.minX < p.maxX - EPS && p.minX < f.maxX - EPS && f.minZ < p.maxZ - EPS && p.minZ < f.maxZ - EPS) {
        err('ROOF_OPENINGS_OVERLAP', `roof openings ${o.id} and another opening overlap on roof ${roof.id}`, o.id)
      }
    }
    byRoof.set(roof.id, [...(byRoof.get(roof.id) ?? []), f])
    if (o.throughId !== undefined) {
      const chimney = m.chimneys.find((x) => x.id === o.throughId)
      if (!chimney) {
        if (!seen.has(o.throughId)) err('UNKNOWN_TARGET', `roof opening ${o.id} lets "${o.throughId}" through, which does not exist`, o.id, 'throughId')
        else err('ROOF_PENETRATION_MISMATCH', `roof opening ${o.id} lets "${o.throughId}" through, which is not a chimney`, o.id, 'throughId')
        continue
      }
      if (o.kind !== 'PENETRATION') err('ROOF_PENETRATION_MISMATCH', `roof opening ${o.id} names a chimney but is a ${o.kind}; only a PENETRATION lets an element through`, o.id, 'kind')
      const cf = chimney.footprint
      if (cf.minX < f.minX - EPS || cf.maxX > f.maxX + EPS || cf.minZ < f.minZ - EPS || cf.maxZ > f.maxZ + EPS) {
        err('ROOF_PENETRATION_MISMATCH', `roof opening ${o.id} (x ${fmt(f.minX)}..${fmt(f.maxX)} z ${fmt(f.minZ)}..${fmt(f.maxZ)}) does not contain the footprint of chimney ${chimney.id} it lets through`, o.id, 'footprint')
      }
    }
  }
  const roofFilled = new Map<string, string>()
  for (const r of m.rooflights) {
    needMaterial(r.id, r.materialId)
    needSources(r.id, r.evidence?.sourceIds)
    const o = m.roofOpenings.find((x) => x.id === r.roofOpeningId)
    if (!o) {
      err('UNKNOWN_ROOF_OPENING', `rooflight ${r.id} refers to roof opening "${r.roofOpeningId}", which does not exist`, r.id, 'roofOpeningId')
      continue
    }
    if (o.kind !== 'ROOFLIGHT') err('FILL_KIND_MISMATCH', `rooflight ${r.id} fills roof opening ${o.id}, which is a ${o.kind}, not a ROOFLIGHT`, r.id)
    const prev = roofFilled.get(o.id)
    if (prev) err('ROOF_OPENING_FILLED_TWICE', `roof opening ${o.id} is filled by both ${prev} and ${r.id}`, r.id)
    roofFilled.set(o.id, r.id)
    if (rectIsValid(o.footprint) && 2 * r.frameWidth >= Math.min(rectWidth(o.footprint), rectDepth(o.footprint))) {
      err('FILL_TOO_LARGE', `rooflight ${r.id}: frame width ${r.frameWidth} leaves no glazing in a ${fmt(rectWidth(o.footprint))} x ${fmt(rectDepth(o.footprint))} m roof opening`, r.id)
    }
  }
  for (const b of m.balconies) {
    needLevel(b.id, b.levelId)
    needMaterial(b.id, b.materialId)
    needSources(b.id, b.evidence?.sourceIds)
    needRect(b.id, b.footprint, 'footprint')
  }
  for (const r of m.railings) {
    needLevel(r.id, r.levelId)
    needMaterial(r.id, r.materialId)
    needSources(r.id, r.evidence?.sourceIds)
    if (Math.hypot(r.end.x - r.start.x, r.end.z - r.start.z) <= EPS) err('DEGENERATE_RAILING', `railing ${r.id} has zero length`, r.id)
    if (r.hostId !== undefined && !seen.has(r.hostId)) err('UNKNOWN_TARGET', `railing ${r.id} guards "${r.hostId}", which does not exist`, r.id, 'hostId')
  }
  for (const c of m.chimneys) {
    needLevel(c.id, c.levelId)
    needMaterial(c.id, c.materialId)
    needSources(c.id, c.evidence?.sourceIds)
    needRect(c.id, c.footprint, 'footprint')
  }
  for (const s of m.stairs) {
    needLevel(s.id, s.levelId)
    if (!levelIds.has(s.toLevelId)) err('UNKNOWN_LEVEL', `stair ${s.id} leads to level "${s.toLevelId}", which does not exist`, s.id, 'toLevelId')
    needRect(s.id, s.footprint, 'footprint')
    needSources(s.id, s.evidence?.sourceIds)
    if (s.kind !== 'FLIGHTS') continue
    needMaterial(s.id, s.materialId)
    const from = m.levels.find((l) => l.id === s.levelId)
    const to = m.levels.find((l) => l.id === s.toLevelId)
    if (!from || !to) continue
    const layout = layoutStair(s, from, to)
    if (layout.rise <= 1e-9) err('STAIR_RISE_INVALID', `stair ${s.id} does not rise: from ${fmt(layout.baseY)} to ${fmt(layout.topY)}`, s.id, 'topOffset', layout.rise)
    for (const issue of layout.issues) if (!issue.startsWith('the stair must rise')) err('STAIR_LAYOUT_INVALID', `stair ${s.id}: ${issue}`, s.id, 'segments')
    if (layout.extent && rectIsValid(s.footprint)) {
      const e = layout.extent
      const f = s.footprint
      const out = Math.max(f.minX - e.minX, e.maxX - f.maxX, f.minZ - e.minZ, e.maxZ - f.maxZ)
      if (out > 1e-6) {
        err('STAIR_OUTSIDE_FOOTPRINT', `stair ${s.id}: its steps span x ${fmt(e.minX)}..${fmt(e.maxX)} z ${fmt(e.minZ)}..${fmt(e.maxZ)}, ${fmt(out)} m outside the stated footprint x ${fmt(f.minX)}..${fmt(f.maxX)} z ${fmt(f.minZ)}..${fmt(f.maxZ)}`, s.id, 'footprint', out)
      }
    }
  }
  for (const r of m.surfaceRegions) {
    needSources(r.id, r.evidence?.sourceIds)
    if (!materialIds.has(r.materialId)) err('UNKNOWN_MATERIAL', `${r.id} refers to material "${r.materialId}", which does not exist`, r.id, 'materialId')
    const host = m.walls.find((w) => w.id === r.hostId)
    if (!host) {
      if (seen.has(r.hostId)) err('SURFACE_REGION_HOST_INVALID', `surface region ${r.id} is hosted by "${r.hostId}", which is not a wall; regions sit on wall faces`, r.id, 'hostId')
      else err('UNKNOWN_WALL', `surface region ${r.id} refers to wall "${r.hostId}", which does not exist`, r.id, 'hostId')
      continue
    }
    const { a0, a1, b0, b1 } = r.rect
    if (a1 - a0 <= EPS || b1 - b0 <= EPS) {
      err('INVALID_RECT', `surface region ${r.id}: rect a ${fmt(a0)}..${fmt(a1)} b ${fmt(b0)}..${fmt(b1)} has no area`, r.id, 'rect')
      continue
    }
    const L = wallLength(host)
    if (a0 < -EPS || a1 > L + EPS || b0 < -EPS || b1 > host.height + EPS) {
      err('SURFACE_REGION_OUTSIDE_HOST', `surface region ${r.id} spans a ${fmt(a0)}..${fmt(a1)} b ${fmt(b0)}..${fmt(b1)} on wall ${host.id}, which is ${fmt(L)} x ${fmt(host.height)}`, r.id, 'rect')
    }
  }
  for (const c of m.constraints) {
    for (const t of c.targetIds) {
      if (!seen.has(t)) err('UNKNOWN_TARGET', `constraint ${c.id} targets "${t}", which does not exist`, c.id, 'targetIds')
    }
  }
  // Wall ids referenced nowhere else still need their collections consistent.
  void wallIds
  void openingIds
  void OBJECT_COLLECTIONS
  return out
}

const fmt = fmtNumber

// --- plan polygon relations for slab holes ---------------------------------

const onSegment = (p: Vec2, a: Vec2, b: Vec2): boolean => {
  const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
  if (Math.abs(cross) > 1e-9) return false
  return p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.z >= Math.min(a.z, b.z) - 1e-9 && p.z <= Math.max(a.z, b.z) + 1e-9
}

/** Even-odd containment; points on an edge count as inside. */
export function pointInOrOnPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) if (onSegment(p, poly[i], poly[j])) return true
  return pointStrictlyInPolygon(p, poly)
}

/** Even-odd containment; points on an edge count as outside. */
export function pointStrictlyInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) if (onSegment(p, poly[i], poly[j])) return false
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

const orient = (a: Vec2, b: Vec2, c: Vec2): number => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)

/** True when an edge of `a` properly crosses an edge of `b` (touching and collinear overlap are not crossings). */
export function polygonsEdgesCross(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  const eps = 1e-9
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i]
    const p2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      const q1 = b[j]
      const q2 = b[(j + 1) % b.length]
      const d1 = orient(q1, q2, p1)
      const d2 = orient(q1, q2, p2)
      const d3 = orient(p1, p2, q1)
      const d4 = orient(p1, p2, q2)
      if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true
    }
  }
  return false
}

/** Throw with every issue listed when the model is invalid. */
export function assertValidModel(input: unknown): CanonicalBuildingModel {
  const r = validateModel(input)
  if (!r.ok || !r.model) {
    throw new Error(`invalid CanonicalBuildingModel:\n${r.issues.map((i) => `  [${i.code}] ${i.message}`).join('\n')}`)
  }
  return r.model
}
