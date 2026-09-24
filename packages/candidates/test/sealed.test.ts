/**
 * The sealed candidates are data, and the data has to be coherent.
 *
 * Each candidate is committed beside the layout it was built from and, for a
 * solver that verified against the drawings, the residuals of that check. The
 * three are tied together by hash, and these tests hold the ties: a candidate
 * that no longer replays, a layout that is not the one it names, or residuals
 * measured on some other building would each show a viewer a building nobody
 * evaluated, under a label that says otherwise.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { serializeModel } from '@buildapp/model'
import { ReconstructionCandidateSchema, StructuralLayoutHypothesisSetSchema, verifyReplay } from '@buildapp/reconstruction'
import { SEALED_CANDIDATES, candidateStatus, layoutOf, modelOf, modelOfUnchecked, sealedCandidate, sourceViewResidualsOf } from '../src/index.js'

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')
const HEX64 = /^[0-9a-f]{64}$/

describe('the sealed set', () => {
  it('carries both Marcówki candidates, in a fixed order, under distinct ids', () => {
    expect(SEALED_CANDIDATES.map((c) => c.id)).toEqual(['marcowki-auto', 'marcowki-auto-v2'])
    expect(SEALED_CANDIDATES.map((c) => c.label)).toEqual(['Marcówki (auto)', 'Marcówki (auto v2)'])
    expect(new Set(SEALED_CANDIDATES.map((c) => c.candidate.modelId)).size).toBe(SEALED_CANDIDATES.length)
    expect(new Set(SEALED_CANDIDATES.map((c) => c.candidate.contentHash)).size).toBe(SEALED_CANDIDATES.length)
  })

  it('refuses an id it does not know', () => {
    expect(sealedCandidate('marcowki-auto-v3')).toBeUndefined()
    expect(() => modelOf('marcowki-auto-v3')).toThrow(/no sealed candidate/)
    expect(() => layoutOf('marcowki-auto-v3')).toThrow(/no sealed candidate/)
    expect(() => sourceViewResidualsOf('marcowki-auto-v3')).toThrow(/no sealed candidate/)
  })
})

describe.each(SEALED_CANDIDATES.map((c) => [c.id, c] as const))('%s', (id, sealed) => {
  it('validates as a candidate and names its inputs by hash', () => {
    expect(ReconstructionCandidateSchema.safeParse(sealed.candidate).success).toBe(true)
    const c = sealed.candidate
    for (const hash of [c.contentHash, c.sourcePackageHash, c.observationGraphHash, c.metricEvidenceHash, c.hypothesisSetHash, c.modelHash, c.structuralLayoutHash]) expect(hash).toMatch(HEX64)
    expect(c.label).toBe(sealed.label)
  })

  it('replays its own program to the model it was sealed with', () => {
    const replay = verifyReplay(sealed.candidate)
    expect(replay.ok, replay.ok ? '' : replay.reason).toBe(true)
    const model = modelOf(id)
    expect(sha256(serializeModel(model))).toBe(sealed.candidate.modelHash)
    expect(model.id).toBe(sealed.candidate.modelId)
    expect(model.name).toBe(sealed.label)
    // The unchecked path builds the same bytes; it merely skips the proof.
    expect(serializeModel(modelOfUnchecked(sealed))).toBe(serializeModel(model))
  })

  it('is sealed with the layout it was built from', () => {
    const layout = layoutOf(id)
    expect(StructuralLayoutHypothesisSetSchema.safeParse(layout).success).toBe(true)
    expect(layout.contentHash).toBe(sealed.candidate.structuralLayoutHash)
    expect(layout.id).toBe(sealed.candidate.structuralLayoutId)
    expect(layout.masses.length).toBeGreaterThanOrEqual(2)
  })

  it('can be described to a viewer without running a solver', () => {
    const status = candidateStatus(sealed)
    expect(status.id).toBe(id)
    expect(status.candidateHash).toBe(sealed.candidate.contentHash)
    expect(status.commands).toBe(sealed.candidate.program.length)
    expect(status.hard + status.soft + status.unresolvedQuantities).toBeGreaterThan(0)
  })
})

describe('marcowki-auto-v2', () => {
  const sealed = sealedCandidate('marcowki-auto-v2')!

  it('was produced by the second solver, and its layout hash is the layout’s content hash', () => {
    expect(sealed.candidate.solver.name).toBe('reconstruction.solver.v2')
    expect(sealed.candidate.modelId).toBe('m-auto-v2-marcowki')
    expect(sealed.layout.contentHash).toBe(sealed.candidate.structuralLayoutHash)
  })

  it('carries the source-view residuals measured on exactly this candidate', () => {
    const residuals = sourceViewResidualsOf('marcowki-auto-v2')
    expect(residuals).not.toBeNull()
    if (!residuals) return
    expect(residuals.candidateHash).toBe(sealed.candidate.contentHash)
    expect(residuals.residuals.length).toBeGreaterThan(0)
    const model = modelOf('marcowki-auto-v2')
    const objectIds = new Set<string>([...model.openings, ...model.roofs, ...model.walls, ...model.linearSolids, ...model.wallRings].map((o) => o.id))
    for (const r of residuals.residuals) {
      expect(r.kind.length).toBeGreaterThan(0)
      expect(r.why.length).toBeGreaterThan(0)
      for (const n of [r.modelM, r.observedM, r.residualM, r.toleranceM]) expect(Number.isFinite(n)).toBe(true)
      expect(r.residualM).toBeCloseTo(r.modelM - r.observedM, 6)
      expect(r.toleranceM).toBeGreaterThan(0)
      // The verdict is the number, not a separate opinion.
      if (r.withinTolerance) expect(Math.abs(r.residualM)).toBeLessThanOrEqual(r.toleranceM + 1e-9)
      else expect(Math.abs(r.residualM)).toBeGreaterThanOrEqual(r.toleranceM - 1e-9)
      // A residual on an object points at an object the replayed model has.
      if (r.objectId) expect(objectIds.has(r.objectId), `${r.objectId} is not in the replayed model`).toBe(true)
    }
  })

  it('the first candidate carries none: its solver never verified against the views', () => {
    expect(sourceViewResidualsOf('marcowki-auto')).toBeNull()
  })
})
