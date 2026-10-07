/**
 * Inferring a building's composition from its plans.
 *
 * This is the stage that decides WHAT THE BUILDING IS before anything decides
 * how big it is. It reads every floor plan the package carries, decomposes
 * each into the masses its own walls enclose, registers the storeys onto one
 * another, and reports the result as a mass graph: which bodies there are,
 * which storeys each one reaches, how they meet, which faces are outside, and
 * which pockets are recesses rather than rooms.
 *
 * Three things about it are deliberate.
 *
 * **The storeys are registered to each other, not assumed to match.** An
 * upper-storey plan is usually dimensioned only where it differs from the one
 * below, so its own chains cannot be trusted to state its size. Instead it is
 * ALIGNED onto the storey below by matching wall axes, choosing among a small,
 * explicit set of candidate targets — this body, that body, the whole
 * building — and scoring each by how much of the drawn wall lands on drawn
 * wall. The candidates and the margin between them are both reported, because
 * a narrow margin is the difference between "the upstairs is over the house"
 * and "the upstairs is over the garage".
 *
 * **A mass is a region stacked through the storeys that cover it.** Which is
 * what stops a single-storey garage from acquiring a first floor: no upper
 * region lands on it, so its storey span ends where the evidence does.
 *
 * **The dimensioned extent and the walled envelope are different things.** The
 * strip a depth chain measures beyond the last wall is a ZONE — an entrance
 * platform, a terrace, the ground under an eave — and it is recorded as one,
 * because it is the reason the overall depth exceeds the walled depth, and
 * because building it as a room is exactly the failure this stage exists to
 * stop.
 *
 * Nothing here knows the name of any project and nothing here carries a
 * dimension of any real building.
 */
import { round6, stableId } from '@buildapp/source-common'
import type { Checkpoint } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import { adaptiveInkMask, inkChannel, runLengthBands } from '@buildapp/source-cv'
import type { Band, Mask, Raster } from '@buildapp/source-cv'
import type { SourceCoordinateFrame, SourceObservationGraph } from '@buildapp/source-observations'
import type { CoordinateRegistration, DimensionChain, MetricEvidence, MetricEvidenceSet } from '@buildapp/source-metrics'
import { bandWallThickness, decomposePlan, planBodies, planExtent, recutSlivers, walledFirstRegions, wallClusterExtent } from './plan-decomposition.js'
import type { EndSpanDecision, ExtentProvenance, ExtentRefutation, PlanExtent } from './plan-decomposition.js'
import { wallWitness } from './plan-extent.js'
import type { WallWitness } from './plan-extent.js'
import type { GridLine, PlanCallout, PlanDecomposition, PlanRegion } from './plan-decomposition.js'
import type { ExtentSideStatement } from './boundary-completion.js'
import { rectangleRing, ringArea } from './structural-layout.js'
import type {
  AlternativeGroup,
  AttachmentRelation,
  FacadePlaneHypothesis,
  FootprintRegionHypothesis,
  LayoutConflict,
  LayoutGap,
  LayoutQuantity,
  LayoutTrace,
  MassHypothesis,
  PlanRing,
  PlanSide,
  RecessHypothesis,
  StoreyLayoutHypothesis,
} from './structural-layout.js'

export const LAYOUT_INFERENCE_NAME = 'structural-layout'
// 1.1.0 (005L): storeys are registered by wall correspondence and stacked per walled region (the storey-support relation).
export const LAYOUT_INFERENCE_VERSION = '1.1.0'

/** Where a storey sits relative to the others. Ground is the datum; the rest are counted off it. */
export const STOREY_RANK: Record<string, number> = { BASEMENT: -1, GROUND: 0, UPPER: 1, ATTIC: 2, ROOF: 3 }

/**
 * The storey a plan frame is read as. An unlabelled plan is the ground floor's only when no plan in view is
 * labelled GROUND (post-implementation Council A). An adapter that makes no claim for a fragment it cannot
 * place (an upper floor at an unseen index) says "I do not know", and reading that plan as the ground floor
 * beside the real one turned a two-body house into a one-body house without a word.
 */
export const planStoreyOf = (frame: SourceCoordinateFrame, groundLabelled = false): string =>
  frame.roles.storey === 'UNKNOWN' || frame.roles.storey === 'NOT_APPLICABLE' ? (groundLabelled ? 'UNKNOWN' : 'GROUND') : frame.roles.storey

/** Does any of these plan frames say, in so many words, that it is the ground floor? */
export const groundLabelledAmong = (frames: readonly SourceCoordinateFrame[]): boolean => frames.some((f) => f.roles.storey === 'GROUND')

export type PlanBandOptions = { minThickness?: number; maxThickness?: number; minLength?: number }

/** One floor plan, read. */
export type PlanReading = {
  frame: SourceCoordinateFrame
  storey: string
  registration: CoordinateRegistration | undefined
  mask: Mask
  bands: Band[]
  wallPx: number
  extent: PixelRect
  extentWeak: boolean
  extentWhy: string
  /** 005B: chains refused as the building's extent (interior, not spanning the walls), when any were. */
  extentRefused?: string[]
  /** 005B: where each axis of the frame came from. */
  extentProvenance?: { x: ExtentProvenance; y: ExtentProvenance }
  /** 005I: the framing chains' short end segments, kept or trimmed, and the sides the walls contradicted. */
  extentEndSpans?: EndSpanDecision[]
  extentRefutations?: ExtentRefutation[]
  decomposition: PlanDecomposition
}

/**
 * The map from one plan's pixels onto another's.
 *
 * One scale for both axes, because a published drawing is scaled uniformly and
 * fitting two scales to a sheet is fitting its scanner rather than its
 * building.
 */
export type PlanAlignment = {
  scale: number
  offsetX: number
  offsetY: number
  /** The region of the base plan this alignment maps the other plan's walls onto. */
  targetId: string
  targetRect: PixelRect
  /** Where this alignment actually puts the other plan's walls, in the base plan's pixels. */
  placedRect: PixelRect
  /** Fraction of the other plan's wall length that lands on a wall of the base plan. */
  agreement: number
  /** 005L: the long wall the two plans share under this placement, 2·shared / (this plan's + the base's): what decides. */
  shares: number
  /** True when both offsets come from the two plans' own dimension chains rather than from an assumption about how storeys stack. */
  stated: boolean
  score: number
  why: string
}

export type StructuralLayoutOptions = {
  slug: string
  sourcePackageId: string
  sourcePackageHash: string
  graph: SourceObservationGraph
  metrics: MetricEvidenceSet
  /** Decoded pixels for a frame, or undefined where the bytes could not be decoded here. */
  raster: (frame: SourceCoordinateFrame) => Raster | undefined
  /** Restrict to these frames: a mutation test removes a drawing this way. */
  frameFilter?: (frame: SourceCoordinateFrame) => boolean
  bands?: PlanBandOptions
  /**
   * One named reading of the base plan, chosen by the plan resolver (005A)
   * when today's reading stops. Absent, the pass is exactly what it was.
   */
  plan?: PlanReadingChoice
  /** Per-frame pixel work the resolver shares between its readings; never changes an answer. */
  sheetCache?: Map<string, PlanSheet>
  /** Told at each plan copy read, for progress and cancellation. Write-only. */
  checkpoint?: Checkpoint
  /** 005K, experimental: the boundary's drawn-gap rule (`PlanDecompositionOptions.drawnGapRule`). OFF unless asked for. */
  drawnGapRule?: 'OFF' | 'ON'
}

/** The ink, wall bands and wall thickness of one plan copy: a function of its pixels alone. */
export type PlanSheet = { mask: Mask; bands: Band[]; wallPx: number; decompositions: Map<string, PlanDecomposition>; /** 005B: the building's walls from pixels only, which no chain or extent drew. */ witness: WallWitness | null }

/**
 * How the resolver asks for the base plan to be read. Each field is one axis
 * of the search; its first value is today's behaviour.
 */
export type PlanReadingChoice = {
  /** The copy of its storey's plan to read; the storey's other copies are not tried. */
  frameId: string
  /** Where the building is on the sheet: the widest read chains (today), the largest cluster of wall ink, or (005B) the wall witness. */
  extent: 'CHAIN_RECT' | 'WALL_MASS_CLUSTER' | 'WALL_WITNESS'
  /** How built cells become bodies: largest rectangle first (today), or walled rectangle first. */
  merge: 'LARGEST_FIRST' | 'WALLED_FIRST'
  /** Where a body's side sits when only a wall band, no chain, marks it: on the band's axis (today), or on its outer face. */
  faces: 'AS_GRIDDED' | 'OUTER_FACE'
  /** A wide gap in front of a space walled on every other side: the mouth of a pocket (today), or an opening in the wall. */
  mouths: 'AS_DECIDED' | 'SHUT'
  /** Chain statements this reading re-read at another scale: a span resting on one is DERIVED, never MEASURED. */
  rereadEvidenceIds: ReadonlySet<string>
  /** The base plan's printed scale was replaced, so the other storeys are aligned by fit, not by the ratio of printed scales. */
  alignByFitOnly: boolean
}

/**
 * The layout pass's own options, and nothing else its caller carries (005L council C5L-1). The structural pass is
 * handed the publisher's figures to CHECK the layout against; the layout itself never sees them, whatever a caller
 * spreads into its options: every key it may read is named here.
 */
export const LAYOUT_OPTION_KEYS = ['slug', 'sourcePackageId', 'sourcePackageHash', 'graph', 'metrics', 'raster', 'frameFilter', 'bands', 'plan', 'sheetCache', 'checkpoint', 'drawnGapRule'] as const satisfies ReadonlyArray<keyof StructuralLayoutOptions>
export function layoutOptionsOnly(options: StructuralLayoutOptions): StructuralLayoutOptions {
  const out: Record<string, unknown> = {}
  for (const key of LAYOUT_OPTION_KEYS) if (options[key] !== undefined) out[key] = options[key]
  return out as StructuralLayoutOptions
}

/** What `inferStructuralLayout` works out before any of it is sealed into a set. */
export type StructuralLayoutDraft = {
  plans: PlanReading[]
  base: PlanReading | undefined
  /** Metres per pixel on the base plan, the pixel that maps to the world origin, and the chains' own ladder along each axis. */
  frame: WorldFrame | undefined
  alignments: Map<string, PlanAlignment>
  storeys: StoreyLayoutHypothesis[]
  footprintRegions: FootprintRegionHypothesis[]
  masses: MassHypothesis[]
  attachments: AttachmentRelation[]
  facadePlanes: FacadePlaneHypothesis[]
  recesses: RecessHypothesis[]
  alternatives: AlternativeGroup[]
  conflicts: LayoutConflict[]
  unresolved: LayoutGap[]
  traces: LayoutTrace[]
  /** Plan frames the pass looked at and could not read. */
  skippedPlans: SkippedPlan[]
  /**
   * 005L: for every plan of another storey, how it was registered and what each of its walled regions stands on —
   * the record the storey spans and the per-storey footprints were decided from. Diagnostic: it is not sealed into
   * the layout set, whose storeys, masses and footprint regions carry the decision itself.
   */
  storeyRegistrations: StoreyRegistration[]
}

/**
 * 005L: how one walled region of another storey's plan stands on one body of the plan below, once registered.
 *
 * Two questions the old single scalar folded into one. Registration says where the plan sits; support says which
 * body carries each of its walled regions. A 30 m² upper floor over a 100 m² house covers 30 % of the house and is
 * carried by it entirely; a one-storey garage under the corner of a registered plan's bounding box carries nothing.
 */
export type StoreySupportRelation = {
  upperStoreyId: string
  upperFrameId: string
  upperRegionId: string
  lowerMassId: string
  /** The placement it was measured under: target, scale and offsets. */
  alignmentId: string
  intersectionM2: number
  /** intersection / the upper region's area: how much of the region this body carries. */
  upperSupportedShare: number
  /** intersection / the body's area: how much of the body the region covers. Never the criterion on its own. */
  lowerCoveredShare: number
  /** The overlap's extent along x and z, in metres. */
  overlapM: { x: number; z: number }
  /** How much of the plan's wall landed on wall under this placement. */
  wallAgreement: number
  /**
   * SUPPORTS: the region stands on the body over at least a room's span along both axes. INCIDENTAL: they overlap,
   * but by less than that — a wall's thickness, a registration's jitter, an eave — which carries nothing. NONE.
   */
  supportStatus: 'SUPPORTS' | 'INCIDENTAL' | 'NONE'
  evidenceIds: string[]
  why: string
}

/** 005L: one walled region of another storey's plan, as the support relation weighed it. */
export type UpperRegionRecord = {
  regionId: string
  /** In its own plan's pixels. */
  pixelRect: PixelRect
  /** Registered onto the plan below, in world metres. */
  bounds: { x0: number; z0: number; x1: number; z1: number }
  areaM2: number
  /** Share of its own perimeter drawn as wall. */
  wallFraction: number
  /** Share of its own perimeter drawn as wall of a storey's thickness (005L council A5L-8). */
  storeyWallFraction: number
  /** False when it is no storey's body: line work round it, or narrower than two walls and a room. */
  body: boolean
  /** Area standing on no body below, after the bodies that carry or touch it. */
  unsupportedM2: number
  overhang: 'NONE' | 'WITHIN_TOLERANCE' | 'BEYOND_TOLERANCE' | 'UNSUPPORTED' | 'NOT_A_BODY'
  why: string
}

/** 005L: one plan of another storey: its registration, its walled regions and what each stands on. */
export type StoreyRegistration = {
  frameId: string
  storeyId: string
  storeyIndex: number
  declaredRole: string
  /** How many distinct placements were weighed, and the chosen one. */
  candidates: number
  chosen?: { targetId: string; scale: number; offsetX: number; offsetY: number; agreement: number; score: number; stated: boolean }
  /** The best placement that stands the storey on other bodies, or on the same ones materially differently. */
  rival?: { targetId: string; scale: number; offsetX: number; offsetY: number; score: number; masses: string[] }
  margin?: number
  /** How finely the walls tell two placements apart; a rival nearer than this is a tie (005L council A5L-7). */
  resolution?: number
  /** Where both plans print a scale and the best fit is at another: whether the printed scale stood (005L council A5L-1). */
  printedScale?: { k: number; sharesAgainstFit: number; bodyInsideBelow: boolean; outcome: 'HELD' | 'REFUTED' }
  decision: 'STACKED' | 'AMBIGUOUS' | 'NOT_REGISTERED' | 'NO_SUPPORT'
  regions: UpperRegionRecord[]
  relations: StoreySupportRelation[]
  why: string
}

const DEFAULT_BANDS: Required<PlanBandOptions> = { minThickness: 6, maxThickness: 40, minLength: 24 }

/**
 * How much of a region's perimeter must be drawn as wall for it to be a body.
 *
 * Low, because a real building's perimeter includes glazing, doors and garage
 * openings, and a house with a fully glazed garden wall is still a house. High
 * enough that a rectangle of paving with a kerb round it is not.
 */
const MIN_MASS_WALL_FRACTION = 0.35

/**
 * The narrowest a walled body can be, in metres: two of its own walls and a
 * little room between them. A strip narrower than this is the thickness of a
 * wall, a step between two outer faces, or a pier — ring walls on it would
 * meet each other before they met anything else.
 */
const minBodySpanM = (wallM: number): number => Math.max(1, 2 * wallM + 0.2)

const quantity = (value: number, low: number, high: number, unit: LayoutQuantity['unit'], basis: LayoutQuantity['basis'], evidenceIds: string[], why: string): LayoutQuantity => ({
  value: round6(value),
  low: round6(low),
  high: round6(high),
  unit,
  basis,
  evidenceIds,
  why,
})

// ---------------------------------------------------------------------------
// 1. reading the plans
// ---------------------------------------------------------------------------

/**
 * Every floor plan in the package, decomposed.
 *
 * One frame per storey: the largest dimensioned copy, because a bigger raster
 * of the same drawing carries the same lines at more pixels and a dimensioned
 * copy carries the chains that turn them into metres.
 */
/** A plan frame the pass looked at and did not read, and why. */
export type SkippedPlan = { frameId: string; code: 'NOT_DECODABLE' | 'NO_EXTENT' | 'STOREY_UNKNOWN'; longBands?: number; why: string }

