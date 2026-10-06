/**
 * bands.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005J). Never imported by production code.
 *
 *   npx vite-node research/analyzer-005j/bands.ts -- --dir <renders dir> --out <bands.json>
 *
 * The SEMANTIC_OVERLAY mode of the Visual Referee bake-off shows a model what the analyzer already derived. For the
 * synthetic renders that is the production plan sheet's wall bands (`planSheet`: adaptive ink mask, run-length bands
 * at the sheet's own wall thickness) on exactly the rendered pixels, read-only — the same layer the 005I bake-off
 * normalised as `SCV-WALL`. Nothing here knows a scene's semantics: a terrace kerb thick enough to be a band is a
 * band, as it would be for the analyzer.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import type { Raster } from '@buildapp/source-cv'
import { planSheet } from '@buildapp/reconstruction'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const dir = arg('dir')
  const out = arg('out')
  if (!dir || !out) throw new Error('--dir and --out are required')
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
  const result: Record<string, unknown> = {}
  for (const f of files) {
    const png = PNG.sync.read(readFileSync(join(dir, f)))
    const raster: Raster = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }
    const sheet = planSheet({ id: f } as unknown as Parameters<typeof planSheet>[0], { raster: () => raster } as unknown as Parameters<typeof planSheet>[1])
    result[f] = sheet
      ? {
          wallPx: sheet.wallPx,
          bands: sheet.bands.map((b) => ({ axis: b.axis, axisPx: b.axisPx, thickness: b.thickness, bounds: b.bounds })),
        }
      : { wallPx: null, bands: [] }
  }
  writeFileSync(out, JSON.stringify({ researchOnly: 'BUILDPLAN-ANALYZER-005J', layer: 'production planSheet wall bands (read-only)', files: result }))
  process.stdout.write(`${files.length} renders → ${out}\n`)
}

main()
