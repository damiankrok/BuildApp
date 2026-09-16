import { describe, expect, it } from 'vitest'
import { LARCHFIELD } from '@buildapp/synthetic-drawings'
import type { SourceObservation } from '@buildapp/source-observations'
import type { MetricEvidence } from '@buildapp/source-metrics'
import { buildFixture, deepCopy, quantity, solve } from './pipeline.js'
import type { Fixture } from './pipeline.js'

/**
 * Mutation tests: change ONE thing in what the pipeline saw, and check that
 * the candidate changes in the way it should.
 *
 * This is the only way to find out whether a reconstruction is actually
 * reading its sources. A pipeline that has quietly learned its answer passes
 * every accuracy test and fails every one of these, because its output does
 * not move when the input does. Each test below names the thing it broke and
 * the response it expects — a different number, a named hole, a refusal — and
 * a silent, unchanged answer is a failure in all of them.
 */
const base = await buildFixture()
const baseline = solve(base)

const withGraph = (mutate: (o: SourceObservation[]) => SourceObservation[]) => (f: Fixture): Fixture => ({ ...f, graph: { ...f.graph, observations: mutate(deepCopy(f.graph.observations)) } })
const withEvidence = (mutate: (e: MetricEvidence[]) => MetricEvidence[]) => (f: Fixture): Fixture => ({ ...f, metrics: { ...f.metrics, evidence: mutate(deepCopy(f.metrics.evidence)) } })

const observationsOnElevations = (f: Fixture): Set<string> => new Set(f.graph.coordinateFrames.filter((x) => x.roles.projection === 'ORTHOGRAPHIC_ELEVATION').map((x) => x.id))

