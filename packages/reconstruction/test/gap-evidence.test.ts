/**
 * BUILDPLAN-ANALYZER-005K — per-gap evidence records and the experimental drawn-gap rule.
 *
 * Every fixture is drawn in code at 5 cm/px with 12 px (0.6 m) walls; none is a drawing of any real building. A
 * facade runs y = 100..111 (axis 105.5) with a gap between two stretches of wall.
 *
 * What is held:
 *  - a gap the boundary leaves WEAK keeps the trace of how it was read, and the boundary record carries a
 *    source-addressable record of it (decomposition id, coordinates, crop and its ink hash, strokes, signatures,
 *    rules, decisions) — the same drawing gives the same records whatever order its lines and gaps are read in;
 *  - the drawn-gap rule is OFF unless asked for, and OFF changes no decision;
 *  - ON, it upgrades only a gap between two stretches of wall-thick ink with a line drawn across it inside the wall,
 *    within a lintel's span — never a blank mouth, a dashed stretch, a post's gap, a wide paving edge, or a line drawn
 *    from ink that is not a wall's;
 *  - its decisions do not move when the drawing moves on the sheet (no position, id or width is special).
 */
import { describe, expect, it } from 'vitest'
import { runLengthBands } from '@buildapp/source-cv'
import type { Raster } from '@buildapp/source-cv'
import { bandWallThickness, boundaryExtension, decomposePlan, drawnGapCheck, gapEvidenceRecords, planExtent, readWallLine, solidLayer, wallWitness } from '../src/index.js'
import type { BoundaryGap, WallLine, WallLineOptions } from '../src/index.js'
import { BLACK, drawLine, fillRect } from '../../source-cv/test/draw.js'
import { WALL, chain, mask, registration, sheet } from './plan.js'
import { BANDS, clear, post, ring, run, wall } from './boundary-plan.js'

const WHITE: [number, number, number] = [255, 255, 255]
const OPTS: WallLineOptions = { wallPx: WALL, mppAlong: 0.05, maxOpeningM: 3.2, maxWideOpeningM: 8 }
const ON: WallLineOptions = { ...OPTS, drawnGapRule: 'ON' }

/** A facade y = 100..111 with a gap [from, to] between two stretches of wall; `dx`, `dy` move the whole drawing. */
const facade = (from: number, to: number, dx = 0, dy = 0): Raster => {
  const r = sheet(460, 260)
  wall(r, 20 + dx, 100 + dy, from - 1 + dx, 111 + dy)
  wall(r, to + 1 + dx, 100 + dy, 399 + dx, 111 + dy)
  return r
}
const gapsOn = (r: Raster, y: number, options: WallLineOptions = OPTS): BoundaryGap[] => {
  const m = mask(r)
  return readWallLine(m, solidLayer(m, WALL), 'Y', y, 0, r.width - 1, options).gaps
}
/** The one gap of a facade fixture, read with the rule OFF and ON. */
const both = (r: Raster, y = 106): { off: BoundaryGap; on: BoundaryGap } => ({ off: gapsOn(r, y)[0], on: gapsOn(r, y, ON)[0] })

describe('005K §8 a WEAK gap keeps the trace of how it was read', () => {
  it('a 1.0 m gap with one line at the wall face: the trace says what is drawn, where the axis came from and how much wall stands at the jambs', () => {
    const r = facade(150, 169)
    drawLine(r, 150, 110, 169, 110, BLACK)
    const [g] = gapsOn(r, 106)
    expect(g).toMatchObject({ signature: 'LEAF_FACE', cls: 'UNKNOWN_GAP', boundary: 'WEAK' })
    expect(g.trace).toMatchObject({ axisFrom: 'BOTH', jambAlong: [true, true], signatureRaw: 'LEAF_FACE', signatureLoose: 'LEAF_FACE', patternAcross: false, runsPast: false, widthRule: 'LINTEL', classified: { cls: 'UNKNOWN_GAP', boundary: 'WEAK' }, reasons: ['FACE_OR_DASHED_LINE_WITHIN_LINTEL'] })
    expect(g.trace?.axisPx).toBeCloseTo(105.5, 0)
    for (const ink of g.trace?.jambInk ?? []) expect(ink).toBeGreaterThanOrEqual(0.9)
    expect(g.trace?.bandInk).toBeLessThan(0.2)
    expect(g.trace?.drawnGapRule).toMatchObject({ wallJambs: true, alongJambs: true, withinLintel: true, drawn: true, drawnVia: 'SIGNATURE', inWallBand: true, jambInk: true, eligible: true })
  })

  it('a STRONG or NONE gap carries its trace and reason, and no drawn-gap check', () => {
    const glazed = facade(150, 189)
    drawLine(glazed, 150, 103, 189, 103, BLACK)
    drawLine(glazed, 150, 108, 189, 108, BLACK)
    const [g] = gapsOn(glazed, 106)
    expect(g).toMatchObject({ boundary: 'STRONG', trace: { reasons: ['GLAZING'], classified: { boundary: 'STRONG' } } })
    expect(g.trace?.drawnGapRule).toBeUndefined()
    const wide = facade(100, 199)
    const [w] = gapsOn(wide, 106)
    expect(w).toMatchObject({ boundary: 'NONE', trace: { reasons: ['WALL_STOPS_WIDER_THAN_LINTEL'], widthRule: 'WIDE' } })
  })
})

