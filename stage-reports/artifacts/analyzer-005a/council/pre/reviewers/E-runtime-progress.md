# Council E — Runtime / Performance / Progress — pre-audit report (BUILDPLAN-ANALYZER-005A)

Repo `/home/user/BuildApp` @ `7cd8e0c` (read-only). Every `path:line` below was read in code. Numbers are labelled
**[artifact]** (read from the desktop run artifacts), **[replay]** (my own read-only measurement, scripts in
`scratchpad/prof/`, bundled with esbuild into the scratchpad, nothing written to either repo), **[code]** (constant or control
flow read in source) or **[inference]** (stated as such). Replay environment: this sandbox VM, x86-64, Node 22, 4 cores; the
desktop production runs of the brief were executed two at a time, so my isolated per-frame replays are ~18 % faster
(Marcówki: replay 158.8 s vs production 193.1 s for the same pass).

---------------------------------------------------------------------------------------------------------------------------

## 1. Role question answered

### 1.1 Proof: how `63% · etap 3 z 9 · Czytam rysunki` arises

`packages/analysis-service/src/stages.ts:53-66` `STAGE_WEIGHTS`: ACQUIRING_SOURCE 0.10, CLASSIFYING_SOURCES 0.01,
EXTRACTING_OBSERVATIONS **0.80**, REGISTERING_VIEWS 0.01, SOLVING_TOPOLOGY 0.01, SOLVING_METRICS 0.02, BUILDING_MODEL 0.01,
COMPILING_SCENE 0.01, VERIFYING 0.03 (sum 1.00, checked). `progressAt` (`stages.ts:69-75`) = Σ weights of earlier stages + weight × fraction.
For stage index 2 (EXTRACTING_OBSERVATIONS) the earlier stages weigh 0.10 + 0.01 = 0.11, and the pipeline reports fraction **0.65**
in two places:

* `run.ts:243` `onAsset: (index,total) => report('EXTRACTING_OBSERVATIONS', 0.65*index/total …)` — the last call, `index === total`, gives exactly 0.65 (`analyze.ts:212`);
* `run.ts:257` `report('EXTRACTING_OBSERVATIONS', 0.65, 'reading printed dimensions and callouts')`.

`0.11 + 0.80 × 0.65 = 0.63` (checked: `Number((0.63).toFixed(4))`). The drawing loop itself never gets above 61 % (`index 30 of 31 → 0.6132`).
The phone shows it as: headline `AnalysisStages.DEFAULT_LABELS["EXTRACTING_OBSERVATIONS"]` = "Czytam rysunki" (`AnalysisStages.kt:40`), bar = `status.progress`
(`AnalyzerScreen.kt:365-366`), text `analyzer_progress_stage` = "%1$d%% · etap %2$d z %3$d" (`strings.xml:365`) filled with
`percent=63`, `stage.index+1 = 3`, `stage.count = 9` (`AnalyzerScreen.kt:387`). The PROGRESS stream of every desktop run shows two consecutive `63%` lines
(`before/*.err`, e.g. Kosaćce: `63% EXTRACTING_OBSERVATIONS` then `63% … — reading printed dimensions and callouts`, then the next line is `91% REGISTERING_VIEWS`).

