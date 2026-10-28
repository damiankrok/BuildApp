# STAGE BUILDPLAN N8-03D1 — Dom w arganiach: pustka nad salonem

Projekt: Dom w arganiach (G2E) — https://www.archon.pl/projekty-domow/projekt-dom-w-arganiach-g2e-m32b290f26a4e8

Baza: `ac6f6bd` (N8-03C, solver 2.15.0). Wynik: solver **2.16.0**. Czytnik metryk bez zmian (1.5.0).
Gałąź `claude/new-session-3kzcgh`.

## Problem

- Strop poddasza `slab-main-1` miał tylko otwór schodowy (0,968 × 1,335 m).
- Pustka nad salonem, narysowana na rzucie poddasza, była w modelu litym stropem. Salon nie miał przestrzeni
  dwukondygnacyjnej.

## Geometria źródła (potwierdzona przed zmianą)

| źródło ARCHON | co pokazuje |
|---|---|
| Rzut poddasza (`floor-plan-01-attic`, 853 × 853 px) | Szary blok z napisem „Pustka nad salonem”, w tyle domu, między garderobą pokoju 7 a schodami 8, od tylnej ściany do holu 1.<br>Wypełnienie: jeden płaski ton (196–199), wyraźnie ciemniejszy od podłóg (236/242), płytek łazienki i pasa pod skosem (217).<br>Niezależny odczyt pikseli (ton 194..200, największa składowa): **77 × 137 px**, x 311..387, y 143..279. |
| Rzut parteru (`floor-plan-02-ground`) | Pod tym miejscem salon (4) przy tylnym przeszkleniu. Bloku w tym tonie nie ma (największa składowa 54 px). |
| Przekrój (`section-01`) | Strop +3,06 kończy się ok. 3,7 m przed tylną ścianą: przestrzeń dwukondygnacyjna nad salonem. Kalenica +7,99, 38°. |

Skala arkusza poddasza w zarejestrowanej ramie kondygnacji: 0,02673 m/px. 77 × 137 px daje
**2,06 × 3,66 m** (głębokość zgodna z przekrojem w granicach odczytu).

Na pozostałych rzutach poddaszy w korpusie bloku w tym tonie nie ma. Są tylko piksele antyaliasingu; w Marcówkach
mała plama, którą czytnik odrzuca po powierzchni.

## FIRST_BAD — od obrazu do kompilatora

| # | Etap | Stan | Pierwszy błąd? |
|---|---|---|---|
| 1 | Obraz (rzut poddasza) | Pustka narysowana jako jednolity szary blok, opisana słowami. | nie |
| 2 | Ekstrakcja rzutu (pasma ścian, komórki) | Blok leży między ściankami, nie jest ścianą; komórki pomieszczeń poprawne. | nie |
| 3 | Skala i rejestracja | Rama kondygnacji 1: 0,02673 m/px. Otwór schodowy (odczytany niezależnie z rysunku schodów) trafia na schody 8. | nie |
| 4 | Granice pustki | **Żaden etap solvera nie czytał pustki w stropie.** W kodzie nie istniało pojęcie pustki: wypełnienie traktowano jak podłogę, a `readInterior` włączał je do holu. | **TAK, FIRST_BAD** |
| 5 | Hipoteza stropu | Strop = obrys kondygnacji minus `stair.slabHole`, i nic więcej. | skutek #4 |
| 6 | Emisja komend | `createSlab slab-main-1` z jednym otworem. | skutek #4 |
| 7 | `model.json` | `holes`: 1 (schody). | skutek #4 |
| 8 | Kompilator geometrii | „geometry ok”: strop lity nad salonem. Formalnie poprawny, bo dziura, której nie ma w modelu, nie jest błędem. | „geometry ok” ≠ poprawny strop |

## Poprawka — reguła ogólna (`packages/reconstruction/src/v2/slab-void.ts`)

Bez wyjątków po nazwie domu. Dla każdej kondygnacji powyżej parteru czytam z jej własnego rzutu, wewnątrz jej
obrysu, regiony, które rzut wypełnia jak pustkę:

- jeden ton, achromatyczny (kanały w granicach 8), co najmniej 25 poziomów ciemniejszy od tonu podłogi tej
  kondygnacji (dominanta jasnych tonów) i jaśniejszy niż 140, czyli nie tusz ścian;
