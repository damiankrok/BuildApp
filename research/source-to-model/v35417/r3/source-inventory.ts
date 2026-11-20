/**
 * v3.54.17 R3 — what a pasted project link gives the analyzer, at 0 USD (offline cache): every published fact of the
 * page (key, value, unit, label) and every drawing with its role (document, view, storey, projection) and size. The
 * inventory the analyzer's readings are held against; it names what each drawing can measure.
 *   npx vite-node research/source-to-model/v35417/r3/source-inventory.ts -- --url <page> --cache <dir> [--out <json>]
 */
import { writeFileSync } from 'node:fs'
import { acquireSourcePackage, archonAdapter, fileByteCache, genericProjectPageAdapter } from '@buildapp/source-package'

const argv = process.argv.slice(2).filter((a) => a !== '--')
const opt = (n: string): string | undefined => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const pkg = await acquireSourcePackage(opt('url') as string, [archonAdapter, genericProjectPageAdapter], { cache: fileByteCache(opt('cache') as string), offline: true })
const out = {
  url: opt('url'),
  facts: pkg.publishedFacts.map((f) => ({ key: f.key, value: f.value, unit: f.unit, label: String((f as unknown as { label?: string }).label ?? (f as unknown as { sourceText?: string }).sourceText ?? '').slice(0, 80) })),
  rooms: pkg.publishedRooms.length,
  assets: pkg.assets.map((a) => ({ id: a.id.slice(0, 60), roles: a.roles, caption: (a.caption ?? '').slice(0, 80) })),
}
if (opt('out')) writeFileSync(opt('out') as string, `${JSON.stringify(out, null, 1)}\n`)
process.stdout.write(`${JSON.stringify({ facts: out.facts, rooms: out.rooms, assets: out.assets.map((a) => [a.roles.document, a.roles.view, a.roles.storey, a.caption]) }, null, 0)}\n`)
