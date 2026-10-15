# BUILDPLAN-ANALYZER-005R — current-pipeline architecture audit

Stage: 005R "visual asset router + exterior semantic observations", research only.
Status: Final audit, committed before any 005R contender ran on the labelled corpus.

Built from verified reader output (R1–R6), read-only spot checks (§1.3) and a final pass re-opening every item of a
completeness critique (§1.5). Refuted claims were dropped; qualified claims appear in corrected form; critique items not
applied as given are in §11.

Paths are relative to `/home/user/BuildApp` unless they are absolute.

## 1. Scope, base SHA, what was read, and what is missing

### 1.1 Repository state

| item | value | tag |
|---|---|---|
| base | `39061dbed453d7af4e538b1fcbe4584496fa223e`, "005Q-CHAIN: closing — CI 38636571399 green on eaeb6df, handoff block" | MEASURED (`git log -1 39061db`) |
| branch | `analyzer/visual-asset-exterior-json-research-v1` | MEASURED (`git branch --show-current`) |
| production change on the 005R branch | `git diff --stat 39061dbed453d7af4e538b1fcbe4584496fa223e HEAD -- packages apps` prints nothing (re-run at finalisation) | MEASURED |
| 005R branch commits cited here | `0d02e53` production freeze manifest at start (base 39061db, IDENTICAL); `5e9bc93` research harness ("… DobreDomy SOURCE_NOT_USABLE") | MEASURED (`git log --oneline base..HEAD`) |

The audit describes production code at base `39061db`, identical to the 005R branch head for `packages/` and `apps/`, so
KNOWN citations hold at either (readers and the critique read at different branch heads, none differing there).

### 1.2 What was read (by reader scope)

- **R1, prior reports.** Read in full: the stage reports for 005M, 005P, 005Q-SGEB, 005Q-OCR and 005Q-CHAIN; 005P
  `architecture-adr.md` and `target-contracts.md`; 005Q `exterior-feature-interface.md`, `negative-control-inventory.md`
  and `first-bad-boundary.md`; 005M `recommendation.md` and `runtime-size-matrix.md`. Read in part: 005P
  `current-system-map.md` (sections plus grep), 005M `licensing-matrix.md` (lines 1-60 plus grep), 005M
  `bakeoff-tables.md` (per-class rows), and `question-corpus.json` (`byClass`). Parsed: 005Q `negative-features.json`.
- **R2, architectural language.** `docs/ARCHITECTURAL_LANGUAGE.md`, `docs/FEATURE_IDENTITY_GRAPH.md`, and
  `packages/architecture/src/{registry,hypotheses,proposals.ts,authority.ts}`. Selected line ranges of `packages/model`,
  `packages/geometry`, `packages/reconstruction/src/v2/{emit,graph,quality}.ts`, and
  `stage-reports/artifacts/architectural-assemblies/capability-registry.json`.
- **R3, source package.** Every `packages/source-package/src/*` core file and adapter, `docs/SOURCE_PACKAGE.md`,
  `docs/MARCOWKI_SOURCE_REVISION_POLICY.md`, and these sealed packages: `/home/user/work005i-a/m-on/rarytasy-{g2e,eoze}`
  and `/home/user/work005k/gapset/runs/D00..D05`.
- **R4, analyzer, vision and observations.** `packages/source-analyzer/src/analyze.ts` and `extractors/elevation.ts` in
  full, the whole of `packages/source-vision/src`, `packages/source-observations/src/schema.ts` and `ids.ts`, the vision
  wiring in `apps/*`, and three sealed observation graphs, summarised by script (marcowki, h1 pod-milorzebem,
  h2 helikoniach).
- **R5, reconstruction.** `packages/reconstruction/src/views.ts`, and from `v2/`: `building.ts`, `terrace.ts`,
  `facade.ts` and `openings-v2.ts` in full, plus selected ranges of `reconstruct-v2.ts`, `layout.ts`,
  `plan-decomposition.ts` and the `boundary-*.ts` files. Sealed candidates `marcowki-auto-v{2,3}.json`. Holdout artifacts
  from 005C, 005D and rarytasy-generalization.
- **R6, Rarytasy trace.** `/home/user/work005q-chain/runs/C0/{rarytasy-g2e,rarytasy-eoze,marcowki,dom-pod-jarzabem}`
  outputs, `/home/user/work005i-a/m-on/*` packages and graphs, and the text of `/home/user/work005r/html/*` (HTML text
  only).
- **Final pass (synthesizer).** `AGENT_PROTOCOL.md`, `APP_SPEC.md` and `PROJECT_STATUS.md` (lines in §1.5); `prepare.ts`;
  `plan-openings.ts`; `hypotheses/group.ts`; `source-vision/src/{apply,schema}.ts`; `source-observations/src/{hash,ids}.ts`;
  every other critique citation (§1.5); and `publishedSpecifications[].key` in the 24 sealed `/home/user/work005i-a/m-on/`
  packages (JSON text only).

### 1.3 Synthesizer spot checks (read-only)

Run to re-check verifier "missed" items and unverified R6 claims: `analyze.ts:120-200`; `model/src/schema.ts:912,925-947`;
`hypotheses/types.ts:12`; `reconstruct-v2.ts:598-615,683-713,1016-1026,1062-1075,1145-1160,1240-1252`; `recesses.ts:168-176`;
`authority.ts:84-101`; `pipeline.ts:50-69`; `demos.ts:225-243`; `config.ts:28-31,61`; `executor.ts:31-41`; `tasks.ts:20-40`;
`truth.py:1-30,50-62`; `acquire.ts:256`; `vocabulary.ts:17-23`; `boundary-bodies.ts:20-33,236-242`; `research-isolation.test.ts`;
`run_model.sh:12-15`; `scripts/extract.ts:12-24,69-72`; `baseline-44.json` (azaliach); tracked overlay SVGs (`grep -c data:image`
only); C0 `model.json`/`result-summary.json` counts (4 cases); edition codes in `/home/user/work005r/html/rarytasy-g2e.html`.

### 1.4 MISSING / NOT_READ / NOT_AVAILABLE

| item | status | tag |
|---|---|---|
| **Original independent "Work OSS" report** | **NOT_AVAILABLE.** No reader found it. `grep -rni 'work oss'` over `*.md/*.json/*.txt` in the repo has no hits, and `find / -iname '*oss*report*'` has no hits. The 005R contract (upload, line 28) says to mark it NOT_AVAILABLE in that case. The OSS-named documents in the repo are different audits: 005G, 005J, 005N geometry-kernel decision, 005O, and `PROJECT_STATUS.md:1317,1577`. None of them was read in full, and none of them is that report. | KNOWN (R1-C32, verifier confirmed) |
| `current-system-map.md` | partial read (sections, grep, and lines 288-305 in the final pass) | — |
| `licensing-matrix.md` lines 60-197 | grep only | — |
| 005Q `architecture/forensics/`, `wall-face-and-evidence-contract.md`, `boundary-call-path.md`, `trigger-census.json` | NOT_READ | — |
| `packages/commands/src/apply-architecture.ts` | NOT_READ | — |
| full `plan-decomposition.ts`, `layout.ts`, `reconstruct.ts` (v1), `roof-systems.ts`, `v2/recesses.ts` (except :148-176), `v2/verify.ts`, `v2/tones.ts` | NOT_READ (grep only) | — |
| `source-cv` bodies; `source-observations/src/geometry.ts`; `architecture/src/hypotheses/geometry.ts`; `source-vision/src/validate.ts` | NOT_READ (no claim below rests on them) | — |
| `APP_SPEC.md` beyond lines 20-27 and 120-125 | NOT_READ | — |
| raw ARCHON carousel markup as bytes | NOT_READ. The channel that carried the interior captions is inferred from `roleEvidence.detail` only. | — |
| reconstruction ledger (per-observation dispositions) for C0/m-on runs | **UNAVAILABLE**: not saved with any output | MEASURED absence (R6) |
| `registrations.cameras[].frameId` for C0 runs | **UNAVAILABLE**: only counts were saved | MEASURED absence (R6) |
| any pipeline output for the OWNER anchor edition `m3ea28300f9b3e` | **MISSING**: no sealed package and no run anywhere in the repo or under the work dirs | MEASURED (R3-22, R6-21) |
| what any image depicts | **NOT_AVAILABLE by rule.** No image was opened, so every statement about drawn content comes from text (captions, publisher prose, earlier reports). | — |
| **R6 verifier verdicts** | **NOT RECEIVED.** The R6 block in the input is truncated in its T3 table and has no `verify` section. Every R6 claim used below is labelled *R6, unverified*, and the synthesizer spot-checked its code lines and model counts (§1.3). | — |

### 1.5 Governing project documents, and the final-pass re-checks

| document | what binds 005R | tag |
|---|---|---|
| `AGENT_PROTOCOL.md:16-17` | read APP_SPEC, PROJECT_STATUS and AGENT_PROTOCOL before implementing anything | KNOWN |
| `AGENT_PROTOCOL.md:53-54` | "New geometry features are added to the compiler on the real production path, with measurement-based tests, never as a side experiment" | KNOWN |
| `APP_SPEC.md:22-26` | analyzers act through high-level building operations (`createRoom`, `createBalcony`, …), never meshes | KNOWN |
| `APP_SPEC.md:122-124` | "camera solving, LLM/VLM integrations" are out of scope for the foundation and "belong to later orchestrated stages" | KNOWN |
| `PROJECT_STATUS.md:54-55`, `:1245`, `:1267` | the 005Q-OCR and 005Q-CHAIN rows and closing recommendations end with "005R (visual pilot) unchanged, pending" | KNOWN |

Consequence (inference from `AGENT_PROTOCOL.md:53-54`): geometry emitted by a research stage would be the forbidden "side
experiment", so 005R emits **no geometry and no building operations**, only research JSON proposals keyed to source
pixels, for a later authorised stage to consume through the DSL (`APP_SPEC.md:22-26`).

Final-pass re-checks: every critique item was re-opened at its cited file:line; confirmed items are applied in place and
marked "(final pass)", with line numbers corrected where needed. Items not applied, or applied with changes, are in §11.

## 2. Tag legend

| tag | meaning | required citation |
|---|---|---|
| **KNOWN** | read in code or in a document | `file:line` |
| **MEASURED** | read from an existing artifact, output JSON, or a read-only command result | path plus field/value, or the command |
| **HYPOTHESIS** | an inference that was not established by reading | the test that would settle it |

Two more qualifiers are used. *documented claim* means a statement made in an earlier report and quoted here without
being re-established (for example, what a picture shows). *R6, unverified* is defined in §1.4.

## 3. The current pipeline, stage by stage

Per stage, the columns (a)–(d) give what happens to **(a)** technical elevations, **(b)** exterior renders,
**(c)** interior renders, and **(d)** photos.

### 3.0 A cross-cutting fact: what "elevation" and "render" mean today

- KNOWN: one ELEVATION role covers both line-drawn technical elevations and photo-realistic orthographic renders, and the
  source package does not record which is which (`source-package/src/schema.ts:45`; R4 missed, verifier KNOWN).
- *documented claim*: on the reference project all four elevations are photo-real renders (`docs/IMAGE_METROLOGY.md:67-71`;
  `STAGE_BUILDAPP_03R1_IMAGE_METROLOGY.md:63-67`). `reconstruction/src/plan-openings.ts:4-7` states it as a design premise:
  "An elevation of a published project is very often a photo-realistic render" (KNOWN as text, final pass).
- KNOWN: in reconstruction v2, the word "render" in step text, ledger reasons and model evidence strings means a
  registered ORTHOGRAPHIC_ELEVATION view, not a PERSPECTIVE_RENDER asset (`reconstruction/src/solve.ts:311-312`;
  `v2/reconstruct-v2.ts:526-544`; `reconstruction/src/v2/emit.ts:555`; R5-24, R6-20).
- Consequence: the 005R split between TECHNICAL_ELEVATION and EXTERIOR_RENDER has to divide assets *inside* ELEVATION.
  Re-labelling PERSPECTIVE_RENDER alone is not enough. The facts above are KNOWN; this design consequence is an
  inference.

### 3.1 Acquisition (`packages/source-package`)

- KNOWN: images are discovered from anchor href, img src and og:image (`discovery.ts:142-198`). Endpoints come from
  `a[data-src]`/`data-path` matching `/product_fancybox_*` or `/products/` (`discovery.ts:233-254`;
  `adapters/archon.ts:46,150-159`).