describe('005K §19 the drawn-gap rule is OFF unless asked for', () => {
  it('OFF leaves every decision as it was; ON upgrades the eligible gap and names the rule', () => {
    const r = facade(150, 169)
    drawLine(r, 150, 110, 169, 110, BLACK)
    const { off, on } = both(r)
    expect(off).toMatchObject({ cls: 'UNKNOWN_GAP', boundary: 'WEAK' })
    expect(gapsOn(r, 106, { ...OPTS, drawnGapRule: 'OFF' })[0]).toEqual(off)
    expect(on).toMatchObject({ cls: 'OPENING_SUPPORTED', boundary: 'STRONG', occupancy: 'OPENING' })
    expect(on.trace?.reasons).toEqual(['FACE_OR_DASHED_LINE_WITHIN_LINTEL', 'DRAWN_GAP_UPGRADE'])
    expect(on.trace?.classified).toEqual({ cls: 'UNKNOWN_GAP', boundary: 'WEAK' })
    // the rule changes the decision and nothing it was read from
    const read = (g: BoundaryGap): Partial<BoundaryGap> => {
      const { cls: _cls, boundary: _boundary, occupancy: _occupancy, why: _why, trace: _trace, ...rest } = g
      return rest
    }
    expect(read(on)).toEqual(read(off))
  })

  it('a line drawn across the gap but running on past a jamb (a paving edge on the face row) qualifies only within a lintel’s span', () => {
    const narrow = facade(150, 189)
    drawLine(narrow, 0, 110, 459, 110, BLACK)
    const n = gapsOn(narrow, 106)[0]
    expect(n.boundary).toBe('WEAK')
    expect(n.trace?.drawnGapRule?.drawnVia).toBe(n.trace?.signatureRaw === 'LEAF_FACE' ? 'SIGNATURE' : 'WITHOUT_RUNS_PAST')
    // 4 m between two stretches of wall, a line running past both jambs: a paving edge in front of a porch or a carport
    const wide = facade(100, 179)
    drawLine(wide, 0, 110, 459, 110, BLACK)
    const { off, on } = both(wide)
    expect(off).toMatchObject({ boundary: 'WEAK', trace: { reasons: ['INFILL_RUNS_PAST_JAMB'], runsPast: true } })
    expect(off.trace?.drawnGapRule).toMatchObject({ withinLintel: false, eligible: false })
    expect(on.boundary).toBe('WEAK')
  })
})

