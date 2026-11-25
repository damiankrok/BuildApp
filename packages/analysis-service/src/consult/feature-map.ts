/**
 * v3.54.21 — the house's characteristic features as the SOURCES state them, fixed before any model is judged, and what
 * became of each one on its road to the delivered model.
 *
 * The feature map is made from the structure read alone (the publisher's original pictures, asked before a body exists):
 * the storeys, each roof region and how it meets the next, each part, each thing that is not a volume, the doors that
 * tell the sides apart, the counts on the roof. A model never adds to it — a wrong model must not become the list of
 * what a reviewer looks for. The reviewer is handed this list; the trace below follows every entry:
 *
 *   feature → source evidence → the read's statement → agreed parameter and host → operation → element → measure → result
 *
 * and names, for everything that did not arrive, WHERE it was lost:
 *   NO_READ            the sources were not read, or the read was refused / did not state it;
 *   DISPUTED_BY_WITNESS an independent witness contradicted it: not taken (a gate, with its name);
 *   LOST_IN_BINDING    stated and taken, but no element could be found for it to be a property of;
 *   NO_CONSUMER        stated, and nothing in the builder or the registry can build it (a missing function);
 *   CONFLICT_WITH_DRAWING taken, and the registered drawing gave another value: the drawing stands, both kept;
 *   BUILD_ERROR        bound and commanded, and the delivered model does not show it;
 *   NO_EVIDENCE        nothing in the model can be measured against it (no measure exists);
 *   NOT_ASKED          the pipeline never proposed it (no proposal).
 * Nothing here estimates and nothing here repairs: it is the record a developer reads to find the general fault.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { AgreedStructure, BuildStructure, Standing, StructureSide } from './structure.js'
import type { StructureReadback } from './readback.js'

export const FEATURE_MAP_VERSION = '1.0.2' as const

export type FeatureKind = 'STOREYS' | 'MAIN_ROOF_KIND' | 'MAIN_RIDGE' | 'MAIN_PITCH' | 'MAIN_EAVES_HEIGHT' | 'MAIN_RIDGE_HEIGHT' | 'PART' | 'ROOF_REGION' | 'ROOF_JOIN' | 'CROSS_ROOF' | 'NOT_VOLUME' | 'ENTRANCE_DOOR' | 'GARAGE_DOOR' | 'DORMERS' | 'CHIMNEYS' | 'ROOF_WINDOWS'
export type SourceFeature = {
  id: string
  kind: FeatureKind
  /** the side of the house it is on, where it has one */
  where?: StructureSide
  /** what the sources state, in the read's own terms */
  stated: string
  /** how the read knows it (a number's status), where it says */
  status?: string
  evidence: { by: 'STRUCTURE_READ'; promptVersion: string; frames: string[] }
  /** how much the house's look depends on it: KEY (the body and its roofs), MAJOR, MINOR */
  weight: 'KEY' | 'MAJOR' | 'MINOR'
}
export type TraceResult = 'BUILT_AS_STATED' | 'BUILT_DIFFERENT' | 'NOT_BUILT' | 'NOT_CHECKED'
export type TraceCause = 'NO_READ' | 'DISPUTED_BY_WITNESS' | 'LOST_IN_BINDING' | 'NO_CONSUMER' | 'CONFLICT_WITH_DRAWING' | 'BUILD_ERROR' | 'NO_EVIDENCE' | 'NOT_ASKED'
export type FeatureTrace = {
  feature: SourceFeature
  agreed?: { standing: Standing; why: string }
  /** the element the statement became a property of, and through what */
  bound?: { host: string; parameter?: string; operation: string }
  elements?: string[]
  measure?: { built: string; residual?: number }
  result: TraceResult
  cause?: TraceCause
  why: string
}
export type FeatureTraceReport = { version: string; features: number; byResult: Record<TraceResult, number>; byCause: Partial<Record<TraceCause, number>>; rows: FeatureTrace[] }

const sideLabel = (s: string): string => s.toLowerCase()