- KNOWN: grouping uses `adapter.groupKey(c) ?? c.groupKey` (`acquire.ts:256`, re-checked), with union by identical
  `byteHash` (`acquire.ts:262-267`). For ARCHON, `variantStem` is non-null for every `__n` URL (`archon.ts:353`), so the
  discovery anchor groupKey is never used there (R3 missed, re-checked).
- KNOWN: a copy whose aspect differs by more than 2 % is split off as a crop with a `DIFFERENT_CROP` failure
  (`variants.ts:30,35-38`; `acquire.ts:297-315`). A crop that stays within the aspect tolerance remains a variant
  (R3-18, as corrected).
- KNOWN: byte duplicates are collapsed only *within one package* (`acquire.ts:262-296`).

| (a) technical elevation | (b) exterior render | (c) interior render | (d) photo |
|---|---|---|---|
| Acquired. ARCHON elevation tab anchors and slug/caption names. | Acquired (header image, `widok` carousel items). | Acquired from the same carousel. The adapter never reads `data-fancybox-position`, so `fancybox3Interiors` is invisible to it (KNOWN, `archon.ts:46,152`; R3-05). | No dedicated path. A photo would be acquired like any other image. |

### 3.2 Roles (`source-package/src/roles.ts`, adapters)

- KNOWN: `DocumentRoleSchema = FLOOR_PLAN | SECTION | ELEVATION | SITE_PLAN | PERSPECTIVE_RENDER | DETAIL | CHROME |
  UNKNOWN` (`schema.ts:45`). There is no INTERIOR/EXTERIOR or PHOTO/RENDER distinction in any role dimension
  (`schema.ts:45,49,59,63,67`). A grep of `INTERIOR|EXTERIOR|PHOTO` over `packages/source-package/src` has 0 hits (R3-01,
  R3-02).
- KNOWN: roles are assigned only from text and channel signals (URL slug, caption, page context, channel). Claims are
  merged per dimension by maximum confidence. If equally confident claims disagree, the dimension is left UNKNOWN and a
  `conflict` evidence entry is written (`roles.ts:43-62`, tie at `:50-56`; final pass). Confidences are hand-set
  constants (0.92/0.88/0.86/0.4 × scale), not calibrated (R3-23). No pixel-based role classifier exists (R4-08).
- KNOWN: ARCHON maps `\bwidok\b|\bwizualizacj\w*` to PERSPECTIVE_RENDER at 0.88 (slug) or 0.75 (caption)
  (`archon.ts:93-99`, rule at `:98`; `:126,130-137`). The view rules know only `frontow/przedni`, `ogrodow/tyln` and
  `boczn` (`archon.ts:108-114`).
- KNOWN: the generic adapter checks SITE_PLAN (including `\bdzialk\w*`) before FLOOR_PLAN and PERSPECTIVE_RENDER, and the
  first match wins (`generic/vocabulary.ts:17-23`, re-checked). An OG_IMAGE with no other document claim becomes
  PERSPECTIVE_RENDER at 0.4 (`generic/index.ts:105`).
- KNOWN: DETAIL, CHROME and AERIAL are declared but no rule emits them (R3-03). The generic adapter drops chrome before
  any role is assigned (`assets.ts:336-337`; `regions.ts:19,94`).
- MEASURED: PERSPECTIVE_RENDER has view UNKNOWN in g2e 25/25, e-OZE 24/24, D00 1/1 and D01 1/1 (R3-13). This is a
  measured outcome; the code does not guarantee it (R3-04, as corrected).

| (a) | (b) | (c) | (d) |
|---|---|---|---|
| ELEVATION from the `elewacj` slug or caption. A photo-real orthographic render receives the same role (§3.0). | PERSPECTIVE_RENDER if a caption or slug names `widok`/`wizualizacja`. Otherwise UNKNOWN, or in DobreDomy a wrong role (see below). | **PERSPECTIVE_RENDER**, because the caption contains "wizualizacja" (for example a day-zone interior caption and a kitchen caption, both naming "wizualizacja"; captions are not quoted in Git). MEASURED: g2e has 19 interior of 25 PR assets, e-OZE 18 of 24 (R3-14). | No PHOTO role. A photo becomes PERSPECTIVE_RENDER only through a caption word or the og:image fallback, otherwise UNKNOWN. |

- MEASURED (DobreDomy tagline defect): across D00–D05 there are 42 `_wN` render files. 6 are PERSPECTIVE_RENDER (one
  og:image per house, at 0.4), **19 are SITE_PLAN** (+ATTIC +ORTHOGRAPHIC_PLAN, triggered by "na wąską działkę"), and
  17 are UNKNOWN, 12 of them with storey ATTIC (triggered by "z poddaszem") (R3-09, R3-10;
  `/home/user/work005k/gapset/runs/D0*/source-package.json`).
- MEASURED: the SITE_PLAN-before-FLOOR_PLAN order is also what correctly classifies the real DobreDomy site plans
  captioned "rzut działki". Reordering the rules to fix the tagline defect would misclassify those (R3 missed;
  `vocabulary.ts:20-21` re-checked).
- KNOWN (005R harness, not production): commit `5e9bc93` records "DobreDomy SOURCE_NOT_USABLE" (git log, §1.1).

### 3.3 Analysis / extractors (`packages/source-analyzer`)

KNOWN routing (`analyze.ts:125-176`, re-checked):

| DocumentRole | frame declared | deterministic extractor | gap in graph |
|---|---|---|---|
| FLOOR_PLAN | yes | plan-walls, plan-openings, stair-symbol, dimension-chains (`plan.ts:36-41`) | — |
| ELEVATION | yes | silhouette, roof-lines, openings, linear-volume, recess (`elevation.ts:33-39`) | — |
| PERSPECTIVE_RENDER | yes | **the same five elevation extractors** (`analyze.ts:164-166`) | — |
| SECTION | yes | section-levels, section-roof, section-stair (`section.ts:23-27`) | — |
| SITE_PLAN, DETAIL | yes (fetched and decoded) | none | NOT_ATTEMPTED "no extractor for this document role yet" (`analyze.ts:173-176`) |
| CHROME, UNKNOWN | **no** | skipped before fetch | **none.** The skip is written only to `AnalysisResult.skipped` (`analyze.ts:125-129`), and that field has no consumer in `packages/*/src` or `apps/*/src` (R4-01) |

- KNOWN (final pass): every declared frame is decoded from the sealed bytes (`prepare.ts:79-80`), and analysis throws if
  the decoded size differs from the sealed size (`analyze.ts:153-155`). Work is done at a longest edge of at most
  `MAX_WORKING_EDGE = 2200` px (`prepare.ts:29`). An **ink channel** is computed for every frame, whatever its role
  (`inkChannel`, `prepare.ts:92`; `adaptiveInkMask`, `:102`), and is documented as "how much this pixel reads as
  drafting ink rather than as colour" (`:41`). Routing never consults it; routing is by role only (`analyze.ts:164`).
- KNOWN: deterministic CV never emits WINDOW, DOOR, BALCONY, RAILING or CHIMNEY. On elevation and render frames it emits
  only SILHOUETTE, MASS_REGION, ROOF_EDGE, RIDGE, LOGGIA, OPENING, LINEAR_VOLUME_CANDIDATE (hints beam/column/
  side-return), WALL_REGION and SURFACE_REGION (`elevation.ts:101-309`; R4-20).
- KNOWN: OPENING is emitted from `rectangleCandidates` with confidence `min(0.85, 0.35 + closure*0.5)`, no render check,
  and a cap of 40 per frame (`elevation.ts:259-270`).
- KNOWN (qualified, R4-05): the repo's "thirty rectangles, not one an opening" finding (`docs/IMAGE_METROLOGY.md:147-151`)
  was measured on the reference project's photo-real *orthographic elevations*, with a 03R1-era detector. It is not a
  measurement of today's `cv.openings` on PERSPECTIVE_RENDER frames. Using it as a known-bad baseline for renders is an
  extrapolation (HYPOTHESIS R4-06; test: locally labelled render frames, then precision of `cv.openings`).
- KNOWN: the only other pixel-based "what kind of picture" signal in the repo is `drawingCharacter`
  (`image-metrology/src/opening.ts:342`). It is used in v1 `reconstruct.ts:38,856` and in overlays, never in routing.
  Its documented separation (0.88-0.97 vs 0.08-0.37) is fixture drawings against photo-real *orthographic* elevations
  (R4-07, as corrected).

| (a) | (b) | (c) | (d) |
|---|---|---|---|
| Elevation CV. MEASURED: 54-91 OPENING per package on ELEVATION frames (R4-04 verifier context). | Elevation CV. MEASURED render-frame counts: marcowki 4 frames, OPENING 74, LOGGIA 8, LVC 58; pod-milorzebem 6 frames, OPENING 112; helikoniach 4 frames, OPENING 72 (R4-04). | **Elevation CV on interiors.** MEASURED in the g2e graph: all 19 interior frames carry observations, for example w1 RIDGE 8, SILHOUETTE 8, ROOF_EDGE 32, OPENING 114, LOGGIA 21, and l3 (bathroom) RIDGE 4, OPENING 118. 201 relations reference interior-frame observation ids (an exact count) (R3-12). | Same as (b) if the role is PERSPECTIVE_RENDER, else skipped. |

### 3.4 Observation graph (`packages/source-observations`)

- KNOWN: each observation carries `assetId`, `variantByteHash` (64 hex; SHA-256 by producer convention), `frameId`,
  `pixelGeometry`, `normGeometry`, confidence, `uncertainty.positionPx`, provenance and alternatives
  (`schema.ts:240-263`). The validator refuses mismatched frame, asset or bytes and non-derived ids
  (`validate.ts:194-225`) (R4-21).
- KNOWN: frames carry a *copy* of the package roles (`schema.ts:363-372`; `builder.ts:122-129`). That copy is typed as
  five unconstrained `z.string()` fields, not the DocumentRole enum (`schema.ts:370`), and it is hashed into the graph
  content hash (`hash.ts:44`), hence into the graph id (`ids.ts:74`) (final pass). `frameId` is derived from assetId and
  byteHash only (`ids.ts:23`). The validator never reads `frame.roles`, and the REPLAYED_GRAPH path does not compare
  roles or `sourcePackageHash` with the package (`analysis-service/src/run.ts:281-284`) (R4-22).
- KNOWN: the graph has no whole-asset classification kind and no edition or version field beyond `sourcePackageId` and
  `sourcePackageHash` (`schema.ts:54-101,375-392`; R4-23).
- KNOWN (R4-19, as corrected in the final pass): none of TERRACE, PERGOLA, CANOPY, CARPORT, GARAGE_DOOR or
  EXTERIOR_STEPS is an ObservationKind (`schema.ts:54-101`) or a SemanticHint (`schema.ts:105-139`). COLUMN_POST is not
  an ObservationKind, but SemanticHints for it and its look-alikes exist: `'portal'` (`:108`), `'parapet'` (`:110`),
  `'column'` (`:114`), `'pilaster'` (`:115`), `'railing'` (`:119`), `'balcony-slab'` (`:120`). Deterministic LVCs carry
  `column` (§3.3). "garage door" appears only as prose (`source-vision/src/tasks.ts:44`).

(a)–(d): all frames that are declared receive the same treatment. The role copy is the only per-class difference.

### 3.5 Vision reasoner (`packages/source-vision`)

- KNOWN: the tasks are FACADE_DECOMPOSITION (documents ELEVATION and PERSPECTIVE_RENDER), PLAN_INTERPRETATION and
  SECTION_INTERPRETATION (`schema.ts:37`; `tasks.ts:36-38` re-checked, `:55,:70`). There is no classification task and
  deliberately no "interpret this building" task (`schema.ts:32-36`).
- KNOWN: the providers are `anthropicVisionReasoner` (REMOTE; base64 image upload; default model `claude-opus-5`;
  `providers/anthropic.ts:105-148`), `fixtureVisionReasoner` (replay; synthetic fixtures only, `docs/VISION_REASONER.md:128-134`)
  and `nullVisionReasoner` (throws NO_PROVIDER). No local VisionReasoner implementation exists (R4-11).
- KNOWN: there are **two** remote paths: (1) `apps/analyzer-api` with `ANALYZER_VISION=live`
  (`config.ts:30,61`, re-checked; `executor.ts:31-41` passes `wiring.vision`); and (2) the developer CLI
  `packages/source-analyzer/scripts/extract.ts --live` (`:13-14,71`, re-checked), which can also `--record` live answers.
  The local/APK analyzer has no provider (`apps/local-analyzer/src/wiring.ts:6-8`; test `local-analyzer.test.ts:117-120,145-148`).
  The default is `nullVisionReasoner` (`analysis-service/src/run.ts:288`) (R4-12, as corrected; R4 missed).
