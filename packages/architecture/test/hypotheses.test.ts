/**
 * The hypothesis pipeline (stage 03G §14–§21): hypotheses before emission,
 * several hypotheses and their uncertainty, source authority, and the
 * SemanticProposal interface every detector speaks.
 */
import { describe, expect, it } from 'vitest'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { DETECTORS, parseProposals, resolveQuantity, runPipeline, SOURCE_AUTHORITIES, type SemanticProposal } from '../src/index.js'
import { ALL_DEMOS, runDemo } from '../src/fixtures/index.js'
import { demoDormer, demoPergola } from '../src/hypotheses/demos.js'

const contextOf = (cmds: ReturnType<typeof demoDormer.context>) => applyCommands(createEmptyModel('ctx', 'ctx'), cmds).model

describe('the pipeline demonstrations', () => {
  it.each(ALL_DEMOS.map((d) => [d.id, d] as const))('%s', (_id, d) => {
    const r = runDemo(d)
    expect(r.failures).toEqual([])
    expect(r.closureErrors).toBe(0)
  })

  it('states the same roof graph back from evidence alone', () => {
    for (const id of ['roof-intersecting', 'roof-hip']) {
      const r = runDemo(ALL_DEMOS.find((d) => d.id === id) as (typeof ALL_DEMOS)[number])
      expect(r.roofTruth?.match).toBe(true)
    }
  })
})

describe('hypotheses before emission', () => {
  const line: SemanticProposal = { id: 'vlm-line', kind: 'ROOF_LINE', geometry: { type: 'SEGMENT', start: { x: 3.5, y: 6.2, z: 1 }, end: { x: 4.5, y: 6.8, z: 2.5 } }, confidence: 0.9, sourceFrameId: 'render-1', detector: 'VLM', authority: 'VISUAL_INFERENCE' }

  it('one visual line is never a dormer: nothing is emitted', () => {
    const r = runPipeline({ proposals: [line], context: contextOf(demoDormer.context()) })
    expect(r.hypotheses.map((h) => h.decision)).toEqual(['REJECTED'])
    expect(r.commands).toEqual([])
  })

  it('a dormer seen in one render only is not emitted, not even as unknown', () => {
    const one = demoDormer.proposals().map((p) => ({ ...p, sourceFrameId: 'render-1', authority: 'PERSPECTIVE' as const, detector: 'VLM' as const }))
    const r = runPipeline({ proposals: one, context: contextOf(demoDormer.context()) })
    expect(r.hypotheses.map((h) => h.decision)).toEqual(['REJECTED'])
    expect(r.commands).toEqual([])
    expect(r.hypotheses[0].alternatives.map((a) => a.kind)).toContain('DORMER')
  })

  it('a dormer seen in one technical drawing only stays unknown: the cross-view requirement is not waived', () => {
    const one = demoDormer.proposals().map((p) => ({ ...p, sourceFrameId: 'roof-plan' }))
    const r = runPipeline({ proposals: one, context: contextOf(demoDormer.context()) })
    expect(r.hypotheses.map((h) => h.decision)).toEqual(['UNKNOWN'])
    const alt = r.hypotheses[0].alternatives.find((a) => a.kind === 'DORMER')
    expect(alt?.why).toMatch(/seen in 1 frame, needs two/)
    expect(r.commands.some((c) => c.type === 'createDormer')).toBe(false)
    expect(r.commands.filter((c) => c.type === 'createAssembly').map((c) => (c.type === 'createAssembly' ? c.assembly.kind : ''))).toEqual(['UNKNOWN'])
  })

  it('a covered frame is not a pergola, and a frame with open sky observed is not a canopy', () => {
    const covered = [...demoPergola.proposals().filter((p) => p.kind !== 'NO_COVER_OBSERVED'), { id: 'cover-seen', kind: 'COVER_SURFACE' as const, geometry: { type: 'POLYGON' as const, points: [{ x: 1.7, y: 3.0, z: 8.9 }, { x: 8.3, y: 3.0, z: 8.9 }, { x: 8.3, y: 3.0, z: 12.1 }, { x: 1.7, y: 3.0, z: 12.1 }] }, confidence: 0.9, sourceFrameId: 'elevation-rear', detector: 'DETERMINISTIC_CV' as const, authority: 'TECHNICAL_GEOMETRY' as const, featureKey: 'garden-frame' }]
    const r = runPipeline({ proposals: covered, context: contextOf(demoPergola.context()) })
    const pergola = r.hypotheses[0].scores.find((s) => s.family === 'PERGOLA')
    expect(pergola?.excludedBy).toEqual(['cover-seen'])
    expect(r.hypotheses[0].family).not.toBe('PERGOLA')
    const open = runPipeline({ proposals: demoPergola.proposals(), context: contextOf(demoPergola.context()) })
    expect(open.hypotheses[0].family).toBe('PERGOLA')
    expect(open.hypotheses[0].scores.find((s) => s.family === 'CANOPY')?.excludedBy).toEqual(['sky-render'])
  })

  it('is deterministic: the same proposals in any order give the same program', () => {
    const ps = demoPergola.proposals()
    const a = runPipeline({ proposals: ps, context: contextOf(demoPergola.context()) })
    const b = runPipeline({ proposals: [...ps].reverse(), context: contextOf(demoPergola.context()) })
    expect(JSON.stringify(b.commands)).toBe(JSON.stringify(a.commands))
  })
})

