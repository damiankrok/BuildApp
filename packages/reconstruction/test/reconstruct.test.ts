import { describe, expect, it } from 'vitest'
import { LARCHFIELD, ridgeRise, totalHeight } from '@buildapp/synthetic-drawings'
import { ReconstructionCandidateSchema, PrimitiveHypothesisSetSchema, auditProjection, candidateContentHash, evaluateCandidate, registerElevationFrames, verifyReplay } from '../src/index.js'
import { buildFixture, quantity, solve } from './pipeline.js'

/**
 * §24's second fixture: a complete source set for a building that exists
 * nowhere else, reconstructed end to end and checked against the spec its own
 * drawings were rendered from.
 */
const fixture = await buildFixture()
const result = solve(fixture)

describe('a house the pipeline has never seen, reconstructed from its own drawings', () => {
  it('recovers the footprint from the printed dimension chains, exactly', () => {
    expect(quantity(result, 'width')).toEqual({ value: LARCHFIELD.width, class: 'HARD' })
    expect(quantity(result, 'depth')).toEqual({ value: LARCHFIELD.depth, class: 'HARD' })
  })

  it('recovers the storey heights from the section, and says which are stated and which inferred', () => {
    const heights = result.model.levels.sort((a, b) => a.index - b.index).map((l) => l.height)
    expect(heights).toEqual(LARCHFIELD.storeys.map((s) => s.height))
    expect(quantity(result, 'height')?.class).toBe('HARD')
  })

  it('derives the roof pitch from the ridge height and the span, to within a degree', () => {
    const pitch = quantity(result, 'pitchDeg')
    expect(pitch).toBeDefined()
    expect(Math.abs((pitch as { value: number }).value - LARCHFIELD.roof.pitchDeg)).toBeLessThan(1)
    // Nothing on these sheets prints the pitch, so it cannot be hard.
    expect(pitch?.class).toBe('SOFT')
  })

  it('measures the eaves overhang from the surplus of the silhouette over the wall', () => {
    const overhang = quantity(result, 'overhang')
    expect(overhang?.class).toBe('SOFT')
    expect(Math.abs((overhang as { value: number }).value - LARCHFIELD.roof.overhang)).toBeLessThan(0.1)
  })

  it('puts the ridge where the section says it is', () => {
    const roof = result.model.roofs[0]
    expect(roof).toBeDefined()
    const level = result.model.levels.find((l) => l.id === roof.levelId)
    const span = roof.ridgeAxis === 'X' ? roof.footprint.maxZ - roof.footprint.minZ : roof.footprint.maxX - roof.footprint.minX
    const ridge = (level?.elevation ?? 0) + roof.eaveOffset + (Math.tan((roof.pitchDeg * Math.PI) / 180) * span) / 2
    expect(Math.abs(ridge - totalHeight(LARCHFIELD))).toBeLessThan(0.05)
    expect(ridgeRise(LARCHFIELD)).toBeGreaterThan(0)
  })

  it('cuts the openings the elevations show, at the size and the place they show them', () => {
    const SIDE = ['REAR', 'RIGHT', 'FRONT', 'LEFT']
    const built = result.model.openings.map((o) => {
      const wall = result.model.walls.find((w) => w.id === o.wallId)
      const level = result.model.levels.find((l) => l.id === wall?.levelId)
      return { side: SIDE[Number(wall?.id.slice(-1))], at: o.offset, width: o.width, height: o.height, sill: o.sill, storey: level?.index ?? 0 }
    })
    // Every opening the front and side elevations draw must be found, within
    // five centimetres of where the drawing puts it.
    const wanted = LARCHFIELD.openings.filter((o) => o.side === 'FRONT' || o.side === 'LEFT')
    for (const want of wanted) {
      const match = built.find((b) => b.side === want.side && Math.abs(b.at - want.at) < 0.06 && b.storey === want.storey)
      expect(match, `${want.side} opening at ${want.at} m`).toBeDefined()
      if (!match) continue
      expect(Math.abs(match.width - want.width)).toBeLessThan(0.06)
      expect(Math.abs(match.height - want.height)).toBeLessThan(0.06)
      expect(Math.abs(match.sill - want.sill)).toBeLessThan(0.06)
    }
  })

  it('measures the wall thickness off the plan rather than assuming one', () => {
    const thickness = quantity(result, 'wallThickness')
    // The plan draws its walls at a thickness, and the decomposition measures
    // it: a scaled reading, not a convention.
    expect(thickness?.class).toBe('SOFT')
    expect(Math.abs((thickness?.value ?? 0) - LARCHFIELD.wallThickness)).toBeLessThan(0.08)
  })

  it('never claims more than the drawings support: conventions are marked and named', () => {
    const assumed = result.hypotheses.hypotheses.flatMap((h) => h.parameters).filter((p) => p.basis === 'ASSUMED')
    for (const p of assumed) expect(p.why.length).toBeGreaterThan(10)
    // Anything assumed has to leave a trace a reader can find.
    expect(result.candidate.unresolved.length).toBeGreaterThan(0)
  })

  it('refuses the stair rather than inventing one', () => {
    const stair = result.candidate.unresolved.find((u) => u.what.includes('stair'))
    expect(stair?.status).toBe('REFUSED')
    expect(result.model.stairs).toEqual([])
    expect(result.candidate.steps.some((s) => s.stage === 'stair' && s.method === 'REFUSED')).toBe(true)
  })
})

