/**
 * BUILDPLAN-ANALYZER-005I §8 — non-circularity of the dimension topology, read from the sources and held by behaviour.
 *
 * Which line a label names may be decided only from what the drawing shows before anything is reconstructed: line
 * geometry, marks, label boxes and orientations, label heights. A binding chosen because it yields the published
 * area, a successful reconstruction, a known house or "the assignment that passes" would make the scale agree with the
 * figure it is later checked against. These tests hold, by the code itself, that it cannot:
 *
 *  - the topology modules import pixel/rectangle types, the reader's token and grammar, and nothing that knows a
 *    building: no reconstruction, model, geometry, source package (where published facts live) or recogniser;
 *  - their code names no published figure, area, footprint, reconstruction outcome, house or gold answer;
 *  - the assignment's inputs are chains and tokens, and its cost uses no reading value: relabelling every label with
 *    other digits leaves every binding where it was;
 *  - the end-span and wall-refutation rules in reconstruction read the chain records and the wall witness only — never
 *    the published facts or the model.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assignLabels } from '@buildapp/source-metrics'
import type { RawChain, TextToken } from '@buildapp/source-metrics'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
const importsOf = (source: string): string[] => [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1])

/** What a binding may never be chosen by (§8). Matched on code, comments removed. */
const FORBIDDEN = /publish|footprint|area\b|areaM2|reconstruct|sealCandidate|buildingCandidate|gold|expected|house|slug|family|archon|verdict|model\b/i

/** The function body of `name` in `source` (from its signature to the next top-level function). */
const bodyOf = (source: string, name: string): string => {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`no function ${name}`)
  const next = source.slice(start + 1).search(/\n(?:export )?(?:function|const|type) /)
  return source.slice(start, next < 0 ? undefined : start + 1 + next)
}

describe('§8 the dimension topology knows the drawing, not the building', () => {
  it('the topology module imports pixel types, the reader’s token and grammar, and the chain types only', () => {
    const imports = importsOf(read('packages/source-metrics/src/axis-topology.ts')).sort()
    expect(imports).toEqual(['./chains.js', './ocr.js', './ocr.js', './parse.js', './schema.js', '@buildapp/source-common', '@buildapp/source-common'].sort())
  })

  it('no topology code names a published figure, an area, a reconstruction, a house or an answer', () => {
    const topology = codeOf(read('packages/source-metrics/src/axis-topology.ts'))
    expect(topology.match(FORBIDDEN)).toBeNull()
    const lines = codeOf(read('packages/source-metrics/src/dimension-lines.ts'))
    expect(bodyOf(lines, 'markLabelInk').match(FORBIDDEN)).toBeNull()
    const extract = codeOf(read('packages/source-metrics/src/extract.ts'))
    expect(bodyOf(extract, 'dimensionChainsOf').match(FORBIDDEN)).toBeNull()
    expect(bodyOf(extract, 'labelInkOf').match(FORBIDDEN)).toBeNull()
  })

  it('the label-ink trace sees boxes, never what a label reads', () => {
    const extract = codeOf(read('packages/source-metrics/src/extract.ts'))
    const ink = bodyOf(extract, 'labelInkOf')
    expect(ink).not.toMatch(/\.text\b|readings|valueCm|lattice/)
    const lines = codeOf(read('packages/source-metrics/src/dimension-lines.ts'))
    expect(bodyOf(lines, 'markLabelInk')).not.toMatch(/\.text\b|readings|valueCm|lattice/)
  })

  it('a candidate’s cost is geometry: no reading value enters `labelCandidates` or the solver', () => {
    const topology = codeOf(read('packages/source-metrics/src/axis-topology.ts'))
    expect(bodyOf(topology, 'labelCandidates')).not.toMatch(/readings|valueCm|\.text\b|parse/)
    expect(bodyOf(topology, 'solveNeighbourhood')).not.toMatch(/readings|valueCm|\.text\b/)
    expect(bodyOf(topology, 'hungarian')).not.toMatch(/readings|valueCm|\.text\b/)
  })

  it('the end-span and wall-refutation rules read chain records and the wall witness, never the published facts', () => {
    const decomposition = codeOf(read('packages/reconstruction/src/plan-decomposition.ts'))
    for (const name of ['dimensionedAxis', 'endSpanSupport', 'refuteByWalls']) expect(bodyOf(decomposition, name)).not.toMatch(/publish|footprint|areaM2|model\b|metrics\./i)
  })
})

// --- behaviour: relabelling every label with other digits moves no binding ------------------------------------------

const H = 16
const token = (text: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: TextToken['orientation']): TextToken => ({
  text,
  score: 0.8,
  confidence: 0.9,
  box,
  shearDeg: 0,
  height: H,
  orientation,
  glyphs: [...text].map((char, i) => ({ char, score: 0.8, confidence: 0.9, alternatives: [], box: { x0: box.x0, x1: box.x1, y0: box.y0 + ((box.y1 - box.y0) * i) / text.length, y1: box.y0 + ((box.y1 - box.y0) * (i + 1)) / text.length }, holes: { count: 0, cy: 0.5, areaFrac: 0 } })),
})
const vChain = (x: number, ticks: number[]): RawChain => ({ axis: 'VERTICAL', baselinePx: x, ticks: ticks.map((atPx) => ({ atPx, baselinePx: x, observationId: '' })), observationIds: [] })
/** A label left of the line at `x`, reading bottom to top, centred between `a` and `b`. */
const vLabel = (text: string, x: number, a: number, b: number, gap: number): TextToken => token(text, { x0: x - gap - H, x1: x - gap, y0: (a + b) / 2 - text.length * 5, y1: (a + b) / 2 + text.length * 5 }, 'ROTATED_CW')

describe('§8 behaviour: values do not choose lines', () => {
  // The blind-7 class at this file's numbers: an overall line and its parts 24 px apart, the middle part's number
  // between them and nearer the overall line.
  const chains = [vChain(60, [120, 560]), vChain(84, [120, 160, 520, 560])]
  const layout = (texts: [string, string, string, string]): TextToken[] => [vLabel(texts[0], 60, 120, 560, 4), vLabel(texts[1], 84, 120, 160, 5), vLabel(texts[2], 84, 160, 520, 5), vLabel(texts[3], 84, 520, 560, 5)]
  const bindings = (tokens: TextToken[]): string[] => assignLabels(chains, tokens).decisions.map((d) => `${Math.round((d.box.y0 + d.box.y1) / 2)}:${d.status}:${d.chosen ? `${d.chosen.chain}#${d.chosen.interval}` : '-'}`).sort()

  it('the drawing’s own numbers bind each label to its own line', () => {
    expect(bindings(layout(['1100', '100', '900', '100']))).toEqual(['140:BOUND:1#0', '340:BOUND:0#0', '340:BOUND:1#1', '540:BOUND:1#2'].sort())
  })

  it('any other numbers — an arithmetic that does not close, values that would give another area — bind the same way', () => {
    const reference = bindings(layout(['1100', '100', '900', '100']))
    for (const texts of [['1000', '100', '900', '100'], ['1100', '250', '600', '250'], ['999', '11', '777', '55'], ['2200', '200', '1800', '200']] as Array<[string, string, string, string]>) {
      expect(bindings(layout(texts))).toEqual(reference)
    }
  })
})
