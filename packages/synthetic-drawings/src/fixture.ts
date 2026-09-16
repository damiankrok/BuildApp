/**
 * The fixture house, and the source package its sheets make.
 *
 * `LARCHFIELD` is a small two-storey house that exists only here. Its
 * dimensions are chosen to share nothing with any real project the pipeline
 * has been run against: a 9.60 by 7.20 footprint on a 0.30 wall, storeys of
 * 2.80 and 2.60, a 35-degree roof with its ridge running east-west, and a
 * facade band a third of a metre proud of the front wall.
 *
 * Because the sheets are rendered to real PNG bytes and wrapped in a real
 * SourcePackage, the whole pipeline runs on them unchanged — the same
 * acquisition contract, the same analyzer, the same metric reader, the same
 * solver. The only thing that differs is that here the answer is known.
 */
import { sha256Bytes } from '@buildapp/source-common'
import { encodePng } from './png.js'
import { renderElevation, renderGroundPlan, renderSection } from './house.js'
import type { SheetOptions, SyntheticHouse } from './house.js'

export const LARCHFIELD: SyntheticHouse = {
  name: 'Larchfield',
  width: 9.6,
  depth: 7.2,
  wallThickness: 0.3,
  storeys: [
    { name: 'ground', height: 2.8 },
    { name: 'upper', height: 2.6 },
  ],
  roof: { pitchDeg: 35, overhang: 0.5, ridgeAxis: 'X' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.2, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.2, width: 1.8, height: 1.5, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 7.2, width: 1.2, height: 1.5, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 2.1, width: 1.5, height: 1.4, sill: 0.95, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 6.3, width: 1.5, height: 1.4, sill: 0.95, storey: 1 },
    { side: 'REAR', kind: 'WINDOW', at: 3.0, width: 2.4, height: 1.6, sill: 0.8, storey: 0 },
    { side: 'LEFT', kind: 'WINDOW', at: 2.4, width: 1.2, height: 1.2, sill: 1.1, storey: 0 },
  ],
  members: [
    { side: 'FRONT', orientation: 'HORIZONTAL', at: 0, length: 9.6, width: 0.4, depth: 0.3, y: 2.8 },
    { side: 'FRONT', orientation: 'VERTICAL', at: 0.4, length: 2.8, width: 0.35, depth: 0.25, y: 0 },
    { side: 'FRONT', orientation: 'VERTICAL', at: 8.85, length: 2.8, width: 0.35, depth: 0.25, y: 0 },
  ],
  chainsX: [2.4, 4.8, 2.4],
  chainsZ: [1.8, 3.6, 1.8],
}

/**
 * §25's second fixture: a main body with a one-storey garage attached along
 * its side, under a roof of its own.
 *
 * Everything about it is there to make the ONE-RECTANGLE reading wrong. The
 * garage is shallower than the house, so the overall rectangle is 23 m² larger
 * than the building; it stops at the ground floor, so the upper plan covers
 * only the house; and it is flat-roofed against a gable, so a single roof over
 * the bounding box cannot be right either. A reader that returns one box here
 * has failed in three independent ways, and each of them is printed on a
 * sheet.
 */
export const HOLLOWAY: SyntheticHouse = {
  name: 'Holloway',
  width: 8.4,
  depth: 10.2,
  wallThickness: 0.3,
  storeys: [
    { name: 'ground', height: 2.7 },
    { name: 'upper', height: 2.55 },
  ],
  roof: { pitchDeg: 38, overhang: 0.45, ridgeAxis: 'Z' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.5, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.5, width: 2.1, height: 1.5, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 2.7, width: 2.4, height: 1.6, sill: 0.8, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 2.1, width: 1.5, height: 1.4, sill: 0.95, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.4, width: 1.5, height: 1.4, sill: 0.95, storey: 1 },
    { side: 'LEFT', kind: 'WINDOW', at: 3.6, width: 1.2, height: 1.2, sill: 1.1, storey: 0 },
  ],
  members: [],
  chainsX: [8.4, 3.6],
  chainsZ: [4.2, 6.0],
  upperChainsX: [8.4],
  upperChainsZ: [4.2, 6.0],
  wings: [
    {
      name: 'garage',
      width: 3.6,
      depth: 6.0,
      offsetZ: 4.2,
      storeys: 1,
      roof: 'FLAT',
      openings: [{ side: 'FRONT', kind: 'DOOR', at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }],
    },
  ],
}

