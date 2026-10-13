# 005P review round 2 — dispositions

Reviewed commit `f37e410` (the round-1 fixes). Two reviewers: F (did the fixes fix it, did they break anything) and G
(a fresh adversary aiming at a blind house), two adversarial verifiers per P0/P1. Raw: `round-2-findings.json`.
**0 P0. 1 P1 (G2-1: verifier 1 kept P1, verifier 2 downgraded to P2). 1 P2, 11 P3.**

**Independent confirmations (not findings).** F compared HEAD's as-printed path with the verbatim 5906afa
`sourceConflictOf` as full objects on 96 000 random plans (lattices, ensembles, copied ids, duplicated crops,
dependsOnScale, anisotropic registrations, metric solutions, the PARTIAL_BINDING path): **0 mismatches**. PROD2 = N1 byte
for byte on all 44 for model, program, summary and failure; the AMBIGUOUS gap is present when `reconstructV2` runs
directly on glogownikach's sealed inputs (model `b7c86aac`, unchanged). G: Node 18-compatible syntax and APIs; no path or
publisher text in the gap or trace.

| id | sev | finding | disposition |
| --- | --- | --- | --- |
| G2-1 | P1/P2 | the reading that withdraws glogownikach's accusation (PP-OCRv6 870) is a witness the registered scale's own solution cites: in a mirror world where it is wrong, N1 builds an 8 %-off house where 1.4.0 refused or VERIFIED the other scale | **FIXED for the circular case by N1a** (preregistration addendum A, committed `bc4f6c3` before any N1a run; implemented `27d9801`): a reading the solution cites may not vouch for the registration. Re-run of the reviewer's own reproductions on N1a: single-reader mirror (only the cited 870 contests) → **1.4.0's outcome restored** (decoy 0.7927: REPLACED 2.432039 VERIFIED, model `da496631` = 5906afa's; decoy 0.8577: SOURCE_CONFLICT refusal). Two-reader mirror (the uncited 541 also contests 501) → still withdrawn: that is not a circular defence but the policy's generic risk (an independent, corroborating external reading wrong), **accepted and disclosed** with its measured bound: corroborating PP-OCRv6 wrong 0/459 weighed statements on the 44 rows (same truth population as 005O's 0/507; rule-of-three ≤ 0.65 % per statement). Every M1-family variant (P1–P3) carries the same generic risk |
| G2-2 | P3 | a confident LATTICE reading (wrong 41/164) can defend a registration | **RECORDED**: the lattice was wrong while the as-printed value was right once in 164; with N1a a cited lattice reading cannot defend; residual is the generic risk above |
| G2-3 | P3 | the record does not show a single reading was decisive | **FIXED in part** by F2-1 (the list now names only statements the withdrawn charge reads; on glogownikach's real replay the list shrinks from 6) and by the `cited` mark; a "decisive" flag is not added |
| G2-4 | P3 | T1 reason says "as read" for a share under doubt | **FIXED**: the reason says how a contested label was counted |
| G2-5 | P3 | the gap is invisible in replay artifacts | **ACKNOWLEDGED**: `second-house.ts --metrics` writes no `unresolved`; the gap is held by `statement-contest-emission.test.ts` (late and early paths) and was checked by reviewer F on the real glogownikach inputs; production scripts are not changed for it |
| F2-1 | P2 | `doubted` names statements a withdrawn charge never reads (3 of 6 on glogownikach) | **FIXED** `27d9801`: T1 weighs every statement, T3 only long ones; fixture "an OUTER_TOTALS withdrawal does not name a short contested statement"; mutant X20 killed |
| F2-2 | P3 | a standing trigger whose accusation moved (other scale/statements) records nothing | **ACKNOWLEDGED, not changed**: the trigger still stands and its full record is in the challenge; the movement is visible in the as-printed audit (`sourceConflictAsPrinted`) |
| F2-3 | P3 | a doubt-moved registration share names no statement | **FIXED**: `shareMovedBy` / `registrationShareMovedBy`; fixture asserts the 50 px statement is named |
| F2-4 | P3 | early-path gap text says "the scale stands"; early path untested | **FIXED**: neutral wording; early-path end-to-end test (withdrawal recorded, no challenge, same outcome and code as the incumbent) |
| F2-5 | P3 | assertions weaker than titles; oracle only trigger sets | **FIXED**: the frozen oracle holds full 1.4.0 objects and the test compares `sourceConflictAsPrinted` object for object on 2000 plans; clause 3 asserts its doubted list |
| F2-6 | P3 | the mirror fixture is vacuous | **FIXED**: removed; the test says a mirror changes no span length, which is all the test reads |
| F2-7 | P3 | stale comments after the rename | **FIXED** with the N1a commit |
| F2-8 | P3 | dispositions rely on a report not yet written | **FIXED by the stage report** |

The adopted change after round 2 is **N1a**. It is measured on production replays of all 44 rows (with repeat and
strip-external control) against the same gates before Phase D.

**Amended after review round 3 (J-1, J-3, J-5).** (1) "Not a circular defence" overstated it. On glogownikach the
remaining defence of the registration is PP-OCRv6's 541 on 1fce7f3126: it is not cited by the frame's metric solution
(N1a's test), but it is the same recogniser that leads the solution's counted witnesses, and the accused registration's
own anchor on that statement is a CHAIN_CORRECTED 5.41 m derived from the scale (`dependsOnScale`, the pre-existing
self-anchoring of the first-bad ledger). So the reading is correlated with the registration's evidence, and the
remaining case is a correlated-reader risk, not an independent witness. N1a removes the solution-level circular defence
only; it does not treat registration anchors as citations — a CHAIN_CORRECTED anchor's value is derived from the scale,
not read from the ink, so matching readings against it would be a different rule (not preregistered; recorded as the
next stage's candidate together with "CHAIN_CORRECTED never anchors"). (2) Addendum A's mirror prediction HELD for the
single-reader mirror and FAILED for G2-1's main two-reader real-evidence mirror (decoys 0.7927 / 0.8577: N1a still
completes `b7c86aac` where 1.4.0 replaced or refused); commit `c3ca1c6`'s "restores 1.4.0's outcome on the reviewer's
own circular-defence reproduction" holds for the single-reader variant only. (3) "The withdrawal names exactly
1fce7f3126" holds for the doubted list; the withdrawn charge's evidence is 1fce7f3126 and f810c24db9, whose 870 is set
aside as cited (named under `cited` since round 3's fix H3-1).
