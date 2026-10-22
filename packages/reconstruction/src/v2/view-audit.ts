/**
 * N7-P2 (A): which drawings the solver actually used, and how — one record per elevation or perspective frame.
 *
 * Four elevation images on a page are not four views. A view is used only when it is registered: a side (labelled or
 * decided), one isotropic scale from the plan's span and a ground row from the ridge datum (`registerElevationV2`). A
 * view registered on its walls' band is read for the openings of its facade only; a view whose ground lands off the
 * house's other views gives no opening heights; a perspective render is never an elevation and is used, when its camera
 * solves, only to check depth order. Every view that is not used says why and what that loses.
 *
 * Pure bookkeeping over what the solver decided; nothing here registers, moves or reads a pixel.
 */
import { round6 } from '@buildapp/source-common'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import type { ElevationRegistration } from '../views.js'
import type { ElevationRegistrationV2 } from './frame.js'

export type ViewUse =
  /** Registered on its silhouette: openings, roof outline, rooflights, chimneys, tones and the residual checks. */
  | 'REGISTERED'
  /** Registered on its walls' band (or at a same-sheet scale): read for the openings of its facade only. */
  | 'OPENINGS_ONLY'
  | 'NOT_REGISTERED'
  /** A second copy of a drawing already registered. */
  | 'DUPLICATE'
  /** A perspective render: never an elevation; a solved camera checks depth order and nothing else. */
  | 'PERSPECTIVE_CHECK_ONLY'
  | 'PERSPECTIVE_UNUSED'
  /** N7-P2: registered on its wall band's two ends with no ridge datum: positions along the facade only, no height. */
  | 'POSITIONS_ONLY'

export type ViewAuditRecord = {
  frameId: string
  assetId: string
  document: string
  projection: string
  /** The side the source's labels claim (FRONT, REAR, SIDE_UNSPECIFIED, …). */
  labelledView: string
  sizePx: { width: number; height: number }
  use: ViewUse
  /** The facade the view was finally read as, after every orientation decision. */
  side?: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'
  /** How that side was settled: by the source's label, by the 03R guess, or moved by a later decision. */
  sideBasis?: 'LABELLED' | 'FIRST_READING' | 'MOVED'
  sideConfidence?: number
  /** One scale for both axes, m/px, and what it was taken from. */
  mpp?: number
  spanM?: number
  spanWhy?: string
  /** Where the view puts the ground, m, and how far from the terrain it was registered against. */
  groundY?: number
  groundErrorM?: number
  /** Horizontal registration error in pixels and metres: the ground error at the view's scale stands for the vertical. */
  groundErrorPx?: number
  confidence?: number
  openingHeights?: 'READ' | 'REFUSED'
  why: string
  /** What the solver does not read because of this view's use. */
  lost: string[]
}

const isSide = (v: string): boolean => v === 'LEFT' || v === 'RIGHT' || v === 'SIDE_LEFT' || v === 'SIDE_RIGHT'

