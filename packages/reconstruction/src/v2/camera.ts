/**
 * Where the camera stood when a rendered view of the house was made.
 *
 * A published project ships a handful of perspective renders beside its
 * drawings, and they are the only pictures that show two facades at once. To
 * read anything off one — a recess depth, a canopy, the set-back of a garage —
 * the camera has to be known, and nothing states it. What the render does
 * give away is the building's SILHOUETTE: a large, connected block of not-sky
 * and not-vegetation whose outline is made of exactly the edges the envelope
 * already names — eave lines, gable slopes, the ridge, the wall corners where
 * they meet the ground, the flat top of an attached garage.
 *
 * So the camera is resected from the silhouette. The outline's convex hull is
 * a polygon whose corners are projections of known world corners, and which
 * corners those are depends only on which two facades the camera sees and
 * roughly how high it is. That is a small set of hypotheses: enumerate them
 * from canonical viewpoints, align each predicted corner sequence with the
 * detected one in cyclic order, resect a camera through `solveCamera`, then
 * let the solved camera say which other world corners must lie on the outline
 * and take those too. The hypothesis whose rendered silhouette best covers
 * the detected one wins, which is what settles the mirror ambiguity a
 * symmetric roof leaves open: the garage is on one side, not both.
 *
 * Deterministic and self-contained: no randomness, no files, no network, no
 * knowledge of any particular building. The envelope is an argument.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelPoint, PixelRect } from '@buildapp/source-common'
import type { Mask, Raster } from '@buildapp/source-cv'
import { profileBottom, profileTop, simplifyPolyline } from '@buildapp/source-cv'
import { projectThrough, solveCamera } from '@buildapp/image-metrology'
import type { CameraSolution, WorldCorrespondence } from '@buildapp/image-metrology'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnvelopeForCamera = {
  /** The characteristic envelope in plan, outer faces, world metres. */
  x0: number
  x1: number
  z0: number
  z1: number
  /** The main gable roof: eave and ridge heights, the ridge's axis, and where it sits along the other axis. */
  eaveY: number
  ridgeY: number
  ridgeAxis: 'X' | 'Z'
  ridgeAt: number
  /** The y of the visible base: 0, or the top of a plinth. */
  groundY: number
  /** Flat-roofed bodies attached to the main one, such as a garage. */
  attached?: Array<{ x0: number; x1: number; z0: number; z1: number; topY: number }>
  /**
   * The gabled body's own footprint, when it cannot be derived. By default it
   * spans the envelope along the ridge and sits symmetrically about the ridge
   * across it, which is right whenever every attached body stands to one side
   * of the ridge, and wrong when they flank it.
   */
  body?: { x0: number; x1: number; z0: number; z1: number }
}

export type CameraAnchorKind = 'RIDGE_END' | 'EAVE_CORNER' | 'GROUND_CORNER' | 'ATTACHED_TOP_CORNER' | 'GABLE_APEX'

export type CameraAnchor = {
  id: string
  world: { x: number; y: number; z: number }
  image: { u: number; v: number }
  kind: CameraAnchorKind
  confidence: number
  why: string
}

export type VisibleSide = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'

export type PerspectiveCameraV2 = {
  frameId: string
  solution: CameraSolution
  anchors: CameraAnchor[]
  rejected: Array<{ anchorId: string; residualPx: number; why: string }>
  residualPx: { rms: number; max: number }
  /** Which side(s) of the building the camera sees: e.g. ['FRONT', 'LEFT']. */
  visibleSides: VisibleSide[]
  confidence: number
  why: string
}

export type PerspectiveCameraOptions = {
  /** An anchor further than this from where the camera puts it is rejected. Default: 2% of the image width. */
  maxResidualPx?: number
  /** Fewer anchors than this and there is no camera. Default 6, the least a resection needs. */
  minAnchors?: number
}

// ---------------------------------------------------------------------------
// Small geometry
// ---------------------------------------------------------------------------

type Vec3 = { x: number; y: number; z: number }
type Line = { p: PixelPoint; d: PixelPoint }

const DEG = Math.PI / 180
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const normalize = (a: Vec3): Vec3 => {
  const n = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / n, y: a.y / n, z: a.z / n }
}
const dist2 = (a: PixelPoint, b: PixelPoint): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Project through a row-major 3×4, keeping the projective depth `s` so a caller can tell front from behind. */
function through(p: readonly number[], w: Vec3): { u: number; v: number; s: number } | null {
  const s = p[8] * w.x + p[9] * w.y + p[10] * w.z + p[11]
  if (!Number.isFinite(s) || Math.abs(s) < 1e-12) return null
  return { u: (p[0] * w.x + p[1] * w.y + p[2] * w.z + p[3]) / s, v: (p[4] * w.x + p[5] * w.y + p[6] * w.z + p[7]) / s, s }
}

/**
 * A camera at `from` looking at `at`, y up, as a 3×4 with the principal point
 * at the origin. Only used to ask which corners a viewpoint puts on the hull,
 * so its focal length is arbitrary.
 */
