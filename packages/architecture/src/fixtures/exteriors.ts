/**
 * Diversity fixtures 9–17: exterior assemblies, and the unknown feature.
 * Generic parameters throughout; no project is copied.
 */
import type { ArchitecturalFixture } from './types.js'
import { MAT, assembly, beam, doorIn, gableHouse, gableRoof, planeThrough, post, rect, rel, ring, round, start, synthetic, windowIn, type Cmd } from './builders.js'

const T = 0.3
const house = () => gableHouse({ W: 10, D: 8, H: 3.0, t: T, pitchDeg: 35, overhang: 0.5, roofThickness: 0.25 })

/**
 * A two-storey house: a ground ring to 3.0 m, the upper floor slab bearing
 * into it (inset to the wall centreline), an upper ring under a plane gable.
 */
function twoStorey(groundPolygon: { x: number; z: number }[], groundWalls?: Array<{ height?: number }>): { commands: Cmd[]; upperWalls: string[] } {
  const roof = gableRoof({ prefix: 'roof-main', levelId: 'level-1', W: 10, D: 8, eaveY: 5.6, pitchDeg: 35, overhang: 0.5, thickness: 0.25 })
  return {
    commands: [
      ...start([
        { id: 'level-0', index: 0, elevation: 0, height: 3 },
        { id: 'level-1', index: 1, elevation: 3, height: 2.8 },
      ]),
      ...roof.commands,
      ring({ id: 'ring-0', levelId: 'level-0', polygon: groundPolygon, thickness: T, height: 3, walls: groundWalls }),
      { type: 'createSlab', id: 'slab-1', levelId: 'level-1', polygon: rect(T / 2, T / 2, 10 - T / 2, 8 - T / 2), topOffset: 0, thickness: 0.25, materialId: MAT.slab, evidence: synthetic('slab-1') },
      ring({ id: 'ring-1', levelId: 'level-1', polygon: rect(0, 0, 10, 8), thickness: T, height: 6, followPlanes: roof.planeIds }),
      rel('SUPPORTED_BY', roof.planeIds[0], 'ring-1-w0'),
      rel('SUPPORTED_BY', roof.planeIds[1], 'ring-1-w2'),
    ],
    upperWalls: ['ring-1-w0', 'ring-1-w1', 'ring-1-w2', 'ring-1-w3'],
  }
}

export const exteriorBalcony: ArchitecturalFixture = {
  id: 'exterior-balcony',
  title: 'Balcony: an elevated slab on the upper floor, guarded on three sides',
  capabilities: ['BALCONY'],
  commands: () => {
    const h = twoStorey(rect(0, 0, 10, 8))
    return [
      ...h.commands,
      { type: 'createBalcony', id: 'balcony-front-slab', levelId: 'level-1', kind: 'BALCONY', footprint: { minX: 3, maxX: 7, minZ: -1.4, maxZ: 0 }, topOffset: 0, thickness: 0.2, materialId: MAT.concrete, evidence: synthetic('balcony') },
      { type: 'createRailing', id: 'balcony-front-guard', levelId: 'level-1', start: { x: 3, z: 0 }, end: { x: 7, z: 0 }, path: [{ x: 3, z: 0 }, { x: 3, z: -1.4 }, { x: 7, z: -1.4 }, { x: 7, z: 0 }], baseOffset: 0, height: 1.1, infill: 'GLASS', hostId: 'balcony-front-slab', role: 'GUARD', materialId: MAT.steel, evidence: synthetic('guard') },
      ...doorIn('ring-1-w0', 'door-balcony', 4.3, 1.4, 2.2, 'TERRACE'),
      ...doorIn('ring-0-w0', 'door-front', 1.2, 1.0, 2.1, 'ENTRANCE'),
      assembly({ id: 'balcony-front', kind: 'BALCONY', platformId: 'balcony-front-slab', railingIds: ['balcony-front-guard'], supportIds: [], hostIds: ['ring-1-w0'], quality: 'COMPLETE', edgeConditions: [{ edgeIndex: 0, condition: 'GUARDED', targetId: 'balcony-front-guard' }, { edgeIndex: 1, condition: 'GUARDED', targetId: 'balcony-front-guard' }, { edgeIndex: 2, condition: 'WALL', targetId: 'ring-0-w0' }, { edgeIndex: 3, condition: 'GUARDED', targetId: 'balcony-front-guard' }] }),
      rel('GUARDS', 'balcony-front-guard', 'balcony-front-slab'),
      rel('ATTACHED_TO', 'balcony-front-slab', 'ring-0-w0'),
      rel('OPENS_INTO', 'door-balcony', 'balcony-front-slab'),
    ]
  },
  expect: { assemblies: { ROOF: 1, BALCONY: 1 }, primitives: { BalconySlab: 1, Guard: 1, Door: 2 }, roofClassifications: ['GABLE'], minRelationships: 5 },
}

