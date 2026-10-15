# BUILDPLAN-ANALYZER-005R-ROUTER — preregistration

Committed **before** any candidate (R1, R2, N1) is run on any development row and before any candidate output is
looked at. The only runs before this commit are the incumbent R0 (base code, unmodified) and one smoke row of R0.
Base `8d414567e16e9a790bcf56cbebc10d778c6eb268`; freeze start
`stage-reports/artifacts/analyzer-005r-router/freeze/production-freeze-start.json`.

Inputs to this document: the audit (`architecture/first-bad-and-consumer-map.md`), the contract map, and a
skeptical verifier's review of the N1 proposal (`reviews/pre-skeptic.md`; its P1 findings are folded in below and
marked **[S-n]**). A code critic's review runs in parallel; any change it forces is recorded as an addendum, never
as an edit of this file.

## 1. Question

Can the analyzer stop writing orthographic facade observations on perspective pictures (interior visualisations
among them) **without** any change to the canonical model, to any orthographic frame's evidence, or to the metric
evidence — and is any scene-classifying router safe to adopt on the evidence that exists?

## 2. Variants

| id | what | production? | truth it needs |
| --- | --- | --- | --- |
| **R0** | the base code, unmodified (`replay.mjs`, no `--config`) | incumbent | — |
| **R0copy** | the base `source-analyzer/src` through the variant alias, unpatched | harness control | must equal R0 byte for byte on the control rows |
| **R1** META-PROVENANCE | `r1_meta.py`: typed page witnesses per 005R corpus asset (carousel position, header, elevation tab, caption room words, styling words, `widok`), one independence class per publisher filing act; output INTERIOR_HINT / EXTERIOR_HINT / CONTESTED / UNKNOWN proposals | **research only**, never production | none for running; it cannot be scored (its INTERIOR/EXTERIOR evidence is the 005R truth channel: circular) |
| **R2** GATE-ONLY (scene) | skip the facade extractors on a perspective frame **only if** its interior scene is confirmed by two claims from **different** independence classes | would be production | **real scene truth**; the only admissible classes today are PUBLISHER_GALLERY and PUBLISHER_PAGE; pixels are inadmissible (005R V1 A1 shortcut, V2 constant); HUMAN is NOT_RUN |
| **R2w** (diagnostic) | R2 with a single PUBLISHER_GALLERY witness (structure-interior by byte hash in 005R `role-truth.json`) | **never** adoptable (one witness) | — ; run only to bound R2's effect |
| **R3** METADATA+FORMAT-ROBUST CV | **NOT_RUN**: no new measured content signal exists; V1 is barred (A1), V2/OWL-ViT barred (005R NO_SAFE, licence unresolved); no new weights in this stage. Replaced by N1 (brief §5). | — | — |
| **N1** PROJECTION-CONSUMER GATE | `N1-projection-gate.patch` on `analyze.ts`: a `PERSPECTIVE_RENDER` frame whose projection is not `ORTHOGRAPHIC_ELEVATION` is fetched, decoded and declared as before, gets **no** facade extractor run, gets **one** typed `NOT_ATTEMPTED` gap naming it and one `skipped` entry, and does **not** get the "found nothing" `MISSING` gap **[S-3]**. `ELEVATION` frames are untouched (their branch is not gated on projection at all). Vision tasks unchanged. | would be production | none for its decision (it reads the projection the role already states); its safety claims are bit-level (§4) |

**Predicted R2 coverage (stated now):** 0 frames. No perspective frame in the corpus has two different-class scene
witnesses (the R1 count `assetsWithTwoIndependentSceneClasses` will measure this). If that holds, R2 ≡ R0 in
behaviour and is reported as `RUN — gates nothing` rather than as a candidate.

## 3. Data

