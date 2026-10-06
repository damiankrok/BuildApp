# Reviewer E — BuildPlan architecture and integration (BUILDPLAN-ANALYZER-005J post-review)

**Verdict: CHANGES REQUESTED** on the 005K specification (`recommendation.md` §005K, report §B / §I / §L).
The production freeze **PASSES**, and I do not oppose the primary direction, TRAIN_BUILDPLAN_WALL_MODEL. 0 P0, 8 P1,
5 P2.

Scope of this review:
- the production freeze;
- non-circularity and the evidence architecture of the proposed `GapWitness`;
- the injection points and the Evidence Pack;
- the realism of the 005K scope against what 005H needed;
- the treatment of 005I's standing route.

Nothing in the repository was edited except this file. The VLM numbers and ⟪…⟫ placeholders were not reviewed.

How the numbers were obtained:
- I recomputed every tree hash.
- I read the cited production lines at `64b78b4`.
- I re-read the sealed 005I Evidence Packs (`/home/user/work005i-a/{m-on,blind8}/*/evidence-pack/1{1,2,3}-*.json`) for
  the gap counts and the round-8 completions.

---

## Findings

### E1 — P2 — Production freeze: verified, with two notes on how the proof is stated

**Freeze evidence.**
- **Tree hashes.** I recomputed `sha256(git ls-files -s -- <tree>)` for all 12 trees in
  `/home/user/work005j/freeze/start.txt`. All 12 are identical: file counts 23 / 96 / 14 / 36 / 11 / 37 / 27 / 498 / 277
  / 1 / 1 / 2, and every SHA-256 matches. `now.txt` is byte-identical to `start.txt`.
- **Diff.** `git diff --stat 64b78b4 -- packages apps package.json package-lock.json .github` is empty.
- **Working tree (first check).** At my first check, HEAD was still `64b78b4` and `git status --porcelain` showed:
  - modified: `tests/architecture/research-isolation.test.ts` (+36 lines, the 005J block only);
  - untracked: `research/analyzer-005j/`, the draft report and `stage-reports/artifacts/analyzer-005j/`;
  - nothing else. `PROJECT_STATUS.md` was not yet modified, which is allowed.
- **Re-check at commit `1c81b12`.** While I was reviewing, `1c81b12` ("research(005j): …") landed on the branch. I
  checked it again:
  - `git diff 64b78b4 HEAD` touches only `research/analyzer-005j/`, `stage-reports/` and the test (47 files);
  - the production tree hashes at HEAD are unchanged;
  - the tracked 005J files are all `.py/.ts/.cjs/.json/.md`, and none contains `data:image/`, a PNG header or a JPEG
    header.
- **Recently changed files.** No file under `packages/` or `apps/` (outside `node_modules`) is newer than `start.txt`.
  The ignored OCR model files are untouched. The only newer file is the root `node_modules/.vite-temp`, the vite-node
  cache of the research TS runs, which is not production.
- **Isolation of the research code.**
  - The research TS is outside `tsconfig.json` `include` and outside `vitest.config.ts` `include`.
  - It imports production read-only (`bands.ts` imports `planSheet`).
  - No production source matches the 005J `AUDIT` regex.

**Notes.**
1. `git ls-files -s` hashes the **index**, not the worktree. An unstaged edit to a production file would leave the
   hash unchanged. §A / §M should cite `git status --porcelain -- packages apps package.json package-lock.json .github`
   (empty) beside the hash.
2. The new test "the 005J harness and artifacts track only code and text" filters on `git ls-files`. It passed
   vacuously until `1c81b12` tracked the harness. §M should cite a green run at or after `1c81b12`. My own check by
   hand (above) is clean.

### E2 — P1 — "Split an OPEN_SIDE stretch" is a new decision rule, not an observation, and contradicts "never creates a gap"

**What the proposal says.** `recommendation.md` §005K item 5 lets the witness "split an OPEN_SIDE stretch only where it
reads OPENING / WALL inside it". In the same sentence it says that it "never creates a gap". Report §L (l. 292–293)
repeats this.

