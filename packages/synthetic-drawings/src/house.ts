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
  /** How the plan divides each axis into printed dimensions, in metres. Must sum to the footprint. */
  chainsX: number[]
  chainsZ: number[]
}

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

/** The ground plan: walls, openings and the dimension chains that measure them. */
export function renderGroundPlan(house: SyntheticHouse, options: SheetOptions = {}): Canvas {
  const o = { ...DEFAULTS, ...options }
  const ppm = o.pixelsPerMetre
  const w = house.width * ppm
  const d = house.depth * ppm
  const c = new Canvas(Math.round(w + o.margin * 2), Math.round(d + o.margin * 2))
  const x0 = o.margin
  const y0 = o.margin
  const t = house.wallThickness * ppm

  // Walls, drawn as a solid ring the way a plan hatches them.
  c.fill(x0, y0, x0 + w, y0 + t)
  c.fill(x0, y0 + d - t, x0 + w, y0 + d)
  c.fill(x0, y0, x0 + t, y0 + d)
  c.fill(x0 + w - t, y0, x0 + w, y0 + d)

  // Openings: a gap in the wall with its reveal lines, as a plan draws them.
  for (const opening of house.openings) {
    if (opening.storey !== 0) continue
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

  // The chains: an overall dimension above the parts, on each axis.
  chain(c, { axis: 'HORIZONTAL', at: y0 - 74, start: x0, parts: [house.width], ppm, capHeight: o.capHeight, slant: o.slant })
  chain(c, { axis: 'HORIZONTAL', at: y0 - 34, start: x0, parts: house.chainsX, ppm, capHeight: o.capHeight, slant: o.slant })
  chain(c, { axis: 'VERTICAL', at: x0 - 74, start: y0, parts: [house.depth], ppm, capHeight: o.capHeight, slant: o.slant })
  chain(c, { axis: 'VERTICAL', at: x0 - 34, start: y0, parts: house.chainsZ, ppm, capHeight: o.capHeight, slant: o.slant })
  if (o.speckle > 0) c.speckle(o.speckle, 11)
  return c
}

/** Which wall an elevation shows, and how long it is. */
export const elevationSpan = (house: SyntheticHouse, side: Side): number => (side === 'FRONT' || side === 'REAR' ? house.width : house.depth)

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

  // The wall block.
  c.rect(x0, yOf(wallHeight), x0 + span * ppm, ground, 2)
  // The roof: a gable when the ridge runs across this view, a rake when along it.
  const gable = (house.roof.ridgeAxis === 'X') === (side === 'LEFT' || side === 'RIGHT')
  const overhang = house.roof.overhang * ppm
  if (gable) {
    c.line(x0 - overhang, yOf(wallHeight), x0 + (span * ppm) / 2, yOf(wallHeight + rise), 2)
    c.line(x0 + (span * ppm) / 2, yOf(wallHeight + rise), x0 + span * ppm + overhang, yOf(wallHeight), 2)
  } else {
    c.line(x0 - overhang, yOf(wallHeight + rise), x0 + span * ppm + overhang, yOf(wallHeight + rise), 2)
    c.line(x0 - overhang, yOf(wallHeight), x0 - overhang, yOf(wallHeight + rise), 1)
    c.line(x0 + span * ppm + overhang, yOf(wallHeight), x0 + span * ppm + overhang, yOf(wallHeight + rise), 1)
  }

  const floorOf = (storey: number): number => house.storeys.slice(0, storey).reduce((a, s) => a + s.height, 0)
  for (const opening of house.openings) {
    if (opening.side !== side) continue
    const left = x0 + opening.at * ppm
    const bottom = yOf(floorOf(opening.storey) + opening.sill)
    const top = yOf(floorOf(opening.storey) + opening.sill + opening.height)
    c.rect(left, top, left + opening.width * ppm, bottom, 2)
  }
  // A member proud of the wall reads as a filled band: darker than the wall,
  // because that is what a shadowed solid looks like on a technical elevation.
  for (const member of house.members) {
    if (member.side !== side) continue
    const left = x0 + member.at * ppm
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
