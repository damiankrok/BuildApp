/**
 * The external numeric recogniser heard on plan CALLOUT RINGS — the circled `width / height` printed beside each
 * opening and each rooflight.
 *
 * Why the gates below are what they are: measured on 142 hand-read rings from five publisher houses, the template reader of `callouts.ts` read 63 rings exactly, the pinned PP-OCRv6 tiny 104; every ring whose two
 * halves the recogniser read CONFIDENTLY (stable under the bracket, posterior and mean character probability at least
 * `OCR_ENSEMBLE_BOUNDS`, its own greedy answer) was right, and the only confident wrong HALVES dropped a leading digit
 * (`105` read `5`, `118` read `18`, `230` read `30`). So a half is accepted here only when
 *   - it is confident in that sense,
 *   - it reads two or three digits,
 *   - the ink it was cut from holds no more glyphs than the digits it read (a dropped digit leaves its ink behind), and
 *   - the value is a size an opening can have (`CALLOUT_RANGE_CM`; the reconstruction's own range for a callout);
 * and a ring is read only when BOTH halves are. Anything less leaves the template reading as it was.
 *
 * Image only, like every recogniser input: the crops are the ring's own pixels — the disc inside the ring, normalised to
 * its own paper, split at the printed bar, tightened to the ink and padded as `cropForToken` pads. No scale, plan gap,
 * elevation or other reading reaches the recogniser; the plan gap that later picks among a ring's readings is an
 * independent witness of the reading, not an input to it.
 */
import type { Gray, Raster } from '@buildapp/source-cv'
import { inkChannel } from '@buildapp/source-cv'
import { round6 } from '@buildapp/source-common'
import { OCR_ENSEMBLE_BOUNDS } from './ensemble.js'
import { RECOGNISER_CROP } from './recogniser.js'
import type { ExternalReading, LabelCrop } from './recogniser.js'

export const CALLOUT_RECOGNISER_NAME = 'metrics.callout-recogniser' as const
export const CALLOUT_RECOGNISER_VERSION = '1' as const

/** A printed callout's half is an opening's width or height in centimetres: 40 cm .. 7 m wide, 40 cm .. 4 m tall. */
export const CALLOUT_RANGE_CM = { width: { min: 40, max: 700 }, height: { min: 40, max: 400 } } as const

/** Ink darker than this (on the disc's paper normalised to 255) is a digit's. The probe's threshold. */
const INK_BELOW = 170

/** One half of a ring, cut for the recogniser, with the count of separate glyphs its ink holds. */
export type RingHalfCrop = { crop: LabelCrop; glyphs: number }

/**
 * The two halves of a barred ring as the recogniser sees them: ink dark on paper 255, the ring itself and the bar left
 * out (the disc is cut 2.5 px inside the ring, the halves 2 px clear of the bar), tightened to the ink box and padded as
 * `cropForToken` pads. A half with no ink is null.
 */
export function ringHalfCrops(ink: Gray, circle: { cx: number; cy: number; radiusPx: number }, barY: number, keyPrefix: string): { upper: RingHalfCrop | null; lower: RingHalfCrop | null } {
  const cx = Math.round(circle.cx)
  const cy = Math.round(circle.cy)
  const r = Math.round(circle.radiusPx)
  const bar = Math.round(barY)
  const g = (x: number, y: number): number => (x < 0 || y < 0 || x >= ink.width || y >= ink.height ? 255 : ink.data[y * ink.width + x])
  const inner = r - 2.5
  // The disc's own paper — tinted or white — is the 85th percentile of its interior.
  const vals: number[] = []
  for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) if (Math.hypot(x - cx, y - cy) <= inner) vals.push(g(x, y))
  vals.sort((a, b) => a - b)
  const paper = Math.max(1, vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.85))] ?? 255)
  const norm = (v: number): number => Math.max(0, Math.min(255, Math.round((255 * v) / paper)))
  const inside = (x: number, y: number, y0: number, y1: number): boolean => y >= y0 && y <= y1 && Math.hypot(x - cx, y - cy) <= inner
  const cut = (y0: number, y1: number, key: string): RingHalfCrop | null => {
    let bx0 = Infinity
    let by0 = Infinity
    let bx1 = -Infinity
    let by1 = -Infinity
    for (let y = y0; y <= y1; y += 1)
      for (let x = cx - r; x <= cx + r; x += 1) {
        if (!inside(x, y, y0, y1) || norm(g(x, y)) >= INK_BELOW) continue
        bx0 = Math.min(bx0, x)
        by0 = Math.min(by0, y)
        bx1 = Math.max(bx1, x)
        by1 = Math.max(by1, y)
      }
    if (!Number.isFinite(bx0)) return null
    const h = by1 - by0 + 1
    const m = Math.max(RECOGNISER_CROP.minPadPx, Math.round(RECOGNISER_CROP.padShare * h))
    const X0 = bx0 - m
    const Y0 = by0 - m
    const W = bx1 - bx0 + 1 + 2 * m
    const H = h + 2 * m
    const data = new Uint8ClampedArray(W * H).fill(255)
    for (let y = 0; y < H; y += 1)
      for (let x = 0; x < W; x += 1) {
        const sx = X0 + x
        const sy = Y0 + y
        if (inside(sx, sy, y0, y1)) data[y * W + x] = norm(g(sx, sy))
      }
    const gray: Gray = { width: W, height: H, data }
    return { crop: { key, gray, capPx: h }, glyphs: glyphCount(gray) }
  }
  return { upper: cut(cy - r, bar - 2, `${keyPrefix}u`), lower: cut(bar + 2, cy + r, `${keyPrefix}l`) }
}

