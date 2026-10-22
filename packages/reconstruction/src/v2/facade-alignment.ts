/**
 * N7-P2 (B, D): the plan's openings against the openings each registered elevation draws, in metres.
 *
 * The plan fixes where a wall is broken (the gap's interval), a printed callout fixes width and height; the elevations
 * show where each opening sits in the wall's height and which openings a facade really has. Here every model opening of
 * a facade with a registered view is paired with the view's own reading (`facade-openings.ts`), one to one, and every
 * difference is named with its size: MISSING_IN_MODEL, EXTRA_IN_MODEL, HORIZONTAL_OFFSET, WIDTH_MISMATCH, SILL_MISMATCH,
 * HEAD_MISMATCH, WRONG_STOREY; a side view whose readings fit the opposite wall clearly better is WRONG_FACADE; a facade
 * with no registered view is UNREGISTERED_VIEW for each of its openings.
 *
 * Corrections follow the stronger source, and only where the sources agree with each other:
 *   - a sill or head the model took by CONVENTION (no callout, no view) is taken from a view whose heights are
 *     registered on the ridge datum and a sound ground, when that view's reading is unambiguous and the result is an
 *     opening the wall can hold; a printed height or a height read on a view is never overwritten;
 *   - a head the model left UNRESOLVED because the printed height reads two ways alike is settled by a view whose
 *     heights are registered, when the opening's height on the view fits exactly one of the printed readings and not
 *     the one the model took: the value is the printed one (SOURCE_CORROBORATED), the view only chooses;
 *   - a width or interval is never moved by pixels alone: the plan's gap and a printed callout are stronger than a
 *     render. A large disagreement is reported, the model is kept.
 * Where they conflict, the model stands and the conflict is in the report. Pure.
 */
import { round6 } from '@buildapp/source-common'
import type { OpeningV2, Facade } from './openings-v2.js'
import type { LevelV2 } from './building.js'
import type { FacadeOpeningReading, FacadeOpeningRejection, FacadeView } from './facade-openings.js'
import type { ProvenanceStatus } from './graph.js'
import { HEIGHT_AGREEMENT_M, HEIGHT_PICK_MIN_SCORE_SHARE, HEIGHT_PICK_TOLERANCE_M, HEIGHT_RIVAL_MIN_CM } from './opening-reading.js'

export type AlignmentCode = 'MISSING_IN_MODEL' | 'EXTRA_IN_MODEL' | 'HORIZONTAL_OFFSET' | 'WIDTH_MISMATCH' | 'SILL_MISMATCH' | 'HEAD_MISMATCH' | 'WRONG_FACADE' | 'WRONG_STOREY' | 'UNREGISTERED_VIEW'

export type FacadeOpeningComparison = {
  facade: Facade
  openingId?: string
  readingId?: string
  storeyIndex: number | null
  codes: AlignmentCode[]
  model?: { from: number; to: number; widthM: number; sillY: number; headY: number; source: { width: string; sill: string; head: string } }
  view?: { from: number; to: number; widthM: number; sillY: number; headY: number; kind: string; mullions: number; uncertaintyM: { along: number; height: number }; heightsTrusted: boolean }
  /** View minus model, metres. */
  delta?: { centreM: number; widthM: number; sillM: number; headM: number }
  tolerance?: { alongM: number; heightM: number }
  note?: string
}

export type OpeningCorrection = {
  openingId: string
  facade: Facade
  property: 'sill' | 'head'
  before: number
  after: number
  frameId: string
  readingId: string
  /** Where the corrected value now comes from. */
  provenance: ProvenanceStatus
  /** The printed height the view picked among the callout's readings, when that is the correction. */
  calloutHeightCm?: number
  why: string
}

export type FacadeViewSummary = {
  facade: Facade
  frameId: string
  registration: FacadeView['registration']
  heights: boolean
  alongErrorM: number
  heightErrorM: number
  /** The projection: world along = alongAtPx0 + alongSign · mpp · px; world y = (zeroRow − py) · mpp. */
  projection: { mpp: number; alongAtPx0: number; alongSign: 1 | -1; zeroRow: number }
  readings: number
  rejected: number
  matched: number
  verdict: 'AGREES' | 'MIXED' | 'DISAGREES' | 'NO_READINGS'
}

