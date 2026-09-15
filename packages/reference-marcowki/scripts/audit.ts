/**
 * `npm run audit:marcowki` — prints the measured source parity of the
 * Marcówki reference model: every number the stage report quotes, taken
 * from the compiled triangles by the independent oracles in
 * `../test/measure.ts`. Exit code 1 when any headline metric misses.
 */
import { polygonArea, validateModel } from '@buildapp/model'
import { boundsOf, manifoldReport, materialLength, meshVolume, upwardPlanes } from '@buildapp/verification'
import { solidTriangles } from '@buildapp/geometry'
import {
  EXPECTED_ASSEMBLIES,
  EXPECTED_REGIONS,
  EXPECTED_ROOFLIGHT_CUT,
  EXPECTED_STAIR,
  EXPECTED_STAIR_VOID_AREA,
  MARCOWKI_LEDGER,
  PAGE_FETCHED,
  PUBLISHED_CURRENT,
  PUBLISHED_ROOMS,
  REVISION_CONFLICTS,
  createMarcowkiReferenceBuilding,
  fact,
  marcowkiCommands,
} from '../src/index.js'
import {
  EXPECTED_OPENINGS,
  EXPECTED_SHELL,
  V,
  assemblyReport,
  depthReport,
  marcowkiScene,
  openingDimensionReport,
  openingReport,
  pairwiseOverlaps,
  railingReport,
  recessReport,
  regionReport,
  ringReports,
  roofReport,
  rooflightCutReport,
  roomBehindOpening,
  slabVoidReport,
  stairReport,
  structuralSolids,
} from '../test/measure.js'

