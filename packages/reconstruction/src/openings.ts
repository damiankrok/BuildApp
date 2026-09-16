/**
 * Turning detected rectangles into architectural openings.
 *
 * A rectangle detector run over a facade does not return windows. It returns
 * every closed rectangle it can see, and a window is usually several of them:
 * the reveal, the frame inside it, the sashes inside that, and one rectangle
 * per pane. A run of glazing divided by mullions is a row of rectangles that
 * share their top and bottom edges. A clad wall is a field of rectangles that
 * share nothing but their rhythm.
 *
 * §12 is explicit about what to do with all of that: nested rectangles inside
 * one assembly are ONE opening, a mullion is not another opening, and a
 * cladding rectangle is not a window at all. So this module groups first and
 * measures second.
 *
 * Grouping is by ADJACENCY IN THE BUILDING, not by appearance:
 *
 * - one rectangle inside another is the same hole seen twice;
 * - two rectangles that overlap are the same hole found twice;
 * - two rectangles that line up along one axis and are separated by less than
 *   a mullion's width are two lights of one window;
 * - a rectangle that belongs to a large, regular field of rectangles of the
 *   same size is cladding, and is refused outright.
 *
 * Everything refused is named, because a window the pipeline decided was
 * cladding is exactly the sort of decision a reviewer has to be able to find.
 */
import { round6 } from '@buildapp/source-common'

/** A rectangle on a facade, in metres: along the wall and up it. */
export type FacadeRect = { u0: number; v0: number; u1: number; v1: number }

export type OpeningPiece<T> = { rect: FacadeRect; source: T }

export type OpeningAssembly<T> = {
  rect: FacadeRect
  pieces: Array<OpeningPiece<T>>
  /** How many rectangles were merged: 1 is a plain hole, more is an assembly. */
  merged: number
  why: string
}

export type OpeningGroupingOptions = {
  /** The widest a bar between two lights of one window may be, in metres. */
  mullionM?: number
  /** How much two rectangles must line up across the joint to count as lights of one window, 0..1. */
  alignment?: number
  /** A field of at least this many equal rectangles at an even rhythm is cladding. */
  claddingRun?: number
  /** How far two spacings may differ and still count as the same rhythm, as a fraction. */
  rhythmTolerance?: number
}

const DEFAULTS: Required<OpeningGroupingOptions> = { mullionM: 0.16, alignment: 0.6, claddingRun: 4, rhythmTolerance: 0.25 }

const widthOf = (r: FacadeRect): number => r.u1 - r.u0
const heightOf = (r: FacadeRect): number => r.v1 - r.v0
const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
const areaOf = (r: FacadeRect): number => Math.max(0, widthOf(r)) * Math.max(0, heightOf(r))

const union = (a: FacadeRect, b: FacadeRect): FacadeRect => ({ u0: Math.min(a.u0, b.u0), v0: Math.min(a.v0, b.v0), u1: Math.max(a.u1, b.u1), v1: Math.max(a.v1, b.v1) })

/** Two rectangles that are the same hole, or two lights of one window. */
export function sameAssembly(a: FacadeRect, b: FacadeRect, options: OpeningGroupingOptions = {}): { joined: boolean; why: string } {
  const opt = { ...DEFAULTS, ...options }
  const across = overlap(a.u0, a.u1, b.u0, b.u1)
  const up = overlap(a.v0, a.v1, b.v0, b.v1)
  const inter = across * up
  const smaller = Math.min(areaOf(a), areaOf(b))
  if (smaller <= 0) return { joined: false, why: 'one of them has no area' }
  if (inter / smaller >= 0.7) return { joined: true, why: 'one rectangle lies inside the other: a frame drawn inside its own reveal, or the same hole found twice' }
  if (inter > 0 && inter / Math.max(1e-9, areaOf(a) + areaOf(b) - inter) >= 0.15) return { joined: true, why: 'the two rectangles overlap: two readings of one hole' }
  // Two lights of one window are the same SIZE across the joint as well as
  // aligned along it. A band running the width of a facade over a window is
  // aligned with it and is not a light of it, and merging the two turns a
  // 1.8 m window into a 9.6 m one.
  const comparableHeight = Math.min(heightOf(a), heightOf(b)) / Math.max(1e-9, Math.max(heightOf(a), heightOf(b))) >= 0.5
  const comparableWidth = Math.min(widthOf(a), widthOf(b)) / Math.max(1e-9, Math.max(widthOf(a), widthOf(b))) >= 0.5
  // Side by side, with a bar between them.
  const gapAcross = Math.max(a.u0, b.u0) - Math.min(a.u1, b.u1)
  if (comparableHeight && up / Math.min(heightOf(a), heightOf(b)) >= opt.alignment && gapAcross >= -0.01 && gapAcross <= opt.mullionM) {
    return { joined: true, why: `they line up over ${round6(up)} m of height with ${round6(Math.max(0, gapAcross))} m between them: two lights of one window, not two windows` }
  }
  // Stacked, with a transom between them.
  const gapUp = Math.max(a.v0, b.v0) - Math.min(a.v1, b.v1)
  if (comparableWidth && across / Math.min(widthOf(a), widthOf(b)) >= opt.alignment && gapUp >= -0.01 && gapUp <= opt.mullionM) {
    return { joined: true, why: `they line up over ${round6(across)} m of width with ${round6(Math.max(0, gapUp))} m between them: a window with a transom, not two windows` }
  }
  return { joined: false, why: 'they neither overlap nor line up close enough to be one assembly' }
}