- KNOWN: the publisher roles are injected into the prompt (`anthropic.ts:88`). The package's **published figures**
  (`pkg.publishedFacts`, `analyze.ts:97,114,195`) are injected too, as "Published figures for this project, for context
  only … do not use them as dimensions" (`anthropic.ts:93-97`; final pass). The response schema is `.strict()` with no
  roles field (`schema.ts:90-101`), so a vision answer cannot change a role (R4-15).
- KNOWN (final pass): the provider's confidence enters the graph unchanged, with no calibration step
  (`apply.ts:79`; uncertainty reason "estimated by a vision model from the raster alone", `:80`). The response already
  has a named-absence field, `notFound` ("A named gap is worth more than silence", `schema.ts:97-98`).
- MEASURED: the existing holdout and marcowki graphs ran without vision. Every facade, plan and section pass is
  NOT_ATTEMPTED, and no VISION_MODEL extractor appears in any of them (R4-13). The C0 runs are REPLAYED_GRAPH with
  `vision.attempted 0` (re-checked, §1.3).

| (a) | (b) | (c) | (d) |
|---|---|---|---|
| FACADE_DECOMPOSITION if a provider is configured; NOT_ATTEMPTED in all product and default runs. | Same. | Would receive FACADE_DECOMPOSITION if a provider were configured (KNOWN code path, `tasks.ts:38`, `analyze.ts:190-195`). Today NOT_ATTEMPTED. | Same as (b). |

### 3.6 Reconstruction (`packages/reconstruction/src/v2`)

- KNOWN: the product path calls only `reconstructV2` (`analysis-service/src/run.ts:29,402`). v2 reuses v1 helpers
  (`views.ts`, `solve.registerElevationFrames`, `layout.ts`) (R5-01). v1 `planOpenings` (`plan-openings.ts:157`) is
  imported only by v1 `reconstruct.ts:41`; no file under `v2/` imports it (grep; final pass), so it is off the product
  path.
- KNOWN: elevation registration in v1 uses `ORTHOGRAPHIC_ELEVATION` only (`solve.ts:311-312`). v2 then re-registers
  each view (`frame.ts:313-350`): mpp = plan envelope span / silhouette width, checked against ridgeY and terrain, and
  refused when the error exceeds 0.9 m (`frame.ts:345`) (R5-17, as corrected).
- KNOWN: a view is skipped if it has no side, or if `ridgeY` is undefined (`reconstruct-v2.ts:531-546`). `ridgeY` comes
  from LEVEL_DATUMs on the section frame, or on all frames when no section exists (`reconstruct-v2.ts:231,456`;
  `solve.ts:252-294`). So the dependency is on ≥2 attached level datums, not strictly on a section (R5-22, as corrected).
- KNOWN: side labels. `views.ts:233,245` honour only `FRONT/REAR/LEFT/RIGHT`, but the source enum has
  `SIDE_LEFT/SIDE_RIGHT/SIDE_UNSPECIFIED` (`source-package/src/schema.ts:63`). Unlabelled sides are therefore assigned by
  width order: the first free side at confidence 0.4 when both sides of the axis are free, the remaining side at 0.65
  when one is free (`views.ts:243-266`, confidences at `:264-265`; final pass). v2 then tries a mirror swap for views
  not labelled LEFT/RIGHT/SIDE_LEFT/SIDE_RIGHT, and only when every readable view prefers the mirror by ≥ 0.25 m
  (`reconstruct-v2.ts:622-647`; `side-orientation.ts:98-133`) (R5-18, R5-19). SIDE_LEFT/SIDE_RIGHT in `chooseSide` is
  untested (`current-system-map.md:299`).
  HYPOTHESIS R5-20: a generic-adapter `SIDE_RIGHT` view is placed by width order and is then exempt from the swap check,
  so it can stay on LEFT. Test: a synthetic single "elewacja prawa" package, asserting `registrations.elevations[].side`.
- KNOWN: perspective renders contribute no geometry. A camera is attempted per perspective frame when a raster and
  `mainRoof` exist (`reconstruct-v2.ts:1162-1179`; skip at `:1171`), and `solvedCameras` feeds only the step log. LVCs on
  unregistered views are IGNORED_WITH_REASON (`:1152`).
- KNOWN (R4-17, as corrected in the final pass): the camera loop records **every** observation on the frame (`:1177`) and
  `record` marks it consumed (`:185-190`), so the leftover loop skips it (`:1411`). Solved: every observation, interiors
  included, becomes USED_AS_CORROBORATION with the text "depth order was checked against it", which no code checks (R4-25,
  R5-23, R6-19); unsolved: IGNORED_WITH_REASON. Only frames the loop skips (`:1171`) reach the leftover loop, where
  ROOF_EDGE/RIDGE become USED_AS_CORROBORATION and off-ELEVATION OPENING/LOGGIA IGNORED (`reconstruct-v2.ts:1410-1425`).

| (a) | (b) | (c) | (d) |
|---|---|---|---|
| Registered as metric views if they have a side and a ridge datum. Read for verges, apex votes, balcony fascia, railing, portal heads, opening sill/head, attached-roof form, chimneys, rooflights and tones (R5-24). Photo-real orthographic renders labelled ELEVATION are treated the same way. | Camera solve attempted, recorded only; no geometry. Observations on the frame USED_AS_CORROBORATION if solved. | **Camera solve attempted on interiors too**, and a solve marks every interior observation USED_AS_CORROBORATION (`:1177`). MEASURED: g2e 25/25 attempted and 12 CAMERA features; eoze 24/24 and 3; marcowki 4/4 and 3; jarzabem 4/4 and 1 (R6-17, R6 unverified; CAMERA L1 counts re-checked, §1.3). HYPOTHESIS R6-18: ≥ 6 of the 12 g2e solves are on interior frames, because only 6 g2e PR frames are exterior-named. Test: dump `registrations.cameras[].frameId` in a replay. | As (b). |

### 3.7 Architecture proposals (`packages/architecture`)

- KNOWN: no production package or app imports `@buildapp/architecture`. The importers are
  `packages/editor/test/categories.test.ts` and `tests/architecture/*` (R2-C05, R4-26). The guard test at
  `tests/architecture/assemblies.test.ts:115-125` does **not** cover every production package. It omits source-vision,
  image-metrology, verification, candidates, evidence-pack, source-common, numeric-recogniser-ort and apps/android, and
  its regex catches only static imports (`:38-41`) (R2-C05, as corrected).
