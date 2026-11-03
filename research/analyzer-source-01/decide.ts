/**
 * SOURCE-01 (research): the production content decision for every asset of a directory of SourcePackages —
 * `decodeImage` → `contentTensor` → the pinned encoder → `contentProbabilities` → `contentVerdict` — for the
 * publisher's own roles, and (`--adversarial`) for every wrong role a caption could have given each labelled image.
 *   npx vite-node research/analyzer-source-01/decide.ts -- <pkg-dir> <cache-dir> <out.json> [--adversarial]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decodeImage, fileByteCache } from '@buildapp/source-package'
import type { SourceRoles } from '@buildapp/source-package'
import { contentProbabilities, contentTensor, contentVerdict } from '@buildapp/source-analyzer'
import { inlineImageEmbedder, workspaceImageRolePaths } from '@buildapp/numeric-recogniser-ort'
// @ts-expect-error plain ESM helper
import { assetsOf } from './assets-of.mjs'

const args = process.argv.slice(2).filter((a) => a !== '--')
const [dir, cacheDir, out] = args
const adversarial = args.includes('--adversarial')
const cache = fileByteCache(cacheDir)
const embedder = inlineImageEmbedder(workspaceImageRolePaths())
const rows = assetsOf(dir) as Array<{ house: string; assetId: string; sha256: string; url: string; roles: SourceRoles }>
const CLAIMS: SourceRoles[] = [
  { document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'UNKNOWN', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' },
  { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'UNKNOWN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' },
  { document: 'SECTION', storey: 'NOT_APPLICABLE', annotation: 'UNKNOWN', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_SECTION' },
  { document: 'SITE_PLAN', storey: 'NOT_APPLICABLE', annotation: 'UNKNOWN', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' },
  { document: 'PERSPECTIVE_RENDER', storey: 'NOT_APPLICABLE', annotation: 'UNKNOWN', view: 'UNKNOWN', projection: 'PERSPECTIVE' },
]
const decisions: unknown[] = []
const t0 = performance.now()
for (const r of rows) {
  const got = await cache.get(r.url)
  if (!got) continue
  const [e] = await embedder.embed([contentTensor(decodeImage(got.bytes))])
  const p = contentProbabilities(e)
  const v = contentVerdict(r.assetId, r.roles, p)
  decisions.push({ house: r.house, sha256: r.sha256, assetId: r.assetId, claimed: r.roles.document, use: v.use, claimedUse: v.claimedUse, decision: v.decision, top: v.top, topProbability: v.topProbability, projection: v.projection, why: v.why, probabilities: v.probabilities })
  if (adversarial) for (const c of CLAIMS) {
    const a = contentVerdict(r.assetId, c, p)
    decisions.push({ house: r.house, sha256: r.sha256, assetId: r.assetId, adversarialClaim: c.document, claimedUse: a.claimedUse, use: a.use, decision: a.decision, top: a.top, topProbability: a.topProbability })
  }
}
await embedder.release()
if (resolve(out).startsWith(resolve('.')) && !resolve(out).includes('stage-reports')) throw new Error('REFUSED')
writeFileSync(out, `${JSON.stringify(decisions, null, 1)}\n`)
console.log(`${rows.length} assets in ${Math.round(performance.now() - t0)} ms`)
