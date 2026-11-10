/**
 * v3.53 — one entry for a link: the drawings' path, and where it refuses a page whose other sources still show the
 * house, the described path (`described.ts`) — when the host has a house reader. Without a reader this is `runAnalysis`
 * exactly: the same result or the same refusal, byte for byte.
 *
 * The drawings are read FIRST and a model they yield is the answer: it is measured where the description is not. The
 * description stands in only for a refusal that leaves the page's pictures unread (no plan found, no walled outline,
 * no scale, an inconclusive or rejected layout, a model the validator refused), never for a cancelled or failed fetch,
 * and it says in its result which refusal it stands in for. If the description is refused too, the run's answer is the
 * drawings' refusal, with the description's refusal attached for the diagnostics.
 */
import type { StructuredVision } from '@buildapp/source-vision'
import { AnalysisError } from './errors.js'
import { identityOf } from './identity.js'
import { DescribedRefusal, runDescribedAnalysis } from './described.js'
import type { DescribedRun } from './described.js'
import { runAnalysis } from './run.js'
import type { AnalysisInput, AnalysisOptions, AnalysisRun } from './run.js'
import { progressEvent } from './stages.js'
import type { SourcePackage } from '@buildapp/source-package'
import type { LinkAnalysisSummary } from './result.js'
import type { AnalysisProgress } from './stages.js'

export type DrawingsRun = AnalysisRun & { basis: 'DRAWINGS' }
export type LinkAnalysis = DrawingsRun | (DescribedRun & { /** The drawings' own model, where it built one the description was preferred to. */ alternative?: AnalysisRun })

/**
 * A drawings model in which nothing metric rests on a printed dimension: its scale is not verified by the drawing's
 * own dimensions AND its storey heights are a convention. Measured on 1327: all three such models on other publishers'
 * pages were unrecognisable (flat boxes, two 18 m towers) where the description of the same page was not; in the
 * 33-project corpus 1 of 28 models is of this kind. A model with either anchor is kept.
 */
export const drawingsModelUnanchored = (result: Pick<LinkAnalysisSummary, 'preview'>): boolean => {
  const codes = new Set(result.preview.provisional.map((p) => p.code))
  return codes.has('SCALE_NOT_VERIFIED') && codes.has('HEIGHT_ASSUMED_FOR_PREVIEW')
}

/** The drawings-path refusals after which the page's pictures are still worth reading as a whole. */
export const DESCRIBABLE_AFTER: ReadonlySet<string> = new Set(['RECONSTRUCTION_FAILED', 'NO_DRAWINGS', 'SOURCE_INCOMPLETE'])

export type LinkAnalysisOptions = AnalysisOptions & {
  /** The house reader of this host (a key on the host, a fixture in tests). Absent: the drawings' path alone. */
  houseReader?: StructuredVision
  /** Told when the described path starts, with the refusal it stands in for. */
  onDescribing?: (after: { code: string; reasonCode: string | null }) => void
}

export async function analyseLink(input: AnalysisInput, options: LinkAnalysisOptions): Promise<LinkAnalysis> {
  // the overall progress never moves back when the second path starts
  let last = 0
  const progress = (event: AnalysisProgress): void => {
    if (event.progress < last) event = { ...event, progress: last }
    last = event.progress
    options.progress?.(event)
  }
  const describe = async (pkg: SourcePackage, after: { code: string; reasonCode: string | null }): Promise<DescribedRun> => {
    options.onDescribing?.(after)
    return runDescribedAnalysis({
      pkg,
      cache: options.cache,
      reader: options.houseReader as StructuredVision,
      identity: { ...identityOf(pkg, options.adapters), ...options.identity },
      sourceUrl: input.kind === 'URL' ? input.url : pkg.canonicalUrl,
      jobId: options.jobId ?? null,
      after,
      ...(options.now ? { now: options.now } : {}),
      ...(options.clock ? { clock: options.clock } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      onProgress: (p) => progress(progressEvent(p.stage, 0.5, `described: ${p.detail}`)),
    })
  }
  try {
    const run = await runAnalysis(input, { ...options, ...(options.progress ? { progress } : {}) })
    const reader = options.houseReader
    if (reader && reader.available() && drawingsModelUnanchored(run.result) && !options.signal?.aborted) {
      // nothing metric in this model rests on a printed dimension: the page read as a whole is asked for instead, and
      // the drawings' model is kept beside it; if the description is refused, the drawings' model is the answer
      try {
        return { ...(await describe(run.pkg, { code: 'DRAWINGS_MODEL_UNANCHORED', reasonCode: 'SCALE_NOT_VERIFIED+HEIGHT_ASSUMED_FOR_PREVIEW' })), alternative: run }
      } catch (e) {
        if (options.signal?.aborted) throw e
      }
    }
    return { basis: 'DRAWINGS', ...run }
  } catch (first) {
    const e = first instanceof AnalysisError ? first : undefined
    const reader = options.houseReader
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
