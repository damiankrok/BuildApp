/**
 * The wall strip (BUILDPLAN-ANALYZER-005Q, N1) does not depend on the order things are read in or where the plan sits
 * on its sheet.
 *
 * A made-up plan: a 600 × 360 px ring of 18 px walls with one partition, registered at 0.026 m/px so a cell must be
 * 17.3 px — wider than the 17 px between the front wall's two faces — and three chains: the overall width, the overall
 * depth, and an inner chain that ticks on the front wall's inner face as well as its outer one. The body is cut on that
 * inner face, and the front wall is left outside it as a strip the chains dimension. The layout names the strip as the
 * building's own wall (`wallStripsOf`): an AMBIGUOUS gap for the front wall's outer face, the body's depth DERIVED
 * across it, and no recess, return or terrace read in it. Nothing here is a drawing of a real building.
 *
 * What is held is that this decision — which strips are walls, the gap's words, which spans lose MEASURED, what the
 * emitter writes for the ring and the mass — is the same when:
 *
 *  - the wall bands are handed to the pass reversed, rotated or shuffled (through the sheet cache, the one place a
 *    caller can give the pass its bands; the pixels, the wall thickness and the witness are the sheet's own);
 *  - the dimension chains are listed in another order;
 *  - the whole drawing and its chain ticks are moved across the sheet by whole pixels (a raster has no sub-pixel move;
 *    the gap id hashes the strip's pixel rectangle, so it moves with the drawing and only its words are compared);
 *  - the plan is drawn mirrored or turned a quarter: the body is cut on the wall's outer face (the band claim's tie
 *    goes to the lower pixel, which is not N1's), or the short body is named on the side the wall is drawn on.
 */
import { describe, expect, it } from 'vitest'
import { inferStructuralLayout, isWallStripZone, openFacesOf, planSheet, reconstructV2 } from '../src/index.js'
import type { PlanSheet, StructuralLayoutDraft, StructuralLayoutOptions } from '../src/index.js'
import type { DimensionChain } from '@buildapp/source-metrics'
import { PlanDrawing, render } from './transforms.js'
import type { Transform } from './transforms.js'
import { chain, graphOf, metricsOf, planFrame, registration } from './plan.js'

const FRAME = 'frame-plan'
const MPP = 0.026
const T = 18
const W = 760
const H = 520
const on = <X extends { frameId: string }>(x: X): X => ({ ...x, frameId: FRAME })
const OUTER_FACE = /^the outer face of the building’s (west|east|rear|front) wall$/

type Variant = { dx?: number; dy?: number; transform?: Transform; chains?: (cs: DimensionChain[]) => DimensionChain[]; bands?: (sheet: PlanSheet) => PlanSheet['bands'] }

/** The plan moved by (dx, dy) on a sheet grown by as much, drawn under `transform`, with its chains carried along. */
function scene(v: Variant = {}): StructuralLayoutOptions {
  const dx = v.dx ?? 0
  const dy = v.dy ?? 0
  const t = v.transform ?? 'id'
  const w = W + dx
  const h = H + dy
  const p = new PlanDrawing(w, h).ring(60 + dx, 60 + dy, 660 + dx, 420 + dy, T)
  p.wall(300 + dx, 60 + dy, 307 + dx, 420 + dy)
  p.clear(300 + dx, 200 + dy, 307 + dx, 240 + dy)
  // the chains' ticks, in the plan's own coordinates: x along the width, y along the depth (the inner chain ticks the
  // front wall's inner face, 403, and its outer face, 420)
  const xs = [60, 660].map((x) => x + dx)
  const ys = [60, 420].map((y) => y + dy)
  const ys2 = [60, 403, 420].map((y) => y + dy)
  // a transform carries ticks as `transforms.ts` does: a mirror reflects them across the sheet, a quarter turn swaps axes
  const turned = t === 'turn90' || t === 'turn270'
  const tx = (x: number): number => (t === 'mirrorX' ? w - x : t === 'turn270' ? w - x : x)
  const ty = (y: number): number => (t === 'mirrorY' ? h - y : t === 'turn90' ? h - y : y)
  const sorted = (a: number[]): number[] => [...a].sort((m, n) => m - n)
  const chains = turned
    ? [on(chain('cx', 'VERTICAL', sorted(xs.map(tx)), { baselinePx: 20 })), on(chain('cy', 'HORIZONTAL', sorted(ys.map(ty)), { baselinePx: 20 })), on(chain('cy2', 'HORIZONTAL', sorted(ys2.map(ty)), { baselinePx: 40 }))]
    : [on(chain('cx', 'HORIZONTAL', sorted(xs.map(tx)), { baselinePx: 20 })), on(chain('cy', 'VERTICAL', sorted(ys.map(ty)), { baselinePx: 20 })), on(chain('cy2', 'VERTICAL', sorted(ys2.map(ty)), { baselinePx: 40 }))]
  const size = turned ? { width: h, height: w } : { width: w, height: h }
  const frame = planFrame(FRAME, 'GROUND', size)
  const raster = render(p, t)
  const reg = { ...registration(FRAME), metresPerPixelX: MPP, metresPerPixelY: MPP }
  const options: StructuralLayoutOptions = { slug: 'wall-strip', sourcePackageId: 'src-test', sourcePackageHash: 'd'.repeat(64), graph: graphOf([frame]), metrics: metricsOf(v.chains ? v.chains(chains) : chains, [on(reg)]), raster: () => raster }
  if (!v.bands) return options
  // the pass's bands, reordered, through the sheet cache; everything else on the sheet is the sheet's own
  const sheet = planSheet(frame, options)
  if (!sheet) throw new Error('the plan did not decode')
  return { ...options, sheetCache: new Map([[FRAME, { ...sheet, bands: v.bands(sheet), decompositions: new Map() }]]) }
}

