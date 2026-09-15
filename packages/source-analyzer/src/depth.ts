/**
 * Telling a solid from a stripe.
 *
 * This is the file the owner's finding about the Marcówki facade comes down
 * to. An elevation drawing and a render both show a long straight member the
 * same way at first glance — two parallel lines with something between them —
 * whether that member is a 300 mm deep concrete frame standing proud of the
 * wall or a band of paint. The reconstruction that came out flat came out flat
 * because nothing in the pipeline had ever been asked to tell those apart.
 *
 * So the test applied here is DEPTH, never colour. A band is promoted to a
 * `LINEAR_VOLUME_CANDIDATE` only when the image carries a cue that it has a
 * third dimension:
 *
 *  - SHADOW — the strip immediately beyond one long side is darker than the
 *    wall further out on that same side, and darker than the corresponding
 *    strip on the opposite side. Something is casting it.
 *  - END_FACE — a narrow strip at one END of the band reads differently from
 *    both the band's own face and the wall beyond it: the member's end is
 *    VISIBLE, which only a body with depth has.
 *  - OCCLUSION_BREAK — a line running across the band stops dead at one long
 *    edge and picks up again, collinear, at the other. It passed behind.
 *  - RETURN_FACE — the interior of the band is split lengthwise into two
 *    strips of different tone: a front face and a side or soffit face seen at
 *    an angle.
 *
 * And one cue that is explicitly NOT enough on its own:
 *
 *  - TONE_STEP — the band's interior differs in tone from the wall on both
 *    sides. True of a proud beam and equally true of a painted band, so it
 *    corroborates and never decides.
 *
 * One cue was tried and REMOVED, because it does not survive contact with a
 * drawing: "the band is closed by a stroke at its end". A painted band's
 * colour also stops, and stopping draws exactly the same line. What the test
 * below asks instead is whether the end shows a FACE — a strip of its own
 * tone — which a stripe has no way to produce.
 *
 * A band with no depth cue is still recorded — as a `SURFACE_REGION`, which is
 * exactly what it looks like. Nothing is discarded; the two are distinguished.
 * That distinction is what makes "the frame is really a colour change" a
 * result the pipeline can state rather than a mistake it makes.
 */
