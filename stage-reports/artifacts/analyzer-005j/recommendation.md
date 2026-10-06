# Recommendation (BUILDPLAN-ANALYZER-005J)

The first draft of this page recommended training a wall / opening witness for 005K. The six-reviewer council
(`post-review/`) changed that in two steps:

1. **Reviewers A and E** showed that the draft's integration path would not move either round-8 house, and asked for a
   replay. The replay was run in 005J (§3).
2. **Reviewer F** then showed, from that replay, that the deterministic alternative is outcome-identical on every
   measured row. It costs nothing at run time.

The witness's one claimed advantage is saying no to drawn-but-open gaps. It rests on development data: seven real
questions, with a confident miss at the only hard one. The decision below follows the evidence.
`post-review/resolution.md` lists every change.

## 1. Decision

| | |
| --- | --- |
| **PRIMARY_NEXT** | **NO_AI_YET** — made concrete in 005K: per-gap evidence records, a **sealed fresh-sheet gap set** labelled before any rule or model runs, and the deterministic drawn-gap upgrade with tightened eligibility, measured on it (§5) |
| **SECONDARY_LATER** | **TRAIN_BUILDPLAN_WALL_MODEL** — the from-scratch UNet-lite wall / opening model as a **challenger**, trained and integrated only if the sealed set shows deterministic false upgrades that matter and that the model refuses (§6) |
| rejected | **ADOPT_EXISTING_SPECIALIZED_MODEL**: no commercially clean model exists.<br>**ADOPT_SMALL_VLM_REFEREE**: zero-shot at or below chance, also on matched subsets; ≈ 17–20 s and ≥ 1.9 GiB per question in the shipped runtime, ≈ 7 min per median house when asked for every eligible gap (post-review B4).<br>**HYBRID_WALL_PLUS_REFEREE**: neither half has a measured advantage yet; the referee pilot failed on real sheets.<br>**TRAIN_BUILDPLAN_VISUAL_REFEREE now**: the region / outline seams it would serve are blocked by deterministic rules first (§3) |

No PDF.js implementation, no fresh blind round and no production change in 005J. **005K is not self-started.**

## 2. The evidence the decision rests on

| question | measured answer | where |
| --- | --- | --- |
| Where would a visual answer change the model? | 52 seams, 12 P0. The P0 list is dominated by gap decisions: **3–4 distinct gap decisions among 7 distinct P0 decisions** (post-review A6) | `visual-referee-opportunity-map.md` |
| Is any existing floor-plan model usable? | No. Every trained floor-plan model found has non-commercial weights or data | `floorplan-models.md`, `licensing-matrix.md` |
| Can a generic small VLM answer the narrow questions? | **No**, as tested: three checkpoints of at most 0.5 B, zero-shot, one 512 px tile, one prompt (post-review F11). SmolVLM2 ran in its deployable **64-image-token** configuration (`do_image_splitting=False`, 1/17 of its default budget; post-review B2). ⟪B2_PROBE_SHORT⟫ Each arm ran on a different subset of one pool; the matched subsets are in `vlm-bakeoff.md` §8 (post-review B1).<br>• **SmolVLM2-500M** is right on **45 %** of what it answers (REAL_DEV 47 %, blind-8 37 %), with **7.2 %** confident-wrong; its 43 % mirror consistency is almost entirely synthetic. On counterfactual pairs both members answered it gets both right on 19 % (chance ≈ 23 %).<br>• **Moondream 0.5B**: 46 %.<br>• **Florence-2-base** (no VQA task): 41 %, with 23 % confident-wrong.<br>On the oracle's own items SmolVLM2 is right on 46 of 100 answered, the oracle on 138 of 141. The rejection also stands on cost alone | `vlm-bakeoff.md` |
| Are the questions answerable from the crop? | **Yes.** The in-session strong model, answering blind, is right on **98.0 %** of 148 with **0** confident-wrong (30/30 REAL_DEV, 16/16 blind-8) | `vlm-bakeoff.md` |
| Does a BuildPlan-trained pixel model transfer to real sheets? | **Partly, and only on positives.**<br>• A from-scratch UNet-lite (1.56 M) trained on synthetic data finds 91–100 % of exterior wall on 7 ARCHON sheets.<br>• With the strip on the wall axis — inward side taken **from the truth outline** — it reads 61 of 63 real openings OPENING. All 63 expect OPENING, so a constant answer also scores 63/63. With the side flipped it scores 0/63.<br>• This is recall on positives with oracle placement, on one publisher at ≈ 40 px/m (post-review F5, F9) | `wall-model-proof.json` |
| Can it say no on real sheets? | **Barely measured.** On the 7 real minority questions (NOT_WALL / TERMINATES) it gets 6 right and is **confidently wrong on the only hard case**: the azaliach canopy next to the building, read WALL at 0.83. Wilson 95 % upper bound on its error: 51 % (post-review F6). On synthetic open gaps: 12 confident-wrong CONTINUES | post-review F6 |
| Does a correct gap reading move a failing house? | In the replay of the frozen code (§3), upgrading one 0.41 m drawn gap completes **gozdzikowcach** at −3.75 %, and the **verdict still fails** on the storey count. **cyklamenach** does not move. **No verdict moves** on any row | §3 |
| Does the model add anything a deterministic rule does not? | **Not measured.** Upgrading every drawn weak gap with no model gives the **same** gozdzikowcach model and the same outcomes on every valid replayed row. The model differs only in *not* upgrading two drawn-but-open gaps in gozdzikowcach, and neither changes the outcome:<br>• the dashed porch front: 100 % background;<br>• `gap-X-413`, a dashed stretch through a room: 99.7 % background | §3, `wall-model-proof.json` |
| What blocks verdicts on the development matrix? | Most often the **storey count**: tunbergiach, zurawkach and willa-miranda fail on it alone, gozdzikowcach fails on it after the replay, and helikoniach fails on it beside its footprint. Then REC-17 / TOO_LARGE (cyklamenach) and the recessed-entrance body relation (jarzabem, which 73 upgrades do not move) | §3, post-review F7 |
| Does a whole-image referee trained on synthetic data transfer? | **Not this pilot.** 85 % on synthetic, but 49.6 % on REAL_DEV with 34 % confident-wrong. It is one weak pilot (8 seeds, 256 px, one run), not a law (F12) | `wall-model-proof.json` → `routeCPilot` |
| Do BuildPlan-sized models fit the phone? | Yes, in the WASM runtime the app already ships:<br>• UNet-lite: 6.25 MB, 1.19 s per 864² frame;<br>• micro-referee: 70 ms.<br>A small VLM does not: ≈ 17–20 s and ≥ 1.9 GiB per question, ≈ 7 min per median house (24 gaps) on a desktop core, ×2–5 on a phone | `android-deployment-matrix.md` |
| Is a training route legally clean? | Yes, BuildPlan synthetic data trained from scratch. Real publisher crops are evaluation data only | `licensing-matrix.md` §4 |

