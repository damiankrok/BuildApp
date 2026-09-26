/**
 * BuildingV2 — what the v2 passes solved, before it is written as commands.
 *
 * Everything in the v2 world frame (MODEL_FRAME: front outer plane z = 0).
 * The emitter turns this into a DSL program and records which solved feature
 * each command came from; nothing here is geometry yet.
 */
import type { RecessTopology } from './recesses.js'
import type { InteriorReading } from './interior.js'
import type { StairTopologyHypothesis } from './stair-topology.js'
import type { OpeningV2 } from './openings-v2.js'
import type { AttachedRoofReading, ChimneyReading, RooflightReading } from './roof-details.js'
import type { FacadeMember, FacadeAssemblyHypothesis } from './facade.js'
import type { ProvenanceStatus } from './graph.js'

export type LevelV2 = { index: number; id: string; elevation: number; height: number; wallTop: number; featureId: string }

export type MassV2 = {
  id: string
  role: 'MAIN' | 'ATTACHED'
  x0: number
  z0: number
  x1: number
  z1: number
  storeys: number[]
  featureId: string
  /** The 03R mass id this came from. */
  sourceMassId: string
}

export type MainRoofV2 = {
  massId: string
  kind: 'GABLE'
  pitchDeg: number
  ridgeAxis: 'X' | 'Z'
  ridgeAt: number
  eaveY: number
  ridgeY: number
  /** The footprint the roof covers, zones included when the side views show it. */
  footprint: { x0: number; z0: number; x1: number; z1: number }
  coversZones: boolean
  coversZonesWhy: string
  buildUpVerticalM: number
  thicknessM: number
  authority: string
  featureId: string
  provenance: ProvenanceStatus
}

export type AttachedRoofV2 = {
  massId: string
  reading?: AttachedRoofReading
  slabTopY: number
  slabSoffitY: number
  parapetTopY?: number
  footprint: { x0: number; z0: number; x1: number; z1: number }
  /** True when the roof projects over the zone in front of the body (a portal head). */
  projectsOverZone: boolean
  featureId: string
  provenance: ProvenanceStatus
}

/**
 * How one end of a slab or member terminates: FREE (a drop, guarded if the
 * slab is), WALL (against a wall face that stands beside it), CARRIES (the
 * slab runs under a wall standing on it), MEETS (end to end with the next
 * member of its assembly).
 */
export type EndCondition = {
  kind: 'FREE' | 'WALL' | 'CARRIES' | 'MEETS'
  at: number
  againstId?: string
  why: string
  /** The balustrade along the slab turns here, back to the wall: a free end at which the plan draws it turning. */
  turns?: boolean
}

export type BalconyV2 = {
  id: string
  kind: 'BALCONY' | 'TERRACE'
  storeyIndex: number
  x0: number
  z0: number
  x1: number
  z1: number
  topY: number
  thicknessM: number
  fascia?: FacadeMember
  /** The two ends along the facade, low then high, after the assembly closure. */
  ends?: [EndCondition, EndCondition]
  /** The facade whose zone the slab stands in. */
  side?: 'FRONT' | 'REAR' | 'WEST' | 'EAST'
  featureId: string
  provenance: ProvenanceStatus
  why: string
}
export type RailingV2 = {
  id: string
  storeyIndex: number
  start: { x: number; z: number }
  end: { x: number; z: number }
  /** A railing that turns: its plan polyline from start to end, one post per vertex. */
  path?: Array<{ x: number; z: number }>
  /** The slab it guards. */
  hostId?: string
  baseY: number
  heightM: number
  featureId: string
  provenance: ProvenanceStatus
  why: string
}
export type ReturnWallV2 = {
  id: string
  side: 'FRONT' | 'REAR' | 'WEST' | 'EAST'
  storeyIndex: number
  start: { x: number; z: number }
  end: { x: number; z: number }
  thicknessM: number
  /** The interval along the facade the return's material occupies. */
  alongInterval: [number, number]
  recessId: string
  featureId: string
  provenance: ProvenanceStatus
  why: string
}
export type PortalHeadV2 = { id: string; massId: string; x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; continuesFromId?: string; featureId: string; provenance: ProvenanceStatus; why: string }
export type VergeV2 = { id: string; side: 'FRONT' | 'REAR'; planeAt: number; member: FacadeMember; depthM: number; depthProvenance?: ProvenanceStatus; depthWhy?: string; featureId: string; provenance: ProvenanceStatus }