/** The feature map of one house from its agreed structure (the read's statements with their standings). */
export function featureMapOf(a: AgreedStructure, promptVersion: string, frames: readonly string[]): SourceFeature[] {
  const ev = { by: 'STRUCTURE_READ' as const, promptVersion, frames: [...frames] }
  const out: SourceFeature[] = []
  out.push({ id: 'F-STOREYS', kind: 'STOREYS', stated: `${a.storeys.value.full === 2 ? 'two full storeys' : 'one storey'}${a.storeys.value.attic ? ' with an attic' : ''}`, evidence: ev, weight: 'KEY' })
  out.push({ id: 'F-R1-KIND', kind: 'MAIN_ROOF_KIND', stated: `the main roof is a ${a.mainRoof.value.kind}`, evidence: ev, weight: 'KEY' })
  if (a.mainRidge.value.along !== 'NONE') out.push({ id: 'F-R1-RIDGE', kind: 'MAIN_RIDGE', stated: `the main ridge runs ${a.mainRidge.value.along === 'FRONT' ? 'parallel to the front' : 'front-to-back'}`, evidence: ev, weight: 'KEY' })
  if (a.pitchDeg.value.deg !== null) out.push({ id: 'F-R1-PITCH', kind: 'MAIN_PITCH', stated: `${a.pitchDeg.value.deg}°`, status: a.pitchDeg.value.status, evidence: ev, weight: 'MAJOR' })
  if (a.eavesM.value.m !== null) out.push({ id: 'F-R1-EAVES', kind: 'MAIN_EAVES_HEIGHT', stated: `walls to ${a.eavesM.value.m} m above the floor`, status: a.eavesM.value.status, evidence: ev, weight: 'MAJOR' })
  if (a.ridgeM.value.m !== null) out.push({ id: 'F-R1-RIDGE-H', kind: 'MAIN_RIDGE_HEIGHT', stated: `ridge ${a.ridgeM.value.m} m above the floor`, status: a.ridgeM.value.status, evidence: ev, weight: 'MAJOR' })
  a.parts.forEach((p, i) => out.push({ id: `F-PART-${i + 1}`, kind: 'PART', where: p.value.where, stated: `a ${p.value.what.toLowerCase()} on the ${sideLabel(p.value.where)}: ${p.value.full === 2 ? 'two storeys' : 'one storey'}, ${p.value.roof} roof${p.value.ridgeAlong !== 'NONE' ? `, ridge ${p.value.ridgeAlong === 'FRONT' ? 'parallel to the front' : 'front-to-back'}` : ''}${p.value.lowerThanMain ? ', lower than the main volume' : ''}`, evidence: ev, weight: 'KEY' }))
  for (const r of a.roofs ?? []) {
    const nums = [r.pitchDeg.value.deg !== null ? `${r.pitchDeg.value.deg}° (${r.pitchDeg.value.status})` : '', r.eavesM.value.m !== null ? `eaves ${r.eavesM.value.m} m (${r.eavesM.value.status})` : '', r.ridgeM.value.m !== null ? `ridge ${r.ridgeM.value.m} m (${r.ridgeM.value.status})` : ''].filter(Boolean).join(', ')
    if (r.of === 'CROSS') out.push({ id: `F-${r.id}`, kind: 'CROSS_ROOF', ...(r.seenOn !== 'NONE' ? { where: r.seenOn } : {}), stated: `a second ridge on the main walls, its gable on the ${sideLabel(r.seenOn)}${r.span ? ` from ${r.span.fromShare} to ${r.span.toShare} of the width` : ''}${nums ? `: ${nums}` : ''}`, evidence: ev, weight: 'KEY' })
    else if (nums) out.push({ id: `F-${r.id}`, kind: 'ROOF_REGION', stated: `the roof of part ${r.part}: ${r.kind.value.kind}, ${nums}`, evidence: ev, weight: 'MAJOR' })
    if (r.join.value.join !== 'NONE') out.push({ id: `F-${r.id}-JOIN`, kind: 'ROOF_JOIN', stated: `${r.id} meets ${r.meets}: ${r.join.value.join}`, evidence: ev, weight: 'KEY' })
  }
  a.notVolumes.forEach((n, i) => out.push({ id: `F-NV-${i + 1}`, kind: 'NOT_VOLUME', where: n.where, stated: `a ${n.what.toLowerCase()} on the ${sideLabel(n.where)}${n.covered ? ` (${n.covered === 'MAIN_ROOF' ? 'under the main roof' : n.covered === 'OWN_ROOF' ? 'under a roof of its own' : 'open to the sky'})` : ''}`, evidence: ev, weight: n.what === 'RECESS' || n.what === 'PORCH' || n.what === 'BAY' || n.what === 'DORMER' ? 'MAJOR' : 'MINOR' }))
  const sideOf = (pick: (p: AgreedStructure['pictures'][number]) => boolean): StructureSide | undefined => { const s = a.pictures.find((p) => pick(p) && p.shows !== 'NONE')?.shows; return s && s !== 'NONE' ? s : undefined }
  const entrance = sideOf((p) => p.entranceDoor)
  const garage = sideOf((p) => p.garageDoor)
  if (entrance) out.push({ id: 'F-ENTRANCE', kind: 'ENTRANCE_DOOR', where: entrance, stated: `the main entrance door is on the ${sideLabel(entrance)}`, evidence: ev, weight: 'MAJOR' })
  if (garage) out.push({ id: 'F-GARAGE-DOOR', kind: 'GARAGE_DOOR', where: garage, stated: `a garage door is on the ${sideLabel(garage)}`, evidence: ev, weight: 'MAJOR' })
  return out
}

