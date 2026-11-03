# STAGE BUILDPLAN EXTERIOR-COMPLETE — rozpoznawalny cały dom (raport roboczy)

Status: **WORK_IN_PROGRESS.** Kryterium odbioru nie jest spełnione (§3); kampania trwa. Ten raport opisuje stan po
dostawie testowej 1315 i jest aktualizowany przy kolejnych dostawach. Dziennik punktów kontrolnych:
`stage-reports/EXTERIOR_COMPLETE_LOG.md` (E0–E4).

## 1. Zamrożona ocena (przed strojeniem)

- **DEV 13** (każdy w mianowniku, także bez modelu): Arlety 3 E OZE, Jabłonki 22, Miniaturka 2 v3, Willa Maja R2,
  Dalie 5 GE, Azalie 3, Bratki 26 R2BE, Pod Miłorzębem 21 GB, Modrzewnica 10 G2E OZE, Muraje, Lipienniki 5, Aurory 26 G,
  Kostrzewy 4.
- **Regresja 8**: a01, arganiach, ciesz, gozd, marcowki, rary, sasankach3, trytomach.
- **Holdout H2** (zapieczętowany, nieotwarty): 6 domów; **H3** w rezerwie. Nazwy w dzienniku.
- Listy elementów ze źródeł: `stage-reports/artifacts/exterior-complete/source-elements.json` (90 pozycji, 13 domów);
  postać sprawdzalna: `expectations.json`; sprawdzarka: `research/exterior-complete/check.py`.
- Korekta sprawdzarki (E3, jawna): słupek to każdy słupek nośny (`POST`, `COLUMN`, `PERGOLA_POST`), a słupki i zadaszenia
  ocenia się po stronie, jak balkony. Pierwsza wersja nie liczyła pergoli w ogóle. Żadna tolerancja nie została
  poluzowana.

## 2. Co zmieniono (przyczyny, nie domy)

| zmiana | pierwsza zła decyzja | gdzie |
|---|---|---|
| Okno/brama/drzwi po licu otworu na elewacji; brama segmentowa | szeroki otwór na parterze zawsze szkłem | `opening-reading.ts`, `fills.ts` |
| Rolety ≠ płyta: lico zmienia ton co kilka wierszy → nie płyta | szkło za żaluzją czytane jako drzwi | `openingFace` |
| Jedna roleta dachowa na obrys na połaci | dwa odczyty jednego okna dachowego | `reconstruct-v2.ts` |
| Linia wymiarowa przesłonięta (logo) łączona | 1020 wiązane z 412 px zamiast 660 | `dimension-lines.ts` 1.3.0 |
| Najwyższa rzędna odrzucona jako kalenica, gdy publikowana wysokość i rysunek przekroju mówią, że nad nią stoi dach | +5,50 (okap) brane za kalenicę | `roof-datum.ts`, `section-datums.ts` |
| Pionowe etykiety: arkusz ma jeden kierunek tekstu (reguła vii, zależna od skali drugiej osi) | 740 bez kierunku | `metric-solution.ts` 1.5.0 |
| E4: wykończenie ścian per kondygnacja (pasy pod okapem i spadkiem okapu, maski balkonu i niższej bryły) | ton parteru na całą bryłę | `tones.ts`, `emit.ts` |
| Wnęka wejściowa z pustym otworem: cały otwór testowany jako jedna wnęka (zwroty + ściana cofnięta) | ganek zabudowany jako pokój z oknem 4 m | `compound-facade.ts` 1.1.0 |
| Komórki ganku (≤ 2 m głębokości) przed ścianą cofniętą należą do wnęki | ganek obcięty, drzwi zgubione | `plan-decomposition.ts` |
| Otwory ściany cofniętej czytane na elewacji tej ściany | wysokości przyjęte | `reconstruct-v2.ts` |
| Okna balkonowe za balustradą: zarys balkonu w rzucie + balustrada na elewacji | balkon nigdy nie próbowany | `projecting-balcony.ts` |

Wersje: usługa 1.8.0, solver 2.23.0 (E4; dostawa 1315 ma 2.22.0), czytnik metryczny 1.6.0.

## 3. Wynik na zamrożonej ocenie

Sprawdzarka mierzy tylko część listy (kierunek kalenicy, rodzaj dachu, brama, wejście, okno frontowe, balkon, balustrada,
lukarna, zadaszenie, słupki, skrzydło, okna dachowe, kominy); odbiór wymaga całej listy i oceny wzrokowej.

| przebieg | wynik |
|---|---|
| E0 (kod 80d5612) | 25/70, 4/13 bez modelu |
| SHAPE-LIVE-01 (finał, ta sama sprawdzarka) | 26/70 |
| E3, pełna ścieżka produkcyjna, commit `845b13a` (dostawa 1315) | **32/70**, 2/13 bez modelu |
| E4 (wykończenie per kondygnacja, ten sam dowód) | 32/70 (sprawdzarka nie ocenia wykończeń) |

Per dom przy `845b13a`: Miniaturka 5/6 (zadaszenie), Pod Miłorzębem 0/6 (brak modelu), Arlety 4/5 (okna dachowe),
Aurory 1/5, Azalie 3/5, Bratki 1/5, Dalie 2/7, Jabłonki 5/7, Kostrzewy 1/4, Lipienniki 3/4 (kominy), Modrzewnica 0/6
(brak modelu), Muraje 1/4, Willa Maja 6/6.

