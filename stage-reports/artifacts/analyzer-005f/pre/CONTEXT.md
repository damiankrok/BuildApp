# 005F pre-implementation review — shared context (read this first)

You are ONE of four independent, focused, READ-ONLY reviewers for stage BUILDPLAN-ANALYZER-005F
("adaptive glyph segmentation + extent-consistent envelope completion"). Answer only your own question.

## Why the stage exists (round-5 blind failures, two independent defects)
- `dom-w-modrzewnicy` (former blind 1, refused `METRIC_RESOLUTION_INCONCLUSIVE`, no scale adopted). Selected plan frame
  `frame-asset-rzut-8d59c92ec1-b1cad0f4fa` (asset id contains `rzut-8d59c92ec1`). Printed overalls on the vertical
  (ROTATED) left chains: `2590` (= 1950 + 640) and `1000` (= 210 + 730 + 60, horizontal, bottom). Condensed face.
  * `2590`: ink box x105–115, y427–447 (ROTATED_CW pass reads it; ~20 px along the line, cap height ~10–11 px). The
    005D reader and the 005E lattice cut it into THREE cells (expected glyph width 0.55·h ≈ 6 px → 20/6 ≈ 3). As-read
    `140` LOW_QUALITY; lattice values `100,240,140,740,200,220,540,230`: no four-glyph value is reachable.
  * `1950`: ink box x127–137, y347–366 (ROTATED_CW): as-read `1410` SUPPORTED p 0.47 (stable). The true glyphs are cell
    candidates (`9` p 0.04 score ratio 0.66; `5` p 0.08 ratio 0.71); their joint path ≈ 0.005 of the best is under the
    beam's 0.01 floor; emission stops on the count bound (18 merged, mass 0.86).
  * `640`: box x127–137, y673–688 → `600` AMBIGUOUS (truth in lattice); `1000` box 298–317 × 827–836 HORIZONTAL →
    `1000` SUPPORTED but bound UNCENTRED to a 28 px span. `1417` → `1117`/`1417`; `730` → `150`.
  * Metric: as-read total `1410` (2.895 cm/px) vs its child `600` (3.75): NO_SCALE/INCONCLUSIVE → refusal. The refusal's
    "what is missing" text says the plan prints no dimension (wrong: they were found and misread).
- `dom-w-morelach` (former blind 2, COMPLETED at −11.54 % footprint, 101.31 m² vs published 114.53). Scale is RIGHT:
  CONFIRMED/WEAK 1.9956 cm/px (printed `1212` over its span states ~1.996). Storeys 2/2, all openings built.
  Selected frame `frame-asset-rzut-63ae7d4e86-027bb2e82d` (asset id contains `rzut-63ae7d4e86`, 853×853).
  * First bad decision (Evidence Pack timeline `e00427`, stage `ENVELOPE`): long-band box `x 61–609.5, y 208.5–739`
    (33/49 cells enclosed) while the plan extent (`e00426`, DIMENSION_CHAIN_EXTENT on both axes) is `x 61–670,
    y 208.5–739`. The top chain `1212 = 380 + 732 + 100` reaches x≈670: its last segment `100` is the east kitchen bay.
  * East kitchen bay (room 5, kitchen) protrudes east of the main body roughly x 610–665, y ≈435–590 (window `180/140`
    on its east face). `e00429` (`13-body-candidates.json`) classifies a body `x 609.5–670 × y 323–716` (TALLER than
    the bay) as `FLUSH_ATTACHED`, enclosed, `NOT_BUILT`, 4.2 m², junction wall share 0.55, side wall share 0.75.
  * The garage (room 8, west, x 61–253) has its 240/220 vehicle door on its SOUTH face (~y 655–665). The garage mass
    (`mass-1`) stops at y 590 (`e00431`), so its south end is lost.
  * The opening-aware outline (candidate B) enclosed only 39.7 m² (it leaked); policies STRICT and EXCLUSION both
    adopt nothing (`"the outline adds nothing the box leaves open: the box stands"`).

## Hard rules
- Do NOT modify any tracked file in /home/user/BuildApp and do NOT run any git command that changes state (no commit,
  checkout, stash, reset, branch). The coordinator is on branch `analyzer/adaptive-segmentation-envelope-v1`.
