# N7-COUNCIL-001 — minimalne reprodukcje

Wszystko uruchamia się z katalogu `/home/user/BuildApp`. Harnessy są badawcze
(`research/analyzer-n7-council/<recenzent>/`), działają offline na fiksurach syntetycznych albo na zapieczętowanym
korpusie N7 i nie zapisują rastrów wydawcy do repozytorium. Kod produkcyjny jest niezmieniony.

## Macierz A–H z zadania

Poziom dojścia oznacza, jak daleko przebieg przechodzi przez ścieżkę:

`SOURCE INPUT → LAYOUT → MASS/STOREY RECT → COMMAND PROGRAM → VALIDATOR → MODEL → MOBILE SCENE`.

| przypadek | harness | poziom dojścia | wynik dziś |
|---|---|---|---|
| **A.** ATTACHED o stałym obrysie, szerokość < 2T | `packages/analysis-service/test/thin-body-n7-p2r.test.ts` (SLIVERTON); F `thinwall-openings-e2e.ts --n=2` | cała ścieżka do sceny (runAnalysis) | SLIVERTON: KEEP_PARTIAL z konfliktem wymiaru → WALLS_OVERLAP przy poleceniu 21. THINWALL + 2 okna: **F-R1**, ta sama sygnatura |
| **B.** poprawny obrys bazowy, węższy `storeyRect` | D `h1-storeyrects-pieces.ts`; D `e2e-storeyrect.ts -- --d=0.4,0.55,0.7,1.0,1.5,2.0`; C `probe-thin-gap.ts` | emisja → walidator → podgląd; z runAnalysis wąski `storeyRect` nie powstaje (bramka 1,0 m) | na emisji: `ring-attached-0-1` odrzucony bez adjudykacji, a podgląd tnie zdrową kondygnację 0. Z layoutu: piętro ≤ 1,0 m zastąpione całą bryłą bez wpisu |
| **C.** `pieceOf` z za wąskim pierścieniem | D `h1` | emisja → walidator → podgląd | `ring-main-s1-1-1` odrzucony bez adjudykacji; z layoutu nieosiągalne (bramka) |
| **D.** jedna ściana wspólna bez jawnego `openSide` | `thin-body-n7-p2r.test.ts` (SLIVERTON_DIMENSIONED); D `h5` | cała ścieżka (SLIVERTON_DIMENSIONED); emisja (h5) | pełne pokrycie: SHARED_WALL, COMPLETE, poprawnie. Pokrycie częściowe: SHARED_WALL i **2,5 m dziury w obwiedni** (D-4) |
| **E.** poprawny łańcuch, błędna segmentacja tuszu | `research/analyzer-005y-n7-p2r/corpus-demo.ts` (marcówki, `diagnostics.narrowMass`) | prawdziwy program z korpusu → model | WIDEN po łańcuchu 415 cm: model bajt w bajt jak oryginał. Bez P2R: WALLS_OVERLAP przy poleceniu 21 |
| **F.** niejednoznaczny OCR rozstrzygany elewacją | `packages/reconstruction/test/facade-alignment-n7-p2.test.ts` (275/225); marcówki brama (P2) | prawdziwy program (marcówki) i test jednostkowy | rozstrzyga tylko wysokość otworu. Dla szerokości bryły brak takiej ścieżki: konflikt wymiaru daje KEEP_PARTIAL |
| **G.** poprawna bryła, elewacja z drzewami i cieniami | E `thin-body-sky.ts` | funkcja `elevationOver` z prawdziwym `skyMask` | **E-1**: drzewa i bryła z tyłu = „zabudowa” (builtShare 1,0); fałszywe WIDEN 8,45 → 11,99 m. Żywopłot 1,6 m: 0,595 (tuż pod progiem) |
| **H.** prawidłowy model, nic nie powinno się zmienić | `research/analyzer-005y-n7-p2/replay.ts` × 8 (`p2run.sh`) | prawdziwe programy → model | 8/8 modeli bajt w bajt (a6849073, 852c257a, 8541ca10, 5394c17c, 73969751, d2bf0c03, 34a95a76, 090749f4); żadna bryła < 2T, `thinBodies` puste |

