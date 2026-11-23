/**
 * v3.54.18 — the fate of every fact a reading states (`buildapp.observation-fate` 1.0.0).
 *
 * "The API described it" is not "the model holds it". Every element of every elevation reading (opening, roof surface,
 * wall finish zone, other element) gets ONE row: what it is, where it was read (frame pixels of the original picture, x to
 * the right, y down — the reading's own coordinate system, never metres), who read it, which model side it was bound to
 * and on what basis, and what became of it — built and source-verified, built on a cross-view witness, built with an
 * adopted facade (not verified), already standing in the model, refused by the source, left undecided, without a
 * consumer, or not placed because its picture is registered to no side. Nothing a reading states disappears silently.
 */
import type { ElevationSketch } from '../../appearance/elevation-sketch.js'
import type { PatchRecord } from './execute.js'

export const OBSERVATION_FATE_SCHEMA = 'buildapp.observation-fate' as const
export const OBSERVATION_FATE_VERSION = '1.0.0' as const

export type FateKind = 'BUILT' | 'AGREES_WITH_MODEL' | 'REFUSED_BY_SOURCE' | 'UNDECIDED' | 'NOT_BUILT' | 'NO_CONSUMER' | 'NOT_REGISTERED' | 'NOT_PROPOSED'
export type FateVerification = 'SOURCE_VERIFIED' | 'CROSS_WITNESS_PLAN' | 'ADOPTED_WITH_FACADE' | 'TWO_READERS_AGREE' | 'NOT_VERIFIED' | 'NONE'
export type ObservationFate = {
  id: string
  frameId: string
  sourceImageSha256: string
  part: 'opening' | 'roof' | 'wall' | 'element'
  kind: string
  coordinateSystem: 'FRAME_PIXELS_X_RIGHT_Y_DOWN'
  unit: 'px'
  box: { x0: number; y0: number; x1: number; y1: number }
  producer: { kind: string; model: string; promptVersion: string }
  uncertainty: 'MEDIUM'
  side: string | null
  sideBasis: string
  fate: FateKind
  verification: FateVerification
  operation?: string
  proposalId?: string
  targetIds?: string[]
  code?: string
  why: string
}
export type ObservationFates = { schema: typeof OBSERVATION_FATE_SCHEMA; version: typeof OBSERVATION_FATE_VERSION; rows: ObservationFate[]; summary: Record<FateKind, number> }

const bbox = (poly: ReadonlyArray<readonly [number, number]>): ObservationFate['box'] => ({ x0: Math.min(...poly.map((p) => p[0])), y0: Math.min(...poly.map((p) => p[1])), x1: Math.max(...poly.map((p) => p[0])), y1: Math.max(...poly.map((p) => p[1])) })
const base = (id: string): string => id.replace(/@\w+$/, '')

export type FateInput = {
  sketches: ReadonlyArray<{ facade: string; frameId: string; sketch?: ElevationSketch }>
  records: readonly PatchRecord[]
  accounts: ReadonlyArray<{ frameId: string; side?: string; agreedIds?: Array<{ sketchId: string; modelId: string }>; skipped: Array<{ sketchId: string; why: string }> }>
  sideBasis: (frameId: string) => string
  finishSkipped?: ReadonlyArray<{ sketchId: string; why: string }>
}

