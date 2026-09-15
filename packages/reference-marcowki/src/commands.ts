/**
 * Dom w marcówkach (GE) as a Building DSL command stream.
 *
 * Every coordinate below is a transcribed fact (facts.ts) or a plan position
 * from the reference gold transcriptions, passed through the one documented
 * frame transform (transform.ts). The commands are ordinary BuildApp commands:
 * the model they produce compiles through the generic geometry compiler like
 * any other, and nothing in the generic packages knows this house exists.
 *
 * The house, in BuildApp coordinates (front at the bottom, x right, z into the
 * building):
 *
 *   z 14.60  ─┬──── rear returns (0.61 m) ───┬─   rear loggia zone 13.60..14.60
 *   z 13.60   │  rear wall  (main body)       │
 *             │                               │
 *   z  8.50   │  main body 7.90 × 12.60       ├──────────┐  garage 4.15 × 7.50
 *             │                               │  garage  │
 *   z  1.00   │  front wall                   │          │
 *   z  0.00  ─┴─ west return ─ portal / balcony ─ garage return ─┘  front zone 0..1.00
 *            x 0          x 7.90            x 12.05
 */
import type { BuildingCommand } from '@buildapp/commands'
import type { Evidence, EvidenceStatus, Vec2 } from '@buildapp/model'
import { FACTS, fact, factRecord, weakest, type FactKey } from './facts.js'
import { SRC, ev, evidenceSourceCommands, type SourceId } from './sources.js'
import { q, refPlanToApp, refPolygonToApp, refZRangeToApp } from './transform.js'

export const MARCOWKI_MODEL_ID = 'marcowki-ge'
export const MARCOWKI_MODEL_NAME = 'Dom w marcówkach (GE)'
export const MARCOWKI_CREATED_WITH = 'buildapp-reference-marcowki'

// ---------------------------------------------------------------------------
// Numbers, all from the facts table
// ---------------------------------------------------------------------------

const T = fact('wall.externalThickness')
const TP = fact('wall.partitionThickness')
const TR = fact('wall.returnThickness')
const MAIN_W = fact('plan.mainBodyWidth')
const OVERALL_W = fact('plan.overallWidth')
const DEPTH = fact('plan.overallDepth')
const GARAGE_D = fact('plan.garageDepth')
const GROUND_FFL = fact('level.groundFfl')
const UPPER_FFL = fact('level.upperFfl')
const RIDGE = fact('level.ridge')
const EAVE = fact('level.eave')
const KNEE = fact('wall.kneeWall')
const PITCH = fact('roof.pitch')
const BUILD_UP = fact('roof.buildUp')
const SLAB_T = fact('slab.upperThickness')
const GARAGE_ROOF_TOP = fact('garage.roofTop')
const GARAGE_ROOF_T = fact('garage.roofThickness')
const GARAGE_WALL_TOP = q(GARAGE_ROOF_TOP - GARAGE_ROOF_T)
const TAN = Math.tan((PITCH * Math.PI) / 180)

/** Reference z → BuildApp z. */
const Z = (refZ: number): number => q(refPlanToApp({ x: 0, z: refZ }).z)

/** Main body outer rectangle (BuildApp). */
const MAIN = { minX: 0, maxX: MAIN_W, minZ: Z(DEPTH), maxZ: Z(0) } // z 1.00 .. 13.60
/** Garage outer rectangle (BuildApp). */
const GARAGE = { minX: MAIN_W, maxX: OVERALL_W, minZ: Z(DEPTH), maxZ: Z(DEPTH - GARAGE_D) } // z 1.00 .. 8.50
/** Characteristic outer planes (BuildApp). */
const FRONT_OUTER = Z(fact('recess.frontOuterPlane')) // 0
const REAR_OUTER = Z(fact('recess.rearOuterPlane')) // 14.60

/** The attic walls' nominal height: above the ridge underside so FOLLOW_ROOF decides every top. */
const RIDGE_UNDERSIDE = q(RIDGE - BUILD_UP / Math.cos((PITCH * Math.PI) / 180))
const ATTIC_NOMINAL_H = q(RIDGE_UNDERSIDE - UPPER_FFL + 0.1)
/** Height of the roof underside above the attic floor at plan x (the soffit the returns and partitions die into). */
const soffitAboveAttic = (x: number): number => KNEE + TAN * Math.min(Math.max(x, 0), Math.max(MAIN_W - x, 0))

// ---------------------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------------------

/** Evidence built from the facts an object depends on: the weakest status wins, every source is cited. */
function fromFacts(keys: readonly FactKey[], locator: string, note?: string, properties?: Record<string, EvidenceStatus>): Evidence {
  const recs = keys.map(factRecord)
  const sourceIds = [...new Set(recs.flatMap((r) => [...r.sourceIds]))] as SourceId[]
  return ev(weakest(...recs.map((r) => r.status)), sourceIds, locator, note, properties)
}

const shellEv = (locator: string, note?: string): Evidence => fromFacts(['plan.mainBodyWidth', 'plan.overallDepth', 'wall.externalThickness', 'level.upperFfl'], locator, note)

// ---------------------------------------------------------------------------
// Wall helpers: walls are stated by their centre line; the outer face follows the wall convention
// ---------------------------------------------------------------------------

type WallSpec = { id: string; start: Vec2; end: Vec2; thickness: number }
const wallRegistry = new Map<string, WallSpec>()

/**
 * A wall from its centre line `p -> q` and thickness: the outer face is the
 * centre line shifted by t/2 along the outward normal `n = (u.z, -u.x)`, so
 * material lies to the left of travel, as the wall convention requires.
 */
function wallOnCentreLine(id: string, p: Vec2, qq: Vec2, thickness: number): WallSpec {
  const L = Math.hypot(qq.x - p.x, qq.z - p.z)
  const u = { x: (qq.x - p.x) / L, z: (qq.z - p.z) / L }
  const n = { x: u.z, z: -u.x }
  const spec = { id, start: { x: q(p.x + n.x * thickness / 2), z: q(p.z + n.z * thickness / 2) }, end: { x: q(qq.x + n.x * thickness / 2), z: q(qq.z + n.z * thickness / 2) }, thickness }
  wallRegistry.set(id, spec)
  return spec
}

/** Register a ring wall (its outer line is the footprint edge) so openings can be placed on it by world coordinates. */
function registerRingWall(id: string, start: Vec2, end: Vec2, thickness: number): void {
  wallRegistry.set(id, { id, start, end, thickness })
}

/** Offset along a registered wall (from its start) of a world span `[a, b]` on the wall's axis. */
function offsetOn(wallId: string, a: number, b: number): { offset: number; width: number } {
  const w = wallRegistry.get(wallId)
  if (!w) throw new Error(`wall ${wallId} is not registered`)
  const along = (p: Vec2): number => {
    const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    const ux = (w.end.x - w.start.x) / L
    const uz = (w.end.z - w.start.z) / L
    return (p.x - w.start.x) * ux + (p.z - w.start.z) * uz
  }
  const axisX = Math.abs(w.end.z - w.start.z) < 1e-9
  const pa = axisX ? { x: a, z: w.start.z } : { x: w.start.x, z: a }
  const pb = axisX ? { x: b, z: w.start.z } : { x: w.start.x, z: b }
  const s0 = along(pa)
  const s1 = along(pb)
  return { offset: q(Math.min(s0, s1)), width: q(Math.abs(s1 - s0)) }
}

type EndJunction = { kind: 'T' | 'BUTT'; againstWallId: string } | undefined

/** An interior partition running along X at reference z `zRef` (centre), from `xFrom` to `xTo`. */
function partitionX(id: string, name: string, levelId: string, zRef: number, xFrom: number, xTo: number, thickness: number, height: number, startJ: EndJunction, endJ: EndJunction, evidence: Evidence, topProfile?: { kind: 'FOLLOW_ROOF'; roofId: string }): BuildingCommand {
  const zc = Z(zRef)
  const w = wallOnCentreLine(id, { x: xFrom, z: zc }, { x: xTo, z: zc }, thickness)
  return { type: 'createWall', id, name, levelId, start: w.start, end: w.end, thickness, height, kind: 'INTERIOR', evidence, tags: ['interior-partition'], ...(topProfile ? { topProfile } : {}), ...(startJ ? { startJunction: startJ } : {}), ...(endJ ? { endJunction: endJ } : {}) }
}