export const exteriorLoggia: ArchitecturalFixture = {
  id: 'exterior-loggia',
  title: 'Recessed loggia: a floor inside the envelope, under the upper storey',
  capabilities: ['LOGGIA'],
  commands: () => {
    const notch = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 1.5 }, { x: 7, z: 1.5 }, { x: 7, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 8 }, { x: 0, z: 8 }]
    // the recess walls stop under the upper floor, which spans the loggia as its ceiling and bears on them;
    // the front walls either side own the loggia's outer corners (even edges, ALTERNATE) and rise to the floor top
    const under = 3 - 0.25
    const h = twoStorey(notch, [{}, { height: under }, { height: under }, { height: under }, {}, {}, {}, {}])
    return [
      ...h.commands,
      { type: 'createTerrace', id: 'loggia-floor', levelId: 'level-0', polygon: rect(3, 0, 7, 1.5), topOffset: 0, thickness: 0.2, surface: 'PAVED', edge: 'FLUSH', hostWallIds: ['ring-0-w1', 'ring-0-w2', 'ring-0-w3'], materialId: MAT.paving, evidence: synthetic('loggia') },
      ...doorIn('ring-0-w2', 'door-loggia', 1.3, 1.4, 2.2, 'TERRACE'),
      ...windowIn('ring-1-w0', 'window-over-loggia', 4.0, 0.9, 2.0, 1.3),
      assembly({ id: 'loggia-front', kind: 'LOGGIA', platformId: 'loggia-floor', railingIds: [], supportIds: [], recessWallIds: ['ring-0-w1', 'ring-0-w2', 'ring-0-w3'], hostIds: ['ring-0-w2'], quality: 'COMPLETE', edgeConditions: [{ edgeIndex: 0, condition: 'OPEN' }, { edgeIndex: 1, condition: 'WALL', targetId: 'ring-0-w3' }, { edgeIndex: 2, condition: 'WALL', targetId: 'ring-0-w2' }, { edgeIndex: 3, condition: 'WALL', targetId: 'ring-0-w1' }] }),
      rel('ATTACHED_TO', 'loggia-floor', 'ring-0-w2'),
      rel('OPENS_INTO', 'door-loggia', 'loggia-floor'),
      rel('ABOVE', 'slab-1', 'loggia-floor'),
    ]
  },
  expect: { assemblies: { ROOF: 1, LOGGIA: 1 }, primitives: { TerraceSurface: 1, Door: 1 }, roofClassifications: ['GABLE'], minRelationships: 5 },
}

export const exteriorTerrace: ArchitecturalFixture = {
  id: 'exterior-terrace',
  title: 'Grade terrace against the rear facade',
  capabilities: ['TERRACE'],
  commands: () => {
    const h = house()
    return [
      ...h.commands,
      { type: 'createTerrace', id: 'terrace-rear', levelId: 'level-0', polygon: rect(1.5, 8, 8.5, 11), topOffset: 0, thickness: 0.3, surface: 'PAVED', edge: 'PLINTH', hostWallIds: [h.walls.rear], materialId: MAT.paving, evidence: synthetic('terrace') },
      ...doorIn(h.walls.rear, 'door-terrace', 4.3, 1.4, 2.2, 'TERRACE'),
      assembly({ id: 'terrace-rear-assembly', kind: 'TERRACE', platformId: 'terrace-rear', railingIds: [], supportIds: [], hostIds: [h.walls.rear], quality: 'COMPLETE', edgeConditions: [{ edgeIndex: 0, condition: 'WALL', targetId: h.walls.rear }, { edgeIndex: 1, condition: 'FREE' }, { edgeIndex: 2, condition: 'FREE' }, { edgeIndex: 3, condition: 'FREE' }] }),
      rel('ATTACHED_TO', 'terrace-rear', h.walls.rear),
      rel('OPENS_INTO', 'door-terrace', 'terrace-rear'),
    ]
  },
  expect: { assemblies: { ROOF: 1, TERRACE: 1 }, primitives: { TerraceSurface: 1, Door: 1 }, roofClassifications: ['GABLE'], minRelationships: 4 },
}

