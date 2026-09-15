import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEmptyModel, serializeModel, validateModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import { FACTS, MARCOWKI_CREATED_WITH, MARCOWKI_LEDGER, MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, createMarcowkiReferenceBuilding, marcowkiCommands } from '../src/index.js'

describe('the reference model is a replay of its command stream', () => {
  it('createMarcowkiReferenceBuilding() equals runCommands(empty, marcowkiCommands()) byte for byte', () => {
    const replayed = runCommands(createEmptyModel(MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, MARCOWKI_CREATED_WITH), marcowkiCommands())
    expect(serializeModel(replayed)).toBe(serializeModel(createMarcowkiReferenceBuilding()))
    // deterministic: two builds are identical
    expect(serializeModel(createMarcowkiReferenceBuilding())).toBe(serializeModel(createMarcowkiReferenceBuilding()))
  })

  it('validates with no issues and uses the generic command vocabulary only', () => {
    const m = createMarcowkiReferenceBuilding()
    expect(validateModel(m).issues).toEqual([])
    const commands = marcowkiCommands()
    expect(commands.length).toBeGreaterThan(100)
    expect(commands.every((c) => typeof c.type === 'string' && !/mesh|geometry|triangle/i.test(c.type))).toBe(true)
  })

  it('the package source contains no renderer geometry and no triangle lists', () => {
    const dir = resolve(import.meta.dirname, '../src')
    for (const f of readdirSync(dir)) {
      const src = readFileSync(resolve(dir, f), 'utf8')
      expect(src, f).not.toMatch(/from 'three'|BufferGeometry|THREE\.|\bMesh\b|new Float32Array/)
      expect(src, f).not.toMatch(/triangles?\s*[:=]\s*\[/)
      expect(src, f).not.toMatch(/from '@buildapp\/(geometry|editor|verification)'/)
    }
  })

  it('every semantic object carries evidence with a status and cites an evidence source; every fact has a status', () => {
    const m = createMarcowkiReferenceBuilding()
    const sources = new Set(m.evidenceSources.map((s) => s.id))
    expect(sources.size).toBeGreaterThanOrEqual(12)
    const objects = [m.building!, ...m.levels, ...m.rooms, ...m.walls, ...m.openings, ...m.windows, ...m.doors, ...m.slabs, ...m.roofs, ...m.roofOpenings, ...m.rooflights, ...m.balconies, ...m.railings, ...m.chimneys, ...m.stairs, ...m.surfaceRegions]
    for (const o of objects) {
      expect(o.evidence, o.id).toBeDefined()
      expect(o.evidence!.sourceIds!.length, o.id).toBeGreaterThan(0)
      for (const s of o.evidence!.sourceIds!) expect(sources.has(s), `${o.id} cites ${s}`).toBe(true)
    }
    const statuses = new Set(objects.map((o) => o.evidence!.status))
    expect([...statuses].sort()).toEqual(['ASSUMED', 'GEOMETRIC_INFERRED', 'SOURCE_CORROBORATED', 'SOURCE_DERIVED', 'SOURCE_EXACT', 'VISUAL_INFERRED'])
    for (const [k, f] of Object.entries(FACTS)) expect(f.status, k).toBeDefined()
    expect(MARCOWKI_LEDGER.length).toBeGreaterThan(15)
  })

  it('has the semantic content the stage requires', () => {
    const m = createMarcowkiReferenceBuilding()
    expect(m.levels.map((l) => l.id)).toEqual(['ground', 'upper'])
    expect(m.wallRings.map((r) => r.id)).toEqual(['ring-ground', 'ring-upper'])
    expect(m.walls.filter((w) => w.kind === 'EXTERIOR')).toHaveLength(4 + 3 + 4 + 5)
    expect(m.walls.filter((w) => w.kind === 'INTERIOR')).toHaveLength(19)
    expect(m.openings.filter((o) => o.tags?.includes('facade'))).toHaveLength(12)
    expect(m.openings.filter((o) => o.tags?.includes('interior-door'))).toHaveLength(11)
    expect(m.openings.filter((o) => o.head?.kind === 'RAKED')).toHaveLength(3)
    expect(m.roofs.map((r) => [r.id, r.kind])).toEqual([['roof-main', 'GABLE'], ['roof-garage', 'FLAT']])
    expect(m.roofOpenings.filter((o) => o.kind === 'ROOFLIGHT')).toHaveLength(3)
    expect(m.roofOpenings.filter((o) => o.kind === 'PENETRATION')).toHaveLength(2)
    expect(m.rooflights).toHaveLength(3)
    expect(m.chimneys).toHaveLength(2)
    expect(m.balconies.filter((b) => b.kind === 'BALCONY')).toHaveLength(2)
    expect(m.balconies.filter((b) => b.kind === 'TERRACE').map((b) => b.id).sort()).toEqual(['terrace-front-portal', 'terrace-rear-loggia'])
    expect(m.railings).toHaveLength(2)
    expect(m.surfaceRegions).toHaveLength(6)
    expect(m.stairs[0].kind).toBe('FLIGHTS')
    expect(m.slabs.find((x) => x.id === 'slab-upper')!.holes).toHaveLength(1)
    expect(m.roofOpenings.filter((o) => o.cut === 'NORMAL_TO_ROOF')).toHaveLength(3)
    expect(m.doors.filter((d) => d.assembly).map((d) => d.id).sort()).toEqual(['og-front-entrance-leaf', 'og-garage-door-leaf', 'og-garage-side-door-leaf'])
    expect(m.slabs.map((s) => s.id).sort()).toEqual(['portal-head', 'slab-ground', 'slab-upper'])
    expect(m.rooms).toHaveLength(18)
    expect(m.stairs).toHaveLength(1)
    expect(m.windows).toHaveLength(8)
    expect(m.doors).toHaveLength(4 + 11)
    expect(m.wallJunctions.length).toBeGreaterThanOrEqual(8 + 3 + 5 + 28) // ring corners, garage, returns, partition ends
  })
})
