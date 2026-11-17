# v3.54.5 — kompletne elewacje, dokładne otwory, wybór modelu: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V3545.md`](SOURCE_TO_MODEL_V3545.md). Gałąź `claude/new-session-3kzcgh`; zamrożony kandydat
`627e4f1`, pieczęć `ce16267`; baza porównania: zamrożony kandydat v3.54.4 `3c531aee`.

## W pięciu zdaniach

1. Trzy wskazane słabości są naprawione w kodzie i sprawdzone na DEV: czytnik rozlicza każdą wysłaną elewację i dopytuje
   o brakujące (Lubczyk, Pallas, Wena: 4 z 4 zamiast 1 z 4), otwory nie są już po cichu zwężane (Dublin: tylne przeszklenie
   4,52 m zamiast 2,16 m), a wybór LOCAL/H używa znacznika z przekroju także bez wysokości na stronie (Oslo: LOCAL 16,79 m
   odrzucony).
2. Zamrożona próba na 8 nowych rodzinach (6 wydawców) dała **2 domy poprawione** (Anodach, Alaska) i **1 regresję
   krytyczną** (Pliszka: dach) — **próg kampanii nie jest spełniony**; wynik zostaje za flagą pilota.
3. Na tych samych 8 domach nowy opis ma więcej opisanych i zarejestrowanych stron (28/21 wobec 22/10) i dwa razy więcej
   poprawnych otworów (28 wobec 13), ale też więcej fałszywych (15 wobec 1).
4. Przyczyny porażki są nazwane: wybór nie sprawdza LOCAL z elewacjami (Pliszka), rejestr nie widzi elewacji bez etykiety
   odciętych limitem obrazów (Mirabelka), odczyt na nowych domach dodaje fałszywe otwory.
5. Finalny host z `627e4f1` przeszedł E2E: Oslo i Wena (opis zastępuje LOCAL), Frizea (LOCAL zostaje), zadanie bez tokena
   (0 USD).

## Statusy

| status | wynik |
|---|---|
| IMPLEMENTATION_COMPLETE | tak |
| FACADE_COVERAGE_VERIFIED | częściowo (DEV tak; nowe domy 28/32, 1 dom źle zaraportowany) |
| OPENING_GEOMETRY_VERIFIED | tak w zakresie DEV; na nowych domach częściowo (fałszywe otwory) |
| SELECTION_VERIFIED | tak dla wysokości; nie w całości (Pliszka) |
| HOST_INTEGRATION_VERIFIED | tak (build `627e4f1`, 4 zadania, wszystkie kontrole) |
| TRANSFER_EVIDENCE | **nie** (2/8, 1 regresja krytyczna) |
| ANDROID_VERIFIED | nie (aplikacja bez zmian, bez APK) |

## Liczby

- Koszt kampanii: 4,822834 USD, 113 zapytań; księga 19,27633 z 24,11036 USD. Nowy dom: ok. 0,17 USD i 1,5 min.
- Testy: 65 testów domu (25 + 40 nowych) zielone; pełny zestaw — te same 16 niepowodzeń co w bazie + 1 limit czasu pod
  obciążeniem (osobno zielony).
- Odtworzenie: 9 z 9 domów DEV daje te same modele.

## Gdzie co jest

| co | gdzie |
|---|---|
| dokument domu 0.2.0 (rejestr widoków, rekordy otworów, statusy) | `packages/reconstruction/src/house/document.ts` |
| uzgadniacz (jedna strona = jeden obraz, ±0,00 z kotwic, skrzydła jednego otworu, kontrola kalenicy) | `packages/reconstruction/src/house/resolve.ts` |
| builder (`fitOpening`, `OPENING_FIT`) | `packages/reconstruction/src/house/program.ts` |
| czytnik (dopytania celowane, narzędzie jednej elewacji, zapas gramatyki) | `packages/analysis-service/src/house/read.ts` |
| decyzja, rejestr po budowie, fakty rzutu dla elewacji | `packages/analysis-service/src/house/describe.ts` |
| transakcje korekt | `packages/analysis-service/src/house/review.ts` |
| pomiar dziur w scenie | `packages/analysis-service/src/house/measure.ts` |
| dopasowanie do rdzenia ściany z kernela | `packages/analysis-service/src/house/build.ts` |
| host (zastąpiony LOCAL) | `apps/analyzer-api/src/{executor,store,http}.ts` |
| testy | `packages/analysis-service/test/house-v3545.test.ts` |
| oceniacz, reguła porównania, referencje, skrypty | `research/source-to-model/v3545/` |
| protokół, pieczęć, wybór domów | `stage-reports/artifacts/v3545/` |
| prywatny ZIP (plansze, obrazy wydawców, odpowiedzi API, modele) | poza Gitem — ścieżka w wiadomości końcowej |

## Decyzje dla OWNER-a

1. Czy rozszerzyć wybór LOCAL/H o zarejestrowane elewacje jako fakt dla obu kandydatów (forma dachu, otwory na stronę) —
   to bezpośrednia przyczyna jedynej regresji.
2. Czy poprawić inwentarz i rejestr dla stron z elewacjami bez etykiety (Extradom) i zaostrzyć kontrolę fałszywych otworów,
   a potem powtórzyć próbę na kolejnych 8 nowych rodzinach (ok. 3 USD; w puli zostaje 4,83 USD).
