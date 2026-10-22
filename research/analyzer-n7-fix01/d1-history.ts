/** N7-FIX-01 research: Council D-1 — the first attempt's EDGE_MOVED is now kept in PreviewFit.reconciliationHistory. */
import { emitBuilding } from '../../packages/reconstruction/src/v2/emit.js'
import { fitPreviewProgram } from '../../packages/reconstruction/src/candidate.js'
import { ringCollisions } from '../../packages/reconstruction/src/v2/ring-collision.js'
import { building, mass } from '../analyzer-n7-council/D/lib.js'
const masses = [mass('main', 'MAIN', 0, 0, 10, 8), mass('attached-0', 'ATTACHED', 3, 8, 7, 11), mass('attached-1', 'ATTACHED', 9.95, 1, 10.57, 7)]
const b = building(masses)
const prog = emitBuilding(b, 'x').program
const pf = fitPreviewProgram(prog, { label: 'x', modelId: 'm', mainMassId: 'main', toleranceM: 0.06 })
console.log('failures', pf.failures.map((f) => `${f.commandIndex} ${f.type} ${f.id} ${f.codes}`))
console.log('history', pf.reconciliationHistory.map((h) => `attempt ${h.attempt}: ${h.record.action} ${h.record.wallId} ${h.record.moveM} m (input ${h.record.commandIndex})`))
const rc = ringCollisions({ failures: pf.failures, skipped: pf.skipped, history: pf.reconciliationHistory, masses: b.masses, thin: [], houseWallThicknessM: b.wallThicknessM })
console.log(JSON.stringify(rc.map((c) => ({ ringId: c.ringId, widthM: c.widthM, selected: c.selectedByThinBodies, notSelectedBecause: c.notSelectedBecause, reconciliation: c.reconciliation, removed: c.removedByPartialPreview, why: c.why })), null, 1))
