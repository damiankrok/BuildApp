# Council F — Canonical Model / Invariants (BUILDPLAN-ANALYZER-005A pre-audit)

Repo `/home/user/BuildApp` @ `7cd8e0c`, read-only. Scratch probes (vite-node, outside both repos) are in
`.../council/F-work/` (`probe.ts`, `probe2.ts`, `probe3.ts`, `hash-probe.ts`, `closure-*.ts`, `diag-probe.ts`).
Every "PROBE" below is a run I made against the repo's own code; every path:line was read.
Model files used: `.../before/{kosacce-clean,marcowki,rarytasy-g2e}/model.json` (the real desktop runs).

---------------------------------------------------------------------------------------------------

## 0. Answers in one screen

| Question | Answer |
| --- | --- |
| Q1 hard invariants | Referential integrity, positive dimensions, `WALLS_OVERLAP` (exact: 1e-6 m² of plan area per wall pair, shared height range), junction/ring impossibilities, opening-in-host, roof-plane/edge geometry, assembly-honesty codes, `serializeModel` refusal, `verifyReplay` byte identity. **The model has NO semantic-coherence validators** (roof over walls, level stacking, wall height vs level, ground level present): PROBE accepted a roof 50 m from the walls, a model with only an upper level, and a 7.05 m wall on a 2.8 m level. |
| Q1 emission failure | `MODEL_EMISSION_FAILED` keeps only flat strings (command index/id, codes, wall ids, max measured, 200 chars of message). The valid prefix (`fit.program`), the `fits`, the planner decisions and the `BuildingV2` are **discarded**. The path has **zero tests**. |
| Q2 hash | `SOLVER_V2_VERSION` enters the **candidate** hash (`solver` label) and the **hypothesis-set** hash/id (`hashArtifact` version argument). It does **not** enter the model JSON, the model hash or the scene hash (PROBE). 004A's "the solver version bump is part of every model hash" (`STAGE_..._004A...md:364`) is factually wrong. `identityOf` label/modelId **do** enter the model hash (PROBE). So does the prose of every `setEvidence.interpretation` (10-13 % of model bytes). |
| Q3 coarse model | Contract C1-C7 in §3. Uses only existing DSL: one MAIN ring + slab per storey + level(s) with model-level evidence + optional stated-pitch roof + `UNKNOWN` assemblies for unresolved wings. |
| Q4 closure audit | The 8 Kosaćce `exteriorErrors` are **one real emitter defect**, not audit noise: 8 = the 2 attached bodies × 4 ring walls whose top ends exactly in the plane of the flat roof plate (dead `attachedCapIds`, `emit.ts:137,175`). Scratch-copy experiment: capping those 8 walls with their roof takes exteriorErrors 8 → 0, model still valid. |

---------------------------------------------------------------------------------------------------

## 1. Role question answered — which invariants stay HARD, with evidence

### 1.1 `WALLS_OVERLAP` — exact, and the tolerance is the whole point
- `packages/model/src/topology.ts:486` `WALL_OVERLAP_AREA_LIMIT = 1e-6` (m², i.e. 1 mm²), `topology.ts:494-528` `wallOverlapIssues`:
  pairs of **physical** footprints (after junction end cuts, `wallPhysicalFootprint`), Sutherland–Hodgman clip (in/out test `>= -1e-12`),
  AABB pre-filter with `EPS=1e-9`, height ranges from `level.elevation + baseOffset .. + height` must overlap by `> 1e-9` m.
- PROBE (`probe.ts`, `probe2.ts`): 1 mm × 1 m sliver → REFUSED (`0.0010 m²`); 0.4 mm × 1 m → REFUSED; 1 mm × 1 mm → ACCEPTED (1e-6 not `>` 1e-6);
  0.9 µm × 1 m → ACCEPTED. Two rings edge-adjacent (touching at x=10) → ACCEPTED; **1 mm inter-penetration → REFUSED** (`3e-4 m²`).
  Two identical rings on one level → REFUSED (`3.0000 m²`); same footprint on levels 0/1 with correct elevations → ACCEPTED.
- Junction tolerance is *declared per junction record* and defaults to 1 mm (`schema.ts:189`); it only bounds gap/overshoot of an endpoint against the other wall's band
  (`topology.ts:150 short > tol`, `:158 past > tol`) and T/BUTT contact position. Ring corners from `createWallRing` are exact polygon vertices (gap 0), so tolerance is
  irrelevant for them; **the analyzer never emits a hand-declared BUTT/T** (see ASSUMP-TOPOLOGY-002): the 12/12/8 junction records in the three models are all ring corners.
- Wall consumed: `core.a1 - core.a0 <= 1e-6` → `WALL_CONSUMED` (`topology.ts:365`). Ring codes `topology.ts:388-420` (`RING_DEGENERATE` n<3, repeated wall, non-simple polygon; `RING_NOT_CLOSED`; `RING_LEVEL_MISMATCH`).
- **Verdict: keep hard, at exactly this tolerance.** It is a geometric-existence invariant (double-counted material = double-counted quantities, z-fight). The analyzer's job is to never
  hand it an overlap — via the planner — not to widen it. 004A did this correctly for partitions; it did **not** for ring-vs-ring (masses): the layout gate's `MASS_OVERLAP` is
  `overlap > 0.5 m²` on AABBs (`layout-gate.ts:124`) — 5×10⁵ looser than the model. PROBE P2a/P2c/P2e: overlaps of 0.09 / 0.015 / 3e-4 m² pass the gate and die at emission with
  `WALLS_OVERLAP` → `MODEL_EMISSION_FAILED`, not the named gate. Latent today because adjacent masses come off one shared plan grid (exactly touching), but any second
  mass generator that is not grid-snapped hits it.

### 1.2 Opening hosts and `fitOpeningsToHosts`
- Model side (hard): `validate.ts:150` `UNKNOWN_WALL` (host), `:193` `OPENING_OUTSIDE_HOST`, `:201` `OPENING_TOUCHES_WALL_EDGE` (side/top edge; sill at base allowed), `:213` `OPENING_IN_JUNCTION_ZONE`
  (uses `physicalCore` of the topology-resolved extent), `:225` `OPENINGS_OVERLAP`, leaf codes `:166`, fill codes.
- Emitter side: `candidate.ts:300` `FIT_CODES = {OPENING_OUTSIDE_HOST, OPENING_TOUCHES_WALL_EDGE, OPENING_IN_JUNCTION_ZONE}` only; constants `SIDE_MARGIN_M 0.05`, `HEAD_MARGIN_M 0.1`,
  `MIN_WIDTH_M 0.4`, `MIN_HEIGHT_M 0.5` (`:303-306`). Fit = shrink into `physicalCore`, lower head under `wall.height - 0.1`, else drop with reason.
- Trace evidence (`analysis-trace.json`, BUILDING_MODEL/EMISSION): Marcówki `openingsFitted 0 / openingsDropped 0`; Kosaćce clean **1 fitted / 0 dropped** (`shared-opening-0-east-1-1`
  narrowed 4.07 → 3.65 m, −10 %, a two-leaf shared opening between two masses); Rarytasy G2E **1 fitted / 1 dropped** (`opening-0-east-5-0` 4.10 → 3.86 m; `opening-0-east-5-1` dropped:
  "even fitted, the model refuses it (OPENINGS_OVERLAP)"). So openings that the readers place do collide with each other on 1 of 3 completing projects.
