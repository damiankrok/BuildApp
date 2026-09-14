/**
 * Explicit schema evolution.
 *
 * Persisted models state their `schemaVersion`. The current version is
 * `MODEL_SCHEMA_VERSION`; older versions listed in `SUPPORTED_SCHEMA_VERSIONS`
 * are migrated here, on load, and the migration is reported (a
 * `SCHEMA_MIGRATED` warning plus a note in `meta.notes`) so that a file is
 * never silently reinterpreted. Anything else is refused with
 * `UNSUPPORTED_SCHEMA_VERSION`.
 *
 * 1.0.0 -> 1.1.0 (STAGE BUILDAPP-00A): the model gained `wallJunctions` and
 * `wallRings`. A 1.0.0 file has neither, and its walls express corner
 * ownership by their extents (the abutting wall was trimmed by hand). Such a
 * file loads with empty topology collections and compiles to exactly the
 * geometry it compiled to before, because a wall without junctions keeps its
 * nominal extent. A 1.0.0 file that already carries topology collections is
 * refused: that would be a 1.1.0 file mislabelled.
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

export function migrateModelInput(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { input: raw, migrated: false, issues: [] }
  const o = raw as Record<string, unknown>
  // A wrong schema name is reported by the Zod literal; nothing to migrate.
  if (o.schema !== MODEL_SCHEMA_NAME) return { input: raw, migrated: false, issues: [] }
  const version = o.schemaVersion
  if (version === MODEL_SCHEMA_VERSION) return { input: raw, migrated: false, issues: [] }

  if (version === '1.0.0') {
    if ('wallJunctions' in o || 'wallRings' in o) {
      return {
        input: raw,
        migrated: false,
        issues: [
          {
            code: 'SCHEMA',
            severity: 'ERROR',
            message: 'a schema 1.0.0 model cannot carry wallJunctions or wallRings; state schemaVersion 1.1.0',
            path: 'schemaVersion',
          },
        ],
      }
    }
    const meta = (o.meta && typeof o.meta === 'object' ? (o.meta as Record<string, unknown>) : {}) as { createdWith?: unknown; notes?: unknown }
    const notes = Array.isArray(meta.notes) ? [...(meta.notes as unknown[])] : []
    notes.push(MIGRATION_NOTE_1_0_0)
    const input = { ...o, schemaVersion: MODEL_SCHEMA_VERSION, wallJunctions: [], wallRings: [], meta: { ...meta, notes } }
    return {
      input,
      migrated: true,
      fromVersion: '1.0.0',
      issues: [
        {
          code: 'SCHEMA_MIGRATED',
          severity: 'WARNING',
          message: `model migrated from schema 1.0.0 to ${MODEL_SCHEMA_VERSION}: empty wallJunctions and wallRings were added; walls keep their stated extents`,
          path: 'schemaVersion',
        },
      ],
    }
  }

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
