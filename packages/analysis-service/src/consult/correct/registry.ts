/**
 * v3.54.16 — the correction registry: ONE versioned declaration of what the active consultant may ask the analyzer to
 * change, which drives the prompt, the answer schema, the validator, the dispatch and the record of every proposal.
 *
 * Each operation listed here has an executable consumer (`execute.ts`, over `@buildapp/commands` on the model that
 * stands, or the reconstruction's own roof-feature consumer) and a measure of its effect. A family the analyzer cannot
 * change is NOT offered as an operation: the reviewer may still report it as a defect (`UNSUPPORTED_FAMILIES`), and the
 * record says so with the reason — it never reads as something the system can correct.
 */
export const CORRECTION_REGISTRY_VERSION = '1.0.0' as const

export const PATCH_OPERATIONS = ['ASSIGN_VIEW', 'SET_PARAMETER', 'ADD_OPENING', 'UPDATE_OPENING', 'REMOVE_OPENING', 'ADD_CHIMNEY', 'UPDATE_CHIMNEY', 'SET_FINISH', 'ROOF_FEATURE'] as const
export type PatchOperation = (typeof PATCH_OPERATIONS)[number]

export const OPENING_PATCH_KINDS = ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'] as const
export type OpeningPatchKind = (typeof OPENING_PATCH_KINDS)[number]
export const PARAMETER_PROPERTIES = ['LEVEL_ELEVATION', 'WALL_HEIGHT', 'CHIMNEY_HEIGHT', 'ROOF_PITCH'] as const
export type ParameterProperty = (typeof PARAMETER_PROPERTIES)[number]
export const FINISH_CLASSES = ['LIGHT_RENDER', 'DARK_RENDER', 'TIMBER', 'BRICK'] as const
export type FinishClass = (typeof FINISH_CLASSES)[number]
export const PATCH_UNITS = ['m', 'cm', 'mm', 'deg'] as const

/** What a reviewer may name as a defect but no consumer can change in this stage: recorded UNSUPPORTED_OPERATION. */
export const UNSUPPORTED_FAMILIES = ['ROOF_FORM', 'OUTLINE_REGION', 'BALCONY', 'PERGOLA', 'CANOPY', 'TERRACE', 'INTERIOR', 'OTHER'] as const

export type Capability = {
  op: PatchOperation
  family: 'VIEW' | 'PARAMETER' | 'OPENING' | 'ELEMENT' | 'FINISH' | 'ROOF_FEATURE'
  /** The analyzer's consumer that executes it. */
  consumer: string
  /** What is measured on the new revision before the transaction commits. */
  measure: string
  /** The patch fields it reads. */
  params: readonly string[]
  /** The line of the reviewer's prompt that offers it. */
  prompt: string
}

