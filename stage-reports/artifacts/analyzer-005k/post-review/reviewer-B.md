# 005K council — Reviewer B (statistics and generalization)

**Verdict: CONDITIONAL PASS.** The protocol was followed, every committed number reproduces, and nothing reached the labellers. INSUFFICIENT_EVIDENCE is correct. Two framing errors must be corrected before closing (B1, B2).

## What I recomputed

- **Draw.** seed = SHA256(892853e… + label) = `76a8f6c5…d689`. Against both pools at 892853e (hashes match the ledger), less 105 / 175 excluded families, all 14 picks reproduce (e.g. archon k0 1748/567, k7 1688/1672; dobredomy k0 483/310, k5 473/124).
- **Timeline** (remote reflog): 892853e pushed 22:16:49, draw 22:16:56; seal 70aa0a4 pushed 22:44:19; PNGs 22:44:53; D1 pushed 22:45:07; labellers 22:46:19–22:54:32; labels pushed 22:54:47; first replay 22:54:52.
- **Frozen files.** `evaluate.mjs` is unchanged since d653b1b, and `extract.mjs` / `draw.mjs` since c244ff7. D1 is colour-only: all 60 PNGs carry (0,90,255), none (220,20,20). `listSha256` and every `key.json` PNG hash reproduce.
- **Labels.** 44 / 0 / 10 / 6. κ(A,B) = (0.9333 − 0.5697) / (1 − 0.5697) = **0.8451**. Sealed votes equal the raw answers, 124 of 124.
- **Rule decisions.** `drawnGapRule.check.eligible` re-read from the run digests matches `rows[].rule` on all 60 gaps.
- **Wilson.** `evaluate.mjs:31-39` is the standard Wilson interval. An independent recomputation of three arms × (overall + four splits) gives **0 mismatches**: rule recall 24/44 [0.4007, 0.6829], false upgrades 1/10 [0.0179, 0.4042]; CONSTANT 10/10 [0.7225, 1].
- **Recommendation claims.** Condition breakdown (17/2/1; 5+3/1), route table and baseline fate (22/18/4) reproduce. density = publisher on every gap (FINE = D00 only), as stated.

## Findings

**B1 — P1. Safety items 5 and 7 "hold" without power; "not a REJECT" rests on one 2-of-3 AI vote.**
- **Item 5:** `arms.CONSTANT.outcomeCriticalFalseBridges = 0`. The naive control passes it too.
- **Item 7:** CONSTANT's rate is 1.0 by construction, and Wilson's upper bound is below 1 whenever k < n. So item 7 means only "the rule refuses one negative", at any n: 9/10 would still pass (upper bound 0.9821).
- **q049:** the only false upgrade was voted NOT_A_WALL_LINE 0.55 / **OPEN** 0.50 / NOT_A_WALL_LINE 0.55. With B's reading, item 6 is tested and fails.
- **Precedence:** §8 does not say which verdict wins when item 4 and a safety item both fail.

*Fix:*
- Mark items 5 and 7 "holds — uninformative".
- Say "no safety evidence either way" and name the q049 sensitivity.
- In the next protocol, use an absolute bound (0/n gets below 0.10 only from n ≥ 35; 0/30 → 0.1135) and state the precedence.

**B2 — P1. The FIX_STOREY_COUNT frequency claim is misstated; the recommendation stands.**

First non-PASSED entry of each `analysis-trace.json`:
- **A00, A04, A05:** PLAN_RESOLUTION (3).
- **A06, A07:** STRUCTURAL_LAYOUT `NO_MASS_REACHES_UP`.
- **A01:** `NO_MASS_REACHES_UP` + PLAN_STOREY_ALIGNMENT_FAILED, *before* MODEL_EMISSION_FAILED. It is storeys-first, not emission.
- **D00:** METRIC_CHALLENGE kept the −18.7 % reading, and its gate lists `FOOTPRINT_AREA_NEAR` first. Footprint and storeys are co-first.

As written (3 vs 3), "most frequent" is a tie; recomputed it is 3–4 vs 3. What holds is that storeys alone block A06 (+0.18 %) and A07 (−0.37 %).

The 9-project base also rests on excluding D01–D05 as "source-limited", which overrides `verdict.mjs` (ALGORITHMIC_FAIL). The quote "it prints none" is D03–D05's message only: D01 reports "5 labels on 5 dimension lines", D02 "35 dimension lines". I viewed the D01–D03 rasters: none prints a dimension chain, so the exclusion is right but is a judgment.

*Fix:* correct the table, state the margin, rest on the sole-blocker argument, and label the reclassification with the raster check.

**B3 — P2. FREEZE_SHA was not committed in advance.** d653b1b says "seed from this commit"; the seed is 892853e. That fits "the pushed commit", since d653b1b was never pushed alone (b747440 → 892853e), but the operator chose which commit to push. I found no sign of grinding: the draw ran 7 s after the push, on a clean tree, and the ledger has 14 lines. *Fix:* name the seed source in advance.

**B4 — P2. The rule's decision existed before the label seal, but no route reached the labellers.**
- The frozen rule-OFF records carry `check.eligible` and `outline`; `extract.mjs:45` reads `check.drawn` from that object. 6672a89's "Neither the rule nor the constant control has been run" is true only of the replays.
- The transcripts of the 7 labelling sub-agents show only `Read` on their listed q###.png and one `Write`. Prompts carry only instructions and paths.
- *Fix:* qualify the sentence.

**B5 — P2. Attrition is honest but incompletely classified; "random won't get there" overstates.**
- **A01** read 2 plans and passed PLAN_DECOMPOSITION, so its sheets belonged to the population. No records were emitted (`failure.json` has no `plans`; `12b-gap-evidence.json` has `copies: []`). The manifest's `sheets: []` reads as "no sheet". The loss is label-independent.
- **DobreDomy** attrition is structural (no dimension chains), so that stratum is one house. Not extending the draw is right: an extension now would be optional stopping.
- **Yield:** at this set's rate, 30 negatives need about 24 read (about 42 drawn) projects. Only open sides are out of reach (0/60, upper bound 0.0602).
- *Fix:* record A01 as "boundary read, records not emitted", reword §1, and gate the next DobreDomy draw on printed dimension chains.

**B6 — P2. The effective n is smaller than it looks.**
- 8 of 10 negatives come from A00 and D00.
- q001/q049 and q013/q029 are the same spans on parallel lines. The one false upgrade, q049, is a twin of the refused q001.
- The Wilson intervals assume independence, so they are anti-conservative here.
- *Fix:* report per-house and distinct-feature counts, and cluster or de-duplicate in the next protocol.

**B7 — P2. Label provenance is honest, with two gaps.**
- `label_source` and the not-human statement are correct in the labels note, `labelsNote`, the protocol and recommendation §1. `constant-control.json` lacks the note.
- κ compares two instances of one model under identical instructions: it measures consistency, not independence. On OPENING vs not, A and B agree 60/60, so a shared bias would not show.
- *Fix:* add the note and one sentence on κ.

## Answers in brief

1. **Protocol:** followed. The rule result was on disk, but no labeller saw it (B3, B4).
2. **Numbers:** all reproduce; `wilson` is correct.
3. **Gate:** INSUFFICIENT_EVIDENCE is right; item 7 is meaningless at any n, item 5 powerless here, item 6 honestly untested (B1).
4. **Attrition:** honest; not extending is right; A01 and the wording need correcting (B5).
5. **Labels:** blind, as verified from transcripts; provenance honest (B7).
6. **Next step:** supported by the sole-blocker argument, not by frequency (B2).
