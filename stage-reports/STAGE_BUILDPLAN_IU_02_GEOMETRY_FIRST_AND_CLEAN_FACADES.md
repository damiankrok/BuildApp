# STAGE BUILDPLAN IU-02 — GEOMETRY-FIRST IMAGE UNDERSTANDING + CLEAN FACADE PROTOTYPE (badanie)

**Klasa: RESEARCH. Produkcyjny analizator, `SourcePackage`, solver, rekonstrukcja i Android — bez zmian.** Bez APK,
bez pełnego CI (tylko testy celowane). Baza `2c280a8` (IU-01) na `claude/new-session-3kzcgh`.
Kod: `research/image-understanding/` (`iu2/`, `iu2_*.py`, `extractor_compare.ts`). Liczby:
`stage-reports/artifacts/iu-02/`. Rejestracja wstępna: `stage-reports/artifacts/iu-02/preregistration.md`,
zamrożona commitem `d15abbe` (wypchniętym **przed** wygenerowaniem, wylosowaniem i oznaczeniem zbiorów FINAL).

**Werdykt: `RESEARCH_PARTIAL`.** Bramka bezpieczeństwa spełniona, pokrycie i poprawa ekstraktora — nie.

## Odpowiedź dla OWNER-a w pięciu zdaniach

1. **Bezpieczeństwo trasy jest rozwiązane na zbiorze, którego nikt wcześniej nie widział:** na 890 obrazach FINAL
   (LoC/HABS, nowe domy syntetyczne, 5 nowych rodzin ARCHON, test IU-01) IU-02 nie skierował do ekstraktora fasad
   **ani jednej** perspektywy, wnętrza, przekroju czy arkusza wielowidokowego (0/674; Wilson 95 % ≤ 0,57 %).
   IU-01 na tych samych obrazach skierowałby tam **161** nie-elewacji (m.in. 117 perspektyw zewnętrznych, 7 wnętrz, 31 arkuszy wielowidokowych).
2. **Rozpoznawanie rodzaju z geometrii + osadzenia przenosi się między stylami lepiej niż IU-01**: top-1 na
   niezależnym zbiorze wielostylowym 88 % (CI 86–90 %) wobec 44 % dla IU-01; na LoC 88 % wobec 21 %.
3. **Ale za bezpieczeństwo płacimy pokryciem:** do ekstraktora trafia 96 ze 160 pojedynczych elewacji (**60 %**,
   CI 52–67 %) — poniżej wymaganych 70 %. Na renderach ARCHON test rzutu w masce budynku zbyt często mówi
   INCONCLUSIVE (drzewa, horyzont, odbicia), więc elewacja idzie do REVIEW zamiast do ekstraktora.
4. **Czysta fasada wygląda dobrze, ale nie poprawia odczytu:** istniejący ekstraktor (bez zmian w kodzie) na
   czystych rastrach 5 domów DEV odczytał mniej (21 vs 36 odczytów otworów, 11 vs 15 zarejestrowanych widoków) —
   rejestracja opiera się na sylwetce i gruncie, które czyszczenie zmienia. Wynik negatywny, nie ukrywam go.
5. Zalecenie: **zintegrować tylko bramkę** (klasyfikator + test rzutu jako weto przed ekstraktorem fasad) po weryfikacji
   etykiet przez człowieka; **nie** integrować czyszczenia fasad; następny krok to poprawa testu rzutu na renderach
   (maska budynku bez roślinności, odrzucanie odbić w szybach), nie kolejny klasyfikator.

## 1. Wejście (§1)

- Pojedyncze obrazy `SourcePackage` / strony projektu; kolaż 2×2 i arkusze wielowidokowe są klasą `OTHER`
  (`multiView=true`) i nigdy nie są wejściem pomiarowym (generator syntetyczny tworzy kolaże jako negatywy).
