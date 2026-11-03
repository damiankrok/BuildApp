// SOURCE-01 (research): the eight regression houses, BEFORE (no encoder) and AFTER (--content), fresh extraction.
//   node research/analyzer-source-01/compare-regression.mjs <before-dir> <after-dir> [--json out]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const [B, A] = process.argv.slice(2)
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : undefined
const label = new Map()
for (const f of ['research/image-understanding/data/labels-archon.json', 'research/image-understanding/data/labels-archon-final.json', 'research/image-understanding/data/labels-archon-iu03a.json', 'research/image-understanding/data/labels-archon-iu03b.json', 'research/analyzer-source-01/labels-test-new.json', 'research/analyzer-source-01/labels-dev-new.json']) for (const r of JSON.parse(readFileSync(f, 'utf8')).rows) label.set(r.sha256, r.label)
const read = (d, h) => { const f = join(d, h, 'result-summary.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { failed: existsSync(join(d, h, 'failure.json')) ? JSON.parse(readFileSync(join(d, h, 'failure.json'), 'utf8')).reasonCode : 'MISSING' } }
const perf = (d, h) => { try { return JSON.parse(readFileSync(join(d, h, 'performance.json'), 'utf8')) } catch { return {} } }
const rows = []
for (const h of ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3']) {
  const b = read(B, h), a = read(A, h)
  if (b.failed || a.failed) { rows.push({ house: h, before: b.failed ?? 'ok', after: a.failed ?? 'ok' }); continue }
  const cams = (s) => s.sources.sheets.filter((x) => x.claimed.document === 'PERSPECTIVE_RENDER' && /camera solved/.test(x.why)).length
  const interiorCams = (s) => s.sources.sheets.filter((x) => x.claimed.document === 'PERSPECTIVE_RENDER' && /camera solved/.test(x.why) && label.get(x.byteHash) === 'INTERIOR_PERSPECTIVE').length
  const refused = a.sources.sheets.filter((x) => x.outcome === 'REFUSED_BY_CONTENT').map((x) => ({ assetId: x.assetId, claimed: x.claimed.document, pixels: x.content?.top, p: x.content?.probability, label: label.get(x.byteHash) ?? 'UNLABELLED' }))
  const wrongRefusals = refused.filter((r) => !(r.label === 'INTERIOR_PERSPECTIVE' || (r.claimed === 'PERSPECTIVE_RENDER' && r.label !== 'EXTERIOR_PERSPECTIVE')))
  const p = perf(A, h).content?.batches?.[0]
  rows.push({
    house: h,
    model: b.modelHash === a.modelHash ? 'SAME' : 'CHANGED', modelBefore: b.modelHash.slice(0, 12), modelAfter: a.modelHash.slice(0, 12),
    sceneSame: b.sceneContentHash === a.sceneContentHash,
    counts: Object.fromEntries(['masses', 'openings', 'rooms', 'chimneys', 'frames'].map((k) => [k, b.counts[k] === a.counts[k] ? b.counts[k] : `${b.counts[k]}→${a.counts[k]}`])),
    exteriorErrors: `${b.verification.closure.exteriorErrors}→${a.verification.closure.exteriorErrors}`,
    replay: a.verification.replay,
    perspectiveCamerasSolved: `${cams(b)}→${cams(a)}`, interiorCamerasSolved: `${interiorCams(b)}→${interiorCams(a)}`,
    unchecked: `${b.assessment.sourceUnchecked.counts.total}→${a.assessment.sourceUnchecked.counts.total}`,
    refusedByContent: refused.length, wrongRefusals,
    refused,
    contentCost: p ? { images: p.images, loadMs: p.loadMs, embedMs: p.embedMs, rssBeforeMB: Math.round(p.rss.beforeBytes / 2 ** 20), rssAfterLoadMB: Math.round((p.rss.afterLoadBytes ?? 0) / 2 ** 20), rssAfterExitMB: Math.round(p.rss.afterExitBytes / 2 ** 20) } : null,
    peakRssMB: `${perf(B, h).peakRssMB}→${perf(A, h).peakRssMB}`, totalMs: `${perf(B, h).totalMs}→${perf(A, h).totalMs}`,
  })
}
for (const r of rows) console.log(JSON.stringify({ ...r, refused: r.refused?.length }))
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(rows, null, 1)}\n`)
