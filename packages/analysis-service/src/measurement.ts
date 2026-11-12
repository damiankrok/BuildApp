/**
 * v3.53.8: what the delivered model may be measured for, kept apart from whether the run finished.
 *
 * A run that delivers a model ends `COMPLETED` whatever the model covers: that is the run's technical outcome and it
 * stays the consumers' contract. Whether the model is the whole house, and whether its lengths are the drawing's, are
 * two other questions, each answered here from evidence the run already holds — never from a project:
 *
 *   coverage   the lowest storey's built area against the footprint the publisher prints (`footprint_area`), with the
 *              layout gate's own buckets: within 6 % MATCHES, within 20 % NEAR, beyond it SHORT or OVER. No printed
 *              figure: NOT_ASSESSED (nothing is inferred).
 *   scale      the scale the model was built at against the plan's own measured scale (printed dimensions, read as
 *              printed): STRONG and within `SCALE_AGREES` → MEASURED; STRONG and further → DEPARTS (another reading of
 *              the plan, chosen to fit a published figure, set it); WEAK or INCONCLUSIVE evidence → UNVERIFIED. No
 *              metric evidence: NOT_ASSESSED.
 *   quantities what follows for areas and lengths taken off the model: NOT_USABLE when the scale departs from the
 *              measured one; LIMITED when the scale is unverified, the coverage is short, over or near, or the reading's
 *              own completeness is PARTIAL; USABLE_IN_SCOPE when the scale is measured and the coverage matches —
 *              usable for what this run checks, not a claim that every room, opening and roof is right; NOT_ASSESSED
 *              when neither figure is there to weigh.
 *
 * Every non-usable verdict carries its reasons as codes and sentences. Pure: numbers in, a record out.
 */

export const MEASUREMENT_SCHEMA_VERSION = '1.0.0' as const
/** The share a built scale may differ from the measured one and still be the same scale (a pixel in thirty). */
export const SCALE_AGREES = 0.03

export type CoverageStatus = 'MATCHES' | 'NEAR' | 'SHORT' | 'OVER' | 'NOT_ASSESSED'
export type ScaleStatus = 'MEASURED' | 'DEPARTS' | 'UNVERIFIED' | 'NOT_ASSESSED'
export type QuantitiesStatus = 'USABLE_IN_SCOPE' | 'LIMITED' | 'NOT_USABLE' | 'NOT_ASSESSED'

export type MeasurementAssessment = {
  schemaVersion: typeof MEASUREMENT_SCHEMA_VERSION
  /** The run's technical outcome, unchanged: a model was delivered. */
  run: 'COMPLETED'
  coverage: { status: CoverageStatus; builtM2: number; publishedM2: number | null; share: number | null }
  scale: { status: ScaleStatus; builtCmPerPx: number | null; measuredCmPerPx: number | null; ratio: number | null; confidence: string | null }
  /** The solver's own completeness verdict on the accepted reading, as the assessment states it. */
  completeness: string
  quantities: QuantitiesStatus
  reasons: Array<{ code: string; consequence: string }>
}

