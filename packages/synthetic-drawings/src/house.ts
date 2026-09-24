/**
 * A building, and the sheets a publisher would draw of it.
 *
 * This is the ground truth the reconstruction pipeline is held to when no
 * publisher is involved. The spec below is the ONLY place the answer exists;
 * the sheets are drawn from it and then thrown at the pipeline as bytes, and
 * whatever comes back is compared to the spec. Nothing downstream of the
 * renderer ever sees this object, which is the entire point: a pipeline that
 * only reconstructs the one project it was written against has not been shown
 * to reconstruct anything.
 *
 * The house is deliberately NOT the reference project. Different footprint,
 * different storey heights, different pitch, a different number of openings,
 * a different arrangement of facade members, and a metre grid that shares no
 * dimension with it.
 */

import { Canvas } from './canvas.js'

export type Side = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT'

export type SyntheticOpening = {
  side: Side
  kind: 'WINDOW' | 'DOOR'
  /** Along the wall from its left end, looking at it from outside, in metres. */
  at: number
  width: number
  height: number
  /** Above the storey's floor, in metres. A door sits on the floor. */
  sill: number
  storey: number
  /** How many lights the ELEVATION draws it as, divided by mullions. The plan still draws one hole, because that is what the wall has. */
  lights?: number
  /**
   * MODEL frame, gable ends only: the head follows the roof pitch. `height` is
   * then the height at the TALL jamb (the one nearer the ridge); the other jamb
   * is lower by the width times the pitch's tangent, so the head is parallel
   * to the rake above it.
   */
  rakedHead?: boolean
}

/** A member that stands proud of the wall: what the model calls a linear solid. */
export type SyntheticMember = {
  side: Side
  orientation: 'HORIZONTAL' | 'VERTICAL'
  /** Along the wall, in metres. */
  at: number
  length: number
  /** Seen in elevation. */
  width: number
  /** How far it stands out of the wall. */
  depth: number
  /** Height of its lower edge above the ground floor, in metres. */
  y: number
}

/**
 * A body attached along the main one's right-hand side.
 *
 * Enough to draw a garage or an annex: its own width and depth, how far down
 * the main body's side it starts, how many storeys it reaches, and whether it
 * carries a roof of its own or is flat. It shares the main body's right-hand
 * wall, as an attached body does.
 */
export type SyntheticWing = {
  name: string
  width: number
  depth: number
  /** Where along the main body's depth it begins, in metres from the origin corner. */
  offsetZ: number
  /** How many storeys it reaches. One is a garage; two is another wing of the house. */
  storeys: number
  roof: 'FLAT' | 'GABLE'
  openings?: SyntheticOpening[]
}

/** A pocket bitten out of one facade: a loggia, a recessed entrance, a covered terrace. */
export type SyntheticRecess = {
  side: Side
  /** Along the wall from the corner the ring starts at, in metres. */
  at: number
  width: number
  /** How far into the building it goes. */
  depth: number
  storey: number
  /** Leave one of the two return walls undrawn: a pocket open along one side is not a pocket. */
  omitReturn?: 'LOW' | 'HIGH'
}

/**
 * A partition inside the body, MODEL frame: a thin solid band on the plan of
 * one storey, with its door gaps left white. `at` is its centre line across
 * (z for a wall running along x, x for one running along z); `from`..`to` is
 * its run along; a door's `at` is where the gap starts along the wall.
 */
export type SyntheticPartition = {
  storey: number
  axis: 'X' | 'Z'
  at: number
  from: number
  to: number
  thickness: number
  doors?: Array<{ at: number; width: number }>
}

/** A room number printed inside a room, MODEL frame, at half again the dimension text's size. */
export type SyntheticRoomNumber = { storey: number; x: number; z: number; text: string }

/**
 * A straight stair, MODEL frame, drawn on the plans of the storeys named: one
 * thin tread line per riser at an even going, a walking line along the middle
 * of the flight and a small filled arrowhead beyond the top riser. `x`/`z` is
 * the first riser line along the direction of travel and the low edge of the
 * flight across it.
 */
export type SyntheticStair = { storeys: number[]; direction: 'PLUS_X' | 'MINUS_X' | 'PLUS_Z' | 'MINUS_Z'; x: number; z: number; width: number; risers: number; going: number }

/** A chimney, MODEL frame: a solid block on every storey's plan, and a dark column above the roof line on the elevations, to `top` metres above the ground floor. */
export type SyntheticChimney = { x0: number; z0: number; x1: number; z1: number; top: number }

/**
 * A rooflight, MODEL frame, drawn as a light rectangle in the roof plane of the
 * elevation that sees that slope (LOW is the slope on the west or the front,
 * HIGH the one on the east or the rear). `along` runs along the ridge; `y` and
 * `height` are measured up from the eaves. Needs `roof.covering`, or there is
 * no plane to be lighter than.
 */
export type SyntheticRooflight = { slope: 'LOW' | 'HIGH'; along: number; width: number; y: number; height: number }

/** A return wall standing in the front zone, MODEL frame: wall-thick ink from the front wall face to the zone's mouth, with its west face at `x`. */
export type SyntheticReturn = { storey: number; x: number; width?: number }

/** A balcony slab's fascia on the front elevation, MODEL frame: a dark band under the storey's floor level across `x0`..`x1`, and a handrail line above it when `railingHeight` is given. */
export type SyntheticBalcony = { storey: number; x0: number; x1: number; fasciaDepth: number; railingHeight?: number }