export const exteriorEntranceCanopy: ArchitecturalFixture = {
  id: 'exterior-entrance-canopy',
  title: 'Entrance canopy on two posts and a beam, over a landing with two steps',
  capabilities: ['CANOPY', 'COLUMN', 'BEAM', 'ENTRANCE', 'EXTERIOR_STEPS'],
  commands: () => {
    const h = house()
    const under = 2.33
    const plane = 'canopy-plane'
    return [
      ...h.commands,
      ...doorIn(h.walls.front, 'door-front', 4.5, 1.0, 2.1, 'ENTRANCE'),
      { type: 'createPlatform', id: 'landing-front', levelId: 'level-0', role: 'LANDING', polygon: rect(3.9, -1.6, 6.5, 0), topOffset: 0, thickness: 0.45, hostWallIds: [h.walls.front], materialId: MAT.paving, evidence: synthetic('landing') },
      { type: 'createStepRun', id: 'steps-front', levelId: 'level-0', role: 'ENTRANCE_STEPS', start: { x: 4.4, z: -2.2 }, direction: { x: 0, z: 1 }, width: 1.8, steps: 2, going: 0.3, rise: 0.15, baseOffset: -0.45, materialId: MAT.paving, evidence: synthetic('steps') },
      post('canopy-post-west', 'level-0', 'POST', { x: 4.2, z: -1.45 }, 0, round(under - 0.2), 0.12, MAT.steel),
      post('canopy-post-east', 'level-0', 'POST', { x: 6.2, z: -1.45 }, 0, round(under - 0.2), 0.12, MAT.steel),
      beam('canopy-beam', 'level-0', 'BEAM', { x: 4.14, z: -1.45 }, { x: 6.26, z: -1.45 }, under, 0.2, 0.12, MAT.steel),
      planeThrough({ id: plane, levelId: 'level-0', boundary: rect(3.8, -1.7, 6.6, 0), at: { x: 3.8, z: -1.7 }, undersideY: under, pitchDeg: 0, downslope: { x: 0, z: -1 }, thickness: 0.12, materialId: MAT.flatRoof, name: 'canopy cover' }),
      { type: 'createRoofEdge', id: 'canopy-edge-wall', kind: 'ABUTMENT', planeId: plane, start: { x: 6.6, z: 0 }, end: { x: 3.8, z: 0 }, evidence: synthetic('canopy') },
      { type: 'createRoofEdge', id: 'canopy-edge-front', kind: 'BOUNDARY', planeId: plane, start: { x: 3.8, z: -1.7 }, end: { x: 6.6, z: -1.7 }, evidence: synthetic('canopy') },
      { type: 'createRoofEdge', id: 'canopy-edge-west', kind: 'BOUNDARY', planeId: plane, start: { x: 3.8, z: 0 }, end: { x: 3.8, z: -1.7 }, evidence: synthetic('canopy') },
      { type: 'createRoofEdge', id: 'canopy-edge-east', kind: 'BOUNDARY', planeId: plane, start: { x: 6.6, z: -1.7 }, end: { x: 6.6, z: 0 }, evidence: synthetic('canopy') },
      assembly({ id: 'canopy-roof', kind: 'ROOF', classification: 'FLAT', planeIds: [plane], edgeIds: ['canopy-edge-wall', 'canopy-edge-front', 'canopy-edge-west', 'canopy-edge-east'], openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: [h.walls.front], quality: 'COMPLETE' }),
      assembly({ id: 'canopy-entrance', kind: 'CANOPY', usage: 'ENTRANCE', supportIds: ['canopy-post-west', 'canopy-post-east'], beamIds: ['canopy-beam'], roofAssemblyId: 'canopy-roof', openSides: ['MIN_X', 'MAX_X', 'MIN_Z'], hostIds: [h.walls.front], quality: 'COMPLETE' }),
      assembly({ id: 'entrance-front', kind: 'ENTRANCE', doorId: 'door-front', landingId: 'landing-front', stepRunIds: ['steps-front'], canopyId: 'canopy-entrance', supportIds: ['canopy-post-west', 'canopy-post-east'], railingIds: [], hostIds: [h.walls.front], quality: 'COMPLETE' }),
      rel('SUPPORTED_BY', 'canopy-post-west', 'landing-front'),
      rel('SUPPORTED_BY', 'canopy-post-east', 'landing-front'),
      rel('SUPPORTED_BY', 'canopy-beam', 'canopy-post-west'),
      rel('SUPPORTED_BY', 'canopy-beam', 'canopy-post-east'),
      rel('SUPPORTED_BY', plane, 'canopy-beam'),
      rel('ATTACHED_TO', plane, h.walls.front),
      rel('ATTACHED_TO', 'landing-front', h.walls.front),
      rel('TERMINATES_AT', 'steps-front', 'landing-front'),
      rel('OPENS_INTO', 'door-front', 'landing-front'),
      rel('COVERS', plane, 'landing-front'),
    ]
  },
  expect: { assemblies: { ROOF: 2, CANOPY: 1, ENTRANCE: 1 }, primitives: { Post: 2, Beam: 1, RoofPlane: 3, Landing: 1, ExteriorStepRun: 1, Step: 2, Door: 1 }, roofClassifications: ['FLAT', 'GABLE'], minRelationships: 12 },
}

