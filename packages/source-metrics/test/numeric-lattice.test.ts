import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORPUS_SEEDS, Canvas, digitCorpus, renderLabel } from '@buildapp/synthetic-drawings'
import type { CorpusSpecimen } from '@buildapp/synthetic-drawings'
import { INK_VARIANTS, LATTICE_BOUNDS, boundedValues, labelLattice, parseNumber, readNumbers, readingLattice } from '../src/index.js'
import type { Raster } from '@buildapp/source-cv'
import type { LabelLattice, LatticeCache, TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005E: the numeric lattice, on the reader alone.
 *
 * The lattice re-reads one label's ink and returns what the image supports: ink variants, re-cuts at column valleys,
 * per-glyph candidates and a bounded beam over them. These tests hold it to its contract — deterministic, bounded,
 * image-only, the as-read string never a re-cut — and to the defects it exists for: a truth two glyphs away from the
 * top read (§30), and a misread named rather than silent (§28 on blurred figures, which the 005D reader failed).
 * The corpus gate (§26–28) measures candidate recall on two disjoint generated corpora drawn in stroke faces that
 * are neither the reader's templates nor any publisher's font.
 */

type Read = { token: TextToken; lattice: LabelLattice | undefined; raster: Raster }

/** The widest horizontal raw token over the label, and its lattice, read as production reads a plan. */
function readLabel(raster: Raster, cache?: LatticeCache): Read | undefined {
  const read = readNumbers(raster, { orientations: ['HORIZONTAL'], hypotheses: true, retainPasses: true })
  const token = (read.raw ?? []).filter((t) => t.orientation === 'HORIZONTAL').sort((a, b) => b.box.x1 - b.box.x0 - (a.box.x1 - a.box.x0) || a.box.x0 - b.box.x0)[0]
  const ink = read.passes?.HORIZONTAL
  if (!token || !ink) return undefined
  return { token, raster, lattice: labelLattice({ orientation: 'HORIZONTAL', ink, page: { width: raster.width, height: raster.height } }, token, cache) }
}
const texts = (l: LabelLattice | undefined): string[] => (l?.sequences ?? []).map((s) => s.text)
/** 005D's bounded readings of a token: as read, or one glyph away at a runner ratio ≥ 0.7. */
const oneSubstitution = (t: TextToken): string[] => [t.text, ...boundedValues(t).map((b) => b.text), ...readingLattice(t).filter((r) => r.substitutions <= 1).map((r) => r.text)]
const specimen = (seed: number, id: string): CorpusSpecimen => {
  const s = digitCorpus(seed, 24).find((x) => x.id === id)
  if (!s) throw new Error(`no specimen ${id}`)
  return s
}

describe('the lattice is deterministic, bounded and image-only', () => {
  const label = (): Raster => renderLabel('4785', { capHeight: 15, slant: 0.2, pen: 1.6, gap: 0.12, face: 'A' }).raster

  it('the same ink gives the same lattice, and the cache returns it unchanged', () => {
    const a = readLabel(label())
    const b = readLabel(label())
    expect(a?.lattice).toBeDefined()
    expect(JSON.stringify(b?.lattice)).toBe(JSON.stringify(a?.lattice))
    const cache: LatticeCache = new Map()
    const miss = readLabel(label(), cache)
    const hit = readLabel(label(), cache)
    expect(miss?.lattice?.cache).toBe('MISS')
    expect(hit?.lattice?.cache).toBe('HIT')
    const strip = (l: LabelLattice | undefined): string => JSON.stringify({ ...l, cache: undefined })
    expect(strip(hit?.lattice)).toBe(strip(a?.lattice))
  })

  it('a cached crop is verified byte for byte: a different ink under the same box is read afresh', () => {
    const cache: LatticeCache = new Map()
    const first = readLabel(renderLabel('4785', { capHeight: 15, face: 'A' }).raster, cache)
    const second = readLabel(renderLabel('4786', { capHeight: 15, face: 'A' }).raster, cache)
    expect(second?.lattice?.cache).toBe('MISS')
    expect(second?.lattice?.asRead).not.toBe(first?.lattice?.asRead)
  })

  it('every bound holds: variants, cuts, candidates per cell, sequences, probabilities', () => {
    for (const sp of digitCorpus(CORPUS_SEEDS.calibration, 3)) {
      const l = readLabel(renderLabel(sp.text, sp.style).raster)?.lattice
      if (!l) continue
      expect(l.sequences.length, sp.id).toBeLessThanOrEqual(LATTICE_BOUNDS.sequences)
      expect(new Set(l.paths.map((p) => p.variant)).size).toBeLessThanOrEqual(LATTICE_BOUNDS.variants)
      for (const v of INK_VARIANTS) expect(l.paths.filter((p) => p.variant === v).length, `${sp.id} ${v}`).toBeLessThanOrEqual(LATTICE_BOUNDS.segmentations)
      for (const p of l.paths) {
        expect(p.changedBoundaries).toBeLessThanOrEqual(LATTICE_BOUNDS.movedBoundaries)
        expect(p.glyphs.length).toBeLessThanOrEqual(LATTICE_BOUNDS.maxCells)
        for (const g of p.glyphs) expect(g.candidates.length).toBeLessThanOrEqual(LATTICE_BOUNDS.perCell)
      }
      for (const s of l.sequences) {
        expect(s.nonTop.length).toBeLessThanOrEqual(LATTICE_BOUNDS.nonTop)
        expect(s.p).toBeGreaterThan(0)
        expect(s.p).toBeLessThanOrEqual(1)
      }
      expect(l.sequences.reduce((a, s) => a + s.p, 0)).toBeLessThanOrEqual(1 + 1e-5)
      expect(l.sequences.filter((s) => s.asRead)).toHaveLength(1)
    }
  })

  it('the as-read string is an anchor — the reader’s own cuts of one ink variant — never a re-cut', () => {
    for (const sp of digitCorpus(CORPUS_SEEDS.calibration, 3)) {
      const l = readLabel(renderLabel(sp.text, sp.style).raster)?.lattice
      if (!l) continue
      const anchors = l.paths.filter((p) => p.kind === 'ANCHOR')
      const anchorTexts = anchors.map((p) => p.glyphs.map((g) => g.candidates[0]?.char ?? '').join(''))
      expect(anchorTexts, `${sp.id}: as read ${l.asRead}`).toContain(l.asRead)
      expect(anchors.find((p) => p.variant === l.asReadVariant)).toBeDefined()
    }
  })

  it('image only: the lattice module imports the reader, the parser and pixels — no chain, no scale, no metric', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../src/numeric-lattice.ts'), 'utf8')
    const imports = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    expect(imports.sort()).toEqual(['./ocr.js', './ocr.js', './parse.js', './schema.js', '@buildapp/source-common', '@buildapp/source-common', '@buildapp/source-cv'].sort())
    // `schema.js` only for unit conversion of a value the image states.
    expect(source).toMatch(/import \{ toCentimetres \} from '\.\/schema\.js'/)
    expect(labelLattice.length).toBe(3)
  })
})

