/**
 * The recorded-response provider.
 *
 * CI must be able to exercise the whole vision path — request shaping,
 * validation, rejection, conversion to observations — with no network, no key
 * and no variance between runs. A fixture is a real answer, recorded once from
 * a real provider (or hand-written for a synthetic picture), replayed against
 * the same bytes.
 *
 * The fixture is bound to the BYTES it was recorded against, not to a file
 * name or an asset id. Change the picture and the fixture stops matching,
 * loudly, instead of quietly describing the old one. That is the whole point
 * of keying on the byte hash.
 *
 * A fixture provider is honest about what it is: its `provider.id` says
 * `vision.fixture` and the recorded provider it replays is carried in
 * `recordedFrom`, so nothing downstream can mistake a replay for a live call.
 */
import { canonicalJson, sha256Hex } from '@buildapp/source-common'
import type { VisionObservationRequest, VisionObservationResponse, VisionProviderInfo, VisionTask } from '../schema.js'
import { VisionUnavailable } from '../reasoner.js'
import type { VisionReasoner } from '../reasoner.js'
import { validateVisionResponse } from '../validate.js'

export type VisionFixtureRecord = {
  /** The deterministic key: task plus the exact bytes the answer is about. */
  key: string
  task: VisionTask
  assetByteHash: string
  /** The provider this answer actually came from, when it came from one. */
  recordedFrom: VisionProviderInfo
  /** Free note: when and how this was recorded. */
  recordedNote?: string
  response: unknown
}

/** The key a fixture is stored and looked up under. */
export const fixtureKey = (task: VisionTask, assetByteHash: string): string => `${task.toLowerCase().replace(/_/g, '-')}-${assetByteHash.slice(0, 16)}`

/** A content address for a whole fixture set, so a graph built from replays can say which replays. */
export const fixtureSetHash = (records: readonly VisionFixtureRecord[]): string => sha256Hex(canonicalJson([...records].map((r) => ({ key: r.key, task: r.task, assetByteHash: r.assetByteHash, response: r.response })).sort((a, b) => a.key.localeCompare(b.key))))

export type FixtureReasonerOptions = {
  /** The version this replay reports. Defaults to a digest of the fixture set, so editing a fixture re-hashes every graph built from it. */
  version?: string
}

export function fixtureVisionReasoner(records: readonly VisionFixtureRecord[], options: FixtureReasonerOptions = {}): VisionReasoner {
  const byKey = new Map(records.map((r) => [r.key, r]))
  const provider: VisionProviderInfo = { id: 'vision.fixture', model: 'recorded', version: options.version ?? `set-${fixtureSetHash(records).slice(0, 12)}` }
  return {
    provider,
    available: (request) => (request ? byKey.has(fixtureKey(request.task, request.asset.byteHash)) : byKey.size > 0),
    analyze: async (request): Promise<VisionObservationResponse> => {
      const record = byKey.get(fixtureKey(request.task, request.asset.byteHash))
      if (!record) throw new VisionUnavailable('NO_FIXTURE', `no recorded ${request.task} answer for bytes ${request.asset.byteHash.slice(0, 12)}; record one with a live provider or supply the same image the fixture was made from`)
      // A fixture goes through exactly the same validation as a live answer.
      // A recorded response that would be rejected from a provider is rejected
      // here too, which is what makes rejection itself testable.
      return validateVisionResponse(record.response, request)
    },
  }
}
