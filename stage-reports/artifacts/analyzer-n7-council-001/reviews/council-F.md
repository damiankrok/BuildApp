# Council F — END-TO-END / ANDROID / ADVERSARIAL (phase 1)

Repo HEAD 6788e7d (P2R code = eb2c7ec). Read-only on production code. Harnesses (invented numbers only):

- `research/analyzer-n7-council/F/thin-skip.ts` — `npx vite-node research/analyzer-n7-council/F/thin-skip.ts` (passes, all asserts)
- `research/analyzer-n7-council/F/sliverton-discriminators.ts` — `npx vite-node research/analyzer-n7-council/F/sliverton-discriminators.ts`
- APK check (no harness file): `unzip apps/android/app/build/preview-apks/BuildPlan-Model-Preview-arm64-v8a-debug.apk 'assets/local-analyzer/*'` into the scratchpad (`.../scratchpad/F-apk/`).

## 0. The adversarial question: what the 1306 screen proves

### 0.1 Is 1306 the P2R analyzer? — YES (NOT_A_DEFECT)
- `apps/android/app/build/preview-apks/VERSION.txt`: versionCode=1306, commit=eb2c7ec (the P2R commit), built 16:11 vs commit 16:10.
- The arm64 APK's `assets/local-analyzer/analyzer.mjs` (sha256 b67d77fa…, matches its manifest) contains `thinBodies`/`adjudicateThinBody`/`skipThinBodies` and `SOLVER_V2_VERSION = "2.5.0"` (P2R bumped 2.4.0 → 2.5.0).
- Gradle `BundleLocalAnalyzerTask` (`apps/android/app/build.gradle.kts` ~l.210) has `outputs.upToDateWhen { false }` and deletes its output dir before each bundle: no stale bundle from the Gradle cache.
- Note: `apps/local-analyzer/dist/` is a STALE Oct-5 bundle (sha 66a7aa65…, no thinBodies). It is gitignored and NOT what the APK ships, but `scripts/run-host.mjs --dir apps/local-analyzer/dist` would run pre-N7 code. Desktop reproductions must rebuild (`node apps/local-analyzer/build.mjs`) first. HIGH_RISK for reproductions only.

### 0.2 Can the phone run an old bundle after an update? — NO (NOT_A_DEFECT)
`analyzer/local/LocalRuntimeFiles.kt:install()` runs on EVERY start (`LocalAnalysis.start` → `install()`; not memoized). It installs into `runtime/<analyzer.mjs sha256[:16]>/`, re-hashes every file against the APK's manifest on every reuse, re-copies mismatches, and deletes every other version's folder. A new APK with a new analyzer sha cannot reuse the old folder. The `hello` event's protocol is checked (`LocalAnalysis.Run.onLine`), and `hello.analyzer.{service,solver}` is recorded into `LocalRunReport`.
Each job gets a fresh `:analyzer` process (`LocalAnalyzerService.start` refuses `RUNTIME_REUSED`), a fresh `workDir/bytes` byte cache (`apps/local-analyzer/src/local.ts:82`) that is deleted with the job. There is NO URL-keyed or project-keyed result cache on the phone: re-importing the same URL always runs the full pipeline.

