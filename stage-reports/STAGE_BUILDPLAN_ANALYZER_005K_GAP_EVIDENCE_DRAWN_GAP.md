# STAGE BUILDPLAN-ANALYZER-005K — gap evidence, a sealed fresh-sheet gap set, and the deterministic drawn-gap rule

| verdict | result |
| --- | --- |
| UI_EVIDENCE_HARNESS | **PASS**: the 005J `openStage` race is fixed in test code only. The UI evidence gate is green on the patched harness (run 37533180890, attempt 1) and on the freeze (run 37539569712). Product main code is unchanged. Production work began before the gate was green: deviation D2 (§A) |
| PER_GAP_EVIDENCE | **PASS**: every WEAK gap carries a trace and a source-addressable record keyed `frameId / decompositionId / gapId`, with crop rectangle and ink-mask hash, never pixels. Boundary evidence 1.2.0, Evidence Pack 1.2.0 (`12b-gap-evidence.json`). Deterministic for the source as enumerated; limits stated (§B) |
| FRESH_SHEET_GAP_SET | **PASS (below target)**: 14 projects drawn by lot (8 ARCHON, 6 DobreDomy), 60 gaps on 9 read sheets, sealed before any label. Labels by blind AI sub-agents, **not human**: OPENING 44, OPEN 0, NOT_A_WALL_LINE 10, UNRESOLVED 6; κ 0.845 (§C) |
| DRAWN_GAP_RULE | **INSUFFICIENT_EVIDENCE — stays OFF**: 10 resolved negatives where 30 are needed, and no open side. Rule 25 upgrades, OPENING recall 24 / 44, false upgrades 1 / 10 [0.018, 0.404], 0 outcome-critical. There is no safety evidence either way, and a known closure path exists (§D) |
| CONSTANT_CONTROL | **measured**: 60 upgrades, 10 / 10 false [0.723, 1], 0 outcome-critical (§D) |
| DEVELOPMENT_REGRESSION | **PASS**: OFF reproduces 26 / 26 sealed hashes or failure codes. ON changes one model (dom-w-zurawkach), with its verdict unchanged; that change is not fully explained (§E) |
| GOZDZIKOWCACH / CYKLAMENACH | unchanged under ON. The 0.41 m gap is not taken (jamb ink 0.06); REC-17 is not weakened (§E) |
| ORDER_INVARIANCE | **PASS, family A**: 0 of 192 shuffles of copies, callouts, observations and registrations move a record. Family B (chain order) moves the grid upstream on 83 / 192, never a record on an unchanged grid (§F) |
| NON_CIRCULARITY | **PASS**: architecture gates, strengthened after the council. Mutations M1–M6 all KILLED, with stated limits (§F) |
| PERFORMANCE | **PASS**: OFF +0.1 %, ON +1.5 % solver time; 0.2 ms and about 1.7 KB a record; RSS unchanged (§G) |
| COUNCIL | four reviewers: A, B and C CONDITIONAL PASS, D CHANGES REQUESTED (1 P0, fixed). All 12 P1 fixed or stated (§H) |
| PRODUCTION_ADOPTION | **NOT ADOPTED**: production decisions unchanged; the observational records stay |
| FRESH_BLIND / BLIND ROUND 9 | **NOT_RUN_BY_DESIGN**: the rule did not ship (brief §30) |
| INHERITED_ARM64_DEVICE_PARITY | **PENDING**: 005H's on-device check is the OWNER's to run; no device here |
| OWNER APK | **not published**: no production decision changed (brief §40) |
| NEXT | **FIX_STOREY_COUNT** (§I) |
| **Stage** | see §K |

**Branch and history.**
- Branch `analyzer/gap-evidence-drawn-gap-v1`, from `analyzer/floorplan-intelligence-audit-v1` @
  `1314df729edc4eb6bb3af5a4e033727b364b4153` (verified).
- Every push to the stage branch also went to `claude/new-session-3kzcgh`, except four. The commits from the manifest
  seal to the evaluation (`70aa0a4`…`591197d`) went to the stage branch alone, so that the freeze's CI run would not be
  cancelled (§K).
- No history rewritten, no force-push, no reset or stash.
- Legacy untouched.

**What the repository received.**
- One production change, behind an OFF flag: per-gap traces and records, the experimental rule, and their plumbing.
- Tests and guards.
- The research harness `research/analyzer-005k/` (never imported by production; `research-isolation.test.ts`, 005K
  block).
