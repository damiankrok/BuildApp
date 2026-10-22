/**
 * Council E: the legacy side assignment (views.ts chooseSide via solve.ts registerElevationFrames) on a sealed corpus
 * house. Prints each elevation's measured width, the surplus over each axis, and what is assigned/refused — and the
 * counterfactual when the refused view would be tried on the other (free) axis. Offline, rasters from the byte cache.
 *   npx vite-node research/analyzer-n7-council/E/side-choice.ts -- --run <dir> --package <pkg> --cache <cache> --width W --depth D --height H
 */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import { registerElevationFrames } from '@buildapp/reconstruction'

const arg = (n: string): string => process.argv[process.argv.indexOf(`--${n}`) + 1]
const run = resolve(arg('run'))
const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(arg('package'), 'utf8')))
const load = (name: string): unknown => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
const graph = load('observation-graph') as { coordinateFrames: Array<{ id: string; variantByteHash: string; roles: { view: string; projection: string } }> }
const cache = fileByteCache(arg('cache'))
const rasters = new Map<string, ReturnType<typeof decodeImage>>()
for (const a of pkg.assets) {
  const v = selectedVariant(a)
  const got = await cache.get(v.url)
  if (got) try { rasters.set(v.byteHash, decodeImage(got.bytes)) } catch { /* undecodable: left out, as the replay does */ }
}
const massing = { width: Number(arg('width')), depth: Number(arg('depth')), totalHeight: Number(arg('height')) }
const out = registerElevationFrames(graph as never, massing, undefined, (f) => rasters.get((f as { variantByteHash: string }).variantByteHash))
for (const r of out.registrations) console.log(`ASSIGNED ${r.side} ${r.frameId.slice(-10)} widthM=${((r.extent.x1 - r.extent.x0) * r.metresPerPixelU).toFixed(2)} span=${r.spanM} eaves=${r.overhangM} why=${r.sideWhy.slice(0, 120)}`)
for (const r of out.refused) {
  const m = /silhouette is ([\d.]+) m across/.exec(r.why)
  const w = m ? Number(m[1]) : NaN
  console.log(`REFUSED ${r.frameId.slice(-10)} ${r.why.slice(0, 150)}\n   surplus over width ${(w - massing.width).toFixed(2)} m, over depth ${(w - massing.depth).toFixed(2)} m -> on the depth axis it would be eaves of ${((w - massing.depth) / 2).toFixed(2)} m each side`)
}
