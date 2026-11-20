/**
 * v3.54.16 (from v3.54.15) — two auditor errors the Council reproduced are removed: acceptance is read through the
 * producers' shared list (`isConsultedAccepted`: a reading is APPLIED, a span ADMITTED — an admitted span was reported
 * REFUSED before), and an effect is bound to the parameter a fact governs (a length governs the plan scale) — a roof
 * pitch that moved for another reason no longer makes every applied length CHANGED. Several accepted lengths that moved
 * the scale together are CHANGED_JOINTLY (which one did it is an ablation's question); a change no row can be bound to
 * is UNKNOWN_EFFECT. The correction executor's patches are rows of their own (PATCH).
 *
 * v3.54.15 §6 — one row per fact the API handed the analyzer: literal → value → witnesses → the model parameter before
 * and after → the element ids it reached → what the scene measures. A fact the analyzer admitted and nothing consumed
 * is NOT_CONSUMED, and NOT_CONSUMED is not a closure: it is counted apart from what reached geometry.
 *
 * Closures:
 *  - CHANGED       the parameter it governs moved to its value (or the elements it reached changed)
 *  - CONFIRMED     the parameter already held its value; the fact is a witness, not a change
 *  - NOT_CONSUMED  admitted, but no parameter of the model carries it
 *  - REFUSED       not admitted (its reason kept)
 *  - NO_EFFECT     applied by the metric layer, and nothing in the model changed (the scale held)
 */
type Measure = { outlineX?: number; outlineZ?: number; ridge?: number; eaves?: number; openings?: number; walls?: number; levels?: Array<{ id: string; elevation: number; height: number }> }
type Model = Record<string, unknown>
export type FactRow = {
  class: 'LEVEL' | 'ANGLE' | 'LENGTH' | 'SPAN' | 'SKETCH_FORM' | 'SKETCH_FINISH' | 'PATCH'
  id: string
  literal: string
  value: number | string | null
  witnesses: string
  status: string
  param: string | null
  before: number | string | null
  after: number | string | null
  elementIds: string[]
  closure: 'CHANGED' | 'CHANGED_JOINTLY' | 'CONFIRMED' | 'NOT_CONSUMED' | 'REFUSED' | 'NO_EFFECT' | 'UNKNOWN_EFFECT'
  why: string
}

const near = (a: number | undefined, b: number, tol: number): boolean => a !== undefined && Math.abs(a - b) <= tol
const ids = (m: Model | undefined, k: string): Map<string, string> => new Map(((m?.[k] as Array<{ id: string }> | undefined) ?? []).map((x) => [x.id, JSON.stringify(x)]))

/** The elements that differ between LOCAL's model and the delivered one, by collection. */
export function changedElements(local: Model | undefined, final: Model | undefined, collections: readonly string[]): string[] {
  const out: string[] = []
  for (const k of collections) {
    const a = ids(local, k)
    const b = ids(final, k)
    for (const [id, v] of b) if (a.get(id) !== v) out.push(id)
    for (const id of a.keys()) if (!b.has(id)) out.push(`-${id}`)
  }
  return out.sort()
}

import { isConsultedAccepted } from '../../../packages/source-metrics/src/consulted-spans.js'

