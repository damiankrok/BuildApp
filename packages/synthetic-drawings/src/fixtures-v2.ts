/**
 * Eleven small houses for the v2 analyzer, one theme each.
 *
 * Every one of them exists only in this file. Their footprints, storey
 * heights, pitches and openings are made up here and share nothing with any
 * project the pipeline has been run against; the sheets are drawn from these
 * specs in the MODEL frame (x from the west outer face, z from the front
 * outer plane, elevations seen from outside) and the v2 analyzer is held to
 * what comes back.
 *
 *  1  ASHBY        one body, one storey, a gable, two windows and a door
 *  2  BRACKENHOLT  two storeys, one body, a gable, windows on both storeys
 *  3  COLDHARBOUR  a main body with a lower flat-roofed body attached
 *  4  DUNMORE      a front loggia: a zone with a return wall at each end
 *  5  ELMBRIDGE    a partition with a door on each storey, two rooms each, numbered
 *  6  FOXLOW       a straight stair: tread lines and a walking-line arrow
 *  7  GREYWELL     a chimney: a block on both plans, a column above the roof line
 *  8  HATHERLEIGH  a rooflight: a light patch in the roof plane of a side elevation
 *  9  IVYBANK      an attic window on the gable end with its head raked along the roof
 * 10  KELSALL      an upper-storey loggia with a balcony slab and its fascia band
 * 11  LINDALE      an upper loggia with one return; the slab's other end is free, and the plan draws its balustrade turning back to the wall there
 */
import type { SyntheticHouse } from './house.js'

const THICK = 0.4

export const ASHBY: SyntheticHouse = {
  name: 'Ashby',
  frame: 'MODEL',
  width: 7.8,
  depth: 6.2,
  wallThickness: THICK,
  storeys: [{ name: 'ground', height: 2.9 }],
  roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'X' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.0, width: 1.0, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 3.4, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.9, width: 1.2, height: 1.4, sill: 0.9, storey: 0 },
  ],
  members: [],
  chainsX: [7.8],
  chainsZ: [6.2],
}

export const BRACKENHOLT: SyntheticHouse = {
  name: 'Brackenholt',
  frame: 'MODEL',
  width: 8.6,
  depth: 6.8,
  wallThickness: THICK,
  storeys: [
    { name: 'ground', height: 2.75 },
    { name: 'upper', height: 2.65 },
  ],
  roof: { pitchDeg: 36, overhang: 0, ridgeAxis: 'Z' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.2, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.0, width: 1.6, height: 1.45, sill: 0.85, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 2.5, width: 1.4, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'LEFT', kind: 'WINDOW', at: 2.2, width: 1.2, height: 1.2, sill: 1.0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 1.4, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.8, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'REAR', kind: 'WINDOW', at: 4.5, width: 1.2, height: 1.2, sill: 0.95, storey: 1 },
  ],
  members: [],
  chainsX: [8.6],
  chainsZ: [6.8],
}

export const COLDHARBOUR: SyntheticHouse = {
  name: 'Coldharbour',
  frame: 'MODEL',
  width: 8.2,
  depth: 6.6,
  wallThickness: THICK,
  storeys: [
    { name: 'ground', height: 2.85 },
    { name: 'upper', height: 2.55 },
  ],
  roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'Z' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.0, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.2, width: 1.6, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 3.0, width: 1.5, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'LEFT', kind: 'WINDOW', at: 2.0, width: 1.2, height: 1.2, sill: 1.0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 1.5, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.2, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
  ],
  members: [],
  chainsX: [8.2, 3.4],
  chainsZ: [6.6],
  upperChainsX: [8.2],
  upperChainsZ: [6.6],
  wings: [
    {
      name: 'store',
      width: 3.4,
      depth: 4.6,
      offsetZ: 1.0,
      storeys: 1,
      roof: 'FLAT',
      openings: [
        { side: 'FRONT', kind: 'DOOR', at: 8.9, width: 1.1, height: 2.1, sill: 0, storey: 0 },
        { side: 'RIGHT', kind: 'WINDOW', at: 2.5, width: 1.0, height: 1.2, sill: 1.0, storey: 0 },
      ],
    },
  ],
}

export const DUNMORE: SyntheticHouse = {
  name: 'Dunmore',
  frame: 'MODEL',
  width: 8.4,
  depth: 6.0,
  wallThickness: THICK,
  frontZone: 1.6,
  storeys: [{ name: 'ground', height: 2.95 }],
  roof: { pitchDeg: 40, overhang: 0, ridgeAxis: 'Z', coversFrontZone: true },
  returns: [
    { storey: 0, x: 0 },
    { storey: 0, x: 8.0 },
  ],
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.5, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.6, width: 1.8, height: 1.5, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 3.0, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'RIGHT', kind: 'WINDOW', at: 3.5, width: 1.2, height: 1.2, sill: 1.0, storey: 0 },
  ],
  members: [],
  chainsX: [8.4],
  chainsZ: [6.0, 1.6],
}

