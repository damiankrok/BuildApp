# STAGE BUILDPLAN-ANALYZER-005Y-N5 — poprawki C1–C5, porządki dysku i gałęzi

Status: **OWNER_VISUAL_PENDING**. Nie ALL_PASSED, nie OWNER_ACCEPTED. Gałąź
`analyzer/005y-n4-general-architectural-understanding-v1`; domyślna gałąź, mirror `claude/new-session-3kzcgh`
(`bfaf286e…`), releases, APK i tagi nietknięte. Bez merge, bez budowy APK, bez pełnego CI.

## A/B — dysk i gałęzie

- Dysk: przed 37 GB zajęte / 645 MB wolne (99 %), po 19 GB zajęte / 19 GB wolne (51 %) — ok. **18 GB odzyskane**.
  Manifest usuniętych pozycji: `research/analyzer-005y-n5/deleted.tsv` (616 wpisów), `deleted-packages.txt`.
- Gałęzie zdalne: **58** głów, **2** tagi. Plan: zostawić 3 (domyślna, mirror, ta gałąź), usunąć 55 — wszystkie są
  przodkami tej gałęzi (`branch-plan-dryrun.tsv`). **Usuwanie ZABLOKOWANE**: proxy sesji odpowiada 403 na
  `git push --delete`. Gałęzie **nie zniknęły**. Gotowa komenda dla OWNER-a: `delete-branches-command.sh`.

## C — poprawki (generyczne, bez stałych pod jeden dom)

| # | Odkryłem (FIRST_BAD) | Zmieniłem | Wynik |
|---|---|---|---|
| C1 | Goździkowce: szare kółka 260/140 i 110/140 nie przechodziły bramki; narożnik kuchni zostawał murowanym słupem | czytanie połówek kółka, `PLAN_CORROBORATED_WIDTH` (szerokość odrzucona przez bramkę tylko gdy luka w rzucie się zgadza), `Opening.openEnd` + złącze przez narożnik CORNER w kompilatorze | narożnik otwarty, oba okna 0,80–2,20 (zoom Z1) |
| C2 | okna połaciowe stawiane z pierścienia, nie z symbolu | symbol (linia okapu + boki, przerywane), wspólna linia okapu rzędu, symbole bez pierścienia | Goździkowce 7/7 na symbolu lub linii rzędu, A01 6 + 1 znalezione bez pierścienia |
| C3 | Rarytasy: ściana boczna garażu brała krótszą linię siatki | pasma od najdłuższego; drzwi w ścianie pomieszczenia „garaż” | garaż 6,17 → 6,67 m, fantom 3,91×0,71 zniknął, drzwi 100/210; Marcówki — drzwi tylne garażu |
| C5a | A01: drugi przebieg pasm ucinał ściany biegnące przez cały dom | limit grubości z pasm ≥ 0,8 najdłuższego | głębokość 8,008 → 8,30 m, ściany 0,152 → 0,427 m |
| C5b | Cieszynianki: sylwetka elewacji frontowej kończyła się na okapie (dach wzięty za tło); rejestracja na pół-szerokim paśmie (0,037 m/px) trafiała grunt przypadkiem, więc żaden otwór frontu nic nie czytał | `roofTopOverBand` — wierzch dachu nad pasmem (płaski kalenicy albo zbieg trójkąta połaci), grunt rozstrzyga; nakładka ≥ 0,5 m (znak wodny) nad nadprożem to nie otwór; `overheadDoorTracks` — prowadnice bramy w rzucie | brama: okno 0,9–2,2 (założone) → **GARAGE_DOOR 2,75 × 0–2,26** (druk 275/225); kuchnia 0,78–2,28 (druk 150); okna tyłu odczytane (Z6, Z7) |
| C5c | Goździkowce: drzwi przy narożniku wnęki ucinane (skan ściany tylnej wnęki odsuwał się o 0,9 grubości od końców); szare kółko 70/210 odrzucane jak okno dachowe | `WallHost.endsAtFaces`; kółko tintowane = opis otworu na kondygnacji, nad którą jest inna | Goździkowce drzwi 0,70 × 2,10 (druk 70/210); Cieszynianki drzwi wnęki 0,88 → 1,06 (druk 105/210); A01 nadproże 2,04 → 2,20 (druk) |
| C4 | zabiegi schodów nigdy nie były czytane (`winderRegions: []`) | `winderTreadLines` — linie stopni wachlujące od słupka, równe kąty → segment `WINDER` | dowód syntetyczny (3 testy); na 8 domach zero zmian — patrz niżej |

