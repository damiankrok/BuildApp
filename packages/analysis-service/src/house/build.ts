/**
 * v3.54.4 — a house document's program, run by the kernel, with what the kernel refuses taken out by name.
 *
 * The model is built by running the program (`applyCommands`) — the only way anything here becomes geometry. When the
 * kernel refuses a command, that object and the objects that hang on it (an opening's window, a balcony's railing) are
 * left out and the rest is built again; a refused roof plane is taken out of the wall tops that named it. Every refusal
 * is returned with the kernel's own codes: a refused object is a named gap of the result, never a silent one.
 */
import { applyCommands } from '@buildapp/commands'
import type { BuildingCommand } from '@buildapp/commands'
import { createEmptyModel, physicalCore, resolveWallTopology } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { HOUSE_BUILDER_LABEL, OPENING_FIT, fitOpening, houseProgram } from '@buildapp/reconstruction'
import type { HouseDocument, HouseProgram } from '@buildapp/reconstruction'

export type KernelRefusal = { id: string | null; type: string; codes: string[]; message: string; dropped: string[] }
export type BuiltHouse = HouseProgram & { model: CanonicalBuildingModel; fitted: BuildingCommand[]; kernelRefusals: KernelRefusal[]; complete: boolean }

const MAX_CUTS = 60
const DEPENDS = ['openingId', 'hostId', 'roofOpeningId', 'hostPlaneId', 'wallId', 'roofId'] as const

/**
 * v3.54.6 — a head the compiled scene could not hold under its wall's top (a gable glazing read as one box up to the
 * apex) lowered to that top: the kernel's own measure of the lowest top over the opening's width, less a clearance.
 * Only as far as the opening rule allows a bounded change (`approxM`, `approxShare` of the height); drawn as an
 * APPROXIMATED opening and said. Beyond that the opening stays out and the reason is given.
 */
export type HeadCap = { heightM: number; why: string }
export const HEAD_CLEARANCE_M = 0.05

export function headCapFor(cmd: { sill: number; height: number; head?: { kind: string } }, kernelMessage: string): { ok: true; cap: HeadCap } | { ok: false; why: string } | undefined {
  // v3.54.7: a head that is not level is the shape the elevation drew; lowering it to a level line would undo it
  if (cmd.head && cmd.head.kind !== 'LEVEL') return undefined
  const m = /whose top is only (-?[0-9.]+) m there/.exec(kernelMessage)
  if (!m) return undefined
  const top = Number(m[1])
  const height = Math.round((top - HEAD_CLEARANCE_M - cmd.sill) * 1e6) / 1e6
  const lower = cmd.height - height
  const bound = Math.min(OPENING_FIT.approxM, OPENING_FIT.approxShare * cmd.height)
  if (height <= 0.3 || lower > bound + 1e-9) return { ok: false, why: `its head would have to come ${lower.toFixed(2)} m lower to stand under the wall's top (${top.toFixed(3)} m over its width): more than the ${bound.toFixed(2)} m an opening may be approximated by — what was read reaches above the wall it is on (a roof, a gable or a dormer read as glazing, or a gable not built)` }
  return { ok: true, cap: { heightM: height, why: `read ${cmd.height.toFixed(2)} m high up to ${(cmd.sill + cmd.height).toFixed(2)} m, above the top of its wall over its width (${top.toFixed(3)} m at its lowest — a glazing whose head follows a gable, read as one box to the apex); drawn ${lower.toFixed(2)} m lower with a level head ${HEAD_CLEARANCE_M} m under that top — its shape under the gable is not drawn` } }
}

