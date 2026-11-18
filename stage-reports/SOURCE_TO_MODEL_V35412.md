# v3.54.12 — kolorowy szkic jako wejście LOCAL i rozpoznawalna miniatura

> **Stan:** rozdziały 0–7 to historia etapu przygotowanego (`41eb90a`, BLOCKED_INPUTS — obrazów nie było w sesji);
> zostają bez zmian poza korektą liczby cech krytycznych. **Wyniki na rzeczywistych szkicach OWNER-a są w dopisku
> REAL_OWNER_INPUTS (rozdz. 8–15).** Bieg na rysunkach syntetycznych z rozdz. 5 był tylko sprawdzeniem plumbingu,
> nie wynikiem.

Gałąź `claude/new-session-3kzcgh`. Baza: `8119d85` (v3.54.11, APK 1342), HEAD zgodny z originem przed etapem.
Koszt etapu: **0 USD** (bez żądań API). Kod produkcyjny bez zmian: ten etap dodaje wyłącznie narzędzia badawcze,
kartę tożsamości, protokół i dokumenty.

## 0. Najważniejsze: brakujące wejścia (BLOCKED_INPUTS — historia `41eb90a`)

Do sesji trafił **tylko plik promptu**. Czterech obrazów z §2 nie ma ani w katalogu załączników, ani nigdzie na dysku
(szukane po nazwach):

| oczekiwany plik | rola | stan |
|---|---|---|
| `1000090696.jpg` | oryginał (para nieustalona) | **BRAK** |
| `1000090699.jpg` | oryginał (para nieustalona) | **BRAK** |
| `Uproszczona elewacja domu z garażem.png` | kolorowy szkic frontu z garażem | **BRAK** |
| `Kolorowa tylna elewacja domu z balkonem.png` | kolorowy szkic tyłu z balkonem | **BRAK** |

Zgodnie z §2 żadnego nie zastąpiono innym obrazem pod tą nazwą, szkicu nie wygenerowano i nie pobrano niczego w jego
miejsce. Wszystko, co od nich nie zależy, jest zrobione, a eksperyment B uruchamia jedno polecenie (rozdz. 5), gdy
pliki się pojawią. Master Plan v3.54.12 również nie był dołączony: `docs/MASTER_PLAN.md` zostaje v3.54.11 (katalog §3
nietknięty), decyzja OWNER-a z §0 jest zapisana w ADR i statusie.

## 1. Osiem odpowiedzi

**1. Co OWNER dopuszcza jako uproszczenie, a co zniszczyłoby tożsamość tego domu?** Dopuszczalne (§0): drobne
odsunięcia, podziały i detale — np. lewa krawędź bramy garażowej bliżej pionowej krawędzi ściany, przybliżone słupki,
deski, cienie. Tożsamość niosą: bryła główna ze szczytem i niższe skrzydło garażu **po prawej stronie frontu**, dach
dwuspadowy ok. 40° z kalenicą prostopadłą do frontu, biała rama szczytowa z przodu i z tyłu (ok. 1 m przed cofniętym
szczytem), loggie we wnękach ze szklaną balustradą, duże skośne przeszklenia szczytów (jedno z przodu, wysoki koniec
z lewej; dwa z tyłu), duże przeszklenie tarasowe, szeroka brama, ciemny pas nad wejściem i garażem oraz układ jasnej
ramy, ciemnego parteru i ciepłego drewna. Krytyczne (dom przestaje być tym domem): brak lub odbicie skrzydła garażu,
inny dach albo kalenica równoległa do frontu, zanik ramy, nowe duże otwory bez źródła. Zapisane jako karta
`research/source-to-model/v35412/identity-marcowki.json` (14 cech, 6 krytycznych — korekta v3.54.12-REAL: wcześniej błędnie podano 5; karta bez zmian) **przed** jakąkolwiek oceną;
tolerancje są propozycją wykonawcy, dobraną do wielkości elementu, nie wymaganiem OWNER-a.

**2. Co szkice zmieniły względem oryginałów i czy to przeszkodziło miniaturze?** **Niezmierzone — brak plików.**
Przygotowane narzędzia: `match-picture.py` paruje obraz z elewacją pakietu po zawartości (miniatury w odcieniach
szarości, obcięte paski zrzutu, ostrzeżenie o odbiciu; mały margines = AMBIGUOUS, bez rozstrzygania), a
`register-sketch.py` rejestruje szkic na punktach budynku (podobieństwo i afiniczne, reszty na punkt w px i m, werdykt
CROP_AND_SCALE / PROPORTIONS_CHANGED / MIRRORED; punkty CHECK, np. lewa krawędź bramy, mierzą to, co szkic zmienił,
a nie błąd dopasowania; nakładka bez lokalnej deformacji).