/** The counts the read states over the whole house (dormers, chimneys, roof windows) as features. */
export function countFeaturesOf(counts: { dormers: number; chimneys: number; roofWindows: number }, promptVersion: string, frames: readonly string[]): SourceFeature[] {
  const ev = { by: 'STRUCTURE_READ' as const, promptVersion, frames: [...frames] }
  return [
    { id: 'F-DORMERS', kind: 'DORMERS', stated: `${counts.dormers} dormer(s)`, evidence: ev, weight: counts.dormers > 0 ? 'MAJOR' : 'MINOR' },
    { id: 'F-CHIMNEYS', kind: 'CHIMNEYS', stated: `${counts.chimneys} chimney(s)`, evidence: ev, weight: 'MINOR' },
    { id: 'F-ROOF-WINDOWS', kind: 'ROOF_WINDOWS', stated: `${counts.roofWindows} roof window(s)`, evidence: ev, weight: 'MINOR' },
  ]
}

export type TraceInput = {
  agreed: AgreedStructure
  taken?: BuildStructure
  /** the bodies the builder solved, with the fate of each taken property; absent where the drawings' own model stands */
  bodies?: ReadonlyArray<{ id: string; describes?: string; roof: { kind: string; ridgeAxis?: 'X' | 'Z' }; fates?: ReadonlyArray<{ property: string; fate: string; taken?: string; built?: string; residual?: number; why: string }> }>
  crossRoofs?: ReadonlyArray<{ id: string; side: string }>
  relations?: ReadonlyArray<{ a: string; b: string; kind: string; why: string }>
  readback: StructureReadback
  model: CanonicalBuildingModel
  /** which body stands: one built from the sources (the read's consumer ran), or the drawings' own (it did not) */
  bodyBy: 'SOURCE_BODY' | 'LOCAL'
  /** the side an exterior wall of the model is on */
  sideOfWall: (w: CanonicalBuildingModel['walls'][number]) => string | undefined
}

