# v3.54.4 — wspólny opis domu: krótki indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V3544.md`](SOURCE_TO_MODEL_V3544.md). Gałąź `claude/new-session-3kzcgh`, baza `0d4a057`.

## Wynik w pięciu zdaniach

1. Poprawna specyfikacja całego domu daje teraz poprawną geometrię zewnętrza: Gracja i Aksamitki z ręcznie
   sprawdzonych opisów budują się bez odmów, z wymiarami i rzędnymi zgodnymi ze źródłem (Gracja 16,82 × 10,12 m,
   kalenica +8,13; garaż, wykusz, obie lukarny ścienne).
2. API odczytuje taki opis ze źródeł w kontrolowanych krokach, a analizator go sprawdza, uzgadnia, buduje i kompiluje;
   LOCAL zostaje tam, gdzie jest poprawny.
3. Przyczyna wysokości Gracji: znak poziomu +8,13 odczytany jako +18,11 i przyjęty za wysokość kondygnacji; naprawione.
4. Zamrożone potwierdzenie na 8 nowych rodzinach (5 wydawców): **całe zewnętrze poprawione na 5 z 8 domów
   (4 wydawców, 4 domy spoza ARCHON), 0 regresji krytycznych** — próg spełniony.
5. **Wierne zewnętrze ma 1 dom z 8**: bryły, wymiary, wysokości i dachy przenoszą się (po 6/8), otwory (3/8)
   i lukarny (2/8) jeszcze nie; w 3 domach API opisało tylko jedną z czterech elewacji.

## Statusy

| status | wynik |
|---|---|
| IMPLEMENTATION_COMPLETE | tak |
| BUILDER_VERIFIED_IN_SCOPE | tak, w nazwanym zakresie (rozdz. 8) |
| HOST_INTEGRATION_VERIFIED | tak, lokalnie (42 kontrole, 3 zadania z żetonem + 1 bez) |
| QUALITY_GAIN | tak na DEV (opis przyjęty na 7 z 9 domów; LOCAL utrzymany na 2) |
| TRANSFER_EVIDENCE | potwierdzony wg zamrożonego kryterium: poprawione 5/8; wierne zewnętrze 1/8 |
| ANDROID_VERIFIED | nie (aplikacja bez zmian, bez nowego APK) |

## Liczby

- Koszt kampanii: 4,490274 USD, 95 zapytań; księga 14,453496 USD z pułapu 24,11036 USD.
- Testy: 25 nowych (wszystkie przechodzą); pełny zestaw: te same 16 niepowodzeń co na bazie, żadnego nowego.
- Odtworzenie z zapisanych odpowiedzi: te same skróty modelu i sceny na 9/9 domów DEV.

## Gdzie co jest

| co | gdzie |
|---|---|
| dokument domu (schemat, walidator) | `packages/reconstruction/src/house/document.ts` |
| uzgadniacz, budowniczy, wielokąty | `packages/reconstruction/src/house/{resolve,program,poly}.ts` |
| odczyt, konwersja, kontrola sceny, decyzja, host | `packages/analysis-service/src/house/{read,pictures,describe,review,build,measure,link}.ts` |
| poprawka LOCAL (wysokość) | `packages/reconstruction/src/v2/roof-datum.ts` (`levelDatumsAbovePublishedHeight`), solver 2.45.0 |
| testy | `packages/analysis-service/test/house-v3544.test.ts` |
| skrypty (budowa, przebieg, oceniacz, tabele, plansze, host E2E) | `research/source-to-model/v3544/` |
| ręczne specyfikacje (tylko test) | `research/source-to-model/v3544/manual/` |
| pakiety i referencje potwierdzenia | `research/source-to-model/v3544/{sources,refs-confirm}/` |
| protokół, pieczęć, tabele, wynik oceniacza | `stage-reports/artifacts/v3544/` |
| decyzja architektoniczna | `docs/adr/ADR-V3544-WHOLE-HOUSE-DESCRIPTION.md` |
| księga wydatków | `research/ai-assist/spend-ledger-v3544.json` |
| prywatny ZIP (plansze, obrazy wydawców, odpowiedzi API, modele, sceny) | poza Gitem — ścieżka w wiadomości końcowej |

## Trzy decyzje dla OWNER-a

1. Potwierdzić uzupełnienie brakujących elewacji na kolejnych 8 nowych rodzinach (ok. 1,6–2 USD) i dodać znaki
   poziomów do decyzji względem LOCAL (przypadek Oslo).
2. Rozszerzyć budowniczego o lukarny pulpitowe i pudełkowe oraz daszki skośne.
3. Pokazać dokument domu i decyzję w aplikacji (nowy APK).
