/**
 * BUILDPLAN-ANALYZER-005D §8–§20: the Analyzer Evidence Pack is observational.
 *
 * A synthetic house is run twice through the very script a developer and CI run
 * (`analysis:second-house`), once without evidence mode and once with it. The pack is built
 * after the run from the files the run wrote; this suite seals what that promises:
 *
 *   - ON == OFF: every hash and every decision the run made is the same with the pack and
 *     without it, and writing the pack changes no file of the run;
 *   - the pack is deterministic: the same run gives the same bytes, the manifest included;
 *   - it is complete and self-describing: every required file, an SVG with a JSON sidecar
 *     for each layer, a manifest whose hashes are the files' own;
 *   - it never carries a publisher's pixels: no raster in any SVG, and the only picture is
 *     the analyzer's own render of its model, bounded;
 *   - it is bounded, and the first-divergence helper names the first decision that differs.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fileByteCache } from '@buildapp/source-package'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { FORBIDDEN_IN_SVG, PACK_BOUNDS, PACK_FILES, TIMELINE_STAGES, buildEvidencePack, firstDivergence } from '@buildapp/evidence-pack'
import type { DecisionEvent } from '@buildapp/evidence-pack'
import { packRunDir, readRunDir } from '../../evidence-pack/scripts/run-dir.js'
import { runAnalysis } from '../src/index.js'
import { secondHouse, writeEvidencePack } from '../scripts/second-house.js'

const sha = (b: Uint8Array | string): string => createHash('sha256').update(b).digest('hex')
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? filesUnder(p) : [p]
  })
const hashesOfDir = (dir: string, skip: (name: string) => boolean): Record<string, string> =>
  Object.fromEntries(
    filesUnder(dir)
      .map((p) => relative(dir, p))
      .filter((n) => !skip(n))
      .sort()
      .map((n) => [n, sha(readFileSync(join(dir, n)))]),
  )
/** What carries wall-clock time and nothing the analyzer decided. */
const TIMED = (n: string): boolean => ['performance.json', 'telemetry.ndjson', 'evidence-performance.json', 'result-summary.json', 'analysis-trace.json'].includes(n) || n.startsWith('evidence-pack/')
const summaryHashes = (dir: string): Record<string, unknown> => {
  const s = JSON.parse(readFileSync(join(dir, 'result-summary.json'), 'utf8')) as Record<string, unknown>
  return Object.fromEntries(Object.entries(s).filter(([k]) => k.endsWith('Hash') || k === 'sceneSha256' || k === 'counts' || k === 'warningDetails'))
}
const traceDecisions = (dir: string): unknown =>
  (JSON.parse(readFileSync(join(dir, 'analysis-trace.json'), 'utf8')) as { entries: Array<Record<string, unknown>> }).entries.map((e) => [e.stage, e.substage, e.status, e.counts, e.reasonCode ?? null])

let root = ''
let off = ''
let on = ''
const previousOffline = process.env.OFFLINE

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'evidence-pack-'))
  const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
  // The bytes the publisher serves, on disk where the script reads them; then the script, offline.
  const cache = fileByteCache(join(root, 'cache'))
  const first = await runAnalysis({ kind: 'URL', url: publisher.pageUrl('larchfield-lf01') }, { adapters: [publisher.adapter], deps: publisher.deps, cache, now: () => new Date('2026-01-01T00:00:00Z') })
  writeFileSync(join(root, 'source-package.json'), JSON.stringify(first.pkg))
  writeFileSync(join(root, 'observation-graph.json'), JSON.stringify(first.graph))
  process.env.OFFLINE = '1'
  const args = (out: string): string[] => ['--package', join(root, 'source-package.json'), '--graph', join(root, 'observation-graph.json'), '--cache', join(root, 'cache'), '--out', out]
  off = join(root, 'off')
  on = join(root, 'on')
  const quiet = (): void => undefined
  expect(await secondHouse(args(off), quiet)).toBe('COMPLETED')
  expect(await secondHouse([...args(on), '--evidence', join(on, 'evidence-pack')], quiet)).toBe('COMPLETED')
}, 600_000)

afterAll(() => {
  if (previousOffline === undefined) delete process.env.OFFLINE
  else process.env.OFFLINE = previousOffline
})

