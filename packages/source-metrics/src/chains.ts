/**
 * Dimension chains, and the arithmetic that reads them.
 *
 * A dimension chain is the most information-dense thing on a drawing and the
 * only place where a reader can CHECK ITSELF. Three facts hold at once for a
 * chain of n segments:
 *
 *   1. every segment has a printed value,
 *   2. every segment has a pixel length,
 *   3. all the segments share one scale.
 *
 * Any two of those give the third. That redundancy is worth more than a better
 * classifier: a thirteen-pixel `7` and a thirteen-pixel `1` are genuinely hard
 * to tell apart, but `790` and `140` on a segment 79 px long, next to a segment
 * of 118 px printed `1185`, are not hard to tell apart at all — one of them
 * implies a scale ten times the other's. So the reader hands this layer its
 * runners-up, and this layer chooses among them by asking which combination
 * makes the chain a chain.
 *
 * What it must never do — and does not do — is INVENT a value to make a chain
 * close. A segment whose number could not be read gets a derived value marked
 * `DERIVED`, with its residual attached, and a chain that does not sum is
 * reported as a chain that does not sum.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelPoint } from '@buildapp/source-common'
import type { SourceObservation } from '@buildapp/source-observations'
import type { DimensionLine, DimensionMarkClass, DimensionMarkReason } from './dimension-lines.js'
import type { TextToken } from './ocr.js'
import { assignLabels } from './axis-topology.js'
import type { LabelAssignmentDecision, SideConventions } from './axis-topology.js'
import type { ParsedNumber } from './parse.js'

/**
 * A witness line reduced to the one number that matters: where it crosses the chain's axis. 005D:
 * and what the mark there is, when the line was read against its own ink (absent: a tick).
 */
export type ChainTick = { atPx: number; baselinePx: number; observationId: string; class?: DimensionMarkClass; reasons?: DimensionMarkReason[] }

export type ChainAxis = 'HORIZONTAL' | 'VERTICAL'

/** A chain before any number has been read: ticks on a baseline, and nothing else. */
export type RawChain = {
  axis: ChainAxis
  baselinePx: number
  ticks: ChainTick[]
  /** The observations in the sealed graph that lie on this chain, for traceability. */
  observationIds: string[]
}

/**
 * Chains from the dimension lines found in the source bytes.
 *
 * This is the route the extractor actually takes. A chain's ticks come from
 * the line that carries them, because a tick is defined BY the line it crosses
 * — which is a fact about the drawing that no amount of clustering parallel
 * segments recovers.
 */
export function chainsFromLines(lines: readonly DimensionLine[], observations: readonly SourceObservation[] = []): RawChain[] {
  return lines
    .filter((l) => l.ticksPx.length >= 2)
    .map((line) => ({
      axis: line.axis,
      baselinePx: line.baselinePx,
      ticks: line.ticksPx.map((atPx, i) => ({ atPx, baselinePx: line.baselinePx, observationId: '', ...(line.marks?.[i] ? { class: line.marks[i].class, reasons: [...line.marks[i].reasons] } : {}) })),
      observationIds: observations
        .filter((o) => observationTouchesLine(o, line))
        .map((o) => o.id)
        .sort(),
    }))
}

/** Whether a sealed observation lies on this dimension line: the chain's own provenance, not a source of geometry. */
function observationTouchesLine(o: SourceObservation, line: DimensionLine): boolean {
  const points: PixelPoint[] = []
  const g = o.pixelGeometry
  if (g.type === 'POINT') points.push(g.point)
  else if (g.type === 'SEGMENT') points.push(g.a, g.b)
  else if (g.type === 'POLYLINE' || g.type === 'POLYGON') points.push(...g.points)
  else if (g.type === 'RECT') points.push({ x: g.rect.x0, y: g.rect.y0 }, { x: g.rect.x1, y: g.rect.y1 })
  else for (const l of g.lines) points.push(l.a, l.b)
  return points.some((p) => {
    const across = line.axis === 'HORIZONTAL' ? p.y : p.x
    const along = line.axis === 'HORIZONTAL' ? p.x : p.y
    return Math.abs(across - line.baselinePx) <= 3 && along >= line.fromPx - 2 && along <= line.toPx + 2
  })
}

const mid = (a: PixelPoint, b: PixelPoint): PixelPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * Recover the chains from the witness lines a CV pass found.
 *
 * The lines arrive as an unordered family. A chain is the subset of them that
 * are perpendicular to a common direction and sit on a common baseline: a row
 * of short vertical ticks at one height is a horizontal chain, a column of
 * short horizontal ticks at one abscissa is a vertical chain. Grouping by
 * baseline rather than by proximity is what keeps two chains stacked one above
 * the other — which every plan has — from merging into one.
 */
