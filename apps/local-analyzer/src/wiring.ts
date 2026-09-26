/**
 * What the app's embedded analyzer registers: the same publishers the
 * analyzer HTTP API registers in production (`apps/analyzer-api/src/wiring.ts`;
 * an architecture test holds the two lists equal), and nothing else.
 *
 * No vision provider: a provider needs a key, and no key is ever put in an
 * APK. The deterministic analyzer runs alone and every result says
 * `DETERMINISTIC_ONLY`, with the named warning that no vision provider ran.
 */
import { archonAdapter } from '@buildapp/source-package'
import type { LocalWiring } from './local.js'

export const localWiring = (): LocalWiring => ({ adapters: [archonAdapter] })
