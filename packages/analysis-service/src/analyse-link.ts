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
import type { AnalysisProgress } from './stages.js'

export type DrawingsRun = AnalysisRun & { basis: 'DRAWINGS' }
export type LinkAnalysis = DrawingsRun | DescribedRun

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
  try {
    return { basis: 'DRAWINGS', ...(await runAnalysis(input, { ...options, ...(options.progress ? { progress } : {}) })) }
  } catch (first) {
    const e = first instanceof AnalysisError ? first : undefined
    const reader = options.houseReader
    const pkg = e?.attachments?.pkg
    if (!e || !reader || !reader.available() || !pkg || !DESCRIBABLE_AFTER.has(e.code) || options.signal?.aborted) throw first
    const after = { code: e.code, reasonCode: e.detail.reasonCode ?? null }
    options.onDescribing?.(after)
    try {
      return await runDescribedAnalysis({
        pkg,
        cache: options.cache,
        reader,
        identity: { ...identityOf(pkg, options.adapters), ...options.identity },
        sourceUrl: input.kind === 'URL' ? input.url : pkg.canonicalUrl,
        jobId: options.jobId ?? null,
        after,
        ...(options.now ? { now: options.now } : {}),
        ...(options.clock ? { clock: options.clock } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
        onProgress: (p) => progress(progressEvent(p.stage, 0.5, `described: ${p.detail}`)),
      })
    } catch (second) {
      if (options.signal?.aborted) throw second
      // the drawings' refusal is the run's answer; why the description did not stand in for it goes with it
      e.attachments = { ...e.attachments, described: second instanceof DescribedRefusal ? { code: second.code, message: second.message.slice(0, 300) } : { code: 'DESCRIBED_FAILED', message: String((second as Error)?.message ?? second).slice(0, 300) } }
      throw first
    }
  }
}
