/**
 * v3.54.12 — a finish zone reaches the exposed END CAP of a wall that owns a corner in the facade's plane (before: the
 * cap kept the wall's own material, a light strip between two finished stretches). Hidden caps (a butt, or a corner
 * the other wall owns) are not finished; no zone, no cap.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { compileHouse } from '../src/house/describe.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any
const ROOT = join(__dirname, '..', '..', '..')
const fixture = (): Doc => JSON.parse(readFileSync(join(ROOT, 'research/source-to-model/v3544/manual/gracja.house.json'), 'utf8'))
const front = (doc: Doc): Doc => doc.observations.elevations.find((e: Doc) => e.id === 'el-front')
const DARK = { id: 'zd', material: 'PLASTER', tone: 'DARK', box: { x0: 0, y0: 100, x1: 1000, y1: 298 }, bodyId: 'main', certainty: 'CERTAIN' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const regions = (h: any): Array<{ id: string; hostId: string; face: string; materialId: string }> => h.built?.model.surfaceRegions ?? []

describe('v3.54.12 a finish zone over an exposed wall end cap', () => {
  it('cause: the cap of a wall that owns its corner in the facade plane takes the zone; hidden caps do not', () => {
    const doc = fixture()
    front(doc).zones = [DARK]
    const h = compileHouse(doc, 't')
    const caps = regions(h).filter((r) => r.face === 'START' || r.face === 'END')
    expect(caps.length).toBeGreaterThan(0)
    const program = (h.built?.program ?? []) as Array<{ type: string; id?: string; startJunction?: { kind: string; owner?: string }; endJunction?: { kind: string; owner?: string } }>
    for (const c of caps) {
      const wall = program.find((x) => x.type === 'createWall' && x.id === c.hostId)
      const j = c.face === 'START' ? wall?.startJunction : wall?.endJunction
      // every finished cap is exposed: a free end or a corner this wall owns — declared by itself (SELF) or by the
      // other wall of the corner (OTHER)
      expect(j === undefined || (j.kind === 'CORNER' && j.owner === 'SELF')).toBe(true)
      const other = program.flatMap((x) => (x.type === 'createWall' ? [x.startJunction, x.endJunction] : [])).find((q) => (q as { with?: { wallId?: string; end?: string } } | undefined)?.with?.wallId === c.hostId && (q as { with?: { end?: string } }).with?.end === c.face) as { owner?: string } | undefined
      expect(other === undefined || other.owner === 'OTHER').toBe(true)
      expect(c.materialId).toBe('mat-zone-plaster-dark')
    }
    // and the compiled scene draws them
    const meshes = compileBuilding(h.built?.model as never).meshes
    expect(caps.every((c) => meshes.some((m) => m.objectId === c.id && m.triangles.length > 0))).toBe(true)
  })
  it('counter: with no zone there is no cap finish, and the walls are as before', () => {
    const doc = fixture()
    front(doc).zones = []
    const h = compileHouse(doc, 't')
    expect(regions(h).filter((r) => r.face === 'START' || r.face === 'END')).toEqual([])
  })
})
