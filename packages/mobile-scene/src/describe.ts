/**
 * Semantic object -> inspector rows.
 *
 * This is the module that lets the mobile viewer stay ignorant of the
 * CanonicalBuildingModel. Everything a phone shows about a selected object is
 * derived here, on the TypeScript side, from the model schema: a user-facing
 * kind name, a label, the relationships worth following, and plain
 * `label: value` facts already formatted with units. Kotlin renders strings.
 *
 * It is generic over the schema and knows nothing about any particular
 * building. Adding a project-specific rule here would be a defect.
 */
import {
  findObject,
  polygonArea,
  rectDepth,
  rectWidth,
  type CanonicalBuildingModel,
  type Level,
  type PlanRect,
  type SemanticKind,
  type SemanticObject,
} from '@buildapp/model'
import type { MobileFact, MobileRelation } from './types.js'

const KIND_LABEL: Record<SemanticKind, string> = {
  building: 'Building',
  level: 'Storey',
  room: 'Room',
  wall: 'Wall',
  wallJunction: 'Wall junction',
  wallRing: 'Wall ring',
  opening: 'Opening',
  window: 'Window',
  door: 'Door',
  slab: 'Slab',
  roof: 'Roof',
  roofOpening: 'Roof opening',
  rooflight: 'Rooflight',
  balcony: 'Balcony',
  railing: 'Railing',
  chimney: 'Chimney',
  stair: 'Stair',
  surfaceRegion: 'Surface region',
  linearSolid: 'Linear solid',
  material: 'Material',
  constraint: 'Constraint',
  evidenceSource: 'Evidence source',
}

export const kindLabel = (kind: SemanticKind): string => KIND_LABEL[kind]

/** Metres, trimmed: 2.4 m, 0.365 m, 12 m. */
export function len(v: number): string {
  const s = v.toFixed(3).replace(/\.?0+$/, '')
  return `${s === '' || s === '-' ? '0' : s} m`
}

const area = (v: number): string => `${v.toFixed(2)} m²`
const deg = (v: number): string => `${Number(v.toFixed(2))}°`
const rectSize = (r: PlanRect): string => `${len(rectWidth(r))} × ${len(rectDepth(r))}`

const titleCase = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase()

/**
 * A short human label for an object, used both for the object itself and when
 * another object points at it. Falls back to the kind plus a trimmed id so a
 * nameless object is still identifiable on screen.
 */
export function labelOf(model: CanonicalBuildingModel, id: string): string {
  const hit = findObject(model, id)
  if (!hit) return id
  const named = (hit.object as { name?: string }).name
  if (named && named.trim() !== '') return named
  if (hit.kind === 'level') {
    const l = hit.object as Level
    return `Storey ${l.index}`
  }
  return `${kindLabel(hit.kind)} ${id}`
}

/** The storey an object stands on, when the schema gives it one directly. */
export function levelIdOf(object: SemanticObject): string | undefined {
  const o = object as { levelId?: unknown }
  return typeof o.levelId === 'string' ? o.levelId : undefined
}

export function materialIdOf(object: SemanticObject): string | undefined {
  const o = object as { materialId?: unknown }
  return typeof o.materialId === 'string' ? o.materialId : undefined
}

type Ctx = { model: CanonicalBuildingModel; relations: MobileRelation[]; facts: MobileFact[] }

const relate = (ctx: Ctx, role: string, targetId: string | undefined): void => {
  if (!targetId) return
  ctx.relations.push({ role, targetId, targetLabel: labelOf(ctx.model, targetId) })
}

const fact = (ctx: Ctx, label: string, value: string | undefined): void => {
  if (value !== undefined) ctx.facts.push({ label, value })
}

/**
 * Relationships and facts for one object.
 *
 * The switch is over the model's own kinds; each branch reads only that
 * kind's declared schema fields. `levelId` and `materialId` are handled by the
 * caller, so branches add what is specific to the kind.
 */
