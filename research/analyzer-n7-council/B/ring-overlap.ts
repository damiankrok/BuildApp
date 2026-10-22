/**
 * N7-COUNCIL B (research only): the WALLS_OVERLAP area a rectangular ring of width W (x), length L (z) and thickness T
 * reports, against (2T − W)(L − 2T); and which (T, W) make a W-wide body fail where its drawn wall t would not.
 */
import { createEmptyModel, validateModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'

const area = (W: number, L: number, T: number): number => {
  let m
  try {
    m = runCommands(createEmptyModel('t', 't'), [
      { type: 'createBuilding', id: 'b' },
      { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
      { type: 'createWallRing', id: 'ring-attached-1-0', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: L }, { x: 0, z: L }], thickness: T, height: 3, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' } as never,
    ])
  } catch (e) {
    const msg = String((e as Error).message)
    const hit = /share (\d+\.\d+) m²/.exec(msg)
    if (!hit) console.log('  error', msg.slice(0, 200))
    return hit ? Number(hit[1]) : Number.NaN
  }
  const v = validateModel(JSON.parse(JSON.stringify(m)))
  const o = v.issues.filter((i) => i.code === 'WALLS_OVERLAP')
  return o.reduce((a, i) => Math.max(a, i.measured ?? 0), 0)
}
let bad = 0
for (const [W, L, T] of [[0.8, 5, 0.44], [0.7, 3, 0.43], [0.62, 3, 0.38], [0.9, 8, 0.49], [1.0, 5, 0.44], [0.85, 6, 0.44]]) {
  const got = area(W, L, T)
  const formula = Math.max(0, 2 * T - W) * (L - 2 * T)
  console.log(`W ${W} L ${L} T ${T}: validator ${got.toFixed(4)} formula ${formula.toFixed(4)}`)
  if (Math.abs(got - formula) > 1e-3) bad += 1
}
// a body whose own walls are drawn 0.25 m thick, 0.75 m wide: fine at its own t, refused at a global T of 0.44
console.log('W 0.75 L 4 t 0.25 ->', area(0.75, 4, 0.25).toFixed(4), '; at global T 0.44 ->', area(0.75, 4, 0.44).toFixed(4))
if (bad > 0) throw new Error(`${bad} cases disagree with (2T−W)(L−2T)`)
