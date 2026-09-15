/**
 * The runtime vision abstraction.
 *
 * `VisionReasoner` is the only way the analyzer talks to a multimodal model.
 * Everything above it — extraction, benchmark, CLI, the debug surface —
 * depends on this interface and on nothing a particular vendor does, which is
 * what makes another capable model a one-file change.
 *
 * A reasoner promises exactly one thing: given a request, either a response
 * that has passed validation, or a thrown, typed failure. It never returns a
 * half-valid answer, and it never invents one when it cannot reach a provider:
 * `VisionUnavailable` is an honest outcome and a fabricated success is not.
 */
import type { VisionObservationRequest, VisionObservationResponse, VisionProviderInfo } from './schema.js'

export interface VisionReasoner {
  readonly provider: VisionProviderInfo
  /** True when this reasoner can actually answer — a live provider with credentials, or a fixture that holds this request. Called without a request, it reports whether the provider is configured at all. */
  available(request?: VisionObservationRequest): boolean
  analyze(request: VisionObservationRequest): Promise<VisionObservationResponse>
}

/** Why a provider's answer was refused. Each code names a specific way an answer can be wrong. */
export type VisionRejectionCode =
  | 'NO_ANSWER'
  | 'MALFORMED_JSON'
  | 'SCHEMA_INVALID'
  | 'WRONG_TASK'
  | 'WRONG_ASSET'
  | 'KIND_NOT_ALLOWED'
  | 'RELATION_NOT_ALLOWED'
  | 'GEOMETRY_ARITY'
  | 'DEGENERATE_GEOMETRY'
  | 'OUT_OF_BOUNDS'
  | 'RELATION_INDEX'
  | 'TOO_MANY_OBSERVATIONS'

export class VisionResponseRejected extends Error {
  constructor(
    readonly code: VisionRejectionCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'VisionResponseRejected'
  }
}

/** No provider could answer. Not an error in the pipeline's logic — a fact about the environment, to be recorded as one. */
export class VisionUnavailable extends Error {
  constructor(
    readonly reason: 'NO_CREDENTIALS' | 'NO_FIXTURE' | 'NO_PROVIDER' | 'TRANSPORT',
    message: string,
  ) {
    super(message)
    this.name = 'VisionUnavailable'
  }
}

/** An audit trace of one call: what was asked, what came back, and how long it took. Persisted beside the graph, never inside it. */
export type VisionTrace = {
  provider: VisionProviderInfo
  task: string
  assetId: string
  assetByteHash: string
  /** The raw text a provider returned, for a human to read when an answer looks wrong. */
  rawResponse?: string
  accepted: boolean
  rejection?: { code: VisionRejectionCode; message: string }
  /** Wall-clock milliseconds. Deliberately in the trace and deliberately NOT in the graph's hash. */
  latencyMs?: number
  usage?: { inputTokens?: number; outputTokens?: number }
}