export function readPlans(options: StructuralLayoutOptions): { plans: PlanReading[]; unresolved: LayoutGap[]; skipped: SkippedPlan[] } {
  const keep = options.frameFilter
  const bandOptions = { ...DEFAULT_BANDS, ...options.bands }
  const unresolved: LayoutGap[] = []
  const skipped: SkippedPlan[] = []
  const byStorey = new Map<string, SourceCoordinateFrame[]>()
  const planFrames = options.graph.coordinateFrames.filter((f) => f.roles.projection === 'ORTHOGRAPHIC_PLAN' && f.roles.document === 'FLOOR_PLAN' && (!keep || keep(f)))
  const groundLabelled = groundLabelledAmong(planFrames)
  for (const frame of planFrames) {
    const storey = planStoreyOf(frame, groundLabelled)
    if (storey === 'UNKNOWN') {
      const why = 'no storey is claimed for it and another plan is labelled the ground floor: which floor it draws cannot be told, so it is not read'
      skipped.push({ frameId: frame.id, code: 'STOREY_UNKNOWN', why })
      unresolved.push({ id: stableId('gap', 'plan-storey', { frameId: frame.id }), what: 'which storey an unlabelled floor plan draws', reason: why, status: 'MISSING', frameIds: [frame.id] })
      continue
    }
    if (!(storey in STOREY_RANK)) continue
    byStorey.set(storey, [...(byStorey.get(storey) ?? []), frame])
  }

  const plans: PlanReading[] = []
  const choice = options.plan
  for (const [storey, frames] of [...byStorey].sort((a, b) => STOREY_RANK[a[0]] - STOREY_RANK[b[0]])) {
    const chosen = choice ? frames.find((f) => f.id === choice.frameId) : undefined
    const ordered = chosen
      ? [chosen]
      : [...frames].sort((a, b) => {
          const dimensioned = (f: SourceCoordinateFrame): number => (f.roles.annotation === 'DIMENSIONED' ? 1 : 0)
          return dimensioned(b) - dimensioned(a) || b.size.width * b.size.height - a.size.width * a.size.height || a.id.localeCompare(b.id)
        })
    let read = false
    for (const frame of ordered) {
      options.checkpoint?.tick({ subphase: { id: 'PLAN_READ', label: `reading the ${storey.toLowerCase()} plan` } })
      const sheet = planSheet(frame, options, bandOptions)
      if (!sheet) {
        skipped.push({ frameId: frame.id, code: 'NOT_DECODABLE', why: 'its bytes could not be decoded here' })
        continue
      }
      const { mask, bands, wallPx } = sheet
      const chains = options.metrics.chains.filter((c) => c.frameId === frame.id)
      const cluster = chosen === frame && choice?.extent === 'WALL_MASS_CLUSTER' ? wallClusterExtent(mask, wallPx) : undefined
      const witnessed = chosen === frame && choice?.extent === 'WALL_WITNESS' && sheet.witness ? sheet.witness : undefined
      const extent: PlanExtent | null = cluster
        ? { rect: cluster.rect, weak: false, why: cluster.why }
        : witnessed
          ? { rect: witnessed.rect, weak: true, why: `the wall witness: ${witnessed.why}`, provenance: { x: 'WALL_GEOMETRY_EXTENT', y: 'WALL_GEOMETRY_EXTENT' } }
          : planExtent(chains, bands, wallPx, sheet.witness, options.metrics.dimensionObservations?.filter((o) => o.frameId === frame.id))
      if (!extent) {
        const longBands = bands.filter((b) => b.length >= wallPx * 2.5).length
        skipped.push({ frameId: frame.id, code: 'NO_EXTENT', longBands, why: `no dimension chain on it read a value and its ${longBands} long wall band${longBands === 1 ? '' : 's'} do not run along both axes` })
        continue
      }
      const registration =
        options.metrics.coordinateRegistrations.find((r) => r.frameId === frame.id && r.plane === 'PLAN_XZ') ??
        // A plan with no chains of its own has no scale of its own either. It
        // is still worth decomposing — the shape of its walls is what the
        // storey registration matches on — so it borrows a unit scale and is
        // never allowed to state a metre.
        placeholderRegistration(frame)
      // The decomposition is a function of the pixels, the extent and the scale; the
      // resolver asks for the same one under several merges and faces.
      const shutMouths = chosen === frame && choice?.mouths === 'SHUT'
      const key = `${extent.rect.x0},${extent.rect.y0},${extent.rect.x1},${extent.rect.y1}|${registration.metresPerPixelX},${registration.metresPerPixelY}${shutMouths ? '|mouths-shut' : ''}`
      const decomposition = sheet.decompositions.get(key) ?? decomposePlan(mask, chains, bands, registration, extent.rect, { callouts: planCallouts(options.metrics, frame.id), sheetWallPx: wallPx, exteriorTicks: exteriorTicksOf(chains, extent.roles), extentSides: extentSidesOf(chains, extent, wallPx), checkpoint: options.checkpoint, ...(shutMouths ? { shutPocketMouths: true } : {}), ...(options.drawnGapRule === 'ON' ? { drawnGapRule: 'ON' as const } : {}) })
      sheet.decompositions.set(key, decomposition)
      plans.push({
        frame,
        storey,
        registration: options.metrics.coordinateRegistrations.find((r) => r.frameId === frame.id && r.plane === 'PLAN_XZ'),
        mask,
        bands,
        wallPx,
        extent: extent.rect,
        extentWeak: extent.weak,
        extentWhy: extent.why,
        ...(extent.refused && extent.refused.length > 0 ? { extentRefused: extent.refused } : {}),
        ...(extent.provenance ? { extentProvenance: extent.provenance } : {}),
        ...(extent.endSpans && extent.endSpans.length > 0 ? { extentEndSpans: extent.endSpans } : {}),
        ...(extent.refutations && extent.refutations.length > 0 ? { extentRefutations: extent.refutations } : {}),
        decomposition,
      })
      read = true
      break
    }
    if (!read) {
      unresolved.push({
        id: stableId('gap', `plan-${storey.toLowerCase()}`, { storey }),
        what: `a decomposable plan of the ${storey.toLowerCase()} storey`,
        reason: 'none of this storey’s plans could be decoded, or none carried a chain or a wall to frame it with',
        status: 'MISSING',
        frameIds: frames.map((f) => f.id),
      })
    }
  }
  return { plans, unresolved, skipped }
}

/**
 * The ink mask, wall bands and wall thickness of one plan copy, from its
 * pixels alone — computed once per frame when a cache is supplied.
 *
 * Two band passes. The first is deliberately permissive and exists only to
 * measure the thickness this drawing draws a wall at; the second looks for
 * walls AT that thickness. A fixed window cannot do both jobs — it is either
 * wide enough to find a wall on a small raster, in which case it also finds
 * every hatch and leader line on a large one, or narrow enough to reject those
 * and blind to half the walls on the small one.
 */
export function planSheet(frame: SourceCoordinateFrame, options: StructuralLayoutOptions, bandOptions: Required<PlanBandOptions> = { ...DEFAULT_BANDS, ...options.bands }): PlanSheet | undefined {
  const cached = options.sheetCache?.get(frame.id)
  if (cached) return cached
  const raster = options.raster(frame)
  if (!raster) return undefined
  const mask = adaptiveInkMask(inkChannel(raster), {})
  const survey = runLengthBands(mask, bandOptions)
  const wallPx = bandWallThickness(survey, DEFAULT_BANDS.minThickness * 2)
  const bands = runLengthBands(mask, {
    minThickness: Math.max(3, Math.round(wallPx * 0.45)),
    maxThickness: Math.max(6, Math.round(wallPx * 1.9)),
    minLength: Math.max(8, Math.round(wallPx * 1.6)),
  })
  const sheet: PlanSheet = { mask, bands, wallPx, decompositions: new Map(), witness: wallWitness(bands, wallPx, mask) }
  options.sheetCache?.set(frame.id, sheet)
  return sheet
}

/**
 * The ticks of a plan's exterior dimension chains, read or not (005C): where the drawing says a facade's face is,
 * whatever its labels read. Horizontal chains tick x positions, vertical ones y positions.
 */
export function exteriorTicksOf(chains: readonly DimensionChain[], roles: PlanExtent['roles']): { x: number[]; y: number[] } {
  const exterior = new Set((roles ?? []).filter((r) => r.role === 'EXTERIOR').map((r) => r.chainId))
  const x = new Set<number>()
  const y = new Set<number>()
  for (const c of chains) {
    if (!exterior.has(c.id)) continue
    for (const t of c.ticksPx) (c.axis === 'HORIZONTAL' ? x : y).add(t)
  }
  return { x: [...x].sort((a, b) => a - b), y: [...y].sort((a, b) => a - b) }
}

/**
 * 005F (pre-review C): the sides of the plan's extent its exterior dimension chains state. A side is SUPPORTED when an
 * exterior chain that covers the wall witness ends on it within a wall, on a mark not rejected; STRONG when two such
 * chains on lines more than one wall apart end within a wall of each other, or one of them is closed by its own
 * readings alone (no value restated or chosen by a scale). A side the extent took from the walls themselves is stated by
 * nothing. Chain geometry decides where a side is; printed values only whether one chain alone is strong.
 */
export function extentSidesOf(chains: readonly DimensionChain[], extent: PlanExtent, wallPx: number): ExtentSideStatement[] {
  const roles = new Map((extent.roles ?? []).map((r) => [r.chainId, r]))
  const E = extent.rect
  const sides: Array<{ side: ExtentSideStatement['side']; axis: 'HORIZONTAL' | 'VERTICAL'; at: number; low: boolean; provenance?: string }> = [
    { side: 'W', axis: 'HORIZONTAL', at: E.x0, low: true, provenance: extent.provenance?.x },
    { side: 'E', axis: 'HORIZONTAL', at: E.x1, low: false, provenance: extent.provenance?.x },
    { side: 'N', axis: 'VERTICAL', at: E.y0, low: true, provenance: extent.provenance?.y },
    { side: 'S', axis: 'VERTICAL', at: E.y1, low: false, provenance: extent.provenance?.y },
  ]
  const out: ExtentSideStatement[] = []
  for (const d of sides) {
    if (d.provenance === 'WALL_GEOMETRY_EXTENT') continue
    const stating = chains.filter((c) => {
      if (c.axis !== d.axis) return false
      const role = roles.get(c.id)
      if (!role || role.role !== 'EXTERIOR' || !role.coversWitness) return false
      const i = d.low ? 0 : c.ticksPx.length - 1
      if (Math.abs(c.ticksPx[i] - d.at) > wallPx) return false
      return c.marks?.length === c.ticksPx.length ? c.marks[i].class !== 'REJECTED' : true
    })
    if (stating.length === 0) continue
    // two chains on lines more than a wall apart whose ends agree within a wall (contract B1, C5F-9)
    const endOf = (c: DimensionChain): number => c.ticksPx[d.low ? 0 : c.ticksPx.length - 1]
    const twoLines = stating.some((a, i) => stating.slice(i + 1).some((b) => Math.abs(a.baselinePx - b.baselinePx) > wallPx && Math.abs(endOf(a) - endOf(b)) <= wallPx))
    // one chain is strong when its own readings close it: at least two READ segments and none restated from a scale
    // (DERIVED) or chosen by one (CHAIN_CORRECTED) — post-review D5F-5
    const readAndCloses = stating.some((c) => c.closes && c.segments.filter((g) => g.origin === 'READ').length >= 2 && c.segments.every((g) => g.origin === 'READ'))
    out.push({ side: d.side, atPx: round6(d.at), strength: twoLines || readAndCloses ? 'STRONG' : 'SUPPORTED', chainIds: stating.map((c) => c.id).sort() })
  }
  return out
}

