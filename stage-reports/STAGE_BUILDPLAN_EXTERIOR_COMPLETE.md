# STAGE BUILDPLAN EXTERIOR-COMPLETE — rozpoznawalny cały dom (raport roboczy)

Status: **WORK_IN_PROGRESS.** Kryterium odbioru nie jest spełnione (§3); kampania trwa. Ten raport opisuje stan po
dostawie testowej 1315 i jest aktualizowany przy kolejnych dostawach. Dziennik punktów kontrolnych:
`stage-reports/EXTERIOR_COMPLETE_LOG.md` (E0–E3).

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
| Wnęka wejściowa z pustym otworem: cały otwór testowany jako jedna wnęka (zwroty + ściana cofnięta) | ganek zabudowany jako pokój z oknem 4 m | `compound-facade.ts` 1.1.0 |
| Komórki ganku (≤ 2 m głębokości) przed ścianą cofniętą należą do wnęki | ganek obcięty, drzwi zgubione | `plan-decomposition.ts` |
| Otwory ściany cofniętej czytane na elewacji tej ściany | wysokości przyjęte | `reconstruct-v2.ts` |
| Okna balkonowe za balustradą: zarys balkonu w rzucie + balustrada na elewacji | balkon nigdy nie próbowany | `projecting-balcony.ts` |

Wersje: usługa 1.8.0, solver 2.22.0, czytnik metryczny 1.6.0.

## 3. Wynik na zamrożonej ocenie

Sprawdzarka mierzy tylko część listy (kierunek kalenicy, rodzaj dachu, brama, wejście, okno frontowe, balkon, balustrada,
lukarna, zadaszenie, słupki, skrzydło, okna dachowe, kominy); odbiór wymaga całej listy i oceny wzrokowej.

| przebieg | wynik |
|---|---|
| E0 (kod 80d5612) | 25/70, 4/13 bez modelu |
| E3, pełna ścieżka produkcyjna (czytniki telefonu) | patrz §5 (uzupełniane po biegu f2) |

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
`balcony-behind-balustrade-exterior-complete`. Wyniki pełnego zestawu: §5.

## 5. Regresja, APK, prywatna dostawa

Uzupełniane po biegach (sekcja poniżej).