**How the production code defines a wide gap.**
- A wide gap is *by definition* the space between two consecutive **along-wall** pieces: `collinearWideGaps`,
  `plan-decomposition.ts:1419–1423`, with pieces from `alongWallPieces` at `:1358–1379`.
- The docstring excludes walls that cross or are set back from the line on purpose: "a mouth between two walls that
  cross the line is a different thing" (`:1403–1407`).
- 005J's own IP-02 says so: "a SPLIT answer would need a new gap boundary (alongWallPieces :1358)".
- The map's injection contract says a referee "never creates geometry, never moves a coordinate".

**The split decides by moving width thresholds, not by adding evidence.**
- Gaps of 3.2 m or less are not wide gaps at all (`:1424`, `maxOpeningM` 3.2 at `:346`). `closureOf` shuts them by
  the width convention (`:1739`; the hole rule is in `closureOf` at `:700–740`).
- The pocket allowance is `max(6, 2.5·w²)` (`:1871`):

  | stretch | width | pocket allowance |
  | --- | --- | --- |
  | gozdzikowcach merged stretch | 7.76 m | **150.5 m²** |
  | garage door alone | 3.25 m | **26.4 m²** |
  | porch mouth alone | 2.7 m | not a wide gap |

  Where the model's mask puts the split point therefore decides which deterministic rule decides, and with which
  threshold. That is a decision rule fed by model coordinates.

**The model is not the evidence the split needs.**
- The pier is already in source-cv: map UP-06 says "the pier off the line is in the mask and in the bands but not in
  this line's pieces".
- The proof read the pier at 36 % wall, which fails its own 0.40 rule (`wall-model-proof.json` →
  `unet.blind8Regions`).
- Its SEVERAL_OPENINGS answers on gozdzikowcach had confidence 0.37–0.39 and were UNRESOLVED at ROT180
  (`unet.referee.blind8Answers`).

**Even a correct split does not build the hall.** The map's gozdzikowcach trace (`visual-referee-opportunity-map.md`
l. 92) says the split is "only consumable with a cut at the inner front wall (REC-03)". REC-03 is out of 005K's scope
("Nothing else changes").

**Requested change.** Do one of the following:
- **Drop the split from 005K.** The map's own sequencing already puts UP-06 after the gap questions.
- **Or re-specify it as what it is:** a versioned change to `collinearWideGaps` / `alongWallPieces`, with split points
  allowed only at existing band ends, the witness labelling only the sub-spans, REC-03 in scope, and an OWNER
  decision.

Either way, delete "never creates a gap" where it does not hold.

### E3 — P1 — "Upgrade WEAK → STRONG with walled jambs" is not how `withCallout` upgrades

**How `withCallout` upgrades (`boundary-evidence.ts:534–541`).**
- It requires both jambs WALL and a width of at most 8 m.
- It makes a gap STRONG **only** when a drawn signature (GLAZING / LEAF_AXIS / LEAF_FACE) **and** a callout with
  confidence > 0.5 are both present. That is two independent signals.
- A callout over a BLANK or DASHED gap yields at most UNKNOWN_GAP / WEAK. It also lifts NONE to WEAK.

**The box path is stricter still.**
- A callout never decides a collinear gap: `plan-decomposition.ts:1409–1411`, `:1432–1433`.
- It decides a bay mouth only together with both corners (`:1579`).
- The map's IP-02 proposes counting the witness "like drawn infill". That is the drawing's own decisive signal, a
  stronger role than a callout.
- So "use it the way it already uses an opening callout" (`recommendation.md` §005K Goal) describes neither path.

**What the proposed rule does instead.**
- It is **single-signal**: the model alone turns a WEAK gap STRONG.
- It includes **BLANK** gaps. A recess or porch mouth is exactly a BLANK WALL/WALL gap of 3.2 m or less →
  UNKNOWN_GAP / WEAK (`:469`, "a door or the mouth of a recess").
