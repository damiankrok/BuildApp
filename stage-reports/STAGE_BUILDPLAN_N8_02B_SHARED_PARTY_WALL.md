# STAGE BUILDPLAN N8-02B / FIX-05C — jedna wspólna ściana domu i garażu: Sasanki 3 i Marcówki

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `a66f4cc` (N8-02A) |
| solver | `SOLVER_V2_VERSION` **2.11.0 → 2.12.0** |
| APK | nie budowany |
| projekty | Dom w sasankach 3 (G), ARCHON `mb292397cb1840`, https://www.archon.pl/projekty-domow/projekt-dom-w-sasankach-3-g-mb292397cb1840 · Dom w marcówkach (GE), ARCHON `m2fa281446a8ca`, https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca · zmienione tą samą regułą: Dom w rarytasach 5 (G2E), `m84f2903cb8e14`, https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14 |
| ZIP | `BuildPlan-N8-02B-Shared-Wall-Before-After.zip`, 38 994 115 B, SHA-256 `e7573679dfb60e065a3d950a1fc65f42ff4689aeaea4284a33fb7d76a16ec268`, 231 plików; przekazany bezpośrednio, poza Git (zawiera obrazy ARCHON w `SOURCE-REFERENCE/`) |

## FIRST_BAD

Jedna ściana źródłowa staje się dwiema przy **emisji** (`v2/emit.ts`, pętla mas). Każda bryła dostaje
`createWallRing` grubości ścian domu, a nic wcześniej nie pyta rysunku, co stoi na styku brył.

| dom | rzut ARCHON (pomiar ręczny) | PRZED | po |
|---|---|---|---|
| Sasanki, parter i poddasze | jedno pasmo px 465..476 (12 px ≈ 0,23 m); ściana domu odsłonięta px 465..487 (0,43 m); wnętrze garażu od px 477 | `ring-main-0-w1` 0,43 (7,32..7,75) + `ring-attached-0-0-w3` 0,43 (7,75..8,18) = **0,86 m**; tak samo na poddaszu | jedna ściana 0,234 (7,323..7,557) |
| Marcówki, parter | jedno pasmo px 340..355 (16 px ≈ 0,42 m); łańcuch 790 kończy się na licu pasma | 0,49 (7,41..7,90) + 0,49 (7,90..8,39) = **0,98 m** | jedna ściana 0,423 (7,452..7,875) |
| Rarytasy, parter | za garażem px 460..469 (10 px); ściana odsłonięta 460..476 | 0,441 + 0,441 = **0,88 m** | jedna ściana 0,275 (6,375..6,650) |

Łańcuch w Sasankach:

- **Rysunek i pasma:** odczyt jednoznaczny. `T` = 0,43 m z lic zewnętrznych jest dobre dla ścian zewnętrznych.
- **Bryły:** dwie bryły z łańcuchów od N8-01, w `plan-decomposition`, `layout.ts` i `structural-layout.ts` (poprawnie).
  Linia styku x = 7,75 to lico domu z łańcucha, nie pasmo.
- **`reconstruct-v2.ts`:** `openSide` znał tylko N7-P2R, dla bryły węższej od dwóch ścian.
- **Emisja:** dwa pierścienie, w tym miejscu jest **FIRST_BAD**.
- **Otwory:** w ścianie domu (`readWallOpenings`, `sharedDoors`, `rectAt`) czytane na linii `planeAt − T/2` = 7,535,
  która jest krawędzią pasma, i przy grubości 0,43 m. Pod znakiem wodnym „archon” tusz ma lumę 93–95 i brakuje
  minimalnego biegu 11 px. Stąd **fałszywe przejścia 0,54 m** (z 7,26..7,80) **i 0,72 m** (z 5,67..6,39). OCR nie
  podał tu żadnego opisu.
- **Kompilator:** wyciął fizycznie wszystkie trzy przejścia (promień przez środek, 23/23).

### Ścianka przy schodach

