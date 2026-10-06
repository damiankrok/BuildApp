**Council D (deployment / runtime), BUILDPLAN-ANALYZER-005I @ c90ffd9: CONDITIONAL PASS**

I found no P0. The app, the APK bundle and determinism are sound. Before freeze, D1 must be fixed (P1). D2 and D3 should be fixed too (P2).

**What I checked and found passing**
- **Bundle build.** `node apps/local-analyzer/build.mjs --out /tmp/claude-0/reviewD/dist` builds. It writes only to `--out`.
  - `analyzer.mjs` is 2 206 106 B, which is +37 819 B over the pre-005I `dist`.
  - The esbuild metafile has no `research/` input, no evidence-pack and no new dependency.
- **Android.**
  - The Kotlin side (`AnalyzerDtos.kt:217-252`) reads the summary only as strings: hashes, plus `analyzer.solver` for display.
  - No field it reads changed or went away. In the fixtures, only `metricEvidenceHash` and `candidateHash` changed; `modelHash` and the scene are unchanged.
  - The Kotlin tests take hashes from the fixture files themselves.
  - `android-contract.test.ts` passes.
- **Tests.**
  - The local-analyzer suite passes 80/80. I ran it with a real Node 18.20.4 (downloaded to scratch, sha256 checked), which ran the Node 18 and Node-18-without-ICU parity tests. Both buildings match the desktop hash for hash.
  - The targeted 005I tests (118) pass.
  - The CI pack/metrics subset (154 tests: evidence-pack, generalization, extract, chains, metric-solution, plan-extent, plan-decomposition, plan-resolution) passes.
  - `tsc --noEmit` is clean.
- **Old evidence packs.** `evidence:verify` reports all 28 committed 1.0.0 packs (005d, 005e, 005f, 005h) as ok.
- **Old metric evidence sets.**
  - Sets at 1.1.0–1.5.0 still parse, except two 1.2.0 sets that fail `confidence ≤ 1`.
  - Sets at ≤1.3.0 no longer match their stored hash.
  - Both failures predate 005I: `hash.ts` and those schema members are unchanged. Sets at 1.4.0 and 1.5.0 re-hash correctly.
- **Old side values.** Nothing reads `BASELINE`, `THROUGH` or `TOP`. The only hits are a research fusion-config name.
- **Determinism.**
  - The new code uses no Intl, locale, Date or `Math.random`, and compares strings with `<`.
  - Labels and lines are put in a canonical order. The Hungarian breaks ties by canonical column order, and costs are rounded with `round6`.
  - The AMBIGUOUS threshold (0.1) absorbs float noise.
  - `markLabelInk`, `refuteByWalls` and `endSpanSupport` do not depend on input order (`refuteByWalls` ties go to chainId).

**Findings**

**D1 (P1): the metric-evidence hash does not cover the 005I fields that reconstruction now reads.**
- `hash.ts:71-81` (`chainMember`) and `:126-145` leave out `segments[].labelled`, `chains[].topology` and `dimensionTopology`.
- `marks` are also left out, as they have been since 005D.
- But `plan-decomposition.ts:821,825` keeps or trims frame end spans based on `seg.labelled`, `topology.alignedEnds` and the mark classes. So two 1.7.0 sets with one `metricEvidenceHash` can produce different models.
- Repro: `npx vite-node /tmp/claude-0/reviewD/scripts/hash-gap.ts …/analyzer-005f/holdout/h1-dom-pod-milorzebem/metric-evidence.json`. Changing `labelled`, `topology`, `marks` and `dimensionTopology` leaves the hash at `afac36ac…`.
- Why before freeze: once 1.7.0/1.8.0 records are sealed, the hash function for those versions is fixed.
- Fix: add these members only when present, so older hashes are unchanged:
  - `...(s.labelled ? {labelled: true} : {})`
  - `...(c.topology ? {topology: c.topology} : {})`
  - marks the same way
  - a `dimensionTopology` part when the draft has one

  Then regenerate the contract fixtures.

**D2 (P2): the "bounded" path is not bounded.**
- At `axis-topology.ts:402-425`, a neighbourhood of more than `componentLabels` (96) labels skips the per-label re-solves. It still runs one exact Hungarian over all of it: O(n²·(slots+n)) time and dense n×(slots+n) JS arrays.
- There is no cap and no `checkpoint.tick`, so cancel and heartbeat wait for it to finish.
- Micro-benchmark (`/tmp/claude-0/reviewD/scripts/bench2.ts`; one dense neighbourhood; shared 4-vCPU box at load average ≈ 8):

  | case | Node 22 | Node 18 x86 |
  | --- | --- | --- |
  | exact, n = 96 | 0.41–0.51 s | 0.34 s |
  | bounded, n = 800 | 2.2 s | 1.5 s |
  | bounded, n = 1600 | 16.6 s | 10.8 s |

- `--jitless` with n = 96 takes 5.5 s.
- Phone estimate: about 2–4× slower per call. There are up to 6 calls per plan frame (legacy, one per orientation, final).
- The exact path is therefore fine. A pathological sheet with a large neighbourhood reaches minutes with no heartbeat; the app flags NoResponse at 45 s.
- No test ever produces `bounded: true`.
- Fix: add a hard cap (for example 400 labels), above which the labels are UNASSIGNED with `bounded` and a recorded gap. That fits precision before coverage. Add a checkpoint tick per neighbourhood and a test that reaches the bounded path.

