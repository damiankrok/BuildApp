/**
 * The CAPABILITY REGISTRY — an engineering contract, not marketing.
 *
 * For each architectural capability it states, separately:
 *
 * - `status`: what the semantic language, the DSL, the compiler and the
 *   closure audit SUPPORT (SUPPORTED), support with named gaps (PARTIAL), or
 *   do not support (UNKNOWN). Every SUPPORTED or PARTIAL entry names the
 *   synthetic fixtures that prove it, and a test runs them.
 * - `recognition`: what AUTOMATIC recognition exists. `ANALYZER_V2` means the
 *   production analyzer emits it from real drawings today (in its legacy
 *   form where noted); `SYNTHETIC_PIPELINE` means the hypothesis pipeline
 *   has been demonstrated on synthetic evidence only; `NONE` means nothing
 *   detects it yet. The framework existing is not a claim that houses are
 *   recognised.
 * - `evidenceRequirements`: what the hypothesis pipeline needs before it may
 *   emit the capability's semantic objects — never one visual line.
 * - `emittedSemanticTypes`: the primitives and assemblies it produces.
 * - `notes` and `knownGaps`.
 */
import type { ProposalKind } from '../proposals.js'

export type CapabilityStatus = 'SUPPORTED' | 'PARTIAL' | 'UNKNOWN'
export type RecognitionStatus = 'ANALYZER_V2' | 'SYNTHETIC_PIPELINE' | 'NONE'

export const CAPABILITY_KEYS = [
  'ROOF_GABLE',
  'ROOF_HIP',
  'ROOF_SHED',
  'ROOF_FLAT',
  'ROOF_INTERSECTION',
  'ROOF_VALLEY',
  'ROOF_STEP',
  'ROOF_DORMER',
  'PARAPET',
  'BALCONY',
  'LOGGIA',
  'TERRACE',
  'CANOPY',
  'CARPORT',
  'PERGOLA',
  'COLUMN',
  'BEAM',
  'EXTERIOR_STEPS',
  'ENTRANCE',
  'HANDRAIL',
  'UNKNOWN_ASSEMBLY',
] as const
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

/**
 * One thing the pipeline must see. Proposals of any of `kinds` count towards
 * `minCount`; `crossView` asks for them to come from at least two frames.
 */
export type EvidenceRequirement = {
  id: string
  description: string
  kinds: readonly ProposalKind[]
  minCount: number
  required: boolean
  crossView?: boolean
  weight: number
  /** For printed values: only quantities whose name starts with one of these count (a step datum is not a roof pitch). */
  quantities?: readonly string[]
}

export type Capability = {
  key: CapabilityKey
  status: CapabilityStatus
  recognition: RecognitionStatus
  evidenceRequirements: readonly EvidenceRequirement[]
  /** Evidence that rules the capability out (a continuous cover rules out a pergola). */
  exclusions: readonly ProposalKind[]
  emittedSemanticTypes: readonly string[]
  /** Synthetic diversity fixtures that prove it (packages/architecture/src/fixtures). */
  fixtures: readonly string[]
  /** Hypothesis pipeline demonstrations (packages/architecture/src/hypotheses/demos.ts). */
  demos: readonly string[]
  notes: readonly string[]
  knownGaps: readonly string[]
}

const req = (id: string, description: string, kinds: readonly ProposalKind[], minCount: number, required: boolean, weight = 1, crossView = false): EvidenceRequirement => ({ id, description, kinds, minCount, required, weight, crossView })

const ROOF_PLANES = req('roof-planes', 'planar roof regions (plan outline, pitch and fall from a section or elevation)', ['ROOF_PLANE_REGION'], 1, true, 2)
const ROOF_LINES = req('roof-lines', 'roof lines (ridges, hips, valleys) corroborating how the planes join', ['ROOF_LINE'], 1, false, 1)
const ROOF_PITCH = { ...req('roof-pitch', 'a printed pitch or level datum', ['PRINTED_DIMENSION'], 1, false, 1), quantities: ['roof.'] }