/** The opening callouts printed on one plan, as the decomposition weighs them: where each sits and every width it might say. */
export function planCallouts(metrics: MetricEvidenceSet, frameId: string): PlanCallout[] {
  return metrics.evidence
    .filter((e) => e.kind === 'OPENING_CALLOUT' && e.frameId === frameId && e.textBox !== undefined)
    .map((e) => {
      const box = e.textBox as PixelRect
      const widths = [{ value: e.value, confidence: e.confidence }, ...e.alternatives.filter((a) => a.why.startsWith('width')).map((a) => ({ value: a.value, confidence: a.confidence }))]
      const seen = new Set<number>()
      return {
        id: e.id,
        at: { x: round6((box.x0 + box.x1) / 2), y: round6((box.y0 + box.y1) / 2) },
        widthsCm: widths.filter((w) => (seen.has(w.value) ? false : (seen.add(w.value), true))),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** A unit-scale registration for a plan that states no scale: enough to decompose with, never enough to measure with. */
function placeholderRegistration(frame: SourceCoordinateFrame): CoordinateRegistration {
  return {
    id: `reg-unscaled-${frame.id}`,
    frameId: frame.id,
    assetId: frame.assetId,
    variantByteHash: frame.variantByteHash,
    plane: 'PLAN_XZ',
    metresPerPixelX: 1,
    metresPerPixelY: 1,
    anisotropy: 1,
    originPx: { x: 0, y: 0 },
    flipX: false,
    flipY: false,
    anchors: [],
    rejected: [],
    residual: { rmsM: 0, maxM: 0, rmsPx: 0 },
    confidence: 0,
    provenance: { extractor: 'DERIVED', name: LAYOUT_INFERENCE_NAME, detail: 'this plan states no scale; its pixels are kept as pixels' },
  }
}

/**
 * Which plan the building's coordinates come from.
 *
 * The one with a real registration, a walled envelope, the most wall drawn on
 * it and a frame its own chains agree with. In practice that is the ground
 * floor of a dimensioned set, and it is chosen on those properties rather than
 * on its storey so that a package which dimensions only its upper floor is
 * measured off the drawing that states something.
 */
export function chooseBasePlan(plans: readonly PlanReading[]): PlanReading | undefined {
  const score = (p: PlanReading): number =>
    (p.registration ? 2 : 0) +
    (p.decomposition.envelope ? 2 : 0) +
    (p.extentWeak ? 0 : 1) +
    Math.min(1.5, p.bands.reduce((a, b) => a + b.length, 0) / 2000) +
    (p.storey === 'GROUND' ? 0.75 : 0) -
    (p.registration ? p.registration.residual.rmsM * 2 : 0)
  return [...plans].sort((a, b) => score(b) - score(a) || a.frame.id.localeCompare(b.frame.id))[0]
}

// ---------------------------------------------------------------------------
// 2. registering one storey onto another
// ---------------------------------------------------------------------------

const centre = (r: PixelRect): { x: number; y: number } => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 })
const width = (r: PixelRect): number => r.x1 - r.x0
const height = (r: PixelRect): number => r.y1 - r.y0

/**
 * A strip of an outline frame: a body whose narrow side is under a quarter of the widest body's (005C
 * post-review). The largest-first cut of a stepped outline leaves them along a face; an upper storey registered
 * onto one, or a strip taken for the main body, puts the house on its porch.
 */
const STRIP_SHARE = 0.25
function stripsOf<T>(items: readonly T[], rectOf: (item: T) => { w: number; h: number }): Set<T> {
  const widest = Math.max(0, ...items.map((i) => Math.min(rectOf(i).w, rectOf(i).h)))
  return new Set(items.filter((i) => Math.min(rectOf(i).w, rectOf(i).h) < widest * STRIP_SHARE))
}

/** Candidate targets on the base plan: each of its masses (on an outline frame, none of its strips), and the whole building. */
export function alignmentTargets(base: PlanReading): Array<{ id: string; rect: PixelRect }> {
  const out: Array<{ id: string; rect: PixelRect }> = []
  const built = base.decomposition.regions.filter((r) => r.classification === 'BUILT')
  const strips = base.decomposition.envelope?.outline ? stripsOf(built, (r) => ({ w: (r.rect.x1 - r.rect.x0) * (base.registration?.metresPerPixelX ?? 1), h: (r.rect.y1 - r.rect.y0) * (base.registration?.metresPerPixelY ?? 1) })) : new Set<PlanRegion>()
  for (const region of built) if (!strips.has(region)) out.push({ id: region.id, rect: region.rect })
  if (base.decomposition.envelope) out.push({ id: 'envelope', rect: base.decomposition.envelope.rect })
  // 005F: a room the boundary completed against the house (`boundary-completion.ts`) widens the envelope, and an
  // upper storey over the house is then no longer the envelope's shape. The house without its attached rooms is the
  // other reading, named as such: which of the two the upper plan stands on is the walls' question, as for any target.
  const tolerance = base.wallPx
  const attached = (base.decomposition.boundary?.completions ?? []).filter((p) => p.decision === 'ACCEPTED' && p.kind === 'ATTACHED_ROOM').map((p) => p.rect)
  const inside = (r: PixelRect, c: PixelRect): boolean => r.x0 >= c.x0 - tolerance && r.x1 <= c.x1 + tolerance && r.y0 >= c.y0 - tolerance && r.y1 <= c.y1 + tolerance
  const house = built.filter((r) => !attached.some((c) => inside(r.rect, c)))
  if (base.decomposition.envelope && attached.length > 0 && house.length > 0 && house.length < built.length) {
    out.push({
      id: 'envelope-without-attached',
      rect: { x0: Math.min(...house.map((r) => r.rect.x0)), y0: Math.min(...house.map((r) => r.rect.y0)), x1: Math.max(...house.map((r) => r.rect.x1)), y1: Math.max(...house.map((r) => r.rect.y1)) },
    })
  }
  return out
}

/**
 * 005L: a facade wall is a long one. A band at least this share of the longest band along its axis can be one of a
 * storey's outer walls; the strokes of a title block, a logo or a stair annotation cannot, and pairing them would
 * scale the plan by the size of a letter.
 */
const FACADE_WALL_SHARE = 0.25
/** How many of the outermost facade walls at each end of an axis are tried: an eave line, a terrace edge or a roof outline may lie outside the wall itself. */
const OUTER_WALLS_PER_END = 4
/** Two walls closer than this many wall thicknesses are not a span a storey's scale can be read from. */
const MIN_WALL_PAIR_SPAN_WALLS = 4
/** The most two plans of one building are drawn apart in scale: further is a pairing of unrelated walls. */
const MAX_WALL_PAIR_SCALE = 3
/** A placement both drawings state stands unless the best fit shares more than this many times as much wall (005L). */
const STATED_HOLDS_SHARE = 0.5
/** How many offsets along each axis a placement at the plan below's own scale tries: the ones landing the most wall. */
const SAME_SCALE_OFFSETS_PER_AXIS = 6
/**
 * How far the scale one pair of walls fixes along x may differ from the one a pair fixes along z and still be one
 * drawing's scale: a wall's axis is read to a pixel or two across a span of hundreds.
 */
const WALL_PAIR_SCALE_AGREEMENT = 0.02

/**
 * How much of `other`'s wall, along one axis, lands on `base`'s wall under `px · scale + offset` (005L): the length of
 * wall the two plans share once placed, in `base`'s pixels.
 *
 * Wall on wall, not axis on axis: a band counts for the stretch of it that lies ON the nearest base band within
 * `tolerance` of its mapped axis, never for lying anywhere on that band's line. And once: a stretch of base wall is
 * landed on at most once, however many of this plan's walls are mapped onto it. Matching axes alone, or counting a
 * base wall again for every wall squeezed onto it, lets a plan shrunk onto the busiest strip of the plan below agree
 * with walls it never touches.
 */
function matchedLength(other: readonly Band[], base: readonly Band[], scale: number, offsetAcross: number, offsetAlong: number, tolerance: number): number {
  const landed = new Map<number, Array<[number, number]>>()
  for (const band of other) {
    const at = band.axisPx * scale + offsetAcross
    const vertical = band.axis === 'VERTICAL'
    const s0 = (vertical ? band.bounds.y0 : band.bounds.x0) * scale + offsetAlong
    const s1 = (vertical ? band.bounds.y1 : band.bounds.x1) * scale + offsetAlong
    if (s1 <= s0) continue
    let nearest = Infinity
    let on: Array<{ index: number; lo: number; hi: number }> = []
    base.forEach((b, index) => {
      const d = Math.abs(b.axisPx - at)
      if (d > tolerance) return
      const lo = Math.max(s0, (vertical ? b.bounds.y0 : b.bounds.x0) - tolerance)
      const hi = Math.min(s1, (vertical ? b.bounds.y1 : b.bounds.x1) + tolerance)
      if (hi <= lo) return
      // collinear pieces of one wall are equally near; a parallel wall further off is not this one
      if (d < nearest - 0.5) {
        nearest = d
        on = [{ index, lo, hi }]
      } else if (d <= nearest + 0.5) on.push({ index, lo, hi })
    })
    for (const o of on) landed.set(o.index, [...(landed.get(o.index) ?? []), [o.lo, o.hi]])
  }
  let covered = 0
  for (const pieces of landed.values()) {
    pieces.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    let [lo, hi] = pieces[0]
    for (const [a, b] of pieces.slice(1)) {
      if (a > hi) {
        covered += hi - lo
        lo = a
        hi = b
      } else hi = Math.max(hi, b)
    }
    covered += hi - lo
  }
  return covered
}

/**
 * The positions of a plan's facade walls along one axis: its facade-length bands, the few outermost at each end, a
 * wall apart — and the lines its own decomposition already took for its outer walls (`extra`: the envelope's sides
 * and the largest walled region's), because a facade drawn mostly in glass is a row of short stubs and no band of it
 * is long.
 */
export function outerWallAxes(bands: readonly Band[], wallPx: number, extra: readonly number[] = []): { lows: number[]; highs: number[] } {
  if (bands.length === 0 && extra.length === 0) return { lows: [], highs: [] }
  const longest = Math.max(0, ...bands.map((b) => b.length))
  const positions = bands
    .filter((b) => b.length >= longest * FACADE_WALL_SHARE)
    .map((b) => b.axisPx)
    .sort((a, b) => a - b)
  const distinct: number[] = []
  for (const p of positions) if (distinct.length === 0 || p - distinct[distinct.length - 1] > wallPx) distinct.push(p)
  const lows = distinct.slice(0, OUTER_WALLS_PER_END)
  const highs = distinct.slice(-OUTER_WALLS_PER_END)
  // a line of the decomposition joins the end it lies nearer, unless a band already stands within a wall of it
  const mid = distinct.length > 0 ? (distinct[0] + distinct[distinct.length - 1]) / 2 : extra.reduce((a, b) => a + b, 0) / Math.max(1, extra.length)
  for (const e of [...extra].sort((a, b) => a - b)) {
    const list = e <= mid ? lows : highs
    if (!list.some((p) => Math.abs(p - e) <= wallPx)) list.push(e)
  }
  return { lows: lows.sort((a, b) => a - b), highs: highs.sort((a, b) => a - b) }
}

/** The length of `other`'s bands whose axis lands within `tolerance` of a base band's axis: a cheap first sort of offsets, never a score. */
function axisMatch(other: readonly Band[], base: readonly Band[], scale: number, offset: number, tolerance: number): number {
  let matched = 0
  for (const band of other) if (base.some((b) => Math.abs(b.axisPx - (band.axisPx * scale + offset)) <= tolerance)) matched += band.length
  return matched
}

/** A plan's largest walled region, by its rectangle's area. */
const largestBuilt = (plan: PlanReading): PlanRegion | undefined =>
  [...plan.decomposition.regions.filter((r) => r.classification === 'BUILT')].sort((a, b) => width(b.rect) * height(b.rect) - width(a.rect) * height(a.rect) || a.id.localeCompare(b.id))[0]

/**
 * Align one plan's walls onto another's, choosing among a bounded set of
 * targets and scoring each by how much wall lands on wall.
 *
 * Deliberately a discrete search over a handful of named hypotheses rather
 * than a continuous fit, because the question is discrete: an upper storey
 * sits over THIS body or over THAT one, and a least-squares fit asked to
 * decide between them will happily return the average of the two, which is a
 * building that exists nowhere.
 */
export function alignPlans(base: PlanReading, other: PlanReading, options: { maxAnisotropy?: number; coverageWeight?: number; statedBonus?: number; useStated?: boolean; wallPairs?: boolean } = {}): PlanAlignmentReading {
  const maxAnisotropy = options.maxAnisotropy ?? 1.15
  const coverageWeight = options.coverageWeight ?? 0.15
  const statedBonus = options.statedBonus ?? 0.03
  const source = other.decomposition.envelope?.rect ?? other.extent
  const envelope = base.decomposition.envelope?.rect ?? base.extent
  const considered: PlanAlignment[] = []
  if (width(source) <= 0 || height(source) <= 0) return { best: undefined, considered }

  // Only the bands inside each plan's own frame: a sheet carries a logo and a
  // title block drawn as heavily as a wall, and matching one plan's logo onto
  // another's is a correspondence with nothing behind it.
  const within = (b: Band, rect: PixelRect): boolean =>
    b.axis === 'VERTICAL' ? b.axisPx >= rect.x0 && b.axisPx <= rect.x1 : b.axisPx >= rect.y0 && b.axisPx <= rect.y1
  const longEnough = (b: Band, wall: number): boolean => b.length >= wall * 2.5
  const baseAxes = {
    VERTICAL: base.bands.filter((b) => b.axis === 'VERTICAL' && longEnough(b, base.wallPx) && within(b, base.extent)),
    HORIZONTAL: base.bands.filter((b) => b.axis === 'HORIZONTAL' && longEnough(b, base.wallPx) && within(b, base.extent)),
  }
  const otherAxes = {
    VERTICAL: other.bands.filter((b) => b.axis === 'VERTICAL' && longEnough(b, other.wallPx) && within(b, other.extent)),
    HORIZONTAL: other.bands.filter((b) => b.axis === 'HORIZONTAL' && longEnough(b, other.wallPx) && within(b, other.extent)),
  }
  const totalLength = [...otherAxes.VERTICAL, ...otherAxes.HORIZONTAL].reduce((a, b) => a + b.length, 0)
  if (totalLength === 0) return { best: undefined, considered }
  const tolerance = Math.max(3, base.wallPx / 2)
  // 005L: the walls a placement is judged by. A plan's long walls are its structure; its short bands are as likely
  // the ticks of a rafter line, the strokes of a logo, a hatched step or a heavy piece of furniture, and they are in
  // both plans in different places. Judged on everything, a placement is rewarded or penalised for that ink as much
  // as for the walls — and the more of a plan is noise, the more the judgement leans on how far it is scaled.
  const major = (bands: readonly Band[]): Band[] => {
    const longest = Math.max(0, ...bands.map((b) => b.length))
    return bands.filter((b) => b.length >= longest * FACADE_WALL_SHARE)
  }
  const baseMajor = { VERTICAL: major(baseAxes.VERTICAL), HORIZONTAL: major(baseAxes.HORIZONTAL) }
  const otherMajor = { VERTICAL: major(otherAxes.VERTICAL), HORIZONTAL: major(otherAxes.HORIZONTAL) }
  const baseMajorLength = [...baseMajor.VERTICAL, ...baseMajor.HORIZONTAL].reduce((a, b) => a + b.length, 0)
  const otherMajorLength = [...otherMajor.VERTICAL, ...otherMajor.HORIZONTAL].reduce((a, b) => a + b.length, 0)

  // The scales worth trying, and nothing between them. Each one is a
  // STATEMENT about the two drawings rather than a parameter to be tuned:
  // either the two plans state their own scales, in which case the ratio of
  // those is the scale and there is nothing to search, or one plan states
  // none and the only way in is to assume it covers some part of the plan
  // below exactly.
  const stated =
    options.useStated !== false && base.registration && other.registration
      ? {
          k: (other.registration.metresPerPixelX / base.registration.metresPerPixelX + other.registration.metresPerPixelY / base.registration.metresPerPixelY) / 2,
          anisotropy:
            Math.max(other.registration.metresPerPixelX / base.registration.metresPerPixelX, other.registration.metresPerPixelY / base.registration.metresPerPixelY) /
            Math.max(1e-9, Math.min(other.registration.metresPerPixelX / base.registration.metresPerPixelX, other.registration.metresPerPixelY / base.registration.metresPerPixelY)),
        }
      : undefined

  /** One placement of this plan on the base plan, weighed: how much wall lands on wall, and how much of the building below it covers. */
  const candidate = (scale: number, offsetX: number, offsetY: number, target: { id: string; rect: PixelRect }, isStated: boolean, how: string, claimed: PixelRect = source): PlanAlignment => {
    const shared = matchedLength(otherAxes.VERTICAL, baseAxes.VERTICAL, scale, offsetX, offsetY, tolerance) + matchedLength(otherAxes.HORIZONTAL, baseAxes.HORIZONTAL, scale, offsetY, offsetX, tolerance)
    const agreement = round6(Math.min(1, shared / Math.max(1e-9, scale) / totalLength))
    // Wall on wall, from both sides (005L): the long wall the two plans share once this one is placed, against the long
    // wall both of them draw — 2·shared / (this plan's, placed, + the plan below's), all in the plan below's pixels.
    // Neither side alone can choose a scale. As a share of this plan's wall it rises as the plan shrinks, until a plan
    // squeezed into the densest strip below lands all of its little wall on wall; as a share of the plan below's it
    // rises as the plan is stretched across walls it does not draw. Over both, a placement gains only by sharing wall.
    const sharedMajor = matchedLength(otherMajor.VERTICAL, baseMajor.VERTICAL, scale, offsetX, offsetY, tolerance) + matchedLength(otherMajor.HORIZONTAL, baseMajor.HORIZONTAL, scale, offsetY, offsetX, tolerance)
    const shares = round6((2 * sharedMajor) / Math.max(1e-9, scale * otherMajorLength + baseMajorLength))
    // §20's simple-explanation prior, as a small thumb on the scale and
    // not more: an upper storey usually covers most of the storey below,
    // so where two targets explain the walls equally well the larger is
    // the likelier reading. It must never outweigh the walls themselves.
    // The rectangle this placement claims for the storey: the plan's envelope for a fitted placement, the four walls
    // it pairs for a placement by the walls (005L) — not the envelope, which on a sheet with a mark beside the plan is
    // the plan and the mark together.
    const placed: PixelRect = { x0: claimed.x0 * scale + offsetX, y0: claimed.y0 * scale + offsetY, x1: claimed.x1 * scale + offsetX, y1: claimed.y1 * scale + offsetY }
    // Covering all of the storey below is the likeliest reading; covering
    // TWICE it is not a simpler explanation but a wrong one, so the prior
    // has to fall away past a full covering rather than keep climbing.
    const ratio = (width(placed) * height(placed)) / Math.max(1, width(envelope) * height(envelope))
    const coverage = round6(ratio <= 1 ? Math.max(0, ratio) : Math.max(0, 2 - ratio))
    // Where the storey sits is stated by its own chains or guessed from
    // how storeys usually stack, and the two must not be weighed as if
    // they were the same kind of thing. The bonus is small enough that
    // any real difference in how the walls line up still decides.
    return {
      scale: round6(scale),
      offsetX: round6(offsetX),
      offsetY: round6(offsetY),
      targetId: target.id,
      targetRect: target.rect,
      placedRect: { x0: round6(placed.x0), y0: round6(placed.y0), x1: round6(placed.x1), y1: round6(placed.y1) },
      agreement,
      shares,
      stated: isStated,
      score: round6(shares + coverageWeight * coverage + (isStated ? statedBonus : 0)),
      why: `${Math.round(agreement * 100)}% of this plan's wall lands on wall and the two plans share ${Math.round(shares * 100)}% of their long walls ${how}, covering ${Math.round(coverage * 100)}% of the building below`,
    }
  }

  for (const target of alignmentTargets(base)) {
    const sx = width(target.rect) / width(source)
    const sy = height(target.rect) / height(source)
    const fitted = Math.max(sx, sy) / Math.max(1e-9, Math.min(sx, sy))
    const scales: Array<{ k: number; why: string; stated: boolean }> = []
    if (stated && stated.anisotropy <= maxAnisotropy) scales.push({ k: stated.k, why: 'the scale both plans print on their own chains', stated: true })
    if (Number.isFinite(fitted) && fitted <= maxAnisotropy) scales.push({ k: (sx + sy) / 2, why: `the scale that makes this plan the size of ${target.id}`, stated: false })
    for (const { k: scale, why: scaleWhy, stated: scaleStated } of scales) {
      if (!Number.isFinite(scale) || scale <= 0) continue
      // An upper storey does not have to be concentric with the one below. It
      // steps back from one wall and stays flush with the other, so the
      // offsets worth trying are the ones that put a face of this plan on a
      // face of the target — plus the centre, for the case where it is inset
      // all round. Nine of them, discrete, each one a claim about which walls
      // continue up.
      const sc = centre(source)
      const tc = centre(target.rect)
      const offsetsX = [
        { v: target.rect.x0 - source.x0 * scale, stated: false, why: 'flush at its min x face' },
        { v: target.rect.x1 - source.x1 * scale, stated: false, why: 'flush at its max x face' },
        { v: tc.x - sc.x * scale, stated: false, why: 'centred across x' },
      ]
      const offsetsY = [
        { v: target.rect.y0 - source.y0 * scale, stated: false, why: 'flush at its min z face' },
        { v: target.rect.y1 - source.y1 * scale, stated: false, why: 'flush at its max z face' },
        { v: tc.y - sc.y * scale, stated: false, why: 'centred across z' },
      ]
      // And where the two plans' OWN CHAINS put this storey. A plan that
      // prints the whole building's depth and then breaks it where its own
      // walls start has said, in its own numbers, how far in it sits — and
      // that is the one candidate here which is a reading of the drawings
      // rather than an assumption about how storeys usually stack.
      if (base.registration && other.registration) {
        const px = (v: number, axis: 'x' | 'y'): number => {
          const mpp = axis === 'x' ? other.registration!.metresPerPixelX : other.registration!.metresPerPixelY
          const baseMpp = axis === 'x' ? base.registration!.metresPerPixelX : base.registration!.metresPerPixelY
          const origin = axis === 'x' ? other.registration!.originPx.x : other.registration!.originPx.y
          const baseOrigin = axis === 'x' ? base.registration!.originPx.x : base.registration!.originPx.y
          return baseOrigin + ((v - origin) * mpp) / baseMpp
        }
        // 005L: two chains' zeros are one line of the building only when both chains measure the whole building
        // along that axis. A plan that dimensions only its own walls starts its chain at its own face, and taking
        // that for the face below is the assumption that the storey is flush there, not a reading of where it is.
        const whole = (axis: 'x' | 'y'): boolean => {
          const span = (p: PlanReading): number => (axis === 'x' ? width(p.extent) * p.registration!.metresPerPixelX : height(p.extent) * p.registration!.metresPerPixelY)
          const wallM = base.wallPx * (axis === 'x' ? base.registration!.metresPerPixelX : base.registration!.metresPerPixelY)
          return Math.abs(span(other) - span(base)) <= Math.max(wallM, 0.01 * span(base))
        }
        if (whole('x')) offsetsX.push({ v: px(source.x0, 'x') - source.x0 * scale, stated: true, why: 'where its own chains put it along x' })
        if (whole('y')) offsetsY.push({ v: px(source.y0, 'y') - source.y0 * scale, stated: true, why: 'where its own chains put it along z' })
      }
      for (const ox of offsetsX) {
        for (const oy of offsetsY) {
          // 005L: a statement is the scale AND both offsets from the plans' own chains; chain offsets at a fitted scale state nothing
          const isStated = scaleStated && ox.stated && oy.stated
          considered.push(candidate(scale, ox.v, oy.v, target, isStated, `at ${scaleWhy} (${scale.toFixed(3)}), ${ox.why} and ${oy.why} of ${target.id}`))
        }
      }
    }
  }

  // 005L: the walls themselves. A plan that prints no chain of its own has no scale of its own, and the rectangle
  // fitted above is then the one thing the alignment rests on — and on a sheet whose plan shares the paper with a
  // roof outline, an eave line or a publisher's mark, that rectangle is the plan and the mark together, and no target
  // is its shape. So the plan's facade-length walls are matched to the plan below's directly: a pair of them along x
  // and a pair along z that continue up fix a scale on each axis, and where the two scales agree — one drawing is
  // scaled uniformly — the four walls fix the placement. Each hypothesis is named by the walls it pairs and weighed
  // exactly as the fitted ones are. One axis alone is no hypothesis: some pair of walls along one axis lines up with
  // some pair below at almost any scale, and the walls across it then decide nothing.
  if (options.wallPairs !== false) {
    const targetWalls = { id: 'walls', rect: envelope }
    // the lines each plan's decomposition took for its outer walls: its envelope's sides, its largest walled region's
    const linesOf = (plan: PlanReading, axis: 'VERTICAL' | 'HORIZONTAL'): number[] => {
      const rects = [plan.decomposition.envelope?.rect, largestBuilt(plan)?.rect].filter((r): r is PixelRect => r !== undefined)
      return rects.flatMap((r) => (axis === 'VERTICAL' ? [r.x0, r.x1] : [r.y0, r.y1]))
    }
    const frameOf = (axis: 'VERTICAL' | 'HORIZONTAL'): [number, number] => {
      const o = outerWallAxes(otherAxes[axis], other.wallPx, linesOf(other, axis))
      const all = [...o.lows, ...o.highs]
      return all.length > 0 ? [Math.min(...all), Math.max(...all)] : axis === 'VERTICAL' ? [source.x0, source.x1] : [source.y0, source.y1]
    }
    const otherFrame: PixelRect = { x0: frameOf('VERTICAL')[0], x1: frameOf('VERTICAL')[1], y0: frameOf('HORIZONTAL')[0], y1: frameOf('HORIZONTAL')[1] }
    const spans = (axis: 'VERTICAL' | 'HORIZONTAL'): Array<{ k: number; offset: number; from: number; to: number; why: string }> => {
      const b = outerWallAxes(baseAxes[axis], base.wallPx, linesOf(base, axis))
      const o = outerWallAxes(otherAxes[axis], other.wallPx, linesOf(other, axis))
      const out: Array<{ k: number; offset: number; from: number; to: number; why: string }> = []
      for (const bl of b.lows) for (const bh of b.highs) {
        if (bh - bl < MIN_WALL_PAIR_SPAN_WALLS * base.wallPx) continue
        for (const ol of o.lows) for (const oh of o.highs) {
          if (oh - ol < MIN_WALL_PAIR_SPAN_WALLS * other.wallPx) continue
          const k = (bh - bl) / (oh - ol)
          if (!(k >= 1 / MAX_WALL_PAIR_SCALE && k <= MAX_WALL_PAIR_SCALE)) continue
          out.push({ k, offset: bl - ol * k, from: ol, to: oh, why: `${Math.round(ol)}–${Math.round(oh)} px onto ${Math.round(bl)}–${Math.round(bh)} px` })
        }
      }
      return out
    }
    // And at the plan below's own scale (005L): sheets of one project are routinely exported at one scale, and a
    // plan that prints no scale of its own may simply be drawn at the one below's. A hypothesis like the others, never
    // a default: its offsets are the ones that put one of its outer walls on one of the plan below's on each axis, the
    // few that land the most wall on wall, and it is kept only if the walls agree.
    const sameScale = (axis: 'VERTICAL' | 'HORIZONTAL'): Array<{ offset: number; why: string }> => {
      const b = outerWallAxes(baseAxes[axis], base.wallPx, linesOf(base, axis))
      const o = outerWallAxes(otherAxes[axis], other.wallPx, linesOf(other, axis))
      const scored: Array<{ offset: number; matched: number; why: string }> = []
      for (const bp of [...new Set([...b.lows, ...b.highs])])
        for (const op of [...new Set([...o.lows, ...o.highs])]) {
          const offset = bp - op
          if (scored.some((x) => Math.abs(x.offset - offset) <= tolerance / 2)) continue
          scored.push({ offset, matched: axisMatch(otherAxes[axis], baseAxes[axis], 1, offset, tolerance), why: `${Math.round(op)} px onto ${Math.round(bp)} px` })
        }
      return scored.sort((p, q) => q.matched - p.matched || p.offset - q.offset).slice(0, SAME_SCALE_OFFSETS_PER_AXIS)
    }
    for (const x of sameScale('VERTICAL'))
      for (const z of sameScale('HORIZONTAL')) considered.push(candidate(1, x.offset, z.offset, targetWalls, false, `at the plan below's own scale (1.000), with one of its outer walls on one below along x (${x.why}) and along z (${z.why})`, otherFrame))
    const alongX = spans('VERTICAL')
    const alongZ = spans('HORIZONTAL')
    const seen = new Set<string>()
    for (const x of alongX) {
      for (const z of alongZ) {
        if (Math.max(x.k, z.k) / Math.min(x.k, z.k) > 1 + WALL_PAIR_SCALE_AGREEMENT) continue
        const scale = (x.k + z.k) / 2
        // the four walls, each kept where it was paired: the common scale moves each pair's far wall by its share of the disagreement
        const key = `${scale.toFixed(3)}:${Math.round(x.offset / tolerance)}:${Math.round(z.offset / tolerance)}`
        if (seen.has(key)) continue
        seen.add(key)
        considered.push(candidate(scale, x.offset, z.offset, targetWalls, false, `with two of its facade walls along x on two below (${x.why}) and two along z on two below (${z.why}), at the scale they agree on (${scale.toFixed(3)})`, { x0: x.from, y0: z.from, x1: x.to, y1: z.to }))
      }
    }
  }
  // A total order on what a placement IS, never on the order it was found in (005L): two placements that tie on score
  // are ordered by their own numbers, so enumerating targets, walls or offsets differently cannot change which leads.
  considered.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId) || a.scale - b.scale || a.offsetX - b.offsetX || a.offsetY - b.offsetY || Number(b.stated) - Number(a.stated) || a.why.localeCompare(b.why))
  // Two candidates that put the plan in the same place are one candidate,
  // however differently they were arrived at: a square plan is flush with
  // both its side walls and centred between them at once, and reporting that
  // as three readings of the building would turn agreement into ambiguity.
  const seen = new Set<string>()
  const distinct = considered.filter((c) => {
    const key = `${c.scale.toFixed(3)}:${Math.round(c.offsetX / tolerance)}:${Math.round(c.offsetY / tolerance)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // 005L: where both drawings state the placement — each plan's own chains fix its scale, and where it starts on both
  // axes — that is a reading, and the walls do not overrule it by fitting better somewhere else: an upper storey set
  // back from the rear wall has a rear wall of its own that lands on nothing below, and the placement that slides it
  // onto the rear wall below fits the walls better and is wrong. What can refute a statement is a misread scale, and
  // a misread scale shows twice: the placement shares far less wall than the best fit (under half), AND it puts the
  // plan's walled body where the building below is not. A storey set in from every wall shares no wall at all and
  // still stands wholly over the building, and there the statement stands.
  const stated0 = distinct.find((c) => c.stated)
  const body = largestBuilt(other)?.rect
  const insideBelow = (c: PlanAlignment): boolean =>
    body !== undefined && body.x0 * c.scale + c.offsetX >= envelope.x0 - tolerance && body.x1 * c.scale + c.offsetX <= envelope.x1 + tolerance && body.y0 * c.scale + c.offsetY >= envelope.y0 - tolerance && body.y1 * c.scale + c.offsetY <= envelope.y1 + tolerance
  // How finely the walls can tell two placements apart (005L council A5L-7): a wall's ends are read to a pixel, so a
  // pixel at each end of every long wall of this plan moves what it shares by that much, and a pixel on two sides of
  // the rectangle a placement claims moves its coverage. Two placements nearer than this are not decided by the walls.
  const resolutionOf = (c: PlanAlignment): number =>
    round6((2 * (otherMajor.VERTICAL.length + otherMajor.HORIZONTAL.length)) / Math.max(1e-9, c.scale * otherMajorLength + baseMajorLength) + coverageWeight * (1 / Math.max(1, width(envelope)) + 1 / Math.max(1, height(envelope))))
  if (stated0 && distinct[0] !== stated0 && (stated0.shares >= STATED_HOLDS_SHARE * distinct[0].shares || insideBelow(stated0))) {
    return { best: stated0, considered: [stated0, ...distinct.filter((c) => c !== stated0)], resolution: resolutionOf(stated0), held: { by: 'STATEMENT', over: distinct[0] } }
  }
  // 005L (council A5L-1): the scale both plans print, where their offsets are not stated (a plan whose chains measure
  // only its own walls says how large it is, not where it stands). A placement at another scale is the claim that a
  // printed scale is misread, and the walls must show it. They do when the best placement at the printed scale shares
  // under half the wall the best fit shares, OR puts the plan's walled body where the building below is not: an upper
  // plan read 1.4× too coarse is a storey larger than the house. Where neither holds, the printed scale stands: the fit
  // that stretches an inset storey until its outer walls land on the outer walls below is the wrong reading, and it is
  // the one that shares the most wall.
  const atPrinted = stated && stated.anisotropy <= maxAnisotropy ? distinct.filter((c) => Math.abs(c.scale / stated.k - 1) <= WALL_PAIR_SCALE_AGREEMENT) : []
  const printed0 = atPrinted[0]
  if (stated && printed0 && distinct[0] !== printed0 && Math.abs(distinct[0].scale / stated.k - 1) > WALL_PAIR_SCALE_AGREEMENT) {
    const shareHolds = printed0.shares >= STATED_HOLDS_SHARE * distinct[0].shares
    const inside = insideBelow(printed0)
    const printedScale = { k: round6(stated.k), placement: printed0, sharesAgainstFit: round6(printed0.shares / Math.max(1e-9, distinct[0].shares)), bodyInsideBelow: inside }
    if (shareHolds && inside) {
      return { best: printed0, considered: [printed0, ...distinct.filter((c) => c !== printed0)], resolution: resolutionOf(printed0), held: { by: 'PRINTED_SCALE', over: distinct[0] }, printedScale: { ...printedScale, outcome: 'HELD' } }
    }
    return { best: distinct[0], considered: distinct, resolution: resolutionOf(distinct[0]), printedScale: { ...printedScale, outcome: 'REFUTED' } }
  }
  return { best: distinct[0], considered: distinct, resolution: distinct[0] ? resolutionOf(distinct[0]) : 0 }
}

/** What `alignPlans` found beside its ranking: how finely the walls tell placements apart, and what a held reading was held against (005L). */
export type PlanAlignmentReading = {
  best: PlanAlignment | undefined
  considered: PlanAlignment[]
  resolution?: number
  /** A placement the drawings state (both offsets and the scale, or the printed scale alone) chosen over a better fit. */
  held?: { by: 'STATEMENT' | 'PRINTED_SCALE'; over: PlanAlignment }
  /** Where both plans print a scale and the best fit is at another: whether the printed scale stood, and on what. */
  printedScale?: { k: number; placement: PlanAlignment; sharesAgainstFit: number; bodyInsideBelow: boolean; outcome: 'HELD' | 'REFUTED' }
}

// ---------------------------------------------------------------------------
// 3. the layout
// ---------------------------------------------------------------------------

/** Rank the storeys the plans show, lowest first, keeping the ground floor at zero. */
function storeyIndices(plans: readonly PlanReading[]): Map<string, number> {
  const present = [...new Set(plans.map((p) => p.storey))].sort((a, b) => STOREY_RANK[a] - STOREY_RANK[b])
  const hasGround = present.includes('GROUND')
  const out = new Map<string, number>()
  // `-0` is a real value in JavaScript and it is not the storey index zero.
  let running = hasGround && present.indexOf('GROUND') > 0 ? -present.indexOf('GROUND') : 0
  for (const storey of present) {
    out.set(storey, running)
    running += 1
  }
  return out
}

const overlap1d = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/** How much two pixel rectangles are the same rectangle: intersection over union, 0..1. */
const rectIoU = (a: PixelRect, b: PixelRect): number => {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const inter = w * h
  const union = Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) + Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0) - inter
  return union <= 0 ? 0 : inter / union
}

const rectOverlapArea = (a: PlanRing, b: PlanRing): number => {
  const ab = ringBoundsOf(a)
  const bb = ringBoundsOf(b)
  return overlap1d(ab.x0, ab.x1, bb.x0, bb.x1) * overlap1d(ab.z0, ab.z1, bb.z0, bb.z1)
}

const ringBoundsOf = (ring: PlanRing): { x0: number; z0: number; x1: number; z1: number } => {
  const xs = ring.points.map((p) => p.x)
  const zs = ring.points.map((p) => p.z)
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }
}

export type WorldFrame = {
  metresPerPixelX: number
  metresPerPixelY: number
  originPx: { x: number; y: number }
  /** Pixels to metres along each axis, through the chains where the chains state a span. */
  x?: (px: number) => number
  z?: (px: number) => number
}

/**
 * Metres along one axis of a plan, taken from the CHAINS and not from the scale.
 *
 * A registration's metres-per-pixel is a fit over every anchor on the sheet,
 * so it carries the average of all their errors: a span the draughtsman wrote
 * 960 on comes back as 9.596 and every dimension downstream inherits the
 * rounding. But the grid lines the decomposition cut the plan on ARE the
 * chains' own tick marks, so where a chain states the span between two of
 * them, that statement is the answer, exactly, and the scale is needed only
 * between lines no chain measured.
 *
 * The result is a ladder: a metric value for every grid line, built by walking
 * along it and adding the chain's own centimetres wherever they are stated.
 */
export type AxisSpan = { metres: number; evidenceIds: string[]; chainIds: string[]; stated: boolean; agreed: number; why: string }
export type AxisLadder = { at: (px: number) => number; span: (fromPx: number, toPx: number) => AxisSpan }

export function axisLadder(
  lines: readonly GridLine[],
  chains: readonly DimensionChain[],
  evidence: readonly MetricEvidence[],
  axis: 'X' | 'Y',
  mpp: number,
  originPx: number,
  tolerancePx: number,
): AxisLadder {
  const alongAxis = chains.filter((c) => (c.axis === 'HORIZONTAL') === (axis === 'X'))
  const byId = new Map(evidence.map((e) => [e.id, e]))
  // A segment's value is whatever the EVIDENCE it cites says, not whatever the
  // chain cached when it was solved. A reading corrected, doubted or removed
  // downstream has to reach the building, and a chain that answers from its
  // own memory is a chain that has stopped reading its sources.
  const valueOf = (segment: DimensionChain['segments'][number]): number | undefined => {
    if (segment.evidenceId !== undefined) {
      const cited = byId.get(segment.evidenceId)
      if (cited && (cited.unit === 'cm' || cited.unit === 'mm' || cited.unit === 'm')) {
        const cm = cited.unit === 'cm' ? cited.value : cited.unit === 'mm' ? cited.value / 10 : cited.value * 100
        return cm > 0 ? cm : undefined
      }
    }
    return segment.valueCm
  }

  /** Every chain that states the span between two pixel positions, with the centimetres it states. */
  const statements = (fromPx: number, toPx: number): Array<{ cm: number; chainId: string; evidenceIds: string[] }> => {
    const out: Array<{ cm: number; chainId: string; evidenceIds: string[] }> = []
    for (const chain of alongAxis) {
      const segments = [...chain.segments].sort((a, b) => a.fromPx - b.fromPx)
      const first = segments.findIndex((seg) => Math.abs(seg.fromPx - fromPx) <= tolerancePx)
      if (first < 0) continue
      let total = 0
      const ids: string[] = []
      for (let i = first; i < segments.length; i += 1) {
        const value = valueOf(segments[i])
        if (value === undefined) break
        total += value
        if (segments[i].evidenceId !== undefined) ids.push(segments[i].evidenceId as string)
        if (Math.abs(segments[i].toPx - toPx) <= tolerancePx) {
          out.push({ cm: round6(total), chainId: chain.id, evidenceIds: ids })
          break
        }
        if (segments[i].toPx > toPx + tolerancePx) break
        if (i + 1 < segments.length && Math.abs(segments[i + 1].fromPx - segments[i].toPx) > tolerancePx) break
      }
    }
    return out
  }

  const span = (fromPx: number, toPx: number): AxisSpan => {
    const said = statements(Math.min(fromPx, toPx), Math.max(fromPx, toPx))
    const pixels = round6(Math.abs(toPx - fromPx) * mpp)
    if (said.length === 0) {
      return { metres: pixels, evidenceIds: [], chainIds: [], stated: false, agreed: 0, why: `${Math.round(Math.abs(toPx - fromPx))} px at the sheet's own scale of ${mpp} m/px; no chain measures this span` }
    }
    const best = [...said].sort((a, b) => b.evidenceIds.length - a.evidenceIds.length || a.chainId.localeCompare(b.chainId))[0]
    const agreed = said.filter((x) => Math.abs(x.cm - best.cm) <= 2).length
    return {
      metres: round6(best.cm / 100),
      evidenceIds: [...new Set(said.flatMap((x) => x.evidenceIds))].sort(),
      chainIds: said.map((x) => x.chainId).sort(),
      stated: true,
      agreed,
      why:
        agreed > 1
          ? `${agreed} dimension chains agree that this span is ${round6(best.cm)} cm`
          : `a dimension chain states this span as ${round6(best.cm)} cm${said.length > 1 ? `, against ${said.length - 1} that state it differently` : ''}`,
    }
  }

  // Positions along the axis, taken from the chains where the chains speak and
  // from the sheet's scale where they do not.
  //
  // Not accumulated line by line, which would throw away every statement that
  // spans more than one gap: a chain saying the building is 1185 cm across is
  // an exact statement about two lines eleven lines apart, and adding up the
  // eleven scaled gaps between them gets 1204.7 and loses it. So the stated
  // spans are applied LONGEST FIRST — the overall dimension pins the ends, the
  // dimensions inside it pin the breaks, and only the lines nothing measures
  // are left to the scale, interpolated between their fixed neighbours.
  const metric: number[] = lines.map((l) => round6((l.px - lines[0]?.px) * mpp))
  const fixed = new Array<boolean>(lines.length).fill(false)
  const claims: Array<{ i: number; j: number; metres: number; length: number }> = []
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const said = span(lines[i].px, lines[j].px)
      if (said.stated) claims.push({ i, j, metres: said.metres, length: lines[j].px - lines[i].px })
    }
  }
  claims.sort((a, b) => b.length - a.length || a.i - b.i || a.j - b.j)
  for (const claim of claims) {
    if (fixed[claim.i] && fixed[claim.j]) continue
    if (!fixed[claim.i] && !fixed[claim.j]) {
      fixed[claim.i] = true
      metric[claim.j] = round6(metric[claim.i] + claim.metres)
      fixed[claim.j] = true
    } else if (fixed[claim.i]) {
      metric[claim.j] = round6(metric[claim.i] + claim.metres)
      fixed[claim.j] = true
    } else {
      metric[claim.i] = round6(metric[claim.j] - claim.metres)
      fixed[claim.i] = true
    }
  }
  // Everything nothing measured: proportional to pixels between the nearest
  // fixed lines either side, and at the sheet's scale beyond the last of them.
  for (let i = 0; i < lines.length; i += 1) {
    if (fixed[i]) continue
    let before = -1
    let after = -1
    for (let k = i - 1; k >= 0; k -= 1) if (fixed[k]) { before = k; break }
    for (let k = i + 1; k < lines.length; k += 1) if (fixed[k]) { after = k; break }
    if (before >= 0 && after >= 0) {
      const t = (lines[i].px - lines[before].px) / Math.max(1e-9, lines[after].px - lines[before].px)
      metric[i] = round6(metric[before] + t * (metric[after] - metric[before]))
    } else if (before >= 0) metric[i] = round6(metric[before] + (lines[i].px - lines[before].px) * mpp)
    else if (after >= 0) metric[i] = round6(metric[after] - (lines[after].px - lines[i].px) * mpp)
  }
  let zeroAt = 0
  for (let i = 0; i < lines.length; i += 1) if (Math.abs(lines[i].px - originPx) < Math.abs(lines[zeroAt].px - originPx)) zeroAt = i
  const offset = lines.length > 0 ? metric[zeroAt] - (lines[zeroAt].px - originPx) * mpp : 0
  for (let i = 0; i < metric.length; i += 1) metric[i] = round6(metric[i] - offset)

  const at = (px: number): number => {
    if (lines.length === 0) return round6((px - originPx) * mpp)
    for (let i = 0; i < lines.length; i += 1) if (Math.abs(lines[i].px - px) < 0.5) return metric[i]
    if (px < lines[0].px) return round6(metric[0] - (lines[0].px - px) * mpp)
    if (px > lines[lines.length - 1].px) return round6(metric[metric.length - 1] + (px - lines[lines.length - 1].px) * mpp)
    for (let i = 0; i + 1 < lines.length; i += 1) {
      if (px < lines[i].px || px > lines[i + 1].px) continue
      const t = (px - lines[i].px) / Math.max(1e-9, lines[i + 1].px - lines[i].px)
      return round6(metric[i] + t * (metric[i + 1] - metric[i]))
    }
    return round6((px - originPx) * mpp)
  }
  return { at, span }
}

