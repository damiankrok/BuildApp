# 005K recommendation — the drawn-gap rule, and what comes next

## 1. The drawn-gap rule: INSUFFICIENT_EVIDENCE — it stays OFF

**Evidence base.** The fresh-sheet gap set (`gap-set-manifest.json`):
- sealed at `70aa0a4` before any label;
- labels sealed at `6672a89` before any evaluation;
- evaluated by `research/analyzer-005k/evaluate.mjs` into `gap-set-results.json` and `constant-control.json`.

**The labels are not human ground truth.** They come from blind sub-agents of this session's own model: two per gap,
and a third on the 4 disagreements. A and B agreed on 56 / 60, Cohen's κ 0.845.

### The adoption gate (`gap-set-protocol.md` §8, fixed before the draw)

| # | condition | result | evidence |
| --- | --- | --- | --- |
| 1 | Phase-0 UI evidence green | **holds** | run 37533180890, UI evidence gate on attempt 1 (`ui-evidence-preflight.md`) |
| 2 | per-gap evidence deterministic | **holds** | order invariance family A: 0 of 192 shuffled reads moved a record (`order-invariance.json`); unit determinism and translation tests |
| 3 | set sealed before evaluation | **holds** | manifest `70aa0a4` → labels `6672a89` → the first ON / CONSTANT replay after that; both seals pushed to the stage branch |
| 4 | ≥ 30 resolved negatives and ≥ 30 resolved OPENING | **fails** | OPENING 44, negatives **10** (OPEN 0, NOT_A_WALL_LINE 10), UNRESOLVED 6 |
| 5 | zero outcome-critical false bridges | holds | 1 false upgrade (q049, A00), and A00's outcome does not move under ON. 0 critical |
| 6 | no unexplained false upgrade on an open side, carport or porch | **not tested** | the population holds **no** OPEN negative at all; the condition is vacuous on this set |
| 7 | material safety advantage over CONSTANT | holds | rule 1 / 10 false upgrades, Wilson 95 % [0.018, 0.404]; CONSTANT 10 / 10 (point rate 1.0); upper bound 0.404 < 1.0 |
| 8 | no development verdict regression | holds | `development-matrix.json`: ON changes only dom-w-zurawkach's model, and its verdict does not change |
| 9 | no existing PASS house silently moves | holds | every development PASS keeps its hash under ON |
| 10 | every changed model hash source-supported and explained | holds | zurawkach: four upgraded gaps are printed windows (60/150 ×2, 180/130). Fresh A05: the failure code changes, driven only by six gaps labelled OPENING |
| 11 | non-circularity green | holds | `tests/architecture/gap-evidence.test.ts`, mutation M3 killed |
| 12 | council: no open P0 / P1 | see `post-review/` | |

**Verdict: INSUFFICIENT_EVIDENCE** (item 4).
- The rule stays OFF; production behaviour is unchanged.
- The observational per-gap records stay (boundary evidence 1.2.0, Evidence Pack 1.2.0).
- No safety item failed, so this is not a REJECT.
- What blocks adoption:
  - the set holds 10 resolved negatives where 30 are needed;
  - it holds no open-side negative at all, so the one safety question the rule exists to answer (does it close a porch,
    a carport or a recess mouth?) has **no** fresh evidence either way.

### What the set does show (descriptive, not an adoption claim)

| arm | upgraded | OPENING recall | false upgrades on negatives | outcome-critical |
| --- | --- | --- | --- | --- |
| BASELINE | 0 / 60 | 0 / 44 [0, 0.080] | 0 / 10 [0, 0.278] | 0 |
| CONSTANT (control) | 60 / 60 | 44 / 44 [0.920, 1] | 10 / 10 [0.723, 1] | 0 |
| DRAWN_RULE | 25 / 60 | 24 / 44 [0.401, 0.683] | 1 / 10 [0.018, 0.404] | 0 |

- **Which conditions do the work.**
  - Of the 20 OPENING gaps the rule leaves WEAK, 17 fail the jamb-ink condition alone (≥ 0.8 of the wall-solid layer at
    both jambs). Two fail jamb ink and the along-jamb test, and one fails the along-jamb test alone.
  - Of the 9 negatives the rule refuses, the along-jamb test refuses 8 (alone or with jamb ink). Jamb ink alone refuses
    one.
  - Safety on this set comes from "both jambs are stretches of this wall". The recall loss comes from the jamb-ink bar.
- **By drawn route.**

  | route | OPENING recall | false upgrades |
  | --- | --- | --- |
  | BEFORE_PATTERN | 16 / 20 | 0 / 1 |
  | WITHOUT_RUNS_PAST | 7 / 11 | 0 / 1 |
  | SIGNATURE | 1 / 13 | 1 / 8 |

  The plain-signature route holds most of the negatives (8 of 10): furniture fronts and wardrobe boxes inside rooms.
