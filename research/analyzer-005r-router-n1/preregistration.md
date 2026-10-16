# BUILDPLAN-ANALYZER-005R-ROUTER-N1-ADOPT — preregistration

Committed **before** the candidate runs on any development row, anchor or blind house, and before any candidate output
on real data exists. Runs before this commit: the incumbent only (`R0ctl`, 3 rows, `audit.md` §6) and the candidate's
**synthetic** unit tests during its development (`audit.md` §4). The prior 005R-ROUTER P4′/P5′/P7′ notes are used as
hypothesis sources only; nothing measured in 005R-ROUTER counts as a pass here. Later changes to this file are not
allowed; additions go to dated ADDENDA below and **cannot** establish adoption.

## 0. Identity

| item | value |
| --- | --- |
| base | `0f2c347c0be03a32510f1e54460eab6fdf1b65a5` (`analyzer/visual-source-role-guard-v1` = mirror `claude/new-session-3kzcgh`) |
| stage branch | `analyzer/visual-source-projection-guard-adoption-v1` |
| base production files (sha256) | `analyze.ts` e9b13130…d4ef · `tasks.ts` 31d7f811…7d86 · `apply.ts` a87185d6…6e48 · `mutations-02.test.ts` d26eded4…86ac · `vision.test.ts` cd4528a5…cab3 |
| candidate **N1v** | `candidate/n1v-production.patch` sha256 `3419b08e911101c3584b00708853f9a43adf7a380911c133202a1b7ecb4534d0` (staged N1 `production-gate-with-tests.patch` a45d0a28…47bb + the one shared predicate on the vision route, `audit.md` §4) |
| harness (sha256) | `run-case.ts` cc8203f3…dbb · `replay.mjs` 143fc5d2…ec74 · `variant.mjs` 58b7b986…05f6 · `ledger.ts` a5a4cfe9…c032 · `compare_n1.py` 8bcb3c08…3ddb · `selftest_compare.py` d4486a7a…a7 · `p8_n1.py` (hash in the commit of this file) · `mutations.mjs` ef25ee12…0af0d · `freeze-manifest.mjs` ea3c721d…a970 · `build-exclusions.mjs` 5aea4591…e11f · 005R-ROUTER `p9_mislabel.py` d5e18715…5ed2 |
| executors | Node 22.22.2 (all replays, focused tests), Node 18.20.4 (`/home/user/work005g/node18`, embedded-compatible focused route), vitest 3.2.7, Python 3.11.15 (`-I`) |
| sealed baseline | 005R-ROUTER R0 ∪ R0fix (R0fix overrides on its 6 rows) and R0rev, hard-linked into `work005r-n1/runs-prior`, `prior-runs.sha256` digest `0c19df4679d71a9992f0e7c3d02d149b5cd16c4c65526b93484a651c11c61f9f` (584 files); its 18 ledger dumps (14 R0 + 4 R0fix) in `work005r-n1/ledger-prior`. Reuse is justified by: production code identical to the 005R-ROUTER base; `R0ctl` byte-identical on 3 rows (`audit.md` §6). |

## 1. Question and wording

Can **one** projection-aware routing policy (`readsAsFacade`) keep perspective pictures, interior or exterior, out of
the orthographic facade readers — deterministic **and** vision — without changing any orthographic evidence, model,
typed refusal or camera? N1v classifies no scene, relabels no role, adds no enum, no geometry, no OCR/scale change.
A perspective frame stays declared (its raster still solves a camera; the image asset stays traceable for future
visual work); it simply carries no facade claim and one named refusal.

## 2. Variants

| id | what |
| --- | --- |
| R0 | base code (sealed 005R-ROUTER runs; `R0ctl` fresh control on 3 rows) |
| R0rev | base code, reversed row order (sealed) |
| **N1v** | `variant.mjs setup --rev 0f2c347 --patch candidate/n1v-production.patch` (copies and aliases `source-analyzer` **and** `source-vision`); working tree stays at base during every replay |
| **N1vshuf** | N1v, reversed row order **and** each package's asset list shuffled, seed `N1-ADOPT` (`--order reverse --shuffle N1-ADOPT`) |

## 3. Tiers and cases (FAST CI budget)

