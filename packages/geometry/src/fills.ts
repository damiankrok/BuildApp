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
import { wallPoint, type Door, type DoorPanel, type Opening, type Window, type WallFrame } from '@buildapp/model'
import { frameBox, quadOut, triOut, triangulatePolygon } from './primitives.js'
import { polygonSignedArea } from '@buildapp/model'
import { extrudeLocalRegion } from './region.js'
import { cross, dot, scale, add, type GeometryPart, type Triangle, type Vec3 } from './types.js'

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
 * A rectangular ring in an arbitrary affine frame: corner `origin`, edge
 * vectors `eU` (across), `eV` (up), `eN` (through); outer rectangle
 * `u0..u1 × v0..v1` (in units of `eU` / `eV`), member width `fw`, from `n0`
 * to `n1` along `eN`. One closed manifold, faces wound outward by their
 * actual directions, so any handedness of the frame is fine. Used for a
 * glazed door leaf, which stands in its own rotated frame when open.
 */
function affineRing(out: Triangle[], origin: Vec3, eU: Vec3, eV: Vec3, eN: Vec3, u0: number, u1: number, v0: number, v1: number, fw: number, n0: number, n1: number): void {
  const at = (u: number, v: number, n: number): Vec3 => ({ x: origin.x + eU.x * u + eV.x * v + eN.x * n, y: origin.y + eU.y * u + eV.y * v + eN.y * n, z: origin.z + eU.z * u + eV.z * v + eN.z * n })
  const O = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ] as const
  const I = [
    [u0 + fw, v0 + fw],
    [u1 - fw, v0 + fw],
    [u1 - fw, v1 - fw],
    [u0 + fw, v1 - fw],
  ] as const
  const nCap = cross(eU, eV)
  const capOut = dot(nCap, eN) >= 0 ? nCap : scale(nCap, -1)
  const edgeOut = [scale(eV, -1), eU, eV, scale(eU, -1)]
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    quadOut(out, at(O[i][0], O[i][1], n1), at(O[j][0], O[j][1], n1), at(I[j][0], I[j][1], n1), at(I[i][0], I[i][1], n1), capOut)
    quadOut(out, at(O[i][0], O[i][1], n0), at(O[j][0], O[j][1], n0), at(I[j][0], I[j][1], n0), at(I[i][0], I[i][1], n0), scale(capOut, -1))
    quadOut(out, at(O[i][0], O[i][1], n0), at(O[j][0], O[j][1], n0), at(O[j][0], O[j][1], n1), at(O[i][0], O[i][1], n1), edgeOut[i])
    quadOut(out, at(I[i][0], I[i][1], n0), at(I[j][0], I[j][1], n0), at(I[j][0], I[j][1], n1), at(I[i][0], I[i][1], n1), scale(edgeOut[i], -1))
  }
}

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

/** Glass in a door assembly (a sidelight or a glazed leaf) is this thick. */
export const DOOR_GLASS_THICKNESS = 0.024
/** Stile and rail width of a glazed leaf. */
export const GLAZED_LEAF_MEMBER = 0.11

