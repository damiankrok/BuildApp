/**
 * v3.54.16 — the correction registry: ONE versioned declaration of what the active consultant may ask the analyzer to
 * change, which drives the prompt, the answer schema, the validator, the dispatch and the record of every proposal.
 *
 * Each operation listed here has an executable consumer (`execute.ts`, over `@buildapp/commands` on the model that
 * stands, or the reconstruction's own roof-feature consumer) and a measure of its effect. A family the analyzer cannot
 * change is NOT offered as an operation: the reviewer may still report it as a defect (`UNSUPPORTED_FAMILIES`), and the
 * record says so with the reason — it never reads as something the system can correct.
 */
export const CORRECTION_REGISTRY_VERSION = '1.3.0' as const

export const PATCH_OPERATIONS = ['ASSIGN_VIEW', 'SET_PARAMETER', 'ADD_OPENING', 'UPDATE_OPENING', 'REMOVE_OPENING', 'ADD_CHIMNEY', 'UPDATE_CHIMNEY', 'SET_FINISH', 'ROOF_FEATURE', 'BUILD_MASSING', 'SET_ROOF', 'SET_OUTLINE', 'SET_ROOF_OVERHANG'] as const
export type PatchOperation = (typeof PATCH_OPERATIONS)[number]

export const OPENING_PATCH_KINDS = ['WINDOW', 'DOOR', 'GLAZED_DOOR', 'GARAGE_DOOR'] as const
export type OpeningPatchKind = (typeof OPENING_PATCH_KINDS)[number]
export const PARAMETER_PROPERTIES = ['LEVEL_ELEVATION', 'WALL_HEIGHT', 'CHIMNEY_HEIGHT', 'ROOF_PITCH'] as const
export type ParameterProperty = (typeof PARAMETER_PROPERTIES)[number]
export const FINISH_CLASSES = ['LIGHT_RENDER', 'DARK_RENDER', 'TIMBER', 'BRICK'] as const
export type FinishClass = (typeof FINISH_CLASSES)[number]
export const PATCH_UNITS = ['m', 'cm', 'mm', 'deg'] as const

/** What a reviewer may name as a defect but no consumer can change in this stage: recorded UNSUPPORTED_OPERATION. */
/** v3.54.17 R2: why a defect a listed operation corrects comes without a proposal (registry 1.2.0). */
export const DEFECT_BLOCKERS = ['NONE', 'AMBIGUOUS_TARGET', 'NO_LISTED_ELEMENT', 'NEEDS_EVIDENCE'] as const
export const UNSUPPORTED_FAMILIES = ['ROOF_FORM', 'OUTLINE_REGION', 'BALCONY', 'PERGOLA', 'CANOPY', 'TERRACE', 'INTERIOR', 'OTHER'] as const

