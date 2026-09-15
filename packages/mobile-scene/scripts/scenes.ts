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