const E = EXPECTED_SHELL
const s = marcowkiScene(createMarcowkiReferenceBuilding())
const f = (v: number, d = 3): string => v.toFixed(d)
let failures = 0
const check = (label: string, ok: boolean, detail: string): void => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${detail}`)
}

console.log(`Marcówki reference audit — ${s.model.name} (${s.model.id}), schema ${s.model.schemaVersion}`)
console.log(`commands ${marcowkiCommands().length}, validation issues ${validateModel(s.model).issues.length}, diagnostics ${s.scene.diagnostics.length}`)
console.log(`scene: ${s.scene.stats.triangleCount} triangles, ${s.scene.stats.meshCount} meshes, ${s.scene.stats.objectCount} objects; bounds x ${f(s.scene.bounds!.min.x)}..${f(s.scene.bounds!.max.x)} y ${f(s.scene.bounds!.min.y)}..${f(s.scene.bounds!.max.y)} z ${f(s.scene.bounds!.min.z)}..${f(s.scene.bounds!.max.z)}`)
console.log('')

console.log('== Depth and recesses ==')
const d = depthReport(s)
check('characteristic depth (front outer plane to rear outer plane)', Math.abs(d.characteristicDepth - E.characteristicDepth) < 1e-6, `${f(d.characteristicDepth)} m (source ${f(E.characteristicDepth)})`)
check('walled envelope (printed 1260)', Math.abs(d.nominalDepth - E.nominalDepth) < 1e-6, `${f(d.nominalDepth)} m`)
check('front zone', Math.abs(d.frontZone - E.frontZone) < 1e-6, `${f(d.frontZone)} m`)
check('rear zone', Math.abs(d.rearZone - E.rearZone) < 1e-6, `${f(d.rearZone)} m`)
for (const side of ['FRONT', 'REAR'] as const) {
  const r = recessReport(s, side)
  check(`${side.toLowerCase()} recess mouth: no material at the outer plane`, r.atOuterPlane === 0 && r.nearerThanStated === 0, `${r.rays} rays, ${r.atOuterPlane} at the plane, ${r.nearerThanStated} nearer than ${f(r.statedDepth, 2)}, shallowest ${f(r.shallowest)}, ${r.atBackPlane} at the back wall`)
  check(`${side.toLowerCase()} returns beside the mouth stand on the outer plane`, r.returnRaysAtPlane === r.returnRays, `${r.returnRaysAtPlane}/${r.returnRays} rays`)
}
console.log('')

console.log('== Shell closure ==')
const rings = ringReports(s)
for (const [name, r] of Object.entries(rings)) check(`${name} ring closed (probed at two heights)`, r.closed, `${r.probes} probes, ${r.gaps.length} gaps, ${r.overlaps.length} overlaps`)
const solids = structuralSolids(s.scene)
const open = [...solids].filter(([, t]) => !manifoldReport(t).closed).map(([id]) => id)
check('every structural solid is a closed manifold', open.length === 0, `${solids.size} solids${open.length ? ', open: ' + open.join(', ') : ''}`)
const overlaps = pairwiseOverlaps(s)
check('no two structural solids share volume', overlaps.length === 0, overlaps.length ? overlaps.join(', ') : 'none')
console.log('')

console.log('== Roof ==')
const roof = roofReport(s)
check('main roof pitch', roof.pitches.every((p) => Math.abs(p - E.pitchDeg) < 0.01), `${roof.pitches.map((p) => f(p, 2)).join('°, ')}°`)
check('ridge height', Math.abs(roof.ridgeY - E.ridge) < 1e-4, `${f(roof.ridgeY)} m (source ${f(E.ridge)})`)
check('roof extent front to rear', Math.abs(roof.maxZ - roof.minZ - E.characteristicDepth) < 1e-6, `${f(roof.minZ)}..${f(roof.maxZ)}`)
check('roof closed', roof.closed, `volume ${f(roof.volume)} m³, vertical thickness ${f(roof.drop, 4)}`)
check('eave walls meet the roof underside', roof.worstGap < 1e-6 && roof.worstOverlap < 1e-6, `worst gap ${roof.worstGap.toExponential(2)}, worst overlap ${roof.worstOverlap.toExponential(2)}`)
console.log('')

console.log('== Facade openings ==')
console.log('id                        printed   wall      through  beside  above   fill  room (source → model)')
for (const e of EXPECTED_OPENINGS) {
  const r = openingReport(s, e)
  const room = roomBehindOpening(s.model, e)
  const ok = r.found && r.through === 0 && Math.abs(r.beside - e.thickness) < 1e-9 && Math.abs(r.above - e.thickness) < 1e-9 && r.fillHost && r.fillInside && room === e.roomId && (!e.raked || r.headError < 1e-6)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${e.id.padEnd(24)} ${(e.printed ?? '—').padEnd(9)} ${e.wallId.padEnd(9)} ${f(r.through, 2).padEnd(8)} ${f(r.beside, 2).padEnd(7)} ${f(r.above, 2).padEnd(7)} ${String(r.fillParts).padEnd(5)} ${e.roomId} → ${room}${e.raked ? `  raked head error ${r.headError.toExponential(1)}` : ''}`)
}
console.log('')

console.log('== Balconies and railings ==')
for (const id of ['rail-front', 'rail-rear']) {
  const r = railingReport(s, id)
  check(`${id}: glass over the run`, r.coverage > 0.85 && r.glassParts === 1, `run ${f(r.run[0])}..${f(r.run[1])}, coverage ${f(r.coverage * 100, 1)} %, longest gap ${f(r.longestGap)}, top ${f(r.top)}`)
}
for (const id of ['balcony-front', 'balcony-rear', 'portal-head']) {
  const t = solidTriangles(s.scene, id)
  check(`${id} closed`, manifoldReport(t).closed, `${t.length} triangles`)
}
console.log('')

// ---------------------------------------------------------------------------
// STAGE BUILDAPP-01A
// ---------------------------------------------------------------------------

