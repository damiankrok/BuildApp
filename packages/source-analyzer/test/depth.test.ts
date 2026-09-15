/**
 * The distinction the stage exists for: a solid member versus a painted band.
 *
 * Each case is a minimal pair. The pictures differ by one cue and the verdict
 * changes with it, which is the only way to show that the verdict is being
 * read off the cue rather than off the shape.
 */
import { describe, expect, it } from 'vitest'
import { linearBands, bandConfidence, STRONG_CUES } from '../src/depth.js'
import { axisAlignedSegments, gradientMask } from '@buildapp/source-cv'
import { facadeWithMember, grayOf } from './draw.js'

const bandsFor = (depth: 'shadow' | 'ends' | 'flat', options = {}) => {
  const raster = facadeWithMember(depth, options)
  // Lines come from the EDGE mask: a mid-tone band is one solid region of ink
  // but two distinct edges, and a member is recognised by its edges.
  const edges = gradientMask(grayOf(raster))
  const segments = axisAlignedSegments(edges, { minLength: 8, maxThickness: 4, maxGap: 2 })
  return linearBands(grayOf(raster), segments, { minThicknessFrac: 0.01, maxThicknessFrac: 0.12, minLengthFrac: 0.2 })
}

const member = (bands: ReturnType<typeof bandsFor>) => bands.filter((b) => b.orientation === 'HORIZONTAL' && b.thickness >= 12 && b.length >= 300)[0]

describe('a member is promoted on depth, never on colour', () => {
  it('finds the band in all three drawings: they differ in what it IS, not in whether it is there', () => {
    for (const depth of ['shadow', 'ends', 'flat'] as const) expect(member(bandsFor(depth)), depth).toBeDefined()
  })

  it('reads a cast shadow as depth', () => {
    const band = member(bandsFor('shadow'))
    expect(band.volumetric).toBe(true)
    expect(band.cues.map((c) => c.cue)).toContain('SHADOW')
    expect(band.cues.find((c) => c.cue === 'SHADOW')?.detail).toMatch(/darker than the wall beyond it/)
  })

  it('reads a visible end face as depth', () => {
    const band = member(bandsFor('ends'))
    expect(band.volumetric).toBe(true)
    expect(band.cues.map((c) => c.cue)).toContain('END_FACE')
    expect(band.cues.find((c) => c.cue === 'END_FACE')?.detail).toMatch(/a painted stripe has no way to produce/)
  })

  it('does NOT treat "the band stops here" as an end face: a painted stripe stops too', () => {
    const band = member(bandsFor('flat'))
    expect(band.cues.map((c) => c.cue)).not.toContain('END_FACE')
  })

  it('refuses to promote a band whose only cue is a change of tone', () => {
    const band = member(bandsFor('flat'))
    expect(band.volumetric).toBe(false)
    expect(band.cues.map((c) => c.cue)).toEqual(['TONE_STEP'])
    expect(band.cues[0].detail).toMatch(/on its own it decides nothing/)
  })

  it('is more confident about a member backed by a cue than about one that is not', () => {
    expect(bandConfidence(member(bandsFor('shadow')))).toBeGreaterThan(bandConfidence(member(bandsFor('flat'))))
  })

  it('classifies TONE_STEP as weak and the rest as strong, which is what the promotion rule reads', () => {
    expect(STRONG_CUES.has('TONE_STEP')).toBe(false)
    for (const cue of ['SHADOW', 'END_FACE', 'OCCLUSION_BREAK', 'RETURN_FACE'] as const) expect(STRONG_CUES.has(cue)).toBe(true)
  })

  it('measures the member where it actually is', () => {
    const band = member(bandsFor('shadow', { y: 140, thickness: 20, x0: 80, x1: 500 }))
    expect(band.rect.y0).toBeCloseTo(140, 0)
    expect(band.thickness).toBeCloseTo(20, 0)
    expect(band.rect.x0).toBeGreaterThanOrEqual(78)
    expect(band.rect.x1).toBeLessThanOrEqual(502)
  })

  it('does not call a band volumetric merely because it is thick', () => {
    const thick = member(bandsFor('flat', { thickness: 30 }))
    expect(thick.volumetric).toBe(false)
  })
})
