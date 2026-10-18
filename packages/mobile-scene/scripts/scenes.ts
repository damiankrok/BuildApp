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
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { modelOf } from '@buildapp/candidates'
import { parseModel, serializeModel } from '@buildapp/model'
import type { CanonicalBuildingModel } from '@buildapp/model'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** Where the Android app picks its assets up from. */
export const ASSET_DIR = join(ROOT, 'apps/android/app/src/main/assets/scenes')

/**
 * BUILDPLAN-OWNER-005T: a model the analyzer built from a development row and that was sealed as it came out of
 * the pipeline (`packages/candidates/src/owner-005t/`, numbers and ids only). It ships for the owner's visual
 * review, pinned by the SHA-256 of its canonical serialization: a file that does not reproduce exactly that
 * model is refused here, so the phone never shows a building other than the one the stage reports measured.
 */
export function sealedOwnerModel(key: string, sha256: string): CanonicalBuildingModel {
  const model = parseModel(readFileSync(join(ROOT, 'packages/candidates/src/owner-005t', `${key}.model.json`), 'utf8'))
  const actual = createHash('sha256').update(serializeModel(model)).digest('hex')
  if (actual !== sha256) throw new Error(`sealed owner model ${key}: SHA-256 ${actual}, expected ${sha256}`)
  return model
}

export type SceneSpec = { key: string; title: string; subtitle: string; build: () => CanonicalBuildingModel }

/**
 * Presentation order in the app. It has no effect on any bundle's bytes or
 * hash — `bundle.test.ts` holds that.
 */
export const SCENES: readonly SceneSpec[] = [
  // BUILDPLAN-OWNER-005T: two development rows the analyzer now builds, listed first so the owner finds them at
  // once. Approximate models for a visual review — each carries LIMITING warnings in its stage report.
  {
    key: 'jarzmianki-005t-visual',
    title: 'Dom w jarzmiankach (005T)',
    subtitle: 'MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji (6 ostrzeżeń ograniczających)',
    build: () => sealedOwnerModel('jarzmianki-005t-visual', '4ced017981088d05aa0f2b245b1f80a343c8b338855e14154e3a150040846b54'),
  },
  {
    key: 'gozdzikowce-005t-visual',
    title: 'Dom w goździkowcach (005T)',
    subtitle: 'MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji; dach z przybliżonej kalenicy',
    build: () => sealedOwnerModel('gozdzikowce-005t-visual', 'a612a399e0b2dd25974202fe37982abb1b620b554fcabf7af4603596678fd33f'),
  },
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