- **DEV rows:** the 38 EXTRACT rows of `research/analyzer-005q-chain/cases.json` on USABLE hosts (37 ARCHON + 1 same-
  edition reprint). DobreDomy rows (D00–D05, aster-viii, galaktyka) are excluded as `SOURCE_NOT_USABLE` though their
  bytes are cached. Every DEV row is prior exposure; Rarytasy (g2e = G2E-5 `m84f…`, e-OZE) are DEV, never blind, and
  OWNER's anchor `m3ea28300f9b3e` has no package (UNAVAILABLE).
- **Corpus for R1 / R2w / spot review:** the 005R corpus already on disk (50 ARCHON editions, 1 352 assets) with its
  committed structural truth. It is DEV / prior exposure in its entirety, C1/C2/C12 included.
- **No new network fetch** for DEV. A fresh blind (§7) is the only new acquisition.

## 4. Predicates for N1 (all must hold on every DEV row; a single failure is NO_SAFE_ADOPTION)

Per row, R0 vs N1, both run with the same harness (`run-case.ts`, OFFLINE, recogniser on, Node 22):

- **P1 model:** `model.json` byte-identical; for a typed failure, the same `code` and `reasonCode`.
- **P2 orthographic evidence:** for every frame whose projection is `ORTHOGRAPHIC_*`, the set of observations
  (id + full content) is identical; the frame list (ids and roles) is identical.
- **P3 metric evidence:** `metricEvidenceHash` identical.
- **P4 graph diff is exactly the gate:** observations removed ⊆ observations on frames with projection
  `PERSPECTIVE`; on those frames N1 has 0 observations; added `unresolved` entries = exactly one `NOT_ATTEMPTED`
  "facade observations on the perspective render …" per perspective asset; removed `unresolved` entries ⊆ the
  "found nothing" `MISSING` entries of perspective assets; intra-frame relations removed ⊆ relations whose ends are
  on perspective frames; extractor declarations may differ only by `cv.*` facade extractors when no ELEVATION frame
  exists. **[S-4]**
- **P5 summary:** every field of `summary.json` other than `observationGraphHash`, `candidateHash`,
  `counts.observations` is identical (warnings, unresolved, quality levels, counts, model/scene hashes).
- **P6 candidate:** in `candidate.json`, only `observationGraphHash`, `observationGraphId`, `contentHash`, `id` may
  differ; `steps` (including the perspective-camera step detail) and `traces` identical; `hypothesisSetHash`
  identical. **[S-4]**
- **P7 determinism:** R0 = R0rev (row order reversed); N1 = N1shuf (row order reversed **and** each package's asset
  list shuffled, seed `005R-ROUTER`) byte for byte on model, graph, summary **[S-5]**; R0copy = R0 on the control rows
  `marcowki`, `rarytasy-g2e`.
- **P8 ledger:** `ledgerViolations` 0 in N1. The full ledger is not exposed by the product summary; its diff is
  measured by a separate solver replay (`ledger.ts`) on the two graphs for every row with ≥ 1 solved perspective
  camera, and must be ⊆ evidence ids on perspective frames.
- **P9 elevation-mislabel risk [S-2]:** count `PERSPECTIVE_RENDER` assets whose bytes the 005R structure places in
  the elevation tab (`ELEVATION_MISLABELLED_RISK`), over the 005R corpus and over the DEV packages. The base
  measurement already in 005R (`V0a-routes.json` × `role-truth.json`) is 0 of 198 structural elevations; it is
  recomputed by script. A non-zero count blocks adoption unless those frames are shown to be unregistered (P1/P2 then
  cover them).
- **P10 coverage:** at least 30 DEV rows with ≥ 1 perspective frame and at least 5 rows with ≥ 1 solved perspective
  camera in R0; otherwise the result is NOT_MEASURED, not PASS.

**Reported, not vetoing:** observations removed per row and by kind; time of the observation phase; peak RSS.
Scene-denominated numbers (how many of the removed frames are interiors) are reported only with the label
`PUBLISHER_STRUCTURE (circular, not truth)`. **[S-1]**

## 5. Hard vetoes (brief §6) and how each is measured here

