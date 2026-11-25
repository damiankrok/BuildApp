# v3.54.21 — protokół (zapisany 2026-11-25, przed zamrożeniem kodu i przed losowaniem nowej próby)

Zlecenie: `BuildPlan_Prompt_v3.54.21_Oryginaly_Model_Weryfikacja.md` + audyt Council v3.54.20. Gałąź
`claude/new-session-3kzcgh`, `[skip ci]`, bez PR. Zapisy uzupełniane są **przed** każdym kolejnym krokiem; nic nie jest
dopisywane wstecz do sekcji już rozliczonej.

## 1. Baseline i zbiory

- **Baseline** = kod v3.54.20 `108611e` (APK 1353), zamrożony w drzewie `/home/user/rd/v35419/run-tree`. Odtwarzalność
  sprawdzona na początku etapu: Amarylis, Mindelo i Ametyst odtworzone z nagrań na tym drzewie dają `model.json`
  bajt w bajt równy modelom oddanym w v3.54.20 (i tym w paczce audytu). Dla pozostałych domów baseline = modele oddane.
- **DEV** = 20 domów v3.54.20 + cztery domy NEW-G (obejrzane w v3.54.20, więc już nie próba). Przypadki audytu —
  Amber, Mindelo, Skagen, Eliza, Amarylis, Ametyst, Aletta — są **kontrpróbami DEV**, nie dowodem generalizacji.
- **NEW-H** = świeża próba, losowana **po zamrożeniu kodu** (§5).
- Te same bajty źródeł w obu ramionach (cache pakietu wspólny); odpowiedzi API baseline nagrane i odtwarzane (§6).

## 2. Zakres obsługiwanych układów dachów (zadeklarowany przed strojeniem)

Obsługiwane (mają zbudować się poprawnie i przejść kontrolę połączeń):

1. pojedynczy dach dwuspadowy i czterospadowy nad prostokątem (jak dotąd, te same polecenia);
2. skrzydło z kalenicą poprzeczną dochodzącą do połaci dachu wyższego lub równego: **kosze liczone z przecięcia
   połaci**, dla okapów równych, wyższych i niższych niż okap dachu głównego;
3. dach główny czterospadowy + skrzydło dwuspadowe; skrzydło czterospadowe (bez połaci szczytowej od strony styku);
4. kilka skrzydeł na jednej połaci; kalenica skrzydła na wysokości kalenicy głównej (połać dzielona);
5. **dojście niższego dachu do wyższej ściany** (brak kosza), dachy „w linii" (ściana szczytowa między nimi),
   dachy jawnie rozdzielone — **nie są łączone**;
6. **szczyt poprzeczny bez uskoku rzutu**: drugi obszar dachu na ścianach tej samej bryły.

Poza zakresem tego etapu (ma być nazwane w wyniku, nie zgadywane): okapy wysunięte w układzie połączonym (połączony
układ jest budowany bez wysunięcia okapu), policzki przy okapie skrzydła powyżej połaci (zgłaszane jako `cheekM`),
dachy płaskie w układzie (zostają osobne), obrysy nieprostokątne obszarów dachu, mansardy, dachy pulpitowe, lukarny
jako obszary dachu, piętrowy rdzeń z parterową „spódnicą" wyznaczaną z rzutu piętra, wnęki/podcienie jako element
(nazywane `NO_CONSUMER`).

## 3. Kryteria (nie zmieniają się po obejrzeniu wyników)

Rozliczane **osobno**, żadna liczba nie zastępuje drugiej:

**(A) Odczyt oryginału i przypisanie do części** — na źródłach, bez modelu: lista cech referencyjnych domu spisana
z oryginalnych elewacji/rzutu/przekroju/perspektyw **przed** otwarciem modeli (`references/`), w tym układ dachów:
które dachy, kierunki kalenic, relacja każdej pary (kosz / dojście do ściany / osobno), szczyty poprzeczne.
Miara: zgodność odczytu struktury (`form-read/3`) z referencją, własność po własności; osobno „przypisane do
właściwej bryły".

