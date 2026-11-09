import { describe, expect, it } from 'vitest'
import { evaluateLayoutGate, inferRoofSystems, rectangleRing, ridgeAxisFromRise, sealStructuralLayout, statedKind, statedPitch, structuralLayoutContentHash } from '../src/index.js'
import type { MassHypothesis, MetricEvidenceSet, RoofLevels } from '../src/index.js'
import { metricsOf } from './plan.js'

const mass = (id: string, x0: number, z0: number, x1: number, z1: number, from: number, to: number): MassHypothesis => ({
  id,
  role: from === to ? 'ATTACHED' : 'MAIN',
  ring: rectangleRing(x0, z0, x1, z1),
  footprintRegionIds: [`footprint-${id}`],
  storeySpan: { fromIndex: from, toIndex: to, storeyIds: ['storey-0'] },
  facadePlaneIds: [],
  widthM: { value: x1 - x0, low: x1 - x0, high: x1 - x0, unit: 'm', basis: 'DERIVED', evidenceIds: [], why: 'fixture' },
  depthM: { value: z1 - z0, low: z1 - z0, high: z1 - z0, unit: 'm', basis: 'DERIVED', evidenceIds: [], why: 'fixture' },
  observationIds: [],
  evidenceIds: [],
  confidence: 0.8,
  why: 'fixture',
})

const withSpec = (angleDeg: number | undefined, kind: string | undefined): MetricEvidenceSet => {
  const set = metricsOf([], [])
  if (angleDeg !== undefined) {
    set.evidence.push({
      id: 'metric-angle',
      kind: 'ANGLE',
      frameId: 'frame-published-page',
      assetId: 'asset-published-page',
      variantByteHash: 'a'.repeat(64),
      value: angleDeg,
      unit: 'deg',
      origin: 'READ',
      rawText: `${angleDeg} st.`,
      association: { kind: 'PUBLISHED_SPECIFICATION', score: 0.9, why: 'printed in the specification', observationIds: [] },
      ocrTokenIds: [],
      observationIds: [],
      alternatives: [],
      confidence: 0.92,
      provenance: { extractor: 'PACKAGE_METADATA', name: 'test', detail: 'fixture' },
    })
  }
  if (kind !== undefined) set.specificationFindings.push({ key: 'roof', subject: 'ROOF_KIND', value: kind, quote: 'fixture', confidence: 0.9, why: 'fixture' })
  return set
}

const LEVELS: RoofLevels = { floors: [0, 3], heights: [3, 1.6], eaves: 4.6, topDatum: 7.9, evidenceIds: ['metric-level-a', 'metric-level-b'], measured: true }

/**
 * §8: the ridge runs along the axis whose span reproduces the height the
 * section measured. Not along the long side because roofs usually do.
 */
describe('which way the ridge runs', () => {
  it('takes the span the measured rise agrees with', () => {
    // 8 m across at 40 degrees rises 3.36 m; 12 m across would rise 5.03 m.
    const answer = ridgeAxisFromRise(8, 12, 40, 3.36, 0.3)
    expect(answer?.axis).toBe('Z')
    expect(answer?.residual).toBeLessThan(0.05)
    expect(answer?.ambiguous).toBe(false)
  })

  it('takes the other one when the rise says so', () => {
    expect(ridgeAxisFromRise(8, 12, 40, 5.03, 0.3)?.axis).toBe('X')
  })

  it('says nothing when neither span fits', () => {
    expect(ridgeAxisFromRise(8, 12, 40, 9, 0.3)).toBeUndefined()
  })

  // E13 (Aurory: 12 × 9.2 m, 40°, eaves +3,35 at the lip, ridge +8,34; Azalie: 10.35 × 6.7 m, eaves +3,73, ridge +7,70)
  it('an eaves mark at the lip of an overhang: the wider span can match the rise by coincidence, so the rise says nothing', () => {
    const aurory = ridgeAxisFromRise(12, 9.2, 40, 4.99, 0.45)
    expect(aurory?.ambiguous).toBe(true)
    const azalie = ridgeAxisFromRise(10.35, 6.7, 40, 3.97, 0.45)
    expect(azalie?.ambiguous).toBe(true)
  })
  it('counter: a rise the narrower span cannot reach without an impossible overhang (beyond 1.6 m) is decided', () => {
    // 12 m across rises 5.03 m; the 8 m span would need a 2.0 m overhang for it
    expect(ridgeAxisFromRise(8, 12, 40, 5.03, 0.45)?.ambiguous).toBe(false)
    // a rise below what the wider span gives at the walls: only the narrower span, with some overhang
    expect(ridgeAxisFromRise(8, 12, 40, 3.8, 0.45)?.axis).toBe('Z')
  })
  it('admits it when a square building makes both fit', () => {
    expect(ridgeAxisFromRise(10, 10, 35, 3.5, 0.3)?.ambiguous).toBe(true)
  })
})

