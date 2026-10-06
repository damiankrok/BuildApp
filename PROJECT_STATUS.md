# BuildApp — project status

> Operational file. Updated at the end of every stage by the implementation
> agent. The external orchestrator owns long-term direction; this file records
> what actually exists.

> **Stage-report convention (from BUILDPLAN-ANALYZER-005G, preferred for every future stage).** The complete report
> is committed to `stage-reports/STAGE_<ID>.md` (with its artifacts under `stage-reports/artifacts/`); the chat
> handoff to the coordinator is only the short block — `STAGE`, `VERDICT`, `BRANCH`, `HEAD`, `CI`, `FULL_REPORT`,
> `TOP_RECOMMENDATION`, `ADOPT_NEXT`, `IMPORTANT_REJECT/DEFER`, `NEXT_STEP`, `FINAL_TOKEN` — at most about twelve
> lines. The full report is never pasted into chat.

## Completed stages

| stage | branch | final commit | result |
| --- | --- | --- | --- |
| STAGE BUILDAPP-00 — BUILDWORLD / SEMANTIC BUILDING EDITOR / BUILDING DSL | `claude/buildapp-buildworld-v1-7y6yqh` | `da01f5d328fc2d4f54aabb6b8fff669508d2d805` | PASS |
| STAGE BUILDAPP-00A — WALL TOPOLOGY / JUNCTIONS / ANALYZER-FRIENDLY WALL RINGS | `claude/buildapp-buildworld-v1-7y6yqh` (same harness-designated branch; no suffix was forced beyond the one recorded in BUILDAPP-00) | implementation `50a46370994e3cad7180857a19b87a9f9979d43f`; docs `a8ac902cc4e74f2102adb5b9e1b56bc341a04cf1`; the final HEAD is the one commit above the docs commit that records these SHAs (see `stage-reports/STAGE_BUILDAPP_00A.md` and `git log`) | PASS |
| STAGE BUILDAPP-01 — MARCÓWKI REFERENCE MODEL THROUGH THE REAL BUILDING DSL | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `0df518186bb61b8a365cd9fc11d68ad875be88ca`; implementation `7a6d6168d44f2c75eb0a6bd0974ed1cda72e4478`; docs: the commit that carries `stage-reports/STAGE_BUILDAPP_01.md` and this row | PASS |
| STAGE BUILDAPP-01A — MARCÓWKI ARCHITECTURAL FIDELITY CLOSURE | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `d40fa39733c80bf0b1e35c2233c8ea8ba0c542b7`; implementation `2de2f26328ec45ad99b47da0d9d956e8bc4d4cf9`; docs: the commit that carries `stage-reports/STAGE_BUILDAPP_01A.md` and this row (the final HEAD, see `git log`) | PASS |
| STAGE BUILDAPP-01M — ANDROID BUILDWORLD MODEL PREVIEW APK | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `2949580af66f4d7ec848793a9469763afc4209f5`; implementation and docs: the commit that carries `stage-reports/STAGE_BUILDAPP_01M.md` and this row | PASS |
| STAGE BUILDAPP-02 — SOURCEPACKAGE + VISUAL SOURCE OBSERVATION GRAPH | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `dc6407e95f308fedfef064f09582ffa4df230810`; implementation `2b92d1f`; docs `ced70f0` | PASS |
| STAGE BUILDAPP-03 — PRIMITIVE RECONSTRUCTION + METRIC SOLVER | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `ced70f0dba7d32caa32ef726a5118643796a80fe`; implementation `361e466`, `5ab618b`, `fad9f39`, `8524a89`; docs `c1a9872` and the commit that carries this row (the final HEAD, see `git log`) | PASS |
| STAGE BUILDAPP-03M-FIX — ANDROID AUTO CANDIDATE RENDERING | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `f3766237840514fc60178ca6c9bf4f3c9e13ebbd`; CI micro-task `781d6d6`, `13108e5`; implementation and docs: the commit that carries `stage-reports/STAGE_BUILDAPP_03M_FIX.md` and this row | PASS |
| STAGE BUILDAPP-03R1 — IMAGE METROLOGY + PROPORTIONAL FACADE FITTING | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `4505e148cf03197b899d49c5335ed893e013ab1d`; implementation `c4c8816`, `ed83d0d`, `c315a35`, `0ec3291`, `067fd41`, `3ee3277`; docs: the commit that carries `stage-reports/STAGE_BUILDAPP_03R1_IMAGE_METROLOGY.md` and this row | PASS |
| STAGE BUILDAPP-03X — ANALYZER REFOUNDATION AUDIT + MARCÓWKI AUTO V2 | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `d5d6375d8675143730307d71f45c0d940fcd134b`; research `9363d6b`; audit and v2 schemas `13896a1`; pipeline `59d5676`; callouts, gates, apps and CI `7e01828`; fixtures, ridge axis and docs `606c829`; test runner `9f67eb9` (CI run 36057369183 green); docs: the commit that carries this row (the final HEAD, see `git log`) | PASS (owner review is the final gate) |
| STAGE BUILDAPP-03Y — EXTERIOR CLOSURE AND SEMANTIC STYLING | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `31dced4a42a92ad18f446d8dfe870e0c59b95a98`; implementation `1a9f514`, `ba71193`, `1437954`, `74d4646`, `603eb2e` (CI run 36240702093 green; APK artifact 10905870947, versionCode 1029); docs `9de7979` | **PASS — owner-accepted** (Auto v3 reviewed and accepted on the owner's phone) |
| STAGE BUILDAPP-03Y1 — IN-APP LINK ANALYZER + STABLE MOBILE CAMERA | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `9de7979c78468e91ce2ba29438258b527de5ffac`; implementation `aaa7f69`, `a1e1b13`, `950d401`, `7d9c85f`; docs: the commit that carries this row (see `stage-reports/STAGE_BUILDAPP_03Y1_IN_APP_ANALYZER_AND_GESTURES.md`) | **INFRASTRUCTURE BUILT — backend not mandatory** — all code, tests and CI green (run 36248477257; APK artifact 10908651204, versionCode 1034). The analyzer API is built but not deployed (no hosting credential). Since 03Y2 the phone analyses a link itself, so the service is an optional fallback, not a gate. Recorded at 03Y1: `BLOCKED_STAGE_BUILDAPP_03Y1_ANALYZER_SERVICE_NOT_DEPLOYED` |
| STAGE BUILDAPP-03Y2 — EMBEDDED LOCAL ANALYZER RUNTIME PROOF | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `743bb26dfec85658f643ac71797153832ebd20da`; implementation `ec25e4f`, `1b3e17e`, `55c50cc`; docs: the commit that carries this row (see `stage-reports/STAGE_BUILDAPP_03Y2_EMBEDDED_LOCAL_ANALYZER.md`) | **PASS — proof succeeded; Marcówki confirmed on the owner's phone.** The production analyzer runs inside the APK (nodejs-mobile 18.20.4). On an Android 14 x86_64 emulator in CI it analysed the live Marcówki URL (215.5 s and 142.1 s, peak 1 788 / 1 791 MiB, model `4a8e8ddc…` = desktop) and matched every desktop hash on the fixture. arm64 APK 29 911 875 B (+18 000 437 B). The owner then ran Marcówki locally on the arm64 phone. Recorded at 03Y2: `LOCAL_ANALYZER_PROOF_PARTIAL` (the phone had not been run yet) |
| STAGE BUILDAPP-03Y2G — GENERIC PLAN DECOMPOSITION + FAILURE DIAGNOSTICS + RARYTASY GENERALIZATION GATE | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `87c05889ade457fc3e6c5055ccff4589bff5c1e5`; implementation `a69af63`, `55f2c1c`, `7cfc534`, `4bc8178`, and the CI/docs commits after them; report `stage-reports/STAGE_BUILDAPP_03Y2G_GENERIC_PLAN_GENERALIZATION.md` | **CURRENT GATE**: **PARTIAL_STAGE_BUILDAPP_03Y2G_OWNER_PHONE_RECHECK_PENDING**. CI run 45 is green on all 10 jobs. The second house completes with one model (`b1d6d7b7…`) on desktop, on a fresh CI runner, on the APK's bundle on Node 18 without ICU, and on the Android 14 emulator (186.1 s, 2 096 MiB); Marcówki is unchanged; the direct APK asset is published; the owner's arm64 phone recheck decides PASS. |
| STAGE BUILDAPP-03G — ARCHITECTURAL PRIMITIVES AND ASSEMBLIES | `claude/buildapp-buildworld-v1-7y6yqh` | starting HEAD `4d171bd6f85ce172a13bfbe36fff447ffda10c22`; implementation `dd3c72a`, `40b9837`, `2294d5b`; report `281326a` (CI run 49 green on all 11 jobs, `architectural-assemblies` artifact 10921625262); this row's CI note: the commit after it | **PASS_STAGE_BUILDAPP_03G_ARCHITECTURAL_PRIMITIVES_AND_ASSEMBLIES** — schema 1.6.0: primitives, assemblies, typed relationships, UNKNOWN assemblies, capability registry, hypothesis pipeline (synthetic evidence only). 17/17 diversity fixtures and 8/8 pipeline demonstrations pass; Marcówki and the second house build the same buildings (hash changes schema-only, proven byte for byte). Not a claim of automatic recognition: the analyzer emits no 1.6.0 assembly yet. **03Y2G stays the open gate** (owner phone recheck) |
| STAGE BUILDPLAN-INTEGRATION-003A — UNIFIED PRESENTATION FOUNDATION | `integration/unified-buildplan-presentation-v1` (new branch from `claude/buildapp-buildworld-v1-7y6yqh` @ `c399a299a9a5034eb0242e51292eb3f7326fb17b`; donor BuildPlan-PC-Legacy `main` @ `b0e79675c7ebeacf718cd1392f62272fb400418b`, read only) | the commits listed in `stage-reports/STAGE_BUILDPLAN_INTEGRATION_003A_UNIFIED_PRESENTATION_FOUNDATION.md` | **PASS_BUILDPLAN_INTEGRATION_003A_UNIFIED_PRESENTATION_FOUNDATION** — the Android viewer shows the same BuildApp bundle in MODEL (unchanged), CLAY and LINE, with feature edges, a presentation-only roof covering and non-shadowing glass adapted from the donor viewer; model, compiler, mobile-scene and analyzer untouched, bundles byte-identical. Not seen on a GPU here (no GPU, no KVM): **owner phone visual check pending**; no owner acceptance is claimed. Not merged into the source branch |
| STAGE BUILDPLAN-INTEGRATION-003B — PRODUCT SHELL + RARYTASY FIDELITY | `integration/product-shell-rarytasy-v1` (from `integration/unified-buildplan-presentation-v1` @ `fb415e4`) | `8e8deb8`, `03922eb`, `76b6bde`, `a8d321e`, `17b58f4`, report `d2395b8`, owner APK CI `2d8ee75` (CI runs 53–55 green; owner APK run 55) | Product shell (Dom, 3D, Etapy, Koszty, Dokumenty) and the Rarytasy gabled garage (solver 2.1.0; Marcówki model hash unchanged). **Owner phone review: 3D showed a flat colour instead of the house** → fixed in 003C. Rarytasy stays PARTIAL (pergola, entrance canopy, second chimney) |
| STAGE BUILDPLAN-INTEGRATION-003C — IMMERSIVE WORKSPACE + CONSTRUCTION PROGRESS + 3D HOTFIX | `integration/immersive-progress-v1` (from `integration/product-shell-rarytasy-v1` @ `2d8ee75`; resumed at `30135c6`; donor Legacy `main` @ `b0e7967`, read only) | P0 fix `6e1dcf8`; progress `b247752`, `97541fe`, `4bf3757`; workspace `80b9887`; UI gate `70e4385`; Cycle 1 `de48ed7`, `cd60077`, `507d5c7`; Cycle 2 `83bb3dc`, `8f645b0`, `941cdb9`, `b25ccae`, `0ad5ef3`; Cycle 3 `af49ee7`; finish `89c8ad6`, `1169321`, `40cf940`; final build `6f9da1b` (CI run 73, green on every job); report: the commit that carries this row | **PASS_BUILDPLAN_INTEGRATION_003C_IMMERSIVE_PROGRESS_VERTICAL_SLICE_READY_FOR_OWNER** — the immersive product workspace ("The Folding Rule": Dom with the inked house and one figure, model-first 3D with the construction timeline / time machine, functional Etapy, honest Koszty / Dokumenty, Polish analyzer entry with "Model gotowy z ograniczeniami") built with Impeccable and taken through three audit → fix → verify cycles (critique 21 → 26/40; audit.native 13 → 15/20) and the finish review; no P0 / P1 left. Device gate on every run: the owner's journey at font 1.0 and 1.3, landscape, lifecycle / unhappy paths / collisions, and Marcówki + Rarytasy analysed through the app (model hashes unchanged; Rarytasy PARTIAL). OWNER APK versionCode 1073 (run 73, `6f9da1b`). Owner visual review pending |
| STAGE BUILDPLAN-INTEGRATION-004A — HOUSE-FIRST WORKSPACE + ADAPTIVE ANALYZER + KOSAĆCE TOPOLOGY | `integration/house-first-adaptive-analyzer-v1` (from `integration/immersive-progress-v1` @ `d199a0e`; donor Legacy `main` @ `b0e7967`, read only) | source `48034bc`, `e4e191d`, `a160561`; reconstruction `c3d47ff`, `b3dced2`; UI `7213834`; gates `b62a096`, `c42437e`, `43f052b`; cycles `fa31064`, `a9cca3e`, `93a72b6`, `0feddb4`, `1b80ba8`; device gates `f6b8a92`; report `1be45a7`, `54f0c1a`, `c3261a1`, `a14427c` and the commit that carries this row; final build `f6b8a92` (CI run 80, `workflow_dispatch` with the OWNER APK) | Three verdicts, recorded separately (§ "Where the house-first product stands"): **HOUSE-FIRST PRODUCT: TECHNICAL_PASS / OWNER_VISUAL_ACCEPTANCE_PENDING**; **ADAPTIVE SOURCE: PASS (router, generic reader, security) — the alternate Marcówki page is read and refused at reconstruction on evidence (PARTIAL for that one page, as the brief allows)**; **KOSAĆCE: PASS**. The house is the root (the 3D house full screen, one contextual sheet at a time, the analyzer as a task returning to the same house and camera, Koszty a named boundary); an unknown publisher is inspected, never rejected by hostname, and refused only with a typed reason; Kosaćce reconstructs without special-casing through the generic wall topology planner (`WALLS_OVERLAP` unchanged, Marcówki and Rarytasy byte-identical). Three Impeccable audit cycles closed every P1/P2; the OWNER checklist is in the report §AB. The terminal line is in the report |

| STAGE BUILDPLAN-ANALYZER-005A — GENERALIZATION COUNCIL + MULTI-HYPOTHESIS RESOLVER + TRUE PROGRESS TELEMETRY | `analyzer/generalization-council-v1` (from `integration/house-first-adaptive-analyzer-v1` @ `7cd8e0c`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | Council `ccdbd36`, `09fe527`; source `dbfe607`; resolver `f845d21`, `a3723ec`, `f1901e9`, `daf8b8c`; progress `69b0f93`, `5671e6f`, `5dbd0fb`, `968344a`, `a815ce5`, `1094d7c`; warnings `5c3fd22`, `dd664b6`; gates `18adefa`, `f466a64`, `f773a32`, `bdd7cb0`, `b7d7198`, `a3ace7a`; holdout `2bd2593`, `c77e5a8`, `883cb46`; post-Council `616c96e`; performance `56ca1e3` = **PRE_HOLDOUT_SHA** (CI run 96 green); holdout evidence `70636bc`; report `226f9ce` = final build (CI runs 97 and 98 green; run 98 is the `workflow_dispatch` with the OWNER APK, versionCode 1098); the APK record: the commit after it | Five verdicts, recorded separately (§ "Where the analyzer's generalization stands"): **ANALYZER GENERALIZATION ARCHITECTURE: PARTIAL**; **OWNER DEVELOPMENT CASES: PARTIAL**; **TRUE PROGRESS TELEMETRY: PASS**; **BLIND ARCHON HOLDOUT 1 (`dom-w-jablonkach`): ALGORITHMIC_FAIL**; **BLIND ARCHON HOLDOUT 2 (`willa-miranda`): ALGORITHMIC_FAIL**. Both blind houses stop on adequate drawings, on one shared defect below the resolver: rotated overall-dimension labels read upside down, which a circular chain correction or an interior extent turns into the wrong house. Not patched; next-stage input. The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005B — DIMENSION EVIDENCE REFOUNDATION + SCALE/EXTENT DECOUPLING + BLIND HOLDOUT ROUND 2 | `analyzer/dimension-evidence-refoundation-v1` (from `analyzer/generalization-council-v1` @ `bdacd42`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | reviews `c105add`; orientation `8d1204f`; scale `5896eb8`; extent `6401087`; resolver 1.3.0 `5f88060`; warnings/phone `bdbf033`; tests `daab627`; CI `9c9bfc1`; holdout protocol `8da1ee7`; acquisition router `598c1f0`; post-review `625b149`, `4a58bce`, `f57b2ad`; `27274ab` = **PRE_HOLDOUT_2_SHA** (CI run 101 green); holdout evidence `fb5b4af`; report `2e5a5bb` = final build (CI run 104 green, the `workflow_dispatch` with the OWNER APK, versionCode 1104; runs 102–103 superseded by the concurrency group); the APK record: the commit after it | Six verdicts (§ "Where metric truth stands"): **DIMENSION ORIENTATION: PASS**; **SCALE EVIDENCE INDEPENDENCE: PASS**; **PLAN EXTENT CLASSIFICATION: PARTIAL**; **OWNER DEVELOPMENT SET: PARTIAL**; **PROGRESS TELEMETRY: PASS**; **BLIND HOLDOUT ROUND 2: `dom-w-zurawkach` ALGORITHMIC_FAIL, `dom-w-modrzykach` ALGORITHMIC_FAIL** — both with the scale and printed extent right, both failing at the walled outline on a side of openings (willa-miranda's class). Not patched; next-stage input. The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005C — OPENING-AWARE EXTERIOR ENVELOPE + BODY RELATIONS + CROSS-PUBLISHER PROBE | `analyzer/opening-aware-envelope-v1` (from `analyzer/dimension-evidence-refoundation-v1` @ `d3235bf`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | baseline `3e76894`; round-3 protocol `e6220a9`, `cfa8640`; reviews `eef7133`, `2d45254`; boundary `7f3f557`, `a1913fc`; bodies `f62cd56`, `dfbec9f`; tests `1f26636`; source `432dbd2`, `b70aa41`, `64f7ff6`; Android `26b63e3`; matrix `1b330d3`; post-review `55a9c65`, `b0013ed`, `ca97516`; `e328121` = **PRE_HOLDOUT_3_SHA** (CI run 116 green, the UI gate on its re-run); holdout evidence and report `b3ad427` = final build (CI run 118 green, the `workflow_dispatch` with the OWNER APK, versionCode 1118; run 117 superseded by the concurrency group); the APK record: the commit after it | Seven verdicts (§ "Where the opening-aware envelope stands"): **OPENING-AWARE EXTERIOR ENVELOPE: PASS**; **ATTACHED BODY / BAY RECONSTRUCTION: PARTIAL**; **CROSS-PUBLISHER GENERIC SOURCE: PASS**; **005B METRIC LAYER REGRESSION: PASS**; **PROGRESS TELEMETRY: PASS**; **BLIND ARCHON ROUND 3 (`dom-w-azaliach`): ALGORITHMIC_FAIL**; **BLIND DOBREDOMY ROUND 3 (`galaktykaI`): SOURCE_LIMITED_PARTIAL**. The ARCHON house completes at −3.5 % but fails on storeys and on a plan only the published figure chose; its first bad decision is in the 005B metric layer (an overall chain split by a spurious tick, `1035` read `1055`). Not patched; next-stage input. The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005D — DIMENSION-CHAIN INTEGRITY + SPURIOUS-TICK REJECTION + OVERALL-SPAN CONSENSUS + ANALYZER EVIDENCE PACK | `analyzer/dimension-chain-integrity-v1` (from `analyzer/opening-aware-envelope-v1` @ `1b66eb9`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | reviews `7a18d21`; Evidence Pack `cc9f2ea`; metric topology `0a83a0f`; challenge `09c5121`; CI gates `6f3f996`; post-review `3e08681`; matrix and packs `286486e` = **PRE_HOLDOUT_4_SHA** (CI run 120 green); round-4 draw `bbe8172`; sealed blind runs `446207d`; report and status `d7a794f` = final build (CI run 124, the `workflow_dispatch` with the OWNER APK, versionCode 1124, green on its one re-run of two jobs that failed before any test ran; runs 121–123 superseded by the concurrency group); the APK record: the commit after it | Ten verdicts (§ "Where dimension-chain integrity stands"): **DIMENSION CHAIN TOPOLOGY: PASS**; **OCR LABEL-TO-SPAN BINDING: PARTIAL**; **METRIC EVIDENCE INDEPENDENCE: PARTIAL**; **CURRENT e-OZE DEVELOPMENT: PASS**; **LEGACY e-OZE COMPATIBILITY: PASS**; **ANALYZER EVIDENCE PACK: PASS**; **005C BOUNDARY REGRESSION: PASS**; **005C GENERIC SOURCE REGRESSION: PASS**; **BLIND ARCHON ROUND 4 / PROJECT 1 (`dom-w-dabecjach`): ALGORITHMIC_FAIL**; **BLIND ARCHON ROUND 4 / PROJECT 2 (`dom-w-tunbergiach`): ALGORITHMIC_FAIL**. Azalia's spurious tick is rejected and its overall bound across it; both blind houses fail on the overall label's value, misread outside the reader's bounded readings (`1580` → `1501`, `1173` → `1117`). Not patched; next-stage input. The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005E — NUMERIC OCR CANDIDATE LATTICE + GLYPH CONFIDENCE + NON-CIRCULAR SEQUENCE DECODING | `analyzer/numeric-ocr-lattice-v1` (from `analyzer/dimension-chain-integrity-v1` @ `d8ba4e8`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | reviews `39db89c`; lattice `0427773`; metric `af9f2ca`, `d4bf229`, `8b8bd39`; adversaries `a8ba3db`; post-review `ebd64eb`; CI rows and round-4 evidence `9f7423d` = **PRE_HOLDOUT_5_SHA** (CI run 131 green); round-5 draw `0afd751`; sealed blind runs `18295c2`; report and status `dab64d6` = final build (CI run 135, the `workflow_dispatch` with the OWNER APK, versionCode 1135, green at the first attempt); the APK record: the commit after it | Ten verdicts (§ "Where the numeric reader stands"): **NUMERIC OCR CANDIDATE RECALL: PARTIAL**; **MULTI-GLYPH SEQUENCE DECODING: PARTIAL**; **OCR CONFIDENCE CALIBRATION: PARTIAL**; **METRIC EVIDENCE INDEPENDENCE: PASS** (legacy-chain exemption declared); **FALSE CONSENSUS PROTECTION: PASS**; **CURRENT e-OZE: PASS**; **005D CHAIN TOPOLOGY REGRESSION: PASS**; **ANALYZER EVIDENCE PACK: PASS**; **BLIND ROUND 5 PROJECT 1 (`dom-w-modrzewnicy`): ALGORITHMIC_FAIL** (numeric reader: a condensed overall cut into three cells; refused, no scale adopted); **BLIND ROUND 5 PROJECT 2 (`dom-w-morelach`): ALGORITHMIC_FAIL** (envelope, on a right scale). The round-4 houses are fixed generically (dabecjach REPLACED/STRONG at the printed scale; tunbergiach −12.47 % → −0.54 %). Not patched; next-stage input. The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005F — ADAPTIVE GLYPH-COUNT SEGMENTATION + EXTENT-CONSISTENT ENVELOPE | `analyzer/adaptive-segmentation-envelope-v1` (from `analyzer/numeric-ocr-lattice-v1` @ `9b619ec`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | reviews `e6f76d2`; count hypotheses `5eb2a5b`; typed refusal `8906546`; extent conflict and completions `177dfca`; pack layers `489e2b5`; class bars `d910212`; post-review `4fd2f8e`, `65ebbdd`, `2e1889a`, `ac5c5fc`, `f64fda9`, `41e26be` (the matrix's finding); matrix and evidence `65ae015` = **PRE_HOLDOUT_6_SHA** (CI run 145 green); round-6 draw `951a4d0`; sealed blind runs `43c6670`; report and status `05c53c5` (CI run 149 red: the hard-code guard read the preposition in a sealed blind name; one UI-gate timeout); the guard's registry fix `6b22582` (test only) = final build (CI run 151 green at the first attempt, the `workflow_dispatch` with the OWNER APK, versionCode 1151); the APK record: the commit after it | Ten verdicts (§ "Where glyph counts and the envelope stand"): **ADAPTIVE GLYPH-COUNT SEGMENTATION: PARTIAL**; **CONDENSED NUMERIC LABEL RECALL: PARTIAL**; **NUMERIC OCR NON-CIRCULARITY: PASS**; **EXTENT-CONSISTENT ENVELOPE: PARTIAL**; **ATTACHED BODY COMPLETION: PARTIAL**; **TERRACE / FALSE-CLOSURE SAFETY: PASS**; **ANALYZER EVIDENCE PACK: PASS**; **CURRENT e-OZE: PASS**; **BLIND ROUND 6 PROJECT 1 (`dom-pod-milorzebem`): ALGORITHMIC_FAIL** (a confident misread at the right count; refused, no scale adopted); **BLIND ROUND 6 PROJECT 2 (`dom-w-helikoniach`): ALGORITHMIC_FAIL** (upper-plan scale; ground outline). Morelach is fixed generically (−11.54 % → −3.12 %, PASS); modrzewnicy is not (its count is right, its `9` still reads `4`). Not patched; next-stage input. The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005G — OPEN-SOURCE ANALYZER TECHNOLOGY AUDIT + CONTROLLED BAKE-OFF | `analyzer/open-source-technology-audit-v1` (from `analyzer/adaptive-segmentation-envelope-v1` @ `6b4ab1f`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | audit, research harness and report: the commits after `6b4ab1f` on the branch (`git log analyzer/open-source-technology-audit-v1 ^6b4ab1f`); CI run 153 green on `2c6b615`; the CI record: the commit after it | **PASS_BUILDPLAN_ANALYZER_005G_OPEN_SOURCE_TECH_AUDIT_READY_FOR_COORDINATOR** — audit and bake-off only, **no production change** (§ "Where the open-source technology audit stands"). On the same 775 crops (103 real, 672 synthetic) the production reader trusts 309 readings and 75 are wrong; PaddleOCR PP-OCRv6 tiny (official ONNX, Apache-2.0, 4.46 MB) is wrong in 4 of 707 (real: 103/103 exact, 0 of 99). It runs as ONNX Runtime Web (WASM) inside the existing Node-18 analyzer bundle, bit-identical across Node 18/22 and arm64 V8. **ADOPT_NEXT:** PP-OCRv6 tiny on onnxruntime-web, as an ensemble member with a stability bracket (005H). PILOT: PDF.js document evidence (after 005H). REJECT: ONNX Runtime Android (telemetry provider + permissions ≥ 1.29, second engine), Tesseract, ML Kit, OpenCV Android, every pretrained floor-plan model (weights/data) |
| STAGE BUILDPLAN-ANALYZER-005H — EXTERNAL NUMERIC RECOGNISER ENSEMBLE + ARM64 DEVICE PARITY + FRESH BLIND ROUND | `analyzer/external-numeric-recogniser-v1` (from `analyzer/open-source-technology-audit-v1` @ `c6fe174`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | recogniser, seam, rule, packaging, self-test, tests, CI `d04ebc4` (CI 155 red: a bundle job without the model); red-team fixes `d14304c` (CI 156 red: the worker's loader copy under `/tmp` on Android); the Android loader copy and coded failures `5315ff8` = **PRE_HOLDOUT_7_SHA** (CI run 157 green); round-7 draw `6e931ee`; blind runs, parity, measurements `85ccf42`; report and status `863b525` = final build (CI run 160 green at the first attempt, the `workflow_dispatch` with the OWNER APK, versionCode 1160, APK sha256 `c9cf22da…`); the APK record: the commit after it | Eleven verdicts (§ "Where the external numeric recogniser stands"): **EXTERNAL NUMERIC RECOGNISER INTEGRATION: PASS**; **OCR ENSEMBLE NON-CIRCULARITY: PASS**; **NUMERIC TARGET LABELS: PARTIAL**; **NODE PARITY: PASS**; **X86 EMULATOR PARITY: PASS**; **ARM64 DEVICE PARITY: PENDING** (no phone reachable; QEMU arm64 MATCH is supplementary only); **OCR MEMORY / LIFECYCLE: PASS**; **EVIDENCE PACK: PASS**; **CURRENT e-OZE: PASS**; **BLIND ROUND 7 PROJECT 1 (`dom-pod-jarzabem`): ALGORITHMIC_FAIL** (label binding between parallel chains; not OCR); **BLIND ROUND 7 PROJECT 2 (`dom-w-arkadiach`): PASS** (decided by the external reader). The terminal line is PARTIAL |
| STAGE BUILDPLAN-ANALYZER-005I — PARALLEL DIMENSION TOPOLOGY + BOUNDARY OBSERVATION BAKE-OFF + FRESH BLIND ROUND 8 | `analyzer/dimension-topology-boundary-bakeoff-v1` (from `analyzer/external-numeric-recogniser-v1` @ `29ab643`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | topology `c150896`; council fixes `bc22547`, `16bcd73`, `c0ad2e8` (the frozen production code); Track B research `c90ffd9` … `bfcfb1f`; development matrix and records `869cb01` = **PRE_HOLDOUT_8_SHA** (CI run 169 green); round-8 draw `0c67728`; blind round, report and status `a7f009a` = final build (CI run 172 green at the first attempt, the `workflow_dispatch` with the OWNER APK, versionCode 1172, APK sha256 `70b4ff90…`); the APK record: the commit after it | **DIMENSION TOPOLOGY: PARTIAL** — the blind-7 label-binding defect is fixed generically and `dom-pod-jarzabem` now completes; OCR byte-identical; no development verdict changed; but both blind-8 houses are ALGORITHMIC_FAIL on boundary interpretation downstream of a correct metric. **BOUNDARY OBSERVATION BAKE-OFF: PASS_RESEARCH**, BEST_BOUNDARY_CANDIDATE **NONE** (ELSED DEFER, DeepLSD REJECT, MobileSAM REJECT), PRODUCTION_INTEGRATION NONE_IN_005I. INHERITED ARM64 DEVICE PARITY: PENDING. Terminal line PARTIAL (§ "Where the dimension topology and the boundary bake-off stand") |
| STAGE BUILDPLAN-ANALYZER-005J — FLOORPLAN INTELLIGENCE TECHNOLOGY AUDIT + VISUAL REFEREE OPPORTUNITY MAP + TRAINING ROUTE | `analyzer/floorplan-intelligence-audit-v1` (from `analyzer/dimension-topology-boundary-bakeoff-v1` @ `64b78b4`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | research harness, artifacts and report: the commits after `64b78b4` on the branch (`git log analyzer/floorplan-intelligence-audit-v1 ^64b78b4`); ⟪CI_CELL⟫ | ⟪STATUS_RESULT⟫ — research and audit only, **no production change** (§ "Where the floor-plan intelligence audit stands"). Small VLMs (Florence-2, SmolVLM2, Moondream) at or below chance on BuildPlan's closed questions; no commercially clean floor-plan model exists; a from-scratch BuildPlan-trained UNet-lite (6 MB) is a clean research proof. In an oracle replay of the frozen code, a deterministic drawn-gap upgrade completes `dom-w-gozdzikowcach`'s footprint exactly as a perfect witness does, and nothing moves a verdict. **PRIMARY_NEXT: NO_AI_YET** (005K: per-gap evidence records, a sealed fresh-sheet gap set, the deterministic upgrade measured on it). SECONDARY_LATER: TRAIN_BUILDPLAN_WALL_MODEL as the challenger. REJECT: small-VLM referee, every pretrained floor-plan model |
## Current capabilities

- **CanonicalBuildingModel** (`packages/model`): versioned Zod schema
  (`buildapp.canonical-building-model` **1.6.0**; 1.5.0 added `terraces`
  and roof edge members, 1.6.0 the architectural language — roof planes and
  edges, wall panels, platforms, exterior step runs, assemblies, typed
  relationships, member roles and end cuts, see
  `docs/ARCHITECTURAL_LANGUAGE.md`), explicit units and world
  frame recorded in every file, stable ids, evidence vocabulary (SOURCE_EXACT …
  UNRESOLVED) per object and per property, referential and geometric
  validation with named codes, deterministic canonical JSON save/load.
  Schema 1.2.0 (BUILDAPP-01) adds raked opening heads (`Opening.head`),
  multi-leaf openings (`Opening.leaves`), explicit window mullions, and the
  `roofOpenings` (ROOFLIGHT / PENETRATION) and `rooflights` collections,
  with codes `FILL_PROFILE_UNSUPPORTED`, `OPENING_LEAF_INVALID`,
  `OPENING_LEAF_LEVEL_MISMATCH`, `OPENING_LEAF_NOT_PARALLEL`,
  `UNKNOWN_ROOF_OPENING`, `ROOF_OPENING_OUTSIDE_HOST`,
  `ROOF_OPENING_CROSSES_RIDGE`, `ROOF_OPENINGS_OVERLAP`,
  `ROOF_OPENING_FILLED_TWICE`, `ROOF_PENETRATION_MISMATCH`.
  Schema 1.3.0 (BUILDAPP-01A) adds real staircases (`Stair` PLACEHOLDER |
  FLIGHTS with FLIGHT / WINDER / LANDING segments and `layoutStair`), slab
  holes (`Slab.holes`, a hole may touch the outline), roof cut modes
  (`RoofOpening.cut` VERTICAL | NORMAL_TO_ROOF), composite doors
  (`Door.assembly` of LEAF / GLAZED / PANEL panels) and the
  `surfaceRegions` collection (a finish band on a wall face with no
  thickness of its own), with codes `SLAB_HOLE_OUTSIDE`,
  `SLAB_HOLES_OVERLAP`, `STAIR_RISE_INVALID`, `STAIR_LAYOUT_INVALID`,
  `STAIR_OUTSIDE_FOOTPRINT`, `DOOR_ASSEMBLY_INVALID`,
  `SURFACE_REGION_HOST_INVALID`, `SURFACE_REGION_OUTSIDE_HOST`.
  Schema 1.4.0 (BUILDAPP-03) adds the `linearSolids` collection: a generic
  `LinearSolid` is a rectangular bar between two 3D points with its own
  cross-section basis (`width` seen in elevation, `depth` proud of the host,
  an optional `rollDeg`), hosted on a wall, roof or slab — the primitive a
  facade band, a beam, a portal reveal, a fin or a parapet compiles to, with
  codes `LINEAR_SOLID_DEGENERATE` and `LINEAR_SOLID_HOST_INVALID`.
  **Explicit schema evolution**: 1.0.0, 1.1.0, 1.2.0 and 1.3.0 files migrate on
  load through explicit chained steps (empty collections added, one
  `SCHEMA_MIGRATED` warning and one `meta.notes` entry per step, geometry
  unchanged — tested against the frozen demo files at every version and the
  BUILDAPP-01 Marcówki freeze); a file stating an older version but carrying
  newer collections is refused; other versions are refused
  (`UNSUPPORTED_SCHEMA_VERSION`).
- **Wall topology** (`packages/model/src/topology.ts`): `WallJunction`
  records (CORNER with an owner, BUTT, T) and `WallRing` records; a
  line-arithmetic resolver derives every wall end's physical cut on its outer
  and inner face (owner-through corners exact at any angle, reflex corners
  extended into the notch, butt/T against the host's physical face). Named
  validation: `JUNCTION_GAP` / `JUNCTION_OVERSHOOT` (measured),
  `JUNCTION_PARALLEL_WALLS`, `JUNCTION_SELF_REFERENCE`,
  `JUNCTION_OWNER_NOT_PARTICIPANT`, `JUNCTION_LEVEL_MISMATCH`,
  `ENDPOINT_JUNCTION_CONFLICT`, `BUTT_OFF_HOST`, `T_JUNCTION_POSITION`,
  `WALL_CONSUMED`, `OPENING_IN_JUNCTION_ZONE`, `WALLS_OVERLAP` (undeclared
  plan overlap between walls is now a model error), `RING_DEGENERATE`,
  `RING_NOT_CLOSED`, `RING_LEVEL_MISMATCH`, `UNKNOWN_JUNCTION`, warning
  `JUNCTION_KIND_MIX`. Nothing is repaired.
- **Building DSL** (`packages/commands`): 27 typed commands — the 25 of
  BUILDAPP-00A plus `cutRoofOpening` and `placeRooflight`; `cutOpening`
  takes `head` (RAKED) and `leaves`, `placeWindow` takes `mullions`.
  `createWallRing` (natural footprint polygon → walls, corner junctions and
  a ring), `createWallJunction`, inline `startJunction` / `endJunction` on
  `createWall`. Removal cascades wall → junctions → rings, roof → roof
  openings → rooflights, chimney → penetrations; a leaf wall's removal
  strips the leaf. `BuildingSession` with undo/redo.
- **Demo building** (`packages/demo`): two storeys, both exterior rings from
  `createWallRing` on the 10 × 8 footprint, interior partition with
  T-junctions, garage wing with corner junctions and a T into the main
  body, gable main roof, flat garage roof, 11 windows, 4 doors, 5 rooms,
  3 slabs, balcony with 3 railings, chimney, stair placeholder — built only
  from commands, no wall endpoint trimmed by a thickness (architecture test).
- **Marcówki reference** (`packages/reference-marcowki`, BUILDAPP-01):
  *Dom w marcówkach (GE)* transcribed from the researched source truth into
  145 Building DSL commands — evidence sources, 58 facts with statuses, the
  one frame transform `z_app = 13.60 − z_ref`, `marcowkiCommands()`,
  `createMarcowkiReferenceBuilding()` (a byte-equal replay), expected
  metrics, a 24-entry unresolved ledger; metric proofs by independent
  oracles (14.60 m depth, 1.00 m recesses, ring closure, twelve real
  facade openings incl. three raked gable windows against the printed
  callouts, 40° roof, rooflights, chimney penetrations, balconies, glass
  balustrades, 18 rooms, 11 interior doors), a 13-item mutation catalogue,
  a frozen fixture the model and geometry packages load and compile
  without the package, and `npm run audit:marcowki`. See
  `docs/MARCOWKI_REFERENCE_MODEL.md`.
- **Geometry compiler** (`packages/geometry`): walls compiled over their
  resolved physical extent (core + skewed end zones on one watertight grid),
  real through-openings including raked heads (head line on grid
  diagonals, sloped reveal) and multi-leaf cuts, flat / polyline /
  roof-following tops evaluated over the physical span (with breaks where
  the soffit crosses the nominal height), gable and flat roofs with
  vertical-prism roof openings (watertight band tiling, reveals) and
  rooflight fills, window (trapezoid under a rake, explicit mullions) and
  door fills, slabs, balconies, railings, chimneys, room markers, stair
  placeholders; every mesh keeps its semantic owner (a corner block belongs
  to exactly one wall; roof reveals carry `hostRoofId`).
- **Verification oracles** (`packages/verification`): volume, manifold, ray
  casting, material runs, `unionMaterialRuns` over several solids,
  shared-volume estimate, plane pitch, the independent storey
  **ring-closure oracle** (`ringClosureReport`: edge and corner probes,
  measured gaps, overlaps, reversed walls), and since BUILDAPP-01
  `depthProbeReport` (recess depth over a grid of rays), `lineCoverage`
  (material along a segment) and `pointInPolygon` (plan adjacency).
- **Editor store** (`packages/editor`): command → model → compile → notify,
  selection, hide/show/isolate (rings and junctions isolate their walls,
  roofs their openings and rooflights), storey isolation, roof toggle
  (hides the roof family), save/load, scene tree with a per-level Topology
  group and roof openings under their roof, `describe()` with a derived
  topology description, a generic `host` and resolved `evidenceSources`.
- **BuildWorld** (`apps/web`): the BUILDAPP-00 editor plus a Topology section
  in the inspector (physical extents, junction resolution, ring closure),
  ring / junction rows in the scene tree, a **model** selector (*Demo
  house* / *Dom w marcówkach (GE)*) that replaces the model in the same
  store, host links and cited evidence sources with locator in the
  inspector. The viewport, adapter, store and generic packages never import
  the reference package (architecture tests).

- **Mobile scene bundle** (`packages/mobile-scene`, BUILDAPP-01M): a
  separately versioned derived format,
  `buildapp.mobile-scene-bundle` **1.0.0** — the compiler's `CompiledScene`
  re-encoded (triangles flattened losslessly, every mesh keeping its
  `objectId` / `objectKind` / `part` / `levelId` / `solidId` / host / opening /
  structural / material tags) plus the storey list, per-object inspector
  metadata already formatted as `label: value` rows, relationships, evidence
  and materials. Deterministic and content-addressed (sha256 of canonical
  JSON): the same model always writes the same bytes, and collection or export
  order cannot reach the hash. `npm run mobile:export-scenes` writes the
  Marcówki and demo bundles into the Android app's assets. It is DERIVED data
  — the CanonicalBuildingModel remains the source of truth, and
  `packages/mobile-scene/test/parity.test.ts` holds the bundle to the
  compiler's output triangle by triangle for both scenes.
- **Android model preview** (`apps/android`, BUILDAPP-01M):
  `BuildPlan Model Preview`, application id `com.buildplan.preview` (distinct
  from the owner's older `com.buildplan.app`), Kotlin + Jetpack Compose +
  Material 3 + Google Filament 1.75.1, minSdk 26 / targetSdk 35, no
  permissions, fully offline, no account, no database. It renders the exported
  bundle natively: one Filament entity per semantic object (so `View.pick()`
  resolves straight to an `objectId`), Construction and Clay styles with the
  same palette the web viewer uses, translucent glazing, a technical grid, sun
  and spherical-harmonic ambient light, SSAO and shadows. Orbit / pinch-zoom /
  two-finger pan / tap-to-select / double-tap-to-isolate, all with button
  alternatives; visibility modes All, Roof off, Ground, Attic, Cutaway,
  Isolate, Show all, implemented by adding and removing entities (hidden
  geometry is therefore unpickable, and nothing is recompiled); 11 camera
  presets with truly orthographic elevations and plans, Frame selection and
  Reset; a bottom-sheet inspector. Exactly one coordinate conversion
  (`scene/ModelFrame.kt`: mirror z, re-wind each triangle a, c, b), guarded by
  an architecture test. 89 Kotlin unit tests run on the JVM against the real
  shipped bundles, with no GPU. `docs/ANDROID_MODEL_PREVIEW.md`.

- **Source analyzer, layers 1 and 2** (STAGE BUILDAPP-02): six new packages
  that read a project's published sources and record what was SEEN in them.
  Nothing in them produces a Building DSL command, a mesh or a metre.
  - **`packages/source-common`** — canonical JSON, a pure SHA-256, deterministic
    content-addressed ids, normalized 2D geometry. No Node, no DOM.
  - **`packages/source-cv`** — deterministic computer vision over decoded
    rasters: ink and gradient masks, connected components, runs, axis-aligned
    and Hough segments with total-least-squares angle refinement, parallel
    families, rectangles, profiles, silhouettes, slope histograms. 57 tests on
    synthetic pictures with exact expected answers.
  - **`packages/source-package`** — `buildapp.source-package` **1.0.0**: the one
    authoritative acquisition path. Safe fetching (HTTPS only, every resolved
    address classified, redirects re-validated per hop, bounded and anonymous),
    publisher adapters, decoding FROM THE BYTES, variant grouping and selection
    on measured pixels, five independent role dimensions each separately
    UNKNOWN-able, published figures, recorded failures, content hash, offline
    replay from a byte cache. `docs/SOURCE_PACKAGE.md`.
  - **`packages/source-observations`** — `buildapp.source-observation-graph`
    **1.0.0**: coordinate frames per asset variant, observations with pixel and
    derived normalized geometry, separate confidence and positional uncertainty,
    alternatives, relations (depth, topology, direction, cross-view identity),
    conflicts that are never averaged, named gaps, order-independent content
    hash, and a validator that refuses a graph whose coordinates, frames,
    relations, tolerances or ids do not hold together.
    `docs/SOURCE_OBSERVATION_GRAPH.md`.
  - **`packages/source-vision`** — a provider-neutral `VisionReasoner`, narrow
    schema-constrained tasks whose JSON Schema is generated from the observation
    vocabulary, twelve named rejection codes, and three providers: a live
    Anthropic adapter (forced tool use, temperature 0, no prose fallback), a
    recorded-fixture replayer keyed by the bytes it describes, and a null
    provider that admits there is none. No secret in the repository.
    `docs/VISION_REASONER.md`.
  - **`packages/source-analyzer`** — extractors for elevations, plans, sections
    and renders; **depth reasoning** that promotes a band to a
    `LINEAR_VOLUME_CANDIDATE` only on a cue implying a third dimension
    (shadow, visible end face, occlusion break, return face) and records a band
    with only a change of tone as a `SURFACE_REGION`; a **stair reader** that
    reads a run of tread lines, its flights, its winders and its direction mark
    and never infers a staircase from the size of a shaft; cross-view relations;
    and self-contained SVG debug overlays.
- **CLI**: `source:acquire`, `observations:extract`, `observations:audit`,
  `observations:marcowki`. The audit exits non-zero on any validation error.
- **BuildWorld Sources / Observations panel**: a read-only surface showing a
  sealed graph — frames, observations with evidence, tolerance and alternatives,
  conflicts and named gaps. Structurally read-only (no store, no command
  imported) and it does not fetch: a graph arrives as the built-in sample or
  from a file the viewer opens.

## Test / build / browser results (STAGE BUILDAPP-01A)

| gate | result |
| --- | --- |
| `npm run typecheck` | clean (packages + web app) |
| `npm test` | 317 passed, 37 files |
| `npm run build` | clean; `apps/web/dist` ≈ 1.0 MB (three 480 KB, app 515 KB, react 12 KB, css 5 KB) |
| `npm run e2e` | 14 passed (Playwright 1.56, Chromium headless, SwiftShader WebGL) against the production build; 13 screenshots in `stage-reports/artifacts/` |
| `npm run audit:marcowki` | AUDIT PASS — 95 checks, every headline metric measured by the oracles |
| `npm run audit:marcowki:facades` | 47 registered elevation features: 36 pass, 9 explained deviations, 2 not modelled, 0 not found, worst 0.185 m |

## Test / build / browser results (STAGE BUILDAPP-01M)

Run on the final HEAD of this stage:

| gate | result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | 379 passed, 40 files (317 at the stage's starting HEAD) |
| `npm run build` | PASS |
| `npm run e2e` | 14 passed (Playwright) |
| `npm run audit:marcowki` | AUDIT PASS |
| `npm run audit:marcowki:facades` | 47 features: 36 pass, 9 deviation, 2 not modelled, 0 not found; worst delta 0.185 m — unchanged from BUILDAPP-01A |
| `npm run mobile:export-scenes` | PASS; Marcówki 178 meshes / 4480 triangles / 127 objects, bundle `3998e33c…`; demo 88 / 2332 / 58, bundle `1427a5d8…` |
| `npm run android:test` | 89 Kotlin unit tests passed (JVM, no device) |
| `npm run android:assembleDebug` | PASS — arm64-v8a 12.7 MiB, universal 18.3 MiB |

APK verified with `aapt2` and `apksigner`: `com.buildplan.preview`
`0.1.0-preview` (versionCode 1), minSdk 26 / targetSdk 35, OpenGL ES 3.0,
arm64-v8a, debug-signed, scene and material assets bundled, no INTERNET
permission. arm64 SHA-256
`8bc00dcc54684373e2499378c8368adbbd089cbcbcb395667715e06a01e8bc31`.

No emulator or device was available (no `/dev/kvm`, no nested virtualisation),
so there are no Android screenshots and the GPU render path is unverified by
execution. See `stage-reports/STAGE_BUILDAPP_01M.md`.

- **Metric evidence and the reconstruction solver** (STAGE BUILDAPP-03): four
  new packages that turn what was SEEN into a building candidate, and one that
  renders the fixtures they are held to.
  - **`packages/source-metrics`** — `buildapp.metric-evidence-set` **1.0.0**: a
    real numeric OCR (skeleton matching after Zhang–Suen thinning,
    aspect-preserving resampling, gap-maximising de-skew, three page
    orientations with a page-wide vote, per-glyph runners-up and a separate
    *decidedness*), dimension chains solved as a discrete partition by dynamic
    programming against one sheet-wide scale voted in pixels, a ladder of level
    datums fitted as one straight line, and axis-aligned affine registration
    with robust seeded fitting and reported outliers. Sealed against the source
    package's bytes AND the observation graph's content.
  - **`packages/reconstruction`** — `buildapp.structural-layout-hypothesis-set`
    **1.0.0** (BUILDAPP-03R): what the building is MADE OF — storeys, footprint
    regions, masses, attachments, recesses, one roof system per mass, facade
    planes, alternatives, conflicts, named holes and a gate — settled and sealed
    before a wall exists, from a plan decomposition that reads wall bands,
    strikes grid lines on chains and band axes, floods CELLS rather than pixels,
    and treats a hole between two pieces of one wall as the door it is. Then
    `buildapp.primitive-hypothesis-set` **1.0.0**
    and `buildapp.reconstruction-candidate` **1.1.0**: hypotheses with an
    explicit basis per parameter (MEASURED / DERIVED / SCALED / CROSS_VIEW /
    ASSUMED), five-stage fusion that accounts for every sighting it drops,
    HARD / SOFT / UNRESOLVED constraint classes that are never mixed,
    contradictions reported rather than averaged, a deterministic solver with a
    per-step trace, a sealed candidate carrying four input hashes and a
    Building DSL program that replays to its model byte for byte, a
    non-iterative projection audit, and post-seal evaluation reporting
    geometric accuracy and evidence-supported completeness separately.
  - **`packages/synthetic-drawings`** — complete synthetic sheets (plan, four
    elevations, section) for a house that exists only in the fixture, in its
    own typeface, encoded to real PNG bytes by a dependency-free encoder.
  - **`packages/candidates`** — sealed candidates as data; BuildWorld and the
    mobile exporter both load by replaying the program, never by re-solving.
  - `docs/METRIC_EVIDENCE.md`, `docs/PRIMITIVE_RECONSTRUCTION.md`,
    `docs/RECONSTRUCTION_SOLVER.md`, `docs/STRUCTURAL_LAYOUT.md`,
    `docs/OPENINGS_AND_SOLIDS.md`.
  - **`tests/benchmark`** (BUILDAPP-03R) — evaluation as its own workspace. It
    may know which building the sealed candidate is of, because it runs only on
    sealed artefacts and nothing in the production path may import it.

## Where the reconstruction stands (STAGE BUILDAPP-03R)

BUILDAPP-03 produced one slab 12.05 × 14.905 m, one wall ring reused on both
levels, one gable over the whole rectangle at 28.563799°, eight openings and
twenty-four facade strips. BUILDAPP-03R rebuilt structural inference from the
source evidence rather than repairing that box, and the Marcówki candidate is
now:

| | BUILDAPP-03 | BUILDAPP-03R |
| --- | --- | --- |
| bodies | one 12.05 × 14.91 m slab | **two**: 7.90 × 12.61 m main body, 4.15 × 7.51 m attached garage |
| storeys | one ring on both levels | storey 0 over both bodies, storey 1 over the house alone |
| roofs | one gable over the bounding box at 28.563799° | **two**: a 40° gable over the house on the publisher's own specification, a flat roof over the garage as a stated convention |
| openings | 8 | 13, with **12 of the 12** major facade openings recovered (median centre error 0.161 m, height 0.100 m) |
| facade solids | 24 | **2** |
| gate | — | `STRUCTURAL_LAYOUT_ACCEPTED` |

`stage-reports/STAGE_BUILDAPP_03R.md` carries the full report, the §22
benchmark table, the fourteen mutations and the known limitations.

## Where the measuring stands (STAGE BUILDAPP-03R1)

03R left a 0.329 m median error on the reference project's opening widths
that it could not account for. 03R1 built `packages/image-metrology` and
found it: the ink-silhouette extractor had traced all four of that project's
elevations as the ENTIRE IMAGE, 1279 × 596 px, because on a photo-realistic
render it traces the lawn, the trees and the sky along with the house. The
ridge is 485 px tall in a 596 px image, so every height read off those
drawings came out 23% short — invisible, because a silhouette that is wrong
is still a silhouette.

| | 03R | 03R1 |
| --- | --- | --- |
| elevation outline surplus over the bodies beneath it | 4.98, 5.01, 4.45, 4.42 m | **0.00, 0.00, 1.91, 1.53 m** |
| major facade openings recovered | 12 / 12 | 12 / 12 |
| median centre error | 0.161 m | **0.133 m** |
| median width error | 0.329 m | **0.066 m** |
| median height error | 0.100 m | 0.100 m |

Three things it now measures rather than assumes: where a wall actually
stops, by finding the reveal in the drawing instead of where a thickness
test gave up; which way round an elevation reads, from the drawing's own top
edge rather than from a traversal convention that is the wrong way round for
this project; and whether an "elevation" is a line drawing or a render,
which decides how much a single reading of it is worth. On a render a height
is taken only where two independent readings agree, and otherwise the
opening's height is declared unmeasured and named as a hole.

`stage-reports/STAGE_BUILDAPP_03R1_IMAGE_METROLOGY.md` carries the full
report, the per-opening table, the four registered elevations proved from
content, §21's twelve wrong-boundary mutations, three approaches that look
right and are wrong, and what the stage did not do.

## Where the analyzer stands (STAGE BUILDAPP-03X)

03R1 measured the facades and still shipped a candidate with no recesses, no
interior, a roof stopping short of the zones, no stair and heights from
conventions. 03X sealed a source truth v2 first (`research/marcowki-v2/`,
138 items, never imported by production code), audited where each family's
evidence was lost (`docs/ANALYZER_FORENSIC_AUDIT.md`, eleven facts with
file and line), and refounded the analyzer as `packages/reconstruction/src/v2/`
(`npm run reconstruct:v2:marcowki`). Both candidates stay sealed side by side
in `packages/candidates` (`marcowki-auto`, `marcowki-auto-v2`) and both are
selectable on the web and on Android.

| | 03R1 Auto | 03X Auto v2 |
| --- | --- | --- |
| frame | z mirrored against the sheet (z = 0 at the rear wall) | z from the front outer plane, the mirror against 03R stated once |
| roof | over the walled body (12.61 m) | over the zones (z 0..14.60), `coversZones` with its reason |
| recesses / returns | none | four recess readings, eight return walls, terraces on the recess floors |
| interior | none | 31 partitions, 9 doors, 12 rooms, chimney blocks |
| stair | none | U-stair 5+7+5 = 17 risers over 3.06 m, two quarter landings, emitted as FLIGHTS |
| opening heights | conventions | printed callouts on all eleven facade openings (a ring reader with candidate readings resolved by plan gaps and elevations); two heights flagged ambiguous |
| raked heads | none | the three gable windows, from the printed height and the roof soffit |
| roof details | flat garage roof by convention | garage slab and parapet from the section, two chimneys, three rooflights |
| facade | 2 solids | verges, fascias, railings, the portal head, three assemblies |
| cameras | none | three of four perspectives solved and sealed |
| verification | NOT_CHECKED on every silhouette | 28 source-view residuals; a bounded repair that applied nothing and refused nine changes with reasons |
| evidence accounting | none | a ledger over every observation, metric reading, page fact and room; a feature graph with quality L0/L1/L2 |

Evaluated per item against the sealed truth with the truth's own tolerances
and no aggregate score (`stage-reports/artifacts/analyzer-v2/marcowki-v2-evaluation.md`):
masses, recesses, roof, verge, portal and the stair match; openings match in
interval and width everywhere and in height wherever a callout was read
unambiguously; what is PARTIAL is named per property (opening families from
visual cues, open-plan rooms merged, room numbers mostly unread, chimney and
rooflight extents 0.1–0.2 m off, fascia ends short). Gates:
`npm run audit:analyzer-v2` (22 checks), `npm run reconstruct:no-benchmark`
(reference, truth and research physically absent), `tests/architecture/analyzer-v2.test.ts`,
the 100-stripe facade stress test, synthetic fixtures through v2. Overlays,
evaluation, lineage, ledger, quality, residuals and the repair trace are
under `stage-reports/artifacts/analyzer-v2/` and uploaded by CI.
`docs/ANALYZER_V2_ARCHITECTURE.md`, `docs/EVIDENCE_CONSUMPTION.md` and
`docs/FEATURE_IDENTITY_GRAPH.md` describe the design.

## Where the exterior stands (STAGE BUILDAPP-03Y)

The owner's review of Auto v2 named unclean joints, a balcony whose short
side did not end at the building, a railing that should turn, a weak
terrace, incomplete bands and frames, a jagged roof edge and merging
elements. 03Y traced each to its first bad stage
(`docs/MARCOWKI_AUTO_V2_EXTERIOR_FORENSIC_AUDIT.md`) and fixed it in the layer
that owns it; the result is sealed as **Marcówki (auto v3)** beside the
Auto v2 baseline, on the web and on Android.

- **Model schema 1.5.0**: `terraces`; roof `edgeMembers` (verge and fascia
  boards compiled with the roof) and `plateInset` (plates bear into their
  walls); `Railing.path` (railings that turn). The frozen candidates were
  restated without a byte of building changing (`candidates:reseal`).
- **Geometry closure audit** (`packages/geometry/src/closure.ts`): shared
  volume, faces drawn twice, cracks between members that meet, free railing
  ends, terraces off their datum — per pair, with the model's intended
  relation. `npm run audit:exterior` gates Core CI.
- **Assembly closure** in the analyzer (`packages/reconstruction/src/v2/assembly-closure.ts`):
  return snapping and stacking, balcony end conditions (WALL / CARRIES only
  where the elevation draws the band on / FREE at the plan's line / MEETS),
  turning railings, verge depth from the frame, one portal band, terraces
  with the plan's platform, and a facade graph (CONTINUES_TO, TERMINATES_AT,
  TURNS_AT, MEETS_HOST).
- **Semantic styling**: semantic groups and one controlled palette on web and
  Android, tone families read against each render's white point and carried
  through the model's materials, finish runs along the recessed walls,
  Architectural style beside Construction and Clay.

| exterior, closure audit | Auto v2 | Auto v3 |
| --- | --- | --- |
| intersections | 13 (4.30 m³) | 0 |
| exposed gaps | 7 | 0 |
| faces drawn twice | 21 (29.5 m²) | 0 |
| free railing ends | 2 (0.94 m) | 0 |

Per category against the truth set: twelve PASS, OPENINGS and
MATERIAL_READABILITY PARTIAL, none FAIL
(`stage-reports/artifacts/analyzer-v2/marcowki-exterior-closure-evaluation.md`).
The interior findings (the stair against its walls, partitions trimmed short
of undeclared junctions) are left for BUILDAPP-03Z.

## Where the in-app analyzer stands (STAGE BUILDAPP-03Y1)

There is ONE analyzer, and it now runs as a service a phone can call:

- **`@buildapp/analysis-service`** — `runAnalysis` / `runLinkAnalysis`: URL →
  SourcePackage → analyzer v2 → model → compiled scene → MobileSceneBundle,
  verified (replay, bundle round trip, closure audit) and hashed, with real
  stage progress and cancellation. The `reconstruct:v2` CLI is a thin adapter
  over it and still reproduces sealed Auto v3 byte for byte.
- **`apps/analyzer-api`** — the HTTP API of `docs/ANALYZER_API.md`: submit a
  URL, poll nine stages and a real progress value, download the result, the
  scene bytes (sha256-checked), the model and the candidate; cancel. A worker
  thread per job, a bounded queue, a time limit, a filesystem job store that
  survives restarts, rate limits, CORS, HTTPS behind a proxy, no secrets and no
  paths in any response. One container (`apps/analyzer-api/Dockerfile`), a
  Fly.io config and a CI deploy job that runs when the repository has a
  `FLY_API_TOKEN` secret.
- **Web** — the Analyze panel in BuildWorld (same contract).
- **Android** — the Analyzer screen and a verified, persistent cache of
  downloaded scenes beside the bundled ones; `INTERNET` is the one permission
  added (see the 03Y1 report).
- **Camera** — a pure gesture reducer with a pointer-set rebase: a finger
  landing or lifting moves nothing; orbit gain per viewport, not per pixel;
  clamped pinch; 1:1 pan.

The real Marcówki URL completes through the API (177 s locally, 131 s in the
CI container) and yields the sealed Auto v3 building: under the sealed label
and model id the live sources give model `894e50ba…` and the APK's exact
scene. Candidate hashes differ from the sealed one because the publisher's
page HTML changes between fetches (the drawings are byte-identical).

**Deployment is the open item**: no hosting credential exists in this
environment, so no public HTTPS analyzer service is running, and the phone
flow cannot be exercised end to end until one is (steps in
`docs/ANALYZER_API.md` → Deployment).

## Where the local analyzer stands (STAGE BUILDAPP-03Y2)

The phone no longer needs a server to analyse a link. The APK embeds the
**production analyzer** and a Node runtime to run it:

- **`apps/local-analyzer`** — `runLocalAnalysis` = `runAnalysis` with a scratch
  byte cache that is removed on every outcome; a one-job-per-process program
  (events and cancel over pipes, atomic result files); the esbuild bundle
  (`analyzer.mjs`, target node18, 1 455 782 B) built into the APK's assets at
  build time. No second solver, geometry kernel or mobile variant
  (`tests/architecture/local-analyzer.test.ts`).
- **Runtime** — nodejs-mobile **18.20.4** `libnode.so` (arm64-v8a, x86_64;
  pinned and integrity-checked by `apps/android/tools/fetch-nodejs-mobile.mjs`,
  never committed), a JNI bridge to `node::Start`, `LocalAnalyzerService` in a
  separate non-exported `:analyzer` process — one job, one process, ended when
  the job ends.
- **Two compatibility gaps, closed without touching the analyzer:**
  `AbortSignal.any` (a shim), and **no ICU** — nodejs-mobile builds Android Node
  `--with-intl=none`, which would reorder 5 357 of 50 412 Marcówki comparisons
  and seal different evidence and candidate; a text adapter generated from and
  verified against the desktop's ICU stands in (`apps/local-analyzer/src/text.ts`),
  refusing by name the text it cannot reproduce exactly.
- **Android** — "Analyzer: Local" (preferred; the service mode stays), stage
  progress, elapsed time and memory, cancel (asked, then enforced by ending the
  process), named errors, `INTERRUPTED` after a restart, the verified scene
  stored like a download and opened in the viewer by itself, and a persistent
  "Local runs on this phone" log of time, memory and scene size.

| measured | value |
| --- | --- |
| APK arm64-v8a with / without / delta | 29 911 875 / 11 911 438 / **+18 000 437 B** (runtime 17 077 722 B compressed, 49 522 248 B installed; JS 440 860 B compressed) |
| Marcówki live, Android 14 emulator (x86_64, KVM, 4 cores) | **215.5 s** and **142.1 s** (two CI runs), peak **1 788 / 1 791 MiB**; model `4a8e8ddc…`, scene `44cc19be…` — the desktop's building from byte-identical drawings |
| Marcówki live, desktop Node 22 / host Node 18.20.4 | 128.0 s, 1 641 MiB / 201.8 s, 1 583 MiB |
| fixture on the emulator | 4.7 s and 3.3 s; candidate, model, scene hashes = desktop |
| where the time and memory go | reading printed dimensions: 81 % of the time; its per-page callout render cache holds up to 1 077 MiB |
| physical phone | **PHYSICAL_DEVICE_NOT_RUN** |

Verdict **LOCAL_ANALYZER_PROOF_PARTIAL**: proven on Android x86_64; the arm64
phone run is the owner's gate (`stage-reports/STAGE_BUILDAPP_03Y2_EMBEDDED_LOCAL_ANALYZER.md`,
`docs/LOCAL_ANALYZER.md`).

## Where the generalization stands (STAGE BUILDAPP-03Y2G)

The owner's second project, *Dom w rarytasach 5 (G2E)*, failed on the phone as
a bare `ANALYSIS_FAILED`. This stage made failures say why, and made the plan
reader generic enough for a second house:

- **First bad inference:** the plan's sheet scale. Consistent OCR misreadings
  voted 8.51 cm/px, against a true 2.75. A plan scale must now make its walls a
  thickness a wall can have (0.15–0.8 m). Otherwise it is replaced by one that
  three numbers on two chains state, or the plan carries no scale.
- **Wide openings** (3.2–8 m) are weighed on drawn infill, callouts, corners and
  what lies behind them, not on width. **Bays** (a projecting garage, a carport)
  are shut only by what is drawn across their mouth. Strict and
  continuity enclosure hypotheses are both recorded. There is no rectangle
  fallback. The layout gate's verdicts now stop a run (`PLAN_LAYOUT_REJECTED`).
- **Failures are typed.** The public code is `RECONSTRUCTION_FAILED`, and each
  failure carries a `reasonCode` (PLAN_* / VIEW_* / MODEL_EMISSION_FAILED /
  VERIFY_* / INTERNAL_ERROR), a stage, a substage, a title and counts. An
  `AnalysisTrace` is written for every outcome. On a failure, a diagnostics
  bundle with a plan overlay is written.
- **The Android failure card** shows the title, Stopped at, Code and counts,
  with Copy code, Show details, Share diagnostics and Retry. It keeps at most 5
  bundles, with no source images. Local protocol 2.
- **Rarytasy on desktop:** completes with a house (17.21 × 8.48 m, gable,
  chimney) and an attached flat-roofed double garage, 14 openings. The sealed
  replay gives the same hashes. Marcówki's model is unchanged.
- **CI:**
  - `second-house-generalization` runs the live URL, replays it and the
    pre-fix evidence, and checks Node 18 parity.
  - The emulator runs both projects live.
  - `preview-latest` publishes `BuildPlan-Preview-arm64.apk` as a direct asset.

The owner's arm64 phone decides the gate (the report's OWNER PHONE CHECKLIST).
Two houses from one publisher are not a claim of general support.

## Where the architectural language stands (STAGE BUILDAPP-03G)

BuildApp describes buildings in a general language rather than one house type
per project (`docs/ARCHITECTURAL_LANGUAGE.md`,
`packages/architecture`):

- **Vocabulary:** 34 primitive types, 13 assembly kinds, 15 relationship kinds
  and an UNKNOWN assembly that keeps its evidence, extent, observed pieces,
  alternatives and reason. Roofs are plane graphs (ridges, hips, valleys,
  steps, eaves, verges); dormers, parapets, canopies, carports, pergolas,
  balconies, loggias, terraces, entrances and exterior steps are assemblies
  over primitives, validated and checked by the closure audit.
- **Capability registry:** 21 capabilities, 18 SUPPORTED and 3 PARTIAL as
  representation; recognition is ANALYZER_V2 for 4 (as legacy objects),
  SYNTHETIC_PIPELINE for 11, NONE for 6.
- **Hypothesis pipeline:** SemanticProposals from any detector →
  hypotheses → fusion by capability requirements and exclusions → topology
  → metric solve by source authority → Building DSL. Proven on synthetic
  evidence only; one visual line never becomes a dormer, and ambiguity stays
  UNKNOWN.
- **Evidence:** 17 synthetic diversity fixtures (validation, replay, round
  trip, compile, closure: all clean), roof and assembly graphs for every
  fixture and for both regression houses, BuildWorld category filters, the
  Android parser on fixture bundles. CI publishes `architectural-assemblies`.

Next for this line of work: the analyzer emitting proposals for roof planes
and parapets on the two regression houses (the 03G report's NEXT STEP).

## Test / build / browser results (STAGE BUILDAPP-03)

Run on the final HEAD of this stage:

| gate | result |
| --- | --- |
| `npm run typecheck` | PASS (packages + web app) |
| `npm test` | **790 passed, 68 files** (737 at the stage's starting HEAD) |
| `npm run build` | PASS |
| `npm run e2e` | **21 passed** — 18 existing plus 3 for the reconstruction candidate |
| `npm run android:test` | PASS |
| `npm run android:assembleDebug` | BUILD SUCCESSFUL; preview APK refreshed |
| `npm run reconstruct:no-reference` | candidate produced with `packages/reference-marcowki` absent from the tree |

Marcówki observation benchmark (`npm run observations:marcowki`): package
`src-m2fa281446a8ca-c0499d9df3` (20 assets, 10 published figures, 18 rooms),
graph `obsgraph-src-m2fa281446a8ca-c0499d9df3-0dff45f229` — 18 frames, 888
observations, 461 relations, 81 named gaps, **138 LINEAR_VOLUME_CANDIDATEs**
carrying a depth cue against 67 bands that carry none. Artifacts, overlays and
the finding-by-finding comparison with the reference model are in
`stage-reports/artifacts/source-observations/`. **LIVE_PROVIDER_NOT_RUN** — no
`ANTHROPIC_API_KEY` in this environment, and `--live` refuses rather than
pretending.

## Where the unified presentation stands (STAGE BUILDPLAN-INTEGRATION-003A)

First convergence stage of BuildApp and BuildPlan-PC-Legacy: BuildApp's
analyzer and canonical model, drawn with the donor viewer's generic
presentation work. On branch `integration/unified-buildplan-presentation-v1`,
not merged.

- **Modes.** The Android viewer's tool row has **Mode: MODEL / CLAY / LINE**.
  MODEL is the previous presentation, unchanged, with its Style menu. CLAY is a
  clay study (monochrome value ladder, shadows, SSAO, structural feature edges,
  roof tiles, neutral glass); LINE a line study (flat surfaces, every opaque
  edge, no shadows). A mode switch is parameter writes and entity add/remove
  only; it never re-derives or re-uploads.
- **Derived, not canonical.** `presentation/ScenePresentation.of(scene)` builds
  feature edges (`FeatureEdges`: T-junction splitting, coplanar-seam removal,
  cross-object shared seams, per-class batching) and the roof covering
  (`RoofCover`: planes found in the compiled triangles, holes respected,
  chimney/rooflight blockers, one batch per roof) once per model upload. The
  bundle, the model and the compiler are untouched; tests hold the assets,
  the parsed bundle and the uploaded buffers byte-identical across every mode.
- **Glass** has its own renderable per object, so CLAY and LINE glazing
  neither casts nor receives shadows; it is a neutral premultiplied sheet.
- **Presets.** *Fit model* (fits the narrower screen side) and *Isometric*,
  from the model's bounds only.
- **Evidence.** `stage-reports/artifacts/integration-003a/`: the BuildApp
  Marcówki candidate (auto v3) and the second house (live run, model
  `88c514f5…`) in the three modes, as a JVM raster of the uploaded buffers.
- **Cost.** Whole-model view of auto v3: 119 renderables before; MODEL 133
  (glazing split), CLAY 138, LINE 140. The covering adds ≈20–28 k triangles in
  CLAY only; edges and tiles add about 1 MB of buffers per model.
- **Guards.** `tests/architecture/presentation.test.ts` fails on a project
  name, a donor reference coordinate, a benchmark dimension, a donor class or
  package, or a runtime material compiler in the ported code.
- **Tests.** Android 309 cases, 0 failures; `npm test` 1 458 passed with one
  failure that is pre-existing in this container (`apps/analyzer-api` worker,
  ECONNRESET — identical on the base commit, passes alone).

## Known limitations

- Each wall end belongs to at most one junction; three walls meeting at a
  point are a CORNER plus a BUTT/T. Corner ownership is always one wall (no
  mitre record).
- Moving or lengthening a ring wall on its own is refused (its corners would
  gap) and removing a corner junction alone is refused (the walls would
  overlap): topology-aware plan editing (move a corner, move a wall with its
  neighbours) is not implemented; edits are re-creation or thickness /
  height / opening / owner changes, which re-resolve.
- Undeclared overlap detection uses each wall's nominal height range and
  physical plan footprint; roofs, slabs and other elements are not part of it
  (the demo's chimney/roof penetration remains the stated exception in the
  geometry overlap test).
- Roof openings are cut over a plan rectangle on one slope of a gable,
  VERTICAL or NORMAL_TO_ROOF; there is no clearance between a rooflight unit
  and its cut (ledger `rooflight-clearance`). Multi-leaf openings require
  parallel leaves on the same level. Roofs: axis-aligned rectangular gable
  and flat only. Stairs have flights, winders and landings but no
  balustrade, and a slab hole has no upstand along its edge. Surface regions
  are wall-local rectangles on one face (not polygons, not on slabs or
  roofs). Rooms are floor markers. Constraints recorded, not solved.
  Inspector-driven editing only. The model frame is left-handed as specified
  and mirrored by the viewer.
- **Local analyzer (BUILDAPP-03Y2):** executed on an Android emulator
  (x86_64) in CI, never on arm64 or a phone; peak 1.6–1.8 GB for Marcówki;
  +18 MB APK / +51 MB installed; no foreground service (a long run left in the
  background may be ended and is then reported INTERRUPTED); compared text
  outside the verified repertoire (curly quotes, `…`, `ß`, Greek, CJK) is refused
  as `TEXT_NOT_SUPPORTED_ON_DEVICE`; armeabi-v7a has no runtime.
- The Android preview (BUILDAPP-01M) was **never executed on a device or an
  emulator**: the build container has no `/dev/kvm` and no nested
  virtualisation, so no Android screenshots exist and the GPU path — shader
  compilation, the Filament render loop on a real surface, the on-screen
  result — is unverified by execution. Everything not requiring a GPU was
  tested (89 Kotlin unit tests over the real bundles, plus structural
  verification of the built APK with `aapt2` and `apksigner`). The owner's
  first launch is the first real test of the render path. The preview is also
  read-only (since BUILDPLAN-INTEGRATION-003A it has CLAY and LINE study
  modes, equally unseen on a GPU here), and does not recompute the bundle hash
  on the phone (that would be a second canonical-JSON implementation in
  Kotlin); it validates structural self-consistency and the shipped index
  instead.
- The Marcówki reference carries its unresolved source evidence in
  `packages/reference-marcowki/src/ledger.ts` (33 entries: the eave datum
  contradiction, the stair's winder count, the entrance panel split, balcony
  and railing heights read off elevations, the garage parapet, the verge
  band and chimney shafts not modelled, and the drift between the two
  published revisions). ARCHON publishes the project in more than one
  revision; `docs/MARCOWKI_SOURCE_REVISION_POLICY.md` states which one the
  reference follows and why, and no published aggregate is allowed to move a
  dimension.
- **Source analyzer (BUILDAPP-02).** No live vision call has been made (no
  credentials). The published Marcówki plans are 853 px for a 12 m house, so a
  0.27 m stair going is about 9 px while terrain hatch and paving sit at 4 px;
  at that separation a flight cannot be told from a fill pattern, so no
  staircase is read from them and the candidates are recorded with the reason
  each was rejected. No side returns were found on the real loggia (18 named
  gaps say which sides). *(BUILDAPP-03 added the OCR: dimension chains and
  level datums are now valued, and the stair is still refused — see below.)* Openings over-detect on rendered elevations, where
  vertical cladding produces real closed rectangles. The site plan has no
  extractor. Renders are analysed with elevation extractors and their
  measurements corroborate rather than measure. The byte cache is not committed,
  so re-running the benchmark needs one `source:acquire` first.


## Android viewer (STAGE BUILDAPP-03M-FIX)

The phone viewer showed the automatic candidate as a bare roof: the viewport's
frame callback captured the scene open when it was installed, so after
switching models it resolved viewer state against the PREVIOUS building.
Visibility answers with object ids, and the two buildings share exactly one
name (`roof-main`), so one entity reached the Filament scene and no layer mode
could reveal the rest. The renderer now owns the scene it uploaded —
`setState` takes only viewer state — and the visible set is intersected with
the objects that actually carry geometry. Nothing in the reconstruction, the
bundles or the compiled geometry was changed: the candidate's geometry was
verified correct at every step before the GPU, including its winding. Twelve
regression assertions run against the real committed candidate bundle, and an
architecture test fails if the per-frame scene argument ever comes back.

## Known gaps and honest limits (STAGE BUILDAPP-03)

- **The automatic candidate is not final and is not claimed to be.** It gets
  the footprint width and the ridge height exactly, the depth to 2.1 %, and 3
  of the reference's 23 openings. Geometric accuracy 56.3 %,
  evidence-supported completeness 54.3 % — reported separately, never combined.
- **The stair is REFUSED.** One stair symbol was observed and nothing fixes a
  going, a rise, a width or a landing. There is no stair in the candidate and
  the refusal is in the artefact with its reason. The hand-built reference
  stair was not consulted and not copied.
- **The roof is one gable over the whole footprint.** The sources show a more
  complex roof; the derived 28.6° is the pitch that puts the ridge at the
  height the section states, over the span the solver assumed.
- **Facade members have no measured depth.** A view that can see depth says
  they stand proud; nothing says how far. Each is built square in section and
  named as a hole.
- **63 observed openings are unexplained** by the candidate, and 8 detections
  that did not fit the wall they were measured against were refused rather than
  forced.
- **No live vision call has been made** in this stage either: `LIVE_PROVIDER_NOT_RUN`.

## Where the product shell and progress stand (STAGE BUILDPLAN-INTEGRATION-003C)

- **Product workspace** (`apps/android/.../ui/`, direction "The Folding Rule", `apps/android/PRODUCT.md`, `DESIGN.md`): five places (Dom, 3D, Etapy, Koszty, Dokumenty) with a bottom bar upright and a navigation rail when short or wide.
  - **Dom**: the house drawn in ink from the model, the one figure "Postęp wg etapów", the rule, the current stage, the task and the record's date, one "Otwórz w 3D"; two panes on a wide window.
  - **3D**: the model full-screen under one glass layer (top strip, labelled tool rail, the timeline); the house framed by its box inside the free area; the folding rule scrubs 17 stages + the design ("Podgląd: …", "Wróć do teraz") without uploads or camera moves; a Polish inspector (sheet, or side panel on a phone on its side).
  - **Etapy**: the progress editor over `ProgressSession` / `ProgressStore` (one stage in progress, "Oznacz N wcześniejszych etapów…", task ≤ 200 characters, refusals said).
  - **Koszty / Dokumenty**: honest "Jeszcze niedostępne".
  - **Analyzer**: link first, Polish stages, "Model gotowy" / "… z ograniczeniami", failures said by cause; the screen stays on while the phone analyses.
- **Construction progress** (`progress/`): `ConstructionProgressState` (17 stages, one current, no cascading edits), `HouseId` = canonical model id, % by stages rounded down, atomic versioned `ProgressStore` (corrupt records set aside and said, newer schemas never overwritten), `StageProjection` (data-driven kind/group → stage), `ConstructionTimeline`; the timeline never writes progress.
- **3D P0** (blank screen): the dock's fade laid out with `fillMaxHeight()` covered the model; fixed in `6e1dcf8`. `ModelEntryDeviceTest` (the 3D gate) gates the owner APK.
- **Device gates** (CI, emulator API 34, ANGLE): `ModelEntryDeviceTest`, `ProductFlowDeviceTest` (font 1.0 / 1.3), `AdaptiveLayoutDeviceTest`, `ReleaseCandidateDeviceTest` (lifecycle, unhappy paths, collisions), `VerticalSliceDeviceTest` (Marcówki and Rarytasy analysed through the app); `tools/run-ui-evidence.sh` + `tools/validate-ui-evidence.mjs` fail the job on a missing or invalid capture.
- **Impeccable** (`.claude/skills/impeccable`, vendored): critique snapshots in `apps/android/.impeccable/critique/`; the cycle 2 / 3 audits in `stage-reports/artifacts/integration-003c/impeccable/`.
- **Open for the OWNER:** visual acceptance on the phone; analysis as a foreground service; the darker 3D backdrop; milestones on the rule; the rule on Dom as a rewind gesture. **Next analyzer stage:** keep the unresolved items with a download and say them in Polish.

## Where the house-first product, the adaptive analyzer and Kosaćce stand (STAGE BUILDPLAN-INTEGRATION-004A)

Report: `stage-reports/STAGE_BUILDPLAN_INTEGRATION_004A_HOUSE_FIRST_ADAPTIVE_ANALYZER.md`.

- **HOUSE-FIRST PRODUCT — TECHNICAL_PASS / OWNER_VISUAL_ACCEPTANCE_PENDING.** The house workspace is the root
  whenever a house exists (`ui/AppShell.kt`, `ui/HouseWorkspace.kt`,
  `ui/HouseSheets.kt`, `ui/ShellState.kt`): the 3D house full screen, a
  compact top context with the house menu and a status row only when
  there is something to say, the labelled tool rail, the construction rail
  whose header opens the stage sheet, one contextual sheet at a time (the
  inspector; the house menu, the stages, the source as modal sheets). The
  five places, the bottom bar, the rail and the empty Koszty / Dokumenty
  pages are gone; Koszty is a named boundary row in the house menu; the
  analyzer is a task that returns to the same house and camera; a finished
  analysis opens by itself only with no house open. No-house state:
  "Dodaj dom z linku". Device gates rewritten (ProductFlow, Adaptive,
  ReleaseCandidate, VerticalSlice, ModelEntry, NoHouse, GenericSource).
  Three audit cycles (baseline critique 24/40 → cycle 1 29/40 → cycle 2 → cycle 3 release candidate: the inspector solid to the finger, the landscape pane clear of the timeline, the open house remembered). Technical PASS on the final build's device evidence (report §V); what the OWNER has to see for themselves is the checklist in §AB.
- **ADAPTIVE SOURCE — PASS (router, generic reader, security) — the alternate Marcówki page is read and refused at reconstruction on evidence (PARTIAL for that one page, as the brief allows).** URL safety (`security.ts`, `net.ts`) is
  split from publisher recognition (`router.ts`); the specialist ARCHON
  reader stays preferred; the generic project-page reader
  (`adapters/generic/`) reads any publisher deterministically and answers
  SOURCE_NOT_PROJECT / NO_DRAWINGS / SOURCE_INCOMPLETE /
  SOURCE_REQUIRES_RENDERING honestly; the alternate Marcówki page is read
  (14 assets, 9 facts, 18 rooms) and refused at reconstruction on its
  550×550 plans (PLAN_LAYOUT_REJECTED), never by hostname; cross-source
  comparison with ARCHON: SOURCE_PARTIAL_EQUIVALENT. SSRF protections
  unchanged plus a per-hop port check. Kept honest: the generic reader is precision before reach (a page that lacks readable drawings ends in a typed refusal with the reason under "Szczegóły analizy", never a guessed house); no LLM, no browser, no API key.
- **KOSAĆCE — PASS.** The generic wall topology planner
  (`reconstruction/src/v2/wall-topology.ts`) runs before DSL emission;
  Kosaćce completes (3 masses, 13 openings, 169 commands, model
  `5b5ffcf1…`, scene `50217b85…`, the same on Node 18 without ICU);
  `WALLS_OVERLAP` stays strict; Marcówki and Rarytasy models byte-identical;
  sealed evidence and a third-house CI job. Kosaćce's printed values stay evaluation-only (in tests, never in production code); the planner is a generic decision between observed partition runs and the DSL, verified on 17 synthetic cases including genuine-overlap negatives that still fail.
- **Open for the OWNER:** visual acceptance of the house-first workspace on
  the phone; the questions in the 004A report's OWNER checklist.

## Where the analyzer's generalization stands (STAGE BUILDPLAN-ANALYZER-005A)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005A_GENERALIZATION_COUNCIL.md`. Evidence:
`stage-reports/artifacts/analyzer-005a/`. `PRE_HOLDOUT_SHA = 56ca1e3a5bd68c72f3dc1fab6ebade426bcc8ac8`.

- **ANALYZER GENERALIZATION ARCHITECTURE — PARTIAL.**
  - **Built.**
    - A seven-reviewer Council audited production before any code, with ten deliverables and a binding
      decision.
    - A post-implementation Council reviewed the result.
    - **Logical source identity** (`source-package`) is invariant to tracking queries, order, fragment,
      trailing slash, host case, canonical link and redirect.
    - A **bounded plan resolver** (`reconstruction/src/plan-resolution.ts`, 1.2.0) weighs copy, extent, scale,
      merge, face and mouth readings. It completes only on AGREES, NEAR+1 or UNKNOWN+2, and the only honest
      corroborations are isotropy and cross-copy agreement. A published figure that refused the first reading
      may veto but not also choose, and anything else is `PLAN_RESOLUTION_INCONCLUSIVE`, by name.
    - **Severity-typed warnings.**
    - A **derived no-development-house guard**, which the two sealed blind houses extend.
  - **Why PARTIAL.** The resolver weighs readings of one set of metric evidence. The scale vote, the text
    orientation and the plan extent below it are still single winners, and both blind houses failed there.
    - The Council named two of them before any code: root assumption 2, "the extent is the widest read chain",
      and root assumption 3, "one pooled scale, with losing readings rewritten to agree".
    - The stage worked around them in the resolver instead of removing them.
  - **Residual debt.** Ten named items are in report §AD. One of them is that after a structural stop the
    figure still chooses: 8 of 216 decoy cells.
- **OWNER DEVELOPMENT CASES — PARTIAL.**
  - **Achieved.**
    - Tracked Kosaćce equals clean Kosaćce (package id, content hash, candidate, model `5b5ffcf1…`, scene
      `50217b85…`).
    - Rarytasy e-OZE completes: resolved at 116.7 m² (−4.4 %), model `b50b6e59…`.
    - Marcówki (`6152770f…`) and G2E (`8fa4a25b…`) are unchanged.
  - **Open.**
    - The phone's single-copy Kosaćce case is refused as `PLAN_RESOLUTION_INCONCLUSIVE`, and why the phone
      received one copy of four is still unexplained. The acquisition now names every lost address.
    - e-OZE is resolved on the figure alone, with no witness, so it is LIMITING and would not pass the holdout
      predicate.
- **TRUE PROGRESS TELEMETRY — PASS.**
  - **What exists.**
    - A write-only checkpoint that ticks at every long loop.
    - A heartbeat and IO_WAIT.
    - Per-phase performance records.
    - The phone's program, protocol 3, cancels mid-computation.
    - The phone's card shows the phase, the real count, the substep, the step's duration and the last
      activity, and tells slow ("Nadal analizuję…") from unresponsive ("Brak odpowiedzi…").
  - **The numbers.** The longest silence went from 144–175 s to 2.1–3.7 s on the known set, and was 2.1–2.2 s on
    the blind runs. Peak memory is halved (1.8–2.2 GB → 0.75–0.92 GB); the metric pass is 17–29 % slower, for the
    bounded render cache, measured by an A/B.
  - **Still to confirm:** seeing it on the OWNER's phone.
- **BLIND ARCHON HOLDOUT 1 — ALGORITHMIC_FAIL.** `projekt-dom-w-jablonkach-22-mb0e2566e7cb18`:
  `PLAN_LAYOUT_REJECTED`, 46.49 of 99.4 m². 71 readings were weighed, all `WRONG`, and the resolver was
  `INCONCLUSIVE`.
  - **The drawing is adequate:** walls 20 px, glyphs 59 px, no plan lost.
  - **The first bad decision:** the rotated "900" was read as "006", then rewritten by the chain solver as
    "806" to fit the interior spans' scale, which it then anchored. The result was 1.88 cm/px, against the
    2.11 cm/px of the printed 1100 and 900.
- **BLIND ARCHON HOLDOUT 2 — ALGORITHMIC_FAIL.** `projekt-willa-miranda-11-g2-m49324d69ef143`:
  `PLAN_LAYOUT_REJECTED`, 0.55 of 169.9 m². 11 readings were weighed, all `WRONG`, the best at 101–104 m².
  - **The drawing is adequate:** walls 12 px, glyphs 48 px, no plan lost.
  - **The scale is right.** The first bad decision is the depth: the overall vertical chain 245 / 920 / 245 =
    1410 was read upside down ("0111", "036", "502", "535"), so an interior 2.5 m chain became the plan's
    extent, unmarked as weak.
- **Both holdouts ran once, on the frozen code, and nothing was patched.** Each verdict is its own, never
  averaged. Both families are now development cases.
- **OWNER APK.**
  - `owner-preview-latest`, from run 98 at `226f9ce`, whose analyzer code is the frozen code.
  - arm64-v8a only, versionCode 1098, `0.98.0-preview`.
  - SHA-256 `f27833554c41b5e75a1ff43a8a001b259f5779f9559e46d172057d7c9c86f9af`.
  - Each of these was verified from the downloaded file.
- **Open for the OWNER.** The progress card and the result warnings on the phone, following the checklist in
  report §AC.

## Where metric truth stands (STAGE BUILDPLAN-ANALYZER-005B)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005B_DIMENSION_EVIDENCE_REFOUNDATION.md`. Evidence:
`stage-reports/artifacts/analyzer-005b/`. `PRE_HOLDOUT_2_SHA = 27274ab8c24a17c484158f5e3a0bf091ce85e961` (CI run 101 green).

- **DIMENSION ORIENTATION — PASS.**
  - Every floor-plan label is read in four orientations and every reading is kept (`OcrToken.orientation`,
    `pageVote`); the page-wide vote can no longer delete the right reading before a chain sees it.
  - Each chain decides its own way up from evidence (self-consistency, a scale stated on other chains, leading
    zeros, the sheet's majority), and a way up chosen by a scale never witnesses that scale.
  - Metamorphic tests at 0/90/180/270°; the vote's own tokens are unchanged with or without the hypotheses.
- **SCALE EVIDENCE INDEPENDENCE — PASS** (right and independent on both new blind houses).
  - An independent metric solution per plan frame (`metrics.independent-scale@1.0.0`): one ink one witness,
    decisive readings only, a lexicographic evidence tuple, confidence STRONG/SUPPORTED/WEAK/INCONCLUSIVE, and a
    relation to the vote's scale (CONFIRMED / REPLACED / LEGACY_UNCONFIRMED / ADDED / NO_SCALE).
  - A correction made under a scale never witnesses it; a confirmed scale is never re-fitted, so confirmation never
    moves a model; the resolver scores refutation on values as read.
  - Residual: on REPLACED frames the registration still anchors on corrections made at the new scale.
- **PLAN EXTENT CLASSIFICATION — PARTIAL.**
  - Chain roles from geometry (wall witness; EXTERIOR / INTERIOR); an interior chain that does not span the walls
    never frames the building; a refusal only ever widens; a frame the walls supplied is named and limits the result.
  - Residual: a partial witness (outer walls split by wide openings) can still let an interior chain read EXTERIOR —
    willa-miranda's failure.
- **OWNER DEVELOPMENT SET — PARTIAL.**
  - Marcówki (`6152770f…`), Kosaćce clean and tracked (`5b5ffcf1…`) and G2E (`8fa4a25b…`) are byte-identical; e-OZE
    now PASSES on its first reading (123.99 m², +1.6 %, `b4e76f04…`); the alternate Marcówki page stops with the typed
    `METRIC_RESOLUTION_INCONCLUSIVE`.
  - dom-w-jablonkach completes at 94.18 m² (−5.3 %) on the scale its right-way `1100` states, and misses one printed
    opening; willa-miranda still fails (`PLAN_LAYOUT_REJECTED`).
  - The phone's Kosaćce copy loss is not in text handling (the phone runtime makes the desktop's package, byte for
    byte, from the same bytes); diagnostics now name each dropped copy.
- **PROGRESS TELEMETRY — PASS.** Orientation, scale and extent loops tick; longest silence ≤ 2.4 s one house at a time (≤ 4.9 s with eight houses on four cores; 1.9 and 2.1 s on the blind runs);
  the metric pass costs the same as before, sequentially (121 vs 126 s Marcówki, 152 vs 147 s dom-w-jablonkach).
- **BLIND HOLDOUT ROUND 2 — both ALGORITHMIC_FAIL, not in the refactored metric layer, not patched.** Drawn from 2534
  addresses with seed `1216338c…00cfd0`; each run once, live; evidence `stage-reports/artifacts/analyzer-005b/holdout/`.
  - **Project 1 `dom-w-zurawkach`: ALGORITHMIC_FAIL** (`PLAN_NO_MASSES`, best reading 40–43 m² against 101.7). Scale CONFIRMED/STRONG (5 independent readings as printed, the rotated `800`/`150` the right way up) and the printed extent 11.80 × 9.50 m are right; the garage wing is never proposed as a bay (one side wall runs through the envelope edge, the other reaches 1.04 m < 1.5 m), so the garage floods from its own mouth.
  - **Project 2 `dom-w-modrzykach`: ALGORITHMIC_FAIL** (`PLAN_LAYOUT_REJECTED`, 14.72 m² against 181.98). Scale REPLACED/STRONG (the vote had 0 independent readings; the rotated `1160` the right way up) and the printed extent 18.50 × 11.59 m are right; the walled envelope is 2.02 m of 11.60 m deep, stopped at the garage's back wall because a front of openings leaves no long band.
- **OWNER APK.** `owner-preview-latest`, from `workflow_dispatch` run 104 at `2e5a5bb` (analyzer code = the frozen
  `27274ab`; run 104 is also the final CI, green): arm64-v8a only, versionCode 1104, `0.104.0-preview`, SHA-256
  `9997ee732f6de1c0b57ec99e9dbee61e7faa1196c7c71c561f423e36f49f18dc`, preview signer `6e48fac4…a0da`, resolver 1.3.0,
  metric evidence schema 1.2.0 — each verified from the downloaded file. Open for the OWNER: the phone checklist in
  report §AI.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005B_BLIND_WALL_OUTLINE_FAIL`). Both new blind houses fail, in the
  walled outline (envelope and bays) on a side of openings — willa-miranda's class. CI green is not the verdict.

## Where the opening-aware envelope stands (STAGE BUILDPLAN-ANALYZER-005C)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005C_OPENING_AWARE_ENVELOPE.md`. Evidence:
`stage-reports/artifacts/analyzer-005c/`. `PRE_HOLDOUT_3_SHA = e328121b3aca2dfcec87db07db6277813eb04f34` (CI run 116 green).

- **OPENING-AWARE EXTERIOR ENVELOPE — PASS.**
  - The outline is read from wall-thick ink and classified gaps (glazing, doors, vehicle doors, weak gaps by what
    lies behind them), never from line work; it replaces the long-band box only where it continues the box's
    interior across an unsupported stretch of the box's own edge.
  - dom-w-modrzykach PASS (181.72 m², −0.14 %), dom-w-jablonkach PASS (−0.40 %); willa-miranda (−5.07 %) and
    dom-w-zurawkach (−0.81 %, the house and its garage) are built and fail on storeys; Marcówki, Kosaćce, G2E and
    e-OZE keep their model hashes; no development house moved down.
  - On the blind ARCHON house the outline continued through the glazed living-room side and stopped at the pergola.
- **ATTACHED BODY / BAY RECONSTRUCTION — PARTIAL.** Bodies are named by junction, sides and mouth and built right on
  the three envelope houses; open: party-wall garages still decided by reach in the box reading, a double garage with
  a post, a wing behind a doorway, storeys over attached bodies.
- **CROSS-PUBLISHER GENERIC SOURCE — PASS.** By structure, never by site: Aster VIII 0 → 11 figures and its outline
  documents (hashed, never parsed); the blind DobreDomy page read with no DobreDomy code (11 figures, 17 assets, 4
  documents) and stopped by name where its plans print no dimension.
- **005B METRIC LAYER REGRESSION — PASS.** No metric-layer file changed; one 005A known-set row now allows the
  resolver's named refusal, with its evidence (its sealed metric evidence misreads 16.01 m as 18.01 m; report §T).
- **PROGRESS TELEMETRY — PASS.** The boundary's subphases and counters, cancellable, in Polish on Android; residual:
  5.7 s of silence on a 1625 × 1700 px plan.
- **BLIND ROUND 3** (one ARCHON, one DobreDomy, each run once, live):
  - **`dom-w-azaliach`: ALGORITHMIC_FAIL** — completed at 67.26 m² (−3.48 %), every opening built, but storeys 1 of
    2 and a plan the published figure alone chose. First bad decision, in the metric layer as 005B left it: the
    overall chain on the dimensioned copy is split by a spurious tick and its italic `1035` read `1055`, so the
    sheet scale is 2.46 cm/px where both printed overall dimensions agree on 1.86.
  - **`galaktykaI`: SOURCE_LIMITED_PARTIAL** — the single ground plan prints no dimension (confirmed on the raw copy).
- **OWNER APK.** `owner-preview-latest`, from `workflow_dispatch` run 118 at `b3ad427` (analyzer code = the frozen
  `ca97516`; run 118 is also the final CI, green): arm64-v8a only, versionCode 1118, `0.118.0-preview`, SHA-256
  `eb530f7c66f6d204460dc1ad37c843ca9519d95f028a4ed337cacfa84efd5bec`, preview signer `6e48fac4…a0da`, boundary evidence
  1.0.0, generic reader 1.2.0, resolver 1.3.0, metric evidence schema 1.2.0 — each verified from the downloaded file.
  Open for the OWNER: the phone checklist in report §AE.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005C_BLIND_ARCHON_OVERALL_DIMENSION_MISREAD`). The ARCHON blind
  house fails in the metric layer, below the envelope this stage rebuilt. CI green is not the verdict.

## Where dimension-chain integrity stands (STAGE BUILDPLAN-ANALYZER-005D)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005D_DIMENSION_CHAIN_INTEGRITY.md`. Evidence:
`stage-reports/artifacts/analyzer-005d/` (reviews, development matrix, 16 Evidence Packs, the sealed blind round).
`PRE_HOLDOUT_4_SHA = 286486e6c262afa682c1374a3a8f777a6dcf5cd8` (CI run 120 green).

- **DIMENSION CHAIN TOPOLOGY — PASS.** Every mark on a dimension line is classed against the line it sits on (TICK,
  QUESTIONABLE, REJECTED, with reasons; `metrics.dimension-topology` 1.0.0); a rejected mark never ends a span, totals
  and children are related on values as read. Azalia's mark at 204.5 px is REJECTED and `1055` binds across it
  (77–633); real internal ticks stay; no development model hash moved. On both blind houses every mark, span and
  hierarchy decision on the overall lines was right.
- **OCR LABEL-TO-SPAN BINDING — PARTIAL.** Centring decides the span (PRIMARY / ALTERNATIVE / AMBIGUOUS); one ink is
  one witness; one-glyph alternatives are bounded and named. The bindings were right on both blind houses; the values
  were not: the overall figure was read as another dimension with the printed value outside the bounded readings —
  the reader limit declared before the draw (`it.fails`, blurred figures).
- **METRIC EVIDENCE INDEPENDENCE — PARTIAL.** I2, I5, V3 against the vote and the rivals, and the published figure as a
  verifier only (both blind runs: it chose nothing) held. On `dom-w-dabecjach` two misreads on two chains agreed and
  confirmed a wrong scale STRONG; a recorded total/children conflict and a runner-up fitting the rival did not unsettle
  it.
- **CURRENT e-OZE DEVELOPMENT — PASS** (MUST_COMPLETE: +1.57 %, model unchanged, `1601` read as printed).
- **LEGACY e-OZE COMPATIBILITY — PASS**, in its own lane ("not current acceptance"): the sealed 005A evidence completes
  by the drawing's own reading (−4.21 %, −4.37 %, the figure VERIFIED); decoy figures ×1.25 and ×0.8 are refused by
  name.
- **ANALYZER EVIDENCE PACK — PASS.** Post hoc from the run directory, ON == OFF, byte-deterministic, manifest-verified,
  no publisher pixel; 16 packs committed; the first divergence 005C → 005D on Azalia and both blind first bad decisions
  named from the packs.
- **005C BOUNDARY REGRESSION — PASS; 005C GENERIC SOURCE REGRESSION — PASS.**
- **BLIND ROUND 4** (two ARCHON families, each run once, live, Evidence Pack on):
  - **`dom-w-dabecjach`: ALGORITHMIC_FAIL** — refused `BOUNDARY_RESOLUTION_INCONCLUSIVE` on a plan registered at a
    CONFIRMED/STRONG 2.672 cm/px; the printed overalls state 2.81. First bad decision `OCR_READING` `1580` → `1501`
    (no bounded alternative), joined by `850` → `810`.
  - **`dom-w-tunbergiach`: ALGORITHMIC_FAIL** — completed at −12.47 %, storeys 1 of 3. First bad decision
    `OCR_READING` `1173` → `1117` (both true digits runners-up, the truth two substitutions away); it tied the true
    `1000`, the page vote's scale was kept INCONCLUSIVE, and the challenge kept it (the figure may not choose).
- **OWNER APK.** `owner-preview-latest`, from `workflow_dispatch` run 124 (attempt 2) at `d7a794f` (analyzer code = the
  frozen `286486e`; run 124 is also the final CI, green after one re-run of two jobs that failed before any test ran —
  an emulator-package download and the container smoke's start-up race): arm64-v8a only, versionCode 1124,
  `0.124.0-preview`, SHA-256 `c659270262101aba41ef6ac0b0c321c7f130f5d323ef6487ca97ca0ef6dc5e30`, preview signer
  `6e48fac4…a0da`, metric evidence schema 1.3.0, resolver 1.4.0, dimension topology 1.0.0, boundary evidence 1.0.0,
  generic reader 1.2.0 — each verified from the downloaded file. Open for the OWNER: the phone checklist in report §AG.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005D_BLIND_ARCHON_OVERALL_LABEL_MISREAD`). Both blind houses fail in
  the digit reader under the metric layer this stage rebuilt. CI green is not the verdict.

## Where the numeric reader stands (STAGE BUILDPLAN-ANALYZER-005E)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005E_NUMERIC_OCR_LATTICE.md`. Evidence: `stage-reports/artifacts/analyzer-005e/`
(reviews, calibration, development matrix, 6 Evidence Packs, the sealed blind round).
`PRE_HOLDOUT_5_SHA = 9f7423d90b84fc7ff3d6bb976332539390d25879` (CI run 131 green).

- **NUMERIC OCR CANDIDATE RECALL — PARTIAL.**
  - Each dimension label gets an image-only lattice (`metrics.numeric-lattice` 1.0.0): three ink variants of one ink,
    re-cuts at fixed glyph count, the grammar alphabet, a softmax over glyph scores, and a bounded beam (at most two
    non-top glyphs, 8 values, as-read included).
  - The printed figure is in the lattice for 72 of 81 development labels (005D: 47) and for 189 and 187 of 240 corpus
    labels (005D: 108 and 110).
  - On the round-4 houses `1580` and `850` are now read as printed, and `1173` is in the lattice.
  - Blind round 5: every overall of `dom-w-morelach` is in its lattice. `dom-w-modrzewnicy`'s condensed `2590` is cut
    into three cells and cannot be held.
- **MULTI-GLYPH SEQUENCE DECODING — PARTIAL.** Two-substitution truths the glyph scores support are kept (§30). A label's
  glyph count is never varied, and a truth with two weak glyph alternatives falls under the floor (blind 1 `1950` →
  `1410`).
- **OCR CONFIDENCE CALIBRATION — PARTIAL.**
  - Classes LOW_QUALITY, AMBIGUOUS, SUPPORTED (margin required) and CLEAR come from the reader's evidence only. A
    reading the stability bracket moves is never CLEAR or SUPPORTED.
  - CLEAR is right on 9 of 9 development labels and 80 of 86 corpus labels.
  - A confident misread stays SUPPORTED (declared; blind 1 `1410`).
- **METRIC EVIDENCE INDEPENDENCE — PASS** (one declared exemption).
  - Only the as-read value witnesses; values are selected from the ink's own lattice; the re-solve reads only the
    lattice.
  - Image score, structural support and metric support are recorded apart.
  - The exemption: the kept 005D chains of a confirmed frame stay 005D's (contract R1, B5E-2).
- **FALSE CONSENSUS PROTECTION — PASS.**
  - Two AMBIGUOUS witnesses make at most WEAK. A better-read standing rival or agreeing held alternatives make the
    result INCONCLUSIVE, and the vote is never handed a REPLACE.
  - dabecjach's false STRONG is gone, and no wrong scale reaches SUPPORTED or STRONG under a ±20 % threshold sweep.
  - Neither blind house adopted a wrong scale.
- **CURRENT e-OZE — PASS** (MUST_COMPLETE: REPLACED/STRONG on an overall reading, +1.51 %; `1600` now read as printed).
  Legacy e-OZE is unchanged in its own lane.
- **005D CHAIN TOPOLOGY REGRESSION — PASS.** Mark classes are identical on every shared chain, Azalia's spurious tick
  is still rejected, and no development PASS was lost (16 rows).
- **ANALYZER EVIDENCE PACK — PASS.** The OCR layer and the `OCR_SEQUENCE_CANDIDATES` stage hold ON == OFF, determinism
  and manifests. The first divergence compares the tick stage only on marks both runs recorded, and on both round-4
  houses it is `OCR_SEQUENCE_CANDIDATES`.
- **BLIND ROUND 5** (two ARCHON families, each run once, live, Evidence Pack on):
  - **`dom-w-modrzewnicy`: ALGORITHMIC_FAIL.** Refused `METRIC_RESOLUTION_INCONCLUSIVE`, no scale adopted. First bad
    decision `OCR_SEQUENCE_CANDIDATES` `e00013`: the condensed overall `2590` is cut into three cells by the
    expected-width rule. `1950` is read `1410` SUPPORTED.
  - **`dom-w-morelach`: ALGORITHMIC_FAIL.** Completed at −11.54 %, storeys 2 of 2, openings all built, on the right
    scale (CONFIRMED/WEAK 1.9956). First bad decision `ENVELOPE` `e00427`: the box stops inside the chain extent, the
    east bay is not built and the garage stops short.
- **OWNER APK.** `owner-preview-latest`, from `workflow_dispatch` run 135 at `dab64d6`: the final CI, green at the first attempt. Its analyzer code is the frozen `9f7423d`. Each of the following was verified from the downloaded file:
  - arm64-v8a only, versionCode 1135, `0.135.0-preview`;
  - SHA-256 `1d611c0b177e65e1e15459e738a435caa653898beca6505be708b99981466417`;
  - preview signer `6e48fac4…a0da`;
  - numeric lattice 1.0.0, metric reader 1.3.0, metric solver 1.2.0, metric evidence schema 1.4.0, dimension topology 1.0.0, resolver 1.4.0.

  Open for the OWNER: the phone checklist in report §AF.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005E_BLIND_CONDENSED_LABEL_AND_ENVELOPE_FAILS`). CI green is not the
  verdict.

## Where glyph counts and the envelope stand (STAGE BUILDPLAN-ANALYZER-005F)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005F_ADAPTIVE_SEGMENTATION_ENVELOPE.md`. Evidence:
`stage-reports/artifacts/analyzer-005f/` (pre- and post-reviews with their resolution, calibration, development matrix,
4 Evidence Packs, the sealed blind round). `PRE_HOLDOUT_6_SHA = 65ae015fd1e32e6e0de312b0d78301d9a4d07f03` (CI run 145
green).

- **ADAPTIVE GLYPH-COUNT SEGMENTATION — PARTIAL.**
  - A label's glyph count is a hypothesis of its own (`metrics.numeric-lattice` 1.1.0): admitted by its width against
    the plan's own dimension-font style and by valley and counter topology, never by a template score or a scale; a
    split the style rules necessary is decisive, a merge never is; counter-safe cuts never run through a `0` or an `8`.
  - modrzewnicy's condensed `2590` is now cut into four cells in all three ink variants (005E: three).
  - A count only the style gave, a count the variants disagree on, or a width that fits a count one away as well makes
    the reading AMBIGUOUS. Over-cuts of ordinary labels under another face's style are flagged, not undone.
- **CONDENSED NUMERIC LABEL RECALL — PARTIAL.** 74 of 81 development labels hold the printed figure (005E 72). The
  target's count is recovered, its value is not: `2590` reads `1140`, the `9` read `4`.
- **NUMERIC OCR NON-CIRCULARITY — PASS.** No scale creates, chooses or promotes a count; a value of another digit count
  never contests a scale; the ambiguity tail is recorded beside the values and read by no decision.
- **EXTENT-CONSISTENT ENVELOPE — PARTIAL.** A side the exterior chains state two walls past the box is an
  `ENVELOPE_EXTENT_CONFLICT` (`boundary-evidence` 1.1.0), recorded and judged before the resolver. Morelach's is
  accepted (PASS, −3.12 %). Blind 2's are raised and build nothing, but its envelope still ends inside the stated
  extent: the 005C outline gives up wall and floor the box held.
- **ATTACHED BODY COMPLETION — PARTIAL.** Attached rooms and box completions need a way in, walls, room evidence and
  returns, clipped to their own free floor, the same any way up. On development only Morelach exercises them — the
  house they were iterated on; no blind house had an attached body.
- **TERRACE / FALSE-CLOSURE SAFETY — PASS.** Nothing invented on 20 development rows or the blind round; terraces,
  canopies, carports, walled yards and thin parapets stay unbuilt in five orientations. Declared limit: a wall-thick
  parapet with a glazed balustrade draws exactly like a bay.
- **ANALYZER EVIDENCE PACK — PASS.** The glyph-count and extent-conflict layers hold ON == OFF, determinism and
  manifests; first divergences are named for every house that moved.
- **CURRENT e-OZE — PASS** (MUST_COMPLETE: REPLACED/STRONG, +1.51 %, model unchanged).
- **BLIND ROUND 6** (two ARCHON families, each run once, live, Evidence Pack on):
  - **`dom-pod-milorzebem`: ALGORITHMIC_FAIL.** Refused `METRIC_RESOLUTION_INCONCLUSIVE`, typed
    `DIMENSION_EVIDENCE_INCONCLUSIVE`, no scale adopted. Both overalls read right (`1270`, `650`); first bad decision
    `OCR_SEQUENCE_CANDIDATES` `e00047`: `648` read `608` SUPPORTED at the right count, stating a rival scale.
  - **`dom-w-helikoniach`: ALGORITHMIC_FAIL.** Completed at −18.88 %, 1 storey of 2, on the right ground scale. First
    bad decision `METRIC_RELATION` `e00319`: the attic plan keeps an unsupported page-vote scale and registers onto too
    little of the body; independently `ENVELOPE` `e00335` cuts the ground plan on its outline.
- **OWNER APK.** `owner-preview-latest`, from `workflow_dispatch` run 151 at `6b22582`: the final CI, green at the first attempt. Its analyzer code is the frozen `65ae015`. Each of the following was verified from the downloaded file:
  - arm64-v8a only, versionCode 1151, `0.151.0-preview`;
  - SHA-256 `8aa39e7ba8eec2bf9aa836a5e85edd3b54be2f93409c2307094e130a16856067`;
  - preview signer `6e48fac4…a0da`;
  - numeric lattice 1.1.0, metric solver 1.3.0, metric evidence schema 1.5.0, boundary evidence 1.1.0, metric reader 1.3.0, dimension topology 1.0.0, resolver 1.4.0.

  Open for the OWNER: the phone checklist in report §AF.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005F_GLYPH_MISREADS_AND_BLIND_ROUND_6_FAILS`). CI green is not the
  verdict.

## Where the open-source technology audit stands (STAGE BUILDPLAN-ANALYZER-005G)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005G_OPEN_SOURCE_TECH_AUDIT.md`. Evidence:
`stage-reports/artifacts/analyzer-005g/`:
- the architecture map and integration map;
- the technology matrix (38 candidates × 26 criteria) and the licensing matrix (code / weights / data separately);
- the OCR bake-off, the PDF probe, the CV and geometry probes, the floor-plan ML audit;
- the deployment matrix, the recommendation and the sources.

The harness is in `research/analyzer-005g/` (research-only, not a workspace).

**Audit only.** No production file, model hash, resolver bound or APK dependency changed. 005G consumed no blind
project.

- **SINGLE_REPO_AUDIT — PASS.** BuildApp has no production dependency on Legacy; Legacy was not touched.
- **OCR BAKE-OFF — PASS.** Same crops for every engine. Real labels: 81 from 005E plus 22 transcribed for 005G on
  modrzewnicy and pod-milorzebem. On real labels (exact / trusted / trusted-wrong):

  | engine | result |
  | --- | --- |
  | production reader | 49 / 44 / **10** |
  | PaddleOCR PP-OCRv6 tiny | **103 / 99 / 0** |
  | en PP-OCRv5 mobile | 101 / 96 / 0 |
  | Tesseract | 94 / 86 / 2 |

  On all 775: 309 / **75** wrong against **707 / 4**. The blind-round misreads (`1950 → 1410`, `648 → 608`,
  condensed `2590`) read right at p ≥ 0.997.
  - The best design is **OCR-2 ensemble with a stability bracket**: 631 trusted, 2 wrong on 775; 88 trusted, 0 wrong
    on real.
  - A fallback design is the worst (64 trusted-wrong): the reader's own confident misreads never reach the external
    engine.
- **DEPLOYMENT — PASS on desktop, Node 18 and arm64 V8; device pending.**
  - ONNX Runtime Web 1.30.0 (WASM) runs the pinned model inside the existing analyzer bundle on Node 18.20.4,
    including without ICU, at 44 ms per label.
  - It adds 0 `.so` and about 7.8 MB for every ABI, with no telemetry, and is bit-identical on Node 18 and Node 22 and
    on arm64 V8 (official Node 18 arm64 under qemu).
  - Rejected: native ONNX Runtime Android (+12.4 MB per ABI; ≥ 1.29 adds `INTERNET`, `ACCESS_NETWORK_STATE` and a
    telemetry provider) and ML Kit.
- **PDF / VECTOR — PASS.** PDF.js 4.8.69 (the last Node-18 line) reads Aster VIII's outline PDF: "1:500" and the
  scale bar fitted as geometry agree to 3e-5, and the walls come out as an exact polygon. Galaktyka I's PDF has no
  text; its outlined "1:500" and scale bar are read by the same recogniser. Closing the envelope stays a resolver
  decision.
- **CV — DEFER OpenCV.** `source-cv` is bit-identical on components and morphology.
- **Floor-plan ML — none usable.** No model has commercially clean code + weights + data.
- **Geometry — DEFER.** polygon-clipping throws on rotated walls (REJECT); polyclip-ts and Clipper2 DEFER; JSTS is the
  oracle.
- **Answers to the brief's twelve decision questions**: report §J and `recommendation.md`.

**CI:** run 153 (id 37350693720) on `2c6b615` — **green on every job** (core, Node 18 parity, APK size + emulator, the UI evidence gate, every development-house and analyzer gate). Direct-APK publishing was skipped, as on any push; no OWNER APK is part of this audit stage. The CI record itself is the commit after `2c6b615`.

## Where the external numeric recogniser stands (STAGE BUILDPLAN-ANALYZER-005H)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005H_EXTERNAL_NUMERIC_RECOGNISER.md`. Evidence:
`stage-reports/artifacts/analyzer-005h/` — architecture, model-runtime integrity, parity (Node, x86 emulator, arm64
device), synthetic quality, development matrix OFF and ON, performance, memory, post-review (four red teams and the
resolution), blind round 7 (draw, runs, verdicts, diagnosis, the two Evidence Packs) and the recommendation.

**What exists.** PaddleOCR `PP-OCRv6_tiny_rec` (official ONNX, sha256 `9ef676d6…`, Apache-2.0) on ONNX Runtime Web
1.30.0 (WebAssembly `3398c10d…`, one thread) reads every latticed dimension label a second time, from the same pixels,
in a worker per plan, beside the custom reader. One rule (P2, `source-metrics/src/ensemble.ts`) combines the two; the
metric resolver decides. On in the APK, off on the analyzer API. No fallback, no new `.so`, no Gradle ML dependency,
no runtime network; the model ships in the APK and is verified by SHA-256 before every load. Schema `1.6.0`, lattice
`1.2.0` only when a label was read; otherwise the bytes are the pre-005H ones. The app has an OCR self-test ("Test
zgodności odczytu wymiarów").

- **EXTERNAL NUMERIC RECOGNISER INTEGRATION — PASS.**
- **OCR ENSEMBLE NON-CIRCULARITY — PASS.** Pixels only, cut before the metric solve, opaque keys; the architecture test
  enforces it; 4602 / 4602 development lattice records byte-identical OFF and ON apart from the external fields.
- **NUMERIC TARGET LABELS — PARTIAL.** `tunbergiach` `1173` read (LEADS). `modrzewnicy` `1950` and `pod-milorzebem`
  `648` contested with the right value as candidate, still refused (no wrong building). `modrzewnicy` `2590` read right
  by the model at mean p 0.8955 < 0.90: NOT_CORROBORATING. `dabecjach` `1580`/`850` AGREE (fails on its boundary).
- **NODE PARITY — PASS.** Node 22 / 18 / 18 without ICU: self-test MATCH, fixture analyses hash-identical.
- **X86 EMULATOR PARITY — PASS.** CI run 157: self-test MATCH, live Marcówki equal to the desktop on every hash.
- **ARM64 DEVICE PARITY — PENDING.** No physical arm64 phone reachable. The APK bundle on arm64 Node 18 under QEMU
  gives MATCH (supplementary, not the verdict). OWNER: run the self-test on the phone (checklist in the report §R).
- **OCR MEMORY / LIFECYCLE — PASS** (desktop, emulator). ~100 ms per label, +24 to +36 s per analysis on desktop;
  worker +≤ 108 MB at load, ≥ 44 MB back at exit; peak ≤ 1046 MB desktop, 981 MiB emulator. Watchdog, cancel =
  terminate (0.5 / 1.0 s on the emulator), typed `EXTERNAL_RECOGNISER_FAILED`.
- **EVIDENCE PACK — PASS.** `EXTERNAL_OCR_CANDIDATES`, the recogniser in the manifest, deterministic.
- **CURRENT e-OZE — PASS.** +1.51 % OFF and ON.
- **BLIND ROUND 7 PROJECT 1 (`dom-pod-jarzabem`) — ALGORITHMIC_FAIL.** `BOUNDARY_RESOLUTION_INCONCLUSIVE`, no building.
  First bad decision `LABEL_BINDING` `e00276`: the `900` label bound to the parallel `1100` overall line, which leaves
  the overall unread and lets the extent cut the house above its south wall. External OCR read the overalls right; the
  OFF replay fails the same way. Class: metric (dimension topology).
- **BLIND ROUND 7 PROJECT 2 (`dom-w-arkadiach`) — PASS.** 2 / 2 storeys, openings built, −0.49 %. The external reader
  read the overalls `740` / `940` the custom reader could not; the OFF replay of the same bytes refuses.
- On both blind plans: 9 LEADS all right, 4 confident disagreements with a CLEAR lattice all right, 0 external
  confident-wrong.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005H_ARM64_PENDING_AND_BLIND_7_TOPOLOGY_FAIL`). Not patched after the
  draw. Both round-7 families join the development set.

**CI:** run 160 (`workflow_dispatch`, id 37399397739) on `863b525` — green at the first attempt (39 jobs, 38 green,
`preview-latest` skipped by design). **OWNER APK:** `owner-preview-latest/BuildPlan-owner-preview.apk`, versionCode
1160, 39.4 MB, sha256 `c9cf22daf59cd7f38422d4d59eef89c1d06c15af2e1ba03c2a78694db0f24e90`, arm64-v8a only, the same five
`.so`, preview signer `6e48fac4…`, model `9ef676d6…` and WASM `3398c10d…` inside, verified from the downloaded file
(report §R).

## Where the floor-plan intelligence audit stands (STAGE BUILDPLAN-ANALYZER-005J)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005J_FLOORPLAN_INTELLIGENCE_AUDIT.md`. Evidence:
`stage-reports/artifacts/analyzer-005j/`:
- the opportunity map, the technology and licensing matrices, the floor-plan model audits and the VLM audit;
- the question corpus (coordinates and hashes only), the bake-off, the wall-model proof and the oracle replay;
- the training plan, the Android deployment matrix and server feasibility;
- the reuse map, the six-reviewer post-review and the recommendation.

**What exists.** Research only. `research/analyzer-005j/` holds the harness:
- a counterfactual synthetic question generator;
- the real-question builder;
- the VLM runners and the pre-registered scorer;
- two from-scratch wall networks and a micro-referee pilot;
- a WASM probe;
- an oracle replay of the frozen solver.

No production file, model, dependency, Evidence Pack format or APK input changed. No publisher pixel or model file is
in the repository; `tests/architecture/research-isolation.test.ts` (005J block) holds this.

- **DECISION SEAMS — PASS.** 52 seams from the code (12 P0). The P0 list is dominated by gap decisions. Both round-8
  first divergences are gap misreads (gozdzikowcach's porch + garage door read as one OPEN_SIDE; cyklamenach's window
  read as pattern).
- **FLOOR-PLAN OSS — PASS (none adoptable).**
  - ResPlan: DATA_CANDIDATE_WITH_COUNSEL (CC BY 4.0 vs CC BY-NC-SA 4.0 conflict, scraped listings, canvas units not
    metres).
  - fpvec-lab: one README, nothing published — REIMPLEMENT_FROM_PAPER.
  - MitUNet: non-commercial on several grounds — ARCHITECTURE_CANDIDATE_FOR_RETRAINING.
  - The only commercially clean training route is BuildPlan's own synthetic data, from scratch.
- **SMALL-VLM REFEREE — REJECT.**
  - With the same crops, prompts and closed enums (each arm on a different subset of one pool; matched subsets in
    `vlm-bakeoff.md` §8), SmolVLM2-500M in its deployable 64-image-token configuration is right on 45 % of answered
    questions, with 7.2 % confident-wrong; on the oracle's items 46 of 100 against the oracle's 138 of 141.
  - Moondream 0.5B is right on 46 % and Florence-2-base on 41 %.
  - In the shipped WASM runtime SmolVLM2 costs ≈ 17–20 s and ≥ 1.9 GiB per question, ≈ 7 min per median house.
  - The in-session strong model (blind) is right on 98 %, with 0 confident-wrong at 0.80: the questions are answerable.
- **WALL / OPENING MODEL — PASS_RESEARCH (challenger).**
  - UNet-lite (1.56 M, 6.25 MB ONNX) was trained from scratch on synthetic data only.
  - It reaches exterior-wall recall 0.91–1.00 on 7 ARCHON sheets.
  - It finds real openings when placed on the wall axis. That set is one-class and the placement comes from the truth.
  - Its real "say no" evidence is 7 questions with one confident miss.
  - It runs at 1.19 s per 864² frame in ORT-web WASM.
  - MiT-B0 is DEFERRED.
- **ROUTE-C PILOT — NEGATIVE ON REAL.** A whole-image classifier trained on synthetic questions only reaches 85 % on
  synthetic but 49.6 % on real, with 34 % confident-wrong.
- **ORACLE REPLAY — PASS_RESEARCH.** The frozen solver was re-run on the sealed evidence with an oracle gap witness.
  - Upgrading one 0.41 m drawn gap completes `dom-w-gozdzikowcach`'s footprint at −3.75 %; the verdict still fails on
    the storey count.
  - `dom-w-cyklamenach` is stopped by NO_CONTINUATION / TOO_LARGE.
  - A deterministic upgrade with no model is outcome-identical on every measured row. Nothing moves a verdict.
  - The storey count is the most frequent verdict blocker.
- **COUNCIL — six independent reviewers; A and F raised one P0 each (no replay; the rejection of NO_AI_YET did not distinguish it from the primary). The replay was run and F's P0 flipped the decision to NO_AI_YET; no P0 open, every P1 fixed or stated.**
- **Stage: ⟪STAGE_TOKEN⟫.** No blind project consumed; round 9 not drawn; 005I production code not reopened.

⟪CI_LINE⟫

## Where the dimension topology and the boundary bake-off stand (STAGE BUILDPLAN-ANALYZER-005I)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005I_DIMENSION_TOPOLOGY_BOUNDARY_BAKEOFF.md`. Evidence:
`stage-reports/artifacts/analyzer-005i/`:

- architecture and baseline;
- the synthetic corpus record, mutation results, order invariance and performance;
- the development matrix and OCR regression;
- the post-review folder (five reviews and the resolution);
- the boundary bake-off (`boundary-bakeoff/`, research only);
- blind round 8 (draw, runs, verdicts, diagnosis and the two Evidence Packs).

**What exists.** Between pixels and metric evidence there is now a dimension-topology layer (`source-metrics`), and it
emits no building dimension:

- ink a crossing mark owes to printed numerals along the line is not a tick (`TEXT_INK`);
- every label is given every line it could belong to, with the page side of its ink and the sheet's own side
  convention, and neighbourhoods of competing labels are assigned exactly, refusing ties;
- parallel lines form axis groups with nesting relations;
- `planExtent` keeps an unread short end span the drawing states, and lets walls only refute a framed side, making the
  frame weak.

All of it is in the metric evidence 1.7.0 / 1.8.0 and its hash, and in the Evidence Pack 1.1.0 (`07b-dimension-topology`).

- **PARALLEL DIMENSION AXES — PASS.** Axis groups with distinct members, separations, `SUBDIVIDES` / `CONTAINS` /
  `OVERLAPS` and aligned ends, canonical in line order.
- **TEXT / TICK SEPARATION — PASS.** Both sides label ink → REJECTED, one side → at most QUESTIONABLE; a stroke reaching
  the line keeps its class; numerals printed along the line only.
- **GLOBAL LABEL BINDING — PASS.** Exact per neighbourhood, canonical, AMBIGUOUS bound to nothing; work-bounded (an
  over-bound neighbourhood is a recorded gap) with a heartbeat. On the development sheets the largest neighbourhood is
  7 labels.
- **SHORT END SPANS — PASS.** Kept when ticked and labelled, or when a neighbouring line ends there; every keep or trim
  is recorded. Known limit: A7 (an unlabelled one shorter than two walls is still trimmed).
- **EXTENT REFUTATION — PASS.** Two walls running past a framed side move it only to where a dimension line ends,
  otherwise DOWNGRADED; either way the frame is weak; outer-total sides are never asked.
- **OCR 005H REGRESSION — PASS.** Every OCR token and numeric lattice on 24 development rows byte-identical to 005H.
- **DOM-POD-JARZABEM — FIXED, still ALGORITHMIC_FAIL.** The old first bad decision (label ink as ticks → greedy
  binding → end-stub trim) is gone: it completes, 1 body, 191.0 m² (−11.88 % of 216.76). New first bad decision
  BODY_RELATION: a recessed entrance strip left unbuilt.
- **DOM-W-ARKADIACH — PASS, not regressed.** −0.49 %, model identical to the blind run.
- **DEVELOPMENT MATRIX — PASS.** 24 rows, no verdict or verdict condition changed, 20 models byte-identical; four
  movements explained:
  - jarzabem: the target fix;
  - e-OZE: +1.57 %, now CONFIRMED where 005H REPLACED;
  - morelach: −2.17 %, fewer openings;
  - helikoniach: footprint unchanged, fewer openings.
- **BOUNDARY BAKE-OFF — PASS_RESEARCH.**
  - Line providers add 0.00 m of ink-supported exterior wall beyond source-cv on all 7 real houses.
  - MobileSAM's box mask adds +0.005 mean IoU over the box it is prompted with, and brings false evidence.
  - The documented boundary failures are interpretation, not perception.
  - BEST_BOUNDARY_CANDIDATE **NONE**.
- **DEEPLSD — REJECT.** It adds no supported coverage and adds distractors (up to 27.8 m per house). Its LSD step is
  AGPL-3.0+, its weights come from an unofficial mirror, its refiner carries a research-only, patent-noticed library
  and is not reproducible, and it would cost ≥ +81 % of the APK.
- **ELSED — DEFER.** Apache-2.0, 13 ms, adds nothing on real plans, gains only on a 45° bay. Revisit only if oblique
  facades enter the development set, by porting the algorithm — never by packaging OpenCV.
- **MOBILESAM — REJECT.** The box mask is the box (+0.005 IoU, sign fragile). It has 15 false gap bridges against 7 for
  source-cv, inherits metric defects, would cost +93 % of the APK, and its training data carries a research licence.
- **RESEARCH / PRODUCTION ISOLATION — PASS.** `tests/architecture/research-isolation.test.ts`: no production source,
  runner, build script, manifest or Gradle file names or imports research; no checkpoint is tracked; the APK carries
  no research asset.
- **LICENSING — PASS (research).** Code, weights and data split per provider, with refine-path and tooling licences;
  nothing redistributed.
- **POST-IMPLEMENTATION COUNCIL — PASS after fixes.** Five reviewers, no P0, six P1, all fixed and held by tests.
- **BLIND ROUND 8 PROJECT 1 (`dom-w-gozdzikowcach`) — ALGORITHMIC_FAIL.** `PLAN_RESOLUTION_INCONCLUSIVE`, 105.47 vs
  132.52 m²; metric CONFIRMED and extent right. FIRST_BAD_DECISION **BODY_RELATION**: a recessed entrance porch
  between two wings, merged with the garage door into one 7.76 m OPEN_SIDE, leaves the hall and stair out.
- **BLIND ROUND 8 PROJECT 2 (`dom-w-cyklamenach`) — ALGORITHMIC_FAIL.** `PLAN_RESOLUTION_INCONCLUSIVE`, 49.20 vs
  92.48 m²; metric CONFIRMED and extent right. FIRST_BAD_DECISION **BOUNDARY**: window glazing next to a textured
  terrace read as a pattern, and the 40 m² living-room block's completion rejected as NO_CONTINUATION.
- **INHERITED ARM64 DEVICE PARITY — PENDING.** No phone result was supplied; the 005H self-test is unchanged in the app.
- **Stage: PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005I_BLIND_8_BOUNDARY_INTERPRETATION_FAIL`). Not patched after the
  draw. Both round-8 families join the development set. Disclosed in the blind README: round 8's exclusion swept only
  round 7's linked families; the next round should sweep every development page's links.

**CI:** run 169 (`37464801271`) on `869cb01` (PRE_HOLDOUT_8_SHA) green. **Final CI:** run 172 (`workflow_dispatch`, id 37474671669) on `a7f009a` — green at the first attempt (41 jobs, 40 green, `preview-latest` skipped by design). **OWNER APK:** `owner-preview-latest/BuildPlan-owner-preview.apk`, versionCode 1172, 39.4 MB (+11 KB: the topology code), sha256 `70b4ff90aa4f5170a334377fc17e1a1a3ea84b9d6c45cd8e92a73b685f4df0b5`, arm64-v8a only, the same five `.so`, preview signer `6e48fac4…`, model `9ef676d6…` and WASM `3398c10d…` unchanged, no research asset; verified from the downloaded file (report §T).

## Recommended technical next step

**For the analyzer line (after 005J): return to the coordinator.** `stage-reports/artifacts/analyzer-005j/recommendation.md`.

**PRIMARY_NEXT: NO_AI_YET — BUILDPLAN-ANALYZER-005K: gap evidence records + sealed fresh-sheet gap set +
deterministic drawn-gap upgrade.**
- Per-gap Evidence Pack records: stable id, `linePx` + `axisPx`, crop rectangle and hash, pre-override signature,
  strokes, ink fraction.
- A sealed set of gaps from fresh sheets: drawn by lot, at least one other publisher, labelled before any rule or model
  runs, with a constant control beside every gate.
- The deterministic upgrade (drawn evidence inside the wall band; BLANK and phantom stretches excluded):
  - measured on the development matrix OFF / ON and on the sealed set;
  - shipped only if its false upgrades are bounded.

**SECONDARY_LATER: TRAIN_BUILDPLAN_WALL_MODEL as the challenger,** only if the sealed set shows deterministic false
upgrades that matter and that the model refuses.

**The coordinator also decides:**
- the order against 005I's PATH B (PDF.js), which reaches only 2 of 26 development and round-8 sources;
- the deterministic verdict blockers the replay names: the storey count (most frequent), REC-17 / TOO_LARGE
  (cyklamenach), and the recessed-entrance relation (jarzabem).

OWNER: run "Test zgodności odczytu wymiarów" on the arm64 phone.

The 005I recommendation below (PATH B) is superseded by the 005J recommendation, subject to the coordinator.


**For the analyzer line (after 005I): return to the coordinator.** No boundary provider earned ADOPT_NEXT, so by the
005I brief (§59) the route is **PATH B — the PDF.js vector-document evidence pilot**. ELSED stays DEFER.

The analyzer's measured failures after 005I are boundary interpretation, not perception and not dimension topology.
They are the resolver's next inputs whichever path is chosen, and all of their evidence is already in BuildPlan's own
observations:

- recessed entrances between wings (blind-7 #1, blind-8 #1);
- glazing against textured fill, and an interior junction read as separating (blind-8 #2).

OWNER: run "Test zgodności odczytu wymiarów" on the arm64 phone.

The 005H recommendation below is answered by 005I (dimension topology on parallel chains).

**For the analyzer line (after 005H): return to the coordinator.** `stage-reports/artifacts/analyzer-005h/recommendation.md`:
1. keep the recogniser and the P2 rule as they are;
2. OWNER: run "Test zgodności odczytu wymiarów" on the arm64 phone (closes ARM64 DEVICE PARITY);
3. next analyzer stage: dimension topology on parallel chains — label-to-line binding between an overall line and its
   inner chain, label ink taken for ticks, and the extent's end-stub trim (blind round 7 #1 is the input);
4. then the PDF.js document-evidence pilot (005G), which this brief deferred.

The 005G recommendation below is answered by 005H: the recogniser is integrated as specified.

**For the analyzer line: BUILDPLAN-ANALYZER-005H — external numeric recogniser ensemble.**
- **What it is:** PaddleOCR PP-OCRv6 tiny (official ONNX, SHA-256 `9ef676d6…`) on ONNX Runtime Web (WASM) inside the
  existing analyzer bundle.
- **How it is used:** as a second, image-only candidate source in the numeric lattice with a stability bracket; the
  metric resolver still decides.
- **Specification:** files, interfaces, tests, Evidence Pack additions, CI gates and the version/hash contract in
  `stage-reports/artifacts/analyzer-005g/integration-map.md`.
- **First gates:**
  1. bit-identical per-label outputs on the x86_64 emulator and the OWNER's arm64 phone;
  2. the synthetic regression;
  3. existing gates with the recogniser off (unchanged) and on (every hash change explained);
  4. a fresh blind protocol.
- **After it:** PDF.js document evidence (PILOT).

The 005F recommendation below is answered by 005G: the glyph classifier's confident misreads at the right count are
the defect an external recogniser removes on the same crops (`ocr-bakeoff.md`).

**For the analyzer line: return to the coordinator with the glyph classifier's confident misreads at the right digit count as the next stage's input** — blind round 6's first bad decision (`dom-pod-milorzebem`, `648` read `608` SUPPORTED) and the reason modrzewnicy stays unread (`2590`'s `9` read `4` in every four-cell cut), the same failure in the matcher on small, condensed digits after 005F's count fix (report §AA, §AH, `artifacts/analyzer-005f/holdout/`, `evidence/blind-*`). Both round-6 families join the development set; `dom-w-helikoniach`'s attic-plan scale and ground outline faces are recorded for the stage after. A further claim needs a new blind draw on a new frozen SHA.

The 005E recommendation below is addressed in 005F as far as the count and the envelope go: modrzewnicy's overall is cut at the right count (its value is still misread) and Morelach passes; see "Where glyph counts and the envelope stand".

**Superseded (005E): return to the coordinator with the BUILDPLAN-ANALYZER-005E round-5 defects as the next stage's input**. The numeric reader cuts a condensed overall label into too few glyphs and reads a two-glyph misread as SUPPORTED (`dom-w-modrzewnicy`: `2590` in three cells, `1950` → `1410`). On a right scale, the envelope's box stops inside the chain extent and an attached bay is not built (`dom-w-morelach`, −11.54 %) (report §Z–AC, `artifacts/analyzer-005e/holdout/`, `evidence/blind-*`). Both families join the development set; a further claim needs a new blind draw on a new frozen SHA.

The 005D analyzer recommendation below (the round-4 overall labels misread outside the bounded readings) is addressed in 005E: both round-4 houses now take the printed scale generically; see "Where the numeric reader stands".

**Superseded (005D): return to the coordinator with the BUILDPLAN-ANALYZER-005D round-4 ARCHON defect as the next stage's input** — the overall dimension label is misread with the printed value outside the reader's bounded readings (`dom-w-dabecjach`: `1580` read `1501`, a second misread `850` → `810` agreeing with it; `dom-w-tunbergiach`: `1173` read `1117`), and the metric layer then confirms the wrong scale or keeps it in a tie (report §AA–AD, `artifacts/analyzer-005d/holdout/`, `evidence/blind-*`). Both families join the development set (now fifteen rows); a further claim needs a new blind draw on a new frozen SHA.

The 005C analyzer recommendation below (the round-3 overall chain split by a spurious tick) is addressed in 005D — fixed in the metric layer, honestly unresolved downstream (`PLAN_RESOLUTION_INCONCLUSIVE`); see "Where dimension-chain integrity stands".

**Superseded (005C): return to the coordinator with the BUILDPLAN-ANALYZER-005C round-3 ARCHON defect as BUILDPLAN-ANALYZER-005D's input** — the overall-dimension chain on a dimensioned plan copy: a tick read where none is drawn splits it, the italic `1035` is read `1055` on the partial segment, and the wrong sheet scale (2.46 cm/px where both printed overall dimensions agree on 1.86) refuses the true vertical overall and lets interior chains frame the plan (`dom-w-azaliach`; report §Z). A fix is held to every development row (now thirteen, with `dom-w-azaliach` and `galaktykaI`) and a further claim needs a new blind draw on a new frozen SHA.

The 005B analyzer recommendation below (the walled outline on a side of openings) is done in 005C; see "Where the opening-aware envelope stands".

**Superseded (005B): return to the coordinator with the BUILDPLAN-ANALYZER-005B holdout defect as the next stage's input.**
- **The defect.** The plan's walled outline (envelope and bays) is taken from long wall bands, and a side of the
  building that is mostly openings (a garage door between piers, a glazed front) has none:
  - on `dom-w-modrzykach` the envelope stops at an interior wall (2.02 m of 11.60 m);
  - on `dom-w-zurawkach` the garage wing is never proposed as a bay;
  - on `willa-miranda` (development) the garage floods the same way, behind a partial wall witness that also lets
    an interior chain frame its depth.
  On both blind houses the metric layer 005B rebuilt is right: orientation, independent scale and printed extent.
- **How a fix is judged.** It is held to all ten development rows (005B's eight and the two round-2 families), with
  no regression; a further claim of generality needs a new blind draw on a new frozen SHA.

The 005A analyzer recommendation (upside-down overall labels, circular chain corrections, interior extents) is done
in 005B; see "Where metric truth stands".

**For the integration line: the OWNER's visual review of BUILDPLAN-INTEGRATION-004A on the phone** (`owner-preview-latest`, run 80 / `f6b8a92`, `versionCode 1080`, `0.80.0-preview`, arm64-v8a, SHA-256 `3390aafd…`; the checklist and questions in the 004A report), then a bounded fix of only what the phone and the answers show. Costs stay a named boundary, documents are not started, and nothing is merged to `main`, until the coordinator decides.

The 003C recommendation of the first session (finish the UI part once Impeccable is available) is done. The 003B recommendation below is superseded for the integration line.

**For the integration line: BUILDPLAN-INTEGRATION-003B — the owner's phone
check of the three presentation modes** (the 003A report's OWNER checklist),
then a bounded FIX of only what the phone shows. Build the APK from
`integration/unified-buildplan-presentation-v1` (Actions → BuildApp CI → Run
workflow on that branch → artifact `buildplan-model-preview-apks`).

**On the source branch: the BUILDAPP-03Y2G owner phone gate** (still open after 03G; the
`preview-latest` APK carries schema 1.6.0 and the same buildings).

1. Install `BuildPlan-Preview-arm64.apk` from the `preview-latest`
   prerelease.
2. Analyse the Rarytasy link with "Analyzer: Local".
3. Send back the hashes. If it fails, send the diagnostics bundle.
4. Re-run Marcówki (steps in the 03Y2G report).

If the phone confirms the missing-plans hypothesis, what the phone downloads
and a small-rendering plan reader come next, held to both houses' gates. If
the phone runs short of memory, the one lever is the callout reader's render
cache (`packages/source-metrics/src/callouts.ts`). Deploying the 03Y1 service
is not required.

**Deferred** until that gate closes, in the orchestrator's sequence:
**BUILDAPP-03Z — Interior Topology + Semantic Completion** — declared
interior junctions instead of partitions trimmed 15 mm short (the 35
INTERIOR gaps the closure audit reports), the stair against its walls and
its void (0.44 m³ shared with the ground ring wall today), guarding along
the stair and the void, and the finish regions the analyzer does not read
yet (the ground-storey side bands, the rear gable panel, the attic timber
panel). **BUILDAPP-04** comes after 03Z. The five 03X reader items (door symbols,
rooflight callouts, terrain datum and roof build-up from the section, room
numbers, elevation extents on more than one view) remain open and feed the
same ledger.

The earlier recommendation stands behind those, now largely built:

**BUILDAPP-04 — Camera-aware Source-View Verification + Semantic Repair Loop.**
The three things BUILDAPP-03 leaves on the table want the same tool. The roof
is one gable because nothing decomposed the massing into wings; 63 observed
openings are unexplained because nothing looked back at the drawing to ask what
they were; the facade members have no depth because no view was ever solved for
a camera. A verification pass that renders the candidate into a source view and
reasons about the DIFFERENCE — rather than measuring the agreement once, as the
current projection audit does — turns each of those from a hole into a repair.

Two things would make that loop's job materially easier and can be done
alongside it: a **live vision pass** (the provider path is complete and a key is
all it needs), and **multi-wing massing** in the solver, which is the single
largest source of the completeness gap above.

### Standing engineering items, unchanged by this stage

Owner visual review of the preview APK — committed at
`stage-reports/artifacts/android-preview/BuildPlan-Model-Preview-arm64-v8a-debug.apk`,
now the BUILDAPP-03M-FIX build — remains outstanding; because no GPU path can be
executed in the build environment, a further FIX stage should be assumed likely
rather than exceptional. That assumption has already paid once: BUILDAPP-03M-FIX
exists because the owner's review found the automatic candidate drawing nothing
but its roof.

Guarding: a balustrade that follows a stair's own path (rather than a straight
run) and an upstand along a slab hole's edge. The stair is a real staircase and
the void a real hole, but neither carries the guarding a built stair must have,
and the attic plan draws a line along the void's north and west edges. Both are
generic capabilities provable on a non-Marcówki building first. After that,
unchanged from BUILDAPP-00A: topology-aware plan editing (`moveJunction` /
`moveWallWithNeighbours`) and rooms derived from the resolved wall topology.
