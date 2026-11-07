/** v3.45: the production content classifier (pixels only) on every annotated image. args: <frames-dir> <views.json...> -> stdout JSON {sha: {top, p}} */
import { readFileSync } from 'node:fs'
import { decodeImage } from '@buildapp/source-package'
import { CONTENT_HEAD, contentProbabilities, contentTensor } from '@buildapp/source-analyzer'
import { inlineImageEmbedder, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
const args = process.argv.filter((a) => a.endsWith('.json') || a.startsWith('/home/user/rd/frames'))
const framesDir = args[0]
const rows = args.slice(1).flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')).rows as Array<{ project: string; sha256: string }>))
const embed = inlineImageEmbedder(workspaceImageRolePaths())
const paths = new Map<string, string>()
for (const p of new Set(rows.map((r) => r.project))) for (const f of JSON.parse(readFileSync(`${framesDir}/${p}.json`, 'utf8')) as Array<{ sha256: string; path: string }>) paths.set(f.sha256, f.path.startsWith('/') ? f.path : `/home/user/rd/${f.path}`)
const out: Record<string, { top: string; p: number }> = {}
const shas = [...new Set(rows.map((r) => r.sha256))]
for (let i = 0; i < shas.length; i += 16) {
  const batch = shas.slice(i, i + 16)
  const tensors = batch.map((s) => contentTensor(decodeImage(new Uint8Array(readFileSync(paths.get(s) as string)))))
  const emb = await embed.embed(tensors)
  batch.forEach((s, k) => {
    const p = contentProbabilities(emb[k])
    let t = 0
    for (let j = 1; j < p.length; j += 1) if (p[j] > p[t]) t = j
    out[s] = { top: CONTENT_HEAD.classes[t], p: Math.round(p[t] * 1e4) / 1e4 }
  })
}
process.stdout.write(JSON.stringify(out))
await embed.release?.()
