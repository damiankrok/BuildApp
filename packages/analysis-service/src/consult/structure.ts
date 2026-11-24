/**
 * v3.54.20 — the structure of the house AGREED between the typed structure read (`form-read/2`) and witnesses that do
 * not come from that request, and the part of it the body builder may take.
 *
 * The read is one answer of a model: it is right about a hip the silhouettes take for a gable, and it can be wrong.
 * Nothing of it reaches the builder as a bare claim. Each property stands as
 *   AGREED       an independent witness says the same (named);
 *   UNWITNESSED  nothing else speaks of it and nothing contradicts it — taken, and named as taken on the read alone;
 *   DISPUTED     an independent witness says otherwise — NOT taken; the builder keeps what the drawings' silhouettes
 *                give, and both statements stay on the record.
 * Witnesses: the storeys the page publishes floor plans for, the page's building height and roof pitch, the parts the
 * plan read names, and the elevation sketches' own polygons (a wall drawn up to the roof's top is a gable wall — a hip
 * has none; this is a fact of the drawing, read by another request).
 *
 * Sides: LEFT and RIGHT are those of a person standing OUTSIDE in front of the house looking at the front elevation —
 * the read is told so, and the body's frame says the same (x grows to that person's right, z from the front back).
 */
import type { HouseForm, ValueStatus } from './form-read.js'

export const STRUCTURE_VERSION = '1.0.0' as const
export type Standing = 'AGREED' | 'UNWITNESSED' | 'DISPUTED'
export type Witnessed<T> = { value: T; standing: Standing; witnesses: string[]; why: string }
export type StructureSide = 'FRONT' | 'LEFT' | 'RIGHT' | 'REAR'
export type StructureRoof = 'GABLE' | 'HIP' | 'FLAT'

/** What does not come from the structure read. */
export type StructureWitnesses = {
  /** the storeys the page publishes a floor plan for (the package's roles: GROUND, UPPER, ATTIC, BASEMENT, …) */
  planStoreys: readonly string[]
  /** the page's building height (metres, from the ground) and roof pitch (degrees), where it states them */
  buildingHeightM?: number
  publishedPitchDeg?: number
  /** the parts the plan read names inside its outline (MAIN, GARAGE, …) */
  planParts?: readonly string[]
  /**
   * One entry per elevation sketch: whether a wall polygon at least half the building's width rises to the roof's top
   * (`wallToApex`), and the side the sketch is captioned with, where it is.
   */
  gableWalls: ReadonlyArray<{ frameId: string; side?: StructureSide; wallToApex: boolean }>
}

export type AgreedStructure = {
  version: string
  storeys: Witnessed<{ full: 1 | 2; attic: boolean }>
  mainRoof: Witnessed<{ kind: HouseForm['mainRoof']['kind'] }>
  mainRidge: Witnessed<{ along: 'FRONT' | 'SIDE' | 'NONE' }>
  pitchDeg: Witnessed<{ deg: number | null; status: ValueStatus }>
  eavesM: Witnessed<{ m: number | null; status: ValueStatus }>
  ridgeM: Witnessed<{ m: number | null; status: ValueStatus }>
  parts: Array<Witnessed<{ what: 'GARAGE' | 'WING' | 'ANNEX'; where: StructureSide; full: 1 | 2; roof: HouseForm['mainRoof']['kind']; ridgeAlong: 'FRONT' | 'SIDE' | 'NONE'; lowerThanMain: boolean }>>
  /** named and NOT built as volumes (a recess, a porch, a bay, a dormer, a balcony, a canopy): the registry has no consumer for them yet */
  notVolumes: Array<{ what: string; where: StructureSide }>
  /** the side each elevation picture shows, as the read tells it (1-based picture numbers, in the order the pictures were given) */
  pictures: Array<{ n: number; shows: StructureSide | 'NONE'; roofSeenAs: string; entranceDoor: boolean; garageDoor: boolean }>
}

/** Tolerances, fixed before any result. */
export const STRUCTURE_TOLERANCES = {
  /** the read's pitch and the page's agree within this (degrees) */
  pitchAgreeDeg: 3,
  /** the read's ridge above the floor and the page's height above the ground agree within this (metres: a plinth and the reading) */
  ridgeAgreeM: 0.9,
  /** two full storeys of walls end no lower than this above the ground floor's floor; one storey's no higher (metres) */
  twoStoreyEavesMinM: 4.4,
  oneStoreyEavesMaxM: 4.6,
} as const