describe('Evidence Pack: observational by construction (ON == OFF)', () => {
  it('a run with evidence mode on decides exactly what a run with it off decides', () => {
    const before = hashesOfDir(on, TIMED)
    writeEvidencePack(['--evidence', join(on, 'evidence-pack')], on, () => undefined)
    // Writing the pack changed no file the run wrote.
    expect(hashesOfDir(on, TIMED)).toEqual(before)
    // And the two runs are the same run: every file, every hash, every traced decision.
    expect(hashesOfDir(on, TIMED)).toEqual(hashesOfDir(off, TIMED))
    expect(summaryHashes(on)).toEqual(summaryHashes(off))
    expect(traceDecisions(on)).toEqual(traceDecisions(off))
    expect(existsSync(join(on, 'evidence-pack', 'manifest.json'))).toBe(true)
    expect(existsSync(join(off, 'evidence-pack'))).toBe(false)
  })

  it('evidence mode is off by default', () => {
    const before = hashesOfDir(off, () => false)
    writeEvidencePack([], off, () => undefined)
    expect(hashesOfDir(off, () => false)).toEqual(before)
  })
})

describe('Evidence Pack: deterministic, complete, bounded, free of publisher pixels', () => {
  const pack = (dir: string, out: string) => packRunDir(dir, out, 'larchfield', { gitSha: '0'.repeat(40), versions: { fixture: '1' } }).pack

  it('the same run gives the same bytes, manifest included — whichever of two identical runs it is built from', () => {
    const a = pack(off, join(root, 'pack-a'))
    const b = pack(off, join(root, 'pack-b'))
    const c = pack(on, join(root, 'pack-c'))
    expect(hashesOfDir(join(root, 'pack-b'), () => false)).toEqual(hashesOfDir(join(root, 'pack-a'), () => false))
    expect(hashesOfDir(join(root, 'pack-c'), () => false)).toEqual(hashesOfDir(join(root, 'pack-a'), () => false))
    expect(b.manifest).toEqual(a.manifest)
    expect(c.timeline).toEqual(a.timeline)
  })

  it('carries every required file, a JSON sidecar for every layer drawn, and a manifest of their own hashes', () => {
    const p = pack(off, join(root, 'pack-files'))
    for (const name of PACK_FILES) expect(p.files.has(name), name).toBe(true)
    expect(p.files.has('manifest.json')).toBe(true)
    for (const name of p.files.keys()) if (name.endsWith('.svg') && name !== 'evidence-summary.svg') expect(p.files.has(name.replace(/\.svg$/, '.json')), `${name} sidecar`).toBe(true)
    for (const f of p.manifest.files) {
      const content = readFileSync(join(root, 'pack-files', f.name))
      expect(sha(content), f.name).toBe(f.sha256)
      expect(content.length).toBe(f.bytes)
    }
    expect(p.manifest.result).toBe('COMPLETED')
    expect(p.manifest.hashes.model).toBe(summaryHashes(off).modelHash)
    expect(p.manifest.versions.fixture).toBe('1')
  })

  it('never embeds a raster or a reference in an SVG, and its only picture is the analyzer’s own bounded render', () => {
    const p = pack(off, join(root, 'pack-pixels'))
    const sourceBytes = new Set(filesUnder(join(root, 'cache')).filter((f) => f.endsWith('.bin')).map((f) => sha(readFileSync(f))))
    for (const [name, content] of p.files) {
      if (typeof content === 'string') {
        if (name.endsWith('.svg')) {
          for (const re of FORBIDDEN_IN_SVG) expect(re.test(content), `${name} ${re}`).toBe(false)
          // An allowlist the writer does not share: only the primitives an analyzer layer draws.
          const elements = new Set([...content.matchAll(/<([a-zA-Z][\w:-]*)/g)].map((m) => m[1]))
          for (const e of elements) expect(['svg', 'g', 'rect', 'line', 'circle', 'polygon', 'polyline', 'text', 'tspan', 'title', 'desc'], `${name} <${e}>`).toContain(e)
        }
        continue
      }
      expect(name).toBe('16-final-model-preview.png')
      expect(sourceBytes.has(sha(content))).toBe(false)
      // PNG width is big-endian at byte 16.
      const width = (content[16] << 24) | (content[17] << 16) | (content[18] << 8) | content[19]
      expect(width).toBeLessThanOrEqual(PACK_BOUNDS.previewWidth)
    }
  })

  it('stays within its bounds', () => {
    const p = pack(off, join(root, 'pack-bounds'))
    for (const [name, content] of p.files) {
      if (typeof content !== 'string') continue
      if (name.endsWith('.json')) expect(content.length, name).toBeLessThanOrEqual(PACK_BOUNDS.jsonBytes)
      if (name.endsWith('.svg')) expect((content.match(/<(?!\/)[a-z]/g) ?? []).length, name).toBeLessThanOrEqual(PACK_BOUNDS.svgElements + 16)
    }
  })

  it('the pack is built from the run files and nothing else: a run record read twice builds the same pack', () => {
    const r = readRunDir(off, 'larchfield', { gitSha: 'x', versions: {} })
    expect(buildEvidencePack(r).manifest).toEqual(buildEvidencePack(readRunDir(off, 'larchfield', { gitSha: 'x', versions: {} })).manifest)
  })
})