describe('source authority', () => {
  it('a higher authority decides, whatever the count or order of lower ones', () => {
    for (let i = 0; i < SOURCE_AUTHORITIES.length - 1; i++) {
      const hi = SOURCE_AUTHORITIES[i]
      const lo = SOURCE_AUTHORITIES[i + 1]
      const many = Array.from({ length: 5 }, (_, k) => ({ value: 10, authority: lo, sourceId: `lo-${k}` }))
      const r = resolveQuantity('q', [...many, { value: 3, authority: hi, sourceId: 'hi' }])
      expect(r?.value, `${hi} over ${lo}`).toBe(3)
      expect(r?.conflicts.length).toBe(5)
      expect(r?.conflicts[0].why).toMatch(/does not override/)
    }
    expect(resolveQuantity('q', [])).toBeNull()
  })

  it('in the pergola demo the printed post height beats the render, and the conflict is recorded', () => {
    const r = runDemo(demoPergola)
    const datum = r.result.quantities.find((q) => q.key.endsWith('frame.beamTop'))
    expect(datum?.authority).toBe('PRINTED_DIMENSION')
    expect(datum?.conflicts.some((c) => c.lost.authority === 'PERSPECTIVE')).toBe(true)
    const posts = r.model.linearSolids.filter((s) => s.role === 'PERGOLA_POST')
    expect(posts.length).toBe(4)
    for (const p of posts) expect(p.end.y).toBeCloseTo(2.48, 9)
  })
})

describe('the SemanticProposal interface', () => {
  it('accepts every detector, and refuses a malformed or duplicate proposal instead of repairing it', () => {
    const base = { kind: 'VERTICAL_MEMBER', geometry: { type: 'SEGMENT', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 2, z: 0 } }, confidence: 0.5, sourceFrameId: 'f', authority: 'PERSPECTIVE' }
    const ok = parseProposals(DETECTORS.map((d, i) => ({ ...base, id: `p${i}`, detector: d })))
    expect(ok.ok).toBe(true)
    expect(parseProposals([{ ...base, id: 'x', detector: 'ORACLE' }]).ok).toBe(false)
    expect(parseProposals([{ ...base, id: 'x', detector: 'VLM', confidence: 1.5 }]).ok).toBe(false)
    expect(parseProposals([{ ...base, id: 'x', detector: 'VLM' }, { ...base, id: 'x', detector: 'OCR' }]).ok).toBe(false)
  })
})
