# 005K council — Reviewer A (boundary topology)

**Verdict: CONDITIONAL PASS.** INSUFFICIENT_EVIDENCE with the rule OFF is the right reading, and nothing here blocks the stage. The recommendation does mis-explain A05 and zurawkach, and it claims a safety property the code does not have. The per-gap `outline` fate is wrong for a fifth of the labelled set. All numbers were recomputed from `gap-set-results.json`, the OFF/ON/CONSTANT digests and `development-matrix.json`. The probes ran outside the repository with `vite-node` against HEAD; the tree was unchanged by them.

## A1 (P1): the rule closes recess and porch mouths of up to 3.2 m
- No condition in `drawnGapCheck` (boundary-evidence.ts:560–569) reads what lies behind the gap. An upgraded gap is STRONG, so `solveOutline` never judges it. The rule therefore pre-empts the pocket rule, the one test that tells a doorway from a recess mouth.
- Each drawn route re-admits line work that 005C demoted on purpose:
  - WITHOUT_RUNS_PAST takes paving or kerb edges (:594–599, "decided by what lies behind it");
  - BEFORE_PATTERN takes treads and tiles (:581–583);
  - SIGNATURE takes a single face line under 2.2 m: a step, a slab edge, a balustrade, a wardrobe front.
- Where each condition can be fooled:
  - wallJambs stops posts only.
  - alongJambs is passed by construction by any recess or loggia set into a continuous facade (stretches of at least 1.25 walls).
  - withinLintel lets everything up to 3.2 m through.
  - jambInk tests drawing style, not topology.
  - inWallBand never refuses anything. Every drawn reading already has an infill stroke that is continuous and in the wall (:517, :566), so the brief's "inside the wall band, not terrace texture" condition is not implemented.
- Probe: a 2.0 × 1.5 m recessed porch in a continuous facade, and a projecting porch with front stubs.
  - With a step edge, a paving edge running past, or treads, all three go from POCKET_MOUTH (OFF) to BRIDGED_STRONG (ON).
  - The test suite's own 2.0 m "paving edge in front of a porch or a carport" (gap-evidence.test.ts:88–93) is upgraded under ON, and the test does not assert it.
  - The built area did not move in these synthetic cases, because the box's H0 doorway rule already shuts mouths of up to 3.2 m. In real runs a pocket flip does move the bodies and the model (A4).
- Fix:
  - Delete "open sides mostly have a POST or NONE jamb" (working-copy recommendation). Nothing measured it, and it is wrong for recess mouths.
  - State this closure path.
  - For any successor:
    - exclude baseline POCKET_MOUTH gaps, or send the rule's upgrades only into the alternative reading that shuts pocket mouths ("never as the first", plan-decomposition.ts:303–306);
    - make inWallBand a real condition;
    - restrict SIGNATURE. On this set it recovers 1/13 OPENING, that one (q011) was already BRIDGED_WEAK, and the route carries the only false upgrade.

## A2 (P2): Q2. Yes, the safety question is untested. INSUFFICIENT_EVIDENCE, not ADOPT, is correct
- All 60 rows already pass wallJambs, withinLintel, drawn and inWallBand. On this set only alongJambs and jambInk can refuse.
- 9 of the 10 negatives are NOT_REACHED interior lines, where an upgrade cannot change the EXCLUSION outline.
- In the one stratum where an upgrade moves the outline (baseline POCKET_MOUTH: 18 OPENING, 1 NOT_A_WALL_LINE, 2 UNRESOLVED), the rule makes 11 upgrades, all OPENING. It refuses q043 by alongJambs. That is 0/1 false upgrades, Wilson [0, 0.79].
- q049 is a niche mouth closed via SIGNATURE: the failure mode itself, interior only by position.
  - It is one of three parallel readings of the same niche (x441, x450, x457), and only the line on the wall's axis passes alongJambs.
  - The outline closes if any one parallel reading is STRONG, so count per physical span with OR: 45 spans, 8 of them negative. The rule falsely upgrades 1 of those 8, Wilson [0.022, 0.471].
- The next draw should stratify on POCKET_MOUTH ∧ drawn, declared before the draw.
- Minor: the negatives are "A00 4, D00 4", not 6 and 2.

