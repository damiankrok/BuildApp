/**
 * N7-COUNCIL-FIX-03 (Council C-1/C-2/C-8, §4): no body the plan draws leaves the model in silence.
 *
 * Between the decomposition and the model a drawn body could be lost at several steps — the fill walking in through
 * its gate, the tiling taking it into the house, a gate on its strip — and the run still said COMPLETE, because what
 * was checked was what the model built, never what the plan drew. Here every area of the base plan with credible
 * drawn walls is weighed against the bodies the model is built from, by AREA (the cells the bodies cover), not by
 * count, and given one decision:
 *
 *   REPRESENTED  the model has a body standing on it
 *   JOINED       a body stands on it together with another drawn area (two regions one body)
 *   OMITTED      left out on purpose and on the record (a strip a wall thick, a region walled by line work)
 *   UNRESOLVED   walled on three sides with an open fourth the drawing does not say is a gate: named, not built
 *   MISSING      walled, built on the plan, and no body of the model stands on it — the run is not COMPLETE
 *
 * Pure: the decomposition, the layout's bodies and gaps, and the model's bodies in; records out.
 */
import { round6 } from '@buildapp/source-common'
import type { GateBay, PlanDecomposition } from '../plan-decomposition.js'
import { ringBounds } from '../structural-layout.js'
import type { PlanRing } from '../structural-layout.js'
import type { WorldFrame } from '../layout.js'
import { ringOfRect } from '../layout.js'

export type BodyAreaDecision = 'REPRESENTED' | 'JOINED' | 'OMITTED' | 'UNRESOLVED' | 'MISSING'

export type BodyArea = {
  id: string
  /** In the layout's frame, metres. */
  rectM: { x0: number; z0: number; x1: number; z1: number }
  areaM2: number
  /** Of the area, what the model's bodies cover. */
  coveredM2: number
  /** Share of its perimeter drawn as wall band. */
  walled: number
  decision: BodyAreaDecision
  /** The bodies standing on it. */
  massIds: string[]
  /** The step that lost it, for a MISSING or OMITTED area. */
  cause?: string
  why: string
}

export type BodyCompleteness = {
  /**
   * Drawn built area of the base plan against what the model's bodies cover of it, m². N7-FIX-04: this is completeness
   * AGAINST THE ACCEPTED DECOMPOSITION — its own BUILT regions — and proves nothing about what the decomposition never
   * enclosed; `unexplainedWalls` is the check that does not start from it.
   */
  drawnBuiltM2: number
  representedM2: number
  coverage: number
  areas: BodyArea[]
  missing: BodyArea[]
  /**
   * N7-FIX-04: wall bands of the base plan, a metre or longer, that stand neither on a body of the model nor in an
   * area named above — walls the plan draws and nothing in the reading accounts for (a garden wall, a fence drawn in
   * wall ink, or a body the decomposition never enclosed). Read from the bands, not from the decomposition.
   */
  unexplainedWalls: UnexplainedWall[]
}

/**
 * N7-FIX-04 follow-up: one wall band and the parts of it nothing accounts for — three numbers that are not the same.
 * A band running on past a body's front is mostly that body's own wall; only the run beyond the body (and its own wall
 * reach) is unexplained, and that run, not the band, is what the reading leaves open.
 */
export type UnexplainedWall = {
  /** The whole band, in the layout's frame and in the plan's pixels. */
  rectM: { x0: number; z0: number; x1: number; z1: number }
  rectPx: { x0: number; y0: number; x1: number; y1: number }
  /** The band's whole length along its axis, m — the drawn wall, explained parts included. */
  bandLengthM: number
  /** Of it, the length no body or named area accounts for, m: the sum of `fragments`. */
  unexplainedLengthM: number
  /** The runs of the band's axis outside every accounted rectangle, each with its own extent and length. */
  fragments: Array<{ rectM: { x0: number; z0: number; x1: number; z1: number }; rectPx: { x0: number; y0: number; x1: number; y1: number }; lengthM: number }>
  thicknessM: number
}

