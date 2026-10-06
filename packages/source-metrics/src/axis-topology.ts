/**
 * Dimension topology between neighbouring lines (BUILDPLAN-ANALYZER-005I).
 *
 * A plan's margin often carries two dimension lines a couple of text heights apart: an overall
 * dimension beside the building and, nearer it, the chain of parts it is made of. A label printed
 * between them is nearly equidistant from both, and the reading of the whole margin turns on which
 * line it names. Blind round 7 (005H) found the failure this module exists for: the inner chain's
 * `900` was handed to the overall line because it was half a pixel nearer to it, the overall line's
 * own `1100` was then left with nothing to bind to, and the depth of the house was read from a chain
 * that had lost its labels.
 *
 * Three things are decided here, from the drawing alone — line geometry, mark positions, label boxes
 * and orientations — and never from a value, a scale, an area or a building:
 *
 *   1. MEASUREMENT CHAINS. A crossing mark that is nothing but label ink beside the line (two labels
 *      flanking it, `TEXT_INK` on both sides, `markLabelInk`) is not on the chain: no span ends there
 *      and no span pays for running across it. It stays on the record as a REJECTED mark.
 *   2. LABEL ASSIGNMENT. Every label is given every line it could be printed on, with what makes each
 *      candidate plausible — how far the line is in the label's own heights, which side of the label
 *      the line lies on, whether a span of the line is centred on it — and the labels of a
 *      neighbourhood are assigned together, by an exact minimum-cost assignment (one label per
 *      interval, one interval per label, a label left unassigned rather than forced). A label whose
 *      assignment an equally good alternative would change is AMBIGUOUS and is bound to nothing.
 *   3. AXIS GROUPS. Parallel lines that overlap along their axis and lie within a few label heights of
 *      each other are one group; within it, which line subdivides which (an overall line and its
 *      chain of parts share their end marks) and which ends a neighbour corroborates are recorded.
 *
 * The side of a line a label sits on is the drawing convention this module leans on, stated so it
 * can be argued with: a dimension's number is printed parallel to its line and on the line's far side
 * from the text's own baseline — "above" the line as the text reads (ISO 129, PN-ISO) — or, in the
 * in-line style, across the line itself. A line lying beyond the TOPS of the glyphs is the label's
 * neighbour, not its own line. It is a cost, never a prohibition: a label with only that line keeps it.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { ChainAxis, ChainTick, ChainToken, RawChain } from './chains.js'
import type { TextOrientation, TextToken } from './ocr.js'
import { textAxisOf } from './ocr.js'
import { parseNumber, readingLattice } from './parse.js'
import { toCentimetres } from './schema.js'

export const AXIS_TOPOLOGY_NAME = 'metrics.axis-topology' as const
export const AXIS_TOPOLOGY_VERSION = '1.0.0' as const

/**
 * The costs of a label-to-line candidate, in the label's own text heights, and the bounds of the assignment.
 *
 * - `topSide`: the line lies beyond the tops of the label's glyphs (the convention puts a label's own line at or past
 *   its baseline). One text height: a label two thirds of a height from a neighbour on its top side and three quarters
 *   of a height from its own line on its baseline side goes to its own line.
 * - `uncentred`: no span of the line within two skipped marks is centred on the label (only where the caller asks for
 *   centring, as the 005B solver does): more than any offset difference, as the 005B order had it.
 * - `reward`: what binding one label is worth. Larger than any candidate's cost, so a label that competes with
 *   nothing is always bound, as before; a label is moved off its best line only when that frees a slot another label
 *   needs more than this one gains by staying.
 * - `ambiguity`: an assignment within this much of the optimum that binds a label elsewhere (or not at all) leaves it
 *   AMBIGUOUS: nothing in the drawing prefers one reading to the other by a tenth of a text height.
 * - `componentLabels`: the most labels one connected neighbourhood may hold for an exact re-solve per label; above it
 *   (no development sheet comes near) each label is checked against its own next-best candidate only, and says so.
 */
export const ASSIGNMENT_BOUNDS = { topSide: 1, uncentred: 2.5, reward: 6, ambiguity: 0.1, componentLabels: 96 } as const

/** Parallel lines within this many label heights of each other, overlapping along their axis by half the shorter, are one group. */
export const AXIS_GROUP_BOUNDS = { separationHeights: 4, overlapShare: 0.5, alignHeights: 0.2, alignMinPx: 2 } as const

// ---------------------------------------------------------------------------
// 1. measurement chains
// ---------------------------------------------------------------------------

