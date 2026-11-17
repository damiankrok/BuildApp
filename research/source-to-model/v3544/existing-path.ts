/**
 * v3.54.4, experiment M, variant 2 — the SAME agreed geometry handed to the path that existed before this campaign:
 * the v3.54.1 house description → BuildingV2 (rectangular masses) → emitter → kernel → compiler.
 *
 *   npx vite-node research/source-to-model/v3544/existing-path.ts -- --house <resolved house.json> --out <dir>
 *
 * It answers one question: given correct data, what does the earlier representation lose? Every value comes from the
 * resolved document; what the earlier contract cannot say is listed in lost.json, not approximated silently.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { parseHouseDocument, reconstructFromHouseDescription, housePoly } from '@buildapp/reconstruction'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const out = arg('out') as string
mkdirSync(out, { recursive: true })
const parsed = parseHouseDocument(JSON.parse(readFileSync(arg('house') as string, 'utf8')))
if (!parsed.ok || !parsed.document.geometry) throw new Error('a resolved house document is needed')
const g = parsed.document.geometry
const lost: Array<{ what: string; why: string }> = []
const levelY = (i: number): number => g.levels.find((l) => l.index === i)?.elevation.value ?? 0
const whole = housePoly.bbox(g.outlines.find((o) => o.level === 0)?.polygon ?? g.bodies[0].outline)
const sideOf = (out: { x: number; z: number }): 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' => (Math.abs(out.z) >= Math.abs(out.x) ? (out.z < 0 ? 'FRONT' : 'REAR') : out.x < 0 ? 'LEFT' : 'RIGHT')
const hostOf = (id: string): { a: { x: number; z: number }; u: { x: number; z: number }; out: { x: number; z: number }; bodyId: string } | undefined => {
  const m = /^wall-(\d+)-(\d+)$/.exec(id)
  const poly = m ? g.outlines.find((o) => o.level === Number(m[1]))?.polygon : undefined
  if (!m || !poly) return undefined
  const e = housePoly.edgeOf(poly, Number(m[2]))
  const mid = { x: (e.a.x + e.b.x) / 2, z: (e.a.z + e.b.z) / 2 }
  const body = g.bodies.find((b) => housePoly.onBoundary(b.outline, mid, 0.05) >= 0) ?? g.bodies[0]
  return { a: e.a, u: e.u, out: e.out, bodyId: body.id }
}
const common = { images: [1], confidence: 1 }
const bodies = g.bodies.map((b) => {
  const bb = housePoly.bbox(b.outline)
  if (housePoly.area(b.outline) < (bb.x1 - bb.x0) * (bb.z1 - bb.z0) - 0.05) lost.push({ what: `body ${b.id} outline`, why: `a ${b.outline.length}-corner outline of ${housePoly.area(b.outline).toFixed(1)} m² is given as its rectangle ${((bb.x1 - bb.x0) * (bb.z1 - bb.z0)).toFixed(1)} m²: the earlier contract has x0,x1,z0,z1 only` })
  const ridge = b.roof.ridgeY.value ?? 0
  const pitch = b.roof.pitchDeg.value ?? 0
  const span = b.roof.ridgeAxis === 'Z' ? bb.x1 - bb.x0 : bb.z1 - bb.z0
  const eaves = b.roof.kind === 'FLAT' ? ridge : ridge - (span / 2) * Math.tan((pitch * Math.PI) / 180)
  const top = Math.max(...b.storeys)
  return {
    id: b.id, role: b.role === 'OTHER' ? ('OTHER' as const) : b.role, x0: bb.x0, x1: bb.x1, z0: bb.z0, z1: bb.z1,
    storeys: Math.max(1, b.roof.kind === 'FLAT' ? b.storeys.length : top), habitableAttic: b.roof.kind !== 'FLAT' && top > 0,
    eavesHeightM: Math.max(1.8, Math.round(eaves * 100) / 100), heightBasis: 'PRINTED_ON_DRAWING' as const,
    roof: { kind: b.roof.kind, ridge: b.roof.kind === 'GABLE' || b.roof.kind === 'HIP' ? (b.roof.ridgeAxis === 'Z' ? ('ALONG_Z' as const) : ('ALONG_X' as const)) : ('NA' as const), highSide: b.roof.kind === 'SHED' ? (b.roof.highSide ?? 'REAR') : ('NA' as const), pitchDeg: pitch, pitchBasis: 'PRINTED_ON_DRAWING' as const, overhangM: b.roof.overhangM.value ?? 0 },
    wallColour: '#cfcfcf', ...common,
  }
})
const openings = g.openings.flatMap((o) => {
  const h = hostOf(o.hostWall)
  if (!h || o.offsetM.value === null || o.widthM.value === null || o.heightM.value === null || o.sillM.value === null) return []
  const c = { x: h.a.x + h.u.x * (o.offsetM.value + o.widthM.value / 2), z: h.a.z + h.u.z * (o.offsetM.value + o.widthM.value / 2) }
  const side = sideOf(h.out)
  return [{ bodyId: h.bodyId, side, storey: o.level, kind: o.kind === 'DOOR' ? ('ENTRANCE_DOOR' as const) : o.kind, at: side === 'FRONT' || side === 'REAR' ? c.x : c.z, widthM: o.widthM.value, sillM: Math.min(3, Math.max(0, o.sillM.value)), heightM: o.heightM.value, panes: Math.min(8, Math.max(1, o.panes ?? 1)), basis: 'PLAN_AND_ELEVATION' as const, ...common }]
})
const dormers = g.dormers.flatMap((d) => {
  const h = hostOf(d.hostWall)
  if (!h || d.fromM.value === null || d.toM.value === null) return []
  const mid = (d.fromM.value + d.toM.value) / 2
  const c = { x: h.a.x + h.u.x * mid, z: h.a.z + h.u.z * mid }
  const side = sideOf(h.out)
  if (d.kind === 'WALL_GABLE') lost.push({ what: `dormer ${d.id}`, why: 'a wall dormer (its face continues the facade, its own eaves and apex known) is given as a dormer on the slope: the earlier contract has type, centre and width only, no heights and no relation to the wall' })
  return [{ bodyId: d.bodyId, slope: side, type: d.kind === 'ROOF_SHED' ? ('SHED' as const) : ('GABLE' as const), at: side === 'FRONT' || side === 'REAR' ? c.x : c.z, widthM: Math.abs(d.toM.value - d.fromM.value), ...common }]
})
const balconies = g.balconies.map((b) => {
  const r = b.rect
  const front = Math.abs(r.z0 - whole.z0) < Math.abs(r.z1 - whole.z1)
  if (b.posts.length > 0) lost.push({ what: `balcony ${b.id}`, why: 'the posts it stands on (a portico) have no field in the earlier balcony' })
  return { bodyId: g.bodies[0].id, side: front ? ('FRONT' as const) : ('REAR' as const), storey: Math.max(1, b.level), from: r.x0, to: r.x1, depthM: Math.abs(r.z1 - r.z0), railing: 'BARS' as const, ...common }
})
const ridgeTop = Math.max(...g.bodies.map((b) => b.roof.ridgeY.value ?? 0))
const description = {
  images: [{ image: 1, kind: 'FLOOR_PLAN', storey: 'GROUND', shows: 'NA', thisHouse: true, mirrored: false, note: 'manual diagnostic' }],
  frame: { planImage: 1, frontIsPlanEdge: 'BOTTOM', how: 'manual diagnostic: the frame of the resolved document' },
  overall: { widthM: whole.x1 - whole.x0, depthM: whole.z1 - whole.z0, basis: 'PRINTED_ON_DRAWING', printedWidthLabel: '', printedDepthLabel: '', ridgeHeightM: ridgeTop, ridgeHeightBasis: 'PRINTED_ON_DRAWING', storeyHeightM: Math.min(4.5, Math.max(2.2, levelY(1) || 2.8)) },
  bodies,
  sides: (['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const).map((side) => ({ side, pictures: [1], openingsByStorey: [0, 1].map((s) => openings.filter((o) => o.side === side && o.storey === s).length) })),
  openings, dormers, rooflights: [], chimneys: [], balconies, terraces: [], canopies: [],
  palette: { roof: '#555555', joinery: '#ffffff', garageDoor: '#444444', accent: '#888888', accentWhere: '' },
  hypotheticalSides: [], unknowns: [],
}
writeFileSync(join(out, 'description.json'), `${JSON.stringify(description, null, 1)}\n`)
const r = reconstructFromHouseDescription(description as never, `existing-${parsed.document.id}`)
if (!r.ok) {
  writeFileSync(join(out, 'lost.json'), `${JSON.stringify({ built: false, reason: r.reason, lost, adjustments: r.adjustments }, null, 1)}\n`)
  process.stdout.write(`NOT BUILT: ${r.reason}\n`)
  process.exit(0)
}
const model = parseModel(r.modelJson)
const scene = compileBuilding(model as never)
const bundle = buildMobileSceneBundle(model as never, { scene })
const measured = measureScene(bundle)
writeFileSync(join(out, 'model.json'), r.modelJson)
writeFileSync(join(out, 'scene.json'), serializeBundle(bundle))
writeFileSync(join(out, 'measured.json'), `${JSON.stringify(measured, null, 1)}\n`)
writeFileSync(join(out, 'lost.json'), `${JSON.stringify({ built: true, lost, adjustments: r.adjustments, refused: r.refused, emitterNotes: r.emitterNotes }, null, 1)}\n`)
for (const v of renderModelViews(bundle, 520)) writeFileSync(join(out, `views-${v.name}.png`), v.png)
const { objects: _objects, ...summary } = measured
process.stdout.write(`BUILT: ${bundle.scene.meshes.length} meshes; lost ${lost.length}; adjustments ${r.adjustments.length}; refused ${r.refused.length}\n${JSON.stringify(summary)}\n${lost.map((l) => `LOST ${l.what}: ${l.why}`).join('\n')}\n${r.adjustments.map((a) => `ADJUSTED ${a.code} ${a.subject}: ${a.why}`).join('\n').slice(0, 2500)}\n`)