**The phone hides the only text that would help**: `CurrentStage.detail` ("drawing 3 of 20", "12 addresses fetched", "reading printed
dimensions and callouts") is parsed (`LocalEvents.kt:96`, `LocalAnalysis.kt:408`) and **never rendered** — `AnalyzerScreen.kt` has no reference to
`stage.detail`; there is no elapsed time, no heartbeat, no `lastActivity`, no stall rule anywhere in `apps/android/.../*.kt`
(`grep -rn "lastActivity\|stalled\|heartbeat"` finds nothing). The only cue is the static note `analyzer_running_note_local`
("Analiza na telefonie trwa kilka minut…", `strings.xml:336`). The phone also has **no wall-clock limit** (no timeout/deadline in `analyzer/local/*.kt`,
`AnalyzerViewModel.kt`); only the HTTP service has one (`config.ts:48` 15 min).

### 1.2 What runs synchronously during the 63 % plateau, with no event

After the event at `run.ts:257` the thread executes, in order:

1. `run.ts:259-268` — per asset: `await bytesFor` (real `fs.readFile`, so the loop does turn here) then **`decodeImage` (sync, full RGBA decode) for every asset**, renders and `UNKNOWN`/chrome included. [replay] 6–258 ms per frame, Marcówki total 1.6 s.
2. `run.ts:269` `identityOf`.
3. **`run.ts:271` `extractMetricEvidence` — one synchronous call, no `await`, no `signal`, no callback** (`extract.ts:269-675`). Its frame loop is `extract.ts:281-626`; per orthographic frame:
   `readNumbers` (`extract.ts:291` → `ocr.ts:895`: three orientation passes over the full-resolution raster, each `adaptiveInkMask` + `connectedComponents`, `ocr.ts:929,934`),
   `adaptiveInkMask(inkChannel(raster))` again (`extract.ts:300`), `findStraightRuns/findDimensionLines/chainsFromLines/solveFrameChains`,
   datum/angle association, and **`readOpeningCallouts` (`extract.ts:453` → `callouts.ts:903`)** — ring search, then per ring two `readHalf`, per cell `classifyDigit`
   (template matching over 11 prototypes × 3 slants × 3×3 offsets × 3 scales, `callouts.ts:423-424,569-590`), then cross-frame registrations.
4. `reconstruct-v2.ts:148` `options.onPhase?.('REGISTRATION')` is the very first statement of `reconstructV2`, so the `91%` event fires the moment step 3 returns.

Before that, between the two 63 % events there is a small silent gap: `relateAcrossViews` + `builder.seal()` (`analyze.ts:215-226`) [replay] 0.34 s on Kosaćce.

### 1.3 Silent intervals measured from the trace [artifact]

The silent interval is exactly `METRIC_EVIDENCE.durationMs` (trace entry = decode loop + `extractMetricEvidence`, `run.ts:274-275`; the entry starts where `OBSERVATIONS` ended, which is where the second 63 % event is emitted).

| run (desktop, Node 22) | silent @63 % (s) | share of trace wall | obs pass (s) | tail after silence (s) | peak RSS MB | longest other silent substage |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Marcówki | **193.1** | 81 % of 239.1 s | 33.4 | 10.3 | 1890 | METRICS 4.9 s |
| Kosaćce clean | **164.4** | 55 % of 298.7 s | 122.0 | 9.1 | 2159 | METRICS 5.8 s |
| Kosaćce tracked | **165.8** | 55 % of 300.6 s | 123.0 | 8.9 | 2120 | METRICS 5.6 s |
| Rarytasy e-OZE | **165.3** | 55 % of 300.9 s | 132.7 | 0.3 (fails at PLAN_DECOMPOSITION after paying 100 % of the pass) | 2034 | PLAN_READ 0.3 s |
| Rarytasy 5 G2E | **166.9** | 52 % of 323.9 s | 126.1 | 12.1 | 2114 | METRICS 9.1 s |
| alt-Marcówki | 76.7 | 71 % of 107.5 s | 25.1 | 0.3 (fails) | 1146 | PLAN_READ 0.3 s |

Consequences: (a) the bar reaches 63 % after 14–44 % of the elapsed time and then sits for 52–81 % of the wall clock, then jumps **63 → 91 % (28 points) in one event**;
the weights (`stages.ts:9-12` "measured on a real 20-asset project") do not describe any of the six runs: measured shares are acquisition 1–6 %,
observation pass 14–44 %, metric pass 49–81 %, everything from registration to verification 3–5 %. (b) Silence also exists inside the observation stage:
[replay, Kosaćce] per-asset 0.25–8.3 s (mean 2.9 s), so an event is at most 8.3 s apart on this desktop. (c) The solver tail is silent between phase events by ≤ 9.1 s (METRICS).
(d) Acquisition emits **nothing** after `1 %`: `onRoute` raises the bar to 0.10 × 0.10 = 1 % (`run.ts:179`, fired at `acquire.ts:95` before discovery and the asset loop), and every later per-fetch report is `report('ACQUIRING_SOURCE', 0, "N addresses fetched")` with fraction 0 (`run.ts:181-184`),
which the monotone filter drops (`run.ts:151`, `0 < 0.01`). The phone therefore sees `0 %`, `1 %`, then `10 %` (CLASSIFYING) around the whole asset download (`fetchMs` 2.4–18.8 s on the desktop; a phone link is slower and sequential). The total (`budget.length`, `acquire.ts:120`) is known but never reported, and the phone would not render `detail` anyway.
**The phone's own silent interval is not in my evidence**: it is `METRIC_EVIDENCE.durationMs` in the OWNER's `trace.json` (`program.ts:314,325,334` write it); `failed` events carry
no `timings` (`program.ts:311,335` → `metrics()`), so the phone's `LocalRunReport.timings` is empty for exactly the failing runs. **[inference]** with one 853 px plan copy instead of four the desktop metric pass would be
~35–45 s, yet the phone reported 3 m 08 s (Kosaćce tracked) and 6 m 20 s (e-OZE), so the phone is roughly 2× slower than this VM — read the real number from the trace.

### 1.4 Where the time really goes [replay + CPU profiles]

**Metric pass, Marcówki, per-frame `extractMetricEvidence` calls** (`scratchpad/prof/metric-marcowki.json`; sum 158.8 s):

| frames | wall | note |
| --- | ---: | --- |
| 8 × FLOOR_PLAN (550 px ×2, 400 px ×2, 853 px ×4) | **147.9 s (93.1 %)** | 20.9 / 10.8 / 11.0 / 12.8 / 26.7 / 24.4 / 22.0 / 19.4 s |
| 1 × SITE_PLAN 734×854 | 8.4 s (5.3 %) | admitted by `DEFAULT_FRAME_FILTER` (`extract.ts:74`, projection-based) although its comment says site plans carry no printed measurement |
| 4 × ELEVATION + 1 × SECTION | 2.4 s (1.5 %) | 0.34–0.67 s each |
| `readNumbers` (OCR proper, all frames) | 5.0 s (3.2 %) | 0.09–0.70 s per frame; called once per frame (`extract.ts:291` is its only call site in `packages/*/src`) |
| `adaptiveInkMask(inkChannel)` per frame | 0.55 s total (0.35 %) | 7–72 ms per frame |
| decode | 1.6 s total | |

**CPU profile of one 550×550 plan frame** (22.2 s, `--cpu-prof`): `readOpeningCallouts` inclusive **21.7 s (97.5 %)** → `readHalf` 18.8 → `classifyDigit` 18.3 → `renderPrototype` 13.0 (self 11.4);
`readNumbers` 0.35 s; `findRings` 2.7 s. Counters [replay, instrumented copy of the bundle]: 94 rings found, 87 kept, 174 `readHalf`, 1 181 `classifyDigit` (mean 13 ms), 1 530 576 prototype lookups of which
72 475 renders (4.7 % miss), and **3** `OPENING_CALLOUT` evidence records in the end (`metric-evidence.json`: 3 on that frame). So ~97 % of the metric pass is spent template-matching digits inside rings that overwhelmingly are not callouts.
Per-frame cost is independent of legibility: a 400 px copy costs 11–13 s, a 550 px copy 11–21 s, an 853 px copy 19–27 s.

**Observation pass, Kosaćce clean, per asset** (`scratchpad/prof/obs-kosacce-clean.json`, 99.0 s; production 122 s): 19 PERSPECTIVE_RENDER assets = **78.4 s (79.5 %)**, 4 ELEVATION 12.5 s, 4 FLOOR_PLAN 4.8 s (4.8 %), SITE_PLAN 2.0 s.
CPU profile of the whole pass (90.2 s): **`houghSegments` self 67.5 s (74.8 %)**, decode 5.3 s, GC 1.9 s, `extractElevation` 6.6 s, `extractPlan` 1.6 s. `prepareFromRaster` calls Hough **twice per asset**
(`prepare.ts:102` on the edge mask → `allSegments`; `prepare.ts:116` on the ink mask, inside `thin` → `thinSegments`). Micro-benchmark per asset [replay]: 1600×1066 render edges 1.67 s + ink **2.15 s**; 1280×631 elevation 0.68 + **0.95**; 800×600 render 1.08 + **1.13**;
550 plan 0.24 + 0.17. The second call is 51–58 % of Hough time on non-plan assets. **`thinSegments` has exactly one consumer in the whole repo: `extractors/plan.ts:222` (`readStair`)**
(grep over `packages apps tests`; the other hits are stair unit tests calling `readStair` directly). 27 of Kosaćce's 31 assets are not floor plans.

**Solver tail is cheap** [artifact]: PLAN_READ 0.27–0.78 s, TOPOLOGY 0.8–1.2 s, METRICS 4.9–9.1 s, BUILDING_MODEL 0.5–1.0 s, COMPILE 0.09–0.19 s, VERIFY 0.2–1.9 s; total 8.9–12.1 s = 3–5 % of a run. Layout-only re-reads cost ~0.7 s per plan copy. A 5-hypothesis resolver at solver level would cost ≈ 45–60 s, i.e. < ⅓ of the metric pass the pipeline already pays.

### 1.5 Memory (Q2)

Decoded RGBA held by `rasterCache` (`run.ts:160,259-268`: every asset's selected variant, decoded once more than `analyze` did) from `source-package.json` (w×h×4 bytes) [artifact]:

| run | assets | RGBA held (MiB) | of which orthographic frames the metric pass reads | perspective renders (not read by the metric pass; used by the camera solve, `reconstruct-v2.ts:898-899`) | peak RSS desktop | RGBA / peak |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Marcówki | 20 | 42.6 | 32.4 | 4.2 | 1890 MB | 2.3 % |
| Kosaćce (clean = tracked) | 31 | 109.7 | 25.7 | 78.0 | 2159 / 2120 MB | 5.1 % |
| e-OZE | 38 | 157.2 | 25.8 | 114.5 (+16.9 `UNKNOWN`) | 2034 MB | 7.7 % |
| e-OZE 5 G2E | 37 | 141.6 | 23.4 | 112.3 | 2114 MB | 6.7 % |
| alt-Marcówki | 14 | 22.4 | 7.7 | 14.6 | 1146 MB | 2.0 % |

Against the phone's 1.2–1.5 GB the largest set (157 MiB) is ≤ 13 %. **`rasterCache` is not the memory problem.** What is:

1. **The callout digit classifier's `RenderCache`** (`callouts.ts:472,944`, `Map<string, Float64Array>` created per `readOpeningCallouts` call, unbounded). On the 550 px plan the cache ends with ~72.5 k entries × ~8.2 KB ≈ **597 MB retained** and the renders allocate a further ~1.8 GB of scratch `Float64Array`s
   (allocation sampling: 2.46 GB of typed arrays in 16.7 s; `renderPrototype` allocates `out`,`tmp`,`soft` + `normalised` per miss). **A single 853 px plan copy in a fresh process peaks at 1 372 MB RSS (30.8 s), and 1 379 MB with `--max-old-space-size=256`** — it lives in external ArrayBuffers, not in the V8 heap
   (baseline after the elevations ≈ 175 MB; whole-run sequence reaches `arrayBuffers` 1 089 MB). The OWNER's phone peaks (1 197 MB Kosaćce tracked, ~1 500 MB e-OZE) are runs with **one** 853 px plan copy: this mechanism reproduces them. **[inference]** Android's low-memory killer is therefore one plan-copy away (`RUNTIME_STOPPED`, `LocalAnalysis.kt:232`).
2. **Observation pass retains `Prepared` for every asset until `analyzeSourcePackage` returns** (`analyze.ts:147,210`; `run.ts` uses only `analysis.graph` and the vision counts). [replay, Kosaćce] RSS 132 → 480 MB and `arrayBuffers` 5 → 215 MB across 31 assets.

Repeated decodes / masks / OCR (the brief's suspicion), measured: `probeImage` in acquire is header-only (`acquire.ts:136`, no pixel decode) + `sha256Bytes`; **full decodes: `prepareRaster` (`analyze.ts:126`) and `decodeImage` (`run.ts:264`)** = 2 per asset (≈ 1.6 s total on Marcówki);
per plan frame 7 `adaptiveInkMask` (`prepare.ts:97`, `ocr.ts:929` ×3 orientations, `extract.ts:300`, `callouts.ts:908`, `layout.ts:205`) and ~5 `inkChannel` (`ocr.ts:896`, `extract.ts:300`, `callouts.ts:907`, `layout.ts:205`, `prepare.ts:87`) at 7–72 ms each = 0.55 s per project. **OCR proper runs once per frame.** None of these is a lever (< 4 % of the pass together); the levers are §1.4 items.

### 1.6 Cancellation (Q3)

`throwIfAborted` call sites (grep over `packages/*/src`, `apps/*/src`): **only `run.ts:165,191,220,224,254,273,301,320`**. `224` is inside `bytesFor`, which `analyzeSourcePackage` calls once per asset (`analyze.ts:117`) and the decode loop once per asset (`run.ts:261`).
There is none in `analyze.ts`, `extract.ts`, `ocr.ts`, `callouts.ts`, `reconstruct-v2.ts`, `acquire.ts`, and none after `verifyReplay`/`loadBundle`/`geometryClosureAudit` (`run.ts:326-345`). Fetches are cancellable only through `cancellableDeps` (`run.ts:121-129`).

* **Cancel during the metric pass or the solver is not honoured by the program at all.** The control pipe is read by a `net.Socket` `'data'` handler (`program.ts:205-220`), which needs the event loop; `extractMetricEvidence` and `reconstructV2` are synchronous, so the bytes sit in the pipe and `controller.abort()` is never called. The program's own header says so (`program.ts:17-20`).
  The phone therefore always ends these cancels by force: `LocalAnalysis.cancel` (`LocalAnalysis.kt:109-123`) writes `cancel\n` (`LocalAnalyzerService.kt:135-145`) and, after `CANCEL_GRACE_MS = 1 500` (`LocalAnalysis.kt:343`), `finish(Ending.Cancelled)` → `handle.terminate()` → `Process.killProcess` (`LocalAnalyzerService.kt:158-160`); the Kotlin test `a cancel the program cannot answer (it is computing)…` (`LocalAnalysisTest.kt:393-407`) encodes exactly the 63 % scenario.
  User-visible latency ≈ 1.5 s + process-gone notification (≤ 3 s fallback, `PROCESS_GONE_WAIT_MS`). **What is lost**: no `cancelled` event, no trace (`forcedStop = true`), no record of where it was cancelled beyond the last progress event.
* **Observation pass**: honoured at the next asset boundary (`bytesFor` → fs read turns the loop, then `throwIfAborted`). [replay] With per-asset durations 0.25–8.3 s (mean 2.9 s) the chance a cancel is honoured within the 1.5 s grace is **≈ 44 %**; otherwise the kill does it.
* **Acquisition**: an in-flight fetch aborts (combined signal), but (i) `safeFetch` maps *any* `AbortError` to `FetchRefused('TIMEOUT', "timed out after 20000 ms")` (`net.ts:294`) — a user cancel is recorded as a timeout; (ii) `fetchBytes` swallows it into `failures` (`acquire.ts:370-373`) and **the asset loop continues** (`acquire.ts:128-162` has no signal check): every remaining candidate does `cache.get`, then `assertFetchable` → a real `dns.lookup` (not abortable) → an instantly-aborted fetch, up to the 120-asset budget; only after the loop does `run.ts:191` throw.
  The existing test (`program.test.ts:137-159`) asserts the outcome (exit 2, one `cancelled`, trace ends `CANCELLED`), not the time taken or the number of post-abort lookups, so it does not see this drain. (iii) The 20 s timer covers headers only: `clearTimeout(timer)` at `net.ts:297` precedes `readCapped` (`net.ts:323-347`), so a stalled body is bounded only by undici's own default body timeout (300 s, **[inference]** not verified on nodejs-mobile 18.20.4), sequentially over up to 120 assets.
* **What a cancelled job releases.** Cooperative path (only reachable between stages): `runLocalAnalysis` `finally` removes `workDir/bytes` (`local.ts:76-79`), `stopListening()` destroys the socket (`program.ts:338`), a `cancelled` event with `trace.json` is written (`program.ts:329-333`), then the process is ended. Forced path: the kernel frees everything with the process; `jobs.finish(job)` removes the job folder (`LocalAnalysis.kt:263`, retried at next start if it fails).
  API (`executor.ts:56-126`): the production `WorkerExecutor` calls `worker.terminate()` at once (`executor.ts:104`) and the runner clears the workspace (`runner.ts:131`) — a precedent in this repo for "compute in a thread that can be killed". `InProcessExecutor` (tests/dev) releases the job logically but the computation keeps running to its next checkpoint (up to 193 s) holding its memory.
* Tests: cancel is tested only during acquisition (`program.test.ts:137-174`, `local.test.ts:68`); nothing tests cancel in OCR, callouts, the solver or reconstruction, and nothing could pass today because the checkpoint does not exist.

### 1.7 DESIGN: true progress telemetry (§19–§23)

**Principle.** Progress is *what the code just did*, measured by counters the loops already hold; the overall percent is a secondary, documented, monotone summary and is never a claim about time. No ETA anywhere.

**(a) Types — new leaf module `packages/source-common/src/progress.ts`** (every analyzer package already depends on `source-common`; `source-metrics` stays browser-safe; nothing here imports Node).

```ts
export type ProgressUnit = 'ADDRESS' | 'ASSET' | 'FRAME' | 'TOKEN_GROUP' | 'RING' | 'CELL' | 'BAND' | 'CANDIDATE' | 'STEP'
/** Closed registry (analysis-service/src/phases.ts): id → { stage, englishLabel, unit }. Polish text lives in the app, keyed by id. */
export type PhaseId =
  | 'ACQUIRE_PAGE' | 'ACQUIRE_ASSETS' | 'CLASSIFY'
  | 'OBSERVE_ASSET' | 'DECODE_RASTERS' | 'METRICS_FRAME'
  | 'PLAN_READ' | 'PLAN_DECOMPOSE' | 'LAYOUT' | 'REGISTER' | 'TOPOLOGY' | 'METRICS_SOLVE' | 'MODEL' | 'COMPILE' | 'VERIFY'

export type AnalysisProgressEvent = {
  kind: 'PHASE_START' | 'PHASE_END' | 'HEARTBEAT'
  // where (closed vocabularies, stable across versions; `stage` keeps protocol-2 consumers alive)
  stage: AnalysisStage; stageIndex: number; stageCount: number
  phaseId: PhaseId; phaseLabel: string                 // English fallback
  subphaseId?: string; subphaseLabel?: string          // e.g. 'CALLOUT_RINGS', 'GLYPH_CLASSIFY', 'HOUGH_EDGES'
  // what the thread is doing: COMPUTE (a tick from a loop) | IO_WAIT (timer heartbeat while awaiting network/disk)
  activity: 'COMPUTE' | 'IO_WAIT'
  // exact work accounting (counts, never guesses); workTotal null = not known yet
  workDone: number; workTotal: number | null; unit: ProgressUnit
  assetIndex?: number; assetTotal?: number             // 1-based, the frame/asset in hand
  candidateIndex?: number; candidateTotal?: number     // 1-based, for bounded candidate searches (resolver)
  // liveness
  heartbeatSeq: number                                 // +1 on every emission of any kind; a hole = a dropped line
  elapsedMs: number; phaseElapsedMs: number            // monotonic clock; never hashed
  timestamp: string                                    // ISO, display only
  message?: string                                     // ≤ 120 chars; no paths, URLs or page text (same rule as `detail`)
  diagnosticCounters?: Record<string, number>          // small closed set per phase: { rings: 87, ringsRead: 41, tokens: 312, chains: 81, bands: 45 }
  // secondary summary
  overall: { fraction: number; basis: 'COST_MODEL_V1' | 'COUNTS_ONLY' }   // monotone, 0..1, see (e)
}

export interface Checkpoint {
  phase(id: PhaseId, o?: { unit: ProgressUnit; total?: number; subphase?: { id: string; label: string } }): void
  /** Call at loop boundaries. One clock read when nothing is due. Returns nothing, and only ever throws AbortError. */
  tick(w?: { done?: number; total?: number; assetIndex?: number; assetTotal?: number; candidateIndex?: number; candidateTotal?: number; counters?: Record<string, number> }): void
  end(): void
}
export const NO_CHECKPOINT: Checkpoint   // default; every option is `checkpoint?: Checkpoint`, so no caller changes and no test changes
```

`createCheckpoint({ clock, signal, pollCancel, emit, heartbeatMs = 1000, checkMs = 200 })` in `analysis-service` (`checkpoint.ts`):

```ts
tick(w) {
  if (w) merge(w)                                     // plain assignments to the current phase record
  const now = clock()
  if (now < this.nextCheck) return                    // hot path: one comparison
  this.nextCheck = now + checkMs
  if (signal?.aborted || pollCancel?.()) throw abortErrorOf(signal)      // cancel, ≤ every 200 ms
  if (now - this.lastEmit >= heartbeatMs) this.emit('HEARTBEAT', now)    // throttled, best-effort
}
```

**(b) Tick sites (all loop boundaries that exist today; none reorders or skips an iteration):**

| site | unit / total | worst gap today [measured] |
| --- | --- | --- |
| `acquire.ts:128` asset loop (+ `total = budget.length`, signal check + rethrow on abort in `fetchBytes`) | ADDRESS / candidates | async: timer heartbeat (below) |
| `analyze.ts:109` per asset **and** between `prepareFromRaster` steps (`prepare.ts:87-116`: ink, luma, mask, edges, axis, Hough edges, thin, Hough ink) and extractor stages | ASSET / assets, subphase per step | one Hough call ≤ 2.2 s |
| `run.ts:259` decode loop | ASSET | 0.26 s |
| `extract.ts:281` frame loop | FRAME / orthographic frames (+ `counters.tokens`, `chains`) | **frame ≤ 27 s** → needs the inner sites: |
| `ocr.ts:964` per token group (and after each orientation pass) | TOKEN_GROUP | ≤ 0.3 s per pass |
| `callouts.ts:946` per ring, and per `classifyDigit` cell (`callouts.ts:789`) | RING / kept rings; CELL | ring ≈ 0.18 s, cell ≈ 13 ms |
| `reconstruct-v2.ts` `onPhase`/`trace` (already at each substage) + `readPlans` per plan copy (`layout.ts:199`) + per perspective camera (`reconstruct-v2.ts:898`) | PHASE_* / FRAME | METRICS phase ≤ 9.1 s → per-camera ticks |
| future resolver: per hypothesis and per bounded-search node | CANDIDATE / candidateTotal, `counters.nodes` | — |

**Never changes results.** `Checkpoint` is a write-only sink for the computation: no value it holds is read back into any decision (no time budgets, no "if slow then skip"; bounds stay counts). Enforced by tests: (1) replay the 6 sealed evidence sets with `NO_CHECKPOINT` vs a recording checkpoint and require equal `graph.contentHash`, `metrics.contentHash`, `candidateHash`, `modelHash`, `sceneSha256` (`second-house.ts --same-as` already exists, lines 30-37 of its header); (2) architecture test: every `tick(` is an expression statement (return value unused), and `Checkpoint` is not reachable from any hashing/serialising function; (3) `deterministicTrace` already drops `startedAtMs/durationMs` (`trace.ts:44-46`) — heartbeats never enter the trace, only aggregated counters may.
**Tick-coverage gate** (turns "silent code" into a testable property): the recording checkpoint stores `maxTickGapMs` per phase; CI replays the sealed evidence and fails if any gap exceeds 5 s desktop (phone budget = 5 s × ≥ 3 slowdown = 15 s < the 45 s alarm below). A new long loop without ticks fails the gate.

**(c) The single-threaded caveat, and how the design copes.** A timer cannot fire during synchronous work, so **the heartbeat in compute stretches *is* the tick**: it is emitted by the loop itself, hence "a heartbeat arrived" means "the thread just crossed a loop boundary" and its absence means "inside one un-ticked unit or wedged". Three mechanisms:
1. *Ticks bound the gap* (table above) and the gate keeps them bounded as code changes.
2. *An unref'd `setInterval` heartbeat* (`activity: 'IO_WAIT'`) covers the async stretches (acquisition, disk reads): it fires only when the loop is free, shares `lastEmit` with ticks (no duplicates), and — because it is labelled `IO_WAIT` — the phone can say "Czekam na odpowiedź strony od N s" instead of "obliczeniowo ciężki".
3. *Emission needs no event-loop turn*: `program.ts:185-202` already writes with `writeSync` (`program.ts:15-16` says so), so a tick inside a 20-second frame reaches the app immediately. Heartbeats are **best effort**: one `writeSync` attempt, drop on `EAGAIN` (the blocking `Atomics.wait` retry loop at `program.ts:193-198` stays for stage and terminal events only), so a stalled Kotlin reader can never freeze the computation.
Optional, not required for 005A: the Kotlin service (same process as Node, `LocalAnalyzerService.kt:117-132`) can sample the Node thread's CPU time from `/proc/self/task/<tid>/stat` every 2 s and forward it, giving an independent "CPU advancing / idle" signal for the case where a single un-tickable unit exceeds 45 s.

**(d) Cancellation without changing determinism.** Two options; the design takes the first.
* **Cooperative poll in `tick`** (`pollCancel` supplied by `program.ts`): `fs.readSync(controlFd, buf, 0, 64, null)` on the control pipe — libuv opened it non-blocking (`new Socket({fd})`), so empty → `EAGAIN` (→ `false`), `n > 0` containing `cancel` or `n === 0` (EOF: the app went away) → abort, any other error → abort (same as the socket's `'error'` handler, `program.ts:218`). Reading from the same fd as the socket is harmless: whichever reader sees the bytes aborts. Effect: the abort surfaces from the next tick (≤ 200 ms + one tick gap ≪ 1.5 s), unwinds as `AbortError`, `runAnalysis`'s catch maps it to `CANCELLED` (`errors.ts:131`, `run.ts:427`) and records a `CANCELLED` trace entry naming the stage/substage; the program emits `cancelled` with `trace.json` and the forced kill is no longer needed. All partial state is local to the unwound frames (`extractMetricEvidence` returns only at its end), so nothing partial leaks.
* **Awaiting between frames** — yes, it is safe and deterministic: `extractMetricEvidence`'s frame loop (`extract.ts:281-626`) mutates only function-local accumulators, its inputs (`graph`, rasters) are immutable while `run.ts` awaits, and the callbacks that run when the loop turns (control socket, fs/dns completions, the `report` sink) touch none of them. Cheapest form: turn the function body into a generator driven by a sync drain (`extractMetricEvidence` unchanged for its ~20 callers) and an async driver that `await setImmediate` between steps. It does not by itself meet the 1.5 s grace (a frame is up to 27 s) unless `readOpeningCallouts` is also stepped per ring, so it is the second choice.
* **Fallback, precedented**: run the compute in a `worker_threads` Worker and `terminate()` on cancel, exactly as `WorkerExecutor` does (`executor.ts:56-126`), with a `SharedArrayBuffer` control block for heartbeat/cancel. **Unverified**: whether nodejs-mobile 18.20.4 ships `worker_threads`; probe it in `runtimeFacts` (`workerThreads: boolean`, `sharedArrayBuffer: boolean`) before relying on it. Costs a second heap (memory is already the tightest resource), hence not chosen.

**(e) Overall percent (`overall`).** Monotone (`Math.max` with the previous, as `run.ts:151` and `applyProgress` do), **secondary** (shown small, labelled "orientacyjny"), documented in `docs/ANALYZER_API.md` as a *cost model*, and computed from **counts × declared unit costs known before the phase starts** (e.g. for METRICS_FRAME: Σ over orthographic frames of `pixels × roleFactor`, with PLAN ≫ ELEVATION — measured 20–27 s vs 0.3–0.7 s per frame on Marcówki), not from the fixed stage weights of `stages.ts:53-66`. It is never extrapolated to time. `workDone/workTotal` are exact counts and are what the bar shows when `workTotal` is known; an unknown total gives an indeterminate bar, never a guess.

**(f) Forwarding — `program.ts` and protocol 2 → 3.**
* `LOCAL_ANALYZER_PROTOCOL = 3` (`program.ts:51`) because the *meaning of silence* changes (the app may now treat it as a stall). `hello` gains `capabilities: ['telemetry.v1','control.poll']` and `runtime.workerThreads/sharedArrayBuffer`; later additive changes bump the capability, not the protocol.
* New event `{ type: 'telemetry', event: AnalysisProgressEvent, elapsedMs, rssBytes }` next to the unchanged `progress` (stage-level, from `report`). `program.ts:298` gets a sibling `telemetry: (e) => sink.emitBestEffort({...})`; `rssBytes` via `process.memoryUsage.rss()` (cheaper than `memoryUsage()`); `runProgram` builds the `Checkpoint` with `{ signal: controller.signal, pollCancel: controlPoller(args.controlFd), emit }` and hands it to `runLocalAnalysis` → `runAnalysis` (`options.checkpoint`) → `acquireSourcePackage`, `analyzeSourcePackage`, `extractMetricEvidence`, `readNumbersFromInk`, `readOpeningCallouts`, `reconstructV2`.
* HTTP side (`executor.ts:60`, `worker-main.ts:18`): the worker already `postMessage`s progress from inside sync stretches, so heartbeats flow for free; `applyProgress` (`job.ts:88`) keeps `progress = max(...)`, adds `activity: { heartbeatAgeMs, heartbeatSeq, phaseId, subphaseId, workDone, workTotal, unit, counters }` (age computed server-side at response time — no clock-skew problem) and store writes for heartbeats are throttled to ≥ 2 s.
* **Phone accepts/refuses**: `LocalProtocol.PROTOCOL = 3` (`LocalEvents.kt:28`); the existing gate (`LocalAnalysis.kt:183`) refuses any other `hello.protocol` with `RUNTIME_PROTOCOL`, tested by `LocalAnalysisTest.kt:328-334` (`PROTOCOL + 1`, stays valid). App and bundle ship in one APK (`LocalRuntimeFiles` installs the bundled runtime), so a mixed pair does not occur in the field; if one ever did, the refusal is a named failure, not silent missing heartbeats. Unknown event types stay `Unreadable`, never fatal (`LocalEvents.kt:114-115,166`).

**(g) Kotlin DTOs and phone logic.**

```kotlin
@Serializable data class LocalTelemetry(            // LocalEvents.kt, every field defaulted like its neighbours
    val kind: String = "", val stage: String = "", val stageIndex: Int = 0, val stageCount: Int = 0,
    val phaseId: String = "", val phaseLabel: String = "", val subphaseId: String? = null, val subphaseLabel: String? = null,
    val activity: String = "COMPUTE",
    val workDone: Long = 0, val workTotal: Long? = null, val unit: String = "",
    val assetIndex: Int? = null, val assetTotal: Int? = null, val candidateIndex: Int? = null, val candidateTotal: Int? = null,
    val heartbeatSeq: Long = 0, val elapsedMs: Long = 0, val phaseElapsedMs: Long = 0,
    val timestamp: String? = null, val message: String? = null,
    val diagnosticCounters: Map<String, Long> = emptyMap(), val overall: Double = 0.0)
// LocalEvent.Telemetry(val event: LocalTelemetry, val rssBytes: Long); parse: "telemetry" -> …
// AnalyzerDtos.kt (service path): JobStatus.activity: JobActivity? (heartbeatAgeMs, heartbeatSeq, phaseId, subphaseId, workDone, workTotal, unit, counters); CurrentStage.phaseId: String?
// LocalRunReport (run log): lastPhaseId, lastHeartbeatSeq, maxHeartbeatGapMs, noResponseEpisodes, heavyStepEpisodes, lastCounters
```

`LivenessTracker(now = SystemClock::elapsedRealtime)` — the phone's **own monotonic clock at receipt** (the analyzer's timestamps are display-only):
* `lastActivityAt` = receipt time of *any* line (`Hello`, `Progress`, `Telemetry`) — "the process is talking".
* `lastHeartbeatAt` = latest `Telemetry` or `Progress`.
* `lastMeaningfulProgressAt` = latest event whose **signature** `(phaseId, subphaseId, workDone, workTotal, diagnosticCounters)` differs from the previous meaningful one (a stage-level `Progress` counts). `heartbeatSeq`, `elapsedMs`, `overall` never count; `seq` holes are counted (`seqGaps`).
* Verdict, evaluated by the composable each second from those timestamps (a 1 Hz `produceState` clock — no republish needed, so the "N s" ticks even when no event arrives):
  `now − lastHeartbeatAt > 45 s` ⇒ **"Brak odpowiedzi analizatora od N s"** (with "Przerwij" emphasised; never auto-cancelled);
  else `activity == IO_WAIT && now − lastMeaningfulProgressAt > 15 s` ⇒ "Czekam na odpowiedź strony od N s";
  else `now − lastMeaningfulProgressAt > 30 s` (counters frozen, heartbeat alive) ⇒ **"Nadal analizuję — ten krok jest obliczeniowo ciężki."**; else healthy.
  Constants live in one place; the 45 s alarm is tied to the tick-gap gate above (budget 15 s on the phone). UI shows: phase name (Polish by `phaseId` from `strings.xml`), `workDone z workTotal <jednostka>` from a plural resource, elapsed time from the phone clock, then the small secondary "≈ 63 %"; `detail`/`message` finally rendered. The Cancel button stays; `analyzer_running_note_local` is reworded (no "kilka minut").

**(h) Cancellation tests to add (each names the property, not the mechanism).**
1. *Acquisition* (`source-package`): abort mid-loop with cache hits only → loop stops within one asset; abort during `safeFetch` → `FetchRefused('ABORTED')` not `TIMEOUT`, **zero** further DNS lookups (spy resolver) and zero further `fetchImpl` calls; body stall + abort → returns promptly.
2. *OCR* (`source-metrics`): checkpoint that throws at the k-th token group → `token groups processed ≤ k+1`; property test "abort at tick n, n sampled": result is the full identical result or `AbortError`, never a partial set.
3. *Callout / future resolver*: abort at ring k / candidate k → `classifyDigit` count ≤ (k+1)·cells; resolver: `candidateIndex` never exceeds the abort point + 1 and no candidate is emitted from an unwound search.
4. *Reconstruction*: abort at each `onPhase` and inside `readPlans` → `reconstructV2` throws, `runAnalysis` returns `CANCELLED` with a `CANCELLED` trace entry in the right stage.
5. *Program* (`program.test.ts`): cancel written to the control pipe **while `extractMetricEvidence` runs** (fixture with an injected slow frame) → exit 2, one `cancelled` event, `trace.json` ends `CANCELLED` in `EXTRACTING_OBSERVATIONS/METRICS_FRAME`, elapsed < 1.5 s after the write; control pipe EOF during compute counts as cancel.
6. *Android*: `cancelled` event received before the grace ⇒ `forcedStop == false` with a live heartbeat; forced kill remains as the backstop (existing test kept); `LivenessTracker` unit tests with a fake clock for the 30 s / 45 s rules, `seq` holes, IO_WAIT.
7. *Determinism*: telemetry on vs off ⇒ same hashes on all sealed replays; *coverage*: `maxTickGapMs` ≤ budget per phase.

### 1.8 Per-phase performance record and cheap generic wins (Q5)

Written to `diagnostics/performance.json` (non-deterministic, never in `trace.json`, never hashed; also kept on failures, and summarised into the `failed` event's `metrics` so a failing phone run finally carries timings):

```ts
type PhasePerf = {
  phaseId: PhaseId; stage: AnalysisStage; startedAtMs: number; durationMs: number
  cpuUserMs: number; cpuSystemMs: number                       // process.cpuUsage() delta — CPU vs wait, comparable phone/desktop
  ticks: number; maxTickGapMs: number; p95TickGapMs: number    // the coverage gate's input
  workDone: number; workTotal: number | null; unit: ProgressUnit
  rssStartMB: number; rssPeakMB: number; rssEndMB: number      // sampled at ticks (process.memoryUsage.rss())
  heapUsedEndMB: number; arrayBuffersPeakMB: number            // external typed-array memory is what actually set the peak here
  counters: Record<string, number>                             // deterministic: tokens, rings, ringsKept, cellsClassified, renderMisses, renderCacheEntries, renderCacheBytes, rastersDecoded, rasterBytesDecoded, masksBuilt, houghCalls, houghEdgePixels
  perFrame?: Array<{ frameId: string; document: string; sizePx: [number, number]; wholeMs: number; ocrMs: number; calloutMs: number; chainMs: number }>
  outcome: 'PASSED' | 'DEGRADED' | 'FAILED' | 'CANCELLED'; reasonCode?: string
}
type RunPerf = { node: string; v8: string; arch: string; cpus: number; totalMemoryBytes: number; heapLimitBytes: number; gcCount: number; gcTotalMs: number; phases: PhasePerf[]; peakRssMB: number; peakSource: 'VmHWM' | 'getrusage' }
```

Cheap generic wins (in scope; **R** = results-identical by construction, verify with the existing `--same-as` gate on the six sealed evidence sets; **H** = changes a hash, needs a reseal and the Council's blessing):

| # | change | evidence | effect | class |
| --- | --- | --- | --- | --- |
| W1 | `Prepared.thinSegments` computed lazily / only for `FLOOR_PLAN` (`prepare.ts:112-117`) | sole consumer `plan.ts:222`; second Hough = 51–58 % of Hough time on non-plan assets; Hough = 74.8 % of the observation pass | **≈ 35–40 % of the observation pass (~35–39 s of 99 s on Kosaćce)** | R |
| W2 | bound `RenderCache` (LRU by entries, or drop per grid size), reuse scratch buffers in `renderPrototype`/`normalised`, precompute prototype ink as `Uint8Array` instead of `p.rows[..][..] === '#'` + string keys, keep operation order (`callouts.ts:472-533`) | 597 MB retained + 1.8 GB churn per plan frame; `renderPrototype` self 51 %, GC 6.5 %, `at2`/`hit` 1.3 s | **peak RSS −0.6…1.2 GB per frame** (phone 1.2–1.5 GB → fits), time est. −30…50 % of the metric pass (estimate, unmeasured) | R |
| W3 | `analyzeSourcePackage` option `retainPrepared: false` for `run.ts` (`analyze.ts:147,210`) | RSS 132→480 MB, arrayBuffers 5→215 MB across 31 assets | −~200 MB at the end of the observation pass | R |
| W4 | tick/heartbeat/cancel (§1.7) | — | liveness + cancel < 1.5 s in compute; ~0 cost (one comparison per tick) | R |
| W5 | acquisition: pass `signal` into `AcquireOptions`, check at loop top, rethrow abort from `fetchBytes`, `FetchRefused('ABORTED')`, report `{done,total}` per address, per-body deadline | §1.6 | cancel exact; progress during acquisition | R |
| W6 | fetch 3–4 assets concurrently, assemble in sorted order | acquisition = 1–6 % of desktop wall; unknown on the phone network | small on desktop, larger on a phone link | R |
| W7 | drop double decode (`analyze` + `run.ts`), share masks | 1.6 s + 0.55 s per project | **not a lever** (< 2 %); listed to close the brief's suspicion | R |
| W8 | demand-driven metric evidence: read the preferred plan copy first, further copies only when a gate fails (order already fixed by `layout.ts:194-198`); SITE_PLAN excluded as the comment at `extract.ts:73` itself says | 8 plan copies = 147.9 s of 158.8 s on Marcówki; SITE_PLAN 8.4 s; `readPlans` reads one copy per storey then `break` (`layout.ts:199-246`) | up to −50…75 % of the metric pass on multi-copy publishers | **H** — and it trades against multi-hypothesis (the evidence for all copies is already paid for); decide together with the candidate-retention design |

---------------------------------------------------------------------------------------------------------------------------

## 2. Function capability inventory (runtime / progress / performance scope)

Legend: Det = deterministic result; Risk = genericity risk; Rec = KEEP / INSTRUMENT / REFACTOR / REPLACE / DELETE. "Alt hyp." = alternate hypotheses attempted.

1. `stages.ts:53-75` `STAGE_WEIGHTS`, `progressAt`, `progressEvent` — in: stage, fraction → out: overall 0..1. Det yes. Assumes fixed time shares (0.10/0.01/0.80/0.01/0.01/0.02/0.01/0.01/0.03) and a fixed 0.65 split inside EXTRACTING. Consumes stage + per-asset index; ignores metric pass, decode, acquisition counts, plan-copy count. Alt: per-phase counts × cost model. Failure codes: none. Alt hyp.: n/a. Cost: trivial. Risk **HIGH** (the constants are fitted to one 20-asset project; measured shares vary 49–81 % for the metric pass). Rec **REPLACE** (secondary `overall`, counters primary).
2. `run.ts:147-154` `report` — monotone filter (`event.progress < last` dropped: this silently discards every per-fetch acquisition event after `onRoute`, `run.ts:179-184`), no rate limit otherwise. Det. Risk MEDIUM. Rec **REFACTOR** into the phase/checkpoint emitter (§1.7).
3. `run.ts:131-447` `runAnalysis` — single sequential pipeline; 8 abort checkpoints (§1.6); `rasterCache` (`160`) decodes and keeps every asset; `trace` recorded per substage; failure path builds diagnostics from `rasterCache`. Det yes (timings excluded from hashes). Failure codes: CANCELLED, TIMEOUT, ANALYSIS_FAILED/INTERNAL_ERROR, RECONSTRUCTION_FAILED, SCENE_COMPILE_FAILED, VERIFY_*. Risk MEDIUM. Rec **INSTRUMENT**.
4. `run.ts:121-129` `cancellableDeps` — combines the run signal with `safeFetch`'s own via `anySignal`; counts fetch calls for `detail`. Rec KEEP + pass the signal into `acquire`.
5. `run.ts:259-268` decode loop — sync decode of all assets, incl. CHROME/UNKNOWN and renders (renders are needed by the camera solve, `reconstruct-v2.ts:898`). 6–258 ms/frame. Risk LOW. Rec KEEP (tiny), tick per asset.
6. `errors.ts:129-136,190-192` `toAnalysisError`, `throwIfAborted` — any error while `signal.aborted` becomes CANCELLED/TIMEOUT (a real failure racing a cancel is masked). Hard-correct for cancel; Risk LOW. Rec KEEP.
7. `trace.ts:55-87` `TraceRecorder` — records substage after the fact, timed from the previous end (so `METRIC_EVIDENCE` includes the decode loop). `deterministicTrace` strips clocks. Risk LOW. Rec KEEP; add phase ids + tick aggregates to a *separate* perf file.
8. `signals.ts:13-35` `anySignal` — platform shim for Node 18. Rec KEEP.
9. `acquire.ts:63-184` `acquireSourcePackage` — sequential fetch (`128-162`), `probeImage` header probe, sha256, no signal, budget `maxAssets=120`, failures recorded as data. Det given fixed publisher. Failure codes: PAGE_NOT_FETCHED, NO_ADAPTER, SOURCE_NOT_PROJECT, SOURCE_REQUIRES_RENDERING; per-asset: TIMEOUT, NETWORK, HTTP_STATUS, TOO_LARGE, MEDIA_TYPE_NOT_ALLOWED, UNSUPPORTED_FORMAT, BUDGET_EXCEEDED, OFFLINE_CACHE_MISS. Alt hyp.: none (one address list). Cost 1–6 % of desktop wall (2.4–18.8 s). Risk MEDIUM (partial acquisition changes the evidence silently: phone `planFrames 1` vs 4). Rec **REFACTOR** (signal, totals, failure surfacing).
10. `net.ts:272-348` `safeFetch`, `readCapped` — 20 s timer cleared at `297` (headers only); redirects ≤ 5; 24 MiB cap; AbortError → TIMEOUT (`294`). Det. Failure codes as above. Risk MEDIUM. Rec **REFACTOR** (ABORTED code, body deadline).
11. `image.ts:34,133` `probeImage`, `decodeImage` — JPEG/PNG/GIF only (WebP/BMP probed but not decodable → `UNSUPPORTED_FORMAT`), size cross-check. Det. Risk MEDIUM (source-format coverage; other Councillors). Rec KEEP.
12. `analyze.ts:88-227` `analyzeSourcePackage` — sorted-id loop, per-asset `prepareRaster` + one extractor by role, retains `Prepared` per asset, `snapshot().filter` per asset (O(n²) but small), throws (INTERNAL) on sealed-size mismatch (`135-137`). Det. Cost 99 s Kosaćce (79.5 % renders). Risk MEDIUM. Rec **INSTRUMENT** + W1/W3.
13. `prepare.ts:76-132` `prepareRaster/prepareFromRaster` — `MAX_WORKING_EDGE 2200`; adaptive ink mask, gradient mask, axis segments (`minLength ≈ 1.2 % of larger edge`, thickness ≤ 4, gap ≤ 2), Hough ×2 (`maxSegments 400/300`, minSupport 1.2 %/1.0 %). Det. Cost: Hough 74.8 % of the pass. Single working scale (lock-in). Risk MEDIUM. Rec **REFACTOR** (W1).
14. `extractors/plan.ts`, `elevation.ts`, `section.ts` (`extractPlan/Elevation/Section`) — per-role readers over `Prepared`; elevation also runs on `PERSPECTIVE_RENDER` (renders → LOW-authority observations); plan is the only reader of `thinSegments`. Det. Cost: elevation extraction 6.6 s, plan 1.6 s of the profiled 90 s. Risk (others). Rec INSTRUMENT (tick per stage).
15. `extract.ts:269-675` `extractMetricEvidence` — per orthographic frame (filter `74-75`, includes SITE_PLAN and all plan copies), OCR + chains + callouts; sorted frame ids; tolerance 2.2 px; no signal. Det. Consumes: raster, observations; ignores: legibility of the copy, whether the copy will be selected. Cost 76.7–193.1 s = 49–81 % of wall. Failure codes: none itself (gaps in `unresolved`). Alt hyp.: none (all copies evaluated, none retained as alternatives downstream). Risk **HIGH** (cost scales with duplicate publisher copies). Rec **INSTRUMENT** now, **REFACTOR** (demand-driven) with the candidate design.
16. `ocr.ts:895-1046` `readNumbers`, `readNumbersFromInk` — full-resolution raster, 3 orientations, `minGlyphHeight 6`, `maxGlyphHeightFrac 0.06`, `inkDelta 8`, `minGlyphScore 0.55` (`ocr.ts:114`). Det. Cost 0.09–0.70 s/frame. Risk MEDIUM (small text on low-res copies; others). Rec KEEP, tick per token group.
17. `callouts.ts:903-994` `readOpeningCallouts` + `classifyDigit` (`569`) + `renderPrototype` (`474`) + `readHalf` (`701`) — ring search over `ANGLES 48`, `UPSAMPLE 3`, `RESIDUAL_SLANTS [-0.1,0,0.1]`, `OFFSETS [-1,0,1]`, `SCALES 3`, 11 prototypes; exhaustive per cell; unbounded per-call cache. Det. Cost **97 % of a plan frame** (13 ms/cell, 0.18 s/ring); memory 597 MB retained + 1.8 GB churn. Alt hyp.: candidate list per half (`candidates`), kept. Risk MEDIUM (cost), HIGH for memory. Rec **REFACTOR** (W2), tick per ring/cell.
18. `reconstruct-v2.ts:146-1229` `reconstructV2` — sync; `onPhase` at `148,322,585,1019`; `trace` callbacks at each substage; no signal; reads perspective rasters for cameras (`898-899`). Det. Cost 8.9–12.1 s. Risk (others). Rec **INSTRUMENT** (ticks at existing boundaries, per camera).
19. `layout.ts:177-262` `readPlans` — per storey: DIMENSIONED first, then pixel count, then id; first copy with an extent wins, then `break`; recomputes `adaptiveInkMask(inkChannel)` (`205`). Det. Cost 0.27–0.78 s. **Lock-in on one plan copy** (§4). Rec REFACTOR (retain top-N; ~0.7 s each).
20. `program.ts:185-202` `eventSink` — `writeSync` with EAGAIN retry loop and `Atomics.wait` 2 ms; blocking. Rec **REFACTOR** (best-effort variant for heartbeats).
21. `program.ts:205-220` `listenForCancel` — socket `'data'`/`'end'`/`'error'`; needs the loop. Rec **REFACTOR** (add sync `pollCancel`).
22. `program.ts:272-340` `runProgram` — one terminal event; `failed` carries `metrics` without timings (`311,335`). Rec INSTRUMENT.
23. `local.ts:58-80` `runLocalAnalysis`, `memory.ts:37-54` `memorySample` — scratch cache removed in `finally`; RSS from `/proc/self/status` `VmRSS/VmHWM`. Rec KEEP; add `arrayBuffers` peak sampling at ticks.
24. `executor.ts:56-126` `WorkerExecutor`, `runner.ts:106-140`, `job.ts:88` `applyProgress` — worker per job, `terminate()` on abort, 15 min job timeout, `progress = max`. Rec KEEP; add `activity`.
25. Kotlin `LocalAnalysis.cancel/onLine/statusOf` (`LocalAnalysis.kt:109-123,179-216,383-418`), `LocalAnalyzerService.requestCancel/endProcess` (`135-145,158-160`), `AnalyzerScreen.JobProgress` (`355-405`) — hard-kill backstop at 1.5 s, stage-only status, `detail` unrendered, no liveness. Rec **REFACTOR** per §1.7(g).

---------------------------------------------------------------------------------------------------------------------------

## 3. Assumption register (RUNTIME, plus one TEST)

* **ASSUMP-RUNTIME-001 — progress = fixed stage weights, EXTRACTING split 0.65/0.35.** Now: `stages.ts:53-66`, `run.ts:243,257`. Why: measured once on a 20-asset project (`stages.ts:9-12`). Evidence: six desktop runs give metric-pass shares of 49–81 % against a modelled 28 % (0.8×0.35), acquisition 1–6 % against 10 %. Violated by: every multi-plan-copy publisher (Kosaćce, e-OZE, Marcówki), by renders-heavy pages (obs 14–44 %). **Soft.** Decision: **soften** — counters primary, `overall` secondary, cost-model-based.
* **ASSUMP-RUNTIME-002 — the analysis is one synchronous thread that reports only between stages/assets.** Now: `run.ts` stages; obs per asset ≤ 8.3 s, metric pass one call ≤ 193 s, solver ≤ 9.1 s per phase. Why: simplicity/determinism. Evidence: §1.2–1.3. Violated by all inputs with plan copies. **Soft**. Decision: **soften** — ticks at loop boundaries; tick-coverage gate.
* **ASSUMP-RUNTIME-003 — cancel = "check between stages, kill after 1.5 s".** Now: 8 checkpoints (§1.6), `CANCEL_GRACE_MS 1 500`. Evidence: no check in compute; ≈ 44 % cooperative success in the observation pass, 0 % in the metric pass and solver; cancel in acquisition drains the candidate list and reports `TIMEOUT`. **Hard** (the kill backstop must stay), cooperative part **soft**. Decision: **soften** (poll in `tick`; keep the kill).
* **ASSUMP-RUNTIME-004 — every asset variant is decoded and kept for the whole run.** Now: `run.ts:160,259-268`. Why: three consumers (metric pass, layout, camera solve) want rasters. Evidence: 2.3–7.7 % of desktop peak, ≤ 13 % of the phone's. Violated: none observed. **Soft.** Decision: **keep** (not the lever); stop double decode opportunistically.
* **ASSUMP-RUNTIME-005 — acquisition is sequential, header-timeout-only, with failures kept as data and no total reported.** Now: `acquire.ts:128-162`, `net.ts:279-297`, `run.ts:151,179-184`. Evidence: `failed_*` appear only as trace counts; phone `planFrames 1` vs desktop 4 is invisible in the failure message; per-fetch events are dropped by the monotone filter so the bar sits at `1 %` for the whole download. Violated by: flaky mobile links (the OWNER's phone: three plan copies lost). **Soft.** Decision: **soften** (surface `assetsFetched/Failed{code}` and plan-copy inventory in every failure and in telemetry; abortable; body deadline).
* **ASSUMP-RUNTIME-006 — the metric pass reads every orthographic-projection frame, before any is selected, including SITE_PLAN.** Now: `extract.ts:74-75`, `281`. Why: evidence for all candidates should exist before layout. Evidence: 8 plan frames = 93 % of the pass on Marcówki; SITE_PLAN 8.4 s despite the filter's own comment; `readPlans` uses one copy per storey (`layout.ts:199-246`). Violated by: multi-copy publishers. **Soft.** Decision: **branch candidate** (demand-driven, budgeted) — H-class, decide with the candidate design.
* **ASSUMP-RUNTIME-007 — the digit classifier searches exhaustively per cell with an unbounded per-frame cache.** Now: `callouts.ts:423-424,472,569-590,944`. Evidence: 1.53 M lookups / 72 k renders / 597 MB retained for 3 evidence records; 853 px plan = 1 372 MB peak, independent of V8 old-space. Violated by: any plan with many circles (all three publishers). **Soft.** Decision: **soften** (bound cache, reuse buffers; R-class).
* **ASSUMP-RUNTIME-008 — Hough runs twice per asset on every asset at working edge ≤ 2200.** Now: `prepare.ts:28,102,116`. Evidence: 74.8 % of the observation pass; second call feeds only `plan.ts:222`. Violated by: renders/elevations (27 of 31 Kosaćce assets). **Soft.** Decision: **soften** (lazy `thin`; R-class).
* **ASSUMP-RUNTIME-009 — per-asset `Prepared` may be retained until the analyzer returns.** Now: `analyze.ts:147,210`. Evidence: RSS 132→480 MB, arrayBuffers 5→215 MB. **Soft.** Decision: **remove** for `run.ts` (`retainPrepared:false`).
* **ASSUMP-RUNTIME-010 — the phone needs no total time budget or stall detection.** Now: none in `analyzer/local/*.kt`; API 15 min (`config.ts:48`). Evidence: no timeout/deadline strings; the OWNER cannot tell "moving" from "stuck". **Soft.** Decision: **soften** — liveness rule (45 s / 30 s); a long-run *notice*, not an automatic abort, on the phone.
* **ASSUMP-RUNTIME-011 — the app renders stage + percent only.** Now: `AnalyzerScreen.kt:365-388`; `detail` unrendered. **Soft.** Decision: **remove** (§1.7(g)).
* **ASSUMP-RUNTIME-012 — a user cancel during a fetch is a fetch timeout.** Now: `net.ts:294`. Evidence: recorded as `TIMEOUT` "timed out after 20000 ms" in `failures`. **Soft** (misclassification). Decision: **remove** (`ABORTED`, rethrow).
* **ASSUMP-RUNTIME-013 — memory is bounded by the phone's ~1.5 GB.** Now: nothing bounds it; `RUNTIME_STOPPED` is the only signal (`LocalAnalysis.kt:232`). Evidence: peak 1 197 / ~1 500 MB with **one** plan copy; a single 853 px plan costs 1 372 MB. **Hard** (the OS enforces it). Decision: **keep the constraint, remove the cause** (W2/W3); add `rssPeakMB`/`arrayBuffersPeakMB` to the record and a soft guard (heartbeat carries RSS; if RSS > a configured fraction of `totalMemoryBytes` the phase is reported as `MEMORY_PRESSURE`, no behavioural change in 005A).
* **ASSUMP-RUNTIME-014 — Worker threads / `--expose-gc` exist on nodejs-mobile 18.20.4.** Unverified (`grep worker_threads` finds only `apps/analyzer-api`). **Soft**; decision: probe in `runtimeFacts` before any design depends on it.
* **ASSUMP-RUNTIME-015 — results never depend on the clock.** Now: `trace.ts:44-46`, `AnalysisTimings` "diagnostics only". **Hard.** Decision: **keep**; telemetry must be write-only (§1.7(b)).
* **ASSUMP-TEST-001 — CI proves parity and named failures, not scale or liveness.** Now: `program.test.ts` uses two small synthetic projects (Larchfield, Holloway) and tests cancel only during acquisition; the 165 s metric pass of real projects is not in CI, so neither a 3× cost regression nor an un-ticked loop nor a memory blow-up can fail a test. **Soft.** Decision: **soften** (sealed-evidence replay with tick-gap and RSS gates, run outside the default `vitest run` or as an opt-in job).

---------------------------------------------------------------------------------------------------------------------------

## 4. Single-hypothesis lock-in points found in my scope

* **Plan copy per storey** (`layout.ts:194-198,199-246`): ordered DIMENSIONED → pixel count → id; the first copy that yields an extent is the plan, then `break`. Retaining top-N is **cheap**: the metric evidence for all copies is already computed (paid: 148 s on Marcówki), `readPlans` costs 0.27–0.78 s per copy, layout + registration ~0.7 s; a 4-copy re-run through the layout gate is ≈ 3 s. On the phone the lock-in is worse: three of four copies never arrive, and the run cannot tell (§5-F5).
* **Metric-frame admission** (`extract.ts:74-75`): by projection only; SITE_PLAN admitted, duplicates admitted, low-resolution copies admitted at full cost. Retaining alternatives is free; *evaluating* them is the cost (W8).
* **Working scale** (`prepare.ts:28`, one edge of 2200) and one Hough parameterisation per role; no second scale is ever tried.
* **Solver tail as one candidate**: 8.9–12.1 s buys one candidate; a resolver with 5 hypotheses ≈ 45–60 s ≪ the 165–193 s pass. Runtime is **not** the obstacle to multi-hypothesis; the metric pass is the shared front-loaded cost, and e-OZE pays 100 % of it before failing in 0.3 s.

## 5. Hard vs soft (terminal gates I audited)

* **Stay hard**: `throwIfAborted`/kill backstop; sealed-size mismatch (`analyze.ts:135-137`, integrity — but it should fail the *asset* with a `MISSING` rather than throw an internal error, since PACKAGE input can hit it); `VERIFY_REPLAY_FAILED` and the round-trip hash (`run.ts:326-335`); `VERIFY_CLOSURE_FAILED` (audit could not run); scene sha256/size checks on the phone (`LocalAnalysis.kt:303-327`); protocol equality; fetch policy (scheme, host, redirects, byte cap).
* **Should become soft / scores**: exterior closure findings (already `DEGRADED`, keep); *acquisition completeness* — today a missing plan copy silently turns into a hard `PLAN_*` failure downstream; it should be a scored property of the package (`planCopiesAvailable/Expected`) that the failure message and the UI state; `PLAN_LAYOUT_REJECTED`/`PLAN_NO_WALLED_ENVELOPE` in *this* scope are consequences of the single-copy lock-in (others own the gates); the phone's lack of any time signal should be a notice, not a limit.

## 6. Failure taxonomy contributions

| code (where) | class |
| --- | --- |
| `INVALID_URL`, `SOURCE_UNSAFE`, `SOURCE_REFUSED` (`errors.ts:92-104`) | source/policy limitation (correct, hard) |
| `SOURCE_UNREACHABLE` (page), per-asset `TIMEOUT/NETWORK/HTTP_STATUS/TOO_LARGE/MEDIA_TYPE_NOT_ALLOWED/BUDGET_EXCEEDED` (`acquire.ts`) | source or **network** limitation; currently **not surfaced** in downstream failures |
| `UNSUPPORTED_PUBLISHER`, `SOURCE_NOT_PROJECT`, `SOURCE_REQUIRES_RENDERING`, `NO_DRAWINGS`, `SOURCE_INCOMPLETE` | source limitation / unimplemented semantic (others) |
| `RECONSTRUCTION_FAILED` + `PLAN_NO_WALLED_ENVELOPE`, `PLAN_LAYOUT_REJECTED` | algorithm assumption — **on the OWNER's phone caused by partial acquisition (`planFrames 1`)**, i.e. a runtime/network completeness limitation presented as an algorithm failure |
| `TIMEOUT` (API 15 min) and the fetch-level `TIMEOUT` | two meanings under one code: job limit vs header timeout; user cancel is also reported as the latter (`net.ts:294`) |
| `CANCELLED` | correct; on the phone during compute it is a forced kill with no trace |
| `ANALYSIS_FAILED/INTERNAL_ERROR` (`analyze.ts:135` sealed-size throw among them) | unimplemented / defect |
| `RUNTIME_STOPPED` (`LocalAnalysis.kt:232`) | **resource limit from an algorithm memory behaviour** (callout cache, §1.5), not a phone defect |
| `RUNTIME_EXITED/UNAVAILABLE/REUSED/INSTALL_FAILED/PROTOCOL`, `OUTPUT_FAILED` | platform/plumbing |
| `TEXT_NOT_SUPPORTED_ON_DEVICE` | platform limitation (no ICU on nodejs-mobile) |
| `SCENE_COMPILE_FAILED`, `VERIFY_REPLAY_FAILED`, `VERIFY_CLOSURE_FAILED` | invariant guards (hard) |

New contribution: a `SOURCE_PARTIAL` marker in `FailureDiagnostics` (`assetsFetched`, `assetsFailedByCode`, `planCopiesAvailable`) so the phone can say "pobrano 9 z 12 rysunków" before anyone blames the solver.

---------------------------------------------------------------------------------------------------------------------------

## 7. Top 5 findings (ranked)

1. **CRITICAL — the progress model is dishonest about time and the phone gives no liveness.** 63 % is reached after 14–44 % of the wall clock and then nothing is emitted for 76.7–193.1 s (52–81 % of the run) inside one synchronous `extractMetricEvidence` call (`run.ts:271`), followed by a 28-point jump; `detail` is never rendered (`AnalyzerScreen.kt` has no `stage.detail`), there is no elapsed time, heartbeat, stall rule or phone-side time limit.
   *Smallest generic change*: a `Checkpoint` (`tick`) threaded into four loops — `extract.ts:281`, `callouts.ts:946`/cell, `ocr.ts:964`, `prepare.ts` steps — emitting `telemetry` events (protocol 3, best-effort `writeSync`) and a phone `LivenessTracker` (45 s / 30 s rules) + rendering of phase, `done z total`, elapsed. Even the minimal version — a `PHASE_START METRICS_FRAME total = frames` plus one tick per frame plus rendering `detail` and elapsed time — ends the "is it moving?" question.
2. **HIGH — the metric pass is 49–81 % of the run, 97 % of it is digit template matching in `readOpeningCallouts`, and its per-frame cache sets the phone's peak RSS.** 8 plan copies = 147.9 s of 158.8 s (Marcówki), 87 rings → 1 181 cell classifications → 1.53 M lookups → 3 evidence records; one 853 px copy = 1 372 MB RSS regardless of the V8 heap cap; the phone's 1.2–1.5 GB peaks are single-copy runs, so `RUNTIME_STOPPED` is one copy away.
   *Smallest change (results-identical, W2)*: bound the `RenderCache`, reuse the three scratch buffers, precompute prototype bitmaps; prove with `second-house.ts --same-as` on the six sealed evidence sets; then per-ring/cell ticks.
3. **HIGH — 75 % of the observation pass is a Hough transform whose second call feeds a single consumer.** `prepare.ts:112-117` computes `thinSegments` for every asset; only `plan.ts:222` reads it; 27 of 31 Kosaćce assets are not plans; 79.5 % of the pass is the 19 renders.
   *Smallest change (W1, hash-identical)*: make `thinSegments` lazy (or compute only for `FLOOR_PLAN`): ≈ 35–40 % of the pass (~35–39 s of 99 s), plus W3 (`retainPrepared:false`, −~200 MB).
4. **HIGH — cancel is not cooperative anywhere it matters, and in acquisition it is mis-reported and drains the queue.** Only 8 checkpoints in `run.ts`; nothing in compute, so the phone always force-kills after 1.5 s and loses the trace; ≈ 44 % cooperative success in the observation pass; in acquisition `AbortError` → `TIMEOUT` (`net.ts:294`) → swallowed (`acquire.ts:370-373`) → loop continues through DNS lookups for up to 120 candidates.
   *Smallest change*: `signal` into `AcquireOptions` (check at loop top, rethrow), `FetchRefused('ABORTED')`, and `pollCancel` (sync `readSync` on the control fd, EAGAIN = no) inside `tick`.
5. **MEDIUM/HIGH — silent partial acquisition looks like an algorithm failure, and the runtime cannot distinguish them.** Phone `planFrames 1` vs 4 explains both OWNER failures; acquisition reports no total and, after the route event, nothing at all (per-fetch events have fraction 0 and are dropped by the monotone filter, `run.ts:151,179-184`), `failed_*` exist only as trace counts, the fetch deadline covers headers only (`net.ts:297`), fetches are sequential, and the UI shows `1 %` for the stage.
   *Smallest change*: emit `{done,total}` per address, put `assetsFetched/Failed{code}/planCopiesAvailable` into every failure's `diagnostics` and into the `failed` event, and render "pobrano N z M rysunków".

## 8. What would falsify "the analyzer is becoming generic" (runtime dimension)

The claim is falsified the first time an unseen project (a) leaves the phone silent for longer than the tick-gap budget — i.e. `maxTickGapMs` from the sealed-evidence replay exceeds 5 s desktop in any phase, or the phone raises a "Brak odpowiedzi" episode on a run that later completes; (b) needs more than the phone's ~1.5 GB because the number of callout rings/cells, not the number of pixels, sets memory (today one 853 px plan copy already needs 1.37 GB); or (c) has a metric-pass cost that is not predictable from Σ(orthographic frame pixels × role factor) — e.g. a publisher with more duplicate plan copies costs proportionally more (Marcówki: 8 copies = 148 s) although the solver uses one copy per storey. Today (b) and (c) are already true on the six known runs, so the claim is currently falsified for runtime; the remedies above (W1/W2/W8 + telemetry gate) are what would un-falsify it.

## 9. Reproduction

All in `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/prof/`: `metric-prof.ts` (per-frame metric pass; output `metric-marcowki.json`), `obs-prof.ts` (per-asset observation pass; `obs-kosacce-clean.json`), `frame-prof.ts` (+ `--cpu-prof` output in `cpuprof/`, `cpuprof-obs/`), `hough-prof.ts` (Hough split), `alloc-hook.cjs` (typed-array allocation sampling), `frame-count.cjs` (ring/cell counters). Bundled with `esbuild --bundle --alias:@buildapp/*=…/src/index.ts` into the scratchpad; sources read from `scratchpad/before/<name>/` and `scratchpad/acq/cache-<name>/`; nothing written inside either repository.
