import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_STATUSES,
  MODEL_FRAME,
  createEmptyModel,
  loadModel,
  nextId,
  serializeModel,
  validateModel,
  wallFrame,
  wallPoint,
  type CanonicalBuildingModel,
} from '../src/index.js'

function smallModel(): CanonicalBuildingModel {
  const m = createEmptyModel('m1', 'small')
  m.building = { id: 'b', name: 'house' }
  m.levels.push({ id: 'ground', buildingId: 'b', name: 'Ground', index: 0, elevation: 0, height: 3 })
  m.walls.push({
    id: 'front',
    levelId: 'ground',
    start: { x: 0, z: 0 },
    end: { x: 8, z: 0 },
    thickness: 0.3,
    height: 2.8,
    baseOffset: 0,
    kind: 'EXTERIOR',
    evidence: { status: 'SOURCE_EXACT', source: 'plan', properties: { height: 'ASSUMED' } },
  })
  m.openings.push({ id: 'op1', wallId: 'front', kind: 'WINDOW', offset: 1, sill: 0.9, width: 1.2, height: 1.4 })
  m.windows.push({ id: 'win1', openingId: 'op1', frameWidth: 0.06, frameDepth: 0.08, frameInset: 0.1, glassThickness: 0.006, divisions: 1 })
  return m
}

describe('CanonicalBuildingModel', () => {
  it('records units and the world frame explicitly', () => {
    const m = createEmptyModel('x', 'x')
    expect(m.units).toEqual({ length: 'm', angle: 'deg' })
    expect(m.frame).toEqual(MODEL_FRAME)
    expect(m.frame.z).toContain('into the building')
    expect(validateModel(m).ok).toBe(true)
  })

  it('carries the full evidence vocabulary', () => {
    expect(EVIDENCE_STATUSES).toEqual([
      'SOURCE_EXACT',
      'SOURCE_CORROBORATED',
      'SOURCE_DERIVED',
      'GEOMETRIC_INFERRED',
      'VISUAL_INFERRED',
      'ASSUMED',
      'UNRESOLVED',
    ])
    const m = smallModel()
    expect(m.walls[0].evidence?.properties?.height).toBe('ASSUMED')
    expect(validateModel(m).ok).toBe(true)
  })

  it('rejects a frame that is not the canonical frame', () => {
    const m = smallModel() as unknown as { frame: Record<string, string> }
    m.frame = { ...m.frame, z: 'towards the viewer' }
    const r = validateModel(m)
    expect(r.ok).toBe(false)
    expect(r.issues[0].code).toBe('SCHEMA')
  })

  it('reports an opening on a nonexistent wall and a window on a nonexistent opening', () => {
    const m = smallModel()
    m.openings.push({ id: 'op2', wallId: 'nope', kind: 'WINDOW', offset: 1, sill: 1, width: 1, height: 1 })
    m.windows.push({ id: 'win2', openingId: 'ghost', frameWidth: 0.06, frameDepth: 0.08, frameInset: 0.1, glassThickness: 0.006, divisions: 1 })
    const r = validateModel(m)
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['UNKNOWN_WALL', 'UNKNOWN_OPENING']))
  })

  it('reports negative wall height, an opening outside its host and a door opening larger than the wall', () => {
    const m = smallModel()
    ;(m.walls[0] as { height: number }).height = -1
    let r = validateModel(m)
    expect(r.ok).toBe(false)
    expect(r.issues[0].code).toBe('SCHEMA')

    const m2 = smallModel()
    m2.openings.push({ id: 'far', wallId: 'front', kind: 'WINDOW', offset: 7.5, sill: 1, width: 1, height: 1 })
    r = validateModel(m2)
    expect(r.issues.some((i) => i.code === 'OPENING_OUTSIDE_HOST' && i.objectId === 'far')).toBe(true)

    const m3 = smallModel()
    m3.openings.push({ id: 'big', wallId: 'front', kind: 'DOOR', offset: 3, sill: 0, width: 1, height: 3.5 })
    r = validateModel(m3)
    expect(r.issues.some((i) => i.code === 'OPENING_OUTSIDE_HOST' && i.objectId === 'big')).toBe(true)
  })

  it('reports overlapping openings, malformed polygons and duplicate ids', () => {
    const m = smallModel()
    m.openings.push({ id: 'op-overlap', wallId: 'front', kind: 'WINDOW', offset: 1.5, sill: 1, width: 1, height: 1 })
    m.rooms.push({ id: 'bow', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 2, z: 2 }, { x: 2, z: 0 }, { x: 0, z: 2 }] })
    m.slabs.push({ id: 'front', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], topOffset: 0, thickness: 0.2 })
    const codes = validateModel(m).issues.map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['OPENINGS_OVERLAP', 'MALFORMED_POLYGON', 'DUPLICATE_ID']))
  })

  it('reports a fill of the wrong kind and an opening filled twice', () => {
    const m = smallModel()
    m.doors.push({ id: 'd', openingId: 'op1', hingeSide: 'LEFT', swing: 'IN', openAngle: 0, leafThickness: 0.04, frameWidth: 0.05, frameDepth: 0.1, frameInset: 0.1 })
    const codes = validateModel(m).issues.map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['FILL_KIND_MISMATCH', 'OPENING_FILLED_TWICE']))
  })

  it('generates deterministic ids that never collide', () => {
    const m = smallModel()
    expect(nextId(m, 'wall')).toBe('wall-1')
    m.walls.push({ ...m.walls[0], id: 'wall-1' })
    expect(nextId(m, 'wall')).toBe('wall-2')
    expect(nextId(m, 'wall', 'custom')).toBe('custom')
  })

  it('wall frame: outward normal is up x u, material lies inward', () => {
    const m = smallModel()
    const f = wallFrame(m.walls[0], m.levels[0])
    expect(f.n).toEqual({ x: 0, y: 0, z: -1 })
    expect(f.length).toBe(8)
    // one thickness inward from the outer face is at z = +thickness
    expect(wallPoint(f, 0, 0, 0.3)).toEqual({ x: 0, y: 0, z: 0.3 })
    expect(wallPoint(f, 8, 2.8, 0)).toEqual({ x: 8, y: 2.8, z: 0 })
  })

  it('serializes deterministically and round-trips with identical ids', () => {
    const a = smallModel()
    const b = smallModel()
    // different insertion order, same content
    b.walls.push({ ...a.walls[0], id: 'aaa-first' })
    a.walls.unshift({ ...a.walls[0], id: 'aaa-first' })
    const ja = serializeModel(a)
    const jb = serializeModel(b)
    expect(ja).toBe(jb)
    const loaded = loadModel(ja)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(serializeModel(loaded.model)).toBe(ja)
    expect(loaded.model.walls.map((w) => w.id).sort()).toEqual(['aaa-first', 'front'])
    expect(loaded.model.windows[0].openingId).toBe('op1')
    expect(loaded.model.openings[0].wallId).toBe('front')
  })

  it('refuses to load garbage and invalid models without throwing', () => {
    expect(loadModel('{not json').ok).toBe(false)
    const r = loadModel(JSON.stringify({ schema: 'wrong' }))
    expect(r.ok).toBe(false)
    expect(r.issues.length).toBeGreaterThan(0)
  })
})