export function viewAudit(input: {
  frames: readonly SourceCoordinateFrame[]
  /** The 03R registrations (their first side) and the frames it refused, with why. */
  first: readonly ElevationRegistration[]
  firstRefused: ReadonlyArray<{ frameId: string; why: string }>
  /** Why this pass did not register a frame the 03R pass did. */
  refusals: ReadonlyMap<string, string>
  registered: readonly ElevationRegistrationV2[]
  openingsOnly: ReadonlyMap<string, ElevationRegistrationV2>
  horizontalOnly?: ReadonlyMap<string, ElevationRegistrationV2>
  sameSheet: ReadonlySet<string>
  heightsRefused: ReadonlySet<string>
  cameras: ReadonlyArray<{ frameId: string; solved: boolean; residualPx?: number; why: string }>
}): ViewAuditRecord[] {
  const out: ViewAuditRecord[] = []
  const firstOf = new Map(input.first.map((r) => [r.frameId, r]))
  const refusedFirst = new Map(input.firstRefused.map((r) => [r.frameId, r.why]))
  const seenAsset = new Set<string>()
  const frames = input.frames.filter((f) => f.roles.document === 'ELEVATION' || f.roles.projection === 'ORTHOGRAPHIC_ELEVATION' || f.roles.projection === 'PERSPECTIVE')
  for (const f of [...frames].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = { frameId: f.id, assetId: f.assetId, document: f.roles.document, projection: f.roles.projection, labelledView: f.roles.view, sizePx: { width: f.size.width, height: f.size.height } }
    if (f.roles.projection === 'PERSPECTIVE') {
      const cam = input.cameras.find((c) => c.frameId === f.id)
      out.push({ ...base, use: cam?.solved ? 'PERSPECTIVE_CHECK_ONLY' : 'PERSPECTIVE_UNUSED', why: cam ? (cam.solved ? `a perspective render, never read as an elevation; its camera solved (${cam.residualPx?.toFixed(1)} px rms) and checks depth order only` : `a perspective render, never read as an elevation; ${cam.why}`) : 'a perspective render, never read as an elevation', lost: [] })
      continue
    }
    if (f.roles.projection !== 'ORTHOGRAPHIC_ELEVATION') {
      out.push({ ...base, use: 'NOT_REGISTERED', why: `classified as ${f.roles.projection.toLowerCase().replace(/_/g, ' ')}, not as an orthographic elevation`, lost: ['every reading of this image'] })
      continue
    }
    const reg = input.registered.find((r) => r.frameId === f.id)
    const band = input.openingsOnly.get(f.id)
    const first = firstOf.get(f.id)
    const corners = input.horizontalOnly?.get(f.id)
    if (!reg && !band && corners) {
      seenAsset.add(f.assetId)
      out.push({ ...base, use: 'POSITIONS_ONLY', side: corners.side, sideBasis: isSide(f.roles.view) || f.roles.view === 'FRONT' || f.roles.view === 'REAR' ? 'LABELLED' : 'FIRST_READING', sideConfidence: corners.sideConfidence, mpp: corners.mpp, spanM: corners.spanM, spanWhy: corners.spanWhy, confidence: corners.confidence, openingHeights: 'REFUSED', why: corners.why, lost: ['every height on this view (no ridge datum: the ground row is the drawn terrain line)', 'the roof outline, rooflights, chimneys and wall tones on this view'] })
      continue
    }
    const r = reg ?? band
    if (r) {
      seenAsset.add(f.assetId)
      const sideBasis: ViewAuditRecord['sideBasis'] = isSide(f.roles.view) || f.roles.view === 'FRONT' || f.roles.view === 'REAR' ? 'LABELLED' : first?.side && first.side !== r.side ? 'MOVED' : 'FIRST_READING'
      const heights = input.heightsRefused.has(f.id) ? 'REFUSED' : 'READ'
      out.push({
        ...base,
        use: reg ? 'REGISTERED' : 'OPENINGS_ONLY',
        side: r.side,
        sideBasis,
        sideConfidence: r.sideConfidence,
        mpp: r.mpp,
        spanM: r.spanM,
        spanWhy: r.spanWhy,
        groundY: r.bottomY,
        groundErrorM: r.anisotropyCheck,
        groundErrorPx: round6(r.anisotropyCheck / r.mpp),
        confidence: r.confidence,
        openingHeights: heights,
        why: reg ? r.why : `${input.sameSheet.has(f.id) ? 'at the scale of the same sheet’s front or rear view' : 'on its walls’ band'}: ${r.why}`,
        lost: [...(reg ? [] : ['the roof outline, rooflights, chimneys and wall tones on this view']), ...(heights === 'REFUSED' ? ['the heights of the openings low on its walls'] : [])],
      })
      continue
    }
    if (seenAsset.has(f.assetId) || (!first && !refusedFirst.has(f.id) && [...firstOf.values()].some((x) => x.assetId === f.assetId))) {
      out.push({ ...base, use: 'DUPLICATE', why: 'another copy of a drawing already registered: pixels, not evidence', lost: [] })
      continue
    }
    const why = input.refusals.get(f.id) ?? refusedFirst.get(f.id) ?? (first ? 'registered by the first pass but not by this one' : 'not reached by the registration')
    out.push({ ...base, use: 'NOT_REGISTERED', ...(first?.side ? { side: first.side, sideBasis: isSide(f.roles.view) ? 'LABELLED' : 'FIRST_READING', sideConfidence: first.sideConfidence } : {}), why, lost: ['the openings of its facade as this view draws them (widths, sills and heads come from the plan and callouts alone)', 'the source-view checks of that facade'] })
  }
  return out
}
