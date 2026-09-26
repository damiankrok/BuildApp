import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODEL_SCHEMA_VERSION, loadModel, serializeModel, validateModel } from '../src/index.js'

/**
 * The Marcówki reference model as a plain saved file. This package never
 * imports `@buildapp/reference-marcowki`: the file must be an ordinary
 * CanonicalBuildingModel that loads through the generic loader alone.
 */
const FIXTURE = resolve(import.meta.dirname, 'fixtures/marcowki-ge-1.5.0.json')
const BASELINE_1_2_0 = resolve(import.meta.dirname, 'fixtures/marcowki-ge-1.2.0.json')

describe('Marcówki fixture loads without the reference package', () => {
  it('is a current-schema model that validates with no issues and is byte-stable', () => {
    const text = readFileSync(FIXTURE, 'utf8')
    const raw = JSON.parse(text) as { schemaVersion: string; id: string; name: string }
    expect(raw.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
    expect(raw.id).toBe('marcowki-ge')
    expect(raw.name).toBe('Dom w marcówkach (GE)')
    const r = loadModel(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues).toEqual([])
    expect(validateModel(r.model).issues).toEqual([])
    expect(serializeModel(r.model)).toBe(text)
  })

  it('carries the stage’s semantic content as ordinary records', () => {
    const r = loadModel(readFileSync(FIXTURE, 'utf8'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m = r.model
    expect(m.levels).toHaveLength(2)
    expect(m.wallRings).toHaveLength(2)
    expect(m.walls).toHaveLength(16 + 19)
    expect(m.openings).toHaveLength(12 + 11)
    expect(m.openings.filter((o) => o.head?.kind === 'RAKED')).toHaveLength(3)
    expect(m.roofs).toHaveLength(2)
    expect(m.roofOpenings).toHaveLength(5)
    expect(m.rooflights).toHaveLength(3)
    expect(m.chimneys).toHaveLength(2)
    expect(m.balconies).toHaveLength(2 + 2)
    expect(m.railings).toHaveLength(2)
    expect(m.rooms).toHaveLength(18)
    expect(m.stairs).toHaveLength(1)
    expect(m.evidenceSources.length).toBeGreaterThanOrEqual(12)
    // every object cites evidence with a status the schema knows
    for (const w of m.walls) expect(w.evidence?.status, w.id).toBeDefined()
    // the 1.3.0 capabilities as ordinary records: a FLIGHTS stair, a slab hole, normal roof cuts, door assemblies, surface regions
    expect(m.stairs[0].kind).toBe('FLIGHTS')
    if (m.stairs[0].kind === 'FLIGHTS') expect(m.stairs[0].segments.map((s) => s.kind)).toEqual(['FLIGHT', 'WINDER', 'FLIGHT'])
    expect(m.slabs.find((s) => s.holes && s.holes.length > 0)?.holes?.[0]).toHaveLength(6)
    expect(m.roofOpenings.filter((o) => o.cut === 'NORMAL_TO_ROOF')).toHaveLength(3)
    expect(m.doors.filter((d) => d.assembly)).toHaveLength(3)
    expect(m.surfaceRegions).toHaveLength(6)
  })

  it('the 1.2.0 Marcówki file (the STAGE BUILDAPP-01 freeze) migrates through three explicit steps and keeps its placeholder stair', () => {
    const r = loadModel(readFileSync(BASELINE_1_2_0, 'utf8'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues.map((i) => i.code)).toEqual(['SCHEMA_MIGRATED', 'SCHEMA_MIGRATED', 'SCHEMA_MIGRATED'])
    expect(r.model.terraces).toEqual([])
    expect(r.model.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
    expect(r.model.surfaceRegions).toEqual([])
    expect(r.model.stairs[0].kind).toBe('PLACEHOLDER')
    expect(r.model.slabs.every((s) => s.holes === undefined)).toBe(true)
    expect(r.model.roofOpenings.every((o) => o.cut === undefined)).toBe(true)
    expect(validateModel(r.model).issues).toEqual([])
  })
})