export function chainsFromObservations(observations: readonly SourceObservation[], options: { baselineTolerancePx?: number; minTicks?: number } = {}): RawChain[] {
  const tol = options.baselineTolerancePx ?? 6
  const minTicks = options.minTicks ?? 3
  const ticks: Array<{ axis: ChainAxis; atPx: number; baselinePx: number; observationId: string }> = []
  for (const o of observations) {
    if (o.pixelGeometry.type !== 'LINE_FAMILY') continue
    if (!o.semanticHints.includes('dimension-chain')) continue
    for (const line of o.pixelGeometry.lines) {
      const dx = Math.abs(line.b.x - line.a.x)
      const dy = Math.abs(line.b.y - line.a.y)
      const centre = mid(line.a, line.b)
      // A tick perpendicular to the chain: a tall thin mark belongs to a
      // horizontal chain, a wide flat one to a vertical chain.
      if (dy > dx * 1.5) ticks.push({ axis: 'HORIZONTAL', atPx: centre.x, baselinePx: centre.y, observationId: o.id })
      else if (dx > dy * 1.5) ticks.push({ axis: 'VERTICAL', atPx: centre.y, baselinePx: centre.x, observationId: o.id })
    }
  }

  const chains: RawChain[] = []
  for (const axis of ['HORIZONTAL', 'VERTICAL'] as const) {
    const mine = ticks.filter((t) => t.axis === axis).sort((a, b) => a.baselinePx - b.baselinePx || a.atPx - b.atPx)
    let group: typeof mine = []
    const flush = (): void => {
      if (group.length >= minTicks) {
        const sorted = [...group].sort((a, b) => a.atPx - b.atPx)
        // Ticks closer together than a tick is long are the same tick found twice.
        const merged: ChainTick[] = []
        for (const t of sorted) {
          const last = merged[merged.length - 1]
          if (last && Math.abs(t.atPx - last.atPx) < 2) continue
          merged.push({ atPx: round6(t.atPx), baselinePx: round6(t.baselinePx), observationId: t.observationId })
        }
        if (merged.length >= minTicks) {
          chains.push({
            axis,
            baselinePx: round6(group.reduce((a, t) => a + t.baselinePx, 0) / group.length),
            ticks: merged,
            observationIds: [...new Set(group.map((t) => t.observationId))].sort(),
          })
        }
      }
      group = []
    }
    for (const t of mine) {
      if (group.length > 0 && Math.abs(t.baselinePx - group[group.length - 1].baselinePx) > tol) flush()
      group.push(t)
    }
    flush()
  }
  return chains
}

// ---------------------------------------------------------------------------
// attaching numbers to segments
// ---------------------------------------------------------------------------

/** A number found on a chain, with every value it might be. */
export type ChainToken = {
  token: TextToken
  /** Where the text sits along the chain's axis, in the frame's pixels. */
  atPx: number
  /** How far the text sits from the line, in multiples of its own height. */
  offset: number
  readings: Array<{ text: string; parsed: ParsedNumber; valueCm: number; confidence: number; substitutions: number }>
}

/**
 * The numbers printed ON a chain.
 *
 * The test is deliberately strict, because a number that is merely NEAR a
 * chain is not on it: the text must lie along the chain's own span and within
 * a couple of its own heights of the line, which is where a draughtsman puts
 * it and nowhere else. Text set along a vertical chain is turned a quarter
 * turn, so a chain only looks at the tokens read in an orientation that
 * matches it — a horizontal number lying across a vertical chain belongs to
 * something else entirely.
 */
export function chainTokens(chain: RawChain, tokens: readonly TextToken[], options: { maxOffsetHeights?: number } = {}): ChainToken[] {
  return assignTokens([chain], tokens, options)[0]
}

/**
 * Give every number to ONE chain (BUILDPLAN-ANALYZER-005I: globally, `assignLabels`).
 *
 * Plans stack their chains — an overall dimension above a run of parts above
 * the building — a couple of text heights apart, so a band wide enough to
 * catch a chain's own numbers is also wide enough to catch its neighbour's.
 * Letting both chains claim a number is worse than useless: the solver sees
 * two numbers on one span, concludes that no partition explains the chain, and
 * throws away the two best-measured dimensions on the sheet.
 *
 * Until 005I the numbers were handed out one at a time, nearest first, each
 * claiming its interval: a label half a pixel nearer the wrong line took that
 * line's only interval and left the line's own number with nothing. Now every
 * number is given every line it could be on, with the side of the label the
 * line lies on and its distance in the label's own heights, and the numbers of
 * a neighbourhood are assigned together, exactly; a number an equally good
 * assignment would put elsewhere is left unassigned (`axis-topology.ts`).
 */
export function assignTokens(chains: readonly RawChain[], tokens: readonly TextToken[], options: { maxOffsetHeights?: number; preferCentred?: boolean; readingsOf?: (token: TextToken) => ChainToken['readings'] | undefined } = {}): ChainToken[][] {
  return assignLabels(chains, tokens, options).perChain
}

// ---------------------------------------------------------------------------
// solving
// ---------------------------------------------------------------------------

