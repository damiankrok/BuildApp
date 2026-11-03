/**
 * SHAPE-LIVE-01: what the analyzer is looking at, while it looks — the sheet it is reading right now, the marks it has
 * made on it (a number read, a dimension line, an opening, a wall) with their state, and what the step is for.
 *
 * Write-only, like progress and telemetry: nothing here reaches the result, a hash or a decision. The events name the
 * sheet by its asset id and the SHA-256 of the exact bytes the run read; the local runtime copies those bytes beside
 * the job (`apps/local-analyzer`) and the phone shows them only if their hash matches. A phase that reads no picture
 * says so and keeps the last sheet marked as the last one, never as the current one.
 */
import type { PixelRect } from '@buildapp/source-common'

export type LiveMarkStatus = 'CANDIDATE' | 'READ' | 'ACCEPTED' | 'REJECTED'
export type LiveMark = {
  kind: 'TEXT' | 'DIMENSION' | 'OPENING' | 'LEVEL' | 'WALL'
  status: LiveMarkStatus
  box?: PixelRect
  line?: { x0: number; y0: number; x1: number; y1: number }
  /** What was read or assumed, in a few characters: the printed text, or the value and its unit. */
  label: string
  /** The model element it went into, when one did. */
  elementId?: string
}

export type LiveSheet = { assetId: string; url: string; byteHash: string; width: number; height: number; document: string }

/** What the step is, as a code the phone words in its own language. */
export type LiveStep =
  | 'FETCHING' // the page and its pictures are being fetched: no sheet yet
  | 'CONTENT_CHECK' // what this picture shows (the encoder)
  | 'CONTENT_REFUSED' // its pixels contradict its caption: kept as a source, no reader
  | 'READING_DRAWING' // a reader is tracing this sheet
  | 'DRAWING_READ' // what the reader found on it
  | 'READING_NUMBERS' // the numbers printed on this sheet are being read
  | 'NUMBERS_READ' // what was read: candidates and readings
  | 'SOLVING' // the solver: no sheet is being read
  | 'BUILT_FROM' // this sheet's readings, as the model used or refused them
  | 'COMPILING' // the 3D scene: no sheet
  | 'VERIFYING' // the checks: no sheet

export type LiveCounts = {
  images: number
  imagesRead: number
  imagesRefused: number
  /** Text found on the drawings that might be a number: candidates, not measurements. */
  ocrCandidates: number
  /** Numbers bound to a dimension line or a callout. */
  measurementsRead: number
  /** Numbers the model used (in the model or as a check). Known once the solver is done. */
  measurementsUsed: number
  /** Openings found on the sheets (several readings of one opening are one). Known once the solver is done. */
  openingsBuilt?: number
  /** Distinct model elements the accepted readings went into (several readings of one wall are one element). */
  elementsFromReadings?: number
  /** The solver's hypotheses (primitive readings it weighed), once it is done. */
  hypotheses?: number
}

export type LiveSourceEvent = {
  seq: number
  step: LiveStep
  stage: string
  /** The sheet this step is about; null when the step reads no picture. */
  sheet: LiveSheet | null
  /** True when `sheet` is null and the last sheet shown stays on screen as the LAST one, not the current one. */
  keepsLastSheet: boolean
  detail: string
  marks: LiveMark[]
  counts: LiveCounts
}

/** At most this many marks travel in one event: a phone draws them over a picture, not a database. */
export const LIVE_MARK_LIMIT = 400

export type LiveSink = (event: LiveSourceEvent) => void

/** A small stateful emitter: sequence numbers and running counts, so each call site says only what it saw. */
export function liveEmitter(sink: LiveSink | undefined): {
  emit: (e: Omit<LiveSourceEvent, 'seq' | 'counts' | 'keepsLastSheet' | 'marks'> & { marks?: LiveMark[]; keepsLastSheet?: boolean }) => void
  counts: LiveCounts
} {
  let seq = 0
  const counts: LiveCounts = { images: 0, imagesRead: 0, imagesRefused: 0, ocrCandidates: 0, measurementsRead: 0, measurementsUsed: 0 }
  return {
    counts,
    emit: (e) => {
      if (!sink) return
      seq += 1
      const marks = (e.marks ?? []).slice(0, LIVE_MARK_LIMIT)
      try {
        sink({ ...e, seq, marks, keepsLastSheet: e.keepsLastSheet ?? e.sheet === null, counts: { ...counts } })
      } catch {
        // a listener that fails never fails the analysis: the preview is write-only
      }
    },
  }
}
