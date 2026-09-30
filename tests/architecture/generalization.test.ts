/**
 * BUILDPLAN-ANALYZER-005A: production reads source evidence, never a development house.
 *
 * One guard over the whole analyzer, not one per house. Its registry is DERIVED:
 * every sealed `source-package.json` under `stage-reports/` names a development
 * house, and from each the guard takes
 *
 *   - the publisher's project id,
 *   - the distinctive words of the page's address and the project's name
 *     (diacritics folded, inflections caught by a six-letter stem),
 *   - every published figure printed to two decimals,
 *
 * so a new development house sealed into `stage-reports/` extends the guard
 * without an edit here. "Production" is derived too: the `@buildapp` packages
 * the analyzer service and the two analyzer apps depend on, and the Android
 * app's code. A planted cheat proves the scanner sees what it claims to.
 *
 * No string guard can prove a threshold was not fitted against the houses; the
 * behavioural gates (shape families, the resolver's own suite, the blind
 * holdout) answer that. This one answers the cheaper question, completely.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')

function walk(dir: string, keep: (name: string) => boolean): string[] {
  const out: string[] = []
  const go = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      const full = join(d, name)
      if (statSync(full).isDirectory()) go(full)
      else if (keep(name)) out.push(full)
    }
  }
  if (existsSync(dir)) go(dir)
  return out
}

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// --- the registry, from the sealed packages ----------------------------------

type Registry = { ids: Set<string>; words: Set<string>; figures: Set<string>; sources: number }

/** Words every project page carries; they name no house. */
const GENERIC = new Set(['projekt', 'projekty', 'projektu', 'domow', 'dom', 'domu', 'dane', 'www', 'html', 'php'])

export function registryFrom(packages: ReadonlyArray<{ canonicalUrl: string; project: { externalId?: string; name?: string }; publishedFacts?: Array<{ value: number }> }>): Registry {
  const r: Registry = { ids: new Set(), words: new Set(), figures: new Set(), sources: packages.length }
  for (const p of packages) {
    const id = p.project.externalId ? fold(p.project.externalId) : undefined
    if (id) r.ids.add(id)
    const segment = p.canonicalUrl.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop() ?? ''
    for (const w of fold(`${segment} ${p.project.name ?? ''}`).split(/[^a-z0-9]+/)) {
      if (w.length < 3 || /^\d+$/.test(w) || GENERIC.has(w) || w === id) continue
      r.words.add(w)
    }
    for (const f of p.publishedFacts ?? []) {
      const s = f.value.toFixed(2)
      // a figure ending in 0 is printed with fewer decimals; too short to be a fingerprint
      if (!s.endsWith('0')) r.figures.add(s)
    }
  }
  return r
}

const sealed = walk(join(ROOT, 'stage-reports'), (n) => /source-package.*\.json$/.test(n))
  .map((f) => {
    try {
      return JSON.parse(readFileSync(f, 'utf8')) as unknown
    } catch {
      return undefined
    }
  })
  .filter((p): p is Parameters<typeof registryFrom>[0][number] => typeof p === 'object' && p !== null && 'project' in p && 'canonicalUrl' in p)
const registry = registryFrom(sealed)

// --- the scanner ---------------------------------------------------------------

type Hit = { kind: 'ID' | 'WORD' | 'FIGURE'; term: string; at: string }

export function scan(text: string, reg: Registry): Hit[] {
  const t = fold(text)
  const hits: Hit[] = []
  const around = (i: number, n: number): string => t.slice(Math.max(0, i - 30), i + n + 30).replace(/\s+/g, ' ')
  for (const id of reg.ids) {
    const i = t.indexOf(id)
    if (i >= 0) hits.push({ kind: 'ID', term: id, at: around(i, id.length) })
  }
  for (const w of reg.words) {
    // a long word by its stem, so "marcowki" and "marcowkach" are one; a short one whole
    const rx = w.length >= 6 ? new RegExp(w.slice(0, 6)) : new RegExp(`\\b${w}\\b`)
    const m = rx.exec(t)
    if (m) hits.push({ kind: 'WORD', term: w, at: around(m.index, m[0].length) })
  }
  for (const f of reg.figures) {
    for (const spelled of [f, f.replace('.', ',')]) {
      const m = new RegExp(`(?<![\\d.,])${spelled.replace('.', '\\.')}(?!\\d)`).exec(t)
      if (m) hits.push({ kind: 'FIGURE', term: spelled, at: around(m.index, m[0].length) })
    }
  }
  return hits
}

// --- production, from the dependency graph ----------------------------------