/** A mark that is label ink on both sides of its line: two labels flanking a line, not a stroke across it. */
export const isLabelInkMark = (t: ChainTick): boolean => t.class === 'REJECTED' && (t.reasons ?? []).includes('TEXT_INK')

/**
 * The chain as a measurement: its marks without the ones that are only label ink. Ids, records and the evidence
 * pack keep every mark; the solvers see only these. A line left with fewer than two marks measures nothing.
 */
export function measurementChain(chain: RawChain): RawChain {
  if (!chain.ticks.some(isLabelInkMark)) return chain
  return { ...chain, ticks: chain.ticks.filter((t) => !isLabelInkMark(t)) }
}

// ---------------------------------------------------------------------------
// 2. label assignment
// ---------------------------------------------------------------------------

/** Which side of a label a line lies on, in the label's own reading frame. */
export type LabelSide = 'BASELINE' | 'THROUGH' | 'TOP'

/** Where a label's glyph tops are and which way its text runs down, in the frame's pixels across a line of `axis`. */
function readingFrame(token: TextToken): { top: number; down: 1 | -1; across: number } {
  const b = token.box
  switch (token.orientation) {
    case 'HORIZONTAL':
      return { top: b.y0, down: 1, across: b.y1 - b.y0 }
    case 'INVERTED':
      return { top: b.y1, down: -1, across: b.y1 - b.y0 }
    case 'ROTATED_CW':
      // Read bottom to top: the glyphs' tops point to −x.
      return { top: b.x0, down: 1, across: b.x1 - b.x0 }
    case 'ROTATED_CCW':
      return { top: b.x1, down: -1, across: b.x1 - b.x0 }
  }
}

/** The side of the label a line at `baselinePx` lies on: past its glyph tops, through its body, or at or past its baseline. */
export function labelSide(token: TextToken, baselinePx: number): LabelSide {
  const f = readingFrame(token)
  const u = (baselinePx - f.top) * f.down
  if (u < 0) return 'TOP'
  if (u <= f.across) return 'THROUGH'
  return 'BASELINE'
}

/** One line a label could be printed on, and what it would cost to say it is. */
export type LabelCandidate = {
  chain: number
  /** The interval of the chain the label falls in (between consecutive marks); one label per interval. */
  interval: number
  /** Where the label sits along the chain. */
  along: number
  /** |label centre − line| / label height. */
  offset: number
  side: LabelSide
  centred: boolean
  cost: number
}

export type LabelAssignmentStatus = 'BOUND' | 'AMBIGUOUS' | 'UNASSIGNED' | 'NO_CANDIDATE'

/** The record of one label's assignment: every candidate, what was chosen, and by how much. */
export type LabelAssignmentDecision = {
  /** The label's ink and reading: the text as read, its box and orientation. */
  text: string
  orientation: TextOrientation
  box: PixelRect
  candidates: LabelCandidate[]
  status: LabelAssignmentStatus
  /** The candidate bound, when one was. */
  chosen?: { chain: number; interval: number }
  /**
   * How much worse the best assignment that does NOT bind the label there is, in cost units (text heights): the
   * margin the drawing gives this decision. Absent for a label with no competitor and one candidate.
   */
  margin?: number
  /** Set when the neighbourhood exceeded `componentLabels` and the margin was checked locally only. */
  bounded?: boolean
}

export type LabelAssignment = { perChain: ChainToken[][]; decisions: LabelAssignmentDecision[] }

