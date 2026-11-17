/**
 * v3.54.6 — which pictures of a package the reading would send, and what became of each of the others (no API).
 *   npx vite-node research/source-to-model/v3546/pictures-probe.ts -- <source-package.json> <cache dir> [<reference.json>]
 * With a detail reference, each elevation file it names is found among the sent or the skipped pictures.
 */
import { readFileSync } from 'node:fs'
import { housePictures } from '../../../packages/analysis-service/src/house/pictures.js'
import { fileByteCache, startDecoders } from '@buildapp/source-package'

await startDecoders()
const [pkgPath, cacheDir, refPath] = process.argv.slice(2).filter((a) => a !== '--')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { assets: Array<{ id: string; variants: Array<{ url: string }> }> }
const { pictures, skipped } = await housePictures(pkg.assets as never, fileByteCache(cacheDir))
const out = {
  assets: pkg.assets.length,
  sent: pictures.map((p) => ({ id: p.id, assetId: p.assetId, role: p.pageRole.document, size: `${p.width}x${p.height}` })),
  skipped: skipped.reduce<Record<string, number>>((m, s) => ({ ...m, [s.code]: (m[s.code] ?? 0) + 1 }), {}),
  skippedList: skipped.map((s) => ({ assetId: s.assetId, code: s.code, role: s.role, why: s.why.slice(0, 120) })),
}
if (refPath) {
  const ref = JSON.parse(readFileSync(refPath, 'utf8')) as { sides: Record<string, { status: string; asset?: string }> }
  ;(out as Record<string, unknown>).referenceElevations = Object.entries(ref.sides).map(([side, s]) => ({ side, asset: s.asset, sent: pictures.some((p) => p.assetId === s.asset), skipped: skipped.find((k) => k.assetId === s.asset)?.code ?? null }))
}
console.log(JSON.stringify(out, null, 1))
