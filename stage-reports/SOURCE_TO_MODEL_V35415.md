# v3.54.15 — kontrakt odpowiedzi, niepewność i wykorzystanie danych API

Baza: kod/APK `228f693` (APK 1345), host `1708569`. Gałąź `claude/new-session-3kzcgh`, commity `[skip ci]`, bez
merge/PR. Master Plan v3.54.15 w `docs/MASTER_PLAN.md` (katalog produktu §3 bajtowo bez zmian). Pliki źródłowe,
rysunki wydawców, modele i nagrania: poza Gitem, w prywatnym ZIP-ie.

## 0. Najważniejsze

- **Informacja dochodzi do geometrii ogólnie, nie dla Balliny.** Rzędne z przekroju odczytane przez API przechodzą
  tę samą bramkę rysunku co LOCAL (symbol, drabina, wydrukowane ±0,00), wypierają błędne rzędne szablonu i trafiają
  do modelu: Ballina dostała dach (kalenica 5,54, okap 3,373, nachylenie wynikowe ≈ 28° = 28° ze strony, które nie
  było wejściem), a **świeża kontrola Murcja** (pierwszy wynik na zamrożonym kodzie) — kondygnacje 2,80 / 4,30 m
  zamiast 12,72 m z samego LOCAL-a, kalenica 7,10 zamiast 17,10.
- **Kontrakt odpowiedzi**: jedna wersjonowana umowa na klasę obserwacji; strict tools; `stop_reason`, ucięcie, odmowa,
  brak wywołania narzędzia i nieznane pola nazwane; adapter NORMALIZED tylko dla jednoznacznych krotek; los każdego
  elementu (ACCEPTED / NORMALIZED / REFUSED + powód), surowa odpowiedź obok kanonicznej, stabilne id. Parser 4 sprawdza
  typy pól obiektu jak krotki; stopy i cale (`45'-6"`) czytane z ich własnych znaków (kontrakt wymiarów 1.2.0).
- **Niepewność per właściwość**: kalenica i okap tylko z roli (sufit nigdy nie jest okapem, najwyższa rzędna nie jest
  kalenicą, dwie różne wartości jednej roli to spór → brak), kąt tylko świadkiem nachylenia (nigdy wysokości),
  iloczyn obrysu tylko dla dwóch wymiarów całości (nie korpusu), szkic: registration / vertical / form / finish osobno,
  przesunięty otwór przy tej samej liczbie odrzuca formę, nie wykończenie.
- **LOCAL i odwrócone cyfry** (`0051/1500`, `518/815`): solver 1.9.0 wybiera orientację długiego pionowego wymiaru
  ze stosunku do skali drugiej osi (5 % / 15 % / 3×), a API dostaje tylko odczyty LOCAL-a w orientacji, którą LOCAL
  sam przyjął (przy nierozstrzygniętej — oba odczyty). Bakopy: 8 „korekt” odczytów, których LOCAL nigdy nie twierdził
  (`080`, `088`, `014`, `0051`…), zniknęło; AGREES 5 → 18–20, model bez zmian.
- **Ślad faktu**: literal → wartość → świadkowie → parametr przed/po → id elementów → domknięcie (CHANGED /
  CONFIRMED / NOT_CONSUMED / REFUSED / NO_EFFECT); NOT_CONSUMED liczony osobno, nie jako domknięcie.
- **Cache promptu zmierzony**: prefiks 1793 tokenów (strict); cztery szkice Balliny bez cache 0,043506 USD, z jednym
  punktem 5 min (1725 zapisane raz, 3 × odczyt) 0,035048 USD (−19,4 %). Na hoście cache działa także dla metryki.
- **Szkice**: cztery osobne obrazy każdego z sześciu ocenianych domów (24 strony), PNG + SVG + JSON kanoniczny, raw/,
  normalized/, rejected/ z kodami, galeria offline, plansze źródło | szkic | L0 | L-M | L-MS | oddany + perspektywy i
  kondygnacje bez dachu.
- **Po zamrożeniu (jawnie)**: cztery poprawki po pierwszym wyniku kontroli (pierwszy wynik Murcji niezmieniony, bajtowo
  ten sam model na kodzie końcowym): drzwi Balliny nie stają się oknem przez parapet odczytany w granicy błędu gruntu
  widoku; strict grammar, którego dostawca nie skompiluje, wraca bez strict — i zostaje tak dla rozmowy (bloki
  myślenia); odczyt metryki na hoście bez strict (zmierzone: strict gubi krańce linii wymiarowych).