function lookAtProjection(from: Vec3, at: Vec3, focal: number): number[] {
  const forward = normalize(sub(at, from))
  const right = normalize(cross({ x: 0, y: 1, z: 0 }, forward))
  const up = cross(forward, right)
  const t = { x: -dot(right, from), y: -dot(up, from), z: -dot(forward, from) }
  return [focal * right.x, focal * right.y, focal * right.z, focal * t.x, -focal * up.x, -focal * up.y, -focal * up.z, -focal * t.y, forward.x, forward.y, forward.z, t.z]
}

/** Total-least-squares line through points: the direction is the principal axis of their scatter. */
function fitLine(points: readonly PixelPoint[]): Line | null {
  if (points.length < 2) return null
  let cx = 0
  let cy = 0
  for (const p of points) {
    cx += p.x
    cy += p.y
  }
  cx /= points.length
  cy /= points.length
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    sxx += (p.x - cx) * (p.x - cx)
    sxy += (p.x - cx) * (p.y - cy)
    syy += (p.y - cy) * (p.y - cy)
  }
  if (sxx + syy < 1e-12) return null
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { p: { x: cx, y: cy }, d: { x: Math.cos(theta), y: Math.sin(theta) } }
}

const lineThrough = (a: PixelPoint, b: PixelPoint): Line | null => {
  const n = dist2(a, b)
  return n < 1e-9 ? null : { p: a, d: { x: (b.x - a.x) / n, y: (b.y - a.y) / n } }
}

const lineAngleDeg = (a: Line, b: Line): number => {
  const c = Math.min(1, Math.abs(a.d.x * b.d.x + a.d.y * b.d.y))
  return Math.acos(c) / DEG
}

function intersectLines(a: Line, b: Line): PixelPoint | null {
  const det = a.d.x * b.d.y - a.d.y * b.d.x
  if (Math.abs(det) < 1e-9) return null
  const dx = b.p.x - a.p.x
  const dy = b.p.y - a.p.y
  const t = (dx * b.d.y - dy * b.d.x) / det
  return { x: a.p.x + t * a.d.x, y: a.p.y + t * a.d.y }
}

const perpendicular = (p: PixelPoint, a: PixelPoint, b: PixelPoint): number => {
  const len = dist2(a, b)
  if (len < 1e-9) return dist2(p, a)
  return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / len
}

/**
 * Andrew's monotone chain. Returns indices into `points`, in a fixed
 * orientation with collinear points dropped, so that two hulls made here can
 * be walked in step.
 */
function convexHull(points: readonly PixelPoint[]): number[] {
  const order = points.map((_, i) => i).sort((i, j) => points[i].x - points[j].x || points[i].y - points[j].y || i - j)
  if (order.length < 3) return order
  const turn = (o: number, a: number, b: number): number => (points[a].x - points[o].x) * (points[b].y - points[o].y) - (points[a].y - points[o].y) * (points[b].x - points[o].x)
  const lower: number[] = []
  for (const i of order) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], i) <= 1e-9) lower.pop()
    lower.push(i)
  }
  const upper: number[] = []
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k]
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], i) <= 1e-9) upper.pop()
    upper.push(i)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** Drop closed-polygon vertices that sit within `tol` of the chord between their neighbours, least deviant first. */
function simplifyClosed(points: readonly PixelPoint[], tol: number): PixelPoint[] {
  const cur = points.map((p) => ({ x: p.x, y: p.y }))
  while (cur.length > 3) {
    let best = -1
    let bestD = tol
    for (let i = 0; i < cur.length; i += 1) {
      const d = perpendicular(cur[i], cur[(i + cur.length - 1) % cur.length], cur[(i + 1) % cur.length])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) break
    cur.splice(best, 1)
  }
  return cur
}

/** Even-odd scanline fill of a polygon into a mask, sampling at pixel centres. */
function fillPolygon(mask: Mask, poly: readonly PixelPoint[]): void {
  if (poly.length < 3) return
  let minV = Number.POSITIVE_INFINITY
  let maxV = Number.NEGATIVE_INFINITY
  for (const p of poly) {
    if (p.y < minV) minV = p.y
    if (p.y > maxV) maxV = p.y
  }
  const y0 = Math.max(0, Math.floor(minV - 0.5))
  const y1 = Math.min(mask.height - 1, Math.ceil(maxV))
  const xs: number[] = []
  for (let y = y0; y <= y1; y += 1) {
    const yc = y + 0.5
    xs.length = 0
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if (a.y <= yc === b.y <= yc) continue
      xs.push(a.x + ((yc - a.y) * (b.x - a.x)) / (b.y - a.y))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5))
      const to = Math.min(mask.width - 1, Math.ceil(xs[k + 1] - 0.5) - 1)
      for (let x = from; x <= to; x += 1) mask.data[y * mask.width + x] = 1
    }
  }
}

// ---------------------------------------------------------------------------
// The building, as corners and faces
// ---------------------------------------------------------------------------

type Vertex = { id: string; world: Vec3; kind: CameraAnchorKind; describe: string }
type Model = { body: { x0: number; x1: number; z0: number; z1: number }; vertices: Vertex[]; faces: Vec3[][]; centre: Vec3; extent: number }

