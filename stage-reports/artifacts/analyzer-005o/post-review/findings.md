# 005O — post-review findings

Three focused reviewers on `0123ac2` (A: metric leakage and calibration; B: topology/kernel, open-side and storey safety, forensic claims; C: licences, mobile/runtime, performance, reproducibility). Every P1 was reproduced independently before its disposition. Full reviewer text is outside the repository (`/home/user/work005o/review/review.json`).

| id | reviewer | filed | after reproduction | finding |
| --- | --- | --- | --- | --- |
| L1 | A | P1 | P3 | Missing-candidate control is vacuous: the replay used the full sealed evidence with an empty view, which is the M0 run |
| L2 | A | P1 | P1 | The 'classic token text' row of the reader table is not the token text: for READ statements it is the evidence value, which often already holds the ensemble's correct reading |
| L3 | A | P2 | P2 | Same-ink duplicates inflate label counts, and the Wilson intervals treat them as independent; deduplication is inconsistent |
| L4 | A | P2 | P2 | M3 departs from the preregistered rule: it resolves (promotes to 'printed') members that are not contested and are frozen-unstated, with no check that the value is in K, and it fixes uncontested members to their current value |
| L5 | A | P2 | P2 | The 'scale-free' arithmetic runs on the frozen zero list, so a READ value whose orientation a scale chose can drive an ARITHMETIC_RESOLVED value that then votes |
| L6 | A | P2 | P2 | The single seam fans out to five consumers; metricsAtScale's output changes even though its text does not, and the scorer scores only asRead |
| L7 | A | P2 | P2 | The transcription control values were seeded with glogownikach's forensic values, and this is not disclosed |
| L8 | A | P2 | P2 | Truth is a transcription of the token box (+35% pad), the same pixels PP-OCR reads, so '0/507' measures agreement on the crop, not correctness of the printed dimension |
| L9 | A | P3 | P3 | Jarzabem copy-ratio claim: supported, but post-hoc; the frame's own truth readings disagree by 3.1%, and the report quotes mppX while the scorer uses the mean |
| L10 | A | P3 | P3 | kosacce-tracked is scored UNKNOWN_TRUTH although its evidence is byte-identical to kosacce-clean's (truth 2.4065) |
| L11 | A | P3 | P3 | The description of the remaining 122 M1 WRONG is slightly inaccurate |
| L12 | A | P3 | P3 | Smaller fidelity issues in the generator and scorer |
| T1 | B | P1 | P1 | '0 PDF sources in 44 cases' is false; PDF.js OUT_OF_SCOPE rests on a count that can never find a PDF |
| S1 | B | P1 | P2 | dom-pod-jarzabem: M1-family changes open-side, covered-terrace and wall semantics; reported only as 'still FAIL' |
| S2 | B | P1 | P1 | M2/M3/M3b raise a false SOURCE_CONFLICT on kosacce-area-alone, refuting the correct scale and preferring one 40 % wrong; the report says these rows give the variants nothing to act on |
| S3 | B | P1 | P2 | M1b A07 and D00 ended in INTERNAL_ERROR but are scored COMPLETED/PASS (A07 is a known-good storey row) |
| T2 | B | P2 | P2 | Door-closure argument omits the sealed run's OPENING_IN_WALL decision; the TRUE_EXTERIOR_GAP/NONE claim is uncited and the artifact's boolean is a width threshold, not a measurement |
| F1 | B | P2 | P2 | Murajach §B2 explains the 005N-code refusal but labels it the blind-9 failure; the frame-selection flip is not mentioned and the inventory has no reproducer |
| S4 | B | P2 | P2 | Changes in the decision path on unchanged rows are not reported ('Akebiach is unchanged'; rarytasy-eoze conflict trigger flips) |
| N1 | B | P3 | P3 | Numeric inconsistencies between the report and the artifacts (glogownikach and jarzabem scales) |
| T3 | B | P3 | P3 | Snap-window distances are axis-to-axis; with the band rectangles the gaps are smaller, and the wing joints are within existing tolerance |
| H1 | B | P3 | P3 | Worktree dirty: 15 tracked PNG screenshots modified |
| LMP-1 | C | P1 | P1 | Who produced the label truth, where it ran, and with what prompt is not recorded, and the licensing matrix leaves this data flow out |
| LMP-2 | C | P2 | P2 | The latency ratios and the Node 22 vs Node 18 timings come from unmatched, partly concurrent runs, and the stated noise band is wrong |
| LMP-3 | C | P2 | P2 | The licensing matrix misstates PP-OCRv6 training-data rights and lists LSD as Apache-2.0 |
| LMP-4 | C | P2 | P2 | The architecture test's 'outside the repository' guarantee only checks docstring text; three pixel writers have no runtime guard, and glyph_corpus.py writes into the repo by default |
| LMP-5 | C | P2 | P2 | The report has no runnable command sequence: §L points to a §P that does not exist, the Node 18 bundle command is missing, and referenced files are absent |
| LMP-6 | C | P2 | P2 | The M1b production cost estimate leaves out the OCR session cold start |
| LMP-7 | C | P2 | P2 | The worktree has 32 tracked PNG evidence screenshots from earlier stages modified by a gate run |
| LMP-8 | C | P3 | P3 | performance.json is rebuilt from whatever run logs are current in the work dir, so any rerun silently changes the committed numbers |
| LMP-9 | C | P3 | P3 | The p95 formula picks the minimum for n=2 and roughly p93 for n=44 |
| LMP-10 | C | P3 | P3 | The '7 font families' in the glyph corpus are fewer independent typeface designs than the cluster count implies |
| LMP-11 | C | P3 | P3 | Small report inconsistencies: the verdict pointer, the determinism wording and the M0 baseline label |

33 findings; P0 0; P1 filed 7, P1 after reproduction 4 (L2, T1, S2, LMP-1).
