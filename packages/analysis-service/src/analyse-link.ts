/**
 * v3.53 — one entry for a link: the drawings' path, and where its answer leaves the house unread or weakly read, the
 * described path (`described.ts`) — when the host has a house reader. Without a reader this is `runAnalysis` exactly:
 * the same result or the same refusal, byte for byte.
 *
 * The drawings are read FIRST: what they measure is the strongest thing a page gives. The description is asked for
 *  - after a refusal that leaves the page's pictures unread (no plan found, no walled outline, no scale, an
 *    inconclusive or rejected layout, a model the validator refused) — never after a cancelled or failed fetch;
 *  - after a model that is weak by its own account (`drawingsWeaknesses`): no metric anchor at all, a partial model,
 *    a body the model lost, no roof built. A verified scale or a measured height says the SIZE is right; it does not
 *    say the roof, the garage or the openings are, so an anchor alone does not close the question.
 * It is NOT asked for after a complete drawings model with none of those weaknesses: most houses of the corpus, and
 * the reason a reader is not paid for on every link.
 *
 * What the drawings measured is kept: a footprint at a verified scale and a measured storey height go to the described
 * model as anchors (`DescribedAnchors`) — the description gives the architecture, the drawings the measures — and the
 * drawings' own model stays beside the result as the alternative. If the description is refused, the drawings'
 * answer (model or refusal) is the run's answer, with the description's refusal attached for the diagnostics.
 *
 * Cost, stated: the described path starts only after the whole drawings' path has run. Its weaknesses cannot be known
 * sooner without reading every house twice.
 */
import type { HouseDescription, StructuredVision } from '@buildapp/source-vision'
import { AnalysisError } from './errors.js'
import { identityOf } from './identity.js'
import { DescribedRefusal, runDescribedAnalysis } from './described.js'
import type { DescribedProgress, DescribedRun, DescribingEvent, ReadHooks } from './described.js'
import { AXIS_AGREEMENT } from '@buildapp/reconstruction'
import type { DescribedAnchors } from '@buildapp/reconstruction'
import { runAnalysis } from './run.js'
import type { AnalysisInput, AnalysisOptions, AnalysisRun } from './run.js'
import { ANALYSIS_STAGES, RUNNING_PROGRESS_CAP, progressEvent } from './stages.js'
import type { SourcePackage } from '@buildapp/source-package'
import type { LinkAnalysisSummary } from './result.js'
import type { AnalysisProgress } from './stages.js'

/** v3.54.1: where a complete drawings model was read as well (`readEveryModel`), what the reading decided and why. */
export type DescriptionCheck = { decision: 'DRAWINGS_KEPT' | 'DESCRIPTION_PREFERRED' | 'DESCRIPTION_REFUSED'; why: string }
export type DrawingsRun = AnalysisRun & { basis: 'DRAWINGS'; descriptionCheck?: DescriptionCheck }
export type LinkAnalysis = DrawingsRun | (DescribedRun & { /** The drawings' own model, where it built one the description was preferred to. */ alternative?: AnalysisRun; descriptionCheck?: DescriptionCheck })

/**
 * A drawings model in which nothing metric rests on a printed dimension: its scale is not verified by the drawing's
 * own dimensions AND its storey heights are a convention. Measured on 1327: all three such models on other publishers'
 * pages were unrecognisable (flat boxes, two 18 m towers) where the description of the same page was not; in the
 * 33-project corpus 1 of 28 models is of this kind.
 */
export const drawingsModelUnanchored = (result: Pick<LinkAnalysisSummary, 'preview'>): boolean => {
  const codes = new Set(result.preview.provisional.map((p) => p.code))
  return codes.has('SCALE_NOT_VERIFIED') && codes.has('HEIGHT_ASSUMED_FOR_PREVIEW')
}

/** Why a drawings model, by its own account, does not settle what the house is. Each is read off the result. */
export type DrawingsWeakness = 'NO_METRIC_ANCHOR' | 'PARTIAL_MODEL' | 'BODY_MISSING' | 'NO_ROOF_BUILT'

/**
 * The weaknesses of a drawings model, from its own result — no picture is looked at and no reader is asked:
 *  - NO_METRIC_ANCHOR: neither a verified scale nor a measured height;
 *  - PARTIAL_MODEL: the model is the last valid part of the reading, not the whole of it;
 *  - BODY_MISSING: a body the decomposition found is not in the model, or the layout left a blocking question open;
 *  - NO_ROOF_BUILT: walls with no roof of any kind over them — neither a plate nor a plane.
 * A model with none of these is the run's answer even where a reader is at hand.
 */