export const exteriorCarport: ArchitecturalFixture = {
  id: 'exterior-carport',
  title: 'Carport with a shed roof against the house, on two posts and a beam',
  capabilities: ['CARPORT', 'COLUMN', 'BEAM'],
  commands: () => {
    const h = house()
    const plane = 'carport-plane'
    const pitch = 5
    const arrisX = 13.27
    const beamTop = 2.314
    return [
      ...h.commands,
      { type: 'createPlatform', id: 'carport-plinth', levelId: 'level-0', role: 'PLINTH', polygon: rect(10, 0.9, 13.5, 7.1), topOffset: 0, thickness: 0.15, hostWallIds: [h.walls.east], materialId: MAT.paving, evidence: synthetic('carport') },
      post('carport-post-south', 'level-0', 'POST', { x: 13.2, z: 1.2 }, 0, round(beamTop - 0.25), 0.14, MAT.timber),
      post('carport-post-north', 'level-0', 'POST', { x: 13.2, z: 6.8 }, 0, round(beamTop - 0.25), 0.14, MAT.timber),
      beam('carport-beam', 'level-0', 'BEAM', { x: 13.2, z: 1.13 }, { x: 13.2, z: 6.87 }, beamTop, 0.25, 0.14, MAT.timber),
      planeThrough({ id: plane, levelId: 'level-0', boundary: rect(10, 0.9, 13.5, 7.1), at: { x: arrisX, z: 0.9 }, undersideY: beamTop, pitchDeg: pitch, downslope: { x: 1, z: 0 }, thickness: 0.15, name: 'carport roof' }),
      { type: 'createRoofEdge', id: 'carport-abutment', kind: 'ABUTMENT', planeId: plane, start: { x: 10, z: 7.1 }, end: { x: 10, z: 0.9 }, evidence: synthetic('carport') },
      { type: 'createRoofEdge', id: 'carport-eave', kind: 'EAVE', planeId: plane, start: { x: 13.5, z: 0.9 }, end: { x: 13.5, z: 7.1 }, board: { id: 'carport-fascia', height: 0.2, depth: 0.04, materialId: MAT.trim }, evidence: synthetic('carport') },
      { type: 'createRoofEdge', id: 'carport-verge-south', kind: 'VERGE', planeId: plane, start: { x: 10, z: 0.9 }, end: { x: 13.5, z: 0.9 }, evidence: synthetic('carport') },
      { type: 'createRoofEdge', id: 'carport-verge-north', kind: 'VERGE', planeId: plane, start: { x: 13.5, z: 7.1 }, end: { x: 10, z: 7.1 }, evidence: synthetic('carport') },
      assembly({ id: 'carport-roof', kind: 'ROOF', classification: 'SHED', planeIds: [plane], edgeIds: ['carport-abutment', 'carport-eave', 'carport-verge-south', 'carport-verge-north'], openingIds: [], dormerIds: [], chimneyIds: [], trimIds: ['carport-fascia'], hostIds: [h.walls.east], quality: 'COMPLETE' }),
      assembly({ id: 'carport', kind: 'CARPORT', supportIds: ['carport-post-south', 'carport-post-north'], beamIds: ['carport-beam'], roofAssemblyId: 'carport-roof', slabId: 'carport-plinth', openSides: ['MAX_X', 'MIN_Z', 'MAX_Z'], hostIds: [h.walls.east], bays: 1, quality: 'COMPLETE' }),
      rel('SUPPORTED_BY', 'carport-post-south', 'carport-plinth'),
      rel('SUPPORTED_BY', 'carport-post-north', 'carport-plinth'),
      rel('SUPPORTED_BY', 'carport-beam', 'carport-post-south'),
      rel('SUPPORTED_BY', 'carport-beam', 'carport-post-north'),
      rel('SUPPORTED_BY', plane, 'carport-beam'),
      rel('ATTACHED_TO', plane, h.walls.east),
      rel('ATTACHED_TO', 'carport-plinth', h.walls.east),
    ]
  },
  expect: { assemblies: { ROOF: 2, CARPORT: 1 }, primitives: { Post: 2, Beam: 1, RoofPlane: 3, Fascia: 7 }, roofClassifications: ['SHED', 'GABLE'], minRelationships: 9 },
}

