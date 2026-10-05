/**
 * What the app's embedded analyzer registers: the same publishers the
 * analyzer HTTP API registers in production (`apps/analyzer-api/src/wiring.ts`;
 * an architecture test holds the two lists equal), and nothing else.
 *
 * No vision provider: a provider needs a key, and no key is ever put in an
 * APK. The deterministic analyzer runs alone and every result says
 * `DETERMINISTIC_ONLY`, with the named warning that no vision provider ran.
 *
 * BUILDPLAN-ANALYZER-005H: the external numeric recogniser the bundle ships
 * beside itself (`ocr-worker.mjs`, ONNX Runtime Web's WebAssembly, the pinned
 * PP-OCRv6 tiny model), run in a worker per batch. It is no provider of
 * anything remote: every byte it reads is in the APK, verified against its pin.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundledAssetPaths, workerRecogniser } from '@buildapp/numeric-recogniser-ort/client'
import { archonAdapter, genericProjectPageAdapter } from '@buildapp/source-package'
import type { LocalWiring } from './local.js'

/** The recogniser's worker, beside the analyzer bundle. */
export const RECOGNISER_WORKER_FILE = 'ocr-worker.mjs' as const

/**
 * The recogniser a bundle in `dir` ships, as a factory (one per job), or undefined where no worker lies beside the
 * code — the TypeScript sources, which ship none. The bundle build refuses to write a worker without its pinned files.
 */
export function bundledRecogniser(dir: string = dirname(fileURLToPath(import.meta.url))): LocalWiring['recogniser'] {
  const worker = join(dir, RECOGNISER_WORKER_FILE)
  if (!existsSync(worker)) return undefined
  return () => workerRecogniser({ workerUrl: pathToFileURL(worker), paths: bundledAssetPaths(dir) })
}

/**
 * Specialists first, the generic project-page reader last (BUILDPLAN-
 * INTEGRATION-004A): a known publisher is read by its own adapter, and an
 * unknown public page is inspected rather than refused by its host name.
 */
export const localWiring = (): LocalWiring => ({ adapters: [archonAdapter, genericProjectPageAdapter], recogniser: bundledRecogniser() })
