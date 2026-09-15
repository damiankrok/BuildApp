/**
 * Content hashes for the sealed artefacts.
 *
 * `hashOrdered` is for content whose order is meaningful (an asset's variant
 * list, a polyline's points). `hashUnordered` is for a SET — observations,
 * relations — where two extractions that found the same things in a different
 * order must agree: each member is hashed on its own, the digests are sorted,
 * and the sorted list is hashed. That is what "order-independent hash" means
 * here, and it is tested.
 */
import { canonicalJson } from './canonical.js'
import { sha256Hex } from './sha256.js'

export const hashOrdered = (value: unknown): string => sha256Hex(canonicalJson(value))

export function hashUnordered(members: readonly unknown[]): string {
  const digests = members.map((m) => sha256Hex(canonicalJson(m))).sort()
  return sha256Hex(canonicalJson(digests))
}

/**
 * The hash of a whole artefact: a labelled, ordered list of parts, each part
 * either ordered or unordered content. Naming the parts means a hash cannot
 * silently keep its value when a field moves between parts.
 */
export type HashPart = { label: string; ordered?: unknown; unordered?: readonly unknown[] }

export function hashArtifact(kind: string, version: string, parts: readonly HashPart[]): string {
  const rows = parts.map((p) => [p.label, p.unordered !== undefined ? hashUnordered(p.unordered) : hashOrdered(p.ordered)])
  return sha256Hex(canonicalJson({ kind, version, parts: rows }))
}