/**
 * A terrace: an exterior floor at the ground storey, first-class rather than
 * a balcony of kind TERRACE. Its polygon is the recess floor it continues,
 * plus the outlined platform beyond the mouth where the plan draws one.
 */
export type TerraceV2 = {
  id: string
  storeyIndex: number
  side: 'FRONT' | 'REAR' | 'WEST' | 'EAST'
  polygon: Array<{ x: number; z: number }>
  topY: number
  thicknessM: number
  surface: 'PAVED' | 'DECK' | 'UNKNOWN'
  edge: 'PLINTH' | 'FLUSH'
  /** The masses whose facade the terrace lies against. */
  massIds: string[]
  /** The platform beyond the mouth, when the plan outlines one. */
  extension?: { from: number; to: number; reach: number; frameId: string; why: string }
  featureId: string
  provenance: ProvenanceStatus
  why: string
}

/** A broad tone read for one body's walls on the registered renders. */
export type MassToneV2 = { massId: string; tone: string; share: number; views: number; why: string }

/** A broad tone read for one return's outer face: the frame's finish where it stands in the outer plane. */
export type ReturnToneV2 = { returnId: string; side: 'FRONT' | 'REAR' | 'WEST' | 'EAST'; storeyIndex: number; tone: string; share: number; why: string }

/**
 * The facade composition as a graph: every member that makes up a frame, a
 * portal or a balcony assembly, and how each meets the next. Built after the
 * assembly closure, from the positions the model will carry.
 */
export type FacadeGraphNode = {
  id: string
  kind: 'RETURN' | 'VERGE' | 'BALCONY_SLAB' | 'PORTAL_HEAD' | 'RAILING' | 'TERRACE'
  featureId: string
  hostId?: string
  facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }
  depthM?: number
  termination: { start: EndCondition['kind'] | 'TURNS'; end: EndCondition['kind'] | 'TURNS' }
}
export type FacadeGraphEdge = { from: string; to: string; kind: 'CONTINUES_TO' | 'TERMINATES_AT' | 'TURNS_AT' | 'MEETS_HOST'; gapM: number; why: string }
export type FacadeGraph = { nodes: FacadeGraphNode[]; edges: FacadeGraphEdge[] }
export type SurfaceRegionV2 = { id: string; wallRef: { massId: string; storeyIndex: number; side: 'FRONT' | 'REAR' | 'WEST' | 'EAST' }; along: [number, number]; y: [number, number]; tone: string; featureId: string }

export type BuildingV2 = {
  label: string
  wallThicknessM: number
  slabThicknessM: number
  levels: LevelV2[]
  masses: MassV2[]
  mainRoof?: MainRoofV2
  attachedRoofs: AttachedRoofV2[]
  recesses: RecessTopology[]
  returns: ReturnWallV2[]
  balconies: BalconyV2[]
  railings: RailingV2[]
  portalHeads: PortalHeadV2[]
  verges: VergeV2[]
  terraces: TerraceV2[]
  massTones: MassToneV2[]
  returnTones: ReturnToneV2[]
  facadeGraph: FacadeGraph
  chimneys: Array<ChimneyReading & { featureId: string; provenance: ProvenanceStatus }>
  rooflights: Array<RooflightReading & { featureId: string; provenance: ProvenanceStatus; widthM: number; lengthM: number }>
  openings: OpeningV2[]
  /** Openings that pass through two coincident walls of two bodies. */
  sharedDoors: Array<OpeningV2 & { otherMassId: string }>
  interior: InteriorReading[]
  stair?: { hypothesis: StairTopologyHypothesis; emit: 'FLIGHTS' | 'PLACEHOLDER'; fromLevel: number; toLevel: number; slabHole: { x0: number; z0: number; x1: number; z1: number }; featureId: string; provenance: ProvenanceStatus }
  assemblies: FacadeAssemblyHypothesis[]
  surfaceRegions: SurfaceRegionV2[]
  terrainY?: number
}