**3. Czy LOCAL dostał szkice?** **Nie** — nie ma czego podać. Gotowe: `sketch-package.ts` (pakiet, w którym tylko
wskazane elewacje FRONT/REAR mają bajty szkicu, każdy wariant z własnym hashem, URL-em i cache; bieg nazwany MIXED, bo
2 z 4 elewacji) i `run-sketch.sh` (B, B1 — tylko front, B2 — tylko tył; przypięte A = przebieg v3.54.11 `0476d353…`;
po biegach ta sama miarka: miniatura i, osobno, diagnostyka metryczna). Plumbing sprawdzony na jawnie syntetycznych
rysunkach (rozdz. 5) — to nie są wyniki eksperymentu.

**4. Co już było w danych, a nie docierało do modelu?** Nowe ustalenie na scenach APK 1342: w obu H (v3.54.10
i v3.54.11) między wnęką wejścia a bramą garażu widać **jasny pionowy pas 0,40 m** (x 7,51–7,91) tam, gdzie źródło
jest ciemne. To czoło ściany `w-main-1` (ściana wschodnia bryły głównej trzyma narożnik, a jej czoło stoi w płaszczyźnie
ściany frontu). Strefa ciemnego tynku obejmuje ten odcinek w danych, ale region wykończenia (`SurfaceRegion`) może
leżeć tylko na licu OUTER/INNER ściany, nie na jej czole — więc nie dociera. LOCAL ma tam ciemny tynk (jego ściana
frontu dochodzi do narożnika). Dowód: `results/probe-pillar-apk1342.txt` (H 1/3, LOCAL 3/3). Naprawa wymaga albo zmiany
własności narożnika w budowniczym H, albo czoła ściany jako hosta wykończenia — to zmiana reprezentacji/geometrii
o skutku dla wszystkich domów, więc w tym etapie tylko nazwana. Wcześniejsze granice v3.54.11 bez zmian: wykończenie
spodu pasa (jeden materiał na człon), ostatnie 0,75 m pasa nad powrotem garażu, ramy H przeczytane grubiej.

**5. Czy miniatura zachowuje bryły, otwory, balkon, ramę i paletę; jak oddzielono to od obmiaru?** Linia bazowa
(`results/miniature-baseline.txt`, karta 14 cech):

| model | werdykt | zachowane / przybliżone / brak / sprzeczne | uwagi |
|---|---|---|---|
| LOCAL A (v3.54.11, oryginały) | RECOGNISABLE | 14 / 0 / 0 / 0 | |
| LOCAL oddany (APK sc. 3) | RECOGNISABLE | 14 / 0 / 0 / 0 | |
| H po naprawie v3.54.11 (APK sc. 1) | RECOGNISABLE | 14 / 0 / 0 / 0 | jasny pas 0,40 m (odp. 4) nie jest cechą karty |
| H v3.54.10 (APK sc. 2) | RECOGNISABLE | 13 / 0 / 1 / 0 | brak: ciemny pas nad wejściem i garażem |
| kontrola: LOCAL B-auto (białe tło, v3.54.11) | **NOT_RECOGNISABLE** | 9 / 2 / 3 / 0 | krytyczne: obie ramy; brak tylnej loggii |
| kontrola: LOCAL B-auto (tło w kolorze nieba) | RECOGNISABLE | 13 / 0 / 1 / 0 | brak przedniej loggii |

Ocena wizualna jest osobnym plikiem i osobnym werdyktem; nie zmienia ani nie czyta wyników metrycznych. Te zostają
diagnostyką (16 cech v1/v1.1, 27 wierszy, 14 punktów stref) i nie są warunkiem użytecznej miniatury. Self-test scorera:
odbicie skrzydła → CONTRADICTORY; brak ramy nie zmniejsza mianownika; dopuszczone przesunięcie bramy zostaje
RECOGNISABLE; nowy duży otwór → CONTRADICTORY; kalenica równoległa do frontu → CONTRADICTORY.

