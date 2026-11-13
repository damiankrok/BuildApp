/**
 * v3.53.10 — the plan's extent at a wall's outer face.
 *
 * The found cause, on public plans: the overall dimension line ends with a tick on the outer face of an exterior wall,
 * and a witness line (or the extension line of a detail) crosses it at the wall's INNER face. The chain's last segment
 * is then one wall thick, unread, far shorter than any read segment — and the 005I end-span rule trimmed it as a stub
 * struck past the line. The frame stopped on the inner face, the whole wall on that side fell outside it, the cells
 * behind it lost their wall and the outside flood took them: the house lost a side and was refused.
 *
 * Kept now, on that side's own evidence only: the segment's outer mark is the chain's end tick; a long wall band runs
 * along that side with its outer face at the tick and its inner face inside the segment (the segment is the wall's
 * thickness, no more than half a wall beyond it); and the band meets a long wall of the other orientation at a corner.
 * The search area, where the verified dimension lies and the face of any wall built are separate decisions: this
 * decides only the second. Where any of it fails the stub is trimmed as before.
 *
 * Scale 5 cm/px, walls 12 px. The fixture is drawn for this test; it is no drawing of any real building.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import type { DimensionChain } from '@buildapp/source-metrics'
import { bandWallThickness, decomposePlan, dimensionedAxis, planExtent } from '../src/index.js'
import type { PlanDecomposition } from '../src/index.js'
import { CM_PER_PX, WALL, chain, mask, registration, sheet, walls } from './plan.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'

const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }

type Mark = 'T' | 'Q'
/**
 * A horizontal overall line below the plan: `ticks` with their mark classes; the segments ending at a questionable
 * mark, and any segment no longer than `unreadBelow`, are unread — as the reader leaves a stub a wall thick.
 */
function overall(ticks: ReadonlyArray<readonly [number, Mark]>, unreadBelow = 30): DimensionChain {
  const c = chain('overall', 'HORIZONTAL', ticks.map(([px]) => px), { baselinePx: 340 })
  return {
    ...c,
    marks: ticks.map(([atPx, m]) => ({ atPx, class: m === 'T' ? ('TICK' as const) : ('QUESTIONABLE' as const), reasons: m === 'T' ? [] : ['TEXT_INK' as const] })),
    segments: c.segments.map((s) => (s.pixelLength <= unreadBelow ? { ...s, origin: 'DERIVED' as const, confidence: 0.2, valueCm: s.pixelLength * CM_PER_PX } : s)),
  }
}
const depth = (): DimensionChain => chain('depth', 'VERTICAL', [40, 300], { baselinePx: 10 })

function read(r: Raster, chains: DimensionChain[]): { rect: { x0: number; x1: number }; decisions: string[]; d: PlanDecomposition } {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const extent = planExtent(chains, bands, wallPx)
  if (!extent) throw new Error('no extent')
  const decisions = (dimensionedAxis(chains, 'HORIZONTAL', { bands, wallPx })?.endSpans ?? []).map((e) => `${e.end}:${e.decision}`)
  return { rect: extent.rect, decisions, d: decomposePlan(m, chains, bands, registration(), extent.rect) }
}
function classAt(d: PlanDecomposition, x: number, y: number): string {
  const cell = d.cells.find((c) => x >= c.rect.x0 && x < c.rect.x1 && y >= c.rect.y0 && y < c.rect.y1)
  return cell?.classification ?? 'NONE'
}
/** An 18 × 13 m house, outer faces x 40..400, y 40..300, a partition at x 220. */
function house(): Raster {
  const r = sheet(520, 380)
  walls(r, 40, 40, 400, 300)
  fillRect(r, 216, 40, 222, 300, BLACK)
  return r
}

