/**
 * BUILDPLAN-ANALYZER-005Y-N4 (E): AI_SECOND_LOOK on synthetic crops (no publisher pixel, no network, no key).
 *  - an external provider is never asked without the owner's consent: AI_SECOND_LOOK_LIVE_NOT_RUN, and nothing sent;
 *  - a recorded answer that agrees with the reader, one that disagrees, one that matches no candidate;
 *  - a suggestion is validated only where the reader's own check agrees; a provider's answer outside the vocabulary
 *    is refused; the record's provenance is always AI_SUGGESTED, never a source fact.
 */
import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { fixtureKey, fixtureVisionReasoner, nullVisionReasoner, secondLook, secondLookLine } from '../src/index.js'
import type { SecondLookQuestion, VisionReasoner } from '../src/index.js'

// a synthetic crop: the bytes stand for an encoded picture of a ring printed "260/140"; only their hash matters here
const bytes = new TextEncoder().encode('synthetic ring callout 260/140 on a grey floor fill')
const cropHash = createHash('sha256').update(bytes).digest('hex')
const question = (cv: string | null): SecondLookQuestion => ({
  id: 'q-corner-front',
  ambiguity: 'a ring callout beside a corner window read as 700/40, which fits no gap; its glyphs are faint on a grey fill',
  source: { assetId: 'synthetic-plan', assetByteHash: 'a'.repeat(64), cropRectPx: { x0: 130, y0: 590, x1: 190, y1: 640 } },
  crop: { bytes, byteHash: cropHash, mediaType: 'image/png', width: 60, height: 50 },
  hypotheses: [
    { id: 'h-260', text: '260/140' },
    { id: 'h-700', text: '700/40' },
  ],
  cv: { hypothesisId: cv, why: 'the deterministic reading' },
})
const answer = (text: string, kind = 'PRINTED_DIMENSION') => ({
  key: fixtureKey('PLAN_INTERPRETATION', cropHash),
  task: 'PLAN_INTERPRETATION' as const,
  assetByteHash: cropHash,
  recordedFrom: { id: 'vision.handwritten', model: 'none', version: 'synthetic' },
  recordedNote: 'hand-written for a synthetic crop',
  response: { task: 'PLAN_INTERPRETATION', assetByteHash: cropHash, observations: [{ kind, semanticHints: [], geometry: { type: 'RECT', points: [[0.2, 0.2], [0.8, 0.8]] }, confidence: 0.8, positionUncertaintyNorm: 0.05, evidence: 'the digits inside the ring', value: { unit: 'text', text } }], relations: [] },
})

describe('AI_SECOND_LOOK', () => {
  it('does not send a crop to an external provider without the owner’s consent', async () => {
    const analyze = vi.fn()
    const external: VisionReasoner = { provider: { id: 'vision.anthropic', model: 'any', version: '1' }, available: () => true, analyze }
    const r = await secondLook(question(null), external)
    expect(r.status).toBe('AI_SECOND_LOOK_LIVE_NOT_RUN')
    expect(analyze).not.toHaveBeenCalled()
    expect(secondLookLine(r)).toMatch(/^AI_SECOND_LOOK_LIVE_NOT_RUN/)
  })
  it('does not run with consent but no credentials', async () => {
    const external: VisionReasoner = { provider: { id: 'vision.anthropic', model: 'any', version: '1' }, available: () => false, analyze: vi.fn() }
    expect((await secondLook(question(null), external, { ownerConsent: true })).status).toBe('AI_SECOND_LOOK_LIVE_NOT_RUN')
  })
  it('records a recorded answer beside the reader’s, and validates it only where the reader’s check agrees', async () => {
    const reasoner = fixtureVisionReasoner([answer('260 / 140')])
    const r = await secondLook(question('h-700'), reasoner, { validate: (id) => id === 'h-260' })
    expect(r).toMatchObject({ status: 'ANSWERED', aiSays: '260 / 140', aiHypothesisId: 'h-260', cvSays: '700/40', agreement: 'DISAGREE', provenance: 'AI_SUGGESTED' })
    expect(r.modes).toEqual({ CV_ONLY: '700/40', CV_AI_SUGGESTION: '260/140', CV_AI_VALIDATED: '260/140' })
    expect(secondLookLine(r)).toBe('AI_SAYS_260 / 140 / CV_SAYS_700/40 (DISAGREE, validated 260/140)')
    const unchecked = await secondLook(question('h-700'), reasoner, { validate: () => false })
    expect(unchecked.modes.CV_AI_VALIDATED).toBeNull()
  })
  it('agrees, or matches nothing, as the text says', async () => {
    expect((await secondLook(question('h-260'), fixtureVisionReasoner([answer('260/140')]))).agreement).toBe('AGREE')
    const odd = await secondLook(question('h-260'), fixtureVisionReasoner([answer('250/140')]))
    expect(odd).toMatchObject({ agreement: 'AI_UNMATCHED', aiHypothesisId: null, modes: { CV_AI_SUGGESTION: null, CV_AI_VALIDATED: null } })
  })
  it('refuses an answer outside the plan vocabulary', async () => {
    const r = await secondLook(question(null), fixtureVisionReasoner([answer('260/140', 'ROOF_PLANE')]))
    expect(r.status).toBe('REJECTED')
  })
  it('records that nobody looked when no provider is configured', async () => {
    expect((await secondLook(question(null), nullVisionReasoner())).status).toBe('NO_ANSWER')
  })
})
