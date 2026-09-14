import { describe, expect, it } from 'vitest'
import {
  convexOverlapArea,
  createEmptyModel,
  physicalCore,
  resolveWallTopology,
  validateModel,
  wallOverlapIssues,
  wallPhysicalFootprint,
  type CanonicalBuildingModel,
  type Vec2,
  type Wall,
  type WallJunction,
} from '../src/index.js'

const base = (): CanonicalBuildingModel => {
  const m = createEmptyModel('t', 't')
  m.building = { id: 'b' }
  m.levels.push({ id: 'l', buildingId: 'b', index: 0, elevation: 0, height: 3 })
  m.levels.push({ id: 'u', buildingId: 'b', index: 1, elevation: 3, height: 3 })
  return m
}
const wall = (id: string, start: Vec2, end: Vec2, thickness = 0.3, extra: Partial<Wall> = {}): Wall => ({
  id,
  levelId: 'l',
  start,
  end,
  thickness,
  height: 3,
  baseOffset: 0,
  kind: 'EXTERIOR',
  ...extra,
})
const corner = (id: string, a: [string, 'START' | 'END'], b: [string, 'START' | 'END'], owner: string, tolerance = 0.001): WallJunction => ({
  id,
  kind: 'CORNER',
  a: { wallId: a[0], end: a[1] },
  b: { wallId: b[0], end: b[1] },
  owner,
  tolerance,
})
const butt = (id: string, w: [string, 'START' | 'END'], againstWallId: string, kind: 'BUTT' | 'T' = 'BUTT'): WallJunction => ({
  id,
  kind,
  wall: { wallId: w[0], end: w[1] },
  againstWallId,
  tolerance: 0.001,
})
const codes = (m: CanonicalBuildingModel): string[] => resolveWallTopology(m).issues.map((i) => i.code)

