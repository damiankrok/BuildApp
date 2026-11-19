/**
 * v3.54.13 — binary masks on a regular grid: rasterise polygons, fill enclosed holes, split into components, trace each
 * component's outer boundary along the cell edges (a simple rectilinear loop) and simplify it. Pure and deterministic:
 * the same mask gives the same loops in the same order.
 */

export type Grid = { w: number; h: number; data: Uint8Array }
export const grid = (w: number, h: number): Grid => ({ w, h, data: new Uint8Array(w * h) })

/** Point in polygon (even-odd), polygon as [x, y] pairs. */
export function inside(poly: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Scanline fill of a polygon given in GRID coordinates (cell (i, j) covers [i, i+1) × [j, j+1)): cells whose centre is inside. */
export function fillPolygon(g: Grid, poly: ReadonlyArray<readonly [number, number]>, value = 1): void {
  if (poly.length < 3) return
  let y0 = Infinity
  let y1 = -Infinity
  for (const [, y] of poly) {
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  for (let j = Math.max(0, Math.floor(y0)); j <= Math.min(g.h - 1, Math.ceil(y1)); j++) {
    const yc = j + 0.5
    const xs: number[] = []
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const [xi, yi] = poly[i]
      const [xk, yk] = poly[k]
      if (yi > yc !== yk > yc) xs.push(xi + ((yc - yi) * (xk - xi)) / (yk - yi))
    }
    xs.sort((a, b) => a - b)
    for (let t = 0; t + 1 < xs.length; t += 2) {
      const a = Math.max(0, Math.ceil(xs[t] - 0.5))
      const b = Math.min(g.w - 1, Math.floor(xs[t + 1] - 0.5))
      for (let i = a; i <= b; i++) g.data[j * g.w + i] = value
    }
  }
}

/** Set every cell not reachable from the border through unset cells (4-connected): the holes of the mask. */
export function fillHoles(g: Grid): Grid {
  const out: Grid = { w: g.w, h: g.h, data: g.data.slice() }
  const seen = new Uint8Array(g.w * g.h)
  const stack: number[] = []
  const push = (i: number, j: number): void => {
    if (i < 0 || j < 0 || i >= g.w || j >= g.h) return
    const k = j * g.w + i
    if (seen[k] || g.data[k]) return
    seen[k] = 1
    stack.push(k)
  }
  for (let i = 0; i < g.w; i++) {
    push(i, 0)
    push(i, g.h - 1)
  }
  for (let j = 0; j < g.h; j++) {
    push(0, j)
    push(g.w - 1, j)
  }
  while (stack.length > 0) {
    const k = stack.pop() as number
    const i = k % g.w
    const j = (k - i) / g.w
    push(i + 1, j)
    push(i - 1, j)
    push(i, j + 1)
    push(i, j - 1)
  }
  for (let k = 0; k < out.data.length; k++) if (!seen[k]) out.data[k] = 1
  return out
}

/** Morphological opening (erode then dilate) by `r` cells, 4-neighbourhood box: thin slivers and lines go. */
export function open(g: Grid, r: number): Grid {
  return dilate(erode(g, r), r)
}
/** Dilation by a (2r+1)² box, separable (rows then columns): fast on a large drawing. */
export function dilateBox(g: Grid, r: number): Grid {
  const tmp = grid(g.w, g.h)
  for (let j = 0; j < g.h; j++) {
    let last = -Infinity
    for (let i = 0; i < g.w; i++) {
      if (g.data[j * g.w + i]) last = i
      if (i - last <= r) tmp.data[j * g.w + i] = 1
    }
    last = Infinity
    for (let i = g.w - 1; i >= 0; i--) {
      if (g.data[j * g.w + i]) last = i
      if (last - i <= r) tmp.data[j * g.w + i] = 1
    }
  }
  const out = grid(g.w, g.h)
  for (let i = 0; i < g.w; i++) {
    let last = -Infinity
    for (let j = 0; j < g.h; j++) {
      if (tmp.data[j * g.w + i]) last = j
      if (j - last <= r) out.data[j * g.w + i] = 1
    }
    last = Infinity
    for (let j = g.h - 1; j >= 0; j--) {
      if (tmp.data[j * g.w + i]) last = j
      if (last - j <= r) out.data[j * g.w + i] = 1
    }
  }
  return out
}
export function close(g: Grid, r: number): Grid {
  return erode(dilate(g, r), r)
}
function erode(g: Grid, r: number): Grid {
  const out = grid(g.w, g.h)
  for (let j = 0; j < g.h; j++) {
    for (let i = 0; i < g.w; i++) {
      let all = 1
      for (let dj = -r; dj <= r && all; dj++) for (let di = -r; di <= r && all; di++) {
        const x = i + di
        const y = j + dj
        if (x < 0 || y < 0 || x >= g.w || y >= g.h || !g.data[y * g.w + x]) all = 0
      }
      out.data[j * g.w + i] = all
    }
  }
  return out
}
function dilate(g: Grid, r: number): Grid {
  const out = grid(g.w, g.h)
  for (let j = 0; j < g.h; j++) {
    for (let i = 0; i < g.w; i++) {
      if (!g.data[j * g.w + i]) continue
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const x = i + di
        const y = j + dj
        if (x >= 0 && y >= 0 && x < g.w && y < g.h) out.data[y * g.w + x] = 1
      }
    }
  }
  return out
}

