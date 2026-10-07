#!/usr/bin/env node
/**
 * storey-registration.mjs — BUILDPLAN-ANALYZER-005L §28 storey diagnostic artifact (RESEARCH ONLY).
 *
 *   node research/analyzer-005l/storey-registration.mjs --trace <storey-trace json> --runs <dev run dir> --out <json>
 *
 * For every development row with more than one storey's plan: the plans by role, the chosen base, and for each other
 * storey the registration (candidate count, the chosen placement, the rival and its margin), its walled regions and
 * their support relations, the decision; every mass's storey span; the layout gate's reasons; and from the emitted
 * model of the same code (`dev-matrix.mjs run`), each level's wall rings and slab area. Numbers and ids only.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const trace = JSON.parse(readFileSync(resolve(arg('trace', '/home/user/work005l/trace-new.json')), 'utf8'))
const runs = resolve(arg('runs', '/home/user/work005l/dev/NEW'))
const r3 = (v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v)
const box = (b) => (b ? [b.x0, b.z0, b.x1, b.z1].map(r3) : null)
const ringArea = (poly) => {
  let a = 0
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.z - q.x * p.z
  }
  return Math.abs(a) / 2
}

function emitted(row) {
  const dir = join(runs, row)
  if (!existsSync(join(dir, 'model.json'))) {
    const failure = existsSync(join(dir, 'failure.json')) ? JSON.parse(readFileSync(join(dir, 'failure.json'), 'utf8')) : null
    return { outcome: failure ? `REFUSED:${failure.reasonCode ?? failure.code ?? failure.reason ?? 'UNKNOWN'}` : 'NO_RUN', levels: [] }
  }
  const model = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8'))
  const walls = new Map(model.walls.map((w) => [w.id, w]))
  const levels = [...model.levels].sort((a, b) => a.index - b.index).map((l) => {
    const rings = model.wallRings
      .filter((r) => r.levelId === l.id)
      .map((r) => r.wallIds.map((id) => walls.get(id)).filter(Boolean))
      .filter((ws) => ws.length > 0)
      .map((ws) => {
        const xs = ws.flatMap((w) => [w.start.x, w.end.x])
        const zs = ws.flatMap((w) => [w.start.z, w.end.z])
        const b = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]
        return { box: b.map(r3), areaM2: r3((b[2] - b[0]) * (b[3] - b[1])) }
      })
      .sort((a, b) => a.box[0] - b.box[0] || a.box[1] - b.box[1])
    return { index: l.index, rings, ringAreaM2: r3(rings.reduce((a, r) => a + r.areaM2, 0)), slabAreaM2: r3(model.slabs.filter((s) => s.levelId === l.id).reduce((a, s) => a + ringArea(s.polygon), 0)) }
  })
  return { outcome: 'COMPLETED', levels }
}

const rows = []
for (const t of Array.isArray(trace) ? trace : trace.rows) {
  const storeysDrawn = new Set(t.planFrames.map((f) => f.storey).filter((s) => s && s !== 'UNKNOWN'))
  if (storeysDrawn.size < 2) continue
  rows.push({
    row: t.row,
    plansByRole: t.planFrames.map((f) => ({ frameId: f.id, storey: f.storey, annotation: f.annotation ?? null })),
    plansRead: t.plansRead,
    base: t.base,
    storeys: t.storeys.map((s) => ({ id: s.id, index: s.index, frameIds: s.frameIds, footprintRegionIds: s.footprintRegionIds })),
    registrations: (t.storeyRegistrations ?? []).map((r) => ({
      frameId: r.frameId,
      storeyIndex: r.storeyIndex,
      declaredRole: r.declaredRole,
      candidates: r.candidates,
      chosen: r.chosen ? { ...r.chosen, scale: r3(r.chosen.scale), offsetX: r3(r.chosen.offsetX), offsetY: r3(r.chosen.offsetY) } : null,
      rival: r.rival ? { ...r.rival, scale: r3(r.rival.scale), offsetX: r3(r.rival.offsetX), offsetY: r3(r.rival.offsetY) } : null,
      margin: r.margin ?? null,
      // how finely the walls tell placements apart (a margin at or below it is a tie), what the scale rests on, the
      // printed scale where it was weighed against a fit, and a reading held against a better fit (005L council)
      resolution: r.resolution ?? null,
      scaleBasis: r.scaleBasis ?? null,
      printedScale: r.printedScale ?? null,
      held: r.held ? { by: r.held.by, standsElsewhere: r.held.standsElsewhere, over: { ...r.held.over, scale: r3(r.held.over.scale), offsetX: r3(r.held.over.offsetX), offsetY: r3(r.held.over.offsetY) } } : null,
      decision: r.decision,
      regions: r.regions.map((g) => ({ regionId: g.regionId, boundsM: box(g.bounds), areaM2: r3(g.areaM2), wallFraction: r3(g.wallFraction), storeyWallFraction: r3(g.storeyWallFraction ?? null), body: g.body, overhang: g.overhang, unsupportedM2: r3(g.unsupportedM2) })),
      relations: r.relations.map((x) => ({ upperRegionId: x.upperRegionId, lowerMassId: x.lowerMassId, status: x.supportStatus, overlapM: [r3(x.overlapM.x), r3(x.overlapM.z)], intersectionM2: r3(x.intersectionM2), upperSupportedShare: r3(x.upperSupportedShare), lowerCoveredShare: r3(x.lowerCoveredShare), wallAgreement: r3(x.wallAgreement) })),
      why: r.why,
    })),
    masses: t.masses.map((m) => ({ id: m.id, role: m.role, boxM: box(m.ring), areaM2: r3(m.areaM2), storeys: [m.storeySpan.fromIndex, m.storeySpan.toIndex] })),
    upperFootprints: t.upperFootprints.map((f) => ({ id: f.id, storeyId: f.storeyId, boxM: box(f.ring), areaM2: r3(f.areaM2) })),
    storeyUnresolved: t.storeyUnresolved.map((u) => `${u.status}: ${u.what}`),
    storeyConflicts: t.storeyConflicts.map((c) => c.what),
    gate: t.gate,
    emitted: emitted(t.row),
  })
}
writeFileSync(resolve(arg('out', 'storey-registration.json')), `${JSON.stringify({ stage: 'BUILDPLAN-ANALYZER-005L', what: 'every development row with plans of more than one storey: registration, walled regions, support relations, storey spans, the layout gate, and the emitted levels of the same code (numbers and ids only)', rows }, null, 1)}\n`)
process.stdout.write(`${rows.length} multi-storey rows\n`)