export function drawingsWeaknesses(result: Pick<LinkAnalysisSummary, 'preview' | 'warningDetails'>): DrawingsWeakness[] {
  const out: DrawingsWeakness[] = []
  const warned = new Set(result.warningDetails.map((w) => w.code))
  if (drawingsModelUnanchored(result)) out.push('NO_METRIC_ANCHOR')
  if (result.preview.outcome === 'PARTIAL_3D_PREVIEW') out.push('PARTIAL_MODEL')
  if (warned.has('BODY_MISSING_FROM_MODEL') || warned.has('LAYOUT_BLOCKING_UNRESOLVED')) out.push('BODY_MISSING')
  // `roofs` are the flat plates and `roofPlanes` the pitched planes: a house roofed in planes alone has no `roofs`
  if (result.preview.built.walls > 0 && result.preview.built.roofs === 0 && result.preview.built.roofPlanes === 0) out.push('NO_ROOF_BUILT')
  return out
}

/**
 * What a drawings run measured, as anchors for a description of the same page — each with what it measures and what
 * it rests on (v3.53.2). Nothing metric is exported where the plan's scale is not verified by its own dimensions.
 *
 *  - The WHOLE outline: the selected plan's extent where its overall dimension lines frame it on both axes — a fact
 *    of the house, whether or not the model built all of it; else, only for a model that is the whole reading, the
 *    extent of the walls it placed. A partial model's built extent is never the whole: a verified scale says the
 *    part is that big, not that the part is the house.
 *  - Each BODY it placed, as a measure of that body alone.
 *  - A storey height, where the drawings placed two floors (floor to floor; v3.54.1).
 */
export function anchorsOfDrawings(run: Pick<AnalysisRun, 'result' | 'reconstruction' | 'planDiagnostics'>): DescribedAnchors {
  const codes = new Set(run.result.preview.provisional.map((p) => p.code))
  const weak = drawingsWeaknesses(run.result)
  const partial = weak.includes('PARTIAL_MODEL') || weak.includes('BODY_MISSING')
  const out: DescribedAnchors = {}
  const masses = run.reconstruction.building.masses
  if (!codes.has('SCALE_NOT_VERIFIED')) {
    const plan = run.planDiagnostics?.plans.find((p) => p.frameId === run.planDiagnostics.selectedPlanFrameId)
    const framed = !!plan && !!plan.scale && !plan.extentWeak && plan.extentProvenance?.x === 'DIMENSION_CHAIN_EXTENT' && plan.extentProvenance?.y === 'DIMENSION_CHAIN_EXTENT'
    if (plan && plan.scale && framed) {
      const w = (plan.extent.x1 - plan.extent.x0) * plan.scale.mppX
      const d = (plan.extent.y1 - plan.extent.y0) * plan.scale.mppY
      if (w > 2 && d > 2) out.overall = { widthM: Number(w.toFixed(3)), depthM: Number(d.toFixed(3)), premise: 'OVERALL_DIMENSION_LINES', why: `the plan's overall dimension lines give the building ${w.toFixed(2)} × ${d.toFixed(2)} m` }
    }
    if (!out.overall && !partial && masses.length > 0) {
      const w = Math.max(...masses.map((m) => m.x1)) - Math.min(...masses.map((m) => m.x0))
      const d = Math.max(...masses.map((m) => m.z1)) - Math.min(...masses.map((m) => m.z0))
      if (w > 2 && d > 2) out.overall = { widthM: Number(w.toFixed(3)), depthM: Number(d.toFixed(3)), premise: 'COMPLETE_OUTLINE', why: `the walls the drawings place at a verified scale span ${w.toFixed(2)} × ${d.toFixed(2)} m` }
    }
    const bodies = masses.filter((m) => m.x1 - m.x0 > 1.5 && m.z1 - m.z0 > 1.5).map((m) => ({ role: m.role, widthM: Number((m.x1 - m.x0).toFixed(3)), depthM: Number((m.z1 - m.z0).toFixed(3)), why: `the drawings place ${m.role === 'MAIN' ? 'the main body' : 'an attached body'} at a verified scale as ${(m.x1 - m.x0).toFixed(2)} × ${(m.z1 - m.z0).toFixed(2)} m` }))
    if (bodies.length > 0) out.bodies = bodies
    if (partial) out.partial = true
  }
  // v3.54.1: a storey height is a floor-to-floor measure — between two floors the drawings placed. The only level of a
  // one-storey model is as tall as its section reads it (to the eaves, or to the ridge of a vaulted room): that is not
  // the height of a storey, and a description built on it would be stretched to it.
  const [ground, above] = [...run.reconstruction.building.levels].sort((a, b) => a.index - b.index)
  const floorToFloor = ground && above ? above.elevation - ground.elevation : undefined
  if (!codes.has('HEIGHT_ASSUMED_FOR_PREVIEW') && floorToFloor !== undefined && floorToFloor > 2) out.storeyHeightM = { value: Number(floorToFloor.toFixed(3)), why: `the drawings place the next floor ${floorToFloor.toFixed(2)} m above the ground floor` }
  return out
}

