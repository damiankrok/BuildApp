/**
 * N7-P1: the partial 3D preview on the eight development houses' REAL emitted programs.
 *
 * Each case perturbs one command of a real program the way a reading goes wrong, and runs the production path
 * (`fitPreviewProgram`, exactly what `reconstructV2` calls) → the model → the compiled scene → the scene bundle →
 * its read-back → the replay of the fitted program → the base checkpoint's prefix replay. Cases:
 *
 *   SLIVER_ATTACHED   an attached ring narrowed below its own two walls (the owner's failure: WALLS_OVERLAP between
 *                     the ring's w1 and w3); a house with no attached body gets one, beside its main body
 *   SLIVER_OUTER      the same, narrowed from the main body's side: the ring keeps its outer face, and what stands
 *                     against that face (a recess's return) goes with it
 *   BAD_WINDOW        the first exterior window's frame deeper than its wall
 *   BAD_ROOF          the main roof names a wall that does not exist (or its first plane an unknown level)
 *   UPPER_MAIN        the main body's upper storey ring narrowed below its walls
 *   MAIN_GROUND       the main body's ground ring narrowed below its walls — must REFUSE (no house is made up)
 *   UNCHANGED         the program as emitted — must be the plain fit, command for command
 *
 *   npx vite-node research/analyzer-005y-n7-p1/partial-preview-stress.ts -- <replay-root with <house>/program.json> <out.json>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { serializeModel } from '@buildapp/model'
import { buildMobileSceneBundle, loadBundle, serializeBundle } from '@buildapp/mobile-scene'
import { sha256Hex } from '@buildapp/source-common'
import { buildCandidateModel, fitOpeningsToHosts, fitPreviewProgram, previewCheckpoint } from '../../packages/reconstruction/src/candidate.js'
import { applyCommands } from '@buildapp/commands'
import { createEmptyModel } from '@buildapp/model'

const HOUSES = ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3']
const [root, outPath] = process.argv.slice(-2)
type Ring = Extract<BuildingCommand, { type: 'createWallRing' }>
type Expect = 'PARTIAL' | 'REFUSED' | 'UNCHANGED'
type Case = { name: string; expect: Expect; program: BuildingCommand[]; note: string }

const clone = (p: BuildingCommand[]): BuildingCommand[] => JSON.parse(JSON.stringify(p))
const idOf = (c: BuildingCommand): string | undefined => ('id' in c && typeof c.id === 'string' ? c.id : undefined)
/** A ring narrowed along x to 1.5 wall thicknesses: its east and west walls in one band. `keep` is the face that stays. */
const sliver = (r: Ring, keep: 'MIN' | 'MAX' = 'MIN'): Ring => {
  const x0 = Math.min(...r.polygon.map((p) => p.x))
  const x1 = Math.max(...r.polygon.map((p) => p.x))
  const w = 1.5 * r.thickness
  const r6 = (v: number): number => Math.round(v * 1e6) / 1e6
  return { ...r, polygon: r.polygon.map((p) => (keep === 'MIN' ? { x: p.x > x0 + 1e-6 ? r6(x0 + w) : p.x, z: p.z } : { x: p.x < x1 - 1e-6 ? r6(x1 - w) : p.x, z: p.z })) }
}

function casesOf(program: BuildingCommand[]): Case[] {
  const out: Case[] = [{ name: 'UNCHANGED', expect: 'UNCHANGED', program, note: 'as emitted' }]
  const rings = program.map((c, i) => [c, i] as const).filter((x): x is readonly [Ring, number] => x[0].type === 'createWallRing')
  const attached = rings.find(([r]) => /^ring-attached-/.test(r.id ?? ''))
  const main0 = rings.find(([r]) => r.id === 'ring-main-0')
  const main1 = rings.find(([r]) => r.id === 'ring-main-1')
  if (attached) {
    const p = clone(program)
    p[attached[1]] = sliver(attached[0])
    out.push({ name: 'SLIVER_ATTACHED', expect: 'PARTIAL', program: p, note: `${attached[0].id} at command ${attached[1]} narrowed to 1.5 T against the main body` })
    const q = clone(program)
    q[attached[1]] = sliver(attached[0], 'MAX')
    out.push({ name: 'SLIVER_OUTER', expect: 'PARTIAL', program: q, note: `${attached[0].id} at command ${attached[1]} narrowed to 1.5 T at its outer face` })
  } else if (main0) {
    const p = clone(program)
    const [r, i] = main0
    const x1 = Math.max(...r.polygon.map((q) => q.x))
    const z0 = Math.min(...r.polygon.map((q) => q.z))
    const T = r.thickness
    const ring: Ring = { ...r, id: 'ring-attached-9-0', polygon: [{ x: x1, z: z0 + 1 }, { x: x1 + 1.5 * T, z: z0 + 1 }, { x: x1 + 1.5 * T, z: z0 + 4 }, { x: x1, z: z0 + 4 }], topProfile: undefined } as Ring
    delete (ring as { topProfile?: unknown }).topProfile
    p.splice(i + 1, 0, { type: 'createSlab', id: 'slab-attached-9-0', levelId: r.levelId, polygon: ring.polygon, topOffset: 0, thickness: 0.25 } as BuildingCommand, ring)
    out.push({ name: 'SLIVER_ATTACHED', expect: 'PARTIAL', program: p, note: `a sliver body inserted beside ${r.id} at command ${i + 2}` })
  }
  const win = program.findIndex((c, i) => c.type === 'placeWindow' && program.slice(0, i).some((o) => o.type === 'cutOpening' && o.id === c.openingId && /^ring-main-/.test(o.wallId)))
  if (win >= 0) {
    const p = clone(program)
    p[win] = { ...(p[win] as Extract<BuildingCommand, { type: 'placeWindow' }>), frameDepth: 1.5, frameInset: 0.6 }
    out.push({ name: 'BAD_WINDOW', expect: 'PARTIAL', program: p, note: `${idOf(program[win])} at command ${win} framed 1.5 m deep` })
  }
  const roof = program.findIndex((c) => c.type === 'createRoof' && c.id === 'roof-main')
  if (roof >= 0) {
    const p = clone(program)
    const r = p[roof] as Extract<BuildingCommand, { type: 'createRoof' }>
    p[roof] = { ...r, capWallIds: [...(r.capWallIds ?? []), 'no-such-wall'] }
    out.push({ name: 'BAD_ROOF', expect: 'PARTIAL', program: p, note: `roof-main at command ${roof} caps an unknown wall` })
  }
  if (main1) {
    const p = clone(program)
    p[main1[1]] = sliver(main1[0])
    out.push({ name: 'UPPER_MAIN', expect: 'PARTIAL', program: p, note: `ring-main-1 at command ${main1[1]} narrowed to 1.5 T` })
  }
  if (main0) {
    const p = clone(program)
    p[main0[1]] = sliver(main0[0])
    out.push({ name: 'MAIN_GROUND', expect: 'REFUSED', program: p, note: `ring-main-0 at command ${main0[1]} narrowed to 1.5 T` })
  }
  return out
}

