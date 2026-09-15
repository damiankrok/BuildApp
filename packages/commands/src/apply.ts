/**
 * Command execution: `applyCommand(model, command)` returns a new model or a
 * list of errors. The input model is never mutated, so undo is a matter of
 * keeping the previous model.
 *
 * Every successful command leaves the model valid: after the change is
 * drafted the whole model is re-validated, and a draft with any error is
 * discarded and reported. That is the single place where "an opening refers
 * to a wall that does not exist" or "the door is wider than its wall" turn
 * into useful errors, whoever issued the command.
 */
import {
  BalconySchema,
  ChimneySchema,
  ConstraintSchema,
  DoorSchema,
  LevelSchema,
  MaterialSchema,
  OpeningSchema,
  RailingSchema,
  RoofOpeningSchema,
  RooflightSchema,
  RoofSchema,
  RoomSchema,
  SlabSchema,
  StairSchema,
  WallSchema,
  WallJunctionSchema,
  WallRingSchema,
  WindowSchema,
  BuildingSchema,
  EvidenceSourceSchema,
  findObject,
  junctionWallIds,
  nextId,
  polygonIsSimple,
  polygonSignedArea,
  semanticIssues,
  wallLength,
  type CanonicalBuildingModel,
  type Level,
  type Opening,
  type PlanRect,
  type SemanticKind,
  type Vec2,
  type Wall,
  type ValidationIssue,
} from '@buildapp/model'
import type { ZodTypeAny } from 'zod'
import { BuildingCommandSchema, type BuildingCommand, type ResolvedCommand } from './commands.js'

export type CommandError = { code: string; message: string; objectId?: string; path?: string }

export type CommandSuccess = {
  ok: true
  model: CanonicalBuildingModel
  command: ResolvedCommand
  createdIds: string[]
  changedIds: string[]
  removedIds: string[]
  warnings: ValidationIssue[]
}
export type CommandFailure = { ok: false; errors: CommandError[]; command?: ResolvedCommand }
export type CommandResult = CommandSuccess | CommandFailure

type Draft = {
  model: CanonicalBuildingModel
  created: string[]
  changed: string[]
  removed: string[]
  errors: CommandError[]
}

const SCHEMA_OF: Record<Exclude<SemanticKind, 'building'>, ZodTypeAny> & { building: ZodTypeAny } = {
  building: BuildingSchema,
  level: LevelSchema,
  room: RoomSchema,
  wall: WallSchema,
  wallJunction: WallJunctionSchema,
  wallRing: WallRingSchema,
  opening: OpeningSchema,
  window: WindowSchema,
  door: DoorSchema,
  slab: SlabSchema,
  roof: RoofSchema,
  roofOpening: RoofOpeningSchema,
  rooflight: RooflightSchema,
  balcony: BalconySchema,
  railing: RailingSchema,
  chimney: ChimneySchema,
  stair: StairSchema,
  material: MaterialSchema,
  constraint: ConstraintSchema,
  evidenceSource: EvidenceSourceSchema,
}

const MATERIAL_TAKERS: readonly SemanticKind[] = ['wall', 'window', 'door', 'slab', 'roof', 'rooflight', 'balcony', 'railing', 'chimney']

const stripUndefined = <T extends object>(o: T): T => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as T
}

export function applyCommand(model: CanonicalBuildingModel, input: BuildingCommand): CommandResult {
  const parsed = BuildingCommandSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ code: 'INVALID_COMMAND', message: i.message, path: i.path.join('.') })),
    }
  }
  const command = parsed.data
  const d: Draft = { model: { ...model }, created: [], changed: [], removed: [], errors: [] }
  try {
    execute(d, command)
  } catch (e) {
    d.errors.push({ code: 'COMMAND_FAILED', message: (e as Error).message })
  }
  if (d.errors.length > 0) return { ok: false, errors: d.errors, command }

  const issues = semanticIssues(d.model)
  const errors = issues.filter((i) => i.severity === 'ERROR')
  if (errors.length > 0) {
    return {
      ok: false,
      command,
      errors: errors.map((i) => ({ code: i.code, message: i.message, objectId: i.objectId, path: i.path })),
    }
  }
  return {
    ok: true,
    model: d.model,
    command,
    createdIds: d.created,
    changedIds: d.changed,
    removedIds: d.removed,
    warnings: issues.filter((i) => i.severity === 'WARNING'),
  }
}

