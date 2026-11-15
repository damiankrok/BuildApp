# BuildPlan v3.54 — cała ścieżka analizatora: mapa, uogólnienie, porównanie strategii

15.11.2026. Baza: APK 1339 (`459cc2d`, kod `5240d7e`), raport `226c9ac`. Zbiór: 30 projektów, 8 wydawców. Bez płatnych wywołań
(księga 2,72807938 / 5 USD, 92 wpisy, billing UNCONFIRMED — bez zmian), bez H2 i prywatnego benchmarku, ForgeShape tylko do odczytu.
Źródła, referencje, wyniki i plansze — prywatnie, poza Gitem. Interfejs Android: **NOT_VERIFIED**.

## Werdykt

| oś | status |
| --- | --- |
| Wycinek (zmiana produkcyjna) | **brak przyjętej zmiany** — wariant V1 (resolver 1.7.0) odrzucony według zamrożonego kryterium: 0 aktywacji w grupie odłożonej; kod wycofany, obowiązuje APK 1339, **bez APK 1340** |
| Kampania / produkt | **CHECKPOINT** — mapa, pomiar między wydawcami, porównanie strategii i wybór kierunku zrobione; wdrożenie z korzyścią na odłożonych projektach — niespełnione |
| Pokrycie weryfikacji | host: 30 domów A, 12 odtworzeń B, 8 + 1 diagnostyk I3, regresja resolvera 38 domów, testy zmienionych modułów; B na żywo, C, D, Android — niezmierzone |

**Najważniejsze ustalenia.**

1. **Architektura LOCAL nie uogólnia się poza konwencję arkuszy ARCHON.** Na 21 domach siedmiu innych wydawców: 11 odmów — wszystkie
   z pierwszą utratą na metryce (linie wymiarowe niewykrywane, podpisy w stopach i calach odrzucane przez dekoder tylko cyfrowy,
   rzuty bez wymiarów); z 10 zbudowanych modeli 7 bez zweryfikowanej skali, 3 „używalne” w wąskim sensie. Gdy skalę dostarczają
   opublikowane wymiary, plan odpada na obrysie (`NO_OUTLINE`, `SIDES_DISAGREE`, `WALL_THICKNESS_IMPLAUSIBLE`). Na ARCHON 4 z 9 modeli.
2. **Główna hipoteza analizy (granica uzależniona od długich pasów muru) jest prawdziwa, ale nie jest największą barierą.**
   W korpusie 1338/1339 obwiednia to 3 z 56 odmów; 30 to odczyty odrzucone w arbitrażu/układzie, 12 — brak ramy wymiarowej.
   **Druga hipoteza (utrata dobrych obserwacji w wyborze kopii i arbitrażu) potwierdzona przyczynowo** (I3): resolver ma odczyt
   o rozmiarze drukowanym co do centymetra i nie umie go niezależnie potwierdzić.
3. **Bramka AI:** każdy model lokalny spoza ARCHON trafia do czytnika (brak kotwicy), ale **żaden model ARCHON** — także z 15 %
   brakującego obrysu lub złą kalenicą. Obserwacje AI nie mają żadnego wejścia do ścieżki lokalnej; opis zastępuje model w całości.
4. **Strategie na identycznych wejściach (12 stron, 6 wydawców):** B (globalny opis AI, odtworzony z zapisanych odpowiedzi) — 10
   modeli, 5 używalnych; A — 3 modele, 1 używalny. B ma słabą metrykę (4 z 10 z błędem rozmiaru 12–30 %). C i D niezmierzone.
5. **Wybrany kierunek:** hybryda z rozdziałem ról — LOCAL jako źródło metryki, obrysu i arbitrażu tam, gdzie jego czytniki działają;
   globalny opis AI jako czytnik domu dla arkuszy, na których LOCAL odmawia albo nie ma kotwicy; obserwacje AI do ścieżki lokalnej
   tylko z niezależnym świadkiem z rysunku. Pomiar B na ARCHON i FRESH jest zablokowany brakiem klucza i nieuzgodnioną księgą.
6. **Nowa informacja, która koryguje scenę:** lokalnie — wydruk drugiej kopii (V1: Goldstary 2, Santany z odmowy na model
   o wymiarach drukowanych); z opisu AI — dobredomy-pl-1, domoweklimaty-pl-2, extradom-pl-2, architecturaldesigns-com-2 z odmowy
   na model z rozmiarem w 3 % referencji. V1 poprawnie odrzucił fałszywy odczyt na świeżym domu (Saponarie, pergola w bryle).

## 1. Zbiór, referencje, protokół

Protokół spisano i zapieczętowano przed pierwszym przebiegiem (`PROTOCOL_V354.md`, sha256 `6375a909…`, 16:23 UTC), a referencje
przed oceną grup odłożonych (`refs-v354.sha256` → `89dab282…`, 17:16 UTC). Prywatnie, poza Gitem.

