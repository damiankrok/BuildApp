/**
 * v3.54.17 R2 §3 — the element index on a REAL revision, offline, at 0 USD. No request leaves the process.
 *
 * Aurora-maxi-ii-bis-sz (the trial's first result, kept as it is): its host job's accepted revision holds the provider's
 * real metric and sketch answers. They are replayed by request hash through the same consultant path the host runs, so
 * LOCAL, the metric read and the sketches stand exactly as on the host. The reviewer's request is then NOT sent (the live
 * proof does not fit the remaining pool: see R2 report) — the transport writes the outgoing message as it would be sent
 * (with the MODEL ELEMENT INDEX) and refuses, unbilled. What this shows: the index is in the message the provider would
 * get; the wrong front door the earlier reviewer described ("far left … about 59 % along the facade") has an id there.
 *
 * Then CONTROLLED counter-trials (proposals written here, labelled CONTROLLED — not a reviewer's answer) on that real
 * revision and its real source elevations, through the executor: the correct id → UPDATE_OPENING → source measure;
 * a made-up id; a stale id; the similar piece beside it; the wrong host side. The box of the door is the provider's own
 * reading of the front elevation (its sketch's DOOR polygon), not a number made up here.
 *   npx vite-node research/source-to-model/v35417/r2/index-proof.ts -- --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'
import { consultAnalysis } from '../../../../packages/analysis-service/src/consult/consult-analysis.js'
import { CONSULT_PRICES } from '../../../../packages/analysis-service/src/consult/cost.js'
import { replayModel } from '../../../../packages/analysis-service/src/consult/accepted-consult.js'
import type { AcceptedConsultRevision } from '../../../../packages/analysis-service/src/consult/accepted-consult.js'
import { ConsultantUnavailable } from '../../../../packages/analysis-service/src/consult/loop.js'
import type { ConsultantModel } from '../../../../packages/analysis-service/src/consult/loop.js'
import { exchangeLog, fileExchangeSink } from '../../../../packages/analysis-service/src/consult/exchange-log.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const out = argv[argv.indexOf('--out') + 1] as string
mkdirSync(out, { recursive: true })
const optOf = (n: string, d: string): string => (argv.indexOf(`--${n}`) >= 0 ? (argv[argv.indexOf(`--${n}`) + 1] as string) : d)
const URL_A = optOf('url', 'https://www.studioatrium.pl/projekty-domow/Aurora-maxi-ii-bis-sz,1795.html')
const CACHE = optOf('cache', '/home/user/rd/v35417/trial/cache')
const accepted = JSON.parse(readFileSync(optOf('accepted', '/home/user/rd/v35417/host/data/accepted-consulted-revisions/37116912af3a43c180648330a23f3d13.json'), 'utf8')) as AcceptedConsultRevision
const counter = { replayed: 0, missing: 0 }
const base = { id: 'anthropic-messages', maxOutputTokens: 8000 }
const metric = replayModel({ ...base, model: 'claude-opus-5-5', maxOutputTokens: 16000 }, 'METRIC', accepted.answers, counter)
const sketch = replayModel({ ...base, model: 'claude-sonnet-5-5', maxOutputTokens: 6000 }, 'SKETCH', accepted.answers, counter)
const notSent: Array<{ system: number; text: string[] }> = []
// the reviewer's transport: the request is written (by the exchange log around it) and refused unbilled — never sent
const reviewer: ConsultantModel = { ...base, model: 'claude-sonnet-5-5', strict: true, send: async (req) => {
  const texts = (JSON.parse(JSON.stringify(req.messages)) as Array<{ content: Array<{ type: string; text?: string }> }>).flatMap((m) => m.content.filter((c) => c.type === 'text').map((c) => c.text as string))
  notSent.push({ system: req.system.length, text: texts })
  throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (R2 offline): the live proof does not fit the remaining pool')
} }
const events: Array<Record<string, unknown>> = []
const log = exchangeLog(fileExchangeSink(join(out, 'exchanges')))
const price = CONSULT_PRICES['claude-sonnet-5-5']
const r = await consultAnalysis(
  { kind: 'URL', url: URL_A },
  { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(CACHE), offline: true },
  { model: reviewer, price, metricRead: 'ON', metricModel: metric, metricPrice: CONSULT_PRICES['claude-opus-5-5'], sketches: 'ON', sketchModel: sketch, sketchPrice: price, variant: 'C', maxGeometryRounds: 0, exchanges: log, record: (e) => events.push(e as Record<string, unknown>) },
)
const sent = events.filter((e) => e.kind === 'SENT_MODEL_CHECK')
const indexText = (sent[0]?.elementIndex as { text?: string } | null)?.text ?? ''
writeFileSync(join(out, 'outgoing-index.txt'), `${indexText}\n`)
const summary = {
  scope: 'R2 §3 offline: real revision (accepted answers replayed), reviewer request written and NOT sent; 0 USD',
  replay: counter,
  modelSha256: r.run?.result.modelSha256 ?? null,
  revisionLookedAt: sent.map((e) => e.baseRevision),
  elementIndex: sent.map((e) => ({ ...(e.elementIndex as Record<string, unknown>), text: undefined })),
  reviewerRequestsNotSent: notSent.length,
  indexInOutgoingMessage: notSent.some((n) => n.text.some((t) => t.startsWith('MODEL ELEMENT INDEX'))),
  frontOpenings: indexText.split('\n').filter((l) => / OPENING\//.test(l) && / FRONT /.test(l)),
}
writeFileSync(join(out, 'index-proof.json'), `${JSON.stringify(summary, null, 1)}\n`)
writeFileSync(join(out, 'events.json'), `${JSON.stringify(events, null, 1)}\n`)
process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`)

// ---------------------------------------------------------------------------------------------------------------------
// Phase B — CONTROLLED counter-trials through the same path (proposals written HERE, from the index of the message above
// and the provider's own sketch of the front elevation; labelled CONTROLLED; never a reviewer's answer)
// ---------------------------------------------------------------------------------------------------------------------
type Poly = Array<[number, number]>
const pics = (sent[0]?.pictures ?? []) as Array<{ n: number; what: string; frameId?: string; label: string; transform?: { x0: number; y0: number; scale: number } }>
const sk = (r.sketches?.reading.sketches ?? []).find((x) => x.facade === 'FRONT' && x.sketch)
const frontPic = pics.find((p) => p.frameId === sk?.frameId)
const lines = indexText.split('\n')
const pick = (re: RegExp): string | undefined => lines.find((l) => re.test(l))?.split(' · ')[0]
const doorId = pick(/ OPENING\/DOOR · FRONT /)
const rearId = pick(/ OPENING\/[A-Z_]+ · REAR /)
const win1 = pick(/^opening-0-front-0-1 /)
const win2Line = lines.find((l) => l.startsWith('opening-0-front-0-2 '))
const frontWallsLine = lines.filter((l) => / WALL · FRONT /.test(l))
const B: Record<string, unknown> = { controlled: true, doorId, rearId, frontPicture: frontPic?.n ?? null, sketchFrame: sk?.frameId ?? null }
if (sk?.sketch && frontPic && doorId && rearId && win1 && win2Line) {
  const s = sk.sketch as unknown as { groundRow: number | null; walls: Array<{ polygon: Poly }>; openings: Array<{ kind: string; polygon: Poly }> }
  const t = frontPic.transform ?? { x0: 0, y0: 0, scale: 1 }
  const toPic = ([x, y]: [number, number]): [number, number] => [(x - t.x0) * t.scale, (y - t.y0) * t.scale]
  const bbox = (p: Poly) => { const q = p.map(toPic); return { x0: Math.min(...q.map((a) => a[0])), y0: Math.min(...q.map((a) => a[1])), x1: Math.max(...q.map((a) => a[0])), y1: Math.max(...q.map((a) => a[1])) } }
  const walls = s.walls.map((w) => bbox(w.polygon))
  const wallLeftX = Math.min(...walls.map((w) => w.x0))
  const wallRightX = Math.max(...walls.map((w) => w.x1))
  const groundY = toPic([0, s.groundRow ?? Math.max(...walls.map((w) => w.y1))])[1]
  const eavesY = Math.min(...walls.map((w) => w.y0))
  const doors = s.openings.filter((o) => /DOOR/.test(o.kind)).map((o) => bbox(o.polygon)).sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0))
  const door = doors[0]
  // the similar window beside the first: where the index puts opening-0-front-0-2, through this registration
  const sideLen = Math.max(...frontWallsLine.map((l) => Number(/–([0-9.]+) m from the left/.exec(l)?.[1] ?? 0)))
  const mpp = sideLen / (wallRightX - wallLeftX)
  const al = /([0-9.]+)–([0-9.]+) m from the left/.exec(win2Line) as RegExpExecArray
  const hi = /· ([0-9.]+)–([0-9.]+) m high/.exec(win2Line) as RegExpExecArray
  const win2Box = { x0: wallLeftX + Number(al[1]) / mpp, x1: wallLeftX + Number(al[2]) / mpp, y0: groundY - Number(hi[2]) / mpp, y1: groundY - Number(hi[1]) / mpp }
  const view = (id: string) => ({ proposalId: `ctl-view-${id}`, baseRevision: String(sent[0]?.baseRevision), operation: 'ASSIGN_VIEW', targetId: 'FRONT', proposed: { literal: 'front elevation', unit: 'unknown' }, patch: { picture: frontPic.n, side: 'FRONT', mirrored: false, wallLeftX, wallRightX, groundY, eavesY }, group: id, evidence: [{ sourceId: String(frontPic.n) }], justification: 'CONTROLLED: the registration from the provider\'s sketch of this elevation', alternatives: [], uncertainty: 'LOW', expectedEffect: 'the front registered with heights' })
  const upd = (pid: string, target: string, box: { x0: number; y0: number; x1: number; y1: number }, kind: string, group: string, defectId: string) => ({ proposalId: pid, baseRevision: String(sent[0]?.baseRevision), operation: 'UPDATE_OPENING', targetId: target, proposed: { literal: `${kind.toLowerCase()} moved`, unit: 'unknown' }, patch: { picture: frontPic.n, box, kind }, group, defectId, evidence: [{ sourceId: String(frontPic.n) }], justification: 'CONTROLLED', alternatives: [], uncertainty: 'LOW', expectedEffect: 'the opening where the source draws it' })
  const look1 = {
    status: 'ISSUE_FOUND',
    observations: [{ about: 'FRONT door', seen: 'CONTROLLED counter-trial set (R2 offline), not a reviewer answer', certainty: 'CERTAIN' }],
    requestedEvidence: [],
    defects: [
      { id: 'D1', about: 'CONTROLLED: front door at the far left in the model; the source draws it further right', scope: 'FRONT', severity: 'KEY', certainty: 'CERTAIN', operation: 'UPDATE_OPENING', targetId: doorId },
      { id: 'D2', about: 'CONTROLLED: an id that is not in the index', scope: 'FRONT', severity: 'MAJOR', certainty: 'CERTAIN', operation: 'UPDATE_OPENING', targetId: 'front-door-1' },
      { id: 'D3', about: 'CONTROLLED: the similar window beside it', scope: 'FRONT', severity: 'MINOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING', targetId: win1 },
      { id: 'D4', about: 'CONTROLLED: a rear opening moved through the front elevation', scope: 'FRONT', severity: 'MINOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING', targetId: rearId },
      { id: 'D5', about: 'CONTROLLED: a window position the reviewer cannot bind (two could be it)', scope: 'FRONT', severity: 'MAJOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING', blocker: 'AMBIGUOUS_TARGET' },
      { id: 'D6', about: 'CONTROLLED: the old classification (no target, UNSUPPORTED/OTHER) naming the door', scope: 'FRONT', severity: 'MAJOR', certainty: 'LIKELY', operation: 'UNSUPPORTED', family: 'OTHER', targetId: doorId },
    ],
    proposedCorrections: [
      view('g-door'), upd('ctl-door', doorId, door, 'DOOR', 'g-door', 'D1'),
      upd('ctl-invented', 'front-door-1', door, 'DOOR', 'g-invented', 'D2'),
      view('g-similar'), upd('ctl-similar', win1, win2Box, 'WINDOW', 'g-similar', 'D3'),
      view('g-host'), upd('ctl-host', rearId, door, 'DOOR', 'g-host', 'D4'),
    ],
    checked: ['FRONT openings'],
    notChecked: ['everything else (controlled set)'],
  }
  B.look1 = look1
  B.sketchBoxes = { walls, roofs: (s as unknown as { roofs: Array<{ polygon: Poly }> }).roofs.map((x) => bbox(x.polygon)), doors, groundRow: s.groundRow, transform: t }
  let looks = 0
  const sentB: Array<{ revision: string; index: string }> = []
  const controlledReviewer: ConsultantModel = { ...base, model: 'claude-sonnet-5-5', strict: true, send: async (req) => {
    const texts = (JSON.parse(JSON.stringify(req.messages)) as Array<{ content: Array<{ type: string; text?: string }> }>).flatMap((m) => m.content.filter((c) => c.type === 'text').map((c) => c.text as string))
    // the label rounds of the metric layer are not this trial: refused unbilled, as in phase A
    if (!texts.some((x) => x.startsWith('Check the model against the drawings'))) throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (R2 offline): not the look under trial')
    looks += 1
    sentB.push({ revision: /Model revision ([0-9a-f]+)/.exec(texts.join('\n'))?.[1] ?? '', index: texts.find((x) => x.startsWith('MODEL ELEMENT INDEX')) ?? '' })
    if (looks > 1) throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (R2 offline): the final look of the patched revision is written, not sent')
    return { content: [{ type: 'tool_use', id: 'ctl-1', name: 'submit_review', input: look1 } as never], usage: { inputTokens: 0, outputTokens: 0 }, model: 'CONTROLLED', latencyMs: 0, stopReason: 'tool_use' }
  } }
  const counter2 = { replayed: 0, missing: 0 }
  const eventsB: Array<Record<string, unknown>> = []
  const rB = await consultAnalysis(
    { kind: 'URL', url: URL_A },
    { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(CACHE), offline: true },
    { model: controlledReviewer, price, metricRead: 'ON', metricModel: replayModel({ ...base, model: 'claude-opus-5-5', maxOutputTokens: 16000 }, 'METRIC', accepted.answers, counter2), metricPrice: CONSULT_PRICES['claude-opus-5-5'], sketches: 'ON', sketchModel: replayModel({ ...base, model: 'claude-sonnet-5-5', maxOutputTokens: 6000 }, 'SKETCH', accepted.answers, counter2), sketchPrice: price, variant: 'C', maxGeometryRounds: 1, exchanges: exchangeLog(fileExchangeSink(join(out, 'exchanges-B'))), record: (e) => eventsB.push(e as Record<string, unknown>) },
  )
  const g1 = rB.geometry[0]
  B.records = (g1?.patches ?? []).map((x) => ({ proposalId: x.proposalId, operation: x.operation, targetId: x.targetId, status: x.status, code: x.code ?? null, why: x.why.slice(0, 260), gate: (x as { gate?: { winner?: string; why?: string } }).gate ?? null, measure: (x as { measure?: { sourceVerified?: boolean | null; why?: string } }).measure ?? null }))
  B.transactions = (g1?.transactions ?? []).map((x) => ({ txId: x.txId, decision: x.decision, why: x.why.slice(0, 260) }))
  B.looks = sentB.map((x) => ({ revision: x.revision, indexLines: x.index.split('\n').length, door: x.index.split('\n').find((l) => l.startsWith(`${doorId} `)) ?? null }))
  B.delivered = rB.run ? { modelSha256: rB.run.result.modelSha256 } : null
  B.defects = (rB.sourceCheck?.quality?.defects ?? []).map((d) => ({ id: d.id, operation: d.operation, targetId: d.targetId ?? null, settlement: d.settlement, blocker: d.blocker ?? null, patchCode: d.patchCode ?? null }))
  B.quality = rB.sourceCheck?.quality ? { state: rB.sourceCheck.quality.state, reasons: rB.sourceCheck.quality.reasons } : null
  B.replay = counter2
  writeFileSync(join(out, 'events-B.json'), `${JSON.stringify(eventsB, null, 1)}\n`)
}
writeFileSync(join(out, 'counter-trials.json'), `${JSON.stringify(B, null, 1)}\n`)
process.stdout.write(`${JSON.stringify({ ...B, look1: undefined }, null, 1)}\n`)

// ---------------------------------------------------------------------------------------------------------------------
// Phase C — CONTROLLED, through a view the ANALYZER registered with heights: a model opening whose place the provider's
// sketch of that elevation contradicts (overlap 0.05–0.6 with one sketch opening that no other model opening covers) is
// chosen deterministically; its id (never patched before) → UPDATE_OPENING with the sketch's box → the source gate and
// the measure → the final look's message (written, not sent). With the counter-trials of phase B on the same view.
// ---------------------------------------------------------------------------------------------------------------------
{
  const { viewsOfRun, openingSpan } = await import('../../../../packages/analysis-service/src/consult/correct/execute.js')
  type Box = { x0: number; y0: number; x1: number; y1: number }
  const iou = (a: Box, b: Box): number => { const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)); const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)); const i = w * h; return i / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i) }
  const C: Record<string, unknown> = { controlled: true }
  const run = r.run
  const views = run ? viewsOfRun(run.reconstruction.facadeAlignment.views).filter((v) => v.heights) : []
  const m = run?.reconstruction.model
  const choice: Array<Record<string, unknown>> = []
  const probes: Array<{ side: string; picture: number; reg: Record<string, number> }> = []
  // every side the provider sketched: its registration from the sketch (walls' ends, ground row, the roof's lowest edge as
  // the eaves), the model's openings placed through it from the index (metres from the left, heights), the sketch's own
  for (const skv of (r.sketches?.reading.sketches ?? []).filter((x) => x.sketch)) {
    const side = ({ FRONT: 'FRONT', REAR: 'REAR', EAST: 'RIGHT', WEST: 'LEFT' } as Record<string, string>)[skv.facade]
    const pic = pics.find((p) => p.frameId === skv.frameId)
    if (!side || !pic || !m) continue
    const t = pic.transform ?? { x0: 0, y0: 0, scale: 1 }
    const tp = (b: Box): Box => ({ x0: (b.x0 - t.x0) * t.scale, y0: (b.y0 - t.y0) * t.scale, x1: (b.x1 - t.x0) * t.scale, y1: (b.y1 - t.y0) * t.scale })
    const sk2 = skv.sketch as unknown as { groundRow: number | null; walls: Array<{ polygon: Poly }>; roofs: Array<{ polygon: Poly }>; openings: Array<{ kind: string; polygon: Poly }> }
    const bb = (pl: Poly): Box => tp({ x0: Math.min(...pl.map((q) => q[0])), x1: Math.max(...pl.map((q) => q[0])), y0: Math.min(...pl.map((q) => q[1])), y1: Math.max(...pl.map((q) => q[1])) })
    const walls = sk2.walls.map((w) => bb(w.polygon))
    if (walls.length === 0 || sk2.groundRow === null || sk2.roofs.length === 0) continue
    const reg = { wallLeftX: Math.min(...walls.map((w) => w.x0)), wallRightX: Math.max(...walls.map((w) => w.x1)), groundY: (sk2.groundRow - t.y0) * t.scale, eavesY: Math.max(...sk2.roofs.map((q) => bb(q.polygon).y1)) }
    const sideLines = lines.filter((l) => l.split(' · ')[2] === side)
    const sideLen = Math.max(...sideLines.filter((l) => / WALL · /.test(l)).map((l) => Number(/–([0-9.]+) m from the left/.exec(l)?.[1] ?? 0)))
    const mpp = sideLen / (reg.wallRightX - reg.wallLeftX)
    const model = sideLines.filter((l) => / OPENING\//.test(l)).flatMap((l) => { const al = /([0-9.]+)–([0-9.]+) m from the left/.exec(l); const hi = /· ([0-9.]+)–([0-9.]+) m high/.exec(l); return al && hi ? [{ id: l.split(' · ')[0], box: { x0: reg.wallLeftX + Number(al[1]) / mpp, x1: reg.wallLeftX + Number(al[2]) / mpp, y0: reg.groundY - Number(hi[2]) / mpp, y1: reg.groundY - Number(hi[1]) / mpp } }] : [] })
    for (const so of sk2.openings.map((o) => ({ kind: o.kind, box: bb(o.polygon) }))) {
      const over = model.map((mo) => ({ id: mo.id, iou: iou(mo.box, so.box), box: mo.box })).sort((x, y) => y.iou - x.iou)
      const best = over[0]
      probes.push({ side, picture: pic.n, reg })
      if (best && best.iou > 0.05 && best.iou < 0.6 && (over[1]?.iou ?? 0) < 0.05) choice.push({ side, frameId: skv.frameId, picture: pic.n, reg, targetId: best.id, iou: Math.round(best.iou * 100) / 100, sketchKind: so.kind, sketchBox: so.box, modelBox: best.box, others: model.filter((x) => x.id !== best.id) })
    }
  }
  C.debug = { views: run ? viewsOfRun(run.reconstruction.facadeAlignment.views).map((v) => ({ side: v.side, frameId: v.frameId.slice(-12), heights: v.heights })) : [], sketches: (r.sketches?.reading.sketches ?? []).map((x) => ({ facade: x.facade, frameId: x.frameId.slice(-12), openings: (x.sketch as unknown as { openings?: unknown[] } | undefined)?.openings?.length ?? null })), pictures: pics.map((p) => ({ n: p.n, frameId: (p.frameId ?? '').slice(-12) })) }
  choice.sort((a, b) => (a.iou as number) - (b.iou as number))
  C.candidates = choice.map((c) => ({ side: c.side, targetId: c.targetId, iou: c.iou, sketchKind: c.sketchKind }))
  const c = choice[0] as undefined | { side: string; picture: number; reg: { wallLeftX: number; wallRightX: number; groundY: number; eavesY: number }; targetId: string; sketchKind: string; sketchBox: Box; others: Array<{ id: string; box: Box }> }
  if (c && run) {
    const toPic = (b: Box): Box => b
    const viewOf = (g: string) => ({ proposalId: `ctl-view-${g}`, baseRevision: String(sent[0]?.baseRevision), operation: 'ASSIGN_VIEW', targetId: c.side, proposed: { literal: `${c.side.toLowerCase()} elevation`, unit: 'unknown' }, patch: { picture: c.picture, side: c.side, mirrored: false, ...c.reg }, group: g, evidence: [{ sourceId: String(c.picture) }], justification: 'CONTROLLED: the registration from the provider\'s sketch of this elevation', alternatives: [], uncertainty: 'LOW', expectedEffect: 'the side registered with heights' })
    const kind = /GARAGE/.test(c.sketchKind) ? 'GARAGE_DOOR' : /GLAZED/.test(c.sketchKind) ? 'GLAZED_DOOR' : /DOOR/.test(c.sketchKind) ? 'DOOR' : 'WINDOW'
    const other = c.others[0]
    const third = c.others[1]
    const otherSide = lines.map((l) => l.split(' · ')).find((f) => f[1]?.startsWith('OPENING/') && f[2] && f[2] !== c.side)?.[0]
    const rev = String(sent[0]?.baseRevision)
    const prop = (pid: string, target: string, box: Box, k: string, defectId: string) => ({ proposalId: pid, baseRevision: rev, operation: 'UPDATE_OPENING', targetId: target, proposed: { literal: `${k.toLowerCase()} where the source draws it`, unit: 'unknown' }, patch: { picture: c.picture, box: toPic(box), kind: k }, group: `g-${pid}`, defectId, evidence: [{ sourceId: String(c.picture) }], justification: 'CONTROLLED (R2 offline): box from the provider\'s sketch of this elevation', alternatives: [], uncertainty: 'LOW', expectedEffect: 'the opening where the source draws it' })
    const look = {
      status: 'ISSUE_FOUND',
      observations: [{ about: `${c.side} ${c.targetId}`, seen: 'CONTROLLED counter-trial set (R2 offline), not a reviewer answer', certainty: 'CERTAIN' }],
      requestedEvidence: [],
      defects: [
        { id: 'D1', about: `CONTROLLED: ${c.targetId} stands elsewhere than the source draws it`, scope: c.side, severity: 'KEY', certainty: 'CERTAIN', operation: 'UPDATE_OPENING', targetId: c.targetId },
        { id: 'D2', about: 'CONTROLLED: a made-up id', scope: c.side, severity: 'MAJOR', certainty: 'CERTAIN', operation: 'UPDATE_OPENING', targetId: 'opening-made-up-1' },
        ...(other && third ? [{ id: 'D3', about: 'CONTROLLED: the similar piece moved onto its neighbour', scope: c.side, severity: 'MINOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING', targetId: other.id }] : []),
        ...(otherSide ? [{ id: 'D4', about: 'CONTROLLED: an opening of another side through this elevation', scope: c.side, severity: 'MINOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING', targetId: otherSide }] : []),
        { id: 'D5', about: 'CONTROLLED: reported with no target (the old form)', scope: c.side, severity: 'MAJOR', certainty: 'LIKELY', operation: 'UPDATE_OPENING' },
        { id: 'D6', about: 'CONTROLLED: UNSUPPORTED/OTHER naming a listed opening', scope: c.side, severity: 'MAJOR', certainty: 'LIKELY', operation: 'UNSUPPORTED', family: 'OTHER', targetId: c.targetId },
      ],
      proposedCorrections: [
        viewOf('g-ctl-correct'), prop('ctl-correct', c.targetId, c.sketchBox, kind, 'D1'),
        prop('ctl-made-up', 'opening-made-up-1', c.sketchBox, kind, 'D2'),
        ...(other && third ? [viewOf('g-ctl-similar'), prop('ctl-similar', other.id, third.box, 'WINDOW', 'D3')] : []),
        ...(otherSide ? [viewOf('g-ctl-other-side'), prop('ctl-other-side', otherSide, c.sketchBox, kind, 'D4')] : []),
        ...[...new Map(probes.map((q) => [q.side, q])).values()].map((q) => ({ proposalId: `ctl-probe-${q.side}`, baseRevision: rev, operation: 'ASSIGN_VIEW', targetId: q.side, proposed: { literal: 'probe', unit: 'unknown' }, patch: { picture: q.picture, side: q.side, mirrored: false, ...q.reg }, group: `g-probe-${q.side}`, evidence: [{ sourceId: String(q.picture) }], justification: 'CONTROLLED registration probe', alternatives: [], uncertainty: 'LOW', expectedEffect: 'registration' })),
      ],
      checked: [`${c.side} openings`],
      // one registration probe per sketched side, alone: which side the executor registers with heights at all
      ...{},
      notChecked: ['everything else (controlled set)'],
    }
    let looks = 0
    const sentC: Array<{ revision: string; index: string; applied: string }> = []
    const rv: ConsultantModel = { ...base, model: 'claude-sonnet-5-5', strict: true, send: async (req) => {
      const texts = (JSON.parse(JSON.stringify(req.messages)) as Array<{ content: Array<{ type: string; text?: string }> }>).flatMap((mm) => mm.content.filter((cc) => cc.type === 'text').map((cc) => cc.text as string))
      if (!texts.some((x) => x.startsWith('Check the model against the drawings'))) throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (R2 offline): not the look under trial')
      looks += 1
      sentC.push({ revision: /Model revision ([0-9a-f]+)/.exec(texts.join('\n'))?.[1] ?? '', index: texts.find((x) => x.startsWith('MODEL ELEMENT INDEX')) ?? '', applied: texts.find((x) => x.startsWith('Since your last look')) ?? '' })
      if (looks > 1) throw new ConsultantUnavailable('REJECTED_UNBILLED', 'NOT SENT (R2 offline): the final look of the patched revision is written, not sent')
      return { content: [{ type: 'tool_use', id: 'ctl-c', name: 'submit_review', input: look } as never], usage: { inputTokens: 0, outputTokens: 0 }, model: 'CONTROLLED', latencyMs: 0, stopReason: 'tool_use' }
    } }
    const k3 = { replayed: 0, missing: 0 }
    const rC = await consultAnalysis(
      { kind: 'URL', url: URL_A },
      { adapters: [archonAdapter, genericProjectPageAdapter], cache: fileByteCache(CACHE), offline: true },
      { model: rv, price, metricRead: 'ON', metricModel: replayModel({ ...base, model: 'claude-opus-5-5', maxOutputTokens: 16000 }, 'METRIC', accepted.answers, k3), metricPrice: CONSULT_PRICES['claude-opus-5-5'], sketches: 'ON', sketchModel: replayModel({ ...base, model: 'claude-sonnet-5-5', maxOutputTokens: 6000 }, 'SKETCH', accepted.answers, k3), sketchPrice: price, variant: 'C', maxGeometryRounds: 1, exchanges: exchangeLog(fileExchangeSink(join(out, 'exchanges-C'))) },
    )
    const g1 = rC.geometry[0]
    C.chosen = { side: c.side, targetId: c.targetId, previouslyPatched: false, iouBefore: (choice[0] as { iou: number }).iou }
    C.look = look
    C.records = (g1?.patches ?? []).map((x) => ({ proposalId: x.proposalId, targetId: x.targetId, status: x.status, code: x.code ?? null, why: x.why.slice(0, 300), gate: (x as { gate?: unknown }).gate ?? null, measure: (x as { measure?: unknown }).measure ?? null }))
    C.looks = sentC.map((x) => ({ revision: x.revision, target: x.index.split('\n').find((l) => l.startsWith(`${c.targetId} `)) ?? null, applied: x.applied.slice(0, 300) }))
    C.defects = (rC.sourceCheck?.quality?.defects ?? []).map((d) => ({ id: d.id, operation: d.operation, targetId: d.targetId ?? null, settlement: d.settlement, blocker: d.blocker ?? null, patchCode: d.patchCode ?? null }))
    C.quality = rC.sourceCheck?.quality ? { state: rC.sourceCheck.quality.state, reasons: rC.sourceCheck.quality.reasons } : null
    C.delivered = rC.run ? { modelSha256: rC.run.result.modelSha256, revision: rC.sourceCheck?.deliveredRevision ?? null } : null
    C.replay = k3
  }
  writeFileSync(join(out, 'phase-c.json'), `${JSON.stringify(C, null, 1)}\n`)
  process.stdout.write(`PHASE C ${JSON.stringify({ ...C, look: undefined }, null, 1)}\n`)
}