- W modelu 2.9.0 (jedna bryła 11,60 m) pasmo było przegrodą 0,234 m. Kawałek 7,24..7,30 przy nim i przerwa 1,19 m
  dawały ściankę `main-iwall-0-x-8` 2,48 m z „drzwiami” 1,11 m.
- Po podziale na bryły (N8-01) kawałek przy paśmie znalazł się za licem domu. „Drzwi” straciły ościeże, a wolny kawałek
  4,82..6,12 odpadł jako mebel.
- **Rzut tego przebiegu nie potwierdza.** Przerwa to skośna krawędź zabiegu schodów i komórka 6 pod schodami. Rzut
  potwierdza odcinek 1,29 m i drzwi do komórki 6 w linii x ≈ 4,9, ze skrzydłem narysowanym od holu.

Pełny łańcuch z pikselami: `FIRST_BAD.md` w ZIP-ie, liczby w `stage-reports/artifacts/analyzer-n8-02b/`.

## Zmiany (reguły ogólne)

| plik | zmiana |
|---|---|
| `v2/party-wall.ts` (nowy) | `readPartyBand` / `readPartyWalls`. Każdy styk dwóch brył na kondygnacji czytany w poprzek: tusz to ciemny tusz albo płaskie neutralne wypełnienie (ściana pod znakiem wodnym). `ONE_WALL`: jedno spójne pasmo cieńsze niż 0,8 × obie ściany. `TWO_WALLS`: dwa pasma ze szczeliną albo pasmo grube jak obie ściany. `UNDECIDED`: za mało tuszu, pasmo niespójne albo narożnik nie do zamknięcia; wtedy dwie ściany jak dotąd i konflikt nazwany w `unresolved`. `sideSegments`: boki bryły podzielone na OWN / PARTY / NONE / CORNER. |
| `v2/emit.ts` | Bryła ze wspólną ścianą budowana ściana po ścianie, z narożnikami pierścienia: własne odcinki, jedna ściana na paśmie u gospodarza, nic u drugiej bryły. Przy narożniku drugiej bryły własna ściana gospodarza zachodzi na jej ścianę poprzeczną. Strop i stropodach drugiej bryły sięgają lica pasma. Otwory, przejścia, regiony wykończenia, kieszenie, tarasy, kominy i relacje dachów trafiają we właściwy odcinek. Ściany bez rekordu pierścienia dostają znacznik `body-envelope`. Bryły bez wspólnej ściany są emitowane bajt w bajt jak dotąd. |
| `v2/reconstruct-v2.ts` | Odczyt styków przed wnętrzem. Wnętrze każdej bryły czytane do lica pasma. Przejścia w ścianie wspólnej czytane na paśmie (linia i grubość pasma); pod połacią głównego dachu drzwi za wysokie dla ściany są odrzucane z nazwą. Wersja 2.12.0. |
| `v2/interior.ts` | Drzwi na końcu ścianki działowej: wolny kawałek na linii prostopadłej ścianki, w odległości drzwi od jej końca, jest ościeżem tylko przy narysowanym skrzydle (`swingDrawn`, ćwiartka łuku, 70 % z 12 punktów). Blok przy licu wewnętrznym, przez który kawałek przechodzi w całości, nie jest ościeżem, które chowałoby drzwi obok. |
| `mobile-scene/src/bundle.ts`, `apps/web/src/viewport/scene-adapter.ts` | Ściany ze znacznikiem `body-envelope` należą do obwiedni jak ściany pierścienia, więc nie są „ramą fasady”. To jedno źródło prawdy dla aplikacji i BuildWorld (`styling-parity`). |

- Bez nazw domów, współrzędnych i progów pod dom.
- `WALLS_OVERLAP`, `ringCollisions`, walidator, kompilator i reguły PARTIAL/COMPLETE bez zmian.
- Nic nie jest ukrywane w Three.js: każda zmiana siedzi w modelu.

## Wynik

