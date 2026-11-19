/**
 * v3.54.15 — what the analyzer shows the consultant as its own reading. A label read the other way up from the one its
 * chain decided on evidence is not the analyzer's claim ("0051" is "1500" half a turn round on a sheet read upright);
 * where nothing settled the way up, both readings are shown. Item ids count every observation, so an id keeps naming
 * the same observation.
 */
import { describe, expect, it } from 'vitest'
import { localTableOf } from '../src/consult/metric-read.js'

const obs = (id: string, chainId: string, orientation: string, rawText: string, fromPx = 68, toPx = 524) => ({ id, frameId: 'F', chainId, orientation, rawText, status: 'RAW', axis: 'X', fromPx, toPx })
const metrics = (decisions: Array<{ chainId: string; chosen: string; decidedBy: string }>, observations: unknown[]) =>
  ({ dimensionObservations: observations, numericLattices: [], chains: [], metricSolutions: [{ frameId: 'F', orientationDecisions: decisions }] }) as never

describe('v3.54.15 the analyzer table: readings in the way up their chain decided', () => {
  it('a reading the other way up from an evidence-based decision is left out; the ids of the rest do not move', () => {
    const t = localTableOf(metrics([{ chainId: 'h', chosen: 'HORIZONTAL', decidedBy: 'AXIS_SELF_CONSISTENCY' }], [obs('a', 'h', 'HORIZONTAL', '1101'), obs('b', 'h', 'INVERTED', '0051'), obs('c', 'h', 'HORIZONTAL', '690', 68, 280)]), ['F'])
    expect(t.map((x) => [x.itemId, x.literal])).toEqual([['L1', '1101'], ['L3', '690']])
  })
  it('an undecided chain shows both readings, each with the other way up beside it', () => {
    const t = localTableOf(metrics([{ chainId: 'v', chosen: 'ROTATED_CW', decidedBy: 'UNDECIDED' }], [obs('a', 'v', 'ROTATED_CCW', '518', 144, 529), obs('b', 'v', 'ROTATED_CW', '815', 144, 529)]), ['F'])
    expect(t.map((x) => [x.literal, x.otherWayUp])).toEqual([['518', '815'], ['815', '518']])
  })
  it('counter-trial: a reading without an orientation decision is shown as before', () => {
    const t = localTableOf(metrics([], [obs('a', 'h', 'INVERTED', '0051')]), ['F'])
    expect(t).toHaveLength(1)
    expect(t[0].otherWayUp).toBeUndefined()
  })
})
