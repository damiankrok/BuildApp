/**
 * EditorStore — the framework-agnostic heart of BuildWorld.
 *
 * It owns one BuildingSession (model + undo/redo), the compiled scene, the
 * selection and the visibility state, and it enforces the one rule the UI
 * must never break:
 *
 *     command -> CanonicalBuildingModel -> geometry compiler -> viewport
 *
 * The inspector calls `setProperty`; that becomes a command; the command
 * updates the model; the model is recompiled; listeners are told. There is no
 * other way to change what is drawn. The `trace` records that order so a test
 * can prove it.
 *
 * No React and no Three.js in here.
 */
import {
  findObject,
  junctionsOfWall,
  layoutStair,
  levelIdOf,
  loadModel,
  polygonArea,
  resolveWallTopology,
  ringsOfWall,
  roofCutMode,
  roofOpeningUndersideRect,
  serializeModel,
  type CanonicalBuildingModel,
  type Door,
  type LoadResult,
  type ResolvedJunction,
  type RoofOpening,
  type SemanticKind,
  type Slab,
  type Stair,
  type SurfaceRegion,
  type WallExtent,
  type WallJunction,
  type WallRing,
} from '@buildapp/model'
import { BuildingSession, type BuildingCommand, type CommandResult } from '@buildapp/commands'
import { compileBuilding, type CompiledMesh, type CompiledScene } from '@buildapp/geometry'

export type ViewPreset = 'perspective' | 'front' | 'rear' | 'left' | 'right' | 'top'

export type EditorSnapshot = {
  model: CanonicalBuildingModel
  scene: CompiledScene
  selection: string | null
  hidden: ReadonlySet<string>
  isolated: string | null
  isolatedLevelId: string | null
  roofsVisible: boolean
  showGrid: boolean
  showAxes: boolean
  view: ViewPreset
  /** Increments on every setView, so applying the same preset again still re-frames. */
  viewNonce: number
  /** The object the camera should frame instead of the whole building (null = the whole building). */
  focus: string | null
  canUndo: boolean
  canRedo: boolean
  revision: number
  lastError: string | null
}

export type EditorTraceEntry =
  | { step: 'command'; type: string }
  | { step: 'model-updated'; revision: number }
  | { step: 'geometry-compiled'; triangles: number }
  | { step: 'listeners-notified' }
  | { step: 'command-rejected'; type: string; errors: string[] }

export type Listener = (snapshot: EditorSnapshot) => void

export class EditorStore {
  private session: BuildingSession
  private scene: CompiledScene
  private selection: string | null = null
  private hidden = new Set<string>()
  private isolated: string | null = null
  private isolatedLevelId: string | null = null
  private roofsVisible = true
  private showGrid = true
  private showAxes = true
  private view: ViewPreset = 'perspective'
  private viewNonce = 0
  private focus: string | null = null
  private revision = 0
  private lastError: string | null = null
  private listeners = new Set<Listener>()
  private snapshot: EditorSnapshot | null = null
  /** The last few pipeline steps, oldest first. */
  readonly trace: EditorTraceEntry[] = []

  constructor(model: CanonicalBuildingModel) {
    this.session = new BuildingSession(model)
    this.scene = compileBuilding(model)
  }

  // --- state access -------------------------------------------------------

  get model(): CanonicalBuildingModel {
    return this.session.model
  }

  getSnapshot(): EditorSnapshot {
    if (!this.snapshot) {
      this.snapshot = {
        model: this.session.model,
        scene: this.scene,
        selection: this.selection,
        hidden: new Set(this.hidden),
        isolated: this.isolated,
        isolatedLevelId: this.isolatedLevelId,
        roofsVisible: this.roofsVisible,
        showGrid: this.showGrid,
        showAxes: this.showAxes,
        view: this.view,
        viewNonce: this.viewNonce,
        focus: this.focus,
        canUndo: this.session.canUndo,
        canRedo: this.session.canRedo,
        revision: this.revision,
        lastError: this.lastError,
      }
    }
    return this.snapshot
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    this.snapshot = null
    const s = this.getSnapshot()
    for (const l of this.listeners) l(s)
  }

  private record(e: EditorTraceEntry): void {
    this.trace.push(e)
    if (this.trace.length > 64) this.trace.shift()
  }

  // --- the one path that changes geometry ----------------------------------

