/**
 * N7-COUNCIL reviewer C (plan / structural layout). RESEARCH ONLY, read-only on production code.
 *
 *   npx vite-node research/analyzer-n7-council/C/probe-layout.ts [-- --only NAME]
 *
 * Invented SyntheticHouse variants (wings, two wings, upper insets, recesses) taken SOURCE -> LAYOUT -> MassV2
 * (storeyRects / pieces) -> program -> validator -> model through the production `runAnalysis`. For each it prints
 * the layout masses, the v2 masses with each storey's rectangle (rectAt), which of them `thinBodies` looked at, the
 * thin-body decisions, the preview outcome and the first refusal. Flags: ring narrower than 2T on some storey,
 * phantom body, lost body, wrong storey count.
 */
import { memoryByteCache } from '@buildapp/source-package'
import { HOLLOWAY, REDMIRE, SLIVERTON, SLIVERTON_DIMENSIONED, THINWALL, LARCHFIELD, V2_FIXTURES, syntheticPublisher } from '@buildapp/synthetic-drawings'
import type { SyntheticHouse } from '@buildapp/synthetic-drawings'
import { rectAt, thinBodies } from '../../../packages/reconstruction/src/v2/index.js'
import { runAnalysis } from '../../../packages/analysis-service/src/index.js'

type Case = { code: string; house: SyntheticHouse; expect: { bodies?: number; note: string } }

