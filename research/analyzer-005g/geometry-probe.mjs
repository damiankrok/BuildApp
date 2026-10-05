/**
 * BUILDPLAN-ANALYZER-005G — low-level 2D geometry library probe (research only).
 *
 * Inputs (all derived, no publisher pixel):
 *   A. wall footprints of committed canonical models (each wall's centreline rectangle, extended by half its
 *      thickness at both ends, per level) — the shapes the geometry compiler and WALLS_OVERLAP reason about;
 *   B. the BUILT layout regions of every committed Evidence Pack (`14-selected-layout.json`, rectangles in px) —
 *      the boundary candidates the envelope stage chose;
 *   C. adversarial cases: shared edges, collinear overlaps, near-coincident vertices (1e-9 … 1e-12), slivers,
 *      a T-junction pile-up, and a self-touching ring.
 * Libraries: polygon-clipping 0.15.7, polyclip-ts 0.16.8 (its maintained fork), Clipper2 via clipper2-js 1.2.4
 * (integer coordinates, scale 1e6), JSTS 2.12.1 (the JTS port, used as the oracle).
 * Measured: union area / polygon / hole counts against the oracle, failures (throws), determinism (input order
 * reversed), wall time; the output hash is printed so a run on Node 18 and one on Node 22 can be compared.
 *
 *   node geometry-probe.mjs --out result.json
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import polygonClipping from 'polygon-clipping'
import * as polyclip from 'polyclip-ts'
import { Clipper, FillRule, JoinType, EndType, Paths64 } from 'clipper2-js'
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js'
import Coordinate from 'jsts/org/locationtech/jts/geom/Coordinate.js'
import UnaryUnionOp from 'jsts/org/locationtech/jts/operation/union/UnaryUnionOp.js'
import BufferOp from 'jsts/org/locationtech/jts/operation/buffer/BufferOp.js'
import BufferParameters from 'jsts/org/locationtech/jts/operation/buffer/BufferParameters.js'
import ArrayList from 'jsts/java/util/ArrayList.js'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const ROOT = arg('root', '/home/user/BuildApp')

// ---------- inputs ----------
const cases = []
const modelFiles = [
  'stage-reports/artifacts/analyzer-v2/marcowki-model.json',
  'stage-reports/artifacts/building-model.json',
  'stage-reports/artifacts/integration-004a/kosacce/model.json',
  'stage-reports/artifacts/analyzer-005c/holdout/h1-dom-w-azaliach/model.json',
  'stage-reports/artifacts/analyzer-005d/holdout/h2-dom-w-tunbergiach/model.json',
  'stage-reports/artifacts/analyzer-005e/holdout/h2-dom-w-morelach/model.json',
  'stage-reports/artifacts/analyzer-005f/holdout/h2-dom-w-helikoniach/model.json',
]
for (const f of modelFiles) {
  const p = join(ROOT, f)
  if (!existsSync(p)) continue
  const m = JSON.parse(readFileSync(p, 'utf8'))
  for (const lvl of m.levels ?? []) {
    const walls = (m.walls ?? []).filter((w) => w.levelId === lvl.id)
    if (walls.length < 2) continue
    const rings = walls.map((w) => {
      const dx = w.end.x - w.start.x
      const dz = w.end.z - w.start.z
      const L = Math.hypot(dx, dz)
      const ux = dx / L
      const uz = dz / L
      const h = w.thickness / 2
      const a = [w.start.x - ux * h, w.start.z - uz * h]
      const b = [w.end.x + ux * h, w.end.z + uz * h]
      return [
        [a[0] - uz * h, a[1] + ux * h],
        [b[0] - uz * h, b[1] + ux * h],
        [b[0] + uz * h, b[1] - ux * h],
        [a[0] + uz * h, a[1] - ux * h],
      ]
    })
    const axes = walls.map((w) => ({ a: [w.start.x, w.start.z], b: [w.end.x, w.end.z], t: w.thickness }))
    cases.push({ id: `walls:${f.split('/').slice(-2).join('/')}:${lvl.id}`, kind: 'MODEL_WALLS', unit: 'm', rings, axes })
  }
}
for (const stage of ['analyzer-005d', 'analyzer-005e', 'analyzer-005f']) {
  const dir = join(ROOT, 'stage-reports/artifacts', stage, 'evidence')
  if (!existsSync(dir)) continue
  for (const run of readdirSync(dir)) {
    const p = join(dir, run, '14-selected-layout.json')
    if (!existsSync(p)) continue
    const lay = JSON.parse(readFileSync(p, 'utf8'))
    const rects = (lay.regions ?? []).filter((r) => r.cls === 'BUILT').map((r) => r.rect)
    if (rects.length < 2) continue
    cases.push({ id: `layout:${stage}/${run}`, kind: 'LAYOUT_REGIONS', unit: 'px', rings: rects.map((r) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]) })
  }
}
const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
cases.push(
  { id: 'adv:shared-edge', kind: 'ADVERSARIAL', unit: 'm', rings: [sq(0, 0, 5, 4), sq(5, 0, 9, 4)] },
  { id: 'adv:collinear-overlap', kind: 'ADVERSARIAL', unit: 'm', rings: [sq(0, 0, 5, 4), sq(3, 4, 8, 6), sq(2, 0, 6, 4)] },
  { id: 'adv:near-coincident-1e-9', kind: 'ADVERSARIAL', unit: 'm', rings: [sq(0, 0, 5, 4), sq(5 + 1e-9, 0, 9, 4), sq(0, 4 - 1e-9, 9, 6)] },
  { id: 'adv:near-coincident-1e-12', kind: 'ADVERSARIAL', unit: 'm', rings: [sq(0, 0, 5, 4), sq(5 - 1e-12, 1e-12, 9, 4), sq(1e-12, 4, 9 + 1e-12, 6)] },
  { id: 'adv:sliver', kind: 'ADVERSARIAL', unit: 'm', rings: [sq(0, 0, 10, 8), [[0, 8], [10, 8], [10, 8.000001], [0, 8.0000005]]] },
  { id: 'adv:t-junction-pile', kind: 'ADVERSARIAL', unit: 'm', rings: Array.from({ length: 24 }, (_, i) => sq(i * 0.4, 0, i * 0.4 + 0.42, 6 + (i % 3) * 0.1 / 3)) },
  { id: 'adv:self-touching-ring', kind: 'ADVERSARIAL', unit: 'm', rings: [[[0, 0], [6, 0], [6, 6], [3, 6], [3, 3], [3, 6], [0, 6]], sq(2, 2, 4, 4)] },
  { id: 'adv:rotated-walls', kind: 'ADVERSARIAL', unit: 'm', rings: Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; const c = Math.cos(a); const s = Math.sin(a); return [[0, 0], [5 * c, 5 * s], [5 * c - 0.3 * s, 5 * s + 0.3 * c], [-0.3 * s, 0.3 * c]] }) },
)

// ---------- engines ----------
const shoelace = (r) => r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2
const close = (r) => (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r : [...r, r[0]])
const open = (r) => (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r)
/** Normalised result: polygons [outer, ...holes], each ring open; area = Σ|outer| − Σ|holes|. */
const summary = (polys) => {
  const area = polys.reduce((a, p) => a + Math.abs(shoelace(open(p[0]))) - p.slice(1).reduce((b, h) => b + Math.abs(shoelace(open(h))), 0), 0)
  const canon = polys
    .map((p) => p.map((r) => open(r).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6])))
    .map((p) => p.map((r) => { const k = r.reduce((bi, q, i) => (q[0] < r[bi][0] || (q[0] === r[bi][0] && q[1] < r[bi][1]) ? i : bi), 0); const rr = [...r.slice(k), ...r.slice(0, k)]; return shoelace(rr) < 0 ? [rr[0], ...rr.slice(1).reverse()] : rr }))
    .map((p) => [p[0], ...p.slice(1).sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1])])
    .sort((a, b) => a[0][0][0] - b[0][0][0] || a[0][0][1] - b[0][0][1])
  return { area, polygons: polys.length, holes: polys.reduce((a, p) => a + p.length - 1, 0), hash: createHash('sha256').update(JSON.stringify(canon)).digest('hex').slice(0, 16) }
}
const engines = {
  'polygon-clipping': (rings) => polygonClipping.union(...rings.map((r) => [[close(r)]])),
  'polyclip-ts': (rings) => polyclip.union(...rings.map((r) => [[close(r)]])),
  clipper2: (rings) => {
    const S = 1e6
    const paths = new Paths64()
    for (const r of rings) paths.push(Clipper.makePath(r.flatMap(([x, y]) => [Math.round(x * S), Math.round(y * S)])))
    const out = Clipper.Union(paths, undefined, FillRule.NonZero)
    // Paths64: outers positive, holes negative; assign each hole to the smallest outer containing its first point.
    const rs = out.map((p) => p.map((q) => [q.x / S, q.y / S]))
    const outers = rs.filter((r) => shoelace(r) > 0).map((r) => [r])
    const inside = (pt, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c }
    for (const h of rs.filter((r) => shoelace(r) < 0)) {
      const host = outers.filter((o) => inside(h[0], o[0])).sort((a, b) => Math.abs(shoelace(a[0])) - Math.abs(shoelace(b[0])))[0]
      if (host) host.push(h)
    }
    return outers
  },
  'jsts (oracle)': (rings) => {
    const gf = new GeometryFactory()
    const list = new ArrayList()
    for (const r of rings) list.add(gf.createPolygon(gf.createLinearRing(close(r).map(([x, y]) => new Coordinate(x, y)))))
    const g = UnaryUnionOp.union(list)
    const polys = []
    for (let i = 0; i < g.getNumGeometries(); i += 1) {
      const p = g.getGeometryN(i)
      if (p.getGeometryType() !== 'Polygon') continue
      const ring = (lr) => lr.getCoordinates().map((c) => [c.x, c.y])
      polys.push([ring(p.getExteriorRing()), ...Array.from({ length: p.getNumInteriorRing() }, (_, k) => ring(p.getInteriorRingN(k)))])
    }
    return polys
  },
}

