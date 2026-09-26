/**
 * Assembly closure: the pass that turns readings into joins.
 *
 * The readers before this one measure members one at a time — a return on a
 * plan, a fascia band on a render, a balustrade line on a render — and each
 * reading is right on its own terms. What they do not decide is how the
 * members MEET, and a building is mostly meetings: a balcony slab that stops
 * seven centimetres short of the return it should bear on reads as a slab
 * floating in the zone; a balustrade that stops where the render lost sight
 * of it reads as a railing that ends in mid-air; a verge board 0.3 m deep in
 * front of returns a metre deep reads as a bar laid on a frame rather than
 * the top member of that frame.
 *
 * This pass decides the meetings from the building's own topology and from
 * the plans, never from a figure of any particular building:
 *
 *  - a return whose outer face lies within a plan registration's residual of
 *    its body's outer face is in that face's plane;
 *  - a slab's top within 0.1 m of the storey floor it opens from IS that
 *    floor: a threshold has no step;
 *  - a slab end near a wall that stands beside the slab stops at that wall's
 *    face; one near a return of the storey above, standing in the zone the
 *    slab spans, runs on under that return and carries it; one near the start
 *    of the next member of its facade assembly meets it end to end; any other
 *    end is free, and the plan is read for the balustrade it draws there;
 *  - a railing guards the slab's open edges: along the mouth always, and
 *    round a free end when the plan draws the balustrade turning there;
 *  - a verge that continues the returns of a gable frame is as deep as those
 *    returns: the frame's top member, not a board in front of it;
 *  - a member that continues another (a portal head continuing a balcony
 *    fascia) shares its top and bottom lines.
 *
 * Every decision is recorded with its reason, and the facade graph built at
 * the end states each meeting with the gap the model will carry.
 */
import { round6 } from '@buildapp/source-common'
import type { Raster } from '@buildapp/source-cv'
import type { BalconyV2, EndCondition, FacadeGraph, FacadeGraphEdge, FacadeGraphNode, LevelV2, MassV2, PortalHeadV2, RailingV2, ReturnWallV2, TerraceV2, VergeV2 } from './building.js'
import type { ElevationFrameV2, PlanFrameV2 } from './frame.js'
import type { RecessTopology } from './recesses.js'
import { rgbAt } from './scan.js'
import { whitePointOf } from './tones.js'
import { lumaAt } from './scan.js'

export type Side = 'FRONT' | 'REAR' | 'WEST' | 'EAST'
export type ClosureNote = { subject: string; what: string; why: string }

const alongIsX = (s: Side): boolean => s === 'FRONT' || s === 'REAR'

/** Half a railing post: how far a post's centre stands from the face it touches. */
const POST_HALF = 0.025
/** How far a balustrade stands in from the slab edge it guards. */
const RAIL_INSET = 0.05

// ---------------------------------------------------------------------------
// returns
// ---------------------------------------------------------------------------

/**
 * Put a return's outer face in its body's face when the two are within a
 * plan registration's residual of each other. A return on the attic plan
 * registered 2.6 cm off the ground plan's body is the same wall in the same
 * plane, and a 2.6 cm step between the return and the verge above it is a
 * registration residual drawn as geometry.
 */
export function snapReturnsToBodyFaces(returns: readonly ReturnWallV2[], masses: readonly MassV2[], toleranceM = 0.06): { returns: ReturnWallV2[]; notes: ClosureNote[] } {
  const notes: ClosureNote[] = []
  const out = returns.map((r) => {
    const ax = alongIsX(r.side)
    const [a0, a1] = r.alongInterval
    const centre = (a0 + a1) / 2
    const body = masses.find((m) => m.storeys.includes(r.storeyIndex) && (ax ? centre >= m.x0 - toleranceM && centre <= m.x1 + toleranceM : centre >= m.z0 - toleranceM && centre <= m.z1 + toleranceM))
    if (!body) return r
    const lo = ax ? body.x0 : body.z0
    const hi = ax ? body.x1 : body.z1
    let shift = 0
    if (Math.abs(a0 - lo) <= toleranceM && Math.abs(a0 - lo) > 1e-6) shift = lo - a0
    else if (Math.abs(a1 - hi) <= toleranceM && Math.abs(a1 - hi) > 1e-6) shift = hi - a1
    if (shift === 0) return r
    const move = (p: { x: number; z: number }): { x: number; z: number } => (ax ? { x: round6(p.x + shift), z: p.z } : { x: p.x, z: round6(p.z + shift) })
    notes.push({ subject: r.id, what: `outer face moved ${(shift * 100).toFixed(1)} cm into the plane of ${body.id}`, why: `within ${(toleranceM * 100).toFixed(0)} cm of the body's face: a plan registration residual, not a step` })
    return { ...r, start: move(r.start), end: move(r.end), alongInterval: [round6(a0 + shift), round6(a1 + shift)] as [number, number] }
  })
  return { returns: out, notes }
}

