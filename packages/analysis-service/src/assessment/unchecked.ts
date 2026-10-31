/**
 * N9-01 (A, B): the SOURCE_UNCHECKED budget — every sheet, storey and registration axis no relation compared, with
 * why and what it could check. Built from records the solver already keeps (`viewAudit`, the plan registrations, the
 * section's role) and from the relations' own UNCHECKED storeys; it reads no pixel. An unregistered view is listed here
 * rather than passing in silence.
 */
import type { ViewAuditRecord } from '@buildapp/reconstruction'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import type { RelationResult, SourceUnchecked, UncheckedItem } from './types.js'
import type { ViewAdjudication } from './elevations.js'

const AXES: Record<string, UncheckedItem['axes']> = {
  OPENINGS_ONLY: { along: 'FULL', height: 'NONE' },
  POSITIONS_ONLY: { along: 'ENDS_ONLY', height: 'NONE' },
  NOT_REGISTERED: { along: 'NONE', height: 'NONE' },
  REGISTERED: { along: 'FULL', height: 'FULL' },
}

export function sourceUncheckedOf(input: {
  frames: readonly SourceCoordinateFrame[]
  viewAudit: readonly ViewAuditRecord[]
  /** The plans the solver registered, by frame and storey. */
  registeredPlans: ReadonlyArray<{ frameId: string; storeyIndex: number }>
  /** Plans read but not used, with the solver's reason. */
  skippedPlans: ReadonlyArray<{ frameId: string; why: string }>
  /** The section the level datums were read from, when one was. */
  sectionFrameId?: string
  heightsMeasured: boolean
  relations: readonly RelationResult[]
  /** N9-02R: the shared adjudication of each elevation's axes; an elevation's axes are told from it. */
  adjudication?: ReadonlyMap<string, ViewAdjudication>
}): SourceUnchecked {
  const items: UncheckedItem[] = []
  const audit = new Map(input.viewAudit.map((v) => [v.frameId, v]))
  const r5 = input.relations.find((r) => r.id === 'R5_REGISTERED_ELEVATIONS')
  const registered = new Map(input.registeredPlans.map((p) => [p.frameId, p.storeyIndex]))
  const skipped = new Map(input.skippedPlans.map((s) => [s.frameId, s.why]))
  for (const f of [...input.frames].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const doc = f.roles.document
    if (doc === 'ELEVATION') {
      const v = audit.get(f.id)
      if (!v || v.use === 'DUPLICATE') continue
      const r5item = r5?.items.find((i) => i.source?.frameId === f.id)
      if (v.use === 'REGISTERED' && r5item && r5item.status !== 'UNCHECKED') continue
      const adj = input.adjudication?.get(f.id)
      // N9-02R: a view the solver registered whose R5 comparisons were all set aside (a disputed axis) was compared on nothing
      const executed = Number(r5item?.coverage.executed ?? 0)
      const none = v.use === 'NOT_REGISTERED' || (v.use === 'REGISTERED' && r5item !== undefined && executed === 0)
      const axes: UncheckedItem['axes'] = adj
        ? { along: adj.along === 'VALID' ? 'FULL' : adj.along === 'SPAN_ONLY' ? 'SPAN_ONLY' : adj.along === 'DISPUTED' ? 'DISPUTED' : 'NONE', height: adj.vertical === 'VALID' ? 'FULL' : adj.vertical === 'DISPUTED' ? 'DISPUTED' : 'NONE' }
        : (AXES[v.use] ?? { along: 'NONE', height: 'NONE' })
      items.push({
        kind: 'ELEVATION',
        frameId: f.id,
        ...(v.side ? { side: v.side } : {}),
        axes,
        extent: none ? 'NONE' : 'PARTIAL',
        what: `${v.side ?? v.labelledView} elevation (${v.use})`,
        why: v.use === 'REGISTERED' ? (r5item?.why ?? 'registered, nothing observed') : v.why.slice(0, 240),
        couldCheck: 'silhouette width and steps, eaves and ridge heights, the opening rows of its facade (MISSING_IN_MODEL / EXTRA_IN_MODEL), roof outline and chimneys',
      })
    } else if (doc === 'SECTION') {
      const used = f.id === input.sectionFrameId
      items.push({
        kind: 'SECTION',
        frameId: f.id,
        axes: { along: 'NONE', height: used && input.heightsMeasured ? 'DATUM_ONLY' : 'NONE' },
        extent: used ? 'PARTIAL' : 'NONE',
        what: used ? 'section: level datums read' : 'section: not read',
        why: used ? 'its printed level datums set the storey heights; it is not registered as a view, so the slabs, the void and the storey outline along the cut were never compared with the model' : 'no level datum was read from it and it is not registered as a view',
        couldCheck: 'slab extents and voids along the cut, storey levels, attic knee walls, the roof profile and pitch at the cut',
      })
    } else if (doc === 'FLOOR_PLAN') {
      if (registered.has(f.id)) continue
      const copyOf = input.frames.find((g) => g.id !== f.id && g.roles.document === 'FLOOR_PLAN' && g.roles.storey === f.roles.storey && registered.has(g.id))
      items.push({
        kind: 'PLAN',
        frameId: f.id,
        extent: 'NONE',
        what: `floor plan (${f.roles.storey})`,
        why: skipped.get(f.id) ?? (copyOf ? `another copy of the ${f.roles.storey.toLowerCase()} plan (${copyOf.id}) was read and registered; this one was not compared` : 'not registered to any storey of the model'),
        couldCheck: 'the walls, outline, openings and rooms of its storey (R3, R4)',
      })
    } else if (doc === 'PERSPECTIVE_RENDER') {
      const v = audit.get(f.id)
      items.push({
        kind: 'PERSPECTIVE',
        frameId: f.id,
        extent: v?.use === 'PERSPECTIVE_CHECK_ONLY' ? 'PARTIAL' : 'NONE',
        what: `perspective render (${v?.use ?? 'not audited'})`,
        why: v?.use === 'PERSPECTIVE_CHECK_ONLY' ? 'its camera solved: depth order only; a render sets no dimension' : 'a render sets no dimension and its camera did not solve',
        couldCheck: 'presence of features only (chimneys, dormers, balconies), never a measure',
      })
    } else if (doc === 'SITE_PLAN') {
      items.push({ kind: 'PLAN', frameId: f.id, extent: 'NONE', what: 'site plan', why: 'not read for the building', couldCheck: 'the footprint outline and its orientation' })
    }
  }
  // storeys a plan relation could not compare
  for (const r of input.relations.filter((x) => x.id === 'R3_WALL_INK' || x.id === 'R4_STOREY_OUTLINE')) {
    for (const i of r.items) {
      if (i.status !== 'UNCHECKED' || !['NO_REGISTERED_PLAN', 'REGISTRATION_NOT_CORROBORATED', 'RASTER_NOT_AVAILABLE', 'STOREY_SHEET_WITHOUT_MODEL', 'NO_STOREY_TO_COMPARE'].includes(i.code)) continue
      const storeyIndex = i.source?.storeyIndex
      if (items.some((x) => x.kind === 'STOREY' && x.what.startsWith(`${r.id}`) && x.storeyIndex === storeyIndex && x.why === i.why)) continue
      items.push({ kind: 'STOREY', ...(storeyIndex !== undefined ? { storeyIndex } : {}), ...(i.source ? { frameId: i.source.frameId } : {}), extent: 'NONE', what: `${r.id}: ${i.objects.length === 1 ? i.objects[0] : `storey ${storeyIndex}`}`, why: i.why, couldCheck: r.id === 'R3_WALL_INK' ? 'every wall of the storey against the drawn wall bands' : 'the storey’s drawn outline against the modelled one' })
    }
  }
  const byKind: Record<string, number> = {}
  for (const i of items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1
  return { items, counts: { total: items.length, byKind, none: items.filter((i) => i.extent === 'NONE').length, partial: items.filter((i) => i.extent === 'PARTIAL').length } }
}
