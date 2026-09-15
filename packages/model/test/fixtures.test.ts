import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODEL_SCHEMA_VERSION, loadModel, serializeModel } from '../src/index.js'

/**
 * The BuildApp demo house exactly as each stage persisted it: STAGE
 * BUILDAPP-00A (schema 1.1.0, junctions and rings), STAGE BUILDAPP-01
 * (1.2.0, roof-opening collections), STAGE BUILDAPP-01A (1.3.0, the
 * surfaceRegions collection) and STAGE BUILDAPP-03 (1.4.0, the linearSolids
 * collection). Each frozen file is the fixed baseline the next
 * schema version migrates, the way 1.0.0 was frozen before 00A.
 * `packages/demo/test` asserts the current fixture equals the demo the DSL
 * builds today; `migration.test.ts` migrates the older ones.
 */
const FIXTURE_1_1_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.1.0.json')
const FIXTURE_1_2_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.2.0.json')
const FIXTURE_1_3_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.3.0.json')
const FIXTURE_1_4_0 = resolve(import.meta.dirname, 'fixtures/demo-house-1.4.0.json')

describe('frozen fixtures', () => {
  it('the 1.4.0 fixture is the current schema version and loads without migration or issues, byte-stable', () => {
    const text = readFileSync(FIXTURE_1_4_0, 'utf8')
    const raw = JSON.parse(text) as { schemaVersion: string; wallJunctions: unknown[]; wallRings: unknown[]; roofOpenings: unknown[]; rooflights: unknown[]; surfaceRegions: unknown[]; linearSolids: unknown[] }
    expect(raw.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
    expect(raw.wallJunctions.length).toBeGreaterThan(0)
    expect(raw.wallRings.length).toBeGreaterThan(0)
    expect(raw.roofOpenings).toEqual([])
    expect(raw.rooflights).toEqual([])
    expect(raw.surfaceRegions).toEqual([])
    expect(raw.linearSolids).toEqual([])
    const r = loadModel(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues).toEqual([])
    expect(serializeModel(r.model)).toBe(text)
  })

  it('the 1.1.0, 1.2.0 and 1.3.0 fixtures are kept as migration baselines and are untouched', () => {
    const raw11 = JSON.parse(readFileSync(FIXTURE_1_1_0, 'utf8')) as { schemaVersion: string; roofOpenings?: unknown }
    expect(raw11.schemaVersion).toBe('1.1.0')
    expect(raw11.roofOpenings).toBeUndefined()
    const raw12 = JSON.parse(readFileSync(FIXTURE_1_2_0, 'utf8')) as { schemaVersion: string; roofOpenings?: unknown; surfaceRegions?: unknown }
    expect(raw12.schemaVersion).toBe('1.2.0')
    expect(raw12.roofOpenings).toEqual([])
    expect(raw12.surfaceRegions).toBeUndefined()
    const raw13 = JSON.parse(readFileSync(FIXTURE_1_3_0, 'utf8')) as { schemaVersion: string; surfaceRegions?: unknown; linearSolids?: unknown }
    expect(raw13.schemaVersion).toBe('1.3.0')
    expect(raw13.surfaceRegions).toEqual([])
    expect(raw13.linearSolids).toBeUndefined()
  })
})
