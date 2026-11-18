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
 * N8-03D2: both files restated from schema 1.6.0 to 1.7.0 — the version string alone; with it put back they hash to
 * the pins sealed under 1.6.0 (jarzmianki 4ced0179…, gożdzikowce a612a399…). v3.54.9: all four owner models restated
 * from 1.7.0 to 1.8.0 the same way (version string alone; 1.7.0 pins: jarzmianki c65724e9…, goździkowce 5ca1594a…,
 * marcowki-h-v3548 1e20fb73…, marcowki-local-v3548 07b91e89…).
 */
export function sealedOwnerModel(key: string, sha256: string, dir = 'owner-005t'): CanonicalBuildingModel {
  const model = parseModel(readFileSync(join(ROOT, 'packages/candidates/src', dir, `${key}.model.json`), 'utf8'))
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
  // v3.54.12: the same live reading replayed on the code with the wall-cap finish (59b9af1): six exposed wall end caps in
  // a zone take its finish (the 0.40 m strip between entrance and garage); everything else as v3.54.11
  {
    key: 'marcowki-h-v35412',
    title: 'Marcówki — H v3.54.12 (czoło ściany)',
    subtitle: 'KANDYDAT H (nie oddany): jak v3.54.11, plus wykończenie odsłoniętych czół ścian w strefie (ciemny pas 0,40 m między wejściem a garażem); bez kominów',
    build: () => sealedOwnerModel('marcowki-h-v35412', '452165d13263b268ffaebd8c5f134cd96202f7fc36c2b8ea1f05274ac5e50fea', 'owner-v35412'),
  },
  // v3.54.12 (experiment, not delivered): LOCAL on the source package with the front and rear elevations replaced by the
  // OWNER's colour sketches (MIXED: 2 of 4), with the experimental flags elevationVerticalFromDatums and
  // upperStoreyFinishes; plans, sections and the other elevations as published.
  {
    key: 'marcowki-local-szkice-v35412',
    title: 'Marcówki — LOCAL + szkice OWNER-a (eksperyment)',
    subtitle: 'EKSPERYMENT: LOCAL z kolorowymi szkicami frontu i tyłu (2 z 4 elewacji) i dwiema flagami; nie jest modelem oddanym',
    build: () => sealedOwnerModel('marcowki-local-szkice-v35412', '1d5d7713bda542289c42ab4e8e4878931bc52c0c802e1e19ebd3318c052eb0f9', 'owner-v35412'),
  },
  // v3.54.11: the same live reading (397a809's answers) built by the repaired code (84de494): the portal bands take
  // their source zone's finish (D53); everything else of the v3.54.10 candidate is unchanged — a third scene, the two
  // checkpoints below kept for comparison
  {
    key: 'marcowki-h-v35411',
    title: 'Marcówki — H po naprawie v3.54.11',
    subtitle: 'KANDYDAT H (nie oddany) po naprawie materiałów: ciemne pasy portalu ze strefy źródła; reszta jak v3.54.10; bez kominów',
    build: () => sealedOwnerModel('marcowki-h-v35411', '35602721f8b82487b6beed21c854ba7188fdca0e504f9d2106eedbe97e02ee6a', 'owner-v35411'),
  },
  // v3.54.11 (D52): the v3.54.10 checkpoint, exactly as in BuildPlan-V35410-Private.zip (SHA-256 4a75033c…): the H
  // candidate after the final replay (code 62350cc; the live job 397a809's answers; 15 rooms, 29 walls, 0 chimneys) and
  // the LOCAL model the host delivered (13 rooms, 40 walls, 2 chimneys) — sealed by the SHA-256 of their canonical
  // serialization; the v3.54.8 pair below stays as it was.
  {
    key: 'marcowki-h-v35410',
    title: 'Marcówki — H v3.54.10, kandydat',
    subtitle: 'KANDYDAT z odczytu API po recenzji (nie oddany), kod 62350cc: wnętrze, strefy wykończenia, skośne okna z opisów rzutu; bez kominów, pas portalu jasny',
    build: () => sealedOwnerModel('marcowki-h-v35410', '826085f562528b1666ea8a4e673c83e2ff446abd0b080dc719b191db2cee990a', 'owner-v35410'),
  },
  {
    key: 'marcowki-local-v35410',
    title: 'Marcówki — LOCAL oddany przez host',
    subtitle: 'Model oddany użytkownikowi przez host v3.54.10 (397a809 / d43eebe / 62350cc, ten sam): LOCAL — do porównania z kandydatem H',
    build: () => sealedOwnerModel('marcowki-local-v35410', '36f522a4eb21a4eedf34bb8fd60fd7c59e4460d251ad3443cc04c7a0ce93fc86', 'owner-v35410'),
  },
  // v3.54.8 (owner request): the house described from the API's reading after its review, and the model the final host
  // (05faa4e) delivered for the same page (LOCAL), side by side — sealed by the SHA-256 of their canonical
  // serialization as they came out of the runs (`packages/candidates/src/owner-v3548/`, numbers and ids only).
  {
    key: 'marcowki-h-v3548',
    title: 'Marcówki — opis H v3.54.8',
    subtitle: 'KANDYDAT z odczytu API po recenzji (nie oddany): rama z nogami, szkło, pas portalu; głowice za nisko',
    build: () => sealedOwnerModel('marcowki-h-v3548', '11285686983d92e921fecfa5eb2846a46c1aca40223aff23bf8b8e3a87d51899', 'owner-v3548'),
  },
  {
    key: 'marcowki-local-v3548',
    title: 'Marcówki — LOCAL v3.54.8',
    subtitle: 'Model oddany przez host 05faa4e (LOCAL) — do porównania z opisem H',
    build: () => sealedOwnerModel('marcowki-local-v3548', '36f522a4eb21a4eedf34bb8fd60fd7c59e4460d251ad3443cc04c7a0ce93fc86', 'owner-v3548'),
  },
  // BUILDPLAN-OWNER-005T: two development rows the analyzer now builds, listed first so the owner finds them at
  // once. Approximate models for a visual review — each carries LIMITING warnings in its stage report.
  {
    key: 'jarzmianki-005t-visual',
    title: 'Dom w jarzmiankach (005T)',
    subtitle: 'MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji (6 ostrzeżeń ograniczających)',
    build: () => sealedOwnerModel('jarzmianki-005t-visual', '240403af9c80e6fa68245497c978cc92f3b5a4ef60d217e5b2fc8ebafaec7dd4'),
  },
  {
    key: 'gozdzikowce-005t-visual',
    title: 'Dom w goździkowcach (005T)',
    subtitle: 'MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji; dach z przybliżonej kalenicy',
    build: () => sealedOwnerModel('gozdzikowce-005t-visual', '944ea8250d97e2ed1f6963915c56203057f93079a5ff8f2e4009b9b63520ae6b'),
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
