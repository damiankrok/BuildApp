/**
 * `npm run source:acquire -- <url>`
 *
 * The ONE acquisition path. The browser does not have another: BuildWorld
 * reads the sealed package this produces and never scrapes a publisher
 * itself, which is what makes "the CLI and the web app analysed the same
 * sources" a fact rather than an intention.
 *
 * Flags:
 *   --out <file>      where to write the sealed package (default: stdout summary only)
 *   --cache <dir>     byte cache; with --offline, the only source of bytes
 *   --offline         refuse the network entirely and replay from the cache
 *   --no-probe        do not try a publisher's naming convention for larger originals
 *   --quiet           summary only
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { acquireSourcePackage, archonAdapter, fileByteCache, selectedVariant } from '../src/index.js'
import type { SourcePackage } from '../src/index.js'

const ADAPTERS = [archonAdapter]

const flag = (argv: readonly string[], name: string): boolean => argv.includes(`--${name}`)
const value = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

export function summarize(pkg: SourcePackage): string {
  const lines: string[] = []
  lines.push(`package      ${pkg.id}`)
  lines.push(`url          ${pkg.canonicalUrl}`)
  lines.push(`publisher    ${pkg.project.publisher}${pkg.project.externalId ? ` (${pkg.project.externalId})` : ''}`)
  lines.push(`adapter      ${pkg.adapter.id}@${pkg.adapter.version}`)
  lines.push(`content hash ${pkg.contentHash}`)
  lines.push(`assets       ${pkg.assets.length}   facts ${pkg.publishedFacts.length}   rooms ${pkg.publishedRooms.length}   failures ${pkg.failures.length}`)
  lines.push('')
  lines.push('  document            storey       annotation   view              decoded      variants  asset')
  for (const a of [...pkg.assets].sort((x, y) => x.roles.document.localeCompare(y.roles.document) || x.id.localeCompare(y.id))) {
    const v = selectedVariant(a)
    lines.push(
      `  ${a.roles.document.padEnd(19)} ${a.roles.storey.padEnd(12)} ${a.roles.annotation.padEnd(12)} ${a.roles.view.padEnd(17)} ${`${v.decoded.width}x${v.decoded.height}`.padEnd(12)} ${String(a.variants.length).padEnd(9)} ${a.id}`,
    )
  }
  if (pkg.publishedFacts.length > 0) {
    lines.push('')
    lines.push('  published figures (aggregates; no geometry may be derived from one)')
    for (const f of pkg.publishedFacts) lines.push(`    ${f.key.padEnd(24)} ${String(f.value).padStart(10)} ${f.unit.padEnd(6)} ${f.label}`)
  }
  const byCode = new Map<string, number>()
  for (const f of pkg.failures) byCode.set(f.code, (byCode.get(f.code) ?? 0) + 1)
  if (byCode.size > 0) {
    lines.push('')
    lines.push('  what did not work (part of the package, not an omission from it)')
    for (const [code, n] of [...byCode].sort()) lines.push(`    ${code.padEnd(24)} ${n}`)
  }
  return lines.join('\n')
}

export async function main(argv: readonly string[]): Promise<number> {
  const url = argv.find((a) => a.startsWith('http'))
  if (!url) {
    process.stderr.write('usage: source:acquire -- <url> [--out file] [--cache dir] [--offline] [--no-probe]\n')
    return 2
  }
  const cacheDir = value(argv, 'cache')
  const pkg = await acquireSourcePackage(url, ADAPTERS, {
    cache: cacheDir ? fileByteCache(cacheDir) : undefined,
    offline: flag(argv, 'offline'),
    probeResolutionCandidates: !flag(argv, 'no-probe'),
  })
  const out = value(argv, 'out')
  if (out) {
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, `${JSON.stringify(pkg, null, 2)}\n`)
  }
  if (!flag(argv, 'quiet')) process.stdout.write(`${summarize(pkg)}\n`)
  if (out) process.stdout.write(`\nwritten to ${out}\n`)
  return 0
}

// Run directly: `vite-node <this file> -- <args>`. Under vitest the module is
// imported for its exports and must not run.
if (!process.env.VITEST) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: Error) => {
      process.stderr.write(`${err.stack ?? err.message}\n`)
      process.exit(1)
    },
  )
}
