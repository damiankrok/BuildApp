# v3.54.3 dla OWNER-a: krótko

Pełny raport: [SOURCE_TO_MODEL_V3543.md](SOURCE_TO_MODEL_V3543.md). Zamrożony kandydat: `aabc044`.

## Co się zmieniło

Do tej pory API mogło tylko poprawić odczyt wymiarów. Teraz pętla jest pełna:

1. analizator buduje model;
2. API ogląda **ten model** obok rysunków i mówi, co się różni;
3. analizator sam wbudowuje poprawkę (albo odmawia z powodem);
4. API ogląda nową wersję i ją ocenia;
5. zła poprawka jest cofana, a wynik dla aplikacji mówi, co sprawdzono i co nadal jest błędne.

## Aksamitki

- API zobaczyło: końcowy model z czterech stron i z góry, obok 2 rzutów i 4 elewacji.
- Zaproponowało: lukarnę dwuspadową nad wejściem, wskazaną na rysunku elewacji frontowej.
- Analizator zastosował: lukarnę `dormer-front-c50` na frontowej połaci, 35–65 % szerokości ściany.
- Drugie spojrzenie: „w mniej więcej tym miejscu i rozmiarze; jedno okno zamiast dwóch".
- To samo przeszło przez serwer ze świeżym pobraniem strony.
- **Nadal błędne:** brak wykusza (0,90 m), lukarna stoi na połaci zamiast w licu ściany, nie ma balkonu, portyku ani belek.

## Co jeszcze działa

- **Jedna skala w całym domu.** Po poprawce skali wszystkie wymiary pochodne są przeliczane. Wcześniej w Aksamitkach 19 z 19 było w starej skali; teraz 0.
- **sp318422:** odmowa → model 14,02 × 9,58 m, czyli dokładnie wydrukowane 46'-0" × 31'-5". Fałszywe przyjęcie z v3.54.2 zniknęło.
- **Supertunie:** API rozpoznało, że koniec salonu to samo szklenie; analizator zamknął obrys na kresce wymiaru. Odmowa → model 6,32 × 13,50 m (szerokość o 0,58 m za mała, wynik to mówi).
- **Kukliki, Torenie:** dobre modele bez zmian; kandydat gorszy od modelu został cofnięty.
- **Madera:** model stoi w skali sprzecznej z wymiarami (14 % za duży). Wynik mówi to teraz wprost i wyłącza ilości.

## Potwierdzenie na 8 nowych domach (4 wydawców, 6 spoza ARCHON)

Jeden bieg, referencje zapisane wcześniej, bez strojenia.

- API wykryło **5 z 5** lukarn widocznych na rysunkach domów, które miały model.
- Analizator zbudował **3**, dwóm odmówił z kodem.
- Scorer uznał za zgodną **1 z 3**. Dwie stoją dobrze na swojej bryle, ale bryła jest po złej stronie domu (model odbity lustrzanie) albo dom nie ma garażu.
- Żadnej lukarny na trzech domach bez lukarny.
- Obrys: 0 poprawionych. Jeden dom (stopy i cale) przeszedł z odmowy w model, ale bez garażu, a wynik błędnie podał obrys jako zgodny.
- Żaden dom nie stracił modelu ani się nie pogorszył.

**Wniosek:** mechanizm działa także poza ARCHON, ale poprawa jakości na nowych domach **nie jest potwierdzona**. Pętla dobudowała szczegół do modeli, o których sama wiedziała, że mają większy błąd.

## Statusy

| Status | Wartość |
|---|---|
| IMPLEMENTATION_COMPLETE | tak (pakiety A, B, C i druga rodzina) |
| HOST_INTEGRATION_VERIFIED | tak (trzy zadania przez serwer + zadanie bez tokena) |
| QUALITY_GAIN | tak na znanych domach: 3 odmowy → modele, 1 lukarna |
| TRANSFER_EVIDENCE | niepotwierdzony jako poprawa jakości; mechanizm zadziałał poza ARCHON |
| ANDROID_VERIFIED | nie (brak urządzenia; APK nie budowano) |

## Koszt

77 zapytań, **3,72 USD** w tej kampanii (w tym potwierdzenie 1,52 USD i dwie próby hosta 1,53 USD). Księga narastająco: 9,96 USD z pułapu pilota 24,11 USD i limitu projektu 100 USD. Jedno spojrzenie na model kosztuje około 0,05 USD.

## Co OWNER może uruchomić

- Serwer analizatora lokalnie, z pilotem za flagą i tokenem: wysyła adres strony projektu, dostaje model, scenę i listę znanych wad. Bez tokena działa jak dotąd i nic nie kosztuje.
- Odtworzenie wszystkich zapisanych biegów offline, bez klucza.
- Aplikacja na telefonie nie pokazuje jeszcze nowych informacji; nie ma nowego APK.

## Trzy następne decyzje

1. **Kolejność w pętli:** nie budować cech dachu, dopóki otwarte jest zgłoszenie o lustrze, braku bryły albo skali. Naprawić status obrysu, żeby porównywał zbudowany model.
2. **Rejestracja elewacji** jako osobny krok, a na niej otwory i formy dachu.
3. **Składanie brył w prawdziwej skali** (Madera, Gracja, garaże, wykusz).

## Jak dojść do domu „jak Marcówki"

Rozdział 15 raportu. W skrócie: model Marcówek ma tyle samo obiektów co model z analizatora; różni się tym, że przeniesiono do niego wszystko, co widać na elewacjach. API jest dobre w zauważaniu, **co** jest na rysunku i **gdzie**; analizator w mierzeniu i budowaniu. Brakuje jednego wspólnego kroku — rejestracji elewacji — i poprawnej bryły, zanim zacznie się dokładać detale.
