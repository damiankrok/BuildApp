/**
 * A plan's scale must be one its own drawing can be at (BUILDAPP-03Y2G).
 *
 * The chain vote asks only whether printed numbers agree with one another,
 * and misreadings of an unfamiliar typeface can agree on a scale three times
 * the real one. These tests hold the check that rules such a scale out, the
 * rule for what may replace it, and that a plausible winner is never touched.
 */
import { describe, expect, it } from 'vitest'
import { fillRect, whiteRaster, BLACK, drawLine } from '../../source-cv/test/draw.js'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'
import { PLAN_OUTER_WALL_M, decideScale, markerApexBelow, planScalePlausibility, scaleCandidates, voteScale } from '../src/index.js'
import type { ScalePlausibility, ScaleProposal } from '../src/index.js'

/** One number over one span on one chain. */
const p = (chain: number, tokenIndex: number, valueCm: number, pixelLength: number, weight = pixelLength / 50): ScaleProposal => ({
  chain,
  tokenIndex,
  fromTick: 0,
  toTick: 1,
  cmPerPixel: valueCm / pixelLength,
  pixelLength,
  weight,
  valueCm,
  text: String(valueCm),
  confidence: 1,
  substitutions: 0,
})

/** Walls drawn 17 px thick: plausible between 0.15/17 and 0.8/17 m per px. */
const walls17: ScalePlausibility = (cm) => {
  const m = (17 * cm) / 100
  return { plausible: m >= PLAN_OUTER_WALL_M.min && m <= PLAN_OUTER_WALL_M.max, why: `${m} m` }
}

// A sheet at 2.75 cm/px whose OCR read four short spans right (on four chains)
// and five wrong — the long ones among them — in a way that happens to agree
// on 8.5 cm/px, which therefore outweighs the truth in the vote.
const TRUE = [p(0, 0, 196, 71), p(1, 0, 110, 40), p(2, 0, 160, 58), p(3, 0, 210, 76)]
const MISREAD = [p(4, 0, 4551, 534.5), p(5, 0, 827, 97), p(6, 0, 517, 60.7), p(7, 0, 515, 60.5), p(8, 0, 354, 41.6)]

describe('the frame scale is the vote’s winner unless the drawing rules it out', () => {
  it('the vote alone takes the misread scale (the failure this stage found)', () => {
    const vote = voteScale([...TRUE, ...MISREAD], 2.2)
    expect(vote?.cmPerPixel).toBeCloseTo(8.51, 1)
  })

  it('a scale that makes the walls 1.4 m thick is ruled out; the best-supported plausible one — stated by several numbers on several chains — is taken, and the decision recorded', () => {
    const all = [...TRUE, ...MISREAD]
    const vote = voteScale(all, 2.2)!
    const decided = decideScale(all, vote, 2.2, walls17)
    expect(decided.cmPerPixel).toBeCloseTo(2.76, 1)
    expect(decided.decision?.rejected.cmPerPixel).toBeCloseTo(8.51, 1)
    expect(decided.decision?.rejected.why).toMatch(/m/)
    expect(decided.decision?.chosen?.support).toBeGreaterThanOrEqual(3)
    expect(decided.decision?.chosen?.chains).toBeGreaterThanOrEqual(2)
  })

  it('a plausible winner is never replaced, and no decision is recorded', () => {
    const vote = voteScale(TRUE, 2.2)!
    const decided = decideScale(TRUE, vote, 2.2, walls17)
    expect(decided.cmPerPixel).toBe(vote.cmPerPixel)
    expect(decided.decision).toBeUndefined()
  })

  it('an implausible winner with no alternative stated by three numbers on two chains leaves the plan WITHOUT a scale — never one chosen for plausibility alone', () => {
    const lone = [p(0, 0, 196, 71), p(1, 0, 110, 40)] // only two numbers support the true scale
    const all = [...lone, ...MISREAD]
    const decided = decideScale(all, voteScale(all, 2.2)!, 2.2, walls17)
    expect(decided.cmPerPixel).toBeUndefined()
    expect(decided.decision?.chosen).toBeNull()
  })

  it('lists every distinct candidate once, strongest first', () => {
    const c = scaleCandidates([...TRUE, ...MISREAD], 2.2)
    expect(c[0].cmPerPixel).toBeCloseTo(8.51, 1)
    expect(c.some((x) => Math.abs(x.cmPerPixel - 2.75) < 0.02)).toBe(true)
    const ratios = c.map((x) => x.cmPerPixel).sort((a, b) => a - b)
    for (let i = 1; i < ratios.length; i++) expect(Math.log(ratios[i] / ratios[i - 1])).toBeGreaterThan(0.01)
  })
})

describe('the plausibility check reads the plan’s own walls', () => {
  it('judges by the heavier walls: outer walls 16 px and partitions 6 px, at 2.75 cm/px, are plausible; at 8.5 they are not', () => {
    const r = whiteRaster(400, 400)
    fillRect(r, 40, 40, 360, 55, BLACK)
    fillRect(r, 40, 344, 360, 359, BLACK)
    fillRect(r, 40, 40, 55, 359, BLACK)
    fillRect(r, 344, 40, 359, 359, BLACK)
    for (let k = 0; k < 4; k += 1) fillRect(r, 60, 100 + k * 50, 340, 105 + k * 50, BLACK)
    const check = planScalePlausibility(adaptiveInkMask(inkChannel(r), {}))!
    expect(check(2.75).plausible).toBe(true)
    expect(check(8.5).plausible).toBe(false)
    expect(check(0.66).plausible).toBe(false)
  })

  it('says nothing about a sheet with no heavy bands', () => {
    const r = whiteRaster(200, 200)
    drawLine(r, 10, 10, 190, 10, BLACK)
    expect(planScalePlausibility(adaptiveInkMask(inkChannel(r), {}))).toBeUndefined()
  })
})

describe('a level symbol with no rule still marks its row', () => {
  it('finds the apex of a thin, light ▽ under the height, below its top edge', () => {
    const r = whiteRaster(200, 120)
    const grey: [number, number, number] = [170, 170, 170]
    // the text box sits at y 20..46; the symbol's top edge at y 50, its apex at y 62, centred on x 100
    drawLine(r, 93, 50, 130, 50, grey)
    for (let y = 50; y <= 62; y += 1) {
      const d = (62 - y) * 0.577 // an equilateral symbol
      if (y % 3 !== 0) {
        fillRect(r, Math.round(100 - d), y, Math.round(100 - d), y, grey)
        fillRect(r, Math.round(100 + d), y, Math.round(100 + d), y, grey)
      }
    }
    const apex = markerApexBelow(r, { x0: 80, y0: 20, x1: 140, y1: 46 })
    expect(apex?.row).toBeGreaterThanOrEqual(61)
    expect(apex?.row).toBeLessThanOrEqual(63)
    expect(Math.abs((apex?.x ?? 0) - 100)).toBeLessThanOrEqual(1)
  })

  it('finds nothing under a height with only a digit-like mark beneath it', () => {
    const r = whiteRaster(200, 120)
    fillRect(r, 95, 55, 99, 70, BLACK)
    expect(markerApexBelow(r, { x0: 80, y0: 20, x1: 140, y1: 46 })).toBeUndefined()
  })
})