- **Tier A (minutes; working tree carries the patch only while no replay runs):** `packages/source-analyzer` and
  `packages/source-vision` vitest suites; the mutation run (§5); the comparator self-test on R0 rows
  (`selftest_compare.py`, marcowki, rarytasy-g2e, A00).
- **Tier B (anchors, N1v only, 5 rows, par 3):** `marcowki` (Marcówki, balcony, 3 solved cameras), `dom-pod-jarzabem`
  (Jarząb, porch), `rarytasy-g2e` (Rarytasy G2E-5 edition, 25 perspective assets, the bathroom render — perspective-
  heavy), `kosacce-clean` (technical-elevation control, 19 perspective assets), `A00` (typed refusal, 14 perspective
  assets). P1–P6 on each; a failure stops the stage at Tier B (`NO_SAFE_ADOPTION`).
- **Tier C (once):** N1v on all 37 rows (the 5 Tier-B rows are **not** rerun; their Tier-B outputs are the N1v rows),
  then N1vshuf on all 37, then `ledger.ts` on N1v for the 18 camera rows; P1–P10 on all. No parameter sweep, no rerun
  of a row except a harness crash before any output (logged).
- DEV rows: the 37 `EXTRACT` rows of `research/analyzer-005q-chain/cases.json` on ARCHON hosts (DobreDomy refused by
  the harness). All are prior exposure.

## 4. Predicates — all HARD; one failure on one row ⇒ `NO_SAFE_ADOPTION`

Implemented in `compare_n1.py` (P1–P7) and `p8_n1.py` (P8) at the hashes above.

- **P1 model / refusal.** Model rows: `model.json` byte-identical (23 rows). Refusal rows: identical `code`,
  `reasonCode` and `message` (14 rows); the relied-on source is the graph, covered by P2/P4′.
- **P2 orthographic preservation.** Frame list (ids, roles incl. `variantByteHash`, sizes) identical; on every frame
  that is not a refused perspective frame, the observation set (id + full content) identical. Plus synthetic, in
  Tier A: the same pixels filed as `ELEVATION` give facade observations; an `ELEVATION` sealed with projection
  `PERSPECTIVE` is never refused; a `PERSPECTIVE_RENDER` declared `ORTHOGRAPHIC_ELEVATION` is read (deterministic and
  vision), with the decision visible as the absence/presence of the named refusal.
- **P3 metric evidence content.** Model rows: `metric-evidence.json` identical after blanking identity-carrying keys
  (`id`, `contentHash`, `observationGraph*`, `metricEvidence*`, `structuralLayout*`, `hypothesisSet*`, `featureGraph*`).
  Refusal rows: **NOT_MEASURED** (no content is kept); never reported as PASS.