### 0.3 Could the screen show a stored older result? — only in one view, and the view cannot tell (COVERAGE_GAP, provenance)
- The Analyzer result card (`ui/AnalyzerScreen.kt Result`) is built from the in-memory `AnalysisState.Completed` of the run just finished: always the new run. Its "Szczegóły analizy" → Źródło row shows `analyzer: service 1.2.0 · solver 2.5.0` (`AnalysisDiagnostics`).
- The house/source sheet (`ui/HouseSheets.kt` ~l.226) shows `PreviewOutcomeDetails` (built counts, failure row, "Punkt kontrolny: 16 poleceń, model 1f9f85c22a83") from the STORED `DownloadedSceneEntry.preview`. It shows the analyzer version and the unresolved list only when `resultShown` (that same scene is the live Completed state). After an app restart, or when another stored entry is opened, the sheet shows the stored record with no analyzer/solver version at all: `recordOf` (`analyzer/AnalysisTracker.kt:85`) drops `summary.analyzer`, and `AnalysisRecord`/`DownloadedSceneEntry` (`scene/DownloadedScenes.kt`) have no field for it. `LocalRuns` lists the stored `LocalRunReport`s but does not render `analyzerSolver` either (`AnalyzerScreen.kt LocalRuns`/`LocalCost`; `runtimeText` shows only node+abi).
- Entries are keyed by scene sha256 (`DownloadedScenes.save`: `existing = entries.firstOrNull { it.sceneSha256 == actual }`, then the record is REPLACED). The scene bundle carries no solver version or candidate hash (`mobile-scene/src/types.ts generatedFrom`: model id/name/schema/content hash). So a P2R run that produces the same model as the P2 run collapses into the SAME entry, and the entry's preview is overwritten with the new record. A stale record can therefore only be on screen if the owner opened a different, older entry (different scene bytes).
- The one stored discriminator is the subtitle `"Analysed on this phone <date> · candidate <8 hex>"` (`subtitleFor`). The candidate hash includes `solver` (`candidate.ts candidateContentHash`, label 'solver'; `reconstruct-v2.ts:2338`), so it DOES change 2.4.0 → 2.5.0 even when the model is byte-identical. The owner can compare it with the earlier value only if that value was noted.
- Service path (HIGH_RISK, only if the owner was not in LOCAL mode): the armeabi-v7a APK has no `libnode.so` (it ships only the manifest), so `LocalAvailability` is false there and mode defaults to SERVICE. Also `AnalyzerViewModel` resumes `settings.activeJob` at start-up (`resume(job)` → `startLoop`). A service result is computed by whatever server is deployed, not by the APK. 1306 has `ANALYZER_API_BASE_URL = ""` (BuildConfig), so this needs a user-set address. The subtitle then says "Analysed", not "Analysed on this phone".

### 0.4 The checkpoint hash is not evidence of an old run (NOT_A_DEFECT, but a misreading)
`candidate.ts previewCheckpoint` hashes the model of the program PREFIX up to the main body's last `slab-main-*`/`ring-main-*`. It cannot see the attached bodies, the solver version or anything after the main ring. thin-skip.ts part B: two programs that differ only in the attached body give the identical checkpoint (8 commands, e22bcd13bf20). Changing the main ring changes it (d6a14f3b115d). An identical 1f9f85c22a83 is therefore expected whenever P2R leaves the main body alone, which it always does (thinBodies only takes ATTACHED masses).