describe('roof systems, one per mass', () => {
  const masses = [mass('mass-0', 0, 0, 8, 12.6, 0, 1), mass('mass-1', 8, 5, 12, 12.6, 0, 0)]
  const result = inferRoofSystems({ masses, metrics: withSpec(40, 'GABLE'), levels: LEVELS, storeyTop: (i) => (i === 0 ? 3 : 4.6) })

  it('gives each mass its own roof rather than one over the bounds', () => {
    expect(result.roofs.length).toBe(2)
    expect(new Set(result.roofs.map((r) => r.massId))).toEqual(new Set(['mass-0', 'mass-1']))
  })

  it('keeps the printed pitch exactly', () => {
    const main = result.roofs.find((r) => r.massId === 'mass-0')
    expect(main?.pitchDeg?.value).toBe(40)
    expect(main?.authority).toBe('PUBLISHED_SPECIFICATION')
    expect(main?.kind).toBe('GABLE')
  })

  it('does not put the main roof over the attached body', () => {
    const wing = result.roofs.find((r) => r.massId === 'mass-1')
    expect(wing?.kind).toBe('FLAT')
    expect(wing?.authority).toBe('CONVENTION')
    expect(result.unresolved.some((u) => u.what.includes('mass-1'))).toBe(true)
  })

  it('reports the residual instead of bending the angle to fit the height', () => {
    // A 40 degree roof over 8 m rises 3.36 m, so the ridge should be at 7.96 —
    // the fixture's section says 7.9, and the pitch must not move to close it.
    const main = result.roofs.find((r) => r.massId === 'mass-0')
    expect(main?.pitchDeg?.value).toBe(40)
    expect(main?.ridgeLevelM?.value).toBe(7.9)
  })

  it('reads the pitch from the section when nothing prints one', () => {
    const bare = inferRoofSystems({ masses: [masses[0]], metrics: withSpec(undefined, undefined), levels: LEVELS, storeyTop: () => 4.6 })
    const main = bare.roofs[0]
    expect(main.kind).toBe('GABLE')
    expect(main.authority).toBe('SECTION')
    expect(main.pitchDeg?.basis).toBe('DERIVED')
    expect(bare.unresolved.some((u) => u.what.includes('pitch'))).toBe(true)
  })

  it('believes a publisher who says there are no eaves', () => {
    const metrics = withSpec(40, 'GABLE')
    metrics.specificationFindings.push({ key: 'roof', subject: 'ROOF_EAVES', value: 'NONE', quote: 'dach bez okapów', confidence: 0.85, why: 'fixture' })
    const withNoEaves = inferRoofSystems({ masses: [masses[0]], metrics, levels: LEVELS, storeyTop: () => 4.6 })
    expect(withNoEaves.roofs[0].overhangM?.value).toBe(0)
    expect(withNoEaves.roofs[0].overhangM?.basis).toBe('MEASURED')
  })
})

describe('reading a roof out of what was printed', () => {
  it('prefers a specification to an unattached number', () => {
    const set = withSpec(40, 'GABLE')
    set.evidence.push({ ...set.evidence[0], id: 'metric-stray', value: 11, rawText: '11°', association: { kind: 'UNATTACHED', score: 0, why: 'read but not attached', observationIds: [] } })
    expect(statedPitch(set)?.evidence.value).toBe(40)
  })

  it('returns nothing where nothing states a pitch', () => {
    expect(statedPitch(withSpec(undefined, undefined))).toBeUndefined()
  })

  it('maps the publisher’s word for a roof onto a kind', () => {
    expect(statedKind([{ key: 'roof', subject: 'ROOF_KIND', value: 'GABLE', quote: 'q', confidence: 0.9, why: 'w' }])?.kind).toBe('GABLE')
    expect(statedKind([])).toBeUndefined()
  })
})

