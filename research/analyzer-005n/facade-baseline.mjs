#!/usr/bin/env node
/**
 * facade-baseline.mjs — BUILDPLAN-ANALYZER-005N Part A (RESEARCH ONLY): the facade-local baseline record of brief §8, at
 * the starting code, for each target facade, from the decomposition traces (`trace-decompositions.mjs`,
 * `fixture-trace.ts`) and each row's run outcome. Numbers, ids and px coordinates only.
 *
 *   node research/analyzer-005n/facade-baseline.mjs --trace <dir> --out <json>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arg = (n, f) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : f
}
const dir = resolve(arg('trace', '/home/user/work005n/trace'))
const out = resolve(arg('out'))
const r3 = (x) => Math.round(x * 1000) / 1000

/** The target facades: one row's decomposition (by its key prefix, or a fixture label), the facade line and the span weighed. */
const SPECS = [
  { id: 'murajach/ground/incumbent/front', row: 'dom-w-murajach', key: 'frame-asset-rzut-36e1e5a39d-fb4609c5e2|108.5|208.5|543|685.25', axis: 'Y', line: 621.5, from: 380, to: 543, inward: -1, side: 'S (set-back front: vestibule + pier; the garage lies beyond the extent)', role: 'PRIMARY' },
  { id: 'murajach/ground/incumbent/house-front', row: 'dom-w-murajach', key: 'frame-asset-rzut-36e1e5a39d-fb4609c5e2|108.5|208.5|543|685.25', axis: 'Y', line: 659, from: 109, to: 543, inward: -1, side: 'S (the house front, the left part)', role: 'PRIMARY' },
  { id: 'murajach/ground/incumbent/party-side', row: 'dom-w-murajach', key: 'frame-asset-rzut-36e1e5a39d-fb4609c5e2|108.5|208.5|543|685.25', axis: 'X', line: 536.5, from: 209, to: 685, inward: -1, side: 'E (the extent stops on the house/garage party wall)', role: 'PRIMARY' },
  { id: 'murajach/ground/cluster-extent/front', row: 'dom-w-murajach', key: 'frame-asset-rzut-36e1e5a39d-fb4609c5e2|109|209|765|685', axis: 'Y', line: 621.5, from: 380, to: 754, inward: -1, side: 'S (set-back front in the wall-mass-cluster reading: vestibule door, pier, garage door)', role: 'PRIMARY' },
  { id: 'gozdzikowcach/ground/incumbent/front', row: 'dom-w-gozdzikowcach', key: 'frame-asset-rzut-01d4b6474c-64bd1e0f2f|96|221|641|598', axis: 'Y', line: 598, from: 208, to: 641, inward: -1, side: 'S (recess mouth, pier, garage door)', role: 'PRIMARY' },
  { id: 'jarzabem/ground/incumbent/front', row: 'dom-pod-jarzabem', key: 'frame-asset-rzut-9354eb066f-397808a266|103|116|802.5|596.5|0.02788', axis: 'Y', line: 596.5, from: 263, to: 785, inward: -1, side: 'S (recessed entrance, no garage on this line)', role: 'SECONDARY' },
  { id: 'jarzabem/ground/incumbent/setback', row: 'dom-pod-jarzabem', key: 'frame-asset-rzut-9354eb066f-397808a266|103|116|802.5|596.5|0.02788', axis: 'Y', line: 562.875, from: 263, to: 785, inward: -1, side: 'S (the vestibule’s back-wall line)', role: 'SECONDARY' },
  { id: 'cyklamenach/ground/incumbent/rear', row: 'dom-w-cyklamenach', key: 'frame-asset-rzut-fa38f527ea-8e7eb2ad66|131|195.5|580|694|0.020272', axis: 'Y', line: 195.5, from: 131, to: 580, inward: 1, side: 'N (glazing + terrace door, REC-17 control)', role: 'NEGATIVE_CONTROL' },
  { id: 'marcowki/ground/incumbent/front', row: 'marcowki', key: 'frame-asset-rzut-19a11bc745-33a5ff46cd|58|221|514|773', axis: 'Y', line: 735.5, from: 58, to: 514, inward: -1, side: 'S (known-good garage house)', role: 'KNOWN_GOOD_GARAGE' },
  { id: 'fixture/open-carport-bay', row: 'fixtures', label: 'FIXTURE_OPEN_CARPORT_BAY', axis: 'Y', line: 280, from: 40, to: 360, inward: -1, side: 'S', role: 'TRUE_OPEN_CARPORT' },
  { id: 'fixture/loggia-recess', row: 'fixtures', label: 'FIXTURE_LOGGIA_RECESS', axis: 'Y', line: 280, from: 40, to: 360, inward: -1, side: 'S', role: 'RECESS_WITHOUT_GARAGE' },
  { id: 'fixture/double-garage-bay', row: 'fixtures', label: 'FIXTURE_DOUBLE_GARAGE_BAY', axis: 'Y', line: 400, from: 100, to: 232, inward: -1, side: 'S (the bay’s far line)', role: 'DOUBLE_GARAGE' },
  { id: 'fixture/compound-recess-garage-blank', row: 'fixtures', label: 'FIXTURE_COMPOUND_RECESS_GARAGE_BLANK', axis: 'Y', line: 280, from: 40, to: 360, inward: -1, side: 'S', role: 'TARGET_SYNTHETIC' },
  { id: 'fixture/compound-recess-garage-door', row: 'fixtures', label: 'FIXTURE_COMPOUND_RECESS_GARAGE_DOOR', axis: 'Y', line: 280, from: 40, to: 360, inward: -1, side: 'S', role: 'TARGET_SYNTHETIC' },
]