describe('§30 two-substitution adversary: the truth two glyphs from the top read', () => {
  // Generated specimens (calibration seed) on which the reader's top read differs from the printed figure at two
  // positions: the 005D one-substitution set cannot hold the truth; the beam must, as an image-supported sequence.
  for (const id of ['italic-5001-10', 'clean-5001-7']) {
    it(`${id}: the old one-substitution generator misses it, the beam keeps it`, () => {
      const sp = specimen(CORPUS_SEEDS.calibration, id)
      const r = readLabel(renderLabel(sp.text, sp.style).raster)
      expect(r).toBeDefined()
      if (!r) return
      const diff = [...r.token.text].filter((c, i) => c !== sp.text[i]).length
      expect(r.token.text.length).toBe(sp.text.length)
      expect(diff, `${sp.text} read ${r.token.text}`).toBe(2)
      expect(oneSubstitution(r.token)).not.toContain(sp.text)
      const seq = r.lattice?.sequences.find((s) => s.text === sp.text)
      expect(seq, `${sp.text} in ${texts(r.lattice).join(',')}`).toBeDefined()
      expect(seq?.nonTop.length ?? 0).toBeGreaterThanOrEqual(1)
      expect(seq?.p ?? 0).toBeGreaterThanOrEqual(LATTICE_BOUNDS.floor)
    })
  }
})