export function describeObject(
  model: CanonicalBuildingModel,
  kind: SemanticKind,
  object: SemanticObject,
): { relations: MobileRelation[]; facts: MobileFact[] } {
  const ctx: Ctx = { model, relations: [], facts: [] }
  const o = object as Record<string, never> & SemanticObject
  const any = object as unknown as Record<string, unknown>

  relate(ctx, 'storey', levelIdOf(object))

  switch (kind) {
    case 'level': {
      const l = any as unknown as Level
      fact(ctx, 'Index', String(l.index))
      fact(ctx, 'Elevation', len(l.elevation))
      fact(ctx, 'Storey height', len(l.height))
      relate(ctx, 'building', l.buildingId)
      break
    }
    case 'room': {
      const poly = any.polygon as { x: number; z: number }[]
      fact(ctx, 'Usage', typeof any.usage === 'string' ? any.usage : undefined)
      fact(ctx, 'Floor area', area(polygonArea(poly)))
      break
    }
    case 'wall': {
      const start = any.start as { x: number; z: number }
      const end = any.end as { x: number; z: number }
      fact(ctx, 'Type', titleCase(String(any.kind)))
      fact(ctx, 'Length', len(Math.hypot(end.x - start.x, end.z - start.z)))
      fact(ctx, 'Thickness', len(any.thickness as number))
      fact(ctx, 'Height', len(any.height as number))
      if ((any.baseOffset as number) !== 0) fact(ctx, 'Base offset', len(any.baseOffset as number))
      const profile = any.topProfile as { kind: string; roofId?: string } | undefined
      if (profile) {
        fact(ctx, 'Top', profile.kind === 'ROOF' ? 'follows roof' : titleCase(profile.kind))
        relate(ctx, 'top follows roof', profile.roofId)
      }
      const openings = model.openings.filter((x) => x.wallId === o.id || (x.leaves ?? []).some((l) => l.wallId === o.id))
      if (openings.length > 0) fact(ctx, 'Openings', String(openings.length))
      break
    }
    case 'opening': {
      relate(ctx, 'hosting wall', any.wallId as string)
      for (const leaf of (any.leaves as { wallId: string }[] | undefined) ?? []) relate(ctx, 'also cuts wall', leaf.wallId)
      fact(ctx, 'Type', titleCase(String(any.kind)))
      fact(ctx, 'Width', len(any.width as number))
      fact(ctx, 'Height', len(any.height as number))
      fact(ctx, 'Sill', len(any.sill as number))
      const head = any.head as { kind: string; heightFar?: number } | undefined
      if (head && head.kind === 'RAKED') fact(ctx, 'Head', `raked to ${len(head.heightFar as number)}`)
      break
    }
    case 'window': {
      const openingId = any.openingId as string
      relate(ctx, 'fills opening', openingId)
      const opening = model.openings.find((x) => x.id === openingId)
      if (opening) {
        relate(ctx, 'hosting wall', opening.wallId)
        fact(ctx, 'Opening size', `${len(opening.width)} × ${len(opening.height)}`)
        fact(ctx, 'Sill', len(opening.sill))
      }
      fact(ctx, 'Panes', String(any.divisions))
      fact(ctx, 'Frame width', len(any.frameWidth as number))
      fact(ctx, 'Glass thickness', len(any.glassThickness as number))
      break
    }
    case 'door': {
      const openingId = any.openingId as string
      relate(ctx, 'fills opening', openingId)
      const opening = model.openings.find((x) => x.id === openingId)
      if (opening) {
        relate(ctx, 'hosting wall', opening.wallId)
        fact(ctx, 'Opening size', `${len(opening.width)} × ${len(opening.height)}`)
      }
      const assembly = any.assembly as { panels: { kind: string }[] } | undefined
      if (assembly) {
        fact(ctx, 'Assembly', assembly.panels.map((p) => titleCase(p.kind)).join(' + '))
        fact(ctx, 'Panels', String(assembly.panels.length))
      } else {
        fact(ctx, 'Hinge side', titleCase(String(any.hingeSide)))
      }
      fact(ctx, 'Swing', `${titleCase(String(any.swing))} ${deg(any.openAngle as number)}`)
      fact(ctx, 'Leaf thickness', len(any.leafThickness as number))
      break
    }
    case 'slab': {
      const poly = any.polygon as { x: number; z: number }[]
      const holes = (any.holes as { x: number; z: number }[][] | undefined) ?? []
      fact(ctx, 'Area', area(polygonArea(poly) - holes.reduce((s, h) => s + polygonArea(h), 0)))
      fact(ctx, 'Thickness', len(any.thickness as number))
      fact(ctx, 'Top offset', len(any.topOffset as number))
      if (holes.length > 0) fact(ctx, 'Voids', String(holes.length))
      break
    }
    case 'roof': {
      const f = any.footprint as PlanRect
      fact(ctx, 'Type', titleCase(String(any.kind)))
      fact(ctx, 'Footprint', rectSize(f))
      fact(ctx, 'Pitch', deg(any.pitchDeg as number))
      fact(ctx, 'Ridge axis', String(any.ridgeAxis))
      fact(ctx, 'Eave offset', len(any.eaveOffset as number))
      fact(ctx, 'Overhang', len(any.overhang as number))
      fact(ctx, 'Thickness', len(any.thickness as number))
      const holes = model.roofOpenings.filter((x) => x.roofId === o.id)
      if (holes.length > 0) fact(ctx, 'Openings', String(holes.length))
      break
    }
    case 'roofOpening': {
      relate(ctx, 'hosting roof', any.roofId as string)
      relate(ctx, 'passes', any.throughId as string | undefined)
      fact(ctx, 'Type', titleCase(String(any.kind)))
      fact(ctx, 'Footprint', rectSize(any.footprint as PlanRect))
      fact(ctx, 'Cut', ((any.cut as string | undefined) ?? 'VERTICAL') === 'NORMAL_TO_ROOF' ? 'normal to roof' : 'vertical')
      break
    }
    case 'rooflight': {
      const roId = any.roofOpeningId as string
      relate(ctx, 'fills roof opening', roId)
      const ro = model.roofOpenings.find((x) => x.id === roId)
      if (ro) {
        relate(ctx, 'hosting roof', ro.roofId)
        fact(ctx, 'Opening size', rectSize(ro.footprint))
      }
      fact(ctx, 'Frame width', len(any.frameWidth as number))
      fact(ctx, 'Glass thickness', len(any.glassThickness as number))
      break
    }
    case 'balcony': {
      fact(ctx, 'Type', titleCase(String(any.kind)))
      fact(ctx, 'Footprint', rectSize(any.footprint as PlanRect))
      fact(ctx, 'Thickness', len(any.thickness as number))
      fact(ctx, 'Top offset', len(any.topOffset as number))
      break
    }
    case 'railing': {
      const start = any.start as { x: number; z: number }
      const end = any.end as { x: number; z: number }
      relate(ctx, 'guards', any.hostId as string | undefined)
      fact(ctx, 'Length', len(Math.hypot(end.x - start.x, end.z - start.z)))
      fact(ctx, 'Height', len(any.height as number))
      fact(ctx, 'Infill', titleCase(String(any.infill)))
      fact(ctx, 'Post spacing', len(any.postSpacing as number))
      break
    }
    case 'chimney': {
      fact(ctx, 'Footprint', rectSize(any.footprint as PlanRect))
      fact(ctx, 'Height', len(any.height as number))
      fact(ctx, 'Base offset', len(any.baseOffset as number))
      break
    }
    case 'stair': {
      relate(ctx, 'arrives at storey', any.toLevelId as string)
      fact(ctx, 'Type', String(any.kind) === 'FLIGHTS' ? 'Real flights' : 'Placeholder')
      fact(ctx, 'Footprint', rectSize(any.footprint as PlanRect))
      if (String(any.kind) === 'FLIGHTS') {
        const segments = any.segments as { kind: string; risers?: number; length?: number; turn?: string; angleDeg?: number }[]
        const risers = segments.reduce((s, x) => s + (x.risers ?? 0), 0)
        const fromLevel = model.levels.find((l) => l.id === levelIdOf(object))
        const toLevel = model.levels.find((l) => l.id === (any.toLevelId as string))
        fact(ctx, 'Width', len(any.width as number))
        fact(ctx, 'Risers', String(risers))
        if (fromLevel && toLevel && risers > 0) {
          const rise = toLevel.elevation + (any.topOffset as number) - (fromLevel.elevation + (any.baseOffset as number))
          fact(ctx, 'Total rise', len(rise))
          fact(ctx, 'Riser height', len(rise / risers))
        }
        fact(ctx, 'Travel', String(any.direction))
        fact(
          ctx,
          'Segments',
          segments
            .map((x) =>
              x.kind === 'FLIGHT'
                ? `flight ${x.risers}`
                : x.kind === 'WINDER'
                  ? `winder ${x.risers} ${x.turn?.toLowerCase()} ${x.angleDeg}°`
                  : `landing ${len(x.length ?? 0)}${x.turn && x.turn !== 'NONE' ? ` ${x.turn.toLowerCase()}` : ''}`,
            )
            .join(', '),
        )
        fact(ctx, 'Waist', len(any.waist as number))
      }
      break
    }
    case 'surfaceRegion': {
      const hostId = any.hostId as string
      relate(ctx, 'on wall', hostId)
      const rect = any.rect as { a0: number; a1: number; b0: number; b1: number }
      fact(ctx, 'Face', titleCase(String(any.face)))
      fact(ctx, 'Size', `${len(rect.a1 - rect.a0)} × ${len(rect.b1 - rect.b0)}`)
      fact(ctx, 'Along wall', `${len(rect.a0)} → ${len(rect.a1)}`)
      fact(ctx, 'Above base', `${len(rect.b0)} → ${len(rect.b1)}`)
      break
    }
    case 'wallJunction': {
      const ends = [any.a, any.b, any.wall].filter((e): e is { wallId: string; end: string } => !!e) as { wallId: string; end: string }[]
      for (const end of ends) relate(ctx, `wall (${end.end.toLowerCase()} end)`, end.wallId)
      relate(ctx, 'against wall', any.againstWallId as string | undefined)
      relate(ctx, 'corner owner', any.owner as string | undefined)
      fact(ctx, 'Type', titleCase(String(any.kind)))
      break
    }
    case 'wallRing': {
      const wallIds = (any.wallIds as string[] | undefined) ?? []
      fact(ctx, 'Walls', String(wallIds.length))
      for (const w of wallIds) relate(ctx, 'wall', w)
      break
    }
    default:
      break
  }
  return { relations: ctx.relations, facts: ctx.facts }
}