export type SolvedSegment = {
  index: number
  fromPx: number
  toPx: number
  pixelLength: number
  /** Which tick each end is: a segment that spans several ticks skipped the ones between. */
  fromTick: number
  toTick: number
  valueCm?: number
  /** The reading chosen, when one was. */
  text?: string
  token?: TextToken
  /** Readings that were rejected, and why — the record of what the arithmetic decided. */
  rejected: Array<{ text: string; valueCm: number; why: string }>
  origin: 'READ' | 'CHAIN_CORRECTED' | 'DERIVED' | 'UNRESOLVED'
  confidence: number
  /** How far the reading misses what the pixels say, in pixels and in centimetres. */
  residualPx?: number
  residualCm?: number
}

export type SolvedChain = {
  segments: SolvedSegment[]
  /** Centimetres per pixel this chain was solved at. */
  cmPerPixel?: number
  /** Root-mean-square miss of the fitted segments, in pixels. */
  residualPx: number
  readSegments: number
  derivedTotalCm?: number
  /** Ticks the chain's own arithmetic decided were not measurement points after all. */
  skippedTicks: number[]
  /** The scale hypotheses that were considered, best first. Kept so the decision can be audited. */
  scaleVotes: ScaleVote[]
}

/** One scale hypothesis and the support it attracted. */
export type ScaleVote = { cmPerPixel: number; support: number; weight: number; chains: number }

/** One (number, span) pairing, and the scale it would imply. */
export type ScaleProposal = { chain: number; tokenIndex: number; fromTick: number; toTick: number; cmPerPixel: number; pixelLength: number; weight: number; valueCm: number; text: string; confidence: number; substitutions: number }

/**
 * Every span a number could be measuring, and the scale each would imply.
 *
 * A number is NOT assumed to measure the gap between the two ticks either side
 * of it. Tick detection is a detection, so it has false positives, and a
 * single spurious mark in the middle of a 510-centimetre span would otherwise
 * turn a perfectly legible dimension into two segments that nothing explains.
 * So every tick pair that contains this number and no other is a candidate
 * span, and the arithmetic decides which one the draughtsman meant.
 */
function proposalsOf(chainIndex: number, chain: RawChain, tokens: readonly ChainToken[], minLength: number, maxSkip = 0): ScaleProposal[] {
  const out: ScaleProposal[] = []
  tokens.forEach((entry, tokenIndex) => {
    for (const [from, to] of spansFor(chain, tokens, tokenIndex, minLength, maxSkip)) {
      const pixelLength = round6(chain.ticks[to].atPx - chain.ticks[from].atPx)
      for (const reading of entry.readings) {
        out.push({
          chain: chainIndex,
          tokenIndex,
          fromTick: from,
          toTick: to,
          cmPerPixel: round6(reading.valueCm / pixelLength),
          pixelLength,
          // Weight rises with the span's LENGTH, and linearly. The tick marks
          // either end are located to about a pixel whatever the span is, so a
          // 480-pixel span states the scale roughly fifty times as precisely
          // as a 10-pixel one — and a cluster of short junk readings that
          // happen to agree with each other is exactly the thing that must not
          // be allowed to outvote it.
          weight: round6((reading.confidence * entry.token.confidence * pixelLength) / 50),
          valueCm: reading.valueCm,
          text: reading.text,
          confidence: reading.confidence,
          substitutions: reading.substitutions,
        })
      }
    }
  })
  return out
}

/**
 * The tick pairs that could be what one number measures.
 *
 * `maxSkip` is how many intervening ticks a span may swallow, and it is the
 * difference between the two uses this function has. A SCALE VOTE takes zero:
 * with the scale unknown, allowing a number to choose its own span makes the
 * vote degenerate, because almost any scale can be made to look well supported
 * if every number is free to pick the span that agrees with the others.
 * Cutting the chain, once the scale IS known, takes a few: that is where a
 * spurious tick in the middle of a legible 510 has to be forgiven.
 *
 * Either way a span must be CENTRED on its number. A draughtsman writes the
 * dimension in the middle of what it measures, so a number sitting against one
 * end of a span is not measuring that span, whatever the arithmetic says.
 */
export function spansFor(chain: RawChain, tokens: readonly ChainToken[], tokenIndex: number, minLength: number, maxSkip: number): Array<[number, number]> {
  const at = tokens[tokenIndex].atPx
  const before = tokens[tokenIndex - 1]?.atPx ?? -Infinity
  const after = tokens[tokenIndex + 1]?.atPx ?? Infinity
  const spans: Array<[number, number]> = []
  for (let from = 0; from < chain.ticks.length; from += 1) {
    if (chain.ticks[from].atPx > at) break
    if (chain.ticks[from].atPx < before) continue
    for (let to = from + 1; to < chain.ticks.length; to += 1) {
      if (to - from - 1 > maxSkip) break
      if (chain.ticks[to].atPx < at) continue
      if (chain.ticks[to].atPx > after) break
      const length = chain.ticks[to].atPx - chain.ticks[from].atPx
      if (length < minLength) continue
      const centre = (chain.ticks[from].atPx + chain.ticks[to].atPx) / 2
      if (Math.abs(at - centre) > length * 0.3) continue
      spans.push([from, to])
    }
  }
  return spans
}