// ---------------------------------------------------------------------------
// the drawn end of a slab
// ---------------------------------------------------------------------------

/**
 * A thin line the plan draws across a zone at one position along it: a
 * balustrade (with its post ticks) or the slab's edge. Searched within
 * `searchM` of `at`; returns the position along the facade and the share of
 * the zone's depth the line covers.
 */
export function drawnLineAcrossZone(raster: Raster, frame: PlanFrameV2, side: Side, recess: RecessTopology, at: number, searchM = 0.35): { at: number; coverage: number } | undefined {
  const ax = alongIsX(side)
  const c0 = Math.min(recess.mouthAt, recess.backAt)
  const c1 = Math.max(recess.mouthAt, recess.backAt)
  // Pixel extent of the zone's depth at a position along the facade.
  const pix = (a: number, c: number): { x: number; y: number } => (ax ? frame.toPixel(a, c) : frame.toPixel(c, a))
  const coverageAt = (a: number): number => {
    const p0 = pix(a, c0)
    const p1 = pix(a, c1)
    let hits = 0
    let n = 0
    if (ax) {
      const col = Math.round(p0.x)
      const r0 = Math.round(Math.min(p0.y, p1.y)) + 2
      const r1 = Math.round(Math.max(p0.y, p1.y)) - 2
      for (let y = r0; y <= r1; y += 1) {
        n += 1
        if (Math.min(lumaAt(raster, col - 1, y), lumaAt(raster, col, y), lumaAt(raster, col + 1, y)) < 200) hits += 1
      }
    } else {
      const row = Math.round(p0.y)
      const q0 = Math.round(Math.min(p0.x, p1.x)) + 2
      const q1 = Math.round(Math.max(p0.x, p1.x)) - 2
      for (let x = q0; x <= q1; x += 1) {
        n += 1
        if (Math.min(lumaAt(raster, x, row - 1), lumaAt(raster, x, row), lumaAt(raster, x, row + 1)) < 200) hits += 1
      }
    }
    return n > 0 ? hits / n : 0
  }
  const mpp = (frame.mppX + frame.mppY) / 2
  let best: { at: number; coverage: number } | undefined
  for (let a = at - searchM; a <= at + searchM + 1e-9; a += mpp) {
    const cov = coverageAt(a)
    if (cov < 0.75) continue
    // A line, not the edge of a solid block: thin, with little ink four pixels to either side.
    const side0 = coverageAt(a - 4 * mpp)
    const side1 = coverageAt(a + 4 * mpp)
    if (side0 > 0.6 && side1 > 0.6) continue
    if (!best || cov > best.coverage + 0.02 || (Math.abs(cov - best.coverage) <= 0.02 && Math.abs(a - at) < Math.abs(best.at - at))) best = { at: round6(a), coverage: round6(cov) }
  }
  return best
}

// ---------------------------------------------------------------------------
// balconies
// ---------------------------------------------------------------------------

export type BalconyClosureInput = {
  balconies: readonly BalconyV2[]
  returns: readonly ReturnWallV2[]
  recesses: readonly RecessTopology[]
  levels: readonly LevelV2[]
  portalHeads: readonly PortalHeadV2[]
  plans: ReadonlyMap<number, { frame: PlanFrameV2; raster: Raster; frameId: string }>
  /** The registered elevation of each facade, where there is one: what shows whether a fascia runs on under a return. */
  elevations?: ReadonlyArray<{ view: ElevationFrameV2; raster: Raster }>
  toleranceM?: number
}

/**
 * Does the slab's fascia band run on across `along` on the facade's
 * elevation? The band's own finish is read over the slab's middle, between
 * its soffit and its top; the same rows across `along` must read the same
 * (their median brightness within 12 % of the render's white of the band's).
 * Undefined when there is no elevation of that facade to read.
 */
