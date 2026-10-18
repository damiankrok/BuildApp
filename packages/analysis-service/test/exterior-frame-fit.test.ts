/**
 * BUILDPLAN-ANALYZER-005T: an exterior window or door is framed inside the wall the solver read.
 *
 * The solver accepts a wall read from 0.15 m; the model's default frames reach 0.20 m (window) and 0.22 m (door)
 * into it. A development house read with 0.152 m walls (the 005S N1v row A01) was refused at its first window
 * (`placeWindow … FILL_TOO_LARGE: frame reaches 0.2 m into a 0.152325 m wall`) and no 3D was made. The emitter now
 * frames such fills within the wall, and only then: where the default fits, the command is what it was. The model's
 * validator is not touched — a fill that leaves no glazing is still refused.
 */
import { describe, expect, it } from 'vitest'
import type { BuildingCommand } from '@buildapp/commands'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, loadBundle, serializeBundle } from '@buildapp/mobile-scene'
import { EXTERIOR_FRAME_DEFAULTS, fitOpeningsToHosts, frameWithinWall } from '@buildapp/reconstruction'

/** A 10 × 8 m ring on one 2.8 m storey with the wall thickness given; wall ring-w1 runs along x. */
const shell = (t: number): BuildingCommand[] =>
  [
    { type: 'createBuilding', id: 'b', name: 'fixture' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'ring', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: t, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
  ] as BuildingCommand[]

const windowIn = (t: number, width = 1.06, frame = true): BuildingCommand[] => [
  { type: 'cutOpening', id: 'o-win', wallId: 'ring-w1', kind: 'WINDOW', offset: 3, sill: 0.9, width, height: 1.42 },
  { type: 'placeWindow', id: 'o-win-unit', openingId: 'o-win', ...(frame ? frameWithinWall('WINDOW', t) : {}) },
] as BuildingCommand[]

const doorIn = (t: number, frame = true): BuildingCommand[] => [
  { type: 'cutOpening', id: 'o-door', wallId: 'ring-w1', kind: 'DOOR', offset: 6, sill: 0, width: 1.0, height: 2.1 },
  { type: 'placeDoor', id: 'o-door-leaf', openingId: 'o-door', ...(frame ? frameWithinWall('DOOR', t) : {}) },
] as BuildingCommand[]

// the A01 wall as the solver read it
const THIN = 0.152325

describe('005T exterior fills framed inside the wall the solver read', () => {
  it('before: a window and a door with the default frames are refused in a 0.152 m wall (the A01 stop)', () => {
    const win = fitOpeningsToHosts([...shell(THIN), ...windowIn(THIN, 1.06, false)], 'fixture', 'm-fixture')
    expect(win.ok).toBe(false)
    if (win.ok) return
    expect(win.command.type).toBe('placeWindow')
    expect(win.errors.map((e) => e.code)).toEqual(['FILL_TOO_LARGE'])
    expect(win.errors[0].message).toContain('frame reaches 0.2 m into a 0.152325 m wall')
    const door = fitOpeningsToHosts([...shell(THIN), ...doorIn(THIN, false)], 'fixture', 'm-fixture')
    expect(door.ok).toBe(false)
  })

  it('after: the same fills, framed within the wall, are accepted by the unchanged validator', () => {
    const fit = fitOpeningsToHosts([...shell(THIN), ...windowIn(THIN), ...doorIn(THIN)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    expect(fit.fits).toEqual([])
    const w = frameWithinWall('WINDOW', THIN)
    expect((w.frameDepth ?? 0) + (w.frameInset ?? 0)).toBeLessThanOrEqual(THIN)
    expect(w.frameDepth).toBe(0.08)
    const d = frameWithinWall('DOOR', THIN)
    expect((d.frameDepth ?? 0) + (d.frameInset ?? 0)).toBeLessThanOrEqual(THIN)
    expect(d.leafThickness).toBeLessThanOrEqual(d.frameDepth ?? 0)
  })

  it('where the default frame fits, nothing is emitted: every model built so far keeps its commands byte for byte', () => {
    for (const t of [0.2, 0.22, 0.3, 0.44, 0.7]) {
      if (t >= EXTERIOR_FRAME_DEFAULTS.WINDOW.inset + EXTERIOR_FRAME_DEFAULTS.WINDOW.depth) expect(frameWithinWall('WINDOW', t)).toEqual({})
      if (t >= EXTERIOR_FRAME_DEFAULTS.DOOR.inset + EXTERIOR_FRAME_DEFAULTS.DOOR.depth) expect(frameWithinWall('DOOR', t)).toEqual({})
    }
    // a 0.20 m wall still takes the default window, but not the default door
    expect(frameWithinWall('WINDOW', 0.2)).toEqual({})
    expect(frameWithinWall('DOOR', 0.2)).not.toEqual({})
  })

  it('negative: the validator is not softened — an opening too narrow for any frame is still refused', () => {
    const fit = fitOpeningsToHosts([...shell(THIN), ...windowIn(THIN, 0.12)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.errors.map((e) => e.code)).toContain('FILL_TOO_LARGE')
  })

  it('the framed house compiles into a scene that survives its round trip, each fill under its own id', () => {
    const fit = fitOpeningsToHosts([...shell(THIN), ...windowIn(THIN), ...doorIn(THIN)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    const built = applyCommands(createEmptyModel('m-fixture', 'fixture'), fit.program)
    expect(built.failedAt).toBeUndefined()
    const scene = compileBuilding(built.model)
    const bundle = buildMobileSceneBundle(built.model, { scene })
    const text = serializeBundle(bundle)
    expect(serializeBundle(buildMobileSceneBundle(built.model, { scene: compileBuilding(built.model) }))).toBe(text)
    const back = loadBundle(text)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.bundle.contentHash).toBe(bundle.contentHash)
    const ids = new Set(back.bundle.scene.meshes.map((m) => m.objectId))
    expect(ids.has('o-win-unit')).toBe(true)
    expect(ids.has('o-door-leaf')).toBe(true)
    expect(ids.has('ring-w1')).toBe(true)
  })
})
