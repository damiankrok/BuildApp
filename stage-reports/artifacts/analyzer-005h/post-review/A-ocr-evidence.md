# Red team A — OCR evidence and non-circularity (005H, c6fe174..d04ebc4)

Read-only review; one probe calling `ensembleOf` directly.

| # | sev | finding | where |
|---|-----|---------|-------|
| 1 | P1 (near P0) | `CONTESTS` attaches a full-strength `rival` whatever the external confidence (probe: CLEAR 1410 vs external 1950 at p 0.05, unstable → rival 1950). Downstream it is ratio 1 in `latticeAlternatives`, confidence 1 in `correctionReadings`, cost 1 in `altCost`, can raise `CANDIDATE_CONSENSUS`, and `selectedValueOf` can pick it alone. Contradicts the module's own header; 005G P2 never made an unconfident external reading a candidate. | ensemble.ts:108-112; metric-solution.ts:419,465,504,1109-1124,1360 |
| 2 | P1 | Disagreement demotes CLEAR → AMBIGUOUS with no confidence floor, `CONTESTS_COUNT` included (p 0.02 `11410` vs CLEAR `1410`); the lattice's own count rival needs rivalP ≥ 0.1. Once AMBIGUOUS, `contestValues` widens to same-count alternatives. | ensemble.ts:108-113; numeric-lattice.ts:1176; metric-solution.ts:375,1007 |
| 3 | P1 | Decimal-separator branch is asymmetric: confident disagreement with a stray dot in greedy (`1.910` vs CLEAR `1410`) → NOT_COMPARABLE (stays CLEAR), agreement still upgrades. | ensemble.ts:96-99 |
| 4 | P1 (owner decision) | `LEADS` over a LOW_QUALITY / empty lattice makes the external reading alone SUPPORTED (decisive); two such LEADS satisfy 005E's corroborating-pair rule. Matches 005G P2 as scored, but is fallback-like on that subset. | ensemble.ts:116-128; metric-solution.ts:564,1007 |
| 5 | P2 | Crop key carries the custom reader's text (`ocr-lattice-<text>-<digest>`), a non-image channel into the worker. | extract.ts:419,429 |
| 6 | P2 | Schema 1.6.0 / ensemble extractor / recogniser hash part applied when a recogniser is wired, even with zero crops read. | extract.ts:799,813 |
| 7 | P2 | Summary `corroborating` counts CONTESTS at any confidence; `disagreements` includes LEADS with no lattice value. | run.ts:577-579 |
| 8 | P2 | Ensemble trusts self-reported `stable`; never checks the four variants. | ensemble.ts:92 |
| 9 | P2 | Weak tests: crop-invariance test varies only tolerance/specs; `ensembleOf.length === 2`; architecture test scans only the crop block (crop selection is gated by image geometry upstream — no real circularity); no pre-005H OFF hash pinned. | recogniser-ensemble.test.ts:114,234; tests/architecture/recogniser.test.ts |
| 10 | P2 note | 0.90 bounds calibrated on drawn-box crops, production cuts at `token.passBox`. | build-dataset.ts:297 |

Sound: OFF byte-identical by inspection; ocr.ts, reconstruction, lattice thresholds untouched; no onnxruntime in source-metrics; crops image-only, one inference per crop; other-count values never rivals; hash consistent; evidence pack as required.

Verdict: plumbing clean; ensemble rule needs 1–3 before freeze; 4 is an owner decision.
