import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATION_NOTE_1_0_0, MODEL_SCHEMA_VERSION, createEmptyModel, loadModel, migrateModelInput, serializeModel, validateModel } from '../src/index.js'

/** The BuildApp demo house exactly as STAGE BUILDAPP-00 persisted it (schema 1.0.0, hand-trimmed corners, no topology). */
const FIXTURE = resolve(import.meta.dirname, 'fixtures/demo-house-1.0.0.json')
const fixtureText = (): string => readFileSync(FIXTURE, 'utf8')

describe('schema evolution 1.0.0 -> 1.1.0', () => {
  it('the current schema version is 1.1.0 and new models carry empty topology collections', () => {
    expect(MODEL_SCHEMA_VERSION).toBe('1.1.0')
    const m = createEmptyModel('x', 'x')
    expect(m.schemaVersion).toBe('1.1.0')
    expect(m.wallJunctions).toEqual([])
    expect(m.wallRings).toEqual([])
    expect(validateModel(m).issues).toEqual([])
  })

  it('a BUILDAPP-00 file (1.0.0) loads through an explicit, reported migration and keeps every object', () => {
    const raw = JSON.parse(fixtureText()) as { schemaVersion: string; walls: unknown[]; wallJunctions?: unknown }
    expect(raw.schemaVersion).toBe('1.0.0')
    expect(raw.wallJunctions).toBeUndefined()
    const r = loadModel(fixtureText())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues.map((i) => [i.code, i.severity])).toEqual([['SCHEMA_MIGRATED', 'WARNING']])
    expect(r.model.schemaVersion).toBe('1.1.0')
    expect(r.model.wallJunctions).toEqual([])
    expect(r.model.wallRings).toEqual([])
    expect(r.model.meta.notes).toContain(MIGRATION_NOTE_1_0_0)
    expect(r.model.walls).toHaveLength(raw.walls.length)
    expect(r.model.walls.map((w) => w.id).sort()).toEqual(
      ['g-front', 'g-right', 'g-rear', 'g-left', 'g-partition', 'gar-front', 'gar-right', 'gar-rear', 'u-front', 'u-right', 'u-rear', 'u-left'].sort(),
    )
    // the hand-trimmed 1.0.0 walls are still consistent under the new overlap rule
    expect(r.issues.some((i) => i.code === 'WALLS_OVERLAP')).toBe(false)
    // re-saving writes a 1.1.0 file that loads without any migration
    const saved = serializeModel(r.model)
    expect(saved).toContain('"schemaVersion": "1.1.0"')
    const again = loadModel(saved)
    expect(again.ok && again.issues).toEqual([])
  })

  it('a 1.0.0 file that already carries topology collections is refused', () => {
    const raw = JSON.parse(fixtureText()) as Record<string, unknown>
    raw.wallJunctions = []
    const r = validateModel(raw)
    expect(r.ok).toBe(false)
    expect(r.issues[0]).toMatchObject({ code: 'SCHEMA', path: 'schemaVersion' })
  })

  it('unknown schema versions are refused by name, never reinterpreted', () => {
    for (const v of ['0.9.0', '1.2.0', '2.0.0', 1.1]) {
      const raw = JSON.parse(fixtureText()) as Record<string, unknown>
      raw.schemaVersion = v
      const r = validateModel(raw)
      expect(r.ok, String(v)).toBe(false)
      expect(r.issues[0].code).toBe('UNSUPPORTED_SCHEMA_VERSION')
      expect(r.issues[0].message).toContain('1.0.0, 1.1.0')
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
