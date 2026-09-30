/**
 * Synthetic plans for the opening-aware boundary tests (005C): a wall is solid ink between outer faces, glazing two
 * thin lines inside the wall, a post a block about one and a half walls square. 5 cm/px, 12 px walls. Not a drawing
 * of any real building.
 */
import { runLengthBands } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, exteriorTicksOf, planExtent, wallWitness } from '../src/index.js'
import type { PlanCallout, PlanDecomposition } from '../src/index.js'
import { CM_PER_PX, WALL, chain, mask, registration } from './plan.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'

export const BANDS = { minThickness: 6, maxThickness: 30, minLength: 24 }
export const WHITE: [number, number, number] = [255, 255, 255]
export const M2_PER_PX2 = (CM_PER_PX / 100) ** 2

/** A wall between outer faces, inclusive, as a plan draws it: solid ink. */
export const wall = (r: Raster, x0: number, y0: number, x1: number, y1: number): void => fillRect(r, x0, y0, x1, y1, BLACK)
export const clear = (r: Raster, x0: number, y0: number, x1: number, y1: number): void => fillRect(r, x0, y0, x1, y1, WHITE)
/** A closed ring of walls whose OUTER faces are the rectangle given. */
export function ring(r: Raster, x0: number, y0: number, x1: number, y1: number): void {
  wall(r, x0, y0, x1, y0 + WALL - 1)
  wall(r, x0, y1 - WALL + 1, x1, y1)
  wall(r, x0, y0, x0 + WALL - 1, y1)
  wall(r, x1 - WALL + 1, y0, x1, y1)
}
/** Glazing across a gap in a horizontal wall whose top face is row `top` (the wall runs top..top + WALL − 1); `glazeV` likewise from column `left`. */
export const glazeH = (r: Raster, top: number, from: number, to: number): void => {
  drawLine(r, from, top + 3, to, top + 3, BLACK)
  drawLine(r, from, top + WALL - 4, to, top + WALL - 4, BLACK)
}
export const glazeV = (r: Raster, left: number, from: number, to: number): void => {
  drawLine(r, left + 3, from, left + 3, to, BLACK)
  drawLine(r, left + WALL - 4, from, left + WALL - 4, to, BLACK)
}
/** A free-standing post, about one and a half walls square. */
export const post = (r: Raster, cx: number, cy: number): void => fillRect(r, cx - 8, cy - 8, cx + 8, cy + 8, BLACK)

export type Run = { d: PlanDecomposition; builtM2: number }
/** The plan as the layout pass reads it: sheet wall, witness-checked extent, exterior ticks. */
export function run(r: Raster, xs: number[], ys: number[], callouts: PlanCallout[] = [], options: { openingAware?: boolean; shutPocketMouths?: boolean; cmPerPx?: number; sheetWallPx?: number } = {}): Run {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const chains = [chain('cx', 'HORIZONTAL', [...xs].sort((a, b) => a - b), { baselinePx: 12 }), chain('cy', 'VERTICAL', [...ys].sort((a, b) => a - b), { baselinePx: 12 })]
  const extent = planExtent(chains, bands, wallPx, wallWitness(bands, wallPx, m))
  if (!extent) throw new Error('the fixture has no frame')
  const { cmPerPx, sheetWallPx, ...flags } = options
  const reg = cmPerPx === undefined ? registration() : { ...registration(), metresPerPixelX: cmPerPx / 100, metresPerPixelY: cmPerPx / 100 }
  const d = decomposePlan(m, chains, bands, reg, extent.rect, { callouts, sheetWallPx: sheetWallPx ?? WALL, exteriorTicks: exteriorTicksOf(chains, extent.roles), ...flags })
  const builtM2 = d.cells.filter((c) => c.classification === 'BUILT').reduce((a, c) => a + (c.rect.x1 - c.rect.x0) * (c.rect.y1 - c.rect.y0), 0) * (cmPerPx === undefined ? M2_PER_PX2 : (cmPerPx / 100) ** 2)
  return { d, builtM2 }
}
export const near = (value: number, expected: number, share = 0.04): boolean => Math.abs(value - expected) <= expected * share
export const builtAt = (d: PlanDecomposition, x: number, y: number): boolean => d.cells.some((c) => c.classification === 'BUILT' && x >= c.rect.x0 && x < c.rect.x1 && y >= c.rect.y0 && y < c.rect.y1)

