# STAGE BUILDPLAN-ANALYZER-005L — storey registration, per-storey footprint stacking, blind round 9

| verdict | result |
| --- | --- |
| ROOT_CAUSE | Placing the other storey and deciding what it stands on were one test on the upper plan's *envelope*. A06, A07, A01, D00, żurawkach and gozdzikowcach: the envelope took in a publisher mark, an eave line or roof planes, so no placement was generated (`ALIGNMENT_NO_CANDIDATE`). Even where one was generated, support was "the envelope covers ≥ 50 % of a body", and the emitter copied the ground ring upstairs (§A) |
| PLAN_ALIGNMENT | **FIXED**: wall-on-wall correspondence over bounded named hypotheses, each recorded with its basis. These are stated chains, printed scale, a fitted rectangle, facade wall pairs and the same pixel scale. The score is a true Dice share of long walls. A tie is decided at the walls' own pixel resolution (§B) |
| UPPER_BUILT_REGIONS / SUPPORT_RELATIONS | **FIXED**: every walled body of the other plan is weighed against every lower mass, with directional shares. A body SUPPORTS only over a room's span on both axes, otherwise it is INCIDENTAL. Overhang is decided by erosion. Contiguity and storey-wall thickness are enforced (§B) |
| PER_STOREY_FOOTPRINT / EMITTED_UPPER_GEOMETRY | **PASS**: per-storey rectangles reach rings, openings, interior hosts, slabs and attached roofs. Copying the ground ring upstairs (M6) is killed by five end-to-end PNG→model fixtures. A matching upper ring on a development row is shown, region by region, to be the upper plan's own walled body (§C, §E) |
| GARAGE/WING SAFETY | **PASS**: no development garage gains a storey. M2 (every mass gets every storey) and M7 (incidental overlap) are killed by §25 fixture B, the v2 wing fixtures and corpus 5b (§C) |
| A06 / A07 | **FIXED generically**: ALGORITHMIC_FAIL → PASS. A06 is 2 / 2 storeys at +0.18 %, A07 2 / 2 at −0.37 % (§D) |
| A01 | **storey fixed**: the attic is registered (wall pairs, k 0.923) and stacked on the main body. Still ALGORITHMIC_FAIL on the pre-existing ground-floor `FILL_TOO_LARGE` (out of scope) (§D) |
| D00 | **storey fixed**: the attic is registered and stacked. Still ALGORITHMIC_FAIL on the ground footprint, −18.71 % (the base plan misses the garage; out of scope) (§D) |
| DEVELOPMENT_REGRESSION | **PASS**: 40 rows. Four rows go FAIL → PASS (A06, A07, żurawkach, tunbergiach) and no PASS row moves. Marcówki and willa-miranda keep the 005K model. Two models move with their verdict kept, both explained (§E) |
| DRAWN_GAP_RULE | **OFF**: it is never passed. The product default is OFF, and the 005K architecture gate forbids any app from naming it (§F) |
| ORDER_INVARIANCE | **PASS**: family A moves nothing in 8 shuffles on any row. Family B (the 005K chain-order debt) is measured and now reaches a storey decision on two rows refused at plan resolution (§G) |
| NON_CIRCULARITY | **PASS**: `layoutOptionsOnly` whitelist, Proxy test, pinned published uses, vocabulary gates and executed decoys. M4 and M8–M10 are killed (§C) |
| PERFORMANCE | **PASS**: layout median +1.2 %, analyzer wall +0.9 %. The new alignment (1.5 ms) and support work (+45 ms) are explained (§H) |
| COUNCIL | five reviewers, all CHANGES_REQUIRED at `4ad69fe`: 7 P0, 20 P1, 24 P2. Every finding is resolved, recorded or documented (`post-review/resolution.md`) (§I) |
| FREEZE | `PRE_HOLDOUT_9_SHA = 8f5f3c5903bc8cfe168667f6b5dcfdb995eaf4cd`. CI run 37595482179 green on attempt 1: 39 jobs pass, 2 skipped (§J) |
| BLIND ROUND 9 | **#1 `dom-w-murajach` (stratified, multi-storey): ALGORITHMIC_FAIL**. First bad decision BODY_RELATION on the ground plan (a recessed entrance beside the garage door), upstream of every storey decision. At the 005K code it failed too (−13.5 %). **#2 `dom-w-cieszyniankach` (unstratified): PASS**, single storey (§K) |
| INHERITED_ARM64_DEVICE_PARITY | **PENDING** (§L) |
| OWNER APK | see §T |
| NEXT | **FIX_RECESSED_ENTRANCE_BODY_RELATION** (`recommendation.md`) |
| **Stage** | **PARTIAL**: `PARTIAL_BUILDPLAN_ANALYZER_005L_BLIND9_BODY_RELATION_FAIL`. Every condition of §45 holds except the last: fresh blind round 9 has one ALGORITHMIC_FAIL. It is not a storey failure and not caused by this stage |

