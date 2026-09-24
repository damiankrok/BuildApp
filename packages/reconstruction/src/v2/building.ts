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

export type BalconyV2 = { id: string; kind: 'BALCONY' | 'TERRACE'; storeyIndex: number; x0: number; z0: number; x1: number; z1: number; topY: number; thicknessM: number; fascia?: FacadeMember; featureId: string; provenance: ProvenanceStatus; why: string }
export type RailingV2 = { id: string; storeyIndex: number; start: { x: number; z: number }; end: { x: number; z: number }; baseY: number; heightM: number; featureId: string; provenance: ProvenanceStatus; why: string }
export type ReturnWallV2 = { id: string; side: 'FRONT' | 'REAR' | 'WEST' | 'EAST'; storeyIndex: number; start: { x: number; z: number }; end: { x: number; z: number }; thicknessM: number; recessId: string; featureId: string; provenance: ProvenanceStatus; why: string }
export type PortalHeadV2 = { id: string; massId: string; x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; featureId: string; provenance: ProvenanceStatus; why: string }
export type VergeV2 = { id: string; side: 'FRONT' | 'REAR'; planeAt: number; member: FacadeMember; depthM: number; featureId: string; provenance: ProvenanceStatus }
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