describe('the gate', () => {
  const masses = [mass('mass-0', 0, 0, 8, 12.6, 0, 1), mass('mass-1', 8, 5, 12, 12.6, 0, 0)]
  const roofs = inferRoofSystems({ masses, metrics: withSpec(40, 'GABLE'), levels: LEVELS, storeyTop: () => 4.6 }).roofs
  const storeys = [
    { id: 'storey-0', index: 0, frameIds: ['frame-ground'], footprintRegionIds: [], confidence: 0.9, why: 'w' },
    { id: 'storey-1', index: 1, frameIds: ['frame-upper'], footprintRegionIds: [], confidence: 0.8, why: 'w' },
  ]
  const regions = masses.map((m) => ({
    id: `footprint-${m.id}`,
    storeyId: 'storey-0',
    kind: 'BUILT' as const,
    ring: m.ring,
    areaM2: (m.widthM.value * m.depthM.value),
    frameId: 'frame-ground',
    pixelRect: { x0: 0, y0: 0, x1: 1, y1: 1 },
    wallEvidence: { perimeterM: 10, walledM: 8, fraction: 0.8 },
    observationIds: [],
    evidenceIds: [],
    confidence: 0.8,
    why: 'w',
  }))

  it('accepts a layout no source contradicts', () => {
    const gate = evaluateLayoutGate({ masses, roofs, storeys, regions, conflicts: [], unresolved: [], metrics: withSpec(40, 'GABLE'), baseFrameId: 'frame-ground' })
    expect(gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
  })

  it('rejects a layout with two bodies in the same place', () => {
    const overlapping = [mass('mass-0', 0, 0, 8, 12.6, 0, 1), mass('mass-1', 4, 0, 12, 12.6, 0, 0)]
    const gate = evaluateLayoutGate({ masses: overlapping, roofs, storeys, regions, conflicts: [], unresolved: [], metrics: withSpec(40, 'GABLE'), baseFrameId: 'frame-ground' })
    expect(gate.status).toBe('STRUCTURAL_LAYOUT_REJECTED')
    expect(gate.reasons.some((r) => r.code === 'MASS_OVERLAP' && r.severity === 'BLOCKING')).toBe(true)
  })

  it('rejects a layout whose footprint is not the one the publisher printed', () => {
    const gate = evaluateLayoutGate({
      masses,
      roofs,
      storeys,
      regions,
      conflicts: [],
      unresolved: [],
      metrics: withSpec(40, 'GABLE'),
      baseFrameId: 'frame-ground',
      publishedAreas: [{ key: 'footprint_area', label: 'area', value: 60, unit: 'm2' }],
    })
    expect(gate.status).toBe('STRUCTURAL_LAYOUT_REJECTED')
  })

  it('notes rather than punishes a published area that agrees', () => {
    const gate = evaluateLayoutGate({
      masses,
      roofs,
      storeys,
      regions,
      conflicts: [],
      unresolved: [],
      metrics: withSpec(40, 'GABLE'),
      baseFrameId: 'frame-ground',
      publishedAreas: [{ key: 'footprint_area', label: 'area', value: 131, unit: 'm2' }],
    })
    expect(gate.status).toBe('STRUCTURAL_LAYOUT_ACCEPTED')
    expect(gate.reasons.some((r) => r.code === 'FOOTPRINT_AREA_AGREES')).toBe(true)
  })

  it('marks a layout partial when a source contradicts it on something it could be wrong about', () => {
    const gate = evaluateLayoutGate({
      masses,
      roofs,
      storeys,
      regions,
      conflicts: [{ id: 'c1', kind: 'ROOF_EVIDENCE_DISAGREES', what: 'the section and the pitch put the ridge in different places', itemIds: [], evidenceIds: [] }],
      unresolved: [],
      metrics: withSpec(40, 'GABLE'),
      baseFrameId: 'frame-ground',
    })
    expect(gate.status).toBe('STRUCTURAL_LAYOUT_PARTIAL')
  })

  it('rejects a layout with nothing in it', () => {
    const gate = evaluateLayoutGate({ masses: [], roofs: [], storeys: [], regions: [], conflicts: [], unresolved: [], metrics: withSpec(undefined, undefined), baseFrameId: 'frame-ground' })
    expect(gate.status).toBe('STRUCTURAL_LAYOUT_REJECTED')
  })
})

describe('sealing', () => {
  const base = {
    sourcePackageId: 'src',
    sourcePackageHash: 'a'.repeat(64),
    observationGraphId: 'graph',
    observationGraphHash: 'b'.repeat(64),
    metricEvidenceId: 'metrics',
    metricEvidenceHash: 'c'.repeat(64),
    storeys: [],
    masses: [mass('mass-0', 0, 0, 8, 12.6, 0, 1)],
    footprintRegions: [],
    recesses: [],
    attachments: [],
    roofSupports: [],
    facadePlanes: [],
    alternatives: [],
    conflicts: [],
    unresolved: [],
    traces: [],
    gate: { status: 'STRUCTURAL_LAYOUT_ACCEPTED' as const, reasons: [] },
  }

  it('hashes the structure and carries the hash in the id', () => {
    const sealed = sealStructuralLayout(base, 'test')
    expect(sealed.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(sealed.id).toContain(sealed.contentHash.slice(0, 16))
  })

  it('changes the hash when the building changes', () => {
    const other = { ...base, masses: [mass('mass-0', 0, 0, 9, 12.6, 0, 1)] }
    expect(structuralLayoutContentHash(other)).not.toBe(structuralLayoutContentHash(base))
  })

  it('does not change the hash when only a sentence changes', () => {
    const reworded = { ...base, masses: [{ ...base.masses[0], why: 'the same body, described differently' }] }
    expect(structuralLayoutContentHash(reworded)).toBe(structuralLayoutContentHash(base))
  })

  it('changes the hash when the verdict changes', () => {
    const partial = { ...base, gate: { status: 'STRUCTURAL_LAYOUT_PARTIAL' as const, reasons: [] } }
    expect(structuralLayoutContentHash(partial)).not.toBe(structuralLayoutContentHash(base))
  })
})

describe('v3.51: a stated pitch with no kind and no section is a pitched roof, its kind a named convention', () => {
  const house = [mass('mass-0', 0, 0, 13.95, 9.26, 0, 0)]
  const NO_SECTION: RoofLevels = { floors: [0], heights: [2.8], evidenceIds: [], measured: false }

  it('takes a gable for the stated pitch, running the long way, and says the kind is assumed', () => {
    const r = inferRoofSystems({ masses: house, metrics: withSpec(30, undefined), levels: NO_SECTION, storeyTop: () => 2.8 })
    const main = r.roofs[0]
    expect(main.kind).toBe('GABLE')
    expect(main.pitchDeg?.value).toBe(30)
    expect(main.ridgeAxis).toBe('X')
    expect(main.why).toContain('a gable is assumed')
    expect(r.unresolved.some((u) => u.what === 'the kind of roof over mass-0' && u.status === 'AMBIGUOUS' && u.reason.includes('by convention'))).toBe(true)
  })

  it('counter-case: a kind the page states stands, and nothing is called assumed', () => {
    const r = inferRoofSystems({ masses: house, metrics: withSpec(30, 'HIP'), levels: NO_SECTION, storeyTop: () => 2.8 })
    expect(r.roofs[0].kind).toBe('HIP')
    expect(r.unresolved.some((u) => u.what === 'the kind of roof over mass-0')).toBe(false)
  })

  it('counter-case: no stated pitch, or a fall too slight to be a pitched roof, leaves the kind unknown', () => {
    expect(inferRoofSystems({ masses: house, metrics: withSpec(undefined, undefined), levels: NO_SECTION, storeyTop: () => 2.8 }).roofs[0].kind).toBe('UNKNOWN')
    expect(inferRoofSystems({ masses: house, metrics: withSpec(8, undefined), levels: NO_SECTION, storeyTop: () => 2.8 }).roofs[0].kind).toBe('UNKNOWN')
  })

  it('counter-case: where a section measures the rise, the section decides as before', () => {
    const r = inferRoofSystems({ masses: [mass('mass-0', 0, 0, 8, 12.6, 0, 1)], metrics: withSpec(40, undefined), levels: LEVELS, storeyTop: () => 4.6 })
    expect(r.roofs[0].kind).toBe('GABLE')
    expect(r.roofs[0].why).not.toContain('a gable is assumed')
  })
})
