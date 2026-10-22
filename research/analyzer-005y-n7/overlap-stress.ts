/**
 * 005Y-N7 (A): corpus-derived WALLS_OVERLAP stress cases.
 *
 * None of the eight development houses overlaps today, so the cases are made from their real emitted programs by
 * perturbing one wall the way a reading goes wrong: an attached body measured a few pixels into the main body (or onto
 * its very band), a partition drawn into or through the wall it stops against, a wall read twice 1 cm apart — and two
 * negatives that must stay errors: a body a metre into the main body, an exterior wall across the envelope.
 *
 * Each case runs the production path (`reconcileWallOverlaps` → `fitOpeningsToHosts`), builds the model, compiles it,
 * and records what was done. Usage:
 *   npx vite-node research/analyzer-005y-n7/overlap-stress.ts -- <replay-root with <house>/program.json> <out.json>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BuildingCommand } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { buildCandidateModel, fitOpeningsToHosts, programApplies, reconcileWallOverlaps } from '../../packages/reconstruction/src/candidate.js'
import { frameOf, reconcileToleranceM, ringWallLines } from '../../packages/reconstruction/src/v2/wall-reconciliation.js'
import { modeOf } from '../../packages/reconstruction/src/v2/wall-reconciliation-report.js'
import type { WallLine } from '../../packages/reconstruction/src/v2/wall-reconciliation.js'

const HOUSES = ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3']
const [root, outPath] = process.argv.slice(-2)

type Ring = Extract<BuildingCommand, { type: 'createWallRing' }>
type Wall = Extract<BuildingCommand, { type: 'createWall' }>
type Expect = 'UNCHANGED' | 'REPAIRED' | 'PARTIAL' | 'REFUSED'
type Case = { name: string; expect: Expect; program: BuildingCommand[] }

const close = (a: number, b: number, eps = 1e-4): boolean => Math.abs(a - b) <= eps
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

/** The base plan's scale from the replay's registration steps (the coarsest storey). */
function planMpp(dir: string): number {
  const regs = JSON.parse(readFileSync(join(dir, 'registrations.json'), 'utf8')) as { steps: string[] }
  const mpp = regs.steps.map((s) => /plan registered: ([0-9.]+) m\/px/.exec(s)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]))
  return Math.max(...mpp)
}

/** An attached ring's edge that lies on a main ring wall's outer line: the face the two bodies share. */
function sharedEdge(program: BuildingCommand[]): { ring: Ring; edge: number; line: WallLine } | undefined {
  const rings = program.filter((c): c is Ring => c.type === 'createWallRing')
  for (const att of rings.filter((r) => /attached/.test(r.id ?? ''))) {
    const storey = (att.id ?? '').split('-').pop()
    const main = rings.find((r) => /main/.test(r.id ?? '') && r.levelId === att.levelId) ?? rings.find((r) => /main/.test(r.id ?? '') && (r.id ?? '').endsWith(`-${storey}`))
    if (!main) continue
    const mainLines = ringWallLines(main, main.id ?? '').lines
    const { lines } = ringWallLines(att, att.id ?? '')
    for (let k = 0; k < lines.length; k += 1) {
      const f = frameOf(lines[k])
      const onFace = mainLines.some((m) => {
        const g = frameOf(m)
        const parallel = Math.abs(f.u.x * g.u.z - f.u.z * g.u.x) < 1e-6
        const d = (lines[k].start.x - m.start.x) * g.inward.x + (lines[k].start.z - m.start.z) * g.inward.z
        // the face two bodies share: on the main wall's outer line, material on the other side, side by side along it
        const opposite = f.inward.x * g.inward.x + f.inward.z * g.inward.z < 0
        const a0 = (lines[k].start.x - m.start.x) * g.u.x + (lines[k].start.z - m.start.z) * g.u.z
        const a1 = (lines[k].end.x - m.start.x) * g.u.x + (lines[k].end.z - m.start.z) * g.u.z
        const along = Math.min(Math.max(a0, a1), g.L) - Math.max(Math.min(a0, a1), 0)
        return parallel && opposite && along > 0.5 && close(d, 0, 0.005)
      })
      if (onFace) return { ring: att, edge: k, line: lines[k] }
    }
  }
  return undefined
}

/** The program with the shared edge moved `byM` into the main body. */
function shiftShared(program: BuildingCommand[], s: { ring: Ring; edge: number; line: WallLine }, byM: number): BuildingCommand[] {
  const f = frameOf(s.line)
  const { reversed } = ringWallLines(s.ring, s.ring.id ?? '')
  const n = s.ring.polygon.length
  const stated = (k: number): number => (reversed ? (n - (k % n)) % n : k % n)
  const moved = new Set([stated(s.edge), stated(s.edge + 1)])
  const polygon = s.ring.polygon.map((p, i) => (moved.has(i) ? { x: r6(p.x - f.inward.x * byM), z: r6(p.z - f.inward.z * byM) } : p))
  return program.map((c) => (c === s.ring ? { ...s.ring, polygon } : c))
}