export type SyntheticHouse = {
  name: string
  /**
   * Which frame the positions are stated in, and how the elevations are drawn.
   *
   * LEGACY (the default) is what the first fixtures were written in: an
   * opening's `at` runs along each wall from the end the wall starts at, and
   * an elevation puts that end on its left. MODEL states every position the
   * way the model does — x from the west outer face, z from the FRONT outer
   * plane (the mouth of the front zone when there is one), y from the ground
   * floor — and draws every elevation as seen from outside: the front with the
   * west on the left, the rear with the east on the left, the west wall with
   * the rear on the left, the east wall with the front on the left. The
   * features below the roof (partitions, stair, chimneys, rooflights, returns,
   * balconies) exist only in the MODEL frame.
   */
  frame?: 'LEGACY' | 'MODEL'
  /** The footprint, in metres. `width` runs west-east (x), `depth` north-south (z). */
  width: number
  depth: number
  wallThickness: number
  /** Storey heights, ground up. */
  storeys: Array<{ name: string; height: number }>
  roof: {
    pitchDeg: number
    overhang: number
    ridgeAxis: 'X' | 'Z'
    /** MODEL frame, ridge along Z: the roof runs on over the front zone to its mouth, so the gable stands over the loggia. */
    coversFrontZone?: boolean
    /** MODEL frame: the grey the roof plane is filled with on the elevations that see a slope face on. Undefined leaves it paper. */
    covering?: number
  }
  openings: SyntheticOpening[]
  members: SyntheticMember[]
  /** How the plan divides each axis into printed dimensions, in metres. Must sum to the OVERALL footprint, wings included. */
  chainsX: number[]
  chainsZ: number[]
  /** Bodies attached along the right-hand side. */
  wings?: SyntheticWing[]
  /** Pockets bitten out of a facade. */
  recesses?: SyntheticRecess[]
  /** How far the upper storeys are inset from the main body on each side, in metres. Zero is the same ring. */
  upperInset?: { minX?: number; maxX?: number; minZ?: number; maxZ?: number }
  /** The chains the upper storey's own plan prints. They must sum to what that storey actually covers. */
  upperChainsX?: number[]
  upperChainsZ?: number[]
  /** MODEL frame: a strip in front of the front wall that the plans dimension, in metres. `chainsZ` must include it. */
  frontZone?: number
  returns?: SyntheticReturn[]
  partitions?: SyntheticPartition[]
  roomNumbers?: SyntheticRoomNumber[]
  stair?: SyntheticStair
  chimneys?: SyntheticChimney[]
  rooflights?: SyntheticRooflight[]
  balconies?: SyntheticBalcony[]
}

/** The rear outer face's distance from the front outer plane: the depth, plus the front zone where there is one. */
export const rearPlane = (house: SyntheticHouse): number => house.depth + (house.frontZone ?? 0)

/** The whole building's extent, wings included. */
export const overallWidth = (house: SyntheticHouse): number => house.width + (house.wings ?? []).reduce((a, w) => Math.max(a, w.width), 0)

/** The level datums a section prints, ground up, in metres above the entrance floor. */
export function levelsOf(house: SyntheticHouse): Array<{ label: string; value: number }> {
  const out = [{ label: 'floor', value: 0 }]
  let y = 0
  for (const storey of house.storeys) {
    y += storey.height
    out.push({ label: storey.name, value: Number(y.toFixed(2)) })
  }
  out.push({ label: 'ridge', value: Number((y + ridgeRise(house)).toFixed(2)) })
  return out
}

/** How far the ridge stands above the top storey's ceiling. */
export function ridgeRise(house: SyntheticHouse): number {
  const span = house.roof.ridgeAxis === 'X' ? house.depth : house.width
  return Number(((span / 2) * Math.tan((house.roof.pitchDeg * Math.PI) / 180)).toFixed(4))
}

export const totalHeight = (house: SyntheticHouse): number => house.storeys.reduce((a, s) => a + s.height, 0) + ridgeRise(house)

// ---------------------------------------------------------------------------
// sheets
// ---------------------------------------------------------------------------

export type SheetOptions = {
  /** Pixels per metre. The sheet's scale, which the pipeline has to recover. */
  pixelsPerMetre?: number
  /** Cap height of the dimension text, in pixels. */
  capHeight?: number
  /** Italic slant of the dimension text. */
  slant?: number
  /** Compression speckle, as a fraction of pixels disturbed. */
  speckle?: number
  margin?: number
  /** How heavily the thin line work is drawn: reveals, chain lines, level rules. Walls keep their own thickness. */
  lineWeight?: number
  /** Room names, area callouts and furniture drawn inside the plan, 0..1: everything a sheet carries that is not structure. */
  clutter?: number
  /** An angle printed against the roof slope on the section, in degrees. Some publishers print one; most do not. */
  printedPitchDeg?: number
}

const DEFAULTS: Omit<Required<SheetOptions>, 'printedPitchDeg'> = { pixelsPerMetre: 38, capHeight: 16, slant: 0.18, speckle: 0, margin: 120, lineWeight: 1, clutter: 0 }

const cm = (metres: number): string => String(Math.round(metres * 100))

/** A chain of printed dimensions along the top or the left of the plan. */
function chain(c: Canvas, options: { axis: 'HORIZONTAL' | 'VERTICAL'; at: number; start: number; parts: number[]; ppm: number; capHeight: number; slant: number; weight?: number }): void {
  const { axis, at, ppm, capHeight, slant } = options
  const weight = options.weight ?? 1
  let position = options.start
  const place = (p: number) => (axis === 'HORIZONTAL' ? c.tick(p, at, 'HORIZONTAL') : c.tick(at, p, 'VERTICAL'))
  place(position)
  for (const part of options.parts) {
    const span = part * ppm
    const text = cm(part)
    const width = c.textWidth(text, capHeight)
    if (axis === 'HORIZONTAL') {
      c.line(position, at, position + span, at, weight)
      c.text(text, position + span / 2 - width / 2, at - capHeight - 6, capHeight, { slant })
    } else {
      c.line(at, position, at, position + span, weight)
      c.text(text, at - capHeight - 6, position + span / 2 + width / 2, capHeight, { rotate: 'CW' })
    }
    position += span
    place(position)
  }
}