- spójny (składowa 4-sąsiedzka w ±2 poziomach tonu), σ ≤ 4;
- lity: co najmniej 85 % regionu z wypełnionymi dziurami, a dziury to napis;
- co najmniej 1,5 m² i co najmniej 0,9 m szerokości (erozja), więc nie przewód, szyb ani pas;
- nie nachodzi na otwór schodowy (otwór schodowy zostaje taki, jaki był);
- pod nim stoi kondygnacja niższa.

Obrys to **rzeczywisty wielokąt** wypełnienia: brzeg śledzony po narożnikach pikseli, schodki antyaliasingu
≤ 2 px usunięte. Prostokąt zostaje prostokątem, L zostaje L. Wielokąt przechodzi do świata przez zarejestrowaną ramę
kondygnacji, więc skala i położenie pochodzą z tej samej ramy co ściany i schody.

W emisji (`emit.ts`) pustka jest drugim otworem stropu tej kondygnacji, obok otworu schodowego:

- krawędź pustki leżąca ≤ 0,1 m od krawędzi stropu jest dociągana do lica ściany; wypełnienie kończy się na
  narysowanej linii ściany (tu 0,048 m przy tylnej ścianie);
- pustka spoza stropu nie jest wycinana;
- dach, ściany, pomieszczenia i inne stropy nie są dotykane.

Proweniencja stropu: `SOURCE_DERIVED`, z opisem odczytu (powierzchnia, liczba narożników, zakres, ton, σ,
wypełnienie, niepewność 1 px = 0,027 m, dociągnięcie do lica). Znaczenie „to jest pustka” pochodzi z tonu
i spoistości wypełnienia (`holes.meaning` wizualne), **nie** z napisu: rozpoznawanie czyta tylko cyfry, więc słów
nie odczytuję i opis to mówi.

Każda odmowa ma nazwany powód (krok `N8-03D1: voids in the floor of storey N`, ślad `SLAB_VOID_REFUSED`).

`SOLVER_V2_VERSION` 2.15.0 → 2.16.0, z wpisem w changelogu.

## Wynik — pomiar na skompilowanych trójkątach stropu

Narzędzie: `research/analyzer-n8-03d1/slab-probe.ts`. Promienie pionowe przez trójkąty `SLAB` (siatka 0,05 m):
- w otworze z odsunięciem 0,05 m od krawędzi;
- obok, w pasie 0,05–0,3 m poza otworem, wewnątrz stropu.

| | PRZED (2.15.0) | PO (2.16.0) |
|---|---|---|
| Odczyt pustki (świat) | — | x 5,305..7,368, z 8,171..11,816 → po dociągnięciu do 11,865; 4 narożniki; 7,52 m² |
| Wymiar | — | **2,063 × 3,694 m** (ARCHON: 77 × 137 px = 2,06 × 3,66 m; ± 0,027 m na krawędź) |
| Otwory w `slab-main-1` | 1 (schody) | 2 (schody bez zmian + pustka) |
| `slab-main-1` pełne / otwarte | 101,13 / 1,28 m² | 93,54 / 8,87 m² |
| Promienie przez pustkę | strop lity | **0 / 2808 trafień** |
| Promienie obok pustki | — | **0 / 965 pudeł** |
| Promienie przez otwór schodowy | 0 / 408 trafień | 0 / 408 trafień |
| Promienie obok otworu schodowego | 0 / 617 pudeł | 0 / 515 pudeł (pas częściowo leży teraz w pustce) |
| Strop parteru, strop garażu | 122,12 / 25,16 m², 0 otworów | bez zmian, 0 otworów |

Narysowane z powrotem na rzucie ARCHON (plansza główna): obrys pustki pokrywa się z szarym blokiem, a otwór schodowy
leży na schodach 8.

## Czego nie zmieniałem (zgodnie ze zleceniem)

- **Podział pomieszczeń.** Pokój poddasza `main-room-1-2` („Hol”) nadal obejmuje obszar pustki, bo `readInterior`
  połączył je wcześniej. Jego znacznik `ROOM_FLOOR` (półprzezroczysty, niestrukturalny) leży nad pustką na 7,02 m²,
  tak jak wcześniej leżał nad otworem schodowym (1,02 m²). Rozdzielenie to etap podziału pomieszczeń (4→8, 5→9),
  którego zgodnie z poleceniem nie zaczynałem.
