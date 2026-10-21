/**
 * The stair between the ground storey and the one above it: tread ladders read on every plan, pooled, assembled on
 * the plan of the top storey (or the ground's), corroborated by the section's step profile, with the hole it needs
 * in the upper slab. A stair whose topology is read but not every step is emitted as a placeholder over its shaft.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import type { BuildingV2 } from './building.js'
import type { PlanFrameV2 } from './frame.js'
import type { PlanReading } from '../layout.js'
import type { SolverRecorder } from './solver-recorder.js'
import { assembleStair, findTreadLadders, poolLadders } from './stair-topology.js'
import type { StairTopologyHypothesis } from './stair-topology.js'

/** A flight or landing that ends within this height below the upper floor needs the slab open over it (head room). */
export const STAIR_HEADROOM_M = 2.0

type Rect = { x0: number; z0: number; x1: number; z1: number }

/**
 * The hole in the upper slab: the flights and landings that end within head room of the upper floor (or the shaft).
 * `riseM` is the storey-to-storey rise the risers share; `upperFloorY` the upper floor's level, which the climb is
 * measured against from zero.
 */
export function stairSlabHole(hypothesis: StairTopologyHypothesis, riseM: number, upperFloorY: number): Rect {
  const riserM = riseM / Math.max(1, hypothesis.risersTotal)
  const parts: Rect[] = []
  let cumulative = 0
  hypothesis.flights.forEach((f, i) => {
    const endRise = (cumulative + f.risers) * riserM
    const rect = f.direction === 'PLUS_X' || f.direction === 'MINUS_X' ? { x0: Math.min(f.from, f.to), x1: Math.max(f.from, f.to), z0: f.band.from, z1: f.band.to } : { x0: f.band.from, x1: f.band.to, z0: Math.min(f.from, f.to), z1: Math.max(f.from, f.to) }
    const underHeadroom = upperFloorY - endRise < STAIR_HEADROOM_M
    if (underHeadroom) parts.push(rect)
    const landing = hypothesis.landings[i]
    if (landing && underHeadroom) parts.push(landing)
    cumulative += f.risers
  })
  const holeParts = parts.length > 0 ? parts : [hypothesis.shaft]
  return { x0: round6(Math.min(...holeParts.map((p) => p.x0))), z0: round6(Math.min(...holeParts.map((p) => p.z0))), x1: round6(Math.max(...holeParts.map((p) => p.x1))), z1: round6(Math.max(...holeParts.map((p) => p.z1))) }
}

export type HouseStairInput = {
  graph: SourceObservationGraph
  frameById: ReadonlyMap<string, SourceCoordinateFrame>
  sectionFrame?: SourceCoordinateFrame
  planByStorey: ReadonlyMap<number, { plan: PlanReading; frame: PlanFrameV2; raster: Raster }>
  /** The main body, which the ladders are looked for over. */
  body: Rect
  topStorey: number
  levels: ReadonlyArray<{ elevation: number }>
}

/** The stair, read and recorded; undefined where there is a single storey or no stair is read. */
export function readHouseStair(input: HouseStairInput, rec: SolverRecorder): BuildingV2['stair'] {
  const { planByStorey, levels } = input
  const rise = levels.length > 1 ? round6(levels[1].elevation - levels[0].elevation) : 0
  const ladderPool: Array<{ ladder: ReturnType<typeof findTreadLadders>[number]; storeyIndex: number }> = []
  for (const [index, entry] of planByStorey) for (const ladder of findTreadLadders(entry.raster, entry.frame, input.body)) ladderPool.push({ ladder, storeyIndex: index })
  const pooled = poolLadders(ladderPool)
  const stairPlan = planByStorey.get(input.topStorey) ?? planByStorey.get(0)
  if (pooled.length === 0 || !stairPlan || levels.length <= 1) {
    if (pooled.length === 0 && levels.length > 1) {
      rec.step({ stage: 'stair', what: 'a stair between the storeys', method: 'REFUSED', detail: 'no tread ladder was found on any plan', inputs: 0, outputs: 0 })
      rec.gap({ what: 'the stair between the storeys', reason: 'no run of evenly spaced tread lines was found on any plan', status: 'MISSING', observationIds: [], evidenceIds: [] })
    }
    return undefined
  }
  const hypothesis = assembleStair(stairPlan.raster, stairPlan.frame, pooled.map((p) => p.ladder), 0, rise)
  if (!hypothesis) return undefined
  const sids = [...new Set(pooled.flatMap((p) => p.storeyIndices))].map((s) => planByStorey.get(s)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => rec.sighting(e.plan.frame, 'tread ladders of the stair', 0.8))
  const sectionStair = input.graph.observations.filter((o) => o.kind === 'STAIR' && input.frameById.get(o.frameId)?.roles.projection === 'ORTHOGRAPHIC_SECTION')
  if (input.sectionFrame && sectionStair.length > 0) {
    sids.push(rec.sighting(input.sectionFrame, 'step profile of the stair', 0.7, sectionStair.map((o) => o.id)))
    for (const o of sectionStair) rec.record({ evidenceId: o.id, evidenceKind: 'OBSERVATION', what: 'the section’s step profile', authority: 'MEDIUM', disposition: 'USED_AS_CORROBORATION', reason: 'corroborates the riser count of the lowest flight', stage: 'IDENTITY' })
  }
  const exact = hypothesis.unresolved.length === 0 && hypothesis.directionEvidence === 'ARROW'
  const featureId = rec.feature('STAIR', 'stair-main', { risers: { value: hypothesis.risersTotal, low: hypothesis.riserCountInterval.low, high: hypothesis.riserCountInterval.high, unit: 'count' }, width: { value: hypothesis.widthM, low: hypothesis.widthM - 0.05, high: hypothesis.widthM + 0.05 } }, sids, exact ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED', hypothesis.why, { storeyIndex: 0, uncertaintyM: 0.04, unresolvedProperties: hypothesis.unresolved })
  const slabHole = stairSlabHole(hypothesis, rise, levels[1].elevation)
  rec.step({ stage: 'stair', what: 'the stair, from its tread ladders', method: exact ? 'DISCRETE_SELECTION' : 'REFUSED', detail: hypothesis.why, inputs: pooled.length, outputs: 1 })
  if (!exact) rec.gap({ what: 'the exact steps of the stair', reason: `the ladders give the topology but ${hypothesis.unresolved.join('; ')}; a placeholder is built over the shaft`, status: 'AMBIGUOUS', observationIds: [], evidenceIds: [] })
  return { hypothesis, emit: exact ? 'FLIGHTS' : 'PLACEHOLDER', fromLevel: 0, toLevel: 1, slabHole, featureId, provenance: exact ? 'SOURCE_CORROBORATED' : 'SOURCE_DERIVED' }
}