export function bandContinues(elevation: { view: ElevationFrameV2; raster: Raster } | undefined, band: { from: number; to: number; soffit: number; top: number }, along: [number, number]): { continues: boolean; why: string } | undefined {
  if (!elevation) return undefined
  const { view, raster } = elevation
  const white = whitePointOf(raster)
  const mpp = view.registration.metresPerPixelU
  const medianLuma = (a0: number, a1: number): number | undefined => {
    const ls: number[] = []
    for (let a = a0; a <= a1; a += mpp) {
      for (let y = band.soffit + 0.05; y <= band.top - 0.05; y += mpp) {
        const [r, g, b] = rgbAt(raster, Math.round(view.pxOf(a)), Math.round(view.pyOf(y)))
        ls.push((r + g + b) / 3)
      }
    }
    if (ls.length < 4) return undefined
    ls.sort((x, y) => x - y)
    return ls[Math.floor(ls.length / 2)]
  }
  const mid = (band.from + band.to) / 2
  const own = medianLuma(Math.max(band.from + 0.1, mid - 0.5), Math.min(band.to - 0.1, mid + 0.5))
  const under = medianLuma(Math.min(along[0], along[1]) + 0.05, Math.max(along[0], along[1]) - 0.05)
  if (own === undefined || under === undefined) return undefined
  const delta = Math.abs(own - under) / white
  const continues = delta <= 0.12
  return { continues, why: `the band reads ${Math.round((own / white) * 100)} % of the ${view.side.toLowerCase()} render's white over the slab and ${Math.round((under / white) * 100)} % across ${along[0].toFixed(2)}..${along[1].toFixed(2)}: ${continues ? 'one band' : 'not the band'}` }
}

export type BalconyEnd = EndCondition & { railStopAt: number; turns: boolean; lineFrameId?: string }

