import { describe, expect, it } from 'vitest'
import { NUMERIC_LATTICE_NAME, NUMERIC_LATTICE_VERSION, chainId, correctionReadings, ocrClassOf, parseNumber, solveChain, solveFrameChains, solveFrameMetric } from '../src/index.js'
import type { ChainToken, DimensionObservation, LabelLattice, OcrClass, RawChain, TextOrientation, TextToken } from '../src/index.js'

/**
 * BUILDPLAN-ANALYZER-005E §29, §31, §15–18: what the metric layer does with reading quality.
 *
 * Hand-made tokens and lattices, as in `metric-solution.test.ts`: each fixture states which values the image
 * offers for each ink and how well it read them, and the solver may only weigh those. The lattices are fixtures of
 * the reader's output, not of a house; the scale arithmetic is the solver's own.
 *
 * The frozen 005D solver (the parent commit of this stage) was run on the same pages; what it said is quoted where
 * a test is about it, and the class-blind confidence the 005E solver records reproduces it.
 */

const H = 14
const FRAME = 'frame-ocr-adversary'

function token(text: string, box: { x0: number; y0: number; x1: number; y1: number }, orientation: TextOrientation, alts: Record<number, Array<{ char: string; ratio: number }>> = {}): TextToken {
  const n = text.length
  const vertical = orientation === 'ROTATED_CW' || orientation === 'ROTATED_CCW'
  return {
    text,
    score: 0.5,
    confidence: 0.6,
    box,
    shearDeg: 0,
    height: H,
    orientation,
    glyphs: [...text].map((char, i) => {
      const [f0, f1] = [i / n, (i + 1) / n]
      const gbox = vertical ? { x0: box.x0, x1: box.x1, y0: box.y0 + (box.y1 - box.y0) * f0, y1: box.y0 + (box.y1 - box.y0) * f1 } : { x0: box.x0 + (box.x1 - box.x0) * f0, x1: box.x0 + (box.x1 - box.x0) * f1, y0: box.y0, y1: box.y1 }
      return { char, score: 0.5, confidence: 0.6, alternatives: (alts[i] ?? []).map((a) => ({ char: a.char, score: 0.5 * a.ratio })), box: gbox, holes: { count: 0, cy: 0.5, areaFrac: 0 } }
    }),
  }
}
const hChain = (y: number, ticks: number[]): RawChain => ({ axis: 'HORIZONTAL', baselinePx: y, ticks: ticks.map((atPx) => ({ atPx, baselinePx: y, observationId: '' })), observationIds: [] })
const vChain = (x: number, ticks: number[]): RawChain => ({ axis: 'VERTICAL', baselinePx: x, ticks: ticks.map((atPx) => ({ atPx, baselinePx: x, observationId: '' })), observationIds: [] })
const hLabel = (text: string, y: number, from: number, to: number, alts?: Record<number, Array<{ char: string; ratio: number }>>): TextToken => {
  const [w, at] = [text.length * 9, (from + to) / 2]
  return token(text, { x0: at - w / 2, x1: at + w / 2, y0: y - 5 - H, y1: y - 5 }, 'HORIZONTAL', alts)
}
const vLabel = (text: string, x: number, from: number, to: number, alts?: Record<number, Array<{ char: string; ratio: number }>>): TextToken => {
  const [w, c] = [text.length * 9, (from + to) / 2]
  return token(text, { x0: x - 5 - H, x1: x - 5, y0: c - w / 2, y1: c + w / 2 }, 'ROTATED_CW', alts)
}

/**
 * The reader's lattice for one ink: its sequences as `[text, weight]`, the as-read one first, normalised to
 * probabilities; each sequence's non-top glyphs are where it differs from the as-read string (glyph ratio 0.93, a
 * coin toss, unless a third element gives it; 0 makes it a re-cut's own top). `variants` names the ink variants that reached the as-read string — re-readings of one ink.
 *
 * The class is the shipped rule's (`ocrClassOf`) on these probabilities, never a label: `intended` only states what the
 * fixture means to be, and a fixture whose probabilities say otherwise fails here (005E post-review C P0 — hand-labelled
 * classes once hid a rule that let a two-value coin toss corroborate).
 */
