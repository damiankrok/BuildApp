# BUILDPLAN ARCHON VISUAL REVIEW 1311 — osiem domów, aktualne modele 3D

| pole | wartość |
|---|---|
| gałąź | `claude/new-session-3kzcgh` |
| baza | `a58ee8b` (N7-PATCH-04A) |
| solver | `SOLVER_V2_VERSION = "2.9.0"` (bez zmian) |
| APK | nie budowany (1311 bez zmian) |
| ZIP | `BuildPlan-ARCHON-Visual-Review-1311.zip`, 65 296 336 B, SHA-256 `6587ec193ad389b4a0f3ea9c4f77994fe887511a8a6d6961ff17897a945fab4a`, 334 wpisy; przekazany bezpośrednio, poza Git (zawiera obrazy ARCHON w `SOURCE-REFERENCE/`) |

## Metoda

1. Zapieczętowane wejścia regresji FIX-04 / PATCH-04A (source-package, observation-graph,
   metric-evidence) odtworzone offline przez `packages/analysis-service/scripts/second-house.ts`.
2. Werdykt kompletności: `research/analyzer-n7-fix03/probe-house.ts` na tych samych wejściach.
3. Rendery: `apps/web/tools/review-shots.ts` na produkcyjnym buildzie BuildWorld, styl
   `architectural`, płótno 840×813, ortho ΔY = −540 (×1,3191) dla wszystkich domów.
   Adapter badawczy w tym narzędziu (jedyna zmiana kodu): `--model-files id=path` ładuje
   `model.json` przyciskiem Load JSON; `--top-roof-off` dodaje `09-top-roof-off.png`;
   `--chromium`, `--viewport`, `--ortho-dy`. Widok 3D, solver i SourcePackage bez zmian.
   Cieszynianka: osobny bieg w oknie 1400×929 — jej nazwa zawija pasek narzędzi do trzeciego
   wiersza (płótno 840×784 w oknie 1400×900); w wyższym oknie płótno, kamery i skala są te same.

## Wynik

| dom (katalog) | projekt ARCHON | id | model.json SHA-256 | = FIX-04 | werdykt |
|---|---|---|---|---|---|
| 01-A01 | Dom w jarzmiankach | m60124f28f071a | `d095c0da90b69a49…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |
| 02-Goździkowce | Dom w goździkowcach 3 | m79923e950094d | `1a96c20f088efaad…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |
| 03-Marcówki | Dom w marcówkach (GE) | m2fa281446a8ca | `8541ca10d0534107…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |
| 04-Cieszynianka | Dom w cieszyniankach 12 (GE) | m43d25c0636969 | `5394c17c4ff1c4e5…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |
| 05-Rarytasy | Dom w rarytasach 5 (G2E) | m84f2903cb8e14 | `73969751a434e0f6…` | tak | COMPLETE |
| 06-Trytomach | Dom w trytomach (G) | m6802645623649 | `d2bf0c031d4733d3…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |
| 07-Arganiach | Dom w arganiach (G2E) | m32b290f26a4e8 | `34a95a766d169f39…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |
| 08-Sasanki-3 | Dom w sasankach 3 (G) | mb292397cb1840 | `090749f43fa6b741…` | tak | COMPLETE_WITH_OPEN_QUESTIONS |

Wszystkie osiem z ARCHON, wersje standardowe (bez odbicia lustrzanego). 8 × 9 zrzutów, żaden
pusty; cztery elewacje każdego domu to cztery różne obrazy.

## Zauważone przy przeglądzie (niepoprawione, zapisane w `diagnostics.json`)

- Sasanki 3: dach dwuspadowy równoległy do frontu zamiast szczytu frontowego z dachem bocznym;
  brak bramy garażowej; kompilator BuildWorld: 4 × `OPENING_ABOVE_WALL_TOP` (ściany pierścienia
  piętra 0,099 m), 4 otwory niewycięte.
- Trytomach: dach na 13 m, piętro na 7,24 m — otwarty szczyt nad częścią parterową; brak kominów.
- Arganiach: brak poddasza (NO_MASS_REACHES_UP); pas okien zamiast bramy garażowej; brak kominów.
- Marcówki: 1,79 m niewyjaśnionej ściany przed garażem (jak w PATCH-04A).
- Cieszynianka: dach z czterech `roofPlanes` (`roofs` puste); kąt z opisu (ROOF_EVIDENCE_DISAGREES).
- Rarytasy: płyta na gruncie w narożniku przód-prawo — do sprawdzenia z rzutem.

Przegląd wzrokowy, nie pomiar. Zgodność przodu modelu z „elewacją frontową” ARCHON nie jest
potwierdzana; strony boczne ARCHON są nierozróżnione („elewacja boczna”) i nie były zgadywane.

## Kontrole

`tsc` na `apps/web/tools/review-shots.ts`: czysto. Pełnego CI nie uruchamiano (zgodnie z poleceniem).