describe('corner junctions resolve exactly-once corner material', () => {
  it('convex corner: the owner runs through, the other wall stops at the owner inner face (thicknesses differ)', () => {
    const m = base()
    m.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }, 0.3), wall('right', { x: 10, z: 0 }, { x: 10, z: 8 }, 0.25))
    m.wallJunctions.push(corner('j', ['front', 'END'], ['right', 'START'], 'front'))
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('front')).toEqual({ start: { outer: 0, inner: 0 }, end: { outer: 10, inner: 10 } })
    expect(t.extents.get('right')).toEqual({ start: { outer: 0.3, inner: 0.3 }, end: { outer: 8, inner: 8 } })
    expect(t.junctions.get('j')).toMatchObject({ ok: true, point: { x: 10, z: 0 } })
    expect(t.endClaims.get('front:END')).toEqual({ junctionId: 'j', role: 'OWNER' })
    expect(t.endClaims.get('right:START')).toEqual({ junctionId: 'j', role: 'TRIMMED' })
    // the footprints touch along the owner's inner face and share no area
    expect(convexOverlapArea(wallPhysicalFootprint(m.walls[0], t.extents.get('front')!), wallPhysicalFootprint(m.walls[1], t.extents.get('right')!))).toBeCloseTo(0, 12)
  })

  it('the same corner with the other owner trims the front wall by the right wall thickness instead', () => {
    const m = base()
    m.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }, 0.3), wall('right', { x: 10, z: 0 }, { x: 10, z: 8 }, 0.25))
    m.wallJunctions.push(corner('j', ['front', 'END'], ['right', 'START'], 'right'))
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('front')!.end).toEqual({ outer: 9.75, inner: 9.75 })
    expect(t.extents.get('right')!.start).toEqual({ outer: 0, inner: 0 })
  })

  it('reflex corner: the owner is extended into the notch by the other wall thickness', () => {
    // An L: (10,4)->(6,4) then (6,4)->(6,8); material lies inside the L, the outer faces meet at (6,4).
    const m = base()
    m.walls.push(wall('a', { x: 10, z: 4 }, { x: 6, z: 4 }, 0.3), wall('b', { x: 6, z: 4 }, { x: 6, z: 8 }, 0.3))
    m.wallJunctions.push(corner('j', ['a', 'END'], ['b', 'START'], 'a'))
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('a')!.end.outer).toBeCloseTo(4.3, 12)
    expect(t.extents.get('a')!.end.inner).toBeCloseTo(4.3, 12)
    expect(t.extents.get('b')!.start).toEqual({ outer: 0, inner: 0 })
    // the notch square [5.7,6]x[3.7,4] is covered by a's extension and by nothing else
    const fa = wallPhysicalFootprint(m.walls[0], t.extents.get('a')!)
    const fb = wallPhysicalFootprint(m.walls[1], t.extents.get('b')!)
    const notch: Vec2[] = [{ x: 5.7, z: 3.7 }, { x: 6, z: 3.7 }, { x: 6, z: 4 }, { x: 5.7, z: 4 }]
    expect(convexOverlapArea(fa, notch)).toBeCloseTo(0.09, 12)
    expect(convexOverlapArea(fb, notch)).toBeCloseTo(0, 12)
    expect(convexOverlapArea(fa, fb)).toBeCloseTo(0, 12)
  })

  it('accepts an endpoint anywhere in the other wall thickness band (natural corner or pre-trimmed) and resolves the same extents', () => {
    for (const startZ of [0, 0.15, 0.3]) {
      const m = base()
      m.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('right', { x: 10, z: startZ }, { x: 10, z: 8 }))
      m.wallJunctions.push(corner('j', ['front', 'END'], ['right', 'START'], 'front'))
      const t = resolveWallTopology(m)
      expect(t.issues, `start z ${startZ}`).toEqual([])
      // the physical start of the right wall is at world z = 0.3 whatever the declared start
      expect(t.extents.get('right')!.start.outer + startZ).toBeCloseTo(0.3, 12)
    }
  })

  it('oblique corner: end cuts lie in the other wall face planes, so outer and inner cuts differ', () => {
    // front along +x, the next wall leaves the corner at 120° (interior angle 60°)
    const m = base()
    const u = { x: Math.cos((120 * Math.PI) / 180), z: Math.sin((120 * Math.PI) / 180) }
    m.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('next', { x: 10, z: 0 }, { x: 10 + 6 * u.x, z: 6 * u.z }))
    m.wallJunctions.push(corner('j', ['front', 'END'], ['next', 'START'], 'front'))
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    const f = t.extents.get('front')!
    const n = t.extents.get('next')!
    expect(f.end.outer).toBeCloseTo(10, 12)
    expect(f.end.inner).not.toBeCloseTo(f.end.outer, 6)
    expect(n.start.outer).toBeCloseTo(0.3 / Math.sin((60 * Math.PI) / 180), 9)
    expect(n.start.inner).not.toBeCloseTo(n.start.outer, 6)
    expect(convexOverlapArea(wallPhysicalFootprint(m.walls[0], f), wallPhysicalFootprint(m.walls[1], n))).toBeCloseTo(0, 9)
  })

  it('reports a measured gap or overshoot instead of moving anything', () => {
    const gap = base()
    gap.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('right', { x: 10, z: 0.5 }, { x: 10, z: 8 }))
    gap.wallJunctions.push(corner('j', ['front', 'END'], ['right', 'START'], 'front'))
    const g = resolveWallTopology(gap)
    expect(g.issues.map((i) => [i.code, i.objectId])).toEqual([['JUNCTION_GAP', 'j']])
    expect(g.issues[0].measured).toBeCloseTo(0.2, 12)
    expect(g.extents.get('right')!.start).toEqual({ outer: 0, inner: 0 })

    const over = base()
    over.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('right', { x: 10, z: -0.2 }, { x: 10, z: 8 }))
    over.wallJunctions.push(corner('j', ['front', 'END'], ['right', 'START'], 'front'))
    const o = resolveWallTopology(over)
    expect(o.issues.map((i) => i.code)).toEqual(['JUNCTION_OVERSHOOT'])
    expect(o.issues[0].measured).toBeCloseTo(0.2, 12)

    const wide = base()
    wide.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('right', { x: 10, z: 0.5 }, { x: 10, z: 8 }))
    wide.wallJunctions.push(corner('j', ['front', 'END'], ['right', 'START'], 'front', 0.25))
    expect(resolveWallTopology(wide).issues).toEqual([])
  })

  it('refuses parallel walls, self references, owners that do not take part, dangling references and level mismatches', () => {
    const m = base()
    m.walls.push(
      wall('a', { x: 0, z: 0 }, { x: 10, z: 0 }),
      wall('b', { x: 0, z: 2 }, { x: 10, z: 2 }),
      wall('c', { x: 10, z: 0 }, { x: 10, z: 8 }),
      wall('up', { x: 10, z: 0 }, { x: 10, z: 8 }, 0.3, { levelId: 'u' }),
    )
    m.wallJunctions.push(
      corner('parallel', ['a', 'END'], ['b', 'END'], 'a'),
      corner('self', ['a', 'START'], ['a', 'END'], 'a'),
      corner('owner', ['a', 'END'], ['c', 'START'], 'ghost'),
      corner('dangling', ['a', 'END'], ['nope', 'START'], 'a'),
      corner('levels', ['a', 'END'], ['up', 'START'], 'a'),
    )
    const issues = resolveWallTopology(m).issues
    expect(issues.map((i) => [i.code, i.objectId])).toEqual([
      ['JUNCTION_PARALLEL_WALLS', 'parallel'],
      ['JUNCTION_PARALLEL_WALLS', 'parallel'],
      ['JUNCTION_SELF_REFERENCE', 'self'],
      ['JUNCTION_OWNER_NOT_PARTICIPANT', 'owner'],
      ['UNKNOWN_WALL', 'dangling'],
      ['JUNCTION_LEVEL_MISMATCH', 'levels'],
    ])
  })

  it('reports a wall end claimed by two junctions and resolves only the first', () => {
    const m = base()
    m.walls.push(wall('front', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('right', { x: 10, z: 0 }, { x: 10, z: 8 }), wall('other', { x: 10, z: 0 }, { x: 14, z: 0 }))
    m.wallJunctions.push(corner('j1', ['front', 'END'], ['right', 'START'], 'front'), butt('j2', ['right', 'START'], 'other'))
    const t = resolveWallTopology(m)
    expect(t.issues.map((i) => [i.code, i.objectId])).toEqual([['ENDPOINT_JUNCTION_CONFLICT', 'j2']])
    expect(t.endClaims.get('right:START')!.junctionId).toBe('j1')
  })

  it('warns when an interior wall owns a corner shared with an exterior wall', () => {
    const m = base()
    m.walls.push(wall('ext', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('int', { x: 10, z: 0 }, { x: 10, z: 8 }, 0.12, { kind: 'INTERIOR' }))
    m.wallJunctions.push(corner('j', ['ext', 'END'], ['int', 'START'], 'int'))
    const t = resolveWallTopology(m)
    expect(t.issues.map((i) => [i.code, i.severity])).toEqual([['JUNCTION_KIND_MIX', 'WARNING']])
    expect(t.junctions.get('j')!.ok).toBe(true)
  })
})