**(B) Wykonanie przyjętych parametrów i relacji** — na modelu, automatycznie (`STRUCTURE_READBACK` 1.1.0,
`ROOF_SYSTEM`, `FEATURE_TRACE`): każdy związany dach (rodzaj, kierunek, kąt ≤ 0,5°, okap i kalenica ≤ 0,26 m względem
rozwiązania), każda relacja (kosz = dwie krawędzie VALLEY o wspólnych wysokościach końców; dojście = zero koszy),
każda przyjęta liczba dachu głównego (kąt ≤ 3°, wysokości ≤ max(0,35 m; 8 %)). Każda własność ma los:
`APPLIED / RETAINED_WITH_CONFLICT / REJECTED / UNUSED_UNSUPPORTED / UNRESOLVED`.
Kryteria geometryczne twarde: żaden budowany dach poza 8–62°; połacie układu nie nakładają się (suma pól = pole
rzutu dachów); na koszu różnica wysokości obu połaci = 0; ściana pod dojściem nie jest ścinana do niższego dachu.

**(C) Wygląd całego domu i utrata wcześniej poprawnych części** — na planszach, oceniający nie zna wariantów
(etykiety A/B losowane, klucz poza katalogiem oceniającego): dla każdego domu (1) który wariant jest bliżej
oryginałów jako całość, (2) osobno dach: układ i połączenia połaci (TAK / CZĘŚCIOWO / NIE, z nazwanym błędem),
(3) osobno wnętrze na rzucie. Liczbowo, niezależnie od oceniającego: ściany wewnętrzne, otwory zewnętrzne, pokrycie
przerw rzutu — baseline → po; **każdy spadek wymieniony z przyczyną**.

Pełny odbiór domu wymaga (B) bez niezgodności relacji **i** (C2) = TAK. Otwarta istotna wada bryły/dachu wyklucza
pełny odbiór, także gdy wynik częściowy jest dostarczany. Akceptacja recenzenta AI bez miary źródłowej to
`CLOSED_REVIEW_ONLY`, nie `SOURCE_VERIFIED`.

## 4. Testy przyczynowe (geometria znana niezależnie od implementacji)

`packages/reconstruction/test/roof-system-v35421.test.ts` i `packages/analysis-service/test/roof-system-v35421.test.ts`:
kosz i poprawny brak kosza; okapy wyżej / niżej; różne wysokości; zmiana osi po walidacji (72°); szczyt bez uskoku
rzutu; opis wykonany tylko w połowie; błędna sugestia API przy poprawnym modelu; etykieta początku ściany w obrysie L;
sonda audytu 1° / 100 m / 200 m; zgodność z `attachedGableLayout` / `valleyCutMainRoof` tam, gdzie tamte przyjmują.

## 5. Świeża próba NEW-H — reguła doboru (zapisana przed losowaniem)

- To samo narzędzie i pule co dotąd: `v35419/trial/select.py`, commit bazowy = **commit zamrożenia tego etapu**,
  etykieta ziarna `V35421-NEWH`; pule: Studio Atrium, Lipińscy, Dobre Domy, ARCHON (`archon-pool-2.txt`). Rodziny
  otwarte dotąd — w tym cztery z NEW-G — dopisane do `seen-families.txt` **przed** losowaniem.
- `TRIAL_WANT=2`: do dwóch przyjętych domów na pulę (do 14 otwarć na pulę), reguły przyjęcia pakietu bez zmian
  (rzut parteru, ≥ 3 opisane elewacje, dom mieszkalny ≥ 60 m²).
- **Warstwy układu dachu** (wymóg zlecenia: krzyżujące się dachy oraz HIP lub niższy dach przy ścianie; nie same
  proste parterowe). Strona wydawcy nie podaje rodzaju dachu jako faktu, więc warstwę ustala **opis referencyjny
  spisany z oryginalnych obrazów przed jakąkolwiek analizą i przed otwarciem jakiegokolwiek modelu**: dla każdego
  przyjętego pakietu klasa `PROSTY` (jeden dach nad jedną bryłą) / `KRZYŻUJĄCE` (kalenica poprzeczna, kosze) /
  `HIP` / `NIŻSZY_PRZY_ŚCIANIE` (mogą współwystąpić).
