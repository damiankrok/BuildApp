/**
 * The decoder and the pre-processing, on fixed numbers: no model, no runtime. PaddleOCR's `resize_norm_img`, CTC greedy
 * and the digit-constrained prefix beam (005G's measured implementation), and the bracket's four reads.
 */
import { describe, expect, it } from 'vitest'
import { BRACKET, DECODER, classesOf, digitClasses, digitPrefixBeam, greedyDecode, paddleTensor, resizeBilinear, variantOf } from '../src/index.js'

const gray = (w: number, h: number, f: (x: number, y: number) => number) => ({ width: w, height: h, data: Uint8Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w))) })

describe('pre-processing', () => {
  it('resizes bilinearly with half-pixel centres, and is the identity at the same size', () => {
    const g = gray(5, 3, (x, y) => x * 40 + y * 7)
    expect(Array.from(resizeBilinear(g, 5, 3))).toEqual(Array.from(g.data))
    const up = resizeBilinear(gray(2, 1, (x) => x * 100), 4, 1)
    expect(Array.from(up)).toEqual([0, 25, 75, 100])
  })

  it('makes a [1, 3, 48, W ≥ 320] tensor, normalised to [-1, 1], equal channels, zero padding', () => {
    const g = gray(40, 20, (x) => (x < 20 ? 0 : 255))
    const t = paddleTensor(g)
    expect(t.dims).toEqual([1, 3, DECODER.height, 320])
    const [, , H, W] = t.dims
    const at = (c: number, y: number, x: number): number => t.data[c * H * W + y * W + x]
    expect(at(0, 10, 0)).toBe(-1)
    expect(at(0, 10, 95)).toBe(1)
    for (let c = 1; c < 3; c += 1) expect(at(c, 10, 95)).toBe(at(0, 10, 95))
    // the image is 96 wide at height 48; past it, padding
    expect(at(0, 10, 200)).toBe(0)
    // a wide crop keeps its own ratio
    expect(paddleTensor(gray(400, 20, () => 255)).dims[3]).toBe(960)
  })
})

describe('decoding', () => {
  const dict = ['!', ...'0123456789'.split(''), 'A']
  const classes = classesOf(dict)
  const digits = digitClasses(classes)
  /** Frames as [class index, probability]; the rest of each frame's mass is spread on class 0 (blank). */
  const probsOf = (frames: Array<Array<[number, number]>>): { probs: Float32Array; T: number; C: number } => {
    const C = classes.length
    const probs = new Float32Array(frames.length * C)
    frames.forEach((f, t) => {
      let rest = 1
      for (const [k, p] of f) {
        probs[t * C + k] = p
        rest -= p
      }
      probs[t * C + 0] += Math.max(0, rest)
    })
    return { probs, T: frames.length, C }
  }
  const k = (ch: string): number => classes.indexOf(ch)

  it('knows its classes: blank, the dictionary, a space; the digits by index', () => {
    expect(classes[0]).toBe('<blank>')
    expect(classes[classes.length - 1]).toBe(' ')
    expect(digits).toEqual([...'0123456789'].map((d) => classes.indexOf(d)))
  })

  it('greedy: argmax, repeats collapsed, blanks dropped, mean of the kept frames', () => {
    const { probs, T, C } = probsOf([[[k('1'), 0.9]], [[k('1'), 0.8]], [], [[k('9'), 0.7]], [[k('A'), 0.95]]])
    const g = greedyDecode(probs, T, C, classes)
    expect(g.text).toBe('19A')
    expect(g.meanP).toBeCloseTo((0.9 + 0.7 + 0.95) / 3, 6)
  })

  it('the digit beam merges paths into values, renormalised over {blank, 0–9}, best first', () => {
    // "12" printed; the second glyph half "7"
    const { probs, T, C } = probsOf([[[k('1'), 0.98]], [], [[k('2'), 0.6], [k('7'), 0.38]], [], [[k('A'), 0.9]]])
    const top = digitPrefixBeam(probs, T, C, digits)
    expect(top[0].text).toBe('12')
    expect(top[1].text).toBe('17')
    expect(top[0].p).toBeGreaterThan(top[1].p)
    expect(top.reduce((a, t) => a + t.p, 0)).toBeLessThanOrEqual(1.000001)
    expect(top.length).toBeLessThanOrEqual(DECODER.topK)
    // every probability is rounded to six decimals
    for (const t of top) expect(Number(t.p.toFixed(6))).toBe(t.p)
  })

  it('a repeated digit needs a blank between: "11" is not "1"', () => {
    const one = probsOf([[[k('1'), 0.99]], [[k('1'), 0.99]]])
    expect(digitPrefixBeam(one.probs, one.T, one.C, digits)[0].text).toBe('1')
    const two = probsOf([[[k('1'), 0.99]], [], [[k('1'), 0.99]]])
    expect(digitPrefixBeam(two.probs, two.T, two.C, digits)[0].text).toBe('11')
  })
})

describe('the stability bracket', () => {
  it('reads the crop as cut, with 2 px more paper, 1 px less, and at 90 %', () => {
    const g = gray(30, 12, (x, y) => (x + y) % 255)
    expect(BRACKET).toEqual(['BASE', 'PAD2', 'TRIM1', 'SCALE90'])
    expect(variantOf(g, 'BASE')).toBe(g)
    const pad = variantOf(g, 'PAD2')
    expect([pad.width, pad.height]).toEqual([34, 16])
    expect(pad.data[0]).toBe(255)
    expect(pad.data[2 * 34 + 2]).toBe(g.data[0])
    const trim = variantOf(g, 'TRIM1')
    expect([trim.width, trim.height]).toEqual([28, 10])
    expect(trim.data[0]).toBe(g.data[1 * 30 + 1])
    const scale = variantOf(g, 'SCALE90')
    expect([scale.width, scale.height]).toEqual([27, 11])
  })
})