**6. Czy wynik z zapisanych danych jest powtarzalny i czy reuse oddaje tę samą rewizję?** Dla A tak: LOCAL jest
deterministyczny (v3.54.11: Pallas i Oslo bajt w bajt przy niezmienionym wejściu; odtworzenia nagrań H — 13 domów bajt
w bajt). Pakiet B ma własny hash treści, więc nigdy nie dostanie odczytu A z cache, a zmiana wejścia jest jawną nową
rewizją. Powtarzalności B nie dało się sprawdzić (brak wejść).

**7. Co można obejrzeć teraz, co jest ręczną diagnostyką, czego nie zmierzono?** Obejrzeć: APK 1342 (bez zmian; nowe
APK nie powstało, bo nie ma nowej sceny) i plansze v3.54.11. Ręczna diagnostyka: brak w tym etapie (próba
z prawidłowym konturem na granicy modułu jest przewidziana dopiero po wyniku B). Niezmierzone: wszystko, co dotyczy
szkiców (zmiany względem oryginałów, B/B1/B2, kontrpróby paletą i bez ramy), drugi przypadek innego wydawcy z
diagnostyką konturu.

**8. Czy warto automatyzować szkice?** Nie da się tego uczciwie ocenić bez wyniku B; cen nie podaję (§10 każe sprawdzić
je w oficjalnym źródle i tylko przy użytecznym wyniku). Rozróżnienie zostaje: edycja rastra wymaga osobnego narzędzia
obrazowego; odczyt konturów/klas do ograniczonego JSON/SVG z lokalnym renderowaniem to inna metoda z innymi błędami.

## 2. Sprostowanie zakresu v3.54.11 (wyniki zachowane)

v3.54.11 badał zamianę tła na płaski kolor i ręczną maskę obrysu. Nie badał kolorowego przerysowania całej elewacji
(bez odbić, cieni i faktur także wewnątrz budynku) ani osobnych kanałów semantycznych. Zdanie „maska ręczna = oryginały”
dotyczy tylko maski; o szkicu nic nie mówi. Zapisane w `SKETCH_PROTOCOL.md`; wyniki v3.54.11 bez zmian.

## 3. Karta tożsamości i tolerancje

`identity-marcowki.json`: każda cecha w ramie swojej strony (along od lewego końca widzianego z zewnątrz, y nad ±0),
z odwołaniem do zapieczętowanej prawdy źródła. Stany: PRESERVED (w tolerancji), APPROXIMATE (do 2× tolerancji),
MISSING (brak albo dalej), CONTRADICTORY (zła strona, rodzaj, kierunek). Dach czytany z rekordów modelu (`roofs`:
rodzaj i oś kalenicy; `roofPlanes`: kierunek spadku), nie z sondy pasa.

## 4. Protokół B (zapisany przed wynikami)

`research/source-to-model/v35412/SKETCH_PROTOCOL.md`: wejścia, parowanie po zawartości, rejestracja i punkty CHECK;
warianty A / B / B1 / B2 (opcjonalnie B-reg: szkic przeniesiony do ramy oryginału samym podobieństwem); dwie miary
osobno; ścieżka przy gorszym B (pierwsza błędna decyzja LOCAL, jedna ograniczona diagnostyka z prawidłowym konturem,
adapter za flagą tylko przy potwierdzonej barierze); kontrpróby: inna paleta i szkic bez ramy (kolor nie może tworzyć
architektury); słupki okien muszą przetrwać obsługę konturów.

## 5. Jak uruchomić, gdy pliki będą

```
research/source-to-model/v35412/match-picture.py   <pakiet> <cache> 1000090696.jpg 1000090699.jpg "<szkic frontu>" "<szkic tyłu>"
research/source-to-model/v35412/register-sketch.py <punkty.json> <katalog> --warp      (dla każdej pary)
research/source-to-model/v35412/run-sketch.sh "<szkic frontu>" "<szkic tyłu>" <katalog wyników>
```

Plumbing sprawdzony na **jawnie syntetycznych** rysunkach (`SYNTHETIC-*-not-owner-sketch.png`): trzy pakiety (B: 2 z 4 elewacji, MIXED; B1, B2: po 1), trzy
pełne biegi LOCAL (~6 min każdy, statusy completed), sceny, karta miniatury i diagnostyka metryczna — rc=0. Jako
**kontrpróba syntetyczna (nie wynik szkiców)**: rysunek z samym zarysem szczytu i garażu, bez ramy, odbiera ramę dokładnie
tej stronie, którą podmieniono (B1 — przód, B2 — tył, B — obie), a scorer oznacza to jako krytyczne
(NOT_RECOGNISABLE); A pozostaje 14/14. To potwierdza dwie rzeczy: rama LOCAL pochodzi z elewacji (rzut jej nie
odtworzy), więc szkic, który ją zgubi, zmieni tożsamość modelu — i miarka to wychwyci; oraz że B1/B2 wskazują stronę
przyczyny. Logi: `/home/user/rd/v35412/SMOKE.log` (paczka prywatna).

