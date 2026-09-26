/**
 * CompiledScene -> Three.js objects.
 *
 * This is an adapter and nothing more: it turns the compiler's triangle lists
 * into buffer geometries, keeps a Map from every Three.js mesh back to the
 * semantic object id (the picking trace), and applies materials by part or by
 * semantic group. It never invents geometry. The model frame is mirrored in z
 * here, and the triangle winding swapped, because the model frame is
 * left-handed and Three.js is right-handed (see docs/CANONICAL_BUILDING_MODEL.md).
 *
 * Three render styles share one build:
 *
 * - Construction: part colours, with the model's own material on structural
 *   parts; edge lines on the parts that have always had them.
 * - Clay: one neutral on every opaque surface; glazing still reads.
 * - Architectural: every mesh is placed in a SEMANTIC GROUP (main wall,
 *   secondary wall, roof, flat roof, trim, glass, frame, slab, terrace, …) and
 *   coloured from the shared architectural palette, whose values are a
 *   deliberate ladder so adjacent elements never blend. Readability comes
 *   from that value separation, from the viewport's hemisphere + key light,
 *   and from a thin, low-opacity feature-edge line on structural groups only
 *   — no fat outlines, no per-object colours, no screen-space effects, so no
 *   geometry defect is ever hidden by the styling.
 *
 * The palette and the group rules are the ones in
 * `packages/mobile-scene/src/semantics.ts`, which the mobile bundle carries;
 * an architecture rule keeps the web clear of that package, so this file
 * holds a copy and `packages/mobile-scene/test/semantics.test.ts` proves the
 * copy equal, value for value.
 *
 * Switching style restyles the live builds in place — materials and edge
 * overlays only. No vertex is touched and nothing is recompiled.
 */
import * as THREE from 'three'
import type { CompiledMesh, GeometryPart, Vec3 } from '@buildapp/geometry'
import type { CanonicalBuildingModel, Material } from '@buildapp/model'
import { renderStyleStore, type RenderStyleId } from '../use-store.js'

export const toThree = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, -p.z)

export type SceneBuild = {
  group: THREE.Group
  /** Three.js mesh -> semantic object id: the picking trace. */
  meshToObject: Map<THREE.Object3D, string>
  pickables: THREE.Mesh[]
  bounds: THREE.Box3
  /** The style the build is currently drawn in. */
  style: RenderStyleId
}

// ---------------------------------------------------------------------------
// Construction: the part palette
// ---------------------------------------------------------------------------

type PartStyle = { color: number; opacity?: number; metalness?: number; roughness?: number; edges?: boolean }

const STYLE: Record<GeometryPart, PartStyle> = {
  WALL: { color: 0xcfc8bb, roughness: 0.95, edges: true },
  WALL_REVEAL: { color: 0xbdb6a9, roughness: 0.95, edges: true },
  WINDOW_FRAME: { color: 0x2c3036, roughness: 0.6 },
  WINDOW_GLASS: { color: 0x9ec7e6, opacity: 0.35, roughness: 0.1, metalness: 0.1 },
  WINDOW_MULLION: { color: 0x2c3036, roughness: 0.6 },
  DOOR_FRAME: { color: 0x2c3036, roughness: 0.6 },
  DOOR_LEAF: { color: 0x8a6a3d, roughness: 0.7, edges: true },
  DOOR_GLASS: { color: 0x9ec7e6, opacity: 0.35, roughness: 0.1, metalness: 0.1 },
  DOOR_PANEL: { color: 0x3a3d42, roughness: 0.7, edges: true },
  DOOR_HANDLE: { color: 0xb8b8b8, roughness: 0.3, metalness: 0.8 },
  SLAB: { color: 0x9b9b98, roughness: 0.9, edges: true },
  ROOF: { color: 0x6f4a3d, roughness: 0.9, edges: true },
  ROOF_REVEAL: { color: 0x5e3f34, roughness: 0.9, edges: true },
  ROOFLIGHT_FRAME: { color: 0x2c3036, roughness: 0.6 },
  ROOFLIGHT_GLASS: { color: 0x9ec7e6, opacity: 0.35, roughness: 0.1, metalness: 0.1 },
  BALCONY: { color: 0xa5a29b, roughness: 0.9, edges: true },
  RAILING_POST: { color: 0x3a3d42, roughness: 0.5, metalness: 0.6 },
  RAILING_RAIL: { color: 0x3a3d42, roughness: 0.5, metalness: 0.6 },
  RAILING_INFILL: { color: 0x9ec7e6, opacity: 0.45, roughness: 0.2 },
  CHIMNEY: { color: 0x9c5f4a, roughness: 0.9, edges: true },
  ROOM_FLOOR: { color: 0x3fa7a0, opacity: 0.28, roughness: 1 },
  STAIR_PLACEHOLDER: { color: 0xe0a24d, opacity: 0.5, roughness: 1 },
  STAIR_STEP: { color: 0xb9b3a8, roughness: 0.9, edges: true },
  SURFACE_REGION: { color: 0x9a7a4a, roughness: 0.85 },
  LINEAR_SOLID: { color: 0xb0aaa0, roughness: 0.8, edges: true },
  TERRACE: { color: 0x9d9488, roughness: 0.9, edges: true },
  ROOF_TRIM: { color: 0xe9e4da, roughness: 0.85, edges: true },
}

