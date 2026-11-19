# ADR v3.54.13 — kontur wykończenia, obserwacja wyglądu i arbitraż per właściwość

Status: przyjęta (etap v3.54.13). Kontekst: Master Plan v3.54.13 §2, §7.17, D58–D60; raport SOURCE_TO_MODEL_V35413.

## Decyzje

1. **Kontur regionu wykończenia jest częścią modelu** (`SurfaceRegion.outline`, schemat **1.9.0**): wielobok prosty
   w `(a, b)` lica, wewnątrz `rect` (który zostaje obwiednią). Brak konturu = prostokąt jak dotąd. Kontur to kolor,
   nigdy geometria: kompilator przycina go do materiału ściany i wycina otwory.
2. **Wersja jest jawna.** Czoła START/END z v3.54.12 i kontur należą do 1.9.0; plik 1.8.0 z czołem (tylko builder
   v3.54.12 tak pisał) jest restatowany z własną notą, kontur pod 1.8.0 jest odrzucany. Przepieczętowanie modeli
   i scen nie zmienia siatek (sprawdzone dla każdej sceny).
3. **Obserwacja wyglądu** (`AppearanceObservation` 1.0.0) opisuje klasy i kontury w pikselach analizowanego obrazu
   z jawną transformacją do źródłowej elewacji i pochodzeniem; nie zna ID modelu. Konsument rejestruje kontur raz na
   elewacji i dzieli go między powierzchnie widoczne w kompilowanej scenie (jedna granica dla wszystkich kondygnacji).
4. **Tryb wyglądu nie rekonstruuje geometrii.** Wariant C bierze geometrię i parametry metryczne z biegu na oryginałach;
   odcisk geometrii użytkowej musi zostać ten sam (inaczej odmowa).
5. **Arbitraż per właściwość** gdy kandydat był czytany z obrazem pomocniczym: RETAINED / CORRECTED / UNSUPPORTED /
   UNRESOLVED, z kontrolą, że baza jest świadkiem tych samych źródeł (inna rewizja lub obcy cache → UNRESOLVED).
6. **Odczyt API to JSON konturów, nie edycja rastra**; nic z odpowiedzi nie jest wykonywane; plan i najgorszy koszt
   zapisane przed żądaniem; nowy prompt/model = nowy kandydat.
7. **Domyślnie wyłączone**: konsument jest wywoływany jawnie (C), flagi v3.54.12 bez zmian; ścieżka LOCAL bez
   obserwacji daje ten sam model co wcześniej (poza napisem wersji schematu).

## Konsekwencje

Miniatura dostaje kontury ze źródłowymi granicami, a obmiar zostaje nietknięty. Klasa cegły nie istnieje w palecie
(ręczna diagnostyka Pallas podała ją jako ciemny tynk). Boki bez szkiców korzystają z odczytu API. Miara granic
wymaga ręcznych referencji (tylko przód i tył Marcówek).