**30 projektów, 8 wydawców** (nagłówek protokołu podaje omyłkowo 29 projektów i 7 wydawców; spis ma 30 projektów i 8 wydawców). Podział całymi rodzinami:

| grupa | skład | po co |
| --- | --- | --- |
| DEV (13) | ARCHON: Supertunie 2 E, Nad Rzeczką 2 E, Nigelle 4 G2, Torenie 3 E, Nolany 2 G2E; strony „-1” sześciu wydawców (pilot S53-E1, na nich poprawiano builder opisowy); domoweklimaty.pl — cała rodzina „Akord” (3 strony) | diagnoza, strojenie |
| HELD (10) | strony „-2” (S53-E3) i strony kontrolne anylink: architecturaldesigns.com, dobredomy.pl, extradom.pl, houseplans.com, lipinscy.pl | nigdy nie strojone; werdykty bazowe wyświetlone raz przed zamrożeniem wariantu (aneks 1) — „widziane, niestrojone” |
| FRESH (7) | 4 rodziny ARCHON nigdy nieanalizowane (losowanie z ziarnem `sha256('226c9ac'+'BUILDPLAN-V354-HOLDOUT')` z bieżącej mapy witryny bez 157 analizowanych rodzin): Bluszcz 3, Aralie, Saponarie G2E, Piwonie 3 G; **studioatrium.pl** — wydawca nigdy niepróbkowany, odłożony w całości: Agawa, Awans II, Amber XI | jedyna ślepa próba uogólnienia |

Uwaga o świeżości: prawie wszystkie rodziny ARCHON z mapy witryny pojawiają się w zachowanych materiałach jako linki („podobne
projekty”); „świeże” znaczy nigdy nieanalizowane i nigdy nielosowane. Zbiór pokrywa szklenia (Supertunie, Agawa), podcienia i loggie
(Nad Rzeczką, Nolany, Awans II), garaże (Nigelle, Piwonie, Saponarie, Aralie, extradom-pl-1), L/T/U (Torenie, Saponarie, Amber XI,
Nad Rzeczką), poddasza (Bluszcz, Agawa, Awans II, domoweklimaty), rzuty rastrowe w cm i rzuty w stopach/calach (US).

**Referencje.** 12 stron „-1/-2” — referencje S53 bez zmian (hashe w `refs-s53.sha256`). 18 pozostałych — nowe, w tym samym schemacie
plus `groundOutline` (wielokąt zamkniętego obrysu w m), `openZones`, `printedOverall`, `groundRooms`; czytnik referencji widział tylko
obrazy źródła (bez wyjść analizatora). Kontrola wyrywkowa wykonawcy na rzutach Supertunii, architecturaldesigns-com-1 i dobredomy-pl-1:
zgodne z rysunkiem. Ograniczenie: referencje i strategia B są odczytem modelu tej samej rodziny; dlatego wymiary oceniamy względem
drukowanych liczb, a nie opisu.

**Miary** (zamrożone, §3 protokołu): S1 wynik/odmowa z etapem; S2 rozmiar bryły parteru wobec referencji (OK ≤ 3 %, NEAR ≤ 8 %);
S3 pokrycie wobec zabudowy publikowanej (z flagą kołowości); S4 kondygnacje (poddasze jako osobny poziom dozwolone — doprecyzowanie
przed oceną); S5 rodzaj dachu i kierunek kalenicy; S6 otwory zewnętrzne (0,7–1,3); obrys parteru wobec wielokąta referencji;
werdykt „UŻYWALNY” = model i S2 ≤ NEAR i S4 i rodzaj dachu. To wąski wskaźnik, nie odbiór.

## 2. Mapa modułów i decyzje

Mapę zrobiono z kodu (226c9ac) i potwierdzono przebiegami. Pełne odnośniki `plik:linia` — `module-map.md` w paczce prywatnej.