function bodyOf(env: EnvelopeForCamera): { x0: number; x1: number; z0: number; z1: number } {
  if (env.body) return env.body
  const lo = env.ridgeAxis === 'X' ? env.z0 : env.x0
  const hi = env.ridgeAxis === 'X' ? env.z1 : env.x1
  const half = Math.min(env.ridgeAt - lo, hi - env.ridgeAt)
  if (!(half > 0)) return { x0: env.x0, x1: env.x1, z0: env.z0, z1: env.z1 }
  return env.ridgeAxis === 'X' ? { x0: env.x0, x1: env.x1, z0: env.ridgeAt - half, z1: env.ridgeAt + half } : { x0: env.ridgeAt - half, x1: env.ridgeAt + half, z0: env.z0, z1: env.z1 }
}

function modelOf(env: EnvelopeForCamera): Model {
  const b = bodyOf(env)
  const g = env.groundY
  const e = env.eaveY
  const r = env.ridgeY
  const vertices: Vertex[] = []
  const faces: Vec3[][] = []
  const corners: Array<[string, number, number, string]> = [
    ['x0z0', b.x0, b.z0, 'left front'],
    ['x1z0', b.x1, b.z0, 'right front'],
    ['x1z1', b.x1, b.z1, 'right rear'],
    ['x0z1', b.x0, b.z1, 'left rear'],
  ]
  for (const [key, x, z, name] of corners) {
    vertices.push({ id: `ground:${key}`, world: { x, y: g, z }, kind: 'GROUND_CORNER', describe: `the ${name} corner of the main body at the ground` })
    vertices.push({ id: `eave:${key}`, world: { x, y: e, z }, kind: 'EAVE_CORNER', describe: `the ${name} eave corner of the main body` })
  }
  for (let i = 0; i < 4; i += 1) {
    const [, xa, za] = corners[i]
    const [, xb, zb] = corners[(i + 1) % 4]
    faces.push([{ x: xa, y: g, z: za }, { x: xb, y: g, z: zb }, { x: xb, y: e, z: zb }, { x: xa, y: e, z: za }])
  }
  if (env.ridgeAxis === 'X') {
    vertices.push({ id: 'ridge:x0', world: { x: b.x0, y: r, z: env.ridgeAt }, kind: 'RIDGE_END', describe: 'the left end of the ridge' })
    vertices.push({ id: 'ridge:x1', world: { x: b.x1, y: r, z: env.ridgeAt }, kind: 'RIDGE_END', describe: 'the right end of the ridge' })
    for (const x of [b.x0, b.x1]) faces.push([{ x, y: e, z: b.z0 }, { x, y: e, z: b.z1 }, { x, y: r, z: env.ridgeAt }])
    for (const z of [b.z0, b.z1]) faces.push([{ x: b.x0, y: e, z }, { x: b.x1, y: e, z }, { x: b.x1, y: r, z: env.ridgeAt }, { x: b.x0, y: r, z: env.ridgeAt }])
  } else {
    vertices.push({ id: 'ridge:z0', world: { x: env.ridgeAt, y: r, z: b.z0 }, kind: 'RIDGE_END', describe: 'the front end of the ridge' })
    vertices.push({ id: 'ridge:z1', world: { x: env.ridgeAt, y: r, z: b.z1 }, kind: 'RIDGE_END', describe: 'the rear end of the ridge' })
    for (const z of [b.z0, b.z1]) faces.push([{ x: b.x0, y: e, z }, { x: b.x1, y: e, z }, { x: env.ridgeAt, y: r, z }])
    for (const x of [b.x0, b.x1]) faces.push([{ x, y: e, z: b.z0 }, { x, y: e, z: b.z1 }, { x: env.ridgeAt, y: r, z: b.z1 }, { x: env.ridgeAt, y: r, z: b.z0 }])
  }
  ;(env.attached ?? []).forEach((box, i) => {
    const boxCorners: Array<[string, number, number]> = [
      ['x0z0', box.x0, box.z0],
      ['x1z0', box.x1, box.z0],
      ['x1z1', box.x1, box.z1],
      ['x0z1', box.x0, box.z1],
    ]
    for (const [key, x, z] of boxCorners) {
      vertices.push({ id: `attached${i}:top:${key}`, world: { x, y: box.topY, z }, kind: 'ATTACHED_TOP_CORNER', describe: `a top corner of attached body ${i + 1}` })
      vertices.push({ id: `attached${i}:ground:${key}`, world: { x, y: g, z }, kind: 'GROUND_CORNER', describe: `a ground corner of attached body ${i + 1}` })
    }
    for (let k = 0; k < 4; k += 1) {
      const [, xa, za] = boxCorners[k]
      const [, xb, zb] = boxCorners[(k + 1) % 4]
      faces.push([{ x: xa, y: g, z: za }, { x: xb, y: g, z: zb }, { x: xb, y: box.topY, z: zb }, { x: xa, y: box.topY, z: za }])
    }
    faces.push(boxCorners.map(([, x, z]) => ({ x, y: box.topY, z })))
  })
  // Two bodies can share a corner; one point, one anchor.
  const unique: Vertex[] = []
  for (const v of vertices) if (!unique.some((u) => Math.abs(u.world.x - v.world.x) < 1e-6 && Math.abs(u.world.y - v.world.y) < 1e-6 && Math.abs(u.world.z - v.world.z) < 1e-6)) unique.push(v)
  const xs = unique.map((v) => v.world.x)
  const ys = unique.map((v) => v.world.y)
  const zs = unique.map((v) => v.world.z)
  const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs))
  return { body: b, vertices: unique, faces, centre, extent }
}