// ---------------------------------------------------------------------------
// 3b. the storey-support relation (005L)
// ---------------------------------------------------------------------------

/** How far behind the chosen placement a rival may score and still be weighed, and still make a near tie a conflict. */
const STOREY_RIVAL_WINDOW = 0.1
/** How many placements behind the chosen one are weighed for a rival: the walls have long since ranked the rest. */
const STOREY_RIVALS_WEIGHED = 24
/** A margin no larger than this is no margin: the scores are equal, and only the order they were found in would choose. */
const STOREY_TIE = 1e-6

/**
 * 005L (council A5L-8, D5L-5): a storey's walls are drawn at its plan's own wall thickness; a parapet round a roof
 * terrace, a balustrade or a partition is drawn at half of it or less. A wall at least this share of the plan's wall
 * thickness can enclose a storey.
 */
const STOREY_WALL_SHARE = 0.75

type UpperBody = { region: PlanRegion; rect: PixelRect; faces: Partial<PixelRect>; wallFraction: number; storeyWallFraction: number; reached: string[] }
type SupportPiece = { regionId: string; x0: number; z0: number; x1: number; z1: number }
type SupportOutcome = { regions: UpperRegionRecord[]; relations: StoreySupportRelation[]; supported: Map<string, SupportPiece[]> }

/**
 * The walled bodies of another storey's plan: a function of that plan alone.
 *
 * Each body is the decomposition's walled region, with two corrections the plan's own walls make (005L council):
 *  - how much of its perimeter is wall of a storey's thickness (`storeyWallFraction`), beside how much is wall at all:
 *    a terrace closed by a parapet is walled, and no storey;
 *  - a side the region's grid line stops short of, where both of the storey's outer walls along the other axis run on
 *    past it (`reached`): a storey's outline is where its outer walls end, not where a chain or a room's line inside
 *    them does — a gable drawn as glazing between piers leaves the region a metre short of the gable, and the eaves
 *    walls on both sides still run to it. A side shared with another body is the boundary between them, and stays.
 */
