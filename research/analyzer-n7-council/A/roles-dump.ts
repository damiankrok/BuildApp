/** Council A (research only): every asset's roles, variants and selection across the sealed corpus packages. */
import { readFileSync, existsSync } from 'node:fs'
import { SourcePackageSchema, selectedVariant } from '@buildapp/source-package'
const runs: Record<string, string> = {}
for (const h of ['a01', 'gozd', 'marcowki', 'ciesz', 'rary']) runs[h] = `/home/user/work005yn6/prod-r4/p/${h}`
for (const h of ['trytomach', 'arganiach', 'sasankach3']) runs[h] = `/home/user/work005yn6/prod-r4/an/${h}`
for (const [h, dir] of Object.entries(runs)) {
  const f = `${dir}/source-package.json`
  if (!existsSync(f)) { console.log(h, 'MISSING', f); continue }
  const pkg = SourcePackageSchema.parse(JSON.parse(readFileSync(f, 'utf8')))
  console.log(`\n=== ${h} adapter=${pkg.adapter.id} assets=${pkg.assets.length} failures=${pkg.failures.length}`)
  const codes = new Map<string, number>()
  for (const fl of pkg.failures) codes.set(`${fl.stage}:${fl.code}`, (codes.get(`${fl.stage}:${fl.code}`) ?? 0) + 1)
  console.log('  failures', JSON.stringify([...codes]))
  for (const a of pkg.assets) {
    const v = selectedVariant(a)
    const r = a.roles
    const conflicts = a.roleEvidence.filter((e) => e.signal === 'conflict').map((e) => e.dimension)
    const sizes = a.variants.map((x) => `${x.decoded.width}x${x.decoded.height}`).join(',')
    console.log(`  ${r.document.padEnd(18)} st=${r.storey.padEnd(14)} an=${r.annotation.padEnd(11)} view=${r.view.padEnd(16)} sel=${v.decoded.width}x${v.decoded.height} vars=[${sizes}] ${conflicts.length ? 'CONFLICT:' + conflicts.join('/') : ''} ${(a.caption ?? '').slice(0, 40)} | ${v.url.split('/').pop()?.slice(0, 50)}`)
  }
}
