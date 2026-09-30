# BUILDPLAN-ANALYZER-005B precheck, Reviewer B: scale and evidence independence

- **Branch read:** `analyzer/dimension-evidence-refoundation-v1` at HEAD `bdacd42`. This review changed no code.
- **Line numbers refer to HEAD.**
  - While this review ran (08:16–08:25 UTC), another party edited the working tree: `source-metrics/src/ocr.ts`,
    `schema.ts`, `hash.ts` and `chains.ts`.
  - `chains.ts` gained one import at line 29, and `assignTokens` now uses `textAxisOf`. In the working tree, every
    `chains.ts` line number cited here above 29 is therefore **one higher (+1)**.
  - Every measurement ran on the HEAD versions of `chains.ts`, `parse.ts`, `registration.ts`, `extract.ts` and
    `plan-resolution.ts`. The last run started before the `chains.ts` edit.
- **Inputs:**
  - `STAGE_BUILDPLAN_ANALYZER_005A_GENERALIZATION_COUNCIL.md`, sections J, L, N, O, W, Z, AA and AD;
  - `council/pre/03-assumption-register.md`, ASSUMP-SCALE-001 and ASSUMP-DIMENSION-001;
  - the sealed `metric-evidence.json` of h1, h2, e-OZE and Kosaćce-clean (005A);
  - two older sealed sets. The current code reproduces both (see the Method appendix):
    - `analyzer-v2/marcowki-metrics.json`;
    - `rarytasy-generalization/post-fix/metric-evidence.json`, which is G2E.
- **Independence.** This review did not read the other reviewers' files.

## Verdict in one paragraph

The frame scale does not come from a set of independent witnesses. It is a vote over a set of readings that
the reader's substitution lattice inflates. Whichever scale wins, the chain solver then rewrites numbers to fit
it, and those rewrites become the registration's anchors. The registration refits the vote's own selections:
**0 of 120 anchors were rejected** across the four 005A sealed sets.

On the blind house h1, the ground plan's scale of 1.892 cm/px comes **entirely** from rewritten numbers:
- 3 of 3 vote members were substituted readings;
- 6 of 6 registration anchors are `CHAIN_CORRECTED`;
- the reading made without substitutions supports **no** scale on that sheet.

On e-OZE, the substitution `1601→1801` outvotes its own raw reading, 8.937 against 8.408, and only because a
38.5 px span triggers the ×1.5 cross-chain bonus. The raw-only vote returns 2.2236 cm/px, the scale section J
says is right.

On the houses that work (Kosaćce, Miranda ground, Marcówki), the raw readings alone give the same scale within
0.03 %. There the rewrites are decoration.

The resolver's lattice cannot repair the defect, because it only sees statements that the pooled-scale solver
already emitted. Every number the pooled scale refused is invisible to it: 17 of 23 chain numbers on the h1
ground plan.

The next stage needs a scale solver whose witnesses are independence groups of raw readings, in which a
correction is never evidence for the scale that produced it.

---

## 1. Findings

Severity:
- **P0:** it produces a wrong building, or blocks recovery of the right one, with no warning.
- **P1:** it corrupts evidence, confidence or provenance, or it enables P0 on other sheets.
- **P2:** hygiene or latent.

### P0

**F1. Substituted readings vote in the pooled scale at nearly full weight. The vote charges no price for a substitution.**
- **The code path:**
  - `chains.ts:217-223`: every lattice string enters `readings`;
  - `chains.ts:307-336`: `proposalsOf` turns each one into a proposal;
  - `chains.ts:326`: the weight is `reading.confidence × token.confidence × px / 50`;
  - `parse.ts:147-148`: `reading.confidence` is just the runner-up's score ratio, often 0.6–1.0.
  - `parse.ts:168-170`: a two-glyph substitution gets `× 0.9` only.
- **The contrast.** The chain solver charges a substitution `0.45^subs` (`chains.ts:722`), but only after the
  scale is already fixed. The vote that fixes the scale does not charge it.
- **Seeding.** `voteScale` (`chains.ts:485-489`) and `scaleCandidates` (`chains.ts:428`) seed from every
  proposal, substitutions included. A substituted reading can therefore seed its own scale and be its own largest
  member.
- **h1, 853 px ground plan (measured).** The winning replacement, 1.892003 cm/px, has 3 members and 0 of them are
  unsubstituted:
  - `"006"→"806"` over 426 px;
  - `"501"→"107"` over 57.5 px (2 substitutions);
  - `"25"→"83"` over 42 px (2 substitutions).
- **The lattice manufactures agreement.** Averaged over 162 log-spaced scales from 1 to 5 cm/px, this is how
  many numbers agree with a random scale:

  | house (sheet) | substitution lattice | raw readings | numbers on the sheet |
  | --- | ---: | ---: | ---: |
  | h1 | 1.43 | 0.40 | 18 |
  | e-OZE | 1.54 | 0.34 | 13 |
  | G2E | 1.38 | 0.10 | 14 |

**F2. `CHAIN_CORRECTED` segments anchor the registration, and the registration is the vote refitted.**
- **The comment and the code disagree.** `extract.ts:771-774` says "Only a segment whose number was actually READ
  anchors a registration". `extract.ts:775` admits every origin except `DERIVED`.
- **The anchors are already selected.** They were picked at the pooled scale, within 2.2 px (`chains.ts:630`,
  `:703`). `fitAxis` (`registration.ts:74-120`) therefore re-derives that same scale, and its outlier rejection
  never fires. Across the four 005A sets, 0 of 120 anchors were rejected.
- **The confidence counts rewrites.** `registration.ts:166` counts anchors whatever their origin and however
  independent they are. So more rewrites give more confidence:
  - h1's ground plan: 6 of 6 rewrites, confidence 0.857;
  - Miranda's UPPER plan: 8 of 8 rewrites, confidence 0.830.
- **How common this is.** `CHAIN_CORRECTED` share of all plan anchors:

  | house | corrected / all anchors | share |
  | --- | ---: | ---: |
  | h1 | 22 / 28 | 78.6 % |
  | h2 | 20 / 29 | 69.0 % |
  | e-OZE | 15 / 24 | 62.5 % |
  | Kosaćce | 25 / 35 | 71.4 % |
  | Marcówki (older run) | 27 / 37 | 73.0 % |
  | G2E (older run) | 18 / 23 | 78.3 % |

**F3. The replacement rule for a "scale the sheet states" is met by readings the sheet does not state.**
- **The rule.** `decideScale` (`chains.ts:563-591`) takes a replacement only when "at least three numbers, on at
  least two chains, agree on it" (`:580`). Nothing asks those numbers to have been read.
- **h1.** The plausibility filter ruled out the winner, 3.6535 cm/px: 22 px walls would be 0.8038 m. The
  replacement, 1.892003 cm/px, qualified on 3 numbers over 3 chains, all three of them substitutions.
- **The attic.** The same happened on h1's attic plan (`d52f958fd6`): 4.724 was replaced by 2.965 on 4 numbers,
  and 5 of the 6 anchors are corrected.

**F4. The resolver's lattice scales see only the survivors of the pooled scale, so they cannot contradict it.**
- **How it sees the drawing.**
  - `statementsOn` (`plan-resolution.ts:157-174`) reads only segments with evidence of origin `READ` or
    `CHAIN_CORRECTED`.
  - A number the pooled scale refused becomes an `UNRESOLVED` segment with no evidence. `extract.ts:725` does not
    add it to the evidence, and `usedTokens` is not set, so it drops out as an orphan token.
  - The cut positions are also chosen at the pooled scale (`chains.ts:690`, tick skipping).