/** The plan of one storey: walls, openings and the dimension chains that measure them. */
export function renderGroundPlan(house: SyntheticHouse, options: SheetOptions & { storey?: number } = {}): Canvas {
  if (house.frame === 'MODEL') return renderModelPlan(house, options)
  const o = { ...DEFAULTS, ...options }
  const storeyIndex = options.storey ?? 0
  const ppm = o.pixelsPerMetre
  const inset = house.upperInset ?? {}
  const shrink = storeyIndex === 0 ? { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } : { minX: inset.minX ?? 0, maxX: inset.maxX ?? 0, minZ: inset.minZ ?? 0, maxZ: inset.maxZ ?? 0 }
  const wings = (house.wings ?? []).filter((wing) => storeyIndex < wing.storeys)
  const overall = overallWidth(house)
  const c = new Canvas(Math.round(overall * ppm + o.margin * 2), Math.round(house.depth * ppm + o.margin * 2))
  const originX = o.margin
  const originY = o.margin
  const t = house.wallThickness * ppm
  const x0 = originX + shrink.minX * ppm
  const y0 = originY + shrink.minZ * ppm
  const w = (house.width - shrink.minX - shrink.maxX) * ppm
  const d = (house.depth - shrink.minZ - shrink.maxZ) * ppm

  // Walls, drawn as a solid ring the way a plan hatches them.
  c.fill(x0, y0, x0 + w, y0 + t)
  c.fill(x0, y0 + d - t, x0 + w, y0 + d)
  c.fill(x0, y0, x0 + t, y0 + d)
  c.fill(x0 + w - t, y0, x0 + w, y0 + d)

  // Attached bodies, sharing the main body's right-hand wall.
  for (const wing of wings) {
    const wx0 = originX + house.width * ppm - t
    const wy0 = originY + wing.offsetZ * ppm
    const ww = wing.width * ppm + t
    const wd = wing.depth * ppm
    c.fill(wx0, wy0, wx0 + ww, wy0 + t)
    c.fill(wx0, wy0 + wd - t, wx0 + ww, wy0 + wd)
    c.fill(wx0 + ww - t, wy0, wx0 + ww, wy0 + wd)
    for (const opening of wing.openings ?? []) {
      const at = opening.at * ppm
      const width = opening.width * ppm
      if (opening.side === 'FRONT' || opening.side === 'REAR') {
        const y = opening.side === 'FRONT' ? wy0 + wd - t : wy0
        const along = opening.side === 'FRONT' ? ww - at - width : at
        c.fill(wx0 + along, y, wx0 + along + width, y + t, 255)
      } else if (opening.side === 'RIGHT') {
        c.fill(wx0 + ww - t, wy0 + at, wx0 + ww, wy0 + at + width, 255)
      }
    }
  }

  // Pockets bitten out of a facade: the wall steps in and back out again.
  for (const recess of house.recesses ?? []) {
    if (recess.storey !== storeyIndex) continue
    const at = recess.at * ppm
    const width = recess.width * ppm
    const depth = recess.depth * ppm
    if (recess.side === 'FRONT' || recess.side === 'REAR') {
      const outer = recess.side === 'FRONT' ? y0 + d - t : y0
      const along = recess.side === 'FRONT' ? w - at - width : at
      // Cut the facade away over the recess's width, put the back wall in at
      // its depth, and close both ends with returns.
      c.fill(x0 + along, outer, x0 + along + width, outer + t, 255)
      const back = recess.side === 'FRONT' ? y0 + d - depth - t : y0 + depth
      c.fill(x0 + along, back, x0 + along + width, back + t)
      const side0 = recess.side === 'FRONT' ? back : y0
      const side1 = recess.side === 'FRONT' ? y0 + d : back + t
      if (recess.omitReturn !== 'LOW') c.fill(x0 + along, side0, x0 + along + t, side1)
      if (recess.omitReturn !== 'HIGH') c.fill(x0 + along + width - t, side0, x0 + along + width, side1)
    }
  }

  // Openings: a gap in the wall with its reveal lines, as a plan draws them.
  for (const opening of house.openings) {
    if (opening.storey !== storeyIndex) continue
    const at = opening.at * ppm
    const width = opening.width * ppm
    if (opening.side === 'FRONT' || opening.side === 'REAR') {
      const y = opening.side === 'FRONT' ? y0 + d - t : y0
      // Same rule as the side walls: the front wall is traversed from the
      // right-hand end of the plan, so `at` counts from there.
      const along = opening.side === 'FRONT' ? w - at - width : at
      c.fill(x0 + along, y, x0 + along + width, y + t, 255)
      c.line(x0 + along, y, x0 + along, y + t, o.lineWeight)
      c.line(x0 + along + width, y, x0 + along + width, y + t, o.lineWeight)
    } else {
      const x = opening.side === 'LEFT' ? x0 : x0 + w - t
      // `at` is measured along the wall the way the model measures it: each
      // wall is traversed with the building on its left, so the left-hand wall
      // runs from the far end of the plan back towards its origin and an
      // opening 2.4 m along it is 2.4 m from the BOTTOM of the sheet. Drawing
      // it from the top would put the plan and the elevation of the same wall
      // a mirror apart, which is a fixture that cannot be reconstructed.
      const along = opening.side === 'LEFT' ? d - at - width : at
      c.fill(x, y0 + along, x + t, y0 + along + width, 255)
      c.line(x, y0 + along, x + t, y0 + along, o.lineWeight)
      c.line(x, y0 + along + width, x + t, y0 + along + width, o.lineWeight)
    }
  }

  const partsX = storeyIndex === 0 ? house.chainsX : (house.upperChainsX ?? house.chainsX)
  const partsZ = storeyIndex === 0 ? house.chainsZ : (house.upperChainsZ ?? house.chainsZ)
  const spanX = partsX.reduce((a, b) => a + b, 0)
  const spanZ = partsZ.reduce((a, b) => a + b, 0)
  // The chains: an overall dimension above the parts, on each axis. They
  // measure WHAT THIS STOREY COVERS, wings included — which is what a plan
  // does, and what makes the breakpoint between two bodies, and the step where
  // an upper storey stops short of the one below, printed facts rather than
  // inferences from ink.
  // A chain is hung off the face it ends at, so that a storey which prints the
  // whole building's depth and a storey which prints only its own both start
  // where their own numbers say they do. That is what lets the two plans be
  // put over one another later: a chain is the only thing on either sheet that
  // says where this storey sits in the building.
  const farX = Math.max(house.width - shrink.maxX, ...wings.map((wing) => house.width + wing.width))
  const farZ = house.depth - shrink.maxZ
  const chainX0 = originX + (farX - spanX) * ppm
  const chainZ0 = originY + (farZ - spanZ) * ppm
  chain(c, { axis: 'HORIZONTAL', at: originY - 74, start: chainX0, parts: [spanX], ppm, capHeight: o.capHeight, slant: o.slant, weight: o.lineWeight })
  chain(c, { axis: 'HORIZONTAL', at: originY - 34, start: chainX0, parts: partsX, ppm, capHeight: o.capHeight, slant: o.slant, weight: o.lineWeight })
  chain(c, { axis: 'VERTICAL', at: originX - 74, start: chainZ0, parts: [spanZ], ppm, capHeight: o.capHeight, slant: o.slant, weight: o.lineWeight })
  chain(c, { axis: 'VERTICAL', at: originX - 34, start: chainZ0, parts: partsZ, ppm, capHeight: o.capHeight, slant: o.slant, weight: o.lineWeight })
  if (o.clutter > 0) annotate(c, { x0, y0, x1: x0 + w, y1: y0 + d }, o.clutter, o.capHeight, ppm, storeyIndex)
  if (o.speckle > 0) c.speckle(o.speckle, 11)
  return c
}

/**
 * Everything a published plan carries that is not the building.
 *
 * Room names, areas to two decimal places, a furniture block, a hatched
 * terrace: all of it drawn inside the walls, all of it ink, none of it
 * structure. A reader that takes the largest connected component, or that
 * counts ink to decide what is enclosed, fails here and should.
 */