- That is the direction of the proof's known error: 12 confident-wrong CONTINUES on synthetic open gaps
  (`unet.referee.byClass.SYNTHETIC.WALL_CONTINUATION`: wrongConfident 12 of 72).
- "Both jambs walled" does not guard against it, because recess mouths have walled jambs.
- The map's own `open_owner_decisions` recommends upgrading "only where two deterministic readings exist". The
  recommendation drops that without saying so.

**Requested change.** Write a callout-equivalent rule:
1. The witness may upgrade only a WALL/WALL WEAK gap that already carries drawn evidence. That means:
   - a stroke signature (LEAF_FACE, DASHED with in-wall strokes);
   - or a pre-override drawn signature that a rule demoted: GLAZING → DASHED by `patternAcross` (`:444–445`),
     infill discounted as `runsPast` (`:458–460`), or LEAF_FACE under 2.2 m (`:465`).
2. Exclude BLANK.
3. Use the WALL verdict, which is unused today, as a drawing-break confirmation (the map's IP-01 already allows this).
4. Add 005H's stability bracket (BASE / PAD / TRIM / SCALE90) and a confidence bound fixed before measurement.
5. Record the pre-override signature.

This loses nothing on round 8:
- the cyklamenach window was GLAZING before the override;
- the cyklamenach double door is LEAF_FACE 1.66 m;
- the gozdzikowcach 0.41 m gap is LEAF_FACE.

### E4 — P1 — By 005J's own traces, the in-scope witness would not move either round-8 outcome; the counterfactual was never replayed

The report claims that "both round-8 first divergences are gap seams" (§B) and that IP-01 / IP-02 "change the outcome"
(§B). The NO_AI_YET rejection and gate 5 lean on this. Read against the code, it does not follow.

**`dom-w-cyklamenach`.**
- In the sealed `13-body-candidates.json`, completion-0 (40.44 m²) is **REJECTED NO_CONTINUATION**:
  - 5.12 m of open junction out of 12.79 m shared;
  - the bound is 6.40 m (`boundary-completion.ts:539–546`, `:562–564`).
- If it were not rejected there, **TOO_LARGE** would stop it next: 40.44 > 0.5 × 48.97 = 24.49 m² (`:577`).
- Both gates come **before** POLICIES_DISAGREE (`:580`), the only gate that strengthening the window and door can
  change.
- The junction edges are interior edges, not those perimeter gaps.
- The EXCLUSION outline already bridges both gaps (86.45 m²). Adoption needs an extension beyond the box, and there is
  none: "box stands" (`plan-decomposition.ts:2972–2977`).
- The map's REC-17 says as much: "answering continuation alone does not build the block".

**`dom-w-gozdzikowcach`.**
- The split needs REC-03 (E2).
- The only in-scope path is REC-18. In the sealed pack, completion-0 (21.84 m², x 311–434) passed continuation and the
  size cap and was refused **only** at POLICIES_DISAGREE. Its single weak gap is a **0.41 m LEAF_FACE, WALL/WALL**.
- That gap is not among the five regions the proof measured (`unet.blind8Regions`). It could not be measured, because
  the pack has no per-gap coordinates.
- The map marks this path "needs replay".

**Requested change.**
1. Before naming 005K's expected effect, run a research-only counterfactual: replay the solver on the sealed round-8
   metrics with the oracle gap answers injected at IP-01 / IP-02. The map notes the gaps are recoverable this way.
2. State the result.
3. Reword gate 5 to cover outcomes as well. "The first bad decision moves" can be met with no change of outcome.
4. Say plainly that cyklamenach also needs the junction / region seam (REC-17 / UP-H2) and the TOO_LARGE rule, which
   are outside 005K.

### E5 — P1 — The query-volume model in §I is circular for this witness and contradicts the map's question rules

**What §I and `server-feasibility.md` §1 plan.** They plan questions as follows:
- "**0** (asked only on a refusal path)";
- "only the weak gaps on the perimeter of a disputed part";
- "ordered by decision impact (area moved)";
- planning figure "median ≈ 1, p90 ≈ 6, cap 8".

**What the rules say.**
- The map's `question_generation_rules` forbid exactly this: "EVERY instance … never for a subset chosen by a score, a
  footprint bucket, a resolver rank or the published figure; budget by count, sorted by stable question id".
- `recommendation.md` itself says "for each gap the analyzer already has".

**Why it is circular.** A witness triggered by refusal lets the figure's refusal pick which gaps receive a model answer.
Those answers then rebuild the first reading. The figure would thereby both refuse and steer the replacement, which is
what the SPENT rule forbids (`plan-resolution.ts:56–72`).

**The real counts.** Recounted from the 005I packs, selected copy only:
- UNKNOWN_GAP on the 21 houses with a boundary record is **7–64 per house, median 24**;
- OPEN_SIDE wide gaps: 29 across 26 packs, at most 7;
- the resolver may decompose up to 4 copies and 24 decompositions (`RESOLVER_BUDGET`, `plan-resolution.ts:91`).

**Requested change.**
1. Restrict the §I figures to the rejected server-VLM option.
2. State that the 005K witness is asked unconditionally, for every eligible gap of every decomposed copy.
3. Plan latency and memory on roughly 24–64 crops per copy.
4. Add two non-circularity gates the map already lists:
   - the decoy-footprint control (figure × 1.25 / × 0.8 → identical questions, crops and answers;
     `plan-resolution.ts:56–60`);
   - the 005I order-invariance shuffle.

### E6 — P1 — No execution architecture: the solver is synchronous, and the gaps exist only inside it

**Why this is a design problem.**
- `reconstructV2` is synchronous: `reconstruct-v2.ts:161`, called without `await` at `run.ts:397`.
- The resolver loop counts work, never time.
- The 005H invariant is that the recogniser is released before the solver starts (`run.ts:332–378`).
- The gap crops of deliverable 4 exist only inside `decomposePlan` / `boundaryExtension`, for every resolver copy.
- The map's contract proposes a **two-pass** run: pass 1 emits questions, pass 2 reruns with the answers. The
  recommendation does not mention it.
- A two-pass run doubles reconstruction, must cover the resolver's own decompositions, and puts a model worker in the
  middle of the solver's memory peak.

**The alternative.** A deterministic, tiled pre-pass over **every plan frame**, run before the solver and released
before it:
- the witness becomes a synchronous lookup of a class map under the gap rectangle;
- the 005H invariant holds;
- it is non-circular by construction, because no analyzer state chooses the model's input;
- the cost is about 1.2 s per 864² frame (measured), for 4–8 plan frames.

It contradicts deliverable 4's "gap crops only (not full frames)", so 005K must choose between the two designs
explicitly.

**Strip size.** The proof sized its strip in **metres**: `HALF_M = 0.18` × ppm (`wall_referee.py:57–58`). The map's
crop contract forbids metres and scale.
- Specify the strip in `wallPx`.
- Then answers do not change when the resolver re-reads a plan at another scale.

### E7 — P1 — What 005H needed and 005K omits

005K lists a worker, cancellation, a manifest and coded failures. It omits the following:

1. **Model hosting and provenance.**
   - The OCR model is fetched from Hugging Face at a pinned commit (`numeric-recogniser-ort/tools/fetch-model.mjs:81`)
     and gitignored (`.gitignore:34`).
   - A BuildPlan-trained model has no upstream. 005K needs a hosting decision and a CI fetch; 005H's P1 B1 was "CI ran
     the bundle tests without the model".
   - "BuildPlan-owned" needs a training record: generator commit, seeds, data hash, steps and the export script.
2. **A self-test and its Android card.** Gate 4's arm64 parity depends on them, and the 005H phone parity is still
   PENDING after two stages (005I §Q).
3. **A `recogniser.test.ts`-style architecture test.** It should pin:
   - the crop field list;
   - the call order;
   - that only `engine.ts` imports ONNX Runtime;
   - that reconstruction never imports the runtime;
   - that the crop block contains none of published / area / footprint / mpp.

   Note that `reconstructV2` receives `publishedAreas` (`run.ts:409`).
4. **Tests that must change consciously.**
   - `local-analyzer.test.ts:128–129` asserts that the bundle's *only* JSON is the recogniser manifest.
   - The wiring regex at `:120` forbids `vision`.
   - Local and API wiring are held equal. 005H ran the recogniser ON on the phone and OFF on the server; 005K must say
     which applies here.
5. **The failure policy.** 005H had no fallback: a failure ended the run as `EXTERNAL_RECOGNISER_FAILED`, with a
   watchdog, Polish texts, `runtimeBusy` and a progress substage. 005K must say whether a witness failure ends the run
   or is a quiet OFF run. 005H forbade the latter.
6. **A memory bound for gate 6.**
   - 005H's whole-run peaks were 898–1,046 MB, and 981 MiB on the emulator.
   - The UNet adds at least 340 MiB at 864².
   - Gate 6 names no limit.

### E8 — P1 — The conflict with 005I's standing route (PATH B — PDF.js) is not stated

**The standing route.**
- `PROJECT_STATUS.md:1288` and 005I §V (l. 469): "by §59 the route is **PATH B — the PDF.js vector-document evidence
  pilot**".
- The PDF.js pilot has been queued since 005G (`PROJECT_STATUS.md:43`, `:1306`, `:1322`).

**What 005J says.** PDF.js appears only as "No PDF.js implementation" and "Not in 005K … no PDF.js"
(`recommendation.md:11`, `:89`; report §L). The report never says that 005K displaces PATH B, or why.

**005I's diagnosis is not reconciled.** 005I said "interpretation failures … all of their evidence is already in
BuildPlan's own observations" (§P, §V).
- 005J's own numbers agree on walls: 0–1.7 % added over source-cv.
- The stroke evidence for both cyklamenach gaps is already present: GLAZING before the override, and LEAF_FACE.

**Requested change.** Add a short paragraph to §L and `recommendation.md` that:
- names the conflict;
- says why a learned witness should come before (a) PATH B and (b) a deterministic interpretation fix of
  `patternAcross` / the 2.2 m vehicle threshold / REC-03;
- or hands the order to the coordinator explicitly.

It would help to say how many development and blind houses have a vector document at all.

### E9 — P1 — 005K has no stop rule between model and integration

005K bundles generator v2, a human-verified real gap set, training, a 005H-class integration and a blind round.

**How far the gates are from the proof.**

| measure | proof | 005K gate |
| --- | --- | --- |
| synthetic confident-wrong | **7.2 %** (13 / 180) | ≤ 0.5 % |
| mirror consistency | 94.6 % | ≥ 99 % |
| rotation consistency | 93.3 % | ≥ 99 % |

**How often the proof was confident on real gaps.**
- REAL_DEV confident on **10 of 304** questions;
- **0 of 126** OPENING_VS_PATTERN questions (`unet.referee.byClass`).

**The gap in the plan.** There is no go / no-go after gates 1–3, and no failure exit.

**Requested change.** State that if the model gates fail, 005K stops before integration and returns to the coordinator.
Better: split the stage into 005K-a and 005K-b:
- **005K-a** (research only): the model, its gates, the E4 replay, and the Evidence Pack per-gap records, which are
  useful with or without a model.
- **005K-b**: integration and the blind round.

### E10 — P2 — Evidence Pack: the gap is real and wider than stated

**Verified.**
- Boundary gaps persist only as counts: `BoundaryRecord.gaps = counts` (`plan-decomposition.ts:3050`), and
  `pack.ts:622` / `:643` carry `gapClasses` only.
- Completion `weakGaps` have no id and no coordinates (`boundary-completion.ts:99`, `:605`).
- Wide openings **do** carry coordinates (`pack.ts:634`, `:643`). However, their id is positional (`opening-${i}`), and
  they are written for the selected copy only.

**005K's pack record also needs:**
- a stable gap id: `BoundaryGap.id` (`boundary-evidence.ts:450`), and a geometric id for `WideOpeningDecision`;
- the copy / decomposition id;
- the crop rectangle and crop hash, never pixels;
- the pre-override signature and `patternAcross` result;
- a strokes summary;
- the shares, the variant answers and the verdict;
- rule and model versions;
- a timeline stage. Today there are zero gap events.

**Interaction with "OFF ⇒ byte-identical".** Per-gap records and the `BOUNDARY_EVIDENCE_VERSION` bump
(`boundary-evidence.ts:53`) must appear only when the witness is ON, as 005H's versions did. Otherwise the OFF change
must be declared and explained.

### E11 — P2 — Citations: the substance holds, with small drift

**Exact:**
- `collinearWideGaps` at `:1413`;
- the decisions at `:1433`, `:1578`, `:1872`;
- `gapStrokes` / `patternAcross` at `boundary-evidence.ts:298–419`;
- `withCallout` at `boundary-evidence.ts:534`;
- the IP-01 range `:2807–2810` in the JSON.

**Drift:**
- "WideOpeningDecision.evidence (`plan-decomposition.ts:191–202`)": `OpeningEvidence` is at `:193–204` and
  `WideOpeningDecision` at `:207–222`.
- "beside `withCallout`, `:2807`": `:2807` is `assignCallouts`; the `withCallout` call is at `:2808`.

### E12 — P2 — Flag semantics and parity cap

- **The flag.** "OFF by default" is undefined against 005H's practice of ON on the phone and OFF on the server. If the
  APK ships OFF, the end-of-stage blind round must run ON, and the report must say which configuration the OWNER APK
  carries.
- **The parity cap.** Without the arm64 phone, the stage verdict is capped at PARTIAL, as in 005H and 005I. Say so in
  gate 4.
- **"≈ 0.1 s per gap crop".** This is scaled from the 864² frame, not measured: the probe has no 256² UNet entry
  (`wall-model-proof.json` → `wasm`). Label it as an estimate in the report, as `android-deployment-matrix.md` already
  does.

### E13 — P2 — The witness's status as a witness should be stated

`GapWitness` must never be a resolver `Corroboration`. Per `plan-resolution.ts:97–98`, a corroboration is "neither the
published figure nor the pixels the reading was made from", and the witness reads the same pixels. It must also never
satisfy `holdout/verdict.mjs:69` `resolvedWithAWitness`. The map recommends exactly this; 005K should state it and pin
it with a test.

---

## Position on the primary recommendation

I support TRAIN_BUILDPLAN_WALL_MODEL as the **direction** of BuildPlan's model work. It is the only measured option that:
- is commercially clean;
- transfers at pixel level;
- runs in the WASM runtime the app already ships, with no native code;
- can enter as an observation rather than as a resolver rule.

The rejections of the off-the-shelf models, the zero-shot small VLMs and the Route-C hybrid are consistent with the
evidence I checked.

The 005K specification attached to it oversells and under-specifies:
- **Oversells:**
  - The split is a decomposition rule change, not an observation (E2).
  - The upgrade rule is single-signal where `withCallout` needs two (E3).
  - By 005J's own traces, neither round-8 outcome would move under the in-scope rules (E4).
- **Under-specifies:**
  - the question selection (E5);
  - the execution architecture (E6);
  - what 005H needed and 005K omits (E7);
  - the stop rule between model and integration (E9).

None of this needs production code in 005J. It needs:
- a rewritten §005K: IP-01 only, a two-signal rule, a pre-pass or two-pass design, per-gap Evidence Pack records first,
  and a counterfactual replay as the entry gate;
- a restated §I;
- an explicit paragraph on 005I's PATH B.

With those, the recommendation stands.
