/**
 * Semantic groups and the architectural palette.
 *
 * A compiled mesh says what it is (`part`) and what it belongs to
 * (`objectKind`); a viewer that colours by part alone lets a terrace, a slab
 * and a wall of the same render merge into one white mass. A SEMANTIC GROUP
 * is the styling vocabulary between the two: coarse enough that a palette can
 * give every group a deliberately separated value, fine enough that the
 * things a person tells apart on a drawing — main body, secondary body,
 * trim, glazing, frame, roof, flat roof, terrace — stay apart on screen.
 *
 * `semanticGroupOf` derives the group from the compiled part FIRST and from
 * the object's own facts SECOND. It never reads geometry, never guesses from
 * a coordinate, and never names a building. The palette is one constant,
 * shared: the bundle carries it so the phone draws from it, the web viewer
 * mirrors it (an architecture rule keeps the web clear of this package) and a
 * test proves the copies equal.
 *
 * Styling must never hide a geometry defect. Nothing here thickens an
 * outline, randomises a colour per object or leans on a screen-space effect;
 * it assigns colours and asks for a soft feature-edge line on structural
 * groups only.
 */
import type { GeometryPart } from '@buildapp/geometry'
import type { SemanticKind } from '@buildapp/model'

export type SemanticGroup =
  | 'WALL_MAIN'
  | 'WALL_SECONDARY'
  | 'WALL_INTERIOR'
  | 'ROOF_MAIN'
  | 'FLAT_ROOF'
  | 'ROOF_TRIM'
  | 'WINDOW_GLASS'
  | 'WINDOW_FRAME'
  | 'DOOR'
  | 'GARAGE_DOOR'
  | 'SLAB'
  | 'BALCONY_SLAB'
  | 'RAILING'
  | 'FACADE_FRAME'
  | 'TERRACE_SURFACE'
  | 'CHIMNEY'
  | 'ROOFLIGHT'
  | 'STAIR'
  | 'ROOM'
  | 'OTHER'

/** Every group, in a fixed order, so tables and tests can be exhaustive. */
export const SEMANTIC_GROUPS: readonly SemanticGroup[] = [
  'WALL_MAIN',
  'WALL_SECONDARY',
  'WALL_INTERIOR',
  'ROOF_MAIN',
  'FLAT_ROOF',
  'ROOF_TRIM',
  'WINDOW_GLASS',
  'WINDOW_FRAME',
  'DOOR',
  'GARAGE_DOOR',
  'SLAB',
  'BALCONY_SLAB',
  'RAILING',
  'FACADE_FRAME',
  'TERRACE_SURFACE',
  'CHIMNEY',
  'ROOFLIGHT',
  'STAIR',
  'ROOM',
  'OTHER',
]

/**
 * What a bundle knows about the semantic object a mesh belongs to, beyond its
 * kind. Every field is optional: a producer states what its model states.
 *
 * - `kind` — the object's own `kind` field where its schema has one: a
 *   balcony's BALCONY / TERRACE / LOGGIA, a stair's FLIGHTS / PLACEHOLDER; for
 *   a door, `PANEL` when every panel of its assembly is a solid panel (a
 *   sectional or blank door) — there is no door kind in the schema, so this is
 *   the assembly read as one word; for a railing, its infill (GLASS / BARS / NONE).
 * - `roofKind` — a roof's GABLE / FLAT.
 * - `wallKind` — a wall's EXTERIOR / INTERIOR.
 * - `massRole` — MAIN / ATTACHED, when the producer knows which body of the
 *   building a wall belongs to. The CanonicalBuildingModel does not record
 *   masses, so no producer supplies it today.
 * - `finish` — an exterior wall's finish relative to the building's other
 *   exterior walls, read off the model's own material assignments:
 *   PRIMARY when it carries the building's dominant exterior finish (the one
 *   covering the largest wall area); MEMBER when it carries a different
 *   finish that the building's frame members (roof verge and fascia boards,
 *   free linear members) also carry — a return framing a gable; SECONDARY for
 *   any other different finish — a garage in grey render beside a white
 *   house. See `wallFinishes` in the bundle.
 */