/** An interior partition running along Z at centre x, from reference z `zRefFrom` to `zRefTo` (it is stated from its BuildApp minimum z to its maximum). */
function partitionZ(id: string, name: string, levelId: string, xCentre: number, zRefFrom: number, zRefTo: number, thickness: number, height: number, startJ: EndJunction, endJ: EndJunction, evidence: Evidence, topProfile?: { kind: 'FOLLOW_ROOF'; roofId: string }): BuildingCommand {
  const [z0, z1] = refZRangeToApp(zRefFrom, zRefTo).map(q)
  const w = wallOnCentreLine(id, { x: xCentre, z: z0 }, { x: xCentre, z: z1 }, thickness)
  return { type: 'createWall', id, name, levelId, start: w.start, end: w.end, thickness, height, kind: 'INTERIOR', evidence, tags: ['interior-partition'], ...(topProfile ? { topProfile } : {}), ...(startJ ? { startJunction: startJ } : {}), ...(endJ ? { endJunction: endJ } : {}) }
}

/** A door in a registered partition, its span given on the host's world axis in reference coordinates. */
function interiorDoor(id: string, name: string, wallId: string, refFrom: number, refTo: number, connects: [string, string], hingeSide: 'LEFT' | 'RIGHT', locator: string): BuildingCommand[] {
  const w = wallRegistry.get(wallId)!
  const axisX = Math.abs(w.end.z - w.start.z) < 1e-9
  const span = axisX ? [refFrom, refTo] : refZRangeToApp(refFrom, refTo)
  const { offset, width } = offsetOn(wallId, span[0], span[1])
  const evidence = ev('SOURCE_DERIVED', [SRC.goldInterior, wallId.startsWith('g') ? SRC.groundPlan : SRC.atticPlan], locator, `connects ${connects[0]} and ${connects[1]}; head 2.00 m is an assumption — no interior opening is dimensioned vertically`, { height: 'ASSUMED' })
  return [
    { type: 'cutOpening', id, name, wallId, kind: 'DOOR', offset, sill: 0, width, height: 2.0, evidence, tags: ['interior-door', `room:${connects[0]}`, `room:${connects[1]}`] },
    { type: 'placeDoor', id: `${id}-leaf`, openingId: id, hingeSide, swing: 'IN', openAngle: 0, frameDepth: 0.1, frameInset: 0.01, materialId: 'mat-timber', evidence: ev('ASSUMED', [SRC.author], 'door furniture is not drawn') },
  ]
}

// ---------------------------------------------------------------------------
// The command stream
// ---------------------------------------------------------------------------

