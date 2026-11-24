/**
 * v3.54.19 — the typed form of the house as a witness of the body arbitration. Scripted transport (no provider);
 * controlled forms (not a benchmark house); every rule with its counter-trial.
 */
import { describe, expect, it } from 'vitest'
import { flatVolumesOf, formVerdict, readForm } from '../src/consult/form-read.js'
import type { HouseForm } from '../src/consult/form-read.js'
import type { ConsultantModel, ModelTurn } from '../src/consult/loop.js'

const raster = { width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4).fill(255) }
const gable: HouseForm = { storeys: 'ONE', volumes: 1, mainRoof: { kind: 'GABLE', ridgeAlong: 'FRONT', pitchDeg: 35 }, lowerParts: [], dormers: 0, chimneys: 1, roofWindows: 0, garageDoor: 'NONE', entrance: 'FRONT' }
const answering = (input: unknown): ConsultantModel => ({ id: 's', model: 'm', maxOutputTokens: 1000, send: async () => ({ content: [{ type: 'tool_use', id: 't', name: 'report_form', input }], stopReason: 'tool_use', usage: { inputTokens: 10, outputTokens: 10 } }) as unknown as ModelTurn }) as never
const ctx = (input: unknown) => ({ model: answering(input), price: { inputPerMTok: 1, outputPerMTok: 1 } as never })

describe('v3.54.19 what the typed form says of a body', () => {
  it('a body with flat-roofed volumes the form does not report is contradicted; the same house as one pitched body agrees', () => {
    expect(formVerdict(gable, { flatVolumes: 2, pitchedKinds: ['GABLE'] })).toBe('CONTRADICTS')
    expect(formVerdict(gable, { flatVolumes: 0, pitchedKinds: ['GABLE'] })).toBe('AGREES')
  })
  it('counter-trials: a flat-roofed garage the form reports is no contradiction; a hip built for a reported gable is not this witness\'s business; a body with no roof is not confirmed', () => {
    const withGarage: HouseForm = { ...gable, volumes: 2, lowerParts: [{ what: 'GARAGE', roof: 'FLAT', where: 'LEFT' }] }
    expect(flatVolumesOf(withGarage)).toBe(1)
    expect(formVerdict(withGarage, { flatVolumes: 1, pitchedKinds: ['GABLE'] })).toBe('AGREES')
    expect(formVerdict(withGarage, { flatVolumes: 2, pitchedKinds: ['GABLE'] })).toBe('CONTRADICTS')
    expect(formVerdict(gable, { flatVolumes: 0, pitchedKinds: ['HIP'] })).toBe('AGREES')
    expect(formVerdict(gable, { flatVolumes: 0, pitchedKinds: [] })).toBe('SILENT')
    const flat: HouseForm = { ...gable, mainRoof: { kind: 'FLAT', ridgeAlong: 'NONE', pitchDeg: 0 } }
    expect(formVerdict(flat, { flatVolumes: 1, pitchedKinds: [] })).toBe('AGREES')
    expect(formVerdict(flat, { flatVolumes: 3, pitchedKinds: [] })).toBe('CONTRADICTS')
  })
})

describe('v3.54.19 the form read', () => {
  const pics = [{ caption: 'FRONT', raster }, { caption: 'REAR', raster }]
  it('a typed answer is taken as given', async () => {
    const r = await readForm(ctx({ ...gable, note: 'x' }), pics as never)
    expect(r.refused).toEqual([])
    expect(r.form).toEqual(gable)
    expect(r.pictures).toBe(2)
  })
  it('counter-trials: an answer that contradicts itself, or is not the typed answer, is refused by name — no form, no verdict', async () => {
    const selfContradicting = await readForm(ctx({ ...gable, mainRoof: { kind: 'FLAT', ridgeAlong: 'FRONT', pitchDeg: 0 } }), pics as never)
    expect(selfContradicting.form).toBeUndefined()
    expect(selfContradicting.refused[0]).toMatch(/contradicts itself/)
    const malformed = await readForm(ctx({ ...gable, volumes: 'one' }), pics as never)
    expect(malformed.form).toBeUndefined()
    expect(malformed.refused[0]).toMatch(/malformed/)
    const tooMany = await readForm(ctx({ ...gable, volumes: 40 }), pics as never)
    expect(tooMany.form).toBeUndefined()
  })
})