  private afterModelChange(): void {
    this.revision++
    this.record({ step: 'model-updated', revision: this.revision })
    this.scene = compileBuilding(this.session.model)
    this.record({ step: 'geometry-compiled', triangles: this.scene.stats.triangleCount })
    // Selection and visibility only refer to objects that still exist.
    if (this.selection && !findObject(this.session.model, this.selection)) this.selection = null
    if (this.isolated && !findObject(this.session.model, this.isolated)) this.isolated = null
    if (this.isolatedLevelId && !findObject(this.session.model, this.isolatedLevelId)) this.isolatedLevelId = null
    if (this.focus && !findObject(this.session.model, this.focus)) this.focus = null
    for (const id of [...this.hidden]) if (!findObject(this.session.model, id)) this.hidden.delete(id)
    this.notify()
    this.record({ step: 'listeners-notified' })
  }

  execute(command: BuildingCommand): CommandResult {
    this.record({ step: 'command', type: command.type })
    const r = this.session.execute(command)
    if (!r.ok) {
      this.lastError = r.errors.map((e) => `[${e.code}] ${e.message}`).join('\n')
      this.record({ step: 'command-rejected', type: command.type, errors: r.errors.map((e) => e.code) })
      this.notify()
      return r
    }
    this.lastError = null
    this.afterModelChange()
    return r
  }

  /** Inspector entry point: one property of one object. */
  setProperty(targetId: string, property: string, value: unknown): CommandResult {
    return this.execute({ type: 'setProperty', targetId, property, value })
  }

  undo(): boolean {
    const ok = this.session.undo()
    if (ok) {
      this.record({ step: 'command', type: 'undo' })
      this.afterModelChange()
    }
    return ok
  }

  redo(): boolean {
    const ok = this.session.redo()
    if (ok) {
      this.record({ step: 'command', type: 'redo' })
      this.afterModelChange()
    }
    return ok
  }

  /** Replace the whole model (file load). Clears history, selection and visibility. */
  replaceModel(model: CanonicalBuildingModel): void {
    this.session.replace(model)
    this.selection = null
    this.hidden.clear()
    this.isolated = null
    this.isolatedLevelId = null
    this.focus = null
    this.lastError = null
    this.record({ step: 'command', type: 'replace' })
    this.afterModelChange()
  }

  // --- persistence --------------------------------------------------------

  saveJson(): string {
    return serializeModel(this.session.model)
  }

  loadJson(text: string): LoadResult {
    const r = loadModel(text)
    if (r.ok) this.replaceModel(r.model)
    else {
      this.lastError = r.issues.map((i) => `[${i.code}] ${i.message}`).join('\n')
      this.notify()
    }
    return r
  }

  // --- selection and visibility -------------------------------------------

  select(id: string | null): void {
    if (id !== null && !findObject(this.session.model, id)) return
    this.selection = id
    this.notify()
  }

  hide(id: string): void {
    this.hidden.add(id)
    this.notify()
  }

  show(id: string): void {
    this.hidden.delete(id)
    this.notify()
  }

  toggleHidden(id: string): void {
    if (this.hidden.has(id)) this.hidden.delete(id)
    else this.hidden.add(id)
    this.notify()
  }

  isolate(id: string | null): void {
    this.isolated = id
    this.notify()
  }

  isolateLevel(levelId: string | null): void {
    this.isolatedLevelId = levelId
    this.notify()
  }

  setRoofsVisible(v: boolean): void {
    this.roofsVisible = v
    this.notify()
  }

  resetVisibility(): void {
    this.hidden.clear()
    this.isolated = null
    this.isolatedLevelId = null
    this.roofsVisible = true
    this.notify()
  }

  setGrid(v: boolean): void {
    this.showGrid = v
    this.notify()
  }

  setAxes(v: boolean): void {
    this.showAxes = v
    this.notify()
  }

  setView(v: ViewPreset): void {
    this.view = v
    this.viewNonce++
    this.notify()
  }

  /** Frame one object (the selection by default) in the current view; `frame(null)` frames the whole building again. */
  frame(id: string | null = this.selection): void {
    this.focus = id !== null && findObject(this.session.model, id) ? id : null
    this.viewNonce++
    this.notify()
  }

  /** The object ids that make up one object's visual family (a wall with its openings and fills). */
  familyOf(id: string): Set<string> {
    const m = this.session.model
    const out = new Set<string>([id])
    const hit = findObject(m, id)
    if (!hit) return out
    if (hit.kind === 'level') {
      for (const mesh of this.scene.meshes) if (mesh.levelId === id) out.add(mesh.objectId)
    }
    if (hit.kind === 'wall') {
      for (const o of m.openings) if (o.wallId === id || o.leaves?.some((l) => l.wallId === id)) out.add(o.id)
      for (const r of m.surfaceRegions) if (r.hostId === id) out.add(r.id)
    }
    if (hit.kind === 'roof') {
      for (const o of m.roofOpenings) if (o.roofId === id) out.add(o.id)
    }
    if (hit.kind === 'roofOpening') out.add(id)
    for (const o of [...out]) for (const r of m.rooflights) if (r.roofOpeningId === o) out.add(r.id)
    if (hit.kind === 'wallRing') {
      for (const wallId of (hit.object as WallRing).wallIds) {
        out.add(wallId)
        for (const o of m.openings) if (o.wallId === wallId) out.add(o.id)
      }
    }
    if (hit.kind === 'wallJunction') {
      const j = hit.object as WallJunction
      for (const wallId of j.kind === 'CORNER' ? [j.a.wallId, j.b.wallId] : [j.wall.wallId, j.againstWallId]) out.add(wallId)
    }
    for (const o of [...out]) {
      for (const w of m.windows) if (w.openingId === o) out.add(w.id)
      for (const d of m.doors) if (d.openingId === o) out.add(d.id)
    }
    if (hit.kind === 'balcony') for (const r of m.railings) if (r.hostId === id) out.add(r.id)
    return out
  }

