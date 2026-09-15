/**
 * Expected metric values for the regression tests, derived from the facts
 * table through the frame transform. Tests measure the compiled geometry with
 * the independent oracles and compare against these; nothing here is read
 * from the model.
 */
import { fact } from './facts.js'
import { q, refPlanToApp, refZRangeToApp } from './transform.js'

const Z = (refZ: number): number => q(refPlanToApp({ x: 0, z: refZ }).z)
const TAN = Math.tan((fact('roof.pitch') * Math.PI) / 180)
const COS = Math.cos((fact('roof.pitch') * Math.PI) / 180)

export type ExpectedOpening = {
  id: string
  wallId: string
  /** The facade the opening is on, in BuildApp terms. */
  facade: 'FRONT' | 'REAR' | 'EAST' | 'WEST' | 'GARAGE_NORTH'
  /** Whether an elevation shows it. */
  exposure: 'EXTERIOR' | 'CONCEALED'
  /** The world plan span along the host's axis (x for front/rear walls, z for side walls). */
  span: [number, number]
  /** The world y range at the near edge and, for a raked head, at the far edge. */
  sill: number
  headNear: number
  headFar: number
  /** The plane of the host wall's outer face (z for front/rear, x for sides). */
  facePlane: number
  /** Which way the wall's outer face looks: +1 towards +axis, −1 towards −axis. */
  outward: 1 | -1
  roomId: string
  thickness: number
  raked: boolean
  fill: 'window' | 'door'
  printed: string | null
}

const T = fact('wall.externalThickness')
const UPPER = fact('level.upperFfl')
const FRONT_WALL_Z = Z(fact('plan.overallDepth')) // 1.00
const REAR_WALL_Z = Z(0) // 13.60
const GARAGE_NORTH_Z = Z(fact('plan.overallDepth') - fact('plan.garageDepth')) // 8.50
const GABLE_FAR = q(3.2 - 2.7 * TAN)
const REAR_GABLE_LOW = q(3.03 - 2.34 * TAN)