describe('§28 under the lattice: a misread is named, or it is no dimension', () => {
  /** The 3×3 blur of `glyph-ambiguity.test.ts`, which the 005D reader failed (`it.fails` there). */
  const blurred = (text: string): Raster => {
    const c = new Canvas(400, 160)
    c.text(text, 40, 60, 16, { slant: 0.18 })
    const r = c.toRaster()
    const g = (x: number, y: number): number => (x < 0 || y < 0 || x >= r.width || y >= r.height ? 255 : r.data[(y * r.width + x) * 4])
    const out = new Uint8ClampedArray(r.data.length)
    for (let y = 0; y < r.height; y += 1) {
      for (let x = 0; x < r.width; x += 1) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) sum += g(x + dx, y + dy) * (dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1)
        const o = (y * r.width + x) * 4
        out[o] = out[o + 1] = out[o + 2] = sum / 16
        out[o + 3] = 255
      }
    }
    return { width: r.width, height: r.height, data: out }
  }
  for (const text of ['1200', '760']) {
    it(`blurred ${text}: read as printed, or read otherwise without CLEAR and with the truth among the image's values`, () => {
      const r = readLabel(blurred(text))
      expect(r?.lattice).toBeDefined()
      const l = r?.lattice
      if (!l || l.asReadValueCm === undefined) return
      if (l.asRead === text) return
      expect(l.ocrClass, `${text} read ${l.asRead}`).not.toBe('CLEAR')
      expect(texts(l), `${text} read ${l.asRead}`).toContain(text)
    })
  }

  it('broken strokes: a figure cut through its middle is never a CLEAR different dimension', () => {
    const c = new Canvas(400, 160)
    c.text('3575', 40, 60, 16)
    for (let x = 40; x < 140; x += 1) c.plot(x, 68, 255)
    const r = readLabel(c.toRaster())
    const l = r?.lattice
    if (!l || l.asReadValueCm === undefined || l.asRead === '3575') return
    expect(l.ocrClass).not.toBe('CLEAR')
  })
})

describe('touching hollow pairs (80, 00, 60, 90, 08)', () => {
  // A `0` beside another hollow glyph is where the 005D reader cut through a counter instead of the junction. At
  // ordinary spacing the lattice's re-cuts and ink variants recover the figure; under tight kerning and fused strokes
  // no column valley separates the glyphs and nothing recovers it (a declared limit, measured in the stage's
  // calibration tables) — there a wrong reading must at least not be CLEAR.
  const pairs = ['1080', '2006', '3609', '4890', '6080', '8060']
  it('ordinary spacing: the lattice holds the printed figure where the 005D bounded readings mostly do not', () => {
    let lattice = 0
    let old = 0
    for (const text of pairs) {
      for (const face of ['A', 'B'] as const) {
        const r = readLabel(renderLabel(text, { capHeight: 16, slant: 0.15, pen: 1.6, gap: 0.12, face }).raster)
        if (!r) continue
        if (texts(r.lattice).includes(text)) lattice += 1
        if (oneSubstitution(r.token).includes(text)) old += 1
      }
    }
    expect(lattice, `lattice ${lattice}, 005D ${old} of 12`).toBeGreaterThanOrEqual(11)
    expect(lattice).toBeGreaterThan(old)
  })

  it('tight kerning and fused strokes: never a CLEAR wrong reading', () => {
    for (const gap of [0.08, 0.05, 0]) {
      for (const text of pairs) {
        for (const face of ['A', 'B'] as const) {
          const l = readLabel(renderLabel(text, { capHeight: 16, slant: 0.15, pen: 1.6, gap, face }).raster)?.lattice
          if (!l || l.asRead === text) continue
          expect(l.ocrClass, `${text} (${face}, gap ${gap}) read ${l.asRead}`).not.toBe('CLEAR')
        }
      }
    }
  })
})