function annotate(c: Canvas, inside: { x0: number; y0: number; x1: number; y1: number }, amount: number, capHeight: number, ppm: number, seed: number): void {
  const names = ['SALON', 'KUCHNIA', 'HOL', 'LAZIENKA', 'POKOJ', 'GARDEROBA', 'SPIZARNIA', 'PRALNIA']
  const width = inside.x1 - inside.x0
  const height = inside.y1 - inside.y0
  const rows = Math.max(1, Math.round(3 * amount))
  const columns = Math.max(1, Math.round(3 * amount))
  let n = seed
  const next = (): number => {
    n = (n * 1103515245 + 12345) & 0x7fffffff
    return n / 0x7fffffff
  }
  const small = Math.max(7, Math.round(capHeight * 0.55))
  for (let r = 0; r < rows; r += 1) {
    for (let k = 0; k < columns; k += 1) {
      const cx = inside.x0 + ((k + 0.5) * width) / columns
      const cy = inside.y0 + ((r + 0.5) * height) / rows
      const label = names[(r * columns + k) % names.length]
      c.text(label, cx - c.textWidth(label, small) / 2, cy - small - 2, small)
      const area = `${(6 + next() * 18).toFixed(2)} m2`
      c.text(area, cx - c.textWidth(area, small) / 2, cy + 4, small)
      // A furniture block: thin outline, no thickness, nothing structural.
      if (next() < amount) {
        const fw = ppm * (0.6 + next() * 1.2)
        const fh = ppm * (0.5 + next() * 0.9)
        c.rect(cx - fw / 2, cy + small + 6, cx + fw / 2, cy + small + 6 + fh, 1)
      }
    }
  }
}

/** Which wall an elevation shows, and how long it is. Front and rear see the wings too. */
export const elevationSpan = (house: SyntheticHouse, side: Side): number => (side === 'FRONT' || side === 'REAR' ? overallWidth(house) : rearPlane(house))

/** How tall a wing's walls stand, and how far its own ridge rises above them. */
export function wingHeights(house: SyntheticHouse, wing: SyntheticWing): { wall: number; rise: number } {
  const wall = house.storeys.slice(0, wing.storeys).reduce((a, s) => a + s.height, 0)
  const rise = wing.roof === 'FLAT' ? 0 : Number(((wing.width / 2) * Math.tan((house.roof.pitchDeg * Math.PI) / 180)).toFixed(4))
  return { wall, rise }
}

/** An orthographic elevation: silhouette, roof, openings and the members that stand proud. */
export function renderElevation(house: SyntheticHouse, side: Side, options: SheetOptions = {}): Canvas {
  if (house.frame === 'MODEL') return renderModelElevation(house, side, options)
  const o = { ...DEFAULTS, ...options }
  const ppm = o.pixelsPerMetre
  const span = elevationSpan(house, side)
  const wallHeight = house.storeys.reduce((a, s) => a + s.height, 0)
  const rise = ridgeRise(house)
  const c = new Canvas(Math.round(span * ppm + o.margin * 2), Math.round((wallHeight + rise) * ppm + o.margin * 2))
  const x0 = o.margin
  const ground = o.margin + (wallHeight + rise) * ppm
  const yOf = (metres: number): number => ground - metres * ppm

  // The main body's wall block, which on a front or rear view occupies only
  // its own width: a wing standing beside it is a separate block, of its own
  // height, under its own roof, and drawing the two as one rectangle is
  // exactly the reading this stage exists to stop.
  const bodySpan = side === 'FRONT' || side === 'REAR' ? house.width : house.depth
  const bodyX = side === 'REAR' ? x0 + (span - bodySpan) * ppm : x0
  c.rect(bodyX, yOf(wallHeight), bodyX + bodySpan * ppm, ground, 2)
  // The roof: a gable when the ridge runs across this view, a rake when along it.
  const gable = (house.roof.ridgeAxis === 'X') === (side === 'LEFT' || side === 'RIGHT')
  const overhang = house.roof.overhang * ppm
  if (gable) {
    c.line(bodyX - overhang, yOf(wallHeight), bodyX + (bodySpan * ppm) / 2, yOf(wallHeight + rise), 2)
    c.line(bodyX + (bodySpan * ppm) / 2, yOf(wallHeight + rise), bodyX + bodySpan * ppm + overhang, yOf(wallHeight), 2)
  } else {
    c.line(bodyX - overhang, yOf(wallHeight + rise), bodyX + bodySpan * ppm + overhang, yOf(wallHeight + rise), 2)
    c.line(bodyX - overhang, yOf(wallHeight), bodyX - overhang, yOf(wallHeight + rise), 1)
    c.line(bodyX + bodySpan * ppm + overhang, yOf(wallHeight), bodyX + bodySpan * ppm + overhang, yOf(wallHeight + rise), 1)
  }
  // The wings, on the views that see them side on.
  if (side === 'FRONT' || side === 'REAR') {
    for (const wing of house.wings ?? []) {
      const { wall, rise: wingRise } = wingHeights(house, wing)
      const left = side === 'FRONT' ? x0 + house.width * ppm : x0
      c.rect(left, yOf(wall), left + wing.width * ppm, ground, 2)
      if (wingRise > 0) {
        c.line(left, yOf(wall), left + (wing.width * ppm) / 2, yOf(wall + wingRise), 2)
        c.line(left + (wing.width * ppm) / 2, yOf(wall + wingRise), left + wing.width * ppm, yOf(wall), 2)
      }
    }
  }

  const floorOf = (storey: number): number => house.storeys.slice(0, storey).reduce((a, s) => a + s.height, 0)
  for (const opening of house.openings) {
    if (opening.side !== side) continue
    const left = bodyX + opening.at * ppm
    const bottom = yOf(floorOf(opening.storey) + opening.sill)
    const top = yOf(floorOf(opening.storey) + opening.sill + opening.height)
    c.rect(left, top, left + opening.width * ppm, bottom, 2)
    // A window divided by mullions is drawn as one reveal with several lights
    // inside it. Each light is a closed rectangle and none of them is a window.
    const lights = opening.lights ?? 1
    if (lights > 1) {
      const inner = (opening.width * ppm) / lights
      const bar = Math.max(2, 0.06 * ppm)
      for (let i = 0; i < lights; i += 1) {
        const l0 = left + i * inner + (i === 0 ? bar : bar / 2)
        const l1 = left + (i + 1) * inner - (i === lights - 1 ? bar : bar / 2)
        c.rect(l0, top + bar, l1, bottom - bar, 1)
      }
    }
  }
  // A member proud of the wall reads as a filled band: darker than the wall,
  // because that is what a shadowed solid looks like on a technical elevation.
  for (const member of house.members) {
    if (member.side !== side) continue
    const left = bodyX + member.at * ppm
    if (member.orientation === 'HORIZONTAL') c.fill(left, yOf(member.y + member.width), left + member.length * ppm, yOf(member.y), 40)
    else c.fill(left, yOf(member.y + member.length), left + member.width * ppm, yOf(member.y), 40)
  }
  if (o.speckle > 0) c.speckle(o.speckle, 23)
  return c
}

