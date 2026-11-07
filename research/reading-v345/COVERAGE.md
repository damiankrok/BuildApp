# Reading skills: what was tested before v3.45, and what was missing

Inventory of the repository at E13 (`ebfb484`). "Real" means a publisher's original image; "synthetic" means a raster
drawn by a test helper or `packages/synthetic-drawings`; "fed" means the test hands the function already-made inputs.

**Finding.** Before v3.45 no vitest test read a real publisher image, and no real-image annotation set covered the
meaning of a number, its binding to a target, or elements. Real-image scoring existed only in research scripts, for
view roles and for dimension-label digits. So the pre-existing tests show that a function does what it says on its
inputs; they do not measure whether the analyzer reads drawings.

| Skill | Before v3.45 | Missing | Added in v3.45 |
|---|---|---|---|
| 1. View type & region | Roles from slugs/captions (source-package, 112 tests, no pixels); content-veto logic on fed probabilities; image-role encoder determinism; 1352 ARCHON images labelled by an agent from pixels (`research/image-understanding/data`), scored by research scripts only | No ROOF_PLAN class; multi-view sheets never split; classifier accuracy never asserted; misleading captions measured only once (S01) | 908 images, 33 projects, annotated from content (`annotations/views-*.json`); scorer against the observation graph and, separately, against the pixel-only classifier (caption-blind layer) |
| 2. Storey & direction | Storey and side from captions only (metadata tests); synthetic storey tests with fed chains | Storey never read from pixels; section cut lines not detected; mirroring by words only | Storey and side per image in the same annotations (attic vs full upper storey decided from the section: both full-height upper storeys the captions call "poddasze" are labelled UPPER) |
| 3. Numbers & what they measure | Synthetic OCR (source-metrics, ~100 tests), PP-OCRv6 runtime on synthetic labels; 81+22 dimension labels from real crops (005E/005G) | No labelled set for level marks, angles, callouts or room numbers; ROOM_AREA has no parser | Every printed number on 33 sections (levels with kind: ridge/eaves/floor/terrain/other, angles, vertical dimensions); 91 EVAL ground-plan callouts with text, ring and target; 80 room numbers with their ink position on the 8 EVAL plan sheets the reconstruction reads (`annotations/room-numbers-eval.json`); scorers (`scoring/score_levels.py`, `score_callouts.py`, `score_room_numbers.py`) |
| 4. Binding (measure → target) | Drawn chains/topology tests; callout → gap only with fed inputs; room number → room on synthetic plans | No real-plan labels for text → line/tick/face, callout → opening, or room number → room | Callout → opening scored on real plans through the solver's feature trace (gap pixels + bound callout + family); complete assignment = gap found AND bound values exact AND kind compatible; room number → the ink it is printed on (token level), and the model's numbered rooms against the published areas (proxy, `scoring/rooms_model.py`) |
| 5. Elements | Synthetic end-to-end and raster tests (~400); 7 houses of body polygons; Marcówki source truth (1 house) | No dormer reader; sliding doors by width only; no precision/recall of any element type on real plans | Opening presence counted per annotated callout (MISSING_OPENING); additions counted (bound gaps at no annotated callout) |
| 6. Relations & map | Registration round trips on fed anchors; synthetic facades | The map was only checked for self-consistency; no real scale truth | Section ladder checked against an independent annotation (the printed levels); +0,15 m correlated-shift negative test kept |

Data outside the repository (originals, caches, run outputs) stays in the private evidence directory; this folder holds
only textual facts (hashes, URLs, codes, printed numbers).
