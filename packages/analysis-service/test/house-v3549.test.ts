/**
 * v3.54.9 — one metric, the interior of every storey, and exact glazing. Each case changes the hand-checked description
 * of one house (MANUAL_DIAGNOSTIC, test path only) in one named way, or calls the interior placement on a plain outline.
 * The interior source here is synthetic: drawn from the house's own resolved outline in another frame (shifted, mirrored,
 * stretched, a level moved), so that what each case changes is the only thing that differs. No test calls a provider.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { INTERIOR_RULES, parseHouseDocument, resolveHouse, resolveInterior } from '@buildapp/reconstruction'
import type { HouseInteriorSource } from '@buildapp/reconstruction'
import { compileHouse } from '../src/house/describe.js'
import { checkProperties, legacyRevisionOf } from '../src/house/review.js'
import type { SceneMeasure } from '../src/house/measure.js'

const ROOT = join(__dirname, '..', '..', '..')
type Doc = Record<string, any>
type V = { x: number; z: number }
const manual = (): Doc => JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
const resolved = (doc: Doc) => {
  const p = parseHouseDocument(doc)
  if (!p.ok) throw new Error('fixture rejected')
  const r = resolveHouse(p.document)
  if (!r.geometry) throw new Error('no geometry')
  return { ...r, geometry: r.geometry }
}
const bboxOf = (poly: V[]) => ({ x0: Math.min(...poly.map((p) => p.x)), x1: Math.max(...poly.map((p) => p.x)), z0: Math.min(...poly.map((p) => p.z)), z1: Math.max(...poly.map((p) => p.z)) })

/**
 * The interior source drawn from the house's own geometry, in a frame shifted by (dx, dz) and optionally mirrored along
 * x or stretched along z: one partition across the ground floor whose ends stop 0.2 m short of the inner faces, a door
 * in it, two rooms either side, and a void in the upper floor.
 */
function sourceFor(doc: Doc, opt: { mirrorX?: boolean; stretchZ?: number; upperGap?: number } = {}): HouseInteriorSource {
  const g = resolved(doc).geometry
  const ground = g.outlines.find((o) => o.level === 0)?.polygon ?? []
  const B = bboxOf(ground)
  const T = g.wallThicknessM.value ?? 0.4
  const dx = 5
  const dz = 3
  const k = opt.stretchZ ?? 1
  const to = (p: V): V => ({ x: dx + (opt.mirrorX ? B.x1 - p.x : p.x - B.x0), z: dz + (p.z - B.z0) * k })
  // in the house's own frame (its left wall stands at x 1.02 between z 0 and 3.83, its left wing from x 2.52 beyond z 6.93)
  const zm = 2.5
  const xm = 6.0
  const xs = (a: number, b: number): [V, V] => [to({ x: a, z: zm }), to({ x: b, z: zm })]
  const [pa, pb] = xs(1.02 + T + 0.2, xm)
  const rect = (x0: number, x1: number, z0: number, z1: number): V[] => [to({ x: x0, z: z0 }), to({ x: x1, z: z0 }), to({ x: x1, z: z1 }), to({ x: x0, z: z1 })]
  const ext = [to({ x: B.x0, z: B.z0 }), to({ x: B.x1, z: B.z1 })]
  const levels = g.levels.map((l) => ({ index: l.index, elevation: (l.elevation.value ?? 0) + (l.index > 0 ? (opt.upperGap ?? 0) : 0) }))
  return {
    origin: 'LOCAL',
    modelHash: 'synthetic',
    extent: { x0: Math.min(ext[0].x, ext[1].x), x1: Math.max(ext[0].x, ext[1].x), z0: Math.min(ext[0].z, ext[1].z), z1: Math.max(ext[0].z, ext[1].z) },
    footprint: [ground.map(to)],
    exteriorThicknessM: T,
    exteriorOpenings: [],
    levels: levels.map((l) =>
      l.index === 0
        ? {
            ...l,
            walls: [{ id: 'part-1', a: pa, b: pb, thickness: 0.12 }],
            doors: [{ id: 'door-1', wallId: 'part-1', offset: 0.8, width: 0.9, height: 2.05 }],
            rooms: [
              { id: 'room-kitchen', polygon: rect(1.02 + T, xm, T, zm), usage: 'KITCHEN' },
              { id: 'room-hall', polygon: rect(2.52 + T, xm, zm, 10.12 - T), usage: 'HALL' },
            ],
            stairs: [],
            voids: [],
          }
        : { ...l, walls: [], doors: [], rooms: [], stairs: [], voids: [rect(4.8, xm, 1.5, zm)] },
    ),
  }
}
const withInterior = (opt: Parameters<typeof sourceFor>[1] = {}): Doc => {
  const doc = manual()
  doc.interiorSource = sourceFor(manual(), opt)
  return doc
}