function lattice(t: TextToken, intended: OcrClass, seqs: Array<[string, number, number?]>, variants: LabelLattice['sequences'][number]['variants'] = ['DEFAULT'], minGlyphScore = 0.4): LabelLattice {
  const total = seqs.reduce((a, s) => a + s[1], 0)
  const asRead = seqs[0][0]
  const p0 = seqs[0][1] / total
  const value = (text: string): number | undefined => (/^[1-9]\d*$/.test(text) ? Number(text) : undefined)
  const rivals = seqs.slice(1).filter(([text]) => value(text) !== value(asRead)).map(([, w]) => w / total)
  const probabilityMargin = rivals.length > 0 ? 1 - Math.max(...rivals) / p0 : 1
  const ocrClass = ocrClassOf({ minGlyphScore, capHeightPx: H, asReadP: p0, probabilityMargin })
  if (ocrClass !== intended) throw new Error(`fixture ${asRead}: the shipped rule classes it ${ocrClass}, not ${intended}`)
  return {
    reader: { name: NUMERIC_LATTICE_NAME, version: NUMERIC_LATTICE_VERSION },
    orientation: t.orientation,
    rawTopText: t.text,
    asRead,
    ...(value(asRead) !== undefined ? { asReadValueCm: value(asRead) } : {}),
    sequences: seqs.map(([text, w, glyphRatio], i) => ({
      text,
      ...(value(text) !== undefined ? { valueCm: value(text) } : {}),
      logP: Math.log(w / total),
      p: w / total,
      imageScore: 0.45,
      // Where it differs from the as-read string, at `glyphRatio` (default 0.93, a coin toss); 0: a re-cut's own top.
      nonTop: glyphRatio === 0 ? [] : [...text].flatMap((c, k) => (c !== asRead[k] ? [{ index: k, top: asRead[k], chosen: c, ratio: glyphRatio ?? 0.93 }] : [])),
      minGlyphMargin: 0.05,
      avgGlyphMargin: 0.1,
      pathIds: ['DEFAULT:0'],
      variants: i === 0 ? variants : ['DEFAULT'],
      asRead: i === 0,
    })),
    ocrClass,
    classWhy: 'fixture',
    minGlyphScore,
    maxRunnerRatio: 0.93,
    sequenceMargin: 0.9,
    asReadP: p0,
    probabilityMargin,
    asReadVariant: 'DEFAULT',
    entropy: 0,
    capHeightPx: H,
    glyphBoxes: [],
    paths: [],
    expansions: 0,
    truncatedBy: 'NONE',
    mergedCount: seqs.length,
    emittedMass: 1,
    asReadStability: { stable: true, bracket: [asRead, asRead] },
    countAmbiguity: { asRead: asRead.replace(/[^0-9]/g, '').length, alternatives: [], decisive: [], widthAmbiguous: false, rivalP: 0 },
    tail: [],
    segmentation: { style: { pitch: null, samples: 0 }, counts: [], counterCutsMoved: 0, counterCutsPruned: 0, segmentations: 0, cellsScored: 0, truncated: 0 },
    cache: 'MISS',
  }
}

type Held = Map<TextToken, { id: string; lattice: LabelLattice }>
const held = (entries: Array<[TextToken, LabelLattice]>): Held => new Map(entries.map(([t, l], i) => [t, { id: `lattice-${i}`, lattice: l }]))

function solve(chains: RawChain[], tokens: TextToken[], lattices?: Held) {
  const ids = chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
  const legacy = solveFrameChains(chains, tokens, { tolerancePx: 2.2 })
  return solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids, raw: tokens, legacyTokens: tokens, legacy, tolerancePx: 2.2, lattices })
}

/**
 * §31's oracle, held on every solve here: a value given to a span came from the image. Every observation's value
 * and alternatives are values its ink's lattice states, and its selected value is one of them.
 */
function expectNonCircular(observations: readonly DimensionObservation[], lattices: Held, solved?: ReturnType<typeof solveFrameMetric>): void {
  const byText = new Map([...lattices.values()].map((h) => [h.id, h.lattice]))
  for (const o of observations) {
    const l = o.ocr ? byText.get(o.ocr.latticeId) : undefined
    if (!l) continue
    const values = new Set(l.sequences.map((s) => s.valueCm))
    expect(values.has(o.valueCm), `${o.id} ${o.valueCm}`).toBe(true)
    for (const a of o.valueAlternatives ?? []) expect(values.has(a.valueCm), `${o.id} alternative ${a.valueCm}`).toBe(true)
    if (o.ocr?.selected?.valueCm !== undefined) expect(values.has(o.ocr.selected.valueCm), `${o.id} selected ${o.ocr.selected.valueCm}`).toBe(true)
    if (o.ocr?.selected?.text !== undefined) expect(l.sequences.map((s) => s.text), `${o.id} selected`).toContain(o.ocr.selected.text)
  }
  // The sealed chains a lattice re-solve gave values to (005E post-review B P1): every printed or corrected value of a
  // lattice ink is one of its lattice's values. (A kept 005D vote's chains are the legacy exemption, documented.)
  if (!solved || !['REPLACED', 'ADDED'].includes(solved.solution.relation)) return
  const byToken = new Map([...lattices].map(([t, h]) => [t, h.lattice]))
  for (const chain of solved.solved) {
    for (const g of chain.segments) {
      if ((g.origin !== 'READ' && g.origin !== 'CHAIN_CORRECTED') || !g.token) continue
      const l = byToken.get(g.token)
      if (!l) continue
      expect(l.sequences.map((q) => q.valueCm), `${g.token.text} sealed ${g.valueCm} (${g.origin})`).toContain(g.valueCm)
    }
  }
}

