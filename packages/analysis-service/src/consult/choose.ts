/**
 * v3.54.14 R2 — the delivered model, chosen per property, never by "the API is better":
 *   - geometry (walls, openings, roofs, rooms, ids): the form candidate's when the sketch step ACCEPTED it, else the
 *     metric step's model (L-M's when its candidate stood, else LOCAL's);
 *   - a wall's own material changed by the form candidate only where that wall faces a side whose sketch passed the
 *     proportion check: a side with no accepted sketch saw nothing that could confirm a new tone (Bakopy's garage front:
 *     the rejected front sketch left the garage wall's tone to the other sides' pictures — kept as before);
 *   - finish regions: the sketch step's (they are bound to the accepted sides by construction).
 * Pure: the same three models and the same accepted sides give the same delivered model.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import { usableGeometryFingerprint } from '../appearance/consumer.js'
import type { Facade } from '../appearance/visibility.js'

export const CHOOSE_VERSION = '1.0.0' as const

const sideOf = (w: { start: { x: number; z: number }; end: { x: number; z: number } }): Facade => {
  const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) || 1
  const nx = (w.end.z - w.start.z) / L
  const nz = -(w.end.x - w.start.x) / L
  return Math.abs(nz) >= Math.abs(nx) ? (nz < 0 ? 'FRONT' : 'REAR') : nx > 0 ? 'EAST' : 'WEST'
}

export type ChoiceRecord = { version: string; geometryFrom: 'FORM' | 'METRIC'; kept: Array<{ wallId: string; side: Facade; candidate: string; kept: string }>; why: string }

export function chooseDelivered(input: { metricModel: CanonicalBuildingModel; formModel?: CanonicalBuildingModel; formAccepted: boolean; acceptedSides: readonly Facade[] }): { model: CanonicalBuildingModel; record: ChoiceRecord } {
  if (!input.formModel || !input.formAccepted) return { model: input.metricModel, record: { version: CHOOSE_VERSION, geometryFrom: 'METRIC', kept: [], why: 'no form candidate stood: the metric step\'s model is delivered' } }
  const model = structuredClone(input.formModel) as CanonicalBuildingModel
  const before = new Map(input.metricModel.walls.map((w) => [w.id, w]))
  const kept: ChoiceRecord['kept'] = []
  for (const w of model.walls) {
    const b = before.get(w.id)
    if (!b || (b.materialId ?? '') === (w.materialId ?? '')) continue
    const side = sideOf(w)
    if (input.acceptedSides.includes(side)) continue
    kept.push({ wallId: w.id, side, candidate: w.materialId ?? '-', kept: b.materialId ?? '-' })
    if (b.materialId) w.materialId = b.materialId
    else delete (w as { materialId?: string }).materialId
  }
  const need = new Set(model.walls.map((w) => w.materialId).filter((x): x is string => Boolean(x)))
  for (const id of need) if (!model.materials.some((m) => m.id === id)) {
    const m = input.metricModel.materials.find((x) => x.id === id)
    if (m) model.materials.push(m)
  }
  model.materials.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const toneless = (m: CanonicalBuildingModel): string => usableGeometryFingerprint({ ...m, walls: m.walls.map(({ materialId: _t, ...w }) => w) } as CanonicalBuildingModel)
  if (toneless(model) !== toneless(input.formModel)) throw new Error('chooseDelivered changed the form candidate\'s geometry: refused')
  return { model, record: { version: CHOOSE_VERSION, geometryFrom: 'FORM', kept, why: `the form candidate's geometry and finishes; ${kept.length} wall tone(s) on sides with no accepted sketch kept as before` } }
}
