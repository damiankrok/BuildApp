/**
 * The ASSEMBLY REGISTRY and the RELATIONSHIP REGISTRY.
 *
 * An assembly is a first-class composition that references primitives by
 * stable id and owns no geometry (packages/model/src/schema.ts,
 * `AssemblySchema`). This registry says, per kind, what it is for, which
 * components it may reference, and which of them it cannot be complete
 * without — the same rule the validator enforces
 * (`ASSEMBLY_QUALITY_OVERSTATED`), stated here as data a reviewer can read
 * and a test can hold against the validator.
 */
import type { AssemblyKind, RelationshipKind } from '@buildapp/model'

export type AssemblyEntry = {
  kind: AssemblyKind
  /** What the assembly is, in the brief's vocabulary. */
  name: string
  description: string
  /** Component fields it may reference, and what they hold. */
  components: Record<string, string>
  /** What it needs to be COMPLETE; without them it is PARTIAL and says what is missing. */
  completeWhen: string
}

export const ASSEMBLY_REGISTRY: readonly AssemblyEntry[] = [
  {
    kind: 'ROOF',
    name: 'RoofAssembly',
    description: 'A roof composed of planes and the edges between them. Its classification (GABLE, HIP, …) describes the graph; the planes and edges define it.',
    components: { planeIds: 'RoofPlane', edgeIds: 'Ridge / HipEdge / Valley / RoofStep / Verge / Eave / RoofBoundary', openingIds: 'RoofOpening', dormerIds: 'DormerAssembly', chimneyIds: 'chimney', trimIds: 'Fascia / Parapet' },
    completeWhen: 'it has at least one plane (a roof assembly cannot exist without one)',
  },
  {
    kind: 'DORMER',
    name: 'DormerAssembly',
    description: 'A small roof on a front wall and cheeks, standing in a cut in a host roof plane, its planes dying into the host along valleys.',
    components: { hostRoofAssemblyId: 'RoofAssembly', hostPlaneIds: 'RoofPlane', wallIds: 'Wall (front wall and cheek panels)', localRoofAssemblyId: 'RoofAssembly', cutOpeningId: 'RoofOpening (DORMER)', openingIds: 'Opening' },
    completeWhen: 'it has its cut in the host, its local roof and at least one wall',
  },
  {
    kind: 'BALCONY',
    name: 'BalconyAssembly',
    description: 'An elevated exterior platform carried by the building, with its guards and supports.',
    components: { platformId: 'BalconySlab', railingIds: 'Guard / RailingRun', supportIds: 'Column / Post / Wall' },
    completeWhen: 'it has its slab',
  },
  {
    kind: 'TERRACE',
    name: 'TerraceAssembly',
    description: 'An exterior platform at or near grade, against the facade it serves.',
    components: { platformId: 'TerraceSurface / Landing', railingIds: 'Guard', supportIds: 'Wall' },
    completeWhen: 'it has its surface',
  },
  {
    kind: 'LOGGIA',
    name: 'LoggiaAssembly',
    description: 'A recessed exterior space within the building envelope: its floor, the walls it is recessed between, its guards.',
    components: { platformId: 'BalconySlab / TerraceSurface', railingIds: 'Guard', supportIds: 'Wall / Column', recessWallIds: 'Wall' },
    completeWhen: 'it has its floor',
  },
  {
    kind: 'CANOPY',
    name: 'CanopyAssembly',
    description: 'A cover over an exterior area, open on its sides: an entrance canopy, a covered terrace, a shelter. No roof evidence, no roof: a canopy without a cover is partial.',
    components: { supportIds: 'Column / Post / Wall', beamIds: 'Beam', roofAssemblyId: 'RoofAssembly', slabId: 'Slab / platform' },
    completeWhen: 'it has a cover (a roof assembly or a slab) and something that carries it (supports or a host)',
  },
  {
    kind: 'CARPORT',
    name: 'CarportAssembly',
    description: 'A covered, open-sided parking bay: a canopy for vehicles.',
    components: { supportIds: 'Column / Post / Wall', beamIds: 'Beam', roofAssemblyId: 'RoofAssembly', slabId: 'Slab / platform' },
    completeWhen: 'it has a cover and something that carries it',
  },
  {
    kind: 'PERGOLA',
    name: 'PergolaAssembly',
    description: 'An open frame of posts, primary beams and secondary beams. Repeated beams are not a roof: a pergola has no cover, and a roof covering it makes it a canopy (PERGOLA_HAS_ROOF).',
    components: { postIds: 'PergolaPost / Post / Column', primaryBeamIds: 'PergolaBeam / Beam', secondaryBeamIds: 'PergolaBeam / Beam', slabOrTerraceId: 'TerraceSurface / Landing / Slab' },
    completeWhen: 'it has posts (or a host it hangs from) and primary beams',
  },
  {
    kind: 'ENTRANCE',
    name: 'EntranceAssembly',
    description: 'An entrance: its door, the landing in front of it, the exterior steps up to it, a canopy over it, their supports and guards.',
    components: { doorId: 'Door', landingId: 'Landing / TerraceSurface', stepRunIds: 'ExteriorStepRun', canopyId: 'CanopyAssembly', supportIds: 'Column / Post', railingIds: 'Guard / Handrail' },
    completeWhen: 'it has its door',
  },
  {
    kind: 'EXTERIOR_STAIR',
    name: 'ExteriorStairAssembly',
    description: 'Exterior steps and their landings, never the interior stair system.',
    components: { stepRunIds: 'ExteriorStepRun', landingIds: 'Landing', railingIds: 'Handrail / Guard' },
    completeWhen: 'it has at least one step run',
  },
  {
    kind: 'FACADE',
    name: 'FacadeAssembly',
    description: 'One facade of the building: its walls, openings, members and finish regions.',
    components: { wallIds: 'Wall', openingIds: 'Opening', memberIds: 'Column / Beam / Lintel / facade member', regionIds: 'SurfaceRegion' },
    completeWhen: 'it has at least one wall (a facade cannot exist without one)',
  },
  {
    kind: 'GARAGE',
    name: 'GarageAssembly',
    description: 'A garage: its walls, its garage doors and its roof.',
    components: { wallIds: 'Wall', doorIds: 'GarageDoor / Door', roofAssemblyId: 'RoofAssembly', roofIds: 'legacy roof' },
    completeWhen: 'it has walls and a door',
  },
  {
    kind: 'UNKNOWN',
    name: 'UnknownArchitecturalAssembly',
    description: 'Source-supported geometry that cannot be classified reliably: where it is, what was measured, what it might be, and why it is unresolved. Never forced into a known kind, never dropped, never anonymous mesh.',
    components: { hostIds: 'what it is attached to', sourceEvidenceIds: 'evidence sources (model.evidenceSources)' },
    completeWhen: 'never: an unknown assembly is PARTIAL or FRAGMENTARY by definition',
  },
]

