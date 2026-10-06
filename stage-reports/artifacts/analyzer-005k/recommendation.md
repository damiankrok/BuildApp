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
| 2 | per-gap evidence deterministic | **holds, for the source as enumerated** | family A: 0 of 192 shuffled reads of copies, callouts, observations and registrations moved a record. Family B: the dimension-chain order moved the decomposition grid (`gridLines`, upstream and pre-existing) on 83 of 192 shuffles across 13 of 24 rows; it never moved a record on an unchanged grid. The records are deterministic but not invariant to chain order, and the sealed keys are pinned to the current chain order (council C2) |
| 3 | set sealed before evaluation | **holds** | manifest `70aa0a4` → labels `6672a89` → the first ON / CONSTANT replay after that; both seals pushed to the stage branch |
| 4 | ≥ 30 resolved negatives and ≥ 30 resolved OPENING | **fails** | OPENING 44, negatives **10** (OPEN 0, NOT_A_WALL_LINE 10), UNRESOLVED 6 |
| 5 | zero outcome-critical false bridges | holds — **uninformative** | 1 false upgrade (q049, A00), and A00's outcome does not move under ON. 0 critical. CONSTANT also has 0, so the item does not separate the rule from the naive control on this set (council B1) |
| 6 | no unexplained false upgrade on an open side, carport or porch | **not tested** | the population holds **no** OPEN negative at all; the condition is vacuous on this set |
| 7 | material safety advantage over CONSTANT | holds — **uninformative** | rule 1 / 10 false upgrades, Wilson 95 % [0.018, 0.404]; CONSTANT 10 / 10 (point rate 1.0). CONSTANT's rate is 1.0 by construction, so any rule that refuses a single negative passes at any n (9 / 10 would too: upper bound 0.982). The item as written carries no information (council B1) |
| 8 | no development verdict regression | holds | `development-matrix.json`: ON changes only dom-w-zurawkach's model, and its verdict does not change |
| 9 | no existing PASS house silently moves | holds | every development PASS keeps its hash under ON |
| 10 | every changed model hash source-supported and explained | **not established** | zurawkach: seven upgraded records, four physical spans (printed windows 60/150 ×2, 180/130, and X-260). The upgrades close three RECESSED_ATTACHED pockets (exclusion outline +1.85 m²), yet a 0.59 × 1.5 m corner (0.89 m²) leaves the building: footprint 100.88 → 99.99 m². An upgrade that only closes openings removed floor area, and that is unexplained (council A4). Fresh A05: see below (A3) |
| 11 | non-circularity green | holds | `tests/architecture/gap-evidence.test.ts`, mutation M3 killed |
| 12 | council: no open P0 / P1 | holds | four reviewers: 1 P0 (D1, fixed), 12 P1 (fixed or stated); `post-review/resolution.md` |

**Verdict: INSUFFICIENT_EVIDENCE** (item 4).
- The rule stays OFF; production behaviour is unchanged.
- The observational per-gap records stay (boundary evidence 1.2.0, Evidence Pack 1.2.0).
- **There is no safety evidence either way.**
  - Items 5 and 7 hold but cannot fail usefully here; item 6 is untested.
  - "Not a REJECT" rests on one 2-of-3 AI vote. q049 was voted NOT_A_WALL_LINE 0.55 / **OPEN** 0.50 / NOT_A_WALL_LINE
    0.55. With the B reviewer's reading it would be an open-side false upgrade, and item 6 would fail.
  - The protocol does not say which verdict wins when item 4 and a safety item both fail. On this set none failed, so
    INSUFFICIENT_EVIDENCE is the verdict the protocol gives; the precedence is a gap for the next protocol.
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
  - The baseline left it unjudged (interior). ON makes it STRONG, and A00 still fails with the same code.
  - It is the mouth of a niche, a recess, closed by the plain-signature route: the failure mode the rule is suspected of,
    interior only by position.
  - It is one of three parallel readings of that niche (q001, q049, q058). Only the reading on the wall's axis passes
    the along-jamb test, and the outline closes if any one of them is STRONG.
  - Counted per physical span, with OR across parallel readings: 45 spans, 8 of them negative, and the rule falsely
    upgrades 1 of 8 (Wilson [0.022, 0.471]) (council A2).
