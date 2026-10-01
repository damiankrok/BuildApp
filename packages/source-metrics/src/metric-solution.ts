/**
 * A plan frame's metric solution, from independent evidence only
 * (BUILDPLAN-ANALYZER-005B).
 *
 * The legacy chain solver (`solveFrameChains`) reads a sheet through a chain
 * of single winners, and two of them turned adequate drawings into wrong
 * houses on both blind holdouts of 005A:
 *
 *   - ORIENTATION. The OCR reads vertical text both ways up and a page-wide
 *     vote keeps one way. A hatch read as nineteen characters can tip that
 *     vote, and then every label set the other way — the plan's whole depth —
 *     is thrown away: `900` survives only as its upside-down `006`.
 *   - SELF-ANCHORING. The scale vote counts readings the reader never made:
 *     single-digit substitutions of what it did read. A substitution that
 *     makes `006` into `806` fits the scale the other substitutions agree on,
 *     votes for it, and is then entered as an anchor of that scale — one
 *     evidence loop counted as several witnesses.
 *
 * This module does not patch either. It keeps every pass's reading of every
 * label, binds each reading as read to the ticks it could measure, and decides
 * with a stated rule and a recorded reason:
 *
 *   1. which way up each chain's labels are — first on evidence that uses no
 *      scale at all (the chain's own readings agreeing with each other, the
 *      axis's readings agreeing with each other, the typography of a trailing
 *      zero turned into a leading one), then on the OTHER axis's scale, and
 *      then, only when nothing decides, the legacy vote, named UNDECIDED;
 *   2. which scales the readings support — raw readings only, one witness per
 *      piece of ink however many ways it was read, a reading whose way up the
 *      other axis chose never a witness of isotropy, and never a substitution;
 *   3. what that makes of the legacy vote's scale — CONFIRMED (kept, byte for
 *      byte), REPLACED (outweighed by independent readings), or LEGACY_
 *      UNCONFIRMED (kept, with the support it actually has counted);
 *   4. how far the result can be believed — STRONG, SUPPORTED, WEAK or
 *      INCONCLUSIVE, from the independent witnesses alone.
 *
 * A substitution is still made where it belongs: DOWNSTREAM, once the scale is
 * chosen, to read a chain whose digits the matcher half-knows. It is recorded
 * as a CHAIN_CORRECTED value that depends on the scale, and nothing in the
 * choice of that scale or in the confidence of the result ever counts it.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { Checkpoint, PixelRect } from '@buildapp/source-common'
import { rectIoU } from '@buildapp/source-common'
import { assignTokens, solveChain, spansFor } from './chains.js'
import type { ChainToken, FrameChainSolution, RawChain, ScalePlausibility, SolvedChain } from './chains.js'
import { compareTokens, textAxisOf, tokenMerit } from './ocr.js'
import type { TextOrientation, TextToken } from './ocr.js'
import { parseNumber, readingLattice } from './parse.js'
import { toCentimetres } from './schema.js'
import type { LabelLattice, OcrClass } from './numeric-lattice.js'
import type { ChainRelation, DimensionObservation, FrameMetricSolution, MetricConfidence, OrientationDecision, ScaleHypothesis } from './schema.js'

export const METRIC_SOLVER_NAME = 'metrics.independent-scale' as const
export const METRIC_SOLVER_VERSION = '1.2.0' as const

/**
 * Counts, never a clock, so a phone reaches the answer a server does. Two
 * readings per label (a label set along one axis has two ways up), six scales
 * per frame, four hundred bound readings per frame, two substitutions when a
 * chain is read against the other axis.
 */
export const METRIC_BOUNDS = { orientationsPerLabel: 2, hypotheses: 6, observations: 400, latticeSubstitutions: 2, relations: 200, skippedTicks: 2 } as const

/**
 * A reading DECIDES a scale only over a span long enough to pin it: 25 times
 * the pixel tolerance, so the scale it states is good to 4 %. Two labels over
 * 30 px spans agree with each other at almost any scale; one over 450 px
 * agrees with almost none. Shorter readings still carry weight; they are not
 * counted as witnesses, and they cannot decide which way up a chain is.
 */
export const DECISIVE_SPAN_TOLERANCES = 25

/**
 * And only over glyphs large enough to read: 10 px of cap height, the
 * legibility the blind-holdout protocol already holds an overall dimension to.
 * Below it the template matcher confuses 4 with 1 and 6 with 0 often enough
 * that a small copy's "overall" reading is noise, however long its span.
 */
export const LEGIBLE_CAP_HEIGHT_PX = 10

/** Readings within this ratio are one scale found twice. */
const DISTINCT_RATIO = 0.03

const VERTICAL_PAIR: readonly TextOrientation[] = ['ROTATED_CW', 'ROTATED_CCW']
const HORIZONTAL_PAIR: readonly TextOrientation[] = ['HORIZONTAL', 'INVERTED']

export type FrameMetricInput = {
  frameId: string
  assetId: string
  chains: readonly RawChain[]
  chainIds: readonly string[]
  /** Every token every pass read, before any orientation was chosen (`readNumbers(…, { hypotheses: true }).raw`). */
  raw: readonly TextToken[]
  /** The page vote's own tokens (`readNumbers(…).tokens`): what the legacy chains were read from. */
  legacyTokens: readonly TextToken[]
  /** What the legacy solver made of the page-vote tokens: the incumbent this solution confirms, keeps or replaces. */
  legacy: FrameChainSolution
  tolerancePx: number
  minPixelLength?: number
  maxOffsetHeights?: number
  /** What the drawing's own content allows a scale to be (the wall-thickness check for plans). */
  plausibility?: ScalePlausibility
  checkpoint?: Checkpoint
  /**
   * 005E: each label ink's numeric lattice (image only, `labelLattice`), by raw token. With one, the ink's witness value
   * is the lattice's as-read string, its alternatives are the lattice's other values, and its reading quality decides
   * whether it may count. Without one (a caller that read no lattice), the 005D reading and one-glyph alternatives.
   */
  lattices?: ReadonlyMap<TextToken, { id: string; lattice: LabelLattice }>
}

export type FrameMetricOutput = {
  solution: FrameMetricSolution
  observations: DimensionObservation[]
  relations: ChainRelation[]
  /** What to seal, per chain: solved at the chosen scale, from the tokens its orientation decision chose. */
  solved: SolvedChain[]
  tokensPerChain: ChainToken[][]
  pooledScale?: number
  scaleX?: number
  scaleY?: number
  /** Per chain, the orientation its labels were read in, and whether a scale chose it. */
  chainOrientation: Array<{ orientation: TextOrientation | null; dependsOnScale: boolean }>
}

// ---------------------------------------------------------------------------
// text regions: one piece of ink, however many ways it was read
// ---------------------------------------------------------------------------

type Region = { id: string; box: PixelRect; members: TextToken[] }

const area = (b: PixelRect): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
const covered = (inner: PixelRect, outer: PixelRect): number => {
  const w = Math.min(inner.x1, outer.x1) - Math.max(inner.x0, outer.x0)
  const h = Math.min(inner.y1, outer.y1) - Math.max(inner.y0, outer.y0)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.max(1, area(inner))
}
/** The legacy dedupe's own clash test: the same ink when the boxes overlap or one lies mostly inside the other. */
const sameInk = (a: PixelRect, b: PixelRect): boolean => rectIoU(a, b) > 0.4 || covered(a, b) > 0.6 || covered(b, a) > 0.6

export function textRegions(frameId: string, raw: readonly TextToken[]): { regions: Region[]; regionOf: Map<TextToken, Region> } {
  const tokens = [...raw].sort(compareTokens)
  const parent = tokens.map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    return r
  }
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j < tokens.length; j += 1) {
      // Tokens of one pass never overlap; only a different pass reads the same ink again.
      if (tokens[i].orientation === tokens[j].orientation) continue
      if (tokens[j].box.y0 > tokens[i].box.y1 + 2 && tokens[j].box.y0 > tokens[i].box.y1 + (tokens[i].box.y1 - tokens[i].box.y0)) break
      if (!sameInk(tokens[i].box, tokens[j].box)) continue
      const a = find(i)
      const b = find(j)
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
    }
  }
  const groups = new Map<number, TextToken[]>()
  tokens.forEach((t, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), t]))
  const regions: Region[] = []
  const regionOf = new Map<TextToken, Region>()
  for (const members of groups.values()) {
    const box = members.map((m) => m.box).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }))
    const rounded = { x0: Math.round(box.x0), y0: Math.round(box.y0), x1: Math.round(box.x1), y1: Math.round(box.y1) }
    const region: Region = { id: stableId('text-region', `${rounded.x0}-${rounded.y0}`, { frameId, box: rounded }), box, members }
    regions.push(region)
    for (const m of members) regionOf.set(m, region)
  }
  regions.sort((a, b) => a.box.y0 - b.box.y0 || a.box.x0 - b.box.x0 || (a.id < b.id ? -1 : 1))
  return { regions, regionOf }
}

/**
 * The tokens that can be dimension labels: those set at the text size the
 * sheet sets its dimension labels at.
 *
 * A drawing prints its chain labels in one text style, so their cap heights
 * agree. A publisher's logo, a room number and a north arrow's letter sit on
 * or near a chain too, printed two or three times larger, and the legacy
 * assignment lets the nearest of them claim a chain's only interval — which is
 * how an overall `1100` came to be bound to nothing. The size of a label is a
 * fact about the typography, not about any scale.
 */
export function dimensionLabels(chains: readonly RawChain[], tokens: readonly TextToken[], maxOffsetHeights: number): TextToken[] {
  const near = (t: TextToken): boolean =>
    chains.some((chain) => {
      if (textAxisOf(t.orientation) !== chain.axis) return false
      const cx = (t.box.x0 + t.box.x1) / 2
      const cy = (t.box.y0 + t.box.y1) / 2
      const along = chain.axis === 'HORIZONTAL' ? cx : cy
      const across = chain.axis === 'HORIZONTAL' ? cy : cx
      return Math.abs(across - chain.baselinePx) / Math.max(1, t.height) <= maxOffsetHeights && along >= chain.ticks[0].atPx && along <= chain.ticks[chain.ticks.length - 1].atPx
    })
  const heights = tokens
    .filter((t) => t.glyphs.length >= 2 && near(t))
    .map((t) => t.height)
    .sort((a, b) => a - b)
  if (heights.length < 5) return [...tokens]
  const median = heights[Math.floor(heights.length / 2)]
  return tokens.filter((t) => t.height <= median * 1.8 && t.height >= median * 0.5)
}

// ---------------------------------------------------------------------------
// observations: readings as read, bound to ticks
// ---------------------------------------------------------------------------

type Obs = {
  record: DimensionObservation
  chain: number
  entry: ChainToken
  region: string
  weight: number
  cm: number
  px: number
  /** Long enough to state a scale to 4 %, and the ink's one primary binding: only these count as witnesses. */
  decisive: boolean
  /** 005D: the ink's other values within one glyph (V1), in centimetres: what the reader half-saw. 005E: the lattice's. */
  alts: number[]
  /** 005E: the ink's reading quality (`labelLattice`); undefined when no lattice was read (treated as SUPPORTED). */
  ocrClass?: OcrClass
  /** 005E: for the structural check, each alternative's distance from the as-read string (non-top glyph choices). */
  altCost: Map<number, number>
  /**
   * 005E: the values that may contest a scale (`contestValues`): those the ink holds at least
   * `VALUE_BOUNDS.contestRatio` as strongly as its reading (an AMBIGUOUS ink: every one it emitted), and those one
   * glyph away whose glyph scores at least `VALUE_BOUNDS.glyphRatio` of the cell's best (005D's substitution bound).
   * A value the image barely supports does not make a well-read ink neutral.
   */
  contestAlts: number[]
  /** 005E: the ink's lattice, for the record of which value a span is finally given. */
  lattice?: LabelLattice
  /** 005E: refuted as read by its own total/children arithmetic (M5): it no longer witnesses. */
  refuted?: { chosenCm: number }
}

/** A cm dimension is printed without a leading zero; `0,45` (metres) and a lone `0` are not that. */
export const hasLeadingZero = (text: string): boolean => /^0\d/.test(text)

/**
 * The bounds of label-to-span binding (BUILDPLAN-ANALYZER-005D, pre-reviews A and B).
 *
 * A label measures the span it is centred on. On 37 READ spans of overall chains on eight
 * development houses its centre sat 0.004–0.069 of the span's length from the span's centre; the
 * two spans a watermark and a planter cut on two development houses sat 0.147–0.165 off.
 * `centred` is the share under which a binding may decide a scale; `ambiguity` the margin under
 * which two bindings of different length tie; `distinct` the length ratio that makes them two.
 */
export const BINDING_BOUNDS = { centred: 0.1, ambiguity: 0.05, distinct: 0.03, candidateCentring: 0.3 } as const

/** The glyph ratio (alternative ÷ winner) at which a one-character alternative is a value the ink may be (V1). */
export const VALUE_BOUNDS = { glyphRatio: 0.7, alternatives: 4, latticeAlternatives: 8, contestRatio: 0.5 } as const

/** One span a label could be measuring, and how well it is placed to be the one. */
export type SpanBinding = {
  from: number
  to: number
  px: number
  /** |label centre − span centre| / span length. */
  offsetShare: number
  /** QUESTIONABLE marks the span ends at. */
  questionableEnds: number
  /** Marks the span runs across, by class. REJECTED marks and marks inside the label's own box cost nothing. */
  skipped: { tick: number; questionable: number; rejected: number }
}

