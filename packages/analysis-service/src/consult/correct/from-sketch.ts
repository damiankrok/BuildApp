/**
 * v3.54.16 — the sketch's typed elements as proposals, directly: no drawing them to a picture for the shape reader to
 * guess again. A sketch is an API reading of ONE original elevation in that elevation's own frame pixels; each of its
 * openings and chimneys becomes a proposal of the shared registry, bound and judged like a reviewer's — by the
 * registration of that frame and by the original picture (`source-gate.ts`), never by its agreement with the model.
 *
 * Matching is one to one: a sketch opening and a model opening are paired by the largest overlap first, each used once.
 * A pair that disagrees (place, size, height or kind) is an UPDATE of the model's opening; a sketch opening without a
 * partner is an ADD; a model opening without one is left alone — a sketch that misses an opening is not evidence that
 * the opening is not there. A stack already standing over the same stretch of the side is not proposed again.
 *
 * v3.54.16 audit A2 (1.1.0): the sketch's polygon is kept as a shape — a raked head's two ends travel with the
 * proposal (`headLeftY` / `headRightY`) — and the kind is compared exactly (a door, a glazed door and a garage door
 * are three kinds, not "not a window"). A pair that agrees in box but not in head or kind is an UPDATE.
 */
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { ElevationSketch } from '../../appearance/elevation-sketch.js'
import { iou, isRaked } from './source-gate.js'
import type { Box, Shape } from './source-gate.js'
import { kindOfOpening, openingBoxes, openingSpan, OVERHANG_MIN_CHANGE_M, preferredView, shapeOfOpening, sideOfFacade, sideOfWall, sideRoof } from './execute.js'

const openingSideWalls = (m: CanonicalBuildingModel, side: Side): string[] => m.walls.filter((w) => w.kind === 'EXTERIOR' && sideOfWall(m, w) === side).map((w) => w.id)
import type { BindView, CorrectionProposal, Side } from './execute.js'

export const SKETCH_PROPOSALS_VERSION = '1.7.0' as const
/** Below this overlap a model opening and a sketch opening are two different openings. */
export const PAIR_MIN_IOU = 0.1
/** At or above this overlap (and the same kind) a pair agrees: nothing to propose. */
export const AGREE_IOU = 0.8

const bbox = (poly: ReadonlyArray<readonly [number, number]>): Box => ({ x0: Math.min(...poly.map((p) => p[0])), y0: Math.min(...poly.map((p) => p[1])), x1: Math.max(...poly.map((p) => p[0])), y1: Math.max(...poly.map((p) => p[1])) })
/** The polygon's top at the bbox's left and right columns: a raked head when they differ by ≥ 2 px and 4 % of its height. */
export function headOf(poly: ReadonlyArray<readonly [number, number]>): { headLeftY: number; headRightY: number } | undefined {
  if (poly.length < 3) return undefined
  const b = bbox(poly)
  const topAt = (x: number): number | undefined => {
    const ys: number[] = []
    for (let i = 0; i < poly.length; i += 1) {
      const [ax, ay] = poly[i]
      const [bx, by] = poly[(i + 1) % poly.length]
      if ((ax - x) * (bx - x) > 0) continue
      if (ax === bx) ys.push(Math.min(ay, by))
      else ys.push(ay + ((by - ay) * (x - ax)) / (bx - ax))
    }
    return ys.length > 0 ? Math.min(...ys) : undefined
  }
  const l = topAt(b.x0)
  const r = topAt(b.x1)
  if (l === undefined || r === undefined) return undefined
  return Math.abs(l - r) >= Math.max(2, 0.04 * (b.y1 - b.y0)) ? { headLeftY: Math.round(l * 10) / 10, headRightY: Math.round(r * 10) / 10 } : undefined
}

