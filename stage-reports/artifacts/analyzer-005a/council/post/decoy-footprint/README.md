# Decoy-footprint control (post-implementation Council)

Four of the seven post-implementation reviewers asked for this control before the blind holdout: B §4, C §4,
D §4 and G §4. Their question: does the plan resolver choose the building, or does the published footprint
choose it for the resolver?

**Method**
- The 36-row copy matrix (4 development projects × 9 plan-copy subsets) went through the solver on the sealed
  evidence, in 8 conditions each: the footprint as published, withheld, and scaled ×0.80, ×0.88, ×0.90,
  ×1.10, ×1.12 and ×1.25.
- Nothing else changed. The evidence is `metric-evidence.json` taken as given, as in `analysis:second-house --metrics`.
- The harness names every run with one placeholder identity. So a "building" here is a model hash comparable
  only **within these tables**, not with the production hashes in `../../resolver/`.

**Files**
- `resolver-1.1.0.{md,json}`: the resolver as implemented before the Council, 288 runs.
- `resolver-1.2.0.{md,json}`: after the two rules below, 288 runs.

**Legend.** `R` resolved and `I` inconclusive. `F·…` is a failure, with the first words of its message. Where a
resolution was refused, the message begins with the first reading's own account.

## Result

| condition | 1.1.0 completed / resolved | 1.2.0 completed / resolved |
| --- | --- | --- |
| as published | 28 / 12 | 24 / 8 |
| withheld | 20 / 5 | 19 / 0 |
| ×0.80 | 9 / 9 | 0 / 0 |
| ×0.88 | 24 / 8 | 16 / 0 |
| ×0.90 | 24 / 8 | 16 / 0 |
| ×1.10 | 21 / 5 | 18 / 2 |
| ×1.12 | 19 / 3 | 17 / 1 |
| ×1.25 | 19 / 19 | 6 / 6 |

A decoy completion built as another building than the true figure gives, or where the true figure gives none:

| | count | the buildings |
| --- | --- | --- |
| **1.1.0** | **27** of 216 decoy cells | Kosaćce 198.4 m² (true 164.47) and Marcówki 146.4 m² (true 131.16) at ×1.25; G2E 153.7 m² (true 189.77) at ×0.8 |
| **1.2.0** | **8** | Marcówki `without-853D` at ×1.10 and ×1.12; e-OZE at ×1.25 in six subsets |

In 1.1.0:
- Every ×1.25 and ×0.8 completion was a resolution.
- The published figure first refused the correct first reading. The same figure then chose a replacement
  built to match it, on no other evidence. For example, "pocket mouths shut", AGREES with zero corroborations.
- With the footprint withheld, Marcówki `without-853D` resolved to 146.5 m² (true 130.8 m²). WALL_COVERAGE
  and ISOTROPY were enough for the no-figure rule.

## What changed (resolver 1.2.0)

1. **A corroboration is a witness the figure is not** (C §2, B §2, D §2):
   - WALL_COVERAGE is counted in pixels inside the box the bodies come from. It still ranks readings; it
     corroborates none.
   - ISOTROPY counts only for a scale the drawing's own long spans imply. The registration was fitted on the
     statements ISOTROPY re-tests.
   - CROSS_COPY is unchanged.
2. **A figure that refused the first reading is spent** (D §2, G §3a). It may still refuse any reading
   (WRONG). It no longer ranks or accepts one: every other reading scores UNKNOWN and needs two witnesses. The
   trace records `publishedFigure: SCORED | SPENT | NONE`.

## What this costs, measured

The cost is on the true figure: 28 → 24 completed rows.
- **Three of the four were wrong buildings.**
  - G2E `only-550D` and `without-853D`: 3 bodies at −17.6 %, where the house has 2 (C §2).
  - Kosaćce area copy alone: 171.0 m², its north wing about 2.1 m longer than the accepted reading (C §3).
- **The fourth was right.** e-OZE `without-853D`, 116.7 m². The figure had refused its first reading, so it may
  no longer also choose.

At ×0.88 and ×0.9, the correct e-OZE building (116.7 m², NEAR) and the correct Marcówki `without-853D` building
(130.8 m², NEAR) were accepted on WALL_COVERAGE or registration ISOTROPY. They are no longer accepted:
- 1.1.0 accepted right and wrong buildings on the same non-evidence;
- 1.2.0 accepts neither;
- a figure 10–12 % low now gives a named refusal on those houses, not the right house.

## What is left

**The figure choosing is not closed.** After a first reading that stops on the drawing (no walled envelope),
the figure still chooses among the readings the drawing supports:
- e-OZE's own resolution is one such case;
- the 8 remaining decoy completions are all of this kind.

**What is done about it**
- Such a result carries the LIMITING warning `LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`.
- The blind holdout's PASS predicate does not count its footprint agreement: `holdout/README.md` §5 requires a
  corroboration that is not the figure.

**Not measured here:** the shape families under decoys. No family row reaches the resolver's acceptance, as G
and D noted.