function upperBodiesOf(plan: PlanReading): UpperBody[] {
  const unit: WorldFrame = { metresPerPixelX: 1, metresPerPixelY: 1, originPx: { x: 0, y: 0 } }
  const bodies = planBodies(plan.decomposition)
  const longest = { VERTICAL: Math.max(0, ...plan.bands.filter((b) => b.axis === 'VERTICAL').map((b) => b.length)), HORIZONTAL: Math.max(0, ...plan.bands.filter((b) => b.axis === 'HORIZONTAL').map((b) => b.length)) }
  const facade = plan.bands.filter((b) => b.length >= FACADE_WALL_SHARE * longest[b.axis] && b.thickness >= STOREY_WALL_SHARE * plan.wallPx)
  const storeyWalls = plan.bands.filter((b) => b.thickness >= STOREY_WALL_SHARE * plan.wallPx)
  const alongOf = (b: Band): [number, number] => (b.axis === 'VERTICAL' ? [b.bounds.y0, b.bounds.y1] : [b.bounds.x0, b.bounds.x1])
  /** How much of [lo, hi] on the line `at` (of the given axis) the walls cover, in pixels. */
  const covered = (walls: readonly Band[], axis: Band['axis'], at: number, lo: number, hi: number): number => {
    const pieces = walls
      .filter((b) => b.axis === axis && Math.abs(b.axisPx - at) <= plan.wallPx)
      .map((b) => alongOf(b))
      .map(([a, z]): [number, number] => [Math.max(lo, a), Math.min(hi, z)])
      .filter(([a, z]) => z > a)
      .sort((p, q) => p[0] - q[0])
    let total = 0
    let cursor = lo
    for (const [a, z] of pieces) {
      if (z <= cursor) continue
      total += z - Math.max(a, cursor)
      cursor = z
    }
    return total
  }
  return bodies
    .map((region) => {
      const r = region.rect
      const w = r.x1 - r.x0
      const h = r.y1 - r.y0
      const perimeter = 2 * (w + h)
      const storeyWalled = covered(storeyWalls, 'VERTICAL', r.x0, r.y0, r.y1) + covered(storeyWalls, 'VERTICAL', r.x1, r.y0, r.y1) + covered(storeyWalls, 'HORIZONTAL', r.y0, r.x0, r.x1) + covered(storeyWalls, 'HORIZONTAL', r.y1, r.x0, r.x1)
      const sharedSide = (side: 'x0' | 'x1' | 'y0' | 'y1'): boolean =>
        bodies.some((other) => {
          if (other === region) return false
          const o = other.rect
          if (side === 'x0' || side === 'x1') return Math.abs((side === 'x0' ? o.x1 : o.x0) - (side === 'x0' ? r.x0 : r.x1)) <= plan.wallPx && overlap1d(r.y0, r.y1, o.y0, o.y1) > 0
          return Math.abs((side === 'y0' ? o.y1 : o.y0) - (side === 'y0' ? r.y0 : r.y1)) <= plan.wallPx && overlap1d(r.x0, r.x1, o.x0, o.x1) > 0
        })
      // the outer walls along the region's own two sides on one axis, each running along at least half of that side
      const sideWalls = (axis: Band['axis'], at: number, lo: number, hi: number): Band[] => facade.filter((b) => b.axis === axis && Math.abs(b.axisPx - at) <= plan.wallPx && overlap1d(alongOf(b)[0], alongOf(b)[1], lo, hi) >= 0.5 * (hi - lo))
      // how far both walls reach past a side: the nearer of the two reaches, or none when either wall stops at it
      const reach = (first: Band[], second: Band[], end: 'low' | 'high', at: number): number | undefined => {
        if (first.length === 0 || second.length === 0) return undefined
        const far = (ws: Band[]): number => (end === 'low' ? Math.min(...ws.map((b) => alongOf(b)[0])) : Math.max(...ws.map((b) => alongOf(b)[1])))
        const both = end === 'low' ? Math.max(far(first), far(second)) : Math.min(far(first), far(second))
        return (end === 'low' ? at - both : both - at) > 0 ? both : undefined
      }
      const xWalls = [sideWalls('VERTICAL', r.x0, r.y0, r.y1), sideWalls('VERTICAL', r.x1, r.y0, r.y1)] as const
      const yWalls = [sideWalls('HORIZONTAL', r.y0, r.x0, r.x1), sideWalls('HORIZONTAL', r.y1, r.x0, r.x1)] as const
      const rect: PixelRect = { ...r }
      const reached: string[] = []
      const y0 = sharedSide('y0') ? undefined : reach(xWalls[0], xWalls[1], 'low', r.y0)
      const y1 = sharedSide('y1') ? undefined : reach(xWalls[0], xWalls[1], 'high', r.y1)
      const x0 = sharedSide('x0') ? undefined : reach(yWalls[0], yWalls[1], 'low', r.x0)
      const x1 = sharedSide('x1') ? undefined : reach(yWalls[0], yWalls[1], 'high', r.x1)
      if (y0 !== undefined) (rect.y0 = y0), reached.push('min z')
      if (y1 !== undefined) (rect.y1 = y1), reached.push('max z')
      if (x0 !== undefined) (rect.x0 = x0), reached.push('min x')
      if (x1 !== undefined) (rect.x1 = x1), reached.push('max x')
      // The outer face of the wall each other outside side runs along, where a wall of a storey's thickness does (council
      // B5L-5): a set-back built on its grid line stands a wall inside the wall the plan draws there, and the opening
      // reader then sees the drawn wall as a window. Applied where the side is a set-back over a body (`storeySupportOf`).
      const face = (axis: Band['axis'], at: number, lo: number, hi: number, outward: -1 | 1): number | undefined => {
        const along = storeyWalls.filter((b) => b.axis === axis && Math.abs(b.axisPx - at) <= plan.wallPx && overlap1d(alongOf(b)[0], alongOf(b)[1], lo, hi) >= 0.5 * (hi - lo))
        if (along.length === 0) return undefined
        const outer = along.map((b) => b.axisPx + (outward * b.thickness) / 2)
        return outward < 0 ? Math.min(...outer) : Math.max(...outer)
      }
      const faces: Partial<PixelRect> = {
        ...(y0 === undefined && !sharedSide('y0') ? { y0: face('HORIZONTAL', r.y0, r.x0, r.x1, -1) } : {}),
        ...(y1 === undefined && !sharedSide('y1') ? { y1: face('HORIZONTAL', r.y1, r.x0, r.x1, 1) } : {}),
        ...(x0 === undefined && !sharedSide('x0') ? { x0: face('VERTICAL', r.x0, r.y0, r.y1, -1) } : {}),
        ...(x1 === undefined && !sharedSide('x1') ? { x1: face('VERTICAL', r.x1, r.y0, r.y1, 1) } : {}),
      }
      return { region, rect, faces, wallFraction: perimeterWallEvidence(region, plan.decomposition, unit).fraction, storeyWallFraction: round6(perimeter > 0 ? Math.min(1, storeyWalled / perimeter) : 0), reached }
    })
    .sort((a, b) => a.region.id.localeCompare(b.region.id))
}

/**
 * What one placement of another storey's plan stands on: every walled body of it, put on the plan below and weighed
 * against every body there.
 *
 * A region is a storey's body only as a body of the plan below is one: drawn mostly in wall — wall of a storey's
 * thickness — and wider than two walls and a room. It stands on a body below where they overlap by at least that span
 * along both axes; a thinner overlap is a wall's thickness, a registration's jitter or an eave, and carries nothing.
 * The part of a body that a region stands on is that region's footprint over it, with each side within a wall's band
 * of the body's own taken to it. A region most of which stands on nothing is no part of the building below — a second
 * drawing beside the plan, a legend — and lifts no body.
 */
function storeySupportOf(
  bodies: readonly UpperBody[],
  a: PlanAlignment,
  ctx: { frame: WorldFrame; masses: readonly MassHypothesis[]; storey: StoreyLayoutHypothesis; plan: PlanReading; minSpanM: number; tolM: number; jitterM: number; below: boolean },
): SupportOutcome {
  const regions: UpperRegionRecord[] = []
  const relations: StoreySupportRelation[] = []
  const supported = new Map<string, SupportPiece[]>()
  const alignmentId = `${a.targetId}@${a.scale.toFixed(4)}:${a.offsetX.toFixed(1)},${a.offsetY.toFixed(1)}`
  // A region's sides are cut on its plan's grid lines — a wall's axis, or its inner face — while a body below is
  // measured to its outer faces: the two disagree by up to the other plan's own wall, placed, on top of the
  // registration's jitter (half a wall of the plan below). Within that band a side is the body's side; further in is
  // a set-back, and stays one.
  const bandM = round6(ctx.jitterM + ctx.plan.wallPx * a.scale * Math.max(ctx.frame.metresPerPixelX, ctx.frame.metresPerPixelY))
  for (const { region, rect, faces, wallFraction, storeyWallFraction, reached } of bodies) {
    const px: PixelRect = { x0: rect.x0 * a.scale + a.offsetX, y0: rect.y0 * a.scale + a.offsetY, x1: rect.x1 * a.scale + a.offsetX, y1: rect.y1 * a.scale + a.offsetY }
    const b = ringBoundsOf(ringOfRect(px, ctx.frame))
    // the outer faces of its walls along the sides that have one, placed (a side's face, in metres, or the side itself)
    const fpx: PixelRect = { x0: (faces.x0 ?? rect.x0) * a.scale + a.offsetX, y0: (faces.y0 ?? rect.y0) * a.scale + a.offsetY, x1: (faces.x1 ?? rect.x1) * a.scale + a.offsetX, y1: (faces.y1 ?? rect.y1) * a.scale + a.offsetY }
    const f = ringBoundsOf(ringOfRect(fpx, ctx.frame))
    const w = b.x1 - b.x0
    const d = b.z1 - b.z0
    const area = w * d
    const isBody = wallFraction >= MIN_MASS_WALL_FRACTION && storeyWallFraction >= MIN_MASS_WALL_FRACTION && Math.min(w, d) >= ctx.minSpanM
    let carried = 0
    const carriers: Array<{ x0: number; z0: number; x1: number; z1: number }> = []
    const pieces: Array<{ massId: string; piece: SupportPiece }> = []
    const mine: StoreySupportRelation[] = []
    if (isBody) {
      for (const mass of ctx.masses) {
        const m = ringBoundsOf(mass.ring)
        const ox = overlap1d(b.x0, b.x1, m.x0, m.x1)
        const oz = overlap1d(b.z0, b.z1, m.z0, m.z1)
        const inter = ox * oz
        if (inter <= 0) continue
        const massArea = Math.max(1e-9, ringArea(mass.ring))
        const supports = ox >= ctx.minSpanM && oz >= ctx.minSpanM
        if (supports) {
          carried += inter
          carriers.push(m)
        }
        mine.push({
          upperStoreyId: ctx.storey.id,
          upperFrameId: ctx.plan.frame.id,
          upperRegionId: region.id,
          lowerMassId: mass.id,
          alignmentId,
          intersectionM2: round6(inter),
          upperSupportedShare: round6(inter / Math.max(1e-9, area)),
          lowerCoveredShare: round6(inter / massArea),
          overlapM: { x: round6(ox), z: round6(oz) },
          wallAgreement: a.agreement,
          supportStatus: supports ? 'SUPPORTS' : 'INCIDENTAL',
          evidenceIds: [],
          why: supports
            ? `the ${ctx.plan.storey.toLowerCase()} storey's walled region ${region.id}, registered onto the plan below, stands on this body over ${ox.toFixed(2)} × ${oz.toFixed(2)} m: ${Math.round((inter / Math.max(1e-9, area)) * 100)}% of the region, ${Math.round((inter / massArea) * 100)}% of the body`
            : `the ${ctx.plan.storey.toLowerCase()} storey's walled region ${region.id} overlaps this body by only ${ox.toFixed(2)} × ${oz.toFixed(2)} m, less than the ${ctx.minSpanM.toFixed(2)} m a room needs on both axes: a wall's thickness or the registration's jitter, which carries nothing`,
        })
        if (!supports) continue
        // a side within the band of the body's is the body's side; a side further in is a set-back, built at the outer
        // face of the wall the plan draws along it, never past the body
        const side = (v: number, edge: number, faced: number, low: boolean): number => (Math.abs(v - edge) < bandM ? edge : low ? Math.max(edge, Math.min(v, faced)) : Math.min(edge, Math.max(v, faced)))
        pieces.push({ massId: mass.id, piece: { regionId: region.id, x0: round6(side(Math.max(b.x0, m.x0), m.x0, f.x0, true)), z0: round6(side(Math.max(b.z0, m.z0), m.z0, f.z0, true)), x1: round6(side(Math.min(b.x1, m.x1), m.x1, f.x1, false)), z1: round6(side(Math.min(b.z1, m.z1), m.z1, f.z1, false)) } })
      }
    }
    const stands = pieces.length > 0
    // Most of it on nothing: a region the building below carries less than half of is not a part of that building.
    const mostlyUnsupported = stands && carried < 0.5 * area
    if (mostlyUnsupported) for (const r of mine) if (r.supportStatus === 'SUPPORTS') (r.supportStatus = 'INCIDENTAL'), (r.why = `${r.why}; but ${Math.round((1 - carried / Math.max(1e-9, area)) * 100)}% of the region stands on no body below, so it is no part of this building and carries nothing`)
    relations.push(...mine)
    if (stands && !mostlyUnsupported) for (const { massId, piece } of pieces) supported.set(massId, [...(supported.get(massId) ?? []), piece])
    const unsupported = Math.max(0, area - carried)
    // An overhang is measured side by side (council A5L-3, D5L-2): what stands on nothing within the band along the
    // region's edge is the registration's jitter; a part further in — the region less a band all round, not carried —
    // is an overhang the plans state, whichever side it is on and however long that side.
    const inner = { x0: b.x0 + bandM, z0: b.z0 + bandM, x1: b.x1 - bandM, z1: b.z1 - bandM }
    const innerArea = Math.max(0, inner.x1 - inner.x0) * Math.max(0, inner.z1 - inner.z0)
    const innerCarried = carriers.reduce((acc, m) => acc + overlap1d(inner.x0, inner.x1, m.x0, m.x1) * overlap1d(inner.z0, inner.z1, m.z0, m.z1), 0)
    const overhang: UpperRegionRecord['overhang'] = !isBody ? 'NOT_A_BODY' : !stands || mostlyUnsupported ? 'UNSUPPORTED' : unsupported <= 1e-6 ? 'NONE' : innerArea - innerCarried <= 1e-6 ? 'WITHIN_TOLERANCE' : 'BEYOND_TOLERANCE'
    regions.push({
      regionId: region.id,
      pixelRect: rect,
      bounds: { x0: round6(b.x0), z0: round6(b.z0), x1: round6(b.x1), z1: round6(b.z1) },
      areaM2: round6(area),
      wallFraction: round6(wallFraction),
      storeyWallFraction,
      body: isBody,
      unsupportedM2: round6(unsupported),
      overhang,
      why: [
        !isBody
          ? wallFraction < MIN_MASS_WALL_FRACTION
            ? `only ${Math.round(wallFraction * 100)}% of its perimeter is drawn as wall: line work, not a storey's body`
            : storeyWallFraction < MIN_MASS_WALL_FRACTION
              ? `only ${Math.round(storeyWallFraction * 100)}% of its perimeter is wall of a storey's thickness: a parapet, a balustrade or partitions enclose it, not a storey's outer walls`
              : `${Math.min(w, d).toFixed(2)} m across, less than two walls and a room: a mark, a strip or a pier, not a storey's body`
          : !stands
            ? 'it stands on no body below over a room’s span'
            : mostlyUnsupported
              ? `${round6(unsupported).toFixed(2)} m² of its ${round6(area).toFixed(2)} m² stands on no body below: more than half of it, so it is not a part of the building below`
              : `${round6(unsupported).toFixed(2)} m² of it stands on no body below`,
        ...(reached.length > 0 ? [`its ${reached.join(', ')} side${reached.length === 1 ? '' : 's'} taken to where its outer walls run`] : []),
      ].join('; '),
    })
  }
  // Pieces over one body that tile a rectangle between them — meeting at seams no wider than a wall's band — are one
  // footprint; pieces that leave a room's span uncovered between them stay apart (council B5L-3: an L is no rectangle).
  for (const [massId, list] of supported) {
    const box = { x0: Math.min(...list.map((p) => p.x0)), z0: Math.min(...list.map((p) => p.z0)), x1: Math.max(...list.map((p) => p.x1)), z1: Math.max(...list.map((p) => p.z1)) }
    const ordered = [...list].sort((p, q) => (q.x1 - q.x0) * (q.z1 - q.z0) - (p.x1 - p.x0) * (p.z1 - p.z0) || p.x0 - q.x0 || p.z0 - q.z0)
    supported.set(massId, list.length > 1 && onlySeams(list, box, bandM) ? [{ ...box, regionId: ordered[0].regionId }] : ordered)
  }
  return { regions, relations, supported }
}

/**
 * True when rectangles leave nothing of their bounding box uncovered but seams: every uncovered cell of the grid their
 * edges cut the box into is narrower than `seam` on one axis at least.
 */
function onlySeams(rects: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number }>, box: { x0: number; z0: number; x1: number; z1: number }, seam: number): boolean {
  const xs = [...new Set([box.x0, box.x1, ...rects.flatMap((r) => [r.x0, r.x1])])].sort((p, q) => p - q)
  const zs = [...new Set([box.z0, box.z1, ...rects.flatMap((r) => [r.z0, r.z1])])].sort((p, q) => p - q)
  for (let i = 0; i + 1 < xs.length; i += 1) {
    for (let j = 0; j + 1 < zs.length; j += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cz = (zs[j] + zs[j + 1]) / 2
      if (rects.some((r) => cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1)) continue
      if (xs[i + 1] - xs[i] >= seam && zs[j + 1] - zs[j] >= seam) return false
    }
  }
  return true
}

/**
 * How far a plan's walls, placed, reach past every body below them, in m²: the area of its walled envelope standing
 * on no body further in than a wall's band from the envelope's edge, or 0 when nothing does.
 */
function wallsBeyond(plan: PlanReading, a: PlanAlignment, frame: WorldFrame, masses: readonly MassHypothesis[], bandM: number): number {
  const env = plan.decomposition.envelope?.rect
  if (!env) return 0
  const b = ringBoundsOf(ringOfRect({ x0: env.x0 * a.scale + a.offsetX, y0: env.y0 * a.scale + a.offsetY, x1: env.x1 * a.scale + a.offsetX, y1: env.y1 * a.scale + a.offsetY }, frame))
  const inner = { x0: b.x0 + bandM, z0: b.z0 + bandM, x1: b.x1 - bandM, z1: b.z1 - bandM }
  const innerArea = Math.max(0, inner.x1 - inner.x0) * Math.max(0, inner.z1 - inner.z0)
  const carried = (r: { x0: number; z0: number; x1: number; z1: number }): number =>
    masses.reduce((acc, m) => {
      const q = ringBoundsOf(m.ring)
      return acc + overlap1d(r.x0, r.x1, q.x0, q.x1) * overlap1d(r.z0, r.z1, q.z0, q.z1)
    }, 0)
  if (innerArea - carried(inner) <= 1e-6) return 0
  return round6(Math.max(0, (b.x1 - b.x0) * (b.z1 - b.z0) - carried(b)))
}

/**
 * True when two placements stand a storey on the same bodies, and over each on the same footprint: the same pieces,
 * side by side within `tol` (council D5L-4). A storey flush with the front and the same storey flush with the rear
 * overlap mostly, and are still two readings of where it stands.
 */
function sameSupport(a: SupportOutcome, b: SupportOutcome, tol: number): boolean {
  const ids = [...new Set([...a.supported.keys(), ...b.supported.keys()])]
  for (const id of ids) {
    const pa = a.supported.get(id)
    const pb = b.supported.get(id)
    if (!pa || !pb || pa.length !== pb.length) return false
    const near = (p: SupportPiece, q: SupportPiece): boolean => Math.abs(p.x0 - q.x0) <= tol && Math.abs(p.z0 - q.z0) <= tol && Math.abs(p.x1 - q.x1) <= tol && Math.abs(p.z1 - q.z1) <= tol
    if (!pa.every((p) => pb.some((q) => near(p, q)))) return false
  }
  return true
}

