/**
 * Runtime validation of a CanonicalBuildingModel.
 *
 * Two layers: the Zod schema (shape, numeric domains, enumerations) and the
 * semantic checks below (references resolve, openings sit inside their host
 * wall, polygons are simple, no two objects share an id, ...). Nothing here
 * repairs anything: a problem is reported with the id of the object it is
 * about and the code a caller can act on.
 */
import { polygonIsSimple, rectIsValid, type PlanRect } from './geometry-types.js'
import { fmtNumber, type ValidationCode, type ValidationIssue, type ValidationResult } from './issues.js'
import { migrateModelInput } from './migrate.js'
import { allObjectIds, wallLength } from './query.js'
import {
  CanonicalBuildingModelSchema,
  OBJECT_COLLECTIONS,
  type CanonicalBuildingModel,
  type Opening,
} from './schema.js'
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
  // into a junction zone, not overlapping each other.
  const byWall = new Map<string, Opening[]>()
  for (const o of m.openings) {
    needSources(o.id, o.evidence?.sourceIds)
    const wall = m.walls.find((w) => w.id === o.wallId)
    if (!wall) {
      err('UNKNOWN_WALL', `opening ${o.id} refers to wall "${o.wallId}", which does not exist`, o.id, 'wallId')
      continue
    }
    const L = wallLength(wall)
    const a0 = o.offset
    const a1 = o.offset + o.width
    const b0 = o.sill
    const b1 = o.sill + o.height
    if (a0 < -EPS || a1 > L + EPS || b0 < -EPS || b1 > wall.height + EPS) {
      err(
        'OPENING_OUTSIDE_HOST',
        `opening ${o.id} spans ${fmt(a0)}..${fmt(a1)} along and ${fmt(b0)}..${fmt(b1)} up wall ${wall.id}, which is ${fmt(L)} x ${fmt(wall.height)}`,
        o.id,
      )
      continue
    }
    if (a0 <= EPS || a1 >= L - EPS || b1 >= wall.height - EPS) {
      err(
        'OPENING_TOUCHES_WALL_EDGE',
        `opening ${o.id} touches a side or the top edge of wall ${wall.id}; an opening must leave wall material on both sides and above it (a sill at the base is allowed)`,
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
          `opening ${o.id} spans ${fmt(a0)}..${fmt(a1)} m along wall ${wall.id}, but junctions leave that wall material only between ${fmt(core.a0)} and ${fmt(core.a1)} m; the opening reaches ${fmt(intrusion)} m into a consumed junction zone and was not shrunk`,
          o.id,
          undefined,
          intrusion,
        )
        continue
      }
    }
    const list = byWall.get(wall.id) ?? []
    for (const p of list) {
      const pa0 = p.offset
      const pa1 = p.offset + p.width
      const pb0 = p.sill
      const pb1 = p.sill + p.height
      if (a0 < pa1 - EPS && pa0 < a1 - EPS && b0 < pb1 - EPS && pb0 < b1 - EPS) {
        err('OPENINGS_OVERLAP', `openings ${o.id} and ${p.id} overlap on wall ${wall.id}`, o.id)
      }
    }
    list.push(o)
    byWall.set(wall.id, list)
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
    fill(w.id, w.openingId, 'WINDOW', (o) => {
      if (2 * w.frameWidth >= o.width) return `frame width ${w.frameWidth} leaves no glazing in a ${o.width} m wide opening`
      if (2 * w.frameWidth >= o.height) return `frame width ${w.frameWidth} leaves no glazing in a ${o.height} m tall opening`
      const wall = m.walls.find((x) => x.id === o.wallId)
      if (wall && w.frameInset + w.frameDepth > wall.thickness + EPS) return `frame reaches ${w.frameInset + w.frameDepth} m into a ${wall.thickness} m wall`
      return undefined
    })
  }
  for (const d of m.doors) {
    needMaterial(d.id, d.materialId)
    needSources(d.id, d.evidence?.sourceIds)
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
    if (!polygonIsSimple(s.polygon)) err('MALFORMED_POLYGON', `slab ${s.id} polygon is not a simple polygon with area`, s.id, 'polygon')
  }
  for (const r of m.roofs) {
    needLevel(r.id, r.levelId)
    needMaterial(r.id, r.materialId)
    needSources(r.id, r.evidence?.sourceIds)
    needRect(r.id, r.footprint, 'footprint')
    if (r.kind === 'GABLE' && r.pitchDeg <= 0) err('INVALID_ROOF', `gable roof ${r.id} needs a positive pitch`, r.id, 'pitchDeg')
    if (r.kind === 'FLAT' && r.pitchDeg !== 0) err('INVALID_ROOF', `flat roof ${r.id} must have pitch 0`, r.id, 'pitchDeg')
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

/** Throw with every issue listed when the model is invalid. */
export function assertValidModel(input: unknown): CanonicalBuildingModel {
  const r = validateModel(input)
  if (!r.ok || !r.model) {
    throw new Error(`invalid CanonicalBuildingModel:\n${r.issues.map((i) => `  [${i.code}] ${i.message}`).join('\n')}`)
  }
  return r.model
}
