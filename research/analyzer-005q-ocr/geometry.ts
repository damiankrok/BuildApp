/**
 * geometry.ts — BUILDPLAN-ANALYZER-005Q-OCR pure box helpers shared by the harness and its tests (RESEARCH ONLY).
 * No runtime, no file, no pixel: boxes in, boxes out.
 */
export type Box = { x0: number; x1: number; y0: number; y1: number }
export type Orientation = 'HORIZONTAL' | 'ROTATED_CW' | 'ROTATED_CCW' | 'INVERTED'

/** The inverse of production's `pageRectOfPass`: a page box in the frame of the pass that reads `o` upright. */
export function passRectOfPage(r: Box, o: Orientation, page: { width: number; height: number }): Box {
  if (o === 'HORIZONTAL') return r
  if (o === 'INVERTED') return { x0: page.width - 1 - r.x1, y0: page.height - 1 - r.y1, x1: page.width - 1 - r.x0, y1: page.height - 1 - r.y0 }
  // unrotateRect(CW): page (x, y) = (pass.y, H - pass.x)  =>  pass (x, y) = (H - page.y, page.x)
  if (o === 'ROTATED_CW') return { x0: page.height - r.y1, x1: page.height - r.y0, y0: r.x0, y1: r.x1 }
  // unrotateRect(CCW): page (x, y) = (W - pass.y, pass.x)  =>  pass (x, y) = (page.y, W - page.x)
  return { x0: r.y0, x1: r.y1, y0: page.width - r.x1, y1: page.width - r.x0 }
}

export const area = (b: Box): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
export const inter = (a: Box, b: Box): number => area({ x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) })

export type DetBox = Box & { score: number; tile: number; raw: Box; cut?: boolean }
/** Border de-duplication: a box cut by a tile border yields to an overlapping whole one; then boxes overlapping by >= 60 % of the smaller keep the higher score. */
export function dedupe(boxes: DetBox[]): DetBox[] {
  const sorted = [...boxes].sort((a, b) => Number(!!a.cut) - Number(!!b.cut) || b.score - a.score || a.y0 - b.y0 || a.x0 - b.x0)
  const kept: DetBox[] = []
  for (const b of sorted) {
    if (kept.some((k) => inter(k, b) >= 0.6 * Math.min(area(k), area(b)))) continue
    kept.push(b)
  }
  return kept.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0).map(({ cut: _c, ...b }) => b)
}