/** N7-FIX-04: a wall band this long or longer is a wall the reading must account for. */
const UNEXPLAINED_WALL_MIN_M = 1.0
/** How far outside a body's footprint its own wall may stand and still be its wall, m. */
const OWN_WALL_REACH_M = 0.6

/** A body covers an area when it stands on this share of it. */
const COVERED = 0.9

type Rect = { x0: number; z0: number; x1: number; z1: number }
const overlapArea = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))

export function bodyCompleteness(input: {
  decomposition: PlanDecomposition
  frame: WorldFrame
  /** The layout's base-storey bodies the model builds, by layout id, in the layout's frame. */
  built: ReadonlyArray<{ id: string; ring: PlanRing }>
  /** The layout's bodies the model does NOT build, and why. */
  dropped: ReadonlyArray<{ id: string; ring: PlanRing; why: string; deliberate: boolean }>
  /** The layout's gaps: an area named in one was left out on the record. */
  gaps: ReadonlyArray<{ id: string; what: string; reason: string }>
  /** N7-FIX-04: the base plan's wall bands, in its pixels (absent: no independent check). */
  bands?: ReadonlyArray<{ bounds: { x0: number; y0: number; x1: number; y1: number }; axis: 'HORIZONTAL' | 'VERTICAL'; thickness: number }>
}): BodyCompleteness {
  const { decomposition: d, frame } = input
  const areas: BodyArea[] = []
  const rectOf = (r: { x0: number; y0: number; x1: number; y1: number }): Rect => ringBounds(ringOfRect(r, frame))
  const bodies = input.built.map((b) => ({ id: b.id, rect: ringBounds(b.ring) }))
  const regions = d.regions.filter((r) => r.classification === 'BUILT')
  const regionOfCell = new Map<string, string>()
  for (const r of regions) for (const c of r.cells) regionOfCell.set(`${c.ix}:${c.iy}`, r.id)
  const walledOf = (cells: ReadonlyArray<{ ix: number; iy: number }>): number => {
    const own = new Set(cells.map((c) => `${c.ix}:${c.iy}`))
    let len = 0
    let wall = 0
    for (const cell of d.cells) {
      if (!own.has(`${cell.ix}:${cell.iy}`)) continue
      const next: Array<[number, number]> = [[cell.ix, cell.iy - 1], [cell.ix + 1, cell.iy], [cell.ix, cell.iy + 1], [cell.ix - 1, cell.iy]]
      for (let s = 0; s < 4; s += 1) {
        if (own.has(`${next[s][0]}:${next[s][1]}`)) continue
        const l = s % 2 === 0 ? (cell.rect.x1 - cell.rect.x0) * frame.metresPerPixelX : (cell.rect.y1 - cell.rect.y0) * frame.metresPerPixelY
        len += l
        wall += l * cell.edges[s].wall
      }
    }
    return len > 0 ? round6(wall / len) : 0
  }
  for (const r of regions) {
    const rect = rectOf(r.rect)
    const areaM2 = round6((rect.x1 - rect.x0) * (rect.z1 - rect.z0))
    const on = bodies.filter((b) => overlapArea(b.rect, rect) > 0.05 * areaM2)
    const coveredM2 = round6(Math.min(areaM2, on.reduce((a, b) => a + overlapArea(b.rect, rect), 0)))
    const walled = walledOf(r.cells)
    const base = { id: r.id, rectM: { x0: round6(rect.x0), z0: round6(rect.z0), x1: round6(rect.x1), z1: round6(rect.z1) }, areaM2, coveredM2, walled, massIds: on.map((b) => b.id).sort() }
    if (coveredM2 >= COVERED * areaM2) {
      // one body over this region and another drawn region: the two are one body, on purpose
      const joined = on.length === 1 && regions.some((o) => o !== r && overlapArea(on[0].rect, rectOf(o.rect)) > 0.05 * areaM2)
      areas.push({ ...base, decision: joined ? 'JOINED' : 'REPRESENTED', why: joined ? `${on[0].id} stands on it together with another drawn region` : `${on.map((b) => b.id).join(', ')} stand${on.length === 1 ? 's' : ''} on ${Math.round((coveredM2 / areaM2) * 100)}% of it` })
      continue
    }
    const drop = input.dropped.find((m) => overlapArea(ringBounds(m.ring), rect) > 0.5 * areaM2)
    const gap = input.gaps.find((g) => g.id.includes(r.id) || g.what.includes(r.id))
    if (gap && !drop) {
      areas.push({ ...base, decision: 'OMITTED', cause: gap.id, why: `left out on the record: ${gap.what} — ${gap.reason}` })
      continue
    }
    if (drop?.deliberate) {
      areas.push({ ...base, decision: 'OMITTED', cause: drop.id, why: `left out on the record: ${drop.why}` })
      continue
    }
    const cause = drop ? `the body ${drop.id} on it was not built: ${drop.why}` : on.length > 0 ? `the bodies on it (${on.map((b) => b.id).join(', ')}) cover only ${coveredM2.toFixed(1)} of its ${areaM2.toFixed(1)} m²` : 'no body of the layout stands on it: the region was enclosed and built on the plan, and lost before the massing'
    areas.push({ ...base, decision: 'MISSING', cause, why: `a ${areaM2.toFixed(1)} m² region the plan draws ${Math.round(walled * 100)}% in wall and the model does not build: ${cause}` })
  }
  for (const [k, bay] of (d.gateBays ?? []).entries()) {
    if (bay.decision !== 'LEFT_OPEN') continue
    const rect = rectOf(rectOfBay(d, bay))
    const areaM2 = round6((rect.x1 - rect.x0) * (rect.z1 - rect.z0))
    areas.push({ id: `pocket-${k}`, rectM: { x0: round6(rect.x0), z0: round6(rect.z0), x1: round6(rect.x1), z1: round6(rect.z1) }, areaM2, coveredM2: 0, walled: round6((bay.sideWalls.reduce((a, b) => a + b, 0)) / 4), decision: 'UNRESOLVED', massIds: [], why: `${bay.why}; not built and not a confirmed body: what stands there is a question for the drawing's reader` })
  }
  const drawnBuiltM2 = round6(areas.filter((a) => a.decision !== 'UNRESOLVED').reduce((a, b) => a + b.areaM2, 0))
  const representedM2 = round6(areas.filter((a) => a.decision === 'REPRESENTED' || a.decision === 'JOINED').reduce((a, b) => a + b.coveredM2, 0))
  // N7-FIX-04: the independent check — every wall band inside the plan's dimensioned extent, against the bodies and the
  // named areas, by the length of it that stands on them (each grown by a wall and a little: a body's own outer wall)
  const accounted = [...bodies.map((b) => b.rect), ...areas.map((a) => a.rectM)].map((r) => ({ x0: r.x0 - OWN_WALL_REACH_M, z0: r.z0 - OWN_WALL_REACH_M, x1: r.x1 + OWN_WALL_REACH_M, z1: r.z1 + OWN_WALL_REACH_M }))
  const ext = d.extent
  const unexplainedWalls: BodyCompleteness['unexplainedWalls'] = []
  const toX = frame.x ?? ((px: number): number => (px - frame.originPx.x) * frame.metresPerPixelX)
  const toZ = frame.z ?? ((px: number): number => (px - frame.originPx.y) * frame.metresPerPixelY)
  for (const b of input.bands ?? []) {
    const cx = (b.bounds.x0 + b.bounds.x1) / 2
    const cy = (b.bounds.y0 + b.bounds.y1) / 2
    if (cx < ext.x0 || cx > ext.x1 || cy < ext.y0 || cy > ext.y1) continue
    const r = rectOf(b.bounds)
    const along = b.axis === 'HORIZONTAL'
    const bandLengthM = round6(along ? r.x1 - r.x0 : r.z1 - r.z0)
    if (bandLengthM < UNEXPLAINED_WALL_MIN_M) continue
    // the band's axis, at its centre line, less every accounted rectangle that line crosses: exact intervals
    const across = along ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2
    const covers = accounted
      .filter((a) => (along ? across >= a.z0 && across <= a.z1 : across >= a.x0 && across <= a.x1))
      .map((a) => (along ? [a.x0, a.x1] : [a.z0, a.z1]) as [number, number])
      .sort((p, q) => p[0] - q[0])
    const runs: Array<[number, number]> = []
    let at = along ? r.x0 : r.z0
    const stop = along ? r.x1 : r.z1
    for (const [c0, c1] of covers) {
      if (c1 <= at) continue
      if (c0 >= stop) break
      if (c0 > at) runs.push([at, c0])
      at = Math.max(at, c1)
      if (at >= stop) break
    }
    if (at < stop) runs.push([at, stop])
    const unexplainedLengthM = round6(runs.reduce((a, [p, q]) => a + (q - p), 0))
    if (unexplainedLengthM < UNEXPLAINED_WALL_MIN_M) continue
    // each run back in the plan's pixels: the frame's metres are monotone in the pixel along the band's axis
    const pxOf = (m: number): number => {
      const map = along ? toX : toZ
      let lo = along ? b.bounds.x0 : b.bounds.y0
      let hi = along ? b.bounds.x1 : b.bounds.y1
      const rising = map(hi) >= map(lo)
      for (let k = 0; k < 40; k += 1) {
        const mid = (lo + hi) / 2
        if ((map(mid) < m) === rising) lo = mid
        else hi = mid
      }
      return Math.round(((lo + hi) / 2) * 100) / 100
    }
    const fragments = runs.map(([p, q]) => {
      const [a, c] = [pxOf(p), pxOf(q)].sort((u, v) => u - v)
      return {
        rectM: along ? { x0: round6(p), z0: round6(r.z0), x1: round6(q), z1: round6(r.z1) } : { x0: round6(r.x0), z0: round6(p), x1: round6(r.x1), z1: round6(q) },
        rectPx: along ? { x0: a, y0: b.bounds.y0, x1: c, y1: b.bounds.y1 } : { x0: b.bounds.x0, y0: a, x1: b.bounds.x1, y1: c },
        lengthM: round6(q - p),
      }
    })
    unexplainedWalls.push({ rectM: { x0: round6(r.x0), z0: round6(r.z0), x1: round6(r.x1), z1: round6(r.z1) }, rectPx: { ...b.bounds }, bandLengthM, unexplainedLengthM, fragments, thicknessM: round6(b.thickness * Math.max(frame.metresPerPixelX, frame.metresPerPixelY)) })
  }
  return { drawnBuiltM2, representedM2, coverage: drawnBuiltM2 > 0 ? round6(representedM2 / drawnBuiltM2) : 1, areas, missing: areas.filter((a) => a.decision === 'MISSING'), unexplainedWalls }
}