**Branch and history.**
- Branch `analyzer/storey-registration-mass-stacking-v1`, from `a70047f` (the 005K close, verified).
- The stage branch was first pushed at `e44d1c5`, and the WIP commits before it arrived with it. After that, every push
  also went to `claude/new-session-3kzcgh`, except the commits from `4ac5761` to `44c64b4` while CI run 37583847761
  was running. Those reached it with `8f5f3c5`, the freeze candidate, so that the run would not be cancelled.
- No history rewritten, no force-push, no reset, no stash. Legacy untouched.

**What the repository received.**
- One production change: storey registration, the support relation and per-storey footprints in
  `packages/reconstruction`. Its plumbing: Evidence Pack 1.3.0, the plan-diagnostics storey digest and
  `LAYOUT_INFERENCE_VERSION` 1.1.0 in the run's versions.
- Tests and architecture gates.
- The research harness `research/analyzer-005l/` (never imported by production).
- The round-9 protocol (`holdout/`), the artifacts, this report and `PROJECT_STATUS.md`.

No publisher pixel, crop, overlay, PDF, HTML or model file entered the repository. Pictures were looked at only in
`/home/user/work005l`, outside the worktree, and nothing about them is committed beyond numbers and ids.

**No AI model is in the analyzer.** Model use was limited to the council, five blind sub-agents of this session.

---

## A. Baseline forensics (`baseline-storey-registration.json`)

The structural pass, the production entry `composeStructuralLayout`, was traced at the starting code on every
development row's sealed evidence, with every alignment candidate, the chosen one, its rival and every support share.

| row | first bad decision | latent |
| --- | --- | --- |
| A06 | UPPER_ENVELOPE_TOO_COARSE → ALIGNMENT_NO_CANDIDATE. The attic plan prints no chain; its envelope runs to the publisher mark at the sheet foot (659 × 597 px against 337 × 531 px of walls), so every fitted rectangle is 1.5–2.4× anisotropic and none is generated | 50 % lower-coverage rule; emitter copies the ground ring |
| A07 | the same. The envelope takes in three mark "regions" under the plan, and every fitted rectangle is 1.63× anisotropic | the same |
| A01 | the same. Envelope and only BUILT region are the eave band; the band survey takes the eave as the wall (28 px against 11) | upper body missing |
| D00 | the same. The envelope is the roof outline, and roof planes count as BUILT regions | base plan misses the garage (footprint) |
| A03, jabłonkach | ALIGNMENT_SCALE_WRONG: placed at 0.698 and 1.404, stacked only because the mapped envelope covers the body, then the ground ring was copied | "known-good by accident" |
| Marcówki | registered correctly (1.020, margin 0.27); the emitter ignored the recorded footprint | — |
| żurawkach, gozdzikowcach | no candidate for the basement / attic plans (sheet furniture in the envelope) | — |

The two questions, *where the plan sits* and *what each walled region stands on*, were one test on the envelope. The
emitter discarded whatever the test found.

## B. The fix (`architecture.md`)

