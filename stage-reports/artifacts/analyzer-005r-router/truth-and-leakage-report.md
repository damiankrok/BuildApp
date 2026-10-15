# Truth and leakage — 005R-ROUTER

## Truth available, by what it can and cannot support

| truth | status | supports | does not support |
| --- | --- | --- | --- |
| Human scene labels | **NOT_RUN_HUMAN_TRUTH** — no person labelled anything; a local spot-review task (300 items, 5 strata, seeded) is prepared and optional (`truth/owner-spot-review-request.md`) | — | any interior/exterior accuracy, any scene-gated router (R2) |
| 005R structural truth (carousel position, elevation tab, floor fragment, header) | PUBLISHER_STRUCTURE — the publisher's filing; wrong for at least 15 exterior styling views (005R B-1) | counts labelled "PUBLISHER_STRUCTURE (circular, not truth)" | scoring R1 (same channel), any claim of independence |
| Bit-level comparison R0 vs N1 on sealed development packages | **TECHNICALLY_INDEPENDENT** | invariance claims: the model, orthographic evidence, metric evidence, ledger outside perspective evidence | anything about which pictures are interiors |

## Leakage of interior pictures into facade evidence

- **Before (R0, production base):** every `PERSPECTIVE_RENDER` frame is read by the five orthographic facade
  extractors. On the 34 development rows with a valid baseline: 381 perspective frames, **14 987** facade observations
  (OPENING 6 923, LINEAR_VOLUME_CANDIDATE 2 684, SURFACE_REGION 1 648, ROOF_EDGE 1 524, LOGGIA 1 025, MASS_REGION 381,
  SILHOUETTE 381, RIDGE 370, WALL_REGION 51). How many of those frames are interiors is **NOT_MEASURED** on independent
  truth. By PUBLISHER_STRUCTURE (byte match to 005R's carousel truth, not truth): 68 of the 403 perspective assets in
  the 37 development packages are filed as interiors, 261 have no structural label, 74 are not in the 005R corpus.
  005R measured 107 EVAL interior lineage groups reaching these extractors, by the same structure.
- **After (N1, measured, not adopted):** 0 facade observations on any perspective frame (all 37 rows). This holds
  whatever the scene, so "0 interior→exterior *through the deterministic facade extractors*" needs no scene truth. It
  says nothing about the vision channel (`tasks.ts:38`, off in every product path, not measurable without sending
  pixels) and nothing about an interior that would be filed as `ELEVATION` (P9: 0 of 198 structural elevations are
  filed as perspective; the reverse case has no measured instance in 005R V0a either).
- **Ledger (P8, 7 rows with 25 solved perspective cameras):** N1 removes only records about perspective evidence;
  922 of them were `USED_AS_CORROBORATION` with the reason "depth order was checked against it", a check no code
  performs (FB-3). Cameras, solved counts, model hashes identical.

## Router candidates and scene truth

- **R1** (meta-provenance, research only): 1 352 assets → 198 INTERIOR_HINT, 39 EXTERIOR_HINT, **15 CONTESTED** (exactly
  005R's C1 styling views: carousel says interior, caption says styling), 1 100 UNKNOWN. **0 assets carry two scene
  witnesses from different independence classes**. 38 lineage groups with a scene hint span editions (never merged).
  Agreement with 005R truth is circular and is not reported as accuracy.
- **R2** (scene gate on two independent witnesses): therefore gates **0** frames: R2 ≡ R0 in behaviour.
- **R2w** (one-witness diagnostic, never adoptable): see the stage report; its effect is bounded by N1's.
- **R3**: NOT_RUN (no new measured content signal; V1/V2 barred by 005R).
