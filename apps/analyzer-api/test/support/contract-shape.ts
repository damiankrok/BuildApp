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

/**
 * LINK-F1C: the members the phone reads as count dictionaries (`Map<String, Int>` / `Map<String, Map<String, Int>>` in
 * `AnalyzerDtos.kt` and `ModelAssessment.kt`), by path below the answer's root object, with the type of their values.
 * Their keys are data — a family with no feature reconstructed has no entry, a dictionary may be empty and may gain
 * keys — so a key is never a member the contract requires; the member itself stays required, and every value must have
 * the type the phone parses. `links` is a Map on the phone too, but its keys (`self`, `result`, `scene`, `model`) are
 * what the phone follows: they stay members.
 */
export const DICTIONARY_MEMBERS: Readonly<Record<string, (v: unknown) => boolean>> = {
  'quality.byFamily': (v) => isDictionary(v, Number.isInteger),
  'counts.assetsByDocument': Number.isInteger,
  'assessment.sourceUnchecked.counts.byKind': Number.isInteger,
}

const isDictionary = (v: unknown, value: (x: unknown) => boolean): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(value)
/** The dictionary at this path (`$.result.quality.byFamily` or `$.quality.byFamily`), if it is one. */
const dictionaryAt = (path: string): ((v: unknown) => boolean) | undefined => Object.entries(DICTIONARY_MEMBERS).find(([k]) => path === `$.${k}` || path.endsWith(`.${k}`))?.[1]

export function memberPaths(value: unknown, prefix = '$', out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) memberPaths(v, `${prefix}[]`, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(`${prefix}.${k}`)
      // a dictionary's keys are data, not members
      if (!dictionaryAt(`${prefix}.${k}`)) memberPaths(v, `${prefix}.${k}`, out)
    }
  }
  return out
}

/** LINK-F1C: every dictionary member in an answer whose value is not a dictionary of the type the phone parses. */
export function dictionaryViolations(value: unknown, prefix = '$', out: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((v) => dictionaryViolations(v, `${prefix}[]`, out))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const check = dictionaryAt(`${prefix}.${k}`)
      if (check) {
        if (!isDictionary(v, check)) out.push(`${prefix}.${k}`)
      } else dictionaryViolations(v, `${prefix}.${k}`, out)
    }
  }
  return out
}
