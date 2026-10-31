/**
 * N9-02R: a fresh synthetic holdout of render-like and drawn elevations whose truth is known by construction, frozen
 * before the facade-anchor extractor was written. Nothing here resembles a house of the corpus, and nothing in the
 * extractor may be tuned to these sheets after their first evaluation (see the manifest's freeze record).
 *
 * Each case draws one elevation from a seeded generator and records its truth: the walls' outer ends (pixel columns),
 * the eaves, the apex and the ground (rows), the true metres per pixel, the openings, and what a correct reader must
 * do with it:
 *
 *   ACCEPT  the walls' two ends are drawn and visible: they must be found, within the tolerance
 *   REFUSE  at least one end is not decidable from the image (occluded, white on white, cut by the sheet, not an
 *           orthographic view): any acceptance is a hard false acceptance
 *   EITHER  the end is drawn, but next to a distractor that continues the same run (a timber screen against timber
 *           cladding): a correct reading or a refusal are both sound, a wrong reading is a hard false acceptance
 *
 * The apparent outline (`outline`) is what the source analyzer's trace would give: the box of everything drawn above
 * the ground, trees and pergolas included.
 */

export type Rgb = [number, number, number]
export type HoldoutRaster = { width: number; height: number; data: Uint8ClampedArray }
export type HoldoutTruth = {
  id: string
  family: string
  expected: 'ACCEPT' | 'REFUSE' | 'EITHER'
  why: string
  view: 'FRONT' | 'REAR' | 'SIDE'
  /** True outer wall ends, first and last wall column (inclusive). */
  wallX0: number
  wallX1: number
  wallM: number
  mpp: number
  eaveRow: number
  apexRow: number
  groundRow: number
  /** Openings in pixels (columns inclusive, rows half-open). */
  openings: Array<{ x0: number; x1: number; y0: number; y1: number }>
  outline: { x0: number; y0: number; x1: number; y1: number }
  /** Features drawn that a reader must not take for walls or ridge. */
  distractors: string[]
}
export type HoldoutCase = { truth: HoldoutTruth; raster: HoldoutRaster }

export const HOLDOUT_SEED = 92021
export const HOLDOUT_VERSION = 'n9-02r-holdout-1'