## 3. The oracle replay (research, 005J)

**Setup.**
- Production code at `64b78b4`, unchanged in the repository.
- `research/analyzer-005j/replay/oracle_replay.py` writes a research copy of `boundary-evidence.ts`. The copy is
  swapped in only inside the replay process, through a Vite alias.
- The copy wraps `classifyGap`. Under `ORACLE_WITNESS` it upgrades to STRONG every WEAK gap between two WALL jambs
  whose signature is not BLANK. That is also exactly the deterministic "drawn-gap upgrade".
- Each house is re-solved from its sealed source package, observation graph and metric evidence, so OCR and metric are
  held fixed.

**Two cautions (post-review F2).**
- The replay writes no `warningDetails` and no observation graph. So `holdout/verdict.mjs` cannot evaluate
  `openingsAllBuilt`, `resolvedWithAWitness` or raw legibility on replay outputs. The sealed and OFF verdicts therefore
  differ on 9 rows that have the **identical** model hash or failure code.
- The comparisons below are made at the level of **model hashes, outcomes, footprint residuals and the storeys
  condition**. They are not full holdout verdicts.

**Results.**

| house / set | OFF (fidelity) | ALL_DRAWN (every eligible gap) | narrower runs |
| --- | --- | --- | --- |
| dom-w-gozdzikowcach | the sealed failure code | COMPLETED, model `2d08931b`, 127.54 m² (−3.75 %); storeys still fail; 10 upgrade events | **ONLY `gap-Y-538-322-338`** (0.41 m LEAF_FACE) gives the same model. **EXCLUDE-porch** (every eligible gap but the porch front; 1 of 10 gaps checked, not a truth oracle — F3) gives the same model |
| dom-w-cyklamenach | the sealed failure code | unchanged (91 events, 58 distinct gaps) | — |
| development matrix: 24 rows, 21 replayed, 19 valid | 19 of 19 valid rows reproduce the sealed model hash or failure code.<br>Not replayed: eoze-legacy-area, eoze-legacy-every, kosacce-area-alone (graph or metric file missing).<br>Not valid: dabecjach, tunbergiach (source bytes in no cache) | **2 of 19 change a decision, 0 change a verdict condition that was evaluable:**<br>• zurawkach: model changes, −0.81 % → −1.68 %, still fails storeys;<br>• azaliach: its failed reading changes, still fails (F10).<br>Every completed row that holds the footprint and storeys conditions keeps its model hash: arkadiach, jablonkach, modrzykach, morelach, kosacce ×2, marcowki, rarytasy-eoze. rarytasy-g2e keeps its hash; its sealed verdict was ALGORITHMIC_FAIL on an unbuilt opening | — |