/** A canonical key for a token: its geometry and reading, never its position in an input list. */
const tokenKey = (t: TextToken): string => `${round6(t.box.x0)}|${round6(t.box.y0)}|${round6(t.box.x1)}|${round6(t.box.y1)}|${t.orientation}|${t.text}`
const chainKey = (c: RawChain): string => `${c.axis}|${round6(c.baselinePx)}|${c.ticks.map((t) => round6(t.atPx)).join(',')}`
const compareKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Whether some span of the chain, across at most two marks, is centred on `along` (005B's `centredOn`). */
function centredOn(chain: RawChain, along: number): boolean {
  const t = chain.ticks
  for (let from = 0; from < t.length; from += 1) {
    for (let to = from + 1; to < t.length && to - from - 1 <= 2; to += 1) {
      if (t[from].atPx > along || t[to].atPx < along) continue
      const length = t[to].atPx - t[from].atPx
      if (Math.abs(along - (t[from].atPx + t[to].atPx) / 2) <= length * 0.3) return true
    }
  }
  return false
}

/** Every line a token could be printed on (the 005B geometric test), with each candidate's cost. */
export function labelCandidates(chains: readonly RawChain[], token: TextToken, options: { maxOffsetHeights?: number; preferCentred?: boolean } = {}): LabelCandidate[] {
  const maxOffset = options.maxOffsetHeights ?? 2.2
  const cx = (token.box.x0 + token.box.x1) / 2
  const cy = (token.box.y0 + token.box.y1) / 2
  const height = Math.max(1, token.height)
  const out: LabelCandidate[] = []
  chains.forEach((chain, index) => {
    if (chain.ticks.length < 2 || textAxisOf(token.orientation) !== chain.axis) return
    const along = chain.axis === 'HORIZONTAL' ? cx : cy
    const acrossPx = chain.axis === 'HORIZONTAL' ? cy : cx
    const offset = Math.abs(acrossPx - chain.baselinePx) / height
    if (offset > maxOffset) return
    if (along < chain.ticks[0].atPx || along > chain.ticks[chain.ticks.length - 1].atPx) return
    let interval = 0
    while (interval + 2 < chain.ticks.length && chain.ticks[interval + 1].atPx < along) interval += 1
    const side = labelSide(token, chain.baselinePx)
    const centred = options.preferCentred ? centredOn(chain, along) : true
    const cost = round6(offset + (side === 'TOP' ? ASSIGNMENT_BOUNDS.topSide : 0) + (centred ? 0 : ASSIGNMENT_BOUNDS.uncentred))
    out.push({ chain: index, interval, along: round6(along), offset: round6(offset), side, centred, cost })
  })
  return out
}

/**
 * Minimum-cost assignment of `n` rows to distinct columns of an `n × m` matrix (`n ≤ m`), by the Hungarian method with
 * potentials (Kuhn–Munkres, O(n²·m)). Exact; ties are broken by the matrix's own row and column order, which the caller
 * makes canonical. Returns the column of each row.
 */
export function hungarian(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length
  if (n === 0) return []
  const m = cost[0].length
  if (m < n) throw new Error('hungarian: more rows than columns')
  const INF = Number.POSITIVE_INFINITY
  const u = new Float64Array(n + 1)
  const v = new Float64Array(m + 1)
  const p = new Int32Array(m + 1)
  const way = new Int32Array(m + 1)
  for (let i = 1; i <= n; i += 1) {
    p[0] = i
    let j0 = 0
    const minv = new Float64Array(m + 1).fill(INF)
    const used = new Uint8Array(m + 1)
    do {
      used[j0] = 1
      const i0 = p[j0]
      let delta = INF
      let j1 = 0
      for (let j = 1; j <= m; j += 1) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j += 1) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0 !== 0)
  }
  const column = new Array<number>(n).fill(-1)
  for (let j = 1; j <= m; j += 1) if (p[j] > 0) column[p[j] - 1] = j - 1
  return column
}

/** A cost no assignment takes: a candidate that does not exist. Finite, so the potentials stay finite. */
const FORBIDDEN = 1e9

/**
 * Solve one neighbourhood: labels (rows) against slots (chain, interval) and one "unassigned" column per label. A label
 * on a slot costs its candidate's cost minus the reward; unassigned costs nothing. Returns each label's slot (or -1) and
 * the total cost.
 */
function solveNeighbourhood(costs: readonly (readonly number[])[], slots: number): { slotOf: number[]; total: number } {
  const n = costs.length
  const matrix = costs.map((row) => [...row, ...new Array<number>(n).fill(0)])
  const column = hungarian(matrix)
  let total = 0
  const slotOf = column.map((c, i) => {
    total += matrix[i][c]
    return c < slots ? c : -1
  })
  return { slotOf, total: round6(total) }
}

/**
 * Give every label to at most one line, globally (BUILDPLAN-ANALYZER-005I).
 *
 * Each label's candidates (`labelCandidates`) are its possible lines; a line's interval holds one label. Labels that
 * compete for an interval, directly or through others, form a neighbourhood, and each neighbourhood is assigned
 * exactly — the assignment of least total cost, a label bound at its candidate's cost less the reward, a label left
 * unassigned at none. Labels and lines enter in a canonical order of their geometry, so the order a caller lists them
 * in decides nothing; an exact tie between two assignments is not broken by that order either: a label whose
 * assignment an alternative within `ambiguity` would change is AMBIGUOUS and is bound to nothing.
 *
 * `readingsOf` supplies a token's readings (its numeric lattice); otherwise the legacy substitution list. A token with
 * no dimension reading is not a label and takes part in nothing.
 */
