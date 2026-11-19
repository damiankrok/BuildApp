# v3.54.15 — hand-off

**State.** Branch `claude/new-session-3kzcgh`; final code `5d4321c` (host E2E and APK 1346 built from it; later commits
are documents). Report `stage-reports/SOURCE_TO_MODEL_V35415.md`; ADR `docs/ADR-V35415-RESPONSE-CONTRACT-LEVELS-CACHE.md`.
Ledger `research/ai-assist/spend-ledger-v35415.json`: 1.891759 USD of the 3.934654 pool; books 26.811717 of 28.854612.

**What works generally now.** One contract per observation class with a fate per element; levels the API reads on a
section reach the model through the drawing's own ladder (Ballina roof, Murcja storeys); ridge/eaves by role only; per-
property sketch verdicts; view registration never loses a view to a new datum; LOCAL shows the API only its own claims;
feet-inches parsed; prompt caching measured (−19 % on four sketches; cross-job reads on the host); per-fact trace.

**Open, named.** CEILING has no model field; sketch elements (chimney, balcony, railing) have no geometry consumer;
Ballina's left window and rear heights; Murcja's left side and the attic floor at the 2.80 convention; houses without
dimension lines (Coastal, Kardamon) build no model; sketches thinner than the OWNER's style, no glazing bars.
`presentation.test.ts` "donor coordinate 1.05" fails since `228f693` (RoofCover.kt), untouched here.

**Decisions to carry.** The metric read stays non-strict on the host (strict returned null dimension-line ends; n = 2
against 1 — re-measure before switching it on). A refused strict grammar sticks for the tool set on the transport.
A sill read within its view's ground error does not decide door or window.

**How to rerun at 0 USD.** `run.ts` with `--replay <turns.json>` and `--sketch-replay <sketch-turns.json> --sketch-map
<sketches.json>`; recorded answers live in the private ZIP (`runs/`). Live: `--live --sketch-live --strict
--prompt-cache 5m` (metric non-strict: omit `--strict` for the metric, as the host does).
