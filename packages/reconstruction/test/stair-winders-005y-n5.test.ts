/**
 * BUILDPLAN-ANALYZER-005Y-N5 (C4): the corner square of a turning stair either rests (a landing) or fans (winders).
 * Winders draw their tread lines from the newel — the square's corner on the turn side — to the outer walls, splitting
 * the quarter turn evenly. None of the development houses draws one on its plan, so the reading is proved here on an
 * invented L stair: with two fanning lines it is a winder of three risers; with none, or with a stray diagonal that does
 * not radiate from the newel, the square stays a landing.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import { assembleStair, findTreadLadders } from '../src/index.js'
import type { PlanFrameV2 } from '../src/index.js'
import { splitAtBreaks } from '../src/v2/stair-topology.js'

const MPP = 0.01
const W = 600
const H = 600
const PO = 50
const POY = 550
const toPixel = (x: number, z: number) => ({ x: PO + x / MPP, y: POY - z / MPP })
const frame: PlanFrameV2 = { frameId: 'frame-plan', assetId: 'asset-plan', storeyIndex: 0, mppX: MPP, mppY: MPP, originPx: { x: PO, y: POY }, why: 'synthetic', toWorld: (x, y) => ({ x: (x - PO) * MPP, z: (POY - y) * MPP }), toPixel, wallPx: 0.2 / MPP }

/** An L stair: 8 treads along +x in the band z 1..2 up to x 3, a corner square x 3..4, then 8 treads along +z in x 3..4. */
function sheet(diagonals: Array<[{ x: number; z: number }, { x: number; z: number }]>): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const line = (a: { x: number; z: number }, b: { x: number; z: number }, l = 90): void => {
    const p = toPixel(a.x, a.z)
    const q = toPixel(b.x, b.z)
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y))
    for (let i = 0; i <= n; i += 1) {
      const x = Math.round(p.x + ((q.x - p.x) * i) / n)
      const y = Math.round(p.y + ((q.y - p.y) * i) / n)
      const o = (y * W + x) * 4
      data[o] = data[o + 1] = data[o + 2] = l
    }
  }
  for (let k = 0; k <= 8; k += 1) line({ x: 1 + k * 0.25, z: 1 }, { x: 1 + k * 0.25, z: 2 })
  for (let k = 0; k <= 8; k += 1) line({ x: 3, z: 2 + k * 0.25 }, { x: 4, z: 2 + k * 0.25 })
  // the stair's outline
  line({ x: 1, z: 1 }, { x: 4, z: 1 })
  line({ x: 4, z: 1 }, { x: 4, z: 4 })
  line({ x: 1, z: 2 }, { x: 3, z: 2 })
  line({ x: 3, z: 2 }, { x: 3, z: 4 })
  for (const [a, b] of diagonals) line(a, b)
  return { width: W, height: H, data }
}
const newel = { x: 3, z: 2 }
/** A ray from the newel at `deg` from the across direction (−z) towards the travel direction (+x), to the square's edge. */
const ray = (deg: number): [{ x: number; z: number }, { x: number; z: number }] => {
  const t = (deg * Math.PI) / 180
  const dir = { x: Math.sin(t), z: -Math.cos(t) }
  const reach = Math.min(1 / Math.max(1e-9, Math.abs(dir.x)), 1 / Math.max(1e-9, Math.abs(dir.z)))
  return [newel, { x: newel.x + dir.x * reach, z: newel.z + dir.z * reach }]
}
const read = (diagonals: Array<[{ x: number; z: number }, { x: number; z: number }]>) => {
  const raster = sheet(diagonals)
  const ladders = findTreadLadders(raster, frame, { x0: 0.5, z0: 0.5, x1: 4.5, z1: 4.5 })
  return assembleStair(raster, frame, ladders, 0, 2.8)
}

describe('005Y-N5 (C4) winders in the corner square of a turning stair', () => {
  it('two tread lines fanning from the newel make a winder of three risers', () => {
    const h = read([ray(30), ray(60)])
    expect(h?.landings).toHaveLength(1)
    expect(h?.landings[0].turn).toBe('LEFT')
    expect(h?.landings[0].winders).toBe(2)
    expect(h?.winderRegions).toHaveLength(1)
    const flat = read([])
    expect(h?.risersTotal).toBe((flat?.risersTotal ?? 0) + 2)
  })
  it('counterfactual: the same stair with an empty square rests on a landing', () => {
    const h = read([])
    expect(h?.landings[0].winders).toBeUndefined()
    expect(h?.winderRegions).toHaveLength(0)
  })
  it('a stray diagonal that does not radiate from the newel, or lines that split the turn unevenly, decide nothing', () => {
    expect(read([[{ x: 3.2, z: 1 }, { x: 4, z: 1.8 }]])?.landings[0].winders).toBeUndefined()
    expect(read([ray(20), ray(30)])?.landings[0].winders).toBeUndefined()
  })
})

describe('splitAtBreaks (005Y-N6 F5)', () => {
  const scans = (...s: number[]) => s.map((scan) => ({ scan }))
  it('a flight broken by an arrowhead stays one run; sequences glued on across a wider break are cut off', () => {
    const [flight, glued] = splitAtBreaks([{ members: scans(397, 398, 399, 410, 411, 436, 441, 442, 465, 466, 471, 490), spacing: 14 }], 12)
    expect(flight.members.map((m) => m.scan)).toEqual([397, 398, 399, 410, 411])
    expect(glued.members[0].scan).toBe(436)
  })
  it('a group with no break wider than the limit is returned whole', () => {
    expect(splitAtBreaks([{ members: scans(1, 5, 9, 13), spacing: 10 }], 12)).toHaveLength(1)
  })
})
