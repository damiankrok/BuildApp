# v3.54.10 — kontrakt API, właściwe okna, spójne elewacje: indeks dla OWNER-a

Pełny raport: [`SOURCE_TO_MODEL_V35410.md`](SOURCE_TO_MODEL_V35410.md). Gałąź `claude/new-session-3kzcgh`; rewizje
`397a809` (kod; host jedynego joba live), `d43eebe` (poprawki stref z odczytu live), `62350cc` (**finalny host**) i
commit raportu. Hand-off: `research/source-to-model/v35410/HANDOFF.md`. ADR:
`docs/ADR-V35410-READING-CONTRACT-OPENINGS-ZONES.md`. Master Plan v3.54.10 (dołączony po raporcie, skopiowany
w całości): `docs/MASTER_PLAN.md`; uzgodnienie z D48–D51 i odbiorem §8 — raport rozdz. 16.

## W pięciu zdaniach

1. Jeden wersjonowany kontrakt odczytu (0.5.0): każda odpowiedź API jest walidowana lokalnie wobec schematu, z którym
   o nią pytano (także zagnieżdżona, także NON_STRICT i odtworzenia), surowa kopia zostaje obok znormalizowanej,
   identyfikatory otworów nie zależą od kolejności odpowiedzi — nagranie v3.54.9 odtworzone na nowym kodzie daje
   model bajt w bajt.
2. Nowe kroki: `DETAILS` (kontur otworu, część zasłonięta, słupki, strefy wykończenia, kominy) i `STOREY` (wnętrze
   i opisy otworów z rzutu każdej kondygnacji); opis 234/303 / 270/320 z rzutu wiązany z otworem tej ściany daje
   szerokość i wysokość `PRINTED`.
3. Live (1 job, 10 żądań, 0,508982 USD): wszystkie trzy skośne przeszklenia w tolerancji po raz pierwszy z odczytu API
   (tylne 2,34 × 6,09, kąty 39,98° / 38,72°), taras 2 skrzydła zamiast 5, 16 stref wykończenia, poddasze 8/9
   pomieszczeń źródła (było 6/9).
4. Nie wyszło: rama szczytowa przeczytana grubiej (0,98 vs 0,82 — percepcja), kominy 0/2 (widok boczny czyta je jako
   „inny element dachu”), rzut parteru niezarejestrowany (obrys brutto: 87,6 % < 90 %), więc opis tarasu 470/230 i
   wnętrze parteru z rzutu nie weszły; oddano LOCAL (27/27), opis H-PO 21/27.
5. Finalny host z `62350cc`: ALL CHECKS PASSED, ponowne użycie 0 USD, bez tokenu bez żądań; księgi 23,808382 z
   24,11036 USD — kolejny job tej wielkości się nie zmieści.

## Gdzie co jest

| co | gdzie |
|---|---|
| osiem odpowiedzi | raport rozdz. 1 |
| przepływ parametrów okien, tarasu, ramy, stref, wnętrza | raport rozdz. 3 |
| kontrakt, inwentarz zdolności | raport rozdz. 4; `research/source-to-model/v35410/results/reading-capabilities.md`; `packages/analysis-service/src/house/contract.ts` |
| okna przed → po | raport rozdz. 5; `results/marcowki-metric-v3.{json,txt}` |
| strefy wykończenia | raport rozdz. 6 |
| wnętrze z rzutów | raport rozdz. 7 |
| testy przyczyn i iniekcje | raport rozdz. 8; `packages/analysis-service/test/house-v35410.test.ts` (26) |
| regresja | raport rozdz. 9; `results/regression-v3549-vs-v35410.txt` |
| job live, koszty | raport rozdz. 10; `results/live-plan.md`; `research/ai-assist/spend-ledger-v35410.json` |
| host E2E | `results/host-397a809/` (job live), `results/host-62350cc/` (finalny) |
| recenzja | `results/marcowki-H-PO-{review,proposals}.json` |
| uzgodnienie z Master Planem v3.54.10 | raport rozdz. 16 |
| tablice (źródło | LOCAL | H-v3549 | H-nowy przed | H-PO | ODDANY; zbliżenia; ukośne; kondygnacje) | pakiet prywatny `BuildPlan-V35410-Private.zip` (`boards/`) |
