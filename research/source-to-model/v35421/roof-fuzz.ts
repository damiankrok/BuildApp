/**
 * v3.54.21 — a stress run of the roof system (0 USD, no source): random rectangular bodies with one or two wings on random
 * sides, gable and hip, eaves and pitches in the range houses have; each is solved, stated through the kernel, validated
 * and compiled. Counts what throws, what the kernel refuses and what compiles with errors — the rate at which the body
 * builder's named fallback (roofs built apart, `roofBuildError`) would be taken. Deterministic (seeded).
 *   npx vite-node research/source-to-model/v35421/roof-fuzz.ts -- [n=300] [seed=1]
 */
import { applyCommands } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { joinedBodiesOf, massingCommands, roofRegionsOfModel, roofSystemOf } from '../../../packages/analysis-service/src/consult/massing/massing.js'
import type { MassingHypothesis, RoofSpec } from '../../../packages/analysis-service/src/consult/massing/massing.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const N = Number(argv[0] ?? 300)
let seed = Number(argv[1] ?? 1)
const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
const r2 = (v: number): number => Math.round(v * 100) / 100
const roofOf = (w: number, d: number, axis: 'X' | 'Z', kind: 'GABLE' | 'HIP', eaves: number, pitch: number): RoofSpec => {
  const half = (axis === 'X' ? d : w) / 2
  const ridge = r2(eaves + half * Math.tan((pitch * Math.PI) / 180))
  return { kind, ridgeAxis: axis, pitchDeg: pitch, eavesM: eaves, ridgeM: ridge, ...(kind === 'HIP' ? { hipRunM: r2(Math.min(half, (axis === 'X' ? w : d) / 2 - 0.2)) } : {}) }
}
const tally: Record<string, number> = {}
const bump = (k: string): void => { tally[k] = (tally[k] ?? 0) + 1 }
const samples: Record<string, unknown[]> = {}
for (let i = 0; i < N; i += 1) {
  const W = r2(8 + rnd() * 10)
  const D = r2(6 + rnd() * 5)
  const mainAxis: 'X' | 'Z' = rnd() < 0.8 ? 'X' : 'Z'
  const bodies: MassingHypothesis['bodies'] = [{ id: 'mass-main', rect: { minX: 0, maxX: W, minZ: 0, maxZ: D }, roof: roofOf(W, D, mainAxis, rnd() < 0.3 ? 'HIP' : 'GABLE', r2(2.6 + rnd() * 1.6), Math.round(22 + rnd() * 23)), provenance: {} }]
  const wings = rnd() < 0.35 ? 2 : 1
  const used = new Set<string>()
  for (let k = 1; k <= wings; k += 1) {
    const side = pick(['FRONT', 'REAR', 'LEFT', 'RIGHT'].filter((s) => !used.has(s)))
    used.add(side)
    const along = side === 'FRONT' || side === 'REAR' ? W : D
    const w = r2(3 + rnd() * Math.max(0.5, Math.min(along - 3.5, 5)))
    const a0 = r2(rnd() * (along - w))
    const out = r2(2.5 + rnd() * 4)
    const rect = side === 'FRONT' ? { minX: a0, maxX: r2(a0 + w), minZ: -out, maxZ: 0 } : side === 'REAR' ? { minX: a0, maxX: r2(a0 + w), minZ: D, maxZ: r2(D + out) } : side === 'LEFT' ? { minX: -out, maxX: 0, minZ: a0, maxZ: r2(a0 + w) } : { minX: W, maxX: r2(W + out), minZ: a0, maxZ: r2(a0 + w) }
    const cross = rnd() < 0.75
    const axis: 'X' | 'Z' = (side === 'FRONT' || side === 'REAR') === cross ? 'Z' : 'X'
    bodies.push({ id: `mass-wing-${k}`, rect, roof: roofOf(rect.maxX - rect.minX, rect.maxZ - rect.minZ, axis, rnd() < 0.2 ? 'HIP' : 'GABLE', r2(2.3 + rnd() * 1.8), Math.round(20 + rnd() * 25)), provenance: {} })
  }
  const h = { version: 'fuzz', status: 'BUILDABLE', bodies, views: [], alternatives: [], missing: [], views_used: [], wallThicknessM: 0.3, why: 'fuzz' } as unknown as MassingHypothesis
  const note = (k: string, extra: unknown): void => { bump(k); (samples[k] ??= []).length < 3 && samples[k].push({ i, bodies: bodies.map((b) => ({ id: b.id, rect: b.rect, roof: b.roof })), extra }) }
  let sol
  try { sol = roofSystemOf(h) } catch (e) { note('SOLVER_THREW', (e as Error).message.slice(0, 200)); continue }
  const joined = joinedBodiesOf(sol)
  bump(joined.size > 0 ? 'joined' : 'not-joined')
  for (const q of sol.relations) bump(`relation:${q.kind}`)
  if (sol.violations.length > 0) bump('with-violation')
  if (joined.size === 0) continue
  // the planes of the joined part do not overlap and cover what the regions cover (area against a sample count)
  const empty = createEmptyModel('m', 'fuzz')
  const cmds = massingCommands(h, empty)
  const r = applyCommands(empty, cmds)
  if (r.failedAt !== undefined) { note('KERNEL_REFUSED', { command: (cmds[r.failedAt] as { type?: string; id?: string }).type, id: (cmds[r.failedAt] as { id?: string }).id, result: JSON.stringify(r.results[r.failedAt]).slice(0, 300) }); continue }
  if (!validateModel(r.model).ok) { note('INVALID_MODEL', JSON.stringify(validateModel(r.model)).slice(0, 300)); continue }
  try {
    const c = compileBuilding(r.model) as { diagnostics?: Array<{ severity?: string; code?: string }> }
    const errs = (c.diagnostics ?? []).filter((d) => d.severity === 'ERROR')
    if (errs.length > 0) { note('COMPILE_ERRORS', errs.slice(0, 3)); continue }
  } catch (e) { note('COMPILE_THREW', (e as Error).message.slice(0, 200)); continue }
  const back = roofRegionsOfModel(r.model)
  if ('why' in back) { note('NOT_RECOVERED', back.why.slice(0, 240)); continue }
  bump('ok')
}
process.stdout.write(`${JSON.stringify({ n: N, tally, samples }, null, 1)}\n`)