/** Mulberry32: a small seeded generator, so the sheets are byte-identical on every machine. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Canvas {
  readonly data: Uint8ClampedArray
  /** Pixels drawn once the background is laid: the building and everything in front of it. */
  readonly drawn: Uint8Array
  track = false
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly rand: () => number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4)
    this.drawn = new Uint8Array(width * height)
  }
  put(x: number, y: number, c: Rgb, alpha = 1): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const o = (y * this.width + x) * 4
    for (let k = 0; k < 3; k += 1) this.data[o + k] = Math.round(this.data[o + k] * (1 - alpha) + c[k] * alpha)
    this.data[o + 3] = 255
    if (this.track) this.drawn[y * this.width + x] = 1
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: Rgb | ((x: number, y: number) => Rgb)): void {
    for (let y = Math.round(y0); y < Math.round(y1); y += 1) for (let x = Math.round(x0); x < Math.round(x1); x += 1) this.put(x, y, typeof c === 'function' ? c(x, y) : c)
  }
  /** Fill a convex polygon (scanline). */
  poly(ps: ReadonlyArray<[number, number]>, c: Rgb | ((x: number, y: number) => Rgb)): void {
    const ys = ps.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
      const xs: number[] = []
      for (let i = 0; i < ps.length; i += 1) {
        const [ax, ay] = ps[i]
        const [bx, by] = ps[(i + 1) % ps.length]
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax))
      }
      if (xs.length < 2) continue
      xs.sort((a, b) => a - b)
      for (let x = Math.round(xs[0]); x < Math.round(xs[xs.length - 1]); x += 1) this.put(x, y, typeof c === 'function' ? c(x, y) : c)
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Rgb, w = 2): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i += 1) {
      const x = x0 + ((x1 - x0) * i) / n
      const y = y0 + ((y1 - y0) * i) / n
      for (let d = 0; d < w; d += 1) this.put(Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? x : x + d, Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? y + d : y, c)
    }
  }
  /** A tree: a textured crown of blended green blobs on a trunk. */
  tree(cx: number, top: number, crownR: number, ground: number): void {
    this.rect(cx - Math.max(3, crownR * 0.08), top + crownR, cx + Math.max(3, crownR * 0.08), ground, [92, 70, 48])
    // a dense core, so the crown hides what stands behind it, and loose blobs around it
    const cy = top + crownR
    for (let y = Math.round(cy - crownR * 0.95); y <= cy + crownR * 0.95; y += 1)
      for (let x = Math.round(cx - crownR * 0.8); x <= cx + crownR * 0.8; x += 1) {
        if (((x - cx) / (crownR * 0.8)) ** 2 + ((y - cy) / (crownR * 0.95)) ** 2 > 1) continue
        const n = this.rand() * 30 - 15
        this.put(x, y, [Math.round(58 + n), Math.round(112 + n), Math.round(48 + n * 0.5)])
      }
    for (let k = 0; k < 40; k += 1) {
      const a = this.rand() * Math.PI * 2
      const r = this.rand() * crownR * 0.75
      const bx = cx + Math.cos(a) * r
      const by = top + crownR + Math.sin(a) * r * 0.9
      const br = crownR * (0.25 + this.rand() * 0.3)
      const shade = 0.7 + this.rand() * 0.5
      for (let y = Math.round(by - br); y <= by + br; y += 1)
        for (let x = Math.round(bx - br); x <= bx + br; x += 1) {
          if ((x - bx) ** 2 + (y - by) ** 2 > br * br) continue
          const n = this.rand() * 30 - 15
          this.put(x, y, [Math.round((60 + n) * shade), Math.round((120 + n) * shade), Math.round((50 + n * 0.5) * shade)])
        }
    }
  }
  noise(amount: number): void {
    for (let i = 0; i < this.data.length; i += 4) for (let k = 0; k < 3; k += 1) this.data[i + k] = Math.max(0, Math.min(255, this.data[i + k] + Math.round((this.rand() - 0.5) * 2 * amount)))
  }
}

type Finish = 'WHITE' | 'GREY' | 'ANTHRACITE' | 'WOOD' | 'BRICK' | 'WHITE_WOOD' | 'GREY_WOOD' | 'DARK_WHITE'
const finishColour = (f: Finish, x: number, y: number, wallX0: number, wallX1: number, eave: number, ground: number): Rgb => {
  const t = (x - wallX0) / Math.max(1, wallX1 - wallX0)
  const upper = y < eave + (ground - eave) * 0.45
  switch (f) {
    case 'WHITE':
      return [236, 234, 228]
    case 'GREY':
      return [168, 170, 172]
    case 'ANTHRACITE':
      return [62, 64, 68]
    case 'WOOD':
      return (x % 9) < 2 ? [118, 78, 46] : [168, 116, 72]
    case 'BRICK':
      return (y % 7 === 0 || (x + (Math.floor(y / 7) % 2) * 6) % 13 === 0) ? [200, 190, 180] : [158, 74, 52]
    case 'WHITE_WOOD':
      return upper ? ((x % 9) < 2 ? [118, 78, 46] : [168, 116, 72]) : [236, 234, 228]
    case 'GREY_WOOD':
      return t > 0.55 ? ((x % 9) < 2 ? [118, 78, 46] : [168, 116, 72]) : [150, 152, 156]
    case 'DARK_WHITE':
      return t < 0.4 ? [62, 64, 68] : [236, 234, 228]
  }
}

type Spec = {
  id: string
  family: string
  expected: 'ACCEPT' | 'REFUSE' | 'EITHER'
  why: string
  view: 'FRONT' | 'SIDE'
  wallM: number
  mpp: number
  finish: Finish
  wallHM: number
  /** Roof rise over the eaves, metres; 0 for a flat parapet roof. */
  riseM: number
  overhangM: number
  background: 'SKY' | 'WHITE_SKY' | 'PAPER'
  outlineInk?: Rgb
  chimney?: boolean
  trees?: Array<{ atM: number; crownM: number; topM: number }>
  pergola?: { side: 'L' | 'R'; gapM: number; depthM: number; screen?: boolean }
  balcony?: { side: 'L' | 'R'; beyondM: number }
  cropRightM?: number
  perspective?: number
  garage?: boolean
  offsetM?: number
}

