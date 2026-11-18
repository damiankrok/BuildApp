/**
 * v3.54.3 — the model as the consultant sees it: one neutral render profile, fixed cameras, full surfaces.
 *
 * Two pictures of the compiled scene, by a small z-buffered software rasteriser (no GPU, no browser — the host renders
 * them itself):
 *   SIDES  the four orthographic sides — front, right, rear, left — in one row, ALL AT ONE SCALE and on one ground
 *          line, so heights and widths compare between sides and against an elevation drawing;
 *   AROUND the top and the four corner axonometrics, each fitted to its tile.
 * Colours are the scene's own materials, flat-shaded; no style of the app, no transparency. The picture's bytes are a
 * function of the scene alone, so the hash recorded with a consultation names exactly what was looked at.
 *
 * The sides are named as the model's frame names them: FRONT is the face at z = 0 seen with x to the right; RIGHT is the
 * face at max x; REAR the face at max z seen with x to the left; LEFT the face at min x.
 */
import { createHash } from 'node:crypto'
import type { MobileSceneBundle } from '@buildapp/mobile-scene'
import { encodePng } from '../diagnostics.js'

export const MODEL_VIEWS_PROFILE = 'neutral-flat/1' as const

type V3 = [number, number, number]
type View = { name: string; project: (p: V3) => V3 }
export type ModelViewPicture = { name: 'SIDES' | 'AROUND'; png: Uint8Array; width: number; height: number; labels: string; sha256: string; /** SIDES only (v3.54.4): pixels per metre and the row of the ground floor level (y = 0), for a ruler drawn beside the picture. */ frame?: { pxPerM: number; rowOfZero: number; tile: number } }

const hex = (c: string | undefined): V3 => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? '')
  if (!m) return [200, 200, 200]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

type Tri = { p: V3[]; c: V3 }

function draw(data: Uint8ClampedArray, W: number, ox: number, oy: number, tw: number, th: number, tris: readonly Tri[], scale: number, mx: number, my: number, cy: number, depthShade?: (z: number) => number, depthOut?: Float64Array): void {
  const depth = depthOut ?? new Float64Array(tw * th).fill(-Infinity)
  const light: V3 = [0.35, 0.8, 0.5]
  for (const t of tris) {
    const s = t.p.map((q) => [tw / 2 + (q[0] - mx) * scale, cy - (q[1] - my) * scale, q[2]] as V3)
    const u: V3 = [t.p[1][0] - t.p[0][0], t.p[1][1] - t.p[0][1], t.p[1][2] - t.p[0][2]]
    const v: V3 = [t.p[2][0] - t.p[0][0], t.p[2][1] - t.p[0][1], t.p[2][2] - t.p[0][2]]
    const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n) || 1
    const shade = 0.45 + 0.55 * Math.abs((n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / len)
    const minX = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0])))
    const maxX = Math.min(tw - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])))
    const minY = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1])))
    const maxY = Math.min(th - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])))
    const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1])
    if (Math.abs(area) < 1e-9) continue
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((s[1][0] - px) * (s[2][1] - py) - (s[2][0] - px) * (s[1][1] - py)) / area
        const w1 = ((s[2][0] - px) * (s[0][1] - py) - (s[0][0] - px) * (s[2][1] - py)) / area
        const w2 = 1 - w0 - w1
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue
        const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2]
        const k = y * tw + x
        if (z <= depth[k]) continue
        depth[k] = z
        const o = ((oy + y) * W + ox + x) * 4
        const f = depthShade ? shade * depthShade(z) : shade
        data[o] = Math.min(255, t.c[0] * f)
        data[o + 1] = Math.min(255, t.c[1] * f)
        data[o + 2] = Math.min(255, t.c[2] * f)
        data[o + 3] = 255
      }
    }
  }
  for (let i = 0; i < tw; i += 1) for (const y of [oy, oy + th - 1]) data.fill(180, (y * W + ox + i) * 4, (y * W + ox + i) * 4 + 3)
  for (let i = 0; i < th; i += 1) for (const x of [ox, ox + tw - 1]) data.fill(180, ((oy + i) * W + x) * 4, ((oy + i) * W + x) * 4 + 3)
}

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')

