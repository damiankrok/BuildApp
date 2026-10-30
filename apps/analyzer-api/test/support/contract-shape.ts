/**
 * N9-01: where the two Android contract snapshots live, and the shape of a JSON answer as the set of its member paths.
 *
 *   LEGACY_CONTRACT_DIR   `analyzer-contract/`: the answers of the server at solver 2.3.0 (005L), kept as an older
 *                         server's answer the phone must still parse; never rewritten
 *   CURRENT_CONTRACT_DIR  `analyzer-contract-current/`: the reviewed answers of today's server
 *
 * A path is the chain of member names from the root, with every array element written `[]`, so two answers of
 * different lengths and values have the same shape when they have the same members.
 */
import { resolve } from 'node:path'

const RESOURCES = resolve(import.meta.dirname, '../../../android/app/src/test/resources')
export const LEGACY_CONTRACT_DIR = resolve(RESOURCES, 'analyzer-contract')
export const CURRENT_CONTRACT_DIR = resolve(RESOURCES, 'analyzer-contract-current')

export function memberPaths(value: unknown, prefix = '$', out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) memberPaths(v, `${prefix}[]`, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(`${prefix}.${k}`)
      memberPaths(v, `${prefix}.${k}`, out)
    }
  }
  return out
}
