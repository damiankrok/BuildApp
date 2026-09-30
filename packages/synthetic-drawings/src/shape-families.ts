/**
 * Building shape families for the plan resolver's gate (BUILDPLAN-ANALYZER-005A).
 *
 * One house per plan shape the resolver must not assume away: a footprint is
 * not always a single enclosing rectangle. Every dimension is made up here and
 * shares nothing with any project the pipeline has been run against. Two are
 * drawn toward failures measured on the generator before this stage: a wide
 * door that takes up most of a wing's front, and a wing beside the body. The
 * wing reads correctly at 2.4 m and at 4.2 m (`wing-4m2`, added after the
 * post-implementation Council). Neither reproduces the failures measured on
 * the generator before this stage — Council G's silent −14.4 % variant, and
 * the 4.0–4.4 m variants that failed in the chain reading — which differed in
 * more than the width. Those have no row, and the report says so.
 *
 * A family states what the drawing IS: how many bodies, and the footprint area
 * the publisher would print. The gate holds the analyzer to "that, or a named
 * refusal" — never a smaller building completed without a word.
 */
import type { SheetOptions, SyntheticHouse, SyntheticOpening } from './house.js'

const THICK = 0.4

export type ShapeFamily = {
  id: string
  what: string
  house: SyntheticHouse
  /** Bodies the plan draws: the main body and each wing. A recess is a pocket in a body, not a body. */
  bodies: number
  /** The footprint the publisher would print, in m²: outer faces, wings included, pockets excluded. */
  footprintM2: number
  sheet?: SheetOptions
}

const door = (at: number, width = 1.0, storey = 0, side: SyntheticOpening['side'] = 'FRONT'): SyntheticOpening => ({ side, kind: 'DOOR', at, width, height: 2.1, sill: 0, storey })
const window_ = (at: number, width: number, storey = 0, side: SyntheticOpening['side'] = 'FRONT'): SyntheticOpening => ({ side, kind: 'WINDOW', at, width, height: 1.4, sill: 0.9, storey })

const round2 = (x: number): number => Math.round(x * 100) / 100

function family(id: string, what: string, house: SyntheticHouse, sheet?: SheetOptions): ShapeFamily {
  const wings = house.wings ?? []
  const pockets = (house.recesses ?? []).filter((r) => r.storey === 0).reduce((a, r) => a + r.width * r.depth, 0)
  const footprintM2 = round2(house.width * house.depth + wings.reduce((a, w) => a + w.width * w.depth, 0) - pockets)
  return { id, what, house, bodies: 1 + wings.length, footprintM2, ...(sheet ? { sheet } : {}) }
}

const oneStorey = [{ name: 'ground', height: 2.9 }]
const twoStoreys = [
  { name: 'ground', height: 2.8 },
  { name: 'upper', height: 2.6 },
]

