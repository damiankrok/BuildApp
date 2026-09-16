/**
 * `npm run overlays -- --package <pkg.json> --graph <graph.json>`
 *
 * §22's visual debugger. One self-contained SVG per registered elevation,
 * with the drawing underneath and the registration drawn on it: every anchor
 * and how far the fit missed it, the region the registration speaks for, and
 * a metric grid ruled across the picture in the drawing's own metres.
 *
 * The grid is the reason to open one. A registration a few per cent out reads
 * perfectly well as a number and is obvious the moment its half-metre ticks
 * are laid over a building whose storeys are three metres: they drift.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { SourcePackageSchema, decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourcePackage } from '@buildapp/source-package'
import { SourceObservationGraphSchema } from '@buildapp/source-observations'
import { drawingCharacter, registrationOverlay } from '@buildapp/image-metrology'
import { metricFrameOf, registerElevationFrames } from '../src/index.js'

const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const packagePath = value(argv, 'package')
  const graphPath = value(argv, 'graph')
  const cacheDir = value(argv, 'cache') ?? join(process.cwd(), '.cache', 'source-bytes')
  const outDir = value(argv, 'out') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'image-metrology')
  if (!packagePath || !graphPath) throw new Error('give --package and --graph')
  await mkdir(outDir, { recursive: true })
  const cache = fileByteCache(cacheDir)

  const pkg: SourcePackage = SourcePackageSchema.parse(JSON.parse(await readFile(packagePath, 'utf8')))
  const graph = SourceObservationGraphSchema.parse(JSON.parse(await readFile(graphPath, 'utf8')))

  const bytesByHash = new Map<string, { bytes: Uint8Array; mediaType: string }>()
  for (const asset of pkg.assets) {
    for (const variant of asset.variants) {
      const got = await cache.get(variant.url)
      if (got) bytesByHash.set(variant.byteHash, got)
    }
  }
  const rasterOf = (variantByteHash: string): ReturnType<typeof decodeImage> | undefined => {
    const got = bytesByHash.get(variantByteHash)
    if (!got) return undefined
    try {
      return decodeImage(got.bytes)
    } catch {
      return undefined
    }
  }

  // The massing the elevations are scaled against, taken from the sealed
  // layout so the overlays show the registration the candidate actually used.
  const layoutPath = value(argv, 'layout') ?? join(process.cwd(), 'stage-reports', 'artifacts', 'reconstruction', 'marcowki-layout.json')
  if (!existsSync(layoutPath)) throw new Error(`no layout at ${layoutPath}; run the reconstruction first`)
  const layout = JSON.parse(await readFile(layoutPath, 'utf8')) as {
    masses: Array<{ ring: { points?: Array<{ x: number; z: number }> } | Array<{ x: number; z: number }> }>
    roofSupports: Array<{ ridgeLevelM?: { value: number } }>
  }
  const points = layout.masses.flatMap((m) => (Array.isArray(m.ring) ? m.ring : (m.ring.points ?? [])))
  const massing = {
    width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    depth: Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z)),
    totalHeight: Math.max(...layout.roofSupports.map((r) => r.ridgeLevelM?.value ?? 0)),
  }

  const { registrations } = registerElevationFrames(graph, massing, undefined, (frame) => rasterOf(frame.variantByteHash))
  const rows: string[] = []
  for (const registration of registrations) {
    const frame = graph.coordinateFrames.find((f) => f.id === registration.frameId)
    if (!frame) continue
    const raster = rasterOf(frame.variantByteHash)
    const bytes = bytesByHash.get(frame.variantByteHash)
    const href = bytes ? `data:${bytes.mediaType};base64,${Buffer.from(bytes.bytes).toString('base64')}` : undefined
    const metric = metricFrameOf(registration)
    const character = raster ? drawingCharacter(raster, registration.extent) : undefined
    const svg = registrationOverlay(metric, {
      imageHref: href,
      width: frame.size.width,
      height: frame.size.height,
      gridM: 0.5,
      title: `${registration.side ?? 'unplaced'} — ${frame.assetId}`,
    })
    const side = String(registration.side ?? 'unplaced')
    const name = `elevation-${side.toLowerCase()}-${frame.id.slice(-8)}.svg`
    await writeFile(join(outDir, name), `${svg}\n`, 'utf8')
    rows.push(
      `| ${side} | ${frame.assetId.slice(-22)} | ${frame.size.width}×${frame.size.height} | ${character?.kind ?? '?'} | ` +
        `${registration.extent.x0}, ${registration.extent.y0} – ${registration.extent.x1}, ${registration.extent.y1} | ` +
        `${(registration.metresPerPixelU * 1000).toFixed(2)} / ${(registration.metresPerPixelV * 1000).toFixed(2)} | ${metric.metricResidualM.toFixed(4)} | ${metric.uncertainty.anchorMaxM.toFixed(4)} | ${metric.status} | ${name} |`,
    )
    process.stdout.write(`${side.padEnd(6)} ${name}  ${character?.kind ?? '?'}  rms ${metric.metricResidualM.toFixed(4)} m  ${metric.status}\n`)
  }
  const table = [
    '| view | asset | pixels | content | architectural bounds | mm/px across, up | rms | worst | status | overlay |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
  await writeFile(join(outDir, 'REGISTRATIONS.md'), `# Registered elevations\n\n${table}\n`, 'utf8')
  process.stdout.write(`\nwrote ${rows.length} overlays and REGISTRATIONS.md to ${outDir}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
