/**
 * Mutation tests for STAGE BUILDAPP-02.
 *
 * Each case changes ONE thing about a project's sources — the change the brief
 * names — and asserts that the pipeline either catches it or becomes
 * appropriately less certain. A test that passes whether or not the mutation
 * was applied proves nothing, so every case below asserts against the
 * unmutated run as well.
 */
import { describe, expect, it } from 'vitest'
import { VisionResponseRejected, validateVisionResponse } from '@buildapp/source-vision'
import type { VisionObservationRequest } from '@buildapp/source-vision'
import { ObservationGraphBuilder } from '@buildapp/source-observations'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { rectIoU } from '@buildapp/source-common'
import { sourcePackageContentHash } from '@buildapp/source-package'
import { analyzeSourcePackage } from '../src/index.js'
import { analyseScene, crop, downscale, mirror, scene } from './scene.js'
import type { SceneDrawing } from './scene.js'
import { BLACK, WALL, fill, line, planStair, rectOutline, sheet } from './draw.js'
import type { Raster } from '@buildapp/source-cv'

// ---------------------------------------------------------------------------
// the project the mutations are applied to
// ---------------------------------------------------------------------------

type FacadeOptions = { openings?: number; member?: 'solid' | 'flat' | 'none'; recessReturns?: 0 | 1 | 2 }

/**
 * A facade: a wall, a run of openings, one long horizontal member, and a
 * recess with side returns. Every mutation below removes or alters exactly one
 * of those.
 */
function facade(options: FacadeOptions = {}): Raster {
  const { openings = 3, member = 'solid', recessReturns = 2 } = options
  const r = sheet(900, 460)
  fill(r, 40, 60, 860, 420, WALL)
  rectOutline(r, 40, 60, 860, 420, BLACK)
  for (let i = 0; i < openings; i += 1) {
    const x = 90 + i * 150
    fill(r, x, 250, x + 90, 380, [120, 130, 140])
    rectOutline(r, x, 250, x + 90, 380, BLACK, 2)
  }
  if (member !== 'none') {
    const y = 140
    const t = 26
    fill(r, 70, y, 830, y + t, [198, 192, 182])
    line(r, 70, y, 830, y, BLACK)
    line(r, 70, y + t, 830, y + t, BLACK)
    if (member === 'solid') {
      // a cast shadow below it, and its own end faces
      fill(r, 70, y + t + 1, 830, y + t + 9, [148, 144, 136])
      fill(r, 70, y + 1, 78, y + t - 1, [160, 154, 146])
      fill(r, 822, y + 1, 830, y + t - 1, [160, 154, 146])
    }
  }
  // a recess: a darker region with vertical returns closing its ends
  fill(r, 600, 200, 810, 400, [150, 148, 145])
  rectOutline(r, 600, 200, 810, 400, BLACK)
  if (recessReturns >= 1) {
    fill(r, 600, 200, 614, 400, [186, 182, 176])
    line(r, 614, 200, 614, 400, BLACK)
  }
  if (recessReturns >= 2) {
    fill(r, 796, 200, 810, 400, [186, 182, 176])
    line(r, 796, 200, 796, 400, BLACK)
  }
  return r
}

/** A section: level datums, two pitch lines meeting at a ridge. */
function section(): Raster {
  const r = sheet(900, 600)
  for (const y of [520, 400, 280, 160]) line(r, 60, y, 840, y, BLACK)
  line(r, 120, 300, 450, 90, BLACK, 2)
  line(r, 450, 90, 780, 300, BLACK, 2)
  return r
}

const FRONT: SceneDrawing = { slug: 'front', raster: facade(), roles: { document: 'ELEVATION', view: 'FRONT' } }
const SECTION: SceneDrawing = { slug: 'section', raster: section(), roles: { document: 'SECTION' } }
const RENDER: SceneDrawing = { slug: 'render', raster: facade(), roles: { document: 'PERSPECTIVE_RENDER', view: 'UNKNOWN' } }
const PLAN = (arrow: boolean, treads: number): SceneDrawing => ({ slug: `plan-${arrow ? 'arrow' : 'noarrow'}-${treads}`, raster: planStair({ treads, going: 18, treadLength: 90, arrow, size: 600, x: 150, y: 120 }), roles: { document: 'FLOOR_PLAN', storey: 'GROUND' } })

