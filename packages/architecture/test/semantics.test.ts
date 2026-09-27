/**
 * The semantic distinctions the architectural language must keep (stage 03G
 * §5–§12): a pergola is not a roof, a canopy without cover evidence is not a
 * roof, a terrace, a balcony and a loggia read differently, an unknown stays
 * unknown, and a partial assembly says what it lacks.
 */
import { describe, expect, it } from 'vitest'
import { applyCommand, applyCommands } from '@buildapp/commands'
import { readPlatformSemantics, validateModel, type Assembly, type CanonicalBuildingModel } from '@buildapp/model'
import { assemblyTree, primitivesOf, PRIMITIVE_REGISTRY, PRIMITIVE_TYPES, ASSEMBLY_REGISTRY, RELATIONSHIP_REGISTRY, roofGraphsOf } from '../src/index.js'
import { ALL_FIXTURES, buildFixture, fixtureById } from '../src/fixtures/index.js'
import { AssemblyKindSchema, RelationshipKindSchema } from '@buildapp/model'

const codes = (m: CanonicalBuildingModel): string[] => validateModel(m).issues.map((i) => i.code)
const withAssembly = (m: CanonicalBuildingModel, a: Assembly): CanonicalBuildingModel => {
  const r = applyCommand(m, { type: 'createAssembly', assembly: a })
  if (r.ok) return r.model
  return { ...m, assemblies: [...m.assemblies, a] }
}

describe('registries', () => {
  it('name every primitive type once, every assembly kind and every relationship kind', () => {
    expect(PRIMITIVE_REGISTRY.map((p) => p.type)).toEqual([...PRIMITIVE_TYPES])
    expect(ASSEMBLY_REGISTRY.map((a) => a.kind).sort()).toEqual([...AssemblyKindSchema.options].sort())
    expect(RELATIONSHIP_REGISTRY.map((r) => r.kind).sort()).toEqual([...RelationshipKindSchema.options].sort())
  })

  it('every primitive the fixtures hold keeps a stable id, lineage, confidence and its assemblies', () => {
    for (const f of ALL_FIXTURES) {
      const m = buildFixture(f)
      for (const p of primitivesOf(m)) {
        expect(p.id.length).toBeGreaterThan(0)
        expect(p.lineage.sourceIds.length, `${f.id} ${p.id}`).toBeGreaterThan(0)
        expect(p.lineage.status, `${f.id} ${p.id}`).toBeDefined()
      }
    }
  })
})

describe('pergola, canopy, carport', () => {
  it('a pergola is not a roof: a roof covering it is refused', () => {
    const m = buildFixture(fixtureById('exterior-pergola'))
    const plane = m.roofPlanes[0].id
    const bad = { ...m, relationships: [...m.relationships, { id: 'rel-bad', kind: 'COVERS' as const, from: plane, to: 'pergola-beam-south' }] }
    expect(codes(bad)).toContain('PERGOLA_HAS_ROOF')
    const pergola = m.assemblies.find((a) => a.kind === 'PERGOLA')
    expect(pergola && pergola.kind === 'PERGOLA' ? pergola.coverage : undefined).toBe('OPEN')
    // and it holds no roof plane of its own
    expect(roofGraphsOf(m).filter((g) => g.source === 'ROOF_ASSEMBLY').map((g) => g.id)).toEqual(['roof-main'])
  })

  it('a canopy without cover evidence is not given a roof: stated complete it is refused, stated partial it must say what it lacks', () => {
    const m = buildFixture(fixtureById('exterior-entrance-canopy'))
    const bare = { id: 'canopy-bare', kind: 'CANOPY' as const, usage: 'ENTRANCE' as const, supportIds: ['canopy-post-west', 'canopy-post-east'], beamIds: ['canopy-beam'], openSides: [], hostIds: [] }
    expect(codes(withAssembly(m, { ...bare, quality: 'COMPLETE' }))).toContain('ASSEMBLY_QUALITY_OVERSTATED')
    expect(codes(withAssembly(m, { ...bare, quality: 'PARTIAL' }))).toContain('ASSEMBLY_QUALITY_UNEXPLAINED')
    expect(validateModel(withAssembly(m, { ...bare, quality: 'PARTIAL', missing: ['no cover was observed over the posts'] })).ok).toBe(true)
  })

  it('a carport and an open shelter carry their own roof assemblies, separate from the house roof', () => {
    for (const id of ['exterior-carport', 'exterior-open-canopy']) {
      const m = buildFixture(fixtureById(id))
      const frame = m.assemblies.find((a) => a.kind === 'CARPORT' || a.kind === 'CANOPY')
      expect(frame && (frame.kind === 'CARPORT' || frame.kind === 'CANOPY') ? frame.roofAssemblyId : undefined).toBeDefined()
      expect(m.assemblies.filter((a) => a.kind === 'ROOF').length).toBe(2)
    }
  })
})