console.log('== Staircase (BUILDAPP-01A §4) ==')
const stair = stairReport(s)
const St = EXPECTED_STAIR
check('the stair is a real staircase, not a placeholder', stair.kind === 'FLIGHTS' && stair.parts.includes('STAIR_STEP'), `kind ${stair.kind}, parts ${stair.parts.join('+')}`)
check('one closed solid of positive volume', stair.closed && stair.volume > 0, `${f(stair.volume)} m³`)
check(`${St.risers} risers of ${f(St.riserHeight, 3)} m (3.06 / ${St.risers})`, stair.riserHeights.every((h) => Math.abs(h - St.riserHeight) < 1e-6), `measured ${f(Math.min(...stair.riserHeights), 4)}..${f(Math.max(...stair.riserHeights), 4)} over ${stair.riserHeights.length} treads`)
check('arrives exactly on the attic floor +3,06', Math.abs(stair.arrivalTop - E.upperFfl) < 1e-6, `${f(stair.arrivalTop)} m`)
check('first riser on the measured nosing line', Math.abs(stair.firstRiserX - St.start.x) < 1e-6, `x ${f(stair.firstRiserX)} (plan ${f(St.start.x)})`)
check('stays inside the shaft the plans draw', stair.bounds !== null && Math.abs(stair.bounds.min.x - St.extent.minX) < 1e-9 && Math.abs(stair.bounds.max.x - St.extent.maxX) < 1e-9 && Math.abs(stair.bounds.min.z - St.extent.minZ) < 1e-9 && Math.abs(stair.bounds.max.z - St.extent.maxZ) < 1e-9, `x ${f(St.extent.minX)}..${f(St.extent.maxX)} z ${f(St.extent.minZ)}..${f(St.extent.maxZ)}`)
console.log(`  counts: ${St.lowerRisers} straight (going ${f(St.lowerGoing, 4)}) SOURCE_DERIVED, ${St.winders} winders ${St.turn} 90° GEOMETRIC_INFERRED, ${St.upperRisers} straight (going ${f(St.upperGoing, 4)}) SOURCE_DERIVED; waist ${f(St.waist, 2)} ASSUMED`)
console.log(`  alternatives kept open: 3 winders → 0.191 m riser, 5 winders → 0.170 m (ledger stair-winder-count)`)
console.log('')

console.log('== Upper slab void (BUILDAPP-01A §5) ==')
const voidR = slabVoidReport(s)
check('the void is a first-class hole in the slab', voidR.holes === 1, `${voidR.holes} hole, ${f(voidR.holeArea)} m² (L-shaped, 6 corners)`)
check('the slab is watertight with the hole in it', voidR.closed, `volume ${f(voidR.volume)} m³`)
check('no slab anywhere inside the void', voidR.insideBlocked === 0, `${voidR.insideRays} rays on a 0.05 m grid`)
check('full thickness everywhere outside it', voidR.outsideThin === 0, `${voidR.outsideRays} rays at ${f(E.slabThickness, 2)} m`)
check('the void reaches the east inner face (a hole that touches the outline)', voidR.eastFaceOpen, 'ray 10 mm west of the face is open')
check('area matches the L the stair occupies', Math.abs(voidR.holeArea - EXPECTED_STAIR_VOID_AREA) < 1e-6, `${f(voidR.holeArea)} m² = ${f(St.extent.maxX - St.extent.minX)} × ${f(St.width)} + ${f(St.width)} × ${f(St.arrivalZ - St.southBand[1])}`)
console.log('')

console.log('== Rooflight cut mode (BUILDAPP-01A §6) ==')
for (const id of ['rl-pralnia-w', 'rl-lazienka-w', 'rl-schody-e']) {
  const r = rooflightCutReport(s, id)
  const ok = r.mode === 'NORMAL_TO_ROOF' && r.normalRaysBlocked === 0 && Math.abs(r.undersideShift - r.expectedShift) < 1e-4
  check(`${id}: cut normal to the roof`, ok, `${r.normalRays - r.normalRaysBlocked}/${r.normalRays} rays along the roof normal pass clean; underside shifted ${f(r.undersideShift, 4)} m uphill (predicted ${f(r.expectedShift, 4)} = ${f(fact('roof.buildUp'), 5)} × sin 40°)`)
}
check('chimney penetrations stay vertical', s.model.roofOpenings.filter((o) => o.kind === 'PENETRATION').every((o) => (o.cut ?? 'VERTICAL') === 'VERTICAL'), 'a stack rises vertically, so its hole must')
console.log('')