- **Host na końcowym kodzie**: nowy realny bieg Balliny ACCEPT, drugi bieg tego samego URL 0 USD / 0 żądań z tymi samymi
  bajtami, bieg bez tokenu 0 żądań. APK 1346 z `5d4321c`.

## 1. Inwentarz informacji (§3)

Pełna macierz: `research/source-to-model/v35415/INVENTORY.md` — klasa → źródło → czytnik → kontrakt surowy → kanon →
resolver → pole modelu → konsument → scena → pomiar, ze stratą na v3.54.14 i stanem po v3.54.15. Straty usunięte:
WRONG_FORMAT (krotki Balliny, stopy-cale Coastal), NO_CONSUMER (rzędne Balliny i Murcji), MISINTERPRETED (odczyty
LOCAL-a w odrzuconej orientacji pokazywane jako jego twierdzenia; dach jako strefa ściany), REJECTED (widoki tracone po
przyjęciu rzędnej), ACCEPTED_WITHOUT_EFFECT (szkice przyjmowane bez patrzenia na położenie otworów). Straty nazwane i
zostawione: CEILING bez pola modelu, teren tylko w rejestracji, elementy szkicu (balkon, komin, balustrada) bez
konsumenta geometrii, tylna elewacja Balliny tylko dla położeń.

## 2. Kontrakt odpowiedzi (§4)

| klasa | kontrakt | parser / prompt | testy |
|---|---|---|---|
| wymiar (LENGTH/LEVEL/ANGLE/AREA) | `buildapp.dimension-observation` 1.2.0 (rola, `roleFrom`, `ft-in`) | `metric-read/3`, `metric-verify/2`, resolver 1.2.0 | `metric-read-v35414.test.ts`, `counter-trials-v35415.test.ts`, `local-table-v35415.test.ts` |
| szkic elewacji | 1.1.0, konto odpowiedzi (`account`) | parser 4 | `sketch-contract-v35415.test.ts`, `elevation-sketch-v35414.test.ts`, `counter-trials-v35415.test.ts` |
| koperta odpowiedzi | `response` COMPLETE / TRUNCATED / REFUSED / NO_TOOL_CALL | — | jw. |
| transport | strict tools (`additionalProperties:false`, ograniczenia lokalnie), `tool_choice: auto` (wymuszone zwraca 400 na Opus/Sonnet 5.5), fallback przy „compiled grammar is too large” | — | `transport-cache-v35415.test.ts` |

Każdy element odpowiedzi ma los; NORMALIZED tylko dla krotki, której pozycje przechodzą typy w kolejności `required`
schematu (z opcjonalnym ogonem); strefa ściany identyczna z połacią (IoU > 0,9) jest odrzucana jako dach i nie liczy
się jako utrata formy. Odpowiedzi nagrane wcześniej parsują się parserem 4 bez zmian (`replay-sketch-account.ts`).

## 3. Niepewność i świadkowie (§5)

- Rzędne API: przyjęte tylko przez drabinę rysunku, z wydrukowanym zerem; wypierają nie-walidowane rzędne szablonu
  (Ballina: +15.50 → +5,54); nie nadpisują rzędnych zwalidowanych przez rozpoznawacz. Każda odrzucona ma powód
  (Ballina +2,80: NO_SYMBOL; Murcja +2,72 i +5,65: NO_SYMBOL).
- Rola: `ridgeAndEaves()` — kalenica i okap wyłącznie z roli; spór → brak. Kąt: świadek nachylenia, które dach już
  ma ze swojego autorytetu (druk/strona) — `ANGLE:CONFIRMED`, nigdy wysokość.
- FOOTPRINT tylko dla dwóch WHOLE_HOUSE w jednej skali rysunku; BODY nie jest świadkiem (kontrpróba).
- Szkic bez kalenicy: wykończenie z własnej linii gruntu szkicu (PARTIAL), forma nigdy.
- „LOCAL musi wiedzieć” usunięte: szkic używa rzędnych, które przebieg ma jako LEVEL_DATUM — z LOCAL-a albo z API
  przyjętego przez przekrój.
