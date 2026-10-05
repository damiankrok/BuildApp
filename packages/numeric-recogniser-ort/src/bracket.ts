/**
 * The external reader's stability bracket (005G, chosen a priori as the analogue of the lattice's `STABILITY_BRACKET`):
 * the same crop read four ways — as cut, with 2 px more paper on every side, with 1 px less, and at 90 % — and a reading
 * is STABLE when the top value is the same in all four. A value the image decides survives a pixel of framing and a
 * tenth of scale; one that a cut or a resample flips was never decided by the image.
 */
import type { ExternalVariant } from '@buildapp/source-metrics'
import { resizeBilinear } from './paddle.js'
import type { GrayImage } from './paddle.js'

export const BRACKET: readonly ExternalVariant[] = ['BASE', 'PAD2', 'TRIM1', 'SCALE90']

/** One variant of a crop (005G's `perturb`). Paper is 255. */
export function variantOf(g: GrayImage, variant: ExternalVariant): GrayImage {
  if (variant === 'PAD2') {
    const W = g.width + 4
    const H = g.height + 4
    const d = new Uint8Array(W * H).fill(255)
    for (let y = 0; y < g.height; y += 1) for (let x = 0; x < g.width; x += 1) d[(y + 2) * W + x + 2] = g.data[y * g.width + x]
    return { width: W, height: H, data: d }
  }
  if (variant === 'TRIM1') {
    // A crop narrower than three pixels has no pixel to trim to: it is read as cut.
    if (g.width < 3 || g.height < 3) return g
    const W = g.width - 2
    const H = g.height - 2
    const d = new Uint8Array(W * H)
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) d[y * W + x] = g.data[(y + 1) * g.width + x + 1]
    return { width: W, height: H, data: d }
  }
  if (variant === 'SCALE90') {
    const W = Math.max(4, Math.round(g.width * 0.9))
    const H = Math.max(4, Math.round(g.height * 0.9))
    const f = resizeBilinear(g, W, H)
    return { width: W, height: H, data: Uint8Array.from(f, (v) => Math.round(v)) }
  }
  return g
}