/** Which corners a viewpoint puts on the silhouette's hull, in hull order, from a spread of canonical viewpoints. */
function hullHypotheses(model: Model): Array<{ ids: string[]; points: PixelPoint[]; sides: VisibleSide[] }> {
  const seen = new Set<string>()
  const out: Array<{ ids: string[]; points: PixelPoint[]; sides: VisibleSide[] }> = []
  const radius = 3 * model.extent
  const yLow = Math.min(...model.vertices.map((v) => v.world.y))
  const yHigh = Math.max(...model.vertices.map((v) => v.world.y))
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (const azimuthDeg of [20, 45, 70]) {
      for (const height of [0.25, 0.7, 1.8]) {
        const from = { x: model.centre.x + radius * dx * Math.sin(azimuthDeg * DEG), y: yLow + height * (yHigh - yLow), z: model.centre.z + radius * dz * Math.cos(azimuthDeg * DEG) }
        const p = lookAtProjection(from, model.centre, 1000)
        const projected = model.vertices.map((v) => through(p, v.world))
        if (projected.some((q) => q === null || q.s <= 0)) continue
        const pts = projected.map((q) => ({ x: (q as { u: number }).u, y: (q as { v: number }).v }))
        const hull = convexHull(pts)
        const ids = hull.map((i) => model.vertices[i].id)
        // canonical rotation, so the same sequence from two viewpoints is one hypothesis
        let start = 0
        for (let i = 1; i < ids.length; i += 1) if (ids[i] < ids[start]) start = i
        const key = ids.map((_, i) => ids[(start + i) % ids.length]).join('|')
        if (seen.has(key)) continue
        seen.add(key)
        const sides: VisibleSide[] = [dz < 0 ? 'FRONT' : 'REAR', dx < 0 ? 'LEFT' : 'RIGHT']
        out.push({ ids, points: hull.map((i) => pts[i]), sides })
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The silhouette
// ---------------------------------------------------------------------------

type OutlineVertex = { p: PixelPoint; convex: boolean }
type Silhouette = { mask: Mask; pixels: number; bounds: PixelRect; hull: PixelPoint[]; vertices: OutlineVertex[]; why: string }

const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b

/**
 * Sky, by colour AND by where it is: bright, low-chroma or blue-leaning
 * pixels reached from the top edge of the picture through steps small enough
 * to be a gradient. A white wall is as bright and as neutral as a pale sky,
 * and the only thing that separates them is the hard edge between them.
 */
function skyMask(raster: Raster): Mask {
  const { width: w, height: h, data } = raster
  const like = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    if (data[o + 3] < 128) {
      like[i] = 1
      continue
    }
    const hi = Math.max(r, g, b)
    const lo = Math.min(r, g, b)
    const green = g - Math.max(r, b) >= 8
    const blue = b - Math.max(r, g) >= 6 && luma(r, g, b) >= 80
    const pale = luma(r, g, b) >= 140 && hi - lo <= 90
    like[i] = !green && (blue || pale) ? 1 : 0
  }
  const out = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  let top = 0
  for (let x = 0; x < w; x += 1) {
    if (like[x] === 1 && out[x] === 0) {
      out[x] = 1
      stack[top++] = x
    }
  }
  const step = 12
  while (top > 0) {
    const idx = stack[--top]
    const x = idx % w
    const y = (idx - x) / w
    const o = idx * 4
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const ni = ny * w + nx
      if (out[ni] === 1 || like[ni] === 0) continue
      const no = ni * 4
      if (data[o + 3] >= 128 && data[no + 3] >= 128 && (Math.abs(data[o] - data[no]) > step || Math.abs(data[o + 1] - data[no + 1]) > step || Math.abs(data[o + 2] - data[no + 2]) > step)) continue
      out[ni] = 1
      stack[top++] = ni
    }
  }
  return { width: w, height: h, data: out }
}

/** The largest 8-connected region of a mask, as its own mask. */
function largestComponent(m: Mask): { mask: Mask; pixels: number; bounds: PixelRect } | null {
  const { width: w, height: h, data } = m
  const label = new Int32Array(w * h).fill(-1)
  const stack = new Int32Array(w * h)
  let best: { pixels: number; bounds: PixelRect; id: number } | null = null
  let next = 0
  for (let start = 0; start < w * h; start += 1) {
    if (data[start] !== 1 || label[start] >= 0) continue
    const id = next++
    let top = 0
    stack[top++] = start
    label[start] = id
    let pixels = 0
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1
    while (top > 0) {
      const idx = stack[--top]
      const x = idx % w
      const y = (idx - x) / w
      pixels += 1
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (data[ni] !== 1 || label[ni] >= 0) continue
          label[ni] = id
          stack[top++] = ni
        }
      }
    }
    if (!best || pixels > best.pixels) best = { pixels, bounds: { x0, y0, x1, y1 }, id }
  }
  if (!best) return null
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i += 1) if (label[i] === best.id) out[i] = 1
  return { mask: { width: w, height: h, data: out }, pixels: best.pixels, bounds: best.bounds }
}

/**
 * Fit a line to the raw points of one edge of a chain, keeping clear of the
 * corners at either end. A single-step edge is a jump across a pixel
 * boundary — a vertical wall seen in a column profile — and the boundary
 * itself is the line.
 */