- Artifacts, this report and `PROJECT_STATUS.md`.

No publisher pixel, crop, overlay, PDF, HTML or model file entered it. Bytes, crops, runs and label answers are in
`/home/user/work005k`, recorded by SHA-256 only.

**No AI model is in the analyzer.** The only model use was the labelling and the council: blind sub-agents of this
session, reading composed crops locally, as 005J's oracle did.

---

## A. Phase 0 — the UI evidence harness (`ui-evidence-preflight.md`)

**The 005J failure.**
- `compose.onNode(hasText(label) and hasClickAction()).performClick()` ran mid-recomposition.
- It found a number of nodes other than one: the house behind the modal sheet prints the stage name too.
- Compose then built its "expected one node" message on the instrumentation thread (`printToString`), and its own
  thread check threw. That hid the real mismatch.

**The fix (`b747440`, test code only).**
- `Evidence.awaitExactlyOne` counts through `fetchSemanticsNodes` inside `waitUntil`, and fails with an assertion that
  names the count.
- `clickExactlyOne` waits for exactly one node, then clicks.
- `stageList()` scopes rows to the sheet's own scrolling list.
- `openStage` runs, in order: idle → exactly one list → scroll → exactly one row → click → idle → scroll to the action.
- The fix adds no sleep, weakens no assertion, and changes nothing under `apps/android/app/src/main`.

**The evidence.**
- CI run 37533180890 (`b747440`): green on attempt 1, the UI evidence gate included (89 screenshots valid, Marcówki /
  Rarytasy / Kosaćce slices).
- Run 37539569712 (`892853e`): green on attempt 1 as well.

**Limits (council D3, D5).**
- The fix narrows the window but does not close it: `performClick` still resolves its node through `fetchOneOrThrow`.
- Two greens are weak evidence. Before the fix the gate failed about 0.2 of attempts, so two greens in a row would occur
  0.64 of the time even with no change.
- After the council, `ProductFlowDeviceTest`'s four bare stage-sheet clicks also wait for exactly one node (`44f7128`).
  Its first-scrolling-node list helper is kept (§H).

**Deviation D2 (council D2).**
- `c244ff7` (production) was committed locally at 21:45:37, while run 183 ran.
- The gate went green at 22:15:11.
- The first production push was at 22:16:53.
- Nothing was pushed, drawn or sealed before the gate was green. The order is still not the one the brief asks for.

## B. Per-gap evidence (`gap-evidence-schema.md`, `baseline.md`)

**Gap ownership traced in the code** (brief §7, `baseline.md`):
- `readWallLine` (candidates);
- `classifyGap` (class, width rules, jambs, strokes, signature, pattern and runs-past rules);
- `withCallout`, `cornerLegs`, the garage-mouth shut;
- `solveOutline` (the pocket rule, the 48-gap budget);
- the decomposition's wide openings;
- `completeBoundary`.

**What is recorded.**
- Every gap that the classification or a later decision left WEAK, and every gap the rule upgraded.
- For each: the decomposition id and frame coordinates; the axis and the jambs it came from; width in pixels and metres;
  wall-thick ink at each jamb on its own axis; the band ink; the strokes; the signature before and after the pattern and
  runs-past rules; the width rule; the classification, the final decision, the callout and the outline fate; the rule's
  six conditions, in every run, ON or OFF; and the ordered reasons.
- A crop rectangle with at least 1.5 m of context, and the SHA-256 of its ink mask. Never pixels.
- Canonical order; at most 400 records per reading.

**Identity.**
- A bare gap id recurs across copies, scales and readings. Records are keyed `frameId / decompositionId / gapId`.
- That key is unique: 313 / 313 in the fresh runs, 60 / 60 in the manifest.

**Versions.**
- `BOUNDARY_EVIDENCE_VERSION` 1.1.0 → 1.2.0.
- `EVIDENCE_PACK_VERSION` 1.1.0 → 1.2.0: new `12b-gap-evidence.json` and a `BOUNDARY_GAPS` timeline stage, and
  `requiredFiles('1.1.0')` is unchanged.
- The digest gains `boundary.{decompositionId, mpp, drawnGapRule, gapEvidence, gapEvidenceOmitted}` and the wide-opening
  ids.
- With the rule OFF, every model hash equals the pre-005K one (§E, §G).