/** The twelve major facade openings with their world positions, from the facts and the reference offsets. */
export const EXPECTED_OPENINGS: readonly ExpectedOpening[] = [
  { id: 'og-front-room-window', wallId: 'g-front', facade: 'FRONT', exposure: 'EXTERIOR', span: [1.397, q(1.397 + 1.1)], sill: 0, headNear: 2.3, headFar: 2.3, facePlane: FRONT_WALL_Z, outward: -1, roomId: 'g-room', thickness: T, raked: false, fill: 'window', printed: '110/230' },
  { id: 'og-front-entrance', wallId: 'g-front', facade: 'FRONT', exposure: 'EXTERIOR', span: [4.176, q(4.176 + 1.05)], sill: 0, headNear: 2.1, headFar: 2.1, facePlane: FRONT_WALL_Z, outward: -1, roomId: 'g-entry', thickness: T, raked: false, fill: 'door', printed: '105/210' },
  { id: 'og-east-living-window', wallId: 'g-right', facade: 'EAST', exposure: 'EXTERIOR', span: [q(FRONT_WALL_Z + 8.704), q(FRONT_WALL_Z + 8.704 + 3.0)], sill: 0, headNear: 2.3, headFar: 2.3, facePlane: 7.9, outward: 1, roomId: 'g-salon', thickness: T, raked: false, fill: 'window', printed: '300/230' },
  { id: 'og-east-garage-door', wallId: 'g-right', facade: 'EAST', exposure: 'CONCEALED', span: refZRangeToApp(10.454, 11.384).map(q) as [number, number], sill: 0, headNear: 2.1, headFar: 2.1, facePlane: 7.9, outward: 1, roomId: 'g-boiler', thickness: T, raked: false, fill: 'door', printed: null },
  { id: 'og-rear-living-glazing', wallId: 'g-rear', facade: 'REAR', exposure: 'EXTERIOR', span: [q(7.9 - 0.942 - 4.7), q(7.9 - 0.942)], sill: 0, headNear: 2.3, headFar: 2.3, facePlane: REAR_WALL_Z, outward: 1, roomId: 'g-salon', thickness: T, raked: false, fill: 'window', printed: '470/230' },
  { id: 'og-west-living-window', wallId: 'g-left', facade: 'WEST', exposure: 'EXTERIOR', span: refZRangeToApp(3.653, 4.553).map(q) as [number, number], sill: 0, headNear: 2.3, headFar: 2.3, facePlane: 0, outward: -1, roomId: 'g-salon', thickness: T, raked: false, fill: 'window', printed: '90/230' },
  { id: 'og-west-kitchen-window', wallId: 'g-left', facade: 'WEST', exposure: 'EXTERIOR', span: refZRangeToApp(5.402, 6.802).map(q) as [number, number], sill: 0.9, headNear: 2.3, headFar: 2.3, facePlane: 0, outward: -1, roomId: 'g-kitchen', thickness: T, raked: false, fill: 'window', printed: '140/140' },
  { id: 'og-garage-door', wallId: 'gar-front', facade: 'FRONT', exposure: 'EXTERIOR', span: [q(7.9 + 0.656), q(7.9 + 0.656 + 2.75)], sill: 0, headNear: 2.25, headFar: 2.25, facePlane: FRONT_WALL_Z, outward: -1, roomId: 'g-garage', thickness: T, raked: false, fill: 'door', printed: '275/225' },
  { id: 'og-garage-side-door', wallId: 'gar-rear', facade: 'GARAGE_NORTH', exposure: 'EXTERIOR', span: [q(12.05 - 1.128 - 1.0), q(12.05 - 1.128)], sill: 0, headNear: 2.1, headFar: 2.1, facePlane: GARAGE_NORTH_Z, outward: 1, roomId: 'g-garage', thickness: T, raked: false, fill: 'door', printed: '100/210' },
  { id: 'og-front-gable-glazing', wallId: 'u-front', facade: 'FRONT', exposure: 'EXTERIOR', span: [3.94, q(3.94 + 2.7)], sill: UPPER, headNear: q(UPPER + 3.2), headFar: q(UPPER + GABLE_FAR), facePlane: FRONT_WALL_Z, outward: -1, roomId: 'u-pokoj-s', thickness: T, raked: true, fill: 'window', printed: '270/320' },
  { id: 'og-rear-gable-east', wallId: 'u-rear', facade: 'REAR', exposure: 'EXTERIOR', span: [q(7.9 - 0.97 - 2.34), q(7.9 - 0.97)], sill: UPPER, headNear: q(UPPER + REAR_GABLE_LOW), headFar: q(UPPER + 3.03), facePlane: REAR_WALL_Z, outward: 1, roomId: 'u-pokoj-ne', thickness: T, raked: true, fill: 'window', printed: '234/303' },
  { id: 'og-rear-gable-west', wallId: 'u-rear', facade: 'REAR', exposure: 'EXTERIOR', span: [q(7.9 - 4.62 - 2.34), q(7.9 - 4.62)], sill: UPPER, headNear: q(UPPER + 3.03), headFar: q(UPPER + REAR_GABLE_LOW), facePlane: REAR_WALL_Z, outward: 1, roomId: 'u-pokoj-nw', thickness: T, raked: true, fill: 'window', printed: '234/303' },
]

