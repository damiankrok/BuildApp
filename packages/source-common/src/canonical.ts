/**
 * Canonical JSON: the one serialization every content hash in the analyzer is
 * taken over.
 *
 * Two values with the same content must produce identical bytes whatever order
 * they were built in, so object keys are sorted recursively and numbers are
 * written in JavaScript's shortest round-trip form. `undefined` members are
 * dropped (they are absent, not null). Arrays keep their order: an array's
 * order is content. Where order is NOT content — a set of observations, a set
 * of relations — the caller sorts before hashing (`hashUnordered`).
 */

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json | undefined }

function write(value: Json | undefined, out: string[]): void {
  if (value === undefined || value === null) {
    out.push('null')
    return
  }
  if (typeof value === 'boolean') {
    out.push(value ? 'true' : 'false')
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`canonical JSON cannot represent ${String(value)}`)
    // -0 and 0 are the same content
    out.push(Object.is(value, -0) ? '0' : String(value))
    return
  }
  if (typeof value === 'string') {
    out.push(JSON.stringify(value))
    return
  }
  if (Array.isArray(value)) {
    out.push('[')
    value.forEach((v, i) => {
      if (i > 0) out.push(',')
      write(v, out)
    })
    out.push(']')
    return
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
  out.push('{')
  keys.forEach((k, i) => {
    if (i > 0) out.push(',')
    out.push(JSON.stringify(k), ':')
    write(value[k], out)
  })
  out.push('}')
}

/** Canonical JSON text: keys sorted recursively, no insignificant whitespace, `undefined` dropped. */
export function canonicalJson(value: unknown): string {
  const out: string[] = []
  write(value as Json, out)
  return out.join('')
}

/** Pretty JSON for files a human reads, with the same key ordering as `canonicalJson` so a diff stays stable. */
export function stableJson(value: unknown, indent = 2): string {
  return JSON.stringify(JSON.parse(canonicalJson(value)), null, indent) + '\n'
}
