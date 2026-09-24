/**
 * The v2 world frame, and how each drawing maps into it.
 *
 * MODEL_FRAME puts the front facade's OUTER face at z = 0, x to the right when
 * looking at the front, y up. The structural layout of stage 03R states its
 * plans the other way round — z = 0 at the rear wall, growing towards the
 * sheet's bottom — and the v2 passes must speak one language. So a
 * `WorldFrameV2` is fixed once from the base plan: x from the west outer face
 * of the walled envelope, z from the OUTERMOST plane on the front side (the
 * front zone's mouth where a zone exists, else the front wall face), and every
 * plan, elevation and section is registered into it through the helpers here.
 *
 * "Front" is the bottom of the plan sheet, which is how a published plan is
 * drawn and what the elevation labels corroborate; the frame records that
 * choice and the evidence for it rather than assuming it silently.
 */
import { round6 } from '@buildapp/source-common'
import type { PixelRect } from '@buildapp/source-common'
import type { PlanReading, StructuralLayoutDraft } from '../layout.js'
import type { FootprintRegionHypothesis, MassHypothesis } from '../structural-layout.js'
import { ringBounds } from '../structural-layout.js'
import type { ElevationRegistration } from '../views.js'

export type PlanFrameV2 = {
  frameId: string
  assetId: string
  storeyIndex: number
  /** Metres per pixel along each sheet axis. */
  mppX: number
  mppY: number
  /** The pixel column of world x = 0 (the west outer face) and the pixel row of world z = 0 (the front outer plane). */
  originPx: { x: number; y: number }
  /** How the frame was fixed. */
  why: string
  toWorld: (px: number, py: number) => { x: number; z: number }
  toPixel: (x: number, z: number) => { x: number; y: number }
  /** Half a wall's thickness in pixels on this sheet, from the plan's own bands. */
  wallPx: number
}

export type WorldFrameV2 = {
  /** The characteristic envelope in world metres: outer planes included. */
  envelope: { x0: number; z0: number; x1: number; z1: number }
  /** The walled envelope, front wall face to rear wall face. */
  walled: { x0: number; z0: number; x1: number; z1: number }
  /** The 03R layout's z, converted: z_v2 = zFlip − z_old. */
  zFlip: number
  frontSide: 'SHEET_BOTTOM'
  why: string
}

/** Convert a 03R layout point into the v2 frame. */
export const flipZ = (frame: WorldFrameV2, z: number): number => round6(frame.zFlip - z)

export function worldFrameFrom(draft: StructuralLayoutDraft): WorldFrameV2 | undefined {
  const base = draft.storeys.find((s) => s.index === Math.min(...draft.storeys.map((x) => x.index)))
  if (!base) return undefined
  const regions = draft.footprintRegions.filter((r) => r.storeyId === base.id)
  const built = regions.filter((r) => r.kind === 'BUILT')
  if (built.length === 0) return undefined
  const b = (rs: readonly FootprintRegionHypothesis[]): { x0: number; z0: number; x1: number; z1: number } => {
    const all = rs.map((r) => ringBounds(r.ring))
    return { x0: Math.min(...all.map((a) => a.x0)), z0: Math.min(...all.map((a) => a.z0)), x1: Math.max(...all.map((a) => a.x1)), z1: Math.max(...all.map((a) => a.z1)) }
  }
  const walledOld = b(built)
  const allOld = b(regions)
  // In the 03R frame the sheet's bottom is max z. The front outer plane is the
  // max-z extent of everything dimensioned on the base storey (the front zone
  // when there is one), and it becomes v2 z = 0.
  const zFlip = allOld.z1
  const walled = { x0: round6(walledOld.x0), z0: round6(zFlip - walledOld.z1), x1: round6(walledOld.x1), z1: round6(zFlip - walledOld.z0) }
  const envelope = { x0: round6(allOld.x0), z0: 0, x1: round6(allOld.x1), z1: round6(zFlip - allOld.z0) }
  return {
    envelope,
    walled,
    zFlip: round6(zFlip),
    frontSide: 'SHEET_BOTTOM',
    why: `the front is the bottom of the plan sheet; the front outer plane (${walled.z0 > 0 ? `a ${walled.z0.toFixed(2)} m zone in front of the front wall` : 'the front wall face'}) is z = 0 and the 03R layout's z is mirrored about ${zFlip.toFixed(3)}`,
  }
}

