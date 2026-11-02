/**
 * LINK-F1B (research only): the plan readers of one gap under the frame shifted by a sub-pixel phase. Reconstructs a
 * sealed run, takes the plan frame of a storey and calls the exported readers with that frame moved by δ px along the
 * wall (and across it), δ ∈ {0, ±0.5, ±1, ±2}: the same ink must give the same answer.
 *   npx vite-node research/analyzer-link-f1/phase-probe.ts -- --run <dir> --cache <dir> --storey 0 --facade FRONT --centre <m> --from <m> --to <m> --wall <m>
 * `--leaf-drawn` reads a door leaf as production does since LINK-F1B (drawn band → symbol frame → leaf).
 * `--base-reader` calls the readers of another checkout instead (`BASE_TREE=<worktree at the base commit>`, e.g. one made
 * with `git worktree add <dir> 514f96a`), loaded at run time so the repository's typecheck never needs it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { doorLeafFound as currentLeaf, overheadDoorTracks as currentTracks, reconstructV2 } from '@buildapp/reconstruction'
import { drawnWallBand, symbolFrame } from '../../packages/reconstruction/src/v2/openings-v2.js'
import { doorSwingInGap as currentSwing } from '../../packages/reconstruction/src/v2/interior.js'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

const baseTree = process.argv.includes('--base-reader') ? process.env.BASE_TREE : undefined
if (process.argv.includes('--base-reader') && !baseTree) throw new Error('--base-reader needs BASE_TREE=<worktree at the base commit>')
const baseOpenings = baseTree ? ((await import(join(baseTree, 'packages/reconstruction/src/v2/openings-v2.ts'))) as typeof import('../../packages/reconstruction/src/v2/openings-v2.js')) : undefined
const baseInterior = baseTree ? ((await import(join(baseTree, 'packages/reconstruction/src/v2/interior.ts'))) as typeof import('../../packages/reconstruction/src/v2/interior.js')) : undefined
const baseLeaf = baseOpenings?.doorLeafFound ?? currentLeaf
const baseTracks = baseOpenings?.overheadDoorTracks ?? currentTracks
const baseSwing = baseInterior?.doorSwingInGap ?? currentSwing
const value = (name: string): string => process.argv[process.argv.indexOf(`--${name}`) + 1]
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (got) try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const graph = load('observation-graph') as { coordinateFrames: Array<{ id: string; variantByteHash: string }> }
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: graph as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const storey = Number(value('storey'))
const plan = r.registrations.plans.find((p) => p.storeyIndex === storey)!
const raster = rasters.get(graph.coordinateFrames.find((f) => f.id === plan.frameId)!.variantByteHash)!
const facade = value('facade') as 'FRONT' | 'REAR' | 'WEST' | 'EAST'
const host = { facade, centreAt: Number(value('centre')), storeyIndex: storey, floorY: 0 } as never
const interval: [number, number] = [Number(value('from')), Number(value('to'))]
const wall = Number(value('wall'))
const ev = (load('metric-evidence') as { evidence: Array<{ frameId?: string; textBox?: { x0: number; y0: number; x1: number; y1: number }; provenance?: unknown }> }).evidence
const boxes = ev.filter((e) => e.frameId === plan.frameId && e.textBox).map((e) => ({ x0: e.textBox!.x0 - 2, y0: e.textBox!.y0 - 2, x1: e.textBox!.x1 + 2, y1: e.textBox!.y1 + 2 }))
const out: Array<Record<string, unknown>> = []
const lin = process.argv.includes('--linearize') ? (() => {
  // the frame's tangent at the gap: one affine map through the gap's centre with the map's own local slopes
  const cx = facade === 'FRONT' || facade === 'REAR' ? (interval[0] + interval[1]) / 2 : Number(value('centre'))
  const cz = facade === 'FRONT' || facade === 'REAR' ? Number(value('centre')) : (interval[0] + interval[1]) / 2
  const p0 = plan.toPixel(cx, cz)
  const px = plan.toPixel(cx + 1, cz)
  const pz = plan.toPixel(cx, cz + 1)
  const sx = process.argv.includes('--sheet-scale') ? Math.sign(px.x - p0.x) / plan.mppX : px.x - p0.x
  const sz = process.argv.includes('--sheet-scale') ? Math.sign(pz.y - p0.y) / plan.mppY : pz.y - p0.y
  return { ...plan, mppX: 1 / Math.abs(sx), mppY: 1 / Math.abs(sz), toPixel: (x: number, z: number) => ({ x: p0.x + (x - cx) * sx, y: p0.y + (z - cz) * sz }), toWorld: (X: number, Y: number) => ({ x: cx + (X - p0.x) / sx, z: cz + (Y - p0.y) / sz }) }
})() : plan
for (const dx of [0, 0.5, -0.5, 1, -1, 2, -2]) for (const dy of [0, 0.5, -0.5, 1, -1, 2, -2]) {
  const shifted = { ...lin, toPixel: (x: number, z: number) => { const p = lin.toPixel(x, z); return { x: p.x + dx, y: p.y + dy } }, toWorld: (px: number, py: number) => lin.toWorld(px - dx, py - dy) }
  if (process.argv.includes('--leaf-drawn')) {
    // the production path (LINK-F1B): the band the plan draws beside the gap, the symbol frame about it, then the leaf
    const along = facade === 'FRONT' || facade === 'REAR' ? 'X' : 'Z'
    const ink = drawnWallBand(raster, shifted as never, host, interval, wall)
    const symHost = ink ? { ...(host as object), centreAt: ink.centreAt } : host
    const symPlan = symbolFrame(shifted as never, along === 'X' ? { x: (interval[0] + interval[1]) / 2, z: (symHost as { centreAt: number }).centreAt } : { x: (symHost as { centreAt: number }).centreAt, z: (interval[0] + interval[1]) / 2 })
    // the callouts' text boxes are on the drawing: they stay where it prints them whatever the frame's phase
    const lf = currentLeaf(raster, symPlan as never, symHost as never, interval, wall, boxes)
    out.push({ dx, dy, band: ink ? ink.centreAt : null, tracks: lf ? [lf.hingeAt, lf.swing] : null })
  } else if (process.argv.includes('--leaf')) {
    const lf = (process.argv.includes('--base-reader') ? baseLeaf : currentLeaf)(raster, shifted as never, host, interval, wall, boxes)
    out.push({ dx, dy, tracks: lf ? [lf.hingeAt, lf.swing] : null })
  } else if (process.argv.includes('--swing')) {
    const sw = (process.argv.includes('--base-reader') ? baseSwing : currentSwing)(raster, shifted as never, value('axis') as 'X' | 'Z', Number(value('at')), interval)
    out.push({ dx, dy, tracks: sw ? [sw.hinge, sw.radius] : null })
  } else {
    const t = (process.argv.includes('--base-reader') ? baseTracks : currentTracks)(raster, shifted as never, host, interval, wall)
    out.push({ dx, dy, tracks: t ? t.lengthsM : null })
  }
}
console.log(JSON.stringify({ anchor: lin.toPixel((interval[0] + interval[1]) / 2, Number(value('centre'))), mpp: [lin.mppX, lin.mppY], frame: plan.frameId, why: plan.why, results: out }))