- KNOWN: `SemanticProposal` is `.strict()` with world-metre geometry only. It has `sourceFrameId` but no assetId, byte
  hash or pixel box (`proposals.ts:53-95`). `DETECTORS` includes `VLM` (`proposals.ts:16`). `PROPOSAL_KINDS` covers
  VERTICAL_MEMBER, HORIZONTAL_MEMBER, COVER_SURFACE, NO_COVER_OBSERVED, STEP_EDGE and LEVEL_SURFACE ("a landing, a
  terrace"). There is no railing/guard, garage-door or window-vs-door kind (`proposals.ts:23-51`; R2-C09, as corrected).
- KNOWN (final pass): grouping. Proposals that share a detector-supplied `featureKey` (`proposals.ts:80`, optional) are
  unioned into one feature "seen from several frames" with no further check (`hypotheses/group.ts:4-5,33-36`); the group
  takes that key as its id (`:65-66`). The rest group by plan-extent proximity.
- KNOWN: the hypothesis families are only DORMER, PERGOLA, CANOPY, CARPORT, EXTERIOR_STEPS and ROOF
  (`hypotheses/types.ts:12`, re-checked). ENTRANCE is not a pipeline family. Its doors come from the context model
  (`architecture/src/hypotheses/emit.ts:532,616-630`) (R2-C04, as corrected).
- KNOWN: an ACCEPTED family whose emitter fails becomes UNKNOWN, and `emitUnknown` is then called without the
  `realFeature` gate (`pipeline.ts:50-69`, re-checked). `demoUnknown` emits an UNKNOWN assembly from two render-only
  frames (`demos.ts:225-243`, re-checked; `fuse.ts:127`) (R2 missed).
- KNOWN (R2-C15, partly promoted in the final pass): a single-frame group is held back only when *every* proposal is at
  VISUAL_INFERENCE or lower (`visualOnly`, `fuse.ts:124`, branch `:134`). Otherwise, a family whose required counts are
  met returns ACCEPTED at `fuse.ts:141`, **before** the `realFeature` gate (`:127`, used at `:145`). PERGOLA's
  requirements have no crossView flag (`capabilities.ts:273-275`); only DORMER and COLUMN require crossView
  (`capabilities.ts:183,288`). So a single-frame PERSPECTIVE-authority group can be ACCEPTED as PERGOLA, CARPORT,
  EXTERIOR_STEPS or CANOPY.
  HYPOTHESIS: a realistic `demoPergola` remap to `render-1`/PERSPECTIVE/VLM actually groups into one group and meets
  the counts. Test: run `runPipeline` on that remap.

(a)–(d): none reach this stage in production. The stage is off the product path.

### 3.8 Canonical model (`packages/model`) and emission (`reconstruction/src/v2/emit.ts`)

- KNOWN: `AssemblyKindSchema = ROOF, DORMER, BALCONY, TERRACE, LOGGIA, CANOPY, PERGOLA, CARPORT, ENTRANCE,
  EXTERIOR_STAIR, FACADE, GARAGE, UNKNOWN` (`model/src/schema.ts:912`, re-checked). `AssemblyAlternative.kind` is the
  same enum (`:925-928,947`).
- KNOWN: v2 emits only `createTerrace`, `createBalcony`, `createRailing`, openings (`cutOpening`, `placeWindow`,
  `placeDoor` including a PANEL garage door), chimneys, rooflights and an interior stair
  (`reconstruction/src/v2/emit.ts:424-500,516-536`). It never emits `createAssembly`, `createColumn`,
  `createLinearSolid`, `createPlatform` or `createStepRun` (R2-C29, as corrected; R5-02).
- KNOWN: `IMAGE_METRIC_REGISTERED` and `VISUAL_SEMANTIC` both become model `VISUAL_INFERRED`, while
  `SOURCE_CORROBORATED` passes through unchanged (`reconstruction/src/v2/emit.ts:53-70`, pass-through at `:57-58`).
  `VISUAL_SEMANTIC` features are capped at L1 (`quality.ts:51-57`) (R2-C24).
- MEASURED (005Q census, 24 completed B0 models at `04d5568`): createAssembly, createLinearSolid, createColumn,
  createBeam, createPlatform, createStepRun and addEvidenceSource are all 0. Door.usage is never set
  (`stage-reports/artifacts/analyzer-005q/architecture/exterior-feature-interface.md:198-215`; R1-C13).

| (a) | (b) | (c) | (d) |
|---|---|---|---|
| Contributes VISUAL_INFERRED balcony/railing/sill/head values, SOURCE_* roof/datum checks, and some SOURCE_CORROBORATED members (§5.3 leak 5). | Nothing. | Nothing directly (no geometry path; §3.6). | Nothing. |

## 4. Exterior assemblies: representation, recognition, 3D placement, registry

The columns are: **Represented** (a model type exists); **Recognized from real images** (by what code, from which image
role); **3D positioned accurately** (from current evidence); **Registry** (`packages/architecture/src/registry/capabilities.ts`,
status/recognition, with "no key" meaning the registry records nothing, which is different from recording NONE). Rows
below the 005R classes are look-alikes and negative rows the 005R negative pairs need (final pass). The two further
columns (view side / mirror, and existing negative or absence construct) are in §4.1.

| 005R class | Represented | Recognized from real images | 3D positioned accurately | Registry | Citations |
|---|---|---|---|---|---|
| TERRACE_AT_GRADE | KNOWN: `terrace` record and AssemblyKind TERRACE (`model/schema.ts:546-557,912`) | KNOWN: **plan raster only**. A dimensioned ZONE strip becomes a storey-0 recess floor, plus an optional outline extension (`layout.ts:2189-2198,2300-2324`; `reconstruct-v2.ts:1098-1126`; `terrace.ts:44-104`). Never from an elevation or a render. A grep for `taras` over non-test `packages/**` hits only the spec-key rules (`archon.ts:223`; `generic/published.ts:54`), and the `terrace` spec key has no consumer (grep; `cross-source.ts:135-136` reads only `roof`). MEASURED: no `terrace` spec key in any of the 24 sealed packages under `/home/user/work005i-a/m-on/`. HYPOTHESIS: a published room named "Taras" can become a `createRoom` `usage` (`reconstruction/src/v2/emit.ts:323`); test: a replay on a package whose room table has "Taras". | MEASURED at `04d5568` (005Q B0): **partly fabricated.** 17 of 29 production terraces are ≤ one wall deep, 0.17-0.48 m (005Q `exterior-feature-interface.md:36-46`; census baseline per `STAGE_…005Q_SOURCE_GROUNDED_EXTERIOR_BOUNDARY.md:17`). Layout 1.2.0 (`7eddd7b`, `layout.ts:72`) then removed glogownikach's 3 wall-poché terraces, so at base the count is at most 14 of 26 (derived, not re-measured). g2e has `terrace-front-822`, an 8.99 × 6.2 m UNKNOWN-surface "floor of the front recess" on what 005Q's raster-checked inventory calls open ground (R6-04/R6-11, R6 unverified; model count re-checked). | SUPPORTED / ANALYZER_V2, `knownGaps: []` (`capabilities.ts:229-238`, re-checked). 005Q calls this "an overstatement". | R5-04; R1-C12; R6-04 |
| COVERED_TERRACE | KNOWN: no own kind. CANOPY `usage: TERRACE_COVER` (`schema.ts:1017`) is never emitted (`architecture/src/hypotheses/emit.ts:532`). In reconstruction, only the boundary-body relation `COVERED_TERRACE`, "never built" (`boundary-bodies.ts:32,238-241`, re-checked). | KNOWN: plan posts give `postShare`, which gives a body label. It never reaches the model. MEASURED: 12 such labels on B0 digests. On glogownikach two of them are 17-px slices of its own south wall (`exterior-feature-interface.md:47-54,217-221`). | No object. Cover is only implicit in `mainRoof.coversZones` (`reconstruct-v2.ts:601-608`, re-checked), decided per envelope, not per zone (R5-06, as corrected). | no key (folded into CANOPY SUPPORTED/SYNTHETIC_PIPELINE) | R2-C31; R5-06; R1-C14 |
| PERGOLA_OPEN | KNOWN: `PERGOLA` with `coverage: z.literal('OPEN')` (`schema.ts:1022-1028`); `PERGOLA_HAS_ROOF` error (`validate-architecture.ts:427-438`) | KNOWN: none. Boundary readers keep free posts as `SolidPart` POST (`boundary-evidence.ts:63`) but never build them (`boundary-evidence.ts:613-621`; `plan-decomposition.ts:1286`). | n/a (0 emitted; MEASURED census) | SUPPORTED / SYNTHETIC_PIPELINE (`capabilities.ts:268-283`). Known gap: louvre roofs are not distinguished (`:282`). | R2-C18; R5-07 |
| CANOPY_ENTRANCE | KNOWN: CANOPY with usage ENTRANCE (`schema.ts:1017`); ENTRANCE assembly | KNOWN, narrow: (i) an attached body's flat roof extended over the FRONT zone when the top-storey plan shows a projecting outline (dark > 0.6) (`reconstruct-v2.ts:927-951`); (ii) a portal head band on the FRONT elevation ≥ 60 % of body width (`:1079-1090`; see the portal-head row). No free-standing canopy. | Only in that configuration (R5-08, as corrected) | CANOPY SUPPORTED / SYNTHETIC_PIPELINE; ENTRANCE SUPPORTED / SYNTHETIC_PIPELINE (`capabilities.ts:240-255,324-335`) | R5-08 |
| CARPORT | KNOWN: CARPORT (`schema.ts:1018`); fusion needs a cover ≥ 12 m² (`fuse.ts:50`) | KNOWN: none. The boundary label `OPEN_MOUTH_GARAGE` exists (`boundary-bodies.ts:236-238`, re-checked). Open bays "stay ground" (`plan-decomposition.ts:1644-1645`). | n/a (0) | SUPPORTED / NONE (`capabilities.ts:256-267`) | R5-09; R2-C22 |
| BALCONY | KNOWN: `balcony` record (kind BALCONY/TERRACE/LOGGIA, `schema.ts:499`) | KNOWN: an **elevation raster** (technical or photo-real orthographic) fascia band, gated by a storey > 0 plan recess (`reconstruct-v2.ts:1045-1094`; `facade.ts:126-163`). IMAGE_METRIC_REGISTERED → VISUAL_INFERRED. | MEASURED: produced on marcowki only (2). The holdouts have 0 (azaliach, tunbergiach, rarytasy; R5-27, which are pre-base artifacts). KNOWN code: `x0/x1 = extent`, `z0/z1 = mouth/back` for every recess side (`reconstruct-v2.ts:1062-1067`, re-checked), while returns switch axes for WEST/EAST (`:700-713`). HYPOTHESIS: a WEST/EAST balcony would be placed with swapped axes. Test: a synthetic side-recess fascia on a LEFT/RIGHT elevation. Also KNOWN: the loop `break` exits `recess.open`, not `viewsOf`, so several views can push the same balcony id (R5-10, as corrected). | SUPPORTED / ANALYZER_V2 (`capabilities.ts:204-215`) | R5-10; R1-C23 (as corrected) |
| LOGGIA | KNOWN: LOGGIA kind (`schema.ts:499,1016`) | KNOWN: not distinguished. An upper recess is written as BALCONY (`reconstruct-v2.ts:1067`). The boundary label `RECESSED_ATTACHED` ("an entrance, a loggia or a porch … Not built") is never emitted (`boundary-bodies.ts:24-25`, re-checked). `readPlatformSemantics` would distinguish balcony/loggia/terrace (`docs/ARCHITECTURAL_LANGUAGE.md:110-112`; `validate-architecture.ts:83`), but it runs only on an assembly with a `platformId` (`:411-413`), and production emits no assembly (§3.8). CV `LOGGIA` observations (dark recess) also fire on interior renders (§3.3). | n/a (0) | PARTIAL / NONE (`capabilities.ts:216-227`) | R5-11 |
| RAILING | KNOWN: `railing` with role GUARD/HANDRAIL/BALUSTRADE (optional) and infill GLASS/BARS/NONE (`schema.ts:510-535`) | KNOWN: `readRailing` on an elevation raster, only above a solved balcony (`facade.ts:165-212`; `reconstruct-v2.ts:1068-1075`). The reader presumes glass (`facade.ts:165`). The emitter hard-codes `infill: 'GLASS'` and `postSpacing: 1.0` (`reconstruction/src/v2/emit.ts:435`). The feature lists "post spacing" as unresolved, but that is lost in the command (`reconstruct-v2.ts:1070`). | MEASURED: marcowki 2, all others 0. Terrace and stair railings: never (R5-12) | **no RAILING key.** Only HANDRAIL PARTIAL / NONE (`capabilities.ts:336-347`) | R5-12; R2-C21 |
| COLUMN_POST | KNOWN: `linearSolid` roles COLUMN/POST/PERGOLA_POST (`schema.ts:725-726`) | KNOWN: plan POST parts feed `postShare` only (`boundary-evidence.ts:63`). CV LVC hint `column` on elevations and renders (SemanticHint `'column'`/`'pilaster'`, `source-observations/src/schema.ts:114-115`). v2 rejects LVCs not on a member as "a stripe, not a volume" (`reconstruct-v2.ts:1147-1158`, re-checked). | n/a (0 linearSolids; MEASURED census) | COLUMN SUPPORTED / SYNTHETIC_PIPELINE, crossView required (`capabilities.ts:284-295`) | R5-13; R4-20 |
| EXTERIOR_STEPS | KNOWN: `stepRun` (`schema.ts:895`); EXTERIOR_STAIR assembly | KNOWN: none. Stair ladders are searched only inside the main body rectangle (`reconstruct-v2.ts:734-735`), and the stair is interior 0→1 (`:768`). The `stairs` spec key (`archon.ts:222`) has no consumer (grep); MEASURED: it occurs in none of the 24 m-on packages. | n/a (0) | SUPPORTED / SYNTHETIC_PIPELINE (`capabilities.ts:308-323`) | R5-14 |
| GARAGE_DOOR | KNOWN: door usage GARAGE or PANEL-only gives `GarageDoor` (`primitives.ts:87,171-174`); GARAGE assembly kind (`schema.ts:912`) | KNOWN: **plan gap rule**: ATTACHED single-storey body, storey 0, width ≥ 2.2 m, sill < 0.1 m (`openings-v2.ts:310-313`) plus callout width. Family VISUAL_SEMANTIC. Emitted as a single PANEL door (`reconstruction/src/v2/emit.ts:493-494`). The `garage_door` spec key (`archon.ts:220`; `generic/published.ts:51`) is produced, MEASURED in 11 of the 24 m-on packages including rarytasy-g2e and dom-pod-jarzabem, but has no consumer (grep). | MEASURED: marcowki 2.75 × 2.75, printed 275/275, height UNRESOLVED (R5-26). g2e `opening-0-front-4-0` 5.00 × 2.38 PANEL (R6-04, R6 unverified). jarzabem: none identified, although the publisher states a HÖRMANN door (R6-15, R6 unverified). A garage door in the main body or on a two-storey garage is never typed GARAGE_DOOR (KNOWN). | **no key** | R5-15; R2-C22; R2 missed (`openings-v2.ts:23`, re-checked) |
| WINDOW | KNOWN: opening kind WINDOW (`schema.ts:208`) | KNOWN: plan wall gaps 0.5-6.5 m, callout `w/h`, elevation sill/head (`openings-v2.ts:71,101-325`). Family from the plan symbol and proportions; VISUAL_SEMANTIC. Never from perspective renders. | Plan position: KNOWN to be measured geometry. Vertical: corroborated, image-registered, or ASSUMED (head = floor + 2.1 m). HYPOTHESIS R6-23: g2e full-height sill-0 "WINDOWs" are terrace doors (partly explained by code; see GLAZED_DOOR row). | **no key** | R5-16 |
| EXTERIOR_DOOR | KNOWN: door usage ENTRANCE/TERRACE/SERVICE (`schema.ts:333`) | KNOWN: as for WINDOW; DOOR if floor-reaching, unglazed and ≤ 1.3 m (`openings-v2.ts:320`). A gap on a shared face becomes a sharedDoor (`reconstruct-v2.ts:846-857`). | as WINDOW | **no key** (ENTRANCE SUPPORTED / SYNTHETIC_PIPELINE is an assembly, not a door) | R5-16 |
| UNKNOWN_ASSEMBLY | KNOWN: UNKNOWN with a world `metricExtent` spanning ≥ 2 axes, `sourceEvidenceIds` ≥ 1, never COMPLETE (`schema.ts:1066-1083`; `validate-architecture.ts:474-487`) | KNOWN: none in production. MEASURED: 0 emitted, and production writes no `evidenceSources` (R1-C13). | n/a | SUPPORTED / SYNTHETIC_PIPELINE (`capabilities.ts:348-359`) | R2-C23 |
| *PARAPET / UPSTAND / SCREEN* (look-alike of RAILING) | KNOWN: panel roles PARAPET, UPSTAND, SCREEN (`model/src/schema.ts:842`) | KNOWN: none as such. SemanticHint `'parapet'` exists (`source-observations/src/schema.ts:110`). Registry gap: "the analyzer still represents a parapet as a fascia band raised above a flat roof" (`capabilities.ts:193-202`). | n/a | PARAPET SUPPORTED / NONE (`capabilities.ts:193-202`) | final pass |
| *GARAGE (closed volume)* (look-alike of CARPORT) | KNOWN: AssemblyKind GARAGE (`schema.ts:912`) | KNOWN: implicit only, through the opening-family rule on an attached single-storey body (`openings-v2.ts:310`); boundary relation `OPEN_MOUTH_GARAGE` names an open-mouthed one (`boundary-bodies.ts:236-238`). No GARAGE assembly emitted (§3.8). | the body is plan geometry; no assembly | no key | final pass |
| *Main ROOF* (look-alike of a porch canopy) | KNOWN: AssemblyKind ROOF; roof planes | KNOWN: from section/level datums and registered elevations; v2 hard-codes `kind: 'GABLE'` (`reconstruct-v2.ts:613`). | GABLE only; a HIP spec is ignored (§8.2 C′) | ROOF_GABLE SUPPORTED / ANALYZER_V2; ROOF_HIP SUPPORTED / SYNTHETIC_PIPELINE (`capabilities.ts:91-112`) | final pass |
| *BEAM / PERGOLA_BEAM* (horizontal members) | KNOWN: linearSolid roles BEAM, PERGOLA_BEAM (`schema.ts:726`) | KNOWN: none. CV LVC hint `beam` exists (§3.3); LVCs off a member are REJECTED (`reconstruct-v2.ts:1147-1158`). | n/a (0) | BEAM SUPPORTED / SYNTHETIC_PIPELINE (`capabilities.ts:297-306`) | final pass |
| *GLAZED_DOOR / MULTI_PANEL_GLAZING* (terrace doors) | KNOWN: opening families (`openings-v2.ts:23`) | KNOWN: floor-reaching ≥ 2.0 m → MULTI_PANEL_GLAZING (`:314`); floor-reaching 1.3–2.0 m → GLAZED_DOOR (`:322`). But a floor-reaching **glazed** opening 0.75–2.0 m wide on storey 0 with no swing drawn is typed **WINDOW** by rule (`:321`), which partly explains HYPOTHESIS R6-23 from code. | as WINDOW | no key | final pass |
| *Portal head / FACADE_MEMBER* (existing CANOPY_ENTRANCE evidence) | KNOWN: FACADE_MEMBER feature; `PORTAL_FRAME` facade assembly (`reconstruct-v2.ts:1085-1089`) | KNOWN: a FRONT-elevation fascia band continuing ≥ 60 % across an attached body (`:1081-1084`); recorded **SOURCE_CORROBORATED** (`:1085,1088`; §5.3 leak 5). | only that configuration | no key | final pass |
| *CHIMNEY* (render-derived hard-status precedent; not a 005R class) | KNOWN: `placeChimney` (`reconstruction/src/v2/emit.ts:450`) | KNOWN: plan block on ≥ 2 storeys, or a block seen above the roof on a registered elevation (`v2/roof-details.ts:192,197`; `reconstruct-v2.ts:969-970`); SOURCE_CORROBORATED when seen on such a view (`:979`). | per plan block | not checked | final pass |
| *INTERIOR_RENDER* (negative row: interior ≠ facade evidence) | KNOWN: no class (`source-package/src/schema.ts:45`) | KNOWN: routed to the elevation extractors (`analyze.ts:164`) and to the camera loop (`reconstruct-v2.ts:1169-1177`). MEASURED: g2e interior frames carry RIDGE, OPENING, LOGGIA … (R3-12). | must place nothing; today places nothing but can mark its observations USED_AS_CORROBORATION (§3.6) | — | final pass |

KNOWN: the observation graph covers WINDOW, DOOR, BALCONY, LOGGIA and RAILING as ObservationKinds. Only vision may
emit WINDOW, DOOR, BALCONY or RAILING, and vision has never run on real data (§3.5).

### 4.1 Further columns: view side / mirror, and existing negative or absence construct

General side facts (KNOWN): `SIDE_*` labels are treated as unlabelled (`views.ts:233,245`), which is untested
(`current-system-map.md:299`); unlabelled sides fall to width order at 0.4/0.65 (`views.ts:264-265`); the mirror swap is
`reconstruct-v2.ts:622-647`. Architecture proposals carry no side or mirror field (`proposals.ts:53-95`).

| row | view side / mirror dependence (KNOWN code; effects are HYPOTHESIS unless measured) | existing negative or absence construct |
|---|---|---|
| TERRACE_AT_GRADE | plan-derived; recess side from plan geometry, no elevation side needed | layout 1.2.0 names a wall strip an AMBIGUOUS outer-face gap, never a terrace (`layout.ts:70-72`); 005Q plan-pixel negatives (`negative-features.json`) |
| COVERED_TERRACE | `coversZones` needs every side view registered and wider than the walls (`reconstruct-v2.ts:601-608`), so it depends on side assignment | `coversZones = false` only; no explicit "uncovered" record |
| PERGOLA_OPEN | none (off product path) | `NO_COVER_OBSERVED` requirement (`capabilities.ts:275`), the only "absent if visible" construct; exclusion `COVER_SURFACE` (`:277`); `PERGOLA_HAS_ROOF` |
| CANOPY_ENTRANCE / portal head | FRONT only (`reconstruct-v2.ts:1081`): a mis-sided front loses it | CANOPY excluded by `NO_COVER_OBSERVED` (`capabilities.ts:249`), authority-blind (§5.3 leak 3) |
| CARPORT / GARAGE | none (off product path) | CARPORT excluded by `NO_COVER_OBSERVED` (`capabilities.ts:261`); cover < 12 m² is not a carport (`fuse.ts:50`); carport vs garage door never scored (§10 row 6) |
| BALCONY / LOGGIA / RAILING | elevation side from `chooseSide`; WEST/EAST axis HYPOTHESIS (§4) | balcony gated by a storey > 0 plan recess; LOGGIA not distinguished; PARAPET role exists but is not read |
| COLUMN_POST / BEAM | none (LVCs on unregistered views are IGNORED, `:1152`) | LVC REJECTED "a stripe, not a volume" (`reconstruct-v2.ts:1147-1158`) |
| EXTERIOR_STEPS | none | none |
| GARAGE_DOOR / WINDOW / EXTERIOR_DOOR / GLAZED_DOOR | plan wall side; sill/head only from a registered view of that side | plan symbol: glazing lines and door swing (`openings-v2.ts:319-321`); no "not a garage door" record |
| Main ROOF / CHIMNEY | ridge axis and chimney views chosen by side (`reconstruct-v2.ts:969`); mirror swap applies | chimney SOURCE_DERIVED when not seen on a view (`:979`); no HIP path |
| UNKNOWN_ASSEMBLY | none | is itself the abstention construct (never COMPLETE) |
| INTERIOR_RENDER | view UNKNOWN on every PR asset (MEASURED §3.2); the camera loop ignores side | none (no interior class). Vision `notFound` (`source-vision/src/schema.ts:98`) and graph unresolved gaps are the only named-absence slots |

## 5. Provenance and role boundaries

### 5.1 Roles are claims

- KNOWN: each `RoleClaim` has `{signal, detail, confidence}`, and all claims are kept in `roleEvidence`
  (`roles.ts:19-28`; `schema.ts:82-92`). The *merged* role carries no confidence (`schema.ts:70-79`).
- KNOWN: `roleEvidence` is excluded from the package content hash (comment `source-package/src/hash.ts:17`; code: the
  hashed asset view at `:40-46` lists caption, roles, selected and variants only), so a change of evidence alone does
  not change the package identity. Roles themselves are hashed (`:42`) (R3-24, relevance).
- MEASURED: signals in 8 sealed packages: caption 233, url-slug 68, context 43, channel 26, endpoint 10. **No
  `conflict` signal occurs** in any of them. `conflict` is a code path, not an observed signal (R3-23 verifier).
- KNOWN: nothing downstream overwrites roles. Frames copy them (`builder.ts:126`), `analyze.ts:193` copies them into
  vision requests, and `reconstruct-v2.ts:169`, `run.ts:154-156` and `cross-source.ts:93-95` read them as given
  (R3-24, as corrected).
- KNOWN: a vision answer cannot change a role. Roles are request input only, and the response is strict (§3.5).
  The model is, however, *primed* with a possibly wrong role (`anthropic.ts:88`) and has no structured way to dispute it
  (R4-15).
- KNOWN: nothing checks that a graph's frame roles match the package (R4-22). So "observations must not silently
  override roles" holds today only because no producer writes roles. No validator enforces it.
- KNOWN (code; retagged in the final pass): `TECHNICAL_DOCUMENTS` includes SITE_PLAN, and the classify step chooses
  SOURCE_INCOMPLETE over NO_DRAWINGS when any technical document exists (`analysis-service/src/run.ts:154-156,252-265`),
  so tagline-misclassified SITE_PLAN renders count as technical documents. HYPOTHESIS (outcome): a real DobreDomy page
  without plans or elevations would end with SOURCE_INCOMPLETE instead of NO_DRAWINGS (R3 missed). Test: drop the FP/EL
  assets from D02 and run the classify step.

### 5.2 Authority and fidelity vocabularies

| vocabulary | values | where | tag |
|---|---|---|---|
| model EvidenceStatus | SOURCE_EXACT, SOURCE_CORROBORATED (the only hard ones, `evidence.ts:30`), SOURCE_DERIVED, GEOMETRIC_INFERRED, VISUAL_INFERRED, … | `model/src/evidence.ts:15-32` | KNOWN |
| EvidenceSource.kind | DRAWING, PHOTO, RENDER, PUBLISHED_FACT, MANUAL, DERIVATION, OTHER. **PHOTO and PUBLISHED_FACT are never produced** (`architecture/src/hypotheses/emit.ts:69-88`; v2 writes no evidence sources). | `evidence.ts:64-72` | KNOWN (R2-C27, as corrected) |
| v2 ProvenanceStatus | SOURCE_EXACT, SOURCE_CORROBORATED, SOURCE_DERIVED, IMAGE_METRIC_REGISTERED, VISUAL_SEMANTIC, ASSUMED_FOR_RENDERING, UNRESOLVED | `reconstruction/src/v2/graph.ts:140` | KNOWN |
| architecture SourceAuthority | PRINTED_DIMENSION > TECHNICAL_GEOMETRY > CROSS_VIEW > PERSPECTIVE > VISUAL_INFERENCE > CONVENTION | `architecture/src/authority.ts:19` | KNOWN |
| 005Q interface rule (design, not code) | an image value enters as IMAGE_METRIC_REGISTERED or VISUAL_SEMANTIC → VISUAL_INFERRED, **never SOURCE_\***; one picture is one source | `exterior-feature-interface.md:182-190,372-378` | KNOWN (R1-C19: labelled "design, not code") |

### 5.3 What is forbidden for render-derived facts, and where it leaks

- KNOWN (enforced in code): only SOURCE_EXACT and SOURCE_CORROBORATED are hard (`evidence.ts:32`), and `v2/verify.ts:280`
  refuses corrections of those (R1-C19 verifier).
- KNOWN (**leak 1**, widened in the final pass): in `resolveQuantity`, **any** lower-authority candidate within
  `max(tol(kept), tol(c))` of the kept value counts as corroboration (`authority.ts:87`), with default tolerances
  PERSPECTIVE 0.25 m, VISUAL_INFERENCE 0.4 m and CONVENTION 1.0 m (`authority.ts:64-71`). A corroborated
  TECHNICAL_GEOMETRY value becomes SOURCE_CORROBORATED, which is hard (`authority.ts:30-31,97-101`; used at
  `architecture/src/hypotheses/emit.ts:321,517,608-609`) (R2 missed). The only independence check is a different
  `sourceId` (`authority.ts:97-100`). Off the product path (§3.7).
- KNOWN (**leak 2**): the pergola, canopy, carport, entrance and step-landing assemblies and their relationships are
  hard-coded to `CROSS_VIEW`, giving GEOMETRIC_INFERRED, whatever their inputs
  (`architecture/src/hypotheses/emit.ts:437,485,535-536,611-612,630-631`) (R2-C16). Together with §3.7 (single-frame
  ACCEPTED), a render-only pergola could be labelled GEOMETRIC_INFERRED. Off the product path.
- KNOWN (**leak 3**): exclusions ignore authority (`fuse.ts:92`). A render "sky" (NO_COVER_OBSERVED) vetoes CANOPY
  (`architecture/test/hypotheses.test.ts:57-66`) (R2-C17).
- KNOWN (**leak 4**): `independentAssets` is incremented +1 without assetId dedup when a plan balustrade sighting is
  added (`reconstruct-v2.ts:1249`, re-checked; 005P X21). L2 is granted at `independentAssets ≥ 2` (`quality.ts:55`),
  so a RAILING can reach L2 without two independent assets (R1 missed).
- KNOWN (**leak 5**, product path, final pass): hard SOURCE_CORROBORATED is written for features read off registered
  elevation rasters, which may be photo-real renders (§3.0): the verge ROOF_MEMBER when the plan recess has returns
  (`reconstruct-v2.ts:1028-1029`); the gable FACADE_ASSEMBLY unconditionally (`:1036`); the portal head from a fascia
  band on the FRONT view (`:1085,1088`); a chimney seen above the roof on a registered view (`:979`, `renderFrames` from
  `v2/roof-details.ts:192`). The status survives emission (`reconstruction/src/v2/emit.ts:55-58`) and is propagated to
  the roof as `edgeMembers.fascia` (`:397`). So "a render cannot become hard" does **not** hold on the product path. Each
  site pairs the raster reading with plan structure, so whether it is wrong is a judgement; the code fact is KNOWN.
- KNOWN: the BuildApp language *allows* PERSPECTIVE metric values (default tolerance 0.25 m) when nothing higher states
  the quantity (`authority.ts:1-16,64-71`; `docs/ARCHITECTURAL_LANGUAGE.md:131-141`). The stricter sentence "Obraz
  perspektywiczny nie ustala żadnego wymiaru" is in `/home/user/BuildPlan-PC-Legacy/CLAUDE.md:452`, which governs
  a different (Kotlin) repository (R2-C12 verifier). Adopting it for 005R JSON is a recommendation (§9), not a fact
  about BuildApp.
- KNOWN: the language says "Representable is not recognized" (`docs/ARCHITECTURAL_LANGUAGE.md:125`), and its eight
  demonstrations are "the plumbing a detector plugs into, not production recognition" (`:173-179`).
- KNOWN (inherited 005Q rule): "a proposal never sets a dimension, a face or a SOURCE_\* status"
  (`analyzer-005q/recommendation.md:71-78`; R1-C18).

## 6. Ownership of typed JSON

| typed JSON | schema / file | owns | coordinates | source link | role authority | tag |
|---|---|---|---|---|---|---|
| SourcePackage | `buildapp.source-package`, `source-package/src/schema.ts:268-300` | assets, variants (byteHash, decoded size), **roles (5 dims) + roleEvidence**, caption, publishedFacts/Rooms/Specifications, adapter | none | canonicalUrl, project.externalId, variant byteHash | **sole owner of roles** | KNOWN (R4 T4) |
| SourceObservationGraph | `buildapp.source-observation-graph` 1.0.0, `source-observations/src/schema.ts:375-392` | 2D observations, relations, conflicts, unresolved gaps, extractors | pixel and normalized | assetId + variantByteHash + frameId + pixelGeometry; sourcePackageId/Hash | none (an unvalidated, string-typed, hashed copy of roles; §3.4) | KNOWN |
| VisionObservationResponse (transient) | `source-vision/src/schema.ts:90-101` | one answer, for one task and one image, plus `notFound` | normalized [0,1] | echoed assetByteHash | none (roles are input) | KNOWN |
| VisionTrace | `source-vision/src/reasoner.ts:60-73` | raw response, latency, tokens | — | assetId + byteHash | none | KNOWN |
| ArchitecturalEvidenceGraph (v2) | `buildapp.architectural-evidence-graph`, `reconstruction/src/v2/graph.ts:25-75` | features (OPENING, BALCONY, RAILING, TERRACE, CAMERA …), provenance, dispositions | world metres | SourceSighting {frameId, assetId, viewFamily, observationIds, pixelRect} | reads roles to choose the view family (`reconstruct-v2.ts:169`) | KNOWN. MEASURED (005Q): the feature graph is written only by a research script (R5 missed, `exterior-feature-interface.md`) |
| SemanticProposal (architecture) | `architecture/src/proposals.ts:64-86` | detector evidence (VLM allowed), optional `featureKey` | world Vec3 | sourceFrameId only | none; not on the product path | KNOWN |
| Building model / program | `packages/model` schema; `reconstruction/src/v2/emit.ts` commands | canonical assemblies, openings, terraces … | world metres | evidence/setEvidence entries | none | KNOWN |
| 005R research artifacts | `research/analyzer-005r/` (`truth.py`, `contenders.py`, `schema/`, …) | router truth, contenders, JSON schema | — | — | research only, isolated from production | KNOWN (R4 missed: `contenders.py:1-12`; `truth.py` re-checked) |

KNOWN: none of the shipping schemas can hold a whole-asset router class with uncertainty, or the 005R assembly labels
WINDOW/EXTERIOR_DOOR/GARAGE_DOOR/RAILING/COLUMN_POST/COVERED_TERRACE as an `AssemblyKind` (`schema.ts:912`; R2 missed).

## 7. Source-asset, edition and variant identity, and copy lineage

### 7.1 Identity levels (KNOWN)

| level | key | where | across packages? |
|---|---|---|---|
| edition / page | `canonicalUrl`: the declared same-domain canonical, normalised, else the normalised fetched URL | `logical-url.ts:114-139`; `acquire.ts:186` | **no edition, version or family field.** `grep -w edition` over packages gives 0 hits (R3-15) |
| project | `project {externalId?, name?, publisher}`. ARCHON `m<hex>` (`archon.ts:43-44,318-338`); generic sku/productID/mpn or a hex segment ≥ 10 (`generic/index.ts:60-72`) | `schema.ts:279-294` | — |
| package | id `stableId('src', externalId ?? hostname, {canonicalUrl})` (`acquire.ts:185`). `contentHash` includes project, adapter and roles and **excludes** canonicalUrl, requested/fetched URL and pageHash since 1.2.0 (`hash.ts:14-28,42,51`) | — | — |
| asset | `stableId('asset', captionSlug, {key, byteHashes})` (`acquire.ts:332`) | — | **differs per edition for identical bytes** |
| variant | `byteHash` = SHA-256 of the bytes; id `stableId('var', filename, {byteHash})` (`acquire.ts:152,160`). selected = largest decoded area, then byteLength, then byteHash (`variants.ts:81-83`; `acquire.ts:337`) | — | not compared across packages |
| frame | `stableId('frame', assetId, {assetId, variantByteHash})` (`source-observations/src/ids.ts:23`) | — | — |
| observation | from assetId, variantByteHash, kind, hints, normGeometry, value, provenance; **not roles** (`ids.ts:48-57`) | — | — |
| graph | `stableId('obsgraph', sourcePackageId, {sourcePackageId, contentHash})` (`ids.ts:74`); contentHash includes frame roles (`hash.ts:44`) | — | — |
| crop | aspect > 2 % from the reference → own asset (hash input `<key>#crop-<hash8>`) plus `DIFFERENT_CROP` | `acquire.ts:297-315` | — |
| byte duplicate | union by byteHash plus a `BYTE_IDENTICAL` failure | `acquire.ts:262-296` | within one package only |

- KNOWN documentation drift: `docs/SOURCE_PACKAGE.md:185-186` still says the hash "covers the canonical URL, page hash"
  (R3-16).
- KNOWN: a crop or resize that shares no groupKey and no bytes is an independent asset, and nothing records "derived
  from". MEASURED cases: g2e `widok 1` at `__259` (200×150) and `__289` (800×600) are two PR assets, and `__260`/`__290`
  likewise. D00 `mars_w1.jpg` (`/dd_files/`, 1865×1200) and `mars_w1.jpg?p=prslide` (`/img/projekty/`, 784×504) are two
  assets. Whether each pair is the same picture is a HYPOTHESIS (R3-19). Test: an offline perceptual hash.
- MEASURED: byte-identical images across assets *within* packages: 0 of 45 packages. Near-duplicates are UNAVAILABLE,
  because no perceptual hash was run (`exterior-feature-interface.md:178,336`).
- KNOWN: independence is counted by distinct `assetId` at creation (`reconstruct-v2.ts:202-213`), but this is violated at
  `:1249` (§5.3). In the architecture pipeline it is counted by distinct `sourceFrameId` (`fuse.ts:54-55`), and a shared
  `featureKey` merges frames unchecked (§3.7). "Counted by content lineage" is a required future rule, not current
  behaviour (R1-C19, R1-C20, as corrected).

### 7.2 Shared byte-identical images across editions (MEASURED)

- All 5 `w2` interior renders (a day-zone interior caption, 1600×1600) are byte-identical between g2e
  (`m84f2903cb8e14`, `__60824-60828`) and e-OZE (`m738275b7537b0`, `__60744-60748`). Asset ids differ
  (`…-415e0cdd54` vs `…-fe995e9210`). Variant ids share the filename content-hash token and the byteHash-derived suffix
  (for example `…-d462240dc46d62deb-b2889835ae`) (R3-20, as corrected).
- KNOWN: nothing detects this. ARCHON accepts only the current code's paths (`archon.ts:358-361`), and
  `cross-source.ts:93-95` compares only role counts.
- HYPOTHESIS: a pooled corpus would count the same interior picture twice, as evidence from two editions. Test: a
  cross-package byteHash ledger over the 005R corpus.

### 7.3 Edition conflation of the dev row "rarytasy-g2e" (MEASURED)

- The dev case `rarytasy-g2e` is `https://www.archon.pl/projekty-domow/projekt-dom-w-rarytasach-5-g2e-m84f2903cb8e14`,
  "Dom w rarytasach **5** (G2E)", externalId `m84f2903cb8e14`, contentHash prefix `02963768`
  (`/home/user/work005i-a/m-on/rarytasy-g2e/source-package.json`; R3-21).
- It is **not** the OWNER anchor `…/projekt-dom-w-rarytasach-g2e-m3ea28300f9b3e` "Dom w rarytasach (G2E)". `grep -rl
  m3ea28300f9b3e` over the repo returns nothing. Every repo use of `rarytasy-g2e` points at `m84f…`: CI `SECOND_HOUSE_URL`
  (`.github/workflows/buildapp-ci.yml:439,661`; `ui-evidence.yml:40`), research case manifests and stage-report packages
  (R3-22). In the 005R scratch area the anchor appears only in `/home/user/work005r/edition-universe.json:19,203` and
  `html/*`.
- MEASURED (synthesizer re-check): in the text of `/home/user/work005r/html/rarytasy-g2e.html`, 60 lines contain
  `m3ea28300f9b3e` and 0 lines contain `m84f2903cb8e14`. R6 reports 81 occurrences and the canonical link to `m3ea…`.
- MEASURED (R6-02, R6 unverified): the anchor's published numbers differ from G2E-5 on every figure except the garage
  (35.52). Anchor net 89.85 against 110.68, footprint 165.13 against 189.77, roof 191.26 against 219.77. The anchor's 12
  non-garage rooms equal the e-OZE (`m738…`) table except the boiler room (4.37 against 4.56). The anchor's
  `same_versions` list contains `m738…` and not `m84f…`. So e-OZE is the closer published proxy. Neither edition is the
  anchor.
- KNOWN (blurring in docs, R6-22; citations re-checked in the final pass): `research/analyzer-005q-chain/cases.json:60`
  names the case without the "5". `stage-reports/artifacts/rarytasy-generalization/README.md:3` and
  `PROJECT_STATUS.md:545` call "Dom w rarytasach 5 (G2E)" the owner's second (test) project.
  `analyzer-005q/recommendation.md:91` says "Rarytasy (the OWNER's anchor)" with no edition code. Explicit pinning
  exists in the 003B report (`:121`) and in the 005R preregistration (`research/analyzer-005r/preregistration.md`).
- Consequence (inference): fidelity findings on `rarytasy-g2e` (the 55.7 m² front terrace, the pergola, the entrance
  canopy) are specific to G2E-5. They must not be presented as findings about the OWNER anchor house.

## 8. Why Rarytasy-like exterior parts get lost: causal description

### 8.1 Stage by stage

1. **Acquisition.** The structural interior/exterior signal (`data-fancybox-position`, `fancybox3Interiors`) is not read
   (KNOWN, `archon.ts:46,152`). The OG_IMAGE channel wins the caption choice and carries none, so 21/37 g2e assets have
   `caption: null`. The interior wording survives only in `roleEvidence.detail`, truncated to 80 characters and not
   hashed, and in the URL path segment (`/w1/ /w2/ /k3/ /l3/`) (MEASURED, R3-07, as corrected).
2. **Roles.** Interior and exterior visualisations both become PERSPECTIVE_RENDER. ELEVATION mixes technical and
   photo-real orthographic renders. A photo has no role (KNOWN, §3.2).
3. **Analysis.** Interior renders go through facade CV and produce exterior-vocabulary observations (MEASURED, §3.3).
   CV cannot name a terrace, pergola, canopy, carport or steps at all, and names a column only as a hint (KNOWN, R4-19
   as corrected, R4-20).
4. **Observation graph.** It has no slot for those assemblies or for an asset class (KNOWN, R4-23).
5. **Vision.** Not run in any product or default path. If it were configured, it is remote and receives interiors as
   facades (KNOWN, §3.5).
6. **Text.** Publisher prose naming a pergola over the terrace, a covered entrance or a fully roofed terrace is
   never parsed (R6-08, R6-09, R6 unverified). KNOWN: the specification reader handles only the `roof`, `knee_wall` and
   `walls` keys (`source-metrics/src/specifications.ts:136,176,185`); `cross-source.ts:135-136` reads only `roof`.
   KNOWN: ARCHON `SPEC_KEYS` also produces `garage_door` (`archon.ts:220`), `stairs` (`:222`) and `terrace`
   (`/^taras|^balkon/`, `:223`), none of which has a consumer (grep). MEASURED (final pass, retagged): over the 24 sealed
   packages under `/home/user/work005i-a/m-on/`, `publishedSpecifications[].key` never contains `terrace` or `stairs`
   (g2e, e-OZE and jarzabem included) and contains `garage_door` in 11.
7. **Reconstruction.**
   - Terraces exist only where a storey-0 dimensioned zone exists (KNOWN, `reconstruct-v2.ts:1098`).
   - A zone with zero return walls is still pushed as a recess. Its own `why` says "a zone, not a recess"
     (`reconstruct-v2.ts:689-690`, `recesses.ts:171-173`, re-checked).
   - Elevation LVCs survive only if they hit a verge member (main ridge along Z, `:1019`) or a balcony fascia. Otherwise
     they are REJECTED "a stripe, not a volume" (`:1147-1158`, re-checked).
   - Cover over zones requires every side view to be registered and wider than the walls (`:601-608`, re-checked).
   - The main roof kind is hard-coded `'GABLE'` (`:613`, re-checked). No `'HIP'` literal exists in
     `reconstruction/src/v2/*.ts` (grep, re-checked).
8. **Architecture/model.** Producers for PERGOLA, CANOPY and CARPORT exist only in `packages/architecture`, which is off
   the product path (KNOWN, §3.7). The model can hold them, but nothing in production writes them.

### 8.2 Observed examples with a located first bad operation

The code lines below were re-checked by the synthesizer. The model state was re-counted from the C0 `model.json` files.
The judgement "wrong" relies on publisher text or on 005Q's raster-checked inventory (a documented claim), never on
images viewed here.

| # | case | publisher / prior evidence | model state (MEASURED) | first bad operation | tags |
|---|---|---|---|---|---|
| A | rarytasy-g2e (G2E-5, `m84f…`) | 005Q inventory: the region east of the garage is open ground with a paved path, a dashed overhead line and a planter (documented claim). Text: "<publisher text, not quoted in Git>" (R6-08). | `terrace-front-0` (12.7 m²) and `terrace-front-822` (≈ 55.7 m²), both surface UNKNOWN, "floor of the front recess", SOURCE_DERIVED, TERRACE L2:2. TOPOLOGY recesses 1, returns 0 (R6-04, R6-11). | `reconstruct-v2.ts:689-690` pushes a zero-return zone into `recesses` (its `why` reads "a zone, not a recess", `recesses.ts:171-173`). `:1098-1123` then emits each open interval as a TERRACE with hard-coded SOURCE_DERIVED (`:1121`). | code KNOWN; state MEASURED; "first bad" = R6 inference over both |
| C | dom-pod-jarzabem | Text: "<publisher text, not quoted in Git>", "<publisher text, not quoted in Git>" (R6-08). | 8 terraces including `terrace-rear-0` at z 11..13.5 (re-counted: 8). Roof-main GABLE Z with footprint z 1..11. ELEVATION_REGISTRATION 0/3, all AMBIGUOUS (R6-07, R6-14). | Elevation registration fails for all three views. Then `zoneVotes` is empty, so `coversZones = zoneVotes.length > 0 && …` is false (`reconstruct-v2.ts:601-608`), the roof stops at the walls, and the terrace stays uncovered. The roof note "the side renders span the walled depth only" is printed for *any* false `coversZones` (`:613`), so it is misleading when no view registered. | code KNOWN; state MEASURED (R6, unverified apart from the terrace count); "first bad" = inference |
| C′ | dom-pod-jarzabem | spec "czterospadowy, nachylenie 30 st." | GABLE (re-checked) | v2 hard-codes `kind: 'GABLE'` (`:613`). The spec reader's HIP rule (`specifications.ts:71`, re-checked in the final pass) is ignored. | KNOWN / MEASURED |
| X | rarytasy-g2e interiors | day-zone, kitchen and bathroom interior captions (not quoted in Git) | 19 interior PR frames carry RIDGE, OPENING, LOGGIA and other observations (R3-12) | Role assignment: `archon.ts:98` maps "wizualizacja" to PERSPECTIVE_RENDER (the schema has no interior class, `schema.ts:45`). `analyze.ts:164` then routes it to the elevation extractors. | KNOWN / MEASURED |

### 8.3 Where the first bad operation is UNAVAILABLE

- **B, the missing pergola-covered garden terrace (g2e and e-OZE).** The text states it in both editions (R6-08). Neither
  model has a rear terrace, a pergola or any assembly (re-counted: terraces 2 and 0, assemblies 0 and 0). The structural
  causes are KNOWN: there is no rear zone (TOPOLOGY recesses 1 and 0); `members` is empty because the ridge is along X
  with 1 level (re-checked), so every elevation LVC is rejected; there is no PERGOLA producer; the prose is unread.
  The **observation-level** first bad operation is UNAVAILABLE, because no ledger was saved. HYPOTHESIS R6-13: some of
  the 54 (g2e) or 25 (e-OZE) elevation LVCs are pergola members. Test: a replay with the serialized ledger, checking the
  LVC dispositions on rear and side frames.
- **D, jarzabem's garage door.** The publisher states HÖRMANN and a 33.53 m² garage. The model has no garage-width
  PANEL door. Which gap, if any, is the garage door is UNAVAILABLE without pixels (R6-15).
- **The OWNER anchor `m3ea…`.** UNAVAILABLE: there is no package and no run (§1.4).

## 9. Implications for the 005R design

These are recommendations derived from the facts above. Each cites the fact it rests on.

1. **A separate research envelope, never a production type.** No shipping schema has the 11 router classes
   (DocumentRole and ViewFamily lack INTERIOR_*, *_PHOTO and OTHER; `schema.ts:45`, `graph.ts:55`). AssemblyKind lacks
   WINDOW, EXTERIOR_DOOR, GARAGE_DOOR, RAILING, COLUMN_POST and COVERED_TERRACE (`schema.ts:912`). Do not force router
   output into `DocumentRole`, `AssemblyAlternative` (its `kind` is AssemblyKind) or `SemanticProposal` (strict and
   world-metric only; `proposals.ts:53-95`). Do not write roles back: that changes the package `contentHash`
   (`source-package/src/hash.ts:42`) and the graph content hash and graph id (`source-observations/src/hash.ts:44`,
   `ids.ts:74`). Asset, variant, frame and observation ids do not include roles (§7.1), so they would not move (R3-24,
   as corrected in the final pass). No geometry is emitted (§1.5).
2. **Key every record by** `sourcePackage.contentHash` + `canonicalUrl` + `project.externalId` + `assetId` +
   `variant.byteHash` + pixel rect in decoded pixels. Carry the edition code explicitly, because the schema has no
   edition field (§7.1).
3. **Link, don't replace.** Use optional link fields to `ViewFamily` (for example EXTERIOR_RENDER → PERSPECTIVE, with
   TECHNICAL_ELEVATION and a photo-real orthographic render both ↔ ELEVATION), `EvidenceSource.kind` (PHOTO/RENDER/DRAWING),
   observation ids, SourceSighting ids, `featureKey`, and the 005Q exterior *stretch* (frame, axis, interval, inward
   sign), not body ids (`exterior-feature-interface.md:289-322`; R1-C17). Where no stretch exists, say so explicitly.