export type ObjectFacts = {
  kind?: string
  roofKind?: string
  wallKind?: string
  massRole?: string
  finish?: 'PRIMARY' | 'SECONDARY' | 'MEMBER'
}

export type SemanticGroupInput = {
  objectKind: SemanticKind
  part: GeometryPart
  materialId?: string
  materialName?: string
  objectFacts?: ObjectFacts
}

const upper = (s: string | undefined): string => (s ?? '').toUpperCase()

/**
 * The group of one compiled mesh.
 *
 * The compiled part decides first: a piece of glass is glass whatever object
 * it fills, a railing post is a railing. Where one part serves several
 * groups — a roof that is flat or pitched, a balcony that is a terrace, a
 * door that is a sectional panel — the object's facts decide, and a material
 * name is read only as a last resort, for the cases where a producer stated a
 * finish but not a kind (a "flat roof membrane" on a roof, a "partition" on a
 * wall, "glazing" in a railing).
 */
export function semanticGroupOf(input: SemanticGroupInput): SemanticGroup {
  const facts = input.objectFacts ?? {}
  const material = `${upper(input.materialId)} ${upper(input.materialName)}`
  const kind = upper(facts.kind)

  switch (input.part) {
    case 'WALL':
    case 'WALL_REVEAL': {
      if (upper(facts.wallKind) === 'INTERIOR') return 'WALL_INTERIOR'
      if (facts.finish === 'MEMBER') return 'FACADE_FRAME'
      if (upper(facts.massRole) === 'ATTACHED' || facts.finish === 'SECONDARY') return 'WALL_SECONDARY'
      if (!facts.wallKind && /PARTITION|INTERIOR/.test(material)) return 'WALL_INTERIOR'
      return 'WALL_MAIN'
    }
    case 'ROOF':
    case 'ROOF_REVEAL': {
      if (upper(facts.roofKind) === 'FLAT') return 'FLAT_ROOF'
      if (!facts.roofKind && /MEMBRANE|FLAT/.test(material)) return 'FLAT_ROOF'
      return 'ROOF_MAIN'
    }
    case 'ROOF_TRIM':
      return 'ROOF_TRIM'
    case 'WINDOW_GLASS':
    case 'DOOR_GLASS':
    case 'ROOFLIGHT_GLASS':
      return 'WINDOW_GLASS'
    case 'WINDOW_FRAME':
    case 'WINDOW_MULLION':
      return 'WINDOW_FRAME'
    case 'DOOR_FRAME':
    case 'DOOR_LEAF':
    case 'DOOR_PANEL':
    case 'DOOR_HANDLE':
      return kind === 'PANEL' ? 'GARAGE_DOOR' : 'DOOR'
    case 'SLAB':
      return 'SLAB'
    case 'BALCONY':
      return kind === 'TERRACE' ? 'TERRACE_SURFACE' : 'BALCONY_SLAB'
    case 'TERRACE':
      return 'TERRACE_SURFACE'
    case 'RAILING_POST':
    case 'RAILING_RAIL':
      return 'RAILING'
    case 'RAILING_INFILL': {
      if (kind === 'GLASS') return 'WINDOW_GLASS'
      if (!facts.kind && /GLASS|GLAZ/.test(material)) return 'WINDOW_GLASS'
      return 'RAILING'
    }
    case 'CHIMNEY':
      return 'CHIMNEY'
    case 'ROOFLIGHT_FRAME':
      return 'ROOFLIGHT'
    case 'STAIR_STEP':
    case 'STAIR_PLACEHOLDER':
      return 'STAIR'
    case 'ROOM_FLOOR':
      return 'ROOM'
    case 'SURFACE_REGION':
      // A finish region is a secondary surface of the wall it sits on: it must
      // read as a band, not vanish into the wall's own colour.
      return 'WALL_SECONDARY'
    case 'LINEAR_SOLID':
      // Free members — portal heads, verge and fascia boards not yet compiled
      // with a roof — frame the facade.
      return 'FACADE_FRAME'
    default:
      return 'OTHER'
  }
}