export function closeBalconies(input: BalconyClosureInput): { balconies: BalconyV2[]; ends: Map<string, [BalconyEnd, BalconyEnd]>; notes: ClosureNote[] } {
  const tol = input.toleranceM ?? 0.2
  const notes: ClosureNote[] = []
  const endsById = new Map<string, [BalconyEnd, BalconyEnd]>()
  const levelOf = (i: number): LevelV2 | undefined => input.levels.find((l) => l.index === i)
  const out = input.balconies.map((b) => {
    if (b.kind !== 'BALCONY' || !b.side) return b
    const side = b.side
    const ax = alongIsX(side)
    const level = levelOf(b.storeyIndex)
    const recess = input.recesses.find((r) => r.side === side && r.storeyIndex === b.storeyIndex)
    if (!level || !recess) return b
    // 1. The top is the storey floor when the fascia's top reads within 0.1 m of it.
    const soffit = b.topY - b.thicknessM
    let topY = b.topY
    if (Math.abs(b.topY - level.elevation) <= 0.1 && Math.abs(b.topY - level.elevation) > 1e-6) {
      topY = level.elevation
      notes.push({ subject: b.id, what: `top ${b.topY.toFixed(3)} → ${level.elevation.toFixed(3)}`, why: 'the storey floor it opens from: a threshold without a step' })
    }
    const thickness = round6(topY - soffit)
    // 2. The two ends along the facade.
    const lo0 = ax ? b.x0 : b.z0
    const hi0 = ax ? b.x1 : b.z1
    const plan = input.plans.get(b.storeyIndex)
    const resolveEnd = (which: 'LOW' | 'HIGH', at: number): BalconyEnd => {
      const low = which === 'LOW'
      // (a) a wall standing beside the slab, from a storey below, whose vertical extent the slab's overlaps.
      for (const r of input.returns) {
        if (r.side !== side || r.storeyIndex >= b.storeyIndex) continue
        const l = levelOf(r.storeyIndex)
        if (!l) continue
        if (l.elevation + l.height < soffit + 0.01 || l.elevation > topY - 0.01) continue
        const face = low ? r.alongInterval[1] : r.alongInterval[0]
        if (Math.abs(face - at) <= tol) return { kind: 'WALL', at: face, againstId: r.id, why: `against the face of ${r.id}, which stands beside the slab`, railStopAt: face, turns: false }
      }
      // (b) a return of the slab's own storey at its end. Over an open recess
      // of the storey below it stands on nothing but the slab, so the slab runs
      // on under it and carries it; over a closed storey it stands on the wall
      // below, and the slab stops against its face.
      for (const r of input.returns) {
        if (r.side !== side || r.storeyIndex !== b.storeyIndex) continue
        const near = low ? r.alongInterval[1] : r.alongInterval[0]
        const far = low ? r.alongInterval[0] : r.alongInterval[1]
        if (Math.abs(near - at) > tol) continue
        const [r0, r1] = r.alongInterval
        const overOpen = input.recesses.some((below) => below.side === side && below.storeyIndex === b.storeyIndex - 1 && below.open.some((o) => o.from <= r0 + 0.05 && o.to >= r1 - 0.05))
        if (!overOpen) return { kind: 'WALL', at: near, againstId: r.id, why: `against the face of ${r.id}, which stands on the storey below`, railStopAt: near, turns: false }
        // Over an open storey the return needs the slab under it — but the
        // slab runs on under it only where the elevation draws its fascia
        // running on; a drawing that stops the band at the return's face is
        // the source, and the slab stops there with it.
        const elevation = input.elevations?.find((e) => (e.view.side === 'LEFT' ? 'WEST' : e.view.side === 'RIGHT' ? 'EAST' : e.view.side) === side)
        const band = bandContinues(elevation, { from: lo0, to: hi0, soffit, top: topY }, [r0, r1])
        if (band && !band.continues) return { kind: 'WALL', at: near, againstId: r.id, why: `against the face of ${r.id}: ${band.why}`, railStopAt: near, turns: false }
        return { kind: 'CARRIES', at: far, againstId: r.id, why: `${r.id} stands over the open recess of the storey below, on nothing but the slab; the slab runs on under it to its far face${band ? ` (${band.why})` : ' (no elevation of this facade to confirm the band)'}`, railStopAt: near, turns: false }
      }
      // (c) a free end: the plan is read for the line it draws there.
      if (plan) {
        const line = drawnLineAcrossZone(plan.raster, plan.frame, side, recess, at)
        if (line) return { kind: 'FREE', at: line.at, why: `a free end; the plan draws a line across the zone at ${line.at.toFixed(2)} (${Math.round(line.coverage * 100)} % of its depth): the balustrade turning to the wall`, railStopAt: line.at, turns: true, lineFrameId: plan.frameId }
      }
      return { kind: 'FREE', at, why: 'a free end, and the plan draws no balustrade across the zone there', railStopAt: at, turns: false }
    }
    const endLow = resolveEnd('LOW', lo0)
    const endHigh = resolveEnd('HIGH', hi0)
    // (d) the next member of the assembly: a portal head continuing this slab starts where it ends.
    for (const p of input.portalHeads) {
      if (p.continuesFromId !== b.id || !ax) continue
      if (Math.abs(p.x0 - endHigh.at) <= 0.15 && endHigh.kind !== 'WALL') {
        if (Math.abs(p.x0 - endHigh.at) > 1e-6) notes.push({ subject: b.id, what: `high end ${endHigh.at.toFixed(3)} → ${p.x0.toFixed(3)}`, why: `meets ${p.id} end to end: the fascia is one band` })
        endHigh.at = p.x0
        if (endHigh.kind === 'FREE') {
          endHigh.kind = 'MEETS'
          endHigh.againstId = p.id
          endHigh.why = `meets ${p.id} end to end`
        }
      }
      if (Math.abs(p.x1 - endLow.at) <= 0.15 && endLow.kind !== 'WALL') {
        endLow.at = p.x1
        if (endLow.kind === 'FREE') {
          endLow.kind = 'MEETS'
          endLow.againstId = p.id
          endLow.why = `meets ${p.id} end to end`
        }
      }
    }
    for (const [which, e, was] of [['low', endLow, lo0], ['high', endHigh, hi0]] as const) {
      if (Math.abs(e.at - was) > 1e-6) notes.push({ subject: b.id, what: `${which} end ${was.toFixed(3)} → ${e.at.toFixed(3)} (${e.kind})`, why: e.why })
    }
    endsById.set(b.id, [endLow, endHigh])
    const lo = round6(endLow.at)
    const hi = round6(endHigh.at)
    const ends: [EndCondition, EndCondition] = [
      { kind: endLow.kind, at: lo, againstId: endLow.againstId, why: endLow.why },
      { kind: endHigh.kind, at: hi, againstId: endHigh.againstId, why: endHigh.why },
    ]
    return { ...b, topY: round6(topY), thicknessM: thickness, ...(ax ? { x0: lo, x1: hi } : { z0: lo, z1: hi }), ends }
  })
  return { balconies: out, ends: endsById, notes }
}