| # | etap | aktywna funkcja | wynik pomiaru | decyzja |
| --- | --- | --- | --- | --- |
| 1 | źródła, wariant | `acquireSourcePackage` (`source-package/acquire.ts:68`), adapter ARCHON lub ogólny | 30/30 pakietów, 8 wydawców; 1 utracony rzut (extradom-pl: HTTP, nazwany `SOURCE_ADDRESS_HTTP_STATUS`); lustra obrazów nieobsługiwane — w zbiorze brak przypadku | **zachować**; lustra: brak dowodu |
| 2 | klasyfikacja | `roleClaims` + embedder treści (`source-analyzer/analyze.ts:209`) | trafności klas nie mierzono w tej kampanii; czytniki referencji wskazały błędne role (banery Studio Atrium jako SITE_PLAN, miniatury innych projektów u extradom) | **brak dowodu** (do pomiaru macroF1) |
| 3 | rejestracja | `registerFrame`, `chooseBasePlan`, `worldFrameFrom` (FRONT = dół arkusza) | dobredomy-pl-1: wybrany rzut poddasza, gdy rzut parteru nie dał skali; błędna kalenica w 5 modelach (Nigelle, lipinscy-pl-1, dobredomy-pl, Piwonie, Amber XI) | **rozszerzyć** (wybór kondygnacji bazowej, orientacja dachu) |
| 4 | obserwacje | `extractPlan`/`extractElevation`; obserwacje rzutu tylko jako poparcie, solver czyta piksele ponownie (`reconstruct-v2.ts:3562`) | poza ARCHON otwory zawyżone ×1,3–3,1 (houseplans-com ×3,14, architecturaldesigns-com ×2,37, Amber XI ×2,15) | ARCHON **zachować**; inne konwencje **rozszerzyć** |
| 5 | metryka | `extractMetricEvidenceAsync` (`source-metrics/extract.ts:347`), dekoder cyfr CTC (`numeric-recogniser-ort/paddle.ts:102`) | **pierwsza utrata we wszystkich 11 odmowach spoza ARCHON (21 domów), a w 7 z 10 zbudowanych tam modeli skala nie jest zweryfikowana**: 0–3 wykryte linie wymiarowe u 4 wydawców, podpisy w stopach/calach odrzucane przez dekoder tylko cyfrowy, rzuty bez wymiarów (domoweklimaty, dobredomy) | **rozszerzyć** (gramatyka ft/in z dekoderem, zewnętrzne kotwice metryki z pochodzeniem); wymiana bez prototypu nieuzasadniona |
| 6 | obrys i pokoje | `planExtent` → `decomposeCore` (`plan-decomposition.ts:2486`): obwiednia z długich pasów, siatka, zalew | gdy skalę dostarczają opublikowane wymiary, plan i tak odpada: `NO_OUTLINE` (dobredomy-pl-1, domoweklimaty-pl), `SIDES_DISAGREE` (extradom-pl-2, architecturaldesigns-com-1), `WALL_THICKNESS_IMPLAUSIBLE` (domoweklimaty-pl-1, -2); obwiednia przy przeszkleniu (Supertunie, Nad Rzeczką; D2/D2b z v3.53.14); obrys modeli 0,73–1,15 referencji | **rozszerzyć**: granica = mur + szklenie + drzwi; kandydat do wymiany po prototypie |
| 7 | złożenie, arbitraż odczytów | `resolvePlan` (`plan-resolution.ts`), `composeStructuralLayout` | **dobry odczyt tracony w arbitrażu** (I3, §4.1); w FRESH Saponarie ten sam mechanizm; błędy otwór ponad ścianą w 2 świeżych modelach | **rozszerzyć** — wariant V1 (resolver 1.7.0) zmierzony i odrzucony (§6) |
| 8 | kompilacja | `compileBuilding` (`geometry/compile.ts:148`) | B: 0 błędów w 10 modelach; A: 6 błędów `OPENING_ABOVE_WALL_TOP` w Piwoniach i Amber XI (przyczyna w złożeniu, nie w kompilatorze) | **zachować** |
| 9 | kontrola źródłowa | `verifyReplay`, `geometryClosureAudit`, bramka powierzchni (`layout-gate.ts:158`) | zabudowa publikowana jest i arbitrem, i miarą (kołowe); bramka AI nie czyta kontroli źródłowych (§3) | **rozszerzyć** |
| 10 | produkt | `buildMobileSceneBundle`, `runLocalAnalysis` (telefon: tylko LOCAL) | bez zmian (APK 1339) | **zachować**; Android NOT_VERIFIED |
| AI | ścieżka opisowa | `analyseLink` → `runDescribedAnalysis`, builder 0.7.0 | jedyna strategia, która buduje modele u wydawców spoza konwencji ARCHON (§5) | **zachować jako B**, rozszerzyć bramkę i szew obserwacji AI→LOCAL po pomiarze B na ARCHON |

Założenia, które mierzono wprost: obwiednia wymaga długich pasów w obu osiach (`longBands` ≥ 2,5 ściany, `axisBox`), jedna brakująca
krawędź zamknięcia przepuszcza zalew przez całe pomieszczenie, skala jest per ramka bez łączenia kopii, front = dół arkusza,
jednostki rozpoznawane po liczbie cyfr. Zależność od wydawcy jest tylko w adapterze ARCHON i w tych konwencjach rysunku — nie w nazwach.

## 3. Bramki i kontrolowane próby

**Bramka czytnika AI** (`analyse-link.ts:61-70, 176-191`). Czytnik jest pytany po odmowie (`RECONSTRUCTION_FAILED`, `NO_DRAWINGS`,
`SOURCE_INCOMPLETE`) albo po modelu „słabym z własnej oceny” (brak kotwicy metrycznej, model częściowy, brak bryły, brak dachu).
Kontrolowana próba: produkcyjne `drawingsWeaknesses` na zapisanych wynikach A wszystkich 30 domów (`gate-trial.ts`, bez wywołań):