### 0.5 What 16 commands / index 21 say about the owner's house (deduced from emit.ts, CONFIRMED arithmetic)
`emit.ts` always emits 13 header commands (setModelName, createBuilding, 11 defineMaterial). Then one createLevel per level, then createRoofPlane for pitched-attached/plane roofs, then per mass: slab, ring, evidence. Checked on all 8 corpus programs (r1/*/program.json): checkpoint = 13 + levels + roofPlanes + 2 × main storeys (16/18/19/20 observed).
16 = 13 + 1 level + 0 roof planes + main slab + main ring. The only solution is a **single-level** house with a single-storey main body. Then 16 = evidence(ring-main-0), 17–19 = attached-0 (slab, ring, evidence), 20 = slab-attached-1-0 and **21 = ring-attached-1-0**, which matches the reported commandIndex exactly. "2 pierścienie" = ring-main-0 + ring-attached-0-0. "3 bryły" = `counts.masses = b.masses.length` (run.ts:541): main, attached-0 and attached-1, with no pieces.

### 0.6 (d) Could P2R genuinely leave this body untouched?
`thin-body.ts thinBodies()` skips `pieceOf` and any `storeyRects`. thin-skip.ts part A proves that this skip is a real hole: a mass with a narrow storey-0 `storeyRects` entry is not flagged, yet emit builds `ring-<id>-0` from `rectAt(m,0)` and it is refused with WALLS_OVERLAP w1/w3 (COVERAGE_GAP, see F-1). The hole does NOT apply to the owner's case, though. With one level, every mass has `storeys=[0]`. `storeyRects` is only filled for storeys other than `measuredOn` (`reconstruct-v2.ts:444`), and pieces likewise, so attached-1 has neither. Its ring polygon is its body rect, and the ring thickness is `tOf(m)=T` unless DRAWN_THIN_WALLS. The validator's shared area obeys **(2T − w)·(d − 2T)** (thin-skip.ts table: 0.51/0.81/0.34/0.295 exactly). This equals `predictedOverlapM2` in the thin-body record. So a WALLS_OVERLAP between w1 and w3 forces w < 2T on the body rect, and therefore `thinBodies` MUST have flagged attached-1 in a 2.5.0 run. The run then went through `adjudicateThinBody`, and the refusal survives only if:
 1. **KEEP_PARTIAL** (source conflict, 0 or ≥2 buildable readings, or an elevation contradicting). This is the most likely case. reconstruct-v2.ts:1074 then adds an unresolved gap `"the body attached-1, X.XX m across"` (status AMBIGUOUS; reproduced on SLIVERTON by sliverton-discriminators.ts → `unresolved` contains `'the body attached-0, 0.60 m across'`, failure index 21, solver 2.5.0). A P2R run therefore has **one more unresolved item than the P2 run**, and the overlap area stays identical.
 2. A buildable decision that still overlaps (HIGH_RISK, reasoned): WIDEN can widen to `beyond.toS`, which can still be < 2T. DRAWN_THIN_WALLS takes `max(tn,tf)` < 0.85T, but nothing checks `2·max(tn,tf) < narrow`: e.g. tn=0.05, tf=0.24 with a 0.1 m paper gap fits in 0.39 m < 0.48 m. Both change the polygon or thickness, so the reported shared area would CHANGE from 0.3092. No gap is added.
 3. The axis is mis-picked when both sides are < 2T (axis = shorter side; the w1/w3 pair can still overlap). Edge case.
 **Decisive owner-side check** (no code change needed): on the fresh result card, open "Szczegóły analizy". (i) Źródło should say `solver 2.5.0`. (ii) "Nierozstrzygnięte" should contain "the body attached-1, … m across" with reason "narrower than its own two walls, and the source does not decide what it is: …". The `why` there names the reason (conflict/no reading/elevation). If 23 is unchanged from the P2 run AND that line is absent, the screen is not a 2.5.0 run. If the line is present, P2R ran and deliberately kept the partial preview: by design, not a stale screen.

## 1. Findings

**F-1 COVERAGE_GAP: thinBodies skips every mass with `storeyRects`/`pieceOf`, although those rings are refused the same way**
- FIRST_BAD: `packages/reconstruction/src/v2/thin-body.ts:thinBodies` l.100 (`if (m.role !== 'ATTACHED' || m.pieceOf || m.storeyRects?.length) continue`). It also tests only the body rect `m.x0..x1`, never `rectAt(m, storey)`, which is what `emit.ts` l.186 builds the ring from.
- Input: an ATTACHED body measured on storey 1 (3 m wide) whose storey-0 own footprint is a 0.45 m strip (T=0.30). Also a thin piece `attached-0-s1-1`, and a body whose own rect is thin but has storeyRects.
- Current: `thinBodies` returns only the plain body. `ring-attached-1-0` (polygon from rectAt) fails `WALLS_OVERLAP: ring-attached-1-0-w1 and -w3 share 0.5100 m²`, so the run falls back to the N7-P1 partial preview with no thin-body record and no gap.
- Correct: adjudicate per storey on `rectAt(m, s)` (pieces included), or at least record why such a body was not adjudicated.
- Test missing: `packages/reconstruction/test/thin-body-n7-p2r.test.ts` only builds masses without storeyRects/pieceOf. The corpus has no thin ring at all (scan of r1/*/program.json: every ring ≥ 3T), so P2R is exercised on real data only by the research `narrowMass` injection.
- Repro: `npx vite-node research/analyzer-n7-council/F/thin-skip.ts`
- Impact on the owner's case: none (single level, see 0.6). It is a general gap for multi-storey houses.