**Limits, stated after the council** (schema doc, "Known limits"):
- `outline` reads NOT_REACHED for weak gaps past the judging budget, which are bridged by default. That is 12 of the 60
  sealed records (A5).
- Interior STRONG gaps read BRIDGED_STRONG.
- Records lack pocket numbers, jamb geometry, per-stroke flags and the strict fate.
- The pack covers the selected storey only (C6).
- "Observational" means read-only, not decision-free (C8).
- The keys are pinned to chain order (C2).

A successor bumps to 1.3.0. Changing the schema after the sealed evaluation would itself have been a protocol change.

## C. The fresh-sheet gap set (`gap-set-protocol.md`, manifest, labels)

**Order of work.** Each step is a commit, pushed to the stage branch before the next began. Reviewer B checked the
timeline against the remote reflog.

| step | commit | UTC |
| --- | --- | --- |
| protocol, exclusions, rule (OFF), records | `d653b1b` (in the freeze) | 21:52 |
| freeze, `FREEZE_SHA` | `892853e` | pushed 22:16:49 |
| draw | ledger | 22:16:56 |
| live runs, rule OFF, external recogniser | — | 22:17–22:43 |
| **manifest seal** | `70aa0a4` | pushed 22:44:19 |
| deviation D1 (blue marks), before any reviewer saw a picture | `439531c` | pushed 22:45:07 |
| blind labelling | — | 22:46–22:54 |
| **label seal** | `6672a89` | pushed 22:54:47 |
| first ON / CONSTANT replay | — | 22:54:52 |
| evaluation | `591197d` | 23:02 |

**Exclusions.**
- 105 ARCHON and 175 DobreDomy families, swept before the draw.
- They cover every committed exclusion list, every blind draw, every sealed development package, and every project
  linked from any page in a development byte cache.

**The draw.**
- Seed `SHA256(FREEZE_SHA + "BUILDPLAN-005K-FRESH-GAP-SET")` = `76a8f6c5…d689`; 8 ARCHON and 6 DobreDomy, one per
  family, none burned.
- Reviewer B re-derived all 14 picks.
- These projects are now development material and are excluded from future whole-house blinds.

**The population.**
- On every sheet whose boundary was read: gaps classified WEAK, two WALL jambs, drawn evidence.
- That is exactly what the CONSTANT control upgrades.

**Result.**
- 60 gaps on 9 read sheets of 8 projects: ARCHON 47, DobreDomy 13 (all D00).
- Fine density (< 0.02 m/px) is D00 alone, so the density and publisher splits coincide.

**Attrition, recorded.** The project count was not tuned after the draw.
- Five DobreDomy projects stop at metric resolution: their plans print no usable dimension chain.
- A01 read and decomposed its boundary, then failed at model emission (`FILL_TOO_LARGE`). That failure record carries no
  plan digest, so its records were never emitted. The manifest's empty `sheets` for A01 means exactly that.

Below the brief's target of at least 12 sheets: 9 read, and one non-ARCHON project with gaps.

**Labels (`gap-set-labels.json`).**
- Two blind sub-agents per gap, each in its own order, and a third on the 4 disagreements. Majority of three, else
  UNRESOLVED.
- Each reviewer saw:
  - the crop as published, beside the same crop with brackets drawn outside the wall band and a 1 m bar;
  - neutral file names;
  - the label definitions, verbatim.
- They never saw the house, the publisher, the classification or any rule result.
- Result: OPENING 44, OPEN 0, NOT_A_WALL_LINE 10, UNRESOLVED 6.
  - By source: TWO_REVIEWER_AGREEMENT 56, INDEPENDENT_SOURCE_REVIEW 3, UNRESOLVED 1.
  - Cohen's κ(A, B) = 0.845.
- **Not human ground truth.** κ measures the consistency of one model with itself, not independence. On OPENING
  against not-OPENING, A and B agree 60 / 60, so a shared bias would not show (council B7).

**Deviations and honesty notes.**
- **Deviation D1:** the brackets are blue, not red, because ARCHON prints its dimension lines in red. The change was decided after
  composing the first picture and before any label, and it changes the colour only.
- **The seed commit was not named in advance** (B3). d653b1b's message names itself; the seed is 892853e, the first
  pushed commit carrying the protocol. The draw ran 7 s after the push, on a clean tree; there is no sign of grinding.