  /** Whether a compiled mesh is currently shown. */
  isMeshVisible(mesh: CompiledMesh): boolean {
    if (!this.roofsVisible && (mesh.objectKind === 'roof' || mesh.hostRoofId)) return false
    if (this.isolatedLevelId && mesh.levelId !== this.isolatedLevelId) return false
    if (this.isolated) {
      const fam = this.familyOf(this.isolated)
      if (!fam.has(mesh.objectId)) return false
    }
    if (this.hidden.has(mesh.objectId)) return false
    if (mesh.hostWallId && this.hidden.has(mesh.hostWallId)) return false
    if (mesh.hostRoofId && this.hidden.has(mesh.hostRoofId)) return false
    if (mesh.openingId && this.hidden.has(mesh.openingId)) return false
    if (mesh.levelId && this.hidden.has(mesh.levelId)) return false
    return true
  }

  visibleMeshes(): CompiledMesh[] {
    return this.scene.meshes.filter((m) => this.isMeshVisible(m))
  }

  isObjectVisible(id: string): boolean {
    const meshes = this.scene.meshes.filter((m) => m.objectId === id)
    if (meshes.length === 0) return !this.hidden.has(id)
    return meshes.some((m) => this.isMeshVisible(m))
  }

  // --- outliner ------------------------------------------------------------

  sceneTree(): TreeNode[] {
    return buildTree(this.session.model)
  }

  describe(id: string): ObjectDescription | undefined {
    const m = this.session.model
    const hit = findObject(m, id)
    if (!hit) return undefined
    const levelId = levelIdOf(m, id)
    const o = hit.object as Record<string, unknown>
    const hostWallId = hit.kind === 'opening' ? (o.wallId as string) : hit.kind === 'window' || hit.kind === 'door' ? m.openings.find((x) => x.id === o.openingId)?.wallId : undefined
    const host = hostOf(m, hit.kind, hit.object)
    const evidence = o.evidence as { sourceIds?: string[] } | undefined
    const evidenceSources = (evidence?.sourceIds ?? []).map((sid) => {
      const src = m.evidenceSources.find((x) => x.id === sid)
      return { id: sid, label: src?.label ?? sid, kind: src?.kind, uri: src?.uri }
    })
    return {
      id,
      kind: hit.kind,
      object: hit.object,
      name: (o.name as string | undefined) ?? id,
      levelId,
      hostWallId,
      host,
      evidenceSources,
      openingId: hit.kind === 'window' || hit.kind === 'door' ? (o.openingId as string) : undefined,
      properties: editableProperties(hit.kind, hit.object, m),
      meshCount: this.scene.meshes.filter((mm) => mm.objectId === id).length,
      topology: this.topologyOf(id, hit.kind),
      details: describeDetails(m, hit.kind, hit.object),
    }
  }

  /**
   * The resolved wall topology around an object, for the inspector: a wall's
   * physical extent and the junctions at its ends; a junction's resolution;
   * a ring's walls and corners. Nothing here is persisted — it is derived
   * from the junction records exactly as the compiler derives it.
   */
  topologyOf(id: string, kind: SemanticKind): TopologyDescription | undefined {
    const m = this.session.model
    if (kind !== 'wall' && kind !== 'wallJunction' && kind !== 'wallRing') return undefined
    const topo = resolveWallTopology(m)
    if (kind === 'wall') {
      const extent = topo.extents.get(id)
      const junctions = junctionsOfWall(m, id).map((j) => {
        const r = topo.junctions.get(j.id)
        const part = r?.participants.find((p) => p.wallId === id)
        return { id: j.id, kind: j.kind, role: part?.role ?? 'HOST', end: part?.end, ok: r?.ok ?? false }
      })
      return { extent, junctions, rings: ringsOfWall(m, id).map((r) => r.id) }
    }
    if (kind === 'wallJunction') return { junction: topo.junctions.get(id) }
    const ring = m.wallRings.find((r) => r.id === id)
    return ring ? { ringWalls: ring.wallIds, ringJunctions: ring.junctionIds, ringClosed: ring.junctionIds.every((j) => topo.junctions.get(j)?.ok) } : undefined
  }
}