- **By publisher and density.** ARCHON: 35 OPENING / 6 negatives. DobreDomy: 9 / 4.
  - The FINE density group (< 0.02 m/px) is exactly DobreDomy's one read project (D00), so density and publisher
    cannot be separated on this set.
- **The rule's false upgrade.**
  - q049: a 1.69 m wardrobe front in a niche off a hall.
  - It was labelled NOT_A_WALL_LINE by majority. The A and B reviewers split NOT_A_WALL_LINE / OPEN, and C said
    NOT_A_WALL_LINE.
  - The baseline left it NOT_REACHED (interior). ON bridges it STRONG, and A00 still fails with the same code.
- **What the baseline does with the gaps the labels call OPENING.**
  - 22 are never reached by the outline.
  - 18 are treated as **pocket mouths** (the outline walks round them as recess mouths).
  - 4 are bridged weak.
  - The 18 pocket mouths are the baseline's real cost on this set. On A05, six true upgrades close them, and the strict
    outline goes from a refused 96.7 m² first reading to 122.5 m². The run still refuses, now as
    BOUNDARY_RESOLUTION_INCONCLUSIVE.

### What would settle it

A sealed set with ≥ 30 resolved negatives, **including open sides**. Drawing more projects at random will not get there:
- WALL/WALL drawn gaps are rarely open sides (0 of 60 here);
- open sides mostly have a POST or NONE jamb, which the rule already excludes.

A later stage could:
- (a) draw by a protocol that over-samples gaps whose drawn evidence crosses a terrace, a porch or a carport, declared
  before the draw; or
- (b) add a labelled OWNER channel for the negatives.

Neither is pressing (§2).

## 2. Next step: **FIX_STOREY_COUNT**

The first bad decision, counted on every run this stage made or replayed.

**The 14 fresh projects.** Live, rule OFF, with the external recogniser; now development material. Verdicts by
`holdout/verdict.mjs`:

| first failing decision | projects | impact |
| --- | --- | --- |
| upper storey not stacked: `STRUCTURAL_LAYOUT_PARTIAL` / `NO_MASS_REACHES_UP` (A06, D00 also `PLAN_STOREY_ALIGNMENT_FAILED`) | **3**: A06, A07, D00 | A06 and A07 fail **on storeys alone**: footprint +0.18 % and −0.37 %, every other predicate holds. D00 also fails footprint (−18.7 %) |
| plan resolution: the first reading covers a fraction of the building (30 / 147 m², 55 / 112 m², 97 / 126 m²) | 3: A00, A04, A05 | neither the drawn-gap rule nor the constant control moves A00 or A04. A05 moves from PLAN_ to BOUNDARY_RESOLUTION_INCONCLUSIVE and still fails |
| metric resolution: the floor plan prints no usable dimension chain | 5: D01–D05 (DobreDomy) | source-limited in substance: "a dimension printed on the floor plan itself — it prints none" |
| model emission refused a window fill (`FILL_TOO_LARGE`, placeWindow) | 1: A01 | a model-validation refusal after the boundary; its failure record carries no plan digest |
| — (PASS) | 2: A02, A03 | |

**The development matrix** (26 rows, 005J's diagnosis, unchanged by this stage):
- storeys block dom-w-gozdzikowcach (after its footprint) and dom-w-zurawkach;
- REC-17 / TOO_LARGE blocks dom-w-cyklamenach;
- the recessed-entrance relation blocks dom-pod-jarzabem.

**Why FIX_STOREY_COUNT.**
- It is the most frequent algorithmic first failure among the 9 fresh projects that are not source-limited: 3 of 9
  (`fresh-set-verdicts.json`).
- It is the only one that alone separates two otherwise-passing houses from PASS.
- It is also the most frequent verdict blocker in the development matrix.

**Why not the others.**

| alternative | why not now |
| --- | --- |
| `TRAIN_BUILDPLAN_WALL_MODEL` | the brief admits it only if the fresh set proves deterministic false bridges that matter. It found one false upgrade and zero that matter: there is no veto target |
| `FIX_REC17_TOO_LARGE` | one development house, none fresh |
| `FIX_RECESSED_ENTRANCE_BODY_RELATION` | one development house, none fresh |
| `PDFJS_VECTOR_EVIDENCE` | no fresh failure traced to raster-only evidence |
| `OTHER_MEASURED_RESIDUAL` | plan resolution (3 fresh) is real, but it is three different first readings, not yet one decision |
