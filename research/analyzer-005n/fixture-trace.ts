/**
 * fixture-trace.ts — BUILDPLAN-ANALYZER-005N baseline (RESEARCH ONLY): the repository's own synthetic facades (an open
 * carport bay, a double-garage bay with its door drawn, a loggia mouth with returns and a back wall) and one compound
 * facade (a recessed entrance beside a garage door on one line), decomposed the way the layout pass decomposes a plan,
 * and written out with `traceRecord`. 5 cm/px, 12 px walls. Nothing here is a drawing of any real building.
 *
 *   npx vite-node research/analyzer-005n/fixture-trace.ts -- --out <file.ndjson outside the repository>
 */
import { appendFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { runLengthBands } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { bandWallThickness, decomposePlan, extentSidesOf, exteriorTicksOf, planExtent, wallWitness } from '../../packages/reconstruction/src/index.js'
import type { PlanCallout } from '../../packages/reconstruction/src/index.js'
import { WALL, chain, mask, registration, sheet, walls } from '../../packages/reconstruction/test/plan.js'
import { BANDS, clear, wall } from '../../packages/reconstruction/test/boundary-plan.js'
import { BLACK, drawLine, fillRect } from '../../packages/source-cv/test/draw.js'
import { traceRecord } from './trace-record.js'

const out = resolve(process.argv[process.argv.indexOf('--out') + 1])
if (out.startsWith(resolve(import.meta.dirname, '../..'))) throw new Error('trace output stays outside the repository')
rmSync(out, { force: true })

function trace(label: string, r: Raster, xs: number[], ys: number[], callouts: PlanCallout[] = []): void {
  const m = mask(r)
  const bands = runLengthBands(m, BANDS)
  const wallPx = bandWallThickness(bands, WALL)
  const chains = [chain('cx', 'HORIZONTAL', [...xs].sort((a, b) => a - b), { baselinePx: 12 }), chain('cy', 'VERTICAL', [...ys].sort((a, b) => a - b), { baselinePx: 12 })]
  const extent = planExtent(chains, bands, wallPx, wallWitness(bands, wallPx, m))
  if (!extent) throw new Error(`${label}: no frame`)
  const options = { callouts, sheetWallPx: WALL, exteriorTicks: exteriorTicksOf(chains, extent.roles), extentSides: extentSidesOf(chains, extent, wallPx) }
  const reg = registration()
  const d = decomposePlan(m, chains, bands, reg, extent.rect, options)
  appendFileSync(out, JSON.stringify(traceRecord(m, chains, bands, reg, extent.rect, options, d, label)) + '\n')
}

/** A 16 × 12 m house, outer faces x 40..360, y 40..280, its front the sheet's bottom. */
const house = (openings: Parameters<typeof walls>[5] = []): Raster => {
  const r = sheet(460, 480)
  walls(r, 40, 40, 359, 279, openings)
  return r
}
const hx = (extra: number[] = []) => [40, ...extra, 360]
const hy = (extra: number[] = []) => [40, ...extra, 280]

// 1. an open carport bay (wide-openings.test.ts §5)
{
  const r = house([{ side: 'S', from: 112, to: 219 }])
  fillRect(r, 100, 268, 111, 388, BLACK)
  fillRect(r, 220, 268, 231, 388, BLACK)
  trace('FIXTURE_OPEN_CARPORT_BAY', r, hx([100, 232]), hy([400]))
}
// 2. a double-garage bay, piers and the door leaf drawn (wide-openings.test.ts)
{
  const r = house([{ side: 'S', from: 112, to: 219 }])
  fillRect(r, 100, 268, 111, 388, BLACK)
  fillRect(r, 220, 268, 231, 388, BLACK)
  fillRect(r, 100, 389, 131, 400, BLACK)
  fillRect(r, 200, 389, 231, 400, BLACK)
  drawLine(r, 132, 392, 199, 392, BLACK)
  trace('FIXTURE_DOUBLE_GARAGE_BAY', r, hx([100, 232]), hy([400]))
}
// 3. a loggia / recessed entrance without a garage: returns, a back wall, nothing across (wide-openings.test.ts §6)
{
  const r = house([{ side: 'S', from: 150, to: 249 }])
  fillRect(r, 138, 208, 261, 219, BLACK)
  fillRect(r, 138, 208, 149, 279, BLACK)
  fillRect(r, 250, 208, 261, 279, BLACK)
  trace('FIXTURE_LOGGIA_RECESS', r, hx([150, 250]), hy([220]))
}
// 4. the target topology: a recessed entrance (3 m wide, 2 m deep, door in its back wall) beside a 3 m garage door on
// one facade line, separated by the recess's return, which runs on as the garage's side wall. The compound span on
// the facade line is 6.6 m: the recess mouth 120..179, the separator 180..191, the garage door 192..251.
for (const door of [false, true]) {
  const r = house()
  clear(r, 120, 268, 251, 279)
  wall(r, 108, 150, 119, 279) // the recess's left return, running on as the hall's wall
  wall(r, 180, 150, 191, 279) // the separator: the recess's right return, the garage's left wall
  wall(r, 108, 228, 191, 239) // the recess's back wall, the house's front there
  clear(r, 135, 228, 155, 239) // the entrance door in it, 1 m, its leaf on the axis
  drawLine(r, 135, 233, 155, 233, BLACK)
  wall(r, 108, 150, 263, 161) // the hall's and the garage's back wall
  wall(r, 252, 150, 263, 279) // the garage's right wall
  clear(r, 215, 150, 230, 161) // a door from the garage into the house
  drawLine(r, 215, 155, 230, 155, BLACK)
  if (door) drawLine(r, 192, 276, 251, 276, BLACK) // the garage door drawn at the face
  const tag = door ? 'DOOR' : 'BLANK'
  // chains as a plan prints them: the overall dimensions only
  trace(`FIXTURE_COMPOUND_RECESS_GARAGE_${tag}`, r, hx(), hy())
  trace(`FIXTURE_COMPOUND_RECESS_GARAGE_${tag}_FINE_GRID`, r, hx([120, 192, 252]), hy([228, 150]))
}
process.stdout.write(`wrote ${out}\n`)
