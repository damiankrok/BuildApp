/**
 * N9-02R — RESEARCH ONLY, not wired into the production assessment: on the frozen synthetic holdout it read 18 of 18
 * drawn facades and refused 12 of 12 undecidable ones, but on the real ARCHON renders it refused nearly every view
 * (background trees at the wall ends read as occluders, white walls against white clouds), so it did not show a
 * reliable gain on real sources and the N9-02A band reading stays in production (see the N9-02R stage report).
 *
 * Architectural anchors read from an elevation's ORIGINAL RGB — a small classical reader, with positive and
 * negative evidence kept apart and every anchor carrying where it is, how sure it is and why it was taken or refused.
 *
 * Three pixel layers, none of them a cleaned sketch (the raster is never written):
 *
 *   BACKGROUND  pixels of the sheet's own background colour — read per row from the sheet's margins, so a sky's
 *               gradient and white paper are both background — that are CONNECTED to the sheet's border, through
 *               background or vegetation (a patch of sky closed in by a pergola's beam and posts over the lawn is still
 *               sky). A white wall enclosed by drawn lines is not background; a white wall that runs into a white sky
 *               with no line between them is, and its ends are then not decidable (UNKNOWN, never guessed).
 *   VEGETATION  green-dominant pixels (trees, hedges, grass): an occluder — the facade continues behind it, but an end
 *               that meets it is OCCLUDED, never an end.
 *   BUILT       everything else: walls of any finish and colour, glazing, doors, roofs, eaves, pergolas, balconies.
 *               A multi-material facade is ONE run of built pixels; it is not required to be neutral.
 *
 * Per row, the facade run is the built run (bridged across vegetation) over the middle of the traced outline. Its two
 * ends are classified CLEAN (background beyond it), OCCLUDED (vegetation beyond it) or CUT (the sheet's or the
 * outline's edge). CLEAN ends that line up on one column over consecutive rows form a vertical edge; an edge is a WALL
 * END only when it
 *
 *   - is vertical (an elevation is orthographic: an edge that leans is a perspective, and is refused),
 *   - stands on the ground (its foot within a plinth of the facade's lowest row — a balcony's or a screen's top is not),
 *   - is covered at its top by built pixels running at least as far out (the eaves, a fascia or a flush roof — a timber
 *     screen or a pergola post standing past the roof is not covered), and
 *   - does not run on, on the same column, up through the roof (a vertical line cutting roof and wall alike is the
 *     sheet's or a section's edge, not a wall end).
 *
 * Exactly one such edge on each side is the facade's two wall ends. None, or more than one, is a refusal with the
 * candidates listed. Above the walls: the apex of the roof (narrow spikes — chimneys — left out) and the eaves row.
 * Nothing here reads the model, a plan or an expected opening position: the anchors are found on the image alone.
 */
import type { PixelRect } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'

export const FACADE_ANCHORS_VERSION = 'n9-02r-facade-anchors-1'

/**
 * Two pixels are one surface when no channel differs by more than this — the same step the solver's sky flood uses
 * (`skyMask`), so a wall is background exactly where it cannot be told from the background by that rule.
 */
export const SURFACE_STEP = 12
/** Green dominance that marks vegetation (as `skyMask`'s own test). */
export const VEGETATION_DOMINANCE = 8
/** The share of the sheet's width read at each side as its margin, for the background colour of a row. */
export const MARGIN_SHARE = 0.03
/** An orthographic wall end does not lean: at most this many columns per row over its whole height. */
export const MAX_LEAN = 0.01
/** A wall end's foot may stand this share of the facade's height above its lowest row (a plinth, a terrace). */
export const FOOT_SHARE = 0.06
/** A wall end must run over at least this share of the facade's height. */
export const MIN_END_SHARE = 0.25
/** Consecutive rows of one edge may step by this many columns. */
const CHAIN_STEP = 2

export type PixelClass = 0 | 1 | 2 // 0 built, 1 background, 2 vegetation

export type EndKind = 'CLEAN' | 'OCCLUDED' | 'CUT'