describe('v3.54.9 the interior placed through a checked transform', () => {
  it('cause: an interior source in another frame is registered (one scale, overlap), its partition brought to the inner face, its rooms keep their ids', () => {
    const r = resolved(withInterior())
    const it0 = r.geometry.interior
    expect(it0.status).toBe('BUILT')
    expect(it0.transform?.mirrorX).toBe(false)
    expect(it0.transform?.scale).toBeCloseTo(1, 6)
    expect(it0.transform?.overlap).toBeGreaterThanOrEqual(INTERIOR_RULES.overlap)
    const l0 = it0.levels.find((l) => l.level === 0)
    expect(l0?.rooms.map((x) => x.id).sort()).toEqual(['room-hall', 'room-kitchen'])
    expect(l0?.doors.map((x) => x.id)).toEqual(['door-1'])
    // the partition's end that stopped 0.2 m short of the inner face now stands on it
    const g = r.geometry
    const T = g.wallThicknessM.value ?? 0.4
    const w = l0?.walls[0]
    expect(w && Math.min(w.a.x, w.b.x)).toBeCloseTo(1.02 + T, 3)
    // the upper floor's void is placed on the upper level
    expect(it0.levels.find((l) => l.level === 1)?.voids).toHaveLength(1)
  })

  it('counter: the same interior drawn mirrored is found mirrored and lands on the same place — not pasted by its box', () => {
    const a = resolved(withInterior()).geometry.interior
    const b = resolved(withInterior({ mirrorX: true })).geometry.interior
    expect(b.status).toBe('BUILT')
    expect(b.transform?.mirrorX).toBe(true)
    const wa = a.levels[0].walls[0]
    const wb = b.levels[0].walls[0]
    const ends = (w: typeof wa) => [w.a, w.b].map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).sort()
    expect(ends(wb)).toEqual(ends(wa))
  })

  it('counter: a source needing two scales is a metric conflict — the interior is not stretched onto the house', () => {
    const r = resolved(withInterior({ stretchZ: 1.15 }))
    expect(r.geometry.interior.status).toBe('NOT_BUILT')
    expect(r.verification.knownDefects.some((k) => k.code === 'INTERIOR_METRIC_CONFLICT')).toBe(true)
  })

  it('an interior that cannot be placed is not a failure of the exterior: the house stands or falls on its own checks', () => {
    const plain = compileHouse(manual(), 'v3549-conflict')
    const h = compileHouse(withInterior({ stretchZ: 1.15 }), 'v3549-conflict')
    expect(h.document.verification.checks.find((c) => c.id === 'interior-metric')).toMatchObject({ status: 'FAIL', scope: 'INTERIOR' })
    expect(h.failed).toEqual(plain.failed)
    expect(h.document.verification.status?.exterior).toBe(plain.document.verification.status?.exterior)
  })

  it('counter: a source floor at another height is not placed on the nearest storey; the rest is, and the interior is PARTIAL', () => {
    const r = resolved(withInterior({ upperGap: 0.4 }))
    expect(r.verification.knownDefects.some((k) => k.code === 'INTERIOR_LEVEL_NOT_PLACED')).toBe(true)
    expect(r.geometry.interior.levels.find((l) => l.level === 1)).toBeUndefined()
    expect(r.geometry.interior.levels.find((l) => l.level === 0)?.rooms).toHaveLength(2)
  })

  it('counter: a rectangle lies the same every way round; with no openings to tell, the interior is not placed (which way is not guessed)', () => {
    const outline = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }]
    const g = { outlines: [{ level: 0, polygon: outline }], levels: [{ index: 0, elevation: { value: 0 } }], wallThicknessM: { value: 0.4 } } as never
    const src: HouseInteriorSource = {
      origin: 'LOCAL',
      modelHash: 'rect',
      extent: { x0: 0, x1: 10, z0: 0, z1: 8 },
      footprint: [outline],
      exteriorThicknessM: 0.4,
      exteriorOpenings: [],
      levels: [{ index: 0, elevation: 0, walls: [{ id: 'p', a: { x: 0.4, z: 3 }, b: { x: 6, z: 3 } }].map((w) => ({ ...w, thickness: 0.12 })), doors: [], rooms: [], stairs: [], voids: [] }],
    }
    const r = resolveInterior(src, g)
    expect(r.interior.status).toBe('NOT_BUILT')
    expect(r.knownDefects.map((k) => k.code)).toContain('INTERIOR_NOT_REGISTERED')
  })

  it('the builder consumes it: partitions as INTERIOR walls, the door in its partition, the rooms by their ids, the void a hole in the upper slab', () => {
    const h = compileHouse(withInterior(), 'v3549-interior')
    expect(h.compileErrors).toEqual([])
    const m = h.built?.model as unknown as { walls: Array<{ id: string; kind?: string }>; openings: Array<{ wallId: string; kind?: string }>; rooms: Array<{ id: string }>; slabs: Array<{ levelId: string; holes?: unknown[] }>; levels: Array<{ id: string; index: number }> }
    const inner = m.walls.filter((w) => w.kind === 'INTERIOR')
    expect(inner).toHaveLength(1)
    expect(m.openings.some((o) => o.wallId === inner[0].id && o.kind === 'DOOR')).toBe(true)
    expect(m.rooms.map((r) => r.id).filter((id) => /room-(hall|kitchen)/.test(id))).toHaveLength(2)
    const upper = m.levels.find((l) => l.index === 1)
    expect(m.slabs.filter((s) => s.levelId === upper?.id).some((s) => (s.holes ?? []).length === 1)).toBe(true)
  })

  it('counter: without an interior source the house is exterior-only, said — and the exterior is the same either way', () => {
    const a = compileHouse(manual(), 'v3549-ext')
    const b = compileHouse(withInterior(), 'v3549-ext')
    expect(a.document.geometry?.interior?.status).toBe('NOT_BUILT')
    const ext = (h: typeof a) => ((h.built?.model as unknown as { walls: Array<{ kind?: string; start: V; end: V }> }).walls.filter((w) => w.kind !== 'INTERIOR').map((w) => JSON.stringify([w.start, w.end])).sort())
    expect(ext(b)).toEqual(ext(a))
  })

  it('the interior is kept when the exterior is corrected: an opening changed on an elevation leaves every placed partition and room as it was', () => {
    const a = resolved(withInterior()).geometry.interior
    const doc = withInterior()
    const front = doc.observations.elevations.find((e: Doc) => e.id === 'el-front')
    front.openings[0].box.x1 += 6
    const b = resolved(doc).geometry.interior
    expect(b.status).toBe(a.status)
    expect(JSON.stringify(b.levels)).toBe(JSON.stringify(a.levels))
  })
})