console.log('== Opening assemblies (BUILDAPP-01A §7) ==')
for (const [id, want] of Object.entries(EXPECTED_ASSEMBLIES)) {
  const r = assemblyReport(s, id)
  const ok = r.found && r.frameClosed && r.panels.join('+') === want.panels.join('+')
  check(`${id}`, ok, `${r.panels.length ? r.panels.join(' | ') : 'one plain leaf (nothing invented: no render shows its face)'}${r.glassSide ? `, sidelight on the ${r.glassSide === 'HIGH' ? 'far' : 'near'} side` : ''}; parts ${r.parts.join('+')}`)
}
console.log('')

console.log('== Finish regions (BUILDAPP-01A §9) ==')
for (const e of EXPECTED_REGIONS) {
  const r = regionReport(s, e)
  const ok = r.found && r.hostOk && !r.structural && r.openingRaysHit === 0 && Math.abs(r.thickness - 0.002) < 1e-6
  check(`${e.id} on ${e.hostId}`, ok, `${f(r.across[0])}..${f(r.across[1])} across, ${f(r.up[0])}..${f(r.up[1])} up; ${f(r.thickness * 1000, 1)} mm skin ${f(r.standOff * 1000, 1)} mm clear of the face; ${r.openingRays} opening rays, ${r.openingRaysHit} covered`)
}
console.log('')

// ---------------------------------------------------------------------------
// §12  Current published facts
// ---------------------------------------------------------------------------

