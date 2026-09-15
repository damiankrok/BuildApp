import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODEL_SCHEMA_VERSION, loadModel, serializeModel } from '../src/index.js'

/**
 * The BuildApp demo house exactly as STAGE BUILDAPP-00A persisted it (schema
 * 1.1.0, junctions and rings) and as STAGE BUILDAPP-01 persists it (schema
 * 1.2.0, roof-opening collections). Each frozen file is the fixed baseline
 * the next schema version migrates, the way 1.0.0 was frozen before 00A.
 * `packages/demo/test` asserts the current fixture equals the demo the DSL
 * builds today; `migration.test.ts` migrates the older ones.
 */
const FIXTURE_1_1_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.1.0.json')
const FIXTURE_1_2_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.2.0.json')

describe('frozen fixtures', () => {
  it('the 1.2.0 fixture is the current schema version and loads without migration or issues, byte-stable', () => {
    const text = readFileSync(FIXTURE_1_2_0, 'utf8')
    const raw = JSON.parse(text) as { schemaVersion: string; wallJunctions: unknown[]; wallRings: unknown[]; roofOpenings: unknown[]; rooflights: unknown[] }
    expect(raw.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
    expect(raw.wallJunctions.length).toBeGreaterThan(0)
    expect(raw.wallRings.length).toBeGreaterThan(0)
    expect(raw.roofOpenings).toEqual([])
    expect(raw.rooflights).toEqual([])
    const r = loadModel(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues).toEqual([])
    expect(serializeModel(r.model)).toBe(text)
  })

  it('the 1.1.0 fixture is kept as the migration baseline and is untouched', () => {
    const raw = JSON.parse(readFileSync(FIXTURE_1_1_0, 'utf8')) as { schemaVersion: string; roofOpenings?: unknown }
    expect(raw.schemaVersion).toBe('1.1.0')
    expect(raw.roofOpenings).toBeUndefined()
  })
})
