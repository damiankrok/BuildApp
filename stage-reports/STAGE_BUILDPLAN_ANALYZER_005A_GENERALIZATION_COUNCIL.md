# STAGE BUILDPLAN-ANALYZER-005A — GENERALIZATION COUNCIL + MULTI-HYPOTHESIS RESOLVER + TRUE PROGRESS TELEMETRY

- **Branch.** `analyzer/generalization-council-v1`, from `integration/house-first-adaptive-analyzer-v1` @
  `7cd8e0c`. Every push also went to the session branch `claude/new-session-3kzcgh`.
- **Donor.** `damiankrok/BuildPlan-PC-Legacy`, read only and unchanged.
- **Git discipline.** No histories merged; no reset, stash or force push; the Git identity is unchanged.

In one line: the analyzer read every house through a chain of single winners closed by a terminal gate. This
stage measured that; added logical source identity, a bounded plan resolver, true progress telemetry and
severity-typed warnings; gated them; and then ran two blind ARCHON holdouts drawn after the code was frozen.

## Verdicts, recorded separately

| component | verdict | why |
| --- | --- | --- |
| ANALYZER GENERALIZATION ARCHITECTURE | **PARTIAL** | Built and gated:<br>• the Council audit;<br>• logical source identity;<br>• a bounded resolver with honest acceptance;<br>• severity-typed warnings;<br>• the derived no-development-house guard.<br>Short of generality: the resolver weighs readings of one set of metric evidence, and the scale, the text orientation and the plan extent below it are still single winners (AD 3 and AD 10). The Council named two of them before any code (root assumptions 2 and 3, section F). The stage worked around them instead of removing them, and both blind houses failed there. |
| OWNER DEVELOPMENT CASES | **PARTIAL** | Achieved:<br>• tracked Kosaćce equals clean Kosaćce, byte for byte, on the desktop;<br>• e-OZE completes;<br>• Marcówki and G2E are unchanged.<br>Still open:<br>• the phone's single-copy Kosaćce case is refused as `PLAN_RESOLUTION_INCONCLUSIVE`, and why the phone lost three copies is unexplained;<br>• e-OZE is resolved on the published figure alone, with no witness (LIMITING; `verdict.mjs` fails it). |
| TRUE PROGRESS TELEMETRY | **PASS** | Built and tested:<br>• real subphase counts, a heartbeat and last activity;<br>• slow told apart from unresponsive;<br>• a cancel that lands mid-computation.<br>The longest silence went from 144–175 s to 2.1–3.7 s, and was 2.1–2.2 s on both blind runs. Seeing it on the OWNER's phone is in the checklist. |
| BLIND ARCHON HOLDOUT 1 (`dom-w-jablonkach`) | **ALGORITHMIC_FAIL** | Section Z |
| BLIND ARCHON HOLDOUT 2 (`willa-miranda`) | **ALGORITHMIC_FAIL** | Section AA |

The terminal line is PARTIAL: a blind holdout exposed an algorithmic defect, which becomes the next stage's
input and is not fixed here.

## A. Baseline