export const exteriorPergola: ArchitecturalFixture = {
  id: 'exterior-pergola',
  title: 'Pergola on a grade terrace: posts, primary and secondary beams, and no roof',
  capabilities: ['PERGOLA', 'TERRACE', 'BEAM'],
  commands: () => {
    const h = house()
    const postTop = 2.48
    const primaryTop = 2.72
    const secondaryTop = 2.88
    const posts: Array<[string, number, number]> = [
      ['pergola-post-1', 2, 9.2],
      ['pergola-post-2', 8, 9.2],
      ['pergola-post-3', 2, 11.8],
      ['pergola-post-4', 8, 11.8],
    ]
    const secondaryXs = [2, 3.5, 5, 6.5, 8]
    return [
      ...h.commands,
      { type: 'createTerrace', id: 'terrace-rear', levelId: 'level-0', polygon: rect(1, 8, 9, 12.4), topOffset: 0, thickness: 0.3, surface: 'DECK', edge: 'PLINTH', hostWallIds: [h.walls.rear], materialId: MAT.timber, evidence: synthetic('terrace') },
      ...doorIn(h.walls.rear, 'door-terrace', 4.3, 1.4, 2.2, 'TERRACE'),
      ...posts.map(([id, x, z]) => post(id, 'level-0', 'PERGOLA_POST', { x, z }, 0, postTop, 0.14, MAT.timber)),
      beam('pergola-beam-south', 'level-0', 'PERGOLA_BEAM', { x: 1.7, z: 9.2 }, { x: 8.3, z: 9.2 }, primaryTop, 0.24, 0.14, MAT.timber),
      beam('pergola-beam-north', 'level-0', 'PERGOLA_BEAM', { x: 1.7, z: 11.8 }, { x: 8.3, z: 11.8 }, primaryTop, 0.24, 0.14, MAT.timber),
      ...secondaryXs.map((x, i) => beam(`pergola-rafter-${i + 1}`, 'level-0', 'PERGOLA_BEAM', { x, z: 8.9 }, { x, z: 12.1 }, secondaryTop, 0.16, 0.08, MAT.timber)),
      assembly({ id: 'pergola', kind: 'PERGOLA', postIds: posts.map((p) => p[0]), primaryBeamIds: ['pergola-beam-south', 'pergola-beam-north'], secondaryBeamIds: secondaryXs.map((_, i) => `pergola-rafter-${i + 1}`), slabOrTerraceId: 'terrace-rear', coverage: 'OPEN', hostIds: [], quality: 'COMPLETE' }),
      assembly({ id: 'terrace-rear-assembly', kind: 'TERRACE', platformId: 'terrace-rear', railingIds: [], supportIds: [], hostIds: [h.walls.rear], quality: 'COMPLETE' }),
      ...posts.map(([id]) => rel('SUPPORTED_BY', id, 'terrace-rear')),
      rel('SUPPORTED_BY', 'pergola-beam-south', 'pergola-post-1'),
      rel('SUPPORTED_BY', 'pergola-beam-south', 'pergola-post-2'),
      rel('SUPPORTED_BY', 'pergola-beam-north', 'pergola-post-3'),
      rel('SUPPORTED_BY', 'pergola-beam-north', 'pergola-post-4'),
      ...secondaryXs.flatMap((_, i) => [rel('SUPPORTED_BY', `pergola-rafter-${i + 1}`, 'pergola-beam-south'), rel('SUPPORTED_BY', `pergola-rafter-${i + 1}`, 'pergola-beam-north')]),
      rel('ATTACHED_TO', 'terrace-rear', h.walls.rear),
    ]
  },
  expect: { assemblies: { ROOF: 1, PERGOLA: 1, TERRACE: 1 }, primitives: { PergolaPost: 4, PergolaBeam: 7, RoofPlane: 2, TerraceSurface: 1 }, roofClassifications: ['GABLE'], minRelationships: 19 },
}