export function assignLabels(
  chains: readonly RawChain[],
  tokens: readonly TextToken[],
  options: { maxOffsetHeights?: number; preferCentred?: boolean; readingsOf?: (token: TextToken) => ChainToken['readings'] | undefined } = {},
): LabelAssignment {
  const perChain: ChainToken[][] = chains.map(() => [])
  // Canonical order: chains by geometry, tokens by geometry and reading. Indices below are canonical.
  const chainOrder = chains.map((c, i) => ({ i, key: chainKey(c) })).sort((a, b) => compareKeys(a.key, b.key) || a.i - b.i)
  const canonicalChains = chainOrder.map((o) => chains[o.i])
  type Entry = { token: TextToken; readings: ChainToken['readings']; candidates: LabelCandidate[] }
  const seen = new Set<string>()
  const entries: Entry[] = []
  for (const token of [...tokens].sort((a, b) => compareKeys(tokenKey(a), tokenKey(b)))) {
    const key = tokenKey(token)
    // One ink read once: an identical token listed twice is one label.
    if (seen.has(key)) continue
    seen.add(key)
    const candidates = labelCandidates(canonicalChains, token, options)
    if (candidates.length === 0) continue
    const supplied = options.readingsOf?.(token)
    const readings: ChainToken['readings'] = supplied ? [...supplied] : []
    if (!supplied) {
      for (const candidate of readingLattice(token)) {
        for (const parsed of parseNumber(candidate.text)) {
          if (parsed.kind !== 'LINEAR_DIMENSION') continue
          readings.push({ text: candidate.text, parsed, valueCm: round6(toCentimetres(parsed.value, parsed.unit)), confidence: round6(candidate.confidence), substitutions: candidate.substitutions })
        }
      }
    }
    if (readings.length === 0) continue
    entries.push({ token, readings, candidates })
  }

  // Slots and neighbourhoods: labels joined by a slot they could both take.
  const slotKey = (c: LabelCandidate): string => `${c.chain}:${c.interval}`
  const parent = entries.map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    return r
  }
  const firstOnSlot = new Map<string, number>()
  entries.forEach((e, i) => {
    for (const c of e.candidates) {
      const k = slotKey(c)
      const held = firstOnSlot.get(k)
      if (held === undefined) firstOnSlot.set(k, i)
      else {
        const [a, b] = [find(held), find(i)]
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
      }
    }
  })
  const groups = new Map<number, number[]>()
  entries.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]))

  const decisionOf = new Map<number, LabelAssignmentDecision>()
  const R = ASSIGNMENT_BOUNDS.reward
  for (const members of [...groups.values()]) {
    const slots = [...new Set(members.flatMap((i) => entries[i].candidates.map(slotKey)))].sort((a, b) => {
      const [ca, ia] = a.split(':').map(Number)
      const [cb, ib] = b.split(':').map(Number)
      return ca - cb || ia - ib
    })
    const slotIndex = new Map(slots.map((s, k) => [s, k]))
    const costs = members.map((i) => {
      const row = new Array<number>(slots.length).fill(FORBIDDEN)
      for (const c of entries[i].candidates) row[slotIndex.get(slotKey(c)) as number] = round6(c.cost - R)
      return row
    })
    const best = solveNeighbourhood(costs, slots.length)
    const exact = members.length <= ASSIGNMENT_BOUNDS.componentLabels
    members.forEach((i, r) => {
      const e = entries[i]
      const s = best.slotOf[r]
      const competed = members.length > 1 || e.candidates.length > 1
      let margin: number | undefined
      if (competed) {
        if (exact) {
          // The best assignment that does not put this label where the optimum does.
          const forbid = costs.map((row, k) => (k === r ? row.map((v, j) => (s >= 0 ? (j === s ? FORBIDDEN : v) : v)) : row))
          if (s < 0) {
            // Unassigned in the optimum: the best assignment that binds it somewhere.
            const bound = costs.map((row) => [...row])
            const alternative = solveNeighbourhoodBound(bound, slots.length, r)
            margin = alternative === undefined ? undefined : round6(alternative - best.total)
          } else margin = round6(solveNeighbourhood(forbid, slots.length).total - best.total)
        } else {
          const own = s >= 0 ? costs[r][s] : 0
          const others = [...costs[r].filter((_, j) => j !== s), 0].sort((a, b) => a - b)
          margin = round6(others[0] - own)
        }
      }
      const chosenCandidate = s >= 0 ? e.candidates.find((c) => slotKey(c) === slots[s]) : undefined
      const ambiguous = margin !== undefined && margin < ASSIGNMENT_BOUNDS.ambiguity
      const status: LabelAssignmentStatus = ambiguous ? 'AMBIGUOUS' : chosenCandidate ? 'BOUND' : 'UNASSIGNED'
      decisionOf.set(i, {
        text: e.token.text,
        orientation: e.token.orientation,
        box: e.token.box,
        candidates: e.candidates.map((c) => ({ ...c, chain: chainOrder[c.chain].i })),
        status,
        ...(chosenCandidate ? { chosen: { chain: chainOrder[chosenCandidate.chain].i, interval: chosenCandidate.interval } } : {}),
        ...(margin !== undefined ? { margin } : {}),
        ...(competed && !exact ? { bounded: true } : {}),
      })
      if (status === 'BOUND' && chosenCandidate) perChain[chainOrder[chosenCandidate.chain].i].push({ token: e.token, atPx: chosenCandidate.along, offset: chosenCandidate.offset, readings: e.readings })
    })
  }
  const decisions = entries.map((_, i) => decisionOf.get(i)).filter((d): d is LabelAssignmentDecision => d !== undefined)
  return {
    perChain: perChain.map((list) => list.sort((a, b) => a.atPx - b.atPx || compareKeys(tokenKey(a.token), tokenKey(b.token)))),
    decisions,
  }
}