/** 4-connected components, in scan order of their first cell. */
export function components(g: Grid): Grid[] {
  const label = new Int32Array(g.w * g.h).fill(-1)
  const out: Grid[] = []
  for (let k0 = 0; k0 < g.data.length; k0++) {
    if (!g.data[k0] || label[k0] >= 0) continue
    const c = grid(g.w, g.h)
    const stack = [k0]
    label[k0] = out.length
    while (stack.length > 0) {
      const k = stack.pop() as number
      c.data[k] = 1
      const i = k % g.w
      const j = (k - i) / g.w
      for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue
        const q = y * g.w + x
        if (g.data[q] && label[q] < 0) {
          label[q] = out.length
          stack.push(q)
        }
      }
    }
    out.push(c)
  }
  return out
}

export const count = (g: Grid): number => g.data.reduce((s, v) => s + (v ? 1 : 0), 0)

/**
 * The outer boundary of one hole-free 4-connected component, along cell edges, as corner points (x, y in cells,
 * counter-clockwise with y down is clockwise on screen — orientation is irrelevant to the users). Collinear points
 * removed. A diagonal pinch is passed with a right-hand rule, so the loop never crosses itself.
 */
export function traceOuter(c: Grid): Array<[number, number]> {
  const at = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < c.w && j < c.h && c.data[j * c.w + i] === 1
  // start: the top-left cell's top edge, walking right (cell on the right-hand side, y down)
  let start = -1
  for (let k = 0; k < c.data.length; k++) if (c.data[k]) { start = k; break }
  if (start < 0) return []
  const si = start % c.w
  const sj = (start - si) / c.w
  // vertex walk: position (x, y) at a cell corner, direction d (0 right, 1 down, 2 left, 3 up); the region is on the right
  const DX = [1, 0, -1, 0]
  const DY = [0, 1, 0, -1]
  // the cell on the right of moving from (x, y) in direction d, and the cell on the left
  const rightCell = (x: number, y: number, d: number): [number, number] => (d === 0 ? [x, y] : d === 1 ? [x - 1, y] : d === 2 ? [x - 1, y - 1] : [x, y - 1])
  const leftCell = (x: number, y: number, d: number): [number, number] => (d === 0 ? [x, y - 1] : d === 1 ? [x, y] : d === 2 ? [x - 1, y] : [x - 1, y - 1])
  let x = si
  let y = sj
  let d = 0
  const pts: Array<[number, number]> = [[x, y]]
  for (let guard = 0; guard < 4 * c.data.length + 8; guard++) {
    x += DX[d]
    y += DY[d]
    // choose the next direction: try a right turn, straight, left turn (region kept on the right)
    let next = -1
    for (const t of [(d + 1) % 4, d, (d + 3) % 4]) {
      const [ri, rj] = rightCell(x, y, t)
      const [li, lj] = leftCell(x, y, t)
      if (at(ri, rj) && !at(li, lj)) {
        next = t
        break
      }
    }
    if (next < 0) next = (d + 2) % 4
    if (next !== d) pts.push([x, y])
    d = next
    if (x === si && y === sj && d === 0) break
  }
  if (pts.length > 1 && pts[pts.length - 1][0] === pts[0][0] && pts[pts.length - 1][1] === pts[0][1]) pts.pop()
  return dropCollinear(pts)
}

function dropCollinear(pts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[(i + n - 1) % n]
    const q = pts[i]
    const r = pts[(i + 1) % n]
    if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) !== 0) out.push(q)
  }
  return out
}

/** Douglas–Peucker on a closed loop, anchored at its two farthest-apart points. */
export function simplifyLoop(pts: ReadonlyArray<readonly [number, number]>, eps: number): Array<[number, number]> {
  const n = pts.length
  if (n <= 4 || eps <= 0) return pts.map((p) => [p[0], p[1]])
  let a = 0
  let b = 0
  let best = -1
  for (let i = 0; i < n; i++) {
    const dx = pts[i][0] - pts[0][0]
    const dy = pts[i][1] - pts[0][1]
    if (dx * dx + dy * dy > best) {
      best = dx * dx + dy * dy
      b = i
    }
  }
  const dp = (from: number, to: number): number[] => {
    // indices strictly between from and to (cyclically), kept
    const idx: number[] = []
    for (let k = (from + 1) % n; k !== to; k = (k + 1) % n) idx.push(k)
    if (idx.length === 0) return []
    const [x0, y0] = pts[from]
    const [x1, y1] = pts[to]
    const L = Math.hypot(x1 - x0, y1 - y0) || 1
    let far = -1
    let dist = -1
    for (const k of idx) {
      const d = Math.abs((x1 - x0) * (y0 - pts[k][1]) - (x0 - pts[k][0]) * (y1 - y0)) / L
      if (d > dist) {
        dist = d
        far = k
      }
    }
    if (dist <= eps) return []
    return [...dp(from, far), far, ...dp(far, to)]
  }
  const keep = [a, ...dp(a, b), b, ...dp(b, a)]
  return keep.map((k) => [pts[k][0], pts[k][1]])
}
