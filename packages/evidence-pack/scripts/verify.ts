/**
 * `npm run -s evidence:verify -- <dir> [<dir> …] [--max-packs <n>]`
 *
 * Verify committed Evidence Packs (BUILDPLAN-ANALYZER-005D §11, §12, §19, §20): every directory
 * holding a `manifest.json` under the given ones is a pack, and each must be
 *
 *   - complete: every required file, and a JSON sidecar beside every layer SVG;
 *   - exactly what its manifest says: each listed file present with its SHA-256 and size, and
 *     nothing unlisted beside them;
 *   - free of a publisher's pixels: no raster, data URI or external reference in any SVG, and no
 *     binary file but the analyzer's own bounded render of its model;
 *   - bounded: every JSON file and every SVG within the pack's limits, and (with `--max-packs`) no more
 *     packs committed for a stage than its bound.
 *
 * Exits non-zero, naming every violation, when any pack fails.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FORBIDDEN_IN_SVG, PACK_BOUNDS, PACK_FILES } from '../src/index.js'
import type { PackManifest } from '../src/index.js'

const PREVIEW = '16-final-model-preview.png'

function packsUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  if (existsSync(join(dir, 'manifest.json'))) return [dir]
  return readdirSync(dir)
    .map((n) => join(dir, n))
    .filter((p) => statSync(p).isDirectory())
    .flatMap(packsUnder)
}

export function verifyPack(dir: string): string[] {
  const problems: string[] = []
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as PackManifest
  const listed = new Map(manifest.files.map((f) => [f.name, f]))
  for (const name of PACK_FILES) if (!listed.has(name)) problems.push(`missing ${name}`)
  for (const name of readdirSync(dir)) if (name !== 'manifest.json' && !listed.has(name)) problems.push(`${name} is not in the manifest`)
  for (const f of manifest.files) {
    const path = join(dir, f.name)
    if (!existsSync(path)) {
      problems.push(`${f.name} is listed but absent`)
      continue
    }
    const bytes = readFileSync(path)
    if (createHash('sha256').update(bytes).digest('hex') !== f.sha256) problems.push(`${f.name}: SHA-256 differs from the manifest`)
    if (bytes.length !== f.bytes) problems.push(`${f.name}: ${bytes.length} bytes, the manifest says ${f.bytes}`)
    if (f.name.endsWith('.svg')) {
      const text = bytes.toString('utf8')
      for (const re of FORBIDDEN_IN_SVG) if (re.test(text)) problems.push(`${f.name}: embeds ${re}`)
      const elements = (text.match(/<(?!\/)[a-z]/g) ?? []).length
      if (elements > PACK_BOUNDS.svgElements + 16) problems.push(`${f.name}: ${elements} elements, over the bound`)
      if (f.name !== 'evidence-summary.svg' && !listed.has(f.name.replace(/\.svg$/, '.json'))) problems.push(`${f.name}: no JSON sidecar`)
    } else if (f.name.endsWith('.json') || f.name.endsWith('.md')) {
      if (bytes.length > PACK_BOUNDS.jsonBytes) problems.push(`${f.name}: ${bytes.length} bytes, over the bound`)
    } else if (f.name === PREVIEW) {
      const width = bytes.readUInt32BE(16)
      if (bytes.subarray(1, 4).toString('latin1') !== 'PNG') problems.push(`${f.name}: not a PNG`)
      if (width > PACK_BOUNDS.previewWidth) problems.push(`${f.name}: ${width} px wide, over the bound`)
    } else {
      problems.push(`${f.name}: a file of a kind a pack never carries`)
    }
  }
  return problems
}

const args = process.argv.slice(2).filter((a) => a !== '--')
const maxAt = args.indexOf('--max-packs')
const maxPacks = maxAt >= 0 ? Number(args[maxAt + 1]) : undefined
const roots = args.filter((_, i) => maxAt < 0 || (i !== maxAt && i !== maxAt + 1))
if (roots.length === 0 || (maxPacks !== undefined && !Number.isInteger(maxPacks))) {
  process.stderr.write('usage: evidence:verify -- <dir> [<dir> …] [--max-packs <n>]\n')
  process.exit(2)
}
let failed = 0
let packs = 0
for (const root of roots) {
  for (const dir of packsUnder(root)) {
    packs += 1
    const problems = verifyPack(dir)
    if (problems.length > 0) {
      failed += 1
      for (const p of problems) process.stdout.write(`::error::${relative(process.cwd(), dir)}: ${p}\n`)
    } else process.stdout.write(`${relative(process.cwd(), dir)}: ok\n`)
  }
}
if (packs === 0) {
  process.stdout.write(`::error::no evidence pack under ${roots.join(', ')}\n`)
  process.exit(1)
}
process.stdout.write(`${packs} pack(s), ${failed} failing\n`)
if (maxPacks !== undefined && packs > maxPacks) {
  process.stdout.write(`::error::${packs} packs committed, over the bound of ${maxPacks}\n`)
  process.exit(1)
}
if (failed > 0) process.exit(1)