/** Partitions with an end on the inner face of a ring wall of their storey: which end, and the wall. */
function partitionsOnRings(program: BuildingCommand[]): Array<{ wall: Wall; end: 'start' | 'end'; ringT: number; gap: number }> {
  const rings = program.filter((c): c is Ring => c.type === 'createWallRing')
  const out: Array<{ wall: Wall; end: 'start' | 'end'; ringT: number; gap: number }> = []
  for (const w of program.filter((c): c is Wall => c.type === 'createWall' && c.kind === 'INTERIOR')) {
    const lines = rings.filter((r) => r.levelId === w.levelId).flatMap((r) => ringWallLines(r, r.id ?? '').lines)
    for (const end of ['start', 'end'] as const) {
      const p = w[end]
      // the partition planner stops a partition a small gap short of the face it meets
      const depthOf = (l: WallLine): number => (p.x - l.start.x) * frameOf(l).inward.x + (p.z - l.start.z) * frameOf(l).inward.z
      const hit = lines.find((l) => {
        const f = frameOf(l)
        const depth = depthOf(l)
        const along = (p.x - l.start.x) * f.u.x + (p.z - l.start.z) * f.u.z
        // the partition meets the ring wall end-on: it runs across it, not along it
        const across = Math.abs((w.end.x - w.start.x) * f.u.z - (w.end.z - w.start.z) * f.u.x) / Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) > 0.9
        return across && depth >= f.T - 0.005 && depth <= f.T + 0.03 && along > 0.5 && along < f.L - 0.5
      })
      if (hit) {
        out.push({ wall: w, end, ringT: hit.thickness, gap: r6(depthOf(hit) - hit.thickness) })
        break
      }
    }
  }
  return out
}

/** The partition with one end pushed `byM` further along its own direction (into the ring wall it stops at). */
function overrun(program: BuildingCommand[], w: Wall, end: 'start' | 'end', byM: number): BuildingCommand[] {
  const L = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)
  const u = { x: (w.end.x - w.start.x) / L, z: (w.end.z - w.start.z) / L }
  const s = end === 'start' ? -1 : 1
  const p = w[end]
  const moved = { ...w, [end]: { x: r6(p.x + s * u.x * byM), z: r6(p.z + s * u.z * byM) } }
  return program.map((c) => (c === w ? moved : c))
}

function casesOf(program: BuildingCommand[], mpp: number): Case[] {
  const px = mpp
  const cases: Case[] = [{ name: 'as emitted', expect: 'UNCHANGED', program }]
  const shared = sharedEdge(program)
  if (shared) {
    for (const k of [1, 2, 3]) cases.push({ name: `attached body ${k} px into the main body`, expect: 'REPAIRED', program: shiftShared(program, shared, r6(k * px)) })
    cases.push({ name: 'attached body on the main wall’s band (shared wall read by both bodies)', expect: 'REPAIRED', program: shiftShared(program, shared, shared.line.thickness) })
    cases.push({ name: 'NEGATIVE: attached body 1 m into the main body', expect: 'REFUSED', program: shiftShared(program, shared, 1) })
  }
  for (const { wall, end, ringT, gap } of partitionsOnRings(program).slice(0, 3)) {
    cases.push({ name: `partition ${wall.id} ${end} drawn into the ring band (half its depth)`, expect: 'REPAIRED', program: overrun(program, wall, end, r6(gap + ringT / 2)) })
    cases.push({ name: `partition ${wall.id} ${end} drawn 1 px through the outer face`, expect: 'REPAIRED', program: overrun(program, wall, end, r6(gap + ringT + px)) })
    cases.push({ name: `NEGATIVE: partition ${wall.id} ${end} running 0.5 m out through the envelope`, expect: 'PARTIAL', program: overrun(program, wall, end, r6(gap + ringT + 0.5)) })
  }
  const first = program.find((c): c is Wall => c.type === 'createWall' && c.kind === 'INTERIOR')
  if (first) {
    const L = Math.hypot(first.end.x - first.start.x, first.end.z - first.start.z)
    const n = { x: -(first.end.z - first.start.z) / L, z: (first.end.x - first.start.x) / L }
    const dup: Wall = { ...first, id: `${first.id}-again`, start: { x: r6(first.start.x + n.x * 0.01), z: r6(first.start.z + n.z * 0.01) }, end: { x: r6(first.end.x + n.x * 0.01), z: r6(first.end.z + n.z * 0.01) } }
    const at = program.indexOf(first)
    cases.push({ name: `${first.id} read twice, 1 cm apart`, expect: 'REPAIRED', program: [...program.slice(0, at + 1), dup, ...program.slice(at + 1)] })
  }
  const main = program.find((c): c is Ring => c.type === 'createWallRing' && /main-0$/.test(c.id ?? ''))
  if (main) {
    const xs = main.polygon.map((p) => p.x)
    const zs = main.polygon.map((p) => p.z)
    const mid = r6((Math.min(...xs) + Math.max(...xs)) / 2)
    const across: Wall = { type: 'createWall', id: 'stress-across', levelId: main.levelId, start: { x: mid, z: r6(Math.min(...zs) - 1) }, end: { x: mid, z: r6((Math.min(...zs) + Math.max(...zs)) / 2) }, thickness: 0.3, height: 2.5, baseOffset: 0, kind: 'EXTERIOR' } as Wall
    const at = program.indexOf(main)
    cases.push({ name: 'NEGATIVE: exterior wall across the envelope', expect: 'REFUSED', program: [...program.slice(0, at + 1), across, ...program.slice(at + 1)] })
  }
  return cases
}

