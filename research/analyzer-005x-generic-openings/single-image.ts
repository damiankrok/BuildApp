/**
 * 005X: one picture -> an indicative model, outside the app (ENGINE_ONLY). Reads a JPEG/PNG, runs the production
 * single-image path of @buildapp/reconstruction, writes the model and the reading OUTSIDE the repository.
 *
 *   npx vite-node research/analyzer-005x-generic-openings/single-image.ts -- <picture> <outDir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { decodeImage } from '@buildapp/source-package'
import { reconstructFromSingleImage } from '@buildapp/reconstruction'

const [picture, outDir] = process.argv.slice(2)
if (!picture || !outDir) throw new Error('usage: single-image.ts <picture> <outDir>')
const REPO = resolve(import.meta.dirname, '../..')
const out = resolve(outDir)
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: outputs never go inside the repository')
mkdirSync(out, { recursive: true })
const bytes = readFileSync(picture)
const raster = decodeImage(new Uint8Array(bytes))
const t0 = Date.now()
const debugLines: string[] = []
const r = reconstructFromSingleImage(raster as never, 'm-photo-' + createHash('sha256').update(bytes).digest('hex').slice(0, 12), { debug: (l) => debugLines.push(l) })
writeFileSync(`${out}/debug.txt`, debugLines.join('\n'))
const ms = Date.now() - t0
if (!r.ok) {
  console.log(JSON.stringify({ ok: false, reason: r.reason, why: r.why, ms }))
  process.exit(0)
}
writeFileSync(`${out}/model.json`, r.modelJson)
writeFileSync(`${out}/reading.json`, JSON.stringify(r.reading, null, 1))
const sha = createHash('sha256').update(r.modelJson).digest('hex')
console.log(JSON.stringify({ ok: true, ms, modelSha256: sha, inputSha256: createHash('sha256').update(bytes).digest('hex'), wall: r.reading.wall, roof: r.reading.roof, openings: r.reading.openings.map((o) => `${o.kind} ${o.along[0].toFixed(2)}..${o.along[1].toFixed(2)} ${o.sillY.toFixed(2)}..${o.headY.toFixed(2)}`), rooflights: r.reading.rooflights.length, fits: r.fits }))
