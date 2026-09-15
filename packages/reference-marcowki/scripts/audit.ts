/**
 * `npm run audit:marcowki` — prints the measured source parity of the
 * Marcówki reference model: every number the stage report quotes, taken
 * from the compiled triangles by the independent oracles in
 * `../test/measure.ts`. Exit code 1 when any headline metric misses.
 */
import { validateModel } from '@buildapp/model'
import { manifoldReport } from '@buildapp/verification'
import { solidTriangles } from '@buildapp/geometry'
import { MARCOWKI_LEDGER, createMarcowkiReferenceBuilding, marcowkiCommands } from '../src/index.js'
import { EXPECTED_OPENINGS, EXPECTED_SHELL, depthReport, marcowkiScene, openingReport, pairwiseOverlaps, railingReport, recessReport, ringReports, roofReport, roomBehindOpening, structuralSolids } from '../test/measure.js'

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

console.log('== Unresolved source evidence ==')
for (const l of MARCOWKI_LEDGER) console.log(`  ${l.id.padEnd(24)} ${l.kind.padEnd(24)} ${l.what}`)
console.log('')
console.log(failures === 0 ? 'AUDIT PASS' : `AUDIT FAIL (${failures} checks)`)
process.exit(failures === 0 ? 0 : 1)
