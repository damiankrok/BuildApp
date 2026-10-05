/**
 * The external numeric recogniser's seam (BUILDPLAN-ANALYZER-005H).
 *
 * 005G measured the numeric lattice's template reader against pretrained text recognisers on the same 775 label crops:
 * the lattice trusted 309 readings and 75 of them were wrong; PaddleOCR's PP-OCRv6 tiny, read with a stability bracket
 * and contested by any confident lattice reading that disagrees (policy P2), trusted 631 with 2 wrong. So a second
 * reader enters the analyzer — as a WITNESS beside the lattice, never in its place and never as its fallback.
 *
 * This module is the whole contract between the metric layer and that reader, and it has no runtime in it: no ONNX
 * Runtime, no WebAssembly, no worker, no file. A recogniser is anything that turns label crops into readings; the
 * production one lives in `@buildapp/numeric-recogniser-ort`, and tests use fixtures.
 *
 * What a recogniser is given is what the lattice reads and nothing else: the label's own pixels, cut from the pass
 * field that reads it upright (`token.passBox`, padded by `RECOGNISER_CROP.padShare` of its height), its height, and an
 * opaque key. It never sees a scale, a span, a chain, a tick, another label, a published figure, a room area or a
 * model candidate — `LabelCrop` has no field that could carry one, and the crops are cut before any of those exist.
 * What comes back is candidates: its top values with their posteriors, its own unconstrained answer, and whether
 * the answer survives the stability bracket. What becomes of them is decided by the ensemble rule (`ensemble.ts`) and,
 * after it, by the metric resolver.
 */
import type { PixelRect } from '@buildapp/source-common'
import type { Gray } from '@buildapp/source-cv'

/** The crop every recogniser sees: the lattice's own box, padded by this share of its height on every side (at least `minPadPx`). */
export const RECOGNISER_CROP = { padShare: 0.35, minPadPx: 3 } as const

/** One label as a recogniser sees it. Image only, by construction. */
export type LabelCrop = {
  /** Opaque: the reading comes back under it. */
  key: string
  /** The label upright, ink dark on paper (the pass field's channel, 0–255), off-field pixels as paper. */
  gray: Gray
  /** The label's height in the pass, px. */
  capPx: number
}

/** The stability bracket's four reads of one crop (005G): as cut, 2 px more paper, 1 px less, at 90 %. */
export const EXTERNAL_VARIANTS = ['BASE', 'PAD2', 'TRIM1', 'SCALE90'] as const
export type ExternalVariant = (typeof EXTERNAL_VARIANTS)[number]

/** What a recogniser read on one crop: candidates, never a value. */
export type ExternalReading = {
  key: string
  /** The recogniser's id, e.g. `ocr.ppocrv6-tiny-rec@9ef676d6`. */
  engine: string
  modelSha256: string
  runtime: string
  /** The digit-constrained values, best first, with their posterior among the decoder's beam. */
  topK: Array<{ text: string; p: number }>
  /** The model's own answer over its full alphabet, and the mean probability of the frames it kept. */
  greedy: { text: string; meanP: number }
  /** The top value is the same under every variant of the bracket. */
  stable: boolean
  /** Each variant's top value and its posterior. */
  variants: Array<{ variant: ExternalVariant; top: string; p: number }>
}

export type RecogniseOptions = {
  signal?: AbortSignal
  /** Told after each crop is read (`done` of `total`): progress only, never part of a reading. */
  onProgress?: (done: number, total: number) => void
}

/**
 * A numeric label recogniser. `recognise` is called once per frame with every label the lattice read on it — never per
 * glyph and never per label — and returns one reading per crop it could read, under the crop's key.
 */
export interface LabelRecogniser {
  readonly id: string
  readonly model: { name: string; sha256: string }
  readonly runtime: string
  /** The SHA-256 of the runtime's binary (the WebAssembly the readings were computed by), when it has one. */
  readonly runtimeSha256?: string
  recognise(crops: readonly LabelCrop[], options?: RecogniseOptions): Promise<ExternalReading[]>
  /** Give back what the recogniser holds (a worker, a session, its memory). Idempotent; a later `recognise` may start again. */
  release?(): Promise<void>
}

/**
 * The crop of one label (005G's `cropOf`, the bake-off's): `box` in its upright pass, padded by `padShare` of its height
 * on every side, clamped to whole pixels, off-field as paper (255). The pixels are the field's own — no resampling.
 */
export function cropForToken(field: Gray, box: PixelRect): Gray {
  const h = Math.max(1, box.y1 - box.y0)
  const m = Math.max(RECOGNISER_CROP.minPadPx, Math.round(RECOGNISER_CROP.padShare * h))
  const x0 = Math.floor(box.x0) - m
  const y0 = Math.floor(box.y0) - m
  const width = Math.ceil(box.x1) + m - x0
  const height = Math.ceil(box.y1) + m - y0
  const data = new Uint8ClampedArray(width * height).fill(255)
  for (let y = 0; y < height; y += 1) {
    const sy = y0 + y
    if (sy < 0 || sy >= field.height) continue
    for (let x = 0; x < width; x += 1) {
      const sx = x0 + x
      if (sx >= 0 && sx < field.width) data[y * width + x] = field.data[sy * field.width + sx]
    }
  }
  return { width, height, data }
}

/** A label's crop for a recogniser, from the field its pass read and its box in that pass. */
export const labelCrop = (key: string, field: Gray, passBox: PixelRect): LabelCrop => ({ key, gray: cropForToken(field, passBox), capPx: Math.max(1, Math.round(passBox.y1 - passBox.y0)) })
