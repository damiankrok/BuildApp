/**
 * N9-01 (research only, offline): diagnostic boards of the production relations, for the owner's private ZIP.
 *
 *   plan   --run <full run dir> --graph <graph.json> --cache <dir> --out <dir>
 *          the solver on the run's own sealed evidence (the model the run delivered), then `assessModelDetailed` with its
 *          masks: per registered storey one PNG — the plan raster faded, the modelled storey (blue), drawn thick ink
 *          outside it (red), and the R3 stations (green in-line wall, cyan crossing, orange thin strokes, red blank paper)
 *   roof   --models <label>=<model.json>,… --out <dir>
 *          R1's grid, top down, one panel per model: one layer (grey), layered outside the walls (blue), near an edge
 *          (yellow), undecided (violet), roof inside a roof (red)
 *
 * Writes PNGs and a JSON of what was drawn into --out (outside the repository: these boards carry source pixels).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { parseModel } from '@buildapp/model'
import { compileBuilding, geometryClosureAudit } from '@buildapp/geometry'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import type { Raster } from '@buildapp/source-cv'
import { assessModelDetailed, encodePng, identityOf, roofLayersRelation } from '../../packages/analysis-service/src/index.js'
import type { RoofCellClass } from '../../packages/analysis-service/src/index.js'

const arg = (name: string): string | undefined => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined)
const out = arg('out') as string
mkdirSync(out, { recursive: true })
const mode = process.argv[2]

function canvas(w: number, h: number): Raster {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) }
}
function put(r: Raster, x: number, y: number, rgb: [number, number, number], a = 1): void {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return
  const o = (yi * r.width + xi) * 4
  for (let k = 0; k < 3; k += 1) r.data[o + k] = Math.round(r.data[o + k] * (1 - a) + rgb[k] * a)
  r.data[o + 3] = 255
}

if (mode === 'plan') {
  const run = arg('run') as string
  const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
  const pkg = SourcePackageSchema.parse(load('source-package'))
  const graph = JSON.parse(readFileSync(arg('graph') as string, 'utf8'))
  const metrics = load('metric-evidence') as never
  const cache = fileByteCache(arg('cache') as string)
  const rasters = new Map<string, Raster | undefined>()
  for (const asset of pkg.assets) {
    const v = selectedVariant(asset)
    const got = await cache.get(v.url)
    if (!got) continue
    try {
      rasters.set(v.byteHash, decodeImage(got.bytes))
    } catch {
      rasters.set(v.byteHash, undefined)
    }
  }
  const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
  const raster = (f: { variantByteHash: string }): Raster | undefined => rasters.get(f.variantByteHash)
  const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster, publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
  const scene = compileBuilding(r.model)
  const closure = geometryClosureAudit(r.model, scene)
  const { assessment, plans } = assessModelDetailed({ model: r.model, scene, closure, reconstruction: r, frames: graph.coordinateFrames, raster }, { keepMasks: true })
  const drawn: unknown[] = []
  for (const s of plans.storeys) {
    const frame = r.registrations.plans.find((p) => p.frameId === s.ink.frameId)
    const src = frame ? raster(graph.coordinateFrames.find((f: { id: string }) => f.id === frame.frameId)) : undefined
    const masks = s.outline.masks
    if (!frame || !src || !masks) continue
    const board = canvas(src.width, src.height)
    for (let i = 0; i < src.width * src.height; i += 1) {
      const l = 0.299 * src.data[i * 4] + 0.587 * src.data[i * 4 + 1] + 0.114 * src.data[i * 4 + 2]
      const v = Math.round(255 - (255 - l) * 0.45)
      board.data[i * 4] = v
      board.data[i * 4 + 1] = v
      board.data[i * 4 + 2] = v
      board.data[i * 4 + 3] = 255
    }
    for (let i = 0; i < masks.footprint.length; i += 1) if (masks.footprint[i]) put(board, i % masks.width, Math.floor(i / masks.width), [60, 110, 230], 0.22)
    for (let i = 0; i < masks.outside.length; i += 1) if (masks.outside[i]) put(board, i % masks.width, Math.floor(i / masks.width), [230, 30, 30], 0.85)
    const colour = { BAND: [20, 160, 60], THIN: [240, 140, 0], BLANK: [220, 0, 0], EXCLUDED: [150, 150, 150] } as const
    for (const w of s.ink.walls) {
      const L = Math.hypot(w.wall.end.x - w.wall.start.x, w.wall.end.z - w.wall.start.z)
      const u = { x: (w.wall.end.x - w.wall.start.x) / L, z: (w.wall.end.z - w.wall.start.z) / L }
      const n = { x: -u.z, z: u.x }
      for (const st of w.stations) {
        const c = st.cls === 'BAND' && !st.inline ? ([0, 170, 200] as [number, number, number]) : (colour[st.cls] as unknown as [number, number, number])
        const p = frame.toPixel(w.wall.start.x + u.x * st.a + (n.x * w.wall.thickness) / 2, w.wall.start.z + u.z * st.a + (n.z * w.wall.thickness) / 2)
        for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) put(board, p.x + dx, p.y + dy, c, 1)
      }
    }
    const name = `plan-storey-${s.ink.storeyIndex}.png`
    writeFileSync(join(out, name), encodePng(board))
    drawn.push({ file: name, storeyIndex: s.ink.storeyIndex, frameId: s.ink.frameId, support: s.ink.support, r3: s.ink.walls.map((w) => ({ wall: w.wall.id, status: w.verdict.status, code: w.verdict.code })), r4: { status: s.outline.status, code: s.outline.code, measured: s.outline.measured } })
  }
  writeFileSync(join(out, 'boards.json'), JSON.stringify({ modelHash: r.candidate.modelHash, summary: assessment.summary, drawn }, null, 1))
  console.log(JSON.stringify({ modelHash: r.candidate.modelHash, boards: drawn.length, summary: assessment.summary }))
} else if (mode === 'roof') {
  const models = (arg('models') as string).split(',').map((s) => s.split('='))
  const CELL = 6
  const colour: Record<RoofCellClass, [number, number, number]> = { ONE_LAYER: [200, 200, 200], NEAR_EDGE: [240, 200, 40], LAYERED: [60, 110, 230], UNDECIDED: [150, 80, 200], CONFLICT: [220, 20, 20] }
  const panels = models.map(([label, path]) => {
    const model = parseModel(readFileSync(path, 'utf8'))
    const cells: Array<{ x: number; z: number; cls: RoofCellClass }> = []
    const rel = roofLayersRelation(model, compileBuilding(model), { onCell: (x, z, cls) => cells.push({ x, z, cls }) })
    return { label, model, cells, rel }
  })
  const xs = panels.flatMap((p) => p.cells.map((c) => c.x))
  const zs = panels.flatMap((p) => p.cells.map((c) => c.z))
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
  const pw = Math.ceil((box.x1 - box.x0) / 0.1 + 1) * CELL
  const ph = Math.ceil((box.z1 - box.z0) / 0.1 + 1) * CELL
  const board = canvas(panels.length * (pw + 20) + 20, ph + 40)
  panels.forEach((p, k) => {
    const ox = 20 + k * (pw + 20)
    for (const c of p.cells) {
      const px = ox + Math.round((c.x - box.x0) / 0.1) * CELL
      // z grows towards the rear: drawn upwards, as a plan is read with the front at the bottom
      const py = 20 + ph - CELL - Math.round((c.z - box.z0) / 0.1) * CELL
      for (let dy = 0; dy < CELL - 1; dy += 1) for (let dx = 0; dx < CELL - 1; dx += 1) put(board, px + dx, py + dy, colour[c.cls])
    }
  })
  writeFileSync(join(out, 'roof-layers.png'), encodePng(board))
  const summary = panels.map((p) => ({ label: p.label, status: p.rel.status, cells: Object.fromEntries((['ONE_LAYER', 'NEAR_EDGE', 'LAYERED', 'UNDECIDED', 'CONFLICT'] as const).map((c) => [c, Math.round(p.cells.filter((x) => x.cls === c).length) / 100])), items: p.rel.items.map((i) => ({ status: i.status, code: i.code, objects: i.objects, measured: i.measured })) }))
  writeFileSync(join(out, 'roof-layers.json'), JSON.stringify({ panelsLeftToRight: models.map((m) => m[0]), cellM2: 0.01, summary }, null, 1))
  console.log(JSON.stringify(summary.map((s) => [s.label, s.status, s.cells])))
}
