/**
 * The seventeen synthetic architectural diversity fixtures (stage 03G §22),
 * and the runner that proves each one end to end.
 */
import type { ArchitecturalFixture } from './types.js'
import { roofDormerGable, roofDormerShed, roofFlatParapet, roofGable, roofHip, roofIntersectingGables, roofShed, roofSteppedLevels } from './roofs.js'
import { exteriorBalcony, exteriorCarport, exteriorEntranceCanopy, exteriorEntranceSteps, exteriorLoggia, exteriorOpenCanopy, exteriorPergola, exteriorTerrace, unknownFeature } from './exteriors.js'

export type { ArchitecturalFixture } from './types.js'
export * from './run.js'
export { ALL_DEMOS, runDemo, type DemoRun, type HypothesisDemo } from '../hypotheses/demos.js'

export const ALL_FIXTURES: readonly ArchitecturalFixture[] = [
  roofGable,
  roofHip,
  roofShed,
  roofFlatParapet,
  roofIntersectingGables,
  roofSteppedLevels,
  roofDormerGable,
  roofDormerShed,
  exteriorBalcony,
  exteriorLoggia,
  exteriorTerrace,
  exteriorEntranceCanopy,
  exteriorCarport,
  exteriorPergola,
  exteriorOpenCanopy,
  exteriorEntranceSteps,
  unknownFeature,
]

export const fixtureById = (id: string): ArchitecturalFixture => {
  const f = ALL_FIXTURES.find((x) => x.id === id)
  if (!f) throw new Error(`no architectural fixture ${id}`)
  return f
}
