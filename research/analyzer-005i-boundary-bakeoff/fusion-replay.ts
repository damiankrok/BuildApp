/**
 * fusion-replay.ts — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Run from the snapshot.
 *
 *   npx vite-node research/analyzer-005i-boundary-bakeoff/fusion-replay.ts -- --set real|synthetic [--work /home/user/work005i]
 *
 * The production boundary resolver takes no external observation: its only image input is the ink Mask. This replay
 * uses that one data input as the probe — mask' = mask ∪ (provider line segments rasterised 1 px wide) — and re-runs
 * the same production boundary layer (decomposePlan → boundaryExtension) with identical bands, chains, registration,
 * extent and options. A 1-px line can never become wall-thick ink, so the only thing that can change is what the
 * resolver reads DRAWN ACROSS a gap (gap strokes → signature → class → bridging → outline). Out-of-contract input
 * perturbation, labelled as such; not a seam. Configurations are fixed lists below; nothing is tuned per provider or
 * per house, and combinations are run after the individual ones.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import type { Mask } from '@buildapp/source-cv'
import type { SourceObservationGraph } from '@buildapp/source-observations'
import type { MetricEvidenceSet } from '@buildapp/source-metrics'
import { boundaryExtension, decomposePlan, exteriorTicksOf, extentSidesOf, planCallouts, planExtent, planSheet } from '@buildapp/reconstruction'
import { r3, sha256 } from './baseline.js'

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const HERE = new URL('.', import.meta.url).pathname

type Seg = { a: [number, number]; b: [number, number] }
const CONFIGS: Array<{ id: string; files: string[] }> = [
  { id: 'BASELINE', files: [] },
  { id: '+ELSED', files: ['elsed/{set}/{id}.json'] },
  { id: '+DEEPLSD-MD', files: ['deeplsd/{set}/{id}.md.json'] },
  { id: '+DEEPLSD-WF', files: ['deeplsd/{set}/{id}.wf.json'] },
  { id: '+DEEPLSD-MD-REFINE-SCV', files: ['deeplsd/{set}/{id}.md-refine-scv.json'] },
  { id: '+ELSED+DEEPLSD-MD', files: ['elsed/{set}/{id}.json', 'deeplsd/{set}/{id}.md.json'] },
  // CONTROL: BuildPlan's own SCV-LINES rasterised the same way — no external information at all. Whatever this
  // changes is the perturbation's effect, not new evidence.
  { id: '+SCV-LINES-CONTROL', files: ['source-cv/{set}/{id}.json'] },
]

function rasterise(mask: Mask, segs: readonly Seg[]): Mask {
  const out = { width: mask.width, height: mask.height, data: new Uint8Array(mask.data) }
  for (const s of segs) {
    const [x0, y0] = s.a
    const [x1, y1] = s.b
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2))
    for (let k = 0; k <= n; k += 1) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n)
      const y = Math.round(y0 + ((y1 - y0) * k) / n)
      if (x >= 0 && y >= 0 && x < out.width && y < out.height) out.data[y * out.width + x] = 1
    }
  }
  return out
}

function decodeRgbaPng(file: string): { width: number; height: number; data: Uint8ClampedArray } {
  const png = PNG.sync.read(readFileSync(file))
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }
}

async function main(): Promise<void> {
  const work = arg('work') ?? '/home/user/work005i'
  const set = arg('set') ?? 'real'
  const framesDir = join(work, 'frames', set)
  const outDir = join(work, 'fusion', set)
  mkdirSync(outDir, { recursive: true })
  const metas = (await import('node:fs')).readdirSync(framesDir).filter((f) => f.endsWith('.meta.json'))
  const houses = set === 'real' ? (JSON.parse(readFileSync(join(HERE, 'houses.json'), 'utf8')) as { houses: Array<{ id: string; run: string }> }).houses : []
  for (const m of metas.sort()) {
    const id = m.replace(/\.meta\.json$/, '')
    const meta = JSON.parse(readFileSync(join(framesDir, m), 'utf8')) as { frameId: string; oracle?: { scaleMetresPerPx: number } }
    // The decoded frame (the very pixels every provider saw): RGBA as the production decoder returned it.
    const rgbFile = join(framesDir, `${id}.rgb.png`)
    const raster = decodeRgbaPng(rgbFile)
    // Same-input record (post-review B5): the frame bytes and every observation file this replay reads, by hash;
    // score.py asserts them against the frame meta and the current observation files.
    const input: { rgbPngSha256: string; observationFiles: Record<string, string> } = { rgbPngSha256: sha256(readFileSync(rgbFile)), observationFiles: {} }
    const sheet = planSheet({ id: meta.frameId } as never, { raster: () => raster } as never)
    if (!sheet) continue
    const { mask, bands, wallPx } = sheet
    let inputs: { chains: never[] | Parameters<typeof decomposePlan>[1]; registration: Parameters<typeof decomposePlan>[3]; extent: { x0: number; y0: number; x1: number; y1: number }; options: NonNullable<Parameters<typeof decomposePlan>[5]> } | null = null
    if (set === 'real') {
      const house = houses.find((h) => h.id === id)
      if (!house) continue
      const metrics = JSON.parse(readFileSync(join(house.run, 'metric-evidence.json'), 'utf8')) as MetricEvidenceSet
      const chains = metrics.chains.filter((c) => c.frameId === meta.frameId)
      const registration = metrics.coordinateRegistrations.find((r) => r.frameId === meta.frameId && r.plane === 'PLAN_XZ')
      const extent = planExtent(chains, bands, wallPx, sheet.witness, metrics.dimensionObservations?.filter((o) => o.frameId === meta.frameId))
      if (extent && registration) inputs = { chains, registration, extent: extent.rect, options: { callouts: planCallouts(metrics, meta.frameId), sheetWallPx: wallPx, exteriorTicks: exteriorTicksOf(chains, extent.roles), extentSides: extentSidesOf(chains, extent, wallPx) } }
      void (null as unknown as SourceObservationGraph)
    } else if (meta.oracle) {
      // synthetic: the production plan extent with no chains (wall witness), as extract-synthetic.ts; ORACLE SCALE only
      const mpp = meta.oracle.scaleMetresPerPx
      const e = planExtent([], bands, wallPx, sheet.witness, [])
      const registration = { id: 'oracle-scale', frameId: meta.frameId, assetId: 'a', variantByteHash: '0'.repeat(64), plane: 'PLAN_XZ', metresPerPixelX: mpp, metresPerPixelY: mpp, anisotropy: 1, originPx: { x: 0, y: 0 }, flipX: false, flipY: true, anchors: [], rejected: [], residual: { rmsM: 0, maxM: 0, rmsPx: 0 }, confidence: 1, provenance: { extractor: 'REGISTRATION', name: 'research-oracle-scale', detail: 'synthetic' } }
      if (e) inputs = { chains: [], registration: registration as never, extent: e.rect, options: { callouts: [], sheetWallPx: wallPx } }
    }
    if (!inputs) continue
    const results: Record<string, unknown> = {}
    for (const cfg of CONFIGS) {
      const segs: Seg[] = []
      let missing = false
      for (const f of cfg.files) {
        const p = join(work, 'obs', f.replace('{set}', set).replace('{id}', id))
        if (!existsSync(p)) {
          missing = true
          continue
        }
        const bytes = readFileSync(p)
        input.observationFiles[f.replace('{set}', set).replace('{id}', id)] = sha256(bytes)
        const d = JSON.parse(bytes.toString('utf8')) as { observations: Array<{ geometry: { type: string; a: [number, number]; b: [number, number] } }> }
        for (const o of d.observations as Array<{ configId?: string; geometry: { type: string; a: [number, number]; b: [number, number] } }>) {
          if (o.geometry?.type !== 'SEGMENT') continue
          if (f.startsWith('source-cv/') && o.configId !== 'SCV-LINES') continue
          segs.push({ a: o.geometry.a, b: o.geometry.b })
        }
      }
      if (missing) {
        results[cfg.id] = { missingProviderOutput: true }
        continue
      }
      const m2 = cfg.files.length === 0 ? mask : rasterise(mask, segs)
      try {
        const incumbent = decomposePlan(m2, inputs.chains as never, bands, inputs.registration, inputs.extent, { ...inputs.options, openingAware: false })
        const ext = boundaryExtension(m2, bands, inputs.registration, inputs.extent, incumbent, inputs.options, inputs.chains as never)
        const full = decomposePlan(m2, inputs.chains as never, bands, inputs.registration, inputs.extent, inputs.options)
        const lx = ext.lines.x
        const ly = ext.lines.y
        const cells: number[][] = []
        for (let iy = 0; iy < ext.outline.ny; iy += 1) for (let ix = 0; ix < ext.outline.nx; ix += 1) if (ext.outline.inside[iy * ext.outline.nx + ix] === 1) cells.push([r3(lx[ix]), r3(ly[iy]), r3(lx[ix + 1]), r3(ly[iy + 1])])
        const gaps = [...ext.walls.x, ...ext.walls.y].flatMap((l) => l.gaps.map((g) => ({ id: g.id, axis: g.axis, linePx: r3(g.linePx), fromPx: r3(g.fromPx), toPx: r3(g.toPx), cls: g.cls, boundary: g.boundary, signature: g.signature })))
        const pieces = [...ext.walls.x, ...ext.walls.y].flatMap((l) => l.pieces.filter((pc) => pc.along).map((pc) => (l.axis === 'X' ? [r3(l.px), r3(pc.from), r3(l.px), r3(pc.to)] : [r3(pc.from), r3(l.px), r3(pc.to), r3(l.px)])))
        results[cfg.id] = {
          addedSegments: segs.length,
          pieces,
          gapTallies: ext.record.gaps,
          bridged: ext.record.bridged,
          outlineAccepted: ext.record.accepted,
          outlineCells: cells,
          builtCells: full.cells.filter((c) => c.classification === 'BUILT').map((c) => [r3(c.rect.x0), r3(c.rect.y0), r3(c.rect.x1), r3(c.rect.y1)]),
          gaps,
          bodies: ext.record.bodies.map((b) => ({ relation: b.relation, built: b.built, rect: b.rect })),
        }
      } catch (e) {
        results[cfg.id] = { error: String((e as Error).message) }
      }
    }
    writeFileSync(join(outDir, `${id}.json`), JSON.stringify({ researchOnly: true, id, frameId: meta.frameId, wallPx, input, results }))
    console.log(`${set}/${id}: ${Object.entries(results).map(([k, v]) => `${k}=${JSON.stringify((v as { gapTallies?: unknown }).gapTallies ?? v)}`).join(' ').slice(0, 400)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