export type ModelCompletenessVerdict = 'COMPLETE' | 'COMPLETE_WITH_OPEN_QUESTIONS' | 'PARTIAL'

/**
 * N7-FIX-04: what the run may say about the model as a whole — four questions kept apart, then one verdict.
 *
 *   decomposition   every BUILT region of the accepted decomposition stands under a body (`coverage`) — a statement
 *                   about the reading, never on its own about the source plan
 *   unresolved      areas named and not built (pockets the drawing does not say are bodies) and walls nothing accounts for
 *   conflicts       the chosen layout's own gate: what it holds BLOCKING, and what only degrades it
 *   model           what was emitted and built: a refused object or a missing body makes it partial
 *
 * PARTIAL: a body missing, an object the model refused, or a BLOCKING reason the chosen layout never resolved.
 * COMPLETE_WITH_OPEN_QUESTIONS: built whole, with unresolved areas, unexplained walls or degrading conflicts named.
 * COMPLETE: none of these.
 */
export type ModelCompleteness = {
  verdict: ModelCompletenessVerdict
  decomposition: { coverage: number; drawnBuiltM2: number; representedM2: number; basis: 'ACCEPTED_DECOMPOSITION' }
  missingBodies: string[]
  unresolvedAreas: Array<{ id: string; areaM2: number; why: string }>
  /** N7-FIX-04 follow-up: `lengthM` is what nothing accounts for; `bandLengthM` the whole bands it lies on. */
  unexplainedWalls: { count: number; lengthM: number; bandLengthM: number }
  conflicts: { blocking: Array<{ code: string; what: string }>; degrading: Array<{ code: string; what: string }> }
  modelRefusals: number
  why: string
}