- Orientacja etykiet LOCAL: ogólna reguła stosunku (bez odwracania cyfr na sztywno); przy braku rozstrzygnięcia API
  widzi oba odczyty. Ballina, druga rendacja rzutu: `815` 10,6 % od skali, `518` 43 % — próg 5 % zostawia
  nierozstrzygnięte (nie stroiłem progu pod dom); API dostaje „518 (odwrotnie: 815)”.

## 4. Konsumenci i ślad (§6)

`research/source-to-model/v35415/fact-trace.ts`, wyniki `results/case-*.json`, `results/control-murcja-first.json`.

| dom | LEVEL | ANGLE | LENGTH | SPAN | szkic: wykończenie | szkic: forma |
|---|---|---|---|---|---|---|
| Ballina (L-MS) | 2 CHANGED (±0,00 → poziom, +5,54 → kalenica), 1 NOT_CONSUMED (−0,30 teren), 1 REFUSED (+2,80) | — | 1 CHANGED (815) | 2 REFUSED | 3 CHANGED, 1 NOT_CONSUMED (REAR tylko położenia) | REFUSED (szkic kosztowałby otwór) |
| Bakopy (L-MS live) | 4 CONFIRMED (LOCAL ma te same) | 1 CONFIRMED | 14 NO_EFFECT (skala STRONG trzyma) | 3 REFUSED | 3 CHANGED, 1 REFUSED (FRONT) | NOT_RUN (otwory 0,16–0,57 m obok) |
| Murcja (kontrola) | 1 CHANGED (+7,10: 17,10 → 7,10), 1 CONFIRMED, 2 NOT_CONSUMED (−0,45 teren, +3,05), 2 REFUSED | — | — | — | 3 CHANGED | CONFIRMED |

## 5. Rejestracja widoków (regresja znaleziona w tym etapie)

Po przyjęciu kalenicy Ballina straciła trzy z czterech elewacji: etykiety SIDE_LEFT/SIDE_RIGHT nie wiązały strony,
pełne boki mierzone na prawdziwej wysokości trafiały na złą oś, a miniatura 120 px zajmowała bok; tył odrzucony przez
kalenicę przepadał. Ogólnie: etykieta wydawcy wiąże stronę (jak „frontowa”), większy rysunek przed miniaturą, a widok,
którego kalenica nie zawiesi, wraca do rejestracji na końcach pasa ściany (tylko położenia) — dodanie rzędnej nie może
kosztować widoku. Ballina: 4 z 4 (FRONT na sylwecie, boki na pasie z wysokościami, tył położenia); Bakopy bajtowo bez
zmian; Marcówki bajtowo jak na `228f693`.

## 6. Szkice (§7)

Styl: płaskie kolory, ciemny kontur, bez otoczenia (`style-owner/`) — zgodny co do zasady; cieńsza kreska i brak
szprosów/ram okien w porównaniu z rysunkami OWNER-a. Doręczenie: `sketches/<dom>/{FRONT,RIGHT,REAR,LEFT}.{png,svg,json}`,
`raw/`, `normalized/`, `rejected/<strona>.json` (kody: UNKNOWN_FORM, WRONG_FIELD_TYPE, ROOF_POLYGON_AS_WALL, …),
`MISSING_SOURCE.json` gdzie brak, `gallery.html` (offline), plansze.

| dom | FRONT | RIGHT | REAR | LEFT |
|---|---|---|---|---|
| Ballina | ACCEPTED | PARTIAL | ACCEPTED | ACCEPTED |
| Bakopy | REJECTED | PARTIAL | PARTIAL | PARTIAL |
| Murcja | PARTIAL | ACCEPTED | PARTIAL | UNCHECKED (bok niezarejestrowany) |
| Coastal | UNCHECKED | UNCHECKED | UNCHECKED | UNCHECKED |
| Kardamon | UNCHECKED | UNCHECKED | UNCHECKED | UNCHECKED (boki bez nazwy strony) |
| Marcówki | UNCHECKED | UNCHECKED | UNCHECKED | UNCHECKED |

UNCHECKED = odczytany bezpośrednio z oznaczonej elewacji, bez modelu, z którym da się sprawdzić proporcje; nic z niego
nie zasila modelu.

## 7. Przegląd z naprawą (§8)