type Row = { house: string; case: string; expect: Expect; outcome: Expect | 'FAILED'; pass: boolean; actions: string[]; records: unknown[]; dependents: number; compileErrors?: number; meshes?: number; refusal?: unknown }

function runCase(house: string, c: Case, toleranceM: number, baselineErrors: number): Row {
  const label = house
  const modelId = `m-stress-${house}`
  const base = { house, case: c.name, expect: c.expect }
  if (c.expect === 'UNCHANGED' && !programApplies(c.program, label, modelId)) return { ...base, outcome: 'FAILED', pass: false, actions: [], records: [], dependents: 0 }
  const r = reconcileWallOverlaps(c.program, label, modelId, { toleranceM })
  if (!r.ok) {
    const outcome: Expect | 'FAILED' = r.refusal ? 'REFUSED' : 'FAILED'
    return { ...base, outcome, pass: outcome === c.expect, actions: r.records.map((x) => x.action), records: r.records, dependents: r.dependents.length, refusal: r.refusal ?? { failedAt: r.failedAt, command: r.command, errors: r.errors } }
  }
  const fit = fitOpeningsToHosts(r.program, label, modelId)
  if (!fit.ok) return { ...base, outcome: 'FAILED', pass: false, actions: r.records.map((x) => x.action), records: r.records, dependents: r.dependents.length, refusal: { failedAt: fit.failedAt, command: fit.command, errors: fit.errors } }
  const model = buildCandidateModel(fit.program, label, modelId)
  const compiled = compileBuilding(model)
  const compileErrors = compiled.diagnostics.filter((d) => d.severity === 'ERROR').length
  const outcome: Expect = r.records.length === 0 ? 'UNCHANGED' : modeOf(r) === 'PARTIAL_SOURCE_GROUNDED' ? 'PARTIAL' : 'REPAIRED'
  const unchangedOk = c.expect !== 'UNCHANGED' || JSON.stringify(r.program) === JSON.stringify(c.program)
  return { ...base, outcome, pass: outcome === c.expect && compileErrors <= baselineErrors && compiled.meshes.length > 0 && unchangedOk, actions: r.records.map((x) => x.action), records: r.records, dependents: r.dependents.length, compileErrors, meshes: compiled.meshes.length }
}

const rows: Row[] = []
for (const house of HOUSES) {
  const dir = join(root, house)
  if (!existsSync(join(dir, 'program.json'))) continue
  const program = JSON.parse(readFileSync(join(dir, 'program.json'), 'utf8')) as BuildingCommand[]
  const toleranceM = reconcileToleranceM(planMpp(dir))
  // the emitted model's own compile findings are the bar: a repaired model may not add any
  const baselineErrors = compileBuilding(buildCandidateModel(program, house, `m-stress-${house}`)).diagnostics.filter((d) => d.severity === 'ERROR').length
  for (const c of casesOf(program, toleranceM / 3)) {
    const row = runCase(house, c, toleranceM, baselineErrors)
    rows.push(row)
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${house.padEnd(10)} ${c.expect.padEnd(9)} → ${row.outcome.padEnd(9)} ${c.name}  [${row.actions.join(', ')}]${row.compileErrors ? ` compileErrors ${row.compileErrors}` : ''}`)
  }
}
writeFileSync(outPath, JSON.stringify({ schema: 'buildapp.research.005y-n7.overlap-stress', rows }, null, 1) + '\n')
console.log(`${rows.filter((r) => r.pass).length}/${rows.length} cases as expected`)
