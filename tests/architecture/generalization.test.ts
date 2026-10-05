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

type Registry = { ids: Set<string>; words: Set<string>; figures: Set<string>; dimensions: Set<string>; hosts: Set<string>; sources: number }

/**
 * Words every project page carries; they name no house. 005F: nor does a preposition in a house's name ("dom pod
 * …", "dom nad …") — the noun after it does, and stays registered; registered whole, "pod" found "podłog".
 */
const GENERIC = new Set(['projekt', 'projekty', 'projektu', 'domow', 'dom', 'domu', 'domy', 'dane', 'www', 'html', 'php', 'pod', 'nad', 'przy', 'przed', 'obok'])

export function registryFrom(packages: ReadonlyArray<{ canonicalUrl: string; project: { externalId?: string; name?: string }; publishedFacts?: Array<{ value: number; unit?: string }>; adapter?: { id: string } }>): Registry {
  const r: Registry = { ids: new Set(), words: new Set(), figures: new Set(), dimensions: new Set(), hosts: new Set(), sources: packages.length }
  for (const p of packages) {
    const id = p.project.externalId ? fold(p.project.externalId) : undefined
    if (id) r.ids.add(id)
    // 005C: a publisher read by the GENERIC adapter has no specialist, so its name has no business in production
    // (no `if (hostname === …)`). A specialist's publisher is named by its own adapter, by design.
    if (p.adapter?.id === 'generic.project-page') {
      const labels = new URL(p.canonicalUrl).hostname.split('.').filter((l) => l !== 'www')
      const name = labels.length >= 2 ? labels[labels.length - 2] : labels[0]
      if (name && name.length >= 4 && !GENERIC.has(name)) r.hosts.add(fold(name))
    }
    const segment = p.canonicalUrl.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop() ?? ''
    for (const w of fold(`${segment} ${p.project.name ?? ''}`).split(/[^a-z0-9]+/)) {
      if (w.length < 3 || /^\d+$/.test(w) || GENERIC.has(w) || w === id) continue
      r.words.add(w)
    }
    for (const f of p.publishedFacts ?? []) {
      // A count and a small whole number are anybody's. Every other figure in its printed two-decimal spelling
      // ("278.30"), and in the short one a page or a comment would write when that drops only a trailing 0 and
      // leaves at least three digits ("278.3"; 005C: the guard used to register neither, and missed both).
      if (f.unit === 'count' || (Number.isInteger(f.value) && f.value < 100)) continue
      const s = f.value.toFixed(2)
      if (!s.endsWith('00')) r.figures.add(s)
      const short = f.value.toFixed(1)
      if (s.endsWith('0') && !s.endsWith('00') && f.value >= 10) r.figures.add(short)
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

/**
 * 005B: the overall dimensions printed on each development house's plan, sealed as text facts
 * (every `development-dimensions*.json` under `stage-reports/`). One of at least four digits that is not a round
 * metre is a fingerprint of the benchmark: "1205" in a comment is a house, "1200" is a number.
 */
export function dimensionsFrom(files: ReadonlyArray<{ houses?: Array<{ overallDimensionsCm?: number[]; misreadAsCm?: number[] }> }>): Set<string> {
  const out = new Set<string>()
  // 005D: what a reader once took a printed figure for is as much a fingerprint as the figure itself.
  for (const f of files) for (const h of f.houses ?? []) for (const cm of [...(h.overallDimensionsCm ?? []), ...(h.misreadAsCm ?? [])]) if (Number.isInteger(cm) && cm >= 1000 && cm % 100 !== 0) out.add(String(cm))
  return out
}
const sealedDimensions = walk(join(ROOT, 'stage-reports'), (n) => /^development-dimensions.*\.json$/.test(n)).map((f) => JSON.parse(readFileSync(f, 'utf8')) as { houses?: Array<{ overallDimensionsCm?: number[]; misreadAsCm?: number[] }> })
for (const d of dimensionsFrom(sealedDimensions)) registry.dimensions.add(d)

// --- the scanner ---------------------------------------------------------------

type Hit = { kind: 'ID' | 'WORD' | 'FIGURE' | 'DIMENSION' | 'HOST'; term: string; at: string }

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
  for (const h of reg.hosts) {
    // a publisher's name whole: it is one word, and a stem of it is a common word
    const m = new RegExp(`\\b${h}\\b`).exec(t)
    if (m) hits.push({ kind: 'HOST', term: h, at: around(m.index, m[0].length) })
  }
  for (const f of reg.figures) {
    for (const spelled of [f, f.replace('.', ',')]) {
      const m = new RegExp(`(?<![\\d.,])${spelled.replace('.', '\\.')}(?!\\d)`).exec(t)
      if (m) hits.push({ kind: 'FIGURE', term: spelled, at: around(m.index, m[0].length) })
    }
  }
  for (const d of reg.dimensions) {
    // In centimetres (a list item `[1260,1205]` included: only a digit or a decimal point before it
    // makes it part of another number), and in metres, `12.05` or `12,05`.
    const metres = (Number(d) / 100).toFixed(2).replace('.', '[.,]')
    for (const rx of [new RegExp(`(?<![\\d.])${d}(?![\\d])`), new RegExp(`(?<![\\d.,])${metres}(?![\\d])`)]) {
      const m = rx.exec(t)
      if (m) hits.push({ kind: 'DIMENSION', term: m[0], at: around(m.index, m[0].length) })
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
// 005D (post-review D): not production, but they judge production or describe it to a reviewer, so a
// benchmark fingerprint there would leak into a verdict or a pack: the Evidence Pack, the blind verdict
// and the row judges are held to the same rule. (The holdout selector is not: it enumerates named
// publishers' sitemaps by design, and draws only from what it enumerates.)
const judges = [
  ...walk(join(ROOT, 'packages/evidence-pack/src'), (n) => /\.ts$/.test(n)),
  join(ROOT, 'holdout/verdict.mjs'),
  ...walk(join(ROOT, 'packages/analysis-service/scripts'), (n) => /-row\.mjs$/.test(n)),
  // 005H (red team D9): the OCR parity self-test ships in the APK with the synthetic corpus it draws, outside the
  // dependency closure above (synthetic-drawings is a devDependency); its sources are held to the same rule
  join(ROOT, 'apps/local-analyzer/src/self-test.ts'),
  join(ROOT, 'apps/local-analyzer/src/self-test-entry.ts'),
  join(ROOT, 'packages/synthetic-drawings/src/ocr-corpus.ts'),
  join(ROOT, 'packages/synthetic-drawings/src/digit-corpus.ts'),
]
const rel = (f: string): string => relative(ROOT, f)

describe('no development house in production (derived registry)', () => {
  it('derives its registry from every sealed package, and its production set from the dependency graph', () => {
    expect(registry.sources).toBeGreaterThanOrEqual(4)
    expect(registry.ids.size).toBeGreaterThanOrEqual(4)
    expect(registry.words.size).toBeGreaterThanOrEqual(4)
    expect(registry.figures.size).toBeGreaterThanOrEqual(10)
    expect(registry.dimensions.size).toBeGreaterThanOrEqual(5)
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
    // 005C: a figure printed with a trailing 0, in both spellings
    const trailing = [...registry.figures].find((f) => /^\d{2,}\.[1-9]0$/.test(f))
    expect(trailing).toBeDefined()
    expect(scan(`const FOOTPRINT = ${trailing}`, registry).map((h) => h.kind)).toContain('FIGURE')
    expect(scan(`// ${(trailing ?? '').slice(0, -1).replace('.', ',')} m² on the page`, registry).map((h) => h.kind)).toContain('FIGURE')
    const [dimension] = registry.dimensions
    expect(scan(`if (overallCm === ${dimension}) scale = 2.64`, registry).map((h) => h.kind)).toContain('DIMENSION')
    expect(scan(`// a chain of ${dimension} cm`, registry).map((h) => h.kind)).toContain('DIMENSION')
    expect(scan(`const x = 1${dimension}9`, registry).filter((h) => h.kind === 'DIMENSION')).toEqual([])
    expect(scan(`const SPANS = [1000,${dimension}]`, registry).map((h) => h.kind)).toContain('DIMENSION')
    const metres = (Number(dimension) / 100).toFixed(2)
    expect(scan(`// the overall is ${metres} m`, registry).map((h) => h.kind)).toContain('DIMENSION')
    expect(scan(`"${metres.replace('.', ',')} m"`, registry).map((h) => h.kind)).toContain('DIMENSION')
    // 005D: the misreadings the stage was opened for are registered beside the printed figures
    for (const d of ['1055', '1801']) expect(registry.dimensions.has(d), d).toBe(true)
    expect(scan(`if (value === 1801) value = 1601`, registry).map((h) => h.kind)).toContain('DIMENSION')
    expect(scan(`// italic 10,35 read as 10.55`, registry).filter((h) => h.kind === 'DIMENSION').length).toBeGreaterThanOrEqual(1)
    // 005C: a publisher only the generic reader knows, branched on by name
    const [host] = registry.hosts
    expect(host).toBeDefined()
    expect(scan(`if (new URL(url).hostname.includes('${host}')) return SPECIAL`, registry).map((h) => h.kind)).toContain('HOST')
  })

  it('no production file — code or comment — carries a development house\'s id, name, published figure or printed overall dimension', () => {
    const found: string[] = []
    for (const file of production) for (const h of scan(readFileSync(file, 'utf8'), registry)) found.push(`${rel(file)}: ${h.kind} ${h.term} in "${h.at}"`)
    expect(found).toEqual([])
  })

  it('neither the Evidence Pack, the holdout scripts nor the row judges carry a development house\'s fingerprint (005D)', () => {
    expect(judges.length).toBeGreaterThanOrEqual(8)
    const found: string[] = []
    for (const file of judges) for (const h of scan(readFileSync(file, 'utf8'), registry)) found.push(`${rel(file)}: ${h.kind} ${h.term} in "${h.at}"`)
    expect(found).toEqual([])
  })

  it('the Evidence Pack is observational: no production package depends on it or imports it (005D §9)', () => {
    expect(closure.has('@buildapp/evidence-pack')).toBe(false)
    const found = production.filter((f) => /from\s+['"][^'"]*evidence-pack/.test(readFileSync(f, 'utf8'))).map(rel)
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