export const SHAPE_FAMILIES: readonly ShapeFamily[] = [
  family('rectangle-one-storey', 'one body, one storey, a gable along x', {
    name: 'Family rectangle',
    frame: 'MODEL',
    width: 9.2,
    depth: 6.4,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 37, overhang: 0, ridgeAxis: 'X' },
    openings: [door(1.2), window_(3.6, 1.6), window_(6.6, 1.4), window_(2.4, 1.4, 0, 'REAR')],
    members: [],
    chainsX: [9.2],
    chainsZ: [6.4],
  }),
  family('rectangle-two-storeys', 'one body, two storeys, a gable along z', {
    name: 'Family two storeys',
    frame: 'MODEL',
    width: 8.8,
    depth: 7.2,
    wallThickness: THICK,
    storeys: twoStoreys,
    roof: { pitchDeg: 40, overhang: 0, ridgeAxis: 'Z' },
    openings: [door(1.0), window_(4.2, 1.6), window_(1.6, 1.3, 1), window_(5.4, 1.3, 1)],
    members: [],
    chainsX: [8.8],
    chainsZ: [7.2],
  }),
  family('l-front', 'an L: a wing flush with the front', {
    name: 'Family L front',
    frame: 'MODEL',
    width: 8.4,
    depth: 6.8,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'X' },
    openings: [door(1.2), window_(4.4, 1.5)],
    members: [],
    chainsX: [8.4, 4.2],
    chainsZ: [6.8],
    wings: [{ name: 'wing', width: 4.2, depth: 3.8, offsetZ: 0, storeys: 1, roof: 'GABLE', openings: [window_(9.4, 1.4)] }],
  }),
  family('l-rear', 'an L: a wing flush with the rear', {
    name: 'Family L rear',
    frame: 'MODEL',
    width: 8.4,
    depth: 6.8,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'X' },
    openings: [door(1.2), window_(4.4, 1.5)],
    members: [],
    chainsX: [8.4, 4.2],
    chainsZ: [6.8],
    wings: [{ name: 'wing', width: 4.2, depth: 3.8, offsetZ: 3.0, storeys: 1, roof: 'GABLE', openings: [window_(1.2, 1.2, 0, 'RIGHT')] }],
  }),
  family('t-wing', 'a T-like plan: a wing centred on one side', {
    name: 'Family T',
    frame: 'MODEL',
    width: 8.4,
    depth: 7.6,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z' },
    openings: [door(1.4), window_(4.6, 1.6)],
    members: [],
    chainsX: [8.4, 4.0],
    chainsZ: [7.6],
    wings: [{ name: 'wing', width: 4.0, depth: 3.6, offsetZ: 2.0, storeys: 1, roof: 'GABLE', openings: [window_(1.2, 1.2, 0, 'RIGHT')] }],
  }),
  family('garage-side', 'two storeys with a flat-roofed garage beside them', {
    name: 'Family garage',
    frame: 'MODEL',
    width: 8.0,
    depth: 6.8,
    wallThickness: THICK,
    storeys: twoStoreys,
    roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z' },
    openings: [door(1.0), window_(4.0, 1.6), window_(1.4, 1.3, 1), window_(5.0, 1.3, 1)],
    members: [],
    chainsX: [8.0, 3.8],
    chainsZ: [6.8],
    upperChainsX: [8.0],
    upperChainsZ: [6.8],
    wings: [{ name: 'garage', width: 3.8, depth: 6.0, offsetZ: 0.4, storeys: 1, roof: 'FLAT', openings: [door(8.6, 2.6)] }],
  }),
  family('wide-door-wing', 'a wing whose front is mostly one wide door', {
    name: 'Family wide door',
    frame: 'MODEL',
    width: 8.0,
    depth: 6.8,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 36, overhang: 0, ridgeAxis: 'X' },
    openings: [door(1.0), window_(4.2, 1.5)],
    members: [],
    chainsX: [8.0, 3.6],
    chainsZ: [6.8],
    wings: [{ name: 'garage', width: 3.6, depth: 5.8, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [door(8.2, 3.2)] }],
  }),
  family('narrow-wing', 'a narrow wing beside the body', {
    name: 'Family narrow wing',
    frame: 'MODEL',
    width: 8.6,
    depth: 7.0,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 36, overhang: 0, ridgeAxis: 'X' },
    openings: [door(1.2), window_(4.6, 1.5)],
    members: [],
    chainsX: [8.6, 2.4],
    chainsZ: [7.0],
    wings: [{ name: 'store', width: 2.4, depth: 4.4, offsetZ: 1.2, storeys: 1, roof: 'FLAT', openings: [window_(1.4, 1.0, 0, 'RIGHT')] }],
  }),
  family('wing-4m2', 'the wing beside the body at 4.2 m', {
    name: 'Family wing 4.2',
    frame: 'MODEL',
    width: 8.6,
    depth: 7.0,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 36, overhang: 0, ridgeAxis: 'X' },
    openings: [door(1.2), window_(4.6, 1.5)],
    members: [],
    chainsX: [8.6, 4.2],
    chainsZ: [7.0],
    wings: [{ name: 'store', width: 4.2, depth: 4.4, offsetZ: 1.2, storeys: 1, roof: 'FLAT', openings: [window_(1.4, 1.0, 0, 'RIGHT')] }],
  }),
  family('wide-glazing', 'a front mostly glazed: one opening across half the wall', {
    name: 'Family wide glazing',
    frame: 'MODEL',
    width: 9.6,
    depth: 6.6,
    wallThickness: THICK,
    storeys: oneStorey,
    roof: { pitchDeg: 34, overhang: 0, ridgeAxis: 'X' },
    openings: [door(0.9), window_(3.0, 4.8), window_(3.2, 1.4, 0, 'REAR')],
    members: [],
    chainsX: [9.6],
    chainsZ: [6.6],
  }),
  family('small-copy', 'the two-storey body drawn small: a plan a little over 400 px wide', {
    name: 'Family small copy',
    frame: 'MODEL',
    width: 8.8,
    depth: 7.2,
    wallThickness: THICK,
    storeys: twoStoreys,
    roof: { pitchDeg: 40, overhang: 0, ridgeAxis: 'Z' },
    openings: [door(1.0), window_(4.2, 1.6), window_(1.6, 1.3, 1), window_(5.4, 1.3, 1)],
    members: [],
    chainsX: [8.8],
    chainsZ: [7.2],
  }, { pixelsPerMetre: 20 }),
]