/**
 * Every span a label could be measuring, by the marks' classes (005D).
 *
 * A span may end only at a mark that is a tick or a questionable one, never at a REJECTED mark,
 * and never at a mark inside the label's own box (the label's strokes crossing the line). Marks
 * it runs across are counted by class: at most `maxSkip` ticks or questionable marks, any number
 * of rejected ones. The label must sit within `candidateCentring` of the span's length from its
 * centre, as the legacy `spansFor` asks; which candidate the label measures is decided by
 * `primaryBinding`.
 */
export function bindingsFor(chain: RawChain, entries: readonly ChainToken[], idx: number, minLength: number, maxSkip: number): SpanBinding[] {
  const entry = entries[idx]
  const at = entry.atPx
  const [lo, hi] = chain.axis === 'HORIZONTAL' ? [entry.token.box.x0, entry.token.box.x1] : [entry.token.box.y0, entry.token.box.y1]
  const before = entries[idx - 1]?.atPx ?? -Infinity
  const after = entries[idx + 1]?.atPx ?? Infinity
  const ticks = chain.ticks
  const inBox = (i: number): boolean => ticks[i].atPx > lo && ticks[i].atPx < hi
  const cls = (i: number): 'TICK' | 'QUESTIONABLE' | 'REJECTED' => (inBox(i) ? 'REJECTED' : (ticks[i].class ?? 'TICK'))
  const out: SpanBinding[] = []
  for (let from = 0; from < ticks.length; from += 1) {
    if (ticks[from].atPx > at) break
    if (ticks[from].atPx < before || cls(from) === 'REJECTED') continue
    const skipped = { tick: 0, questionable: 0, rejected: 0 }
    for (let to = from + 1; to < ticks.length; to += 1) {
      if (to > from + 1) {
        const k = cls(to - 1)
        if (k === 'TICK') skipped.tick += 1
        else if (k === 'QUESTIONABLE') skipped.questionable += 1
        else skipped.rejected += 1
      }
      if (skipped.tick + skipped.questionable > maxSkip) break
      if (ticks[to].atPx > after) break
      if (ticks[to].atPx < at || cls(to) === 'REJECTED') continue
      const length = ticks[to].atPx - ticks[from].atPx
      if (length < minLength) continue
      const offsetShare = Math.abs(at - (ticks[from].atPx + ticks[to].atPx) / 2) / length
      if (offsetShare > BINDING_BOUNDS.candidateCentring) continue
      out.push({ from, to, px: round6(length), offsetShare: round6(offsetShare), questionableEnds: (cls(from) === 'QUESTIONABLE' ? 1 : 0) + (cls(to) === 'QUESTIONABLE' ? 1 : 0), skipped: { ...skipped } })
    }
  }
  return out
}

/**
 * The span a label measures (B2–B4; post-review A P0-1, B P1-3). Centring decides: among the candidates
 * centred within `centred`, the best-centred one, then the one across fewer ticks. A questionable end
 * may only pick a LONGER span that encloses the best-centred one and is centred within `ambiguity` of
 * it, ending on fewer questionable marks: a label printed off centre to clear a planter is "centred" on
 * the planter-to-planter span, and the dimension it states is the one between clean ticks. A doubt
 * about an end never hands a label to a span it is not centred on. When another centred candidate of a
 * different length is within `ambiguity` of the primary's centring, the label is AMBIGUOUS and measures
 * nothing decisively; with no centred candidate at all it is UNCENTRED.
 */
export function primaryBinding(bindings: readonly SpanBinding[]): { primary?: SpanBinding; ambiguous: boolean } {
  const eligible = bindings.filter((b) => b.offsetShare <= BINDING_BOUNDS.centred)
  const ranked = [...eligible].sort((a, b) => a.offsetShare - b.offsetShare || a.skipped.tick - b.skipped.tick || a.from - b.from || a.to - b.to)
  const best = ranked[0]
  if (!best) return { ambiguous: false }
  const enclosesBest = (b: SpanBinding): boolean => b !== best && b.from <= best.from && b.to >= best.to && (b.from < best.from || b.to > best.to)
  const enclosing = ranked.find((b) => enclosesBest(b) && b.questionableEnds < best.questionableEnds && b.offsetShare - best.offsetShare < BINDING_BOUNDS.ambiguity)
  const primary = enclosing ?? best
  // The span the enclosing reading was preferred to is that choice, not a rival to it.
  const settled = (b: SpanBinding): boolean => enclosing !== undefined && b === best
  const ambiguous = ranked.some((b) => b !== primary && !settled(b) && b.offsetShare < primary.offsetShare + BINDING_BOUNDS.ambiguity && Math.abs(Math.log(b.px / primary.px)) >= BINDING_BOUNDS.distinct)
  return { primary, ambiguous }
}

/**
 * The values an ink may be, besides the one read (V1): one character replaced by a runner-up the
 * matcher scored at least `glyphRatio` of the winner, at most `alternatives` of them, never with a
 * leading zero. Two substitutions never qualify: unrelated labels with one substitution each agree
 * by chance in a fifth of pairs (pre-review B).
 */
export function boundedValues(token: TextToken): Array<{ text: string; valueCm: number; ratio: number }> {
  const out = new Map<string, { text: string; valueCm: number; ratio: number }>()
  token.glyphs.forEach((glyph, i) => {
    if (!(glyph.score > 0)) return
    for (const alt of glyph.alternatives) {
      const ratio = alt.score / glyph.score
      if (ratio < VALUE_BOUNDS.glyphRatio) continue
      const text = token.glyphs.map((g, j) => (j === i ? alt.char : g.char)).join('')
      if (text === token.text || hasLeadingZero(text) || out.has(text)) continue
      const parsed = parseNumber(text).find((p) => p.kind === 'LINEAR_DIMENSION')
      if (!parsed) continue
      out.set(text, { text, valueCm: round6(toCentimetres(parsed.value, parsed.unit)), ratio: round6(Math.min(1, ratio)) })
    }
  })
  return [...out.values()].sort((a, b) => b.ratio - a.ratio || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)).slice(0, VALUE_BOUNDS.alternatives)
}

/**
 * 005E: the values that may contest a scale on an ink's behalf — what the ink may be besides what it was read as.
 * With a lattice: the alternatives it holds at least `VALUE_BOUNDS.contestRatio` as strongly as its reading (every one
 * when AMBIGUOUS), and every value one glyph from the as-read string whose glyph scores at least
 * `VALUE_BOUNDS.glyphRatio` of the cell's best — 005D's own bound on a substitution, measured on the lattice's glyphs,
 * so that the sharper sequence probabilities never make an ink more decisive than such a runner-up left it. A
 * contest only withholds a vote; it never gives a span a value.
 */
function contestValues(lattice: LabelLattice | undefined, alternatives: ReadonlyArray<{ valueCm: number; ratio: number }>): number[] {
  if (!lattice) return alternatives.map((a) => a.valueCm)
  const oneGlyph = new Set(lattice.sequences.filter((q) => !q.asRead && q.valueCm !== undefined && q.nonTop.length === 1 && q.nonTop[0].ratio >= VALUE_BOUNDS.glyphRatio).map((q) => q.valueCm as number))
  return alternatives.filter((a) => lattice.ocrClass === 'AMBIGUOUS' || a.ratio >= VALUE_BOUNDS.contestRatio || oneGlyph.has(a.valueCm)).map((a) => a.valueCm)
}

/**
 * 005E: the values a lattice offers besides its as-read one, as V1's records: every other dimension the image supports
 * (at most `VALUE_BOUNDS.latticeAlternatives`), with `ratio` its probability over the as-read one's (capped at 1).
 * They make an ink neutral or are chosen among by independent evidence; they are never readings, never witnesses.
 */
export function latticeAlternatives(lattice: LabelLattice): Array<{ text: string; valueCm: number; ratio: number }> {
  const own = lattice.sequences.find((q) => q.asRead)?.p ?? 0
  const out = new Map<number, { text: string; valueCm: number; ratio: number }>()
  for (const q of lattice.sequences) {
    if (q.asRead || q.valueCm === undefined || q.valueCm === lattice.asReadValueCm || out.has(q.valueCm)) continue
    out.set(q.valueCm, { text: q.text, valueCm: q.valueCm, ratio: round6(own > 0 ? Math.min(1, q.p / own) : 1) })
  }
  return [...out.values()].slice(0, VALUE_BOUNDS.latticeAlternatives)
}

function observationsOf(input: FrameMetricInput, orientation: TextOrientation, assigned: readonly ChainToken[][], regionOf: Map<TextToken, Region>): Obs[] {
  const minLength = input.minPixelLength ?? 6
  const out: Obs[] = []
  input.chains.forEach((chain, c) => {
    if (chain.axis !== textAxisOf(orientation)) return
    const entries = assigned[c] ?? []
    entries.forEach((entry, idx) => {
      const region = regionOf.get(entry.token)
      if (!region) return
      // As read: the 005E lattice's as-read string when the ink was re-read (its other values are alternatives, never
      // readings); otherwise the legacy lattice's own first reading, with no substitution in it, and 005D's V1 values.
      const held = input.lattices?.get(entry.token)
      const lattice = held?.lattice
      if (lattice && lattice.asReadValueCm === undefined) return
      const reads: Array<{ text: string; valueCm: number }> = lattice ? [{ text: lattice.asRead, valueCm: lattice.asReadValueCm as number }] : entry.readings.filter((r) => r.substitutions === 0)
      const alternatives = lattice ? latticeAlternatives(lattice) : boundedValues(entry.token)
      const altCost = new Map<number, number>(lattice ? lattice.sequences.filter((q) => !q.asRead && q.valueCm !== undefined).map((q) => [q.valueCm as number, Math.max(1, q.nonTop.length)]) : alternatives.map((a) => [a.valueCm, 1]))
      // 005D: a detected mark is a detection. A reading is bound to every span it could measure —
      // across up to two ticks or questionable marks and any rejected ones — and measures ONE of
      // them: the primary binding. Only that one may decide a scale; the others are recorded.
      const bindings = bindingsFor(chain, entries, idx, minLength, METRIC_BOUNDS.skippedTicks)
      const { primary, ambiguous } = primaryBinding(bindings)
      for (const binding of bindings) {
        const { from, to, px } = binding
        const role: NonNullable<DimensionObservation['binding']>['role'] = !primary ? 'UNCENTRED' : binding === primary ? (ambiguous ? 'AMBIGUOUS' : 'PRIMARY') : 'ALTERNATIVE'
        for (const read of reads) {
          const cm = read.valueCm
          if (!(cm > 0) || !(px > 0)) continue
          const record: DimensionObservation = {
            id: stableId('dim-obs', `${entry.token.text.replace(/[^0-9]/g, '') || 'x'}-${orientation.toLowerCase()}`, { chain: input.chainIds[c], orientation, box: entry.token.box, from, to, text: read.text }),
            frameId: input.frameId,
            chainId: input.chainIds[c],
            textRegionId: region.id,
            orientation,
            rawText: lattice ? lattice.asRead : entry.token.text,
            valueCm: round6(cm),
            axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y',
            fromPx: round6(chain.ticks[from].atPx),
            toPx: round6(chain.ticks[to].atPx),
            spanPx: px,
            impliedCmPerPx: round6(cm / px),
            ocrScore: round6(entry.token.score),
            ocrConfidence: round6(entry.token.confidence),
            leadingZero: hasLeadingZero(entry.token.text),
            independence: 'ORIENTATION_UNDECIDED',
            status: 'RAW',
            binding: { role, offsetShare: binding.offsetShare, questionableEnds: binding.questionableEnds, skipped: { ...binding.skipped } },
            ...(alternatives.length > 0 ? { valueAlternatives: alternatives.map((a) => ({ text: a.text, valueCm: a.valueCm, ratio: a.ratio })) } : {}),
            ...(lattice && held ? { ocr: { latticeId: held.id, rawTopText: lattice.rawTopText, ocrClass: lattice.ocrClass, asReadP: lattice.asReadP, probabilityMargin: lattice.probabilityMargin, asReadVariant: lattice.asReadVariant } } : {}),
          }
          // Weight rises with the span, as in the legacy vote: the ticks are located to a pixel whatever the span.
          // Only a tick run across discounts it; a questionable or rejected mark is not a statement of the draughtsman's.
          out.push({
            record,
            chain: c,
            entry,
            region: region.id,
            weight: round6(((entry.token.confidence * px) / 50) * 0.7 ** binding.skipped.tick),
            cm,
            px,
            // 005E: a LOW_QUALITY reading (a glyph the matcher could not read, or text under the legible height) never decides.
            decisive: role === 'PRIMARY' && px >= DECISIVE_SPAN_TOLERANCES * input.tolerancePx && entry.token.height >= LEGIBLE_CAP_HEIGHT_PX && !record.leadingZero && lattice?.ocrClass !== 'LOW_QUALITY',
            alts: alternatives.map((a) => a.valueCm),
            ...(lattice ? { ocrClass: lattice.ocrClass, lattice } : {}),
            altCost,
            contestAlts: contestValues(lattice, alternatives),
          })
        }
      }
    })
  })
  return out
}

// ---------------------------------------------------------------------------
// clusters: what a set of readings agrees on
// ---------------------------------------------------------------------------