// ---------------------------------------------------------------------------
// §29 the mandatory false-consensus adversary
// ---------------------------------------------------------------------------

/**
 * The true scale is 2.20 cm/px. Two inks on both axes are coin tosses read wrong in the same direction:
 *   A, the X overall (559 px): printed 1230, read 1150 — its `2` and `3` each lost to a runner-up at 0.93;
 *   B, a Y line (350 px of the axis's 420): printed 770, read 720.
 * Both wrong reads state 2.057 cm/px (−6.5 %, area −12.6 %), and the truths are lower in their own lattices.
 * The true scale has better evidence: two CLEAR labels, 530 over 241 px and 700 over 318 px, on a finer X line.
 */
const pageA = (childrenAt: number) => {
  const chains = [hChain(760, [100, 659]), vChain(700, [50, 400]), hChain(childrenAt, [100, 341, 659]), vChain(40, [30, 450])]
  const A = hLabel('1150', 760, 100, 659, { 1: [{ char: '2', ratio: 0.93 }], 2: [{ char: '3', ratio: 0.93 }] })
  const B = vLabel('720', 700, 50, 400, { 1: [{ char: '7', ratio: 0.93 }] })
  const C1 = hLabel('530', childrenAt, 100, 341)
  const C2 = hLabel('700', childrenAt, 341, 659)
  const lattices = held([
    [A, lattice(A, 'AMBIGUOUS', [['1150', 0.3], ['1250', 0.25], ['1130', 0.2], ['1230', 0.18]])],
    [B, lattice(B, 'AMBIGUOUS', [['720', 0.5], ['770', 0.45]])],
    [C1, lattice(C1, 'CLEAR', [['530', 0.9], ['580', 0.05]])],
    [C2, lattice(C2, 'CLEAR', [['700', 0.9], ['760', 0.05]])],
  ])
  return { chains, tokens: [A, B, C1, C2], lattices }
}