/** Apply a sequence; stops at the first failure and reports where. */
export function applyCommands(
  model: CanonicalBuildingModel,
  commands: readonly BuildingCommand[],
): { model: CanonicalBuildingModel; results: CommandResult[]; failedAt?: number } {
  const results: CommandResult[] = []
  let current = model
  for (let i = 0; i < commands.length; i++) {
    const r = applyCommand(current, commands[i])
    results.push(r)
    if (!r.ok) return { model: current, results, failedAt: i }
    current = r.model
  }
  return { model: current, results }
}

/** Apply a sequence and throw on the first failure. For fixtures and scripts. */
export function runCommands(model: CanonicalBuildingModel, commands: readonly BuildingCommand[]): CanonicalBuildingModel {
  const r = applyCommands(model, commands)
  if (r.failedAt !== undefined) {
    const failure = r.results[r.failedAt] as CommandFailure
    const cmd = commands[r.failedAt] as { type: string }
    throw new Error(
      `command ${r.failedAt} (${cmd.type}) failed:\n${failure.errors.map((e) => `  [${e.code}] ${e.message}`).join('\n')}`,
    )
  }
  return r.model
}

// ---------------------------------------------------------------------------

function execute(d: Draft, c: ResolvedCommand): void {
  const m = d.model
  const fail = (code: string, message: string, objectId?: string): void => {
    d.errors.push({ code, message, objectId })
  }
  const add = <K extends keyof CanonicalBuildingModel>(collection: K, kind: SemanticKind, obj: { id?: string } & Record<string, unknown>): string => {
    const id = nextId(m, kind, obj.id)
    const record = stripUndefined({ ...obj, id })
    ;(m as unknown as Record<string, unknown[]>)[collection as string] = [...(m[collection] as unknown as unknown[]), record]
    d.created.push(id)
    return id
  }
  const replace = <K extends keyof CanonicalBuildingModel>(collection: K, id: string, next: object): void => {
    ;(m as unknown as Record<string, unknown[]>)[collection as string] = (m[collection] as unknown as { id: string }[]).map((o) =>
      o.id === id ? stripUndefined(next) : o,
    )
    if (!d.changed.includes(id)) d.changed.push(id)
  }
  const common = (c: { name?: string; evidence?: unknown; tags?: string[] }): Record<string, unknown> => ({
    name: c.name,
    evidence: c.evidence,
    tags: c.tags,
  })

  switch (c.type) {
    case 'createBuilding': {
      if (m.building) return fail('BUILDING_EXISTS', `the model already has building ${m.building.id}`, m.building.id)
      const id = nextId(m, 'building', c.id)
      m.building = stripUndefined({ id, ...common(c), note: c.note })
      d.created.push(id)
      return
    }
    case 'createLevel': {
      if (!m.building) return fail('MISSING_BUILDING', 'create a building before creating levels')
      add('levels', 'level', { id: c.id, ...common(c), buildingId: m.building.id, index: c.index, elevation: c.elevation, height: c.height })
      return
    }
    case 'createRoom':
      add('rooms', 'room', { id: c.id, ...common(c), levelId: c.levelId, polygon: c.polygon, usage: c.usage })
      return
    case 'createWall': {
      const wallId = add('walls', 'wall', {
        id: c.id,
        ...common(c),
        levelId: c.levelId,
        start: c.start,
        end: c.end,
        thickness: c.thickness,
        height: c.height,
        baseOffset: c.baseOffset,
        kind: c.kind,
        topProfile: c.topProfile,
        materialId: c.materialId,
      })
      for (const [end, spec] of [
        ['START', c.startJunction],
        ['END', c.endJunction],
      ] as const) {
        if (!spec) continue
        const id = spec.id ?? `${wallId}-j-${end.toLowerCase()}`
        if (spec.kind === 'CORNER') {
          add('wallJunctions', 'wallJunction', {
            id,
            kind: 'CORNER',
            a: { wallId, end },
            b: spec.with,
            owner: spec.owner === 'SELF' ? wallId : spec.with.wallId,
            tolerance: spec.tolerance,
          })
        } else {
          add('wallJunctions', 'wallJunction', { id, kind: spec.kind, wall: { wallId, end }, againstWallId: spec.againstWallId, tolerance: spec.tolerance })
        }
      }
      return
    }
    case 'createWallJunction': {
      if (c.kind === 'CORNER') {
        if (!c.a || !c.b) return fail('INVALID_COMMAND', 'createWallJunction CORNER needs the two wall ends `a` and `b`')
        if (c.wall || c.againstWallId) return fail('INVALID_COMMAND', 'createWallJunction CORNER takes `a`, `b` and `owner`, not `wall` / `againstWallId`')
        add('wallJunctions', 'wallJunction', { id: c.id, ...common(c), kind: 'CORNER', a: c.a, b: c.b, owner: c.owner ?? c.a.wallId, tolerance: c.tolerance })
        return
      }
      if (!c.wall || !c.againstWallId) return fail('INVALID_COMMAND', `createWallJunction ${c.kind} needs the terminating \`wall\` end and \`againstWallId\``)
      if (c.a || c.b || c.owner) return fail('INVALID_COMMAND', `createWallJunction ${c.kind} takes \`wall\` and \`againstWallId\`, not \`a\` / \`b\` / \`owner\``)
      add('wallJunctions', 'wallJunction', { id: c.id, ...common(c), kind: c.kind, wall: c.wall, againstWallId: c.againstWallId, tolerance: c.tolerance })
      return
    }
    case 'createWallRing': {
      if (!polygonIsSimple(c.polygon)) return fail('RING_DEGENERATE', 'createWallRing: the footprint polygon must be a simple polygon with area')
      // The wall convention puts material to the left of travel, so the ring is
      // traversed with positive signed area; a clockwise footprint is reversed
      // and its per-edge overrides follow their edges.
      const n = c.polygon.length
      let polygon = c.polygon
      let overrides = c.walls ?? []
      if (polygonSignedArea(polygon) < 0) {
        polygon = [polygon[0], ...polygon.slice(1).reverse()]
        const mapped: typeof overrides = []
        for (let i = 0; i < n; i++) if (overrides[i]) mapped[(n - 1 - i) % n] = overrides[i]
        overrides = mapped
      }
      const ringId = nextId(m, 'wallRing', c.id)
      const wallIds = polygon.map((_, i) => overrides[i]?.id ?? `${ringId}-w${i}`)
      const junctionIds = polygon.map((_, i) => `${ringId}-j${i}`)
      for (let i = 0; i < n; i++) {
        const o = overrides[i] ?? {}
        add('walls', 'wall', {
          id: wallIds[i],
          name: o.name,
          evidence: o.evidence ?? c.evidence,
          tags: o.tags ?? c.tags,
          levelId: c.levelId,
          start: polygon[i],
          end: polygon[(i + 1) % n],
          thickness: o.thickness ?? c.thickness,
          height: o.height ?? c.height,
          baseOffset: c.baseOffset,
          kind: c.kind,
          topProfile: o.topProfile ?? c.topProfile,
          materialId: o.materialId ?? c.materialId,
        })
      }
      for (let i = 0; i < n; i++) {
        const prev = wallIds[(i + n - 1) % n]
        const cur = wallIds[i]
        const owner = c.cornerOwnership === 'PRECEDING' ? prev : c.cornerOwnership === 'FOLLOWING' ? cur : i % 2 === 0 ? cur : prev
        add('wallJunctions', 'wallJunction', {
          id: junctionIds[i],
          evidence: c.evidence,
          kind: 'CORNER',
          a: { wallId: prev, end: 'END' },
          b: { wallId: cur, end: 'START' },
          owner,
          tolerance: c.tolerance,
        })
      }
      add('wallRings', 'wallRing', { id: ringId, ...common(c), levelId: c.levelId, wallIds, junctionIds })
      return
    }
    case 'createSlab':
      add('slabs', 'slab', { id: c.id, ...common(c), levelId: c.levelId, polygon: c.polygon, topOffset: c.topOffset, thickness: c.thickness, materialId: c.materialId })
      return
    case 'createRoof': {
      const id = add('roofs', 'roof', {
        id: c.id,
        ...common(c),
        levelId: c.levelId,
        kind: c.kind,
        footprint: c.footprint,
        eaveOffset: c.eaveOffset,
        pitchDeg: c.kind === 'FLAT' ? 0 : c.pitchDeg,
        ridgeAxis: c.ridgeAxis,
        overhang: c.overhang,
        thickness: c.thickness,
        materialId: c.materialId,
      })
      for (const wallId of c.capWallIds) {
        const w = m.walls.find((x) => x.id === wallId)
        if (!w) return fail('UNKNOWN_WALL', `createRoof: capWallIds names wall "${wallId}", which does not exist`, wallId)
        replace('walls', wallId, { ...w, topProfile: { kind: 'FOLLOW_ROOF', roofId: id } })
      }
      return
    }
    case 'cutOpening':
      add('openings', 'opening', {
        id: c.id,
        ...common(c),
        wallId: c.wallId,
        kind: c.kind,
        offset: c.offset,
        sill: c.sill,
        width: c.width,
        height: c.height,
        head: c.head,
        leaves: c.leaves,
      })
      return
    case 'placeWindow':
      add('windows', 'window', {
        id: c.id,
        ...common(c),
        openingId: c.openingId,
        frameWidth: c.frameWidth,
        frameDepth: c.frameDepth,
        frameInset: c.frameInset,
        glassThickness: c.glassThickness,
        divisions: c.divisions,
        mullions: c.mullions,
        materialId: c.materialId,
      })
      return
    case 'cutRoofOpening':
      add('roofOpenings', 'roofOpening', { id: c.id, ...common(c), roofId: c.roofId, kind: c.kind, footprint: c.footprint, throughId: c.throughId })
      return
    case 'placeRooflight':
      add('rooflights', 'rooflight', { id: c.id, ...common(c), roofOpeningId: c.roofOpeningId, frameWidth: c.frameWidth, glassThickness: c.glassThickness, materialId: c.materialId })
      return
    case 'placeDoor':
      add('doors', 'door', {
        id: c.id,
        ...common(c),
        openingId: c.openingId,
        hingeSide: c.hingeSide,
        swing: c.swing,
        openAngle: c.openAngle,
        leafThickness: c.leafThickness,
        frameWidth: c.frameWidth,
        frameDepth: c.frameDepth,
        frameInset: c.frameInset,
        materialId: c.materialId,
      })
      return
    case 'createBalcony':
      add('balconies', 'balcony', { id: c.id, ...common(c), levelId: c.levelId, kind: c.kind, footprint: c.footprint, topOffset: c.topOffset, thickness: c.thickness, materialId: c.materialId })
      return
    case 'createRailing':
      add('railings', 'railing', {
        id: c.id,
        ...common(c),
        levelId: c.levelId,
        start: c.start,
        end: c.end,
        baseOffset: c.baseOffset,
        height: c.height,
        postSpacing: c.postSpacing,
        infill: c.infill,
        hostId: c.hostId,
        materialId: c.materialId,
      })
      return
    case 'placeChimney':
      add('chimneys', 'chimney', { id: c.id, ...common(c), levelId: c.levelId, footprint: c.footprint, baseOffset: c.baseOffset, height: c.height, materialId: c.materialId })
      return
    case 'createStairPlaceholder':
      add('stairs', 'stair', { id: c.id, ...common(c), levelId: c.levelId, toLevelId: c.toLevelId, footprint: c.footprint, kind: 'PLACEHOLDER' })
      return
    case 'defineMaterial':
      add('materials', 'material', { id: c.id, name: c.name, color: c.color, opacity: c.opacity, note: c.note })
      return
    case 'addEvidenceSource':
      add('evidenceSources', 'evidenceSource', { id: c.id, kind: c.kind, label: c.label, uri: c.uri, note: c.note })
      return
    case 'addConstraint':
      add('constraints', 'constraint', { id: c.id, ...common(c), kind: c.kind, targetIds: c.targetIds, property: c.property, value: c.value, tolerance: c.tolerance, note: c.note })
      return
    case 'setModelName':
      m.name = c.name
      return
    case 'assignMaterial': {
      const hit = findObject(m, c.targetId)
      if (!hit) return fail('UNKNOWN_TARGET', `assignMaterial: "${c.targetId}" does not exist`, c.targetId)
      if (!MATERIAL_TAKERS.includes(hit.kind)) {
        return fail('UNSUPPORTED_TARGET', `a ${hit.kind} does not take a material`, c.targetId)
      }
      replace(hit.collection as keyof CanonicalBuildingModel, c.targetId, { ...hit.object, materialId: c.materialId ?? undefined })
      return
    }
    case 'setEvidence': {
      const hit = findObject(m, c.targetId)
      if (!hit) return fail('UNKNOWN_TARGET', `setEvidence: "${c.targetId}" does not exist`, c.targetId)
      if (hit.collection === 'building') {
        m.building = { ...m.building!, evidence: c.evidence }
        d.changed.push(c.targetId)
        return
      }
      if (hit.kind === 'material' || hit.kind === 'evidenceSource') return fail('UNSUPPORTED_TARGET', `a ${hit.kind} carries no evidence`, c.targetId)
      replace(hit.collection as keyof CanonicalBuildingModel, c.targetId, { ...hit.object, evidence: c.evidence })
      return
    }
    case 'setProperty': {
      const hit = findObject(m, c.targetId)
      if (!hit) return fail('UNKNOWN_TARGET', `setProperty: "${c.targetId}" does not exist`, c.targetId)
      if (c.property === 'id') return fail('IMMUTABLE_PROPERTY', 'ids are stable and cannot be changed', c.targetId)
      const next = setPath(hit.object as unknown as Record<string, unknown>, c.property, c.value)
      const check = SCHEMA_OF[hit.kind].safeParse(next)
      if (!check.success) {
        for (const i of check.error.issues) fail('INVALID_PROPERTY', `${c.targetId}.${c.property}: ${i.message}`, c.targetId)
        return
      }
      if (hit.collection === 'building') {
        m.building = check.data
        d.changed.push(c.targetId)
      } else {
        replace(hit.collection as keyof CanonicalBuildingModel, c.targetId, check.data)
      }
      return
    }
    case 'moveFeature':
      return move(d, c)
    case 'resizeFeature':
      return resize(d, c)
    case 'removeFeature':
      return remove(d, c.targetId, c.cascade)
    default: {
      const never: never = c
      throw new Error(`unhandled command ${(never as { type: string }).type}`)
    }
  }
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.')
  const clone = (o: Record<string, unknown>, i: number): Record<string, unknown> => {
    const key = parts[i]
    if (i === parts.length - 1) {
      const out = { ...o }
      if (value === undefined) delete out[key]
      else out[key] = value
      return out
    }
    const child = o[key]
    const nextChild = child && typeof child === 'object' && !Array.isArray(child) ? (child as Record<string, unknown>) : {}
    return { ...o, [key]: clone(nextChild, i + 1) }
  }
  return clone(obj, 0)
}