const rows: unknown[] = []
let bad = 0
for (const house of HOUSES) {
  const file = join(root, house, 'program.json')
  if (!existsSync(file)) continue
  const program = JSON.parse(readFileSync(file, 'utf8')) as BuildingCommand[]
  const label = `stress ${house}`
  const modelId = `m-stress-${house}`
  for (const c of casesOf(program)) {
    const options = { label, modelId, mainMassId: 'main', toleranceM: 0.06 }
    const r = fitPreviewProgram(c.program, options)
    const outcome: Expect = !r.fit.ok ? 'REFUSED' : r.failures.length > 0 ? 'PARTIAL' : 'UNCHANGED'
    const row: Record<string, unknown> = { house, case: c.name, note: c.note, expect: c.expect, outcome, basis: r.basis, failures: r.failures.map((f) => `${f.commandIndex} ${f.type} ${f.id ?? ''} ${f.codes.join(',')}`), skipped: r.skipped.filter((s) => s.type !== 'setEvidence').map((s) => `${s.id ?? s.type}:${s.cause}`) }
    if (c.expect === 'UNCHANGED') {
      const plain = fitOpeningsToHosts(c.program, label, modelId)
      row.identicalToPlainFit = JSON.stringify(plain) === JSON.stringify(r.fit)
      if (!row.identicalToPlainFit) bad += 1
    }
    if (r.fit.ok) {
      const model = buildCandidateModel(r.fit.program, label, modelId)
      const scene = compileBuilding(model)
      const text = serializeBundle(buildMobileSceneBundle(model, { scene }))
      const back = loadBundle(text)
      const replay = sha256Hex(serializeModel(buildCandidateModel(r.fit.program, label, modelId))) === sha256Hex(serializeModel(model))
      const cp = previewCheckpoint(r.fit.program, 'main', label, modelId)
      const prefix = cp ? applyCommands(createEmptyModel(modelId, label), r.fit.program.slice(0, cp.commands)) : undefined
      Object.assign(row, { wallRings: model.wallRings.map((w) => w.id), walls: model.walls.length, openings: model.openings.length, roofs: model.roofs.length + model.roofPlanes.length, meshes: scene.meshes.length, bundleRoundTrip: back.ok && back.bundle.contentHash !== undefined, replay, checkpoint: cp ? { commands: cp.commands, wallRings: cp.wallRings, prefixReplays: !!prefix && prefix.failedAt === undefined && sha256Hex(serializeModel(prefix.model)) === cp.modelSha256 } : null })
      if (!back.ok || !replay || (cp && !(row.checkpoint as { prefixReplays: boolean }).prefixReplays)) bad += 1
      if (c.name.startsWith('SLIVER') && house === (process.env.SAVE_HOUSE ?? 'marcowki')) writeFileSync(join(root, house, `${c.name.toLowerCase()}-preview-model.json`), serializeModel(model))
    }
    if (outcome !== c.expect) bad += 1
    rows.push(row)
    console.log(`${house} ${c.name.padEnd(16)} ${outcome.padEnd(9)} ${outcome === c.expect ? 'ok' : `EXPECTED ${c.expect}`} ${(row.failures as string[]).join(' | ')}`)
  }
}
writeFileSync(outPath, JSON.stringify({ rows, bad }, null, 1) + '\n')
console.log(`${rows.length} cases, ${bad} unexpected`)
process.exitCode = bad > 0 ? 1 : 0