- **Measured: numbers dropped at the pooled scale, invisible to the resolver.**

  | frame | numbers dropped | on chains | what was lost |
  | --- | ---: | ---: | --- |
  | h1, 853 px ground | 17 | 23 | — |
  | e-OZE, 853 px | 11 | 20 | — |
  | Kosaćce, 853 px | 14 | 31 | — |
  | Miranda, 853 px ground | 13 | 19 | `"0111"` over 526 px and `"036"` over 343 px: the upside-down 1410 and 920 that carry the missing depth (section AA) |

- **Leading zeros become scales.** The lattice turns a leading-zero first reading into a scale:
  - `/^\d{2,5}$/` accepts `"006"` (`:169`), which makes 6 cm;
  - with the sealed h1 evidence, `latticeScales` returns **0.014085 cm/px**, from 6 cm over 426 px, and
    3.081 cm/px. Neither is near 2.11.
  - There is no plausibility check on a lattice scale (`:195-221`).
- **Consequence.** Section AA says the resolver "carries the overall chains' own lattice scales". Structurally it
  cannot find a scale that no surviving statement implies.

### P1

**F5. The multiplicative cross-chain bonus lets a 38.5 px span decide between two readings of the same ink.**
- **The rule.** `supportFor` (`chains.ts:395`) multiplies the whole weight by `1 + 0.5(chains − 1)`.
- **e-OZE, `b747b42ad2`, measured:**

  | scale | members | computation | weight |
  | --- | --- | --- | ---: |
  | 2.5014 (the rewrite `"1801"`) | the rewrite, plus `"100"` over 38.5 px, which misses by 1.48 px and implies 2.597 (+16.8 % off the truth) | (5.510 + 0.450) × 1.5 | 8.937 |
  | 2.2236 (the raw `"1601"`) | the raw reading alone | — | 8.408 |

- **The consequence.** Ink that exists once supports both hypotheses, and the bonus is paid for a single short
  span.
- **The register already names it.** ASSUMP-SCALE-001, "multiplicative corroboration bonus".

**F6. Leading-zero strings are admitted as centimetres, both as values and as lattice seeds.**
- **Where.** `parse.ts:106-111` accepts any 2–4 digit string. A dimension chain never prints a leading zero; one
  is the fingerprint of a label read upside down.
- **Measured: corrected anchors whose raw text starts with `0`.** No `READ` anchor in any set has a leading zero.

  | house | corrected anchors starting with `0` |
  | --- | ---: |
  | h1 | 4 of 22 |
  | e-OZE | 4 of 15 |
  | Kosaćce | 5 of 25 |
  | Miranda | 2 of 20 |

- **What the lattice "repairs".**
  - Single substitutions: `"006"→"806"`, `"000"→"400"/"600"`, `"015"→"315"`, `"080"→"480"`, `"051"→"431"`.
  - Two substitutions: `"005"→"665"`.

**F7. The vote's winner needs no minimum support; a replacement needs three numbers on two chains.**
- **Where.**
  - `chains.ts:488` takes the heaviest vote;
  - `chains.ts:577` accepts it if plausible;
  - `chains.ts:580` holds the replacement to the stricter rule.
- **Measured over the 22 registered plan frames of the 005A sets:**
  - 14 frames adopted a scale supported by at most 3 numbers;
  - 6 frames adopted one supported by 2, including e-OZE's 853 px dimensioned copy.
- **With the substitutions removed,** several frames' winners rest on a single number (see the Measurements).

**F8. The per-axis scales are not independent, and the measured isotropy is manufactured.**
- **`refineAxis`.** In `chains.ts:517-543`:
  - with fewer than 2 inliers, it returns the pooled scale (`:529`);
  - it may not move more than 5 % from it (`:538`).
- **h1, 853 px ground plan.** The horizontal axis had **0** vote inliers, yet the registration shows X "measured"
  at 1.8817 from three corrected anchors: `46→96`, `170→120` and `513→313`. `solveChain` chose them to fit the
  pooled scale, which came from the vertical axis. The registration reports both axes measured, anisotropy
  1.005 (`registration.ts:155-156`), and does not add the square-pixel note (`:185`).
- **The same `513` reading lands on different spans.** In the vote it is `"313"` over 85.5 px (3.661 cm/px); in
  the final cut it is `"313"` over 166.5 px (1.880). `solveChain` may skip up to 3 ticks (`chains.ts:690`).
- **Downstream.** Anisotropy up to 1.117 is accepted silently: h2 `dac34cc718`, and Kosaćce's 400 px copy at
  1.096. The resolver refuses only above 1.15 (`plan-resolution.ts:325`).

**F9. The registration takes inlier COUNT before weight, with a tolerance in pixels.**
- **The rule.** `registration.ts:102` prefers inlier count; `:124` sets the tolerance to 3 px, which is:
  - ±5–7 % on a 45–60 px span;
  - ±0.5 % on a 550 px span.
- **Consequence.** Many short, imprecise spans outvote one long, precise one.
- **Demonstrated with `registerFrame` (test T3 below).** Five short anchors near 1.79 cm/px outnumber one 550 px
  `READ` of `1100` at 2.00 cm/px:
  - X is registered at **1.7875**;
  - the long overall dimension is **rejected**, with a 1.17 m residual;
  - anisotropy is 1.119, at confidence 0.895;
  - nothing fails.
- **Why it is latent today.** Anchors are pre-filtered (F2). It becomes live the moment anchors come from
  anywhere independent.

**F10. `DERIVED` values and chain closure are licensed by rewrites, and reach the building as `MEASURED`.**
- **The licence.**
  - `solveChain` fills blanks when `residualPx ≤ tol/2` (`chains.ts:800`).
  - A corrected reading has a residual near 0 by construction: `"806"` misses by 0.000151 m.
  - So on h1 it licensed the 180.5 px span as `DERIVED` = 341.5 cm. At the printed overall scale that span is
    about 3.8 m.
- **Measured.**
  - DERIVED segments that sit on chains whose only fitted readings are `CHAIN_CORRECTED`:

    | house | DERIVED segments licensed only by rewrites |
    | --- | ---: |
    | h1 | 59 of 65 |
    | h2 | 49 of 51 |
    | e-OZE | 12 of 14 |
    | Kosaćce | 11 of 29 |

  - Chains marked `closes` (`extract.ts:793`) that have no `READ` segment: h1 12 of 17; h2 12 of 17.
- **Downstream.**
  - `axisLadder` (`layout.ts:637-712`) sums any segment with a value (`:653-662`) and marks the span `stated`.
  - `basisOf` then labels it `MEASURED` (`layout.ts:1097`).
  - Two chains derived at the same pooled scale "agree" within 2 cm (`:703`), which shrinks the spread to 0.01 m
    (`:1094`). That is circular agreement.

**F11. Copies of the same drawing count as independent corroboration.**
- **The same misreading is made twice.** Sibling copies of the same content carry identical rewrites:
  - Kosaćce `94f54ada01` and `f530d6ebf2` share `1000→1660` (690 px), `005→665`, `111→521` and `840→890`;
  - e-OZE `2abfc5825d` and `b747b42ad2` share `1601→1801` (720 px).