**F-2 COVERAGE_GAP (Android provenance): a stored analysis does not record or show which analyzer produced it**
- FIRST_BAD: `apps/android/.../analyzer/AnalysisTracker.kt:recordOf` drops `summary.analyzer`. `scene/DownloadedScenes.kt AnalysisRecord/DownloadedSceneEntry` have no analyzer/solver field. `ui/HouseSheets.kt` shows the stored partial-preview block (checkpoint hash and all) without any version. `LocalRuns` does not render the stored `analyzerSolver`.
- Current: after restart, the house sheet shows "Model częściowy 3D … Punkt kontrolny: 16 poleceń, model 1f9f85c22a83" for P2 and P2R runs alike. The only discriminator is the 8-hex candidate hash in the subtitle.
- Correct: store `analyzer.service/solver` (and the bundle sha256) in the entry and show it next to the partial block. Show the unresolved list from the stored record, not only when `resultShown`.
- Test missing: `DownloadedScenesTest` / `LocalAnalysisTest` do not assert any analyzer version in the entry. This is exactly why the owner's screenshot "does not prove a new run".

**F-3 HIGH_RISK: P2R decisions that build can still be refused with the same code**
WIDEN to a far band still < 2T, and DRAWN_THIN_WALLS with `2·max(tn,tf) ≥ narrow`, are not re-checked against `2t < narrow` before they are applied (`thin-body.ts` decision block; `reconstruct-v2.ts:1063–1065`). No gap is added in either case. Reasoned only; it would show on the phone as a CHANGED shared area.

**F-4 NOT_A_DEFECT (misreading): the identical checkpoint hash.** See 0.4.

**F-5 NOT_A_DEFECT: an old bundle or old cache on the phone.** See 0.1 and 0.2.

**F-6 DESIGN_LIMITATION / minor UI: two different "openings" numbers**
"Odczytano: … N otworów" uses `counts.openings = b.openings + b.sharedDoors` (planned, including openings the partial preview skipped). "Co udało się odtworzyć … otwory" uses `model.openings` (built). SLIVERTON: 6 vs 7. Both are labelled correctly, but the owner may read "26" from either. `partial_built_rows` shows `roofs + roofPlanes` as one "dachy" number.

**F-7 HIGH_RISK (reproductions only)**: the stale `apps/local-analyzer/dist` (pre-N7). See 0.1.

