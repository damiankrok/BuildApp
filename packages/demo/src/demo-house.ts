/**
 * The BuildApp demonstration building.
 *
 * Built ONLY through the Building DSL: this file contains commands and no
 * geometry. It is deliberately not Marcówki — it is a generic two-storey house
 * with a gabled main body, a flat-roofed garage wing, a balcony with railings
 * and a chimney, chosen so that every foundation feature is exercised and any
 * geometry defect is visible.
 *
 * Plan (front facade at the bottom, x to the right, z into the building):
 *
 *     z=8  +------------------+
 *          |   main body      |
 *          |  10.0 x 8.0      +----------+  z=6
 *          |  gable, ridge    |  garage  |
 *          |  along x         | 5.0x6.0  |
 *     z=0  +------------------+----------+
 *         x=0                x=10       x=15
 *
 * Every dimension below is the author's choice and is tagged ASSUMED, except a
 * handful that are tagged as if read from a drawing to show that the evidence
 * vocabulary travels with the objects.
 *
 * Walls are stated on the natural footprint: the exterior rings come from the
 * footprint polygons (`createWallRing`), the garage walls and the partition
 * run from footprint line to footprint line, and junction records say how
 * they meet. No wall endpoint is trimmed by a thickness here; the model
 * resolves corner ownership (STAGE BUILDAPP-00A). An architecture test fails
 * if a wall endpoint is ever moved into another wall's thickness band again.
 */
import { createEmptyModel, type CanonicalBuildingModel, type Evidence } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'

export const DEMO_MODEL_ID = 'demo-house'

const T = 0.3 // exterior wall thickness
const W = 10 // main body width (x)
const D = 8 // main body depth (z)
const GW = 5 // garage width
const GD = 6 // garage depth
const GROUND_H = 3.0
const UPPER_ELEV = 3.0

const assumed: Evidence = { status: 'ASSUMED', source: 'author', sourceIds: ['src-author'] }
const exact = (locator: string): Evidence => ({ status: 'SOURCE_EXACT', source: 'demo plan sheet', locator, sourceIds: ['src-plan'] })

