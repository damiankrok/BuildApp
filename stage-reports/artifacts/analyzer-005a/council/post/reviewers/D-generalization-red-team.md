# Council D — Generalization Red Team (005A post-review)

Reviewed at HEAD `f1901e9`. It was amended from `4c07986` during the review, and the drop set now also covers `OPENING_LEAF_*`.

## 1. Strongest improvement

**A wall-ink extent inside a bounded resolver that keeps its alternatives.**
- `wallClusterExtent` (`plan-decomposition.ts:1781`) is the first witness to where the building sits that does not depend on OCR. [C]
- `resolvePlan` weighs the other readings and names ties instead of dying on the first failed step. [C]
- e-OZE goes from 0/9 to 7/9 copy subsets, every one through the wall-ink extent. Every row that completed before keeps its hash (`resolver/plan-copy-matrix.md`). [M]

This retires my pre-audit F2 and part of F1.

## 2. Largest remaining genericity risk

**Acceptance is the published footprint in disguise.** `acceptable` (`plan-resolution.ts:395-408`) takes AGREES alone, NEAR with one corroboration, or UNKNOWN with two. The corroborations do not check the error they are meant to catch:
- **WALL_COVERAGE is blind to scale.** It works in pixels only. Under the cluster extent it counts walls inside the same box the bodies come from (`:313-323`). [C]
- **CROSS_COPY is correlated.** The two 853 px copies share one misread scale: e-OZE registers both at 2134 cm sheet width against a true 1895 (pre-audit E1). [M]

What this does on the committed evidence:
- **Kosaćce, area copy alone:** one of 15 distinct outlines was accepted with zero corroborations. [M]
- **G2E, 550 copy only:** accepted at −17.6 % with 3 bodies, where the accepted model has 2. Its only support is WALL_COVERAGE, at a scale 13 % short. It is counted in the 28/36. [M]
- **e-OZE `reading4`:** 12 m² (−90 %), yet it carries WALL_COVERAGE + ISOTROPY. Those are the two corroborations the UNKNOWN branch asks for. [M]; that it would win without a published figure is [I]

**No gate catches this:**
- The holdout's PASS predicate is the same 6 % footprint check (`holdout/README.md` §5).
- No shape-family row ever reaches the resolver (`resolved: null` on all 20).

**Most likely holdout failure:** a wrong scale on the 853 px dimensioned copy. It comes from the OCR and chain layer, which this stage only instrumented.
- **The e-OZE precedent:** 7 of its 9 plan dimensions were rewritten by the chain solver toward the wrong scale. The corrected scale exists only because one long token ("1601") was unedited, against 0 px of long support for the registration. [M]
- **Errors under 20 % of area** raise only DEGRADING (`layout-gate.ts:149`), so the resolver never runs (`reconstruct-v2.ts:228`). The holdout then scores FAIL by the 6 % predicate.
- **A copy with no registration** gets no readings at all (`plan-resolution.ts:474`).

This would be **algorithmic, not source-limited**: the overall dimension is printed on the sheet.

## 3. Possible hidden overfit

| candidate | shaped by | would an unseen ARCHON house break it? |
| --- | --- | --- |
| resolver axes (`:16-24`) | one axis per development failure; only the base storey is re-read (`:448`) | **yes**: storey, orientation and wall-style failures have no axis; 0 of 4 failing shape families rescued |
| lattice weight > registration weight (`:189`) | e-OZE, 720 px vs 0 px; the unit test replays its 720 px "1601"→"1801" (`plan-resolution.test.ts:247-256`) | **unlikely** with a published figure; unguarded without one |
| walled-first exemption for sides facing built cells (`plan-decomposition.ts:1867,1881`) | Kosaćce's corner terrace | **yes**: an inset porch whose kerb is not a whole side passes "some wall > 0" |
| `sameBuilding` (`:364-371`) | outer faces vs axes | **minor**: the tolerance is absolute, so it scales with house size |
| 5 % refuted-share bucket (`:248,260,375`) | new | **yes**: `stated === 0 → 0` rewards silence. Where both 853 px e-OZE copies read, the area copy (3 dimensions) beat the dimensioned one (9) in 4 of 4 rows |
| budget 4/24/4 (`:57`) | ARCHON's 4 ground-floor plan copies (4/4 packages) | **yes**: a fifth copy pushes out the area copy; a full 24 switches `mouths` off (`:553`) |
| shape families / `KNOWN_SILENT` | 38 px/m, 0.4 m walls, one copy | the silent row's 3.2 m door equals `maxOpeningM` (`:295`): a threshold fixture |
| purity stoplist, six-letter stem (`generalization.test.ts:49,95`) | ARCHON page boilerplate | affects the guard only; it misses inflections that change the first six letters |
| warning channel (`warnings.ts:63`) | ARCHON's guessed-copy 404s | **low**; but neither a resolution nor a dropped opening is ever LIMITING |
| opening drop (`candidate.ts:309,388-401`) | Council F | **yes**: uncapped; it turns emission failures, a holdout FAIL, into completions, even under a wrong tiling |

**Detection:** withhold or perturb the published figure and count resolved buildings that change.

## 4. One next research item

Before the draw, replay the 36-row copy matrix and the 20 shape-family rows from sealed evidence three ways: with the footprint withheld, at ×0.9 and at ×1.1. Record which rows resolve and whether the chosen building moves with the figure.

Why this comes first:
- It is cheap: no OCR, only resolver stages 1–2.
- It is the only direct test of whether the resolver selects on the number the holdout also scores.
- No patch is allowed after the draw (T2).

**Verdict on the implementation decision.**
The structure was followed: the first reading runs unchanged, and the ranking, budgets, named ties, derived purity registry and gated known rows are as committed.
Departures:
- EXACT_READING is missing (`:63`).
- The lattice fires on an *unsupported* registration, not only a *contradicted* one.
- The `mouths` axis and the `OPENING_LEAF_*` drops exceed §3.
