// SOURCE-01 (research): list a directory of SourcePackages as rows (house, asset, selected variant hash, production roles).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
export function assetsOf(dir) {
  const rows = []
  for (const h of readdirSync(dir).sort()) {
    const f = join(dir, h, 'source-package.json')
    if (!existsSync(f)) continue
    const p = JSON.parse(readFileSync(f, 'utf8'))
    for (const a of p.assets) {
      const v = a.variants.find((x) => x.id === a.selectedVariantId) ?? a.variants[0]
      rows.push({ house: h, assetId: a.id, sha256: v.byteHash, url: v.url, width: v.decoded.width, height: v.decoded.height, roles: a.roles, evidence: a.roleEvidence })
    }
  }
  return rows
}