export const ELMBRIDGE: SyntheticHouse = {
  name: 'Elmbridge',
  frame: 'MODEL',
  width: 8.0,
  depth: 6.4,
  wallThickness: THICK,
  storeys: [
    { name: 'ground', height: 2.8 },
    { name: 'upper', height: 2.6 },
  ],
  roof: { pitchDeg: 34, overhang: 0, ridgeAxis: 'X' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.0, width: 1.0, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.2, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 1.5, width: 1.2, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 1.4, width: 1.2, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.6, width: 1.2, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'REAR', kind: 'WINDOW', at: 5.0, width: 1.2, height: 1.2, sill: 0.95, storey: 1 },
  ],
  members: [],
  chainsX: [8.0],
  chainsZ: [6.4],
  partitions: [
    { storey: 0, axis: 'Z', at: 3.6, from: 0.4, to: 6.0, thickness: 0.12, doors: [{ at: 1.0, width: 0.9 }] },
    { storey: 1, axis: 'Z', at: 4.4, from: 0.4, to: 6.0, thickness: 0.12, doors: [{ at: 4.2, width: 0.9 }] },
  ],
  // Two-digit numbers, storey first, as a published room schedule prints them.
  roomNumbers: [
    { storey: 0, x: 1.8, z: 3.2, text: '11' },
    { storey: 0, x: 5.9, z: 3.2, text: '12' },
    { storey: 1, x: 2.2, z: 3.2, text: '21' },
    { storey: 1, x: 6.3, z: 3.2, text: '22' },
  ],
}

/** The rooms ELMBRIDGE's publisher lists, with the areas its partitions enclose (inner faces to the partition's faces). */
export const ELMBRIDGE_ROOMS: Array<{ storey: 'GROUND' | 'UPPER'; index: number; label: string; area: number; raw: string }> = [
  { storey: 'GROUND', index: 11, label: 'SALON', area: Number(((3.6 - 0.06 - 0.4) * 5.6).toFixed(2)), raw: '11 SALON' },
  { storey: 'GROUND', index: 12, label: 'KUCHNIA', area: Number(((7.6 - 3.66) * 5.6).toFixed(2)), raw: '12 KUCHNIA' },
  { storey: 'UPPER', index: 21, label: 'SYPIALNIA', area: Number(((4.4 - 0.06 - 0.4) * 5.6).toFixed(2)), raw: '21 SYPIALNIA' },
  { storey: 'UPPER', index: 22, label: 'POKOJ', area: Number(((7.6 - 4.46) * 5.6).toFixed(2)), raw: '22 POKOJ' },
]

export const FOXLOW: SyntheticHouse = {
  name: 'Foxlow',
  frame: 'MODEL',
  width: 8.8,
  depth: 6.6,
  wallThickness: THICK,
  storeys: [
    { name: 'ground', height: 2.8 },
    { name: 'upper', height: 2.6 },
  ],
  roof: { pitchDeg: 37, overhang: 0, ridgeAxis: 'Z' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.2, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.0, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 2.6, width: 1.5, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 1.6, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 6.0, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
  ],
  members: [],
  chainsX: [8.8],
  chainsZ: [6.6],
  stair: { storeys: [0, 1], direction: 'PLUS_X', x: 1.4, z: 2.4, width: 1.0, risers: 16, going: 0.27 },
}

export const GREYWELL: SyntheticHouse = {
  name: 'Greywell',
  frame: 'MODEL',
  width: 8.2,
  depth: 6.4,
  wallThickness: THICK,
  storeys: [
    { name: 'ground', height: 2.8 },
    { name: 'upper', height: 2.6 },
  ],
  roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.0, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.0, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 3.5, width: 1.5, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 1.4, width: 1.2, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.6, width: 1.2, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'REAR', kind: 'WINDOW', at: 5.0, width: 1.2, height: 1.2, sill: 0.95, storey: 1 },
  ],
  members: [],
  chainsX: [8.2],
  chainsZ: [6.4],
  // The ridge stands 4.1 · tan 38° ≈ 3.2 m over the 5.4 m walls, at 8.6 m; the stack stops short of it.
  chimneys: [{ x0: 2.0, z0: 3.0, x1: 2.6, z1: 3.9, top: 8.2 }],
}

export const HATHERLEIGH: SyntheticHouse = {
  name: 'Hatherleigh',
  frame: 'MODEL',
  width: 7.6,
  depth: 6.8,
  wallThickness: THICK,
  storeys: [{ name: 'ground', height: 2.9 }],
  roof: { pitchDeg: 40, overhang: 0, ridgeAxis: 'Z', covering: 128 },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.0, width: 1.0, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.3, width: 1.6, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 2.4, width: 1.5, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'RIGHT', kind: 'WINDOW', at: 3.0, width: 1.2, height: 1.2, sill: 1.0, storey: 0 },
  ],
  members: [],
  chainsX: [7.6],
  chainsZ: [6.8],
  rooflights: [{ slope: 'LOW', along: 2.6, width: 0.9, y: 0.9, height: 1.1 }],
}

