/**
 * The narrow visual tasks, and the JSON Schema each one hands to a provider.
 *
 * Two things are enforced here rather than hoped for.
 *
 * **A task restricts the vocabulary.** A facade decomposition may not return a
 * ROOM_AREA and a plan interpretation may not return a RIDGE. That is not
 * tidiness: an answer in the wrong vocabulary is a provider that has
 * misunderstood which drawing it is looking at, and it is better to reject it
 * than to store it.
 *
 * **The JSON Schema is GENERATED from the Zod enums**, never written beside
 * them. Adding a semantic hint to the observation vocabulary changes what a
 * provider is allowed to say in the same commit, with no chance of the two
 * drifting apart.
 */
import { DepthLayerSchema, ObservationKindSchema, RelationKindSchema, SemanticHintSchema } from '@buildapp/source-observations'
import type { ObservationKind, RelationKind } from '@buildapp/source-observations'
import type { VisionTask } from './schema.js'

export type TaskDefinition = {
  task: VisionTask
  /** Which document roles this task is meant for. Running it on anything else is a caller error. */
  documents: readonly string[]
  /** The only observation kinds an answer may use. */
  kinds: readonly ObservationKind[]
  /** The only relation kinds an answer may use. All are within-view: one call sees one picture. */
  relations: readonly RelationKind[]
  /** What the provider is asked to find, in the order it should work through. */
  instructions: readonly string[]
}

/** Relations a provider may assert from a single image. Identity across views is not one of them. */
const WITHIN_VIEW_RELATIONS: readonly RelationKind[] = ['PROUD_OF', 'RECESSED_BEHIND', 'COPLANAR_WITH', 'OCCLUDES', 'INSIDE_RECESS', 'SPANS_BETWEEN', 'CONTINUES_ACROSS', 'ALIGNS_WITH', 'SUPPORTS', 'CONTAINS', 'ABOVE', 'BELOW', 'LEFT_OF', 'RIGHT_OF']

export const FACADE_DECOMPOSITION: TaskDefinition = {
  task: 'FACADE_DECOMPOSITION',
  documents: ['ELEVATION', 'PERSPECTIVE_RENDER'],
  kinds: ['SILHOUETTE', 'PROFILE', 'MASS_REGION', 'WALL_REGION', 'ROOF_REGION', 'ROOF_EDGE', 'RIDGE', 'EAVE', 'OPENING', 'WINDOW', 'DOOR', 'BALCONY', 'LOGGIA', 'RAILING', 'CHIMNEY', 'SURFACE_REGION', 'LINEAR_VOLUME_CANDIDATE', 'LINE', 'POLYLINE', 'POLYGON', 'RECTANGLE', 'PARALLEL_LINE_FAMILY'],
  relations: WITHIN_VIEW_RELATIONS,
  instructions: [
    'Trace the outer silhouette of the building as a POLYGON, excluding sky, ground, planting, cars and people.',
    'Mark the roof: its visible regions, its edges, and the ridge and eave lines you can actually see. Do not guess a pitch.',
    'Mark every opening — window, door, garage door, rooflight — as a RECT or POLYGON around the opening itself, not around its surround.',
    'Mark balconies and loggias: the slab or floor, the railing, and SEPARATELY each side wall or return that closes the recess at its ends. A recess with no side returns marked is an incomplete reading, so if you can see a return, record it.',
    'Find LINEAR_VOLUME_CANDIDATE members: long, straight, THICK elements that read as solid three-dimensional bodies rather than as painted bands — a frame, a beam, a portal, a fin, a deep reveal, a parapet upstand. The test is depth, not colour: a member qualifies if it shows its own thickness through a shadow it casts, a visible side or soffit face, an end face where it stops, a break in a line passing behind it, or an offset from the wall behind it. Say which of those cues you saw in `evidence`. If the only cue is that the area is a different colour, it is a SURFACE_REGION and not a LINEAR_VOLUME_CANDIDATE.',
    'Where such a member runs on past a corner, a setback or another element, record a CONTINUES_ACROSS relation so its full extent is recoverable.',
    'Record what stands in front of what: PROUD_OF, RECESSED_BEHIND, COPLANAR_WITH, OCCLUDES, INSIDE_RECESS. State the cue in `why`.',
    'Set `depthLayer` on anything whose relation to the main wall plane you can see.',
  ],
}