// ---------------------------------------------------------------------------
// railings
// ---------------------------------------------------------------------------

/**
 * A balustrade along the slab's open edges: the mouth, and round each free
 * end the plan draws it turning at, back to the wall. Ends at a wall stop
 * with the end post against that wall's face.
 */
export function railingPath(b: BalconyV2, recess: RecessTopology, ends: [BalconyEnd, BalconyEnd]): { path: Array<{ x: number; z: number }>; turns: number; why: string } {
  const side = b.side as Side
  const ax = alongIsX(side)
  const dc = Math.sign(recess.backAt - recess.mouthAt) || 1
  const cLine = recess.mouthAt + dc * RAIL_INSET
  const cBack = recess.backAt - dc * POST_HALF
  const [lo, hi] = ends
  // Where each end's run stops along the facade: against a face (a post touching it) or at the drawn line (inset like the mouth).
  const aLo = lo.turns ? lo.railStopAt + RAIL_INSET : lo.railStopAt + POST_HALF
  const aHi = hi.turns ? hi.railStopAt - RAIL_INSET : hi.railStopAt - POST_HALF
  const pts: Array<[number, number]> = []
  if (lo.turns) pts.push([aLo, cBack])
  pts.push([aLo, cLine], [aHi, cLine])
  if (hi.turns) pts.push([aHi, cBack])
  const path = pts.map(([a, c]) => (ax ? { x: round6(a), z: round6(c) } : { x: round6(c), z: round6(a) }))
  const turns = (lo.turns ? 1 : 0) + (hi.turns ? 1 : 0)
  const why = `along the mouth${lo.turns ? ', turning back to the wall at the low end' : ''}${hi.turns ? ', turning back to the wall at the high end' : ''}; ${[lo, hi].map((e, i) => `${i === 0 ? 'low' : 'high'} end ${e.kind.toLowerCase()}${e.againstId ? ` (${e.againstId})` : ''}`).join(', ')}`
  return { path, turns, why }
}

export function closeRailings(railings: readonly RailingV2[], balconies: readonly BalconyV2[], recesses: readonly RecessTopology[], ends: ReadonlyMap<string, [BalconyEnd, BalconyEnd]>): { railings: RailingV2[]; notes: ClosureNote[] } {
  const notes: ClosureNote[] = []
  const out = railings.map((r) => {
    const b = balconies.find((x) => x.kind === 'BALCONY' && x.storeyIndex === r.storeyIndex && x.side !== undefined && r.id === `railing-${x.side.toLowerCase()}-${x.storeyIndex}`)
    if (!b || !b.side) return r
    const recess = recesses.find((x) => x.side === b.side && x.storeyIndex === b.storeyIndex)
    const e = ends.get(b.id)
    if (!recess || !e) return r
    const { path, turns, why } = railingPath(b, recess, e)
    notes.push({ subject: r.id, what: `${path.length - 1} run${path.length === 2 ? '' : 's'}, ${turns} turn${turns === 1 ? '' : 's'}`, why })
    return { ...r, start: path[0], end: path[path.length - 1], ...(path.length > 2 ? { path } : {}), hostId: b.id, baseY: b.topY, why: `${r.why}; ${why}` }
  })
  return { railings: out, notes }
}

// ---------------------------------------------------------------------------
// verges and portal heads
// ---------------------------------------------------------------------------

/** A verge continuing the returns of a gable frame is as deep as they are. */
export function closeVerges(verges: readonly VergeV2[], recesses: readonly RecessTopology[], returns: readonly ReturnWallV2[]): { verges: VergeV2[]; notes: ClosureNote[] } {
  const notes: ClosureNote[] = []
  const out = verges.map((v) => {
    const framing = returns.filter((r) => r.side === v.side)
    const recess = recesses.filter((r) => r.side === v.side && r.returns.length > 0).sort((a, b) => b.storeyIndex - a.storeyIndex)[0]
    if (framing.length === 0 || !recess) return { ...v, depthProvenance: 'ASSUMED_FOR_RENDERING' as const, depthWhy: 'no returns frame this gable: the verge depth is a convention' }
    const depth = round6(Math.abs(recess.mouthAt - recess.backAt))
    notes.push({ subject: v.id, what: `depth ${v.depthM} → ${depth}`, why: `the verge continues the ${framing.length} returns of the ${v.side.toLowerCase()} gable frame, which stand the ${depth.toFixed(2)} m depth of the zone` })
    return { ...v, depthM: depth, depthProvenance: 'SOURCE_DERIVED' as const, depthWhy: `the depth of the zone the frame's returns stand in (${recess.id})` }
  })
  return { verges: out, notes }
}