/** The two pictures of a scene the post-build check is shown. `tile`: the side of one tile in pixels. */
export function renderModelViews(bundle: MobileSceneBundle, tile = 420): ModelViewPicture[] {
  const colours = new Map<string, V3>()
  for (const m of (bundle as unknown as { materials?: Array<{ id: string; color?: string }> }).materials ?? []) colours.set(m.id, hex(m.color))
  const b = bundle.scene.bounds
  const cx = b ? (b.min.x + b.max.x) / 2 : 0
  const cy = b ? (b.min.y + b.max.y) / 2 : 0
  const cz = b ? (b.min.z + b.max.z) / 2 : 0
  const trisOf = (view: View): { tris: Tri[]; lo: [number, number]; hi: [number, number] } => {
    const tris: Tri[] = []
    const lo: [number, number] = [Infinity, Infinity]
    const hi: [number, number] = [-Infinity, -Infinity]
    for (const mesh of bundle.scene.meshes) {
      const base = colours.get(mesh.materialId ?? '') ?? [200, 200, 200]
      for (let i = 0; i + 8 < mesh.positions.length; i += 9) {
        const p = [0, 1, 2].map((k) => view.project([mesh.positions[i + k * 3], mesh.positions[i + k * 3 + 1], mesh.positions[i + k * 3 + 2]]))
        for (const q of p) {
          lo[0] = Math.min(lo[0], q[0])
          lo[1] = Math.min(lo[1], q[1])
          hi[0] = Math.max(hi[0], q[0])
          hi[1] = Math.max(hi[1], q[1])
        }
        tris.push({ p, c: base })
      }
    }
    return { tris, lo, hi }
  }
  // screen x, screen y (up), depth (towards the viewer is larger)
  const sides: View[] = [
    { name: 'FRONT', project: ([x, y, z]) => [x - cx, y - cy, -(z - cz)] },
    { name: 'RIGHT', project: ([x, y, z]) => [z - cz, y - cy, x - cx] },
    { name: 'REAR', project: ([x, y, z]) => [-(x - cx), y - cy, z - cz] },
    { name: 'LEFT', project: ([x, y, z]) => [-(z - cz), y - cy, -(x - cx)] },
  ]
  const out: ModelViewPicture[] = []
  {
    const drawn = sides.map(trisOf)
    const span = Math.max(...drawn.map((d) => Math.max(d.hi[0] - d.lo[0], d.hi[1] - d.lo[1])), 1e-6)
    const scale = (tile * 0.9) / span
    const lowY = Math.min(...drawn.map((d) => d.lo[1]))
    const highY = Math.max(...drawn.map((d) => d.hi[1]))
    const th = Math.max(120, Math.ceil((highY - lowY) * scale + tile * 0.1))
    const W = tile * 4
    const data = new Uint8ClampedArray(W * th * 4).fill(255)
    // one ground line for the four: the scene's lowest point sits the same distance above each tile's bottom
    drawn.forEach((d, i) => draw(data, W, i * tile, 0, tile, th, d.tris, scale, (d.lo[0] + d.hi[0]) / 2, lowY, th - tile * 0.05))
    const png = encodePng({ width: W, height: th, data })
    out.push({ name: 'SIDES', png, width: W, height: th, labels: `four tiles ${tile} px wide, left to right: FRONT, RIGHT, REAR, LEFT — orthographic, all at one scale and on one ground line`, sha256: sha(png), frame: { pxPerM: scale, rowOfZero: th - tile * 0.05 - (0 - cy - lowY) * scale, tile } })
  }
  {
    const ay = (35 * Math.PI) / 180
    const ax = (30 * Math.PI) / 180
    const axo = (name: string, turn: number): View => ({
      name,
      project: ([x, y, z]) => {
        const X = x - cx
        const Y = y - cy
        const Z = -(z - cz)
        const x1 = X * Math.cos(turn) + Z * Math.sin(turn)
        const z1 = -X * Math.sin(turn) + Z * Math.cos(turn)
        return [x1, Y * Math.cos(ax) - z1 * Math.sin(ax), Y * Math.sin(ax) + z1 * Math.cos(ax)]
      },
    })
    const views: View[] = [{ name: 'TOP', project: ([x, y, z]) => [x - cx, z - cz, y - cy] }, axo('front-right', ay), axo('front-left', -ay), axo('rear-left', ay + Math.PI), axo('rear-right', Math.PI - ay)]
    const W = tile * views.length
    const data = new Uint8ClampedArray(W * tile * 4).fill(255)
    views.forEach((v, i) => {
      const d = trisOf(v)
      const span = Math.max(d.hi[0] - d.lo[0], d.hi[1] - d.lo[1], 1e-6)
      draw(data, W, i * tile, 0, tile, tile, d.tris, (tile * 0.88) / span, (d.lo[0] + d.hi[0]) / 2, (d.lo[1] + d.hi[1]) / 2, tile / 2)
    })
    const png = encodePng({ width: W, height: tile, data })
    out.push({ name: 'AROUND', png, width: W, height: tile, labels: `five tiles ${tile} px wide, left to right: TOP (the front at the bottom), then axonometrics from the front-right, front-left, rear-left and rear-right corners`, sha256: sha(png) })
  }
  return out
}