- **Start.** HEAD at start was `7cd8e0c`, matching the brief, so there was no STOP.
- **Baseline runs.** Before any change, on the desktop (Node 22, then the session's first machine).
  `stage-reports/artifacts/analyzer-005a/before/`:

  | project | outcome | model | wall | peak RSS (process tree) |
  | --- | --- | --- | --- | --- |
  | Marcówki | completed | `6152770f43f4…` | 249 s | 1890 MB |
  | Rarytasy 5 G2E | completed | `8fa4a25bcd58…` | 338 s | 2114 MB |
  | Kosaćce 46, clean link | completed | `5b5ffcf1afcd…` | 315 s | 2159 MB |
  | Kosaćce 46, tracked link (`?_gl=…&gclid=…`) | completed (desktop) | `5b5ffcf1afcd…` | 317 s | 2120 MB |
  | Rarytasy e-OZE | `PLAN_NO_WALLED_ENVELOPE` | — | 307 s | 2034 MB |
  | Marcówki on the alternate publisher | `PLAN_LAYOUT_REJECTED` (19.56 of 131.16 m²) | — | 112 s | 1146 MB |

- **Tests.** The full vitest suite at baseline was green except `apps/analyzer-api/test/worker.test.ts`
  (ECONNRESET). That test was later found to be a real race in the test itself (fixed in `b7d7198`, section AB).

## B. OWNER phone evidence

- **Kosaćce, tracked link, on the phone:** `PLAN_LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG`, 33.15 m² against
  164.47 m².
- **Rarytasy e-OZE on the phone:** `PLAN_NO_WALLED_ENVELOPE`, grid 3×2.
- **Both phone runs had one ground-plan copy.** The diagnostics show `planFrames 1`, where the desktop acquires
  four copies of each drawing (853 px dimensioned, 853 px area table, 550 px, 400 px). The one copy was the area
  table.
  - Replaying the sealed desktop evidence with only that copy reproduces the phone's failure number for number:
    `before/kosacce-plan-copy-replays/only-area` gives 33.15 m², and
    `before/rarytasy-eoze-plan-copy-replays/only-area` gives the same envelope failure.
- **Marcówki:** "Model gotowy z ograniczeniami", with two unresolved items and four warnings (section K).
- **Progress:** "63 % · etap 3 z 9 · Czytam rysunki" frozen for minutes. The metric pass ran 164–193 s and
  emitted nothing (`council/pre/07-performance-progress-audit.md` §1).

## C. Council setup

Seven independent reviewers audited the production pipeline read-only before any code of this stage, each
writing a report in `stage-reports/artifacts/analyzer-005a/council/pre/reviewers/`:
- A: source and evidence;
- B: plan, CV and OCR;
- C: geometry and the constraint solver;
- D: the generalization red team;
- E: runtime, performance and progress;
- F: the canonical model and invariants;
- G: verification and the holdout.

From those reports come ten deliverables, `pre/01` to `pre/10`, and the binding `implementation-decision.md`.
Fourteen disagreements were settled and recorded in `pre/09-council-disagreements.md`. For example, row 11
removes attribution parameters by family only, and row 14 measures image invariance without gating it.

## D. Pipeline map

`council/pre/01-production-pipeline-map.md`. There is one pipeline, `runAnalysis`
(`packages/analysis-service/src/run.ts`), for the phone (nodejs-mobile, Node 18, no ICU), the HTTP API and the CLI:

1. acquisition (router → specialist or generic adapter → `safeFetch` per hop);
2. roles;
3. observations (per asset: decode, prepare, CV, vision off);
4. raster decode;
5. metric pass (per frame: OCR, chains, callout rings);
6. registration and plan reading (`inferStructuralLayout`, then the layout gate, then the resolver when the
   gate stops the first reading);
7. topology;
8. metrics;
9. model emission (`fitOpeningsToHosts`);
10. scene compile;
11. verification (replay, round trip, joints).

## E. Function capability inventory

`council/pre/02-function-capability-inventory.md` lists the functions by stage, each with its inputs, its
decision, what it assumes and what it tests. The functions that decide the building from ONE reading are
marked there:
- `readPlans` copy order;
- `planExtent`;
- the chain solver's pooled scale;
- `decomposePlan` largest-first merge;
- the 0.35 wall-fraction cliff;
- the footprint gate.

## F. Assumption register

`council/pre/03-assumption-register.md` holds 28 assumptions with an ID, an owner and a risk. The top five
root assumptions (implementation decision §2):
1. one plan copy per storey, first success wins;
2. the extent is the widest read chain;
3. one pooled scale, with losing readings rewritten to agree;
4. a largest-first merge with a 0.35 cliff that drops a body whole;
5. the published footprint as a terminal gate on the first reading.

## G. Hard vs soft constraints

`council/pre/04-hard-vs-soft-constraints.md`.
- **Hard, unchanged:**
  - the URL fence and per-hop SSRF checks, and decoded-size truth;
  - every canonical model validator, including `WALLS_OVERLAP` at 1e-6 m²;
  - `verifyReplay`;
  - a candidate with no frame, envelope or body, with degenerate or non-finite geometry, with anisotropy over
    1.15, or with masses overlapping at acceptance.
- **Turned into scores** for the resolver's other readings:
  - `FOOTPRINT_AREA_WRONG`;
  - the `planFailureOf` ladder;
  - the 0.35 wall-fraction cliff;
  - `STRUCTURE_SILHOUETTE_DISAGREES`.

  **The first reading keeps every gate as it was.**

## H. Single-hypothesis lock-in

`council/pre/06-generalization-risks.md` and reviewer D. Measured on the sealed baseline evidence:
- **Plan copies.** Each copy of one drawing, read alone, completes in **4 of 16** cases, and every success is
  the 853 px dimensioned copy.
- **Sheet width.** Copies of one drawing disagree about the sheet's width by 1.15–3.5× in 4 of 4 projects.
- **Scale.** Harmless image perturbations change the e-OZE scale three ways.

A house passes when every single winner happens to be right on it.

## I. Tracked Kosaćce — root cause

- **Identity drift (source).** The tracked address sealed a different package id
  (`src-mf6628752fa61f-36a0b37a56` against `…-56408a0bd9`) and a different content hash. The hash covered
  `pageHash`, and the page's bytes differ with the query. Every downstream hash moved with it, although the
  evidence is identical. `identity/kosacce-clean-vs-tracked.json`.
- **A phone that received one plan copy of four (runtime), read by a single-copy pipeline (algorithm).** On the
  desktop the tracked link gives the clean model `5b5ffcf1…`. On the phone only the area-table copy arrived.
  The pre-audit could not observe why from the phone's report, and the acquisition now records every lost
  address with the role it claimed (section M). Read alone, the area copy:
  - swallows a covered terrace into the largest-first merge;
  - drops the 149 m² body at the 0.35 wall cliff;
  - is refused by the footprint gate.
- **What the area copy alone gives now.**
  - Under resolver 1.1.0 the walled-first reading completed it: 3 bodies, 171.0 m², +4.0 %. Council C then
    measured that reading's north wing about 2.1 m longer than the accepted house.
  - Under 1.2.0 the published figure that refused the first reading may not also choose, so the case is
    `PLAN_RESOLUTION_INCONCLUSIVE`, with that reading named.
  - With the full package the tracked link gives the clean link's model.
  - Why the phone received one copy of four is still not observed. A desktop fetch with the phone's user agent
    gets the same page, byte for byte. The next phone run records every lost address and the role it claimed.

## J. Rarytasy e-OZE — root cause

- **The first link to break:** no walled envelope.
- **Why.** The chain solver pooled one scale and rewrote the losing reading of the 720 px overall dimension from
  "1601" to "1801". At the rewritten scale the wall ink does not close a box inside the chain extent.
- **Reading the scale the drawing's own first reading implies.** That is 2.2236 cm/px, the resolver's lattice
  scale, over the wall-ink extent. The reading is one body, 116.7 m², −4.4 % of the published 122.07 m². It is
  the same model with every copy and with the area copy alone.

## K. Marcówki limitations

`stage-reports/artifacts/analyzer-005a/marcowki-limitations-audit.md` covers six items. Marcówki's model and
scene are unchanged (`6152770f…` / `8c7d4395…`).

| item | what it is | classification | this stage |
| --- | --- | --- | --- |
| U1 | the roof over the garage mass is `MISSING` | LOW_CONFIDENCE_BUT_RESOLVABLE (the section shows it; the layout and v2 attached-roof readings do not talk to each other) | recorded debt |
| U2 | room 0-2 read as "9", which the area schedule contradicts | ALGORITHM_UNCERTAIN, honestly named | stays |
| W1 | "no vision provider ran" | informational | now `INFO` |
| W2 | 5 byte-identical addresses counted once | informational | now `INFO` |
| W3 | 9 guessed larger copies not available | informational | now `INFO` |
| W4 | 12 of 66 source-view checks outside tolerance | algorithmic residuals | `LIMITING` |

Marcówki's result card still says "limited", because U1 and U2 are real. It no longer says so because of
bookkeeping: 1 limiting warning of 4, verified on the after-run.

## L. Chosen resolver architecture

`packages/reconstruction/src/plan-resolution.ts` (`PLAN_RESOLVER_VERSION` 1.2.0 after the post-review), integrated in
`v2/reconstruct-v2.ts`; documented in `docs/ANALYZER_V2_ARCHITECTURE.md` §3.
- **When it runs.** The first reading runs exactly as before. Only when it stops (no world frame, no mass, or a
  layout refusal) are other readings of the same drawing weighed, so a first reading that holds is never
  second-guessed. The three accepted houses keep their model and scene hashes by construction, and measured
  (section U).
- **Bounds.** Counts, never a clock: ≤ 4 copies, ≤ 24 decompositions, and the best 4 distinct buildings composed
  in full.
- **Acceptance.**
  - AGREES; or NEAR plus one corroboration; or no published figure plus two. Never WRONG.
  - **(1.2.0)** A corroboration is a witness that is neither the published figure nor the reading's own pixels:
    - another copy measures the same building (CROSS_COPY);
    - a lattice scale holds on both axes (ISOTROPY).

    Wall coverage ranks; it does not corroborate.
  - **(1.2.0)** A figure that refused the first reading is **spent**. It may still refuse a reading (WRONG),
    but may no longer rank or accept one. Such readings score as if nothing were published.
  - A tie between different buildings is `PLAN_RESOLUTION_INCONCLUSIVE`.
  - When no other reading reaches a full composition, the first reading's own code stands, with the readings
    weighed counted.
- **Seal.** A resolved layout is PARTIAL, with a DEGRADING `PLAN_RESOLVED_BY_HYPOTHESIS`. It also carries an
  `AlternativeGroup` of the readings weighed, a `SCALE_DISAGREEMENT` conflict when the scale was re-read, and
  DERIVED provenance on every span resting on a re-read statement.
- **`SOLVER_V2_VERSION` 2.2.0.** It names the rule set in every candidate, and 2.2.0 has not been released.
  **(1.2.0)** A resolved candidate's solver version reads `2.2.0+resolver.1.2.0`, so the resolver's rules are in
  its hash. A first reading that held is unchanged byte for byte.
- **(post-review, Council A)** An unlabelled plan is the ground floor only when no plan is labelled GROUND.
  Otherwise it is skipped by name (`STOREY_UNKNOWN`), with a MISSING hole.

## M. URL / source invariance

`packages/source-package/src/logical-url.ts` (`dbfe607`).
- **Logical identity.** The page's own canonical link, when it is a safe https address on the same registrable
  domain. Otherwise the fetched address with attribution parameters removed **by family**: `utm_*`, `*clid`,
  `_gl`, `_ga`, `mc_*`, `fbclid`, `msclkid` and the rest. The remaining parameters are sorted, and the fragment
  and trailing slash are folded. Unknown keys stay: merging two houses is worse than reading one twice.
- **Content hash.** It covers evidence only (package schema 1.2.0). The request itself is never rewritten.
- **Result.** The clean and tracked Kosaćce links now seal the same id (`src-mf6628752fa61f-56408a0bd9`) and
  the same content hash (`9cb4f520…`).
- **Also in this commit.**
  - A transient fetch failure is tried once more. A 404 is evidence and is not retried.
  - A cancelled run is `ABORTED`, never a timeout, and a stalled body times out.
  - A lost address records the channel and roles it claimed.
  - The cache remembers a redirect's final address, so an offline replay names the page as the live run did.
- **Tests.** `packages/source-package/test/logical-identity.test.ts`:
  - tracking keys, order, fragment, trailing slash, host case, canonical link and redirect;
  - asset order in the page;
  - retries, aborts and stalled bodies;
  - a different project as control.

  `packages/analysis-service/test/generic-source.test.ts` runs the tracked link end to end.

## N. Candidate generation

Every reading is generated from the drawing, never from the answer. Each axis's first value is the first
reading's behaviour:

| axis | values | generated when |
| --- | --- | --- |
| copy | the lowest storey's other plan copies (≤ 4; dimensioned first, then pixels, then id) | always |
| extent | widest read chains \| largest wall-ink cluster | the cluster differs by more than a wall |
| scale | registration \| ≤ 2 lattice scales implied by the reader's own unedited readings of long spans | those readings support the lattice more than the registration |
| merge | largest-first \| walled-first (every outside side must carry wall; a side facing built cells may be open) | always |
| faces | band-only sides on the band axis \| on their outer faces | always |
| mouths | an undrawn wide gap as a pocket's mouth \| as an opening in the wall | a reading left such a mouth open (resolver 1.1.0, brief §13) |

## O. Candidate scoring

Scoring is lexicographic on the gate's existing buckets. It is never a weighted sum, so there are no new weights
to tune. The order:
1. hard violations;
2. gate refusals after the full composition;
3. footprint bucket (AGREES ≤ 6 % < UNKNOWN < NEAR ≤ 20 % < WRONG);
4. refuted chain-length share, in buckets of 0.05;
5. wall coverage, in buckets of 0.05;
6. corroborations (1.2.0):
   - CROSS_COPY: another copy agrees on width and depth within 5 %;
   - ISOTROPY: a lattice scale holds on both axes.

   Until 1.1.0, WALL_COVERAGE (≥ 0.8 of the long walls explained) also counted, as did ISOTROPY on a registered
   scale. The post-review showed both were present on wrong readings (section W).
7. departures from the first reading;
8. id.

Every resolution is recorded in the plan diagnostics and the trace: outcome, counts, the chosen reading and the
first four considered, each with its score breakdown. `stage-reports/artifacts/analyzer-005a/resolver/` holds
the traces.

## P. Decomposition families

These are the brief's §12 families.
- **A. Grid and cell.** This is the first reading, unchanged.
- **B. Wall network.** The walled-first tiling, which demands wall on every outside side. The wall-ink cluster
  gives the extent from the walls rather than from the chains.
- **C. Exterior contour and wall envelope.** Outer faces for band-only sides.

§13 (wide openings) is handled by the `mouths` axis. The decomposer's option `shutPocketMouths` reads each
undrawn mouth a reading left open as an opening in the wall, for both collinear gaps and bay mouths both side walls
reach. The first reading never asks for it. Test: a room behind a 4 m undrawn mouth
(`plan-resolution.test.ts`).
- Alone, the pocket is taken (108 m²).
- Against a footprint that counts the room, the shut reading is generated and composed (144 m², two bodies).
  **(1.2.0)** It is named, not built: the figure that refused the pocket cannot also choose.
- Against a house-only footprint, nothing is weighed.

The 36-run plan-copy matrix is identical with and without the axis, model hashes included.

## Q. Canonical invariants

- **No validator was weakened.** `git diff 7cd8e0c..HEAD -- packages/model packages/commands packages/geometry`
  is empty.
- **The emission asymmetry (Council F #1) is fixed** (`4c07986`). Previously, two overlapping openings inside a
  wall, or an opening whose host wall was absent, failed the whole run as `MODEL_EMISSION_FAILED`, while the same
  overlap near a corner was fitted and then dropped. Now such an opening is not built: the model still refuses
  the command, and the result names the refusal. A refusal that is not about an opening (`WALLS_OVERLAP` and the
  rest) still fails the run.
- **A resolved layout is never presented as a clean read.** It is sealed PARTIAL with a DEGRADING reason and
  carries its alternatives.
- **(post-review)** That reason now reaches the result, as a LIMITING warning `LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`.
  Every degrading gate reason is passed on the same way, never picked by code, and so is an opening that was not
  built (`OPENINGS_NOT_BUILT`).

## R. True progress architecture

- **Checkpoint** (`packages/source-common/src/progress.ts`). A write-only `Checkpoint`: `phase(id)` and
  `tick({done, total, counters, subphase})`. It ticks at every long loop's boundary:
  - acquisition, per address;
  - raster preparation, per step;
  - observation, per asset;
  - the metric pass, per frame, token group, callout ring and rendered candidate;
  - plan reading, per copy;
  - the resolver, per reading;
  - the solver, per camera.
- **Run checkpoint** (`packages/analysis-service/src/checkpoint.ts`).
  - `ANALYSIS_PHASES` is a closed registry of 13 phases.
  - Heartbeats go out at most once a second, and cancellation is polled at most every 200 ms.
  - An IO_WAIT timer covers awaits.
  - Per-phase stats (ticks, longest silence, peak RSS) feed the performance record, which never enters a hash.
- **The phone's program: protocol 3** (`apps/local-analyzer`).
  - `telemetry` events, written best-effort, so a full pipe drops telemetry and never a terminal event.
  - The control pipe is read with `readSync` at loop boundaries, so a cancel lands while the thread computes.
  - `hello.capabilities` and `diagnostics/performance.json`.
- **The API** (`apps/analyzer-api`): a job's `activity`, with a server-computed `heartbeatAgeMs`.
- **Overall percent.** Monotone and secondary; a running report never exceeds 99 %, and only the terminal record
  reads 100 %.
- **Proven by tests** (`telemetry.test.ts`, `program.test.ts`, `plan-resolution.test.ts`):
  - telemetry is write-only: the same bytes with and without it;
  - the events are well formed;
  - a cancel lands inside the metric pass and inside registration;
  - the phone's program cancels mid-computation, in the stage the cancel was sent from, and a mutation check
    shows it would not without the poll.
- **(post-review, Council E)**
  - A cancel from inside the resolver, at stage 1 and at stage 2, on a sheet that reaches it.
  - A listener that fails does not fail the run. A throwing sink or memory probe is caught and never asked
    again, the phase record counts it, and the bytes are the same. Before, an EPIPE inside a preparation tick
    could drop an asset as undecodable.
  - Ticks inside the callout preamble (each mask, each component) and between the chain steps.

## S. Android progress UX

`LivenessTracker.kt` and `AnalyzerScreen.kt` (`AnalyzerActivity`). All wording is in Polish, in `strings.xml`.
- **What the card shows:**
  - the phase from the closed id list ("Odczytuję wymiary i opisy otworów");
  - the real count ("arkusz 3 z 10");
  - the step inside it ("opisy otworów: 37 z 150");
  - "Ten krok trwa 1 min 42 s";
  - "Ostatnia aktywność 3 s temu".
- **Liveness.** Judged on the phone's own monotonic clock:
  - counts frozen for 30 s while heartbeats arrive: "Nadal analizuję — ten krok jest obliczeniowo ciężki.";
  - no heartbeat for 45 s: "Brak odpowiedzi analizatora od N s", with the choice left to the person;
  - network waits are named after 15 s;
  - an analyzer that sends no activity gets no verdict.
- **Severities.** The result card and the stored entry count LIMITING warnings only; an older analyzer's
  warnings all count.
- **Tests:** `LivenessTrackerTest` (10), `AnalyzerContractTest`, and `RealServerContractTest` on the server's
  own bytes.

## T. Performance and heartbeat

`stage-reports/artifacts/analyzer-005a/performance/` holds the README, the table and every phase.

**How it was measured.** Each project ran twice **at the same time**, once on the baseline code (`7cd8e0c`,
in a worktree) and once on the final code, on one 4-core container. The container's speed drifted by 1.4–1.7×
over the session, so running each pair together makes the drift hit both sides equally.
- The final code, measured an hour apart, differed that much even in untouched phases such as raster
  decoding.
- The run is offline, from one set of acquisition caches.
- Wall time and peak RSS are for the whole process tree, sampled every second.

| project | wall s | peak MB | observation s | metric pass s | longest silence | resolver readings |
| --- | --- | --- | --- | --- | --- | --- |
| Kosaćce, tracked link | 265 → 248 | 2100 → 912 | 98 → 47 | 144 → 177 | 144 s → 2.3 s | 0 |
| Kosaćce, clean link | 269 → 251 | 2152 → 871 | 101 → 48 | 144 → 179 | 144 s → 2.3 s | 0 |
| Rarytasy e-OZE | 284 (failed) → 258 (completed) | 2063 → 917 | — → 52 | — → 176 | — → 3.7 s | 55 |
| Rarytasy G2E | 287 → 251 | 2136 → 911 | 115 → 54 | 147 → 171 | 147 s → 2.1 s | 0 |
| Marcówki | 225 → 264 | 1840 → 846 | 31 → 19 | 175 → 227 | 175 s → 3.2 s | 0 |
| Marcówki, alternate page (refused) | 90 → 94 | 1170 → 748 | — | — | — → 2.4 s | 39 |

- **Memory.** Peak memory is **halved on every project**, which matters most on a phone.
- **Silence.** The longest silence went **from two or three minutes to 2–4 s**.
- **Observation.** About halved: the lazy thin strokes, and the second Hough pass run only for the stair reader.
- **The one regression, explained.** The metric pass is **17–29 % slower**, and Marcówki's total is slower,
  225 → 264 s.
  - **The cause.** The stage bounds the callout render cache at 192 MiB; the baseline's cache was an unbounded
    `Map` per frame.
  - **The A/B.** On Marcówki, the same final code with the cache bounded and unbounded, side by side:

    | cache | metric pass | peak memory |
    | --- | --- | --- |
    | bounded | 210 s | 889 MB |
    | unbounded | 156 s | 1754 MB |

    The model is the same in both.
  - **The trade:** a quarter of the metric pass for half the memory, kept for the phone.
  - **Not tuned:** choosing another budget needs phone memory figures, and Council E's hit, miss and eviction
    counters, first.
- **The e-OZE resolver.** 55 readings in about 4.5 s, with a longest gap of 0.7 s.

## U. Known development results

Production `runAnalysis` on the final code, offline from the same acquisition caches as the baseline
(`stage-reports/artifacts/analyzer-005a/performance/`).

| project | baseline (`7cd8e0c`) | final | model | scene | limiting / all warnings | unresolved |
| --- | --- | --- | --- | --- | --- | --- |
| Marcówki | completed | completed | `6152770f…` (same) | `8c7d4395…` (same) | 1 / 4 (the source-view residuals) | 2 |
| Rarytasy 5 G2E | completed | completed | `8fa4a25b…` (same) | same | see the record | 11 |
| Kosaćce 46, clean link | completed | completed | `5b5ffcf1…` (same) | `50217b85…` (same) | 2 / 5 (residuals, exterior joints) | 13 |
| Kosaćce 46, tracked link | completed (desktop) | completed, **the same package id, content hash, candidate, model and scene as the clean link** | `5b5ffcf1…` | `50217b85…` | 2 / 5 | 13 |
| Rarytasy e-OZE | `PLAN_NO_WALLED_ENVELOPE` | **completed**, resolved: wall-ink extent, lattice scale 2.2236 cm/px, 1 body, 116.7 m² (−4.4 % of 122.07) | `b50b6e59…` | `ffdf5800…` | 3 / 6 (`LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`, `LAYOUT_SCALE_DISAGREEMENT`, residuals) | 9 |
| Marcówki on the alternate publisher | `PLAN_LAYOUT_REJECTED` (19.56 of 131.16 m²) | the same, named | — | — | — | — |

- **What moved.** Between the pre-Council after-run and the final code the only hash that moved is e-OZE's
  candidate: its solver version now names the resolver, `2.2.0+resolver.1.2.0`. Its model and scene are the same.
- **The single-copy phone cases, replayed** (`resolver/plan-copy-matrix.md`):
  - e-OZE with the area copy alone resolves to the same `b50b6e59`.
  - Kosaćce with the area copy alone is `PLAN_RESOLUTION_INCONCLUSIVE`, naming the walled-first reading
    (3 bodies, 171.0 m²): the published figure refused the first reading and may not also choose.
- **The copy matrix:** 16/36 completed at the baseline, 28/36 under resolver 1.1.0, **24/36** under 1.2.0 (section W).
- **Marcówki's limitations** (section K) are unchanged in substance. It no longer reads as limited because of
  bookkeeping: 1 limiting warning of 4.

## V. Metamorphic tests

| family | where | result |
| --- | --- | --- |
| Source-URL invariance: tracking keys, order, fragment, trailing slash, host case, canonical link, redirect | `logical-identity.test.ts`, the CI generalization job | one id and one content hash per project; a different project stays different |
| Asset order in the page | `logical-identity.test.ts`, `extract.test.ts` | the same hashes |
| Telemetry on and off, and a listener that throws | `telemetry.test.ts` | the same bytes |
| Plan-copy subsets, 36 rows (the drawings a phone might not receive) | `resolver/plan-copy-matrix.md` | 24/36 complete; every first-reading completion keeps its model hash; the rest are refused by name |
| **The published footprint** (post-Council): withheld, and ×0.8 to ×1.25, on those 36 rows | `council/post/decoy-footprint/` | 1.1.0 built another building in 27 of 216 decoy cells, 1.2.0 in 8 |
| **An unlabelled storey** (post-Council A): Marcówki with its attic plans unlabelled | `council/post/README.md`, `plan-resolution.test.ts` | before: a silent 1-body house; after: 2 bodies and a named hole |
| Image transforms, 60 cells (measured, not gated) | `image-transforms/` | 46 equivalent, 7 silently different, 7 refused; identical after the post-Council fixes |
| Shape families, 22 rows | `shape-families/`, `shape-families.test.ts` | 7 families correct with and without a figure; 3 named refusals; 1 listed silent row; 1 listed emission defect |

## W. Council post-review

The seven roles of the pre-audit reviewed `git diff 7cd8e0c..f1901e9` once the known set was green (brief §37).
Each read on their own and changed nothing. Each answered the four questions, and none answered "the tests pass".
- **Where it is.** `stage-reports/artifacts/analyzer-005a/council/post/`. The reviews are in `reviewers/`; the
  table of answers, what was acted on, measured, or left as debt is in `README.md`.
- **The finding four reviewers made independently (B, C, D, G).** The published footprint was choosing the building.
  - The corroborations were not witnesses. WALL_COVERAGE was present on every WRONG reading, and ISOTROPY was
    circular for a registered scale.
  - A figure that had refused the first reading then chose its replacement.
- **The control they asked for** (`council/post/decoy-footprint/`): the 36-row copy matrix × 8 footprint
  conditions (as published, withheld, ×0.8 to ×1.25), 288 runs per rule set.
  - Under resolver 1.1.0, **27 of 216** decoy cells completed as another building. For example, Kosaćce was
    built at 198.4 m² against a true 164.47 m² at ×1.25, and G2E at 153.7 m² against 189.77 m² at ×0.8.
  - Under 1.2.0, **8** did.
- **Resolver 1.2.0.**
  - A corroboration is a witness that is neither the figure nor the reading's own pixels: CROSS_COPY, or
    ISOTROPY for a lattice scale only.
  - A figure that refused the first reading is **spent**: it may veto, not choose.
  - The cost, measured: 28 → 24 on the true figure. Three of the four rows lost were wrong buildings (G2E
    3-body ×2; Kosaćce's area copy alone, whose wing C measured 2.1 m long). One was right (e-OZE `without-853D`).
  - A figure 10–12 % low now gives a named refusal on e-OZE, not the right house.
- **Also acted on before the freeze.**
  - Rule-based known-set CI, no hash pins; pipefail; a fetch failure fails the job; the three jobs gate the
    release.
  - Fresh lattice fixtures, since the old one was e-OZE digit for digit.
  - A resolver cancel test that reaches the resolver.
  - A telemetry sink that throws never changes the bytes.
  - Ticks in the callout preamble and the chain steps.
  - A guess is INFO only on a definite absence (404, 410, offline).
  - Every degrading gate reason, and every unbuilt opening, is a LIMITING warning.
  - An unlabelled plan beside a labelled ground plan is no longer the ground floor. Marcówki with its attic
    unlabelled went from a silent 1 body to 2 bodies plus a named hole.
  - The resolver version is in a resolved candidate.
  - Numeric resolution records.
  - Lazy thin strokes keep their identity.
  - Holdout amendments:
    - the SHA goes in the ledger;
    - the second pick is uniform;
    - no check-skip flag;
    - linked families are excluded;
    - the predicates are pinned before the draw.
- **Where they disagreed.** B, C and D would take the figure out of acceptance entirely; G would change the
  holdout predicate.
  - **Taken:** both narrower halves.
  - **Not taken:** removing AGREES-alone acceptance. It would make e-OZE, the OWNER's own case, a named refusal
    again.
  - **Named consequence:** after a structural stop, the figure still selects. That is the 8 remaining decoy
    cells.

## X. PRE_HOLDOUT_SHA

`PRE_HOLDOUT_SHA = 56ca1e3a5bd68c72f3dc1fab6ebade426bcc8ac8`
("docs(analyzer): the 005A performance record, measured in pairs").

- **Pushed before the draw.** Both remote branches pointed at it, and the tree was clean.
- **Gates on it.** Locally, the full suite passed and the typecheck was clean. CI run 96 on it was green on every
  job.
- **Nothing between the freeze and the draw.** The draw wrote the SHA into the ledger itself. The ledger line was
  committed with the run evidence afterwards, in `70636bc`, as the protocol says.
- **No code after the freeze.** `git diff 56ca1e3..HEAD -- packages apps .github` is empty. Every later commit is
  evidence or documentation.

## Y. Blind selection method

This is Council G's protocol, amended by the post-review before any draw (`holdout/README.md`).
- **Pool (T0).** Enumerated from the publisher's own `sitemap.xml` before the freeze: 3085 house addresses in
  773 families. `POOL_SHA256 = 800c2a1e…ed41`.
  - The three development families were dropped.
  - The 25 families the development pages link to were excluded: 320 addresses,
    `EXCLUDED_FAMILIES_SHA256 = c186e89f…c8b4`.
  - That leaves 2765 drawable addresses.
- **Freeze (T1).** Every change committed, the local gates green, HEAD pushed. `PRE_HOLDOUT_SHA` is that HEAD.
  The draw records it in the ledger itself, so nothing was committed between the freeze and the draw.
- **Draw (T2).**
  - `seed = SHA256(PRE_HOLDOUT_SHA + "BUILDPLAN-005A-BLIND-HOLDOUT")`.
  - `i1 = seed mod n`.
  - `i2 = SHA256(seed + ":second") mod m`, over the addresses of every other family.
  - `holdout/select.mjs` refuses unless HEAD is the declared SHA, the tree is clean, and the tracked pool's hash
    matches both the declaration and `pool.meta.json`.
- **Run once (T3)** with production `runAnalysis` on the frozen code. Only text facts are sealed; no drawing is
  committed.
- **Verdict (T4)** by the pre-registered predicates, per project and never averaged.
- **Disclosure.** While testing the selector, one draw was computed for the dummy SHA `0^40`, which no commit can
  have. It named `dom-w-nawlociach` and `dom-w-renetach`. The real draw landed on neither.
- **The draw itself** (`holdout/LEDGER.ndjson`, 2026-09-30T03:30:03Z):
  - seed `5850abd93cdd8ce20286c3f481378cef94e09785030a772728d3361c50ffaac2`;
  - `n = 2765`, with 320 addresses excluded;
  - `i1 = 960`, `dom-w-jablonkach`;
  - `i2 = 2727`, `willa-miranda`.

## Z. Blind holdout #1

`https://www.archon.pl/projekty-domow/projekt-dom-w-jablonkach-22-mb0e2566e7cb18` ("Dom w jabłonkach 22"),
drawn at `i1 = 960`. Evidence: `stage-reports/artifacts/analyzer-005a/holdout/h1-dom-w-jablonkach/`.

**Verdict: ALGORITHMIC_FAIL.**

| §38.4 item | result |
| --- | --- |
| acquisition | 40 variant addresses gave 34 assets. There are 8 floor-plan copies (GROUND ×4, ATTIC ×4, each storey 3 dimensioned and 1 area table), 4 elevations, 1 section, 1 site plan and 18 renders. The 14 failures are expected: 5 byte-identical duplicates and 9 guessed variants that answered 404. No plan address was lost. |
| observations | 32 frames, 1438 observations, 256 dimension chains, 211 metric evidence items, 6 registrations, 5 scales refused |
| resolver | `INCONCLUSIVE`, with the figure `SPENT` (the first reading was refused by it). 71 readings over 4 copies, 18 decompositions and 23 distinct outlines; 0 compositions |
| canonical model | none: a typed stop, `PLAN_LAYOUT_REJECTED` at `STRUCTURAL_LAYOUT`. The lowest storey covers 46.49 m², against the published **99.4 m²** |
| scene | none |
| Android render | not applicable, since there is no model; this environment has no device either |
| time and memory | 206.7 s wall, 908 MB peak (process tree). Longest telemetry gap 2.1 s; longest tick gap 3.8 s, in asset acquisition |
| unresolved | the stop itself, `RECONSTRUCTION_FAILED` with its message |
| score breakdown | the best four of 71 readings, every one `WRONG`: 1 body at 17.2 m² (−82.6 %); 1 body at 17.6 m²; 3 bodies at 48.1 m² (−51.6 %); 3 bodies at 48.6 m² (−51.1 %) |

- **Why not source-limited.** Every checklist item was measured, and none holds.
  - Plans exist and are labelled (GROUND, ATTIC).
  - The ground copy's walls are 20 px on 853 px.
  - OCR tokens on the ground copies are up to 59 px tall.
  - No plan asset is lost.

  This is an adequate drawing, misread.
- **Diagnosis**, after the verdict, with nothing patched. **The first bad decision is the scale.**
  1. The overall dimensions printed outside the outline agree with one another at **2.11 cm/px**: 1100 over
     519 px, 900 over 426 px and 380 over 180.5 px. Their product, 11.0 × 9.0 m, agrees with the published
     99.4 m².
  2. The registration settled at **1.88 cm/px**, from 6 anchors:
     - Five are short interior spans (0.83–3.13 m).
     - The sixth is the 426 px overall span, entered as **8.06 m**.
  3. That 8.06 m came from the rotated label "900", which the OCR read upside down as **"006"**. The chain solver
     rewrote "006" as "806", with the note "the chain's scale endorses 806" (`CHAIN_CORRECTED`, confidence 0.14).
     The rewrite fitted the interior spans' scale, and the rewritten label then anchored that same scale: a
     circular witness.
  4. Separately, the walled envelope stops at an inner wall. The attached wing's walls are drawn at the house's
     own thickness, 21 px, and lie outside the extent, while the extent's other side runs out onto the terrace.

## AA. Blind holdout #2

`https://www.archon.pl/projekty-domow/projekt-willa-miranda-11-g2-m49324d69ef143` ("Willa Miranda 11 (G2)"),
drawn at `i2 = 2727`. Evidence: `stage-reports/artifacts/analyzer-005a/holdout/h2-willa-miranda/`.

**Verdict: ALGORITHMIC_FAIL.**

| §38.4 item | result |
| --- | --- |
| acquisition | 34 assets. There are 8 floor-plan copies (GROUND ×4, UPPER ×4), 4 elevations, 1 section, 1 site plan and 18 renders. The same 14 expected failures; no plan address was lost. |
| observations | 32 frames, 1456 observations, 258 chains, 158 metric evidence items, 7 registrations, 3 scales refused |
| resolver | `INCONCLUSIVE`, with the figure `SPENT`. 11 readings over 4 copies, 3 decompositions and 7 distinct outlines; 0 compositions |
| canonical model | none: `PLAN_LAYOUT_REJECTED` at `STRUCTURAL_LAYOUT`. The first reading covers 0.55 m², against the published **169.9 m²** |
| scene | none |
| Android render | not applicable, since there is no model |
| time and memory | 191.4 s wall, 873 MB peak. Longest telemetry gap 2.2 s; longest tick gap 3.1 s, in asset acquisition |
| unresolved | the stop itself |
| score breakdown | the best four of 11 readings, every one `WRONG`. On the area-table copy with the chain extent: 2 bodies at 101.3, 102.7 and 103.8 m² (−40.4 % to −38.9 %). On the dimensioned copy with the wall-ink extent: 4 bodies at 71.3 m² (−58.1 %), also `DEGENERATE_GEOMETRY` |

- **Why not source-limited.** Every checklist item was measured, and none holds.
  - Plans exist and are labelled (GROUND, UPPER).
  - The ground copy's walls are 12 px on 853 px.
  - OCR tokens are up to 48 px tall.
  - No plan asset is lost.
- **Diagnosis**, after the verdict, with nothing patched.
  1. **The scale is right.** It is 2.681 cm/px, from 6 anchors, including the overall 15.00 m over 559.5 px, the
     8.00 m and the 7.00 m.
  2. **The first bad decision is the plan's depth.**
     - The overall vertical chain in the left margin prints 245 / 920 / 245 = 1410, and it was never read.
     - Its rotated labels came back as "0111", "036", "502" and "535": the upside-down readings of 1410, 920
       and 245.
     - With no overall chain on that axis, the Y extent was taken from a short interior chain about 2.5 m long,
       and it was marked not weak.
     - The grid then has 5 lines inside that strip, and 2 of its 52 cells enclose.
  3. **The resolver could not recover it.** Its extent axis offers the wall-ink extent and the chain extent, and
     both were built on that one misread depth.

**The common defect across both holdouts.** The overall vertical dimensions carry the building's depth, and
their rotated labels were read upside down.
- **The strings.** They are exactly what the digit templates give for the ink turned 180°:
  - `900 → 006`;
  - `1410 → 0111`;
  - `920 → 036`.
- **The likely place.** The page-wide orientation vote in `source-metrics/src/ocr.ts` (`dedupeOrientations`).
  The sealed tokens do not record their orientation, so this is consistent with every string but **not
  measured**.
- **How it became a wrong house.** Two downstream decisions did that:
  - the chain solver's digit correction, which fits a misreading to a scale the misreading then anchors;
  - an interior chain accepted as the plan's extent without being marked weak.
- **The Council named both before any code** (section F):
  - **Root assumption 3**, "one pooled scale, with losing readings rewritten to agree". It rewrote e-OZE's
    `1601` as `1801` (section J) and holdout 1's `006` as `806`.
  - **Root assumption 2**, "the extent is the widest read chain". When the overall chain is unread, the widest
    read chain is an interior one: holdout 2.
- **What the resolver did.** It ran on both houses (71 and 11 readings) and refused to choose, correctly: every
  reading it had was built on the misread metric evidence.
  - Its lattice scale comes only from the reader's own **unedited** readings of long spans. On holdout 1 that
    long span's unedited reading was `006`, and all four best readings used the registered scale.
  - This stage worked around assumptions 2 and 3 in the resolver, for the readings they spoil. It did not
    remove them.
- **What this changes.** The development-set work did not generalize to these two houses, and the stage is
  PARTIAL.
- **What happens to the families.** Per T5, both now join the development set: sealing their packages extends
  the derived no-development-house guard to both, and production passes it. Nothing is patched in this stage.

## AB. Final CI

| commit | run | event | result |
| --- | --- | --- | --- |
| `56ca1e3` = `PRE_HOLDOUT_SHA` | 96 | push | **green**, every job |
| `226f9ce`, the report | 98 | `workflow_dispatch`, `owner_apk=true` | **green**, every job, including the OWNER release |
| `226f9ce`, the report | 97 | push | **green**, every job |

- **The jobs.** The runs cover:
  - core tests and typecheck;
  - the three 005A jobs: `analyzer-generalization` (the known set judged by rule), `plan-resolver` and
    `analyzer-progress`;
  - the second and third houses;
  - Node 18 parity, with no ICU as on Android;
  - the local analyzer on the emulator;
  - the Android APK, the 3D entry gate and the UI evidence gate on the emulator;
  - Playwright;
  - the API container;
  - the assemblies.

  The `preview-latest` publisher is skipped on a dispatch by design. The deploy job has no deployment
  configured.
- **The code tested is the frozen code.** `git diff 56ca1e3..226f9ce -- packages apps .github` is empty. What the
  runs on `226f9ce` add over run 96 is the derived guard with both blind houses sealed, and it passes.
- **After it.** The commit that records this section changes only this report and `PROJECT_STATUS.md`.

## AC. OWNER APK

`https://github.com/damiankrok/BuildApp/releases/download/owner-preview-latest/BuildPlan-owner-preview.apk`,
from `workflow_dispatch` run 98.

Verified from the downloaded file, not from the notes:

| check | result |
| --- | --- |
| direct link | serves the APK itself: 30 669 923 bytes, `application/vnd.android.package-archive`; the release is a prerelease |
| SHA-256 | `f27833554c41b5e75a1ff43a8a001b259f5779f9559e46d172057d7c9c86f9af`, equal to the release notes and to GitHub's asset digest |
| ABI | `aapt dump badging`: `native-code: 'arm64-v8a'`. There are 5 libraries under `lib/arm64-v8a/` (`libnode`, the node bridge, Filament, `libc++_shared`, the graphics path) and no other ABI |
| version | `com.buildplan.preview`, **versionCode 1098**, versionName `0.98.0-preview`, minSdk 26, targetSdk 35 |
| commit | the notes and `VERSION.txt` say `226f9ce070188a2f9ea777fc98b7a4e2e0505b46`. Its analyzer code is the frozen code, and the embedded analyzer bundle declares `PLAN_RESOLVER_VERSION = "1.2.0"` |
| signer | `apksigner verify --print-certs`: "BuildPlan Model Preview, Preview builds (not a production key)", certificate SHA-256 `6e48fac4…a0da`, equal to the notes. It installs over any preview build with a lower run number |
| release notes | name the run, the branch, the commit, the SHA-256 and the version block |

### OWNER phone checklist

Install `BuildPlan-owner-preview.apk` over the previous build, then check each item.

1. **Progress never looks frozen.**
   - Analyse any link and watch the card during "Odczytuję wymiary i opisy otworów".
   - Expected: the count ("arkusz N z M"), the step ("odczyt liczb: grupa …", "opisy otworów: …"),
     "Ten krok trwa …" and "Ostatnia aktywność N s temu" all keep moving.
   - The percent never reads 100 % before the end.
2. **Cancel.** Press "Przerwij" in the middle of that step. Expected: "Przerywam…", then "Analizę przerwano."
   within seconds, not at the end of the step.
3. **Kosaćce, the tracked link** (the one with `?_gl=…&gclid=…`).
   - Expected: the same house as the clean link.
   - If the phone again receives one plan copy of four, expect a named refusal ("Sprawdzam inne odczyty rzutu",
     then a typed stop) instead of a 33 m² house.
   - Either way, send the code and "Szczegóły analizy": they now list every lost address and the drawing it
     claimed.
4. **Rarytasy e-OZE.**
   - Expected: it completes as "Model gotowy z ograniczeniami", and the warnings say the plan was resolved by
     hypothesis.
   - Question for the OWNER: does the house look like the page?
5. **Marcówki.** Expected: the same house as before, still "z ograniczeniami", now counting only the one limiting
   warning.
6. **Optional: a blind house.** Open one of the two holdout links.
   - Expected: a typed stop explaining that the plan reading contradicts the project's data, and no wrong house.
   - This is the defect the next stage is for.

## AD. Residual genericity debt

Each item is named and measured where it could be measured. None is claimed fixed.

1. **After a structural stop, the published figure still chooses among the readings the drawing supports.**
   - Measured: 8 of 216 decoy cells complete as another building. These are e-OZE at ×1.25 and Marcówki
     `without-853D` at ×1.10 and ×1.12.
   - Such a result is LIMITING (`LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`), and the holdout cannot count its
     footprint agreement.
   - The fix needs a witness the drawing gives and the figure does not. B's page-turn and per-token scale vote,
     and C's CROSS_COPY against the siblings' own lattice readings, are the candidates.
2. **A first reading that completes is never questioned.**
   - The wide-door family completes 27.7 % small without a figure.
   - 7 of 60 image-transform cells complete silently as another building.
   - Holloway loses its garage wing at every downscale.
3. **One scale per sheet, decided by one vote over OCR text** (B).
   - A copy with no registration gets no readings.
   - The wide-glazing family is refused as `PLAN_NO_DIMENSION_FRAME`, and the message does not say which of
     three causes fired.
4. **Emission is terminal** (F). When the model refuses the chosen reading there is no fallback to the next
   acceptable one. The acceptance check for overlapping bodies is the gate's 0.5 m² box, not the model's check.
   - The small-copy family (20 px/m) dies on `WALLS_OVERLAP`, and is listed as a known defect.
5. **The source hash still holds addresses** (A).
   - Variant URLs and failure targets are hashed, so a signed CDN would bring a nonce back.
   - A template canonical could merge two houses without a publisher id.
   - The `basis` behind a logical name is not persisted.
6. **Liveness margins come from 400–853 px sheets** (E).
   - The tick gap against raster size is not measured beyond them.
   - An IO_WAIT heartbeat can hide a hung DNS await.
   - The render cache has no hit or miss counters.
7. **The OWNER phone's copy loss is still unexplained.**
   - Three of the four ground-plan copies did not arrive on the phone. A desktop fetch with the phone's user
     agent receives the same page, byte for byte.
   - The acquisition now names every lost address and the role it claimed, so the next phone run will say why.
8. **Constants the reviewers listed:**
   - the 5 % refuted-share bucket, which rewards silence;
   - the walled-first "some wall" exemption;
   - the 24-decomposition budget, beyond which the `mouths` axis is off;
   - outlines deduplicated by exact key.
9. **Evidence status.** A resolved model's rings still say `SOURCE_EXACT` (`v2/emit.ts:177`). Correcting it needs
   a solver version bump.
10. **What the blind holdouts exposed (sections Z and AA).**
    - **Rotated overall labels read upside down**: `900 → 006`, `1410 → 0111`, `920 → 036`. The likely place is
      the page-wide orientation vote in `ocr.ts`; that is not measured.
    - **A chain correction that witnesses itself.** The chain solver rewrote `006` as `806` to fit a scale, and
      the rewrite then anchored that scale, at confidence 0.14.
    - **An interior chain accepted as the plan's extent** without being marked weak.
    - **The resolver's reach.** Its axes vary the copy, the extent source, the scale source and the tiling. None
      of them varies the metric evidence those are built on.

## AE. Exactly one next step

**Return to the coordinator.**

The input for the next stage is the defect both blind holdouts exposed, stated above (sections Z and AA):
- rotated overall-dimension labels read upside down;
- the two decisions that turn that misreading into a wrong building:
  - the chain solver's digit correction that anchors its own scale;
  - an interior chain accepted as the plan extent without being weak.

Any fix is held to the six known runs and to both drawn houses, which are now development cases. A further
claim of generality needs a new blind draw, on a new frozen SHA.
