# SOURCE_TO_MODEL v3.54.1 — czytnik Claude API, hybryda i ścieżka produktu

Etap: OWNER brief v3.54.1 (Hybryda API), Master Plan v3.54.1 (`docs/MASTER_PLAN.md`, sha256 39b94331…). Gałąź
`claude/new-session-3kzcgh`. Kandydat zamrożony przed otwarciem próby końcowej (aneks 2 protokołu) na `0c11cd0` (kod H1 `bfc5910` + okablowanie
hosta `c8067b6`); raport i dane na końcowym HEAD gałęzi. Protokół i próba końcowa
zapieczętowane przed jakimkolwiek wywołaniem API: `stage-reports/artifacts/v3541/PROTOCOL_V3541.md` (+ `PROTOCOL.seal`).

**Werdykt: CHECKPOINT — cel etapu spełniony częściowo.** Na odłożonej próbie FINAL 12 (4 wydawców, 2 nigdy wcześniej
nieużywanych) scena poprawiła się w 9 domach u wszystkich 4 wydawców, kilkoma mechanizmami; ale są **2 krytyczne
regresje** wobec LOCAL (Kukliki: rozmiar OK→WRONG; Madera: kalenica dobra→zła), więc warunek „brak nowej krytycznej
regresji” nie jest spełniony. Poprawa pochodzi z naprawionego czytnika AI w istniejącej ścieżce produktu (bramka v3.53),
a nie z nowych mechanizmów hybrydy H1: te miały 0 aktywacji na FINAL i 1 na DEV (Torenie 3 E). H1 zostaje za flagą
(domyślnie wyłączone). Android NOT_VERIFIED; bez APK (brak zmiany w aplikacji — AI działa tylko na hoście).

## Pięć pytań OWNER-a

**1. Czy scena poprawiła się na nowych rodzinach i u których wydawców?** Tak, na odłożonej próbie FINAL 12 (rodziny
nigdy wcześniej nieanalizowane, losowane z ziarnem, referencje zapieczętowane przed uruchomieniem czegokolwiek):
modele 5 → 12; rozmiar OK/NEAR 2 → 8 z 12; średnie IoU obrysu 0,68 (n = 4) → 0,86 (n = 11). Poprawa w 9 domach u
**wszystkich 4 wydawców**: archon.pl (Aksamitki, Sakura: odmowa → model), domywstylu.pl (Puszek: odmowa → model;
Madera: rozmiar WRONG→OK, IoU 0,55→0,69; Miodowy: IoU 0,50→0,91), monsterhouseplans.com (plan23-504: IoU 0,68→0,83;
plan63-411: odmowa → model), houseplans.com (sp318422, sp368685: odmowa → model). Ale: **Kukliki** — poprawny model
LOCAL (rozmiar OK, IoU 1,00) zastąpiony gorszym opisem (−18 %, IoU 0,71) i **Madera** — kalenica dobra → zła; plus
plan5-737 z odmowy na model ze złym rozmiarem (−25 %, nie liczony jako poprawa). Wizualnie opis wnosi rozpoznawalne
cechy (czerwona dachówka i kominy w Kuklikach), których szary model LOCAL nie ma — to osobna ocena od miar (§6).

**2. Co weszło do produkcji?** (wszystko z testami, w ścieżce `analyseLink` / host `apps/analyzer-api`):
- **Naprawa czytnika** (`source-vision`, czytnik 0.3.0): API odrzucało *każde* żądanie opisu domu („The compiled
  grammar is too large”) — ścieżka AI produktu nigdy nie zwróciła opisu na żywo. Opis idzie teraz przez jedno
  nie-strict narzędzie odpowiedzi (`record_answer`, `tool_choice: auto`); sortowanie zostaje w trybie strict.
- **Przyjmowanie opisu** (`checkHouseDescription`, opis 0.2.1): kolor niepodany jako hex i wadliwy wpis inwentarza
  obrazów są stratą elementu nazwaną ostrzeżeniem, nie odmową całego domu; sprzeczność geometrii nadal odmawia.
- **Wysokość kondygnacji z rysunków tylko jako piętro-do-piętra** (`anchorsOfDrawings`): wcześniej wysokość
  jedynego poziomu (do kalenicy: 5,72 / 6,24 / 6,83 / 7,34 m) szła jako „wysokość kondygnacji” i rozciągała opis.
