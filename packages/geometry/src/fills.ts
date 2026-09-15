/**
 * Window and door fills: what goes inside a structural opening.
 *
 * Both are emitted in the host wall's own frame (`a` along, `b` up, `c`
 * inward) and mapped to world through the wall frame, so a fill follows its
 * wall wherever the wall is. Each part is a separate mesh: frame, glass,
 * mullion, leaf, handle — a picker can tell a pane from its frame, and a
 * later stage can animate the leaf without touching the frame.
 *
 * The door leaf pivots about a vertical axis on its hinge side, rotated by
 * `openAngle` towards `swing`; the geometry is recomputed from that angle on
 * every compile, which is the future animation path.
 */
import { wallPoint, type Door, type Opening, type Window, type WallFrame } from '@buildapp/model'
import { frameBox, quadOut, triOut, triangulatePolygon } from './primitives.js'
import { polygonSignedArea } from '@buildapp/model'
import { scale, add, type GeometryPart, type Triangle, type Vec3 } from './types.js'

export type FillPiece = { part: GeometryPart; triangles: Triangle[] }

/** An axis-aligned box in wall-local coordinates. */
function localBox(out: Triangle[], f: WallFrame, a0: number, a1: number, b0: number, b1: number, c0: number, c1: number): void {
  const origin = wallPoint(f, a0, b0, c0)
  const eA = scale(f.u, a1 - a0)
  const eB = scale(f.up, b1 - b0)
  const eC = scale(f.n, -(c1 - c0))
  frameBox(out, origin, eA, eB, eC)
}

/**
 * A rectangular ring (a picture frame) in wall-local coordinates: outer
 * rectangle `a0..a1 x b0..b1`, member width `fw`, depth `c0..c1`. One closed
 * manifold — not four boxes with coincident faces.
 */
function localRing(out: Triangle[], f: WallFrame, a0: number, a1: number, b0: number, b1: number, fw: number, c0: number, c1: number): void {
  const O = [
    [a0, b0],
    [a1, b0],
    [a1, b1],
    [a0, b1],
  ] as const
  const I = [
    [a0 + fw, b0 + fw],
    [a1 - fw, b0 + fw],
    [a1 - fw, b1 - fw],
    [a0 + fw, b1 - fw],
  ] as const
  const P = (ab: readonly [number, number], c: number): Vec3 => wallPoint(f, ab[0], ab[1], c)
  const edgeOut = [scale(f.up, -1), f.u, f.up, scale(f.u, -1)] // bottom, right, top, left edges
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    // caps
    quadOut(out, P(O[i], c0), P(O[j], c0), P(I[j], c0), P(I[i], c0), f.n)
    quadOut(out, P(O[i], c1), P(O[j], c1), P(I[j], c1), P(I[i], c1), scale(f.n, -1))
    // outer side, facing away from the ring; inner side, facing into the hole
    quadOut(out, P(O[i], c0), P(O[j], c0), P(O[j], c1), P(O[i], c1), edgeOut[i])
    quadOut(out, P(I[i], c0), P(I[j], c0), P(I[j], c1), P(I[i], c1), scale(edgeOut[i], -1))
  }
}

/** A simple polygon in the wall's (a, b) plane extruded from c0 to c1 into one closed solid. */
function extrudeLocalPolygon(out: Triangle[], f: WallFrame, poly: ReadonlyArray<readonly [number, number]>, c0: number, c1: number): void {
  const plan = poly.map(([a, b]) => ({ x: a, z: b }))
  const tri = triangulatePolygon(plan)
  if (!tri) return
  const P = (i: number, c: number): Vec3 => wallPoint(f, poly[i][0], poly[i][1], c)
  for (const [i, j, k] of tri) {
    triOut(out, P(i, c0), P(j, c0), P(k, c0), f.n)
    triOut(out, P(i, c1), P(j, c1), P(k, c1), scale(f.n, -1))
  }
  const ccw = polygonSignedArea(plan) > 0
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    const da = poly[j][0] - poly[i][0]
    const db = poly[j][1] - poly[i][1]
    // In the (a, b) plane a positive-area traversal keeps the interior on the left, so outward is (db, -da).
    const oa = ccw ? db : -db
    const ob = ccw ? -da : da
    const outward = add(scale(f.u, oa), scale(f.up, ob))
    quadOut(out, P(i, c0), P(j, c0), P(j, c1), P(i, c1), outward)
  }
}

/**
 * A ring between two four-sided polygons in the wall's (a, b) plane — the
 * outer outline `O` and the inner outline `I`, both in the same cyclic order —
 * extruded from `c0` to `c1`. One closed manifold: caps between matching
 * edges, outer sides facing away from the ring, inner sides facing into the
 * hole. `localRing` is the rectangular case; a raked-head window frame is a
 * trapezoid one.
 */