export type TopologyDescription = {
  extent?: WallExtent
  junctions?: Array<{ id: string; kind: WallJunction['kind']; role: string; end?: string; ok: boolean }>
  rings?: string[]
  junction?: ResolvedJunction
  ringWalls?: string[]
  ringJunctions?: string[]
  ringClosed?: boolean
}

export type TreeNode = { id: string; kind: SemanticKind; label: string; children: TreeNode[] }

export type PropertySpec = {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'boolean'
  unit?: string
  min?: number
  max?: number
  step?: number
  options?: readonly string[]
}

/** The object an object is hosted by: its parent in the model's ownership chain. */
export type HostRef = { id: string; kind: SemanticKind; relation: string }

export type ObjectDescription = {
  id: string
  kind: SemanticKind
  object: unknown
  name: string
  levelId?: string
  hostWallId?: string
  /** Generic parent: a wall for an opening, an opening for a fill, a roof for a roof opening, a balcony for a railing, ... */
  host?: HostRef
  /** The evidence sources the object's `evidence.sourceIds` cite, resolved to their labels. */
  evidenceSources: Array<{ id: string; label: string; kind?: string; uri?: string }>
  openingId?: string
  properties: PropertySpec[]
  meshCount: number
  topology?: TopologyDescription
  /** Derived, read-only facts about the object's composition (stair layout, slab holes, roof cut, door panels, finish region), re-derived from the records like the compiler does. */
  details: DetailRow[]
}

export type DetailRow = { label: string; value: string; /** Another object this row points at, selectable. */ ref?: string }

const f3 = (n: number): string => (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(3))