/** The characteristic dimensions the shell must reproduce, in BuildApp coordinates. */
export const EXPECTED_SHELL = {
  /** Full characteristic extent along z, front outer plane to rear outer plane. */
  characteristicDepth: q(fact('recess.frontOuterPlane') - fact('recess.rearOuterPlane')), // 14.60
  /** The walled envelope, the printed 1260. */
  nominalDepth: fact('plan.overallDepth'), // 12.60
  frontZone: q(fact('recess.frontOuterPlane') - fact('recess.frontBackPlane')), // 1.00
  rearZone: q(fact('recess.rearBackPlane') - fact('recess.rearOuterPlane')), // 1.00
  frontOuterPlaneZ: Z(fact('recess.frontOuterPlane')), // 0
  frontBackPlaneZ: Z(fact('recess.frontBackPlane')), // 1.00
  rearBackPlaneZ: Z(fact('recess.rearBackPlane')), // 13.60
  rearOuterPlaneZ: Z(fact('recess.rearOuterPlane')), // 14.60
  frontRecessX: [fact('recess.frontFromX'), fact('recess.frontToX')] as [number, number],
  rearRecessX: [fact('recess.rearFromX'), fact('recess.rearToX')] as [number, number],
  mainWidth: fact('plan.mainBodyWidth'),
  overallWidth: fact('plan.overallWidth'),
  garageDepth: fact('plan.garageDepth'),
  wallThickness: T,
  returnThickness: fact('wall.returnThickness'),
  groundFfl: fact('level.groundFfl'),
  upperFfl: UPPER,
  ridge: fact('level.ridge'),
  eaveTop: fact('level.eave'),
  eaveUnderside: q(UPPER + fact('wall.kneeWall')), // 4.36
  pitchDeg: fact('roof.pitch'),
  roofBuildUp: fact('roof.buildUp'),
  roofVerticalDrop: fact('roof.buildUp') / COS,
  garageRoofTop: fact('garage.roofTop'),
  garageWallTop: q(fact('garage.roofTop') - fact('garage.roofThickness')),
  slabThickness: fact('slab.upperThickness'),
  balconyTop: fact('balcony.top'),
  balconyThickness: fact('balcony.thickness'),
  balconyFrontVolume: q((7.9 - fact('balcony.frontFromX')) * 1.0 * fact('balcony.thickness')),
  balconyRearVolume: q((fact('recess.rearToX') - fact('recess.rearFromX')) * 1.0 * fact('balcony.thickness')),
  portalHeadVolume: q((fact('recess.frontToX') - 7.9) * 1.0 * fact('portal.headThickness')),
  portalHeadTop: fact('portal.headTop'),
  portalSoffit: q(fact('portal.headTop') - fact('portal.headThickness')),
  railingHeight: fact('railing.height'),
  railingFrontRun: [fact('railing.frontFromX'), fact('railing.frontToX')] as [number, number],
  railingRearRun: [fact('railing.rearFromX'), fact('railing.rearToX')] as [number, number],
  chimneyTop: fact('chimney.top'),
  /** The shaft the stair and its void occupy (BuildApp): the first riser to the east inner face, the kotłownia wall to the arrival. */
  stairShaft: { minX: fact('stair.firstRiserX'), maxX: q(fact('plan.mainBodyWidth') - T), minZ: Z(fact('stair.southBandToZ')), maxZ: Z(fact('stair.topRiserZ')) },
  buildingHeightAboveTerrain: fact('building.height'),
  terrain: fact('level.terrain'),
  plinth: fact('terrace.plinth'),
} as const

// ---------------------------------------------------------------------------
// STAGE BUILDAPP-01A: the stair, its void, the finish regions, the assemblies, the cut mode, the recess floors
// ---------------------------------------------------------------------------

const SIN = Math.sin((fact('roof.pitch') * Math.PI) / 180)

/** The stair as the plans draw it, in BuildApp coordinates. */
export const EXPECTED_STAIR = {
  /** Left end of the first riser line facing +x. */
  start: { x: fact('stair.firstRiserX'), z: Z(fact('stair.southBandFromZ')) }, // (5.37, 5.82)
  direction: 'PLUS_X' as const,
  width: fact('stair.width'),
  lowerRisers: fact('stair.lowerRisers'),
  lowerGoing: fact('stair.lowerGoing'),
  winders: fact('stair.winderRisers'),
  turn: 'LEFT' as const,
  upperRisers: fact('stair.upperRisers'),
  upperGoing: fact('stair.upperGoing'),
  risers: fact('stair.risers'),
  riserHeight: fact('stair.riserHeight'),
  rise: q(UPPER - fact('level.groundFfl')),
  waist: fact('stair.waist'),
  cornerX: fact('stair.cornerX'),
  /** The southern band across z, the eastern band across x. */
  southBand: [Z(fact('stair.southBandToZ')), Z(fact('stair.southBandFromZ'))] as [number, number], // 4.83..5.82
  eastBand: [fact('stair.cornerX'), q(fact('plan.mainBodyWidth') - T)] as [number, number], // 6.46..7.45
  arrivalZ: Z(fact('stair.topRiserZ')), // 7.94
  extent: { minX: fact('stair.firstRiserX'), maxX: q(fact('plan.mainBodyWidth') - T), minZ: Z(fact('stair.southBandToZ')), maxZ: Z(fact('stair.topRiserZ')) },
} as const

