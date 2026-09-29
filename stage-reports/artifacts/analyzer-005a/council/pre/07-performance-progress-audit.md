# 07 — Performance and progress audit (Council E, with the orchestrator's measurements)

Sources: `reviewers/E-runtime-progress.md` (Council E, CPU profiles and replays in its own scratch),
`../../before/performance-before.json` and `../../before/*/analysis-trace.json` (the orchestrator's six
desktop runs), the OWNER's phone figures in the brief.

## 1. How "63 % · etap 3 z 9 · Czytam rysunki" arises

`progressAt(stage, fraction)` (`packages/analysis-service/src/stages.ts:69-75`) sums fixed stage weights
0.10 / 0.01 / 0.80 / … and scales only EXTRACTING_OBSERVATIONS by a fraction. The observation pass
reports `0.65 × index/total` per asset (`run.ts:243`); when the last drawing is read the bar sits at
`0.10 + 0.01 + 0.80 × 0.65 = 0.63` and `run.ts:257` reports once more at the same value with the
detail "reading printed dimensions and callouts". Then `run.ts:259-271` runs the raster decode loop and
ONE synchronous `extractMetricEvidence(...)` call, which emits nothing. The next event is
REGISTERING_VIEWS (0.91). The phone renders `analyzer_progress_stage` ("%d%% · etap %d z %d") and the
stage label, never `stage.detail`, never elapsed time, never a heartbeat (`AnalyzerScreen.kt:355-400`).

## 2. Where the time goes (desktop, Node 22, 4 cores)

| case | outcome | wall | fetch | observation pass | **silent metric pass** | solver (plan read → seal) | peak RSS | events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Marcówki | COMPLETED | 249 s | 2.4 s | 33 s | **193 s (78 %)** | 9 s | 1 890 MB | 37 |
| Kosaćce clean | COMPLETED | 315 s | 3.2 s | 122 s | **164 s (52 %)** | 9 s | 2 159 MB | 48 |
| Kosaćce tracked | COMPLETED | 317 s | 3.0 s | 123 s | **166 s (52 %)** | 9 s | 2 120 MB | 48 |
| Rarytasy e-OZE | PLAN_NO_WALLED_ENVELOPE | 307 s | 2.6 s | 133 s | **165 s (54 %)** | 0.3 s | 2 034 MB | 46 |
| Rarytasy 5 G2E | COMPLETED | 338 s | — | — | — | — | 2 114 MB | — |
| alternate Marcówki | PLAN_LAYOUT_REJECTED | 112 s | 0.4 s | 26 s | 77 s | 0.2 s | 1 146 MB | — |

Profiles (Council E): **93 % of the metric pass is plan frames**, and **97.5 % of one plan frame is
`readOpeningCallouts`** (digit template matching inside ≈ 90 rings per sheet: 1 181 `classifyDigit`,
1.53 M prototype lookups, 72 k renders — for 3 callout records). Dimension OCR proper (`readNumbers`) is
3 %. In the observation pass 75 % is `houghSegments`, called twice per asset; the second call feeds
`thinSegments`, whose only consumer is the plan stair reader (`plan.ts:222`), so it is wasted on 27 of
Kosaćce's 31 assets. The solver (plan read to sealed model) is 9–12 s: a bounded candidate search costs
seconds against a 165–193 s metric pass.

## 3. Memory

Decoded RGBA held by `rasterCache` is 2–8 % of peak RSS — not the problem. The callout reader's
`RenderCache` (`callouts.ts:472,944`, unbounded `Map<string, Float64Array>` per call) retains ≈ 600 MB
per plan frame and churns ≈ 1.8 GB of scratch typed arrays; one 853 px plan copy alone peaks at
1 372 MB RSS even with a 256 MB V8 heap (external ArrayBuffers). This reproduces the phone's 1.2–1.5 GB
single-plan-copy peaks: **the phone is one plan copy away from the low-memory killer.** The observation
pass also retains every asset's `Prepared` until it returns (+≈ 350 MB on Kosaćce).

## 4. Cancellation

`throwIfAborted` exists only at eight stage boundaries in `run.ts`. The phone's control pipe is read by
a socket handler that needs the event loop, so a cancel during the metric pass or the solver is never
seen by the program: the phone kills the process after 1.5 s and the trace is lost (`forcedStop`).
In acquisition a user abort is recorded as a fetch `TIMEOUT` and the asset loop drains every remaining
candidate (DNS lookups included). The fetch timer covers headers only; a stalled body is unbounded.

## 5. Can the phone tell slow from stuck? — No.

No event between 0.63 and 0.91 for 164–193 s desktop (3–6 min on the phone); no heartbeat; no
elapsed time; no liveness rule. A process that is computing and a process that is wedged look the same.

## 6. Decisions carried into the implementation decision

| # | change | class |
| --- | --- | --- |
| P1 | `AnalysisProgressEvent` with phase / sub-phase / exact counters / heartbeat sequence / elapsed; emitted by a write-only `Checkpoint.tick()` at loop boundaries (per asset, per frame, per callout ring, per OCR pass, per resolver candidate), throttled by a monotonic clock; never read back into a decision | results-identical |
| P2 | cooperative cancel inside `tick()` by a non-blocking read of the control pipe (`fs.readSync` on the program's control fd), so a cancel in the metric pass or the solver unwinds as CANCELLED with a trace instead of a kill | results-identical |
| P3 | local program protocol 2 → 3 (new `telemetry` event; `progress` unchanged); phone `LivenessTracker`: last activity, last meaningful progress, "Nadal analizuję — ten krok jest obliczeniowo ciężki." after 30 s of frozen counters, "Brak odpowiedzi analizatora od N s" after 45 s without any event | product |
| P4 | lazy `thinSegments` (only when a plan's stair reader asks) | results-identical, ≈ 35–40 % of the observation pass |
| P5 | bounded callout `RenderCache` (cleared per ring grid; scratch reuse) | results-identical, −0.6…1.2 GB peak per plan frame |
| P6 | per-phase performance record (`diagnostics/performance.json`, never hashed): wall, CPU, ticks, max tick gap, RSS start/peak/end, counters | results-identical |
| P7 | overall percent stays monotone and secondary; no ETA | product |
| — | demand-driven metric evidence (read further plan copies only when needed) | **deferred**: changes hashes and trades against the plan-copy candidates the resolver needs |