**D3 (P2): the evidence that real sheets stay under the bounds is missing.**
- `architecture.md:65` and `post-review/resolution.md:27` (E11) cite a `performance.json` with assignment timings on the development frames and the largest neighbourhood met.
- No such file exists. The only `performance.json` is Track B's, and it has no assignment data.
- `scripts/topology-probe.ts` reports the largest axis group, not the largest neighbourhood. So "none on any development sheet comes near 96" is not shown anywhere.
- Fix: have the probe report the largest neighbourhood and the number of exact solves, run it over the final matrix, and commit the output.

**D4 (P3): `dimensionAxisGroups` is not permutation-canonical.**
- `axis-topology.ts:570` skips pairs by input index (`if (a >= b)`), and the CONTAINS branch at `:584` resolves equal ranges by that order.
- As a result, relation direction and which chain gets `PARTIAL` depend on the order chains come in.
- Repro: `/tmp/claude-0/reviewD/scripts/groups-order.ts` gives `C CONTAINS B` / B PARTIAL in one order and `B CONTAINS C` / C PARTIAL in the other.
- It is deterministic for the same bytes, and reconstruction reads only `alignedEnds`, which is symmetric.
- The 24-permutation probe covers `assignLabels` only.
- Fix: iterate pairs by sorted position and break CONTAINS ties by chainId.

**D5 (P3): version compare is lexicographic.** `requiredFiles` (`pack.ts:26`) compares versions with `version < since`. That is right for 1.0.0 and 1.1.0 but wrong once a component reaches 10 (for example 1.10.0 against 1.9.0). Fix: compare numerically.

**D6 (P3): schema 1.7.0 changed shape inside the stage.**
- c150896 wrote `side: BASELINE|THROUGH|TOP` and no `sideConventions`. bc22547 writes `BEFORE|ACROSS|AFTER` and requires `sideConventions`. Both are 1.7.0.
- Any c150896 set (CI artifacts, council runs) now fails a strict parse. No committed record has the old values.
- Hashes still differ, because `metrics.axis-topology` went 1.0.0→1.1.0 in the hashed extractor list.
- Acceptable before freeze; declare c150896 sets void in the report.
- Also: the comment at `extract.ts:852` ("is a 1.5.0 set, byte for byte") is stale.

**D7 (P3): reconstruction behaviour changed with no version naming it.**
- End spans and `refuteByWalls` (`plan-decomposition.ts:941-990`) change the frame extent and set `weak`.
- Yet `SOLVER_V2_VERSION` (2.3.0), `PLAN_RESOLVER_VERSION` and `ANALYSIS_SERVICE_VERSION` are unchanged, so `result.analyzer` and the dev-row `ANALYZER_VERSIONS` cannot tell 005H reconstruction from 005I. Earlier stages followed the same precedent.
- Fix: add a `plan-extent` version to `ANALYZER_VERSIONS`. That avoids churning the contract fixtures.

**D8 (P3): Track B's figures are plausible, but two statements need correcting.**
- **APK baseline is stale.** `deployment-estimate.md:7,19` uses the 005F APK (30 785 427 B) and says MobileSAM's ≈36.6 MB is "more than the whole current APK". 005H's APK is 39 419 927 B (`STAGE_…_005H…md:395,409`). The conclusion stands (about +93 %), but that sentence is now false.
- **"Peak RSS" is an RSS-after reading.** The WASM-probe figure is RSS after inference, sampled every 20 ms on an event loop the single-thread WASM blocks. Label it as RSS after inference, a lower bound on the peak.
- **The rest checks out.**
  - Parameter counts match file sizes: 8.56 M × 4 B ≈ 34.2 MB, and 10.13 M × 4 B ≈ 40.5 MB.
  - WASM runs about 3× slower than PyTorch on one thread (59.6 s vs 18.3 s; 7.7 s vs 2.6 s).
  - The shared-box and not-a-phone caveats are stated.
  - "Nothing deployable" is consistent with the evidence, and `BEST_BOUNDARY_CANDIDATE: NONE` follows from it.

**CI outlook**
- The Android contract, local-analyzer host parity on Node 18 and without ICU, the unit and architecture suites, and `evidence:verify` should pass. Each dev row verifies its own pack, and the 1.1.0 builder always writes `07b`.
- Not verified, because these need publisher pixels:
  - Marcówki and Kosaćce pinned models: only G2E `9f5fd342` was reported reproduced.
  - Rows that replay pre-005D sealed metric evidence through the new `refuteByWalls`, which now applies on every sheet with a wall witness and marks frames weak:
    - the analyzer-generalization known set (kosacce-area-copy-alone, eoze-*)
    - second-house pre-fix, which expects FAILED / PLAN_LAYOUT_REJECTED
  - Confirm these before freeze.
- The evidence-pack job verifies 005d, 005e and 005f, but not `005h/blind-round/evidence`. Those packs pass locally.

**Notes**
- HEAD moved to 5b6d14c during the review: CI rows for the two round-7 houses, with no change to package or app code.
- The working tree also shows modified `research/…/providers/*.py`. That is not mine; I wrote nothing under `/home/user/BuildApp`.
- Scratch, scripts and logs are in `/tmp/claude-0/reviewD/`.