- **The rule's per-gap decision was already in the frozen records before the label seal** (B4): `check.eligible` is
  recorded OFF as well as ON. No route reached the labellers: B read all 7 labelling transcripts, and each read only its
  listed pictures and wrote one file.
- **The manifest records each project's live outcome for attrition** (`projects[].run`), against protocol §4.4's "no
  outcome" (C4). It is project-level and rule OFF, and it was never sent to a reviewer. The reviewers had read access to
  the tree and were blind by instruction, as the transcripts confirm.

## D. Three-way comparison and the adoption gate (`gap-set-results.json`, `constant-control.json`, `recommendation.md`)

**Method.** Each project was re-solved by the solver alone on its own sealed evidence: OFF, ON and CONSTANT. CONSTANT
is a replay-only copy of `boundary-evidence.ts`, swapped in through a Vite alias, as in 005J. OFF reproduces the live
outcome on every project.

| arm | upgraded | OPENING recall | false upgrades on 10 negatives | outcome-critical |
| --- | --- | --- | --- | --- |
| BASELINE | 0 | 0 / 44 [0, 0.080] | 0 / 10 [0, 0.278] | 0 |
| CONSTANT | 60 | 44 / 44 [0.920, 1] | 10 / 10 [0.723, 1] | 0 |
| DRAWN_RULE | 25 | 24 / 44 [0.401, 0.683] | 1 / 10 [0.018, 0.404] | 0 |

**Where the rule's safety and its misses come from.**
- The along-jamb test refuses 8 of the 9 negatives the rule refuses.
- The jamb-ink bar alone refuses 17 of the 20 OPENINGs it misses.
- By route:
  - BEFORE_PATTERN: 16 / 20 recall, 0 / 1 false;
  - WITHOUT_RUNS_PAST: 7 / 11, 0 / 1;
  - SIGNATURE: 1 / 13 recall, and 8 of the 10 negatives, among them the only false upgrade.
- The false upgrade, q049, is a 1.69 m wardrobe-niche mouth. It is a twin of the refused q001, and A00's outcome does
  not move.

**The adoption gate** (protocol §8, fixed before the draw):

| items | result |
| --- | --- |
| 1, 2, 3, 8, 9, 11, 12 | hold. Item 2 holds "for the source as enumerated" (§F) |
| **4** | **fails**: 10 resolved negatives < 30; 0 OPEN |
| 5, 7 | hold but are **uninformative** (council B1): CONSTANT also has 0 outcome-critical bridges, and item 7 passes any rule that refuses a single negative |
| 6 | **not tested**: no OPEN negative exists in the set |
| 10 | **not established**: zurawkach (§E) |

**Verdict: INSUFFICIENT_EVIDENCE. The rule stays OFF.**
- There is no safety evidence either way.
- "Not REJECT" rests on one 2-of-3 AI vote: q049 was voted NOT_A_WALL_LINE / OPEN / NOT_A_WALL_LINE.
- The protocol does not say which verdict wins when item 4 and a safety item both fail. That is a gap for the next
  protocol.

**Known closure path (council A1, probed outside the repository).**
- The rule can close recess, porch and loggia mouths up to 3.2 m.
- No condition reads what lies behind a gap, and an upgrade pre-empts the pocket rule.
- The drawn routes re-admit paving edges, treads and single face lines.
- The in-wall-band condition never refuses.
- The unit suite now asserts the 2.0 m paving-edge closure under ON, so a successor changes that expectation on purpose.

**The A05 change, corrected (council A3).**
- Its strict outline rises 105.51 → 122.47 m², while the exclusion outline stays at 104.99 m².
- The two-policy check then refuses, with BOUNDARY_RESOLUTION_INCONCLUSIVE in place of PLAN_RESOLUTION_INCONCLUSIVE.
- The rule also makes STRICT count its upgrades as drawn.

## E. Development matrix (`development-matrix.json`)

**The rows.**
- 26 rows: 005I's 24, plus the two round-8 houses.
- Each re-solved by the solver alone on its sealed evidence: OFF, ON and ON_DECOY (published footprint × 1.25).

**Results.**
- **OFF reproduces 26 / 26** sealed model hashes or failure codes, dabecjach and tunbergiach included.
- **ON:**
  - 63 records upgraded on 18 rows;
  - **one model changes**: dom-w-zurawkach, `31ba5eea…` → `e2167366…`, footprint 100.88 → 99.99 m² against the
    published 101.7, storeys 1 / 1, verdict unchanged (fails storeys);
  - every PASS row keeps its hash.