export function modelCompleteness(input: {
  body: BodyCompleteness | undefined
  gateReasons: ReadonlyArray<{ code: string; severity: string; what: string }>
  modelRefusals: number
}): ModelCompleteness {
  const b = input.body
  const missingBodies = (b?.missing ?? []).map((a) => a.id)
  const unresolvedAreas = (b?.areas ?? []).filter((a) => a.decision === 'UNRESOLVED' || a.decision === 'OMITTED').map((a) => ({ id: a.id, areaM2: a.areaM2, why: a.why }))
  const walls = b?.unexplainedWalls ?? []
  const blocking = input.gateReasons.filter((r) => r.severity === 'BLOCKING').map((r) => ({ code: r.code, what: r.what }))
  const degrading = input.gateReasons.filter((r) => r.severity === 'DEGRADING').map((r) => ({ code: r.code, what: r.what }))
  const partial = missingBodies.length > 0 || blocking.length > 0 || input.modelRefusals > 0
  const open = unresolvedAreas.length > 0 || walls.length > 0 || degrading.length > 0
  const verdict: ModelCompletenessVerdict = partial ? 'PARTIAL' : open ? 'COMPLETE_WITH_OPEN_QUESTIONS' : 'COMPLETE'
  const said: string[] = []
  if (missingBodies.length > 0) said.push(`${missingBodies.length} drawn bod${missingBodies.length === 1 ? 'y' : 'ies'} missing from the model`)
  if (blocking.length > 0) said.push(`the chosen layout holds ${blocking.map((x) => x.code).join(', ')} BLOCKING, unresolved`)
  if (input.modelRefusals > 0) said.push(`${input.modelRefusals} object${input.modelRefusals === 1 ? '' : 's'} refused by the model`)
  if (unresolvedAreas.length > 0) said.push(`${unresolvedAreas.length} area${unresolvedAreas.length === 1 ? '' : 's'} named and not built`)
  if (walls.length > 0) said.push(`${walls.length} drawn wall${walls.length === 1 ? '' : 's'} with ${walls.reduce((a, w) => a + w.unexplainedLengthM, 0).toFixed(1)} m (of ${walls.reduce((a, w) => a + w.bandLengthM, 0).toFixed(1)} m of band) no body or named area accounts for`)
  if (degrading.length > 0) said.push(`degrading: ${[...new Set(degrading.map((x) => x.code))].join(', ')}`)
  return {
    verdict,
    decomposition: { coverage: b?.coverage ?? 0, drawnBuiltM2: b?.drawnBuiltM2 ?? 0, representedM2: b?.representedM2 ?? 0, basis: 'ACCEPTED_DECOMPOSITION' },
    missingBodies,
    unresolvedAreas,
    unexplainedWalls: { count: walls.length, lengthM: round6(walls.reduce((a, w) => a + w.unexplainedLengthM, 0)), bandLengthM: round6(walls.reduce((a, w) => a + w.bandLengthM, 0)) },
    conflicts: { blocking, degrading },
    modelRefusals: input.modelRefusals,
    why: `${b ? `the accepted decomposition is ${Math.round((b.coverage) * 100)}% represented (its own built regions only)` : 'no decomposition to weigh'}${said.length > 0 ? `; ${said.join('; ')}` : '; nothing unresolved, unexplained or in conflict'}`,
  }
}

function rectOfBay(d: PlanDecomposition, bay: GateBay): { x0: number; y0: number; x1: number; y1: number } {
  const ix0 = Math.min(...bay.cells.map((c) => c.ix))
  const ix1 = Math.max(...bay.cells.map((c) => c.ix))
  const iy0 = Math.min(...bay.cells.map((c) => c.iy))
  const iy1 = Math.max(...bay.cells.map((c) => c.iy))
  return { x0: d.linesX[ix0].px, y0: d.linesY[iy0].px, x1: d.linesX[ix1 + 1].px, y1: d.linesY[iy1 + 1].px }
}