export function marcowkiCommands(): BuildingCommand[] {
  wallRegistry.clear()
  const out: BuildingCommand[] = []
  const push = (...c: BuildingCommand[]): void => {
    out.push(...c)
  }

  push({ type: 'setModelName', name: MARCOWKI_MODEL_NAME })
  push(...evidenceSourceCommands())

  // --- materials (appearance only; every feature below is geometry) ---
  push(
    { type: 'defineMaterial', id: 'mat-render', name: 'light render', color: '#e4e0d8', note: 'the white render of the returns, gable and side walls (renders)' },
    { type: 'defineMaterial', id: 'mat-render-dark', name: 'dark render (portal)', color: '#3b3d40', note: 'the dark render band behind the front portal and on the portal head (front elevation, VISUAL)' },
    { type: 'defineMaterial', id: 'mat-timber', name: 'timber', color: '#8a6a3d', note: 'door leaves; the flush timber cladding bands are recorded, not modelled' },
    { type: 'defineMaterial', id: 'mat-tile', name: 'roof covering', color: '#4a4b4e' },
    { type: 'defineMaterial', id: 'mat-membrane', name: 'flat roof membrane', color: '#55585c' },
    { type: 'defineMaterial', id: 'mat-concrete', name: 'concrete slab', color: '#a8a5a0' },
    { type: 'defineMaterial', id: 'mat-brick', name: 'chimney', color: '#6d6a66' },
  )

  // --- building and levels ---
  push(
    { type: 'createBuilding', id: 'marcowki', name: MARCOWKI_MODEL_NAME, note: `Reference specimen transcribed from the researched source truth; published at ${'https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca'}`, evidence: ev('SOURCE_CORROBORATED', [SRC.facts, SRC.goldShell], 'published project page and the reference gold files') },
    { type: 'createLevel', id: 'ground', name: 'Parter (ground floor)', index: 0, elevation: GROUND_FFL, height: q(UPPER_FFL - GROUND_FFL), evidence: fromFacts(['level.groundFfl', 'level.upperFfl'], 'section datums ±0,00 and +3,06') },
    { type: 'createLevel', id: 'upper', name: 'Poddasze (attic)', index: 1, elevation: UPPER_FFL, height: q(RIDGE - UPPER_FFL), evidence: fromFacts(['level.upperFfl', 'level.ridge'], 'section datums +3,06 and +7,95', 'the storey height is stated to the ridge; the attic clear height 2.66 is printed at the tall part of the room') },
  )

  // --- ground floor exterior ring: the main body on its natural footprint ---
  const mainPoly = [
    { x: MAIN.minX, z: MAIN.minZ },
    { x: MAIN.maxX, z: MAIN.minZ },
    { x: MAIN.maxX, z: MAIN.maxZ },
    { x: MAIN.minX, z: MAIN.maxZ },
  ]
  push({
    type: 'createWallRing',
    id: 'ring-ground',
    name: 'Main body, ground floor exterior ring',
    levelId: 'ground',
    polygon: mainPoly,
    thickness: T,
    height: q(UPPER_FFL - GROUND_FFL),
    materialId: 'mat-render',
    evidence: shellEv('plan chains 790 and 1260; wall build-up 25 + 20', 'walls run to the +3,06 slab top'),
    walls: [
      { id: 'g-front', name: 'Ground front wall (recessed, behind the portal)', materialId: 'mat-render-dark', evidence: fromFacts(['plan.mainBodyWidth', 'recess.frontBackPlane'], 'front wall face at the end of the printed 1260; its dark render is VISUAL', undefined, { materialId: 'VISUAL_INFERRED' }) },
      { id: 'g-right', name: 'Ground east wall (shared with the garage)', evidence: fromFacts(['plan.overallDepth', 'wall.externalThickness'], 'one 0.45 m wall in both plans and the section; the garage interior 7.90..11.60 confirms a single leaf') },
      { id: 'g-rear', name: 'Ground rear wall (recessed, behind the loggia)', evidence: fromFacts(['plan.mainBodyWidth', 'recess.rearBackPlane'], 'rear wall face at the start of the printed 1260') },
      { id: 'g-left', name: 'Ground west wall', evidence: fromFacts(['plan.overallDepth', 'wall.externalThickness'], 'west outer face x = 0') },
    ],
  })
  registerRingWall('g-front', mainPoly[0], mainPoly[1], T)
  registerRingWall('g-right', mainPoly[1], mainPoly[2], T)
  registerRingWall('g-rear', mainPoly[2], mainPoly[3], T)
  registerRingWall('g-left', mainPoly[3], mainPoly[0], T)

  // --- garage wing: three walls on the natural footprint, attached to the main body's east wall ---
  const garageEv = fromFacts(['plan.garageWidth', 'plan.garageDepth', 'garage.clearHeight', 'garage.roofThickness'], 'plan chains 415 and 750; walls to the flat roof underside 2.54 (printed 252 + slab)')
  push(
    { type: 'createWall', id: 'gar-front', name: 'Garage front wall', levelId: 'ground', start: { x: GARAGE.minX, z: GARAGE.minZ }, end: { x: GARAGE.maxX, z: GARAGE.minZ }, thickness: T, height: GARAGE_WALL_TOP, materialId: 'mat-render', evidence: garageEv },
    { type: 'createWall', id: 'gar-right', name: 'Garage east wall', levelId: 'ground', start: { x: GARAGE.maxX, z: GARAGE.minZ }, end: { x: GARAGE.maxX, z: GARAGE.maxZ }, thickness: T, height: GARAGE_WALL_TOP, materialId: 'mat-render', evidence: garageEv, startJunction: { kind: 'CORNER', with: { wallId: 'gar-front', end: 'END' }, owner: 'OTHER' } },
    { type: 'createWall', id: 'gar-rear', name: 'Garage north wall', levelId: 'ground', start: { x: GARAGE.maxX, z: GARAGE.maxZ }, end: { x: GARAGE.minX, z: GARAGE.maxZ }, thickness: T, height: GARAGE_WALL_TOP, materialId: 'mat-render', evidence: fromFacts(['plan.rearZoneToGarage', 'plan.garageWidth'], 'the 510 | 750 split of the printed 1260 puts the garage north wall at reference z 5.10'), startJunction: { kind: 'CORNER', with: { wallId: 'gar-right', end: 'END' }, owner: 'SELF' }, endJunction: { kind: 'T', againstWallId: 'g-right' } },
  )
  registerRingWall('gar-front', { x: GARAGE.minX, z: GARAGE.minZ }, { x: GARAGE.maxX, z: GARAGE.minZ }, T)
  registerRingWall('gar-right', { x: GARAGE.maxX, z: GARAGE.minZ }, { x: GARAGE.maxX, z: GARAGE.maxZ }, T)
  registerRingWall('gar-rear', { x: GARAGE.maxX, z: GARAGE.maxZ }, { x: GARAGE.minX, z: GARAGE.maxZ }, T)

  // --- attic exterior ring: the same footprint; every top follows the main roof ---
  push({
    type: 'createWallRing',
    id: 'ring-upper',
    name: 'Attic exterior ring',
    levelId: 'upper',
    polygon: mainPoly,
    thickness: T,
    height: ATTIC_NOMINAL_H,
    materialId: 'mat-render',
    evidence: fromFacts(['wall.kneeWall', 'level.ridge', 'roof.buildUp'], 'attic plan outer walls at x 47..345 and z 195..671 px = the main body footprint; side walls to the printed 130 knee wall, gable ends to the roof underside'),
    walls: [
      { id: 'u-front', name: 'Attic front gable wall' },
      { id: 'u-right', name: 'Attic east eave wall (knee wall)' },
      { id: 'u-rear', name: 'Attic rear gable wall' },
      { id: 'u-left', name: 'Attic west eave wall (knee wall)' },
    ],
  })
  registerRingWall('u-front', mainPoly[0], mainPoly[1], T)
  registerRingWall('u-right', mainPoly[1], mainPoly[2], T)
  registerRingWall('u-rear', mainPoly[2], mainPoly[3], T)
  registerRingWall('u-left', mainPoly[3], mainPoly[0], T)

  // --- the characteristic zones: wall returns down the sides of the two recesses ---
  const rf0 = fact('recess.frontFromX') // 0.61
  const rf1 = fact('recess.frontToX') // 11.44
  const rr0 = fact('recess.rearFromX') // 0.61
  const rr1 = fact('recess.rearToX') // 7.29
  const returnEv = (locator: string, note?: string): Evidence => fromFacts(['wall.returnThickness', 'recess.frontOuterPlane', 'recess.rearOuterPlane'], locator, note)
  const westFront = wallOnCentreLine('ret-west-front', { x: rf0 / 2, z: MAIN.minZ }, { x: rf0 / 2, z: FRONT_OUTER }, TR)
  const eastFront = wallOnCentreLine('ret-east-front', { x: MAIN_W - TR / 2, z: FRONT_OUTER }, { x: MAIN_W - TR / 2, z: MAIN.minZ }, TR)
  const garageFront = wallOnCentreLine('ret-garage-front', { x: OVERALL_W - TR / 2, z: FRONT_OUTER }, { x: OVERALL_W - TR / 2, z: GARAGE.minZ }, TR)
  const westRear = wallOnCentreLine('ret-west-rear', { x: rr0 / 2, z: REAR_OUTER }, { x: rr0 / 2, z: MAIN.maxZ }, TR)
  const eastRear = wallOnCentreLine('ret-east-rear', { x: MAIN_W - TR / 2, z: MAIN.maxZ }, { x: MAIN_W - TR / 2, z: REAR_OUTER }, TR)
  const eastFrontBase = fact('return.eastFrontBase')
  push(
    { type: 'createWall', id: westFront.id, name: 'West return, front recess', levelId: 'ground', start: westFront.start, end: westFront.end, thickness: TR, height: q(soffitAboveAttic(rf0) + UPPER_FFL + 0.2), materialId: 'mat-render', tags: ['return', 'front-zone'], evidence: returnEv('ground plan ink x 0.000..0.636 at z 12.8/13.1/13.4; attic plan x 0.000..0.609; runs the full height into the roof soffit'), startJunction: { kind: 'BUTT', againstWallId: 'g-front' } },
    { type: 'createWall', id: eastFront.id, name: 'East return, front recess (above the balcony)', levelId: 'upper', start: eastFront.start, end: eastFront.end, thickness: TR, baseOffset: q(eastFrontBase - UPPER_FFL), height: q(soffitAboveAttic(MAIN_W - TR) + UPPER_FFL - eastFrontBase + 0.2), materialId: 'mat-render', tags: ['return', 'front-zone'], evidence: fromFacts(['wall.returnThickness', 'return.eastFrontBase'], 'attic plan ink x 7.259..7.895 at z 12.8/13.1/13.4 where the ground plan has none: this return stands on the balcony slab'), endJunction: { kind: 'BUTT', againstWallId: 'u-front' } },
    { type: 'createWall', id: garageFront.id, name: 'Garage east return, front recess', levelId: 'ground', start: garageFront.start, end: garageFront.end, thickness: TR, height: fact('return.garageTop'), materialId: 'mat-render-dark', tags: ['return', 'front-zone'], evidence: fromFacts(['wall.returnThickness', 'return.garageTop'], 'ground plan ink x 11.441..12.050; top at the dark band 3.08 (front elevation)'), endJunction: { kind: 'BUTT', againstWallId: 'gar-front' } },
    { type: 'createWall', id: westRear.id, name: 'West return, rear loggia', levelId: 'ground', start: westRear.start, end: westRear.end, thickness: TR, height: q(soffitAboveAttic(rr0) + UPPER_FFL + 0.2), materialId: 'mat-render', tags: ['return', 'rear-zone'], evidence: returnEv('both plans: ink x 0.000..0.636 at z −0.3/−0.6/−0.9'), endJunction: { kind: 'BUTT', againstWallId: 'g-rear' } },
    { type: 'createWall', id: eastRear.id, name: 'East return, rear loggia', levelId: 'ground', start: eastRear.start, end: eastRear.end, thickness: TR, height: q(soffitAboveAttic(MAIN_W - TR) + UPPER_FFL + 0.2), materialId: 'mat-render', tags: ['return', 'rear-zone'], evidence: returnEv('both plans: ink x 7.283..7.892 (ground) / 7.259..7.895 (attic) at z −0.3/−0.6/−0.9'), startJunction: { kind: 'BUTT', againstWallId: 'g-rear' } },
  )

  // --- slabs ---
  const inner = { minX: MAIN.minX + T, maxX: MAIN.maxX - T, minZ: MAIN.minZ + T, maxZ: MAIN.maxZ - T }
  const voidRect = { minX: 5.37, maxX: 7.45, ...(() => { const [a, b] = refZRangeToApp(6.79, 8.77).map(q); return { minZ: a, maxZ: b } })() }
  push(
    {
      type: 'createSlab',
      id: 'slab-ground',
      name: 'Ground slab (plinth to terrain)',
      levelId: 'ground',
      polygon: [
        { x: MAIN.minX, z: MAIN.minZ },
        { x: GARAGE.maxX, z: MAIN.minZ },
        { x: GARAGE.maxX, z: GARAGE.maxZ },
        { x: MAIN.maxX, z: GARAGE.maxZ },
        { x: MAIN.maxX, z: MAIN.maxZ },
        { x: MAIN.minX, z: MAIN.maxZ },
      ],
      topOffset: 0,
      thickness: q(GROUND_FFL - fact('level.terrain')),
      materialId: 'mat-concrete',
      evidence: fromFacts(['level.terrain', 'level.groundFfl'], 'the L footprint of the printed chains; depth = the plinth to the −0,32 terrain datum', 'the slab build-up is not drawn; the plinth height is what is modelled', { thickness: 'GEOMETRIC_INFERRED' }),
    },
    {
      type: 'createSlab',
      id: 'slab-upper',
      name: 'Upper floor slab (bearing rectangle, stair void)',
      levelId: 'upper',
      // the bearing rectangle inside the walls, notched by the stair void, which abuts the east inner face
      polygon: [
        { x: inner.minX, z: inner.minZ },
        { x: inner.maxX, z: inner.minZ },
        { x: inner.maxX, z: voidRect.minZ },
        { x: voidRect.minX, z: voidRect.minZ },
        { x: voidRect.minX, z: voidRect.maxZ },
        { x: inner.maxX, z: voidRect.maxZ },
        { x: inner.maxX, z: inner.maxZ },
        { x: inner.minX, z: inner.maxZ },
      ],
      topOffset: 0,
      thickness: SLAB_T,
      materialId: 'mat-concrete',
      evidence: fromFacts(['slab.upperThickness', 'level.upperFfl', 'wall.externalThickness'], 'section: one solid from the outer face inwards at +3,06, so the plate is the bearing rectangle inside the 0.45 m walls; the void x 5.37..7.45, reference z 6.79..8.77, is the stair shaft the section finds at X 5.351..7.441', 'the void reaches the east inner face, so it is a notch in the plate outline, not a hole'),
    },
  )

  // --- roofs (caps the walls that die into them) ---
  push(
    {
      type: 'createRoof',
      id: 'roof-main',
      name: 'Main gable roof, 40°',
      levelId: 'upper',
      kind: 'GABLE',
      footprint: { minX: MAIN.minX, maxX: MAIN.maxX, minZ: Z(fact('roof.extentFront')), maxZ: Z(fact('roof.extentRear')) },
      eaveOffset: q(EAVE - UPPER_FFL),
      pitchDeg: PITCH,
      ridgeAxis: 'Z',
      overhang: fact('roof.overhang'),
      thickness: BUILD_UP,
      materialId: 'mat-tile',
      capWallIds: ['u-front', 'u-right', 'u-rear', 'u-left', westFront.id, eastFront.id, westRear.id, eastRear.id],
      evidence: fromFacts(['roof.pitch', 'level.ridge', 'level.eave', 'roof.buildUp', 'roof.extentFront', 'roof.extentRear'], 'section: printed 40°, +7,95 ridge; eave plane derived 4.63556 (printed +4,67 recorded beside it); the roof runs over both recesses, reference z −1.00..13.60'),
    },
    {
      type: 'createRoof',
      id: 'roof-garage',
      name: 'Garage flat roof',
      levelId: 'ground',
      kind: 'FLAT',
      footprint: { ...GARAGE },
      eaveOffset: GARAGE_ROOF_TOP,
      overhang: 0,
      thickness: GARAGE_ROOF_T,
      materialId: 'mat-membrane',
      capWallIds: ['gar-front', 'gar-right', 'gar-rear'],
      evidence: fromFacts(['garage.roofTop', 'garage.roofThickness'], 'section: garage roof fill rows 433..458; soffit on the printed 252', 'the ~0.2 m parapet upstand the elevations show is not modelled'),
    },
  )

  // --- balconies, portal head, railings ---
  const balconyTop = fact('balcony.top')
  const balconyT = fact('balcony.thickness')
  push(
    { type: 'createBalcony', id: 'balcony-front', name: 'Front balcony slab', levelId: 'upper', kind: 'BALCONY', footprint: { minX: fact('balcony.frontFromX'), maxX: fact('balcony.frontToX'), minZ: FRONT_OUTER, maxZ: MAIN.minZ }, topOffset: q(balconyTop - UPPER_FFL), thickness: balconyT, materialId: 'mat-render-dark', tags: ['front-zone'], evidence: fromFacts(['balcony.frontFromX', 'balcony.frontToX', 'balcony.top', 'balcony.thickness'], 'attic plan balcony floor from the 0.026 m edge line at x 3.338 to the east return it carries; top and thickness from the rear elevation fascia 2.41..2.96', undefined, { minX: 'SOURCE_DERIVED', topOffset: 'VISUAL_INFERRED', thickness: 'VISUAL_INFERRED' }) },
    { type: 'createBalcony', id: 'balcony-rear', name: 'Rear balcony slab (over the loggia)', levelId: 'upper', kind: 'BALCONY', footprint: { minX: rr0, maxX: rr1, minZ: MAIN.maxZ, maxZ: REAR_OUTER }, topOffset: q(balconyTop - UPPER_FFL), thickness: balconyT, materialId: 'mat-render-dark', tags: ['rear-zone'], evidence: fromFacts(['recess.rearFromX', 'recess.rearToX', 'balcony.top', 'balcony.thickness'], 'attic plan balcony floor between the two rear returns; rear elevation fascia continuous x 0.647..7.254 at y 2.60', undefined, { topOffset: 'VISUAL_INFERRED', thickness: 'VISUAL_INFERRED' }) },
    { type: 'createSlab', id: 'portal-head', name: 'Portal head over the entrance and garage door', levelId: 'ground', polygon: [{ x: MAIN_W, z: FRONT_OUTER }, { x: rf1, z: FRONT_OUTER }, { x: rf1, z: MAIN.minZ }, { x: MAIN_W, z: MAIN.minZ }], topOffset: fact('portal.headTop'), thickness: fact('portal.headThickness'), materialId: 'mat-render-dark', tags: ['portal', 'front-zone'], evidence: fromFacts(['portal.headTop', 'portal.headThickness', 'recess.frontToX'], 'the dark band over the entrance and the garage door: front elevation 3.081 / 3.097, soffit at the balcony soffit 2.41; it stops at x 11.44 so the garage return carries it') },
  )
  const railEv = (locator: string): Evidence => fromFacts(['railing.height', 'balcony.top'], locator, 'posts are the plan marks; BuildApp spaces them equally over the measured run', { postSpacing: 'SOURCE_DERIVED', height: 'VISUAL_INFERRED' })
  push(
    { type: 'createRailing', id: 'rail-front', name: 'Front balcony glass balustrade', levelId: 'upper', start: { x: fact('railing.frontFromX'), z: Z(fact('railing.frontLine')) }, end: { x: fact('railing.frontToX'), z: Z(fact('railing.frontLine')) }, baseOffset: q(balconyTop - UPPER_FFL), height: fact('railing.height'), postSpacing: 0.93, infill: 'GLASS', hostId: 'balcony-front', tags: ['front-zone'], evidence: railEv('attic plan post marks at z 13.55: x 3.444..7.153, four equal 0.821 m panels; front elevation glass 3.13..3.89') },
    { type: 'createRailing', id: 'rail-rear', name: 'Rear balcony glass balustrade', levelId: 'upper', start: { x: fact('railing.rearFromX'), z: Z(fact('railing.rearLine')) }, end: { x: fact('railing.rearToX'), z: Z(fact('railing.rearLine')) }, baseOffset: q(balconyTop - UPPER_FFL), height: fact('railing.height'), postSpacing: 1.62, infill: 'GLASS', hostId: 'balcony-rear', tags: ['rear-zone'], evidence: railEv('attic plan post marks at z −0.88: x 0.689..7.153, four 1.48..1.51 m panels; rear elevation glass top 3.85') },
  )

  // --- chimneys and their roof penetrations ---
  const chimneyEv = (locator: string, status: EvidenceStatus): Evidence => ev(status, [SRC.atticPlan, SRC.elevEast, SRC.elevFront, SRC.goldRoof], locator, 'top 7.88 is VISUAL (cap 0.07 m below the ridge); shafts below the attic floor are not modelled', { height: 'VISUAL_INFERRED' })
  const chimneyH = q(fact('chimney.top') - fact('chimney.base'))
  const salon = { minX: 5.5, maxX: 6.11, ...(() => { const [a, b] = refZRangeToApp(4.42, 5.03).map(q); return { minZ: a, maxZ: b } })() }
  const boiler = { minX: 5.484, maxX: 6.0, ...(() => { const [a, b] = refZRangeToApp(8.9, 9.452).map(q); return { minZ: a, maxZ: b } })() }
  push(
    { type: 'placeChimney', id: 'chimney-salon', name: 'Salon fireplace stack', levelId: 'upper', footprint: salon, baseOffset: 0, height: chimneyH, materialId: 'mat-brick', evidence: chimneyEv('attic plan block x 5.484..6.093, z 4.417..5.027 (0.61 × 0.61); east elevation stack at z 4.415..5.043', 'SOURCE_CORROBORATED') },
    { type: 'cutRoofOpening', id: 'pen-salon', name: 'Roof penetration, salon stack', roofId: 'roof-main', kind: 'PENETRATION', footprint: salon, throughId: 'chimney-salon', evidence: ev('ASSUMED', [SRC.goldRoof, SRC.author], 'the roof is cut to the stack itself: flashing and clearance are drawn nowhere') },
    { type: 'placeChimney', id: 'chimney-boiler', name: 'Kotłownia flue stack', levelId: 'upper', footprint: boiler, baseOffset: 0, height: chimneyH, materialId: 'mat-brick', evidence: chimneyEv('attic plan solid ink px 254..273 × 531..551 = x 5.484..6.000, z 8.900..9.452; east elevation stack at z 8.931..9.508', 'SOURCE_DERIVED') },
    { type: 'cutRoofOpening', id: 'pen-boiler', name: 'Roof penetration, kotłownia stack', roofId: 'roof-main', kind: 'PENETRATION', footprint: boiler, throughId: 'chimney-boiler', evidence: ev('ASSUMED', [SRC.goldRoof, SRC.author], 'cut to the stack itself, clearance zero') },
  )

  // --- rooflights: three 78/118 units, cut as the vertical prism over their plan rectangle ---
  const rlW = fact('rooflight.width')
  const rlCross = q(fact('rooflight.slopeLength') * Math.cos((PITCH * Math.PI) / 180))
  const rlIn = fact('rooflight.lowerEdgeFromEave')
  const rooflight = (id: string, name: string, side: 'WEST' | 'EAST', refCentreZ: number, roomBelow: string, locator: string): BuildingCommand[] => {
    const zc = Z(refCentreZ)
    const footprint = side === 'WEST' ? { minX: rlIn, maxX: q(rlIn + rlCross), minZ: q(zc - rlW / 2), maxZ: q(zc + rlW / 2) } : { minX: q(MAIN_W - rlIn - rlCross), maxX: q(MAIN_W - rlIn), minZ: q(zc - rlW / 2), maxZ: q(zc + rlW / 2) }
    const evidence = fromFacts(['rooflight.width', 'rooflight.slopeLength', 'rooflight.lowerEdgeFromEave'], locator, `over ${roomBelow}; the 1.18 m slope length projects to ${rlCross} m in plan; the cut is a vertical prism with no clearance (a stated simplification)`, { footprint: 'SOURCE_DERIVED' })
    return [
      { type: 'cutRoofOpening', id, name, roofId: 'roof-main', kind: 'ROOFLIGHT', footprint, evidence, tags: [`room:${roomBelow}`] },
      { type: 'placeRooflight', id: `${id}-unit`, roofOpeningId: id, frameWidth: 0.07, glassThickness: 0.024, evidence: ev('VISUAL_INFERRED', [SRC.elevWest, SRC.goldRoof], 'glazed area about 0.65 across a 0.78 frame and 1.04 up a 1.18 one: 0.065..0.070 m of frame per side') },
    ]
  }
  push(
    ...rooflight('rl-pralnia-w', 'Rooflight, west slope over the laundry', 'WEST', 6.008, 'u-pralnia', 'attic plan dashed symbol py 407..437 = z 5.610..6.405, centre 6.008; west elevation glazed patch centre 5.978'),
    ...rooflight('rl-lazienka-w', 'Rooflight, west slope over the bathroom', 'WEST', 8.167, 'u-bathroom', 'attic plan symbol py 488.8..518.2 = z 7.777..8.556, centre 8.167; west elevation glazed patch centre 8.185'),
    ...rooflight('rl-schody-e', 'Rooflight, east slope over the stair', 'EAST', 8.167, 'u-stairs', 'attic plan symbol py 489..518 = z 7.783..8.551, centre 8.167; east elevation glazed patch centre 8.167'),
  )

  // --- the twelve facade openings, every one a structural hole in its host leaf ---
  const facadeEv = (status: EvidenceStatus, sources: readonly SourceId[], locator: string, note?: string, properties?: Record<string, EvidenceStatus>): Evidence => ev(status, [...sources, SRC.goldFacade], locator, note, properties)
  const glazing = (id: string, name: string, wallId: string, offset: number, width: number, sill: number, height: number, roomId: string, evidence: Evidence, mullions: number[] | undefined, headFar?: number, tags: string[] = []): BuildingCommand[] => [
    { type: 'cutOpening', id, name, wallId, kind: 'WINDOW', offset, sill, width, height, ...(headFar !== undefined ? { head: { kind: 'RAKED', heightFar: headFar } } : {}), evidence, tags: [`room:${roomId}`, 'facade', ...tags] },
    { type: 'placeWindow', id: `${id}-glazing`, openingId: id, frameWidth: 0.07, frameDepth: 0.08, frameInset: 0.12, glassThickness: 0.024, divisions: 1, ...(mullions ? { mullions } : {}), evidence: ev(mullions ? 'VISUAL_INFERRED' : 'ASSUMED', mullions ? [SRC.elevFront, SRC.elevRear, SRC.elevEast, SRC.goldFacade] : [SRC.author], mullions ? 'mullion breaks read on the elevations' : 'frame profile is not drawn') },
  ]
  const door = (id: string, name: string, wallId: string, offset: number, width: number, height: number, roomId: string, evidence: Evidence, hingeSide: 'LEFT' | 'RIGHT', extra: Record<string, unknown> = {}, tags: string[] = []): BuildingCommand[] => [
    { type: 'cutOpening', id, name, wallId, kind: 'DOOR', offset, sill: 0, width, height, evidence, tags: [`room:${roomId}`, 'facade', ...tags] },
    { type: 'placeDoor', id: `${id}-leaf`, openingId: id, hingeSide, swing: 'IN', openAngle: 0, materialId: 'mat-timber', evidence: ev('ASSUMED', [SRC.author], 'leaf as one panel; sidelights, panels and glazing of leaves are not modelled'), ...extra },
  ]
  const gableFar = q(3.2 - 2.7 * TAN) // 0.93443
  const rearGableLow = q(3.03 - 2.34 * TAN) // 1.0634
  push(
    ...glazing('og-front-room-window', 'Front room window 110/230', 'g-front', 1.397, 1.1, 0, 2.3, 'g-room', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevFront], 'printed 110/230; centred on the measured gap x 1.377..2.516; front elevation glass 1.50..2.33, head 2.29'), undefined),
    ...door('og-front-entrance', 'Entrance door 105/210', 'g-front', 4.176, 1.05, 2.1, 'g-entry', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevFront, SRC.renderHero], 'printed 105/210; centred on the measured gap x 4.158..5.244; front elevation leaf x 4.196..5.174', 'the hero render shows one leaf with a narrow glazed sidelight; modelled as one leaf'), 'LEFT'),
    ...glazing('og-east-living-window', 'East living glazing 300/230', 'g-right', 8.704, 3.0, 0, 2.3, 'g-salon', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevEast], 'printed 300/230; centred on the measured gap reference z 0.874..3.918; east elevation z 0.884..3.906'), [0.5]),
    ...door('og-east-garage-door', 'Kotłownia / garage door (concealed)', 'g-right', 1.216, 0.93, 2.1, 'g-boiler', facadeEv('SOURCE_DERIVED', [SRC.groundPlan, SRC.goldInterior], 'the 10.456..11.382 gap in the column scans at x 7.6 and 7.75, straight through the one 0.45 m house/garage wall', 'head 2.10 is an assumption matching every other single door; concealed by the garage, counted on no elevation. The reference cut it through two abutting leaves because it had no shared-wall semantics; the drawings show one wall, which the T-junction models', { height: 'ASSUMED' }), 'RIGHT', {}, ['concealed', 'room:g-garage']),
    ...glazing('og-rear-living-glazing', 'Rear living glazing 470/230', 'g-rear', 0.942, 4.7, 0, 2.3, 'g-salon', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevRear], 'printed 470/230; centred on the measured gap x 2.251..6.965; rear elevation glass x 2.12..6.90, central mullion at 4.63, head 2.285'), [0.5]),
    ...glazing('og-west-living-window', 'West living window 90/230', 'g-left', 3.653, 0.9, 0, 2.3, 'g-salon', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevWest], 'printed 90/230; measured gap reference z 3.653..4.553; west elevation z 3.635..4.568, head 2.38'), undefined),
    ...glazing('og-west-kitchen-window', 'West kitchen window 140/140', 'g-left', 5.402, 1.4, 0.9, 1.4, 'g-kitchen', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevWest], 'printed 140/140; measured gap reference z 5.400..6.803; west elevation sill 0.93 and head 2.29 fix the sill at 0.90'), undefined),
    ...door('og-garage-door', 'Garage door 275/225', 'gar-front', 0.656, 2.75, 2.25, 'g-garage', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevFront], 'printed 275/225; centred on the measured gap x 8.554..11.308; front elevation reveal x 8.470..11.303, head 2.270', 'the render shows the door rolled up; the structural opening is the whole 275/225 and it is filled with one leaf'), 'LEFT', { leafThickness: 0.05, frameWidth: 0.08 }),
    ...door('og-garage-side-door', 'Garage side door 100/210', 'gar-rear', 1.128, 1.0, 2.1, 'g-garage', facadeEv('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.elevRear], 'printed 100/210; centred on the measured gap x 9.905..10.938; rear elevation glazed leaf x 9.893..10.914, head 2.05'), 'LEFT'),
    ...glazing('og-front-gable-glazing', 'Front gable glazing 270/320, raked head', 'u-front', 3.94, 2.7, 0, 3.2, 'u-pokoj-s', facadeEv('SOURCE_EXACT', [SRC.atticPlan, SRC.elevFront, SRC.goldShell], 'printed 270/320 on the attic plan; offset 3.94 = 149 px from the west outer face; head raked parallel to the roof: 3.20 at the ridge side, 3.20 − 2.70 × tan 40° = 0.93443 at the far edge', 'a door onto the terrace over the garage: sill at the attic floor; the elevation render places the head ≈0.35 m lower than the callout — the callout is preferred', { offset: 'SOURCE_DERIVED', head: 'SOURCE_CORROBORATED' }), [0.374], gableFar, ['raked']),
    ...glazing('og-rear-gable-east', 'Rear gable glazing, east 234/303, raked head', 'u-rear', 0.97, 2.34, 0, rearGableLow, 'u-pokoj-ne', facadeEv('SOURCE_CORROBORATED', [SRC.atticPlan, SRC.elevRear], 'printed 234/303; centred on the measured gap x 4.583..6.941; head 3.03 at the ridge side falling to 1.0634 at the eave side, a constant 1.05 m under the roof; rear elevation glass reaches x 6.538 / 5.72 / 4.887 at y 4.30 / 5.00 / 5.70', undefined, { head: 'SOURCE_DERIVED' }), [0.573], 3.03, ['raked']),
    ...glazing('og-rear-gable-west', 'Rear gable glazing, west 234/303, raked head', 'u-rear', 4.62, 2.34, 0, 3.03, 'u-pokoj-nw', facadeEv('SOURCE_CORROBORATED', [SRC.atticPlan, SRC.elevRear], 'printed 234/303; centred on the measured gap x 0.927..3.285; the mirror of the east window about the ridge; rear elevation mullion at x 2.33', undefined, { head: 'SOURCE_DERIVED' }), [0.406], rearGableLow, ['raked']),
  )

  // --- interior partitions, ground floor (to the slab underside 2.73) ---
  const gH = q(UPPER_FFL - SLAB_T)
  const gEv = (status: EvidenceStatus, locator: string): Evidence => ev(status, [SRC.groundPlan, SRC.goldInterior], locator, 'height to the slab underside 3.06 − 0.33 = 2.73')
  push(
    partitionX('gw-kitchen-south', 'Kitchen south partition', 'ground', 7.3, 0.45, 4.11, TP, gH, { kind: 'T', againstWallId: 'g-left' }, undefined, gEv('SOURCE_CORROBORATED', 'raster z 7.253..7.359; the west chain closes 0.45 + 4.14 + 2.65 = 7.24 on its north face; free east end at x 4.105')),
    partitionX('gw-bath-south', 'Bathroom south partition', 'ground', 8.84, 0.45, 3.48, TP, gH, { kind: 'T', againstWallId: 'g-left' }, undefined, gEv('SOURCE_CORROBORATED', 'raster z 8.815..8.894, x 0.00..3.469; the west chain closes 7.36 + 1.42 = 8.78 on its north face')),
    partitionZ('gw-bath-east', 'Bathroom east partition', 'ground', 3.42, 7.36, 8.78, TP, gH, { kind: 'BUTT', againstWallId: 'gw-bath-south' }, { kind: 'T', againstWallId: 'gw-kitchen-south' }, gEv('SOURCE_DERIVED', 'raster x 3.363..3.469 at z 7.6; column scan at x 3.42 shows the two jambs of the bathroom door')),
    partitionZ('gw-room-east', 'Front room east partition', 'ground', 3.42, 8.9, 12.15, TP, gH, { kind: 'T', againstWallId: 'g-front' }, { kind: 'BUTT', againstWallId: 'gw-bath-south' }, gEv('SOURCE_CORROBORATED', 'raster x 3.363..3.469, z 9.926..12.600; the south chain closes 0.45 + 2.90 = 3.35 on its west face')),
    partitionZ('gw-boiler-west', 'Kotłownia west partition', 'ground', 5.43, 9.03, 12.15, TP, gH, { kind: 'T', againstWallId: 'g-front' }, undefined, gEv('SOURCE_CORROBORATED', 'raster x 5.376..5.482, z 8.815..10.456 and 11.382..12.600; the south chain closes 0.45 + 2.90 + 0.12 + 1.90 = 5.37 on its west face')),
    partitionX('gw-entry-north', 'Wiatrołap north partition', 'ground', 10.07, 3.48, 5.37, TP, gH, { kind: 'T', againstWallId: 'gw-room-east' }, { kind: 'T', againstWallId: 'gw-boiler-west' }, gEv('SOURCE_CORROBORATED', 'raster z 10.032..10.112; the printed 203 closes 12.15 − 2.03 = 10.12 on its south face')),
    partitionX('gw-boiler-north', 'Kotłownia north wall (0.26 m)', 'ground', 8.9, 5.37, 7.45, fact('wall.boilerNorthThickness'), gH, undefined, { kind: 'T', againstWallId: 'g-right' }, gEv('SOURCE_CORROBORATED', 'raster z 8.788..9.026 at three columns, 0.24 m thick; the printed 312 closes 12.15 − 3.12 = 9.03 on its south face')),
    partitionX('gw-pantry-north', 'Pantry north partition', 'ground', 4.97, 5.37, 7.45, TP, gH, undefined, { kind: 'T', againstWallId: 'g-right' }, gEv('SOURCE_CORROBORATED', 'raster z 4.950..5.082; the printed 446 closes 0.45 + 4.46 = 4.91 on its north face (the raster is 1.5 px lower; the chain is taken)')),
    partitionX('gw-pantry-south', 'Pantry south partition', 'ground', 6.22, 5.37, 6.44, TP, gH, undefined, undefined, gEv('SOURCE_DERIVED', 'raster z 6.168..6.274, x 5.403..6.435; its east end is free — the pantry corner is open to the stair')),
    partitionZ('gw-pantry-west', 'Pantry west partition', 'ground', 5.43, 5.03, 6.16, TP, gH, { kind: 'BUTT', againstWallId: 'gw-pantry-south' }, { kind: 'BUTT', againstWallId: 'gw-pantry-north' }, gEv('SOURCE_DERIVED', 'raster x 5.376..5.482; column scan at x 5.43 shows the two jambs of the pantry door')),
  )
  // the boiler-west partition meets the boiler-north wall's south face; declared after both exist
  push({ type: 'createWallJunction', id: 'gw-boiler-west-j-end', kind: 'BUTT', wall: { wallId: 'gw-boiler-west', end: 'END' }, againstWallId: 'gw-boiler-north', evidence: ev('SOURCE_CORROBORATED', [SRC.groundPlan, SRC.goldInterior], 'the partition stops at the 0.26 m wall') })

  // --- interior partitions, attic (capped at 2.60 where the roof is higher, the soffit where it is not) ---
  const uH = 2.6
  const follow = { kind: 'FOLLOW_ROOF' as const, roofId: 'roof-main' }
  const uEv = (status: EvidenceStatus, locator: string): Evidence => ev(status, [SRC.atticPlan, SRC.goldInterior], locator, 'capped at 2.60 above the attic floor where the roof is higher (an assumption: the plans dimension the knee wall and the ridge, not the ceiling line); follows the roof underside where it is lower', { height: 'ASSUMED' })
  push(
    partitionX('uw-corridor-south', 'Corridor south partition', 'upper', 8.84, 3.35, 7.45, TP, uH, undefined, { kind: 'T', againstWallId: 'u-right' }, uEv('SOURCE_CORROBORATED', 'raster z 8.790..8.896; the printed 325 depth of the south Pokój closes 12.15 − 3.25 = 8.90 on its south face'), follow),
    partitionZ('uw-corridor-west', 'Corridor west partition', 'upper', 3.95, 0.45, 8.78, TP, uH, { kind: 'T', againstWallId: 'uw-corridor-south' }, { kind: 'T', againstWallId: 'u-rear' }, uEv('SOURCE_CORROBORATED', 'raster x 3.894..3.974; the north chain closes 0.45 + 3.44 = 3.89 on its west face; column scan at x 3.9 shows the three door jambs'), follow),
    partitionX('uw-pokoj-ne-south', 'North-east Pokój south partition', 'upper', 3.76, 4.01, 5.28, TP, uH, { kind: 'T', againstWallId: 'uw-corridor-west' }, undefined, uEv('SOURCE_CORROBORATED', 'raster z 3.702..3.781; the printed 325 closes 0.45 + 3.25 = 3.70 on its north face'), follow),
    partitionX('uw-stair-north', 'Stair north partition', 'upper', 5.09, 5.16, 7.45, TP, uH, undefined, { kind: 'T', againstWallId: 'u-right' }, uEv('SOURCE_DERIVED', 'raster z 5.027..5.133 at x 6.5 and 7.0, x 5.166..7.895'), follow),
    partitionZ('uw-garderoba-ne-west', 'North-east Garderoba west partition', 'upper', 5.22, 3.82, 5.03, TP, uH, { kind: 'BUTT', againstWallId: 'uw-stair-north' }, { kind: 'BUTT', againstWallId: 'uw-pokoj-ne-south' }, uEv('SOURCE_CORROBORATED', 'raster x 5.166..5.272 at z 3.85 and 4.3; the printed 217 closes 7.45 − 2.17 = 5.28 on its east face'), follow),
    partitionX('uw-pokoj-nw-south', 'North-west Pokój south partition', 'upper', 5.0, 0.45, 3.89, TP, uH, { kind: 'T', againstWallId: 'u-left' }, { kind: 'T', againstWallId: 'uw-corridor-west' }, uEv('SOURCE_CORROBORATED', 'raster z 4.947..5.027; the west chain closes 0.45 + 4.49 = 4.94 on its north face'), follow),
    partitionX('uw-pralnia-south', 'Pralnia south partition', 'upper', 7.14, 0.45, 3.89, TP, uH, { kind: 'T', againstWallId: 'u-left' }, { kind: 'T', againstWallId: 'uw-corridor-west' }, uEv('SOURCE_CORROBORATED', 'raster z 7.094..7.173; the west chain closes 5.06 + 2.02 = 7.08 on its north face'), follow),
    partitionZ('uw-room2-west', 'South Pokój west partition', 'upper', 3.41, 8.9, 12.15, TP, uH, { kind: 'T', againstWallId: 'u-front' }, { kind: 'BUTT', againstWallId: 'uw-corridor-south' }, uEv('SOURCE_CORROBORATED', 'raster x 3.338..3.444; the south chain closes 0.45 + 2.90 = 3.35 on its west face; column scan shows the Garderoba door jambs'), follow),
    partitionX('uw-bath-south', 'Bathroom south partition', 'upper', 9.74, 0.45, 3.35, TP, uH, { kind: 'T', againstWallId: 'u-left' }, { kind: 'T', againstWallId: 'uw-room2-west' }, uEv('SOURCE_CORROBORATED', 'raster z 9.690..9.796; the west chain closes 7.20 + 2.48 = 9.68 on its north face'), follow),
  )

  // --- interior doors (ground) ---
  push(
    ...interiorDoor('gd-bathroom', 'Bathroom door', 'gw-bath-east', 7.81, 8.71, ['g-bathroom', 'g-hall'], 'LEFT', 'the gap between the two ink runs in the column scan at x 3.42; swing drawn into the hall'),
    ...interiorDoor('gd-room', 'Front room door', 'gw-room-east', 9.0, 9.9, ['g-room', 'g-hall'], 'RIGHT', 'the 9.000..9.926 gap in the column scan at x 3.42; swing drawn into the Pokój'),
    ...interiorDoor('gd-entry', 'Wiatrołap door', 'gw-entry-north', 4.21, 5.14, ['g-entry', 'g-hall'], 'LEFT', 'the 4.211..5.138 gap in the row scan at z 10.07; leaf drawn open towards the hall'),
    ...interiorDoor('gd-boiler', 'Kotłownia door', 'gw-boiler-west', 10.46, 11.36, ['g-boiler', 'g-entry'], 'LEFT', 'the 10.456..11.382 gap in the column scan at x 5.43; swing drawn into the kotłownia'),
    ...interiorDoor('gd-pantry', 'Pantry door', 'gw-pantry-west', 5.24, 6.04, ['g-pantry', 'g-hall'], 'RIGHT', 'the 5.241..6.062 gap in the column scan at x 5.43; swing drawn into the hall'),
  )
  // --- interior doors (attic) ---
  push(
    ...interiorDoor('ud-pokoj-nw', 'North-west Pokój door', 'uw-corridor-west', 3.94, 4.77, ['u-pokoj-nw', 'u-corridor'], 'LEFT', 'the 3.967..4.735 gap in the column scan at x 3.9'),
    ...interiorDoor('ud-pralnia', 'Pralnia door', 'uw-corridor-west', 5.64, 6.4, ['u-pralnia', 'u-corridor'], 'LEFT', 'the 5.504..6.405 gap in the column scan at x 3.9'),
    ...interiorDoor('ud-bathroom', 'Bathroom door', 'uw-corridor-west', 7.83, 8.58, ['u-bathroom', 'u-corridor'], 'RIGHT', 'the gap below 7.756 in the column scan at x 3.9'),
    ...interiorDoor('ud-pokoj-ne', 'North-east Pokój door', 'uw-pokoj-ne-south', 4.2, 5.0, ['u-pokoj-ne', 'u-corridor'], 'LEFT', 'the 4.159..5.007 gap in the row scan at z 3.70'),
    ...interiorDoor('ud-pokoj-s', 'South Pokój door', 'uw-corridor-south', 4.08, 4.98, ['u-corridor', 'u-pokoj-s'], 'RIGHT', 'the 4.080..5.007 gap in the row scan at z 8.84'),
    ...interiorDoor('ud-garderoba-sw', 'South-west Garderoba door', 'uw-room2-west', 10.7, 11.52, ['u-garderoba-sw', 'u-pokoj-s'], 'LEFT', 'the 10.697..11.519 gap in the column scan at x 3.42'),
  )

  // --- rooms (plan polygons from the interior gold, transformed) ---
  const room = (id: string, name: string, levelId: string, usage: string, poly: ReadonlyArray<readonly [number, number]>, status: EvidenceStatus, locator: string, publishedArea?: number): BuildingCommand => ({
    type: 'createRoom',
    id,
    name,
    levelId,
    usage,
    polygon: refPolygonToApp(poly).map((p) => ({ x: q(p.x), z: q(p.z) })),
    evidence: ev(status, [levelId === 'ground' ? SRC.groundPlan : SRC.atticPlan, SRC.goldInterior, SRC.facts], locator, publishedArea !== undefined ? `published area ${publishedArea} m² (measured to finished surfaces, 20 mm of finish per face)` : undefined),
  })
  push(
    room('g-salon', 'Salon + Jadalnia', 'ground', 'living', [[0.45, 0.45], [7.45, 0.45], [7.45, 4.91], [4.11, 4.91], [4.11, 4.59], [0.45, 4.59]], 'SOURCE_CORROBORATED', 'printed 700 fixes the width, 414 the notional kitchen split, 446 the south boundary', 29.52),
    room('g-kitchen', 'Kuchnia', 'ground', 'kitchen', [[0.45, 4.59], [4.11, 4.59], [4.11, 7.24], [0.45, 7.24]], 'SOURCE_CORROBORATED', 'the printed 414 | 265 chain fixes both z boundaries; the east boundary is the free end of the kitchen partition', 9.63),
    room('g-hall', 'Hol', 'ground', 'hall', [[4.11, 4.91], [5.37, 4.91], [5.37, 6.28], [6.44, 6.28], [6.44, 6.16], [7.45, 6.16], [7.45, 6.79], [5.37, 6.79], [5.37, 10.01], [3.48, 10.01], [3.48, 7.36], [4.11, 7.36]], 'SOURCE_DERIVED', 'the circulation space between the measured walls once the stair footprint is taken out', 9.18),
    room('g-pantry', 'Spiżarnia', 'ground', 'pantry', [[5.49, 5.03], [7.45, 5.03], [7.45, 6.16], [5.49, 6.16]], 'SOURCE_DERIVED', 'bounded by the three pantry partitions; open to the stair at its south-east corner', 1.44),
    room('g-bathroom', 'Łazienka', 'ground', 'bathroom', [[0.45, 7.36], [3.36, 7.36], [3.36, 8.78], [0.45, 8.78]], 'SOURCE_CORROBORATED', 'the printed 142 fixes the depth', 3.95),
    room('g-room', 'Pokój', 'ground', 'room', [[0.45, 8.9], [3.36, 8.9], [3.36, 12.15], [0.45, 12.15]], 'SOURCE_CORROBORATED', 'the printed 290 fixes the width and 325 the depth', 9.18),
    room('g-entry', 'Wiatrołap', 'ground', 'entry', [[3.48, 10.13], [5.37, 10.13], [5.37, 12.15], [3.48, 12.15]], 'SOURCE_CORROBORATED', 'the printed 190 fixes the width and 203 the depth', 3.7),
    room('g-boiler', 'Kotłownia', 'ground', 'boiler', [[5.49, 9.03], [7.45, 9.03], [7.45, 12.15], [5.49, 12.15]], 'SOURCE_CORROBORATED', 'the printed 196 fixes the width and 312 the depth', 5.8),
    room('g-garage', 'Garaż', 'ground', 'garage', [[7.9, 5.55], [11.6, 5.55], [11.6, 12.15], [7.9, 12.15]], 'SOURCE_CORROBORATED', 'between the main body east wall and the garage east wall; the printed 660 fixes the depth', 24.1),
    room('u-pokoj-nw', 'Pokój (north-west)', 'upper', 'bedroom', [[0.45, 0.45], [3.89, 0.45], [3.89, 4.94], [0.45, 4.94]], 'SOURCE_EXACT', 'printed 344 × 449', 15.13),
    room('u-pokoj-ne', 'Pokój (north-east)', 'upper', 'bedroom', [[4.01, 0.45], [7.45, 0.45], [7.45, 3.7], [4.01, 3.7]], 'SOURCE_EXACT', 'printed 344 × 325', 10.88),
    room('u-garderoba-ne', 'Garderoba (north-east)', 'upper', 'wardrobe', [[5.28, 3.7], [7.45, 3.7], [7.45, 5.03], [6.11, 5.03], [6.11, 4.42], [5.5, 4.42], [5.5, 5.03], [5.28, 5.03]], 'SOURCE_CORROBORATED', 'the printed 217 fixes the width; the notch is the measured flue block', 2.38),
    room('u-pralnia', 'Pralnia', 'upper', 'laundry', [[0.45, 5.06], [3.89, 5.06], [3.89, 7.08], [0.45, 7.08]], 'SOURCE_EXACT', 'printed 344 × 202', 6.73),
    room('u-bathroom', 'Łazienka (attic)', 'upper', 'bathroom', [[0.45, 7.2], [3.89, 7.2], [3.89, 8.78], [3.35, 8.78], [3.35, 9.68], [0.45, 9.68]], 'SOURCE_CORROBORATED', 'the printed 248 fixes the depth; the east face steps at the corridor south partition', 7.81),
    room('u-garderoba-sw', 'Garderoba (south-west)', 'upper', 'wardrobe', [[0.45, 9.8], [3.35, 9.8], [3.35, 12.15], [0.45, 12.15]], 'SOURCE_EXACT', 'printed 290 × 235', 6.53),
    room('u-pokoj-s', 'Pokój (south)', 'upper', 'bedroom', [[3.47, 8.9], [7.45, 8.9], [7.45, 12.15], [3.47, 12.15]], 'SOURCE_EXACT', 'printed 398 × 325; the kotłownia stack stands inside this polygon, as the reference kept it', 11.88),
    room('u-corridor', 'Korytarz', 'upper', 'corridor', [[4.01, 3.82], [5.16, 3.82], [5.16, 8.78], [4.01, 8.78]], 'SOURCE_DERIVED', 'the circulation space between the corridor west partition and the Garderoba / stair walls; its boundary with the stair is not drawn', 6.17),
    room('u-stairs', 'Schody', 'upper', 'stair', [[5.16, 5.15], [7.45, 5.15], [7.45, 8.78], [5.16, 8.78]], 'SOURCE_DERIVED', 'the stair compartment between the stair north and corridor south partitions; the polygon includes the floor void', 5.63),
  )

  // --- stair (placeholder footprint; flights are a later capability) ---
  push({ type: 'createStairPlaceholder', id: 'stair-main', name: 'Main stair (placeholder; two flights with winders in the source)', levelId: 'ground', toLevelId: 'upper', footprint: voidRect, evidence: ev('SOURCE_DERIVED', [SRC.groundPlan, SRC.section, SRC.goldInterior], 'the 2.08 × 1.98 m shaft east of the hall between the top-step line at reference z 6.78..6.99 and the kotłownia north wall face at 8.77; the section finds the void at X 5.351..7.441', 'BuildApp models stairs as placeholders in this stage; the winders are not represented') })

  // --- constraints: the facts a later solver may hold hard ---
  push(
    { type: 'addConstraint', id: 'c-pitch', kind: 'FIXED_VALUE', targetIds: ['roof-main'], property: 'pitchDeg', value: PITCH, tolerance: 0.05, note: 'printed 40° on the section; fitted 40.014°' },
    { type: 'addConstraint', id: 'c-wall-thickness', kind: 'EQUAL', targetIds: ['g-front', 'g-right', 'g-rear', 'g-left', 'u-front', 'u-right', 'u-rear', 'u-left', 'gar-front', 'gar-right', 'gar-rear'], property: 'thickness', note: 'one external build-up, 25 + 20' },
    { type: 'addConstraint', id: 'c-depth', kind: 'NOTE', targetIds: [westFront.id, westRear.id], note: 'characteristic depth 14.60 m: the west return faces span reference z −1.00..13.60 on both plans and the east elevation silhouette' },
    { type: 'addConstraint', id: 'c-eave-datum', kind: 'NOTE', targetIds: ['roof-main'], note: 'the printed eave datum +4,67 sits 0.034 m above the structural plane 4.63556 the model uses; both readings are kept' },
  )

  return out
}