- **Decoy:** 595 shared records across 18 rows, 0 differing. The records do not read the published figure.

**zurawkach's change is not fully explained (council A4).**
- Seven records upgraded, four physical spans (printed windows 60/150 ×2, 180/130, and X-260).
- They close three RECESSED_ATTACHED pockets: the exclusion outline gains 1.85 m².
- Yet a 0.59 × 1.5 m corner (0.89 m²) leaves the building, and windows go 3 → 5, walls 13 → 15, rooms 5 → 6.
- An upgrade that only closes openings should not remove floor area. Gate item 10 is "not established".

**The named houses.**
- **gozdzikowcach.** The generic rule does not take `gap-Y-538-322-338` (0.41 m, LEAF_FACE). Its left "jamb" has
  wall-thick ink 0.06 on its own axis: the end of a perpendicular wall about 11 px short. 005J's unrestricted upgrade
  took it; the rule as specified does not. The storeys are not touched.
- **cyklamenach.** Unchanged. REC-17 / TOO_LARGE is not weakened.
- **jarzabem.** 0 upgrades. The rule is not used for its recessed-entrance residual.

## F. Order invariance, non-circularity, mutations

**Order invariance** (`order-invariance.json`, rule ON, 8 seeded shuffles × 24 rows, through the production
`readPlans`):

| family | what is shuffled | result |
| --- | --- | --- |
| A | coordinate frames (copies), metric evidence (callouts), dimension observations, registrations | **0 of 192** moved a record |
| B | dimension chains | the decomposition grid moved on 83 of 192, across 13 rows; a record never moved on an unchanged grid |

- Family B is `gridLines`' first-come snapping: pre-existing, upstream of the boundary, and out of scope here. Fixing it
  would move OFF hashes.
- The records are therefore deterministic for the source as enumerated, not invariant to chain order (council C2).

**Non-circularity** (`tests/architecture/gap-evidence.test.ts`, 9 tests):
- The rule and records import only `source-common` / `source-cv`.
- No forbidden vocabulary appears in their code: published, footprint, area, refusal, outcome, verdict, house, slug,
  family, publisher, holdout, blind.
- Frozen numeric literals; no gap-id or house literal.
- Apps never name the rule.
- After the council (C3), **every production mention of `drawnGapRule` in every package** must be one of a fixed set of
  forms, in a fixed set of carrier files. A resolver hypothesis or a constant indirection now fails, and both were
  probed.

**Mutations** (`mutation-results.md`, at `44f7128`, 25 tests):

| # | mutation | result |
| --- | --- | --- |
| M1 | BLANK allowed | KILLED |
| M2 | jamb ink removed | KILLED |
| M3 | outcome-circular | KILLED, by name only |
| M4 | house special case | KILLED, by spelling |
| M5 | enumeration-order tie-break | KILLED |
| M6 | along-jamb removed (added after council A6) | KILLED |

Limits (C5): the literal scanner misses leading-dot and hex literals, and the rule's inputs are not guarded. A 1.65 m
cap would remove the one false upgrade and pass every gate.

## G. Performance (`performance.json`)

**Method.** Six development rows, solver alone, median of 6. Configurations: 005K OFF, 005K ON, and the pre-005K sources
swapped in place and restored.

| measure | result |
| --- | --- |
| solver time, summed | pre-005K 19,550 ms / OFF 19,572 (+0.1 %) / ON 19,852 (+1.5 %); per-row noise up to 7.3 % |
| record builder | 20.7 ms for 105 records (about 0.2 ms each) |
| digest size | about 1.7 KB a record (181 KB on six rows) |
| Evidence Pack size | estimated, a lower bound |
| peak RSS | unchanged within noise (672–721 MB) |
| model hashes | OFF = pre-005K on every row |

No new dependency, network permission or Android permission was added.

## H. Council (`post-review/`)

Four independent read-only reviewers. Every finding and its resolution is in `post-review/resolution.md`.

| reviewer | verdict |
| --- | --- |
| A, boundary topology | CONDITIONAL PASS: 5 P1 |
| B, statistics | CONDITIONAL PASS: 2 P1 |
| C, non-circularity | CONDITIONAL PASS: 4 P1 |
| D, Android / test / release | CHANGES REQUESTED: 1 P0, 1 P1 |