describe('butt and T junctions', () => {
  it('a partition butting against a wall stops at that wall near face; the host is untouched and owns the contact', () => {
    const m = base()
    m.walls.push(wall('host', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('p', { x: 5, z: 0 }, { x: 5, z: 4 }, 0.2, { kind: 'INTERIOR' }))
    m.wallJunctions.push(butt('j', ['p', 'START'], 'host'))
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('host')).toEqual({ start: { outer: 0, inner: 0 }, end: { outer: 10, inner: 10 } })
    expect(t.extents.get('p')!.start).toEqual({ outer: 0.3, inner: 0.3 })
    const r = t.junctions.get('j')!
    expect(r.ok).toBe(true)
    expect(r.contact!.face).toBe('INNER')
    expect(r.contact!.a0).toBeCloseTo(4.8, 12)
    expect(r.contact!.a1).toBeCloseTo(5, 12)
    expect(r.participants.map((p) => p.role)).toEqual(['TRIMMED', 'HOST'])
  })

  it('a wall arriving from outside stops at the outer face', () => {
    const m = base()
    // host along x = 10 (outer face x = 10, material x < 10); the wing arrives from x > 10 and ends on the outer line
    m.walls.push(wall('host', { x: 10, z: 0 }, { x: 10, z: 8 }), wall('wing', { x: 15, z: 6 }, { x: 10, z: 6 }))
    m.wallJunctions.push(butt('j', ['wing', 'END'], 'host', 'T'))
    const t = resolveWallTopology(m)
    expect(t.issues).toEqual([])
    expect(t.extents.get('wing')!.end).toEqual({ outer: 5, inner: 5 })
    expect(t.junctions.get('j')!.contact).toMatchObject({ face: 'OUTER' })
    // and a wing declared through to the host inner face resolves to the same physical end
    const deep = base()
    deep.walls.push(wall('host', { x: 10, z: 0 }, { x: 10, z: 8 }), wall('wing', { x: 15, z: 6 }, { x: 9.7, z: 6 }))
    deep.wallJunctions.push(butt('j', ['wing', 'END'], 'host', 'T'))
    expect(resolveWallTopology(deep).extents.get('wing')!.end.outer).toBeCloseTo(5, 12)
  })

  it('BUTT accepts a contact at the host end; T requires it strictly inside; off the host is an error', () => {
    const atEnd = (kind: 'BUTT' | 'T'): string[] => {
      const m = base()
      m.walls.push(wall('host', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('p', { x: 10, z: 0 }, { x: 10, z: 4 }, 0.2))
      m.wallJunctions.push(butt('j', ['p', 'START'], 'host', kind))
      return codes(m)
    }
    expect(atEnd('BUTT')).toEqual([])
    expect(atEnd('T')).toEqual(['T_JUNCTION_POSITION'])
    const off = base()
    off.walls.push(wall('host', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('p', { x: 10.5, z: 0 }, { x: 10.5, z: 4 }, 0.2))
    off.wallJunctions.push(butt('j', ['p', 'START'], 'host'))
    const issues = resolveWallTopology(off).issues
    expect(issues.map((i) => i.code)).toEqual(['BUTT_OFF_HOST'])
    expect(issues[0].measured).toBeCloseTo(0.5, 12)
  })

  it('the contact is checked against the host physical face, after the host own junctions', () => {
    // host is trimmed at its END by a corner it does not own; a T landing in the trimmed zone is off the host
    const m = base()
    m.walls.push(wall('host', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('right', { x: 10, z: 0 }, { x: 10, z: 8 }, 0.5), wall('p', { x: 9.7, z: 0 }, { x: 9.7, z: 4 }, 0.2))
    m.wallJunctions.push(corner('c', ['host', 'END'], ['right', 'START'], 'right'), butt('t', ['p', 'START'], 'host', 'T'))
    const t = resolveWallTopology(m)
    expect(t.extents.get('host')!.end.outer).toBeCloseTo(9.5, 12)
    expect(t.issues.map((i) => [i.code, i.objectId])).toEqual([['T_JUNCTION_POSITION', 't']])
  })

  it('a wall consumed by its junctions is an error, not an empty solid', () => {
    const m = base()
    m.walls.push(
      wall('h1', { x: 0, z: 0 }, { x: 10, z: 0 }),
      wall('h2', { x: 10, z: 0.5 }, { x: 0, z: 0.5 }),
      wall('w', { x: 5, z: 0 }, { x: 5, z: 0.5 }, 0.1, { kind: 'INTERIOR' }),
    )
    m.wallJunctions.push(butt('a', ['w', 'START'], 'h1'), butt('b', ['w', 'END'], 'h2'))
    const t = resolveWallTopology(m)
    expect(t.issues.map((i) => [i.code, i.objectId])).toEqual([['WALL_CONSUMED', 'w']])
    expect(physicalCore(t.extents.get('w')!).a1).toBeLessThan(physicalCore(t.extents.get('w')!).a0)
  })
})

describe('undeclared wall overlap', () => {
  it('two crossing walls without a junction are an error with the measured area; contact and different levels are not', () => {
    const m = base()
    m.walls.push(wall('a', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('b', { x: 5, z: -1 }, { x: 5, z: 3 }))
    const issues = wallOverlapIssues(m, resolveWallTopology(m).extents)
    expect(issues.map((i) => i.code)).toEqual(['WALLS_OVERLAP'])
    expect(issues[0].measured).toBeCloseTo(0.09, 12)
    expect(validateModel(m).issues.map((i) => i.code)).toContain('WALLS_OVERLAP')

    const contact = base()
    contact.walls.push(wall('a', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('b', { x: 5, z: 0.3 }, { x: 5, z: 3 }))
    expect(wallOverlapIssues(contact, resolveWallTopology(contact).extents)).toEqual([])

    const stacked = base()
    stacked.walls.push(wall('a', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('b', { x: 0, z: 0 }, { x: 10, z: 0 }, 0.3, { levelId: 'u' }))
    expect(wallOverlapIssues(stacked, resolveWallTopology(stacked).extents)).toEqual([])
  })

  it('a duplicated wall on the same line is an overlap', () => {
    const m = base()
    m.walls.push(wall('a', { x: 0, z: 0 }, { x: 10, z: 0 }), wall('a2', { x: 0, z: 0 }, { x: 10, z: 0 }))
    const issues = wallOverlapIssues(m, resolveWallTopology(m).extents)
    expect(issues[0].measured).toBeCloseTo(3, 9)
  })
})

describe('wall rings', () => {
  const ringModel = (): CanonicalBuildingModel => {
    const m = base()
    m.walls.push(
      wall('w0', { x: 0, z: 0 }, { x: 10, z: 0 }),
      wall('w1', { x: 10, z: 0 }, { x: 10, z: 8 }),
      wall('w2', { x: 10, z: 8 }, { x: 0, z: 8 }),
      wall('w3', { x: 0, z: 8 }, { x: 0, z: 0 }),
    )
    m.wallJunctions.push(
      corner('j0', ['w3', 'END'], ['w0', 'START'], 'w0'),
      corner('j1', ['w0', 'END'], ['w1', 'START'], 'w0'),
      corner('j2', ['w1', 'END'], ['w2', 'START'], 'w2'),
      corner('j3', ['w2', 'END'], ['w3', 'START'], 'w2'),
    )
    m.wallRings.push({ id: 'ring', levelId: 'l', wallIds: ['w0', 'w1', 'w2', 'w3'], junctionIds: ['j0', 'j1', 'j2', 'j3'] })
    return m
  }

  it('a closed ring from natural corners validates and every corner is owned exactly once', () => {
    const m = ringModel()
    expect(validateModel(m).issues).toEqual([])
    const t = resolveWallTopology(m)
    expect(t.extents.get('w0')).toEqual({ start: { outer: 0, inner: 0 }, end: { outer: 10, inner: 10 } })
    expect(t.extents.get('w1')).toEqual({ start: { outer: 0.3, inner: 0.3 }, end: { outer: 7.7, inner: 7.7 } })
    expect(t.extents.get('w2')).toEqual({ start: { outer: 0, inner: 0 }, end: { outer: 10, inner: 10 } })
    expect(t.extents.get('w3')).toEqual({ start: { outer: 0.3, inner: 0.3 }, end: { outer: 7.7, inner: 7.7 } })
  })

  it('reports a ring whose junction does not join consecutive walls, wrong counts, unknown members and level mismatches', () => {
    const wrong = ringModel()
    wrong.wallJunctions[1] = corner('j1', ['w1', 'END'], ['w0', 'START'], 'w0')
    expect(codes(wrong)).toContain('RING_NOT_CLOSED')

    const counts = ringModel()
    counts.wallRings[0] = { ...counts.wallRings[0], junctionIds: ['j0', 'j1', 'j2'] }
    expect(codes(counts)).toContain('RING_DEGENERATE')

    const unknown = ringModel()
    unknown.wallRings[0] = { ...unknown.wallRings[0], wallIds: ['w0', 'w1', 'w2', 'ghost'] }
    expect(codes(unknown)).toContain('UNKNOWN_WALL')
    const unknownJ = ringModel()
    unknownJ.wallRings[0] = { ...unknownJ.wallRings[0], junctionIds: ['j0', 'j1', 'j2', 'ghost'] }
    expect(codes(unknownJ)).toContain('UNKNOWN_JUNCTION')

    const level = ringModel()
    level.wallRings[0] = { ...level.wallRings[0], levelId: 'u' }
    expect(codes(level)).toContain('RING_LEVEL_MISMATCH')
  })

  it('a ring whose corner cannot be resolved is not closed, with the corner gap measured', () => {
    const m = ringModel()
    m.walls[1] = wall('w1', { x: 10, z: 0.6 }, { x: 10, z: 8 })
    const issues = resolveWallTopology(m).issues
    expect(issues.map((i) => i.code)).toEqual(['JUNCTION_GAP', 'RING_NOT_CLOSED'])
    expect(issues[0].measured).toBeCloseTo(0.3, 12)
  })
})