- Dla każdego obrazu `iu2/pipeline.load`: SHA-256 bajtów, rozmiar w bajtach, szerokość/wysokość, proporcja, orientacja
  EXIF (zastosowana i zapisana), `transform.json` (schemat `iu02.transform/1`, transformacja tożsamościowa — czysta
  fasada ma ten sam rozmiar i układ pikseli co źródło; `extractor_compare.ts` to wymusza).
- Oryginały nie były podawane do produkcyjnego solvera inaczej niż przez nienaruszony `reconstructV2` w harnessie
  porównawczym (§7), który podmienia wyłącznie callback `raster`.

## 2. Segmentacja (§2) — bake-off na syntetycznych maskach GT (DEV, 70 obrazów na styl)

| metoda | FLAT IoU | LINE IoU | RENDER IoU | RENDER brzeg mediana / p95 px | s/obraz |
| --- | --- | --- | --- | --- | --- |
| klasyczne CV (`seg.classic`) | **0,989** | **0,989** | 0,673 | 7,4 / 114 | 0,02 |
| SegFormer-B0 ADE20K | 0,575 | 0,299 | 0,857 | 8,6 / 146 | 2,9 |
| UperNet ConvNeXt-T ADE20K | 0,284 | 0,466 | 0,903 | **2,7 / 50** | 4,6 |
| MobileSAM (box z UperNet) | 0,0 | 0,636 | **0,925** | 1,9 / 83 | 3,8 |
| MobileSAM (box z CV) | 0,986 | 0,974 | 0,761 | 23 / 185 | 4,2 |

Wybór: rysunek (jasna jednolita ramka) → klasyczne CV; render/foto → UperNet. MobileSAM poprawia medianę na
renderach, ale pogarsza ogon (p95) i zapada się na płaskich rysunkach — nie jest domyślny. Klasy wyjściowe:
ściana, dach, komin, okno, drzwi, brama, balkon, tło, przesłona, niepewne. Przesłonięta treść **nie jest
rekonstruowana**: w czystej fasadzie dostaje kolor „niepewne” i trafia do `uncertainty-mask.png`.

## 3. Rzut z geometrii (§3) — `iu2/projection.py`

Rodziny linii (LSD), dryf kąta pionów/poziomów w funkcji położenia (ważona regresja Tukeya, błąd kanapkowy),
ograniczenie zniekształcenia w pikselach, radialny test punktu zbiegu jednego punktu, ukośne krawędzie podstawy,
panele (rynny) → stany `ORTHOGRAPHIC_SUPPORTED` / `PERSPECTIVE_EVIDENT` / `INCONCLUSIVE` / `NOT_SINGLE_FACADE`.
Punkt zbiegu jest dowodem perspektywy; brak punktu zbiegu **nie** dowodzi ortografii (ORTHO wymaga górnej granicy
zniekształcenia ≤ 2 px przy 95 %). Progi ustalone na syntetyce, nie na wydawcy.

- Syntetyka DEV: 0 perspektyw/wnętrz jako ORTHO; elewacje ORTHO: płaskie 70/70*, kreskowe 70/70, rendery 54/70.
- ARCHON DEV bez maski: elewacje ORTHO 87/340, INCONCLUSIVE 250; 3 frontalne wnętrza i 1 frontalna perspektywa
  zewnętrzna dostały ORTHO (`projection-real-dev.json`).
- **Ograniczenie zasadnicze:** frontalna perspektywa jednej płaszczyzny jest geometrycznie nieodróżnialna od
  ortografii. Dlatego test rzutu jest **warunkiem koniecznym, nie wystarczającym** — trasa wymaga zgody klasyfikatora.
- **Wynik negatywny:** reguła cech przekroju (`iu2/section.py`: pasy stropów, ściany szczytowe, kreskowanie,
  zaczernienie) nie złapała 0/36 przekrojów syntetycznych i oznaczyła 17 elewacji i rzuty; pozostawiona wyłącznie
  jako cechy klasyfikatora. Przekroje odsiewa klasyfikator, nie geometria (ARCHON DEV: 31 przekrojów ma ORTHO).

