#!/usr/bin/env node
/**
 * extract.mjs — BUILDPLAN-ANALYZER-005K fresh-sheet gap set: extract and freeze the gap list (RESEARCH ONLY).
 *
 *   node research/analyzer-005k/extract.mjs --runs <gapset/runs> --ledger <draw-ledger.ndjson> --freeze-sha <40hex> --out <gap-set-manifest.json>
 *
 * Reads each drawn project's run (made once, live, at FREEZE_SHA, rule OFF) and keeps, on every plan frame whose
 * boundary was read, every gap in the population the protocol fixes (gap-set-protocol.md §4): classified WEAK, two WALL
 * jambs, drawn evidence. Each is stored by its key (project / frame / decomposition / gap) with its coordinates, crop
 * rectangle, ink-mask crop hash and the frame's byte hash — and with nothing a label could be steered by: no rule
 * condition beyond the population's own three, no outcome, no decision downstream of the classification.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const runs = resolve(arg('runs', '/home/user/work005k/gapset/runs'))
const freeze = arg('freeze-sha', '')
const ledger = readFileSync(resolve(arg('ledger', '/home/user/work005k/gapset/draw-ledger.ndjson')), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const kept = ledger.filter((e) => e.eligible)
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null)

const projects = []
const gaps = []
for (const [i, draw] of kept.entries()) {
  const id = `${draw.publisher === 'archon' ? 'A' : 'D'}${String(draw.k).padStart(2, '0')}`
  const dir = join(runs, id)
  const pkg = readJson(join(dir, 'source-package.json'))
  const summary = readJson(join(dir, 'result-summary.json'))
  const failure = readJson(join(dir, 'failure.json'))
  const digest = readJson(join(dir, 'plan-diagnostics', 'digest.json')) ?? failure?.plans ?? null
  const assetOf = new Map((pkg?.assets ?? []).flatMap((a) => a.variants.map((v) => [v.byteHash, { url: v.url, mediaType: v.mediaType ?? null }])))
  const sheets = []
  for (const p of digest?.plans ?? []) {
    const b = p.boundary
    if (!b?.gapEvidence) {
      sheets.push({ frameId: p.frameId, storey: p.storey ?? null, boundaryRead: false, inSet: 0 })
      continue
    }
    const population = b.gapEvidence.filter((r) => r.classified.boundary === 'WEAK' && r.jambs[0] === 'WALL' && r.jambs[1] === 'WALL' && r.drawnGapRule.check?.drawn === true)
    sheets.push({ frameId: p.frameId, storey: p.storey ?? null, boundaryRead: true, variantByteHash: p.variantByteHash, imageUrlSha256: assetOf.get(p.variantByteHash) ? sha256(assetOf.get(p.variantByteHash).url) : null, sizePx: p.sizePx, mpp: b.mpp, wallPx: p.wallPx, decompositionId: b.decompositionId, weakRecords: b.gapEvidence.length, inSet: population.length })
    for (const r of population) {
      gaps.push({
        key: `${id}/${p.frameId}/${r.decompositionId}/${r.gapId}`,
        project: id,
        publisher: draw.publisher,
        frameId: p.frameId,
        storey: p.storey ?? null,
        variantByteHash: p.variantByteHash,
        decompositionId: r.decompositionId,
        gapId: r.gapId,
        axis: r.axis,
        linePx: r.linePx,
        axisPx: r.axisPx,
        fromPx: r.fromPx,
        toPx: r.toPx,
        start: r.start,
        end: r.end,
        widthPx: r.widthPx,
        widthM: r.widthM,
        mppAlong: r.mppAlong,
        wallPx: r.wallPx,
        crop: r.crop,
        inkCropSha256: r.inkCropSha256,
      })
    }
  }
  projects.push({
    id,
    publisher: draw.publisher,
    url: draw.url,
    family: draw.family,
    drawK: draw.k,
    sourcePackageHash: pkg?.contentHash ?? null,
    pageSha256: pkg?.pageHash ?? null,
    run: summary ? { outcome: 'COMPLETED', modelHash: summary.modelHash } : failure ? { outcome: 'FAILED', code: `${failure.code}/${failure.reasonCode ?? '-'}` } : { outcome: 'NO_RUN' },
    sheets,
    inSet: sheets.reduce((a, s) => a + s.inSet, 0),
  })
}
gaps.sort((p, q) => (p.key < q.key ? -1 : p.key > q.key ? 1 : 0))
// neutral question ids, in an order that follows no project, sheet or position
const order = [...gaps].sort((p, q) => (sha256(`${freeze}:${p.key}`) < sha256(`${freeze}:${q.key}`) ? -1 : 1))
order.forEach((g, i) => (g.qid = `q${String(i + 1).padStart(3, '0')}`))
const list = gaps.map((g) => g.key).join('\n')
const doc = {
  stage: 'BUILDPLAN-ANALYZER-005K',
  kind: 'fresh-sheet gap set: the frozen list, sealed before any label (gap-set-protocol.md §4)',
  freezeSha: freeze,
  population: 'every gap on a sheet whose boundary was read that the frozen analyzer classified WEAK, between two WALL jambs, with drawn evidence (DrawnGapCheck.drawn)',
  projects,
  counts: { projects: projects.length, sheetsRead: projects.flatMap((p) => p.sheets).filter((s) => s.boundaryRead).length, sheetsWithGaps: projects.flatMap((p) => p.sheets).filter((s) => s.inSet > 0).length, gaps: gaps.length, byPublisher: Object.fromEntries(['archon', 'dobredomy'].map((x) => [x, gaps.filter((g) => g.publisher === x).length])) },
  listSha256: sha256(list),
  gaps,
}
writeFileSync(resolve(arg('out', 'gap-set-manifest.json')), `${JSON.stringify(doc, null, 1)}\n`)
process.stdout.write(`${doc.counts.projects} projects, ${doc.counts.sheetsRead} sheets read, ${doc.counts.sheetsWithGaps} with gaps, ${doc.counts.gaps} gaps; list ${doc.listSha256}\n`)