/** A portal head continuing a balcony fascia shares its top and bottom lines. */
export function closePortalHeads(portalHeads: readonly PortalHeadV2[], balconies: readonly BalconyV2[]): { portalHeads: PortalHeadV2[]; notes: ClosureNote[] } {
  const notes: ClosureNote[] = []
  const out = portalHeads.map((p) => {
    const b = balconies.find((x) => x.id === p.continuesFromId)
    if (!b) return p
    const top = b.topY
    const bottom = round6(b.topY - b.thicknessM)
    if (Math.abs(p.y1 - top) > 0.1 || Math.abs(p.y0 - bottom) > 0.1) return p
    if (Math.abs(p.y1 - top) > 1e-6 || Math.abs(p.y0 - bottom) > 1e-6) notes.push({ subject: p.id, what: `band ${p.y0.toFixed(3)}..${p.y1.toFixed(3)} → ${bottom.toFixed(3)}..${top.toFixed(3)}`, why: `continues ${b.id}: one band, one top line and one soffit` })
    return { ...p, y0: bottom, y1: round6(top) }
  })
  return { portalHeads: out, notes }
}

// ---------------------------------------------------------------------------
// the facade graph
// ---------------------------------------------------------------------------

export function buildFacadeGraph(input: {
  returns: readonly ReturnWallV2[]
  verges: readonly VergeV2[]
  balconies: readonly BalconyV2[]
  railings: readonly RailingV2[]
  portalHeads: readonly PortalHeadV2[]
  terraces: readonly TerraceV2[]
  recesses: readonly RecessTopology[]
  levels: readonly LevelV2[]
  ends: ReadonlyMap<string, [BalconyEnd, BalconyEnd]>
  roofEaveY?: number
}): FacadeGraph {
  const nodes: FacadeGraphNode[] = []
  const edges: FacadeGraphEdge[] = []
  const levelOf = (i: number): LevelV2 | undefined => input.levels.find((l) => l.index === i)
  const recessOf = (side: Side, storey: number): RecessTopology | undefined => input.recesses.find((r) => r.side === side && r.storeyIndex === storey)
  for (const r of input.returns) {
    const l = levelOf(r.storeyIndex)
    if (!l) continue
    nodes.push({ id: r.id, kind: 'RETURN', featureId: r.featureId, facade: r.side, start: { x: r.start.x, y: l.elevation, z: r.start.z }, end: { x: r.end.x, y: l.elevation, z: r.end.z }, depthM: round6(Math.hypot(r.end.x - r.start.x, r.end.z - r.start.z)), termination: { start: 'WALL', end: 'FREE' } })
  }
  for (const v of input.verges) {
    nodes.push({ id: v.id, kind: 'VERGE', featureId: v.featureId, hostId: 'roof-main', facade: v.side, start: { x: 0, y: input.roofEaveY ?? 0, z: v.planeAt }, end: { x: 0, y: input.roofEaveY ?? 0, z: v.planeAt }, depthM: v.depthM, termination: { start: 'MEETS', end: 'MEETS' } })
    // The top returns of the frame continue as the verge: their tops die into its underside.
    const top = Math.max(...input.returns.filter((r) => r.side === v.side).map((r) => r.storeyIndex))
    for (const r of input.returns.filter((x) => x.side === v.side && x.storeyIndex === top)) {
      const depth = Math.hypot(r.end.x - r.start.x, r.end.z - r.start.z)
      edges.push({ from: r.id, to: v.id, kind: 'CONTINUES_TO', gapM: round6(Math.max(0, depth - v.depthM)), why: 'the return’s top follows the verge’s underside across the zone; any depth of return beyond the verge meets the plate instead' })
    }
  }
  for (const b of input.balconies) {
    if (b.kind !== 'BALCONY' || !b.side) continue
    const ax = alongIsX(b.side)
    const recess = recessOf(b.side, b.storeyIndex)
    const c = recess?.mouthAt ?? (ax ? b.z0 : b.x0)
    const e = input.ends.get(b.id)
    nodes.push({ id: b.id, kind: 'BALCONY_SLAB', featureId: b.featureId, facade: b.side, start: ax ? { x: b.x0, y: b.topY, z: c } : { x: c, y: b.topY, z: b.z0 }, end: ax ? { x: b.x1, y: b.topY, z: c } : { x: c, y: b.topY, z: b.z1 }, depthM: recess ? Math.abs(recess.mouthAt - recess.backAt) : undefined, termination: { start: e?.[0].kind ?? 'FREE', end: e?.[1].kind ?? 'FREE' } })
    for (const end of e ?? []) {
      if (!end.againstId) continue
      const kind: FacadeGraphEdge['kind'] = end.kind === 'MEETS' ? 'CONTINUES_TO' : 'TERMINATES_AT'
      const other = input.returns.find((r) => r.id === end.againstId)
      const gap = other ? Math.min(Math.abs(other.alongInterval[0] - end.at), Math.abs(other.alongInterval[1] - end.at)) : 0
      edges.push({ from: b.id, to: end.againstId, kind, gapM: round6(end.kind === 'CARRIES' ? 0 : gap), why: end.why })
    }
    const back = recess ? recess.backAt : c
    edges.push({ from: b.id, to: `${b.side.toLowerCase()} wall`, kind: 'MEETS_HOST', gapM: 0, why: `the slab's back edge is the ${b.side.toLowerCase()} wall face at ${back.toFixed(3)}` })
  }
  for (const p of input.portalHeads) {
    nodes.push({ id: p.id, kind: 'PORTAL_HEAD', featureId: p.featureId, hostId: `roof-${p.massId}`, facade: 'FRONT', start: { x: p.x0, y: p.y1, z: p.z0 }, end: { x: p.x1, y: p.y1, z: p.z0 }, depthM: round6(p.z1 - p.z0), termination: { start: p.continuesFromId ? 'MEETS' : 'FREE', end: 'WALL' } })
    if (p.continuesFromId) {
      const b = input.balconies.find((x) => x.id === p.continuesFromId)
      edges.push({ from: p.continuesFromId, to: p.id, kind: 'CONTINUES_TO', gapM: round6(b ? Math.abs(p.x0 - b.x1) : 0), why: 'one band across the portal: the balcony fascia continues as the garage roof edge' })
    }
    edges.push({ from: p.id, to: `roof-${p.massId}`, kind: 'MEETS_HOST', gapM: 0, why: 'the head is the roof’s own edge member' })
  }
  for (const r of input.railings) {
    const path = r.path ?? [r.start, r.end]
    nodes.push({ id: r.id, kind: 'RAILING', featureId: r.featureId, hostId: r.hostId, facade: (r.id.split('-')[1]?.toUpperCase() ?? 'FRONT') as Side, start: { x: path[0].x, y: r.baseY, z: path[0].z }, end: { x: path[path.length - 1].x, y: r.baseY, z: path[path.length - 1].z }, termination: { start: path.length > 2 ? 'TURNS' : 'WALL', end: path.length > 2 ? 'TURNS' : 'WALL' } })
    for (let i = 1; i + 1 < path.length; i += 1) edges.push({ from: r.id, to: r.id, kind: 'TURNS_AT', gapM: 0, why: `a corner post at (${path[i].x.toFixed(2)}, ${path[i].z.toFixed(2)})` })
    if (r.hostId) {
      const b = input.balconies.find((x) => x.id === r.hostId)
      edges.push({ from: r.id, to: r.hostId, kind: 'MEETS_HOST', gapM: round6(b ? Math.abs(r.baseY - b.topY) : 0), why: 'the balustrade stands on the slab it guards' })
    }
  }
  for (const t of input.terraces) {
    nodes.push({ id: t.id, kind: 'TERRACE', featureId: t.featureId, facade: t.side, start: { x: t.polygon[0].x, y: t.topY, z: t.polygon[0].z }, end: { x: t.polygon[1].x, y: t.topY, z: t.polygon[1].z }, termination: { start: 'WALL', end: 'WALL' } })
    for (const m of t.massIds) edges.push({ from: t.id, to: m, kind: 'MEETS_HOST', gapM: 0, why: 'the terrace lies against the body’s facade at the threshold' })
  }
  return { nodes, edges }
}
