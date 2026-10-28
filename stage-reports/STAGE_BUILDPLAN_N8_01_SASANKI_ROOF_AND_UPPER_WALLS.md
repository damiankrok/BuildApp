# STAGE BUILDPLAN N8-01 / FIX-05A — Sasanki 3: dach i górne ściany

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `802929f` (ARCHON Visual Review 1311) |
| solver | `SOLVER_V2_VERSION` **2.9.0 → 2.10.0** |
| APK | nie budowany (odniesienie 1311) |
| projekt | Dom w sasankach 3 (G), ARCHON `mb292397cb1840`, https://www.archon.pl/projekty-domow/projekt-dom-w-sasankach-3-g-mb292397cb1840 |
| ZIP | `BuildPlan-N8-01-Sasanki-Visual-Before-After.zip`, 12 047 143 B, SHA-256 `a5a18bae34402beccebd5ea3feda5e5c3ee9172cfd7a87debf8e81a116ab1ea6`, 69 plików; przekazany bezpośrednio, poza Git (zawiera obrazy ARCHON w `SOURCE-REFERENCE/`) |

## FIRST_BAD

Źródło: część mieszkalna 7,75 × 10,45 m, a obok skrzydło garażowe 3,85 m. Front skrzydła jest cofnięty o 0,70 m, tył o
0,80 m. Dach krzyżowy: kalenica części mieszkalnej prostopadła do frontu (szczyty na elewacji frontowej i ogrodowej),
kalenica skrzydła równoległa do frontu, obie na rzędnej +8,52 przy kącie 45°.

1. **Rzut (pierwszy błąd).** Flood zamyka krawędź komórki na narysowanej linii. Utwardzenie przed bramą i obrys
   daszku za drzwiami pomieszczenia 9 zamykają dwa paski (3,85 × 0,70 i 3,85 × 0,80 m) jako `BUILT`: na krawędzi
   zewnętrznej `wall 0.00`, `line 1.00`. Największy prostokąt obejmuje wtedy całość 11,60 × 10,45 i nie ma uskoku
   elewacji ani szwu. Solver sam zauważył cofnięcie (`front-east corner: open 3.84 m … and 0.74 m …; a notch is at
   least 1.2 m each way`), ale reguła wnęki narożnej słusznie go nie dotyczy.
2. **Bryły i dachy.** Jedna bryła daje jeden dach dwuspadowy: liczba dachów jest zła, skrzydło nie ma własnego dachu,
   cztery połacie zostały uproszczone do dwóch.
3. **Oś kalenicy.** Głosy elewacji wypadają po 0,00 na froncie i tyle, bo próbka w 85 % rozpiętości 11,6 m trafia w dach
   skrzydła stojący za połacią. Zostaje oś z układu: X. Test wzniosu w `roof-systems` liczy wznios od +3,06 (to
   posadzka poddasza, nie okap); nie był poprawiany.
4. **Cztery otwory** (`OPENING_ABOVE_WALL_TOP`). Przy kalenicy X ściany frontowa i tylna poddasza są okapowe. W miejscu
   otworów mają 0,099 m, a otwory 2,30 m: `opening-1-front-4-0` (180/230), `opening-1-rear-6-0` i `-6-1` (100/230),
   oraz `main-idoor-1-0` w ściance x = 2,91 (1,464 m). To skutek osi kalenicy, nie osobny błąd kompilatora.

Tabela, kondygnacje, wysokości, parapety i nadproża są w ZIP-ie (`FIRST_BAD.md`) oraz w
`stage-reports/artifacts/analyzer-n8-01/`.

## Zmiany (reguły ogólne)

| plik | zmiana |
|---|---|
| `plan-decomposition.ts` | `lineWorkStrips`: pas `BUILT` wzdłuż obrysu rzutu jest gruntem, gdy na każdej komórce krawędź zewnętrzna nie ma pasma ściany ani otworu, jest węższy od bryły (`minSpanM` dekompozycji), stoi przed ścianą, wychodzi do otwartego końca i ≤ 20 % jego pola to pasmo ściany lub lity tusz. Zapis w `decomposition.lineWorkStrips`. |
| `plan-decomposition.ts` | `facadeSeams`: lico w narożnym bloku (bez własnego pasma) porównywane z pasmem ściany arkusza; ściana prowadzona dalej musi mieć ≥ 50 % (`SEAM_CORNER_WALL`). |
| `v2/reconstruct-v2.ts` | głos kalenicy pomija koniec rozpiętości przylegający do przybudówki; `topStoreyFloorY` dla przybudówki o tej samej najwyższej kondygnacji; okna dachowe z rzutu pod dachem przybudówki, cięte pionowo w jej połaci; wersja 2.10.0. |
| `v2/attached-roof-form.ts` | profil dachu głównego do kotwiczenia odczytu górnej krawędzi czytany na dalszej połowie rozpiętości; poziom górnej krawędzi na kalenicy głównej nad poddaszem → GABLE z kalenicą z rzędnej przekroju i okapem z kąta (tylko ≥ 0,3 m nad posadzką i ≤ głowica ścian); `attachedGableLayout`: kosze przy kalenicach równych i okapie skrzydła niżej (płaszczyzna stopniuje wzdłuż linii przyległości, poniżej okapu głównego — oparcie o ścianę). Dotychczasowa gałąź koszy bez zmian. |

Bez nazwy projektu, bez współrzędnych, bez ręcznego `model.json`, renderer bez zmian.