**Reading.**
- A drawn-gap upgrade, with or without a model, completes **one** failing house: gozdzikowcach, via REC-18. Its verdict
  still fails on storeys.
- It does not move cyklamenach (REC-17 / TOO_LARGE), jarzabem (recessed entrance) or helikoniach.
- On this matrix, the model's only behavioural difference from the deterministic rule is two correct "no" readings that
  change no outcome. So the witness has **no measured outcome advantage**; its case is a hypothesis about unseen drawing
  styles.

## 4. Why NO_AI_YET first, and how it relates to 005I's PATH B

- **Cost and evidence.** The deterministic upgrade and the witness are indistinguishable on every measured row.
  - The deterministic upgrade is free at run time.
  - The witness costs ≈ 5–10 s and ≥ 340 MiB per run in WASM, plus a training programme.
  - Neither moves a verdict.
  - What decides between them is out-of-sample behaviour on drawn-but-open gaps. **Nothing in BuildPlan measures that
    today.** So the first job is to build that measurement, not the model.
- **What could flip it.** If the sealed fresh-sheet set (§5) shows the deterministic upgrade bridging gaps that are
  open, and those false bridges change outcomes, the wall model becomes the measured challenger (§6). Its proof shows it
  reads open gaps as background in the two real cases seen. Its synthetic shortcut and its one confident real miss show
  that this is not yet reliable.
- **PATH B (PDF.js).** 005I's standing route is the vector-document pilot.
  - Only **2 of the 26** development and round-8 source packages carry any PDF (aster-viii, galaktyka).
  - Every ARCHON house, both round-8 houses included, is raster-only.
  - PATH B is therefore not the lever for the recurring failures. The coordinator decides the order.
- **The verdict blockers are deterministic.** They are not in 005K and are for the coordinator to schedule:
  - the storey count, the most frequent single blocker;
  - REC-17 / TOO_LARGE;
  - the recessed-entrance body relation (REC-03 / UP-06).

## 5. 005K — BUILDPLAN-ANALYZER-005K: GAP EVIDENCE RECORDS + SEALED FRESH-SHEET GAP SET + DETERMINISTIC DRAWN-GAP UPGRADE (NO_AI_YET)

