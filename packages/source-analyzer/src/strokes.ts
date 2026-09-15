/**
 * Thin axis-aligned strokes, found strictly.
 *
 * The general line detector in `@buildapp/source-cv` merges a run into the
 * cluster it overlaps by half of the SHORTER of the two, which is the right
 * rule for reassembling one drawn line out of the three rows of pixels it was
 * rendered as. It is the wrong rule next to a blob: on a published plan the
 * stair's tread strokes run within a few pixels of a planting symbol, a
 * furniture hatch or a room number, and a chain of half-overlaps walks from
 * the tread into the blob and back out, producing one cluster twenty pixels
 * thick that the thickness test then throws away — tread and blob together.
 *
 * Here the rule is the strict one: a run joins a cluster only when it overlaps
 * by most of the LONGER of the two, and the cluster is abandoned the moment it
 * grows thicker than a drawn line. Strokes that survive are thin, straight and
 * of a definite length, which is what a tread, a tread nosing, a dimension
 * tick and a louvre blade all are — and what a blob is not.
 *
 * This is deliberately narrower than the general detector rather than a
 * replacement for it: the two are used together, and the stair reader is fed
 * both.
 */
import { round6, segmentAngleDeg, segmentLength } from '@buildapp/source-common'
import { maskAt } from '@buildapp/source-cv'
import type { Mask, Segment } from '@buildapp/source-cv'

export type StrokeOptions = {
  minLength?: number
  maxLength?: number
  /** A stroke thicker than this across is a band, not a line. */
  maxThickness?: number
  /** Gaps this long along a stroke are bridged: a drawn line may be dashed. */
  maxGap?: number
  /** How much of the longer of two runs must overlap for them to be the same stroke. */
  minOverlap?: number
}

const DEFAULTS: Required<StrokeOptions> = { minLength: 8, maxLength: Number.POSITIVE_INFINITY, maxThickness: 4, maxGap: 1, minOverlap: 0.8 }

type Cluster = { lo: number; hi: number; first: number; last: number; support: number }

function runsInLine(mask: Mask, index: number, horizontal: boolean, minRun: number, maxGap: number): Array<[number, number]> {
  const count = horizontal ? mask.width : mask.height
  const out: Array<[number, number]> = []
  let start = -1
  let last = -1
  for (let k = 0; k < count; k += 1) {
    const on = horizontal ? maskAt(mask, k, index) : maskAt(mask, index, k)
    if (on !== 1) continue
    if (start < 0) {
      start = k
      last = k
    } else if (k - last - 1 <= maxGap) {
      last = k
    } else {
      if (last - start + 1 >= minRun) out.push([start, last])
      start = k
      last = k
    }
  }
  if (start >= 0 && last - start + 1 >= minRun) out.push([start, last])
  return out
}

function strokesInDirection(mask: Mask, horizontal: boolean, opt: Required<StrokeOptions>): Segment[] {
  const major = horizontal ? mask.height : mask.width
  const minRun = Math.max(2, Math.ceil(opt.minLength))
  const out: Segment[] = []
  let active: Cluster[] = []

  const close = (c: Cluster): void => {
    const length = c.hi - c.lo
    if (length + 1 < opt.minLength || length + 1 > opt.maxLength) return
    if (c.last - c.first + 1 > opt.maxThickness) return
    const mid = (c.first + c.last) / 2
    const a = horizontal ? { x: round6(c.lo), y: round6(mid) } : { x: round6(mid), y: round6(c.lo) }
    const b = horizontal ? { x: round6(c.hi), y: round6(mid) } : { x: round6(mid), y: round6(c.hi) }
    out.push({ a, b, angleDeg: segmentAngleDeg(a, b), length: segmentLength(a, b), support: c.support })
  }

  for (let i = 0; i < major; i += 1) {
    const runs = runsInLine(mask, i, horizontal, minRun, opt.maxGap)
    const next: Cluster[] = []
    for (const [lo, hi] of runs) {
      const length = hi - lo + 1
      let target: Cluster | null = null
      for (const c of active) {
        const overlap = Math.min(hi, c.hi) - Math.max(lo, c.lo) + 1
        const longer = Math.max(length, c.hi - c.lo + 1)
        if (overlap > 0 && overlap >= longer * opt.minOverlap) {
          target = c
          break
        }
      }
      if (target && target.last - target.first + 1 < opt.maxThickness) {
        target.lo = Math.min(target.lo, lo)
        target.hi = Math.max(target.hi, hi)
        target.last = i
        target.support += length
        next.push(target)
      } else {
        // A run that cannot extend a cluster starts its own; the cluster it
        // touched is finished here rather than absorbed, so a stroke running
        // into a blob ends at the blob instead of becoming one.
        if (target) {
          close(target)
          active = active.filter((c) => c !== target)
        }
        next.push({ lo, hi, first: i, last: i, support: length })
      }
    }
    for (const c of active) if (!next.includes(c)) close(c)
    active = next
  }
  for (const c of active) close(c)

  // Deterministic order, independent of the scan.
  out.sort((p, q) => p.a.x - q.a.x || p.a.y - q.a.y || p.b.x - q.b.x || p.b.y - q.b.y)
  return out
}

/** Every thin horizontal and vertical stroke in a mask. */
export function thinStrokes(mask: Mask, options: StrokeOptions = {}): Segment[] {
  const opt = { ...DEFAULTS, ...options }
  return [...strokesInDirection(mask, true, opt), ...strokesInDirection(mask, false, opt)]
}
