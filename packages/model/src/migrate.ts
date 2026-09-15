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
 * 1.2.0 -> 1.3.0 (STAGE BUILDAPP-01A): the model gained the `surfaceRegions`
 * collection and four optional extensions — `Slab.holes`, `RoofOpening.cut`
 * (VERTICAL when absent), `Door.assembly` (one leaf when absent) and the
 * FLIGHTS stair kind beside PLACEHOLDER. A 1.2.0 file has none of them; it
 * loads with an empty region collection, every slab solid, every roof cut
 * vertical, every door one leaf and every stair a placeholder, and compiles
 * to exactly the geometry it compiled to before.
 *
 * 1.3.0 -> 1.4.0 (STAGE BUILDAPP-03): the model gained the `linearSolids`
 * collection — a straight member with a rectangular cross-section, extruded
 * along its own centreline, which is what a `SurfaceRegion` could not be. A
 * 1.3.0 file has none; it loads with an empty collection and compiles to
 * exactly the geometry it compiled to before.
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

export const MIGRATION_NOTE_1_2_0 =
  'migrated from schema 1.2.0 to 1.3.0: the file carried no surface regions; every slab stays solid, every roof cut vertical, every door one leaf and every stair a placeholder'

export const MIGRATION_NOTE_1_3_0 = 'migrated from schema 1.3.0 to 1.4.0: the file carried no linear solids; every facade member it describes is still a flat region'

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
  {
    from: '1.2.0',
    to: '1.3.0',
    newCollections: ['surfaceRegions'],
    note: MIGRATION_NOTE_1_2_0,
    message: 'model migrated from schema 1.2.0 to 1.3.0: an empty surfaceRegions collection was added; slabs stay solid, roof cuts vertical, doors one leaf, stairs placeholders',
  },
  {
    from: '1.3.0',
    to: '1.4.0',
    newCollections: ['linearSolids'],
    note: MIGRATION_NOTE_1_3_0,
    message: 'model migrated from schema 1.3.0 to 1.4.0: an empty linearSolids collection was added; the file carries no volumetric facade members',
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