## 6. Testy

Self-testy: `visual-miniature.py`, `register-sketch.py`, `match-picture.py` — zielone. Plumbing `run-sketch.sh` na syntetycznych wejściach (rozdz. 5). Kod
produkcyjny nie zmieniony, więc pełna macierz nie była ponownie uruchamiana (ostatnia: v3.54.11, 15 znanych błędów
środowiska); typecheck na finalnym drzewie: OK.

## 7. Otwarte

| problem | stopReason |
|---|---|
| eksperyment B/B1/B2, rejestracja szkiców, kontrpróby, drugi przypadek | brak czterech plików wejściowych OWNER-a |
| jasne czoło `w-main-1` (0,40 m) w H | własność narożnika / czoło ściany nie jest hostem wykończenia — zmiana reprezentacji dla wszystkich domów, nazwana |
| Master Plan v3.54.12 | nie dołączony; obowiązuje v3.54.11 + decyzja §0 w ADR |
| nowe APK | nie budowane: brak nowej, użytecznej sceny (§11) |

---

# Dopisek REAL_OWNER_INPUTS (v3.54.12-REAL, po `41eb90a`)

Wejście: `BuildPlan-V35412-START.zip` OWNER-a — cztery obrazy w `images/`, pełny Master Plan v3.54.12 (skopiowany
bajt w bajt do `docs/MASTER_PLAN.md`) i prompt wznowienia. Commity: `59b9af1` (bariery za flagami, czoło ściany,
Master Plan), `11186ca` (dwie sceny podglądu), ten dopisek. **Koszt: 0 USD** — żadnego żądania do płatnego API;
ceny w rozdz. 14 pochodzą z oficjalnych stron cenników, nie z wywołań. Obrazy i ich pochodne leżą poza Gitem
(`/home/user/rd/v35412/`, paczka prywatna); w repozytorium są tylko liczby i hashe.

Uzupełnienie celu od OWNER-a (w trakcie etapu): **docelowo narzędzie obrazowe/API ma automatycznie przerabiać
wszystkie cztery elewacje na kolorowe, uproszczone szkice; dwa gotowe szkice tylko sprawdzają, czy taki sposób
przygotowania obrazu pomaga LOCAL.** Ręczne dostarczanie szkiców nie jest rozwiązaniem; analizator dalej rozpoznaje,
uzgadnia i buduje model. Rozdział 14 odpowiada na pytanie o automatyzację, spójność stron i koszt na dom.

## 8. Wejścia, parowanie i rejestracja

| plik (OWNER) | SHA-256 (8) | parowanie po zawartości (`match-picture.py`, NCC wycinka) | rejestracja na punktach budynku |
|---|---|---|---|
| `1000090696.jpg` | `aebf92bf` | **MATCH** → elewacja frontowa pakietu (`130edece…`), 0,626; margines 0,118 | — (oryginał) |
| `1000090699.jpg` | `6cfa4757` | **AMBIGUOUS** → elewacja ogrodowa 0,556 vs ta sama elewacja w drugim wariancie 0,534; margines 0,093 | — (oryginał) |
| `Uproszczona elewacja domu z garażem.png` | `c868bf59` | **AMBIGUOUS** — najbliżej wizualizacji perspektywicznych (0,665 / 0,660), front 0,584 | **PROPORTIONS_CHANGED**: skala X 0,589, Y 0,541 → szkic **o 8,9 % wyższy** względem szerokości; średnia reszta podobieństwa 12,6 px (≈0,21 m), afiniczna ≤ 6 px; bez odbicia |
| `Kolorowa tylna elewacja domu z balkonem.png` | `2e7b59bd` | **MATCH** → elewacja ogrodowa 0,690; margines 0,213 | **CROP_AND_SCALE**: X/Y 1,011, średnia reszta 2,5 px (≈0,04 m) |

Pełne wyniki: `research/source-to-model/v35412/results/real/pairing.txt`, `registration-{front,rear}.json`,
`points-{front,rear}.json`. Para frontu nie jest rozstrzygana z obrazu (szkic przypomina wizualizacje równie mocno
jak elewację) — przypisanie zrobiły punkty budynku (narożniki gruntu, wierzchołek, rama), których reszty potwierdzają
obie pary. Punkt CHECK „lewa krawędź bramy garażowej” we froncie: szkic przesuwa ją o −0,58 m — uproszczenie, które
OWNER z góry dopuścił (§0), nie błąd rejestracji.

