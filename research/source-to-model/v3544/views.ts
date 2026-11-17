/**
 * v3.54.4 — the neutral views of any kernel model (LOCAL's or a described house's), with the frame a ruler needs.
 *   npx vite-node research/source-to-model/v3544/views.ts -- --model <model.json> --out <dir> [--prefix views]
 * Writes <prefix>-SIDES.png, <prefix>-AROUND.png and <prefix>-frame.json (pixels per metre, the row of ±0,00).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const out = arg('out') as string
const prefix = arg('prefix') ?? 'views'
mkdirSync(out, { recursive: true })
const model = parseModel(readFileSync(arg('model') as string, 'utf8'))
const bundle = buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) })
const m = measureScene(bundle)
for (const v of renderModelViews(bundle, 520)) {
  writeFileSync(join(out, `${prefix}-${v.name}.png`), v.png)
  if (v.frame) writeFileSync(join(out, `${prefix}-frame.json`), `${JSON.stringify({ ...v.frame, widthM: m.exteriorWalls?.widthM ?? null, depthM: m.exteriorWalls?.depthM ?? null, roofTopM: m.roofTopY, topM: m.buildingTopY }, null, 1)}\n`)
}
process.stdout.write(`${arg('model')}: ${m.exteriorWalls ? `${m.exteriorWalls.widthM.toFixed(2)} x ${m.exteriorWalls.depthM.toFixed(2)} m, roof top ${m.roofTopY?.toFixed(2)}` : 'no exterior walls'}\n`)
