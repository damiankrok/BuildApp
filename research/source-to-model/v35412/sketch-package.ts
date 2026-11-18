/**
 * v3.54.12 — a source package in which ONLY the named elevation assets are replaced by the OWNER's colour sketches
 * (experiment B / B1 / B2, protocol `SKETCH_PROTOCOL.md`). Plans, sections, site plans and every other elevation stay
 * byte for byte as in A (their own cache entries are copied).
 *
 *   npx vite-node research/source-to-model/v35412/sketch-package.ts -- --package <pkg.json> --cache <dir>
 *        --replace <assetId>=<image file> [--replace …] --run-label B|B1|B2 --out <dir>
 *
 * Every variant of a replaced asset gets the sketch's own bytes (never resampled here — a registered copy, if wanted,
 * is made by register-sketch.py and given as the file), its own hash and URL (`https://owner-sketch.invalid/<hash>.<ext>`)
 * and its own cache entry, so it can never be served the original's cached reading. The package content hash is
 * recomputed. `record.json` names, per asset, the original hashes and sizes, the sketch's hash, size and media type,
 * and that the run is MIXED (two elevations of four replaced) when not every elevation is replaced. Nothing here reads
 * a house document, a reference or a number of the house.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createHash } from 'node:crypto'
import { cacheKeyFor, decodeImage, fileByteCache, sourcePackageContentHash, SourcePackageSchema } from '@buildapp/source-package'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const values = (k: string): string[] => argv.flatMap((a, i) => (a === `--${k}` && argv[i + 1] ? [argv[i + 1]] : []))
const value = (k: string): string | undefined => values(k)[0]
const pkgPath = value('package') as string
const cacheDir = value('cache') as string
const out = value('out') as string
const runLabel = value('run-label') ?? 'B'
const replace = new Map(values('replace').map((s) => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)] as [string, string]))
if (!pkgPath || !cacheDir || !out || replace.size === 0) throw new Error('give --package, --cache, --replace <assetId>=<file> (one or more), --run-label, --out')

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const mediaOf = (b: Uint8Array): { type: string; ext: string } => {
  if (b[0] === 0x89 && b[1] === 0x50) return { type: 'image/png', ext: 'png' }
  if (b[0] === 0xff && b[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' }
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return { type: 'image/webp', ext: 'webp' }
  throw new Error('a sketch must be a PNG, JPEG or WebP picture')
}

async function main(): Promise<void> {
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(pkgPath, 'utf8')))
  const unknown = [...replace.keys()].filter((id) => !pkg.assets.some((a) => a.id === id))
  if (unknown.length) throw new Error(`not an asset of this package: ${unknown.join(', ')}`)
  const notElevation = [...replace.keys()].filter((id) => pkg.assets.find((a) => a.id === id)?.roles.document !== 'ELEVATION')
  if (notElevation.length) throw new Error(`only elevations are replaced in this experiment: ${notElevation.join(', ')}`)
  const cache = fileByteCache(cacheDir)
  const outCache = join(out, 'cache')
  mkdirSync(outCache, { recursive: true })
  const outCacheApi = fileByteCache(outCache)
  const record: Array<Record<string, unknown>> = []
  const assets = []
  for (const asset of pkg.assets) {
    const file = replace.get(asset.id)
    const variants = []
    for (const v of asset.variants) {
      if (!file) {
        for (const ext of ['.bin', '.type', '.url']) {
          const src = join(cacheDir, cacheKeyFor(v.url) + ext)
          if (existsSync(src)) copyFileSync(src, join(outCache, cacheKeyFor(v.url) + ext))
        }
        variants.push(v)
        continue
      }
      const orig = await cache.get(v.url)
      const bytes = new Uint8Array(readFileSync(file))
      const media = mediaOf(bytes)
      const r = decodeImage(bytes)
      const h = sha(bytes)
      const url = `https://owner-sketch.invalid/${h}.${media.ext}`
      await outCacheApi.put(url, bytes, media.type)
      record.push({
        asset: asset.id, variant: v.id, role: asset.roles.document,
        original: { hash: v.byteHash, available: !!orig && sha(orig.bytes) === v.byteHash, width: v.decoded.width, height: v.decoded.height },
        sketch: { file: basename(file), hash: h, mediaType: media.type, width: r.width, height: r.height, bytes: bytes.length },
        method: 'OWNER_SKETCH_SUBSTITUTION@1', provenance: 'OWNER-supplied colour redrawing; fidelity unmeasured; not an API result', url,
      })
      // the page's declared size described the original picture, not this one: dropped; the aspect is the sketch's own
      const { declared: _declared, ...rest } = v
      variants.push({ ...rest, url, mediaType: media.type, byteLength: bytes.length, byteHash: h, discoveredVia: `OWNER_SKETCH:${v.byteHash}`, decoded: { width: r.width, height: r.height }, declaredMismatch: false, aspect: Number((r.width / r.height).toFixed(6)) })
    }
    assets.push({ ...asset, variants })
  }
  const elevations = pkg.assets.filter((a) => a.roles.document === 'ELEVATION').length
  const draft = { ...pkg, assets }
  delete (draft as { contentHash?: string }).contentHash
  const derived = SourcePackageSchema.parse({ ...draft, contentHash: sourcePackageContentHash(draft as never) })
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'package.json'), `${JSON.stringify(derived, null, 1)}\n`)
  const mixed = replace.size < elevations
  writeFileSync(join(out, 'record.json'), `${JSON.stringify({ schema: 'buildapp.v35412-sketch-package/1', runLabel, mixed, replacedElevations: replace.size, elevationsInPackage: elevations, sourcePackage: pkg.contentHash, derivedPackage: derived.contentHash, record }, null, 1)}\n`)
  process.stdout.write(`${runLabel}: ${replace.size} of ${elevations} elevation asset(s) replaced${mixed ? ' (MIXED run)' : ''}, ${record.length} variant(s); package ${derived.contentHash.slice(0, 12)}\n`)
}
main().catch((e) => {
  process.stderr.write(`${(e as Error).stack}\n`)
  process.exit(1)
})