function draw(spec: Spec, seed: number): HoldoutCase {
  const rand = rng(seed)
  const W = 1400
  const H = Math.round((spec.wallHM + spec.riseM + 2.4) / spec.mpp / 0.8)
  spec = { ...spec, W, H } as Spec & { W: number; H: number }
  const S = spec as Spec & { W: number; H: number }
  const c = new Canvas(S.W, S.H, rand)
  const px = (m: number): number => m / spec.mpp
  const groundRow = Math.round(S.H * 0.84)
  const wallPx = Math.round(px(spec.wallM))
  const wallX0 = Math.round(S.W / 2 - wallPx / 2 + px(spec.offsetM ?? 0))
  const wallX1 = wallX0 + wallPx - 1
  const eaveRow = Math.round(groundRow - px(spec.wallHM))
  const apexRow = Math.round(eaveRow - px(spec.riseM))
  const ov = px(spec.overhangM)
  // background
  for (let y = 0; y < S.H; y += 1)
    for (let x = 0; x < S.W; x += 1) {
      if (spec.background === 'PAPER') c.put(x, y, [252, 252, 250])
      else if (spec.background === 'WHITE_SKY') c.put(x, y, [240 + Math.round((y / S.H) * 6), 240 + Math.round((y / S.H) * 5), 236])
      else c.put(x, y, y >= groundRow ? [86, 140, 64] : [150 + Math.round((y / groundRow) * 70), 185 + Math.round((y / groundRow) * 45), 235])
    }
  if (spec.background !== 'SKY') c.rect(0, groundRow, S.W, groundRow + 3, spec.background === 'PAPER' ? [20, 20, 20] : [200, 200, 196])
  c.track = true
  const roofC: Rgb = [70, 72, 78]
  const persp = spec.perspective ?? 0
  // the perspective case: the far end of the facade recedes — its wall end's column drifts with height
  const skew = (x: number, y: number): number => x + persp * (x - wallX0) * ((groundRow - y) / Math.max(1, groundRow - apexRow))
  // roof
  if (spec.riseM > 0) {
    if (spec.view === 'FRONT') {
      const ridgeInset = px(spec.riseM) * 0.9
      c.poly([[skew(wallX0 - ov, eaveRow), eaveRow], [skew(wallX1 + ov, eaveRow), eaveRow], [skew(wallX1 - ridgeInset, apexRow), apexRow], [skew(wallX0 + ridgeInset, apexRow), apexRow]], roofC)
    } else {
      const mid = (wallX0 + wallX1) / 2
      c.poly([[wallX0 - ov, eaveRow + px(0.2)], [wallX1 + ov, eaveRow + px(0.2)], [mid, apexRow]], roofC)
    }
  } else c.rect(wallX0 - ov, eaveRow - px(0.5), wallX1 + 1 + ov, eaveRow, roofC)
  // the fascia/soffit band under the eaves
  c.rect(skew(wallX0 - ov, eaveRow), eaveRow, skew(wallX1 + 1 + ov, eaveRow), eaveRow + Math.max(2, px(0.15)), [40, 40, 44])
  // walls
  for (let y = eaveRow + Math.max(2, Math.round(px(0.15))); y < groundRow; y += 1) {
    const a = Math.round(skew(wallX0, y))
    const b = Math.round(skew(wallX1 + 1, y))
    for (let x = a; x < b; x += 1) c.put(x, y, finishColour(spec.finish, x, y, wallX0, wallX1, eaveRow, groundRow))
  }
  if (spec.chimney) {
    const cx = spec.view === 'FRONT' ? wallX0 + wallPx * 0.7 : (wallX0 + wallX1) / 2 + px(1.2)
    c.rect(cx, apexRow - px(1.1), cx + px(0.6), apexRow + px(0.6), [120, 60, 50])
  }
  // openings: a ground row and an upper row of windows, a door, a garage door
  const openings: HoldoutTruth['openings'] = []
  const glass: Rgb = [40, 52, 66]
  const frame: Rgb = spec.finish === 'ANTHRACITE' ? [230, 230, 230] : [250, 250, 250]
  const nWin = Math.max(2, Math.floor(spec.wallM / 3))
  for (let i = 0; i < nWin; i += 1) {
    const cx = wallX0 + ((i + 0.5) / nWin) * wallPx
    const w = px(1.0)
    for (const [sill, head] of [[0.9, 2.2], ...(spec.wallHM > 4 ? [[3.6, 4.9]] : [])] as Array<[number, number]>) {
      if (spec.garage && i === 0 && sill < 1) continue
      const y0 = Math.round(groundRow - px(head))
      const y1 = Math.round(groundRow - px(sill))
      c.rect(cx - w / 2 - 2, y0 - 2, cx + w / 2 + 2, y1 + 2, frame)
      c.rect(cx - w / 2, y0, cx + w / 2, y1, glass)
      openings.push({ x0: Math.round(cx - w / 2), x1: Math.round(cx + w / 2) - 1, y0, y1 })
    }
  }
  if (spec.garage) {
    const x0 = wallX0 + px(0.6)
    const y0 = Math.round(groundRow - px(2.2))
    c.rect(x0, y0, x0 + px(2.6), groundRow, (x, y) => ((y - y0) % 8 < 1 ? [120, 120, 124] : [176, 178, 182]))
    openings.push({ x0: Math.round(x0), x1: Math.round(x0 + px(2.6)) - 1, y0, y1: groundRow })
  }
  // balcony: a slab and a railing, running past one wall end
  if (spec.balcony) {
    const y = Math.round(groundRow - px(2.9))
    const [a, b] = spec.balcony.side === 'L' ? [wallX0 - px(spec.balcony.beyondM), wallX0 + px(3)] : [wallX1 + 1 - px(3), wallX1 + 1 + px(spec.balcony.beyondM)]
    c.rect(a, y, b, y + px(0.22), [210, 210, 206])
    c.rect(a, y - px(1.0), b, y - px(0.95), [50, 50, 54])
    for (let x = a; x < b; x += px(0.12)) c.rect(x, y - px(1.0), x + 2, y, [50, 50, 54])
  }
  // pergola: posts and beams off one end; a screen fills it with timber
  const distractors: string[] = []
  if (spec.pergola) {
    const p = spec.pergola
    const near = p.side === 'R' ? wallX1 + 1 + px(p.gapM) : wallX0 - px(p.gapM)
    const far = p.side === 'R' ? near + px(p.depthM) : near - px(p.depthM)
    const [a, b] = [Math.min(near, far), Math.max(near, far)]
    const top = Math.round(groundRow - px(2.6))
    const timber: Rgb = [176, 120, 74]
    c.rect(Math.min(a, p.side === 'R' ? wallX1 : a), top, Math.max(b, p.side === 'L' ? wallX0 : b), top + px(0.2), timber)
    for (const x of [a, b - px(0.15)]) c.rect(x, top, x + px(0.15), groundRow, timber)
    if (p.screen) c.rect(a, top, b, groundRow, (x) => ((x % 9) < 2 ? [118, 78, 46] : [168, 116, 72]))
    distractors.push(p.screen ? 'PERGOLA_SCREEN' : 'PERGOLA')
  }
  if (spec.chimney) distractors.push('CHIMNEY')
  if (spec.balcony) distractors.push('BALCONY')
  if (ov > 0) distractors.push('EAVE_OVERHANG')
  // trees last: they stand in front
  for (const t of spec.trees ?? []) {
    c.tree(wallX0 + px(t.atM), groundRow - px(t.topM), px(t.crownM), groundRow)
    distractors.push('TREE')
  }
  if (spec.outlineInk) {
    const ink = spec.outlineInk
    c.line(wallX0, eaveRow, wallX0, groundRow, ink)
    c.line(wallX1 - 1, eaveRow, wallX1 - 1, groundRow, ink)
    c.line(wallX0 - ov, eaveRow, wallX1 + ov, eaveRow, ink)
    if (spec.view === 'SIDE') {
      const mid = (wallX0 + wallX1) / 2
      c.line(wallX0 - ov, eaveRow, mid, apexRow, ink)
      c.line(mid, apexRow, wallX1 + ov, eaveRow, ink)
    }
  }
  if (spec.cropRightM !== undefined) {
    const cut = Math.round(wallX1 - px(spec.cropRightM))
    c.track = false
    for (let y = 0; y < S.H; y += 1)
      for (let x = cut; x < S.W; x += 1) {
        c.put(x, y, [255, 255, 255])
        c.drawn[y * S.W + x] = 0
      }
  }
  c.noise(spec.background === 'PAPER' ? 1 : 3)
  // the apparent outline: everything drawn above the ground, trees and pergolas included
  const bgAt = (x: number, y: number): boolean => c.drawn[y * S.W + x] === 0
  let ox0 = S.W
  let ox1 = -1
  let oy0 = groundRow
  for (let y = 0; y < groundRow; y += 1)
    for (let x = 0; x < S.W; x += 1)
      if (!bgAt(x, y)) {
        ox0 = Math.min(ox0, x)
        ox1 = Math.max(ox1, x)
        oy0 = Math.min(oy0, y)
      }
  const truth: HoldoutTruth = {
    id: spec.id,
    family: spec.family,
    expected: spec.expected,
    why: spec.why,
    view: spec.view,
    wallX0,
    wallX1,
    wallM: spec.wallM,
    mpp: spec.mpp,
    eaveRow,
    apexRow,
    groundRow,
    openings,
    outline: { x0: ox0, y0: oy0, x1: ox1, y1: groundRow },
    distractors,
  }
  return { truth, raster: { width: S.W, height: S.H, data: c.data } }
}

