# Red team D — generalization and overfitting (005H, c6fe174..d04ebc4)

Read-only; one decoder probe on scratch probability rows.

| # | sev | finding | where |
|---|-----|---------|-------|
| 1 | P1 | Corroboration never checks the model's own answer: the beam renormalises over {blank, 0–9}, so a non-digit frame's mass goes to its runner-up (probe: greedy `2·5` meanP 0.97 → beam `25` p 0.997; `/12` → `112` p 0.93). `hasSeparator` sees ASCII `,.` only. Decimal points, superscript mm, slash ticks → confident 10× errors; the gate cannot see them (renderLabel draws digits only). Fix: corroborate only when greedy text equals the top value. | ensemble.ts:116-134; paddle.ts:107-109 |
| 2 | P1 | Confident-wrong bound never held on production (token) crops; both readers share the token box/field/orientation, so a truncated crop gives two matching wrong reads (AGREES → CLEAR). Exact on drawn boxes is justified; CW should be checked on pass crops too. | synthetic-gate.ts; CI |
| 3 | P2 | Posterior excludes the empty reading and pruned mass; "read no digit" unreachable; `WC` → `0`. | paddle.ts:132-133 |
| 4 | P2 | Bracket weaker than documented: SCALE90 is a blur after the 48 px resize; PAD2/TRIM1 change paper only; cannot catch truncation, ticks or orientation. | bracket.ts:31-35 |
| 5 | P2 | `CONTESTS` offers an unconfident value as a full-strength rival (same as A1). | ensemble.ts:147-149 |
| 6 | P2 | Gate corpus is the corpus P2 was chosen on; no 2-digit labels, ~30 % 5-digit, no separators/units/ticks, horizontal only — a regression gate, not generalisation evidence. | ocr-corpus.ts; digit-corpus.ts:265 |
| 7 | P2 | Both readers inherit the orientation; 180°-surviving digits (98/86, 806/908) can AGREE. | extract.ts |
| 8 | P3 | AGREES raises sub-legible (LOW_QUALITY by cap < 10 px) reads to CLEAR; `decisive` still checks token height. | ensemble.ts:142; metric-solution.ts:564,1141,1427 |
| 9 | P3 | `ocr-self-test.mjs` bundles synthetic-drawings outside the generalization closure's scan. | generalization.test.ts |
| 10 | P3 | Self-test "dokładne odczyty" 92/96 is in-sample; shows as accuracy. | self-test.ts; strings.xml |

Cleared: no fitted constants (beam 24/5, pad 0.35, bounds 0.90/0.90 trace to 005G/brief; no blind values in new code; lattice thresholds untouched); very wide/short crops handled.

Verdict: honest constants, thin evidence on production conditions; fix 1, gate CW on pass crops, record a fresh rotated/2-digit/separator stratum.