4. **Abstention and absence are first-class.** Mirror the 005P SourceObservation template: producer {name, version,
   modelSha}, alternatives never dropped, uncertainty `calibrated: false | posterior`, missing
   NOT_DETECTED/BELOW_LEGIBILITY/OUT_OF_SCOPE (`target-contracts.md:14-77`; R1-C26). Note that its
   `SourceRef.transform` fixes `mirrored: false` (`:29`), so it needs a mirror/side-uncertainty field (six side
   vocabularies coexist; R1-C25; `SIDE_*` untested, §4.1). The vision schema's `notFound` (`schema.ts:98`) and the
   PERGOLA `NO_COVER_OBSERVED` requirement (`capabilities.ts:275`) are the existing precedents for named absence;
   provider confidence is uncalibrated today (`apply.ts:79`).
5. **No metric fields on perspective or photo observations.** Adopt the stricter rule for the research JSON (§5.3).
   005R values enter only as VISUAL_INFERRED-class hints, never SOURCE_\*, and one picture is one source (R1-C19).
   Corroboration through a lower-authority tolerance window (leak 1) must not be reproduced.
6. **Independence by content lineage.** Use a cross-package byteHash ledger, plus a perceptual near-duplicate check
   that runs locally. The 5 shared w2 renders (§7.2) are a ready negative control for cross-edition mixing. Do not reuse
   `sourceCoverage.independentAssets` (leak 4).
