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
import type { StructuredVision } from '@buildapp/source-vision'
import { AnalysisError } from './errors.js'
import { identityOf } from './identity.js'
import { DescribedRefusal, runDescribedAnalysis } from './described.js'
import type { DescribedProgress, DescribedRun, DescribingEvent, ReadHooks } from './described.js'
import type { DescribedAnchors } from '@buildapp/reconstruction'
import { runAnalysis } from './run.js'
import type { AnalysisInput, AnalysisOptions, AnalysisRun } from './run.js'
import { ANALYSIS_STAGES, RUNNING_PROGRESS_CAP, progressEvent } from './stages.js'
import type { SourcePackage } from '@buildapp/source-package'
import type { LinkAnalysisSummary } from './result.js'
import type { AnalysisProgress } from './stages.js'

export type DrawingsRun = AnalysisRun & { basis: 'DRAWINGS' }
export type LinkAnalysis = DrawingsRun | (DescribedRun & { /** The drawings' own model, where it built one the description was preferred to. */ alternative?: AnalysisRun })

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
 *  - NO_ROOF_BUILT: walls with no roof of any kind over them.
 * A model with none of these is the run's answer even where a reader is at hand.
 */
export function drawingsWeaknesses(result: Pick<LinkAnalysisSummary, 'preview' | 'warningDetails'>): DrawingsWeakness[] {
  const out: DrawingsWeakness[] = []
  const warned = new Set(result.warningDetails.map((w) => w.code))
  if (drawingsModelUnanchored(result)) out.push('NO_METRIC_ANCHOR')
  if (result.preview.outcome === 'PARTIAL_3D_PREVIEW') out.push('PARTIAL_MODEL')
  if (warned.has('BODY_MISSING_FROM_MODEL') || warned.has('LAYOUT_BLOCKING_UNRESOLVED')) out.push('BODY_MISSING')
  if (result.preview.built.walls > 0 && result.preview.built.roofs === 0) out.push('NO_ROOF_BUILT')
  return out
}

/**
 * What a drawings run measured, as anchors for a description of the same page: the extent of the walls it placed,
 * where its scale is verified by the drawing's own dimensions, and its storey height, where a level was measured.
 * A provisional value is never an anchor.
 */
export function anchorsOfDrawings(run: Pick<AnalysisRun, 'result' | 'reconstruction'>): DescribedAnchors {
  const codes = new Set(run.result.preview.provisional.map((p) => p.code))
  const out: DescribedAnchors = {}
  const masses = run.reconstruction.building.masses
  if (!codes.has('SCALE_NOT_VERIFIED') && masses.length > 0) {
    const w = Math.max(...masses.map((m) => m.x1)) - Math.min(...masses.map((m) => m.x0))
    const d = Math.max(...masses.map((m) => m.z1)) - Math.min(...masses.map((m) => m.z0))
    if (w > 2 && d > 2) out.footprint = { widthM: Number(w.toFixed(3)), depthM: Number(d.toFixed(3)), why: `the drawings' own dimensions verify a footprint of ${w.toFixed(2)} × ${d.toFixed(2)} m` }
  }
  const ground = run.reconstruction.building.levels[0]
  if (!codes.has('HEIGHT_ASSUMED_FOR_PREVIEW') && ground && ground.height > 2) out.storeyHeightM = { value: ground.height, why: `the drawings measure a ground storey ${ground.height.toFixed(2)} m high` }
  return out
}

/** The drawings-path refusals after which the page's pictures are still worth reading as a whole. */
export const DESCRIBABLE_AFTER: ReadonlySet<string> = new Set(['RECONSTRUCTION_FAILED', 'NO_DRAWINGS', 'SOURCE_INCOMPLETE'])

/**
 * What follows a drawings model: nothing (null) where it has no weakness of its own account, else the description —
 * with the reason it is asked for and the measures of the drawings it must keep.
 */
export function describedFollowUp(run: Pick<AnalysisRun, 'result' | 'reconstruction'>): { after: { code: string; reasonCode: string }; weaknesses: DrawingsWeakness[]; anchors: DescribedAnchors } | null {
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
      ...(anchors && (anchors.footprint || anchors.storeyHeightM) ? { anchors } : {}),
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
