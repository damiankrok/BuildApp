/**
 * LINK-F1C: two rooflights of one row whose stated edges differ by a micrometre (each computed on its own) used to cut
 * a band a micrometre wide across the slope: hairline triangles and edges shared by six triangles (Jarzmianki, Trytomy).
 * Cut lines closer than ROOF_CUT_WELD_M are one line. Holes a millimetre apart stay two lines. Invented roof.
 */
import { describe, expect, it } from 'vitest'
import { ROOF_CUT_WELD_M, compileBuilding } from '../src/index.js'
import { withGround } from './helpers.js'

const roof = (dz: number) =>
  withGround(
    { type: 'createRoof', id: 'roof', levelId: 'ground', kind: 'GABLE', footprint: { minX: 0, maxX: 10, minZ: 0, maxZ: 8 }, eaveOffset: 3, pitchDeg: 40, ridgeAxis: 'X', thickness: 0.25 },
    { type: 'cutRoofOpening', id: 'ra', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 2, maxX: 2.8, minZ: 0.4, maxZ: 1.3 }, cut: 'NORMAL_TO_ROOF' },
    { type: 'cutRoofOpening', id: 'rb', roofId: 'roof', kind: 'ROOFLIGHT', footprint: { minX: 6, maxX: 6.8, minZ: 0.4, maxZ: 1.3 + dz }, cut: 'NORMAL_TO_ROOF' },
  )
type V = { x: number; y: number; z: number }
const roofTris = (m: ReturnType<typeof roof>) => compileBuilding(m).meshes.filter((x) => (x.objectId === 'roof' && x.part !== 'ROOF_TRIM' && x.part !== 'ROOF_REVEAL') || (x.part === 'ROOF_REVEAL' && x.hostRoofId === 'roof')).flatMap((x) => x.triangles)
const defects = (m: ReturnType<typeof roof>) => {
  const key = (p: V) => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`
  const count = new Map<string, number>()
  let slivers = 0
  for (const t of roofTris(m)) {
    for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
      const k = [key(p), key(q)].sort().join('|')
      count.set(k, (count.get(k) ?? 0) + 1)
    }
    const e = Math.min(Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y, t.b.z - t.a.z), Math.hypot(t.c.x - t.b.x, t.c.y - t.b.y, t.c.z - t.b.z), Math.hypot(t.a.x - t.c.x, t.a.y - t.c.y, t.a.z - t.c.z))
    if (e < 0.0005) slivers += 1
  }
  return { open: [...count.values()].filter((n) => n !== 2).length, slivers }
}
const crossLines = (m: ReturnType<typeof roof>) => new Set(roofTris(m).flatMap((t) => [t.a.z, t.b.z, t.c.z]).filter((z) => z > 1.2 && z < 1.4).map((z) => z.toFixed(7))).size

describe('LINK-F1C roof cut lines a micrometre apart', () => {
  it('a row of rooflights whose edges differ by 1 µm compiles closed, with no hairline band', () => {
    expect(defects(roof(1e-6))).toEqual({ open: 0, slivers: 0 })
    expect(crossLines(roof(1e-6))).toBe(crossLines(roof(0)))
  })
  it('edges a millimetre apart are two lines, and the roof is still closed', () => {
    expect(ROOF_CUT_WELD_M).toBeLessThan(1e-3)
    expect(defects(roof(1e-3))).toEqual({ open: 0, slivers: 0 })
    expect(crossLines(roof(1e-3))).toBeGreaterThan(crossLines(roof(0)))
  })
})
