/**
 * BUILDPLAN-ANALYZER-005T-N2: a chimney without a height is refused, not invented.
 *
 * The development row dom-w-gozdzikowcach dies at `placeChimney chimney-0 INVALID_COMMAND (height must be > 0)`:
 * its plan draws the stack on both storeys, but no ridge datum was read, so the house has no roof and the chimney no
 * top. Behind the chimney the model has no roof at all, so it is not recovered: the refusal stands. These tests pin
 * that the model still refuses a zero-height chimney (no validator softened), and that a chimney with a stated
 * height survives the scene round trip under its own id.
 */
import { describe, expect, it } from 'vitest'
import type { BuildingCommand } from '@buildapp/commands'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, loadBundle, serializeBundle } from '@buildapp/mobile-scene'
import { fitOpeningsToHosts } from '@buildapp/reconstruction'

const shell = (): BuildingCommand[] =>
  [
    { type: 'createBuilding', id: 'b', name: 'fixture' },
    { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 2.8 },
    { type: 'createWallRing', id: 'ring', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 2.8, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
  ] as BuildingCommand[]

const chimney = (height: number): BuildingCommand => ({ type: 'placeChimney', id: 'chimney-0', levelId: 'l0', footprint: { minX: 4.26, maxX: 5.2, minZ: 2.78, maxZ: 3.65 }, baseOffset: 0, height }) as BuildingCommand

describe('005T-N2 a chimney without a height', () => {
  it('negative: a zero-height chimney is still refused by the model, as the development row was', () => {
    const fit = fitOpeningsToHosts([...shell(), chimney(0)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(false)
    if (fit.ok) return
    expect(fit.command.type).toBe('placeChimney')
    expect(fit.errors.map((e) => e.code)).toEqual(['INVALID_COMMAND'])
    expect(fit.errors[0].message).toContain('greater than 0')
  })

  it('a chimney with a stated height compiles and survives the scene round trip under its own id, deterministically', () => {
    const fit = fitOpeningsToHosts([...shell(), chimney(5.6)], 'fixture', 'm-fixture')
    expect(fit.ok).toBe(true)
    const built = applyCommands(createEmptyModel('m-fixture', 'fixture'), fit.program)
    expect(built.failedAt).toBeUndefined()
    const text = serializeBundle(buildMobileSceneBundle(built.model, { scene: compileBuilding(built.model) }))
    expect(serializeBundle(buildMobileSceneBundle(built.model, { scene: compileBuilding(built.model) }))).toBe(text)
    const back = loadBundle(text)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    const ids = new Set(back.bundle.scene.meshes.map((m) => m.objectId))
    expect(ids.has('chimney-0')).toBe(true)
    expect(ids.has('ring-w0')).toBe(true)
  })
})
