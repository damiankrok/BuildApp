/**
 * v3.54.8 — one oblique view of each model (the view from above and four around it, as the review sends it), for the
 * recess, the frame's depth and the slab under the leg, which a flat side view cannot show.
 *   npx vite-node research/source-to-model/v3548/board-oblique.ts -- <out dir> <label>=<model.json | house.json> …
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { compileHouse } from '../../../packages/analysis-service/src/house/describe.js'
import { renderModelViews } from '../../../packages/analysis-service/src/consult/model-views.js'

const [out, ...specs] = process.argv.slice(2).filter((a) => a !== '--')
mkdirSync(out, { recursive: true })
for (const spec of specs) {
  const at = spec.indexOf('=')
  const label = spec.slice(0, at)
  const raw = JSON.parse(readFileSync(spec.slice(at + 1), 'utf8')) as Record<string, unknown>
  let bundle
  if (raw.schema === 'buildapp.house-document') {
    const doc = { ...raw }
    delete doc.geometry
    delete doc.verification
    bundle = compileHouse(doc, `oblique-${label}`).bundle
  } else {
    const model = parseModel(readFileSync(spec.slice(at + 1), 'utf8'))
    bundle = buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) })
  }
  if (!bundle) continue
  for (const v of renderModelViews(bundle, 520)) if (v.name === 'AROUND') writeFileSync(join(out, `AROUND-${label}.png`), v.png)
}