7. **The router must split ELEVATION** (technical vs photo-real orthographic) as well as PERSPECTIVE_RENDER (exterior,
   interior, photo) (§3.0).
8. **Truth circularity.** `research/analyzer-005r/truth.py` takes INTERIOR_RENDER and EXTERIOR_RENDER truth from
   `fancybox3Interiors` and `fancybox3ProdBigImg*` (re-checked, `truth.py:10-29,50-62`). A contender that reads
   `data-fancybox-position` or the `/w1/ /k3/ /l3/` path segments would be scored against its own input (R3 missed).
   Pixel-only contenders must be scored separately from structure-aware ones, and the metadata baseline must be named
   as such. MEASURED: the URL segment matches the interior caption in 37/37 cases in two packages. As a rule this is a
   HYPOTHESIS (R3-14).
9. **Baselines.** V0 = the publisher role claim (§3.2). Plan-only = the no-image baseline 005Q requires
   (`analyzer-005q/recommendation.md:71-78`). The existing render-frame `cv.openings` output is an unlabelled
   baseline. Its precision is unmeasured (R4-05, R4-06). Do not use production terraces or COVERED_TERRACE labels as
   truth (R1-C12, R1-C14). Do not use DobreDomy roles as labels (§3.2).
10. **Negative pairs.** Inherited plan-pixel negatives: 52 records on 25 rows (`negative-features.json`). There are no
    carport, balcony, railing or steps records, and no render or photo negatives (R1-C15). Required semantic pairs:
    pergola vs roof (louvre gap, `capabilities.ts:282`), parapet/upstand/screen vs railing (`schema.ts:842`), garage
    door vs carport (never scored in 005M, §10), closed garage vs carport, porch canopy vs main roof, glazed terrace
    door vs window (`openings-v2.ts:321`), interior render vs facade, porch vs room, paving edge vs wall, dashed overhead
    line vs wall (R1-C16, as qualified; §4 look-alike rows).
