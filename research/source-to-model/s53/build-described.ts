/**
 * v3.53 S53 research: a house description (JSON) through the builder, emitter, validator and compiler, with the
 * all-sides sheet. CLI: build-described-cli.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { checkHouseDescription } from '@buildapp/source-vision'
import type { PublishedFigure } from '@buildapp/source-vision'
import { reconstructFromHouseDescription } from '@buildapp/reconstruction'
import { renderSceneSheet } from '../../../packages/mobile-scene/scripts/scene-sheet.js'

export function buildDescribed(raw: unknown, outDir: string, modelId: string, published: PublishedFigure[] = []): { ok: boolean; summary: Record<string, unknown> } {
  mkdirSync(outDir, { recursive: true })
  const checked = checkHouseDescription(raw, published)
  writeFileSync(join(outDir, 'description-check.json'), JSON.stringify(checked.issues, null, 1))
  if (!checked.ok) return { ok: false, summary: { stage: 'CHECK', issues: checked.issues } }
  const t0 = Date.now()
  const built = reconstructFromHouseDescription(checked.description, modelId)
  if (!built.ok) {
    writeFileSync(join(outDir, 'build-failure.json'), JSON.stringify(built, null, 1))
    return { ok: false, summary: { stage: 'BUILD', reason: built.reason, adjustments: built.adjustments } }
  }
  writeFileSync(join(outDir, 'model.json'), built.modelJson)
  writeFileSync(join(outDir, 'program.json'), JSON.stringify(built.program))
  writeFileSync(join(outDir, 'building-v2.json'), JSON.stringify(built.building, null, 1))
  const model = parseModel(built.modelJson)
  const scene = compileBuilding(model as never)
  const errors = scene.diagnostics.filter((x) => x.severity === 'ERROR')
  writeFileSync(join(outDir, 'compile-diagnostics.json'), JSON.stringify(scene.diagnostics, null, 1))
  writeFileSync(join(outDir, 'scene-all-sides.png'), PNG.sync.write(renderSceneSheet(buildMobileSceneBundle(model as never, { scene }), 360, 'ALL')))
  const summary = { stage: 'DONE', buildMs: Date.now() - t0, issues: checked.issues, adjustments: built.adjustments, emitterNotes: built.emitterNotes, refused: built.refused, fits: built.fits.filter((f) => f.action !== 'KEPT'), meshes: scene.meshes.length, compileErrors: errors.map((e) => `${e.code}: ${e.message}`.slice(0, 200)), counts: { bodies: built.building.masses.length, openings: built.building.openings.length, dormers: built.building.dormers?.length ?? 0, chimneys: built.building.chimneys.length, balconies: built.building.balconies.length, canopies: built.building.canopies?.length ?? 0 } }
  writeFileSync(join(outDir, 'build-summary.json'), JSON.stringify(summary, null, 1))
  return { ok: true, summary }
}