function chainEdgeLine(raw: readonly PixelPoint[], i0: number, i1: number, alongX: boolean): Line | null {
  if (i1 - i0 <= 1) {
    const a = raw[i0]
    const b = raw[i1]
    return alongX ? { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: { x: 0, y: 1 } } : { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: { x: 1, y: 0 } }
  }
  const margin = Math.min(2, Math.floor((i1 - i0) / 4))
  const pts = raw.slice(i0 + margin, i1 - margin + 1)
  return (pts.length >= 3 ? fitLine(pts) : null) ?? lineThrough(raw[i0], raw[i1])
}

/** Corners along one profile chain: where two fitted edges meet at a real angle. */
function chainKinks(raw: readonly PixelPoint[], alongX: boolean, tol: number): PixelPoint[] {
  if (raw.length < 3) return []
  const simplified = simplifyPolyline(raw, tol)
  const indexOf = (p: PixelPoint): number => Math.round((alongX ? p.x - raw[0].x : p.y - raw[0].y))
  const idx = simplified.map(indexOf).filter((i) => i >= 0 && i < raw.length)
  const out: PixelPoint[] = []
  for (let k = 1; k + 1 < idx.length; k += 1) {
    const before = chainEdgeLine(raw, idx[k - 1], idx[k], alongX)
    const after = chainEdgeLine(raw, idx[k], idx[k + 1], alongX)
    if (!before || !after || lineAngleDeg(before, after) < 5) continue
    const hit = intersectLines(before, after)
    const v = raw[idx[k]]
    out.push(hit && dist2(hit, v) <= 3 ? hit : v)
  }
  return out
}

function detectSilhouette(raster: Raster): Silhouette | null {
  const { width: w, height: h, data } = raster
  if (w < 8 || h < 8) return null
  const sky = skyMask(raster)
  const candidate = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4
    if (data[o + 3] < 128 || sky.data[i] === 1) continue
    const green = data[o + 1] - Math.max(data[o], data[o + 2]) >= 8 && data[o + 1] >= 40
    if (!green) candidate[i] = 1
  }
  const biggest = largestComponent({ width: w, height: h, data: candidate })
  if (!biggest) return null
  const { mask, pixels, bounds } = biggest
  if (pixels < 0.005 * w * h) return null
  const spanX = bounds.x1 - bounds.x0 + 1
  const spanY = bounds.y1 - bounds.y0 + 1
  if (spanX >= 0.98 * w && spanY >= 0.98 * h) return null

  // The outline as four profiles, each point put on the pixel's outer edge so
  // that its error against the true edge is zero-mean rather than half a pixel inward.
  const top = profileTop(mask)
  const bottom = profileBottom(mask)
  const left = new Int32Array(h).fill(-1)
  const right = new Int32Array(h).fill(-1)
  for (let y = bounds.y0; y <= bounds.y1; y += 1) {
    const base = y * w
    for (let x = bounds.x0; x <= bounds.x1; x += 1) {
      if (mask.data[base + x] !== 1) continue
      if (left[y] < 0) left[y] = x
      right[y] = x
    }
  }
  const topChain: PixelPoint[] = []
  const bottomChain: PixelPoint[] = []
  for (let x = bounds.x0; x <= bounds.x1; x += 1) {
    if (top[x] < 0) continue
    topChain.push({ x: x + 0.5, y: top[x] })
    bottomChain.push({ x: x + 0.5, y: bottom[x] + 1 })
  }
  const leftChain: PixelPoint[] = []
  const rightChain: PixelPoint[] = []
  for (let y = bounds.y0; y <= bounds.y1; y += 1) {
    if (left[y] < 0) continue
    leftChain.push({ x: left[y], y: y + 0.5 })
    rightChain.push({ x: right[y] + 1, y: y + 0.5 })
  }
  const cloud = topChain.concat(bottomChain, leftChain, rightChain)
  const tol = 1.25
  const rawHull = convexHull(cloud).map((i) => cloud[i])
  const coarse = simplifyClosed(rawHull, tol)

  // Each hull edge re-fitted to the outline points along it, and the corners
  // taken where neighbouring fits meet: a corner to a fraction of a pixel.
  const edgeLines: Array<Line | null> = coarse.map((a, i) => {
    const b = coarse[(i + 1) % coarse.length]
    const len = dist2(a, b)
    const margin = Math.min(2.5, len / 4)
    const chord = lineThrough(a, b)
    if (!chord) return null
    const along: PixelPoint[] = []
    for (const p of cloud) {
      const t = (p.x - a.x) * chord.d.x + (p.y - a.y) * chord.d.y
      if (t < margin || t > len - margin) continue
      if (perpendicular(p, a, b) <= 1) along.push(p)
    }
    return (along.length >= 3 ? fitLine(along) : null) ?? chord
  })
  const hull = coarse.map((v, i) => {
    const before = edgeLines[(i + coarse.length - 1) % coarse.length]
    const after = edgeLines[i]
    if (!before || !after || lineAngleDeg(before, after) < 4) return v
    const hit = intersectLines(before, after)
    return hit && dist2(hit, v) <= 3 ? hit : v
  })

  const vertices: OutlineVertex[] = hull.map((p) => ({ p, convex: true }))
  const kinks = chainKinks(topChain, true, tol).concat(chainKinks(bottomChain, true, tol), chainKinks(leftChain, false, tol), chainKinks(rightChain, false, tol))
  for (const k of kinks) if (!vertices.some((v) => dist2(v.p, k) <= 2)) vertices.push({ p: k, convex: false })

  return {
    mask,
    pixels,
    bounds,
    hull,
    vertices,
    why: `a silhouette of ${pixels} px against sky and vegetation, ${spanX}×${spanY} px, with ${hull.length} hull corners and ${vertices.length - hull.length} further kinks in its outline`,
  }
}

