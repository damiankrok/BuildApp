/**
 * N7-COUNCIL-FIX-03: invented houses for the decomposition cases (Council C-1/C-2/C-3/C-8). A reconstruction of nothing.
 * HOLLOWAY: an 8.40 × 10.20 m two-storey house, 0.30 m walls, a one-storey garage on its east side.
 */
import { HOLLOWAY } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'

const gate = (at = 0.6, width = 2.4): SyntheticOpening => ({ side: 'FRONT', kind: 'DOOR', at, width, height: 2.1, sill: 0, storey: 0 })
const win = (side: SyntheticOpening['side'], at: number, width = 1.0): SyntheticOpening => ({ side, kind: 'WINDOW', at, width, height: 1.2, sill: 0.9, storey: 0 })
const g = (depth: number, offsetZ: number, openings: SyntheticOpening[] = [gate()], width = 3.6, more: Record<string, unknown> = {}) => ({ name: 'garage', width, depth, offsetZ, storeys: 1, roof: 'FLAT' as const, openings, ...more })

export const FIX03_CASES: Record<string, SyntheticHouse> = {
  // C-2: set back 0.30 m behind the house's front, a 2.4 m gate
  'gb-setback-door': { ...HOLLOWAY, name: 'Setback door', chainsZ: [3.9, 6.0, 0.3], wings: [g(6.0, 3.9)] },
  // controls
  'gb-setback-nodoor': { ...HOLLOWAY, name: 'Setback nodoor', chainsZ: [3.9, 6.0, 0.3], wings: [g(6.0, 3.9, [])] },
  'gb-flush-door': { ...HOLLOWAY, name: 'Flush door', wings: [g(6.0, 4.2)] },
  // C-1: garage deep enough that house + garage is the largest rectangle
  't-strip045': { ...HOLLOWAY, name: 'Strip 045', chainsZ: [0.45, 9.75], wings: [g(9.75, 0.45)] },
  't-strip120': { ...HOLLOWAY, name: 'Strip 120', chainsZ: [1.2, 9.0], wings: [g(9.0, 1.2)] },
  'm-full': { ...HOLLOWAY, name: 'Full depth garage', chainsZ: [10.2], wings: [g(10.2, 0)] },
  'm-wide6': { ...HOLLOWAY, name: 'Garage 6 wide', chainsX: [8.4, 6.0], chainsZ: [2.2, 8.0], wings: [g(8.0, 2.2, [gate()], 6.0)] },
  't-two-strip': { ...HOLLOWAY, name: 'Two and strip', depth: 12.0, upperChainsZ: [4.2, 7.8], chainsZ: [1.5, 1.5, 8.6, 0.4], wings: [{ ...g(1.5, 0, []), name: 'store' }, g(8.6, 3.0)] },
  // garage with windows, a store with a thin wall, four openings in the far wall
  'g-windows': { ...HOLLOWAY, name: 'Garage windows', wings: [g(6.0, 4.2, [gate(), win('RIGHT', 1.2), win('RIGHT', 3.6)])] },
  'thin-store': { ...HOLLOWAY, name: 'Thin store', chainsX: [8.4, 1.6], wings: [g(6.0, 4.2, [], 1.6, { ownWallThickness: 0.15 })] },
  'g-four': { ...HOLLOWAY, name: 'Four openings', wings: [g(6.0, 4.2, [gate(), win('RIGHT', 0.5, 0.9), win('RIGHT', 2.0, 0.9), win('RIGHT', 3.5, 0.9), win('RIGHT', 5.0, 0.6)])] },
  // §3: gates wider than a door (3.2 m) between jambs, with two side walls and a back wall
  'g-wide5': { ...HOLLOWAY, name: 'Wide gate 5', chainsX: [8.4, 0.5, 5.0, 0.5], wings: [g(6.0, 4.2, [gate(0.5, 5.0)], 6.0)] },
  'g-gate34': { ...HOLLOWAY, name: 'Gate 3.4', chainsX: [8.4, 0.4, 3.4, 0.4], wings: [g(6.0, 4.2, [gate(0.4, 3.4)], 4.2)] },
  // the same 5.0 m hole with nothing printed across it: walls round a hole, no word that it is a gate — left open, named
  'g-wide5-blank': { ...HOLLOWAY, name: 'Wide gate 5 blank', chainsX: [8.4, 6.0], wings: [g(6.0, 4.2, [gate(0.5, 5.0)], 6.0)] },
  // must NOT become a garage: a shallow porch open across its whole front, and a deep bay with no jambs
  portico: { ...HOLLOWAY, name: 'Portico', chainsZ: [7.8, 2.4], wings: [{ ...g(2.4, 7.8, [gate(0, 3.6)]), name: 'porch' }] },
  'open-bay': { ...HOLLOWAY, name: 'Open bay', wings: [{ ...g(6.0, 4.2, [gate(0, 3.6)]), name: 'bay' }] },
  // FIX-02's WING25: a 0.44 m house, its garage drawn with 0.25 m walls of its own against the house's (a double wall)
  wing25: { ...HOLLOWAY, name: 'Wing 25', wallThickness: 0.44, wings: [{ ...g(6.0, 4.2), ownWallThickness: 0.25 }] },
}
