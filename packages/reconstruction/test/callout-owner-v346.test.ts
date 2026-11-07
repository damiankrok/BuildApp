/**
 * v3.46: one callout, one opening. Invented plan geometry in world metres: a front wall along x with its centre line at
 * z = -0.2 and an east wall along z with its centre line at x = 10.2; callout rings printed outside the walls.
 */
import { describe, expect, it } from 'vitest'
import { calloutOwners, matchOpeningCallout } from '../src/v2/opening-reading.js'
import type { CalloutOwnerGap, NearbyCallout } from '../src/v2/opening-reading.js'

const ring = (id: string, x: number, z: number, w: number, h: number): NearbyCallout => ({ id, confidence: 0.9, textCentre: { x, z }, pixelCentre: [0, 0], candidates: { widths: [{ cm: w, score: 0.9 }], heights: [{ cm: h, score: 0.9 }] } })
const front = (key: string, centre: number, widthM: number): CalloutOwnerGap => ({ key, facade: 'FRONT', centre, centreAt: -0.2, widthM })
const east = (key: string, centre: number, widthM: number): CalloutOwnerGap => ({ key, facade: 'EAST', centre, centreAt: 10.2, widthM })
const FRONT = { facade: 'FRONT' as const, centreAt: -0.2 }

describe('v3.46: which gap a printed callout belongs to', () => {
  it('twin windows, only the right one’s ring read: the ring belongs to the right one, and the left takes nothing (it took the twin’s before)', () => {
    const gaps = [front('L', 2.9, 0.8), front('R', 4.2, 0.8)]
    const rings = [ring('cR', 4.2, -1.0, 80, 230)]
    const owners = calloutOwners(gaps, rings, 2)
    expect(owners.get('cR')).toBe('R')
    expect(matchOpeningCallout({ centre: 2.9, widthM: 0.8 }, FRONT, rings, 2, false, { owners, key: 'L' }).callout).toBeUndefined()
    expect(matchOpeningCallout({ centre: 4.2, widthM: 0.8 }, FRONT, rings, 2, false, { owners, key: 'R' }).callout?.evidenceId).toBe('cR')
    // before v3.46 (no ownership) the left gap took its twin's ring
    expect(matchOpeningCallout({ centre: 2.9, widthM: 0.8 }, FRONT, rings, 2, false).callout?.evidenceId).toBe('cR')
  })

  it('opposite: twins whose rings are both read each keep their own', () => {
    const gaps = [front('L', 2.9, 0.8), front('R', 4.2, 0.8)]
    const rings = [ring('cL', 2.9, -1.0, 80, 230), ring('cR', 4.2, -1.0, 80, 230)]
    const owners = calloutOwners(gaps, rings, 2)
    expect([owners.get('cL'), owners.get('cR')]).toEqual(['L', 'R'])
    expect(matchOpeningCallout({ centre: 2.9, widthM: 0.8 }, FRONT, rings, 2, false, { owners, key: 'L' }).callout?.evidenceId).toBe('cL')
  })

  it('a ring by a corner belongs to the nearer of the two walls’ gaps, not to both', () => {
    const gaps = [front('F', 9.0, 1.5), east('E', 1.0, 1.5)]
    const owners = calloutOwners(gaps, [ring('c', 9.2, -0.9, 150, 140)], 2)
    expect(owners.get('c')).toBe('F')
  })

  it('a nearer gap the callout’s width does not fit does not own it', () => {
    const gaps = [front('narrow', 4.0, 0.6), front('wide', 5.4, 1.5)]
    const owners = calloutOwners(gaps, [ring('c', 4.4, -1.0, 150, 140)], 2)
    expect(owners.get('c')).toBe('wide')
  })

  it('a callout no gap fits belongs to none, and stays available as before', () => {
    const owners = calloutOwners([front('g', 3, 0.8)], [ring('c', 3, -1, 300, 230)], 2)
    expect(owners.has('c')).toBe(false)
  })
})