/** A section: the storeys cut through, with the level datums printed against their rules. */
export function renderSection(house: SyntheticHouse, options: SheetOptions = {}): Canvas {
  if (house.frame === 'MODEL') return renderModelSection(house, options)
  const o = { ...DEFAULTS, ...options }
  const ppm = o.pixelsPerMetre
  const span = house.roof.ridgeAxis === 'X' ? house.depth : house.width
  const wallHeight = house.storeys.reduce((a, s) => a + s.height, 0)
  const rise = ridgeRise(house)
  const c = new Canvas(Math.round(span * ppm + o.margin * 4), Math.round((wallHeight + rise) * ppm + o.margin * 2))
  const x0 = o.margin * 2.5
  const ground = o.margin + (wallHeight + rise) * ppm
  const yOf = (metres: number): number => ground - metres * ppm
  const t = house.wallThickness * ppm

  c.fill(x0, yOf(wallHeight), x0 + t, ground)
  c.fill(x0 + span * ppm - t, yOf(wallHeight), x0 + span * ppm, ground)
  c.line(x0, yOf(wallHeight), x0 + (span * ppm) / 2, yOf(wallHeight + rise), 2)
  c.line(x0 + (span * ppm) / 2, yOf(wallHeight + rise), x0 + span * ppm, yOf(wallHeight), 2)
  // An angle printed against the slope, where the publisher prints one. It is
  // written where a draughtsman writes it: just above the eaves, inside the
  // triangle, close enough to the rake to belong to it.
  if (options.printedPitchDeg !== undefined) {
    const text = `${Math.round(options.printedPitchDeg)}\u00b0`
    const size = Math.round(o.capHeight * 1.1)
    c.text(text, x0 + span * ppm * 0.16, yOf(wallHeight) - Math.round(rise * ppm * 0.14) - size, size)
  }

  // Heights are printed in the margin, clear of the section body: a number
  // written over a hatched wall is a number nobody can read, on a real sheet
  // or a synthetic one.
  const leader = o.margin * 1.6
  for (const level of levelsOf(house)) {
    const y = yOf(level.value)
    const width = level.label === 'ridge' ? span * ppm * 0.45 : span * ppm
    c.line(x0 - leader, y, x0 + width, y, 1)
    const text = level.value === 0 ? '±0,00' : `+${level.value.toFixed(2).replace('.', ',')}`
    c.text(text, x0 - leader + 6, y - Math.round(o.capHeight * 1.35) - 8, Math.round(o.capHeight * 1.35))
  }
  if (o.speckle > 0) c.speckle(o.speckle, 37)
  return c
}

// ---------------------------------------------------------------------------
// MODEL frame sheets
// ---------------------------------------------------------------------------

/** Tones the MODEL-frame elevations fill things with: a shadowed solid, a door leaf, a pane of glass. */
const TONE = { solid: 40, door: 110, glass: 165, rooflight: 212 } as const

/** How far the ring of one storey is inset from the ground storey's, on each side. */
function insetOf(house: SyntheticHouse, storeyIndex: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const inset = house.upperInset ?? {}
  return storeyIndex === 0 ? { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } : { minX: inset.minX ?? 0, maxX: inset.maxX ?? 0, minZ: inset.minZ ?? 0, maxZ: inset.maxZ ?? 0 }
}

/**
 * The plan of one storey in the MODEL frame: x from the west outer face to the
 * right, z from the front outer plane UP the sheet, so the front is the bottom
 * of the drawing and the rear its top, which is how a published plan is set.
 */