B-reg (szkic przeniesiony do ramy oryginału samym podobieństwem) **nie był potrzebny jako wejście**: LOCAL dostał
szkice bez zmian (B/B1/B2) i to one zgubiły loggię; przyczyną nie jest kadr ani skala, tylko inna proporcja pionu,
której podobieństwo nie usuwa. Szkicu nie rozciągnięto ręcznie, a kolumna „SZKIC” na planszach jest w ramie oryginału
wyłącznie przez podobieństwo — różnica proporcji zostaje widoczna.

## 9. Wyniki A / B / B1 / B2 — dwie osobne miary

A = przypięty bieg v3.54.11 na oryginałach (`0476d353…`). B = oba szkice, B1 = tylko front, B2 = tylko tył; wszystkie
przez rzeczywisty LOCAL (`second-house.ts --package`, MIXED: 2 lub 1 z 4 elewacji podmienione, plany, przekroje
i boczne elewacje jak opublikowane).

**VISUAL_MINIATURE** (karta 14 cech, 6 krytycznych; `results/real/miniature-*.txt`):

| bieg | werdykt | zachowane / brak | uwaga |
|---|---|---|---|
| A | RECOGNISABLE | 14 / 0 | |
| B | RECOGNISABLE | 13 / 1 | brak przedniej loggii z balustradą |
| B1 (sam front) | RECOGNISABLE | 13 / 1 | jw. — przyczyna po stronie frontu |
| B2 (sam tył) | RECOGNISABLE | 14 / 0 | |

**METRIC_EVIDENCE** (diagnostyka, nie warunek miniatury):

| bieg | 16 cech | 27 wierszy | 14 punktów stref | podbitka portalu (prawda 2,28) |
|---|---|---|---|---|
| A | 16/16 | 27/27 | 12/14 | 2,321 |
| B | 11/15 | 23/27 | 12/14 | 2,523 |
| B1 | 11/15 | 23/27 | 12/14 | — |
| B2 | 16/16 | 27/27 | 12/14 | — |

**Szkice bez zmian pogorszyły LOCAL** na froncie (loggia, balustrada, głowica i podbitka portalu, nadproże bramy),
tył jest obojętny. Strefy (ciemne/jasne/drewno) w żadnym z tych biegów nie zyskały: pierwsza i druga bariera niżej.

## 10. Pierwsza błędna decyzja i naprawy za flagą

**Bariera 1 — rejestracja pionu (potwierdzona).** `registerElevationV2` ustawia jedną skalę z szerokości i kładzie
wierzchołek na kalenicy. Na szkicu frontu (o 8,9 % wyższym) grunt wypada na −0,98 m zamiast −0,32 m, więc rzędna
+3,06 (opaska/loggia) ląduje 0,45 m za wysoko, a czytnik pasa (okno 0,40 m wokół poziomu stropu, ≥ 4 z 6 kolumn) jej
nie znajduje — loggia i balustrada nie powstają. Diagnostyka: ten sam bieg z pionem zarejestrowanym z rzędnych
(B-flag) przywraca pas, loggię, balustradę i podbitkę (2,278 przy prawdzie 2,28). **Naprawa:** flaga `elevationVerticalFromDatums` (domyślnie wyłączona): gdy przy jednej skali grunt
mija rzędną terenu o > 0,3 m, pion dostaje osobną skalę z kalenicy i terenu (ograniczenie anizotropii 15 %; wcześniej
i tak działa istniejąca bramka gruntu 0,9 m); wzdłuż elewacji nic się nie zmienia. Oryginały mieszczą się w 0,3 m,
więc A z flagą = A bez flagi bajt w bajt (`0476d353`).

**Bariera 2 — zakres czytnika wykończeń (potwierdzona).** Regiony wykończenia czytane były tylko na wnękach
parteru, więc drewno szczytu frontu i ciemny panel szczytu tyłu nigdy nie były szukane — ani na oryginałach, ani na
szkicach. **Naprawa:** flaga `upperStoreyFinishes` (domyślnie wyłączona): wnęki kondygnacji wyższych próbkowane nad
balustradą, region do wierzchołka ściany; emiter przycina region do wysokości ściany-hosta.

Obie flagi: `--elevation-vertical-datums`, `--upper-storey-finishes` (`second-house.ts`, `runAnalysis`).