**Kryterium odbioru: NIE.** Otwarte przyczyny (wszystkie domy w mianowniku):
- Pod Miłorzębem i Modrzewnica — brak modelu (skala rzutu nierozstrzygnięta / brak ramy wymiarowej);
- Muraje — głębokość 6,63 m zamiast 7,40 (740 odrzucone przy założonej izotropii), drzwi i brama w narożnym wcięciu pod
  piętrem nieczytane;
- Bratki — elewacja frontu/tyłu pokazuje parę bliźniaczą (2 × szerokość rzutu): niezarejestrowana, drzwi wejściowe brak;
- zadaszenia wejść (Azalie, Bratki, Dalie, Miniaturka, Modrzewnica) — brak czytnika;
- okna dachowe (Arlety, Aurory, Azalie, Dalie) — pierścienie nieodczytane lub błędnie odczytane (bramka OCR);
- Aurory — kierunek kalenicy (wznios pasuje do obu rozpiętości, gdy rzędna okapu jest na krawędzi okapu);
- kominy (Lipienniki, Kostrzewy), skrzydła (Jabłonki, Dalie, Modrzewnica), lukarny (Jabłonki, Miłorząb);
- Kostrzewy — środkowy otwór w ścianie ganku czytany jako szkło (to drzwi);
- paleta ze źródeł — niezaimplementowana (kolory domyślne).

## 4. Testy

Nowe testy przyczyn: `exterior-complete-openings`, `occluded-line-exterior-complete`, `section-top-datum-shape-live-01`
(niska połać i publikowana wysokość), `metric-solution` (kierunek arkusza), `recessed-entrance-exterior-complete`,
`balcony-behind-balustrade-exterior-complete`, `storey-tones-exterior-complete` (E4). Wyniki pełnego zestawu: §5.

## 5. Regresja, APK, prywatna dostawa

**Regresja 8** (pełna ścieżka przy `845b13a` wobec finału SHAPE-LIVE-01, tablice PRZED/PO obejrzane obok źródła):

| dom | zmiana | ocena |
|---|---|---|
| marcowki, trytomach | identyczne | — |
| ciesz | okap 3,32 → 3,30 | bez znaczenia |
| arganiach | jedno okno → drzwi | do sprawdzenia przy następnej dostawie |
| gozd | 4 okna → drzwi, wysokości z opisów (2,2/2,3 m) | zgodne z opisami |
| rary | front 105/210: drzwi → okno do podłogi | wiarygodne: render pokazuje szklany panel obok drzwi |
| sasankach3 | okap 3,69 → 4,04, brama segmentowa | PO bardzo podobne do PRZED, brama zgodna ze źródłem |
| a01 | okap 4,87 → 4,68; okna szczytu i tyłu jak na elewacjach | lepiej; **ale cały dom szary** → przyczyna E4 |

**E4 — wykończenie per kondygnacja** (pierwsza zła decyzja z tablicy a01): ton parteru był malowany na całą bryłę.
Teraz każda kondygnacja jest czytana w swoim pasie (szczegóły w dzienniku E4); wynik na tym samym dowodzie: a01 białe
poddasze nad szarym parterem, Muraje szare piętro nad białym parterem, Sasanki jasnoszary szczyt (0,75 bieli renderu)
nad białym parterem, pozostałe 18 domów bez zmian w ścianach. Trzy odrzucone wersje pośrednie — w dzienniku.

**Testy** (pełny vitest): poza testami przyczyn wszystkie czerwone są bazowe i wymienione osobno — architektura 11
(compound-facade 1: dodatkowa liczba `4` istniała już przy `357b615`; reference 2; research-isolation 4; wall-strip 4),
analyzer-api 4 (snapshot kontraktu Android, `/health`, worker ×2), local-analyzer 2 (Larchfield, NFD). Sliverton
(`wall-recovery-n7-fix01`) był czerwony od E1 (indeks polecenia 21 → 22 przez materiał bramy) — przeoczony w E3,
poprawiony w E4 z tym uzasadnieniem. Typecheck zielony. Testy jednostkowe Androida nieuruchamiane w tym kontenerze.

**APK 1315** (dostawa testowa, commit `845b13a`):
- `BuildPlan-owner-preview-1315.apk`, `com.buildplan.preview`, versionCode 1315, `0.1315.0-owner`, arm64-v8a,
  49 417 683 B, SHA-256 `1e2a93c7ba8e9789487b186d0b2b9ac810cfcabfb7449ac5aad314c77c969745`;
- podpis `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (ten sam co 1314);
- wbudowany analizator `analyzer.mjs` `6b6b671b97272d8c298e8481f5604f10df7075e6f19a72eca9d9a85dfce7ec0e`, usługa 1.8.0,
  solver 2.22.0, protokół 3; 10/10 plików manifestu zgodnych.
- Próba na żywo na zasobach APK (Muraje, strona na żywo; host Node 22 x64, **nie telefon**): pierwszy arkusz 13,9 s,
  koniec 314 s, 129 zdarzeń, 32 arkusze, 121 kopii zweryfikowanych po SHA-256, 0 niezgodnych, kopie usunięte; hash
  modelu `db38772602a0828a` = bieg desktopowy; szczyt RSS 888 MB (host).
- **Interfejs Androida: NOT_VERIFIED** (brak urządzenia). Czasy telefonu niezmierzone.
- E4 nie ma jeszcze APK: następna dostawa zbierze E4 i kolejne poprawki.

**Prywatna dostawa** (poza Git i publicznym CI): ZIP z oryginałami i hashami, listami elementów, odbiorem per dom,
modelami PRZED/PO, renderami wszystkich stron i tablicami, manifestem; budowany skryptem poza repozytorium.

**Holdout H2**: zapieczętowany, nieotwarty — rozwiązanie jeszcze nie jest stabilne.