/** Parts a model material may colour in the Construction style; fills keep their part colour. */
const OWN_MATERIAL_PARTS: ReadonlySet<GeometryPart> = new Set<GeometryPart>([
  'WALL',
  'WALL_REVEAL',
  'ROOF',
  'ROOF_REVEAL',
  'ROOF_TRIM',
  'SLAB',
  'CHIMNEY',
  'BALCONY',
  'TERRACE',
  'DOOR_LEAF',
  'DOOR_PANEL',
  'STAIR_STEP',
  'SURFACE_REGION',
  'LINEAR_SOLID',
])

/** Neutral clay, warm enough not to read as plastic. */
const CLAY = 0xd5cfc6

// ---------------------------------------------------------------------------
// Architectural: semantic groups and the shared palette (a proven copy)
// ---------------------------------------------------------------------------

type SemanticGroup =
  | 'WALL_MAIN'
  | 'WALL_SECONDARY'
  | 'WALL_INTERIOR'
  | 'ROOF_MAIN'
  | 'FLAT_ROOF'
  | 'ROOF_TRIM'
  | 'WINDOW_GLASS'
  | 'WINDOW_FRAME'
  | 'DOOR'
  | 'GARAGE_DOOR'
  | 'SLAB'
  | 'BALCONY_SLAB'
  | 'RAILING'
  | 'FACADE_FRAME'
  | 'TERRACE_SURFACE'
  | 'CHIMNEY'
  | 'ROOFLIGHT'
  | 'STAIR'
  | 'ROOM'
  | 'OTHER'

type GroupAppearance = { color: string; opacity?: number; roughness: number; metalness: number; edge: 'SOFT' | 'NONE' }