const countKind = (graph: SourceObservationGraph, kind: string): number => graph.observations.filter((o) => o.kind === kind).length
const countHint = (graph: SourceObservationGraph, hint: string): number => graph.observations.filter((o) => o.semanticHints.includes(hint as never)).length

// ---------------------------------------------------------------------------

describe('1. the section is served at a quarter of its resolution', () => {
  it('reads fewer level datums, and every reading it does make is coarser', async () => {
    const full = await analyseScene([{ ...SECTION, slug: 'section-full' }])
    const small = await analyseScene([{ slug: 'section-small', raster: downscale(section(), 4), roles: { document: 'SECTION' } }])
    expect(countKind(full.graph, 'LEVEL_DATUM')).toBeGreaterThan(0)
    const worst = (g: SourceObservationGraph): number => Math.max(...g.observations.map((o) => o.uncertainty.positionPx / Math.max(...g.coordinateFrames.map((f) => f.size.width))))
    // The absolute tolerance shrinks with the picture, but as a FRACTION of
    // the drawing — which is what a metric solver will scale by — it grows.
    expect(worst(small.graph)).toBeGreaterThan(worst(full.graph))
    expect(small.graph.contentHash).not.toBe(full.graph.contentHash)
    // and the ridge, which needs two slopes to meet, is no longer resolvable
    expect(countKind(small.graph, 'RIDGE')).toBeLessThanOrEqual(countKind(full.graph, 'RIDGE'))
  })
})

describe('2. the front perspective is dropped from the package', () => {
  it('loses the observations that only it carried, and says the asset is gone rather than silently shrinking', async () => {
    const withRender = await analyseScene([FRONT, RENDER])
    const without = await analyseScene([FRONT])
    expect(withRender.graph.relations.filter((r) => r.provenance.extractor === 'DERIVED').length).toBeGreaterThanOrEqual(0)
    expect(withRender.graph.coordinateFrames).toHaveLength(2)
    expect(without.graph.coordinateFrames).toHaveLength(1)
    expect(without.graph.observations.length).toBeLessThan(withRender.graph.observations.length)
    expect(without.graph.contentHash).not.toBe(withRender.graph.contentHash)
    expect(without.graph.coordinateFrames.some((f) => f.roles.document === 'PERSPECTIVE_RENDER')).toBe(false)
    expect(withRender.graph.coordinateFrames.some((f) => f.roles.document === 'PERSPECTIVE_RENDER')).toBe(true)
  })
})

