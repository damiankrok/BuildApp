# 005P review round 3 — dispositions (N1a)

Reviewed commit `1329a4b` (N1a on production). Three reviewers: H (N1a correctness and residual circularity, against the
verbatim 5906afa module), I (tests, mutation adequacy, determinism; 22 hand mutants in a throw-away worktree), J (claims
vs evidence, every committed matrix regenerated from the replays). Raw: `round-3-findings.json`. **0 P0, 0 P1** (so no
adversarial verification ran), **7 P2, 12 P3.** Fixes: `15a2d4a` (code, tests), `94782ac` (claims, scorer, gates),
`ef648ca` (production replays PROD4, rescoring), `761a28d` (mutation gates 30/30).

**Independent confirmations (not findings).** H: a proof that N1a only shrinks a contest's values, so 1.5.0's triggers stay
a subset of 1.4.0's and N1a's a superset of N1's; runs on 20 000 seeded plans with random (15 % deliberately wrong-ink)
citations and 11 781 checks on the 44 real evidence sets (every observation cited, every confident reading cited,
registrations ×0.85–1.2, walls 6/10/16 px): 0 new trigger, 0 larger share, 0 as-printed mismatch with 1.4.0, 0 N1a
withdrawal that N1 lacks; with every reading cited N1a = 1.4.0 (2245/2245). On the 44 rows 287/287 supporting
observations on a statement's ink join by lattice id. I: the full reconstruction suite and tests/architecture pass at HEAD
(858/858). J: every committed matrix regenerates byte-identically; PROD3 = N1 on 44/44 decisions; PROD3 = PROD3-rep byte
for byte; PROD3-noext = P0 decisions; the eoze soundness verdict is true.

| id | sev | finding | disposition |
| --- | --- | --- | --- |
| H3-1 | P3 | a cited reading that ends its statement's contest appears in no record | **FIXED** `15a2d4a`: `SourceConflict.cited`, `withdrawn.cited`, trace `cited`/`citedCount`, challenge `conflictCited`; on the real rows glogownikach's record names `f810c24db9=AS_PRINTED 810\|EXTERNAL 870 (cited)` and eoze's `55ef3f8509=AS_PRINTED 1601\|LATTICE 1600 (cited)\|EXTERNAL 1600 (cited)`; mutant X30 |
| H3-2 | P3 | a duplicated crop under another lattice id escapes the citation | **FIXED** `15a2d4a`: the citation is keyed on the ink (frame, box, orientation via `latticeKey`), not the record id; fixture "a duplicated crop: a citation …"; mutant X26. 0 such crops on the 44 rows (decisions unchanged, PROD4 = PROD3) |
| H3-3 | P3 | stale `doubtedText` comment (TOKEN) | **FIXED** |
| I-1 | P2 | other-frame / non-supporting citation mutants survive | **FIXED**: fixture "a citation by another frame’s solution, or by an observation the solution does not rest on"; mutants X24, X25 |
| I-2 | P2 | one-sided N1a mutants (T1 rivals, T3 defence) survive | **FIXED**: fixtures "on T1 a cited reading …", "on T3 cited readings cannot defend …"; mutants X27, X28 |
| I-3 | P2 | the 1.4.0-oracle property test never runs N1a | **FIXED**: a second property test over the same frozen oracle with the plans' own solutions citing readings at random (seed 777): as printed = 1.4.0 (five fields), no trigger 1.4.0 lacks, no larger share, a withdrawal only where N1 withdraws, order-invariant; asserts > 300 cited plans and > 20 changed by the citations |
| I-4 | P3 | the as-printed-never-set-aside rule half pinned | **FIXED**: fixture "the as-printed value is never set aside …"; mutant X23 |
| I-5 | P3 | a value-only citation key survives | **FIXED**: fixture "a value cited on another ink …"; mutant X21 |
| I-6 | P3 | the cited mark and trace untested | **FIXED**: fixture "a cited reading … is traced as cited"; mutants X29, X30 |
| I-7 | P3 | mutations.mjs has one N1a gate | **FIXED**: X21–X30; **30/30 killed by the intended assertion** (`mutation-results.json`) |
| I-8 | P3 | "exactly the 1.4.0 accusation" compared against a mode that itself runs N1a | **FIXED**: the five 1.4.0 fields are compared with the uncited as-printed test (= 1.4.0 by the oracle suite); `doubted`/`cited` asserted separately |
| J-1 | P2 | the remaining glogownikach withdrawal called non-circular; the accused registration's anchor on that statement is 5.41 m | **CLAIM CORRECTED** (round-2 resolution amended; `hypotheses.md`): N1a removes the solution-level circular defence; the remaining defence (PP-OCRv6 541, not cited) is correlated with the registration's evidence (same recogniser leads the solution's witnesses; the anchor is a CHAIN_CORRECTED value derived from the scale, the pre-existing self-anchoring). **Rule NOT changed**: treating a scale-derived anchor value as a citation of a reading would be a new, unregistered variant after the results; recorded as the next stage's candidate with "CHAIN_CORRECTED never anchors" |
| J-2 | P2 | "none of this occurs on the 44 rows" false | **CORRECTED** in `hypotheses.md` and round-1 B1 |
| J-3 | P2 | addendum A's mirror prediction held only for the single-reader mirror | **RECORDED as FAILED** for the two-reader real-evidence mirror (stage report, predictions table); c3ca1c6's claim qualified |
| J-4 | P3 | dispositions cite a report not yet written | **FIXED by the stage report** (written after blind round 11, which needs the freeze first); until then the dispositions read "pending the stage report" |
| J-5 | P3 | "names exactly 1fce7f3126" true of the doubted list only | **CORRECTED** (wording; and since H3-1 the cited f810c24db9 is named) |
| J-7 | P3 | strip-external preregistered as byte-for-byte, reported as decision equality | **RECORDED** deviation: PROD-noext = P0 byte for byte on model, program and failure; trace and digest differ only by the resolver version stamp (1.5.0 vs 1.4.0) |
| J-8 | P3 | G3/G8 checks narrower than the preregistration | **FIXED** `94782ac`: the decision path now compares every PLAN_RESOLUTION / METRIC_CHALLENGE / SOURCE_CONFLICT_REVIEW record key except versions and named readers; G8 requires no trigger and ALGORITHMIC_FAIL. Rescored: PROD4 admissible, the same two rows change |

Reviews are closed: 0 P0 and 0 P1 open across rounds 1–3; every P2/P3 is fixed, corrected or recorded with a reason.
