/**
 * v3.54.18 — real renders of a model file, 0 USD, for the before/after boards: the analyzer's own neutral renderer
 * (`model-views.ts`, profile neutral-flat/1 — the same camera set, palette and lighting for every model), at a tile size
 * that lets windows be judged. Writes <name>-SIDES.png (FRONT | RIGHT | REAR | LEFT, orthographic, one scale, one ground
 * line), <name>-AROUND.png (TOP and four axonometrics) and <name>-STOREY-<index>.png (each storey from above with nothing
 * over it: the plan without the roof). Private output directory; nothing here goes into Git.
 *   npx vite-node research/source-to-model/v35418/render.ts -- --model <model.json> --out <dir> --name <prefix> [--tile 900]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import { parseModel } from '@buildapp/model'
import { MODEL_VIEWS_PROFILE, renderModelViews, renderStoreyCut } from '../../../packages/analysis-service/src/consult/model-views.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const out = opt('out') as string
const name = opt('name') as string
const tile = Number(opt('tile') ?? 900)
mkdirSync(out, { recursive: true })
const file = opt('model') as string
if (!existsSync(file)) {
  writeFileSync(join(out, `${name}.json`), `${JSON.stringify({ name, model: null, why: 'no model file: the run delivered no model' }, null, 1)}\n`)
  process.exit(0)
}
const raw = JSON.parse(readFileSync(file, 'utf8')) as { model?: unknown }
const model = parseModel(JSON.stringify(raw.model ?? raw))
const bundle = buildMobileSceneBundle(model)
const views = renderModelViews(bundle, tile)
const written: Record<string, unknown> = { name, profile: MODEL_VIEWS_PROFILE, tile, modelFile: file }
for (const v of views) {
  writeFileSync(join(out, `${name}-${v.name}.png`), v.png)
  written[v.name] = { file: `${name}-${v.name}.png`, width: v.width, height: v.height, sha256: v.sha256, labels: v.labels, ...(v.frame ? { frame: v.frame } : {}) }
}
const storeys: unknown[] = []
for (const l of [...model.levels].sort((a, b) => a.index - b.index)) {
  try {
    const c = renderStoreyCut(bundle, l.id, l.elevation, 1.2, 900)
    writeFileSync(join(out, `${name}-STOREY-${l.index}.png`), c.png)
    storeys.push({ index: l.index, file: `${name}-STOREY-${l.index}.png`, width: c.width, height: c.height, pxPerM: c.pxPerM, rooms: model.rooms.filter((r) => (r as { levelId?: string }).levelId === l.id).length })
  } catch (e) {
    storeys.push({ index: l.index, failed: (e as Error).message.slice(0, 120) })
  }
}
written.storeys = storeys
written.counts = { levels: model.levels.length, walls: model.walls.length, exteriorWalls: model.walls.filter((w) => w.kind === 'EXTERIOR').length, openings: model.openings.length, windows: model.windows.length, doors: model.doors.length, roofs: model.roofs.length, roofOpenings: model.roofOpenings.length, chimneys: model.chimneys.length, rooms: model.rooms.length, surfaceRegions: model.surfaceRegions.length }
writeFileSync(join(out, `${name}.json`), `${JSON.stringify(written, null, 1)}\n`)
process.stdout.write(`${name}: ${JSON.stringify(written.counts)}\n`)
