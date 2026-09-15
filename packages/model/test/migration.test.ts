import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIGRATION_NOTE_1_0_0,
  MIGRATION_NOTE_1_1_0,
  MIGRATION_NOTE_1_2_0,
  MODEL_SCHEMA_VERSION,
  createEmptyModel,
  loadModel,
  migrateModelInput,
  serializeModel,
  validateModel,
} from '../src/index.js'

/** The BuildApp demo house exactly as STAGE BUILDAPP-00 persisted it (schema 1.0.0, hand-trimmed corners, no topology). */
const FIXTURE_1_0_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.0.0.json')
/** The same house as STAGE BUILDAPP-00A persisted it (schema 1.1.0, junctions and rings, no roof openings). */
const FIXTURE_1_1_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.1.0.json')
/** The same house as STAGE BUILDAPP-01 persisted it (schema 1.2.0, roof-opening collections, no surface regions). */
const FIXTURE_1_2_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.2.0.json')
const text = (p: string): string => readFileSync(p, 'utf8')

describe('schema evolution 1.0.0 -> 1.1.0 -> 1.2.0 -> 1.3.0', () => {
  it('the current schema version is 1.3.0 and new models carry empty topology, roof-opening and surface-region collections', () => {
    expect(MODEL_SCHEMA_VERSION).toBe('1.3.0')
    const m = createEmptyModel('x', 'x')
    expect(m.schemaVersion).toBe('1.3.0')
    expect(m.wallJunctions).toEqual([])
    expect(m.wallRings).toEqual([])
    expect(m.roofOpenings).toEqual([])
    expect(m.rooflights).toEqual([])
    expect(m.surfaceRegions).toEqual([])
    expect(validateModel(m).issues).toEqual([])
  })

  it('a BUILDAPP-00 file (1.0.0) loads through three explicit, reported migration steps and keeps every object', () => {
    const raw = JSON.parse(text(FIXTURE_1_0_0)) as { schemaVersion: string; walls: unknown[]; wallJunctions?: unknown }
    expect(raw.schemaVersion).toBe('1.0.0')
    expect(raw.wallJunctions).toBeUndefined()
    const r = loadModel(text(FIXTURE_1_0_0))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues.map((i) => [i.code, i.severity])).toEqual([
      ['SCHEMA_MIGRATED', 'WARNING'],
      ['SCHEMA_MIGRATED', 'WARNING'],
      ['SCHEMA_MIGRATED', 'WARNING'],
    ])
    expect(r.model.schemaVersion).toBe('1.3.0')
    expect(r.model.wallJunctions).toEqual([])
    expect(r.model.wallRings).toEqual([])
    expect(r.model.roofOpenings).toEqual([])
    expect(r.model.rooflights).toEqual([])
    expect(r.model.surfaceRegions).toEqual([])
    expect(r.model.meta.notes).toContain(MIGRATION_NOTE_1_0_0)
    expect(r.model.meta.notes).toContain(MIGRATION_NOTE_1_1_0)
    expect(r.model.meta.notes).toContain(MIGRATION_NOTE_1_2_0)
    expect(r.model.walls).toHaveLength(raw.walls.length)
    expect(r.model.walls.map((w) => w.id).sort()).toEqual(
      ['g-front', 'g-right', 'g-rear', 'g-left', 'g-partition', 'gar-front', 'gar-right', 'gar-rear', 'u-front', 'u-right', 'u-rear', 'u-left'].sort(),
    )
    // the hand-trimmed 1.0.0 walls are still consistent under the overlap rule
    expect(r.issues.some((i) => i.code === 'WALLS_OVERLAP')).toBe(false)
    // re-saving writes a 1.3.0 file that loads without any migration
    const saved = serializeModel(r.model)
    expect(saved).toContain('"schemaVersion": "1.3.0"')
    const again = loadModel(saved)
    expect(again.ok && again.issues).toEqual([])
  })

  it('a BUILDAPP-00A file (1.1.0) loads through two explicit, reported migration steps: openings keep level heads and single leaves', () => {
    const raw = JSON.parse(text(FIXTURE_1_1_0)) as { schemaVersion: string; openings: Array<Record<string, unknown>>; roofOpenings?: unknown; wallJunctions: unknown[] }
    expect(raw.schemaVersion).toBe('1.1.0')
    expect(raw.roofOpenings).toBeUndefined()
    expect(raw.wallJunctions.length).toBeGreaterThan(0)
    const r = loadModel(text(FIXTURE_1_1_0))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues.map((i) => [i.code, i.severity])).toEqual([
      ['SCHEMA_MIGRATED', 'WARNING'],
      ['SCHEMA_MIGRATED', 'WARNING'],
    ])
    expect(r.model.schemaVersion).toBe('1.3.0')
    expect(r.model.roofOpenings).toEqual([])
    expect(r.model.rooflights).toEqual([])
    expect(r.model.surfaceRegions).toEqual([])
    expect(r.model.meta.notes).toEqual([MIGRATION_NOTE_1_1_0, MIGRATION_NOTE_1_2_0])
    expect(r.model.wallJunctions).toHaveLength(raw.wallJunctions.length)
    expect(r.model.openings).toHaveLength(raw.openings.length)
    for (const o of r.model.openings) {
      expect(o.head).toBeUndefined()
      expect(o.leaves).toBeUndefined()
    }
    const saved = serializeModel(r.model)
    expect(saved).toContain('"schemaVersion": "1.3.0"')
    expect(loadModel(saved).issues).toEqual([])
  })

  it('a BUILDAPP-01 file (1.2.0) loads through one explicit, reported migration step: slabs solid, roof cuts vertical, doors one leaf, stairs placeholders', () => {
    const raw = JSON.parse(text(FIXTURE_1_2_0)) as { schemaVersion: string; surfaceRegions?: unknown; slabs: Array<Record<string, unknown>>; doors: Array<Record<string, unknown>>; stairs: Array<Record<string, unknown>> }
    expect(raw.schemaVersion).toBe('1.2.0')
    expect(raw.surfaceRegions).toBeUndefined()
    const r = loadModel(text(FIXTURE_1_2_0))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues.map((i) => [i.code, i.severity])).toEqual([['SCHEMA_MIGRATED', 'WARNING']])
    expect(r.model.schemaVersion).toBe('1.3.0')
    expect(r.model.surfaceRegions).toEqual([])
    expect(r.model.meta.notes).toEqual([MIGRATION_NOTE_1_2_0])
    expect(r.model.slabs).toHaveLength(raw.slabs.length)
    for (const s of r.model.slabs) expect(s.holes).toBeUndefined()
    for (const o of r.model.roofOpenings) expect(o.cut).toBeUndefined()
    for (const d of r.model.doors) expect(d.assembly).toBeUndefined()
    for (const s of r.model.stairs) expect(s.kind).toBe('PLACEHOLDER')
    const saved = serializeModel(r.model)
    expect(saved).toContain('"schemaVersion": "1.3.0"')
    expect(loadModel(saved).issues).toEqual([])
  })

  it('a file that states an older version but already carries newer collections is refused', () => {
    const old = JSON.parse(text(FIXTURE_1_0_0)) as Record<string, unknown>
    old.wallJunctions = []
    const r1 = validateModel(old)
    expect(r1.ok).toBe(false)
    expect(r1.issues[0]).toMatchObject({ code: 'SCHEMA', path: 'schemaVersion' })
    const mid = JSON.parse(text(FIXTURE_1_1_0)) as Record<string, unknown>
    mid.rooflights = []
    const r2 = validateModel(mid)
    expect(r2.ok).toBe(false)
    expect(r2.issues[0]).toMatchObject({ code: 'SCHEMA', path: 'schemaVersion' })
    expect(r2.issues[0].message).toContain('rooflights')
    const oldest = JSON.parse(text(FIXTURE_1_0_0)) as Record<string, unknown>
    oldest.roofOpenings = []
    expect(validateModel(oldest).issues[0]).toMatchObject({ code: 'SCHEMA', path: 'schemaVersion' })
    const recent = JSON.parse(text(FIXTURE_1_2_0)) as Record<string, unknown>
    recent.surfaceRegions = []
    const r3 = validateModel(recent)
    expect(r3.ok).toBe(false)
    expect(r3.issues[0]).toMatchObject({ code: 'SCHEMA', path: 'schemaVersion' })
    expect(r3.issues[0].message).toContain('surfaceRegions')
  })

  it('unknown schema versions are refused by name, never reinterpreted', () => {
    for (const v of ['0.9.0', '1.4.0', '2.0.0', 1.1]) {
      const raw = JSON.parse(text(FIXTURE_1_0_0)) as Record<string, unknown>
      raw.schemaVersion = v
      const r = validateModel(raw)
      expect(r.ok, String(v)).toBe(false)
      expect(r.issues[0].code).toBe('UNSUPPORTED_SCHEMA_VERSION')
      expect(r.issues[0].message).toContain('1.0.0, 1.1.0, 1.2.0, 1.3.0')
    }
  })

  it('migrateModelInput leaves non-models and current models alone', () => {
    expect(migrateModelInput(null).migrated).toBe(false)
    expect(migrateModelInput({ schema: 'other', schemaVersion: '1.0.0' }).migrated).toBe(false)
    const cur = migrateModelInput(createEmptyModel('x', 'x'))
    expect(cur.migrated).toBe(false)
    expect(cur.issues).toEqual([])
  })
})
