/**
 * Every expected way the structural pass can fail ends in its own code
 * (BUILDAPP-03Y2G §19), with the counts that say how far it got — never a
 * generic "could not reconstruct".
 *
 * Each case is a synthetic plan drawn to fail at exactly one link of the
 * chain the pass builds: a plan, its pixels, its scale, its walls, an
 * envelope, an enclosed cell, a walled region, a footprint that agrees with
 * the publisher's.
 */
import { describe, expect, it } from 'vitest'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import { ReconstructionFailure, reconstructV2 } from '../src/index.js'
import type { ReconstructionFailureCode, SolverTraceEvent } from '../src/index.js'
import { WALL, chain, graphOf, metricsOf, planFrame, registration, sheet, walls } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'

const FRAME = 'frame-plan'
const frame = planFrame(FRAME, 'GROUND', { width: 460, height: 480 })
const onPlan = <T extends { frameId: string }>(x: T): T => ({ ...x, frameId: FRAME })
const chains = () => [onPlan(chain('cx', 'HORIZONTAL', [40, 360], { baselinePx: 20 })), onPlan(chain('cy', 'VERTICAL', [40, 280], { baselinePx: 20 }))]

function attempt(options: { frames?: SourceCoordinateFrame[]; raster?: Raster; registered?: boolean; withChains?: boolean; chains?: ReturnType<typeof chains>; publishedFootprintM2?: number }): { failure: ReconstructionFailure; trace: SolverTraceEvent[] } {
  const trace: SolverTraceEvent[] = []
  const frames = options.frames ?? [frame]
  const metrics = metricsOf(options.withChains === false ? [] : (options.chains ?? chains()), options.registered === false ? [] : [onPlan(registration())])
  try {
    reconstructV2({
      label: 'fixture',
      slug: 'fixture',
      sourcePackageId: 'src-test',
      sourcePackageHash: 'd'.repeat(64),
      graph: graphOf(frames),
      metrics,
      raster: () => options.raster,
      publishedAreas: options.publishedFootprintM2 === undefined ? undefined : [{ key: 'footprint_area', label: 'footprint', unit: 'm2', value: options.publishedFootprintM2 }],
      trace: (e) => trace.push(e),
    })
  } catch (error) {
    if (error instanceof ReconstructionFailure) return { failure: error, trace }
    throw error
  }
  throw new Error('the fixture was expected to fail')
}

const expectCode = (result: { failure: ReconstructionFailure; trace: SolverTraceEvent[] }, code: ReconstructionFailureCode): void => {
  expect(result.failure.code).toBe(code)
  expect(result.failure.phase).toBe('REGISTRATION')
  // the failing step is in the trace, with the same code
  expect(result.trace.at(-1)).toMatchObject({ status: 'FAILED', reasonCode: code })
  // the message is about the drawing, never about the machine
  expect(result.failure.message).not.toMatch(/\/|\\|node_modules|Error:/)
}

