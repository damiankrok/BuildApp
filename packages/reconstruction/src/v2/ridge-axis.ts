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
 */
export type ApexVote = { side: string; peakM: number; gableEnd: boolean }

export type RidgeAxisDecision = {
  ridgeAxis: 'X' | 'Z'
  votedAxis?: 'X' | 'Z'
  fittedAxis?: { axis: 'X' | 'Z'; contradicts: boolean; why: string }
  overturned: boolean
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
  const ridgeAxis: 'X' | 'Z' = votedAxis ?? (overturned && fittedAxis ? fittedAxis.axis : (layoutAxis ?? fittedAxis?.axis)) ?? 'Z'
  return { ridgeAxis, ...(votedAxis ? { votedAxis } : {}), ...(fittedAxis ? { fittedAxis } : {}), overturned }
}