/** Turn a rectangle of the base plan's pixels into a plan ring in metres. */
export function ringOfRect(rect: PixelRect, frame: WorldFrame): PlanRing {
  const toX = frame.x ?? ((px: number): number => (px - frame.originPx.x) * frame.metresPerPixelX)
  const toZ = frame.z ?? ((px: number): number => (px - frame.originPx.y) * frame.metresPerPixelY)
  const x0 = toX(rect.x0)
  const x1 = toX(rect.x1)
  const z0 = toZ(rect.y0)
  const z1 = toZ(rect.y1)
  return rectangleRing(round6(Math.min(x0, x1)), round6(Math.min(z0, z1)), round6(Math.max(x0, x1)), round6(Math.max(z0, z1)))
}

/** How much of a region's perimeter is drawn as wall rather than as line work. §9's evidence for whether it is a building at all. */
export function perimeterWallEvidence(region: PlanRegion, decomposition: PlanDecomposition, frame: WorldFrame, closureThreshold = 0.62): { perimeterM: number; walledM: number; fraction: number } {
  const mppX = frame.metresPerPixelX
  const mppY = frame.metresPerPixelY
  let perimeter = 0
  let walled = 0
  // 005C: on a plan cut on its opening-aware outline, the building need not be one rectangle, and the tiling cuts
  // an L or a U into rectangles that meet inside it. A side a region shares with other built cells of the same
  // outline is inside the building — neither wall nor line work — and is not part of what encloses the region.
  const builtElsewhere = decomposition.envelope?.outline ? new Set(decomposition.cells.filter((c) => c.classification === 'BUILT').map((c) => `${c.ix}:${c.iy}`)) : undefined
  for (const cell of decomposition.cells) {
    if (!region.cells.some((c) => c.ix === cell.ix && c.iy === cell.iy)) continue
    const sides: Array<[number, number, number]> = [
      [cell.rect.x1 - cell.rect.x0, cell.edges[0].wall, cell.edges[0].closure],
      [cell.rect.y1 - cell.rect.y0, cell.edges[1].wall, cell.edges[1].closure],
      [cell.rect.x1 - cell.rect.x0, cell.edges[2].wall, cell.edges[2].closure],
      [cell.rect.y1 - cell.rect.y0, cell.edges[3].wall, cell.edges[3].closure],
    ]
    const neighbours: Array<[number, number]> = [
      [cell.ix, cell.iy - 1],
      [cell.ix + 1, cell.iy],
      [cell.ix, cell.iy + 1],
      [cell.ix - 1, cell.iy],
    ]
    for (let s = 0; s < 4; s += 1) {
      // Only the region's own outside counts: a wall between two of its cells
      // is an internal partition, and counting it would make every subdivided
      // house look better walled than an undivided one.
      const inside = region.cells.some((c) => c.ix === neighbours[s][0] && c.iy === neighbours[s][1])
      if (inside) continue
      if (builtElsewhere?.has(`${neighbours[s][0]}:${neighbours[s][1]}`)) continue
      const lengthM = sides[s][0] * (s % 2 === 0 ? mppX : mppY)
      perimeter += lengthM
      if (sides[s][2] >= closureThreshold) walled += lengthM * sides[s][1]
    }
  }
  // A region wholly inside the outline's other built cells has no outside of its own to be enclosed by line work.
  const fraction = perimeter === 0 ? (builtElsewhere ? 1 : 0) : Math.min(1, walled / perimeter)
  return { perimeterM: round6(perimeter), walledM: round6(walled), fraction: round6(fraction) }
}

/**
 * A body with each OUTSIDE side that only a wall band marks moved from the
 * band's axis to its outer face.
 *
 * A grid line a chain breaks at sits on the chain's tick, which a plan's
 * overall chains put on the outer face; a line only a wall band supports sits
 * on the band's axis, half a wall inside the face. A body bounded by band
 * lines is half a wall short on those sides, which on a whole house is several
 * per cent of its footprint. Only sides no other body shares move: between two
 * bodies the axis is the boundary.
 */
function toOuterFaces(region: PlanRegion, bodies: readonly PlanRegion[], plan: PlanReading): PlanRegion {
  const half = plan.wallPx / 2
  const lineAt = (lines: readonly GridLine[], px: number): GridLine | undefined => lines.find((l) => Math.abs(l.px - px) < 0.5)
  const bandOnly = (line: GridLine | undefined): boolean => line !== undefined && line.support.chainIds.length === 0 && line.support.bandLength > 0
  const shared = (side: 'x0' | 'x1' | 'y0' | 'y1'): boolean =>
    bodies.some((other) => {
      if (other === region) return false
      const r = region.rect
      const o = other.rect
      if (side === 'x0' || side === 'x1') {
        const at = side === 'x0' ? r.x0 : r.x1
        const touches = Math.abs((side === 'x0' ? o.x1 : o.x0) - at) < 0.5
        return touches && Math.min(r.y1, o.y1) - Math.max(r.y0, o.y0) > 0
      }
      const at = side === 'y0' ? r.y0 : r.y1
      const touches = Math.abs((side === 'y0' ? o.y1 : o.y0) - at) < 0.5
      return touches && Math.min(r.x1, o.x1) - Math.max(r.x0, o.x0) > 0
    })
  const { linesX, linesY } = plan.decomposition
  const rect = { ...region.rect }
  const moved: string[] = []
  if (bandOnly(lineAt(linesX, rect.x0)) && !shared('x0')) {
    rect.x0 -= half
    moved.push('min x')
  }
  if (bandOnly(lineAt(linesX, rect.x1)) && !shared('x1')) {
    rect.x1 += half
    moved.push('max x')
  }
  if (bandOnly(lineAt(linesY, rect.y0)) && !shared('y0')) {
    rect.y0 -= half
    moved.push('min z')
  }
  if (bandOnly(lineAt(linesY, rect.y1)) && !shared('y1')) {
    rect.y1 += half
    moved.push('max z')
  }
  if (moved.length === 0) return region
  return { ...region, rect, why: `${region.why}; its ${moved.join(', ')} side${moved.length === 1 ? '' : 's'}, marked by a wall band alone, taken to the band's outer face` }
}

/** Which side of a region a given cell edge is, as a plan side. */
const SIDE_OF_EDGE: PlanSide[] = ['MIN_Z', 'MAX_X', 'MAX_Z', 'MIN_X']
export const oppositeSide = (side: PlanSide): PlanSide => (side === 'MIN_X' ? 'MAX_X' : side === 'MAX_X' ? 'MIN_X' : side === 'MIN_Z' ? 'MAX_Z' : 'MIN_Z')
export { SIDE_OF_EDGE }

/**
 * Work out what the building is made of.
 *
 * Returns a draft rather than a sealed set: the roof systems and the gate are
 * decided by separate passes that need the elevations, and sealing anything
 * before those have spoken would mean hashing a layout that is not finished.
 */