- **The consumers treat them as independent.**
  - `statedSpans` (`layout-gate.ts:72-96`) counts any other frame's chain, `READ` or `CHAIN_CORRECTED`, with total
    `printedTotal ?? derivedTotalCm`, as "a second drawing". Its docstring (`:75-78`) claims this is "not the same
    reading counted twice".
  - CROSS_COPY (`plan-resolution.ts:353`, `:494-498`) compares siblings' extents at their registered scales,
    which come from the same mechanism.

**F12. Under a lattice scale, the resolver rereads statements with the same substitutions.**
- **Where.** `metricsAtScale` (`plan-resolution.ts:254-258`) re-reads a statement from `firstReadCm`, then from
  `e.alternatives`, which are the chain solver's rejected lattice strings.
- **Consequence.** A lattice scale lowers its own `refutedShare`, ranking key 4, by fitting substitutions to itself.
  This is the same self-fit as F1, pointed at the hypothesis under test.
- **What is already right.** 005A labels those spans `DERIVED` (`layout.ts:1096`), but the ranking still profits.

**F13. The overall dimension loses its number to a stray token.**
- **The rule.** `assignTokens` hands out numbers nearest first, one per chain interval (`chains.ts:237-248`).
- **h1, measured.** A `"14"` sits 0.64 text heights from the single-interval 519 px overall chain, at
  `[83.5, 602.5]`; `"1100"` sits 0.82 heights away. The `"14"` claims the interval, although it has no centred
  span there (`spansFor`, `:368`).
- **Consequence.** `"1100"` is never assigned and never votes. It is the only raw witness of 2.11 cm/px on that
  frame.

**F14. Two copies of the same storey that disagree on scale are never compared.**
- **Where.** `scaleConflicts` (`extract.ts:846-878`) compares only variants of one asset.
- **Measured, 853 px sheets:**

  | house and storey | copy | scale (cm/px) | anchors rewritten |
  | --- | --- | ---: | --- |
  | Miranda UPPER | `07b69dcbb8` | 3.4537 | 8 of 8 |
  | Miranda UPPER | `dac34cc718` | 1.0400 | — |
  | h1 ATTIC | — | 2.97 | 5 of 6 |
  | h1 GROUND | — | 1.88 (printed truth 2.11) | — |

  Marcówki (older run): ATTIC 4.694 and 1.0386, GROUND 2.6425.
- **The truth for the attic and upper copies is NOT MEASURED.** Of Miranda's two UPPER copies (3.3× apart), at
  most one can be right.
- **The ratio is used as fact.** `layout.ts:458-465` takes the ratio of two storeys' registrations as "the scale
  both plans print on their own chains".

### P2

**F15. `rawText` holds the corrected reading on chain evidence, against the schema.**
- **The schema says:**
  - `schema.ts:14-17`: "rawText is what the reader saw, before … chain arithmetic corrected it";
  - `schema.ts:77`: "the original reading survives in `rawText`".
- **The code does:**
  - `extract.ts:744`: `rawText: segment.text`, the corrected reading;
  - level evidence keeps the token text (`extract.ts:531`). The two kinds of evidence use opposite meanings.
- **Consequence.** The resolver has to go back to `ocrTokens` to recover the first reading
  (`plan-resolution.ts:167-169`).

**F16. The plausibility filter is a coarse veto, and its limits disagree with the layout's.**
- **The band.** `PLAN_OUTER_WALL_M` is 0.15–0.8 m (`extract.ts:104`). For 22 px walls that admits
  0.68–3.64 cm/px, so the filter cannot tell 1.89 from 2.11.
- **The limits disagree.** The resolver's hard limit is 0.7 m (`plan-resolution.ts:327`). A scale that makes the
  walls 0.70–0.80 m passes extraction and is refused later.
- **h1.** The winner was vetoed by 0.38 cm (0.8038 m). The veto cannot confirm anything; it only hands the choice
  to the next lattice-built candidate.

**F17. The resolver's agreement tolerance is loose on short spans.**
- **The rule.** `agrees` is `max(3 %, tolPx·s)` with `tolPx = max(2, wallPx/2)` (`plan-resolution.ts:177-178`,
  `:504`). That is ±17 % on e-OZE's 38.5 px `"100"` (7.75 px).
- **Consequence.** Whether such a span counts as "long" for ISOTROPY depends on the judge extent
  (`plan-resolution.ts:197`, `:516`), which is thin on e-OZE.

**F18. The extent and the origin come from chains whose only "reading" is a rewrite.**
- `dimensionedExtent` counts `CHAIN_CORRECTED` as read (`plan-decomposition.ts:711`, `:723-724`).
- `originFor` takes the longest chain (`extract.ts:824-831`).
- On h1, the vertical extent comes from the chain whose only fitted segment is `"006"→"806"`.

**F19. The section ladder anchors its registration on corrected datums too.**
- **Where.** `extract.ts:562-584` and `registration.ts:390`.
- **e-OZE's section.** One of its two anchors is the corrected rung whose token text reads `"+5,14"`, entered as
  3.14 m.

**F20. The sealed OCR tokens do not record their orientation.**
- **Where.** `toOcrToken`, `extract.ts:156-168`, keeps the orientation only inside the id hash (`:154`).
- **What that cost this review.**
  - Orientation had to be inferred from the order of the glyph boxes.
  - On e-OZE's 853 px copy, 33 of 34 vertical tokens read top→bottom; on Miranda's, 27 of 27.
  - An independence contract that groups the two orientations of one ink needs this field sealed.

---

## 2. Evidence-dependency graph

What influences which scale, with file:line. Arrows that close a loop are marked ⟲; section 3 lists the loops.