* każdy model spoza ARCHON trafiłby do czytnika (`NO_METRIC_ANCHOR`, często też `PARTIAL_MODEL`/`BODY_MISSING`);
* **żaden model ARCHON nie trafiłby**, także Torenie 3 (obrys 0,85 referencji, brak pomieszczeń 1 i 7), Nigelle 4 (kalenica),
  świeże Piwonie 3 G (rozmiar 6 %, kalenica, 5 błędów kompilacji `OPENING_ABOVE_WALL_TOP`). Hipoteza z analizy potwierdzona:
  **błędny model uznany lokalnie za kompletny omija pomoc AI**; bramka nie czyta kontroli źródłowych.
* Czy przekierować? Sygnał `FOOTPRINT_AREA_NEAR` na DEV: 1 trafienie (Torenie), 1 fałszywy alarm (Nigelle, obrys 0,99 referencji).
  Jakość B na ARCHON jest niezmierzona (brak zapisanych odpowiedzi, brak wywołań). **Zmiany bramki nie wdrożono** — przekierowanie
  dobrych modeli do niezmierzonego czytnika nie ma dowodu korzyści.

**Wejście obserwacji AI do ścieżki lokalnej: nie istnieje.** Wynik opisu zastępuje model w całości (`MODEL_FROM_SOURCE_DESCRIPTION`),
z lokalnego przechodzą tylko rozmiary (`DescribedAnchors`); obrys, szklenie, wymiar ani klasa elementu z AI nie mogą wejść do
`plan-decomposition` ani do metryki. Harness B/C (7 pytań) przechodzi swoje testy na fiksturach (9/9: poprawna → CORRECT/VERIFIED,
fałszywa „1100” → CONTRADICTED, niejednoznaczna → UNKNOWN), ale nie ma konsumenta — żadna odpowiedź nie zmienia sceny.
Współrzędne: czytnik produktu podaje metry, nie piksele; pola `mirrored`/`frontIsPlanEdge` nie są czytane przez builder;
harness mapuje tylko skalę i przesunięcie (bez obrotu i lustra).

**Bramka dopuszczenia odczytu w resolverze** — §4.1 i §6: dobry odczyt (dokładnie wymiary drukowane) był odrzucany, bo jedynym
poparciem była zabudowa publikowana, która wcześniej odrzuciła pierwszy odczyt, a druga kopia rzutu czytała ściany źle.

## 4. Próby przyczynowe (diagnostyka, nie produkt)

Każda interwencja jest oznaczona i nie trafiła do commitu (łaty `DIAG-I3-accept-best.patch` sha256 `b7629ae9…`,
`DIAG-envelope-override.patch` z v3.53.14). Wynik produktu oceniamy wyłącznie przebiegiem automatycznym (§6).

### 4.1 I3 — poprawny wybór odczytu na granicy arbitrażu

Wejście: 8 odmów ARCHON z korpusu 1339, w których najlepszy odczyt resolvera mieścił się w ±20 % zabudowy (Goldstary 2, Surfinie 2,
Zonkile 3 G2E, Rubensy E, Gipsówki E, Czernice 3 G2E, Plumerie 2, Santany). Interwencja: przyjęcie najlepszego złożonego odczytu
bez twardej wady i bez odmowy bramki. Kontrola: pudełko modelu wobec najdłuższych wymiarów drukowanych na kopiach rzutu (odczyt OCR
„as printed”, `printed.py`).

| dom | I3: model | pudełko [m] | drukowane X × Y [cm] (kopie) | zgodność |
| --- | --- | --- | --- | --- |
| Goldstary 2 | MATCHES 0,99 | 16,10 × 9,05 | 1610 × 910 (2 kopie) | tak |
| Surfinie 2 | MATCHES 1,00 | 16,30 × 10,00 | 1630 × 1000 (2 kopie) | tak |
| Santany | NEAR 0,91 | 13,50 × 11,10 | 1350 × 1110 (3 kopie) | tak (wymiary; pole −9 %) |
| Zonkile 3 G2E | MATCHES 0,98 | 14,25 × 16,02 | Y 1600; X nie drukowany jako najdłuższy | tylko jedna oś |
| Gipsówki E | NEAR 0,93 | 16,20 × 13,20 | 1620 × 1070 | **nie** — głębokość 13,2 wobec 10,7 |
| Plumerie 2 | NEAR 1,07 | 15,00 × 8,26 | X 1500; brak Y | tylko jedna oś |
| Rubensy E | MATCHES 0,95 | 15,15 × 14,25 | brak zgodnej pary | nie |
| Czernice 3 G2E | MATCHES 1,05 (skala UNVERIFIED) | 16,14 × 16,75 | 1010 / 1101 | nie |