| | Sasanki przed | Sasanki po | Marcówki przed | Marcówki po | Rarytasy przed | Rarytasy po |
|---|---|---|---|---|---|---|
| `model.json` | `c007ce8bab16…` | `dbb14fdb89a5…` | `8541ca10d053…` | `bcb151061f8e…` | `07b792a5e320…` | `9657ddad9448…` |
| ściana na styku | 2 × 0,43 | **0,234** (+ dom 0,43 na z 0..1,13 i 9,22..10,45) | 2 × 0,49 | **0,423** (+ dom 0,49 na z 8,01..13,60) | 2 × 0,441 | **0,275** |
| przejścia w niej | 0,54 · 0,72 · 0,88 | **0,88** | 0,90 | 0,90 | 1,00 | 1,00 |
| drzwi (wszystkie) | 15 | 14 | 13 | 13 | 13 | 13 |
| ścianka przy schodach | brak | 1,31 m + drzwi 0,77 m do komórki 6 | — | — | — | — |
| kompletność | COMPLETE_WITH_OPEN_QUESTIONS | COMPLETE_WITH_OPEN_QUESTIONS | C_W_O_Q | C_W_O_Q | COMPLETE | COMPLETE |
| walidacja / kompilator | ok, 0 diagnostyk | ok, 0 diagnostyk | ok | ok | ok | ok |
| otwory wycięte fizycznie | 23/23 | 22/22 | 21/21 | 21/21 | 20/20 | 20/20 |

Uwagi:

- **Sasanki:**
  - wnętrze garażu i strop skrzydła sięgają ściany (7,557 zamiast 8,18);
  - ścianka 8 | 9 dochodzi do muru, a jej drzwi 9 → 8 zostały;
  - dach krzyżowy z N8-01 bez zmian;
  - poddasze: jedna ściana 0,234 m.
- **Marcówki:** dom zachował własną ścianę 0,49 m na piętrze nad garażem i za garażem (z oknem 300/230). Stropodach
  garażu dochodzi do ściany.
- **Rarytasy:** szerokość drzwi wejściowych 105/210 bez zmian.

Przegląd wzrokowy (to przegląd, nie pomiar):

- `BOARDS/*-ARCHON-vs-BEFORE-AFTER.png` — wycinek rzutu ARCHON, widok z góry i ściana od strony garażu;
- `*-CLOSEUPS-BEFORE-AFTER.png` — parter, poddasze, drzwi, ścianka przy schodach;
- 9 kamer `review-shots.ts`, ΔY ortho −540.

Ściana od strony garażu: PRZED widać trzy przejścia w ścianie domu i drugą ścianę garażu, PO jedną ścianę z jednymi
drzwiami.

Gorsze albo niepewne (bez naprawy):

- **Sasanki, poddasze:**
  - drzwi z holu do pokoju 8 (0,94 m, skrzydło narysowane) odczytane, ale nie wycięte;
  - powód: pod połacią głównego dachu, który leży w całości pod dachem skrzydła, ściana ma 1,64 m;
  - konflikt nazwany; naprawa to przecięcie dachów (kosze), poza zakresem.
- **Sasanki, schody:**
  - skosu zabiegu (≈ 0,9 m) nie da się zapisać w osiach, więc między ścianką 1,31 m a ścianką 0,86 m zostaje
    szczelina;
  - drzwi do komórki 6 mają 0,77 m z przerwy w rysunku (skrzydło ≈ 0,71 m); to nie jest wartość typowa.
- **Marcówki:**
  - pasmo 0,42 m przy ścianie domu 0,49 m, więc lico wewnętrzne ma 4 cm uskoku;
  - nowa krótka ścianka 0,57 × 0,11 m za przednią ścianą garażu (`attached-0-iwall-0-x-1`): to brzeg filarka przy
    bramie, który teraz leży we wnętrzu czytanym od pasma; na rzucie to nie jest ścianka.
