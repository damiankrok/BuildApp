/**
 * v3.54.4 — the source pictures a board shows, written OUTSIDE the repository (publishers' pictures are private).
 *   npx vite-node research/source-to-model/v3544/export-sources.ts -- --list <list> --runs <house-run root> --out <private dir>
 * For each house: the ground plan, the elevations and one section that the recorded inventory named, as JPEG files
 * `<out>/<house>/<n>-<kind>.jpg`. Nothing is sent anywhere.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, fileByteCache, startDecoders } from '@buildapp/source-package'
import { housePictures, sentPicture } from '../../../packages/analysis-service/src/house/pictures.js'

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
await startDecoders()
for (const line of readFileSync(arg('list') as string, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) {
  const [house, pkgPath, cache] = line.split(/\s+/)
  const inv = join(arg('runs') as string, house, 'answers', 'INVENTORY.json')
  if (!existsSync(inv)) continue
  const answer = (JSON.parse(readFileSync(inv, 'utf8')) as { answer: { pictures: Array<{ n: number; kind: string; storey: string; side: string; thisHouse: boolean }> } }).answer
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(pkgPath, 'utf8')))
  const { pictures } = await housePictures(pkg.assets as never, fileByteCache(cache))
  const out = join(arg('out') as string, house)
  mkdirSync(out, { recursive: true })
  const wanted = answer.pictures.filter((p) => p.thisHouse && ((p.kind === 'FLOOR_PLAN' && p.storey === 'GROUND') || p.kind === 'ELEVATION' || p.kind === 'SECTION'))
  const order = (k: string): number => (k === 'FLOOR_PLAN' ? 0 : k === 'ELEVATION' ? 1 : 2)
  let sections = 0
  let plans = 0
  for (const p of wanted.sort((a, b) => order(a.kind) - order(b.kind) || a.n - b.n)) {
    if (p.kind === 'SECTION' && (sections += 1) > 1) continue
    if (p.kind === 'FLOOR_PLAN' && (plans += 1) > 1) continue
    const pic = pictures[p.n - 1]
    if (!pic) continue
    writeFileSync(join(out, `${String(order(p.kind))}${String(p.n).padStart(2, '0')}-${p.kind.toLowerCase()}-${p.side.toLowerCase()}.jpg`), Buffer.from(sentPicture(pic, 'context').jpegBase64, 'base64'))
  }
  process.stdout.write(`${house}: ${wanted.length} pictures\n`)
}