- Scratch code ONLY under /home/user/BuildApp/.cache/<your-id>/ (gitignored), e.g. vite-node probe scripts.
- Publisher bytes are cached OUTSIDE the repo: development houses /home/user/work005d/cache; the round-4 houses
  (dabecjach, tunbergiach) /home/user/work005d/blind-cache; the round-5 houses (modrzewnicy, morelach)
  /home/user/work005e/blind5/cache (`fileByteCache` from @buildapp/source-package). NEVER copy drawings, crops, glyph
  bitmaps or overlays into the repo. Local crops/overlays may be written to /home/user/work005f/views-<id>/ and looked
  at with your image Read tool. Only text facts and numbers come back.
- No project-specific logic (no slugs, no literals like `2590`/`1950`/`1212` as decisions, no threshold chosen to make
  one named house pass). Thresholds must come from a generic argument plus measurement on the development set or a
  synthetic corpus. Published facts (footprint area) are VERIFIER-ONLY: never an input to segmentation, scale or
  envelope decisions.
- Non-circularity (005E, hard): metric scale may RANK numeric candidates the image reader generated on its own; it may
  never create one, and it may never choose a glyph COUNT.
- Deliverable: ONE markdown file written to /home/user/work005f/pre/<your file name>, ≤ 250 lines, English, measured
  (numbers from the actual bytes / sealed evidence), with: findings (P0/P1/P2), root cause, a proposed generic contract
  (rules a coder can implement, with explicit bounds), negatives/risks, and what you measured on the development
  houses so the proposal does not regress them.
- CPU: 4 cores shared with the coordinator and three other reviewers. Prefer label-level / plan-level probes
  (seconds). If you must run a whole house (2–4 min), run at most one at a time.

## Codebase map (TypeScript monorepo, Node 22, vitest; scripts: `npx vite-node <file.ts>` from /home/user/BuildApp)
OCR (workstream A):
- packages/source-metrics/src/ocr.ts — 005D reader: adaptive mask → glyph blobs → `groupTokens` → `estimateShear`
  (13 slopes) → `segment` (column-profile ink runs; a run is split into round(width / E) cells, E = max(3, 0.55·h),
  cut at the deepest column within ±0.3·E of a uniform pitch; a run narrower than 1.45·E is one cell) →
  `cellSources` → `scoreCell` / `classifyCell` (thinned 12×16 chamfer vs prototypes, hole/aspect/size priors).
