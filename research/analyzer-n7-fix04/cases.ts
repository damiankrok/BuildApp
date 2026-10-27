/**
 * N7-FIX-04: invented houses for the set-back precision cases. A reconstruction of nothing.
 * HOLLOWAY: an 8.40 × 10.20 m two-storey house, 0.30 m walls; a 3.60 × 6.00 m one-storey garage on its east side whose
 * front stands `s` metres behind the house's front (s = 0: flush), with and without its 2.4 m gate.
 */
import { HOLLOWAY } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse, SyntheticOpening } from '@buildapp/synthetic-drawings'

const gate: SyntheticOpening = { side: 'FRONT', kind: 'DOOR', at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }
const setback = (s: number, door: boolean): SyntheticHouse => ({
  ...HOLLOWAY,
  name: `Setback ${s}`,
  ...(s > 0 ? { chainsZ: [Number((4.2 - s).toFixed(2)), 6.0, s] } : {}),
  wings: [{ name: 'garage', width: 3.6, depth: 6.0, offsetZ: Number((4.2 - s).toFixed(2)), storeys: 1, roof: 'FLAT', openings: door ? [gate] : [] }],
})
export const SETBACKS = [0, 0.15, 0.3, 0.4, 0.45, 0.6]
export const FIX04_CASES: Record<string, SyntheticHouse> = Object.fromEntries(SETBACKS.flatMap((s) => [[`s${Math.round(s * 100)}-door`, setback(s, true)], [`s${Math.round(s * 100)}-nodoor`, setback(s, false)]]))

/** Task B: the wide-gate garages of FIX-03, and the same 0.05 m wider (the width FIX-03 built), for the silhouette audit. */
const wide = (name: string, width: number, chains: number[], gateAt: number, gateW: number): SyntheticHouse => ({ ...HOLLOWAY, name, chainsX: chains, wings: [{ name: 'garage', width, depth: 6.0, offsetZ: 4.2, storeys: 1, roof: 'FLAT', openings: [{ ...gate, at: gateAt, width: gateW }] }] })
export const FIX04_GATE_CASES: Record<string, SyntheticHouse> = {
  'g-wide5': wide('Wide gate 5', 6.0, [8.4, 0.5, 5.0, 0.5], 0.5, 5.0),
  'g-gate34': wide('Gate 3.4', 4.2, [8.4, 0.4, 3.4, 0.4], 0.4, 3.4),
  'g-wide5-605': wide('Wide gate 5, 6.05', 6.05, [8.4, 0.55, 5.0, 0.5], 0.55, 5.0),
  'g-gate34-425': wide('Gate 3.4, 4.25', 4.25, [8.4, 0.45, 3.4, 0.4], 0.45, 3.4),
}
Object.assign(FIX04_CASES, FIX04_GATE_CASES)
