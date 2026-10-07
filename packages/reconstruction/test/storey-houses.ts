/**
 * BUILDPLAN-ANALYZER-005L — houses for the per-storey geometry fixtures, and how a model's levels are read back.
 *
 * Shared by the emission fixtures (`storey-emission.test.ts`) and the non-circularity gate
 * (`tests/architecture/storey-support.test.ts`). Every dimension is made up here.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'

const door = (at: number, width = 1.0, storey = 0, side: SyntheticOpening['side'] = 'FRONT'): SyntheticOpening => ({ side, kind: 'DOOR', at, width, height: 2.1, sill: 0, storey })
const window_ = (at: number, width: number, storey = 0, side: SyntheticOpening['side'] = 'FRONT'): SyntheticOpening => ({ side, kind: 'WINDOW', at, width, height: 1.4, sill: 0.9, storey })
const twoStoreys = [
  { name: 'ground', height: 2.8 },
  { name: 'upper', height: 2.6 },
]

/** An upper storey set back 2.4 m from the rear wall: its own plan draws it 6.0 m deep over an 8.4 m house. */
export const INSET_REAR: SyntheticHouse = {
  name: 'Inset upper storey',
  frame: 'MODEL',
  width: 9.6,
  depth: 8.4,
  wallThickness: 0.4,
  storeys: twoStoreys,
  roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'X' },
  openings: [door(1.0), window_(4.4, 1.6), window_(1.6, 1.3, 1), window_(5.6, 1.3, 1)],
  members: [],
  chainsX: [9.6],
  chainsZ: [8.4],
  upperInset: { minZ: 2.4 },
  upperChainsX: [9.6],
  upperChainsZ: [6.0],
  // a bearing wall 3.0 m behind the front wall that carries on up: the one wall both plans draw inside the house,
  // and what fixes where the shallower upper storey stands
  partitions: [0, 1].map((storey) => ({ storey, axis: 'X' as const, at: 3.0, from: 0.4, to: 9.2, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] })),
}

/** A two-storey house and a one-storey garage against its east wall; the upper plan draws the house only. */
export const HOUSE_AND_GARAGE: SyntheticHouse = {
  name: 'House and garage',
  frame: 'MODEL',
  width: 8.4,
  depth: 7.6,
  wallThickness: 0.4,
  storeys: twoStoreys,
  roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z' },
  openings: [door(1.0), window_(4.4, 1.6), window_(1.4, 1.3, 1), window_(5.2, 1.3, 1)],
  members: [],
  chainsX: [8.4, 4.0],
  chainsZ: [7.6],
  upperChainsX: [8.4],
  upperChainsZ: [7.6],
  wings: [{ name: 'garage', width: 4.0, depth: 5.2, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [window_(1.2, 1.2, 0, 'RIGHT')] }],
}

/** The same house with the wing carried up: its upper plan draws both bodies. */
export const HOUSE_AND_WING_UP: SyntheticHouse = {
  ...HOUSE_AND_GARAGE,
  name: 'House and two-storey wing',
  upperChainsX: [8.4, 4.0],
  wings: [{ name: 'wing', width: 4.0, depth: 5.2, offsetZ: 0, storeys: 2, roof: 'FLAT', openings: [window_(1.2, 1.2, 0, 'RIGHT')] }],
}

export type Box = [number, number, number, number]
/** Each level's exterior wall rings, as the boxes their walls span (wall axes), in model metres. */
export function ringsByLevel(model: CanonicalBuildingModel): Map<number, Box[]> {
  const walls = new Map(model.walls.map((w) => [w.id, w]))
  const out = new Map<number, Box[]>()
  for (const level of model.levels) {
    const boxes = model.wallRings
      .filter((r) => r.levelId === level.id)
      .map((r) => r.wallIds.map((id) => walls.get(id)).filter((w): w is NonNullable<typeof w> => w !== undefined))
      .filter((ws) => ws.length > 0)
      .map((ws): Box => {
        const xs = ws.flatMap((w) => [w.start.x, w.end.x])
        const zs = ws.flatMap((w) => [w.start.z, w.end.z])
        return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]
      })
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    out.set(level.index, boxes)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------
// 005L council B: houses the emission fixtures did not cover (made up here, as above)
// ---------------------------------------------------------------------------------------------------------------------

/** The upper storey set back 2.4 m from the WEST wall, with windows of its own on that inset wall, its front and rear. */
export const INSET_WEST: SyntheticHouse = {
  name: 'Inset west',
  frame: 'MODEL',
  width: 9.6,
  depth: 8.4,
  wallThickness: 0.4,
  storeys: twoStoreys,
  roof: { pitchDeg: 35, overhang: 0, ridgeAxis: 'Z' },
  openings: [door(1.0), window_(4.4, 1.6), window_(2.0, 1.2, 0, 'LEFT'), window_(5.0, 1.3, 1), window_(3.0, 1.2, 1, 'LEFT'), window_(6.0, 1.2, 1, 'REAR')],
  members: [],
  chainsX: [9.6],
  chainsZ: [8.4],
  upperInset: { minX: 2.4 },
  upperChainsX: [7.2],
  upperChainsZ: [8.4],
  partitions: [0, 1].map((storey) => ({ storey, axis: 'Z' as const, at: 6.0, from: 0.4, to: 8.0, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] })),
}