export function factTrace(input: { metricRead?: any; sketches?: any; localModel?: Model; finalModel?: Model; correctionRuns?: any[] }): { rows: FactRow[]; counts: Record<string, number> } {
  const rows: FactRow[] = []
  const mr = input.metricRead
  const before: Measure = mr?.measured?.before ?? {}
  const after: Measure = mr?.measured?.after ?? {}
  const final = input.finalModel
  const roofs = ((final?.roofs as Array<{ id: string; pitchDeg?: number; evidence?: { interpretation?: string } }> | undefined) ?? [])
  const levels = after.levels ?? []
  for (const l of mr?.applied?.levels ?? []) {
    const literalValue = ((): number | null => {
      const t = String(l.literal ?? '').replace(/\s/g, '').replace('−', '-').replace('±', '')
      return /^[+-]?[0-9]+([.,][0-9]+)?$/.test(t) ? Number(t.replace(',', '.')) : null
    })()
    // the same printed label LOCAL already read and the drawing admitted: one value per label — a witness of it
    const heldByLocal = l.status === 'REFUSED' && /the same printed label/.test(String(l.why)) && literalValue !== null
    const v = typeof l.valueM === 'number' ? l.valueM : heldByLocal ? literalValue : null
    if ((l.status !== 'ADMITTED' && !heldByLocal) || v === null) {
      rows.push({ class: 'LEVEL', id: l.proposalId, literal: l.literal, value: v, witnesses: l.why, status: l.status, param: null, before: null, after: null, elementIds: [], closure: 'REFUSED', why: l.why })
      continue
    }
    // which parameter of the model carries this height: the ridge, the eaves, a floor datum, a storey's top
    const lv = levels.find((x) => near(x.elevation, v, 0.02))
    const top = levels.find((x) => near(x.elevation + x.height, v, 0.02))
    const target = near(after.ridge, v, 0.02) ? { param: 'ridge', b: before.ridge, a: after.ridge, el: roofs.map((r) => r.id) } : near(after.eaves, v, 0.02) ? { param: 'eaves', b: before.eaves, a: after.eaves, el: roofs.map((r) => r.id) } : lv ? { param: `level ${lv.id} elevation`, b: before.levels?.find((x) => x.id === lv.id)?.elevation, a: lv.elevation, el: [lv.id] } : top ? { param: `level ${top.id} top`, b: (() => { const x = before.levels?.find((y) => y.id === top.id); return x ? x.elevation + x.height : undefined })(), a: top.elevation + top.height, el: [top.id] } : undefined
    if (!target) {
      rows.push({ class: 'LEVEL', id: l.proposalId, literal: l.literal, value: v, witnesses: l.why, status: l.status, param: null, before: null, after: null, elementIds: [], closure: 'NOT_CONSUMED', why: v < 0 ? 'a level below ±0,00 (the terrain): the registration of the views uses it, no element of the model carries it' : 'admitted, and no parameter of the model carries this height' })
      continue
    }
    const changed = !heldByLocal && (target.b === undefined || !near(target.b, v, 0.02))
    rows.push({ class: 'LEVEL', id: l.proposalId, literal: l.literal, value: v, witnesses: l.why, status: l.status, param: target.param, before: target.b ?? null, after: target.a ?? null, elementIds: target.el, closure: changed ? 'CHANGED' : 'CONFIRMED', why: changed ? `${target.param} ${target.b ?? 'absent (no model)'} → ${target.a}` : `${target.param} already ${target.b}` })
  }
  // the API's roof angles: a witness of the pitch the roof carries, or not carried
  for (const r of mr?.reads ?? []) for (const o of r.observations ?? []) {
    if (o.kind !== 'ANGLE' || typeof o.value !== 'number') continue
    const carrying = roofs.filter((x) => near(x.pitchDeg, o.value, 0.5))
    rows.push({ class: 'ANGLE', id: o.id, literal: o.literal, value: o.value, witnesses: carrying.map((x) => `${x.id}: ${x.evidence?.interpretation ?? ''}`).join('; ') || 'none', status: 'READ', param: carrying.length > 0 ? 'roof pitch' : null, before: null, after: carrying[0]?.pitchDeg ?? null, elementIds: carrying.map((x) => x.id), closure: carrying.length > 0 ? 'CONFIRMED' : 'NOT_CONSUMED', why: carrying.length > 0 ? 'the roof carries this pitch on its own authority (printed or published); the API angle witnesses it — it does not, alone, confirm a height' : 'no roof carries this pitch: the angle reached no geometry' })
  }
  // a length (or span) governs the plan scale: its effect is the outline moving, and the elements that hang on the scale
  const scaleDependents = changedElements(input.localModel, final, ['walls', 'wallRings', 'slabs', 'openings'])
  const scaleMoved = before.outlineX !== undefined && (!near(before.outlineX, after.outlineX ?? NaN, 0.005) || !near(before.outlineZ, after.outlineZ ?? NaN, 0.005))
  const accepted = [...(mr?.applied?.readings ?? []), ...(mr?.applied?.spans ?? [])].filter((a: { status?: string }) => isConsultedAccepted(a.status)).length
  const scaleClosure = (): FactRow['closure'] => (before.outlineX === undefined ? 'UNKNOWN_EFFECT' : !scaleMoved ? 'NO_EFFECT' : accepted > 1 ? 'CHANGED_JOINTLY' : 'CHANGED')
  for (const a of mr?.applied?.readings ?? []) {
    const d = (mr?.resolution?.decisions ?? []).find((x: { observationId?: string }) => a.proposalId?.endsWith(x.observationId ?? '\u0000'))
    const refused = !isConsultedAccepted(a.status)
    const closure = refused ? 'REFUSED' : scaleClosure()
    rows.push({ class: 'LENGTH', id: a.proposalId, literal: String(a.valueCm ?? ''), value: typeof a.valueCm === 'number' ? a.valueCm / 100 : null, witnesses: d ? `${d.witness ?? d.decision}: ${d.why}` : a.why, status: a.status, param: refused ? null : 'the plan scale (outline)', before: before.outlineX !== undefined ? `${before.outlineX} × ${before.outlineZ}` : null, after: after.outlineX !== undefined ? `${after.outlineX} × ${after.outlineZ}` : null, elementIds: closure === 'CHANGED' || closure === 'CHANGED_JOINTLY' ? scaleDependents.slice(0, 40) : [], closure, why: a.why })
  }
  for (const sp of mr?.applied?.spans ?? []) {
    const ok = isConsultedAccepted(sp.status)
    const closure = ok ? scaleClosure() : 'REFUSED'
    rows.push({ class: 'SPAN', id: sp.proposalId, literal: typeof sp.valueCm === 'number' ? String(sp.valueCm) : '', value: typeof sp.valueCm === 'number' ? sp.valueCm / 100 : null, witnesses: sp.why, status: sp.status, param: ok ? 'the plan scale (outline)' : null, before: before.outlineX !== undefined ? `${before.outlineX} × ${before.outlineZ}` : null, after: after.outlineX !== undefined ? `${after.outlineX} × ${after.outlineZ}` : null, elementIds: closure === 'CHANGED' || closure === 'CHANGED_JOINTLY' ? scaleDependents.slice(0, 40) : [], closure, why: sp.why })
  }
  // the correction executor's patches: each its own row, its effect the ids its transaction changed (measured there)
  for (const run of input.correctionRuns ?? []) for (const r of run.records ?? []) {
    const tx = (run.transactions ?? []).find((t: { txId: string }) => t.txId === r.txId)
    rows.push({ class: 'PATCH', id: `${run.stage}:${r.proposalId}`, literal: `${r.operation} ${r.targetId}`, value: r.bound?.values ? JSON.stringify(r.bound.values) : null, witnesses: r.gate ? `${r.gate.winner}: ${r.gate.why}` : r.why, status: r.status, param: r.operation, before: run.baseRevision, after: r.status === 'COMMITTED' ? (tx?.revisionAfter ?? run.revision) : null, elementIds: r.status === 'COMMITTED' ? (tx?.changed ?? r.bound?.ids ?? []) : [], closure: r.status === 'COMMITTED' ? 'CHANGED' : 'REFUSED', why: r.status === 'COMMITTED' ? (r.measure?.why ?? r.why) : `${r.status}${r.code ? ` ${r.code}` : ''}: ${r.why}` })
  }
  // the sketches: form (openings, walls, outline) and finish (surface regions), per facade
  const sk = input.sketches
  const regions = ((final?.surfaceRegions as Array<{ id: string }> | undefined) ?? []).map((x) => x.id)
  for (const x of sk?.reading?.sketches ?? []) {
    const facade = String(x.facade)
    const own = regions.filter((id) => id.startsWith(`appearance-${facade.toLowerCase()}-`))
    const verdict = x.check?.verdict ?? (x.failed ? 'FAILED' : 'NONE')
    const finishOk = x.check?.properties?.finish === 'ACCEPTED' || x.check?.finish === 'ACCEPTED' || own.length > 0
    rows.push({ class: 'SKETCH_FINISH', id: `sketch-${facade}`, literal: facade, value: verdict, witnesses: x.check?.why ?? x.failed ?? '', status: verdict, param: 'finish zones', before: null, after: own.length, elementIds: own, closure: own.length > 0 ? 'CHANGED' : finishOk ? 'NOT_CONSUMED' : 'REFUSED', why: own.length > 0 ? `${own.length} surface region(s) from this sketch` : finishOk ? 'accepted, and no region of it reached the model' : `the sketch's finish was not accepted (${verdict})` })
  }
  if (sk?.form) {
    const mb = sk.form.measuredBefore ?? {}
    const ma = sk.form.measuredAfter ?? {}
    const same = JSON.stringify(mb) === JSON.stringify(ma)
    rows.push({ class: 'SKETCH_FORM', id: 'sketch-form', literal: 'form', value: sk.form.decision, witnesses: sk.form.why ?? '', status: sk.form.decision, param: 'outline, storeys, walls, openings', before: JSON.stringify(mb), after: JSON.stringify(ma), elementIds: [], closure: sk.form.decision === 'ACCEPT' && !same ? 'CHANGED' : sk.form.decision === 'ACCEPT' ? 'CONFIRMED' : 'REFUSED', why: sk.form.why ?? '' })
  }
  const counts: Record<string, number> = {}
  for (const r of rows) counts[`${r.class}:${r.closure}`] = (counts[`${r.class}:${r.closure}`] ?? 0) + 1
  return { rows, counts }
}
