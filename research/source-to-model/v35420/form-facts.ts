/**
 * v3.54.20 accounting (0 USD, no grader): the form of a delivered model as the product's own structure readback measures
 * it — bodies under their own roof, the main body's roof kind, ridge axis and wall top — and the opening / structure
 * readback counts the run recorded. The same measurement for the baseline's models, which recorded no readback.
 *   vite-node form-facts.ts -- --json=<out.json> <run dir>...
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { readbackStructure } from '../../../packages/analysis-service/src/consult/readback.js'
import { STOREY_WALLS } from '../../../packages/analysis-service/src/consult/massing/massing.js'

const rows: Array<Record<string, unknown>> = []
const args = process.argv.slice(2).filter((a) => a !== '--')
for (const dir of args.filter((a) => !a.startsWith('--json='))) {
  if (!existsSync(`${dir}/model.json`)) { rows.push({ run: dir, model: false }); continue }
  const raw = JSON.parse(readFileSync(`${dir}/model.json`, 'utf8')) as { model?: unknown }
  const m = parseModel(JSON.stringify(raw.model ?? raw))
  const rb = readbackStructure(m, undefined, STOREY_WALLS)
  const main = [...rb.bodies].sort((a, b) => b.widthM * b.depthM - a.widthM * a.depthM)[0]
  const ext = new Set(m.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => w.id))
  const events = existsSync(`${dir}/events.json`) ? (JSON.parse(readFileSync(`${dir}/events.json`, 'utf8')) as unknown) : []
  const list = (Array.isArray(events) ? events : ((events as { events?: unknown[] }).events ?? [])) as Array<{ kind?: string; checks?: Array<{ property: string; taken: string; built: string; agrees: boolean }>; counts?: Record<string, number>; agreed?: Record<string, { standing?: string }>; form?: unknown; taken?: unknown }>
  const sr = list.filter((e) => e.kind === 'STRUCTURE_READBACK').pop()
  const or = list.filter((e) => e.kind === 'OPENINGS_READBACK').pop()
  const read = list.filter((e) => e.kind === 'STRUCTURE_READ').pop()
  rows.push({
    run: dir, model: true,
    bodies: rb.bodies.length, bodyList: rb.bodies,
    mainRoof: main?.roof, mainRidge: main?.ridgeAxis, mainWallTopM: main?.wallTopM,
    fullStoreys: main?.wallTopM === undefined ? undefined : main.wallTopM >= STOREY_WALLS.twoMinM ? 2 : 1,
    counts: { interiorWalls: m.walls.filter((w) => w.kind === 'INTERIOR').length, exteriorOpenings: m.openings.filter((o) => ext.has(o.wallId)).length, interiorDoors: m.openings.filter((o) => !ext.has(o.wallId)).length, roofWindows: m.roofOpenings.length, chimneys: m.chimneys.length },
    ...(sr ? { structureChecks: sr.checks, taken: sr.taken } : {}),
    ...(or ? { openingCounts: or.counts } : {}),
    ...(read?.agreed ? { standings: Object.fromEntries(Object.entries(read.agreed).filter(([, v]) => v && typeof v === 'object' && 'standing' in v).map(([k, v]) => [k, v.standing])) } : {}),
  })
}
const out = args.find((a) => a.startsWith('--json='))?.slice(7)
if (out) writeFileSync(out, JSON.stringify(rows, null, 1))
else console.log(JSON.stringify(rows, null, 1))
