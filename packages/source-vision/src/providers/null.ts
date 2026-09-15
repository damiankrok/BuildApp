/**
 * The provider that admits there is no provider.
 *
 * Used when nothing is configured. It does not return an empty answer,
 * because an empty answer is indistinguishable from a model that looked and
 * saw nothing, and the difference matters: one means the facade has no visible
 * frame members, the other means nobody looked. It throws `VisionUnavailable`,
 * which the extraction layer records as a named gap.
 */
import type { VisionProviderInfo } from '../schema.js'
import { VisionUnavailable } from '../reasoner.js'
import type { VisionReasoner } from '../reasoner.js'

export function nullVisionReasoner(reason = 'no vision provider is configured'): VisionReasoner {
  const provider: VisionProviderInfo = { id: 'vision.none', model: 'none', version: '1.0.0' }
  return {
    provider,
    available: () => false,
    analyze: async () => {
      throw new VisionUnavailable('NO_PROVIDER', reason)
    },
  }
}
