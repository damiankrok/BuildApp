/**
 * v3.54.21 — offline, 0 USD: the bodies a recorded run solved (its BUILD_MASSING record's hypothesis), built again by
 * the working tree's commands — so a change of the ROOF SYSTEM is seen on every recorded house in seconds, before any
 * full replay. It is a view of the body builder's last step only (no interior, no openings): the full pipeline is
 * replayed by `v35419/replay.sh`.
 *   npx vite-node research/source-to-model/v35421/roof-replay.ts -- --out <dir> [--tile 700] <name>=<run dir>...
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyCommands } from '@buildapp/commands'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { createEmptyModel, validateModel } from '@buildapp/model'
import { massingCommands, roofSystemOf } from '../../../packages/analysis-service/src/consult/massing/massing.js'
import type { MassingHypothesis } from '../../../packages/analysis-service/src/consult/massing/massing.js'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const out = opt('out') as string
const tile = Number(opt('tile') ?? 700)
mkdirSync(out, { recursive: true })
const summary: Record<string, unknown> = {}
for (const arg of argv.filter((a) => a.includes('='))) {
  const [name, dir] = arg.split('=')
  const file = join(dir, 'massing.json')
  if (!existsSync(file)) { summary[name] = { why: 'no massing.json: the run built no body from the sources' }; continue }
  const ms = JSON.parse(readFileSync(file, 'utf8')) as { records?: Array<{ status?: string; massing?: { hypothesis?: MassingHypothesis } }> }
  const h = [...(ms.records ?? [])].reverse().find((r) => r.massing?.hypothesis?.status === 'BUILDABLE')?.massing?.hypothesis
  if (!h) { summary[name] = { why: 'no BUILDABLE hypothesis recorded' }; continue }
  const sol = roofSystemOf(h)
  const cmds = massingCommands(h, createEmptyModel(`m-${name}`, name))
  const r = applyCommands(createEmptyModel(`m-${name}`, name), cmds)
  const failed = r.failedAt !== undefined ? { at: r.failedAt, command: cmds[r.failedAt], result: r.results[r.failedAt] } : undefined
  const v0 = validateModel(r.model) as unknown
  const issues: unknown[] = Array.isArray(v0) ? v0 : ((v0 as { issues?: unknown[]; errors?: unknown[] }).issues ?? (v0 as { errors?: unknown[] }).errors ?? [])
  let compiled: unknown
  try { const c = compileBuilding(r.model); compiled = { diagnostics: (c as { diagnostics?: unknown[] }).diagnostics?.length ?? 0, sample: ((c as { diagnostics?: unknown[] }).diagnostics ?? []).slice(0, 6) } } catch (e) { compiled = { threw: (e as Error).message.slice(0, 300) } }
  writeFileSync(join(out, `${name}-model.json`), `${JSON.stringify(r.model, null, 1)}\n`)
  try {
    const views = renderModelViews(buildMobileSceneBundle(r.model), tile)
    for (const v of views) writeFileSync(join(out, `${name}-${v.name}.png`), v.png)
  } catch (e) { compiled = { ...(compiled as object), renderThrew: (e as Error).message.slice(0, 300) } }
  summary[name] = { bodies: h.bodies.map((b) => ({ id: b.id, rect: b.rect, roof: b.roof })), regions: sol.regions.map((q) => ({ id: q.id, kind: q.kind, axis: q.ridgeAxis, pitchDeg: q.pitchDeg, eaveY: q.eaveY, ridgeY: q.ridgeY, joined: q.joined, planes: q.planeIds.length })), relations: sol.relations, adjustments: sol.adjustments, violations: sol.violations, creases: sol.creases.map((c) => `${c.kind} ${c.planeIds.join(' | ')} (${c.start.x},${c.start.z})@${c.startY} → (${c.end.x},${c.end.z})@${c.endY}`), commands: cmds.length, ...(failed ? { failed } : {}), validation: issues.filter((i) => (i as { severity?: string }).severity !== 'INFO').slice(0, 12), compiled }
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`)
process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`)