/** The L-shaped void in the upper slab: the southern band, then the eastern band north to the arrival; it touches the east inner face. */
export const EXPECTED_STAIR_VOID: readonly { x: number; z: number }[] = [
  { x: EXPECTED_STAIR.extent.minX, z: EXPECTED_STAIR.southBand[0] },
  { x: EXPECTED_STAIR.extent.maxX, z: EXPECTED_STAIR.southBand[0] },
  { x: EXPECTED_STAIR.extent.maxX, z: EXPECTED_STAIR.arrivalZ },
  { x: EXPECTED_STAIR.cornerX, z: EXPECTED_STAIR.arrivalZ },
  { x: EXPECTED_STAIR.cornerX, z: EXPECTED_STAIR.southBand[1] },
  { x: EXPECTED_STAIR.extent.minX, z: EXPECTED_STAIR.southBand[1] },
]
export const EXPECTED_STAIR_VOID_AREA = q((EXPECTED_STAIR.extent.maxX - EXPECTED_STAIR.extent.minX) * EXPECTED_STAIR.width + EXPECTED_STAIR.width * (EXPECTED_STAIR.arrivalZ - EXPECTED_STAIR.southBand[1])) // 4.158

export type ExpectedRegion = {
  id: string
  hostId: string
  facade: 'FRONT' | 'REAR' | 'EAST' | 'WEST'
  /** The host's outer face plane (z for front/rear, x for the sides) and which way it looks. */
  facePlane: number
  outward: 1 | -1
  /** World span along the host's axis (x for front/rear, z for the sides). */
  across: [number, number]
  /** World y range; `upToRoof` when the band runs to the roof soffit. */
  up: [number, number]
  upToRoof: boolean
  materialId: string
  /** Openings the band is clipped around. */
  openings: string[]
}

/** The finish regions the elevations show, in world coordinates. */
export const EXPECTED_REGIONS: readonly ExpectedRegion[] = [
  { id: 'sr-front-timber-ground', hostId: 'g-front', facade: 'FRONT', facePlane: FRONT_WALL_Z, outward: -1, across: [fact('band.frontTimberFromX'), fact('band.frontTimberToX')], up: [0, UPPER], upToRoof: false, materialId: 'mat-timber-clad', openings: ['og-front-room-window'] },
  { id: 'sr-front-timber-gable', hostId: 'u-front', facade: 'FRONT', facePlane: FRONT_WALL_Z, outward: -1, across: [fact('band.frontTimberFromX'), fact('band.frontGableTimberToX')], up: [UPPER, 0], upToRoof: true, materialId: 'mat-timber-clad', openings: ['og-front-gable-glazing'] },
  { id: 'sr-rear-timber-west', hostId: 'g-rear', facade: 'REAR', facePlane: REAR_WALL_Z, outward: 1, across: [fact('recess.rearFromX'), fact('band.rearTimberWestToX')], up: [0, fact('band.rearTimberTop')], upToRoof: false, materialId: 'mat-timber-clad', openings: [] },
  { id: 'sr-rear-timber-east', hostId: 'g-rear', facade: 'REAR', facePlane: REAR_WALL_Z, outward: 1, across: [fact('band.rearTimberEastFromX'), fact('recess.rearToX')], up: [0, fact('band.rearTimberTop')], upToRoof: false, materialId: 'mat-timber-clad', openings: [] },
  { id: 'sr-west-dark', hostId: 'g-left', facade: 'WEST', facePlane: 0, outward: -1, across: refZRangeToApp(fact('band.westDarkFromZ'), fact('band.westDarkToZ')).map(q) as [number, number], up: [0, fact('band.westDarkTop')], upToRoof: false, materialId: 'mat-render-dark', openings: ['og-west-kitchen-window'] },
  { id: 'sr-east-dark', hostId: 'g-right', facade: 'EAST', facePlane: 7.9, outward: 1, across: [GARAGE_NORTH_Z, q(FRONT_WALL_Z + 8.704)], up: [0, fact('band.eastDarkTop')], upToRoof: false, materialId: 'mat-render-dark', openings: [] },
]

