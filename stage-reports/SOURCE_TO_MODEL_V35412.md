# v3.54.12 — kolorowy szkic jako wejście LOCAL i rozpoznawalna miniatura (etap przygotowany, eksperyment B nie uruchomiony)

Gałąź `claude/new-session-3kzcgh`. Baza: `8119d85` (v3.54.11, APK 1342), HEAD zgodny z originem przed etapem.
Koszt etapu: **0 USD** (bez żądań API). Kod produkcyjny bez zmian: ten etap dodaje wyłącznie narzędzia badawcze,
kartę tożsamości, protokół i dokumenty.

## 0. Najważniejsze: brakujące wejścia

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
`research/source-to-model/v35412/identity-marcowki.json` (14 cech, 5 krytycznych) **przed** jakąkolwiek oceną;
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
