import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORPUS_SEEDS, digitCorpus, renderLabel } from '@buildapp/synthetic-drawings'
import type { LabelStyle as DrawnStyle } from '@buildapp/synthetic-drawings'
import { COUNT_BOUNDS, NUMERIC_LATTICE_VERSION, OCR_CLASS_BOUNDS, TAIL_BOUNDS, correctionReadings, dimensionStyleOf, labelLattice, readNumbers, styleFor } from '../src/index.js'
import type { Raster } from '@buildapp/source-cv'
import type { LabelLattice, TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005F: a label's glyph count is a hypothesis of the image, never of a scale.
 *
 * 005E fixed the count at round(width / 0.55·cap): at a small cap the glyphs of a dimension touch, a four-glyph run is
 * a little narrower than four of those pitches, and it was cut into three — the printed figure could not enter the
 * lattice at all (005E blind round 5). Here the count is admitted by the width of the ink against the plan's own glyph
 * width (its style), by valley depth and by counter safety; the reader's count changes only when the plan's style rules
 * it out, an admitted count otherwise stays a re-cut, and a reading whose count is in doubt is never CLEAR.
 *
 * Every page here is generated (`renderLabel`, a stroke face that is neither the reader's templates nor a publisher's),
 * condensed with the face's `condense`. Nothing here is a drawing of any building.
 */

type Placed = { text: string; x: number; y: number; style: Partial<DrawnStyle> }

/** Labels laid out on one page, as a plan prints several dimensions in one face: the darker ink wins where two overlap. */
function page(labels: readonly Placed[], width = 900, height = 420): Raster {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const l of labels) {
    const r = renderLabel(l.text, l.style, 8, { width: 10, height: 10 }).raster
    for (let y = 0; y < r.height; y += 1) {
      for (let x = 0; x < r.width; x += 1) {
        const px = l.x + x
        const py = l.y + y
        if (px >= width || py >= height) continue
        const v = r.data[(y * r.width + x) * 4]
        const o = (py * width + px) * 4
        if (v < data[o]) data[o] = data[o + 1] = data[o + 2] = v
      }
    }
  }
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { width, height, data }
}

type PageRead = { lattice: LabelLattice | undefined; token: TextToken | undefined; pitch: number | null; samples: number }

/** The page read as a plan is read; the target's widest horizontal token near (x, y), and its lattice under the page's style. */
function readTarget(raster: Raster, at: { x: number; y: number }, withStyle = true): PageRead {
  const read = readNumbers(raster, { orientations: ['HORIZONTAL'], hypotheses: true, retainPasses: true })
  const style = withStyle ? dimensionStyleOf(read) : { samples: [] }
  const token = (read.raw ?? [])
    .filter((t) => t.orientation === 'HORIZONTAL' && t.passBox && Math.abs(t.box.y0 - at.y) < 30 && t.box.x0 >= at.x - 10 && t.box.x0 <= at.x + 40)
    .sort((a, b) => b.box.x1 - b.box.x0 - (a.box.x1 - a.box.x0) || a.box.x0 - b.box.x0)[0]
  const ink = read.passes?.HORIZONTAL
  if (!token || !ink) return { lattice: undefined, token, pitch: null, samples: 0 }
  const st = styleFor(style, token.height)
  return { lattice: labelLattice({ orientation: 'HORIZONTAL', ink, page: { width: raster.width, height: raster.height } }, token, undefined, st), token, pitch: st.pitch, samples: st.samples }
}

const counts = (l: LabelLattice): number[] => [...new Set(l.segmentation.counts.flatMap((c) => [c.anchor, ...c.alternatives]))].sort((a, b) => a - b)
const digits = (t: string): number => t.replace(/[^0-9]/g, '').length

/**
 * A plan in one face: context labels whose glyphs stand apart (the plan's style), and a target. The face is given by
 * its geometry, as pre-review A measured it on a condensed ARCHON plan: an isolated glyph's ink `iso` of the cap wide,
 * and glyphs set `pitch` of the cap apart — `iso` 0.455 and `pitch` 0.477 there, where a four-glyph run is a little
 * narrower than 005E's 4 × 0.55 · cap / round-down and its glyphs touch. The stroke face is condensed to that ink width.
 */