11. **No remote pixels.** Both remote paths (`ANALYZER_VISION=live` and `extract.ts --live`) must stay unused. Overlays
    embed pixels (`overlay.ts:12-13`) and must stay outside the worktree. MEASURED: six git-tracked overlay SVGs under
    `stage-reports/artifacts/source-observations/overlays/` each contain one `data:image` URI (109-685 KB). The 005M
    isolation guard (`research-isolation.test.ts:390`) covers only the 005M harness (R4 missed, re-checked).
12. **The architecture package as a sink is out of scope.** It is off the product path, and its pipeline has leaks 1-3
    (§5.3). 005R observations must not be fed into `runPipeline` without a separate, authorised stage.
13. **Ink channel as an existing technical-vs-render signal** (final pass). `prepare.ts` already computes, per declared
    frame, a "drafting ink rather than colour" field and an adaptive ink mask (`prepare.ts:41,92,102`); nothing routes on
    it (§3.3). A pixel-only contender may re-implement it in research (never import it) and compare it with
    `drawingCharacter`, whose published separation is on orthographic elevations only.
14. **No assumed cross-frame identity** (final pass). The architecture pipeline merges proposals sharing a detector-supplied
    `featureKey` across frames unchecked (`hypotheses/group.ts:4-5,33-36`), which the 005R rule "do not assume identical
    structures across images" forbids. 005R records stay per image; a cross-image link is an evidenced relation, never a key.
15. **No published figures as hints** (final pass). The existing VLM path injects `publishedFacts` with only a prose request
    not to use them (`anthropic.ts:93-97`; `analyze.ts:97,114,195`). The 005R contract forbids published-area fields as
    output hints, so 005R prompts and contenders receive no published figures and no role priming (`anthropic.ts:88`).
16. **No inherited render-derived hard status** (final pass). Leak 5 (`reconstruct-v2.ts:979,1028-1029,1036,1085,1088`;
    `reconstruction/src/v2/emit.ts:55-58,397`) writes SOURCE_CORROBORATED from registered elevation rasters that can be
    photo-real. 005R uses neither these features nor their statuses as truth or corroboration, and never maps to SOURCE_\*.