- **What the baseline does with the gaps the labels call OPENING.** The outline fate is corrected for the 48-gap judging
  budget (council A5). The record's `outline` field says NOT_REACHED for weak gaps past the budget, which
  `solveOutline` never judges and leaves bridged.
  - 18 are treated as **pocket mouths**: the outline walks round them as recess mouths.
  - 12 are never reached by the outline's flood: interior.
  - 10 are past the judging budget, bridged by default. All are on A00, which has 79 weak gaps.
  - 4 are bridged weak.
  - The 18 pocket mouths are the baseline's real cost on this set.
- **A05, corrected (council A3).**
  - Of the six upgrades, two were pocket mouths (q010, q030) and four were never reached. q055 is q030's span on a
    parallel line.
  - The refused first reading (96.73 m²) is unchanged under ON.
  - What changes is the selected decomposition's strict outline: 105.51 → 122.47 m², while the exclusion outline stays
    at 104.99 m².
  - The two policies now disagree by more than 6 % (17.49 m² against 7.35 m²), and that check produces
    BOUNDARY_RESOLUTION_INCONCLUSIVE.
  - Cause: `adopt()` needs an unclosed edge to the box. The 2.79 m blank gap X-758 behind q010 is open in STRICT and an
    unjudged weak bridge in EXCLUSION. STRICT therefore accepts the bay that EXCLUSION walls off.
  - The rule also makes STRICT, the "drawn openings only" check, and completion's `policiesAgree` count its upgrades as
    drawn openings. They no longer check those gaps independently.
- **The known closure path (council A1).** The rule can close a recess, porch or loggia mouth up to 3.2 m:
  - none of its six conditions reads what lies behind a gap, and an upgraded gap is STRONG, so `solveOutline` never
    judges it. The rule pre-empts the pocket rule, the one test that tells a doorway from a recess mouth;
  - each drawn route re-admits line work that 005C demoted on purpose. WITHOUT_RUNS_PAST takes paving or kerb edges,
    BEFORE_PATTERN takes treads and tiles, and SIGNATURE takes a single face line (a step, a slab edge, a balustrade, a
    wardrobe front);
  - the along-jamb test is passed by any recess set into a continuous facade;
  - the in-wall-band condition never refuses: every drawn reading already has a continuous in-wall stroke. The brief's
    "inside the wall band, not terrace texture" is therefore not implemented;
  - council A's probes outside the repository (a recessed and a projecting porch, 2.0 × 1.5 m, with a step edge, a
    paving edge running past, or treads) all flip POCKET_MOUTH → BRIDGED_STRONG under ON. A blank mouth does not;
  - the unit suite now asserts the 2.0 m paving-edge case is closed under ON, so a successor that closes this path
    changes that expectation on purpose.
- **What a successor rule needs, before any new set is drawn:**
  - keep upgrades out of gaps whose baseline fate is POCKET_MOUTH, or send them only into the alternative reading that
    shuts pocket mouths ("never as the first");
  - make the in-wall-band condition real;
  - restrict the SIGNATURE route: 1 / 13 OPENING here, and it carries the only false upgrade;
  - keep rule upgrades out of STRICT and completion's agreement check.

### Effective sample size (council B6)

- 8 of the 10 negatives come from two houses: A00 (4) and D00 (4).
- Two pairs are the same span read on parallel lines: q001 / q049, and q013 / q029. The one false upgrade, q049, is the
  twin of q001, which the rule refuses.
- The Wilson intervals assume independent gaps, so they are anti-conservative here.

### What would settle it

A sealed set with ≥ 30 resolved negatives, **including open sides**.
- **Negatives in general.** At this set's yield (10 negatives from 8 read projects), 30 need about 24 read projects,
  about 42 drawn. That is reachable by drawing more, but not by extending this draw after its results were seen.