- **Builder 0.8.0** (`perAxisFromWalls`): zmierzony kompletny obrys trzymany oś po osi, gdy proporcja całości się różni.
- **`readEveryModel`** w `analyseLink` + przełącznik hosta `ANALYZER_HOUSE_READER_EVERY_MODEL=on` (domyślnie off).
Nie weszło: wariant C (kadry), żadna zmiana ścieżki LOCAL, nic w aplikacji Android.

**3. Czy aplikacja używa AI i w jakim trybie?** Telefon — nie: uruchamia tylko LOCAL i nie ma klucza. AI działa na
hoście analizatora, i tylko gdy: `ANALYZER_HOUSE_READER=live` + skumulowany pułap `ANALYZER_HOUSE_READER_MAX_USD` +
token pilota (≥ 24 znaki) + znane ceny modeli; zadanie dostaje czytnik tylko, gdy zgłoszenie okazało token pilota
(`describe: true`). Wtedy opis jest pytany po odmowie LOCAL albo po słabym modelu LOCAL (bramka v3.53), a z
`ANALYZER_HOUSE_READER_EVERY_MODEL=on` również po modelu kompletnym (H1). Każde żądanie jest rezerwowane w księdze
hosta przed wysłaniem. Klucz dostawcy tylko w środowisku hosta; żaden endpoint go nie zwraca. Czy aplikacja Android
faktycznie otrzymuje opisaną scenę z hosta: NOT_VERIFIED (nie uruchamiano).

**4. Koszt kampanii i koszt na dom.** Razem **4,11036 USD** (wycena wg usage po cenach z cennika z 2026-11-16, nie
faktura; 1 EUR przeliczane jako 1,00 USD dla pułapów, czyli ≤ ~4,11 EUR) w 132 żądaniach (128 odpowiedzi, 4 odrzucone przed uruchomieniem modelu, bez kosztu): pilot 0,2411 (w tym
0,0034 pierwszej, odrzuconej próby), B na S30 1,6567, C 1,3354, powtórka B (wariancja) 0,2438, B na FINAL 0,6334.
Jeden odczyt domu (sortowanie Haiku + opis Sonnet) ≈ **0,05–0,07 USD**, opóźnienie odczytu p50 ≈ 19 s, maks. 54 s;
z kadrami (C) ≈ 0,11 USD. Cały dom w H1 (LOCAL + odczyt) 1–7 min, z czego LOCAL dominuje. Księga:
`research/ai-assist/spend-ledger-v3541.json` (requestId, model, usage, koszt, suma ksiąg po każdym żądaniu).
Historyczne 2,72807938 USD (S53, 92 wpisy CLI) pozostaje osobne i nieuzgodnione. Czy 100 EUR to saldo, limit
miesięczny czy budżet współdzielony — **nieznane** tej sesji (brak dostępu administracyjnego).