/** The N1 decision of one layout pass, in words and spans: no pixel position, so a moved drawing compares equal. */
function decisionOf(d: StructuralLayoutDraft): unknown {
  const gaps = d.unresolved.filter((g) => OUTER_FACE.test(g.what))
  return {
    gaps: gaps.map((g) => ({ what: g.what, reason: g.reason, status: g.status })),
    zones: d.footprintRegions.filter((r) => r.kind === 'ZONE').map((r) => ({ id: r.id, wallStrip: isWallStripZone(r.id, d.unresolved), w: r.pixelRect.x1 - r.pixelRect.x0, h: r.pixelRect.y1 - r.pixelRect.y0 })),
    masses: d.masses.map((m) => ({ width: [m.widthM.value, m.widthM.basis], depth: [m.depthM.value, m.depthM.basis], open: openFacesOf(m, d.unresolved).map((g) => g.what) })),
  }
}

/** The ids too, for the variants that leave every pixel where it was. */
const idsOf = (d: StructuralLayoutDraft): unknown => ({ gaps: d.unresolved.filter((g) => OUTER_FACE.test(g.what)).map((g) => g.id), why: d.masses.map((m) => m.why) })

/** A fixed permutation (a linear congruential walk), so a shuffle is the same shuffle on every run. */
function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const out = [...xs]
  let s = seed
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483648
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

describe('005Q the wall strip, as drawn', () => {
  const d = inferStructuralLayout(scene())

  it('names the front wall as an unresolved outer face, keeps its strip as a zone and takes MEASURED off the depth only', () => {
    expect(decisionOf(d)).toMatchObject({
      gaps: [{ what: 'the outer face of the building’s front wall', status: 'AMBIGUOUS' }],
      zones: [{ id: 'zone-max_z', wallStrip: true }],
      masses: [{ width: [expect.any(Number), 'MEASURED'], depth: [expect.any(Number), 'DERIVED'], open: ['the outer face of the building’s front wall'] }],
    })
  })
})

describe('005Q the wall strip does not depend on the order of the bands', () => {
  const base = inferStructuralLayout(scene())
  const bands = planSheet(planFrame(FRAME, 'GROUND', { width: W, height: H }), scene())?.bands ?? []

  it('the sheet has bands to reorder', () => {
    expect(bands.length).toBeGreaterThanOrEqual(4)
  })

  it('handed back in their own order through the cache, the decision is the pass’s own', () => {
    const d = inferStructuralLayout(scene({ bands: (s) => [...s.bands] }))
    expect(decisionOf(d)).toEqual(decisionOf(base))
    expect(idsOf(d)).toEqual(idsOf(base))
  })

  for (const [name, order] of [
    ['reversed', (s: PlanSheet) => [...s.bands].reverse()],
    ['rotated by one', (s: PlanSheet) => [...s.bands.slice(1), ...s.bands.slice(0, 1)]],
    ['shuffled (seed 7)', (s: PlanSheet) => shuffled(s.bands, 7)],
    ['shuffled (seed 1009)', (s: PlanSheet) => shuffled(s.bands, 1009)],
  ] as const) {
    it(`bands ${name}: the same strips, the same gap, the same bases`, () => {
      const d = inferStructuralLayout(scene({ bands: order }))
      expect(decisionOf(d)).toEqual(decisionOf(base))
      expect(idsOf(d)).toEqual(idsOf(base))
    })
  }
})

describe('005Q the wall strip does not depend on the order of the chains', () => {
  const base = inferStructuralLayout(scene())
  for (const [name, order] of [
    ['reversed', (cs: DimensionChain[]) => [...cs].reverse()],
    ['the inner chain first', (cs: DimensionChain[]) => [cs[2], cs[0], cs[1]]],
    ['the depth chains first', (cs: DimensionChain[]) => [cs[1], cs[2], cs[0]]],
  ] as const) {
    it(`chains ${name}: the same strips, the same gap, the same bases`, () => {
      const d = inferStructuralLayout(scene({ chains: order }))
      expect(decisionOf(d)).toEqual(decisionOf(base))
      expect(idsOf(d)).toEqual(idsOf(base))
    })
  }
})

