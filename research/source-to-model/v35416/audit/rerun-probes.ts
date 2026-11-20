/**
 * v3.54.16 audit (20.11.2026) — the audit's five probes, with the audit's own inputs, run against the REAL fixed modules
 * (not functions sliced out of the files), printed beside the audit's recorded results. No model, no network, 0 USD.
 *   npx vite-node research/source-to-model/v35416/audit/rerun-probes.ts -- <audit probe-results.json> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'
import { qualityOf, settleDefects } from '../../../../packages/analysis-service/src/consult/correct/quality.js'
import type { DefectEntry } from '../../../../packages/analysis-service/src/consult/correct/quality.js'
import { compareHypotheses } from '../../../../packages/analysis-service/src/consult/correct/source-gate.js'
import { executeCorrections, modelRevision } from '../../../../packages/analysis-service/src/consult/correct/execute.js'
import { proposalsFromSketch } from '../../../../packages/analysis-service/src/consult/correct/from-sketch.js'
import type { ElevationSketch } from '../../../../packages/analysis-service/src/appearance/elevation-sketch.js'

const [before, outPath] = process.argv.slice(2).filter((a) => a !== '--')
const old: DefectEntry = { id: 'L1:roof', key: 'L1:roof', look: 1, about: 'missing gable roof', scope: 'ROOF', severity: 'KEY', certainty: 'CERTAIN', operation: 'UNSUPPORTED', family: 'ROOF_FORM', settlement: 'UNSUPPORTED_OPERATION', why: 'not repaired' }
const vanished = qualityOf({ looked: true, checkedRevision: 'same-revision', deliveredRevision: 'same-revision', lastStatus: 'VERIFIED_IN_SCOPE', defects: [], allDefects: [old], measuredContradictions: 0, pendingAtLimit: 0, attemptedForKey: 0, committedForKey: 0 })
const d = { id: 'finish', about: 'wrong finish', scope: 'FRONT' as const, severity: 'MAJOR' as const, certainty: 'CERTAIN' as const, operation: 'SET_FINISH' as const }
const nullEvidence = settleDefects(1, [d], [{ proposalId: 'p', defectId: 'finish' }], [{ proposalId: 'p', operation: 'SET_FINISH', targetId: 'FRONT', origin: 'REVIEW', status: 'COMMITTED', why: '', bound: { frameId: 'f', ids: ['wall'] }, measure: { sourceVerified: null, why: '' } }], new Map([['wall', 'MATCHES']]), 'new-rev', false)
const raster = { width: 300, height: 100, data: new Uint8ClampedArray(300 * 100 * 4).fill(255) }
for (let y = 30; y <= 70; y += 1) for (let x = 100; x <= 130; x += 1) for (let k = 0; k < 3; k += 1) raster.data[(y * 300 + x) * 4 + k] = 30
const box = { x0: 100, y0: 30, x1: 130, y1: 70 }
const sameBox = compareHypotheses(raster, box, box, { x0: 0, x1: 299, y0: 0, y1: 99 }, [], 0)
// the same two hypotheses where only the head differs (the case the audit names: one bbox, another head)
const rakedBox = compareHypotheses(raster, { ...box, headLeftY: 30, headRightY: 45 }, box, { x0: 0, x1: 299, y0: 0, y1: 99 }, [], 0)
// a real model (the audit's stub had no geometry): one storey, one wall ring; the audit's witness and proposal
const m = applyCommands(createEmptyModel('m', 'probe'), [
  { type: 'createBuilding', id: 'b', name: 'probe' },
  { type: 'createLevel', id: 'l0', name: 'Ground', index: 0, elevation: 0, height: 3 },
  { type: 'createWallRing', id: 'g', levelId: 'l0', polygon: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }], thickness: 0.3, height: 3, baseOffset: 0, kind: 'EXTERIOR', cornerOwnership: 'ALTERNATE' },
] as BuildingCommand[]).model
const wrongWitness = executeCorrections({ model: m, views: [], pictures: [], proposals: [{ proposalId: 'p', baseRevision: modelRevision(m), operation: 'SET_PARAMETER', targetId: 'g-w0', patch: { property: 'WALL_HEIGHT', value: 5.5, unit: 'm', literal: '+5.50', sourcePicture: 7 }, origin: 'CONTROL', uncertainty: 'LOW' }], witnesses: [{ valueM: 5.5, unit: 'm', frameId: 'garage-section', by: 'METRIC_READ', literal: '+5.50' }] })
const sketch = { sketchId: 's', frameId: 'frame-front', openings: [{ id: 'raked', kind: 'WINDOW', polygon: [[10, 10], [30, 30], [30, 60], [10, 60]] }], elements: [], walls: [], roofs: [] } as unknown as ElevationSketch
const proposal = proposalsFromSketch(sketch, 'FRONT', m, [{ side: 'FRONT', frameId: 'frame-front', projection: { mpp: 0.02, alongAtPx0: 0, alongSign: 1, zeroRow: 100 }, heights: true, origin: 'ANALYZER', alongErrorM: 0.03, heightErrorM: 0.05 }], 'revision')
const after = {
  vanishedDefect: { state: vanished.state, openKey: vanished.openKey, current: vanished.defects.map((x) => ({ id: x.id, settlement: x.settlement })) },
  nullEvidenceClosure: nullEvidence.map((x) => ({ id: x.id, settlement: x.settlement, why: x.why })),
  sameBoxTypeOrRakeOnly: { identicalShapes: { winner: sameBox.winner, measure: sameBox.measure }, sameBoxOtherHead: { winner: rakedBox.winner, measure: rakedBox.measure, proposedZ: rakedBox.proposed.z, currentZ: rakedBox.current?.z ?? null } },
  unrelatedWitness: wrongWitness.records.map((r) => ({ status: r.status, code: r.code, why: r.why })),
  rakedSketchProposal: proposal.proposals.map((p) => p.patch),
}
const out = { schema: 'v35416-audit-probes-rerun', auditRecorded: JSON.parse(readFileSync(before, 'utf8')), afterFix: after }
writeFileSync(outPath, `${JSON.stringify(out, null, 1)}\n`)
console.log(JSON.stringify(after, null, 1))
