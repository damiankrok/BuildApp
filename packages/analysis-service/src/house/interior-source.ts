/**
 * v3.54.9 — the interior of a model built from the same pages (LOCAL), as a source for the described house: its
 * partitions, the doors in them, its rooms (with the holes of their floors), its stairs and the openings of its floors,
 * per level, in LOCAL's own frame, with LOCAL's exterior extent and ground footprint to register it by. Nothing is
 * placed here; the resolver places it only through a checked transform (`resolveInterior`).
 */
import { createHash } from 'node:crypto'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { HouseInteriorSource } from '@buildapp/reconstruction'

type V = { x: number; z: number }
type Wall = { id: string; levelId: string; start: V; end: V; thickness: number; kind?: string }
type Opening = { id: string; wallId: string; kind?: string; offset: number; width: number; height: number }
type Room = { id: string; levelId: string; polygon: V[]; holes?: V[][]; usage?: string; name?: string }
type Slab = { id: string; levelId: string; polygon: V[]; holes?: V[][] }
type Stair = { id: string; levelId: string; toLevelId?: string; start: V; direction: 'PLUS_X' | 'MINUS_X' | 'PLUS_Z' | 'MINUS_Z'; width: number; waist?: number; footprint?: { minX: number; maxX: number; minZ: number; maxZ: number }; segments?: unknown[]; kind?: string }

const v = (p: V): V => ({ x: p.x, z: p.z })

/** The interior source of a model, or undefined when it holds no interior (no partition, no room). */
export function interiorSourceOf(model: CanonicalBuildingModel, modelText?: string): HouseInteriorSource | undefined {
  const m = model as unknown as { levels: Array<{ id: string; index: number; elevation: number }>; walls: Wall[]; openings: Opening[]; rooms?: Room[]; slabs?: Slab[]; stairs?: Stair[] }
  const interiorWalls = m.walls.filter((w) => w.kind === 'INTERIOR')
  const rooms = m.rooms ?? []
  if (interiorWalls.length === 0 && rooms.length === 0) return undefined
  const exterior = m.walls.filter((w) => w.kind !== 'INTERIOR')
  if (exterior.length === 0) return undefined
  const xs = exterior.flatMap((w) => [w.start.x, w.end.x])
  const zs = exterior.flatMap((w) => [w.start.z, w.end.z])
  const ground = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]
  const footprint = (m.slabs ?? []).filter((s) => s.levelId === ground.id && s.polygon.length >= 3).map((s) => s.polygon.map(v))
  if (footprint.length === 0) return undefined
  const ring = exterior.map((w) => w.thickness).sort((a, b) => a - b)
  const levelIndex = new Map(m.levels.map((l) => [l.id, l.index]))
  const hash = createHash('sha256').update(modelText ?? JSON.stringify(model)).digest('hex')
  return {
    origin: 'LOCAL',
    modelHash: hash,
    extent: { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) },
    footprint,
    exteriorThicknessM: ring[Math.floor(ring.length / 2)],
    exteriorOpenings: m.openings.flatMap((o) => {
      const w = exterior.find((x) => x.id === o.wallId)
      if (!w) return []
      const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) || 1
      const t = o.offset + o.width / 2
      return [{ level: levelIndex.get(w.levelId) ?? 0, at: { x: w.start.x + ((w.end.x - w.start.x) * t) / L, z: w.start.z + ((w.end.z - w.start.z) * t) / L }, ...(o.kind === 'DOOR' ? { door: true } : {}) }]
    }),
    levels: [...m.levels]
      .sort((a, b) => a.index - b.index)
      .map((l) => {
        const walls = interiorWalls.filter((w) => w.levelId === l.id)
        const wallIds = new Set(walls.map((w) => w.id))
        return {
          index: l.index,
          elevation: l.elevation,
          walls: walls.map((w) => ({ id: w.id, a: v(w.start), b: v(w.end), thickness: w.thickness })),
          doors: m.openings.filter((o) => wallIds.has(o.wallId) && o.kind === 'DOOR').map((o) => ({ id: o.id, wallId: o.wallId, offset: o.offset, width: o.width, height: o.height })),
          rooms: rooms.filter((r) => r.levelId === l.id && r.polygon.length >= 3).map((r) => ({ id: r.id, polygon: r.polygon.map(v), ...(r.holes && r.holes.length ? { holes: r.holes.map((h) => h.map(v)) } : {}), ...(r.usage ?? r.name ? { usage: (r.usage ?? r.name) as string } : {}) })),
          stairs: (m.stairs ?? [])
            .filter((s) => s.levelId === l.id && s.toLevelId && Array.isArray(s.segments) && s.segments.length > 0)
            .map((s) => ({ id: s.id, toLevel: levelIndex.get(s.toLevelId as string) ?? l.index + 1, start: v(s.start), direction: s.direction, width: s.width, ...(s.waist ? { waist: s.waist } : {}), ...(s.footprint ? { footprint: s.footprint } : {}), segments: s.segments as HouseInteriorSource['levels'][number]['stairs'][number]['segments'] })),
          voids: (m.slabs ?? []).filter((s) => s.levelId === l.id).flatMap((s) => (s.holes ?? []).map((h) => h.map(v))),
        }
      }),
  }
}