export type FacadeAlignmentReport = {
  views: FacadeViewSummary[]
  readings: FacadeOpeningReading[]
  rejected: FacadeOpeningRejection[]
  comparisons: FacadeOpeningComparison[]
  corrections: OpeningCorrection[]
  /** Facades no registered view covers, and why. */
  unregistered: Array<{ facade: Facade; why: string }>
  counts: Record<AlignmentCode | 'MATCHED', number>
}

const CENTRE_TOL_M = 0.1
const WIDTH_TOL_M = 0.1
const HEIGHT_TOL_M = 0.1
/** A plan gap whose pixels differ from the wall's materials on no more than this share is drawn as plain wall. */
const WALL_ONLY_SHARE = 0.03
/** A pairing needs this share of the narrower one's width in common. */
const MIN_ALONG_OVERLAP = 0.35

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

const conventionSource = (p: string): boolean => p === 'ASSUMED_FOR_RENDERING' || p === 'UNRESOLVED'

/** One plan opening as a view measures it (null: nothing read there). */
export type MeasuredOpening = { opening: OpeningV2; reading: FacadeOpeningReading | null }

export function alignFacades(input: {
  openings: readonly OpeningV2[]
  views: readonly FacadeView[]
  /** Per view: each plan opening of its facade as the view measures it, and the openings its pixels show on their own. */
  read: ReadonlyMap<string, { measured: MeasuredOpening[]; candidates: FacadeOpeningReading[]; rejected: FacadeOpeningRejection[]; scanned?: FacadeOpeningReading[]; foreignShare?: (storeyIndex: number, from: number, to: number) => number | undefined }>
  levels: readonly LevelV2[]
  /** Why a facade has no registered view. */
  unregistered: ReadonlyArray<{ facade: Facade; why: string }>
}): FacadeAlignmentReport {
  const comparisons: FacadeOpeningComparison[] = []
  const corrections: OpeningCorrection[] = []
  const summaries: FacadeViewSummary[] = []
  const allReadings: FacadeOpeningReading[] = []
  const allRejected: FacadeOpeningRejection[] = []
  const opposite: Record<Facade, Facade> = { FRONT: 'REAR', REAR: 'FRONT', WEST: 'EAST', EAST: 'WEST' }
  const covered = new Set<Facade>()
  const modelOf = (o: OpeningV2): NonNullable<FacadeOpeningComparison['model']> => ({ from: o.interval[0], to: o.interval[1], widthM: o.widthM, sillY: o.sillY, headY: o.headY, source: { width: o.provenance.width, sill: o.provenance.sill, head: o.provenance.head } })
  const viewOf = (r: FacadeOpeningReading): NonNullable<FacadeOpeningComparison['view']> => ({ from: r.from, to: r.to, widthM: r.widthM, sillY: r.sillY, headY: r.headY, kind: r.kind, mullions: r.mullions.length, uncertaintyM: r.uncertaintyM, heightsTrusted: r.heightsTrusted })
  for (const fv of input.views) {
    // one view per facade: the best registered (the caller lists them best first)
    if (covered.has(fv.facade)) continue
    covered.add(fv.facade)
    const got = input.read.get(fv.frameId) ?? { measured: [], candidates: [], rejected: [] }
    const measuredReadings = got.measured.map((m) => m.reading).filter((r): r is FacadeOpeningReading => r !== null)
    allReadings.push(...measuredReadings, ...got.candidates)
    allRejected.push(...got.rejected)
    const before = comparisons.length
    for (const { opening: o, reading: r } of got.measured) {
      if (!r) {
        // the gap's middle, over the storey's band, is the wall's own materials and the plan-free scan finds nothing
        // there: the view draws plain wall where the plan has an opening — reported, never removed on the pixels' word
        const inset = Math.min(0.1, o.widthM / 4)
        const share = got.foreignShare?.(o.storeyIndex, o.interval[0] + inset, o.interval[1] - inset)
        const scannedThere = (got.scanned ?? []).some((x) => overlap(o.interval[0], o.interval[1], x.from, x.to) > 0)
        if (share !== undefined && share <= WALL_ONLY_SHARE && !scannedThere) comparisons.push({ facade: fv.facade, openingId: o.id, storeyIndex: o.storeyIndex, codes: ['EXTRA_IN_MODEL'], model: modelOf(o), note: `the view draws the wall's own materials across the plan's gap (${(share * 100).toFixed(1)} % of its pixels differ from the wall) and the plan-free scan finds no opening there: reported, the model is kept` })
        else comparisons.push({ facade: fv.facade, openingId: o.id, storeyIndex: o.storeyIndex, codes: [], model: modelOf(o), note: 'not read on the view: no opening stands out from the wall there in a way the readers accept (a recess in shadow, a member in front, glass the wall’s colour); neither confirmed nor contradicted' })
        continue
      }
      const delta = { centreM: round6((r.from + r.to) / 2 - (o.interval[0] + o.interval[1]) / 2), widthM: round6(r.widthM - o.widthM), sillM: round6(r.sillY - o.sillY), headM: round6(r.headY - o.headY) }
      const ta = round6(Math.max(CENTRE_TOL_M, r.uncertaintyM.along + o.uncertaintyM))
      const th = round6(Math.max(HEIGHT_TOL_M, r.uncertaintyM.height))
      const codes: AlignmentCode[] = []
      if (Math.abs(delta.centreM) > ta) codes.push('HORIZONTAL_OFFSET')
      if (Math.abs(delta.widthM) > Math.max(WIDTH_TOL_M, ta)) codes.push('WIDTH_MISMATCH')
      if (fv.heights && Math.abs(delta.sillM) > th) codes.push('SILL_MISMATCH')
      if (fv.heights && Math.abs(delta.headM) > th) codes.push('HEAD_MISMATCH')
      comparisons.push({ facade: fv.facade, openingId: o.id, readingId: r.id, storeyIndex: o.storeyIndex, codes, model: modelOf(o), view: viewOf(r), delta, tolerance: { alongM: ta, heightM: th } })
      // a printed height read two ways alike: the view's height picks the printed reading it fits, never its own value
      if (fv.heights && o.callout?.heightCandidates && !o.elevation && o.provenance.head === 'UNRESOLVED' && Math.abs(delta.sillM) <= th) {
        const cands = o.callout.heightCandidates
        const drawn = r.headY - r.sillY
        const top = cands[0]?.score ?? 0
        const fitting = cands.filter((c) => Math.abs(c.cm / 100 - drawn) <= HEIGHT_PICK_TOLERANCE_M && c.score >= top * HEIGHT_PICK_MIN_SCORE_SHARE)
        // the fitting readings must be one printed number read with a centimetre's jitter (224, 225, 229), not two
        // numbers; the best scored of them is the one taken — the view chooses the number, the score its digits
        const cms = fitting.map((c) => c.cm)
        const one = fitting.length > 0 && Math.max(...cms) - Math.min(...cms) < HEIGHT_RIVAL_MIN_CM
        const picks = one ? [fitting.reduce((b, c) => (c.score > b.score ? c : b), fitting[0]).cm] : []
        const level = input.levels.find((l) => l.index === o.storeyIndex)
        const head = picks.length === 1 ? round6(o.sillY + picks[0] / 100) : o.headY
        if (picks.length === 1 && Math.abs(o.callout.heightCm / 100 - drawn) > HEIGHT_AGREEMENT_M && Math.abs(picks[0] - o.callout.heightCm) >= HEIGHT_RIVAL_MIN_CM && head <= (level ? level.wallTop : Infinity) - 0.05) {
          corrections.push({ openingId: o.id, facade: fv.facade, property: 'head', before: o.headY, after: head, frameId: fv.frameId, readingId: r.id, provenance: 'SOURCE_CORROBORATED', calloutHeightCm: picks[0], why: `the printed height read ${o.callout.heightCm} or ${picks[0]} alike; on the ${fv.facade.toLowerCase()} view, registered on the ridge datum, the opening measures ${drawn.toFixed(2)} m tall at the plan's gap, which fits the printed ${picks[0]} only: head ${head.toFixed(2)} m` })
        } else comparisons[comparisons.length - 1].note = `the printed height reads two ways alike and the view's ${drawn.toFixed(2)} m does not pick exactly one of them: the model is kept`
        continue
      }
      // heights the model took by convention, from a view registered for heights; a printed or already read height stays
      if (!fv.heights || o.callout || o.elevation) continue
      const level = input.levels.find((l) => l.index === o.storeyIndex)
      const wallTop = level ? level.wallTop : Infinity
      const floor = level ? level.elevation : 0
      // a second, independent reading of the same opening — the plan-free scan — must agree within the tolerance
      const twin = (got.scanned ?? []).find((x) => overlap(o.interval[0], o.interval[1], x.from, x.to) > MIN_ALONG_OVERLAP * Math.min(o.widthM, x.widthM) && x.storeyIndex === o.storeyIndex)
      const agreesSill = !!twin && Math.abs(twin.sillY - r.sillY) <= th
      const agreesHead = !!twin && Math.abs(twin.headY - r.headY) <= th
      const sill = Math.abs(delta.sillM) > th && conventionSource(o.provenance.sill) && agreesSill ? round6((r.sillY + (twin as FacadeOpeningReading).sillY) / 2) : o.sillY
      const head = Math.abs(delta.headM) > th && conventionSource(o.provenance.head) && agreesHead ? round6((r.headY + (twin as FacadeOpeningReading).headY) / 2) : o.headY
      if ((Math.abs(delta.sillM) > th && conventionSource(o.provenance.sill) && !agreesSill) || (Math.abs(delta.headM) > th && conventionSource(o.provenance.head) && !agreesHead)) comparisons[comparisons.length - 1].note = `the view's heights differ from the model's convention, but the plan-free scan ${twin ? `reads ${twin.sillY.toFixed(2)}..${twin.headY.toFixed(2)} m` : 'reads nothing there'}: the two readings do not agree, the model is kept`
      if (sill === o.sillY && head === o.headY) continue
      // the result must be an opening its wall holds: above the floor, under the top of the wall, at least 0.4 m tall
      if (head - sill < 0.4 || sill < floor - 0.05 || head > wallTop - 0.05) {
        comparisons[comparisons.length - 1].note = `the view's heights ${r.sillY.toFixed(2)}..${r.headY.toFixed(2)} m do not fit the storey's wall (${floor.toFixed(2)}..${wallTop.toFixed(2)} m): kept as the model has it`
        continue
      }
      if (sill !== o.sillY) corrections.push({ openingId: o.id, facade: fv.facade, property: 'sill', before: o.sillY, after: round6(sill), frameId: fv.frameId, readingId: r.id, provenance: 'IMAGE_METRIC_REGISTERED', why: `the model's sill was a convention; on the ${fv.facade.toLowerCase()} view, registered on the ridge datum, the opening measured at the plan's gap and the plan-free scan agree on ${sill.toFixed(2)} m (±${th.toFixed(2)})` })
      if (head !== o.headY) corrections.push({ openingId: o.id, facade: fv.facade, property: 'head', before: o.headY, after: round6(head), frameId: fv.frameId, readingId: r.id, provenance: 'IMAGE_METRIC_REGISTERED', why: `the model's head was a convention; on the ${fv.facade.toLowerCase()} view, registered on the ridge datum, the opening measured at the plan's gap and the plan-free scan agree on ${head.toFixed(2)} m (±${th.toFixed(2)})` })
    }
    // the view's own openings that no plan opening of this facade stands at: missing in the model — or, on a side
    // view, perhaps the other side's
    const plan = input.openings.filter((o) => o.facade === fv.facade)
    const unclaimed = got.candidates.filter((c) => !plan.some((o) => overlap(o.interval[0], o.interval[1], c.from, c.to) > MIN_ALONG_OVERLAP * Math.min(o.widthM, c.widthM) && (c.storeyIndex === null || c.storeyIndex === o.storeyIndex)))
    for (const c of unclaimed) comparisons.push({ facade: fv.facade, readingId: c.id, storeyIndex: c.storeyIndex, codes: ['MISSING_IN_MODEL'], view: viewOf(c), note: 'the view draws an opening here; the plan has no gap: reported, not built (a wall the plan draws is not broken on a render’s word)' })
    if (fv.facade === 'WEST' || fv.facade === 'EAST') {
      const other = input.openings.filter((o) => o.facade === opposite[fv.facade])
      const here = got.candidates.length - unclaimed.length
      const there = got.candidates.filter((c) => other.some((o) => overlap(o.interval[0], o.interval[1], c.from, c.to) > MIN_ALONG_OVERLAP * Math.min(o.widthM, c.widthM))).length
      if (got.candidates.length >= 2 && there >= here + 2) comparisons.push({ facade: fv.facade, storeyIndex: null, codes: ['WRONG_FACADE'], note: `${fv.frameId}: ${there} of its ${got.candidates.length} openings stand where the ${opposite[fv.facade].toLowerCase()} wall's openings are, ${here} where this wall's are: the view is likely the other side` })
    }
    const mine = comparisons.slice(before)
    const issues = mine.filter((c) => c.codes.length > 0).length
    const read = got.measured.filter((m) => m.reading).length
    const a0 = fv.view.alongOf(0)
    const a1 = fv.view.alongOf(1000)
    const projection = { mpp: round6(Math.abs(a1 - a0) / 1000), alongAtPx0: a0, alongSign: (a1 >= a0 ? 1 : -1) as 1 | -1, zeroRow: fv.view.pyOf(0) }
    summaries.push({ facade: fv.facade, frameId: fv.frameId, registration: fv.registration, heights: fv.heights, alongErrorM: fv.alongErrorM, heightErrorM: fv.heightErrorM, projection, readings: read + got.candidates.length, rejected: got.rejected.length, matched: read, verdict: read === 0 && got.candidates.length === 0 ? 'NO_READINGS' : issues === 0 ? 'AGREES' : read >= issues ? 'MIXED' : 'DISAGREES' })
  }
  for (const u of input.unregistered) {
    if (covered.has(u.facade)) continue
    for (const o of input.openings.filter((x) => x.facade === u.facade)) comparisons.push({ facade: u.facade, openingId: o.id, storeyIndex: o.storeyIndex, codes: ['UNREGISTERED_VIEW'], model: modelOf(o), note: u.why })
  }
  const counts = { MATCHED: 0, MISSING_IN_MODEL: 0, EXTRA_IN_MODEL: 0, HORIZONTAL_OFFSET: 0, WIDTH_MISMATCH: 0, SILL_MISMATCH: 0, HEAD_MISMATCH: 0, WRONG_FACADE: 0, WRONG_STOREY: 0, UNREGISTERED_VIEW: 0 } as FacadeAlignmentReport['counts']
  for (const c of comparisons) {
    if (c.openingId && c.readingId) counts.MATCHED += 1
    for (const code of c.codes) counts[code] += 1
  }
  return { views: summaries, readings: allReadings, rejected: allRejected, comparisons, corrections, unregistered: [...input.unregistered].filter((u) => !covered.has(u.facade)), counts }
}

