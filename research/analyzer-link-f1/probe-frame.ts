/**
 * LINK-F1 (research only, offline): the base plan's two metric frames side by side — the 03R layout's chain ladder
 * (what the masses and footprint regions are placed with) and the v2 plan frame (what walls, gaps, openings, stairs and
 * interior ink are mapped with) — on a sealed run, through this checkout.
 *   npx vite-node research/analyzer-link-f1/probe-frame.ts -- --run <dir> --cache <dir>
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { composeStructuralLayout } from '../../packages/reconstruction/src/structural.js'
import { levelsFrom } from '../../packages/reconstruction/src/solve.js'
import { axisLadder } from '../../packages/reconstruction/src/layout.js'
import { outerFacesAlong, planFrameV2, worldFrameFrom } from '../../packages/reconstruction/src/v2/frame.js'
import { identityOf } from '../../packages/analysis-service/src/identity.js'

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
const metrics = load('metric-evidence') as { coordinateRegistrations: Array<Record<string, unknown>>; chains: Array<Record<string, unknown>> }
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const solve = !process.argv.includes('--no-solve')
const r = !solve ? ({ registrations: { plans: [] } } as unknown as ReturnType<typeof reconstructV2>) : reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: metrics as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms } as never)
const graph = load('observation-graph') as never
const sectionFrame = (graph as { coordinateFrames: Array<{ id: string; roles: { projection: string } }> }).coordinateFrames.find((f) => f.roles.projection === 'ORTHOGRAPHIC_SECTION')
const levels = levelsFrom(metrics as never, sectionFrame?.id)
const { draft } = composeStructuralLayout({ slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph, metrics: metrics as never, raster: ((frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash)) as never, levels, publishedAreas: pkg.publishedFacts, sheetCache: new Map() } as never)
const base = draft.base!
const world = worldFrameFrom(draft)!
const v2 = planFrameV2(base, 0, world, draft)!
const fin = r.registrations.plans.find((p) => p.frameId === base.frame.id)
const ext = base.decomposition.envelope!.rect
const reg = base.registration!
const rows = (axis: 'X' | 'Y') => {
  const lines = axis === 'X' ? base.decomposition.linesX : base.decomposition.linesY
  const at = axis === 'X' ? draft.frame!.x! : draft.frame!.z!
  // v2 metres along the same 03R axis (x; z_old = zFlip - z)
  const lin = (px: number) => (axis === 'X' ? v2.toWorld(px, 0).x : world.zFlip - v2.toWorld(0, px).z)
  // the sheet-linear map the v2 frame used before LINK-F1 (the face-to-face-corrected scale through the layout's origin)
  const linear = (px: number) => (axis === 'X' ? (px - draft.frame!.originPx.x) * v2.mppX : (px - draft.frame!.originPx.y) * v2.mppY)
  return lines.map((l) => ({ px: l.px, ladder: +at(l.px).toFixed(4), v2: +lin(l.px).toFixed(4), linear: +linear(l.px).toFixed(4), dCm: +((linear(l.px) - at(l.px)) * 100).toFixed(1), v2LadderCm: +((lin(l.px) - at(l.px)) * 100).toFixed(1) }))
}
const chainsOn = (metrics.chains as Array<{ frameId: string; axis: string; id: string; segments: Array<{ fromPx: number; toPx: number; valueCm?: number; origin?: string }> }>).filter((c) => c.frameId === base.frame.id)
const evidence = new Map((metrics as unknown as { evidence: Array<{ id: string; value: number; unit: string; confidence: number }> }).evidence.map((e) => [e.id, e]))
const claimsOf = (axis: 'X' | 'Y') => {
  const lines = axis === 'X' ? base.decomposition.linesX : base.decomposition.linesY
  const mpp = axis === 'X' ? reg.metresPerPixelX : reg.metresPerPixelY
  const lad = axisLadder(lines, (metrics.chains as never[]).filter((c: { frameId: string }) => c.frameId === base.frame.id), (metrics as never as { evidence: never[] }).evidence, axis, mpp, axis === 'X' ? ext.x0 : ext.y0, Math.max(2, base.wallPx / 2))
  const out: Array<Record<string, unknown>> = []
  for (let i = 0; i < lines.length; i += 1) for (let j = i + 1; j < lines.length; j += 1) {
    const sp = lad.span(lines[i].px, lines[j].px)
    if (!sp.stated) continue
    const px = lines[j].px - lines[i].px
    out.push({ i, j, from: lines[i].px, to: lines[j].px, px, m: sp.metres, mpp: +(sp.metres / px).toFixed(6), resPx: +(sp.metres / mpp - px).toFixed(2), landed: sp.landed, agreed: sp.agreed, chains: sp.chainIds.map((c) => c.slice(-10)), ev: sp.evidenceIds.map((e) => { const v = evidence.get(e); return v ? `${v.value}${v.unit}@${v.confidence}` : e }) })
  }
  return out
}
const statements = chainsOn.flatMap((c) => c.segments.map((s) => ({ chain: c.id.slice(-10), axis: c.axis === 'HORIZONTAL' ? 'X' : 'Y', from: s.fromPx, to: s.toPx, cm: s.valueCm, ev: (s as { evidenceId?: string }).evidenceId ? (evidence.get((s as { evidenceId?: string }).evidenceId as string)?.value) : undefined, origin: s.origin, px: +(s.toPx - s.fromPx).toFixed(1) })))
console.log(JSON.stringify({
  base: base.frame.id, finalBase: fin ? { mppX: fin.mppX, mppY: fin.mppY } : null,
  registration: { mppX: reg.metresPerPixelX, mppY: reg.metresPerPixelY, anchors: (reg.anchors as unknown as Array<Record<string, unknown>>).map((a) => `${a.axis} ${a.kind} ${a.metricSpan}m/${a.pixelSpan}px res ${a.residualM} w ${a.weight}`), rejected: (reg as unknown as { rejected?: unknown[] }).rejected?.length },
  extent: ext, wallPx: base.wallPx,
  facesX: outerFacesAlong(base.bands, 'X', ext.x0, ext.x1), facesY: outerFacesAlong(base.bands, 'Y', ext.y0, ext.y1),
  v2: { mppX: v2.mppX, mppY: v2.mppY },
  ladderX: rows('X'), ladderY: rows('Y'),
  ladderAnchors: (draft.frame as unknown as { ladders?: { x: { anchors: unknown[]; scale: number }; z: { anchors: unknown[]; scale: number } } }).ladders ?? null,
  masses: draft.masses.map((m) => ({ id: m.id, ring: m.ring.points })), regions: draft.footprintRegions.map((r) => ({ id: r.id, kind: r.kind, ring: r.ring.points })),
  statements, claimsX: claimsOf('X'), claimsY: claimsOf('Y'),
  world: { walled: world.walled, envelope: world.envelope },
  frames: r.registrations.plans.map((p) => ({ frameId: p.frameId, storey: p.storeyIndex, mppX: p.mppX, mppY: p.mppY, why: p.why })),
  alignments: [...draft.alignments.entries()].map(([k, a]) => ({ k, scale: a.scale, basis: a.basis, why: a.why.slice(0, 200) })),
}, null, 1))