**The P0, fixed.** `research-isolation.test.ts` was red from the seal commit on: the sealed `.ndjson` ledger was missing
from the extension allowlist. No CI had run past the freeze to catch it. It is fixed in `44f7128`, and the full local
suite passes: 2,197 passed, 11 skipped.

**Fixed:**
- C3: the never-ON guard;
- A6: the crossing-wall fixture and M6;
- D4: ProductFlow's bare clicks;
- D7: Android packaging guard;
- B7: the labels note in the constant control.

**Stated:**
- A1: the closure path;
- A3: A05, corrected;
- A4: zurawkach, item 10 not established;
- A5: record limits;
- B1: no safety evidence;
- B2: the frequency claim, corrected;
- C2: order;
- C4: the manifest outcome;
- D2: the deviation.

**No finding changes the verdict on the rule.**

## I. Recommendation (`recommendation.md`, `fresh-set-verdicts.json`)

**Next: FIX_STOREY_COUNT.** The first bad decision on the 14 fresh projects (as development material, by the committed
verdict predicates and each run's trace):

| first failing decision | projects |
| --- | --- |
| upper storey not stacked (`NO_MASS_REACHES_UP`) | 3: A01, A06, A07 |
| footprint and storeys co-first | 1: D00 |
| plan resolution: a first reading that covers a fraction of the building | 3: A00, A04, A05 |
| no printed dimension chain: source-limited by judgment | 5: D01–D05 |
| PASS | 2: A02, A03 |

**The decisive argument.** A06 and A07 pass every other predicate (footprint +0.18 % and −0.37 %) and fail on storeys
alone. By frequency, storeys lead plan resolution only narrowly: 3–4 against 3.

**Why not the others.**
- `TRAIN_BUILDPLAN_WALL_MODEL` is not justified: the fresh set found one false upgrade and none that matters, so there
  is no veto target.
- REC-17 and the recessed-entrance relation each hold back one development house, and no fresh one.

## J. What changed in the repository

**Production** (`packages/`), behind `drawnGapRule` (default OFF):
- `boundary-evidence.ts`: trace, `drawnGapCheck`, the rule's ON branch, reasons;
- `gap-evidence.ts` (new): records, crop, hash, decomposition id;
- `plan-decomposition.ts`: wiring and the boundary record;
- `plan-diagnostics.ts`, `failure.ts`: the digest;
- `layout.ts`, `v2/reconstruct-v2.ts`, `analysis-service/src/run.ts`: conditional pass-through;
- evidence pack `pack.ts`, `types.ts`: 12b and the BOUNDARY_GAPS stage;
- `scripts/second-house.ts`: `--drawn-gap-rule ON`, research CLI only.

**Tests:**
- `packages/reconstruction/test/gap-evidence.test.ts` (16);
- `tests/architecture/gap-evidence.test.ts` (9);
- `tests/architecture/research-isolation.test.ts` (005K block, 3);
- `packages/evidence-pack/test/versions.test.ts`.

**Android test code only:** `Evidence.kt`, `VerticalSliceDeviceTest.kt`, `ProductFlowDeviceTest.kt`.

**Research:** `research/analyzer-005k/`. **Artifacts:** `stage-reports/artifacts/analyzer-005k/`, all listed in
brief §41, plus the protocol, the draw ledger and `fresh-set-verdicts.json`.

## K. Gates and stage verdict

**Local, at the council commit `44f7128`:**
- `npm run typecheck` green;
- `npm test` 166 files, 2,197 passed, 11 skipped;
- androidTest compiles (`compileDebugAndroidTestKotlin`, offline).

**CI:**
- run 37533180890 (`b747440`): green, 39 + 2 skipped;
- run 37539569712 (`892853e`, the freeze): green, 39 + 2 skipped;
- the closing commit's run: see `PROJECT_STATUS.md` and the handoff.

**Push pattern.** The seal and label commits went to the stage branch alone, so that a push to
`claude/new-session-3kzcgh` would not cancel the freeze's run (concurrency cancel-in-progress). No CI therefore ran on
`70aa0a4`…`591197d`: council D1.

**The stage verdict is decided by the closing CI run.**
- PASS when every required job is green: the rule need not be adopted (brief §43).
- PARTIAL if a required job is red.