- **Registration** (`alignPlans`):
  - Hypotheses: each placement records its basis. They are STATED (both plans' whole-building chains), PRINTED_SCALE,
    FITTED, WALL_PAIRS (the outermost facade walls paired on both axes, scales agreeing within 2 %) and
    SAME_PIXEL_SCALE.
  - Score: Dice over long walls, plus small coverage and statement priors. The wall shared is counted only on the
    lower wall itself, so stretching cannot buy wall.
  - Order: a total order on each placement's own numbers.
  - Ties: a tie is any margin at or below the score's pixel resolution, one pixel per wall end.
  - Held readings: a statement or printed scale overrules a fit only when the walls do not refute it twice; either
    way, the outcome is on the record.
- **Upper bodies** (`upperBodiesOf`):
  - the same body test as the base;
  - perimeter walls of at least 0.75 of a storey wall (no parapet storeys);
  - sides reached to where both perpendicular facade walls run;
  - outer faces on set-back sides.
- **Support** (`storeySupportOf`):
  - SUPPORTS needs a room's span on both axes; anything less is INCIDENTAL and carries nothing.
  - A body less than half carried gives no piece.
  - Pieces merge only across seams.
  - Overhang is decided by erosion: NONE, WITHIN_TOLERANCE, or BEYOND, which is named.
- **The storey decision:** outward from the base, with these rules.
  - Contiguity: a body reaches k only through k ± 1.
  - The lower guard applies only above a non-ground base.
  - Near ties are conflicts, and the bodies only the chosen placement stands on are disputed, as named gaps.
  - A stacked basement never becomes the ground.
- **Emission (v2):**
  - `MassV2.storeyRects` and `rectAt` reach rings, openings, interior hosts, shared doors, surface regions and attached
    roofs.
  - The lowest storey's slab is its own footprint; extra pieces get no slab.
  - Meeting pieces are named, not walled apart.
  - A plan's storey index is the layout's own rank.
  - Outer faces yield to a registration only where its scale is stated.

## C. Synthetic corpus, emission fixtures, mutations

- **`synthetic-storey-corpus.json`:** the 22 layouts the stage's 18 corpus tests draw as pixel plans and decide
  (`storey-support.test.ts`).
- **The council suite** (`storey-council.test.ts`) adds 16 fixtures: A5L-1 to A5L-11, B5L-1, and D5L-4 plain and
  mirrored.
  - Cases covered: an inset storey, a partial upper storey, an L, two disconnected regions, a terrace and void, a
    garage, a wing, a sliver, an overhang on either side, a basement smaller or larger than the ground, an attic over
    an unresolved storey, exact and ±1 px ties, a parapet, a title frame, and frame and chain order.
- **`emitted-geometry.json`:** the stage's four houses, run through the whole v2 pipeline from PNG sheets
  (`storey-emission.test.ts`).
- **Five council houses** run the same way (`storey-council-emission.test.ts`): an inset storey, an L, UPPER + ATTIC,
  a partial basement, and a basement under the garage only.
  - Each storey's ring is its own.
  - Upper openings sit on the upper storey's own walls with their sills.
  - The garage stays one storey.
- **Mutations** (`mutation-results.md`): M1–M7 of the brief and M8–M10 (the council's three published-fact
  choosers). All ten are **killed**. A ±25 % knob sweep records which constants the corpus pins (2 of 14 moves) and
  names the rest as unpinned, not tuned.
- **Non-circularity:**
  - `inferStructuralLayout` reads its options only through an explicit key list, and a Proxy test proves it.
  - `structural.ts` names the published areas in exactly three lines.
  - The support section and the v2 `storeyRects` block name no published fact, count or house.
  - Literals are frozen.
  - Executed decoys (a published footprint ×1.25 or absent; a room list claiming a third storey) leave decisions and
    rings byte-identical.
  - The 005A resolver's footprint veto can still change the *base reading* a storey is derived from. That boundary is
    stated in `architecture.md` §6 (council C5L-7).

## D. Development cases

| row | before | after | how |
| --- | --- | --- | --- |
| **A06** | FAIL: 1 / 2 storeys, `NO_MASS_REACHES_UP` | **PASS**: 2 / 2, footprint +0.18 % | The attic plan is placed by facade wall pairs (k 1.000, margin 0.022 against a resolution of 0.006). Its walled body stands on the main body (6.98 × 9.79 m) and on the porch (3.74 × 1.22 m). The 3.96 m² it overhangs in front of the main beside the porch is a named BEYOND overhang. The upper rings equal the ground rings because the upper plan's walls enclose the same body |
| **A07** | FAIL: 1 / 2, `NO_MASS_REACHES_UP` | **PASS**: 2 / 2, −0.37 % | Wall pairs, k 1.001. The upper walled body [0.22, 0.21, 16.90, 7.57] stands on the body and snaps to it. The three publisher-mark "regions" are NOT_A_BODY. Every rival weighed stands it on the same body |
| **A01** | FAIL: no candidate; `MODEL_EMISSION_FAILED` | FAIL: same code; the storey is now stacked | Wall pairs, k 0.923. The attic stands on the main body; the two front bodies are disputed by a near rival (named gaps). The run still stops on ground-floor window `opening-0-east-1-0-unit`, FILL_TOO_LARGE (frame 0.2 m into a 0.15 m wall), the same window as before 005L. Not caused by the upper footprint; out of scope |
| **D00** | FAIL: 1 / 2, −18.71 % | FAIL: 2 / 2, −18.71 % | The attic is placed by wall pairs (k 1.034) and stands on both bodies; its overhang (12.2 m²) is named. The footprint failure is the ground plan missing the garage, which is not a storey decision and is out of scope |
| żurawkach | FAIL (storeys) | **PASS**: 3 / 3, −0.81 % | The basement and attic plans are placed by wall pairs. The basement's walled bodies cover the whole house, and the attic is set back 0.82 m on the attached body |
| tunbergiach | FAIL (storeys) | **PASS**: 3 / 3, −0.37 % | The upper body is the whole house. The attic is its own 3.9 × 3.3 m walled room standing on the house (14.6 m² ring), never a copy |
| Marcówki | PASS | PASS, **model byte-identical** to 005K (pin `6152770f`) | The near-tie conflict (a k 1.106 rival standing the attic on house + garage, 0.044 behind) is kept, so the gate is PARTIAL (council E5L-2) |
| willa-miranda | FAIL | FAIL, model identical | The upper plan's decomposition yields no walled body (storey-wall fraction 0.13): UPPER_REGION, untouched. The printed scale (1.295) is weighed and REFUTED on the record |
| A03, jabłonkach | PASS by accident | PASS, now by the walls | A03 is placed by wall pairs at k 1.001; jabłonkach at its own pixel scale (margin 0.22) |

## E. Development matrix (`development-matrix.json`, `storey-registration.json`)

All 40 rows were re-solved by the solver alone on their sealed evidence at the freeze candidate's production code. The
old side is 005K's own replay at the starting code.

| | rows |
| --- | --- |
| PASS → PASS | 13 |
| FAIL → PASS | **4**: A06, A07, dom-w-zurawkach, dom-w-tunbergiach |
| FAIL → FAIL | 23 |
| PASS → FAIL | **0** |

Six models move: the four above, plus two whose verdict is kept.
- **dom-w-morelach** (PASS). Its upper plan is now placed at its own pixel scale, k 1.000, corroborated by paired
  facade walls. Before, it was a 0.934 fit at margin 0.001. Rings and footprint are unchanged. The upper storey's
  interior is read at the new registration: 10 partitions instead of 13, 4 rooms instead of 3 (the publisher lists 9),
  6 doors instead of 7, 5 windows instead of 6. No verdict predicate reads this.
- **D00** (FAIL). Its attic now stands on the house (§D).

Every upper ring that equals the ring below (A06, A07 and tunbergiach at level 1; żurawkach's ground over its
basement) is the other plan's own walled body standing on that body. `storey-registration.json` shows each region,
its bounds and its SUPPORTS relation. None is a copy.

**A discarded trace.** One full storey trace, run while the mutation harness was patching production files in a
sibling worktree, gave M1–M3-like support decisions on the six rows it processed in that window. Four isolated reruns,
a rerun under CPU load and a direct test all reproduced the clean answers. The mechanism was not identified. That trace
was discarded, and every measurement since was run with nothing else running.

## F. Diagnostics and the drawn-gap rule

- **`storey-registration.json`:** every development row with plans of more than one storey. It records the plans by
  role, the base, and each registration: candidates, chosen, rival, margin, resolution, scale basis, printed scale and
  held reading. It also records walled regions with storey-wall fraction, support relations with directional shares,
  mass spans, the gate, and the emitted levels of the same code.
- **Evidence Pack 1.3.0:** `14b-storey-support.json` and STOREY_SUPPORT timeline events, from the plan-diagnostics
  storey digest.
- **Drawn-gap rule:** OFF. Nothing passes it, the decomposition defaults it to OFF, and
  `tests/architecture/gap-evidence.test.ts` forbids any app from naming it.

## G. Order invariance (`order-invariance.json`)

- **Family A:** on every development row with more than one plan, 8 seeded shuffles of frames, metric evidence,
  registrations, dimension observations and published facts. **No row moves** in decision, region, relation, span or
  footprint.
- **Family B:** the dimension chains alone, the 005K debt, which moves the decomposition grid upstream of the regions.
  - The debt reaches a storey decision on 12 rows at the stage code against 10 at the starting code.
  - It is newly exposed on A04 and dom-w-gozdzikowcach, because the grid now cuts the upper regions 005L reads.
  - Both rows are refused at plan resolution, before and after.
  - Measured, not repaired (§32).

## H. Performance (`performance.json`)

The same harness was run at both commits, one after the other on the same container with nothing else running.

| median | starting code | stage | |
| --- | --- | --- | --- |
| plan reading | 578 ms | 558 ms | |
| alignment (all other plans) | 0.1 ms | 1.5 ms | new hypotheses; 1–9 ms a row |
| layout (production entry) | 807 ms | 817 ms | **+1.2 %**; per-row median ratio 0.996 |
| rest (support, storey decision, everything after alignment) | 265 ms | 310 ms | the support scoring |
| analyzer wall per development row | 22.75 s | 23.0 s | **+0.9 %** |

- The largest per-row layout increase is A07, +24.7 %. Its upper plan, never registered before, now has 113
  candidates and its support is weighed.
- Rows that run no 005L code spread 0.77–1.18 between the runs, which is the noise.
- Candidates: median 66, maximum 569.
- No median regression over 15 % on the layout or the analyzer.

## I. Council (`post-review/`)

Five blind reviewers attacked `4ad69fe`:
- A: registration topology;
- B: emitted geometry;
- C: non-circularity;
- D: generalization;
- E: regression, performance and Android.

All five returned CHANGES_REQUIRED, with 7 P0, 20 P1 and 24 P2.

The P0s:
- **A5L-1:** a fit overrode both printed scales, stretching an inset storey.
- **B5L-1 / E5L-1:** Marcówki's attic was cut short of its gables.
- **B5L-2:** UPPER + ATTIC was read from the wrong plans.
- **B5L-3:** an L was merged into the body rectangle.
- **D5L-1:** a same-pixel-scale assumption went unrecorded.
- **D5L-2:** cantilevers were clipped with no flag.

`resolution.md` maps every finding:
- **P0:** six are fixed, and D5L-1 is recorded and documented.
- **P1:** all are fixed, except E5L-2 (Marcówki's near tie), which is kept on the record with its reason. D5L-8, the
  knobs, is measured.
- **P2:** each is fixed, documented or accepted.

The first fix commit caused two full-suite regressions, both fixed with a test:
- §25 fixture C went PARTIAL, because the A5L-11 conflict fired on a correct set-back. It is now a record.
- §25 v2 fixture 5 lost a door to a stretched registration. `matchedLength` had over-counted wall past its ends; it is
  now a true Dice. The plan-frame rule now applies to stated scales only.

## J. Freeze

- Every §35 condition was met at `8f5f3c5`:
  - the A06/A07 root is fixed generically;
  - the corpus, emitted-geometry gates, garage/wing safety and non-circularity are green;
  - mutations are killed and order invariance holds;
  - the development matrix is complete and the drawn-gap rule is OFF;
  - council P0/P1 are closed (`resolution.md`).
- The freeze CI, run 37595482179, is green on attempt 1: 39 jobs pass, 2 skipped by design.
- The run before it (37583847761 on `4381d25`, the same production code) failed once on the UI evidence gate. The
  emulator could not reach the publisher for the Rarytasy slice (`slice-rarytasy-01-failed`, "the publisher could not
  be reached"), while the Marcówki and Kosaćce slices fetched from the same host passed. Its one re-run was green.

**`PRE_HOLDOUT_9_SHA = 8f5f3c5903bc8cfe168667f6b5dcfdb995eaf4cd`.** No production code changed after it.

## K. Blind round 9 (`blind-round/README.md`)

- **Seed:** `24d9826d…22e7`, recomputed independently.
- **Pool:** 1609 drawable, 1476 excluded (`fd13e2ca…`).
- Each house ran once, live, with the frozen code: recogniser ON, Evidence Pack ON, drawn-gap rule OFF.
- Verdicts were sealed at 09:52:35Z, before any diagnosis.

| # | house | draw | verdict | first bad decision |
| --- | --- | --- | --- | --- |
| 1 | `dom-w-murajach` | stratified, k = 0, plan storeys [1, 3] | **ALGORITHMIC_FAIL**: typed `METRIC_RESOLUTION_INCONCLUSIVE`, no model | **BODY_RELATION** on the ground plan. The recessed entrance vestibule and the 250 cm garage door share the front line: the house body is not enclosed (6.45 m mouth), the garage mouth is not shut and the garage is left outside the extent. The boundary is not accepted, so the attic plan becomes the base. 005L registers the ground plan below it, and the ground storey's own 7.04 m² of closed rooms is refused against the published 75.83 m² |
| 2 | `dom-w-cieszyniankach` | unstratified, i1 = 349 | **PASS**: 1 / 1 storey, −5.1 %, every opening built | — (single storey; the storey code was not exercised) |

**#1 against the starting code (diagnosis only).**
- At `a70047f` the same sealed evidence completes a model. The attic outline is copied down as the ground floor (65.56
  m² on both levels, −13.54 %), which the frozen verdict script also judges ALGORITHMIC_FAIL.
- So the house failed before 005L. 005L turned a wrong model into a typed refusal, because a storey's footprint is now
  its own plan's.
- The first bad decision is upstream of every storey decision. It is the same class as blind-8 #1
  (`dom-w-gozdzikowcach`).

**A fresh ALGORITHMIC_FAIL makes 005L PARTIAL** (brief §38, §45).

## L. OWNER APK and the inherited device gate

- **OWNER APK:** see §T, written after the dispatch run.
- **INHERITED_005H_ARM64_DEVICE_PARITY: PENDING.** No physical arm64 phone result was supplied, and none is claimed
  from an emulator.

## M. Residuals of this stage (measured, not repaired)

| residual | where | note |
| --- | --- | --- |
| an upper plan whose decomposition finds no walled body | willa-miranda (storey-wall fraction 0.13) | UPPER_REGION; the row is unchanged from 005K |
| an L- or T-shaped storey is built as its largest rectangle; the rest is a named gap | synthetic `l-two-masses`, B5L-5 | the emitter builds rectangles |
| the gable soffit near an inset eave side is taken from the storey rectangle | council B5L-8 | presentation of openings only |
| a statement held against a better fit cannot tell a misread chain zero from a true set-back | A5L-11, D5L-10 | recorded as `held`; tick correspondence would separate them |
| a parapet collinear with a full wall merges into its band | A5L-8 | thin parapets are excluded |
| knobs the synthetic corpus does not pin | 12 of 14 ±25 % moves | `mutation-results.md` |
| the chain-order debt now reaches two storey decisions | A04, gozdzikowcach | both refused at plan resolution |
| `upperStoreysHoldTheirRooms` sums levels and compares gross ring with net rooms | verdict only | C5L-4 / E5L-8 |
| no rotation or mirror hypothesis between storey sheets | D5L-9 | stated in `architecture.md` |

## N. Deviations

1. **Pushes to `claude/new-session-3kzcgh` were batched** while a CI run was in flight (§ Branch). Nothing was skipped:
   every commit reached both branches before the freeze CI.
2. **One storey trace was discarded** (§E). It was run while the mutation harness patched a sibling worktree. Its
   result was not used, and every measurement after it ran alone.
3. **Council fixes changed two of the council's own suggestions.** The A5L-11 held-reading *conflict* became a
   *record*, after it turned a correct §25 fixture PARTIAL. The plan-frame rule (B5L-5) became conditional on a stated
   scale, after it removed a door from §25 v2 fixture 5. Both are explained in `post-review/resolution.md`.

## O. Gates

| gate | result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 171 files, 2256 tests pass (11 skipped by design) at the council-closed code |
| `npm run build` | pass |
| CI | freeze run 37595482179 green on attempt 1; final run in §T |
| no publisher pixel committed | the Evidence Packs carry the analyzer's own layers and its own model preview only; every picture of a source stayed in `/home/user/work005l` |

## T. Final CI and OWNER APK

Pending: the `workflow_dispatch` run with `owner_apk` on the commit that carries this report. That run is also the final
CI. Its verification from the downloaded APK and the Polish OWNER checklist follow in the next commit.