/** An opening's span hidden on its side by another exterior wall standing further out over the same stretch. */
function occluded(m: CanonicalBuildingModel, sp: NonNullable<ReturnType<typeof openingSpan>>): boolean {
  const ax = sp.side === 'FRONT' || sp.side === 'REAR' ? 'x' : 'z'
  const perp = ax === 'x' ? 'z' : 'x'
  const out = sp.side === 'REAR' || sp.side === 'RIGHT' ? 1 : -1
  const face = sp.wall.start[perp]
  return m.walls.some((w) => {
    if (w.kind !== 'EXTERIOR' || w.id === sp.wall.id || Math.abs(w.start[perp] - w.end[perp]) > 1e-3) return false
    if ((w.start[perp] - face) * out <= 0.05) return false
    const lo = Math.min(w.start[ax], w.end[ax])
    const hi = Math.max(w.start[ax], w.end[ax])
    return Math.min(hi, sp.a1) - Math.max(lo, sp.a0) > 0.05
  })
}

/** v3.54.19: a glazing whose foot stands no higher than this above the storey's floor reaches the floor. */
export const GLAZED_WALL_FLOOR_M = 0.35
const KIND: Record<string, 'WINDOW' | 'DOOR' | 'GLAZED_DOOR' | 'GARAGE_DOOR' | undefined> = { WINDOW: 'WINDOW', DOOR: 'DOOR', GLAZED_DOOR: 'GLAZED_DOOR', GATE: 'GARAGE_DOOR' }

/**
 * v3.54.18: the sketch's wall finish zones as SET_FINISH proposals — for a side whose walls carry no finish region yet
 * (a body built without LOCAL, a side the finish consumer did not reach): each visible zone of a known finish, by its own
 * outline, through the registration of that frame. Largest first, so a small accent zone is laid over the wall it is on.
 */
