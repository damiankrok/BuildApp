/**
 * BUILDPLAN-ANALYZER-005I §13, §43: the dimension topology replayed on sealed metric evidence.
 *
 *   npx vite-node packages/source-metrics/scripts/topology-probe.ts -- --runs <dir> [--rows a,b,…] [--permutations 24] --out <file>
 *
 * For every plan frame of every run (`<dir>/<row>/metric-evidence.json`) it rebuilds what the assignment was given —
 * the measurement chains (every mark but label ink) and the page vote's tokens — from the sealed record alone, and:
 *   - ORDER: assigns them in the canonical order and in `--permutations` shuffles of tokens and chains (seeded), and
 *     reports any decision that moved (it must be none);
 *   - TIME: times axis grouping, candidate generation and the global assignment, and the largest neighbourhood.
 * It reads only what the run sealed; it decides nothing and writes one JSON file.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assignLabels, dimensionAxisGroups, labelCandidates, labelHeightOf, measurementChain } from '../src/index.js'
import type { MetricEvidenceSet, RawChain, TextToken } from '../src/index.js'

const argv = process.argv.slice(2)
const value = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const runs = value('runs')
const out = value('out')
if (!runs || !out) throw new Error('--runs <dir> --out <file>')
const rowsWanted = value('rows')?.split(',')
const permutations = Number(value('permutations') ?? '24')

const rows = readdirSync(runs).filter((r) => existsSync(join(runs, r, 'metric-evidence.json')) && (!rowsWanted || rowsWanted.includes(r))).sort()
let seed = 20261006
const rand = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const shuffle = <T>(xs: readonly T[]): T[] => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const ms = (t0: number): number => Math.round((performance.now() - t0) * 1000) / 1000

const report: Array<Record<string, unknown>> = []
for (const row of rows) {
  const metrics = JSON.parse(readFileSync(join(runs, row, 'metric-evidence.json'), 'utf8')) as MetricEvidenceSet
  const frames = [...new Set((metrics.dimensionTopology ?? []).map((t) => t.frameId))].sort()
  for (const frameId of frames) {
    const sealed = metrics.chains.filter((c) => c.frameId === frameId)
    const chains: RawChain[] = sealed.map((c) => measurementChain({ axis: c.axis, baselinePx: c.baselinePx, observationIds: [], ticks: c.ticksPx.map((atPx, i) => ({ atPx, baselinePx: c.baselinePx, observationId: '', ...(c.marks ? { class: c.marks[i].class, reasons: [...c.marks[i].reasons] } : {}) })) }))
    const tokens: TextToken[] = metrics.ocrTokens
      .filter((t) => t.frameId === frameId && t.pageVote !== 'DISCARDED')
      .map((t) => ({ text: t.text, score: t.score, confidence: t.confidence, box: t.box, shearDeg: t.shearDeg, height: t.heightPx, orientation: t.orientation ?? 'HORIZONTAL', glyphs: t.glyphs.map((g) => ({ char: g.char, score: g.score, confidence: g.confidence, box: g.box, alternatives: g.alternatives, holes: { count: 0, cy: 0.5, areaFrac: 0 } })) }))
    const ids = sealed.map((c) => c.id)
    let t0 = performance.now()
    const height = labelHeightOf(chains, tokens)
    const groups = dimensionAxisGroups(frameId, chains, ids, height)
    const groupsMs = ms(t0)
    t0 = performance.now()
    let candidates = 0
    for (const t of tokens) candidates += labelCandidates(chains, t).length
    const candidatesMs = ms(t0)
    t0 = performance.now()
    const reference = assignLabels(chains, tokens)
    const assignMs = ms(t0)
    const key = (a: ReturnType<typeof assignLabels>, order: number[]): string[] =>
      a.decisions.map((d) => `${d.orientation}|${d.text}|${d.box.x0},${d.box.y0}|${d.status}|${d.chosen ? `${ids[order[d.chosen.chain]]}#${d.chosen.interval}` : '-'}|${d.margin ?? ''}`).sort()
    const identity = chains.map((_, i) => i)
    const ref = key(reference, identity)
    let moved = 0
    const examples: string[] = []
    for (let p = 0; p < permutations; p += 1) {
      const order = shuffle(identity)
      const result = key(assignLabels(order.map((i) => chains[i]), shuffle(tokens)), order)
      const diff = result.filter((x, i) => x !== ref[i])
      if (diff.length > 0) {
        moved += 1
        if (examples.length < 3) examples.push(diff[0])
      }
    }
    report.push({
      row,
      frameId,
      chains: chains.length,
      labels: reference.decisions.length,
      candidates,
      groups: groups.groups.filter((g) => g.members.length > 1).length,
      largestGroup: Math.max(0, ...groups.groups.map((g) => g.members.length)),
      statuses: Object.fromEntries(['BOUND', 'AMBIGUOUS', 'UNASSIGNED'].map((s) => [s, reference.decisions.filter((d) => d.status === s).length])),
      bounded: reference.decisions.filter((d) => d.bounded).length,
      permutations,
      permutationsThatMovedADecision: moved,
      ...(examples.length > 0 ? { examples } : {}),
      ms: { axisGroups: groupsMs, candidates: candidatesMs, assignment: assignMs },
    })
    process.stdout.write(`${row} ${frameId.slice(-24)} chains ${chains.length} labels ${reference.decisions.length} moved ${moved}/${permutations} assign ${assignMs} ms\n`)
  }
}
const total = (k: 'axisGroups' | 'candidates' | 'assignment'): number => Math.round(report.reduce((a, r) => a + (r.ms as Record<string, number>)[k], 0) * 1000) / 1000
writeFileSync(
  out,
  `${JSON.stringify(
    {
      schema: 'buildapp.005i.topology-probe',
      runs: rows.length,
      frames: report.length,
      permutations,
      framesWithAMovedDecision: report.filter((r) => (r.permutationsThatMovedADecision as number) > 0).length,
      totals: { axisGroupsMs: total('axisGroups'), candidatesMs: total('candidates'), assignmentMs: total('assignment') },
      maxAssignmentMs: Math.max(0, ...report.map((r) => (r.ms as Record<string, number>).assignment)),
      frames_: report,
    },
    null,
    2,
  )}\n`,
)