- **Skład próby**: z listy przyjętych, w kolejności wylosowanej (pula po puli, naprzemiennie), brane są domy aż do
  **czterech**, z co najmniej dwóch pul; dom klasy `PROSTY` jest pomijany, dopóki w próbie brakuje warstwy
  `KRZYŻUJĄCE` albo warstwy `HIP`/`NIŻSZY_PRZY_ŚCIANIE` i lista ma jeszcze dom z brakującą warstwą. Pominięcia
  są zapisane. Jeżeli lista nie zawiera warstwy — próba jest oddawana bez niej i **niespełniony warunek jest nazwany**.
- Limit: 4 domy (piąty tylko, gdy budżet po czwartym na to pozwala i brakuje warstwy).
- To mała próba: wynik jest listą domów, nie procentem skuteczności.

## 6. Ramiona NEW-H (zapisane przed losowaniem)

- **B** — baseline `108611e`, jeden bieg na żywo (transport hosta: strict, cache promptów 5 min); odpowiedzi nagrane.
- **F@B** — kod zamrożony odtworzony **na nagranych odczytach B** (te same szkice, ten sam odczyt metryczny i obrys);
  na żywo wyłącznie to, czego B nie pytał albo co zależy od nowego modelu: odczyt struktury `form-read/3`
  (oryginały + perspektywy), nowe listy otworów elewacji, recenzja nowej rewizji. Różnica B ↔ F@B = kod + nowy
  odczyt struktury; zmienność świeżych szkiców nie wchodzi do porównania (to rozdzielenie wpływu kodu od zmienności
  API, którego wymaga zlecenie).
- **F@B/2** (pomocnicze, 0 USD) — kod zamrożony na nagraniach B **ze starym odczytem struktury** `form-read/2`
  z biegu B: różnica B ↔ F@B/2 to sam konsument (kod), różnica F@B/2 ↔ F@B to sam odczyt.
- Wynik pierwszego biegu każdego ramienia jest zachowany. Dom poprawiany po obejrzeniu wyniku staje się DEV.
- Oczekiwanie zapisane z góry (nie cel strojenia): w NEW-H (a) żaden dom nie traci ścian wnętrza ani otworów bez
  nazwanej przyczyny źródłowej; (b) dom warstwy `KRZYŻUJĄCE` ma w F@B co najmniej jedną relację VALLEY zbudowaną
  i potwierdzoną odczytem zwrotnym, której w B nie ma; (c) dom warstwy `NIŻSZY_PRZY_ŚCIANIE` nie dostaje kosza;
  (d) ocena ślepa: F@B bliżej oryginałów w większej liczbie domów niż B, bez domu „wyraźnie gorzej".

## 7. Budżet

Księga `research/ai-assist/spend-ledger-v35417r3.json`: na starcie etapu 56,290453 z 68,542857 USD (bez późniejszych
księgowań) → 12,252404 USD. **Limit etapu 9,5 USD**; rezerwa ≥ 2,7 USD nietykana. Plan: odczyty struktury i recenzje
DEV ≤ 2,2; NEW-H ≤ 4,6 (B ≈ 0,6/dom, F@B ≈ 0,3/dom); host (świeży bieg + powtórka + bez tokenu) ≤ 1,0; zapas 1,7.
Ta sama pula, ta sama usługa, klucz tylko ze środowiska. Ograniczenie kosztów: replaye nagrań, cache promptów 5 min,
dobór obrazów (jedna elewacja na stronę, do 3 perspektyw, miniatury i duplikaty pomijane z zapisaną przyczyną).

## 8. Stan przed zamrożeniem (dopisane 2026-11-25, przed zamrożeniem i przed losowaniem NEW-H)