const cases: Case[] = [
  { code: 'c-holloway', house: HOLLOWAY, expect: { bodies: 2, note: 'baseline: house + garage' } },
  { code: 'c-sliverton', house: SLIVERTON, expect: { bodies: 2, note: 'baseline sliver, KEEP_PARTIAL expected' } },
  { code: 'c-sliverton-d', house: SLIVERTON_DIMENSIONED, expect: { bodies: 2, note: 'baseline sliver SHARED_WALL' } },
  { code: 'c-thinwall', house: THINWALL, expect: { bodies: 2, note: 'baseline DRAWN_THIN_WALLS' } },
  { code: 'c-redmire', house: REDMIRE, expect: { bodies: 1, note: 'loggia recess + stepped upper' } },
  { code: 'c-larchfield', house: LARCHFIELD, expect: { bodies: 1, note: 'single body' } },
  // two wings, both sound
  {
    code: 'c-twowing',
    house: { ...HOLLOWAY, name: 'Twowing', depth: 12.0, chainsZ: [3.0, 4.0, 1.0, 4.0], chainsX: [8.4, 3.6], wings: [
      { name: 'store', width: 3.6, depth: 3.0, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [] },
      { name: 'garage', width: 3.6, depth: 4.0, offsetZ: 8.0, storeys: 1, roof: 'FLAT', openings: [{ side: 'FRONT', kind: 'DOOR', at: 0.6, width: 2.4, height: 2.1, sill: 0, storey: 0 }] },
    ] },
    expect: { bodies: 3, note: 'two sound wings, separated by 1 m' },
  },
  // the SECOND wing a sliver (attached-1 thin), first wing sound
  {
    code: 'c-twowing-sliver2',
    house: { ...HOLLOWAY, name: 'Twowing sliver2', depth: 12.0, chainsZ: [3.0, 4.0, 1.0, 4.0], chainsX: [8.4, 3.6], wings: [
      { name: 'store', width: 3.6, depth: 3.0, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [] },
      { name: 'sliver', width: 0.45, depth: 4.0, offsetZ: 8.0, storeys: 1, roof: 'FLAT', openings: [] },
    ] },
    expect: { bodies: 3, note: 'attached-1 a 0.45 m sliver' },
  },
  // the sliver printed as drawn (8.40 + 0.45 + ...), second wing
  {
    code: 'c-twowing-sliver2-d',
    house: { ...HOLLOWAY, name: 'Twowing sliver2 dim', depth: 12.0, chainsZ: [3.0, 4.0, 1.0, 4.0], chainsX: [8.4, 3.6], wings: [
      { name: 'store', width: 3.6, depth: 3.0, offsetZ: 0, storeys: 1, roof: 'FLAT', openings: [] },
      { name: 'sliver', width: 0.45, depth: 4.0, offsetZ: 8.0, storeys: 1, roof: 'FLAT', openings: [], ownWallThickness: 0.12 },
    ] },
    expect: { bodies: 3, note: 'attached-1 a sliver with its own thin walls' },
  },
  // two-storey wing beside a one-storey garage: the upper storey stands on main + the 2-storey wing only
  {
    code: 'c-wing2storey',
    house: { ...HOLLOWAY, name: 'Wing2storey', depth: 12.0, chainsZ: [5.0, 1.0, 6.0], chainsX: [8.4, 3.6], upperChainsX: [8.4, 3.6], upperChainsZ: [5.0, 7.0], wings: [
      { name: 'wing', width: 3.6, depth: 5.0, offsetZ: 0, storeys: 2, roof: 'FLAT', openings: [] },
      { name: 'garage', width: 3.6, depth: 6.0, offsetZ: 6.0, storeys: 1, roof: 'FLAT', openings: [] },
    ] },
    expect: { bodies: 3, note: 'wing 2 storeys, garage 1' },
  },
  // main with an upper inset on the east (wing side): the upper storey stands on part of main
  {
    code: 'c-inset-east',
    house: { ...HOLLOWAY, name: 'Inset east', upperInset: { maxX: 2.4 }, upperChainsX: [6.0], upperChainsZ: [4.2, 6.0] },
    expect: { bodies: 2, note: 'upper inset 2.4 m on east: storeyRects on main' },
  },
  // upper inset that leaves a 0.9 m strip — narrower than a room — over main
  {
    code: 'c-inset-deep',
    house: { ...HOLLOWAY, name: 'Inset deep', upperInset: { maxX: 7.5 }, upperChainsX: [0.9], upperChainsZ: [4.2, 6.0] },
    expect: { bodies: 2, note: 'upper storey a 0.9 m strip over main' },
  },
  // a sliver wing two storeys high
  {
    code: 'c-sliver-2storey',
    house: { ...SLIVERTON, name: 'Sliver 2 storey', wings: [{ name: 'sliver', width: 0.45, depth: 6.0, offsetZ: 4.2, storeys: 2, roof: 'FLAT', openings: [] }] },
    expect: { bodies: 2, note: 'sliver reaching storey 1' },
  },
  // a narrow-in-depth (Z) wing: w0/w2 collide
  {
    code: 'c-sliver-z',
    house: { ...HOLLOWAY, name: 'Sliver z', wings: [{ name: 'sliverz', width: 3.6, depth: 0.45, offsetZ: 4.2, storeys: 1, roof: 'FLAT', openings: [] }] },
    expect: { bodies: 2, note: 'wing 0.45 m deep' },
  },
  // a recess cut into the front of a house with a garage
  {
    code: 'c-recess-garage',
    house: { ...HOLLOWAY, name: 'Recess garage', recesses: [{ side: 'FRONT', at: 3.0, width: 2.4, depth: 1.5, storey: 0 }] },
    expect: { bodies: 2, note: 'front loggia + garage' },
  },
  // a recess cut into the side the wing stands on
  {
    code: 'c-recess-right',
    house: { ...HOLLOWAY, name: 'Recess right', recesses: [{ side: 'RIGHT', at: 1.0, width: 2.4, depth: 1.2, storey: 0 }] },
    expect: { bodies: 2, note: 'recess on the wing side, outside the wing' },
  },
]

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined
const chosen = cases.filter((c) => !only || c.code === only)
const publisher = syntheticPublisher({ projects: chosen.map((c) => ({ code: c.code, title: c.house.name, house: c.house })) })
const f = (n: number): string => n.toFixed(2)
const findings: string[] = []
for (const c of chosen) {
  console.log(`\n=== ${c.code}: ${c.expect.note}`)
  let out
  try {
    out = await runAnalysis({ kind: 'URL', url: publisher.pageUrl(c.code) }, { adapters: [publisher.adapter], deps: publisher.deps, cache: memoryByteCache(), now: () => new Date('2026-01-01T00:00:00Z') })
  } catch (e) {
    console.log(`  RUN FAILED: ${(e as Error).message.slice(0, 300)}`)
    findings.push(`${c.code}: run failed`)
    continue
  }
  const { result, reconstruction: r } = out
  const T = r.building.wallThicknessM
  console.log(`  T=${T} layout masses: ${r.layout.masses.map((m) => `${m.id}/${m.role} ${f(m.widthM.value)}x${f(m.depthM.value)} s${m.storeySpan.fromIndex}..${m.storeySpan.toIndex} regs[${m.footprintRegionIds.join(',')}]`).join(' | ')}`)
  console.log(`  storeys: ${r.layout.storeys.map((s) => `${s.id}(${s.index}) frames ${s.frameIds.length}`).join(', ')}; recesses ${r.layout.recesses.length}; zones ${r.layout.footprintRegions.filter((x) => x.kind === 'ZONE').map((x) => x.id).join(',')}`)
  const checked = new Set(thinBodies(r.building.masses, T).map((x) => x.mass.id))
  for (const m of r.building.masses) {
    const per = m.storeys.map((s) => {
      const q = rectAt(m, s)
      const w = q.x1 - q.x0
      const d = q.z1 - q.z0
      const bad = Math.min(w, d) < 2 * (m.wallThicknessM ?? T) - 1e-6
      if (bad && m.openSide === undefined) findings.push(`${c.code}: ${m.id} storey ${s} rect ${f(w)}x${f(d)} < 2T (${m.storeyRects ? 'has storeyRects' : m.pieceOf ? 'piece' : 'plain'}; thinBodies ${checked.has(m.id) ? 'saw it' : 'skipped it'})`)
      return `s${s}:${f(q.x0)}..${f(q.x1)}x${f(q.z0)}..${f(q.z1)}(${f(w)}x${f(d)})${bad ? '!THIN' : ''}`
    })
    console.log(`  v2 ${m.id} ${m.role}${m.pieceOf ? ` pieceOf ${m.pieceOf}` : ''}${m.storeyRects ? ' storeyRects' : ''}${m.openSide ? ` open ${m.openSide}` : ''}${m.wallThicknessM ? ` t=${m.wallThicknessM}` : ''}${m.outerFacesOpen ? ' outerFacesOpen' : ''}: ${per.join(' ')}`)
  }
  for (const t of r.thinBodies) console.log(`  thinBody ${t.massId} ${t.narrowAxis} ${f(t.narrowM)} -> ${t.decision.kind}: ${t.decision.why.slice(0, 160)}`)
  const bodies = r.building.masses.filter((m) => !m.pieceOf).length
  if (c.expect.bodies !== undefined && bodies !== c.expect.bodies) findings.push(`${c.code}: ${bodies} bodies, expected ${c.expect.bodies}`)
  console.log(`  preview ${result.preview.outcome}${result.preview.partial ? ` failure ${JSON.stringify(result.preview.partial.failure).slice(0, 260)}` : ''}`)
  console.log(`  rings ${result.model.wallRings.map((x) => x.id).join(',')}; slabs ${result.model.slabs.length}; walls ${result.model.walls.length}`)
  for (const u of r.unresolved.filter((u) => /storey|body|strip|sliver|support|overhang/i.test(u.what)).slice(0, 6)) console.log(`  gap: ${u.what.slice(0, 120)} — ${u.reason.slice(0, 140)}`)
}
console.log(`\nFLAGS (${findings.length}):\n${findings.map((x) => `  - ${x}`).join('\n')}`)
void V2_FIXTURES