describe('§29 false consensus: two coin tosses agreeing on a wrong scale are not STRONG', () => {
  it('children on a line of their own: the class-blind verdict is STRONG (what 005D said), the 005E one is not, and the rival is not promoted', () => {
    // Frozen 005D on this page: CONFIRMED/STRONG at 2.057225 ("a rival scale has 61% of its independent support").
    const { chains, tokens, lattices } = pageA(840)
    const m = solve(chains, tokens, lattices)
    const s = m.solution
    expect(s.topology?.falseConsensus?.kind).toBe('BETTER_CLASS_RIVAL')
    expect(s.topology?.falseConsensus?.blindConfidence).toBe('STRONG')
    expect(s.confidence).not.toBe('STRONG')
    expect(['INCONCLUSIVE', 'WEAK']).toContain(s.confidence)
    // Not promoted: the solver lowers its confidence and leaves the decision to the challenge.
    expect(s.relation).not.toBe('REPLACED')
    expect(s.topology?.falseConsensus?.demotedObservationIds.length).toBe(2)
    expectNonCircular(m.observations, lattices, m)
  })

  it('children framed by the overall: the overall is refuted by its own children through a value its ink offers, and stops witnessing', () => {
    // Frozen 005D on this page: CONFIRMED/STRONG at 2.057225 as well — 1150 a witness although its children sum to 1230.
    const { chains, tokens, lattices } = pageA(800)
    const m = solve(chains, tokens, lattices)
    const overall = m.observations.find((o) => o.rawText === '1150')
    expect(overall?.ocr?.selected?.by).toBe('STRUCTURAL')
    expect(overall?.ocr?.selected?.valueCm).toBe(1230)
    expect(m.solution.topology?.structural?.[0]?.refutedObservationIds).toContain(overall?.id)
    expect(m.solution.confidence).not.toBe('STRONG')
    expect(m.solution.relation).not.toBe('REPLACED')
    expectNonCircular(m.observations, lattices, m)
  })

  it('the same page read CLEAR is two witnesses on both axes: reading quality, not the geometry, makes the difference', () => {
    // A declared limit: a misread the matcher is sure of is invisible to the class (calibration README).
    const { chains, tokens } = pageA(840)
    const [A, B, C1, C2] = tokens
    const clear = held([
      [A, lattice(A, 'CLEAR', [['1150', 0.9], ['1230', 0.05]])],
      [B, lattice(B, 'CLEAR', [['720', 0.9], ['770', 0.05]])],
      [C1, lattice(C1, 'CLEAR', [['530', 0.9], ['580', 0.05]])],
      [C2, lattice(C2, 'CLEAR', [['700', 0.9], ['760', 0.05]])],
    ])
    expect(solve(chains, tokens, clear).solution.topology?.falseConsensus).toBeUndefined()
  })

  it('without the children: the two coin tosses alone are INCONCLUSIVE, and say where their own other values agree', () => {
    // Frozen 005D: CONFIRMED/STRONG at 2.057 (−6.5 %). The two-value coin toss B was SUPPORTED under the shipped rule
    // before post-review C P0, which made this page STRONG again.
    const { chains, tokens, lattices } = pageA(840)
    const [A, B] = tokens
    const page = solve([chains[0], chains[1], chains[3]], [A, B], held([...lattices].filter(([t]) => t === A || t === B).map(([t, h]) => [t, h.lattice])))
    expect(page.solution.confidence).toBe('INCONCLUSIVE')
    expect(page.solution.relation).not.toBe('REPLACED')
    expect(page.solution.topology?.falseConsensus?.kind).toBe('CANDIDATE_CONSENSUS')
    expect(page.solution.topology?.falseConsensus?.candidateScales?.some((c) => Math.abs(c.cmPerPixel - 2.2) < 0.01)).toBe(true)
  })

  it('a one-glyph coin toss on each axis (1230 read 1130, 770 read 710) is AMBIGUOUS, not SUPPORTED, and corroborates nothing', () => {
    const chains = [hChain(760, [100, 659]), vChain(700, [50, 400]), vChain(40, [30, 450])]
    const A = hLabel('1130', 760, 100, 659)
    const B = vLabel('710', 700, 50, 400)
    const lattices = held([
      [A, lattice(A, 'AMBIGUOUS', [['1130', 0.52], ['1230', 0.44], ['1180', 0.04]])],
      [B, lattice(B, 'AMBIGUOUS', [['710', 0.5], ['770', 0.46], ['790', 0.04]])],
    ])
    const s = solve(chains, [A, B], lattices).solution
    expect(s.confidence).toBe('INCONCLUSIVE')
    expect(s.relation).not.toBe('REPLACED')
  })
})

// ---------------------------------------------------------------------------
// §15 confidence uses OCR quality
// ---------------------------------------------------------------------------

