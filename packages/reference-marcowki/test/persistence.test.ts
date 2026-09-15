import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODEL_SCHEMA_VERSION, loadModel, serializeModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, createMarcowkiReferenceBuilding } from '../src/index.js'

/**
 * The frozen Marcówki file lives with the model package's fixtures so the
 * model and geometry packages can load and compile it WITHOUT importing this
 * package (`packages/model/test/marcowki-fixture.test.ts`,
 * `packages/geometry/test/marcowki-fixture.test.ts`). This test pins the file
 * to what the command stream builds today: a change to the reference model
 * must regenerate the fixture in the same commit.
 */
const FIXTURE = resolve(import.meta.dirname, '../../model/test/fixtures/marcowki-ge-1.3.0.json')

describe('Marcówki persistence', () => {
  it('saves through the normal deterministic serializer and reloads byte for byte with every id kept', () => {
    const m = createMarcowkiReferenceBuilding()
    const json = serializeModel(m)
    expect(json.startsWith('{\n')).toBe(true)
    const back = loadModel(json)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.issues).toEqual([])
    expect(serializeModel(back.model)).toBe(json)
    const ids = (text: string): string[] => text.match(/"id": "[^"]+"/g)!.sort()
    expect(ids(serializeModel(back.model))).toEqual(ids(json))
    expect(back.model.id).toBe(MARCOWKI_MODEL_ID)
    expect(back.model.name).toBe(MARCOWKI_MODEL_NAME)
    expect(back.model.schemaVersion).toBe(MODEL_SCHEMA_VERSION)
  })

  it('equals the frozen fixture packages/model/test/fixtures/marcowki-ge-1.3.0.json', () => {
    expect(serializeModel(createMarcowkiReferenceBuilding())).toBe(readFileSync(FIXTURE, 'utf8'))
  })

  it('the scene compiled from the reloaded JSON is the scene compiled from the factory model', () => {
    const factory = compileBuilding(createMarcowkiReferenceBuilding())
    const loaded = loadModel(readFileSync(FIXTURE, 'utf8'))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const fromFile = compileBuilding(loaded.model)
    expect(fromFile.diagnostics).toEqual([])
    expect(fromFile.stats).toEqual(factory.stats)
    expect(fromFile.bounds).toEqual(factory.bounds)
    expect(fromFile).toEqual(factory)
  })
})