/** The door assemblies: which panels fill each facade door, from the near jamb. */
export const EXPECTED_ASSEMBLIES: Record<string, { panels: Array<'LEAF' | 'GLAZED' | 'PANEL'>; leafFraction: number | null; mullion: number | null; glazedLeaf: boolean }> = {
  'og-front-entrance-leaf': { panels: ['LEAF', 'GLAZED'], leafFraction: fact('door.entranceLeafFraction'), mullion: fact('door.entranceMullion'), glazedLeaf: false },
  'og-garage-door-leaf': { panels: ['PANEL'], leafFraction: null, mullion: null, glazedLeaf: false },
  'og-garage-side-door-leaf': { panels: ['LEAF'], leafFraction: 1, mullion: null, glazedLeaf: true },
  'og-east-garage-door-leaf': { panels: [], leafFraction: 1, mullion: null, glazedLeaf: false },
}

/** The rooflight cut: normal to the roof, so the underside outline sits `thickness · sin(pitch)` uphill of the top one. */
export const EXPECTED_ROOFLIGHT_CUT = {
  mode: 'NORMAL_TO_ROOF' as const,
  /** Not rounded: this is the physical prediction the compiled geometry is measured against. */
  undersideShift: fact('roof.buildUp') * SIN,
  revealPitchDeg: q(90 - fact('roof.pitch')),
}

/** The recess floors: the loggia and the portal stand on a plinth to the terrain datum. */
export const EXPECTED_TERRACES = {
  'terrace-rear-loggia': { minX: fact('recess.rearFromX'), maxX: fact('recess.rearToX'), minZ: REAR_WALL_Z, maxZ: Z(fact('recess.rearOuterPlane')), top: fact('level.groundFfl'), bottom: fact('level.terrain') },
  'terrace-front-portal': { minX: fact('recess.frontFromX'), maxX: fact('recess.frontToX'), minZ: Z(fact('recess.frontOuterPlane')), maxZ: FRONT_WALL_Z, top: fact('level.groundFfl'), bottom: fact('level.terrain') },
} as const

/** Expected room → level map, and the room each rooflight lies over. */
export const EXPECTED_ROOMS: Record<string, 'ground' | 'upper'> = {
  'g-salon': 'ground', 'g-kitchen': 'ground', 'g-hall': 'ground', 'g-pantry': 'ground', 'g-bathroom': 'ground', 'g-room': 'ground', 'g-entry': 'ground', 'g-boiler': 'ground', 'g-garage': 'ground',
  'u-pokoj-nw': 'upper', 'u-pokoj-ne': 'upper', 'u-garderoba-ne': 'upper', 'u-pralnia': 'upper', 'u-bathroom': 'upper', 'u-garderoba-sw': 'upper', 'u-pokoj-s': 'upper', 'u-corridor': 'upper', 'u-stairs': 'upper',
}
export const EXPECTED_ROOFLIGHT_ROOMS: Record<string, string> = { 'rl-pralnia-w': 'u-pralnia', 'rl-lazienka-w': 'u-bathroom', 'rl-schody-e': 'u-stairs' }
/** Interior doors and the two rooms each connects. */
export const EXPECTED_INTERIOR_DOORS: Record<string, [string, string]> = {
  'gd-bathroom': ['g-bathroom', 'g-hall'], 'gd-room': ['g-room', 'g-hall'], 'gd-entry': ['g-entry', 'g-hall'], 'gd-boiler': ['g-boiler', 'g-entry'], 'gd-pantry': ['g-pantry', 'g-hall'],
  'ud-pokoj-nw': ['u-pokoj-nw', 'u-corridor'], 'ud-pralnia': ['u-pralnia', 'u-corridor'], 'ud-bathroom': ['u-bathroom', 'u-corridor'], 'ud-pokoj-ne': ['u-pokoj-ne', 'u-corridor'], 'ud-pokoj-s': ['u-corridor', 'u-pokoj-s'], 'ud-garderoba-sw': ['u-garderoba-sw', 'u-pokoj-s'],
}