/** The proposals a scale explains to within the tolerance, the best-fitting one per number. */
function gatherAround(proposals: readonly ScaleProposal[], centre: number, tolerancePx: number): ScaleProposal[] {
  const byToken = new Map<string, { p: ScaleProposal; merit: number }>()
  for (const p of proposals) {
    const missPx = Math.abs(p.valueCm / centre - p.pixelLength)
    if (missPx > tolerancePx) continue
    const merit = p.weight * Math.max(0.02, 1 - missPx / tolerancePx)
    const key = `${p.chain}:${p.tokenIndex}`
    const held = byToken.get(key)
    if (!held || merit > held.merit) byToken.set(key, { p, merit })
  }
  return [...byToken.values()].map((v) => v.p)
}

/** The support one scale attracts: how many numbers, from how many chains, at what weight. */
function supportFor(proposals: readonly ScaleProposal[], cmPerPixel: number, tolerancePx: number): ScaleVote {
  const members = gatherAround(proposals, cmPerPixel, tolerancePx)
  const chains = new Set(members.map((m) => m.chain)).size
  // Corroboration across CHAINS is worth more than repetition inside one:
  // two chains that agree are two independent statements of the same scale.
  const weight = round6(members.reduce((a, p) => a + p.weight, 0) * (1 + 0.5 * (chains - 1)))
  return { cmPerPixel, support: members.length, weight, chains }
}

/** A seed scale moved to the weighted least-squares centre of its own inliers, three times at most. */
function refineScale(proposals: readonly ScaleProposal[], seed: number, tolerancePx: number): number {
  let centre = seed
  for (let round = 0; round < 3; round += 1) {
    let num = 0
    let den = 0
    for (const p of gatherAround(proposals, centre, tolerancePx)) {
      num += p.weight * p.valueCm * p.pixelLength
      den += p.weight * p.pixelLength * p.pixelLength
    }
    if (den <= 0) break
    const next = num / den
    if (Math.abs(next - centre) < 1e-9) break
    centre = next
  }
  return centre
}

/**
 * Every DISTINCT scale the proposals support, strongest first.
 *
 * The vote keeps its winner; this keeps the field. Two seeds within a few per
 * cent of each other are one hypothesis arrived at twice, so the field is
 * thinned by ratio before it is refined — otherwise a well-supported scale
 * shows up eight times and pushes the runner-up off the end of the list, which
 * is exactly the case where the runner-up matters.
 */
export function scaleCandidates(proposals: readonly ScaleProposal[], tolerancePx: number, options: { distinctRatio?: number } = {}): ScaleVote[] {
  const distinct = options.distinctRatio ?? 0.03
  const seeds = proposals.map((p) => supportFor(proposals, p.cmPerPixel, tolerancePx))
  seeds.sort((a, b) => b.weight - a.weight || b.support - a.support || a.cmPerPixel - b.cmPerPixel)
  const kept: ScaleVote[] = []
  for (const seed of seeds) {
    if (kept.some((k) => Math.abs(Math.log(seed.cmPerPixel / k.cmPerPixel)) < distinct)) continue
    kept.push(seed)
  }
  const refined = kept.map((k) => {
    const centre = refineScale(proposals, k.cmPerPixel, tolerancePx)
    const support = supportFor(proposals, centre, tolerancePx)
    return { ...support, cmPerPixel: round6(centre) }
  })
  return refined.sort((a, b) => b.weight - a.weight || b.support - a.support || a.cmPerPixel - b.cmPerPixel)
}

/**
 * What a drawing's own content says about a candidate scale.
 *
 * The vote asks only whether numbers agree with one another, and on a sheet
 * whose typeface the reader half-knows, a handful of misreadings CAN agree —
 * `0551` over the overall depth, `515` over a room, `827` over another — on a
 * scale three times the real one. Nothing in the arithmetic of the chains can
 * see that. The drawing can: at that scale its walls are more than a metre
 * thick. A check like this one is given by the caller, who knows what kind of
 * drawing the frame is; the chain layer knows only numbers and pixels.
 */
export type ScalePlausibility = (cmPerPixel: number) => { plausible: boolean; why: string }

/** Why the frame's scale is not the vote's winner, when it is not. */
export type ScaleDecision = {
  /** The vote's own winner, which the drawing's content rules out. */
  rejected: ScaleVote & { why: string }
  /** The best-supported scale the drawing does allow, or null when none is supported well enough to take. */
  chosen: (ScaleVote & { why: string }) | null
  /** Every distinct candidate that was weighed, strongest first. */
  considered: Array<ScaleVote & { plausible: boolean; why: string }>
}

