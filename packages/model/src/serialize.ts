/**
 * Deterministic persistence.
 *
 * `canonicalizeModel` sorts every collection by id; `serializeModel` then
 * writes JSON with keys sorted recursively. Two models with the same content
 * therefore serialize byte for byte, whatever order commands created their
 * objects in. Numbers are written by JSON.stringify's shortest round-trip
 * form, so no precision is lost: what is loaded is exactly what was saved.
 */
import { validateModel, type ValidationIssue } from './validate.js'
import { OBJECT_COLLECTIONS, type CanonicalBuildingModel } from './schema.js'

const byId = <T extends { id: string }>(list: readonly T[]): T[] => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** A copy with every object collection sorted by id. The input is not mutated. */
export function canonicalizeModel(model: CanonicalBuildingModel): CanonicalBuildingModel {
  const out: CanonicalBuildingModel = { ...model }
  for (const c of OBJECT_COLLECTIONS) {
    ;(out as unknown as Record<string, unknown>)[c] = byId(model[c] as readonly { id: string }[])
  }
  return out
}

function sortKeysDeep(value: unknown): unknown {
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

/** Canonical JSON text of a model. Validates first; throws on an invalid model. */
export function serializeModel(model: CanonicalBuildingModel): string {
  const r = validateModel(model)
  if (!r.ok) throw new Error(`refusing to serialize an invalid model:\n${describe(r.issues)}`)
  return JSON.stringify(sortKeysDeep(canonicalizeModel(model)), null, 2) + '\n'
}

export type LoadResult = { ok: true; model: CanonicalBuildingModel; issues: ValidationIssue[] } | { ok: false; issues: ValidationIssue[] }

/** Parse and validate model JSON. Never throws on bad input; returns the issues. */
export function loadModel(text: string): LoadResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, issues: [{ code: 'SCHEMA', severity: 'ERROR', message: `not JSON: ${(e as Error).message}` }] }
  }
  const r = validateModel(raw)
  if (!r.ok || !r.model) return { ok: false, issues: r.issues }
  return { ok: true, model: canonicalizeModel(r.model), issues: r.issues }
}

/** Like `loadModel`, but throws with the issues listed. */
export function parseModel(text: string): CanonicalBuildingModel {
  const r = loadModel(text)
  if (!r.ok) throw new Error(`invalid model file:\n${describe(r.issues)}`)
  return r.model
}

const describe = (issues: ValidationIssue[]): string => issues.map((i) => `  [${i.code}] ${i.message}`).join('\n')