export function finishProposalsFromSketch(s: ElevationSketch, facade: string, model: CanonicalBuildingModel, views: readonly BindView[], baseRevision: string, sideOf?: Side): { proposals: CorrectionProposal[]; skipped: Array<{ sketchId: string; why: string }> } {
  const side = sideOf ?? sideOfFacade(facade)
  const view = preferredView(views, s.frameId, side) ?? (sideOf ? undefined : preferredView(views, s.frameId))
  if (!view) return { proposals: [], skipped: [] }
  const wallIds = new Set(model.walls.filter((w) => w.kind === 'EXTERIOR').map((w) => w.id))
  const onSide = new Set(openingSideWalls(model, view.side))
  const has = model.surfaceRegions.some((r) => wallIds.has((r as { hostId?: string }).hostId ?? '') && onSide.has((r as { hostId?: string }).hostId ?? ''))
  if (has) return { proposals: [], skipped: [{ sketchId: s.sketchId, why: `the ${view.side.toLowerCase()} side's walls already carry finish regions: the sketch's zones are not laid twice` }] }
  const area = (poly: ReadonlyArray<readonly [number, number]>): number => Math.abs(poly.reduce((a, q, i) => a + q[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * q[1], 0)) / 2
  const out: CorrectionProposal[] = []
  const skipped: Array<{ sketchId: string; why: string }> = []
  for (const w of [...s.walls].sort((a, b) => area(b.polygon) - area(a.polygon))) {
    if (!(['LIGHT_RENDER', 'DARK_RENDER', 'TIMBER', 'BRICK'] as string[]).includes(w.class)) {
      skipped.push({ sketchId: w.id, why: `${w.class}: no finish class of the registry takes it (named, not painted)` })
      continue
    }
    if (w.visibility !== 'VISIBLE' && w.visibility !== 'PARTLY_OCCLUDED') {
      skipped.push({ sketchId: w.id, why: `${w.visibility}: a zone the drawing does not show is not painted from it` })
      continue
    }
    out.push({ proposalId: `sk:${s.frameId.slice(-10)}:finish:${w.id}`, baseRevision, operation: 'SET_FINISH', targetId: view.side, frameId: s.frameId, patch: { box: bbox(w.polygon), outline: w.polygon.map((q) => [q[0], q[1]] as [number, number]), material: w.class as 'LIGHT_RENDER' }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws a ${w.class} zone (${w.id})` })
  }
  return { proposals: out, skipped }
}

/**
 * v3.54.18 — FACADE ADOPTION. The source gate judges one element at a time, and on a rendered elevation it cannot always:
 * a model opening that straddles a cladding boundary scores as "something drawn" (Alaska's long side: z 27 for a phantom
 * across the edge of the timber zone), and an update of a wide phantom to the real window inside it ties (z 6.8 against
 * 6.5). The decision is then taken for the facade as a whole, on evidence that is not the reading's own word: the reading
 * of an elevation is ADOPTED when the picture supports at least `minSupportedShare` of the openings it draws (each one
 * committed through the gate, or already standing in the model) and refutes none. On an adopted facade the elements the
 * picture left undecided follow the reading; a model opening the picture seems to support is removed only where the
 * reading explains those edges by a finish-zone boundary it draws through the opening's box. Adopted elements are applied
 * and marked NOT source-verified. A reading the picture refutes anywhere, or supports on too little, adopts nothing.
 */
export const FACADE_ADOPTION = { minOpenings: 2, minSupportedShare: 0.6 } as const
export type FacadeAdoption = { frameId: string; side?: Side; drawn: number; supported: number; refuted: number; pending: number; decision: 'ADOPTED' | 'NOT_ADOPTED' | 'NOTHING_PENDING' | 'NOT_REGISTERED'; why: string; proposals: CorrectionProposal[] }
/** `fate`: the last status the executor gave the proposal about a sketch opening (`open:<id>`) or about removing a model opening (`rem:<id>`). */
export function facadeAdoption(s: ElevationSketch, facade: string, model: CanonicalBuildingModel, views: readonly BindView[], baseRevision: string, fate: (key: string) => string | undefined, sideOf?: Side): FacadeAdoption {
  const acc = proposalsFromSketch(s, facade, model, views, baseRevision, sideOf)
  const side = sideOf ?? sideOfFacade(facade)
  const view = preferredView(views, s.frameId, side) ?? (sideOf ? undefined : preferredView(views, s.frameId))
  const base = { frameId: s.frameId, ...(acc.side ? { side: acc.side as Side } : {}) }
  if (!view) return { ...base, drawn: 0, supported: 0, refuted: 0, pending: 0, decision: 'NOT_REGISTERED', why: 'the elevation is registered to no side', proposals: [] }
  const sketchId = (q: CorrectionProposal): string => q.proposalId.replace(/@\w+$/, '').split(':').slice(3).join(':')
  const openings = acc.proposals.filter((q) => q.operation === 'ADD_OPENING' || q.operation === 'UPDATE_OPENING')
  const removals = acc.proposals.filter((q) => q.operation === 'REMOVE_OPENING')
  const refuted = openings.filter((q) => fate(`open:${sketchId(q)}`) === 'REJECTED_BY_SOURCE')
  const pending = openings.filter((q) => fate(`open:${sketchId(q)}`) !== 'REJECTED_BY_SOURCE')
  // supported: standing in the model as drawn, or a proposal the picture itself supports (z ≥ 2) that only ties with the model's element
  const supported = acc.agreed.length + pending.filter((q) => fate(`open:${sketchId(q)}`) === 'UNDECIDED_BUT_SUPPORTED').length
  const drawn = supported + openings.length
  const counts = { drawn, supported, refuted: refuted.length, pending: pending.length }
  const open = removals.filter((q) => fate(`rem:${q.targetId}`) !== 'COMMITTED')
  if (pending.length === 0 && open.length === 0) return { ...base, ...counts, decision: 'NOTHING_PENDING', why: `every opening the reading draws stands (${supported} of ${drawn}) and it leaves no model opening in question`, proposals: [] }
  if (drawn < FACADE_ADOPTION.minOpenings) return { ...base, ...counts, decision: 'NOT_ADOPTED', why: `the reading draws ${drawn} opening(s) here: too few to adopt a facade on (fewer than ${FACADE_ADOPTION.minOpenings})`, proposals: [] }
  if (refuted.length > 0) return { ...base, ...counts, decision: 'NOT_ADOPTED', why: `the picture refutes ${refuted.length} of the reading's ${drawn} opening(s) (${refuted.map(sketchId).join(', ')}): a reading contradicted by its own picture is not adopted`, proposals: [] }
  if (supported / drawn < FACADE_ADOPTION.minSupportedShare) return { ...base, ...counts, decision: 'NOT_ADOPTED', why: `the picture supports ${supported} of the reading's ${drawn} opening(s) (${Math.round((100 * supported) / drawn)} %, below ${FACADE_ADOPTION.minSupportedShare * 100} %): the rest stay undecided, by name`, proposals: [] }
  // what the reading explains: a model opening whose box lies across the boundary of two finish zones it draws
  const polyArea = (poly: ReadonlyArray<readonly [number, number]>): number => Math.abs(poly.reduce((a, q, i) => a + q[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * q[1], 0)) / 2
  const inPoly = (poly: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
    return c
  }
  const zones = s.walls.map((w, i) => ({ i, id: w.id, cls: w.class, poly: w.polygon, a: polyArea(w.polygon) })).sort((a, b) => a.a - b.a)
  const boxes = new Map(openingBoxes(model, view).map((o) => [o.id, o.box]))
  const explains = (modelId: string): string | undefined => {
    const b = boxes.get(modelId)
    if (!b) return undefined
    const seen = new Map<string, number>()
    for (let u = 0; u < 5; u += 1) for (let v = 0; v < 5; v += 1) {
      const x = b.x0 + ((u + 0.5) * (b.x1 - b.x0)) / 5
      const y = b.y0 + ((v + 0.5) * (b.y1 - b.y0)) / 5
      const z = zones.find((q) => inPoly(q.poly, x, y))
      const key = z ? `${z.cls} zone ${z.id}` : 'no wall zone'
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    const parts = [...seen.entries()].filter(([, n]) => n >= 3)
    if (parts.length >= 2) return `its box lies across what the reading draws as ${parts.map(([k]) => k).join(' and ')}`
    // or another element the reading draws stands in the box (a downpipe at a wall end, a post, a canopy, steps): the
    // picture's edges there are that element's — not a stack, which stands on the roof
    const hit = s.elements.filter((e) => e.kind !== 'CHIMNEY').find((e) => {
      const q = bbox(e.polygon)
      const ix = Math.min(q.x1, b.x1) - Math.max(q.x0, b.x0)
      const iy = Math.min(q.y1, b.y1) - Math.max(q.y0, b.y0)
      return ix > 0 && iy > 0 && (iy >= 0.5 * (b.y1 - b.y0) || ix >= 0.5 * (b.x1 - b.x0))
    })
    return hit ? `the reading draws ${hit.kind} (${hit.id}) through its box` : undefined
  }
  const out: CorrectionProposal[] = []
  for (const q of open) {
    const st = fate(`rem:${q.targetId}`)
    const why = st === 'REJECTED_BY_SOURCE' ? explains(q.targetId) : undefined
    if (st === 'REJECTED_BY_SOURCE' && !why) continue
    out.push({ ...q, proposalId: `${q.proposalId}@adopt`, patch: { ...(q.patch ?? {}), adopt: true as const, ...(why ? { explained: why } : {}) } })
  }
  for (const q of pending) out.push({ ...q, proposalId: `${q.proposalId}@adopt`, patch: { ...(q.patch ?? {}), adopt: true as const } })
  return { ...base, ...counts, decision: 'ADOPTED', why: `the picture supports ${supported} of the ${drawn} opening(s) the reading draws on this side (${Math.round((100 * supported) / drawn)} %) and refutes none: the ${pending.length} it left undecided and ${out.length - pending.length} model opening(s) the reading does not draw follow the reading (applied, not source-verified)`, proposals: out }
}

export type SketchProposalAccount = { sketchId: string; frameId: string; side?: string; proposals: CorrectionProposal[]; agreed: Array<{ sketchId: string; modelId: string; iou: number }>; skipped: Array<{ sketchId: string; why: string }> }

/** `sideOf` (v3.54.17 R3): the side this elevation shows when the orientation hypothesis says it is not its label's. */
export function proposalsFromSketch(s: ElevationSketch, facade: string, model: CanonicalBuildingModel, views: readonly BindView[], baseRevision: string, sideOf?: Side): SketchProposalAccount {
  const side = sideOf ?? sideOfFacade(facade)
  const view = preferredView(views, s.frameId, side) ?? (sideOf ? undefined : preferredView(views, s.frameId))
  const out: SketchProposalAccount = { sketchId: s.sketchId, frameId: s.frameId, ...(side ? { side } : {}), proposals: [], agreed: [], skipped: [] }
  if (!view) {
    out.skipped.push({ sketchId: s.sketchId, why: 'its elevation is not registered to a side: nothing of it can be placed (an ASSIGN_VIEW could register it)' })
    return out
  }
  const modelBoxes = openingBoxes(model, view)
  // v3.54.17 R3: an opening drawn on a roof surface and on no wall zone (a roof window, a skylight) is not a wall opening;
  // a window in a gable's triangle is in the gable wall's zone and stays one
  const inside = (poly: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
    return c
  }
  const inRoof = (o: { polygon: ReadonlyArray<readonly [number, number]> }): boolean => {
    const b = bbox(o.polygon)
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    return s.roofs.some((r) => inside(r.polygon, cx, cy)) && !s.walls.some((w) => inside(w.polygon, cx, cy))
  }
  // v3.54.18: a window drawn on a roof surface is a roof window — its own operation (the slope seen face-on places it);
  // any other kind drawn there (a door on a roof) is named and left
  for (const o of s.openings) if (inRoof(o)) {
    if (o.kind === 'WINDOW') out.proposals.push({ proposalId: `sk:${s.frameId.slice(-10)}:roofwin:${o.id}`, baseRevision, operation: 'ADD_ROOF_WINDOW', targetId: view.side, frameId: s.frameId, patch: { box: bbox(o.polygon) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${o.id} on the roof and on no wall: a window in the slope` })
    else out.skipped.push({ sketchId: o.id, why: `${o.kind} drawn on the roof and on no wall: not an opening of a wall, and not a roof window` })
  }
  const sketchOpenings = s.openings.filter((o) => !inRoof(o)).map((o) => {
    const head = headOf(o.polygon)
    const box = bbox(o.polygon)
    // v3.54.19: a GLAZED_WALL (a glazing the reading does not call a window or a door) had no consumer and was dropped
    // with its polygon. Its kind follows from where it stands: reaching down to the floor it is a glazed door (a terrace
    // glazing), standing on a sill a window — the same shape and place either way, read from the same polygon
    const sillM = (view.projection.zeroRow - box.y1) * (view.projection.mppV ?? view.projection.mpp)
    return { o, box, head, shape: (head ? { ...box, ...head } : box) as Shape, kind: KIND[o.kind] ?? (o.kind === 'GLAZED_WALL' ? (sillM <= GLAZED_WALL_FLOOR_M ? ('GLAZED_DOOR' as const) : ('WINDOW' as const)) : undefined) }
  })
  const modelShape = (id: string): Shape | undefined => {
    const op = model.openings.find((x) => x.id === id)
    return op ? shapeOfOpening(model, op, view) : undefined
  }
  const sameHead = (a: Shape, b: Shape | undefined): boolean => {
    if (!b || isRaked(a) !== isRaked(b)) return false
    if (!isRaked(a)) return true
    const tol = Math.max(2, 0.04 * (a.y1 - a.y0))
    return Math.abs((a.headLeftY as number) - (b.headLeftY as number)) <= tol && Math.abs((a.headRightY as number) - (b.headRightY as number)) <= tol
  }
  // one to one, the largest overlap first
  const pairs = sketchOpenings.flatMap((so, i) => modelBoxes.map((mb, j) => ({ i, j, v: iou(so.box, mb.box) }))).filter((p) => p.v >= PAIR_MIN_IOU).sort((a, b) => b.v - a.v)
  const usedS = new Set<number>()
  const usedM = new Set<number>()
  const pid = (what: string, id: string): string => `sk:${s.frameId.slice(-10)}:${what}:${id}`
  const chosen: Array<{ i: number; j: number; v: number }> = []
  for (const p of pairs) {
    if (usedS.has(p.i) || usedM.has(p.j)) continue
    usedS.add(p.i)
    usedM.add(p.j)
    chosen.push(p)
  }
  // v3.54.17 R3: one opening of the sketch over several of the model (two windows that are one glazed band in the
  // source): the model openings it covers (most of their area) that pair with nothing are absorbed by its update; a
  // sketch opening that pairs with none of them updates the largest it covers. Never more than the sketch covers.
  const area = (b: { x0: number; y0: number; x1: number; y1: number }): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  const coverOf = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): number => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) }) / Math.max(1e-9, area(b))
  const ABSORB_COVER = 0.6
  const absorbsOf = new Map<number, string[]>()
  sketchOpenings.forEach((so, i) => {
    if (!so.kind) return
    const covered = modelBoxes.map((mb, j) => ({ mb, j })).filter(({ j, mb }) => !usedM.has(j) && coverOf(so.box, mb.box) >= ABSORB_COVER)
    if (covered.length === 0) return
    if (!usedS.has(i)) {
      // no pair: the largest covered opening is the one updated
      const biggest = covered.reduce((a, c) => (area(c.mb.box) > area(a.mb.box) ? c : a))
      usedS.add(i)
      usedM.add(biggest.j)
      chosen.push({ i, j: biggest.j, v: iou(so.box, biggest.mb.box) })
      covered.splice(covered.indexOf(biggest), 1)
    }
    for (const c of covered) usedM.add(c.j)
    if (covered.length) absorbsOf.set(i, covered.map((c) => c.mb.id))
  })
  // v3.54.18: model openings a sketch opening overlaps without being paired with or absorbed by it (the reading does not
  // draw them): named on the proposal, so the executor can let a supported opening take the stretch they stand on
  const displacesOf = (i: number, pairedJ?: number): string[] => {
    const so = sketchOpenings[i]
    const taken = new Set([...(pairedJ !== undefined ? [modelBoxes[pairedJ].id] : []), ...(absorbsOf.get(i) ?? [])])
    return modelBoxes.filter((mb) => !taken.has(mb.id) && !chosen.some((c) => modelBoxes[c.j].id === mb.id) && area({ x0: Math.max(so.box.x0, mb.box.x0), y0: Math.max(so.box.y0, mb.box.y0), x1: Math.min(so.box.x1, mb.box.x1), y1: Math.min(so.box.y1, mb.box.y1) }) > 0).map((mb) => mb.id)
  }
  for (const p of chosen) {
    const so = sketchOpenings[p.i]
    const mb = modelBoxes[p.j]
    const absorbs = absorbsOf.get(p.i) ?? []
    if (!so.kind) {
      out.skipped.push({ sketchId: so.o.id, why: `${so.o.kind}: no opening kind of the registry takes it` })
      continue
    }
    const modelKind = kindOfOpening(model, mb.id)
    const sameKind = so.kind === modelKind
    const headAgrees = sameHead(so.shape, modelShape(mb.id))
    if (p.v >= AGREE_IOU && sameKind && headAgrees && absorbs.length === 0) {
      out.agreed.push({ sketchId: so.o.id, modelId: mb.id, iou: Math.round(p.v * 1000) / 1000 })
      continue
    }
    const diffs = [...(p.v < AGREE_IOU ? [`overlap ${p.v.toFixed(2)}`] : []), ...(sameKind ? [] : [`kind ${modelKind ?? '?'} → ${so.kind}`]), ...(headAgrees ? [] : [so.head ? 'a raked head' : 'a level head']), ...(absorbs.length ? [`one opening over ${[mb.id, ...absorbs].join(' + ')}`] : [])]
    out.proposals.push({ proposalId: pid('upd', so.o.id), baseRevision, operation: 'UPDATE_OPENING', targetId: mb.id, frameId: s.frameId, patch: { box: so.box, kind: so.kind, ...(so.head ?? {}), ...(absorbs.length ? { absorbs } : {}), ...(displacesOf(p.i, p.j).length ? { displaces: displacesOf(p.i, p.j) } : {}) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}) where the model's ${mb.id} stands differently (${diffs.join(', ')})` })
  }
  // v3.54.17 R3: a model opening the sketch pairs with nothing is put to the ORIGINAL picture (REMOVE_OPENING: removed only
  // where the source shows nothing distinct in its box) — first, so the sketch's own openings are placed after it. Not
  // proposed when the sketch draws no opening at all on this side, nor for an opening another body stands in front of here,
  // nor where the sketch draws no VISIBLE wall zone over the opening.
  if (sketchOpenings.length > 0) {
    const removals: CorrectionProposal[] = []
    modelBoxes.forEach((mb, j) => {
      if (usedM.has(j)) return
      const op = model.openings.find((x) => x.id === mb.id)
      const sp = op ? openingSpan(model, op) : undefined
      if (!sp || occluded(model, sp)) {
        out.skipped.push({ sketchId: mb.id, why: sp ? 'another body stands in front of it on this side: the drawing does not show it' : 'not on an exterior side' })
        return
      }
      // absence is evidence only on a wall the sketch says it SEES there: no visible wall zone over the opening, no removal
      const cx = (mb.box.x0 + mb.box.x1) / 2
      const cy = (mb.box.y0 + mb.box.y1) / 2
      if (!s.walls.some((w) => w.visibility === 'VISIBLE' && inside(w.polygon, cx, cy))) {
        out.skipped.push({ sketchId: mb.id, why: 'the sketch draws no visible wall where the model has this opening: its absence says nothing' })
        return
      }
      removals.push({ proposalId: pid('rem', mb.id), baseRevision, operation: 'REMOVE_OPENING', targetId: mb.id, frameId: s.frameId, patch: {}, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws no opening where the model has ${mb.id}; the original picture decides` })
    })
    out.proposals.unshift(...removals)
  }
  sketchOpenings.forEach((so, i) => {
    if (usedS.has(i)) return
    if (!so.kind) {
      out.skipped.push({ sketchId: so.o.id, why: `${so.o.kind}: no opening kind of the registry takes it` })
      return
    }
    out.proposals.push({ proposalId: pid('add', so.o.id), baseRevision, operation: 'ADD_OPENING', targetId: view.side, frameId: s.frameId, patch: { box: so.box, kind: so.kind, ...(so.head ?? {}), ...(displacesOf(i).length ? { displaces: displacesOf(i) } : {}) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws ${so.o.id} (${so.o.kind}); the model has no opening there` })
  })
  for (const e of s.elements.filter((x) => x.kind === 'CHIMNEY')) {
    out.proposals.push({ proposalId: pid('chimney', e.id), baseRevision, operation: 'ADD_CHIMNEY', targetId: view.side, frameId: s.frameId, patch: { box: bbox(e.polygon) }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws a chimney (${e.id})` })
  }
  // v3.54.17 R3: the main roof's overhang — the drawn roof's ends past the drawn walls' outer corners, through the same
  // registration (SET_ROOF_OVERHANG; the binder reads both ends, checks them and the walls against the side's)
  const roof = sideRoof(model, view.side)
  if (roof && s.roofs.length > 0 && s.walls.length > 0) {
    const area = (poly: ReadonlyArray<readonly [number, number]>): number => Math.abs(poly.reduce((a, q, i) => a + q[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * q[1], 0)) / 2
    const main = [...s.roofs].sort((a, b) => area(b.polygon) - area(a.polygon))[0].polygon
    const rx = main.map((q) => q[0])
    const wx = s.walls.flatMap((w) => w.polygon.map((q) => q[0]))
    const [roofLeftX, roofRightX, wallLeftX, wallRightX] = [Math.min(...rx), Math.max(...rx), Math.min(...wx), Math.max(...wx)]
    const drawn = ((wallLeftX - roofLeftX + roofRightX - wallRightX) / 2) * view.projection.mpp
    if (Math.abs(drawn - roof.overhang) >= OVERHANG_MIN_CHANGE_M) out.proposals.push({ proposalId: pid('overhang', roof.id), baseRevision, operation: 'SET_ROOF_OVERHANG', targetId: roof.id, frameId: s.frameId, patch: { roofLeftX, roofRightX, wallLeftX, wallRightX }, origin: 'SKETCH', uncertainty: 'MEDIUM', justification: `the sketch of this elevation draws the roof ${(((wallLeftX - roofLeftX) * view.projection.mpp)).toFixed(2)} / ${(((roofRightX - wallRightX) * view.projection.mpp)).toFixed(2)} m past the walls; the model's ${roof.id} has ${roof.overhang.toFixed(2)} m` })
  }
  for (const e of s.elements.filter((x) => x.kind !== 'CHIMNEY' && x.kind !== 'GUTTER_DOWNPIPE')) out.skipped.push({ sketchId: e.id, why: `${e.kind}: UNSUPPORTED_OPERATION — no consumer of this element in registry 1.0.0 (named, not corrected)` })
  return out
}