describe('an expected structural failure is named by its first missing link', () => {
  it('no floor plan → PLAN_NOT_FOUND', () => {
    const elevation = { ...frame, id: 'frame-elev', roles: { ...frame.roles, document: 'ELEVATION' as const, projection: 'ORTHOGRAPHIC_ELEVATION' as const } }
    const r = attempt({ frames: [elevation] })
    expectCode(r, 'PLAN_NOT_FOUND')
    expect(r.failure.diagnostics.planFrames).toBe(0)
  })

  it('a plan whose bytes cannot be decoded → PLAN_NOT_DECODABLE', () => {
    expectCode(attempt({ raster: undefined }), 'PLAN_NOT_DECODABLE')
  })

  it('a plan with nothing drawn on it → PLAN_NO_WALL_BANDS', () => {
    const r = attempt({ raster: sheet(460, 480), withChains: false })
    expectCode(r, 'PLAN_NO_WALL_BANDS')
  })

  it('walls and chains, but no scale the plan can be read at → PLAN_NO_DIMENSION_FRAME', () => {
    const r0 = sheet(460, 480)
    walls(r0, 40, 40, 359, 279, [{ side: 'S', from: 150, to: 197 }])
    const r = attempt({ raster: r0, registered: false })
    expectCode(r, 'PLAN_NO_DIMENSION_FRAME')
    expect(r.failure.diagnostics.wallBands).toBeGreaterThan(0)
  })

  it('walls along one axis only → PLAN_NO_WALLED_ENVELOPE', () => {
    const r0 = sheet(460, 480)
    fillRect(r0, 40, 40, 359, 40 + WALL - 1, BLACK)
    fillRect(r0, 40, 268, 359, 279, BLACK)
    const r = attempt({ raster: r0 })
    expectCode(r, 'PLAN_NO_WALLED_ENVELOPE')
    expect(r.failure.diagnostics.walledEnvelope).toBe(false)
  })

  it('walls on three sides and a 10 m front left open between two 3 m corner stubs → PLAN_NO_ENCLOSED_CELLS', () => {
    const r0 = sheet(460, 480)
    fillRect(r0, 40, 40, 359, 51, BLACK)
    fillRect(r0, 40, 40, 51, 279, BLACK)
    fillRect(r0, 348, 40, 359, 279, BLACK)
    fillRect(r0, 40, 268, 99, 279, BLACK)
    fillRect(r0, 300, 268, 359, 279, BLACK)
    const r = attempt({ raster: r0 })
    expectCode(r, 'PLAN_NO_ENCLOSED_CELLS')
    expect(r.failure.diagnostics.enclosedCells).toBe(0)
    expect(r.failure.diagnostics.cells).toBeGreaterThan(0)
  })

  it('a region shut by line work with wall only at its corners → PLAN_NO_BUILT_REGIONS', () => {
    const r0 = sheet(460, 480)
    // a 20 × 20 m square: four L-shaped corner pieces of wall, 3 m each way (30 % of the perimeter), thin lines between
    for (const [x, y, dx, dy] of [[20, 20, 1, 1], [419, 20, -1, 1], [20, 419, 1, -1], [419, 419, -1, -1]] as const) {
      const xs = [x, x + dx * 60].sort((a, b) => a - b)
      const ys = [y, y + dy * (WALL - 1)].sort((a, b) => a - b)
      fillRect(r0, xs[0], ys[0], xs[1], ys[1], BLACK)
      const xv = [x, x + dx * (WALL - 1)].sort((a, b) => a - b)
      const yv = [y, y + dy * 60].sort((a, b) => a - b)
      fillRect(r0, xv[0], yv[0], xv[1], yv[1], BLACK)
    }
    drawLine(r0, 80, 25, 360, 25, BLACK)
    drawLine(r0, 80, 414, 360, 414, BLACK)
    drawLine(r0, 25, 80, 25, 360, BLACK)
    drawLine(r0, 414, 80, 414, 360, BLACK)
    const square = [onPlan(chain('cx', 'HORIZONTAL', [20, 420], { baselinePx: 8 })), onPlan(chain('cy', 'VERTICAL', [20, 420], { baselinePx: 8 }))]
    const r = attempt({ raster: r0, chains: square })
    expectCode(r, 'PLAN_NO_BUILT_REGIONS')
    expect(r.failure.diagnostics.enclosedCells).toBeGreaterThan(0)
  })

  it('a body whose footprint contradicts the published one → PLAN_LAYOUT_REJECTED, the gate’s verdict enforced', () => {
    const r0 = sheet(460, 480)
    walls(r0, 40, 40, 359, 279, [{ side: 'S', from: 150, to: 197 }])
    const r = attempt({ raster: r0, publishedFootprintM2: 40 })
    expect(r.failure.code).toBe('PLAN_LAYOUT_REJECTED')
    expect(r.failure.substage).toBe('STRUCTURAL_LAYOUT')
    expect(r.failure.diagnostics.gateBlocking).toBe('FOOTPRINT_AREA_WRONG')
    expect(r.failure.message).toMatch(/192\.00 m² against the 40 m²/)
    // the digest the overlays are drawn from is carried with it
    expect(r.failure.plans?.plans[0].masses.length).toBe(1)
  })
})