const manifests = [...walk(join(ROOT, 'packages'), (n) => n === 'package.json'), ...walk(join(ROOT, 'apps'), (n) => n === 'package.json')].filter((f) => !f.includes('node_modules'))
const byName = new Map<string, { dir: string; deps: string[] }>()
for (const m of manifests) {
  const json = JSON.parse(readFileSync(m, 'utf8')) as { name?: string; dependencies?: Record<string, string> }
  if (json.name) byName.set(json.name, { dir: dirname(m), deps: Object.keys(json.dependencies ?? {}).filter((d) => d.startsWith('@buildapp/')) })
}
const ROOTS = ['@buildapp/analysis-service', '@buildapp/local-analyzer', '@buildapp/analyzer-api']
const closure = new Set<string>()
for (const stack = [...ROOTS]; stack.length > 0; ) {
  const name = stack.pop() as string
  if (closure.has(name) || !byName.has(name)) continue
  closure.add(name)
  stack.push(...(byName.get(name)?.deps ?? []))
}
const productionDirs = [...[...closure].map((n) => join(byName.get(n)?.dir ?? '', 'src')), join(ROOT, 'apps/android/app/src/main/java')]
const production = productionDirs.flatMap((d) => walk(d, (n) => /\.(ts|tsx|mjs|js|kt)$/.test(n)))
const rel = (f: string): string => relative(ROOT, f)

describe('no development house in production (derived registry)', () => {
  it('derives its registry from every sealed package, and its production set from the dependency graph', () => {
    expect(registry.sources).toBeGreaterThanOrEqual(4)
    expect(registry.ids.size).toBeGreaterThanOrEqual(4)
    expect(registry.words.size).toBeGreaterThanOrEqual(4)
    expect(registry.figures.size).toBeGreaterThanOrEqual(10)
    for (const name of ['@buildapp/reconstruction', '@buildapp/source-package', '@buildapp/source-metrics', '@buildapp/analysis-service']) expect(closure.has(name), name).toBe(true)
    // evaluation and reference material is not production, and nothing production depends on reaches it
    for (const name of ['@buildapp/reference-marcowki', '@buildapp/synthetic-drawings', '@buildapp/candidates']) expect(closure.has(name), name).toBe(false)
    expect(production.length).toBeGreaterThan(200)
  })

  it('catches a planted cheat in every form it guards against', () => {
    const [id] = registry.ids
    const [word] = [...registry.words].filter((w) => w.length >= 6)
    const [figure] = registry.figures
    expect(scan(`if (page.externalId === '${id.toUpperCase()}') return 1`, registry).map((h) => h.kind)).toContain('ID')
    // an inflected, accented spelling of a long word, as a comment would write it
    const inflected = `${word.slice(0, 6)}owie`.replace('o', 'ó')
    expect(scan(`// tuned on ${inflected}`, registry).map((h) => h.kind)).toContain('WORD')
    expect(scan(`const EXPECTED = ${figure}`, registry).map((h) => h.kind)).toContain('FIGURE')
    expect(scan(`"${figure.replace('.', ',')} m²"`, registry).map((h) => h.kind)).toContain('FIGURE')
    // and not a longer number that merely contains one
    expect(scan(`const x = 1${figure}9`, registry).filter((h) => h.kind === 'FIGURE')).toEqual([])
  })

  it('no production file — code or comment — carries a development house\'s id, name or published figure', () => {
    const found: string[] = []
    for (const file of production) for (const h of scan(readFileSync(file, 'utf8'), registry)) found.push(`${rel(file)}: ${h.kind} ${h.term} in "${h.at}"`)
    expect(found).toEqual([])
  })

  it('no production file branches on a project\'s identity or its address', () => {
    const identity = /\b(projectId|externalId|canonicalUrl|slug)\s*===?\s*['"`]|\bproject\.name\s*===?\s*['"`]/
    // Publisher recognition lives in the acquisition layer's adapters; nothing after it may look at a URL's text.
    const address = /\b(canonicalUrl|sourceUrl|pageUrl|href)\b[^;\n]{0,30}\.(includes|startsWith|endsWith)\(\s*['"`]/
    const found: string[] = []
    for (const file of production) {
      const code = readFileSync(file, 'utf8')
      if (identity.test(code)) found.push(`${rel(file)}: compares a project's identity with a literal`)
      if (!rel(file).startsWith('packages/source-package/') && address.test(code)) found.push(`${rel(file)}: branches on an address's text`)
    }
    expect(found).toEqual([])
  })
})