export const exteriorOpenCanopy: ArchitecturalFixture = {
  id: 'exterior-open-canopy',
  title: 'Detached open canopy: a gable shelter on four posts, no walls',
  capabilities: ['CANOPY', 'COLUMN', 'BEAM', 'ROOF_GABLE'],
  commands: () => {
    const h = house()
    const beamTop = 2.4
    const pitch = 25
    const posts: Array<[string, number, number]> = [
      ['shelter-post-sw', 13.2, 9.2],
      ['shelter-post-se', 16.8, 9.2],
      ['shelter-post-nw', 13.2, 11.8],
      ['shelter-post-ne', 16.8, 11.8],
    ]
    return [
      ...h.commands,
      { type: 'createPlatform', id: 'shelter-plinth', levelId: 'level-0', role: 'PLINTH', polygon: rect(12.75, 8.75, 17.25, 12.25), topOffset: 0, thickness: 0.1, materialId: MAT.paving, evidence: synthetic('shelter') },
      ...posts.map(([id, x, z]) => post(id, 'level-0', 'POST', { x, z }, 0, round(beamTop - 0.2), 0.14, MAT.timber)),
      beam('shelter-beam-south', 'level-0', 'BEAM', { x: 13.13, z: 9.2 }, { x: 16.87, z: 9.2 }, beamTop, 0.2, 0.14, MAT.timber),
      beam('shelter-beam-north', 'level-0', 'BEAM', { x: 13.13, z: 11.8 }, { x: 16.87, z: 11.8 }, beamTop, 0.2, 0.14, MAT.timber),
      planeThrough({ id: 'shelter-plane-south', levelId: 'level-0', boundary: rect(12.9, 8.9, 17.1, 10.5), at: { x: 12.9, z: 9.13 }, undersideY: beamTop, pitchDeg: pitch, downslope: { x: 0, z: -1 }, thickness: 0.12, name: 'shelter south slope' }),
      planeThrough({ id: 'shelter-plane-north', levelId: 'level-0', boundary: rect(12.9, 10.5, 17.1, 12.1), at: { x: 12.9, z: 11.87 }, undersideY: beamTop, pitchDeg: pitch, downslope: { x: 0, z: 1 }, thickness: 0.12, name: 'shelter north slope' }),
      { type: 'connectRoofPlanes', id: 'shelter-ridge', kind: 'AUTO', planeIds: ['shelter-plane-south', 'shelter-plane-north'], evidence: synthetic('shelter') },
      { type: 'createRoofEdge', id: 'shelter-eave-south', kind: 'EAVE', planeId: 'shelter-plane-south', start: { x: 12.9, z: 8.9 }, end: { x: 17.1, z: 8.9 }, evidence: synthetic('shelter') },
      { type: 'createRoofEdge', id: 'shelter-eave-north', kind: 'EAVE', planeId: 'shelter-plane-north', start: { x: 17.1, z: 12.1 }, end: { x: 12.9, z: 12.1 }, evidence: synthetic('shelter') },
      assembly({ id: 'shelter-roof', kind: 'ROOF', classification: 'GABLE', planeIds: ['shelter-plane-south', 'shelter-plane-north'], edgeIds: ['shelter-ridge', 'shelter-eave-south', 'shelter-eave-north'], openingIds: [], dormerIds: [], chimneyIds: [], trimIds: [], hostIds: [], quality: 'COMPLETE' }),
      assembly({ id: 'shelter', kind: 'CANOPY', usage: 'SHELTER', supportIds: posts.map((p) => p[0]), beamIds: ['shelter-beam-south', 'shelter-beam-north'], roofAssemblyId: 'shelter-roof', openSides: ['MIN_X', 'MAX_X', 'MIN_Z', 'MAX_Z'], hostIds: [], quality: 'COMPLETE' }),
      ...posts.map(([id]) => rel('SUPPORTED_BY', id, 'shelter-plinth')),
      rel('SUPPORTED_BY', 'shelter-beam-south', 'shelter-post-sw'),
      rel('SUPPORTED_BY', 'shelter-beam-south', 'shelter-post-se'),
      rel('SUPPORTED_BY', 'shelter-beam-north', 'shelter-post-nw'),
      rel('SUPPORTED_BY', 'shelter-beam-north', 'shelter-post-ne'),
      rel('SUPPORTED_BY', 'shelter-plane-south', 'shelter-beam-south'),
      rel('SUPPORTED_BY', 'shelter-plane-north', 'shelter-beam-north'),
      rel('COVERS', 'shelter-plane-south', 'shelter-plinth'),
    ]
  },
  expect: { assemblies: { ROOF: 2, CANOPY: 1 }, primitives: { Post: 4, Beam: 2, RoofPlane: 4, Ridge: 2 }, roofClassifications: ['GABLE', 'GABLE'], minRelationships: 11 },
}