describe('v3.53.10: an overall line ending at a wall’s outer face, a witness at its inner face', () => {
  it('the cause, in the pipeline: the wall-thick last segment is kept, the frame reaches the outer face and the rooms behind it are built', () => {
    const { rect, decisions, d } = read(house(), [overall([[40, 'T'], [220, 'T'], [388, 'Q'], [400, 'T']]), depth()])
    expect(decisions).toEqual(['HI:KEPT_WALL_FACE'])
    expect(Math.abs(rect.x1 - 400)).toBeLessThanOrEqual(1)
    expect(classAt(d, 330, 170)).toBe('BUILT')
    expect(classAt(d, 120, 170)).toBe('BUILT')
  })

  it('without the walls (as before), the same segment is a stub and the frame stops on the inner face', () => {
    const c = overall([[40, 'T'], [220, 'T'], [388, 'Q'], [400, 'T']])
    expect(dimensionedAxis([c], 'HORIZONTAL')).toMatchObject({ lo: 40, hi: 388 })
  })

  it('counter-case: a line ending cleanly at the outer face changes nothing — no end span is decided', () => {
    const { rect, decisions } = read(house(), [overall([[40, 'T'], [220, 'T'], [400, 'T']]), depth()])
    expect(decisions).toEqual([])
    expect(Math.abs(rect.x1 - 400)).toBeLessThanOrEqual(1)
  })

  it('counter-case: a terrace beyond the wall — the line ends at the terrace edge, no wall there — stays trimmed', () => {
    const { rect, decisions } = read(house(), [overall([[40, 'T'], [220, 'T'], [400, 'Q'], [430, 'T']]), depth()])
    expect(decisions).toEqual(['HI:TRIMMED_STUB'])
    expect(Math.abs(rect.x1 - 400)).toBeLessThanOrEqual(1)
  })

  it('counter-case: a portico of short posts on that side (no long wall) — the stub stays trimmed and nothing is closed', () => {
    const r = sheet(520, 380)
    walls(r, 40, 40, 400, 300)
    fillRect(r, 389, 52, 400, 288, [255, 255, 255]) // no east wall
    for (const y of [60, 160, 260]) fillRect(r, 389, y, 400, y + 11, BLACK) // posts
    const { decisions } = read(r, [overall([[40, 'T'], [220, 'T'], [388, 'Q'], [400, 'T']]), depth()])
    expect(decisions).toEqual(['HI:TRIMMED_STUB'])
  })

  it('counter-case: a thin lean-to beyond the wall is not pulled into the frame by this rule (the segment is wider than its wall)', () => {
    const r = house()
    fillRect(r, 400, 120, 430, 125, BLACK)
    fillRect(r, 400, 215, 430, 220, BLACK)
    fillRect(r, 424, 120, 430, 220, BLACK) // a 6 px wall at x 424..430
    const { decisions, rect } = read(r, [overall([[40, 'T'], [220, 'T'], [400, 'Q'], [430, 'T']]), depth()])
    expect(decisions).toEqual(['HI:TRIMMED_STUB'])
    expect(Math.abs(rect.x1 - 400)).toBeLessThanOrEqual(1)
  })

  it('counter-case: wall-thick ink beside the plan (a title strip, a logo bar) meets no wall of the house — trimmed', () => {
    const r = house()
    fillRect(r, 448, 40, 459, 300, BLACK) // a detached bar, 12 px, the house's height
    const { decisions, rect } = read(r, [overall([[40, 'T'], [220, 'T'], [400, 'T'], [448, 'Q'], [460, 'T']], 50), depth()])
    expect(decisions[0]).toBe('HI:TRIMMED_STUB')
    expect(Math.abs(rect.x1 - 400)).toBeLessThanOrEqual(1)
  })

  it('counter-case: an end mark the reader doubts ends nothing — a questionable outer mark is never a face', () => {
    const { decisions, rect } = read(house(), [overall([[40, 'T'], [220, 'T'], [388, 'T'], [400, 'Q']]), depth()])
    expect(decisions).toEqual(['HI:TRIMMED_STUB'])
    expect(rect.x1).toBe(388)
  })

  it('the scale is not touched: the kept segment is unread and the read segments keep their values', () => {
    const c = overall([[40, 'T'], [220, 'T'], [388, 'Q'], [400, 'T']])
    expect(c.segments.filter((s) => s.origin === 'READ').map((s) => s.valueCm)).toEqual([900, 840])
    const { d } = read(house(), [c, depth()])
    expect(d.cells.length).toBeGreaterThan(0)
  })
})