/** The openings with the corrections applied, each property's provenance saying where it now comes from. */
export function applyOpeningCorrections(openings: readonly OpeningV2[], corrections: readonly OpeningCorrection[]): OpeningV2[] {
  return openings.map((o) => {
    const mine = corrections.filter((c) => c.openingId === o.id)
    if (mine.length === 0) return o
    const sill = mine.find((c) => c.property === 'sill')
    const head = mine.find((c) => c.property === 'head')
    return {
      ...o,
      ...(sill ? { sillY: sill.after } : {}),
      ...(head ? { headY: head.after, ...(o.headFarY !== undefined && o.profile !== 'RAKED_SINGLE' ? { headFarY: head.after } : {}) } : {}),
      ...(head?.calloutHeightCm !== undefined && o.callout ? { callout: { ...o.callout, heightCm: head.calloutHeightCm, resolvedBy: `${o.callout.resolvedBy ? `${o.callout.resolvedBy}; ` : ''}N7-P2: the ${head.facade.toLowerCase()} view picked the height reading ${head.calloutHeightCm} over ${o.callout.heightCm}` } } : {}),
      provenance: { ...o.provenance, ...(sill ? { sill: sill.provenance } : {}), ...(head ? { head: head.provenance } : {}) },
      ...(head?.calloutHeightCm !== undefined ? { unresolved: o.unresolved.filter((u) => !u.startsWith('the printed height reads')) } : {}),
      why: `${o.why}; N7-P2: ${mine.map((c) => `${c.property} ${c.before.toFixed(2)} → ${c.after.toFixed(2)} m from ${c.readingId}`).join(', ')}`,
    }
  })
}