- **Asymmetry (PROBE `probe3.ts`)** — the same underlying condition yields a named drop or a run failure depending on an accident:
  - A: two overlapping openings, both well inside the wall → `ok:false`, `OPENINGS_OVERLAP` → whole run `MODEL_EMISSION_FAILED`.
  - B: same pair but the second also crosses the corner zone → fitted, then **dropped** with a reason (this is what happened in G2E).
  - C: exact duplicate reading of one opening → `ok:false`.
  - D: opening whose host wall does not exist → `ok:false`, `UNKNOWN_WALL` (failedAt=3). The branch `fitted()` → `{drop:'its host wall is not in the model'}` (`candidate.ts:330`)
    is **unreachable**: `fitted` is only called when every error is in `FIT_CODES` (`:379`), and a missing host raises `UNKNOWN_WALL`, which is not in that set.
  - E: opening wider than its wall → shrunk (never dropped).
  The task statement's "an opening without a host is dropped with a reason" is therefore **not true today**; it is a new behaviour the resolver must add (and test).

### 1.3 Levels when the section is missing; roofs over guessed storeys
- `solve.ts:257` `levelsFrom`: `datums.length < 2` (or fewer than 2 floors after terrain removal, `:274`) → `{floors:[0], heights:[2.8], measured:false}`. `reconstruct-v2.ts:252`: further
  storeys stack at `floors.at(-1) + 2.8·k`. Tested: `fit-and-levels.test.ts:108-127` (ladder from ±0.00, basement vs terrain).
- Levels are built **only for `main.storeys`** (`reconstruct-v2.ts:251`). The emitter looks a level up by index at 13 sites and **`continue`s silently** at 10 of them when it is absent
  (`emit.ts:128,148,185,206,409,415,421,458,482,523`), with no `dropped` entry, no `unresolved`, no note. An attached mass whose span is not a subset of the main mass's
  (e.g. a basement wing) loses those storeys without a trace. Latent: not observed in the 4 runs. `levelId()` at `emit.ts:119` is dead code; the main roof, attached roofs and chimney fall back to `'lvl-0'` (`emit.ts:332,362,431`).
- The **model carries no evidence on levels**: `emit.ts:122` `createLevel` is never followed by `setEvidence` (Kosaćce `model.json`: `levels:[{id:'lvl-0',elevation:0,height:7.05}]`, no `evidence`).
  The `ASSUMED_FOR_RENDERING` mark lives only in the candidate's feature graph (`reconstruct-v2.ts:255` LEVEL feature, `quality.ts:52` → L0), which is outside the model hash and not in the model file.
- The top storey is **stretched to the ridge** when the roof is pitched (`reconstruct-v2.ts:255`): Kosaćce ends as one `lvl-0` of height 7.05 m, four ring walls of 7.05 m
  `FOLLOW_ROOF roof-main`, one slab, no stair, no upper floor. It validates, and nothing marks that as "storeys unknown".
- The main roof exists only with a stated pitch **and** a ridge datum (`reconstruct-v2.ts:326→380`, else `gap('the main roof', MISSING)` at `:384`), `kind` is literally `'GABLE'`,
  ridge axis defaults to `'Z'` when no view votes (`:357`), eave is **derived** from ridge−half-span·tan(pitch) (`:366`); the section-read eaves datum (`levels.eaves`, `solve.ts:294`) is used only
  as a storey height and is **never cross-checked** against the derived eave (grep: no consumer). That is an unused independent constraint for the ridge-axis decision.
- Model side: **no validator ties a roof to walls or levels to each other.** PROBE `probe.ts`: P4a roof with no walls → ACCEPTED; P4b roof footprint 40 m from the ring with all four ring walls as
  `capWallIds` → ACCEPTED; P5a only `index:1` level, no ground → ACCEPTED; P5b two levels sharing an index → ACCEPTED (WARNING only, `validate.ts:102`); P5e a 7.05 m wall on a 2.8 m level → ACCEPTED;
  P5c wall ring on a non-existent level → REFUSED (`UNKNOWN_LEVEL`). The compiler's only related check is a WARNING (`compile.ts:123 WALL_NOT_UNDER_ROOF`, wall keeps nominal height).

### 1.4 Command ordering — "every prefix validates"
- **Enforcement by construction**, not by a checker: `apply.ts:148` `applyCommand` re-runs the **whole** `semanticIssues(d.model)` after every command and rejects on **any** error, including one that pre-existed
  and is unrelated to the command (no baseline diff). `runCommands` (`apply.ts:185`) throws at the first refusal; `sealCandidate` → `buildCandidateModel` (`candidate.ts:198-207`) runs `runCommands`; `verifyReplay`
  (`:251`) re-runs it. A program that seals therefore validated at every prefix. Order in `emit.ts`: materials → levels → pitched attached roof planes (before the walls that die into them) → per mass slab+ring →
  returns → partitions+doors+rooms → roofs (`capWallIds` reference walls already emitted) → balconies/railings/terraces → chimneys/rooflights → openings (+fills) → stair → surface regions.
- **Tests of the property**: only `wall-topology.test.ts:190-224` replays prefix by prefix, on one synthetic 10×8 ring with partitions (no slab/roof/openings). The emitter as a whole is exercised by `fixtures-v2.test.ts` (12 synthetic
  houses sealed via `runCommands`) and by the 4 real projects. There is no generative/property test of `emitBuilding`. `fit-and-levels.test.ts:27-107` covers `fitOpeningsToHosts` (5 cases).
- `applyCommand` cost is O(commands × validator); measured EMISSION 94-227 ms + SEAL 158-402 ms + REPLAY 75-217 ms for 151-205 commands (from the 4 traces). Not a problem at this size; multiplies with candidates (§4).

### 1.5 `MODEL_EMISSION_FAILED` — what is kept
- Raised at `reconstruct-v2.ts:1054` from `fit = fitOpeningsToHosts(...)` (`:1045`). Diagnostics kept (flat `Record<string, number|string|boolean>`): `command`, `codes`, `commandIndex`, `commandId`,
  `objectIds`, `walls` (parsed from the message by regex `walls? (\S+) and (\S+) share`), `measured` (max), `detail` (message cut to 200 chars). `run.ts:425-447` attaches `trace`, `bundle`, `plans`, `pkg`, `graph`, `metrics` to the error.
- **Not kept**: `fit.program` (the valid prefix of `failedAt` commands), `fit.fits` (openings already fitted/dropped), `emitted.program`, `emitted.topology` (all planner decisions), `emitted.dropped`, and `building` (BuildingV2).
  `grep MODEL_EMISSION_FAILED packages/*/test tests apps/*/test` → no test. `ReconstructionFailure` (`failure.ts`) has no slot for a program.
- 004A evidence: the Kosaćce failure was command 52 `createWall`, `WALLS_OVERLAP` (`STAGE_..._004A...md:185`); the phone UI text is generic (`AnalyzerFailure.kt:154`).

---------------------------------------------------------------------------------------------------

## 2. Hash integrity (Q2)

