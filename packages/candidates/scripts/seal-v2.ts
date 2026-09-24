/**
 * `npm run candidates:seal-v2` — seal the analyzer-v2 candidate into this package.
 *
 * The v2 pipeline (`npm run reconstruct:v2:marcowki`) writes its artefacts to
 * `stage-reports/artifacts/analyzer-v2/`. This copies the three that every
 * viewer needs — the candidate, the layout it was built from and the
 * source-view residuals that verified it — into `src/`, byte for byte, so
 * that BuildWorld, the mobile exporter and the tests all replay the same
 * sealed program. Rerun it whenever the artefacts are regenerated.
 *
 * It refuses to seal an incoherent set. A layout whose hash is not the one the
 * candidate names, or residuals measured on a different candidate, would put
 * two buildings under one label, which is exactly what sealing exists to
 * prevent. Nothing here patches a file to make it fit: if the artefacts
 * disagree, the pipeline is rerun, not the JSON.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const ARTIFACTS = join(ROOT, 'stage-reports/artifacts/analyzer-v2')
const SRC = join(ROOT, 'packages/candidates/src')

/** What is copied, and under which name it is sealed. */
export const SEAL_V2_COPIES: ReadonlyArray<{ from: string; to: string }> = [
  { from: 'marcowki-auto-v2.json', to: 'marcowki-auto-v2.json' },
  { from: 'marcowki-layout.json', to: 'marcowki-auto-v2-layout.json' },
  { from: 'source-view-residuals.json', to: 'marcowki-auto-v2-residuals.json' },
]

type Hashed = { contentHash?: string; id?: string; structuralLayoutHash?: string; structuralLayoutId?: string; candidateHash?: string; label?: string }

function main(): void {
  const text = (name: string): string => readFileSync(join(ARTIFACTS, name), 'utf8')
  const missing = SEAL_V2_COPIES.filter((c) => !existsSync(join(ARTIFACTS, c.from))).map((c) => c.from)
  if (missing.length > 0) {
    process.stderr.write(`cannot seal: missing ${missing.join(', ')} under ${ARTIFACTS.replace(ROOT, '.')}\nrun \`npm run reconstruct:v2:marcowki\` first\n`)
    process.exit(1)
  }

  const candidate = JSON.parse(text('marcowki-auto-v2.json')) as Hashed
  const layout = JSON.parse(text('marcowki-layout.json')) as Hashed
  const residuals = JSON.parse(text('source-view-residuals.json')) as Hashed

  const problems: string[] = []
  if (layout.contentHash !== candidate.structuralLayoutHash) {
    problems.push(`the layout hashes to ${(layout.contentHash ?? '').slice(0, 16)} but the candidate was built from ${(candidate.structuralLayoutHash ?? '').slice(0, 16)}`)
  }
  if (layout.id !== candidate.structuralLayoutId) problems.push(`the layout is ${layout.id} but the candidate names ${candidate.structuralLayoutId}`)
  if (residuals.candidateHash !== candidate.contentHash) {
    problems.push(`the residuals were measured on ${(residuals.candidateHash ?? '').slice(0, 16)} but the candidate is ${(candidate.contentHash ?? '').slice(0, 16)}`)
  }
  if (problems.length > 0) {
    process.stderr.write(`refusing to seal an incoherent analyzer-v2 set:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`)
    process.exit(1)
  }

  for (const copy of SEAL_V2_COPIES) {
    const bytes = text(copy.from)
    const target = join(SRC, copy.to)
    const unchanged = existsSync(target) && readFileSync(target, 'utf8') === bytes
    if (!unchanged) writeFileSync(target, bytes, 'utf8')
    process.stdout.write(`${copy.to.padEnd(34)} ${unchanged ? 'unchanged' : 'sealed   '}  ${(Buffer.byteLength(bytes, 'utf8') / 1024).toFixed(0)} kB\n`)
  }
  process.stdout.write(`\nsealed ${candidate.label ?? candidate.id} (${(candidate.contentHash ?? '').slice(0, 16)}…) into ${SRC.replace(ROOT, '.')}\n`)
}

main()
