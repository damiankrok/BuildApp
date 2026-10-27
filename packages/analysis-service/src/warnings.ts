/**
 * What a finished run warns about, and which of those warnings limit the result.
 *
 * A warning used to be a sentence, and the phone called a result "limited" on
 * the count of sentences. Some sentences are information about how the run
 * worked, not about the house:
 *
 *   - no vision provider ran: every run on a phone is deterministic by design;
 *   - a guessed larger copy of a drawing does not exist: a guess (channel
 *     `VARIANT_CONVENTION`) that 404s leaves the copy it was derived from in hand.
 *     Only a definite absence counts (404, 410, or an offline replay that never
 *     had the bytes): a guess that timed out or got a 503 may exist, and the
 *     larger copy it names was not read, so that one limits;
 *   - one image published at two addresses was counted once.
 *
 * Calling a result "limited" for those taught the person to ignore the word.
 * So each warning carries a code and a severity:
 *
 *   - `INFO` — nothing about the house is missing or unchecked;
 *   - `LIMITING` — a drawing the page exposed was not read, a source-view check
 *     failed, a joint is open, an invariant does not hold, the layout gate
 *     passed the building with a degrading reason (it was taken from another
 *     reading of the plan, it lands 6–20 % off the published footprint, two
 *     sources disagree…), or an opening the drawings print was not built.
 *
 * The layout gate already sorts its reasons; every DEGRADING one is passed on
 * as it is, never picked by code, so a new reason cannot be informational by
 * omission.
 *
 * The rule looks only at the kind of loss (channel, code), never at a project.
 * When the kind is unknown, the warning is LIMITING: calling a real loss
 * informational would be the worse mistake.
 */
import type { AcquisitionFailure } from '@buildapp/source-package'
import type { VisionMode } from './result.js'

export type WarningSeverity = 'INFO' | 'LIMITING'

export type AnalysisWarning = {
  code: string
  severity: WarningSeverity
  message: string
}

/** Acquisition failure codes that lose nothing: the same bytes, or the same drawing kept as its own asset. */
const NOTHING_LOST = new Set(['BYTE_IDENTICAL', 'DIFFERENT_CROP'])

/** A guessed address: derived from a copy already in hand by the publisher's naming convention. */
const GUESS_CHANNEL = 'VARIANT_CONVENTION'

/** The address does not exist, as far as anyone can tell: not a server that was busy or slow. */
const definitelyAbsent = (f: AcquisitionFailure): boolean => (f.code === 'HTTP_STATUS' && (f.status === 404 || f.status === 410)) || f.code === 'OFFLINE_CACHE_MISS'

