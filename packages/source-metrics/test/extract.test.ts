import { describe, expect, it } from 'vitest'
import { LARCHFIELD, renderElevation, renderGroundPlan, renderSection } from '@buildapp/synthetic-drawings'
import { sha256Hex } from '@buildapp/source-common'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import type { Raster } from '@buildapp/source-cv'
import { MetricEvidenceSetSchema, extractMetricEvidence, metricEvidenceContentHash } from '../src/index.js'

/**
 * The whole metric pass, run on a house that exists nowhere but in the fixture.
 *
 * The sheets are rendered from a spec with a known answer and then handed to
 * the reader as pixels. Nothing below the renderer knows what building this
 * is, what it measures, or that the answer is written down anywhere.
 */
const sheets = (): Array<{ frame: SourceCoordinateFrame; raster: Raster }> => {
  const make = (slug: string, projection: string, storey: string, raster: Raster) => ({
    frame: {
      id: `frame-${slug}`,
      assetId: `asset-${slug}`,
      variantByteHash: sha256Hex(slug).padEnd(64, '0').slice(0, 64),
      size: { width: raster.width, height: raster.height },
      roles: { document: projection === 'ORTHOGRAPHIC_PLAN' ? 'FLOOR_PLAN' : projection === 'ORTHOGRAPHIC_SECTION' ? 'SECTION' : 'ELEVATION', storey, annotation: 'DIMENSIONED', view: 'NOT_APPLICABLE', projection },
    } as SourceCoordinateFrame,
    raster,
  })
  return [
    make('plan', 'ORTHOGRAPHIC_PLAN', 'GROUND', renderGroundPlan(LARCHFIELD).toRaster()),
    make('section', 'ORTHOGRAPHIC_SECTION', 'NOT_APPLICABLE', renderSection(LARCHFIELD).toRaster()),
    make('front', 'ORTHOGRAPHIC_ELEVATION', 'NOT_APPLICABLE', renderElevation(LARCHFIELD, 'FRONT').toRaster()),
  ]
}

const graphOf = (frames: SourceCoordinateFrame[]): SourceObservationGraph => ({
  schema: 'buildapp.source-observation-graph',
  schemaVersion: '1.0.0',
  id: 'obsgraph-synthetic',
  sourcePackageId: 'pkg-synthetic',
  sourcePackageHash: 'b'.repeat(64),
  extractors: [],
  coordinateFrames: frames,
  observations: [],
  relations: [],
  conflicts: [],
  unresolved: [],
  contentHash: 'c'.repeat(64),
})

const run = () => {
  const built = sheets()
  const byFrame = new Map(built.map((s) => [s.frame.id, s.raster]))
  return extractMetricEvidence({
    sourcePackageId: 'pkg-synthetic',
    sourcePackageHash: 'b'.repeat(64),
    graph: graphOf(built.map((s) => s.frame)),
    raster: (frame) => byFrame.get(frame.id),
    slug: 'synthetic',
  })
}