| bieg | miniatura | 16 cech | 27 wierszy | strefy | podbitka |
|---|---|---|---|---|---|
| A-off (A, flagi wyłączone) | 14/14 | 16/16 | 27/27 | 12/14 | 2,321 |
| B-flag, B1-flag (tylko pion) | 14/14 | 15/16 | 27/27 | 12/14 | **2,278** |
| A-both (oryginały, obie flagi) | 14/14 | — | — | 13/14 (fałszywy ciemny pas na zdjęciu szczytu) | — |
| **B-both (szkice, obie flagi)** | **14/14** | 15/16 | 27/27 | **14/14** | 2,278 |

Jedyna strata B-both względem A: nadproże bramy 2,75 m zamiast 2,25 m (szkic rysuje bramę wyższą). Zysk: drewno
szczytu frontu i ciemny panel szczytu tyłu (punkty F-wood-gable, R-gable-panel), których A nie ma — ciemny trójkąt
w szczycie tyłu B-both to ten panel, zgodny ze źródłem.

## 11. Kontrpróby: kolor nie tworzy architektury

| kontrpróba (na szkicu frontu, obie flagi) | miniatura | strefy | 16 cech / 27 wierszy |
|---|---|---|---|
| zamiana kanałów R↔B (inna paleta) | 14/14 | **11/14** | 15/16, 27/27 |
| szkic bez ramy szczytowej | **NOT_RECOGNISABLE** (krytyczne: rama frontu) | 14/14 | 13/15, 20/21 |

Paleta zmienia tylko klasy wykończenia (architektura bez zmian), a usunięcie ramy z obrazu usuwa ramę z modelu —
LOCAL nie dorysowuje cech, których obraz nie ma. Wniosek dla automatyzacji: generator **musi** mieć stałą paletę
klas materiałów i **nie może** gubić cech architektury; obie rzeczy da się sprawdzić automatycznie (rozdz. 14).

## 12. Jasny pas 0,40 m w H — naprawiony

Nowe, opcjonalne lico regionu wykończenia: `face: START | END` (czoło ściany; `a` w poprzek grubości). Addytywne:
OUTER/INNER kompilują się jak wcześniej, schemat modelu 1.8.0 bez zmiany numeru, domyślna wartość polecenia OUTER.
Budowniczy H (0.8.0) wykańcza czoło tylko wtedy, gdy jest **odsłonięte** (wolny koniec albo narożnik, który ściana
trzyma — zadeklarowany przez nią samą albo przez drugą ścianę jako OTHER) i strefa je obejmuje; czoła ukryte (styk,
narożnik drugiej ściany) zostają bez zmian. Domyślne malowanie domów się nie zmienia: LOCAL nie emituje czół,
a H tylko tam, gdzie strefa sięga odsłoniętego czoła. Marcówki H v3.54.12 różni się od v3.54.11 wyłącznie sześcioma
regionami czół (test `owner-v35412`); punkty stref 14/14, sonda pasa 3/3 (było 1/3); dwa odtworzenia identyczne
(pieczęć `452165d1…`). Regresja: R-DEV 6 SAME, R-CNEW 6 SAME + 2 NOT_SENT jak wcześniej, LAr SAME
(`results/real/regression-compare.txt`).

## 13. Osiem odpowiedzi — na rzeczywistych szkicach

1. **Uproszczenie a tożsamość** — bez zmian (rozdz. 1, odp. 1); karta ma 6 cech krytycznych, nie zmieniona.
2. **Co szkice zmieniły:** front jest o 8,9 % wyższy względem szerokości, a lewa krawędź bramy przesunięta o −0,58 m
   (dopuszczone); tył wierny (reszty ≤ 7 px, ok. 0,1 m). Bez odbicia. Przeszkodziła tylko proporcja pionu frontu.
3. **Czy LOCAL dostał szkice:** tak — B, B1, B2, warianty z flagami i kontrpróby, każdy z własnym hashem pakietu
   i cache (MIXED).
4. **Co było w danych, a nie docierało:** (a) wykończenia kondygnacji wyższych — czytnik ich nie szukał (flaga);
   (b) wykończenie odsłoniętego czoła ściany w H — brak hosta (lico START/END).
5. **Miniatura vs obmiar:** B-both zachowuje bryły, otwory, loggie, ramy i paletę (14/14), z lepszą paletą niż A
   (strefy 14/14 vs 12/14), ale gorszym nadprożem bramy; B bez adaptera traci loggię. Miary są osobnymi plikami.