const records = new Map()
const load = (row) => {
  if (!records.has(row)) {
    const f = join(dir, `${row}.ndjson`)
    records.set(row, existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [])
  }
  return records.get(row)
}
const outcomeOf = (row) => {
  const d = join(dir, row)
  const fail = join(d, 'failure.json')
  if (existsSync(fail)) {
    const f = JSON.parse(readFileSync(fail, 'utf8'))
    return { outcome: 'FAILED', code: f.reasonCode, firstFailure: f.diagnostics?.firstFailure ?? null, gateBlocking: f.diagnostics?.gateBlocking ?? null, selectedPlanFrameId: f.diagnostics?.selectedPlanFrameId ?? null }
  }
  const s = join(d, 'result-summary.json')
  if (existsSync(s)) {
    const x = JSON.parse(readFileSync(s, 'utf8'))
    return { outcome: 'COMPLETED', modelHash: x.modelHash ?? null }
  }
  return null
}

const rows = []
for (const spec of SPECS) {
  const recs = load(spec.row)
  const d = spec.label ? recs.find((x) => x.label === spec.label) : recs.find((x) => x.key.startsWith(spec.key))
  if (!d) {
    rows.push({ id: spec.id, missing: true })
    continue
  }
  const W = d.wallPx
  const mppAlong = spec.axis === 'Y' ? d.mpp.x : d.mpp.y
  const mppAcross = spec.axis === 'Y' ? d.mpp.y : d.mpp.x
  const lines = spec.axis === 'Y' ? d.walls?.y ?? [] : d.walls?.x ?? []
  const cross = spec.axis === 'Y' ? d.walls?.x ?? [] : d.walls?.y ?? []
  const facade = [...lines].sort((a, b) => Math.abs(a.px - spec.line) - Math.abs(b.px - spec.line))[0]
  const inSpan = (a, b) => Math.min(b, spec.to) - Math.max(a, spec.from) > 0
  // collinear pieces: the band pieces the incumbent's wide-gap reader sees, and the ink pieces the boundary reader sees
  const along = spec.axis === 'Y' ? 'H' : 'V'
  const bandPieces = d.bands.filter((b) => b[0] === along && Math.abs(b[1] - spec.line) <= Math.max(4, W * 0.6) + b[2] / 2).map((b) => ({ from: spec.axis === 'Y' ? b[3] : b[4], to: spec.axis === 'Y' ? b[5] : b[6], thickness: b[2] })).filter((p) => inSpan(p.from, p.to))
  const inkPieces = (facade?.pieces ?? []).filter((p) => inSpan(p[0], p[1])).map((p) => ({ from: p[0], to: p[1], kind: p[2], along: p[3] === 1, lengthM: r3((p[1] - p[0]) * mppAlong) }))
  // perpendicular candidates: bands across the facade whose axis falls in the span and whose run comes within two walls of the line
  const perpBands = d.bands
    .filter((b) => b[0] !== along)
    .map((b) => ({ axis: b[0], position: b[1], thickness: b[2], from: spec.axis === 'Y' ? b[4] : b[3], to: spec.axis === 'Y' ? b[6] : b[5] }))
    .filter((b) => b.position >= spec.from && b.position <= spec.to && Math.min(Math.abs(b.from - spec.line), Math.abs(b.to - spec.line)) <= 2 * W)
    .map((b) => ({ ...b, meetsFacade: Math.min(Math.abs(b.from - spec.line), Math.abs(b.to - spec.line)) <= W, inwardM: r3(Math.abs((spec.inward < 0 ? spec.line - b.from : b.to - spec.line)) * mppAcross), wallThick: b.thickness >= 0.6 * W }))
  // ink-read perpendicular lines (the boundary's grid) in the span: the first ink piece reaching the facade line
  const perpInk = cross
    .filter((l) => l.px >= spec.from && l.px <= spec.to)
    .map((l) => {
      const touching = l.pieces.filter((p) => (spec.inward < 0 ? p[1] >= spec.line - W && p[0] <= spec.line + W : p[0] <= spec.line + W && p[1] >= spec.line - W))
      const run = touching.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0]
      return { linePx: l.px, meetsFacade: !!run, runFrom: run?.[0] ?? null, runTo: run?.[1] ?? null, kind: run?.[2] ?? null, inwardM: run ? r3((run[1] - run[0]) * mppAcross) : 0 }
    })
  // set-back / back-wall candidates: parallel ink lines within 4.5 m inward of the facade, with their cover of the span
  const setback = lines
    .filter((l) => spec.inward < 0 ? l.px < spec.line - W && l.px >= spec.line - 4.5 / mppAcross : l.px > spec.line + W && l.px <= spec.line + 4.5 / mppAcross)
    .map((l) => {
      const ps = l.pieces.filter((p) => inSpan(p[0], p[1]) && p[2] === 'WALL')
      return { linePx: l.px, depthM: r3(Math.abs(l.px - spec.line) * mppAcross), wallPieces: ps.map((p) => [p[0], p[1]]), gaps: l.gaps.filter((g) => inSpan(g.from, g.to)).map((g) => ({ id: g.id, from: g.from, to: g.to, widthM: g.w, cls: g.cls, signature: g.sig })) }
    })
    .filter((s) => s.wallPieces.length > 0)
  const wide = d.wideOpenings.filter((w) => w.axis === spec.axis && Math.abs(w.linePx - spec.line) <= W * 2 && inSpan(w.fromPx, w.toPx))
  const cellsNear = d.cells.filter((c) => (spec.axis === 'Y' ? inSpan(c[3], c[5]) && Math.min(Math.abs(c[4] - spec.line), Math.abs(c[6] - spec.line)) <= 6 / mppAcross : inSpan(c[4], c[6]) && Math.min(Math.abs(c[3] - spec.line), Math.abs(c[5] - spec.line)) <= 6 / mppAcross))
  rows.push({
    id: spec.id,
    role: spec.role,
    row: spec.row,
    frameId: d.frameId,
    decompositionId: d.decompositionId,
    decompositionKey: d.key,
    storey: spec.row === 'fixtures' ? 'SYNTHETIC' : 'GROUND',
    facade: { side: spec.side, axis: spec.axis, linePx: facade?.px ?? spec.line, spanPx: [spec.from, spec.to], inward: spec.inward < 0 ? 'toward smaller coordinates' : 'toward larger coordinates' },
    wallThickness: { px: W, m: r3(W * Math.max(d.mpp.x, d.mpp.y)) },
    mpp: d.mpp,
    extentBeforeBoundaryWork: d.extent,
    envelope: d.envelope,
    collinearWallPieces: { bands: bandPieces, ink: inkPieces },
    facadeGaps: (facade?.gaps ?? []).filter((g) => inSpan(g.from, g.to)).map((g) => ({ id: g.id, from: g.from, to: g.to, widthM: g.w, jambs: g.jambs, signature: g.sig, cls: g.cls, boundary: g.b, callout: g.callout })),
    perpendicularCandidates: { bands: perpBands, ink: perpInk },
    shortPiers: inkPieces.filter((p) => p.from > spec.from + W && p.to < spec.to - W && p.lengthM < 1.5).map((p) => ({ ...p, wallVsPost: p.kind })),
    setbackBackWallCandidates: setback,
    existingWideGaps: wide.map((w) => ({ kind: w.kind, linePx: w.linePx, fromPx: w.fromPx, toPx: w.toPx, widthM: w.widthM, infill: w.evidence.infill, callout: w.evidence.callout ?? null, pocketM2: w.evidence.pocketM2 ?? null, decision: w.decision })),
    existingBays: d.bays,
    cellsNearFacade: cellsNear.map((c) => ({ ix: c[0], iy: c[1], cls: c[2], rect: [c[3], c[4], c[5], c[6]] })),
    recessCells: cellsNear.filter((c) => c[2] === 'R').length,
    builtCells: cellsNear.filter((c) => c[2] === 'B').length,
    regions: d.regions,
    gridLines: { x: d.linesX.map((l) => l[0]), y: d.linesY.map((l) => l[0]) },
    bodies: d.boundary?.bodies?.map((b, i) => ({ id: `body-${i}`, relation: b.relation, enclosed: b.enclosed, built: b.built, areaM2: b.areaM2, rect: b.rect, mouth: b.mouth ?? null })) ?? [],
    boundaryAccepted: d.boundary?.accepted ?? null,
    basePlanConsequence: spec.row === 'fixtures' ? null : outcomeOf(spec.row),
  })
}
writeFileSync(out, JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005N', part: 'A', startingHead: '5957e3af3e33615efba75b14fd3da004dc814954', method: 'decomposition traces at the starting code (research/analyzer-005n/trace-decompositions.mjs, fixture-trace.ts); development rows replayed solver-alone on their sealed package, graph and metric evidence', facades: rows }, null, 1) + '\n')
process.stdout.write(`${rows.length} facades -> ${out}\n`)