describe('first divergence', () => {
  const ev = (seq: number, stage: DecisionEvent['stage'], objectId: string, decision: string): DecisionEvent => ({ eventId: `e${seq}`, seq, stage, objectId, decision, reason: '', supportIds: [], conflictIds: [], reversible: true, downstream: [] })

  it('two runs of the same pack do not diverge', () => {
    const p = pack0()
    expect(firstDivergence(p.timeline, p.timeline).firstDivergence).toBe('NONE')
  })

  it('names the first stage, in analyzer order, and the first object in it whose decision differs', () => {
    const before = [ev(1, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:230', 'ACCEPTED'), ev(2, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:580', 'ACCEPTED'), ev(3, 'SCALE_HYPOTHESIS', 'scale', 'SELECTED 3.43'), ev(4, 'FINAL', 'model', 'COMPLETED')]
    const after = [ev(1, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:230', 'REJECTED'), ev(2, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:580', 'ACCEPTED_QUESTIONABLE'), ev(3, 'SCALE_HYPOTHESIS', 'scale', 'SELECTED 2.50'), ev(4, 'FINAL', 'model', 'FAILED')]
    const d = firstDivergence(before, after)
    expect(d).toMatchObject({ firstDivergence: 'DIMENSION_TICK_CLASSIFICATION', object: 'tick:c1:230', before: 'ACCEPTED', after: 'REJECTED', differing: 1 })
    // A named doubt is the same decision; later stages are listed as following from the first.
    expect(d.stagesDiffering).toEqual(['DIMENSION_TICK_CLASSIFICATION', 'SCALE_HYPOTHESIS', 'FINAL'])
  })

  it('an object only one run met is a divergence too (ABSENT on the other side)', () => {
    const d = firstDivergence([ev(1, 'OCR_READING', 'label:a', 'READ')], [ev(1, 'OCR_READING', 'label:a', 'READ'), ev(2, 'OCR_READING', 'label:b', 'READ')])
    expect(d).toMatchObject({ firstDivergence: 'OCR_READING', object: 'label:b', before: 'ABSENT', after: 'READ' })
  })

  it('a mark only one run recorded is what a later stage kept, not a classification: the first divergence is that later stage (005E)', () => {
    // Both runs classified every mark alike; the later run kept one more chain (its label now reads), so the pack records its marks.
    const before = [ev(1, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:230', 'ACCEPTED'), ev(2, 'OCR_READING', 'label:a', 'READ 1501')]
    const after = [ev(1, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:230', 'ACCEPTED'), ev(2, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c2:137.5', 'ACCEPTED'), ev(3, 'OCR_READING', 'label:a', 'READ 1580')]
    const d = firstDivergence(before, after)
    expect(d).toMatchObject({ firstDivergence: 'OCR_READING', object: 'label:a', before: 'READ 1501', after: 'READ 1580' })
    expect(d.stagesDiffering).toEqual(['OCR_READING'])
    expect(d.recordedByOneRunOnly).toEqual([{ stage: 'DIMENSION_TICK_CLASSIFICATION', objects: 1 }])
    // A mark both runs recorded and classified differently is still the classification's divergence.
    const flipped = [ev(1, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c1:230', 'REJECTED'), ev(2, 'DIMENSION_TICK_CLASSIFICATION', 'tick:c2:137.5', 'ACCEPTED'), ev(3, 'OCR_READING', 'label:a', 'READ 1580')]
    expect(firstDivergence(before, flipped)).toMatchObject({ firstDivergence: 'DIMENSION_TICK_CLASSIFICATION', object: 'tick:c1:230', differing: 1 })
  })

  const pack0 = () => packRunDir(off, join(root, 'pack-div'), 'larchfield', { versions: {} }).pack
})

describe('Evidence Pack: the OCR extension (BUILDPLAN-ANALYZER-005E §23)', () => {
  const ocrOf = (out: string): { latticeRecorded: boolean; lattices: Array<Record<string, unknown>> } => {
    const p = packRunDir(off, join(root, out), 'larchfield', { versions: {} }).pack
    return JSON.parse(String(p.files.get('07-ocr-labels.json'))) as { latticeRecorded: boolean; lattices: Array<Record<string, unknown>> }
  }

  it('records each dimension label’s lattice — raw top read, top-K, image score, per-glyph alternatives, margins, segmentation, selection, metric support, rejection reasons', () => {
    const ocr = ocrOf('pack-ocr')
    expect(ocr.latticeRecorded).toBe(true)
    expect(ocr.lattices.length).toBeGreaterThan(0)
    for (const l of ocr.lattices) {
      for (const key of ['rawTopRead', 'asRead', 'asReadVariant', 'ocrClass', 'asReadP', 'probabilityMargin', 'sequenceMargin', 'sequences', 'glyphs', 'segmentations', 'selected', 'refutedBy']) expect(l, `${String(l.id)} ${key}`).toHaveProperty(key)
      const sequences = l.sequences as Array<{ imageScore: number; p: number; asRead: boolean; rejected: string | null }>
      expect(sequences.length).toBeGreaterThan(0)
      expect(sequences.filter((q) => q.asRead)).toHaveLength(1)
      for (const q of sequences) expect(typeof q.imageScore).toBe('number')
      for (const g of l.glyphs as Array<{ candidates: unknown[] }>) expect(g.candidates.length).toBeGreaterThan(0)
      expect((l.segmentations as Array<{ kind: string }>).some((s) => s.kind === 'ANCHOR')).toBe(true)
    }
    // Image score and metric support are recorded apart: a selected value says how the image ranked it and how far
    // it sits from the chosen scale, separately.
    const selected = ocr.lattices.map((l) => l.selected as { imageRank: number | null; metricSupportResidualPx: number | null } | null).filter((s) => s !== null)
    expect(selected.length).toBeGreaterThan(0)
    for (const s of selected) {
      expect(s).toHaveProperty('imageRank')
      expect(s).toHaveProperty('metricSupportResidualPx')
    }
  })

  it('carries readings and boxes, never glyph pixels', () => {
    const text = JSON.stringify(ocrOf('pack-ocr-pixels'))
    expect(text).not.toMatch(/base64|data:image|"pixels"|"bitmap"|"data":\[/)
  })

  it('the candidate set is its own timeline stage, before the reading it feeds', () => {
    const p = packRunDir(off, join(root, 'pack-ocr-timeline'), 'larchfield', { versions: {} }).pack
    const candidates = p.timeline.filter((e) => e.stage === 'OCR_SEQUENCE_CANDIDATES')
    expect(candidates.length).toBeGreaterThan(0)
    const firstReading = p.timeline.findIndex((e) => e.stage === 'OCR_READING')
    const lastCandidates = p.timeline.map((e) => e.stage).lastIndexOf('OCR_SEQUENCE_CANDIDATES')
    if (firstReading >= 0) expect(lastCandidates).toBeLessThan(firstReading)
    for (const e of candidates) expect(e.decision).toMatch(/^CANDIDATES:/)
  })

  it('a changed candidate set is the first divergence, ahead of the reading and the scale it changes', () => {
    const ev = (seq: number, stage: DecisionEvent['stage'], objectId: string, decision: string): DecisionEvent => ({ eventId: `e${seq}`, seq, stage, objectId, decision, reason: '', supportIds: [], conflictIds: [], reversible: true, downstream: [] })
    const before = [ev(1, 'OCR_SEQUENCE_CANDIDATES', 'ink:a:HORIZONTAL', 'CANDIDATES:2301|2101,2601'), ev(2, 'OCR_READING', 'label:a', 'READ 2301'), ev(3, 'SCALE_HYPOTHESIS', 'scale', 'SELECTED 2.67')]
    const after = [ev(1, 'OCR_SEQUENCE_CANDIDATES', 'ink:a:HORIZONTAL', 'CANDIDATES:2380|2301,2360'), ev(2, 'OCR_READING', 'label:a', 'READ 2380'), ev(3, 'SCALE_HYPOTHESIS', 'scale', 'SELECTED 2.81')]
    expect(firstDivergence(before, after)).toMatchObject({ firstDivergence: 'OCR_SEQUENCE_CANDIDATES', object: 'ink:a:HORIZONTAL' })
  })
})

describe('Evidence Pack: the glyph-count and extent-conflict layers (BUILDPLAN-ANALYZER-005F)', () => {
  const ev = (seq: number, stage: DecisionEvent['stage'], objectId: string, decision: string): DecisionEvent => ({ eventId: `e${seq}`, seq, stage, objectId, decision, reason: '', supportIds: [], conflictIds: [], reversible: true, downstream: [] })

  it('the glyph count is decided before the candidate set it bounds, and the extent conflict between the envelope and the bodies', () => {
    const at = (s: DecisionEvent['stage']): number => TIMELINE_STAGES.indexOf(s)
    expect(at('GLYPH_COUNT_HYPOTHESES')).toBeLessThan(at('OCR_SEQUENCE_CANDIDATES'))
    expect(at('ENVELOPE')).toBeLessThan(at('ENVELOPE_EXTENT_CONFLICT'))
    expect(at('ENVELOPE_EXTENT_CONFLICT')).toBeLessThan(at('BODIES'))
  })

  it('a changed glyph count is the first divergence, ahead of the candidates, the reading and the scale it changes', () => {
    const before = [ev(1, 'OCR_SEQUENCE_CANDIDATES', 'ink:a:HORIZONTAL', 'CANDIDATES:1011|1017'), ev(2, 'OCR_READING', 'label:a', 'READ 1011'), ev(3, 'SCALE_HYPOTHESIS', 'scale', 'SELECTED 2.67')]
    const after = [ev(1, 'GLYPH_COUNT_HYPOTHESES', 'ink:a:HORIZONTAL', 'COUNTS:3|4|DECIDED'), ev(2, 'OCR_SEQUENCE_CANDIDATES', 'ink:a:HORIZONTAL', 'CANDIDATES:200|1011'), ev(3, 'OCR_READING', 'label:a', 'READ 200'), ev(4, 'SCALE_HYPOTHESIS', 'scale', 'SELECTED 2.00')]
    expect(firstDivergence(before, after)).toMatchObject({ firstDivergence: 'GLYPH_COUNT_HYPOTHESES', object: 'ink:a:HORIZONTAL', before: 'ABSENT' })
  })

  it('a completion judged differently is the first divergence, ahead of the bodies and the masses it changes', () => {
    const before = [ev(1, 'ENVELOPE', 'envelope:f', 'BOX:0,0,600,700'), ev(2, 'ENVELOPE_EXTENT_CONFLICT', 'extent-conflict:f:E', 'E:ZONE'), ev(3, 'BODIES', 'body:f:0:BAY', 'NOT_BUILT')]
    const after = [ev(1, 'ENVELOPE', 'envelope:f', 'BOX:0,0,600,700'), ev(2, 'ENVELOPE_EXTENT_CONFLICT', 'extent-conflict:f:E', 'E:ACCEPTED'), ev(3, 'ENVELOPE_EXTENT_CONFLICT', 'completion:f:0:ATTACHED_ROOM', 'ACCEPTED'), ev(4, 'BODIES', 'body:f:0:BAY', 'BUILT')]
    expect(firstDivergence(before, after)).toMatchObject({ firstDivergence: 'ENVELOPE_EXTENT_CONFLICT', object: 'extent-conflict:f:E', before: 'E:ZONE', after: 'E:ACCEPTED' })
  })

  it('each label’s lattice carries its glyph counts, the plan’s style, what the segmentation tried, and a tail marked as such', () => {
    const p = packRunDir(off, join(root, 'pack-005f'), 'larchfield', { versions: {} }).pack
    const ocr = JSON.parse(String(p.files.get('07-ocr-labels.json'))) as { lattices: Array<Record<string, unknown>> }
    expect(ocr.lattices.length).toBeGreaterThan(0)
    for (const l of ocr.lattices) {
      for (const key of ['countHypotheses', 'style', 'segmentation', 'tail']) expect(l, `${String(l.id)} ${key}`).toHaveProperty(key)
      for (const t of l.tail as Array<{ origin: string }>) expect(t.origin).toBe('AMBIGUITY_TAIL')
    }
    // the layers are recorded only where something was decided there: every event of them names a known object
    for (const e of p.timeline.filter((x) => x.stage === 'GLYPH_COUNT_HYPOTHESES')) expect(e.decision).toMatch(/^COUNTS:/)
    for (const e of p.timeline.filter((x) => x.stage === 'ENVELOPE_EXTENT_CONFLICT')) expect(e.objectId).toMatch(/^(extent-conflict|completion):/)
  })
})