\* przebieg DEV z pełnym potokiem (`clean-synth-dev-summary.json`).

## 4. Czysta fasada (§4) — `iu2/clean.py`

Deterministyczna, transformacja tożsamościowa: białe tło, bez nieba/drzew/ogrodu, płaskie powierzchnie w kolorze
materiału (k-means w Lab, jaśniejszy kwartyl), jednolite jasne szkło, ostre krawędzie, otwory w swoim miejscu, bez
upiększania i zmian proporcji. Eksport: `clean-facade.png`, `edges.png`, `semantic-masks.png`,
`uncertainty-mask.png`, `transform.json`. Znak wodny i przesłony → niepewne, nigdy „dorysowane”.

Tablice przed/po (lokalnie, **nie w repo** — pochodne ARCHON): `/home/user/workiu02/boards/marcowki-before-after.png`
(4 elewacje Marcówek), `ciesz-before-after.png`, `synthetic-before-after.png`. Co widać (uczciwie):

- Marcówki: dach, komin, okna dachowe i podział ścian zachowane; na jednej elewacji bocznej biała ściana na
  białym tle rozpada się na fragmenty; duże przeszklenia od ogrodu (odbicia drzew) trafiają do maski niepewności
  zamiast do szkła; część znaku wodnego zostaje jako niepewna plama.
- Syntetyka: FLAT poprawne; LINE — okna sklasyfikowane jako drzwi, ściana jako dach; RENDER — krzewy przed oknami
  odczytane jako otwory drzwiowe i **niezaznaczone** jako niepewne; na jednym renderze pas chodnika doklejony do ściany.

## 5. Wierność geometryczna (§5) — syntetyka DEV z niezależną prawdą (210 elewacji)

Punkty: narożniki budynku, okien, drzwi, bram, linia okapu, kalenica, komin (z modelu generatora, nie z wyjścia
modelu). Przesunięcie = odległość narożnika doprecyzowanego na źródle i na czystej fasadzie.

| styl | IoU budynku (mediana, CI) | przesunięcie mediana px (CI) | p95 px (mediana obrazów / najgorszy) | p95 / szerokość budynku | obrazy med ≤ 2 i p95 ≤ 5 |
| --- | --- | --- | --- | --- | --- |
| FLAT (70) | 0,989 (0,987–0,989) | 1,58 (1,45–1,68) | 2,48 / 3,39 | 0,29 % (max 0,59 %) | 60/70 |
| LINE (70) | 0,989 (0,988–0,989) | 1,32 (1,24–1,35) | 2,50 / 4,01 | 0,30 % (max 0,71 %) | 55/70 |
| RENDER (70) | 0,903 (0,884–0,920) | 1,15 (1,09–1,24) | 3,27 / 4,50 | 0,41 % (max 0,80 %) | 68/70 |

Cel „mediana ≤ 2 px, p95 ≤ 5 px” jest spełniony na poziomie zbioru dla wszystkich trzech stylów, ale nie dla każdego
obrazu (10/70 FLAT i 15/70 LINE przekraczają medianę 2 px). Dokładność adnotacji: punkty syntetyczne są dokładne
co do subpiksela (z geometrii), więc to rzeczywisty błąd potoku, nie szum prawdy. **Na realnych elewacjach nie
zmierzono przesunięć punktów** — nie ma niezależnie oznaczonych punktów; żaden realny obraz nie jest oznaczony jako
zweryfikowany geometrycznie.

### Tabela zachowania okien i drzwi (syntetyka DEV)