export function inferStructuralLayout(given: StructuralLayoutOptions): StructuralLayoutDraft {
  const options = layoutOptionsOnly(given)
  const { plans, unresolved, skipped: skippedPlans } = readPlans(options)
  const conflicts: LayoutConflict[] = []
  const traces: LayoutTrace[] = []
  const alternatives: AlternativeGroup[] = []
  const alignments = new Map<string, PlanAlignment>()
  const storeys: StoreyLayoutHypothesis[] = []
  const footprintRegions: FootprintRegionHypothesis[] = []
  const masses: MassHypothesis[] = []
  const attachments: AttachmentRelation[] = []
  const facadePlanes: FacadePlaneHypothesis[] = []
  const recesses: RecessHypothesis[] = []

  const storeyRegistrations: StoreyRegistration[] = []
  const empty: StructuralLayoutDraft = { plans, base: undefined, frame: undefined, alignments, storeys, footprintRegions, masses, attachments, facadePlanes, recesses, alternatives, conflicts, unresolved, traces, skippedPlans, storeyRegistrations }
  // A reading the resolver chose is read AS the base: that is the question it asked.
  const base = (options.plan ? plans.find((p) => p.frame.id === options.plan?.frameId) : undefined) ?? chooseBasePlan(plans)
  if (!base) {
    unresolved.push({ id: stableId('gap', 'no-plan', {}), what: 'the building’s composition', reason: 'the package carries no floor plan this pass could decompose', status: 'MISSING', frameIds: [] })
    return empty
  }
  const envelope = base.decomposition.envelope
  if (!envelope || !base.registration) {
    unresolved.push({
      id: stableId('gap', 'no-envelope', { frameId: base.frame.id }),
      what: 'the extent of the building’s walls',
      reason: envelope ? 'the chosen plan states no scale, so nothing on it can be turned into metres' : 'no wall band runs along one of the two axes of the chosen plan',
      status: 'MISSING',
      frameIds: [base.frame.id],
    })
    return { ...empty, base }
  }
  const baseChains = options.metrics.chains.filter((c) => c.frameId === base.frame.id)
  const tolerancePx = Math.max(2, base.wallPx / 2)
  const ladderX = axisLadder(base.decomposition.linesX, baseChains, options.metrics.evidence, 'X', base.registration.metresPerPixelX, envelope.rect.x0, tolerancePx)
  const ladderZ = axisLadder(base.decomposition.linesY, baseChains, options.metrics.evidence, 'Y', base.registration.metresPerPixelY, envelope.rect.y0, tolerancePx)
  const frame: WorldFrame = {
    metresPerPixelX: base.registration.metresPerPixelX,
    metresPerPixelY: base.registration.metresPerPixelY,
    originPx: { x: envelope.rect.x0, y: envelope.rect.y0 },
    x: ladderX.at,
    z: ladderZ.at,
  }
  const wallM = round6(base.wallPx * Math.max(frame.metresPerPixelX, frame.metresPerPixelY))
  const indices = storeyIndices(plans)

  // The bodies of the base plan, wanted twice: once to say which of them each
  // upper storey stands on, and once to build the masses from.
  const walledFirst = options.plan?.merge === 'WALLED_FIRST' && options.plan.frameId === base.frame.id ? walledFirstRegions(base.decomposition, base.registration, MIN_MASS_WALL_FRACTION) : undefined
  const bodies = walledFirst
    ? planBodies({ ...base.decomposition, regions: [...walledFirst.regions, ...base.decomposition.regions.filter((r) => r.classification !== 'BUILT')] })
    : planBodies(base.decomposition)
  // 005C: on a plan cut on its opening-aware outline, a strip the largest-first cut left is joined to the part of the
  // neighbour it lies along. The long-band box's plans are cut as they always were.
  const built = base.decomposition.envelope?.outline
    ? recutSlivers(bodies, base.decomposition, base.registration, minBodySpanM(wallM), (r) => perimeterWallEvidence(r, base.decomposition, frame).fraction >= MIN_MASS_WALL_FRACTION, 2 * wallM)
    : bodies
  if (walledFirst && walledFirst.demoted.length > 0) {
    const cellsAt = new Map(base.decomposition.cells.map((c) => [`${c.ix}:${c.iy}`, c]))
    const areaM2 = walledFirst.demoted.reduce((a, d) => {
      const cell = cellsAt.get(`${d.ix}:${d.iy}`)
      return a + (cell ? (cell.rect.x1 - cell.rect.x0) * (cell.rect.y1 - cell.rect.y0) * frame.metresPerPixelX * frame.metresPerPixelY : 0)
    }, 0)
    unresolved.push({
      id: stableId('gap', 'walled-first-demoted', { frameId: base.frame.id, cells: walledFirst.demoted.map((d) => `${d.ix}:${d.iy}`) }),
      what: `whether ${areaM2.toFixed(1)} m² of enclosed plan outside the walled bodies is built`,
      reason: `${walledFirst.demoted.length} enclosed cell${walledFirst.demoted.length === 1 ? ' belongs' : 's belong'} to no rectangle drawn at least ${Math.round(MIN_MASS_WALL_FRACTION * 100)}% in wall, so what closes them is line work — a terrace, a canopy or paving — and they are left out of the building`,
      status: 'AMBIGUOUS',
      frameIds: [base.frame.id],
    })
  }
  // --- storeys, and the alignment of each onto the base ---------------------
  const consideredOf = new Map<string, PlanAlignment[]>()
  const readingOf = new Map<string, PlanAlignmentReading>()
  for (const plan of plans) {
    const index = indices.get(plan.storey) ?? 0
    const isBase = plan.frame.id === base.frame.id
    let why = isBase ? `the plan the building's coordinates are taken from: ${base.extentWhy}` : ''
    let registeredFrom: string | undefined
    let confidence = isBase ? 0.9 : 0.4
    if (!isBase) {
      const reading = alignPlans(base, plan, options.plan?.alignByFitOnly ? { useStated: false } : {})
      const { best, considered } = reading
      if (best) {
        alignments.set(plan.frame.id, best)
        consideredOf.set(plan.frame.id, considered)
        readingOf.set(plan.frame.id, reading)
        registeredFrom = base.frame.id
        confidence = round6(Math.min(0.92, 0.35 + best.agreement * 0.6))
        why = `registered onto the plan below: ${best.why}`
      } else {
        why = 'this storey’s plan could not be registered onto the plan below'
        unresolved.push({
          id: stableId('gap', `align-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }),
          what: `where the ${plan.storey.toLowerCase()} storey sits over the storey below`,
          reason: 'no scaling of this plan puts its walls on the walls of the plan below',
          status: 'AMBIGUOUS',
          frameIds: [plan.frame.id, base.frame.id],
        })
      }
    }
    storeys.push({
      id: `storey-${index}`,
      index,
      frameIds: [plan.frame.id],
      footprintRegionIds: [],
      registeredFrom,
      confidence,
      why: why || 'read from this storey’s own plan',
    })
  }
  storeys.sort((a, b) => a.index - b.index)
  const baseStorey = storeys.find((s) => s.frameIds.includes(base.frame.id))
  if (!baseStorey) return { ...empty, base, frame }

  // --- the base storey's regions -------------------------------------------
  for (const found of built) {
    const region = options.plan?.faces === 'OUTER_FACE' && options.plan.frameId === base.frame.id ? toOuterFaces(found, built, base) : found
    const ring = ringOfRect(region.rect, frame)
    const wallEvidence = perimeterWallEvidence(region, base.decomposition, frame)
    // A body is enclosed by WALL. A region the flood fill could not reach but
    // whose boundary is almost all line work is a paved area, a canopy, an
    // annotation box or a piece of landscaping that happens to be drawn
    // closed — and building it would put a room where the drawing has none.
    if (wallEvidence.fraction < MIN_MASS_WALL_FRACTION) {
      unresolved.push({
        id: stableId('gap', `unwalled-${region.id}`, { frameId: base.frame.id, region: region.id }),
        what: `whether the ${(ringArea(ring)).toFixed(1)} m² region at ${ringBoundsOf(ring).x0.toFixed(2)}, ${ringBoundsOf(ring).z0.toFixed(2)} is part of the building`,
        reason: `only ${Math.round(wallEvidence.fraction * 100)}% of its perimeter is drawn as wall, so what encloses it is line work rather than construction`,
        status: 'AMBIGUOUS',
        frameIds: [base.frame.id],
      })
      continue
    }
    const span = ringBoundsOf(ring)
    const narrow = Math.min(span.x1 - span.x0, span.z1 - span.z0)
    // on a plan cut on its outline only: the long-band box's plans are massed as they always were (005C post-review)
    if (base.decomposition.envelope?.outline && narrow < minBodySpanM(wallM)) {
      unresolved.push({
        id: stableId('gap', `sliver-${region.id}`, { frameId: base.frame.id, region: region.id }),
        what: `whether the ${ringArea(ring).toFixed(2)} m² strip at ${span.x0.toFixed(2)}, ${span.z0.toFixed(2)} is part of the building`,
        reason: `it is ${narrow.toFixed(2)} m across, less than the ${minBodySpanM(wallM).toFixed(2)} m two ${wallM.toFixed(2)} m walls and a room between them need: a wall's thickness, a step between outer faces or a pier, not a body`,
        status: 'AMBIGUOUS',
        frameIds: [base.frame.id],
      })
      continue
    }
    const id = `footprint-${baseStorey.index}-${region.id}`
    footprintRegions.push({
      id,
      storeyId: baseStorey.id,
      kind: 'BUILT',
      ring,
      areaM2: round6(ringArea(ring)),
      frameId: base.frame.id,
      pixelRect: region.rect,
      wallEvidence,
      observationIds: [],
      evidenceIds: chainEvidenceFor(base, region.rect, options.metrics),
      confidence: round6(Math.min(0.95, region.confidence * (0.6 + 0.4 * wallEvidence.fraction))),
      why: `${region.why}; ${Math.round(wallEvidence.fraction * 100)}% of its perimeter is drawn as wall`,
    })
    baseStorey.footprintRegionIds.push(id)
    traces.push({
      id: stableId('trace', id, { id }),
      itemId: id,
      what: 'a walled region of the base plan',
      frameId: base.frame.id,
      pixelRect: region.rect,
      observationIds: [],
      evidenceIds: chainEvidenceFor(base, region.rect, options.metrics),
      why: `cut from the plan between grid lines the dimension chains and wall bands agree on: ${region.why}`,
    })
  }

  // --- the zones the chains measure beyond the walls ------------------------
  for (const zone of zonesOutsideEnvelope(base, envelope.rect, frame)) {
    footprintRegions.push({ ...zone, storeyId: baseStorey.id })
    baseStorey.footprintRegionIds.push(zone.id)
  }

  // --- masses ---------------------------------------------------------------
  for (const region of footprintRegions.filter((r) => r.storeyId === baseStorey.id && r.kind === 'BUILT')) {
    const bounds = ringBoundsOf(region.ring)
    const spanX = ladderX.span(region.pixelRect.x0, region.pixelRect.x1)
    const spanZ = ladderZ.span(region.pixelRect.y0, region.pixelRect.y1)
    const spread = (sp: AxisSpan): number => (sp.stated ? (sp.agreed > 1 ? 0.01 : 0.02) : wallM / 2)
    // A span stated by a chain the resolver re-read at another scale was not printed as used: DERIVED, not MEASURED.
    const reread = (sp: AxisSpan): boolean => sp.evidenceIds.some((e) => options.plan?.rereadEvidenceIds.has(e) === true)
    const basisOf = (sp: AxisSpan): LayoutQuantity['basis'] => (sp.stated ? (reread(sp) ? 'DERIVED' : 'MEASURED') : 'SCALED')
    masses.push({
      id: `mass-${masses.length}`,
      role: 'UNKNOWN',
      ring: region.ring,
      footprintRegionIds: [region.id],
      storeySpan: { fromIndex: baseStorey.index, toIndex: baseStorey.index, storeyIds: [baseStorey.id] },
      facadePlaneIds: [],
      widthM: quantity(bounds.x1 - bounds.x0, bounds.x1 - bounds.x0 - spread(spanX), bounds.x1 - bounds.x0 + spread(spanX), 'm', basisOf(spanX), spanX.evidenceIds.length > 0 ? spanX.evidenceIds : region.evidenceIds, `the distance between the outer faces of this body’s own walls: ${spanX.why}`),
      depthM: quantity(bounds.z1 - bounds.z0, bounds.z1 - bounds.z0 - spread(spanZ), bounds.z1 - bounds.z0 + spread(spanZ), 'm', basisOf(spanZ), spanZ.evidenceIds.length > 0 ? spanZ.evidenceIds : region.evidenceIds, `the distance between the outer faces of this body’s own walls: ${spanZ.why}`),
      observationIds: [],
      evidenceIds: region.evidenceIds,
      confidence: region.confidence,
      why: `a region of the base plan enclosed by its own walls: ${region.why}`,
    })
  }

  // --- how far up each mass goes (005L): the storey-support relation --------
  //
  // Registration says where another storey's plan sits; it does not say which body below carries it. Each walled
  // region of that plan is put on the plan below and weighed against every body there, and a body reaches that
  // storey only where a region stands on it over at least a room's span on both axes. Not where the plan's
  // bounding box happens to cover half of it: an envelope takes in a terrace, a void, an eave line, and on a sheet
  // with a mark beside the plan the mark — and an inset storey over a large house covers less than half of it and is
  // still carried by it entirely.
  const minSpanM = minBodySpanM(wallM)
  const tolM = round6(Math.max(wallM, tolerancePx * Math.max(frame.metresPerPixelX, frame.metresPerPixelY)))
  // the registration's own jitter: half a wall of the plan below (`tolerancePx`), in metres
  const jitterM = round6(tolerancePx * Math.max(frame.metresPerPixelX, frame.metresPerPixelY))
  const storeyOfPlan = (p: PlanReading): StoreyLayoutHypothesis | undefined => storeys.find((s) => s.frameIds.includes(p.frame.id))
  // Outward from the base (council A5L-6): a storey is decided after the one between it and the base, so a body
  // reaches it only through that one. Plans at the same distance keep their reading order (lowest first).
  const outward = plans
    .map((p, order) => ({ p, order, distance: Math.abs((storeyOfPlan(p)?.index ?? baseStorey.index) - baseStorey.index) }))
    .sort((a, b) => a.distance - b.distance || a.order - b.order)
    .map((x) => x.p)
  for (const plan of outward) {
    if (plan.frame.id === base.frame.id) continue
    const storey = storeyOfPlan(plan)
    if (!storey) continue
    const alignment = alignments.get(plan.frame.id)
    const below = storey.index < baseStorey.index
    if (!alignment) {
      storeyRegistrations.push({ frameId: plan.frame.id, storeyId: storey.id, storeyIndex: storey.index, declaredRole: plan.frame.roles.storey, candidates: 0, decision: 'NOT_REGISTERED', regions: [], relations: [], why: 'no placement of this plan puts its walls on the walls of the plan below' })
      continue
    }
    const reading = readingOf.get(plan.frame.id)
    const considered = consideredOf.get(plan.frame.id) ?? [alignment]
    const bodies = upperBodiesOf(plan)
    const outcome = (a: PlanAlignment) => storeySupportOf(bodies, a, { frame, masses, storey, plan, minSpanM, tolM, jitterM, below })
    const chosen = outcome(alignment)
    const standsOn = (o: SupportOutcome): string[] => [...o.supported.keys()].sort()
    // Two footprints whose sides lie within two of the bands a side is snapped by of each other are one reading: each
    // reading's side is within a band of where the wall is, so two readings of one storey can differ by two.
    const sameTol = round6(2 * (jitterM + plan.wallPx * alignment.scale * Math.max(frame.metresPerPixelX, frame.metresPerPixelY)))
    // The rival is the best placement that stands this storey on other bodies, or on the same ones materially
    // differently. A placement that lands the plan on the same walls by another route is the same reading. Where the
    // printed scale was held against a fit at another scale, the rivals are the other placements at the printed scale:
    // the walls have already been heard against the fit.
    const atChosenScale = (c: PlanAlignment): boolean => Math.abs(c.scale / alignment.scale - 1) <= WALL_PAIR_SCALE_AGREEMENT
    const rivals = considered
      .slice(1)
      .filter((c) => (reading?.held?.by === 'PRINTED_SCALE' ? atChosenScale(c) : true) && alignment.score - c.score < STOREY_RIVAL_WINDOW)
      .slice(0, STOREY_RIVALS_WEIGHED)
    const weighed = rivals.map((c) => ({ c, o: outcome(c) }))
    const rival = weighed.find((r) => !sameSupport(chosen, r.o, sameTol))
    const margin = round6(alignment.score - (rival?.c.score ?? considered[1]?.score ?? 0))
    // How finely the walls tell placements apart (council A5L-7): two placements nearer than that are a tie.
    const tie = Math.max(STOREY_TIE, reading?.resolution ?? 0)
    if (considered.length > 1) {
      alternatives.push({
        id: stableId('alternative', `storey-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }),
        what: `which part of the building below the ${plan.storey.toLowerCase()} storey plan sits over`,
        members: considered.slice(0, 4).map((c) => ({ id: c.targetId, score: c.score, summary: c.why })),
        chosenId: alignment.targetId,
        margin,
        why: rival ? `the walls of this plan land on the walls below better under this placement than under any that stands the storey on other bodies` : 'every placement weighed stands the storey on the same bodies',
      })
    }
    const record: StoreyRegistration = {
      frameId: plan.frame.id,
      storeyId: storey.id,
      storeyIndex: storey.index,
      declaredRole: plan.frame.roles.storey,
      candidates: considered.length,
      chosen: { targetId: alignment.targetId, scale: alignment.scale, offsetX: alignment.offsetX, offsetY: alignment.offsetY, agreement: alignment.agreement, score: alignment.score, stated: alignment.stated },
      ...(rival ? { rival: { targetId: rival.c.targetId, scale: rival.c.scale, offsetX: rival.c.offsetX, offsetY: rival.c.offsetY, score: rival.c.score, masses: standsOn(rival.o) } } : {}),
      margin,
      resolution: round6(tie),
      ...(reading?.printedScale ? { printedScale: { k: reading.printedScale.k, sharesAgainstFit: reading.printedScale.sharesAgainstFit, bodyInsideBelow: reading.printedScale.bodyInsideBelow, outcome: reading.printedScale.outcome } } : {}),
      decision: 'STACKED',
      regions: chosen.regions,
      relations: chosen.relations,
      why: '',
    }
    storeyRegistrations.push(record)
    // A reading the drawings state, held against a placement the walls fit better (council A5L-1, A5L-11), is said:
    // where the fit would stand the storey differently, the two are a disagreement on the record, not a silent choice.
    if (reading?.held) {
      const over = outcome(reading.held.over)
      // the fit stands it elsewhere when a side moves by more than one band: the statement and the fit are not two
      // jittered readings of one place, they are two places
      if (!sameSupport(chosen, over, sameTol / 2)) {
        conflicts.push({
          id: stableId('conflict', `storey-held-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }),
          kind: reading.held.by === 'PRINTED_SCALE' ? 'SCALE_DISAGREEMENT' : 'STOREY_COVERAGE_DISAGREES',
          what:
            reading.held.by === 'PRINTED_SCALE'
              ? `the ${plan.storey.toLowerCase()} storey is placed at the scale both plans print (${alignment.scale.toFixed(3)}); its walls fit the plan below better at ${reading.held.over.scale.toFixed(3)}, standing it on ${standsOn(over).join(', ') || 'nothing'} over another footprint`
              : `the ${plan.storey.toLowerCase()} storey is placed where both plans' chains put it; its walls fit the plan below better elsewhere, standing it on ${standsOn(over).join(', ') || 'nothing'} over another footprint`,
          itemIds: [...new Set([...standsOn(chosen), ...standsOn(over)])].sort(),
          evidenceIds: [],
          magnitude: round6(reading.held.over.score - alignment.score),
          unit: 'none',
        })
      }
    }
    // A disagreement about which bodies the storey stands on is §6's question, the one that decides whether a
    // one-storey garage gains an upper ring. Two placements nearer than the walls can tell apart are not decided by
    // the walls at all, and taking the first would be taking whichever was enumerated first: the storey is left
    // standing on nothing, and said so. A held statement is not tied with the fit it was held against.
    const held = alignment.stated && !!rival && !rival.c.stated
    if (rival && margin <= tie && !held) {
      const a = standsOn(chosen)
      const b = standsOn(rival.o)
      const sameBodies = a.join(',') === b.join(',')
      record.decision = 'AMBIGUOUS'
      record.why = sameBodies
        ? `two placements stand it on the same bodies (${a.join(', ')}) over different footprints, nearer in score (${margin.toFixed(4)}) than the walls can tell apart (${tie.toFixed(4)})`
        : `two placements stand it on different bodies (${a.join(', ') || 'none'} against ${b.join(', ') || 'none'}), nearer in score (${margin.toFixed(4)}) than the walls can tell apart (${tie.toFixed(4)})`
      conflicts.push({ id: stableId('conflict', `storey-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }), kind: 'STOREY_COVERAGE_DISAGREES', what: `the ${plan.storey.toLowerCase()} storey plan fits two places on the plan below equally well, ${sameBodies ? 'over different footprints' : 'standing on different bodies'}`, itemIds: [...new Set([...a, ...b])].sort(), evidenceIds: [], magnitude: margin, unit: 'none' })
      unresolved.push({ id: stableId('gap', `support-${storey.index}`, { frameId: plan.frame.id }), what: `which body the ${plan.storey.toLowerCase()} storey stands on`, reason: record.why, status: 'AMBIGUOUS', frameIds: [plan.frame.id, base.frame.id] })
      continue
    }
    // In a near tie, a body only the better placement stands the storey on is not decided by the walls either (council
    // D5L-7): §6 answers it no. The storey is built over the bodies both readings agree on; the disputed one is named.
    const disputed = new Set<string>()
    // A near reading that only ADDS bodies — the garage under the storey as well — leaves the chosen reading the
    // conservative one (§6): it is on the record as an alternative, and no conflict. One that drops a body, or stands
    // on the same bodies over another footprint, disputes the chosen reading.
    const onlyAdds = !!rival && standsOn(chosen).every((id) => rival.o.supported.has(id)) && sameSupport({ ...chosen, supported: chosen.supported }, { ...rival.o, supported: new Map([...rival.o.supported].filter(([id]) => chosen.supported.has(id))) }, sameTol)
    if (rival && margin < STOREY_RIVAL_WINDOW && !held && !onlyAdds) {
      conflicts.push({
        id: stableId('conflict', `storey-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }),
        kind: 'STOREY_COVERAGE_DISAGREES',
        what: `the ${plan.storey.toLowerCase()} storey plan fits ${alignment.targetId} and ${rival.c.targetId} almost equally well, standing on ${standsOn(chosen).join(', ') || 'nothing'} against ${standsOn(rival.o).join(', ') || 'nothing'}`,
        itemIds: [...new Set([...standsOn(chosen), ...standsOn(rival.o)])].sort(),
        evidenceIds: [],
        magnitude: margin,
        unit: 'none',
      })
      // the rival that stands it on other bodies, where it stands it on some: one that stands it on none puts the plan
      // nowhere, which is no answer to which body carries it
      if (rival.o.supported.size > 0) for (const id of standsOn(chosen)) if (!rival.o.supported.has(id)) disputed.add(id)
    }
    // A storey BELOW the plan the building is measured from is the other way round: its bodies are what the base's
    // bodies stand on. Where that lower plan is the GROUND plan and the base an upper one — a ground plan the chains
    // could not scale, an upper plan taken as the base — a body of it beyond every body of the base is a part of the
    // building the base plan does not draw (a garage beside an upper floor), and stacking the rest under the base would
    // build the house without it: the storey is left unstacked and the hole named. A basement below the ground plan
    // that reaches past it (under a terrace) is an ordinary basement (council A5L-5): built where it stands under the
    // house, its excess named.
    // Its walls count as well as its walled regions: a body the flood fill took for outside (a garage behind a door
    // as wide as its front) is still walled, and its walls are on the plan.
    const guard = below && plan.storey === 'GROUND'
    const exceeds = guard ? chosen.regions.filter((r) => r.body && (r.overhang === 'BEYOND_TOLERANCE' || r.overhang === 'UNSUPPORTED')).map((r) => `${r.regionId} by ${r.unsupportedM2.toFixed(1)} m²`) : []
    const walls = guard ? wallsBeyond(plan, alignment, frame, masses, round6(jitterM + plan.wallPx * alignment.scale * Math.max(frame.metresPerPixelX, frame.metresPerPixelY))) : 0
    if (walls > 0) exceeds.push(`its walls by ${walls.toFixed(1)} m²`)
    if (exceeds.length > 0) {
      record.decision = 'NO_SUPPORT'
      record.why = `this lower storey reaches past every body of the plan the building is measured from: ${exceeds.join(', ')}`
      unresolved.push({ id: stableId('gap', `lower-exceeds-${storey.index}`, { frameId: plan.frame.id }), what: `the bodies of the ${plan.storey.toLowerCase()} storey that the ${base.storey.toLowerCase()} plan does not draw`, reason: `${record.why}: the base plan does not hold the whole building, and the storey below is not stacked under part of it`, status: 'MISSING', frameIds: [plan.frame.id, base.frame.id] })
      continue
    }
    // Contiguity (council A5L-6): a body reaches this storey only through the storey between it and the base.
    const adjacent = below ? storey.index + 1 : storey.index - 1
    const cut = new Set<string>()
    for (const id of chosen.supported.keys()) {
      const mass = masses.find((m) => m.id === id)
      if (!mass) continue
      const reachesAdjacent = below ? mass.storeySpan.fromIndex <= adjacent : mass.storeySpan.toIndex >= adjacent
      if (!reachesAdjacent) cut.add(id)
    }
    const kept = [...chosen.supported.keys()].filter((id) => !disputed.has(id) && !cut.has(id)).sort()
    for (const id of [...disputed].sort())
      unresolved.push({ id: stableId('gap', `support-disputed-${storey.index}-${id}`, { frameId: plan.frame.id, mass: id }), what: `whether the ${plan.storey.toLowerCase()} storey stands on ${id}`, reason: `a placement nearly as good as the chosen one (within ${STOREY_RIVAL_WINDOW}) does not stand the storey on it; the walls do not decide, and the body is not given the storey`, status: 'AMBIGUOUS', frameIds: [plan.frame.id, base.frame.id] })
    for (const id of [...cut].sort())
      unresolved.push({ id: stableId('gap', `support-gap-${storey.index}-${id}`, { frameId: plan.frame.id, mass: id }), what: `the ${plan.storey.toLowerCase()} storey over ${id}`, reason: `its walled region stands on ${id}, but the storey between it and the base does not reach that body: a storey is not built over a storey that is not there`, status: 'AMBIGUOUS', frameIds: [plan.frame.id, base.frame.id] })
    if (kept.length === 0) {
      record.decision = chosen.supported.size === 0 ? 'NO_SUPPORT' : 'AMBIGUOUS'
      record.why = chosen.supported.size === 0 ? 'none of its walled regions stands on a body below over a room’s span' : `every body it stands on is disputed by a near placement or not reached by the storey between: ${[...disputed, ...cut].sort().join(', ')}`
      if (chosen.supported.size === 0) unresolved.push({ id: stableId('gap', `coverage-${storey.index}`, { frameId: plan.frame.id }), what: `which body the ${plan.storey.toLowerCase()} storey stands on`, reason: `once registered, none of its ${chosen.regions.filter((r) => r.body).length} walled region${chosen.regions.filter((r) => r.body).length === 1 ? '' : 's'} stands on a body found on the plan below over the ${minSpanM.toFixed(2)} m a room needs on both axes`, status: 'AMBIGUOUS', frameIds: [plan.frame.id] })
      continue
    }
    record.why = `stands on ${kept.join(', ')}${disputed.size + cut.size > 0 ? `; not on ${[...disputed, ...cut].sort().join(', ')}, which the walls do not decide or the storey between does not reach` : ''}`
    for (const mass of masses) {
      if (!kept.includes(mass.id)) continue
      const pieces = chosen.supported.get(mass.id)
      if (!pieces) continue
      pieces.forEach((piece, k) => {
        const id = k === 0 ? `footprint-${storey.index}-${mass.id}` : `footprint-${storey.index}-${mass.id}-${k}`
        const ring = rectangleRing(piece.x0, piece.z0, piece.x1, piece.z1)
        const region = chosen.regions.find((r) => r.regionId === piece.regionId)
        const relation = chosen.relations.find((r) => r.upperRegionId === piece.regionId && r.lowerMassId === mass.id)
        footprintRegions.push({
          id,
          storeyId: storey.id,
          kind: 'BUILT',
          ring,
          areaM2: round6(ringArea(ring)),
          frameId: plan.frame.id,
          pixelRect: region?.pixelRect ?? plan.extent,
          wallEvidence: { perimeterM: round6(2 * (piece.x1 - piece.x0 + piece.z1 - piece.z0)), walledM: round6(2 * (piece.x1 - piece.x0 + piece.z1 - piece.z0) * (region?.wallFraction ?? 0)), fraction: round6(region?.wallFraction ?? 0) },
          observationIds: [],
          evidenceIds: [],
          confidence: round6(Math.min(0.9, storey.confidence * (0.7 + 0.3 * (relation?.upperSupportedShare ?? 0)))),
          why: relation?.why ?? `the ${plan.storey.toLowerCase()} storey stands on this body`,
        })
        storey.footprintRegionIds.push(id)
        mass.footprintRegionIds.push(id)
        traces.push({ id: stableId('trace', id, { id }), itemId: id, what: `the ${plan.storey.toLowerCase()} storey over this body`, frameId: plan.frame.id, pixelRect: region?.pixelRect ?? plan.extent, observationIds: [], evidenceIds: [], why: `${alignment.why}; ${relation?.why ?? ''}` })
      })
      mass.storeySpan = {
        fromIndex: Math.min(mass.storeySpan.fromIndex, storey.index),
        toIndex: Math.max(mass.storeySpan.toIndex, storey.index),
        storeyIds: [...new Set([...mass.storeySpan.storeyIds, storey.id])],
      }
    }
    // What stands on nothing is not clipped away in silence: a part of a walled region beyond every body by more than
    // a wall's band from its edge is an overhang the plans state and nothing here can carry — above the base, a part
    // of a storey no body carries; below it, a part of a basement no body stands over.
    for (const region of chosen.regions.filter((r) => r.overhang === 'BEYOND_TOLERANCE' || r.overhang === 'UNSUPPORTED')) {
      unresolved.push({
        id: stableId('gap', `overhang-${storey.index}-${region.regionId}`, { frameId: plan.frame.id, region: region.regionId }),
        what: below ? `what stands over ${region.unsupportedM2.toFixed(1)} m² of the ${plan.storey.toLowerCase()} storey's walled region ${region.regionId}` : `what carries ${region.unsupportedM2.toFixed(1)} m² of the ${plan.storey.toLowerCase()} storey's walled region ${region.regionId}`,
        reason:
          region.overhang === 'UNSUPPORTED'
            ? `registered onto the plan below, it stands on no body there over a room’s span, or most of it on none; it is not built`
            : below
              ? `registered under the plan above, it reaches past every body there by more than a wall's band; the part under a body is built and the rest is not`
              : `registered onto the plan below, it reaches past every body there by more than a wall's band; the part over a body is built and the rest is not, and no column or beam is invented to carry it`,
        status: 'AMBIGUOUS',
        frameIds: [plan.frame.id, base.frame.id],
      })
      if (region.overhang === 'BEYOND_TOLERANCE') {
        conflicts.push({ id: stableId('conflict', `overhang-${storey.index}-${region.regionId}`, { frameId: plan.frame.id, region: region.regionId }), kind: 'STOREY_COVERAGE_DISAGREES', what: `the ${plan.storey.toLowerCase()} storey's walled region ${region.regionId} ${below ? 'reaches past the bodies above' : 'overhangs the bodies below'} by ${region.unsupportedM2.toFixed(1)} m²`, itemIds: [region.regionId], evidenceIds: [], magnitude: round6(region.unsupportedM2), unit: 'none' })
      }
    }
  }

  // --- roles, attachments and facades --------------------------------------
  assignRoles(masses, !!base.decomposition.envelope?.outline)
  attachments.push(...attachmentsBetween(masses, wallM))
  facadePlanes.push(...facadesOf(masses, storeys, wallM))
  for (const plane of facadePlanes) {
    const mass = masses.find((m) => m.id === plane.massId)
    if (mass) mass.facadePlaneIds.push(plane.id)
  }
  for (const found of recessesOf(base, frame, masses, baseStorey, options.metrics)) {
    footprintRegions.push(found.region)
    baseStorey.footprintRegionIds.push(found.region.id)
    recesses.push(found.recess)
    traces.push({
      id: stableId('trace', found.region.id, { id: found.region.id }),
      itemId: found.recess.id,
      what: 'a pocket the building wraps but does not enclose',
      frameId: base.frame.id,
      pixelRect: found.region.pixelRect,
      observationIds: [],
      evidenceIds: found.region.evidenceIds,
      why: found.recess.why,
    })
  }

  return { plans, base, frame, alignments, storeys, footprintRegions, masses, attachments, facadePlanes, recesses, alternatives, conflicts, unresolved, traces, skippedPlans, storeyRegistrations }
}