// ---------------------------------------------------------------------------
// Aligning a predicted hull with the detected one
// ---------------------------------------------------------------------------

const unitBox = (points: readonly PixelPoint[]): PixelPoint[] => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const sx = Math.max(1e-9, Math.max(...xs) - x0)
  const sy = Math.max(1e-9, Math.max(...ys) - y0)
  return points.map((p) => ({ x: (p.x - x0) / sx, y: (p.y - y0) / sy }))
}

/**
 * Cyclic, order-preserving alignment of two convex polygons, each scaled to
 * its own unit box so that only the SHAPE is compared. Either side may skip
 * corners at a price; a match costs its distance. The detected hull is
 * rotated through every start, and the cheapest alignment wins.
 */
function alignHulls(predicted: readonly PixelPoint[], detected: readonly PixelPoint[]): { pairs: Array<[number, number]>; cost: number } {
  const p = unitBox(predicted)
  const d = unitBox(detected)
  const m = p.length
  const n = d.length
  const matchMax = 0.35
  const skipP = 0.18
  const skipD = 0.1
  let best: { pairs: Array<[number, number]>; cost: number } = { pairs: [], cost: Number.POSITIVE_INFINITY }
  for (let k = 0; k < n; k += 1) {
    const cost = new Float64Array((m + 1) * (n + 1))
    const move = new Int8Array((m + 1) * (n + 1))
    const at = (i: number, j: number): number => i * (n + 1) + j
    for (let i = 1; i <= m; i += 1) {
      cost[at(i, 0)] = i * skipP
      move[at(i, 0)] = 1
    }
    for (let j = 1; j <= n; j += 1) {
      cost[at(0, j)] = j * skipD
      move[at(0, j)] = 2
    }
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const c = dist2(p[i - 1], d[(j - 1 + k) % n])
        let bestHere = cost[at(i - 1, j)] + skipP
        let how = 1
        const viaSkipD = cost[at(i, j - 1)] + skipD
        if (viaSkipD < bestHere) {
          bestHere = viaSkipD
          how = 2
        }
        if (c <= matchMax && cost[at(i - 1, j - 1)] + c <= bestHere) {
          bestHere = cost[at(i - 1, j - 1)] + c
          how = 0
        }
        cost[at(i, j)] = bestHere
        move[at(i, j)] = how
      }
    }
    const total = cost[at(m, n)]
    if (total >= best.cost) continue
    const pairs: Array<[number, number]> = []
    let i = m
    let j = n
    while (i > 0 || j > 0) {
      const how = move[at(i, j)]
      if (how === 0) {
        pairs.push([i - 1, (j - 1 + k) % n])
        i -= 1
        j -= 1
      } else if (how === 1) i -= 1
      else j -= 1
    }
    pairs.reverse()
    best = { pairs, cost: total }
  }
  return best
}

// ---------------------------------------------------------------------------
// Solving
// ---------------------------------------------------------------------------

type Matched = { vertex: Vertex; image: PixelPoint; convex: boolean }
type Candidate = { solution: CameraSolution; anchors: Matched[]; rejected: Array<{ anchorId: string; residualPx: number; why: string }>; iou: number; sides: VisibleSide[] }

const correspondences = (matched: readonly Matched[]): WorldCorrespondence[] => matched.map((m) => ({ id: m.vertex.id, world: m.vertex.world, pixel: { u: m.image.x, v: m.image.y } }))

/** Errors from a solution, keyed by id: `solveCamera` reports them in id order, not in the caller's. */
function errorsById(solution: CameraSolution, matched: readonly Matched[]): Map<string, number> {
  const ids = matched.map((m) => m.vertex.id).sort((a, b) => a.localeCompare(b))
  const out = new Map<string, number>()
  ids.forEach((id, i) => out.set(id, solution.errorsPx[i] ?? Number.POSITIVE_INFINITY))
  return out
}

const depthSign = (projection: readonly number[], centre: Vec3): number => {
  const c = through(projection, centre)
  return c && c.s < 0 ? -1 : 1
}

/** The silhouette a camera would produce from the model: every face filled, front or back, because a silhouette does not care. */
function predictedMask(projection: readonly number[], sign: number, model: Model, width: number, height: number): Mask {
  const mask: Mask = { width, height, data: new Uint8Array(width * height) }
  for (const face of model.faces) {
    const poly: PixelPoint[] = []
    let ok = true
    for (const v of face) {
      const q = through(projection, v)
      if (!q || q.s * sign <= 0) {
        ok = false
        break
      }
      poly.push({ x: q.u, y: q.v })
    }
    if (ok) fillPolygon(mask, poly)
  }
  return mask
}

