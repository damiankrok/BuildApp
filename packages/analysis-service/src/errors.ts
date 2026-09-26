/**
 * Why an analysis did not produce a building, in words a person can be shown.
 *
 * Every failure leaves the service as one of these codes with a message that
 * names what went wrong in the SOURCE, never where anything lives on the
 * machine running it: no stack, no path, no environment. The raw error stays
 * on the server's side of the line, in its log, if anywhere.
 *
 * A failure the solver EXPECTED — no enclosed cell on the plan, a layout that
 * contradicts the publisher's footprint — arrives as RECONSTRUCTION_FAILED
 * with the solver's own reason code, the stage and step it stopped in, and
 * the counts that say how far the reading got. ANALYSIS_FAILED is kept for
 * what nobody expected, and even then says in which stage it happened.
 */
import { SourceAcquisitionError } from '@buildapp/source-package'
import { FAILURE_TITLES, isReconstructionFailure } from '@buildapp/reconstruction'
import type { FailureDiagnostics, PlanDiagnosticsReport, ReconstructionFailureCode, ReconstructionFailurePhase } from '@buildapp/reconstruction'
import type { AnalysisStage } from './stages.js'

export type AnalysisErrorCode =
  /** Not an https URL, or one carrying credentials, a port, an address literal. */
  | 'INVALID_URL'
  /** A well-formed URL no registered publisher adapter understands. */
  | 'UNSUPPORTED_PUBLISHER'
  /** The acquisition refused a target: private address, bad redirect, too large, wrong media type. */
  | 'SOURCE_REFUSED'
  /** The page could not be fetched. */
  | 'SOURCE_UNREACHABLE'
  /** The page was fetched but exposes no drawing this analyzer reads. */
  | 'NO_DRAWINGS'
  /** The solver stopped for a reason it names: see `reasonCode`. */
  | 'RECONSTRUCTION_FAILED'
  /** The pipeline failed in a way nobody expected; `stage` still says where. */
  | 'ANALYSIS_FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'

/** Everything about a failure that may cross to a client. */
export type AnalysisFailure = {
  code: AnalysisErrorCode
  /** The solver's own code, when it knew why: PLAN_NO_ENCLOSED_CELLS, MODEL_EMISSION_FAILED, … */
  reasonCode?: string
  /** The stage that was running. */
  stage?: AnalysisStage
  /** The step inside it: PLAN_DECOMPOSITION, STRUCTURAL_LAYOUT, REPLAY, … */
  substage?: string
  /** A heading for a person. */
  title?: string
  message: string
  /** Flat counts of how far the reading got; never a path. */
  diagnostics?: FailureDiagnostics
}

export class AnalysisError extends Error {
  /** Set by `runAnalysis` on the way out: the run's trace and diagnostics bundle. Server-side objects, not part of `failure()`. */
  attachments?: { trace?: import('./trace.js').AnalysisTrace; bundle?: import('./diagnostics.js').DiagnosticsBundle; plans?: PlanDiagnosticsReport }

  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
    readonly detail: Omit<AnalysisFailure, 'code' | 'message'> = {},
  ) {
    super(message)
    this.name = 'AnalysisError'
  }

  /** The client-safe description of this failure. */
  failure(): AnalysisFailure {
    return { code: this.code, message: this.message, ...this.detail }
  }
}

const REFUSAL_CODES = new Set(['SCHEME_NOT_ALLOWED', 'URL_INVALID', 'URL_HAS_CREDENTIALS', 'HOST_BLOCKED', 'TOO_MANY_REDIRECTS', 'REDIRECT_INVALID', 'MEDIA_TYPE_NOT_ALLOWED', 'TOO_LARGE'])

const REFUSAL_WORDS: Record<string, string> = {
  SCHEME_NOT_ALLOWED: 'only https addresses are fetched',
  URL_INVALID: 'the address is not a valid URL',
  URL_HAS_CREDENTIALS: 'an address carrying credentials is never fetched',
  HOST_BLOCKED: 'the address, or a redirect from it, points at a private or local network',
  TOO_MANY_REDIRECTS: 'the page redirects too many times',
  REDIRECT_INVALID: 'the page answered with an invalid redirect',
  MEDIA_TYPE_NOT_ALLOWED: 'the page is not an HTML page',
  TOO_LARGE: 'the page is larger than the analyzer accepts',
}