/**
 * The scale with the most weighted support.
 *
 * Each proposal is seeded in turn and the proposals within tolerance of it are
 * counted, at most ONE PER NUMBER so that a single ambiguous reading with six
 * alternatives and four candidate spans cannot outvote four agreeing ones. The
 * winner is then refined by weighted least squares over its own inliers, twice,
 * because a cluster knows its centre better than the proposal that seeded it.
 *
 * The miss is measured in PIXELS, not per cent. What is uncertain is where the
 * tick marks are, and that is about a pixel whether they are forty pixels apart
 * or five hundred — so a percentage tolerance is simultaneously far too tight
 * on a short span and far too loose on a long one, which is exactly how a
 * misread `1250` survives on a span the sheet labels 1230.
 */
export function voteScale(proposals: readonly ScaleProposal[], tolerancePx: number): { cmPerPixel: number; votes: ScaleVote[] } | undefined {
  if (proposals.length === 0) return undefined
  const votes: ScaleVote[] = []
  let best: { cmPerPixel: number; weight: number; support: number; chains: number } | undefined
  for (const seed of proposals) {
    const vote = supportFor(proposals, seed.cmPerPixel, tolerancePx)
    votes.push(vote)
    if (!best || vote.weight > best.weight || (vote.weight === best.weight && vote.support > best.support)) best = vote
  }
  if (!best) return undefined
  const centre = refineScale(proposals, best.cmPerPixel, tolerancePx)
  return {
    cmPerPixel: round6(centre),
    votes: votes
      .sort((a, b) => b.weight - a.weight || b.support - a.support || a.cmPerPixel - b.cmPerPixel)
      .filter((v, i, all) => i === 0 || Math.abs(v.cmPerPixel - all[i - 1].cmPerPixel) > 1e-6)
      .slice(0, 8),
  }
}

/** How many distinct numbers a scale explains to within the tolerance. */
function inlierCount(proposals: readonly ScaleProposal[], scale: number, tolerancePx: number): number {
  const seen = new Set<string>()
  for (const p of proposals) if (Math.abs(p.valueCm / scale - p.pixelLength) <= tolerancePx) seen.add(`${p.chain}:${p.tokenIndex}`)
  return seen.size
}

/**
 * One axis's own scale, fitted INSIDE the pooled one's tolerance.
 *
 * A crop or a resize genuinely does stretch one axis, so the axes are allowed
 * to differ — but only by as much as the pooled fit's own inliers demand. An
 * axis refit is a correction, not a fresh hypothesis, and letting it wander
 * far from the pooled value would readmit exactly the outliers the pooled fit
 * threw out and call the result an anisotropy.
 */
function refineAxis(proposals: readonly ScaleProposal[], pooled: number, tolerancePx: number): number {
  let centre = pooled
  for (let round = 0; round < 3; round += 1) {
    const byToken = new Map<string, { p: ScaleProposal; merit: number }>()
    for (const p of proposals) {
      const missPx = Math.abs(p.valueCm / centre - p.pixelLength)
      if (missPx > tolerancePx) continue
      const merit = p.weight * Math.max(0.02, 1 - missPx / tolerancePx)
      const key = `${p.chain}:${p.tokenIndex}`
      const held = byToken.get(key)
      if (!held || merit > held.merit) byToken.set(key, { p, merit })
    }
    if (byToken.size < 2) return round === 0 ? pooled : round6(centre)
    let num = 0
    let den = 0
    for (const { p } of byToken.values()) {
      num += p.weight * p.valueCm * p.pixelLength
      den += p.weight * p.pixelLength * p.pixelLength
    }
    if (den <= 0) break
    const next = num / den
    if (Math.abs(Math.log(next / pooled)) > 0.05) return round6(centre)
    if (Math.abs(next - centre) < 1e-9) break
    centre = next
  }
  return round6(centre)
}

export type FrameChainSolution = {
  /** The scale of each pixel axis, in centimetres per pixel. */
  scaleX?: number
  scaleY?: number
  /** The single scale both axes were fitted from. */
  pooledScale?: number
  votes: ScaleVote[]
  inliersX: number
  inliersY: number
  solved: SolvedChain[]
  tokensPerChain: ChainToken[][]
  /** Present only when the drawing's content ruled out the vote's winner. */
  scaleDecision?: ScaleDecision
  /** 005I: how every number met the chains — each one's candidate lines, and what the global assignment made of it. */
  assignment: LabelAssignmentDecision[]
  /** 005I: the side convention that assignment read from the sheet. */
  assignmentConventions: SideConventions
}

/**
 * The frame's scale: the vote's winner, unless the drawing rules it out.
 *
 * A replacement has to be a scale the SHEET states, not one this function
 * prefers: at least three numbers, on at least two chains, agreeing on it. A
 * single number over a single span gives some ratio whatever it is, and taking
 * one of those because the winner was implausible would be choosing a scale
 * for its plausibility alone — which is guessing. When nothing qualifies the
 * frame is left without a scale, and says why.
 */
