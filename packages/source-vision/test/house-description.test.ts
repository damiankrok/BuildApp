/** v3.53: the whole-house description — its schema as a provider sees it, its prompt, and its deterministic admission. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HouseDescriptionSchema, buildHouseDescriptionPrompt, checkHouseDescription, houseDescriptionJsonSchema } from '../src/index.js'

const raw = (): Record<string, unknown> => JSON.parse(readFileSync(new URL('../../reconstruction/test/fixtures/described-house-a.json', import.meta.url), 'utf8')) as Record<string, unknown>

describe('house description', () => {
  it('constrains a provider to the closed vocabulary: every property required, nothing additional, no mesh or command', () => {
    const schema = houseDescriptionJsonSchema() as { required: string[]; additionalProperties: boolean; properties: Record<string, unknown> }
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required.sort()).toEqual(Object.keys(HouseDescriptionSchema.shape).sort())
    const text = JSON.stringify(schema)
    for (const banned of ['mesh', 'triangle', 'command', 'wallId', 'vertices']) expect(text).not.toContain(banned)
  })

  it('tells the reader the pictures by number and the published figures, and nothing that names the page', () => {
    const prompt = buildHouseDescriptionPrompt({ images: [{ number: 1, widthPx: 800, heightPx: 600 }], published: [{ key: 'building_width', label: 'Szerokość', raw: '13,84 m', value: 13.84, unit: 'm' }] })
    expect(prompt).toContain('13,84 m')
    expect(prompt).not.toMatch(/https?:\/\//)
    expect(prompt).toContain('hypotheticalSides')
  })

  it('admits a consistent description', () => {
    const r = checkHouseDescription(raw())
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
  })

  it('refuses what cannot be built as stated', () => {
    const d = raw() as { bodies: Array<Record<string, unknown>> }
    expect(checkHouseDescription({ ...d, bodies: [d.bodies[0], { ...d.bodies[1], role: 'MAIN' }] }).ok).toBe(false)
    expect(checkHouseDescription({ ...d, bodies: [d.bodies[0], { ...d.bodies[0], id: 'twin', role: 'WING' }] }).ok).toBe(false)
    expect(checkHouseDescription({ ...d, bodies: [] }).ok).toBe(false)
    expect(checkHouseDescription({ ...d, mesh: [] }).ok).toBe(false)
  })

  it('compares the stated size with the figures the page publishes, in either order, and reports — never corrects', () => {
    const fig = (key: string, value: number) => ({ key, label: key, raw: String(value), value, unit: 'm' })
    const agree = checkHouseDescription(raw(), [fig('building_width', 15.5), fig('building_length', 10)])
    expect(agree.issues.map((i) => i.code)).not.toContain('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT')
    const swapped = checkHouseDescription(raw(), [fig('building_width', 10), fig('building_length', 15.5)])
    expect(swapped.issues.map((i) => i.code)).not.toContain('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT')
    const off = checkHouseDescription(raw(), [fig('building_width', 19), fig('building_length', 12)])
    expect(off.ok).toBe(true)
    expect(off.issues.map((i) => i.code)).toContain('OVERALL_DISAGREES_WITH_PUBLISHED_EXTENT')
    const area = checkHouseDescription(raw(), [fig('footprint_area', 200)])
    expect(area.issues.map((i) => i.code)).toContain('FOOTPRINT_DISAGREES_WITH_PUBLISHED_AREA')
  })

  it('a side no picture shows must be declared hypothetical', () => {
    const d = raw()
    const r = checkHouseDescription({ ...d, hypotheticalSides: [] })
    expect(r.issues.map((i) => i.code)).toContain('SIDE_NOT_SHOWN_NOT_DECLARED')
  })
})
