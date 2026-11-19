/**
 * v3.54.13 — B-guarded: the v3.54.12 sketch run (B-both) arbitrated property by property against the accepted base
 * read on the original sources (A): what the auxiliary front/rear pictures could not witness keeps the base's value.
 *
 *   npx vite-node research/source-to-model/v35413/b-guard.ts -- <base run dir> <candidate run dir> <out dir> [--foreign-base]
 *
 * Each run dir holds model.json and source-package.json (as second-house writes them). The stand-ins are the assets
 * whose bytes differ between the two packages. `--foreign-base` (a counter-trial) alters one plan's byte hash in the
 * base's sources, as a cache of another revision would: the base is then no witness and nothing is retained.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel, serializeModel } from '@buildapp/model'
import { stableJson } from '@buildapp/source-common'
import { arbitrateOpenings } from '../../../packages/analysis-service/src/appearance/index.js'
import type { Auxiliary, RunSources } from '../../../packages/analysis-service/src/appearance/index.js'

const [baseDir, candDir, out] = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== '--')
const foreign = process.argv.includes('--foreign-base')
mkdirSync(out, { recursive: true })
type Pkg = { id: string; assets: Array<{ id: string; variants: Array<{ byteHash: string }> }> }
const sourcesOf = (dir: string): RunSources & { pkg: Pkg } => {
  const pkg = JSON.parse(readFileSync(join(dir, 'source-package.json'), 'utf8')) as Pkg
  return { pkg, packageId: pkg.id.replace(/-(sketch|B|B1|B2).*$/i, ''), assets: Object.fromEntries(pkg.assets.map((a) => [a.id, a.variants.map((v) => v.byteHash).sort().join('+')])) }
}
const base = sourcesOf(baseDir)
const cand = sourcesOf(candDir)
if (foreign) {
  const plan = Object.keys(base.assets).find((k) => /rzut|plan/i.test(k)) ?? Object.keys(base.assets)[0]
  base.assets[plan] = `${'f'.repeat(64)}`
}
const facadeOf = (assetId: string): Auxiliary['facade'] => (/fron/.test(assetId) ? 'FRONT' : /ogro|tyl|rear/.test(assetId) ? 'REAR' : /lew|left/.test(assetId) ? 'WEST' : 'EAST')
const auxiliary: Auxiliary[] = Object.keys(cand.assets).filter((k) => base.assets[k] !== undefined && base.assets[k] !== cand.assets[k] && !(foreign && base.assets[k] === 'f'.repeat(64))).map((k) => ({ assetId: k, facade: facadeOf(k), originalByteHash: base.assets[k], auxiliaryByteHash: cand.assets[k] }))
const r = arbitrateOpenings(parseModel(readFileSync(join(baseDir, 'model.json'), 'utf8')), parseModel(readFileSync(join(candDir, 'model.json'), 'utf8')), { base: { packageId: base.packageId, assets: base.assets }, candidate: { packageId: cand.packageId, assets: cand.assets }, auxiliary })
writeFileSync(join(out, 'model.json'), serializeModel(r.model))
writeFileSync(join(out, 'arbitration.json'), `${stableJson({ witness: r.witness, auxiliary, records: r.records })}\n`)
const counts = r.records.reduce<Record<string, number>>((m, x) => ({ ...m, [x.decision]: (m[x.decision] ?? 0) + 1 }), {})
process.stdout.write(`witness: ${r.witness.ok ? 'yes' : 'no'} (${r.witness.why}); stand-ins: ${auxiliary.map((a) => `${a.facade.toLowerCase()} ${a.assetId.slice(-10)}`).join(', ')}; decisions ${JSON.stringify(counts)}\n`)
for (const x of r.records.filter((x) => x.decision !== 'RETAINED' || x.applied !== x.candidate)) process.stdout.write(`  ${x.elementId} ${x.property}: ${x.decision} base ${JSON.stringify(x.base)} cand ${JSON.stringify(x.candidate)} → ${JSON.stringify(x.applied)}  (${x.why.slice(0, 110)})\n`)
