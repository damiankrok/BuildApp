/**
 * IU-03A (research only): the LEGACY route — what the PRODUCTION text path does with an image, given only what the
 * publisher said about it. Each input row {key, url, channel?, caption?, exposedBy?, locator?} goes through the real
 * archonRoleClaims -> mergeRoleClaims -> normalizeRoles and the real readsAsFacade router. Nothing reads a pixel.
 * A row that already carries `roles` (from a real SourcePackage) is routed as given, so a test set built by the
 * production acquisition keeps its exact production roles.
 *
 *   npx vite-node research/image-understanding/iu3/legacy_roles.ts -- <in.json> <out.json outside the repo>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { archonRoleClaims, mergeRoleClaims, normalizeRoles, type DiscoveredCandidate } from '@buildapp/source-package'
import { readsAsFacade } from '@buildapp/source-vision'

type Row = { key: string; url?: string; channel?: DiscoveredCandidate['channel']; caption?: string; exposedBy?: string; locator?: string; roles?: Parameters<typeof readsAsFacade>[0] }
const REPO = resolve(import.meta.dirname, '../../..')
const args = process.argv.slice(2).filter((a) => a !== '--')
const out = resolve(args[1])
if (out === REPO || out.startsWith(`${REPO}/`)) throw new Error('REFUSED: legacy routes stay outside the repository until summarised')
const rows = JSON.parse(readFileSync(args[0], 'utf8')) as Row[]
const routed = rows.map((r) => {
  const roles = r.roles ?? normalizeRoles(mergeRoleClaims(archonRoleClaims({ url: r.url ?? '', channel: r.channel ?? 'IMG_SRC', exposedBy: r.exposedBy ?? '', locator: r.locator ?? 'img[src]', caption: r.caption })).roles)
  const facade = readsAsFacade(roles)
  const route = facade ? 'FACADE' : roles.projection === 'PERSPECTIVE' ? 'PERSPECTIVE_CAMERA' : roles.document === 'UNKNOWN' ? 'SKIPPED_UNKNOWN' : `OTHER_${roles.document}`
  return { key: r.key, roles, route }
})
writeFileSync(out, JSON.stringify(routed))
const counts: Record<string, number> = {}
for (const r of routed) counts[r.route] = (counts[r.route] ?? 0) + 1
console.log(JSON.stringify({ rows: routed.length, counts }))
