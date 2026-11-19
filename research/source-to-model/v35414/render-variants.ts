/**
 * v3.54.14 — pictures of each variant's model for the boards: the four sides (orthographic, one scale, one ground
 * line: tiles FRONT, RIGHT=EAST, REAR, LEFT=WEST), the view from above with four axonometrics, and each storey cut
 * without its roof (the floor plan as built).
 *   npx vite-node research/source-to-model/v35414/render-variants.ts -- <out dir> label=model.json …
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { renderModelViews, renderStoreyCut } from '../../../packages/analysis-service/src/consult/model-views.js'

const [out, ...specs] = process.argv.slice(2).filter((a) => a !== '--')
mkdirSync(out, { recursive: true })
for (const spec of specs) {
  const at = spec.indexOf('=')
  const label = spec.slice(0, at)
  const model = parseModel(readFileSync(spec.slice(at + 1), 'utf8'))
  const bundle = buildMobileSceneBundle(model, { scene: compileBuilding(model) })
  for (const v of renderModelViews(bundle, 360)) writeFileSync(join(out, `${v.name}-${label}.png`), v.png)
  for (const l of model.levels) writeFileSync(join(out, `CUT-${l.id}-${label}.png`), renderStoreyCut(bundle, l.id, l.elevation, 1.2, 520).png)
  process.stdout.write(`${label}: ${model.levels.length} storey cut(s)\n`)
}
