# 005J post-implementation council — resolution

Six independent reviewers. None saw another's review before writing.

| reviewer | topic | verdict | P0 | P1 |
| --- | --- | --- | --- | --- |
| A | floor-plan computer vision | CHANGES REQUESTED | 1 | 6 |
| B | VLM / edge AI | ⟪B_VERDICT⟫ | ⟪B_P0⟫ | ⟪B_P1⟫ |
| C | training data and evaluation | CONDITIONAL PASS | 0 | 6 |
| D | licensing, provenance, supply chain | CONDITIONAL PASS | 0 | 2 |
| E | BuildPlan architecture and integration | CHANGES REQUESTED (on the 005K spec; freeze PASS) | 0 | 8 |
| F | generalization red team | ⟪F_VERDICT⟫ | ⟪F_P0⟫ | ⟪F_P1⟫ |

**What changed because of the council.**
- The primary action (TRAIN_BUILDPLAN_WALL_MODEL) stands.
- Its 005K specification was rewritten:
  - a two-signal witness at IP-01 only;
  - no OPEN_SIDE split;
  - a pre-pass design;
  - a split into 005K-a / 005K-b with a stop rule;
  - a deterministic fallback.
- A research **oracle replay** was run in 005J, as A and E required.
- Two measurement errors in the real question geometry were found and corrected (A2/C1, C2).

## A — floor-plan CV

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| A1 | **P0** | The gap witness, as designed, would move neither round-8 house; no replay was run | **Fixed by measurement.** `replay/oracle_replay.py` re-solves the sealed runs with an oracle witness (`oracle-replay.json`). Gozdzikowcach: one 0.41 m LEAF_FACE gap completes the house at −3.75 % (storeys still fail). Cyklamenach: no gap upgrade moves it. Development matrix: 1 model change, 0 verdict changes. The UNet reads the decisive gap ≈ 94 % OPENING on its axis. The recommendation now claims exactly this and no more (`recommendation.md` §2–§3) |
| A2 | P1 | REAL_DEV strips sat on the outer face; production stores no `axisPx` | **Fixed.** `wallproof/axis_remeasure.py` re-measures on the axis: UNet 61/63 OPENING (47 at ≥ 0.8, 0 wrong). Report §F shows both columns. 005K-a takes the strip from the jamb bands and persists `axisPx` |
| A3 | P1 | False positives were reported for WALL only; the witness consumes OPENING | **Stated.** Report §G and recommendation §2 carry the reviewer's numbers (open gaps 44.5 % OPENING, dimension ink 18 % OPENING). 005K-a gate: the witness must read BACKGROUND on drawn-but-open gaps |
| A4 | P1 | The witness is not "like a callout" and bypasses the pattern guard | **Fixed.** Callout-equivalent two-signal rule: drawn evidence (incl. pre-override signatures) **and** model OPENING; BLANK excluded; stability bracket (§5.5) |
| A5 | P1 | The IP-02 split is undefined and contradicts "never creates a gap" | **Fixed.** The split is removed from 005K; REC-03 / UP-06 is a separate coordinator decision |
| A6 | P1 | "7 of 12 P0 seams" double-counts | **Fixed.** Now "3–4 distinct gap decisions among 7 distinct P0 decisions" |
| A7 | P1 | "Not more wall" holds only for IP-01 | **Fixed** by dropping IP-02 from 005K; the claim is now scoped to the gap reading |
| A8–A12 | P2 | UNet vs MiT axis; blind-8 box coordinates; "pre-registered" wording; crop-mode latency extrapolated; citation drift | Accepted. MiT-B0's lower false-OPENING rate is recorded in `verdicts.json`. The pier box is corrected (C2). The rules are described as "fixed before the scoring run". "≈ 0.1 s per crop" is labelled an estimate. `withCallout` is cited at `:2808` |