export type RelationshipEntry = {
  kind: RelationshipKind
  meaning: string
  /** What the geometry closure audit holds: MEETS (the two touch), OVERLAPS (they may share volume), ORDER (one is above the other), SEMANTIC (no geometric test). */
  geometric: 'MEETS' | 'OVERLAPS' | 'ORDER' | 'SEMANTIC'
  example: string
}

export const RELATIONSHIP_REGISTRY: readonly RelationshipEntry[] = [
  { kind: 'HOSTED_BY', meaning: 'stands on or in its host', geometric: 'MEETS', example: 'dormer-cheek HOSTED_BY roof-plane-south' },
  { kind: 'SUPPORTED_BY', meaning: 'is carried by', geometric: 'MEETS', example: 'beam-1 SUPPORTED_BY post-1' },
  { kind: 'CONNECTED_TO', meaning: 'is joined to', geometric: 'MEETS', example: 'beam-1 CONNECTED_TO beam-2' },
  { kind: 'CONTINUES_TO', meaning: 'continues as', geometric: 'MEETS', example: 'fascia-a CONTINUES_TO fascia-b' },
  { kind: 'TERMINATES_AT', meaning: 'ends against', geometric: 'MEETS', example: 'steps TERMINATES_AT landing' },
  { kind: 'MEETS', meaning: 'touches along a face or an edge', geometric: 'MEETS', example: 'dormer-roof MEETS host plane (along the valley)' },
  { kind: 'INTERSECTS', meaning: 'passes through, on purpose', geometric: 'OVERLAPS', example: 'chimney INTERSECTS roof' },
  { kind: 'OVERLAPS_INTENTIONALLY', meaning: 'shares volume on purpose (a lap, a bearing)', geometric: 'OVERLAPS', example: 'rafter OVERLAPS_INTENTIONALLY wall-plate' },
  { kind: 'COVERS', meaning: 'is above and over', geometric: 'ORDER', example: 'canopy-roof COVERS landing' },
  { kind: 'GUARDS', meaning: 'guards the edge of', geometric: 'SEMANTIC', example: 'railing GUARDS balcony' },
  { kind: 'OPENS_INTO', meaning: 'opens onto', geometric: 'SEMANTIC', example: 'door OPENS_INTO landing' },
  { kind: 'ATTACHED_TO', meaning: 'is fixed to', geometric: 'MEETS', example: 'balcony ATTACHED_TO front wall' },
  { kind: 'ALIGNS_WITH', meaning: 'is aligned with (no contact implied)', geometric: 'SEMANTIC', example: 'parapet ALIGNS_WITH wall below' },
  { kind: 'ABOVE', meaning: 'lies above', geometric: 'ORDER', example: 'upper roof ABOVE lower roof' },
  { kind: 'BELOW', meaning: 'lies below', geometric: 'ORDER', example: 'terrace BELOW pergola' },
]