/** The derived composition of an object, by kind. Nothing here is project-specific. */
export function describeDetails(m: CanonicalBuildingModel, kind: SemanticKind, object: unknown): DetailRow[] {
  const rows: DetailRow[] = []
  switch (kind) {
    case 'stair': {
      const st = object as Stair
      rows.push({ label: 'kind', value: st.kind })
      if (st.kind !== 'FLIGHTS') break
      const from = m.levels.find((l) => l.id === st.levelId)
      const to = m.levels.find((l) => l.id === st.toLevelId)
      rows.push({ label: 'to level', value: st.toLevelId, ref: st.toLevelId })
      if (!from || !to) break
      const lay = layoutStair(st, from, to)
      rows.push({ label: 'rise', value: `${f3(lay.rise)} m (${f3(lay.baseY)} → ${f3(lay.topY)})` })
      rows.push({ label: 'risers', value: `${lay.risers} × ${f3(lay.riserHeight)} m` })
      rows.push({ label: 'width', value: `${f3(st.width)} m` })
      rows.push({ label: 'start', value: `x ${f3(st.start.x)} z ${f3(st.start.z)} → ${st.direction}` })
      st.segments.forEach((seg, i) => {
        const v = seg.kind === 'FLIGHT' ? `${seg.risers} risers, going ${f3(seg.going)} m` : seg.kind === 'WINDER' ? `${seg.risers} winders, ${seg.turn} ${seg.angleDeg}°` : `landing ${f3(seg.length)} m${seg.turn === 'NONE' ? '' : ', ' + seg.turn}`
        rows.push({ label: `segment ${i + 1}`, value: `${seg.kind}: ${v}` })
      })
      if (lay.extent) rows.push({ label: 'steps extent', value: `x ${f3(lay.extent.minX)}..${f3(lay.extent.maxX)} z ${f3(lay.extent.minZ)}..${f3(lay.extent.maxZ)}` })
      const voids = m.slabs.filter((sl) => (sl.holes ?? []).length > 0 && sl.levelId === st.toLevelId)
      for (const sl of voids) rows.push({ label: 'slab void', value: `${sl.id} (${sl.holes!.length} hole${sl.holes!.length === 1 ? '' : 's'})`, ref: sl.id })
      break
    }
    case 'slab': {
      const sl = object as Slab
      const gross = polygonArea(sl.polygon)
      const holes = sl.holes ?? []
      const holeArea = holes.reduce((a, h) => a + polygonArea(h), 0)
      rows.push({ label: 'outline area', value: `${f3(gross)} m²` })
      rows.push({ label: 'holes', value: holes.length === 0 ? 'none (solid plate)' : `${holes.length}, ${f3(holeArea)} m² removed` })
      holes.forEach((h, i) => {
        const xs = h.map((p) => p.x)
        const zs = h.map((p) => p.z)
        rows.push({ label: `hole ${i + 1}`, value: `${h.length} vertices, ${f3(polygonArea(h))} m², x ${f3(Math.min(...xs))}..${f3(Math.max(...xs))} z ${f3(Math.min(...zs))}..${f3(Math.max(...zs))}` })
      })
      if (holes.length > 0) rows.push({ label: 'net area', value: `${f3(gross - holeArea)} m²` })
      for (const st of m.stairs) if (st.toLevelId === sl.levelId && holes.length > 0) rows.push({ label: 'stair through', value: st.id, ref: st.id })
      break
    }
    case 'roofOpening': {
      const o = object as RoofOpening
      const roof = m.roofs.find((r) => r.id === o.roofId)
      rows.push({ label: 'cut', value: roofCutMode(o) })
      if (roof) {
        const u = roofOpeningUndersideRect(roof, o)
        const dx = u.minX - o.footprint.minX
        const dz = u.minZ - o.footprint.minZ
        rows.push({ label: 'top outline', value: `x ${f3(o.footprint.minX)}..${f3(o.footprint.maxX)} z ${f3(o.footprint.minZ)}..${f3(o.footprint.maxZ)}` })
        rows.push({ label: 'underside outline', value: `x ${f3(u.minX)}..${f3(u.maxX)} z ${f3(u.minZ)}..${f3(u.maxZ)}${Math.abs(dx) + Math.abs(dz) > 1e-9 ? ` (shifted ${f3(Math.hypot(dx, dz))} m uphill)` : ' (same: vertical cut)'}` })
      }
      if (o.throughId) rows.push({ label: 'lets through', value: o.throughId, ref: o.throughId })
      break
    }
    case 'door': {
      const d = object as Door
      const op = m.openings.find((x) => x.id === d.openingId)
      if (!d.assembly) {
        rows.push({ label: 'assembly', value: `one leaf, hinge ${d.hingeSide}, swing ${d.swing}` })
        break
      }
      rows.push({ label: 'assembly', value: `${d.assembly.panels.length} panels, mullions ${f3(d.assembly.mullionWidth)} m` })
      let cursor = 0
      d.assembly.panels.forEach((p, i) => {
        const w = op ? p.fraction * op.width : NaN
        const span = op ? `${f3(cursor)}..${f3(cursor + p.fraction)} of the width (${f3(w)} m)` : `${f3(cursor)}..${f3(cursor + p.fraction)}`
        cursor += p.fraction
        const extra = p.kind === 'LEAF' ? `, hinge ${p.hinge}${p.glazing === 'FULL' ? ', fully glazed' : ''}` : ''
        rows.push({ label: `panel ${i + 1}`, value: `${p.kind}: ${span}${extra}` })
      })
      break
    }
    case 'surfaceRegion': {
      const r = object as SurfaceRegion
      const mat = m.materials.find((x) => x.id === r.materialId)
      rows.push({ label: 'host wall', value: r.hostId, ref: r.hostId })
      rows.push({ label: 'face', value: r.face })
      rows.push({ label: 'rect', value: `a ${f3(r.rect.a0)}..${f3(r.rect.a1)} b ${f3(r.rect.b0)}..${f3(r.rect.b1)} (${f3((r.rect.a1 - r.rect.a0) * (r.rect.b1 - r.rect.b0))} m² before clipping)` })
      rows.push({ label: 'material', value: mat ? `${mat.name} (${mat.color})` : r.materialId, ref: r.materialId })
      rows.push({ label: 'thickness', value: 'none: appearance only, clipped to the wall material' })
      break
    }
    case 'wall': {
      const w = object as { id: string }
      for (const r of m.surfaceRegions.filter((x) => x.hostId === w.id)) rows.push({ label: 'finish region', value: `${r.id} (${r.face}, ${r.materialId})`, ref: r.id })
      break
    }
    default:
      break
  }
  return rows
}