/**
 * v3.54.1 — does the description show a drawings model that is complete by its own account to be SHORT of the house?
 * Per axis: the reader read the overall size printed on a drawing, and that size exceeds the whole outline the
 * drawings measured by more than `AXIS_AGREEMENT` — the drawings' walls do not reach a length printed for the house.
 * A size the reader scaled, estimated or took from the page's figures is no such evidence; neither is a printed size
 * shorter than the drawings' outline (that one is refuted by the walls, `perAxisFromWalls`). Which measured axis is
 * which described axis must be plain (one pairing within 15 % on both axes, the other beyond 25 % on one).
 */
export function descriptionExceedsDrawings(anchors: DescribedAnchors, description: Pick<HouseDescription, 'overall'>): { exceeds: boolean; why: string } {
  const whole = anchors.overall
  const o = description.overall
  if (!whole) return { exceeds: false, why: 'the drawings measured no whole outline to hold the description against' }
  if (o.basis !== 'PRINTED_ON_DRAWING') return { exceeds: false, why: `the description's overall size is ${o.basis.toLowerCase().replace(/_/g, ' ')}, not read printed on a drawing` }
  const off = (a: number, b: number): number => Math.abs(a / b - 1)
  const direct = Math.max(off(o.widthM, whole.widthM), off(o.depthM, whole.depthM))
  const swapped = Math.max(off(o.widthM, whole.depthM), off(o.depthM, whole.widthM))
  const pairs = direct <= 0.15 && swapped > 0.25 ? [[o.widthM, whole.widthM], [o.depthM, whole.depthM]] : swapped <= 0.15 && direct > 0.25 ? [[o.widthM, whole.depthM], [o.depthM, whole.widthM]] : undefined
  if (!pairs) return { exceeds: false, why: `${o.widthM} × ${o.depthM} m printed and ${whole.widthM} × ${whole.depthM} m measured cannot be paired axis by axis` }
  const over = pairs.filter(([printed, measured]) => printed > measured * (1 + AXIS_AGREEMENT))
  if (over.length === 0) return { exceeds: false, why: `the printed ${o.widthM} × ${o.depthM} m does not exceed the measured ${whole.widthM} × ${whole.depthM} m` }
  return { exceeds: true, why: over.map(([printed, measured]) => `${printed} m is printed where the drawings' outline reaches ${measured.toFixed(2)} m`).join('; ') }
}

/** The drawings-path refusals after which the page's pictures are still worth reading as a whole. */
export const DESCRIBABLE_AFTER: ReadonlySet<string> = new Set(['RECONSTRUCTION_FAILED', 'NO_DRAWINGS', 'SOURCE_INCOMPLETE'])

/**
 * What follows a drawings model: nothing (null) where it has no weakness of its own account, else the description —
 * with the reason it is asked for and the measures of the drawings it must keep.
 */
export function describedFollowUp(run: Pick<AnalysisRun, 'result' | 'reconstruction' | 'planDiagnostics'>): { after: { code: string; reasonCode: string }; weaknesses: DrawingsWeakness[]; anchors: DescribedAnchors } | null {
  const weaknesses = drawingsWeaknesses(run.result)
  if (weaknesses.length === 0) return null
  return { after: { code: weaknesses.includes('NO_METRIC_ANCHOR') ? 'DRAWINGS_MODEL_UNANCHORED' : 'DRAWINGS_MODEL_WEAK', reasonCode: weaknesses.join('+') }, weaknesses, anchors: anchorsOfDrawings(run) }
}

export type LinkAnalysisOptions = AnalysisOptions & {
  /** The house reader of this host (a key on the host, a fixture in tests). Absent: the drawings' path alone. */
  houseReader?: StructuredVision
  /** What the described path is doing and which pictures it is interpreting, as it goes (`DescribingEvent`). */
  onDescribing?: (event: DescribingEvent) => void
  /** The pictures sent to the reader, with their bytes: for a host that keeps them beside the job. */
  onPictures?: ReadHooks['onPictures']
  /**
   * v3.54.1: read the page as a whole after a drawings model that is complete by its own account as well, and prefer
   * the description only where it shows that model short of the house (`descriptionExceedsDrawings`). Costs one
   * reading on every link a reader is allowed on; off, a complete drawings model is the answer unread, as before.
   */
  readEveryModel?: boolean
}

/**
 * The share of a run's progress the drawings' path may use when a reader is at hand. A run that goes on to describe
 * the house has the rest for it; one that does not jumps from here to done. Without a reader the drawings' path has
 * the whole scale, as before.
 */
export const DRAWINGS_PROGRESS_SHARE = 0.7