function plan(target: string, geo: { iso: number; pitch: number; cap: number; face?: 'A' | 'B' }, extra: Placed[] = []): { raster: Raster; at: { x: number; y: number } } {
  const pen = geo.cap / 10
  const ink = geo.iso - pen / geo.cap
  const base = { capHeight: geo.cap, slant: 0, pen, condense: ink / 0.56, face: geo.face ?? 'A' }
  const context = ['350', '1062', '297', '415', '732', '380', '642', '100'].map((text, i) => ({ text, x: 40 + (i % 4) * 200, y: 40 + Math.floor(i / 4) * 60, style: { ...base, gap: 0.3 } }))
  const at = { x: 60, y: 300 }
  return { raster: page([...context, ...extra.map((e) => ({ ...e, style: { ...base, ...e.style } })), { text: target, x: at.x, y: at.y, style: { ...base, gap: geo.pitch - ink } }]), at }
}
/** The condensed geometry of 005E blind 1, and an ordinary one. */
const CONDENSED = { iso: 0.455, pitch: 0.477 }
const ORDINARY = { iso: 0.6, pitch: 0.78 }

describe('the plan’s dimension-font style', () => {
  it('is read from isolated glyphs at the label’s cap, and is absent under the sample floor', () => {
    const { raster, at } = plan('2590', { ...CONDENSED, cap: 16 })
    const r = readTarget(raster, at)
    expect(r.samples).toBeGreaterThanOrEqual(COUNT_BOUNDS.styleSamples)
    expect(r.pitch).not.toBeNull()
    // the condensed face's isolated glyph is under half the cap; the ordinary face's well over it
    expect(r.pitch ?? 1).toBeLessThan(0.5)
    expect(readTarget(plan('2590', { ...ORDINARY, cap: 16 }).raster, at).pitch ?? 0).toBeGreaterThan(0.5)
    const lone = readTarget(renderLabel('2590', { capHeight: 16, slant: 0, pen: 1.6, condense: 0.6, gap: 0.12 }).raster, { x: 24, y: 24 })
    expect(lone.pitch, 'one label alone states no style').toBeNull()
  })

  it('is deterministic and image-only: the same page gives the same style and the same lattice', () => {
    const { raster, at } = plan('2590', { ...CONDENSED, cap: 16 })
    const a = readTarget(raster, at)
    const b = readTarget(raster, at)
    expect(a.pitch).toBe(b.pitch)
    expect(JSON.stringify(a.lattice)).toBe(JSON.stringify(b.lattice))
    expect(a.lattice?.reader.version).toBe(NUMERIC_LATTICE_VERSION)
  })
})

describe('§27 condensed labels: the right count stays a candidate', () => {
  for (const face of ['A', 'B'] as const) {
    for (const cap of [14, 16]) {
      it(`four condensed touching digits (face ${face}, cap ${cap}): 005E's three cells, and four glyphs now a count the lattice reads at`, () => {
        const { raster, at } = plan('2590', { ...CONDENSED, cap, face })
        const l = readTarget(raster, at).lattice
        expect(l).toBeDefined()
        if (!l) return
        // the reader's own count is the defect: three cells for four glyphs
        expect(l.segmentation.counts.some((c) => c.reader === 3), JSON.stringify(l.segmentation.counts)).toBe(true)
        expect(counts(l), JSON.stringify(l.segmentation.counts)).toContain(4)
        // and never a count two away from the reader's
        for (const c of l.segmentation.counts) {
          expect(Math.abs(c.anchor - c.reader)).toBeLessThanOrEqual(1)
          for (const k of c.alternatives) expect(Math.abs(k - c.anchor)).toBeLessThanOrEqual(1)
        }
      })
    }
    it(`five condensed digits (face ${face}): five glyphs is a count the lattice reads at`, () => {
      const { raster, at } = plan('12590', { ...CONDENSED, cap: 16, face })
      const l = readTarget(raster, at).lattice
      expect(l).toBeDefined()
      if (l) expect(counts(l), JSON.stringify(l.segmentation.counts)).toContain(5)
    })
  }

  it('without a plan style, a condensed run’s count is never replaced: an admitted count stays a re-cut', () => {
    const { raster, at } = plan('2590', { ...CONDENSED, cap: 16 })
    const l = readTarget(raster, at, false).lattice
    expect(l).toBeDefined()
    for (const c of l?.segmentation.counts ?? []) expect(c.decisive, JSON.stringify(c)).toBe(false)
  })

  it('normal spacing: a label whose glyphs stand apart keeps the reader’s count, with no alternative', () => {
    for (const text of ['1062', '350', '2590']) {
      const { raster, at } = plan(text, { ...ORDINARY, cap: 16 })
      const l = readTarget(raster, at).lattice
      expect(l).toBeDefined()
      if (!l) continue
      for (const c of l.segmentation.counts) {
        expect(c.decisive, `${text}: ${JSON.stringify(c)}`).toBe(false)
        expect(c.alternatives, `${text}: ${JSON.stringify(c)}`).toEqual([])
      }
    }
  })

  it('a page mixing condensed three- and four-digit labels: the three-digit label is never cut into four', () => {
    const pitch = CONDENSED.pitch - (CONDENSED.iso - 0.1)
    const { raster } = plan('2590', { ...CONDENSED, cap: 16 }, [{ text: '730', x: 400, y: 300, style: { gap: pitch } }])
    const three = readTarget(raster, { x: 400, y: 300 }).lattice
    const four = readTarget(raster, { x: 60, y: 300 }).lattice
    expect(three).toBeDefined()
    for (const c of three?.segmentation.counts ?? []) expect(c.anchor, JSON.stringify(c)).toBeLessThanOrEqual(3)
    expect(four && counts(four)).toContain(4)
  })
})