describe('§15 confidence semantics', () => {
  // Two overall labels on both axes agreeing on 2.00 cm/px, and nothing else on the page.
  /** Probabilities that the shipped rule classes as each class (and a glyph under the floor for LOW_QUALITY). */
  const shape = (cls: OcrClass, v: string, alt: string, other: string): { seqs: Array<[string, number]>; minGlyph: number } =>
    cls === 'CLEAR' ? { seqs: [[v, 0.8], [alt, 0.1]], minGlyph: 0.4 }
    : cls === 'SUPPORTED' ? { seqs: [[v, 0.45], [alt, 0.25], [other, 0.2]], minGlyph: 0.4 }
    : cls === 'AMBIGUOUS' ? { seqs: [[v, 0.4], [alt, 0.35], [other, 0.25]], minGlyph: 0.4 }
    : { seqs: [[v, 0.8], [alt, 0.1]], minGlyph: 0.15 }
  const page = (classX: OcrClass, classY: OcrClass) => {
    const chains = [hChain(760, [100, 650]), vChain(700, [50, 450])]
    const X = hLabel('1100', 760, 100, 650, { 1: [{ char: '7', ratio: 0.93 }] })
    const Y = vLabel('800', 700, 50, 450, { 0: [{ char: '6', ratio: 0.93 }] })
    const [sx, sy] = [shape(classX, '1100', '1700', '1180'), shape(classY, '800', '600', '860')]
    const lattices = held([
      [X, lattice(X, classX, sx.seqs, ['DEFAULT'], sx.minGlyph)],
      [Y, lattice(Y, classY, sy.seqs, ['DEFAULT'], sy.minGlyph)],
    ])
    return solve(chains, [X, Y], lattices).solution
  }
  it('two CLEAR independent totals agreeing on both axes may be STRONG', () => {
    expect(page('CLEAR', 'CLEAR').confidence).toBe('STRONG')
  })
  it('CLEAR with SUPPORTED corroborate', () => {
    expect(['STRONG', 'SUPPORTED']).toContain(page('CLEAR', 'SUPPORTED').confidence)
  })
  it('two AMBIGUOUS labels agreeing do not become STRONG', () => {
    expect(page('AMBIGUOUS', 'AMBIGUOUS').confidence).not.toBe('STRONG')
  })
  it('two LOW_QUALITY labels agreeing decide nothing', () => {
    const s = page('LOW_QUALITY', 'LOW_QUALITY')
    expect(s.confidence).toBe('INCONCLUSIVE')
    expect(['REPLACED', 'ADDED']).not.toContain(s.relation)
  })
  it('OCR values are never mutated by the confidence: what was read is what is recorded', () => {
    const chains = [hChain(760, [100, 650]), vChain(700, [50, 450])]
    const X = hLabel('1100', 760, 100, 650)
    const Y = vLabel('800', 700, 50, 450)
    const lattices = held([
      [X, lattice(X, 'AMBIGUOUS', [['1100', 0.4], ['1700', 0.35], ['1180', 0.25]])],
      [Y, lattice(Y, 'AMBIGUOUS', [['800', 0.4], ['600', 0.35], ['860', 0.25]])],
    ])
    const before = JSON.stringify([...lattices.values()])
    const m = solve(chains, [X, Y], lattices)
    expect(JSON.stringify([...lattices.values()])).toBe(before)
    expect(m.observations.map((o) => o.rawText).sort()).toEqual(['1100', '800'])
  })
})

// ---------------------------------------------------------------------------
// §18 independence: variants of one ink are one witness
// ---------------------------------------------------------------------------

describe('§18 preprocessing variants of one ink are never independent', () => {
  it('a label all three ink variants read alike is one reading, not three', () => {
    const chains = [hChain(760, [100, 650])]
    const X = hLabel('1100', 760, 100, 650)
    const lattices = held([[X, lattice(X, 'CLEAR', [['1100', 0.9], ['1700', 0.05]], ['DEFAULT', 'STRICT', 'SAUVOLA'])]])
    const s = solve(chains, [X], lattices).solution
    expect(s.hypotheses[0]?.independentGroups).toBe(1)
    expect(s.confidence).not.toBe('STRONG')
    expect(s.confidence).not.toBe('SUPPORTED')
  })
})

// ---------------------------------------------------------------------------
// §31 geometry cannot invent OCR
// ---------------------------------------------------------------------------

describe('§31 negative: geometry cannot invent OCR', () => {
  it('a value that would fit the scale perfectly but that the image never offered stays missing', () => {
    // As §29 with children framed by the overall, but the overall's lattice never reached 1230: 530 + 700 and the
    // scale both ask for it, and nothing may supply it.
    const chains = [hChain(760, [100, 659]), vChain(700, [50, 400]), hChain(800, [100, 341, 659]), vChain(40, [30, 450])]
    const A = hLabel('1150', 760, 100, 659)
    const B = vLabel('770', 700, 50, 400)
    const C1 = hLabel('530', 800, 100, 341)
    const C2 = hLabel('700', 800, 341, 659)
    const lattices = held([
      [A, lattice(A, 'AMBIGUOUS', [['1150', 0.4], ['1250', 0.3], ['1130', 0.2]])],
      [B, lattice(B, 'CLEAR', [['770', 0.9], ['720', 0.05]])],
      [C1, lattice(C1, 'CLEAR', [['530', 0.9]])],
      [C2, lattice(C2, 'CLEAR', [['700', 0.9]])],
    ])
    const before = JSON.stringify([...lattices.values()])
    const m = solve(chains, [A, B, C1, C2], lattices)
    // The reader's candidate set is unchanged by solving.
    expect(JSON.stringify([...lattices.values()])).toBe(before)
    // 1230 appears nowhere: not as a value, an alternative or a selection.
    for (const o of m.observations) {
      expect(o.valueCm).not.toBe(1230)
      expect((o.valueAlternatives ?? []).map((a) => a.valueCm)).not.toContain(1230)
      expect(o.ocr?.selected?.valueCm).not.toBe(1230)
    }
    expect(JSON.stringify(m.solution)).not.toContain('"chosenCm":1230')
    expectNonCircular(m.observations, lattices, m)
  })

  it('the selected value of every observation is a sequence of its own lattice, on every fixture here', () => {
    for (const childrenAt of [800, 840]) {
      const { chains, tokens, lattices } = pageA(childrenAt)
      expectNonCircular(solve(chains, tokens, lattices).observations, lattices)
    }
  })
})

