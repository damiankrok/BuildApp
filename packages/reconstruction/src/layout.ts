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
import type { ExtentProvenance, PlanExtent } from './plan-decomposition.js'
import { wallWitness } from './plan-extent.js'
import type { WallWitness } from './plan-extent.js'
import type { GridLine, PlanCallout, PlanDecomposition, PlanRegion } from './plan-decomposition.js'
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
export const LAYOUT_INFERENCE_VERSION = '1.0.0'

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
          : planExtent(chains, bands, wallPx, sheet.witness)
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
      const decomposition = sheet.decompositions.get(key) ?? decomposePlan(mask, chains, bands, registration, extent.rect, { callouts: planCallouts(options.metrics, frame.id), sheetWallPx: wallPx, exteriorTicks: exteriorTicksOf(chains, extent.roles), checkpoint: options.checkpoint, ...(shutMouths ? { shutPocketMouths: true } : {}) })
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
  return out
}

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
export function alignPlans(base: PlanReading, other: PlanReading, options: { maxAnisotropy?: number; coverageWeight?: number; statedBonus?: number; useStated?: boolean } = {}): { best: PlanAlignment | undefined; considered: PlanAlignment[] } {
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

  for (const target of alignmentTargets(base)) {
    const sx = width(target.rect) / width(source)
    const sy = height(target.rect) / height(source)
    const fitted = Math.max(sx, sy) / Math.max(1e-9, Math.min(sx, sy))
    const scales: Array<{ k: number; why: string }> = []
    if (stated && stated.anisotropy <= maxAnisotropy) scales.push({ k: stated.k, why: 'the scale both plans print on their own chains' })
    if (Number.isFinite(fitted) && fitted <= maxAnisotropy) scales.push({ k: (sx + sy) / 2, why: `the scale that makes this plan the size of ${target.id}` })
    for (const { k: scale, why: scaleWhy } of scales) {
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
        offsetsX.push({ v: px(source.x0, 'x') - source.x0 * scale, stated: true, why: 'where its own chains put it along x' })
        offsetsY.push({ v: px(source.y0, 'y') - source.y0 * scale, stated: true, why: 'where its own chains put it along z' })
      }
      for (const ox of offsetsX) {
        for (const oy of offsetsY) {
          const offsetX = ox.v
          const offsetY = oy.v
          let matched = 0
          for (const axis of ['VERTICAL', 'HORIZONTAL'] as const) {
            for (const band of otherAxes[axis]) {
              const mapped = axis === 'VERTICAL' ? band.axisPx * scale + offsetX : band.axisPx * scale + offsetY
              const near = baseAxes[axis].some((b) => Math.abs(b.axisPx - mapped) <= tolerance)
              if (near) matched += band.length
            }
          }
          const agreement = round6(matched / totalLength)
          // §20's simple-explanation prior, as a small thumb on the scale and
          // not more: an upper storey usually covers most of the storey below,
          // so where two targets explain the walls equally well the larger is
          // the likelier reading. It must never outweigh the walls themselves.
          const placed: PixelRect = { x0: source.x0 * scale + offsetX, y0: source.y0 * scale + offsetY, x1: source.x1 * scale + offsetX, y1: source.y1 * scale + offsetY }
          // Covering all of the storey below is the likeliest reading; covering
          // TWICE it is not a simpler explanation but a wrong one, so the prior
          // has to fall away past a full covering rather than keep climbing.
          const ratio = (width(placed) * height(placed)) / Math.max(1, width(envelope) * height(envelope))
          const coverage = round6(ratio <= 1 ? Math.max(0, ratio) : Math.max(0, 2 - ratio))
          // Where the storey sits is stated by its own chains or guessed from
          // how storeys usually stack, and the two must not be weighed as if
          // they were the same kind of thing. The bonus is small enough that
          // any real difference in how the walls line up still decides.
          const isStated = ox.stated && oy.stated
          considered.push({
            scale: round6(scale),
            offsetX: round6(offsetX),
            offsetY: round6(offsetY),
            targetId: target.id,
            targetRect: target.rect,
            placedRect: { x0: round6(placed.x0), y0: round6(placed.y0), x1: round6(placed.x1), y1: round6(placed.y1) },
            agreement,
            stated: isStated,
            score: round6(agreement + coverageWeight * coverage + (isStated ? statedBonus : 0)),
            why: `${Math.round(agreement * 100)}% of this plan's wall lands on wall at ${scaleWhy} (${scale.toFixed(3)}), ${ox.why} and ${oy.why} of ${target.id}, covering ${Math.round(coverage * 100)}% of the building below`,
          })
        }
      }
    }
  }
  considered.sort((a, b) => b.score - a.score || a.targetId.localeCompare(b.targetId) || a.offsetX - b.offsetX || a.offsetY - b.offsetY)
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
  return { best: distinct[0], considered: distinct }
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
export function inferStructuralLayout(options: StructuralLayoutOptions): StructuralLayoutDraft {
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

  const empty: StructuralLayoutDraft = { plans, base: undefined, frame: undefined, alignments, storeys, footprintRegions, masses, attachments, facadePlanes, recesses, alternatives, conflicts, unresolved, traces, skippedPlans }
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
  const standsOn = (rect: PixelRect): string =>
    built
      .filter((region) => {
        const w = Math.max(0, Math.min(rect.x1, region.rect.x1) - Math.max(rect.x0, region.rect.x0))
        const h = Math.max(0, Math.min(rect.y1, region.rect.y1) - Math.max(rect.y0, region.rect.y0))
        return (w * h) / Math.max(1, (region.rect.x1 - region.rect.x0) * (region.rect.y1 - region.rect.y0)) >= 0.5
      })
      .map((region) => region.id)
      .sort()
      .join(',')

  // --- storeys, and the alignment of each onto the base ---------------------
  for (const plan of plans) {
    const index = indices.get(plan.storey) ?? 0
    const isBase = plan.frame.id === base.frame.id
    let why = isBase ? `the plan the building's coordinates are taken from: ${base.extentWhy}` : ''
    let registeredFrom: string | undefined
    let confidence = isBase ? 0.9 : 0.4
    if (!isBase) {
      const { best, considered } = alignPlans(base, plan, options.plan?.alignByFitOnly ? { useStated: false } : {})
      if (best) {
        alignments.set(plan.frame.id, best)
        registeredFrom = base.frame.id
        confidence = round6(Math.min(0.92, 0.35 + best.agreement * 0.6))
        why = `registered onto the plan below: ${best.why}`
        if (considered.length > 1) {
          // The runner-up worth reporting is the best one that puts the storey
          // somewhere ELSE. Two candidates that land the plan on the same
          // walls are one reading arrived at twice — a plan flush with a wall
          // is also centred on it when it is the same size — and calling that
          // a disagreement turns agreement into doubt.
          const elsewhere = considered.slice(1).find((c) => rectIoU(c.placedRect, best.placedRect) < 0.7)
          const runnerUp = elsewhere ?? considered[1]
          alternatives.push({
            id: stableId('alternative', `storey-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }),
            what: `which part of the building below the ${plan.storey.toLowerCase()} storey plan sits over`,
            members: considered.slice(0, 4).map((c) => ({ id: c.targetId, score: c.score, summary: c.why })),
            chosenId: best.targetId,
            margin: round6(best.score - runnerUp.score),
            why: `the walls of this plan land on the walls of ${best.targetId} better than on any other part of the building below`,
          })
          // A disagreement about COVERAGE is a disagreement about which bodies
          // this storey stands on — §6's question, the one that decides
          // whether a single-storey garage gains an upper ring. Two readings
          // that stand the storey on the same bodies and differ only in where
          // exactly they sit on them are a wobble, reported as the alternative
          // it is and not as a contradiction in the building's composition.
          const different = elsewhere !== undefined && standsOn(elsewhere.placedRect) !== standsOn(best.placedRect)
          if (elsewhere && different && best.score - elsewhere.score < 0.1 && !(best.stated && !elsewhere.stated)) {
            conflicts.push({
              id: stableId('conflict', `storey-${plan.storey.toLowerCase()}`, { frameId: plan.frame.id }),
              kind: 'STOREY_COVERAGE_DISAGREES',
              what: `the ${plan.storey.toLowerCase()} storey plan fits ${best.targetId} and ${elsewhere.targetId} almost equally well, in two places ${Math.round((1 - rectIoU(elsewhere.placedRect, best.placedRect)) * 100)}% apart`,
              itemIds: [best.targetId, elsewhere.targetId],
              evidenceIds: [],
              magnitude: round6(best.score - elsewhere.score),
              unit: 'none',
            })
          }
        }
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

  // --- how far up each mass goes -------------------------------------------
  for (const plan of plans) {
    if (plan.frame.id === base.frame.id) continue
    const alignment = alignments.get(plan.frame.id)
    const storey = storeys.find((s) => s.frameIds.includes(plan.frame.id))
    if (!alignment || !storey) continue
    const source = plan.decomposition.envelope?.rect ?? plan.extent
    const mapped: PixelRect = {
      x0: source.x0 * alignment.scale + alignment.offsetX,
      x1: source.x1 * alignment.scale + alignment.offsetX,
      y0: source.y0 * alignment.scale + alignment.offsetY,
      y1: source.y1 * alignment.scale + alignment.offsetY,
    }
    const upperRing = ringOfRect(mapped, frame)
    let covered = 0
    for (const mass of masses) {
      const share = rectOverlapArea(upperRing, mass.ring) / Math.max(1e-9, ringArea(mass.ring))
      if (share < 0.5) continue
      covered += 1
      const bounds = ringBoundsOf(mass.ring)
      const upper = ringBoundsOf(upperRing)
      const ring = rectangleRing(
        round6(Math.max(bounds.x0, upper.x0)),
        round6(Math.max(bounds.z0, upper.z0)),
        round6(Math.min(bounds.x1, upper.x1)),
        round6(Math.min(bounds.z1, upper.z1)),
      )
      const id = `footprint-${storey.index}-${mass.id}`
      footprintRegions.push({
        id,
        storeyId: storey.id,
        kind: 'BUILT',
        ring,
        areaM2: round6(ringArea(ring)),
        frameId: plan.frame.id,
        pixelRect: source,
        wallEvidence: { perimeterM: 0, walledM: 0, fraction: round6(alignment.agreement) },
        observationIds: [],
        evidenceIds: [],
        confidence: round6(Math.min(0.9, storey.confidence * (0.7 + 0.3 * share))),
        why: `the ${plan.storey.toLowerCase()} storey plan covers ${Math.round(share * 100)}% of this body once registered onto the plan below`,
      })
      storey.footprintRegionIds.push(id)
      mass.footprintRegionIds.push(id)
      mass.storeySpan = {
        fromIndex: Math.min(mass.storeySpan.fromIndex, storey.index),
        toIndex: Math.max(mass.storeySpan.toIndex, storey.index),
        storeyIds: [...new Set([...mass.storeySpan.storeyIds, storey.id])],
      }
      traces.push({
        id: stableId('trace', id, { id }),
        itemId: id,
        what: `the ${plan.storey.toLowerCase()} storey over this body`,
        frameId: plan.frame.id,
        pixelRect: source,
        observationIds: [],
        evidenceIds: [],
        why: alignment.why,
      })
    }
    if (covered === 0) {
      unresolved.push({
        id: stableId('gap', `coverage-${storey.index}`, { frameId: plan.frame.id }),
        what: `which body the ${plan.storey.toLowerCase()} storey stands on`,
        reason: 'its registered outline does not cover half of any body found on the plan below',
        status: 'AMBIGUOUS',
        frameIds: [plan.frame.id],
      })
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

  return { plans, base, frame, alignments, storeys, footprintRegions, masses, attachments, facadePlanes, recesses, alternatives, conflicts, unresolved, traces, skippedPlans }
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