describe('005Q the wall strip does not depend on where the plan sits on the sheet', () => {
  const base = inferStructuralLayout(scene())
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [37, 23],
  ] as const) {
    it(`moved by (${dx}, ${dy}) px: the same decision in the same words`, () => {
      const d = inferStructuralLayout(scene({ dx, dy }))
      expect(decisionOf(d)).toEqual(decisionOf(base))
    })
  }
})

describe('005Q the wall strip follows the wall when the plan is mirrored or turned', () => {
  // Which face of the front wall the body is cut on is not N1's: the band claim breaks the tie between the wall's two
  // faces towards the lower pixel, so a plan drawn with that wall on a sheet's low side is cut on its outer face and has
  // no strip. What N1 owes in every orientation is that the short body is never left unnamed: the span across the wall
  // is either the stated one and MEASURED with no gap, or a wall short of it, DERIVED, with exactly one gap on the side
  // the wall is drawn on and its strip read as the wall.
  const STATED_M = 18 // the depth chain's 360 px at the fixture's 5 cm/px
  const sideAfter: Record<Transform, string> = { id: 'front', mirrorX: 'front', mirrorY: 'rear', turn90: 'west', turn270: 'east' }
  const zoneOf: Record<string, string> = { front: 'zone-max_z', rear: 'zone-min_z', west: 'zone-min_x', east: 'zone-max_x' }
  const outcomes = new Set<string>()
  for (const t of ['id', 'mirrorX', 'mirrorY', 'turn90', 'turn270'] as const) {
    it(`${t}: the ${sideAfter[t]} wall is cut on its outer face, or named`, () => {
      const d = inferStructuralLayout(scene({ transform: t }))
      const side = sideAfter[t]
      const what = `the outer face of the building’s ${side} wall`
      const across = side === 'west' || side === 'east' ? 'width' : 'depth'
      const along = across === 'width' ? 'depth' : 'width'
      const decision = decisionOf(d) as { gaps: Array<{ what: string; status: string }>; zones: Array<{ id: string; wallStrip: boolean }>; masses: Array<Record<string, [number, string] | string[]>> }
      expect(decision.masses).toHaveLength(1)
      const [span, basis] = decision.masses[0][across] as [number, string]
      expect(decision.masses[0][along]).toEqual([30, 'MEASURED'])
      if (span === STATED_M) {
        outcomes.add('outer face')
        expect(basis).toBe('MEASURED')
        expect(decision.gaps).toEqual([])
        expect(decision.zones).toEqual([])
        expect(decision.masses[0].open).toEqual([])
      } else {
        outcomes.add('named')
        expect(span).toBeLessThan(STATED_M)
        expect(basis).toBe('DERIVED')
        expect(decision.gaps.map((g) => [g.what, g.status])).toEqual([[what, 'AMBIGUOUS']])
        expect(decision.zones.map((z) => [z.id, z.wallStrip])).toEqual([[zoneOf[side], true]])
        expect(decision.masses[0].open).toEqual([what])
      }
    })
  }

  it('the five orientations exercise both outcomes, so neither branch above is vacuous', () => {
    expect([...outcomes].sort()).toEqual(['named', 'outer face'])
  })
})

describe('005Q end to end, the emitted decision does not depend on chain order or placement', () => {
  /** What the solver writes for the strip: the gap, no terrace, the ring's and the mass's provenance, the open face. */
  const emitted = (v: Variant): unknown => {
    const r = reconstructV2({ label: 'wall-strip', ...scene(v) })
    const mass = r.featureGraph.solved.find((f) => f.family === 'MASS')
    return {
      gaps: r.unresolved.map((u) => u.what).filter((w) => OUTER_FACE.test(w)),
      terraces: r.model.terraces.map((t) => t.id),
      rings: r.model.wallRings.map((w) => w.evidence),
      mass: mass?.provenance,
      open: r.building.masses.map((m) => m.outerFacesOpen ?? []),
      zones: r.layout.footprintRegions.filter((f) => f.kind === 'ZONE').map((f) => f.id),
    }
  }
  const base = emitted({})

  it('as drawn: the gap, no terrace, a SOURCE_DERIVED ring that names the open face, a SOURCE_DERIVED mass', () => {
    expect(base).toMatchObject({
      gaps: ['the outer face of the building’s front wall'],
      terraces: [],
      rings: [{ status: 'SOURCE_DERIVED', interpretation: expect.stringMatching(/body cut on a wall's inner face; unresolved: the outer face of the building’s front wall$/) }],
      mass: 'SOURCE_DERIVED',
      open: [['the outer face of the building’s front wall']],
      zones: ['zone-max_z'],
    })
  })

  it('chains reversed: the same', () => {
    expect(emitted({ chains: (cs) => [...cs].reverse() })).toEqual(base)
  })

  it('moved by (37, 23) px: the same', () => {
    expect(emitted({ dx: 37, dy: 23 })).toEqual(base)
  })
})
