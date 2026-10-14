#!/usr/bin/env node
/**
 * mutations.mjs — BUILDPLAN-ANALYZER-005Q mutation gates over the adopted N1a rule (RESEARCH ONLY; no mutation is ever
 * committed).
 *
 *   node research/analyzer-005q/mutations.mjs [--only M01,M02] [--log <dir outside the repository>]
 *
 * 005N/005P's method, run on a working tree that carries the adopted change uncommitted: each mutation is a temporary
 * patch applied in place to one production file; the 005Q wall-strip suites run; the file is written back byte for
 * byte from the copy read before the patch, its sha-256 is checked, and `git diff --stat -- packages` must equal the
 * pre-run state before the next mutation (so the adopted change is neither lost nor altered). A mutation is KILLED when
 * a behavioural assertion (`packages/reconstruction/test/...`, the solver's output on a made-up plan) fails; one that
 * only a source-shape gate (`tests/architecture/...`) notices is recorded KILLED_ARCHITECTURE_ONLY — a weaker kill, kept
 * apart; a type or import error alone is SUITE_ERROR, not a kill. Each mutation is a plausible wrong implementation of
 * the rule, not a syntax break. M24-M31 (review round 1) undo each of the four fixes (F1 the overlap with the stretches
 * the wall ink covers, F2 the depth bound, F3 the per-axis scale of the gap's depth, F4 the platform named beyond a
 * wall strip) or make them the plausible wrong way; family 15 of wall-strip.test.ts is the suite written for them.
 * M32-M41 (review round 2): the F4 platform probe's span and skip (family 16), two orientation-dependent wrong rules the
 * unit-level G10 test exists to catch (wall-strip-unit.test.ts), and F1's merge and axis (family 15's overlap bound,
 * strengthened).
 *
 * Results: stage-reports/artifacts/analyzer-005q/mutation-results.json (failing assertion titles only: no pixel, no
 * path outside the repository, no house).
 */
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')
const arg = (name) => (process.argv.indexOf(name) >= 0 ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const logDir = resolve(arg('--log') ?? '/home/user/work005q/mutations')
if (logDir.startsWith(REPO)) throw new Error('mutation logs stay outside the repository')
mkdirSync(logDir, { recursive: true })
const RESULTS = join(REPO, 'stage-reports/artifacts/analyzer-005q/mutation-results.json')

const LAYOUT = 'packages/reconstruction/src/layout.ts'
const V2 = 'packages/reconstruction/src/v2/reconstruct-v2.ts'
const EMIT = 'packages/reconstruction/src/v2/emit.ts'
const BEHAVIOUR = ['packages/reconstruction/test/wall-strip.test.ts', 'packages/reconstruction/test/wall-strip-invariance.test.ts', 'packages/reconstruction/test/wall-strip-unit.test.ts']
const ARCHITECTURE = ['tests/architecture/wall-strip.test.ts']
const SUITES = [...BEHAVIOUR, ...ARCHITECTURE]

const MUTATIONS = [
  {
    id: 'M01',
    what: 'the gap is never named: the strip is detected but its outer face is not pushed to unresolved (so nothing downstream sees it)',
    file: LAYOUT,
    from: '  for (const w of wallStrips) unresolved.push(w.gap)',
    to: '  for (const w of wallStrips) void w.gap',
  },
  {
    id: 'M02',
    what: 'v2 still reads a recess, returns and a terrace floor in a wall strip (the isWallStripZone filter removed)',
    file: V2,
    from: "  const zoneRegions = layout.footprintRegions.filter((r) => r.kind === 'ZONE' && !isWallStripZone(r.id, layout.unresolved))",
    to: "  const zoneRegions = layout.footprintRegions.filter((r) => r.kind === 'ZONE')",
  },
  {
    id: 'M03',
    what: 'the ring of a body cut on a wall’s inner face is still emitted SOURCE_EXACT (the open-face branch keeps the exact status)',
    file: EMIT,
    from: "    if (m.outerFacesOpen && m.outerFacesOpen.length > 0) evidence(`ring-${m.id}-${measuredOn}`, 'SOURCE_DERIVED',",
    to: "    if (m.outerFacesOpen && m.outerFacesOpen.length > 0) evidence(`ring-${m.id}-${measuredOn}`, 'SOURCE_EXACT',",
  },
  {
    id: 'M04',
    what: 'the MASS feature stays SOURCE_EXACT (printed) when a face is open: exactness read from the width basis alone',
    file: V2,
    from: "    const exact = m.widthM.basis === 'MEASURED' && facesOpen.length === 0",
    to: "    const exact = m.widthM.basis === 'MEASURED'",
  },
  {
    id: 'M05',
    what: 'cover bound 0.25 -> 0: every strip between the envelope and the extent is read as a wall, with or without wall-thick ink in it',
    file: LAYOUT,
    from: 'export const WALL_STRIP_BOUNDS = { cover: 0.25 } as const',
    to: 'export const WALL_STRIP_BOUNDS = { cover: 0 } as const',
  },
  {
    id: 'M06',
    what: 'any touching band is enough: a strip fires on any non-zero cover (a pier, a niche wall)',
    file: LAYOUT,
    from: '    if (cover < WALL_STRIP_BOUNDS.cover) continue',
    to: '    if (cover <= 0) continue',
  },
  {
    id: 'M07',
    what: 'cover bound 0.25 -> 1: only a wall covering the whole side fires (a door or a set-back stretch silences the rule)',
    file: LAYOUT,
    from: 'export const WALL_STRIP_BOUNDS = { cover: 0.25 } as const',
    to: 'export const WALL_STRIP_BOUNDS = { cover: 1 } as const',
  },
  {
    id: 'M08',
    what: 'the thickness test dropped: a band thinner than 0.7 of a wall (a partition, a thin facade line) counts as the wall',
    file: LAYOUT,
    from: "      if ((b.axis === 'VERTICAL') !== across || b.thickness < wallPx * 0.7 || b.length < wallPx * 2.5) continue",
    to: "      if ((b.axis === 'VERTICAL') !== across || b.length < wallPx * 2.5) continue",
  },
  {
    id: 'M09',
    what: 'the length test dropped: short wall-thick blocks (piers, posts) count towards the cover',
    file: LAYOUT,
    from: "      if ((b.axis === 'VERTICAL') !== across || b.thickness < wallPx * 0.7 || b.length < wallPx * 2.5) continue",
    to: "      if ((b.axis === 'VERTICAL') !== across || b.thickness < wallPx * 0.7) continue",
  },
  {
    id: 'M10',
    what: 'the face window narrowed to 0: the band’s faces must sit exactly on the strip’s edges',
    file: LAYOUT,
    from: '      const window = Math.max(5, b.thickness * 0.35)',
    to: '      const window = 0',
  },
  {
    id: 'M11',
    what: 'the face window widened to a whole wall: any band within a wall of the strip’s edges counts',
    file: LAYOUT,
    from: '      const window = Math.max(5, b.thickness * 0.35)',
    to: '      const window = wallPx',
  },
  {
    id: 'M12',
    what: 'one face is enough: a band counts when either face (not both) is on its strip edge',
    file: LAYOUT,
    from: '      if (Math.abs(f0 - e0) > window || Math.abs(f1 - e1) > window || e1 - e0 - b.thickness > window) continue',
    to: '      if ((Math.abs(f0 - e0) > window && Math.abs(f1 - e1) > window) || e1 - e0 - b.thickness > window) continue',
  },
  {
    id: 'M13',
    what: 'the zone removed (N1’s first run): a wall strip is not emitted as a ZONE region, so the world frame moves off the stated extent',
    file: LAYOUT,
    from: '  for (const zone of zonesOutsideEnvelope(base, envelope.rect, frame)) {',
    to: '  for (const zone of zonesOutsideEnvelope(base, envelope.rect, frame).filter((z) => !wallStrips.some((w) => zoneIdOf(w.side) === z.id))) {',
  },
  {
    id: 'M14',
    what: 'backOn ignores the overlap along the side: a body is open on the strip when its face is near the back edge, wherever it stands along the side',
    file: LAYOUT,
    from: '      return Math.abs(face - back) <= wallPx && along > wallPx',
    to: '      return Math.abs(face - back) <= wallPx && (along > wallPx || r1 - r0 >= 0)',
    note: 'review round 1 (F1): before the fix the overlap term was with the whole strip span, which every mass inside the envelope satisfies (recorded EQUIVALENT then); it is now the overlap with the stretches the wall ink covers, and family 15 (a) has a body on the strip’s back edge beside them',
  },
  {
    id: 'M15',
    what: 'backOn ignores the face distance: every body overlapping the side is open on it, wherever its own face stands',
    file: LAYOUT,
    from: '      return Math.abs(face - back) <= wallPx && along > wallPx',
    to: '      return face === face && back === back && along > wallPx',
  },
  {
    id: 'M16',
    what: 'the span across an open face stays MEASURED (no basis is lowered)',
    file: LAYOUT,
    from: "    const basisX = openX && basisOf(spanX) === 'MEASURED' ? 'DERIVED' : basisOf(spanX)\n    const basisZ = openZ && basisOf(spanZ) === 'MEASURED' ? 'DERIVED' : basisOf(spanZ)",
    to: '    const basisX = basisOf(spanX)\n    const basisZ = basisOf(spanZ)',
  },
  {
    id: 'M17',
    what: 'the wrong axis is lowered: an open front or rear face takes MEASURED off the width, an open west or east face off the depth',
    file: LAYOUT,
    from: "    const openX = open.some((w) => w.side === 'MIN_X' || w.side === 'MAX_X')\n    const openZ = open.some((w) => w.side === 'MIN_Z' || w.side === 'MAX_Z')",
    to: "    const openX = open.some((w) => w.side === 'MIN_Z' || w.side === 'MAX_Z')\n    const openZ = open.some((w) => w.side === 'MIN_X' || w.side === 'MAX_X')",
  },
  {
    id: 'M18',
    what: 'the wrong side is named: MIN_Z and MAX_Z swapped in the gap’s words (front named rear and the reverse)',
    file: LAYOUT,
    from: "  const names: Record<PlanSide, string> = { MIN_X: 'west', MAX_X: 'east', MIN_Z: 'rear', MAX_Z: 'front' }",
    to: "  const names: Record<PlanSide, string> = { MIN_X: 'west', MAX_X: 'east', MIN_Z: 'front', MAX_Z: 'rear' }",
  },
  {
    id: 'M19',
    what: 'the back edge taken on the wrong (outer) side of the strip: MIN<->MAX in the edge a body must stand on',
    file: LAYOUT,
    from: "    const back = side === 'MIN_X' ? rect.x1 : side === 'MAX_X' ? rect.x0 : side === 'MIN_Z' ? rect.y1 : rect.y0",
    to: "    const back = side === 'MIN_X' ? rect.x0 : side === 'MAX_X' ? rect.x1 : side === 'MIN_Z' ? rect.y0 : rect.y1",
    note: 'review round 1: NOT KILLED end to end, equivalent on every solver input found — a strip the rule names is at most one wall deep through the solver (17-23.5 px for 18-24 px walls), so a body on the inner edge is also within one wall of the outer edge, and a front wall thicker than the modal wall cut on its inner face leaves no strip (the extent snaps to the inner face too, in the frozen solver as in N1). Review round 2: KILLED at unit level by wall-strip-unit.test.ts, whose back-edge probe (bisection on backOn) must find the envelope side to 1e-9 px, and whose case C (a 24 px front strip over 18 px walls, reachable only at unit level) puts the inner edge more than a wall from the outer one',
  },
  {
    id: 'M20',
    what: 'the gap is REFUSED instead of AMBIGUOUS (an unresolved face read as a refusal of the drawing)',
    file: LAYOUT,
    from: "the strip is read as no recess, no return and no terrace`,\n        status: 'AMBIGUOUS',",
    to: "the strip is read as no recess, no return and no terrace`,\n        status: 'REFUSED',",
  },
  {
    id: 'M21',
    what: 'openFacesOf matches every mass: each outer-face gap is pinned on every body, whether it stands on the strip or not',
    file: LAYOUT,
    from: "  return gaps.filter((g) => g.id.startsWith(`gap-${slugify(outerFaceSlug('zone-'))}`) && mass.why.includes(g.id))",
    to: "  return gaps.filter((g) => g.id.startsWith(`gap-${slugify(outerFaceSlug('zone-'))}`) && mass.why.length > 0)",
  },
  {
    id: 'M22',
    what: 'isWallStripZone matches every zone once any outer face is named: a wall strip on one side silences a real terrace on another',
    file: LAYOUT,
    from: '  return gaps.some((g) => g.id.startsWith(prefix))',
    to: "  return prefix.length > 0 && gaps.some((g) => g.id.startsWith(`gap-${slugify(outerFaceSlug('zone-'))}`))",
  },
  {
    id: 'M23',
    what: 'the axis test dropped: a band crossing the strip (a return, a carport side wall) counts towards the cover along it',
    file: LAYOUT,
    from: "      if ((b.axis === 'VERTICAL') !== across || b.thickness < wallPx * 0.7 || b.length < wallPx * 2.5) continue",
    to: "      if (b.thickness < wallPx * 0.7 || b.length < wallPx * 2.5) continue",
  },
  // --- review round 1 (F1-F4): each fix undone, or done the plausible wrong way --------------------------------------
  {
    id: 'M24',
    what: 'F1 undone: a body is open when its side overlaps the whole strip span (as before the fix), not the stretches the wall ink covers',
    file: LAYOUT,
    from: '      return Math.abs(face - back) <= wallPx && along > wallPx',
    to: '      return Math.abs(face - back) <= wallPx && Math.min(r1, s1) - Math.max(r0, s0) > 0',
  },
  {
    id: 'M25',
    what: 'F1 threshold wallPx -> 0: any overlap with the covered stretches opens a body, however little',
    file: LAYOUT,
    from: '      return Math.abs(face - back) <= wallPx && along > wallPx',
    to: '      return Math.abs(face - back) <= wallPx && along > 0',
  },
  {
    id: 'M26',
    what: 'F2 undone: no depth bound, a band floating clear of both strip edges (each within its face window) counts as the wall',
    file: LAYOUT,
    from: '      if (Math.abs(f0 - e0) > window || Math.abs(f1 - e1) > window || e1 - e0 - b.thickness > window) continue',
    to: '      if (Math.abs(f0 - e0) > window || Math.abs(f1 - e1) > window) continue',
  },
  {
    id: 'M27',
    what: 'F2 two-sided: |depth - thickness| > window also rejects a band thicker than its strip (a wall thickened inward past the tick)',
    file: LAYOUT,
    from: '      if (Math.abs(f0 - e0) > window || Math.abs(f1 - e1) > window || e1 - e0 - b.thickness > window) continue',
    to: '      if (Math.abs(f0 - e0) > window || Math.abs(f1 - e1) > window || Math.abs(e1 - e0 - b.thickness) > window) continue',
  },
  {
    id: 'M28',
    what: 'F4 undone: a platform outlined beyond a wall strip is neither built nor named (the gap is never pushed)',
    file: V2,
    from: '      if (ext) gap({ what: `the platform the plan outlines beyond the ${side.toLowerCase()} wall`,',
    to: '      if (ext && !ext) gap({ what: `the platform the plan outlines beyond the ${side.toLowerCase()} wall`,',
  },
  {
    id: 'M29',
    what: 'F4 with the wrong status: the platform gap is REFUSED instead of AMBIGUOUS (an unresolved face read as a refusal of the drawing)',
    file: V2,
    from: "the wall's outer face it would start from is unresolved`, status: 'AMBIGUOUS',",
    to: "the wall's outer face it would start from is unresolved`, status: 'REFUSED',",
  },
  {
    id: 'M30',
    what: 'F3 undone: the gap’s depth at the larger of the two scales, max(mppX, mppY), whatever the strip’s axis',
    file: LAYOUT,
    from: '    const mpp = base.registration ? (across ? base.registration.metresPerPixelX : base.registration.metresPerPixelY) : 0',
    to: '    const mpp = base.registration ? Math.max(base.registration.metresPerPixelX, base.registration.metresPerPixelY) : 0',
  },
  {
    id: 'M31',
    what: 'F3 on the wrong axis: a west or east strip’s depth at the y scale, a front or rear strip’s at the x scale',
    file: LAYOUT,
    from: '    const mpp = base.registration ? (across ? base.registration.metresPerPixelX : base.registration.metresPerPixelY) : 0',
    to: '    const mpp = base.registration ? (across ? base.registration.metresPerPixelY : base.registration.metresPerPixelX) : 0',
  },
  // --- review round 2 (R2A-1, R2A-2, R2A-6, R2B-02) -----------------------------------------------------------------
  {
    id: 'M32',
    what: 'F4 probed across the whole zone (the strip’s full length), not across the ground-storey bodies standing on its back',
    file: V2,
    from: '      const span: [number, number] = [Math.min(...standing.map((m) => (along ? m.x0 : m.z0))), Math.max(...standing.map((m) => (along ? m.x1 : m.z1)))]',
    to: '      const span: [number, number] = along ? [zoneV2.x0, zoneV2.x1] : [zoneV2.z0, zoneV2.z1]',
  },
  {
    id: 'M33',
    what: 'F4 without the skip: a wall strip no ground-storey body stands on is probed all the same (over the empty set of bodies)',
    file: V2,
    from: '      if (standing.length === 0) continue\n',
    to: '',
    note: 'expected EQUIVALENT: with no standing body the span is [min of nothing, max of nothing] = [Infinity, -Infinity], and readTerraceExtension refuses a span shorter than 1 m before it reads a pixel, so the skip only saves the call; M34 is the plausible wrong version that is not a no-op',
  },
  {
    id: 'M34',
    what: 'F4 without the skip, falling back to the zone’s own span when no ground-storey body stands on the strip’s back',
    file: V2,
    from: '      if (standing.length === 0) continue\n      const along = side === \'FRONT\' || side === \'REAR\'\n      const span: [number, number] = [Math.min(...standing.map((m) => (along ? m.x0 : m.z0))), Math.max(...standing.map((m) => (along ? m.x1 : m.z1)))]',
    to: '      const along = side === \'FRONT\' || side === \'REAR\'\n      const span: [number, number] = standing.length === 0 ? (along ? [zoneV2.x0, zoneV2.x1] : [zoneV2.z0, zoneV2.z1]) : [Math.min(...standing.map((m) => (along ? m.x0 : m.z0))), Math.max(...standing.map((m) => (along ? m.x1 : m.z1)))]',
    note: 'NOT KILLED: no fixture reaches it. The fallback runs only for a wall strip on whose back no ground-storey body stands within 0.15 m, and on a single-plan input every layout body is on the base storey and the envelope side the strip is cut from is some body’s face, so the set is never empty there; an input that would reach it (an envelope side no ground body stands on) was not found, through the solver or the sheet cache. Recorded as a survivor, not as proven equivalent'
  },
  {
    id: 'M35',
    what: 'G10 (orientation-dependent): the back edge a body must stand on is always the strip’s high edge — right for a west or rear strip, the outer edge for an east or front one',
    file: LAYOUT,
    from: "    const back = side === 'MIN_X' ? rect.x1 : side === 'MAX_X' ? rect.x0 : side === 'MIN_Z' ? rect.y1 : rect.y0",
    to: "    const back = side === 'MIN_X' ? rect.x1 : side === 'MAX_X' ? rect.x1 : side === 'MIN_Z' ? rect.y1 : rect.y1",
  },
  {
    id: 'M36',
    what: 'G10 (orientation-dependent): a band’s run is clipped to the strip at its low end only, so a band running past the strip’s high end adds to the cover and one running past its low end does not',
    file: LAYOUT,
    from: '      if (Math.min(a1, s1) > Math.max(a0, s0)) runs.push([Math.max(a0, s0), Math.min(a1, s1)])',
    to: '      if (Math.min(a1, s1) > Math.max(a0, s0)) runs.push([Math.max(a0, s0), a1])',
  },
  {
    id: 'M37',
    what: 'F1 merge undone in backOn: a body’s overlap is summed over the unmerged runs, so wall ink drawn in overlapping pieces counts twice',
    file: LAYOUT,
    from: '      const along = covered.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(r1, b) - Math.max(r0, a)), 0)',
    to: '      const along = runs.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(r1, b) - Math.max(r0, a)), 0)',
  },
  {
    id: 'M38',
    what: 'F1 merge undone in the cover: the cover is summed over the unmerged runs (overlapping pieces of one wall count twice)',
    file: LAYOUT,
    from: '    const cover = covered.reduce((sum, [a, b]) => sum + (b - a), 0) / Math.max(1, s1 - s0)',
    to: '    const cover = runs.reduce((sum, [a, b]) => sum + (b - a), 0) / Math.max(1, s1 - s0)',
  },
  {
    id: 'M39',
    what: 'F1 on the wrong axis: a body’s stretch along the strip is always taken from its x extent, also for a west or east strip (which runs along y)',
    file: LAYOUT,
    from: '      const [r0, r1] = across ? [r.y0, r.y1] : [r.x0, r.x1]',
    to: '      const [r0, r1] = [r.x0, r.x1]',
  },
  {
    id: 'M40',
    what: 'F4 over every zone: a platform outlined beyond a real terrace zone (no wall strip) is named as well',
    file: V2,
    from: "    for (const zone of layout.footprintRegions.filter((r) => r.kind === 'ZONE' && isWallStripZone(r.id, layout.unresolved))) {",
    to: "    for (const zone of layout.footprintRegions.filter((r) => r.kind === 'ZONE')) {",
  },
]

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' })
const sha = (text) => createHash('sha256').update(text).digest('hex')
const before = git('diff', '--stat', '--', 'packages')
const files = [...new Set(MUTATIONS.map((m) => m.file))]
const pristine = new Map(files.map((f) => [f, readFileSync(join(REPO, f))]))
const restoreAll = () => {
  for (const [f, bytes] of pristine) writeFileSync(join(REPO, f), bytes)
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(sig, () => {
    restoreAll()
    process.exit(130)
  })

const only = (arg('--only') ?? '').split(',').filter(Boolean)
let prior = []
try {
  prior = JSON.parse(readFileSync(RESULTS, 'utf8')).mutants ?? []
} catch {
  prior = []
}
const results = new Map(prior.map((r) => [r.id, r]))
for (const m of MUTATIONS.filter((x) => only.length === 0 || only.includes(x.id))) {
  const path = join(REPO, m.file)
  const original = pristine.get(m.file)
  const text = original.toString('utf8')
  const n = text.split(m.from).length - 1
  if (n !== 1) {
    results.set(m.id, { id: m.id, description: m.what, file: m.file, status: 'ANCHOR_NOT_FOUND', count: n })
    process.stdout.write(`${m.id} ANCHOR_NOT_FOUND (${n})\n`)
    continue
  }
  let run
  try {
    writeFileSync(path, text.replace(m.from, m.to))
    run = spawnSync('npx', ['vitest', 'run', '--reporter=json', ...SUITES], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 600_000 })
  } finally {
    writeFileSync(path, original)
  }
  if (sha(readFileSync(path)) !== sha(original)) throw new Error(`${m.file} was not restored byte for byte after ${m.id}`)
  if (git('diff', '--stat', '--', 'packages') !== before) throw new Error(`git diff --stat -- packages changed after ${m.id}`)
  writeFileSync(join(logDir, `${m.id}.json`), run.stdout ?? '')
  writeFileSync(join(logDir, `${m.id}.err`), run.stderr ?? '')
  let failed = []
  let suiteErrors = []
  try {
    const report = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
    failed = report.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === 'failed').map((a) => ({ file: f.name.replace(REPO + '/', ''), title: a.fullName, message: (a.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 240) })))
    suiteErrors = report.testResults.filter((f) => f.status === 'failed' && f.assertionResults.every((a) => a.status !== 'failed')).map((f) => f.name.replace(REPO + '/', ''))
  } catch {
    suiteErrors = ['UNPARSEABLE_REPORT']
  }
  const behavioural = failed.filter((f) => BEHAVIOUR.includes(f.file))
  const architectural = failed.filter((f) => ARCHITECTURE.includes(f.file))
  const status = behavioural.length > 0 ? 'KILLED' : architectural.length > 0 ? 'KILLED_ARCHITECTURE_ONLY' : suiteErrors.length > 0 ? 'SUITE_ERROR' : 'SURVIVED'
  results.set(m.id, {
    id: m.id,
    description: m.what,
    file: m.file,
    status,
    killedBy: behavioural.map((f) => `${f.file} :: ${f.title}`),
    behaviouralFailures: behavioural.length,
    architectureFailures: architectural.map((f) => `${f.file} :: ${f.title}`),
    firstFailure: (behavioural[0] ?? architectural[0])?.message,
    ...(m.note ? { note: m.note } : {}),
    suiteErrors,
  })
  process.stdout.write(`${m.id} ${status} (${behavioural.length} behavioural, ${architectural.length} architecture)\n`)
}
const ordered = MUTATIONS.map((m) => results.get(m.id)).filter(Boolean)
const killed = ordered.filter((r) => r.status === 'KILLED').length
writeFileSync(
  RESULTS,
  `${JSON.stringify(
    {
      stage: 'BUILDPLAN-ANALYZER-005Q',
      rule: 'N1a wall strip (layout 1.2.0)',
      suites: { behaviour: BEHAVIOUR, architecture: ARCHITECTURE },
      method: 'each mutant applied in place to one production file, the suites run, the file restored byte for byte (sha-256 checked) and git diff --stat -- packages compared with the pre-run state',
      summary: { total: ordered.length, killed, killedArchitectureOnly: ordered.filter((r) => r.status === 'KILLED_ARCHITECTURE_ONLY').length, survived: ordered.filter((r) => r.status === 'SURVIVED').length },
      mutants: ordered,
    },
    null,
    1,
  )}\n`,
)
process.stdout.write(`${killed}/${ordered.length} killed by a behavioural assertion\n`)
