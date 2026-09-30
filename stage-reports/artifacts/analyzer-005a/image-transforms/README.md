# Image transforms — measured, not gated (005A)

This is Council G's metamorphic experiment on the synthetic houses (Ashby, Holloway, Larchfield, Marlow,
Redmire). Every sheet is transformed, then read through the whole pipeline.
- **Before:** `before.jsonl`, measured on `7cd8e0c` at the Council audit.
- **After:** `after.jsonl`, the same harness on this stage's code, plus four transforms the Council did not run
  (resize 0.5, 0.6 and 1.5, and binarize).

The rule is the Council's decision (`../council/pre/08-test-leakage-audit.md` §4.5): reported, not gated. The OCR is
bound to pixel density (ASSUMP-IMAGE-001), and fixing it was outside this stage.

A row is **equivalent** when the body count equals the untransformed run's and the footprint is within 6 % of it.
It is **silently different** when the run completes with a different building. It is **refused** when the run
ends in a named `ReconstructionFailure`.

| | before (48 cells) | after, the same 48 | after, all 60 |
| --- | --- | --- | --- |
| equivalent | 39 | 39 | 46 |
| silently different | 6 | 6 | 7 |
| refused, by name | 3 | 3 | 7 |

- On the 48 common cells, nothing moved down. Redmire at 1.25× changed from `PLAN_NO_ENCLOSED_CELLS` to
  `PLAN_RESOLUTION_INCONCLUSIVE`: still refused, now with the readings weighed and named.
- **The silent rows are the open risk.**
  - Holloway loses its garage wing at every downscale (0.5, 0.6, 0.75) and at 1.5×.
  - Ashby reads 45.4 m² instead of 48.4 m² at 0.75×, and 96.0 m² at 0.5×.
  - Marlow drops its wing under JPEG q40.

  The resolver does not run on these, because the first reading holds, and nothing in the drawing refutes the
  smaller building. These rows are not claimed as fixed.

## Re-measured after the post-implementation Council

Every change up to resolver 1.2.0 is in, including the opening drop and the acceptance rules. The harness is
unchanged. The results are in `after-post-council.jsonl`. **All 60 cells are identical to `after.jsonl`**: the
same model hash, or the same failure code. `after.jsonl` predates the opening drop (`f1901e9`) but not its effect.

"Equivalent" means the same body count and a footprint within 6 %. It says nothing about the roof, the levels
or the openings, which is a limit of the definition (Council G). Among the 46 equivalent cells:
- **One lost its roof entirely:** Ashby under JPEG q40 reads no roof kind (`GABLE/X/38.0` → none).
- **Six read the pitch 0.2–2.2° off:** Holloway at 1.25× and q40, Larchfield at 0.5× and 1.5×, Marlow at
  0.75×, and Redmire at 0.75×.
- **One found an extra opening:** Marlow at 1.5×, 8 → 9.

These rows are not claimed as equivalent in any wider sense.