### 2.1 Where each hash comes from (PROBE `hash-probe.ts`)
| Artifact | Depends on | Depends on `SOLVER_V2_VERSION`? |
| --- | --- | --- |
| model hash = `sha256(serializeModel(model))` (`candidate.ts:203-210`) | the DSL program's semantics **including every `setEvidence.interpretation` string**, `model.id` (= `modelId`), `model.name` (= `label`), building name (from label) | **No.** `createEmptyModel` writes `meta.createdWith='buildapp'` (`schema.ts:1376,1414`); no `solver` string in any of the 3 model.json (regex). |
| scene hash (`sceneContentHash`) | the model only (`buildMobileSceneBundle(model,{scene})`) | No |
| candidate `contentHash`, `id` (`candidate.ts:223-244`) | 4 input ids+hashes, layout id/hash/**status**, **`solver {name,version}` (`:230`)**, `{modelId,label}` (`:231`), program verbatim, model hash, quantities, contradictions, `unresolved` (what/status/placeholderId), traces (ids only), **solver steps (stage/method/inputs/outputs)**, residuals. Prose (`detail`, `why`, `reason`) excluded. | **Yes** |
| hypothesis set id/hash (`reconstruct-v2.ts:1097`) | `hashArtifact('buildapp.analyzer-v2-hypotheses', SOLVER_V2_VERSION, …)` — the version is the `version` argument that `hashArtifact` folds into the hashed JSON (`source-common/hashing.ts:28-31`); id = `hypotheses-v2-${hash[:16]}` (`:1098`) | **Yes** (→ candidate hash) |
| `result-summary.analyzer.solver`, `/health`, `hello` | printed, not hashed | display only |
| sealed candidates in `packages/candidates` | committed data, `solver.version = "2.0.0"` (PROBE), replayed by `sealed.test.ts` | no re-solve; a bump does not touch them |

PROBE on the two sealed v2/v3 candidates: recomputed `candidateContentHash` equals the sealed one; with `solver.version` changed to `2.2.0` the candidate hash **differs** and
`verifyReplay` stays `ok` with the same `modelHash`. `hashArtifact` with version 2.1.0 vs 2.2.0 differs.
Kosaćce clean vs tracked (real runs): **same model `5b5ffcf1afcd`, same scene `50217b856dfc`, different candidate hash** (`43301e0b…` vs `99e95fbf…`) — the two surfaces are independent in practice too.

### 2.2 Is a bump required for 005A, and what changes?
- 004A declined the bump because "it is part of every model hash, so bumping it would break the very byte-identity this stage gates on" (`004A…md:364`, again `:493`). **Refuted by the code above**:
  a bump changes candidate hashes only.
- **Mechanically required iff any hashed candidate component changes on the success path** — new solver steps, new `unresolved` entries, quantities, traces or residuals — because then `(sealed inputs, solver version) → candidate`
  stops being a function. A resolver that is a strict failure-path (records nothing when it does not fire) leaves passing inputs bit-identical without a bump.
- **Recommended anyway: bump to 2.2.0.** After 004A two rule sets (pre/post partition planner, "emitter's rule set grew", `004A…md:493`) both claim 2.1.0, and the sealed set claims 2.0.0. The version string is the only record in a
  candidate of *which rule set derived it*; the bump costs the byte-identity gate nothing (model and scene unchanged), only candidate ids/hashes and the printed `analyzer.solver`.
- Expected effect of 2.1.0 → 2.2.0 with a behaviour-neutral resolver: Marcówki model `6152770f43f4` and scene `8c7d43956d74` unchanged; Kosaćce `5b5ffcf1afcd` / `50217b856dfc` unchanged (clean and tracked);
  Rarytasy G2E `8fa4a25bcd58` / `d4e7249bb1bd` unchanged; **candidate hashes change for all** (Marcówki `300eebbe22eb`, Kosaćce clean `43301e0bfba3`, tracked `99e95fbf1a23`, G2E `0bc408c4b682` → new), candidate ids and hypothesis-set ids change.
  No test pins these (grep of `packages/*/test`, `tests/`): `tests/architecture/reconstruction.test.ts:152-157` only checks the version matches `^\d+\.\d+\.\d+$`.
- **What can change a model hash silently (must be gated by the same 3 hashes):** (i) any wording/number-format change in an emitter `why`/`interpretation` string — 65/80/53 strings = 3.9/6.2/4.3 KB of a 39/47/35 KB model (10-13 %) are in the hash, although `candidate.ts:219` states "rewording an explanation is not a different reconstruction" (true for step/trace/unresolved prose, false for `setEvidence` prose because it is inside the hashed `program`);
  (ii) the project title (`identityOf`: `label = "<title> (analysis)"`, `modelId = m-analysis-<slug>`, `identity.ts:34-39`; PROBE: changing `name` or `id` changes the model hash) — stable across the tracking-query URL variants
  only because ARCHON supplies `externalId`; for a source with no `externalId` the slug is `u${sha256(canonicalUrl)[:12]}` and `canonicalUrl` keeps the query (per the brief), so a tracked URL would change `modelId` → model hash on identical drawings.
- Determinism latent risk: planner decision order and tie-breaks use `localeCompare` on ids (`wall-topology.ts:94,294`) and ~40 other sort sites. 004A found the phone's ICU replica refuses `localeCompare` for common punctuation (for the page-text reader). For lowercase-hyphen-digit ids code-unit order and ICU order coincide, and the Kosaćce/Marcówki phone models equalled the desktop's in 004A, so **no divergence observed**; recommend INSTRUMENT (a test asserting code-unit order == `localeCompare` order over the emitted id vocabulary) before adding candidates whose ranking depends on it.

---------------------------------------------------------------------------------------------------

## 3. Concrete rules (Q3)

### (a) Minimum valid coarse model the resolver may emit when detail is inconclusive
Everything below uses existing commands and validators unchanged.

- **C1 spine**: `createBuilding` + materials + ≥1 `createLevel`. Level 0 at elevation 0 unless a section states otherwise; height = measured storey height else `CONVENTIONS.storeyHeight` (2.8). **New**: a `setEvidence` on every level
  (`ASSUMED` with `properties.height`, or `SOURCE_*` when a section datum was read). Today the model level has none (`emit.ts:122`).
- **C2 one MAIN mass**: one axis-aligned rectangle `createWallRing` (EXTERIOR, `cornerOwnership:'ALTERNATE'`) + one `createSlab` per registered storey. Rectangle from **printed chains / wall-band extent only** (`SOURCE_EXACT` when two printed
  spans agree, else `GEOMETRIC_INFERRED` — a model status the emitter never uses today, `emit.ts:52-69`). **Never from a published area** (areas are the acceptance check: `|A−A_pub|/A_pub ≤ 0.20` else the rectangle is not a candidate — same
  thresholds as `layout-gate.ts:148-150`). Storeys: exactly the registered plan storeys; if the count is unknown, one, plus an `unresolved` ("number of storeys", `AMBIGUOUS`).
- **C3 roof**: emitted only when pitch **and** ridge axis come from evidence (`reconstruct-v2.ts:326-380` rule, unchanged). Otherwise **no `createRoof`** and `unresolved 'the main roof' MISSING` (`:384`, existing). No convention roof over a coarse
  body: a guessed roof on a guessed storey stacks two guesses (Kosaćce's two `ATTACHED_ROOF L0` conventional flat roofs are the 8 closure errors). If the OWNER's UI needs a lid, the lid is a **viewer** affordance, not a model object.
- **C4 unresolved wings**: each wing = (i) `UnresolvedCandidate{what, status:'AMBIGUOUS'|'MISSING', placeholderId}` and (ii) **one `UNKNOWN` assembly** with `metricExtent` = the wing's wall-band box × storey height and
  `quality:'FRAGMENTARY'` (`schema.ts:1073`, `validate-architecture.ts:474-486`; the validator forbids `COMPLETE`). Both exist in the model/candidate schemas and are **unused by the analyzer today**
  (`placeholderId` is never set: grep `v2/*.ts`; no `createAssembly` in `emit.ts`). A wing is a real mass only if a printed rectangle exists.
- **C5 details are optional and individually droppable**: openings that survive `fitOpeningsToHosts`; partitions/doors/rooms; stairs; chimneys. Each dropped item → `unresolved` with the validator's sentence.
- **C6 marking**: candidate `structuralStatus` ≤ `STRUCTURAL_LAYOUT_PARTIAL` (a DEGRADING reason such as `NO_ROOF`/`ROOF_KIND_UNKNOWN` already forces it, `layout-gate.ts:189-193`); quality L0 for anything `ASSUMED_FOR_RENDERING`/`UNRESOLVED`
  (`quality.ts:52`), L1 for one-asset derived, L2 only when a printed chain or ≥2 independent assets give the value (`:55`); model evidence `ASSUMED`/`UNRESOLVED`/`GEOMETRIC_INFERRED`; UI string stays "Model gotowy z ograniczeniami".
- **C7 emission**: the coarse program must pass `runCommands` with **zero** fits; if it does not, the candidate is invalid (do not weaken a validator).

### (b) Validators hard by nature — never softened
| Group | Codes | Why hard | Evidence |
| --- | --- | --- | --- |
| Shape/domain | `SCHEMA`, finite/positive dims, `UNSUPPORTED_SCHEMA_VERSION` | a non-model | `validate.ts:36-52` |
| Referential integrity | `DUPLICATE_ID`, `UNKNOWN_*` (level/wall/junction/opening/roof/roof plane/material/target/evidence source), `MISSING_BUILDING`, `UNKNOWN_BUILDING` | a dangling reference is unreadable by the compiler (`compileBuilding` refuses the whole model, `compile.ts:135-141`) | `validate.ts:54-110`, PROBE P5c, P6a |
| Solid existence | `WALLS_OVERLAP` @ 1e-6 m², `WALL_CONSUMED`, `DEGENERATE_WALL`, `MALFORMED_POLYGON`, `INVALID_RECT`, `SLAB_HOLE*` | double-counted / absent material | `topology.ts:486,365` |
| Junction/ring logic | `JUNCTION_PARALLEL_WALLS/SELF_REFERENCE/OWNER_NOT_PARTICIPANT/LEVEL_MISMATCH`, `ENDPOINT_JUNCTION_CONFLICT`, `BUTT_OFF_HOST`, `T_JUNCTION_POSITION`, `RING_*` | logical impossibilities. `JUNCTION_GAP/OVERSHOOT` are hard **relative to a declared tolerance**: the declaring layer may state a tolerance, never the validator | `topology.ts:150,158,388` |
| Hosted objects | `OPENING_OUTSIDE_HOST/TOUCHES_WALL_EDGE/IN_JUNCTION_ZONE`, `OPENINGS_OVERLAP`, `OPENING_LEAF_*`, `FILL_*`, `ROOF_OPENING_*`, `ROOF_PLANE/EDGE_*`, `WALL_PANEL_INVALID`, `STAIR_*` | a hole needs wall around it; two holes cannot coincide. Hard in the **model**; the resolver's response is *drop-with-reason of the hosted object*, never a softer validator | `validate.ts:193-225` |
| Evidence honesty | `ASSEMBLY_QUALITY_OVERSTATED`, `ASSEMBLY_QUALITY_UNEXPLAINED`, `UNKNOWN_ASSEMBLY_INVALID`, `ASSEMBLY_KIND_CONTRADICTED` (warning) | these are what make "honest partial" checkable | `validate-architecture.ts:485-490` |
| Pipeline gates | `serializeModel` refuses invalid model (`serialize.ts:39`), `verifyReplay` byte identity (`candidate.ts:251`), layout-gate **acceptance** of `MASS_OVERLAP` on a candidate | a model that cannot replay is "a model with a story attached" (`candidate.ts` header) | tests below |
| Tolerance rule | The WALLS_OVERLAP limit and the opening edge `EPS` are never widened. A junction `tolerance` the resolver declares must be ≤ k·mpp (plan noise, k≤2.5) and recorded on the junction. | prevents hiding gaps | — |

Missing hard-by-nature validators the resolver needs as **WARNING-severity** first (feed candidate score; become errors only for an `ACCEPTED` status): roof footprint not over its cap walls; level elevations non-increasing or
overlapping vertically; no ground level; wall height > level height + roof allowance without `FOLLOW_ROOF`; roof eave below wall top. All accepted silently today (PROBE §1.3).

### (c) Upstream rejections that are SOFT and belong in candidate scoring
| Today | Where | Why soft | Proposed |
| --- | --- | --- | --- |
| `FOOTPRINT_AREA_WRONG` (>20 %) BLOCKING → run abort `PLAN_LAYOUT_REJECTED` | `layout-gate.ts:150`, `plan-diagnostics.ts:106-109`, `reconstruct-v2.ts:221` | it is an independent constraint *between candidates*, e.g. phone: 33.15 vs 164.47 m² (79.8 %) on the 853-px area-table copy, while the dimensioned copy passes; e-OZE printed `1600 × 760` = 121.6 m² vs published 122.07 (0.4 %) — an independent corroboration for a coarse rectangle | score per candidate (error %, three bands already exist: ≤6 % agrees, ≤20 % near, else wrong); abort only when **no** candidate reaches the floor, listing every attempt. Keep as the acceptance floor. |
| `MASS_OVERLAP` >0.5 m² AABB → abort | `layout-gate.ts:124` | should reject the *candidate*, not the run; and must use the model's own overlap function (§1.1) | candidate reject; compute `wallOverlapIssues` on the candidate rings |
| `STRUCTURE_SILHOUETTE_DISAGREES` BLOCKING (>4×tol) | `structural-audit.ts:203` | already softened: not in `LAYOUT_REFUSAL_CODES` (`plan-diagnostics.ts:106`) → carried as degraded | precedent to copy |
| Planner drops (`DROPPED_UNRESOLVED_OVERLAP`, `DROPPED_INSIDE_HOST`, `DROPPED_SHORT`, `DROPPED_STUB`) | `wall-topology.ts:147,…` | named already; G2E dropped a whole partition for 0.0171 m² | score = dropped run length; try bounded trim to the face before dropping (ASSUMP-TOPOLOGY-005) |
| `fitOpeningsToHosts` shrink/drop | `candidate.ts:367` | named already (Kosaćce −10 %) | score = width lost / dropped count |
| Compiler diagnostics (`WALL_NOT_UNDER_ROOF`, `OPENING_ABOVE_WALL_TOP`, `WALL_TOP_BELOW_BASE`, …) | `geometry/src/compile.ts` | **not consumed at all**: `grep scene.diagnostics packages/analysis-service` → none | consume into score and warnings |
| Closure audit findings | `run.ts:347-364` | already only a warning/`DEGRADED`; hard only in fixtures (`architecture/test/fixtures.test.ts:40`, `benchmark/second-house-roof.test.ts:95`) | score |
| Source-view residuals outside tolerance (12/66, 2/5, 17/28) | `verify.ts` | already a warning | score |

### (d) Negative tests the resolver must keep passing (existing) and add
Existing, must stay green **unchanged**: `topology.test.ts:266` (crossing walls without junction = error with measured area; contact and different levels are not), `:284` (duplicate wall = overlap), `:125` (gap/overshoot reported, nothing moved),
`:147` (parallel/self/owner/dangling/level mismatch), `:173` (end claimed twice), `:252` (wall consumed), `:321,:342` (rings); `wall-topology.test.ts:208` (unplanned runs refused with `WALLS_OVERLAP` — "the validator is not weakened"),
`:141,:215` (unexplainable overlap left out and named); `fit-and-levels.test.ts:72` (non-fit refusal returned as failure) — **this one will need a deliberate change** if OPENINGS_OVERLAP becomes a drop (see below); `model.test.ts:67` (opening on nonexistent wall refused
by the validator); `roof-systems.test.ts:171` (two bodies in one place → `MASS_OVERLAP` BLOCKING, status REJECTED); `failure-codes.test.ts:130` (`FOOTPRINT_AREA_WRONG` → `PLAN_LAYOUT_REJECTED`, gate verdict enforced, digest carried); `topology-commands.test.ts:119,223`; `geometry/test/closure.test.ts:62`.
To add: (1) **host-less opening → dropped with a reason** (currently `ok:false`; test both `fitOpeningsToHosts` and that `model.test.ts:67` still refuses it at model level); (2) **overlapping/duplicate opening → dropped with a reason** and the pair
of run-failure cases A/C from `probe3.ts` inverted; (3) coarse candidate is never `ACCEPTED`; (4) coarse program has zero fits and unchanged validators (`WALL_OVERLAP_AREA_LIMIT === 1e-6` pinned); (5) `MODEL_EMISSION_FAILED` diagnostics carry the valid prefix ids;
(6) passing-input hash gate: the three model hashes and scene hashes in §2.2 byte-identical after the resolver; (7) scale metamorphic test for the planner (same partition set drawn at 0.012/0.024/0.036 m/px with ±2 px noise → same decision multiset); (8) MASS_OVERLAP 0.09 / 0.015 / 3e-4 m² overlaps rejected **at the gate** (P2a/c/e).

---------------------------------------------------------------------------------------------------

## 4. Q4 — the 8 `exteriorErrors` on Kosaćce (packages/geometry evidence)

- Reproduced (`closure-probe.ts`): 56 findings = 8 EXTERIOR ERROR + 44 INTERIOR ERROR + 4 INTERIOR WARNING. The 8 are all `COPLANAR_DUPLICATE`, relation `PARAPET<->FLAT_ROOF`, intended `BEARING`, between
  `ring-attached-{0,1}-0-w{0..3}` and `roof-attached-{0,1}`, measures 0.917, 0.917, 0.460, 0.460 (attached-0) and 0.556, 0.556, 0.258, 0.258 m² (attached-1), total 4.4 m². The rule: `closure.ts:667` `coplanar > 0.005 m²` and `rel.kind !== 'FLUSH'` → ERROR;
  the wall/flat-roof relation is `follows ? 'CONTACT' : 'BEARING'` with why "a flat roof plate bears into the walls that carry it; **a parapet rises past it**" (`closure.ts:554`).
- Model facts (`kosacce-clean/model.json`): all 8 walls `height 2.8`, thickness 0.296325, **no `topProfile`**; both roofs `FLAT`, `eaveOffset 2.8`, `thickness 0.28`, `plateInset 0.148163` (= half thickness), evidence `ASSUMED` ("no section draws this roof; its height is the storey height").
  Wall top = plate top = 2.8 m; the plate spans centreline to centreline so both up-facing top faces lie in one plane over `0.148163 × wall length` (0.148163 × 6.19 = 0.917 ✓). Wall material `#e8e4dc`, roof `#5a5550` → visible flicker.
- Cause in the emitter: no section reading → `slabTopY = l.wallTop` (`reconstruct-v2.ts:702`), wall height = `(parapetTopY ?? slabTopY) − elevation` (`emit.ts:168`), `plateInset` half thickness (`emit.ts:369`), and the ring walls are **not** in the roof's `capWallIds`
  (`emit.ts:372` lists only returns and partitions): `attachedCapIds` is filled at `emit.ts:175` and **never read** (dead map). Marcówki, where the section reads a parapet, has wall top 3.125 > plate top 2.890 → 0 errors. Rarytasy G2E has no flat attached roof → 0.
- Scratch experiment (`closure-fix-experiment.ts`, copy of the model, nothing published): set `topProfile FOLLOW_ROOF roof-attached-N` on those 8 walls → `validateModel` ok, compile diagnostics 0, closure: `exteriorErrors 8 → 0` (INTERIOR 44 GAP + 4 WARNING unchanged).
- **Verdict: model (emitter) defect, one root cause, correct audit, cosmetic magnitude** (z-fight strips 0.15 m wide, no volume/semantic error). Not noise: the count equals exactly the attached-ring walls without a cap. Smallest generic change: when no parapet is read, cap the ring walls that carry a flat plate with that plate (revive `attachedCapIds`).
- Adjacent finding from the same probe: the **interior** `GAP` ERRORs (44 Kosaćce, 35 Marcówki, 19 G2E; `interiorFindings 48/42/19`) are the planner's own 15 mm clearance (`emit.ts:250`, `wall-topology.ts:77`): G2E measures are all exactly 0.015 m; Kosaćce 0.0044-0.0426, Marcówki 0.0084-0.015 — "stand N m apart where the model says they meet: a visible crack" (closure.ts). See ASSUMP-TOPOLOGY-002.

---------------------------------------------------------------------------------------------------

## 5. Function capability inventory (one row per significant function)

Legend: det = deterministic; risk = genericity risk; rec = recommendation. "Alt hyp" = alternate hypotheses attempted.

| Symbol (path:line) | In → out; det | Assumptions / thresholds | Evidence used / ignored | Codes | Alt hyp | Cost | Risk | Rec |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `model/validate.ts:36 validateModel` | unknown → issues+model; yes | migrate then Zod then semantic; nothing repaired | model only | `SCHEMA`, migration codes | — | ms | LOW | KEEP |
| `validate.ts:54 semanticIssues` | model → issues; yes | `EPS 1e-9`; openings need wall on both sides and above (`:201`); leaf walls parallel 1e-9; `DUPLICATE_LEVEL_INDEX` warn only (`:102`); **no roof/level coherence checks** | model only | ~70 codes (issues.ts:6-84) | — | O(W²) overlap + O(O·W) host `find` | LOW | KEEP + ADD warning-severity coherence checks |
| `model/topology.ts:135 endAgainst` | 2 walls → cut or gap/overshoot; yes | tol = junction.tolerance (default 1 mm, `schema.ts:189`); parallel `|A.u·B.n|<1e-9` | geometry | `JUNCTION_PARALLEL_WALLS/GAP/OVERSHOOT` | — | O(1) | LOW | KEEP |
| `topology.ts:199 resolveWallTopology` | model → extents/junctions/claims; yes | pass 1 corners/butt, pass 2 contacts on host physical faces, consumed `1e-6`, rings | geometry | 13 topology codes | — | O(J+W) | LOW | KEEP |
| `topology.ts:494 wallOverlapIssues` | model+extents → `WALLS_OVERLAP`; yes | area limit `1e-6` m²; y-range overlap `>1e-9`; convex clip | footprints | `WALLS_OVERLAP` | — | O(W²) with AABB filter | LOW | KEEP hard |
| `model/validate-architecture.ts` `architectureIssues` | model → issues; yes | roof planes/edges/assemblies/relationships; `UNKNOWN` assembly needs 2-axis extent | model | 40+ codes | — | ms | LOW | KEEP; **start using `UNKNOWN` assemblies (C4)** |
| `commands/apply.ts:131 applyCommand` | model+cmd → model \| errors; yes | whole-model revalidation, any error rejects (`:148`), no diff | — | validator codes + `COMMAND_FAILED`, `INVALID_COMMAND` | — | O(validator) per command | LOW | KEEP; INSTRUMENT (attribute errors to the command's ids for the resolver's drop logic) |
| `apply.ts:169/185 applyCommands/runCommands` | program → model, stop at first failure; yes | returns last valid model + `failedAt` | — | first failing code | — | Σ per command | LOW | KEEP |
| `apply.ts:358 createRoof.capWallIds` | roof + walls → `FOLLOW_ROOF` | only "wall exists" is checked; not level, not footprint | — | `UNKNOWN_WALL` | — | O(n) | MEDIUM | INSTRUMENT (coherence warning) |
| `reconstruction/v2/emit.ts:97 emitBuilding` (`:100` evidence helper) | `BuildingV2` → program+bindings+notes+dropped+topology; yes | axis-aligned rectangles (4-wall ring); global T; 13 level lookups, 10 silent `continue`; interior door `<0.5 m` or past run → silent `continue` (`:295`); dead `attachedCapIds`/`levelId`; `gapM 0.015` (`:250`); magic `+0.5` on pitched attached walls (`:168`); `plateInset` half T (`:369`) | plan bodies, returns, partitions, roofs, openings; ignores `b.assemblies` | none itself (silent drops) | none | ms | HIGH | REFACTOR (recorded drops, caps, junction records) |
| `v2/wall-topology.ts:96 planWallTopology` | raw runs+hosts → non-overlapping runs, decisions, unresolved; yes (sorted by id, `localeCompare`) | **axis-aligned only**; `gapM 0.015`, `reachM 0.06`, `minRunM 0.2`, `coversAt slack 0.05`, drop if `penetration ≥ T/2` (`:147`); host rects nominal (not corner-cut); order: fuse → hosts → trim-to-host → split crossings → drop stubs → trim ends deepest-first → drop shorts → audit | ink-derived runs; ignores raster scale (mpp) | (decision kinds) `DROPPED_*` | none (greedy) | 117-457 ms for 40 runs | MEDIUM-HIGH | REFACTOR (mpp-relative constants, bounded trim before drop, junction records) |
| `candidate.ts:198 buildCandidateModel`, `:203 sealCandidate` | program → model+candidate; yes | only path to geometry; hashes model | — | throws on invalid | — | ~0.16-0.4 s | LOW | KEEP |
| `candidate.ts:223 candidateContentHash` | draft → hash; yes | prose excluded except inside `program` | — | — | — | ms | MEDIUM | KEEP; document prose-in-program |
| `candidate.ts:251 verifyReplay` | candidate → ok \| reason; yes | byte identity | — | `VERIFY_REPLAY_FAILED` upstream | — | 0.08-0.22 s | LOW | KEEP |
| `candidate.ts:367 fitOpeningsToHosts` | program → program+fits+indexMap \| failure; yes | `FIT_CODES` 3; margins 0.05/0.1; min 0.4×0.5; drop dependents (`placeWindow/placeDoor/setEvidence`) | model validator as oracle | 3 fit codes; any other → `ok:false` | none | one replay | MEDIUM | REFACTOR (generalize to dependency-closed drop for non-spine objects) |
| `reconstruct-v2.ts:1045-1062` emission failure | fit failure → `ReconstructionFailure` | flat strings only | — | `MODEL_EMISSION_FAILED` | — | — | HIGH | REFACTOR (keep prefix ids) |
| `solve.ts:252 levelsFrom` | metrics → floors/heights/eaves/topDatum/measured; yes | datums <0.4 m apart merged; terrain `−1.5<v<−0.05`; ≥3 datums → last two are eaves/ridge; `<2` → `[0]`, 2.8 | LEVEL_DATUM on the section | — | none | ms | MEDIUM | KEEP + mark level evidence |
| `reconstruct-v2.ts:251-256` levels | masses → `levelsV2`; yes | **main.storeys only**; top storey stretched to ridge if pitched | section | — | none | — | HIGH | REFACTOR (levels for the union of mass spans; record skipped storeys) |
| `reconstruct-v2.ts:326-384` main roof | roofSupports+views → `mainRoof` \| gap | GABLE only; axis vote else `'Z'`; eave = ridge−halfSpan·tan(pitch); `levels.eaves` unused | printed pitch/spec, renders, section ridge | `gap MISSING` | none | — | HIGH | REFACTOR (hypothesis per ridge axis scored by eaves-datum agreement) |
| `reconstruct-v2.ts:702` attached flat roof | mass → `slabTopY = wallTop` when unread | convention | section reading if any | — | none | — | MEDIUM | REFACTOR (cap walls, C3) |
| `v2/openings-v2.ts:177 readWallOpenings`, `:101 planGaps` | plan gaps + callouts + elevations → `OpeningV2[]` | `minWidth 0.5`, `maxWidth 6.5`, `calloutReach 2.0`, `stubMax 0.3` (`:71`); callout 40-700 × 40-400 cm (`:96`); head/sill agreement 0.12/0.2/0.15 m; door 2.2 m attached vehicle | plan raster, callouts, elevation | unresolved strings | one reading per gap | ms-s | MEDIUM | INSTRUMENT (dedupe before emit) |
| `v2/interior.ts:134 readInterior` | raster+body → partitions, doors, rooms; yes | ink `l<95 ∧ chroma<70`; partition thickness fraction 0.2-0.72 of wall; piece ≥0.55 m; door gap 0.6-1.35 m; flood cell 0.05 | plan ink | unresolved strings | none | s | MEDIUM-HIGH (black-ink plan style) | INSTRUMENT |
| `v2/assembly-closure.ts:66,96,131…` | returns/terraces/balconies/railings/verges → joins | snap tolerance 0.06 m; slab top within 0.1 m of floor = floor | plans, renders | `ClosureNote`s | none | ms | MEDIUM | KEEP |
| `v2/roof-details.ts:96,164,236` | section/renders → attached roof reading, chimneys, rooflights | section registration; block ≥2 storeys or render | section, renders | — | none | ms | MEDIUM | KEEP |
| `v2/attached-roof-form.ts:192` | elevations → GABLE \| FLAT \| UNREAD | `MIN_SAMPLES 12`, `MIN_COVERAGE 0.6`, `MIN_PEAK_SLOPE tan12°`, rise tolerance `max(0.35, 0.2·expected)` | elevations | `UNREAD` | 2 rival readings → UNREAD | ms | MEDIUM | KEEP |
| `geometry/compile.ts:132 compileBuilding` | model → scene+diagnostics | validates first (`:135`), invalid → empty scene, no throw; object-level diagnostics WARNING/ERROR | model | 15 compile codes | — | 1-2 s | LOW | KEEP; **consume diagnostics** |
| `geometry/closure.ts geometryClosureAudit` | model+scene → findings | `volumeToleranceM3 0.002`, `coplanarToleranceM2 0.005` (`:184-185`); relation table from model semantics | scene+model | 12 finding codes | — | 0.37-1.6 s | LOW | KEEP; INSTRUMENT into score |
| `layout-gate.ts:101 evaluateLayoutGate` | layout → status+reasons | `MASS_OVERLAP >0.5 m²` AABB; footprint bands 6 %/20 %; tol 0.25 m | published footprint, spans on other frames | 20+ reasons | — | ms | MEDIUM | REFACTOR per §3(c) |

---------------------------------------------------------------------------------------------------

## 6. Assumption register (my scope)

Format: current behaviour | why | evidence basis | families that violate | hard/soft | decision.

- **ASSUMP-TOPOLOGY-001** `WALLS_OVERLAP` is exact (1e-6 m²) at the model. | double material / z-fight is a modelling error | `topology.ts:486`; PROBE P3/P2 | plan-derived partitions always carry 1-3 px ink noise (Marcówki 30, Kosaćce 45, G2E 20 planner decisions) | HARD | **keep**; upstream must never emit it (the planner is the mediator).
- **ASSUMP-TOPOLOGY-002** Partitions are emitted with **no junction records** and a 15 mm air clearance at every T/L. | avoid validator refusal | `emit.ts:244-250` comment ("no junction record is needed"); `wall-topology.ts:77`; interior closure `GAP` = 44/35/19 = every partition joint; only ring corners have junctions (12/12/8) | every plan with partitions (3/3 completing runs) | SOFT (a modelling choice) | **branch candidate**: emit `BUTT`/`T`/`CORNER` with declared tolerance ≤ k·mpp; the model resolves them exactly with zero gap (`topology.ts:199`) and reports gap/overshoot by code.
- **ASSUMP-TOPOLOGY-003** Planner: axis-aligned runs only; constants in metres independent of the raster scale (`gapM .015`, `reachM .06`, `minRunM .2`, slack `.05`); host rectangles are nominal (uncut corners). | greedy 3-house tuning | `wall-topology.ts:77-91`; no mpp input | oblique/45° partitions; plans whose ink noise in metres exceeds 6 cm (low-res copies: 550 px plans are ~1.5× coarser than 853 px) | SOFT | **soften**: express constants as k·mpp / fractions of drawn thickness; add the scale metamorphic test.
- **ASSUMP-TOPOLOGY-004** Corner ownership by convention (rings `ALTERNATE`; planner "X owns, Z arrives"). | evidence cannot decide at 1 px | `apply.ts` ring; `wall-topology.ts` ordering | none (convention, deterministic) | SOFT | keep.
- **ASSUMP-TOPOLOGY-005** An unexplained residual overlap **drops the whole partition run**, however small (`wall-topology.ts` audit; G2E: 0.0171 m² ≈ 10-14 cm end penetration, beyond `reachM`, dropped `main-iwall-0-x-4`). | never emit invalid | trace G2E `dropped_unresolved_overlap 1`, `unresolvedJoints 1` | any T whose end runs 6-15 cm into the host | SOFT | **soften**: bounded trim to the near face (≤ drawn thickness) before drop; drop only beyond it, scored.
- **ASSUMP-TOPOLOGY-006** Gate `MASS_OVERLAP` = AABB overlap > 0.5 m²; model = per-wall-pair 1e-6 m². | independent thresholds | `layout-gate.ts:124` vs `topology.ts:486`; PROBE P2a/c/e | any non-grid-snapped mass source | HARD (acceptance) | keep hard, **align** by evaluating the model's own overlap function on the candidate.
- **ASSUMP-TOPOLOGY-007** Any non-opening refusal aborts the run and discards the valid prefix; `fitOpeningsToHosts` handles 3 codes. | "never emit invalid" | `candidate.ts:379,400`; `reconstruct-v2.ts:1054` | any wrong non-opening object: attached ring (overlap), terrace, railing, balcony, chimney, stair, surface region, partition door | SOFT (object-level) | **soften**: dependency-closed delete-and-continue for non-spine commands with the validator as oracle; spine failure → candidate invalid.
- **ASSUMP-TOPOLOGY-008** `applyCommand` rejects on any pre-existing error, not on the delta. | simplicity | `apply.ts:148` | resolver drop loops (cannot attribute) | HARD | keep; add id-attribution helper.
- **ASSUMP-BODY-001** Every body is one axis-aligned rectangle ring; other footprints must be decomposed upstream. | 4-facade opening model | `emit.ts:140-173`, `openings-v2.ts` `Facade` | chamfered/oblique/curved footprints (unrepresentable → wrong silhouette) | SOFT | branch candidate (rectangle decomposition or `UNKNOWN` assembly extent).
- **ASSUMP-BODY-002** One global wall thickness T for all rings; clamp [0.15, 0.7] else 0.38 (`reconstruct-v2.ts:230`; Kosaćce measured 0.296). | plan reader gives one median | `emit.ts` uses `b.wallThicknessM` for every ring host | houses with 0.2 m garage walls and 0.4 m main walls | SOFT | keep, record as ASSUMED when clamped.
- **ASSUMP-BODY-003** Levels exist only for `main.storeys`; missing-level storeys are silently skipped at 10 sites. | main is the tallest (`layout.ts:1146`) | `reconstruct-v2.ts:251`, `emit.ts:128…523` | attached mass with a storey outside main's span (basement wing, tower) | SOFT | **soften**: union of spans + `dropped`/`unresolved` entry at every skip.
- **ASSUMP-BODY-004** Unmeasured storeys: floor 0, 2.8 m each; measured single storey under a pitched roof is stretched to ridge (Kosaćce 7.05 m) with **no model evidence on the level**. | need a wall height | `solve.ts:257`, `reconstruct-v2.ts:255`, `model.json` | any 1.5-storey/attic house with one plan read | SOFT | **soften**: `setEvidence` on levels (ASSUMED/height), attic recorded as `unresolved`.
- **ASSUMP-BODY-005** Upper-storey slab inset by wall thickness; lowest slab is the plinth (`emit.ts:160-163`). | slab meets inner faces | closure clean in 3 runs | none observed | SOFT | keep.
- **ASSUMP-BODY-006** Model id/name derive from the source title/slug and are inside the model hash. | model identity | `identity.ts:34-39`, PROBE | sources without `externalId` + tracking queries; retitled pages | SOFT | keep; add hash-input documentation; slug from `externalId` else content, never URL query.
- **ASSUMP-BODY-007** Emitter prose (`why`) is inside `setEvidence` and therefore inside the model/candidate hash. | provenance in-model | `emit.ts:100-102` (`evidence()` pushes `setEvidence` with the prose); 10-13 % of model bytes | any wording edit | n/a | keep, gate with the 3 model hashes, fix the `candidate.ts:219` comment.
- **ASSUMP-OPENING-001** Overlap/duplicate/host-less openings abort; fitted-then-overlapping are dropped. | see §1.2 | PROBE A-D; G2E trace | any project where two readings hit one gap (1/3 completing projects) | SOFT | **soften**: dedupe before emit; drop-with-reason for `OPENINGS_OVERLAP` and `UNKNOWN_WALL`.
- **ASSUMP-OPENING-002** Fit margins 5 cm side / 10 cm head, min 0.4 × 0.5 m. | leave material | `candidate.ts:303-306` | garage doors beside corners (Kosaćce −10 %) | SOFT | keep as scored decisions.
- **ASSUMP-OPENING-003** Interior door narrower than 0.5 m or beyond its run is skipped silently; door height fixed 2.1 m. | door needs stubs | `emit.ts:295`, `CONVENTIONS.doorHeight` | narrow WC doors (0.6-0.7 m are OK; 0.55 m edge) | SOFT | record the skip in `dropped`.
- **ASSUMP-ROOF-001** Main roof: only GABLE, only with stated pitch + ridge datum; ridge axis defaults `'Z'`. | evidence-only roof | `reconstruct-v2.ts:326-384,357` | hip/shed/flat main roofs, houses without a section | SOFT | branch candidate per ridge axis; `kind` hypothesis set.
- **ASSUMP-ROOF-002** Eave derived from ridge and pitch; section eaves datum unused after storey height. | one sufficient derivation | `reconstruct-v2.ts:366`; no consumer of `levels.eaves` | mismatched pitch/axis | SOFT | use the disagreement as the score between ridge-axis hypotheses.
- **ASSUMP-ROOF-003** Unread attached roof = FLAT, slab top = storey top, walls end at plate top, plate inset half T. | plan cannot say | `reconstruct-v2.ts:702`, `emit.ts:168,369,372` | any attached body without a section reading or readable elevation profile (Kosaćce ×2) | SOFT | **fix**: cap the ring walls with the plate (C3, §4).
- **ASSUMP-ROOF-004** `capWallIds` of `roof-main` = top-storey ring walls of every mass without its own roof **plus all partitions of that storey index** (`emit.ts:324-342`); attached roofs re-assign theirs afterwards (`:372`, last writer wins). | simplicity | `apply.ts:358` replaces `topProfile` | attached mass with no roof entry → partitions follow a roof that does not cover them (compiler WARNING, ignored by the service) | SOFT | latent; add coherence warning.
- **ASSUMP-ROOF-005** Roof over a guessed storey is not flagged in the model (only candidate L0). | — | §1.3 | Kosaćce | SOFT | C1/C3.

---------------------------------------------------------------------------------------------------

## 7. Single-hypothesis lock-in points (my scope) and whether top-N is cheap

| Lock-in | Where | Cheap to keep top-N? |
| --- | --- | --- |
| Body decomposition → one rectangle set | `emit.ts:140-173` (input from layout) | The emitter takes a `BuildingV2`; emitting K candidates = K calls. Cost per candidate (from traces): planner 117-457 ms + emission-fit 94-227 ms + seal 158-402 ms = **0.57-1.03 s**; closure audit adds 0.37-1.6 s. K=3 ≈ 2-5 s versus 250-340 s total (≈1 %). **Cheap** at this stage. |
| Roof form/axis | `reconstruct-v2.ts:357,380` | cheap (2 axes × 1 form); needs the scoring signal (eaves datum vs derived eave). |
| Levels/storeys | `reconstruct-v2.ts:249-256` | cheap; two ladders (section vs convention) differ only in numbers. |
| Partition topology | `wall-topology.ts` greedy order | cheap to add one alternative (drop vs bounded trim); the planner is 117-457 ms. |
| Openings | `readWallOpenings` one reading per gap; fit is greedy | cheap (dedupe + fit are ms). |
| Wall-thickness T | one global | cheap (T±). |
| Ring corner ownership | convention | no need. |
Not retained today: any of them — the pipeline returns the first program.

---------------------------------------------------------------------------------------------------

## 8. Hard vs soft — summary of terminal gates I audited

Stay hard: §3(b). Become scores / late validation: §3(c). New warning-severity validators to add: §3(b) last paragraph. The single most valuable structural change is **delete-and-continue with dependency closure** at `fitOpeningsToHosts`
(the model's validator remains the only oracle; spine failure marks the candidate invalid; everything else becomes a named hole).

---------------------------------------------------------------------------------------------------

## 9. Failure taxonomy contributions

| Code / condition | Class | Note |
| --- | --- | --- |
| `MODEL_EMISSION_FAILED` / `WALLS_OVERLAP` (Kosaćce pre-004A, command 52) | algorithm assumption (partition runs read as-is) | fixed generically for partitions; still open for ring-vs-ring and returns (no planner protection) |
| `MODEL_EMISSION_FAILED` / `OPENINGS_OVERLAP`, `UNKNOWN_WALL` on an opening (PROBE A, C, D) | unimplemented semantic (dedupe/drop) | not observed as a run failure yet; observed as a named drop in G2E |
| `MODEL_EMISSION_FAILED` / any other code | unimplemented semantic (no delete-and-continue), untested path | prefix discarded |
| `PLAN_LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG` (phone Kosaćce 33.15 vs 164.47 m²) | source limitation **for that copy** (area-table copy only) + algorithm assumption (one copy read; other copies existed) | gate behaved correctly on a wrong decomposition |
| `PLAN_LAYOUT_REJECTED / MASS_OVERLAP` | algorithm assumption (AABB, 0.5 m²) | latent mismatch with the model tolerance |
| `VERIFY_REPLAY_FAILED` | implementation bug if ever raised | `verifyReplay` ok in all 4 runs |
| `SCENE_COMPILE_FAILED` | unreachable for valid models (`compile.ts:135`); diagnostics ignored | soft channel unused |
| planner `DROPPED_*` (Marcówki 2 stubs, Kosaćce 3 short, G2E 1 overlap) | algorithm assumption (thresholds) | named, scored candidate |
| closure `COPLANAR_DUPLICATE` ×8 | implementation bug (dead `attachedCapIds`) | §4 |
| closure interior `GAP` ×44/35/19 | algorithm choice (no junction records, 15 mm clearance) | ASSUMP-TOPOLOGY-002 |

---------------------------------------------------------------------------------------------------

## 10. Top 5 findings

1. **[HIGH] Emission is all-or-nothing outside three opening codes, and the failure path throws the evidence away.** Any non-`FIT_CODES` refusal (host-less opening, duplicate/overlapping opening, any object) is `MODEL_EMISSION_FAILED`; `fit.program`
   (the valid prefix), `fits`, planner decisions and `BuildingV2` are discarded (`reconstruct-v2.ts:1054`); zero tests exercise it; the "opening without a host is dropped" behaviour asked for by the resolver does not exist (`candidate.ts:330` unreachable; PROBE A/C/D).
   Smallest generic change: generalize `fitOpeningsToHosts` to dependency-closed delete-and-continue for every non-spine command (validator as oracle, `bindings` for dependents), spine failure ⇒ candidate invalid; carry the prefix ids in the failure diagnostics.
2. **[HIGH] The 004A reason for not bumping `SOLVER_V2_VERSION` is false, and the real model-hash surfaces are unguarded.** Version is in the candidate/hypothesis hashes only (PROBE); model hash includes free-text `interpretation` (10-13 % of bytes), title-derived `id`/`name`, and the passing inputs' three model hashes are the only true gate.
   Smallest change: bump to 2.2.0 with the resolver, pin `6152770f…/5b5ffcf1…/8fa4a25b…` (+ scenes) as a test, document the two hash surfaces, fix the `candidate.ts:219` comment, take the slug from `externalId` or content, never from a URL query.
3. **[MEDIUM-HIGH] The partition planner manufactures the interior "cracks" the closure audit reports and works in absolute metres on axis-aligned runs only.** No junction records + 15 mm clearance ⇒ `interiorFindings` 48/42/19 are exactly the partition joints (44/35/19 GAP ERRORs, measures = 0.015 m); the model already resolves BUTT/T exactly; unexplained overlap drops a whole run (G2E 0.0171 m²).
   Smallest change: emit BUTT/T/CORNER junctions from the planner's own decisions with a declared tolerance ≤ k·mpp, bounded trim before drop, constants relative to mpp/thickness, plus the scale metamorphic test.
4. **[MEDIUM] The 8 Kosaćce `exteriorErrors` are a real, one-line emitter defect (audit correct), and compiler diagnostics are never read.** Attached ring walls end in the plane of an assumed flat plate; `attachedCapIds` is dead code; scratch fix takes 8 → 0. `scene.diagnostics` (`WALL_NOT_UNDER_ROOF`, `OPENING_ABOVE_WALL_TOP`, …) is not consumed by `analysis-service`.
   Smallest change: cap the carrying ring walls with the plate when no parapet is read; feed compile diagnostics and closure findings into the candidate score.
5. **[MEDIUM] "Guessed storeys" are neither validated nor labelled in the model, and level lookups fail silently.** No validator ties roofs to walls or levels to each other (roof 50 m away, upper-only level, 7.05 m wall on 2.8 m level all ACCEPTED); levels carry no evidence (`emit.ts:122`); levels only for `main.storeys` with 10 silent `continue`s; the MASS_OVERLAP gate (0.5 m² AABB) is 5×10⁵ looser than the model's overlap limit.
   Smallest change: warning-severity coherence validators feeding the score, `setEvidence` on every level, `dropped`/`unresolved` at every skip, gate overlap computed with `wallOverlapIssues`, `UNKNOWN` assemblies as the marker for unresolved wings.

### What would falsify "the analyzer is becoming generic"
Any of: (1) an unseen project whose sealed evidence satisfies the coarse contract C1-C7 (a printed rectangle, ≥1 level) still ends as `MODEL_EMISSION_FAILED` or `PLAN_*` instead of a marked partial;
(2) adding the resolver changes the model or scene hash of Marcówki `6152770f43f4/8c7d43956d74`, Kosaćce `5b5ffcf1afcd/50217b856dfc` (clean and tracked) or Rarytasy G2E `8fa4a25bcd58/d4e7249bb1bd` — passing inputs must stay bit-identical;
(3) the same synthetic partition set rendered at 0.012 / 0.024 / 0.036 m/px with ±2 px ink noise yields different planner decision multisets (scale dependence of `reachM`/`gapM`/`minRunM`);
(4) a fifth project needs any constant in `wall-topology.ts`, `candidate.ts:300-306`, `openings-v2.ts:71` or `layout-gate.ts:124/148-150` changed to complete; or
(5) a model with a roof 50 m from its walls, or a storey silently missing from an attached mass, is still emitted as `COMPLETED` with no warning.
