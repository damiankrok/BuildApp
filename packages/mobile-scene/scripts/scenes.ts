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
  // v3.54.20 (2026-11-25): the delivered code's models — the held-out sample NEW-G first (byte-identical to the first
  // held-out run), then the 20 developmental houses (the ones the agreed structure changed first, regressions named),
  // then the two models the host served live. Failures are kept and named in the titles and subtitles.
  {
    key: 'amber-v35420',
    title: 'Amber IV (Studio Atrium) — v3.54.20: NEW-G (próba odłożona): bryła frontowa i poprzeczne skrzydło tylne jak w źródle',
    subtitle: 'dach: dwuspadowy 30°, dwuspadowy 33.2°; ściany wewnętrzne z rzutu: 12, drzwi wewnętrzne: 7; otwory zewnętrzne: 10; ZACHOWANE: ściany wewnętrzne 17 → 12 wobec 1352; kod oddawany odtworzony na odczytach biegu odłożonego',
    build: () => sealedOwnerModel('amber-v35420', '504a68840a81f45410de390b290a9cb6160ca17d4eaa904bb9fec8266acc9901', 'owner-v35420'),
  },
  {
    key: 'rockville-v35420',
    title: 'Rockville (Lipińscy) — v3.54.20: NEW-G (próba odłożona): wnętrze z rzutu, zewnętrze nieudane',
    subtitle: 'dach: dwuspadowy 29.8°; ściany wewnętrzne z rzutu: 14, drzwi wewnętrzne: 8; otwory zewnętrzne: 9; NIEUDANE ZEWNĘTRZE: brak drzwi wejściowych i obu poprzecznych szczytów',
    build: () => sealedOwnerModel('rockville-v35420', '457b26b4109643737bb0b4ffd6e2255a6fae66a8fb543f6df9dd06bd397dcec2', 'owner-v35420'),
  },
  {
    key: 'basiaiadam-v35420',
    title: 'Basia i Adam (Dobre Domy) — v3.54.20: NEW-G (próba odłożona): NIEUDANY',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 36, drzwi wewnętrzne: 4; otwory zewnętrzne: 20; NIEUDANY: jedno długie pudło pod jednym dachem; elewacje wydawcy są perspektywiczne, odczyt struktury nie został zadany',
    build: () => sealedOwnerModel('basiaiadam-v35420', '9c55232444ec044f24f6269f4439eb57dd6ac31a2d46996c727ec2f408696d03', 'owner-v35420'),
  },
  {
    key: 'jarzab-v35420',
    title: 'Dom pod jarząbem 25 (ARCHON) — v3.54.20: NEW-G (próba odłożona): bez zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 12, drzwi wewnętrzne: 7; otwory zewnętrzne: 11; bryła LOCAL jak w 1352',
    build: () => sealedOwnerModel('jarzab-v35420', '4b88cb15cb9d3c3ef82fd78c41ccf50069a26a00066ccfcb05c533f959534a20', 'owner-v35420'),
  },
  {
    key: 'skagen-v35420',
    title: 'Skagen (Lipińscy) — v3.54.20: DEV: dwie kondygnacje i garaż z uzgodnionego odczytu struktury',
    subtitle: 'dach: dwuspadowy 30°, dwuspadowy 30°; ściany wewnętrzne z rzutu: 5, drzwi wewnętrzne: 2; otwory zewnętrzne: 16; ZACHOWANE: wnętrze częściowe (6 z 8 ścian rzutu)',
    build: () => sealedOwnerModel('skagen-v35420', '70128456c9a3d2800708f45b31891efb2d7b15ae8a2eb503b18cd0f0d04c281e', 'owner-v35420'),
  },
  {
    key: 'fabia-v35420',
    title: 'Fabia (Dobre Domy) — v3.54.20: DEV: dach czterospadowy z uzgodnionego odczytu struktury',
    subtitle: 'dach: czterospadowy (4 połacie); ściany wewnętrzne z rzutu: 18, drzwi wewnętrzne: 9; otwory zewnętrzne: 11; ZACHOWANE: wnęki wejścia i tarasu niezbudowane; długość kalenicy to założenie prezentacji',
    build: () => sealedOwnerModel('fabia-v35420', 'c0072b6993c930116d2328794598ca967110a1b7b3f7b297bc30e6c031682c6e', 'owner-v35420'),
  },
  {
    key: 'medulin-v35420',
    title: 'Medulin (Lipińscy) — v3.54.20: DEV: jedna bryła pod dachem dwuspadowym zamiast płaskich przybudówek',
    subtitle: 'dach: dwuspadowy 46.6°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 6; otwory zewnętrzne: 15; UTRACONE: obrys uproszczony do prostokąta, otwory 24 → 15, ściany wewnętrzne 25 → 10',
    build: () => sealedOwnerModel('medulin-v35420', '2a066b334613e6952c412efaaa46319812e82dbdb6fe0a36f4b29db9b904b245', 'owner-v35420'),
  },
  {
    key: 'mindelo-v35420',
    title: 'Mindelo (Lipińscy) — v3.54.20: DEV: bryła główna i skrzydło garażu pod własnymi dachami',
    subtitle: 'dach: dwuspadowy 37°, dwuspadowy 27.3°; ściany wewnętrzne z rzutu: 15, drzwi wewnętrzne: 11; otwory zewnętrzne: 13; ZACHOWANE: brak poprzecznego szczytu od ogrodu; otwory 19 → 13',
    build: () => sealedOwnerModel('mindelo-v35420', 'd25638c94911531fefb72e454deadb51cad2339809e5c54df8f376b6b2ce8e45', 'owner-v35420'),
  },
  {
    key: 'eliza-v35420',
    title: 'Willa Eliza 5 G2 (ARCHON) — v3.54.20: DEV: dachy czterospadowe i dwie kondygnacje, układ brył nieudany',
    subtitle: 'dach: czterospadowy (4 połacie); ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 4; otwory zewnętrzne: 11; NIEUDANY UKŁAD: garaż w bryle piętrowej, brak drzwi wejściowych, 6 kominów',
    build: () => sealedOwnerModel('eliza-v35420', '3e0216b9204e8254da8f31a091916abe3630ec3cd7ff872a2669202fa441500e', 'owner-v35420'),
  },
  {
    key: 'amarylis-v35420',
    title: 'Amarylis (Studio Atrium) — v3.54.20: DEV: otwory odzyskane, szczyt frontowy utracony',
    subtitle: 'dach: dwuspadowy 46.1°, dwuspadowy 44.7°, dwuspadowy 36.5°; ściany wewnętrzne z rzutu: 12, drzwi wewnętrzne: 8; otwory zewnętrzne: 10; UTRACONE: duży szczyt frontowy (kalenica bryły głównej obrócona); otwory 5 → 10 z 17 w 1351',
    build: () => sealedOwnerModel('amarylis-v35420', 'a03e91ab4ef1eebd9d17820bacec665e47f578cfed216f2ed647d8778b667796', 'owner-v35420'),
  },
  {
    key: 'ametyst-v35420',
    title: 'Ametyst New (Studio Atrium) — v3.54.20: DEV: REGRES — bryła obrócona',
    subtitle: 'dach: dwuspadowy 35.2°; ściany wewnętrzne z rzutu: 12, drzwi wewnętrzne: 6; otwory zewnętrzne: 9; REGRES: front na dłuższym boku, kalenica wzdłuż krótszego; brak drzwi wejściowych',
    build: () => sealedOwnerModel('ametyst-v35420', '39f37fe2b32ccbd482153e230601a88fd092699209cfdd39be4c23c3db6088a8', 'owner-v35420'),
  },
  {
    key: 'aletta-v35420',
    title: 'Aletta New (Studio Atrium) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 37.6°, dwuspadowy 20.6°; ściany wewnętrzne z rzutu: 11, drzwi wewnętrzne: 3; otwory zewnętrzne: 14; ZACHOWANE: dach garażu zbyt płaski (20,6°)',
    build: () => sealedOwnerModel('aletta-v35420', '475b7ce70bc4cc77142bf6dd60797756972f843d266fd5c64412f5c70744e548', 'owner-v35420'),
  },
  {
    key: 'juliusz-v35420',
    title: 'Juliusz Nowy (Dobre Domy) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 37.4°; ściany wewnętrzne z rzutu: 11, drzwi wewnętrzne: 7; otwory zewnętrzne: 4; ZACHOWANE: 4 otwory zewnętrzne, bez garażu i krzyżujących się szczytów; odczyt „dach czterospadowy” odrzucony przez szkice',
    build: () => sealedOwnerModel('juliusz-v35420', '2b21dfa86bc19e7e9adba1fd7bed1219872d7fda80eddf7ba917eb825af916cb', 'owner-v35420'),
  },
  {
    key: 'g6-v35420',
    title: 'G6 (Dobre Domy) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: czterospadowy (4 połacie); ściany wewnętrzne z rzutu: 0, drzwi wewnętrzne: 0; otwory zewnętrzne: 3; UTRACONE: otwory 5 → 3 (strony dwóch elewacji bocznych zamienione)',
    build: () => sealedOwnerModel('g6-v35420', '3e1571e773072fd902d502a6007efacaf4d077d261d91122285fc6b757438aee', 'owner-v35420'),
  },
  {
    key: 'oban-v35420',
    title: 'Oban III (Lipińscy) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 31.5°; ściany wewnętrzne z rzutu: 8, drzwi wewnętrzne: 3; otwory zewnętrzne: 8; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('oban-v35420', '686d8f15ac22198aca78bad0e98e45484dd7df3c91b95d4ea5f81fc1b41a3122', 'owner-v35420'),
  },
  {
    key: 'novara-v35420',
    title: 'Novara (Lipińscy) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 27.8°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 8; otwory zewnętrzne: 13; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('novara-v35420', '817cde1e9f3dbe721284c607ff45f24e8e42031d804d0016760126d045f04c23', 'owner-v35420'),
  },
  {
    key: 'jarzebina-v35420',
    title: 'Jarzębina (Dobre Domy) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 46.3°; ściany wewnętrzne z rzutu: 15, drzwi wewnętrzne: 4; otwory zewnętrzne: 14; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('jarzebina-v35420', 'ef53166f833c68d5a803c096f0c8b271521594f90ad16e47e0752b9ecd271f10', 'owner-v35420'),
  },
  {
    key: 'pomarancza-v35420',
    title: 'Dom pod pomarańczą 2 (ARCHON) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 16, drzwi wewnętrzne: 10; otwory zewnętrzne: 11; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('pomarancza-v35420', 'ac0f279cf06bc734b97c3b624f13ca0f2f90d6d2435e367b131de8da5a94ad3b', 'owner-v35420'),
  },
  {
    key: 'alaska-v35420',
    title: 'Alaska (Studio Atrium) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 38.2°; ściany wewnętrzne z rzutu: 11, drzwi wewnętrzne: 6; otwory zewnętrzne: 11; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('alaska-v35420', '913a917c20269d683a05f1715c97830f7ec7218f7691c5a0879cc8a553a4f59a', 'owner-v35420'),
  },
  {
    key: 'aurora-v35420',
    title: 'Aurora maxi II bis sz (Studio Atrium) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 37°; ściany wewnętrzne z rzutu: 15, drzwi wewnętrzne: 7; otwory zewnętrzne: 10; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('aurora-v35420', 'dfec5efe1621a37acbfe77dd1ae44edb77c11a206b730cdf2cd5feea0572a931', 'owner-v35420'),
  },
  {
    key: 'ballina-v35420',
    title: 'Ballina (Lipińscy) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 30.8°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 7; otwory zewnętrzne: 10; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('ballina-v35420', '4cfbb9b8a15ef13ffaae5b31d6abc9c42feddbc2e90a437147291a51fd7f672d', 'owner-v35420'),
  },
  {
    key: 'alberto-v35420',
    title: 'Alberto (Studio Atrium) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 25.2°; ściany wewnętrzne z rzutu: 16, drzwi wewnętrzne: 8; otwory zewnętrzne: 9; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('alberto-v35420', 'e48991029834ff8087e9db7adc62a3ed889aa740a32a3dbb4d8831a075664d33', 'owner-v35420'),
  },
  {
    key: 'sakura-v35420',
    title: 'Dom pod sakurą E (ARCHON) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: czterospadowy (4 połacie); ściany wewnętrzne z rzutu: 20, drzwi wewnętrzne: 11; otwory zewnętrzne: 11; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('sakura-v35420', 'f637915cf44bf71840a9981253a043a379682101f3934d6cf380027ba0fba12f', 'owner-v35420'),
  },
  {
    key: 'jeziorko-v35420',
    title: 'Domek letniskowy nad jeziorkiem (ARCHON) — v3.54.20: DEV: bez istotnej zmiany wobec 1352',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 5, drzwi wewnętrzne: 2; otwory zewnętrzne: 7; niepowodzenia zachowane: patrz raport',
    build: () => sealedOwnerModel('jeziorko-v35420', '2bf92a615e03d63f7f3f091689acc13eec3e5cd0c5c9154e60425a985cc1426f', 'owner-v35420'),
  },
  {
    key: 'skagen-host-v35420',
    title: 'Skagen (Lipińscy) — v3.54.20: z hosta na finalnej rewizji (108611e)',
    subtitle: 'dach: dwuspadowy 30°, dwuspadowy 30°; ściany wewnętrzne: 5; otwory zewnętrzne: 16; świeży bieg na żywo przez publiczny punkt wejścia; bryła LOCAL odrzucona przez uzgodnioną strukturę (dwie kondygnacje, kalenica wzdłuż frontu)',
    build: () => sealedOwnerModel('skagen-host-v35420', '7fe23190bd6ce407722fada3da1ead1de1443258c528f0c22bd55cdcfb70e756', 'owner-v35420'),
  },
  {
    key: 'amber-host-v35420',
    title: 'Amber IV (Studio Atrium) — v3.54.20: z hosta (rewizja c153739, kod zamrożenia 2)',
    subtitle: 'dach: dwuspadowy 30°, dwuspadowy 33.9°; ściany wewnętrzne: 12; otwory zewnętrzne: 12; świeży bieg na żywo przez publiczny punkt wejścia; trzeci niezależny bieg tego domu z tą samą dekompozycją brył',
    build: () => sealedOwnerModel('amber-host-v35420', '5ead8582af5e2a7bd6996a5d742728ae6fc259a60a87f4feaefa5755d55643e4', 'owner-v35420'),
  },
  // v3.54.19 (2026-11-24): the final models of the stage (freeze 2), the second held-out sample NEW-F first, then NEW-E
  // (developmental after it was opened), NEW-D and the nine known houses; then the two models the host served from the
  // final revision. Failures are kept and named in the subtitles.
  {
    key: 'ametyst-v35419',
    title: 'Ametyst New (Studio Atrium) — v3.54.19: NEW-F (próba odłożona): wnętrze z rzutu w bryle ze źródeł',
    subtitle: 'dach: dwuspadowy 32.4°; ściany wewnętrzne z rzutu: 12, drzwi wewnętrzne: 6; otwory zewnętrzne: 9; ZACHOWANE: kominów w źródle 3, w modelu 0',
    build: () => sealedOwnerModel('ametyst-v35419', '93b0160005ca33332c79649024d7ea7874ce830a376134d39546b37023044c0f', 'owner-v35419'),
  },
  {
    key: 'skagen-v35419',
    title: 'Skagen (Lipińscy) — v3.54.19: NEW-F (próba odłożona): NIEUDANY',
    subtitle: 'dach: dwuspadowy 48.2°; ściany wewnętrzne z rzutu: 0, drzwi wewnętrzne: 0; otwory zewnętrzne: 9; NIEUDANY: jedna kondygnacja ze stromym dachem zamiast piętra z garażem; rzut nieodczytany (wnętrze puste)',
    build: () => sealedOwnerModel('skagen-v35419', '51c000bcfdaaaaf9951a4414a684f4b9b34098674ace4c72a9d5e71ec869b110', 'owner-v35419'),
  },
  {
    key: 'fabia-v35419',
    title: 'Fabia (Dobre Domy) — v3.54.19: NEW-F (próba odłożona): wnętrze z rzutu, dach błędny',
    subtitle: 'dach: dwuspadowy 28.8°; ściany wewnętrzne z rzutu: 18, drzwi wewnętrzne: 9; otwory zewnętrzne: 4; NIEUDANY DACH: dwuspadowy zamiast czterospadowego; komin utracony (1351 miał 1)',
    build: () => sealedOwnerModel('fabia-v35419', '098315c218ee4ce85515c4fc5f3c2b2891e6dc8499c55a02781a7a5a3e7c1528', 'owner-v35419'),
  },
  {
    key: 'pomarancza-v35419',
    title: 'Dom pod pomarańczą 2 (ARCHON) — v3.54.19: NEW-F (próba odłożona): bez zmiany wobec 1351',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 16, drzwi wewnętrzne: 10; otwory zewnętrzne: 11; bryła LOCAL jak w 1351',
    build: () => sealedOwnerModel('pomarancza-v35419', 'ac0f279cf06bc734b97c3b624f13ca0f2f90d6d2435e367b131de8da5a94ad3b', 'owner-v35419'),
  },
  {
    key: 'oban-v35419',
    title: 'Oban III (Lipińscy) — v3.54.19: NEW-E po R2 (rozwojowy): model tam, gdzie 1351 nie dawał żadnego',
    subtitle: 'dach: dwuspadowy 31.5°; ściany wewnętrzne z rzutu: 8, drzwi wewnętrzne: 3; otwory zewnętrzne: 8; wynik rozwojowy, nie dowód transferu',
    build: () => sealedOwnerModel('oban-v35419', '686d8f15ac22198aca78bad0e98e45484dd7df3c91b95d4ea5f81fc1b41a3122', 'owner-v35419'),
  },
  {
    key: 'juliusz-v35419',
    title: 'Juliusz Nowy (Dobre Domy) — v3.54.19: NEW-E po R2 (rozwojowy): bryła i wnętrze, za mało otworów',
    subtitle: 'dach: dwuspadowy 37.4°; ściany wewnętrzne z rzutu: 11, drzwi wewnętrzne: 7; otwory zewnętrzne: 4; ZACHOWANE: tylko 4 otwory zewnętrzne (bramka kontrastu), garaż bez osobnej bryły',
    build: () => sealedOwnerModel('juliusz-v35419', 'aed4c69e7adcd25940b08e1fc2b4fad27965e0e3732cdd556e17aea46e04038a', 'owner-v35419'),
  },
  {
    key: 'amarylis-v35419',
    title: 'Amarylis (Studio Atrium) — v3.54.19: NEW-E po R2 (rozwojowy): trzy bryły z dachami zamiast płaskiego pudełka',
    subtitle: 'dach: dwuspadowy 33.9°, dwuspadowy 42°, dwuspadowy 25°; ściany wewnętrzne z rzutu: 12, drzwi wewnętrzne: 8; otwory zewnętrzne: 5; UTRACONE: 12 otworów zewnętrznych wobec 1351 (17 → 5)',
    build: () => sealedOwnerModel('amarylis-v35419', '012b0f7e59b4235684a58a50e940bbabb788d35f39a369156840f5ca0a5056fd', 'owner-v35419'),
  },
  {
    key: 'aletta-v35419',
    title: 'Aletta New (Studio Atrium) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 42.7°, dwuspadowy 35°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 3; otwory zewnętrzne: 15; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('aletta-v35419', '6fd9b53d54ecf88bbc58ebe80b11a1ee7e1976bd158fa271b10cbb30e2e5e739', 'owner-v35419'),
  },
  {
    key: 'novara-v35419',
    title: 'Novara (Lipińscy) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 8; otwory zewnętrzne: 13; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('novara-v35419', 'da2aa4acbc1e9d6aa71af8cee84124a2a536e802a8f7c5e44ff8dbf60ea4a3cd', 'owner-v35419'),
  },
  {
    key: 'jarzebina-v35419',
    title: 'Jarzębina (Dobre Domy) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 46.3°; ściany wewnętrzne z rzutu: 15, drzwi wewnętrzne: 4; otwory zewnętrzne: 12; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('jarzebina-v35419', 'b9818c56a718e9db2016b9d5152b620e86e792213aefeb32e46dc801fdb97db9', 'owner-v35419'),
  },
  {
    key: 'eliza-v35419',
    title: 'Willa Eliza 5 G2 (ARCHON) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 28.3°, dwuspadowy 41.7°, dwuspadowy 28.3°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 4; otwory zewnętrzne: 10; NIEUDANY: bryła i dach niezgodne ze źródłem (dwie kondygnacje, dach czterospadowy)',
    build: () => sealedOwnerModel('eliza-v35419', '5c1a5765f1740b0a46c16ae380ed366344fe0df71e6e53821f72dcdba1ba6aed', 'owner-v35419'),
  },
  {
    key: 'alaska-v35419',
    title: 'Alaska (Studio Atrium) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 38.2°; ściany wewnętrzne z rzutu: 11, drzwi wewnętrzne: 6; otwory zewnętrzne: 11; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('alaska-v35419', '913a917c20269d683a05f1715c97830f7ec7218f7691c5a0879cc8a553a4f59a', 'owner-v35419'),
  },
  {
    key: 'aurora-v35419',
    title: 'Aurora maxi II bis sz (Studio Atrium) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 35°; ściany wewnętrzne z rzutu: 15, drzwi wewnętrzne: 7; otwory zewnętrzne: 10; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('aurora-v35419', '8f89ac1836b0949a5c0269b09abc1754dc18af90931e2dbd0b1b06179f767c81', 'owner-v35419'),
  },
  {
    key: 'ballina-v35419',
    title: 'Ballina (Lipińscy) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 30.8°; ściany wewnętrzne z rzutu: 10, drzwi wewnętrzne: 7; otwory zewnętrzne: 10; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('ballina-v35419', '4cfbb9b8a15ef13ffaae5b31d6abc9c42feddbc2e90a437147291a51fd7f672d', 'owner-v35419'),
  },
  {
    key: 'alberto-v35419',
    title: 'Alberto (Studio Atrium) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 25.2°; ściany wewnętrzne z rzutu: 16, drzwi wewnętrzne: 8; otwory zewnętrzne: 9; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('alberto-v35419', 'f43c5069262c53e183f142df7e6dc8cb5d06c0b0186e04e404b5cb4aff5338ce', 'owner-v35419'),
  },
  {
    key: 'sakura-v35419',
    title: 'Dom pod sakurą E (ARCHON) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: czterospadowy (4 połacie); ściany wewnętrzne z rzutu: 20, drzwi wewnętrzne: 11; otwory zewnętrzne: 11; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('sakura-v35419', 'f637915cf44bf71840a9981253a043a379682101f3934d6cf380027ba0fba12f', 'owner-v35419'),
  },
  {
    key: 'medulin-v35419',
    title: 'Medulin (Lipińscy) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: płaski, płaski, płaski, dwuspadowy 45°; ściany wewnętrzne z rzutu: 25, drzwi wewnętrzne: 9; otwory zewnętrzne: 24; NIEZMIENIONE: bryła LOCAL z płaskimi przybudówkami',
    build: () => sealedOwnerModel('medulin-v35419', '388aaad8c1a20af1e482455f238ddfc7bada0539d51b2ba91149f4cc070e21f7', 'owner-v35419'),
  },
  {
    key: 'mindelo-v35419',
    title: 'Mindelo (Lipińscy) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: płaski, płaski, płaski, płaski, dwuspadowy 30°; ściany wewnętrzne z rzutu: 15, drzwi wewnętrzne: 11; otwory zewnętrzne: 19; NIEZMIENIONE: bryła LOCAL z płaskimi przybudówkami',
    build: () => sealedOwnerModel('mindelo-v35419', 'fb559072b51bc3db86d3ee0ceaa696f53a4b861f36db3ad6f23d7f638a132293', 'owner-v35419'),
  },
  {
    key: 'jeziorko-v35419',
    title: 'Domek letniskowy nad jeziorkiem (ARCHON) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: dwuspadowy 30°; ściany wewnętrzne z rzutu: 5, drzwi wewnętrzne: 2; otwory zewnętrzne: 7; NIEPOWODZENIA ZACHOWANE: patrz raport',
    build: () => sealedOwnerModel('jeziorko-v35419', '2bf92a615e03d63f7f3f091689acc13eec3e5cd0c5c9154e60425a985cc1426f', 'owner-v35419'),
  },
  {
    key: 'g6-v35419',
    title: 'G6 (Dobre Domy) — v3.54.19: bryła, otwory i wnętrze z rzutu',
    subtitle: 'dach: czterospadowy (4 połacie); ściany wewnętrzne z rzutu: 0, drzwi wewnętrzne: 0; otwory zewnętrzne: 5; garaż ze strychem — nie dom mieszkalny; wnętrze puste',
    build: () => sealedOwnerModel('g6-v35419', 'a8f01436692c8b4c043ed62e4e308d02aa69ba5c057d666a7c160e3d4e352a50', 'owner-v35419'),
  },
  {
    key: 'alberto-host-v35419',
    title: 'Alberto (Studio Atrium) — v3.54.19: z hosta na finalnej rewizji (publiczne wejście, pilot)',
    subtitle: 'model oddany przez host zbudowany z finalnej rewizji: 15 żądań, 0,737 USD; powtórzenie tego samego linku użyło zapisanej rewizji bez żądania i kosztu',
    build: () => sealedOwnerModel('alberto-host-v35419', 'ffd49c883abb0e76bf7c34fbbf39334352690b91feb1f5b12ec0ea8d8eaa73c5', 'owner-v35419'),
  },
  {
    key: 'oban-host-v35419',
    title: 'Oban III (Lipińscy) — v3.54.19: z hosta na finalnej rewizji (publiczne wejście, pilot)',
    subtitle: 'dom, dla którego kod APK 1351 nie dawał modelu, oddany przez host zbudowany z finalnej rewizji: 11 żądań, 0,276 USD',
    build: () => sealedOwnerModel('oban-host-v35419', 'b68369b9afe0f8d0ec3f88a8e60d72d87986e25171ca558c0c86971d28334c5d', 'owner-v35419'),
  },
  // v3.54.18 R3 (2026-11-24): the four houses whose result changed in the second continuation round, first. Recorded
  // elevation reads; the plan read (plan-outline/3: entrance and exterior openings by side) and the review live.
  {
    key: 'alaska-r3-v35418',
    title: 'Alaska (Studio Atrium) — v3.54.18 R3: front domu jest frontem modelu',
    subtitle: 'R3: bryła ze źródeł zbudowana w układzie elewacji — frontem jest szczyt z wejściem (wejście z rzutu), boczne elewacje przypisane z otworów rzutu (7 do 1); 11 otworów, 8 okien połaciowych, 20 poprawek zamkniętych recenzją, 0 różnic KEY; otwarte: wykończenie szczytów, wnętrze NOT_CHECKED',
    build: () => sealedOwnerModel('alaska-r3-v35418', '77ab6318ca42369f8d7ae0fa2c7a8aa7f92e518eeb2aa7b0ef933a3750ed8ba6', 'owner-v35418'),
  },
  {
    key: 'g6-r3-v35418',
    title: 'G6 (Dobre Domy) — v3.54.18 R3: dach czterospadowy na bryle ze źródeł',
    subtitle: 'R3: skala rzutu z powierzchni zabudowy potwierdzona wysokością ze strony (kalenica 6,12 m przy 6,10 m); bryła 11,5 × 8,1 m z dachem czterospadowym 33,7° / 35,4° (strona: 35°), brama garażowa i 2 okna; NIEPOWODZENIA ZACHOWANE: brak drzwi wejściowych, ryzalitu z daszkiem i okien lewego boku; boki przypisane konwencją',
    build: () => sealedOwnerModel('g6-r3-v35418', '350b2c6ea20f2638c67af5cb14a1bfde211a2984431ad229781ac950c523a538', 'owner-v35418'),
  },
  {
    key: 'aurora-r3-v35418',
    title: 'Aurora maxi II bis sz (Studio Atrium) — v3.54.18 R3: bryła ze źródeł',
    subtitle: 'R3: skala rzutu z wymiarów 15,90 × 8,90 nad obrysem; bryła ze źródeł, dach 35° (strona: 35°), szczyty bez zmyślonych przeszkleń, 9 otworów przez bramkę źródła; NIEPOWODZENIA ZACHOWANE: brak tylnego przeszklenia tarasowego, wnętrze utracone (było w modelu LOCAL)',
    build: () => sealedOwnerModel('aurora-r3-v35418', 'a1968ffd4e70492f02abb4c22ed6885333906a1a7106ea48c0824c5ffa1dece3', 'owner-v35418'),
  },
  {
    key: 'alberto-r3-v35418',
    title: 'Alberto (Studio Atrium) — v3.54.18 R3: okno szczytowe po właściwej stronie',
    subtitle: 'R3: boczne elewacje przypisane z otworów rzutu — okno na prawym szczycie, lewy pusty; dach 25,1° (strona: 25°), 7 otworów; NIEPOWODZENIA ZACHOWANE: brak drzwi wejściowych i podcieni, wnętrze utracone',
    build: () => sealedOwnerModel('alberto-r3-v35418', '086b9263fe521d30c7a6f790f627b5475ea572b5ee4b6f31d7f83cd9147caf45', 'owner-v35418'),
  },
  // v3.54.18 R2 (2026-11-24): the four houses whose result changed in the continuation round, first. Recorded elevation
  // reads; the plan read (plan-outline/2) and the review live. Each is labelled for what it is, the open items named.
  {
    key: 'sakura-r2-v35418',
    title: 'Dom pod sakurą E (ARCHON) — v3.54.18 R2: dach czterospadowy',
    subtitle: 'R2: dach czterospadowy odczytany z elewacji (trapez wzdłuż kalenicy) — cztery połacie ~30°, kalenica 4,9 m od ścian szczytowych, okap 0,87 m; bryła ze źródeł, 9 otworów; otwarte: 1 różnica KEY, bryła L uproszczona do prostokąta, wnętrze NOT_CHECKED',
    build: () => sealedOwnerModel('sakura-r2-v35418', 'fd9ee12f66836ed7265e4277a7640b709a25bd2d581fe39e4eac093b8a1c98d6', 'owner-v35418'),
  },
  {
    key: 'alberto-r2-v35418',
    title: 'Alberto (Studio Atrium) — v3.54.18 R2: dach i szczyty ze źródła',
    subtitle: 'R2: bryła ze źródeł po odczytaniu szczytu — dach 25,2° (strona wydawcy: 25°), ściana pod okapem 3,17 m, 7 otworów przez bramkę źródła (6 ze świadkiem z rzutu), szczyty bez zmyślonych przeszkleń; NIEPOWODZENIA ZACHOWANE: brak drzwi wejściowych, wnętrze utracone, wykończenia cofnięte przez recenzenta',
    build: () => sealedOwnerModel('alberto-r2-v35418', '4b0463716bb3a4c47f6c8957a9b8691d67987d4e0d8a134ae58b0ae73323c0a2', 'owner-v35418'),
  },
  {
    key: 'alaska-r2-v35418',
    title: 'Alaska (Studio Atrium) — v3.54.18 R2: kierunek obrotu z wejścia na rzucie',
    subtitle: 'R2: elewacje obrócone o 90°, kierunek rozstrzygnięty wejściem głównym z rzutu (lewy bok) — drzwi na obu szczytach, 11 otworów, 8 okien połaciowych; NIEPOWODZENIE ZACHOWANE: recenzent — długie boki zamienione (podpis „elewacja boczna” nie mówi, która jest lewa); wnętrze NOT_CHECKED',
    build: () => sealedOwnerModel('alaska-r2-v35418', '42f1b105aa9b03e60015eca4832bfb2bb76e912d7a64c225788cac7721cbdca3', 'owner-v35418'),
  },
  {
    key: 'ballina-r2-v35418',
    title: 'Ballina (Lipińscy) — v3.54.18 R2: szczyty czytane jako szczyty',
    subtitle: 'R2: oś kalenicy z dwóch widoków szczytu (było: remis czterech „pasów”), dach 30,4°, okap 0,80 m, 10 otworów zamkniętych recenzją; ten sam wynik na odczycie rzutu, który wcześniej zostawił dom bez dachu; wnętrze NOT_CHECKED',
    build: () => sealedOwnerModel('ballina-r2-v35418', 'a81eeb481380c2090c112a9bd0f41b2ead1ad62aa81a4d5b6f946e2df4d05a52', 'owner-v35418'),
  },
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
