/**
 * v3.54.13 — the appearance consumer: an observation's material outlines, registered on the elevation, become finish
 * outlines (model schema 1.9.0 `SurfaceRegion.outline`) on the surfaces the compiled model actually shows there.
 *
 * One source boundary, then the hosts. Each outline is mapped once into the facade's metres (`along`, height) through
 * the observation's `toSource` and the solver's registration of that source elevation; only then is it split among
 * surfaces by what the model shows at each point (visibility.ts) — the ground- and upper-storey walls receive the parts
 * of the SAME polygon, so a boundary running through a floor stays one line on both, and a step stays where the source
 * puts it. A frame, a balustrade, a slab or a band in front keeps its own material; a part hidden behind a balustrade
 * belongs to the wall behind it (the finish continues there). Openings are not cut here: the compiler leaves them out.
 *
 * Colour, never geometry: walls, openings, rooms, stairs, levels and every id stay as they were; only the finish
 * regions of the facades the observation covers are replaced (end caps are kept), and `usableGeometryFingerprint` proves it.
 */
import { compileBuilding } from '@buildapp/geometry'
import { outlineProblem, validateModel, wallFrame, wallLength } from '@buildapp/model'
import type { CanonicalBuildingModel, SurfaceRegion, Wall } from '@buildapp/model'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import { applyAffine, parseAppearanceObservation } from './contract.js'
import type { AppearanceClass, AppearanceObservation } from './contract.js'
import { components, count, fillHoles, fillPolygon, grid, simplifyLoop, traceOuter } from './mask.js'
import type { Grid } from './mask.js'
import { elevationToCell, facadeAxes, visibilityMap } from './visibility.js'
import type { VisibilityMap } from './visibility.js'

export const APPEARANCE_CONSUMER_VERSION = '1.0.0' as const

/** The solver's registration of a source elevation (facadeAlignment.views[].projection): pixels → facade metres. */
export type ElevationProjection = { alongAtPx0: number; alongSign: number; mpp: number; zeroRow: number; mppV?: number }

/** What a class is given as, when the wall's own material is not already it. */
export const CLASS_MATERIAL: Partial<Record<AppearanceClass, { id: string; name: string; color: string }>> = {
  TIMBER: { id: 'mat-timber', name: 'Timber cladding', color: '#b07a4a' },
  DARK_RENDER: { id: 'mat-render-dark', name: 'Dark render', color: '#3a3a3c' },
  LIGHT_RENDER: { id: 'mat-wall', name: 'Rendered wall', color: '#e8e4dc' },
}

export type AppearanceTraceRegion = { regionId: string; hostId: string; face: 'OUTER'; class: AppearanceClass; materialId: string; areaM2: number; corners: number; fromRegions: string[] }
export type AppearanceTrace = {
  consumerVersion: string
  observationId: string
  facade: AppearanceObservation['facade']
  producer: AppearanceObservation['producer']
  cellM: number
  added: AppearanceTraceRegion[]
  removed: Array<{ regionId: string; hostId: string; why: string }>
  skipped: Array<{ hostId: string; class: AppearanceClass; why: string }>
  /** Classes drawn on surfaces that are not walls (a frame, a band, glass): left to those elements' own materials. */
  notOnWalls: Array<{ class: AppearanceClass; meshPart: string; cells: number }>
}

export type AppearanceResult = { model: CanonicalBuildingModel; traces: AppearanceTrace[]; fingerprintBefore: string; fingerprintAfter: string }

