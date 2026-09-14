import { describe, expect, it } from 'vitest'
import { loadModel, serializeModel, validateModel } from '@buildapp/model'
import { createDemoBuilding, demoBuildingCommands } from '../src/index.js'

describe('demo building', () => {
  it('is constructed through the Building DSL only and validates', () => {
    const m = createDemoBuilding()
    expect(validateModel(m).ok).toBe(true)
    expect(demoBuildingCommands().every((c) => typeof c.type === 'string')).toBe(true)
  })

  it('exercises every foundation feature', () => {
    const m = createDemoBuilding()
    expect(m.levels.length).toBeGreaterThanOrEqual(2)
    expect(m.walls.length).toBeGreaterThanOrEqual(8)
    expect(m.slabs.length).toBeGreaterThanOrEqual(1)
    expect(m.roofs.filter((r) => r.kind === 'GABLE')).toHaveLength(1)
    expect(m.roofs.filter((r) => r.kind === 'FLAT')).toHaveLength(1)
    expect(m.windows.length).toBeGreaterThanOrEqual(6)
    expect(m.doors.length).toBeGreaterThanOrEqual(2)
    expect(m.rooms.length).toBeGreaterThanOrEqual(1)
    expect(m.balconies).toHaveLength(1)
    expect(m.railings.length).toBeGreaterThanOrEqual(1)
    expect(m.chimneys).toHaveLength(1)
    expect(m.stairs).toHaveLength(1)
    expect(m.constraints.length).toBeGreaterThanOrEqual(1)
    expect(m.materials.length).toBeGreaterThanOrEqual(1)
    expect(m.evidenceSources.length).toBeGreaterThanOrEqual(1)
  })

  it('every window and door is associated with an opening on an existing wall', () => {
    const m = createDemoBuilding()
    for (const w of m.windows) {
      const o = m.openings.find((x) => x.id === w.openingId)
      expect(o, `window ${w.id} opening`).toBeDefined()
      expect(m.walls.some((x) => x.id === o!.wallId), `window ${w.id} host wall`).toBe(true)
    }
    for (const d of m.doors) {
      const o = m.openings.find((x) => x.id === d.openingId)
      expect(o, `door ${d.id} opening`).toBeDefined()
      expect(m.walls.some((x) => x.id === o!.wallId), `door ${d.id} host wall`).toBe(true)
    }
  })

  it('round-trips through JSON with identical ids and identical bytes', () => {
    const m = createDemoBuilding()
    const json = serializeModel(m)
    const back = loadModel(json)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(serializeModel(back.model)).toBe(json)
    const ids = (x: typeof m): string[] =>
      [x.building!.id, ...x.levels, ...x.walls, ...x.openings, ...x.windows, ...x.doors, ...x.rooms, ...x.slabs, ...x.roofs, ...x.balconies, ...x.railings, ...x.chimneys, ...x.stairs]
        .map((o) => (typeof o === 'string' ? o : o.id))
        .sort()
    expect(ids(back.model)).toEqual(ids(m))
    // building twice gives identical bytes: the DSL is deterministic
    expect(serializeModel(createDemoBuilding())).toBe(json)
  })
})