export type Capability = {
  op: PatchOperation
  family: 'VIEW' | 'PARAMETER' | 'OPENING' | 'ELEMENT' | 'FINISH' | 'ROOF_FEATURE' | 'BODY' | 'ROOF_FORM' | 'OUTLINE'
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
    params: ['property', 'value', 'unit', 'literal', 'sourcePicture', 'box', 'host'],
    prompt: 'SET_PARAMETER — a PRINTED value the model contradicts: targetId (a level, wall, chimney or roof id of the MODEL ELEMENT INDEX), property (LEVEL_ELEVATION, WALL_HEIGHT, CHIMNEY_HEIGHT, ROOF_PITCH), value and unit as printed (m, cm, mm, deg), literal (the print exactly), sourcePicture and box (where it is printed), host (the body or wing the mark belongs to, as the drawing names it, when the house has more than one). Never a value you estimated.',
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
    prompt: "UPDATE_OPENING — an opening of the MODEL ELEMENT INDEX (targetId: its id there) stands at the wrong place, size, height or kind: picture, box and kind as for ADD_OPENING. Never add a second opening where the index lists one.",
  },
  REMOVE_OPENING: {
    op: 'REMOVE_OPENING',
    family: 'OPENING',
    consumer: 'commands/removeFeature (the opening and its fill)',
    measure: "the source picture at the model's opening: removed only when the source shows no opening there",
    params: ['picture'],
    prompt: 'REMOVE_OPENING — an opening of the MODEL ELEMENT INDEX (targetId) that the source elevation does not show: picture (the elevation that shows that wall).',
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
    prompt: 'UPDATE_CHIMNEY — a chimney of the MODEL ELEMENT INDEX (targetId) at the wrong place or height: as ADD_CHIMNEY.',
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
  BUILD_MASSING: {
    op: 'BUILD_MASSING',
    family: 'BODY',
    consumer: 'massing/solveMassing → commands/createBuilding + createLevel + createWallRing + createRoof per body (massing/ops.ts bindBuildMassing)',
    measure: 'the plan outline split into at most two rectangles, each body\'s heights and roof form read from elevations registered by the plan (never by the model\'s roof); the built roof drawn back into each registered source elevation (support); closure errors not increased; existing bodies untouched',
    params: [],
    prompt: 'BUILD_MASSING — the model lacks a whole body (a wing, a garage) or has no body at all: targetId WHOLE. The analyzer builds it from the plan outline and the elevation silhouettes it holds; you give nothing else. Missing anchors are named, never filled in.',
  },
  SET_ROOF: {
    op: 'SET_ROOF',
    family: 'ROOF_FORM',
    consumer: "commands/removeFeature (the body's roofs and planes) + setProperty (the top storey's wall heights and profiles) + createRoof GABLE|FLAT with capWallIds (massing/ops.ts bindSetRoof)",
    measure: "the model's roof and the proposal's roof as the source elevation draws them, held against the original picture (polygon gate); openings above the new eaves refuse the patch; the built roof drawn back (overlap ≥ 0.8, support)",
    params: ['picture', 'roofKind', 'roofPolygon', 'side', 'wallLeftX', 'wallRightX', 'groundY'],
    prompt: "SET_ROOF — a body's roof has the wrong form, ridge direction or heights (e.g. flat where the elevation draws a gable): targetId (the body's roof, roof plane or wall id from the MODEL ELEMENT INDEX), picture (a SOURCE elevation), roofKind (GABLE or FLAT), roofPolygon (the roof's outline in that picture: [[x,y],…], a triangle for a gable end, a band for the slopes). If the picture has no registration with heights, also side, wallLeftX/wallRightX (that body's wall ends, or the whole house's with extent HOUSE) and groundY. A hip roof is UNSUPPORTED.",
  },
  SET_OUTLINE: {
    op: 'SET_OUTLINE',
    family: 'OUTLINE',
    consumer: "commands/setProperty on the body's walls (start, end), their openings' offsets and finish regions, resizeFeature on its roof footprint, setProperty on its slabs' and rooms' polygons (massing/ops.ts bindSetOutline)",
    measure: "the walls at the proposed extent and at the model's, held against the source elevation (polygon gate); openings or regions left outside, a party line or a plane roof refuse the patch; the built extent within 1 cm",
    params: ['picture', 'wallLeftX', 'wallRightX'],
    prompt: "SET_OUTLINE — a body is longer or shorter along one side than the source elevation draws it: targetId (a wall of that body from the MODEL ELEMENT INDEX), picture (a SOURCE elevation of that side), wallLeftX and wallRightX (where that body's walls end in the picture).",
  },
  SET_ROOF_OVERHANG: {
    op: 'SET_ROOF_OVERHANG',
    family: 'ROOF_FORM',
    consumer: "commands/setProperty on the roof's overhang (the eaves and the verges stand that far past the walls)",
    measure: "the overhang each end of the drawn roof stands past the drawn walls at the elevation's registration (both ends, ≤ 1.0 m, within 0.4 m of each other); the walls at that registration on the side's walls; the roof's overhang set to their mean",
    params: ['picture', 'roofLeftX', 'roofRightX', 'wallLeftX', 'wallRightX'],
    prompt: "SET_ROOF_OVERHANG — the roof stands past the walls in the SOURCE elevation (eaves or verges) by a different amount than in the model: targetId (the roof id from the MODEL ELEMENT INDEX), picture (a SOURCE elevation), roofLeftX/roofRightX (the drawn roof's two ends) and wallLeftX/wallRightX (the walls' two outer corners under it)."
  },
}