const results = []
for (const c of cases) {
  const row = { id: c.id, kind: c.kind, unit: c.unit, inputs: c.rings.length, engines: {} }
  for (const [name, fn] of Object.entries(engines)) {
    try {
      const t0 = performance.now()
      const a = summary(fn(c.rings))
      const ms = performance.now() - t0
      const b = summary(fn([...c.rings].reverse()))
      row.engines[name] = { ...a, ms: +ms.toFixed(2), orderInvariantArea: Math.abs(a.area - b.area) <= 1e-9 * Math.max(1, a.area), orderInvariantShape: a.hash === b.hash }
    } catch (e) {
      row.engines[name] = { error: String(e?.message ?? e).slice(0, 160) }
    }
  }
  const oracle = row.engines['jsts (oracle)']
  for (const [name, r] of Object.entries(row.engines)) if (!r.error && oracle && !oracle.error) r.relAreaVsOracle = +((r.area - oracle.area) / Math.max(1e-12, oracle.area)).toExponential(2)
  results.push(row)
}

// Offsetting: a wall plan from its axes (each axis inflated by half its thickness, square ends) — Clipper2 against
// JSTS buffer (flat caps, mitre joins), against the per-wall rectangles' union.
const offsets = []
for (const c of cases.filter((x) => x.axes)) {
  const S = 1e6
  try {
    const t0 = performance.now()
    const parts = new Paths64()
    for (const ax of c.axes) {
      // Clipper2 semantics: for an OPEN path `delta` is the full stroke width (it is halved internally), so a wall of
      // thickness t is inflated by t, not t/2 — a trap that halves every area when missed (it was, in this probe's
      // first run; recorded in geometry-library-audit.md).
      const p = Clipper.InflatePaths(new Paths64(Clipper.makePath([Math.round(ax.a[0] * S), Math.round(ax.a[1] * S), Math.round(ax.b[0] * S), Math.round(ax.b[1] * S)])), ax.t * S, JoinType.Miter, EndType.Square)
      for (const q of p) parts.push(q)
    }
    const u = Clipper.Union(parts, undefined, FillRule.NonZero)
    const clipArea = u.reduce((a, p) => a + shoelace(p.map((q) => [q.x / S, q.y / S])), 0)
    const ms = performance.now() - t0
    const gf = new GeometryFactory()
    const list = new ArrayList()
    const bp = new BufferParameters()
    bp.setEndCapStyle(BufferParameters.CAP_SQUARE)
    bp.setJoinStyle(BufferParameters.JOIN_MITRE)
    for (const ax of c.axes) list.add(BufferOp.bufferOp(gf.createLineString([new Coordinate(ax.a[0], ax.a[1]), new Coordinate(ax.b[0], ax.b[1])]), ax.t / 2, bp))
    const j = UnaryUnionOp.union(list).getArea()
    offsets.push({ id: c.id, clipper2InflateUnionM2: +clipArea.toFixed(6), jstsBufferUnionM2: +j.toFixed(6), rectUnionM2: +results.find((r) => r.id === c.id).engines['jsts (oracle)'].area.toFixed(6), clipperMs: +ms.toFixed(1) })
  } catch (e) {
    offsets.push({ id: c.id, error: String(e?.message ?? e).slice(0, 160) })
  }
}

const out = { node: process.version, libraries: { 'polygon-clipping': '0.15.7', 'polyclip-ts': '0.16.8', 'clipper2-js': '1.2.4', jsts: '2.12.1' }, cases: results.length, results, offsets }
const json = JSON.stringify(out, null, 1)
if (arg('out')) writeFileSync(arg('out'), json)
const failures = {}
const misses = {}
for (const r of results)
  for (const [n, e] of Object.entries(r.engines)) {
    if (e.error) failures[n] = (failures[n] ?? 0) + 1
    else if (Math.abs(Number(e.relAreaVsOracle ?? 0)) > 1e-6) misses[n] = (misses[n] ?? 0) + 1
  }
const resultHash = createHash('sha256').update(JSON.stringify(results.map((r) => ({ id: r.id, e: Object.fromEntries(Object.entries(r.engines).map(([k, v]) => [k, v.error ?? v.hash])) })))).digest('hex')
console.log(JSON.stringify({ node: process.version, cases: results.length, failures, areaMismatchVsOracle: misses, shapeHashOfAllResults: resultHash }))