- **Open sides.** Random draws are unlikely to get there: no WALL/WALL drawn gap in this set was labelled an open side
  (0 of 60, upper bound 0.060). The earlier claim that "open sides mostly have a POST or NONE jamb" was not measured, and it
  is false for recess and porch mouths set into a continuous facade (council A1).

A later stage could:
- (a) draw by a protocol that over-samples gaps whose drawn evidence crosses a terrace, a porch or a carport, declared
  before the draw; or
- (b) add a labelled OWNER channel for the negatives.

Either way the next protocol should:
- name the seed commit in advance (council B3);
- gate a DobreDomy draw on a printed dimension chain (B5);
- count negatives per house or per distinct feature (B6);
- replace item 7 with an absolute bound. 0 / n is below 0.10 only from n ≥ 35, and 0 / 30 gives 0.114 (B1).

Neither is pressing (§2).

## 2. Next step: **FIX_STOREY_COUNT**

The first bad decision, counted on every run this stage made or replayed.

**The 14 fresh projects.** Live, rule OFF, with the external recogniser; now development material. Verdicts by
`holdout/verdict.mjs`:

Each project's first decision that did not pass, read from its `analysis-trace.json` in order (corrected after council
B2):

| first failing decision | projects | impact |
| --- | --- | --- |
| upper storey not stacked: `STRUCTURAL_LAYOUT_PARTIAL` / `NO_MASS_REACHES_UP` (A01 and A06 also `PLAN_STOREY_ALIGNMENT_FAILED`) | **3**: A01, A06, A07 | A06 and A07 fail **on storeys alone**: footprint +0.18 % and −0.37 %, every other predicate holds. A01 then fails at model emission (`FILL_TOO_LARGE`, placeWindow), so its run records no plan digest |
| storeys and footprint together (the metric challenge keeps a −18.7 % reading; the gate lists `FOOTPRINT_AREA_NEAR` before `NO_MASS_REACHES_UP`) | 1: D00 | co-first: storeys + footprint |
| plan resolution: the first reading covers a fraction of the building (30 / 147 m², 55 / 112 m², 97 / 126 m²) | 3: A00, A04, A05 | neither the drawn-gap rule nor the constant control moves A00 or A04. A05 moves from PLAN_ to BOUNDARY_RESOLUTION_INCONCLUSIVE and still fails |
| metric resolution: the floor plan prints no usable dimension chain | 5: D01–D05 (DobreDomy) | `verdict.mjs` calls these ALGORITHMIC_FAIL. They are treated here as **source-limited by judgment**: D03–D05's messages say the plan prints no dimension; D01 and D02 report dimension lines, but reviewer B viewed the D01–D03 rasters and none prints a dimension chain |
| — (PASS) | 2: A02, A03 | |

**The development matrix** (26 rows, 005J's diagnosis, unchanged by this stage):
- storeys block dom-w-gozdzikowcach (after its footprint) and dom-w-zurawkach;
- REC-17 / TOO_LARGE blocks dom-w-cyklamenach;
- the recessed-entrance relation blocks dom-pod-jarzabem.

**Why FIX_STOREY_COUNT.**
- **The decisive argument: it is the only first failure that alone separates otherwise-passing houses from PASS.**
  A06 and A07 have every other predicate holding.
- By frequency it leads only narrowly. Among the 9 fresh projects not judged source-limited, storeys are first on 3
  (4 with D00 co-first) against 3 for plan resolution (`fresh-set-verdicts.json`).
- It is also the most frequent verdict blocker in the development matrix (005J).

**Why not the others.**

| alternative | why not now |
| --- | --- |
| `TRAIN_BUILDPLAN_WALL_MODEL` | the brief admits it only if the fresh set proves deterministic false bridges that matter. It found one false upgrade and zero that matter: there is no veto target |
| `FIX_REC17_TOO_LARGE` | one development house, none fresh |
| `FIX_RECESSED_ENTRANCE_BODY_RELATION` | one development house, none fresh |
| `PDFJS_VECTOR_EVIDENCE` | no fresh failure traced to raster-only evidence |
| `OTHER_MEASURED_RESIDUAL` | plan resolution (3 fresh) is real, but it is three different first readings, not yet one decision |