describe('005K §20 hard negatives: the rule never bridges these', () => {
  it('M1 safety: a blank door-sized gap — a doorway or the mouth of a recess — is never drawn evidence', () => {
    const { off, on } = both(facade(150, 169))
    expect(off).toMatchObject({ signature: 'BLANK', boundary: 'WEAK', trace: { reasons: ['NOTHING_DRAWN_WITHIN_LINTEL'] } })
    expect(off.trace?.drawnGapRule).toMatchObject({ drawn: false, drawnVia: null, eligible: false })
    expect(on).toMatchObject({ boundary: 'WEAK', cls: 'UNKNOWN_GAP' })
  })

  it('a dashed line across the gap (an overhead element, a room-internal dashed stretch) is not drawn infill', () => {
    const r = facade(150, 189)
    for (let x = 150; x <= 186; x += 5) drawLine(r, x, 106, x + 3, 106, BLACK)
    const { off, on } = both(r)
    expect(off.signature).toBe('DASHED')
    expect(off.trace?.drawnGapRule).toMatchObject({ drawn: false, eligible: false })
    expect(on.boundary).toBe('WEAK')
  })

  it('a line from a free-standing post is not a hole in a wall', () => {
    const r = sheet(460, 260)
    post(r, 140, 105)
    wall(r, 170, 100, 399, 111)
    drawLine(r, 149, 110, 169, 110, BLACK)
    const g = gapsOn(r, 106).find((x) => x.fromPx >= 145 && x.toPx <= 175)
    expect(g?.jambs).toContain('POST')
    expect(gapsOn(r, 106, ON).find((x) => x.fromPx >= 145 && x.toPx <= 175)?.boundary).not.toBe('STRONG')
    if (g?.trace?.drawnGapRule) expect(g.trace.drawnGapRule).toMatchObject({ wallJambs: false, eligible: false })
  })

  it('M2 phantom: a line drawn from ink that is not wall-thick at the jamb (a porous, hatched end) is not upgraded', () => {
    const r = facade(150, 169)
    // the left stretch's last 12 px: dense enough for the line reader, broken every 3 px, so nothing wall-thick survives
    clear(r, 138, 100, 149, 111)
    fillRect(r, 138, 100, 149, 111, BLACK)
    for (let y = 100; y <= 111; y += 3) for (let x = 138; x <= 149; x += 3) fillRect(r, x, y, x, y, WHITE)
    drawLine(r, 150, 110, 169, 110, BLACK)
    const { off, on } = both(r)
    expect(off.jambs).toEqual(['WALL', 'WALL'])
    expect(off.trace?.jambInk[0]).toBeLessThan(0.8)
    expect(off.trace?.drawnGapRule).toMatchObject({ drawn: true, inWallBand: true, jambInk: false, eligible: false })
    expect(on.boundary).toBe('WEAK')
  })

  it('a line through a room between the cross-sections of two walls crossing it has no wall to have a hole in', () => {
    const r = sheet(460, 260)
    wall(r, 100, 40, 111, 200)
    wall(r, 220, 40, 231, 200)
    drawLine(r, 112, 106, 219, 106, BLACK)
    const g = gapsOn(r, 106).find((x) => x.fromPx >= 105 && x.toPx <= 225)
    if (g) {
      expect(g.boundary).not.toBe('STRONG')
      if (g.trace?.drawnGapRule) expect(g.trace.drawnGapRule.alongJambs).toBe(false)
      expect(gapsOn(r, 106, ON).find((x) => x.fromPx >= 105 && x.toPx <= 225)?.boundary).toBe(g.boundary)
    }
  })

  it('a pattern the gap sits in (tiles across both faces) counts as drawn only through the reading before the pattern override — measured apart', () => {
    const r = facade(150, 199)
    for (let y = 94; y <= 118; y += 6) drawLine(r, 150, y, 199, y, BLACK)
    const [g] = gapsOn(r, 106)
    expect(g.signature).toBe('DASHED')
    expect(g.trace).toMatchObject({ signatureRaw: 'GLAZING', patternAcross: true })
    expect(g.trace?.drawnGapRule?.drawnVia).toBe('BEFORE_PATTERN')
  })
})

describe('005K §4 / M4 the rule knows no position, id or width', () => {
  it('moving the drawing on the sheet moves the gaps and changes no decision', () => {
    const decisions = (dx: number, dy: number) => {
      const r = facade(150, 169, dx, dy)
      drawLine(r, 150 + dx, 110 + dy, 169 + dx, 110 + dy, BLACK)
      const blank = facade(250, 266, dx, dy)
      return [...gapsOn(r, 106 + dy, ON), ...gapsOn(blank, 106 + dy, ON)].map((g) => [g.signature, g.cls, g.boundary, g.trace?.reasons.join('>'), g.trace?.drawnGapRule?.eligible ?? null, g.widthM])
    }
    const base = decisions(0, 0)
    for (const [dx, dy] of [[7, 3], [31, 17], [-11, 23]]) expect(decisions(dx, dy)).toEqual(base)
  })

  it('the check is a function of the gap’s own reading: the same reading gives the same answer whatever its id', () => {
    const r = facade(150, 169)
    drawLine(r, 150, 110, 169, 110, BLACK)
    const [g] = gapsOn(r, 106)
    const trace = g.trace as NonNullable<BoundaryGap['trace']>
    expect(drawnGapCheck({ ...g, id: 'gap-Y-0-0-0' } as BoundaryGap, trace, 3.2)).toEqual(drawnGapCheck(g, trace, 3.2))
  })
})

/** A 16 × 12 m house (outer faces x 40..359, y 40..279) whose south wall has a 1.0 m gap with a line at its outer face. */
const house = (): Raster => {
  const r = sheet(420, 340)
  ring(r, 40, 40, 359, 279)
  clear(r, 180, 268, 199, 279)
  drawLine(r, 180, 277, 199, 277, BLACK)
  clear(r, 260, 268, 277, 279)
  return r
}
const X = [40, 360]
const Y = [40, 280]