export const CAPABILITIES: Record<PatchOperation, Capability> = {
  ASSIGN_VIEW: {
    op: 'ASSIGN_VIEW',
    family: 'VIEW',
    consumer: 'correct/bind registerView (the elevation registration the patch binder uses; axis and mirror checked against the side\'s walled span)',
    measure: "the drawn wall ends at one scale against the side's walled length (axis residual), the ground row inside the picture",
    params: ['picture', 'side', 'mirrored', 'wallLeftX', 'wallRightX', 'groundY', 'eavesY'],
    prompt: 'ASSIGN_VIEW — a source elevation shows a model side the analyzer did not register: picture, side, mirrored, wallLeftX/wallRightX (the outer corners of that side\'s walls in the picture), groundY (the ground line) and eavesY (where the walls meet the roof at the sides). Give it the same `group` as the openings you then place through that picture.',
  },
  SET_PARAMETER: {
    op: 'SET_PARAMETER',
    family: 'PARAMETER',
    consumer: 'commands/setProperty on the level, wall, chimney or roof named by targetId, with the dependent level heights and walls restated in the same transaction',
    measure: 'the printed value read again by the analyzer or the independent metric read (a witness that is not this proposal); the compiled scene',
    params: ['property', 'value', 'unit', 'literal', 'sourcePicture', 'box'],
    prompt: 'SET_PARAMETER — a PRINTED value the model contradicts: targetId (a listed level, wall, chimney or roof id), property (LEVEL_ELEVATION, WALL_HEIGHT, CHIMNEY_HEIGHT, ROOF_PITCH), value and unit as printed (m, cm, mm, deg), literal (the print exactly), sourcePicture and box (where it is printed). Never a value you estimated.',
  },
  ADD_OPENING: {
    op: 'ADD_OPENING',
    family: 'OPENING',
    consumer: 'commands/cutOpening + placeWindow|placeDoor on the exterior wall the registration binds the box to',
    measure: "the built opening projected back into the source picture (its box against the proposal's) and the source picture's own edges around it (support against same-size boxes on the same wall band)",
    params: ['picture', 'box', 'kind', 'headLeftY', 'headRightY'],
    prompt: 'ADD_OPENING — an opening the source elevation shows and the model lacks: picture (a SOURCE elevation), box (the opening\'s frame in that picture: x0 < x1, y0 its head, y1 its sill or threshold), kind (WINDOW, DOOR, GLAZED_DOOR, GARAGE_DOOR), and headLeftY/headRightY only when its head is sloped. targetId: the side (FRONT, RIGHT, REAR, LEFT).',
  },
  UPDATE_OPENING: {
    op: 'UPDATE_OPENING',
    family: 'OPENING',
    consumer: 'commands/removeFeature + cutOpening + the same fill, under the SAME id (moved, resized, retyped or re-hosted)',
    measure: "both hypotheses — the model's opening and the proposal — held against the source picture's edges; the proposal is taken only when the source supports it clearly better",
    params: ['picture', 'box', 'kind', 'headLeftY', 'headRightY'],
    prompt: "UPDATE_OPENING — a listed opening (targetId: its id) stands at the wrong place, size, height or kind: picture, box and kind as for ADD_OPENING. Never add a second opening where one is listed.",
  },
  REMOVE_OPENING: {
    op: 'REMOVE_OPENING',
    family: 'OPENING',
    consumer: 'commands/removeFeature (the opening and its fill)',
    measure: "the source picture at the model's opening: removed only when the source shows no opening there",
    params: ['picture'],
    prompt: 'REMOVE_OPENING — a listed opening (targetId) that the source elevation does not show: picture (the elevation that shows that wall).',
  },
  ADD_CHIMNEY: {
    op: 'ADD_CHIMNEY',
    family: 'ELEMENT',
    consumer: 'commands/placeChimney on the ground level, footprint from the registered box(es)',
    measure: 'the built stack projected back into the source picture; its top above the eaves; the source picture\'s edges around it',
    params: ['picture', 'box', 'depthPicture', 'depthBox'],
    prompt: 'ADD_CHIMNEY — a chimney stack above the roof that the model lacks: picture and box (the stack above the roof: x0..x1 its sides, y0 its top, y1 where it meets the roof); depthPicture and depthBox from an elevation at right angles when one shows it. targetId: the side of the first picture.',
  },
  UPDATE_CHIMNEY: {
    op: 'UPDATE_CHIMNEY',
    family: 'ELEMENT',
    consumer: 'commands/removeFeature + placeChimney under the same id',
    measure: 'as ADD_CHIMNEY, the model\'s stack and the proposal held against the source',
    params: ['picture', 'box', 'depthPicture', 'depthBox'],
    prompt: 'UPDATE_CHIMNEY — a listed chimney (targetId) at the wrong place or height: as ADD_CHIMNEY.',
  },
  SET_FINISH: {
    op: 'SET_FINISH',
    family: 'FINISH',
    consumer: 'appearance/applyAppearance (surface regions on the walls the box covers; openings and the obstacles\' own materials kept)',
    measure: "the model's usable geometry unchanged; the regions added on the side's walls",
    params: ['picture', 'box', 'material'],
    prompt: 'SET_FINISH — a finish of a wall area the model gives another colour: picture, box (the area), material (LIGHT_RENDER, DARK_RENDER, TIMBER, BRICK). targetId: the side.',
  },
  ROOF_FEATURE: {
    op: 'ROOF_FEATURE',
    family: 'ROOF_FEATURE',
    consumer: 'reconstruction/roof-feature (gable, shed or flat dormer on a slope of the main roof)',
    measure: 'the feature built; levels, slabs, exterior walls, openings and rooms byte for byte the same',
    params: ['feature'],
    prompt: 'ROOF_FEATURE — a dormer on a slope of the main roof: fill `feature` as described below.',
  },
}