| styl | szkło: GT / zachowane / pomylone / brak / brak za przesłoną / dodane | drzwi+bramy: GT / zach. / pom. / brak / brak za przesł. / dod. | obrazy z dokładnym zbiorem otworów |
| --- | --- | --- | --- |
| FLAT | 193 / 178 / 0 / 15 / 0 / 30 | 84 / 74 / 0 / 10 / 0 / 1 | 36/70 |
| LINE | 193 / 151 / 22 / 20 / 0 / **103** | 84 / 80 / 0 / 4 / 0 / 1 | 9/70 |
| RENDER | 193 / 107 / 3 / 65 / 18 / 38 | 84 / 27 / 6 / 32 / 19 / **67** | 3/70 |

Zachowanie liczby i położenia otworów — wymóg briefu — **nie jest spełnione** poza stylem FLAT.

## 6. Dane (§6)

| źródło | rola | licencja | etykiety |
| --- | --- | --- | --- |
| ARCHON (IU-01, 1352 obr.) | DEV + TEST IU-01 | strony publiczne, piksele poza repo | agent, anonimowe arkusze |
| LoC HABS/HAER (606 obr.) | DEV 314 / FINAL 292 (podział po ankiecie) | „No known restrictions” (rząd USA) | agent, anonimowe arkusze |
| Wikimedia Commons (170) | DEV | CC/PD z IU-01 | agent |
| syntetyka `iu2/synth3d.py` | DEV 507 (70 domów) / FINAL 290 (40 domów) | własna | z generatora (prawda) |
| ARCHON FINAL (98 obr., 5 rodzin) | FINAL | piksele poza repo | agent, przed uruchomieniem modelu |

Style: rendery fotorealistyczne, płaskie diagramy, rysunki kreskowe, prawdziwe rysunki techniczne (HABS), perspektywy
prawie frontalne, wnętrza, przekroje przypominające elewacje. Prywatnego benchmarku OWNER-a nie użyto.
**Wymóg briefu „kluczowe etykiety sprawdzone przez człowieka” NIE jest spełniony** — wszystkie etykiety realnych
obrazów są etykietami agenta. Arkusze do przeglądu leżą lokalnie (`/home/user/workiu02/archon-final-sheets/`,
`/home/user/workiu02/sheets/`); wyniki należy traktować jako warunkowe do czasu ich weryfikacji.

## 7. Porównania (§7)

### 7.1 Klasyfikator i trasa — FINAL (zamrożone przed obejrzeniem; `final.json`, `final-per-image.csv`)

Model: osadzenie OpenCLIP ViT-B/32 ⊕ 24 cechy geometryczne, regresja logistyczna, wybór leave-one-source-out.
τ dla akceptacji klasy = 1,01 (na DEV żadna klasa nie osiągnęła ryzyka ≤ 2 % poza źródłem — akceptacja klas jest
wyłączona); trasa do fasad = ELEWACJA z p ≥ 0,60 **i** test rzutu w masce budynku = ORTHOGRAPHIC_SUPPORTED.

| zbiór | n | top-1 IU-01 | top-1 IU-02 | nie-elewacje do fasad IU-01 | IU-02 | elewacje do fasad IU-01 | IU-02 | IU-02 REVIEW / UNKNOWN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FINAL_LOC | 292 | 21 % | **88 %** | **124** | 0 | — (0 pojedynczych) | — | — |
| FINAL_SYNTH | 290 | 48 % | **84 %** | **37** | 0 | 50/120 | **78/120** | 2 / 40 |
| FINAL_ARCHON | 98 | 99 % | 100 % | 0 | 0 | **40/40** | 18/40 | 22 / 0 |
| IU01_TEST (ARCHON) | 210 | 100 % | 100 % | 0 | 0 | **56/56** | 11/56 | 45 / 0 |
| **niezależny wielostylowy** (LOC+SYNTH+ARCHON) | 680 | 44 % (40–47) | **88 % (86–90)** | 161 | **0** (Wilson ≤ 0,8 %) | 90/160 = 56 % | **96/160 = 60 % (52–67)** | |