describe('005K §8–§9 the boundary record carries one source-addressable record per WEAK gap', () => {
  it('records name the decomposition, the coordinates, the crop and its ink hash, and the decisions', () => {
    const { d } = run(house(), X, Y)
    const b = d.boundary
    expect(b?.version).toBe('1.2.0')
    expect(b?.decompositionId).toMatch(/^dec-[0-9a-f]{16}$/)
    expect(b?.drawnGapRule).toBe('OFF')
    const rec = b?.gapEvidence.find((g) => g.axis === 'Y' && g.fromPx >= 178 && g.toPx <= 202)
    expect(rec).toBeDefined()
    if (!rec) return
    expect(rec).toMatchObject({ decompositionId: b?.decompositionId, signature: 'LEAF_FACE', classified: { boundary: 'WEAK' }, final: { boundary: 'WEAK' }, drawnGapRule: { mode: 'OFF', upgraded: false, check: { eligible: true } } })
    expect(rec.widthM).toBeCloseTo(1.0, 1)
    expect(rec.start.y).toBe(rec.axisPx)
    expect(rec.end.x - rec.start.x).toBeCloseTo(rec.widthPx, 6)
    expect(rec.inkCropSha256).toMatch(/^[0-9a-f]{64}$/)
    // the crop reaches at least 1.5 m past the gap on every side the frame allows
    expect(rec.crop.x0).toBeLessThanOrEqual(rec.fromPx - 30)
    expect(rec.crop.x1).toBeGreaterThanOrEqual(rec.toPx + 30)
    expect(rec.crop.y0).toBeLessThanOrEqual(rec.axisPx - 30)
    expect(['BRIDGED_WEAK', 'POCKET_MOUTH', 'NOT_REACHED']).toContain(rec.outline)
    // the blank doorway is recorded too, and never eligible
    const blank = b?.gapEvidence.find((g) => g.axis === 'Y' && g.fromPx >= 258 && g.toPx <= 280)
    expect(blank).toMatchObject({ signature: 'BLANK', drawnGapRule: { check: { eligible: false } } })
  })

  it('the same drawing gives the same records, byte for byte; the rule ON keeps the reading’s identity and marks the upgrade', () => {
    const first = run(house(), X, Y).d.boundary
    const again = run(house(), X, Y).d.boundary
    expect(JSON.stringify(again?.gapEvidence)).toBe(JSON.stringify(first?.gapEvidence))
    const on = run(house(), X, Y, [], { drawnGapRule: 'ON' }).d.boundary
    expect(on?.drawnGapRule).toBe('ON')
    expect(on?.decompositionId).toBe(first?.decompositionId)
    const upgraded = on?.gapEvidence.filter((g) => g.drawnGapRule.upgraded) ?? []
    expect(upgraded.map((g) => g.gapId)).toEqual(first?.gapEvidence.filter((g) => g.drawnGapRule.check?.eligible).map((g) => g.gapId))
    for (const g of upgraded) expect(g).toMatchObject({ classified: { boundary: 'WEAK' }, final: { boundary: 'STRONG', cls: 'OPENING_SUPPORTED' } })
  })

  it('§27 order invariance: lines and gaps read in any order give the same records', () => {
    const r = house()
    const m = mask(r)
    const bands = runLengthBands(m, BANDS)
    const wallPx = bandWallThickness(bands, WALL)
    const chains = [chain('cx', 'HORIZONTAL', X, { baselinePx: 12 }), chain('cy', 'VERTICAL', Y, { baselinePx: 12 })]
    const extent = planExtent(chains, bands, wallPx, wallWitness(bands, wallPx, m))
    if (!extent) throw new Error('the fixture has no frame')
    const reg = registration()
    const incumbent = decomposePlan(m, chains, bands, reg, extent.rect, { openingAware: false, sheetWallPx: WALL })
    const ext = boundaryExtension(m, bands, reg, extent.rect, incumbent, { sheetWallPx: WALL })
    const input = { mask: m, mppX: reg.metresPerPixelX, mppY: reg.metresPerPixelY, wallPx: WALL, decompositionId: 'dec-test', outline: ext.outline, drawnGapRule: 'OFF' as const }
    const canonical = gapEvidenceRecords({ ...input, wallsX: ext.walls.x, wallsY: ext.walls.y })
    expect(canonical.records.length).toBeGreaterThan(0)
    const shuffle = (lines: readonly WallLine[]): WallLine[] => [...lines].reverse().map((l) => ({ ...l, gaps: [...l.gaps].reverse() }))
    expect(gapEvidenceRecords({ ...input, wallsX: shuffle(ext.walls.y), wallsY: shuffle(ext.walls.x) })).toEqual(canonical)
    expect(gapEvidenceRecords({ ...input, wallsX: shuffle(ext.walls.x), wallsY: shuffle(ext.walls.y) })).toEqual(canonical)
  })
})
