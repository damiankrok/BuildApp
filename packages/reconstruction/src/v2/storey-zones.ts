/**
 * v3.53.6: the zones of a storey.
 *
 * The roof cuts a storey into bodies; the plan draws its rooms on the storey. Bodies the plan draws no wall between
 * (an OPEN contact, `party-wall.ts`), or only a wall with a stretch left out (a passage), are one zone: read once
 * (`readInterior`, `domain`), on the floor inside all their walls and the strips between their inner faces where no
 * wall stands, so a partition, a door or a room that crosses the line between two bodies is read whole — and the cut
 * the roof was computed on changes neither the number of rooms nor their outlines. A body with a wall on every side it
 * shares is a zone of its own, read inside its walls as before.
 *
 * A function of the bodies' rectangles and the shared walls already decided: no pixels, no rooms.
 */
import { round6 } from '@buildapp/source-common'
import type { MassV2 } from './building.js'
import { OPPOSITE_SIDE, partyFarFace, partyNearFace } from './party-wall.js'
import type { PartyWallV2 } from './party-wall.js'

export type FloorRect = { x0: number; z0: number; x1: number; z1: number }
export type FloorStrip = FloorRect & { strip: true }

/** The floor inside one body's walls on a storey (`floorOfBody`). */
export type BodyFloor = {
  /** Inside its own walls; a side with one shared wall along all of it stands on that wall's face. */
  base: FloorRect
  /** Where a wall shared along part of a side has its face beyond the body's own inner face: floor to that face. */
  more: FloorStrip[]
  /** Where such a wall's face lies inside the body's own inner face: no floor. */
  shut: FloorRect[]
}

export type StoreyZone = {
  /** The bodies read together, in the order given. */
  members: MassV2[]
  /** The body the zone's reading is named after and kept with: the main body when it is one of them. */
  first: MassV2
  /**
   * The floor to read on, when it is more than one body's rectangle inside its walls: the bodies' floors, the stretches
   * of shared walls' faces and the strips between two bodies where no wall stands. Absent for a body read as before.
   */
  domain?: Array<FloorRect & { strip?: boolean }>
  /** Rectangles inside the bodies' own floors that a shared wall stands on: barred from every room. */
  shut: FloorRect[]
}

/**
 * The floor inside one body's walls. Its rectangle inside its own walls; where it shares one wall with the body beside
 * it (N8-02B), the floor runs to that wall's face — over the stretch the wall stands on, and no further: a wall shared
 * along part of a side moves the floor's edge along that part only (it used to move the whole side, and the rooms
 * behind the rest of it ran on under the body's own wall there). A shared wall along a whole side moves the side.
 */
export function floorOfBody(m: MassV2, rect: FloorRect, wallM: number, shared: readonly PartyWallV2[]): BodyFloor {
  const base = { x0: round6(rect.x0 + wallM), z0: round6(rect.z0 + wallM), x1: round6(rect.x1 - wallM), z1: round6(rect.z1 - wallM) }
  const more: FloorStrip[] = []
  const shut: FloorRect[] = []
  for (const p of shared) {
    if (p.open) continue
    const side = p.hostMassId === m.id ? p.hostFacade : p.otherMassId === m.id ? OPPOSITE_SIDE[p.hostFacade] : undefined
    if (!side) continue
    const face = p.hostMassId === m.id ? partyNearFace(p) : partyFarFace(p)
    const alongX = side === 'FRONT' || side === 'REAR'
    const [lo, hi] = alongX ? [base.x0, base.x1] : [base.z0, base.z1]
    const key = side === 'EAST' ? 'x1' : side === 'WEST' ? 'x0' : side === 'REAR' ? 'z1' : 'z0'
    if (p.span[0] <= lo + 0.05 && p.span[1] >= hi - 0.05) {
      base[key] = round6(face)
      continue
    }
    const from = round6(Math.max(p.span[0], lo))
    const to = round6(Math.min(p.span[1], hi))
    if (to - from <= 0) continue
    const at = base[key]
    const outward = side === 'EAST' || side === 'REAR' ? face - at : at - face
    if (Math.abs(outward) <= 1e-6) continue
    const [a0, a1] = [Math.min(at, face), Math.max(at, face)]
    const strip = alongX ? { x0: from, z0: round6(a0), x1: to, z1: round6(a1) } : { x0: round6(a0), z0: from, x1: round6(a1), z1: to }
    if (outward > 0) more.push({ ...strip, strip: true })
    else shut.push(strip)
  }
  return { base, more, shut }
}