export const isPatchOperation = (op: string): op is PatchOperation => (PATCH_OPERATIONS as readonly string[]).includes(op)

/** The reviewer prompt's list of operations, generated from the registry: what is offered is what is executable. */
export function capabilityPrompt(): string {
  return [
    `Operations you may propose (registry ${CORRECTION_REGISTRY_VERSION}; each is executed by the analyzer on the model that stands and measured against the source before it is kept):`,
    ...PATCH_OPERATIONS.map((op) => `- ${CAPABILITIES[op].prompt}`),
    `Any other difference (${UNSUPPORTED_FAMILIES.join(', ')}; ROOF_FORM and OUTLINE_REGION here mean what SET_ROOF and SET_OUTLINE cannot do: a hip or curved roof, a non-rectangular body, a third body) is a defect you report in defects with operation UNSUPPORTED: the analyzer cannot change it in this version, and saying so is the right answer.`,
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
    extent: { type: 'string', enum: ['BODY', 'HOUSE'], description: 'SET_ROOF: whether wallLeftX/wallRightX are that body\'s wall ends (BODY, the default) or the whole house\'s on that side (HOUSE)' },
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
    host: { type: 'string' },
    material: { type: 'string', enum: [...FINISH_CLASSES] },
    roofKind: { type: 'string', enum: ['GABLE', 'FLAT'] },
    roofLeftX: { type: 'number' },
    roofRightX: { type: 'number' },
    roofPolygon: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
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
    continues: { type: 'string', description: 'the id of an open defect listed from an earlier look that this one restates (e.g. "L1:D2")' },
    targetId: { type: 'string', description: 'the id of the MODEL ELEMENT INDEX element this defect is about; empty when no listed element is' },
    blocker: { type: 'string', enum: [...DEFECT_BLOCKERS], description: 'why no proposal is given for a difference a listed operation corrects: AMBIGUOUS_TARGET (two or more listed elements could be it), NO_LISTED_ELEMENT (the index lists none there), NEEDS_EVIDENCE (the pictures do not show it clearly enough); NONE otherwise' },
  },
  required: ['id', 'about', 'scope', 'severity', 'certainty', 'operation'],
  additionalProperties: false,
} as const

export type PatchFields = {
  /** v3.54.17 R3: SET_ROOF_OVERHANG — the drawn roof's two ends, in the picture's pixels. */
  roofLeftX?: number
  roofRightX?: number
  /** v3.54.17 R2: SET_ROOF — the wall ends are the body's (BODY) or the whole house's on that side (HOUSE). */
  extent?: 'BODY' | 'HOUSE'
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
  host?: string
  material?: FinishClass
  roofKind?: 'GABLE' | 'FLAT'
  roofPolygon?: Array<[number, number]>
}

export type ReviewDefect = { id: string; about: string; scope: (typeof DEFECT_SCOPES)[number]; severity: DefectSeverity; certainty: 'CERTAIN' | 'LIKELY' | 'UNSURE'; operation: PatchOperation | 'UNSUPPORTED'; family?: (typeof UNSUPPORTED_FAMILIES)[number] | 'NONE'; continues?: string; /** v3.54.17 R2 (registry 1.2.0): the indexed element it is about, and why no proposal was given. */ targetId?: string; blocker?: (typeof DEFECT_BLOCKERS)[number] }
