/**
 * PaddleOCR's text-recognition pre- and post-processing, as measured in 005G (`research/analyzer-005g/run-external.mjs`),
 * in one TypeScript implementation shared by CI, the desktop and the phone — no OpenCV, no Kotlin resize.
 *
 *   pre    `resize_norm_img` for a batch of one: the crop resized (bilinear, half-pixel centres) to height 48 and its
 *          own aspect ratio, at least 320 wide, rounded to bytes, normalised to [-1, 1], the three channels equal, the
 *          rest of the 320 padded with 0.
 *   post   the model's own answer: CTC greedy over its full alphabet, with the mean probability of the frames it kept;
 *          and a digit-constrained CTC prefix beam over {blank, 0–9} (probabilities renormalised per frame), whose top
 *          values and their posteriors among the beam are the candidates. Dimensions are digits: the grammar is fixed
 *          a priori, not learnt.
 *
 * Every number that leaves this module is rounded to six decimals, so a reading is the same string on every runtime
 * that computes the same floats, and a difference in the seventh decimal never reaches a hash unrounded.
 */

export type GrayImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }

/** The decoder's bounds (005G, fixed before any result): beam width and how many values are kept. */
export const DECODER = { beam: 24, topK: 5, height: 48, minWidth: 320 } as const

const round6 = (v: number): number => Number(v.toFixed(6))

/** Bilinear resize with half-pixel centres (OpenCV INTER_LINEAR's mapping, in floating point). */
export function resizeBilinear(src: GrayImage, W: number, H: number): Float32Array {
  const out = new Float32Array(W * H)
  const sx = src.width / W
  const sy = src.height / H
  for (let y = 0; y < H; y += 1) {
    let fy = (y + 0.5) * sy - 0.5
    if (fy < 0) fy = 0
    const y0 = Math.min(src.height - 1, Math.floor(fy))
    const y1 = Math.min(src.height - 1, y0 + 1)
    const wy = Math.min(1, fy - y0)
    for (let x = 0; x < W; x += 1) {
      let fx = (x + 0.5) * sx - 0.5
      if (fx < 0) fx = 0
      const x0 = Math.min(src.width - 1, Math.floor(fx))
      const x1 = Math.min(src.width - 1, x0 + 1)
      const wx = Math.min(1, fx - x0)
      const a = src.data[y0 * src.width + x0]
      const b = src.data[y0 * src.width + x1]
      const c = src.data[y1 * src.width + x0]
      const d = src.data[y1 * src.width + x1]
      out[y * W + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy
    }
  }
  return out
}

/** PaddleOCR `resize_norm_img` for a batch of one: [1, 3, 48, W], W ≥ 320. */
export function paddleTensor(gray: GrayImage): { data: Float32Array; dims: [1, 3, number, number] } {
  const imgH = DECODER.height
  const ratio = gray.width / gray.height
  const imgW = Math.floor(imgH * Math.max(DECODER.minWidth / imgH, ratio))
  const rw = Math.min(imgW, Math.ceil(imgH * ratio))
  const resized = resizeBilinear(gray, rw, imgH)
  const t = new Float32Array(3 * imgH * imgW)
  for (let c = 0; c < 3; c += 1)
    for (let y = 0; y < imgH; y += 1)
      for (let x = 0; x < rw; x += 1) t[c * imgH * imgW + y * imgW + x] = (Math.round(resized[y * rw + x]) / 255 - 0.5) / 0.5
  return { data: t, dims: [1, 3, imgH, imgW] }
}

/** The model's classes: CTC blank, the dictionary, and the space PaddleOCR appends (`use_space_char`). */
export const classesOf = (dictionary: readonly string[]): string[] => ['<blank>', ...dictionary, ' ']

/** The class index of each digit, in `0`–`9` order. */
export function digitClasses(classes: readonly string[]): number[] {
  return [...'0123456789'].map((d) => {
    const k = classes.indexOf(d)
    if (k < 1) throw new Error(`the model's dictionary has no digit ${d}`)
    return k
  })
}

/** CTC greedy: argmax per frame, repeats collapsed, blanks dropped; the mean of the kept frames' probabilities. */
export function greedyDecode(probs: Float32Array, T: number, C: number, classes: readonly string[]): { text: string; meanP: number } {
  let text = ''
  let last = -1
  let sum = 0
  let kept = 0
  for (let t = 0; t < T; t += 1) {
    let best = 0
    for (let k = 1; k < C; k += 1) if (probs[t * C + k] > probs[t * C + best]) best = k
    if (best !== 0 && best !== last) {
      text += classes[best]
      sum += probs[t * C + best]
      kept += 1
    }
    last = best
  }
  return { text, meanP: round6(kept > 0 ? sum / kept : 0) }
}

const logsumexp = (a: number, b: number): number => (a === -Infinity ? b : b === -Infinity ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))))

/**
 * CTC prefix beam search over {blank} ∪ digits, each frame's probabilities renormalised over that set. Returns the
 * `topK` non-empty values with their posterior among the final beam, best first.
 */
export function digitPrefixBeam(probs: Float32Array, T: number, C: number, digits: readonly number[], beam: number = DECODER.beam, topK: number = DECODER.topK): Array<{ text: string; p: number }> {
  const charOf = new Map(digits.map((k, i) => [k, String(i)]))
  let beams = new Map<string, { b: number; nb: number }>([['', { b: 0, nb: -Infinity }]])
  for (let t = 0; t < T; t += 1) {
    const row = probs.subarray(t * C, (t + 1) * C)
    let z = row[0]
    for (const k of digits) z += row[k]
    const lp = (k: number): number => Math.log(Math.max(1e-30, row[k] / z))
    const next = new Map<string, { b: number; nb: number }>()
    const add = (key: string, b: number, nb: number): void => {
      const e = next.get(key) ?? { b: -Infinity, nb: -Infinity }
      e.b = logsumexp(e.b, b)
      e.nb = logsumexp(e.nb, nb)
      next.set(key, e)
    }
    for (const [prefix, { b, nb }] of beams) {
      const total = logsumexp(b, nb)
      add(prefix, total + lp(0), -Infinity)
      const last = prefix.length ? prefix[prefix.length - 1] : null
      for (const k of digits) {
        const ch = charOf.get(k) as string
        const p = lp(k)
        if (ch === last) {
          add(prefix, -Infinity, nb + p)
          add(prefix + ch, -Infinity, b + p)
        } else add(prefix + ch, -Infinity, total + p)
      }
    }
    beams = new Map([...next.entries()].sort((x, y) => logsumexp(y[1].b, y[1].nb) - logsumexp(x[1].b, x[1].nb)).slice(0, beam))
  }
  const scored = [...beams.entries()].map(([text, { b, nb }]) => ({ text, lp: logsumexp(b, nb) })).filter((s) => s.text.length > 0)
  const norm = scored.reduce((a, s) => logsumexp(a, s.lp), -Infinity)
  return scored
    .sort((a, b) => b.lp - a.lp)
    .slice(0, topK)
    .map((s) => ({ text: s.text, p: round6(Math.exp(s.lp - norm)) }))
}
