/** Council D: the EDGE_MOVED that narrows the ring, seen on the first attempt, and whether the final PreviewFit carries it. */
import { emitBuilding } from '../../../packages/reconstruction/src/v2/emit.js'
import { reconcileWallOverlaps, fitPreviewProgram } from '../../../packages/reconstruction/src/candidate.js'
import { building, mass, check, done } from './lib.js'
const b = building([mass('main', 'MAIN', 0, 0, 10, 8), mass('attached-0', 'ATTACHED', 3, 8, 7, 11), mass('attached-1', 'ATTACHED', 9.95, 1, 10.57, 7)])
const prog = emitBuilding(b, 'x').program
const rec = reconcileWallOverlaps(prog, 'x', 'm', { toleranceM: 0.06 })
console.log(JSON.stringify({ ok: rec.ok, failedAt: rec.failedAt, records: rec.records.map((r) => ({ wall: r.wallId, other: r.otherWallId, action: r.action, moveM: r.moveM })), err: rec.ok ? undefined : rec.errors.map((e) => e.message.slice(0, 100)), refusal: rec.ok ? undefined : rec.refusal?.action }))
check('first attempt: EDGE_MOVED on ring-attached-1-0-w3 then refused on its own w1/w3', !rec.ok && rec.records[0]?.action === 'EDGE_MOVED' && /ring-attached-1-0-w1 and ring-attached-1-0-w3/.test(rec.ok ? '' : rec.errors[0].message))
const pf = fitPreviewProgram(prog, { label: 'x', modelId: 'm', mainMassId: 'main', toleranceM: 0.06 })
check('the final PreviewFit.reconciled no longer carries the EDGE_MOVED that caused the failure', !(pf.reconciled?.records ?? []).some((r) => r.action === 'EDGE_MOVED'), JSON.stringify(pf.reconciled?.records ?? null))
// the failure message reported for the preview is from the MOVED ring, not the emitted one
const emittedRing = prog[21] as { polygon: Array<{ x: number }> }
check('emitted ring is 0.62 wide (>= 2T); the refused ring is the moved one', Math.abs(Math.max(...emittedRing.polygon.map((p) => p.x)) - Math.min(...emittedRing.polygon.map((p) => p.x)) - 0.62) < 1e-9)
check('refused command polygon (fit.command) differs from the emitted command', !rec.ok && JSON.stringify((rec.command as { polygon?: unknown }).polygon) !== JSON.stringify(emittedRing.polygon), JSON.stringify(!rec.ok && (rec.command as { polygon?: unknown }).polygon))
done()
