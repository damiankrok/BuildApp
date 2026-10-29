/**
 * N9-00 (research only, read-only): the Android analyzer-contract fixtures against what the API says today, compared
 * by shape (the set of JSON paths and their value types) and by value (every leaf that differs), so a stale fixture can
 * be told apart from a changed contract. Nothing is written.
 *   npx vite-node research/analyzer-n9-00/contract-diff.ts
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { captureAndroidContract } from '../../apps/analyzer-api/test/support/android-contract.js'

const DIR = resolve(import.meta.dirname, '../../apps/android/app/src/test/resources/analyzer-contract')
type Leaf = { path: string; type: string; value: unknown }
function leaves(v: unknown, path = '$', out: Leaf[] = []): Leaf[] {
  if (Array.isArray(v)) {
    out.push({ path, type: `array(${v.length})`, value: undefined })
    v.forEach((x, i) => leaves(x, `${path}[${i}]`, out))
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) leaves(x, `${path}.${k}`, out)
  } else out.push({ path, type: typeof v, value: v })
  return out
}
const shapeOf = (ls: Leaf[]) => new Set(ls.map((l) => `${l.path.replace(/\[\d+\]/g, '[]')}:${l.type.replace(/\(\d+\)/, '')}`))
const fresh = await captureAndroidContract()
const report: Record<string, unknown> = {}
for (const [name, text] of Object.entries(fresh)) {
  const committed = readFileSync(join(DIR, name), 'utf8')
  if (committed === text) {
    report[name] = 'IDENTICAL'
    continue
  }
  let a: unknown
  let b: unknown
  try {
    a = JSON.parse(committed)
    b = JSON.parse(text)
  } catch {
    report[name] = { bytes: [committed.length, text.length], json: false }
    continue
  }
  const la = leaves(a)
  const lb = leaves(b)
  const sa = shapeOf(la)
  const sb = shapeOf(lb)
  const ma = new Map(la.map((l) => [l.path, l]))
  const changed = lb.filter((l) => ma.has(l.path) && ma.get(l.path)?.value !== l.value && l.value !== undefined)
  report[name] = {
    bytes: [committed.length, text.length],
    shapeOnlyInCommitted: [...sa].filter((s) => !sb.has(s)).slice(0, 40),
    shapeOnlyInFresh: [...sb].filter((s) => !sa.has(s)).slice(0, 40),
    changedLeaves: changed.length,
    changedSample: changed.slice(0, 60).map((l) => ({ path: l.path, committed: ma.get(l.path)?.value, fresh: l.value })),
    pathsOnlyInCommitted: la.filter((l) => !lb.some((x) => x.path === l.path)).length,
    pathsOnlyInFresh: lb.filter((l) => !la.some((x) => x.path === l.path)).length,
  }
}
console.log(JSON.stringify(report, null, 1))
