/**
 * SHAPE-LIVE-01: the highest datum a reader managed to read off a section is the ridge only when nothing of the
 * building is drawn far above it. Every section here is drawn in the test from invented dimensions: two walls, a
 * ground slab, an attic slab and a gable roof; the datums are placed on the sheet's own scale, as the reader gives them.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { levelsFrom } from '../src/index.js'
import { readDrawnApex, readTopDatum } from '../src/v2/section-datums.js'
import { topDatumBelowPublishedHeight } from '../src/v2/roof-datum.js'
import { metricsOf } from './plan.js'

const PPM = 60 // pixels per metre on the sheet
const W = 900
const H = 700
const ZERO_ROW = 620
const rowOf = (m: number): number => Math.round(ZERO_ROW - m * PPM)

function sheet(withRoof: boolean, chimneyOnly = false, pitchDeg = 40): Raster {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const ink = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const o = (y * W + x) * 4
    data[o] = 20
    data[o + 1] = 20
    data[o + 2] = 20
  }
  const rect = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) ink(x, y)
  }
  const wallL = 150
  const wallR = 750
  // the outer walls from the ground slab to the eaves (3.3 m), the ground slab and the attic slab at 2.95
  rect(wallL, rowOf(3.3), wallL + 25, ZERO_ROW + 20)
  rect(wallR - 25, rowOf(3.3), wallR, ZERO_ROW + 20)
  rect(wallL, ZERO_ROW, wallR, ZERO_ROW + 20)
  rect(wallL, rowOf(2.95), wallR, rowOf(2.95) + 16)
  if (withRoof) {
    // a gable (40° unless given) from eave tips 0.6 m past the walls up to the ridge at mid span
    const e0 = wallL - 36
    const e1 = wallR + 36
    const mid = (e0 + e1) / 2
    const tan = Math.tan((pitchDeg * Math.PI) / 180)
    for (let x = e0; x <= e1; x += 1) {
      const y = Math.round(rowOf(3.3) - (Math.min(x - e0, e1 - x) * tan))
      rect(x, y, x, y + 4)
    }
    void mid
  }
  if (chimneyOnly) rect(420, rowOf(5.5), 450, rowOf(3.3))
  return { width: W, height: H, data }
}

const datum = (value: number, i: number, row?: number): MetricEvidence =>
  ({
    id: `metric-level-${i}`,
    kind: 'LEVEL_DATUM',
    frameId: 'frame-section',
    assetId: 'asset-section',
    variantByteHash: 'a'.repeat(64),
    value,
    unit: 'm',
    origin: 'READ',
    rawText: String(value),
    association: { kind: 'LEVEL_MARKER', score: 0.6, why: 'a fixture', observationIds: [] },
    ocrTokenIds: [],
    observationIds: [],
    alternatives: [],
    confidence: 0.8,
    provenance: { name: 'test', detail: 'a fixture', extractor: 'DERIVED' },
    measuredGeometry: { type: 'SEGMENT', a: { x: 800, y: row ?? rowOf(value) }, b: { x: 802, y: row ?? rowOf(value) } },
  }) as MetricEvidence

const withDatums = (values: number[]): MetricEvidenceSet => ({ ...metricsOf([], []), evidence: values.map((v, i) => datum(v, i)) })

describe('the highest datum read is the ridge only when no roof is drawn above it', () => {
  it('an eave mark under a drawn gable is refused as the ridge, and not kept as a floor', () => {
    const raster = sheet(true)
    const levels = levelsFrom(withDatums([0, 3.3]), 'frame-section', (d) => readTopDatum(raster, d))
    expect(levels.topDatum).toBeUndefined()
    expect(levels.floors).toEqual([0])
    expect(levels.topRefused).toMatchObject({ value: 3.3, keptAsFloor: false })
  })

  it('an attic-floor mark under a drawn gable is refused as the ridge, read as a slab, and still adds no storey', () => {
    const raster = sheet(true)
    const levels = levelsFrom(withDatums([0, 2.95]), 'frame-section', (d) => readTopDatum(raster, d))
    expect(levels.topDatum).toBeUndefined()
    // which storeys the house has is the plans' to say: a slab under the roof is the top of the walls below it
    expect(levels.floors).toEqual([0])
    expect(levels.heights).toEqual([2.95])
    expect(levels.topRefused).toMatchObject({ keptAsFloor: false, onSlab: true })
  })

  it('a ridge mark at the apex stands: nothing is drawn above it', () => {
    const raster = sheet(true)
    const apex = 3.3 + ((600 + 72) / 2 / PPM) * Math.tan((40 * Math.PI) / 180)
    const levels = levelsFrom(withDatums([0, 3.3, Math.round(apex * 100) / 100]), 'frame-section', (d) => readTopDatum(raster, d))
    expect(levels.topRefused).toBeUndefined()
    expect(levels.topDatum).toBeCloseTo(apex, 2)
    expect(levels.eaves).toBe(3.3)
  })

  it('a chimney standing above the top datum is not a roof: the datum stands', () => {
    const raster = sheet(false, true)
    const levels = levelsFrom(withDatums([0, 3.3]), 'frame-section', (d) => readTopDatum(raster, d))
    expect(levels.topRefused).toBeUndefined()
    expect(levels.topDatum).toBe(3.3)
  })

  it('without a raster the rule is silent and the old reading stands', () => {
    expect(levelsFrom(withDatums([0, 3.3]), 'frame-section').topDatum).toBe(3.3)
  })

  it('datums placed off the scale their extremes give are no scale: no verdict', () => {
    const raster = sheet(true)
    expect(readTopDatum(raster, [{ id: 'a', value: 0, row: ZERO_ROW }, { id: 'b', value: 1.2, row: rowOf(1.2) }, { id: 'c', value: 3.3, row: rowOf(2.2) }])).toBeUndefined()
  })
})

describe('the ridge measured where the section draws it', () => {
  const datums = [
    { id: 'zero', value: 0, row: ZERO_ROW },
    { id: 'eaves', value: 3.3, row: rowOf(3.3) },
  ]
  it('two flanks at the stated pitch meet at the drawn apex, on the scale the datums give', () => {
    const apex = readDrawnApex(sheet(true), datums, 40)
    // drawn: eave tips 0.6 m past 10 m of walls, at 40° → 3.3 + 5.6 · tan 40° ≈ 8.0 m
    expect(apex?.ridgeY).toBeCloseTo(3.3 + 5.6 * Math.tan((40 * Math.PI) / 180), 1)
  })
  it('a sheet without a drawn roof gives no apex, and a chimney is not one', () => {
    expect(readDrawnApex(sheet(false, true), datums, 40)).toBeUndefined()
  })
  it('the wrong pitch finds no two flanks to agree on', () => {
    expect(readDrawnApex(sheet(true), datums, 15)).toBeUndefined()
  })
})

describe('EXTERIOR-COMPLETE: a low roof over an eave mark, refused by the published height the drawing agrees with', () => {
  // an 18° gable over 10 m of walls rises 5.6 m · tan 18° ≈ 1.82 m above the eaves: under the 1.5 m the drawing check
  // asks of 30% of the width, so the drawing alone does not refuse the eave mark
  const rise = 5.6 * Math.tan((18 * Math.PI) / 180)
  const datums = [
    { id: 'zero', value: 0, row: ZERO_ROW },
    { id: 'eaves', value: 3.3, row: rowOf(3.3) },
  ]
  const height = (H: number) => [{ key: 'building_height', value: H, unit: 'm' }]
  it('the drawing alone does not refuse it, but measures the rise it carries across the building', () => {
    const top = readTopDatum(sheet(true, false, 18), datums)
    expect(top?.belowDrawnRoof).toBe(false)
    expect(top?.riseAtShare).toBeGreaterThan(0.9)
    expect(top?.riseAtShare).toBeLessThan(rise)
  })
  it('a published height well above the eave mark, with the drawing agreeing, refuses it as the ridge', () => {
    const top = readTopDatum(sheet(true, false, 18), datums)
    const why = topDatumBelowPublishedHeight({ topDatum: 3.3, drawnRise: top?.riseAtShare, publishedFacts: height(3.3 + rise + 0.3), printedTerrainY: -0.3 })
    expect(why).toMatch(/not the ridge/)
  })
  it('the ridge is then measured where the drawing puts it', () => {
    const apex = readDrawnApex(sheet(true, false, 18), datums, 18, { topRefused: true })
    expect(apex?.ridgeY).toBeCloseTo(3.3 + rise, 1)
  })
  it('a published height alone never refuses a datum the drawing shows nothing over (a chimney is narrow)', () => {
    const top = readTopDatum(sheet(false, true), datums)
    expect(topDatumBelowPublishedHeight({ topDatum: 3.3, drawnRise: top?.riseAtShare, publishedFacts: height(5.8), printedTerrainY: -0.3 })).toBeUndefined()
  })
  it('a published height the top datum already explains (terrain and roof build-up) refuses nothing', () => {
    expect(topDatumBelowPublishedHeight({ topDatum: 7.67, drawnRise: 2, publishedFacts: height(7.97), printedTerrainY: -0.3 })).toBeUndefined()
    expect(topDatumBelowPublishedHeight({ topDatum: 7.4, drawnRise: 2, publishedFacts: height(8.4) })).toBeUndefined()
  })
  it('without a published height, or with two, nothing is refused', () => {
    expect(topDatumBelowPublishedHeight({ topDatum: 3.3, drawnRise: 2, publishedFacts: [] })).toBeUndefined()
    expect(topDatumBelowPublishedHeight({ topDatum: 3.3, drawnRise: 2, publishedFacts: [...height(6), ...height(7)] })).toBeUndefined()
  })
})