1. **Per-gap Evidence Pack records.** Deterministic, behind a version bump; OFF hashes stay byte-identical (post-review
   E10). Each record holds:
   - a stable gap id (`BoundaryGap.id`, plus a geometric id for wide openings);
   - the copy and decomposition id, **the scale (mpp) and the reading** — the bare id collides across copies and scales
     (cyklamenach's `gap-Y-196-469-516` occurs at four widths; post-review F15);
   - `linePx` **and `axisPx`**, with the jamb that supplied the axis;
   - the crop rectangle and its hash, never pixels;
   - the pre-override signature and the `patternAcross` / `runsPast` / 2.2 m-rule results;
   - a strokes summary;
   - the ink fraction across the gap.
2. **A sealed fresh-sheet gap set** — the out-of-sample instrument (post-review F8).
   - **Sources:** plan sheets drawn **by lot** from publisher pages that are neither development nor blind-history
     houses. Include at least one non-ARCHON publisher and more than one scale.
   - **Contents:** every eligible weak gap on those sheets (WALL/WALL, drawn signature), labelled by a person as
     OPENING / OPEN / NOT A WALL LINE **before any rule or model is run on them**. Coordinates and hashes only, as in
     005J's `question-corpus.json`.
   - **The unit** is one gap on one sheet. The count is stated.
   - **Gates** are stated as an upper bound on n, and always beside a **constant control** ("every eligible gap is an
     opening").
3. **The deterministic drawn-gap upgrade, with tightened eligibility.**
   - It upgrades WEAK → STRONG only a WALL/WALL gap whose drawn evidence lies **inside the wall band**: a stroke
     signature, or a pre-override signature demoted by `patternAcross`, `runsPast` or the 2.2 m rule.
   - It excludes BLANK gaps.
   - It excludes stretches with no wall-thick ink at either jamb along the line — the phantom stretch through a room
     (`gap-X-413`, F3).
   - It is measured on:
     - the development matrix, OFF / ON: every changed hash explained, no verdict regression;
     - the sealed set: false-upgrade rate against the constant control.
   - It ships **only** if the sealed set bounds its false upgrades. Otherwise it is recorded and not shipped.
4. **Non-circularity.** The upgrade reads the drawing and the analyzer's own geometry only — never a published figure,
   never a refusal. It applies to every eligible gap of every copy, plus the decoy-footprint control and the 005I
   order-invariance shuffle.
5. **What the sealed set decides next.**
   - If the deterministic upgrade's false bridges on drawn-but-open gaps change outcomes on the sealed set, the wall
     model challenger (§6) has a measured target.
   - If they do not, the wall model stays research.
6. **Not in 005K:**
   - any model;
   - any VLM or server;
   - PDF.js;
   - the storey, REC-17 / TOO_LARGE and recessed-entrance rules (separate deterministic decisions).

## 6. Later (SECONDARY): TRAIN_BUILDPLAN_WALL_MODEL as the challenger

Only after 005K's sealed set exists. The proof is retained (`wall-model-proof.json`, `wallproof/`), and the following is
specified for that later stage.

1. **Generator v2.**
   - **New families:**
     - open-gap hard negatives (porch mouths, carports, open sides, recesses with returns, gaps with nothing across);
     - faint-symbol positives: thin garage doors, single-line leaves (C4);
     - patterns **on the wall line** (C3);
     - dimension lines and text over walls;
     - piers;
     - coloured fills;
     - more scales and publishers' conventions, generated not copied.
   - **Pairs:** minimal, so the partition does not move.
   - **No overlay drawn over the evidence** (post-review B6): in the GARAGE_BODY family the red candidate outline
     covered the dashed garage-door line that is the A/B difference. Targets go in mask channels, not on the drawing.
   - **Fonts:** OFL / Bitstream Vera / Apache only.
   - **Pins:** font and environment pinned.
2. **The model.**
   - UNet-lite trained from scratch, exported to ONNX and pinned by SHA-256.
   - A training record: generator commit, seeds, data hash, steps, export script, hashed environment lock.
   - A hosting decision and a CI fetch.
3. **The witness.** A two-signal rule (callout-equivalent; post-review A4 / E3): drawn evidence and the model's
   OPENING, read on the jamb-band axis that 005K records.
   - The model's BACKGROUND **vetoes** a deterministic upgrade. Saying no is its only measured purpose.
   - Never an OPEN_SIDE split, a new gap, a downgrade or a resolver corroboration (E2, E13).
4. **Execution.** A deterministic tiled pre-pass over the plan frames, released before the solver (E6).
5. **The gate that decides adoption.** On the **sealed fresh-sheet set**, the witness must refuse the deterministic
   rule's false upgrades. It does so with confident-wrong ≤ 0.5 % stated as an upper bound on n, beside a constant
   control.
   - The model-in-the-loop replay of the development matrix must move nothing the deterministic rule does not.
   - Mirror / rotation consistency ≥ 99 %.
   - Beside the 0.80-threshold metrics: per-class AUROC, balanced accuracy (or per-answer recall), and accuracy on
     counterfactual pairs both members answered. A constant guesser passes minority-only and consistency metrics
     (post-review B7).
6. **Integration.** As 005H's recogniser, only after the gate passes:
   - package, self-test, architecture tests, failure policy;
   - a memory bound of 005H's peak + 400 MiB;
   - flag ON on the phone;
   - a blind round ON.

## 7. Answers to the brief's five questions

1. **Q1 — where would intelligence help?**
   - **First**, at drawn-gap decisions: REC-11 / UP-01 / UP-02 `classifyGap`, and REC-18 `policiesAgree` through IP-01.
     The replay shows a correct reading there can complete a house. It also shows the same effect is reachable
     deterministically.
   - **Second**, at region and outline seams, which today are blocked by deterministic rules first.
2. **Q2 — open-source floor-plan technology?** Nothing adoptable.
   - MitUNet is an architecture to retrain, from scratch, with an own or Apache-2.0-based implementation.
   - ResPlan is a data candidate only with counsel.
   - fpvec-lab is a paper to reimplement.
3. **Q3 — can small VLMs referee?** Not as tested (three checkpoints of at most 0.5 B, zero-shot, single tile, one
   prompt; SmolVLM2 in its deployable 64-image-token configuration), and not on the phone at an acceptable cost
   (≈ 7 min per median house).
   - SmolVLM2: right on 45 % of what it answers, with 7.2 % confident-wrong.
   - Moondream: 46 %.
   - Florence-2: 41 %.
   - The strong oracle: 98 % (144 of 147 answered), with 0 confident-wrong at 0.80 (2 at 0.75; its confidences are
     verbal self-reports, post-review B5).
4. **Q4 — custom model vs generic; legal training?**
   - If and when a model is needed, it is custom: BuildPlan-trained, from scratch, on BuildPlan's own synthetic data.
     The UNet-lite proof shows the route is clean and transfers at the pixel level on positives.
   - Real publisher crops stay evaluation data. A hosted teacher on them is CONDITIONAL on counsel.
5. **Q5 — what should 005K implement?** §5: gap evidence records, a sealed fresh-sheet gap set and the deterministic
   drawn-gap upgrade measured on it — no model.