describe('3. one major opening is erased from the facade', () => {
  it('reports one fewer opening, in the place it was erased from', async () => {
    const three = await analyseScene([{ slug: 'f3', raster: facade({ openings: 3 }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const two = await analyseScene([{ slug: 'f2', raster: facade({ openings: 2 }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    // The three windows are at x = 90, 240 and 390; the third is the one erased.
    const windowAt = (g: SourceObservationGraph, x: number): boolean =>
      g.observations.some((o) => o.kind === 'OPENING' && o.pixelGeometry.type === 'RECT' && Math.abs(o.pixelGeometry.rect.x0 - x) <= 2 && Math.abs(o.pixelGeometry.rect.y0 - 250) <= 2)
    for (const x of [90, 240, 390]) expect(windowAt(three.graph, x), `window at ${x}`).toBe(true)
    for (const x of [90, 240]) expect(windowAt(two.graph, x), `window at ${x} survives`).toBe(true)
    expect(windowAt(two.graph, 390)).toBe(false)
    expect(countKind(two.graph, 'OPENING')).toBeLessThan(countKind(three.graph, 'OPENING'))
  })
})

describe('4. the thick facade member is erased', () => {
  it('reports no linear volume candidate at all, rather than a weaker one', async () => {
    const withMember = await analyseScene([{ slug: 'with', raster: facade({ member: 'solid' }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const without = await analyseScene([{ slug: 'without', raster: facade({ member: 'none' }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    expect(countKind(withMember.graph, 'LINEAR_VOLUME_CANDIDATE')).toBeGreaterThan(0)
    const band = withMember.graph.observations.find((o) => o.kind === 'LINEAR_VOLUME_CANDIDATE' && o.pixelGeometry.type === 'RECT' && o.pixelGeometry.rect.y0 > 130 && o.pixelGeometry.rect.y0 < 150)
    expect(band).toBeDefined()
    const survivor = without.graph.observations.find((o) => o.kind === 'LINEAR_VOLUME_CANDIDATE' && o.pixelGeometry.type === 'RECT' && band?.pixelGeometry.type === 'RECT' && rectIoU(o.pixelGeometry.rect, band.pixelGeometry.rect) > 0.2)
    expect(survivor).toBeUndefined()
  })
})

describe('5. the member keeps its colour and loses its depth', () => {
  it('is demoted from a solid to a surface: the same band, a different claim', async () => {
    const solid = await analyseScene([{ slug: 'solid', raster: facade({ member: 'solid' }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const flat = await analyseScene([{ slug: 'flat', raster: facade({ member: 'flat' }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const at = (g: SourceObservationGraph, kind: string): boolean =>
      g.observations.some((o) => o.kind === kind && o.pixelGeometry.type === 'RECT' && o.pixelGeometry.rect.y0 > 130 && o.pixelGeometry.rect.y0 < 150 && o.pixelGeometry.rect.x1 - o.pixelGeometry.rect.x0 > 600)
    expect(at(solid.graph, 'LINEAR_VOLUME_CANDIDATE')).toBe(true)
    expect(at(flat.graph, 'LINEAR_VOLUME_CANDIDATE')).toBe(false)
    expect(at(flat.graph, 'SURFACE_REGION')).toBe(true)
    // the band is still SEEN; what changed is what it is said to be
    expect(flat.graph.observations.some((o) => o.provenance.detail.includes('a change of surface, not a solid'))).toBe(true)
  })
})

describe('6. one side return of the recess is removed', () => {
  it('finds one fewer return and names the side it could not find', async () => {
    const both = await analyseScene([{ slug: 'both', raster: facade({ recessReturns: 2 }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const one = await analyseScene([{ slug: 'one', raster: facade({ recessReturns: 1 }), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    expect(countHint(one.graph, 'side-return')).toBeLessThan(countHint(both.graph, 'side-return'))
    // the return that survives is the LEFT one, at x = 600
    const returnAt = (g: SourceObservationGraph, x: number): boolean =>
      g.observations.some((o) => o.semanticHints.includes('side-return') && o.pixelGeometry.type === 'RECT' && Math.abs(o.pixelGeometry.rect.x0 - x) <= 3)
    expect(returnAt(both.graph, 796)).toBe(true)
    expect(returnAt(one.graph, 796)).toBe(false)
    expect(returnAt(one.graph, 600)).toBe(true)
    const gaps = (g: SourceObservationGraph): number => g.unresolved.filter((u) => u.what.includes('side wall of the recess')).length
    expect(gaps(one.graph)).toBeGreaterThan(gaps(both.graph))
  })
})

describe('7. the facade is mirrored', () => {
  it('produces a mirrored reading and a different hash, so a flip is never mistaken for the same source', async () => {
    const straight = await analyseScene([{ slug: 'straight', raster: facade(), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const flipped = await analyseScene([{ slug: 'flipped', raster: mirror(facade()), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    expect(flipped.graph.contentHash).not.toBe(straight.graph.contentHash)
    const openingXs = (g: SourceObservationGraph): number[] =>
      g.observations.filter((o) => o.kind === 'OPENING' && o.normGeometry.type === 'RECT').map((o) => (o.normGeometry.type === 'RECT' ? Number(((o.normGeometry.rect.x0 + o.normGeometry.rect.x1) / 2).toFixed(2)) : 0)).sort((a, b) => a - b)
    const mirrored = openingXs(flipped.graph).map((x) => Number((1 - x).toFixed(2))).sort((a, b) => a - b)
    const straightXs = openingXs(straight.graph)
    expect(mirrored).toHaveLength(straightXs.length)
    // Mirroring is exact to within the rounding of a normalized coordinate.
    for (let i = 0; i < mirrored.length; i += 1) expect(mirrored[i]).toBeCloseTo(straightXs[i], 1)
  })
})

describe('8. the two side elevation labels are swapped', () => {
  it('changes the package hash and the graph hash, because a role is part of what an asset IS', async () => {
    const left: SceneDrawing = { slug: 'side-a', raster: facade({ openings: 2 }), roles: { document: 'ELEVATION', view: 'SIDE_LEFT' } }
    const right: SceneDrawing = { slug: 'side-b', raster: facade({ openings: 4 }), roles: { document: 'ELEVATION', view: 'SIDE_RIGHT' } }
    const asDrawn = scene([left, right])
    const swapped = scene([
      { ...left, roles: { ...left.roles, view: 'SIDE_RIGHT' } },
      { ...right, roles: { ...right.roles, view: 'SIDE_LEFT' } },
    ])
    expect(swapped.pkg.contentHash).not.toBe(asDrawn.pkg.contentHash)
    const a = await analyzeSourcePackage(asDrawn.pkg, { bytes: async (url) => asDrawn.bytes.get(url) ?? null })
    const b = await analyzeSourcePackage(swapped.pkg, { bytes: async (url) => swapped.bytes.get(url) ?? null })
    expect(b.graph.contentHash).not.toBe(a.graph.contentHash)
    // the frames carry the roles verbatim, so a swap is visible in the record
    expect(b.graph.coordinateFrames.map((f) => f.roles.view).sort()).toEqual(['SIDE_LEFT', 'SIDE_RIGHT'])
    const viewOfFirstAsset = (g: SourceObservationGraph): string => g.coordinateFrames.find((f) => f.assetId === 'asset-side-a')?.roles.view ?? ''
    expect(viewOfFirstAsset(a.graph)).toBe('SIDE_LEFT')
    expect(viewOfFirstAsset(b.graph)).toBe('SIDE_RIGHT')
  })
})

describe('9. the stair loses its direction arrow', () => {
  it('stops asserting a staircase and records the ambiguity instead of guessing a way up', async () => {
    const marked = await analyseScene([PLAN(true, 9)])
    const unmarked = await analyseScene([PLAN(false, 9)])
    expect(countKind(marked.graph, 'STAIR_SYMBOL')).toBe(1)
    expect(countHint(marked.graph, 'stair-direction')).toBe(1)
    expect(countKind(unmarked.graph, 'STAIR_SYMBOL')).toBe(0)
    expect(unmarked.graph.unresolved.some((u) => u.what.includes('staircase') && (u.status === 'AMBIGUOUS' || u.status === 'MISSING'))).toBe(true)
    // and the runs it considered are kept as evidence rather than thrown away
    expect(countKind(unmarked.graph, 'PARALLEL_LINE_FAMILY')).toBeGreaterThan(0)
  })
})

describe('10. half the stair treads are erased', () => {
  it('counts what is there and says the count is a lower bound', async () => {
    const full = await analyseScene([PLAN(true, 10)])
    const half = await analyseScene([PLAN(true, 5)])
    const counted = (g: SourceObservationGraph): number => g.observations.find((o) => o.kind === 'STAIR' && o.semanticHints.includes('tread-line'))?.value?.number ?? 0
    expect(counted(full.graph)).toBe(10)
    expect(counted(half.graph)).toBe(5)
    const treads = half.graph.observations.find((o) => o.kind === 'STAIR' && o.semanticHints.includes('tread-line'))
    expect(treads?.alternatives[0].count).toBe(6)
    expect(treads?.uncertainty.reason).toMatch(/lower bound/)
  })
})

describe('11. two views give conflicting counts for one thing', () => {
  it('records the disagreement and never averages it away', () => {
    const builder = new ObservationGraphBuilder('pkg', 'a'.repeat(64))
    const cv = builder.declareExtractor('cv.test', '1.0.0', 'DETERMINISTIC_CV')
    const plan = builder.declareFrame('asset-plan', 'b'.repeat(64), { width: 400, height: 400 }, { document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'DIMENSIONED', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' })
    const sect = builder.declareFrame('asset-section', 'c'.repeat(64), { width: 400, height: 400 }, { document: 'SECTION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_SECTION' })
    const one = builder.observe(cv, { frame: plan, kind: 'PRINTED_DIMENSION', pixelGeometry: { type: 'SEGMENT', a: { x: 10, y: 10 }, b: { x: 200, y: 10 } }, value: { unit: 'px', number: 190 }, confidence: 0.8, uncertainty: { positionPx: 1, angleDeg: 1 }, detail: 'a chain measured on the plan' })
    const two = builder.observe(cv, { frame: sect, kind: 'PRINTED_DIMENSION', pixelGeometry: { type: 'SEGMENT', a: { x: 10, y: 10 }, b: { x: 250, y: 10 } }, value: { unit: 'px', number: 240 }, confidence: 0.8, uncertainty: { positionPx: 1, angleDeg: 1 }, detail: 'the same run measured on the section' })
    builder.conflict({ observations: [one, two], kind: 'SCALE', what: 'how long the same run is in two drawings', magnitude: 50, unit: 'px' })
    const graph = builder.seal()
    expect(graph.conflicts).toHaveLength(1)
    expect(graph.conflicts[0].observationIds.sort()).toEqual([one.id, two.id].sort())
    // both readings survive, unchanged
    expect(graph.observations.find((o) => o.id === one.id)?.value?.number).toBe(190)
    expect(graph.observations.find((o) => o.id === two.id)?.value?.number).toBe(240)
    expect(graph.observations.some((o) => o.value?.number === 215)).toBe(false)
  })
})

const visionRequest: VisionObservationRequest = {
  task: 'FACADE_DECOMPOSITION',
  asset: { assetId: 'a', byteHash: 'd'.repeat(64), mediaType: 'image/png', bytes: new Uint8Array([1]) },
  roles: { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'PLAIN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' },
  size: { width: 800, height: 400 },
}

const visionBody = (geometry: unknown): Record<string, unknown> => ({
  task: 'FACADE_DECOMPOSITION',
  assetByteHash: 'd'.repeat(64),
  observations: [{ kind: 'OPENING', semanticHints: ['reveal'], geometry, confidence: 0.7, positionUncertaintyNorm: 0.01, evidence: 'a hole in the wall' }],
  relations: [],
})

describe('12. the vision provider returns malformed coordinates', () => {
  it('refuses the whole answer rather than salvaging the rest of it', () => {
    for (const geometry of [{ type: 'RECT', points: [[0.2, 0.3]] }, { type: 'POLYGON', points: [[0.1, 0.1], [0.2, 0.2]] }, { type: 'SEGMENT', points: [[0.5, 0.5], [0.5, 0.5]] }]) {
      expect(() => validateVisionResponse(visionBody(geometry), visionRequest)).toThrow(VisionResponseRejected)
    }
    expect(() => validateVisionResponse(visionBody({ type: 'RECT', points: [['a', 'b'], [0.4, 0.5]] }), visionRequest)).toThrow(/observation schema/)
    // the same answer, well formed, is accepted — so the refusal is about the mutation
    expect(() => validateVisionResponse(visionBody({ type: 'RECT', points: [[0.2, 0.3], [0.4, 0.5]] }), visionRequest)).not.toThrow()
  })
})

describe('13. the vision provider claims a feature outside the image', () => {
  it('refuses it, and says which coordinate left the picture', () => {
    let code = ''
    let message = ''
    try {
      validateVisionResponse(visionBody({ type: 'RECT', points: [[0.2, 0.3], [1.35, 0.5]] }), visionRequest)
    } catch (err) {
      code = (err as VisionResponseRejected).code
      message = (err as Error).message
    }
    expect(code).toBe('OUT_OF_BOUNDS')
    expect(message).toMatch(/1\.35/)
    expect(message).toMatch(/outside the image the provider was shown/)
  })
})

describe('14. a different crop is filed as the same variant', () => {
  it('is caught the moment an extractor reads the bytes, because the frame would then lie about its size', async () => {
    const original = facade()
    const cropped = crop(original, 0, 0, 600, 300)
    const { pkg, bytes } = scene([{ slug: 'front', raster: original, roles: { document: 'ELEVATION', view: 'FRONT' } }])
    // The mutation: the package keeps the original's recorded size but serves
    // the crop's bytes — exactly what grouping two crops as one variant does.
    const url = pkg.assets[0].variants[0].url
    const { encodePng } = await import('./scene.js')
    bytes.set(url, { bytes: encodePng(cropped), mediaType: 'image/png' })
    await expect(analyzeSourcePackage(pkg, { bytes: async (u) => bytes.get(u) ?? null })).rejects.toThrow(/sealed as 900x460 but its bytes decode to 600x300/)
  })

  it('and the package hash itself moves when a variant’s decoded size changes, so the seal cannot be edited quietly', () => {
    const { pkg } = scene([{ slug: 'front', raster: facade(), roles: { document: 'ELEVATION', view: 'FRONT' } }])
    const { contentHash: _drop, ...draft } = pkg
    const edited = { ...draft, assets: [{ ...draft.assets[0], variants: [{ ...draft.assets[0].variants[0], decoded: { width: 600, height: 300 } }] }] }
    expect(sourcePackageContentHash(edited)).not.toBe(pkg.contentHash)
  })
})
