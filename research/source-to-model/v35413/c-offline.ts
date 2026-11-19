/**
 * v3.54.13 — C-offline: the geometry and every metric property of a base LOCAL model read on the ORIGINAL sources,
 * with the finish outlines the OWNER's ready sketches carry, read by the local sketch reader and applied by the
 * appearance consumer. No request is sent (0 USD); the sketches are an OWNER's preparation, not an automated step.
 *
 *   npx vite-node research/source-to-model/v35413/c-offline.ts -- --base <model.json> --alignment <facade-alignment.json>
 *     --out <dir> --side FRONT=<sketch.png>,<registration.json>,<sourceByteHash>,<sourceW>x<sourceH> [--side REAR=…]
 *     [--hue-shift <deg>] [--label C-offline]
 *
 * `registration.json` is register-sketch.py's: its affine (sketch px → source px) is fitted on building anchors (ground
 * ends, corners, ridge apex, frame breaks) located on both images; its residuals are written into the observation.
 * Outputs (all outside Git): observations.json, model.json, trace.json, scene.json, readings.json (cluster names).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { parseModel, serializeModel } from '@buildapp/model'
import { compileBuilding } from '@buildapp/geometry'
import { buildMobileSceneBundle, serializeBundle } from '@buildapp/mobile-scene'
import { stableJson } from '@buildapp/source-common'
import { APPEARANCE_OBSERVATION_SCHEMA, APPEARANCE_OBSERVATION_VERSION, SKETCH_READER_VERSION, applyAppearance, readSketch } from '../../../packages/analysis-service/src/appearance/index.js'
import type { AppearanceObservation, ElevationProjection } from '../../../packages/analysis-service/src/appearance/index.js'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const all = (n: string): string[] => argv.flatMap((a, i) => (a === `--${n}` ? [argv[i + 1]] : []))
const out = opt('out') as string
mkdirSync(out, { recursive: true })
const label = opt('label') ?? 'C-offline'
const hueShift = Number(opt('hue-shift') ?? 0)
const base = parseModel(readFileSync(opt('base') as string, 'utf8'))
const alignment = JSON.parse(readFileSync(opt('alignment') as string, 'utf8')) as { views: Array<{ facade: string; frameId: string; projection: ElevationProjection }> }

function shiftHue(png: PNG, deg: number): void {
  if (!deg) return
  const c = Math.cos((deg * Math.PI) / 180)
  const s = Math.sin((deg * Math.PI) / 180)
  // rotation about the grey axis (luminance-preserving hue rotation)
  const m = [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ]
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]
    const g = png.data[i + 1]
    const b = png.data[i + 2]
    for (let k = 0; k < 3; k++) png.data[i + k] = Math.max(0, Math.min(255, Math.round(m[k][0] * r + m[k][1] * g + m[k][2] * b)))
  }
}

const observations: AppearanceObservation[] = []
const readings: Record<string, unknown> = {}
const projOf = new Map<string, ElevationProjection>()
for (const spec of all('side')) {
  const [facade, rest] = spec.split('=')
  const [sketchPath, regPath, sourceByteHash, size] = rest.split(',')
  const [sw, sh] = size.split('x').map(Number)
  const bytes = readFileSync(sketchPath)
  const png = PNG.sync.read(bytes)
  shiftHue(png, hueShift)
  const t0 = performance.now()
  const reading = readSketch({ width: png.width, height: png.height, data: png.data })
  const ms = Math.round(performance.now() - t0)
  const reg = JSON.parse(readFileSync(regPath, 'utf8')) as { affine: { matrix: [[number, number, number], [number, number, number]] }; pairs: Array<{ name: string; kind: string; residualAffinePx: number }>; verdict: string }
  const anchors = reg.pairs.filter((p) => p.kind === 'ANCHOR')
  const view = alignment.views.find((v) => v.facade === facade)
  if (!view) throw new Error(`no ${facade} view in the alignment`)
  projOf.set(`${facade}|${sourceByteHash}`, view.projection)
  const obs: AppearanceObservation = {
    schema: APPEARANCE_OBSERVATION_SCHEMA,
    schemaVersion: APPEARANCE_OBSERVATION_VERSION,
    observationId: `${label.toLowerCase()}-${facade.toLowerCase()}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}${hueShift ? `-hue${hueShift}` : ''}`,
    facade: facade as AppearanceObservation['facade'],
    source: { sourceByteHash, imageSha256: createHash('sha256').update(bytes).digest('hex'), imageWidth: png.width, imageHeight: png.height, sourceWidth: sw, sourceHeight: sh },
    toSource: reg.affine.matrix,
    toSourceWhy: `affine fitted on ${anchors.length} building anchors located on both images (v3.54.12 register-sketch points, located by hand); registration verdict ${reg.verdict}; anchor residuals ${anchors.map((a) => a.residualAffinePx.toFixed(1)).join(', ')} px`,
    toSourceResidualPx: Math.max(0, ...anchors.map((a) => a.residualAffinePx)),
    regions: reading.regions,
    producer: { kind: 'LOCAL_SKETCH_SEGMENTATION', version: SKETCH_READER_VERSION },
  }
  observations.push(obs)
  readings[facade] = { clusters: reading.clusters, regions: reading.regions.map((r) => ({ regionId: r.regionId, class: r.class, corners: r.outline.length })), readMs: ms }
}
// --observations <file>: apply an observation set as given (a stored reading replayed, or a counter-trial edited by hand)
const given = opt('observations')
if (given) {
  const set = JSON.parse(readFileSync(given, 'utf8')) as AppearanceObservation[]
  observations.push(...set)
  for (const o of set) {
    const view = alignment.views.find((v) => v.facade === o.facade)
    if (view) projOf.set(`${o.facade}|${o.source.sourceByteHash}`, view.projection)
  }
}
writeFileSync(join(out, 'observations.json'), `${stableJson(observations)}\n`)
writeFileSync(join(out, 'readings.json'), `${stableJson(readings)}\n`)
const r = applyAppearance(base, observations, (f, h) => projOf.get(`${f}|${h}`))
writeFileSync(join(out, 'model.json'), serializeModel(r.model))
writeFileSync(join(out, 'trace.json'), `${stableJson({ traces: r.traces, fingerprintBefore: r.fingerprintBefore, fingerprintAfter: r.fingerprintAfter })}\n`)
const scene = compileBuilding(r.model)
writeFileSync(join(out, 'scene.json'), serializeBundle(buildMobileSceneBundle(r.model, { scene })))
const sha = createHash('sha256').update(serializeModel(r.model)).digest('hex')
process.stdout.write(`${label}: model ${sha.slice(0, 16)}, fingerprint ${r.fingerprintAfter.slice(0, 16)} (unchanged), ${r.traces.map((t) => `${t.facade.toLowerCase()} +${t.added.length} −${t.removed.length}`).join(', ')}, diagnostics ${scene.diagnostics.length}\n`)
for (const t of r.traces) for (const a of t.added) process.stdout.write(`  ${a.regionId} ${a.class} ${a.areaM2} m² ${a.corners} corners\n`)
