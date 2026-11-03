/**
 * SOURCE-01 (research): every dataset image through the PRODUCTION path — `decodeImage` → `contentTensor` → the pinned
 * ONNX encoder on ONNX Runtime Web — so the head is fitted on exactly what the app computes. Output outside the repo.
 *   npx vite-node research/analyzer-source-01/embed.ts -- <dataset.json> <out.bin>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeImage } from '@buildapp/source-package'
import { contentTensor } from '@buildapp/source-analyzer'
import { inlineImageEmbedder, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'

const [ds, out] = process.argv.slice(2).filter((a) => a !== '--')
if (resolve(out).startsWith(resolve('.'))) throw new Error('REFUSED: embeddings stay outside the repository')
const rows = JSON.parse(readFileSync(ds, 'utf8')).rows as Array<{ sha256: string; path: string }>
const embedder = inlineImageEmbedder(workspaceImageRolePaths())
const all = new Float32Array(rows.length * 1280)
const t0 = performance.now()
let tensorMs = 0
for (const [i, r] of rows.entries()) {
  const t = performance.now()
  const tensor = contentTensor(decodeImage(new Uint8Array(readFileSync(r.path))))
  tensorMs += performance.now() - t
  const [e] = await embedder.embed([tensor])
  all.set(e, i * 1280)
  if (i % 100 === 0) process.stderr.write(`${i}/${rows.length}\n`)
}
writeFileSync(out, Buffer.from(all.buffer))
writeFileSync(`${out}.json`, JSON.stringify({ sha256: rows.map((r) => r.sha256), dims: 1280, ms: Math.round(performance.now() - t0), tensorMs: Math.round(tensorMs), stats: embedder.stats() }))
await embedder.release()
console.log(`embedded ${rows.length} in ${Math.round(performance.now() - t0)} ms (decode+tensor ${Math.round(tensorMs)} ms)`)