export function observationFates(input: FateInput): ObservationFates {
  const rows: ObservationFate[] = []
  const last = new Map<string, PatchRecord>()
  for (const r of input.records) last.set(base(r.proposalId), r)
  const fateOf = (r: PatchRecord | undefined): Pick<ObservationFate, 'fate' | 'verification' | 'operation' | 'proposalId' | 'targetIds' | 'code' | 'why'> | undefined => {
    if (!r) return undefined
    const common = { operation: r.operation, proposalId: r.proposalId, ...(r.bound?.ids?.length ? { targetIds: r.bound.ids } : {}), ...(r.code ? { code: r.code } : {}) }
    if (r.status === 'COMMITTED') {
      const g = r.gate as { adopted?: boolean; crossWitness?: string } | undefined
      const verification: FateVerification = g?.adopted ? 'ADOPTED_WITH_FACADE' : g?.crossWitness ? 'CROSS_WITNESS_PLAN' : r.measure?.sourceVerified === true ? 'SOURCE_VERIFIED' : 'NOT_VERIFIED'
      return { ...common, fate: 'BUILT', verification, why: `${r.gate?.why ?? r.why}${r.measure?.why ? ` — ${r.measure.why}` : ''}`.slice(0, 500) }
    }
    if (r.status === 'REJECTED_BY_SOURCE') return { ...common, fate: 'REFUSED_BY_SOURCE', verification: 'NONE', why: r.why.slice(0, 500) }
    if (r.status === 'NEEDS_EVIDENCE') return { ...common, fate: 'UNDECIDED', verification: 'NONE', why: r.why.slice(0, 500) }
    if (r.status === 'NO_EFFECT' || r.status === 'DUPLICATE') return { ...common, fate: 'AGREES_WITH_MODEL', verification: 'NONE', why: r.why.slice(0, 500) }
    return { ...common, fate: 'NOT_BUILT', verification: 'NONE', why: `${r.status}: ${r.why}`.slice(0, 500) }
  }
  for (const s of input.sketches) {
    const sk = s.sketch
    if (!sk) continue
    const tail = s.frameId.slice(-10)
    const acc = input.accounts.find((a) => a.frameId === s.frameId)
    const side = acc?.side ?? null
    const head = { frameId: s.frameId, sourceImageSha256: sk.source?.imageSha256 ?? '', coordinateSystem: 'FRAME_PIXELS_X_RIGHT_Y_DOWN' as const, unit: 'px' as const, producer: { kind: sk.producer?.kind ?? 'API_CONTOUR_READING', model: sk.producer?.model ?? '', promptVersion: sk.producer?.promptVersion ?? '' }, uncertainty: 'MEDIUM' as const, side, sideBasis: side ? input.sideBasis(s.frameId) : 'NOT_REGISTERED' }
    const unplaced = { fate: 'NOT_REGISTERED' as const, verification: 'NONE' as const, why: 'its picture is registered to no side of the model: nothing of it can be placed' }
    const skippedWhy = (id: string): string | undefined => acc?.skipped.find((k) => k.sketchId === id)?.why ?? input.finishSkipped?.find((k) => k.sketchId === id)?.why
    for (const o of sk.openings) {
      const row = { ...head, id: `${tail}:${o.id}`, part: 'opening' as const, kind: o.kind, box: bbox(o.polygon) }
      if (!side) { rows.push({ ...row, ...unplaced }); continue }
      const agreed = acc?.agreedIds?.find((a) => a.sketchId === o.id)
      const rec = last.get(`sk:${tail}:upd:${o.id}`) ?? last.get(`sk:${tail}:add:${o.id}`) ?? last.get(`sk:${tail}:roofwin:${o.id}`)
      const f = fateOf(rec)
      if (f && (f.fate === 'BUILT' || !agreed)) rows.push({ ...row, ...f })
      else if (agreed) rows.push({ ...row, fate: 'AGREES_WITH_MODEL', verification: rec?.status === 'COMMITTED' ? 'SOURCE_VERIFIED' : 'TWO_READERS_AGREE', targetIds: [agreed.modelId], why: `the model's ${agreed.modelId} stands as the reading draws it (the analyzer's own reading and this one agree)` })
      else rows.push({ ...row, fate: skippedWhy(o.id) ? 'NO_CONSUMER' : 'NOT_PROPOSED', verification: 'NONE', why: skippedWhy(o.id) ?? 'no proposal was made of it' })
    }
    for (const e of sk.elements) {
      const row = { ...head, id: `${tail}:${e.id}`, part: 'element' as const, kind: e.kind, box: bbox(e.polygon) }
      if (!side) { rows.push({ ...row, ...unplaced }); continue }
      const f = fateOf(last.get(`sk:${tail}:chimney:${e.id}`))
      if (f) rows.push({ ...row, ...f })
      else rows.push({ ...row, fate: 'NO_CONSUMER', verification: 'NONE', why: skippedWhy(e.id) ?? (e.kind === 'GUTTER_DOWNPIPE' ? 'a gutter or downpipe: not modelled in the miniature (named convention)' : `${e.kind}: no operation of the registry builds it`) })
    }
    for (const w of sk.walls) {
      const row = { ...head, id: `${tail}:${w.id}`, part: 'wall' as const, kind: w.class, box: bbox(w.polygon) }
      if (!side) { rows.push({ ...row, ...unplaced }); continue }
      const f = fateOf(last.get(`sk:${tail}:finish:${w.id}`))
      if (f) rows.push({ ...row, ...f })
      else rows.push({ ...row, fate: 'NOT_PROPOSED', verification: 'NONE', why: skippedWhy(w.id) ?? skippedWhy(sk.sketchId) ?? 'its zone went through the analyzer\'s own finish consumer with the accepted sketch (or the side already carried regions)' })
    }
    for (const r of sk.roofs) {
      const row = { ...head, id: `${tail}:${r.id}`, part: 'roof' as const, kind: 'ROOF_SURFACE', box: bbox(r.polygon) }
      if (!side) { rows.push({ ...row, ...unplaced }); continue }
      const recs = input.records.filter((q) => (q.operation === 'SET_ROOF' && q.proposalId.replace(/^arb:/, '').endsWith(tail)) || (q.operation === 'SET_ROOF_OVERHANG' && q.proposalId.startsWith(`sk:${tail}:overhang:`)))
      const best = recs.find((q) => q.status === 'COMMITTED') ?? recs[recs.length - 1]
      const f = fateOf(best)
      if (f) rows.push({ ...row, ...f })
      else rows.push({ ...row, fate: 'AGREES_WITH_MODEL', verification: 'NONE', why: 'no roof proposal came of this view: the drawn roof agrees with the model\'s over the bodies it shows, or another view of the body was the clearer one' })
    }
  }
  const summary = { BUILT: 0, AGREES_WITH_MODEL: 0, REFUSED_BY_SOURCE: 0, UNDECIDED: 0, NOT_BUILT: 0, NO_CONSUMER: 0, NOT_REGISTERED: 0, NOT_PROPOSED: 0 } as Record<FateKind, number>
  for (const r of rows) summary[r.fate] += 1
  return { schema: OBSERVATION_FATE_SCHEMA, version: OBSERVATION_FATE_VERSION, rows, summary }
}