**Design decisions this audit drove in 005R.** (i) The research role classes exist in research JSON only (item 1).
TECHNICAL_ELEVATION is defined as an *orthographic facade view whatever its shading*, because ARCHON elevations are
often photo-real orthographic renders (§3.0; documented claim plus `plan-openings.ts:4-7`); photo-real vs line-drawn is
a separate attribute, not a class boundary. (ii) The 005R role truth is the publisher page STRUCTURE (carousel
`data-fancybox-position`, page tabs and sections; `truth.py`). V0 (slug/caption) metrics on assets whose truth basis is
not pure STRUCTURE measure metadata agreement, not accuracy (item 8). (iii) Contender N1 is motivated by the KNOWN first
bad operation for interiors: `archon.ts:98` maps "wizualizacja" to PERSPECTIVE_RENDER, the schema has no interior class
(`schema.ts:45`), and `analyze.ts:164` routes it into the elevation extractors (§8.2 X). (iv) Independence is counted
by content lineage, a byte-hash ledger plus perceptual near-duplicate groups, never by `assetId`, which differs per
edition for identical bytes (§7.1, §7.2; item 6).

## 10. Inherited constraints and numbers

| # | quantity | value | scope / caveat | source | tag |
|---|---|---|---|---|---|
| 1 | best small VLM CONFIDENT_WRONG_RATE | 30.9 % (47/152; Wilson 24-39, cluster 24-41). This equals its error rate (HIGH on 100 %). Real 22.7 %, human truth 15.7 %. Best mode is D for Qwen3-VL-2B but C for Qwen3-VL-4B and InternVL3.5-2B (`:103-104`). | Qwen3-VL-2B, mode D, phase 2, **plan crops only** | `STAGE_…005M_VISUAL_REFEREE_V2.md:102-104,368`; `analyzer-005m-vr2/recommendation.md:32-36` | KNOWN |
| 2 | UNRESOLVED answers | 0/760 (Qwen-2B), 14/760 (Qwen-4B), 105/760 (InternVL) | phase 2 | 005M report :102-104 | KNOWN |
| 3 | calibration | AUROC 0.56-0.70 in mode D. No threshold reaches the 0.5 % gate. Frozen phase-1 zero-error regions fail held-out (Qwen-4B 12/127; Qwen-2B 4/18; InternVL 6/18). The p ≥ 0.99 cell was chosen post hoc. | — | 005M report :169-179; recommendation.md:37-46 | KNOWN |
| 4 | counterfactual pairs, both right | context 2/10, 0/10, 0/10; local 1/16, 2/16, 0/16 (chance ≈ 2.5/10) | mode D | 005M report :155-163 | KNOWN |
| 5 | per-class (phase 2, mode D) | CANOPY_PERGOLA_VS_WALL 10 / 40 / 80 % (InternVL / Qwen-4B / Qwen-2B; n = 10, of which 7 REAL_DEV + 1 MURAJACH + 2 SYNTH_CF). TERRACE_VS_BODY 47 / 82 / 94 %. | not real-only | `bakeoff-tables.md:385,393`; `question-corpus.json` | KNOWN / MEASURED |
| 6 | GARAGE_DOOR_VS_CARPORT | 9 questions, all SYNTH_GLOBAL, **all excluded** (finding B-2/D-1), so never scored. LOGGIA_VS_ROOM (4) is all synthetic. | 005M has no measurement of carport vs garage door | `excluded-items.json`; `question-corpus.json` | MEASURED (R1-C33 verifier) |
| 7 | image types measured by 005M | plan crops and whole plans only; **no render, photo or interior** | 005M numbers must not be extrapolated to 005R's tasks | 005M report :59-67 | KNOWN. Transfer is a HYPOTHESIS (R1-C34). |
| 8 | 005M recommendation | RETURN_TO_DETERMINISTIC_BODY_RELATION. No local VLM pilot, no student, no cloud teacher ("rejected on the evidence available"; frontier teacher "unmeasured, not refuted"). NO_AI_GAIN is "too strong". | Its scope is the body-relation decision on plan crops. That it binds a render/photo router is a HYPOTHESIS. | recommendation.md:3-21,88-93 | KNOWN (R1-C05, as corrected) |
| 9 | AI-route reopen conditions | OWNER-authorised GPU; frozen real evaluation set (size per `student-training.md §5`); crop-decidable generator; teacher passing the pair screen | the "598-765 error-free real Qs per class" figure is from the "not now" reasoning (:63-64) | recommendation.md:88-93 | KNOWN |
| 10 | runtime (4-vCPU x86, not a phone) | Qwen-2B ≤ 33.3 s; Qwen-4B ≤ 49.1 s; InternVL ≤ 57.0 s; SmolVLM2 ≤ 61.4 s. Phone ≈ 9-17 s flagship / 30-80 s mid-range is an estimate. | image tokens 87-96 % of a mode-D prompt; vision tower alone 34-77 % | `runtime-size-matrix.md:26-47`; 005M report :194-216 | KNOWN |
| 11 | size / RAM | smallest files 1.552 / 2.951 / 1.625 / 1.705 GB (quality unmeasured; accuracy is for Q8_0+F16). RAM ≈ 2.1 / 3.6 / 2.2 / 2.4 GB, estimated. | the Play AI-pack page names only LiteRT/MediaPipe (`:108`) | `runtime-size-matrix.md:12-15,80-83,105-112` | KNOWN |
| 12 | Play AI pack cap | 1.5 GB compressed per pack | read 2026-10-07 | `runtime-size-matrix.md:106` | KNOWN |
| 13 | licences | all commercial routes CONDITIONAL on counsel. SmolVLM2 mix ≈ 77.5 % academic/NC. InternVL3.5 "Built with Qwen" is a counsel question. Gemma 3n is gated. | engineering due diligence, not legal advice | `licensing-matrix.md:8-18`; 005M report :277-291 | KNOWN |
| 14 | 005Q-CHAIN | ADOPTION NONE. G1 material known-good changes: C3 2, N1 5, C1 11, C1N1 11, C2 12, C4 14. FREEZE IDENTICAL. Label truth is machine-made (19/110 binding). Blinds 9-12 are development rows. "005R (visual pilot) unchanged and pending" (`PROJECT_STATUS.md:55,1245`). | — | `STAGE_…005Q_CHAIN_…md:3-5,17,36-42,339-340,399-403` | KNOWN |
| 15 | 005Q-CHAIN exterior side effects | N1: marcowki loses balcony-front-1 and one railing but stays PASS. jarzabem loses COVERED_TERRACE 12.6 under C1/N1. C1N1 closes the jarzabem porch. G1 cannot see room outlines or sub-resolution opening shifts. | footprint PASS does not protect exterior features | `…CHAIN…md:210-232` | KNOWN |
| 16 | 005Q-OCR | NO_GAIN on measured labels (B0 45 vs B1 46 of 51); +1.78 MB; 10-31 s/sheet reading on x86. Human review NOT_RUN (no reviewer, and images not allowed to reach a model). A 20-label spot-review request was prepared. "005R unchanged, pending" (`PROJECT_STATUS.md:54,1267`). | — | `…005Q_OCR…md:13,24,70-71,153-164` | KNOWN |
| 17 | 005Q-SGEB | layout 1.2.0 (N1a, `7eddd7b`). 1/46 rows changed (glogownikach 3→0 terraces). 0 known-good changes. Blind 12: tymianku −5.48 %, daliach +0.39 % with PIER-family PAVED terraces. TARGET_CLASS_EXERCISED = NO. PARTIAL. | — | `…SGEB…md:3-9,21,28,208-211` | KNOWN |
| 18 | 005Q-SGEB process | S0 24 completed / 19 PASS; mutants 38/40; perf ratio max 1.04. R2B-01 (C1 changes openings with no new evidence) at `post-review/round-2.md:13`. | — | `…SGEB…md:17,24-27` | KNOWN |
| 19 | 005P | 44 dev rows; mutants 30/30; per-case perf ratio max 1.09 (rarytasy-eoze), threshold 15 %. 005H ARM64 parity PENDING. Verdict PARTIAL. | x86 | `…005P…md:15,21-27,207,369-382` | KNOWN |
| 20 | 005P ADR | "role classification checked against pixels" is deferred to horizon LATER (`:33-34,61`). Each deferred item is a separate stage, and "no item is fixed on the way" (`:35,53`). | scoped to 005P decisions; "forbids" overstates it | `architecture-adr.md:3-61` | KNOWN (R1-C27, as corrected) |
| 21 | exterior census (24 completed B0, at `04d5568`) | 29 terraces (17 slivers); BALCONY 2 + railings 2 (marcowki only); LOGGIA/CANOPY/ENTRANCE/CARPORT/PERGOLA/COLUMN/UNKNOWN_ASSEMBLY 0; COVERED_TERRACE 12 and RECESSED_ATTACHED 8 body labels; 13/24 rows register ≥ 1 elevation. At base, after layout 1.2.0 (row 17): at most 14 slivers of 26 terraces (derived, not re-measured). | the census predates layout 1.2.0 | `exterior-feature-interface.md:36-46,198-224`; `…SGEB…md:17` | MEASURED at `04d5568`; base figure derived |
| 22 | negative controls | 52 records / 25 rows (27 on 15 of 19 PASS rows); truthBasis 21 "KNOWN raster", 4 "INFERRED raster" | plan pixels only | `negative-features.json`; inventory :22-27 | MEASURED |
| 23 | OWNER APK | `owner-preview-latest`, versionCode 1212, untouched | must stay untouched; no APK published | `…CHAIN…md:40`; `PROJECT_STATUS.md:1349` | KNOWN |
| 24 | process gates | freeze manifest IDENTICAL; no publisher image, crop or weight in git (005M `history_gate.sh` checks magic bytes); research harness never imported by production (`research-isolation.test.ts`); no cloud OCR or remote AI; no APK, no blind round | 005R freeze manifest committed at `0d02e53` | 005M report :5-6,19-25; OCR :3,41; CHAIN :3,41-42; §1.1 | KNOWN / MEASURED |
| 25 | Rarytasy | development material with strict variant identity, never a blind draw (`dom-w-rarytasach` is on the round-12 exclusion list) | the dev row is G2E-5 (`m84f…`), not the anchor (§7.3) | `analyzer-005q/recommendation.md:91-92` | KNOWN |
| 26 | Azaliach | 005Q baseline-44 at `04d5568`: FAILED, PLAN_RESOLUTION_INCONCLUSIVE ("the lowest storey covers 6.27 m² against the 69.69 m² the publisher prints"). The 005C terrace artifacts are not reproducible on later code. | do not label from model output | `stage-reports/artifacts/analyzer-005q/baseline-44.json` | MEASURED (re-checked) |
| 27 | local VLM harness | `research/analyzer-005m` runs llama-server with `--mmproj` (`run_model.sh:14`), weights outside the repo, fenced by `research-isolation.test.ts:297-303,429-433` | reuse or account for it; do not import it into production | re-checked | KNOWN |
| 28 | 005M error correlation | Mirror consistency 90–100 % of the 14 answered mirror pairs, errors stable under the mirror: "consistently wrong, not noisy" (`:166-168`). Requiring all five modes to agree "still leaves 28.6 % wrong" (`:171-172`). | plan crops; ensembles of modes do not decorrelate errors | `STAGE_…005M_VISUAL_REFEREE_V2.md:166-172` | KNOWN (final pass) |

## 11. Critic items not applied

Every critique item in (a)–(d) was confirmed at its cited code or document and applied. The exceptions and
partial applications are these:

| item | what was not applied as given | reason |
|---|---|---|
| (a)6 `hypotheses/geometry.ts` | no claim added | the critique names the file as uncited but states no fact from it; not read (§1.4) |
| (a)7 `source-vision/src/validate.ts` | no claim added | named without a fact; not read (§1.4). `apply.ts:79` and `schema.ts:98` were confirmed and applied |
| (a)9 line numbers `ARCHITECTURAL_LANGUAGE.md:105-108`, `:119-125`, `:174-180` | applied at the lines where the text actually is: `:110-112`, `:125`, `:173-179` | the cited ranges are off by a few lines; the content was confirmed |
| (b)6 "at most 14 of 26 at HEAD" | applied as a derived figure, not as MEASURED | it is 17−3 and 29−3 from two MEASURED reports (005Q census at `04d5568`; SGEB glogownikach 3→0); no census was re-run at base |
| (c)5 "single-frame ACCEPTED is KNOWN" | applied with a qualification | KNOWN only for groups with at least one proposal above VISUAL_INFERENCE (e.g. PERSPECTIVE): an all-VISUAL_INFERENCE single-frame group is held back at `fuse.ts:134` before the ACCEPTED branch |
| (d)4 `NO_COVER_OBSERVED` at `capabilities.ts:276` | applied at `:275` | the requirement is on line 275; line 276 closes the array |
| (b)7 room "Taras" → `createRoom usage` | kept as HYPOTHESIS | `reconstruction/src/v2/emit.ts:323` passes `room.label` as `usage`, but whether a published "Taras" row ever becomes a room label needs the proposed replay |