const w = <T>(value: T, standing: Standing, witnesses: string[], why: string): Witnessed<T> => ({ value, standing, witnesses, why })

export function agreeStructure(f: HouseForm, x: StructureWitnesses): AgreedStructure {
  const T = STRUCTURE_TOLERANCES
  // storeys — the page's own floor plans
  const full: 1 | 2 = f.storeys === 'TWO' || f.storeys === 'TWO_WITH_ATTIC' ? 2 : 1
  const attic = f.storeys === 'ONE_WITH_ATTIC' || f.storeys === 'TWO_WITH_ATTIC'
  const upper = x.planStoreys.includes('UPPER')
  const atticPlan = x.planStoreys.includes('ATTIC')
  const storeys = full === 2
    ? upper ? w({ full, attic }, 'AGREED', ['PLAN_STOREYS'], `two full storeys, and the page publishes an upper-floor plan (${x.planStoreys.join(', ')})`)
      : atticPlan ? w({ full, attic }, 'DISPUTED', ['PLAN_STOREYS'], `two full storeys reported, but the page calls its upper level an attic (${x.planStoreys.join(', ')})`)
        : w({ full, attic }, 'UNWITNESSED', [], `two full storeys on the read alone (the page publishes plans for ${x.planStoreys.join(', ') || 'no storey'})`)
    : upper && !atticPlan ? w({ full, attic }, 'DISPUTED', ['PLAN_STOREYS'], `one storey${attic ? ' with an attic' : ''} reported, but the page publishes an upper-floor plan (${x.planStoreys.join(', ')})`)
      : attic === atticPlan ? w({ full, attic }, 'AGREED', ['PLAN_STOREYS'], `one storey${attic ? ' with an attic' : ''}, as the page's plans say (${x.planStoreys.join(', ') || 'none'})`)
        : w({ full, attic }, 'UNWITNESSED', [], `one storey${attic ? ' with an attic' : ''} on the read alone (the page publishes plans for ${x.planStoreys.join(', ') || 'no storey'})`)

  // the main roof's kind — the sketches' gable walls, and the read's own pictures
  const kind = f.mainRoof.kind
  const apex = x.gableWalls.filter((g) => g.wallToApex)
  const ownGable = f.pictures.filter((p) => p.roofSeenAs === 'GABLE_END').length
  let mainRoof: AgreedStructure['mainRoof']
  if (kind === 'HIP') {
    if (ownGable > 0) mainRoof = w({ kind }, 'DISPUTED', ['READ_PICTURES'], `a hip reported, but the same answer sees a gable end on ${ownGable} picture(s): it contradicts itself`)
    else if (apex.length > 0) mainRoof = w({ kind }, 'DISPUTED', ['SKETCH_GABLE_WALL'], `a hip reported, but ${apex.length} elevation sketch(es) draw a wall up to the roof's top — a gable wall, which a hip does not have`)
    else if (x.gableWalls.length >= 2) mainRoof = w({ kind }, 'AGREED', ['SKETCH_GABLE_WALL'], `a hip, and none of the ${x.gableWalls.length} elevation sketches draws a wall up to the roof's top`)
    else mainRoof = w({ kind }, 'UNWITNESSED', [], 'a hip on the read alone (fewer than two elevation sketches to hold it against)')
  } else if (kind === 'GABLE') {
    if (apex.length > 0) mainRoof = w({ kind }, 'AGREED', ['SKETCH_GABLE_WALL'], `a gable, and ${apex.length} elevation sketch(es) draw a wall up to the roof's top`)
    else mainRoof = w({ kind }, 'UNWITNESSED', [], 'a gable on the read alone (no elevation sketch draws its wall up to the roof\'s top)')
  } else mainRoof = w({ kind }, 'UNWITNESSED', [], `${kind} on the read alone`)

  // the main ridge — the front picture as the read saw it, and the front sketch's wall
  const along = f.mainRoof.ridgeAlong
  const frontPic = f.pictures.find((p) => p.shows === 'FRONT')
  const frontApex = x.gableWalls.find((g) => g.side === 'FRONT')
  let mainRidge: AgreedStructure['mainRidge']
  if (along === 'NONE') mainRidge = w({ along }, 'UNWITNESSED', [], 'no ridge (a flat roof)')
  else if (frontPic && ((along === 'FRONT' && frontPic.roofSeenAs === 'GABLE_END') || (along === 'SIDE' && frontPic.roofSeenAs === 'SLOPE' && kind === 'GABLE'))) mainRidge = w({ along }, 'DISPUTED', ['READ_PICTURES'], `the ridge reported along the ${along.toLowerCase()}, but the same answer sees ${frontPic.roofSeenAs} on the front picture: it contradicts itself`)
  else if (kind === 'GABLE' && frontApex && frontApex.wallToApex === (along === 'FRONT')) mainRidge = w({ along }, 'DISPUTED', ['SKETCH_GABLE_WALL'], `the ridge reported ${along === 'FRONT' ? 'parallel to the front' : 'front-to-back'}, but the front elevation sketch ${frontApex.wallToApex ? 'draws a wall up to the roof\'s top (a gable wall on the front)' : 'draws no wall up to the roof\'s top (no gable wall on the front)'}`)
  else if (kind === 'GABLE' && frontApex) mainRidge = w({ along }, 'AGREED', ['SKETCH_GABLE_WALL'], `the ridge ${along === 'FRONT' ? 'parallel to the front' : 'front-to-back'}, as the front elevation sketch's wall says`)
  else mainRidge = w({ along }, 'UNWITNESSED', [], `the ridge ${along === 'FRONT' ? 'parallel to the front' : 'front-to-back'} on the read alone`)

  // numbers — the page's facts
  const pitch = f.main.pitch
  const pitchDeg = pitch.deg === null ? w(pitch, 'UNWITNESSED', [], 'no pitch reported')
    : x.publishedPitchDeg !== undefined ? Math.abs(pitch.deg - x.publishedPitchDeg) <= T.pitchAgreeDeg ? w(pitch, 'AGREED', ['PAGE_ROOF_PITCH'], `${pitch.deg}° (${pitch.status}), the page states ${x.publishedPitchDeg}°`) : w(pitch, 'DISPUTED', ['PAGE_ROOF_PITCH'], `${pitch.deg}° reported (${pitch.status}), the page states ${x.publishedPitchDeg}°`)
      : w(pitch, 'UNWITNESSED', [], `${pitch.deg}° (${pitch.status}) on the read alone`)
  const ridge = f.main.ridge
  const ridgeM = ridge.m === null ? w(ridge, 'UNWITNESSED', [], 'no ridge height reported')
    : x.buildingHeightM !== undefined ? Math.abs(ridge.m - x.buildingHeightM) <= T.ridgeAgreeM ? w(ridge, 'AGREED', ['PAGE_BUILDING_HEIGHT'], `the ridge ${ridge.m} m above the floor (${ridge.status}), the page's building height ${x.buildingHeightM} m from the ground`) : w(ridge, 'DISPUTED', ['PAGE_BUILDING_HEIGHT'], `the ridge ${ridge.m} m above the floor reported (${ridge.status}), the page's building height is ${x.buildingHeightM} m`)
      : w(ridge, 'UNWITNESSED', [], `the ridge ${ridge.m} m (${ridge.status}) on the read alone`)
  const eaves = f.main.eaves
  const eavesM = eaves.m === null ? w(eaves, 'UNWITNESSED', [], 'no eaves height reported')
    : (full === 2 && eaves.m < T.twoStoreyEavesMinM) || (full === 1 && eaves.m > T.oneStoreyEavesMaxM) ? w(eaves, 'DISPUTED', ['READ_STOREYS'], `the eaves ${eaves.m} m reported for ${full === 2 ? 'two full storeys' : 'one storey'}: the answer contradicts itself`)
      : w(eaves, 'UNWITNESSED', [], `the eaves ${eaves.m} m (${eaves.status}) on the read alone`)

  // parts — the plan read's parts
  const parts = f.parts.map((p) => {
    const value = { what: p.what, where: p.where, full: (p.storeys === 'TWO' ? 2 : 1) as 1 | 2, roof: p.roof.kind, ridgeAlong: p.roof.ridgeAlong, lowerThanMain: p.lowerThanMain }
    return p.what === 'GARAGE' && (x.planParts ?? []).includes('GARAGE') ? w(value, 'AGREED', ['PLAN_PARTS'], `a garage on the ${p.where.toLowerCase()}, and the plan read names a garage inside its outline`) : w(value, 'UNWITNESSED', [], `a ${p.what.toLowerCase()} on the ${p.where.toLowerCase()} on the read alone (the plan read names ${(x.planParts ?? []).join(', ') || 'no parts'})`)
  })
  return { version: STRUCTURE_VERSION, storeys, mainRoof, mainRidge, pitchDeg, eavesM, ridgeM, parts, notVolumes: f.notVolumes.map((n) => ({ what: n.what, where: n.where })), pictures: f.pictures.map((p) => ({ ...p })) }
}

