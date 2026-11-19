/**
 * v3.54.16 §7 — the product's no-model sketches (`sketchesWithoutModel` of a run whose LOCAL built nothing) laid out as
 * a sketch-only directory for the delivery assembler: <SIDE>.{png,svg,json}, raw/<SIDE>.json, summary.json. Drawn by the
 * product's own renderer; nothing is read again and nothing is checked (UNCHECKED, as the run recorded).
 *   npx vite-node research/source-to-model/v35416/sketch-only-dir.ts -- <run dir> <package.json> <out dir> <house>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSketchPng, renderSketchSvg } from '../../../packages/analysis-service/src/appearance/elevation-sketch.js'
import { frameId } from '../../../packages/source-observations/src/ids.js'

const [run, pkgPath, out, house] = process.argv.slice(2).filter((a) => a !== '--')
const SIDE: Record<string, string> = { FRONT: 'FRONT', REAR: 'REAR', WEST: 'LEFT', EAST: 'RIGHT' }
const s = JSON.parse(readFileSync(join(run, 'sketches-without-model.json'), 'utf8')) as { sides: Array<{ facade: string; frameId: string; status: string; why: string }>; sketches: Array<{ facade: string; frameId: string; raw: unknown; sketch: never }> }
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { assets: Array<{ id: string; variants: Array<{ byteHash: string; width?: number; height?: number }> }> }
mkdirSync(join(out, 'raw'), { recursive: true })
const summary: Array<Record<string, unknown>> = []
for (const side of ['FRONT', 'RIGHT', 'REAR', 'LEFT']) {
  const facade = Object.keys(SIDE).find((f) => SIDE[f] === side) as string
  const x = s.sketches.find((e) => e.facade === facade && e.sketch)
  const note = s.sides.find((e) => e.facade === facade)
  if (!x) { summary.push({ side, status: note ? 'FAILED' : 'MISSING_SOURCE', why: note?.why ?? 'no elevation of this side in the source' }); continue }
  // the frame id is the product's stable id of (asset, variant): the variant is found by recomputing it, never guessed
  const hit = pkg.assets.flatMap((a) => a.variants.map((v) => ({ a, v }))).find(({ a, v }) => frameId(a.id, v.byteHash) === x.frameId)
  const asset = hit?.a
  const variant = hit?.v
  writeFileSync(join(out, 'raw', `${side}.json`), `${JSON.stringify(x.raw ?? null, null, 1)}\n`)
  writeFileSync(join(out, `${side}.png`), renderSketchPng(x.sketch))
  writeFileSync(join(out, `${side}.svg`), renderSketchSvg(x.sketch))
  writeFileSync(join(out, `${side}.json`), `${JSON.stringify({ sketch: x.sketch, check: null, verdict: 'UNCHECKED', why: note?.why }, null, 1)}\n`)
  summary.push({ side, status: 'UNCHECKED', assetId: asset?.id ?? x.frameId, sourceByteHash: variant?.byteHash ?? null, sideNote: facade === 'WEST' || facade === 'EAST' ? `side read from the run's own facade ${facade}` : undefined })
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ house, summary }, null, 1)}\n`)
console.log(house, summary.map((e) => `${e.side}:${e.status}`).join(' '))
