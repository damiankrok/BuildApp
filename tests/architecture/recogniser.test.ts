/**
 * BUILDPLAN-ANALYZER-005H — non-circularity of the external numeric recogniser, read from the sources.
 *
 * A recogniser that could see a scale, a span, a chain, a published figure or a reconstruction value could be made to
 * agree with them, and its "independent" reading would only repeat what the resolver already believed. These tests
 * hold, by the code itself, that it cannot:
 *
 *  - its input type has three fields — a key, the pixels, a height — and no other;
 *  - the seam module imports nothing but pixel and rectangle types; the metric layer never imports a runtime;
 *  - the crops are cut in the frame loop from the pass field and the token's own box, BEFORE the frame's metric
 *    solution is computed, and from nothing the chains, scales or published facts hold;
 *  - reconstruction never reaches the recogniser or its runtime; only the runtime package imports onnxruntime-web, and
 *    only the analysis service's callers (apps, scripts, tests) wire a recogniser.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])

function filesUnder(dir: string, ext = /\.(ts|tsx|mjs|js)$/): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist' || name === 'build') continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(relative(ROOT, p))
    }
  }
  walk(abs)
  return out.sort()
}

describe('the recogniser sees image crops and nothing else', () => {
  it('its input type is a key, the pixels and a height', () => {
    const seam = read('packages/source-metrics/src/recogniser.ts')
    const block = /export type LabelCrop = \{([\s\S]*?)\n\}/.exec(seam)?.[1] ?? ''
    const fields = [...codeOf(block).matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1])
    expect(fields).toEqual(['key', 'gray', 'capPx'])
    // and `recognise` takes crops (and options of progress and cancellation) only
    expect(seam).toMatch(/recognise\(crops: readonly LabelCrop\[\], options\?: RecogniseOptions\): Promise<ExternalReading\[\]>/)
    const opts = /export type RecogniseOptions = \{([\s\S]*?)\n\}/.exec(seam)?.[1] ?? ''
    expect([...codeOf(opts).matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1])).toEqual(['signal', 'onProgress'])
  })

  it('the seam imports pixel and rectangle types only', () => {
    expect(importsOf(read('packages/source-metrics/src/recogniser.ts')).sort()).toEqual(['@buildapp/source-common', '@buildapp/source-cv'])
    // and the rule over the two readings imports the lattice's value grammar and the seam's types, never a solver
    const rule = importsOf(read('packages/source-metrics/src/ensemble.ts'))
    expect(rule.filter((i) => !['./numeric-lattice.js', './recogniser.js'].includes(i))).toEqual([])
  })

  it('the crops are cut from the pass field and the token’s box, before the frame’s metric solution exists', () => {
    const extract = codeOf(read('packages/source-metrics/src/extract.ts'))
    const loop = extract.slice(extract.indexOf('function* metricEvidenceSteps('))
    const cut = loop.indexOf('labelCrop(id, field, token.passBox)')
    const ask = loop.indexOf('yield { frameId: frame.id, crops }')
    const solve = loop.indexOf('solveFrameMetric(')
    expect(cut).toBeGreaterThan(0)
    expect(ask).toBeGreaterThan(cut)
    expect(solve).toBeGreaterThan(ask)
    // the crop's inputs: the lattice id, the pass field of the token's own orientation, the token's own box
    const block = loop.slice(loop.indexOf('if (recogniser && lattices.size > 0)'), ask)
    expect(block).toMatch(/const field = read\.passes\?\.\[token\.orientation\]/)
    for (const forbidden of ['solution', 'chain', 'scale', 'cmPerPixel', 'published', 'plausibility', 'tolerancePx', 'specification', 'observation']) expect(block.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase())
  })

  it('the external reading enters the metric layer only through the ensemble rule', () => {
    const solver = codeOf(read('packages/source-metrics/src/metric-solution.ts'))
    // the solver never reads the raw reading (its top-K, its greedy path, its variants) — only the rule's decision;
    // the one mention of `.external` copies the decision's own summary into the observation's record
    expect(solver).not.toMatch(/topK|greedy|meanP|variants/)
    const uses = [...solver.matchAll(/(\w+)\.external\b/g)].map((m) => m[1])
    expect(new Set(uses)).toEqual(new Set(['ensemble']))
    expect(solver).toMatch(/readingOf\(lattice\)/)
  })
})

describe('no runtime where it does not belong', () => {
  it('only the runtime package imports onnxruntime', () => {
    const offenders = [...filesUnder('packages'), ...filesUnder('apps/local-analyzer/src'), ...filesUnder('apps/analyzer-api/src'), ...filesUnder('apps/web/src')]
      .filter((f) => !f.startsWith('packages/numeric-recogniser-ort/'))
      .filter((f) => importsOf(read(f)).some((i) => i.startsWith('onnxruntime')))
    expect(offenders).toEqual([])
    // inside it, only the engine does
    const inside = filesUnder('packages/numeric-recogniser-ort/src').filter((f) => importsOf(read(f)).some((i) => i.startsWith('onnxruntime')))
    expect(inside).toEqual(['packages/numeric-recogniser-ort/src/engine.ts'])
  })

  it('source-metrics depends on no runtime and no recogniser implementation', () => {
    const pkg = JSON.parse(read('packages/source-metrics/package.json')) as { dependencies?: Record<string, string> }
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => /onnx|recogniser|tesseract|paddle/i.test(d))).toEqual([])
    for (const f of filesUnder('packages/source-metrics/src')) expect(importsOf(read(f)).filter((i) => /onnx|numeric-recogniser/.test(i)), f).toEqual([])
  })

  it('reconstruction, geometry and the model never reach the recogniser or its runtime', () => {
    for (const dir of ['packages/reconstruction', 'packages/geometry', 'packages/model', 'packages/source-cv', 'packages/source-vision']) {
      const pkg = JSON.parse(read(`${dir}/package.json`)) as { dependencies?: Record<string, string> }
      expect(Object.keys(pkg.dependencies ?? {}).filter((d) => /onnx|numeric-recogniser/.test(d)), dir).toEqual([])
      for (const f of filesUnder(`${dir}/src`)) expect(importsOf(read(f)).filter((i) => /onnx|numeric-recogniser|ensemble|recogniser/.test(i)), f).toEqual([])
    }
  })

  it('the recogniser package is wired only by the apps and by scripts and tests', () => {
    const users = [...filesUnder('packages'), ...filesUnder('apps')]
      .filter((f) => !f.startsWith('packages/numeric-recogniser-ort/'))
      .filter((f) => importsOf(read(f)).some((i) => i.startsWith('@buildapp/numeric-recogniser-ort')))
    expect(users.filter((f) => !/^apps\/local-analyzer\/(src|scripts|test)\/|\/(scripts|test)\//.test(f))).toEqual([])
    // the analysis service takes any LabelRecogniser and names none
    expect(filesUnder('packages/analysis-service/src').filter((f) => /numeric-recogniser|onnx/.test(read(f)))).toEqual([])
  })
})
