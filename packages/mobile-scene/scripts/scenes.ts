/**
 * The scenes that ship on the phone.
 *
 * This is the only place that names a building. The library in `../src` is
 * generic over any CanonicalBuildingModel, and the Android app reads whatever
 * assets the exporter writes — it knows no building by name either.
 *
 * Side-effect free on purpose, so tests can read the registry without writing
 * anything to disk.
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { modelOf } from '@buildapp/candidates'
import type { CanonicalBuildingModel } from '@buildapp/model'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** Where the Android app picks its assets up from. */
export const ASSET_DIR = join(ROOT, 'apps/android/app/src/main/assets/scenes')

export type SceneSpec = { key: string; title: string; subtitle: string; build: () => CanonicalBuildingModel }

/**
 * Presentation order in the app. It has no effect on any bundle's bytes or
 * hash — `bundle.test.ts` holds that.
 */
export const SCENES: readonly SceneSpec[] = [
  {
    key: 'marcowki',
    title: 'Marcówki',
    subtitle: 'Dom w marcówkach (GE) — reference model',
    build: createMarcowkiReferenceBuilding,
  },
  {
    // The current automatic candidate: analyzer v2 after the exterior closure
    // of BUILDAPP-03Y. Listed first among the candidates because it is the one
    // under review; the earlier ones follow for comparison.
    key: 'marcowki-auto-v3',
    title: 'Marcówki (auto v3)',
    subtitle: 'Analyzer v2 with exterior closure: joins, roof edges, balcony, terraces — a candidate, not final',
    build: () => modelOf('marcowki-auto-v3'),
  },
  {
    // The automatic candidate, replayed from its sealed program. The phone
    // shows the building that was sealed and evaluated, not whatever a solver
    // running on a laptop produced this afternoon.
    key: 'marcowki-auto',
    title: 'Marcówki (auto)',
    subtitle: 'Reconstructed from the published drawings — a candidate, not final',
    build: () => modelOf('marcowki-auto'),
  },
  {
    // The analyzer-v2 candidate, sealed beside the first: the same drawings
    // through the second pipeline, replayed the same way.
    key: 'marcowki-auto-v2',
    title: 'Marcówki (auto v2)',
    subtitle: 'Reconstructed by analyzer v2 and verified against the source views — a candidate, not final',
    build: () => modelOf('marcowki-auto-v2'),
  },
  {
    key: 'demo',
    title: 'Demo',
    subtitle: 'BuildApp demo house',
    build: createDemoBuilding,
  },
]

export type SceneIndexEntry = {
  key: string
  title: string
  subtitle: string
  asset: string
  modelId: string
  modelSchemaVersion: string
  contentHash: string
  meshCount: number
  triangleCount: number
  objectCount: number
}
