/** RESEARCH ONLY: render an invented fixture's plan to a PNG OUTSIDE the repo, to look at it. */
import { writeFileSync } from 'node:fs'
import { HOLLOWAY, renderGroundPlan, encodePng } from '@buildapp/synthetic-drawings'
const out = process.argv[process.argv.indexOf('--out') + 1]
if (!out || out.startsWith('/home/user/BuildApp')) throw new Error('--out outside the repo')
const house = { ...HOLLOWAY, name: 'Wing2storey', depth: 12.0, chainsZ: [5.0, 1.0, 6.0], chainsX: [8.4, 3.6], upperChainsX: [8.4, 3.6], upperChainsZ: [5.0, 7.0], wings: [
  { name: 'wing', width: 3.6, depth: 5.0, offsetZ: 0, storeys: 2, roof: 'FLAT' as const, openings: [] },
  { name: 'garage', width: 3.6, depth: 6.0, offsetZ: 6.0, storeys: 1, roof: 'FLAT' as const, openings: [] },
] }
for (const s of [0, 1]) writeFileSync(`${out}/wing2storey-s${s}.png`, encodePng(renderGroundPlan(house, { storey: s }) as never))