/**
 * The frozen case list. Families are drawn at several scales and offsets from the seed; every family states what a
 * correct reader must do. Positive and negative cases are interleaved so neither can be tuned alone.
 */
export function holdoutSpecs(): Spec[] {
  const r = rng(HOLDOUT_SEED)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
  const mppOf = (): number => Math.round((0.016 + r() * 0.014) * 1e6) / 1e6
  const out: Spec[] = []
  const base = (id: string, family: string, expected: Spec['expected'], why: string, o: Partial<Spec>): Spec => ({
    id,
    family,
    expected,
    why,
    view: 'FRONT',
    wallM: 9 + Math.round(r() * 40) / 10,
    mpp: mppOf(),
    finish: 'WHITE',
    wallHM: pick([3.0, 5.6]),
    riseM: pick([2.6, 3.4, 4.2]),
    overhangM: pick([0.4, 0.6, 0.8]),
    background: 'SKY',
    offsetM: Math.round((r() - 0.5) * 20) / 10,
    ...o,
  })
  for (let k = 0; k < 2; k += 1) {
    out.push(base(`pos-white-${k}`, 'WHITE_PLASTER', 'ACCEPT', 'white plaster against a sky, eaves overhang', { finish: 'WHITE' }))
    out.push(base(`pos-colour-${k}`, 'COLOURED_FACADE', 'ACCEPT', 'a coloured facade of one or two finishes: no neutral band spans it', { finish: pick(['WOOD', 'BRICK', 'GREY_WOOD', 'WHITE_WOOD'] as const) }))
    out.push(base(`pos-dark-${k}`, 'DARK_AND_WHITE', 'ACCEPT', 'anthracite and white walls side by side, one facade', { finish: pick(['ANTHRACITE', 'DARK_WHITE'] as const), garage: true }))
    out.push(base(`pos-gable-${k}`, 'GABLE_CHIMNEY', 'ACCEPT', 'a gable end with a chimney over the apex and eaves overhang', { view: 'SIDE', wallM: 7 + Math.round(r() * 30) / 10, finish: pick(['WHITE', 'GREY'] as const), chimney: true, riseM: 3.4 }))
    out.push(base(`pos-tree-mid-${k}`, 'TREE_MID_FACADE', 'ACCEPT', 'a tree before the middle of the facade; both wall ends are clear', { finish: pick(['WHITE', 'GREY_WOOD'] as const), trees: [{ atM: 4.5, crownM: 1.6, topM: 5.0 }] }))
    out.push(base(`pos-pergola-${k}`, 'PERGOLA_DETACHED', 'ACCEPT', 'a pergola off one end, its posts clear of the wall: the pergola is not wall', { finish: pick(['WHITE', 'GREY'] as const), pergola: { side: pick(['L', 'R'] as const), gapM: 1.2, depthM: 3.0 } }))
    out.push(base(`pos-balcony-${k}`, 'BALCONY_PAST_END', 'ACCEPT', 'a balcony slab and railing running 1.2 m past a wall end', { wallHM: 5.6, finish: pick(['WHITE', 'WHITE_WOOD'] as const), balcony: { side: pick(['L', 'R'] as const), beyondM: 1.2 } }))
    out.push(base(`pos-drawn-${k}`, 'DRAWN_LINES', 'ACCEPT', 'a line drawing on paper: white walls, but the wall ends are drawn', { background: 'PAPER', finish: 'WHITE', outlineInk: [20, 20, 20], view: pick(['FRONT', 'SIDE'] as const) }))
    out.push(base(`pos-flat-${k}`, 'NO_PITCHED_ROOF', 'ACCEPT', 'a flat roof: no ridge, no apex; the wall ends still stand', { riseM: 0, overhangM: 0.3, finish: pick(['GREY', 'ANTHRACITE', 'WOOD'] as const) }))
    out.push(base(`neg-tree-end-${k}`, 'TREE_OVER_END', 'REFUSE', 'a tree crown and trunk stand over one wall end, from eaves to ground', { finish: pick(['WHITE', 'GREY'] as const), trees: [{ atM: -0.2, crownM: 2.2, topM: 6.5 }] }))
    out.push(base(`neg-white-sky-${k}`, 'WHITE_ON_WHITE', 'REFUSE', 'a white wall on a white sky, no outline drawn: its ends are not decidable', { background: 'WHITE_SKY', finish: 'WHITE', overhangM: 0 }))
    out.push(base(`neg-screen-${k}`, 'PERGOLA_SCREEN_ATTACHED', 'EITHER', 'a timber screen fills a pergola against a timber-clad end: below the screen top, wall and screen are one run past the roof', { finish: 'WOOD', pergola: { side: pick(['L', 'R'] as const), gapM: 0, depthM: 2.4, screen: true } }))
    out.push(base(`neg-crop-${k}`, 'CUT_BY_SHEET', 'REFUSE', 'the sheet cuts the facade: its right end is not drawn', { cropRightM: 1.5, finish: pick(['WHITE', 'GREY'] as const) }))
    out.push(base(`neg-persp-${k}`, 'PERSPECTIVE', 'REFUSE', 'a near-frontal perspective: the far wall end leans, so the view is not orthographic', { perspective: 0.06, finish: pick(['WHITE', 'GREY'] as const) }))
    out.push(base(`neg-hidden-${k}`, 'MOSTLY_OCCLUDED', 'REFUSE', 'trees hide both wall ends', { finish: 'WHITE', trees: [{ atM: -0.4, crownM: 2.4, topM: 6.0 }, { atM: 99, crownM: 2.4, topM: 6.0 }] }))
  }
  for (const s of out) {
    // the sheet holds the house: no wall wider than half the sheet's 1400 columns
    s.mpp = Math.max(s.mpp, Math.round((s.wallM / 700) * 1e6) / 1e6)
    // a crown that hides a wall end hides it from the eaves to the ground: its dense core spans the wall's height
    if (s.family === 'TREE_OVER_END' || s.family === 'MOSTLY_OCCLUDED') {
      const R = (s.wallHM / 2 + 0.5) / 0.95
      const ends = s.family === 'TREE_OVER_END' ? [-0.2] : [-0.3, s.wallM + 0.3]
      s.trees = ends.map((atM) => ({ atM, crownM: R, topM: s.wallHM / 2 + R }))
    }
  }
  return out
}

export function holdoutCases(): HoldoutCase[] {
  return holdoutSpecs().map((s, i) => draw(s, HOLDOUT_SEED + 1 + i))
}
