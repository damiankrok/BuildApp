/**
 * The structural pass, end to end.
 *
 * Plans in, a sealed StructuralLayoutHypothesisSet out: decompose, register
 * the storeys, build the mass graph, put a roof on each mass, judge the result
 * and hash it. Everything it calls is generic and none of it knows which
 * building it is looking at.
 *
 * The order is the point. The composition is settled before the roofs, because
 * a roof belongs to a mass and there is no mass to belong to until the plans
 * have been read. The gate runs before the hash, because the verdict is part
 * of what is being sealed — a layout and the reason it was only partly
 * believed are one artifact, and separating them lets the second get lost.
 */
import { round6 } from '@buildapp/source-common'
import type { SourceCoordinateFrame } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { inferStructuralLayout } from './layout.js'
import type { StructuralLayoutDraft, StructuralLayoutOptions } from './layout.js'
import { inferRoofSystems } from './roof-systems.js'
import type { RoofLevels } from './roof-systems.js'
import { evaluateLayoutGate, sealStructuralLayout } from './layout-gate.js'
import type { PublishedArea } from './layout-gate.js'
import type { LayoutQuantity, StructuralLayoutHypothesisSet } from './structural-layout.js'

export type StructuralPassOptions = StructuralLayoutOptions & {
  /** Where the floors and the roof are, from the section's ladder of level datums. */
  levels: RoofLevels
  /** Figures the publisher printed. Used to CHECK the layout and never to derive it. */
  publishedAreas?: readonly PublishedArea[]
}

export type StructuralPassResult = {
  draft: StructuralLayoutDraft
  layout: StructuralLayoutHypothesisSet
}

const quantity = (value: number, spread: number, basis: LayoutQuantity['basis'], evidenceIds: string[], why: string): LayoutQuantity => ({
  value: round6(value),
  low: round6(value - spread),
  high: round6(value + spread),
  unit: 'm',
  basis,
  evidenceIds,
  why,
})

