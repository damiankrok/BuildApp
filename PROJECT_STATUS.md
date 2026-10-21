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
| STAGE BUILDPLAN-ANALYZER-005J — FLOORPLAN INTELLIGENCE TECHNOLOGY AUDIT + VISUAL REFEREE OPPORTUNITY MAP + TRAINING ROUTE | `analyzer/floorplan-intelligence-audit-v1` (from `analyzer/dimension-topology-boundary-bakeoff-v1` @ `64b78b4`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | research harness, artifacts and report: the commits after `64b78b4` on the branch (`git log analyzer/floorplan-intelligence-audit-v1 ^64b78b4`); BuildApp CI run 37514203211 on `d287aba` (the last content commit): 38 jobs pass, 2 skipped, **1 red** — the Android UI evidence gate (`VerticalSliceDeviceTest`), red on both attempts on a code path this stage did not touch | **PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005J_CI_UI_EVIDENCE_RED`) — research and audit only, **no production change** (§ "Where the floor-plan intelligence audit stands"). Small VLMs (Florence-2, SmolVLM2, Moondream) at or below chance on BuildPlan's closed questions; no commercially clean floor-plan model exists; a from-scratch BuildPlan-trained UNet-lite (6 MB) is a clean research proof. In an oracle replay of the frozen code, a deterministic drawn-gap upgrade completes `dom-w-gozdzikowcach`'s footprint exactly as a perfect witness does, and nothing moves a verdict. **PRIMARY_NEXT: NO_AI_YET** (005K: per-gap evidence records, a sealed fresh-sheet gap set, the deterministic upgrade measured on it). SECONDARY_LATER: TRAIN_BUILDPLAN_WALL_MODEL as the challenger. REJECT: small-VLM referee, every pretrained floor-plan model |
| STAGE BUILDPLAN-ANALYZER-005K — GAP EVIDENCE + SEALED FRESH-SHEET GAP SET + DETERMINISTIC DRAWN-GAP RULE | `analyzer/gap-evidence-drawn-gap-v1` (from `analyzer/floorplan-intelligence-audit-v1` @ `1314df7`; pushes also to `claude/new-session-3kzcgh`, except the seal-to-evaluation commits; Legacy untouched) | Phase 0 `b747440`; production `c244ff7` (rule OFF); freeze `892853e` (FREEZE_SHA); manifest seal `70aa0a4`; label seal `6672a89`; evaluation `591197d`; council fixes `44f7128`; closing: the commit that carries this row. CI: runs 37533180890 (`b747440`), 37539569712 (`892853e`) and 37546736072 (`2f57f90`, the last content commit) green, UI evidence gate included | **PASS** (`PASS_BUILDPLAN_ANALYZER_005K_GAP_EVIDENCE_READY_FOR_COORDINATOR`) — see § "Where the gap evidence stands (STAGE BUILDPLAN-ANALYZER-005K)". UI evidence harness fixed (test code only); per-gap evidence records (boundary evidence 1.2.0, Evidence Pack 1.2.0); a sealed fresh-sheet set of 60 gaps (14 projects, ARCHON + DobreDomy) labelled by blind AI sub-agents (not human); **DRAWN_GAP_RULE: INSUFFICIENT_EVIDENCE — stays OFF** (10 resolved negatives, none an open side; a known recess-mouth closure path). No production decision changed; no OWNER APK; blind round 9 NOT_RUN_BY_DESIGN. **NEXT: FIX_STOREY_COUNT** |
| STAGE BUILDPLAN-ANALYZER-005L — STOREY REGISTRATION + PER-STOREY FOOTPRINT STACKING + FRESH BLIND ROUND 9 | `analyzer/storey-registration-mass-stacking-v1` (from `a70047f`; pushes also to `claude/new-session-3kzcgh`, batched while a CI run was in flight; Legacy untouched) | production `e849cbc`…`cee78c8` (council-closed); freeze `8f5f3c5` (PRE_HOLDOUT_9_SHA, CI 37595482179 green); blind round `591e857`; closing: the commit that carries this row (final CI and OWNER APK: run 193 on `99b0eea`, green; OWNER APK versionCode 1193) | **PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005L_BLIND9_BODY_RELATION_FAIL`) — see § "Where storey registration stands (STAGE BUILDPLAN-ANALYZER-005L)". Storey registration and support are rebuilt on walled bodies and wall-on-wall correspondence, and per-storey footprints reach the emitted model. A06 and A07 FAIL → PASS (with żurawkach and tunbergiach), no PASS row turns FAIL, garage safety and non-circularity hold, M1–M10 are killed. Blind 9: #1 `dom-w-murajach` ALGORITHMIC_FAIL on a recessed-entrance / garage-door body relation upstream of the storey work (it failed at the 005K code too), #2 `dom-w-cieszyniankach` PASS. **NEXT: FIX_RECESSED_ENTRANCE_BODY_RELATION** |
| STAGE BUILDPLAN-ANALYZER-005M — VISUAL REFEREE V2: MULTISCALE SMALL-VLM BAKE-OFF + TEACHER/STUDENT DISTILLATION FEASIBILITY | `analyzer/visual-referee-v2-distillation-audit-v1` (from `analyzer/storey-registration-mass-stacking-v1` @ `47811e0`; mirrored to `claude/new-session-3kzcgh` at checkpoints, final HEAD on both; Legacy untouched) | research harness `research/analyzer-005m/`, artifacts `stage-reports/artifacts/analyzer-005m-vr2/` and the report: the commits after `47811e0` on the branch; final CI: run 37798078813 on `776295c`, success 30/30 | Research only, **no production change** (freeze IDENTICAL; no weight in Git history). Four small VLMs (Qwen3-VL-2B/4B, InternVL3.5-2B, SmolVLM2-2.2B) through llama.cpp on CPU in five input modes; phase 1 30 questions, phase 2 152 (best three). Best (point estimate): **Qwen3-VL-2B, mode D: CONFIDENT_WRONG_RATE 30.9 %** (= its error rate; real 23 %), never abstains; fails the counterfactual pairs, global and local alike (2/10 both right is chance level); beats a truth-blind prior on real questions, not a fitted class-aware one. Right on 29/30 real body-relation questions, a post-hoc lead only. Teacher Qwen3-VL-8B RUN (CPU, Q4_K_M): under constrained decoding one answer for both members of 20/21 counterfactual pairs. Student DEFERRED_ENV (CPU probe 31 s/step; vrgen2 2.1's abstention target is class-determined, so the dataset builder refuses it). Gemma 3n gated. **NEXT: RETURN_TO_DETERMINISTIC_BODY_RELATION** |
| STAGE BUILDPLAN-ANALYZER-005N — COMPOUND FACADE MOUTHS + RECESSED ENTRANCE / GARAGE BODY RELATION + FRESH BLIND ROUND 10 | `analyzer/compound-facade-atomic-intervals-v1` (from `analyzer/visual-referee-v2-distillation-audit-v1` @ `5957e3a`; every push also to `claude/new-session-3kzcgh`; Legacy untouched) | production `02af9cb`…`4e12ce5` (council rounds 1 and 2 closed); freeze `d787397` (PRE_HOLDOUT_10_SHA, CI 38297543325 green); blind round `f70700a`, `bfb9499`; closing: the commit that carries this row (final CI and OWNER APK: run 212 on `f091d15`, green; OWNER APK versionCode 1212) | **PARTIAL** (`PARTIAL_BUILDPLAN_ANALYZER_005N_BLIND10_METRIC_EXTENT_FAIL`) — see § "Where compound facades stand (STAGE BUILDPLAN-ANALYZER-005N)". Wide facade gaps are cut at source-supported separators (wall returns, facade piers) into atomic intervals, each decided on its own evidence; a recess keeps its mouth open and its back wall closes the building; a wall-joint extent keeps an attached garage. Gozdzikowcach's merged 7.76 m OPEN_SIDE is gone (first bad now MODEL_EMISSION); murajach was not this root (extent, then METRIC). No development verdict changes, M1–M14 killed, performance 0.97×/1.01×. Blind 10: #1 `dom-w-glogownikach` METRIC, #2 `dom-w-akebiach` EXTENT, both ALGORITHMIC_FAIL; TARGET_CLASS_EXERCISED NO. **NEXT: OTHER_MEASURED_RESIDUAL (scale from printed dimensions)** |
| STAGE BUILDPLAN-ANALYZER-005O — METRIC EVIDENCE RESCUE + TARGETED OPEN-SOURCE ALGORITHM BAKE-OFF | `analyzer/metric-evidence-oss-bakeoff-v1` (from `analyzer/compound-facade-atomic-intervals-v1` @ `b680cd4`; every push mirrored to `claude/new-session-3kzcgh`; Legacy untouched) | pre-registration `158f81c` (before any challenger), addendum `41d0a73`; results `0123ac2`; closing: the commit that carries this row (final CI in the report §P) | Research only, **no production change** (freeze IDENTICAL; no APK). See § "Where metric evidence stands (STAGE BUILDPLAN-ANALYZER-005O)". Glogownikach's first bad metric operation is plan resolution's as-printed view (wrong when stated on 55.5 % of 782 transcribed real labels) ignoring an ensemble that had read 541/870 (PP-OCRv6 corroborating: 0/507 disagree with the transcription of the same crop). M1 (abstain when the readers of one ink disagree, image-free) cuts stated-wrong as-printed values 372 → 122 and builds glogownikach at the correct scale (still FAIL on footprint −8.04 %); 0 known-good model change, 0 false-confident scale on 44 cases; jarzabem switches copy with changed open-side/terrace semantics (still FAIL). M2/M3 give kosacce-area-alone a refusal reason asserting a wrong scale (adverse); M2 no gain. Murajach: refusal correct (page vote ~58 % wrong; orientation + line extraction). Akebiach: NO_KERNEL_BOTTLENECK; PDF.js not on the failing path (DEFER). **NEXT: 005P — plan resolution reads statements through the existing ensemble (M1), own freeze + fresh blind** |
| STAGE BUILDPLAN-ANALYZER-005P — ARCHITECTURE-FIRST AUDIT + METRIC GUARD (PLAN RESOLVER 1.5.0) + FRESH BLIND ROUND 11 | `analyzer/metric-ensemble-as-printed-guarded-v1` (from `5906afa`; every push mirrored to `claude/new-session-3kzcgh`; Legacy untouched) | audit checkpoint `191b926` (before any production edit); pre-registration before any challenger, addendum A (N1a) `bc4f6c3` before any N1a run; freeze `PRE_HOLDOUT_11_SHA 6f4d7ca` (CI 38425412552 green, attempt 1); blind ledger `fc0f6a6`, sealed verdicts `adbeb1c`; closing: the commit that carries this row | **One production change**, `packages/reconstruction` only: plan resolver 1.5.0 (N1a — in the source-conflict test a contested statement's doubt never helps the accuser, and a reading the registration's own metric solution cites cannot vouch for it; withdrawals traced and left as an AMBIGUOUS gap). 44 rows: 2 decision paths change (glogownikach refused → completed at the correct 2.6234 cm/px, still ALGORITHMIC_FAIL −8.04 %; eoze share only), 0 known-good model change, 0 new trigger, 0 false-confident scale; P1/P2/P3 (005O M1 family) not admissible. 30/30 mutants, three review rounds (0 P0), perf within noise. Blind 11: miniaturka PASS, krasnokwiatach ALGORITHMIC_FAIL (TOPOLOGY_BOUNDARY at a correct scale, identical under 1.4.0); target class not exercised. See § "Where the metric guard stands (STAGE BUILDPLAN-ANALYZER-005P)". **PARTIAL.** NEXT: the walled envelope reconciled with a STRONG printed chain extent (`plan-decomposition`) |
| STAGE BUILDPLAN-ANALYZER-005Q — SOURCE-GROUNDED EXTERIOR BOUNDARY: AUDIT, BAKE-OFF, FAIL-CLOSED WALL STRIP (LAYOUT 1.2.0) + FRESH BLIND ROUND 12 | `analyzer/source-grounded-exterior-boundary-v1` (from `04d5568`; every push mirrored to `claude/new-session-3kzcgh`; Legacy untouched) | pre-registration `21c99bf` (before any challenger), addendum A `c56585b` (before N1a ran), B `3d4729d`, C `542b0f5` (before PROD3, the replay of record); freeze `PRE_HOLDOUT_12_SHA 7eddd7b` (CI 38514679088 green on attempt 2 after one re-run of the Android UI evidence gate's Compose race); blind ledger and sealed verdicts `a673849`; closing: the commit that carries this row | **One production change**, `packages/reconstruction` only: layout inference 1.2.0 (N1a, amended by two review rounds — narrowing and naming only). A strip of wall-thick ink between a body cut on an exterior wall's inner face and the plan's extent is named as an AMBIGUOUS outer-face gap and never read as a recess, return or terrace; the ring and MASS say SOURCE_DERIVED; a platform outlined beyond it is named, not built; nothing moves. 46 rows: only glogownikach changes (3 terraces and 2 recess returns gone, exact inner-face ring → SOURCE_DERIVED, two faces named; still ALGORITHMIC_FAIL −8.04 %); 0 known-good change. C1 (outer-face line) safe on area but re-binds openings without evidence; C2 fabricates (akebiach courtyard, A05, jarzabem). Krasnokwiaty unchanged (PIER family). Tests 122 synthetic + G10 at unit level; 38/40 mutants; reviews 0 P0; perf ratio max 1.04. Blind 12: tymianku PASS, daliach PASS (= OLD), target class not exercised; daliach shows the PIER family (terraces over a garage floor). See § "Where the exterior boundary stands (STAGE BUILDPLAN-ANALYZER-005Q)". **PARTIAL.** NEXT: a face-correction stage (C1 idea + evidence-only opening re-binding + per-stretch faces) |
| STAGE BUILDPLAN-ANALYZER-005Q-OCR — FULL-PLAN TEXT DETECTION (PaddleOCR) + DIMENSION BINDING, RESEARCH (LEAN) | `analyzer/paddleocr-full-plan-binding-research-v1` (from `0aaa31f`; every push mirrored to `claude/new-session-3kzcgh`; Legacy untouched) | pre-registration `1343c6b` (before any score), addendum A `38664f3` (before the first score), scores + addendum B `6d9bb9a`, addendum C (two focused reviews) and closing: the commits after it | **Research only, production freeze IDENTICAL.** 9 sheets / 7 families, local truth only (no image to any remote model). Independent PP-OCRv6 tiny detector on the full page (B1), read by the deployed recogniser, vs the incumbent crop-first path (B0): on the contender-independent truth tier B0 detects 45/51, B1 46/51; on 110 primary labels B1 adds 1 new correct value; only 4 labels are never proposed. The loss is downstream: 33 read-right-not-bound, 26 statement values rewritten (23 CHAIN_CORRECTED, 5 against a correct token: 1385→1382, 1020→1010 …), 6 not kept by the ensemble; 49/67 registration anchors are CHAIN_CORRECTED. Blind geometric binding (B2) 17/1 vs B0 13/2/4 on 19 binding-truth labels (none on Muraje); no false-confident scale. NO_GAIN for discovery. See § "Where full-plan OCR and binding stand (STAGE BUILDPLAN-ANALYZER-005Q-OCR)". **PASS_RESEARCH.** NEXT (for OWNER authorisation): a narrow integration experiment at the chain/decision boundary; 005R unchanged, pending |
| STAGE BUILDPLAN-ANALYZER-005Q-CHAIN — EVIDENCE INTEGRATION: INK → DIMENSION LINE → CHAIN → SCALE → 3D, RESEARCH | `analyzer/ink-first-chain-binding-integration-research-v1` (from `cd0c513`; every push mirrored to `claude/new-session-3kzcgh`; Legacy untouched) | causal map `66a22ce` (before any challenger), pre-registration `30f8a04`, addendum A `a59330e` (before challengers), B `19c4bc4` (after C1's first score, disclosed), C `a329a39` (after three reviews); closing: the commits after it | **Research only, production freeze IDENTICAL.** First bad decision is in the chain, not OCR: substitutions vote the legacy scale, the scale picks a reading inside a span with no substitution penalty, CHAIN_CORRECTED values anchor the registration of the scale that chose them (627 anchors at the base), and a correct ink never re-enters the chain (`sameEntries`/`rereadable`: 25 read-right-bound-but-unstated labels). Six challengers on the same 48 development rows with full extract→solve replays: C1 ink-first, C2 geometric span, C3 no scale-routed orientation, N1 re-read gate (own algorithm), C4, C1N1. None adoption-eligible: every one fails G1 with material known-good changes (C3 2 … C4 14), G2 and G3. C1: verified-binding correct labels 5 → 10 (41 incl. unverified, 12 on implausible spans), PASS 21 → 17, new false-confident results (kosacce +11.2 %, S1 registration +78 %), one ink stated on two spans. N1: verified 5 → 15, PASS 21, but marcowki loses a balcony, jarzabem its porch, S4 Y +5 %. Reviews: 2 P0 + 6 P1 (scorer/gate) fixed with 11 negative tests; mutations 8/8 killed; S1/S2 hold. See § "Where evidence integration stands (STAGE BUILDPLAN-ANALYZER-005Q-CHAIN)". **PASS_RESEARCH, NONE.** NEXT (for OWNER authorisation): span from geometry → ink value once → anchor, never the reverse; 005R unchanged, pending |
| STAGE BUILDPLAN-ANALYZER-005R — VISUAL ASSET ROUTER + EXTERIOR OBSERVATIONS AS RESEARCH JSON, RESEARCH | `analyzer/visual-asset-exterior-json-research-v1` (from `39061db`; every push mirrored to `claude/new-session-3kzcgh`; Legacy untouched) | pipeline audit `c1ab121` (before any experiment), pre-registration `bdd50b8` (before truth and any contender run), addendum A `cfe95ab` (before any V2 output was read), B `da66e48`, C (after three reviews; closing commits after it) | **Research only, production freeze IDENTICAL.** First bad operation located: `archon.ts:98` maps every "wizualizacja" to PERSPECTIVE_RENDER (no interior class) and `analyze.ts:164` feeds them to the facade extractors — all 107 EVAL interior lineage groups reach them. Corpus: 50 ARCHON editions, 1 352 assets, 761 lineage groups, DEV 20 / EVAL 14 families; DobreDomy, Archipelag, Domy w Stylu SOURCE_NOT_USABLE (terms); truth = publisher page structure, HUMAN_LABELS_NOT_RUN. Contenders V0a (production), V0b, V1 (Node CV + CART), V2 (OWL-ViT B/32, local), N1 (own fusion); V3 NOT_RUN_PREVIOUS_005M_SAFETY. Preregistered truth: 0/20 EVAL exterior renders correct for every contender. After the two truth defects reviewer B found (post-hoc): V1 46/46 but family-bootstrap risk bound 6.15 % > 5 %, and its routing flips under letterboxing (97.7 %) — a format shortcut. V2: routing degenerate, detector finds 0 pergolas/carports/canopies/terraces/steps/posts on synthetic truth, 253 windows on real interiors. Research JSON contract (closed schema, 24 of 25 red-team bypasses as tests and the 25th in the assembler, 13/13 mutations) holds; hard gates 0 — by abstention. See § "Where the visual asset study stands (STAGE BUILDPLAN-ANALYZER-005R)". **PARTIAL_RESEARCH, NO_SAFE_VISUAL_CANDIDATE.** 005S not started |
| STAGE BUILDPLAN-ANALYZER-005R-ROUTER — SOURCE-ROLE GUARD: WHY INTERIORS REACH THE FACADE EXTRACTORS, RESEARCH | `analyzer/visual-source-role-guard-v1` (from `8d41456`; Legacy untouched) | freeze start `67d2cf8`; audit + pre-registration `014781c`; addendum A `0992344` (both before any candidate ran); closing: the commits after it | **Research only, production freeze IDENTICAL, PRODUCTION_CHANGE NONE.** First unsafe *deterministic* evidence assertion: `analyze.ts:164-166` routes every PERSPECTIVE_RENDER frame (interiors among them) into the orthographic facade extractors, while every consumer of their output (metrics, cross-view identity, registration) reads orthographic frames only; the ledger then claims a depth-order check no code performs (`reconstruct-v2.ts:1177`). The role `archon.ts:98` is correct but scene-less; carousel position is never read. R1 (typed page witnesses): 0 assets with two independent scene witnesses, so a scene gate (R2) gates nothing; HUMAN truth NOT_RUN (a local 300-item spot review is prepared, optional). Own N1 (projection gate, no scene classification) on 37 ARCHON DEV rows (DobreDomy refused): 23 models byte-identical + 14 identical typed refusals, orthographic evidence and metric content identical, 18/18 ledger rows only lose perspective evidence (67 cameras identical), deterministic under shuffle, 6/6 mutants killed — but P4, P5 and P7 fail **as preregistered** (the extractor's own recess gaps were not enumerated; a wall-clock field the incumbent also fails), so the preregistered rule gives NO_SAFE_ADOPTION; post-hoc corrections do not change it. No blind (no behaviour change), ARM64 PENDING. See § "Where the source-role guard stands (STAGE BUILDPLAN-ANALYZER-005R-ROUTER)". **NO_SAFE_ADOPTION.** NEXT (for coordinator approval): 005R-ROUTER-N1-ADOPT with predicates fixed before the run and a fresh blind 13; 005R-EXTERIOR and 005S not started |
| STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR — SOURCE-LINKED EXTERIOR EVIDENCE JSON (TRUTH LEDGER, B0/B1), RESEARCH | `analyzer/exterior-scene-feature-evidence-v1` (from `bfaf286`; mirror untouched; Legacy untouched) | one commit (the one carrying `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_TRUTH_JSON.md` and this row); preregistration sealed mechanically by script hashes, addenda A–E | **Research only, FREEZE IDENTICAL, PRODUCTION_CHANGE NONE, HUMAN_TRUTH NOT_RUN.** 12 families / 14 editions (OWNER's `m3ea…` kept apart from Rarytasy 5 (G2E) `m84f…`) / 36 lineage groups / 76 assets + 159 extended interior negatives, all already local, no network, no image shown to any model. B1 (page structure + caption class + product claims + plan schedule + sealed N1v technical features, no pixels, no weights) passes G1–G7 (G5 failed once on anchor order, fixed in addendum B; the F3 laundering residual fixed in addendum C): 0 interiors promoted (12 + 113), 0 metric authority from 47 perspective proposals. B1's preregistered 15 'corroborations' (GARAGE 9, TERRACE 6) shrink to 2 (TERRACE) under the post-audit strict recount: the garage evidence is publisher spec-sheet consistency (9 yes / 5 no), not an orthographic reading; UNKNOWN_ASSEMBLY 10 technical-only. Independent audit: no P0; the validator accepted 10/14 forgeries, fixed (14/14 refused). Not supported: pergola, carport, canopy, columns, balcony, loggia, railing (claims or nothing); frame-level visibility 0/19 resolved. See § "Where exterior evidence stands (STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR)". **PARTIAL_RESEARCH_INSUFFICIENT_TRUTH.** NEXT (for coordinator approval, not authorized here): an independent-evidence stage — local OWNER spot review of feature visibility; 005S not started |
| STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR-OWNER-TRUTH-PACK — LOCAL OWNER REVIEW PACK, RESEARCH TOOLING | `analyzer/exterior-owner-truth-review-pack-v1` (from `47bafa6`; mirror untouched at `bfaf286`; Legacy untouched) | one commit (the one carrying `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_OWNER_TRUTH_PACK.md` and this row); preregistration written before any code, addendum A before the page logic | **Research tooling only, FREEZE IDENTICAL, PRODUCTION_CHANGE NONE, HUMAN_TRUTH NOT_RUN.** An offline review page (`research/analyzer-005r-exterior-owner-review/review.html`, closed CSP, local files hashed by SHA-256, blob: display only) over a deterministic, source-free queue of 60 questions (34 priority on 9 images) on 35 images / 35 lineage groups / 14 editions: all 19 abstained B1 feature-visibility questions, look-alike partners not taken from publisher claims, scene questions for B1-abstained renders, interiors and the two structure-conflict controls, one feature per elevation. OWNER `m3ea…` accepts only its own bytes (never Rarytasy 5 G2E `m84f…`); byte-shared groups get one non-propagated question. Blind phase → seal (SHA-256) → technical cross-check that never overwrites the blind answer (conflicts kept) → deterministic JSON/CSV export with a validating import (the seal is a consistency check, not a signature; one independent audit: one P0 — tier leaked claims — fixed by per-image tiers). No publisher pixel is in the repository or was viewed by any model; the OWNER saves images from the 14 public project pages (HEAD-only check: 9/9 priority images still linked, same address and length; bytes verified only by the page's own hash). Tests: pack 8/8, core 12/12, Chromium smoke with synthetic images OK (0 external requests), isolation 71/71. Class accuracy NOT_MEASURED. See § "Where the OWNER truth pack stands". **READY_FOR_OWNER_LOCAL_REVIEW.** NEXT (for coordinator decision): OWNER runs the 34-question priority batch; any evaluation is a separate preregistered stage; 005S not started |
| STAGE BUILDPLAN-ANALYZER-005S-N1-TECHNICAL-OPENINGS — SOURCE-GROUNDED OPENING BINDING, ONE BOUNDED STAGE | `analyzer/005s-technical-openings-n1` (from `7ceb4b0`; mirror untouched at `bfaf286`) | one commit (the one carrying `stage-reports/STAGE_BUILDPLAN_ANALYZER_005S_N1_TECHNICAL_OPENINGS.md` and this row) | **ZERO production edits.** Openings already take position and width from plan gaps + printed callouts; registered (rendered) elevations only give sill/head through a contrast-band reader that hits 31/72 plan gaps and 5/36 blank wall spans on 21 registered views in 11 rows, with no view showing a mis-bound facade beyond noise; 11/23 built rows have no registrable elevation (checked case: wall-band-only extents, refusal correct); one emission refusal (rarytasy-g2e OPENINGS_OVERLAP) is not elevation-bound and undecidable without the drawing. OWNER export intake: 60/60 manual-fallback, 0 byte-verified, 29 ambiguous negatives — summary only, never geometry truth. Solver-only replay harness added under `research/analyzer-005s-openings/` (reproduces sealed N1 models byte for byte). **NO_SAFE_TECHNICAL_OPENING_CANDIDATE.** NEXT (coordinator decision): a technical line-elevation/section source, or eave-datum registration for the 11 rows without elevations |
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

## Where the visual asset study stands (STAGE BUILDPLAN-ANALYZER-005R)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_VISUAL_ASSET_EXTERIOR_JSON.md`. Evidence: `stage-reports/artifacts/analyzer-005r/`
(recommendation: `recommendation.md`). Harness: `research/analyzer-005r/` (never imported by production; publisher pixels, pages, captions
and weights stay outside Git and never reached a remote model; isolation block in `tests/architecture/research-isolation.test.ts`).

- **Audit (before experiments).** Production roles are text/channel claims only; `DocumentRole` has no interior, photo or other class.
  `archon.ts:98` turns "wizualizacja" into PERSPECTIVE_RENDER and `analyze.ts:164` runs those frames through the elevation extractors.
  Of the 14 exterior kinds, production builds only a balcony/railing fragment and plan openings from images. Publisher description text (e.g. about a pergola over the
  terrace) is never read. Measured through the carousel's original↔thumbnail anchors, the incumbent gives PERSPECTIVE_RENDER
  to 204 interiors (97 DEV, 107 EVAL; 134 of them only through the anchors) and 39 exterior renders alike.
- **Sources.** ARCHON is usable for local research. DobreDomy (terms §7.2), Archipelag and Domy w Stylu are SOURCE_NOT_USABLE (consent
  needed), and no DobreDomy image was fetched. Earlier stages processed DobreDomy, which leaves an open question for OWNER.
- **Roles (EVAL, lineage groups).** Under the preregistered truth, V1 has 90.5 % coverage and 1.9 % risk, but 0/20 exterior renders
  correct, as does every other contender. Correcting the truth (15 styling views in the interiors carousel, 150 `widok-N` page copies;
  post-hoc) gives V1 46/46 exterior renders, but its risk bound of 6.15 % fails §8 (≤ 5 %). Letterboxing flips 97.7 % of that model's
  outputs, including every exterior route, so V1 reads format, not content. V2's routing is degenerate (everything INTERIOR up to τ 0.85
  on DEV). N1 was falsified by its own preregistered test.
- **Exterior features.** On synthetic truth with ideal routing, V2 finds windows and doors only; it finds 0 of the target assemblies
  except 11/40 balconies and 2/51 railings. On real interiors it puts 253 windows and 153 "exterior doors". No real-image feature truth
  exists, so the real-image feature question is NOT_MEASURED.
- **Edition identity.** 64 byte-identical assets are shared across editions (interiors and untyped images only), and 13 near-duplicate
  exterior/elevation groups span editions. The "rarytasy-g2e" development row is Dom w rarytasach 5 (G2E), not OWNER's anchor.
- **Contract and gates.** `research.visual-observations.0.1` / `visual-edition-summary.0.1` have a closed schema. Of reviewer A's 25
  bypass documents, 24 are unit tests and the 25th is checked by the assembler (DANGLING_SUPPORT, M13). 13/13 mutations are killed. 6 100 documents validate with 0 violations, and all hard gates are 0 —
  by abstention. V2 is deterministic (1 537/1 537 identical rows across two runs); V1 features are identical on Node 22 ×2 and 18.20.4.
- **Reviews.** Three reviews, each P0/P1 re-run by two skeptics: 0 P0. The confirmed P1s were the validator bypasses, two truth defects,
  an interior control that could not fire, and V0a byte-only matching. All were fixed or measured as sensitivity in addendum C, and the
  recommendation still follows from §8 on the preregistered truth (V1: 0 of 20 exterior renders correct, EXTERIOR_RENDER
  coverage 10 %, risk upper bound 5.43 %). The post-hoc sensitivity does not rescue V1: under C12 its risk upper bound is
  6.15 % and its exterior routes come from the format shortcut (A1).
- **Recommendation: NO_SAFE_VISUAL_CANDIDATE** (ARCHON only). OWL-ViT B/32 is LICENSE_BLOCKED for the product: its card says
  "research output", and its data licences are not stated. The strongest router signal is the publisher's page structure, which the
  adapter ignores; using it is a production stage that needs OWNER authorisation. 005S has not been started; ARM64 is pending.

## Where evidence integration stands (STAGE BUILDPLAN-ANALYZER-005Q-CHAIN)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005Q_CHAIN_EVIDENCE_INTEGRATION.md`. Evidence: `stage-reports/artifacts/analyzer-005q-chain/`.
Harness: `research/analyzer-005q-chain/` (challengers are patches applied to a copy outside the repository; never imported by production;
isolation block in `tests/architecture/research-isolation.test.ts`, which also runs the post-review negative tests).

- **Causal audit (before any challenger).** The printed number is lost in the chain: substitution readings vote the legacy scale
  (`chains.ts:259-288`; Murajach 1020→1010 seeded the scale it later "confirms"), the scale picks a reading inside a span with no substitution
  penalty (`chains.ts:681-682`; Goździkowce 1385→1382), CHAIN_CORRECTED values anchor the registration of that scale (`extract.ts:997`; 570
  anchors on the 45 extract rows), and correct ink is gated out of the re-solve (`metric-solution.ts:1231`, `:1303`; 25 labels bound but
  unstated). CC/DERIVED values become SOURCE_EXACT geometry without an origin check (`layout.ts:1139`, `emit.ts:193`). OCR is the first bad
  link for 3 of 110 primary labels.
- **Challengers (48 development rows, full extract→solve replays, same evidence and truth).** C1 ink-first statement + READ-only anchors;
  C2 geometric span (production's own centring constants); C3 no OTHER_AXIS_SCALE/joinedCm orientation; N1 lattice re-solve not skipped
  (own algorithm, after D7 was shown); C4 = C1+C2+C3; C1N1.
- **Result: no safe adoption.** All six fail G1 (material known-good changes: C3 2, N1 5, C1 11, C1N1 11, C2 12, C4 14), G2 and G3.
  Ink-first raises value-correct labels but mostly on unverified, scale-chosen spans (C1: verified 5 → 10, 12 of 41 on implausible spans,
  spurious certainty with span audit 4 → 16), turns kosacce PASS into +11.2 %, moves S1's registration +78 % and rarytasy-g2e's X +45 %
  with an unchanged footprint, and states one ink on two spans. N1 doubles verified correct bindings at 21 PASS but removes marcowki's
  balcony and jarzabem's porch and gives S4 a +5 % Y scale on one correction.
- **Facts learned for the harness.** The published footprint is an input of the production solver in every variant (layout gate > 20 %
  refuses; plan resolution ranks by it), so "agrees with the published area" is not an independent witness; the footprint is a weak guard of
  the scale (registrations move +45 … +182 % at an unchanged area).
- **Reviews.** Three reviews, each P0/P1 re-run by two skeptics: 2 P0 (G2c X-only; unverified bindings counted correct) and 6 P1 (G2d per
  row, questionable binding truth, C4's S1 attribution, one ink on two spans, abstention never counted, published footprint in the solver)
  fixed in the scorers and gates (addendum C) with 11 negative tests; no verdict changed. Mutations 8/8 killed; S1 and S2 hold.
- **Recommendation: NONE.** Next, for OWNER authorisation only: let the ink replace a correction only on a span the label measures
  geometrically, once, and only then let it anchor; account for every known-good model change against the drawing. 005R (visual pilot)
  unchanged and pending; 005S future; ARM64 for 005H pending.

## Where full-plan OCR and binding stand (STAGE BUILDPLAN-ANALYZER-005Q-OCR)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005Q_OCR_FULL_PLAN_BINDING.md`. Evidence: `stage-reports/artifacts/analyzer-005q-ocr/`.
Harness: `research/analyzer-005q-ocr/` (never imported by production; isolation block in `tests/architecture/research-isolation.test.ts`).

- **What was measured.** On 9 floor-plan sheets (7 families; failure anchors glogownikach, murajach ×2 copies, gozdzikowcach; controls
  marcowki (smoke), kosacce-clean, zurawkach, A06, D02), a pinned PP-OCRv6 tiny DB detector (Apache-2.0, 1.78 MB) on the full-resolution
  page in overlapping tiles, read by the SAME deployed PP-OCRv6 tiny recogniser, against the sealed incumbent (classic tokens → lattice →
  crop recogniser). Truth is local only: 005O prior transcriptions, PP-OCRv6 medium + Tesseract agreement, and a correlated sensitivity tier.
- **Discovery is not the bottleneck.** Contender-independent truth: B0 45/51, B1 46/51. Primary: B1 +1 new correct value of 110; 4 labels
  never proposed. Murajach's 256 / 209 / 95 stay unmeasured (no proposer, no extracted line).
- **The loss is after reading.** 33 read right but not bound; 26 statement values ≠ ink (23 CHAIN_CORRECTED, 5 against a correct token);
  6 not kept by the ensemble; 49 of 67 registration anchors are CHAIN_CORRECTED (100 % on murajach and gozdzikowcach).
- **Binding.** Blind geometric assignment 17 right / 1 wrong vs the incumbent 13 / 2 / 4 unbound on 19 binding-truth labels (controls and
  S1/S4 only). No false-confident scale.
- **Cost (x86, WASM, estimated for Android only).** Detector ~1.8 s per 853 px sheet; reading every box both ways 10–31 s per sheet.
- **Not run:** human spot review (request list committed), solver replay (stop rule: no added evidence), device test.
- **Recommendation:** do not ship a full-page detector; a separate, narrow integration experiment at the chain/decision boundary
  (ink-first statement values, CHAIN_CORRECTED never an anchor, blind binding with UNRESOLVED), for OWNER authorisation.
  005R (visual pilot) unchanged and pending; 005S future.

## Where the exterior boundary stands (STAGE BUILDPLAN-ANALYZER-005Q)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005Q_SOURCE_GROUNDED_EXTERIOR_BOUNDARY.md`. Evidence: `stage-reports/artifacts/analyzer-005q/`.
Production changed only in `packages/reconstruction` (layout inference 1.1.0 → 1.2.0); `apps/`, `.github/`, lockfile, schema packages and the embedded OCR assets are byte-identical to `04d5568`.

| field | state (measured) |
| --- | --- |
| FIRST BAD (glogownikach) | FACE family at a correct scale and extent: the band claim breaks an exact tie toward the inner face (S) and a CHAIN_CORRECTED solver tick wins the E band; thinning and the snap cut the body on both inner faces (−8.04 %); the strips became zones → recesses → 3 PAVED terraces of mostly wall poché; `emit.ts` labelled the ring SOURCE_EXACT. 005P's "minCellM 0.44" falsifier refuted (emission refuses a wall-thick cell row) |
| FIRST BAD (krasnokwiatach) | PIER + stepped plan: no long band on either stepped facade (window / garage door between piers), outline leaks through POST-read piers; extent and scale right; published area includes roofed open areas, so a correct walled model cannot reach ±6 % while a false scale can |
| LAYOUT 1.2.0 | `wallStripsOf`: wall-thick (≥ 0.7 wall), long (≥ 2.5 walls) bands filling the strip between envelope and extent over ≥ 25 % of a side → AMBIGUOUS gap "the outer face of the building's <side> wall"; bodies on the covered stretch lose MEASURED on that axis; v2 reads no recess/return/terrace there; ring and MASS SOURCE_DERIVED; a platform beyond is named, not built. The strip stays a ZONE (the world frame never moves) |
| 46 ROWS | 1 row changes (glogownikach: 0 terraces, 0 returns, 2 named faces, SOURCE_DERIVED; −8.04 % unchanged); 0 known-good change; PROD3 = N1a except gap text; deterministic; G10 holds at unit level (end to end, orientation decides through the base's band-claim tie whether a strip exists at all) |
| NOT ADOPTED | C1 (−5.86 % on glogownikach, −12.23 % on helikoniach, but openings re-bound without evidence); C2 (fabricates elsewhere); N1 (moved the frame); N2 (changes 3 known-good rows: OWNER decision) |
| LIMITS | glogownikach still ALGORITHMIC_FAIL; its real niche floor and garage pier, which the base read as parts of a false recess, are now neither built nor named; sliver terraces on known-good rows, `emit.ts`'s global SOURCE_EXACT, PIER family and the terrace-extension emission failure on mirrored outlined platforms recorded, not repaired |
| BLIND 12 | `dom-w-tymianku` PASS (−5.48 %), `dom-w-daliach` PASS (+0.39 %); OLD = NEW byte-identical; TARGET_CLASS_EXERCISED = NO; daliach: two PAVED terraces over a garage floor and a planting strip (PIER family, identical in OLD) |
| ARM64 DEVICE PARITY | still PENDING (005H); `owner-preview-latest` not overwritten; no APK published |

**Stage: PARTIAL (`PARTIAL_BUILDPLAN_ANALYZER_005Q_FAIL_CLOSED_ONLY_TARGET_NOT_EXERCISED`).**

## Where the metric guard stands (STAGE BUILDPLAN-ANALYZER-005P)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005P_ARCHITECTURE_FIRST_METRIC_GUARD.md`. Evidence: `stage-reports/artifacts/analyzer-005p/`.
Production changed only in `packages/reconstruction` (plan resolver 1.4.0 → 1.5.0); `apps/`, `.github/`, lockfile and the embedded OCR assets are byte-identical to `5906afa`.

| field | state (measured) |
| --- | --- |
| ARCHITECTURE | 11 subsystems mapped; one recurring defect: a single reader's observation passed on as the decision. ADR: no new subsystem, a typed contest record + an explicit consumer policy at one seam (`architecture/`) |
| FIRST BAD (44 rows) | 18 NONE_PASS, 10 TOPOLOGY_BOUNDARY, 7 INSUFFICIENT_SOURCE, 4 BINDING_OR_CHAIN, 5 single others; only glogownikach's refusal is carried by the as-printed view, and its first bad decision is a grid face/snap (−8.04 %) |
| PLAN RESOLVER 1.5.0 | `statement-contest.ts`: per statement, what its confident readers (AS_PRINTED, LATTICE CLEAR/SUPPORTED, corroborating EXTERNAL) read. Source conflict only: a contested statement refutes the registration only if no reading fits, spares a rival or joins OUTER_TOTALS only if every reading fits, defends if one fits; readings the frame's solution cites are set aside (N1a). Ranking, lattice scales, isotropy, re-reads and T2 read as 1.4.0. Triggers ⊆ 1.4.0's (proved, frozen 1.4.0 oracle, 96 000 + 20 000 random plans). A withdrawal is traced (`SOURCE_CONFLICT_REVIEW`: doubted, cited) and leaves an AMBIGUOUS gap |
| 44 ROWS | completed 22 → 23, PASS 18 → 18; glogownikach completes at 2.6234 (truth 2.6286) but its model is wrong (−8.04 %, three artifact terraces, an inner-face ring labelled SOURCE_EXACT) where 1.4.0 refused; eoze same path, share 0.3708 → 0.3348; strip-external = 1.4.0 |
| LIMITS | correlated-reader risk (glogownikach's remaining defence is the same recogniser the solution leans on; corroborating PP-OCRv6 wrong 0/459, ≤ 0.65 % per statement); clause 2 rival-side withdrawals (synthetic only) |
| BLIND 11 | `dom-miniaturka` PASS; `dom-w-krasnokwiatach` ALGORITHMIC_FAIL — the walled envelope took the middle 780 cm strip of a 430 + 780 + 400 plan at a correct scale (TOPOLOGY_BOUNDARY); both identical under 1.4.0; TARGET_CLASS_EXERCISED = NO |
| ARM64 DEVICE PARITY | still PENDING (005H); `owner-preview-latest` not overwritten |

**Stage: PARTIAL (`PARTIAL_BUILDPLAN_ANALYZER_005P_BLIND11_TOPOLOGY_FAIL_TARGET_NOT_EXERCISED`).**

## Where metric evidence stands (STAGE BUILDPLAN-ANALYZER-005O)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005O_METRIC_EVIDENCE_OSS_BAKEOFF.md`. Evidence: `stage-reports/artifacts/analyzer-005o/`.
Research only: production, lockfile, `.github/` and the embedded OCR assets are byte-identical to `b680cd4`.

| field | state (measured) |
| --- | --- |
| AS-PRINTED SOURCE | plan resolution (`statementsOn` / `asRead`) reads the classic template token text; nothing in `packages/reconstruction` reads the lattice or the PP-OCRv6 ensemble |
| READERS ON 782 TRANSCRIBED REAL LABELS (38 families; truth = blind double transcription of the crop) | frozen as-printed value wrong when stated 55.5 % (59.3 % de-duplicated); literal classic token text 69.1 %; lattice CLEAR/SUPPORTED 26.1 %; PP-OCRv6 top 4.9 %; PP-OCRv6 corroborating 0/507; TOP-K recall at the first lattice/ensemble 83.6 %; ≈ 23 % of statements on frames with a known scale are bound to a span their true value does not fit |
| GLOGOWNIKACH | first bad (d): the as-printed view ignores the ensemble (541 CONTESTS, 870 LEADS, both p ≥ 0.9995, stable). Under M1 it builds at 2.6234 cm/px (truth 2.6286); still ALGORITHMIC_FAIL (footprint −8.04 %) |
| MURAJACH | refusal correct (page vote 2.451 vs ≈ 1.554 true). First bad: line extraction (logo-split 1020, wall-crossing ticks) and the v49 orientation (legacy fallback against a 740 at p 0.99991). 79 chains = 11 meaningful lines, 15 printed dimensions. No M-variant can reach it (metric layer); M4-diag (orientation by the reader's posterior, decision level): 171 right / 0 wrong where truth knows |
| AKEBIACH | EXTENT, `NO_KERNEL_BOTTLENECK`: piers dark in the ink but missing from the band set; noding needs a 34 px (rectangles) / 41.8 px (axes) snap, every tolerance in use ≤ 24 px, and the pergola false closure is at 47 / 54.7 px; the door is a semantic decision on which the incumbent's two classifiers disagree |
| BAKE-OFF (44 cases) | M1/M3/M1P/M1b/M3b: 23 completed, 18 PASS, 0 false-confident, 0 known-good model change (glogownikach, jarzabem changed; decision path changes on rarytasy-eoze, milorzebem, akebiach). M2/M3/M3b: an adverse refusal reason on kosacce-area-alone (prefers 1.449 vs truth 2.406). M2: no model change. Label level: stated-wrong 372 → M1 122, M3 108, M2 332 |
| OSS | JSTS/Clipper2/polygon-clipping not run (no bottleneck); PDF.js not on the failing path, DEFER (7/44 packages record 1:500 outline PDFs/DWGs, none of the three failing ARCHON houses); ELSED not reopened; PP-OCRv6 re-read tested (no gain over M1; Node 18 bit-identical) |
| ARM64 DEVICE PARITY | still PENDING (005H) |

**Stage: research PASS (see the report's final token).**

## Where compound facades stand (STAGE BUILDPLAN-ANALYZER-005N)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005N_COMPOUND_FACADE_BODY_RELATION.md`. Evidence: `stage-reports/artifacts/analyzer-005n/`.

| field | state |
| --- | --- |
| BASELINE FACADE TOPOLOGY | measured before any edit (`baseline-compound-facades.json`, `root-classification.md`): gozdzikowcach `COMPOUND_GAP_NOT_SEGMENTED` (recess mouth + return + garage door read as one 7.76 m gap); murajach `EXTENT_EXCLUDES_ATTACHED_BODY` (its "6.45 m mouth" is an interior line) |
| COMPOUND SPANS | a wide gap on an envelope side is read from the boundary's wall-solid layer (`compound-facade.ts` 1.0.0); every gap read is recorded, cut or left whole; none on unscaled plans |
| SEPARATORS | WALL_RETURN (≥ max(0.9 m, 3 walls) of wall inward) or FACADE_PIER (a stretch of a wall body); posts, short marks and thin lines never; more than 8 candidates → left whole |
| ATOMIC INTERVALS | each decided on its own infill (not dashed, not a pattern, stopping at ink jambs), callout (never across a separator; closes only walled deeper than a recess with nothing drawn across), signature and pocket (own width; siblings sharing a space weighed jointly; order-invariant) |
| RECESS SEMANTICS | mouth open, back wall (≤ 4.5 m; between bare returns only glazing where both returns end) added as a grid line and shut; cells RECESS, never BUILT |
| GARAGE RELATION | closed by its own drawn door or its own callout; a blank garage is not fabricated; the wall-joint extent keeps an attached garage (one hop, a detached one never) |
| OPEN-SIDE SAFETY | carport, loggia, porch on posts, covered terrace, passage, corner recess, missing return: open in five orientations |
| MURAJACH | not this root. The extent fix puts its garage in the plan; the row still fails, now on METRIC (2.451 cm/px registration, 5 labels on 79 dimension lines), same refusal code |
| GOZDZIKOWCACH | merged OPEN_SIDE gone: return separator, recess (1.22 m back wall, line added), garage built; first bad moves to MODEL_EMISSION (chimney 0 m, no main roof), independent |
| JARZABEM | different topology (single mouth, step-line infill), unchanged, not tuned |
| CYKLAMENACH CONTROL | unchanged |
| 005L STOREY REGRESSION | none (every storey row's model identical); two-storey end-to-end fixture with a compound ground front |
| DRAWN GAP RULE OFF | yes (gate + M8) |
| NON-CIRCULARITY | gates (imports, vocabulary, house names, frozen numbers) and the executed decoy; M4, M10 killed |
| ORDER INVARIANCE | shuffles + five orientations green; span rows replayed twice byte-identical |
| PERFORMANCE | median read 0.97×, layout 1.01× (interleaved, 42 rows); reader ≤ 6.9 ms per row |
| COUNCIL | 5 reviewers + verification (9 P0/P1 confirmed and fixed) and a second round on the fixes (1 P0 + 3 P1 confirmed and fixed); `post-review/` |
| PRE_HOLDOUT_10_SHA | `d7873977aac89d6283e41f94ec1942b570adceaf` (CI 38297543325 green) |
| BLIND ROUND 10 PROJECT 1 | `dom-w-glogownikach` (garage stratum): ALGORITHMIC_FAIL; first bad METRIC (541 → 501, 870 → 810 misreads state a second scale; plan resolution refuses) |
| BLIND ROUND 10 PROJECT 2 | `dom-w-akebiach` (unstratified): ALGORITHMIC_FAIL; first bad EXTENT (envelope short of a 0.96 m rear and a 4.30 m garage projection; completions refused; core floods through the 6.86 m projection mouth) |
| TARGET_CLASS_EXERCISED | NO — neither house has a recessed entrance beside another mouth on one facade line |
| OWNER APK | published: versionCode 1212 (run 212 on `f091d15`, green), SHA-256 `1d009f91…afa51`, preview signer, arm64-v8a only, same five `.so`, OCR model/dictionary/WASM unchanged, analyzer bundle +30 KB; verified from the downloaded file (report §T) |
| INHERITED ARM64 PARITY | PENDING (005H physical-phone gate; not inferred from the emulator) |

**Stage: PARTIAL_BUILDPLAN_ANALYZER_005N_BLIND10_METRIC_EXTENT_FAIL.** Every §45 condition holds except a fresh blind
round without ALGORITHMIC_FAIL; both failures are upstream of the compound reading, which neither house exercised.

## Where the visual referee v2 stands (STAGE BUILDPLAN-ANALYZER-005M)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005M_VISUAL_REFEREE_V2.md`. Evidence: `stage-reports/artifacts/analyzer-005m-vr2/`.

**Scope.** Research only. Production, Android, the resolver and every model decision are unchanged; no OWNER APK; no
fresh blind. No weight, checkpoint or picture entered Git history: `history_gate.sh` checks every commit since the base
for weight and picture magic bytes, and the isolation test checks the tree.

**Bake-off.** Four mandatory small VLMs, llama.cpp on CPU, five information contracts per question (A crop, B plan, C
marked plan, D marked plan + crop, E + analyzer overlay), closed JSON with UNRESOLVED.
- **Phase 1** (30 questions; pre-registered on CONFIDENT_WRONG_RATE): InternVL3.5-2B, Qwen3-VL-2B and Qwen3-VL-4B
  advance; SmolVLM2-2.2B does not.
- **Phase 2** (152 questions × 5 modes; 137 distinct questions + 15 transform twins). The best, on a point estimate, is
  Qwen3-VL-2B in D:
  - 69.1 % exact, **30.9 % confidently wrong** (its error rate: it says HIGH on every answer);
  - on real development questions 77 % / 23 %, above the 62 % first-option prior (+15.5, +2.1 … +26.7), but not above
    a per-class majority fitted on the scored set;
  - on the synthetic families, at chance;
  - counterfactual pairs: both members right in 2 of 10 context pairs (chance is 2.5) and 1 of 16 local pairs; the
    models answer per family, not per drawing;
  - no A → D context gain distinguishable from zero;
  - 0 UNRESOLVED.
- **The body-relation subgroup.** On TERRACE_VS_BODY and BODY_REGION real questions it was right on 29 of 30, including
  the three 005L failure questions. Post hoc; the first target for a frozen real set.
- **The confidence signal.** Every model says HIGH on nearly every answer, so CONFIDENT_WRONG ≈ wrong. No probability
  threshold approaches the 0.5 % gate, and the in-sample zero-error regions fail when checked on held-out questions.

**Teacher and student.**
- **Teacher.** Qwen3-VL-8B (RUN, CPU subset, Q4_K_M) scores 57.5 % on 24 shared questions. Under constrained decoding
  it gives one answer to both members of 20 of 21 TRAIN counterfactual pairs, and its probability does not separate its
  TRAIN answers (AUROC 0.58). A free-text-first prompt separated 2 of 3 pairs it was tried on. It is not a usable
  soft-label source as run.
- **Student.** DEFERRED_ENV. The dataset format is implemented on vrgen2 2.1 (2,000 / 400 / 400 independent drawings,
  a SEALED split). In 2.1 the crop-only abstention target is a function of the class for three classes, so the builder
  refuses the set until the generator adds crop-decidable members. A CPU probe measured 31 s per LoRA step (≈ 1,400 h
  for three epochs).
- **Licence of the smallest base.** SmolVLM2-500M is not commercially clean; SmolVLM-500M-Instruct v1 is cleaner, not
  clean (its SmolLM2 backbone carries a Llama 3.1 output clause). Qwen3-VL-2B has no known licensing blocker.

**Deployability.** Qwen3-VL-2B's smallest pack is 1.55 GB (quality unmeasured), ≈ 2.1 GB of RAM estimated, with a
standalone mode-D question taking ≤ 33 s on this CPU. Gemma 3n is gated; a fine-tune → nested-slice → LiteRT path is
undocumented.

**Review and next.** Six reviewers. Round 1: 0 P0, 19 P1. Round 2: 0 P0, 4 P1. All resolved.
**NEXT: RETURN_TO_DETERMINISTIC_BODY_RELATION**: fix murajach's recessed-entrance / garage-door body relation
deterministically. No small VLM meets, or can be shown on the real data that exist to meet, the 0.5 % gate.

## Where storey registration stands (STAGE BUILDPLAN-ANALYZER-005L)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005L_STOREY_REGISTRATION.md`. Evidence: `stage-reports/artifacts/analyzer-005l/`.
It holds:
- the baseline and the architecture;
- the synthetic corpus and emitted-geometry records;
- the development matrix and the storey-registration artifact;
- mutation and knob results, order invariance and performance;
- the post-review and the blind round;
- the recommendation.

**What changed in production.** Storey registration, the storey-support relation and per-storey footprints, in
`packages/reconstruction`. `LAYOUT_INFERENCE_VERSION` is 1.1.0, carried in the run's versions. The Evidence Pack is
1.3.0, adding `14b-storey-support.json` and the STOREY_SUPPORT stage.

- **STOREY BASELINE — measured.** At the starting code `a70047f`, A06, A07, A01, D00, żurawkach and gozdzikowcach
  generated no placement for the other plan: its envelope took in a publisher mark, an eave or roof planes. Support was
  "the envelope covers ≥ 50 % of a body", and the emitter copied the ground ring upstairs. A03 and jabłonkach passed by
  accident (`baseline-storey-registration.json`).
- **PLAN ALIGNMENT — FIXED.** Wall-on-wall correspondence over bounded named hypotheses: stated chains, printed
  scale, fitted rectangle, facade wall pairs and same pixel scale. Each is recorded with its basis. The score is a true
  Dice share of long walls, and ties are decided at the walls' own pixel resolution. A printed scale or a statement is
  held, or refuted, on the record.
- **UPPER BUILT REGIONS — FIXED.** Every walled body of the other plan is weighed, never its envelope. The body test is
  the base's, plus storey-wall thickness, so a parapet is no storey. Sides are reached to the facade walls.
- **SUPPORT RELATIONS — FIXED.** Directional shares. SUPPORTS needs a room's span on both axes, otherwise INCIDENTAL.
  The overhang is decided by erosion and named when BEYOND. A body reaches a storey only through the one between, and
  near-tie bodies are disputed and named.
- **PER-STOREY FOOTPRINT — PASS.** Each storey's footprint is its own plan's walled body on each mass. L-shaped storeys
  are built as their largest rectangle; the rest is a named gap.
- **EMITTED UPPER GEOMETRY — PASS.** Per-storey rectangles reach rings, openings, interior hosts, slabs and attached
  roofs. The ground ring copied upstairs (M6) is killed by five end-to-end PNG→model fixtures.
- **GARAGE/WING SAFETY — PASS.** No development garage gains a storey. M2 and M7 are killed.
- **A06 — FIXED.** ALGORITHMIC_FAIL → PASS: 2 / 2 storeys, +0.18 %. The attic plan is placed by facade wall pairs, and
  its walled body stands on the main body and the porch. The overhang beside the porch is named.
- **A07 — FIXED.** ALGORITHMIC_FAIL → PASS: 2 / 2, −0.37 %. Placed by wall pairs; the three publisher-mark "regions"
  are not bodies.
- **A01 — storey fixed, row still FAIL.** The attic is registered and stacked on the main body. The run still stops
  on the pre-existing ground-floor window FILL_TOO_LARGE (the same window as before 005L).
- **D00 — storey fixed, row still FAIL.** The attic is registered and stacked. The footprint is still −18.71 %: the
  ground plan misses the garage.
- **DEVELOPMENT MATRIX — PASS.** 40 rows. Four go FAIL → PASS (A06, A07, żurawkach, tunbergiach) and no PASS row turns FAIL.
  Marcówki keeps its 005K model `6152770f`, as does willa-miranda. Two other models move with their verdict kept: the
  morelach upper interior, and D00's attic.
- **DRAWN GAP RULE OFF — confirmed.**
- **ORDER INVARIANCE — PASS.** Family A: no row moves in 8 shuffles. Family B, the chain-order debt, now reaches a
  storey decision on two rows refused at plan resolution (A04, gozdzikowcach). It is measured, not repaired.
- **NON-CIRCULARITY — PASS.**
  - The layout reads only its own option keys; a Proxy test proves it.
  - `structural.ts` names published areas in exactly three lines.
  - Vocabulary and frozen-literal gates; executed decoys.
  - M4 and M8–M10 killed.
- **PERFORMANCE — PASS.** Layout median 807 → 817 ms; analyzer wall per row 22.75 → 23.0 s (+0.9 %). Alignment
  (1.5 ms) and support (+45 ms) are explained.
- **COUNCIL — closed.**
  - Five reviewers, CHANGES_REQUIRED at `4ad69fe`: 7 P0, 20 P1, 24 P2.
  - Every finding is fixed, recorded, documented or accepted (`post-review/resolution.md`).
  - The fixes' own two full-suite regressions are fixed with tests.
- **FREEZE.** `PRE_HOLDOUT_9_SHA = 8f5f3c5903bc8cfe168667f6b5dcfdb995eaf4cd`; CI run 37595482179 green.
- **BLIND ROUND 9 PROJECT 1 — `dom-w-murajach` (stratified, plan storeys [1, 3]): ALGORITHMIC_FAIL.**
  - Typed `METRIC_RESOLUTION_INCONCLUSIVE`.
  - First bad decision: **BODY_RELATION** on the ground plan. A recessed entrance beside the 250 cm garage door leaves
    the body unenclosed and the garage outside the extent, so the attic plan becomes the base. The ground storey's own
    7 m² of closed rooms is refused at the gate.
  - At the 005K code the same evidence emits the attic outline as the ground floor (−13.5 %, also ALGORITHMIC_FAIL).
- **BLIND ROUND 9 PROJECT 2 — `dom-w-cieszyniankach` (unstratified): PASS.** Single storey, −5.1 %, every opening built.
- **INHERITED ARM64 PARITY — PENDING.** 005H's on-device check is the OWNER's; no emulator evidence is substituted.
- **OWNER APK — published, versionCode 1193.**
  - Run 193 on `99b0eea`; SHA-256 `ee9ff7e7…42b6c5`; preview signer `6e48fac4…a0da`; arm64-v8a only.
  - The same five native libraries; the OCR model and WASM are byte-identical.
  - Only the analyzer bundle changed (+50 KB). The Polish checklist is in the report §T.

**CI (closing).** Run 193 (`37610696420`, workflow_dispatch) on `99b0eea`: green on attempt 1, 40 jobs pass, 1 skipped,
UI evidence gate included. The freeze run 37595482179 on `8f5f3c5` was green too.

**Stage: PARTIAL_BUILDPLAN_ANALYZER_005L_BLIND9_BODY_RELATION_FAIL.** Every §45 condition holds except a fresh blind
ALGORITHMIC_FAIL, whose first bad decision is upstream of the storey work.

## Where the gap evidence stands (STAGE BUILDPLAN-ANALYZER-005K)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005K_GAP_EVIDENCE_DRAWN_GAP.md`. Evidence: `stage-reports/artifacts/analyzer-005k/`.
It holds:
- the baseline and the UI preflight;
- the gap-evidence schema;
- the gap-set protocol, exclusion manifest, draw ledger, manifest and labels;
- the results and the constant control;
- the development matrix, mutation results, order invariance and performance;
- the fresh-set verdicts, the post-review and the recommendation.

**What changed in production.** One change, behind an OFF flag (`drawnGapRule`; the product never sets it):
- every WEAK boundary gap carries a trace and a source-addressable record (`frameId / decompositionId / gapId`, crop
  rectangle + ink-mask SHA-256, never pixels);
- digest and Evidence Pack `12b-gap-evidence.json`;
- boundary evidence 1.2.0, Evidence Pack 1.2.0.

With the rule OFF every model hash equals the pre-005K one.

- **UI EVIDENCE HARNESS — PASS.**
  - The 005J `openStage` race is fixed in test code only (`Evidence.awaitExactlyOne`, `clickExactlyOne`, `stageList`,
    `openStage`).
  - The gate is green on the patched harness: run 37533180890, and the freeze run 37539569712.
  - Deviation D2: the production change was committed locally while the gate ran, and pushed only after it was green.
- **PER-GAP EVIDENCE — PASS.**
  - Deterministic for the source as enumerated.
  - Known limits are stated in `gap-evidence-schema.md`. The outline fate lumps over-budget gaps into NOT_REACHED, there
    are no jamb or stroke geometry tuples, the pack covers the selected storey only, and the keys are pinned to chain
    order.
- **FRESH-SHEET GAP SET — PASS (below target).**
  - 14 projects drawn by lot from `892853e` (8 ARCHON, 6 DobreDomy). Attrition: 5 DobreDomy plans print no dimension
    chain; A01's failure record carries no plan digest.
  - 60 gaps on 9 read sheets: ARCHON 47, DobreDomy 13.
  - Sealed before any label.
  - Labels by blind AI sub-agents, **not human**: OPENING 44, OPEN 0, NOT_A_WALL_LINE 10, UNRESOLVED 6; κ 0.845.
  - These projects are excluded from future whole-house blinds.
- **DRAWN-GAP RULE — INSUFFICIENT_EVIDENCE, OFF.**
  - Rule: 25 upgrades, OPENING recall 24 / 44, false upgrades 1 / 10 [0.018, 0.404], 0 outcome-critical.
  - Adoption gate item 4 fails: 10 resolved negatives, 0 open sides.
  - Items 5 and 7 are uninformative, 6 is untested, and 10 is not established.
  - Known closure path (council A1): it can close recess, porch and loggia mouths up to 3.2 m, because no condition
    reads what lies behind a gap.
- **CONSTANT CONTROL.** 60 upgrades, 10 / 10 false, 0 outcome-critical.
- **DEVELOPMENT MATRIX — PASS.**
  - OFF reproduces 26 / 26.
  - ON changes one model (dom-w-zurawkach, 100.88 → 99.99 m², verdict unchanged). The change is not fully explained:
    a 0.89 m² corner leaves.
  - Decoy: 595 shared records, 0 differing.
- **GOZDZIKOWCACH.** Unchanged under ON. The 0.41 m gap is not taken (jamb ink 0.06); storeys not touched.
- **CYKLAMENACH.** Unchanged. REC-17 not weakened.
- **ORDER INVARIANCE — PASS (family A).**
  - Family A: 0 / 192 shuffles of copies, callouts, observations and registrations move a record.
  - Family B: the chain order moves the decomposition grid on 83 / 192 shuffles (`gridLines`, pre-existing, upstream).
- **NON-CIRCULARITY — PASS.**
  - Architecture gates: imports, vocabulary, frozen literals.
  - Every production mention of the option is in a fixed form.
  - M1–M6 all killed; limits stated (C5).
- **PERFORMANCE — PASS.** OFF +0.1 %, ON +1.5 % solver time; 0.2 ms and about 1.7 KB a record; RSS unchanged.
- **COUNCIL.**
  - A, B and C CONDITIONAL PASS; D CHANGES REQUESTED.
  - 1 P0 fixed: the research-isolation allowlist, red from the seal on.
  - 12 P1 fixed or stated (`post-review/resolution.md`).
- **PRODUCTION ADOPTION — NOT ADOPTED.**
- **BLIND ROUND 9 — NOT_RUN_BY_DESIGN.**
- **INHERITED ARM64 DEVICE PARITY — PENDING.** 005H's on-device check is the OWNER's.
- **OWNER APK — not published.** No production decision changed. The next OWNER APK will carry boundary evidence 1.2.0 /
  Evidence Pack 1.2.0.

**CI (closing).** Run 37546736072 (run 185) on `2f57f90`, the last content commit: green on attempt 1.
- 39 jobs pass, 2 skipped by design.
- The Android UI evidence gate passes. That is three greens in a row on the patched harness: runs 183, 184 and 185.

**Stage: PASS_BUILDPLAN_ANALYZER_005K_GAP_EVIDENCE_READY_FOR_COORDINATOR.**

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
  - In the shipped WASM runtime SmolVLM2 costs ≈ 17–20 s per question with a ≥ 1.9 GiB process peak, ≈ 7 min per median house.
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
- **Stage: PARTIAL_BUILDPLAN_ANALYZER_005J_CI_UI_EVIDENCE_RED.** No blind project consumed; round 9 not drawn; 005I production code not reopened.

**CI:** run 37514203211 on `d287aba`: 38 jobs pass, 2 skipped by design, 1 red. The red job is the Android UI evidence gate: `VerticalSliceDeviceTest.openStage` failed on both attempts, on different houses. The stage-sheet node lookup found a number of matches other than one, and Compose's failure-message path then tripped its thread check. `apps/` is byte-identical to `64b78b4`, where the gate passed. It is not fixed here because `apps/` is frozen in a research-only stage; a patch is proposed in the 005J report §N.

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

**For the analyzer line (after 005P): return to the coordinator.** Report §Q.

**NEXT: the walled envelope reconciled with a STRONG printed chain extent (`plan-decomposition` only).** When the
long-band box falls short of a STRONG DIMENSION_CHAIN_EXTENT whose printed sub-chain boundaries fall on the missing
strips (krasnokwiatach: 1610 = 430 + 780 + 400, box = the 780 strip), offer the chain-bounded strips as envelope
candidates judged by their walls and openings instead of "nothing is built", and keep the outer face instead of
snapping inward by a wall thickness (glogownikach's −8.04 %).
- TOPOLOGY_BOUNDARY is the largest failing root on the 44 rows (10 of 26) and the first bad decision of blind 11 #2
  and blind 10 #2, both at a correct scale.
- Out of reach of such a rule and to be said so: akebiach's uninked S face. Keep 005N compound-facade / open-side
  safety and 005L storeys; own preregistration, development material, fresh blind.
- Recorded, not chosen: CHAIN_CORRECTED values never anchor or measure (murajach, gozdzikowcach); a registration's
  own anchors as citations (005P J-1); ranking that tells "no evidence" from "agrees".

005Q is not self-started. The 005O recommendation (plan resolution reads through the ensemble) is answered by 005P (N1a, not M1).

**For the analyzer line (after 005O): return to the coordinator.** Report §O.

**NEXT: 005P — plan resolution reads its statements through the ensemble that already exists (M1: a statement whose
confident readers of the same ink disagree states nothing as printed), with its own freeze and a fresh blind round.**
- Measured in 005O: the incumbent's as-printed value is wrong on 55.5 % of the real labels it states; M1 removes 250
  of 372 stated-wrong values (1 correct lost), is image-free (latency within noise), builds `dom-w-glogownikach` at the
  correct scale and changes no known-good model (44 development cases, 0 false-confident scale).
- To decide there, not here: which of the view's five consumers it feeds — the resolver's ranking (`dom-pod-jarzabem`
  switches copy, with changed open-side/terrace semantics) or only the conflict triggers (`rarytasy-eoze`'s path changes).
- Not M2/M3 (adverse refusal reason on kosacce-area-alone), not M1b (no gain over M1), not a geometry kernel (no
  bottleneck), not PDF.js (not on the failing path).
  Recorded, not chosen: murajach's orientation decision (M4-diag), the legacy chain binding, akebiach's pier extraction.

005P is not self-started. The 005N recommendation (OTHER_MEASURED_RESIDUAL: scale from printed dimensions) is answered by 005O.

**For the analyzer line (after 005N): return to the coordinator.** `stage-reports/artifacts/analyzer-005n/recommendation.md`.

**NEXT: OTHER_MEASURED_RESIDUAL — the plan's scale from its printed dimensions (METRIC).**
- Blind round 10 #1 (`dom-w-glogownikach`): two label misreads (541 → 501, 870 → 810) state a second scale against
  the corroborated one, and plan resolution refuses. Blind round 9 #1 (`dom-w-murajach`), with its garage now in the
  plan: 5 labels read on 79 dimension lines, no independent scale.
- Not FIX_PLAN_RESOLUTION (the resolver refuses correctly between two stated scales), not REC-17, not PDF.js (raster
  plans with legible labels), not a wall model (walls are read). EXTENT (blind 10 #2) is the second residual.

005O is not self-started. The 005L recommendation (FIX_RECESSED_ENTRANCE_BODY_RELATION) is done by 005N.

**For the analyzer line (after 005L): return to the coordinator.** `stage-reports/artifacts/analyzer-005l/recommendation.md`.

**NEXT: FIX_RECESSED_ENTRANCE_BODY_RELATION.**
- The first bad decision on blind round 9 #1 (`dom-w-murajach`) and on blind round 8 #1 (`dom-w-gozdzikowcach`) is
  the same. A recessed entrance next to a garage door on the front line is read as one wide mouth, so the house body is
  not enclosed and the garage is left outside it.
- On murajach this is upstream of every storey decision. 005L's storey work neither caused it nor could fix it.
- FIX_PLAN_RESOLUTION has two roots, and this is one of them. REC-17 and PDF.js vector evidence are not what failed.

005M is not self-started. The 005K recommendation below (FIX_STOREY_COUNT) is done by 005L.

**For the analyzer line (after 005K): return to the coordinator.** `stage-reports/artifacts/analyzer-005k/recommendation.md`.

**NEXT: FIX_STOREY_COUNT.**
- On the 14 fresh 005K projects, the upper storey is not stacked (`NO_MASS_REACHES_UP`) first on A01, A06 and A07, and
  co-first with the footprint on D00.
- A06 and A07 pass every other predicate.
- Storeys are also the most frequent verdict blocker in the development matrix.

The drawn-gap rule stays OFF (INSUFFICIENT_EVIDENCE). A successor needs:
- a sealed set with ≥ 30 negatives, including open sides, drawn by a pre-declared stratified protocol;
- the recess-mouth closure path closed first.

The wall model stays the challenger: the fresh set found no false bridge that matters, so it gives no veto target.

The 005J recommendation below is superseded by this one, subject to the coordinator.

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

## Where the source-role guard stands (STAGE BUILDPLAN-ANALYZER-005R-ROUTER)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_ROUTER_SOURCE_ROLE_GUARD.md`. Evidence:
`stage-reports/artifacts/analyzer-005r-router/`. Harness and staged N1: `research/analyzer-005r-router/`.

- **Production is unchanged** (freeze IDENTICAL). Interior visualisations still reach the facade extractors through
  `analyze.ts:164`; measured on 37 development rows, the 15 893 facade observations on 403 perspective frames change no
  model, no metric evidence and no camera — the damage is to evidence and provenance (graph, ledger), not geometry.
- **N1** (orthographic facade extractors only on orthographic frames) is staged, with its tests, in
  `research/analyzer-005r-router/n1-staged/`. It is **not** a scene classifier and not a 3D improvement. It failed
  three preregistered predicates for reasons that look benign but were found after unsealing; adopting it needs a new
  preregistration and a fresh blind.
- **Still open:** the vision path requests facade decomposition on perspective renders (off by default;
  `ANALYZER_VISION=live` in `apps/analyzer-api`); scene truth does not exist; publisher text sits at HEAD in 35 sealed
  `source-package.json` files of earlier stages and in 005R history (OWNER decision, nothing rewritten); earlier
  DobreDomy use is OWNER_DECISION_PENDING.
- Gates: typecheck, build, e2e 47/47 green; `npm test` 2584 passed with two `WorkerExecutor` timeouts under replay load,
  63/63 when rerun alone. CI: green on the last content commit `f3e3606` (run 38754629214, 39/2); on the report-only
  commit after it the Android UI evidence job failed twice on the known Compose `openStage` race (run 38759573725, attempts
  1–2, one rerun used) — not this stage's code, recorded rather than retried further.

## Where projection-aware facade routing stands (STAGE BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_ROUTER_N1_ADOPTION_GATE.md`. Evidence:
`stage-reports/artifacts/analyzer-005r-router-n1/`. Harness, audit and preregistration (`dc9f735`, addenda A–C):
`research/analyzer-005r-router-n1/`. Branch `analyzer/visual-source-projection-guard-adoption-v1`.

- **Production change (one policy):** `readsAsFacade(roles)` in `packages/source-vision/src/tasks.ts` routes the
  deterministic facade extractors (`source-analyzer/src/analyze.ts`), the `FACADE_DECOMPOSITION` vision task
  (`tasksForRoles`) and the vision apply boundary. A perspective render, interior or exterior, stays a declared frame
  (cameras still solve from its raster) but carries no facade observation, only a named `NOT_ATTEMPTED` refusal.
  Elevations are never refused. No enum, schema, role, geometry, OCR or UI change.
- **Measured:** 37 ARCHON DEV rows — models 23/23 and typed refusals 14/14 identical, orthographic evidence identical,
  metric and candidate content identical on 23, graph diff fully accounted (0 unexpected), deterministic under reversal
  and shuffle; 18 camera rows — 67/67 cameras identical, 2 286 false `USED_AS_CORROBORATION` records gone, 0 added;
  vision path closed (mock live provider, 2 vision mutants); 9/9 mutants; Node 22 and Node 18 focused suites green;
  BLIND_13 (round 13, `dom-w-jasminowcach`, `dom-przy-skwerze`) PASS 2/2.
- **Not claimed:** no scene classifier, no interior/exterior truth (`HUMAN_TRUTH: NOT_RUN`), no exterior detector,
  no 3D change; ARM64 physical PENDING; no APK.
- **Open (disclosed):** analyzer version labels unchanged although the graph and its hashes change on pages with
  renders; `apps/web/src/sample-observations.json` still shows facade observations on a perspective frame;
  `npm test` / `npm run e2e` not run locally (FAST CI budget) — the one CI run on the final head is decisive and is
  reported in the closing handoff.

## Where exterior evidence stands (STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_TRUTH_JSON.md`. Code, preregistration, contract, ledger
manifest and results: `research/analyzer-005r-exterior/`. Branch `analyzer/exterior-scene-feature-evidence-v1`.

- **What exists:** a research JSON contract `research.exterior-proposals.0.1` (closed keys; four separate channels —
  publisher structure, pixel interpretation, orthographic technical confirmation, reviewer adjudication; statuses
  derivable from anchors; SOURCE_EXACT never from a perspective; corroboration only by a same-class technical anchor of
  the same edition) and a deterministic router B1 that emits it from already-local, hashed inputs. No production code.
- **Measured (truth = publisher structure + technical text + production features; not human):** GARAGE_ENCLOSED
  present in 9 editions and absent in 5 by the publisher's own spec sheet (plan schedule, printed area, door spec — the
  same page as the claims, so consistency, not independent evidence); TERRACE corroborated in 6 by B1's preregistered
  rule, of which 2 survive the post-audit strict recount; 10 recesses / attached roofs kept
  UNKNOWN_ASSEMBLY with alternatives; scene role decided for 33 of 71 frames, the rest abstain; 0 interiors routed
  exterior; look-alike traps (vestibule ≠ carport, navigation ≠ claim, scan columns ≠ columns, slab ≠ pergola) hold.
- **Not supported / not measured:** pergola, carport, entrance canopy, columns, balcony, loggia, railing, large glazing
  have no technical corroboration (pergola, canopy and columns have no technical channel at all); feature visibility on
  renders is NOT_MEASURED (19/19 abstain); whether the production model has the garage door is NOT_MEASURED; ARM64 not
  measured.
- **Open (unchanged, disclosed again):** analyzer version label `1.1.0` and the stale
  `apps/web/src/sample-observations.json`; a paired migration + test is proposed in the report §K for the next
  authorized production change.
- **Next bounded step (recommendation only):** an independent-evidence stage — a local OWNER spot review of feature
  visibility on the 5 routed exterior renders and 14 elevations (≈ 60 items, prepared without showing any image to a
  model) — before any 005S or detector work.



## Where the OWNER truth pack stands (STAGE BUILDPLAN-ANALYZER-005R-EXTERIOR-OWNER-TRUTH-PACK)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005R_EXTERIOR_OWNER_TRUTH_PACK.md`. Pack, preregistration, README for the
OWNER and tests: `research/analyzer-005r-exterior-owner-review/`.

- Exists: a local review page with a 60-question queue (26 priority), phase-1 blind answers, a seal, a phase-2 technical
  cross-check, deterministic export/import validated by one shared core (`tool/review-core.js`, also run by Node), an empty
  labels template and a SYNTHETIC example. Nothing labels anything automatically.
- Does not exist: any OWNER answer (HUMAN_TRUTH NOT_RUN), any accuracy (NOT_MEASURED), any transfer of the private image
  cache to the OWNER (the OWNER saves public images themselves; byte identity is checked locally by SHA-256).
- Next: the OWNER's priority batch; evaluation only as a separate, preregistered stage that accounts for one reviewer, small
  sample and correlated variants.


## Where technical openings stand (STAGE BUILDPLAN-ANALYZER-005S-N1-TECHNICAL-OPENINGS)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005S_N1_TECHNICAL_OPENINGS.md`. No production change: the opening
pipeline (plan gap + printed callout for position/width, rendered elevation for sill/head) is unchanged, because no
development row showed a source-provable mis-placed or omitted opening that a registered orthographic elevation could fix.
The replay harness `research/analyzer-005s-openings/replay-reconstruct.ts` re-runs only the v2 solver on sealed N1 rows.


## Where public technical PDFs stand (STAGE BUILDPLAN-ANALYZER-005S-N2-PUBLIC-TECHNICAL-PDF-GATE)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005S_N2_PUBLIC_TECHNICAL_PDF_GATE.md`; preregistration, ledger and a
source-contract check: `research/analyzer-005s-technical-pdf/`. Verdict `NO_USABLE_PUBLIC_TECHNICAL_PDF`, no production
change. For the three preregistered development editions (`m168264238cc55`, `m43d25c0636969`, `m84f2903cb8e14`) and the
OWNER example (`m3ea28300f9b3e`, isolation only) the publisher links the project-card PDF only through an e-mail lead form;
the unlinked print endpoint was not used, so no PDF byte was read and no opening changed.


## Where preview-first stands (STAGE BUILDPLAN-ANALYZER-005T-PREVIEW-FIRST-V1)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005T_PREVIEW_FIRST_V1.md`; cases and hashes: `research/analyzer-005t-preview-first/`.
Branch `analyzer/005t-preview-first-paddle-binding-v1` from `f055528`. Verdict `PARTIAL_PREVIEW_FIRST`.

- **Production change (one rule):** exterior windows and doors are framed inside the wall the solver read
  (`frameWithinWall`, `packages/reconstruction/src/v2/emit.ts`). The solver accepts walls from 0.15 m, the model's default
  frames reach 0.20 m (window) / 0.22 m (door): a house read with thinner walls was refused at its first window. Where the
  default fits nothing is emitted, so built models are unchanged by construction. No gate, validator, OCR or contract changed.
- **Measured:** development row A01 (`m60124f28f071a`, formerly `MODEL_EMISSION_FAILED`) now completes canonically —
  model `4ced0179…`, scene `22871168…` (107 meshes), replay byte-identical, closure DEGRADED (14 exterior joint findings).
  A00 (`PLAN_RESOLUTION_INCONCLUSIVE`) unchanged and not preview-eligible (only the published footprint picks its reading).
  Controls Marcówki, Cieszynianki, Rarytasy G2E, Jabłonki: 4/4 model hashes identical. Targeted typecheck and 492 tests green.
- **Not built:** no `APPROXIMATE_PREVIEW` class, no result/protocol/Android change; PaddleOCR binding not entered (neither
  case stops in OCR). `ANDROID_VISUAL_NOT_RUN`; CI, holdout and APK NOT_RUN; solver version label not bumped.
- **Next (recommendation):** `dom-w-gozdzikowcach` `placeChimney INVALID_COMMAND`, the other emission-stage refusal.


## Where the second emission refusal stands (STAGE BUILDPLAN-ANALYZER-005T-N2)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005T_N2_CHIMNEY_RECOVERY_AND_MODEL_WARNINGS.md`; diagnosis:
`research/analyzer-005t-n2/`. Branch `analyzer/005t-n2-chimney-recovery-warnings-v1` from `987a354`. Verdict
`NO_SAFE_CHIMNEY_RECOVERY`, zero production change.

- `dom-w-gozdzikowcach` (`placeChimney chimney-0`, height 0) has no roof at all: no ridge datum was read, so no main roof
  and no registered elevation; the chimney had no top. Recovering it would give a roofless two-storey box (diagnostic
  model `9ab62e9e…`, 0 roofs) of a house printed with a 40° gable; the refusal stands. Blocking seam: the ridge datum
  (`levels.topDatum`) when only the publisher's pitch and building height are known — a roof-solver stage, not a chimney fix.
- A01 warnings are correct in production (6 of 9 `LIMITING`; Android shows „Model gotowy z ograniczeniami”); the 005T-V1
  research tally and report line that said none were limiting are corrected.
- Control `rarytasy-g2e` identical; 18 targeted tests green. CI, APK, Android visual review NOT_RUN.


## Where the approximate roof datum stands (STAGE BUILDPLAN-ANALYZER-005T-N3)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005T_N3_ROOF_DATUM_RECOVERY.md`; preregistration and results:
`research/analyzer-005t-n3-roof/`. Branch `analyzer/005t-n3-roof-datum-recovery-v1` from `ae63f12`. Verdict
`SAFE_ROOF_DATUM_RECOVERY_REAL_3D` (approximate visual preview; OWNER visual NOT_RUN).

- **Production change (one rule):** without a printed section ridge, a GABLE the page specifies takes an approximate
  ridge R = top floor + printed knee wall + half span · tan(printed pitch), accepted only if the published building
  height leaves a plausible terrain + build-up (0.05–1.78 m); it feeds the roof and the top storey only, is labelled
  `ASSUMED_FOR_RENDERING` (roof `SOURCE_DERIVED`, never EXACT), and adds the LIMITING warning `APPROXIMATE_ROOF_DATUM`
  (`packages/reconstruction/src/v2/roof-datum.ts`). A printed ridge always wins; HIP/FLAT/UNKNOWN are never routed here.
- **Measured:** `dom-w-gozdzikowcach` (`m79923e950094d`) refused → COMPLETED: 40° gable, ridge 7.936 m, model
  `a612a399…`, scene `50002e00…` (162 meshes), round-trip and replay verified, 0 exterior joint errors, 3 LIMITING
  warnings. Controls g2e, Cieszynianki (HIP), Marcówki, A01: 4/4 model hashes identical. 39 targeted + 111
  architecture tests green; typecheck green.
- **Unknown:** the attic floor (2.80 m convention), terrain and eave build-up; chimney top (existing convention, ASSUMED).
  No quantities or costs from this geometry. CI, APK, Android visual review NOT_RUN.


## Where the owner's two-house visual APK stands (STAGE BUILDPLAN-OWNER-005T-TWO-HOUSES-VISUAL-APK)

Report: `stage-reports/STAGE_BUILDPLAN_OWNER_005T_TWO_HOUSES_VISUAL_APK.md`. Branch `owner/005t-two-houses-visual-apk-v1`
from `c4618749`.

- The phone ships, first in its list and offline, `jarzmianki-005t-visual` (`m60124f28f071a`, model `4ced0179…`) and
  `gozdzikowce-005t-visual` (`m79923e950094d`, model `a612a399…`): the sealed pipeline models, pinned by SHA-256 in
  `packages/candidates/src/owner-005t/`; their scene bytes equal the pipeline's (`22871168…`, `50002e00…`). The five
  earlier scenes are unchanged. Subtitles say MODEL ORIENTACYJNY — nie do kosztorysu.
- `-PvisualReview=005t` builds a side-by-side test app `com.buildplan.preview.visual005t` („BuildPlan 3D – test”);
  without it the app is unchanged. One local build: arm64 APK `26203a60…57dc`, versionCode 479, preview signer
  `6e48fac4…`, signature and alignment verified, assets checked inside the APK.
- Distribution: the APK is committed at `stage-reports/artifacts/owner-005t/BuildPlan-005T-two-houses-arm64.apk`
  (creating a GitHub release was refused to this session, HTTP 403). CI, mirror, `preview-latest`, `owner-preview-latest`
  untouched. OWNER_VISUAL_NOT_RUN.


## Where the owner's visual failure stands (STAGE BUILDPLAN-ANALYZER-005U-OWNER-VISUAL-FIRST-BAD-FIX-V1)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005U_OWNER_VISUAL_FIRST_BAD_FIX.md`; trace and metrics:
`research/analyzer-005u-owner-visual/`. Branch `analyzer/005u-owner-visual-first-bad-fix-v1` from `074d6ae`. Verdict
`OWNER_VISUAL_FIRST_BAD_FIXED_PARTIAL`. The OWNER judged both 005T houses unrecognizable; that stands until re-reviewed.

- **First bad (fixed):** `openings-v2.ts` set an unread opening's sill at the floor (ASSUMED) and then read it back as
  "reaches the floor", making doors, glazed doors, multi-panel screens and garage doors of unread gaps. Now, without a
  read height, only the plan decides: a drawn swing, or an empty ≤1.3 m gap on the ground storey, is a door; anything else
  is a window placeholder with its kind and heights ASSUMED; never a garage/glazed/multi-panel door from an assumption.
- **Measured:** A01 garage door 1→0, attic doors 5→1; Goździkowce attic doors 6→2 (windows 0→4); no opening lost.
  Controls Rarytasy G2E and Marcówki identical; Cieszynianki changes (assumed doors 6→4, the same correction).
- **Not fixed (named):** A01's attached strips inside the main gable footprint (plan decomposition); Goździkowce's
  integral garage (no garage room on the plan reading). Owner screenshots were not available to this session. No APK.

## A01's false attached bodies (STAGE BUILDPLAN-ANALYZER-005U-N2-PLAN-MASS-FIRST-BAD)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005U_N2_PLAN_MASS_FIRST_BAD.md`; trace: `research/analyzer-005u-n2-mass/`.
Branch `analyzer/005u-n2-plan-mass-first-bad-v1` from `074c956`. Verdict `SAFE_MASS_TOPOLOGY_FIX_WITH_MEASURED_3D_CHANGE`.

- **First bad:** `planBodies` unioned A01's five ground regions (no wall between them) but its rectangularity test
  refused the box because of wall-thin cells: the inner half of the outer wall and a partition core. One house became
  MAIN + two ATTACHED strips with flat roofs inside the gable's footprint.
- **Fix:** inside a group's box, a cell no wider than max(0.5 m, 1.5 × wall thickness) that stands against drawn wall
  (wall + opening ≥ 0.5) is wall material. It never joins regions a wall separates.
- **Measured:** A01 is one body under one gable (model `5ea8bbca…`), exterior openings 20 → 12 (the dropped ones stood on
  interior lines). Rarytasy G2E, Marcówki, Cieszynianki and Goździkowce are byte-identical.
- OWNER_VISUAL_NOT_RETESTED; CI/APK NOT_RUN; `research-isolation` APK-size gate still red from `074d6ae` (known baseline).

## Goździkowce's integral garage (STAGE BUILDPLAN-ANALYZER-005U-N3-INTEGRAL-GARAGE-FIRST-BAD)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005U_N3_INTEGRAL_GARAGE_FIRST_BAD.md`; trace:
`research/analyzer-005u-n3-garage/`. Branch `analyzer/005u-n3-integral-garage-first-bad-v1` from `b19960d`. Verdict
`PARTIAL_ROOM_BOUNDARY_FIX_NO_GARAGE_DOOR`.

- **First bad:** `readInterior` capped a partition at 0.72 × the outer wall (9 px). The garage's fire wall is as thick as
  the outer wall (12 px), so it was never read and the ground floor flooded into one 106.75 m² room.
- **Fix:** a partition may be as thick as the outer wall. It is not treated so within one outer-wall thickness of the
  interior edge (the outer wall's own ink), and solid blocks (chimneys) keep the 0.72 bound.
- **Goździkowce (`5a828478…`):** the garage is its own room, 26.09 m² at x 9.0–13.5 × z 0.3–6.55. Its exterior,
  roof and chimney are byte-identical.
  - It is not labelled: the "8" token was discarded by the page vote.
  - There is still no garage door: the printed `325/225` reads as `176/140`, so the mouth stays an ASSUMED placeholder.
- **Controls:**
  - Rarytasy G2E: identical.
  - Marcówki: one attic T-junction re-trimmed.
  - Cieszynianki: +1 real thick wall and door.
  - A01: +11 real 0.12 m partitions on the ground floor. The outer wall reads 0.152 m, so the old cap was 5 px.
  - Every change was checked against the cached sheet.
- OWNER_VISUAL_NOT_RETESTED; CI/APK NOT_RUN; the `research-isolation` APK-size gate is still red from `074d6ae`.

## Goździkowce's garage door (STAGE BUILDPLAN-ANALYZER-005U-N4-GARAGE-LABEL-CALLOUT-FIRST-BAD)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005U_N4_GARAGE_LABEL_CALLOUT_FIRST_BAD.md`; trace:
`research/analyzer-005u-n4-garage-ocr/`. Branch `analyzer/005u-n4-garage-label-callout-first-bad-v1` from `d5d14be`. Verdict
`SAFE_INTEGRAL_GARAGE_DOOR_RECOVERED`. The garage's identity and the door's kind are source-derived; the door's
dimensions are not.

- **First bad (label):** the page orientation vote (`dedupeOrientations`, merit × glyph count) kept a 3-glyph rotated
  garble `/13` over the upright `8` on the same ink, and `reconstruct-v2` dropped discarded readings before numbering
  rooms.
- **Label fix:** a set-aside reading may number a room only when all of these hold:
  - it is upright;
  - it is the one reading of its ink naming a published room;
  - the same number is printed nowhere else on the storey;
  - the number is still free;
  - the room is within 40 % of the published area.
- **First bad (door):** `GARAGE_DOOR` needed an ATTACHED single-storey body.
- **Door fix:** the one plan `OPEN_SIDE` along a published-garage room's outer face is a vehicle door in any body. Two
  such sides are AMBIGUOUS.
- **Goździkowce (`b022b7c7…`):** `main-room-0-1` is now 8 = Garaż. `opening-0-front-0-2` is a GARAGE_DOOR, 3.22 m from
  the plan gap, kind SOURCE_DERIVED, sill and head ASSUMED (0 / 2.2 m).
- **Callout 325/225:** UNRESOLVED. The template reader saw 3–5 px digits and read 176/140; PP-OCRv6 has no route to ring
  callouts.
- **Controls:** Rarytasy G2E, Marcówki and Cieszynianki are identical. A01 only numbers room 1 = Wiatrołap.
- OWNER_VISUAL_NOT_RETESTED; CI/APK NOT_RUN; the `research-isolation` APK-size gate is still red from `074d6ae`.

## A01's facades, wall first (STAGE BUILDPLAN-ANALYZER-005V-WALL-FIRST-FACADE-ALIGNMENT-V1)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_WALL_FIRST_FACADE_ALIGNMENT.md`; ledger and before/after:
`research/analyzer-005v-facade/`. Branch `analyzer/005v-wall-first-facade-alignment-v1` from `eff66f4`. Verdict
`VISUAL_FACADE_FIT_IMPROVED_WITH_EVIDENCE` (not an OWNER pass).

- **Roof axis:** the apex vote counted a render's blue sky as ink, so A01's ridge ran along Z and the front became a
  gable. Ink is now neutral (`topNeutralInkRow`): ridge along X, eave walls front and rear, 2 chimneys.
- **Eaves:** an ASSUMED head above the eaves is lowered under them while ≥ 1.0 m of window remains, else the gap is
  refused by name (knee wall). `OPENING_ABOVE_WALL_TOP`: A01 7 → 0, Goździkowce 1 → 0.
- **Ground front:** the registered face missed the drawn wall by 1–2 px, so the whole wall read as one gap and was
  dropped. Only then is the wall looked for 0.5 m in / 0.15 m out. A01 front: 0 → 4 openings, each within 0.01 u/L of
  the elevation; 2 of 4 kinds right (two tall glazings read as DOOR), heights ASSUMED.
- **Controls:** Goździkowce keeps the N4 garage door, room 8, roof and walls (only a 0.59 m knee-wall gap goes);
  Marcówki, Rarytasy G2E and Cieszynianki identical.
- **Found, not fixed:** `wall-strip.test.ts` has been 40/63 red since 005U-N3 (`d5d14be`); the
  `research-isolation` APK-size gate is still red. OWNER_ZIP_NOT_AVAILABLE; OWNER_VISUAL_NOT_RETESTED; CI/APK NOT_RUN.

## The wall-strip regression, diagnosed (STAGE BUILDPLAN-ANALYZER-005V-N1-WALL-STRIP-REGRESSION-RECOVERY)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N1_WALL_STRIP_REGRESSION_RECOVERY.md`; evidence and the candidate:
`research/analyzer-005v-n1-wall-strip/`. Branch `analyzer/005v-n1-wall-strip-regression-recovery-v1` from `6af3d71`.
Verdict `PARTIAL_REGRESSION_RECOVERY_NOT_ADOPTED`: **no production change**.

- **First bad:** all 40 `wall-strip.test.ts` failures are one assertion (the model wall count). The 005Q fixtures
  register the body at 0.026 m/px against a drawing at 0.05 m/px, so the house's own outer walls (18 px) stand inside
  the interior. 005U-N3 admits partitions up to the outer wall's thickness, so it reads them as partitions.
- **Candidate (not adopted):** a body side with wall ink at < 5 % of its length is unwalled. Its registration is then
  uncertain, and N3's thick partitions are not read on that body. Fixture bodies with this signature score 0.00–0.015;
  real bodies with thick pieces score ≥ 0.35.
  - Result: `wall-strip` 62/63, the 5 real replays byte-identical, N3/N4 unit tests green.
- **Blocker:** `entrance:id` (005N) is correctly registered; its five extra walls are drawn 12 px walls, two of them
  between a garage and the house, like Goździkowce's fire wall. Only a decision on that frozen record can make it
  63/63.
- Committed tree = base: `wall-strip` 23/63; the APK-size gate is still red. CI/APK NOT_RUN; OWNER_VISUAL_NOT_RETESTED.

## The wall guard and the entrance contract (STAGE BUILDPLAN-ANALYZER-005V-N2-WALL-CONTRACT-ADOPTION)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N2_WALL_CONTRACT_ADOPTION.md`; ledger:
`research/analyzer-005v-n2-wall-contract/ledger.json`. Branch `analyzer/005v-n2-wall-contract-adoption-v1` from
`2b3f6ca`. Verdict `ADOPTED_WALL_GUARD_AND_VERSIONED_ENTRANCE_CONTRACT`.

- **Production:** `interior.ts` takes the N1 candidate as is. A body side with wall ink at < 5 % of its length makes
  the registration uncertain (named in `unresolved`), and 005U-N3's thick partitions are not read on that body.
- **Contract:** `FROZEN['entrance:id'].walls` stays 4. A versioned `N3_THICK_INTERIOR_WALLS_EXPECTED` holds 9 for that
  one fixture and redraw only, checked structurally against the five 12 px walls drawn in `entrance()`.
- **Tests:**
  - `wall-strip` 23/63 → 65/65 (all 63 original + 2 new);
  - new `interior-unwalled-side` 5/5 (4 of the 5 red before);
  - N3/N4/005V unit tests and `tsc` green.
- **Replays:** the 5 dev cases are byte-identical to N1. Goździkowce's garage (room 8, fire wall, 3.22 m door) and
  A01's ridge X, 2 chimneys and 4 front openings stay.
- The APK-size gate is still red (KNOWN_BASELINE_FAIL); Rarytasy OWNER m3ea… NOT_RUN; CI/APK NOT_RUN;
  OWNER_VISUAL_NOT_RETESTED.

## A01 front glazing: diagnosed, candidate not adopted (STAGE BUILDPLAN-ANALYZER-005V-N3-A01-FACADE-GLAZING-AND-PROPORTIONS)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N3_A01_FACADE_GLAZING_AND_PROPORTIONS.md`; ledger, candidate patch and
render steps: `research/analyzer-005v-n3-facade/`. Branch `analyzer/005v-n3-a01-facade-glazing-proportions-v1` from
`b353729`. Verdict `PARTIAL_NOT_ADOPTED`: **no production change**.

- **First bad (kind):** `glazingDrawn` counted only ink darker than luma 160, while this plan draws glazing as thin grey
  lines (181–199). Its scan also started at the smaller of the gap's x and y ("mixed min"). So 100/220 and 90/210 were
  doors.
- **First bad (heights):** the FRONT elevation is refused at registration: its silhouette takes in a pergola, and the
  verge overhang along x is unknown. No front opening gets a read height.
- **Candidate (light-line glazing + mixed-min fix + glazed door from glazing and a swing):**
  - A01 front 90/210 becomes glass at 0.89 × 2.10 m.
  - A01 front 100/220 becomes a glass window at the assumed 0.9 m sill — **worse height** (1.30 against 2.20).
  - Control changes verified on each plan: Goździkowce ×3, Marcówki ×1 improved; Cieszynianki ×2 material only.
  - `glazing-symbol` 6/6 (3 red on the base); `wall-strip` 65/65; `tsc` clean.
- Needs a coordinator decision (adopt with the 100/220 caveat, or front elevation registration first). APK-size gate
  still red; CI/APK NOT_RUN; OWNER_VISUAL_NOT_RETESTED.

## A01 front elevation registration: research only (STAGE BUILDPLAN-ANALYZER-005V-N4-A01-FRONT-WALL-REGISTRATION)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N4_A01_FRONT_WALL_REGISTRATION.md`; preregistration, ledger and the
candidate: `research/analyzer-005v-n4-front-wall/`. Branch `analyzer/005v-n4-a01-front-wall-registration-v1` from
`83c4142`. Verdict `PARTIAL_FRONT_REGISTRATION_RESEARCH_ONLY`: **no production change**.

- **Registration works:** scaled on the walls' neutral band (FRONT 411–1027 px; the rear band is also 617 px) by the
  plan's 10.5 m, with the ridge datum as anchor.
  - Ground at −0.26 against terrain −0.72 (error 0.46; −0.32 on the section: 0.06).
  - The four front gaps land on the elevation's openings with u/L residuals ≤ 0.004, in order, not mirrored.
- **Not adopted:** the shared opening-height reader (mean-luma contrast) misses glass drawn with blinds and reflections.
  It reads 100/220 as 0.06–0.99 m and finds nothing on the other three, so adoption would worsen A01.
  - The candidate also adds 2 A01 rooflights and changes one Cieszynianki window and its roof (unverified).
- The N3 glazing patch is not applied. APK-size gate still red; CI/APK NOT_RUN; OWNER_VISUAL_NOT_RETESTED.

## Elevation opening heights: no safe fix (STAGE BUILDPLAN-ANALYZER-005V-N5-ELEVATION-OPENING-HEIGHT)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005V_N5_ELEVATION_OPENING_HEIGHT.md`; trace:
`research/analyzer-005v-n5-opening-height/`. Branch `analyzer/005v-n5-elevation-opening-height-v1` from `631b248`.
Verdict `NO_SAFE_OPENING_HEIGHT_FIX`: **no production change**.

- **First bad:** `verticalOpeningExtent` compares the median grey of each row against wall strips and splits with Otsu.
  On A01's front render, blinds and reflections break the run, and two reference strips land off the wall.
- **Five variants tried** (grey/RGB × Otsu/wall-spread limit, plus a frame-line head). The best reads 1 of 4 openings
  correctly (100/220 at 0–2.11 m), 1 partially, 1 unreadably, and one harmfully: a false 1.3–1.9 m band on 90/210.
  The frame line gives a consistent head (2.11 m on 4/4) but no sill.
- The N4 and N3 patches were not applied; model hashes equal the base.
- VISUAL_NOT_VERIFIED; OWNER_VISUAL_NOT_RETESTED; APK-size gate still red; CI/APK NOT_RUN.

## Elevation openings read as objects (STAGE BUILDPLAN-ANALYZER-005W-GOAL-DRIVEN-VISUAL-ITERATION)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005W_GOAL_DRIVEN_VISUAL_ITERATION.md`; ledger:
`research/analyzer-005w-visual-iteration/ledger.json`. Branch `analyzer/005w-goal-driven-visual-iteration-v1` from
`d2a6cb3`. Status `VISUAL_CANDIDATE_IMPROVED_OWNER_REVIEW_PENDING` (not owner-accepted).

- **New opening reader** in `openings-v2.ts`: an opening's vertical extent is read as an object against the wall. It
  takes the wall's per-row colour from the plan's solid stretches, requires a lintel and stays under the wall top. It
  is used only without a printed height, and only where the contrast reader read nothing or read part of the same
  opening.
- **N4 wall-band registration** feeds openings only, and is accepted per wall only where ≥ 2/3 of the gaps read on it.
- **N3 light glazing symbol** is used only for gaps with read heights.
- **A01 front:**
  - 250/220 → glazing 0–2.09
  - 100/220 → full-height glass
  - 105/210 → entrance door
  - 90/210 → full-height glass
- **A01 rear:** the terrace door now reaches the floor.
- **Controls:** Gozdzikowce, Rarytasy G2E and Cieszynianki are byte-identical. Marcówki has one side opening
  (timber door → glass).
- **Tests:** reconstruction 803/803; tsc clean. The APK-size gate is still red; CI/APK NOT_RUN.
- **Renders** are outside the repo (`/home/user/work005w/005w-renders.zip`).

## A01 attic gables and rooflights (STAGE BUILDPLAN-ANALYZER-005W-N1-A01-ATTIC-ROOFLIGHTS-VISUAL)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005W_N1_A01_ATTIC_ROOFLIGHTS_VISUAL.md`; ledger:
`research/analyzer-005w-n1-attic/ledger.json`. Branch `analyzer/005w-n1-a01-attic-rooflights-visual-v1` from
`224e429`. Status `PARTIAL_ATTIC_RECOVERY` (not owner-accepted).

- **Same-sheet storey plan frame:** a storey whose outer faces span the base plan's pixels on both axes (≤ 1 %) takes
  the base frame moved onto them. The A01 attic plan was on an 8 %-agreement wall-pair fit at 0.923 scale.
- **Side views placed by the openings:** both unlabelled side views are scored against the plan's side-wall gaps and
  swapped together only when each prefers it. A refused side view is registered on the same sheet as its mate (gable
  outline widths). For openings, side views are read at the front/rear sheet scale, with the ridge row on the gable
  apex from the outline.
- **Weak printed heights** (< 0.3 confidence, > 0.5 m off the elevation, no fitting candidate) no longer stand over
  the elevation. A gap nothing read follows its printed same-width sibling, marked ASSUMED_FOR_RENDERING.
- **Chimney cores:** a block a partition runs into keeps its ≥ 0.3 m core (chimneys only).
- **Rooflights** may come from a band view that passed the per-wall opening check.
- **A01 attic:** 4/4 gable windows tall and on the right walls: east `100/220` ×2 newly built, west #2 0–2.20.
  - Rooflights: 2 of 7.
  - Chimneys: 3, which matches front and rear; this is a deliberate change of the brief's "2 chimneys", pending the
    owner.
  - Front unchanged.
- **Controls:** Gozdzikowce, Marcówki, Cieszynianki and Rarytasy G2E are byte-identical; Rarytasy OWNER is NOT_RUN.
- **Wall tone:** it is now grey render (`readMassTones` unchanged). It reads the source's grey ground storey from the
  correctly placed east view; owner to judge.
- **Tests:** reconstruction 817/817; tsc clean.
- **Renders** are outside the repo (`/home/user/work005w-n1/005w-n1-renders.zip`, SHA-256 `0ed20537…`). The APK-size
  gate is still red; CI/APK NOT_RUN.

## Universal openings + one picture (STAGE BUILDPLAN-ANALYZER-005X-REV1)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005X_REV1_GENERIC_OPENINGS_MULTISOURCE_SINGLE_IMAGE.md`; ledger:
`research/analyzer-005x-generic-openings/ledger.json`. Branch `analyzer/005x-generic-openings-multisource-single-image-v1`
from `e9b9e3e`. Phase A `PARTIAL_GENERIC_OPENINGS_ADOPTED`, phase B `ENGINE_ONLY` (not owner-accepted).

- **Plan-first rooflights.** `readTintedCallouts` (source-metrics) reads faint callout rings on tinted knee-wall
  strips. `readPlanRooflights` places each coherent rooflight callout inside the roofed storey on its slope. Renders
  only corroborate.
- **A01 rooflights:** 2 → 6 of 7, matching the plan and the elevations. The missing one is under the watermark. The
  rest of A01 is unchanged.
- **Controls:** Gozdzikowce, Marcówki, Cieszynianki and Rarytasy G2E are byte-identical; Rarytasy OWNER is NOT_RUN.
- **One picture** (`single-image.ts`): deterministic CV turns a perspective picture into the same `BuildingV2`.
  - Eave segments as bodies, gables, `OpeningV2` on the front, rooflights.
  - Emitted as `MODEL ORIENTACYJNY Z 1 ZDJĘCIA`; every value is assumed or visual.
  - Owner's picture: 3 bodies, 3 correct openings + 1 false, 2 rooflights.
  - A second (publisher) picture: poor.
  - No app entry yet (ENGINE_ONLY).
- **Tests:** packages 1194/1195 (APK gate), new 7/7; tsc clean. CI/APK NOT_RUN.
- **Renders** are outside the repo (`/home/user/work005x/005x-renders.zip`).

## One photo: roof types, gables, gates (STAGE BUILDPLAN-ANALYZER-005X-N1)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005X_N1_UNIVERSAL_PHOTO_ROOF_OPENINGS.md`; ledger:
`research/analyzer-005x-n1-photo/ledger.json`. Branch `analyzer/005x-n1-universal-photo-roof-openings-v1` from
`7626403`. Verdicts: GENERAL_OPENINGS_PRESERVED, PHOTO_VISUAL_IMPROVED (two development pictures; hold-out 0/4),
APP_READY for BuildWorld web (ENGINE_ONLY for Android), OWNER_VISUAL_PENDING.

- **Plane roofs** (`v2/plane-roof.ts`): a body's roof as its own planes, each ridge end a gable or a hip. Emitted
  through `createRoofPlane`/`connectRoofPlanes`; walls follow the planes. The drawing path does not use it yet.
- **One picture:**
  - Roof ends are read: plateau, ramp, gable face, party, symmetry.
  - Cross gables are read and become a shallow body with valleys into the main slope.
  - Openings are found by texture: light gates, dark glass, the gable window above the eaves. A door-height prior
    sets the scale.
  - Rooflights are read over the whole roof.
  - The structure no longer depends on the JPEG decoder.
- **Owner photo:** hipped body and bay, cross gable, gate, entrance, arched window, 2 windows, 3/3 rooflights, 0 false
  openings.
- **A01 visualisation:** the eave is now at the gutter (005X had it at the white band), 4 openings, 3 rooflights.
- **Hold-out** (4 other houses): no usable model, refused by name.
- **`readTintedCallouts`** now runs only where a render shows a rooflight: 3 of the 5 controls skip it, and all five
  stay byte-identical. It is still too slow for a phone.
- **BuildWorld** has a "Photo…" entry: the picture is decoded in the browser and opens in the rotatable viewer.

## One photo without a light band; rooflights from the plan first (STAGE BUILDPLAN-ANALYZER-005X-N2)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005X_N2_PHOTO_GENERALIZATION_PLAN_FIRST.md`; ledger:
`research/analyzer-005x-n2-photo-generalization/ledger.json`. Branch `analyzer/005x-n2-photo-generalization-plan-first-v1`
from `28cc5ee`. Verdicts: PHOTO_GENERALIZATION_PARTIAL_DEV_ONLY, PLAN_FIRST_ROOFLIGHTS_FIXED (Android performance
NOT_READY), WEB_APP_PHOTO_ENTRY_UPDATED, ANDROID_ENGINE_ONLY, OWNER_VISUAL_PENDING.

- **One picture, in modes:** the N1 light-band reading first (unchanged, byte-identical on its pictures); then GENERAL:
  the covering grown by its own local colour (picture-wide and per-column hypotheses), eaves kept only over wall, any
  wall colour. Every reading states `mode` and `quality` (DETAILS_SUPPORTED with openings, COARSE_INDICATIVE without).
  A picture without sky over the house is refused before any mode.
- **Development pictures:** Goździkowce, Cieszynianki and Rarytasy G2E now give a closed indicative body (were refused);
  Marcówki (gable facing the camera) is still refused. Gates and doors on multi-finish fronts are often missed; a
  publisher's watermark gives a false rooflight on two of them.
- **Blind photos** (4 Commons photos, frozen before tuning): 0/4 correct. The outline mode (SILHOUETTE) built two wrong
  bodies from trees and mountains, so it is off by default (`outlineFallback`); final code refuses all four by name.
- **Plan first:** the attic plan's rooflight callouts are read whether or not a render shows a rooflight; test with
  plan-only callouts. The ring search has a pooled prefilter that cannot drop a ring (identical readings on four real
  plans), but OCR dominates: still 25-42 s per house on a desktop.
- **Controls:** A01 1661d4bf, Goździkowce 911456a8, Marcówki cf797743, Cieszynianki e4e56292, Rarytasy G2E 9f5fd342 —
  unchanged; Rarytasy OWNER NOT_RUN.
- **NON_MANIFOLD** (owner model): the bay's front wall with its window cut, under a pyramid roof; not fixed.

## A new publisher, WebP, and an exact rooflight OCR gate (STAGE BUILDPLAN-ANALYZER-005X-N3)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005X_N3_CROSS_PROVIDER_SIMPLE_HOUSE.md`; ledger:
`research/analyzer-005x-n3-cross-provider/ledger.json`. Branch `analyzer/005x-n3-cross-provider-simple-house-v1` from the
candidate `629a11d`. Verdicts: OCR_BAR_GATE_EXACT_ADOPTED (Android NOT_READY), NEW_PROVIDER_FAIL_NAMED,
SEGMENTATION_NOT_ADOPTED_RESEARCH_ONLY, OWNER_VISUAL_PENDING.

- **WebP:** `decodeImage` decodes WebP through libwebp (`@jsquash/webp`, WASM, synchronous in Node), bit-exact with libwebp.
  A plan served only as WebP was reported as a page "without a plan".
- **TeA AR-18 TREND P** (new publisher, test only): URL route now reads the plan but refuses on scale (dimension digits 7-9 px,
  below legibility; gates untouched). `Photo…` refuses both renders (clouds and trees are not sky). No model, no false model.
- **Rooflight callouts:** `readTintedCallouts({ requireBar })` returns exactly the full reader's barred readings and skips the
  OCR of barless rings that cannot claim a barred one (directly or through a chain). OCR 536 -> 148 on five plans; whole
  analysis 156-159 s -> 96 s for the five controls; all five models byte-identical; A01 6/7.
- **Segmentation:** licence audit; the only cleared model with roof/sky/vegetation classes (DETR-R50 panoptic ONNX) gives
  scrambled masks in its available export and costs 8.5-11.6 s and 1.1-1.4 GB on a desktop. Not adopted.
- **BLIND-N3** (4 Commons photos, frozen): 0/4 correct, 1 false model (default GENERAL mode).

## Five ARCHON houses, rendered for the owner: eaves, a hipped roof and liveness (STAGE BUILDPLAN-ANALYZER-005Y)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005Y_ARCHON_FIVE_HOUSE_VISUAL_CLOSURE.md`. Ledger:
`research/analyzer-005y-archon-visual/ledger.json`. Branch `analyzer/005y-archon-five-house-visual-closure-v1`, from
`a6dc724`. Verdict: **OWNER_VISUAL_PENDING**.

**Runs**
- All five houses ran the full production path offline, with the ORT recogniser: sealed package → observations →
  metrics → v2 → model → scene → verify.
- On the base commit this reproduces the 005X-N3 models byte for byte.
- On the final head, the full run and the solver replay give the same model for every house.

**Changes**
- **Eaves:** `readEavesOverhang` reads the eaves projection from the section, and it becomes the main roof's
  `overhang`.
  - A01: 0.91 m, corroborated by the printed +3.60.
  - Goździkowce: 0.90 m.
  - Cieszynianki: 0.90 m.
  - Marcówki and Rarytasy: none, as drawn.
- **Hipped main roof (v2):** Cieszynianki's page states a four-way roof. It is now built as a plane roof with an
  eaves projection, and the top-storey partitions follow its planes.
- **Render registration:** an extra span candidate that includes the section's eaves, accepted only at a ground
  error of 0.3 m or less. It was not taken on any final house.

**Models (before → after)**
- A01: 1661d4bf → 40ccaaae.
- Goździkowce: 911456a8 → 1856a617.
- Cieszynianki: e4e56292 → 9478c6d1.
- Marcówki and Rarytasy DEV: unchanged.
- Rarytasy OWNER m3ea: run for the first time from the 005R corpus cache, as a separate, unverified row (b7501212).

**Liveness**
- New ticks inside the tinted-callout search, the roof details and scene compile/verify.
- Longest silence on the desktop: 4.4–7.9 s before, 1.5–2.6 s after.
- Tests: a 12-minute healthy run, a 50 s silence and a cancel (TS), and a 12-minute heavy step (Kotlin).
- No time limit was added.
- Android: ANDROID_LIVENESS_NOT_DEVICE_VERIFIED.

**Named gaps**
- A01 depth is 8.008 m against the printed 830: the rear wall strip is read as a zone.
- A01 is missing its 7th rooflight: the ring is undetected.
- Goździkowce: 0/7 rooflights and no callouts read, because the template OCR misreads them.
- Cieszynianki: no garage door, no chimneys, no porches.
- Marcówki: the balcony door has a timber leaf.

**Research**
- Paddle on callout halves: 104/142 exact against the template's 63/142, and 71/71 confident readings correct.
- Recommended as the next step, gated by the plan's gap width.

## Source to feature: why the analyzer lost what a person sees (STAGE BUILDPLAN-ANALYZER-005Y-N1)

Report: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005Y_N1_SOURCE_TO_FEATURE_DEBUG.md`.
Ledger: `research/analyzer-005y-n1-source-to-feature/ledger.json`.
Branch `analyzer/005y-n1-source-to-feature-debug-v1`, from 005Y `98df11f`. Verdict OWNER_VISUAL_PENDING. Not ALL_GREEN: the tracked-APK > 32 MB gate stays a known failure.

What changed:
- **Plan callout rings are read by the pinned recogniser in the metric phase** (`callout-recogniser.ts`, schema 1.9.0 `calloutRings`).
  - Gate: both halves stable and confident (posterior and mean ≥ 0.9), the model's own answer, 2–3 digits, no unread glyph (refuses 118→18, 105→5), an opening's size.
  - A half refused only by the bracket is taken when a sibling ring on the sheet reads the same pair outright.
  - Tinted-only rings feed roof windows, not opening callouts.
  - Without a recogniser the set is byte-identical.
- **A section with no ladder is registered for chimneys only, by two anchors**: the slab span against the plan, read through watermark gaps, and two printed levels.
  - A single-storey chimney stands where the section draws a stack above its drawn roof line.
  - A chimney no longer forces a hipped roof back to a gable: its penetration is cut plumb in its plane.
- `verify.ts` no longer moves an assumed sill alone under a printed height.
- `FEATURE_DEBUG` trace (`featureTrace`): write-only, hashes unchanged.

Five full offline production runs with PaddleOCR (model before → after):

| house | before | after | change |
|---|---|---|---|
| a01 | 40ccaaae | be796f9f | printed opening sizes |
| gozd | 1856a617 | 68d6f2e7 | rooflights 0 → 7, printed opening sizes |
| marcowki | cf797743 | bf80f455 | geometry unchanged |
| ciesz | 9478c6d1 | f512a136 | chimneys 0 → 2, hip kept |
| rary | 9f5fd342 | 3f0f7183 | east heads 2.9 → 2.3, front sizes |

Longest heartbeat silence ≤ 2.6 s; runs 20–35 % longer.

Still open, each with its first bad step in the report:

| house | open item | first bad step |
|---|---|---|
| gozd | 7 ground callouts | precision gate |
| gozd | ridge +8.36 and elevations | section text |
| a01 | 7th rooflight | ring on a bed drawing |
| a01 | depth 8.30 | layout |
| ciesz | garage door | garage wall line |
| ciesz | porches | layout |
| ciesz | elevation silhouettes | roof missing from the silhouette |
| marcowki | entrance read as a window | family cascade, weak swing test |
| rary | rear 230/230 | gate |
| rary | phantom 471/71 | ring detector |
| OWNER m3ea | not touched | — |

## Shared primitives across houses: corners, frames, chimney hosts, weak heights (STAGE BUILDPLAN-ANALYZER-005Y-N3)

Status: **PARTIAL_SOURCE_GROUNDED · OWNER_VISUAL_PENDING**. Branch `analyzer/005y-n3-cross-house-architectural-primitives-v1`
from `e1806e0`; report `stage-reports/STAGE_BUILDPLAN_ANALYZER_005Y_N3_CROSS_HOUSE_ARCHITECTURAL_PRIMITIVES.md`, ledger
`research/analyzer-005y-n3-architectural-primitives/ledger.json`. Each rule was checked on another house or an ARCHON
analog (Trytomy, Arganie, Sasanki 3; Melisa 2 refused by the plan reader) before it was taken.

| Primitive | Where | Effect on the five houses |
|---|---|---|
| A wall behind a gable frame reaches the roof plate (strip boundary read inside the wall) | `geometry/compile.ts`, `wall-compiler.ts` | Marcówki: the triangle under both eaves gone; no other mesh changes |
| Door convention needs no glazing by either symbol | `openings-v2.ts` | Goździkowce corner-window piece, Cieszynianki 2 × 90/150: DOOR → WINDOW |
| Corner assembly (`cornerAssemblies`, `ALIGNS_WITH` CORNER_GLAZING) | `openings-v2.ts`, `emit.ts` | A01, Goździkowce, Cieszynianki; geometry unchanged (corner square stays wall) |
| Chimney against the roof covering its block (`hostRoofTopAt`) + plumb cut in attached planes | `roof-details.ts`, `emit.ts` | Rarytasy DEV chimneys 1 → 2; A01 chimney/wall overlap stated |
| Storey common head over a weak printed height (`commonHeadReading`) | `openings-v2.ts` | Rarytasy rear glazing 230/290 → 230/230 (as printed) |
| Silhouette views off the printed terrain not read for opening heights (`viewGroundRefusals`) | `openings-v2.ts` | Rarytasy garage window sill 1.48 → 0.80 m |

Model hashes (first 16): A01 `2ebcf05b9bdb3120` → `d67a026f8cf93dff`, Goździkowce `869774d095b76fcb` → `b0eb6d82ae56b327`,
Marcówki `124e5abc5e6959d8` (unchanged; scene changed), Cieszynianki `2ac1ed37c1af60c0` → `4de216ed46550423`, Rarytasy DEV
`3f0f71833f035914` → `f6886fd278755ee5`. Rooflights (A01 6, Goździkowce 7), chimneys (A01 3, Cieszynianki 2) and roof kinds
unchanged; NON_MANIFOLD 0; no new GAP/INTERSECTION; A01 INTERSECTION 2 → 0. Max heartbeat gap 2.93 s.

Unresolved, named: Marcówki stair (landing 0.30 m into the east wall; partitions under the flight at full height — all 7
INTERSECTIONs; needs a stair-soffit top profile or the stair layout in reconstruction); Rarytasy entrance door opening
outward still a window; side-view registration itself; phantom 421/71; chimneys lost for want of a registered side view
(Arganie, Trytomy); corner posts kept by the model invariant; OWNER m3ea NOT_RUN.
