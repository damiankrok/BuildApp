# 005K fresh-sheet gap set — protocol, fixed before the draw

This file is committed in the freeze commit, before any fresh sheet is drawn, acquired or read. It fixes:
- what is drawn;
- which gaps are in the set;
- how they are labelled, and by whom;
- what the candidate rule and the constant control are;
- how they are scored;
- the gate that would adopt the rule.

Nothing below may change after the draw. A deviation is recorded as a deviation, beside the number it changes.

## 1. The frozen analyzer

- `FREEZE_SHA` is the pushed commit that carries:
  - the per-gap evidence records (boundary evidence 1.2.0, Evidence Pack 1.2.0);
  - the drawn-gap rule behind `drawnGapRule` (OFF by default);
  - this protocol and the exclusion manifest.
- The fresh sheets are extracted with that code, rule OFF.
- The rule is evaluated with the same commit, rule ON.
- No production change is made between the draw and the evaluation. If one were needed, the set would be re-extracted
  and the deviation stated.

## 2. Exclusions (brief §11)

- The exclusion manifest is `gap-set-exclusion-manifest.json`, built by `research/analyzer-005k/exclusions.mjs`.
- It contains every family that is, or might already be, known:
  - every committed exclusion list (ARCHON rounds 1–8, DobreDomy);
  - every blind draw in `holdout/LEDGER.ndjson`;
  - every sealed development package, committed or under `work005*`;
  - every project linked from any page in a development byte cache — the development, blind and benchmark pages, so
    their similar-project and related links are swept.
- Families are counted by the rules every blind round used: `family` for ARCHON, `ddFamily` for DobreDomy.
- The result: 105 ARCHON families and 175 DobreDomy families.

## 3. The draw (brief §12)

- `seed = SHA256(FREEZE_SHA + "BUILDPLAN-005K-FRESH-GAP-SET")`.
- **8 ARCHON projects** from `holdout/pool.txt` and **6 DobreDomy projects** from `holdout/pool-dobredomy.txt`. Each pool
  is taken less the excluded families, with one project per family.
- The k-th pick is `SHA256(seed + ":<publisher>:" + k) mod n` over what is still drawable, in pool order
  (`research/analyzer-005k/draw.mjs`).
- A DobreDomy pick must publish technical material, read from its page markup as round 3 read it (`ddEligible`). An
  ineligible pick is recorded and burned.
- Every pick is appended to the draw ledger.
- These projects become gap-evaluation development material. They are excluded from every later whole-house blind
  round.

## 4. Acquisition and extraction, then the seal (brief §13)

1. Each drawn project is analysed once, live:
   - the production pipeline (`analysis:second-house --url`) at `FREEZE_SHA`, rule OFF;
   - with the external recogniser, as the phone reads;
   - with the byte cache and the outputs outside the repository.
2. The source bytes are hashed. The page markup and every plan raster are recorded by SHA-256.
3. **A sheet is a plan frame the analyzer decomposed and whose boundary it read.** The set holds every gap on such a
   sheet that the frozen analyzer:
   - classified **WEAK**;
   - between **two WALL jambs**;
   - with **drawn evidence** — a door leaf, glazing or a face line drawn across it, read as it stands, before the
     pattern override, or without the runs-past flags (`DrawnGapCheck.drawn`).

   This is exactly the population the constant control upgrades. BLANK gaps and dashed-only gaps are not in it.
4. Each gap is stored by key:
   - the key is project / frame / decomposition / gap id;
   - with its coordinates, the crop rectangle and the SHA-256 of the ink mask inside the crop;
   - with the frame's byte hash.

   The manifest carries no rule condition other than the population's own three, and no outcome. It is
   committed and pushed (**the seal**) before any label exists.
5. The project count is not tuned after the draw. The set is what the drawn projects give. Every attrition is
   recorded: a run that failed before the boundary, or a sheet with no gap in the population.

## 5. Labels (brief §14–§15)

**The four labels.**

| label | meaning |
| --- | --- |
| `OPENING` | the enclosing wall or body continues across the gap, and the gap is an architectural opening (door, window, garage door) |
| `OPEN` | a genuine open side, mouth or recess: no wall continues across |
| `NOT_A_WALL_LINE` | the stretch the analyzer read is not the wall line under analysis (through a room, along a terrace edge, a dimension or annotation line) |
| `UNRESOLVED` | the drawing does not settle it |

