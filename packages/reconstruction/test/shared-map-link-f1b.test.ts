/**
 * LINK-F1B: one invertible plan map for the bodies and everything read inside them, and the readers on the boundary
 * pixels → geometry made independent of the map's sub-pixel phase and of the ladder's local scale:
 *  - the chain ladder as an invertible, strictly rising map (`AxisLadder.map` / `.px`) and the v2 base frame through it,
 *    storeys aligned onto the base composed with it;
 *  - the dashed tracks of an overhead door and the arc of a door read on the raster's own pixel grid (phases 0, ±0.5,
 *    ±1, ±2 px give one answer), with negative controls (a partition is no track, a furniture line no arc);
 *  - the wall band the plan draws beside a gap (`drawnWallBand`): found within a wall of the prediction, not a thin
 *    furniture line, not a wall across the line;
 *  - a slab meets the face of the shared wall that carries it (`supportedSlab`), stepped where a side is half party,
 *    the two lowest floors meeting under the wall without overlapping, an OPEN contact untouched.
 * Invented sheets only.
 */
import { describe, expect, it } from 'vitest'
import { axisLadder } from '../src/layout.js'
import type { WorldFrame } from '../src/layout.js'
import { planFrameV2 } from '../src/v2/frame.js'
import type { PlanFrameV2, WorldFrameV2 } from '../src/v2/frame.js'
import { doorSwingInGap } from '../src/v2/interior.js'
import { drawnWallBand, overheadDoorTracks, symbolFrame } from '../src/v2/openings-v2.js'
import type { WallHost } from '../src/v2/openings-v2.js'
import { supportedSlab } from '../src/v2/emit.js'
import type { PartyWallV2, SideSegment } from '../src/v2/party-wall.js'

type Seg = { from: number; to: number; cm: number; origin?: 'READ' | 'DERIVED' }
let seq = 0
const chain = (id: string, segs: readonly Seg[]) => {
  const evidence = segs.map((s) => ({ id: `ev-${id}-${(seq += 1)}`, unit: 'cm', value: s.cm, origin: s.origin ?? 'READ' }))
  return { chain: { id, axis: 'HORIZONTAL', segments: segs.map((s, i) => ({ fromPx: s.from, toPx: s.to, valueCm: s.cm, origin: s.origin ?? 'READ', evidenceId: evidence[i].id })) }, evidence }
}
const ladder = (px: number[], chains: Array<ReturnType<typeof chain>>, mpp = 0.025) =>
  axisLadder(px.map((p) => ({ axis: 'X', px: p })) as never, chains.map((c) => c.chain) as never, chains.flatMap((c) => c.evidence) as never, 'X', mpp, px[0], 6)

describe('LINK-F1B AxisLadder.map / .px: the ladder as an invertible map', () => {
  // an overall 20.00 m over 800 px and a printed 5.03 m room (1.2 px off the sheet's scale, within the gate)
  const l = ladder([100, 300, 900], [chain('ov', [{ from: 100, to: 900, cm: 2000 }]), chain('r', [{ from: 100, to: 300, cm: 503 }])])

  it('agrees with `at` on every line, interpolates between them without snapping, and runs at the sheet scale beyond', () => {
    expect(l.map?.(100)).toBe(0)
    expect(l.map?.(300)).toBe(5.03)
    expect(l.map?.(900)).toBe(20)
    expect(l.map?.(300.4)).toBeGreaterThan(5.03) // `at` would snap 300.4 to the line
    expect(l.map?.(1000)).toBeCloseTo(20 + 100 * 0.025, 9)
    expect(l.map?.(50)).toBeCloseTo(-50 * 0.025, 9)
  })

  it('px is its inverse at the lines, between them and beyond them, and the metres rise strictly with the pixels', () => {
    for (const p of [40, 100, 177.3, 300, 300.4, 612.25, 900, 1033]) expect(l.px?.(l.map!(p))).toBeCloseTo(p, 4)
    let prev = -Infinity
    for (let p = 0; p <= 1100; p += 0.5) {
      const m = l.map!(p)
      expect(m).toBeGreaterThan(prev)
      prev = m
    }
  })

  it('a ladder whose lines do not rise strictly (two lines on one pixel) is no map: the frame keeps the linear scale', () => {
    const flat = ladder([100, 300, 300, 900], [chain('ov', [{ from: 100, to: 900, cm: 2000 }])])
    expect(flat.map).toBeUndefined()
    expect(flat.px).toBeUndefined()
  })
})

