# IU-03B preregistration (written before any control image exists)

Everything used so far is **development data**: the IU-02 FINAL images, both IU-03A test sets (synthetic and
ARCHON), the IU-03A negatives (dev and test seeds), synthetic dev, LoC, Commons — 2 258 images, all already seen.
The two IU-03A failures (`TEST_SYNTH` near-frontal render with trees, negative N7-1 of the test seed) are part of it
and are never reported as a control result. Labels are agent labels, not human-verified.

## Frozen variant

`FROZEN = iu3b/veto.decide(masked='classic', base=False, trigger=True)`:

1. **Stage 1** — IU-03A `route.veto_only`, unchanged (`t_veto = 0.60`, the same unmasked projection, the same roles
   handed back).
2. **Stage 2**, only if stage 1 kept the facade route and a trigger fires — classifier `p(elevation) < 0.95`, the
   full-image projection is `INCONCLUSIVE`, foliage share ≥ 5 %, or a family on the full image has drift z ≥ 3 — the
   IU-02 projection test (thresholds unchanged: z ≥ 5 and ≥ 4 px, radial VP in four quadrants) **inside the classical
   mask** `iu3b/masks.classic` (sky flood from the top rows, IU-03A vegetation colour mask, closing). A
   `PERSPECTIVE_EVIDENT` reason inside the mask → `STOP_PERSPECTIVE_MASKED`, except the oblique-base-edge cue, which
   reads the bottom of the mask box as the ground and is not used inside a mask (§6 requirement 3).
3. `INCONCLUSIVE` inside the mask changes nothing; if then `p(elevation) < 0.80` the disagreement is recorded as
   `CONFLICT_RECORDED` and no route follows from it. Stage 2 never adds a facade route and never changes a role.

Why this one (dev, `dev-variants.json`): A routes 2/1 677 non-elevations (exactly the two IU-03A failures) and keeps
507/581 elevations. B (mask, all cues) fixes N7-1 but loses one synthetic RENDER elevation through the oblique-base
cue; B1 (= FROZEN without triggers) fixes N7-1 and loses none; with triggers the masked test runs on 323 of 2 258
images (every one of the 1 677 dev non-elevations fires a trigger; 186 of 581 elevations skip stage 2) with the same
decisions. The sensitive form B_S(z ≥ 5, d ≥ 1 px) would also stop the h028 render, but an agent-labelled Commons
elevation has a stronger vertical drift (z 6.9, 3.8 px) than that perspective (z 6.1, 1.4 px): no threshold on these
measurements separates them, so B_S is **not** frozen (it would be a threshold fitted to one dev image).

Variant C (a light learned segmenter) is **not run**: the only failure B1 leaves is h028, which stays `INCONCLUSIVE`
even inside its ground-truth building mask — no segmentation can supply perspective evidence the image does not carry.
Variant D (UperNet ADE20K) is a quality reference on the dev images that reach stage 2, never an Android candidate.

## Control set (built after this commit, `FREEZE_SHA` = the commit that adds this file)

1. **CTRL_SYNTH** — `iu3b/control_synth.py --prefix s3b --houses 30 --seed int(sha256(FREEZE_SHA+"BUILDPLAN-IU03B-CTRL-SYNTH")[:8],16)`:
   per house three elevations (FLAT, RENDER, LINE), a near-frontal perspective in each of the three styles, one corner
   view — 210 images, 90 of them near-frontal perspectives. Truth from the generator.
2. **CTRL_NEG** — `iu3/negatives.py --seed int(sha256(FREEZE_SHA+"BUILDPLAN-IU03B-CTRL-NEG")[:6],16)` (18 images, two N7
   near-frontal perspectives).
3. **CTRL_ARCHON** — `iu2_draw_archon.py FREEZE_SHA 4 <out> BUILDPLAN-IU03B-CTRL-ARCHON` (excludes every family seen in
   any earlier stage, IU-03A included); each house through production `analysis:second-house --url`; every
   SourcePackage asset labelled from anonymised contact sheets **before** any model runs on it, labels committed
   (`data/labels-archon-iu03b.json`) before the evaluation. Near-frontal perspectives are flagged in the labels.

Split by project: every house is new and lies wholly in the control set. Pixels stay outside the repository.

## Scenarios and measurements

ADVERSE captions (every control image published as "elewacja-frontowa": LEGACY sends all to the extractor) and REAL
captions (CTRL_ARCHON with the exact roles of its production SourcePackage). `iu3b/evaluate_control.py` runs A and
FROZEN once and reports: non-elevations routed (by truth, set and style; Wilson 95 %), near-frontal perspectives
routed, single elevations kept, elevations lost and why, stage-2 runs, trigger misses on non-elevations, recorded
conflicts, projection state on the full image and inside the mask per truth group (confirmed perspective / confirmed
orthographic / inconclusive), stage-2 time.

## Criteria and verdict (fixed now)

* **K1** FROZEN routes **0** non-elevations of the control set to the facade extractor (ADVERSE).
* **K2** FROZEN keeps **≥ 70 %** of the control single elevations under ADVERSE captions (the hard scenario).
* **K3** REAL captions: FROZEN loses no elevation that A keeps (no unjustified degradation where captions are right).
* **K4** Offline Android path: stage 2 needs only OpenCV (Apache-2.0) and no weights; peak RSS < 1 GB; median stage-2
  time < 1 s per image on one desktop core; no new model.

All four → `RESEARCH_PASS`. K4 holds and FROZEN is nowhere worse than A on K1 and K3, but K1 or K2 misses →
`RESEARCH_PARTIAL`. K4 fails, or FROZEN is worse than A on K1 or K3 → `NO_VIABLE_MOBILE_SOLUTION`.

Zero errors in a sample of n is not zero risk: the report gives the Wilson interval (rule of three ≈ 3/n). Stated
expectation: a fronto-parallel single-plane view like h028 that the classifier puts above `p(elevation) 0.40` will
still be routed; it is then recorded as a conflict, never routed by guess. A small sample of ambiguous control
cases (conflicts, any routed non-elevation, any lost elevation, masked `INCONCLUSIVE` against the classifier) goes to
independent review without pixels in the repository.