**Wniosek.** Pierwsza utrata w tych domach to arbitraż (etap 7/9), nie odczyt: resolver ma odczyt o rozmiarze drukowanym co do
centymetra, ale nie ma czym go potwierdzić niezależnie od zabudowy publikowanej (ta odrzuciła już pierwszy odczyt, więc nie może
wybierać zastępstwa), a `CROSS_COPY` porównuje tylko z rozkładem drugiej kopii, który bywa zły (Goldstary: druga kopia 30,65 m²).
Ślepe przyjmowanie najlepszego odczytu byłoby błędem (Gipsówki: zła głębokość). Potrzebny jest niezależny świadek — sprawdzony w §6.

### 4.2 Metryka podana z zewnątrz → obrys (domy spoza ARCHON)

Analizator sam wykonuje tę interwencję: gdy skala jest nierozstrzygnięta, a strona publikuje wymiary lub zabudowę, próbuje skali
z tych liczb (`scaleFromPublishedExtent`/`scaleFromPublishedFootprint`, `reconstruct-v2.ts:721-775`). Ślady przebiegów A:

| dom | podana skala z | wynik |
| --- | --- | --- |
| extradom-pl-2 | szer. × dł. publikowane 14,10 × 8,35 | `SIDES_DISAGREE`, `NO_OUTLINE`, `SHEET_NOT_READ`, `NOT_CONVERGED` |
| architecturaldesigns-com-1 | szer. × dł. publikowane | `SIDES_DISAGREE`, `NO_OUTLINE` |
| dobredomy-pl-1, domoweklimaty-pl | zabudowa publikowana | `NO_OUTLINE` |
| domoweklimaty-pl-1, -2 | zabudowa | `WALL_THICKNESS_IMPLAUSIBLE` (znaleziony obrys nie jest domem) |

**Wniosek.** Poza konwencją ARCHON metryka jest pierwszą utratą, a obrys drugą, niezależną barierą: nawet przy poprawnej skali
rozkład planu nie daje obrysu domu (szare ściany z przerwami, kolorowe wypełnienia, cienkie linie tarasów, inne grubości).
Sama naprawa metryki (np. ft/in) nie dałaby sceny.

### 4.3 Obwiednia przy przeszkleniu (v3.53.14, przywołane)

Supertunie 2 E: z ręcznie potwierdzoną metryką (D2) odmowa ta sama (`PLAN_NO_WALLED_ENVELOPE`); z ręczną obwiednią (D2b) 66,4/93,56 m²
i `PLAN_LAYOUT_REJECTED` — za obwiednią są jeszcze co najmniej trzy decyzje obrysu (lica wewnętrzne zamiast zewnętrznych, okno
w dolnej elewacji niedomykające obrysu, dolny pas jako osobna bryła). W tej kampanii nie powtarzano: kod tych etapów bez zmian.
Mechanizm „krótki filar narożny + przeszklenie” dotyczy w korpusie 1338/1339 tylko 3 z 56 odmów (`PLAN_NO_WALLED_ENVELOPE`),
wobec 30 odmów klasy „odczyt odrzucony w arbitrażu/układzie” i 12 „brak ramy wymiarowej”.

### 4.4 Nowa informacja, która realnie koryguje scenę

* **Lokalnie (wariant V1, odrzucony z braku aktywacji w grupie odłożonej):** drukowany wymiar całkowity drugiej kopii rzutu jako
  świadek odczytu — Goldstary 2 i Santany (§6): odmowa → model o wymiarach drukowanych; na świeżych Saponariach V1 poprawnie
  nie przyjął odczytu z pergolą w bryle.
* **Opis AI (odtworzenie zapisanych odpowiedzi, §5):** dobredomy-pl-1, domoweklimaty-pl-2, extradom-pl-2, architecturaldesigns-com-2:
  odmowa lokalna → model z rozmiarem w 3 % referencji; lipinscy-pl-2: model lokalny bez dachu → model z dachem dwuspadowym.

## 5. Porównanie strategii

| wariant | co zmierzono | N | wynik |
| --- | --- | --- | --- |
| **A** — lokalna produkcja | 30 domów, 8 wydawców | 30 | 14 modeli: 7 „używalnych” wąsko, 7 z wadą; 16 odmów (tabela §5.1) |
| **B** — globalny opis AI + lokalny kompilator | **odtworzenie** zapisanych opisów S53 (Sonnet 5.5, prompt `HOUSE_DESCRIPTION` 0.2.0) przez obecny checker/builder 0.7.0/kompilator; bez wywołań | 12 (6 wydawców) | 10 modeli, 5 używalnych; 2 opisy sprzed schematu 0.2.0 nie do odtworzenia |
| A na tych samych 12 | | 12 | 3 modele, 1 używalny |
| **C** — B + kadry/warstwy | brak zapisanych odpowiedzi, wywołanie niedozwolone (§8) | 0 | **niezmierzone**; harness i kontrpróby tylko offline |
| **D** — szkice | brak narzędzia i budżetu | 0 | **niezmierzone** |