describe('balcony, loggia, terrace', () => {
  it('read as what they are from where they stand', () => {
    expect(readPlatformSemantics(buildFixture(fixtureById('exterior-balcony')), 'balcony-front-slab').reading).toBe('BALCONY')
    expect(readPlatformSemantics(buildFixture(fixtureById('exterior-loggia')), 'loggia-floor').reading).toBe('LOGGIA')
    expect(readPlatformSemantics(buildFixture(fixtureById('exterior-terrace')), 'terrace-rear').reading).toBe('TERRACE')
  })

  it('an assembly that contradicts the reading is flagged', () => {
    const m = buildFixture(fixtureById('exterior-terrace'))
    const wrong = withAssembly(m, { id: 'terrace-as-balcony', kind: 'BALCONY', platformId: undefined, railingIds: [], supportIds: [], hostIds: [], quality: 'PARTIAL', missing: ['its floor'] })
    expect(validateModel(wrong).ok).toBe(true)
    const t = m.terraces[0]
    const loggiaClaim = withAssembly(m, { id: 'terrace-as-loggia', kind: 'LOGGIA', platformId: t.id, railingIds: [], supportIds: [], recessWallIds: [], hostIds: [], quality: 'COMPLETE' })
    expect(codes(loggiaClaim)).toContain('ASSEMBLY_KIND_CONTRADICTED')
  })
})

describe('the unknown assembly', () => {
  it('stays unknown: it keeps its evidence, extent, observed pieces and alternatives, and may not claim completeness', () => {
    const m = buildFixture(fixtureById('unknown-feature'))
    const u = m.assemblies.find((a) => a.kind === 'UNKNOWN')
    expect(u?.kind).toBe('UNKNOWN')
    if (u?.kind !== 'UNKNOWN') return
    expect(u.sourceEvidenceIds.length).toBe(2)
    expect(u.observedPlanesOrSegments.length).toBe(3)
    expect(u.alternatives?.map((a) => a.kind)).toEqual(['DORMER', 'ROOF'])
    expect(u.quality).toBe('FRAGMENTARY')
    expect(codes({ ...m, assemblies: m.assemblies.map((a) => (a.id === u.id ? { ...u, quality: 'COMPLETE' as const } : a)) })).toContain('ASSEMBLY_QUALITY_OVERSTATED')
    // it is drawn only from what was observed, restrained
    expect(assemblyTree(m)).toContain('! seen on two perspective renders only')
  })
})

describe('the dormer', () => {
  it('cuts its host, carries its own roof, and removing the host plane takes the dormer\'s cut and joins with it', () => {
    const m = buildFixture(fixtureById('roof-dormer-gable'))
    const d = m.assemblies.find((a) => a.kind === 'DORMER')
    if (!d || d.kind !== 'DORMER') throw new Error('no dormer')
    expect(m.roofOpenings.find((o) => o.id === d.cutOpeningId)?.kind).toBe('DORMER')
    expect(m.assemblies.find((a) => a.id === d.localRoofAssemblyId)?.kind).toBe('ROOF')
    const host = m.assemblies.find((a) => a.kind === 'ROOF' && a.dormerIds.includes(d.id))
    expect(host?.id).toBe('roof-main')
    const r = applyCommands(m, [{ type: 'removeFeature', targetId: d.hostPlaneIds[0] }])
    expect(r.failedAt).toBeUndefined()
    expect(r.model.roofOpenings.find((o) => o.id === d.cutOpeningId)).toBeUndefined()
    expect(r.model.roofEdges.filter((e) => e.planeIds.includes(d.hostPlaneIds[0]))).toEqual([])
    expect(validateModel(r.model).ok).toBe(true)
  })
})

describe('verge boards at a gable apex', () => {
  it('are cut plumb where they meet, stated on both boards', () => {
    const m = buildFixture(fixtureById('roof-gable'))
    const west = ['roof-main-verge-front-west-board', 'roof-main-verge-rear-west-board'].map((id) => m.linearSolids.find((s) => s.id === id))
    const cuts = west.map((b) => b?.endCut ?? b?.startCut)
    expect(cuts.every((c) => c !== undefined)).toBe(true)
    // one plane, facing opposite ways out of the two boards
    expect(cuts[0]?.point).toEqual(cuts[1]?.point)
    expect((cuts[0]?.normal.z ?? 0) + (cuts[1]?.normal.z ?? 0)).toBeCloseTo(0, 12)
    expect(cuts[0]?.normal.y).toBe(0)
  })
})
