/**
 * The facade extractors read only frames a facade can be measured on.
 *
 * Every reader of what the facade extractors write (the metric layer, cross-view
 * identity, elevation registration) reads orthographic frames only. On a
 * perspective picture, interior or exterior alike, the extractors could only
 * write claims about a facade that nothing can measure: a bathroom render once
 * carried four "ridges" and a hundred "openings". Such a frame is still declared,
 * because a perspective camera is solved from its raster, and it is refused by
 * name instead of being read.
 *
 * Every case asserts against a control that shows the same pixels DO produce
 * facade observations when they are filed as an orthographic view, so a gate
 * that silently stopped all facade reading would fail here too.
 */
import { describe, expect, it } from 'vitest'
import { nullVisionReasoner } from '@buildapp/source-vision'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import { analyzeSourcePackage } from '../src/index.js'
import { analyseScene, scene } from './scene.js'
import type { SceneDrawing } from './scene.js'
import { BLACK, WALL, fill, line, rectOutline, sheet } from './draw.js'
import type { Raster } from '@buildapp/source-cv'

/** A drawn facade: a wall with three openings and a member across it. */
function facade(): Raster {
  const r = sheet(900, 460)
  fill(r, 40, 60, 860, 420, WALL)
  rectOutline(r, 40, 60, 860, 420, BLACK)
  for (let i = 0; i < 3; i += 1) {
    const x = 90 + i * 150
    fill(r, x, 250, x + 90, 380, [120, 130, 140])
    rectOutline(r, x, 250, x + 90, 380, BLACK, 2)
  }
  fill(r, 70, 140, 830, 166, [198, 192, 182])
  line(r, 70, 140, 830, 140, BLACK)
  line(r, 70, 166, 830, 166, BLACK)
  return r
}

/** A room seen in one-point perspective: floor, ceiling and wall edges converging, a window and a door in the back wall. */
function room(): Raster {
  const r = sheet(960, 640, [236, 232, 224])
  fill(r, 300, 200, 660, 440, [214, 208, 198])
  rectOutline(r, 300, 200, 660, 440, BLACK, 2)
  for (const [x0, y0, x1, y1] of [[0, 0, 300, 200], [960, 0, 660, 200], [0, 640, 300, 440], [960, 640, 660, 440]]) line(r, x0, y0, x1, y1, BLACK, 2)
  fill(r, 340, 240, 470, 360, [170, 196, 222])
  rectOutline(r, 340, 240, 470, 360, BLACK, 3)
  line(r, 405, 240, 405, 360, BLACK, 2)
  fill(r, 530, 270, 610, 440, [150, 120, 96])
  rectOutline(r, 530, 270, 610, 440, BLACK, 2)
  return r
}

const FRONT: SceneDrawing = { slug: 'front', raster: facade(), roles: { document: 'ELEVATION', view: 'FRONT' } }
const RENDER: SceneDrawing = { slug: 'render', raster: facade(), roles: { document: 'PERSPECTIVE_RENDER', view: 'UNKNOWN' } }
const ROOM: SceneDrawing = { slug: 'room', raster: room(), roles: { document: 'PERSPECTIVE_RENDER', view: 'UNKNOWN' } }

const frameOf = (g: SourceObservationGraph, assetId: string) => g.coordinateFrames.find((f) => f.assetId === assetId)
const observationsOn = (g: SourceObservationGraph, assetId: string) => g.observations.filter((o) => o.frameId === frameOf(g, assetId)?.id)
const refusalsOf = (g: SourceObservationGraph, assetId: string) => g.unresolved.filter((u) => u.assetId === assetId && u.status === 'NOT_ATTEMPTED' && u.what.startsWith('facade observations on the perspective render'))

describe('the facade extractors read orthographic frames only', () => {
  it('the same pixels give facade observations as an elevation (control)', async () => {
    const asElevation = await analyseScene([{ ...ROOM, slug: 'room', roles: { document: 'ELEVATION', view: 'FRONT' } }, { ...RENDER, roles: { document: 'ELEVATION', view: 'REAR' } }])
    expect(observationsOn(asElevation.graph, 'asset-room').length).toBeGreaterThan(0)
    expect(observationsOn(asElevation.graph, 'asset-render').length).toBeGreaterThan(0)
  })

  it('a perspective picture, interior or exterior, is declared, carries no facade observation and one named refusal', async () => {
    const run = await analyseScene([FRONT, RENDER, ROOM])
    for (const assetId of ['asset-render', 'asset-room']) {
      const frame = frameOf(run.graph, assetId)
      expect(frame?.roles.projection).toBe('PERSPECTIVE')
      expect(observationsOn(run.graph, assetId)).toHaveLength(0)
      expect(refusalsOf(run.graph, assetId)).toHaveLength(1)
      // refused by name, never reported as read-and-found-nothing
      expect(run.graph.unresolved.filter((u) => u.assetId === assetId && u.status === 'MISSING')).toHaveLength(0)
      expect(run.skipped.filter((s) => s.assetId === assetId)).toHaveLength(1)
    }
  })

  it("an elevation's observations do not depend on the perspective pictures published beside it", async () => {
    const alone = await analyseScene([FRONT])
    const beside = await analyseScene([FRONT, RENDER, ROOM])
    expect(JSON.stringify(observationsOn(beside.graph, 'asset-front'))).toBe(JSON.stringify(observationsOn(alone.graph, 'asset-front')))
    expect(observationsOn(alone.graph, 'asset-front').length).toBeGreaterThan(0)
  })

  it('a render an adapter declares orthographic is read as a facade', async () => {
    const run = await analyseScene([{ ...RENDER, roles: { document: 'PERSPECTIVE_RENDER', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' } }])
    expect(observationsOn(run.graph, 'asset-render').length).toBeGreaterThan(0)
    expect(refusalsOf(run.graph, 'asset-render')).toHaveLength(0)
  })

  it('an elevation is never refused, whatever projection it was sealed with', async () => {
    const run = await analyseScene([{ ...FRONT, roles: { document: 'ELEVATION', view: 'FRONT', projection: 'PERSPECTIVE' } }])
    expect(observationsOn(run.graph, 'asset-front').length).toBeGreaterThan(0)
    expect(refusalsOf(run.graph, 'asset-front')).toHaveLength(0)
  })

  it('with the product reasoner configured, the refusal stands beside the vision gap', async () => {
    const { pkg, bytes } = scene([FRONT, ROOM])
    const run = await analyzeSourcePackage(pkg, { bytes: async (url) => bytes.get(url) ?? null, vision: nullVisionReasoner() })
    expect(observationsOn(run.graph, 'asset-room')).toHaveLength(0)
    expect(refusalsOf(run.graph, 'asset-room')).toHaveLength(1)
    expect(run.graph.unresolved.some((u) => u.assetId === 'asset-room' && u.what.startsWith('a facade decomposition vision pass'))).toBe(true)
  })

  it('the graph does not depend on the order the package lists its assets in', async () => {
    const a = await analyseScene([FRONT, RENDER, ROOM])
    const b = await analyseScene([ROOM, RENDER, FRONT])
    expect(b.graph.contentHash).toBe(a.graph.contentHash)
  })
})