function localRingPolygon(out: Triangle[], f: WallFrame, O: ReadonlyArray<readonly [number, number]>, I: ReadonlyArray<readonly [number, number]>, c0: number, c1: number): void {
  const P = (ab: readonly [number, number], c: number): Vec3 => wallPoint(f, ab[0], ab[1], c)
  const ccw = polygonSignedArea(O.map(([a, b]) => ({ x: a, z: b }))) > 0
  for (let i = 0; i < O.length; i++) {
    const j = (i + 1) % O.length
    const da = O[j][0] - O[i][0]
    const db = O[j][1] - O[i][1]
    const outward = add(scale(f.u, ccw ? db : -db), scale(f.up, ccw ? -da : da))
    quadOut(out, P(O[i], c0), P(O[j], c0), P(I[j], c0), P(I[i], c0), f.n)
    quadOut(out, P(O[i], c1), P(O[j], c1), P(I[j], c1), P(I[i], c1), scale(f.n, -1))
    quadOut(out, P(O[i], c0), P(O[j], c0), P(O[j], c1), P(O[i], c1), outward)
    quadOut(out, P(I[i], c0), P(I[j], c0), P(I[j], c1), P(I[i], c1), scale(outward, -1))
  }
}

const MULLION_WIDTH = 0.05

/**
 * A window fill: a frame ring following the opening's outline (a rectangle,
 * or a trapezoid under a raked head), glass panes and mullions inside it. The
 * head line of the inner outline is the outer head offset by the frame width
 * measured perpendicular to it, so the frame member is the same width all
 * round.
 */
export function compileWindowFill(win: Window, opening: Opening, f: WallFrame): FillPiece[] {
  const a0 = opening.offset
  const a1 = opening.offset + opening.width
  const b0 = opening.sill
  const hNear = opening.sill + opening.height
  const hFar = opening.head?.kind === 'RAKED' ? opening.sill + opening.head.heightFar : hNear
  const fw = win.frameWidth
  const c0 = win.frameInset
  const c1 = win.frameInset + win.frameDepth
  /** Outer head height at `a`. */
  const headAt = (a: number): number => (hFar === hNear ? hNear : hNear + ((a - a0) / (a1 - a0)) * (hFar - hNear))
  const rake = (hFar - hNear) / (a1 - a0)
  /** Inner head height at `a`: the outer head lowered by the frame width, perpendicular to the head line. */
  const innerHeadAt = (a: number): number => headAt(a) - fw * Math.sqrt(1 + rake * rake)

  const frame: Triangle[] = []
  const innerA0 = a0 + fw
  const innerA1 = a1 - fw
  const innerB0 = b0 + fw
  if (hFar === hNear) {
    localRing(frame, f, a0, a1, b0, hNear, fw, c0, c1)
  } else {
    localRingPolygon(
      frame,
      f,
      [
        [a0, b0],
        [a1, b0],
        [a1, hFar],
        [a0, hNear],
      ],
      [
        [innerA0, innerB0],
        [innerA1, innerB0],
        [innerA1, innerHeadAt(innerA1)],
        [innerA0, innerHeadAt(innerA0)],
      ],
      c0,
      c1,
    )
  }

  const gc0 = c0 + win.frameDepth / 2 - win.glassThickness / 2
  const gc1 = gc0 + win.glassThickness
  const glass: Triangle[] = []
  const mullions: Triangle[] = []
  // Mullion positions: stated fractions of the opening width, or `divisions` equal panes.
  const stated = win.mullions?.map((m) => a0 + m * opening.width).filter((ma) => ma > innerA0 + fw && ma < innerA1 - fw)
  const n = stated ? stated.length + 1 : Math.max(1, win.divisions)
  const paneW = (innerA1 - innerA0) / n
  const mw = Math.min(MULLION_WIDTH, paneW / 3)
  const mullionAt = (k: number): number => (stated ? stated[k - 1] : innerA0 + k * paneW)
  const paneTop = (a: number): number => (hFar === hNear ? hNear - fw : innerHeadAt(a))
  for (let k = 0; k < n; k++) {
    const pa0 = k > 0 ? mullionAt(k) + mw / 2 : innerA0
    const pa1 = k < n - 1 ? mullionAt(k + 1) - mw / 2 : innerA1
    if (hFar === hNear) localBox(glass, f, pa0, pa1, innerB0, paneTop(pa0), gc0, gc1)
    else
      extrudeLocalPolygon(
        glass,
        f,
        [
          [pa0, innerB0],
          [pa1, innerB0],
          [pa1, paneTop(pa1)],
          [pa0, paneTop(pa0)],
        ],
        gc0,
        gc1,
      )
    if (k > 0) {
      const ma = mullionAt(k)
      if (hFar === hNear) localBox(mullions, f, ma - mw / 2, ma + mw / 2, innerB0, paneTop(ma), c0, c1)
      else
        extrudeLocalPolygon(
          mullions,
          f,
          [
            [ma - mw / 2, innerB0],
            [ma + mw / 2, innerB0],
            [ma + mw / 2, paneTop(ma + mw / 2)],
            [ma - mw / 2, paneTop(ma - mw / 2)],
          ],
          c0,
          c1,
        )
    }
  }
  const out: FillPiece[] = [
    { part: 'WINDOW_FRAME', triangles: frame },
    { part: 'WINDOW_GLASS', triangles: glass },
  ]
  if (mullions.length > 0) out.push({ part: 'WINDOW_MULLION', triangles: mullions })
  return out
}

