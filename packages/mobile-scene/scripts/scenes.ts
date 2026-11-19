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
 * v3.54.13: all owner models restated from 1.8.0 to 1.9.0 the same way (version string alone; for marcowki-h-v35412 the
 * restatement of the end-cap faces it carried under 1.8.0). 1.8.0 pins: gozdzikowce-005t-visual 944ea825…, jarzmianki-005t-visual 240403af…, marcowki-h-v35410 826085f5…, marcowki-local-v35410 36f522a4…, marcowki-h-v35411 35602721…, marcowki-h-v35412 452165d1…, marcowki-local-szkice-v35412 1d5d7713…, marcowki-h-v3548 11285686…, marcowki-local-v3548 36f522a4….
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
  // v3.54.13 (delivered miniature): the delivered LOCAL geometry read on the ORIGINAL sources (v3.54.11 A, every
  // wall, opening, room, stair and id unchanged — the usable-geometry fingerprint is A's), its finishes replaced by
  // material outlines (model schema 1.9.0): front and rear from the OWNER's sketches (local sketch reader), the two sides
  // — which have no sketch — from the API reading of their original elevations; each registered on its elevation and
  // split among the surfaces the model shows. The gate keeps its 2.20 m.
  {
    key: 'marcowki-c-v35413',
    title: 'Marcówki — kontury wykończeń v3.54.13 (oddany)',
    subtitle: 'ODDANY: geometria LOCAL z oryginałów bez zmian; wykończenia z konturów: przód i tył ze szkiców OWNER-a, boki z odczytu elewacji',
    build: () => sealedOwnerModel('marcowki-c-v35413', 'a56676b9bf0249ba14534aa5135c7326ac8877827a76c571a34ecb735b0b3e68', 'owner-v35413'),
  },
  // v3.54.13 (experiment): the same geometry, its finishes from the four ORIGINAL elevations read by the provider's
  // API into the appearance contract (outlines and classes as JSON, no raster edited; 4 requests, 0.04623 USD)
  {
    key: 'marcowki-c-live-v35413',
    title: 'Marcówki — kontury z odczytu 4 elewacji (eksperyment)',
    subtitle: 'EKSPERYMENT: ta sama geometria, wykończenia z automatycznego odczytu czterech oryginalnych elewacji (kontury i klasy JSON)',
    build: () => sealedOwnerModel('marcowki-c-live-v35413', '8a6c0cfe4b1f4bde50e6dea164ef79cfb2d9e6fdd78e847e2465636079701014', 'owner-v35413'),
  },
  // v3.54.12: the same live reading replayed on the code with the wall-cap finish (59b9af1): six exposed wall end caps in
  // a zone take its finish (the 0.40 m strip between entrance and garage); everything else as v3.54.11
  {
    key: 'marcowki-h-v35412',
    title: 'Marcówki — H v3.54.12 (czoło ściany)',
    subtitle: 'KANDYDAT H (nie oddany): jak v3.54.11, plus wykończenie odsłoniętych czół ścian w strefie (ciemny pas 0,40 m między wejściem a garażem); bez kominów',
    build: () => sealedOwnerModel('marcowki-h-v35412', '28c2b99bc7d0c1c6dd2c15765f4bc780b4f8ca6b12b7fa83c43bc98a7ec70bf4', 'owner-v35412'),
  },
  // v3.54.12 (experiment, not delivered): LOCAL on the source package with the front and rear elevations replaced by the
  // OWNER's colour sketches (MIXED: 2 of 4), with the experimental flags elevationVerticalFromDatums and
  // upperStoreyFinishes; plans, sections and the other elevations as published.
  {
    key: 'marcowki-local-szkice-v35412',
    title: 'Marcówki — LOCAL + szkice OWNER-a (eksperyment)',
    subtitle: 'EKSPERYMENT: LOCAL z kolorowymi szkicami frontu i tyłu (2 z 4 elewacji) i dwiema flagami; nie jest modelem oddanym',
    build: () => sealedOwnerModel('marcowki-local-szkice-v35412', '21e77523aebe7aa5c7293d2c1e6c92eacc8ce4cc93c78fc5dba04ea750f68a65', 'owner-v35412'),
  },
  // v3.54.11: the same live reading (397a809's answers) built by the repaired code (84de494): the portal bands take
  // their source zone's finish (D53); everything else of the v3.54.10 candidate is unchanged — a third scene, the two
  // checkpoints below kept for comparison
  {
    key: 'marcowki-h-v35411',
    title: 'Marcówki — H po naprawie v3.54.11',
    subtitle: 'KANDYDAT H (nie oddany) po naprawie materiałów: ciemne pasy portalu ze strefy źródła; reszta jak v3.54.10; bez kominów',
    build: () => sealedOwnerModel('marcowki-h-v35411', '56c343b8424d5da8179a9acb715992ec746a38bd9ec931b6ce6cee13f61ace09', 'owner-v35411'),
  },
  // v3.54.11 (D52): the v3.54.10 checkpoint, exactly as in BuildPlan-V35410-Private.zip (SHA-256 4a75033c…): the H
  // candidate after the final replay (code 62350cc; the live job 397a809's answers; 15 rooms, 29 walls, 0 chimneys) and
  // the LOCAL model the host delivered (13 rooms, 40 walls, 2 chimneys) — sealed by the SHA-256 of their canonical
  // serialization; the v3.54.8 pair below stays as it was.
  {
    key: 'marcowki-h-v35410',
    title: 'Marcówki — H v3.54.10, kandydat',
    subtitle: 'KANDYDAT z odczytu API po recenzji (nie oddany), kod 62350cc: wnętrze, strefy wykończenia, skośne okna z opisów rzutu; bez kominów, pas portalu jasny',
    build: () => sealedOwnerModel('marcowki-h-v35410', 'd8c2d422edfc88132fac650b870dd072e3ba872cf95b9745e75d0b9a1fb3243e', 'owner-v35410'),
  },
  {
    key: 'marcowki-local-v35410',
    title: 'Marcówki — LOCAL oddany przez host',
    subtitle: 'Model oddany użytkownikowi przez host v3.54.10 (397a809 / d43eebe / 62350cc, ten sam): LOCAL — do porównania z kandydatem H',
    build: () => sealedOwnerModel('marcowki-local-v35410', 'b68f41e18efdefaa2c8dc18301938c6d81bea799a92f6085c43674961ac39626', 'owner-v35410'),
  },
  // v3.54.8 (owner request): the house described from the API's reading after its review, and the model the final host
  // (05faa4e) delivered for the same page (LOCAL), side by side — sealed by the SHA-256 of their canonical
  // serialization as they came out of the runs (`packages/candidates/src/owner-v3548/`, numbers and ids only).
  {
    key: 'marcowki-h-v3548',
    title: 'Marcówki — opis H v3.54.8',
    subtitle: 'KANDYDAT z odczytu API po recenzji (nie oddany): rama z nogami, szkło, pas portalu; głowice za nisko',
    build: () => sealedOwnerModel('marcowki-h-v3548', '37e24eed80fc694b9b9dbdf0ed4d0a02a267f61960f84dd6a5092641662a92ae', 'owner-v3548'),
  },
  {
    key: 'marcowki-local-v3548',
    title: 'Marcówki — LOCAL v3.54.8',
    subtitle: 'Model oddany przez host 05faa4e (LOCAL) — do porównania z opisem H',
    build: () => sealedOwnerModel('marcowki-local-v3548', 'b68f41e18efdefaa2c8dc18301938c6d81bea799a92f6085c43674961ac39626', 'owner-v3548'),
  },
  // BUILDPLAN-OWNER-005T: two development rows the analyzer now builds, listed first so the owner finds them at
  // once. Approximate models for a visual review — each carries LIMITING warnings in its stage report.
  {
    key: 'jarzmianki-005t-visual',
    title: 'Dom w jarzmiankach (005T)',
    subtitle: 'MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji (6 ostrzeżeń ograniczających)',
    build: () => sealedOwnerModel('jarzmianki-005t-visual', '74d173c8fc9a867eb82a52eeb0dd67bbb630baece0208d30143a53cd8d2413b2'),
  },
  {
    key: 'gozdzikowce-005t-visual',
    title: 'Dom w goździkowcach (005T)',
    subtitle: 'MODEL ORIENTACYJNY — nie do kosztorysu, wymaga weryfikacji; dach z przybliżonej kalenicy',
    build: () => sealedOwnerModel('gozdzikowce-005t-visual', '748694916af02f71e70f2421b21d18e8db0e2fe86719f15cbb466f605a178b55'),
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