type Cluster = { cm: number; members: Obs[]; weight: number }

/** The readings a scale explains within the pixel tolerance: at most one per piece of ink, the best-fitting. */
function gather(obs: readonly Obs[], cm: number, tolerancePx: number): Obs[] {
  const best = new Map<string, { o: Obs; miss: number }>()
  for (const o of obs) {
    const miss = Math.abs(o.cm / cm - o.px)
    if (miss > tolerancePx) continue
    const held = best.get(o.region)
    if (!held || miss < held.miss || (miss === held.miss && o.record.id < held.o.record.id)) best.set(o.region, { o, miss })
  }
  return [...best.values()].map((v) => v.o).sort((a, b) => (a.record.id < b.record.id ? -1 : 1))
}

/** Every distinct scale a set of readings supports, strongest first; each refined to the weighted centre of its own members. */
function clustersOf(obs: readonly Obs[], tolerancePx: number, plausibility?: ScalePlausibility): Cluster[] {
  const seeds = [...new Set(obs.map((o) => round6(o.cm / o.px)))].sort((a, b) => a - b)
  const found: Cluster[] = []
  for (const seed of seeds) {
    let cm = seed
    let members = gather(obs, cm, tolerancePx)
    for (let round = 0; round < 3 && members.length > 0; round += 1) {
      let num = 0
      let den = 0
      for (const m of members) {
        num += m.weight * m.cm * m.px
        den += m.weight * m.px * m.px
      }
      if (den <= 0) break
      const next = num / den
      const again = gather(obs, next, tolerancePx)
      if (again.length < members.length) break
      cm = next
      members = again
    }
    if (plausibility && !plausibility(cm).plausible) continue
    found.push({ cm: round6(cm), members, weight: round6(members.reduce((a, m) => a + m.weight, 0)) })
  }
  found.sort((a, b) => b.weight - a.weight || b.members.length - a.members.length || a.cm - b.cm)
  const kept: Cluster[] = []
  for (const c of found) if (!kept.some((k) => Math.abs(Math.log(c.cm / k.cm)) < DISTINCT_RATIO)) kept.push(c)
  return kept
}

/** The strongest cluster agreed by at least two decisive pieces of ink, or none. */
const consistentCluster = (obs: readonly Obs[], tolerancePx: number, plausibility?: ScalePlausibility): Cluster | undefined =>
  clustersOf(obs, tolerancePx, plausibility).find((c) => c.members.filter((m) => m.decisive).length >= 2)

// ---------------------------------------------------------------------------
// orientation decisions
// ---------------------------------------------------------------------------

type ChainChoice = { orientation: TextOrientation | null; decidedBy: OrientationDecision['decidedBy']; why: string; joinedCm?: number }

const INDEPENDENT_DECISIONS: ReadonlySet<OrientationDecision['decidedBy']> = new Set(['SINGLE_READING', 'CHAIN_SELF_CONSISTENCY', 'AXIS_SELF_CONSISTENCY', 'TYPOGRAPHY', 'AXIS_MAJORITY', 'PAGE_UPRIGHT'])

const independenceOf = (decidedBy: OrientationDecision['decidedBy']): DimensionObservation['independence'] =>
  INDEPENDENT_DECISIONS.has(decidedBy) ? 'INDEPENDENT' : decidedBy === 'OTHER_AXIS_SCALE' ? 'ORIENTATION_BY_OTHER_AXIS' : 'ORIENTATION_UNDECIDED'

/** How many of a chain's labels some reading (as read, or with up to two substitutions) puts on a span at this scale. */
function latticeFits(chain: RawChain, entries: readonly ChainToken[], cm: number, tolerancePx: number, minLength: number): number {
  let fits = 0
  entries.forEach((entry, idx) => {
    const spans = spansFor(chain, entries, idx, minLength, 0)
    const ok = readingLattice(entry.token).some((candidate) => {
      if (candidate.substitutions > METRIC_BOUNDS.latticeSubstitutions) return false
      return parseNumber(candidate.text).some((p) => {
        if (p.kind !== 'LINEAR_DIMENSION') return false
        const value = toCentimetres(p.value, p.unit)
        return spans.some(([from, to]) => Math.abs(value / cm - (chain.ticks[to].atPx - chain.ticks[from].atPx)) <= tolerancePx)
      })
    })
    if (ok) fits += 1
  })
  return fits
}

// ---------------------------------------------------------------------------
// the solver
// ---------------------------------------------------------------------------

const RANK: Record<MetricConfidence, number> = { INCONCLUSIVE: 0, WEAK: 1, SUPPORTED: 2, STRONG: 3 }

/** The confidence a scale earns from its independent witnesses alone. */
/**
 * How much of its axis a reading must measure to count, as a share of the
 * longest chain on that axis: an OVERALL reading (four fifths), a MAJOR one
 * (half), a SUBSTANTIAL one (a quarter).
 *
 * Precision is judged this way, by the size of what a reading measures, not
 * by counting readings. A page carries dozens of numbers; two of them over
 * short spans agree at some wrong scale more often than not, and two over
 * medium spans on different axes do so often enough to register a sheet a
 * third too large. A reading of half the building agreeing with a second
 * reading of a quarter of it on another chain does not happen by chance.
 */
export const WITNESS_SHARE = { overall: 0.8, major: 0.5, substantial: 0.25 } as const

type Evidence = Pick<ScaleHypothesis, 'independentGroups' | 'independentWeight' | 'longestShare' | 'corroborated' | 'axesMeasured'>

/**
 * What a scale's independent witnesses amount to, compared in order, never
 * summed: both axes stating it; a major reading corroborated by a second
 * substantial one; an overall reading; how many independent readings; their
 * weight. A single overall reading is precise and uncorroborated, so it ranks
 * below agreement and above any number of short readings.
 */
export const evidenceTuple = (h: Evidence): number[] => [h.axesMeasured ? 1 : 0, h.corroborated ? 1 : 0, h.longestShare >= WITNESS_SHARE.overall ? 1 : 0, h.independentGroups, h.independentWeight]

/** Negative when `a` has the stronger independent evidence. */
export const compareEvidence = (a: Evidence, b: Evidence): number => {
  const x = evidenceTuple(a)
  const y = evidenceTuple(b)
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return y[i] - x[i]
  return 0
}

/**
 * The confidence a scale earns from its independent witnesses alone:
 * STRONG when both axes state it and a major reading is corroborated;
 * SUPPORTED when a major reading is corroborated; WEAK on a single decisive
 * reading; INCONCLUSIVE on none. A rival of equal standing (the same first
 * three places of the tuple) with half the weight costs a step, with four
 * fifths the decision.
 */
export function confidenceOf(h: Evidence, rival?: Evidence): MetricConfidence {
  let cls: MetricConfidence = h.axesMeasured && h.corroborated ? 'STRONG' : h.corroborated ? 'SUPPORTED' : h.independentGroups >= 1 ? 'WEAK' : 'INCONCLUSIVE'
  if (rival && h.independentWeight > 0) {
    const [a, b] = [evidenceTuple(h), evidenceTuple(rival)]
    const equalStanding = a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
    const ratio = rival.independentWeight / h.independentWeight
    // A rival of higher standing (more axes, agreement or an overall reading) contradicts it outright:
    // it is at most WEAK, never SUPPORTED against better evidence (monotone in the rival's standing).
    const higherStanding = b[0] > a[0] || (b[0] === a[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] > a[2])))
    if (higherStanding) cls = RANK[cls] > RANK.WEAK ? 'WEAK' : cls
    else if (equalStanding && ratio >= 0.8) cls = 'INCONCLUSIVE'
    else if (equalStanding && ratio >= 0.5) cls = (['INCONCLUSIVE', 'INCONCLUSIVE', 'WEAK', 'SUPPORTED'] as const)[RANK[cls]]
  }
  return cls
}

/** The shares of their axes a set of independent witnesses measure, as the evidence fields of a hypothesis. */
function shareEvidence(members: readonly Obs[], share: (o: Obs) => number, qualified: (o: Obs) => boolean = () => true): Pick<ScaleHypothesis, 'longestShare' | 'substantialWitnesses' | 'majorWitnesses' | 'corroborated' | 'axesMeasured'> {
  const substantial = members.filter((m) => share(m) >= WITNESS_SHARE.substantial)
  const major = members.filter((m) => share(m) >= WITNESS_SHARE.major)
  // 005E (M3): with `qualified`, the corroborating pair must hold one ink read better than AMBIGUOUS — two coin tosses
  // that happen to agree are not two witnesses.
  const corroborated = major.some((a) => substantial.some((b) => b.region !== a.region && b.chain !== a.chain && (qualified(a) || qualified(b))))
  const onAxis = (axis: 'X' | 'Y'): Obs[] => substantial.filter((m) => m.record.axis === axis)
  const axesMeasured = onAxis('X').length > 0 && onAxis('Y').length > 0 && major.length > 0
  return { longestShare: round6(members.reduce((m, o) => Math.max(m, share(o)), 0)), substantialWitnesses: substantial.length, majorWitnesses: major.length, corroborated, axesMeasured }
}

const sameEntries = (a: readonly ChainToken[] = [], b: readonly ChainToken[] = []): boolean =>
  a.length === b.length && a.every((x, i) => x.token.text === b[i].token.text && x.token.orientation === b[i].token.orientation && x.token.box.x0 === b[i].token.box.x0 && x.token.box.y0 === b[i].token.box.y0)

