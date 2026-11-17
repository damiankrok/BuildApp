/**
 * v3.54.8 — the characteristic features of compiled models, by the scene ruler (`measureScene` → `sides`, `openings`),
 * for the comparison with a source truth (`marcowki-features.py`, `marcowki-detail.py`). v3.54.8 adds the front portal
 * profile (soffit and top of the band at 2.70 m, every 0.25 m along the front) and the frame/railing properties of `sides`. Reads models only; writes one JSON.
 *
 *   npx vite-node research/source-to-model/v3548/measure-features.ts -- <out.json> <label>=<model.json | house.json> …
 *
 * A `house.json` (a house document) is compiled again from its observations, so that the model BEFORE the review
 * (`house-first.json`) is measured by the same builder as the one after it. Nothing is written into the run folders.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { compileHouse } from '../../../packages/analysis-service/src/house/describe.js'
import { measureScene, portalProfile } from '../../../packages/analysis-service/src/house/measure.js'
import type { SceneMeasure } from '../../../packages/analysis-service/src/house/measure.js'

const [out, ...specs] = process.argv.slice(2).filter((a) => a !== '--')
const result: Record<string, unknown> = {}
for (const spec of specs) {
  const at = spec.indexOf('=')
  const label = spec.slice(0, at)
  const path = spec.slice(at + 1)
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  let m: SceneMeasure | undefined
  let bundle: ReturnType<typeof buildMobileSceneBundle> | undefined
  let modelHash: string | null = null
  let note = ''
  if (raw.schema === 'buildapp.house-document') {
    const doc = { ...raw }
    delete doc.geometry
    delete doc.verification
    const c = compileHouse(doc, `measure-${label}`)
    m = c.measured
    bundle = c.bundle
    modelHash = c.modelHash ?? null
    note = `compiled from the observations of ${path.split('/').slice(-3).join('/')}`
  } else {
    const model = parseModel(readFileSync(path, 'utf8'))
    bundle = buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) })
    m = measureScene(bundle)
    note = `model ${path.split('/').slice(-3).join('/')}`
  }
  if (!m) {
    result[label] = { note, measured: null }
    continue
  }
  // what of the objects the features comparison needs: flat roofs (the portal head) and walls near the left side
  const flat = Object.entries(m.objects).filter(([id]) => /flat|attached/i.test(id) && /roof/i.test(id)).map(([id, b]) => ({ id, ...b }))
  const portal = bundle && m.exteriorWalls ? portalProfile(bundle, m.exteriorWalls, 'FRONT', 0, m.exteriorWalls.widthM, 2.7, 0.25) : []
  result[label] = { note, modelHash, walls: m.exteriorWalls, sides: m.sides, openings: m.openings, flatRoofs: flat, portal }
}
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`)
