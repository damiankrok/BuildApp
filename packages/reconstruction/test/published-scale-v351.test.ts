/**
 * v3.51 ANY-LINK: the last-resort plan scale from the published footprint (`published-scale.ts`). The whole path is
 * measured on real pages (research/source-to-model/ANYLINK-SET.json and the corpus replays); here, what it must never
 * do: answer without a published area, without a readable sheet, or as anything but an approximation.
 */
import { describe, expect, it } from 'vitest'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { PUBLISHED_SCALE_PROVENANCE, scaleFromPublishedFootprint } from '../src/v2/published-scale.js'
import type { StructuralPassOptions } from '../src/structural.js'
import { metricsOf } from './plan.js'

const frame = { id: 'frame-plan', assetId: 'asset-plan', variantByteHash: 'a'.repeat(64), size: { width: 800, height: 600 }, roles: { projection: 'ORTHOGRAPHIC_PLAN', document: 'FLOOR_PLAN', storey: 'GROUND' } } as unknown as SourceCoordinateFrame
const options = (raster: StructuralPassOptions['raster']): StructuralPassOptions => ({ metrics: metricsOf([], []), raster, graph: { coordinateFrames: [frame], observations: [] } } as unknown as StructuralPassOptions)

describe('the published-footprint scale is a last resort and says so', () => {
  it('no published area, or an implausible one: no scale', () => {
    expect(scaleFromPublishedFootprint(options(() => undefined), frame, 0)).toBeUndefined()
    expect(scaleFromPublishedFootprint(options(() => undefined), frame, 8)).toBeUndefined()
  })
  it('a sheet whose pixels cannot be read: no scale (the figure alone states nothing)', () => {
    expect(scaleFromPublishedFootprint(options(() => undefined), frame, 120)).toBeUndefined()
  })
  it('its provenance names the reconstruction, not a reader of printed dimensions', () => {
    expect(PUBLISHED_SCALE_PROVENANCE).toMatch(/^reconstruction\.published-footprint-scale@/)
  })
})