/** A two-storey house with a one-storey wing, the house's upper storey set back 2.4 m from the rear. */
export const L_TWO_MASSES: SyntheticHouse = { ...HOUSE_AND_WING_UP, name: 'L upper over two bodies', upperInset: { minZ: 2.4 }, upperChainsZ: [7.6] }

/** Ground, upper (the whole box) — and, apart, an attic plan (`THREE_ATTIC_PLAN`) set back 2.4 m front and rear. */
export const THREE: SyntheticHouse = {
  ...INSET_REAR,
  name: 'Three storeys',
  storeys: [...twoStoreys, { name: 'attic', height: 2.4 }],
  upperInset: undefined,
  upperChainsZ: [8.4],
  openings: [door(1.0), window_(4.4, 1.6), window_(1.6, 1.3, 1), window_(5.6, 1.3, 1), window_(2.0, 1.2, 1, 'LEFT')],
  partitions: [0, 1].map((storey) => ({ storey, axis: 'X' as const, at: 3.0, from: 0.4, to: 9.2, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] })),
}
export const THREE_ATTIC_PLAN: SyntheticHouse = {
  ...INSET_REAR,
  name: 'attic plan',
  upperInset: { minZ: 2.4, maxZ: 2.4 },
  upperChainsZ: [3.6],
  openings: [window_(4.0, 1.0, 1)],
  partitions: [{ storey: 1, axis: 'X' as const, at: 3.0, from: 0.4, to: 9.2, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] }],
}

/** A two-storey house with a bearing wall 2.0 m behind the front on both storeys... */
export const WITH_BASEMENT: SyntheticHouse = { ...INSET_REAR, name: 'House over a partial basement', upperInset: undefined, upperChainsZ: [8.4], partitions: [0, 1].map((storey) => ({ storey, axis: 'X' as const, at: 2.0, from: 0.4, to: 9.2, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] })) }
/** ...and a basement under its front 5.4 m only, the same bearing wall drawn on it. */
export const BASEMENT_PLAN: SyntheticHouse = { ...INSET_REAR, name: 'basement plan', depth: 5.4, chainsZ: [5.4], upperInset: undefined, upperChainsZ: [5.4], openings: [window_(2.0, 1.0, 0)], partitions: [{ storey: 0, axis: 'X' as const, at: 2.0, from: 0.4, to: 9.2, thickness: 0.24, doors: [{ at: 4.0, width: 0.9 }] }] }

/** A house and a one-storey garage (4.0 × 5.2 m)... */
export const GARAGE_HOUSE: SyntheticHouse = {
  name: 'House and garage',
  frame: 'MODEL',
  width: 8.4,
  depth: 7.6,
  wallThickness: 0.4,
  storeys: twoStoreys,
  roof: { pitchDeg: 38, overhang: 0, ridgeAxis: 'Z' },
  openings: [door(1.0), window_(4.4, 1.6), window_(1.4, 1.3, 1), window_(5.2, 1.3, 1)],
  members: [],
  chainsX: [8.4, 4.0],
  chainsZ: [7.6],
  upperChainsX: [8.4],
  upperChainsZ: [7.6],
  wings: [{ name: 'garage', width: 4.0, depth: 5.2, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [window_(3.2, 1.2, 0, 'RIGHT')] }],
}
/** ...and a basement under the garage only. */
export const GARAGE_BASEMENT_PLAN: SyntheticHouse = { ...INSET_REAR, name: 'garage basement', width: 4.0, depth: 5.2, chainsX: [4.0], chainsZ: [5.2], upperInset: undefined, upperChainsX: [4.0], upperChainsZ: [5.2], roof: { pitchDeg: 30, overhang: 0, ridgeAxis: 'X' }, openings: [window_(1.0, 1.0, 0)], partitions: [{ storey: 0, axis: 'Z' as const, at: 2.0, from: 0.4, to: 4.8, thickness: 0.24, doors: [] }] }