Perspektywy/wnętrza/przekroje skierowane do fasad (wszystkie FINAL): IU-01 — 117 / 7 / 1; IU-02 — 0 / 0 / 0.
Elewacje, których IU-02 nie przepuścił: 40 × niska pewność (syntetyka), 24 × geometria INCONCLUSIVE (ARCHON);
na teście IU-01: 43 × INCONCLUSIVE, 2 × PERSPECTIVE_EVIDENT (elewacje renderowane z lekką perspektywą).

Uwaga o projekcie zbioru: FINAL_LOC nie zawiera ani jednej pojedynczej elewacji (HABS publikuje elewacje na
arkuszach wielowidokowych), więc pokrycie na „niezależnym zbiorze wielostylowym” niosą tylko dwa style
(syntetyka + ARCHON). LoC sprawdza wyłącznie bezpieczeństwo. Tego nie przewidziała rejestracja.

### 7.2 Ekstraktor fasad: surowe vs czyste (DEV, 5 domów, kod solvera bez zmian)

| dom | otwory w ścianach (prawda agenta) | odczyty surowe | czyste | czyste + linia gruntu | widoki surowe / czyste / +grunt |
| --- | --- | --- | --- | --- | --- |
| Marcówki | 12 | 9 | 6 | 5 | 4 / 3 / 2 |
| Cieszynianki | 14 | 7 | 4 | 7 | 3 / 2 / 2 |
| A01 | 13 | 14 | 0 | 0 | 4 / 0 / 0 |
| Gozd | 16 | 0 | 3 | 3 | 0 / 2 / 2 |
| Rarytasy | 11 | 6 | 8 | 7 | 4 / 3 / 3 |
| **razem** | 66 | **36** | 21 | 22 | **15** / 11 / 9 |

Czyszczenie **nie poprawia** odczytu istniejącego ekstraktora; tylko Gozd (0 → 3) zyskuje rejestrację. Przyczyna:
rejestracja widoku opiera się na sylwetce i linii gruntu, a czysta fasada usuwa teren i część sylwetki. Na FINAL tego
porównania nie powtórzono (brak przebiegów `SourcePackage` dla nowych rodzin bez zmiany produkcji).

## 8. Kryteria zaliczenia (§8)

| kryterium | wynik | status |
| --- | --- | --- |
| 0 perspektyw/wnętrz przyjętych jako elewacje | 0/890 (IU-01: 124) | ✅ |
| 0 potwierdzonych przekrojów do ekstraktora fasad | 0 | ✅ |
| ≥ 70 % pokrycia na niezależnym zbiorze wielostylowym | 60 % (CI 52–67 %) | ❌ |
| przedziały niepewności | Wilson + bootstrap po projektach w `final.json` | ✅ |
| wstępne przetwarzanie mierzalnie poprawia odczyt | 36 → 21 odczytów, 15 → 11 widoków | ❌ |
| etykiety ewaluacyjne sprawdzone przez człowieka | nie | ❌ |

→ **`RESEARCH_PARTIAL`.**

## 9. Licencje, czas, pamięć

Raport licencji: `research/image-understanding/MODELS.md` (sekcja IU-02). MobileSAM — Apache-2.0; UperNet ConvNeXt-T —
MIT (dane ADE20K mają własne warunki); **SegFormer-B0 — NVIDIA Source Code License, tylko badania — nie może trafić
do produktu**. Zmierzone na CPU x86-64 kontenera (Xeon 2,1 GHz, 4 vCPU; `timing-memory.json`): elewacja 1280×597
przez UperNet ~4,2 s segmentacji + 0,05 s test rzutu + 2,1–3,0 s czyszczenia, RSS procesu 1,7 GB; rysunek przez
klasyczne CV 0,03–0,06 s segmentacji, ale czyszczenie dużego rysunku kreskowego 1600×1777 trwa 11,6 s; osadzenie
klasyfikatora 16 ms (MobileNetV3) / 30 ms (CLIP B/32) na obraz. Telefon — **tylko prognoza**: UperNet (230 MB fp32)
nie jest modelem na telefon.

