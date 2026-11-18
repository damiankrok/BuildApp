# ADR v3.54.11 — wykończenie na elemencie, checkpointy w APK, LOCAL na warstwach obrazu

Status: przyjęte w etapie v3.54.11 (kod `38592f7`, `caecb9a`, `84de494`, `d88f13c`; APK 1341 i 1342).

## Kontekst

Audyt paczki v3.54.10: pas portalu nad wejściem/garażem był jasny, choć odczyt miał ciemną strefę; strefy wiązały się
tylko ze ścianami. Historyczny scorer mierzył spód portalu na płycie dachu garażu (2,78) zamiast na pasie (2,261).
OWNER chciał porównywać rzeczywisty H i oddany LOCAL na telefonie. Otwarte było, czy uproszczone obrazy (tło zdjęte)
pomogą LOCAL czytać więcej.

## Decyzje

1. **Checkpointy jako zapieczętowane sceny (D52).** Model z paczki trafia do rejestru scen z pieczęcią SHA-256
   (`sealedOwnerModel`), eksport jest deterministyczny, sceny są sprawdzane po wyciągnięciu z APK. Nowa wersja H to
   nowa scena obok, nie podmiana starej. Testy listy scen czytają dostarczony indeks.
2. **Wykończenie na elemencie (D53).** Strefa elewacji, która w ramie tej elewacji pokrywa ≥ 60 % lica pasa portalu,
   jest wykończeniem tego elementu (`PortalSchema.finish`; materiał całego członu FASCIA). Dwie strefy różnego
   wykończenia nad licem → `ELEMENT_FINISH_CONFLICT`, bez wyboru. Strefa odczytana na innej bryle niż ściana pod nią →
   `ZONE_BODY_SPAN`. Pas przecięty płytą balkonu → `ELEMENT_FINISH_PARTIAL`, płyta zachowuje swój materiał. Bez
   globalnej zmiany `mat-member`, bez nakładek i brył-kolorów. Spód i powroty pasa nie są widoczne na elewacji —
   nie są wymyślane; osobne wykończenie lica członu wymaga innej reprezentacji (otwarte).
3. **Scorer v1.1 obok v1.** Pomiar spodu/góry portalu na obiektach stojących w płaszczyźnie frontu nad rozpiętością
   portalu, z nazwami obiektów; wiersze v1 zachowane. Poprawka pomiaru nie jest naprawą modelu.
4. **Referencje przed oceną.** Punkty referencyjne stref zapisane przed pierwszym pomiarem; jedna reguła klasy koloru
   dla wszystkich modeli.
5. **Warstwy obrazu tylko jako narzędzie badawcze (D54).** Pochodna ma własne bajty, hash, URL i cache, maskę ważności
   i licznik dodanych krawędzi; plany, przekroje i rzuty nie są zmieniane. Produkcja ani host nie mają preprocesora;
   flaga nie powstała, bo B nie dał poprawy (rozdz. 5 raportu). Odczyt regionu przez API warunkowany poprawą po masce
   ręcznej — nie uruchomiony.
6. **Macierz zdolności (D55)** rozdziela buduje / znajduje / potwierdzone; istnienie prymitywu nie jest odczytem.

## Konsekwencje

Wersje: dokument domu 0.7.0 (czyta 0.6.0), resolver 0.8.0, builder 0.7.0, ścieżka domu 0.7.0; schemat modelu i
eksportera scen bez zmian. Nagranie v3.54.10 odtworzone na nowym kodzie daje H z ciemnym pasem (scena 1 APK 1342),
geometria bez zmian.
