/**
 * repro-sidesof.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B, council B4). Run from the snapshot.
 *
 *   npx vite-node research/analyzer-005i-boundary-bakeoff/repro-sidesof.ts -- [--work /home/user/work005i] [--case double-line-walls]
 *
 * Reproduces, with a retained log, the side finding first seen in the superseded pre-E6 synthetic run: given an extent
 * and a scale but a sheet with no wall-thick ink, does the production boundary layer throw? The production code is
 * imported read-only and is not modified. Two extents are tried on the same decoded pixels:
 *   A. INK_BBOX — the bounding box of the production adaptive ink mask (a pixel-derived extent; no truth);
 *   B. ORACLE_TRUTH_BBOX — the bounding box of the truth outer faces, the extent the superseded pre-E6 run used
 *      (labelled ORACLE; only to reproduce that observation, never an input to any score).
 * Scale: the generator's metres per pixel (ORACLE SCALE), as in extract-synthetic.ts. Prints one JSON line per extent.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { planExtent, planSheet } from '@buildapp/reconstruction'
import { baselineObservations, sha256 } from './baseline.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function main(): void {
  const work = arg('work') ?? '/home/user/work005i'
  const id = arg('case') ?? 'double-line-walls'
  const pngFile = join(work, 'frames', 'synthetic', `${id}.rgb.png`)
  const bytes = readFileSync(pngFile)
  const png = PNG.sync.read(bytes)
  const raster = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }
  const truth = JSON.parse(readFileSync(join(work, 'synth', `${id}.truth.json`), 'utf8')) as { metresPerPx: number; exterior: Array<[number, number]> }
  const frameId = `synthetic-${id}`
  const sheet = planSheet({ id: frameId } as never, { raster: () => raster } as never)
  if (!sheet) throw new Error('planSheet returned null')
  const prodExtent = planExtent([], sheet.bands, sheet.wallPx, sheet.witness as never, [])
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let y = 0; y < sheet.mask.height; y += 1)
    for (let x = 0; x < sheet.mask.width; x += 1)
      if (sheet.mask.data[y * sheet.mask.width + x]) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x + 1)
        y1 = Math.max(y1, y + 1)
      }
  const xs = truth.exterior.map((p) => p[0])
  const ys = truth.exterior.map((p) => p[1])
  const extents: Array<[string, { x0: number; y0: number; x1: number; y1: number }]> = [
    ['INK_BBOX', { x0, y0, x1, y1 }],
    ['ORACLE_TRUTH_BBOX', { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }],
  ]
  const mpp = truth.metresPerPx
  const registration = { id: `registration-oracle-${id}`, frameId, assetId: `asset-${id}`, variantByteHash: '0'.repeat(64), plane: 'PLAN_XZ', metresPerPixelX: mpp, metresPerPixelY: mpp, anisotropy: 1, originPx: { x: 0, y: 0 }, flipX: false, flipY: true, anchors: [], rejected: [], residual: { rmsM: 0, maxM: 0, rmsPx: 0 }, confidence: 1, provenance: { extractor: 'REGISTRATION', name: 'research-oracle', detail: 'BUILDPLAN-ANALYZER-005I B4 reproduction: the generator scale, given' } }
  console.log(JSON.stringify({ researchOnly: true, case: id, frame: pngFile, rgbPngSha256: sha256(bytes), wallPx: sheet.wallPx, bands: sheet.bands.length, productionPlanExtent: prodExtent ? prodExtent.rect : null }))
  for (const [label, extent] of extents) {
    const res = baselineObservations({ frameId, raster: raster as never, snapshotSha: 'repro', boundary: { chains: [] as never, registration: registration as never, extent, options: { callouts: [], sheetWallPx: sheet.wallPx } } })
    console.log(JSON.stringify({ extentKind: label, extent, boundary: res.boundary }))
  }
}

main()
