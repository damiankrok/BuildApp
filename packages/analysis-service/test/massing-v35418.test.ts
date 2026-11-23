/**
 * v3.54.18 — the outline of more than six corners (massing 1.1.0): small steps are taken out as a NAMED miniature
 * convention; a wing of real size is not (the outline stays unsupported). v3.54.17 refused every such outline
 * (UNSUPPORTED_FORM), so a rectangle with a terrace notch had no body at all on the path without LOCAL.
 */
import { describe, expect, it } from 'vitest'
import { OUTLINE_SIMPLIFICATION, rectanglesOf, simplifyOutline } from '../src/consult/massing/massing.js'

const P = (pts: Array<[number, number]>): Array<{ x: number; z: number }> => pts.map(([x, z]) => ({ x, z }))

describe('v3.54.18 outline simplification', () => {
  it('a rectangle with a corner notch (a terrace recess) becomes the rectangle, with the area named', () => {
    // 9.25 × 18.25 with a 2.0 × 3.0 notch at one corner: 6 m² of 168.8 m² (3.6 %) — but it is an L (6 corners): untouched
    expect(simplifyOutline(P([[0, 0], [9.25, 0], [9.25, 18.25], [2, 18.25], [2, 15.25], [0, 15.25]]))).toBeUndefined()
    // the same body with a notch in the middle of a side (8 corners)
    const s = simplifyOutline(P([[0, 0], [9.25, 0], [9.25, 18.25], [0, 18.25], [0, 12], [1.2, 12], [1.2, 8], [0, 8]]))
    expect(s).toBeDefined()
    expect(s?.outline.length).toBe(4)
    expect(rectanglesOf(s?.outline ?? []).why).toBe('a rectangle')
    expect(s?.changedM2).toBeCloseTo(4.8, 1)
    expect(s?.share ?? 1).toBeLessThan(OUTLINE_SIMPLIFICATION.stepShare)
  })

  it('an L with a bay reduces to the L; the step is recorded', () => {
    // an L (main 10 × 8, wing 4 × 4) with a 1 × 1.5 bay on the main body's front
    const s = simplifyOutline(P([[0, 0], [4, 0], [4, -1], [5.5, -1], [5.5, 0], [10, 0], [10, 8], [14, 8], [14, 12], [0, 12]]))
    expect(s).toBeDefined()
    expect(s?.outline.length).toBe(6)
    expect(s?.steps.length).toBe(1) // the bay's four corners go in one slide (1.5 m²)
    expect(rectanglesOf(s?.outline ?? []).splits.length).toBe(2)
  })

  it('COUNTER-TRIAL: a plan of three real wings is not reduced (it stays unsupported, by name)', () => {
    // a T: a 12 × 5 bar with a 4 × 7 stem — removing the stem or a bar end costs far more than a step may
    const t = P([[0, 0], [12, 0], [12, 5], [8, 5], [8, 12], [4, 12], [4, 5], [0, 5]])
    expect(simplifyOutline(t)).toBeUndefined()
    expect(rectanglesOf(t).splits.length).toBe(0)
  })

  it('COUNTER-TRIAL: a skewed outline is not touched', () => {
    expect(simplifyOutline(P([[0, 0], [10, 0], [11, 4], [10, 8], [6, 8], [6, 6], [3, 6], [3, 8], [0, 8]]))).toBeUndefined()
  })
})

// v3.54.18 — a change of anything that changes the delivered model must not silently reuse an accepted revision.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { consultBinding } from '../src/consult/accepted-consult.js'

describe('v3.54.18 accepted revision: the key names every version that changes the model', () => {
  it('the consulted binding carries the gate, executor, registry, sketch-proposal, massing (ops and body) and body-arbitration versions', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/consult/consult-analysis.ts', import.meta.url)), 'utf8')
    const line = src.split('\n').find((l) => l.includes('consultant: [CONSULTANT_CONTRACT_VERSION')) ?? ''
    for (const part of ['`registry${CORRECTION_REGISTRY_VERSION}`', '`executor${CORRECTION_EXECUTOR_VERSION}`', '`gate${SOURCE_GATE_VERSION}`', '`sketchProposals${SKETCH_PROPOSALS_VERSION}`', '`massing${MASSING_OPS_VERSION}`', '`massingBody${MASSING_VERSION}`', '`bodyArbitration${BODY_ARBITRATION.version}`']) expect(line).toContain(part)
  })
  it('a different version string is a different key: the old revision is not found, so it cannot be replayed', () => {
    const base = { sourcePackageHash: 'p'.repeat(64), analyzer: 'a', models: { ROUNDS: 'm' }, settings: 's' }
    expect(consultBinding({ ...base, consultant: 'gate1.2.0,massingBody1.0.0' }).key).not.toBe(consultBinding({ ...base, consultant: 'gate1.3.0,massingBody1.1.0' }).key)
  })
})
