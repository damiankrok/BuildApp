# ADR v3.54.10 — kontrakt odczytu 0.5.0, opisy otworów z rzutu, strefy wykończenia, wnętrze z rzutów

Status: przyjęte w etapie v3.54.10 (kod `397a809`, `d43eebe`, `62350cc`).

## Kontekst

Odczyt API wracał jako obiekty bez lokalnej walidacji zagnieżdżeń; normalizacja nadpisywała surową odpowiedź;
identyfikatory otworów zależały od kolejności w odpowiedzi; pudełko otworu nie mówiło, czy obejmuje ramę, szkło czy
tylko widoczną część; opisy otworów z rzutów (234/303) nie były czytane; nie było pól wykończenia ani wnętrza z rzutów;
podział szyb był konwencją `round(width/0.9)`.

## Decyzje

1. **Kontrakt `buildapp.house-reading` 0.5.0** (`contract.ts`, `conform@1`): walidacja wobec schematu narzędzia,
   z którym pytano (wariant zapisany w nagraniu), kolejność kluczy ze schematu, nieznane pola usuwane i nazywane,
   pozycja z błędem odrzucana i nazywana, jedna migracja `JSON_TEXT@1`; `rawAnswer` = kopia przed normalizacją;
   nagrania starszych kontraktów odtwarzane łagodnie.
2. **Stabilne id otworów** z porządku programu dla nagrań 0.5.0; starsze nagrania zachowują porządek odpowiedzi
   (ich recenzje nazywają te id). Nowe kolekcje dokumentu emitowane tylko, gdy niepuste.
3. **Opis otworu z rzutu** (`w/h` w cm) wiązany po położeniu z otworem tej samej ściany i kondygnacji: szerokość
   i wysokość najwyższego punktu `PRINTED`; skośne przeszklenie zachowuje skrajnię przy wysokim końcu; rama
   z elewacji zostaje obok; konflikt > 0,5 m szerokości lub 0,6 m wysokości jest nazwany, nie poprawką. Rzut
   kondygnacji musi się zarejestrować (jedna skala, pokrycie ≥ 90 %); bez tego opis nie jest umieszczany.
4. **Kontur otworu**: `EXPOSED` / `hiddenBelowY` → koniec przy zasłonie `ESTIMATED`; `GLASS` → otwór szerszy o profil
   ramy (0,07 m, domyślne) `ESTIMATED`. **Podział** z odczytu; konwencja tylko bez odczytu i nazwana.
5. **Strefy wykończenia** = prezentacja: `createSurfaceRegion OUTER` w stylu `low-poly@1`, nigdy bryła, ściana ani
   pomieszczenie; strefa `UNSURE` nierysowana; różne wykończenia na wspólnym odcinku → odcinek nierysowany i nazwany.
6. **Wnętrze z rzutów** scalane z importem LOCAL bez usuwania; operacji korekty ścianek/pomieszczeń nie ma — poprawia
   się je ponownym odczytem rzutu.
7. **Kominy**: komin z widoku szczytowego łączony z widokiem bocznym, który go pokazuje.

## Konsekwencje

Dokument domu 0.6.0, resolver 0.7.0, builder 0.6.0, ścieżka 0.6.0; schemat modelu bez zmian. Nagrania v3.54.9
odtwarzają się bajt w bajt; regresja na 15 domach różni się wyłącznie kominami. Otwarte: rama (percepcja), kominy
czytane jako `OTHER`, obrys parteru brutto blokuje rejestrację rzutu.