/**
 * How many glyphs a half's ink holds: its 8-connected ink components of at least 3 px, those whose column spans overlap
 * by half the narrower one, or touching with no clear column between them, merged (a digit broken across its waist
 * or along a pale stroke is one glyph). Digits of a callout are printed apart,
 * so a reading with fewer digits than this left a glyph unread.
 */
export function glyphCount(g: Gray): number {
  const { width: W, height: H, data } = g
  const lab = new Int32Array(W * H).fill(-1)
  const spans: Array<{ x0: number; x1: number }> = []
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      if (lab[y * W + x] !== -1 || data[y * W + x] >= INK_BELOW) continue
      const id = spans.length
      let x0 = x
      let x1 = x
      let size = 0
      const stack = [y * W + x]
      lab[y * W + x] = id
      while (stack.length) {
        const i = stack.pop() as number
        const px = i % W
        const py = (i - px) / W
        size += 1
        x0 = Math.min(x0, px)
        x1 = Math.max(x1, px)
        for (let dy = -1; dy <= 1; dy += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = px + dx
            const ny = py + dy
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
            const j = ny * W + nx
            if (lab[j] === -1 && data[j] < INK_BELOW) {
              lab[j] = id
              stack.push(j)
            }
          }
      }
      spans.push(size >= 3 ? { x0, x1 } : { x0: Infinity, x1: -Infinity })
    }
  const kept = spans.filter((s) => Number.isFinite(s.x0)).sort((a, b) => a.x0 - b.x0)
  const merged: Array<{ x0: number; x1: number }> = []
  for (const s of kept) {
    const last = merged[merged.length - 1]
    const overlap = last ? Math.min(last.x1, s.x1) - Math.max(last.x0, s.x0) + 1 : 0
    // 005Y-N5: pieces in touching columns are one glyph too. Digits are printed with a clear column between them; a
    // pale anti-aliased stroke (the diagonal of a small 4 on a tinted disc) breaks off its digit with no gap at all.
    if (last && (overlap >= 0.5 * Math.min(last.x1 - last.x0 + 1, s.x1 - s.x0 + 1) || s.x0 <= last.x1 + 1)) {
      last.x0 = Math.min(last.x0, s.x0)
      last.x1 = Math.max(last.x1, s.x1)
    } else merged.push({ ...s })
  }
  return merged.length
}

/**
 * A half that fails the gate ONLY on the stability bracket, on a ring whose other half passed, is accepted when another
 * ring on the same sheet was accepted outright with exactly the same two readings: a second, independent read of other
 * ink saying the same. The rest of the gate (posterior, mean, own answer, every glyph read, range) still holds.
 */