- **P4′ complete graph-diff accounting.** "Refused perspective frame" := `document = PERSPECTIVE_RENDER` and
  `projection ≠ ORTHOGRAPHIC_ELEVATION` (in R0's graph). Every difference R0→N1v must be one of the typed changes:
  T1 an observation on a refused perspective frame removed; T2 a relation removed with an endpoint among T1;
  T3 an unresolved gap removed whose `assetId` is a refused perspective asset and which is not a pre-gate gap
  (`the bytes of asset`, `the raster of asset`) — reported by category (VISION_FACADE_GAP, FOUND_NOTHING_GAP,
  EXTRACTOR_GAP_<status>); T4 exactly one `NOT_ATTEMPTED` "facade observations on the perspective render <assetId>"
  per refused perspective asset; T5 a `cv.*` extractor declaration removed only on a row with no frame that
  `readsAsFacade`; T6 a conflict removed only if it names a T1 observation. Anything else — any added observation,
  relation, gap or extractor, any changed frame or top-level field, any orthographic observation or gap removed, any
  observation left on a refused perspective frame, any refused asset without its refusal — counts as **unexpected**;
  P4′ requires **0 unexpected** and T4 count = refused perspective assets, on every row (models and refusals).
- **P5′ semantic summary (model rows).** Strip exactly `CLOCK_FIELDS = {recogniser.ms}` (fixed from the incumbent
  alone: the only leaf differing between R0 and R0rev on 23/23 rows). Identity fields `observationGraphHash`,
  `metricEvidenceHash`, `candidateHash` are excluded **only** because P4′, P3, P6 compare their content.
  `counts.observations` must equal R0's minus the row's T1 count. Every other field identical. **If any other field
  differs between R0 and R0rev, or between N1v and N1vshuf, the stage stops; the list is not extended.**
- **P6 candidate content.** `candidate.json` identical after the same blanking as P3 (same steps, traces, camera step
  detail). No `SOURCE_EXACT` can come from a perspective frame (P1 + P4′: no facade claim exists on one).
- **P7′ determinism (same normalisation for both pairs).** Byte identity of model, failure, graph, metric evidence and
  candidate, and summary identity after stripping `CLOCK_FIELDS` only: R0 = R0rev on 37/37 (sealed) **and**
  N1v = N1vshuf on 37/37.
- **P8 ledger + cameras** (18 rows with ≥ 1 solved camera in R0; all 18). Per row: solver model hash identical;
  cameras identical (frame, solved, residual), solved total equal to R0's (67 measured, not a target); ledger and
  feature-graph violations identical in content (the pre-existing G2E-5 graph violation stays, none added); 0 records
  added; every removed record names evidence on a perspective frame in R0; 0 `USED_AS_CORROBORATION` records on
  perspective evidence remain. The number of removed `USED_AS_CORROBORATION` records is reported, never targeted.
- **P9 elevation / edition negatives.** (a) `p9_mislabel.py` recomputed: structural elevations of the 005R corpus filed
  `PERSPECTIVE_RENDER` = 0 of 198 (accounting only; publisher structure, not scene truth); (b) DEV: every one of the
  146 `ELEVATION` frames unchanged (P2) and 0 refused; refused frames are exactly the 403 `PERSPECTIVE_RENDER` frames,
  each with an unchanged role (no frame is relabelled interior); (c) editions: frames carry `variantByteHash`; P2's
  frame identity per row means no asset crosses an edition (rarytasy-g2e and rarytasy-eoze compared separately).
- **P10 coverage and runtime.** (a) 37 rows with ≥ 1 refused perspective frame and 18 camera rows exercised, else
  `NOT_MEASURED`; (b) Node 22: both focused suites green with the patch; Node 18.20.4: the same two suites green with
  the patch; (c) runtime: on model rows, median of per-row ratio N1v/R0 observation-phase ms ≤ 1.10, and max peak RSS
  N1v ≤ 1.15 × max peak RSS R0 (both measured under the same `par 3` load as R0); (d) code size: the patch adds ≤ 4 KiB
  to production source (`git diff --stat`), and `npm run build` succeeds once with it; (e) ARM64 physical: PENDING.
- **V vision-path gate.** With a local mock provider that would answer any facade question (no network, no key, no
  publisher pixel): a perspective picture, interior or exterior, is never offered for FACADE_DECOMPOSITION and no
  vision observation lands on it; the same pixels filed as `ELEVATION` are offered and their answer lands; a render
  declared orthographic is offered; with the null reasoner (product default) the refused asset carries exactly one
  gap (the refusal); the apply boundary refuses a facade answer on a perspective frame and lands the same answer on
  the same bytes filed as an elevation. All in Tier A tests; plus M7/M8 killed (§5). `ANALYZER_VISION=live` reaches
  the analyzer only through `runAnalysis` → `analyzeSourcePackage` (the only `VisionReasoner.analyze` call site),
  which these tests exercise directly.

**Hard negatives (each mapped):** patio/pergola/carport/garage/balcony/porch/railing/stair/roof/window/opening
geometry — P1 on the 23 model rows (Marcówki balcony, Jarząb porch, G2E-5, e-OZE, Głogowniki, Dalie included); G2E vs
G2E-5 / editions not merged — P9c; view angle never guessed as orthography — the predicate reads only the declared
role, P2 synthetic; perspective images remain inspectable — frames stay declared (P2 frame identity), refusal named
(P4′ T4); no new `USED_AS_CORROBORATION` — P8 0 added; `UNKNOWN`/interior/exterior never promoted to `SOURCE_EXACT` —
P1/P4′ (no observation is added anywhere).

## 5. Mutations (Tier A)

`mutations.mjs`: M1 no gate (projection bypass), M2 document-only gate (orthographic render evidence deleted), M3
elevations gated (technical facade lost), M4 false `MISSING`, M5 silent skip (no typed refusal), M6 gate everything
(over-broad drop) — the six 005R-ROUTER mutants re-anchored — and two new ones for the uncovered vision path: M7
vision routing **and** apply guard reverted (facade answers land on perspective frames, which the ledger would call
corroboration), M8 apply guard removed. Requirement: **8/8 killed by a behavioural assertion** (not an import or
transform failure).

## 6. Reviews (lean)

After Tier C and before the production decision: two concurrent reviewers — (R-A) source/semantics + provenance,
(R-B) adversarial gates + vision path. One disposition round. A reproduced P0/P1 must be fixed before adoption; if the
fix changes code that a sealed predicate measured, the stage stops `NO_SAFE_ADOPTION` (no new experimental round).

## 7. Decision rule (fixed now)

1. Any failed P1–P10 or V on any row/test, any surviving or non-behavioural mutant, or an unresolved reproduced P0/P1
   ⇒ **NO_SAFE_ADOPTION**; production files stay byte-identical to base; no CI mirror push
   (`CI: NOT_RUN_FAST_CI_RESEARCH_ONLY`).
2. All pass ⇒ apply the patch to production once (same bytes as the candidate, verified by hash), Tier 2 gates
   (`npm run typecheck`, one `npm run build`), commit, push the **stage branch only** = `PRE_HOLDOUT_13_SHA`, freeze
   manifest, then BLIND_13 exactly once (§8).
3. BLIND_13 FAIL ⇒ **NO_SAFE_ADOPTION**: the production commit is reverted on the stage branch (a revert commit, no
   history rewrite), no mirror push. TARGET_NOT_EXERCISED or BLIND NOT_RUN ⇒ **PARTIAL**, no adoption claim, no
   mirror push.
4. BLIND_13 PASS ⇒ report + PROJECT_STATUS, one commit, freeze check that production is unchanged since
   `PRE_HOLDOUT_13_SHA`, one fast-forward of `claude/new-session-3kzcgh`, wait for that one full CI run. Green ⇒
   **ADOPTED_SAFE_ROUTING**; any red job ⇒ **PARTIAL** (`PARTIAL_CI_UNRELATED_ANDROID_UI_RACE` if it is the known
   Compose job), no rerun.
5. Wording if adopted: "projection-aware routing: orthographic facade readers (deterministic and vision) no longer
   run on perspective pictures; model, refusals, orthographic evidence and cameras byte-identical on 37/37 DEV rows and
   the blind; no scene is classified". Not an interior detector, not a 3D improvement. `HUMAN_TRUTH: NOT_RUN`.

## 8. BLIND_13 (only via rule 7.2)

- Pool `holdout/pool.txt` (`800c2a1e…2ed41`), less `holdout/excluded-families-round-13.txt` (149 families, sha256
  `2bd5fe03003c4f066b422b5c001c1cdd0ae9c0126c4c5b0865b5b235a6553141`, built by `build-exclusions.mjs`: round 12's
  list, every drawn family in `LEDGER.ndjson`, every sealed development package's family, every ARCHON project named
  in tracked research/report text, every project linked from the cached 005R corpus pages); 1 454 addresses remain.
- Label `BUILDPLAN-005R-ROUTER-N1-ADOPT-HOLDOUT`, round 13 in `holdout/select.mjs`, seed
  `SHA256(PRE_HOLDOUT_13_SHA + label)`, two unstratified picks exactly as rounds 11–12 (`i1 = seed mod n`,
  `i2 = SHA256(seed + ":second") mod m` over every other family). `select` refuses unless HEAD = the declared SHA,
  the tree is clean and the pool hash matches. The draw is burned once written.
- Each house: acquired once, live, by the frozen code (`analysis:second-house`, robots-respecting, cache and output
  outside Git); then R0 (variant at the base revision, unpatched) and N1v (frozen tree) through `run-case.ts` on the
  sealed package and the same byte cache; `ledger.ts` on both when R0 solves ≥ 1 camera.
- **Blind predicates per house:** P1, P2, P3 (model) / NOT_MEASURED (refusal), P4′, P5′ (model), P6 (model), P8 (if a
  camera is solved; otherwise reported `NOT_EXERCISED`). **Coverage:** ≥ 1 refused perspective frame, else
  `TARGET_NOT_EXERCISED` for that house. Verdict per house; BLIND_13 PASS iff both houses pass every applicable
  predicate and both are exercised. Sealed before any diagnosis; no patch, no retry after the draw.
- Nothing from the blind houses is committed except ids, counts, hashes and verdicts.

## 9. Data, privacy, licensing

ARCHON DEV caches already on disk; the only new acquisition is the two blind pages. No DobreDomy access, no raster
or caption into Git, no pixel to any remote model (the mock provider is local and synthetic). `SOURCE_NOT_USABLE`
flags of earlier protocols are kept as historical risk classifications.

## ADDENDA

**A (2026-10-15T22:21Z, after Tier A, before any N1v replay; harness only, no predicate touched).** `variant.mjs`
links the workspace `node_modules` into the variant copy: the copied `source-vision/src/schema.ts` imports `zod`, which
cannot resolve from outside the repository. Every `@buildapp/*` import stays aliased (the alias wins; realpath is the
workspace's, so one module instance). Probe: through the variant config `tasksForRoles` exists and returns `[]` for a
perspective render (it does not exist at the base). New `variant.mjs` hash recorded in the commit carrying this
addendum. Tier A results at that moment: Node 22 focused 91/91, Node 18.20.4 focused 91/91, mutations 8/8 killed by
behavioural assertions (`stage-reports/artifacts/analyzer-005r-router-n1/tier-a/`).

**B (2026-10-15T23:39Z, after P1–P6 and P8 were scored on DEV, before N1vshuf finished; reported only, never a
predicate, cannot change any verdict).** P8 found `featureGraphHash` different on 18/18 rows while every P8 predicate
held. `reconstruction/src/v2/graph.ts:228-229` seals that hash over `observationGraphHash` and `metricEvidenceHash`,
both identity-carrying, so the difference is expected by construction. Diagnostic `feature-graph.ts` / `fg-run.sh`
dumps the feature-graph content with those two inputs (and the hash) removed, for R0 (base tree, sealed run outputs)
and N1v (variant), on the 18 camera rows; the result is reported as `featureGraphContentEqual` per row. It runs
concurrently with N1vshuf, whose timings are not a predicate.

**C (2026-10-16, after Tier C and the one review round, before PRE_HOLDOUT_13_SHA; harness and tests only, no predicate
touched).** Results at this point: P1 37/37, P2 37/37, P3 23/23 (+14 NOT_MEASURED), P4′ 37/37 with 0 unexpected,
P5′ 23/23, P6 23/23, P7′ R0=R0rev 37/37 and N1v=N1vshuf 37/37, P8 18/18 (67/67 cameras), P9 0/198 + 146/146
elevations unrefused, P10 runtime median 0.84, RSS 1.08×, +2 544 source bytes, Node 22 and Node 18 focused 91/91,
V and mutations green. Review dispositions in `stage-reports/artifacts/analyzer-005r-router-n1/reviews/dispositions.md`.
Changes: (1) R-B #1 — `blind.mjs` refuses an existing house directory, pins `compare_n1.py` 8bcb3c08…3ddb,
`p8_n1.py` cf676507…a035, `run-case.ts` cc8203f3…dbb, `ledger.ts` a5a4cfe9…c032, `variant.mjs` d29313cc…fe80, and
stops fail-closed on any non-zero step; `blind.mjs` sha256 `6a963f0b1dc46a31d268583427a9c34f2195f9a861ce4fb14a897a642d117f9c`.
(2) R-B #2 — `holdout/select.mjs` refuses a second draw under a round ≥ 13 label (sha256 `c20dd96f…e3ba`).
(3) R-B #3 — one assertion added to `vision.test.ts` (apply boundary lands an answer on an ELEVATION sealed
PERSPECTIVE) and mutant M9 (9/9 killed behaviourally). The production patch is
`candidate/n1v-production-final.patch` (`f296551d…1c45`): its three `src` hunks are byte-identical to
`n1v-production.patch`, and the tree's `source-analyzer/src` and `source-vision/src` are byte-identical to the
DEV-measured variant. Rule 7.2 is reached: the patch is applied to production, and this commit is pushed to the
stage branch only as `PRE_HOLDOUT_13_SHA`.