| veto | measurement |
| --- | --- |
| zero new false confident exterior claims | N1 graph observations ⊆ R0 graph observations (P4) |
| zero increase interior→exterior | 0 facade observations on any PERSPECTIVE frame in N1 (P4); scene truth NOT needed for "0 on all" |
| zero loss of verified technical elevations | P2 on every ELEVATION frame + P9 |
| zero regression of known-good models / windows / balconies / porches | P1 on all 38 rows, the 005Q-CHAIN negative cases (Marcówki balcony, Jarząb porch, Rarytasy G2E-5, Głogowniki, Dalie) included |
| zero cross-edition contamination | N1 reads one package; no cross-package input (code); R1/R2w count lineage groups spanning editions |
| 0 new SOURCE_EXACT from a render | P1 |
| 0 use of SOURCE_NOT_USABLE | `replay.mjs` host allowlist; blind pool ARCHON only |
| 0 JSON / provenance violations | graph validated by the service (a violation throws); P4; no false MISSING [S-3] |
| deterministic | P7; Node 18 parity on 3 rows |

A veto not measurable with the evidence is `NOT_MEASURED`, never PASS.

## 6. Decision rule (fixed now)

1. If any of P1–P9 fails on any row, or P10 is unmet: **NO_SAFE_ADOPTION** for N1; production unchanged.
2. If P1–P10 hold and the code critic and the post-implementation reviews leave no open P0/P1: N1 may be adopted as
   `GUARDED_ROLE_GATE` (the one allowed change), with tests, and a fresh blind (§7) is required for `PASS`.
3. If the blind cannot run (no lawful unseen family, network, or coverage), the stage is at most **PARTIAL** and the
   blind is `BLIND_NOT_RUN`; N1 is then adoptable only as already measured on DEV, and is reported as such.
4. R2 is adoptable only with two different-class witnesses on real scenes; with HUMAN NOT_RUN and pixels
   inadmissible it cannot be adopted in this stage, whatever R2w shows.
5. R1 is never adopted to production in this stage (it would need an adapter + schema change and human truth).
6. Wording: N1 is "projection-consumer alignment: the analyzer no longer runs orthographic facade extractors on
   perspective frames; the canonical model is byte-identical on N/N rows; no scene is classified". It is **not** an
   interior fix, a 3D improvement, or a router accuracy. `NO_SAFE_VISUAL_CANDIDATE` (005R) stands. **[S-10]**
7. Disclosed limits that do not block: the vision path still requests facade decomposition on perspective renders
   (`tasks.ts:38`; off in every product path) and FB-3's ledger wording remains in code for that path **[S-6]**; the
   analyzer version strings are display-only, no production cache keys on them (`run.ts:48,552`;
   `apps/local-analyzer/src/program.ts:308`; Android shows them) **[S-7]**.

## 7. Blind 13 (only if rule 6.2 is reached)

After the final code freeze is pushed with green CI: round 13 under `holdout/README.md`, pool `holdout/pool.txt`
(`800c2a1e…2ed41`), excluded families = round 12's list + its two draws + every 005R corpus family (34) + every DEV
row's family + Rarytasy; seed `SHA256(PRE_HOLDOUT_13_SHA + "BUILDPLAN-005R-ROUTER-SOURCE-ROLE-GUARD-HOLDOUT")`,
two unstratified picks as in rounds 11–12. Each drawn page is acquired once (robots, 1 req/s), then run under R0 and
N1 with the same frozen code (the R0 run through `variant.mjs` at the base revision). **Blind predicates:** P1–P6 and
P8 per house, and **coverage**: the house must have ≥ 1 perspective frame (else that house is `NOT_EXERCISED`, not
PASS). Verdict sealed before any diagnosis; no patch after the draw; a failure makes the stage PARTIAL.

## 8. Falsifiers of the stage's central claim (H1, audit §10)

Any of: a model byte difference; an orthographic observation difference; a metric hash difference; a ledger
difference outside perspective evidence; a summary field difference outside the three named; a determinism
difference; a red test other than the one pinning "a render carries observations" (`mutations-02.test.ts` §2, whose
amendment is the deliberate contract change and is disclosed).