Forma ze szkiców przyjmowana tylko, gdy zmienia model na lepszy; Ballina: szkic formy wycofany (ROLLBACK — kosztowałby
otwór `opening-0-front-0-3`), wykończenie zostaje. Hash modelu bez poprawy = NO_IMPROVEMENT/ROLLBACK, nie sukces.

## 8. Ogólność (§9)

Przypadki wybrane przed wynikami (`CASES.md`, `CONTROL_SELECTION.md`): Ballina (regresja formatu i LEVEL/ANGLE),
Bakopy (metryka, skrzydła, szkice), Marcówki (otwory skośne, zasłonięcie, wykończenia), dwa nagrane domy według
pokrycia luk (Coastal — stopy-cale, wieża, 8 elewacji; Kardamon — drugi polski wydawca), świeża kontrola Murcja
(zamrożenie `4dd06ae`, pierwszy otwarty kandydat).

Stałe wiersze (karty z v3.54.14, przed wynikami), pass / partial / fail (MANUAL osobno):

| dom | v3.54.14 | L0 | L-M | L-MS = oddany |
|---|---|---|---|---|
| Ballina (19) | 7 / 1 / 3 (8 M) | odmowa (brak modelu) | 8 / 2 / 1 | **9 / 1 / 1** (8 M) |
| Bakopy (19) | 12 / 6 / 1 (raport v3.54.14) | 12 / 4 / 3 | 12 / 4 / 3 | 12 / 5 / 2 |

Bakopy L-MS traci komin (v3.54.14: z formy szkicu; v3.54.15: forma odrzucona, bo otwory szkicu leżą 0,16–0,57 m obok
modelu) — koszt ostrzejszej, poprawnej reguły; komin ze szkicu nie ma osobnego konsumenta (luka nazwana). Okap Bakopów
2,896 → 3,238 (druk +3,27) — zmiana z warstwy rzędnych tej wersji, nie z rejestracji (sprawdzone ablacją).

Coastal i Kardamon: LOCAL nie zbudował modelu (brak linii wymiarowych: tylko etykiety rozmiarów pokoi albo powierzchnie);
API przeczytało 34 wymiary w stopach-calach (po poprawce 34/34 z wartością, decyzje UNRESOLVED: brak łańcucha i skali) i
12 powierzchni. Wynik: brak modelu, nazwany — nie kalibruję rzutu powierzchniami pokoi.

Kontrpróby (testy): obiekt / krotka / nieznany; kolejność; ucięcie, odmowa, brak wywołania; brak i zły host; osie i
jednostki (stopy-cale, cm jako ft-in); sufit vs okap; korpus vs całość; spór świadków; najwyższa rzędna to nie kalenica;
przesunięty otwór przy tej samej liczbie; inna paleta bez zmiany formy; API przy braku LOCAL (Ballina, Murcja L0 —
przypadki).

## 9. Cache i księga (§10)

`results/cache-trial-ballina.json`: prefiks (licznik, bez opłat) 1793 / 1918 tokenów; zimny zapis 1725 (5 min), trzy
odczyty po 1725; koszt 0,043506 → 0,035048 USD (−19,4 %); średnia latencja 4786 → 4195 ms przy czterech żądaniach (nie
jest to pomiar efektu latencji). Pierwsza próba bez cache wynikała z kolizji flag (`--cache` = katalog bajtów) —
zachowana jako kontrola; flaga to teraz `--prompt-cache`, zła wartość zatrzymuje bieg. Replay i ponowne użycie
zaakceptowanej rewizji: NOT_SENT, 0 USD, nigdy „trafienie cache”.

## 10. Budżet (§11)

Otwarcie 24,919958 USD; wspólny sufit 28,854612; pula 3,934654 (bez nowych 5 USD, saldo panelu nieruszane).
Wydane w etapie **1,891759 USD** (księga `research/ai-assist/spend-ledger-v35415.json`, 72 żądania rozliczone; replaye
NOT_SENT 0 USD): metryka + szkice Bakopy 0,352, Coastal 0,164, Kardamon 0,066, kontrola Murcja 0,135, próby cache
Balliny 0,079, szkice bez rejestracji (Coastal, Kardamon, Murcja LEFT, Marcówki) 0,150, diagnoza hosta (pętla na żywo,
dwa świeże odczyty metryki Balliny) 0,176, trzy przebiegi hosta 0,348 + 0,197 + 0,225 = 0,770. Saldo księgi 26,811717 USD; pozostało
2,042895 USD.

