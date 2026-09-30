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
import type { ChainRelation, DimensionObservation, FrameMetricSolution, MetricConfidence, OrientationDecision, ScaleHypothesis } from './schema.js'

export const METRIC_SOLVER_NAME = 'metrics.independent-scale' as const
export const METRIC_SOLVER_VERSION = '1.0.0' as const

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
  /** Long enough to state a scale to 4 %: only these count as witnesses. */
  decisive: boolean
}

/** A cm dimension is printed without a leading zero; `0,45` (metres) and a lone `0` are not that. */
export const hasLeadingZero = (text: string): boolean => /^0\d/.test(text)

function observationsOf(input: FrameMetricInput, orientation: TextOrientation, assigned: readonly ChainToken[][], regionOf: Map<TextToken, Region>): Obs[] {
  const minLength = input.minPixelLength ?? 6
  const out: Obs[] = []
  input.chains.forEach((chain, c) => {
    if (chain.axis !== textAxisOf(orientation)) return
    const entries = assigned[c] ?? []
    entries.forEach((entry, idx) => {
      const region = regionOf.get(entry.token)
      if (!region) return
      // As read: the lattice's own first reading, with no substitution in it.
      const reads = entry.readings.filter((r) => r.substitutions === 0)
      // A detected tick is a detection: a spurious one splits the span a label measures, so a
      // reading may bind across up to two of them, centred on its label and discounted for each.
      for (const [from, to] of spansFor(chain, entries, idx, minLength, METRIC_BOUNDS.skippedTicks)) {
        const px = round6(chain.ticks[to].atPx - chain.ticks[from].atPx)
        const skipped = to - from - 1
        for (const read of reads) {
          const cm = read.valueCm
          if (!(cm > 0) || !(px > 0)) continue
          const record: DimensionObservation = {
            id: stableId('dim-obs', `${entry.token.text.replace(/[^0-9]/g, '') || 'x'}-${orientation.toLowerCase()}`, { chain: input.chainIds[c], orientation, box: entry.token.box, from, to, text: read.text }),
            frameId: input.frameId,
            chainId: input.chainIds[c],
            textRegionId: region.id,
            orientation,
            rawText: entry.token.text,
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
          }
          // Weight rises with the span, as in the legacy vote: the ticks are located to a pixel whatever the span.
          out.push({ record, chain: c, entry, region: region.id, weight: round6(((entry.token.confidence * px) / 50) * 0.7 ** skipped), cm, px, decisive: px >= DECISIVE_SPAN_TOLERANCES * input.tolerancePx && entry.token.height >= LEGIBLE_CAP_HEIGHT_PX && !record.leadingZero })
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
function shareEvidence(members: readonly Obs[], share: (o: Obs) => number): Pick<ScaleHypothesis, 'longestShare' | 'substantialWitnesses' | 'majorWitnesses' | 'corroborated' | 'axesMeasured'> {
  const substantial = members.filter((m) => share(m) >= WITNESS_SHARE.substantial)
  const major = members.filter((m) => share(m) >= WITNESS_SHARE.major)
  const corroborated = major.some((a) => substantial.some((b) => b.region !== a.region && b.chain !== a.chain))
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
  const { regions, regionOf } = textRegions(input.frameId, input.raw)
  const labels = dimensionLabels(chains, input.raw, input.maxOffsetHeights ?? 2.2)
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
  witnesses.sort((a, b) => b.weight - a.weight || (a.record.id < b.record.id ? -1 : 1))
  const bounded = witnesses.slice(0, METRIC_BOUNDS.observations)

  // --- 5. the scales the witnesses support -------------------------------------
  const longestOn = (axis: 'HORIZONTAL' | 'VERTICAL'): number => Math.max(1, ...chains.filter((c) => c.axis === axis).map((c) => c.ticks[c.ticks.length - 1].atPx - c.ticks[0].atPx))
  const shareOf = (m: Obs): number => m.px / longestOn(m.record.axis === 'X' ? 'HORIZONTAL' : 'VERTICAL')
  const describe = (cl: Cluster): ScaleHypothesis => {
    const independent = cl.members.filter((m) => m.record.independence === 'INDEPENDENT' && m.decisive)
    const axes = [...new Set(independent.map((m) => m.record.axis))].sort() as Array<'X' | 'Y'>
    const residual = cl.members.length === 0 ? 0 : Math.sqrt(cl.members.reduce((a, m) => a + (m.cm / cl.cm - m.px) ** 2, 0) / cl.members.length)
    return {
      id: stableId('scale', `${cl.cm}`.replace('.', '-'), { frameId: input.frameId, cm: cl.cm }),
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
  const candidates = hypotheses.filter((h) => h.plausible && h.independentGroups >= 1).sort((a, b) => compareEvidence(a, b) || a.cmPerPixel - b.cmPerPixel)
  const selected = candidates[0]
  const rival = selected ? candidates.find((h) => h !== selected && Math.abs(Math.log(h.cmPerPixel / selected.cmPerPixel)) >= DISTINCT_RATIO) : undefined
  const contest = selected && rival && selected.independentWeight > 0 ? round6(rival.independentWeight / selected.independentWeight) : undefined

  // --- 6. what that makes of the legacy vote's scale -------------------------
  const L = legacy.pooledScale
  const legacyAxis = (axis: 'X' | 'Y'): number | undefined => (axis === 'X' ? legacy.scaleX : legacy.scaleY) ?? L
  const legacySupport = bounded.filter((w) => w.record.independence === 'INDEPENDENT' && w.decisive && legacyAxis(w.record.axis) !== undefined && Math.abs(w.cm / (legacyAxis(w.record.axis) as number) - w.px) <= tol)
  const legacyRegions = new Map<string, Obs>()
  for (const w of legacySupport) if (!legacyRegions.has(w.region)) legacyRegions.set(w.region, w)
  const legacyStats = {
    independentGroups: legacyRegions.size,
    independentWeight: round6([...legacyRegions.values()].reduce((a, w) => a + w.weight, 0)),
    chains: new Set([...legacyRegions.values()].map((w) => w.chain)).size,
    independentAxes: [...new Set([...legacyRegions.values()].map((w) => w.record.axis))].sort() as Array<'X' | 'Y'>,
    ...shareEvidence([...legacyRegions.values()], shareOf),
  }
  const legacyAnchors = legacy.solved.flatMap((s) => s.segments).filter((g) => g.origin === 'READ' || g.origin === 'CHAIN_CORRECTED')
  const agreeTol = (h: ScaleHypothesis): number => {
    const longest = Math.max(1, ...bounded.filter((w) => h.witnessIds.includes(w.record.id) && w.record.independence === 'INDEPENDENT' && w.decisive).map((w) => w.px))
    return Math.max(0.012, tol / longest)
  }
  let relation: FrameMetricSolution['relation']
  let confidence: MetricConfidence
  const own = selected ? confidenceOf(selected, rival) : 'INCONCLUSIVE'
  // Replacing the page vote's scale needs more than disagreeing with it: the vote had no
  // independent reading at all and this one has an overall reading or two that agree, or it is
  // beaten outright on axes, agreement and count by readings that are at least SUPPORTED.
  const legacyEvidence: Evidence = { ...legacyStats }
  const beatsLegacy = (h: ScaleHypothesis): boolean => {
    const [a, b] = [evidenceTuple(h), evidenceTuple(legacyEvidence)]
    const outright = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[3] > b[3])))
    return legacyStats.independentGroups === 0 ? RANK[own] >= RANK.SUPPORTED || (own === 'WEAK' && h.longestShare >= WITNESS_SHARE.overall) : outright && RANK[own] >= RANK.SUPPORTED
  }
  if (selected && L !== undefined && Math.abs(Math.log(selected.cmPerPixel / L)) <= agreeTol(selected)) {
    relation = 'CONFIRMED'
    confidence = own
  } else if (selected && L !== undefined && beatsLegacy(selected)) {
    relation = 'REPLACED'
    confidence = own
  } else if (L !== undefined) {
    relation = 'LEGACY_UNCONFIRMED'
    confidence = legacyStats.independentGroups === 0 ? 'INCONCLUSIVE' : confidenceOf(legacyEvidence, selected)
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
  const perChain = assignTokens(chains, corrected, { maxOffsetHeights: input.maxOffsetHeights, preferCentred: true })
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
    const s = axisScale === undefined ? solveChain(chain, [], { tolerancePx: tol, minPixelLength: minLength }) : solveChain(chain, mine, { tolerancePx: tol, minPixelLength: minLength, fixedScale: axisScale })
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
      return { ...x.record, independence, status }
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
    why: whyOf(relation, confidence, selected, L, legacyStats.independentGroups, contest),
  }
  const chainOrientation = chains.map((_, c) => ({ orientation: choices[c].orientation, dependsOnScale: choices[c].decidedBy === 'OTHER_AXIS_SCALE' }))
  return {
    solution,
    observations: dedupedObservations,
    relations: chainRelations(input.frameId, chains, chainIds, solved),
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