/** The ownership parent of an object, by kind. Nothing here is project-specific: it reads the generic reference fields. */
export function hostOf(m: CanonicalBuildingModel, kind: SemanticKind, object: unknown): HostRef | undefined {
  const o = object as Record<string, unknown>
  switch (kind) {
    case 'opening':
      return { id: o.wallId as string, kind: 'wall', relation: 'cut through' }
    case 'window':
    case 'door':
      return { id: o.openingId as string, kind: 'opening', relation: 'fills' }
    case 'roofOpening':
      return { id: o.roofId as string, kind: 'roof', relation: 'cut through' }
    case 'rooflight':
      return { id: o.roofOpeningId as string, kind: 'roofOpening', relation: 'fills' }
    case 'railing':
      return typeof o.hostId === 'string' ? { id: o.hostId, kind: m.balconies.some((b) => b.id === o.hostId) ? 'balcony' : 'slab', relation: 'stands on' } : undefined
    case 'surfaceRegion':
      return { id: o.hostId as string, kind: 'wall', relation: 'finish on' }
    case 'wall':
    case 'room':
    case 'slab':
    case 'roof':
    case 'balcony':
    case 'chimney':
    case 'stair':
      return typeof o.levelId === 'string' ? { id: o.levelId, kind: 'level', relation: 'on level' } : undefined
    case 'wallRing':
      return typeof o.levelId === 'string' ? { id: o.levelId, kind: 'level', relation: 'on level' } : undefined
    case 'wallJunction': {
      const j = object as WallJunction
      return j.kind === 'CORNER' ? { id: j.a.wallId, kind: 'wall', relation: 'joins' } : { id: j.againstWallId, kind: 'wall', relation: 'against' }
    }
    case 'level':
      return m.building ? { id: m.building.id, kind: 'building', relation: 'in building' } : undefined
    default:
      return undefined
  }
}

const num = (key: string, label: string, unit = 'm', step = 0.05, min?: number, max?: number): PropertySpec => ({ key, label, type: 'number', unit, step, min, max })
const text = (key: string, label: string): PropertySpec => ({ key, label, type: 'text' })
const sel = (key: string, label: string, options: readonly string[]): PropertySpec => ({ key, label, type: 'select', options })

/** Which properties the inspector may edit, per kind. Everything goes through setProperty. */
export function editableProperties(kind: SemanticKind, object?: unknown, model?: CanonicalBuildingModel): PropertySpec[] {
  switch (kind) {
    case 'surfaceRegion':
      return [text('name', 'Name'), sel('face', 'Face', ['OUTER', 'INNER']), num('rect.a0', 'From (along)', 'm', 0.05), num('rect.a1', 'To (along)', 'm', 0.05), num('rect.b0', 'Bottom', 'm', 0.05), num('rect.b1', 'Top', 'm', 0.05), sel('materialId', 'Material', (model?.materials ?? []).map((x) => x.id))]
    case 'linearSolid':
      return [text('name', 'Name'), num('width', 'Width (seen)', 'm', 0.01, 0.001), num('depth', 'Depth (proud)', 'm', 0.01, 0.001), num('rollDeg', 'Roll', '°', 1), sel('materialId', 'Material', (model?.materials ?? []).map((x) => x.id))]
    case 'terrace':
      return [text('name', 'Name'), num('topOffset', 'Top (above floor)', 'm', 0.01), num('thickness', 'Thickness', 'm', 0.01, 0.01), sel('surface', 'Surface', ['PAVED', 'DECK', 'UNKNOWN']), sel('edge', 'Edge', ['PLINTH', 'FLUSH']), sel('materialId', 'Material', (model?.materials ?? []).map((x) => x.id))]
    case 'wallJunction': {
      const j = object as WallJunction | undefined
      const specs: PropertySpec[] = [text('name', 'Name'), num('tolerance', 'Tolerance', 'm', 0.001, 0)]
      if (j?.kind === 'CORNER') specs.push(sel('owner', 'Corner owner', [j.a.wallId, j.b.wallId]))
      return specs
    }
    case 'wallRing':
      return [text('name', 'Name')]
    case 'building':
      return [text('name', 'Name')]
    case 'level':
      return [text('name', 'Name'), num('elevation', 'Elevation'), num('height', 'Storey height', 'm', 0.05, 0.1)]
    case 'wall':
      return [text('name', 'Name'), num('height', 'Height', 'm', 0.05, 0.1), num('thickness', 'Thickness', 'm', 0.01, 0.01), num('baseOffset', 'Base offset'), sel('kind', 'Kind', ['EXTERIOR', 'INTERIOR'])]
    case 'opening':
      return [num('offset', 'Offset along wall'), num('sill', 'Sill', 'm', 0.05, 0), num('width', 'Width', 'm', 0.05, 0.1), num('height', 'Height', 'm', 0.05, 0.1)]
    case 'window':
      return [num('frameWidth', 'Frame width', 'm', 0.01, 0.01), num('frameDepth', 'Frame depth', 'm', 0.01, 0.01), num('frameInset', 'Frame inset', 'm', 0.01, 0), num('glassThickness', 'Glass thickness', 'm', 0.002, 0.002), num('divisions', 'Divisions', '', 1, 1, 8)]
    case 'door':
      return [num('openAngle', 'Open angle', '°', 5, 0, 180), sel('hingeSide', 'Hinge side', ['LEFT', 'RIGHT']), sel('swing', 'Swing', ['IN', 'OUT']), num('leafThickness', 'Leaf thickness', 'm', 0.005, 0.01), num('frameWidth', 'Frame width', 'm', 0.01, 0.01), num('frameDepth', 'Frame depth', 'm', 0.01, 0.01), num('frameInset', 'Frame inset', 'm', 0.01, 0)]
    case 'slab':
      return [text('name', 'Name'), num('topOffset', 'Top offset'), num('thickness', 'Thickness', 'm', 0.01, 0.01)]
    case 'roof':
      return [text('name', 'Name'), num('pitchDeg', 'Pitch', '°', 1, 0, 85), num('eaveOffset', 'Eave offset'), num('overhang', 'Overhang', 'm', 0.05, 0), num('thickness', 'Thickness', 'm', 0.01, 0.01), sel('ridgeAxis', 'Ridge axis', ['X', 'Z'])]
    case 'roofOpening':
      return [text('name', 'Name'), sel('cut', 'Cut', ['VERTICAL', 'NORMAL_TO_ROOF']), num('footprint.minX', 'Min x'), num('footprint.maxX', 'Max x'), num('footprint.minZ', 'Min z'), num('footprint.maxZ', 'Max z')]
    case 'rooflight':
      return [text('name', 'Name'), num('frameWidth', 'Frame width', 'm', 0.01, 0.01), num('glassThickness', 'Glass thickness', 'm', 0.002, 0.002)]
    case 'balcony':
      return [text('name', 'Name'), sel('kind', 'Kind', ['BALCONY', 'TERRACE', 'LOGGIA']), num('topOffset', 'Top offset'), num('thickness', 'Thickness', 'm', 0.01, 0.01)]
    case 'railing':
      return [num('height', 'Height', 'm', 0.05, 0.1), num('baseOffset', 'Base offset'), num('postSpacing', 'Post spacing', 'm', 0.05, 0.1), sel('infill', 'Infill', ['GLASS', 'BARS', 'NONE'])]
    case 'chimney':
      return [num('baseOffset', 'Base offset'), num('height', 'Height', 'm', 0.1, 0.1)]
    case 'room':
      return [text('name', 'Name'), text('usage', 'Usage')]
    case 'stair': {
      const st = object as Stair | undefined
      if (st?.kind === 'FLIGHTS') return [text('name', 'Name'), num('width', 'Width', 'm', 0.05, 0.5), num('baseOffset', 'Base offset', 'm', 0.01), num('topOffset', 'Top offset', 'm', 0.01), num('waist', 'Waist', 'm', 0.01, 0.02)]
      return [text('name', 'Name')]
    }
    case 'material':
      return [text('name', 'Name'), text('color', 'Colour')]
    case 'constraint':
      return [text('note', 'Note')]
    case 'evidenceSource':
      return [text('label', 'Label')]
  }
}

