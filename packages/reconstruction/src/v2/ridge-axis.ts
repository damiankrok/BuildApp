/**
 * Which way the main ridge runs, from what the registered views measured over the main body's span (`apexVotes`:
 * the rise from 15 % to 50 % of each view's span) and the layout's own axis (a rise test on the section, or the long
 * side by convention).
 *
 * - A view that shows a gable end's apex votes; the views agreeing on one axis decide it.
 * - SHAPE-LIVE-01: with no gable end voted, the stated pitch says what each axis would show: a view across the ridge's
 *   end the full rise (0.35 of its span at the pitch), a view of the eaves side only a hip's run, or nothing over a
 *   gable. The axis whose prediction every view fits, and the other none of them, is the fitted axis.
 * - E13: the layout's axis stands over a fitted one unless a view contradicts the layout's outright — the
 *   layout's axis would show it a gable end's full rise, a metre or more, and it measures under a quarter of that. The
 *   rise test reads the eaves datum as the walls' head; where the section prints it at the lip of an overhang, the
 *   walled span across the wrong axis can reproduce the rise by coincidence, and the views, which see the roof itself,
 *   then overturn it.
 * - v3.45: where nothing above decides — no gable end voted, no fit, no layout axis — a roof that falls four ways at
 *   one pitch has its ridge along the body's longer side: with every plane at the same pitch the hips meet the ridge
 *   at 45° in plan, and the ridge is the long side less the short one. That is geometry, not a convention; only a
 *   square body (a pyramid) or a gable roof is left to the default, and the default is named (`geometric`).
 */
export type ApexVote = { side: string; peakM: number; gableEnd: boolean }

export type RidgeAxisDecision = {
  ridgeAxis: 'X' | 'Z'
  votedAxis?: 'X' | 'Z'
  fittedAxis?: { axis: 'X' | 'Z'; contradicts: boolean; why: string }
  overturned: boolean
  /** v3.45: how the axis was settled when no view, fit or layout decided it. */
  fallback?: { axis: 'X' | 'Z'; geometric: boolean; why: string }
}

export function decideRidgeAxis(input: { apexVotes: readonly ApexVote[]; layoutAxis?: 'X' | 'Z'; statedPitchDeg?: number; hip: boolean; spanX: number; spanZ: number }): RidgeAxisDecision {
  const { apexVotes, layoutAxis, statedPitchDeg } = input
  const endsFrontRear = apexVotes.filter((a) => (a.side === 'FRONT' || a.side === 'REAR') && a.gableEnd).length
  const endsSides = apexVotes.filter((a) => (a.side === 'LEFT' || a.side === 'RIGHT') && a.gableEnd).length
  const votedAxis: 'X' | 'Z' | undefined = endsFrontRear > 0 && endsSides === 0 ? 'Z' : endsSides > 0 && endsFrontRear === 0 ? 'X' : undefined
  const fittedAxis = ((): RidgeAxisDecision['fittedAxis'] => {
    if (votedAxis || statedPitchDeg === undefined || apexVotes.length === 0) return undefined
    const tan = Math.tan((statedPitchDeg * Math.PI) / 180)
    const peakAt = (axis: 'X' | 'Z', side: string): number => {
      const frontRear = side === 'FRONT' || side === 'REAR'
      const span = frontRear ? input.spanX : input.spanZ
      const depth = frontRear ? input.spanZ : input.spanX
      const seesEnd = (axis === 'Z') === frontRear
      if (seesEnd) return 0.35 * span * tan
      if (!input.hip) return 0
      return (Math.min(span / 2, depth / 2) - Math.min(0.15 * span, depth / 2)) * tan
    }
    const fits = (axis: 'X' | 'Z'): boolean => apexVotes.every((v) => Math.abs(v.peakM - peakAt(axis, v.side)) <= Math.max(0.25, 0.3 * peakAt(axis, v.side)))
    const fx = fits('X')
    const fz = fits('Z')
    if (fx === fz) return undefined
    const axis: 'X' | 'Z' = fx ? 'X' : 'Z'
    const other: 'X' | 'Z' = fx ? 'Z' : 'X'
    const contradicts = apexVotes.some((v) => peakAt(other, v.side) >= 1 && v.peakM < 0.25 * peakAt(other, v.side))
    return { axis, contradicts, why: `no view shows a gable end${layoutAxis ? '' : ' and the layout states no axis'}; the views' rise over their middle (${apexVotes.map((v) => `${v.side.toLowerCase()} ${v.peakM.toFixed(2)} m`).join(', ')}) fits a ridge along ${axis} at the stated ${statedPitchDeg}° (${apexVotes.map((v) => peakAt(axis, v.side).toFixed(2)).join(', ')} m) and not one along ${other} (${apexVotes.map((v) => peakAt(other, v.side).toFixed(2)).join(', ')} m)` }
  })()
  const overturned = !votedAxis && layoutAxis !== undefined && fittedAxis !== undefined && fittedAxis.axis !== layoutAxis && fittedAxis.contradicts
  const decided: 'X' | 'Z' | undefined = votedAxis ?? (overturned && fittedAxis ? fittedAxis.axis : (layoutAxis ?? fittedAxis?.axis))
  if (decided) return { ridgeAxis: decided, ...(votedAxis ? { votedAxis } : {}), ...(fittedAxis ? { fittedAxis } : {}), overturned }
  const longer: 'X' | 'Z' | undefined = Math.abs(input.spanX - input.spanZ) < 0.01 ? undefined : input.spanX > input.spanZ ? 'X' : 'Z'
  const fallback: NonNullable<RidgeAxisDecision['fallback']> =
    input.hip && longer
      ? { axis: longer, geometric: true, why: `no view, fit or layout decides; a roof falling four ways at one pitch has its ridge along the longer side (${longer}: ${input.spanX.toFixed(2)} × ${input.spanZ.toFixed(2)} m)` }
      : { axis: 'Z', geometric: false, why: `no view, fit or layout decides, and ${input.hip ? 'a square hipped body has no longer side' : 'a gable roof has no geometric axis'}: the ridge runs along Z by convention` }
  return { ridgeAxis: fallback.axis, ...(fittedAxis ? { fittedAxis } : {}), overturned, fallback }
}