## C — training data and evaluation

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| C1 | P1 | REAL_DEV targets on the outer face | **Fixed** with A2 (same re-measurement, both models) |
| C2 | P1 | The gozdzikowcach pier is misplaced; "36 % wall" was a question error | **Fixed.** The question is excluded from scoring for every arm (`exclusions.json`). The pier box is moved to x 435–452 and reads 100 % wall in both models. With B on the pier, both answer TERMINATES (0.98 / 0.97). The limitation is removed from the training plan, report, recommendation and verdicts |
| C3 | P1 | The cyklamenach analogue tests an easy negative; no real PATTERN question | **Stated** (report §G); generator v2 adds patterns **on the wall line**, and the balanced real set must include real PATTERN |
| C4 | P1 | Generator v2 fixes the shortcut in one direction only; pairs not minimal | **Fixed in the 005K spec**: faint-symbol positives and minimal pairs |
| C5 | P1 | Real evidence is tiny; ≤ 0.5 % cannot be shown at the planned size | **Fixed in the 005K spec**: the unit is stated; the gate is an upper bound on a stated n; ≈ 600 independent questions per class are needed to show ≤ 0.5 % |
| C6 | P1 | The legal claim contradicts Route C; teacher unexamined | **Fixed** with D1 |
| C7–C14 | P2 | Class↔family coupling; corpus-doc errors; scorer details; pilot composition; pre-registration wording; label quality; blind-8 coverage; units | Partly accepted. C9a: the majority-baseline tie is now deterministic, and balanced classes give no "minority". C9b: consistency is quoted on answered pairs. C9c/d (lenient-parser confidence, pseudo-replication) and C7/C8/C12–C14: stated as limitations (report §O); not re-run |

## D — licensing and supply chain

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| D1 | P1 | Route C trained on publisher crops and used a hosted teacher on them | **Fixed.** Real crops are evaluation and calibration only, in every route. A teacher on real crops is CONDITIONAL on counsel, with the counsel questions named (training plan, recommendation §6, licensing §4.6–4.7) |
| D2 | P1 | The "clean-room" claim for MiT-B0 is overstated | **Fixed** in all places: "independent re-implementation, not clean-room; its structure follows the Apache-2.0 PVTv2 / HF code". A MiT fallback would be built on that code with its notice |
| D3–D11 | P2 | Florence sample identity; NC research use; clones not deleted; oracle crops; fonts; isolation-test breadth; environment locks; MitUNet grounds; SmolVLM v1 wording | All fixed. Florence caveat narrowed to the reviewer's sample. ResPlan / RESEARCH_ORACLE_ONLY reworded. Clones and ResPlan data deleted. The 47 publisher crops read by the oracle are stated. Fonts and Pillow pinned. The isolation test checks base64 payloads in every audit file, long numeric arrays, size, and more asset types. Environment locks committed and checkpoint hashes recorded. MitUNet grounds named. SmolVLM v1 is "relatively" cleaner |

## E — architecture and integration

| id | sev | finding | resolution |
| --- | --- | --- | --- |
| E1 | P2 | Freeze verified; notes on how it is stated | Accepted. The report states the hash method (`sha256(git ls-files -s)`) and the empty production diff |
| E2 | P1 | The OPEN_SIDE split is a decision rule | **Fixed.** Removed from 005K |
| E3 | P1 | Single-signal upgrade ≠ `withCallout` | **Fixed.** Two-signal rule (§5.5) |
| E4 | P1 | No counterfactual replay; the round-8 outcomes would not move | **Fixed by measurement** (A1). Gate 7 now covers outcomes, not only first bad decisions. The report says cyklamenach needs REC-17 / TOO_LARGE and gozdzikowcach the storey seam |
| E5 | P1 | The query-volume plan is circular for a witness | **Fixed.** The witness is asked unconditionally for every eligible gap (7–64 per house, median 24). Refusal-triggered figures are restricted to the rejected server option |
| E6 | P1 | No execution design | **Fixed.** A deterministic tiled pre-pass is recommended; the strip is sized from the jamb bands, not metres |
| E7 | P1 | Missing 005H items | **Fixed in the 005K-b spec**: hosting and training record, self-test, architecture test, the bundle test, failure policy, memory bound |
| E8 | P1 | Conflict with 005I's PATH B unstated | **Fixed.** Recommendation §4: 005K displaces PATH B (only 2 of 26 sources carry a PDF); the coordinator decides the order; 005I's "evidence already present" is reconciled |
| E9 | P1 | No stop rule | **Fixed.** 005K-a / 005K-b, with the deterministic fallback measured by the replay |
| E10–E13 | P2 | Pack records; citations; flag semantics and parity cap; witness ≠ corroboration | All folded into the 005K spec (§5.1, §5.5, 005K-b items 4–5) |

⟪B_SECTION⟫

⟪F_SECTION⟫