describe('v3.54.9 a sill a railing hides is not read at the railing top', () => {
  const TERRACE = { id: 'terrace', kind: 'BALCONY', box: { x0: 316, y0: 172, x1: 424, y1: 206 }, bodyId: 'main', posts: false, railingTopY: 176 }
  const withGlazing = (y1: number) => {
    const doc = manual()
    const front = doc.observations.elevations.find((e: Doc) => e.id === 'el-front')
    front.features.push(TERRACE)
    front.openings.push({ id: 'gl', kind: 'WINDOW', box: { x0: 330, y0: 120, x1: 410, y1 }, bodyId: 'main', level: 1 })
    return resolved(doc)
  }
  it('cause: a glazing whose bottom edge is the railing\'s top stands on the balcony floor — ESTIMATED, said', () => {
    const r = withGlazing(176)
    const op = r.geometry.openings.find((o) => o.refs.some((x: string) => x.endsWith('/gl')))
    expect(op?.sillM.basis).toBe('ESTIMATED')
    expect(op?.sillM.value).toBe(0)
    expect(r.verification.knownDefects.some((k) => k.code === 'OPENING_SILL_HIDDEN_BY_RAILING')).toBe(true)
  })
  it('counter: a window whose sill shows above the railing keeps the sill it shows', () => {
    const r = withGlazing(160)
    const op = r.geometry.openings.find((o) => o.refs.some((x: string) => x.endsWith('/gl')))
    expect(op?.sillM.basis).toBe('DERIVED')
    expect(op?.sillM.value ?? 0).toBeGreaterThan(0.3)
    expect(r.verification.knownDefects.some((k) => k.code === 'OPENING_SILL_HIDDEN_BY_RAILING')).toBe(false)
  })
})