export type MeasurementInputs = {
  /** The lowest storey's built area, m². */
  builtM2: number
  publishedFootprintM2?: number
  /** The scale the model's base plan was registered at (metres per pixel, x). */
  builtMetresPerPixel?: number
  /** The base plan's independent metric solution. */
  metric?: { cmPerPixelX: number; confidence: string }
  completeness: string
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

export function measurementOf(input: MeasurementInputs): MeasurementAssessment {
  const reasons: MeasurementAssessment['reasons'] = []
  const published = input.publishedFootprintM2 !== undefined && input.publishedFootprintM2 > 0 ? input.publishedFootprintM2 : null
  let coverage: CoverageStatus = 'NOT_ASSESSED'
  let share: number | null = null
  if (published !== null && input.builtM2 > 0) {
    share = r6(input.builtM2 / published)
    const error = Math.abs(input.builtM2 - published) / published
    coverage = error <= 0.06 ? 'MATCHES' : error <= 0.2 ? 'NEAR' : input.builtM2 < published ? 'SHORT' : 'OVER'
    if (coverage === 'SHORT') reasons.push({ code: 'COVERAGE_SHORT', consequence: `the model covers ${input.builtM2.toFixed(1)} of the ${published} m² footprint the publisher prints (${Math.round(share * 100)} %): areas and quantities cover only the part that was read` })
    else if (coverage === 'OVER') reasons.push({ code: 'COVERAGE_OVER', consequence: `the model covers ${input.builtM2.toFixed(1)} m² against the ${published} m² the publisher prints (${Math.round(share * 100)} %): it holds ground the house does not, and its totals are too large` })
    else if (coverage === 'NEAR') reasons.push({ code: 'COVERAGE_NEAR', consequence: `the model covers ${input.builtM2.toFixed(1)} m² against the ${published} m² the publisher prints (${Math.round(share * 100)} %): something drawn is missing or something built is not drawn` })
  }
  let scale: ScaleStatus = 'NOT_ASSESSED'
  let ratio: number | null = null
  const built = input.builtMetresPerPixel !== undefined && input.builtMetresPerPixel > 0 ? r6(input.builtMetresPerPixel * 100) : null
  const measured = input.metric && input.metric.cmPerPixelX > 0 ? r6(input.metric.cmPerPixelX) : null
  if (input.metric && measured !== null) {
    if (input.metric.confidence === 'STRONG' && built !== null) {
      ratio = r6(built / measured)
      scale = Math.abs(ratio - 1) <= SCALE_AGREES ? 'MEASURED' : 'DEPARTS'
      if (scale === 'DEPARTS') reasons.push({ code: 'SCALE_DEPARTS', consequence: `the model is built at ${built} cm/px, the printed dimensions measure ${measured} cm/px: every length is ${Math.round(Math.abs(ratio - 1) * 100)} % ${ratio > 1 ? 'long' : 'short'} and every area ${Math.round(Math.abs(ratio * ratio - 1) * 100)} % ${ratio > 1 ? 'large' : 'small'}` })
    } else {
      scale = 'UNVERIFIED'
      reasons.push({ code: 'SCALE_UNVERIFIED', consequence: `the plan's scale is ${input.metric.confidence.toLowerCase()}: no printed dimension confirms it independently, so lengths and areas are not verified` })
    }
  }
  if (input.completeness === 'PARTIAL') reasons.push({ code: 'READING_PARTIAL', consequence: 'the reading the model is built from is partial by its own account: a body, an object or a blocking question is left out' })
  const quantities: QuantitiesStatus =
    scale === 'DEPARTS'
      ? 'NOT_USABLE'
      : coverage === 'NOT_ASSESSED' && scale === 'NOT_ASSESSED'
        ? 'NOT_ASSESSED'
        : reasons.length > 0
          ? 'LIMITED'
          : coverage === 'MATCHES' && scale === 'MEASURED'
            ? 'USABLE_IN_SCOPE'
            : 'LIMITED'
  if (quantities === 'LIMITED' && reasons.length === 0) reasons.push({ code: coverage === 'NOT_ASSESSED' ? 'COVERAGE_NOT_ASSESSED' : 'SCALE_NOT_ASSESSED', consequence: coverage === 'NOT_ASSESSED' ? 'the publisher prints no footprint to hold the model against: its coverage is not checked' : 'the plan has no independent metric evidence: its scale is not checked' })
  return {
    schemaVersion: MEASUREMENT_SCHEMA_VERSION,
    run: 'COMPLETED',
    coverage: { status: coverage, builtM2: r6(input.builtM2), publishedM2: published, share },
    scale: { status: scale, builtCmPerPx: built, measuredCmPerPx: measured, ratio, confidence: input.metric?.confidence ?? null },
    completeness: input.completeness,
    quantities,
    reasons,
  }
}

/** The measurement record of one reconstruction: the lowest storey's bodies, the base plan's scales, the published footprint. */
export function measurementOfReconstruction(
  r: {
    building: { masses: ReadonlyArray<{ storeys: readonly number[]; x0: number; z0: number; x1: number; z1: number; pieceOf?: string; storeyRects?: ReadonlyArray<{ storey: number; x0: number; z0: number; x1: number; z1: number }> }> }
    planDiagnostics: { selectedPlanFrameId?: string | null; plans: ReadonlyArray<{ frameId: string; scale?: { mppX: number } | null; metric?: { cmPerPixelX?: number; confidence: string } | null }> }
  },
  publishedAreas: ReadonlyArray<{ key: string; unit: string; value: number }> | undefined,
  completeness: string,
): MeasurementAssessment {
  const lowest = Math.min(...r.building.masses.flatMap((m) => m.storeys))
  let builtM2 = 0
  for (const m of r.building.masses) {
    if (m.pieceOf || !m.storeys.includes(lowest)) continue
    const own = m.storeyRects?.find((s) => s.storey === lowest) ?? m
    builtM2 += Math.max(0, own.x1 - own.x0) * Math.max(0, own.z1 - own.z0)
  }
  const plan = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId)
  const published = publishedAreas?.find((a) => a.key === 'footprint_area' && a.unit === 'm2')?.value
  return measurementOf({
    builtM2: Number.isFinite(builtM2) ? builtM2 : 0,
    ...(published !== undefined ? { publishedFootprintM2: published } : {}),
    ...(plan?.scale?.mppX ? { builtMetresPerPixel: plan.scale.mppX } : {}),
    ...(plan?.metric?.cmPerPixelX !== undefined ? { metric: { cmPerPixelX: plan.metric.cmPerPixelX, confidence: plan.metric.confidence } } : {}),
    completeness,
  })
}
