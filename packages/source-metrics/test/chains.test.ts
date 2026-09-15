import { describe, expect, it } from 'vitest'
import { Canvas } from '@buildapp/synthetic-drawings'
import { assignTokens, chainsFromLines, findDimensionLines, findStraightRuns, parseNumber, readNumbers, readingLattice, solveFrameChains, toCentimetres } from '../src/index.js'
import { adaptiveInkMask, inkChannel } from '@buildapp/source-cv'

/**
 * A synthetic dimension chain, drawn the way a sheet draws one: a rule with
 * slash ticks where each measurement ends, and the number above the span it
 * measures. `scale` is centimetres per pixel — the answer the solver has to
 * recover without being told.
 */
function drawChain(c: Canvas, options: { y: number; x0: number; values: number[]; scale: number; capHeight?: number; extraTickAt?: number; label?: (v: number) => string }): number[] {
  const cap = options.capHeight ?? 16
  let x = options.x0
  const ticks = [x]
  c.tick(x, options.y, 'HORIZONTAL')
  for (const value of options.values) {
    const span = value / options.scale
    const text = (options.label ?? String)(value)
    const width = c.textWidth(text, cap)
    c.text(text, x + span / 2 - width / 2, options.y - cap - 5, cap, { slant: 0.18 })
    c.line(x, options.y, x + span, options.y, 1)
    x += span
    c.tick(x, options.y, 'HORIZONTAL')
    ticks.push(x)
  }
  if (options.extraTickAt !== undefined) c.tick(options.extraTickAt, options.y, 'HORIZONTAL')
  return ticks
}

const solve = (c: Canvas) => {
  const raster = c.toRaster()
  const mask = adaptiveInkMask(inkChannel(raster), {})
  const chains = chainsFromLines(findDimensionLines(mask))
  const tokens = readNumbers(raster).tokens
  return { chains, tokens, ...solveFrameChains(chains, tokens) }
}

describe('dimension lines', () => {
  it('finds a rule and the marks that cross it, and ignores the number printed above it', () => {
    const c = new Canvas(600, 220)
    drawChain(c, { y: 120, x0: 60, values: [790, 415], scale: 2.6 })
    const lines = findDimensionLines(adaptiveInkMask(inkChannel(c.toRaster()), {}))
    const chain = lines.find((l) => l.axis === 'HORIZONTAL' && Math.abs(l.baselinePx - 120) < 2)
    expect(chain, lines.map((l) => `${l.axis}@${l.baselinePx}x${l.ticksPx.length}`).join(' ')).toBeDefined()
    expect(chain?.ticksPx).toHaveLength(3)
  })

  it('a rule with nothing crossing it is not a chain, but it is still a straight run', () => {
    const c = new Canvas(600, 220)
    c.line(60, 120, 500, 120, 1)
    const mask = adaptiveInkMask(inkChannel(c.toRaster()), {})
    expect(findDimensionLines(mask).filter((l) => Math.abs(l.baselinePx - 120) < 2)).toEqual([])
    expect(findStraightRuns(mask).some((l) => Math.abs(l.baselinePx - 120) < 2)).toBe(true)
  })
})