## 2. Function inventory (my path)
FILE → FUNCTION → INPUT → ASSUMPTIONS → POSSIBLE FAILURE → EFFECT → EXISTING TEST → VERDICT
- build.gradle.kts → BundleLocalAnalyzerTask.bundle → workspace TS → node on PATH → wrong node/ICU → bundle differs → none → OK (never up-to-date)
- apps/local-analyzer/build.mjs → bundleLocalAnalyzer → src/analyzer.ts → esbuild inlines workspace → stale `dist/` if not rerun → desktop runs old code → none → F-7
- LocalRuntimeFiles.kt → install → APK manifest → manifest sha correct → asset ≠ manifest → IOException RUNTIME_INSTALL_FAILED → LocalRuntimeFilesTest → OK
- LocalAnalysis.kt → start/begin → URL → one job at a time → none → — → LocalAnalysisTest → OK
- LocalAnalysis.kt → Run.onLine(Hello) → protocol, analyzer versions → protocol equal → mismatch → RUNTIME_PROTOCOL → LocalAnalysisTest → OK; versions kept only in LocalRunReport (F-2)
- LocalAnalysis.kt → importScene → summary.json + scene.json → hashes match done event → mismatch → HashMismatch → LocalAnalysisTest → OK
- LocalAnalyzerService.kt → start → program path → fresh process → reused process → RUNTIME_REUSED → device test → OK
- AnalysisTracker.kt → recordOf → AnalysisSummary → record = what to show → drops analyzer version → stored result unattributable → none → F-2
- DownloadedScenes.kt → save → bytes + record → key by scene sha → same model from a new solver merges into the old entry (record replaced) → old key, new record → DownloadedScenesTest → OK, but there is no version to see (F-2)
- DownloadedScenes.kt → load → key → file sha → tamper → DAMAGED → DownloadedScenesTest → OK
- PreviewOutcome.kt → data class → JSON `preview` → missing ⇒ COMPLETE → older analyzer reads as complete → — → OK (documented)
- AnalyzerScreen.kt → Result / PreviewOutcomeDetails → summary → counts off summary → two opening numbers → confusion → none → F-6
- HouseSheets.kt → source sheet → stored entry → `resultShown` gate → stored view hides unresolved and version → stale/new indistinguishable → none → F-2
- AnalyzerViewModel.kt → init/resume, selectMode → settings.activeJob → service job resumes after update → server-version result → — → HIGH_RISK (service only)
- analysis-service/run.ts → runAnalysis counts/preview → reconstruction → counts.masses = b.masses (incl. refused) → "3 bryły" counts a body not built → — → DESIGN (labelled "Odczytano")
- analysis-service/preview.ts → previewOf → model + partialPreview → built counted off the sealed model → — → partial-preview tests → OK
- candidate.ts → previewCheckpoint → program → prefix to the last main slab/ring → hash blind to attached bodies and solver → misread as staleness → partial-preview-n7-p1.test → OK (F-4)
- candidate.ts → cutFailedObject → program, failedAt → ids `slab|ring-<mass>-<n>` → `${m}-` prefix also takes pieces of m (intended) → — → n7-p1 tests → OK
- candidate.ts → fitPreviewProgram → program → ≤12 cuts → — → — → n7-p1 tests → OK on my path
- v2/thin-body.ts → thinBodies → masses, T → body rect is the ring → storeyRects/pieces skipped → refused rings with no adjudication → no test → F-1
- v2/thin-body.ts → adjudicateThinBody → plan ink, chains, views → buildable kinds yield valid walls → widen/drawnT still < 2T → same refusal, no gap → thin-body tests (happy cases) → F-3
- v2/emit.ts → mass loop → masses → ring = rectAt, thickness tOf → — → as F-1 → — → OK
- v2/building.ts → rectAt → mass, storey → storeyRects override → — → — → OK

## 3. Silent failures noted
- A thin body with storeyRects or pieceOf: no thin-body record, no gap, only the partial preview (F-1).
- A stored partial preview has no analyzer version (F-2); `LocalRunReport.analyzerSolver` is stored but never shown.
- An adjudication decision that builds is not re-validated against 2t < width (F-3).

## Top 3 by impact
1. **Total model refusal / lost bodies:** F-1. The thin-body pass is blind to storeyRects and pieces in multi-storey houses, which fall back to the partial preview without adjudication. It does not explain the owner's single-level case.
2. **Owner's case:** the deduction in 0.5–0.6. Single level, so attached-1 must have been adjudicated in 2.5.0, and the refusal stands only via KEEP_PARTIAL (or F-3). The proof is one line on the fresh result card: "the body attached-1, … m across" under Nierozstrzygnięte, plus `solver 2.5.0`. The checkpoint hash is NOT evidence either way (F-4).
3. **Invisible/unattributable model on Android:** F-2. The stored result does not say which analyzer made it, so a screenshot of the house sheet cannot tell P2 from P2R.

## Notes for refutation round
- Any claim that "the phone ran an old bundle" must address `install()` re-hashing on every start and the APK content (thinBodies, 2.5.0).
- Any claim that "storeyRects/pieces explain the owner's case" must address checkpoint = 16 ⇒ one level.
- Any claim of "P2R had no effect" must check whether the run carries the "the body attached-1" gap.
