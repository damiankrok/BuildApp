/**
 * The seventeen synthetic architectural diversity fixtures (stage 03G §22):
 * each one's semantic objects, relationships, DSL replay, compiled geometry
 * and closure audit.
 */
import { describe, expect, it } from 'vitest'
import { assemblyGraph, assemblyTree, CAPABILITY_KEYS, CAPABILITY_REGISTRY, classifyRoofGraph, roofGraphSvg } from '../src/index.js'
import { ALL_DEMOS, ALL_FIXTURES, runFixture } from '../src/fixtures/index.js'

describe('the synthetic architectural diversity fixtures', () => {
  it('are the seventeen the stage names, with unique ids', () => {
    expect(ALL_FIXTURES.map((f) => f.id)).toEqual([
      'roof-gable',
      'roof-hip',
      'roof-shed',
      'roof-flat-parapet',
      'roof-intersecting-gables',
      'roof-stepped-levels',
      'roof-dormer-gable',
      'roof-dormer-shed',
      'exterior-balcony',
      'exterior-loggia',
      'exterior-terrace',
      'exterior-entrance-canopy',
      'exterior-carport',
      'exterior-pergola',
      'exterior-open-canopy',
      'exterior-entrance-steps',
      'unknown-feature',
    ])
  })

  it.each(ALL_FIXTURES.map((f) => [f.id, f] as const))('%s: validates, replays, round-trips, compiles and closes', (_id, f) => {
    const { run, model, roofGraphs } = runFixture(f)
    expect(run.failures).toEqual([])
    expect(run.replayDeterministic).toBe(true)
    expect(run.roundTrip).toBe(true)
    expect(run.validation.errors).toBe(0)
    expect(run.compile.errors).toEqual([])
    expect(run.closure.exteriorErrors).toBe(0)
    expect(run.closure.architecture?.relationshipsSatisfied).toBe(run.closure.architecture?.relationshipsChecked)
    expect(run.closure.architecture?.roofJoinsClosed).toBe(run.closure.architecture?.roofJoinsChecked)
    // every fixture states what it is: assemblies, and relationships between its objects
    expect(model.assemblies.length).toBeGreaterThan(0)
    expect(model.relationships.length).toBeGreaterThanOrEqual(f.expect.minRelationships)
    // the roof graph artifact and the assembly graph are produced for every fixture
    expect(roofGraphSvg(f.title, roofGraphs)).toMatch(/^<svg /)
    expect(assemblyTree(model).length).toBeGreaterThan(0)
    expect(assemblyGraph(model).edges.length).toBeGreaterThan(0)
  })

  it('every capability proves itself with fixtures or demos that exist', () => {
    const fixtureIds = new Set(ALL_FIXTURES.map((f) => f.id))
    const demoIds = new Set(ALL_DEMOS.map((d) => d.id))
    expect(CAPABILITY_REGISTRY.map((c) => c.key)).toEqual([...CAPABILITY_KEYS])
    for (const c of CAPABILITY_REGISTRY) {
      for (const f of c.fixtures) expect(fixtureIds.has(f), `${c.key} names fixture ${f}`).toBe(true)
      for (const d of c.demos) expect(demoIds.has(d), `${c.key} names demo ${d}`).toBe(true)
      if (c.status === 'SUPPORTED') expect(c.fixtures.length, `${c.key} is SUPPORTED but no fixture proves it`).toBeGreaterThan(0)
    }
    for (const f of ALL_FIXTURES) for (const k of f.capabilities) expect(CAPABILITY_KEYS).toContain(k)
  })

  it('a roof is classified from its plane graph, not from a label', () => {
    for (const f of ALL_FIXTURES) {
      for (const g of runFixture(f).roofGraphs) {
        expect(g.derivedClassification, `${f.id} ${g.id}`).toBe(classifyRoofGraph(g))
        if (g.source === 'ROOF_ASSEMBLY') expect(g.classification, `${f.id} ${g.id}`).toBe(g.derivedClassification)
      }
    }
  })
})