/**
 * v3.54.7 — one side of the model drawn IN THE FRAME OF ITS ELEVATION: the same width and height in pixels as the
 * elevation picture as sent, the model's along-the-side metres placed on the columns the registration gives them
 * (`along = mPerPx·col + alongAtPx0`) and its heights on the rows (`row = zeroRowPx − y/|mPerPx|`). A region named in
 * pixels of the elevation is then the same region of the model: the comparison of source and render needs no second
 * guess of where things are. Orthographic; the same flat colours as `renderModelViews`. Along a side is measured as the
 * scene ruler measures it (from the left end of the exterior walls as a viewer outside sees them), so `walls` is the
 * box of the exterior walls of the same scene.
 */
/** v3.54.7: how much a face is darkened at SIDE_DEPTH_SPAN_M or more behind the nearest face of its side. */
export const SIDE_DEPTH_SHADE = 0.4
export const SIDE_DEPTH_SPAN_M = 2.5
/** v3.54.7: a step in depth larger than this between neighbouring pixels is drawn as an edge. */
export const SIDE_EDGE_STEP_M = 0.15
export type SideFrame = { width: number; height: number; mPerPx: number; alongAtPx0: number; zeroRowPx: number }
export function renderSideInFrame(bundle: MobileSceneBundle, side: 'FRONT' | 'RIGHT' | 'REAR' | 'LEFT', walls: { x0: number; x1: number; z0: number; z1: number }, frame: SideFrame): { png: Uint8Array; sha256: string; width: number; height: number } {
  const colours = new Map<string, V3>()
  for (const m of (bundle as unknown as { materials?: Array<{ id: string; color?: string }> }).materials ?? []) colours.set(m.id, hex(m.color))
  const along = (x: number, z: number): number => (side === 'FRONT' ? x - walls.x0 : side === 'REAR' ? walls.x1 - x : side === 'LEFT' ? walls.z1 - z : z - walls.z0)
  const toward = (x: number, z: number): number => (side === 'FRONT' ? -z : side === 'REAR' ? z : side === 'LEFT' ? -x : x)
  const sgn = frame.mPerPx < 0 ? -1 : 1
  const m = Math.abs(frame.mPerPx) || 1e-9
  const tris: Tri[] = []
  for (const mesh of bundle.scene.meshes) {
    const c = colours.get(mesh.materialId ?? '') ?? [200, 200, 200]
    for (let i = 0; i + 8 < mesh.positions.length; i += 9) {
      const p = [0, 1, 2].map((k) => {
        const x = mesh.positions[i + k * 3]
        const y = mesh.positions[i + k * 3 + 1]
        const z = mesh.positions[i + k * 3 + 2]
        return [sgn * along(x, z), y, toward(x, z)] as V3
      })
      tris.push({ p, c })
    }
  }
  const W = Math.max(1, Math.round(frame.width))
  const H = Math.max(1, Math.round(frame.height))
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  // col = (along − a0)/mPerPx  ⇔  W/2 + (sgn·along − mx)/m with mx = sgn·a0 + (W/2)·m
  // An orthographic side shows every face parallel to it in one shade, wherever it stands: a frame 1 m proud of the wall
  // it frames, a loggia's back wall, a recessed portal would all read as one flat wall. Faces are darkened with their
  // distance behind the nearest face of the side (up to SIDE_DEPTH_SHADE over SIDE_DEPTH_SPAN_M) — a cue of geometry,
  // not a colour the source did not give.
  let near = -Infinity
  for (const t of tris) for (const q of t.p) near = Math.max(near, q[2])
  const depth = new Float64Array(W * H).fill(-Infinity)
  draw(data, W, 0, 0, W, H, tris, 1 / m, sgn * frame.alongAtPx0 + (W / 2) * m, 0, frame.zeroRowPx, (z) => 1 - SIDE_DEPTH_SHADE * Math.min(1, Math.max(0, near - z) / SIDE_DEPTH_SPAN_M), depth)
  // and an outline wherever the surface steps in depth by more than SIDE_EDGE_STEP_M (a frame standing proud of its wall,
  // the mouth of a recess, the house against the sky): the edges an elevation drawing draws
  const step = (a: number, b: number): boolean => (Number.isFinite(a) !== Number.isFinite(b)) || (Number.isFinite(a) && Math.abs(a - b) > SIDE_EDGE_STEP_M)
  const edge = new Uint8Array(W * H)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const k = y * W + x
      if (!Number.isFinite(depth[k])) continue
      if ((x + 1 < W && step(depth[k], depth[k + 1])) || (y + 1 < H && step(depth[k], depth[k + W])) || (x > 0 && step(depth[k], depth[k - 1])) || (y > 0 && step(depth[k], depth[k - W]))) edge[k] = 1
    }
  }
  for (let k = 0; k < W * H; k += 1) if (edge[k]) data.set([60, 60, 60], k * 4)
  const png = encodePng({ width: W, height: H, data })
  return { png, sha256: sha(png), width: W, height: H }
}

