/**
 * Deterministic bundle bytes.
 *
 * The same model must always produce the same asset, so that a bundle hash
 * identifies a model state and a rebuild is a no-op in git. Keys are sorted
 * recursively, `undefined` is dropped, and numbers keep JSON.stringify's
 * shortest round-trip form so no coordinate is rounded on the way out.
 *
 * Collection ORDER is content here, not incidental: `objects` and `materials`
 * are sorted by id when the bundle is built, and `scene.meshes` keeps the
 * compiler's own deterministic order. Nothing about the order in which scenes
 * are exported, or the order a caller happened to assemble arrays in, can
 * reach the hash.
 */
import { createHash } from 'node:crypto'
import type { MobileSceneBundle } from './types.js'

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src).sort()) {
      if (src[k] === undefined) continue
      out[k] = sortKeysDeep(src[k])
    }
    return out
  }
  return value
}

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

/** Canonical JSON of everything in the bundle except the hash itself. */
export function hashableText(bundle: MobileSceneBundle): string {
  const { contentHash: _ignored, ...rest } = bundle
  return JSON.stringify(sortKeysDeep(rest))
}

export const bundleContentHash = (bundle: MobileSceneBundle): string => sha256(hashableText(bundle))

/**
 * The bytes written to disk and shipped inside the app.
 *
 * Compact, not pretty-printed: this is a machine asset read by a phone, and
 * indentation would add megabytes of whitespace to a real building.
 */
export const serializeBundle = (bundle: MobileSceneBundle): string => JSON.stringify(sortKeysDeep(bundle)) + '\n'

export type BundleLoadResult = { ok: true; bundle: MobileSceneBundle } | { ok: false; error: string }

/**
 * Parse bundle text and check its hash. Never throws: a corrupt or tampered
 * asset is reported, not silently repaired.
 */
export function loadBundle(text: string): BundleLoadResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `not JSON: ${(e as Error).message}` }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'bundle is not an object' }
  const bundle = raw as MobileSceneBundle
  if (bundle.schema !== 'buildapp.mobile-scene-bundle') return { ok: false, error: `unknown schema "${String(bundle.schema)}"` }
  if (bundle.schemaVersion !== '1.0.0') return { ok: false, error: `unsupported bundle version "${String(bundle.schemaVersion)}"` }
  if (!bundle.scene || !Array.isArray(bundle.scene.meshes)) return { ok: false, error: 'bundle has no scene meshes' }
  const actual = bundleContentHash(bundle)
  if (actual !== bundle.contentHash) return { ok: false, error: `content hash mismatch: asset says ${String(bundle.contentHash)}, content is ${actual}` }
  return { ok: true, bundle }
}