**5. Co nadal jest złe i jaka jest następna bariera.**
- **Opis nie trzyma się własnego drukowanego wymiaru:** w Kuklikach i plan5-737 czytnik odczytał wymiar całkowity
  poprawnie (756 × 876; 28'-0" × 40'-0"), ale bryły narysował mniejsze (6,2 × 7,6 m); builder skaluje bryły do
  całości tylko przy zgodnym współczynniku obu osi (5 %), więc zostawia złe bryły. To następna bariera (B → model).
- **Bramka v3.53 oddaje opisowi dobry model LOCAL bez zweryfikowanej skali** (Kukliki; na S30 lipinscy-pl-1,
  architecturaldesigns-com): „brak kotwicy” nie znaczy „zły model”.
- **Stopy/cale:** na S30 opis myli wymiar strony (z podcieniami) z budynkiem (houseplans-com-1/-2,
  architecturaldesigns-com-1: 19–30 %); LOCAL nadal odmawia (dekoder tylko cyfr).
- **Otwory:** opis systematycznie zaniża liczbę (0,3–0,7 na wielu domach), LOCAL zawyża.
- **Topologia dachu:** opis dopisuje przecinające się szczyty i dachy nad tarasami (Torenie), czego IoU nie widzi.
- **Powtarzalność:** to samo pytanie daje różne domy (Nigelle IoU 0,94 vs 0,79; dobredomy-pl-2 NEAR vs WRONG;
  Saponarie model vs odmowa).

## 1. Korekty raportu v3.54 (brief §1)

- „Tylko AI buduje u innych wydawców” — **za mocne**. LOCAL zbudował 10 z 21 modeli spoza ARCHON (S30: 14 modeli,
  z czego 4 ARCHON). Prawdziwe zdanie: każda odmowa spoza ARCHON (11/21) zatrzymuje się na metryce, a z 10 modeli 7
  nie ma zweryfikowanej skali.
- „Używalny” w v3.54 sprawdzał rozmiar, kondygnacje, rodzaj dachu i kierunek kalenicy — **nie otwory ani pokoje**.
  W v3.54.1 raportuję osobno rozmiar, IoU z brakami/nadmiarem, kalenicę i stosunek otworów; pokoje nie są oceniane.
- „Obwiednia to 3 z 56 odmów” — to liczenie **po pierwszym kodzie odmowy**, nie po przyczynie: dom może mieć wadliwą
  obwiednię i odmówić wcześniej z innego kodu.
- Referencje czytane przez tę samą rodzinę AI co B mogą mieć **skorelowane błędy**. W v3.54.1 referencje FINAL czytały
  4 osobne agenty widzące tylko obrazy źródła; wykonawca sprawdził 6 z 12 z drukiem (§3) — zgodne. Ryzyko zostaje.
- **Kopie tego samego druku nie są niezależnymi świadkami** (V1 w v3.54 opierał `PRINTED_OVERALL` na drugiej kopii
  rzutu; druga odpowiedź AI i jej pewność też nie są świadkami). W H1 jedynym świadkiem przeciw opisowi są ściany
  umieszczone przez LOCAL w zweryfikowanej skali.
- HELD i FRESH z v3.54 są teraz **znane** (wyniki A i V1 przeczytane); S30 jest wyłącznie rozwojem i regresją.

## 2. Zbiory i protokół

| zbiór | skład | rola |
|---|---|---|
| S30 | 30 projektów v3.54 (DEV 13 / HELD 10 / FRESH 7), 8 wydawców | rozwój, porównanie, regresja — znane |
| PILOT 4 | Torenie 3 E (ARCHON, zły kompletny model), lipinscy-pl-2 (linie wymiarowe), houseplans-com-2 (ft-in), domoweklimaty-pl-1 (bez wymiarów) | transport, schemat, koszt |
| C12 | pilot + Nigelle, Piwonie, Saponarie, Awans II, Amber XI, architecturaldesigns-com-2, extradom-pl-2, dobredomy-pl-2 (dobór po cechach źródła przed B) | B vs C |
| FINAL 12 | archon.pl 3 (Kukliki, Aksamitki, Pod sakurą), domywstylu.pl 3 (Puszek, Madera, Miodowy), monsterhouseplans.com 3 (plan23-504, plan63-411, plan5-737), houseplans.com 3 (sp318422, sp324651, sp368685) | odbiór — zamrożone przed rozwojem kandydata |

FINAL: ziarno `sha256('fca6dad'+'BUILDPLAN-V3541-FINAL')`, pula = rodziny nigdy nieanalizowane; dostępność oceniona
tylko po metadanych akwizycji (≥ 3 obrazy ≥ 200 px, ≥ 1 opublikowana liczba; reguła poprawiona przed pierwszym użyciem,
bo strony USA publikują wymiary, nie pola). monsterhouseplans.com: 3 z 18 stron dało akwizycji produktu obrazy
(znalezisko produktowe); z500.pl odmawia automatom (403). Kontrola tego samego projektu u wydawców USA: brak kopii.

## 3. Referencje i progi

S30: 18 referencji v3.54 + 12 S53 (hashe zapieczętowane, zgodne). FINAL 12: referencje z samych obrazów źródła, przed
jakąkolwiek strategią (`research/source-to-model/v3541/refs-final/`, `refs-final.sha256`); 11/12 z wielokątem obrysu,
sp324651 bez wymiaru całkowitego (rozmiar i obrys pominięte, nie zgadywane); dwa obrysy monsterhouseplans odmierzone
skalą z etykiet pokoi (błąd referencji ±5 %); Miodowy to bliźniak (referencja obrysowuje parę). Kontrola wykonawcy:
6/12 domów (Kukliki 756 × 876, Sakura 1760 × 1230 z uskokiem 240/485, Puszek 11,52 × 8,52, Madera 15,98 × 18,71,
plan5-737 28'-0" × 40'-0", sp368685 23'-0" × 47'-1") — zgodne z drukiem. Odchylenie od protokołu: kontrola zrobiona
tuż po otwarciu FINAL, przed przeczytaniem jakiegokolwiek wyniku. Progi (§6 protokołu) zamrożone przed wynikami.

Miary: rozmiar (OK ≤ 3 %, NEAR ≤ 8 %, WRONG > 8 %), IoU obrysu w skali modelu (4 obroty + przesunięcie, bez lustra,
bez dopasowania skali; samotest: kopia obrócona 1,00, lustro 0,86, skala ×1,1 0,83), braki i nadmiar w % pola
referencji, kondygnacje, rodzaj dachu i kierunek kalenicy, stosunek otworów. Poprawa / krytyczna regresja według §6.

## 4. Pomiary na S30 (rozwój — nie ślepe)

| strategia | modele | rozmiar OK/NEAR/WRONG/— | IoU śr. (n) | vs A: poprawy / krytyczne regresje |
|---|---|---|---|---|
| A — LOCAL | 14 | 7 / 4 / 3 / 16 | 0,841 (11) | — |
| B — opis live | 29 | 18 / 4 / 6 / 2 | 0,877 (18) | 18 / 4 |
| P0 — produkt przed etapem (bramka, czytnik działający) | 29 | 16 / 6 / 6 / 2 | 0,875 (18) | 16 / 4 |
| H0 — opis na kotwicach LOCAL dla każdego modelu | 29 | = B we wszystkich domach | | 18 / 4 |
| H1 — kandydat | 29 | 17 / 5 / 6 / 2 | 0,882 (18) | 17 / 4 |

- Pilot: pierwsze uruchomienie — 4/4 opisy odrzucone przez API (gramatyka), bez kosztu; po naprawie 4/4 modele.
- B na S30: 26/30 modeli, 4 odmowy checkera (3 kosmetyczne: kolor „none”/"", wpis inwentarza; 1 prawdziwa:
  BODIES_COINCIDE). Po zmianie przyjmowania te same nagrane odpowiedzi: 29/30.
- Regresje B/H1 wobec A (lipinscy-pl-1 rozmiar →WRONG, architecturaldesigns-com IoU −0,20 i kalenica, extradom-pl i
  houseplans-com kalenica) dotyczą modeli LOCAL bez zweryfikowanej skali, które P0 i tak oddaje opisowi.
- **H0 = B w każdym domu:** istniejący kanał LOCAL→AI niczego nie zmienił — kotwice nie przechodziły kontroli
  proporcji, a jedyny skutek (wysokość kondygnacji) był błędny.
- **H1 vs P0: 1 poprawa, 0 regresji** — Torenie 3 E (rozmiar NEAR→OK, IoU 0,85→0,98); LOCAL zachowany w 3 pozostałych
  kompletnych modelach (Nigelle 0,98, Nolany 0,97, Piwonie).
- **C (kadry) nie przyjęte:** C12 12/12 modeli; więcej otworów (np. Piwonie 0,33→0,93), lepszy Torenie i
  architecturaldesigns-com-2 (odmowa→model), ale gorszy obrys w 5/10 ocenionych. Powtórka B na 4 domach daje rozrzut tej
  samej wielkości (Nigelle 0,94 vs 0,79, dobredomy-pl-2 NEAR vs WRONG, Saponarie model vs odmowa) — przy jednej próbie na
  dom efekt kadrów nieodróżnialny od szumu.

Pełna tabela S30: `stage-reports/artifacts/v3541/TABLE_S30.md`.

## 5. Próba końcowa FINAL 12

| dom | wydawca | A (LOCAL) | B = P1 = H1 |
|---|---|---|---|
| archon-dom-w-kuklikach | archon | OK 0,000 · IoU 1,00 · kal. ✗ · otw. 1,0 | **WRONG 0,180** · IoU 0,71 · kal. ✗ · otw. 1,0 |
| archon-dom-w-aksamitkach | archon | odmowa (METRIC_RESOLUTION_INCONCLUSIVE) | NEAR 0,070 · IoU 0,98 · kal. ✓ · otw. 0,38 |
| archon-dom-pod-sakura | archon | odmowa (PLAN_RESOLUTION_INCONCLUSIVE) | OK 0,000 · IoU 0,97 · kal. ✗ · otw. 1,0 |
| domywstylu-puszek | domywstylu | odmowa (PLAN_NO_DIMENSION_FRAME) | OK 0,002 · IoU 1,00 · kal. ✓ · otw. 1,17 |
| domywstylu-madera | domywstylu | WRONG 0,306 · IoU 0,55 · kal. ✓ · otw. 2,67 | OK 0,001 · IoU 0,69 · **kal. ✗** · otw. 1,33 |
| domywstylu-miodowy | domywstylu | WRONG 0,219 · IoU 0,50 · otw. 2,5 | WRONG 0,119 · IoU 0,91 · otw. 0,8 |
| monsterhouseplans-plan23-504 | monster | OK 0,013 · IoU 0,68 · kal. ✗ | OK 0,011 · IoU 0,83 · kal. ✗ |
| monsterhouseplans-plan63-411 | monster | odmowa (METRIC_RESOLUTION_INCONCLUSIVE) | NEAR 0,061 · IoU 0,76 · kal. ✗ · otw. 0,56 |
| houseplans-sp318422 | houseplans | odmowa (METRIC_RESOLUTION_INCONCLUSIVE) | OK 0,003 · IoU 0,90 · kal. ✓ · otw. 1,0 |
| houseplans-sp324651 | houseplans | model (referencja bez wymiaru) · otw. 0,4 | model · kal. ✓ · otw. 1,0 |
| houseplans-sp368685 | houseplans | odmowa (METRIC_RESOLUTION_INCONCLUSIVE) | OK 0,001 · IoU 1,00 · kal. ✗ · otw. 0,7 |
| monsterhouseplans-plan5-737 | monster | odmowa (METRIC_RESOLUTION_INCONCLUSIVE) | WRONG 0,250 · IoU 0,68 · kal. ✗ · otw. 0,8 |

Wszystkie 5 modeli LOCAL na FINAL ma słabość `NO_METRIC_ANCHOR`, więc istniejąca bramka oddaje je opisowi; żaden nie
jest „kompletny”, więc `readEveryModel` się nie aktywował, a kotwic do osi nie było (skala niezweryfikowana): H1 = P1 =
B. **H1 vs A: 9 popraw (4 wydawców), 2 krytyczne regresje.** H1 vs P1 i vs B: 0 / 0.

Ocena celu (§9): poprawa u ≥ 2 wydawców — **tak** (4); więcej niż jeden mechanizm — **tak** (odmowa→model, obrys,
rozmiar, kalenica w sp324651); brak nowej krytycznej regresji — **nie** (Kukliki, Madera); pełna ścieżka produkcyjna
konsumuje — **tak** (`analyseLink` na hoście, tryb pilota). Ograniczona, zmierzona poprawa zostaje: naprawa czytnika
w produkcji; H1 za flagą.

## 6. Ślad: źródło → pytanie → odpowiedź → obserwacja → decyzja → element → scena (usługa `analyseLink`)

1. **Torenie 3 E — istniejący, ale błędny model (H1).** LOCAL: model kompletny, ściany 7,39 × 12,50 m w zweryfikowanej
   skali (brak 15,5 % obrysu). Żądanie `HOUSE_DESCRIPTION` (11 obrazów, `req_011Ch6Bf8fvZ4doZXCLaBHTL`, 15 687/2 881
   tokenów) → odpowiedź: całość 7,9 × 11,6 m `PRINTED_ON_DRAWING`, etykiety `790` / `1160`, rama: obraz 11, front =
   dół → `descriptionExceedsDrawings`: „7.9 m is printed where the drawings' outline reaches 7.39 m” →
   `DESCRIPTION_PREFERRED` → builder `SCALED_TO_DRAWINGS_MEASURE_PER_AXIS`: wzdłuż frontu 7,90 m z opisu, w głąb
   ściany LOCAL 12,50 m (opis wziął segment 1160 za całość) → model 7,90 × 12,50 (druk: 790 × 1250), IoU 0,98, scena
   `78c72012…`. Wizualnie: lepszy obrys, ale opis dopisał przecinający się szczyt i dachy nad tarasem.
2. **Pod Supertuniami 2 E — odmowa → model.** LOCAL: `METRIC_RESOLUTION_INCONCLUSIVE` → opis (13 obrazów,
   `req_011Ch6BqBGiqZ2V7AQiorCRm`): 6,9 × 13,5 m z etykiet `690` / `1350`; pierwotnie odrzucony przez checker za
   `palette.garageDoor: "none"` → przyjęcie 0.2.1: `PALETTE_COLOUR_NOT_STATED` (domyślny kolor) → model 6,90 × 13,50,
   rozmiar OK, IoU 1,00, scena `e5da699a…`.
3. **lipinscy-pl-2 — model LOCAL bez dachu i bez kotwicy → opis.** Bramka: `NO_METRIC_ANCHOR+NO_ROOF_BUILT` → opis
   (`req_011Ch6BgmewQ3V9We9vuipo4`): 15,24 × 5,64 m z `1524` / `564`, dach dwuspadowy wzdłuż frontu → model 15,25 ×
   5,65, rodzaj dachu i kalenica zgodne z referencją (LOCAL: brak dachu), scena `6cedf6d2…`.

Odrzucone obserwacje z powodem: Torenie — głębokość opisu (11,6) odrzucona przez ściany LOCAL; Nigelle, Nolany,
Piwonie — `DRAWINGS_KEPT` (druk nie przekracza obrysu); architecturaldesigns-com-2 — `BODIES_COINCIDE` (garaż w
całości w bryle głównej) → odmowa opisu.

## 7. Kontrpróby (brief §8)

| kontrpróba | wynik |
|---|---|
| poprawna wskazówka zmienia właściwy element | ✓ Torenie: tylko oś frontu z opisu, oś głębi ze ścian (test `perAxisFromWalls` + przebieg) |
| fałszywe przeszklenie nie zamyka otwartej loggii | NIE TESTOWANE — żaden mechanizm nie przenosi przeszkleń z AI do LOCAL |
| błędna jednostka/liczba nie zmienia mocnej skali | ✓ częściowo: druk krótszy niż obrys nie jest dowodem; nieparowalne osie nic nie zmieniają; skalowany/opublikowany rozmiar nie jest dowodem (testy) |
| podpowiedź innego wariantu/kondygnacji odrzucona | NIE TESTOWANE |
| transformacja kadru z lustrem i obrotem trafia we właściwą stronę | ✓ 34/34 (`crops-selfcheck.ts`: 4 obroty × lustro, przypadki ręczne, skala ×2, mapowanie odpowiedzi) |
| brak dowodu → UNKNOWN/pytanie, nie wymyślony wymiar | ✓ częściowo: kolor niepodany = niepodany (domyślny emitera, nazwany), referencja bez wymiaru = NOT_COMPARABLE |
| poprawny model nie jest pogarszany, bo AI przyszło później | ✓ `readEveryModel`: Nigelle/Nolany/Piwonie zachowane; test „kept: byte for byte”. ✗ bramka v3.53 dla modeli bez kotwicy (Kukliki) |
| identyczna zapisana odpowiedź → powtarzalny wynik | ✓ samotest: odtworzenie = hashe modelu i sceny z przebiegu live; H0/H1/P1 z zapisanych odpowiedzi |

Bramka (§8): fałszywy negatyw v3.53 — Torenie (zły kompletny model, AI nie pytane) — usunięty przez `readEveryModel`.
Koszt: czytanie każdego modelu = +1 odczyt (≈ 0,06 USD) na każde zadanie pilota; na S30 zmieniło decyzję w 1 z 4
kompletnych modeli. „ARCHON lokalnie, reszta AI” nie jest zakodowane: decyduje druk wobec ścian.

## 8. Zmiany w kodzie (commity na gałęzi)

- `65b3f86` Master Plan v3.54.1 pod kanonicznym adresem `docs/MASTER_PLAN.md`.
- `133df81` czytnik: requestId, stop reason, cache, surowa odpowiedź; odmowa NO_ANSWER z usage; księga rozlicza ją.
- `362dfab` czytnik 0.3.0 — opis przez jedno nie-strict narzędzie odpowiedzi zamiast strict format.
- `d62a0a9` przyjmowanie opisu 0.2.1 + fikstury Android (skrypt przechwytujący).
- `bfc5910` H1: piętro-do-piętra, builder 0.8.0 `perAxisFromWalls`, `descriptionExceedsDrawings`, `readEveryModel`.
- `c8067b6` okablowanie hosta: `ANALYZER_HOUSE_READER_EVERY_MODEL=on` → `readEveryModel` (tylko z włączonym czytnikiem).
- `6a35b3d`, `f556354` protokół zapieczętowany i aneks 2 (zamrożenie); `32f5768` referencje FINAL.
- research `research/source-to-model/v3541/`: runner live + rejestrator + księga, samotest (15/15), C (kadry), H0/H1,
  miara obrysu, restore źródeł (1402/1411 obrazów bajt w bajt), listy, plansze (skrypt).
Mapa wejść/wyjść/konsumentów AI: `stage-reports/artifacts/v3541/AI_MAP.md`.

## 9. Weryfikacja

- `tsc -p tsconfig.json`: 0 błędów (na kandydacie i końcowo).
- vitest `packages/analysis-service`, `packages/reconstruction`, `packages/source-vision`, `apps/analyzer-api`:
  wszystkie zielone (m.in. 2 025/2 026 przed regeneracją fikstur Android → zielone po niej; 22 testy hosta).
- `tests/architecture`: **11 czerwonych — te same 11 na `cd173a7` (przed v3.54.1)**: bazy 005Q nieobecne w płytkim
  klonie, izolacja badań IU-01/02/03A, 005M, 005N §30, reference 4/7. Nie spowodowane tym etapem; nie naprawiane.
- Pełna macierz testów nie była uruchamiana jednym poleceniem na końcowym drzewie; uruchomiono pakiety dotknięte zmianą.
- Determinizm LOCAL: przebiegi z dziś odtwarzają hashe modeli A z v3.54 (Torenie, lipinscy-pl-2).
- Android: NOT_VERIFIED. APK: nie budowano (zmiana jest po stronie hosta; aplikacja bez zmian, APK 1339 aktualny).

## 10. Paczka prywatna

`/home/user/BuildPlan-V3541-Private.zip` (poza Git): 18 953 520 B, sha256
`01fa394556e16e1350ce81354003e662ad4cd37a1320f2e51d3e395578979a97`, 1082 pliki (1289 wpisów z katalogami), `INDEX.md` i `MANIFEST.sha256`
(sprawdzony po rozpakowaniu). Zawiera 18 plansz ŹRÓDŁO | A | B | H1 (12 FINAL + 6 S30), referencje, protokół, wyniki,
nagrane odpowiedzi i surowe ślady, księgę. Bez klucza (sprawdzone dosłownie). Kopie przesłanych obrazów pominięte (restore.py
odtwarza bajty).

## 11. Bezpieczeństwo klucza

Klucz OWNER-a trafił do rozmowy (decyzja OWNER-a: „może być użyty tak”). Zapisany jeden raz do pliku poza repozytorium
(`/root/.config/buildplan/campaign-key`, uprawnienia 600), czytany przez polecenia ze zmiennej środowiskowej; nie
występuje w Git, księdze, surowych odpowiedziach, plikach wyników ani ZIP (sprawdzone wyszukiwaniem dosłownym przed
każdym commitem). Ponieważ jest w transkrypcie rozmowy, **zalecam go unieważnić po kampanii**.

## 12. Następny krok (jeden)

Uzgodnić bryły opisu z jego własnym drukowanym wymiarem i nie oddawać opisowi modelu LOCAL bez kotwicy, którego
zasięg zgadza się z drukiem odczytanym przez czytnik (Kukliki, plan5-737; na S30 lipinscy-pl-1) — zmierzyć na S30 +
FINAL jako DEV, nowa odłożona próba do odbioru.