6. **Powtarzalność:** A-off = A bajt w bajt; HC1 = HC2; każdy pakiet szkicowy ma własny hash, więc cache nie oddaje
   odczytu oryginałów jako szkicu.
7. **Do obejrzenia teraz:** APK 1343 (sceny 1–2 nowe), plansze (rozdz. 15). Ręczna diagnostyka: jedna (pas na
   poprawnej rzędnej). Niezmierzone: drugi dom z innym wydawcą i szkicami tego samego rodzaju; boczne elewacje
   jako szkice (nie dostarczone).
8. **Czy warto automatyzować:** **warunkowo tak** — pomaga tylko w klasach wykończeń, nie w architekturze,
   i tylko z adapterem pionu; bez stałej palety i bramki rejestracji automatyczny szkic może pogorszyć model
   (B, kontrpróby). Szczegóły i koszt w rozdz. 14.

## 14. Automatyzacja: jak, spójność czterech stron, koszt na dom (propozycja, nie zakup)

**Co dokładnie pomogło.** Nie „ładniejszy obraz”, tylko jednoznaczne klasy materiału (płaskie kolory bez cieni,
odbić i faktur) w obszarach, które czytnik wykończeń próbkuje. Geometria (rama, loggia, otwory) pomogła wtedy, gdy
rejestracja pionu była poprawna; przy innej proporcji zaszkodziła. Dlatego proponowany etap nie zastępuje oryginału,
tylko dokłada **kanał klas wykończeń** zarejestrowany do oryginału, a geometrię dalej czyta analizator.

**Proces (wszystko za flagą, domyślnie wyłączone):**
1. Wejście: cztery elewacje z pakietu (oryginały, ich hashe).
2. Przekształcenie każdej strony **edycją z oryginału** (nie generowaniem z opisu), z jednym zapisanym promptem
   i stałą paletą klas (np. jasny tynk, ciemny tynk, drewno, szkło, dach, grunt, tło) — paleta jest kontraktem, nie
   wyborem modelu.
3. Bramka rejestracji (`register-sketch.py` uogólniony na automatyczne punkty: narożniki gruntu, okapy, wierzchołek):
   MIRRORED → odrzut; PROPORTIONS_CHANGED → tylko z adapterem pionu i w jego granicach, inaczej odrzut i jedna
   ponowna próba; reszty ponad próg → odrzut.
4. Bramka tożsamości: karta cech oryginału vs szkicu (rama, loggia, liczba i strona dużych otworów, garaż); szkic,
   który zgubi cechę krytyczną (kontrpróba bez ramy), nie wchodzi.
5. Spójność czterech stron: wspólne rzędne (grunt, okap, kalenica) i narożniki muszą się zgadzać między stronami
   w tolerancji; ta sama klasa materiału na narożniku sąsiednich stron; paleta sprawdzana histogramem klas.
6. Cache po (hash oryginału, wersja promptu, model, wersja palety); wynik idzie do LOCAL jako dodatkowa warstwa,
   z proweniencją `DISPLAY_ASSUMPTION`/`TRACE_UNCERTAIN` dla klas, nigdy jako wymiar.

**Warianty i koszt na dom (cenniki oficjalne, sprawdzone 2026-11-18; 4 elewacje):**

| wariant | narzędzie | cena jednostkowa (źródło) | 4 strony | z ponowieniami i kontrolą |
|---|---|---|---|---|
| 1a. edycja rastra | Gemini 3.1 Flash Image, 1K | 0,067 USD/obraz (wyjście 60 USD/1M tok.; wejście 0,50 USD/1M) — ai.google.dev, cennik Gemini API | ≈ 0,27 USD | ≈ 0,5–0,8 USD |
| 1b. edycja rastra | Gemini 3 Pro Image, 1K/2K | 0,134 USD/obraz (wejście 2 USD/1M) — tamże | ≈ 0,54 USD | ≈ 1,0–1,5 USD |
| 1c. edycja rastra | OpenAI gpt-image-2 | 8 USD/1M tok. obrazu na wejściu, 30 USD/1M na wyjściu — developers.openai.com, cennik API | **nie szacuję**: oficjalnie tylko stawki tokenowe, liczby tokenów na obraz nie sprawdzono | — |
| 2. odczyt do JSON/SVG + render lokalny | Claude Sonnet 5.5 (istniejący klucz) | 2 / 10 USD za 1M tok. (wej./wyj.) — platform.claude.com, cennik | ≈ 0,24 USD (≈ 5k wej. + 5k wyj. na stronę) | ≈ 0,3–0,5 USD |
| 2'. jw. | Claude Opus 5.5 | 4 / 20 USD za 1M tok. — tamże | ≈ 0,48 USD | ≈ 0,6–0,9 USD |
| kontrola spójności (do każdego wariantu) | Claude Sonnet 5.5, wizja | jw. | ≈ 0,05 USD | |