## Wynik — Sasanki

| | przed (2.9.0) | po (2.10.0) |
|---|---|---|
| `model.json` | `090749f43fa6b741…` | `c007ce8bab1689c745cb…` |
| bryły | 1: 11,60 × 10,45 | `main` 7,75 × 10,45 (2 kond.), `attached-0` 3,85 × 8,95 (2 kond.) |
| zabudowa | 121,22 m² | 115,45 m² (ARCHON: 116,22) |
| dach | 1 GABLE, kalenica X | GABLE kalenica Z + 2 połacie skrzydła kalenica X, 2 kosze, okap skrzydła 4,04 / główny 4,645, kalenica 8,52 |
| bramka układu | `STOREY_COVERAGE_DISAGREES`, `ROOF_EVIDENCE_DISAGREES` | `STOREY_COVERAGE_DISAGREES` |
| kompletność | COMPLETE_WITH_OPEN_QUESTIONS | COMPLETE_WITH_OPEN_QUESTIONS |
| kompilator BuildWorld | 4 errors, 4 warnings | geometry ok |
| okna / drzwi (zewn.) / pomieszczenia | 9 / 11 (4) / 8 | 8 / 15 (9) / 10 |
| okna dachowe / kominy | 4 / 1 | 3 / 0 |

Nowe otwory zgodne ze źródłem:
- brama garażowa 2,73 × 2,20 (ARCHON 275/225); wcześniej fałszywe okno 3,46 × 0,53;
- okno 90/110 i drzwi 105/210 z tyłu pomieszczenia 9; wcześniej fałszywe okno 3,46 m.

Gorsze albo niepewne:
- **komin:** blok przyjęty wcześniej za komin (wysokość przyjęta, nad dachem niewidoczny) leży teraz na granicy brył
  i nie jest czytany;
- **ściana dom/garaż:** zbudowana jako dwie ściany zewnętrzne (2 × 0,43 m wobec ok. 0,27 m na rzucie) — dotychczasowa
  konwencja przybudówek. Odpada przez to 0,2 m końca ścianki `main-iwall-0-x-8`, więc ścianka (2,5 m z drzwiami)
  znika;
- **przejście 0,54 m** w ścianie dom/garaż jest podejrzane;
- **okna dachowe:** na lewej połaci 2 z 3;
- **szczyt skrzydła:** okno w miejscu drzwi balkonowych 200/230 (bez zmian).

Przegląd wzrokowy zestawia elewacje ARCHON z modelem (`BOARDS/ARCHON-vs-BEFORE-AFTER.png`). Front: szczyt z balkonem
po lewej, połać i brama skrzydła po prawej. Tył: szczyt z balkonem i dwojgiem drzwi, obok niższa połać z drzwiami
i oknem. Oba widoki zgadzają się z ARCHON, przed zmianą nie zgadzały się. To przegląd, nie pomiar.

## Regresja ośmiu domów (offline, `second-house.ts`, zapieczętowane wejścia)

| dom | wynik |
|---|---|
| A01, Goździkowce, Marcówki, Cieszynianka, Trytomach, Arganiach | `model.json` identyczny |
| Rarytasy | geometria identyczna; zmienił się tylko opis dowodu połaci garażu (wznios 1,97 → 2,03 m) |
| Sasanki | zmiana zamierzona |

Pierwsza wersja reguły pasów zdejmowała pas ściany frontowej Cieszynianki (bramka i węgary bramy garażowej). Warunek
„≤ 20 % pasma ściany lub litego tuszu” to usunął: pasy Sasanek mają 2–5 %, Cieszynianka ponad 20 %. Szczegóły:
`stage-reports/artifacts/analyzer-n8-01/regression-8-houses.json`.

## Trytomach i Arganiach (diagnoza, bez naprawy)

- **Trytomach:** rzut poddasza ma własną skalę 0,0297 m/px, a jest rejestrowany w skali parteru 0,0213 m/px („no
  outer faces found”). Poddasze wychodzi 7,24 m zamiast ok. 10,07 m, dach na 13 m, otwarty szczyt.
- **Arganiach:** skala rzutu poddasza 0,0090 m/px z 2 kotwic (≈ ⅓ parteru), 0 obszarów, `NO_MASS_REACHES_UP`.

Inna przyczyna niż w Sasankach: rejestracja lub skala rzutu poddasza.

## Testy (celowane; pełnego CI nie uruchamiano)

| test | wynik |
|---|---|
| `packages/reconstruction` (cały pakiet, przed podbiciem wersji) | 90 plików, **1093/1093** |
| `wing-roof-n8-01.test.ts` (nowy: pasy, szew od narożnika, kosze przy niższym okapie, dotychczasowa gałąź) | **11/11** |
| `analysis-service`: setback-n7-fix04, garages-n7-fix03, wall-thickness-n7-fix02, partial-preview-n7-p1, thin-body-n7-p2r, wall-recovery-n7-fix01, service + model-completeness-n7-fix04 (po podbiciu wersji) | **91/91** |
| `tsc --noEmit` (root) | czysto |

Rendery: `apps/web/tools/review-shots.ts --model-files`, 9 kamer, ΔY ortho −540. Zrzuty „przed” są bajt w bajt
identyczne z zestawem ARCHON 1311.

## Następny krok

Do decyzji OWNER-a: rejestracja rzutu poddasza we własnej skali (Trytomach, Arganiach) albo ściana dzielona
przybudówki jako jedna ściana.
