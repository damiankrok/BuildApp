/**
 * v3.53.8 — a door whose jambs the band reader does not see (`doorwayBetweenJambs`).
 *
 * The found cause, on a public single-storey plan: the front door (printed 165/210) stands between the end of a wall
 * that stops exactly at the cell's edge and a 0.9 m pier too short to be a band. `closureOf` sees no piece of band
 * inside the edge, the edge reads open, and the flood walks in through the front door and takes the vestibule and the
 * kitchen behind it for garden. The rule reads the jambs from the ink and shuts the edge for the flood only where a
 * wall the band reader found is one jamb AND a callout of this door's width is printed at it.
 *
 * Every drawing here is invented, at 5 cm per pixel with 12 px (0.60 m) walls — none is a trace of a real plan.
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import { DOORWAY_CALLOUT_SHARE, doorwayBetweenJambs } from '../src/index.js'
import type { GridLine, PlanCallout } from '../src/index.js'
import { BLACK, fillRect } from '../../source-cv/test/draw.js'
import { WALL, mask, sheet } from './plan.js'

const MPP = 0.05
// the production values for a 12 px wall at 5 cm/px (`decomposeCore`)
const TOLERANCE = Math.max(4, WALL * 0.6)
const MAX_OPENING_PX = 3.2 / MPP
const MIN_JAMB_PX = Math.max(2, WALL * 0.5)

/** A grid line, as the grid hands it to the flood: a horizontal facade at its outer face y = 150. */
const facade = (px = 150): GridLine => ({ axis: 'Y', px, probesPx: [px] }) as unknown as GridLine
/** Lines across the facade: the crossing wall's face and the line struck through the pier. */
const across = (xs: number[]): GridLine[] => xs.map((px) => ({ axis: 'X', px, probesPx: [px] }) as unknown as GridLine)
const callout = (x: number, y: number, cm: number): PlanCallout => ({ id: `c-${x}-${cm}`, at: { x, y }, widthsCm: [{ value: cm, confidence: 0.95 }] })

type Drawing = { crossingWall?: boolean; pier?: boolean; westPier?: boolean; farWall?: boolean }
/**
 * The facade y 139..150: on the west a wall crossing the facade (x 100..111) that ends on it, then the door
 * x 112..144 (1.65 m), then a pier x 145..162 (0.90 m, shorter than any band), then open ground, then a wall again
 * from x 230. `westPier` replaces the crossing wall by a second short pier: the mouth of a porch between two posts.
 */
function draw(d: Drawing = {}) {
  const r = sheet(320, 220)
  if (d.crossingWall ?? true) {
    fillRect(r, 20, 139, 111, 150, BLACK) // the facade wall west of the door, along the line
    fillRect(r, 100, 20, 111, 150, BLACK) // the wall crossing the facade and ending on it
  }
  if (d.westPier) fillRect(r, 94, 139, 111, 150, BLACK)
  if (d.pier ?? true) fillRect(r, 145, 139, 162, 150, BLACK)
  if (d.farWall ?? true) fillRect(r, 230, 139, 300, 150, BLACK)
  const m = mask(r)
  const bands = runLengthBands(m, { minThickness: 6, maxThickness: 30, minLength: 24 })
  return { m, bands }
}

const read = (d: Drawing, callouts: PlanCallout[], from = 112, to = 156, lines = across([111, 156])) => {
  const { m, bands } = draw(d)
  return doorwayBetweenJambs(m, 'Y', facade(), from, to, WALL, TOLERANCE, MAX_OPENING_PX, MIN_JAMB_PX, callouts, MPP, bands, lines)
}

describe('v3.53.8: a door between a wall end and a short pier, shut for the flood', () => {
  it('finds the door between the crossing wall’s end and the pier, with its printed width', () => {
    const got = read({}, [callout(128, 136, 165)])
    expect(got).not.toBeNull()
    expect(got?.hole).toEqual([112, 145])
    expect(got?.widthM).toBeCloseTo(1.65, 6)
    expect(got?.callout.widthCm).toBe(165)
  })

  it('counter-case: without a callout printed at it the gap stays as it was read — no door is assumed', () => {
    expect(read({}, [])).toBeNull()
  })

  it(`counter-case: a callout whose width differs by more than ${DOORWAY_CALLOUT_SHARE * 100} % is another opening's`, () => {
    expect(read({}, [callout(128, 136, 120)])).toBeNull()
  })

  it('counter-case: the mouth of a porch between two free posts is no door — neither jamb is a wall the band reader found', () => {
    expect(read({ crossingWall: false, westPier: true, farWall: false }, [callout(128, 136, 165)])).toBeNull()
  })

  it('counter-case: posts in line with a facade wall join its band, and then the missing callout is what keeps the mouth open', () => {
    // the band reader holds the posts and the wall beyond together across the gaps, so the jamb test alone passes here
    expect(read({ crossingWall: false, westPier: true }, [])).toBeNull()
    // a porch's width is not printed at its mouth; a callout of another width beside it is another opening's
    expect(read({ crossingWall: false, westPier: true }, [callout(128, 136, 240)])).toBeNull()
  })

  it('counter-case: a callout nearer a line across the facade than the facade belongs to that other wall', () => {
    // printed beside the crossing wall, 40 px off the facade and 3 px off the crossing wall's face
    expect(read({}, [callout(114, 110, 165)])).toBeNull()
  })

  it('counter-case: a gap wider than a lintel spans is no door, whatever is printed beside it', () => {
    // the pier removed: the gap runs from the wall end to the wall at x 230 (5.9 m)
    expect(read({ pier: false }, [callout(170, 136, 590)], 112, 230, across([111, 230]))).toBeNull()
  })
})