export async function analyseLink(input: AnalysisInput, options: LinkAnalysisOptions): Promise<LinkAnalysis> {
  const reader = options.houseReader
  const mayDescribe = !!reader && reader.available()
  // One scale for the run, never moving back; and a stage that never moves back either: the described path's steps
  // are reported under the latest stage the run has reached, with what they really are in the detail and the event.
  let last = 0
  let lastStage = 0
  const emit = (event: AnalysisProgress): void => {
    lastStage = Math.max(lastStage, event.stageIndex)
    last = Math.max(last, event.progress)
    options.progress?.({ ...event, progress: last })
  }
  const fromDrawings = (event: AnalysisProgress): void => emit(mayDescribe ? { ...event, progress: Number((event.progress * DRAWINGS_PROGRESS_SHARE).toFixed(4)) } : event)
  const fromDescribing = (p: DescribedProgress): void => {
    const stage = ANALYSIS_STAGES[Math.max(lastStage, ANALYSIS_STAGES.indexOf(p.stage))]
    const base = progressEvent(stage, 0, `described: ${p.detail}`)
    emit({ ...base, stageFraction: p.fraction, progress: Number(Math.min(RUNNING_PROGRESS_CAP, DRAWINGS_PROGRESS_SHARE + p.fraction * (RUNNING_PROGRESS_CAP - DRAWINGS_PROGRESS_SHARE)).toFixed(4)) })
  }
  const describe = async (pkg: SourcePackage, after: { code: string; reasonCode: string | null }, anchors?: DescribedAnchors): Promise<DescribedRun> =>
    runDescribedAnalysis({
      pkg,
      cache: options.cache,
      reader: reader as StructuredVision,
      identity: { ...identityOf(pkg, options.adapters), ...options.identity },
      sourceUrl: input.kind === 'URL' ? input.url : pkg.canonicalUrl,
      jobId: options.jobId ?? null,
      after,
      ...(anchors && (anchors.overall || anchors.bodies || anchors.storeyHeightM) ? { anchors } : {}),
      ...(options.now ? { now: options.now } : {}),
      ...(options.clock ? { clock: options.clock } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      onProgress: fromDescribing,
      ...(options.onDescribing ? { onDescribing: options.onDescribing } : {}),
      ...(options.onPictures ? { onPictures: options.onPictures } : {}),
    })
  try {
    const run = await runAnalysis(input, { ...options, ...(options.progress ? { progress: fromDrawings } : {}) })
    const next = describedFollowUp(run)
    if (reader && reader.available() && !next && options.readEveryModel && !options.signal?.aborted) {
      // complete by its own account: read all the same, and the drawings' model stays the answer unless the reading
      // shows it short of the house — on the drawings' measures, axis by axis
      const anchors = anchorsOfDrawings(run)
      try {
        const described = await describe(run.pkg, { code: 'DRAWINGS_MODEL_CHECKED', reasonCode: 'READ_EVERY_MODEL' }, anchors)
        const check = descriptionExceedsDrawings(anchors, described.reading.description)
        if (check.exceeds) return { ...described, alternative: run, descriptionCheck: { decision: 'DESCRIPTION_PREFERRED', why: check.why } }
        return { basis: 'DRAWINGS', ...run, descriptionCheck: { decision: 'DRAWINGS_KEPT', why: check.why } }
      } catch (e) {
        if (options.signal?.aborted) throw e
        return { basis: 'DRAWINGS', ...run, descriptionCheck: { decision: 'DESCRIPTION_REFUSED', why: e instanceof DescribedRefusal ? `${e.code}: ${e.message.slice(0, 200)}` : String((e as Error)?.message ?? e).slice(0, 200) } }
      }
    }
    if (reader && reader.available() && next && !options.signal?.aborted) {
      // weak by its own account: the page read as a whole is asked for, on the measures the drawings do give, and the
      // drawings' model is kept beside it; if the description is refused, the drawings' model is the answer
      try {
        return { ...(await describe(run.pkg, next.after, next.anchors)), alternative: run }
      } catch (e) {
        if (options.signal?.aborted) throw e
      }
    }
    return { basis: 'DRAWINGS', ...run }
  } catch (first) {
    const e = first instanceof AnalysisError ? first : undefined
    const pkg = e?.attachments?.pkg
    if (!e || !reader || !reader.available() || !pkg || !DESCRIBABLE_AFTER.has(e.code) || options.signal?.aborted) throw first
    try {
      return await describe(pkg, { code: e.code, reasonCode: e.detail.reasonCode ?? null })
    } catch (second) {
      if (options.signal?.aborted) throw second
      // the drawings' refusal is the run's answer; why the description did not stand in for it goes with it
      e.attachments = { ...e.attachments, described: second instanceof DescribedRefusal ? { code: second.code, message: second.message.slice(0, 300) } : { code: 'DESCRIBED_FAILED', message: String((second as Error)?.message ?? second).slice(0, 300) } }
      throw first
    }
  }
}
