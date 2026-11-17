/**
 * v3.54.5 — the scene measure of this revision (`measureScene`: extents, roof tops, every wall opening by side) for a
 * scene or a model that an EARLIER run saved, so that the base path, LOCAL and the new path are measured by one ruler.
 *   npx vite-node research/source-to-model/v3545/measure-scene.ts -- <run dir> [<run dir> …]
 * Reads `<dir>/scene.json` (a scene bundle) or, without one, `<dir>/model.json`; writes `<dir>/measured-v3545.json`.
 * Nothing is sent anywhere; no reference is read.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import type { MobileSceneBundle } from '@buildapp/mobile-scene'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'

for (const dir of process.argv.slice(2).filter((a) => a !== '--')) {
  const scene = join(dir, 'scene.json')
  const model = join(dir, 'model.json')
  let bundle: MobileSceneBundle | undefined
  if (existsSync(model)) {
    const m = parseModel(readFileSync(model, 'utf8'))
    bundle = buildMobileSceneBundle(m as never, { scene: compileBuilding(m as never) })
  } else if (existsSync(scene)) bundle = JSON.parse(readFileSync(scene, 'utf8')) as MobileSceneBundle
  if (!bundle) {
    process.stdout.write(`${dir}: no model\n`)
    continue
  }
  const m = measureScene(bundle)
  writeFileSync(join(dir, 'measured-v3545.json'), `${JSON.stringify(m, null, 1)}\n`)
  process.stdout.write(`${dir}: ${m.openings.length} wall openings, ${m.exteriorWalls ? `${m.exteriorWalls.widthM} × ${m.exteriorWalls.depthM} m` : 'no walls'}, roof top ${m.roofTopY}\n`)
}