## 11. Host, testy, APK

**Host E2E na końcowym kodzie `5d4321c`** (Ballina, świeży katalog danych): nowy realny bieg COMPLETED (metryka ACCEPT,
szkice FRONT/WEST/REAR ACCEPTED, EAST PARTIAL, rewizja ACCEPTED_NOW, 0,224883 USD, 10 żądań, cache trafia między
turami); drugi bieg tego samego URL — REUSED, 10 odpowiedzi odtworzonych, 0 USD, 0 żądań, te same bajty modelu i sceny;
bieg bez tokenu — 0 żądań (odmowa LOCAL-a, jak oczekiwano). ALL CHECKS PASSED.

Unieważnienie wiązania: pierwsza próba (`5de1572`, kopia danych hosta v3.54.14) na Bakopach **nie** użyła rewizji
v3.54.14 (wersje promptów/resolvera/parsera w wiązaniu) — nowy realny bieg.

**Znalezione przez hosta (po zamrożeniu, jawnie):**
1. Strict grammar pętli konsultanta (schemat recenzji + narzędzie regionu) „too large” → odmowa 400 bez opłaty; teraz
   jedno ponowienie bez strict, a odmowa przykleja się do zestawu narzędzi na transporcie — inaczej druga tura z
   powrotem strict unieważnia bloki myślenia pierwszej („bound to a different conversation”, preserved thinking).
2. Strict na odczycie metryki: krańce linii wymiarowych przychodziły jako `null` (host i świeży odczyt badawczy) →
   brak świadka FOOTPRINT → Ballina bez modelu; ten sam świeży odczyt bez strict dał krańce i model (ACCEPT). Host
   trzyma metrykę bez strict (`ANALYZER_STRICT_METRIC=on` włącza); strict zostaje na szkicach i pętli. Zmierzone n=1+1 —
   wniosek ostrożny.
3. Wszystkie wcześniejsze wyniki Balliny w tym etapie były replayem odpowiedzi nagranych w v3.54.14; świeży odczyt
   pod `metric-read/3` bez strict odtworzył ten sam model (13,65 × 8,15, kalenica 5,54).

**Testy.** Pełna macierz na końcowym kodzie: 4352 zaliczone, 16 niezaliczonych = 15 ze zbioru bazowego + jedna
odziedziczona po `228f693`: `presentation.test.ts` „donor coordinate 1.05” w `RoofCover.kt`, wprowadzonym w ostatnim
commicie v3.54.14 po jego macierzy; nietknięte). Pakiety zmienione: reconstruction 146/1652, analysis-service 44/538,
source-metrics 23/23 w `metric-solution`, mobile-scene 12/107; Android `testDebugUnitTest` 482 przypadki, 0 błędów;
kontrakt Androida ponownie przechwycony (boki Larchfield POSITIONS_ONLY, hashe modelu i sceny bez zmian).

**APK 1346** z `5d4321c`: `BuildPlan-Model-Preview-universal-debug.apk`, SHA-256
`a766f397f57b6036c51e0145f5dc033dd903d09fffb695730e0c46375ca0ee26`, versionCode 1346; sceny w APK bajtowo równe
repozytorium; na górze indeksu `ballina-v35415` (ODDANY: dach z rzędnych, drzwi z rzutu) i `murcja-v35415` (KONTROLA).

## 12. Luki

- CEILING (sufit) bez pola modelu; teren tylko w rejestracji.
- Elementy szkicu (balkon, komin, balustrada) bez konsumenta geometrii — komin Bakopów ginie razem z formą szkicu.
- Ballina: okno w lewej ścianie (`left-openings` FAIL), tył tylko położenia (sylweta śledzona do wiersza 194 z 400).
- Murcja: lewa elewacja niezarejestrowana; poddasze na konwencji 2,80 (wydrukowane +2,72 odrzucone NO_SYMBOL).
- Coastal/Kardamon: brak modelu (źródło bez linii wymiarowych) — pytanie do użytkownika, nie zgadywanie.
- Szkice: cieńsza kreska i brak szprosów względem stylu OWNER-a.