// ---------------------------------------------------------------------------
// The palette
// ---------------------------------------------------------------------------

export type EdgeTreatment = 'SOFT' | 'NONE'

export type GroupAppearance = {
  /** `#rrggbb`, sRGB. */
  color: string
  /** Present only for translucent groups; absent means opaque. */
  opacity?: number
  roughness: number
  metalness: number
  /** SOFT asks for a thin, low-opacity feature-edge line; NONE for none. */
  edge: EdgeTreatment
}

export type ArchitecturalPalette = Record<SemanticGroup, GroupAppearance>

export const ARCHITECTURAL_PALETTE_ID = 'architectural-v1' as const

/**
 * A restrained architectural palette: a warm off-white render on the main
 * body, a mid grey on a secondary body, a deep warm grey roof, near-black
 * frames, cool translucent glass, warm timber doors, light concrete for slabs
 * and balconies, a darker warm stone for the terrace, a muted brick-grey
 * chimney, trims one step lighter than the walls.
 *
 * The values are a ladder on purpose. Every pair of groups that commonly
 * meets in a building (`ADJACENT_GROUPS`) differs by at least 0.06 in
 * relative luminance, so two adjacent elements never blend into one — the
 * defect this palette exists to remove. The test holds that number.
 */
export const ARCHITECTURAL_PALETTE: ArchitecturalPalette = {
  WALL_MAIN: { color: '#e3ddd3', roughness: 0.95, metalness: 0, edge: 'SOFT' },
  WALL_SECONDARY: { color: '#8f8b85', roughness: 0.95, metalness: 0, edge: 'SOFT' },
  WALL_INTERIOR: { color: '#d3cec3', roughness: 0.95, metalness: 0, edge: 'SOFT' },
  ROOF_MAIN: { color: '#423e3b', roughness: 0.85, metalness: 0, edge: 'SOFT' },
  FLAT_ROOF: { color: '#69645f', roughness: 0.85, metalness: 0, edge: 'SOFT' },
  ROOF_TRIM: { color: '#f3eee6', roughness: 0.85, metalness: 0, edge: 'SOFT' },
  WINDOW_GLASS: { color: '#9ec0d6', opacity: 0.35, roughness: 0.12, metalness: 0.1, edge: 'NONE' },
  WINDOW_FRAME: { color: '#272626', roughness: 0.55, metalness: 0.05, edge: 'NONE' },
  DOOR: { color: '#8d6c46', roughness: 0.7, metalness: 0, edge: 'NONE' },
  GARAGE_DOOR: { color: '#58595c', roughness: 0.6, metalness: 0.1, edge: 'NONE' },
  SLAB: { color: '#c1beba', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  BALCONY_SLAB: { color: '#b5b0aa', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  RAILING: { color: '#3a3c3f', roughness: 0.5, metalness: 0.5, edge: 'NONE' },
  FACADE_FRAME: { color: '#a7a197', roughness: 0.8, metalness: 0, edge: 'SOFT' },
  TERRACE_SURFACE: { color: '#a49c92', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  CHIMNEY: { color: '#837671', roughness: 0.9, metalness: 0, edge: 'SOFT' },
  ROOFLIGHT: { color: '#5e6166', roughness: 0.5, metalness: 0.2, edge: 'NONE' },
  STAIR: { color: '#b2aca4', roughness: 0.9, metalness: 0, edge: 'NONE' },
  ROOM: { color: '#8db1a8', opacity: 0.25, roughness: 1, metalness: 0, edge: 'NONE' },
  OTHER: { color: '#b6b2ad', roughness: 0.9, metalness: 0, edge: 'NONE' },
}

/**
 * Pairs of groups that commonly touch. The palette keeps every pair at least
 * `MIN_ADJACENT_LUMINANCE_GAP` apart in relative luminance.
 */
export const ADJACENT_GROUPS: ReadonlyArray<readonly [SemanticGroup, SemanticGroup]> = [
  ['WALL_MAIN', 'ROOF_TRIM'],
  ['WALL_MAIN', 'SLAB'],
  ['WALL_MAIN', 'ROOF_MAIN'],
  ['WALL_MAIN', 'FLAT_ROOF'],
  ['WALL_MAIN', 'TERRACE_SURFACE'],
  ['WALL_MAIN', 'WALL_SECONDARY'],
  ['WALL_MAIN', 'WALL_INTERIOR'],
  ['WALL_MAIN', 'BALCONY_SLAB'],
  ['WALL_MAIN', 'CHIMNEY'],
  ['WALL_MAIN', 'FACADE_FRAME'],
  ['WALL_MAIN', 'WINDOW_FRAME'],
  ['WALL_MAIN', 'DOOR'],
  ['WALL_MAIN', 'GARAGE_DOOR'],
  ['WALL_MAIN', 'STAIR'],
  ['WALL_SECONDARY', 'ROOF_TRIM'],
  ['WALL_SECONDARY', 'SLAB'],
  ['WALL_SECONDARY', 'FLAT_ROOF'],
  ['WALL_SECONDARY', 'TERRACE_SURFACE'],
  ['WALL_SECONDARY', 'BALCONY_SLAB'],
  ['WALL_SECONDARY', 'WINDOW_FRAME'],
  ['WALL_SECONDARY', 'GARAGE_DOOR'],
  ['WALL_INTERIOR', 'SLAB'],
  ['WALL_INTERIOR', 'DOOR'],
  ['WALL_INTERIOR', 'STAIR'],
  ['ROOF_MAIN', 'ROOF_TRIM'],
  ['ROOF_MAIN', 'CHIMNEY'],
  ['ROOF_MAIN', 'ROOFLIGHT'],
  ['ROOF_MAIN', 'FLAT_ROOF'],
  ['ROOF_MAIN', 'FACADE_FRAME'],
  ['FLAT_ROOF', 'ROOF_TRIM'],
  ['ROOF_TRIM', 'FACADE_FRAME'],
  ['ROOF_TRIM', 'CHIMNEY'],
  ['SLAB', 'TERRACE_SURFACE'],
  ['SLAB', 'BALCONY_SLAB'],
  ['SLAB', 'STAIR'],
  ['SLAB', 'FACADE_FRAME'],
  ['BALCONY_SLAB', 'RAILING'],
  ['TERRACE_SURFACE', 'RAILING'],
  ['WINDOW_FRAME', 'WINDOW_GLASS'],
  ['DOOR', 'WINDOW_GLASS'],
]

export const MIN_ADJACENT_LUMINANCE_GAP = 0.06

/** Which groups asked for a feature-edge line: the structural ones. */
export const edgeGroups = (palette: ArchitecturalPalette = ARCHITECTURAL_PALETTE): SemanticGroup[] => SEMANTIC_GROUPS.filter((g) => palette[g].edge === 'SOFT')

// ---------------------------------------------------------------------------
// Colour arithmetic
// ---------------------------------------------------------------------------

/** `#rrggbb` -> [r, g, b] in 0..255. Throws on anything else: a palette is code. */
export function parseHex(color: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!m) throw new Error(`not an #rrggbb colour: ${color}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

const srgbToLinear = (c: number): number => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseHex(color)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

const colorDistance = (a: string, b: string): number => {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  return Math.hypot(ar - br, ag - bg, ab - bb)
}

// ---------------------------------------------------------------------------
// Tone hints
// ---------------------------------------------------------------------------

export type Tone = 'LIGHT' | 'MID' | 'DARK' | 'WARM' | 'COOL'

export type ToneHints = Partial<Record<SemanticGroup, Tone>>

/**
 * The palette's own variants of each tone family. A hint never introduces a
 * colour the palette does not already have: it moves a group onto another
 * rung of the same ladder, so the result stays one coherent palette.
 */
export const TONE_FAMILIES: Record<Tone, readonly SemanticGroup[]> = {
  LIGHT: ['ROOF_TRIM', 'WALL_MAIN', 'WALL_INTERIOR'],
  MID: ['SLAB', 'BALCONY_SLAB', 'STAIR', 'FACADE_FRAME', 'TERRACE_SURFACE', 'WALL_SECONDARY'],
  DARK: ['CHIMNEY', 'FLAT_ROOF', 'GARAGE_DOOR', 'ROOFLIGHT', 'ROOF_MAIN', 'RAILING', 'WINDOW_FRAME'],
  WARM: ['WALL_MAIN', 'TERRACE_SURFACE', 'CHIMNEY', 'DOOR'],
  COOL: ['WINDOW_GLASS', 'GARAGE_DOOR', 'ROOFLIGHT', 'RAILING'],
}

/**
 * Shift the hinted groups to the nearest variant of their tone family.
 *
 * Pure: a new palette is returned and the input is untouched. Only `color`
 * moves; opacity, roughness, metalness and the edge treatment are the
 * group's own. A hint that agrees with the palette is a no-op, since the
 * group's own colour is then the nearest member of the family.
 */
export function applyToneHints(palette: ArchitecturalPalette, hints: ToneHints | undefined): ArchitecturalPalette {
  const out = { ...palette }
  for (const group of SEMANTIC_GROUPS) {
    const tone = hints?.[group]
    if (!tone) continue
    // Neighbours as they stand now (earlier hints applied): a hint may not
    // move a group into a neighbour's luminance, or two elements that meet
    // would merge into one — the defect the palette exists to remove.
    const neighbours = ADJACENT_GROUPS.filter(([a, b]) => a === group || b === group).map(([a, b]) => (a === group ? b : a))
    const keepsApart = (color: string): boolean => neighbours.every((n) => Math.abs(relativeLuminance(color) - relativeLuminance(out[n].color)) >= MIN_ADJACENT_LUMINANCE_GAP)
    const from = palette[group].color
    const variants = [...new Set(TONE_FAMILIES[tone].map((g) => palette[g].color))].sort((a, b) => colorDistance(from, a) - colorDistance(from, b))
    // The group's own colour, when it is in the family, is its own nearest variant: the hint is a no-op.
    const best = variants.includes(from) ? from : variants.find(keepsApart)
    if (best === undefined) continue
    out[group] = { ...palette[group], color: best }
  }
  return out
}

/**
 * The tone family of a finish colour, by relative luminance alone: the
 * coarse reading a render survives (light, mid, dark), not a hue.
 */
export function toneOfColor(color: string): Tone {
  const l = relativeLuminance(color)
  return l >= 0.45 ? 'LIGHT' : l >= 0.12 ? 'MID' : 'DARK'
}

/** The groups whose rung a model's own finishes may steer. Frames, glass, doors and the rest keep the palette's own. */
export const TONE_HINTABLE_GROUPS: readonly SemanticGroup[] = ['WALL_MAIN', 'WALL_SECONDARY', 'FACADE_FRAME', 'ROOF_MAIN', 'FLAT_ROOF']

// ---------------------------------------------------------------------------
// The bundle's styling block
// ---------------------------------------------------------------------------

export type BundleStyling = {
  palette: typeof ARCHITECTURAL_PALETTE_ID
  groups: ArchitecturalPalette
  toneHints?: ToneHints
}

/** The styling block a bundle carries: the shared palette, hints applied. */
export function bundleStyling(toneHints?: ToneHints): BundleStyling {
  const hasHints = toneHints !== undefined && Object.keys(toneHints).length > 0
  return {
    palette: ARCHITECTURAL_PALETTE_ID,
    groups: hasHints ? applyToneHints(ARCHITECTURAL_PALETTE, toneHints) : { ...ARCHITECTURAL_PALETTE },
    ...(hasHints ? { toneHints: { ...toneHints } } : {}),
  }
}
