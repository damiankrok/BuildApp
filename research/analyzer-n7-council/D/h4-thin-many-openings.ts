/** Council D, Q4: a DRAWN_THIN_WALLS body with 13 windows: each window frame (sized from the house T) is a cut; past PREVIEW_MAX_CUTS the whole model is refused. */
import type { OpeningV2 } from '../../../packages/reconstruction/src/v2/openings-v2.js'
import { PREVIEW_MAX_CUTS } from '../../../packages/reconstruction/src/candidate.js'
import { building, mass, run, check, done } from './lib.js'
const op = (i: number, facade: OpeningV2['facade'], a: number): OpeningV2 => ({ id: `o-${i}`, storeyIndex: 0, massId: 'attached-0', facade, planeAt: 0, interval: [a, a + 0.6], widthM: 0.6, sillY: 0.9, headY: 2.1, profile: 'RECTANGULAR', family: 'WINDOW', mullions: [], planGap: { frameId: 'p', pixelRect: { x0: 0, y0: 0, x1: 1, y1: 1 } }, provenance: { interval: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', sill: 'SOURCE_DERIVED', head: 'SOURCE_DERIVED', profile: 'SOURCE_DERIVED', family: 'SOURCE_DERIVED' }, uncertaintyM: 0.02, why: 'c' }) as unknown as OpeningV2
const main = mass('main', 'MAIN', 0, 0, 10, 8)
const a = mass('attached-0', 'ATTACHED', 10, 0.5, 10.5, 15, [0], { wallThicknessM: 0.12 })
for (const n of [3, PREVIEW_MAX_CUTS + 1]) {
  const openings = Array.from({ length: n }, (_, i) => op(i, 'EAST', 1 + i * 1.0))
  const r = run(building([main, a], 1, { openings }))
  console.log(`n=${n}: preview ok=${r.preview.fit.ok} failures=${r.preview.failures.length} model walls=${r.model?.walls.length ?? 'NONE'} windows=${r.model?.windows.length ?? 'NONE'}`)
  if (n > PREVIEW_MAX_CUTS) check('13 thin-body windows refuse the whole model (no preview)', !r.preview.fit.ok && r.preview.failures.length === 0, `fit.ok ${r.preview.fit.ok}`)
  else check('3 thin-body windows each cut (lost), main kept', r.preview.fit.ok && r.preview.failures.length === n)
}
done()