import { rectIoU, round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { Gray, Segment } from '@buildapp/source-cv'

export type DepthCue = 'SHADOW' | 'END_FACE' | 'OCCLUSION_BREAK' | 'RETURN_FACE' | 'TONE_STEP'

/** Cues that can carry a promotion on their own. TONE_STEP cannot. */
export const STRONG_CUES: ReadonlySet<DepthCue> = new Set<DepthCue>(['SHADOW', 'END_FACE', 'OCCLUSION_BREAK', 'RETURN_FACE'])

export type CueEvidence = { cue: DepthCue; strength: number; detail: string }

export type LinearBand = {
  rect: PixelRect
  orientation: 'HORIZONTAL' | 'VERTICAL'
  /** Across the band, in pixels. */
  thickness: number
  /** Along the band, in pixels. */
  length: number
  cues: CueEvidence[]
  /** True when at least one strong cue, or two independent weak ones, back a third dimension. */
  volumetric: boolean
  /** Median tone inside the band, 0..255. */
  interiorTone: number
  /** Median tone just beyond each long side. */
  sideTone: [number, number]
  /** Mean local tone change inside the band: how flat its face is. */
  interiorTexture: number
}

export type BandOptions = {
  /** Thinner than this, across, and it is a drawn line rather than a member. Fraction of the image's larger edge. */
  minThicknessFrac?: number
  /** Thicker than this and it is a wall plane, not a linear member. */
  maxThicknessFrac?: number
  /** Shorter than this, along, and it is not linear. */
  minLengthFrac?: number
  /** A band must be at least this many times longer than it is thick. */
  minAspect?: number
  /** Tone difference, 0..255, that counts as a step. */
  toneDelta?: number
  /** Tone difference, 0..255, that counts as a shadow. */
  shadowDelta?: number
  /**
   * How busy a band's interior may be and still read as a face.
   *
   * A member's front face is a piece of one material and is therefore SMOOTH:
   * render, timber, plaster, glass. Foliage, gravel and a textured background
   * are not, and on a published elevation photograph they generate long
   * straight tone boundaries in quantity — sky against a treeline, a row of
   * canopies, a fence — that pass every geometric test a member passes. The
   * mean gradient inside the band is what separates them, and it is the one
   * test that looks at what the band is MADE of rather than at its shape.
   */
  maxInteriorTexture?: number
  maxBands?: number
}

const DEFAULTS: Required<BandOptions> = { minThicknessFrac: 0.006, maxThicknessFrac: 0.09, minLengthFrac: 0.08, minAspect: 3, toneDelta: 12, shadowDelta: 14, maxInteriorTexture: 11, maxBands: 64 }

const isHorizontal = (s: Segment): boolean => s.angleDeg < 3 || s.angleDeg > 177
const isVertical = (s: Segment): boolean => Math.abs(s.angleDeg - 90) < 3

const grayAtSafe = (g: Gray, x: number, y: number): number => (x < 0 || y < 0 || x >= g.width || y >= g.height ? -1 : g.data[y * g.width + x])

/** Median tone over an inclusive box, ignoring anything off the image. Returns -1 when the box is empty. */
function medianTone(g: Gray, x0: number, y0: number, x1: number, y1: number): number {
  const samples: number[] = []
  const stepX = Math.max(1, Math.floor((x1 - x0 + 1) / 96))
  const stepY = Math.max(1, Math.floor((y1 - y0 + 1) / 96))
  for (let y = Math.max(0, y0); y <= Math.min(g.height - 1, y1); y += stepY) {
    for (let x = Math.max(0, x0); x <= Math.min(g.width - 1, x1); x += stepX) samples.push(g.data[y * g.width + x])
  }
  if (samples.length === 0) return -1
  samples.sort((a, b) => a - b)
  return samples[samples.length >> 1]
}

type Strip = { x0: number; y0: number; x1: number; y1: number }

/** The band's own area, pulled in by one pixel on each long side so the drawn lines themselves are not sampled. */
function interiorStrip(rect: PixelRect, horizontal: boolean): Strip {
  return horizontal ? { x0: rect.x0, y0: rect.y0 + 1, x1: rect.x1, y1: rect.y1 - 1 } : { x0: rect.x0 + 1, y0: rect.y0, x1: rect.x1 - 1, y1: rect.y1 }
}

/** Pull a strip in on every side, so a boundary line does not count as surface texture. */
const insetStrip = (s: Strip, by: number): Strip => ({ x0: s.x0 + by, y0: s.y0 + by, x1: s.x1 - by, y1: s.y1 - by })

/** A strip parallel to the band, `offset` pixels beyond side `side` (0 = low, 1 = high) and `depth` pixels thick. */
function outsideStrip(rect: PixelRect, horizontal: boolean, side: 0 | 1, offset: number, depth: number): Strip {
  if (horizontal) {
    const y = side === 0 ? rect.y0 - offset - depth : rect.y1 + offset
    return { x0: rect.x0, y0: y, x1: rect.x1, y1: y + depth }
  }
  const x = side === 0 ? rect.x0 - offset - depth : rect.x1 + offset
  return { x0: x, y0: rect.y0, x1: x + depth, y1: rect.y1 }
}

const tone = (g: Gray, s: Strip): number => medianTone(g, Math.round(s.x0), Math.round(s.y0), Math.round(s.x1), Math.round(s.y1))

/** Mean local tone change inside a box: how busy the surface is. A flat face is near zero; a treeline is not. */
function texture(g: Gray, s: Strip): number {
  const x0 = Math.max(1, Math.round(s.x0))
  const y0 = Math.max(1, Math.round(s.y0))
  const x1 = Math.min(g.width - 2, Math.round(s.x1))
  const y1 = Math.min(g.height - 2, Math.round(s.y1))
  if (x1 <= x0 || y1 <= y0) return 0
  const stepX = Math.max(1, Math.floor((x1 - x0) / 80))
  const stepY = Math.max(1, Math.floor((y1 - y0) / 80))
  let sum = 0
  let n = 0
  for (let y = y0; y <= y1; y += stepY) {
    for (let x = x0; x <= x1; x += stepX) {
      const i = y * g.width + x
      sum += Math.abs(g.data[i + 1] - g.data[i - 1]) + Math.abs(g.data[i + g.width] - g.data[i - g.width])
      n += 1
    }
  }
  return n === 0 ? 0 : sum / (2 * n)
}

function endFaceCue(g: Gray, rect: PixelRect, horizontal: boolean, thickness: number, toneDelta: number): CueEvidence | null {
  const depth = Math.max(2, Math.min(10, Math.round(thickness * 0.6)))
  const lo = horizontal ? rect.x0 : rect.y0
  const hi = horizontal ? rect.x1 : rect.y1
  if (hi - lo < depth * 3) return null
  const faceStrip = (at: 'LOW' | 'HIGH'): Strip =>
    horizontal
      ? at === 'LOW'
        ? { x0: lo + 1, y0: rect.y0 + 1, x1: lo + depth, y1: rect.y1 - 1 }
        : { x0: hi - depth, y0: rect.y0 + 1, x1: hi - 1, y1: rect.y1 - 1 }
      : at === 'LOW'
        ? { x0: rect.x0 + 1, y0: lo + 1, x1: rect.x1 - 1, y1: lo + depth }
        : { x0: rect.x0 + 1, y0: hi - depth, x1: rect.x1 - 1, y1: hi - 1 }
  const bodyStrip: Strip = horizontal ? { x0: lo + depth + 2, y0: rect.y0 + 1, x1: hi - depth - 2, y1: rect.y1 - 1 } : { x0: rect.x0 + 1, y0: lo + depth + 2, x1: rect.x1 - 1, y1: hi - depth - 2 }
  const beyond = (at: 'LOW' | 'HIGH'): Strip =>
    horizontal
      ? at === 'LOW'
        ? { x0: lo - depth - 2, y0: rect.y0 + 1, x1: lo - 2, y1: rect.y1 - 1 }
        : { x0: hi + 2, y0: rect.y0 + 1, x1: hi + depth + 2, y1: rect.y1 - 1 }
      : at === 'LOW'
        ? { x0: rect.x0 + 1, y0: lo - depth - 2, x1: rect.x1 - 1, y1: lo - 2 }
        : { x0: rect.x0 + 1, y0: hi + 2, x1: rect.x1 - 1, y1: hi + depth + 2 }

  const body = tone(g, bodyStrip)
  if (body < 0) return null
  let best: CueEvidence | null = null
  for (const at of ['LOW', 'HIGH'] as const) {
    const face = tone(g, faceStrip(at))
    const wall = tone(g, beyond(at))
    if (face < 0 || wall < 0) continue
    const vsBody = Math.abs(face - body)
    const vsWall = Math.abs(face - wall)
    if (vsBody < toneDelta || vsWall < toneDelta) continue
    const cue: CueEvidence = {
      cue: 'END_FACE',
      strength: round6(Math.min(0.85, Math.max(0.5, Math.min(vsBody, vsWall) / 70))),
      detail: `the ${at === 'LOW' ? 'near' : 'far'} end of the band shows a strip of its own tone, ${vsBody} levels from the band's face and ${vsWall} from the wall beyond it: the member's end is visible, which a painted stripe has no way to produce`,
    }
    if (!best || cue.strength > best.strength) best = cue
  }
  return best
}

function shadowCue(g: Gray, rect: PixelRect, horizontal: boolean, thickness: number, shadowDelta: number): CueEvidence | null {
  const near = Math.max(2, Math.min(8, Math.round(thickness * 0.5)))
  let best: CueEvidence | null = null
  for (const side of [0, 1] as const) {
    const nearTone = tone(g, outsideStrip(rect, horizontal, side, 1, near))
    const farTone = tone(g, outsideStrip(rect, horizontal, side, 1 + near + 2, near))
    const otherNear = tone(g, outsideStrip(rect, horizontal, side === 0 ? 1 : 0, 1, near))
    if (nearTone < 0 || farTone < 0 || otherNear < 0) continue
    const vsFar = farTone - nearTone
    const vsOther = otherNear - nearTone
    if (vsFar >= shadowDelta && vsOther >= shadowDelta) {
      const strength = Math.min(1, Math.min(vsFar, vsOther) / 60)
      const where = horizontal ? (side === 0 ? 'above' : 'below') : side === 0 ? 'to the left of' : 'to the right of'
      const cue: CueEvidence = { cue: 'SHADOW', strength: round6(Math.max(0.5, strength)), detail: `the strip ${where} the band is ${vsFar} levels darker than the wall beyond it and ${vsOther} darker than the same strip on the other side: a cast shadow` }
      if (!best || cue.strength > best.strength) best = cue
    }
  }
  return best
}

function returnFaceCue(g: Gray, rect: PixelRect, horizontal: boolean, thickness: number, toneDelta: number): CueEvidence | null {
  if (thickness < 6) return null
  const half = Math.floor(thickness / 2)
  const first = horizontal ? { x0: rect.x0, y0: rect.y0 + 1, x1: rect.x1, y1: rect.y0 + half } : { x0: rect.x0 + 1, y0: rect.y0, x1: rect.x0 + half, y1: rect.y1 }
  const second = horizontal ? { x0: rect.x0, y0: rect.y1 - half, x1: rect.x1, y1: rect.y1 - 1 } : { x0: rect.x1 - half, y0: rect.y0, x1: rect.x1 - 1, y1: rect.y1 }
  const a = tone(g, first)
  const b = tone(g, second)
  if (a < 0 || b < 0) return null
  const delta = Math.abs(a - b)
  if (delta < toneDelta * 1.5) return null
  return { cue: 'RETURN_FACE', strength: round6(Math.min(1, Math.max(0.5, delta / 70))), detail: `the band's interior is split lengthwise into two strips ${delta} levels apart in tone: a front face and a side or soffit face seen at an angle` }
}

function occlusionCue(rect: PixelRect, horizontal: boolean, crossing: readonly Segment[]): CueEvidence | null {
  // A line that stops at one long edge and resumes, collinear, at the other.
  const lowEdge = horizontal ? rect.y0 : rect.x0
  const highEdge = horizontal ? rect.y1 : rect.x1
  const across = (s: Segment): { at: number; from: number; to: number } | null => {
    const perpA = horizontal ? s.a.y : s.a.x
    const perpB = horizontal ? s.b.y : s.b.x
    const alongA = horizontal ? s.a.x : s.a.y
    const alongB = horizontal ? s.b.x : s.b.y
    if (Math.abs(alongA - alongB) > 2) return null
    return { at: (alongA + alongB) / 2, from: Math.min(perpA, perpB), to: Math.max(perpA, perpB) }
  }
  const alongLo = horizontal ? rect.x0 : rect.y0
  const alongHi = horizontal ? rect.x1 : rect.y1
  const stubs = crossing.map(across).filter((s): s is { at: number; from: number; to: number } => s !== null && s.at >= alongLo - 2 && s.at <= alongHi + 2)
  for (const a of stubs) {
    if (Math.abs(a.to - lowEdge) > 3) continue
    for (const b of stubs) {
      if (Math.abs(b.from - highEdge) > 3) continue
      if (Math.abs(a.at - b.at) <= 2) {
        return { cue: 'OCCLUSION_BREAK', strength: 0.75, detail: `a line crossing at ${round6(a.at)} stops at one long edge of the band and resumes collinear at the other: it passes behind` }
      }
    }
  }
  return null
}

/**
 * Find the linear bands in a drawing and say, for each, whether the image
 * gives any reason to believe it has depth.
 *
 * `segments` are the drawing's axis-aligned strokes, extracted from the EDGE
 * mask rather than the ink mask: on an ink mask a mid-tone band is one solid
 * region and its two long edges — the thing that makes it a member and gives
 * its thickness — disappear into it. Strokes running across a band carry the
 * occlusion cue.
 */
export function linearBands(g: Gray, segments: readonly Segment[], options: BandOptions = {}): LinearBand[] {
  const opt = { ...DEFAULTS, ...options }
  const larger = Math.max(g.width, g.height)
  const minThickness = Math.max(3, opt.minThicknessFrac * larger)
  const maxThickness = opt.maxThicknessFrac * larger
  const minLength = opt.minLengthFrac * larger

  const bands: LinearBand[] = []
  for (const horizontal of [true, false]) {
    const along = segments.filter((s) => (horizontal ? isHorizontal(s) : isVertical(s))).filter((s) => s.length >= minLength)
    const across = segments.filter((s) => (horizontal ? isVertical(s) : isHorizontal(s)))
    const perp = (s: Segment): number => (horizontal ? (s.a.y + s.b.y) / 2 : (s.a.x + s.b.x) / 2)
    const span = (s: Segment): [number, number] => (horizontal ? [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)] : [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)])
    const sorted = [...along].sort((p, q) => perp(p) - perp(q) || span(p)[0] - span(q)[0])

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const lo = sorted[i]
        const hi = sorted[j]
        const thickness = perp(hi) - perp(lo)
        if (thickness < minThickness) continue
        if (thickness > maxThickness) break
        const [aLo, aHi] = span(lo)
        const [bLo, bHi] = span(hi)
        const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo)
        const shorter = Math.min(aHi - aLo, bHi - bLo)
        if (overlap < minLength || overlap < shorter * 0.6) continue
        if (overlap / thickness < opt.minAspect) continue
        // A third line strictly between the pair means these two are not the
        // two sides of one member.
        const between = sorted.some((s) => {
          const p = perp(s)
          if (p <= perp(lo) + 1.5 || p >= perp(hi) - 1.5) return false
          const [sLo, sHi] = span(s)
          return Math.min(sHi, Math.min(aHi, bHi)) - Math.max(sLo, Math.max(aLo, bLo)) > overlap * 0.6
        })
        if (between) continue

        const rect: PixelRect = horizontal
          ? { x0: round6(Math.max(aLo, bLo)), y0: round6(perp(lo)), x1: round6(Math.min(aHi, bHi)), y1: round6(perp(hi)) }
          : { x0: round6(perp(lo)), y0: round6(Math.max(aLo, bLo)), x1: round6(perp(hi)), y1: round6(Math.min(aHi, bHi)) }

        // Measured two pixels in from the band's own drawn edges: a line at
        // the boundary is part of the band's outline, not of its face, and
        // letting it into the measurement makes every clean member look busy.
        const busy = texture(g, insetStrip(interiorStrip(rect, horizontal), 2))
        if (busy > opt.maxInteriorTexture) continue
        const interior = tone(g, interiorStrip(rect, horizontal))
        const side0 = tone(g, outsideStrip(rect, horizontal, 0, 1, Math.max(2, Math.min(10, Math.round(thickness)))))
        const side1 = tone(g, outsideStrip(rect, horizontal, 1, 1, Math.max(2, Math.min(10, Math.round(thickness)))))

        const cues: CueEvidence[] = []
        const shadow = shadowCue(g, rect, horizontal, thickness, opt.shadowDelta)
        if (shadow) cues.push(shadow)
        const end = endFaceCue(g, rect, horizontal, thickness, opt.toneDelta)
        if (end) cues.push(end)
        const ret = returnFaceCue(g, rect, horizontal, thickness, opt.toneDelta)
        if (ret) cues.push(ret)
        const occ = occlusionCue(rect, horizontal, across)
        if (occ) cues.push(occ)
        if (interior >= 0 && side0 >= 0 && side1 >= 0 && Math.abs(interior - side0) >= opt.toneDelta && Math.abs(interior - side1) >= opt.toneDelta) {
          cues.push({ cue: 'TONE_STEP', strength: 0.35, detail: `the band reads ${Math.abs(interior - side0)} and ${Math.abs(interior - side1)} levels apart from the wall on either side — true of a proud member and equally true of paint, so on its own it decides nothing` })
        }

        const strong = cues.filter((c) => STRONG_CUES.has(c.cue))
        bands.push({
          rect,
          orientation: horizontal ? 'HORIZONTAL' : 'VERTICAL',
          thickness: round6(thickness),
          length: round6(overlap),
          cues,
          volumetric: strong.length >= 1,
          interiorTone: interior,
          sideTone: [side0, side1],
          interiorTexture: round6(busy),
        })
      }
    }
  }

  // Deterministic order, then de-duplication.
  //
  // A drawn line becomes TWO edges in an edge mask, one on each side of it, so
  // the same member is found several times at one-pixel offsets. Reporting
  // each of them would multiply every facade by four and make a count of
  // members meaningless.
  bands.sort((a, b) => b.length * b.thickness - a.length * a.thickness || a.rect.y0 - b.rect.y0 || a.rect.x0 - b.rect.x0)
  const kept: LinearBand[] = []
  for (const band of bands) {
    if (kept.some((k) => k.orientation === band.orientation && rectIoU(k.rect, band.rect) > 0.6)) continue
    kept.push(band)
    if (kept.length >= (options.maxBands ?? DEFAULTS.maxBands)) break
  }
  return kept
}

/** How confident a band's promotion is, from the cues that back it. */
export function bandConfidence(band: LinearBand): number {
  if (band.cues.length === 0) return 0.3
  const strong = band.cues.filter((c) => STRONG_CUES.has(c.cue))
  const base = strong.length > 0 ? Math.max(...strong.map((c) => c.strength)) : 0.35
  const bonus = Math.min(0.2, 0.06 * (band.cues.length - 1))
  return round6(Math.min(0.92, base + bonus))
}