describe('v3.54.9 a dimension is compared with what its own ends stand on', () => {
  // the plan's metric: the printed overall depth runs from the rear face (row 523, z 10.12) to the front (row 1387, z 0)
  const withDepth = (zFrom: number, zTo: number, value: number): Doc => {
    const doc = manual()
    const d = doc.observations.dimensions.find((x: Doc) => x.id === 'dim-depth')
    const mpp = 10.12 / (d.to.y - d.from.y)
    const row = (z: number) => d.to.y - z / mpp
    doc.observations.dimensions.push({ ...d, id: 'dim-body', literal: value.toFixed(2), valueM: value, from: { x: d.from.x, y: row(zTo) }, to: { x: d.from.x, y: row(zFrom) }, includes: 'between the garage\'s front and rear walls' })
    return doc
  }
  const check = (doc: Doc) => resolved(doc).verification.checks.find((x) => x.id === 'extent-dim-body')
  it('cause: a dimension between two walls with only returns beyond its ends (1.51 m in front, 1.52 m behind) passes between those walls', () => {
    const c = check(withDepth(1.51, 8.6, 7.09))
    expect(c?.status).toBe('PASS')
    expect(c?.expected).toMatch(/between the walls its two ends stand on/)
  })
  it('counter: the same number with an end standing on no wall is not explained away — it fails', () => {
    expect(check(withDepth(1.51, 8.6 + 1.3, 7.09))?.status).toBe('FAIL')
  })
  it('counter: a body dimension taken for the whole house (a body lies beyond its end) fails even though both its ends stand on walls', () => {
    const doc = manual()
    const w = doc.observations.dimensions.find((x: Doc) => x.id === 'dim-width')
    doc.observations.dimensions.push({ ...w, id: 'dim-body', literal: '9,82', valueM: 9.82, from: { x: 425, y: 80 }, to: { x: 1262, y: 80 } })
    expect(check(doc)?.status).toBe('FAIL')
  })
})

describe('v3.54.9 the review: improved is not reached; a recorded answer is rebound only to its own reading', () => {
  const frame = { mPerPx: 0.0329, alongAtPx0: 0, zeroRowPx: 298 }
  const at = (band: number | null): SceneMeasure => ({ sides: [{ side: 'FRONT', frame: band === null ? undefined : { bandVQ1: band } }] }) as unknown as SceneMeasure
  const c = { op: 'SET_FEATURE', kind: 'GABLE_FRAME', why: '', bandPx: 10 } as never
  it('cause: a property closer to its target but still beyond tolerance is IMPROVED and OUTSIDE_TOLERANCE — both said', () => {
    const [p] = checkProperties(c, frame, 'FRONT', at(0.1), at(0.21)).filter((x) => x.property === 'frame band (vertical)')
    expect(p.state).toBe('IMPROVED')
    expect(p.tolerance).toBe('OUTSIDE_TOLERANCE')
  })
  it('counter: within tolerance it is WITHIN_TOLERANCE; against nothing measured before, only a value within tolerance counts as improved', () => {
    expect(checkProperties(c, frame, 'FRONT', at(0.1), at(0.3)).find((x) => x.property === 'frame band (vertical)')?.tolerance).toBe('WITHIN_TOLERANCE')
    const none = checkProperties(c, frame, 'FRONT', { sides: [{ side: 'FRONT', frame: {} }] } as unknown as SceneMeasure, at(0.21)).find((x) => x.property === 'frame band (vertical)')
    expect(none?.state).toBe('NOT_IMPROVED')
  })
  it('a recorded answer\'s revision equals the house\'s with only the railings its notes name derived since — a READ railing is not stripped', () => {
    const base = { observations: { elevations: [{ id: 'e', features: [{ id: 'b', kind: 'BALCONY' }] }] } }
    const noted = { observations: { elevations: [{ id: 'e', features: [{ id: 'b', kind: 'BALCONY', railing: 'BARS', railingFrom: 'NOTE', railingNote: 'baluster' }] }] } }
    const read = { observations: { elevations: [{ id: 'e', features: [{ id: 'b', kind: 'BALCONY', railing: 'BARS', railingFrom: 'READ' }] }] } }
    expect(legacyRevisionOf(noted)).toBe(legacyRevisionOf(base))
    expect(legacyRevisionOf(read)).not.toBe(legacyRevisionOf(base))
  })
})