export function corroborateBySibling(rings: ReadonlyArray<{ id: string; width: CalloutHalfVerdict; height: CalloutHalfVerdict; accepted: boolean; unstableOnly: { width: boolean; height: boolean } }>): Map<string, { width: CalloutHalfVerdict; height: CalloutHalfVerdict }> {
  const out = new Map<string, { width: CalloutHalfVerdict; height: CalloutHalfVerdict }>()
  const outright = rings.filter((r) => r.accepted)
  for (const r of rings) {
    if (r.accepted) continue
    const wOk = r.width.accepted || r.unstableOnly.width
    const hOk = r.height.accepted || r.unstableOnly.height
    if (!wOk || !hOk) continue
    const sibling = outright.find((k) => k.id !== r.id && k.width.text === r.width.text && k.height.text === r.height.text)
    if (!sibling) continue
    const lift = (h: CalloutHalfVerdict, unstable: boolean): CalloutHalfVerdict => (unstable && !h.accepted ? { ...h, valueCm: Number(h.text), accepted: true, why: `not stable under the bracket, but ${sibling.id} on this sheet reads ${sibling.width.text}/${sibling.height.text} outright` } : h)
    out.set(r.id, { width: lift(r.width, r.unstableOnly.width), height: lift(r.height, r.unstableOnly.height) })
  }
  return out
}

/** The mark a gate-refused width candidate carries in its `why`: the reconstruction may take it only where the plan gap agrees. */
export const PLAN_CORROBORATED_WIDTH = 'PLAN_CORROBORATED_WIDTH'

/**
 * 005Y-N5: a width reading the gate refused — not confident, not stable, or with a glyph the count says went unread —
 * that is still two or three digits of an opening's width. It is offered only as a candidate whose acceptance needs a
 * second, independent measurement of the same thing (the plan gap the ring labels), at half its posterior so that a
 * candidate the gate let through outranks it. A dropped digit (118 read as 18) cannot fit the gap it labels.
 * Heights have no such second measurement on a plan, so nothing like this exists for them.
 */
export function planCorroborableWidth(v: CalloutHalfVerdict): { text: string; valueCm: number; confidence: number; why: string } | undefined {
  if (v.accepted || !/^\d{2,3}$/.test(v.text)) return undefined
  const valueCm = Number(v.text)
  const range = CALLOUT_RANGE_CM.width
  if (valueCm < range.min || valueCm > range.max) return undefined
  return { text: v.text, valueCm, confidence: round6(Math.max(0.05, v.p * 0.5)), why: v.why }
}

/** What became of one half's reading. */
export type CalloutHalfVerdict = { text: string; valueCm?: number; p: number; meanP: number; stable: boolean; glyphs: number; accepted: boolean; why: string }

/** The gate one half's reading passes or fails (see the module comment). */
export function judgeCalloutHalf(reading: ExternalReading | undefined, glyphs: number, half: 'width' | 'height'): CalloutHalfVerdict {
  if (!reading) return { text: '', p: 0, meanP: 0, stable: false, glyphs, accepted: false, why: 'not read' }
  const top = reading.topK[0]
  const text = top?.text ?? ''
  const p = round6(top?.p ?? 0)
  const meanP = round6(reading.greedy.meanP)
  const base = { text, p, meanP, stable: reading.stable, glyphs }
  if (!reading.stable) return { ...base, accepted: false, why: 'not stable under the bracket' }
  if (p < OCR_ENSEMBLE_BOUNDS.posterior || meanP < OCR_ENSEMBLE_BOUNDS.meanP) return { ...base, accepted: false, why: `posterior ${p} / mean ${meanP} under ${OCR_ENSEMBLE_BOUNDS.posterior} / ${OCR_ENSEMBLE_BOUNDS.meanP}` }
  if (reading.greedy.text !== text) return { ...base, accepted: false, why: `the model's own answer "${reading.greedy.text}" is not "${text}"` }
  if (!/^\d{2,3}$/.test(text)) return { ...base, accepted: false, why: `"${text}" is not two or three digits` }
  if (glyphs > text.length) return { ...base, accepted: false, why: `the ink holds ${glyphs} glyphs, the reading ${text.length} digits: a digit was not read` }
  const valueCm = Number(text)
  const range = CALLOUT_RANGE_CM[half]
  if (valueCm < range.min || valueCm > range.max) return { ...base, valueCm, accepted: false, why: `${valueCm} cm is not an opening's ${half} (${range.min}..${range.max})` }
  return { ...base, valueCm, accepted: true, why: 'confident, stable, its own answer, every glyph read' }
}