// ---------------------------------------------------------------------------
// §17 a chain read again: which values a scale may choose among
// ---------------------------------------------------------------------------

describe('§17 a chain read again chooses only among values the ink may plausibly be', () => {
  const ink = hLabel('575', 760, 100, 371)
  /** As read 575 (SUPPORTED), a one-glyph 535 at a glyph ratio of 0.93, a one-glyph 573 at 0.6, and a 125 another cut found. */
  const l = (): LabelLattice => {
    const base = lattice(ink, 'SUPPORTED', [['575', 0.48], ['535', 0.2], ['573', 0.1], ['125', 0.054]])
    return {
      ...base,
      sequences: base.sequences.map((q) =>
        q.text === '573' ? { ...q, nonTop: [{ index: 2, top: '5', chosen: '3', ratio: 0.6 }] } : q.text === '125' ? { ...q, nonTop: [], pathIds: ['STRICT:3'] } : q,
      ),
    }
  }

  it('offers the reading, and as corrections only values held at least half as strongly or one glyph away at 005D’s bound', () => {
    const r = correctionReadings(l()) ?? []
    expect(r.map((x) => x.text)).toEqual(['575', '535'])
    expect(r[0]).toMatchObject({ confidence: 1, substitutions: 0 })
    expect(r[1].confidence).toBeCloseTo(0.93, 6)
  })

  it('a scale does not give a short span a value its ink was not read as: within a fixed tolerance a short span fits by chance', () => {
    // A 15 px span at 2.2 cm/px: the as-read 55 misses by 10 px; the one-glyph 35 lands within the 2.2 px tolerance.
    const chain = hChain(282, [269, 284, 330])
    const token = hLabel('55', 282, 269, 284)
    const readings = (texts: Array<[string, number, number]>): ChainToken['readings'] =>
      texts.map(([text, confidence, substitutions]) => ({ text, parsed: parseNumber(text)[0], valueCm: Number(text), confidence, substitutions }))
    const entry: ChainToken = { token, atPx: 276.5, offset: 1, readings: readings([['55', 1, 0], ['35', 0.93, 1]]) }
    const free = solveChain(chain, [entry], { tolerancePx: 2.2, fixedScale: 2.2 })
    const bounded = solveChain(chain, [entry], { tolerancePx: 2.2, fixedScale: 2.2, minCorrectionPx: 55 })
    expect(free.segments.find((g) => g.fromPx === 269 && g.toPx === 284)?.valueCm).toBe(35)
    expect(bounded.segments.find((g) => g.fromPx === 269 && g.toPx === 284)?.origin).not.toBe('CHAIN_CORRECTED')
    // A long span is a measurement: there the correction stands.
    const long = hChain(760, [100, 371])
    const longEntry: ChainToken = { token: ink, atPx: 235.5, offset: 1, readings: readings([['575', 1, 0], ['595', 0.93, 1]]) }
    const solved = solveChain(long, [longEntry], { tolerancePx: 2.2, fixedScale: 595 / 271, minCorrectionPx: 55 })
    expect(solved.segments[0]).toMatchObject({ valueCm: 595, origin: 'CHAIN_CORRECTED' })
  })
})

// ---------------------------------------------------------------------------
// post-review A, B: what reaches a sealed chain or a selection stays within the ink's plausible values
// ---------------------------------------------------------------------------

