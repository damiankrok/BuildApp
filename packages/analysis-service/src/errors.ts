/**
 * Why an analysis did not produce a building, in words a person can be shown.
 *
 * Every failure leaves the service as one of these codes with a message that
 * names what went wrong in the SOURCE, never where anything lives on the
 * machine running it: no stack, no path, no environment. The raw error stays
 * on the server's side of the line, in its log, if anywhere.
 */
import { SourceAcquisitionError } from '@buildapp/source-package'

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
  /** The pipeline ran and failed. */
  | 'ANALYSIS_FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'

export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AnalysisError'
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

/**
 * Map anything the pipeline threw to an `AnalysisError`.
 *
 * Only messages this module wrote itself reach the caller; an unexpected
 * exception becomes ANALYSIS_FAILED with a fixed sentence, because its own
 * message may carry a path or a line of source.
 */
export function toAnalysisError(error: unknown, signal?: AbortSignal): AnalysisError {
  if (error instanceof AnalysisError) return error
  if (signal?.aborted) {
    const reason = signal.reason as { name?: string } | undefined
    return reason?.name === 'TimeoutError' ? new AnalysisError('TIMEOUT', 'the analysis took longer than the service allows') : new AnalysisError('CANCELLED', 'the analysis was cancelled')
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
  return new AnalysisError('ANALYSIS_FAILED', 'the analyzer could not reconstruct a building from this page')
}

export const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) throw toAnalysisError(signal.reason, signal)
}