## A3 (P1): Q3. The A05 explanation is wrong
- Of the six upgrades, only q010 (X-806) and q030 (Y-622) were pocket mouths. q054, q045, q055 and q039 were NOT_REACHED; q055 is q030's twin on Y-634.
- 96.73 m² is the first reading's coverage, and it is unchanged under ON. On the selected decomposition:

  | | strict | exclusion | disagree |
  | --- | --- | --- | --- |
  | OFF | 105.51 m² | 104.99 m² | false |
  | ON | 122.47 m² | 104.99 m² | **true** (17.49 > 7.35) |

- So the new code comes from the two-policy check.
- EXCLUSION always encloses at least as much as STRICT. `adopt()` still accepts in STRICT a part beyond the box that it rejects in EXCLUSION, because it needs an unclosed edge to the box (plan-decomposition.ts:2916–2920). For example, the bay behind q010 joins the room across the 2.79 m blank gap X-758:
  - under OFF, X-758 was BRIDGED_WEAK;
  - under ON it is an unjudged weak bridge, so it is open in STRICT and a wall in EXCLUSION.
- The best reading moved from 124.2 m² to 116.1 m².
- The rule also lets upgrades count as "drawn" in STRICT and in completion's `strictEncloses`/`policiesAgree` (boundary-completion.ts:457, 491–492). The two-policy check stops being independent for exactly the gaps the rule decides.
- Fix: rewrite the sentence. Any successor should keep rule upgrades out of STRICT.

## A4 (P1): Q3. zurawkach: "explained" (gate item 10) is not established
- Seven records were upgraded: four physical spans (X-780/792, Y-95/104 ×2, X-260), not "four gaps".
- The slabs changed from 7.5×8.0 + 4.30×9.5 (100.88 m²) to 11.80×8.0 + 3.71×1.5 (99.99 m²).
- A 0.59 × 1.5 m corner (x 7.50–8.09, z 0–1.5; 0.89 m²) left the building, while the EXCLUSION outline grew by 1.85 m² (three RECESSED_ATTACHED pockets closed).
- Windows went 3 → 5, walls 13 → 15, rooms 5 → 6.
- An upgrade that only closes openings removed floor area, and nothing explains it.
- `firstChangedDecision` (X-260, BRIDGED_WEAK → STRONG) is first only in canonical order. It changes no EXCLUSION edge.
- Fix: explain the corner from the source, or mark item 10 not established.

## A5 (P1): Q4. The `outline` fate is wrong, and jambs and pockets cannot be replayed
- `fate()` (gap-evidence.ts:127–128) is wrong in three ways:
  - It labels as NOT_REACHED the weak gaps past `MAX_WEAK_GAPS` = 48, which `solveOutline` never judges and bridges by default (boundary-outline.ts:107, 190). That covers 12 of the 60 labelled records, 10 of them OPENING, including 6 of the rule's 25 upgrades (A00 OFF has 79 weak gaps). So "22 never reached" includes 10 that were bridged.
  - It labels BRIDGED_STRONG for every STRONG gap anywhere (q049 included).
  - X-758 reads NOT_REACHED ("irrelevant to the outline", boundary-outline.ts:64), yet it decides A05.
- Records lack:
  - `exposedM2`/`limitM2`;
  - per-jamb axis and piece extent, so the jambInk window and the 1.25-wall test cannot be replayed;
  - per-stroke flags; inWall and continuous are counted separately, so inWallBand cannot be recomputed;
  - the STRICT fate.
- Only one decomposition is recorded: on A05 that is 1 of the 23 weighed.
- Fix:
  - export the judged set and the over-budget set from `solveOutline`;
  - add OVER_BUDGET / INTERIOR / EXTERIOR / STRONG_ON_OUTLINE fates, the pocket numbers, jamb geometry, stroke tuples and the strict fate (boundary evidence 1.3.0);
  - or state these limits in `gap-evidence-schema.md`.

## A6 (P1, stating it is enough): Q5. The fixtures miss the cases that matter
- M1, M2 and the post fixture are sound.
- The room fixture (:146–157) is 5.4 m wide, so it is decided by WALL_STOPS_WIDER_THAN_LINTEL. Its `if` guards skip every assertion about the rule. Two cross-sections can never make a WEAK gap anyway (:608).
- No test has alongJambs as its only refusal, and no mutation removes it. Yet alongJambs did 8 of the 9 refusals on the fresh set.
- Missing fixtures:
  1. One wall stretch plus one crossing wall, ≤ 3.2 m, with a face line. The probe shows it is refused by alongJambs alone. Add a mutation M6 that removes alongJambs.
  2. An outline-level recess or porch for each route, asserting the intended ON fate.
  3. An ON assertion on the 2.0 m paving-edge case.
