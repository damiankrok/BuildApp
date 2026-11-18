/**
 * v3.54.11 — the scene bundle of a saved model (a LOCAL run saves the model, not the scene), for `zone-refs.py`.
 *   npx vite-node research/source-to-model/v35411/model-scene.ts -- <model.json> <out scene.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'

const [inp, out] = process.argv.slice(2).filter((a) => a !== '--')
const model = parseModel(readFileSync(inp, 'utf8'))
const bundle = buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) })
writeFileSync(out, `${JSON.stringify(bundle)}\n`)
