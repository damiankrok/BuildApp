/**
 * Constraints, in three classes that must never be mixed.
 *
 * The distinction is the whole reason this stage can be trusted:
 *
 * - **HARD.** The drawing STATES this. A printed dimension the chain
 *   arithmetic endorses, a level datum the ladder confirms, an angle the sheet
 *   prints against the edge it measures. A hard constraint is satisfied
 *   exactly or the solve fails and says so. It is never traded off against
 *   anything, and it is never averaged with a rival.
 * - **SOFT.** Something the sources SUGGEST, with a weight and a tolerance. A
 *   wall band's thickness scaled off a plan, a facade member's depth inferred
 *   from a render's shading, a roof pitch measured from an edge rather than
 *   read from a label. Soft constraints are fitted by weighted least squares
 *   and their residuals are reported.
 * - **UNRESOLVED.** Something the sources do not determine. It is NOT a soft
 *   constraint with a guess in it, and it is NOT silently defaulted: it is
 *   carried through to the candidate as a named hole, and whatever the model
 *   ends up containing there is labelled as unresolved.
 *
 * The rule that follows, and that `detectContradictions` enforces: two HARD
 * constraints on the same quantity that disagree are a CONTRADICTION. They are
 * never averaged. One of the readings is wrong, and a solver that splits the
 * difference produces a number that no drawing states and that nobody can
 * check.
 */
import { z } from 'zod'
import { round6 } from '@buildapp/source-common'

export const ConstraintClassSchema = z.enum(['HARD', 'SOFT', 'UNRESOLVED'])
export type ConstraintClass = z.infer<typeof ConstraintClassSchema>

/** What a constraint is ABOUT: the quantity it pins down. */
export const ConstraintSubjectSchema = z
  .object({
    /** The hypothesis the quantity belongs to. */
    hypothesisId: z.string().min(1),
    /** The parameter's name within it. */
    parameter: z.string().min(1),
  })
  .strict()
export type ConstraintSubject = z.infer<typeof ConstraintSubjectSchema>

export const ConstraintSchema = z
  .object({
    id: z.string().min(1),
    class: ConstraintClassSchema,
    subject: ConstraintSubjectSchema,
    /** The value the constraint asserts. Absent for an UNRESOLVED constraint, which asserts nothing. */
    value: z.number().finite().optional(),
    /** How far from `value` is still acceptable. Zero for a hard constraint means exactly. */
    tolerance: z.number().nonnegative().optional(),
    /** For a SOFT constraint: how much it counts against the others. */
    weight: z.number().nonnegative(),
    unit: z.enum(['m', 'deg', 'count', 'none']),
    evidenceIds: z.array(z.string().min(1)),
    observationIds: z.array(z.string().min(1)),
    why: z.string().min(1),
  })
  .strict()
export type Constraint = z.infer<typeof ConstraintSchema>

/** Two constraints on one quantity that cannot both hold. */
export type Contradiction = {
  id: string
  subject: ConstraintSubject
  constraintIds: string[]
  values: number[]
  unit: Constraint['unit']
  /** How far apart, in the constraint's unit. */
  gap: number
  why: string
}

/**
 * Hard constraints on one quantity that disagree beyond their own tolerances.
 *
 * Reported, never reconciled. A drawing that states 15.30 in one place and
 * 15.85 in another has a problem the reconstruction cannot solve, and the only
 * honest responses are to pick one with a stated reason or to leave the
 * quantity unresolved — not to build 15.575 metres of wall.
 */
export function detectContradictions(constraints: readonly Constraint[]): Contradiction[] {
  const bySubject = new Map<string, Constraint[]>()
  for (const c of constraints) {
    if (c.class !== 'HARD' || c.value === undefined) continue
    const key = `${c.subject.hypothesisId}::${c.subject.parameter}`
    bySubject.set(key, [...(bySubject.get(key) ?? []), c])
  }
  const out: Contradiction[] = []
  for (const [key, group] of [...bySubject].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => (a.value as number) - (b.value as number))
    const low = sorted[0]
    const high = sorted[sorted.length - 1]
    const gap = (high.value as number) - (low.value as number)
    const allowance = Math.max(low.tolerance ?? 0, high.tolerance ?? 0)
    if (gap <= allowance) continue
    const [hypothesisId, parameter] = key.split('::')
    out.push({
      id: `contradiction-${hypothesisId}-${parameter}`,
      subject: { hypothesisId, parameter },
      constraintIds: sorted.map((c) => c.id).sort(),
      values: sorted.map((c) => round6(c.value as number)),
      unit: low.unit,
      gap: round6(gap),
      why: `${group.length} exact statements of ${parameter} differ by ${round6(gap)} ${low.unit}; they are kept apart rather than averaged`,
    })
  }
  return out
}

