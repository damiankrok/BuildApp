/**
 * Council D: a body WIDER than 2T when thinBodies() looks at it is narrowed below 2T by the wall reconciliation
 * (repairRing EDGE_MOVED onto the neighbour's face), and then refused for its OWN w1/w3 overlap — the owner's message.
 *   npx vite-node research/analyzer-n7-council/D/h2-reconcile-narrows.ts
 */
import { thinBodies } from '../../../packages/reconstruction/src/v2/thin-body.js'
import { building, mass, run, check, done, T } from './lib.js'

for (const [label, x0, w, tol] of [
  ['east, 5 cm into main, W=0.62', 9.95, 0.62, 0.06],
  ['east, 5 cm into main, W=0.70', 9.95, 0.7, 0.06],
  ['east, 5 cm gap from main, W=0.62', 10.05, 0.62, 0.06],
] as const) {
  console.log(`--- ${label} (T=${T}, tolerance ${tol}) ---`)
  const main = mass('main', 'MAIN', 0, 0, 10, 8)
  const a0 = mass('attached-0', 'ATTACHED', 3, 8, 7, 11) // a sound body behind, so the failing one is attached-1
  const a1 = mass('attached-1', 'ATTACHED', x0, 1, x0 + w, 7)
  check('thinBodies does not flag attached-1', thinBodies([main, a0, a1], T).length === 0, `W=${w} >= 2T=${2 * T}`)
  const r = run(building([main, a0, a1]), tol)
  const recs = r.preview.reconciled?.records ?? []
  console.log('  plain:', r.plainFailedId, r.plainErrors?.map((e) => e.message.slice(0, 110)).join(' | '))
  console.log('  reconciliation records:', JSON.stringify(recs.map((x) => ({ wall: x.wallId, other: x.otherWallId, action: x.action, moveM: x.moveM, after: x.after }))))
  console.log('  preview failures:', JSON.stringify(r.preview.failures.map((f) => ({ i: f.commandIndex, id: f.id, msg: f.message.slice(0, 120) }))))
  console.log('  skipped:', JSON.stringify(r.preview.skipped.map((s) => `${s.commandIndex}:${s.id}:${s.cause}`)))
  console.log('  model rings:', r.model?.wallRings.map((x) => x.id).join(','), ' walls', r.model?.walls.length, ' slabs', r.model?.slabs.map((s) => s.id).join(','))
}
done()