```
raster ink
 └─ readNumbers (ocr.ts:898-927): 3 passes (0°, CW, CCW)
     └─ dedupeOrientations (ocr.ts:815-852): page-level turn vote; the losing turn DROPPED
         └─ TextToken {text, glyphs[char, score, alternatives]}; orientation NOT sealed (extract.ts:156-168)
             ├─ readingLattice (parse.ts:130-178): ≤24 strings, single + pair substitutions,
             │   confidence = alt/best ratio (×0.9 for pairs)
             │   └─ parseNumber (parse.ts:53-115): leading zeros admitted (106-111)
             └─ assignTokens (chains.ts:195-250): nearest-first, one number per interval
                 └─ ChainToken.readings = lattice ∩ LINEAR_DIMENSION        [raw + substituted, flat]
                     └─ proposalsOf/spansFor (chains.ts:307-373): span × reading → cm/px,
                        w = conf × tokconf × px/50   (no substitution cost)
                         └─ voteScale (481-499) + supportFor (390-397): one proposal per token,
                            ×(1 + 0.5(chains−1))
                             └─ [plausibility veto] planScalePlausibility (extract.ts:106-121, 313)
                                 └─ decideScale (chains.ts:570-591): replacement = ≥3 numbers on ≥2 chains
                                     └─ POOLED SCALE S (solveFrameChains 611-642)
                                         ├─ refineAxis X/Y (517-543): only within S's tolerance, ≤5 %
                                         └─ solveChain(fixedScale = S_axis) (662-821)
                                             ├─ DP over ticks, ≤3 skipped (690), merit × 0.45^subs (722)
                                             ├─ origin READ | CHAIN_CORRECTED (780) | UNRESOLVED (dropped)
                                             └─ DERIVED = S × px when fitted residual ≤ tol/2 (800-808) ⟲
                                                 └─ buildChain (extract.ts:705-814)
                                                     ├─ evidence (value, rawText = CHOSEN reading 744)
                                                     ├─ chain.closes (793) ⟲
                                                     └─ anchors: every origin but DERIVED (775-786) ⟲
                                                         └─ registerFrame/fitAxis (registration.ts:74-187)
                                                            count-first (102), 3 px (124), conf (166)
                                                             └─ REGISTRATION (metresPerPixelX/Y, anisotropy) ≈ S ⟲
   ┌──────────────────────────────────────────────────────────────────────┘
   ├─ originFor (extract.ts:824-831) ← longest chain (it may be read only via a rewrite)
   ├─ plan-decomposition: dimensionedExtent (706-735, READ|CORRECTED), grid lines (399), metres (868-871, 1232, 1579, 1848)
   │   └─ extent / grid ─► wall-ink judge for the "long" test in latticeScales (plan-resolution.ts:197, 511-516)
   ├─ layout.axisLadder (637-712): segment values of any origin → "stated" → basis MEASURED (1097);
   │   agreement across chains derived at the same S (703) ⟲
   ├─ layout storey alignment k = ratio of registrations (458-465)
   ├─ layout-gate statedSpans (72-96): other frames' READ|CORRECTED totals, printedTotal ?? derivedTotalCm
   └─ RESOLVER (plan-resolution.ts)
       ├─ statementsOn (157-174): ONLY emitted segments (READ|CORRECTED); firstReadCm from the token (169)
       │   └─ latticeScales (195-221): long spans' zero-substitution readings that disagree with the registration
       │       └─ metricsAtScale (238-270): re-read via firstReadCm, THEN lattice alternatives (254-258) ⟲
       ├─ ISOTROPY (515-516): zero-substitution readings on both axes (a registered scale no longer counts, 519)
       └─ CROSS_COPY (353, 494-498): siblings' wall-ink extents × THEIR registrations (same mechanism)
```

## 3. Circularities: scale → corrected number → the same scale

| # | loop | where | measured instance |
| --- | --- | --- | --- |
| C1 | **Substitutions vote.** A lattice reading proposes S; S wins; `solveChain` picks the same substitution as `CHAIN_CORRECTED`; it anchors S. | `parse.ts:130-178` → `chains.ts:217-223, 307-336, 481-499` → `:630, 780` → `extract.ts:775-786` → `registration.ts:74-120` | h1 853 ground: 3 of 3 vote members and 6 of 6 anchors substituted. e-OZE: `1801` wins, then anchors X. |
| C2 | **A substitution seeds its own scale.** Every proposal, substituted or not, seeds a candidate. | `chains.ts:485-489`, `:428` | h1: `"806"/426` seeds 1.892 and is its heaviest member (w 1.428 of 2.062, before the ×2 three-chain bonus). |
| C3 | **"The sheet states it" is met by substitutions.** | `chains.ts:563-580` | h1 853 ground, 3 of 3; h1 attic, replacement 2.965. |
| C4 | **The corroboration multiplier flips between two readings of one ink.** | `chains.ts:395` | e-OZE: 8.937 against 8.408. |
| C5 | **Span freedom after the scale is fixed.** Up to 3 skipped ticks let a number find a span that fits S. | `chains.ts:690` | `"513"→"313"`: 85.5 px in the vote, 166.5 px in the final cut. |
| C6 | **A rewrite licenses DERIVED.** The residual is 0 by construction, which passes the `tol/2` test. | `chains.ts:800-808` | h1: 59 of 65 DERIVED on rewrite-only chains; 180.5 px set to 341.5 cm. |
| C7 | **Closure and ladder agreement on restatements of S.** | `extract.ts:793`; `layout.ts:653-712, 1094-1097` | h1: 12 of 17 closing chains have no `READ`; spans labelled `MEASURED`. |
| C8 | **The axis refit is bounded to S, and rewrites "measure" the other axis.** | `chains.ts:517-543`; `registration.ts:137-156` | h1: `inliersX` = 0, yet X was "measured" at 1.8817, anisotropy 1.005. |
| C9 | **The registration refits pre-selected anchors.** Its confidence grows with the number of rewrites. | `registration.ts:102, 166` | 0 of 120 rejected; h1 confidence 0.857 with 6 rewrites. |
| C10 | **The extent and origin come from rewrite-only chains.** They then decide which spans are "long" for the resolver. | `plan-decomposition.ts:711`; `extract.ts:824-831`; `plan-resolution.ts:197, 516` | h1: the vertical extent comes from the `"006"→"806"` chain. |
| C11 | **The resolver sees only what S emitted.** A refused raw number can never vote against S. | `plan-resolution.ts:157-174`; `extract.ts:725` | Dropped: h1 17 of 23; Miranda `0111`/526 px and `036`/343 px. |
| C12 | **Reread by lattice alternatives under the hypothesis under test.** | `plan-resolution.ts:254-258` | This lowers `refutedShare` for any lattice scale that substitutions can fit. |
| C13 | **Siblings corroborate with the same rewrite.** | `layout-gate.ts:72-96`; `plan-resolution.ts:494-498` | Kosaćce: 4 shared rewrites; e-OZE: `1801` on both copies. |
| C14 | **The level ladder anchors on corrected rungs** (sections). | `registration.ts:291-395`; `extract.ts:562-584` | e-OZE section: 1 of 2 anchors. |
| C15 | **The plausibility veto** is not circular itself, since the wall pixels are independent. It is only a veto, and its fallback candidate is built by C1–C3. | `extract.ts:106-121`; `chains.ts:576-580` | h1: vetoed by 0.38 cm, fallback 1.892. |

**Closed in 005A (confirmed):** ISOTROPY for a *registered* scale no longer counts (`plan-resolution.ts:518-519`).
Lattice ISOTROPY uses only zero-substitution readings (`:515-516`); it stays exposed to F17 and to C10.

---

## 4. Measurements

### Method

Every number below is computed from the sealed JSON, with no drawings and no pipeline run.
- **The rebuild.** The frame's chain solve is rebuilt with the repository's own pure functions:
  - `RawChain`s from `chains[].ticksPx`;
  - `TextToken`s from `ocrTokens`, including glyph alternatives. Orientation is inferred from the glyph-box order,
    since the sealed tokens do not carry it;
  - `solveFrameChains` and `registerFrame` run on those.
- **The fidelity.** Every rebuilt chain matched the sealed chain exactly, in cuts, origins, values and cm/px:
  - **839 of 839 chains on 16 frames** of the 005A sets;
  - 101 of 102 on the older Marcówki set;
  - 80 of 80 on the older G2E set.

  The registrations match to 1e-6 m/px.
- **What "raw-only" means.** The same rebuild with every glyph alternative removed, so that `readingLattice`
  returns only what was read.
- **The plausibility veto** is applied where the sealed `scale-implausible` note gives the wall thickness in
  pixels. Where it does not, the digest's `wallPx` is used and labelled APPROX.
- **The scripts** live outside the repository (session scratchpad). The appendix gives their core.

### 4.1 h1 (dom w jabłonkach): the ground-floor plan frames