export function demoBuildingCommands(): BuildingCommand[] {
  return [
    { type: 'setModelName', name: 'BuildApp demo house' },
    { type: 'addEvidenceSource', id: 'src-author', kind: 'MANUAL', label: 'author decisions for the demo building' },
    { type: 'addEvidenceSource', id: 'src-plan', kind: 'DRAWING', label: 'hypothetical demo plan sheet A-01' },
    { type: 'defineMaterial', id: 'mat-render', name: 'white render', color: '#d9d4c7' },
    { type: 'defineMaterial', id: 'mat-brick', name: 'brick', color: '#b0725a' },
    { type: 'defineMaterial', id: 'mat-tile', name: 'roof tile', color: '#6f4a3d' },
    { type: 'defineMaterial', id: 'mat-membrane', name: 'flat roof membrane', color: '#4a4f57' },
    { type: 'defineMaterial', id: 'mat-timber', name: 'timber', color: '#8a6a3d' },

    { type: 'createBuilding', id: 'house', name: 'Demo house', evidence: assumed },
    { type: 'createLevel', id: 'ground', name: 'Ground floor', index: 0, elevation: 0, height: GROUND_H, evidence: exact('section datum ±0,00') },
    { type: 'createLevel', id: 'upper', name: 'Upper floor', index: 1, elevation: UPPER_ELEV, height: 3.0, evidence: exact('section datum +3,00') },

    // --- Ground floor exterior ring: the natural footprint, corner ownership resolved by the model ---
    {
      type: 'createWallRing',
      id: 'ring-ground',
      name: 'Ground floor exterior ring',
      levelId: 'ground',
      polygon: [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: D }, { x: 0, z: D }],
      thickness: T,
      height: GROUND_H,
      materialId: 'mat-render',
      evidence: assumed,
      walls: [
        { id: 'g-front', name: 'Front wall', evidence: exact('plan chain 1000') },
        { id: 'g-right', name: 'Right wall' },
        { id: 'g-rear', name: 'Rear wall' },
        { id: 'g-left', name: 'Left wall' },
      ],
    },
    // interior partition between living room and kitchen, stated from footprint line to footprint line;
    // it stops at the slab underside, and its T-junctions resolve its ends against the exterior walls' inner faces
    {
      type: 'createWall',
      id: 'g-partition',
      name: 'Living / kitchen partition',
      levelId: 'ground',
      start: { x: 6, z: D },
      end: { x: 6, z: 0 },
      thickness: 0.12,
      height: 2.75,
      kind: 'INTERIOR',
      evidence: assumed,
      startJunction: { kind: 'T', againstWallId: 'g-rear' },
      endJunction: { kind: 'T', againstWallId: 'g-front' },
    },

    // --- Garage: three walls on the natural footprint, attached to the main body ---
    // gar-front continues the front wall's line (contact, no junction needed); the garage corners are
    // explicit CORNER junctions; gar-rear terminates against the main body's right wall (T).
    { type: 'createWall', id: 'gar-front', name: 'Garage front wall', levelId: 'ground', start: { x: W, z: 0 }, end: { x: W + GW, z: 0 }, thickness: T, height: 3.0, materialId: 'mat-brick', evidence: assumed },
    {
      type: 'createWall',
      id: 'gar-right',
      name: 'Garage right wall',
      levelId: 'ground',
      start: { x: W + GW, z: 0 },
      end: { x: W + GW, z: GD },
      thickness: T,
      height: 3.0,
      materialId: 'mat-brick',
      evidence: assumed,
      startJunction: { kind: 'CORNER', with: { wallId: 'gar-front', end: 'END' }, owner: 'OTHER' },
    },
    {
      type: 'createWall',
      id: 'gar-rear',
      name: 'Garage rear wall',
      levelId: 'ground',
      start: { x: W + GW, z: GD },
      end: { x: W, z: GD },
      thickness: T,
      height: 3.0,
      materialId: 'mat-brick',
      evidence: assumed,
      startJunction: { kind: 'CORNER', with: { wallId: 'gar-right', end: 'END' }, owner: 'SELF' },
      endJunction: { kind: 'T', againstWallId: 'g-right' },
    },

    // --- Slabs ---
    { type: 'createSlab', id: 'slab-ground', name: 'Ground slab', levelId: 'ground', polygon: [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: D }, { x: 0, z: D }], topOffset: 0, thickness: 0.3, evidence: assumed },
    { type: 'createSlab', id: 'slab-garage', name: 'Garage slab', levelId: 'ground', polygon: [{ x: W, z: 0 }, { x: W + GW, z: 0 }, { x: W + GW, z: GD }, { x: W, z: GD }], topOffset: 0, thickness: 0.3, evidence: assumed },
    { type: 'createSlab', id: 'slab-upper', name: 'Upper floor slab', levelId: 'upper', polygon: [{ x: T, z: T }, { x: W - T, z: T }, { x: W - T, z: D - T }, { x: T, z: D - T }], topOffset: 0, thickness: 0.25, evidence: assumed },

    // --- Upper floor exterior ring: same footprint; the gable walls are taller and the roof caps all four ---
    {
      type: 'createWallRing',
      id: 'ring-upper',
      name: 'Upper floor exterior ring',
      levelId: 'upper',
      polygon: [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: D }, { x: 0, z: D }],
      thickness: T,
      height: 3.0,
      materialId: 'mat-render',
      evidence: assumed,
      walls: [
        { id: 'u-front', name: 'Upper front wall' },
        { id: 'u-right', name: 'Upper right gable wall', height: 6.0 },
        { id: 'u-rear', name: 'Upper rear wall' },
        { id: 'u-left', name: 'Upper left gable wall', height: 6.0 },
      ],
    },

    // --- Roofs (cap the walls that die into them) ---
    {
      type: 'createRoof',
      id: 'roof-main',
      name: 'Main gable roof',
      levelId: 'upper',
      kind: 'GABLE',
      footprint: { minX: 0, maxX: W, minZ: 0, maxZ: D },
      eaveOffset: 2.9,
      pitchDeg: 35,
      ridgeAxis: 'X',
      overhang: 0.4,
      thickness: 0.25,
      materialId: 'mat-tile',
      capWallIds: ['u-front', 'u-right', 'u-rear', 'u-left'],
      evidence: exact('section: pitch 35°'),
    },
    {
      type: 'createRoof',
      id: 'roof-garage',
      name: 'Garage flat roof',
      levelId: 'ground',
      kind: 'FLAT',
      footprint: { minX: W, maxX: W + GW, minZ: 0, maxZ: GD },
      eaveOffset: 2.85,
      overhang: 0,
      thickness: 0.25,
      materialId: 'mat-membrane',
      capWallIds: ['gar-front', 'gar-right', 'gar-rear'],
      evidence: assumed,
    },

    // --- Openings: ground floor ---
    { type: 'cutOpening', id: 'op-entrance', name: 'Entrance door opening', wallId: 'g-front', kind: 'DOOR', offset: 1.0, sill: 0, width: 1.0, height: 2.1, evidence: exact('plan callout 100/210') },
    { type: 'placeDoor', id: 'door-entrance', name: 'Entrance door', openingId: 'op-entrance', hingeSide: 'LEFT', swing: 'IN', openAngle: 0, materialId: 'mat-timber', evidence: assumed },
    { type: 'cutOpening', id: 'op-gf-1', wallId: 'g-front', kind: 'WINDOW', offset: 3.5, sill: 0.9, width: 1.5, height: 1.4, evidence: exact('plan callout 150/140') },
    { type: 'placeWindow', id: 'win-gf-1', openingId: 'op-gf-1', divisions: 2 },
    { type: 'cutOpening', id: 'op-gf-2', wallId: 'g-front', kind: 'WINDOW', offset: 7.0, sill: 0.9, width: 1.8, height: 1.4, evidence: assumed },
    { type: 'placeWindow', id: 'win-gf-2', openingId: 'op-gf-2', divisions: 2 },
    { type: 'cutOpening', id: 'op-gr-1', wallId: 'g-rear', kind: 'WINDOW', offset: 2.0, sill: 0.9, width: 1.5, height: 1.4 },
    { type: 'placeWindow', id: 'win-gr-1', openingId: 'op-gr-1' },
    { type: 'cutOpening', id: 'op-gr-2', wallId: 'g-rear', kind: 'WINDOW', offset: 6.5, sill: 0.9, width: 1.8, height: 1.4 },
    { type: 'placeWindow', id: 'win-gr-2', openingId: 'op-gr-2', divisions: 3 },
    { type: 'cutOpening', id: 'op-gl-1', wallId: 'g-left', kind: 'WINDOW', offset: 2.8, sill: 0.9, width: 1.5, height: 1.4 },
    { type: 'placeWindow', id: 'win-gl-1', openingId: 'op-gl-1' },
    { type: 'cutOpening', id: 'op-grt-1', wallId: 'g-right', kind: 'WINDOW', offset: 6.5, sill: 1.0, width: 0.8, height: 1.2 },
    { type: 'placeWindow', id: 'win-grt-1', openingId: 'op-grt-1' },
    { type: 'cutOpening', id: 'op-partition', name: 'Kitchen door opening', wallId: 'g-partition', kind: 'DOOR', offset: 3.3, sill: 0, width: 0.9, height: 2.05 },
    { type: 'placeDoor', id: 'door-kitchen', name: 'Kitchen door', openingId: 'op-partition', hingeSide: 'RIGHT', swing: 'IN', openAngle: 35, frameDepth: 0.1, frameInset: 0.01, materialId: 'mat-timber' },

    // --- Openings: garage ---
    { type: 'cutOpening', id: 'op-garage-door', name: 'Garage door opening', wallId: 'gar-front', kind: 'DOOR', offset: 1.0, sill: 0, width: 2.5, height: 2.2 },
    { type: 'placeDoor', id: 'door-garage', name: 'Garage door', openingId: 'op-garage-door', hingeSide: 'LEFT', swing: 'OUT', openAngle: 0, leafThickness: 0.05, frameWidth: 0.08 },
    { type: 'cutOpening', id: 'op-gar-1', wallId: 'gar-right', kind: 'WINDOW', offset: 2.8, sill: 1.2, width: 1.0, height: 1.0 },
    { type: 'placeWindow', id: 'win-gar-1', openingId: 'op-gar-1' },

    // --- Openings: upper floor ---
    { type: 'cutOpening', id: 'op-uf-1', wallId: 'u-front', kind: 'WINDOW', offset: 1.5, sill: 0.9, width: 1.5, height: 1.4 },
    { type: 'placeWindow', id: 'win-uf-1', openingId: 'op-uf-1', divisions: 2 },
    { type: 'cutOpening', id: 'op-uf-2', wallId: 'u-front', kind: 'WINDOW', offset: 6.5, sill: 0.9, width: 1.5, height: 1.4 },
    { type: 'placeWindow', id: 'win-uf-2', openingId: 'op-uf-2', divisions: 2 },
    { type: 'cutOpening', id: 'op-balcony', name: 'Balcony door opening', wallId: 'u-rear', kind: 'DOOR', offset: 4.55, sill: 0, width: 0.9, height: 2.1 },
    { type: 'placeDoor', id: 'door-balcony', name: 'Balcony door', openingId: 'op-balcony', hingeSide: 'RIGHT', swing: 'IN', openAngle: 0, materialId: 'mat-timber' },
    { type: 'cutOpening', id: 'op-ur-1', wallId: 'u-rear', kind: 'WINDOW', offset: 1.5, sill: 0.9, width: 1.2, height: 1.4 },
    { type: 'placeWindow', id: 'win-ur-1', openingId: 'op-ur-1' },
    { type: 'cutOpening', id: 'op-ul-gable', name: 'Gable window opening', wallId: 'u-left', kind: 'WINDOW', offset: 3.4, sill: 0.9, width: 1.2, height: 1.4 },
    { type: 'placeWindow', id: 'win-ul-gable', openingId: 'op-ul-gable' },

    // --- Balcony at the rear with railings ---
    { type: 'createBalcony', id: 'balcony-rear', name: 'Rear balcony', levelId: 'upper', kind: 'BALCONY', footprint: { minX: 3, maxX: 7, minZ: D, maxZ: D + 1.5 }, topOffset: 0, thickness: 0.2, evidence: assumed },
    { type: 'createRailing', id: 'rail-rear', name: 'Balcony railing, rear', levelId: 'upper', start: { x: 3, z: D + 1.5 }, end: { x: 7, z: D + 1.5 }, height: 1.1, postSpacing: 1.0, infill: 'GLASS', hostId: 'balcony-rear' },
    { type: 'createRailing', id: 'rail-left', name: 'Balcony railing, left', levelId: 'upper', start: { x: 3, z: D }, end: { x: 3, z: D + 1.5 }, height: 1.1, postSpacing: 0.75, infill: 'BARS', hostId: 'balcony-rear' },
    { type: 'createRailing', id: 'rail-right', name: 'Balcony railing, right', levelId: 'upper', start: { x: 7, z: D + 1.5 }, end: { x: 7, z: D }, height: 1.1, postSpacing: 0.75, infill: 'BARS', hostId: 'balcony-rear' },

    // --- Chimney rising through the roof ---
    { type: 'placeChimney', id: 'chimney-1', name: 'Chimney', levelId: 'upper', footprint: { minX: 7.0, maxX: 7.6, minZ: 3.0, maxZ: 3.6 }, baseOffset: 0, height: 6.0, materialId: 'mat-brick', evidence: assumed },

    // --- Rooms and the stair placeholder ---
    { type: 'createRoom', id: 'room-living', name: 'Living room', levelId: 'ground', usage: 'living', polygon: [{ x: T, z: T }, { x: 6, z: T }, { x: 6, z: D - T }, { x: T, z: D - T }] },
    { type: 'createRoom', id: 'room-kitchen', name: 'Kitchen', levelId: 'ground', usage: 'kitchen', polygon: [{ x: 6.12, z: T }, { x: W - T, z: T }, { x: W - T, z: D - T }, { x: 6.12, z: D - T }] },
    { type: 'createRoom', id: 'room-garage', name: 'Garage', levelId: 'ground', usage: 'garage', polygon: [{ x: W, z: T }, { x: W + GW - T, z: T }, { x: W + GW - T, z: GD - T }, { x: W, z: GD - T }] },
    { type: 'createRoom', id: 'room-bedroom', name: 'Bedroom', levelId: 'upper', usage: 'bedroom', polygon: [{ x: T, z: T }, { x: 5, z: T }, { x: 5, z: D - T }, { x: T, z: D - T }] },
    { type: 'createRoom', id: 'room-bath', name: 'Bathroom', levelId: 'upper', usage: 'bathroom', polygon: [{ x: 5, z: T }, { x: W - T, z: T }, { x: W - T, z: D - T }, { x: 5, z: D - T }] },
    { type: 'createStairPlaceholder', id: 'stair-1', name: 'Stair (placeholder)', levelId: 'ground', toLevelId: 'upper', footprint: { minX: 6.5, maxX: 9.5, minZ: 4.0, maxZ: 6.5 } },

    // --- Constraints ---
    { type: 'addConstraint', id: 'c-pitch', kind: 'FIXED_VALUE', targetIds: ['roof-main'], property: 'pitchDeg', value: 35, tolerance: 0.01, note: 'declared roof pitch' },
    { type: 'addConstraint', id: 'c-wall-thickness', kind: 'EQUAL', targetIds: ['g-front', 'g-rear', 'g-left', 'g-right'], property: 'thickness', note: 'exterior walls share one build-up' },
  ]
}

/** The demo model, constructed from an empty model by replaying the command list. */
export function createDemoBuilding(): CanonicalBuildingModel {
  return runCommands(createEmptyModel(DEMO_MODEL_ID, 'BuildApp demo house', 'buildapp-demo'), demoBuildingCommands())
}
