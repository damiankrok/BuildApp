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
import { createEmptyModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import type { HouseDocument } from './document.js'
import { HOUSE_BUILDER_LABEL, houseProgram } from './program.js'
import type { HouseProgram } from './program.js'

export type KernelRefusal = { id: string | null; type: string; codes: string[]; message: string; dropped: string[] }
export type BuiltHouse = HouseProgram & { model: CanonicalBuildingModel; fitted: BuildingCommand[]; kernelRefusals: KernelRefusal[]; complete: boolean }

const MAX_CUTS = 60
const DEPENDS = ['openingId', 'hostId', 'roofOpeningId', 'hostPlaneId', 'wallId', 'roofId'] as const

export function buildHouse(doc: HouseDocument, modelId: string): BuiltHouse {
  const made = houseProgram(doc)
  let current = made.program
  const kernelRefusals: KernelRefusal[] = []
  let model = createEmptyModel(modelId, HOUSE_BUILDER_LABEL)
  let complete = false
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
    kernelRefusals.push({ id, type: failed.type, codes: failure.errors.map((e) => e.code), message: failure.errors.map((e) => e.message).join('; ').slice(0, 400), dropped })
    model = r.model
    current = next
  }
  return { ...made, model, fitted: current, kernelRefusals, complete }
}