export type StoreyZonesInput = {
  /** The bodies standing on the storey. */
  masses: readonly MassV2[]
  storeyIndex: number
  /** Every shared wall and open contact decided for the storey. */
  partyWalls: readonly PartyWallV2[]
  /** A body's rectangle on the storey, and its outer wall's thickness. */
  rectOf: (m: MassV2) => FloorRect
  wallOf: (m: MassV2) => number
  /** The stretches of a shared wall the plan leaves undrawn with no door in them (passages), along the wall. */
  passagesOf: (p: PartyWallV2) => ReadonlyArray<readonly [number, number]>
  /** The least stretch, metres, two bodies must be open to each other over to be one zone. */
  minJoinM: number
}

/** The zones of a storey, in the order of their first bodies, and what joined them. */
export function storeyZones(input: StoreyZonesInput): { zones: StoreyZone[]; links: string[]; floorOf: (m: MassV2) => BodyFloor } {
  const here = input.masses.filter((m) => m.storeys.includes(input.storeyIndex))
  const shared = input.partyWalls.filter((p) => p.storeyIndex === input.storeyIndex)
  const floors = new Map(here.map((m) => [m.id, floorOfBody(m, input.rectOf(m), input.wallOf(m), shared)]))
  const floorOf = (m: MassV2): BodyFloor => floors.get(m.id) ?? floorOfBody(m, input.rectOf(m), input.wallOf(m), shared)
  const parent = new Map(here.map((m) => [m.id, m.id]))
  const rootOf = (id: string): string => {
    let r = id
    while (parent.get(r) !== r) r = parent.get(r) as string
    return r
  }
  const strips = new Map<string, FloorStrip[]>()
  const links: string[] = []
  for (const p of shared) {
    const host = here.find((m) => m.id === p.hostMassId)
    const other = here.find((m) => m.id === p.otherMassId)
    if (!host || !other) continue
    const stretches: ReadonlyArray<readonly [number, number]> = p.open ? [[p.span[0], p.span[1]]] : input.passagesOf(p)
    if (stretches.length === 0) continue
    const a = floorOf(host).base
    const b = floorOf(other).base
    const alongX = p.hostFacade === 'FRONT' || p.hostFacade === 'REAR'
    const [lo, hi] = alongX ? [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)] : [Math.max(a.z0, b.z0), Math.min(a.z1, b.z1)]
    const across: [number, number] = p.hostFacade === 'REAR' ? [a.z1, b.z0] : p.hostFacade === 'FRONT' ? [b.z1, a.z0] : p.hostFacade === 'EAST' ? [a.x1, b.x0] : [b.x1, a.x0]
    const made: string[] = []
    for (const [u, v] of stretches) {
      const from = round6(Math.max(u, lo))
      const to = round6(Math.min(v, hi))
      if (to - from < input.minJoinM) continue
      made.push(`${from.toFixed(2)}..${to.toFixed(2)}`)
      if (across[1] - across[0] <= 1e-6) continue
      const rect: FloorStrip = alongX ? { x0: from, z0: across[0], x1: to, z1: across[1], strip: true } : { x0: across[0], z0: from, x1: across[1], z1: to, strip: true }
      strips.set(p.id, [...(strips.get(p.id) ?? []), rect])
    }
    if (made.length === 0) continue
    parent.set(rootOf(other.id), rootOf(host.id))
    links.push(`${host.id} + ${other.id} over ${made.join(', ')} (${p.open ? 'no wall drawn' : 'a wall with a stretch left out'})`)
  }
  const groups = new Map<string, MassV2[]>()
  for (const m of here) groups.set(rootOf(m.id), [...(groups.get(rootOf(m.id)) ?? []), m])
  const zones: StoreyZone[] = [...groups.values()].map((members) => {
    const own = members.map(floorOf)
    const joined = members.length > 1 || own.some((f) => f.more.length > 0 || f.shut.length > 0)
    const between = shared.filter((p) => members.some((x) => x.id === p.hostMassId) && members.some((x) => x.id === p.otherMassId)).flatMap((p) => strips.get(p.id) ?? [])
    return {
      members,
      first: members.find((x) => x.role === 'MAIN') ?? members[0],
      ...(joined ? { domain: [...own.map((f) => f.base), ...own.flatMap((f) => f.more), ...between] } : {}),
      shut: own.flatMap((f) => f.shut),
    }
  })
  return { zones, links, floorOf }
}
