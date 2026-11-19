/**
 * v3.54.15 — a publisher's side label ("elewacja lewa / prawa": SIDE_LEFT / SIDE_RIGHT) fixes the side of the drawing
 * as "frontowa" does. Found on Ballina once the ridge datum was admitted: on the true ridge-to-ground height the full
 * side drawings measured onto the front/rear axis (their traced extent is the walls only), both front and rear were
 * taken, and a 120 px thumbnail of the same view took the side. The label decides; the larger drawing of a labelled view
 * comes first; an unlabelled side still goes by the measured width.
 */
import { describe, expect, it } from 'vitest'
import { registerElevations } from '../src/views.js'

const frame = (id: string, view: string, width: number) => ({ id, assetId: `asset-${id}`, variantByteHash: 'h', roles: { document: 'ELEVATION', projection: 'ORTHOGRAPHIC_ELEVATION', view }, size: { width, height: 400 } }) as never
const massing = { width: 13.65, depth: 8.15, totalHeight: 5.54 }

describe('v3.54.15 side labels in the side assignment', () => {
  it('SIDE_LEFT / SIDE_RIGHT take their own wall even when the width on the section height reads as the other axis', () => {
    const { registrations } = registerElevations(
      [
        { frame: frame('front', 'FRONT', 983), extent: { x0: 20, y0: 4, x1: 978, y1: 393 } },
        { frame: frame('rear', 'REAR', 976), extent: { x0: 0, y0: 7, x1: 975, y1: 194 } },
        // the walls only: 569 px across, 176 px tall → 17.9 m on the ridge height
        { frame: frame('left', 'SIDE_LEFT', 869), extent: { x0: 184, y0: 219, x1: 753, y1: 395 } },
        { frame: frame('right', 'SIDE_RIGHT', 857), extent: { x0: 110, y0: 221, x1: 678, y1: 395 } },
        // a thumbnail of the right elevation, measured on the depth axis
        { frame: frame('thumb', 'SIDE_RIGHT', 120), extent: { x0: 14, y0: 3, x1: 95, y1: 53 } },
      ],
      massing,
    )
    const side = Object.fromEntries(registrations.map((r) => [r.frameId, r.side]))
    expect(side).toMatchObject({ front: 'FRONT', rear: 'REAR', left: 'LEFT', right: 'RIGHT' })
    expect(side.thumb).toBeUndefined()
    expect(registrations.find((r) => r.frameId === 'left')?.sideWhy).toMatch(/publisher labels/)
  })

  it('counter-trial: an unlabelled side view is still placed by its measured width', () => {
    const { registrations } = registerElevations(
      [
        { frame: frame('front', 'FRONT', 983), extent: { x0: 20, y0: 4, x1: 978, y1: 393 } },
        { frame: frame('side', 'SIDE_UNSPECIFIED', 869), extent: { x0: 132, y0: 1, x1: 805, y1: 395 } },
      ],
      massing,
    )
    const r = registrations.find((x) => x.frameId === 'side')
    expect(r?.side === 'LEFT' || r?.side === 'RIGHT').toBe(true)
    expect(r?.sideWhy).toMatch(/footprint depth/)
  })
})