export function decideScale(
  proposals: readonly ScaleProposal[],
  winner: { cmPerPixel: number; votes: ScaleVote[] },
  tolerancePx: number,
  plausibility: ScalePlausibility,
): { cmPerPixel: number | undefined; decision?: ScaleDecision } {
  const verdict = plausibility(winner.cmPerPixel)
  if (verdict.plausible) return { cmPerPixel: winner.cmPerPixel }
  const own = supportFor(proposals, winner.cmPerPixel, tolerancePx)
  const considered = scaleCandidates(proposals, tolerancePx).map((c) => ({ ...c, ...plausibility(c.cmPerPixel) }))
  const chosen = considered.find((c) => c.plausible && c.support >= 3 && c.chains >= 2 && Math.abs(Math.log(c.cmPerPixel / winner.cmPerPixel)) >= 0.03)
  return {
    cmPerPixel: chosen?.cmPerPixel,
    decision: {
      rejected: { ...own, cmPerPixel: winner.cmPerPixel, why: verdict.why },
      chosen: chosen
        ? { cmPerPixel: chosen.cmPerPixel, weight: chosen.weight, support: chosen.support, chains: chosen.chains, why: `the best-supported scale the drawing allows: ${chosen.support} numbers on ${chosen.chains} chains agree on it, and ${chosen.why}` }
        : null,
      considered: considered.slice(0, 8),
    },
  }
}

/**
 * Every chain on a frame shares one scale, and finding it is a frame-level
 * question, not a chain-level one.
 *
 * A drawing is printed at one scale. So a chain with a single readable number
 * cannot set its own scale — any number over any length gives some ratio and
 * the chain has nothing to check it against — but such a chain is perfectly
 * able to CONFIRM the scale the rest of the sheet agrees on. Voting across all
 * the chains at once is what turns a page of weak, individually meaningless
 * readings into one well-supported number, and it is what stops a stray `04`
 * beside a door from inventing a scale of 0.13 centimetres to the pixel and
 * then deriving a building from it.
 *
 * It is also what settles a question a plan's vertical chains can fail to
 * settle alone: two readings such as `1230` and `1250` can each explain their
 * own span to within a third of a pixel, and only the horizontal spans that
 * agree on one scale say which of them the sheet actually prints.
 */
export function solveFrameChains(
  chains: readonly RawChain[],
  tokens: readonly TextToken[],
  options: { tolerancePx?: number; minPixelLength?: number; maxOffsetHeights?: number; plausibility?: ScalePlausibility } = {},
): FrameChainSolution {
  const tolerance = options.tolerancePx ?? 2.2
  const minLength = options.minPixelLength ?? 6
  const assignment = assignLabels(chains, tokens, options)
  const tokensPerChain = assignment.perChain
  const proposals = chains.map((c, i) => proposalsOf(i, c, tokensPerChain[i], minLength))
  const horizontal = chains.flatMap((c, i) => (c.axis === 'HORIZONTAL' ? proposals[i] : []))
  const vertical = chains.flatMap((c, i) => (c.axis === 'VERTICAL' ? proposals[i] : []))
  const vote = voteScale([...horizontal, ...vertical], tolerance)
  const decided = vote && options.plausibility ? decideScale([...horizontal, ...vertical], vote, tolerance, options.plausibility) : { cmPerPixel: vote?.cmPerPixel }
  const pooled = decided.cmPerPixel
  const scaleX = pooled !== undefined ? refineAxis(horizontal, pooled, tolerance) : undefined
  const scaleY = pooled !== undefined ? refineAxis(vertical, pooled, tolerance) : undefined
  // A frame whose only supported scale the drawing rules out has no scale. Its
  // chains are still cut — at no scale, so nothing on them is derived — and
  // the numbers they carry stay unread rather than being bent to fit.
  const solved = chains.map((chain, i) => (pooled === undefined ? solveChain(chain, [], { ...options, fixedScale: undefined }) : solveChain(chain, tokensPerChain[i], { ...options, fixedScale: (chain.axis === 'HORIZONTAL' ? scaleX : scaleY) ?? pooled })))
  return {
    scaleX,
    scaleY,
    pooledScale: pooled,
    votes: vote?.votes ?? [],
    inliersX: scaleX === undefined ? 0 : inlierCount(horizontal, scaleX, tolerance),
    inliersY: scaleY === undefined ? 0 : inlierCount(vertical, scaleY, tolerance),
    solved,
    tokensPerChain,
    ...(decided.decision ? { scaleDecision: decided.decision } : {}),
    assignment: assignment.decisions,
    assignmentConventions: assignment.conventions,
  }
}

