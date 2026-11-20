/**
 * v3.54.17 R3 (OWNER 2026-11-20: overhang, chimneys, heights behind pots) — diagnosis at 0 USD: replays a host job's
 * accepted answers and dumps, per elevation, the analyzer's registration (heights or why not), the provider's sketch
 * (ground row, walls, roofs, chimneys in source pixels) and the model's side extents and heights.
 *   npx vite-node research/source-to-model/v35417/r3/diag-heights.ts -- --url <page> --cache <dir> --accepted <json> --out <file>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { consultAnalysis } from '../../../../packages/analysis-service/src/consult/consult-analysis.js'
import { CONSULT_PRICES } from '../../../../packages/analysis-service/src/consult/cost.js'
import { replayModel } from '../../../../packages/analysis-service/src/consult/accepted-consult.js'
import type { AcceptedConsultRevision } from '../../../../packages/analysis-service/src/consult/accepted-consult.js'
import { ConsultantUnavailable } from '../../../../packages/analysis-service/src/consult/loop.js'
import type { ConsultantModel } from '../../../../packages/analysis-service/src/consult/loop.js'
import { sideOfWall } from '../../../../packages/analysis-service/src/consult/correct/execute.js'
import { renderModelViews } from '../../../../packages/analysis-service/src/consult/model-views.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string => argv[argv.indexOf(`--${n}`) + 1] as string
const accepted = JSON.parse(readFileSync(opt('accepted'), 'utf8')) as AcceptedConsultRevision
const counter = { replayed: 0, missing: 0 }
const base = { id: 'anthropic-messages', maxOutputTokens: 8000 }
const metric = replayModel({ ...base, model: 'claude-opus-5-5', maxOutputTokens: 16000 }, 'METRIC', accepted.answers, counter)
const sketch = replayModel({ ...base, model: 'claude-sonnet-5-5', maxOutputTokens: 6000 }, 'SKETCH', accepted.answers, counter)
const reviewer: ConsultantModel = { ...base, model: 'claude-sonnet-5-5', strict: true, send: async () => { throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (diagnosis)') } }
const events: Array<Record<string, unknown>> = []
const price = CONSULT_PRICES['claude-sonnet-5-5']
const r = await consultAnalysis({ kind: 'URL', url: opt('url') }, { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(opt('cache')), offline: true },
  { model: reviewer, price, metricRead: 'ON', metricModel: metric, metricPrice: CONSULT_PRICES['claude-opus-5-5'], sketches: 'ON', sketchModel: sketch, sketchPrice: price, variant: 'C', maxGeometryRounds: 0, record: (e) => events.push(e as unknown as Record<string, unknown>) })
const run = r.run
const m = run?.reconstruction.model
const px = (polys: Array<Array<[number, number]>>) => { const p = polys.flat(); return p.length ? { x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), y1: Math.max(...p.map((q) => q[1])) } : null }
const sides: Record<string, unknown> = {}
if (m) for (const s of ['FRONT', 'RIGHT', 'REAR', 'LEFT'] as const) {
  const ws = m.walls.filter((w) => w.kind === 'EXTERIOR' && sideOfWall(m, w) === s)
  const ax = s === 'FRONT' || s === 'REAR' ? 'x' : 'z'
  const vs = ws.flatMap((w) => [w.start[ax], w.end[ax]])
  sides[s] = { walls: ws.length, lo: Math.min(...vs), hi: Math.max(...vs), heights: [...new Set(ws.map((w) => w.height))] }
}
const out = {
  replay: counter,
  model: m ? { levels: m.levels.map((l) => [l.id, l.elevation, l.height]), roofs: m.roofs.map((x) => ({ id: x.id, kind: x.kind, eaveOffset: (x as unknown as { eaveOffset?: number }).eaveOffset, pitch: x.pitchDeg, axis: x.ridgeAxis, overhang: (x as unknown as { overhang?: number }).overhang, footprint: (x as unknown as { footprint?: unknown }).footprint })), chimneys: m.chimneys.length, sides } : null,
  views: (run?.reconstruction.facadeAlignment.views ?? []).map((v) => ({ ...(v as unknown as Record<string, unknown>), raster: undefined })),
  sketches: (r.sketches?.reading.sketches ?? []).map((x) => ({ facade: x.facade, frameId: x.frameId, status: (x as unknown as { status?: string }).status, groundRow: x.sketch?.groundRow ?? null, walls: px((x.sketch?.walls ?? []).map((w) => w.polygon as Array<[number, number]>)), roofs: (x.sketch?.roofs ?? []).map((w) => px([w.polygon as Array<[number, number]>])), silhouette: x.sketch?.silhouette ? px([x.sketch.silhouette as Array<[number, number]>]) : null, chimneys: (x.sketch?.elements ?? []).filter((e) => e.kind === 'CHIMNEY').map((e) => px([e.polygon as Array<[number, number]>])), elements: (x.sketch?.elements ?? []).map((e) => e.kind) })),
  registrations: events.filter((e) => e.kind === "SKETCH_REGISTRATION").map((e) => ({ ...e, at: undefined })),
  rebuild: events.filter((e) => e.kind === "ORIENTATION_REBUILD"),
  modelSha256: run?.result.modelSha256 ?? null,
  txs: (r.sketches?.semantic?.transactions ?? []).filter((t) => t.decision !== "COMMITTED").map((t) => ({ patches: t.patches, why: t.why })),
  finalChimneys: run?.reconstruction.model.chimneys.map((c) => ({ id: c.id, height: c.height, footprint: c.footprint })) ?? [],
  sketchDecision: { decision: r.sketches?.semantic?.decision, why: r.sketches?.semantic?.why, fusion: r.sketches?.semantic?.chimneyFusion },
  delivered: events.filter((e) => e.kind === "CORRECTIONS_DELIVERED"),
  orientation: r.sketches?.semantic?.orientation ?? null,
  records: (r.sketches?.semantic?.records ?? []).map((x) => ({ op: x.operation, target: x.targetId, status: x.status, code: x.code, why: (x.why ?? '').slice(0, 200) })),
}
writeFileSync(opt("out"), `${JSON.stringify(out, null, 1)}\n`)
if (m) writeFileSync(`${opt("out")}.model.json`, JSON.stringify(m))
if (run) for (const v of renderModelViews(run.result.scene)) writeFileSync(`${opt("out")}.${v.name}.png`, v.png)
process.stdout.write(`replay ${JSON.stringify(counter)} views ${out.views.length} sketches ${out.sketches.length}\n`)