### 5.1 Per wydawca (A na 30; B tam, gdzie istnieje zapisany opis)

| publisher | N | A modele | A używalne | B modele | B używalne |
|---|---|---|---|---|---|
| archon | 9 | 4 | 4 | 0 (brak 9) | 0 |
| architecturaldesigns | 3 | 1 | 0 | 1 (brak 1) | 1 |
| dobredomy | 3 | 2 | 0 | 2 (brak 1) | 1 |
| domoweklimaty | 3 | 0 | 0 | 2 (brak 1) | 1 |
| extradom | 3 | 1 | 1 | 2 (brak 1) | 1 |
| houseplans | 3 | 1 | 0 | 2 (brak 1) | 0 |
| lipinscy | 3 | 3 | 1 | 1 (brak 1) | 1 |
| studioatrium | 3 | 2 | 1 | 0 (brak 3) | 0 |

„brak” = nie istnieje zapisany opis dla tej strony (B nie było wywoływane). Pełna tabela per dom: `tables-AB.md` w paczce.

### 5.2 Wnioski ze strategii

* **Uniwersalność architektury LOCAL: nie potwierdzona.** Poza ARCHON 11 z 21 domów kończy się odmową na metryce, a z 10
  zbudowanych modeli tylko 3 są „używalne” wąsko; po podaniu skali odpada obrys (§4.2). Na ARCHON 4 z 9 modeli, z czego DEV 3/5.
* **B jest jedyną strategią, która buduje modele u wydawców spoza konwencji ARCHON** (10/12 przy 3/12 dla A na tych samych
  wejściach). Słabość B to rozmiar: 4 z 10 modeli z błędem 12–30 % (extradom-pl-1: bryła 9,9 m wobec 14,82 m głębokości
  drukowanej; houseplans-com-2: 30 %) — tam, gdzie lokalna metryka nie istnieje, nie ma też kotwicy dla B.
* **Strategia wybrana:** hybryda z rozdziałem ról — LOCAL jako źródło metryki, obrysu i arbitrażu tam, gdzie jego czytniki
  działają (ARCHON i podobne arkusze), z niezależnymi świadkami w arbitrażu; B jako czytnik domu tam, gdzie LOCAL odmawia lub nie
  ma kotwicy (dziś: wszystkie odmowy i wszystkie modele bez kotwicy spoza ARCHON trafiają do czytnika — bramka działa poprawnie dla
  tej klasy). Część lokalną zmierzono wariantem V1 (§6): poprawny i bez szkód, ale bez aktywacji w grupie odłożonej — odrzucony. Część B pozostaje pilotem
  hostowym: zmierzono ją tylko odtworzeniem, a do porównania na ARCHON i FRESH potrzebny jest żywy czytnik (§8).
* **IU-02** (36→21 odczytów otworów, 15→11 rejestracji po zastąpieniu oryginałów czystymi obrazami) nie dotyczy obecnej ścieżki:
  czytnik produktu dostaje oryginały (zmniejszone do ≤ 1568/1100 px, `described.ts:154`), a wariant C w harnessie dokłada kadr obok
  oryginału, nigdy zamiast. Wpływu kadrów nie zmierzono.

## 6. Wariant V1: resolver 1.7.0 — wydrukowany wymiar całkowity drugiej kopii jako świadek odczytu

**Werdykt: odrzucony jako produkcja v3.54 według zamrożonego kryterium (§5 protokołu: ≥ 1 aktywacja w grupie odłożonej ze skutkiem
zgodnym z referencją). Zachowany jako łata i test do kolejnej próby na nowej świeżej próbie.** Kod wycofano z gałęzi
(`ef2e5cc`); obowiązuje kod 1339.

**Zmiana** (`79084ab`, solver 2.44.0, resolver 1.7.0). Gdy pierwszy odczyt rzutu stanie, resolver waży inne odczyty tego samego
rysunku. Odczyt bez zgodnej zabudowy publikowanej potrzebuje dwóch świadków (izotropia skali, zgodność z rozkładem innej kopii).
V1 dodaje trzeciego, niezależnego świadka — **wydruk**: odczyt, którego zasięg potwierdzają ściany (ich własny zasięg albo rama linii
wymiarowych, do której ściany dochodzą), ma szerokość i głębokość równe (1,5 % lub 5 cm) najdłuższym wymiarom, jakie **inna kopia
rzutu tej samej kondygnacji** drukuje na poziomej i pionowej linii wymiarowej, odczytanym tak, jak wydrukowano (`origin: READ`).
Rama z kresek, do której ściany nie dochodzą, się nie liczy (mierzy to, co podpisy mówią z definicji). Zabudowa publikowana nadal
odrzuca odczyt poza 20 %, „wydana” zabudowa nadal nie wybiera, remis różnych budynków nadal jest nazywany.