function renderModelPlan(house: SyntheticHouse, options: SheetOptions & { storey?: number }): Canvas {
  const o = { ...DEFAULTS, ...options }
  const storeyIndex = options.storey ?? 0
  const ppm = o.pixelsPerMetre
  const zone = house.frontZone ?? 0
  const zRear = rearPlane(house)
  const shrink = insetOf(house, storeyIndex)
  const wings = (house.wings ?? []).filter((wing) => storeyIndex < wing.storeys)
  const overall = overallWidth(house)
  const c = new Canvas(Math.round(overall * ppm + o.margin * 2), Math.round(zRear * ppm + o.margin * 2))
  const originX = o.margin
  const originY = o.margin
  const T = house.wallThickness
  const px = (x: number): number => originX + x * ppm
  const py = (z: number): number => originY + (zRear - z) * ppm
  /** A filled rectangle stated in model metres. */
  const fillM = (x0: number, z0: number, x1: number, z1: number, value = 0): void => c.fill(px(x0), py(z1), px(x1), py(z0), value)
  const lineM = (x0: number, z0: number, x1: number, z1: number, weight = 1): void => c.line(px(x0), py(z0), px(x1), py(z1), weight)

  // The ring: its outer faces in model metres.
  const xa = shrink.minX
  const xb = house.width - shrink.maxX
  const za = zone + shrink.maxZ
  const zb = zRear - shrink.minZ
  fillM(xa, zb - T, xb, zb)
  fillM(xa, za, xb, za + T)
  fillM(xa, za, xa + T, zb)
  fillM(xb - T, za, xb, zb)

  // Attached bodies on the east side, sharing the main body's east wall.
  for (const wing of wings) {
    const wx0 = house.width - T
    const wx1 = house.width + wing.width
    const wz1 = zRear - wing.offsetZ
    const wz0 = wz1 - wing.depth
    fillM(wx0, wz1 - T, wx1, wz1)
    fillM(wx0, wz0, wx1, wz0 + T)
    fillM(wx1 - T, wz0, wx1, wz1)
    for (const opening of wing.openings ?? []) {
      if (opening.side === 'FRONT' || opening.side === 'REAR') {
        const z0 = opening.side === 'FRONT' ? wz0 : wz1 - T
        fillM(opening.at, z0, opening.at + opening.width, z0 + T, 255)
      } else if (opening.side === 'RIGHT') fillM(wx1 - T, opening.at, wx1, opening.at + opening.width, 255)
    }
  }

  // Return walls: wall-thick ink standing in the front zone against the wall face.
  for (const r of house.returns ?? []) {
    if (r.storey !== storeyIndex) continue
    fillM(r.x, 0, r.x + (r.width ?? T), za)
  }

  // Openings: a white gap with its reveal lines; a window also draws its glazing lines across the gap.
  for (const opening of house.openings) {
    if (opening.storey !== storeyIndex) continue
    if (opening.side === 'FRONT' || opening.side === 'REAR') {
      const z0 = opening.side === 'FRONT' ? za : zb - T
      fillM(opening.at, z0, opening.at + opening.width, z0 + T, 255)
      lineM(opening.at, z0, opening.at, z0 + T, o.lineWeight)
      lineM(opening.at + opening.width, z0, opening.at + opening.width, z0 + T, o.lineWeight)
      if (opening.kind === 'WINDOW') for (const f of [1 / 3, 2 / 3]) lineM(opening.at, z0 + f * T, opening.at + opening.width, z0 + f * T, 1)
    } else {
      const x0 = opening.side === 'LEFT' ? xa : xb - T
      fillM(x0, opening.at, x0 + T, opening.at + opening.width, 255)
      lineM(x0, opening.at, x0 + T, opening.at, o.lineWeight)
      lineM(x0, opening.at + opening.width, x0 + T, opening.at + opening.width, o.lineWeight)
      if (opening.kind === 'WINDOW') for (const f of [1 / 3, 2 / 3]) lineM(x0 + f * T, opening.at, x0 + f * T, opening.at + opening.width, 1)
    }
  }

  // Partitions with their door gaps.
  for (const p of house.partitions ?? []) {
    if (p.storey !== storeyIndex) continue
    const h = p.thickness / 2
    if (p.axis === 'X') {
      fillM(p.from, p.at - h, p.to, p.at + h)
      for (const d of p.doors ?? []) fillM(d.at, p.at - h, d.at + d.width, p.at + h, 255)
    } else {
      fillM(p.at - h, p.from, p.at + h, p.to)
      for (const d of p.doors ?? []) fillM(p.at - h, d.at, p.at + h, d.at + d.width, 255)
    }
  }

  // Solid blocks: chimneys stand on every storey's plan.
  for (const ch of house.chimneys ?? []) fillM(ch.x0, ch.z0, ch.x1, ch.z1)

  // The stair: tread lines, the walking line and its arrowhead.
  const stair = house.stair
  if (stair && stair.storeys.includes(storeyIndex)) {
    const alongX = stair.direction === 'PLUS_X' || stair.direction === 'MINUS_X'
    const sign = stair.direction === 'PLUS_X' || stair.direction === 'PLUS_Z' ? 1 : -1
    const a0 = alongX ? stair.x : stair.z
    const b0 = alongX ? stair.z : stair.x
    const b1 = b0 + stair.width
    const mid = (b0 + b1) / 2
    const point = (a: number, b: number): { x: number; y: number } => (alongX ? { x: px(a), y: py(b) } : { x: px(b), y: py(a) })
    for (let i = 0; i < stair.risers; i += 1) {
      const a = a0 + sign * i * stair.going
      const p = point(a, b0)
      const q = point(a, b1)
      c.line(p.x, p.y, q.x, q.y, 1)
    }
    const last = a0 + sign * (stair.risers - 1) * stair.going
    const lengthPx = 10
    const halfBase = 4
    const centre = last + sign * 0.35 * stair.width
    const tip = centre + (sign * (lengthPx / 2)) / ppm
    const base = centre - (sign * (lengthPx / 2)) / ppm
    const from = point(a0, mid)
    const to = point(base, mid)
    c.line(from.x, from.y, to.x, to.y, 1)
    // The arrowhead: a filled triangle, its tip pointing the way the stair climbs.
    const sheetSign = alongX ? sign : -sign
    const tipPx = point(tip, mid)
    for (let k = 0; k <= lengthPx; k += 1) {
      const half = (k / lengthPx) * halfBase
      const along = alongX ? tipPx.x - sheetSign * k : tipPx.y - sheetSign * k
      for (let d = -half; d <= half; d += 1) {
        if (alongX) c.plot(along, tipPx.y + d)
        else c.plot(tipPx.x + d, along)
      }
    }
  }

  // Room numbers, printed inside the rooms at the sheet's reference size; a
  // plan that numbers its rooms sets its dimension text a little smaller, so
  // the numbers stand out from the chains the way a reader expects them to.
  const dimCap = (house.roomNumbers ?? []).some((n) => n.storey === storeyIndex) ? Math.round(o.capHeight * 0.8) : o.capHeight
  for (const n of house.roomNumbers ?? []) {
    if (n.storey !== storeyIndex) continue
    c.text(n.text, px(n.x) - c.textWidth(n.text, o.capHeight) / 2, py(n.z) - o.capHeight / 2, o.capHeight)
  }

  // The chains, hung off the face they end at: the mouth of the zone when the
  // chain measures it, the wall face when it does not.
  const partsX = storeyIndex === 0 ? house.chainsX : (house.upperChainsX ?? house.chainsX)
  const partsZ = storeyIndex === 0 ? house.chainsZ : (house.upperChainsZ ?? house.chainsZ)
  const spanX = partsX.reduce((a, b) => a + b, 0)
  const spanZ = partsZ.reduce((a, b) => a + b, 0)
  const farX = Math.max(xb, ...wings.map((wing) => house.width + wing.width))
  const walledDepth = zb - za
  const zBottom = spanZ > walledDepth + 1e-6 ? shrink.maxZ : za
  const chainX0 = px(farX - spanX)
  const chainZ0 = py(zBottom + spanZ)
  chain(c, { axis: 'HORIZONTAL', at: originY - 74, start: chainX0, parts: [spanX], ppm, capHeight: dimCap, slant: o.slant, weight: o.lineWeight })
  chain(c, { axis: 'HORIZONTAL', at: originY - 34, start: chainX0, parts: partsX, ppm, capHeight: dimCap, slant: o.slant, weight: o.lineWeight })
  chain(c, { axis: 'VERTICAL', at: originX - 74, start: chainZ0, parts: [spanZ], ppm, capHeight: dimCap, slant: o.slant, weight: o.lineWeight })
  chain(c, { axis: 'VERTICAL', at: originX - 34, start: chainZ0, parts: partsZ, ppm, capHeight: dimCap, slant: o.slant, weight: o.lineWeight })
  if (o.clutter > 0) annotate(c, { x0: px(xa), y0: py(zb), x1: px(xb), y1: py(za) }, o.clutter, o.capHeight, ppm, storeyIndex)
  if (o.speckle > 0) c.speckle(o.speckle, 11)
  return c
}