export function buildHouse(doc: HouseDocument, modelId: string, caps?: Map<string, HeadCap>): BuiltHouse {
  const made = houseProgram(doc)
  if (caps && caps.size > 0) {
    made.program = made.program.map((c) => {
      const o = c as unknown as { type: string; id?: string; height?: number }
      const cap = o.id ? caps.get(o.id) : undefined
      if (o.type !== 'cutOpening' || !o.id || !cap) return c
      for (const t of made.trace) if (t.path === `geometry.openings[${o.id}].heightM`) Object.assign(t, { built: cap.heightM, fit: 'APPROXIMATED', code: 'OVERRIDDEN', delta: Math.round((cap.heightM - (o.height ?? 0)) * 1e6) / 1e6, why: cap.why })
      if (!made.approximated.some((a) => a.id === o.id)) made.approximated.push({ id: o.id, what: cap.why })
      return { ...(c as unknown as Record<string, unknown>), height: cap.heightM } as unknown as BuildingCommand
    })
  }
  let current = made.program
  const kernelRefusals: KernelRefusal[] = []
  let model = createEmptyModel(modelId, HOUSE_BUILDER_LABEL)
  let complete = false
  const refitted = new Set<string>()
  const refitWhy = new Map<string, string>()
  for (let n = 0; n <= MAX_CUTS; n += 1) {
    const r = applyCommands(createEmptyModel(modelId, HOUSE_BUILDER_LABEL), current)
    if (r.failedAt === undefined) {
      model = r.model
      complete = true
      break
    }
    const failed = current[r.failedAt] as unknown as { id?: string; type: string }
    const failure = r.results[r.failedAt] as unknown as { errors: Array<{ code: string; message: string }> }
    const id = failed.id ?? null
    // a wall whose end could not be butted against its neighbour (it meets it in a corner another wall owns) stands
    // without that junction rather than not at all
    const junctionCodes = failure.errors.filter((e) => e.code === 'BUTT_OFF_HOST' || e.code === 'T_JUNCTION_POSITION')
    if (failed.type === 'createWall' && junctionCodes.length > 0) {
      const wall = JSON.parse(JSON.stringify(current[r.failedAt])) as Record<string, unknown>
      const before = Object.keys(wall).length
      for (const e of junctionCodes) delete wall[e.message.includes('-j-start') ? 'startJunction' : 'endJunction']
      if (Object.keys(wall).length < before) {
        kernelRefusals.push({ id, type: 'createWall/junction', codes: junctionCodes.map((e) => e.code), message: junctionCodes.map((e) => e.message).join('; ').slice(0, 400), dropped: [] })
        current = current.map((c, i) => (i === r.failedAt ? (wall as unknown as BuildingCommand) : c))
        continue
      }
    }
    // v3.54.5 — an opening that reaches into the junction zone of its wall is fitted once more against the stretch the
    // KERNEL leaves clear there (at a splayed corner that is not a wall thickness), under the same rule as before: a
    // change within the reading's uncertainty is an adjustment, a bounded larger one an approximation that is said,
    // anything more is not cut. Once per opening.
    const info = id ? made.fits[id] : undefined
    if (failed.type === 'cutOpening' && id && info && !refitted.has(id) && failure.errors.some((e) => e.code === 'OPENING_IN_JUNCTION_ZONE')) {
      refitted.add(id)
      const cmd = current[r.failedAt] as unknown as { wallId: string; offset: number; width: number }
      const extent = resolveWallTopology(r.model).extents.get(cmd.wallId)
      if (extent) {
        const core = physicalCore(extent)
        const fitted = fitOpening({ from: info.from - info.s0, to: info.from - info.s0 + info.width, lo: core.a0 + 0.01, hi: core.a1 - 0.01, u: info.u, printed: info.printed })
        if (fitted.ok) {
          const width = fitted.to - fitted.from
          current = current.map((c, i) => (i === r.failedAt ? ({ ...(c as unknown as Record<string, unknown>), offset: Math.round(fitted.from * 1e6) / 1e6, width: Math.round(width * 1e6) / 1e6 } as unknown as BuildingCommand) : c))
          const note = `${fitted.note ?? ''} — against the stretch the kernel leaves clear of the wall's junctions (${core.a0.toFixed(2)}..${core.a1.toFixed(2)} m)`
          for (const t of made.trace) {
            if (t.path === `geometry.openings[${id}].offsetM`) Object.assign(t, { built: Math.round((fitted.from + info.s0) * 1e6) / 1e6, fit: fitted.fit, code: 'OVERRIDDEN', delta: Math.round((fitted.from + info.s0 - info.from) * 1e6) / 1e6, why: note })
            if (t.path === `geometry.openings[${id}].widthM`) Object.assign(t, { built: Math.round(width * 1e6) / 1e6, fit: fitted.fit, ...(Math.abs(width - info.width) > 1e-6 ? { code: 'OVERRIDDEN', delta: Math.round((width - info.width) * 1e6) / 1e6, why: note } : {}) })
          }
          if (fitted.fit === 'APPROXIMATED' && !made.approximated.some((a) => a.id === id)) made.approximated.push({ id, what: note })
          continue
        }
        refitWhy.set(id, fitted.why)
      }
    }
    const dropped: string[] = []
    // what stood on the refused object goes with it, and what stood on that (an opening's window with the opening);
    // a wall that only met it at a junction stays, without the junction
    const gone = new Set<string>(id ? [id] : [])
    for (let grew = true; grew; ) {
      grew = false
      current.forEach((c, i) => {
        const o = c as unknown as Record<string, unknown> & { id?: string }
        if (i === r.failedAt || !o.id || gone.has(o.id)) return
        if (DEPENDS.some((k) => typeof o[k] === 'string' && gone.has(o[k] as string))) {
          gone.add(o.id)
          grew = true
        }
      })
    }
    const next: BuildingCommand[] = []
    current.forEach((c, i) => {
      const o = c as unknown as Record<string, unknown> & { id?: string; type: string }
      if (i === r.failedAt) return
      if (o.id && o.id !== id && gone.has(o.id)) return void dropped.push(o.id)
      if (!o.id && DEPENDS.some((k) => typeof o[k] === 'string' && gone.has(o[k] as string))) return void dropped.push(o.type)
      if (id) {
        const strip = (w: { topProfile?: { kind: string; planeIds?: string[] } }): void => {
          if (w.topProfile?.kind === 'FOLLOW_ROOF_PLANES' && w.topProfile.planeIds?.some((p) => gone.has(p))) {
            const rest = w.topProfile.planeIds.filter((p) => !gone.has(p))
            if (rest.length > 0) w.topProfile = { ...w.topProfile, planeIds: rest }
            else delete w.topProfile
          }
        }
        const copy = JSON.parse(JSON.stringify(o)) as typeof o & { walls?: Array<{ topProfile?: { kind: string; planeIds?: string[] } }>; startJunction?: { with?: { wallId?: string }; againstWallId?: string }; endJunction?: { with?: { wallId?: string }; againstWallId?: string } }
        strip(copy as never)
        for (const w of copy.walls ?? []) strip(w)
        for (const k of ['startJunction', 'endJunction'] as const) {
          const j = copy[k]
          if (j && ((j.with?.wallId && gone.has(j.with.wallId)) || (j.againstWallId && gone.has(j.againstWallId)))) delete copy[k]
        }
        return void next.push(copy as unknown as BuildingCommand)
      }
      next.push(c)
    })
    kernelRefusals.push({ id, type: failed.type, codes: failure.errors.map((e) => e.code), message: `${id && refitWhy.has(id) ? `${refitWhy.get(id)} | ` : ''}${failure.errors.map((e) => e.message).join('; ')}`.slice(0, 500), dropped })
    model = r.model
    current = next
  }
  return { ...made, model, fitted: current, kernelRefusals, complete }
}
