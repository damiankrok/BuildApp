/**
 * Explicit schema evolution.
 *
 * Persisted models state their `schemaVersion`. The current version is
 * `MODEL_SCHEMA_VERSION`; older versions listed in `SUPPORTED_SCHEMA_VERSIONS`
 * are migrated here, on load, one step at a time, and every step is reported
 * (a `SCHEMA_MIGRATED` warning plus a note in `meta.notes`) so that a file is
 * never silently reinterpreted. Anything else is refused with
 * `UNSUPPORTED_SCHEMA_VERSION`.
 *
 * 1.0.0 -> 1.1.0 (STAGE BUILDAPP-00A): the model gained `wallJunctions` and
 * `wallRings`. A 1.0.0 file has neither, and its walls express corner
 * ownership by their extents (the abutting wall was trimmed by hand). Such a
 * file loads with empty topology collections and compiles to exactly the
 * geometry it compiled to before, because a wall without junctions keeps its
 * nominal extent.
 *
 * 1.1.0 -> 1.2.0 (STAGE BUILDAPP-01): the model gained `roofOpenings` and
 * `rooflights`, and three optional fields — `Opening.head` (a raked head),
 * `Opening.leaves` (further wall leaves one opening cuts through) and
 * `Window.mullions`. A 1.1.0 file has none of them; it loads with empty roof
 * opening collections, every opening keeps its level head and its single
 * leaf, and it compiles to exactly the geometry it compiled to before.
 *
 * A file that states an older version but already carries a newer version's
 * collections is refused: it would be a mislabelled newer file.
 */
import type { ValidationIssue } from './issues.js'
import { MODEL_SCHEMA_NAME, MODEL_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS } from './schema.js'

export type MigrationResult = {
  /** The (possibly rewritten) input to validate. */
  input: unknown
  migrated: boolean
  fromVersion?: string
  issues: ValidationIssue[]
}

export const MIGRATION_NOTE_1_0_0 =
  'migrated from schema 1.0.0 to 1.1.0: the file carried no wall topology; corner ownership of its walls is expressed by their extents'

export const MIGRATION_NOTE_1_1_0 =
  'migrated from schema 1.1.0 to 1.2.0: the file carried no roof openings; every opening keeps a level head and a single wall leaf'

type Step = {
  from: string
  to: string
  /** Collections the older version cannot carry; their presence means the file is mislabelled. */
  newCollections: string[]
  note: string
  message: string
}

const STEPS: Step[] = [
  {
    from: '1.0.0',
    to: '1.1.0',
    newCollections: ['wallJunctions', 'wallRings'],
    note: MIGRATION_NOTE_1_0_0,
    message: 'model migrated from schema 1.0.0 to 1.1.0: empty wallJunctions and wallRings were added; walls keep their stated extents',
  },
  {
    from: '1.1.0',
    to: '1.2.0',
    newCollections: ['roofOpenings', 'rooflights'],
    note: MIGRATION_NOTE_1_1_0,
    message: 'model migrated from schema 1.1.0 to 1.2.0: empty roofOpenings and rooflights were added; openings keep level heads and single leaves',
  },
]

export function migrateModelInput(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { input: raw, migrated: false, issues: [] }
  const o = raw as Record<string, unknown>
  // A wrong schema name is reported by the Zod literal; nothing to migrate.
  if (o.schema !== MODEL_SCHEMA_NAME) return { input: raw, migrated: false, issues: [] }
  const version = o.schemaVersion
  if (version === MODEL_SCHEMA_VERSION) return { input: raw, migrated: false, issues: [] }
  if (typeof version !== 'string' || !(SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(version)) {
    return {
      input: raw,
      migrated: false,
      issues: [
        {
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          severity: 'ERROR',
          message: `schemaVersion ${JSON.stringify(version)} is not supported; supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')} (current ${MODEL_SCHEMA_VERSION})`,
          path: 'schemaVersion',
        },
      ],
    }
  }

  // A file must not carry collections that only a newer version has: every
  // step from the stated version onwards introduces collections it cannot have.
  const first = STEPS.findIndex((s) => s.from === version)
  for (const step of STEPS.slice(first)) {
    for (const c of step.newCollections) {
      if (c in o) {
        return {
          input: raw,
          migrated: false,
          issues: [
            {
              code: 'SCHEMA',
              severity: 'ERROR',
              message: `a schema ${version} model cannot carry ${c}; state schemaVersion ${step.to} or later`,
              path: 'schemaVersion',
            },
          ],
        }
      }
    }
  }

  const issues: ValidationIssue[] = []
  let current: Record<string, unknown> = { ...o }
  let v = version
  for (const step of STEPS) {
    if (step.from !== v) continue
    const meta = (current.meta && typeof current.meta === 'object' ? (current.meta as Record<string, unknown>) : {}) as { createdWith?: unknown; notes?: unknown }
    const notes = Array.isArray(meta.notes) ? [...(meta.notes as unknown[])] : []
    notes.push(step.note)
    const added: Record<string, unknown> = {}
    for (const c of step.newCollections) added[c] = []
    current = { ...current, ...added, schemaVersion: step.to, meta: { ...meta, notes } }
    issues.push({ code: 'SCHEMA_MIGRATED', severity: 'WARNING', message: step.message, path: 'schemaVersion' })
    v = step.to
  }
  return { input: current, migrated: true, fromVersion: version, issues }
}