- packages/source-metrics/src/numeric-lattice.ts — 005E lattice (`metrics.numeric-lattice` 1.0.0): three ink
  variants (DEFAULT/STRICT/SAUVOLA), `segmentationHypotheses` (anchor = reader's cuts; re-cuts at the two best valleys
  per anchor boundary, each valley column to either side; ≤ 2 moved boundaries; ≤ 16 per variant; cells 0.2–0.95·h;
  THE GLYPH COUNT IS NEVER CHANGED), `glyphOf` (candidates ≥ 0.6 of the cell's best, ≤ 4, softmax T 0.05), `beam`
  (nonTop ≤ 2, width 16, floor 0.01 of the path's best), merge by text (max), emit until mass 0.95 or 8 sequences,
  `ocrClassOf` (LOW_QUALITY / AMBIGUOUS / SUPPORTED p≥0.35 & margin≥0.3 / CLEAR p≥0.6 & margin≥0.3; unstable under
  the STABILITY_BRACKET ⇒ AMBIGUOUS). `LATTICE_BOUNDS`, `OCR_CLASS_BOUNDS` at the top of the file.
- packages/source-metrics/src/metric-solution.ts — 005E solver (`metrics.independent-scale` 1.2.0): M1 witness =
  as-read only; M2 contest; M3 corroboration needs CLEAR/SUPPORTED; M4 false consensus; selection AS_READ →
  STRUCTURAL → SCALE_RANKED → UNRESOLVED; `correctionReadings` for re-solves.
- packages/reconstruction/src/plan-resolution.ts + failure.ts — refusal codes and their "what is missing" copy;
  Android copy in apps/android (strings.xml, AnalyzerScreen.kt).
- Tests: packages/source-metrics/test/{numeric-lattice,ocr-metric-adversaries,ocr,glyph-ambiguity}.test.ts;
  synthetic corpus packages/synthetic-drawings/src/digit-corpus.ts (two stroke faces, 10 strata, 240 labels/seed;
  seeds 5001 calibration, 9017 held back).
- Calibration: stage-reports/artifacts/analyzer-005e/calibration/{README.md, development-labels.json (81 labels with
  printed truth, split FIT/HELD_BACK/TARGET, box, orientation, variantByteHash)}.
Envelope (workstream B):
- packages/reconstruction/src/plan-decomposition.ts — `decomposePlan` → `decomposeCore` (grid lines from chains and
  bands; `walledEnvelope` = the long-band box) → `boundaryExtension` (~line 2490: shadow grid with exterior-tick
  lines, `readWallLine` per grid line, `solveOutline` STRICT and EXCLUSION, `adopt` = parts beyond the box accepted
  only if they continue the box's interior across an edge with neither wall nor opening, or a shut garage mouth;
  "the outline may only widen the building"; `classifyBodies`).
- packages/reconstruction/src/boundary-outline.ts (flood from the border, WEAK gaps judged by the pocket rule),
  boundary-bodies.ts (PROJECTING_WING / FLUSH_ATTACHED / RECESSED_ATTACHED / OPEN_MOUTH_GARAGE / COVERED_TERRACE /
  SEPARATE_BODY / UNKNOWN), boundary-evidence.ts (wall lines, gaps, signatures), plan-extent.ts (chain extent, roles).
- packages/reconstruction/src/plan-resolution.ts (resolver readings), layout.ts / structural-layout.ts (masses).
- Tests: packages/reconstruction/test/*boundary*, *envelope*, *bodies* (find them), synthetic drawings in
  packages/synthetic-drawings.
Evidence Pack: packages/evidence-pack (src/pack.ts, types.ts; `npm run -s evidence:diverge -- <a> <b> --json`).

## Ready-made local probes (in /home/user/BuildApp/.cache/e5/, gitignored — copy and adapt into your own dir)
- `npx vite-node .cache/e5/lat.ts -- <pkg.json> <assetIdSubstring> <cacheDir> x0 y0 x1 y1 [ORIENTATION]` — the 005E
  lattice of every raw token in the rectangle: paths, cells, candidates, sequences.
- `npx vite-node .cache/e5/ascii.ts -- <pkg.json> <assetIdSubstring> <cacheDir> x0 y0 x1 y1 [CW]` — the de-skewed
  token mask with the segmenter's cuts as ASCII.
- `.cache/e5/dev-lattice.ts` — the lattice over all 81 development labels (truth in development-labels.json).
- `.cache/e5/corpus-lat.ts` — the lattice over the synthetic corpus.

## Run outputs to read (no need to re-run)
- 005E frozen code on the two round-5 houses: /home/user/work005f/base/dom-w-{modrzewnicy,morelach}/ (re-run offline
  today; identical code to the blind run) and the sealed blind outputs /home/user/work005e/blind5/h1-…, h2-…
  (observation-graph.json, metric-evidence.json, plan-diagnostics/digest.json + PNG overlays, evidence-pack/).
  Packages: stage-reports/artifacts/analyzer-005e/holdout/h{1,2}-<house>/source-package.json.
- The 005E development matrix m3: /home/user/work005e/m3/<house>/ (marcowki, rarytasy-g2e, kosacce-clean,
  kosacce-tracked, rarytasy-eoze, alt-marcowki, dom-w-jablonkach, willa-miranda, dom-w-zurawkach, dom-w-modrzykach,
  dom-w-azaliach, dom-w-dabecjach, dom-w-tunbergiach, aster-viii, galaktyka, eoze-legacy-*). Each has
  plan-diagnostics/digest.json (`selectedPlanFrameId`), metric-evidence.json, evidence-pack/ (07-ocr-labels.json,
  10-extent-hypotheses.json, 11-envelope-candidates.json, 13-body-candidates.json, 18-decision-timeline.json) and
  plan-diagnostics/*-{source,masses,cells,flood,grid}.png (local only).
- Development packages: stage-reports/artifacts/analyzer-005b/dev/<house>/source-package.json (marcowki,
  kosacce-clean, kosacce-tracked, rarytasy-g2e, rarytasy-eoze, alt-marcowki, dom-w-jablonkach, willa-miranda);
  analyzer-005b/holdout/h1-dom-w-zurawkach, h2-dom-w-modrzykach; analyzer-005c/aster-viii;
  analyzer-005c/holdout/h1-dom-w-azaliach, h2-galaktyka; analyzer-005d/holdout/h1-dom-w-dabecjach,
  h2-dom-w-tunbergiach. Run a house offline (2–4 min):
  `CACHE=<cacheDir> /home/user/work005f/run-row.sh <label> /home/user/work005f/rev-<id> --package <pkg.json>`.
- Known boundary regressions to keep in mind: willa-miranda (FAIL −5.07 %), dom-w-zurawkach (FAIL −0.81 %, storeys),
  dom-w-modrzykach (PASS −0.54 %), dom-w-azaliach (PLAN_RESOLUTION_INCONCLUSIVE: piers-and-glazing envelope),
  dom-w-morelach. The 005C terrace/canopy/pergola false-closure negatives are hard gates.
