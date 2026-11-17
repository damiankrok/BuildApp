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
    const dropped: string[] = []
    const next: BuildingCommand[] = []
    current.forEach((c, i) => {
      const o = c as unknown as Record<string, unknown> & { id?: string; type: string }
      if (i === r.failedAt) return
      if (id && DEPENDS.some((k) => o[k] === id)) return void dropped.push(o.id ?? o.type)
      if (id) {
        // a wall that died into the refused plane dies into the others
        const strip = (w: { topProfile?: { kind: string; planeIds?: string[] } }): void => {
          if (w.topProfile?.kind === 'FOLLOW_ROOF_PLANES' && w.topProfile.planeIds?.includes(id)) {
            const rest = w.topProfile.planeIds.filter((p) => p !== id)
            if (rest.length > 0) w.topProfile = { ...w.topProfile, planeIds: rest }
            else delete w.topProfile
          }
        }
        const copy = JSON.parse(JSON.stringify(o)) as typeof o & { walls?: Array<{ topProfile?: { kind: string; planeIds?: string[] } }> }
        strip(copy as never)
        for (const w of copy.walls ?? []) strip(w)
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