/**
 * An orthographic elevation in the MODEL frame, as seen from outside: the
 * front with the west on the left, the rear with the east on the left, the
 * west wall with the rear on the left, the east wall with the front on the
 * left. Openings are filled — glass one tone, a door leaf another — because
 * that is what an elevation reader measures a sill and a head against.
 */
function renderModelElevation(house: SyntheticHouse, side: Side, options: SheetOptions): Canvas {
  const o = { ...DEFAULTS, ...options }
  const ppm = o.pixelsPerMetre
  const zone = house.frontZone ?? 0
  const zRear = rearPlane(house)
  const overall = overallWidth(house)
  const span = elevationSpan(house, side)
  const wallHeight = house.storeys.reduce((a, s) => a + s.height, 0)
  const rise = ridgeRise(house)
  const ridge = wallHeight + rise
  const tan = Math.tan((house.roof.pitchDeg * Math.PI) / 180)
  const c = new Canvas(Math.round(span * ppm + o.margin * 2), Math.round(ridge * ppm + o.margin * 2))
  const x0 = o.margin
  const ground = o.margin + ridge * ppm
  const yOf = (metres: number): number => ground - metres * ppm
  /** Along the drawing, from its left edge, for a model coordinate along this facade. */
  const uOf = (a: number): number => (side === 'FRONT' ? a : side === 'REAR' ? overall - a : side === 'LEFT' ? zRear - a : a)
  const ux = (u: number): number => x0 + u * ppm
  const range = (a: number, b: number): [number, number] => [Math.min(uOf(a), uOf(b)), Math.max(uOf(a), uOf(b))]
  const floorOf = (storey: number): number => house.storeys.slice(0, storey).reduce((a, s) => a + s.height, 0)
  const topOf = (storey: number): number => floorOf(storey) + house.storeys[storey].height
  const sideView = side === 'LEFT' || side === 'RIGHT'
  const body = sideView ? range(zone, zRear) : range(0, house.width)
  const mid = (body[0] + body[1]) / 2
  const gable = (house.roof.ridgeAxis === 'X') === sideView
  const roofRange: [number, number] = !gable && sideView && house.roof.ridgeAxis === 'Z' && house.roof.coversFrontZone ? range(0, zRear) : body
  const rakeAt = (u: number): number => ridge - Math.abs(u - mid) * tan

  // The roof plane, where this view sees one face on and the sheet colours it.
  if (!gable && house.roof.covering !== undefined) {
    c.fill(ux(roofRange[0]), yOf(ridge), ux(roofRange[1]), yOf(wallHeight), house.roof.covering)
    const shows = house.roof.ridgeAxis === 'Z' ? (side === 'LEFT' ? 'LOW' : side === 'RIGHT' ? 'HIGH' : undefined) : side === 'FRONT' ? 'LOW' : side === 'REAR' ? 'HIGH' : undefined
    for (const r of house.rooflights ?? []) {
      if (r.slope !== shows) continue
      const [u0, u1] = range(r.along, r.along + r.width)
      c.fill(ux(u0), yOf(wallHeight + r.y + r.height), ux(u1), yOf(wallHeight + r.y), TONE.rooflight)
    }
  }
  // The wall block and the roof over it.
  c.rect(ux(body[0]), yOf(wallHeight), ux(body[1]), ground, 2)
  if (gable) {
    c.line(ux(body[0]), yOf(wallHeight), ux(mid), yOf(ridge), 2)
    c.line(ux(mid), yOf(ridge), ux(body[1]), yOf(wallHeight), 2)
  } else {
    c.line(ux(roofRange[0]), yOf(ridge), ux(roofRange[1]), yOf(ridge), 2)
    c.line(ux(roofRange[0]), yOf(wallHeight), ux(roofRange[1]), yOf(wallHeight), 2)
    c.line(ux(roofRange[0]), yOf(wallHeight), ux(roofRange[0]), yOf(ridge), 1)
    c.line(ux(roofRange[1]), yOf(wallHeight), ux(roofRange[1]), yOf(ridge), 1)
  }
  // Attached bodies: beside the main body on the front and the rear, in front of its east wall on the right.
  for (const wing of house.wings ?? []) {
    if (side === 'LEFT') continue
    const { wall, rise: wingRise } = wingHeights(house, wing)
    const wz1 = zRear - wing.offsetZ
    const [u0, u1] = sideView ? range(wz1 - wing.depth, wz1) : range(house.width, house.width + wing.width)
    c.rect(ux(u0), yOf(wall), ux(u1), ground, 2)
    if (wingRise > 0 && !sideView) {
      c.line(ux(u0), yOf(wall), ux((u0 + u1) / 2), yOf(wall + wingRise), 2)
      c.line(ux((u0 + u1) / 2), yOf(wall + wingRise), ux(u1), yOf(wall), 2)
    }
    for (const opening of wing.openings ?? []) {
      if (opening.side !== side) continue
      const [a, b] = range(opening.at, opening.at + opening.width)
      const bottom = yOf(floorOf(opening.storey) + opening.sill)
      const top = yOf(floorOf(opening.storey) + opening.sill + opening.height)
      c.fill(ux(a), top, ux(b), bottom, opening.kind === 'DOOR' ? TONE.door : TONE.glass)
      c.rect(ux(a), top, ux(b), bottom, 2)
    }
  }
  // Return walls: their faces on the front, their profiles on the sides.
  for (const r of house.returns ?? []) {
    if (side === 'REAR') continue
    const [u0, u1] = sideView ? range(0, zone) : range(r.x, r.x + (r.width ?? house.wallThickness))
    c.rect(ux(u0), yOf(topOf(r.storey)), ux(u1), yOf(floorOf(r.storey)), 2)
  }
  // Openings, filled and outlined; a raked head follows the rake on a gable end.
  for (const opening of house.openings) {
    if (opening.side !== side) continue
    const [u0, u1] = range(opening.at, opening.at + opening.width)
    const sill = floorOf(opening.storey) + opening.sill
    const tone = opening.kind === 'DOOR' ? TONE.door : TONE.glass
    if (opening.rakedHead && gable) {
      const tallU = Math.abs(u0 - mid) < Math.abs(u1 - mid) ? u0 : u1
      const headAt = (u: number): number => sill + opening.height - Math.abs(u - tallU) * tan
      for (let xpx = Math.round(ux(u0)); xpx <= Math.round(ux(u1)); xpx += 1) c.fill(xpx, yOf(headAt((xpx - x0) / ppm)), xpx, yOf(sill), tone)
      c.line(ux(u0), yOf(sill), ux(u1), yOf(sill), 2)
      c.line(ux(u0), yOf(sill), ux(u0), yOf(headAt(u0)), 2)
      c.line(ux(u1), yOf(sill), ux(u1), yOf(headAt(u1)), 2)
      c.line(ux(u0), yOf(headAt(u0)), ux(u1), yOf(headAt(u1)), 2)
      continue
    }
    const bottom = yOf(sill)
    const top = yOf(sill + opening.height)
    c.fill(ux(u0), top, ux(u1), bottom, tone)
    c.rect(ux(u0), top, ux(u1), bottom, 2)
    const lights = opening.lights ?? 1
    if (lights > 1) {
      const inner = (u1 - u0) * ppm / lights
      const bar = Math.max(2, 0.06 * ppm)
      for (let i = 0; i < lights; i += 1) {
        const l0 = ux(u0) + i * inner + (i === 0 ? bar : bar / 2)
        const l1 = ux(u0) + (i + 1) * inner - (i === lights - 1 ? bar : bar / 2)
        c.rect(l0, top + bar, l1, bottom - bar, 1)
      }
    }
  }
  // Members proud of the wall: filled bands.
  for (const member of house.members) {
    if (member.side !== side) continue
    const [u0, u1] = member.orientation === 'HORIZONTAL' ? range(member.at, member.at + member.length) : range(member.at, member.at + member.width)
    if (member.orientation === 'HORIZONTAL') c.fill(ux(u0), yOf(member.y + member.width), ux(u1), yOf(member.y), TONE.solid)
    else c.fill(ux(u0), yOf(member.y + member.length), ux(u1), yOf(member.y), TONE.solid)
  }
  // Chimneys: a dark column from the roof line up. A gable view sees it rise
  // off the slope at its position; a view of the slope face on sees only what
  // stands above the ridge.
  for (const ch of house.chimneys ?? []) {
    const [u0, u1] = sideView ? range(ch.z0, ch.z1) : range(ch.x0, ch.x1)
    const bottom = gable ? Math.min(rakeAt(u0), rakeAt(u1)) - 0.15 : ridge - 0.05
    if (ch.top > bottom) c.fill(ux(u0), yOf(ch.top), ux(u1), yOf(bottom), TONE.solid)
  }
  // Balcony fascias and handrails on the front.
  if (side === 'FRONT') {
    for (const b of house.balconies ?? []) {
      const floor = floorOf(b.storey)
      const [u0, u1] = range(b.x0, b.x1)
      c.fill(ux(u0), yOf(floor + 0.05), ux(u1), yOf(floor + 0.05 - b.fasciaDepth), TONE.solid)
      if (b.railingHeight !== undefined) c.line(ux(u0), yOf(floor + b.railingHeight), ux(u1), yOf(floor + b.railingHeight), 1)
    }
  }
  if (o.speckle > 0) c.speckle(o.speckle, 23)
  return c
}