**What a reviewer sees.** Each gap is composed outside the repository as one picture:
- the crop as the source draws it, beside the same crop with two red brackets;
- the brackets mark the gap's ends, drawn **outside** the wall band so they cover no evidence;
- the crop gives at least 1.5 m of context on every side;
- the file name is neutral (`q###.png`) and the key file is separate.

A reviewer is told the label definitions and nothing else. In particular, never:
- the analyzer's classification, the rule's conditions or any rule result;
- the house, the publisher or any published figure.

**Who labels.**
- **No human channel is available in this stage.** Labels come from independent source review by blind sub-agents of
  this session's own model.
- These are **not human ground truth**, and the report says so wherever a label is used.

**How a label is decided.**
- Two reviewers label every gap independently.
- Where they agree, the label is theirs (`label_source = TWO_REVIEWER_AGREEMENT`, reviewers `AI_SUBAGENT`).
- Where they disagree, a third reviewer labels it blind.
  - A majority of the three decides (`label_source = INDEPENDENT_SOURCE_REVIEW`, majority of three AI sub-agents).
  - Otherwise the gap is `UNRESOLVED` (`label_source = UNRESOLVED`).
- Any reviewer's `UNRESOLVED` counts as a vote like the others.

**The seal.** The labels are committed and pushed before the rule or the constant control is evaluated on the set.

## 6. The three arms (brief §17–§19)

| arm | what it says about each gap in the set |
| --- | --- |
| **BASELINE** | the frozen classification: WEAK, decided downstream by what lies behind it (the outline's fate is recorded: bridged weak, a pocket mouth, not reached) |
| **CONSTANT** | the deliberate naive control: every gap in the set is an OPENING (STRONG). Not a candidate |
| **DRAWN_RULE** | the rule: STRONG exactly when `DrawnGapCheck.eligible` — WALL/WALL, both jambs stretches of this wall, within the 3.2 m lintel convention, drawn evidence, a continuous line inside the wall band, and wall-thick ink (≥ 0.8 of the wall-solid layer) at both jambs on their own axes |

**Measured "drawn" routes.** A gap can count as drawn in three ways:
- the signature itself;
- the reading before the pattern override (a pattern across both faces);
- the reading without the runs-past flags.

The brief makes all three eligible, and the rule keeps them. Every metric is also reported by route, so a later stage
can see what each route costs. A route is never dropped after the labels are known.

## 7. Metrics (brief §21)

For each arm:
- resolved n and coverage;
- OPENING recall;
- negative recall (specificity) on `OPEN + NOT_A_WALL_LINE`;
- false upgrades: count and rate among resolved negatives;
- the Wilson 95 % interval of every rate;
- splits by publisher, by scale or density group (mpp below or above 0.02 m/px), by width (within 1.2 m vs wider), and
  by drawn route.

**OUTCOME_CRITICAL_FALSE_BRIDGES.** A false upgrade counts here when re-solving its project with the arm instead of
the baseline changes either:
- the model hash;
- or the failure code.

The research replay re-solves each project's own sealed evidence with the solver alone:
- rule ON for DRAWN_RULE;
- the constant upgrade for CONSTANT, in a replay-only copy of `boundary-evidence.ts` outside the repository, as in
  005J.

## 8. The adoption gate (brief §22, not pre-approved)

The rule ships only if **all** hold:
1. Phase-0 UI evidence green.
2. Per-gap evidence deterministic.
3. The set sealed before evaluation.
4. At least 30 resolved negatives and 30 resolved OPENING cases, or a stronger equivalent safety proof.
5. Zero outcome-critical false bridges on the fresh set.
6. No unexplained false upgrade on an open-side, carport or porch negative.
7. A material safety advantage over CONSTANT: fewer false upgrades, with the rule's upper Wilson bound below
   CONSTANT's point rate.
8. No development verdict regression.
9. No existing PASS house silently moves.
10. Every changed model hash source-supported and explained.
11. Non-circularity green.
12. The council leaves no unresolved P0 or P1.

**If item 4 fails, the verdict is `INSUFFICIENT_EVIDENCE`:**
- the rule stays OFF;
- the observational records stay.

**If any safety item fails** (5, 6 or 7), the verdict is `REJECT` and the rule stays OFF. The gate is not lowered.
