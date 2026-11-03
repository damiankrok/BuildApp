/**
 * SOURCE-01 (research): acquire SourcePackages through the production adapters, bytes into a cache OUTSIDE the
 * repository. The package's roles are exactly what the production text path assigns (the BEFORE of this stage).
 *   npx vite-node research/analyzer-source-01/acquire.ts -- --out <dir> --cache <dir> <url> [<url> ...]
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { acquireSourcePackage, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'

const args = process.argv.slice(2).filter((a) => a !== '--')
const value = (n: string): string => args[args.indexOf(`--${n}`) + 1]
const out = resolve(value('out'))
const cacheDir = resolve(value('cache'))
if (out.startsWith(resolve('.')) || cacheDir.startsWith(resolve('.'))) throw new Error('REFUSED: outputs must be outside the repository')
const urls = args.filter((a, i) => a.startsWith('https://') && args[i - 1] !== '--out' && args[i - 1] !== '--cache')
const cache = fileByteCache(cacheDir)
for (const url of urls) {
  const slug = url.split('/').pop() as string
  const dir = join(out, slug)
  if (existsSync(join(dir, 'source-package.json'))) { console.log(`have ${slug}`); continue }
  mkdirSync(dir, { recursive: true })
  const t = Date.now()
  try {
    const pkg = await acquireSourcePackage(url, [archonAdapter, genericProjectPageAdapter], { cache })
    writeFileSync(join(dir, 'source-package.json'), `${JSON.stringify(pkg, null, 1)}\n`)
    console.log(`ok ${slug} ${pkg.assets.length} assets ${Date.now() - t} ms`)
  } catch (e) {
    console.log(`FAILED ${slug}: ${(e as Error).message}`)
  }
}