/** A plan reading registered into the v2 frame through the 03R world frame of the base plan. */
export function planFrameV2(plan: PlanReading, storeyIndex: number, world: WorldFrameV2, draft: StructuralLayoutDraft): PlanFrameV2 | undefined {
  const base = draft.frame
  if (!base) return undefined
  const isBase = draft.base?.frame.id === plan.frame.id
  let mppX = base.metresPerPixelX
  let mppY = base.metresPerPixelY
  let ox = base.originPx.x
  let oy = base.originPx.y
  let why = 'the base plan, through the chain-registered world frame of the 03R layout'
  if (!isBase) {
    const alignment = draft.alignments.get(plan.frame.id)
    if (!alignment) return undefined
    // base_px = other_px * scale + offset  ⇒  other_px = (base_px − offset) / scale
    mppX = base.metresPerPixelX * alignment.scale
    mppY = base.metresPerPixelY * alignment.scale
    ox = (base.originPx.x - alignment.offsetX) / alignment.scale
    oy = (base.originPx.y - alignment.offsetY) / alignment.scale
    why = `aligned onto the base plan by its walls (${alignment.why})`
  }
  // 03R: x = (px − ox) · mppX ; z_old = (py − oy) · mppY ; v2: z = zFlip − z_old.
  const toWorld = (px: number, py: number): { x: number; z: number } => ({ x: round6((px - ox) * mppX), z: round6(world.zFlip - (py - oy) * mppY) })
  const toPixel = (x: number, z: number): { x: number; y: number } => ({ x: round6(ox + x / mppX), y: round6(oy + (world.zFlip - z) / mppY) })
  const origin = toPixel(0, 0)
  return { frameId: plan.frame.id, assetId: plan.frame.assetId, storeyIndex, mppX: round6(mppX), mppY: round6(mppY), originPx: origin, why, toWorld, toPixel, wallPx: plan.wallPx }
}

/** A registered elevation in the v2 frame: which world axis u runs along, and where. */
export type ElevationFrameV2 = {
  registration: ElevationRegistration
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'
  /** The wall plane's coordinate the view looks at (z for FRONT/REAR, x for LEFT/RIGHT), in v2 metres. */
  planeAt: number
  /** World coordinate along the facade for a pixel column, and the pixel column for a world coordinate. */
  alongOf: (px: number) => number
  pxOf: (along: number) => number
  yOf: (py: number) => number
  pyOf: (y: number) => number
}

/**
 * The 03R elevation registration re-expressed in v2 metres. Its `u` runs
 * from the left-hand end of the drawing; for a FRONT view that is the west end
 * (x = envelope.x0), for a REAR view the east end, for the LEFT (west) view the
 * front end... but the 03R registrations were assigned with the front at max
 * z, so LEFT/RIGHT swap: the 03R "LEFT" (min x) wall seen from outside with
 * the front at max z has the front on the RIGHT of the drawing, which in v2
 * terms (front at z = 0) is the WEST elevation with z decreasing to the right.
 */
export function elevationFrameV2(registration: ElevationRegistration, world: WorldFrameV2): ElevationFrameV2 | undefined {
  if (!registration.side) return undefined
  const e = world.envelope
  const mpp = registration.metresPerPixelU
  const x0 = registration.extent.x0
  const y1 = registration.extent.y1
  // u (03R) = (px − x0) · mpp − overhang; the drawing's left edge is the eaves, not the wall.
  const uOf = (px: number): number => (px - x0) * mpp - registration.overhangM
  const pxOfU = (u: number): number => x0 + (u + registration.overhangM) / mpp
  const yOf = (py: number): number => round6((y1 - py) * registration.metresPerPixelV)
  const pyOf = (y: number): number => round6(y1 - y / registration.metresPerPixelV)
  const width = e.x1 - e.x0
  const depth = e.z1 - e.z0
  switch (registration.side) {
    case 'FRONT':
      // Seen from the front (south): west on the left. u runs +x.
      return { registration, side: 'FRONT', planeAt: e.z0, alongOf: (px) => round6(e.x0 + uOf(px)), pxOf: (x) => round6(pxOfU(x - e.x0)), yOf, pyOf }
    case 'REAR':
      // Seen from the rear: east on the left. u runs −x.
      return { registration, side: 'REAR', planeAt: e.z1, alongOf: (px) => round6(e.x1 - uOf(px)), pxOf: (x) => round6(pxOfU(e.x1 - x)), yOf, pyOf }
    case 'LEFT':
      // The min-x (west) wall seen from the west: the front (z = 0) is on the right. u runs −z from the rear.
      return { registration, side: 'LEFT', planeAt: e.x0, alongOf: (px) => round6(e.z1 - uOf(px)), pxOf: (z) => round6(pxOfU(e.z1 - z)), yOf, pyOf }
    case 'RIGHT':
      // The max-x (east) wall seen from the east: the front is on the left. u runs +z.
      return { registration, side: 'RIGHT', planeAt: e.x1, alongOf: (px) => round6(e.z0 + uOf(px)), pxOf: (z) => round6(pxOfU(z - e.z0)), yOf, pyOf }
  }
  void width
  void depth
  return undefined
}