const maskIoU = (a: Mask, b: Mask): number => {
  let inter = 0
  let union = 0
  for (let i = 0; i < a.data.length; i += 1) {
    const x = a.data[i] === 1
    const y = b.data[i] === 1
    if (x && y) inter += 1
    if (x || y) union += 1
  }
  return union === 0 ? 0 : inter / union
}

/**
 * Is this point on the edge of the mask — set pixels and unset ones both
 * within two of it? A corner the frame cuts off, up to `slack` px outside it,
 * is judged at the nearest pixel inside: its edges still meet there.
 */
function onBoundary(mask: Mask, p: PixelPoint, slack: number): boolean {
  if (p.x < -slack || p.y < -slack || p.x >= mask.width + slack || p.y >= mask.height + slack) return false
  const px = Math.min(mask.width - 1, Math.max(0, Math.floor(p.x)))
  const py = Math.min(mask.height - 1, Math.max(0, Math.floor(p.y)))
  let inside = false
  let outside = false
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = px + dx
      const y = py + dy
      const set = x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.data[y * mask.width + x] === 1
      if (set) inside = true
      else outside = true
    }
  }
  return inside && outside
}

/**
 * From a first camera to a finished one: ask it which corners lie on the
 * outline, take the outline vertex nearest each (mutually nearest, so no
 * vertex is claimed twice), re-solve, drop what does not fit, re-solve once.
 */
function refine(initial: CameraSolution, model: Model, silhouette: Silhouette, width: number, height: number, maxResidualPx: number, minAnchors: number): { solution: CameraSolution; anchors: Matched[]; rejected: Candidate['rejected'] } | null {
  const sign = depthSign(initial.projection, model.centre)
  const predicted = predictedMask(initial.projection, sign, model, width, height)
  const projected = model.vertices.map((v) => {
    const q = through(initial.projection, v.world)
    return q && q.s * sign > 0 ? { x: q.u, y: q.v } : null
  })
  const nearestOutline = new Map<number, number>()
  projected.forEach((p, i) => {
    if (!p || !onBoundary(predicted, p, maxResidualPx)) return
    let best = -1
    let bestD = maxResidualPx
    silhouette.vertices.forEach((v, j) => {
      const d = dist2(v.p, p)
      if (d < bestD) {
        bestD = d
        best = j
      }
    })
    if (best >= 0) nearestOutline.set(i, best)
  })
  const matched: Matched[] = []
  for (const [i, j] of nearestOutline) {
    // mutual: no other predicted corner is nearer to this outline vertex
    const p = projected[i] as PixelPoint
    const d = dist2(silhouette.vertices[j].p, p)
    let mine = true
    for (const [k, l] of nearestOutline) if (l === j && k !== i && dist2(silhouette.vertices[l].p, projected[k] as PixelPoint) < d) mine = false
    if (mine) matched.push({ vertex: model.vertices[i], image: silhouette.vertices[j].p, convex: silhouette.vertices[j].convex })
  }
  matched.sort((a, b) => a.vertex.id.localeCompare(b.vertex.id))
  if (matched.length < minAnchors) return null
  let solution = solveCamera(correspondences(matched))
  if (!solution) return null
  let errors = errorsById(solution, matched)
  const rejected: Candidate['rejected'] = []
  const kept = matched.filter((m) => (errors.get(m.vertex.id) ?? Number.POSITIVE_INFINITY) <= maxResidualPx)
  if (kept.length < matched.length) {
    for (const m of matched) {
      if (kept.includes(m)) continue
      const e = errors.get(m.vertex.id) ?? Number.POSITIVE_INFINITY
      rejected.push({ anchorId: m.vertex.id, residualPx: round6(e), why: `${m.vertex.describe} lands ${e.toFixed(1)} px from the outline vertex it was matched to, beyond the ${maxResidualPx.toFixed(1)} px allowed` })
    }
    if (kept.length < minAnchors) return null
    const again = solveCamera(correspondences(kept))
    if (!again) return null
    solution = again
    errors = errorsById(solution, kept)
  }
  if (solution.rmsPx > maxResidualPx) return null
  return { solution, anchors: kept, rejected }
}

function sidesSeenFrom(centre: Vec3, env: EnvelopeForCamera): VisibleSide[] {
  const out: VisibleSide[] = []
  if (centre.z < env.z0) out.push('FRONT')
  if (centre.z > env.z1) out.push('REAR')
  if (centre.x < env.x0) out.push('LEFT')
  if (centre.x > env.x1) out.push('RIGHT')
  return out
}

/** A ridge end is a gable apex when the gable wall it sits on is one the camera sees. */
function kindSeen(vertex: Vertex, env: EnvelopeForCamera, sides: readonly VisibleSide[]): CameraAnchorKind {
  if (vertex.kind !== 'RIDGE_END') return vertex.kind
  const wall: VisibleSide = env.ridgeAxis === 'X' ? (vertex.id.endsWith('x0') ? 'LEFT' : 'RIGHT') : vertex.id.endsWith('z0') ? 'FRONT' : 'REAR'
  return sides.includes(wall) ? 'GABLE_APEX' : 'RIDGE_END'
}

/**
 * Solve the camera of a rendered perspective view from the building's
 * silhouette and its known envelope.
 *
 * Returns `null` when no silhouette stands against the background, when no
 * hypothesis explains its corners with at least `minAnchors` of them inside
 * `maxResidualPx`, or when the corners it has cannot fix a camera.
 */
