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
  /** Drawn built area of the base plan against what the model's bodies cover of it, m². */
  drawnBuiltM2: number
  representedM2: number
  coverage: number
  areas: BodyArea[]
  missing: BodyArea[]
}

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
  return { drawnBuiltM2, representedM2, coverage: drawnBuiltM2 > 0 ? round6(representedM2 / drawnBuiltM2) : 1, areas, missing: areas.filter((a) => a.decision === 'MISSING') }
}

function rectOfBay(d: PlanDecomposition, bay: GateBay): { x0: number; y0: number; x1: number; y1: number } {
  const ix0 = Math.min(...bay.cells.map((c) => c.ix))
  const ix1 = Math.max(...bay.cells.map((c) => c.ix))
  const iy0 = Math.min(...bay.cells.map((c) => c.iy))
  const iy1 = Math.max(...bay.cells.map((c) => c.iy))
  return { x0: d.linesX[ix0].px, y0: d.linesY[iy0].px, x1: d.linesX[ix1 + 1].px, y1: d.linesY[iy1 + 1].px }
}