/** The pixel rectangle of a mass on a plan frame. */
export function massPixelRect(mass: MassHypothesis, plan: PlanFrameV2, world: WorldFrameV2): PixelRect {
  const b = ringBounds(mass.ring)
  const a = plan.toPixel(b.x0, flipZ(world, b.z1))
  const c = plan.toPixel(b.x1, flipZ(world, b.z0))
  return { x0: Math.min(a.x, c.x), y0: Math.min(a.y, c.y), x1: Math.max(a.x, c.x), y1: Math.max(a.y, c.y) }
}

// ---------------------------------------------------------------------------
// Registering a storey plan by its outer wall faces
// ---------------------------------------------------------------------------

/**
 * The outermost wall faces drawn on a plan sheet: the leftmost and rightmost
 * columns, and the topmost and bottommost rows, on which a wall-thick band of
 * ink runs for at least `minCoverage` of the sheet's ink extent.
 *
 * This is what a storey plan is registered by when its own chains fail (a
 * sheet whose printed chains are all interior, or misread): the storey's
 * outer faces land on the walled envelope of the body the storey covers,
 * which the base plan has already measured. Two anchors per axis, one scale
 * per axis, and the two scales must agree — a sheet is scaled uniformly.
 */
export function outerWallFaces(raster: { width: number; height: number; data: Uint8ClampedArray }, wallPx: number, region?: PixelRect, minCoverage = 0.15): { x0: number; x1: number; y0: number; y1: number } | undefined {
  const lumaAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return 255
    const o = (y * raster.width + x) * 4
    return 0.299 * raster.data[o] + 0.587 * raster.data[o + 1] + 0.114 * raster.data[o + 2]
  }
  // The region is a hint: a sheet's dimensioned extent can miss a wall by a
  // few pixels, so it is widened by a few wall thicknesses.
  const slack = wallPx * 3
  const rx0 = Math.max(0, Math.floor((region?.x0 ?? 0) - slack))
  const ry0 = Math.max(0, Math.floor((region?.y0 ?? 0) - slack))
  const rx1 = Math.min(raster.width - 1, Math.ceil((region?.x1 ?? raster.width - 1) + slack))
  const ry1 = Math.min(raster.height - 1, Math.ceil((region?.y1 ?? raster.height - 1) + slack))
  const w = rx1 - rx0 + 1
  const h = ry1 - ry0 + 1
  // Total wall-thick ink along each column and each row: an exterior wall is
  // interrupted by its openings, so the longest unbroken run would miss it.
  const thick = Math.max(2, Math.round(wallPx * 0.5))
  const longestColumnRun = (x: number): number => {
    let total = 0
    for (let y = ry0; y <= ry1; y += 1) {
      // Wall-thick: dark here and across `thick` pixels to the right (or left).
      let dark = 0
      for (let d = -thick; d <= thick; d += 1) if (lumaAt(x + d, y) < 90) dark += 1
      if (dark >= thick) total += 1
    }
    return total
  }
  const longestRowRun = (y: number): number => {
    let total = 0
    for (let x = rx0; x <= rx1; x += 1) {
      let dark = 0
      for (let d = -thick; d <= thick; d += 1) if (lumaAt(x, y + d) < 90) dark += 1
      if (dark >= thick) total += 1
    }
    return total
  }
  let x0: number | undefined
  let x1: number | undefined
  let y0: number | undefined
  let y1: number | undefined
  for (let x = rx0; x <= rx1; x += 1) if (longestColumnRun(x) >= h * minCoverage) { x0 = x; break }
  for (let x = rx1; x >= rx0; x -= 1) if (longestColumnRun(x) >= h * minCoverage) { x1 = x; break }
  for (let y = ry0; y <= ry1; y += 1) if (longestRowRun(y) >= w * minCoverage) { y0 = y; break }
  for (let y = ry1; y >= ry0; y -= 1) if (longestRowRun(y) >= w * minCoverage) { y1 = y; break }
  if (x0 === undefined || x1 === undefined || y0 === undefined || y1 === undefined || x1 - x0 < wallPx * 4 || y1 - y0 < wallPx * 4) return undefined
  // A wall at least `thick` wide first satisfies the ±thick window on its own
  // first column, so the faces need no correction; `x1`/`y1` are the last
  // dark columns/rows, so the face plane is one past them.
  return { x0, x1: x1 + 1, y0, y1: y1 + 1 }
}