describe('the chain solver', () => {
  it('recovers the sheet scale and every printed value from a two-part chain', () => {
    const c = new Canvas(620, 240)
    drawChain(c, { y: 140, x0: 60, values: [790, 415], scale: 2.6 })
    const { scaleX, solved } = solve(c)
    expect(scaleX).toBeGreaterThan(2.55)
    expect(scaleX).toBeLessThan(2.65)
    const chain = solved.find((s) => s.readSegments === 2)
    expect(chain).toBeDefined()
    expect(chain?.segments.map((s) => s.valueCm)).toEqual([790, 415])
    expect(chain?.derivedTotalCm).toBe(1205)
    expect(chain?.residualPx).toBeLessThan(1.5)
  })

  it('derives the total of a chain whose parts are printed, without the total being printed anywhere', () => {
    const c = new Canvas(900, 260)
    drawChain(c, { y: 160, x0: 60, values: [100, 510, 750, 100], scale: 2.6 })
    const { solved } = solve(c)
    const chain = solved.find((s) => s.segments.length === 4)
    expect(chain?.segments.map((s) => s.valueCm)).toEqual([100, 510, 750, 100])
    expect(chain?.derivedTotalCm).toBe(1460)
  })

  it('corrects a misread digit when the rest of the chain disagrees with it, and records what it rejected', () => {
    // A chain of three where the middle number is deliberately set as a value
    // the scale refuses: the solver must prefer a runner-up reading that fits.
    const c = new Canvas(900, 260)
    drawChain(c, { y: 160, x0: 60, values: [300, 510, 300], scale: 2.6 })
    const { solved } = solve(c)
    const chain = solved.find((s) => s.segments.length === 3)
    expect(chain?.segments.map((s) => s.valueCm)).toEqual([300, 510, 300])
    for (const s of chain?.segments ?? []) expect(Math.abs(s.residualPx ?? 0)).toBeLessThan(1.5)
  })

  it('forgives a spurious tick: a mark no measurement respects is not a division', () => {
    const c = new Canvas(900, 260)
    drawChain(c, { y: 160, x0: 60, values: [100, 510, 750], scale: 2.6, extraTickAt: 60 + (100 + 200) / 2.6 })
    const { solved } = solve(c)
    const chain = solved.find((s) => s.segments.some((g) => g.valueCm === 510))
    expect(chain, 'a chain reading 510 across the spurious mark').toBeDefined()
    expect(chain?.skippedTicks.length).toBeGreaterThan(0)
    expect(chain?.segments.map((s) => s.valueCm)).toContain(750)
  })

  it('refuses to invent: a chain nothing on the sheet corroborates yields no values at all', () => {
    const c = new Canvas(620, 240)
    // A rule with ticks and no numbers anywhere.
    c.line(60, 140, 500, 140, 1)
    c.tick(60, 140, 'HORIZONTAL')
    c.tick(260, 140, 'HORIZONTAL')
    c.tick(500, 140, 'HORIZONTAL')
    const { solved } = solve(c)
    for (const s of solved) {
      expect(s.readSegments).toBe(0)
      for (const g of s.segments) expect(g.valueCm).toBeUndefined()
    }
  })

  it('gives each number to one chain: stacked chains do not both claim the overall dimension', () => {
    const c = new Canvas(700, 300)
    drawChain(c, { y: 90, x0: 60, values: [1205], scale: 2.6 })
    drawChain(c, { y: 150, x0: 60, values: [790, 415], scale: 2.6 })
    const { chains, tokens } = solve(c)
    const assigned = assignTokens(chains, tokens)
    const counts = assigned.map((list) => list.length).filter((n) => n > 0)
    expect(counts).toEqual([1, 2])
  })

  it('a vertical chain is read the same way, with its numbers turned a quarter turn', () => {
    const c = new Canvas(420, 900)
    const scale = 2.6
    let y = 100
    c.tick(140, y, 'VERTICAL')
    for (const value of [100, 510, 750]) {
      const span = value / scale
      c.text(String(value), 140 - 24, y + span / 2 + c.textWidth(String(value), 16) / 2, 16, { rotate: 'CW' })
      c.line(140, y, 140, y + span, 1)
      y += span
      c.tick(140, y, 'VERTICAL')
    }
    const { solved } = solve(c)
    const chain = solved.find((s) => s.readSegments >= 2)
    expect(chain, 'a solved vertical chain').toBeDefined()
    expect(chain?.segments.map((s) => s.valueCm)).toEqual([100, 510, 750])
  })

  it('one scale for the sheet: a chain with a single number is settled by the chains around it', () => {
    const c = new Canvas(900, 400)
    drawChain(c, { y: 100, x0: 60, values: [300, 510, 300], scale: 2.6 })
    drawChain(c, { y: 250, x0: 60, values: [1110], scale: 2.6 })
    const { scaleX, solved, votes } = solve(c)
    expect(votes[0].chains).toBeGreaterThanOrEqual(2)
    expect(scaleX).toBeGreaterThan(2.55)
    const overall = solved.find((s) => s.segments.length === 1 && s.readSegments === 1)
    expect(overall?.segments[0].valueCm).toBe(1110)
  })
})

describe('the number grammar', () => {
  it('reads the forms a drawing prints, and nothing else', () => {
    expect(parseNumber('1205')[0]).toMatchObject({ kind: 'LINEAR_DIMENSION', value: 1205, unit: 'cm' })
    expect(parseNumber('12,05')[0]).toMatchObject({ kind: 'LINEAR_DIMENSION', value: 12.05, unit: 'm' })
    expect(parseNumber('+7,95')[0]).toMatchObject({ kind: 'LEVEL_DATUM', value: 7.95, unit: 'm' })
    expect(parseNumber('-0,32')[0]).toMatchObject({ kind: 'LEVEL_DATUM', value: -0.32, unit: 'm' })
    expect(parseNumber('±0,00')[0]).toMatchObject({ kind: 'LEVEL_DATUM', value: 0, unit: 'm' })
    expect(parseNumber('40°')[0]).toMatchObject({ kind: 'ANGLE', value: 40, unit: 'deg' })
    expect(parseNumber('300/230')[0]).toMatchObject({ kind: 'OPENING_CALLOUT', value: 300, secondValue: 230, unit: 'cm' })
    expect(parseNumber('7')).toEqual([])
    expect(parseNumber('12345')).toEqual([])
    expect(parseNumber('')).toEqual([])
  })

  it('a plus-or-minus sign marks the zero and nothing else, so a misread of it parses to nothing', () => {
    expect(parseNumber('±0,08')).toEqual([])
    expect(parseNumber('±3,06')).toEqual([])
  })

  it('converts between the units a sheet mixes, and refuses to convert the ones it cannot', () => {
    expect(toCentimetres(12.05, 'm')).toBe(1205)
    expect(toCentimetres(1205, 'cm')).toBe(1205)
    expect(() => toCentimetres(40, 'deg')).toThrow(/not a length/)
  })

  it('enumerates what the reader might have meant, best first, bounded', () => {
    const c = new Canvas(420, 200)
    c.text('415', 40, 30, 16, { slant: 0.18 })
    const token = readNumbers(c.toRaster()).tokens[0]
    const lattice = readingLattice(token, 8)
    expect(lattice.length).toBeGreaterThan(1)
    expect(lattice.length).toBeLessThanOrEqual(8)
    expect(lattice[0].text).toBe(token.text)
    expect(lattice[0].substitutions).toBe(0)
    expect(new Set(lattice.map((l) => l.text)).size).toBe(lattice.length)
  })
})
