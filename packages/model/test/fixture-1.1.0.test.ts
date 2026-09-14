import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODEL_SCHEMA_VERSION, loadModel, serializeModel } from '../src/index.js'

/**
 * The BuildApp demo house exactly as STAGE BUILDAPP-00A persists it (schema
 * 1.1.0, junctions and rings). Frozen so that a future schema version has a
 * fixed 1.1.0 baseline to migrate, the way 1.0.0 was frozen before 00A.
 * `packages/demo/test` asserts the fixture equals the demo the DSL builds today.
 */
const FIXTURE = resolve(import.meta.dirname, 'fixtures/demo-house-1.1.0.json')

describe('frozen 1.1.0 fixture', () => {
  it('is the current schema version and loads without migration or issues, byte-stable', () => {
    const text = readFileSync(FIXTURE, 'utf8')
    const raw = JSON.parse(text) as { schemaVersion: string; wallJunctions: unknown[]; wallRings: unknown[] }
    expect(raw.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
    expect(raw.wallJunctions.length).toBeGreaterThan(0)
    expect(raw.wallRings.length).toBeGreaterThan(0)
    const r = loadModel(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.issues).toEqual([])
    expect(serializeModel(r.model)).toBe(text)
  })
})