Każda zmiana ma test kontrfaktyczny i negatywny (`elevation-garage-005y-n5`, `stair-winders-005y-n5`,
`tinted-ring-storey-005y-n5`, `open-corner-005y-n5`, `callout-plan-corroboration-005y-n5`, `rooflight-symbol-005y-n5`,
`wall-side-extent-005y-n5`, `garage-door-005y-n5`, `running-walls-005y-n5`). Bramki OCR nie były obniżane.

## Analogi (Trytomy, Arganie, Sasanki 3)

- Trytomy: brama 2,75 m WINDOW → GARAGE_DOOR (rzut rysuje prowadnice i samochód). Otwory 21 → 18: zniknęły okna o
  wysokości 0,30 i 0,73 m, ale zmieniły się też okna ściany zachodniej (3,68 m → dwa ok. 1 m) i drzwi 0,51 m —
  **tego nie zweryfikowałem ze źródłem**.
- Arganie, Sasanki 3: otwory bez zmian. Sasanki 3: „4 errors, 4 warnings” w przeglądarce — tak samo na początku N5.

## Czego nie zweryfikowano / co zostaje otwarte

- **Zabiegi**: Trytomy i Sasanki 3 rysują zabiegi, ale FIRST_BAD jest wcześniej — `findTreadLadders` nie składa biegów
  (Trytomy 1 drabinka, Sasanki 0). Detektor z C4 działa tylko na drugim etapie. Wymóg „≥ 3 źródła” **niespełniony**.
- Schody przecięte linią przekroju (A01, Trytomy, Goździkowce) liczą tylko narysowane stopnie → placeholder.
- Marcówki 1,9 cm komin↔ściana: **odmowa** — ok. 1 px rzutu (≈ 0,016 m/px), poniżej rozdzielczości źródła; nazwane.
- Rarytasy: wejście (słup, daszek, doświetle) — FIRST_BAD z N4 bez zmian; bok garażu 0,21 m krótszy od 688.
- Goździkowce drzwi 0,70 m we wnęce klasyfikowane WINDOW (próg GLAZED_DOOR 0,75 m) — wymiar jest drukowany, rodzaj nie.
- A01 narożnik: kawałki kończą się 0,36–0,39 m przed narożnikiem, nadproża różnią się o 0,015 m — narożnik zostaje
  zamknięty i nazwany.
- Cieszynianki: prawa elewacja boczna odrzucona (grunt 0,79 m wobec ok. −0,2 m pozostałych) — wschodnie okna mają
  wysokości założone.
- AI: `AI_SECOND_LOOK_LIVE_NOT_RUN` — brak zgody i klucza; żadne zapytanie do API nie poszło.

## Dowody (osobno)

- **Model**: hashe w `research/analyzer-005y-n5/ledger.json` (N4 → N5 dla 5 domów + 3 analogi).
- **Produkcja**: 5 + 3 pełne biegi offline z recogniserem (`second-house.ts`), każdy = replay bajt w bajt.
- **Domknięcie**: błędy zewnętrzne 0 (A01, Goździkowce, Marcówki, Rarytasy), Cieszynianki 2 — jak w N4.
- **Liveness**: maks. przerwa w telemetrii 3,3–7,6 s, bez zawieszeń.
- **Wizualnie**: 8 widoków × 5 domów (+ analogi), te same kamery przed/po, 10 zbliżeń — ZIP-y poza repozytorium.

## Testy

`tsc` czysty; reconstruction + model + source-metrics: 98 plików / 1303 testy zielone. Znane czerwone sprzed N5:
`packages/mobile-scene` `parity.test.ts` (2) — modele zapisane na dysku.