/** A junction's default label: kind, participants and owner. */
export function junctionLabel(j: WallJunction): string {
  if (j.kind === 'CORNER') return `CORNER ${j.a.wallId}/${j.a.end} + ${j.b.wallId}/${j.b.end} (owner ${j.owner})`
  return `${j.kind} ${j.wall.wallId}/${j.wall.end} → ${j.againstWallId}`
}

function buildTree(m: CanonicalBuildingModel): TreeNode[] {
  const label = (o: { id: string; name?: string }, fallback?: string): string => o.name ?? fallback ?? o.id
  const roots: TreeNode[] = []
  const buildingNode: TreeNode = m.building
    ? { id: m.building.id, kind: 'building', label: label(m.building, 'Building'), children: [] }
    : { id: '__no-building', kind: 'building', label: '(no building)', children: [] }
  roots.push(buildingNode)
  const levels = [...m.levels].sort((a, b) => a.index - b.index)
  for (const level of levels) {
    const node: TreeNode = { id: level.id, kind: 'level', label: label(level), children: [] }
    const group = (kind: SemanticKind, title: string, items: TreeNode[]): void => {
      if (items.length > 0) node.children.push({ id: `${level.id}:${kind}`, kind, label: `${title} (${items.length})`, children: items })
    }
    group(
      'wall',
      'Walls',
      m.walls
        .filter((w) => w.levelId === level.id)
        .map((w) => ({
          id: w.id,
          kind: 'wall' as const,
          label: label(w),
          children: [
            ...m.openings
              .filter((o) => o.wallId === w.id)
              .map((o) => ({
                id: o.id,
                kind: 'opening' as const,
                label: label(o, `${o.kind.toLowerCase()} opening ${o.width}×${o.height}`),
                children: [
                  ...m.windows.filter((x) => x.openingId === o.id).map((x) => ({ id: x.id, kind: 'window' as const, label: label(x, 'Window'), children: [] })),
                  ...m.doors.filter((x) => x.openingId === o.id).map((x) => ({ id: x.id, kind: 'door' as const, label: label(x, 'Door'), children: [] })),
                ],
              })),
            ...m.surfaceRegions.filter((r) => r.hostId === w.id).map((r) => ({ id: r.id, kind: 'surfaceRegion' as const, label: label(r, `${r.face.toLowerCase()} finish ${r.materialId}`), children: [] })),
          ],
        })),
    )
    const junctionNode = (j: WallJunction): TreeNode => ({ id: j.id, kind: 'wallJunction' as const, label: label(j, junctionLabel(j)), children: [] })
    const levelWallIds = new Set(m.walls.filter((w) => w.levelId === level.id).map((w) => w.id))
    const rings = m.wallRings.filter((r) => r.levelId === level.id)
    const inRing = new Set(rings.flatMap((r) => r.junctionIds))
    const looseJunctions = m.wallJunctions.filter((j) => !inRing.has(j.id) && levelWallIds.has(j.kind === 'CORNER' ? j.a.wallId : j.wall.wallId))
    if (rings.length > 0 || looseJunctions.length > 0) {
      node.children.push({
        id: `${level.id}:topology`,
        kind: 'wallJunction',
        label: `Topology (${rings.length} ring${rings.length === 1 ? '' : 's'}, ${m.wallJunctions.filter((j) => levelWallIds.has(j.kind === 'CORNER' ? j.a.wallId : j.wall.wallId)).length} junctions)`,
        children: [
          ...rings.map((r) => ({
            id: r.id,
            kind: 'wallRing' as const,
            label: label(r, `Ring of ${r.wallIds.length} walls`),
            children: r.junctionIds.map((jid) => m.wallJunctions.find((j) => j.id === jid)).filter((j): j is WallJunction => !!j).map(junctionNode),
          })),
          ...looseJunctions.map(junctionNode),
        ],
      })
    }
    group('room', 'Rooms', m.rooms.filter((r) => r.levelId === level.id).map((r) => ({ id: r.id, kind: 'room' as const, label: label(r), children: [] })))
    group('slab', 'Slabs', m.slabs.filter((s) => s.levelId === level.id).map((s) => ({ id: s.id, kind: 'slab' as const, label: label(s), children: [] })))
    group(
      'roof',
      'Roofs',
      m.roofs
        .filter((r) => r.levelId === level.id)
        .map((r) => ({
          id: r.id,
          kind: 'roof' as const,
          label: label(r),
          children: m.roofOpenings
            .filter((o) => o.roofId === r.id)
            .map((o) => ({
              id: o.id,
              kind: 'roofOpening' as const,
              label: label(o, `${o.kind.toLowerCase()} ${o.footprint.maxX - o.footprint.minX}×${o.footprint.maxZ - o.footprint.minZ}`),
              children: m.rooflights.filter((x) => x.roofOpeningId === o.id).map((x) => ({ id: x.id, kind: 'rooflight' as const, label: label(x, 'Rooflight'), children: [] })),
            })),
        })),
    )
    group(
      'balcony',
      'Balconies',
      m.balconies
        .filter((b) => b.levelId === level.id)
        .map((b) => ({
          id: b.id,
          kind: 'balcony' as const,
          label: label(b),
          children: m.railings.filter((r) => r.hostId === b.id).map((r) => ({ id: r.id, kind: 'railing' as const, label: label(r), children: [] })),
        })),
    )
    group('railing', 'Railings', m.railings.filter((r) => r.levelId === level.id && !r.hostId).map((r) => ({ id: r.id, kind: 'railing' as const, label: label(r), children: [] })))
    group('chimney', 'Chimneys', m.chimneys.filter((c) => c.levelId === level.id).map((c) => ({ id: c.id, kind: 'chimney' as const, label: label(c), children: [] })))
    group('stair', 'Stairs', m.stairs.filter((s) => s.levelId === level.id).map((s) => ({ id: s.id, kind: 'stair' as const, label: label(s), children: [] })))
    buildingNode.children.push(node)
  }
  if (m.materials.length > 0) roots.push({ id: '__materials', kind: 'material', label: `Materials (${m.materials.length})`, children: m.materials.map((x) => ({ id: x.id, kind: 'material' as const, label: x.name, children: [] })) })
  if (m.constraints.length > 0) roots.push({ id: '__constraints', kind: 'constraint', label: `Constraints (${m.constraints.length})`, children: m.constraints.map((c) => ({ id: c.id, kind: 'constraint' as const, label: c.name ?? `${c.kind} ${c.property ?? ''}`.trim(), children: [] })) })
  if (m.evidenceSources.length > 0) roots.push({ id: '__sources', kind: 'evidenceSource', label: `Evidence sources (${m.evidenceSources.length})`, children: m.evidenceSources.map((s) => ({ id: s.id, kind: 'evidenceSource' as const, label: s.label, children: [] })) })
  return roots
}