/** The pipeline stage each solver phase reports as. */
export const PHASE_STAGE: Record<ReconstructionFailurePhase, AnalysisStage> = {
  REGISTRATION: 'REGISTERING_VIEWS',
  TOPOLOGY: 'SOLVING_TOPOLOGY',
  METRICS: 'SOLVING_METRICS',
  MODEL: 'BUILDING_MODEL',
  COMPILE: 'COMPILING_SCENE',
  VERIFY: 'VERIFYING',
}

/** A named failure of one of the service's own steps, in the solver's vocabulary. */
export function reconstructionError(reasonCode: ReconstructionFailureCode, stage: AnalysisStage, substage: string, message: string, diagnostics?: FailureDiagnostics): AnalysisError {
  return new AnalysisError('RECONSTRUCTION_FAILED', message, { reasonCode, stage, substage, title: FAILURE_TITLES[reasonCode], ...(diagnostics ? { diagnostics } : {}) })
}

/**
 * Map anything the pipeline threw to an `AnalysisError`.
 *
 * Only messages this module or the solver's typed failures wrote reach the
 * caller; an unexpected exception becomes ANALYSIS_FAILED with a fixed
 * sentence, because its own message may carry a path or a line of source.
 * `stage` is the stage that was running, so even that says where.
 */
export function toAnalysisError(error: unknown, signal?: AbortSignal, context: { stage?: AnalysisStage; substage?: string } = {}): AnalysisError {
  if (error instanceof AnalysisError) return error
  if (signal?.aborted) {
    const reason = signal.reason as { name?: string } | undefined
    return reason?.name === 'TimeoutError'
      ? new AnalysisError('TIMEOUT', 'the analysis took longer than the service allows', context.stage ? { stage: context.stage } : {})
      : new AnalysisError('CANCELLED', 'the analysis was cancelled', context.stage ? { stage: context.stage } : {})
  }
  if (isReconstructionFailure(error)) {
    return new AnalysisError('RECONSTRUCTION_FAILED', error.message, {
      reasonCode: error.code,
      stage: PHASE_STAGE[error.phase],
      ...(error.substage ? { substage: error.substage } : {}),
      title: FAILURE_TITLES[error.code],
      diagnostics: { ...error.diagnostics },
    })
  }
  if (error instanceof SourceAcquisitionError) {
    if (/^no adapter understands/.test(error.message)) return new AnalysisError('UNSUPPORTED_PUBLISHER', 'the page, after redirects, is not on a publisher this analyzer reads')
    const last = error.failures[error.failures.length - 1]
    if (last && REFUSAL_CODES.has(last.code)) return new AnalysisError('SOURCE_REFUSED', `the page was not fetched: ${REFUSAL_WORDS[last.code] ?? 'the fetch policy refused it'}`)
    if (last?.code === 'HTTP_STATUS') return new AnalysisError('SOURCE_UNREACHABLE', `the page could not be fetched (${last.message.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 40)})`)
    if (last?.code === 'TIMEOUT') return new AnalysisError('SOURCE_UNREACHABLE', 'the page did not answer in time')
    if (last?.code === 'DNS_FAILED') return new AnalysisError('SOURCE_UNREACHABLE', 'the page’s host name does not resolve')
    return new AnalysisError('SOURCE_UNREACHABLE', 'the page could not be fetched')
  }
  return new AnalysisError('ANALYSIS_FAILED', context.stage ? `the analyzer hit an unexpected internal error while ${STAGE_WORDS[context.stage]}` : 'the analyzer could not reconstruct a building from this page', {
    reasonCode: 'INTERNAL_ERROR',
    ...(context.stage ? { stage: context.stage } : {}),
    ...(context.substage ? { substage: context.substage } : {}),
    title: FAILURE_TITLES.INTERNAL_ERROR,
  })
}

const STAGE_WORDS: Record<AnalysisStage, string> = {
  ACQUIRING_SOURCE: 'fetching the sources',
  CLASSIFYING_SOURCES: 'sorting the sources',
  EXTRACTING_OBSERVATIONS: 'reading the drawings',
  REGISTERING_VIEWS: 'reading the structural layout',
  SOLVING_TOPOLOGY: 'solving the topology',
  SOLVING_METRICS: 'solving the dimensions',
  BUILDING_MODEL: 'building the model',
  COMPILING_SCENE: 'compiling the 3D scene',
  VERIFYING: 'verifying the result',
}

export const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) throw toAnalysisError(signal.reason, signal)
}