/**
 * Rectangles that belong to a regular field rather than to a building.
 *
 * Cladding, a louvre, a run of boarding, a rendered panel grid: many
 * rectangles of nearly the same size, at nearly the same spacing, along one
 * axis. Windows do come in rows, which is why the run has to be long and the
 * rhythm has to be even — three windows at a regular spacing is a house, and
 * eleven identical rectangles 0.2 m apart is a wall.
 */
export function claddingField<T>(pieces: ReadonlyArray<OpeningPiece<T>>, options: OpeningGroupingOptions = {}): Set<number> {
  const opt = { ...DEFAULTS, ...options }
  const refused = new Set<number>()
  const axes: Array<'u' | 'v'> = ['u', 'v']
  for (const axis of axes) {
    const sorted = pieces
      .map((p, index) => ({ index, p }))
      .sort((a, b) => (axis === 'u' ? a.p.rect.u0 - b.p.rect.u0 : a.p.rect.v0 - b.p.rect.v0))
    let run: Array<{ index: number; p: OpeningPiece<T> }> = []
    const flush = (): void => {
      if (run.length < opt.claddingRun) {
        run = []
        return
      }
      const gaps: number[] = []
      for (let i = 0; i + 1 < run.length; i += 1) {
        gaps.push(axis === 'u' ? run[i + 1].p.rect.u0 - run[i].p.rect.u0 : run[i + 1].p.rect.v0 - run[i].p.rect.v0)
      }
      const mean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)
      const even = mean > 0 && gaps.every((g) => Math.abs(g - mean) <= mean * opt.rhythmTolerance)
      if (even) for (const member of run) refused.add(member.index)
      run = []
    }
    for (const entry of sorted) {
      const last = run[run.length - 1]
      if (!last) {
        run = [entry]
        continue
      }
      const sizeAlike =
        Math.abs(widthOf(entry.p.rect) - widthOf(last.p.rect)) <= Math.max(0.05, widthOf(last.p.rect) * 0.2) &&
        Math.abs(heightOf(entry.p.rect) - heightOf(last.p.rect)) <= Math.max(0.05, heightOf(last.p.rect) * 0.2)
      const lined =
        axis === 'u'
          ? overlap(entry.p.rect.v0, entry.p.rect.v1, last.p.rect.v0, last.p.rect.v1) >= Math.min(heightOf(entry.p.rect), heightOf(last.p.rect)) * 0.7
          : overlap(entry.p.rect.u0, entry.p.rect.u1, last.p.rect.u0, last.p.rect.u1) >= Math.min(widthOf(entry.p.rect), widthOf(last.p.rect)) * 0.7
      if (sizeAlike && lined) run.push(entry)
      else {
        flush()
        run = [entry]
      }
    }
    flush()
  }
  return refused
}

/**
 * Group one facade's rectangles into architectural openings.
 *
 * Transitive: a window whose frame touches its reveal and whose reveal touches
 * its neighbour's is one assembly, because that is what it is on the building.
 */
export function groupFacadeOpenings<T>(pieces: ReadonlyArray<OpeningPiece<T>>, options: OpeningGroupingOptions = {}): { assemblies: Array<OpeningAssembly<T>>; cladding: Array<OpeningPiece<T>> } {
  const cladding = claddingField(pieces, options)
  const kept = pieces.map((p, index) => ({ p, index })).filter(({ index }) => !cladding.has(index))
  const parent = kept.map((_, i) => i)
  const find = (i: number): number => {
    let root = i
    while (parent[root] !== root) root = parent[root]
    let walk = i
    while (parent[walk] !== walk) {
      const next = parent[walk]
      parent[walk] = root
      walk = next
    }
    return root
  }
  const joinReasons = new Map<number, string>()
  for (let i = 0; i < kept.length; i += 1) {
    for (let j = i + 1; j < kept.length; j += 1) {
      const verdict = sameAssembly(kept[i].p.rect, kept[j].p.rect, options)
      if (!verdict.joined) continue
      const a = find(i)
      const b = find(j)
      if (a === b) continue
      parent[b] = a
      if (!joinReasons.has(a)) joinReasons.set(a, verdict.why)
    }
  }
  const groups = new Map<number, Array<OpeningPiece<T>>>()
  for (let i = 0; i < kept.length; i += 1) {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), kept[i].p])
  }
  const assemblies: Array<OpeningAssembly<T>> = []
  for (const [root, members] of groups) {
    const rect = members.map((m) => m.rect).reduce((a, b) => union(a, b))
    assemblies.push({
      rect: { u0: round6(rect.u0), v0: round6(rect.v0), u1: round6(rect.u1), v1: round6(rect.v1) },
      pieces: members,
      merged: members.length,
      why: members.length === 1 ? 'one rectangle, standing on its own' : `${members.length} rectangles merged into one opening: ${joinReasons.get(root) ?? 'they touch'}`,
    })
  }
  assemblies.sort((a, b) => areaOf(b.rect) - areaOf(a.rect) || a.rect.u0 - b.rect.u0 || a.rect.v0 - b.rect.v0)
  return { assemblies, cladding: [...cladding].sort((a, b) => a - b).map((i) => pieces[i]) }
}
