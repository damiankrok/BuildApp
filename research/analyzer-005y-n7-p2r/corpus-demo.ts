/**
 * N7-P2R: a real corpus program taken through misreading → refusal → diagnosis → recovery, offline on sealed evidence.
 *
 *   npx vite-node research/analyzer-005y-n7-p2r/corpus-demo.ts -- --run <dir> --package <source-package.json> \
 *        --cache <byte cache> --out <dir outside the repo> --mass attached-0 --side WEST --keep 0.45
 *
 * Three runs of the production solver on the same evidence:
 *   A  as read (the corpus model);
 *   B  the body narrowed where segmentation would narrow it, adjudication off — what the model did before P2R;
 *   C  the same misreading, adjudication on.
 * Writes model/program/thinBodies per run and a plan overlay (the publisher's raster: outside the repository only).
 * RESEARCH ONLY.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import { serializeModel } from '@buildapp/model'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const REPO = resolve(import.meta.dirname, '../..')
const value = (name: string, fallback?: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0 || i + 1 >= process.argv.length) {
    if (fallback !== undefined) return fallback
    throw new Error(`--${name} is required`)
  }
  return process.argv[i + 1]
}
const out = resolve(value('out'))
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const graph = load('observation-graph') as never
const metrics = load('metric-evidence') as never
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try {
    rasters.set(variant.byteHash, decodeImage(got.bytes))
  } catch {
    rasters.set(variant.byteHash, undefined)
  }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const narrow = { id: value('mass', 'attached-0'), side: value('side', 'WEST') as 'WEST', keepM: Number(value('keep', '0.45')) }
const solve = (diagnostics?: Parameters<typeof reconstructV2>[0]['diagnostics']) =>
  reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms, ...(diagnostics ? { diagnostics } : {}) })
const summary: Record<string, unknown> = {}
const runs = { A: solve(), B: solve({ narrowMass: narrow, skipThinBodies: true }), C: solve({ narrowMass: narrow }) }
for (const [k, r] of Object.entries(runs)) {
  const text = serializeModel(r.model)
  mkdirSync(join(out, k), { recursive: true })
  writeFileSync(join(out, k, 'model.json'), text)
  writeFileSync(join(out, k, 'program.json'), JSON.stringify(r.candidate.program) + '\n')
  writeFileSync(join(out, k, 'thin-bodies.json'), JSON.stringify(r.thinBodies, null, 1) + '\n')
  summary[k] = {
    modelSha256: createHash('sha256').update(text).digest('hex'),
    outcome: r.partialPreview ? 'PARTIAL_3D_PREVIEW' : 'COMPLETE',
    failure: r.partialPreview?.failures[0] ?? null,
    skipped: r.partialPreview?.skipped.map((s) => `${s.type} ${s.id}`) ?? [],
    masses: r.building.masses.map((m) => ({ id: m.id, x0: m.x0, z0: m.z0, x1: m.x1, z1: m.z1, ...(m.openSide ? { openSide: m.openSide } : {}) })),
    wallRings: r.model.wallRings.length,
    walls: r.model.walls.length,
    openings: r.model.openings.length,
    thinBodies: r.thinBodies.map((t) => ({ massId: t.massId, narrowM: t.narrowM, decision: t.decision.kind, after: t.decision.after, supported: t.hypotheses.filter((h) => h.status === 'SUPPORTED').map((h) => h.kind), chains: t.chains.map((c) => `${c.valueCm}:${c.role}`), elevations: t.elevations.map((e) => `${e.side}:${e.builtShare}:${e.verdict}`), firstBad: t.firstBad })),
  }
}
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1) + '\n')
console.log(JSON.stringify(summary, null, 1))

// the plan, with the body as read (green), as misread (red) and as recovered (blue)
const C = runs.C
const rec = C.thinBodies[0]
const planFrame = C.registrations.plans.find((p) => p.frameId === rec?.planFrameId) ?? C.registrations.plans[0]
const f = (graph as { coordinateFrames: Array<{ id: string; variantByteHash: string }> }).coordinateFrames.find((x) => x.id === planFrame.frameId)
const raster = f ? rasters.get(f.variantByteHash) : undefined
if (raster) {
  const png = new PNG({ width: raster.width, height: raster.height })
  for (let i = 0; i < raster.data.length; i += 4) for (let c = 0; c < 3; c += 1) png.data[i + c] = 255 - Math.round((255 - raster.data[i + c]) * 0.6)
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255
  const box = (r: { x0: number; z0: number; x1: number; z1: number }, rgb: [number, number, number], w: number): void => {
    const a = planFrame.toPixel(r.x0, r.z0)
    const b = planFrame.toPixel(r.x1, r.z1)
    const [x0, x1, y0, y1] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y)].map(Math.round)
    for (let t = 0; t < w; t += 1) {
      for (let x = x0 - t; x <= x1 + t; x += 1) for (const y of [y0 - t, y1 + t]) dot(x, y, rgb)
      for (let y = y0 - t; y <= y1 + t; y += 1) for (const x of [x0 - t, x1 + t]) dot(x, y, rgb)
    }
  }
  const dot = (x: number, y: number, rgb: [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return
    const o = (y * png.width + x) * 4
    png.data[o] = rgb[0]
    png.data[o + 1] = rgb[1]
    png.data[o + 2] = rgb[2]
  }
  const asRead = runs.A.building.masses.find((m) => m.id === narrow.id)
  if (asRead) box(asRead, [20, 170, 40], 3)
  if (rec) box(rec.decision.before, [230, 30, 30], 2)
  if (rec?.decision.after) box(rec.decision.after, [30, 80, 255], 1)
  writeFileSync(join(out, 'plan-overlay.png'), PNG.sync.write(png))
}