export const CAPABILITY_REGISTRY: readonly Capability[] = [
  {
    key: 'ROOF_GABLE',
    status: 'SUPPORTED',
    recognition: 'ANALYZER_V2',
    evidenceRequirements: [ROOF_PLANES, ROOF_LINES, ROOF_PITCH],
    exclusions: [],
    emittedSemanticTypes: ['RoofPlane', 'Ridge', 'Eave', 'Verge', 'Fascia', 'RoofAssembly'],
    fixtures: ['roof-gable'],
    demos: ['roof-intersecting'],
    notes: ['a gable is two planes, a ridge, two eaves and four verges; the GABLE label describes the graph', 'the production analyzer emits gables as the legacy rectangular Roof, whose plane graph `legacyRoofGraph` derives exactly'],
    knownGaps: ['the analyzer does not yet emit roof planes directly'],
  },
  {
    key: 'ROOF_HIP',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [ROOF_PLANES, ROOF_LINES, ROOF_PITCH],
    exclusions: [],
    emittedSemanticTypes: ['RoofPlane', 'HipEdge', 'Ridge', 'Eave', 'RoofAssembly'],
    fixtures: ['roof-hip'],
    demos: ['roof-hip'],
    notes: ['a hip is four planes, four hips and a ridge (or an apex); CONNECT_ROOF_PLANES AUTO reads a sloping convex crease as a hip'],
    knownGaps: ['half-hips are representable as planes but have no fixture'],
  },
  {
    key: 'ROOF_SHED',
    status: 'SUPPORTED',
    recognition: 'NONE',
    evidenceRequirements: [ROOF_PLANES, ROOF_PITCH],
    exclusions: [],
    emittedSemanticTypes: ['RoofPlane', 'Eave', 'Verge', 'RoofBoundary', 'RoofAssembly'],
    fixtures: ['roof-shed'],
    demos: [],
    notes: ['one plane; its high edge is a BOUNDARY (or an ABUTMENT against a wall rising past it)'],
    knownGaps: [],
  },
  {
    key: 'ROOF_FLAT',
    status: 'SUPPORTED',
    recognition: 'ANALYZER_V2',
    evidenceRequirements: [ROOF_PLANES],
    exclusions: [],
    emittedSemanticTypes: ['RoofPlane', 'RoofBoundary', 'Parapet', 'RoofAssembly'],
    fixtures: ['roof-flat-parapet'],
    demos: [],
    notes: ['a flat roof is a plane, its boundary edges, the parapet runs standing on it and the walls under it — not a slab with a border', 'the analyzer emits flat roofs as the legacy FLAT Roof (derived plane graph)'],
    knownGaps: ['roof falls (a flat roof\'s drainage slope) are stated as a small pitch; there is no fall-to-outlet model'],
  },
  {
    key: 'ROOF_INTERSECTION',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [ROOF_PLANES, ROOF_LINES, ROOF_PITCH],
    exclusions: [],
    emittedSemanticTypes: ['RoofPlane', 'Ridge', 'Valley', 'RoofAssembly'],
    fixtures: ['roof-intersecting-gables'],
    demos: ['roof-intersecting'],
    notes: ['intersecting gables are plane groups joined by valleys; the valley lines are where the surfaces meet'],
    knownGaps: ['the analyzer decomposes massing into wings (03Y2G) but still emits one legacy roof per wing'],
  },
  {
    key: 'ROOF_VALLEY',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [ROOF_PLANES, ROOF_LINES],
    exclusions: [],
    emittedSemanticTypes: ['Valley'],
    fixtures: ['roof-intersecting-gables', 'roof-dormer-gable', 'roof-dormer-shed'],
    demos: ['roof-intersecting', 'dormer'],
    notes: ['a valley is validated concave and closure-checked: its two plates must touch along it'],
    knownGaps: [],
  },
  {
    key: 'ROOF_STEP',
    status: 'SUPPORTED',
    recognition: 'NONE',
    evidenceRequirements: [ROOF_PLANES],
    exclusions: [],
    emittedSemanticTypes: ['RoofPlane', 'RoofStep', 'RoofAssembly'],
    fixtures: ['roof-stepped-levels'],
    demos: [],
    notes: ['two planes meeting in plan at different heights; the upper one is named first'],
    knownGaps: ['the step face is closed by the wall the lower roof abuts; a step with no wall is not closed automatically'],
  },
  {
    key: 'ROOF_DORMER',
    status: 'PARTIAL',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [
      req('host-interruption', 'the host roof surface is interrupted', ['ROOF_INTERRUPTION'], 1, true, 2),
      req('vertical-facade', 'a vertical facade rises from the roof', ['VERTICAL_FACADE'], 1, true, 2),
      req('local-roof-edge', 'a local roof edge (a dormer ridge or eave)', ['ROOF_LINE'], 1, true, 1),
      req('opening', 'an opening in the dormer front', ['OPENING'], 1, false, 1),
      req('cross-view', 'the feature seen from two views', ['ROOF_INTERRUPTION', 'VERTICAL_FACADE', 'ROOF_LINE', 'OPENING'], 2, true, 2, true),
    ],
    exclusions: [],
    emittedSemanticTypes: ['DormerAssembly', 'RoofOpening', 'RoofPlane', 'Ridge', 'Valley', 'Eave', 'Verge', 'Wall', 'Window', 'RoofAssembly'],
    fixtures: ['roof-dormer-gable', 'roof-dormer-shed'],
    demos: ['dormer'],
    notes: ['gable, shed and flat dormers compose from primitives; the host is cut exactly where the dormer roof covers it and the dormer planes die into the host along computed valleys', 'an unrecognisable dormer stays an UNKNOWN assembly with DORMER as an alternative'],
    knownGaps: ['the dormer front must be level across the host slope', 'no side overhang (the dormer roof ends flush with its cheeks)', 'one host plane only (no dormer across a hip or valley)', 'hipped and eyebrow dormers are not composed'],
  },
  {
    key: 'PARAPET',
    status: 'SUPPORTED',
    recognition: 'NONE',
    evidenceRequirements: [req('upstand', 'an upstand above a flat roof edge seen in elevation', ['VERTICAL_FACADE'], 1, true)],
    exclusions: [],
    emittedSemanticTypes: ['Parapet'],
    fixtures: ['roof-flat-parapet'],
    demos: [],
    notes: ['parapet runs are wall panels on the roof plane, aligned with the walls below'],
    knownGaps: ['the analyzer still represents a parapet as a fascia band raised above a flat roof'],
  },
  {
    key: 'BALCONY',
    status: 'SUPPORTED',
    recognition: 'ANALYZER_V2',
    evidenceRequirements: [req('platform', 'an elevated platform', ['LEVEL_SURFACE'], 1, true), req('guard', 'a guard along its edge', ['HORIZONTAL_MEMBER', 'VERTICAL_MEMBER'], 1, false)],
    exclusions: [],
    emittedSemanticTypes: ['BalconySlab', 'Guard', 'BalconyAssembly'],
    fixtures: ['exterior-balcony'],
    demos: [],
    notes: ['elevated (top well above the lowest floor, outside the envelope); the validator warns when the elevation or topology contradicts the stated kind'],
    knownGaps: ['the analyzer emits balcony slabs and railings, not yet balcony assemblies'],
  },
  {
    key: 'LOGGIA',
    status: 'PARTIAL',
    recognition: 'NONE',
    evidenceRequirements: [req('recess', 'a floor recessed into the envelope', ['LEVEL_SURFACE'], 1, true)],
    exclusions: [],
    emittedSemanticTypes: ['TerraceSurface', 'BalconySlab', 'LoggiaAssembly'],
    fixtures: ['exterior-loggia'],
    demos: [],
    notes: ['read by topology: inside the plan of a storey that stands over or around it'],
    knownGaps: ['the envelope test is the plan of the wall rings; an upper-floor loggia under a roof overhang but outside every ring reads as a balcony', 'the analyzer detects recesses (03X) but does not yet emit loggia assemblies'],
  },
  {
    key: 'TERRACE',
    status: 'SUPPORTED',
    recognition: 'ANALYZER_V2',
    evidenceRequirements: [req('grade-platform', 'a level platform near grade against a facade', ['LEVEL_SURFACE'], 1, true)],
    exclusions: [],
    emittedSemanticTypes: ['TerraceSurface', 'TerraceAssembly'],
    fixtures: ['exterior-terrace', 'exterior-pergola'],
    demos: [],
    notes: ['at or near grade; the analyzer emits terraces (03Y) but not yet terrace assemblies'],
    knownGaps: [],
  },
  {
    key: 'CANOPY',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [
      req('cover', 'a continuous cover surface over the area', ['COVER_SURFACE'], 1, true, 2),
      req('supports', 'supports or a host facade', ['VERTICAL_MEMBER', 'VERTICAL_FACADE'], 1, false, 1),
      req('beams', 'beams carrying the cover', ['HORIZONTAL_MEMBER'], 1, false, 1),
    ],
    exclusions: ['NO_COVER_OBSERVED'],
    emittedSemanticTypes: ['Column', 'Post', 'Beam', 'RoofPlane', 'CanopyAssembly'],
    fixtures: ['exterior-entrance-canopy', 'exterior-open-canopy'],
    demos: ['porch-columns-beams'],
    notes: ['no roof evidence, no roof: without a cover the members survive and the assembly is ambiguous (UNKNOWN with CANOPY / PERGOLA alternatives)'],
    knownGaps: ['a cantilevered canopy with no supports is representable (host only) but has no fixture'],
  },
  {
    key: 'CARPORT',
    status: 'SUPPORTED',
    recognition: 'NONE',
    evidenceRequirements: [req('cover', 'a continuous cover over a parking bay', ['COVER_SURFACE'], 1, true, 2), req('supports', 'posts', ['VERTICAL_MEMBER'], 1, true)],
    exclusions: ['NO_COVER_OBSERVED'],
    emittedSemanticTypes: ['Post', 'Beam', 'RoofPlane', 'CarportAssembly'],
    fixtures: ['exterior-carport'],
    demos: [],
    notes: ['a canopy for vehicles, attached to the house or freestanding'],
    knownGaps: ['no vehicle-bay semantics beyond a count'],
  },
  {
    key: 'PERGOLA',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [
      req('repeated-supports', 'repeated vertical supports', ['VERTICAL_MEMBER'], 2, true, 2),
      req('repeated-members', 'repeated horizontal members', ['HORIZONTAL_MEMBER'], 3, true, 2),
      req('open-cover', 'the absence of a continuous roof plane, observed', ['NO_COVER_OBSERVED'], 1, true, 2),
    ],
    exclusions: ['COVER_SURFACE'],
    emittedSemanticTypes: ['PergolaPost', 'PergolaBeam', 'PergolaAssembly'],
    fixtures: ['exterior-pergola'],
    demos: ['pergola', 'pergola-ambiguous'],
    notes: ['repeated beams are never turned into a roof plane; a roof COVERING a pergola is refused (PERGOLA_HAS_ROOF)'],
    knownGaps: ['slatted louvre roofs (an adjustable cover) are not distinguished from open pergolas'],
  },
  {
    key: 'COLUMN',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [req('vertical-member', 'a vertical member seen in plan and elevation', ['VERTICAL_MEMBER'], 2, true, 2, true)],
    exclusions: [],
    emittedSemanticTypes: ['Column', 'Post'],
    fixtures: ['exterior-entrance-canopy', 'exterior-carport', 'exterior-open-canopy'],
    demos: ['porch-columns-beams'],
    notes: ['a member\'s role adds meaning, never geometry; orientation is validated (a column stands vertically)'],
    knownGaps: ['rectangular sections only: a round column is its bounding square', 'no structural-engineering claim'],
  },
  {
    key: 'BEAM',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [req('horizontal-member', 'a horizontal member', ['HORIZONTAL_MEMBER'], 1, true, 2)],
    exclusions: [],
    emittedSemanticTypes: ['Beam', 'Lintel', 'PergolaBeam'],
    fixtures: ['exterior-entrance-canopy', 'exterior-carport', 'exterior-open-canopy', 'exterior-pergola'],
    demos: ['porch-columns-beams', 'pergola'],
    notes: ['a beam under a sloping cover touches it along its upper arris; SUPPORTED_BY is closure-checked'],
    knownGaps: ['prismatic members only; a rafter along a slope is stated explicitly, not derived'],
  },
  {
    key: 'EXTERIOR_STEPS',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [
      req('nosings', 'step nosing lines', ['STEP_EDGE'], 1, true, 2),
      req('arrival', 'a second nosing or the landing the steps arrive at', ['STEP_EDGE', 'LEVEL_SURFACE'], 2, true, 1),
      { ...req('datums', 'printed level datums', ['PRINTED_DIMENSION'], 1, false, 1), quantities: ['steps.', 'landing.', 'site.'] },
    ],
    exclusions: [],
    emittedSemanticTypes: ['ExteriorStepRun', 'Step', 'Landing'],
    fixtures: ['exterior-entrance-steps', 'exterior-entrance-canopy'],
    demos: ['entrance-steps'],
    notes: ['exterior steps are their own primitive, never the interior stair system: 1 step, 2–3 steps, a short flight, a raised porch'],
    knownGaps: ['straight runs only (no winding or splayed exterior steps)'],
  },
  {
    key: 'ENTRANCE',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [req('door', 'an entrance door', ['OPENING'], 1, true)],
    exclusions: [],
    emittedSemanticTypes: ['EntranceAssembly'],
    fixtures: ['exterior-entrance-steps', 'exterior-entrance-canopy'],
    demos: ['entrance-steps'],
    notes: ['door, landing, steps, canopy, supports and guards as one assembly'],
    knownGaps: [],
  },
  {
    key: 'HANDRAIL',
    status: 'PARTIAL',
    recognition: 'NONE',
    evidenceRequirements: [req('rail', 'a rail beside steps', ['HORIZONTAL_MEMBER'], 1, true)],
    exclusions: [],
    emittedSemanticTypes: ['Handrail'],
    fixtures: ['exterior-entrance-steps'],
    demos: [],
    notes: ['a railing with role HANDRAIL'],
    knownGaps: ['railings are level: a handrail that follows the slope of a step run is not modelled'],
  },
  {
    key: 'UNKNOWN_ASSEMBLY',
    status: 'SUPPORTED',
    recognition: 'SYNTHETIC_PIPELINE',
    evidenceRequirements: [req('seen', 'geometry seen from two frames, or from one technical drawing', ['UNCLASSIFIED_GEOMETRY', 'ROOF_LINE', 'VERTICAL_FACADE', 'VERTICAL_MEMBER', 'HORIZONTAL_MEMBER', 'COVER_SURFACE', 'LEVEL_SURFACE'], 2, true, 1)],
    exclusions: [],
    emittedSemanticTypes: ['UnknownArchitecturalAssembly'],
    fixtures: ['unknown-feature'],
    demos: ['unknown'],
    notes: ['the safe fallback: extent, observed planes and segments, alternatives, the reason it is unresolved; drawn restrained, only from what was observed'],
    knownGaps: [],
  },
]

export const capability = (key: CapabilityKey): Capability => {
  const c = CAPABILITY_REGISTRY.find((x) => x.key === key)
  if (!c) throw new Error(`no capability ${key}`)
  return c
}