export const isPatchOperation = (op: string): op is PatchOperation => (PATCH_OPERATIONS as readonly string[]).includes(op)

/** The reviewer prompt's list of operations, generated from the registry: what is offered is what is executable. */
export function capabilityPrompt(): string {
  return [
    `Operations you may propose (registry ${CORRECTION_REGISTRY_VERSION}; each is executed by the analyzer on the model that stands and measured against the source before it is kept):`,
    ...PATCH_OPERATIONS.map((op) => `- ${CAPABILITIES[op].prompt}`),
    `Any other difference (${UNSUPPORTED_FAMILIES.join(', ')}) is a defect you report in defects with operation UNSUPPORTED: the analyzer cannot change it in this version, and saying so is the right answer.`,
    'Every coordinate is in the pixels of the picture you name (x to the right, y down); never a size in metres you computed. Independent changes get no group; changes that only make sense together (a view and the openings placed through it, a wall and its openings) share one group string and are kept or undone together.',
  ].join('\n')
}

const REGION = { type: 'object', properties: { x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' } }, required: ['x0', 'y0', 'x1', 'y1'], additionalProperties: false } as const

/** The `patch` of a proposal: the union of every operation's fields, each optional; the validator reads per operation. */
export const PATCH_SCHEMA = {
  type: 'object',
  properties: {
    picture: { type: 'integer' },
    box: REGION,
    kind: { type: 'string', enum: [...OPENING_PATCH_KINDS] },
    headLeftY: { type: 'number' },
    headRightY: { type: 'number' },
    side: { type: 'string', enum: ['FRONT', 'RIGHT', 'REAR', 'LEFT'] },
    mirrored: { type: 'boolean' },
    wallLeftX: { type: 'number' },
    wallRightX: { type: 'number' },
    groundY: { type: 'number' },
    eavesY: { type: 'number' },
    depthPicture: { type: 'integer' },
    depthBox: REGION,
    property: { type: 'string', enum: [...PARAMETER_PROPERTIES] },
    value: { type: 'number' },
    unit: { type: 'string', enum: [...PATCH_UNITS] },
    literal: { type: 'string' },
    sourcePicture: { type: 'integer' },
    material: { type: 'string', enum: [...FINISH_CLASSES] },
  },
  additionalProperties: false,
} as const

export const DEFECT_SEVERITIES = ['KEY', 'MAJOR', 'MINOR'] as const
export type DefectSeverity = (typeof DEFECT_SEVERITIES)[number]
export const DEFECT_SCOPES = ['FRONT', 'RIGHT', 'REAR', 'LEFT', 'ROOF', 'INTERIOR', 'WHOLE'] as const

/** A defect as the reviewer reports it: every difference gets one, whether or not an operation can correct it. */
export const DEFECT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    about: { type: 'string' },
    scope: { type: 'string', enum: [...DEFECT_SCOPES] },
    severity: { type: 'string', enum: [...DEFECT_SEVERITIES] },
    certainty: { type: 'string', enum: ['CERTAIN', 'LIKELY', 'UNSURE'] },
    operation: { type: 'string', enum: [...PATCH_OPERATIONS, 'UNSUPPORTED'] },
    family: { type: 'string', enum: [...UNSUPPORTED_FAMILIES, 'NONE'] },
  },
  required: ['id', 'about', 'scope', 'severity', 'certainty', 'operation'],
  additionalProperties: false,
} as const

export type PatchFields = {
  picture?: number
  box?: { x0: number; y0: number; x1: number; y1: number }
  kind?: OpeningPatchKind
  headLeftY?: number
  headRightY?: number
  side?: 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT'
  mirrored?: boolean
  wallLeftX?: number
  wallRightX?: number
  groundY?: number
  eavesY?: number
  depthPicture?: number
  depthBox?: { x0: number; y0: number; x1: number; y1: number }
  property?: ParameterProperty
  value?: number
  unit?: (typeof PATCH_UNITS)[number]
  literal?: string
  sourcePicture?: number
  material?: FinishClass
}

export type ReviewDefect = { id: string; about: string; scope: (typeof DEFECT_SCOPES)[number]; severity: DefectSeverity; certainty: 'CERTAIN' | 'LIKELY' | 'UNSURE'; operation: PatchOperation | 'UNSUPPORTED'; family?: (typeof UNSUPPORTED_FAMILIES)[number] | 'NONE' }