console.log(`== Current ARCHON page fact parity (fetched ${PAGE_FETCHED}) ==`)
console.log('fact                         source     model      delta     cause')
const factRow = (label: string, source: number, model: number, cause: string, tol = 0.005): void => {
  const d = model - source
  const ok = Math.abs(d) <= tol
  if (!ok && cause === '') failures++
  console.log(`${ok ? 'PASS' : 'note'}  ${label.padEnd(26)} ${f(source, 2).padEnd(10)} ${f(model, 2).padEnd(10)} ${(d >= 0 ? '+' : '') + f(d, 3)}`.padEnd(66) + cause)
}
const roomArea = (id: string): number => polygonArea(s.model.rooms.find((r) => r.id === id)!.polygon)
// The published house figure is the fifteen counted rooms plus the Schody; the kotłownia and the garage are
// outside it. Checking that composition proves the published room table was transcribed correctly.
const counted = PUBLISHED_ROOMS.filter((r) => r.counted)
const publishedNetSum = counted.reduce((a, r) => a + r.net, 0) + PUBLISHED_CURRENT.stairsArea
check('the published room table composes into the published house area', Math.abs(publishedNetSum - PUBLISHED_CURRENT.houseNetArea) < 0.005, `${counted.length} counted rooms net ${f(publishedNetSum - PUBLISHED_CURRENT.stairsArea)} + Schody ${f(PUBLISHED_CURRENT.stairsArea, 2)} = ${f(publishedNetSum)} (page ${f(PUBLISHED_CURRENT.houseNetArea, 2)})`)
const modelHouse = counted.reduce((a, r) => a + roomArea(r.roomId), 0) + roomArea('u-stairs')
const publishedGrossSum = counted.reduce((a, r) => a + (r.gross ?? r.net), 0) + PUBLISHED_CURRENT.stairsArea
factRow('house area vs published net', PUBLISHED_CURRENT.houseNetArea, modelHouse, 'net is measured to finished surfaces (≈20 mm of finish per face); the model’s rooms are plan polygons to structure')
factRow('house area vs published gross', publishedGrossSum, modelHouse, `the page’s own gross column where it prints one (${counted.filter((r) => r.gross).length} of ${counted.length} rooms); the residual is the finish the page still takes off the rooms it prints net only, and the stair projection`)
factRow('garage', PUBLISHED_CURRENT.garageArea, roomArea('g-garage'), 'same: gross-to-structure against a finished-surface figure')
factRow('kotłownia (boiler room)', PUBLISHED_CURRENT.boilerArea, roomArea('g-boiler'), 'same')
factRow('Schody (stairs)', PUBLISHED_CURRENT.stairsArea, roomArea('u-stairs'), 'the page counts the stair by a projection no drawing shows; the model’s compartment and its 4.158 m² void come from the plans (ledger schody-area)')
factRow('footprint (pow. zabudowy)', PUBLISHED_CURRENT.footprintArea, E.mainWidth * E.nominalDepth + (E.overallWidth - E.mainWidth) * E.garageDepth, 'the printed chains 790+415 / 510+750 close on 130.665; the published figure is 0.38 % above and never moves a chain (ledger footprint-area)')
factRow('building height', PUBLISHED_CURRENT.buildingHeight, roofReport(s).ridgeY - E.terrain, '')
factRow('knee wall', PUBLISHED_CURRENT.kneeWall, E.eaveUnderside - E.upperFfl, '')
factRow('roof pitch (deg)', PUBLISHED_CURRENT.roofPitchDeg, roofReport(s).pitches[0], '')
// the roof area is a published aggregate that happens to close exactly on the modelled extent
const roofTris = solidTriangles(s.scene, 'roof-main')
const slopeArea = upwardPlanes(roofTris).filter((p) => p.area >= 1).reduce((a, p) => a + p.area, 0)
const COS40 = Math.cos((fact('roof.pitch') * Math.PI) / 180)
// every hole the model cuts removes sloped area, so add them all back to compare like with like
const holeArea = s.model.roofOpenings.filter((o) => o.roofId === 'roof-main').reduce((a, o) => a + ((o.footprint.maxX - o.footprint.minX) * (o.footprint.maxZ - o.footprint.minZ)) / COS40, 0)
factRow('roof area', PUBLISHED_CURRENT.roofArea, slopeArea + holeArea, `measured slopes ${f(slopeArea)} + the holes cut in them ${f(holeArea)} (3 rooflights, 2 flues) = the sloped area of the FULL 14.60 m extent at 40°: the published aggregate closes on the modelled roof to ${f(Math.abs(PUBLISHED_CURRENT.roofArea - slopeArea - holeArea) * 1000, 0)} mm², corroborating extent and pitch together`, 0.02)
console.log('')
console.log('room                     published  model     delta   (net → gross where the page prints both)')
for (const r of PUBLISHED_ROOMS) {
  const a = roomArea(r.roomId)
  const ref = r.gross ?? r.net
  const d = a - ref
  console.log(`      ${(r.label + ' ' + r.roomId).padEnd(24)} ${f(ref, 2).padEnd(10)} ${f(a, 2).padEnd(9)} ${(d >= 0 ? '+' : '') + f(d, 2)}${r.gross ? `   (net ${f(r.net, 2)})` : ''}${r.counted ? '' : '   not counted in the usable area'}`)
}
console.log('')
console.log('Source revision policy (docs/MARCOWKI_SOURCE_REVISION_POLICY.md):')
for (const c of REVISION_CONFLICTS.filter((x) => x.olderCard !== null && x.currentPage !== x.olderCard)) {
  console.log(`      ${c.fact.padEnd(38)} current ${f(c.currentPage, 2)}  older card ${f(c.olderCard!, 2)}  → uses ${c.uses}${c.affectsGeometry ? '' : ' (no geometry depends on it)'}`)
}
console.log('')