/**
 * §25's third fixture: a footprint that steps, with a loggia bitten out of
 * the front.
 *
 * The upper storey starts 2.20 m in from the rear wall, so the two plans have
 * different footprints and the storeys cannot share one ring. The loggia is a
 * pocket with a mouth on the facade plane, a back wall 1.60 m in and a return
 * wall at each end — topology, not a colour — and the plan draws it as exactly
 * that, so a reader that only looks at the outline will report a facade where
 * there is a hole, and one that reads it off the elevation's colour will hang
 * a box on the front of the building.
 */
export const REDMIRE: SyntheticHouse = {
  name: 'Redmire',
  width: 10.5,
  depth: 8.1,
  wallThickness: 0.25,
  storeys: [
    { name: 'ground', height: 2.9 },
    { name: 'upper', height: 2.5 },
  ],
  roof: { pitchDeg: 32, overhang: 0.4, ridgeAxis: 'X' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 6.9, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 8.4, width: 1.5, height: 1.5, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 3.0, width: 2.4, height: 1.6, sill: 0.8, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 1.8, width: 1.8, height: 1.4, sill: 0.95, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 6.9, width: 1.8, height: 1.4, sill: 0.95, storey: 1 },
    { side: 'LEFT', kind: 'WINDOW', at: 2.4, width: 1.2, height: 1.2, sill: 1.1, storey: 0 },
  ],
  members: [],
  chainsX: [4.5, 6.0],
  chainsZ: [2.2, 5.9],
  upperChainsX: [4.5, 6.0],
  upperChainsZ: [2.2, 5.9],
  upperInset: { minZ: 2.2 },
  recesses: [{ side: 'FRONT', at: 1.2, width: 3.3, depth: 1.6, storey: 0 }],
}

export type SyntheticSheet = {
  /** The role a publisher's page would have implied. */
  document: 'FLOOR_PLAN' | 'ELEVATION' | 'SECTION'
  view: 'FRONT' | 'REAR' | 'SIDE_UNSPECIFIED' | 'NOT_APPLICABLE'
  storey: 'GROUND' | 'UPPER' | 'NOT_APPLICABLE'
  /** A stable name, used as the asset's URL path so a package can be built from it. */
  slug: string
  width: number
  height: number
  bytes: Uint8Array
  byteHash: string
}

/** Render the whole set of sheets a publisher would show, as bytes. */
export function renderSheets(house: SyntheticHouse = LARCHFIELD, options: SheetOptions = {}): SyntheticSheet[] {
  const make = (document: SyntheticSheet['document'], view: SyntheticSheet['view'], storey: SyntheticSheet['storey'], slug: string, canvas: ReturnType<typeof renderGroundPlan>): SyntheticSheet => {
    const raster = canvas.toRaster()
    const bytes = encodePng(raster)
    return { document, view, storey, slug, width: raster.width, height: raster.height, bytes, byteHash: sha256Bytes(bytes) }
  }
  const sheets: SyntheticSheet[] = [make('FLOOR_PLAN', 'NOT_APPLICABLE', 'GROUND', 'rzut-parteru', renderGroundPlan(house, { ...options, storey: 0 }))]
  // A publisher draws one plan per storey that differs, and for a two-storey
  // house that is two plans. Drawing the upper one is what makes a wing that
  // stops at the ground floor, or a footprint that steps in above it, a fact
  // on the sheets rather than an assumption in the reader.
  if (house.storeys.length > 1) sheets.push(make('FLOOR_PLAN', 'NOT_APPLICABLE', 'UPPER', 'rzut-pietra', renderGroundPlan(house, { ...options, storey: 1 })))
  return [
    ...sheets,
    make('ELEVATION', 'FRONT', 'NOT_APPLICABLE', 'elewacja-frontowa', renderElevation(house, 'FRONT', options)),
    make('ELEVATION', 'REAR', 'NOT_APPLICABLE', 'elewacja-tylna', renderElevation(house, 'REAR', options)),
    make('ELEVATION', 'SIDE_UNSPECIFIED', 'NOT_APPLICABLE', 'elewacja-lewa', renderElevation(house, 'LEFT', options)),
    make('ELEVATION', 'SIDE_UNSPECIFIED', 'NOT_APPLICABLE', 'elewacja-prawa', renderElevation(house, 'RIGHT', options)),
    make('SECTION', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'przekroj', renderSection(house, options)),
  ]
}
