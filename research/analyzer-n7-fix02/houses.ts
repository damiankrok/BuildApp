/**
 * N7-COUNCIL-FIX-02: invented houses for the wall-thickness and ring cases. A reconstruction of nothing.
 *
 *  THICK43    0.43 m outer walls and heavy 0.20 m partitions, more partition than facade (Council B-1's shape)
 *  WING25     a 0.44 m house with a garage drawn with its own 0.25 m walls (bodies with different walls)
 *  WING25N    the same with a 1.05 m store instead of the garage: two 0.25 m walls hold, two 0.44 m would not (B-2)
 *  SLIVER48   a 0.48 m body beside a 0.44 m house, its walls drawn at the house's thickness (the OWNER's shape: width ≈ wall)
 */
import { ELMBRIDGE, HOLLOWAY, SLIVERTON } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'

const garage = (HOLLOWAY.wings ?? [])[0]
export const FIX02_HOUSES: Record<string, SyntheticHouse> = {
  thick43: {
    ...ELMBRIDGE,
    name: 'Thick 43',
    wallThickness: 0.43,
    partitions: [
      // more partition than facade on both storeys: 4 × 5.54 m across and 2 × 7.14 m along, against 25.3 m of outer wall
      ...[0, 1].flatMap((storey) => [
        ...[2.0, 3.6, 5.2, 6.4].map((at) => ({ storey, axis: 'Z' as const, at, from: 0.43, to: 5.97, thickness: 0.2, doors: [{ at: 1.0, width: 0.9 }] })),
        ...[2.2, 4.2].map((at) => ({ storey, axis: 'X' as const, at, from: 0.43, to: 7.57, thickness: 0.2, doors: [{ at: 0.6, width: 0.9 }] })),
      ]),
    ],
  },
  wing25: { ...HOLLOWAY, name: 'Wing 25', wallThickness: 0.44, wings: [{ ...garage, ownWallThickness: 0.25 }] },
  wing25n: { ...HOLLOWAY, name: 'Wing 25 narrow', wallThickness: 0.44, chainsX: [8.4, 1.05], wings: [{ ...garage, name: 'store', width: 1.05, ownWallThickness: 0.25, openings: [] }] },
  sliver48: { ...SLIVERTON, name: 'Sliver 48', wallThickness: 0.44, wings: [{ ...(SLIVERTON.wings ?? [])[0], width: 0.48 }] },
}