export function solveFrameMetric(input: FrameMetricInput): FrameMetricOutput {
  const tol = input.tolerancePx
  const minLength = input.minPixelLength ?? 6
  const plaus = input.plausibility
  const checkpoint = input.checkpoint
  const { chains, chainIds, legacy } = input

  // --- 1. every reading of every label, bound to its spans ---------------------
  // 005D (I1): one piece of ink is one label-sized token read any way up. A page-sized pseudo-token
  // (a watermark read as a number) never merges labels into one region.
  const labels = dimensionLabels(chains, input.raw, input.maxOffsetHeights ?? 2.2)
  const { regions, regionOf } = textRegions(input.frameId, labels)
  const present = (['HORIZONTAL', 'INVERTED', 'ROTATED_CW', 'ROTATED_CCW'] as const).filter((o) => labels.some((t) => t.orientation === o))
  const assigned = new Map<TextOrientation, ChainToken[][]>()
  const obsBy = new Map<TextOrientation, Obs[]>()
  for (const o of present) {
    const perChain = assignTokens(chains, labels.filter((t) => t.orientation === o), { maxOffsetHeights: input.maxOffsetHeights, preferCentred: true })
    assigned.set(o, perChain)
    obsBy.set(o, observationsOf(input, o, perChain, regionOf))
  }
  const obsOn = (c: number, o: TextOrientation): Obs[] => (obsBy.get(o) ?? []).filter((x) => x.chain === c)
  const entriesOn = (c: number, o: TextOrientation): ChainToken[] => assigned.get(o)?.[c] ?? []

  // --- 2. which way up: horizontal text, the axis as a whole -------------------
  const horizontalChains = chains.map((c, i) => (c.axis === 'HORIZONTAL' ? i : -1)).filter((i) => i >= 0)
  const verticalChains = chains.map((c, i) => (c.axis === 'VERTICAL' ? i : -1)).filter((i) => i >= 0)
  const onAxis = (o: TextOrientation, list: readonly number[]): Obs[] => (obsBy.get(o) ?? []).filter((x) => list.includes(x.chain))
  const leadingZeros = (o: TextOrientation, list: readonly number[]): number => list.reduce((a, c) => a + entriesOn(c, o).filter((e) => hasLeadingZero(e.token.text)).length, 0)
  const upright = consistentCluster(onAxis('HORIZONTAL', horizontalChains), tol, plaus)
  const inverted = consistentCluster(onAxis('INVERTED', horizontalChains), tol, plaus)
  const lzUp = leadingZeros('HORIZONTAL', horizontalChains)
  const lzInv = leadingZeros('INVERTED', horizontalChains)
  let horizontal: ChainChoice = { orientation: 'HORIZONTAL', decidedBy: 'PAGE_UPRIGHT', why: 'the page is taken to be upright: nothing on it says its horizontal text is upside down' }
  if (upright) horizontal = { orientation: 'HORIZONTAL', decidedBy: 'AXIS_SELF_CONSISTENCY', why: `${upright.members.length} horizontal labels read upright agree on ${upright.cm} cm/px` }
  if (inverted && (!upright || inverted.weight > 2 * upright.weight)) horizontal = { orientation: 'INVERTED', decidedBy: 'AXIS_SELF_CONSISTENCY', why: `${inverted.members.length} horizontal labels read half a turn round agree on ${inverted.cm} cm/px, and the upright readings do not` }
  else if (!upright && !inverted && lzUp >= 3 && lzUp >= 3 * lzInv) horizontal = { orientation: 'INVERTED', decidedBy: 'TYPOGRAPHY', why: `${lzUp} horizontal labels read upright start with a zero, which no dimension is printed with, against ${lzInv} read half a turn round` }

  // --- 3. which way up: each vertical chain -------------------------------------
  const choices: ChainChoice[] = chains.map((c) => (c.axis === 'HORIZONTAL' ? horizontal : { orientation: null, decidedBy: 'UNDECIDED', why: '' }))
  const axisCluster = new Map<TextOrientation, Cluster | undefined>(VERTICAL_PAIR.map((o) => [o, consistentCluster(onAxis(o, verticalChains), tol, plaus)]))
  const decideVertical = (c: number): ChainChoice | undefined => {
    const [a, b] = VERTICAL_PAIR
    const readsA = obsOn(c, a).length
    const readsB = obsOn(c, b).length
    if (readsA + readsB === 0) return undefined
    if (readsA === 0 || readsB === 0) return { orientation: readsA > 0 ? a : b, decidedBy: 'SINGLE_READING', why: 'only one way up gives any dimension reading on this chain' }
    // (i) the chain's own readings agree with each other one way up and not the other
    const selfA = consistentCluster(obsOn(c, a), tol, plaus)
    const selfB = consistentCluster(obsOn(c, b), tol, plaus)
    if (selfA && (!selfB || selfA.weight > 2 * selfB.weight)) return { orientation: a, decidedBy: 'CHAIN_SELF_CONSISTENCY', why: `${selfA.members.length} of its labels read bottom to top agree on ${selfA.cm} cm/px` }
    if (selfB && (!selfA || selfB.weight > 2 * selfA.weight)) return { orientation: b, decidedBy: 'CHAIN_SELF_CONSISTENCY', why: `${selfB.members.length} of its labels read top to bottom agree on ${selfB.cm} cm/px` }
    // (ii) one of its readings joins labels ELSEWHERE on this axis that agree with each other: the
    // cluster is built without this chain's own inks, and the reading that joins it is not counted
    // as a witness of that cluster's scale (it was turned to fit it).
    const own = new Set([...obsOn(c, a), ...obsOn(c, b)].map((x) => x.region))
    const elsewhere = (o: TextOrientation): Cluster | undefined => consistentCluster(onAxis(o, verticalChains).filter((x) => x.chain !== c && !own.has(x.region)), tol, plaus)
    const clA = axisCluster.get(a) ? elsewhere(a) : undefined
    const clB = axisCluster.get(b) ? elsewhere(b) : undefined
    const joins = (o: TextOrientation, cl: Cluster | undefined): boolean => cl !== undefined && obsOn(c, o).some((x) => Math.abs(x.cm / cl.cm - x.px) <= tol)
    const jA = joins(a, clA)
    const jB = joins(b, clB)
    if (jA !== jB) {
      const o = jA ? a : b
      const cl = (jA ? clA : clB) as Cluster
      return { orientation: o, decidedBy: 'AXIS_SELF_CONSISTENCY', joinedCm: cl.cm, why: `read ${o === a ? 'bottom to top' : 'top to bottom'}, a label joins ${cl.members.length} vertical labels on other chains that agree on ${cl.cm} cm/px` }
    }
    // (iii) a trailing zero turned half a turn is a leading one, which no dimension is printed with
    const lzA = entriesOn(c, a).filter((e) => hasLeadingZero(e.token.text)).length
    const lzB = entriesOn(c, b).filter((e) => hasLeadingZero(e.token.text)).length
    if ((lzA === 0) !== (lzB === 0)) return { orientation: lzA === 0 ? a : b, decidedBy: 'TYPOGRAPHY', why: `read the other way up, ${Math.max(lzA, lzB)} of its labels start with a zero, which no dimension is printed with` }
    return undefined
  }
  const decided = new Map<number, ChainChoice>()
  verticalChains.forEach((c, i) => {
    checkpoint?.tick({ subphase: { id: 'ORIENTATION', label: 'checking which way up the labels are' }, counters: { chains: i + 1, chainsTotal: verticalChains.length } })
    const d = decideVertical(c)
    if (d) decided.set(c, d)
  })
  // (iv) a sheet sets its vertical text one way: the chains that decided on evidence decide for the rest
  const tally = (o: TextOrientation): number => [...decided.values()].filter((d) => d.orientation === o && d.decidedBy !== 'SINGLE_READING').length
  const cw = tally('ROTATED_CW')
  const ccw = tally('ROTATED_CCW')
  const majority: TextOrientation | undefined = cw + ccw >= 2 && cw >= 3 * Math.max(1, ccw) ? 'ROTATED_CW' : cw + ccw >= 2 && ccw >= 3 * Math.max(1, cw) ? 'ROTATED_CCW' : undefined
  // (v) the other axis's scale — a dependence, recorded as one
  const xWitnesses = onAxis(horizontal.orientation ?? 'HORIZONTAL', horizontalChains)
  const xScale = clustersOf(xWitnesses, tol, plaus)[0]
  for (const c of verticalChains) {
    if (decided.has(c)) {
      choices[c] = decided.get(c) as ChainChoice
      continue
    }
    const [a, b] = VERTICAL_PAIR
    if (obsOn(c, a).length + obsOn(c, b).length === 0 && entriesOn(c, a).length + entriesOn(c, b).length === 0) continue
    if (majority) {
      choices[c] = { orientation: majority, decidedBy: 'AXIS_MAJORITY', why: `${Math.max(cw, ccw)} chains on this sheet decided on their own evidence that its vertical text reads ${majority === a ? 'bottom to top' : 'top to bottom'}, and ${Math.min(cw, ccw)} the other way` }
      continue
    }
    if (xScale) {
      const rawFits = (o: TextOrientation): number => obsOn(c, o).filter((x) => Math.abs(x.cm / xScale.cm - x.px) <= tol).length
      const latFits = (o: TextOrientation): number => latticeFits(chains[c], entriesOn(c, o), xScale.cm, tol, minLength)
      const [ra, rb] = [rawFits(a), rawFits(b)]
      const [la, lb] = ra === rb ? [latFits(a), latFits(b)] : [0, 0]
      if (ra !== rb || la !== lb) {
        const o = ra > rb || (ra === rb && la > lb) ? a : b
        choices[c] = { orientation: o, decidedBy: 'OTHER_AXIS_SCALE', why: `at the horizontal labels' ${xScale.cm} cm/px, ${ra !== rb ? `${Math.max(ra, rb)} of its labels as read` : `${Math.max(la, lb)} of its labels within ${METRIC_BOUNDS.latticeSubstitutions} digits`} fit read ${o === a ? 'bottom to top' : 'top to bottom'}, against ${ra !== rb ? Math.min(ra, rb) : Math.min(la, lb)} the other way; the vertical readings therefore witness nothing about isotropy` }
        continue
      }
    }
    // (vi) nothing decides: the legacy vote's way up, named for what it is
    const legacyOrientations = [...new Set((legacy.tokensPerChain[c] ?? []).map((e) => e.token.orientation))]
    const merit = (o: TextOrientation): number => entriesOn(c, o).reduce((s, e) => s + tokenMerit(e.token), 0)
    const fallback = legacyOrientations.length === 1 ? legacyOrientations[0] : merit(a) >= merit(b) ? a : b
    choices[c] = { orientation: fallback, decidedBy: 'UNDECIDED', why: 'no evidence settles which way up its labels are; the page vote’s reading is kept and witnesses nothing' }
  }

  const decisions: OrientationDecision[] = chains
    .map((chain, c): OrientationDecision | undefined => {
      const pair = chain.axis === 'HORIZONTAL' ? HORIZONTAL_PAIR : VERTICAL_PAIR
      const any = pair.some((o) => entriesOn(c, o).length > 0)
      if (!any) return undefined
      const choice = choices[c]
      return {
        chainId: chainIds[c],
        axis: chain.axis === 'HORIZONTAL' ? 'X' : 'Y',
        chosen: choice.orientation,
        decidedBy: choice.decidedBy,
        candidates: pair
          .filter((o) => present.includes(o as (typeof present)[number]))
          .map((o) => ({
            orientation: o,
            readings: obsOn(c, o).length,
            selfConsistent: consistentCluster(obsOn(c, o), tol, plaus)?.members.length ?? 0,
            leadingZeros: entriesOn(c, o).filter((e) => hasLeadingZero(e.token.text)).length,
            otherAxisFits: chain.axis === 'VERTICAL' && xScale ? obsOn(c, o).filter((x) => Math.abs(x.cm / xScale.cm - x.px) <= tol).length : 0,
            merit: round6(entriesOn(c, o).reduce((s, e) => s + tokenMerit(e.token), 0)),
          })),
        why: choice.why || 'no label on this chain parses as a dimension',
      }
    })
    .filter((d): d is OrientationDecision => d !== undefined)

  // --- 4. the witnesses: each chain's readings in its decided orientation -----
  const witnesses: Obs[] = []
  chains.forEach((_, c) => {
    const o = choices[c].orientation
    if (!o) return
    const joined = choices[c].joinedCm
    for (const x of obsOn(c, o)) {
      const byScale = joined !== undefined && Math.abs(x.cm / joined - x.px) <= tol
      x.record = { ...x.record, independence: byScale ? 'ORIENTATION_BY_SCALE' : independenceOf(choices[c].decidedBy) }
      witnesses.push(x)
    }
  })
  // 005D (I2): one ink, one witness, one span. An ink whose decisive readings measure different spans
  // or values (bound on two chains, or parsed two ways) has not said which: it witnesses nothing.
  const decisiveBy = new Map<string, Set<string>>()
  for (const x of witnesses) if (x.record.independence === 'INDEPENDENT' && x.decisive) decisiveBy.set(x.region, (decisiveBy.get(x.region) ?? new Set()).add(`${x.chain}|${x.record.fromPx}|${x.record.toPx}|${x.cm}`))
  for (const x of witnesses) {
    if (!x.decisive || (decisiveBy.get(x.region)?.size ?? 0) <= 1) continue
    x.decisive = false
    if (x.record.binding) x.record = { ...x.record, binding: { ...x.record.binding, role: 'AMBIGUOUS' } }
  }
  witnesses.sort((a, b) => b.weight - a.weight || (a.record.id < b.record.id ? -1 : 1))
  const bounded = witnesses.slice(0, METRIC_BOUNDS.observations)
  // 005D (I5, post-review C P1-2): one dimension drawn twice — the same marks on a parallel line a few label
  // heights away — is one statement, however many times its value is printed. Of the readings bound to the
  // same span on twin lines the heaviest counts; the others stay on the record, uncounted.
  const twins = parallelCopiesOf(chains, medianLabelHeight(labels))
  const statementOf = new Map<string, number>()
  for (const w of bounded) {
    if (!w.decisive) continue
    const key = `${twins.get(w.chain) ?? w.chain}|${Math.round(w.record.fromPx)}|${Math.round(w.record.toPx)}`
    const first = statementOf.get(key)
    if (first === undefined) statementOf.set(key, w.chain)
    else if (first !== w.chain) w.decisive = false
  }
  // 005E (M5): a total whose children — distinct inks, read SUPPORTED or better — refute it as read, and which agrees
  // with them in exactly one assignment of the inks' own lattice values at the least cost (≤ 2 glyph choices), is
  // STRUCTURAL: the as-read values that assignment replaces stop being witnesses; nothing is added to any scale.
  const structural = structuralSupport(input.frameId, chains, chainIds, bounded, medianLabelHeight(labels))

  // --- 5. the scales the witnesses support -------------------------------------
  const longestOn = (axis: 'HORIZONTAL' | 'VERTICAL'): number => Math.max(1, ...chains.filter((c) => c.axis === axis).map((c) => c.ticks[c.ticks.length - 1].atPx - c.ticks[0].atPx))
  const shareOf = (m: Obs): number => m.px / longestOn(m.record.axis === 'X' ? 'HORIZONTAL' : 'VERTICAL')
  const clusterOf = new Map<string, Cluster>()
  const describe = (cl: Cluster): ScaleHypothesis => {
    const independent = cl.members.filter((m) => m.record.independence === 'INDEPENDENT' && m.decisive)
    const axes = [...new Set(independent.map((m) => m.record.axis))].sort() as Array<'X' | 'Y'>
    const residual = cl.members.length === 0 ? 0 : Math.sqrt(cl.members.reduce((a, m) => a + (m.cm / cl.cm - m.px) ** 2, 0) / cl.members.length)
    const id = stableId('scale', `${cl.cm}`.replace('.', '-'), { frameId: input.frameId, cm: cl.cm })
    clusterOf.set(id, cl)
    return {
      id,
      cmPerPixel: cl.cm,
      witnessIds: cl.members.map((m) => m.record.id),
      groups: cl.members.length,
      independentGroups: independent.length,
      chains: new Set(independent.map((m) => m.chain)).size,
      independentAxes: axes,
      weight: cl.weight,
      independentWeight: round6(independent.reduce((a, m) => a + m.weight, 0)),
      ...shareEvidence(independent, shareOf),
      residualPx: round6(residual),
      plausible: plaus ? plaus(cl.cm).plausible : true,
      why: `${independent.length} independent reading${independent.length === 1 ? '' : 's'} on ${new Set(independent.map((m) => m.chain)).size} chain(s)${cl.members.length > independent.length ? `, and ${cl.members.length - independent.length} not counted (short, or their way up not independent of a scale)` : ''}: ${cl.members
        .slice(0, 6)
        .map((m) => `${m.record.rawText}/${m.px} px`)
        .join(', ')}`,
    }
  }
  // Hypotheses are the scales the COUNTED witnesses (independent, decisive) support; a reading that is
  // not counted is attached to the scale it agrees with and can never merge a counted scale away. Scales
  // only uncounted readings state stay on the record after them. Plausibility is judged per hypothesis,
  // so a ruled-out scale stays on the record too.
  const counted = bounded.filter((w) => w.record.independence === 'INDEPENDENT' && w.decisive)
  const attach = (cl: Cluster): Cluster => {
    const members = gather(bounded, cl.cm, tol)
    return { cm: cl.cm, members, weight: round6(members.reduce((a, m) => a + m.weight, 0)) }
  }
  const countedClusters = clustersOf(counted, tol).map(attach)
  const all = [...countedClusters, ...clustersOf(bounded, tol).filter((c) => !countedClusters.some((k) => Math.abs(Math.log(c.cm / k.cm)) < DISTINCT_RATIO))]
  const hypotheses: ScaleHypothesis[] = all
    .map(describe)
    .sort((a, b) => b.independentWeight - a.independentWeight || b.weight - a.weight || a.cmPerPixel - b.cmPerPixel)
    .slice(0, METRIC_BOUNDS.hypotheses)
  hypotheses.forEach((h, i) => checkpoint?.tick({ subphase: { id: 'SCALE', label: 'comparing scales' }, counters: { hypothesis: i + 1, hypothesesTotal: hypotheses.length } }))
  // 005E (M1–M3, pre-review D C2): which scale the witnesses decide, and how far — on each scale's DECIDING inks.
  // An ink counted for one scale is contested when a value its own lattice generated (never a value fitted to a scale)
  // fits a distinct scale with standing — a substantial counted ink of its own whose values do not fit back — within
  // the pixel tolerance of both spans. The same rule, with the same tolerance, weighs the selection, every rival and
  // the page vote (005D applied it one way and only when it would swap or tie the selection). Contested inks leave the
  // ranking and the confidence; a corroborating pair must hold an ink read better than AMBIGUOUS.
  const counts = (w: Obs): boolean => w.record.independence === 'INDEPENDENT' && w.decisive
  const countedOf = (h: ScaleHypothesis): Obs[] => (clusterOf.get(h.id)?.members ?? []).filter(counts)
  const candidates = hypotheses.filter((h) => h.plausible && h.independentGroups >= 1).sort((a, b) => compareEvidence(a, b) || a.cmPerPixel - b.cmPerPixel)
  const distinctScale = (a: number, b: number): boolean => Math.abs(Math.log(a / b)) >= DISTINCT_RATIO
  // A scale is itself measured on a span of its own: the tolerance is the ink's and, capped at as much again, the
  // scale's widest counted span's (005D post-review B P1-1).
  const widestOf = (members: readonly Obs[]): number => Math.max(1, ...members.map((w) => w.px))
  const fitsAt = (w: Obs, cm: number, widest: number): boolean => w.contestAlts.some((v) => Math.abs(v / cm - w.px) <= tol * (1 + Math.min(1, w.px / widest)))
  // Standing: a counted ink of the rival (decisive: a span long enough to state a scale, read better than LOW_QUALITY)
  // whose own values do not fit back. Pre-review D also asked for a quarter of the axis; a true scale stated by one
  // part a hair under that share then cannot contest a misread overall, and the misread is adopted — a contest
  // costs at most an INCONCLUSIVE, a missed one a wrong scale.
  const standingAgainst = (members: readonly Obs[], cm: number, widest: number): boolean => members.some((w) => !fitsAt(w, cm, widest))
  const contestedMemo = new Map<string, Set<string>>()
  const contestedIn = (h: ScaleHypothesis): Set<string> => {
    const held = contestedMemo.get(h.id)
    if (held) return held
    const out = new Set<string>()
    const own = countedOf(h)
    for (const r of candidates) {
      if (r === h || !distinctScale(r.cmPerPixel, h.cmPerPixel)) continue
      const theirs = countedOf(r)
      if (!standingAgainst(theirs, h.cmPerPixel, widestOf(own))) continue
      for (const w of own) if (fitsAt(w, r.cmPerPixel, widestOf(theirs))) out.add(w.record.id)
    }
    contestedMemo.set(h.id, out)
    return out
  }
  const decidingOf = (h: ScaleHypothesis): Obs[] => countedOf(h).filter((w) => !contestedIn(h).has(w.record.id))
  const qualified = (w: Obs): boolean => w.ocrClass !== 'AMBIGUOUS'
  const evidenceOf = (members: readonly Obs[], q?: (w: Obs) => boolean): Evidence => ({ independentGroups: members.length, independentWeight: round6(members.reduce((a, w) => a + w.weight, 0)), ...shareEvidence(members, shareOf, q) })
  const blindEvidence = (h: ScaleHypothesis): Evidence => evidenceOf(countedOf(h))
  const awareEvidence = (h: ScaleHypothesis): Evidence => evidenceOf(decidingOf(h), qualified)
  // Standing: both axes, corroboration, an overall reading — the first three places of the evidence tuple.
  const lowerStanding = (a: Evidence, b: Evidence): boolean => {
    const [x, y] = [evidenceTuple(a).slice(0, 3), evidenceTuple(b).slice(0, 3)]
    const i = x.findIndex((v, k) => v !== y[k])
    return i >= 0 && x[i] < y[i]
  }
  const strongest = candidates[0]
  const ranked = [...candidates].sort((a, b) => compareEvidence(awareEvidence(a), awareEvidence(b)) || compareEvidence(a, b) || a.cmPerPixel - b.cmPerPixel)
  let selected = ranked[0]
  let undecidedRival = false
  // Contesting never promotes a scale of lower standing than the strongest's whole evidence: then nothing decides
  // between them, and the solution says so (INCONCLUSIVE) instead of taking either side.
  if (selected && strongest && selected !== strongest && distinctScale(selected.cmPerPixel, strongest.cmPerPixel) && lowerStanding(awareEvidence(selected), blindEvidence(strongest))) {
    selected = strongest
    undecidedRival = true
  }
  const rival = selected ? ranked.find((h) => h !== selected && distinctScale(h.cmPerPixel, selected.cmPerPixel)) : undefined
  const rivalNeutral = new Set<string>([...(selected ? contestedIn(selected) : []), ...(rival ? contestedIn(rival) : [])])
  const contest = selected && rival && awareEvidence(selected).independentWeight > 0 ? round6(awareEvidence(rival).independentWeight / awareEvidence(selected).independentWeight) : undefined

  // --- 6. what that makes of the legacy vote's scale -------------------------
  const L = legacy.pooledScale
  const legacyAxis = (axis: 'X' | 'Y'): number | undefined => (axis === 'X' ? legacy.scaleX : legacy.scaleY) ?? L
  const agreeTol = (h: ScaleHypothesis): number => {
    const longest = Math.max(1, ...bounded.filter((w) => h.witnessIds.includes(w.record.id) && w.record.independence === 'INDEPENDENT' && w.decisive).map((w) => w.px))
    return Math.max(0.012, tol / longest)
  }
  // Asked whenever the selection would not simply confirm the vote (post-review B P1-2): between the
  // confirmation tolerance and the distinct ratio a selection was neither confirmed nor checked.
  const distinctFromLegacy = selected !== undefined && L !== undefined && Math.abs(Math.log(selected.cmPerPixel / L)) > agreeTol(selected)
  const selectedMembers = selected ? countedOf(selected) : []
  const voteMembers = bounded.filter((w) => {
    const at = legacyAxis(w.record.axis)
    return counts(w) && at !== undefined && Math.abs(w.cm / at - w.px) <= tol
  })
  const atVote = (w: Obs): number => legacyAxis(w.record.axis) as number
  // The vote is the incumbent, not a rival: it never wins by a contest, it can only keep its place. So an ink whose own
  // values fit both decides nothing between them without the vote needing standing (005D V3), now in both directions
  // and at the one tolerance every contest uses (005D asked the vote at plain `tol`, pre-review D P1-2).
  const selectedStands = selected !== undefined && distinctFromLegacy
  const voteStands = selected !== undefined && distinctFromLegacy
  const neutral = new Set<string>()
  const legacySupport: Obs[] = []
  for (const w of voteMembers) {
    if (selected && selectedStands && fitsAt(w, selected.cmPerPixel, widestOf(selectedMembers))) {
      neutral.add(w.record.id)
      continue
    }
    legacySupport.push(w)
  }
  const legacyRegions = new Map<string, Obs>()
  for (const w of legacySupport) if (!legacyRegions.has(w.region)) legacyRegions.set(w.region, w)
  const legacyStats = {
    independentGroups: legacyRegions.size,
    independentWeight: round6([...legacyRegions.values()].reduce((a, w) => a + w.weight, 0)),
    chains: new Set([...legacyRegions.values()].map((w) => w.chain)).size,
    independentAxes: [...new Set([...legacyRegions.values()].map((w) => w.record.axis))].sort() as Array<'X' | 'Y'>,
    ...shareEvidence([...legacyRegions.values()], shareOf, qualified),
  }
  const legacyAnchors = legacy.solved.flatMap((s) => s.segments).filter((g) => g.origin === 'READ' || g.origin === 'CHAIN_CORRECTED')

  let relation: FrameMetricSolution['relation']
  let confidence: MetricConfidence
  // 005D (§43): the hierarchy, checked on values as read — primary bindings, in each chain's decided
  // orientation. A total and the children it frames that disagree as read, the selected scale stated
  // on one side and a distinct rival on the other, with no counted reading outside the pair to decide
  // between them, is a conflict to report: never a consistency forced by taking the stronger side.
  const observationsAsRead = witnesses.filter((w) => w.record.binding?.role === 'PRIMARY' && w.record.independence !== 'ORIENTATION_UNDECIDED' && !w.record.leadingZero).map((w) => ({ chain: w.chain, fromPx: w.record.fromPx, toPx: w.record.toPx, cm: w.cm, region: w.region }))
  const labelHeight = medianLabelHeight(labels)
  const undecidedConflict = ((): boolean => {
    if (!selected || !rival) return false
    const rivalMembers = decidingOf(rival)
    const selectedMembers = decidingOf(selected)
    const conflicts = dimensionHierarchy(input.frameId, chains, chainIds, [], observationsAsRead, labelHeight).filter((r) => r.kind === 'CONFLICTS_WITH')
    return conflicts.some((r) => {
      const inPair = (w: Obs): boolean => chainIds[w.chain] === r.fromChainId || chainIds[w.chain] === r.toChainId
      // Undecided only when the side that ranks first does not also outnumber the other: a total and two
      // children agreeing against one misread child is decided by the pair itself (post-review C P1-1).
      return selectedMembers.some(inPair) && rivalMembers.some(inPair) && [...selectedMembers, ...rivalMembers].every(inPair) && selectedMembers.length <= rivalMembers.length
    })
  })()
  let own: MetricConfidence = undecidedConflict || undecidedRival ? 'INCONCLUSIVE' : selected ? confidenceOf(awareEvidence(selected), rival ? awareEvidence(rival) : undefined) : 'INCONCLUSIVE'
  const selectedDeciding = selected ? decidingOf(selected) : []
  const deciding = selectedDeciding.filter((w) => {
    if (!voteStands || !fitsAt(w, atVote(w), widestOf(voteMembers))) return true
    neutral.add(w.record.id)
    return false
  })
  const decidingEvidence: Evidence = evidenceOf(deciding, qualified)
  let ownDeciding: MetricConfidence = deciding.length === 0 || undecidedConflict || undecidedRival ? 'INCONCLUSIVE' : deciding.length === selectedDeciding.length ? own : confidenceOf(decidingEvidence, rival ? awareEvidence(rival) : undefined)
  // 005E (M4, pre-review D C3): false consensus. Blind to reading quality the scale would stand at SUPPORTED or better
  // and, weighed by it, it does not — and the doubt points somewhere: a rival with standing has an ink read better than
  // one this scale lost (BETTER_CLASS_RIVAL), or two ambiguous inks of this scale have lattice values agreeing on one
  // other scale (CANDIDATE_CONSENSUS). Then the confidence is INCONCLUSIVE, so the first reading is challenged; the
  // challenger is named, never selected, and a candidate consensus is never a hypothesis.
  let falseConsensus: NonNullable<FrameMetricSolution['topology']>['falseConsensus']
  const demoted: Obs[] = []
  if (selected) {
    const kept = new Set(decidingOf(selected).map((w) => w.record.id))
    for (const w of countedOf(selected)) if (!kept.has(w.record.id) || w.ocrClass === 'AMBIGUOUS') demoted.push(w)
    const blindRival = strongest ? candidates.find((h) => h !== strongest && distinctScale(h.cmPerPixel, strongest.cmPerPixel)) : undefined
    const blindTier = strongest ? confidenceOf(blindEvidence(strongest), blindRival ? blindEvidence(blindRival) : undefined) : 'INCONCLUSIVE'
    if (RANK[blindTier] >= RANK.SUPPORTED && RANK[own] < RANK.SUPPORTED && demoted.length > 0) {
      const grade = (w: Obs): number => (w.ocrClass === 'CLEAR' ? 3 : w.ocrClass === 'AMBIGUOUS' ? 1 : w.ocrClass === 'LOW_QUALITY' ? 0 : 2)
      const worst = Math.min(...demoted.map(grade))
      const challenger = ranked.find((r) => r !== selected && distinctScale(r.cmPerPixel, (selected as ScaleHypothesis).cmPerPixel) && standingAgainst(countedOf(r), (selected as ScaleHypothesis).cmPerPixel, widestOf(selectedMembers)) && countedOf(r).some((w) => grade(w) > worst))
      let candidateScale: number | undefined
      if (!challenger) {
        const ambiguous = countedOf(selected).filter((w) => w.ocrClass === 'AMBIGUOUS').sort((a, b) => (a.record.id < b.record.id ? -1 : 1))
        search: for (let i = 0; i < ambiguous.length; i += 1) {
          for (let j = i + 1; j < ambiguous.length; j += 1) {
            const [u, v] = [ambiguous[i], ambiguous[j]]
            if (u.chain === v.chain || u.region === v.region) continue
            for (const a of [...u.alts].sort((x, y) => x - y)) {
              for (const b of [...v.alts].sort((x, y) => x - y)) {
                const c = (a + b) / (u.px + v.px)
                if (Math.abs(a / c - u.px) > tol || Math.abs(b / c - v.px) > tol || !distinctScale(c, selected.cmPerPixel) || (plaus && !plaus(c).plausible)) continue
                candidateScale = round6(c)
                break search
              }
            }
          }
        }
      }
      if (challenger || candidateScale !== undefined) {
        falseConsensus = {
          kind: challenger ? 'BETTER_CLASS_RIVAL' : 'CANDIDATE_CONSENSUS',
          selectedHypothesisId: selected.id,
          ...(challenger ? { challengerHypothesisId: challenger.id } : {}),
          ...(candidateScale !== undefined ? { candidateCmPerPixel: candidateScale } : {}),
          demotedObservationIds: demoted.map((w) => w.record.id).sort(),
          blindConfidence: blindTier,
          why: challenger
            ? `blind to reading quality ${selected.cmPerPixel} cm/px stands ${blindTier}; its inks read ${demoted.map((w) => `${w.record.rawText} (${w.ocrClass ?? 'unrated'})`).join(', ')} do not decide, and ${challenger.cmPerPixel} cm/px has an ink read better`
            : `blind to reading quality ${selected.cmPerPixel} cm/px stands ${blindTier}; two of its inks are coin tosses whose own other values agree on ${candidateScale} cm/px`,
        }
        own = 'INCONCLUSIVE'
        ownDeciding = 'INCONCLUSIVE'
      }
    }
  }
  // Replacing the page vote's scale needs more than disagreeing with it: the vote had no
  // independent reading at all and this one has an overall reading or two that agree, or it is
  // beaten outright on axes, agreement and count by readings that are at least SUPPORTED.
  const legacyEvidence: Evidence = { ...legacyStats }
  const beatsLegacy = (): boolean => {
    if (decidingEvidence.independentGroups === 0) return false
    const [a, b] = [evidenceTuple(decidingEvidence), evidenceTuple(legacyEvidence)]
    const outright = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[3] > b[3])))
    return legacyStats.independentGroups === 0 ? RANK[ownDeciding] >= RANK.SUPPORTED || (ownDeciding === 'WEAK' && decidingEvidence.longestShare >= WITNESS_SHARE.overall) : outright && RANK[ownDeciding] >= RANK.SUPPORTED
  }
  if (selected && L !== undefined && Math.abs(Math.log(selected.cmPerPixel / L)) <= agreeTol(selected)) {
    relation = 'CONFIRMED'
    confidence = own
  } else if (selected && L !== undefined && beatsLegacy()) {
    relation = 'REPLACED'
    confidence = ownDeciding
  } else if (L !== undefined) {
    relation = 'LEGACY_UNCONFIRMED'
    confidence = legacyStats.independentGroups === 0 ? 'INCONCLUSIVE' : confidenceOf(legacyEvidence, selected ? awareEvidence(selected) : undefined)
  } else if (selected && RANK[own] >= RANK.SUPPORTED) {
    relation = 'ADDED'
    confidence = own
  } else {
    relation = 'NO_SCALE'
    confidence = 'INCONCLUSIVE'
  }

  // --- 7. the scale each axis is read at, and the chains read at it -----------
  const replaced = relation === 'REPLACED' || relation === 'ADDED'
  // A chain is read again the right way up at the vote's scale only when independent readings confirmed that
  // scale: at an unconfirmed one, a re-read that "reads more" only reads more agreement with an unsupported scale.
  const rereadable = relation === 'CONFIRMED'
  let pooled = L
  let scaleX = legacy.scaleX
  let scaleY = legacy.scaleY
  if (replaced && selected) {
    pooled = selected.cmPerPixel
    // Each axis refit on its own independent witnesses, never further than the pooled tolerance.
    const axisScale = (axis: 'X' | 'Y'): number => {
      const own = bounded.filter((w) => w.record.axis === axis && w.record.independence === 'INDEPENDENT' && w.decisive && Math.abs(w.cm / selected.cmPerPixel - w.px) <= tol)
      if (own.length === 0) return selected.cmPerPixel
      const num = own.reduce((a, w) => a + w.weight * w.cm * w.px, 0)
      const den = own.reduce((a, w) => a + w.weight * w.px * w.px, 0)
      const s = den > 0 ? num / den : selected.cmPerPixel
      return round6(Math.abs(Math.log(s / selected.cmPerPixel)) > 0.05 ? selected.cmPerPixel : s)
    }
    scaleX = axisScale('X')
    scaleY = axisScale('Y')
  }
  // The chains are read from the page vote's own tokens, changed only where an orientation decision
  // changed them: a label the chain decided is the other way up is swapped for its other reading, and
  // a label the vote deleted outright is put back. Nothing else about how numbers meet chains changes,
  // except that a number some span is centred on claims its interval first.
  const decidedFor = new Map<number, TextOrientation>()
  chains.forEach((_, c) => {
    const ch = choices[c]
    if (ch.orientation && ch.decidedBy !== 'UNDECIDED') decidedFor.set(c, ch.orientation)
  })
  const chainOfLegacy = new Map<TextToken, number>()
  legacy.tokensPerChain.forEach((list, c) => list.forEach((e) => chainOfLegacy.set(e.token, c)))
  const corrected: TextToken[] = []
  const inList = new Set<string>()
  for (const t of input.legacyTokens) {
    const c = chainOfLegacy.get(t)
    const want = c === undefined ? undefined : decidedFor.get(c)
    const region = regionOf.get(t)
    let use = t
    if (want && t.orientation !== want && region) {
      const other = region.members.filter((m) => m.orientation === want).sort((a, b) => tokenMerit(b) - tokenMerit(a) || compareTokens(a, b))[0]
      if (other) use = other
    }
    corrected.push(use)
    if (region) inList.add(region.id)
  }
  for (const [c, o] of [...decidedFor].sort((a, b) => a[0] - b[0])) {
    for (const e of entriesOn(c, o)) {
      const region = regionOf.get(e.token)
      if (!region || inList.has(region.id)) continue
      corrected.push(e.token)
      inList.add(region.id)
    }
  }
  // 005E (M7): read again, a chain takes its labels' lattices — the as-read value as the reading, the image-supported
  // others as corrections a scale may choose (CHAIN_CORRECTED, DERIVED) — instead of the legacy substitution list.
  const latticeReadings = (token: TextToken): ChainToken['readings'] | undefined => {
    const lattice = input.lattices?.get(token)?.lattice
    if (!lattice || lattice.asReadValueCm === undefined) return undefined
    const own = lattice.sequences.find((q) => q.asRead)?.p ?? 0
    const out: ChainToken['readings'] = []
    for (const q of lattice.sequences) {
      if (q.valueCm === undefined) continue
      const parsed = parseNumber(q.text).find((x) => x.kind === 'LINEAR_DIMENSION')
      if (!parsed) continue
      out.push(q.asRead ? { text: q.text, parsed, valueCm: q.valueCm, confidence: 1, substitutions: 0 } : { text: q.text, parsed, valueCm: q.valueCm, confidence: round6(own > 0 ? Math.min(1, q.p / own) : 0), substitutions: Math.max(1, q.nonTop.length) })
    }
    return out.length > 0 ? out : undefined
  }
  const perChain = assignTokens(chains, corrected, { maxOffsetHeights: input.maxOffsetHeights, preferCentred: true, readingsOf: input.lattices ? latticeReadings : undefined })
  const solved: SolvedChain[] = []
  const tokensPerChain: ChainToken[][] = []
  const reread: string[] = []
  const reads = (s: SolvedChain | undefined): number => (s?.segments ?? []).filter((g) => g.origin === 'READ').length
  const readRegions = (s: SolvedChain | undefined): string[] =>
    (s?.segments ?? []).flatMap((g) => ((g.origin === 'READ' || g.origin === 'CHAIN_CORRECTED') && g.token ? [regionOf.get(g.token)?.id ?? `token:${g.token.box.x0},${g.token.box.y0}`] : []))
  // Where the page vote's scale stands, a chain is read again only when the new reading READS more of
  // it at that scale than the vote's own did, and only from labels no other chain already reads: a
  // re-read that merely trades one correction for another, or reads a label a neighbour reads, is a
  // different story about the same ink, not more evidence.
  const offers = chains.map((chain, c) => {
    const mine = perChain[c] ?? []
    if (!replaced && (!rereadable || sameEntries(mine, legacy.tokensPerChain[c]))) return null
    const axisScale = pooled === undefined ? undefined : (chain.axis === 'HORIZONTAL' ? scaleX : scaleY) ?? pooled
    // 005D: a chain read again at a REPLACED scale is cut by its marks' classes: a rejected mark is no
    // cut, a questionable one costs nothing to run across. A confirmed scale keeps the vote's cuts.
    const s = axisScale === undefined ? solveChain(chain, [], { tolerancePx: tol, minPixelLength: minLength }) : solveChain(chain, mine, { tolerancePx: tol, minPixelLength: minLength, fixedScale: axisScale, topology: replaced })
    return { solved: s, tokens: [...mine] }
  })
  const better = (c: number): boolean => {
    const offer = offers[c]
    return offer !== null && reads(offer.solved) > reads(legacy.solved[c])
  }
  const taken = new Set<string>()
  if (!replaced) chains.forEach((_, c) => (better(c) ? undefined : readRegions(legacy.solved[c]).forEach((r) => taken.add(r))))
  chains.forEach((_, c) => {
    const offer = offers[c]
    if (offer === null || (!replaced && (!better(c) || readRegions(offer.solved).some((r) => taken.has(r))))) {
      solved.push(legacy.solved[c])
      tokensPerChain.push(legacy.tokensPerChain[c] ?? [])
      if (!replaced) readRegions(legacy.solved[c]).forEach((r) => taken.add(r))
      return
    }
    if (!replaced) {
      reread.push(chainIds[c])
      readRegions(offer.solved).forEach((r) => taken.add(r))
    }
    solved.push(offer.solved)
    tokensPerChain.push(offer.tokens)
  })

  // --- 8. the record ------------------------------------------------------------
  const finalScale = (axis: 'X' | 'Y'): number | undefined => (axis === 'X' ? scaleX : scaleY) ?? pooled
  const acceptedKeys = new Set<string>()
  solved.forEach((s, c) => {
    for (const g of s.segments) if (g.origin === 'READ' && g.token) acceptedKeys.add(`${c}|${g.token.text}|${g.token.box.x0}|${g.token.box.y0}|${g.fromPx}|${g.toPx}`)
  })
  // 005E (M6): the value a span is given once a scale is chosen, its image score and its metric support recorded apart.
  // AS_READ when the reading fits (or nothing fits better); STRUCTURAL when its own hierarchy settled it; SCALE_RANKED,
  // the best-image lattice value that fits the chosen scale — DERIVED, never a witness; UNRESOLVED when two values of
  // different length fit within an image ratio of 0.9. Nothing here feeds back into the scale.
  const selectedValueOf = (x: Obs, scale: number | undefined): NonNullable<NonNullable<DimensionObservation['ocr']>['selected']> => {
    const lattice = x.lattice
    const rankOf = (text: string): number | undefined => {
      const i = lattice?.sequences.findIndex((q) => q.text === text) ?? -1
      return i >= 0 ? i : undefined
    }
    const asIs = (): NonNullable<NonNullable<DimensionObservation['ocr']>['selected']> => {
      const q = lattice?.sequences.find((v) => v.asRead)
      return { by: 'AS_READ', text: x.record.rawText, valueCm: round6(x.cm), ...(q ? { imageScore: q.imageScore, imageRank: rankOf(q.text) } : {}), ...(scale !== undefined ? { metricResidualPx: round6(Math.abs(x.cm / scale - x.px)) } : {}) }
    }
    if (x.refuted) {
      const q = lattice?.sequences.find((v) => v.valueCm === x.refuted?.chosenCm)
      return { by: 'STRUCTURAL', valueCm: round6(x.refuted.chosenCm), ...(q ? { text: q.text, imageScore: q.imageScore, imageRank: rankOf(q.text) } : {}), ...(scale !== undefined ? { metricResidualPx: round6(Math.abs(x.refuted.chosenCm / scale - x.px)) } : {}) }
    }
    if (!lattice || scale === undefined || (Math.abs(x.cm / scale - x.px) <= tol && x.ocrClass !== 'LOW_QUALITY')) return asIs()
    const fitting = lattice.sequences.filter((q) => q.valueCm !== undefined && Math.abs((q.valueCm as number) / scale - x.px) <= tol).sort((a, b) => b.imageScore - a.imageScore || (a.text < b.text ? -1 : 1))
    if (fitting.length === 0) return asIs()
    if (fitting.length >= 2 && fitting[1].valueCm !== fitting[0].valueCm && fitting[1].imageScore >= 0.9 * fitting[0].imageScore) return { by: 'UNRESOLVED', metricResidualPx: round6(Math.abs(x.cm / scale - x.px)) }
    const q = fitting[0]
    return { by: 'SCALE_RANKED', text: q.text, valueCm: q.valueCm, imageScore: q.imageScore, imageRank: rankOf(q.text), metricResidualPx: round6(Math.abs((q.valueCm as number) / scale - x.px)) }
  }
  const observations: DimensionObservation[] = [...obsBy.values()]
    .flat()
    .map((x) => {
      const choice = choices[x.chain]
      const decidedHere = choice.orientation === x.record.orientation
      const byScale = choice.joinedCm !== undefined && Math.abs(x.cm / choice.joinedCm - x.px) <= tol
      const independence: DimensionObservation['independence'] = !decidedHere ? 'ORIENTATION_UNDECIDED' : byScale ? 'ORIENTATION_BY_SCALE' : independenceOf(choice.decidedBy)
      const scale = finalScale(x.record.axis)
      const accepted = acceptedKeys.has(`${x.chain}|${x.entry.token.text}|${x.entry.token.box.x0}|${x.entry.token.box.y0}|${x.record.fromPx}|${x.record.toPx}`)
      const status: DimensionObservation['status'] = accepted && decidedHere ? 'ACCEPTED' : decidedHere && scale !== undefined && Math.abs(x.cm / scale - x.px) > tol ? 'REJECTED' : 'RAW'
      const ocr = x.record.ocr && decidedHere && x.record.binding?.role === 'PRIMARY' ? { ...x.record.ocr, ...(x.refuted ? { refutedBy: 'STRUCTURAL' as const } : {}), selected: selectedValueOf(x, scale) } : x.record.ocr
      return { ...x.record, independence, status, ...(ocr ? { ocr } : {}) }
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const dedupedObservations = observations.filter((o, i) => i === 0 || o.id !== observations[i - 1].id)
  const supporting = selected && relation !== 'LEGACY_UNCONFIRMED' && relation !== 'NO_SCALE' ? selected.witnessIds : [...legacyRegions.values()].map((w) => w.record.id)
  const final = relation === 'LEGACY_UNCONFIRMED' || relation === 'NO_SCALE' ? L : pooled
  const conflicting = final === undefined ? [] : bounded.filter((w) => w.record.independence === 'INDEPENDENT' && w.decisive && Math.abs(w.cm / ((finalScale(w.record.axis) ?? final) as number) - w.px) > tol).map((w) => w.record.id)
  // Isotropy is MEASURED only on the same test the ranking uses: substantial readings on both axes and a major one.
  const measuredBoth = relation === 'LEGACY_UNCONFIRMED' ? legacyStats.axesMeasured : (selected?.axesMeasured ?? false)
  const x = finalScale('X')
  const y = finalScale('Y')
  const relations = dimensionHierarchy(input.frameId, chains, chainIds, solved, observationsAsRead, labelHeight)

  // 005D: what the dimension graph looked like and how its labels were bound — the record a reviewer
  // reads to see which marks were doubted, which labels measured nothing, which inks were neutral, and
  // how far the selected scale's one deciding ink could move if one of its glyphs was misread (V4).
  const topologyOf = (): NonNullable<FrameMetricSolution['topology']> => {
    const marks = { tick: 0, questionable: 0, rejected: 0 }
    for (const chain of chains) for (const t of chain.ticks) marks[t.class === 'QUESTIONABLE' ? 'questionable' : t.class === 'REJECTED' ? 'rejected' : 'tick'] += 1
    const roles = { primary: 0, alternative: 0, ambiguous: 0, uncentred: 0 }
    for (const o of dedupedObservations) {
      const r = o.binding?.role
      if (r === 'PRIMARY') roles.primary += 1
      else if (r === 'ALTERNATIVE') roles.alternative += 1
      else if (r === 'AMBIGUOUS') roles.ambiguous += 1
      else if (r === 'UNCENTRED') roles.uncentred += 1
    }
    const single = selected && selectedMembers.length === 1 ? selectedMembers[0] : undefined
    const values = single ? [single.cm, ...single.alts] : []
    const implied = values.map((v) => v / (single?.px ?? 1))
    // The alternatives matter when they move the span by more than the pixel tolerance at the selected scale.
    const valueAmbiguity =
      single && selected && single.alts.length > 0 && (Math.max(...values) - Math.min(...values)) / selected.cmPerPixel > tol
        ? { observationId: single.record.id, rawText: single.record.rawText, alternatives: single.record.valueAlternatives?.map((a) => a.text) ?? [], cmPerPixelLow: round6(Math.min(...implied)), cmPerPixelHigh: round6(Math.max(...implied)) }
        : undefined
    const hierarchy = {
      totals: relations.filter((r) => r.kind === 'TOTAL_OF').length,
      agreesAsRead: relations.filter((r) => r.kind === 'TOTAL_OF' && r.check === 'AGREES_AS_READ').length,
      conflictsAsRead: relations.filter((r) => r.kind === 'CONFLICTS_WITH').length,
      incomplete: relations.filter((r) => r.kind === 'TOTAL_OF' && r.check === 'INCOMPLETE').length,
      afterCorrection: relations.filter((r) => r.kind === 'TOTAL_OF' && r.check === 'AGREES_AFTER_CORRECTION').length,
      parallelCopies: relations.filter((r) => r.kind === 'PARALLEL_COPY_OF').length,
      ...(undecidedConflict ? { undecidedConflict } : {}),
    }
    // 005E: the reading quality the decision stood on.
    const countedSel = selected ? countedOf(selected) : []
    const lowRegions = new Set(witnesses.filter((w) => w.ocrClass === 'LOW_QUALITY' && w.record.binding?.role === 'PRIMARY').map((w) => w.region))
    const ocr = input.lattices
      ? {
          counted: { clear: countedSel.filter((w) => w.ocrClass === 'CLEAR').length, supported: countedSel.filter((w) => w.ocrClass === 'SUPPORTED').length, ambiguous: countedSel.filter((w) => w.ocrClass === 'AMBIGUOUS').length, unrated: countedSel.filter((w) => w.ocrClass === undefined).length },
          lowQuality: lowRegions.size,
          contestedObservationIds: [...new Set([...neutral, ...rivalNeutral])].sort(),
          demotedObservationIds: demoted.map((w) => w.record.id).sort(),
        }
      : undefined
    return { marks, bindings: roles, neutralObservationIds: [...new Set([...neutral, ...rivalNeutral])].sort(), hierarchy, ...(valueAmbiguity ? { valueAmbiguity } : {}), ...(ocr ? { ocr } : {}), ...(falseConsensus ? { falseConsensus } : {}), ...(structural.length > 0 ? { structural } : {}) }
  }
  const solution: FrameMetricSolution = {
    frameId: input.frameId,
    assetId: input.assetId,
    relation,
    confidence,
    ...(x !== undefined ? { cmPerPixelX: round6(x) } : {}),
    ...(y !== undefined ? { cmPerPixelY: round6(y) } : {}),
    ...(x !== undefined && y !== undefined ? { anisotropy: round6(Math.max(x, y) / Math.min(x, y)) } : {}),
    isotropy: final === undefined ? 'NONE' : measuredBoth ? 'MEASURED' : 'ASSUMED',
    ...(selected ? { selectedHypothesisId: selected.id } : {}),
    hypotheses,
    legacy: {
      ...(L !== undefined ? { cmPerPixel: round6(L) } : {}),
      independentGroups: legacyStats.independentGroups,
      independentWeight: legacyStats.independentWeight,
      correctedAnchors: legacyAnchors.filter((g) => g.origin === 'CHAIN_CORRECTED').length,
      readAnchors: legacyAnchors.filter((g) => g.origin === 'READ').length,
    },
    independentWitnesses: relation === 'LEGACY_UNCONFIRMED' ? legacyStats.independentGroups : (selected?.independentGroups ?? 0),
    supportingObservationIds: [...supporting].sort(),
    conflictingObservationIds: [...new Set(conflicting)].sort(),
    orientationDecisions: decisions,
    rereadChainIds: reread.sort(),
    counts: { textRegions: regions.length, observations: dedupedObservations.length, hypotheses: hypotheses.length },
    topology: topologyOf(),
    why: whyOf(relation, confidence, selected, L, legacyStats.independentGroups, contest) + (undecidedConflict ? '; a total and the children it frames disagree as read, each stating one of the two scales, and no reading outside them decides' : '') + (undecidedRival ? '; every reading that states it fits the rival scale too within one character, so nothing decides between them' : '') + (falseConsensus ? `; false consensus: ${falseConsensus.why}` : ''),
  }
  const chainOrientation = chains.map((_, c) => ({ orientation: choices[c].orientation, dependsOnScale: choices[c].decidedBy === 'OTHER_AXIS_SCALE' }))

  return {
    solution,
    observations: dedupedObservations,
    relations,
    solved,
    tokensPerChain,
    ...(pooled !== undefined ? { pooledScale: round6(pooled) } : {}),
    ...(scaleX !== undefined ? { scaleX } : {}),
    ...(scaleY !== undefined ? { scaleY } : {}),
    chainOrientation,
  }
}

function whyOf(relation: FrameMetricSolution['relation'], confidence: MetricConfidence, selected: ScaleHypothesis | undefined, legacy: number | undefined, legacyIndependent: number, contest: number | undefined): string {
  const own = selected ? `${selected.cmPerPixel} cm/px, stated by ${selected.independentGroups} independent reading${selected.independentGroups === 1 ? '' : 's'} on ${selected.chains} chain(s)` : ''
  const rival = contest !== undefined ? `; a rival scale has ${Math.round(contest * 100)}% of its independent support` : ''
  switch (relation) {
    case 'CONFIRMED':
      return `the page vote's ${legacy} cm/px is confirmed by readings that owe nothing to it: ${own}${rival} (${confidence})`
    case 'REPLACED':
      return `the page vote's ${legacy} cm/px rested on ${legacyIndependent} independent reading${legacyIndependent === 1 ? '' : 's'}; ${own} outweigh${selected?.independentGroups === 1 ? 's' : ''} it${rival} (${confidence})`
    case 'LEGACY_UNCONFIRMED':
      return legacyIndependent === 0
        ? `the page vote's ${legacy} cm/px is kept, but no reading that owes nothing to it supports it: every value that agrees with it was fitted to it${selected ? `; ${own} does not outweigh it twice over` : ''}`
        : `the page vote's ${legacy} cm/px is kept on ${legacyIndependent} independent reading${legacyIndependent === 1 ? '' : 's'}${selected ? `; the strongest alternative, ${own}, does not outweigh it twice over` : ''} (${confidence})`
    case 'ADDED':
      return `the page vote found no scale; ${own} state one (${confidence})`
    default:
      return 'no scale is stated by any reading that owes nothing to a scale'
  }
}

// ---------------------------------------------------------------------------
// the chain graph: totals and nesting, from ticks alone
// ---------------------------------------------------------------------------

export function chainRelations(frameId: string, chains: readonly RawChain[], chainIds: readonly string[], solved: readonly SolvedChain[]): ChainRelation[] {
  const out: ChainRelation[] = []
  const valueOf = (s: SolvedChain | undefined): number | undefined => (s && s.segments.length > 0 && s.segments.every((g) => g.valueCm !== undefined) ? s.segments.reduce((a, g) => a + (g.valueCm ?? 0), 0) : undefined)
  for (let a = 0; a < chains.length; a += 1) {
    for (let b = 0; b < chains.length; b += 1) {
      if (a === b || chains[a].axis !== chains[b].axis) continue
      const A = chains[a].ticks
      const B = chains[b].ticks
      const [a0, a1, b0, b1] = [A[0].atPx, A[A.length - 1].atPx, B[0].atPx, B[B.length - 1].atPx]
      if (Math.abs(a0 - b0) <= 3 && Math.abs(a1 - b1) <= 3 && A.length === 2 && B.length > 2) {
        // A spans exactly what B divides: A is B's total.
        const total = valueOf(solved[a])
        const parts = valueOf(solved[b])
        out.push({
          kind: 'TOTAL_OF',
          frameId,
          fromChainId: chainIds[a],
          toChainId: chainIds[b],
          ...(total !== undefined && parts !== undefined ? { sum: { totalCm: round6(total), partsCm: round6(parts), residualCm: round6(total - parts), agrees: Math.abs(total - parts) <= Math.max(2, 0.01 * total) } } : {}),
        })
      } else if (a0 >= b0 - 3 && a1 <= b1 + 3 && a1 - a0 < b1 - b0 - 6) {
        out.push({ kind: 'NESTED_IN', frameId, fromChainId: chainIds[a], toChainId: chainIds[b] })
      }
    }
  }
  return out
    .sort((x, y) => (x.kind < y.kind ? -1 : x.kind > y.kind ? 1 : x.fromChainId < y.fromChainId ? -1 : x.fromChainId > y.fromChainId ? 1 : x.toChainId < y.toChainId ? -1 : x.toChainId > y.toChainId ? 1 : 0))
    .filter((r) => r.kind === 'TOTAL_OF')
    .concat(out.filter((r) => r.kind === 'NESTED_IN').slice(0, METRIC_BOUNDS.relations))
    .slice(0, METRIC_BOUNDS.relations)
}

// ---------------------------------------------------------------------------
// 005D: the dimension hierarchy, checked on values as read
// ---------------------------------------------------------------------------

/**
 * Lines that are one line drawn twice (005D I5): same axis, at most four label heights apart, the same
 * number of non-rejected marks, each within 2 px of its twin's. Each line maps to the first line of its group.
 */
function parallelCopiesOf(chains: readonly RawChain[], labelHeight: number): Map<number, number> {
  const gap = 4 * Math.max(1, labelHeight)
  const marksOf = (c: RawChain): number[] => c.ticks.filter((t) => t.class !== 'REJECTED').map((t) => t.atPx)
  const out = new Map<number, number>()
  for (let a = 0; a < chains.length; a += 1) {
    if (out.has(a)) continue
    const A = marksOf(chains[a])
    if (A.length < 2) continue
    for (let b = a + 1; b < chains.length; b += 1) {
      if (out.has(b) || chains[b].axis !== chains[a].axis || Math.abs(chains[b].baselinePx - chains[a].baselinePx) > gap) continue
      const B = marksOf(chains[b])
      if (B.length === A.length && A.every((m, i) => Math.abs(m - B[i]) <= 2)) out.set(b, a)
    }
  }
  return out
}

const medianLabelHeight = (labels: readonly TextToken[]): number => {
  const h = labels.filter((t) => t.glyphs.length >= 2).map((t) => t.height).sort((a, b) => a - b)
  return h.length > 0 ? h[Math.floor(h.length / 2)] : 14
}

/**
 * How the frame's chains stand to each other (BUILDPLAN-ANALYZER-005D, pre-review C §4.4).
 *
 * Only between parallel lines on the same side, at most four label heights apart (the families
 * measured on the development houses sit 1.4–2.7 heights apart; furniture lines 500 px away are
 * no family):
 *
 *   TOTAL_OF          a span between two consecutive marks of one line whose ends coincide with
 *                     marks k and l (l ≥ k + 2) of a finer line: a total over a run of its segments
 *                     (the whole line over a finer one, or one segment of a middle line over an
 *                     inner one, so a hierarchy of any depth is a chain of these); SEGMENT_OF is
 *                     recorded for each child run.
 *   PARALLEL_COPY_OF  the same marks drawn twice a few pixels apart: one statement, never two.
 *   NESTED_IN         inside another line's extent without coinciding ends.
 *   CONFLICTS_WITH    a total whose as-read value disagrees with its children's as-read sum.
 *
 * The check is made on values AS READ: the label each span's primary binding carries, in its
 * chain's decided orientation. AGREES_AS_READ and CONFLICT_AS_READ need every value read; a child
 * left unread makes it INCOMPLETE; a sum that closes only through the solved chain's corrected or
 * derived values is AGREES_AFTER_CORRECTION — recorded, never evidence. Rejected marks are no marks.
 */
export function dimensionHierarchy(
  frameId: string,
  chains: readonly RawChain[],
  chainIds: readonly string[],
  solved: readonly SolvedChain[],
  asRead: ReadonlyArray<{ chain: number; fromPx: number; toPx: number; cm: number }>,
  labelHeight: number,
): ChainRelation[] {
  const gap = 4 * Math.max(1, labelHeight)
  const marksOf = (c: RawChain): number[] => c.ticks.filter((t) => t.class !== 'REJECTED').map((t) => t.atPx)
  const near = (a: number, b: number, tol = 3): boolean => Math.abs(a - b) <= tol
  const valueOn = (chain: number, from: number, to: number): number | undefined => {
    const hits = asRead.filter((o) => o.chain === chain && near(o.fromPx, from) && near(o.toPx, to))
    const values = [...new Set(hits.map((h) => h.cm))]
    return values.length === 1 ? values[0] : undefined
  }
  const solvedValue = (chain: number, from: number, to: number): { cm?: number; corrected: boolean } => {
    const segs = (solved[chain]?.segments ?? []).filter((g) => g.fromPx >= from - 3 && g.toPx <= to + 3)
    if (segs.length === 0 || segs.some((g) => g.valueCm === undefined)) return { corrected: false }
    return { cm: segs.reduce((a, g) => a + (g.valueCm ?? 0), 0), corrected: segs.some((g) => g.origin !== 'READ') }
  }
  const out: ChainRelation[] = []
  for (let a = 0; a < chains.length; a += 1) {
    const A = marksOf(chains[a])
    if (A.length < 2) continue
    for (let b = 0; b < chains.length; b += 1) {
      if (a === b || chains[a].axis !== chains[b].axis) continue
      if (Math.abs(chains[a].baselinePx - chains[b].baselinePx) > gap) continue
      const B = marksOf(chains[b])
      if (B.length < 2) continue
      const [a0, a1, b0, b1] = [A[0], A[A.length - 1], B[0], B[B.length - 1]]
      if (A.length === B.length && A.every((m, i) => near(m, B[i], 2)) && a < b) {
        out.push({ kind: 'PARALLEL_COPY_OF', frameId, fromChainId: chainIds[a], toChainId: chainIds[b] })
        continue
      }
      // Each span of this line between two of its marks may be the total of a run of the other's
      // segments: the whole line over a finer one, or one segment of a middle line over an inner one —
      // and so may the span a label on it is bound to, across marks it skips (post-review A P1-3: one
      // extra crossing on a total line must not hide the total from the check).
      const spansOfA: Array<[number, number]> = A.slice(0, -1).map((m, i) => [m, A[i + 1]])
      for (const o of asRead) if (o.chain === a && !spansOfA.some(([x, y]) => near(x, o.fromPx) && near(y, o.toPx))) spansOfA.push([o.fromPx, o.toPx])
      let totals = 0
      for (const [s0, s1] of spansOfA) {
        const k = B.findIndex((m) => near(m, s0))
        const l = B.findIndex((m) => near(m, s1))
        if (k < 0 || l < k + 2) continue
        totals += 1
        const children = B.slice(k, l + 1)
        const total = valueOn(a, s0, s1)
        const parts = children.slice(0, -1).map((m, j) => valueOn(b, m, children[j + 1]))
        const allRead = total !== undefined && parts.every((p) => p !== undefined)
        const partsCm = allRead ? parts.reduce((x: number, p) => x + (p ?? 0), 0) : undefined
        const agrees = (t: number, p: number): boolean => Math.abs(t - p) <= Math.max(2, 0.01 * t)
        let check: NonNullable<ChainRelation['check']>
        let sum: ChainRelation['sum']
        if (allRead && total !== undefined && partsCm !== undefined) {
          check = agrees(total, partsCm) ? 'AGREES_AS_READ' : 'CONFLICT_AS_READ'
          sum = { totalCm: round6(total), partsCm: round6(partsCm), residualCm: round6(total - partsCm), agrees: check === 'AGREES_AS_READ' }
        } else {
          const st = solvedValue(a, s0, s1)
          const sp = solvedValue(b, children[0], children[children.length - 1])
          check = st.cm !== undefined && sp.cm !== undefined && agrees(st.cm, sp.cm) && (st.corrected || sp.corrected) ? 'AGREES_AFTER_CORRECTION' : 'INCOMPLETE'
          if (st.cm !== undefined && sp.cm !== undefined) sum = { totalCm: round6(st.cm), partsCm: round6(sp.cm), residualCm: round6(st.cm - sp.cm), agrees: agrees(st.cm, sp.cm) }
        }
        const span = k > 0 || l < B.length - 1 ? { fromPx: round6(children[0]), toPx: round6(children[children.length - 1]) } : undefined
        out.push({ kind: 'TOTAL_OF', frameId, fromChainId: chainIds[a], toChainId: chainIds[b], ...(sum ? { sum } : {}), ...(span ? { span } : {}), check })
        out.push({ kind: 'SEGMENT_OF', frameId, fromChainId: chainIds[b], toChainId: chainIds[a], ...(span ? { span } : {}), check })
        if (check === 'CONFLICT_AS_READ') out.push({ kind: 'CONFLICTS_WITH', frameId, fromChainId: chainIds[a], toChainId: chainIds[b], ...(sum ? { sum } : {}), check })
      }
      if (totals === 0 && a0 >= b0 - 3 && a1 <= b1 + 3 && a1 - a0 < b1 - b0 - 6) {
        out.push({ kind: 'NESTED_IN', frameId, fromChainId: chainIds[a], toChainId: chainIds[b] })
      }
    }
  }
  const order = (r: ChainRelation): string => `${r.kind}|${r.fromChainId}|${r.toChainId}|${r.span?.fromPx ?? ''}`
  const first = out.filter((r) => r.kind !== 'NESTED_IN').sort((x, y) => (order(x) < order(y) ? -1 : order(x) > order(y) ? 1 : 0))
  const nested = out.filter((r) => r.kind === 'NESTED_IN').sort((x, y) => (order(x) < order(y) ? -1 : order(x) > order(y) ? 1 : 0))
  return [...first, ...nested].slice(0, METRIC_BOUNDS.relations)
}

/**
 * 005E (M5, pre-review D C4): the totals refuted as read by their own children, settled by the inks' lattices when
 * exactly one assignment closes the sum. Scale-free: values and the hierarchy's agreement tolerance only. The total and
 * its children must be distinct inks (no ink twice, no twin copy — `bounded` holds one reading per ink and span); the
 * children must be read SUPPORTED or better; at most two glyph choices away from what was read, the cheapest
 * agreeing assignment must be unique. Its replaced as-read values are marked refuted (they stop witnessing); its
 * chosen values are recorded, never counted.
 */
function structuralSupport(frameId: string, chains: readonly RawChain[], chainIds: readonly string[], bounded: Obs[], labelHeight: number): NonNullable<NonNullable<FrameMetricSolution['topology']>['structural']> {
  const asRead = bounded.filter((w) => w.decisive && w.record.binding?.role === 'PRIMARY' && w.record.independence !== 'ORIENTATION_UNDECIDED' && !w.record.leadingZero)
  const relations = dimensionHierarchy(frameId, chains, chainIds, [], asRead.map((w) => ({ chain: w.chain, fromPx: w.record.fromPx, toPx: w.record.toPx, cm: w.cm })), labelHeight).filter((r) => r.kind === 'TOTAL_OF' && r.check === 'CONFLICT_AS_READ')
  const out: NonNullable<NonNullable<FrameMetricSolution['topology']>['structural']> = []
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 3
  const agrees = (t: number, p: number): boolean => Math.abs(t - p) <= Math.max(2, 0.01 * t)
  for (const r of relations) {
    const a = chainIds.indexOf(r.fromChainId)
    const b = chainIds.indexOf(r.toChainId)
    if (a < 0 || b < 0) continue
    const marks = chains[b].ticks.filter((t) => t.class !== 'REJECTED').map((t) => t.atPx)
    const from = r.span?.fromPx ?? marks[0]
    const to = r.span?.toPx ?? marks[marks.length - 1]
    const total = asRead.find((w) => w.chain === a && near(w.record.fromPx, from) && near(w.record.toPx, to))
    const inside = marks.filter((m) => m >= from - 3 && m <= to + 3)
    const parts = inside.slice(0, -1).map((m, j) => asRead.find((w) => w.chain === b && near(w.record.fromPx, m) && near(w.record.toPx, inside[j + 1])))
    if (!total || parts.length < 2 || parts.some((p) => p === undefined)) continue
    const items = [total, ...(parts as Obs[])]
    if (new Set(items.map((w) => w.region)).size !== items.length) continue
    if ((parts as Obs[]).some((p) => p.ocrClass === 'AMBIGUOUS') || items.length > 9) continue
    const options = items.map((w) => [{ cm: w.cm, cost: 0 }, ...[...w.altCost].map(([cm, cost]) => ({ cm, cost }))])
    const value = (choice: number[]): { t: number; p: number } => ({ t: options[0][choice[0]].cm, p: choice.slice(1).reduce((x, c, i) => x + options[i + 1][c].cm, 0) })
    const found: Array<{ choice: number[]; cost: number }> = []
    const zero = items.map(() => 0)
    // At most two inks away from what was read, each by one of its own lattice values.
    for (let i = 0; i < items.length; i += 1) {
      for (let x = 1; x < options[i].length; x += 1) {
        const c1 = [...zero]
        c1[i] = x
        if (options[i][x].cost <= 2) {
          const v = value(c1)
          if (agrees(v.t, v.p)) found.push({ choice: c1, cost: options[i][x].cost })
        }
        for (let j = i + 1; j < items.length; j += 1) {
          for (let y = 1; y < options[j].length; y += 1) {
            const cost = options[i][x].cost + options[j][y].cost
            if (cost > 2) continue
            const c2 = [...c1]
            c2[j] = y
            const v = value(c2)
            if (agrees(v.t, v.p)) found.push({ choice: c2, cost })
          }
        }
      }
    }
    if (found.length === 0) continue
    const least = Math.min(...found.map((f) => f.cost))
    const cheapest = found.filter((f) => f.cost === least)
    if (cheapest.length !== 1) continue
    const choice = cheapest[0].choice
    const refuted: string[] = []
    items.forEach((w, i) => {
      if (choice[i] === 0) return
      w.refuted = { chosenCm: options[i][choice[i]].cm }
      w.decisive = false
      refuted.push(w.record.id)
    })
    out.push({ totalChainId: r.fromChainId, partChainId: r.toChainId, assignment: items.map((w, i) => ({ observationId: w.record.id, asReadCm: round6(w.cm), chosenCm: round6(options[i][choice[i]].cm) })), refutedObservationIds: refuted.sort() })
  }
  return out
}
