/**
 * Progress telemetry: what the analyzer is doing, from the loops doing it.
 *
 * A long synchronous pass (reading every printed number on eight plan
 * copies) used to report nothing for minutes, and a phone could not tell a
 * heavy step from a wedged one. Each loop that can run for more than a moment
 * now calls `tick` at its boundaries with the counts it already holds.
 *
 * The contract that keeps this honest: a `Checkpoint` is WRITE-ONLY for the
 * computation. Nothing it holds is ever read back into a decision — no time
 * budget, no "skip this if slow" — so a run with telemetry and a run without
 * produce the same bytes. The one thing a tick may do to the computation is
 * throw the run's cancellation, at a boundary where nothing partial escapes.
 */

/** What a phase counts. */
export type ProgressUnit = 'ADDRESS' | 'ASSET' | 'FRAME' | 'TOKEN_GROUP' | 'RING' | 'CANDIDATE' | 'STEP'

/** Where the work is, as the loop in hand knows it. Every field is a count or a closed id. */
export type WorkUpdate = {
  done?: number
  total?: number | null
  /** 1-based. */
  assetIndex?: number
  assetTotal?: number
  /** 1-based, for a bounded search over candidates. */
  candidateIndex?: number
  candidateTotal?: number
  /** A step inside the phase, e.g. `{ id: 'CALLOUT_RINGS', label: 'reading opening callouts' }`. */
  subphase?: { id: string; label: string }
  /** A small closed set of counts the phase keeps: rings read, tokens, chains. */
  counters?: Record<string, number>
}

export interface Checkpoint {
  /** Enter a named phase: its counts start from zero. */
  phase(id: string, options?: { unit?: ProgressUnit; total?: number | null; subphase?: { id: string; label: string } }): void
  /**
   * A loop boundary: record where the work is. Cheap when nothing is due; may
   * emit a heartbeat; may throw the run's cancellation. Returns nothing, and
   * nothing it records is ever read back by the computation.
   */
  tick(update?: WorkUpdate): void
}

/** The checkpoint of a caller that is not watching: every call is a no-op. */
export const NO_CHECKPOINT: Checkpoint = Object.freeze({
  phase: () => undefined,
  tick: () => undefined,
})