export const IVYBANK: SyntheticHouse = {
  name: 'Ivybank',
  frame: 'MODEL',
  width: 7.4,
  depth: 6.2,
  wallThickness: THICK,
  storeys: [
    { name: 'ground', height: 2.8 },
    // A knee wall: the attic's eaves stand 1.8 m over its floor, and its gable-end window rises into the roof.
    { name: 'attic', height: 1.8 },
  ],
  roof: { pitchDeg: 45, overhang: 0, ridgeAxis: 'Z' },
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.0, width: 1.0, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.4, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 2.5, width: 1.5, height: 1.3, sill: 0.9, storey: 0 },
    // Sill 0.9 over the attic floor; the tall jamb at x = 3.3 reaches 7.55, 0.35 m under the 45° rake (the roof line there is at 7.90).
    { side: 'FRONT', kind: 'WINDOW', at: 2.2, width: 1.1, height: 3.85, sill: 0.9, storey: 1, rakedHead: true },
  ],
  members: [],
  chainsX: [7.4],
  chainsZ: [6.2],
}

export const KELSALL: SyntheticHouse = {
  name: 'Kelsall',
  frame: 'MODEL',
  width: 8.4,
  depth: 6.2,
  wallThickness: THICK,
  frontZone: 1.5,
  storeys: [
    { name: 'ground', height: 2.85 },
    { name: 'upper', height: 2.6 },
  ],
  roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z', coversFrontZone: true },
  returns: [
    { storey: 1, x: 0 },
    { storey: 1, x: 8.0 },
  ],
  balconies: [{ storey: 1, x0: 0.4, x1: 8.0, fasciaDepth: 0.4, railingHeight: 1.0 }],
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.2, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 4.5, width: 1.8, height: 1.5, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 3.0, width: 1.5, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'DOOR', at: 1.5, width: 1.0, height: 2.1, sill: 0, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.0, width: 1.4, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'REAR', kind: 'WINDOW', at: 5.5, width: 1.2, height: 1.2, sill: 0.95, storey: 1 },
  ],
  members: [],
  chainsX: [8.4],
  chainsZ: [6.2, 1.5],
  upperChainsX: [8.4],
  upperChainsZ: [6.2, 1.5],
}

export const LINDALE: SyntheticHouse = {
  name: 'Lindale',
  frame: 'MODEL',
  width: 9.2,
  depth: 6.0,
  wallThickness: THICK,
  frontZone: 1.3,
  storeys: [
    { name: 'ground', height: 2.8 },
    { name: 'upper', height: 2.7 },
  ],
  roof: { pitchDeg: 37, overhang: 0, ridgeAxis: 'Z', coversFrontZone: true },
  // One return, at the high end of the upper loggia; the low end has none, on either storey.
  returns: [{ storey: 1, x: 8.8 }],
  // The slab stops short of the west end, free; only the line the upper plan draws there turns its balustrade back to the wall.
  balconies: [{ storey: 1, x0: 2.4, x1: 8.8, fasciaDepth: 0.35, railingHeight: 1.05, balustradeTurns: ['LOW'] }],
  openings: [
    { side: 'FRONT', kind: 'DOOR', at: 1.3, width: 1.1, height: 2.1, sill: 0, storey: 0 },
    { side: 'FRONT', kind: 'WINDOW', at: 5.2, width: 1.7, height: 1.4, sill: 0.9, storey: 0 },
    { side: 'REAR', kind: 'WINDOW', at: 3.1, width: 1.5, height: 1.3, sill: 0.9, storey: 0 },
    { side: 'FRONT', kind: 'DOOR', at: 4.1, width: 1.0, height: 2.1, sill: 0, storey: 1 },
    { side: 'FRONT', kind: 'WINDOW', at: 6.6, width: 1.3, height: 1.3, sill: 0.9, storey: 1 },
    { side: 'REAR', kind: 'WINDOW', at: 5.6, width: 1.2, height: 1.2, sill: 0.95, storey: 1 },
  ],
  members: [],
  chainsX: [9.2],
  chainsZ: [6.0, 1.3],
  upperChainsX: [9.2],
  upperChainsZ: [6.0, 1.3],
}

export const V2_FIXTURES: readonly SyntheticHouse[] = [ASHBY, BRACKENHOLT, COLDHARBOUR, DUNMORE, ELMBRIDGE, FOXLOW, GREYWELL, HATHERLEIGH, IVYBANK, KELSALL, LINDALE]
