/**
 * Architecture tests for the analyzer v2 (§26 of the refoundation brief).
 *
 * Three boundaries, read off the tree and the sealed artefacts rather than
 * promised in a review:
 *
 *  1. **The production path does not know the benchmark.** No source on it
 *     names the reference project, carries its package id or an asset id,
 *     imports a reference or source-truth package, or reaches under
 *     `research/`. A pass that did would score perfectly on one building and
 *     read nothing on the next.
 *  2. **The v2 modules take nothing from the reference side of v1.** They may
 *     use the v1 solver's conventions and registrations; they may not import
 *     an evaluator, a specimen package, or a constant that names an answer,
 *     and none of them carries a figure the benchmark scores them against.
 *  3. **The committed artefacts are consistent with each other.** The ledger
 *     dispositions every observation and every metric reading exactly once,
 *     the feature graph's invariants hold, and the quality report grades
 *     every solved feature.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureGraphViolations, ledgerViolations } from '@buildapp/reconstruction'
import type { ArchitecturalEvidenceGraph, EvidenceConsumptionLedger, FeatureQualityReport } from '@buildapp/reconstruction'

const ROOT = resolve(import.meta.dirname, '../..')

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'test' || entry === '__tests__') continue
      const full = join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
    }
  }
  walk(dir)
  return out.sort()
}

function importsOf(src: string): string[] {
  const specs: string[] = []
  for (const m of src.matchAll(/^\s*import\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) specs.push(m[1])
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specs.push(m[1])
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1])
  for (const m of src.matchAll(/^\s*export\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) specs.push(m[1])
  return specs
}

/** The names an import takes from a module: `import { a, b as c } from '…'` gives a and b. */
function namedImportsFrom(src: string, spec: string): string[] {
  const out: string[] = []
  const pattern = new RegExp(`^\\s*import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s+['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'gm')
  for (const m of src.matchAll(pattern)) for (const name of m[1].split(',')) {
    const trimmed = name.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
    if (trimmed) out.push(trimmed)
  }
  return out
}

const read = (file: string): string => readFileSync(file, 'utf8')
const relative = (file: string): string => file.slice(ROOT.length + 1)

/** Everything on the v2 production path: the v2 solver, the metric reader, the metrology and the analyzer. */
const PRODUCTION_DIRS = ['packages/reconstruction/src/v2', 'packages/source-metrics/src', 'packages/image-metrology/src', 'packages/source-analyzer/src']
const productionFiles = (): string[] => PRODUCTION_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)))
const v2Files = (): string[] => sourceFiles(join(ROOT, 'packages/reconstruction/src/v2'))

const ARTIFACTS = join(ROOT, 'stage-reports/artifacts/analyzer-v2')
const OBSERVATIONS = join(ROOT, 'stage-reports/artifacts/source-observations')
const readJson = <T>(file: string): T => JSON.parse(read(file)) as T

type SourcePackageIds = { id: string; contentHash: string; pageHash: string; project: { externalId?: string }; assets: Array<{ id: string; variants: Array<{ id: string; byteHash: string }> }> }

/** The identifiers that name the reference project's sources: any of them in a production file is a lookup, not a reading. */
function referenceIdentifiers(): string[] {
  const pkg = readJson<SourcePackageIds>(join(OBSERVATIONS, 'marcowki-source-package.json'))
  const ids = [pkg.id, pkg.contentHash, pkg.pageHash, pkg.project.externalId ?? '', ...pkg.assets.flatMap((a) => [a.id, ...a.variants.flatMap((v) => [v.id, v.byteHash])])]
  return [...new Set(ids.filter((s) => s.length >= 8))]
}

describe('1. no production analyzer-v2 source knows the benchmark project', () => {
  it('has sources to check on every part of the path that exists', () => {
    expect(v2Files().length).toBeGreaterThan(10)
    expect(sourceFiles(join(ROOT, 'packages/source-metrics/src')).length).toBeGreaterThan(0)
    expect(productionFiles().length).toBeGreaterThan(30)
  })

  it('never names the project, in code or in prose', () => {
    const offenders = productionFiles().filter((f) => /marc[oó]wk/i.test(read(f)))
    expect(offenders.map(relative)).toEqual([])
  })

  it('never carries the source package id, its hashes, or an asset id', () => {
    const needles = referenceIdentifiers()
    expect(needles.length).toBeGreaterThan(20)
    const offenders: string[] = []
    for (const file of productionFiles()) {
      const text = read(file)
      for (const needle of needles) if (text.includes(needle)) offenders.push(`${relative(file)} contains ${needle}`)
    }
    expect(offenders).toEqual([])
  })

  it('never imports a reference package, a source-truth package, or anything under research/', () => {
    const offenders: string[] = []
    for (const file of productionFiles()) {
      const text = read(file)
      if (text.includes('@buildapp/reference-')) offenders.push(`${relative(file)} mentions a reference package`)
      if (/source-truth/i.test(text)) offenders.push(`${relative(file)} mentions a source-truth package`)
      if (/research\//.test(text)) offenders.push(`${relative(file)} reaches under research/`)
      for (const spec of importsOf(text)) {
        if (/reference-|source-truth|research\//i.test(spec)) offenders.push(`${relative(file)} imports ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('and the scan that enforces it would catch a cheat', () => {
    const pretend = ["import { x } from '@buildapp/reference-marcowki'", `const KNOWN = ['${referenceIdentifiers()[0]}']`, "const truth = readFileSync('research/marcowki-v2/marcowki-source-truth-v2.json')"].join('\n')
    expect(/marc[oó]wk/i.test(pretend)).toBe(true)
    expect(referenceIdentifiers().some((n) => pretend.includes(n))).toBe(true)
    expect(pretend.includes('@buildapp/reference-')).toBe(true)
    expect(/source-truth/i.test(pretend)).toBe(true)
    expect(/research\//.test(pretend)).toBe(true)
    expect(importsOf(pretend).some((s) => /reference-/.test(s))).toBe(true)
  })
})

describe('2. the v2 modules take nothing from the reference side of v1', () => {
  it('never import a reference module, an evaluator, a specimen package or a test', () => {
    const offenders: string[] = []
    for (const file of v2Files()) {
      for (const spec of importsOf(read(file))) {
        if (/^\.\.\/reference/.test(spec)) offenders.push(`${relative(file)} imports ${spec}`)
        if (/^\.\.\/(evaluate|benchmark)\.js$/.test(spec)) offenders.push(`${relative(file)} imports the evaluator ${spec}`)
        if (/@buildapp\/(reference-|candidates|synthetic-drawings)/.test(spec)) offenders.push(`${relative(file)} imports the specimen package ${spec}`)
        if (/(^|\/)tests?\//.test(spec)) offenders.push(`${relative(file)} imports a test ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('take from the v1 solver and fusion only conventions and readers, never a constant that names an answer', () => {
    const ANSWER = /EXPECTED|FACTS?$|MARCOWKI|REFERENCE|GOLD|BENCHMARK|TRUTH|KNOWN_/i
    const offenders: string[] = []
    let taken = 0
    for (const file of v2Files()) {
      const src = read(file)
      for (const spec of ['../solve.js', '../fusion.js']) {
        for (const name of namedImportsFrom(src, spec)) {
          taken += 1
          if (ANSWER.test(name)) offenders.push(`${relative(file)} takes ${name} from ${spec}`)
        }
      }
    }
    expect(offenders).toEqual([])
    // the v2 entry does use the v1 conventions, so the scan is reading real imports
    expect(taken).toBeGreaterThan(0)
  })

  it('none of them carries a figure from the benchmark they are scored against', () => {
    // The same list tests/architecture/reconstruction.test.ts holds the v1 structural modules to.
    const BENCHMARK = ['12.05', '14.6', '14.60', '7.9', '7.90', '4.15', '12.6', '12.60', '7.5', '7.51', '131.16', '28.563799']
    const offenders: string[] = []
    for (const file of v2Files()) {
      const text = read(file)
      for (const needle of BENCHMARK) {
        const pattern = new RegExp(`(?<![\\d.])${needle.replace('.', '\\.')}(?![\\d])`)
        if (pattern.test(text)) offenders.push(`${relative(file)} contains ${needle}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('none of them reaches for a gold model, a fixture on disk, or a benchmark file', () => {
    const offenders: string[] = []
    for (const file of v2Files()) {
      const text = read(file)
      if (/\bgold\b|\bGOLD\b/.test(text)) offenders.push(`${relative(file)} mentions a gold model`)
      if (/stage-reports|\.cache\/|fixtures?\//.test(text)) offenders.push(`${relative(file)} names a path on disk`)
      if (/benchmark/i.test(text)) offenders.push(`${relative(file)} mentions the benchmark`)
      if (/\bfetch\(|node:fs|node:https?|XMLHttpRequest/.test(text)) offenders.push(`${relative(file)} touches the network or the filesystem`)
    }
    expect(offenders).toEqual([])
  })
})

describe('3. the committed analyzer-v2 artefacts are consistent with each other', () => {
  const graph = readJson<ArchitecturalEvidenceGraph>(join(ARTIFACTS, 'feature-lineage.json'))
  const ledger = readJson<EvidenceConsumptionLedger>(join(ARTIFACTS, 'evidence-consumption.json'))
  const quality = readJson<FeatureQualityReport>(join(ARTIFACTS, 'feature-quality.json'))
  const observations = readJson<{ contentHash: string; observations: Array<{ id: string }> }>(join(OBSERVATIONS, 'marcowki-observation-graph.json'))
  const metrics = readJson<{ contentHash: string; evidence: Array<{ id: string }> }>(join(ARTIFACTS, 'marcowki-metrics.json'))

  it('the ledger dispositions every observation and every metric reading', () => {
    const dispositioned = new Set(ledger.records.map((r) => r.evidenceId))
    const missing = [...observations.observations.map((o) => o.id), ...metrics.evidence.map((e) => e.id)].filter((id) => !dispositioned.has(id))
    expect(observations.observations.length).toBeGreaterThan(0)
    expect(metrics.evidence.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })

  it('the ledger and the quality report are sealed against this feature graph, which is sealed against these inputs', () => {
    expect(ledger.featureGraphHash).toBe(graph.contentHash)
    expect(quality.featureGraphHash).toBe(graph.contentHash)
    expect(graph.observationGraphHash).toBe(observations.contentHash)
    expect(graph.metricEvidenceHash).toBe(metrics.contentHash)
  })

  it('the feature graph holds its invariants', () => {
    expect(graph.solved.length).toBeGreaterThan(0)
    expect(featureGraphViolations(graph)).toEqual([])
  })

  it('the ledger holds its invariants over exactly the evidence the inputs contain', () => {
    expect(ledgerViolations(ledger.records, [...observations.observations.map((o) => o.id), ...metrics.evidence.map((e) => e.id)])).toEqual([])
    // and every USED_IN_MODEL record names a feature the graph solved
    const solved = new Set(graph.solved.map((s) => s.id))
    const unknown = ledger.records.filter((r) => r.disposition === 'USED_IN_MODEL' && (!r.featureId || !solved.has(r.featureId)))
    expect(unknown.map((r) => r.evidenceId)).toEqual([])
  })

  it('the quality report names every solved feature, and nothing else', () => {
    const solved = graph.solved.map((s) => s.id).sort()
    const graded = quality.records.map((r) => r.featureId).sort()
    expect(graded).toEqual(solved)
    // the level column is computed from the feature, not declared by the solver: no record may be graded above what it earned
    for (const r of quality.records) {
      const s = graph.solved.find((x) => x.id === r.featureId)!
      expect(r.provenance, r.featureId).toBe(s.provenance)
      expect(r.unresolvedProperties, r.featureId).toEqual(s.unresolvedProperties)
    }
  })
})