**853 px dimensioned copy (`asset-rzut-a8bdd8cd1d`).**
- Registered X 1.8817, Y 1.8920 cm/px. Confidence 0.857, anisotropy 1.005, 0 rejected.
- The printed overall dimensions agree at about 2.11 cm/px (section Z).
- The vote's winner, 3.6535 (4 numbers on 4 chains), was vetoed: 22 px walls would be 0.8038 m. The replacement,
  1.892003, came from 3 numbers on 3 chains.

| axis | value | pixelSpan | origin | raw → chosen | confidence | implied cm/px |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| X | 0.96 m | 51.39 | CHAIN_CORRECTED | `46` → `96` | 0.2959 | 1.8680 |
| Y | 1.07 m | 57.5 | CHAIN_CORRECTED | `501` → `107` (2 subs) | 0.1929 | 1.8609 |
| X | 1.20 m | 62 | CHAIN_CORRECTED | `170` → `120` | 0.2138 | 1.9355 |
| Y | **8.06 m** | **426** | CHAIN_CORRECTED | **`006` → `806`** | **0.1424** | **1.8920** |
| X | 3.13 m | 166.5 | CHAIN_CORRECTED | `513` → `313` | 0.2600 | 1.8799 |
| Y | 0.83 m | 42 | CHAIN_CORRECTED | `25` → `83` (2 subs) | 0.1203 | 1.9762 |

- **Rewritten anchors: 6 of 6 (100 %).**
- **What the raw readings support: nothing (INCONCLUSIVE).**
  - The raw-only vote's winner is 0.014085, from `"006"` over 426 px; it is vetoed.
  - No other candidate has 3 numbers on 2 chains. The only plausible one is 3.2232, with 2 numbers.
  - The frame gets no scale, and the same solution with `READ`-only anchors has 0 anchors.
- **Why 2.11 cannot be reached from this frame's readings:**
  - `"1100"` over 519 px was never assigned (F13);
  - `900` over 426 px was read `"006"`;
  - the 180.5 px span's token was read `"002"`, and no lattice string of it gives 380.
- **Fate of the 23 numbers on chains:** 0 `READ`, 6 `CHAIN_CORRECTED`, 17 dropped.
- **An unused cross-view witness.** On the site plan (`sytuacja`), `"1100"` over 318 px was read raw (READ,
  confidence 0.555). It states the 11.00 m width in another view. At the plan's registered 1.8817, the plan's
  519 px overall span measures 9.77 m (−11.2 %). No consumer uses it: that chain's third segment is unresolved,
  so `derivedTotalCm` is undefined and `statedSpans` skips it.
- **Resolver lattice with this evidence:** 0.014085 (`"6"` over 426 px) and 3.081 (`"513"` over 166.5 px). There
  is no 2.1. The "long" test used the digest extent as a stand-in for the wall-ink cluster.

**550 px dimensioned copy (`rzut-parteru-ce2c8c302b`).** Registered 1.5328 / 1.5739, confidence 0.703.

| axis | value | px | origin | raw → chosen | conf | cm/px |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| X | 1.05 m | 68.5 | CHAIN_CORRECTED | `165` → `105` | 0.2316 | 1.5328 |
| Y | 1.33 m | 82.5 | CHAIN_CORRECTED | `113` → `133` | 0.1645 | 1.6121 |
| Y | 4.31 m | 274 | CHAIN_CORRECTED | `051` → `431` | 0.1968 | 1.5730 |

- **Rewritten anchors: 3 of 3.**
- **Raw only:** the winner is 0.1861 (`"14"` over 75.5 px, one number), which is meaningless. No `READ` anchors,
  so no registration.
- **True scale of this copy: NOT MEASURED.** No overall dimension survived on it.

**400 px dimensioned copy (`09655213e4`).** Registered 2.0792 / 2.0703, confidence 0.880.

| axis | value | px | origin | raw → chosen | conf | cm/px |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| Y | 1.16 m | 55.72 | CHAIN_CORRECTED | `1/6` → `116` | 0.3838 | 2.0818 |
| Y | 0.21 m | 9 | CHAIN_CORRECTED | `51` → `21` | 0.2594 | 2.3333 |
| Y | 4.14 m | 200 | CHAIN_CORRECTED | `/14` → `414` | 0.3030 | 2.0700 |
| X | 1.05 m | 50.5 | CHAIN_CORRECTED | `155` → `105` | 0.3368 | 2.0792 |
| Y | 1.35 m | 65.35 | CHAIN_CORRECTED | `555` → `135` | 0.2906 | 2.0658 |
| Y | 1.11 m | 53.5 | READ | `111` | 0.5529 | 2.0748 |

- **Rewritten anchors: 5 of 6.**
- **Raw only:** the winner is 1.6786 (`"51"` over 29 px, one number). The only `READ` anchor, 2.0748, is alone,
  so no registration (`extract.ts:606`).
- **True scale: NOT MEASURED.**

**853 px area-table copy (`07bdad2581`).** No registration: the vote's 0.014085 was vetoed, and no alternative had
3 numbers on 2 chains.

### 4.2 Rarytasy e-OZE (the owner's development case)

**853 px dimensioned copy (`b747b42ad2`).** Registered 2.5016 / 2.5974 (anisotropy 1.038, from a single 38.5 px Y
anchor), confidence 0.832.

| axis | value | px | origin | raw → chosen | conf | cm/px |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| X | 1.26 m | 52 | CHAIN_CORRECTED | `176` → `126` | 0.1739 | 2.4231 |
| X | 1.04 m | 42 | CHAIN_CORRECTED | `180` → `104` (2 subs) | 0.1162 | 2.4762 |
| X | 1.08 m | 45 | READ | `108` | 0.3142 | 2.4000 |
| X | **18.01 m** | **720** | CHAIN_CORRECTED | **`1601` → `1801`** | 0.3248 | **2.5014** |
| Y | 1.00 m | 38.5 | READ | `100` | 0.3879 | 2.5974 |
| X | 1.25 m | 48 | CHAIN_CORRECTED | `155` → `125` | 0.2026 | 2.6042 |
| X | 1.50 m | 62 | CHAIN_CORRECTED | `720` → `150` (2 subs) | 0.1234 | 2.4194 |
| X | 4.80 m | 191 | CHAIN_CORRECTED | `080` → `480` | 0.2960 | 2.5131 |
| X | 1.36 m | 53 | CHAIN_CORRECTED | `516` → `136` (2 subs) | 0.1438 | 2.5660 |

- **Rewritten anchors: 7 of 9 (77.8 %).** Across all e-OZE plan registrations: 15 of 24 (62.5 %).
- **Would the scale change with raw readings only? Yes, by −11.1 %.**
  - The raw-only vote picks **2.2236** (`1601` over 720 px). That is the section J scale.
  - The raw-only registration is 2.2236, from `1601`/720 and `108`/46.5 (both X; Y assumed square).
  - The vote itself (F5): 2.5014 won 8.937 against 8.408. The only support for 2.5014 besides the rewritten ink is
    `100` over 38.5 px.
- **The 853 px area-table copy (`2abfc5825d`)** carries the same `1601→1801` over 720 px. Its raw-only vote is also
  2.2236, but with one anchor it gets no registration.
- **The 550 px copy (`d4aaf53656`):** 4 of 4 anchors rewritten, anisotropy 1.0645. Its raw-only vote is
  meaningless (0.185, from `"041"`/`"011"`/`"016"`).