/**
 * Cut one chain into the segments that best explain its numbers.
 *
 * This is a discrete choice, not a fixed partition: the chain's ticks are
 * candidate cut points and the solver picks which of them are real. Every
 * span between two ticks is scored — a span carrying one number the scale
 * endorses is worth a great deal, a span carrying a number the scale refuses
 * is worth less than nothing, and a span carrying two numbers is impossible —
 * and the best-scoring partition of the whole chain is found exactly, by
 * dynamic programming over the ticks. There is no search heuristic and no
 * tuning: with n ticks there are n² spans and the optimum is reached in one
 * pass.
 *
 * What it never does is invent a value to make a chain close. A span with
 * nothing printed on it is DERIVED from the scale and labelled as derived, and
 * only on a chain that has at least one reading confirming that scale; a span
 * whose number cannot be reconciled with the scale is left UNRESOLVED.
 */
export function solveChain(chain: RawChain, tokens: readonly ChainToken[], options: { tolerancePx?: number; minPixelLength?: number; fixedScale?: number; topology?: boolean; minCorrectionPx?: number } = {}): SolvedChain {
  const tolerance = options.tolerancePx ?? 2.2
  const minLength = options.minPixelLength ?? 6
  const ticks = chain.ticks
  // 005D: with `topology`, the marks' classes cut the chain. A REJECTED mark is no cut and costs
  // nothing to run across; a QUESTIONABLE one may be a cut and costs nothing to run across; only a
  // TICK run across is a claim the arithmetic must pay for. Without it every mark is a tick.
  const kind = (i: number): 'TICK' | 'QUESTIONABLE' | 'REJECTED' => (options.topology ? (ticks[i].class ?? 'TICK') : 'TICK')
  const proposals = proposalsOf(0, chain, tokens, minLength, 0)
  let scale = options.fixedScale
  let votes: ScaleVote[] = []
  if (scale === undefined) {
    const own = voteScale(proposals, tolerance)
    scale = own?.cmPerPixel
    votes = own?.votes ?? []
  }
  if (scale === undefined || ticks.length < 2) return { segments: [], residualPx: 0, readSegments: 0, skippedTicks: [], scaleVotes: [] }
  const cmPerPixel = scale

  /** The best reading for the span between two ticks, and what it is worth. */
  type Span = { merit: number; token?: ChainToken; reading?: ChainToken['readings'][number]; missPx?: number; impossible: boolean }
  const spanCache = new Map<number, Span>()
  const spanOf = (from: number, to: number): Span => {
    const key = from * ticks.length + to
    const held = spanCache.get(key)
    if (held) return held
    const fromPx = ticks[from].atPx
    const toPx = ticks[to].atPx
    const pixelLength = toPx - fromPx
    const inside = tokens.filter((t) => t.atPx >= fromPx && t.atPx <= toPx)
    let skippedTicks = 0
    let skippedMarks = 0
    for (let k = from + 1; k < to; k += 1) {
      if (kind(k) === 'TICK') skippedTicks += 1
      if (kind(k) !== 'REJECTED') skippedMarks += 1
    }
    let span: Span
    if (pixelLength < minLength) span = { merit: -Infinity, impossible: true }
    else if (kind(from) === 'REJECTED' || kind(to) === 'REJECTED') span = { merit: -Infinity, impossible: true }
    else if (skippedMarks > 3) span = { merit: -Infinity, impossible: true }
    else if (inside.length > 1) span = { merit: -Infinity, impossible: true }
    else if (inside.length === 0) {
      // A span with nothing on it is neither evidence nor an error. It is
      // worth almost nothing — enough that the solver keeps a tick it has no
      // reason to doubt, and far too little to buy a partition that only works
      // because a number was reinterpreted to fit one of the pieces.
      span = { merit: 0.02, impossible: false }
    } else {
      const entry = inside[0]
      let best: { reading: ChainToken['readings'][number]; missPx: number; merit: number } | undefined
      for (const reading of entry.readings) {
        const missPx = Math.abs(reading.valueCm / cmPerPixel - pixelLength)
        if (missPx > tolerance) continue
        // 005E: with `minCorrectionPx`, a scale may give a span one of its ink's other values only where the span is long
        // enough for that choice to be a measurement: within a fixed pixel tolerance a short span fits a value by chance.
        if (reading.substitutions > 0 && options.minCorrectionPx !== undefined && pixelLength < options.minCorrectionPx) continue
        // Two independent beliefs, multiplied rather than ranked. A reading the
        // classifier is sure of that misses the scale by most of the tolerance
        // is worth less than its own runner-up landing on the scale exactly —
        // which is the whole reason the chain is consulted at all.
        const merit = reading.confidence * Math.max(0.02, 1 - missPx / tolerance)
        if (!best || merit > best.merit) best = { reading, missPx, merit }
      }
      // Two claims, two prices.
      //
      // Swallowing a tick claims the tick is not a measurement point; without a
      // price for that, every chain would collapse to one span carrying
      // whichever number happened to fit it. Substituting a character claims
      // the reader misread; that has to cost MORE than skipping a tick, or the
      // solver will happily reinterpret `510` as `310` to justify a division
      // the draughtsman never drew — trading a number the sheet prints for one
      // it does not, and calling the result a better explanation.
      const skipped = skippedTicks
      span = best
        ? { merit: (1 + best.merit) * 0.7 ** skipped * 0.45 ** best.reading.substitutions, token: entry, reading: best.reading, missPx: best.missPx, impossible: false }
        : { merit: -0.5, token: entry, impossible: false }
    }
    spanCache.set(key, span)
    return span
  }

  // Best partition of ticks[first..last], by dynamic programming: from the first mark that may be a
  // measurement point to the last (every mark, without topology).
  const n = ticks.length
  let first = 0
  while (first < n - 1 && kind(first) === 'REJECTED') first += 1
  let last = n - 1
  while (last > first && kind(last) === 'REJECTED') last -= 1
  const best = new Float64Array(n).fill(-Infinity)
  const from = new Int32Array(n).fill(-1)
  best[first] = 0
  for (let to = first + 1; to <= last; to += 1) {
    for (let start = first; start < to; start += 1) {
      if (best[start] === -Infinity) continue
      const span = spanOf(start, to)
      if (span.merit === -Infinity) continue
      const total = best[start] + span.merit
      if (total > best[to]) {
        best[to] = total
        from[to] = start
      }
    }
  }
  const cuts: number[] = []
  for (let at = last; at > first; at = from[at]) {
    if (from[at] < 0) break
    cuts.push(at)
  }
  cuts.push(first)
  cuts.reverse()

  const segments: SolvedSegment[] = []
  let sumSquare = 0
  let fitted = 0
  for (let k = 0; k + 1 < cuts.length; k += 1) {
    const a = cuts[k]
    const b = cuts[k + 1]
    const span = spanOf(a, b)
    const fromPx = ticks[a].atPx
    const toPx = ticks[b].atPx
    const pixelLength = round6(toPx - fromPx)
    const segment: SolvedSegment = { index: segments.length, fromPx, toPx, pixelLength, fromTick: a, toTick: b, rejected: [], origin: 'UNRESOLVED', confidence: 0 }
    if (span.token) {
      for (const reading of span.token.readings) {
        if (span.reading && reading.text === span.reading.text) continue
        const missPx = Math.abs(reading.valueCm / cmPerPixel - pixelLength)
        segment.rejected.push({
          text: reading.text,
          valueCm: reading.valueCm,
          why: missPx > tolerance ? `implies ${round6(reading.valueCm / pixelLength)} cm/px against the chain's ${round6(cmPerPixel)}` : 'a weaker reading of the same characters',
        })
      }
    }
    if (span.reading && span.token) {
      segment.valueCm = span.reading.valueCm
      segment.text = span.reading.text
      segment.token = span.token.token
      segment.origin = span.reading.substitutions === 0 ? 'READ' : 'CHAIN_CORRECTED'
      segment.residualPx = round6(span.missPx ?? 0)
      segment.residualCm = round6(span.reading.valueCm - cmPerPixel * pixelLength)
      // Three independent doubts, multiplied: how decided the characters were,
      // how far the chosen reading is from the reader's own first choice, and
      // how well it fits the scale.
      segment.confidence = round6(
        Math.min(1, span.token.token.confidence * span.reading.confidence * 0.85 ** span.reading.substitutions * Math.max(0.3, 1 - (span.missPx ?? 0) / tolerance / 2)),
      )
      sumSquare += (span.missPx ?? 0) ** 2
      fitted += 1
    }
    segments.push(segment)
  }

  const residualPx = fitted > 0 ? round6(Math.sqrt(sumSquare / fitted)) : 0
  // Only a chain the scale has been CONFIRMED on may have its blanks filled
  // in, and confirmed means the readings it does have sit ON the scale rather
  // than merely near it. Deriving a value on a chain that never really agreed
  // with anything is how a reader turns a door schedule into a dimension.
  if (fitted > 0 && residualPx <= tolerance / 2) {
    for (const segment of segments) {
      if (segment.valueCm !== undefined || segment.token !== undefined) continue
      if (segment.origin !== 'UNRESOLVED') continue
      segment.valueCm = round6(cmPerPixel * segment.pixelLength)
      segment.origin = 'DERIVED'
      segment.confidence = 0.4
    }
  }

  const kept = new Set(cuts)
  const derivable = segments.length > 0 && segments.every((s) => s.valueCm !== undefined)
  return {
    segments,
    cmPerPixel: round6(cmPerPixel),
    residualPx,
    readSegments: fitted,
    derivedTotalCm: derivable ? round6(segments.reduce((a, s) => a + (s.valueCm ?? 0), 0)) : undefined,
    skippedTicks: ticks.map((_, i) => i).filter((i) => !kept.has(i)),
    scaleVotes: votes,
  }
}

/** A deterministic id for a chain: a function of where it is, never of when it was found. */
export const chainId = (frameId: string, axis: ChainAxis, baselinePx: number, ticks: readonly number[]): string =>
  stableId('chain', `${axis.toLowerCase()}-${Math.round(baselinePx)}`, { frameId, axis, baselinePx: round6(baselinePx), ticks: ticks.map(round6) })