/** `architectural-v1`. Keep in step with the shared constant; the parity test reads these lines. */
const ARCHITECTURAL: Record<SemanticGroup, GroupAppearance> = {
  WALL_MAIN: { color: '#e3ddd3', roughness: 0.95, metalness: 0, edge: 'SOFT' },
  WALL_SECONDARY: { color: '#8f8b85', roughness: 0.95, metalness: 0, edge: 'SOFT' },
  WALL_INTERIOR: { color: '#d3cec3', roughness: 0.95, metalness: 0, edge: 'SOFT' },
  ROOF_MAIN: { color: '#423e3b', roughness: 0.85, metalness: 0, edge: 'SOFT' },
  FLAT_ROOF: { color: '#69645f', roughness: 0.85, metalness: 0, edge: 'SOFT' },
  ROOF_TRIM: { color: '#f3eee6', roughness: 0.85, metalness: 0, edge: 'SOFT' },
  WINDOW_GLASS: { color: '#9ec0d6', opacity: 0.35, roughness: 0.12, metalness: 0.1, edge: 'NONE' },
  WINDOW_FRAME: { color: '#272626', roughness: 0.55, metalness: 0.05, edge: 'NONE' },
  DOOR: { color: '#8d6c46', roughness: 0.7, metalness: 0, edge: 'NONE' },
  GARAGE_DOOR: { color: '#58595c', roughness: 0.6, metalness: 0.1, edge: 'NONE' },
  SLAB: { color: '#c1beba', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  BALCONY_SLAB: { color: '#b5b0aa', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  RAILING: { color: '#3a3c3f', roughness: 0.5, metalness: 0.5, edge: 'NONE' },
  FACADE_FRAME: { color: '#a7a197', roughness: 0.8, metalness: 0, edge: 'SOFT' },
  TERRACE_SURFACE: { color: '#a49c92', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  CHIMNEY: { color: '#837671', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  ROOFLIGHT: { color: '#5e6166', roughness: 0.5, metalness: 0.2, edge: 'NONE' },
  STAIR: { color: '#b2aca4', roughness: 0.9, metalness: 0, edge: 'NONE' },
  ROOM: { color: '#8db1a8', opacity: 0.25, roughness: 1, metalness: 0, edge: 'NONE' },
  OTHER: { color: '#b6b2ad', roughness: 0.9, metalness: 0, edge: 'NONE' },
}

/**
 * The semantic group of one compiled mesh: the part first, then what the
 * adapter can know about the object.
 *
 * Mirrors `semanticGroupOf` in packages/mobile-scene/src/semantics.ts. The
 * adapter receives compiled meshes and the model's materials, not the
 * objects, so the kinds a bundle reads off the model — a FLAT roof, a
 * TERRACE balcony, an INTERIOR wall, an ATTACHED body — are not in reach
 * here; a material name stands in where the model stated a finish ("flat
 * roof membrane", "partition"), and a door is a sectional door when the
 * object compiled to solid panels and no leaf. The bundle's derivation, which
 * reads the model, is the authoritative one; the two agree wherever both
 * have the fact.
 */
function semanticGroupOf(cm: CompiledMesh, materialName: string | undefined, objectParts: ReadonlySet<GeometryPart>, facts?: SceneFacts): SemanticGroup {
  const material = `${cm.materialId ?? ''} ${materialName ?? ''}`.toUpperCase()
  switch (cm.part) {
    case 'WALL':
    case 'WALL_REVEAL': {
      const wallKind = facts?.wallKind.get(cm.objectId)
      if (wallKind === 'INTERIOR') return 'WALL_INTERIOR'
      const finish = facts?.finish.get(cm.objectId)
      if (finish === 'MEMBER') return 'FACADE_FRAME'
      if (finish === 'SECONDARY') return 'WALL_SECONDARY'
      if (!wallKind && /PARTITION|INTERIOR/.test(material)) return 'WALL_INTERIOR'
      return 'WALL_MAIN'
    }
    case 'ROOF':
    case 'ROOF_REVEAL': {
      const roofKind = facts?.roofKind.get(cm.objectId)
      if (roofKind === 'FLAT') return 'FLAT_ROOF'
      return !roofKind && /MEMBRANE|FLAT/.test(material) ? 'FLAT_ROOF' : 'ROOF_MAIN'
    }
    case 'ROOF_TRIM':
      return 'ROOF_TRIM'
    case 'WINDOW_GLASS':
    case 'DOOR_GLASS':
    case 'ROOFLIGHT_GLASS':
      return 'WINDOW_GLASS'
    case 'WINDOW_FRAME':
    case 'WINDOW_MULLION':
      return 'WINDOW_FRAME'
    case 'DOOR_FRAME':
    case 'DOOR_LEAF':
    case 'DOOR_PANEL':
    case 'DOOR_HANDLE':
      return objectParts.has('DOOR_PANEL') && !objectParts.has('DOOR_LEAF') && !objectParts.has('DOOR_GLASS') ? 'GARAGE_DOOR' : 'DOOR'
    case 'SLAB':
      return 'SLAB'
    case 'BALCONY':
      return facts?.balconyKind.get(cm.objectId) === 'TERRACE' ? 'TERRACE_SURFACE' : 'BALCONY_SLAB'
    case 'TERRACE':
      return 'TERRACE_SURFACE'
    case 'RAILING_POST':
    case 'RAILING_RAIL':
      return 'RAILING'
    case 'RAILING_INFILL': {
      const infill = facts?.railingInfill.get(cm.objectId)
      if (infill) return infill === 'GLASS' ? 'WINDOW_GLASS' : 'RAILING'
      return /GLASS|GLAZ/.test(material) ? 'WINDOW_GLASS' : 'RAILING'
    }
    case 'CHIMNEY':
      return 'CHIMNEY'
    case 'ROOFLIGHT_FRAME':
      return 'ROOFLIGHT'
    case 'STAIR_STEP':
    case 'STAIR_PLACEHOLDER':
      return 'STAIR'
    case 'ROOM_FLOOR':
      return 'ROOM'
    case 'SURFACE_REGION':
      return 'WALL_SECONDARY'
    case 'LINEAR_SOLID':
      return 'FACADE_FRAME'
    default:
      return 'OTHER'
  }
}

/**
 * What the adapter reads off the model, when it is handed one, to derive the
 * groups the way the bundle does. Mirrors `wallFinishes` and `objectFactsOf`
 * in packages/mobile-scene/src/bundle.ts; tests/architecture/styling-parity
 * holds the two to the same groups and colours, mesh for mesh.
 */
export type SceneFacts = {
  wallKind: Map<string, string>
  finish: Map<string, 'PRIMARY' | 'SECONDARY' | 'MEMBER'>
  roofKind: Map<string, string>
  balconyKind: Map<string, string>
  railingInfill: Map<string, string>
}

export function sceneFactsOf(model: CanonicalBuildingModel): SceneFacts {
  const facts: SceneFacts = { wallKind: new Map(), finish: new Map(), roofKind: new Map(), balconyKind: new Map(), railingInfill: new Map() }
  for (const w of model.walls) facts.wallKind.set(w.id, w.kind)
  for (const r of model.roofs) facts.roofKind.set(r.id, r.kind)
  for (const b of model.balconies) facts.balconyKind.set(b.id, b.kind)
  for (const r of model.railings) facts.railingInfill.set(r.id, r.infill)
  const exterior = model.walls.filter((w) => w.kind === 'EXTERIOR' && w.materialId)
  const area = new Map<string, number>()
  for (const w of exterior) area.set(w.materialId as string, (area.get(w.materialId as string) ?? 0) + Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) * w.height)
  if (area.size === 0) return facts
  const dominant = [...area].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]
  const members = new Set<string>()
  for (const r of model.roofs) {
    if (r.edgeMembers?.verge?.materialId) members.add(r.edgeMembers.verge.materialId)
    if (r.edgeMembers?.fascia?.materialId) members.add(r.edgeMembers.fascia.materialId)
  }
  for (const l of model.linearSolids) if (l.materialId) members.add(l.materialId)
  for (const w of exterior) {
    const m = w.materialId as string
    facts.finish.set(w.id, m === dominant ? 'PRIMARY' : members.has(m) ? 'MEMBER' : 'SECONDARY')
  }
  return facts
}

// Tone hints: mirrors `toneHintsOf`, `toneOfColor` and `applyToneHints` in
// packages/mobile-scene. The model's own finishes steer a group onto another
// rung of the palette's own ladder, never into a neighbour's luminance.

type Tone = 'LIGHT' | 'MID' | 'DARK' | 'WARM' | 'COOL'

const TONE_FAMILIES: Record<Tone, readonly SemanticGroup[]> = {
  LIGHT: ['ROOF_TRIM', 'WALL_MAIN', 'WALL_INTERIOR'],
  MID: ['SLAB', 'BALCONY_SLAB', 'STAIR', 'FACADE_FRAME', 'TERRACE_SURFACE', 'WALL_SECONDARY'],
  DARK: ['CHIMNEY', 'FLAT_ROOF', 'GARAGE_DOOR', 'ROOFLIGHT', 'ROOF_MAIN', 'RAILING', 'WINDOW_FRAME'],
  WARM: ['WALL_MAIN', 'TERRACE_SURFACE', 'CHIMNEY', 'DOOR'],
  COOL: ['WINDOW_GLASS', 'GARAGE_DOOR', 'ROOFLIGHT', 'RAILING'],
}

const TONE_HINTABLE_GROUPS: readonly SemanticGroup[] = ['WALL_MAIN', 'WALL_SECONDARY', 'FACADE_FRAME', 'ROOF_MAIN', 'FLAT_ROOF']

const ADJACENT_GROUPS: ReadonlyArray<readonly [SemanticGroup, SemanticGroup]> = [
  ['WALL_MAIN', 'ROOF_TRIM'],
  ['WALL_MAIN', 'SLAB'],
  ['WALL_MAIN', 'ROOF_MAIN'],
  ['WALL_MAIN', 'FLAT_ROOF'],
  ['WALL_MAIN', 'TERRACE_SURFACE'],
  ['WALL_MAIN', 'WALL_SECONDARY'],
  ['WALL_MAIN', 'WALL_INTERIOR'],
  ['WALL_MAIN', 'BALCONY_SLAB'],
  ['WALL_MAIN', 'CHIMNEY'],
  ['WALL_MAIN', 'FACADE_FRAME'],
  ['WALL_MAIN', 'WINDOW_FRAME'],
  ['WALL_MAIN', 'DOOR'],
  ['WALL_MAIN', 'GARAGE_DOOR'],
  ['WALL_MAIN', 'STAIR'],
  ['WALL_SECONDARY', 'ROOF_TRIM'],
  ['WALL_SECONDARY', 'SLAB'],
  ['WALL_SECONDARY', 'FLAT_ROOF'],
  ['WALL_SECONDARY', 'TERRACE_SURFACE'],
  ['WALL_SECONDARY', 'BALCONY_SLAB'],
  ['WALL_SECONDARY', 'WINDOW_FRAME'],
  ['WALL_SECONDARY', 'GARAGE_DOOR'],
  ['WALL_INTERIOR', 'SLAB'],
  ['WALL_INTERIOR', 'DOOR'],
  ['WALL_INTERIOR', 'STAIR'],
  ['ROOF_MAIN', 'ROOF_TRIM'],
  ['ROOF_MAIN', 'CHIMNEY'],
  ['ROOF_MAIN', 'ROOFLIGHT'],
  ['ROOF_MAIN', 'FLAT_ROOF'],
  ['ROOF_MAIN', 'FACADE_FRAME'],
  ['FLAT_ROOF', 'ROOF_TRIM'],
  ['ROOF_TRIM', 'FACADE_FRAME'],
  ['ROOF_TRIM', 'CHIMNEY'],
  ['SLAB', 'TERRACE_SURFACE'],
  ['SLAB', 'BALCONY_SLAB'],
  ['SLAB', 'STAIR'],
  ['SLAB', 'FACADE_FRAME'],
  ['BALCONY_SLAB', 'RAILING'],
  ['TERRACE_SURFACE', 'RAILING'],
  ['WINDOW_FRAME', 'WINDOW_GLASS'],
  ['DOOR', 'WINDOW_GLASS'],
]

const MIN_ADJACENT_LUMINANCE_GAP = 0.06

const rgbOf = (color: string): [number, number, number] => {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
const toLinear = (c: number): number => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const luminance = (color: string): number => {
  const [r, g, b] = rgbOf(color)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}
const distance = (a: string, b: string): number => {
  const [ar, ag, ab] = rgbOf(a)
  const [br, bg, bb] = rgbOf(b)
  return Math.hypot(ar - br, ag - bg, ab - bb)
}
const toneOfColor = (color: string): Tone => {
  const l = luminance(color)
  return l >= 0.45 ? 'LIGHT' : l >= 0.12 ? 'MID' : 'DARK'
}

/** The architectural palette with the model's own finishes applied as tone hints. */
export function hintedPalette(groups: ReadonlyArray<{ group: SemanticGroup; materialId: string | undefined; triangles: number }>, materials: readonly Material[]): Record<SemanticGroup, GroupAppearance> {
  const colorOf = new Map(materials.map((m) => [m.id, m.color]))
  const counts = new Map<SemanticGroup, Map<string, number>>()
  for (const g of groups) {
    if (!TONE_HINTABLE_GROUPS.includes(g.group) || !g.materialId || !colorOf.has(g.materialId)) continue
    const c = counts.get(g.group) ?? new Map<string, number>()
    c.set(g.materialId, (c.get(g.materialId) ?? 0) + g.triangles)
    counts.set(g.group, c)
  }
  const out = { ...ARCHITECTURAL }
  for (const group of Object.keys(ARCHITECTURAL) as SemanticGroup[]) {
    const c = counts.get(group)
    if (!c) continue
    const [material] = [...c].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
    const tone = toneOfColor(colorOf.get(material) as string)
    const neighbours = ADJACENT_GROUPS.filter(([a, b]) => a === group || b === group).map(([a, b]) => (a === group ? b : a))
    const keepsApart = (color: string): boolean => neighbours.every((n) => Math.abs(luminance(color) - luminance(out[n].color)) >= MIN_ADJACENT_LUMINANCE_GAP)
    const from = ARCHITECTURAL[group].color
    const variants = [...new Set(TONE_FAMILIES[tone].map((g) => ARCHITECTURAL[g].color))].sort((a, b) => distance(from, a) - distance(from, b))
    const best = variants.includes(from) ? from : variants.find(keepsApart)
    if (best !== undefined) out[group] = { ...ARCHITECTURAL[group], color: best }
  }
  return out
}

// ---------------------------------------------------------------------------
// Appearance per style
// ---------------------------------------------------------------------------

const SELECTED = new THREE.Color(0x4fa3ff)

type Appearance = {
  color: THREE.Color
  opacity?: number
  roughness: number
  metalness: number
  edges: boolean
  edgeColor: number
  edgeOpacity: number
}

type Entry = {
  cm: CompiledMesh
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  group: SemanticGroup
  /** The build's palette: the architectural palette with the model's tone hints applied. */
  palette: Record<SemanticGroup, GroupAppearance>
  own: Material | undefined
  selected: boolean
  /**
   * Feature edges, computed when the style first shows them and released as
   * soon as a style hides them: an overlay that is not drawn holds no GPU
   * memory.
   */
  edgeGeometry: THREE.EdgesGeometry | null
  edges: THREE.LineSegments | null
}

/** Feature-edge threshold: a crease sharper than this gets a line; a flat facet boundary does not. */
const EDGE_THRESHOLD_DEG = 20

function appearanceOf(entry: Entry, style: RenderStyleId): Appearance {
  const part = STYLE[entry.cm.part]
  switch (style) {
    case 'architectural': {
      const a = entry.palette[entry.group]
      return {
        color: new THREE.Color(a.color),
        // A translucent marker (a placeholder, a room floor, a bars infill)
        // stays a marker even when its group is opaque.
        opacity: a.opacity ?? part.opacity,
        roughness: a.roughness,
        metalness: a.metalness,
        edges: a.edge === 'SOFT',
        edgeColor: 0x1b1d20,
        edgeOpacity: 0.35,
      }
    }
    case 'clay': {
      const translucent = part.opacity !== undefined
      return {
        color: new THREE.Color(translucent ? part.color : CLAY),
        opacity: part.opacity,
        roughness: translucent ? (part.roughness ?? 0.9) : 0.95,
        metalness: translucent ? (part.metalness ?? 0) : 0,
        edges: part.edges === true,
        edgeColor: 0x2a2d31,
        edgeOpacity: 0.5,
      }
    }
    default: {
      const usesOwn = entry.own !== undefined && OWN_MATERIAL_PARTS.has(entry.cm.part)
      return {
        color: new THREE.Color(usesOwn && entry.own ? entry.own.color : part.color),
        opacity: part.opacity,
        roughness: part.roughness ?? 0.9,
        metalness: part.metalness ?? 0,
        edges: part.edges === true,
        edgeColor: 0x2a2d31,
        edgeOpacity: 0.6,
      }
    }
  }
}

/** Restyle one entry in place: material parameters and the edge overlay, nothing else. */
function applyAppearance(group: THREE.Group, entry: Entry, style: RenderStyleId): void {
  const a = appearanceOf(entry, style)
  const m = entry.material
  m.color.copy(a.color)
  m.roughness = a.roughness
  m.metalness = a.metalness
  m.transparent = a.opacity !== undefined
  m.opacity = a.opacity ?? 1
  m.emissive.copy(entry.selected ? SELECTED : new THREE.Color(0x000000))
  m.emissiveIntensity = entry.selected ? 0.55 : 0
  m.needsUpdate = true
  entry.mesh.renderOrder = a.opacity !== undefined ? 2 : 1

  if (a.edges) {
    if (!entry.edgeGeometry) entry.edgeGeometry = new THREE.EdgesGeometry(entry.mesh.geometry, EDGE_THRESHOLD_DEG)
    if (!entry.edges) {
      entry.edges = new THREE.LineSegments(entry.edgeGeometry, new THREE.LineBasicMaterial({ transparent: true }))
      entry.edges.renderOrder = 3
      group.add(entry.edges)
    }
    const lm = entry.edges.material as THREE.LineBasicMaterial
    lm.color.set(entry.selected ? 0x9fd0ff : a.edgeColor)
    lm.opacity = entry.selected ? 1 : a.edgeOpacity
    lm.needsUpdate = true
  } else if (entry.edges) {
    group.remove(entry.edges)
    ;(entry.edges.material as THREE.Material).dispose()
    entry.edgeGeometry?.dispose()
    entry.edgeGeometry = null
    entry.edges = null
  }
}

// ---------------------------------------------------------------------------
// Live builds: restyled in place when the style changes
// ---------------------------------------------------------------------------

const live = new Map<THREE.Group, { build: SceneBuild; entries: Entry[] }>()

function restyle(build: SceneBuild, entries: Entry[], style: RenderStyleId): void {
  for (const e of entries) applyAppearance(build.group, e, style)
  build.style = style
}

renderStyleStore.subscribe(() => {
  const style = renderStyleStore.get()
  for (const { build, entries } of live.values()) if (build.style !== style) restyle(build, entries, style)
})

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function geometryFor(mesh: CompiledMesh): THREE.BufferGeometry {
  const positions = new Float32Array(mesh.triangles.length * 9)
  let i = 0
  for (const t of mesh.triangles) {
    // Mirror z (model frame is left-handed) and swap b/c so faces stay front-facing.
    for (const p of [t.a, t.c, t.b]) {
      positions[i++] = p.x
      positions[i++] = p.y
      positions[i++] = -p.z
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

/**
 * The three-space bounds of compiled meshes — the same box a build computes —
 * without creating a material, a buffer or an edge overlay. Camera framing
 * needs only this; building a whole styled scene to measure it would compute
 * every feature edge of the building on each view change.
 */
export function boundsOfMeshes(meshes: readonly CompiledMesh[]): THREE.Box3 {
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (const m of meshes) {
    for (const t of m.triangles) {
      box.expandByPoint(v.set(t.a.x, t.a.y, -t.a.z))
      box.expandByPoint(v.set(t.b.x, t.b.y, -t.b.z))
      box.expandByPoint(v.set(t.c.x, t.c.y, -t.c.z))
    }
  }
  return box
}

export function buildThreeScene(meshes: readonly CompiledMesh[], materials: readonly Material[], selection: string | null, style: RenderStyleId = renderStyleStore.get(), model?: CanonicalBuildingModel): SceneBuild {
  const group = new THREE.Group()
  group.name = 'compiled-building'
  const meshToObject = new Map<THREE.Object3D, string>()
  const pickables: THREE.Mesh[] = []
  const bounds = new THREE.Box3()
  const modelMaterial = new Map(materials.map((m) => [m.id, m]))

  // The parts each object compiled to: what tells a sectional door from a leaf door.
  const partsByObject = new Map<string, Set<GeometryPart>>()
  for (const cm of meshes) {
    let parts = partsByObject.get(cm.objectId)
    if (!parts) {
      parts = new Set()
      partsByObject.set(cm.objectId, parts)
    }
    parts.add(cm.part)
  }

  const facts = model ? sceneFactsOf(model) : undefined
  const groupOf = meshes.map((cm) => semanticGroupOf(cm, cm.materialId ? modelMaterial.get(cm.materialId)?.name : undefined, partsByObject.get(cm.objectId) ?? new Set(), facts))
  const palette = hintedPalette(
    meshes.map((cm, i) => ({ group: groupOf[i], materialId: cm.materialId, triangles: cm.triangles.length })),
    materials,
  )

  const entries: Entry[] = []
  for (const [i, cm] of meshes.entries()) {
    const geometry = geometryFor(cm)
    const own = cm.materialId ? modelMaterial.get(cm.materialId) : undefined
    const material = new THREE.MeshStandardMaterial({ side: THREE.FrontSide, flatShading: true })
    const three = new THREE.Mesh(geometry, material)
    three.name = `${cm.objectKind}:${cm.objectId}:${cm.part}`
    const semanticGroup = groupOf[i]
    three.userData = { objectId: cm.objectId, objectKind: cm.objectKind, part: cm.part, semanticGroup, hostWallId: cm.hostWallId, openingId: cm.openingId }
    group.add(three)
    meshToObject.set(three, cm.objectId)
    pickables.push(three)
    entries.push({ cm, mesh: three, material, group: semanticGroup, palette, own, selected: selection !== null && cm.objectId === selection, edgeGeometry: null, edges: null })
    geometry.computeBoundingBox()
    if (geometry.boundingBox) bounds.union(geometry.boundingBox)
  }

  const build: SceneBuild = { group, meshToObject, pickables, bounds, style }
  restyle(build, entries, style)
  live.set(group, { build, entries })
  return build
}

export type GroupProbe = { meshes: number; transparent: number; minOpacity: number; maxOpacity: number; colors: string[]; edges: number }

/**
 * What a live build is drawing, read back from its materials: the style, how
 * many feature-edge overlays are in the scene, and per semantic group the
 * colours and translucency actually set. For tests and diagnostics; it changes
 * nothing.
 */
export function probeBuild(build: SceneBuild): { style: RenderStyleId; edgeOverlays: number; groups: Record<string, GroupProbe> } {
  const entries = live.get(build.group)?.entries ?? []
  const groups: Record<string, GroupProbe> = {}
  let edgeOverlays = 0
  for (const e of entries) {
    const g = (groups[e.group] ??= { meshes: 0, transparent: 0, minOpacity: 1, maxOpacity: 0, colors: [], edges: 0 })
    g.meshes++
    if (e.edges) {
      edgeOverlays++
      g.edges++
    }
    if (e.material.transparent) g.transparent++
    g.minOpacity = Math.min(g.minOpacity, e.material.opacity)
    g.maxOpacity = Math.max(g.maxOpacity, e.material.opacity)
    const color = `#${e.material.color.getHexString()}`
    if (!g.colors.includes(color)) g.colors.push(color)
  }
  return { style: build.style, edgeOverlays, groups }
}

export function disposeGroup(group: THREE.Group): void {
  // Stop restyling it. Every edge overlay that exists is a child of the
  // group (a hidden one has already been released), so the traversal below
  // gives back its geometry and material with the meshes'.
  live.delete(group)
  group.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else if (mat) mat.dispose()
  })
}

/** World axes of the MODEL frame drawn in three-space: x red, y green, z blue (model +z is three -z). */
export function modelAxes(length = 3): THREE.Group {
  const g = new THREE.Group()
  g.name = 'model-axes'
  const line = (to: THREE.Vector3, color: number): void => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), to])
    g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })))
  }
  line(new THREE.Vector3(length, 0, 0), 0xe5645a)
  line(new THREE.Vector3(0, length, 0), 0x5fbf8a)
  line(new THREE.Vector3(0, 0, -length), 0x4fa3ff)
  return g
}