**Testy.** `plan-resolution-printed.test.ts` (syntetyczny arkusz, dwie kopie): przyczyna czerwona na 226c9ac, zielona na V1;
kontrpróby (inny wydruk, jedna oś, wartość poprawiona przez łańcuch) zielone na obu; istniejące testy resolvera 20/20.

| próba | wynik V1 wobec 1339 |
| --- | --- |
| zbiór v3.54, 30 domów (DEV 13, HELD 10, FRESH 7) | **0 zmian** (te same skróty modeli / te same odmowy) |
| odmowy z I3 (8, rozwój tej zmiany) | Goldstary 2 → model 16,10 × 9,05 m (drukowane 1610 × 910), Santany → model 13,50 × 11,10 m (1350 × 1110), MATCHES; Surfinie 2 bez zmian — jedyny odczyt o rozmiarze drukowanym ma ramę z kresek, do której ściany nie dochodzą (ochrona przed kołowością zadziałała); 5 pozostałych bez zmian |
| FRESH Saponarie G2E (jedyny dom odłożony, w którym mechanizm wystąpił) | bez zmian, **poprawnie**: najlepszy odczyt ma 16,5 × 21,8 m (pergola wliczona w bryłę, głębokość +24 % wobec drukowanego 1760); ślepe przyjęcie (I3, diagnostyka po zapisaniu wyniku) dałoby błędny dom |
| regresja korpusu, 38 domów, w których działa resolver | 36 identycznych, 2 zmienione — Goldstary 2 i Santany: odmowa → model (te same co w I3); **0 nowych odmów, 0 innych zmian** (V1 w pełnej produkcji na zapieczętowanym grafie; baza 1339 tylko solverem na tym samym dowodzie metrycznym) |

**Dlaczego odrzucony mimo braku szkód.** Zmiana jest precyzyjna (0 fałszywych przyjęć, poprawna odmowa na Saponarii), ale jej
mechanizm jest rzadki (≈ 2 z 35 odmów korpusu) i nie wystąpił w grupie odłożonej ze skutkiem — korzyści uogólnienia nie wykazano.
Kryterium nie obniżono po wyniku. Do ponownej oceny: nowa świeża próba z kopiami rzutu drukującymi wymiary całkowite.

### 6.1 Plansze (prywatnie)

Kolumny ŹRÓDŁO | PRZED | PO; wiersz 3D z tymi samymi kamerami i skalą dla obu modeli (`pair-views.ts`, jedno dopasowanie do sumy
obu modeli); obok elewacja źródłowa. Odmowa ma wpisaną przyczynę.

* A ↔ B (5 domów, 4 wydawców): dobredomy-pl-1, domoweklimaty-pl-2, extradom-pl-2, lipinscy-pl-2 (poprawy B), houseplans-com-2
  (porażka B: rozmiar 30 %).
* 1339 ↔ V1: Goldstary 2, Santany (odmowa → model o wymiarach drukowanych).
* Saponarie G2E (FRESH): A/V1 odmowa ↔ I3 diagnostyka — co V1 słusznie odrzucił (pergola w bryle).

## 7. Koszt, czas, pamięć

* Płatne wywołania: **0** (księga bez zmian: 2,72807938 / 5 USD, 92 wpisy, billing UNCONFIRMED). Koszt na poprawiony dom: 0 USD
  w LOCAL. Dla B (odtworzenie) koszt historyczny zapisanych opisów: 0,698 USD (E1, 6 domów) i 0,744 USD (E3, 6 domów) —
  ok. 0,12 USD na dom; odtworzenie 0 USD.
* Czas A (pełna produkcja z OCR, host 4 vCPU, 2–3 przebiegi równolegle), N = 30: p50 166 s, p95 358 s, max 419 s.
  Odtworzenie B: 0,3–0,6 s na dom (bez czytnika; czas czytnika z S53: 43–113 s).
* Pamięć szczytowa A (RSS), N = 30: p50 1023 MB, p95 1235 MB, max 1391 MB.
* Pozycje otwarte w modelach A (`unresolved`, nie są pytaniami użytkownika): 9–55 na model; w tej kampanii nie liczono pytań
  weryfikacji (warstwa korzeni bez zmian).

## 8. Ograniczenia i konkretne braki

* **Pomiar B/C na żywo: zablokowany.** W środowisku nie ma klucza API, a księga ma billing UNCONFIRMED (Master Plan §7: uzgodnienie
  księgi jest warunkiem nowych wywołań). Nie wywołano ani API, ani CLI. Co dokładnie odblokuje pomiar: klucz w osobnym workspace
  z miesięcznym limitem, potwierdzenie rzeczywistego salda/rozliczenia przez OWNER-a i wpis otwarcia księgi; wtedy
  `research/source-to-model/s53/describe-house.ts` (B) i harness s5311 (B/C) na 9 domach ARCHON i 7 FRESH tego zbioru.