describe('§28 no count hallucination: a scale never chooses a count, and doubt is never CLEAR', () => {
  it('a true three-digit label never emits a four-digit value at p ≥ 0.10 unless its class is AMBIGUOUS', () => {
    for (const face of ['A', 'B'] as const) {
      for (const text of ['730', '640', '297', '415', '380']) {
        for (const gap of [0.0, 0.06, 0.15]) {
          const { raster, at } = plan(text, { iso: CONDENSED.iso, pitch: CONDENSED.pitch + gap, cap: 16, face })
          const l = readTarget(raster, at).lattice
          if (!l) continue
          const four = l.sequences.filter((q) => q.valueCm !== undefined && digits(q.text) === 4 && q.p >= COUNT_BOUNDS.countRivalP)
          if (four.length > 0) expect(l.ocrClass, `${text} (${face}, gap ${gap}): ${four.map((q) => `${q.text} ${q.p}`).join(', ')}`).toBe('AMBIGUOUS')
        }
      }
    }
  })

  it('a reading with a value of another digit count among its values is never CLEAR', () => {
    for (const sp of digitCorpus(CORPUS_SEEDS.calibration, 6)) {
      const l = readTarget(renderLabel(sp.text, sp.style).raster, { x: 24, y: 24 }, false).lattice
      if (!l || l.ocrClass !== 'CLEAR') continue
      const asRead = digits(l.asRead)
      expect(l.sequences.filter((q) => !q.asRead && q.valueCm !== undefined && digits(q.text) !== asRead), `${sp.id} read ${l.asRead}`).toEqual([])
      expect(l.countAmbiguity.widthAmbiguous, sp.id).toBe(false)
    }
  })

  it('a leading-zero reading is never CLEAR or SUPPORTED: no figure is printed with one', () => {
    for (const sp of digitCorpus(CORPUS_SEEDS.heldBack, 6)) {
      const l = readTarget(renderLabel(sp.text, sp.style).raster, { x: 24, y: 24 }, false).lattice
      if (!l || !/^0\d/.test(l.asRead)) continue
      expect(['AMBIGUOUS', 'LOW_QUALITY'], `${sp.id} read ${l.asRead}`).toContain(l.ocrClass)
    }
  })

  it('no correction crosses a digit count: neither a re-solve nor SCALE_RANKED can take one', () => {
    const { raster, at } = plan('2590', { ...CONDENSED, cap: 16 })
    const l = readTarget(raster, at).lattice
    expect(l).toBeDefined()
    if (!l) return
    const asRead = digits(l.asRead)
    for (const r of correctionReadings(l)) expect(digits(r.text), `${r.text} against ${l.asRead}`).toBe(asRead)
  })

  it('the lattice takes no scale: its module names no metric, chain or published figure', () => {
    const src = readFileSync(resolve(__dirname, '../src/numeric-lattice.ts'), 'utf8')
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports.every((i) => ['./ocr.js', './parse.js', './schema.js', '@buildapp/source-common', '@buildapp/source-cv'].includes(i)), imports.join(', ')).toBe(true)
    expect(src).not.toMatch(/cmPerPixel|impliedCmPerPx|publishedFacts|footprint/)
  })
})