// ---------------------------------------------------------------------------
// §13  Opening dimensions, shape and evidence
// ---------------------------------------------------------------------------

console.log('== Opening dimension and shape audit (BUILDAPP-01A §13) ==')
console.log('id                        printed   measured w × h      sill   head near/far   shape    worst    width/height evidence')
for (const e of EXPECTED_OPENINGS) {
  const d = openingDimensionReport(s, e)
  const o = s.model.openings.find((x) => x.id === e.id)!
  const ev = o.evidence!
  const widthStatus = ev.properties?.width ?? ev.status
  const heightStatus = ev.properties?.height ?? ev.status
  const ok = d.found && d.worst < 1e-6 && d.raked === e.raked
  if (!ok) failures++
  const w = d.span[1] - d.span[0]
  const h = Math.max(e.headNear, e.headFar) - e.sill
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${e.id.padEnd(24)} ${(e.printed ?? '—').padEnd(9)} ${`${f(w, 2)} × ${f(h, 2)}`.padEnd(19)} ${f(e.sill, 2).padEnd(6)} ${`${f(d.headLow, 2)}/${f(d.headHigh, 2)}`.padEnd(14)} ${(e.raked ? 'raked' : 'level').padEnd(8)} ${d.worst.toExponential(1).padEnd(8)} ${widthStatus} / ${heightStatus}`,
  )
}
const assumedHeads = s.model.openings.filter((o) => o.evidence?.properties?.height === 'ASSUMED')
console.log(`      ${assumedHeads.length} opening heights remain ASSUMED and say so: ${assumedHeads.length - 11} facade (the concealed kotłownia door) + 11 interior doors at 2.00 m`)
console.log('')

// ---------------------------------------------------------------------------
// §14  Walls
// ---------------------------------------------------------------------------

console.log('== Wall audit (BUILDAPP-01A §14) ==')
console.log('chain                            printed   model     delta')
const chainRow = (label: string, printed: number, model: number): void => {
  const ok = Math.abs(model - printed) < 1e-6
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} ${f(printed, 2).padEnd(10)} ${f(model, 2).padEnd(9)} ${f(model - printed, 4)}`)
}
const dr = depthReport(s)
const allSolids = [...structuralSolids(s.scene).values()]
const overallWidth = (() => {
  let min = Infinity
  let max = -Infinity
  for (const t of allSolids) {
    const b = boundsOf(t)!
    min = Math.min(min, b.min.x)
    max = Math.max(max, b.max.x)
  }
  return max - min
})()
chainRow('overall width 1205', fact('plan.overallWidth'), overallWidth)
chainRow('main body 790', fact('plan.mainBodyWidth'), E.mainWidth)
chainRow('garage 415', fact('plan.garageWidth'), E.overallWidth - E.mainWidth)
chainRow('walled depth 1260', fact('plan.overallDepth'), dr.nominalDepth)
chainRow('characteristic depth 1460', E.characteristicDepth, dr.characteristicDepth)
chainRow('garage depth 750', fact('plan.garageDepth'), E.garageDepth)
// wall thicknesses, measured by rays across each leaf
const across = (id: string, o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }): number => materialLength(solidTriangles(s.scene, id), o, d)
// z 3.0 is clear of both west windows (living 9.047..9.947, kitchen 6.798..8.198)
const extThickness = across('g-left', V(-1, 1.5, 3.0), V(1, 0, 0))
const partition = across('gw-kitchen-south', V(2, 1.5, -1), V(0, 0, 1))
const returnT = across('ret-west-front', V(-1, 1.5, 0.5), V(1, 0, 0))
const boilerNorth = across('gw-boiler-north', V(6.4, 1.5, -1), V(0, 0, 1))
check('external wall 0.45 (25 + 20 build-up, not printed as a figure)', Math.abs(extThickness - 0.45) < 1e-9, `${f(extThickness)} m, SOURCE_CORROBORATED (section fill 0.455, plan fill 0.475)`)
check('interior partition 0.12', Math.abs(partition - 0.12) < 1e-9, `${f(partition)} m, SOURCE_CORROBORATED`)
check('wall return 0.61', Math.abs(returnT - 0.61) < 1e-9, `${f(returnT)} m, SOURCE_DERIVED from the row scans past the walled envelope`)
check('kotłownia north wall 0.26', Math.abs(boilerNorth - 0.26) < 1e-9, `${f(boilerNorth)} m, SOURCE_CORROBORATED`)
const footprintChains = E.mainWidth * E.nominalDepth + (E.overallWidth - E.mainWidth) * E.garageDepth
console.log(`note  footprint from the chains ${f(footprintChains)} m² against the published ${f(PUBLISHED_CURRENT.footprintArea)} m²: ${f((100 * (PUBLISHED_CURRENT.footprintArea - footprintChains)) / footprintChains, 2)} % — recorded, never closed by moving a chain`)
console.log('')