describe('the sealed candidate', () => {
  it('validates, and replays to the model it was sealed with, byte for byte', () => {
    expect(ReconstructionCandidateSchema.safeParse(result.candidate).success).toBe(true)
    const replay = verifyReplay(result.candidate)
    expect(replay.ok).toBe(true)
  })

  it('fails the replay the moment its program and its model disagree', () => {
    const tampered = { ...result.candidate, program: result.candidate.program.slice(0, -2) }
    const replay = verifyReplay(tampered)
    expect(replay.ok).toBe(false)
    if (!replay.ok) expect(replay.reason).toMatch(/different model|did not run/)
  })

  it('names all four of its inputs by hash, and changes when any of them changes', () => {
    const base = candidateContentHash(result.candidate)
    expect(base).toBe(result.candidate.contentHash)
    for (const field of ['sourcePackageHash', 'observationGraphHash', 'metricEvidenceHash', 'hypothesisSetHash'] as const) {
      expect(candidateContentHash({ ...result.candidate, [field]: 'f'.repeat(64) }), field).not.toBe(base)
    }
  })

  it('does not change when the prose changes', () => {
    const reworded = {
      ...result.candidate,
      steps: result.candidate.steps.map((s) => ({ ...s, detail: 'said differently', what: 'described differently' })),
      traces: result.candidate.traces.map((t) => ({ ...t, why: 'explained differently' })),
      unresolved: result.candidate.unresolved.map((u) => ({ ...u, reason: `${u.reason}, restated` })),
      quantities: result.candidate.quantities.map((q) => ({ ...q, why: 'reworded' })),
    }
    expect(candidateContentHash(reworded)).toBe(result.candidate.contentHash)
  })

  it('traces every primitive it built back to the hypothesis and the evidence behind it', () => {
    const traced = new Set(result.candidate.traces.map((t) => t.objectId))
    for (const opening of result.model.openings) expect(traced.has(opening.id), opening.id).toBe(true)
    for (const solid of result.model.linearSolids) expect(traced.has(solid.id), solid.id).toBe(true)
    for (const roof of result.model.roofs) expect(traced.has(roof.id), roof.id).toBe(true)
    const hypotheses = new Set(result.hypotheses.hypotheses.map((h) => h.id))
    for (const trace of result.candidate.traces) {
      expect(hypotheses.has(trace.hypothesisId), trace.hypothesisId).toBe(true)
      expect(trace.why.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic: the same evidence twice gives the same candidate', () => {
    const again = solve(fixture)
    expect(again.candidate.contentHash).toBe(result.candidate.contentHash)
    expect(again.candidate.modelHash).toBe(result.candidate.modelHash)
    expect(again.hypotheses.contentHash).toBe(result.hypotheses.contentHash)
  })
})

describe('the hypothesis set', () => {
  it('validates, and states how many sightings became how many members', () => {
    expect(PrimitiveHypothesisSetSchema.safeParse(result.hypotheses).success).toBe(true)
    const f = result.hypotheses.fusion
    expect(f.rawCandidates).toBeGreaterThan(f.accepted)
    expect(f.afterDuplicateSuppression).toBeLessThanOrEqual(f.rawCandidates)
    // Every reduction is monotonic, and the ones that did work say how much.
    expect(f.afterClustering).toBeLessThanOrEqual(f.afterDuplicateSuppression)
    expect(f.afterContinuityMerge).toBeLessThanOrEqual(f.afterClustering)
    expect(f.accepted).toBeLessThanOrEqual(f.afterContinuityMerge)
    // Clean synthetic sheets may give the reducers little to do; what must
    // hold is that everything dropped is counted and explained.
    expect(f.rejected.reduce((a, r) => a + r.count, 0)).toBe(f.rawCandidates - f.accepted)
    for (const r of f.rejected) expect(r.why.length).toBeGreaterThan(0)
  })

  it('gives every parameter a basis, so a measurement can never be mistaken for a convention', () => {
    for (const h of result.hypotheses.hypotheses) {
      for (const p of h.parameters) {
        expect(['MEASURED', 'DERIVED', 'SCALED', 'CROSS_VIEW', 'ASSUMED']).toContain(p.basis)
        expect(p.low).toBeLessThanOrEqual(p.value + 1e-9)
        expect(p.high).toBeGreaterThanOrEqual(p.value - 1e-9)
        expect(p.why.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('the projection audit', () => {
  it('lands the candidate’s openings on the observations they were read from', () => {
    const ridge = totalHeight(LARCHFIELD)
    const { registrations } = registerElevationFrames(fixture.graph, { width: LARCHFIELD.width, depth: LARCHFIELD.depth, totalHeight: ridge })
    const audit = auditProjection(result.model, fixture.graph, registrations, result.candidate.contentHash)
    expect(audit.summary.objects).toBeGreaterThan(0)
    expect(audit.summary.matched).toBe(audit.summary.objects)
    expect(audit.summary.iouMean).toBeGreaterThan(0.5)
    expect(audit.summary.centreRmsM).toBeLessThan(0.2)
  })

  it('sees a mirrored facade for what it is', () => {
    const ridge = totalHeight(LARCHFIELD)
    const { registrations } = registerElevationFrames(fixture.graph, { width: LARCHFIELD.width, depth: LARCHFIELD.depth, totalHeight: ridge })
    const mirrored = {
      ...result.model,
      openings: result.model.openings.map((o) => {
        const wall = result.model.walls.find((w) => w.id === o.wallId)
        const length = wall ? Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) : 0
        return { ...o, offset: Math.max(0, length - o.offset - o.width) }
      }),
    }
    const audit = auditProjection(mirrored, fixture.graph, registrations, 'x'.repeat(64))
    expect(audit.summary.centreRmsM).toBeGreaterThan(0.5)
  })
})

describe('evaluation against a reference', () => {
  it('reports accuracy and completeness separately, and neither is a combination of the other', () => {
    // The candidate is scored against ITSELF as a reference: a perfect match,
    // which is the only case where both numbers have a known answer.
    const evaluation = evaluateCandidate(result.candidate, result.model, result.model)
    expect(evaluation.scores.geometricAccuracy).toBeGreaterThan(0.9)
    expect(evaluation.scores.evidenceSupportedCompleteness).toBeGreaterThan(0.9)
    expect(evaluation.openings.matched).toBe(result.model.openings.length)
    expect(evaluation.openings.missed).toBe(0)
    expect(Object.keys(evaluation.scores)).toEqual(['geometricAccuracy', 'evidenceSupportedCompleteness'])
  })

  it('separates the two when a candidate is precise but sparse', () => {
    const sparse = { ...result.model, openings: result.model.openings.slice(0, 1) }
    const evaluation = evaluateCandidate(result.candidate, sparse, result.model)
    expect(evaluation.scores.geometricAccuracy).toBeGreaterThan(0.85)
    expect(evaluation.scores.evidenceSupportedCompleteness).toBeLessThan(0.85)
  })
})
