/**
 * The decision timeline and the first divergence between two runs (BUILDPLAN-ANALYZER-005D).
 *
 * A timeline lists the decisions a run made, stage by stage in the order the analyzer takes them,
 * each on a stable object id: a crossing mark on a chain, a label on a chain, a scale, a frame's
 * extent, an envelope, a body, the final model. Two runs of the same source — the frozen code and a
 * new one, the clean link and the tracked one, a pack made with evidence ON and one with it OFF —
 * compare object by object; the first stage where any object's decision differs is where they
 * part, and the object is the first wrong (or first fixed) decision, without reading a log.
 */
import { TIMELINE_STAGES } from './types.js'
import type { DecisionEvent, TimelineStage } from './types.js'

export type Divergence = {
  firstDivergence: TimelineStage | 'NONE'
  object?: string
  before?: string
  after?: string
  reasonBefore?: string
  reasonAfter?: string
  /** How many objects of that stage differ, and the first few of them. */
  differing: number
  examples: Array<{ object: string; before: string; after: string }>
  /** Every stage that differs, in order: the first is the one that matters, the rest may follow from it. */
  stagesDiffering: TimelineStage[]
  /**
   * 005E: objects of a stage whose record a later stage scopes, recorded by one run only — not a decision of that stage
   * (`RECORD_SCOPED`), so listed apart from the divergence.
   */
  recordedByOneRunOnly?: Array<{ stage: TimelineStage; objects: number }>
}

const ABSENT = 'ABSENT'

/**
 * Stages whose every object is decided, but recorded only where a later stage keeps it. Every crossing mark on a found
 * line is classified before any number is read; the pack records the marks of the chains the run kept (a chain with a
 * solved segment, labelled or long). A mark one run recorded and the other did not is a difference in what the later
 * stages kept, which they report themselves; only a mark both runs recorded, classified differently, is a divergence
 * of the classification.
 */
const RECORD_SCOPED: ReadonlySet<TimelineStage> = new Set(['DIMENSION_TICK_CLASSIFICATION'])

/** Decisions that differ only in a named doubt (ACCEPTED vs ACCEPTED_QUESTIONABLE) are the same decision. */
const core = (decision: string): string => decision.replace(/_QUESTIONABLE$/, '')

/** The first stage, in analyzer order, where two timelines decide differently about any object. */
export function firstDivergence(before: readonly DecisionEvent[], after: readonly DecisionEvent[]): Divergence {
  const stagesDiffering: TimelineStage[] = []
  const recordedByOneRunOnly: Array<{ stage: TimelineStage; objects: number }> = []
  let first: Divergence | undefined
  for (const stage of TIMELINE_STAGES) {
    const a = new Map(before.filter((e) => e.stage === stage).map((e) => [e.objectId, e]))
    const b = new Map(after.filter((e) => e.stage === stage).map((e) => [e.objectId, e]))
    let ids = [...new Set([...a.keys(), ...b.keys()])]
    if (RECORD_SCOPED.has(stage)) {
      const oneSided = ids.filter((id) => !a.has(id) || !b.has(id)).length
      if (oneSided > 0) recordedByOneRunOnly.push({ stage, objects: oneSided })
      ids = ids.filter((id) => a.has(id) && b.has(id))
    }
    // In the order the earlier run met them, then the later run's new objects: the first difference is the first in the pipeline.
    const order = (id: string): number => a.get(id)?.seq ?? (b.get(id)?.seq ?? 0) + 1e9
    ids.sort((x, y) => order(x) - order(y) || (x < y ? -1 : x > y ? 1 : 0))
    const differing = ids.filter((id) => core(a.get(id)?.decision ?? ABSENT) !== core(b.get(id)?.decision ?? ABSENT))
    if (differing.length === 0) continue
    stagesDiffering.push(stage)
    if (!first) {
      const id = differing[0]
      first = {
        firstDivergence: stage,
        object: id,
        before: a.get(id)?.decision ?? ABSENT,
        after: b.get(id)?.decision ?? ABSENT,
        ...(a.get(id) ? { reasonBefore: a.get(id)?.reason } : {}),
        ...(b.get(id) ? { reasonAfter: b.get(id)?.reason } : {}),
        differing: differing.length,
        examples: differing.slice(0, 8).map((x) => ({ object: x, before: a.get(x)?.decision ?? ABSENT, after: b.get(x)?.decision ?? ABSENT })),
        stagesDiffering: [],
      }
    }
  }
  const scoped = recordedByOneRunOnly.length > 0 ? { recordedByOneRunOnly } : {}
  return first ? { ...first, stagesDiffering, ...scoped } : { firstDivergence: 'NONE', differing: 0, examples: [], stagesDiffering, ...scoped }
}

/**
 * Where an accepted reading of a plan and a rejected one part, from the resolver's own one-line
 * summaries: the first of copy, extent, scale, tiling, faces and mouths that differs.
 */
export function readingDivergence(accepted: string, rejected: string): { component: string; accepted: string; rejected: string } | null {
  const parts = (s: string): string[] => s.split(':')[0].split(',').map((x) => x.trim())
  const names = ['copy', 'extent', 'scale', 'tiling', 'faces', 'mouths']
  const [a, b] = [parts(accepted), parts(rejected)]
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) if ((a[i] ?? '') !== (b[i] ?? '')) return { component: names[i] ?? `part ${i + 1}`, accepted: a[i] ?? '(none)', rejected: b[i] ?? '(none)' }
  return null
}