describe('LINK-F1B planFrameV2: the base plan and the storeys aligned onto it through the one map', () => {
  const lx = ladder([100, 300, 900], [chain('ov', [{ from: 100, to: 900, cm: 2000 }]), chain('r', [{ from: 100, to: 300, cm: 503 }])])
  const lz = axisLadder([{ axis: 'Y', px: 50 }, { axis: 'Y', px: 450 }] as never, [] as never, [] as never, 'Y', 0.025, 50, 6)
  const frame: WorldFrame = { metresPerPixelX: 0.025, metresPerPixelY: 0.025, originPx: { x: 100, y: 50 }, x: lx.at, z: lz.at, ladders: { x: lx, z: lz } }
  const base = { frame: { id: 'f-base', assetId: 'a-base' }, wallPx: 10, bands: [], decomposition: { envelope: { rect: { x0: 100, y0: 50, x1: 900, y1: 450 } } } }
  const upper = { frame: { id: 'f-up', assetId: 'a-up' }, wallPx: 5 }
  const draft = { frame, base, alignments: new Map([['f-up', { scale: 2, offsetX: 100, offsetY: 50, why: 'test' }]]) }
  const world = { zFlip: 10 } as WorldFrameV2

  it('maps a pixel to where the bodies were put (the printed 5.03 m line), and back to the same pixel', () => {
    const f = planFrameV2(base as never, 0, world, draft as never)!
    expect(f.toWorld(300, 50)).toEqual({ x: 5.03, z: 10 })
    for (const [px, py] of [[100, 50], [217, 133], [300, 450], [640.5, 260], [900, 400], [960, 20]]) {
      const w = f.toWorld(px, py)
      const p = f.toPixel(w.x, w.z)
      expect(p.x).toBeCloseTo(px, 4)
      expect(p.y).toBeCloseTo(py, 4)
    }
  })

  it('an aligned storey composes with the same map, both ways', () => {
    const f = planFrameV2(upper as never, 1, world, draft as never)!
    expect(f.toWorld(100, 0)).toEqual({ x: 5.03, z: 10 })
    for (const [px, py] of [[0, 0], [100, 0], [233.3, 117], [400, 200]]) {
      const w = f.toWorld(px, py)
      const p = f.toPixel(w.x, w.z)
      expect(p.x).toBeCloseTo(px, 4)
      expect(p.y).toBeCloseTo(py, 4)
    }
  })

  it('symbolFrame puts the given point on the map’s pixel and measures about it at the sheet’s scale', () => {
    const f = planFrameV2(base as never, 0, world, draft as never)!
    const s = symbolFrame(f, { x: 5.03, z: 9 })
    expect(s.toPixel(5.03, 9)).toEqual(f.toPixel(5.03, 9))
    expect(s.toPixel(6.03, 9).x - s.toPixel(5.03, 9).x).toBeCloseTo(1 / f.mppX, 6)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// synthetic sheets
// ---------------------------------------------------------------------------------------------------------------------

const MPP = 0.02
const W = 760
const H = 420
type Paint = (set: (x: number, y: number, l: number) => void) => void
function sheet(paint: Paint) {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const set = (x: number, y: number, l: number): void => {
    const xi = Math.round(x)
    const yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return
    const o = (yi * W + xi) * 4
    data[o] = data[o + 1] = data[o + 2] = l
  }
  paint(set)
  return { width: W, height: H, data }
}
/** A linear frame at 0.02 m/px with world (0, 0) at pixel (20 + dx, 100 + dy); z grows down the sheet. */
const frameAt = (dx = 0, dy = 0): PlanFrameV2 => ({ frameId: 'f', assetId: 'a', storeyIndex: 0, mppX: MPP, mppY: MPP, originPx: { x: 20 + dx, y: 100 + dy }, why: 'synthetic', toWorld: (x, y) => ({ x: (x - 20 - dx) * MPP, z: (y - 100 - dy) * MPP }), toPixel: (x, z) => ({ x: 20 + dx + x / MPP, y: 100 + dy + z / MPP }), wallPx: 20 })
const PHASES = [0, 0.5, -0.5, 1, -1, 2, -2]
const HOST: WallHost = { massId: 'main', facade: 'FRONT', planeAt: 0, from: 0, to: 14, centreAt: 0.2, storeyIndex: 0, floorY: 0, storeyHeightM: 2.8 }
/** A 0.4 m front wall (rows 100..120) along 14 m, with a gap 5..7.5 m. */
const wall = (set: (x: number, y: number, l: number) => void, gap: [number, number] = [5, 7.5], luma = 0): void => {
  for (let y = 100; y <= 120; y += 1) for (let x = 20; x <= 720; x += 1) if (x < 20 + gap[0] / MPP || x > 20 + gap[1] / MPP) set(x, y, luma)
}

describe('LINK-F1B overheadDoorTracks: the same dashed tracks at every sub-pixel phase', () => {
  const tracks = (style: 'DASHED' | 'SOLID'): Paint => (set) => {
    wall(set)
    for (const at of [5.04, 7.46]) for (let i = 0; i < 130; i += 1) if (style === 'SOLID' || i % 10 < 6) set(20 + at / MPP, 122 + i, style === 'SOLID' ? 40 : 120)
  }
  it('reads both tracks in all 49 phases of a ±2 px shift', () => {
    const raster = sheet(tracks('DASHED'))
    for (const dx of PHASES) for (const dy of PHASES) expect(overheadDoorTracks(raster, frameAt(dx, dy), HOST, [5, 7.5], 0.4), `${dx},${dy}`).toBeDefined()
  })
  it('a solid line from each jamb (a partition, not tracks) is refused at every phase', () => {
    const raster = sheet(tracks('SOLID'))
    for (const dx of PHASES) for (const dy of PHASES) expect(overheadDoorTracks(raster, frameAt(dx, dy), HOST, [5, 7.5], 0.4)).toBeUndefined()
  })
})

describe('LINK-F1B doorSwingInGap: a drawn leaf and arc found at every sub-pixel phase', () => {
  // a partition along x at z = 4 m (row 300), a 0.9 m door gap 4.0..4.9 m: leaf at the low jamb, square to the wall,
  // the quarter arc from its tip to the far jamb
  const door = (withArc: boolean, withLeaf: boolean): Paint => (set) => {
    for (let y = 297; y <= 303; y += 1) for (let x = 120; x <= 520; x += 1) if (x < 220 || x > 265) set(x, y, 0)
    const hx = 220
    const r = 45
    if (withLeaf) for (let k = 0; k <= r; k += 1) set(hx, 300 - k, 60)
    if (withArc) for (let a = 0; a <= 90; a += 0.5) set(hx + r * Math.cos((a * Math.PI) / 180), 300 - r * Math.sin((a * Math.PI) / 180), 60)
  }
  it('finds the door in all 49 phases', () => {
    const raster = sheet(door(true, true))
    for (const dx of PHASES) for (const dy of PHASES) expect(doorSwingInGap(raster, frameAt(dx, dy), 'X', 4, [4.0, 4.9]), `${dx},${dy}`).toBeDefined()
  })
  it('a gap with no arc and no leaf drawn (two close partition ends, a passage) is no door', () => {
    const raster = sheet(door(false, false))
    expect(doorSwingInGap(raster, frameAt(), 'X', 4, [4.0, 4.9])).toBeUndefined()
  })
})

describe('LINK-F1B drawnWallBand: the wall the plan draws beside a gap, not furniture and not a wall across', () => {
  it('finds a grey wall drawn 4 px off the host’s prediction (within a wall), its centre on the ink', () => {
    const raster = sheet((set) => wall(set, [5, 7.5], 150))
    // the host predicts the wall centred 0.08 m (4 px) further into the room than drawn
    const band = drawnWallBand(raster, frameAt(), { ...HOST, centreAt: 0.28 }, [5, 7.5], 0.4)
    expect(band).toBeDefined()
    expect(band!.centreAt).toBeCloseTo(0.21, 1)
  })
  it('a thin furniture line where the wall is predicted is no band', () => {
    const raster = sheet((set) => { for (let x = 20; x <= 720; x += 1) { set(x, 110, 0); set(x, 111, 0) } })
    expect(drawnWallBand(raster, frameAt(), HOST, [5, 7.5], 0.4)).toBeUndefined()
  })
  it('a wall across the line beside the jambs (a long run) is not this wall', () => {
    const raster = sheet((set) => { for (const x0 of [270, 395]) for (let x = x0; x <= x0 + 10; x += 1) for (let y = 60; y <= 260; y += 1) set(x, y, 0) })
    expect(drawnWallBand(raster, frameAt(), HOST, [5, 7.5], 0.4)).toBeUndefined()
  })
})

describe('LINK-F1B supportedSlab: a slab ends on the face of the wall that carries it', () => {
  // the host's east side: its own corner 0..0.43, the shared wall 0.43..9.22 (far face 7.56, 0.234 thick, so its face
  // toward the host is 7.326), its own wall again 9.22..10.45; the slab's own edge is the house wall's face 7.32
  const party = { id: 'p', hostFacade: 'EAST', thicknessM: 0.234, band: [7.326, 7.56], open: undefined } as unknown as PartyWallV2
  const segs = (east: SideSegment[]): Record<'FRONT' | 'EAST' | 'REAR' | 'WEST', SideSegment[]> => ({ FRONT: [{ kind: 'OWN', from: 0, to: 7.75 }], EAST: east, REAR: [{ kind: 'OWN', from: 0, to: 7.75 }], WEST: [{ kind: 'OWN', from: 0, to: 10.45 }] })
  const east: SideSegment[] = [{ kind: 'CORNER', from: 0, to: 0.43, party }, { kind: 'PARTY', from: 0.43, to: 9.22, party }, { kind: 'OWN', from: 9.22, to: 10.45 }]

  it('above the lowest storey: the party stretch ends on the shared wall’s own face, the own stretch on the house wall’s, with a step', () => {
    const poly = supportedSlab(segs(east), { x0: 0.43, z0: 0.43, x1: 7.32, z1: 10.02 }, true, false)!
    expect(poly).toContainEqual({ x: 7.326, z: 0.43 })
    expect(poly).toContainEqual({ x: 7.326, z: 9.22 })
    expect(poly).toContainEqual({ x: 7.32, z: 9.22 })
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      expect(a.x === b.x || a.z === b.z).toBe(true)
    }
  })

  it('on the lowest storey the host’s floor ends on the far face along the whole contact, and the other body’s starts there', () => {
    const host = supportedSlab(segs(east), { x0: 0, z0: 0, x1: 7.75, z1: 10.45 }, false, true)!
    expect(host).toContainEqual({ x: 7.56, z: 0 })
    expect(host).toContainEqual({ x: 7.56, z: 9.22 })
    const other: Record<'FRONT' | 'EAST' | 'REAR' | 'WEST', SideSegment[]> = { FRONT: [{ kind: 'OWN', from: 7.75, to: 11.6 }], EAST: [{ kind: 'OWN', from: 0, to: 9.65 }], REAR: [{ kind: 'OWN', from: 7.75, to: 11.6 }], WEST: [{ kind: 'NONE', from: 0, to: 9.65, party }] }
    const otherPoly = supportedSlab(other, { x0: 7.75, z0: 0, x1: 11.6, z1: 9.65 }, false, true, () => [[0, 0.43], [0.43, 9.22]])!
    expect(otherPoly).toContainEqual({ x: 7.56, z: 0 })
    expect(otherPoly).toContainEqual({ x: 7.56, z: 9.22 })
    // past the shared wall the host's own wall runs on: there the other floor starts at its own outline
    expect(otherPoly).toContainEqual({ x: 7.75, z: 9.65 })
  })

  it('an OPEN contact (no wall drawn) keeps the lowest floor’s outline', () => {
    const open = { ...party, open: true } as unknown as PartyWallV2
    const other: Record<'FRONT' | 'EAST' | 'REAR' | 'WEST', SideSegment[]> = { FRONT: [{ kind: 'OWN', from: 7.75, to: 11.6 }], EAST: [{ kind: 'OWN', from: 0, to: 9.65 }], REAR: [{ kind: 'OWN', from: 7.75, to: 11.6 }], WEST: [{ kind: 'NONE', from: 0, to: 9.65, party: open }] }
    expect(supportedSlab(other, { x0: 7.75, z0: 0, x1: 11.6, z1: 9.65 }, false, true, () => [[0, 9.65]])).toBeUndefined()
  })
})