/**
 * §26–28: the corpus gate. Two disjoint generated corpora — calibration and held-back — of 240 labels each, ten
 * strata. Recall is "the printed figure is among the lattice's sequences", the quantity that matters downstream (a
 * truth that leaves the candidate set cannot be weighed). The gates sit under the values measured when the bounds
 * were fixed (the stage's calibration tables) so that a regression fails here; they were not chosen per house.
 */
describe('§26–28 corpus gate: candidate recall, as-read accuracy and CLEAR precision', () => {
  type Stats = { n: number; legacyTop: number; legacyBounded: number; asRead: number; recall: number; top3: number; clear: number; clearRight: number; ms: number }
  const measure = (seed: number): { all: Stats; byStratum: Map<string, Stats> } => {
    const zero = (): Stats => ({ n: 0, legacyTop: 0, legacyBounded: 0, asRead: 0, recall: 0, top3: 0, clear: 0, clearRight: 0, ms: 0 })
    const all = zero()
    const byStratum = new Map<string, Stats>()
    for (const sp of digitCorpus(seed, 24)) {
      const s = byStratum.get(sp.stratum) ?? zero()
      byStratum.set(sp.stratum, s)
      for (const x of [all, s]) x.n += 1
      const rendered = renderLabel(sp.text, sp.style)
      const t0 = performance.now()
      const r = readLabel(rendered.raster)
      const ms = performance.now() - t0
      for (const x of [all, s]) x.ms += ms
      if (!r) continue
      const rank = texts(r.lattice).indexOf(sp.text)
      for (const x of [all, s]) {
        if (r.token.text === sp.text) x.legacyTop += 1
        if (oneSubstitution(r.token).includes(sp.text)) x.legacyBounded += 1
        if (r.lattice?.asRead === sp.text) x.asRead += 1
        if (rank >= 0) x.recall += 1
        if (rank >= 0 && rank < 3) x.top3 += 1
        if (r.lattice?.ocrClass === 'CLEAR') {
          x.clear += 1
          if (r.lattice.asRead === sp.text) x.clearRight += 1
        }
      }
    }
    return { all, byStratum }
  }
  const gate = (label: string, seed: number, bars: { recall: number; asRead: number; clearPrecision: number }): void => {
    it(`${label} (seed ${seed}): recall ≥ ${bars.recall}, as read ≥ ${bars.asRead}, CLEAR right ≥ ${bars.clearPrecision}, and never below 005D`, () => {
      const { all, byStratum } = measure(seed)
      const said = JSON.stringify(all)
      expect(all.n).toBe(240)
      expect(all.recall / all.n, said).toBeGreaterThanOrEqual(bars.recall)
      expect(all.asRead / all.n, said).toBeGreaterThanOrEqual(bars.asRead)
      expect(all.clearRight / Math.max(1, all.clear), said).toBeGreaterThanOrEqual(bars.clearPrecision)
      // Against the 005D reader on the same ink: more labels read as printed, more truths kept as candidates.
      expect(all.asRead, said).toBeGreaterThan(all.legacyTop)
      expect(all.recall, said).toBeGreaterThan(all.legacyBounded)
      for (const [stratum, s] of byStratum) expect(s.recall, `${stratum}: ${JSON.stringify(s)}`).toBeGreaterThanOrEqual(s.legacyBounded - 1)
    }, 180_000)
  }
  gate('calibration corpus', CORPUS_SEEDS.calibration, { recall: 0.75, asRead: 0.5, clearPrecision: 0.88 })
  gate('held-back corpus', CORPUS_SEEDS.heldBack, { recall: 0.75, asRead: 0.47, clearPrecision: 0.9 })
})

/** Not a gate: no value in the lattice is a figure the grammar refuses. */
describe('the grammar', () => {
  it('every value a lattice states is a dimension the parser reads, without a leading zero', () => {
    for (const sp of digitCorpus(CORPUS_SEEDS.calibration, 2)) {
      const l = readLabel(renderLabel(sp.text, sp.style).raster)?.lattice
      for (const s of l?.sequences ?? []) {
        if (s.valueCm === undefined) continue
        expect(/^0\d/.test(s.text), s.text).toBe(false)
        expect(parseNumber(s.text).some((p) => p.kind === 'LINEAR_DIMENSION'), s.text).toBe(true)
      }
    }
  })
})