describe('§31 an ink re-read by the lattice gets values from its lattice only, and only plausible ones', () => {
  // A page at 2.00 cm/px: X 1100 over 550 px and Y 800 over 400 px, both CLEAR; a finer X line [100,200,650] with a
  // CLEAR 200 on its first 100 px and ink T on the last 450 px (900 cm at the scale). No page vote: the scale is ADDED.
  const page = () => {
    const X = hLabel('1100', 760, 100, 650)
    const Y = vLabel('800', 700, 50, 450)
    const C1 = hLabel('200', 840, 100, 200)
    const T = hLabel('500', 840, 200, 650, { 0: [{ char: '9', ratio: 0.25 }] })
    const chains = [hChain(760, [100, 650]), vChain(700, [50, 450]), hChain(840, [100, 200, 650])]
    return { chains, X, Y, C1, T, base: [[X, lattice(X, 'CLEAR', [['1100', 0.9]])], [Y, lattice(Y, 'CLEAR', [['800', 0.9]])], [C1, lattice(C1, 'CLEAR', [['200', 0.9]])]] as Array<[TextToken, LabelLattice]> }
  }
  const run = (chains: RawChain[], tokens: TextToken[], lattices: Held) => {
    const ids = chains.map((c) => chainId(FRAME, c.axis, c.baselinePx, c.ticks.map((t) => t.atPx)))
    return solveFrameMetric({ frameId: FRAME, assetId: 'asset', chains, chainIds: ids, raw: tokens, legacyTokens: [], legacy: solveFrameChains(chains, [], { tolerancePx: 2.2 }), tolerancePx: 2.2, lattices })
  }

  it('an ink whose lattice states no dimension is never corrected from the 005D substitution list', () => {
    // 005D read it 500 and half-saw a 9 under the 5 (ratio 0.25); the lattice reads it as no dimension and offers 500.
    const { chains, X, Y, C1, T, base } = page()
    const lattices = held([...base, [T, lattice(T, 'AMBIGUOUS', [['5-0', 0.5], ['500', 0.4]])]])
    const m = run(chains, [X, Y, C1, T], lattices)
    expect(m.solution.relation).toBe('ADDED')
    expect(m.solved[2].segments.find((g) => g.fromPx === 200)?.origin).not.toBe('CHAIN_CORRECTED')
    expectNonCircular(m.observations, lattices, m)
  })

  it('an as-read string with a leading zero (a 4 read 0) keeps its ink in the record, never decisive, its values as alternatives', () => {
    const { chains, X, Y, C1, T, base } = page()
    const lattices = held([...base, [T, lattice(T, 'AMBIGUOUS', [['050', 0.5], ['450', 0.45], ['900', 0.05]])]])
    const m = run(chains, [X, Y, C1, T], lattices)
    const o = m.observations.find((x) => x.rawText === '050' && x.binding?.role === 'PRIMARY')
    expect(o).toBeDefined()
    expect(o?.leadingZero).toBe(true)
    expect(o?.valueAlternatives?.map((a) => a.valueCm)).toContain(450)
    // Never decisive: no hypothesis it belongs to counts it, and the scale is the CLEAR inks'.
    for (const h of m.solution.hypotheses.filter((x) => x.witnessIds.includes(o?.id ?? ''))) expect(h.independentGroups, `${h.cmPerPixel}`).toBe(0)
    expect(m.solution.cmPerPixelX).toBeCloseTo(2, 3)
  })

  it('the record never ranks a value the re-solve would refuse: on a 20 px span a CLEAR 46 stays 46, not a barely offered 40', () => {
    const X = hLabel('1100', 760, 100, 650)
    const Y = vLabel('800', 700, 50, 450)
    const T = hLabel('46', 840, 100, 120)
    const C2 = hLabel('400', 840, 120, 320)
    const C3 = hLabel('660', 840, 320, 650)
    const chains = [hChain(760, [100, 650]), vChain(700, [50, 450]), hChain(840, [100, 120, 320, 650])]
    const lattices = held([
      [X, lattice(X, 'CLEAR', [['1100', 0.9]])],
      [Y, lattice(Y, 'CLEAR', [['800', 0.9]])],
      [C2, lattice(C2, 'CLEAR', [['400', 0.9]])],
      [C3, lattice(C3, 'CLEAR', [['660', 0.9]])],
      // A different cut barely offers 40: a re-cut's own top, no glyph the reader's cut half-saw.
      [T, lattice(T, 'CLEAR', [['46', 0.9], ['40', 0.05, 0]])],
    ])
    const m = run(chains, [X, Y, T, C2, C3], lattices)
    const o = m.observations.find((x) => x.rawText === '46' && x.binding?.role === 'PRIMARY')
    expect(correctionReadings(lattices.get(T)?.lattice as LabelLattice).map((r) => r.text)).toEqual(['46'])
    expect(o?.ocr?.selected?.valueCm).not.toBe(40)
  })

  it('a correct CLEAR total is not refuted by its children through a value its ink holds at 1 %', () => {
    // 2.00 cm/px. Total 1230 over 615 px, CLEAR; a re-cut barely offers 1200. Children 500 (printed 530, its lattice
    // never reached 530; SUPPORTED) and 700 CLEAR. The children sum to 1200 as read.
    const X = hLabel('1230', 760, 100, 715)
    const C1 = hLabel('500', 800, 100, 365)
    const C2 = hLabel('700', 800, 365, 715)
    const Y = vLabel('800', 760, 50, 450)
    const chains = [hChain(760, [100, 715]), hChain(800, [100, 365, 715]), vChain(760, [50, 450])]
    const lattices = held([
      [X, lattice(X, 'CLEAR', [['1230', 0.97], ['1200', 0.01, 0]])],
      [C1, lattice(C1, 'SUPPORTED', [['500', 0.5], ['600', 0.2, 0.65], ['560', 0.15, 0.65]])],
      [C2, lattice(C2, 'CLEAR', [['700', 0.9]])],
      [Y, lattice(Y, 'CLEAR', [['800', 0.9]])],
    ])
    const m = run(chains, [X, C1, C2, Y], lattices)
    const total = m.observations.find((o) => o.rawText === '1230' && o.binding?.role === 'PRIMARY')
    expect(total?.ocr?.refutedBy).toBeUndefined()
    expect(total?.ocr?.selected?.valueCm).not.toBe(1200)
  })
})

