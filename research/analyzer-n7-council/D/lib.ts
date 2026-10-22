/** Council D: shared helpers — a minimal BuildingV2, emitted, and run through the production preview fitter. RESEARCH ONLY. */
import { emitBuilding } from '../../../packages/reconstruction/src/v2/emit.js'
import type { BuildingV2, MassV2 } from '../../../packages/reconstruction/src/v2/building.js'
import { fitPreviewProgram, buildCandidateModel } from '../../../packages/reconstruction/src/candidate.js'
import { applyCommands } from '../../../packages/commands/src/apply.js'
import { createEmptyModel } from '../../../packages/model/src/index.js'

export const T = 0.3

export function building(masses: MassV2[], levels = 1, extra: Partial<BuildingV2> = {}): BuildingV2 {
  return {
    label: 'council-d',
    wallThicknessM: T,
    slabThicknessM: 0.25,
    levels: Array.from({ length: levels }, (_, i) => ({ index: i, id: `lvl-${i}`, elevation: i * 2.9, height: 2.9, wallTop: i * 2.9 + 2.65, featureId: `f-lvl-${i}` })),
    masses,
    attachedRoofs: [],
    pitchedAttachedRoofs: [],
    recesses: [],
    returns: [],
    balconies: [],
    railings: [],
    portalHeads: [],
    verges: [],
    terraces: [],
    massTones: [],
    returnTones: [],
    facadeGraph: { nodes: [], edges: [] },
    chimneys: [],
    rooflights: [],
    openings: [],
    sharedDoors: [],
    interior: [],
    assemblies: [],
    surfaceRegions: [],
    ...extra,
  }
}

export const mass = (id: string, role: 'MAIN' | 'ATTACHED', x0: number, z0: number, x1: number, z1: number, storeys = [0], more: Partial<MassV2> = {}): MassV2 => ({ id, role, x0, z0, x1, z1, storeys, featureId: `f-${id}`, sourceMassId: `src-${id}`, ...more })

export function run(b: BuildingV2, toleranceM = 0.06) {
  const emitted = emitBuilding(b, 'council-d')
  const plain = applyCommands(createEmptyModel('m', 'council-d'), emitted.program)
  const preview = fitPreviewProgram(emitted.program, { label: 'council-d', modelId: 'm', mainMassId: b.masses.find((m) => m.role === 'MAIN')?.id ?? 'main', toleranceM })
  const model = preview.fit.ok ? buildCandidateModel(preview.fit.program, 'council-d', 'm') : undefined
  return {
    emitted,
    plainFailedAt: plain.failedAt,
    plainFailedId: plain.failedAt !== undefined ? (emitted.program[plain.failedAt] as { id?: string }).id : undefined,
    plainErrors: plain.failedAt !== undefined ? (plain.results[plain.failedAt] as unknown as { errors: Array<{ code: string; message: string }> }).errors : undefined,
    preview,
    model,
  }
}

let failures = 0
export function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
  if (!cond) failures += 1
}
export const done = (): void => {
  console.log(failures === 0 ? '\nall assertions hold' : `\n${failures} assertion(s) did not hold`)
}
