/**
 * v3.54.4 — the scorer of the whole exterior: one kernel model against one source-only reference.
 *
 *   npx vite-node research/source-to-model/v3544/score.ts -- --refs <dir of references> --list <list file> \
 *       --h <root of house-run outputs> --local <root of LOCAL runs> --out <json>
 *
 * The same measurements are taken from any model (LOCAL's or the described house's): nothing here knows which pipeline
 * made it. Six groups; a group with nothing in the reference to hold the model against is NA, never a pass:
 *   METRIC    overall width and depth of the exterior walls within max(0.35 m, 4 %) of the reference
 *   HEIGHT    the top above the terrain within 0.60 m of the published building height (or the ridge within 0.50 m)
 *   ROOF      the main roof's form and ridge direction
 *   GARAGE    a garage door on the reference's side, at least half overlapping its place (or none where there is none)
 *   OPENINGS  openings per storey on the sides that have a published elevation: total difference ≤ max(2, 25 %)
 *   DORMERS   the number of dormers
 * FAITHFUL EXTERIOR: every applicable group passes. IMPROVED: the final model passes more groups than LOCAL's and none
 * of METRIC, HEIGHT, ROOF, GARAGE that LOCAL passed fails (a house LOCAL builds no model for passes no group).
 * CRITICAL REGRESSION: one of those four passed by LOCAL fails in the final model.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'

export const SCORE = { extentM: 0.35, extentShare: 0.04, heightM: 0.6, ridgeM: 0.5, garageOverlap: 0.5, openingsAbs: 2, openingsShare: 0.25, garageDoorMinWidthM: 2.2, entranceMaxWidthM: 1.6, defaultTerrainDepthM: 0.3 } as const
type Side = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'
type Group = 'METRIC' | 'HEIGHT' | 'ROOF' | 'GARAGE' | 'OPENINGS' | 'DORMERS'
export type Verdict = 'PASS' | 'FAIL' | 'NA'
type Reference = {
  house: string
  publisher: string
  overall: { widthM: number | null; depthM: number | null }
  heights: { buildingHeightM: number | null; ridgeAboveGroundFloorM: number | null; terrainBelowGroundFloorM: number | null }
  bodies: Array<{ role: string; roof: string; ridge: string }>
  garageDoor: { side: Side | 'NONE'; alongShare: [number, number] | null }
  sides: Record<Side, { elevationPublished: boolean; openingsGround: number | null; openingsUpper: number | null; dormers: unknown[] }>
}
export type ModelFacts = {
  widthM: number
  depthM: number
  topM: number
  roof: { form: string; ridge: string }
  garageDoors: Array<{ side: Side; share: [number, number] }>
  openings: Record<Side, { ground: number; upper: number }>
  dormers: number
}

export function factsOf(modelPath: string): ModelFacts | undefined {
  if (!existsSync(modelPath)) return undefined
  const text = readFileSync(modelPath, 'utf8')
  const model = parseModel(text)
  const m = measureScene(buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) }))
  if (!m.exteriorWalls) return undefined
  const raw = JSON.parse(text) as {
    walls?: Array<{ id: string; kind: string; levelId: string; start: { x: number; z: number }; end: { x: number; z: number } }>
    openings?: Array<{ id: string; wallId: string; kind: string; offset: number; width: number; sill: number; height: number }>
    doors?: Array<{ openingId: string; usage?: string; materialId?: string; assembly?: { panels: Array<{ kind: string }> } }>
    levels?: Array<{ id: string; elevation: number }>
    roofPlanes?: Array<{ id: string; pitchDeg: number; datum: { y: number }; downslope: { x: number; z: number } }>
    roofs?: Array<{ kind: string; ridgeAxis?: string; eaveOffset?: number }>
    dormers?: unknown[]
  }
  const b = m.exteriorWalls
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const levels = [...(raw.levels ?? [])].sort((p, q) => p.elevation - q.elevation)
  const elevationOf = new Map(levels.map((l) => [l.id, l.elevation]))
  const upperFloor = levels.find((l) => l.elevation > 1.5)?.elevation ?? 2.9
  const walls = new Map((raw.walls ?? []).filter((w) => w.kind === 'EXTERIOR').map((w) => [w.id, w]))
  const doorOf = new Map((raw.doors ?? []).map((d) => [d.openingId, d]))
  const openings: ModelFacts['openings'] = { FRONT: { ground: 0, upper: 0 }, REAR: { ground: 0, upper: 0 }, LEFT: { ground: 0, upper: 0 }, RIGHT: { ground: 0, upper: 0 } }
  const garageDoors: ModelFacts['garageDoors'] = []
  for (const o of raw.openings ?? []) {
    const w = walls.get(o.wallId)
    if (!w || (o.kind !== 'WINDOW' && o.kind !== 'DOOR')) continue
    const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
    if (len < 1e-6) continue
    const u = { x: (w.end.x - w.start.x) / len, z: (w.end.z - w.start.z) / len }
    const at = (t: number): { x: number; z: number } => ({ x: w.start.x + u.x * t, z: w.start.z + u.z * t })
    const mid = at(o.offset + o.width / 2)
    const alongX = Math.abs(u.x) >= Math.abs(u.z)
    const wallMid = at(len / 2)
    const side: Side = alongX ? (wallMid.z < cz ? 'FRONT' : 'REAR') : wallMid.x < cx ? 'LEFT' : 'RIGHT'
    const shareOf = (p: { x: number; z: number }): number => (side === 'FRONT' ? (p.x - b.x0) / b.widthM : side === 'REAR' ? (b.x1 - p.x) / b.widthM : side === 'LEFT' ? (b.z1 - p.z) / b.depthM : (p.z - b.z0) / b.depthM)
    const storey = (elevationOf.get(w.levelId) ?? 0) + o.sill < upperFloor - 0.3 ? 'ground' : 'upper'
    openings[side][storey] += 1
    const door = doorOf.get(o.id)
    const glazed = door?.assembly?.panels.some((p) => p.kind === 'GLAZED') || door?.materialId === 'mat-glass'
    if (o.kind === 'DOOR' && storey === 'ground' && (door?.usage === 'GARAGE' || (o.width >= SCORE.garageDoorMinWidthM && !glazed))) {
      const s = [shareOf(at(o.offset)), shareOf(at(o.offset + o.width))].sort((p, q) => p - q) as [number, number]
      garageDoors.push({ side, share: s })
    }
    void mid
  }
  const pitched = (raw.roofPlanes ?? []).filter((p) => p.pitchDeg > 0.5)
  let roof = { form: 'NONE', ridge: 'NA' }
  if (pitched.length > 0) {
    const top = Math.max(...pitched.map((p) => p.datum.y))
    const main = pitched.filter((p) => p.datum.y >= top - 0.05)
    const dirs = new Set(main.map((p) => (Math.abs(p.downslope.x) > Math.abs(p.downslope.z) ? (p.downslope.x < 0 ? 'L' : 'R') : p.downslope.z < 0 ? 'F' : 'B')))
    const fb = dirs.has('F') || dirs.has('B')
    const lr = dirs.has('L') || dirs.has('R')
    roof = fb && lr ? { form: 'HIP', ridge: 'NA' } : dirs.size === 1 ? { form: 'SHED', ridge: 'NA' } : { form: 'GABLE', ridge: fb ? 'ALONG_FRONT' : 'FRONT_TO_BACK' }
  } else if ((raw.roofPlanes ?? []).length > 0 || (raw.roofs ?? []).some((r) => r.kind === 'FLAT')) roof = { form: 'FLAT', ridge: 'NA' }
  else if ((raw.roofs ?? []).length > 0) {
    const r = (raw.roofs ?? [])[0]
    roof = { form: r.kind, ridge: r.ridgeAxis === 'X' ? 'ALONG_FRONT' : r.ridgeAxis === 'Z' ? 'FRONT_TO_BACK' : 'NA' }
  }
  const dormers = (raw.dormers ?? []).length + (raw.roofPlanes ?? []).filter((p) => /-roof-l$/.test(p.id)).length
  return { widthM: b.widthM, depthM: b.depthM, topM: m.roofTopY ?? m.buildingTopY ?? 0, roof, garageDoors, openings, dormers }
}

export function scoreModel(ref: Reference, facts: ModelFacts | undefined, terrainDepthM?: number): { groups: Record<Group, Verdict>; detail: Record<Group, string>; passed: number; applicable: number } {
  const groups = {} as Record<Group, Verdict>
  const detail = {} as Record<Group, string>
  const set = (g: Group, v: Verdict, d: string): void => {
    groups[g] = v
    detail[g] = d
  }
  if (!facts) {
    for (const g of ['METRIC', 'HEIGHT', 'ROOF', 'GARAGE', 'OPENINGS', 'DORMERS'] as const) set(g, 'FAIL', 'no model')
    return { groups, detail, passed: 0, applicable: 6 }
  }
  const near = (v: number, r: number): boolean => Math.abs(v - r) <= Math.max(SCORE.extentM, SCORE.extentShare * r)
  const dims = [ref.overall.widthM !== null ? { name: 'width', v: facts.widthM, r: ref.overall.widthM } : undefined, ref.overall.depthM !== null ? { name: 'depth', v: facts.depthM, r: ref.overall.depthM } : undefined].filter((x): x is { name: string; v: number; r: number } => x !== undefined)
  set('METRIC', dims.length === 0 ? 'NA' : dims.every((d) => near(d.v, d.r)) ? 'PASS' : 'FAIL', dims.map((d) => `${d.name} ${d.v.toFixed(2)} / ${d.r.toFixed(2)}`).join('; ') || 'no overall dimension in the reference')
  const depth = ref.heights.terrainBelowGroundFloorM ?? terrainDepthM ?? SCORE.defaultTerrainDepthM
  if (ref.heights.buildingHeightM !== null) set('HEIGHT', Math.abs(facts.topM + depth - ref.heights.buildingHeightM) <= SCORE.heightM ? 'PASS' : 'FAIL', `top ${(facts.topM + depth).toFixed(2)} above the terrain / ${ref.heights.buildingHeightM.toFixed(2)}`)
  else if (ref.heights.ridgeAboveGroundFloorM !== null) set('HEIGHT', Math.abs(facts.topM - ref.heights.ridgeAboveGroundFloorM) <= SCORE.ridgeM ? 'PASS' : 'FAIL', `ridge ${facts.topM.toFixed(2)} / ${ref.heights.ridgeAboveGroundFloorM.toFixed(2)}`)
  else set('HEIGHT', 'NA', 'no height in the reference')
  const main = ref.bodies.find((x) => x.role === 'MAIN')
  if (!main || !['GABLE', 'HIP', 'SHED', 'FLAT'].includes(main.roof)) set('ROOF', 'NA', 'no main roof form in the reference')
  else set('ROOF', facts.roof.form === main.roof && (main.roof !== 'GABLE' || main.ridge === 'NA' || facts.roof.ridge === main.ridge) ? 'PASS' : 'FAIL', `${facts.roof.form} ${facts.roof.ridge} / ${main.roof} ${main.ridge}`)
  if (ref.garageDoor.side === 'NONE') set('GARAGE', facts.garageDoors.length === 0 ? 'PASS' : 'FAIL', `${facts.garageDoors.length} garage door(s) / none`)
  else {
    const on = facts.garageDoors.filter((g) => g.side === ref.garageDoor.side)
    const want = ref.garageDoor.alongShare
    const ok = on.some((g) => !want || (Math.min(g.share[1], want[1]) - Math.max(g.share[0], want[0])) / Math.max(1e-6, Math.min(g.share[1] - g.share[0], want[1] - want[0])) >= SCORE.garageOverlap)
    set('GARAGE', ok ? 'PASS' : 'FAIL', `${facts.garageDoors.map((g) => `${g.side} ${g.share.map((s) => s.toFixed(2)).join('–')}`).join(', ') || 'no garage door'} / ${ref.garageDoor.side}${want ? ` ${want.map((s) => s.toFixed(2)).join('–')}` : ''}`)
  }
  let total = 0
  let diff = 0
  const parts: string[] = []
  for (const side of ['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const) {
    const s = ref.sides[side]
    if (!s?.elevationPublished) continue
    for (const [k, r] of [['ground', s.openingsGround], ['upper', s.openingsUpper]] as const) {
      if (r === null || r === undefined) continue
      total += r
      diff += Math.abs(facts.openings[side][k] - r)
      parts.push(`${side[0]}${k[0]} ${facts.openings[side][k]}/${r}`)
    }
  }
  set('OPENINGS', parts.length === 0 ? 'NA' : diff <= Math.max(SCORE.openingsAbs, SCORE.openingsShare * total) ? 'PASS' : 'FAIL', parts.length ? `${parts.join(' ')}: off by ${diff} of ${total}` : 'no published elevation with counts')
  const refDormers = (['FRONT', 'REAR', 'LEFT', 'RIGHT'] as const).reduce((s, side) => s + (ref.sides[side]?.dormers?.length ?? 0), 0)
  set('DORMERS', facts.dormers === refDormers ? 'PASS' : 'FAIL', `${facts.dormers} / ${refDormers}`)
  const all = Object.values(groups)
  return { groups, detail, passed: all.filter((v) => v === 'PASS').length, applicable: all.filter((v) => v !== 'NA').length }
}

const CRITICAL: Group[] = ['METRIC', 'HEIGHT', 'ROOF', 'GARAGE']
export function compare(local: ReturnType<typeof scoreModel>, final: ReturnType<typeof scoreModel>): { improved: boolean; faithful: boolean; criticalRegressions: Group[] } {
  const criticalRegressions = CRITICAL.filter((g) => local.groups[g] === 'PASS' && final.groups[g] === 'FAIL')
  return { improved: final.passed > local.passed && criticalRegressions.length === 0, faithful: final.applicable > 0 && final.passed === final.applicable, criticalRegressions }
}

function main(): void {
  const arg = (n: string): string | undefined => {
    const i = process.argv.indexOf(`--${n}`)
    return i >= 0 ? process.argv[i + 1] : undefined
  }
  const refs = arg('refs') as string
  const hRoot = arg('h') as string
  const localRoot = arg('local') as string
  const rows: unknown[] = []
  for (const line of readFileSync(arg('list') as string, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const house = line.split(/\s+/)[0]
    const refPath = join(refs, `${house}.json`)
    if (!existsSync(refPath)) continue
    const ref = JSON.parse(readFileSync(refPath, 'utf8')) as Reference
    const tracePath = join(hRoot, house, 'trace.json')
    const trace = existsSync(tracePath) ? (JSON.parse(readFileSync(tracePath, 'utf8')) as { arbitration?: { accepted: string; why: string } }) : undefined
    const housePath = join(hRoot, house, 'house.json')
    const terrain = existsSync(housePath) ? ((JSON.parse(readFileSync(housePath, 'utf8')) as { geometry?: { terrainY?: { value: number | null; basis: string } } }).geometry?.terrainY ?? undefined) : undefined
    const hTerrain = terrain && terrain.value !== null && terrain.basis === 'PRINTED' ? -terrain.value : undefined
    const local = scoreModel(ref, factsOf(join(localRoot, house, 'model.json')))
    const described = scoreModel(ref, factsOf(join(hRoot, house, 'model.json')), hTerrain)
    const accepted = trace?.arbitration?.accepted ?? 'NONE'
    const final = accepted === 'DESCRIBED' ? described : local
    rows.push({ house, publisher: ref.publisher, localBuilt: existsSync(join(localRoot, house, 'model.json')), accepted, why: trace?.arbitration?.why ?? 'no run', local, described, final: { passed: final.passed, applicable: final.applicable, groups: final.groups }, ...compare(local, final) })
  }
  writeFileSync(arg('out') as string, `${JSON.stringify({ scorer: 'v3544/score.ts', tolerances: SCORE, rows }, null, 1)}\n`)
  for (const r of rows as Array<{ house: string; publisher: string; accepted: string; local: { passed: number; applicable: number; groups: Record<string, string> }; described: { passed: number; applicable: number; groups: Record<string, string>; detail: Record<string, string> }; improved: boolean; faithful: boolean; criticalRegressions: string[] }>) {
    const g = (x: Record<string, string>): string => (['METRIC', 'HEIGHT', 'ROOF', 'GARAGE', 'OPENINGS', 'DORMERS'] as const).map((k) => `${k[0]}${k[1]}:${x[k] === 'PASS' ? '+' : x[k] === 'FAIL' ? '-' : '.'}`).join(' ')
    process.stdout.write(`${r.house.slice(-34).padEnd(34)} ${r.publisher.slice(0, 18).padEnd(18)} LOCAL ${r.local.passed}/${r.local.applicable} [${g(r.local.groups)}]  H ${r.described.passed}/${r.described.applicable} [${g(r.described.groups)}]  -> ${r.accepted.padEnd(9)} improved=${r.improved} faithful=${r.faithful} regress=${r.criticalRegressions.join(',') || '-'}\n`)
  }
}
if (process.argv.includes('--refs')) main()
