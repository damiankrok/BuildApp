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
  // v3.54.18 final host job (Ballina, Lipińscy; fresh reads): LOCAL stood in the body arbitration (the other body contradicted too); sketch patches gated on the original picture, 6 CLOSED_VERIFIED by the look at the delivered revision; the repeat reused it at 0 USD.
  {
    key: 'ballina-host-v35418',
    title: 'Ballina — v3.54.18: oddany przez host',
    subtitle: 'ODDANY (host, świeży odczyt): LOCAL + 6 poprawek ze szkiców zamkniętych recenzją dostarczonej rewizji; okap ze źródła; otwarte: przeszklenie tylne do podłogi, cegła, panele PV',
    build: () => sealedOwnerModel('ballina-host-v35418', '9f754fb1fd2119ba97d365d0f3bb2b78b77306ad8f72c0c220aed55fc37f632d', 'owner-v35418'),
  },
  // v3.54.18 host job on the final commit (Willa Layla G2 A, ARCHON; outside the scored trial): LOCAL refused organically
  // (PLAN_LAYOUT_REJECTED); the body from the plan outline and the elevations, openings and chimneys from the sketches
  // through the shared executor, the delivered revision looked at. 41 differences open (1 KEY); 1.28 USD, 18 requests.
  {
    key: 'layla-host-v35418',
    title: 'Willa Layla G2 A (ARCHON) — v3.54.18: oddany przez host bez modelu LOCAL',
    subtitle: 'ODDANY (host, poza próbą): LOCAL odmówił; bryła ze źródeł, otwory i kominy ze szkiców, recenzja dostarczonej rewizji; BUDGET_OR_ROUND_LIMIT, 41 różnic otwartych (1 KEY); wnętrze NOT_CHECKED',
    build: () => sealedOwnerModel('layla-host-v35418', '909b7477c6116e7c36d5340dbd486a5fb9ef6412ded8f3d6e267d2417b62b73e', 'owner-v35418'),
  },
  // v3.54.18 DEV (Alaska, Studio Atrium; R3 reads replayed, reviewer live): the source gate with the reading's own claims let the sketch openings in (22 closed on a verified revision); the body arbitration replaced LOCAL's body by the one from the plan outline and elevations (interior NOT_CHECKED). Open, named: the entrance door, sides a quarter-turn round.
  {
    key: 'alaska-v35418',
    title: 'Alaska — v3.54.18: elewacje ze szkiców',
    subtitle: 'ROZWÓJ (odczyty nagrane R3, recenzja na żywo): 4 osobne okna, okna połaciowe, przeszklenie tylne; bryła ze źródeł (bez wnętrza); otwarte: drzwi wejściowe, strony o ćwierć obrotu',
    build: () => sealedOwnerModel('alaska-v35418', '20b47a72b9537b63fe021775cd0ec7a7eeb48317d7aa08d6a352d9b2b9c0ba47', 'owner-v35418'),
  },
  // v3.54.18 DEV (Aurora maxi II bis sz; R3 reads replayed, reviewer live): front windows apart, roof clean; 18 differences open (0 KEY).
  {
    key: 'aurora-maxi-v35418',
    title: 'Aurora maxi II bis — v3.54.18',
    subtitle: 'ROZWÓJ (odczyty nagrane R3): okna frontu rozdzielone, dach czysty, 3 kominy; otwarte: drzwi w podcieniu, pas-widmo na szczycie',
    build: () => sealedOwnerModel('aurora-maxi-v35418', '40c8482d15fe3925db6374fc9d47e9253ae63950034f4691efc1e8902f777ba0', 'owner-v35418'),
  },
  // v3.54.18 DEV (Ballina; R3 reads replayed, reviewer live): body arbitration REPLACED_BY_SOURCE_BODY (LOCAL contradicted twice, the other body never); every opening of four sides from the sketches; overhang from the wall-corner tops.
  {
    key: 'ballina-v35418',
    title: 'Ballina — v3.54.18: bryła ze źródeł',
    subtitle: 'ROZWÓJ (odczyty nagrane R3): komplet otworów czterech stron, okap 0,81 m; bryła ze źródeł (bez wnętrza); otwarte: cegła frontu',
    build: () => sealedOwnerModel('ballina-v35418', '78a0e9791e218db4a90b61ab6733d030a6cda6ac395bc192b600bb4bf2abba22', 'owner-v35418'),
  },
  // v3.54.18 NEW-B (Alberto): the 14 openings the compiler did not cut are cut (wall top = roof underside); LOCAL's phantom glazing stays where the source gate would not remove it. A kept failure.
  {
    key: 'alberto-v35418',
    title: 'Alberto (Studio Atrium) — v3.54.18',
    subtitle: 'NOWY DOM (pierwszy wynik na kodzie bazowym zachowany w raporcie): otwory widoczne po naprawie wierzchu ściany; NIEUŻYTECZNA: front prawie ciągłe przeszklenie, drzwi na skraju',
    build: () => sealedOwnerModel('alberto-v35418', '481efa0d862c09b84d7a1e2ae70624a22431904ade7e3da5303e18fd3bd1b741', 'owner-v35418'),
  },
  // v3.54.18 NEW-B (Medulin): LOCAL's four-mass body stands (the other body contradicted six times). A kept failure.
  {
    key: 'medulin-v35418',
    title: 'Medulin (Lipińscy) — v3.54.18',
    subtitle: 'NOWY DOM, NIEPOWODZENIE ZACHOWANE: bryła LOCAL z czterech członów zamiast jednej pod stromym dachem; arbitraż nie znalazł niesprzecznej bryły',
    build: () => sealedOwnerModel('medulin-v35418', '79686056feef0f7d733519e891cf2776ef15edbbb60149edf9cdfa2326565c81', 'owner-v35418'),
  },
  // v3.54.18 NEW-B (Domek letniskowy nad jeziorkiem): LOCAL's body stands (arbitration 1.1.0: a contradicted body replaces nothing); finishes from the sketch zones.
  {
    key: 'jeziorko-v35418',
    title: 'Domek letniskowy nad jeziorkiem (ARCHON) — v3.54.18',
    subtitle: 'NOWY DOM: dobry już na kodzie bazowym; po zmianie strefy wykończenia (czarny panel tylny jest błędem), bryła LOCAL obroniona przed zastąpieniem',
    build: () => sealedOwnerModel('jeziorko-v35418', 'b32f1417978904195d88b75475aa267f2c03b513f53c37d81fa256fc190f7f5d', 'owner-v35418'),
  },
  // v3.54.18 NEW-C blind first result (Mindelo): kept as is. Form beyond the supported scope (three wings).
  {
    key: 'mindelo-blind-v35418',
    title: 'Mindelo (Lipińscy) — próba ślepa v3.54.18, pierwszy wynik',
    subtitle: 'PRÓBA ŚLEPA, pierwszy wynik na kodzie końcowym: NIEUŻYTECZNA — pięć członów z płaskimi przybudówkami zamiast poprzecznych szczytów (forma poza zakresem)',
    build: () => sealedOwnerModel('mindelo-blind-v35418', '9c649ebf2081fc4c1c3551a448c5f64a0fbf5658606772e46f32a4008fdbaca1', 'owner-v35418'),
  },
  // v3.54.18 NEW-C blind first result (Dom pod sakurą E): LOCAL refused; the body from the plan outline (simplified: a named miniature convention) and the elevations; 22 facts of the sketches built. Hip roof beyond scope.
  {
    key: 'sakura-blind-v35418',
    title: 'Dom pod sakurą E (ARCHON) — próba ślepa v3.54.18, pierwszy wynik',
    subtitle: 'PRÓBA ŚLEPA, pierwszy wynik: kod bazowy NO_MODEL → model ze źródeł z otworami frontu i tyłu; NIEUŻYTECZNA wg reguły: dwuspad zamiast czterospadowego, komin-widmo',
    build: () => sealedOwnerModel('sakura-blind-v35418', 'f16755a867b8b6f6fedc70be435c4c2ee72545c150489a072f413057eae0c1b3', 'owner-v35418'),
  },
  // v3.54.18 NEW-C blind first result (G6): no elevation registered; identical to the base code's model. A kept failure.
  {
    key: 'g6-blind-v35418',
    title: 'G6 (Dobre Domy) — próba ślepa v3.54.18, pierwszy wynik',
    subtitle: 'PRÓBA ŚLEPA, NIEPOWODZENIE ZACHOWANE: dwuspad zamiast czterospadowego, strony obrócone, brak bramy i drzwi; identyczny z kodem bazowym',
    build: () => sealedOwnerModel('g6-blind-v35418', '7834fd7893bde09c10edb82f7157e5084246368e5d6a5a47067c868ab87c2ac7', 'owner-v35418'),
  },
  // v3.54.17 final host job on 14a34bf (Alaska, Studio Atrium): LOCAL + the live metric read built two bodies; the
  // sketch channel's SET_ROOF gave the main body the gable the elevations draw (region gate PROPOSED, 97 % drawn matter),
  // delivered and looked at. Publisher's facts (never read): ridge 7.84 vs 7.68 m, pitch 42.7 vs 40°. The annex's
  // proposal (87° from its own narrow extent) was refused by the kernel and rolled back — named.
  {
    key: 'alaska-host-v35417',
    title: 'Alaska — v3.54.17: dach ze źródła (oddany, host)',
    subtitle: 'ODDANY: SET_ROOF bryły głównej przez host, kalenica 7,84 m (strona: 7,68), 42,7°; dobudówka odrzucona (87°), jakość NEEDS_EVIDENCE',
    build: () => sealedOwnerModel('alaska-host-v35417', 'f0c3b54ba93c78465689e25ecfb3f3d149419576dc4a8d0050f9d4d116869a75', 'owner-v35417'),
  },
  // v3.54.17 (Alaska, Studio Atrium, DEV: the v3.54.16 trial's recorded answers replayed, the reviewer live once): the
  // body had no roof; the sketch channel's SET_ROOF built the gable the elevations draw (read under the 90° turn their
  // heights agree on), gated on the original picture and closed by the look at the delivered revision (CLOSED_VERIFIED).
  // Measured against the publisher's facts it never read: ridge 7.48 vs 7.68 m, pitch 41.4 vs 40°. Open, named: the
  // window rhythm and roof windows, the chimneys (unsupported).
  {
    key: 'alaska-dev-v35417',
    title: 'Alaska — v3.54.17: dach dwuspadowy ze źródła (DEV)',
    subtitle: 'ROZWÓJ: SET_ROOF z elewacji, kalenica 7,48 m (strona: 7,68), 41,4° (strona: 40°); CLOSED_VERIFIED; otwarte: rytm okien, okna dachowe, kominy',
    build: () => sealedOwnerModel('alaska-dev-v35417', 'fa9be01e4aa56d56023990da4146212d65b599cd2d310f3ca26fe76c9b8c06c1', 'owner-v35417'),
  },
  // v3.54.17 frozen trial (Studio Atrium Aurora-maxi-ii-bis-sz), first result kept as is: LOCAL's gable model, no
  // patch kept; 8 differences open (UNSUPPORTED_OPERATION). The second trial family failed on the host (named).
  {
    key: 'aurora-maxi-trial-v35417',
    title: 'Aurora maxi II bis (Studio Atrium) — próba v3.54.17, pierwszy wynik',
    subtitle: 'PRÓBA ZAMROŻONA: pierwszy wynik przez host; brak zatwierdzonej korekty, 8 różnic otwartych (UNSUPPORTED_OPERATION)',
    build: () => sealedOwnerModel('aurora-maxi-trial-v35417', '01e6b86d153635a2c344b07b7b5836b48f1145bad4aeb7f0da72cefe9873d4f0', 'owner-v35417'),
  },
  // v3.54.16 (Ballina, delivered by the final host job on f75d205): the correction executor's patches from the sketches —
  // five front openings and one on the right moved/resized against the source, the missing left window added — each
  // gated on the original picture, built, measured back, and closed by a look at the delivered revision (7 CLOSED_VERIFIED).
  // Open, named: the rear sliding door (no proposal), solar panels (unsupported), brick plinth (no proposal).
  {
    key: 'ballina-v35416',
    title: 'Ballina — v3.54.16: korekty wykonawcy (oddany, host)',
    subtitle: 'ODDANY: 7 korekt otworów ze szkiców przez wspólnego wykonawcę, zamkniętych recenzją dostarczonej rewizji; otwarte: drzwi tarasowe, panele (nieobsługiwane), cokół',
    build: () => sealedOwnerModel('ballina-v35416', '7f4bb112baeeb76716225cd1434f292143eb4530eb49aaef12fc0f2481230d84', 'owner-v35416'),
  },
  // v3.54.16 (Murcja, DEV replay of recorded answers through the new sketch channel): the rear chimney added, two
  // openings updated; the other proposals refused by the source or waiting for evidence. Not a host job.
  {
    key: 'murcja-v35416',
    title: 'Murcja — v3.54.16: komin i otwory z kanału szkicu (odtworzenie DEV)',
    subtitle: 'ROZWÓJ: odtworzenie zapisanych odpowiedzi; komin z tyłu dodany (bramka źródła), 2 otwory poprawione, reszta odrzucona lub bez dowodu',
    build: () => sealedOwnerModel('murcja-v35416', '2064fd05ab839e8313111acaec9137f1931d557511b158b871f85687e3a3f5c4', 'owner-v35416'),
  },
  // v3.54.16 controlled proof 2 (a TEST, not a house result): the front window moved 0.6 m by injection, then repaired by
  // UPDATE_OPENING against the source picture; the two scenes are after and before.
  {
    key: 'ballina-test-after-v35416',
    title: 'Ballina — TEST: zły otwór naprawiony względem źródła',
    subtitle: 'TEST KONTROLOWANY: okno frontu po naprawie (UPDATE_OPENING, z źródła 7,55 vs 1,73); nie jest wynikiem domu',
    build: () => sealedOwnerModel('ballina-test-after-v35416', 'eb82a42262a782756dec04178ef1ce574218faa6032b1fbbb8c0b63e9b7ab265', 'owner-v35416'),
  },
  {
    key: 'ballina-test-before-v35416',
    title: 'Ballina — TEST: otwór celowo przesunięty o 0,6 m',
    subtitle: 'TEST KONTROLOWANY: stan przed naprawą, wstrzyknięty błąd; nie jest wynikiem domu',
    build: () => sealedOwnerModel('ballina-test-before-v35416', 'a8442715df35e2b798da3cd0b484cb4660fa4e3a4acfd3f5ac729de4227307ee', 'owner-v35416'),
  },
  // v3.54.16 frozen trial, Studio Atrium Alaska, first result kept as is: a flat box where the source has a gable; the
  // reviewer named ROOF_FORM (KEY) as UNSUPPORTED — the registry cannot change a roof form.
  {
    key: 'alaska-trial-v35416',
    title: 'Alaska (Studio Atrium) — próba v3.54.16, pierwszy wynik',
    subtitle: 'PRÓBA ZAMROŻONA: pierwszy wynik; brak dachu dwuspadowego (forma dachu nieobsługiwana), jakość UNSUPPORTED_OPERATION',
    build: () => sealedOwnerModel('alaska-trial-v35416', 'cafedeaac44f2f8ea507a535eabdc5ce53c5a1ac74703607b6475f59620625b4', 'owner-v35416'),
  },
  // v3.54.15 (Ballina, the regression house): the consultant's level marks admitted by the section's own ladder reach
  // the model — the ridge datum 5.54 (the template's +15.50 overruled), eaves 3.373, the gable at the page's 28°; the
  // full side drawings registered by their labels; finishes from three sketches (the form sketch rolled back: it would
  // have cost an opening). The LEFT window and the ceiling (+2,80, no symbol) are named gaps.
  {
    key: 'ballina-v35415',
    title: 'Ballina — v3.54.15: dach z rzędnych przekroju (oddany)',
    subtitle: 'ODDANY: kalenica 5,54 i okap 3,37 z rzędnych API przyjętych przez przekrój; drzwi wejściowe z rzutu; wykończenia ze szkiców; okno lewe i strop +2,80 nazwane jako luki',
    build: () => sealedOwnerModel('ballina-v35415', 'bce37b2b92fc53ef22ee946503186a7b90d9c3b6be50b4512b6c1f94ab959b43', 'owner-v35415'),
  },
  // v3.54.15 (Murcja, the fresh public control, first result on the frozen code): LOCAL alone read 12.72 m storeys and a
  // 17.1 m ridge; with the section's level marks admitted: storeys 2.80 / 4.30, ridge 7.10, eaves 3.848; finishes from
  // three sketches; the left side not registered (named). Kept as its first result.
  {
    key: 'murcja-v35415',
    title: 'Murcja — kontrola v3.54.15, pierwszy wynik (kontrolny)',
    subtitle: 'KONTROLA: pierwszy wynik po zamrożeniu; wysokości z rzędnych przekroju (LOCAL: 12,72 m kondygnacji); lewa elewacja niezarejestrowana',
    build: () => sealedOwnerModel('murcja-v35415', '4f84df37a80d16088105f269e0fcc15a4e19ebbd7e4a2d908e3456dd3407b840', 'owner-v35415'),
  },
  // v3.54.14 (delivered): the v3.54.13 miniature with the OWNER's three phone defects fixed in the appearance consumer
  // 1.1.0 — no bare strip at the +3.06 joint (off-grid floor joint), the timber and the white frame continuous behind
  // the balcony and the balustrade (occluded cells join the wall's partition), no dark patches behind the front railing
  // (no seed in the registration's uncertainty band). Usable geometry unchanged (fingerprint 0e493584fb4f7203).
  {
    key: 'marcowki-c-v35414',
    title: 'Marcówki — poprawka v3.54.14 (oddany)',
    subtitle: 'ODDANY: geometria bez zmian; bez jasnej linii na +3,06, drewno i rama ciągłe za balkonem, bez plam za balustradą',
    build: () => sealedOwnerModel('marcowki-c-v35414', 'a66428c88135d1ad2d30678943acd0ea4746d4d2977b96a9b37d16f48759a0f5', 'owner-v35414'),
  },
  // v3.54.14 (Bakopy, DEV, delivered): LOCAL's geometry with the metric consultant's 13 witnessed readings (sub-cm..3 cm
  // interior changes), the form candidate read with three accepted automatic sketches (a chimney), their finishes
  // (timber on the wing gable, the approach bay and the west panels); the FRONT walls kept at their tone before the
  // sketches — the front sketch failed the proportion check (consult/choose.ts)
  {
    key: 'bakopy-v35414',
    title: 'Bakopy — analizator z metryką API i szkicami (oddany, DEV)',
    subtitle: 'ODDANY (DEV): LOCAL + 13 odczytów API ze świadkiem + 3 zaakceptowane szkice (komin, drewno); front bez szkicu',
    build: () => sealedOwnerModel('bakopy-v35414', '1813e748c435df6c3b648b847e2df49ab62a0e5acd8bf0658a6dc9a8456edfd9', 'owner-v35414'),
  },
  // v3.54.14 (Ballina, the new simple house, AFTER the freeze): its first frozen run was a refusal (kept as recorded);
  // resolver 1.1.0 witnessed the API's printed overalls 1365 × 815 by the page's footprint 111.25 m² and the metric
  // layer settled the scale: walls, openings and rooms at 13.65 × 8.15 — no roof (the heights have no second witness)
  {
    key: 'ballina-v35414',
    title: 'Ballina — nowy dom, po zamrożeniu (częściowy, bez dachu)',
    subtitle: 'CZĘŚCIOWY: pierwszy bieg zamrożony = odmowa; po zamrożeniu obrys 13,65 × 8,15 z metryki API i pola zabudowy; dach nieodczytany',
    build: () => sealedOwnerModel('ballina-v35414', '7d7b182030ac87cc1a6efc83e30d43717724979436ed746937e71d6f4d819c2d', 'owner-v35414'),
  },
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