Pełny koszt na dom, z ponowieniami i kontrolą: **ok. 0,3–0,9 USD** (1a lub 2), do **ok. 1,5 USD** (1b). Czas:
1–2 min na dom. Różnica metod: 1 to edycja rastra osobną usługą obrazową (błędy: dorysowane lub zgubione cechy,
zmiana proporcji — dokładnie to, co pokazały B i kontrpróby); 2 to odczyt obszarów do ograniczonego JSON/SVG
z lokalnym renderem (błędy: pominięte obszary, ale nic nie jest malowane poza tym, co zwrócono, a SVG jest w ramie
oryginału z definicji, więc bramka proporcji odpada). **Rekomendacja wykonawcy: pilot wariantu 2** (istniejący klucz,
brak nowej usługi, rejestracja z definicji), na dwóch domach z różnych wydawnictw, z kontrpróbami palety i ramy.
Wariant 1 wymaga osobnej usługi obrazowej — **nie kupiono jej i nie użyto**; propozycja nie jest zgodą na zakup.
Pula kampanii: 0,301978 USD — wystarczy najwyżej na jeden dom wariantem 2, więc pilot wymaga decyzji OWNER-a.

## 15. Plansze, APK, testy

Plansze (paczka prywatna, `boards/`), wszystkie w tych samych kamerach:
- `board-4-sides-source-sketch-A-B-Bboth-chosen.png` — ŹRÓDŁO | SZKIC (podobieństwo) | A | B | B-both | WYBRANY;
- `board-oblique-A-B-Bboth-H.png` — widok z góry i cztery skośne: A, B, B-both, H v3.54.11, H v3.54.12;
- `board-interior-no-roof-A-B-Bboth.png` — wnętrze bez dachu, obie kondygnacje (identyczne: szkice zastępują
  tylko elewacje);
- `board-closeups-strip-and-loggia.png` — zbliżenia: pas 0,40 m przed/po, loggia frontu A/B/B-both;
- `board-4-sides-H-v35411-v35412.png`, `elevations-A-B-adapter.png` (z części pierwszej).

**Wybór:** domyślny model produktu pozostaje **A** (flagi wyłączone): zgodny metrycznie 16/16, 27/27, rozpoznawalny
14/14. B-both jest sceną eksperymentu (ta sama tożsamość, lepsza paleta, gorsze nadproże bramy) — dowód, że kanał
kolorów pomaga wykończeniom, nie kandydat do wydania.

**APK 1343** (`11186ca`, podpis `6e48fac4…`, arm64, `zipalign -c -P 16 4` OK, SHA-256 `a40528a5…`): scena 1 —
„Marcówki — H v3.54.12 (czoło ściany)” (KANDYDAT), scena 2 — „Marcówki — LOCAL + szkice OWNER-a (eksperyment)”;
sceny APK 1342 bajt w bajt takie same po wypakowaniu; skan klucza 0 trafień. ANDROID_UI_NOT_VERIFIED (brak
urządzenia). Wyrównanie LOAD 0x1000 w `libnode.so` i `libbuildapp_node_bridge.so` jak w 1340–1342.

**Testy:** nowe — czoło ściany (kompilacja, walidacja, domyślne OUTER), emisja tylko odsłoniętych czół, rejestracja
pionu z rzędnych (4), sceny v3.54.12 (4); mobile-scene 95/95, Android `testDebugUnitTest` zielone; pakiety dotknięte
zmianą: 1917 testów zielonych. Pełna macierz: `results/real/matrix-final.txt`.

**Otwarte:** nadproże bramy w B-both (szkic rysuje bramę wyższą — uproszczenie, którego karta nie zabrania, ale
obmiar tak); drugi dom ze szkicami (brak wejść); boczne elewacje jako szkice; pilot automatyzacji (decyzja OWNER-a,
rozdz. 14); fałszywy ciemny pas A-both na zdjęciu szczytu (flaga `upperStoreyFinishes` na oryginałach fotograficznych
nie jest gotowa do włączenia domyślnie).