/** Every feature of the map followed to the delivered model. */
export function traceFeatures(map: readonly SourceFeature[], x: TraceInput): FeatureTraceReport {
  const rows: FeatureTrace[] = []
  const a = x.agreed
  const check = (property: string) => x.readback.checks.find((c) => c.property === property)
  const fates = (x.bodies ?? []).flatMap((b) => (b.fates ?? []).map((f) => ({ bodyId: b.id, ...f })))
  const notConsumed = x.bodyBy === 'LOCAL' ? 'the body that stands is the drawings\' own model: the read was held against it as a witness and did not build it' : undefined
  const doorsOn = (side: string, garage: boolean): string[] => x.model.openings.filter((o) => { const w = x.model.walls.find((q) => q.id === o.wallId); if (!w || w.kind !== 'EXTERIOR' || x.sideOfWall(w) !== side) return false; const d = x.model.doors.find((q) => q.openingId === o.id) as { usage?: string } | undefined; return garage ? d?.usage === 'GARAGE' : o.kind === 'DOOR' && d?.usage !== 'GARAGE' }).map((o) => o.id)
  const number = (f: SourceFeature, w: AgreedStructure['pitchDeg'] | AgreedStructure['eavesM'] | AgreedStructure['ridgeM'], takenHas: boolean, prop: 'pitchDeg' | 'ridgeM' | 'eavesM'): FeatureTrace => {
    const agreed = { standing: w.standing, why: w.why }
    if (w.standing === 'DISPUTED') return { feature: f, agreed, result: 'NOT_BUILT', cause: 'DISPUTED_BY_WITNESS', why: `not taken: ${w.why}` }
    const c = check(`mainRoof.${prop}`)
    const fate = fates.find((q) => q.property === prop && q.taken !== undefined)
    if (!takenHas) return { feature: f, agreed, ...(c ? { measure: { built: c.built, ...(c.residual !== undefined ? { residual: c.residual } : {}) } } : {}), result: 'NOT_CHECKED', cause: 'NO_CONSUMER', why: prop === 'pitchDeg' ? `an ${f.status ?? ''} pitch is not taken by the builder (only one the page agrees with, or one the read states as printed or derived, moves walls)` : 'the builder has no use for it' }
    if (notConsumed) return { feature: f, agreed, ...(c ? { measure: { built: c.built, ...(c.residual !== undefined ? { residual: c.residual } : {}) } } : {}), result: c ? (c.agrees ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT') : 'NOT_CHECKED', ...(c?.agrees ? {} : { cause: 'NOT_ASKED' as const }), why: notConsumed }
    if (!c) return { feature: f, agreed, result: 'NOT_CHECKED', cause: 'NO_EVIDENCE', why: 'the delivered model has no roof this number can be measured on' }
    return { feature: f, agreed, bound: { host: fate ? `roof-${fate.bodyId}` : 'the main roof', parameter: prop, operation: 'BUILD_MASSING' }, measure: { built: c.built, ...(c.residual !== undefined ? { residual: c.residual } : {}) }, result: c.agrees ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT', ...(c.agrees ? {} : { cause: 'CONFLICT_WITH_DRAWING' as const }), why: fate ? `${fate.fate}: ${fate.why}` : c.agrees ? 'the built value is the stated one within the tolerance' : 'the registered elevations give another value; both are on the record' }
  }
  for (const f of map) {
    switch (f.kind) {
      case 'STOREYS': {
        const c = check('storeys')
        const agreed = { standing: a.storeys.standing, why: a.storeys.why }
        if (a.storeys.standing === 'DISPUTED') rows.push({ feature: f, agreed, ...(c ? { measure: { built: c.built } } : {}), result: 'NOT_BUILT', cause: 'DISPUTED_BY_WITNESS', why: `not taken: ${a.storeys.why}` })
        else if (!c) rows.push({ feature: f, agreed, result: 'NOT_CHECKED', cause: 'NO_EVIDENCE', why: 'the delivered model has no body whose wall top can be measured' })
        else rows.push({ feature: f, agreed, bound: { host: 'the main body\'s walls', parameter: 'wall top', operation: notConsumed ? 'LOCAL' : 'BUILD_MASSING' }, measure: { built: c.built }, result: c.agrees ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT', ...(c.agrees ? {} : { cause: (notConsumed ? 'NOT_ASKED' : 'CONFLICT_WITH_DRAWING') as TraceCause }), why: c.agrees ? 'the walls end within the storeys stated' : notConsumed ?? 'the storeys rule could not move the walls with what the elevations draw' })
        break
      }
      case 'MAIN_ROOF_KIND':
      case 'MAIN_RIDGE': {
        const w = f.kind === 'MAIN_ROOF_KIND' ? a.mainRoof : a.mainRidge
        const c = check(f.kind === 'MAIN_ROOF_KIND' ? 'mainRoof.kind' : 'mainRoof.ridge')
        const agreed = { standing: w.standing, why: w.why }
        const kept = fates.find((q) => q.property === 'mainRidge' && q.fate === 'RETAINED_WITH_CONFLICT')
        if (w.standing === 'DISPUTED') rows.push({ feature: f, agreed, ...(c ? { measure: { built: c.built } } : {}), result: 'NOT_BUILT', cause: 'DISPUTED_BY_WITNESS', why: `not taken: ${w.why}` })
        else if (!c) rows.push({ feature: f, agreed, result: 'NOT_CHECKED', cause: f.kind === 'MAIN_RIDGE' && x.taken?.mainRidge === undefined ? 'DISPUTED_BY_WITNESS' : 'NO_EVIDENCE', why: f.kind === 'MAIN_RIDGE' && x.taken?.mainRidge === undefined ? 'the ridge\'s direction comes from the same answer as a disputed roof kind: not taken' : 'the delivered model has no roof to measure it on' })
        else rows.push({ feature: f, agreed, bound: { host: 'the main roof', parameter: f.kind === 'MAIN_ROOF_KIND' ? 'kind' : 'ridge axis', operation: notConsumed ? 'LOCAL' : 'BUILD_MASSING' }, measure: { built: c.built }, result: c.agrees ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT', ...(c.agrees ? {} : { cause: (notConsumed ? 'NOT_ASKED' : kept ? 'CONFLICT_WITH_DRAWING' : 'BUILD_ERROR') as TraceCause }), why: c.agrees ? 'measured on the delivered roof' : notConsumed ?? kept?.why ?? 'taken, and the delivered roof measures otherwise' })
        break
      }
      case 'MAIN_PITCH': rows.push(number(f, a.pitchDeg, x.taken?.pitchDeg !== undefined, 'pitchDeg')); break
      case 'MAIN_EAVES_HEIGHT': rows.push(number(f, a.eavesM, x.taken?.eavesM !== undefined, 'eavesM')); break
      case 'MAIN_RIDGE_HEIGHT': rows.push(number(f, a.ridgeM, x.taken?.ridgeM !== undefined, 'ridgeM')); break
      case 'PART': {
        const i = Number(f.id.replace('F-PART-', '')) - 1
        const p = a.parts[i]
        const agreed = { standing: p.standing, why: p.why }
        const label = `${p.value.what}@${p.value.where}`
        const fate = fates.find((q) => q.property === 'part' && (q.taken ?? '').startsWith(label))
        if (p.standing === 'DISPUTED') { rows.push({ feature: f, agreed, result: 'NOT_BUILT', cause: 'DISPUTED_BY_WITNESS', why: `not taken: ${p.why}` }); break }
        if (notConsumed) { rows.push({ feature: f, agreed, result: 'NOT_CHECKED', cause: 'NOT_ASKED', why: notConsumed }); break }
        if (fate?.fate === 'APPLIED') { rows.push({ feature: f, agreed, bound: { host: fate.built ?? fate.bodyId, operation: 'BUILD_MASSING' }, elements: [fate.built?.split(' ')[0] ?? fate.bodyId], measure: { built: fate.built ?? '' }, result: 'BUILT_AS_STATED', why: fate.why }); break }
        if (fate) { rows.push({ feature: f, agreed, result: 'NOT_BUILT', cause: 'LOST_IN_BINDING', why: fate.why }); break }
        // a part bound to a step of the outline is a body of its own (the builder's own record says which)
        const bodiesBuilt = x.readback.bodies.length
        rows.push(bodiesBuilt > 1 ? { feature: f, agreed, bound: { host: 'a step of the outline on that side', operation: 'BUILD_MASSING' }, measure: { built: `${bodiesBuilt} bodies` }, result: 'BUILT_AS_STATED', why: 'the outline steps out on that side: a body of its own' } : { feature: f, agreed, result: 'NOT_BUILT', cause: 'LOST_IN_BINDING', why: 'no step of the outline on that side and no gable wall drawn there: nothing to bind it to' })
        break
      }
      case 'CROSS_ROOF': {
        const r = (a.roofs ?? []).find((q) => `F-${q.id}` === f.id)
        const built = (x.crossRoofs ?? []).find((c) => c.side === f.where)
        const measured = built ? x.readback.roofs.find((q) => q.id === built.id) : undefined
        const fate = fates.find((q) => q.property === 'part' && /CROSS_ROOF/.test(q.taken ?? '') && (q.taken ?? '').includes(`@${f.where}`))
        if (notConsumed) { rows.push({ feature: f, result: 'NOT_CHECKED', cause: 'NOT_ASKED', why: notConsumed }); break }
        // feature-map 1.0.1: a cross roof the builder bound to a BODY of the outline (that body's own views draw its ridge)
        // is built as that body's roof — measured there, not looked for as a cross gable on another body's walls
        const asBody = fate?.fate === 'APPLIED' && /^mass-/.test(fate.built ?? '') ? x.readback.roofs.find((q) => q.id === `roof-${fate.bodyId}`) : undefined
        const crossOk = (q: { roof: string; ridgeAxis?: string }): boolean => q.roof === 'GABLE' && (r?.ridgeAlong.value.along === 'FRONT' ? q.ridgeAxis === 'X' : r?.ridgeAlong.value.along === 'SIDE' ? q.ridgeAxis === 'Z' : true)
        if (asBody && !crossOk(asBody)) { rows.push({ feature: f, result: 'BUILT_DIFFERENT', cause: 'BUILD_ERROR', bound: { host: asBody.id, operation: 'BUILD_MASSING' }, measure: { built: `${asBody.roof} along ${asBody.ridgeAxis}` }, why: `bound to ${asBody.id}, whose roof in the delivered model is ${asBody.roof} along ${asBody.ridgeAxis ?? '—'}: not the stated second ridge` }); break }
        if (asBody) { rows.push({ feature: f, ...(r ? { agreed: { standing: r.kind.standing, why: r.kind.why } } : {}), bound: { host: asBody.id, operation: 'BUILD_MASSING (bound to the body whose own views draw this ridge)' }, elements: asBody.planeIds.length > 0 ? asBody.planeIds : [asBody.id], measure: { built: `${asBody.roof} along ${asBody.ridgeAxis}, ${asBody.pitchDeg}°, ridge ${asBody.ridgeM} m` }, result: 'BUILT_AS_STATED', why: fate?.why ?? '' }); break }
        if (built && measured && !crossOk(measured)) rows.push({ feature: f, result: 'BUILT_DIFFERENT', cause: 'BUILD_ERROR', bound: { host: built.id, operation: 'BUILD_MASSING (roof system)' }, measure: { built: `${measured.roof} along ${measured.ridgeAxis}` }, why: `the cross gable in the delivered model is ${measured.roof} along ${measured.ridgeAxis ?? '—'}: not the stated second ridge` })
        else if (built && measured) rows.push({ feature: f, ...(r ? { agreed: { standing: r.kind.standing, why: r.kind.why } } : {}), bound: { host: built.id, operation: 'BUILD_MASSING (roof system)' }, elements: measured.planeIds, measure: { built: `${measured.roof} along ${measured.ridgeAxis}, ${measured.pitchDeg}°, ridge ${measured.ridgeM} m` }, result: 'BUILT_AS_STATED', why: fate?.why ?? 'a roof region on the main body\'s walls, cut into the main slope along two valleys' })
        else rows.push({ feature: f, result: 'NOT_BUILT', cause: built ? 'BUILD_ERROR' : 'LOST_IN_BINDING', why: built ? 'solved as a roof region, and the delivered model holds no planes under its name' : fate?.why ?? 'no place for it was found on the main body (no gable wall drawn there, no share stated)' })
        break
      }
      case 'ROOF_REGION': {
        const r = (a.roofs ?? []).find((q) => `F-${q.id}` === f.id)
        const part = r?.part !== undefined ? x.taken?.parts.find((q) => q.roofId === r.id) : undefined
        // feature-map 1.0.2: the body that carries THIS roof — named by its own id in a fate (its pitch or its join), else
        // the one body the builder bound to a part; never the first body that is not the main one
        const parts = (x.bodies ?? []).filter((b) => b.describes === 'PART')
        const carrier = fates.find((q) => (q.taken ?? '').includes(`(${r?.id ?? '§'})`))?.bodyId ?? (parts.length === 1 ? parts[0].id : undefined)
        const fs = carrier ? fates.filter((q) => q.bodyId === carrier && ['pitchDeg', 'ridgeM', 'eavesM'].includes(q.property)) : []
        if (notConsumed) { rows.push({ feature: f, result: 'NOT_CHECKED', cause: 'NOT_ASKED', why: notConsumed }); break }
        if (!part) { rows.push({ feature: f, result: 'NOT_BUILT', cause: 'LOST_IN_BINDING', why: 'its part was not taken (disputed), or has no body: its roof\'s numbers have nothing to be the numbers of' }); break }
        if (fs.length === 0) { rows.push({ feature: f, result: 'NOT_CHECKED', cause: 'LOST_IN_BINDING', why: 'its part is taken, but no body was bound to it: the numbers were not used' }); break }
        const conflict = fs.find((q) => q.fate === 'RETAINED_WITH_CONFLICT' || q.fate === 'REJECTED')
        rows.push({ feature: f, bound: { host: `roof-${fs[0].bodyId}`, operation: 'BUILD_MASSING' }, measure: { built: fs.map((q) => `${q.property} ${q.built ?? '—'}`).join(', ') }, result: conflict ? 'BUILT_DIFFERENT' : 'BUILT_AS_STATED', ...(conflict ? { cause: 'CONFLICT_WITH_DRAWING' as const } : {}), why: fs.map((q) => `${q.property}: ${q.fate} — ${q.why}`).join('; ').slice(0, 600) })
        break
      }
      case 'ROOF_JOIN': {
        const fate = fates.find((q) => q.property === 'join')
        if (notConsumed) { rows.push({ feature: f, result: 'NOT_CHECKED', cause: 'NOT_ASKED', why: notConsumed }); break }
        const id = f.id.replace(/^F-/, '').replace(/-JOIN$/, '')
        const cross = (a.roofs ?? []).find((q) => q.id === id && q.of === 'CROSS')
        if (cross) {
          const bodyFate = fates.find((q) => q.property === 'part' && q.fate === 'APPLIED' && /CROSS_ROOF/.test(q.taken ?? '') && (q.taken ?? '').includes(`@${cross.seenOn}`) && /^mass-/.test(q.built ?? ''))
          if (bodyFate) {
            // the cross roof is a body's roof: its join is every relation the solver found between that roof and another
            const mine = (x.relations ?? []).filter((q) => q.a === `roof-${bodyFate.bodyId}` || q.b === `roof-${bodyFate.bodyId}`)
            const cs = x.readback.checks.filter((q) => q.property.startsWith('join ') && q.property.includes(`roof-${bodyFate.bodyId}`))
            const stated = cross.join.value.join
            const same = mine.length > 0 && mine.every((q) => (stated === 'VALLEY') === (q.kind === 'VALLEY'))
            rows.push(mine.length === 0 ? { feature: f, result: 'NOT_BUILT', cause: 'CONFLICT_WITH_DRAWING', why: `roof-${bodyFate.bodyId} carries this roof, and the solver finds no roof meeting it` } : { feature: f, bound: { host: `roof-${bodyFate.bodyId}`, operation: 'roof system' }, measure: { built: mine.map((q) => `${q.a} → ${q.b} ${q.kind}`).join('; ') }, result: same && cs.every((q) => q.agrees) ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT', ...(same && cs.every((q) => q.agrees) ? {} : { cause: (same ? 'BUILD_ERROR' : 'CONFLICT_WITH_DRAWING') as TraceCause }), why: `stated ${stated}; the heights of the bound roofs give ${mine.map((q) => q.kind).join(', ')}, read back from the model's roof edges (${cs.filter((q) => q.agrees).length} of ${cs.length} join check(s) agree)` })
            break
          }
          const built = (x.crossRoofs ?? []).find((c) => c.side === cross.seenOn)
          const c = built ? x.readback.checks.find((q) => q.property.startsWith(`join ${built.id} `)) : undefined
          rows.push(c ? { feature: f, bound: { host: built?.id ?? '', operation: 'roof system' }, measure: { built: c.built }, result: c.agrees ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT', ...(c.agrees ? {} : { cause: 'BUILD_ERROR' as const }), why: 'the valleys are computed where the two top surfaces meet, and read back from the model\'s roof edges' } : { feature: f, result: 'NOT_BUILT', cause: 'LOST_IN_BINDING', why: 'the cross roof it is the join of was not built' })
          break
        }
        // feature-map 1.0.2: the join of THIS part's roof (its fate names the roof's id), decided by what the delivered model
        // shows — the readback's measured join of that body (two VALLEY edges, or none) — not by the builder's intent
        const own = fates.find((q) => q.property === 'join' && (q.taken ?? '').includes(`(${id})`)) ?? (fates.filter((q) => q.property === 'join').length === 1 ? fates.find((q) => q.property === 'join') : undefined)
        const measuredJoin = own ? x.readback.checks.find((q) => q.property.startsWith(`join roof-${own.bodyId} `) || q.property.startsWith(`join `) && q.property.includes(`roof-${own.bodyId}`)) : undefined
        if (!own) { rows.push({ feature: f, result: 'NOT_CHECKED', cause: 'LOST_IN_BINDING', why: 'the part whose roof it is the join of has no body: no relation to compute' }); break }
        const intent = own.fate === 'APPLIED'
        const shown = measuredJoin ? measuredJoin.agrees : true
        rows.push({ feature: f, bound: { host: `roof-${own.bodyId}`, operation: 'roof system' }, measure: { built: measuredJoin ? `${own.built ?? ''}; in the model: ${measuredJoin.built}` : own.built ?? '' }, result: intent && shown ? 'BUILT_AS_STATED' : 'BUILT_DIFFERENT', ...(intent && shown ? {} : { cause: (intent ? 'BUILD_ERROR' : own.fate === 'UNRESOLVED' ? 'NO_CONSUMER' : 'CONFLICT_WITH_DRAWING') as TraceCause }), why: `${own.why}${measuredJoin ? `; measured on the delivered model: ${measuredJoin.agrees ? 'as solved' : `NOT as solved (${measuredJoin.built})`}` : ''}` })
        break
      }
      case 'NOT_VOLUME':
        rows.push({ feature: f, result: 'NOT_BUILT', cause: 'NO_CONSUMER', why: `named apart so that it is NOT built as a box; neither the body builder nor the registry has an operation that builds a ${f.stated.split(' ')[1]} as what it is (a wall set back in an outline, a roof on posts, a projecting slab): the outline keeps or loses its step by the miniature's convention, and the miniature shows a plain wall there` })
        break
      case 'ENTRANCE_DOOR':
      case 'GARAGE_DOOR': {
        const ids = f.where ? doorsOn(f.where, f.kind === 'GARAGE_DOOR') : []
        rows.push(ids.length > 0 ? { feature: f, bound: { host: `a wall of the ${sideLabel(f.where ?? '')} side`, operation: 'ADD_OPENING' }, elements: ids, measure: { built: `${ids.length} such door(s) on that side` }, result: 'BUILT_AS_STATED', why: 'a door of that kind stands in an exterior wall of that side' } : { feature: f, result: 'NOT_BUILT', cause: 'NOT_ASKED', why: `no ${f.kind === 'GARAGE_DOOR' ? 'garage door' : 'door'} stands on the ${sideLabel(f.where ?? '')} side of the delivered model: the openings come from the elevation readings (their own fates say whether one was read there and why it was not built); the structure read's statement is not itself an opening proposal` })
        break
      }
      case 'DORMERS':
      case 'CHIMNEYS':
      case 'ROOF_WINDOWS': {
        const stated = Number(f.stated.split(' ')[0])
        const built = f.kind === 'DORMERS' ? x.model.assemblies.filter((q) => q.kind === 'DORMER').length : f.kind === 'CHIMNEYS' ? x.model.chimneys.length : x.model.roofOpenings.filter((q) => (q as { kind?: string }).kind !== 'DORMER' && (q as { kind?: string }).kind !== 'CHIMNEY').length
        rows.push({ feature: f, measure: { built: `${built}`, residual: built - stated }, result: built === stated ? 'BUILT_AS_STATED' : built === 0 && stated > 0 ? 'NOT_BUILT' : 'BUILT_DIFFERENT', ...(built === stated ? {} : { cause: (f.kind === 'DORMERS' && built === 0 ? 'NOT_ASKED' : 'NOT_ASKED') as TraceCause }), why: built === stated ? 'the count in the delivered model is the count stated' : `the count is a witness only: ${f.kind === 'DORMERS' ? 'dormers' : f.kind === 'CHIMNEYS' ? 'chimneys' : 'roof windows'} are built from the elevation readings one by one (their own fates), and ${built} stand where ${stated} are stated` })
        break
      }
    }
  }
  const byResult: Record<TraceResult, number> = { BUILT_AS_STATED: 0, BUILT_DIFFERENT: 0, NOT_BUILT: 0, NOT_CHECKED: 0 }
  const byCause: Partial<Record<TraceCause, number>> = {}
  for (const r of rows) { byResult[r.result] += 1; if (r.cause) byCause[r.cause] = (byCause[r.cause] ?? 0) + 1 }
  return { version: FEATURE_MAP_VERSION, features: rows.length, byResult, byCause, rows }
}

/** The feature map as the reviewer is handed it: what the sources state, one line each — nothing about the model. */
export function featureMapText(map: readonly SourceFeature[]): string {
  return `FEATURES OF THE HOUSE AS THE SOURCES STATE THEM (read from the publisher's pictures before any model was built; verify each one in the model's views as a form and a relation, not as a label; a feature you cannot see in the model's views is not verified):\n${map.map((f) => `- ${f.id} [${f.weight}] ${f.stated}`).join('\n')}`
}