export type WarningInputs = {
  visionMode: VisionMode
  failures: readonly AcquisitionFailure[]
  residuals: number
  residualsOutside: number
  exteriorJointErrors: number
  graphViolations: number
  ledgerViolations: number
  /** The layout gate's reasons on the building that was sealed. */
  layoutReasons?: ReadonlyArray<{ code: string; severity: 'NOTED' | 'DEGRADING' | 'BLOCKING'; what: string }>
  /** Openings the model could not take as printed; only the ones not built at all limit. */
  openingFits?: ReadonlyArray<{ openingId: string; action: string; why: string }>
  /** 005B: the base plan's independent metric solution. A scale one reading states, or none states, limits. */
  metric?: { confidence: string; relation: string; independentWitnesses: number; isotropy: string }
  /** 005B: the base plan's frame was supplied by its walls, not by its dimension chains. */
  extentWeak?: boolean
  /** 005T-N3: the main roof's ridge was not printed and was taken approximately for rendering. */
  approximateRoofDatum?: { ridgeY: number; buildingHeightM: number }
  /** N7-P1: the model is the last valid one before a refusal: the refused object, and how many objects are not built. */
  partialPreview?: { failure: { type: string; id?: string; codes: readonly string[] }; missing: number; basis: string; missingBodies?: readonly string[] }
  /** N7-P1: no section printed the storey levels; every storey is a convention for viewing. */
  heightAssumedM?: number
  /** 005Y-N7 (A): walls reconciled as overlapping; a partition left out makes the model a partial preview. */
  wallReconciliation?: { mode: string; toleranceM: number; records: ReadonlyArray<{ wallId: string; otherWallId: string; action: string; moveM: number }>; omittedWalls: readonly string[]; dependents: ReadonlyArray<unknown> }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const words = (code: string): string => code.toLowerCase().replace(/_/g, ' ')

/** The run's warnings, in a stable order: how it ran, what it did not read, what did not check out. */
export function warningsOf(input: WarningInputs): AnalysisWarning[] {
  const out: AnalysisWarning[] = []
  if (input.visionMode === 'REPLAYED_GRAPH') out.push({ code: 'GRAPH_REPLAYED', severity: 'INFO', message: 'the observation graph was replayed from a sealed run' })
  else if (input.visionMode !== 'LIVE_PROVIDER') out.push({ code: 'DETERMINISTIC_ONLY', severity: 'INFO', message: 'no vision provider ran; every observation is from the deterministic analyzer' })

  // Grouped by what was lost, so three 404s on guesses are one line and a lost floor plan is another.
  const groups = new Map<string, { kind: 'GUESS' | 'GUESS_UNREAD' | 'DUPLICATE' | 'EXPOSED'; code: string; n: number }>()
  for (const f of input.failures) {
    const kind = NOTHING_LOST.has(f.code) ? 'DUPLICATE' : f.claim?.channel === GUESS_CHANNEL ? (definitelyAbsent(f) ? 'GUESS' : 'GUESS_UNREAD') : 'EXPOSED'
    const key = `${kind}|${f.code}`
    const g = groups.get(key)
    if (g) g.n += 1
    else groups.set(key, { kind, code: f.code, n: 1 })
  }
  for (const [, g] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (g.kind === 'DUPLICATE') {
      out.push({ code: `SOURCE_${g.code}`, severity: 'INFO', message: `${plural(g.n, 'source address', 'source addresses')} counted with another copy (${words(g.code)})` })
    } else if (g.kind === 'GUESS') {
      out.push({ code: `GUESSED_ADDRESS_${g.code}`, severity: 'INFO', message: `${plural(g.n, 'guessed larger copy', 'guessed larger copies')} not available (${words(g.code)}); the published copy was used` })
    } else if (g.kind === 'GUESS_UNREAD') {
      out.push({ code: `GUESSED_ADDRESS_UNREAD_${g.code}`, severity: 'LIMITING', message: `${plural(g.n, 'guessed larger copy', 'guessed larger copies')} could not be read (${words(g.code)}) and may exist; the published copy was used` })
    } else {
      out.push({ code: `SOURCE_ADDRESS_${g.code}`, severity: 'LIMITING', message: `${plural(g.n, 'source address', 'source addresses')} not used (${words(g.code)})` })
    }
  }

  for (const r of input.layoutReasons ?? []) {
    if (r.severity !== 'NOTED') out.push({ code: `LAYOUT_${r.code}`, severity: 'LIMITING', message: r.what })
  }
  const notBuilt = (input.openingFits ?? []).filter((f) => f.action === 'DROPPED')
  if (notBuilt.length > 0) out.push({ code: 'OPENINGS_NOT_BUILT', severity: 'LIMITING', message: `${plural(notBuilt.length, 'opening the drawings print was', 'openings the drawings print were')} not built: ${notBuilt.map((f) => f.openingId).join(', ')}` })

  out.push(...wallReconciliationWarnings(input.wallReconciliation))
  if (input.partialPreview) {
    const p = input.partialPreview
    // N7-COUNCIL-FIX-03: a body the plan draws and the model does not build is said as such, not as a refused command
    if (p.missingBodies && p.missingBodies.length > 0) out.push({ code: 'BODY_MISSING_FROM_MODEL', severity: 'LIMITING', message: `partial 3D preview, not a complete reconstruction: ${plural(p.missingBodies.length, 'body the plan draws walled is', 'bodies the plan draws walled are')} not in the model (${p.missingBodies.join(', ')}); everything built is kept` })
    if (!p.failure.codes.includes('BODY_MISSING_FROM_MODEL')) out.push({ code: 'PARTIAL_3D_PREVIEW', severity: 'LIMITING', message: `partial 3D preview, not a complete reconstruction: the model refused ${p.failure.type}${p.failure.id ? ` ${p.failure.id}` : ''} (${p.failure.codes.join(', ')}); ${p.basis === 'MINIMAL_BASE' ? 'only the main body\u2019s floors and walls are built' : `${plural(p.missing, 'object is', 'objects are')} not built, everything accepted before it is kept`}` })
  }
  if (input.heightAssumedM !== undefined)
    out.push({ code: 'HEIGHT_ASSUMED_FOR_PREVIEW', severity: 'LIMITING', message: `no section prints the storey levels: every storey is drawn ${input.heightAssumedM.toFixed(2)} m tall, for viewing only` })

  if (input.metric?.confidence === 'WEAK')
    out.push({ code: 'METRIC_SCALE_WEAK', severity: 'LIMITING', message: `the plan's scale rests on ${plural(input.metric.independentWitnesses, 'printed dimension', 'printed dimensions')} read as printed and nothing independent confirms it` })
  else if (input.metric?.confidence === 'INCONCLUSIVE')
    out.push({ code: 'METRIC_SCALE_UNSUPPORTED', severity: 'LIMITING', message: 'no printed dimension read as printed supports the plan\u2019s scale: every value that agrees with it was fitted to it' })
  if (input.extentWeak)
    out.push({ code: 'PLAN_EXTENT_FROM_WALLS', severity: 'LIMITING', message: 'the plan\u2019s extent was taken from its walls: its dimension chains describe only part of it' })
  if (input.approximateRoofDatum)
    out.push({ code: 'APPROXIMATE_ROOF_DATUM', severity: 'LIMITING', message: `no section prints the ridge: the roof is drawn at an approximate ${input.approximateRoofDatum.ridgeY.toFixed(2)} m from the printed knee wall and pitch, checked against the published ${input.approximateRoofDatum.buildingHeightM.toFixed(2)} m building height; its heights, and the chimney's, are for viewing only` })
  if (input.residualsOutside > 0) out.push({ code: 'RESIDUALS_OUTSIDE_TOLERANCE', severity: 'LIMITING', message: `${input.residualsOutside} of ${input.residuals} source-view checks outside tolerance` })
  if (input.exteriorJointErrors > 0) out.push({ code: 'EXTERIOR_JOINTS', severity: 'LIMITING', message: `${plural(input.exteriorJointErrors, 'exterior joint finding', 'exterior joint findings')} in the closure audit` })
  if (input.graphViolations + input.ledgerViolations > 0) {
    out.push({ code: 'INVARIANT_VIOLATIONS', severity: 'LIMITING', message: `${input.graphViolations} feature-graph and ${input.ledgerViolations} ledger invariant violations` })
  }
  return out
}

/** 005Y-N7 (A): a model built with walls moved to fit, or without a partition the source could not place. */
function wallReconciliationWarnings(w: WarningInputs['wallReconciliation']): AnalysisWarning[] {
  if (!w || w.mode === 'REFUSED') return []
  const out: AnalysisWarning[] = []
  const moved = w.records.filter((r) => r.action !== 'OMITTED' && r.action !== 'REFUSED')
  if (moved.length > 0) {
    const largest = Math.max(...moved.map((r) => r.moveM))
    out.push({ code: 'PREVIEW_WITH_ADJUSTMENTS', severity: 'LIMITING', message: `${plural(moved.length, 'wall was', 'walls were')} moved to stop overlapping another (largest move ${(largest * 100).toFixed(1)} cm, within the plan's ${(w.toleranceM * 100).toFixed(1)} cm uncertainty, or a duplicate read of the same wall): ${moved.map((r) => r.wallId).join(', ')}` })
  }
  if (w.mode === 'PARTIAL_SOURCE_GROUNDED') {
    const walls = w.omittedWalls.length > 0 ? `${plural(w.omittedWalls.length, 'partition', 'partitions')} the drawings could not place without crossing another wall (${w.omittedWalls.join(', ')})` : ''
    const parts = w.dependents.length > 0 ? `${plural(w.dependents.length, 'object', 'objects')} that needed a wall left out or moved` : ''
    out.push({ code: 'PARTIAL_SOURCE_GROUNDED', severity: 'LIMITING', message: `partial preview: ${[walls, parts].filter((x) => x).join(' and ')} ${w.omittedWalls.length + w.dependents.length === 1 ? 'is' : 'are'} not built; everything else is as the drawings give it` })
  }
  return out
}