describe('the metric pass, end to end on a house the pipeline has never seen', () => {
  const set = run()

  it('produces a valid, sealed, self-describing set', () => {
    expect(MetricEvidenceSetSchema.safeParse(set).success).toBe(true)
    expect(set.schemaVersion).toBe('1.0.0')
    expect(set.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(set.id).toContain(set.contentHash.slice(0, 16))
    expect(set.sourcePackageHash).toBe('b'.repeat(64))
    expect(set.observationGraphHash).toBe('c'.repeat(64))
    expect(set.extractors.map((e) => e.name)).toContain('metrics.numeric-ocr')
  })

  it('recovers the plan dimensions the sheet prints, in centimetres', () => {
    const plan = set.evidence.filter((e) => e.frameId === 'frame-plan' && e.kind === 'LINEAR_DIMENSION')
    const values = plan.filter((e) => e.origin !== 'DERIVED').map((e) => e.value)
    for (const truth of [960, 240, 480, 720, 180, 360]) expect(values, `the sheet prints ${truth}`).toContain(truth)
  })

  it('derives each chain total from its parts and finds it equals the overall dimension printed above it', () => {
    const chains = set.chains.filter((c) => c.frameId === 'frame-plan' && c.segments.length > 1)
    const totals = chains.map((c) => c.derivedTotalCm)
    expect(totals).toContain(960)
    expect(totals).toContain(720)
    const overall = set.chains.filter((c) => c.frameId === 'frame-plan' && c.segments.length === 1).map((c) => c.derivedTotalCm)
    expect(overall).toContain(960)
    expect(overall).toContain(720)
  })

  it('registers the plan against the scale it was drawn at, both axes, with a small residual', () => {
    const plan = set.coordinateRegistrations.find((r) => r.frameId === 'frame-plan')
    expect(plan).toBeDefined()
    if (!plan) return
    expect(plan.plane).toBe('PLAN_XZ')
    // The sheet was drawn at 38 pixels to the metre.
    expect(plan.metresPerPixelX).toBeCloseTo(1 / 38, 3)
    expect(plan.metresPerPixelY).toBeCloseTo(1 / 38, 3)
    expect(plan.anisotropy).toBeLessThan(1.02)
    expect(plan.residual.rmsM).toBeLessThan(0.03)
    expect(plan.anchors.length).toBeGreaterThanOrEqual(4)
    expect(plan.flipY).toBe(true)
  })

  it('reads the section as a ladder of heights and registers the vertical from it', () => {
    const levels = set.evidence.filter((e) => e.kind === 'LEVEL_DATUM').map((e) => e.value).sort((a, b) => a - b)
    expect(levels).toEqual([0, 2.8, 5.4, 7.92])
    const section = set.coordinateRegistrations.find((r) => r.frameId === 'frame-section')
    expect(section?.plane).toBe('SECTION_HY')
    expect(section?.metresPerPixelY).toBeCloseTo(1 / 38, 3)
  })

  it('never discards the characters it read, even where the chain overrode them', () => {
    for (const e of set.evidence) {
      if (e.origin === 'DERIVED') continue
      expect(e.rawText.length, `${e.id} keeps what was read`).toBeGreaterThan(0)
      expect(e.ocrTokenIds.length).toBeGreaterThan(0)
      for (const id of e.ocrTokenIds) expect(set.ocrTokens.some((t) => t.id === id)).toBe(true)
    }
    for (const token of set.ocrTokens) expect(token.text.length).toBeGreaterThan(0)
  })

  it('says what it could not do rather than leaving it out', () => {
    // The elevation prints no dimension and no datum, so it states no scale.
    expect(set.coordinateRegistrations.some((r) => r.frameId === 'frame-front')).toBe(false)
    const gap = set.unresolved.find((u) => u.frameId === 'frame-front' && u.what.includes('registration'))
    expect(gap).toBeDefined()
    expect(gap?.status).toBe('MISSING')
    expect(gap?.reason).toMatch(/states no scale of its own/)
  })

  it('every piece of evidence says what it is attached to, and an unattached number says that too', () => {
    for (const e of set.evidence) {
      expect(e.association.why.length).toBeGreaterThan(0)
      if (e.association.kind === 'UNATTACHED') expect(e.association.score).toBe(0)
      else expect(e.association.score).toBeGreaterThan(0)
    }
  })
})

describe('the content hash', () => {
  it('is the same for two runs over the same bytes', () => {
    expect(run().contentHash).toBe(run().contentHash)
  })

  it('does not change when the prose changes, and does change when a reading does', () => {
    const set = run()
    const reworded = {
      ...set,
      evidence: set.evidence.map((e) => ({ ...e, note: 'rewritten for a human', provenance: { ...e.provenance, detail: 'said differently' }, association: { ...e.association, why: 'explained differently' } })),
      unresolved: set.unresolved.map((u) => ({ ...u, reason: `${u.reason}, restated` })),
    }
    expect(metricEvidenceContentHash(reworded)).toBe(set.contentHash)
    const moved = { ...set, evidence: set.evidence.map((e, i) => (i === 0 ? { ...e, value: e.value + 1 } : e)) }
    expect(metricEvidenceContentHash(moved)).not.toBe(set.contentHash)
  })

  it('changes when a reader version changes: a different reader is a different reading', () => {
    const set = run()
    const bumped = { ...set, extractors: set.extractors.map((e, i) => (i === 0 ? { ...e, version: '9.9.9' } : e)) }
    expect(metricEvidenceContentHash(bumped)).not.toBe(set.contentHash)
  })

  it('is tied to the exact source bytes and the exact observation graph it was read from', () => {
    const set = run()
    expect(metricEvidenceContentHash({ ...set, sourcePackageHash: 'd'.repeat(64) })).not.toBe(set.contentHash)
    expect(metricEvidenceContentHash({ ...set, observationGraphHash: 'd'.repeat(64) })).not.toBe(set.contentHash)
  })

  it('does not depend on the order things were found in', () => {
    const set = run()
    const shuffled = { ...set, evidence: [...set.evidence].reverse(), ocrTokens: [...set.ocrTokens].reverse(), chains: [...set.chains].reverse() }
    expect(metricEvidenceContentHash(shuffled)).toBe(set.contentHash)
  })
})
