/**
 * v3.54.7 — each model drawn in the frame of each registered elevation (the same frame the review sends), for boards
 * ŹRÓDŁO | LOCAL | H PRZED | H PO | ODDANY. Writes one PNG per side and model; `make-board.py` composes them.
 *
 *   npx vite-node research/source-to-model/v3547/board-frames.ts -- --frames <house.json> --out <dir> <label>=<model.json | house.json> …
 *
 * The frames are the registrations of the house document given with --frames (in the elevations' own pixels); every
 * model is measured along its own exterior walls, as the scene ruler measures, so LOCAL and the described house are
 * drawn by one rule. Nothing is written into the run folders.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import type { MobileSceneBundle } from '@buildapp/mobile-scene'
import { compileHouse } from '../../../packages/analysis-service/src/house/describe.js'
import { measureScene } from '../../../packages/analysis-service/src/house/measure.js'
import { renderSideInFrame } from '../../../packages/analysis-service/src/consult/model-views.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const framesPath = opt('frames') as string
const out = opt('out') as string
const specs = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
mkdirSync(out, { recursive: true })
const frames = JSON.parse(readFileSync(framesPath, 'utf8'))
const pics = new Map<string, { widthPx: number; heightPx: number; byteHash?: string }>(frames.source.pictures.map((p: { id: string; widthPx: number; heightPx: number; byteHash?: string }) => [p.id, p]))
const index: Array<Record<string, unknown>> = []
const sceneOf = (path: string): MobileSceneBundle | undefined => {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  if (raw.schema === 'buildapp.house-document') {
    delete raw.geometry
    delete raw.verification
    return compileHouse(raw, 'board').bundle
  }
  const model = parseModel(readFileSync(path, 'utf8'))
  return buildMobileSceneBundle(model as never, { scene: compileBuilding(model as never) })
}
const scenes = specs.map((s) => ({ label: s.slice(0, s.indexOf('=')), bundle: sceneOf(s.slice(s.indexOf('=') + 1)) }))
for (const view of frames.verification.views as Array<{ side: string; elevation?: string; registered?: boolean; transform?: { mPerPx: number; alongAtPx0: number; groundRowPx: number; zeroRowPx?: number } }>) {
  if (!view.elevation || !view.registered || !view.transform) continue
  const el = frames.observations.elevations.find((e: { id: string }) => e.id === view.elevation)
  const pic = pics.get(el.picture)
  if (!pic) continue
  const tf = view.transform
  for (const s of scenes) {
    if (!s.bundle) continue
    const walls = measureScene(s.bundle).exteriorWalls
    if (!walls) continue
    const r = renderSideInFrame(s.bundle, view.side as 'FRONT', walls, { width: pic.widthPx, height: pic.heightPx, mPerPx: tf.mPerPx, alongAtPx0: tf.alongAtPx0, zeroRowPx: tf.zeroRowPx ?? tf.groundRowPx })
    const file = `${view.side}-${s.label}.png`
    writeFileSync(join(out, file), r.png)
    index.push({ side: view.side, elevation: view.elevation, picture: el.picture, sourceByteHash: pic.byteHash ?? null, label: s.label, file, renderSha256: r.sha256, frame: { mPerPx: tf.mPerPx, alongAtPx0: tf.alongAtPx0, zeroRowPx: tf.zeroRowPx ?? tf.groundRowPx } })
  }
}
writeFileSync(join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`)