/**
 * A storey plan registered by its outer faces onto a walled rectangle of the
 * world (the body it covers). Returns undefined when the two axes disagree by
 * more than 3 %, which means the faces found are not the same rectangle.
 */
export function planFrameByOuterFaces(plan: PlanReading, storeyIndex: number, world: WorldFrameV2, covers: { x0: number; z0: number; x1: number; z1: number }, raster: { width: number; height: number; data: Uint8ClampedArray }): PlanFrameV2 | undefined {
  const faces = outerWallFaces(raster, plan.wallPx, plan.extent)
  if (!faces) return undefined
  const mppX = (covers.x1 - covers.x0) / (faces.x1 - faces.x0)
  const mppY = (covers.z1 - covers.z0) / (faces.y1 - faces.y0)
  const anisotropy = Math.max(mppX, mppY) / Math.min(mppX, mppY)
  if (!(anisotropy <= 1.03)) return undefined
  // Sheet bottom is the front: the bottom face row is the min-z face.
  const toWorld = (px: number, py: number): { x: number; z: number } => ({ x: round6(covers.x0 + (px - faces.x0) * mppX), z: round6(covers.z0 + (faces.y1 - py) * mppY) })
  const toPixel = (x: number, z: number): { x: number; y: number } => ({ x: round6(faces.x0 + (x - covers.x0) / mppX), y: round6(faces.y1 - (z - covers.z0) / mppY) })
  const origin = toPixel(0, 0)
  return {
    frameId: plan.frame.id,
    assetId: plan.frame.assetId,
    storeyIndex,
    mppX: round6(mppX),
    mppY: round6(mppY),
    originPx: origin,
    why: `its outer wall faces (px ${faces.x0}..${faces.x1} × ${faces.y0}..${faces.y1}) put on the ${(covers.x1 - covers.x0).toFixed(2)} × ${(covers.z1 - covers.z0).toFixed(2)} m body this storey covers; the two axes agree to ${((anisotropy - 1) * 100).toFixed(1)} %`,
    toWorld,
    toPixel,
    wallPx: plan.wallPx,
  }
}

// ---------------------------------------------------------------------------
// Registering an elevation render in the v2 frame
// ---------------------------------------------------------------------------

export type ElevationRegistrationV2 = {
  frameId: string
  assetId: string
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'
  sideConfidence: number
  sideWhy: string
  /** One scale for both axes: a published render is isotropic. */
  mpp: number
  /** The silhouette's box in pixels. */
  extent: PixelRect
  /** World coordinate along the facade at the extent's left edge, and its direction (+1 or −1 per pixel). */
  alongAtLeft: number
  alongSign: 1 | -1
  /** The pixel row of world y = 0. */
  zeroRow: number
  /** What the silhouette's width was matched to, in metres, and the alternatives it beat. */
  spanM: number
  spanWhy: string
  /** Where the silhouette's bottom lands in metres: near the terrain datum for a sound registration. */
  bottomY: number
  anisotropyCheck: number
  confidence: number
  why: string
}

/**
 * Register a rendered elevation with ONE scale, from the silhouette's width
 * against the span it shows, and the ridge datum at the silhouette's apex.
 *
 * The 03R registration fitted the vertical scale from the silhouette's height
 * against the ridge, taking the silhouette's bottom as y = 0; on a render the
 * bottom is the terrain line, below the floor by the plinth, and every height
 * read that way came out a plinth too high. Here the apex is the ridge datum
 * (a printed number), the horizontal scale comes from the plan's own width,
 * and the plinth then falls out as the silhouette's bottom in metres — which
 * is checked against the terrain datum where the section prints one.
 *
 * For a side view the silhouette's width is either the walled depth or the
 * characteristic depth (the roof over the recess zones): whichever the
 * silhouette fits is taken, and the choice is evidence for the roof's extent.
 */
