/**
 * v3.54.14 — the delivered model chosen per property: the form candidate's geometry when it stood, a wall's tone changed
 * only on a side whose sketch passed the proportion check. Counter-trial: with every side accepted nothing is kept back.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { chooseDelivered } from '../src/consult/choose.js'

const box = (): CanonicalBuildingModel => {
  const m = runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'l0', index: 0, elevation: 0, height: 3 },
    // four free-standing walls (no junctions needed) drawn clockwise in plan (x right, z towards the rear): its outward normals face FRONT (z−), EAST, REAR, WEST
    { type: 'createWall', id: 'wf', levelId: 'l0', start: { x: 0.5, z: 0 }, end: { x: 7.5, z: 0 }, thickness: 0.3, height: 3 },
    { type: 'createWall', id: 'we', levelId: 'l0', start: { x: 8, z: 0.5 }, end: { x: 8, z: 5.5 }, thickness: 0.3, height: 3 },
    { type: 'createWall', id: 'wr', levelId: 'l0', start: { x: 7.5, z: 6 }, end: { x: 0.5, z: 6 }, thickness: 0.3, height: 3 },
    { type: 'createWall', id: 'ww', levelId: 'l0', start: { x: 0, z: 5.5 }, end: { x: 0, z: 0.5 }, thickness: 0.3, height: 3 },
  ] as BuildingCommand[])
  m.materials.push({ id: 'mat-dark', name: 'dark', color: '#333333' }, { id: 'mat-light', name: 'light', color: '#cccccc' })
  for (const w of m.walls) w.materialId = 'mat-dark'
  return m
}
const formOf = (m: CanonicalBuildingModel): CanonicalBuildingModel => {
  const f = structuredClone(m)
  for (const w of f.walls) w.materialId = 'mat-light'
  f.walls[1] = { ...f.walls[1], height: 3.2 } // a geometry change the form step brought
  return f
}

describe('v3.54.14 the delivered model, per property', () => {
  it('keeps a wall\'s tone on a side with no accepted sketch; the form\'s geometry and the accepted sides\' tones are taken', () => {
    const before = box()
    const form = formOf(before)
    const { model, record } = chooseDelivered({ metricModel: before, formModel: form, formAccepted: true, acceptedSides: ['EAST', 'REAR', 'WEST'] })
    expect(record.geometryFrom).toBe('FORM')
    expect(model.walls.find((w) => w.id === 'wf')?.materialId).toBe('mat-dark')
    expect(record.kept).toEqual([{ wallId: 'wf', side: 'FRONT', candidate: 'mat-light', kept: 'mat-dark' }])
    for (const id of ['we', 'wr', 'ww']) expect(model.walls.find((w) => w.id === id)?.materialId).toBe('mat-light')
    expect(model.walls.find((w) => w.id === 'we')?.height).toBe(3.2)
    // the same inputs, the same model
    expect(JSON.stringify(chooseDelivered({ metricModel: before, formModel: form, formAccepted: true, acceptedSides: ['WEST', 'REAR', 'EAST'] }).model)).toBe(JSON.stringify(model))
  })

  it('counter-trial: every side accepted keeps nothing back; no form candidate delivers the metric model', () => {
    const before = box()
    const form = formOf(before)
    const all = chooseDelivered({ metricModel: before, formModel: form, formAccepted: true, acceptedSides: ['FRONT', 'EAST', 'REAR', 'WEST'] })
    expect(all.record.kept).toEqual([])
    expect(all.model.walls.every((w) => w.materialId === 'mat-light')).toBe(true)
    const none = chooseDelivered({ metricModel: before, formModel: form, formAccepted: false, acceptedSides: ['EAST'] })
    expect(none.record.geometryFrom).toBe('METRIC')
    expect(none.model).toBe(before)
  })
})
