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
}

export type SyntheticHouse = {
  name: string
  /** The footprint, in metres. `width` runs west-east (x), `depth` north-south (z). */
  width: number
  depth: number
  wallThickness: number
  /** Storey heights, ground up. */
  storeys: Array<{ name: string; height: number }>
  roof: { pitchDeg: number; overhang: number; ridgeAxis: 'X' | 'Z' }
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
}

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
}

const DEFAULTS: Required<SheetOptions> = { pixelsPerMetre: 38, capHeight: 16, slant: 0.18, speckle: 0, margin: 120 }

const cm = (metres: number): string => String(Math.round(metres * 100))

/** A chain of printed dimensions along the top or the left of the plan. */
function chain(c: Canvas, options: { axis: 'HORIZONTAL' | 'VERTICAL'; at: number; start: number; parts: number[]; ppm: number; capHeight: number; slant: number }): void {
  const { axis, at, ppm, capHeight, slant } = options
  let position = options.start
  const place = (p: number) => (axis === 'HORIZONTAL' ? c.tick(p, at, 'HORIZONTAL') : c.tick(at, p, 'VERTICAL'))
  place(position)
  for (const part of options.parts) {
    const span = part * ppm
    const text = cm(part)
    const width = c.textWidth(text, capHeight)
    if (axis === 'HORIZONTAL') {
      c.line(position, at, position + span, at, 1)
      c.text(text, position + span / 2 - width / 2, at - capHeight - 6, capHeight, { slant })
    } else {
      c.line(at, position, at, position + span, 1)
      c.text(text, at - capHeight - 6, position + span / 2 + width / 2, capHeight, { rotate: 'CW' })
    }
    position += span
    place(position)
  }
}

/** The plan of one storey: walls, openings and the dimension chains that measure them. */
export function renderGroundPlan(house: SyntheticHouse, options: SheetOptions & { storey?: number } = {}): Canvas {
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
      c.fill(x0 + along, side0, x0 + along + t, side1)
      c.fill(x0 + along + width - t, side0, x0 + along + width, side1)
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
      c.line(x0 + along, y, x0 + along, y + t, 1)
      c.line(x0 + along + width, y, x0 + along + width, y + t, 1)
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
      c.line(x, y0 + along, x + t, y0 + along, 1)
      c.line(x, y0 + along + width, x + t, y0 + along + width, 1)
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
  chain(c, { axis: 'HORIZONTAL', at: originY - 74, start: chainX0, parts: [spanX], ppm, capHeight: o.capHeight, slant: o.slant })
  chain(c, { axis: 'HORIZONTAL', at: originY - 34, start: chainX0, parts: partsX, ppm, capHeight: o.capHeight, slant: o.slant })
  chain(c, { axis: 'VERTICAL', at: originX - 74, start: chainZ0, parts: [spanZ], ppm, capHeight: o.capHeight, slant: o.slant })
  chain(c, { axis: 'VERTICAL', at: originX - 34, start: chainZ0, parts: partsZ, ppm, capHeight: o.capHeight, slant: o.slant })
  if (o.speckle > 0) c.speckle(o.speckle, 11)
  return c
}

/** Which wall an elevation shows, and how long it is. Front and rear see the wings too. */
export const elevationSpan = (house: SyntheticHouse, side: Side): number => (side === 'FRONT' || side === 'REAR' ? overallWidth(house) : house.depth)

/** How tall a wing's walls stand, and how far its own ridge rises above them. */
export function wingHeights(house: SyntheticHouse, wing: SyntheticWing): { wall: number; rise: number } {
  const wall = house.storeys.slice(0, wing.storeys).reduce((a, s) => a + s.height, 0)
  const rise = wing.roof === 'FLAT' ? 0 : Number(((wing.width / 2) * Math.tan((house.roof.pitchDeg * Math.PI) / 180)).toFixed(4))
  return { wall, rise }
}

/** An orthographic elevation: silhouette, roof, openings and the members that stand proud. */
export function renderElevation(house: SyntheticHouse, side: Side, options: SheetOptions = {}): Canvas {
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