/** Run the structural pass and seal what it found. */
export function composeStructuralLayout(options: StructuralPassOptions): StructuralPassResult {
  const draft = inferStructuralLayout(options)
  const { levels, metrics } = options

  // --- hang the storeys off the section's datums ---------------------------
  const floors = levels.floors
  const heights = levels.heights
  const lowest = draft.storeys.length > 0 ? Math.min(...draft.storeys.map((s) => s.index)) : 0
  for (const storey of draft.storeys) {
    const at = storey.index - lowest
    const elevation = floors[at]
    const height = heights[at]
    if (elevation !== undefined) storey.elevation = quantity(elevation, 0.05, levels.measured ? 'MEASURED' : 'ASSUMED', [...levels.evidenceIds], levels.measured ? 'a level datum printed on the section' : 'nothing states this storey’s level, so it follows the one below by a conventional storey height')
    if (height !== undefined) storey.height = quantity(height, 0.05, levels.measured ? 'DERIVED' : 'ASSUMED', [...levels.evidenceIds], levels.measured ? 'the gap between this storey’s datum and the next' : 'a conventional storey height')
  }
  // A storey the SECTION states and no plan shows is still a storey. The plans
  // of a catalogue project routinely stop at the floors that differ, and
  // refusing to build a second storey because nobody drew a plan of it would
  // lose half the building over a missing drawing.
  //
  // What is NOT known is which bodies reach it, so only the body that reaches
  // highest is taken up — a garage does not gain a first floor because a
  // section through the house shows one — and the assumption is named.
  const planned = new Set(draft.storeys.map((s) => s.index))
  const tallest = [...draft.masses].sort((a, b) => b.storeySpan.toIndex - a.storeySpan.toIndex || b.widthM.value * b.depthM.value - a.widthM.value * a.depthM.value || a.id.localeCompare(b.id))[0]
  for (let i = 0; i < floors.length; i += 1) {
    const index = lowest + i
    if (planned.has(index)) continue
    draft.storeys.push({
      id: `storey-${index}`,
      index,
      frameIds: [],
      elevation: floors[i] === undefined ? undefined : quantity(floors[i], 0.05, 'MEASURED', [...levels.evidenceIds], 'a level datum printed on the section, with no plan of this storey to go with it'),
      height: heights[i] === undefined ? undefined : quantity(heights[i], 0.05, 'DERIVED', [...levels.evidenceIds], 'the gap between this storey\u2019s datum and the next'),
      footprintRegionIds: [],
      confidence: 0.45,
      why: 'the section states a datum at this level and no plan of it was found',
    })
    if (tallest) {
      tallest.storeySpan = { fromIndex: Math.min(tallest.storeySpan.fromIndex, index), toIndex: Math.max(tallest.storeySpan.toIndex, index), storeyIds: [...new Set([...tallest.storeySpan.storeyIds, `storey-${index}`])] }
      draft.unresolved.push({
        id: `gap-storey-no-plan-${index}`,
        what: `the footprint of storey ${index}`,
        reason: `the section states a datum at ${floors[i]?.toFixed(2) ?? '?'} m and no plan of that storey was found, so ${tallest.id} is taken to continue up through it and the other bodies are not`,
        status: 'AMBIGUOUS',
        frameIds: [],
      })
      if (draft.masses.length > 1) {
        draft.conflicts.push({
          id: `conflict-storey-no-plan-${index}`,
          kind: 'STOREY_COVERAGE_DISAGREES',
          what: `storey ${index} has no plan, so which of the ${draft.masses.length} bodies reach it is a guess`,
          itemIds: draft.masses.map((m) => m.id),
          evidenceIds: [...levels.evidenceIds],
        })
      }
    }
  }
  draft.storeys.sort((a, b) => a.index - b.index)

  const storeyTop = (index: number): number | undefined => {
    const storey = draft.storeys.find((s) => s.index === index)
    if (!storey) return undefined
    const elevation = storey.elevation?.value
    const height = storey.height?.value
    return elevation === undefined ? undefined : round6(elevation + (height ?? 0))
  }

  // --- roofs ---------------------------------------------------------------
  const roofing = inferRoofSystems({ masses: draft.masses, metrics, levels, storeyTop })
  for (const mass of draft.masses) {
    const roof = roofing.roofs.find((r) => r.massId === mass.id)
    if (roof) mass.roofSupportId = roof.id
  }
  const conflicts = [...draft.conflicts, ...roofing.conflicts]
  const unresolved = [...draft.unresolved, ...roofing.unresolved]

  // --- the gate, then the hash ---------------------------------------------
  const gate = evaluateLayoutGate({
    masses: draft.masses,
    roofs: roofing.roofs,
    storeys: draft.storeys,
    regions: draft.footprintRegions,
    conflicts,
    unresolved,
    metrics,
    baseFrameId: draft.base?.frame.id ?? '',
    publishedAreas: options.publishedAreas,
  })

  const layout = sealStructuralLayout(
    {
      sourcePackageId: options.sourcePackageId,
      sourcePackageHash: options.sourcePackageHash,
      observationGraphId: options.graph.id,
      observationGraphHash: options.graph.contentHash,
      metricEvidenceId: metrics.id,
      metricEvidenceHash: metrics.contentHash,
      storeys: draft.storeys,
      masses: draft.masses,
      footprintRegions: draft.footprintRegions,
      recesses: draft.recesses,
      attachments: draft.attachments,
      roofSupports: roofing.roofs,
      facadePlanes: draft.facadePlanes,
      alternatives: draft.alternatives,
      conflicts,
      unresolved,
      traces: draft.traces,
      gate,
    },
    options.slug,
  )
  return { draft, layout }
}

/** The plans a package carries, for a caller that wants to know before running the pass. */
export const planFramesOf = (frames: readonly SourceCoordinateFrame[]): SourceCoordinateFrame[] =>
  frames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN')

/** A metric set's level evidence, as the roof pass wants it. Re-exported so a caller need not know which module owns the shape. */
export type { RoofLevels, MetricEvidenceSet }