export function solvePerspectiveCamera(raster: Raster, frameId: string, envelope: EnvelopeForCamera, options: PerspectiveCameraOptions = {}): PerspectiveCameraV2 | null {
  const maxResidualPx = options.maxResidualPx ?? 0.02 * raster.width
  const minAnchors = Math.max(6, Math.floor(options.minAnchors ?? 6))
  const silhouette = detectSilhouette(raster)
  if (!silhouette || silhouette.hull.length < 4) return null
  const model = modelOf(envelope)
  const hypotheses = hullHypotheses(model)

  const candidates: Candidate[] = []
  for (const hypothesis of hypotheses) {
    const aligned = alignHulls(hypothesis.points, silhouette.hull)
    if (aligned.pairs.length < minAnchors) continue
    const matched: Matched[] = aligned.pairs.map(([i, j]) => {
      const vertex = model.vertices.find((v) => v.id === hypothesis.ids[i]) as Vertex
      return { vertex, image: silhouette.hull[j], convex: true }
    })
    const first = solveCamera(correspondences(matched))
    if (!first || first.rmsPx > 3 * maxResidualPx) continue
    const refined = refine(first, model, silhouette, raster.width, raster.height, maxResidualPx, minAnchors)
    if (!refined) continue
    const sign = depthSign(refined.solution.projection, model.centre)
    const iou = maskIoU(predictedMask(refined.solution.projection, sign, model, raster.width, raster.height), silhouette.mask)
    candidates.push({ ...refined, iou, sides: hypothesis.sides })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => Math.round(b.iou * 100) - Math.round(a.iou * 100) || a.solution.rmsPx - b.solution.rmsPx || b.anchors.length - a.anchors.length)
  const best = candidates[0]

  const visibleSides = sidesSeenFrom(best.solution.centre, envelope)
  const errors = errorsById(best.solution, best.anchors)
  const anchors: CameraAnchor[] = best.anchors.map((m) => {
    const e = errors.get(m.vertex.id) ?? 0
    return {
      id: m.vertex.id,
      world: { x: round6(m.vertex.world.x), y: round6(m.vertex.world.y), z: round6(m.vertex.world.z) },
      image: { u: round6(m.image.x), v: round6(m.image.y) },
      kind: kindSeen(m.vertex, envelope, visibleSides),
      confidence: round6(Math.max(0, Math.min(1, 1 - e / maxResidualPx))),
      why: `${m.vertex.describe}, seen as a ${m.convex ? 'convex corner' : 'kink'} of the silhouette at (${m.image.x.toFixed(1)}, ${m.image.y.toFixed(1)}) px, ${e.toFixed(2)} px from where the camera puts it`,
    }
  })
  const rms = best.solution.rmsPx
  const worst = best.solution.maxPx
  const confidence = round6(Math.max(0, Math.min(1, 0.5 * (1 - rms / maxResidualPx) + 0.25 * Math.min(1, anchors.length / 10) + 0.25 * best.iou)))
  const c = best.solution.centre
  return {
    frameId,
    solution: best.solution,
    anchors,
    rejected: best.rejected,
    residualPx: { rms: round6(rms), max: round6(worst) },
    visibleSides,
    confidence,
    why:
      `${silhouette.why}; of ${hypotheses.length} viewpoint hypotheses, ${candidates.length} resect a camera, and the one seeing ${visibleSides.join('+') || 'no facade'} ` +
      `covers ${(best.iou * 100).toFixed(1)}% of the silhouette (IoU) from ${anchors.length} anchors that reproject ${rms.toFixed(2)} px rms and ${worst.toFixed(2)} px worst; ` +
      `the camera stands at (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}) m with a ${best.solution.focalPx.x.toFixed(0)} px focal length`,
  }
}

const anchorsCentre = (camera: PerspectiveCameraV2): Vec3 => {
  const n = Math.max(1, camera.anchors.length)
  return {
    x: camera.anchors.reduce((a, p) => a + p.world.x, 0) / n,
    y: camera.anchors.reduce((a, p) => a + p.world.y, 0) / n,
    z: camera.anchors.reduce((a, p) => a + p.world.z, 0) / n,
  }
}

/** Signed depth of a world point in front of the camera: positive ahead, larger further away. */
const depthOf = (camera: PerspectiveCameraV2, p: Vec3): number | null => {
  const q = through(camera.solution.projection, p)
  return q ? q.s * depthSign(camera.solution.projection, anchorsCentre(camera)) : null
}

/** Where a world point appears in the picture, or null when it is behind the camera. */
export function projectPoint(camera: PerspectiveCameraV2, p: { x: number; y: number; z: number }): { u: number; v: number } | null {
  const depth = depthOf(camera, p)
  if (depth === null || depth <= 0) return null
  const q = projectThrough(camera.solution, p)
  return q ? { u: round6(q.u), v: round6(q.v) } : null
}

/** Depth ordering: is world point `a` nearer the camera than `b`? A point behind the camera is never nearer. */
export function nearer(camera: PerspectiveCameraV2, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
  const da = depthOf(camera, a)
  const db = depthOf(camera, b)
  if (da === null || db === null || da <= 0) return false
  if (db <= 0) return true
  return da < db
}