export type EdgeCandidate = {
  side: 'LEFT' | 'RIGHT'
  /** Median column of the edge, its rows (top..bottom inclusive), and how many rows support it. */
  x: number
  y0: number
  y1: number
  rows: number
  /** Columns per row the edge leans (least squares). */
  lean: number
  /** Spread of its columns (px), the uncertainty of the end. */
  spreadPx: number
  covered: 'OVERHANG' | 'FLUSH' | 'NOT_COVERED'
  standsOnGround: boolean
  cutLine: boolean
  accepted: boolean
  why: string
}

export type FacadeAnchor = {
  type: 'OUTER_WALL_END' | 'GROUND_LINE' | 'EAVE' | 'RIDGE' | 'CHIMNEY' | 'OCCLUDER' | 'UNCERTAIN'
  /** Pixel coordinates on the sheet: a column (x), a row (y) or a box. */
  px: { x?: number; y?: number; x0?: number; x1?: number; y0?: number; y1?: number }
  uncertaintyPx: number
  support: string
  accepted: boolean
  why: string
}

export type FacadeAnchorReading = {
  version: typeof FACADE_ANCHORS_VERSION
  roi: PixelRect
  wallEnds: { state: 'ACCEPTED' | 'REFUSED' | 'UNKNOWN'; x0?: number; x1?: number; uncertaintyPx?: number; why: string }
  groundRow?: number
  eaveRow?: number
  apex?: { row: number; method: string } | { why: string }
  anchors: FacadeAnchor[]
  candidates: EdgeCandidate[]
  /** Rows read, and how their two ends were classified. */
  rowStats: { rows: number; left: Record<EndKind, number>; right: Record<EndKind, number> }
  /** Labels this reader does not produce, so their absence is not read as their absence on the sheet. */
  unsupported: string[]
}

/**
 * Every pixel's class — background (of the row's margin colour, connected to the sheet's border), vegetation, built —
 * and, per row, whether the sheet's two margins are two different backgrounds.
 */
export type PixelClasses = { cls: Uint8Array; marginsDiffer: Uint8Array }

export function classifyPixels(r: Raster): PixelClasses {
  const { width: w, height: h, data } = r
  const m = Math.max(2, Math.round(w * MARGIN_SHARE))
  const median = (xs: number[]): number => {
    xs.sort((a, b) => a - b)
    return xs[Math.floor(xs.length / 2)]
  }
  // the background colour of each row, at the left and right margin (a sheet may be cropped to white on one side)
  const marginOf = (y: number, from: number): [number, number, number] => {
    const rs: number[] = []
    const gs: number[] = []
    const bs: number[] = []
    for (let x = from; x < from + m; x += 1) {
      const o = (y * w + x) * 4
      rs.push(data[o])
      gs.push(data[o + 1])
      bs.push(data[o + 2])
    }
    return [median(rs), median(gs), median(bs)]
  }
  const left: Array<[number, number, number]> = []
  const right: Array<[number, number, number]> = []
  for (let y = 0; y < h; y += 1) {
    left.push(marginOf(y, 0))
    right.push(marginOf(y, w - m))
  }
  const near = (o: number, c: [number, number, number]): boolean => Math.abs(data[o] - c[0]) <= SURFACE_STEP && Math.abs(data[o + 1] - c[1]) <= SURFACE_STEP && Math.abs(data[o + 2] - c[2]) <= SURFACE_STEP
  const green = (o: number): boolean => data[o + 1] - Math.max(data[o], data[o + 2]) >= VEGETATION_DOMINANCE
  const out = new Uint8Array(w * h)
  const like = new Uint8Array(w * h)
  const marginsDiffer = new Uint8Array(h)
  // rows whose two margins are two different backgrounds (neither vegetation): the sheet is cut or pasted on one side
  for (let y = 0; y < h; y += 1) {
    const [l, rr] = [left[y], right[y]]
    const veg = (c: [number, number, number]): boolean => c[1] - Math.max(c[0], c[2]) >= VEGETATION_DOMINANCE
    if (!veg(l) && !veg(rr) && (Math.abs(l[0] - rr[0]) > SURFACE_STEP || Math.abs(l[1] - rr[1]) > SURFACE_STEP || Math.abs(l[2] - rr[2]) > SURFACE_STEP)) marginsDiffer[y] = 1
  }
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      const o = i * 4
      if (green(o)) out[i] = 2
      else if (near(o, left[y]) || near(o, right[y])) like[i] = 1
    }
  // background is what is connected to the sheet's border through background-coloured or vegetation pixels; only the
  // background-coloured ones are marked, vegetation stays vegetation
  const stack: number[] = []
  const seen = new Uint8Array(w * h)
  const seed = (i: number): void => {
    if (seen[i] === 1 || (like[i] === 0 && out[i] !== 2)) return
    seen[i] = 1
    if (like[i] === 1) out[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < w; x += 1) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 0; y < h; y += 1) {
    seed(y * w)
    seed(y * w + w - 1)
  }
  while (stack.length > 0) {
    const i = stack.pop() as number
    const x = i % w
    const y = (i - x) / w
    if (x > 0) seed(i - 1)
    if (x < w - 1) seed(i + 1)
    if (y > 0) seed(i - w)
    if (y < h - 1) seed(i + w)
  }
  return { cls: out, marginsDiffer }
}