* **B mierzone tylko odtworzeniem** na 12 stronach, które były już w rozwoju buildera opisowego (E1 strojone, E3 obejrzane) —
  przewaga B nad A na tych wejściach jest duża (10 vs 3 modele), ale nie jest wynikiem ślepym.
* **D (szkice) i C (kadry/warstwy): niezmierzone.** Brak narzędzia generacji i brak zapisanych odpowiedzi.
* **Referencje** zrobił czytnik tej samej rodziny modeli co B (z kontrolą wyrywkową wykonawcy) — wymiary oceniano wobec
  liczb drukowanych.
* **Grupa HELD** jest „widziana, niestrojona” (aneks 1); ślepa jest tylko FRESH (7 domów, 2 wydawców).
* **Etapy 5–6 poza ARCHON nie zostały naprawione** — wymagają prototypu (gramatyka ft/in z dekoderem, inna detekcja linii
  wymiarowych, granica z muru, szklenia i drzwi). Ta kampania tylko je zmierzyła i wskazała.
* Android na urządzeniu: **NOT_VERIFIED** (brak emulatora/KVM, brak urządzenia).

## 9. Dalej

1. Odblokowanie pomiaru B na ARCHON i FRESH (klucz + uzgodniona księga) — dopiero wtedy decyzja o bramce czytnika dla modeli
   z niezgodnością źródłową (Torenie, Piwonie).
2. Szew obserwacji AI → LOCAL: obrys/szklenie/klasa elementu z AI jako hipoteza sprawdzana na tuszu rzutu (jak `PRINTED_OVERALL`:
   przyjęcie tylko z niezależnym świadkiem z rysunku), z kontrpróbą fałszywej wskazówki.
3. Metryka poza ARCHON: gramatyka ft/in z dekoderem (US), detekcja linii wymiarowych na innych stylach, kotwice z opublikowanych
   wymiarów. Mierzyć łącznie z obrysem (§4.2: sama metryka nie da sceny).
4. Orientacja kalenicy — najczęstsza wada zbudowanych modeli w grupach odłożonych (Piwonie 3 G, Amber XI, dobredomy-pl) i DEV
   (Nigelle 4, lipinscy-pl-1), 4 wydawców; oraz wybór kondygnacji bazowej (dobredomy-pl-1 czytany z rzutu poddasza). FRESH jest
   już obejrzana: następny wariant wymaga nowej świeżej próby.
5. V1 (łata `V1-resolver-1.7.0.patch` w paczce): ponowna ocena na nowej świeżej próbie ARCHON z wieloma kopiami rzutu.

## 10. Dostawa, testy i ciągłość

* Commity na `claude/new-session-3kzcgh` (`[skip ci]`, bez merge i PR): `79084ab` (V1, w toku), `028e400` (migawka kontraktu
  i przypięcie dla V1, mapa modułów, narzędzia odtworzenia B i próby bramki), `ef2e5cc` (wycofanie V1 — kod produkcyjny = 226c9ac),
  ten raport. Łata V1: `stage-reports/artifacts/v354/V1-resolver-1.7.0.patch` (sha256 `412d0885…`).
* Testy: typecheck (`npm run typecheck`) zielony na końcowym drzewie; `tests/architecture` 358: 347 zielonych, 11 czerwonych — te
  same nazwy co w bazie (compound-facade 1, reference 2, research-isolation 4, wall-strip 4), dodane skrypty `research/` nie
  dodały żadnej. Kod produkcyjny = 226c9ac, więc macierz modułów produkcyjnych jest macierzą 1339 (v3.53.13 §9). Na V1, przed
  wycofaniem: test przyczyny czerwony na 226c9ac i zielony na V1, kontrpróby zielone na obu, `plan-resolution` 20/20, migawka
  kontraktu Android przechwycona (zmieniały się tylko `candidateHash` i wersja solvera) — wycofana razem z V1. Harness B/C 9/9
  (fikstury).
* APK: **nie budowano** — brak przyjętej zmiany produkcyjnej; obowiązuje APK 1339. Android na urządzeniu: NOT_VERIFIED.
* Prywatna paczka: `BuildPlan-V354-Private.zip` (poza Gitem): protokół i pieczęcie, referencje (18 nowych + 12 S53), tabele, wyniki
  przebiegów A/V1/I3/regresji/B (podsumowania, modele, widoki), zachowane opisy S53, plansze, obrazy źródeł w ramie analizy,
  narzędzia, łaty diagnostyczne i V1, `MANIFEST.sha256`; rozpakowanie i sumy sprawdzone (skrót ZIP w `PROJECT_STATUS.md`).
* Handoff: `HANDOFF.md` w paczce (rewizje, ścieżki, blokady, następny krok).