Wszystko poniżej dotyczy **DEV** (domy znane: 20 domów v3.54.20, cztery domy NEW-G i siedem kontrprób audytu wśród nich).
Zmiany kodu wprowadzone po obejrzeniu wyników DEV są dozwolone (DEV nie jest dowodem generalizacji) i są tu wymienione,
żeby ocena NEW-H mogła je odróżnić od reguł zapisanych w §2–§6.

Biegi DEV tego etapu (wszystkie zachowane, pierwszy wynik każdego zachowany):

- `w1`–`w5`: 0 USD, odtworzenie nagrań siedmiu domów audytu na kolejnych commitach (odczyt struktury: nagrany `form-read/2`).
- `v1` (Amber) i `v2` (siedem domów audytu): **świeży odczyt `form-read/3`** z oryginałów i perspektyw + recenzja na żywo;
  pozostałe odczyty z nagrań. `v3`: te same zakupione odczyty `form-read/3` odtworzone (0 USD) na poprawionym kodzie
  i nowa recenzja na żywo.
- `d1`: 0 USD, 24 domy DEV na kodzie przed zamrożeniem (nagrane odczyty).

Zmiany po obejrzeniu DEV (każda ogólna, z testem i kontrpróbą; żadnego warunku po domu):

1. arbitraż i readback trzymają opis dachu głównego przy bryle, do której go związano (nie przy największym prostokącie);
2. ciało ze źródeł, które nie zastąpiło LOCAL, zostaje w zapisie (`massing-rejected.json`);
3. zdjęcia do odczytu struktury skalowane przez uśrednienie pola, nie przez pomijanie wierszy; obraz-zaślepka
   (32 × 32 px) nie jest wysyłany jako „przekrój" (ani do odczytu, ani do recenzji);
4. korekta jednego dachu układu rozwiązuje cały układ od nowa (ops 1.13.0); kernel jest pytany przed zaproponowaniem
   układu (odmowa: dachy osobno, nazwany `BUILD_ERROR`);
5. proponowana kalenica powyżej wysokości budynku podanej przez stronę jest odrzucana (`ABOVE_PUBLISHED_HEIGHT`);
6. który bok jest frontem: odczyt, którego elewacje mają jedną skalę (`SCALE_AGREE` 1,12 / 1,30), po wysokości strony,
   przed liczbą zgodnych wysokości; prawie kwadratowy dom nie rozstrzyga niczego;
7. dach poprzeczny z odczytu leżący nad bryłą rzutu jest dachem tej bryły (`CROSS_AS_BODY` 0,6);
8. okap boku, którego ściany kończą się pod połaciami, czytany z połaci (nie z wysokości pierścienia = kalenicy);
9. zapis, kto odpowiedział na odczyt struktury (zakupione w tym biegu / odtworzone nagranie i kontrakt odpowiedzi).
10. recenzja niezależna (dwóch czytelników na ustalenie) granic odczytu: arbitraż ocenia LOCAL i ciało ze źródeł tą
    samą regułą bryły głównej; podsumowanie `consultation.quality` mówi to, co bramka cech KEY; układ dachów i odczyt
    zwrotny mierzone na modelu dostarczonym, gdy korekta go zmieniła; numery obrazów odtworzonej odpowiedzi
    `form-read/2` czytane na liście żądania `/2`; części rzutu podane później uzgadniane ponownie (bez zapytania);
    nieudany lub odmówiony odczyt zapisany jako brak odpowiedzi;
11. cała aplikacja na zielono (polecenie OWNER-a): 16 odziedziczonych niepowodzeń testów i 5 testów Androida
    rozwiązanych u przyczyny (lista w commicie `8cc0d47`), e2e przeglądarki 49/49 (`efdab37`), pokrycie dachu mierzy to,
    co ułożyło, i zwiększa moduł o zmierzony nadmiar budżetu trójkątów.

Kryteria §3 i oczekiwania §6 bez zmian. Zamrożenie: commit wpisany w §9 przed losowaniem.