describe('counter safety: a cut never runs through a hollow glyph', () => {
  it('runs of noughts and eights keep their count: no path cuts a persistent counter into two cells', () => {
    for (const text of ['1000', '800', '2008', '6080']) {
      for (const gap of [0.0, 0.04]) {
        const { raster, at } = plan(text, { iso: CONDENSED.iso, pitch: CONDENSED.pitch + gap, cap: 16 })
        const l = readTarget(raster, at).lattice
        if (!l) continue
        // a count one more than the printed glyphs would have to split a hollow glyph: it is never the reader's count
        for (const c of l.segmentation.counts) expect(c.anchor, `${text} gap ${gap}: ${JSON.stringify(c)}`).toBeLessThanOrEqual(text.length)
      }
    }
  })
})

describe('bounds and the ambiguity tail', () => {
  it('every count, segmentation and cell bound holds on both corpora', () => {
    for (const seed of [CORPUS_SEEDS.calibration, CORPUS_SEEDS.heldBack]) {
      for (const sp of digitCorpus(seed, 8)) {
        const l = readTarget(renderLabel(sp.text, sp.style).raster, { x: 24, y: 24 }, false).lattice
        if (!l) continue
        expect(l.segmentation.counts.length).toBeLessThanOrEqual(3)
        for (const c of l.segmentation.counts) expect(c.alternatives.length).toBeLessThanOrEqual(2)
        expect(l.segmentation.segmentations).toBeLessThanOrEqual(COUNT_BOUNDS.segmentationsPerInk)
        expect(l.segmentation.cellsScored, sp.id).toBeLessThanOrEqual(COUNT_BOUNDS.cellsPerInk + 3 * 7)
        expect(l.paths.length).toBeLessThanOrEqual(3 * COUNT_BOUNDS.segmentationsPerVariant)
      }
    }
  })

  it('the tail holds two moderate substitutions, values the emitted set does not, and at most two of them', () => {
    let seen = 0
    for (const seed of [CORPUS_SEEDS.calibration, CORPUS_SEEDS.heldBack]) {
      for (const sp of digitCorpus(seed, 8)) {
        const l = readTarget(renderLabel(sp.text, sp.style).raster, { x: 24, y: 24 }, false).lattice
        if (!l) continue
        expect(l.tail.length).toBeLessThanOrEqual(TAIL_BOUNDS.perInk)
        const emitted = new Set(l.sequences.map((q) => q.valueCm))
        for (const t of l.tail) {
          seen += 1
          expect(t.nonTop.length).toBe(TAIL_BOUNDS.substitutions)
          for (const n of t.nonTop) expect(n.ratio).toBeGreaterThanOrEqual(TAIL_BOUNDS.glyphRatio - 1e-6)
          expect(emitted.has(t.valueCm), `${sp.id}: ${t.text}`).toBe(false)
          expect(l.sequences.some((q) => q.text === t.text)).toBe(false)
        }
        expect(new Set(l.tail.map((t) => t.valueCm)).size).toBe(l.tail.length)
      }
    }
    expect(seen, 'the corpora exercise the tail').toBeGreaterThan(0)
  })

  it('no decision reads the tail: the metric solver never names it', () => {
    const src = readFileSync(resolve(__dirname, '../src/metric-solution.ts'), 'utf8')
    expect(src).not.toMatch(/\.tail\b/)
    const extract = readFileSync(resolve(__dirname, '../src/extract.ts'), 'utf8')
    // extract records it, and only records it
    expect([...extract.matchAll(/\.tail\b/g)].length).toBe(1)
  })

  it('the class bounds keep CLEAR inside SUPPORTED: one margin bar for both', () => {
    expect(OCR_CLASS_BOUNDS.clearMargin).toBeGreaterThanOrEqual(OCR_CLASS_BOUNDS.supportedMargin)
    expect(OCR_CLASS_BOUNDS.clearP).toBeGreaterThanOrEqual(OCR_CLASS_BOUNDS.supportedP)
  })
})