export const PLAN_INTERPRETATION: TaskDefinition = {
  task: 'PLAN_INTERPRETATION',
  documents: ['FLOOR_PLAN'],
  kinds: ['WALL_AXIS', 'WALL_BAND', 'OPENING_INTERVAL', 'OPENING', 'WINDOW', 'DOOR', 'ROOM_LABEL', 'ROOM_AREA', 'STAIR', 'STAIR_SYMBOL', 'PRINTED_DIMENSION', 'SCALE_ANCHOR', 'POLYGON', 'RECTANGLE', 'LINE', 'POLYLINE', 'PARALLEL_LINE_FAMILY', 'POINT'],
  relations: WITHIN_VIEW_RELATIONS,
  instructions: [
    'Mark the wall bands: the filled or hatched strips that are the walls themselves, as RECT or POLYGON. Mark the load-bearing outer band and the thinner partitions alike.',
    'Mark openings in walls as OPENING_INTERVAL along the wall band they interrupt.',
    'Read room labels and printed areas where they are legible, as ROOM_LABEL and ROOM_AREA with the text in `value`.',
    'Mark dimension chains as PARALLEL_LINE_FAMILY or PRINTED_DIMENSION, and put the printed number in `value` when you can read it. Do not convert anything to metres yourself.',
    'The stair: mark the STAIR_SYMBOL outline, then, SEPARATELY, the individual tread lines as a LINE_FAMILY, the direction arrow or UP/DOWN mark as a SEGMENT pointing the way of ascent, the walking-line polyline, and any winder or landing region as its own POLYGON. Count the tread lines you can actually distinguish and put that count in `value`. If the treads fan rather than run parallel, say so in `evidence` and mark the fanning region. Never report a stair as a plain rectangle of the shaft: the shape of the flights, where they turn, and which way they climb are the whole point.',
    'Do not infer anything from the size of a shaft. Report only lines you can see.',
  ],
}

export const SECTION_INTERPRETATION: TaskDefinition = {
  task: 'SECTION_INTERPRETATION',
  documents: ['SECTION'],
  kinds: ['LEVEL_DATUM', 'PRINTED_DIMENSION', 'ANGLE', 'RIDGE', 'EAVE', 'ROOF_EDGE', 'ROOF_REGION', 'WALL_REGION', 'STAIR', 'STAIR_SYMBOL', 'LINE', 'POLYLINE', 'POLYGON', 'RECTANGLE', 'PARALLEL_LINE_FAMILY', 'POINT', 'SCALE_ANCHOR'],
  relations: WITHIN_VIEW_RELATIONS,
  instructions: [
    'Mark every level datum line with its printed value in `value`, as read, without converting it.',
    'Mark the ridge point, the eave lines and each roof pitch line as SEGMENTs.',
    'Mark slab and floor lines as SEGMENTs, and the wall regions the section cuts through as POLYGONs.',
    'Where the section cuts the stair, mark the rise-and-going staircase as a POLYLINE following the steps.',
    'Mark printed angles as ANGLE with the printed number in `value`.',
  ],
}

export const TASKS: readonly TaskDefinition[] = [FACADE_DECOMPOSITION, PLAN_INTERPRETATION, SECTION_INTERPRETATION]

export const taskDefinition = (task: VisionTask): TaskDefinition => {
  const found = TASKS.find((t) => t.task === task)
  if (!found) throw new Error(`unknown vision task ${task}`)
  return found
}

/** The tasks that apply to a document role, in the order they should be run. */
export const tasksForDocument = (document: string): TaskDefinition[] => TASKS.filter((t) => t.documents.includes(document))

// ---------------------------------------------------------------------------
// The JSON Schema handed to a provider
// ---------------------------------------------------------------------------

type JsonSchema = Record<string, unknown>