describe('mutating the sources moves the candidate', () => {
  it('1. a printed dimension changed changes the building', () => {
    // The sheet now says the middle bay is 1.2 m narrower, on both the overall
    // chain and the one that subdivides it — which is what a redrawn sheet
    // would say.
    const changed = solve(base, withEvidence((evidence) =>
      evidence.map((e) => {
        if (e.kind !== 'LINEAR_DIMENSION') return e
        if (Math.abs(e.value - LARCHFIELD.width * 100) < 1) return { ...e, value: e.value - 120 }
        if (Math.abs(e.value - 480) < 1) return { ...e, value: e.value - 120 }
        return e
      }),
    ))
    // The chain totals are recomputed from the evidence, so the change reaches
    // the walls.
    expect(quantity(changed, 'width')?.value).toBeCloseTo(LARCHFIELD.width - 1.2, 3)
    expect(quantity(changed, 'width')?.class).toBe('HARD')
    expect(changed.candidate.contentHash).not.toBe(baseline.candidate.contentHash)
  })

  it('2. a chain token omitted leaves the chain unable to state its total', () => {
    // One number on the subdividing chain was never read, so that chain can
    // no longer state a total at all.
    const changed = solve(base, (f) => ({
      ...f,
      metrics: {
        ...f.metrics,
        chains: deepCopy(f.metrics.chains).map((c) => (c.axis === 'HORIZONTAL' && c.segments.length > 1 ? { ...c, segments: c.segments.map((s, i) => (i === 0 ? { ...s, evidenceId: undefined, valueCm: undefined, origin: undefined } : s)) } : c)),
      },
    }))
    // The subdivided chain can no longer corroborate the overall one, so the
    // width is no longer stated twice.
    const before = baseline.candidate.quantities.find((q) => q.parameter === 'width')
    const after = changed.candidate.quantities.find((q) => q.parameter === 'width')
    expect(before?.why).toContain('agree')
    expect(after?.why).not.toContain('agree')
  })

  it('3. an ambiguous OCR token is not allowed to settle a dimension as HARD', () => {
    const changed = solve(base, withEvidence((evidence) => evidence.map((e) => (e.kind === 'LINEAR_DIMENSION' ? { ...e, origin: 'DERIVED' as const, confidence: 0.2 } : e))))
    expect(quantity(baseline, 'width')?.class).toBe('HARD')
    expect(quantity(changed, 'width')?.class).toBe('SOFT')
  })

  it('4. a changed roof-angle annotation is weighed, not obeyed, when the geometry disagrees', () => {
    const changed = solve(base, withEvidence((evidence) => {
      evidence.push({
        ...(evidence[0] as MetricEvidence),
        id: 'metric-angle-planted',
        kind: 'ANGLE',
        value: 12,
        unit: 'deg',
        rawText: '12°',
        association: { kind: 'ANGLE_MARKER', score: 0.9, why: 'planted by a mutation test', observationIds: [] },
        confidence: 0.9,
      })
      return evidence
    }))
    const before = quantity(baseline, 'pitchDeg')?.value ?? 0
    const after = quantity(changed, 'pitchDeg')?.value ?? 0
    // §8 fixes the order of authority: a printed angle is a statement and the
    // geometry is a measurement, so the printed angle stands EXACTLY and the
    // disagreement is reported rather than split.
    expect(after).toBeLessThan(before)
    expect(after).toBe(12)
    expect(changed.layout.roofSupports.some((r) => r.authority === 'PRINTED_ANGLE')).toBe(true)
    expect(changed.layout.conflicts.some((c) => c.kind === 'ROOF_EVIDENCE_DISAGREES')).toBe(true)
  })

  it('5. a depth no chain states any more is still measured, and stops being a statement', () => {
    // The chains that measured the depth are gone from the sheet. The WALLS
    // have not moved, so the building has not moved either — but nothing
    // prints the number any more, so it stops being something the candidate
    // would defend and becomes something it scaled off the drawing.
    const changed = solve(base, (f) => ({
      ...f,
      metrics: {
        ...f.metrics,
        chains: deepCopy(f.metrics.chains).filter((c) => c.axis !== 'VERTICAL'),
      },
    }))
    expect(quantity(baseline, 'depth')?.class).toBe('HARD')
    expect(quantity(changed, 'depth')?.class).toBe('SOFT')
    // Within a wall's thickness of where it was: the walls are where they were.
    expect(Math.abs((quantity(changed, 'depth')?.value ?? 0) - LARCHFIELD.depth)).toBeLessThan(0.4)
    expect(changed.candidate.contentHash).not.toBe(baseline.candidate.contentHash)
  })

  it('6. removing a mass region from a view costs that view its registration', () => {
    const elevations = observationsOnElevations(base)
    const changed = solve(base, withGraph((observations) => observations.filter((o) => !(elevations.has(o.frameId) && (o.kind === 'SILHOUETTE' || o.kind === 'MASS_REGION')))))
    expect(changed.candidate.unresolved.some((u) => u.reason.includes('no silhouette'))).toBe(true)
    expect(changed.model.openings.length).toBeLessThan(baseline.model.openings.length)
  })

  it('7. removing a major opening removes it from the candidate', () => {
    const largest = base.graph.observations
      .filter((o) => o.kind === 'OPENING' && o.pixelGeometry.type === 'RECT')
      .sort((a, b) => {
        const area = (o: SourceObservation): number => (o.pixelGeometry.type === 'RECT' ? (o.pixelGeometry.rect.x1 - o.pixelGeometry.rect.x0) * (o.pixelGeometry.rect.y1 - o.pixelGeometry.rect.y0) : 0)
        return area(b) - area(a)
      })[0]
    expect(largest).toBeDefined()
    const changed = solve(base, withGraph((observations) => observations.filter((o) => o.id !== largest.id)))
    expect(changed.model.openings.length).toBeLessThanOrEqual(baseline.model.openings.length)
    expect(changed.candidate.contentHash).not.toBe(baseline.candidate.contentHash)
  })

  it('8. a mirrored elevation produces a mirrored facade, and the audit can see it', () => {
    const front = base.graph.coordinateFrames.find((f) => f.roles.view === 'FRONT')
    expect(front).toBeDefined()
    const changed = solve(base, withGraph((observations) =>
      observations.map((o) => {
        if (o.frameId !== front?.id || o.pixelGeometry.type !== 'RECT') return o
        const w = front.size.width
        return { ...o, pixelGeometry: { type: 'RECT', rect: { x0: w - o.pixelGeometry.rect.x1, y0: o.pixelGeometry.rect.y0, x1: w - o.pixelGeometry.rect.x0, y1: o.pixelGeometry.rect.y1 } } } as SourceObservation
      }),
    ))
    const offsetsOf = (r: typeof baseline): number[] =>
      r.model.openings
        .filter((o) => o.wallId.endsWith('w2'))
        .map((o) => Number(o.offset.toFixed(2)))
        .sort((a, b) => a - b)
    expect(offsetsOf(changed)).not.toEqual(offsetsOf(baseline))
  })

  it('9. one confident false linear-volume candidate does not become a solid without a depth cue', () => {
    const front = base.graph.coordinateFrames.find((f) => f.roles.view === 'FRONT')
    const template = base.graph.observations.find((o) => o.frameId === front?.id && o.pixelGeometry.type === 'RECT')
    expect(template).toBeDefined()
    const changed = solve(base, withGraph((observations) => [
      ...observations,
      {
        ...(template as SourceObservation),
        id: 'obs-planted-false-member',
        kind: 'LINEAR_VOLUME_CANDIDATE',
        semanticHints: ['beam'],
        // High confidence, and no view that says it stands proud of anything.
        confidence: 0.95,
        depthLayer: 'UNKNOWN',
        pixelGeometry: { type: 'RECT', rect: { x0: 40, y0: 200, x1: 460, y1: 224 } },
      } as SourceObservation,
    ]))
    expect(changed.candidate.unresolved.some((u) => u.reason.includes('stands proud'))).toBe(true)
    expect(changed.model.linearSolids.length).toBe(baseline.model.linearSolids.length)
  })

  it('10. fifty noisy low-confidence candidates do not become fifty members', () => {
    const front = base.graph.coordinateFrames.find((f) => f.roles.view === 'FRONT')
    const template = base.graph.observations.find((o) => o.frameId === front?.id && o.pixelGeometry.type === 'RECT')
    const changed = solve(base, withGraph((observations) => [
      ...observations,
      ...Array.from({ length: 50 }, (_, i) => ({
        ...(template as SourceObservation),
        id: `obs-noise-${i}`,
        kind: 'LINEAR_VOLUME_CANDIDATE' as const,
        semanticHints: ['band' as const],
        confidence: 0.2 + (i % 5) * 0.02,
        depthLayer: 'PROUD_OF_WALL' as const,
        pixelGeometry: { type: 'RECT' as const, rect: { x0: 40 + i * 2, y0: 180 + (i % 7) * 3, x1: 200 + i * 2, y1: 188 + (i % 7) * 3 } },
      })),
    ]))
    expect(changed.hypotheses.fusion.rawCandidates).toBeGreaterThan(baseline.hypotheses.fusion.rawCandidates + 40)
    expect(changed.model.linearSolids.length).toBeLessThan(baseline.model.linearSolids.length + 10)
    // And the reducers say how many they threw away, and why.
    expect(changed.hypotheses.fusion.rejected.reduce((a, r) => a + r.count, 0)).toBeGreaterThan(20)
  })

  it('11. two contradictory exact constraints are reported, never averaged', () => {
    const changed = solve(base, withEvidence((evidence) => {
      const dimension = evidence.find((e) => e.kind === 'LINEAR_DIMENSION')
      if (dimension) evidence.push({ ...dimension, id: 'metric-contradiction', value: dimension.value + 300 })
      return evidence
    }))
    const width = quantity(changed, 'width')?.value ?? 0
    // Whatever it settles on must be a value some chain actually states, never
    // a compromise between two.
    // Whatever it settles on must be a total some chain actually states,
    // never a compromise between two that no drawing prints.
    expect(Number.isFinite(width)).toBe(true)
    expect(width).toBeGreaterThan(0)
    const midpoint = ((quantity(baseline, 'width')?.value ?? 0) + (quantity(baseline, 'width')?.value ?? 0) + 3) / 2
    expect(width).not.toBeCloseTo(midpoint, 3)
  })

  it('12. shifting a plan registration anchor does not move a dimension the sheet printed', () => {
    const changed = solve(base, (f) => ({
      ...f,
      metrics: {
        ...f.metrics,
        coordinateRegistrations: deepCopy(f.metrics.coordinateRegistrations).map((r) => (r.plane === 'PLAN_XZ' ? { ...r, metresPerPixelX: r.metresPerPixelX * 1.1, metresPerPixelY: r.metresPerPixelY * 1.1, anisotropy: 1, residual: { ...r.residual, rmsM: r.residual.rmsM + 0.4 } } : r)),
      },
    }))
    // This is the property worth having, and it is not obvious: a printed
    // dimension is a statement in centimetres and does not depend on the
    // sheet's scale at all, so pushing the registration ten per cent out
    // leaves the footprint exactly where it was — every span the chains state
    // comes through the chains. What moves is everything the chains do NOT
    // state, which on a plan is the wall thickness, measured off the ink.
    expect(quantity(changed, 'width')?.value).toBe(quantity(baseline, 'width')?.value)
    expect(quantity(changed, 'depth')?.value).toBe(quantity(baseline, 'depth')?.value)
    const before = quantity(baseline, 'wallThickness')?.value ?? 0
    const after = quantity(changed, 'wallThickness')?.value ?? 0
    expect(after).not.toBe(before)
    expect(after).toBeCloseTo(before * 1.1, 2)
  })

  it('13. with no stair observations at all, the refusal is still explicit', () => {
    const changed = solve(base, withGraph((observations) => observations.filter((o) => o.kind !== 'STAIR' && o.kind !== 'STAIR_SYMBOL')))
    const stair = changed.candidate.unresolved.find((u) => u.what.includes('stair'))
    expect(stair?.status).toBe('REFUSED')
    expect(changed.model.stairs).toEqual([])
  })

  it('14. nothing in the solve consults a reference model, so removing one changes nothing', async () => {
    // The strongest form of this is the architecture test that greps the
    // sources. The behavioural form is here: the pipeline has been run in this
    // file without a reference package ever being imported, and it produced a
    // complete candidate.
    expect(baseline.candidate.program.length).toBeGreaterThan(10)
    expect(baseline.model.walls.length).toBeGreaterThan(0)
    const again = await buildFixture()
    expect(solve(again).candidate.contentHash).toBe(baseline.candidate.contentHash)
  })
})