const shift = (p: Vec2, dx: number, dz: number): Vec2 => ({ x: p.x + dx, z: p.z + dz })
const shiftRect = (r: PlanRect, dx: number, dz: number): PlanRect => ({ minX: r.minX + dx, maxX: r.maxX + dx, minZ: r.minZ + dz, maxZ: r.maxZ + dz })

function move(d: Draft, c: Extract<ResolvedCommand, { type: 'moveFeature' }>): void {
  const m = d.model
  const hit = findObject(m, c.targetId)
  if (!hit) return void d.errors.push({ code: 'UNKNOWN_TARGET', message: `moveFeature: "${c.targetId}" does not exist`, objectId: c.targetId })
  const put = (next: object): void => {
    ;(m as unknown as Record<string, unknown[]>)[hit.collection] = (m[hit.collection as keyof CanonicalBuildingModel] as unknown as { id: string }[]).map((o) =>
      o.id === c.targetId ? next : o,
    )
    d.changed.push(c.targetId)
  }
  const o = hit.object as unknown as Record<string, unknown>
  switch (hit.kind) {
    case 'level':
      return put({ ...(o as unknown as Level), elevation: (o.elevation as number) + c.dy })
    case 'wall':
    case 'railing':
      return put({ ...o, start: shift(o.start as Vec2, c.dx, c.dz), end: shift(o.end as Vec2, c.dx, c.dz), baseOffset: (o.baseOffset as number) + c.dy })
    case 'opening': {
      // Further leaves move the same distance along their own walls, in the direction that keeps the passage aligned.
      const opening = o as unknown as Opening
      const host = m.walls.find((w) => w.id === opening.wallId)
      const dirOf = (w: Wall): Vec2 => {
        const L = wallLength(w)
        return { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
      }
      const leaves = opening.leaves?.map((leaf) => {
        const w = m.walls.find((x) => x.id === leaf.wallId)
        if (!w || !host) return leaf
        const u0 = dirOf(host)
        const u1 = dirOf(w)
        const sign = u0.x * u1.x + u0.z * u1.z >= 0 ? 1 : -1
        return { ...leaf, offset: leaf.offset + sign * c.dAlong }
      })
      return put(stripUndefined({ ...o, offset: (o.offset as number) + c.dAlong, sill: (o.sill as number) + c.dy, leaves }))
    }
    case 'roofOpening':
      return put({ ...o, footprint: shiftRect(o.footprint as PlanRect, c.dx, c.dz) })
    case 'room':
      return put({ ...o, polygon: (o.polygon as Vec2[]).map((p) => shift(p, c.dx, c.dz)) })
    case 'slab':
      return put({ ...o, polygon: (o.polygon as Vec2[]).map((p) => shift(p, c.dx, c.dz)), topOffset: (o.topOffset as number) + c.dy })
    case 'roof':
      return put({ ...o, footprint: shiftRect(o.footprint as PlanRect, c.dx, c.dz), eaveOffset: (o.eaveOffset as number) + c.dy })
    case 'balcony':
      return put({ ...o, footprint: shiftRect(o.footprint as PlanRect, c.dx, c.dz), topOffset: (o.topOffset as number) + c.dy })
    case 'chimney':
      return put({ ...o, footprint: shiftRect(o.footprint as PlanRect, c.dx, c.dz), baseOffset: (o.baseOffset as number) + c.dy })
    case 'stair':
      return put({ ...o, footprint: shiftRect(o.footprint as PlanRect, c.dx, c.dz) })
    default:
      d.errors.push({ code: 'UNSUPPORTED_TARGET', message: `a ${hit.kind} cannot be moved on its own (move its host instead)`, objectId: c.targetId })
  }
}

function resize(d: Draft, c: Extract<ResolvedCommand, { type: 'resizeFeature' }>): void {
  const m = d.model
  const hit = findObject(m, c.targetId)
  if (!hit) return void d.errors.push({ code: 'UNKNOWN_TARGET', message: `resizeFeature: "${c.targetId}" does not exist`, objectId: c.targetId })
  const o = hit.object as unknown as Record<string, unknown>
  const given = (['width', 'height', 'thickness', 'length', 'footprint'] as const).filter((k) => c[k] !== undefined)
  const allowed: Record<string, readonly string[]> = {
    wall: ['length', 'thickness', 'height'],
    opening: ['width', 'height'],
    railing: ['length', 'height'],
    roof: ['footprint', 'thickness'],
    roofOpening: ['footprint'],
    balcony: ['footprint', 'thickness'],
    chimney: ['footprint', 'height'],
    stair: ['footprint'],
    slab: ['thickness'],
    level: ['height'],
  }
  const ok = allowed[hit.kind]
  if (!ok) return void d.errors.push({ code: 'UNSUPPORTED_TARGET', message: `a ${hit.kind} cannot be resized`, objectId: c.targetId })
  const bad = given.filter((k) => !ok.includes(k))
  if (bad.length > 0) {
    return void d.errors.push({ code: 'UNSUPPORTED_RESIZE', message: `a ${hit.kind} has no ${bad.join(', ')} to resize (it takes ${ok.join(', ')})`, objectId: c.targetId })
  }
  if (given.length === 0) return void d.errors.push({ code: 'NOTHING_TO_RESIZE', message: 'resizeFeature: state at least one dimension', objectId: c.targetId })
  let next: Record<string, unknown> = { ...o }
  if (c.length !== undefined) {
    const w = o as unknown as Wall
    const L = wallLength(w)
    const ux = (w.end.x - w.start.x) / L
    const uz = (w.end.z - w.start.z) / L
    next = { ...next, end: { x: w.start.x + ux * c.length, z: w.start.z + uz * c.length } }
  }
  for (const k of ['width', 'height', 'thickness', 'footprint'] as const) if (c[k] !== undefined) next[k] = c[k]
  const check = SCHEMA_OF[hit.kind].safeParse(next)
  if (!check.success) {
    for (const i of check.error.issues) d.errors.push({ code: 'INVALID_PROPERTY', message: `${c.targetId}: ${i.message}`, objectId: c.targetId })
    return
  }
  ;(m as unknown as Record<string, unknown[]>)[hit.collection] = (m[hit.collection as keyof CanonicalBuildingModel] as unknown as { id: string }[]).map((x) =>
    x.id === c.targetId ? check.data : x,
  )
  d.changed.push(c.targetId)
}

/**
 * Remove an object and, with `cascade`, everything that depends on it:
 * a wall's openings and their fills, a level's every feature, an opening's
 * fill, a material's assignments, a roof's FOLLOW_ROOF profiles.
 */
function remove(d: Draft, targetId: string, cascade: boolean): void {
  const m = d.model
  const hit = findObject(m, targetId)
  if (!hit) return void d.errors.push({ code: 'UNKNOWN_TARGET', message: `removeFeature: "${targetId}" does not exist`, objectId: targetId })

  const toRemove = new Set<string>([targetId])
  const dependants = (id: string): string[] => {
    const out: string[] = []
    const k = findObject(m, id)?.kind
    if (k === 'building') for (const l of m.levels) out.push(l.id)
    if (k === 'level') {
      for (const list of [m.rooms, m.walls, m.slabs, m.roofs, m.balconies, m.railings, m.chimneys, m.stairs]) {
        for (const o of list as { id: string; levelId: string }[]) if (o.levelId === id) out.push(o.id)
      }
      for (const s of m.stairs) if (s.toLevelId === id) out.push(s.id)
    }
    if (k === 'wall') {
      for (const o of m.openings) if (o.wallId === id) out.push(o.id)
      for (const j of m.wallJunctions) if (junctionWallIds(j).includes(id)) out.push(j.id)
      for (const r of m.wallRings) if (r.wallIds.includes(id)) out.push(r.id)
    }
    if (k === 'roof') for (const o of m.roofOpenings) if (o.roofId === id) out.push(o.id)
    if (k === 'roofOpening') for (const r of m.rooflights) if (r.roofOpeningId === id) out.push(r.id)
    if (k === 'chimney') for (const o of m.roofOpenings) if (o.throughId === id) out.push(o.id)
    if (k === 'wallJunction') for (const r of m.wallRings) if (r.junctionIds.includes(id)) out.push(r.id)
    if (k === 'level') for (const r of m.wallRings) if (r.levelId === id) out.push(r.id)
    if (k === 'opening') {
      for (const w of m.windows) if (w.openingId === id) out.push(w.id)
      for (const x of m.doors) if (x.openingId === id) out.push(x.id)
    }
    return out
  }
  const queue = [targetId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const dep of dependants(id)) {
      if (toRemove.has(dep)) continue
      if (!cascade) {
        return void d.errors.push({
          code: 'DEPENDANTS_EXIST',
          message: `cannot remove ${targetId}: ${dep} depends on it (use cascade to remove dependants too)`,
          objectId: targetId,
        })
      }
      toRemove.add(dep)
      queue.push(dep)
    }
  }

  const removedKinds = new Map<string, SemanticKind>()
  for (const id of toRemove) removedKinds.set(id, findObject(m, id)!.kind)

  if (removedKinds.get(targetId) === 'building') m.building = null
  const keep = <T extends { id: string }>(list: readonly T[]): T[] => list.filter((o) => !toRemove.has(o.id))
  m.levels = keep(m.levels)
  m.rooms = keep(m.rooms)
  m.walls = keep(m.walls)
  m.wallJunctions = keep(m.wallJunctions)
  m.wallRings = keep(m.wallRings)
  m.openings = keep(m.openings)
  m.windows = keep(m.windows)
  m.doors = keep(m.doors)
  m.slabs = keep(m.slabs)
  m.roofs = keep(m.roofs)
  m.roofOpenings = keep(m.roofOpenings)
  m.rooflights = keep(m.rooflights)
  m.balconies = keep(m.balconies)
  m.railings = keep(m.railings)
  m.chimneys = keep(m.chimneys)
  m.stairs = keep(m.stairs)
  m.materials = keep(m.materials)
  m.constraints = keep(m.constraints)
  m.evidenceSources = keep(m.evidenceSources)

  // Loosen references that pointed at removed objects without being dependants.
  const removedMaterials = [...toRemove].filter((id) => removedKinds.get(id) === 'material')
  const removedRoofs = [...toRemove].filter((id) => removedKinds.get(id) === 'roof')
  const removedSources = [...toRemove].filter((id) => removedKinds.get(id) === 'evidenceSource')
  const fixMaterial = <T extends { id: string; materialId?: string }>(list: T[]): T[] =>
    list.map((o) => {
      if (o.materialId !== undefined && removedMaterials.includes(o.materialId)) {
        d.changed.push(o.id)
        return stripUndefined({ ...o, materialId: undefined })
      }
      return o
    })
  m.walls = fixMaterial(m.walls).map((w) => {
    if (w.topProfile?.kind === 'FOLLOW_ROOF' && removedRoofs.includes(w.topProfile.roofId)) {
      d.changed.push(w.id)
      return { ...w, topProfile: { kind: 'FLAT' as const } }
    }
    return w
  })
  m.windows = fixMaterial(m.windows)
  m.doors = fixMaterial(m.doors)
  m.slabs = fixMaterial(m.slabs)
  m.roofs = fixMaterial(m.roofs)
  m.rooflights = fixMaterial(m.rooflights)
  m.balconies = fixMaterial(m.balconies)
  // An opening keeps its other leaves when one leaf wall goes.
  m.openings = m.openings.map((o) => {
    if (!o.leaves || !o.leaves.some((l) => toRemove.has(l.wallId))) return o
    d.changed.push(o.id)
    const leaves = o.leaves.filter((l) => !toRemove.has(l.wallId))
    return stripUndefined({ ...o, leaves: leaves.length > 0 ? leaves : undefined })
  })
  m.chimneys = fixMaterial(m.chimneys)
  m.railings = fixMaterial(m.railings).map((r) => {
    if (r.hostId !== undefined && toRemove.has(r.hostId)) {
      d.changed.push(r.id)
      return stripUndefined({ ...r, hostId: undefined })
    }
    return r
  })
  m.constraints = m.constraints
    .map((k) => {
      const targets = k.targetIds.filter((t) => !toRemove.has(t))
      if (targets.length === k.targetIds.length) return k
      d.changed.push(k.id)
      return { ...k, targetIds: targets }
    })
    .filter((k) => {
      if (k.targetIds.length > 0) return true
      toRemove.add(k.id)
      return false
    })
  if (removedSources.length > 0) {
    const scrub = <T extends { id: string; evidence?: { sourceIds?: string[] } }>(list: T[]): T[] =>
      list.map((o) => {
        const ids = o.evidence?.sourceIds
        if (!ids || !ids.some((s) => removedSources.includes(s))) return o
        d.changed.push(o.id)
        return { ...o, evidence: { ...o.evidence!, sourceIds: ids.filter((s) => !removedSources.includes(s)) } }
      })
    m.levels = scrub(m.levels)
    m.rooms = scrub(m.rooms)
    m.walls = scrub(m.walls)
    m.wallJunctions = scrub(m.wallJunctions)
    m.wallRings = scrub(m.wallRings)
    m.openings = scrub(m.openings)
    m.windows = scrub(m.windows)
    m.doors = scrub(m.doors)
    m.slabs = scrub(m.slabs)
    m.roofs = scrub(m.roofs)
    m.roofOpenings = scrub(m.roofOpenings)
    m.rooflights = scrub(m.rooflights)
    m.balconies = scrub(m.balconies)
    m.railings = scrub(m.railings)
    m.chimneys = scrub(m.chimneys)
  }
  d.removed.push(...toRemove)
  d.changed = d.changed.filter((id) => !toRemove.has(id))
}

export const openingHost = (m: CanonicalBuildingModel, o: Opening): Wall | undefined => m.walls.find((w) => w.id === o.wallId)