/**
 * v3.54.10 — one storey of the model seen from above with nothing above it: the floor and rooms of that storey filled,
 * every wall cut at `cutM` above its floor drawn as a dark line (partitions grey), door leaves cut at 1 m drawn brown.
 * Front at the bottom, as plans are printed. The roof is never drawn: what is missing here is missing in the model, not
 * hidden by the renderer. A function of the scene alone (its hash names what the reviewer saw).
 */
export function renderStoreyCut(bundle: MobileSceneBundle, levelId: string, elevation: number, cutM = 1.2, size = 640): { png: Uint8Array; sha256: string; width: number; height: number; pxPerM: number } {
  const b = bundle.scene.bounds
  const x0 = (b?.min.x ?? 0) - 0.5
  const x1 = (b?.max.x ?? 10) + 0.5
  const z0 = (b?.min.z ?? 0) - 0.5
  const z1 = (b?.max.z ?? 10) + 0.5
  const s = size / Math.max(x1 - x0, z1 - z0)
  const W = Math.ceil((x1 - x0) * s)
  const H = Math.ceil((z1 - z0) * s)
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  const colours = new Map<string, V3>()
  for (const m of (bundle as unknown as { materials?: Array<{ id: string; color?: string }> }).materials ?? []) colours.set(m.id, hex(m.color))
  const P = (x: number, z: number): [number, number] => [(x - x0) * s, (z1 - z) * s]
  const fill = (a: [number, number], c2: [number, number], d: [number, number], col: V3): void => {
    const minX = Math.max(0, Math.floor(Math.min(a[0], c2[0], d[0])))
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], c2[0], d[0])))
    const minY = Math.max(0, Math.floor(Math.min(a[1], c2[1], d[1])))
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], c2[1], d[1])))
    const area = (c2[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (c2[1] - a[1])
    if (Math.abs(area) < 1e-9) return
    for (let y = minY; y <= maxY; y += 1)
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((c2[0] - px) * (d[1] - py) - (d[0] - px) * (c2[1] - py)) / area
        const w1 = ((d[0] - px) * (a[1] - py) - (a[0] - px) * (d[1] - py)) / area
        if (w0 < -1e-6 || w1 < -1e-6 || 1 - w0 - w1 < -1e-6) continue
        const o = (y * W + x) * 4
        data[o] = col[0]
        data[o + 1] = col[1]
        data[o + 2] = col[2]
      }
  }
  const line = (a: [number, number], c2: [number, number], col: V3, wpx: number): void => {
    const n = Math.ceil(Math.hypot(c2[0] - a[0], c2[1] - a[1])) + 1
    for (let i = 0; i <= n; i += 1) {
      const x = a[0] + ((c2[0] - a[0]) * i) / n
      const y = a[1] + ((c2[1] - a[1]) * i) / n
      for (let dx = -wpx; dx <= wpx; dx += 1)
        for (let dy = -wpx; dy <= wpx; dy += 1) {
          const xi = Math.round(x + dx)
          const yi = Math.round(y + dy)
          if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue
          const o = (yi * W + xi) * 4
          data[o] = col[0]
          data[o + 1] = col[1]
          data[o + 2] = col[2]
        }
    }
  }
  const tris = (positions: number[]): Array<[V3, V3, V3]> => {
    const out: Array<[V3, V3, V3]> = []
    for (let i = 0; i + 8 < positions.length; i += 9) out.push([[positions[i], positions[i + 1], positions[i + 2]], [positions[i + 3], positions[i + 4], positions[i + 5]], [positions[i + 6], positions[i + 7], positions[i + 8]]])
    return out
  }
  const cut = (t: [V3, V3, V3], y: number): [number, number][] | undefined => {
    const pts: [number, number][] = []
    for (const [a, c2] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]] as Array<[V3, V3]>) {
      if ((a[1] - y) * (c2[1] - y) < 0) {
        const k = (y - a[1]) / (c2[1] - a[1])
        pts.push(P(a[0] + k * (c2[0] - a[0]), a[2] + k * (c2[2] - a[2])))
      }
    }
    return pts.length === 2 ? pts : undefined
  }
  const meshes = bundle.scene.meshes as Array<{ objectKind?: string; levelId?: string; semanticGroup?: string; materialId?: string; positions: number[]; part?: string }>
  for (const m of meshes) {
    if (m.levelId !== levelId || (m.objectKind !== 'slab' && m.objectKind !== 'room')) continue
    const col: V3 = m.objectKind === 'room' ? [214, 228, 240] : [232, 232, 228]
    for (const t of tris(m.positions)) if (Math.abs(t[0][1] - t[1][1]) < 1e-6 && Math.abs(t[1][1] - t[2][1]) < 1e-6 && Math.abs(t[0][1] - elevation) < 0.5) fill(P(t[0][0], t[0][2]), P(t[1][0], t[1][2]), P(t[2][0], t[2][2]), col)
  }
  for (const m of meshes) {
    if (m.objectKind !== 'wall' && m.objectKind !== 'wallPanel') continue
    const interior = m.semanticGroup === 'WALL_INTERIOR'
    if (interior && m.levelId !== levelId) continue
    for (const t of tris(m.positions)) {
      const seg = cut(t, elevation + cutM)
      if (seg) line(seg[0], seg[1], interior ? [120, 120, 120] : [30, 30, 30], interior ? 1 : 2)
    }
  }
  for (const m of meshes) {
    if (m.levelId !== levelId || m.objectKind !== 'door') continue
    for (const t of tris(m.positions)) {
      const seg = cut(t, elevation + 1.0)
      if (seg) line(seg[0], seg[1], [176, 122, 74], 1)
    }
  }
  const png = encodePng({ width: W, height: H, data })
  return { png, sha256: createHash('sha256').update(png).digest('hex'), width: W, height: H, pxPerM: s }
}
