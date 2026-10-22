/**
 * N7-COUNCIL B (research only, offline): the global wall thickness T against the bands that draw the base plan's
 * outer faces. Prints T in px, the length-weighted median of all bands, and the thickness of the bands lying on each
 * envelope edge (the outer walls), plus each body's per-edge outer band thickness where one is drawn.
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, archonAdapter, decodeImage, fileByteCache, genericProjectPageAdapter, selectedVariant } from '@buildapp/source-package'
import { reconstructV2 } from '@buildapp/reconstruction'
import { identityOf } from '../../../packages/analysis-service/src/identity.js'

const value = (name: string): string => process.argv[process.argv.indexOf(`--${name}`) + 1]
const run = resolve(value('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(value('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const cache = fileByteCache(value('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
for (const asset of pkg.assets) {
  const variant = selectedVariant(asset)
  const got = await cache.get(variant.url)
  if (!got) continue
  try { rasters.set(variant.byteHash, decodeImage(got.bytes)) } catch { rasters.set(variant.byteHash, undefined) }
}
const identity = identityOf(pkg, [archonAdapter, genericProjectPageAdapter])
const r = reconstructV2({ modelId: identity.modelId, label: identity.label, slug: identity.slug, sourcePackageId: pkg.id, sourcePackageHash: pkg.contentHash, graph: load('observation-graph') as never, metrics: load('metric-evidence') as never, raster: (frame: { variantByteHash: string }) => rasters.get(frame.variantByteHash), publishedAreas: pkg.publishedFacts, publishedRooms: pkg.publishedRooms })
const base = r.planDiagnostics.plans.find((p) => p.frameId === r.planDiagnostics.selectedPlanFrameId)!
const f = r.registrations.plans.find((p) => p.frameId === base.frameId)!
const mpp = Math.max(f.mppX, f.mppY)
const T = r.building.wallThicknessM
const len = (b: (typeof base.bands)[number]): number => (b.axis === 'V' ? b.bounds.y1 - b.bounds.y0 : b.bounds.x1 - b.bounds.x0)
const wq = (bs: typeof base.bands, q: number): number | null => {
  const s = bs.map((b) => ({ t: b.thickness, w: len(b) })).filter((x) => x.w > 0).sort((a, b) => a.t - b.t)
  if (s.length === 0) return null
  const tot = s.reduce((a, b) => a + b.w, 0) * q
  let run = 0
  for (const e of s) { run += e.w; if (run >= tot) return e.t }
  return s[s.length - 1].t
}
const faceBands = (side: 'W' | 'E' | 'N' | 'S', rect: { x0: number; y0: number; x1: number; y1: number }, tol: number) => base.bands.filter((b) => {
  if (side === 'W') return b.axis === 'V' && Math.abs(b.bounds.x0 - rect.x0) <= tol && len(b) > 20
  if (side === 'E') return b.axis === 'V' && Math.abs(b.bounds.x1 + 1 - rect.x1) <= tol && len(b) > 20
  if (side === 'N') return b.axis === 'H' && Math.abs(b.bounds.y0 - rect.y0) <= tol && len(b) > 20
  return b.axis === 'H' && Math.abs(b.bounds.y1 + 1 - rect.y1) <= tol && len(b) > 20
})
const out: Record<string, unknown> = { T, Tpx: +(T / mpp).toFixed(2), mpp, medianAll: wq(base.bands, 0.5), q75All: wq(base.bands, 0.75), envelope: base.envelope }
const bodies: Record<string, unknown> = {}
for (const m of r.building.masses) {
  const a = f.toPixel(m.x0, m.z1)
  const c = f.toPixel(m.x1, m.z0)
  const rect = { x0: Math.min(a.x, c.x), y0: Math.min(a.y, c.y), x1: Math.max(a.x, c.x), y1: Math.max(a.y, c.y) }
  const tol = Math.max(3, (T / mpp) * 0.5)
  bodies[m.id] = Object.fromEntries((['W', 'E', 'N', 'S'] as const).map((s) => [s, faceBands(s, rect, tol).map((b) => `${b.thickness}px=${(b.thickness * mpp).toFixed(3)}m/len${len(b)}`)]))
}
out.bodies = bodies
console.log(JSON.stringify(out))
