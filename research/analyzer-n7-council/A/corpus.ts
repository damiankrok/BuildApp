/** Council A (research only): load one sealed corpus house (package, graph, metrics, rasters) offline. */
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache, selectedVariant } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'

export const HOUSES = ['a01', 'gozd', 'marcowki', 'ciesz', 'rary', 'trytomach', 'arganiach', 'sasankach3'] as const
export function dirs(h: string): { run: string; cache: string } {
  const cache = h === 'a01' ? '/home/user/work005k/gapset/cache' : h === 'gozd' ? '/home/user/work005i-a/blind8/cache' : h === 'marcowki' || h === 'rary' ? '/home/user/work005r/corpus/v0/cache' : h === 'ciesz' ? '/home/user/work005l/blind/cache' : '/home/user/work005yn3/analogs/cache'
  const run = ['trytomach', 'arganiach', 'sasankach3'].includes(h) ? `/home/user/work005yn6/prod-r4/an/${h}` : `/home/user/work005yn6/prod-r4/p/${h}`
  return { run, cache }
}
export async function loadHouse(h: string) {
  const { run, cache: cdir } = dirs(h)
  const pkg: SourcePackage = SourcePackageSchema.parse(JSON.parse(readFileSync(join(run, 'source-package.json'), 'utf8')))
  const load = (name: string): any => JSON.parse(existsSync(join(run, `${name}.json`)) ? readFileSync(join(run, `${name}.json`), 'utf8') : gunzipSync(readFileSync(join(run, `${name}.json.gz`))).toString('utf8'))
  const graph = load('observation-graph')
  const metrics = load('metric-evidence')
  const cache = fileByteCache(cdir)
  const rasters = new Map<string, ReturnType<typeof decodeImage> | undefined>()
  for (const asset of pkg.assets) {
    const v = selectedVariant(asset)
    const got = await cache.get(v.url)
    if (!got) continue
    try { rasters.set(v.byteHash, decodeImage(got.bytes)) } catch { rasters.set(v.byteHash, undefined) }
  }
  return { pkg, graph, metrics, rasters, cache }
}