## Pozostałe reprodukcje (po recenzentach)

| ID | polecenie | co pokazuje |
|---|---|---|
| D-1 | `npx vite-node research/analyzer-n7-council/D/h2-reconcile-narrows.ts`; `…/D/h2b-reconcile-record.ts` | 0,62 m → 0,57 m po rekoncyliacji, odmowa w1/w3 przy poleceniu 21, zapis EDGE_MOVED zgubiony; kontrolka 0,70 m przechodzi |
| D-3 | `…/D/h3-thickness-openside.ts`; `…/D/h4-thin-many-openings.ts` | FILL_TOO_LARGE przy grubości 0,12 m; 13 otworów → próg 12 cięć |
| D §0 | `…/D/h6-checkpoint.ts` | punkt kontrolny 16 i polecenie 21 wymuszają 1 poziom (2 poziomy dają 19/24 albo 17/22) |
| B-1 | `research/analyzer-n7-council/B/run-band.sh <out>` | T vs lica zewnętrzne dla 8 domów (gozd 0,304 vs 0,431) |
| B (wzór) | `…/B/ring-overlap.ts` | nakładanie w1/w3 = (2T − W)(L − 2T), zgodne z walidatorem 6/6 |
| B-4 | `…/B/attic-scale-repro.ts` | poddasze arganiach w skali 1/3 |
| B-5 | `…/B/inset-storey-faces.ts` | piętro cofnięte 0,5 m przyjęte przy 10,5 % błędu skali |
| C-1 | `…/C/probe-merge.ts`; `…/C/probe-tiling.ts -- --only t-strip120` | garaż wcielony; fantomowa bryła; REJECTED → COMPLETE |
| C-2 | `…/C/probe-tiling.ts -- --only gb-setback-door --gaps` | garaż utracony bez wpisu (kontrolki wykrywają) |
| C-6/C-7 | `…/C/probe-layout.ts -- --only c-inset-east`; `…/C/probe-wings.ts -- --only w-gap1-21-nodoor` | kondygnacja usunięta; wnęka domknięta zależnie od drzwi |
| A-1 | `…/A/plan-regs.ts`; `…/A/plan-diag.ts arganiach` | skale kopii jednego rzutu |
| A-2/A-3/A-5 | `…/A/mutate.ts <dom> <mutacja>` (np. `sasankach3 none,atticAsUpper`, `marcowki undimension`) | fantomowa kondygnacja; całkowita odmowa; zamiana FRONT/REAR bez sygnału |
| A-6 | `…/A/roles-hazards.ts` | słownik ARCHON w przypadkach brzegowych |
| E-2/E-7 | `…/E/cut-body-report.ts -- --run R --package P --cache C` | szerokość 8,35 m „zgodna”; raport wymienia wycięty otwór |
| E-4 | `…/E/side-choice.ts -- --run R --package P --cache C` | utrata obu bocznych elewacji |
| F-1 | `…/F/thin-skip.ts` | pominięcie `storeyRects`/pieces w `thinBodies` |
| F | `…/F/sliverton-discriminators.ts` | wpis „the body attached-k, X m across” i solver 2.5.0 jako rozróżnik |
| F-R1 | `…/F/thinwall-openings-e2e.ts -- --n=1|2|4`; `…/F/thinwall-n4-gaps.ts` | otwory → CANOPY → KEEP_PARTIAL → sygnatura OWNER-a; przy 4 oknach bryła znika |

Uruchomiony przeze mnie sprawdzian kontrolny przed werdyktem:

- `thinwall-openings-e2e.ts --n=2` → `PARTIAL_3D_PREVIEW`, `21 createWallRing ring-attached-0-0 WALLS_OVERLAP`,
  KEEP_PARTIAL, CANOPY_ON_POSTS SUPPORTED;
- `h2-reconcile-narrows.ts` → „all assertions hold”.
