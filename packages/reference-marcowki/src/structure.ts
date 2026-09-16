/**
 * What the building is MADE OF, as the researched sources state it.
 *
 * Every other expectation in this package is about dimensions: how wide, how
 * tall, where an opening sits. This one is about COMPOSITION — how many bodies
 * there are, which storeys each of them reaches, what stands over each — and
 * it exists because a reconstruction can get every dimension in the table
 * roughly right and still be a single box, which is not this building and is
 * not any building.
 *
 * It is evaluation. Nothing in the solver may import it, and the architecture
 * tests fail if anything does. The figures come from the facts table so that
 * the two cannot drift apart.
 */
import { fact } from './facts.js'

export type ExpectedMass = {
  id: string
  role: 'MAIN' | 'ATTACHED'
  widthM: number
  depthM: number
  /** Which storeys this body reaches, lowest first: 0 is the entrance floor. */
  storeys: number[]
  roof: 'GABLE' | 'FLAT'
  why: string
}

/**
 * The two bodies, from the ground plan's own chains.
 *
 * The main body is 7.90 wide over 12.60 of walls; the garage is the 4.15 the
 * same chain measures beside it, 7.50 deep, and it stops at the entrance
 * floor — the attic plan covers the house and not the garage. The overall
 * 12.05 is the two together, and it is never a body.
 */
export const EXPECTED_MASSES: readonly ExpectedMass[] = [
  {
    id: 'main body',
    role: 'MAIN',
    widthM: fact('plan.mainBodyWidth'),
    depthM: fact('plan.overallDepth'),
    storeys: [0, 1],
    roof: 'GABLE',
    why: 'the house: the printed 790 of the top chain, over the full 1260 of walls, carrying the attic and the gable above it',
  },
  {
    id: 'garage',
    role: 'ATTACHED',
    widthM: fact('plan.garageWidth'),
    depthM: fact('plan.garageDepth'),
    storeys: [0],
    roof: 'FLAT',
    why: 'the garage: the printed 415 beside the house and 750 deep, one storey, under a roof of its own that the section draws flat at +2.88',
  },
]

/** The figures §22 of the stage brief names, each one printed on a sheet. */
export const EXPECTED_STRUCTURE = {
  /** The two bodies together, across the top chain. Never the width of a mass. */
  overallWidthM: fact('plan.overallWidth'),
  /** Wall face to wall face, front to rear: what the building encloses. */
  walledDepthM: fact('plan.overallDepth'),
  /** The characteristic depth the side elevations show, zones included. */
  characteristicDepthM: 14.6,
  /** The zone the chain prints in front of the front wall, and the one behind the rear wall. */
  frontZoneM: 1.0,
  rearZoneM: 1.0,
  /** The main roof, printed on the section and stated in the publisher's own specification. */
  mainRoofPitchDeg: fact('roof.pitch'),
  mainRoofKind: 'GABLE' as const,
  /** The garage's roof is separate and level, at its own height. */
  garageRoofKind: 'FLAT' as const,
  garageRoofTopM: fact('garage.roofTop'),
  /** The ridge and the level datums the section prints. */
  ridgeM: fact('level.ridge'),
  upperFflM: fact('level.upperFfl'),
  /** The publisher's own printed footprint area, which the lowest storey has to come close to. */
  footprintAreaM2: 131.16,
} as const

/**
 * §13's opening targets.
 *
 * Evaluation numbers, every one of them: a solver that contains them has been
 * told the answer. They say how well the twelve major facade openings must be
 * recovered, not how to recover them.
 */
export const EXPECTED_OPENING_TARGETS = {
  /** Of the twelve major facade openings, how many must be found at all. */
  minimumRecovered: 10,
  /** And how many of those must be on the right facade. */
  minimumOnCorrectFacade: 10,
  /** Median centre error, in metres. */
  medianCentreErrorM: 0.25,
  /** Median width and height error, in metres. */
  medianSizeErrorM: 0.15,
} as const

/**
 * §23's recognizability conditions, as properties of the STRUCTURE rather than
 * of any particular rendering.
 *
 * A picture cannot be asserted about, and comparing pixels to a published
 * render measures the renderer. What can be asserted is that the model has the
 * features that make the building recognisable when it is drawn: two bodies of
 * different heights, two roofs of different kinds, a facade that steps, and
 * openings in plausible places rather than a forest of strips.
 */
export const EXPECTED_RECOGNIZABILITY = {
  /** The main body and the garage must be distinct bodies of different heights. */
  distinctMasses: 2,
  /** Their roofs must differ in kind. */
  distinctRoofKinds: 2,
  /** The garage's top must sit well below the house's eaves. */
  minimumRoofHeightDifferenceM: 1.0,
  /** How many openings a house of this size should have, at least, on its exterior walls. */
  minimumOpenings: 8,
  /** And how many free-standing facade solids are too many to be a building rather than a barcode. */
  maximumLinearSolids: 8,
} as const
