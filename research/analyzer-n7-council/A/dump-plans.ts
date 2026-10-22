/** Council A (research only): write the plan copies of one house to a scratch dir OUTSIDE the repo for visual inspection. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { PNG } from 'pngjs'
import { loadHouse } from './corpus.js'
import { selectedVariant } from '@buildapp/source-package'
const [h, out] = [process.argv[2], process.argv[3]]
if (!out || out.startsWith('/home/user/BuildApp')) throw new Error('out dir must be outside the repo')
mkdirSync(out, { recursive: true })
const { pkg, rasters } = await loadHouse(h)
for (const a of pkg.assets.filter((x) => x.roles.document === 'FLOOR_PLAN' || x.roles.document === 'ELEVATION' || x.roles.document === 'SITE_PLAN')) {
  const v = selectedVariant(a)
  const r = rasters.get(v.byteHash)
  if (!r) continue
  const png = new PNG({ width: r.width, height: r.height })
  png.data = Buffer.from(r.data)
  const name = `${a.roles.document}-${a.roles.storey}-${a.roles.annotation}-${a.roles.view}-${v.decoded.width}-${a.id.slice(-6)}.png`
  writeFileSync(`${out}/${name}`, PNG.sync.write(png))
  console.log(name, v.url.split('/').pop())
}
