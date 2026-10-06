/**
 * extract-frames.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005J). Never imported by production code.
 *
 *   npx vite-node research/analyzer-005j/extract-frames.ts -- --work /home/user/work005j
 *
 * Decodes the ground-plan frame the production run selected for each development house listed in `real-houses.json`
 * that has no frame in the 005I bake-off yet (the blind-8 houses, now development evidence), with the PRODUCTION
 * decoder, read-only. The bytes come from the sealed offline byte cache and are checked against the package's byte
 * hash. Pixels are written OUTSIDE the repository (`$WORK/frames/<house>.rgb.png`); only text facts (ids, hashes,
 * sizes) are printed for the stage record.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { SourcePackageSchema, decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourceObservationGraph } from '@buildapp/source-observations'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const HERE = new URL('.', import.meta.url).pathname

type House = { id: string; package: string; packageSha256: string; cache: string; run: string; source: string }

async function main(): Promise<void> {
  const work = arg('work') ?? '/home/user/work005j'
  const houses = (JSON.parse(readFileSync(join(HERE, 'real-houses.json'), 'utf8')) as { decode: House[] }).decode
  const out = join(work, 'frames')
  mkdirSync(out, { recursive: true })
  const facts: unknown[] = []
  for (const house of houses) {
    const pkgBytes = readFileSync(house.package)
    if (sha256(pkgBytes) !== house.packageSha256) throw new Error(`package hash mismatch for ${house.id}`)
    const pkg = SourcePackageSchema.parse(JSON.parse(pkgBytes.toString('utf8')))
    const graph = JSON.parse(readFileSync(join(house.run, 'observation-graph.json'), 'utf8')) as SourceObservationGraph
    const planFrame = JSON.parse(readFileSync(join(house.run, 'evidence-pack', '03-plan-frame.json'), 'utf8')) as { selectedPlanFrameId: string }
    const frame = graph.coordinateFrames.find((f) => f.id === planFrame.selectedPlanFrameId)
    if (!frame) throw new Error(`no selected plan frame for ${house.id}`)
    const variant = pkg.assets.flatMap((a) => a.variants).find((v) => v.byteHash === frame.variantByteHash)
    if (!variant) throw new Error('frame variant not in package')
    const got = await fileByteCache(house.cache).get(variant.url)
    if (!got) throw new Error(`offline cache has no bytes for ${variant.url}`)
    const byteSha = sha256(got.bytes)
    if (byteSha !== variant.byteHash) throw new Error(`byte hash mismatch ${byteSha} != ${variant.byteHash}`)
    const raster = decodeImage(got.bytes)
    const png = new PNG({ width: raster.width, height: raster.height })
    png.data = Buffer.from(raster.data)
    const file = join(out, `${house.id}.rgb.png`)
    writeFileSync(file, PNG.sync.write(png))
    facts.push({
      house: house.id,
      source: house.source,
      frameId: frame.id,
      storey: frame.roles.storey,
      variantUrl: variant.url,
      byteSha256: byteSha,
      decoded: { width: raster.width, height: raster.height, rgbaSha256: sha256(raster.data) },
    })
  }
  writeFileSync(join(out, 'frames-005j.json'), JSON.stringify(facts, null, 1))
  process.stdout.write(`${JSON.stringify(facts, null, 1)}\n`)
}

main().catch((e) => {
  process.stderr.write(`${(e as Error).stack}\n`)
  process.exit(1)
})