/**
 * Read the facade anchors inside the traced outline (`outline`, which may take in trees and pergolas: it is a region of
 * interest, never an anchor).
 */
export function facadeAnchors(r: Raster, outline: PixelRect, classes: PixelClasses = classifyPixels(r)): FacadeAnchorReading {
  const { width: w, height: h } = r
  const cls = classes.cls
  const padX = Math.round(0.04 * (outline.x1 - outline.x0))
  const roi = { x0: Math.max(0, outline.x0 - padX), y0: Math.max(0, outline.y0), x1: Math.min(w - 1, outline.x1 + padX), y1: Math.min(h - 1, outline.y1) }
  const at = (x: number, y: number): PixelClass => (x < 0 || y < 0 || x >= w || y >= h ? 1 : (cls[y * w + x] as PixelClass))
  const cx0 = Math.round(outline.x0 + 0.3 * (outline.x1 - outline.x0))
  const cx1 = Math.round(outline.x0 + 0.7 * (outline.x1 - outline.x0))
  type Row = { y: number; a: number; b: number; left: EndKind; right: EndKind }
  const rows: Row[] = []
  const stats = { rows: 0, left: { CLEAN: 0, OCCLUDED: 0, CUT: 0 }, right: { CLEAN: 0, OCCLUDED: 0, CUT: 0 } }
  for (let y = roi.y0; y <= roi.y1; y += 1) {
    // runs of built-or-vegetation pixels; the facade run is the one covering most of the outline's middle
    let best: { a: number; b: number; cover: number } | undefined
    let x = roi.x0
    while (x <= roi.x1) {
      if (at(x, y) === 1) {
        x += 1
        continue
      }
      const a = x
      while (x + 1 <= roi.x1 && at(x + 1, y) !== 1) x += 1
      const b = x
      const cover = Math.max(0, Math.min(b, cx1) - Math.max(a, cx0) + 1)
      if (cover > 0 && (!best || cover > best.cover)) best = { a, b, cover }
      x += 1
    }
    if (!best || best.cover < 0.5 * (cx1 - cx0)) continue
    // vegetation at an end is an occluder: trim it, and the end behind it is OCCLUDED
    let { a, b } = best
    let left: EndKind = a <= roi.x0 ? 'CUT' : 'CLEAN'
    let right: EndKind = b >= roi.x1 ? 'CUT' : 'CLEAN'
    if (at(a, y) === 2) {
      while (a < b && at(a, y) === 2) a += 1
      left = 'OCCLUDED'
    }
    if (at(b, y) === 2) {
      while (b > a && at(b, y) === 2) b -= 1
      right = 'OCCLUDED'
    }
    if (left === 'CLEAN' && at(a - 1, y) === 2) left = 'OCCLUDED'
    if (right === 'CLEAN' && at(b + 1, y) === 2) right = 'OCCLUDED'
    rows.push({ y, a, b, left, right })
    stats.rows += 1
    stats.left[left] += 1
    stats.right[right] += 1
  }
  const unsupported = ['OPENING_EDGE', 'GARAGE_GATE', 'ROOF_PLANE', 'DIMENSION_INK', 'DECORATIVE_CLADDING', 'PERGOLA (named only as a refused edge)']
  if (rows.length < 10) return { version: FACADE_ANCHORS_VERSION, roi, wallEnds: { state: 'UNKNOWN', why: `only ${rows.length} rows of the outline hold a built run over its middle: the facade is not separated from the background (a white wall on a white ground has no edge to read)` }, anchors: [], candidates: [], rowStats: stats, unsupported }
  const ground = rows[rows.length - 1].y
  const top = rows[0].y
  const height = Math.max(1, ground - top)
  const byY = new Map(rows.map((x) => [x.y, x]))

  // vertical edges: CLEAN ends chained over consecutive rows on (nearly) one column
  const edges = (side: 'LEFT' | 'RIGHT'): EdgeCandidate[] => {
    const chains: Array<Array<{ y: number; x: number }>> = []
    let cur: Array<{ y: number; x: number }> = []
    let prev: { y: number; x: number } | undefined
    for (const row of rows) {
      const kind = side === 'LEFT' ? row.left : row.right
      const x = side === 'LEFT' ? row.a : row.b
      if (kind === 'CLEAN' && prev && row.y - prev.y <= 2 && Math.abs(x - prev.x) <= CHAIN_STEP) cur.push({ y: row.y, x })
      else {
        if (cur.length > 0) chains.push(cur)
        cur = kind === 'CLEAN' ? [{ y: row.y, x }] : []
      }
      prev = kind === 'CLEAN' ? { y: row.y, x } : undefined
    }
    if (cur.length > 0) chains.push(cur)
    // a chain that turns — a wall end running on into a flush roof's slope — is split where it leaves its foot's
    // column: the vertical part below and the rest above are judged apart
    const pieces: Array<Array<{ y: number; x: number }>> = []
    for (const c of chains) {
      const foot = [...c.slice(-10).map((p) => p.x)].sort((p, q) => p - q)[Math.floor(Math.min(10, c.length) / 2)]
      let k = c.length
      while (k > 0 && Math.abs(c[k - 1].x - foot) <= 1) k -= 1
      if (k > 0 && c.length - k >= 6) pieces.push(c.slice(0, k), c.slice(k))
      else pieces.push(c)
    }
    const out: EdgeCandidate[] = []
    for (const c of pieces) {
      if (c.length < Math.max(6, MIN_END_SHARE * height)) continue
      const xs = c.map((p) => p.x).sort((p, q) => p - q)
      const xMed = xs[Math.floor(xs.length / 2)]
      // least-squares lean, columns per row
      const my = c.reduce((s, p) => s + p.y, 0) / c.length
      const mx = c.reduce((s, p) => s + p.x, 0) / c.length
      const num = c.reduce((s, p) => s + (p.y - my) * (p.x - mx), 0)
      const den = c.reduce((s, p) => s + (p.y - my) ** 2, 0)
      const lean = den > 0 ? num / den : 0
      const spread = xs[Math.floor(xs.length * 0.9)] - xs[Math.floor(xs.length * 0.1)]
      const y0 = c[0].y
      const y1 = c[c.length - 1].y
      const standsOnGround = ground - y1 <= FOOT_SHARE * height
      // above the edge's top: built pixels running at least as far out cover it (eaves, fascia, a flush roof)
      const out1 = (row: Row | undefined): number | undefined => (row ? (side === 'LEFT' ? row.a : row.b) : undefined)
      let covered: EdgeCandidate['covered'] = 'NOT_COVERED'
      for (let k = 1; k <= Math.max(3, Math.round(0.03 * height)); k += 1) {
        const above = byY.get(y0 - k)
        const e = out1(above)
        if (e === undefined) continue
        const beyond = side === 'LEFT' ? xMed - e : e - xMed
        if (beyond >= 2) {
          covered = 'OVERHANG'
          break
        }
        if (beyond >= -1 && covered === 'NOT_COVERED') covered = 'FLUSH'
      }
      // a straight line on the same column on up through the roof is a cut (the sheet's edge, a section line)
      let through = 0
      for (let y = y0 - 1; y >= top; y -= 1) {
        const e = out1(byY.get(y))
        if (e === undefined || Math.abs(e - xMed) > CHAIN_STEP) break
        through += 1
      }
      const cutLine = covered !== 'OVERHANG' && through >= 0.2 * height
      const vertical = Math.abs(lean) <= MAX_LEAN
      const accepted = vertical && standsOnGround && covered !== 'NOT_COVERED' && !cutLine
      const why = !vertical
        ? `the edge leans ${lean.toFixed(3)} columns per row over ${c.length} rows: not an orthographic wall end (a perspective)`
        : !standsOnGround
          ? `the edge ends ${ground - y1} px above the facade's foot (more than a plinth): the top of something standing before or beside the wall — a screen, a balcony, a door — not a wall end`
          : covered === 'NOT_COVERED'
            ? 'nothing built runs over its top: it stands past the roof (a pergola post, a screen, a fence), not under it'
            : cutLine
              ? `the same column runs on ${through} rows up through the roof: a cut line (the sheet's or a section's edge), not a wall end`
              : `a vertical edge over ${c.length} rows, standing on the ground and ${covered === 'OVERHANG' ? 'under the eaves' : 'flush with the roof'}`
      out.push({ side, x: xMed, y0, y1, rows: c.length, lean: Math.round(lean * 1e4) / 1e4, spreadPx: spread, covered, standsOnGround, cutLine, accepted, why })
    }
    return out
  }
  const candidates = [...edges('LEFT'), ...edges('RIGHT')]
  const anchors: FacadeAnchor[] = candidates.map((c) => ({ type: 'OUTER_WALL_END', px: { x: c.x, y0: c.y0, y1: c.y1 }, uncertaintyPx: Math.max(1, c.spreadPx), support: `${c.rows} rows, lean ${c.lean}, ${c.covered.toLowerCase()}`, accepted: c.accepted, why: c.why }))
  const occludedL = stats.left.OCCLUDED
  const occludedR = stats.right.OCCLUDED
  if (occludedL + occludedR > 0) anchors.push({ type: 'OCCLUDER', px: { y0: top, y1: ground }, uncertaintyPx: 0, support: `${occludedL} rows end in vegetation on the left, ${occludedR} on the right`, accepted: false, why: 'vegetation stands at the end of the facade on those rows: the wall behind it is not seen there' })
  const goodL = candidates.filter((c) => c.side === 'LEFT' && c.accepted)
  const goodR = candidates.filter((c) => c.side === 'RIGHT' && c.accepted)
  let wallEnds: FacadeAnchorReading['wallEnds']
  const sideWhy = (side: 'LEFT' | 'RIGHT', good: EdgeCandidate[]): string => {
    const all = candidates.filter((c) => c.side === side)
    const occl = side === 'LEFT' ? occludedL : occludedR
    if (good.length > 1) return `${good.length} edges on the ${side.toLowerCase()} qualify as a wall end (columns ${good.map((c) => c.x).join(', ')}): which is the outer wall is not decided`
    if (occl > 0.3 * stats.rows) return `the ${side.toLowerCase()} end is hidden by vegetation on ${occl} of ${stats.rows} rows: OCCLUDED${all.length > 0 ? ` (no other edge qualifies: ${all.length} leaning or uncovered)` : ''}`
    if (all.length === 0) return `no vertical edge runs on the ${side.toLowerCase()} over a quarter of the facade's height`
    // the edges that came closest first: vertical ones, then by length
    const ranked = [...all].sort((p, q) => Number(Math.abs(p.lean) > MAX_LEAN) - Number(Math.abs(q.lean) > MAX_LEAN) || q.rows - p.rows)
    return `no ${side.toLowerCase()} edge qualifies: ${ranked.map((c) => `column ${c.x} — ${c.why}`).join('; ')}`
  }
  // the walls' rows: from the eaves' level to the ground, where the sheet's margins disagree it is cut or pasted
  const wallRows = rows.filter((x) => x.y >= top + 0.3 * height)
  const differ = wallRows.filter((x) => classes.marginsDiffer[x.y] === 1).length
  const lowGap = outline.y1 - ground
  if (differ > 0.5 * wallRows.length) wallEnds = { state: 'REFUSED', why: `on ${differ} of ${wallRows.length} wall rows the sheet's left and right margins are two different backgrounds: the sheet is cut or pasted on one side, so an end against it may be the cut` }
  else if (goodL.length + goodR.length < 2 && lowGap > 0.1 * (outline.y1 - outline.y0)) wallEnds = { state: 'UNKNOWN', why: `below row ${ground} (${lowGap} px above the outline's foot) no built run spans the outline's middle: the walls are not separated from the background (a wall of the background's colour with no line drawn at its ends)` }
  else if (goodL.length === 1 && goodR.length === 1) {
    const [l, rr] = [goodL[0], goodR[0]]
    wallEnds = { state: 'ACCEPTED', x0: l.x, x1: rr.x, uncertaintyPx: Math.max(1, l.spreadPx, rr.spreadPx), why: `wall ends at columns ${l.x} and ${rr.x}: ${l.why}; ${rr.why}` }
  } else wallEnds = { state: 'REFUSED', why: [goodL.length === 1 ? undefined : sideWhy('LEFT', goodL), goodR.length === 1 ? undefined : sideWhy('RIGHT', goodR)].filter(Boolean).join('; ') }
  const foot = wallEnds.state === 'ACCEPTED' ? Math.round(([...goodL, ...goodR].reduce((s, c) => s + c.y1, 0)) / 2) : ground
  const eave = wallEnds.state === 'ACCEPTED' ? Math.min(goodL[0].y0, goodR[0].y0) : undefined
  anchors.push({ type: 'GROUND_LINE', px: { y: foot }, uncertaintyPx: Math.max(1, Math.round(FOOT_SHARE * height)), support: wallEnds.state === 'ACCEPTED' ? 'the wall ends’ feet' : 'the facade’s lowest built row', accepted: wallEnds.state === 'ACCEPTED', why: wallEnds.state === 'ACCEPTED' ? 'the wall ends stand on it' : 'the lowest row of the facade, not corroborated by a wall end' })
  if (eave !== undefined) anchors.push({ type: 'EAVE', px: { y: eave }, uncertaintyPx: 2, support: 'the wall ends’ tops, covered by the roof', accepted: true, why: 'the row where the walls meet what covers them' })
  // the apex over the walls: the topmost built row per column between the wall ends; narrow spikes are chimneys
  let apex: FacadeAnchorReading['apex']
  if (wallEnds.state === 'ACCEPTED' && eave !== undefined) {
    const x0 = wallEnds.x0 as number
    const x1 = wallEnds.x1 as number
    const profile: Array<{ x: number; y: number }> = []
    for (let x = x0; x <= x1; x += 1) {
      let y = roi.y0
      while (y < eave && at(x, y) !== 0) y += 1
      if (y < eave) profile.push({ x, y })
    }
    const spike = Math.max(3, Math.round(0.08 * (x1 - x0)))
    const ys = profile.map((p) => p.y)
    const topRow = Math.min(...ys)
    // the roof's top: the highest row reached by more than a spike's width of columns
    const sorted = [...ys].sort((p, q) => p - q)
    const roofTop = sorted[Math.min(sorted.length - 1, spike)]
    const spikes = profile.filter((p) => p.y < roofTop - 2)
    if (spikes.length > 0) {
      const sx0 = Math.min(...spikes.map((p) => p.x))
      const sx1 = Math.max(...spikes.map((p) => p.x))
      anchors.push({ type: 'CHIMNEY', px: { x0: sx0, x1: sx1, y0: topRow, y1: roofTop }, uncertaintyPx: 2, support: `${spikes.length} columns rise over the roof's top`, accepted: false, why: `narrower than ${spike} columns: a chimney, an aerial or a tree top — never the ridge` })
    }
    apex = profile.length > 10 ? { row: roofTop, method: 'TOPMOST_ROOF_ROW_EXCLUDING_SPIKES' } : { why: 'no roof stands over the walls' }
    if ('row' in apex) anchors.push({ type: 'RIDGE', px: { y: apex.row }, uncertaintyPx: 2, support: `the topmost row over more than ${spike} columns`, accepted: true, why: 'the roof’s apex over the walls, chimneys left out' })
  } else apex = { why: 'no wall ends: the roof’s apex is not placed over them' }
  if (wallEnds.state !== 'ACCEPTED') anchors.push({ type: 'UNCERTAIN', px: { x0: roi.x0, x1: roi.x1, y0: top, y1: ground }, uncertaintyPx: 0, support: wallEnds.why.slice(0, 200), accepted: false, why: 'the facade’s extent on this sheet is not decided' })
  return { version: FACADE_ANCHORS_VERSION, roi, wallEnds, groundRow: foot, ...(eave !== undefined ? { eaveRow: eave } : {}), apex, anchors, candidates, rowStats: stats, unsupported }
}
