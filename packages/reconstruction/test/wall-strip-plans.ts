/**
 * Synthetic plans for the wall-strip tests (005Q, `wall-strip.test.ts`): a strip between the walled envelope and the
 * stated extent that is the building's own exterior wall, and the strips beside it that are not.
 *
 * Each fixture is a list of drawing operations and dimension chains in its own coordinates; `compileFixture` redraws
 * it under a transform (`transforms.ts`), carries the chains' ticks and baselines with it, and compiles it through the
 * solver it is handed — the production one in the test, the frozen one in the research driver that records what the
 * test exists to prevent. `outcomeOf` reduces a result to what the tests assert. Nothing here is a drawing of a real
 * building; every dimension is made up.
 */
import type { DimensionChain } from '@buildapp/source-metrics'
import { PlanDrawing, render } from './transforms.js'
import type { Transform } from './transforms.js'
import { chain, graphOf, metricsOf, planFrame, registration } from './plan.js'
import type { reconstructV2 } from '../src/index.js'

export const FRAME = 'frame-plan'

/** A chain in the fixture's own coordinates: its ticks along its axis and the row (or column) it is drawn on. */
export type ChainSpec = { id: string; axis: 'HORIZONTAL' | 'VERTICAL'; ticks: number[]; baseline: number }
export type Fixture = {
  p: PlanDrawing
  chains: ChainSpec[]
  /** Metres per pixel of the plan's registration (the chains' values are always 5 cm/px, `plan.ts`). */
  mpp?: number
  /** Review round 1: an anisotropic registration, metres per pixel along the sheet's x and y (overrides `mpp`). */
  mppXY?: [number, number]
}