/**
 * A section in the MODEL frame. Across the width when the ridge runs along z
 * — through the attached bodies too, each under its own roof: a gable of its
 * own or a flat slab drawn as the solid band it is — and across the depth when
 * the ridge runs along x.
 */
function renderModelSection(house: SyntheticHouse, options: SheetOptions): Canvas {
  const o = { ...DEFAULTS, ...options }
  const ppm = o.pixelsPerMetre
  const acrossX = house.roof.ridgeAxis === 'Z'
  const span = acrossX ? overallWidth(house) : house.depth
  const wallHeight = house.storeys.reduce((a, s) => a + s.height, 0)
  const rise = ridgeRise(house)
  const c = new Canvas(Math.round(span * ppm + o.margin * 4), Math.round((wallHeight + rise) * ppm + o.margin * 2))
  const x0 = o.margin * 2.5
  const ground = o.margin + (wallHeight + rise) * ppm
  const yOf = (metres: number): number => ground - metres * ppm
  const ux = (u: number): number => x0 + u * ppm
  const T = house.wallThickness
  const bodySpan = acrossX ? house.width : house.depth

  c.fill(ux(0), yOf(wallHeight), ux(T), ground)
  c.fill(ux(bodySpan - T), yOf(wallHeight), ux(bodySpan), ground)
  c.line(ux(0), yOf(wallHeight), ux(bodySpan / 2), yOf(wallHeight + rise), 2)
  c.line(ux(bodySpan / 2), yOf(wallHeight + rise), ux(bodySpan), yOf(wallHeight), 2)
  if (acrossX) {
    for (const wing of house.wings ?? []) {
      const { wall, rise: wingRise } = wingHeights(house, wing)
      const u0 = house.width
      const u1 = house.width + wing.width
      c.fill(ux(u1 - T), yOf(wall), ux(u1), ground)
      if (wing.roof === 'FLAT') c.fill(ux(u0), yOf(wall), ux(u1), yOf(wall - 0.25))
      else {
        c.line(ux(u0), yOf(wall), ux((u0 + u1) / 2), yOf(wall + wingRise), 2)
        c.line(ux((u0 + u1) / 2), yOf(wall + wingRise), ux(u1), yOf(wall), 2)
      }
    }
  }
  // The angle against the slope, written where the slope starts: just outside
  // the eaves corner, at the dimension text's own size. The numeric reader is
  // matched to that size, and an angle is attached to the rake it names by
  // its distance from the rake's END, so a marker set larger than the chains
  // is misread and one written well up the slope is read and then unattached.
  if (options.printedPitchDeg !== undefined) {
    const text = `${Math.round(options.printedPitchDeg)}\u00b0`
    const size = o.capHeight
    c.text(text, ux(0) - c.textWidth(text, size) - 6, yOf(wallHeight) - size - 5, size)
  }
  const leader = o.margin * 1.6
  for (const level of levelsOf(house)) {
    const y = yOf(level.value)
    const width = level.label === 'ridge' ? bodySpan * ppm * 0.45 : span * ppm
    c.line(x0 - leader, y, x0 + width, y, 1)
    const text = level.value === 0 ? '±0,00' : `+${level.value.toFixed(2).replace('.', ',')}`
    c.text(text, x0 - leader + 6, y - Math.round(o.capHeight * 1.35) - 8, Math.round(o.capHeight * 1.35))
  }
  if (o.speckle > 0) c.speckle(o.speckle, 37)
  return c
}