const geometrySchema = (): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  required: ['type', 'points'],
  properties: {
    type: { type: 'string', enum: ['POINT', 'SEGMENT', 'POLYLINE', 'POLYGON', 'RECT', 'LINE_FAMILY'], description: 'POINT: 1 point. SEGMENT: 2. POLYLINE: 2 or more. POLYGON: 3 or more, not closed (do not repeat the first point). RECT: exactly 2 opposite corners. LINE_FAMILY: an even number, consecutive pairs being the endpoints of each line.' },
    points: {
      type: 'array',
      minItems: 1,
      maxItems: 512,
      description: 'Points as [x, y] with x and y between 0 and 1, measured from the TOP-LEFT of the image: x to the right, y DOWNWARD.',
      items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0, maximum: 1 } },
    },
  },
})

/**
 * The response schema for one task, with the vocabulary narrowed to what that
 * task may answer in. Built from the Zod enums so it cannot fall out of step
 * with what the graph will accept.
 */
export function visionResponseJsonSchema(task: VisionTask): JsonSchema {
  const def = taskDefinition(task)
  const allKinds = new Set<string>(ObservationKindSchema.options)
  for (const k of def.kinds) if (!allKinds.has(k)) throw new Error(`task ${task} lists unknown observation kind ${k}`)
  const allRelations = new Set<string>(RelationKindSchema.options)
  for (const r of def.relations) if (!allRelations.has(r)) throw new Error(`task ${task} lists unknown relation kind ${r}`)

  return {
    type: 'object',
    additionalProperties: false,
    required: ['task', 'assetByteHash', 'observations', 'relations'],
    properties: {
      task: { type: 'string', enum: [task] },
      assetByteHash: { type: 'string', description: 'Echo the assetByteHash you were given, exactly.' },
      observations: {
        type: 'array',
        maxItems: 256,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'semanticHints', 'geometry', 'confidence', 'positionUncertaintyNorm', 'evidence'],
          properties: {
            kind: { type: 'string', enum: [...def.kinds] },
            semanticHints: { type: 'array', maxItems: 8, items: { type: 'string', enum: [...SemanticHintSchema.options] } },
            geometry: geometrySchema(),
            depthLayer: { type: 'string', enum: [...DepthLayerSchema.options], description: 'Where this sits relative to the main wall plane, if you can see it.' },
            confidence: { type: 'number', minimum: 0, maximum: 1, description: 'How sure you are that this feature EXISTS.' },
            positionUncertaintyNorm: { type: 'number', minimum: 0, maximum: 0.5, description: 'How far your coordinates might be wrong, as a fraction of the image width. This is a separate question from confidence: you may be certain a beam is there and unsure exactly where its edge falls. Never 0.' },
            angleUncertaintyDeg: { type: 'number', minimum: 0, maximum: 180, description: 'Angular tolerance, for anything with a direction.' },
            evidence: { type: 'string', maxLength: 600, description: 'One sentence naming the visual cue you used. A reader must be able to look at the image and check it.' },
            value: {
              type: 'object',
              additionalProperties: false,
              required: ['unit'],
              properties: { unit: { type: 'string', enum: ['px', 'deg', 'count', 'ratio', 'text'] }, number: { type: 'number' }, text: { type: 'string' } },
              description: 'A measured value in the unit given. Use `text` for a label read off the drawing and `count` for a number of things you counted. Never metres.',
            },
            alternatives: {
              type: 'array',
              maxItems: 4,
              description: 'Other readings that would also fit. Record ambiguity here rather than picking one and discarding the rest.',
              items: { type: 'object', additionalProperties: false, required: ['why', 'confidence'], properties: { why: { type: 'string', maxLength: 400 }, confidence: { type: 'number', minimum: 0, maximum: 1 }, geometry: geometrySchema(), count: { type: 'integer', minimum: 0 } } },
            },
          },
        },
      },
      relations: {
        type: 'array',
        maxItems: 512,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'from', 'to', 'confidence', 'why'],
          properties: {
            kind: { type: 'string', enum: [...def.relations] },
            from: { type: 'integer', minimum: 0, description: 'Index into your own observations array.' },
            to: { type: 'integer', minimum: 0, description: 'Index into your own observations array.' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            why: { type: 'string', maxLength: 400, description: 'The visual cue for this relation.' },
          },
        },
      },
      notFound: { type: 'array', maxItems: 32, items: { type: 'string', maxLength: 300 }, description: 'Things this task asked for that you looked for and could not see.' },
      notes: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 600 } },
    },
  }
}