### 4.3 A development house that works: Kosaćce-clean

**853 px dimensioned copy (`f530d6ebf2`).** Registered 2.4058 / 2.4067, confidence 0.860, 18 anchors.
- **Rewritten anchors: 14 of 18 (77.8 %).** Examples: `1000`→`1660` over 690 px, `005`→`665` (2 subs),
  `111`→`521` (2 subs), `840`→`890`, `461`→`061`.
- **READ anchors:** `1260`/523.5 px (2.4069), `370`/153.5 (2.4104), `204`/85.5 (2.3860), `86`/35.5 (2.4225).
- **Raw-only vote: 2.4069** (3 numbers on 3 chains, weight 16.73; the runner-up weighs 6.94). The sealed pooled
  scale is 2.4061, a change of **+0.03 %**.
- **With READ-only anchors on the same solution:** X 2.3885 (−0.7 %, since X has no long raw span; the 690 px
  overall reads `1000`) and Y 2.4070.
- **Area-table copy `94f54ada01`:** 4 of 7 rewritten; raw-only 2.4069.
- **Across all Kosaćce plan registrations:** 25 of 35 (71.4 %).
- **In short:** where the scale is right, raw readings alone give it. The 14 rewrites add no information.

**Marcówki, as a second control (older sealed run, `analyzer-v2/marcowki-metrics.json`).** The current code
rebuilds it exactly. Note that 005A's own Marcówki metric evidence, hash `a22a6a31…`, is not sealed in the
repository.
- **853 px dimensioned `19a11bc745`:** 6 of 9 sealed anchors rewritten; raw-only 2.6425 against the sealed
  2.6434 (−0.03 %). This is the one frame whose rebuild missed a chain: 56 of 57 matched.
- **853 px area-table `aa1526220f`:** 5 of 8 rewritten; raw-only 2.6425.
- **Caveat.** The raw-only *vote* is thin: `1205`/456 px alone (weight 4.70) against the runner-up 2.8866 (4.46).
  The raw readings agree only after `solveChain`'s tick-skipping finds their spans. A raw-witness solver must allow
  bounded span choice.

**Miranda GROUND (a blind holdout; the scale is right, section AA).** Copies `73ee27c4b6` and `891a78d924`: 3 of 6
rewritten; raw-only **2.6809**, unchanged. All three raw witnesses are on X (1500/559.5, 800/298.5, 700/261).

### 4.4 Where only rewrites carry the scale (the regression watch-list)

| frame | anchors rewritten | vote members unsubstituted | raw-only result | comment |
| --- | --- | --- | --- | --- |
| h1 GROUND 853 (`a8bd…`) | 6/6 | 0/3 | none | wrong; the truth is about 2.11 |
| h1 GROUND 550, 400 | 3/3, 5/6 | — | none / single numbers | truth NOT MEASURED |
| h1 ATTIC 853 (`d52f…`) | 5/6 | — | none | 2.97 against GROUND; NOT MEASURED |
| Miranda UPPER 853 (`07b6…`) | 8/8 | — | none | 3.3× its sibling `dac3…` |
| e-OZE 550 (`d4aa…`) | 4/4 | — | meaningless | anisotropy 1.0645 |
| Kosaćce 550 (`427c…`) | 3/3 | — | meaningless | vote winner 0.158 vetoed; replacement 2.5285 |
| **G2E 853 (`e852…`), older run, an accepted house** | **10/11** | **0/4** | none (`"0551"`/534.5 px → 1.031) | **regression risk**: a raw-witness contract makes it INCONCLUSIVE unless another witness is found; its true scale is NOT MEASURED |

### 4.5 The adversarial fixtures, run against the current code

The chain layer was run on hand-built tokens (no raster). Section 6 has the numbers.

| fixture | truth | current result |
| --- | --- | --- |
| T1 | 2.000 | **1.7909**; registration 1.7876/1.7910, confidence 0.813; 4 of 4 anchors rewritten; the correctly read `1100`/550 px dropped |
| T2′ | 2.100 | **2.3985**; the rewrite `1407→1607` beats its own raw reading, 8.716 against 8.040 |
| T3 | 2.000 | X **1.7875**; the 550 px READ rejected; anisotropy 1.119; confidence 0.895 |
| T1 with no substitutions (control) | 2.000 | 2.000 (1 anchor, so no registration under `extract.ts:606`) |

---

## 5. Recommended contract for the scale solver

### 5.1 Vocabulary

- **Observation.** One ink cluster (a glyph run), with:
  - its own id;
  - its raster copy (`variantByteHash`);
  - its **reading set**: the raw reading in every orientation the OCR produced for that ink, 0°/180° or CW/CCW;
  - its **span candidates**: tick pairs on the same dimension line with physical endpoints, centred on the
    cluster, skipping at most 2 ticks, so at most 3 spans.
- **Independence group.** The unit that may be counted once. One group is:
  - **one physical span on one raster copy**, whatever readings it has;
  - **one ink cluster read in several orientations**, such as `"006"` and `"900"`;
  - **byte-identical copies** (equal `variantByteHash`, the council's W2): the same group;
  - **copies at the same raster size and the same drawing**, such as an area-table and a dimensioned copy at
    853 px. These are **one group for the reading**, because they fail identically: Kosaćce shares 4 rewrites and
    e-OZE shares `1801`. They may only confirm pixel geometry;
  - **a copy at a different raster size** that reads the same printed value *raw*: a separate group (class W2).
    If both copies need the same substitution, they are one group.
- **Non-witnesses.** These never count toward support. They may be recorded as "consistent with":
  - `CHAIN_CORRECTED` readings;
  - `DERIVED` values;
  - lattice alternatives;
  - another frame's registration, if it was built from those;
  - the published area (veto only);
  - the plausibility check (veto only);
  - the reading's own pixels.

### 5.2 Witness classes

| class | what it is | may confirm |
| --- | --- | --- |
| **W1 RAW_SPAN** | A raw reading (any orientation, no substitution) that parses as a centimetre length with **no leading zero**, on a centred span between two ticks. | scale on that axis |
| **W2 SECOND_COPY** | The same printed dimension read raw on a copy at a *different raster size*, on its own span. | the reading (value), and that copy's scale |
| **W3 OTHER_AXIS** | A W1 on the orthogonal axis. | isotropy; turns an "assumed square" note into "measured" |
| **W4 PUBLISHED_TIED** | A published *length* (not an area), tied by value equality to a W1 reading on the sheet. Areas stay veto-only, as in 005A's "spent" rule. | scale, only in combination with W1 |
| **W5 CROSS_VIEW** | A raw reading in another view of the same dimension, tied to a raw reading or to the scale-free wall-ink extent of the plan within one wall thickness. Example: h1's site plan `1100` READ. | scale (the plan span in px against another view's metres) |

A witness **agrees** with scale *s* when `|value/s − px| ≤ 2.2 px`, the existing chain tolerance.
- **Precision** is `2.2/px`.
- **PRECISE** means precision ≤ 5 %, i.e. px ≥ 44.
- **LONG** means `px ≥ max(120, 0.3 ×` the axis extent of the scale-free wall-ink cluster`)`. It is never judged
  on the chain extent, which depends on the scale (C10).

### 5.3 Candidate generation (bounded, deterministic)