// ---------------------------------------------------------------------------
// §15  Roof
// ---------------------------------------------------------------------------

console.log('== Roof audit (BUILDAPP-01A §15) ==')
const ro = roofReport(s)
check('pitch 40° from the emitted normals', ro.pitches.every((p) => Math.abs(p - 40) < 0.01), `${ro.pitches.map((p) => f(p, 3)).join('°, ')}°`)
check('ridge +7,95', Math.abs(ro.ridgeY - 7.95) < 1e-4, `${f(ro.ridgeY)} m`)
check('knee wall 1.30 above the attic floor', Math.abs(E.eaveUnderside - E.upperFfl - 1.3) < 1e-9, `roof underside at the eave ${f(E.eaveUnderside)} m`)
check('building height 8.27 above terrain', Math.abs(ro.ridgeY - E.terrain - 8.27) < 1e-4, `${f(ro.ridgeY - E.terrain)} m = 7.95 + 0.32`)
check('roof spans the full 14.60 m silhouette', Math.abs(ro.maxZ - ro.minZ - 14.6) < 1e-6, `z ${f(ro.minZ)}..${f(ro.maxZ)}`)
check('three 78/118 rooflights, all cut normal to the roof', s.model.roofOpenings.filter((o) => o.kind === 'ROOFLIGHT').every((o) => o.cut === 'NORMAL_TO_ROOF'), `each ${f(fact('rooflight.width'), 2)} across the ridge × ${f(fact('rooflight.slopeLength'), 2)} up the slope; the lower reveals face up at ${f(EXPECTED_ROOFLIGHT_CUT.revealPitchDeg, 0)}° (90° − pitch)`)
check('the eave walls carry the roof with no gap and no overlap', ro.worstGap < 1e-6 && ro.worstOverlap < 1e-6, `worst gap ${ro.worstGap.toExponential(2)} m, worst overlap ${ro.worstOverlap.toExponential(2)} m`)
console.log(`note  the printed eave datum +4,67 sits ${f(fact('level.printedEave') - fact('level.eave'), 3)} m above the structural plane ${f(fact('level.eave'), 5)} the model uses;`)
console.log(`      taking +4,67 would make the built pitch 39.71° against the printed 40°. Both readings are kept (ledger eave-datum, constraint c-eave-datum).`)
console.log(`      garage flat roof top ${f(E.garageRoofTop)} m; the elevations read a parapet band at ${f(fact('garage.bandTop'))} m, ~0.2 m the section does not draw (ledger garage-roof-level).`)
console.log('')

console.log('== Unresolved source evidence ==')
for (const l of MARCOWKI_LEDGER) console.log(`  ${l.id.padEnd(24)} ${l.kind.padEnd(24)} ${l.what}`)
console.log('')
console.log(failures === 0 ? 'AUDIT PASS' : `AUDIT FAIL (${failures} checks)`)
process.exit(failures === 0 ? 0 : 1)