export type SolvedQuantity = {
  subject: ConstraintSubject
  value: number
  unit: Constraint['unit']
  class: ConstraintClass
  /** Which constraints decided it. */
  constraintIds: string[]
  /** Weighted residual against the soft constraints, in the quantity's unit. */
  residual: number
  /** The interval the evidence actually allows. */
  low: number
  high: number
  why: string
}

/**
 * Solve one quantity from the constraints on it.
 *
 * The preference order is fixed, stated, and not negotiable:
 *
 *   1. A HARD constraint decides, exactly. If several agree, the one with the
 *      most evidence behind it is cited and the value is theirs.
 *   2. Failing that, the SOFT constraints are combined by weighted least
 *      squares, which for a single quantity is a weighted mean — and the
 *      spread of the inputs becomes the interval, so a quantity fitted from
 *      two soft constraints that disagree says so in its interval rather than
 *      in nothing at all.
 *   3. Failing that, the quantity is UNRESOLVED. It gets whatever prior the
 *      caller supplies, it is labelled unresolved, and no residual is claimed
 *      for it, because there is nothing to have a residual against.
 *
 * What never happens is a hard constraint being weighed against a soft one. A
 * printed dimension is not evidence to be balanced; it is what the drawing
 * says.
 */
export function solveQuantity(subject: ConstraintSubject, constraints: readonly Constraint[], prior?: { value: number; low: number; high: number }): SolvedQuantity {
  const mine = constraints.filter((c) => c.subject.hypothesisId === subject.hypothesisId && c.subject.parameter === subject.parameter)
  const unit = mine[0]?.unit ?? 'none'
  const hard = mine.filter((c) => c.class === 'HARD' && c.value !== undefined)
  if (hard.length > 0) {
    const chosen = [...hard].sort((a, b) => b.evidenceIds.length - a.evidenceIds.length || b.weight - a.weight || a.id.localeCompare(b.id))[0]
    const values = hard.map((c) => c.value as number)
    return {
      subject,
      value: round6(chosen.value as number),
      unit,
      class: 'HARD',
      constraintIds: hard.map((c) => c.id).sort(),
      residual: 0,
      low: round6(Math.min(...values)),
      high: round6(Math.max(...values)),
      why: hard.length === 1 ? chosen.why : `${hard.length} exact statements; ${chosen.why}`,
    }
  }
  const soft = mine.filter((c) => c.class === 'SOFT' && c.value !== undefined && c.weight > 0)
  if (soft.length > 0) {
    const totalWeight = soft.reduce((a, c) => a + c.weight, 0)
    const value = soft.reduce((a, c) => a + c.weight * (c.value as number), 0) / totalWeight
    const residual = Math.sqrt(soft.reduce((a, c) => a + c.weight * ((c.value as number) - value) ** 2, 0) / totalWeight)
    const lows = soft.map((c) => (c.value as number) - (c.tolerance ?? 0))
    const highs = soft.map((c) => (c.value as number) + (c.tolerance ?? 0))
    return {
      subject,
      value: round6(value),
      unit,
      class: 'SOFT',
      constraintIds: soft.map((c) => c.id).sort(),
      residual: round6(residual),
      low: round6(Math.min(...lows)),
      high: round6(Math.max(...highs)),
      why: soft.length === 1 ? soft[0].why : `weighted fit of ${soft.length} suggestions, spread ${round6(residual)} ${unit}`,
    }
  }
  return {
    subject,
    value: round6(prior?.value ?? 0),
    unit,
    class: 'UNRESOLVED',
    constraintIds: mine.map((c) => c.id).sort(),
    residual: 0,
    low: round6(prior?.low ?? prior?.value ?? 0),
    high: round6(prior?.high ?? prior?.value ?? 0),
    why: mine.length === 0 ? 'no constraint of any kind bears on this quantity' : 'the only constraints on this quantity assert nothing',
  }
}

/**
 * Intersect the intervals a set of constraints allows.
 *
 * Returns nothing when they do not overlap, which is itself the answer: a
 * quantity whose constraints have no common interval is over-determined, and
 * the caller must report that rather than pick a point inside one of them.
 */
export function intersectIntervals(constraints: readonly Constraint[]): { low: number; high: number } | undefined {
  let low = -Infinity
  let high = Infinity
  for (const c of constraints) {
    if (c.value === undefined) continue
    const tolerance = c.tolerance ?? 0
    low = Math.max(low, c.value - tolerance)
    high = Math.min(high, c.value + tolerance)
  }
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) return undefined
  return { low: round6(low), high: round6(high) }
}