1. **Hypotheses.** For each group: each W1 reading (at most 2 orientations) × each span (at most 3) gives
   *s = cm/px*. Groups per frame are capped at 64, so there are at most 384 hypotheses.
   - **Substitutions generate nothing.**
   - A leading-zero string is not a value. It marks the group as orientation-suspect.
2. **Clustering** is in log-scale, one hypothesis per group (the best fit), with each member at its own
   pixel tolerance. This is the existing `gatherAround` idea, keyed by group rather than by chain and token.
3. **Weight** is **additive**, `Σ_g min(1, px_g/200) × readConfidence_g`.
   - There is **no multiplicative corroboration bonus** (C4). The diversity of chains, axes and views belongs in the
     class criteria, not in the weight.
4. **Clusters kept.** Keep the top 4 mutually incompatible clusters, where incompatible means further apart than
   the looser of their tolerances.
   - Clusters are **never averaged.**
   - A cluster's centre is the weighted least-squares fit of its members: weights ∝ px² × confidence, capped per
     group so that one long span cannot hide a contradicting long span.
5. **Ambiguity.** If the two best clusters both reach SUPPORTED, the result is INCONCLUSIVE with both recorded
   (AMBIGUOUS). The reader does not choose.
6. **Plausibility** stays a veto on a cluster. It never promotes the next one by weight alone (C15).

### 5.4 Corrections (after the decision, never before)

- **Leave-one-group-out.** For a group *g* whose raw reading misses the decided scale, first compute *s₋g* from
  every witness except *g*.
- **When a substitution may fill the span.** Only if all three hold:
  1. *s₋g* is SUPPORTED or STRONG, and within tolerance of *s*;
  2. the substituted value agrees with *s₋g*;
  3. no raw reading of *g*, in any orientation, agrees with a cluster that reached WEAK or better.
- **Otherwise** the span stays UNRESOLVED, with its raw reading and its candidate values listed. The ambiguity is
  named, not decided.
- **What an accepted correction is.** Its origin becomes `CORRECTED_UNDER(<scale decision id>)`:
  - it is never a registration anchor;
  - it never licenses DERIVED;
  - it is never `stated` in `axisLadder`, so its basis is `DERIVED`, never `MEASURED`;
  - it never counts toward `closes`.

### 5.5 What the decision records (sealed)

`ScaleDecision` per frame and per axis:
- `class`;
- `cmPerPixelX` and `cmPerPixelY`;
- `isotropy`: `MEASURED` or `ASSUMED`;
- `supporting`: `[{groupId, observationIds, witnessClass, reading, orientation, spanPx, residualPx, residualRel}]`;
- `rejected`, with the reason;
- `consistentCorrections`, the non-witnesses;
- `runnerUp`: cluster, independent weight, margin;
- `leaveOneOut`: `[{groupId, scaleWithout, classWithout}]`;
- `independenceGroups`: members and their copy hashes;
- the sealed token `orientation`, which fixes F20;
- `rawText` holding the reader's text (fixes F15), with `chosenText` separate.

`METRIC_READER_VERSION` (`extract.ts:48`) and the evidence schema must bump: this changes answers.

### 5.6 Metric confidence class

| class | criteria (all must hold) | allowed downstream use |
| --- | --- | --- |
| **STRONG** | ≥ 3 independence groups agree; ≥ 2 are LONG; both axes have a PRECISE W1 or W3; every leave-one-group-out result stays within 0.5 % and at least SUPPORTED; the best incompatible cluster's independent weight is ≤ ⅓ of the winner's | registration as source-traced metric; spans stated by W1 readings are `MEASURED` |
| **SUPPORTED** | ≥ 2 groups agree, ≥ 1 LONG and the other PRECISE; leave-one-group-out keeps the scale within tolerance; runner-up ≤ ½; isotropy `ASSUMED` when only one axis has witnesses | the same, with the assumed isotropy named |
| **WEAK** | exactly one LONG W1 group, **or** ≥ 2 PRECISE short groups with no LONG, **or** a SUPPORTED cluster contested by a runner-up above ½ | a hypothesis only: the resolver needs an independent W2 or W5 witness before it may build; spans are `SCALED` |
| **INCONCLUSIVE** | no raw group agrees with anything; or the support is corrected, derived or lattice readings only; or two incompatible clusters of comparable weight | no registration; the pixels stay pixels (the path at `layout.ts:365-375`); the missing witness is named |

**Calibration against the sealed data** (computed from the tables above, not tuned):