/** The least total cost of the neighbourhood with label `row` bound to some slot (never unassigned), or undefined if it has none. */
function solveNeighbourhoodBound(costs: number[][], slots: number, row: number): number | undefined {
  if (!costs[row].some((v) => v < FORBIDDEN / 2)) return undefined
  const n = costs.length
  const matrix = costs.map((r, i) => [...r, ...new Array<number>(n).fill(i === row ? FORBIDDEN : 0)])
  const column = hungarian(matrix)
  let total = 0
  column.forEach((c, i) => (total += matrix[i][c]))
  return total >= FORBIDDEN / 2 ? undefined : round6(total)
}

// ---------------------------------------------------------------------------
// 3. axis groups
// ---------------------------------------------------------------------------

export type AxisRelationKind = 'SUBDIVIDES' | 'CONTAINS' | 'OVERLAPS'
export type AxisRole = 'OVERALL' | 'SUBDIVISION' | 'PARTIAL' | 'INDEPENDENT'

export type DimensionAxisGroup = {
  id: string
  axis: ChainAxis
  /** Member chain indices, by baseline. */
  members: number[]
  /** Distance between consecutive members' lines, in pixels and in label heights. */
  separations: Array<{ from: number; to: number; px: number; heights: number }>
  /** How the members stand to each other: `a` SUBDIVIDES `b` when `a` has marks at both of `b`'s ends and one between. */
  relations: Array<{ a: number; b: number; kind: AxisRelationKind; alignedEnds: [boolean, boolean] }>
}

export type ChainAxisTopology = { groupId: string; roles: AxisRole[]; alignedEnds: [boolean, boolean] }

/**
 * Parallel dimension lines that belong together: the same axis, overlapping along it by at least half the shorter, and
 * within `separationHeights` label heights of each other. Neighbouring lines stay distinct members — a group says they
 * are neighbours, never that they are one line — and what each is to the others is decided from their marks alone.
 */
