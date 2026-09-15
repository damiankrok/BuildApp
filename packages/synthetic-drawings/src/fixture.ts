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

export type SyntheticSheet = {
  /** The role a publisher's page would have implied. */
  document: 'FLOOR_PLAN' | 'ELEVATION' | 'SECTION'
  view: 'FRONT' | 'REAR' | 'SIDE_UNSPECIFIED' | 'NOT_APPLICABLE'
  storey: 'GROUND' | 'NOT_APPLICABLE'
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
  return [
    make('FLOOR_PLAN', 'NOT_APPLICABLE', 'GROUND', 'rzut-parteru', renderGroundPlan(house, options)),
    make('ELEVATION', 'FRONT', 'NOT_APPLICABLE', 'elewacja-frontowa', renderElevation(house, 'FRONT', options)),
    make('ELEVATION', 'REAR', 'NOT_APPLICABLE', 'elewacja-tylna', renderElevation(house, 'REAR', options)),
    make('ELEVATION', 'SIDE_UNSPECIFIED', 'NOT_APPLICABLE', 'elewacja-lewa', renderElevation(house, 'LEFT', options)),
    make('ELEVATION', 'SIDE_UNSPECIFIED', 'NOT_APPLICABLE', 'elewacja-prawa', renderElevation(house, 'RIGHT', options)),
    make('SECTION', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'przekroj', renderSection(house, options)),
  ]
}