- **Arganiach:**
  - na styku brył rzut nie rysuje ściany (0 z 215 pozycji), bo bryła kończy się w środku garażu;
  - zostają dwie ściany jak dotąd, konflikt nazwany, `model.json` bez zmian.
- Ciała N7-P2R (`openSide`) nie dostały znacznika `body-envelope`; w 8 domach ich nie ma.
- Szersza wersja reguły bloków-ościeży dodawała drzwi w Goździkowcach, Arganiach i A01. Nie sprawdziłem jej na
  rzutach, więc nie weszła.

## Regresja ośmiu domów (offline, `second-house.ts`, zapieczętowane wejścia)

| dom | wynik |
|---|---|
| A01, Goździkowce, Cieszynianka, Trytomach, Arganiach | `model.json` identyczny z N8-02A. Poddasza Trytomach i Arganiach bez zmian. Arganiach: styk `UNDECIDED`, nazwany |
| Sasanki | zmiana zamierzona; dach krzyżowy N8-01 bez zmian (dach, połacie, kosze, okna dachowe identyczne) |
| Marcówki | zmiana zamierzona |
| Rarytasy | zmiana tą samą regułą (jedna ściana na rzucie); geometria dachu, bramy i okien bez zmian |

Kompilator, walidator i promień przez każdy otwór na wszystkich 8 domach dają wynik ok, 0 diagnostyk i 0
`WALLS_OVERLAP`. Szczegóły: `stage-reports/artifacts/analyzer-n8-02b/regression-8-houses.json`.

## Testy (celowane; pełnego CI nie uruchamiano)

| test | wynik |
|---|---|
| `packages/reconstruction` (cały pakiet, 2.12.0) | 93 pliki, **1128/1128** |
| `party-wall-n8-02b.test.ts` (nowy) | **16/16** |
| `analysis-service`: garages-n7-fix03, partial-preview-n7-p1, service, setback-n7-fix04, thin-body-n7-p2r, wall-recovery-n7-fix01, wall-thickness-n7-fix02 | **72/72** |
| `mobile-scene` + `tests/architecture/styling-parity.test.ts` | **86/86** |
| `tsc --noEmit` (root) | czysto |

Nowy test `party-wall-n8-02b.test.ts` sprawdza:

- jedno pasmo cofnięte w głąb domu;
- pasmo pod znakiem wodnym;
- ścianę podwójną ze szczeliną i jedno pasmo grube jak obie ściany (oba przypadki: dwie ściany);
- bryły odsunięte o metr i styk bez narysowanej ściany;
- garaż parterowy przy domu z piętrem;
- garaż dłuższy od domu oraz za krótki odcinek własnej ściany (odmowa);
- bryłę z `openSide`;
- podział boków;
- emisję przez `applyCommands`, `validateModel` i `compileBuilding` z promieniem przez przejście;
- drzwi na końcu ścianki z łukiem i bez łuku.

Testy, w których zmieniłem asercje, i dlaczego:

- `storey-houses.ts` (`ringsByLevel`), `wall-strip-plans.ts` (`ringStatuses`), `partial-preview-n7-p1`,
  `setback-n7-fix04`: bryłę rozpoznawały po rekordzie pierścienia, a bryła ze wspólną ścianą go nie ma. Teraz liczą ją
  po ścianach `body-envelope`.
- `wall-thickness-n7-fix02`: wyłączyłem ścianę wspólną z warunku „każda ściana zewnętrzna ma grubość domu”. Ta ściana
  ma grubość pasma (0,21 m, przegroda między bryłami rozdzielonymi na ściance), co asercja teraz sprawdza.

## Następny krok

Do decyzji OWNER-a po ocenie ZIP-u. Do wyboru:

- przecięcie dachu głównego koszami pod dachem skrzydła, żeby drzwi na poddaszu Sasanek zmieściły się w ścianie;
- skośne krawędzie zabiegów schodów;
- podział brył Arganiach na styku z garażem.

N8-03 nie był zaczynany.