| frame | class under the contract | note |
| --- | --- | --- |
| Kosaćce 853 | **STRONG or SUPPORTED** at 2.407 | Y 1260/523.5 is LONG; 370/153.5 is LONG only if the wall-ink extent is under 512 px (with the digest's 523.5 px extent the threshold is 157 px); X 204/85.5 is PRECISE. Either way the scale is the same |
| Marcówki 853 ground | **STRONG** at 2.6425 | needs span choice |
| Miranda ground | **SUPPORTED** at 2.681 | X only; STRONG once the orientation groups recover `0111`/`036` |
| e-OZE 853 | **SUPPORTED** at 2.2236 | 1601/720 LONG + 108/46.5 PRECISE, both X. This is right, and 005A needed the resolver for it |
| h1 853 ground | **INCONCLUSIVE** | against today's 1.892 at confidence 0.857. With F13 fixed: WEAK at 2.12 (`1100`/519). Plus the W5 site plan `1100`: SUPPORTED. Plus the orientation group `006`/`900`: STRONG |
| Miranda UPPER 853, h1 ATTIC 853 | **INCONCLUSIVE** | — |
| **G2E 853** | **INCONCLUSIVE** | **This must be measured before adoption.** A known-good house would lose its registration unless an orientation, W2 or W5 witness is found. The rule is not to be relaxed to keep it; the missing witness is to be named. |

The numeric limits (120 px, 5 %, ⅓, ½, 0.5 %) are proposals. Fix them **before** measuring the 6 + 2 houses, and do
not tune them to the answers.

### 5.7 Consumer changes the contract implies

- Registration anchors come from `supporting` only. `fitAxis` takes precision-weighted consensus, not count first
  (F9).
- `solveChain` DERIVED needs a fitted **W1** on that chain (F10).
- `chain.closes`, `axisLadder`'s `stated`/`agreed` and `dimensionedExtent` count W1 only (F10, F18).
- `statedSpans` and CROSS_COPY count a sibling only as a separate group under 5.1 (F11).
- Cross-copy and cross-storey scale disagreement becomes a recorded conflict; today only variants of one asset are
  compared (F14).
- The resolver's lattice reads the **full** raw group set, including groups that the pooled scale left unresolved
  (F4). `metricsAtScale` re-reads only raw orientation readings, never lattice alternatives (F12).

---

## 6. Proposed adversarial tests

They are built at the chain layer from hand-made `TextToken`s: 14 px high, glyph score 0.5, glyph confidence 0.6
unless stated, and `alternatives` given as score ratios. That is exactly how the rebuild above was driven, so the
tests are deterministic and cheap. T1, T2′ and T3 were **run on the current code and fail as described**.

**T1: self-anchoring overall dimension with a substituted consensus (true 2.00 cm/px).**
- **Chains:**
  - V@700, ticks [50, 500], 450 px; prints 900; token `"006"`, glyph 0 alt `'8'` at 0.7;
  - H@760, ticks [100, 650], 550 px; prints 1100; token `"1100"` read correctly;
  - H@300, [200, 260], 60 px; token `"101"`, glyph 2 alt `'7'` at 0.7, giving 107 (1.783);
  - V@400, [100, 250], 150 px; token `"208"`, glyph 1 alt `'6'` at 0.7, giving 268 (1.787);
  - H@500, [300, 390], 90 px; token `"131"`, glyph 1 alt `'6'` at 0.7, giving 161 (1.789).
- **Raw readings** agree pairwise on nothing but `1100`.
- **Old result:**
  - pooled **1.7909**;
  - 4 of 4 anchors rewritten (`006→806`, `101→107`, `208→268`, `131→161`);
  - registration 1.7876/1.7910 at confidence 0.813;
  - `1100` UNRESOLVED and invisible to `statementsOn`.
- **Required:**
  - never 1.79;
  - none of the four rewrites in `supporting`;
  - result WEAK at 2.000 (one LONG W1), or INCONCLUSIVE.
- **T1b:** add `"900"` as the other-orientation reading of the `"006"` cluster. Required: 2.000 at SUPPORTED or
  better, with isotropy `MEASURED`.

**T2′: a substitution outvotes its own raw reading through the corroboration bonus (true 2.10).**
The numbers are fresh, not e-OZE digit for digit (council W).
- **Chains:**
  - H@760, [60, 730], 670 px; token `"1407"`, glyph 1 alt `'6'` at 0.66, giving 1607 = 2.3985;
  - V@820, [100, 142], 42 px; token `"102"` (2.4286; misses 2.3985 by 0.53 px and 2.10 by 6.57 px).
- **Old result:** **2.3985**, from 8.716 against 8.040; registration 2.3985/2.4286.
- **Required:**
  - `1407` and `1607` are one group;
  - never 2.3985;
  - 2.10 at WEAK, since the second witness disagrees, or INCONCLUSIVE;
  - `"102"` listed under `rejected` with its residual.

**T3: count-first registration (true 2.00).**
- **Anchors fed straight to the registration:**
  - X, the overall 11.0 m over 550 px (READ, weight 0.55);
  - five short X anchors: 1.07/60, 1.61/90, 1.00/56, 1.20/67, 0.80/45 (weight 0.3; about 1.79);
  - Y, 9.0 m over 450 px (READ, 0.55).
- **Old result:** X **1.7875**; the 550 px anchor rejected with a 1.17 m residual; anisotropy 1.119; confidence
  0.895.
- **Required:**
  - the only LONG witness is never rejected in favour of shorter ones;
  - result 2.00, or INCONCLUSIVE with both clusters recorded.

**T4: substitution invariance (metamorphic, over every sealed development frame and T1–T3).**
- **Strip every glyph alternative.** A STRONG or SUPPORTED decision must keep its class and its scale within
  tolerance.
- **Inject a runner-up.** Give every `0` the runner-up `8` at 0.95, and every `1` the runner-up `7` at 0.95. The
  decision must not change.
- **The old code fails both:**
  - e-OZE moves from 2.5014 to 2.2236;
  - h1 moves from 1.892 to no scale.

**T5: copies are not witnesses of their own misreadings.**
- **Fixture.** Two frames of equal size, with different hashes but identical chains and tokens, and the same
  misread `"1000"` needing `→1660` over 690 px. Add a third frame with an equal `variantByteHash`.
- **Required:**
  - one independence group for the reading;
  - `statedSpans` and CROSS_COPY do not count the sibling;
  - the byte-identical frame adds nothing.

**T6: leave-one-out.**
- **Fixture.** Raw `"1601"` over 720 px as the only LONG group, with glyph 1 alt `'8'`. The other witnesses are
  short and agree with 2.2236.
- **Required.** A correction to `1801` is refused: *s₋g* is not SUPPORTED at 2.5014.
- **The mirror case.** With three independent LONG witnesses at 2.5014, the correction is accepted as
  `CORRECTED_UNDER`, and it is still not an anchor.

**T7: no DERIVED licence from a rewrite.**
- **Fixture.** A chain [56.5, 237, 663] whose only fitted reading is a rewrite; this is h1's geometry.
- **Required:**
  - the 180.5 px span stays UNRESOLVED, not DERIVED;
  - `closes` is false;
  - `axisLadder` never labels a span `MEASURED` that includes a corrected or derived segment.

**T8: leading zeros.**
- **Required:**
  - `parseNumber("006")` in chain context is not a centimetre witness;
  - the resolver's lattice never proposes 0.0133 or 0.0141 cm/px;
  - with the sealed h1 evidence, `latticeScales` must not return 0.014085. **Old: it does.**

**T9: replay of the sealed h1 853 px ground plan.**
- **Required:** from the sealed tokens, the new solver returns **INCONCLUSIVE**, not 1.892.
- **With T10 applied:** WEAK at about 2.12, from `1100`/519.
- **With the site plan's READ `1100` as W5:** SUPPORTED.
- **Old:** 1.892 at confidence 0.857.

**T10: assignment eviction.**
- **Fixture.** The single-interval chain [83.5, 602.5] at baseline 828, with `"14"` at along 549 (offset 0.64 h)
  and `"1100"` at along 336.5 (offset 0.82 h).
- **Required.** A token with no centred span on an interval may not evict one that has one. `"1100"` must be
  assigned.
- **Old:** `"1100"` is unassigned (measured).

Every test also asserts the recorded fields in 5.5, so that a pass cannot come from an unrecorded shortcut.

---

## Appendix: how the sealed evidence was replayed

This is the core of the harness. It ran with `npx vite-node` from the repository root; the files live in the
session scratchpad and are not committed.

```ts
// tokens: sealed ocrTokens of the frame; orientation inferred from glyph order (not sealed)
const orient = (t) => { const [a, b] = [t.glyphs[0].box, t.glyphs.at(-1).box].map((r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }))
  return t.glyphs.length < 2 || Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'HORIZONTAL' : b.y > a.y ? 'ROTATED_CCW' : 'ROTATED_CW' }
const chains = sealed.chains.filter((c) => c.frameId === F).map((c) => ({ axis: c.axis, baselinePx: c.baselinePx, ticks: c.ticksPx.map((atPx) => ({ atPx, baselinePx: c.baselinePx, observationId: '' })), observationIds: c.observationIds }))
const tokens = sealed.ocrTokens.filter((t) => t.frameId === F).map((t) => ({ text: t.text, score: t.score, confidence: t.confidence, box: t.box, shearDeg: t.shearDeg, height: t.heightPx, orientation: orient(t),
  glyphs: t.glyphs.map((g) => ({ ...g, alternatives: RAW_ONLY ? [] : g.alternatives, holes: { count: 0 } })) }))
const plausibility = outerPx && ((c) => ({ plausible: outerPx * c / 100 >= 0.15 && outerPx * c / 100 <= 0.8, why: '' }))
const sol = solveFrameChains(chains, tokens, { tolerancePx: 2.2, plausibility })   // then buildChain's anchor rule + registerFrame
```

- **Fidelity check:** for every chain, the rebuilt `segments` (pixel length, origin, value) and `cmPerPixel`
  equal the sealed ones. Result: 839 of 839 on the 16 frames of the 005A sets.
- **Orientation:** only needed as horizontal against vertical, for `assignTokens`. The exact reproduction confirms
  the inference.