export function registerElevationV2(
  frame: { id: string; assetId: string },
  extent: PixelRect,
  side: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT',
  sideConfidence: number,
  sideWhy: string,
  world: WorldFrameV2,
  ridgeY: number,
  sideEavesOverhangM: number,
  terrainY?: number,
): ElevationRegistrationV2 | undefined {
  const widthPx = extent.x1 - extent.x0
  const heightPx = extent.y1 - extent.y0
  if (widthPx <= 0 || heightPx <= 0) return undefined
  const e = world.envelope
  const w = world.walled
  const candidates: Array<{ spanM: number; along0: number; along1: number; why: string }> =
    side === 'FRONT' || side === 'REAR'
      ? [{ spanM: e.x1 - e.x0 + 2 * sideEavesOverhangM, along0: e.x0 - sideEavesOverhangM, along1: e.x1 + sideEavesOverhangM, why: `the ${(e.x1 - e.x0).toFixed(2)} m width of the envelope${sideEavesOverhangM > 0 ? ` plus ${sideEavesOverhangM} m of eaves each side` : ''}` }]
      : [
          { spanM: e.z1 - e.z0, along0: e.z0, along1: e.z1, why: `the ${(e.z1 - e.z0).toFixed(2)} m characteristic depth (the roof over the zones)` },
          { spanM: w.z1 - w.z0, along0: w.z0, along1: w.z1, why: `the ${(w.z1 - w.z0).toFixed(2)} m walled depth` },
        ]
  // The vertical scale that puts the apex on the ridge and the bottom on the terrain is the check; the width decides.
  const scored = candidates.map((c) => {
    const mpp = c.spanM / widthPx
    const bottomY = ridgeY - heightPx * mpp
    const expectedBottom = terrainY ?? 0
    return { ...c, mpp, bottomY, err: Math.abs(bottomY - expectedBottom) }
  })
  scored.sort((a, b) => a.err - b.err)
  const best = scored[0]
  if (best.err > 0.9) return undefined
  const mpp = best.mpp
  const zeroRow = extent.y1 + best.bottomY / mpp
  // Direction along the facade seen from outside: FRONT west→east, REAR east→west, LEFT (west wall) rear→front, RIGHT (east wall) front→rear.
  const alongAtLeft = side === 'FRONT' ? best.along0 : side === 'REAR' ? best.along1 : side === 'LEFT' ? best.along1 : best.along0
  const alongSign: 1 | -1 = side === 'FRONT' || side === 'RIGHT' ? 1 : -1
  return {
    frameId: frame.id,
    assetId: frame.assetId,
    side,
    sideConfidence,
    sideWhy,
    mpp: round6(mpp),
    extent,
    alongAtLeft: round6(alongAtLeft),
    alongSign,
    zeroRow: round6(zeroRow),
    spanM: round6(best.spanM),
    spanWhy: best.why + (scored.length > 1 ? ` (beats ${scored.slice(1).map((s) => `${s.spanM.toFixed(2)} m, which would put the ground ${s.bottomY.toFixed(2)} m`).join('; ')})` : ''),
    bottomY: round6(best.bottomY),
    anisotropyCheck: round6(best.err),
    confidence: round6(Math.max(0.2, Math.min(0.9, sideConfidence * (1 - best.err)))),
    why: `${widthPx} px across is ${best.why}, so ${mpp.toFixed(6)} m/px; the apex at row ${extent.y0} is the ridge datum ${ridgeY} and the silhouette's bottom then lands at ${best.bottomY.toFixed(2)} m${terrainY !== undefined ? ` against the terrain datum ${terrainY}` : ''}`,
  }
}

/** The metric helpers of a v2 elevation registration. */
export function elevationFrameFromV2(registration: ElevationRegistrationV2, world: WorldFrameV2): ElevationFrameV2 {
  const e = world.envelope
  const planeAt = registration.side === 'FRONT' ? e.z0 : registration.side === 'REAR' ? e.z1 : registration.side === 'LEFT' ? e.x0 : e.x1
  const alongOf = (px: number): number => round6(registration.alongAtLeft + registration.alongSign * (px - registration.extent.x0) * registration.mpp)
  const pxOf = (along: number): number => round6(registration.extent.x0 + (registration.alongSign * (along - registration.alongAtLeft)) / registration.mpp)
  const yOf = (py: number): number => round6((registration.zeroRow - py) * registration.mpp)
  const pyOf = (y: number): number => round6(registration.zeroRow - y / registration.mpp)
  const legacy: ElevationRegistration = {
    frameId: registration.frameId,
    assetId: registration.assetId,
    side: registration.side,
    sideWhy: registration.sideWhy,
    sideConfidence: registration.sideConfidence,
    metresPerPixelU: registration.mpp,
    metresPerPixelV: registration.mpp,
    extent: registration.extent,
    extentWhy: 'the silhouette of the render',
    spanM: registration.spanM,
    heightM: round6((registration.extent.y1 - registration.extent.y0) * registration.mpp),
    anisotropy: 1,
    overhangM: 0,
    confidence: registration.confidence,
    why: registration.why,
  }
  return { registration: legacy, side: registration.side, planeAt, alongOf, pxOf, yOf, pyOf }
}