- Dach, ściany, otwory, schody i garaż Arganiach: bajt w bajt. Zmieniła się wyłącznie kolekcja `slabs`.

## Regresja 8 domów

Wejścia: zapieczętowany dowód metryczny N8-03B.

| dom | wynik |
|---|---|
| A01, Goździkowce, Marcówki, Cieszynianka, Rarytasy 5, Trytomach, Sasanki 3 | **bajt w bajt** |
| Arganiach | zmieniona tylko kolekcja `slabs` (`slab-main-1` + pustka) |

- Czytnik pustek: w 7 domach nic nie odczytał i nic nie odrzucił. Brak regionu, który przeszedłby choćby wstępny
  próg powierzchni.
- Wszystkie 8 modeli: walidacja `ok`, **0 WALLS_OVERLAP**, 0 diagnostyk kompilatora, wszystkie otwory wycięte.
- Kosze Sasanek i Rarytasów (N8-03C), garaż Arganiach i jego brama (N8-03A), poprawione poddasza: modele bajt
  w bajt, więc niezmienione.
- Stropy pozostałych 7 domów: promienie przez otwory schodowe 0 trafień, obok 0 pudeł, brak nowych dziur.

Walidacji nie osłabiałem.

## Testy (tylko celowane)

- Nowy `reconstruction/test/slab-void-n8-03d1.test.ts` (7 testów, syntetyczny rzut 0,025 m/px). Sprawdza:
  - prostokąt z napisem: własne narożniki z dokładnością do piksela;
  - L: 6 narożników, powierzchnia L, nie prostokąta otaczającego;
  - odmowy z powodem: za mała plama, pas węższy niż 0,9 m, kreskowanie, nachodzenie na otwór schodowy, brak
    kondygnacji pod spodem;
  - ton płytek, tusz ścian i kolorowe wypełnienie nie są brane pod uwagę;
  - przez emiter, komendy i kompilator: model ważny, dwa otwory, krawędź dociągnięta do lica, promienie przez pustkę
    i schody bez trafień, obok i gdzie indziej trafiają, strop parteru i skrzydła lite, bez pustki strop jak dotąd.
- 13 plików / 130 testów powiązanych zielone: schody, poddasza, wnętrza, styk otwarty, ściana wspólna, kosze,
  przeszklenia.
- Cały pakiet `reconstruction`: 97 plików / 1181 testów zielone.
- `tsc` czysto.
- Dziennik: `artifacts/analyzer-n8-03d1/tests.txt`. Bez pełnego CI i bez APK, zgodnie ze zleceniem.

## Co jest nadal niepewne

- Krawędzie pustki: ± 1 px arkusza (0,027 m) plus rejestracja ramy kondygnacji. Głębokość z rzutu (3,66–3,69 m)
  a z przekroju (ok. 3,7 m) zgadzają się w granicach odczytu przekroju; przekrój nie był mierzony pikselowo.
- Znaczenie „pustka” wynika z wypełnienia, nie z napisu. Rzut, który rysowałby pustkę inaczej (kreskowaniem,
  przekątnymi, bez wypełnienia), nie zostanie odczytany i strop zostanie lity. Wolę przeoczenie niż wymyśloną dziurę.
- Balustrada wokół pustki nie jest odczytywana ani emitowana (nie była w zleceniu).
- Znacznik pokoju „Hol” nad pustką: następny etap (podział pomieszczeń).

## Materiały

- Prywatny ZIP `BuildPlan-N8-03D1-Arganiach-Void-Slab-Before-After.zip`. Zawiera:
  - modele przed i po;
  - 9 widoków review-shots przed i po (w tym bez dachu oraz z góry bez dachu);
  - zbliżenia stropu poddasza (z góry, 3/4, widok przez pustkę do salonu);
  - planszę ARCHON / PRZED / PO z obrysem pustki i otworu schodowego narysowanym na rzucie;
  - tabelę pomiarów;
  - oryginalne obrazy ARCHON, wyłącznie w ZIP-ie;
  - FIRST_BAD (ten raport) i regresję 8 domów.
- W repozytorium:
  - ten raport;
  - `stage-reports/artifacts/analyzer-n8-03d1/` (wyłącznie liczby i teksty);
  - sondy `research/analyzer-n8-03d1/void-probe.ts` i `slab-probe.ts`.

Zielone testy i „geometry ok” nie oznaczają, że strop jest poprawny. Ocena należy do recenzenta.