export const exteriorEntranceSteps: ArchitecturalFixture = {
  id: 'exterior-entrance-steps',
  title: 'Entrance steps: three steps up to a landing at the front, one step onto a porch at the rear',
  capabilities: ['EXTERIOR_STEPS', 'ENTRANCE', 'HANDRAIL'],
  commands: () => {
    const h = house()
    return [
      ...h.commands,
      ...doorIn(h.walls.front, 'door-front', 4.5, 1.0, 2.1, 'ENTRANCE'),
      ...doorIn(h.walls.rear, 'door-rear', 4.5, 1.0, 2.1, 'SERVICE'),
      { type: 'createPlatform', id: 'landing-front', levelId: 'level-0', role: 'LANDING', polygon: rect(4.0, -1.3, 6.2, 0), topOffset: 0, thickness: 0.5, hostWallIds: [h.walls.front], materialId: MAT.paving, evidence: synthetic('landing') },
      { type: 'createStepRun', id: 'steps-front', levelId: 'level-0', role: 'ENTRANCE_STEPS', start: { x: 4.2, z: -2.2 }, direction: { x: 0, z: 1 }, width: 1.8, steps: 3, going: 0.3, topOffset: -0.125, baseOffset: -0.5, materialId: MAT.paving, evidence: synthetic('steps') },
      { type: 'createPlatform', id: 'porch-rear', levelId: 'level-0', role: 'PORCH', polygon: rect(3.0, 8, 7.0, 9.5), topOffset: 0, thickness: 0.3, hostWallIds: [h.walls.rear], materialId: MAT.paving, evidence: synthetic('porch') },
      { type: 'createStepRun', id: 'steps-rear', levelId: 'level-0', role: 'ENTRANCE_STEPS', start: { x: 5.8, z: 9.8 }, direction: { x: 0, z: -1 }, width: 1.8, steps: 1, going: 0.3, rise: 0.15, baseOffset: -0.3, materialId: MAT.paving, evidence: synthetic('step') },
      // a handrail along the landing's open side, from its front edge back to the facade
      { type: 'createRailing', id: 'landing-handrail', levelId: 'level-0', start: { x: 4.05, z: -1.3 }, end: { x: 4.05, z: 0 }, baseOffset: 0, height: 0.9, infill: 'NONE', hostId: 'landing-front', role: 'HANDRAIL', materialId: MAT.steel, evidence: synthetic('handrail') },
      assembly({ id: 'entrance-front', kind: 'ENTRANCE', doorId: 'door-front', landingId: 'landing-front', stepRunIds: ['steps-front'], supportIds: [], railingIds: ['landing-handrail'], hostIds: [h.walls.front], quality: 'COMPLETE' }),
      assembly({ id: 'stair-front', kind: 'EXTERIOR_STAIR', stepRunIds: ['steps-front'], landingIds: ['landing-front'], railingIds: ['landing-handrail'], hostIds: [h.walls.front], quality: 'COMPLETE' }),
      assembly({ id: 'entrance-rear', kind: 'ENTRANCE', doorId: 'door-rear', landingId: 'porch-rear', stepRunIds: ['steps-rear'], supportIds: [], railingIds: [], hostIds: [h.walls.rear], quality: 'COMPLETE' }),
      rel('TERMINATES_AT', 'steps-front', 'landing-front'),
      rel('TERMINATES_AT', 'steps-rear', 'porch-rear'),
      rel('ATTACHED_TO', 'landing-front', h.walls.front),
      rel('ATTACHED_TO', 'porch-rear', h.walls.rear),
      rel('OPENS_INTO', 'door-front', 'landing-front'),
      rel('OPENS_INTO', 'door-rear', 'porch-rear'),
      rel('ATTACHED_TO', 'landing-handrail', 'landing-front'),
    ]
  },
  expect: { assemblies: { ROOF: 1, ENTRANCE: 2, EXTERIOR_STAIR: 1 }, primitives: { ExteriorStepRun: 2, Step: 4, Landing: 2, Door: 2, Handrail: 1 }, roofClassifications: ['GABLE'], minRelationships: 9 },
}