// ---------------------------------------------------------------------------
// post-review C P1/P2: the protection does not push a true scale aside; a statement drawn twice is one
// ---------------------------------------------------------------------------

describe('§16 the false-consensus protection never hands the scale to a vote with no reading of its own', () => {
  it('two ambiguous inks read right replace a page vote that rests on unreadable ink, whatever an unrelated short CLEAR label states', () => {
    // True scale 2.20. The page vote reads three LOW_QUALITY labels at 1.90; a 60 px CLEAR "71" elsewhere states 1.18.
    const T = 2.2
    const [X0, X1] = [100, 100 + 1230 / T]
    const chains = [hChain(760, [X0, X1]), vChain(700, [50, 400]), vChain(40, [30, 450]), hChain(900, [100, 500]), hChain(960, [100, 450]), vChain(760, [30, 430]), hChain(1020, [600, 660])]
    const A = hLabel('1230', 760, X0, X1)
    const B = vLabel('770', 700, 50, 400)
    const L1 = hLabel('760', 900, 100, 500)
    const L2 = hLabel('665', 960, 100, 450)
    const L3 = vLabel('760', 760, 30, 430)
    const S = hLabel('71', 1020, 600, 660)
    const lattices = held([
      [A, lattice(A, 'AMBIGUOUS', [['1230', 0.33], ['1239', 0.3], ['1290', 0.2], ['1238', 0.17]])],
      [B, lattice(B, 'AMBIGUOUS', [['770', 0.33], ['779', 0.3], ['720', 0.2], ['775', 0.17]])],
      [L1, lattice(L1, 'LOW_QUALITY', [['760', 0.9]], ['DEFAULT'], 0.15)],
      [L2, lattice(L2, 'LOW_QUALITY', [['665', 0.9]], ['DEFAULT'], 0.15)],
      [L3, lattice(L3, 'LOW_QUALITY', [['760', 0.9]], ['DEFAULT'], 0.15)],
      [S, lattice(S, 'CLEAR', [['71', 0.9]])],
    ])
    const m = solve(chains, [A, B, L1, L2, L3, S], lattices)
    expect(m.solution.legacy?.cmPerPixel ?? 0).toBeCloseTo(1.9, 2)
    expect(m.solution.relation).toBe('REPLACED')
    expect(Math.abs((m.solution.cmPerPixelX ?? 0) - T)).toBeLessThan(0.02)
    expect(m.solution.topology?.falseConsensus).toBeUndefined()
  })
})

describe('§18 one dimension drawn on twin lines is one statement, however its marks round', () => {
  it('a CLEAR reading printed on two parallel lines 0.6 px apart counts once', () => {
    const chains = [vChain(700, [50, 400]), vChain(730, [50.6, 400.6]), vChain(40, [30, 450])]
    const B1 = vLabel('710', 700, 50, 400)
    const B2 = vLabel('710', 730, 50.6, 400.6)
    const lattices = held([
      [B1, lattice(B1, 'CLEAR', [['710', 0.9], ['770', 0.05]])],
      [B2, lattice(B2, 'CLEAR', [['710', 0.9], ['770', 0.05]])],
    ])
    const s = solve(chains, [B1, B2], lattices).solution
    expect(s.hypotheses[0]?.independentGroups).toBe(1)
    expect(['STRONG', 'SUPPORTED']).not.toContain(s.confidence)
  })
})