// ---------------------------------------------------------------------------
// 4. the pieces the layout is assembled from
// ---------------------------------------------------------------------------

/**
 * The metric evidence behind a region's boundaries.
 *
 * A region's edges are grid lines, and a grid line the chains support carries
 * the ids of the chain segments that supported it. This is the §5 requirement
 * that every accepted exterior segment is traceable to source coordinates,
 * satisfied by carrying the ids rather than by promising to.
 */
function chainEvidenceFor(plan: PlanReading, rect: PixelRect, metrics: MetricEvidenceSet): string[] {
  const ids = new Set<string>()
  const chainsById = new Map<string, DimensionChain>(metrics.chains.filter((c) => c.frameId === plan.frame.id).map((c) => [c.id, c]))
  const atLine = (lines: typeof plan.decomposition.linesX, px: number): void => {
    const line = lines.find((l) => Math.abs(l.px - px) < 0.5)
    if (!line) return
    for (const chainId of line.support.chainIds) {
      const chain = chainsById.get(chainId)
      if (!chain) continue
      for (const segment of chain.segments) {
        if (segment.evidenceId === undefined) continue
        if (Math.abs(segment.fromPx - line.px) > plan.wallPx && Math.abs(segment.toPx - line.px) > plan.wallPx) continue
        ids.add(segment.evidenceId)
      }
    }
  }
  atLine(plan.decomposition.linesX, rect.x0)
  atLine(plan.decomposition.linesX, rect.x1)
  atLine(plan.decomposition.linesY, rect.y0)
  atLine(plan.decomposition.linesY, rect.y1)
  return [...ids].sort()
}

/**
 * The strips a dimension chain measures beyond the last wall.
 *
 * These are the reason an overall depth exceeds a walled depth, and they are
 * the single most consequential thing the old one-rectangle reconstruction got
 * wrong: it took the outermost dimension, called it the building, and gained
 * two metres of house that is actually an entrance platform at one end and a
 * terrace at the other. They are kept as evidence and never as building.
 */
function zonesOutsideEnvelope(base: PlanReading, envelope: PixelRect, frame: WorldFrame): FootprintRegionHypothesis[] {
  const out: FootprintRegionHypothesis[] = []
  const minCell = Math.max(2, base.wallPx / 2)
  const strips: Array<{ side: PlanSide; rect: PixelRect }> = [
    { side: 'MIN_Z', rect: { x0: envelope.x0, y0: base.extent.y0, x1: envelope.x1, y1: envelope.y0 } },
    { side: 'MAX_Z', rect: { x0: envelope.x0, y0: envelope.y1, x1: envelope.x1, y1: base.extent.y1 } },
    { side: 'MIN_X', rect: { x0: base.extent.x0, y0: envelope.y0, x1: envelope.x0, y1: envelope.y1 } },
    { side: 'MAX_X', rect: { x0: envelope.x1, y0: envelope.y0, x1: base.extent.x1, y1: envelope.y1 } },
  ]
  for (const strip of strips) {
    const w = strip.rect.x1 - strip.rect.x0
    const h = strip.rect.y1 - strip.rect.y0
    if (w < minCell || h < minCell) continue
    const ring = ringOfRect(strip.rect, frame)
    const id = `zone-${strip.side.toLowerCase()}`
    out.push({
      id,
      storeyId: '',
      kind: 'ZONE',
      ring,
      areaM2: round6(ringArea(ring)),
      frameId: base.frame.id,
      pixelRect: strip.rect,
      wallEvidence: { perimeterM: 0, walledM: 0, fraction: 0 },
      observationIds: [],
      evidenceIds: [],
      confidence: 0.6,
      why: 'dimensioned on the plan and outside every wall on it: a zone the building reaches over or stands back from, not a part of it',
    })
  }
  return out
}

/**
 * Which mass is the building and which are attached to it.
 *
 * By how far up it goes first, and only then by how big it is. A garage with
 * twice the plan area of the house it is attached to is still the attachment,
 * because the house is the thing with two storeys, and a rule that went by
 * area alone would say otherwise on exactly the buildings where it matters.
 */
function assignRoles(masses: MassHypothesis[], outlineFrame = false): void {
  if (masses.length === 0) return
  // On an outline frame a strip is never the main body (005C post-review): it is what the cut left along a face.
  const strips = outlineFrame ? stripsOf(masses, (m) => ({ w: ringBoundsOf(m.ring).x1 - ringBoundsOf(m.ring).x0, h: ringBoundsOf(m.ring).z1 - ringBoundsOf(m.ring).z0 })) : new Set<MassHypothesis>()
  const rank = (m: MassHypothesis): number => (strips.has(m) ? 0 : 1e9) + (m.storeySpan.toIndex - m.storeySpan.fromIndex) * 1000 + ringArea(m.ring)
  const main = [...masses].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))[0]
  main.role = 'MAIN'
  main.why = `${main.why}; the body that reaches highest, and the largest of those that do`
  for (const mass of masses) {
    if (mass === main) continue
    mass.role = touching(mass.ring, main.ring, 0.5) ? 'ATTACHED' : 'UNKNOWN'
    mass.why = mass.role === 'ATTACHED' ? `${mass.why}; it shares a wall line with the main body` : `${mass.why}; it stands clear of the main body`
  }
}

/** True when two rectangles meet along a segment rather than merely coming near one another. */
function touching(a: PlanRing, b: PlanRing, tolerance: number): boolean {
  const ab = ringBoundsOf(a)
  const bb = ringBoundsOf(b)
  const xTouch = Math.abs(ab.x1 - bb.x0) <= tolerance || Math.abs(bb.x1 - ab.x0) <= tolerance
  const zTouch = Math.abs(ab.z1 - bb.z0) <= tolerance || Math.abs(bb.z1 - ab.z0) <= tolerance
  return (xTouch && overlap1d(ab.z0, ab.z1, bb.z0, bb.z1) > tolerance) || (zTouch && overlap1d(ab.x0, ab.x1, bb.x0, bb.x1) > tolerance)
}

/** The contact between two masses: which axis they meet on, where, and over what stretch. */
function contactOf(a: PlanRing, b: PlanRing, tolerance: number): AttachmentRelation['contact'] | undefined {
  const ab = ringBoundsOf(a)
  const bb = ringBoundsOf(b)
  const zSpan = overlap1d(ab.z0, ab.z1, bb.z0, bb.z1)
  const xSpan = overlap1d(ab.x0, ab.x1, bb.x0, bb.x1)
  if (zSpan > tolerance) {
    if (Math.abs(ab.x1 - bb.x0) <= tolerance) return { axis: 'X', at: round6((ab.x1 + bb.x0) / 2), from: round6(Math.max(ab.z0, bb.z0)), to: round6(Math.min(ab.z1, bb.z1)) }
    if (Math.abs(bb.x1 - ab.x0) <= tolerance) return { axis: 'X', at: round6((bb.x1 + ab.x0) / 2), from: round6(Math.max(ab.z0, bb.z0)), to: round6(Math.min(ab.z1, bb.z1)) }
  }
  if (xSpan > tolerance) {
    if (Math.abs(ab.z1 - bb.z0) <= tolerance) return { axis: 'Z', at: round6((ab.z1 + bb.z0) / 2), from: round6(Math.max(ab.x0, bb.x0)), to: round6(Math.min(ab.x1, bb.x1)) }
    if (Math.abs(bb.z1 - ab.z0) <= tolerance) return { axis: 'Z', at: round6((bb.z1 + ab.z0) / 2), from: round6(Math.max(ab.x0, bb.x0)), to: round6(Math.min(ab.x1, bb.x1)) }
  }
  return undefined
}

function attachmentsBetween(masses: readonly MassHypothesis[], wallM: number): AttachmentRelation[] {
  const out: AttachmentRelation[] = []
  const tolerance = Math.max(0.05, wallM)
  for (let i = 0; i < masses.length; i += 1) {
    for (let j = i + 1; j < masses.length; j += 1) {
      const a = masses[i]
      const b = masses[j]
      const contact = contactOf(a.ring, b.ring, tolerance)
      if (!contact) continue
      const shorter = ringArea(a.ring) <= ringArea(b.ring) ? a : b
      const longer = shorter === a ? b : a
      const span = Math.abs(contact.to - contact.from)
      out.push({
        id: stableId('attachment', `${a.id}-${b.id}-shares`, { a: a.id, b: b.id }),
        kind: 'SHARES_WALL_WITH',
        fromId: a.id,
        toId: b.id,
        contact,
        evidenceIds: [...new Set([...a.evidenceIds, ...b.evidenceIds])].sort(),
        confidence: round6(Math.min(0.92, 0.5 + Math.min(0.4, span / 10))),
        why: `their outlines meet along ${span.toFixed(2)} m of the line ${contact.axis} = ${contact.at.toFixed(2)}`,
      })
      out.push({
        id: stableId('attachment', `${shorter.id}-${longer.id}-attached`, { a: shorter.id, b: longer.id }),
        kind: 'ATTACHED_TO',
        fromId: shorter.id,
        toId: longer.id,
        contact,
        evidenceIds: [],
        confidence: round6(Math.min(0.9, 0.45 + Math.min(0.4, span / 10))),
        why: `${shorter.id} is the smaller of the two and stands against ${longer.id} rather than on its own`,
      })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * The outside faces of every mass.
 *
 * A mass's four sides, minus the stretches another mass stands against — that
 * stretch is a party wall, not a facade, and hanging windows on it is how a
 * reconstruction ends up with a window looking into a garage.
 */
function facadesOf(masses: readonly MassHypothesis[], storeys: readonly StoreyLayoutHypothesis[], wallM: number): FacadePlaneHypothesis[] {
  const out: FacadePlaneHypothesis[] = []
  const tolerance = Math.max(0.05, wallM)
  for (const mass of masses) {
    const b = ringBoundsOf(mass.ring)
    const storeyIds = storeys.filter((s) => s.index >= mass.storeySpan.fromIndex && s.index <= mass.storeySpan.toIndex).map((s) => s.id)
    const sides: Array<{ side: PlanSide; axis: 'X' | 'Z'; at: number; from: number; to: number }> = [
      { side: 'MIN_X', axis: 'X', at: b.x0, from: b.z0, to: b.z1 },
      { side: 'MAX_X', axis: 'X', at: b.x1, from: b.z0, to: b.z1 },
      { side: 'MIN_Z', axis: 'Z', at: b.z0, from: b.x0, to: b.x1 },
      { side: 'MAX_Z', axis: 'Z', at: b.z1, from: b.x0, to: b.x1 },
    ]
    for (const side of sides) {
      const blocked: Array<[number, number]> = []
      for (const other of masses) {
        if (other === mass) continue
        const o = ringBoundsOf(other.ring)
        const meets = side.axis === 'X' ? Math.abs((side.side === 'MIN_X' ? o.x1 : o.x0) - side.at) <= tolerance : Math.abs((side.side === 'MIN_Z' ? o.z1 : o.z0) - side.at) <= tolerance
        if (!meets) continue
        const lo = side.axis === 'X' ? Math.max(side.from, o.z0) : Math.max(side.from, o.x0)
        const hi = side.axis === 'X' ? Math.min(side.to, o.z1) : Math.min(side.to, o.x1)
        if (hi > lo) blocked.push([lo, hi])
      }
      blocked.sort((p, q) => p[0] - q[0])
      const pieces: Array<{ from: number; to: number; exterior: boolean }> = []
      let cursor = side.from
      for (const [lo, hi] of blocked) {
        if (lo > cursor) pieces.push({ from: cursor, to: lo, exterior: true })
        pieces.push({ from: Math.max(cursor, lo), to: hi, exterior: false })
        cursor = Math.max(cursor, hi)
      }
      if (cursor < side.to) pieces.push({ from: cursor, to: side.to, exterior: true })
      for (const piece of pieces) {
        if (piece.to - piece.from < tolerance) continue
        out.push({
          id: stableId('facade', `${mass.id}-${side.side.toLowerCase()}`, { massId: mass.id, side: side.side, from: round6(piece.from), to: round6(piece.to) }),
          massId: mass.id,
          side: side.side,
          axis: side.axis,
          at: round6(side.at),
          from: round6(piece.from),
          to: round6(piece.to),
          storeyIds,
          exterior: piece.exterior,
          frameIds: [],
          confidence: mass.confidence,
          why: piece.exterior
            ? `${(piece.to - piece.from).toFixed(2)} m of this body's ${side.side.replace('_', ' ').toLowerCase()} face with nothing standing against it`
            : `${(piece.to - piece.from).toFixed(2)} m of this body's ${side.side.replace('_', ' ').toLowerCase()} face shared with another body: a party wall, not a facade`,
        })
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Recesses, as topology.
 *
 * A pocket the plan's flood fill could reach but the building wraps on three
 * sides. What makes it a recess rather than a room is the side it opens
 * through, and that side is what a facade later has to have a hole in — so it
 * is stated as a MOUTH on a named face, a BACK plane behind it, a depth, and
 * whether each side return wall was actually found.
 */
function recessesOf(
  base: PlanReading,
  frame: WorldFrame,
  masses: readonly MassHypothesis[],
  storey: StoreyLayoutHypothesis,
  metrics: MetricEvidenceSet,
): Array<{ recess: RecessHypothesis; region: FootprintRegionHypothesis }> {
  const out: Array<{ recess: RecessHypothesis; region: FootprintRegionHypothesis }> = []
  for (const region of base.decomposition.regions) {
    if (region.classification !== 'RECESS') continue
    // The mouth is the least shut of the four sides, taken over the cells of
    // this region only.
    const cells = base.decomposition.cells.filter((c) => region.cells.some((r) => r.ix === c.ix && r.iy === c.iy))
    const closure: number[] = [0, 0, 0, 0]
    const count: number[] = [0, 0, 0, 0]
    for (const cell of cells) {
      const neighbours: Array<[number, number]> = [
        [cell.ix, cell.iy - 1],
        [cell.ix + 1, cell.iy],
        [cell.ix, cell.iy + 1],
        [cell.ix - 1, cell.iy],
      ]
      for (let s = 0; s < 4; s += 1) {
        if (region.cells.some((r) => r.ix === neighbours[s][0] && r.iy === neighbours[s][1])) continue
        closure[s] += cell.edges[s].closure
        count[s] += 1
      }
    }
    const mean = closure.map((c, i) => (count[i] === 0 ? 1 : c / count[i]))
    let mouthIndex = 0
    for (let s = 1; s < 4; s += 1) if (mean[s] < mean[mouthIndex]) mouthIndex = s
    const mouthSide = SIDE_OF_EDGE[mouthIndex]
    const ring = ringOfRect(region.rect, frame)
    const b = ringBoundsOf(ring)
    const host = [...masses].sort((a, c) => rectOverlapArea(c.ring, ring) - rectOverlapArea(a.ring, ring) || a.id.localeCompare(c.id))[0]
    const along = mouthSide === 'MIN_X' || mouthSide === 'MAX_X' ? { axis: 'X' as const, at: mouthSide === 'MIN_X' ? b.x0 : b.x1, from: b.z0, to: b.z1, backAt: mouthSide === 'MIN_X' ? b.x1 : b.x0, depth: b.x1 - b.x0 } : { axis: 'Z' as const, at: mouthSide === 'MIN_Z' ? b.z0 : b.z1, from: b.x0, to: b.x1, backAt: mouthSide === 'MIN_Z' ? b.z1 : b.z0, depth: b.z1 - b.z0 }
    const returns = { low: mean[(mouthIndex + 1) % 4] >= 0.62, high: mean[(mouthIndex + 3) % 4] >= 0.62 }
    const regionId = `footprint-${storey.index}-${region.id}`
    const evidenceIds = chainEvidenceFor(base, region.rect, metrics)
    out.push({
      region: {
        id: regionId,
        storeyId: storey.id,
        kind: 'RECESS',
        ring,
        areaM2: round6(ringArea(ring)),
        frameId: base.frame.id,
        pixelRect: region.rect,
        wallEvidence: perimeterWallEvidence(region, base.decomposition, frame),
        observationIds: [],
        evidenceIds,
        confidence: region.confidence,
        why: region.why,
      },
      recess: {
        id: `recess-${out.length}`,
        massId: host?.id ?? '',
        footprintRegionId: regionId,
        mouthSide,
        mouth: { axis: along.axis, at: round6(along.at), from: round6(along.from), to: round6(along.to) },
        backAt: round6(along.backAt),
        depthM: quantity(along.depth, along.depth * 0.9, along.depth * 1.1, 'm', 'DERIVED', evidenceIds, 'the distance from the mouth to the back of the pocket, between grid lines the plan supports'),
        returns,
        storeyIds: [storey.id],
        observationIds: [],
        evidenceIds,
        confidence: round6(Math.min(0.85, region.confidence)),
        why: `the building wraps this pocket on ${[0, 1, 2, 3].filter((s) => s !== mouthIndex && mean[s] >= 0.62).length} sides and it opens through its ${mouthSide.replace('_', ' ').toLowerCase()} face`,
      },
    })
  }
  return out
}