## 10. Odstępstwa od rejestracji (jawne)

1. Pierwsze uruchomienie `iu2_final.py` przerwał błąd w kodzie raportującym (pole `project` obrazów syntetycznych było
   słownikiem parametrów domu, więc bootstrap po projektach nie działał). Poprawiono tylko identyfikator projektu
   w `iu2/data.py`; model, progi i decyzje bez zmian. Wyniki FINAL_LOC z pierwszego przebiegu są identyczne z drugim.
2. FINAL_LOC nie ma pojedynczych elewacji (patrz 7.1) — pokrycie wielostylowe opiera się na dwóch stylach.
3. Pierwszy przebieg syntetycznej wierności DEV zgubił plik wyjściowy (brak katalogu); powtórzony w całości.

## 11. Rekomendacja i następny krok

- **Nie integrować** czyszczenia fasad jako wejścia ekstraktora — nie poprawia odczytu i gubi otwory poza stylem FLAT.
- **Bramka** (klasyfikator EMB+GEO + test rzutu jako weto) jest jedynym elementem gotowym do rozważenia: zero
  niebezpiecznych tras na 890 nowych obrazach. Warunek: przegląd etykiet FINAL przez OWNER-a/człowieka; w produkcji
  mogłaby działać jako weto na istniejącej trasie (blokuje, nigdy nie dopuszcza). Wariant weta, który blokuje tylko
  przy jawnym sprzeciwie (klasa ≠ elewacja albo PERSPECTIVE_EVIDENT / NOT_SINGLE_FACADE) i dzięki temu nie obniża
  pokrycia, **nie był oceniany** — to jest pierwsze pytanie następnego etapu, nie wynik tego.
- **IU-03 (proponowany, nie rozpoczęty):** poprawa pokrycia testu rzutu na renderach — maska budynku bez roślinności
  i odbić w szybach, test na krawędziach ściany zamiast całej maski — oraz mniejszy segmentator z licencją
  komercyjną (UperNet jest za duży na telefon). Czyszczenie fasady wrócić do stołu dopiero, gdy ekstraktor będzie
  rejestrował widok bez sylwetki z terenem.

## Pliki i reprodukcja (offline)

```
PY=/path/venv/bin/python; export IU_WORK=<poza repo> IU_WORK2=<poza repo> IU_WEIGHTS=<poza repo>
$PY research/image-understanding/iu2/synth3d.py --out $IU_WORK2/synth-dev --prefix sdev --seed 7101 --houses 70
$PY research/image-understanding/geo_features.py --tag synthdev --images $IU_WORK2/synth-dev
$PY research/image-understanding/eval_clean_synth.py --synth $IU_WORK2/synth-dev --out $IU_WORK2/results/clean-synth-dev.json
python3 -I research/image-understanding/summarise_clean_synth.py $IU_WORK2/results/clean-synth-dev.json
$PY research/image-understanding/iu2_train.py
$PY research/image-understanding/iu2_final.py --sets FINAL_LOC,FINAL_SYNTH,FINAL_ARCHON,IU01_TEST \
    --expect-head-sha256 016556687dff3d791e37028ddeebcd996d1c8a44360ad837e674091f87a77137 --out $IU_WORK2/results/final.json
npx vite-node research/image-understanding/extractor_compare.ts -- --house <id> --run <dir> --package <json> --cache <dir> --clean <map> --out <json>
```

Wagi i ich SHA-256: `MODELS.md`. Testy celowane: `npx vitest run tests/architecture/research-isolation.test.ts -t "IU-0"`
(produkcja nie importuje `iu2`, każdy zapis pikseli/cech/głowy odmawia ścieżki w repo, inferencja za `offline_guard()`).
