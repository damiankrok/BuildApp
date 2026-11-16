# Wyglądy domu 3D i propozycje UI

Stan: wyglądy zaimplementowane w kodzie i testach JVM; renderowanie na
urządzeniu **NOT_VERIFIED** (brak urządzenia/emulatora w tej sesji). Podglądy
z rasteryzatora dowodowego (`evidence/PresentationRaster.kt`, bez cieni, AO
i specular) leżą poza repozytorium.

## Zasada

Wygląd zmienia tylko prezentację: światło (siła, barwa, kierunek słońca,
zabarwienie nieba), parametry materiałów, alfę, kontury, tło, siatkę i
arkusz gruntu. Nigdy geometrii, zbioru obiektów, widoczności, zaznaczenia ani
semantyki. Geometria jest wgrywana raz; przełączenie to zapisy parametrów,
podmiana instancji materiału (tylko Prześwietlenie) i dodanie/usunięcie
encji nakładek. Paleta i arytmetyka barw są czystym Kotlinem
(`presentation/HouseLooks.kt`), testowane w `HouseLooksTest`.

## Wyglądy

| Grupa | Wygląd (listwa) | Intencja | Światło | Materiał / alfa | Kontury | Tło / grunt |
|---|---|---|---|---|---|---|
| Dom | Model (Wygląd) | bez zmian | bez zmian | style Materiały/Neutralny/Grupy | brak | grafit, siatka |
| Dom | **Przytulny** (Ciepły) | dom, nie model CAD | ciepłe słońce 64 klx, niżej; ciepłe niebo; miękkie AO (0,45 / r 0,7) | ciepły tynk, terakota + dachówka, orzech, dąb, drewniany taras | strukturalne, brąz 32 % | ciepły piasek; ciepły arkusz gruntu z cieniem |
| Dom | **Wieczór** | ta sama paleta o zmierzchu | niskie pomarańczowe słońce 20 klx, długie cienie; chłodne niebo | jak Przytulny; szyby świecą ciepło (emisja tylko części szyb) | brak | granat zmierzchu; ciemny grunt |
| Studium | Makieta, Kreska | bez zmian | bez zmian | bez zmian | bez zmian | bez zmian |
| Studium | **W słońcu** (Słońce) | czytelność w pełnym słońcu na działce | mocne słońce 90 klx, cienie | drabina wartości: białe ściany, czarny dach i ramy, nasycone niebieskie szyby | wszystkie, czarne | szare tło; jasny grunt |
| Rysunek techniczny | **Techniczny** (Techn.) | ciemny widok techniczny z MASTER_PLAN §3.2 | neutralne, silne wypełnienie, bez cieni | chłodne szarości, jasne ramy wokół cyjanowych szyb (lekko świecących) | wszystkie, jasne chłodne | prawie czarne; siatka |
| Rysunek techniczny | **Prześwietlenie** (Rentgen) | przezroczysta bryła: pokoje, schody, kondygnacje widać przez powłokę | płaskie, bez cieni i AO | wszystko półprzezroczyste (5–42 %): powłoka słabsza od ścianek działowych, dach najsłabszy; szyby cyjan + lekka emisja; pokoje turkus; drzwi i schody łososiowe (nie żółć postępu) | wszystkie, jasne, widoczne przez ściany | prawie czarne; wyraźna siatka |
| Rysunek techniczny | **Światłokopia** (Błękit) | rysunek z budowy: linie robią formę | płaskie | powierzchnie o ton nad granatem, zasłaniają linie z tyłu | wszystkie, jasny cyjan; zaznaczenie białe | granat; jasna siatka |

Uzasadnienie wymyślonych: **Wieczór** — ten sam dom w innym świetle, bez
drugiej palety; **W słońcu** — kontekst użycia z PRODUCT.md (krótkie kontrole
na działce, jedną ręką, w słońcu: odblask zabiera barwę, zostaje wartość);
**Światłokopia** — język rysunku, który budowlańcy znają z budowy.
Odrzucone: biała makieta studyjna i szkic ołówkiem — dublowałyby istniejące
Makietę i Kreskę.

