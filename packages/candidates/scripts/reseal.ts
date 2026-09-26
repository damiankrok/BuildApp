/**
 * `npm run candidates:reseal [-- --ids marcowki-auto,marcowki-auto-v2]`
 *
 * Restate frozen candidates under the current model schema.
 *
 * A sealed candidate carries its program and the hash of the model that
 * program built. When the model schema gains a collection (1.5.0 added
 * `terraces`), the same program builds the same building into a file that
 * states the new version and carries the new, empty collection — and hashes
 * differently. The candidate is then refused on replay, correctly: the
 * replay check cannot tell a schema restatement from a changed building.
 *
 * This script tells them apart, and refuses anything but the first. For each
 * candidate it replays the program under the current schema, then undoes
 * exactly what the schema change added — the collections the migration step
 * lists, which must be empty, and the version string — and hashes that. Only
 * if it equals the sealed model hash (the building is byte-for-byte the one
 * sealed) does it record the new model hash and the new content hash. The
 * program, the layout, every quantity and trace stay as sealed. A residuals
 * sidecar measured on the old content hash is re-pointed, because the
 * geometry it measured is unchanged; `src/reseal-log.json` records every
 * restatement with both hashes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256Hex, stableJson } from '@buildapp/source-common'
import { MODEL_SCHEMA_VERSION, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { buildCandidateModel, candidateContentHash } from '@buildapp/reconstruction'
import type { ReconstructionCandidate } from '@buildapp/reconstruction'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC = join(ROOT, 'packages/candidates/src')

/** What each schema step added, in the order they were added: the collections a restatement may strip. */
const ADDED_BY: Record<string, { previous: string; collections: Array<keyof CanonicalBuildingModel> }> = {
  '1.5.0': { previous: '1.4.0', collections: ['terraces'] },
}

type LogEntry = { id: string; file: string; fromSchema: string; toSchema: string; from: { id: string; contentHash: string; modelHash: string }; to: { id: string; contentHash: string; modelHash: string }; why: string }

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}

function restate(model: CanonicalBuildingModel, toVersion: string): string | null {
  // Serialise under the current schema (canonical, key-sorted), then walk back
  // to `toVersion`, stripping what each step added. Key order survives the
  // round trip, so the text is what the older serializer wrote.
  const copy = JSON.parse(serializeModel(model)) as Record<string, unknown>
  let version = String(copy.schemaVersion)
  while (version !== toVersion) {
    const step = ADDED_BY[version]
    if (!step) return null
    for (const c of step.collections) {
      const v = copy[c as string]
      if (!Array.isArray(v) || v.length > 0) return null
      delete copy[c as string]
    }
    version = step.previous
    copy.schemaVersion = version
  }
  return JSON.stringify(copy, null, 2) + '\n'
}

function main(): void {
  const ids = (argValue('ids') ?? 'marcowki-auto,marcowki-auto-v2').split(',').map((s) => s.trim()).filter(Boolean)
  const logPath = join(SRC, 'reseal-log.json')
  const log: LogEntry[] = existsSync(logPath) ? (JSON.parse(readFileSync(logPath, 'utf8')) as LogEntry[]) : []
  let failures = 0
  for (const id of ids) {
    const file = `${id}.json`
    const path = join(SRC, file)
    if (!existsSync(path)) {
      process.stderr.write(`${id}: no ${file}\n`)
      failures += 1
      continue
    }
    const candidate = JSON.parse(readFileSync(path, 'utf8')) as ReconstructionCandidate
    const model = buildCandidateModel(candidate.program, candidate.label, candidate.modelId)
    const nowHash = sha256Hex(serializeModel(model))
    if (nowHash === candidate.modelHash) {
      process.stdout.write(`${id}: replays byte-identical under ${MODEL_SCHEMA_VERSION}; nothing to restate\n`)
      continue
    }
    // Which earlier schema was it sealed under? The one whose restatement reproduces its hash.
    let sealedUnder: string | undefined
    for (const version of Object.values(ADDED_BY).map((s) => s.previous)) {
      const text = restate(model, version)
      if (text !== null && sha256Hex(text) === candidate.modelHash) {
        sealedUnder = version
        break
      }
    }
    if (!sealedUnder) {
      process.stderr.write(`${id}: the program no longer builds the sealed model, and no schema restatement accounts for the difference — refusing\n`)
      failures += 1
      continue
    }
    const slug = candidate.id.replace(/^candidate-/, '').replace(/-[0-9a-f]{16}$/, '')
    const withModel = { ...candidate, modelHash: nowHash }
    const { id: _oldId, contentHash: _oldHash, ...draft } = withModel
    void _oldId
    void _oldHash
    const contentHash = candidateContentHash(draft)
    const next: ReconstructionCandidate = { ...withModel, id: `candidate-${slug}-${contentHash.slice(0, 16)}`, contentHash }
    writeFileSync(path, `${stableJson(next)}\n`, 'utf8')
    const residualsPath = join(SRC, `${id}-residuals.json`)
    if (existsSync(residualsPath)) {
      const residuals = JSON.parse(readFileSync(residualsPath, 'utf8')) as { candidateHash: string }
      if (residuals.candidateHash === candidate.contentHash) {
        residuals.candidateHash = contentHash
        writeFileSync(residualsPath, `${stableJson(residuals)}\n`, 'utf8')
      }
    }
    log.push({ id, file, fromSchema: sealedUnder, toSchema: MODEL_SCHEMA_VERSION, from: { id: candidate.id, contentHash: candidate.contentHash, modelHash: candidate.modelHash }, to: { id: next.id, contentHash, modelHash: nowHash }, why: `restated under model schema ${MODEL_SCHEMA_VERSION}: the program is unchanged, and the model it builds, with the empty collections ${sealedUnder}→${MODEL_SCHEMA_VERSION} added removed, hashes to the sealed ${candidate.modelHash.slice(0, 16)}` })
    process.stdout.write(`${id}: restated from ${sealedUnder} to ${MODEL_SCHEMA_VERSION} (${candidate.contentHash.slice(0, 16)} → ${contentHash.slice(0, 16)})\n`)
  }
  writeFileSync(logPath, `${stableJson(log)}\n`, 'utf8')
  if (failures > 0) process.exit(1)
}

main()
