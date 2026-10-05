/**
 * The external-recogniser corpora (BUILDPLAN-ANALYZER-005G/005H): 672 synthetic dimension labels in the two stroke
 * faces of `digit-corpus.ts`, none of them a publisher's.
 *
 *   SYN5001 / SYN9017   005E's calibration and held-back corpora (`digitCorpus`, 24 per stratum)
 *   STRESS              005G's stress corpus: every confusable pair (9/4, 4/0, 8/6, 3/5) inside 3-, 4- and 5-digit
 *                       values, every digit in a non-leading place, caps 11–25 px, eight regimes — clean, italic,
 *                       condensed, condensed italic, thin anti-aliased, blurred, touching, broken
 *
 * Ported unchanged from `research/analyzer-005g/build-dataset.ts` (`stressCorpus`), so the 005H gate reads the very
 * labels 005G measured. A pure function of nothing: seeded generators, no clock, no Math.random.
 */
import { CORPUS_SEEDS, digitCorpus } from './digit-corpus.js'
import type { LabelStyle } from './digit-corpus.js'

/** The renderer the corpora are drawn with, for a caller that imports this module alone (the on-device self-test). */
export { renderLabel } from './digit-corpus.js'

export type OcrCorpusSet = 'SYN5001' | 'SYN9017' | 'STRESS'
export type OcrCorpusLabel = { id: string; set: OcrCorpusSet; text: string; stratum: string; style: Partial<LabelStyle> }

/** 005G's stress corpus: 8 regimes × 6 caps × 4 labels. */
export function stressCorpus(): OcrCorpusLabel[] {
  let state = 20051005
  const rnd = (): number => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296
  const pairs = ['94', '49', '40', '04', '86', '68', '35', '53']
  const values: string[] = []
  // Every confusable pair inside a 3-, 4- and 5-digit value, and every digit 0–9 in a non-leading position.
  for (const p of pairs)
    for (const len of [3, 4, 5]) {
      let t = String(1 + Math.floor(rnd() * 9))
      const at = 1 + Math.floor(rnd() * (len - 2))
      while (t.length < at) t += String(Math.floor(rnd() * 10))
      t += p
      while (t.length < len) t += String(Math.floor(rnd() * 10))
      values.push(t.slice(0, len))
    }
  for (let d = 0; d <= 9; d += 1) values.push(`1${d}${(d + 3) % 10}${(d + 7) % 10}`)
  const caps = [11, 13, 15, 17, 20, 25]
  const regimes: Array<[string, (cap: number) => Partial<LabelStyle>]> = [
    ['CLEAN', (c) => ({ slant: 0, pen: Math.max(1.2, c / 9), gap: 0.16 })],
    ['ITALIC', (c) => ({ slant: 0.28, pen: Math.max(1.2, c / 9), gap: 0.12 })],
    ['CONDENSED', (c) => ({ slant: 0, pen: Math.max(1.1, c / 10), gap: 0.08, condense: 0.72 })],
    ['CONDENSED_ITALIC', (c) => ({ slant: 0.22, pen: Math.max(1.1, c / 10), gap: 0.06, condense: 0.72 })],
    ['ANTIALIASED_THIN', (c) => ({ slant: 0.12, pen: Math.max(0.8, c / 16), gap: 0.14 })],
    ['BLURRED', (c) => ({ slant: 0.12, pen: Math.max(1.2, c / 9), gap: 0.14, blur: 0.5 + c / 30 })],
    ['TOUCHING', (c) => ({ slant: 0.2, pen: Math.max(1.3, c / 8), gap: -0.02 })],
    ['BROKEN', (c) => ({ slant: 0.12, pen: Math.max(1.2, c / 9), gap: 0.14, breaks: 0.6 })],
  ]
  const out: OcrCorpusLabel[] = []
  let i = 0
  for (const [stratum, style] of regimes)
    for (const cap of caps)
      for (let k = 0; k < 4; k += 1) {
        const text = values[(i * 7 + k * 13) % values.length]
        out.push({ id: `stress-${stratum.toLowerCase()}-${cap}-${k}`, set: 'STRESS', text, stratum, style: { ...style(cap), capHeight: cap, face: (i + k) % 2 === 0 ? 'A' : 'B', seed: 1 + Math.floor(rnd() * 1e9) } })
        i += 1
      }
  return out
}

/** The 672 labels, in 005G's order: SYN5001, SYN9017, STRESS. */
export function ocrBakeoffCorpus(): OcrCorpusLabel[] {
  return [
    ...digitCorpus(CORPUS_SEEDS.calibration, 24).map((s) => ({ id: s.id, set: 'SYN5001' as const, text: s.text, stratum: s.stratum, style: s.style })),
    ...digitCorpus(CORPUS_SEEDS.heldBack, 24).map((s) => ({ id: s.id, set: 'SYN9017' as const, text: s.text, stratum: s.stratum, style: s.style })),
    ...stressCorpus(),
  ]
}