export function dimensionAxisGroups(frameId: string, chains: readonly RawChain[], chainIds: readonly string[], labelHeight: number): { groups: DimensionAxisGroup[]; perChain: Array<ChainAxisTopology | undefined> } {
  const h = Math.max(1, labelHeight)
  const tol = Math.max(AXIS_GROUP_BOUNDS.alignMinPx, AXIS_GROUP_BOUNDS.alignHeights * h)
  const range = (c: RawChain): [number, number] => [c.ticks[0].atPx, c.ticks[c.ticks.length - 1].atPx]
  const usable = chains.map((c) => c.ticks.length >= 2)
  const parent = chains.map((_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    return r
  }
  for (let a = 0; a < chains.length; a += 1) {
    for (let b = a + 1; b < chains.length; b += 1) {
      if (!usable[a] || !usable[b] || chains[a].axis !== chains[b].axis) continue
      if (Math.abs(chains[a].baselinePx - chains[b].baselinePx) > AXIS_GROUP_BOUNDS.separationHeights * h) continue
      const [a0, a1] = range(chains[a])
      const [b0, b1] = range(chains[b])
      const overlap = Math.min(a1, b1) - Math.max(a0, b0)
      if (overlap < AXIS_GROUP_BOUNDS.overlapShare * Math.min(a1 - a0, b1 - b0)) continue
      const [ra, rb] = [find(a), find(b)]
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
    }
  }
  const byRoot = new Map<number, number[]>()
  chains.forEach((_, i) => {
    if (usable[i]) byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), i])
  })
  const hasMarkNear = (c: RawChain, px: number): boolean => c.ticks.some((t) => Math.abs(t.atPx - px) <= tol)
  const groups: DimensionAxisGroup[] = []
  const perChain: Array<ChainAxisTopology | undefined> = chains.map(() => undefined)
  for (const members of [...byRoot.values()]) {
    members.sort((a, b) => chains[a].baselinePx - chains[b].baselinePx || compareKeys(chainIds[a], chainIds[b]))
    const id = stableId('axis-group', `${chains[members[0]].axis.toLowerCase()}-${Math.round(chains[members[0]].baselinePx)}`, { frameId, members: members.map((m) => chainIds[m]) })
    const relations: DimensionAxisGroup['relations'] = []
    const roles = new Map<number, Set<AxisRole>>(members.map((m) => [m, new Set<AxisRole>()]))
    const aligned = new Map<number, [boolean, boolean]>(members.map((m) => [m, [false, false]]))
    for (const a of members) {
      for (const b of members) {
        if (a === b) continue
        const [a0, a1] = range(chains[a])
        const [b0, b1] = range(chains[b])
        const ends: [boolean, boolean] = [hasMarkNear(chains[b], a0), hasMarkNear(chains[b], a1)]
        const held = aligned.get(a) as [boolean, boolean]
        aligned.set(a, [held[0] || ends[0], held[1] || ends[1]])
        if (a >= b) continue
        // a subdivides b: marks at both of b's ends and at least one strictly between them (and the converse).
        const between = (c: RawChain, lo: number, hi: number): boolean => c.ticks.some((t) => t.atPx > lo + tol && t.atPx < hi - tol)
        const aOnB = hasMarkNear(chains[a], b0) && hasMarkNear(chains[a], b1) && between(chains[a], b0, b1)
        const bOnA = hasMarkNear(chains[b], a0) && hasMarkNear(chains[b], a1) && between(chains[b], a0, a1)
        let kind: AxisRelationKind
        let first = a
        let second = b
        if (aOnB && !bOnA) kind = 'SUBDIVIDES'
        else if (bOnA && !aOnB) {
          kind = 'SUBDIVIDES'
          first = b
          second = a
        } else if (a0 >= b0 - tol && a1 <= b1 + tol) {
          kind = 'CONTAINS'
          first = b
          second = a
        } else if (b0 >= a0 - tol && b1 <= a1 + tol) kind = 'CONTAINS'
        else kind = 'OVERLAPS'
        const [f0, f1] = range(chains[first])
        const [s0, s1] = range(chains[second])
        relations.push({ a: first, b: second, kind, alignedEnds: [Math.abs(f0 - s0) <= tol, Math.abs(f1 - s1) <= tol] })
        if (kind === 'SUBDIVIDES') {
          roles.get(first)?.add('SUBDIVISION')
          roles.get(second)?.add('OVERALL')
        } else if (kind === 'CONTAINS' && (Math.abs(f0 - s0) <= tol || Math.abs(f1 - s1) <= tol)) roles.get(second)?.add('PARTIAL')
      }
    }
    const separations: DimensionAxisGroup['separations'] = []
    for (let k = 0; k + 1 < members.length; k += 1) {
      const px = round6(chains[members[k + 1]].baselinePx - chains[members[k]].baselinePx)
      separations.push({ from: members[k], to: members[k + 1], px, heights: round6(px / h) })
    }
    groups.push({ id, axis: chains[members[0]].axis, members, separations, relations })
    for (const m of members) {
      const r = [...(roles.get(m) ?? [])]
      perChain[m] = { groupId: id, roles: (r.length > 0 ? r : ['INDEPENDENT']).sort() as AxisRole[], alignedEnds: aligned.get(m) as [boolean, boolean] }
    }
  }
  groups.sort((a, b) => compareKeys(a.id, b.id))
  return { groups, perChain }
}