/**
 * What the body builder takes: only what is not disputed, in the body's own frame (x along the front, growing to the
 * right of a person looking at the front; z from the front back — so a ridge parallel to the front runs along X).
 */
export type BuildStructure = {
  fullStoreys?: 1 | 2
  mainRoof?: StructureRoof
  mainRidge?: 'X' | 'Z'
  pitchDeg?: number
  /** heights above the ground floor's floor, each with how the read knows it */
  eavesM?: { m: number; status: ValueStatus }
  ridgeM?: { m: number; status: ValueStatus }
  parts: Array<{ what: string; where: StructureSide; fullStoreys: 1 | 2; roof?: StructureRoof; ridge?: 'X' | 'Z' }>
}
const buildable = (k: string): StructureRoof | undefined => (k === 'GABLE' || k === 'HIP' || k === 'FLAT' ? k : undefined)
const axisOf = (a: 'FRONT' | 'SIDE' | 'NONE'): 'X' | 'Z' | undefined => (a === 'FRONT' ? 'X' : a === 'SIDE' ? 'Z' : undefined)

export function buildStructureOf(a: AgreedStructure): BuildStructure {
  const ok = <T>(q: Witnessed<T>): boolean => q.standing !== 'DISPUTED'
  const kind = ok(a.mainRoof) ? buildable(a.mainRoof.value.kind) : undefined
  const ridge = ok(a.mainRidge) ? axisOf(a.mainRidge.value.along) : undefined
  return {
    ...(ok(a.storeys) ? { fullStoreys: a.storeys.value.full } : {}),
    ...(kind ? { mainRoof: kind } : {}),
    ...(ridge ? { mainRidge: ridge } : {}),
    // a pitch moves walls (the storeys rule): only one the page agrees with, or the read states as printed or derived — never its estimate
    ...(ok(a.pitchDeg) && a.pitchDeg.value.deg !== null && a.pitchDeg.value.deg >= 5 && a.pitchDeg.value.deg <= 60 && (a.pitchDeg.standing === 'AGREED' || a.pitchDeg.value.status === 'PRINTED' || a.pitchDeg.value.status === 'DERIVED') ? { pitchDeg: a.pitchDeg.value.deg } : {}),
    ...(ok(a.eavesM) && a.eavesM.value.m !== null ? { eavesM: { m: a.eavesM.value.m, status: a.eavesM.value.status } } : {}),
    ...(ok(a.ridgeM) && a.ridgeM.value.m !== null ? { ridgeM: { m: a.ridgeM.value.m, status: a.ridgeM.value.status } } : {}),
    parts: a.parts.filter(ok).map((p) => { const k = buildable(p.value.roof); const r = axisOf(p.value.ridgeAlong); return { what: p.value.what, where: p.value.where, fullStoreys: p.value.full, ...(k ? { roof: k } : {}), ...(r ? { ridge: r } : {}) } }),
  }
}

/**
 * The elevation sketch's own witness of a gable wall: a wall polygon at least half as wide as all the drawn walls whose
 * top reaches the roof's top within `GABLE_WALL.topShare` of the height from the ground to it. (A hip's wall ends at the
 * eaves on every side; a dormer's or a chimney's wall is narrow.)
 */
export const GABLE_WALL = { topShare: 0.12, minWidthShare: 0.5 } as const
export function wallToApex(walls: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, roofs: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, groundRow: number | null | undefined): boolean | undefined {
  if (groundRow === null || groundRow === undefined || !Number.isFinite(groundRow) || walls.length === 0 || roofs.length === 0) return undefined
  const roofTop = Math.min(...roofs.flatMap((p) => p.map((q) => q[1])))
  const xs = walls.flatMap((p) => p.map((q) => q[0]))
  const width = Math.max(...xs) - Math.min(...xs)
  const h = groundRow - roofTop
  if (!(h > 10) || !(width > 10)) return undefined
  return walls.some((p) => { const px = p.map((q) => q[0]); const top = Math.min(...p.map((q) => q[1])); return Math.max(...px) - Math.min(...px) >= GABLE_WALL.minWidthShare * width && top - roofTop <= GABLE_WALL.topShare * h })
}