export type DoorLeafPose = {
  /** World point of the hinge axis at the leaf's base. */
  hingeBase: Vec3
  /** World unit vector from the hinge across the leaf. */
  across: Vec3
  /** Leaf width and height actually emitted. */
  width: number
  height: number
}

export function compileDoorFill(door: Door, opening: Opening, f: WallFrame): { pieces: FillPiece[]; pose: DoorLeafPose } {
  const a0 = opening.offset
  const a1 = opening.offset + opening.width
  const b0 = opening.sill
  const b1 = opening.sill + opening.height
  const fw = door.frameWidth
  const c0 = door.frameInset
  const c1 = door.frameInset + door.frameDepth
  // A U-shaped frame: two jambs and a head, one closed solid.
  const frame: Triangle[] = []
  extrudeLocalPolygon(
    frame,
    f,
    [
      [a0, b0],
      [a0 + fw, b0],
      [a0 + fw, b1 - fw],
      [a1 - fw, b1 - fw],
      [a1 - fw, b0],
      [a1, b0],
      [a1, b1],
      [a0, b1],
    ],
    c0,
    c1,
  )

  // The leaf, in the (a, c) plane about its hinge.
  const gap = 0.008
  const leafWidth = a1 - a0 - 2 * fw - 2 * gap
  const leafBottom = b0 + (b0 <= 1e-9 ? 0.01 : gap)
  const leafTop = b1 - fw - gap
  const leafHeight = leafTop - leafBottom
  const lt = door.leafThickness
  const s = door.hingeSide === 'LEFT' ? 1 : -1
  const hingeA = door.hingeSide === 'LEFT' ? a0 + fw + gap : a1 - fw - gap
  const hingeC = c0 + door.frameDepth / 2
  const theta = (door.openAngle * Math.PI) / 180
  // Swing IN rotates the leaf towards +c (into the building), OUT towards -c.
  const sw = door.swing === 'IN' ? 1 : -1
  const eA = s * Math.cos(theta) // leaf direction, a component
  const eC = sw * Math.sin(theta) // leaf direction, c component
  // Leaf thickness direction, perpendicular in the (a, c) plane.
  const tA = -eC
  const tC = eA
  const local = (lambda: number, mu: number, b: number): Vec3 => wallPoint(f, hingeA + eA * lambda + tA * mu, b, hingeC + eC * lambda + tC * mu)
  const leaf: Triangle[] = []
  const origin = local(0, -lt / 2, leafBottom)
  const eLambda = add(scale(f.u, eA * leafWidth), scale(f.n, -eC * leafWidth))
  const eMu = add(scale(f.u, tA * lt), scale(f.n, -tC * lt))
  const eB = scale(f.up, leafHeight)
  frameBox(leaf, origin, eLambda, eMu, eB)

  // Handle: a lever on the inside face near the free edge, at 1.0 m.
  const handle: Triangle[] = []
  const hLambda0 = leafWidth - 0.16
  const hLambda1 = leafWidth - 0.06
  const hB0 = Math.min(1.0, leafBottom + leafHeight * 0.5)
  const hOrigin = local(hLambda0, lt / 2, hB0)
  frameBox(
    handle,
    hOrigin,
    add(scale(f.u, eA * (hLambda1 - hLambda0)), scale(f.n, -eC * (hLambda1 - hLambda0))),
    add(scale(f.u, tA * 0.06), scale(f.n, -tC * 0.06)),
    scale(f.up, 0.03),
  )

  const across = add(scale(f.u, eA), scale(f.n, -eC))
  return {
    pieces: [
      { part: 'DOOR_FRAME', triangles: frame },
      { part: 'DOOR_LEAF', triangles: leaf },
      { part: 'DOOR_HANDLE', triangles: handle },
    ],
    pose: { hingeBase: local(0, 0, leafBottom), across, width: leafWidth, height: leafHeight },
  }
}