/** The chain under `t`, in the transformed sheet's pixels (tick edges map as `transforms.ts` maps them). */
function chainUnder(c: ChainSpec, t: Transform, W: number, H: number): DimensionChain {
  const at = (x: number, y: number): [number, number] =>
    t === 'id' ? [x, y] : t === 'mirrorX' ? [W - x, y] : t === 'mirrorY' ? [x, H - y] : t === 'turn90' ? [H - y, x] : [y, W - x]
  const points = c.ticks.map((v) => (c.axis === 'HORIZONTAL' ? at(v, c.baseline) : at(c.baseline, v)))
  const turned = t === 'turn90' || t === 'turn270'
  const axis = turned ? (c.axis === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL') : c.axis
  const along = (pt: [number, number]): number => (axis === 'HORIZONTAL' ? pt[0] : pt[1])
  const across = (pt: [number, number]): number => (axis === 'HORIZONTAL' ? pt[1] : pt[0])
  return { ...chain(c.id, axis, points.map(along).sort((a, b) => a - b), { baselinePx: across(points[0]) }), frameId: FRAME }
}

/** The plan frame of the fixture drawn under `t`. */
export function fixtureFrame(f: Fixture, t: Transform = 'id'): ReturnType<typeof planFrame> {
  const turned = t === 'turn90' || t === 'turn270'
  return planFrame(FRAME, 'GROUND', turned ? { width: f.p.H, height: f.p.W } : { width: f.p.W, height: f.p.H })
}

/** The fixture drawn under `t`, as the options of a solve (`compileFixture`) or of one layout pass. */
export function fixtureOptions(f: Fixture, t: Transform = 'id') {
  const frame = fixtureFrame(f, t)
  const scaled = f.mppXY ?? (f.mpp === undefined ? undefined : [f.mpp, f.mpp])
  const anisotropy = scaled ? Math.max(...scaled) / Math.min(...scaled) : 1
  const reg = { ...registration(FRAME), ...(scaled === undefined ? {} : { metresPerPixelX: scaled[0], metresPerPixelY: scaled[1], anisotropy }) }
  return {
    slug: 'fixture',
    sourcePackageId: 'src-test',
    sourcePackageHash: 'd'.repeat(64),
    graph: graphOf([frame]),
    metrics: metricsOf(
      f.chains.map((c) => chainUnder(c, t, f.p.W, f.p.H)),
      [reg],
    ),
    raster: () => render(f.p, t),
  }
}

/** The fixture drawn under `t` and compiled by `solve`. */
export function compileFixture(solve: typeof reconstructV2, f: Fixture, t: Transform = 'id'): ReturnType<typeof reconstructV2> {
  return solve({ label: 'fixture', ...fixtureOptions(f, t) })
}

export const OUTER_FACE = (side: 'front' | 'rear' | 'west' | 'east'): string => `the outer face of the building’s ${side} wall`

/** What the tests assert about one compilation. */
export function outcomeOf(r: ReturnType<typeof reconstructV2>) {
  const ring = r.model.wallRings[0]?.evidence
  return {
    masses: r.building.masses.map((m) => [m.x0, m.z0, m.x1, m.z1]),
    world: { envelope: r.world.envelope, walled: r.world.walled, zFlip: r.world.zFlip },
    zones: r.layout.footprintRegions.filter((g) => g.kind === 'ZONE').map((g) => [g.id, g.pixelRect]),
    recessRegions: r.layout.footprintRegions.filter((g) => g.kind === 'RECESS').length,
    outerFaces: r.unresolved.map((u) => u.what).filter((w) => w.startsWith('the outer face of the building')),
    ringStatus: ring?.status,
    ringWhy: ring?.interpretation,
    terraces: r.building.terraces.map((x) => x.id),
    returns: r.building.returns.map((x) => x.id),
    recesses: r.building.recesses.map((x) => `${x.side}:${x.returns.length}`),
    layoutRecesses: r.layout.recesses.map((x) => `${x.mouthSide}:${x.returns.low ? 1 : 0}${x.returns.high ? 1 : 0}`),
    massBasis: r.layout.masses.map((m) => `${m.widthM.basis}/${m.depthM.basis}`),
    modelTerraces: r.model.terraces.length,
    modelWalls: r.model.walls.length,
    // review round 1: every body's ring and MASS feature (not only the first), the outlined platform a terrace carries,
    // and the platforms named instead of built
    ringStatuses: r.model.wallRings.map((w) => w.evidence?.status),
    massFeatures: r.featureGraph.solved.filter((x) => x.family === 'MASS').map((x) => x.provenance),
    terraceReach: r.building.terraces.map((x) => x.extension?.reach ?? null),
    platforms: r.unresolved.filter((u) => u.what.startsWith('the platform the plan outlines')).map((u) => u.what),
  }
}
export type Outcome = ReturnType<typeof outcomeOf>

// ---------------------------------------------------------------------------
// the fixtures: an 18 px-walled house, outer faces x 60..660, y 60..420 (inclusive rows), chains at 5 cm/px
// ---------------------------------------------------------------------------
export const W = 760
export const H = 600
export const T = 18
/** The registration's scale: 0.45 m (the decomposition's smallest cell) is 17.3 px, more than the 17 px face gap. */
export const MPP = 0.026

/** A partition with a doorway, thinner than the exterior walls. */
const partition = (p: PlanDrawing, bottom: number): PlanDrawing => p.wall(300, 60, 307, bottom).clear(300, 200, 307, 240)
/** The house: a ring of `t` px walls whose outer faces are x 60..660, y 60..`bottom`. */
export const house = (t = T, bottom = 420): PlanDrawing => partition(new PlanDrawing(W, H).ring(60, 60, 660, bottom, t), bottom)
/** The house without its south wall: the caller draws that facade. */
function openFront(bottom = 420): PlanDrawing {
  const p = new PlanDrawing(W, H).wall(60, 60, 660, 60 + T - 1).wall(60, 60, 60 + T - 1, bottom).wall(660 - T + 1, 60, 660, bottom)
  return partition(p, bottom)
}
/** Nine stall walls crossing the strip south of the house, each 18 px thick and 97 px long. */
function stalls(): PlanDrawing {
  const p = house()
  for (const x of [100, 163, 226, 288, 351, 414, 477, 539, 602]) p.wall(x, 424, x + T - 1, 520)
  return p
}
const cx = (ticks = [60, 660]): ChainSpec => ({ id: 'cx', axis: 'HORIZONTAL', ticks, baseline: 20 })
const cy = (ticks: number[]): ChainSpec => ({ id: 'cy', axis: 'VERTICAL', ticks, baseline: 20 })
const cy2 = (ticks: number[]): ChainSpec => ({ id: 'cy2', axis: 'VERTICAL', ticks, baseline: 40 })
/** The chains of the defect: overall to the outer faces, and an inner chain ticking on the south wall's inner face (403) and on its outer face. */
const facePairChains = (inner = 403, outer = 420): ChainSpec[] => [cx(), cy([60, outer]), cy2([60, inner, outer])]
/** The chains of a house with something beyond its south wall (at 420) out to `reach`. */
const beyondChains = (reach: number): ChainSpec[] => [cx(), cy([60, reach]), cy2([60, 420, reach])]

/**
 * A set-back niche: the south facade stands forward (outer face 420) for `forward` px from the west corner and set
 * back 17 px (outer face 403) for the rest, with a return between them.
 */
function stepped(forward: number): PlanDrawing {
  const p = openFront(402).wall(60, 60, 60 + T - 1, 420)
  const at = 60 + forward
  return p.wall(60, 403, at - 1, 420).wall(at - T, 385, at - 1, 420).wall(at - T, 385, 660, 402)
}

/** The 005N recessed entrance with its garage (12 px walls, 5 cm/px; `compound-facade-emission.test.ts`). */
function entrance(): PlanDrawing {
  const WALL = 12
  const p = new PlanDrawing(460, 400).ring(40, 40, 359, 279)
  const returnAt = (x: number, top: number): PlanDrawing => p.wall(x, top, x + WALL - 1, 279)
  const wallH = (a: number, b: number, y: number): PlanDrawing => p.wall(a, y, b, y + WALL - 1)
  const doorH = (a: number, b: number, y: number): PlanDrawing => p.clear(a, y, b, y + WALL - 1).line(a, y + 5, b, y + 5)
  p.clear(120, 268, 251, 279)
  returnAt(108, 150)
  returnAt(180, 150)
  wallH(108, 191, 228)
  doorH(135, 155, 228)
  wallH(108, 263, 150)
  returnAt(252, 150)
  doorH(210, 225, 150)
  return p.line(192, 276, 251, 276)
}
const entranceChains = (inner?: number, outer = 280): ChainSpec[] => [
  { id: 'cx', axis: 'HORIZONTAL', ticks: [40, 360], baseline: 20 },
  { id: 'cy', axis: 'VERTICAL', ticks: [40, outer], baseline: 20 },
  ...(inner === undefined ? [] : [{ id: 'cy2', axis: 'VERTICAL' as const, ticks: [40, inner, outer], baseline: 30 }]),
]

/**
 * Review round 1 (family 15). The hatch of an outlined platform: 45° lines `step` px apart, so a third of every row
 * across it is ink — drawn on, as `readTerraceExtension` wants the plan between a mouth and its outline to be.
 */
function hatch(p: PlanDrawing, x0: number, y0: number, x1: number, y1: number, step: number): PlanDrawing {
  for (let c = y0 - x1; c <= y1 - x0; c += step) {
    const a = Math.max(x0, y0 - c)
    const b = Math.min(x1, y1 - c)
    if (b >= a) p.line(a, a + c, b, b + c)
  }
  return p
}
/** An 8 px-walled house at the chains' own 5 cm/px (outer faces x 60..660, y 60..420), with a 4 px partition. */
const house8 = (): PlanDrawing => new PlanDrawing(W, H).ring(60, 60, 660, 420, 8).wall(300, 60, 303, 420).clear(300, 200, 303, 240)
/** The house's north, west and east walls (18 px) and a 13 px south wall, rows 408..420: thinner than the modal wall, still wall-thick (≥ 0.7). */
const thinFront = (): PlanDrawing => openFront().wall(60, 408, 660, 420)

/** Every fixture, by the family it belongs to. */
export const FIXTURES = {
  // 1. the defect: the inner chain's tick on the south wall's inner face takes the band; the body is cut there
  facePair: (): Fixture => ({ p: house(), chains: facePairChains(), mpp: MPP }),
  // 2. the chains tick on the outer face only: the body reaches it
  outerOnly: (): Fixture => ({ p: house(), chains: [cx(), cy([60, 420])], mpp: MPP }),
  // 3. thickness: a 10 px south wall (thinner than 0.7 of the 18 px walls) under the same inner tick; 24 px walls throughout at a finer scale
  thinWall: (): Fixture => ({ p: openFront().wall(60, 411, 660, 420), chains: facePairChains(411), mpp: MPP }),
  thickWalls: (): Fixture => ({ p: house(24), chains: facePairChains(397), mpp: 0.019 }),
  // 4. a pier: the house's south wall's outer face is 403; the strip to the stated 420 holds a 40 px pier, or a 120 px one
  shortPier: (): Fixture => ({ p: openFront(402).wall(60, 385, 660, 402).wall(300, 403, 339, 420), chains: facePairChains(), mpp: MPP }),
  longPier: (): Fixture => ({ p: openFront(402).wall(60, 385, 660, 402).wall(300, 403, 419, 420), chains: facePairChains(), mpp: MPP }),
  // 5. the window: every chain tick 0.2 px up or down; the wall thickened inward by 9 or 10 px past the tick
  ticksDown: (): Fixture => ({ p: house(), chains: facePairChains(402.8, 419.8), mpp: MPP }),
  ticksUp: (): Fixture => ({ p: house(), chains: facePairChains(403.2, 420.2), mpp: MPP }),
  inward9: (): Fixture => ({ p: house().wall(60, 394, 660, 420), chains: facePairChains(), mpp: MPP }),
  inward10: (): Fixture => ({ p: house().wall(60, 393, 660, 420), chains: facePairChains(), mpp: MPP }),
  // 6. a 3 m garage door (a gap with its leaf line) in the south wall, with the inner tick and without it
  garageDoor: (): Fixture => ({ p: house().clear(500, 403, 559, 420).line(500, 411, 559, 411), chains: facePairChains(), mpp: MPP }),
  garageDoorOuterOnly: (): Fixture => ({ p: house().clear(500, 403, 559, 420).line(500, 411, 559, 411), chains: [cx(), cy([60, 420])], mpp: MPP }),
  // 7. a set-back niche: the forward wall's band runs 154 px (25.7 % of the strip) or 144 px (24 %)
  stepAbove: (): Fixture => ({ p: stepped(190), chains: facePairChains(), mpp: MPP }),
  stepBelow: (): Fixture => ({ p: stepped(180), chains: facePairChains(), mpp: MPP }),
  // 8. an open terrace 80 px (4 m) deep beyond the south wall, outlined in thin lines
  openTerrace: (): Fixture => ({ p: house().line(60, 500, 660, 500).line(60, 421, 60, 500).line(660, 421, 660, 500), chains: beyondChains(500), mpp: MPP }),
  // 9. porch posts (16 px squares) on that terrace's edge; and posts in a 17 px strip in front of a house whose wall ends at 403
  porchPosts: (): Fixture => ({ p: house().line(60, 500, 660, 500).wall(60, 484, 75, 499).wall(352, 484, 367, 499).wall(645, 484, 660, 499), chains: beyondChains(500), mpp: MPP }),
  postsInStrip: (): Fixture => ({ p: house(T, 402).wall(60, 405, 75, 420).wall(352, 405, 367, 420).wall(645, 405, 660, 420), chains: facePairChains(), mpp: MPP }),
  // 10. a pergola: four thin lines and two 10 px posts beyond the south wall
  pergola: (): Fixture => ({ p: house().line(60, 440, 660, 440).line(60, 460, 660, 460).line(60, 480, 660, 480).line(60, 500, 660, 500).wall(60, 491, 69, 500).wall(651, 491, 660, 500), chains: beyondChains(500), mpp: MPP }),
  // 11. a carport: two wall-thick side walls 100 px (5 m) out from the south wall, nothing across the mouth
  carport: (): Fixture => ({ p: house().wall(400, 421, 417, 520).wall(560, 421, 577, 520), chains: beyondChains(520), mpp: MPP }),
  // 12. the 005N recessed entrance: as dimensioned there, and with an inner chain on the front wall's inner face at a scale that cuts the body on it
  entrance: (): Fixture => ({ p: entrance(), chains: entranceChains() }),
  entranceFacePair: (): Fixture => ({ p: entrance(), chains: entranceChains(268, 279), mpp: 0.04 }),
  // 13. the defect on the north wall: the inner tick two pixels short of the inner face (78), nearer the band's axis than the outer tick
  rearFacePair: (): Fixture => ({ p: house(), chains: [cx(), cy([60, 420]), cy2([60, 76, 420])], mpp: MPP }),
  // 14. the rule's reach (the 005Q mutation gates): one side, one body, one direction
  // the north-wall face pair beside an open terrace 80 px (4 m) deep beyond the south wall
  rearStripFrontTerrace: (): Fixture => ({ p: house().line(60, 500, 660, 500).line(60, 421, 60, 500).line(660, 421, 660, 500), chains: [cx(), cy([60, 500]), cy2([60, 76, 420, 500])], mpp: MPP }),
  // an L: a body cut on its south wall's inner face (x 60..400) beside a shallower wing (x 382..660, y 60..250) that stands nowhere near that face
  ell: (): Fixture => ({ p: partition(new PlanDrawing(W, H).ring(60, 60, 400, 420, T).ring(382, 60, 660, 250, T), 420), chains: [cx([60, 400, 660]), cy([60, 250, 420]), cy2([60, 403, 420])], mpp: MPP }),
  // nine wall-thick stall walls 5 m long crossing the strip beyond the south wall (27 % of its length in their thickness), clear of the house by 3 px
  stalls: (): Fixture => ({ p: stalls(), chains: beyondChains(520), mpp: MPP }),
  // 15. review round 1
  // (a) two bodies on a stepped front: the house (x 60..400) cut on its south wall's inner face (403), and a garage
  // walled on its own (x 382..660, y 250..402) whose south wall's OUTER face is the envelope line 403, with no wall ink
  // in front of it; a chain of its own states the garage's depth to that face
  twoBodies: (): Fixture => ({
    p: partition(new PlanDrawing(W, H).ring(60, 60, 400, 420, T).ring(382, 250, 660, 402, T), 420),
    chains: [cx([60, 400, 660]), cy([60, 250, 420]), cy2([60, 403, 420]), { id: 'cy3', axis: 'VERTICAL', ticks: [250, 403], baseline: 720 }],
    mpp: MPP,
  }),
  // (a) the face distance: the same house with the garage (x 382..660) run back to y 200, so that the layout's widest
  // body is the front slab x 60..660, y 200..403 and the house's rear (x 60..400, y 60..200) is a body of its own —
  // over the covered stretch along the side, its south face 203 px short of the strip
  bodyBehind: (): Fixture => ({
    p: partition(new PlanDrawing(W, H).ring(60, 60, 400, 420, T).ring(382, 200, 660, 402, T), 420),
    chains: [cx([60, 400, 660]), cy([60, 200, 420]), cy2([60, 403, 420])],
    mpp: MPP,
  }),
  // (b) the face pair on an 8 px wall at the chains' own scale (the 9 px cell drops the outer face 7 px off the inner
  // tick), and an outlined, hatched platform 80 px (4 m) beyond the south wall's outer face
  facePairPlatform: (): Fixture => ({ p: hatch(house8().line(60, 500, 660, 500).line(60, 421, 60, 500).line(660, 421, 660, 500), 61, 424, 659, 497, 3), chains: [cx(), cy([60, 420]), cy2([60, 413, 420])] }),
  // (c) a 13 px south wall bracketed by two ticks that tie on it at 0.022 m/px (a 20.5 px cell): the inner one 2 px
  // short of its inner face (406), the outer one 5 px past its outer face (425) — the strip is 19 px deep, 6 px more
  // than the band (window 5) — and the outer one 4 px past it (424): 18 px, 5 more, inside the window
  thinFrontFloating: (): Fixture => ({ p: thinFront(), chains: [cx(), cy([60, 425]), cy2([60, 406, 425])], mpp: 0.022 }),
  thinFrontFilled: (): Fixture => ({ p: thinFront(), chains: [cx(), cy([60, 424]), cy2([60, 406, 424])], mpp: 0.022 }),
  // (d) family 1 under an anisotropic registration: 0.02 m/px across the strip, 0.026 m/px along it (the cell is still
  // 17.3 px); and the same turned so that the strip is the east one (draw it with `turn270`)
  facePairAniso: (): Fixture => ({ p: house(), chains: facePairChains(), mppXY: [0.026, 0.02] }),
  facePairAnisoTurned: (): Fixture => ({ p: house(), chains: facePairChains(), mppXY: [0.02, 0.026] }),
  // 16. review round 2 (R2A-1/R2A-2, the platform probe of F4)
  // (a) an L of 8 px walls at the chains' own scale: the house (x 60..400) cut on its south wall's inner face (413), a
  // shallower wing (x 392..660, y 60..250) standing nowhere near that face, and an outlined, hatched platform 80 px
  // (4 m) deep beyond the south wall in front of the house only (x 60..400): the bodies standing on the strip's back
  // span 17 of the strip's 30 m, so only a probe across them finds the outline
  ellPlatform: (): Fixture => ({
    p: hatch(new PlanDrawing(W, H).ring(60, 60, 400, 420, 8).ring(392, 60, 660, 250, 8).wall(300, 60, 303, 420).clear(300, 200, 303, 240).line(60, 500, 400, 500).line(60, 421, 60, 500).line(400, 421, 400, 500), 61, 424, 399, 497, 3),
    chains: [cx([60, 400, 660]), cy([60, 250, 420]), cy2([60, 413, 420])],
  }),
  // (b) the face pair on the north wall of the 8 px house (the inner tick 2 px short of its inner face, 66), with an
  // outlined, hatched platform 80 px (4 m) beyond its outer face (rows 60..-20 do not fit: the house is drawn 100 px
  // lower, outer faces y 160..520, the platform y 80..159)
  rearFacePairPlatform: (): Fixture => ({
    p: hatch(new PlanDrawing(W, H).ring(60, 160, 660, 520, 8).wall(300, 160, 303, 520).clear(300, 300, 303, 340).line(60, 80, 660, 80).line(60, 80, 60, 159).line(660, 80, 660, 159), 61, 83, 659, 156, 3),
    chains: [cx(), cy([160, 520]), cy2([160, 166, 520])],
  }),
  // (c) a real terrace zone 80 px (4 m) deep beyond the 8 px house's south wall, outlined, and a hatched platform
  // outlined beyond that zone's mouth (y 504..577, its edge at 580): no wall strip anywhere
  terraceZonePlatform: (): Fixture => ({
    p: hatch(house8().line(60, 500, 660, 500).line(60, 421, 60, 500).line(660, 421, 660, 500).line(60, 580, 660, 580).line(60, 501, 60, 580).line(660, 501, 660, 580), 61, 504, 659, 577, 3),
    chains: beyondChains(500),
  }),
} satisfies Record<string, () => Fixture>
export type FixtureName = keyof typeof FIXTURES