Gwarancje w testach: deterministyczne palety niezależne od materiałów modelu;
przezroczystość tylko w szkłach/znacznikach (poza Prześwietleniem, gdzie
wszystko, z podłogą 5 %); kontrast L* ≥ 8 między grupami, które się stykają
(gdzie bryłę niosą wartości) albo tusz ≥ 40 L* od każdej powierzchni (gdzie
niosą ją linie); sylwetka ścian ≥ 10 L* od tła i gruntu; w Prześwietleniu
szkło ≥ 2,5× bardziej kryjące niż powłoka, wyraźnie barwne, z emisją i
innym odcieniem niż pokoje, drzwi i schody; kontur zaznaczenia różny od
konturów we wszystkich wyglądach; tekst Ink i InkMuted na szkle chromu
≥ 4,5:1 nad tłem każdego wyglądu; Model, Makieta i Kreska z dokładnie
dawnym słońcem, niebem i bez gruntu.

## Zaimplementowane w UI (tanie i bezpieczne)

- Panel **Wygląd** pogrupowany: *Dom*, *Studium bryły*, *Rysunek techniczny*
  (nagłówki `PanelGroupLabel`, opcje `PanelOption` z opisem w jednej-dwóch
  linijkach). Style Modelu jak dotąd pod wyborem Modelu.
- Przycisk listwy pokazuje wygląd jednym słowem (≤ 8 znaków, skala 1,3);
  pełna nazwa w panelu i w `stateDescription` („Wygląd: Prześwietlenie”).
- Brak nowego ruchu: zmiana wyglądu jest natychmiastowa.

## Propozycje, niezaimplementowane

1. **Miniatury wyglądów.** Zamiast samego tekstu — pasek 9 miniatur tego
   samego domu (renderowane raz po wgraniu modelu, poza wątkiem UI).
   Wymaga offscreen render targetu Filamenta i budżetu pamięci.
2. **Style Modelu do „Dane techniczne”.** Materiały/Neutralny/Grupy są
   diagnostyczne; w panelu dla właściciela zostaje 9 wyglądów, style idą do
   sekcji diagnostycznej. Zmiana miejsca istniejącej funkcji — decyzja OWNER-a.
3. **Wygląd na dom, zapamiętany.** Dziś wygląd żyje w pamięci procesu;
   zapis per dom razem z postępem. Wymaga trwałości stanu widoku.
4. **Podpowiedź „W słońcu”.** Czujnik światła otoczenia może *zaproponować*
   (powiadomienie znikające samo) przełączenie na działce — nigdy przełączać
   po cichu.
5. **Oś czasu × wygląd.** W Prześwietleniu podgląd etapu zostaje podzbiorem
   modelu; **odrzucam** pomysł rysowania przyszłych etapów jako „ducha”:
   podgląd nie może udawać stanu budowy (zasada podglądu jako obrysu), a
   zdjęta warstwa ma znikać.
6. **Inspektor × Prześwietlenie.** Po zaznaczeniu pokoju: kadrowanie i
   przygaszenie reszty (fokus) — to osobny parametr alfy per obiekt, poza
   paletą; wymaga decyzji o „wygaszaniu otoczenia” z MASTER_PLAN §3.2.
7. **Przejście między wyglądami.** Interpolacja parametrów 180 ms
   (`MotionPolicy.settle`), natychmiast przy `ANIMATOR_DURATION_SCALE = 0`.
   Barwy tak, geometria nigdy; wymaga pętli animacji parametrów w rendererze.
8. **Przekrój techniczny.** Prawdziwa płaszczyzna cięcia w Technicznym i
   Prześwietleniu — wymaga zmiany materiałów (`matc` tej samej wersji
   Filamenta, niedostępny w tej sesji).
9. **Bloom okien o zmierzchu, lepsze AO.** Tylko po pomiarze klatek na
   urządzeniu (budżet mobilny).
10. **Chrom nad jasnymi tłami** zostaje ciemnym szkłem (jedna warstwa,
    `Glass` 90 %): kontrast policzony w teście, bez jasnego wariantu UI.

## Do sprawdzenia na urządzeniu (NOT_VERIFIED)

Każdy wygląd na `marcowki-auto-v3` i obu domach referencyjnych: barwy po
tone mappingu Filamenta, cień na arkuszu gruntu (Przytulny, Wieczór,
W słońcu) bez migotania z siatką, Prześwietlenie (kolejność przezroczystości,
krawędzie przez ściany, wybór elementu), zaznaczenie w każdym wyglądzie,
przełączanie wyglądów bez przebudowy geometrii (`RenderDiagnostics.modelUploads`
bez zmian), etykiety listwy przy skali czcionki 1,3, TalkBack.