export function compileDoorFill(door: Door, opening: Opening, f: WallFrame): { pieces: FillPiece[]; pose: DoorLeafPose } {
  const a0 = opening.offset
  const a1 = opening.offset + opening.width
  const b0 = opening.sill
  const b1 = opening.sill + opening.height
  const fw = door.frameWidth
  const c0 = door.frameInset
  const c1 = door.frameInset + door.frameDepth
  const frame: Triangle[] = []
  const leaf: Triangle[] = []
  const handle: Triangle[] = []
  const glass: Triangle[] = []
  const panel: Triangle[] = []
  let pose: DoorLeafPose | undefined

  /**
   * One hinged leaf in the clear span `la0..la1` (frame members already taken
   * out), hinged on `hinge` (LEFT = the la0 edge), rotated by the door's open
   * angle. The leaf lives in its own (λ across, μ through, b up) frame; the
   * pose it returns is the animation path.
   */
  const hingedLeaf = (la0: number, la1: number, hinge: 'LEFT' | 'RIGHT', glazed: boolean): DoorLeafPose => {
    const gap = 0.008
    const leafWidth = la1 - la0 - 2 * gap
    const leafBottom = b0 + (b0 <= 1e-9 ? 0.01 : gap)
    const leafTop = b1 - fw - gap
    const leafHeight = leafTop - leafBottom
    const lt = door.leafThickness
    const s = hinge === 'LEFT' ? 1 : -1
    const hingeA = hinge === 'LEFT' ? la0 + gap : la1 - gap
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
    const eLambda = add(scale(f.u, eA), scale(f.n, -eC))
    const eMu = add(scale(f.u, tA), scale(f.n, -tC))
    const origin = local(0, -lt / 2, leafBottom)
    if (!glazed) {
      frameBox(leaf, origin, scale(eLambda, leafWidth), scale(eMu, lt), scale(f.up, leafHeight))
    } else {
      // stiles and rails around a pane at the leaf's mid-thickness
      affineRing(leaf, origin, eLambda, f.up, eMu, 0, leafWidth, 0, leafHeight, GLAZED_LEAF_MEMBER, 0, lt)
      const m = GLAZED_LEAF_MEMBER
      const g0 = local(m, -DOOR_GLASS_THICKNESS / 2, leafBottom + m)
      frameBox(glass, g0, scale(eLambda, leafWidth - 2 * m), scale(eMu, DOOR_GLASS_THICKNESS), scale(f.up, leafHeight - 2 * m))
    }
    // Handle: a lever on the inside face near the free edge, at 1.0 m.
    const hLambda0 = leafWidth - 0.16
    const hLambda1 = leafWidth - 0.06
    const hB0 = Math.min(1.0, leafBottom + leafHeight * 0.5)
    frameBox(handle, local(hLambda0, lt / 2, hB0), scale(eLambda, hLambda1 - hLambda0), scale(eMu, 0.06), scale(f.up, 0.03))
    return { hingeBase: local(0, 0, leafBottom), across: eLambda, width: leafWidth, height: leafHeight }
  }

  if (!door.assembly) {
    // A U-shaped frame: two jambs and a head, one closed solid.
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
    pose = hingedLeaf(a0 + fw, a1 - fw, door.hingeSide, false)
  } else {
    // The frame is the opening's rectangle less every panel's aperture: jambs,
    // head, the mullions between panels and a bottom rail under each fixed
    // panel, one closed solid. A leaf's aperture reaches the sill.
    const mw = door.assembly.mullionWidth
    const panels = door.assembly.panels
    const apertures: Array<{ a: number; b: number }[]> = []
    let cursor = a0
    const point = (a: number, b: number, c: number): Vec3 => wallPoint(f, a, b, c)
    panels.forEach((p: DoorPanel, i: number) => {
      const pa0 = cursor
      const pa1 = i === panels.length - 1 ? a1 : cursor + p.fraction * opening.width
      cursor = pa1
      const la0 = pa0 + (i === 0 ? fw : mw / 2)
      const la1 = pa1 - (i === panels.length - 1 ? fw : mw / 2)
      const bottom = p.kind === 'LEAF' ? b0 : b0 + fw
      apertures.push([
        { a: la0, b: bottom },
        { a: la1, b: bottom },
        { a: la1, b: b1 - fw },
        { a: la0, b: b1 - fw },
      ])
      if (p.kind === 'LEAF') {
        const leafPose = hingedLeaf(la0, la1, p.hinge, p.glazing === 'FULL')
        pose = pose ?? leafPose
      } else if (p.kind === 'GLAZED') {
        const gc = c0 + door.frameDepth / 2 - DOOR_GLASS_THICKNESS / 2
        localBox(glass, f, la0, la1, bottom, b1 - fw, gc, gc + DOOR_GLASS_THICKNESS)
      } else {
        const pc = c0 + door.frameDepth / 2 - door.leafThickness / 2
        localBox(panel, f, la0, la1, bottom, b1 - fw, pc, pc + door.leafThickness)
      }
    })
    extrudeLocalRegion(
      frame,
      f,
      point,
      [
        { a: a0, b: b0 },
        { a: a1, b: b0 },
        { a: a1, b: b1 },
        { a: a0, b: b1 },
      ],
      apertures,
      c0,
      c1,
    )
  }

  const pieces: FillPiece[] = [{ part: 'DOOR_FRAME', triangles: frame }]
  if (leaf.length > 0) pieces.push({ part: 'DOOR_LEAF', triangles: leaf })
  if (glass.length > 0) pieces.push({ part: 'DOOR_GLASS', triangles: glass })
  if (panel.length > 0) pieces.push({ part: 'DOOR_PANEL', triangles: panel })
  if (handle.length > 0) pieces.push({ part: 'DOOR_HANDLE', triangles: handle })
  return {
    pieces,
    pose: pose ?? { hingeBase: wallPoint(f, a0 + fw, b0, c0 + door.frameDepth / 2), across: f.u, width: 0, height: 0 },
  }
}