/** The model's usable geometry, ids and relations: everything but its finish regions, materials and notes. */
export function usableGeometryFingerprint(model: CanonicalBuildingModel): string {
  const { surfaceRegions: _r, materials: _m, meta: _meta, ...rest } = model
  void _r
  void _m
  void _meta
  return sha256Hex(stableJson(rest))
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
const CLASS_CODE: AppearanceClass[] = ['UNKNOWN', 'LIGHT_RENDER', 'DARK_RENDER', 'TIMBER', 'GLASS', 'ROOF', 'METAL', 'BACKGROUND']

export function applyAppearance(
  modelIn: CanonicalBuildingModel,
  observationsIn: readonly unknown[],
  projectionOf: (facade: AppearanceObservation['facade'], sourceByteHash: string) => ElevationProjection | undefined,
  options: { cellM?: number; minAreaM2?: number } = {},
): AppearanceResult {
  const cellM = options.cellM ?? 0.02
  const minArea = options.minAreaM2 ?? 0.15
  const observations = observationsIn.map(parseAppearanceObservation).sort((a, b) => (a.observationId < b.observationId ? -1 : 1))
  const model = structuredClone(modelIn) as CanonicalBuildingModel
  const fingerprintBefore = usableGeometryFingerprint(modelIn)
  const traces: AppearanceTrace[] = []
  const levelOf = new Map(model.levels.map((l) => [l.id, l]))
  for (const obs of observations) {
    const proj = projectionOf(obs.facade, obs.source.sourceByteHash)
    if (!proj) throw new Error(`appearance observation ${obs.observationId}: the ${obs.facade.toLowerCase()} elevation ${obs.source.sourceByteHash.slice(0, 12)} is not registered`)
    // what the model shows from this side, its finish regions left out
    const bare = { ...model, surfaceRegions: [] }
    const vis = visibilityMap(compileBuilding(bare), obs.facade, cellM)
    const trace: AppearanceTrace = { consumerVersion: APPEARANCE_CONSUMER_VERSION, observationId: obs.observationId, facade: obs.facade, producer: obs.producer, cellM, added: [], removed: [], skipped: [], notOnWalls: [] }
    // 1. the observation's classes on the facade grid, one source polygon each (larger first, a smaller one inside wins)
    const cls = grid(vis.w, vis.h)
    const covered = grid(vis.w, vis.h)
    const toGrid = (ring: ReadonlyArray<readonly [number, number]>): Array<[number, number]> =>
      ring.map(([x, y]) => {
        const [sx, sy] = applyAffine(obs.toSource, x, y)
        const along = proj.alongAtPx0 + proj.alongSign * proj.mpp * sx
        const height = (proj.zeroRow - sy) * (proj.mppV ?? proj.mpp)
        return elevationToCell(vis, along, height)
      })
    const areaPx = (ring: ReadonlyArray<readonly [number, number]>): number => Math.abs(ring.reduce((s, p, i) => s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0)) / 2
    const ordered = [...obs.regions].sort((a, b) => areaPx(b.outline) - areaPx(a.outline) || (a.regionId < b.regionId ? -1 : 1))
    const sourceOf = new Map<number, string[]>()
    for (const r of ordered) {
      const code = CLASS_CODE.indexOf(r.class)
      const g = toGrid(r.outline)
      fillPolygon(cls, g, code)
      if (r.class !== 'BACKGROUND') fillPolygon(covered, g, 1)
      for (const h of r.holes ?? []) fillPolygon(cls, toGrid(h), 0)
      sourceOf.set(code, [...(sourceOf.get(code) ?? []), r.regionId])
    }
    // 2. the walls this side shows with their outer face toward the viewer
    const ax = facadeAxes(obs.facade)
    const facing = model.walls.filter((w) => {
      const L = wallLength(w)
      if (L <= 1e-9) return false
      const nx = (w.end.z - w.start.z) / L // n = up × u = (u.z, 0, −u.x)
      const nz = -(w.end.x - w.start.x) / L
      return nx * ax.toViewer.x + nz * ax.toViewer.z > 0.9
    })
    const facingIds = new Set(facing.map((w) => w.id))
    const meshWall = (mi: number): { wallId: string; dontCare: boolean } | undefined => {
      const m = vis.meshes[mi]
      if (!m) return undefined
      if (m.part === 'WALL' && facingIds.has(m.objectId)) return { wallId: m.objectId, dontCare: false }
      // the glass, frames and reveals of an opening in a facing wall: the finish runs round them (the compiler cuts them)
      if (m.hostWallId && facingIds.has(m.hostWallId) && /^(WINDOW_|DOOR_|WALL_REVEAL)/.test(m.part)) return { wallId: m.hostWallId, dontCare: true }
      return undefined
    }
    // classes seen on non-walls, for the trace (a frame drawn light, a band dark…)
    const offWall = new Map<string, number>()
    for (let k = 0; k < cls.data.length; k++) {
      if (!cls.data[k] || vis.mesh[k] < 0) continue
      const mw = meshWall(vis.mesh[k])
      if (mw) continue
      const key = `${CLASS_CODE[cls.data[k]]}|${vis.meshes[vis.mesh[k]].part}`
      offWall.set(key, (offWall.get(key) ?? 0) + 1)
    }
    trace.notOnWalls = [...offWall].map(([k, n]) => ({ class: k.split('|')[0] as AppearanceClass, meshPart: k.split('|')[1], cells: n })).sort((a, b) => b.cells - a.cells)
    // 3. per wall: replace its finish on this face by the observation's outlines, class by class
    const kept: SurfaceRegion[] = []
    const added: SurfaceRegion[] = []
    for (const w of facing) {
      const own = grid(vis.w, vis.h)
      const ownOrOpening = grid(vis.w, vis.h)
      let coveredHere = 0
      for (let k = 0; k < vis.mesh.length; k++) {
        const mw = vis.mesh[k] >= 0 ? meshWall(vis.mesh[k]) : undefined
        if (!mw || mw.wallId !== w.id) continue
        ownOrOpening.data[k] = 1
        if (!mw.dontCare) own.data[k] = 1
        if (covered.data[k]) coveredHere++
      }
      if (coveredHere * cellM * cellM < minArea) continue // the observation does not speak for this wall
      for (const r of model.surfaceRegions) {
        if (r.hostId === w.id && r.face === 'OUTER') trace.removed.push({ regionId: r.id, hostId: w.id, why: `replaced by the ${obs.producer.kind.toLowerCase().replace(/_/g, ' ')} outlines of ${obs.observationId} on this face` })
      }
      // one partition of the wall's covered surface (openings included: the compiler cuts them) among the finishes the
      // observation draws on it: every cell takes the finish nearest to it in the drawing (a breadth-first growth from
      // the cells the drawing gives a finish), so two finishes meet on one shared edge — no gap showing the wall, no
      // overlap of two skins — and glass or metal the drawing shows where the model has wall takes its neighbour's finish
      const FINISHES = ['TIMBER', 'DARK_RENDER', 'LIGHT_RENDER'] as const
      const lab = new Int8Array(vis.w * vis.h).fill(-1)
      const allowed = (k: number): boolean => ownOrOpening.data[k] === 1 && covered.data[k] === 1
      let frontier: number[] = []
      for (let k = 0; k < lab.length; k++) {
        if (!own.data[k] || !covered.data[k]) continue
        const f = FINISHES.indexOf(CLASS_CODE[cls.data[k]] as (typeof FINISHES)[number])
        if (f >= 0) {
          lab[k] = f
          frontier.push(k)
        }
      }
      while (frontier.length > 0) {
        const next: number[] = []
        for (const k of frontier) {
          const i = k % vis.w
          for (const q of [i > 0 ? k - 1 : -1, i < vis.w - 1 ? k + 1 : -1, k - vis.w, k + vis.w]) {
            if (q < 0 || q >= lab.length || lab[q] >= 0 || !allowed(q)) continue
            lab[q] = lab[k]
            next.push(q)
          }
        }
        frontier = next
      }
      // the parts, largest first: a part enclosing a smaller part of another finish absorbs it (an island), named
      type Part = { f: number; comp: Grid; filled: Grid; n: number }
      const parts: Part[] = []
      FINISHES.forEach((_, f) => {
        const m = grid(vis.w, vis.h)
        for (let k = 0; k < lab.length; k++) if (lab[k] === f) m.data[k] = 1
        for (const comp of components(m)) {
          const filled = fillHoles(comp)
          parts.push({ f, comp, filled, n: count(filled) })
        }
      })
      parts.sort((a, b) => b.n - a.n || a.f - b.f)
      const taken = grid(vis.w, vis.h)
      const serial = new Map<number, number>()
      for (const part of parts) {
        const cname = FINISHES[part.f]
        const mat = CLASS_MATERIAL[cname]
        if (!mat) continue
        let free = 0
        for (let k = 0; k < taken.data.length; k++) if (part.comp.data[k] && !taken.data[k]) free++
        if (free === 0) continue // inside a larger part: absorbed with it
        for (let k = 0; k < taken.data.length; k++) if (part.filled.data[k]) taken.data[k] = 1
        if (part.n > count(part.comp)) trace.skipped.push({ hostId: w.id, class: cname, why: `${((part.n - count(part.comp)) * cellM * cellM).toFixed(2)} m² of other finishes inside this ${cname.toLowerCase().replace(/_/g, ' ')} part are given to it (an outline carries no holes)` })
        if (part.n * cellM * cellM < minArea) {
          trace.skipped.push({ hostId: w.id, class: cname, why: `a part of ${(part.n * cellM * cellM).toFixed(2)} m², under the ${minArea} m² floor: the wall's own material stays there` })
          continue
        }
        if ((w.materialId ?? 'mat-wall') === mat.id) {
          trace.skipped.push({ hostId: w.id, class: cname, why: `the wall's own material is already ${mat.id}` })
          continue
        }
        const code = CLASS_CODE.indexOf(cname)
        const outline = localOutline(part.filled, vis, w, levelOf.get(w.levelId)?.elevation ?? 0)
        if (!outline) {
          trace.skipped.push({ hostId: w.id, class: cname, why: 'no simple outline survives on the wall (a sliver)' })
          continue
        }
        const n = serial.get(part.f) ?? 0
        serial.set(part.f, n + 1)
        const id = `appearance-${obs.facade.toLowerCase()}-${w.id}-${cname.toLowerCase().replace(/_/g, '-')}-${n}`
        const rect = { a0: r6(Math.min(...outline.map((p) => p.a))), a1: r6(Math.max(...outline.map((p) => p.a))), b0: r6(Math.min(...outline.map((p) => p.b))), b1: r6(Math.max(...outline.map((p) => p.b))) }
        added.push({
          id,
          hostId: w.id,
          face: 'OUTER',
          rect,
          outline,
          materialId: mat.id,
          evidence: { status: 'VISUAL_INFERRED', interpretation: `a ${cname.toLowerCase().replace(/_/g, ' ')} outline from ${obs.observationId} (${obs.producer.kind}): colour, not geometry` },
        } as SurfaceRegion)
        trace.added.push({ regionId: id, hostId: w.id, face: 'OUTER', class: cname, materialId: mat.id, areaM2: r6(polyArea(outline)), corners: outline.length, fromRegions: sourceOf.get(code) ?? [] })
        if (!model.materials.some((x) => x.id === mat.id)) model.materials.push({ id: mat.id, name: mat.name, color: mat.color })
      }
    }
    const replacedHosts = new Set(trace.removed.map((r) => r.hostId))
    for (const r of model.surfaceRegions) if (!(replacedHosts.has(r.hostId) && r.face === 'OUTER')) kept.push(r)
    model.surfaceRegions = [...kept, ...added]
    traces.push(trace)
  }
  model.materials.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const v = validateModel(model)
  if (!v.ok || v.issues.some((i) => i.severity === 'ERROR')) throw new Error(`the appearance consumer made an invalid model: ${v.issues.filter((i) => i.severity === 'ERROR').map((i) => i.message).slice(0, 3).join('; ')}`)
  const fingerprintAfter = usableGeometryFingerprint(model)
  if (fingerprintAfter !== fingerprintBefore) throw new Error('the appearance consumer changed the geometry fingerprint: refused')
  return { model, traces, fingerprintBefore, fingerprintAfter }
}

const polyArea = (p: ReadonlyArray<{ a: number; b: number }>): number => Math.abs(p.reduce((s, q, i) => s + q.a * p[(i + 1) % p.length].b - p[(i + 1) % p.length].a * q.b, 0)) / 2

/** A component's outer loop, simplified, in the wall's (a, b), clipped to the wall; undefined when nothing simple survives. */
function localOutline(comp: Grid, vis: VisibilityMap, w: Wall, levelElevation: number): Array<{ a: number; b: number }> | undefined {
  const loop = traceOuter(comp)
  if (loop.length < 3) return undefined
  const f = wallFrame(w, { elevation: levelElevation })
  const L = wallLength(w)
  const alongIsX = vis.facade === 'FRONT' || vis.facade === 'REAR'
  // no simplification: two finishes meeting on the wall share the very same cell edges (a 2 cm staircase on a rake)
  for (const eps of [0]) {
    const simple = simplifyLoop(loop, eps)
    const local = simple.map(([x, y]) => {
      const along = vis.a0 + x * vis.cellM
      const height = vis.y1 - y * vis.cellM
      const X = alongIsX ? along : w.start.x
      const Z = alongIsX ? w.start.z : along
      return { a: (X - w.start.x) * f.u.x + (Z - w.start.z) * f.u.z, b: height - f.baseY }
    })
    const clipped = clipRect(local, 0, L, 0, w.height)
    if (clipped.length < 3 || polyArea(clipped) < 1e-6) return undefined
    const rounded = dedupe(clipped.map((p) => ({ a: r6(p.a), b: r6(p.b) })))
    const rect = { a0: Math.min(...rounded.map((p) => p.a)), a1: Math.max(...rounded.map((p) => p.a)), b0: Math.min(...rounded.map((p) => p.b)), b1: Math.max(...rounded.map((p) => p.b)) }
    if (rounded.length >= 3 && !outlineProblem(rounded, rect, false)) return rounded
  }
  return undefined
}

function dedupe(p: Array<{ a: number; b: number }>): Array<{ a: number; b: number }> {
  const out: Array<{ a: number; b: number }> = []
  for (const q of p) {
    const last = out[out.length - 1]
    if (!last || last.a !== q.a || last.b !== q.b) out.push(q)
  }
  if (out.length > 1 && out[0].a === out[out.length - 1].a && out[0].b === out[out.length - 1].b) out.pop()
  // drop collinear corners (an edge of the clip rect crossed by a straight run)
  const n = out.length
  return out.filter((q, i) => {
    const p0 = out[(i + n - 1) % n]
    const p1 = out[(i + 1) % n]
    return Math.abs((q.a - p0.a) * (p1.b - q.b) - (q.b - p0.b) * (p1.a - q.a)) > 1e-12
  })
}

function clipRect(poly: Array<{ a: number; b: number }>, a0: number, a1: number, b0: number, b1: number): Array<{ a: number; b: number }> {
  const half = (pts: Array<{ a: number; b: number }>, d: (p: { a: number; b: number }) => number): Array<{ a: number; b: number }> => {
    const out: Array<{ a: number; b: number }> = []
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      const dp = d(p)
      const dq = d(q)
      if (dp >= 0) out.push(p)
      if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
        const t = dp / (dp - dq)
        out.push({ a: p.a + t * (q.a - p.a), b: p.b + t * (q.b - p.b) })
      }
    }
    return out
  }
  let out = half(poly, (p) => p.a - a0)
  out = half(out, (p) => a1 - p.a)
  out = half(out, (p) => p.b - b0)
  out = half(out, (p) => b1 - p.b)
  return out
}