/**
 * A feature the sources show but no reader can name: a raised panel over part
 * of the front slope, seen on two perspective renders only. It stays an
 * UnknownArchitecturalAssembly — its extent, the patch and the struts that
 * were measured, the readings it might be, why it is unresolved — and is not
 * forced into a dormer, dropped, or turned into anonymous mesh.
 */
export const unknownFeature: ArchitecturalFixture = {
  id: 'unknown-feature',
  title: 'A source-supported feature that cannot be classified',
  capabilities: ['UNKNOWN_ASSEMBLY'],
  commands: () => {
    const h = house()
    const t = Math.tan((35 * Math.PI) / 180)
    const top = (z: number): number => round(3.0 + 0.25 / Math.cos((35 * Math.PI) / 180) + z * t)
    const lift = 0.15
    const p = (x: number, z: number, above: number) => ({ x, y: round(top(z) + above), z })
    return [
      ...h.commands,
      ...windowIn(h.walls.front, 'window-front', 1.5, 0.9, 1.4, 1.3),
      { type: 'addEvidenceSource', id: 'src-render-a', kind: 'RENDER', label: 'perspective render A (synthetic)' },
      { type: 'addEvidenceSource', id: 'src-render-b', kind: 'RENDER', label: 'perspective render B (synthetic)' },
      assembly({
        id: 'unknown-roof-feature',
        kind: 'UNKNOWN',
        name: 'raised panel on the front slope',
        evidence: { status: 'VISUAL_INFERRED', source: 'two perspective renders', confidence: 0.35, sourceIds: ['src-render-a', 'src-render-b'] },
        hostIds: [h.roof.planeIds[0]],
        sourceEvidenceIds: ['src-render-a', 'src-render-b'],
        metricExtent: { min: { x: 6.5, y: top(1.0), z: 1.0 }, max: { x: 8.0, y: round(top(2.2) + lift), z: 2.2 } },
        approximateTopology: 'PLANAR',
        observedPlanesOrSegments: [
          { kind: 'PLANE', outline: [p(6.5, 1.0, lift), p(8.0, 1.0, lift), p(8.0, 2.2, lift), p(6.5, 2.2, lift)] },
          { kind: 'SEGMENT', start: p(6.6, 1.1, 0.02), end: p(6.6, 1.1, lift - 0.02) },
          { kind: 'SEGMENT', start: p(7.85, 1.1, 0.02), end: p(7.85, 1.1, lift - 0.02) },
        ],
        unresolvedReason: 'seen on two perspective renders only: no plan, section or elevation shows it, no roof interruption or vertical face was observed (so not a dormer), and it covers nothing a canopy would',
        alternatives: [
          { kind: 'DORMER', confidence: 0.2, why: 'a raised element on the slope — but the host roof is not interrupted' },
          { kind: 'ROOF', confidence: 0.15, why: 'a secondary plane over part of the slope — but no edge joins it to the roof' },
        ],
        quality: 'FRAGMENTARY',
      }),
    ]
  },
  expect: { assemblies: { ROOF: 1, UNKNOWN: 1 }, primitives: { RoofPlane: 2, Window: 1 }, roofClassifications: ['GABLE'], minRelationships: 2 },
}

void ring
