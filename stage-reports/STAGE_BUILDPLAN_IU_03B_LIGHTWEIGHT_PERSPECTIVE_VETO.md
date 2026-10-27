# STAGE BUILDPLAN IU-03B — lightweight masked perspective verification

Branch `claude/new-session-3kzcgh`, base `a2702f6`. Freeze `88f80cc` (preregistration
`stage-reports/artifacts/iu-03b/preregistration.md`), control ARCHON labels `4e3c096` (committed before any model ran
on those images). Code: `research/image-understanding/iu3b/`. Numbers: `stage-reports/artifacts/iu-03b/`.

Research only. The production analyzer, Android, SourcePackage, reconstruction, `views.ts` and `frame.ts` are unchanged.
No APK was built. CI was not run; only the targeted research-isolation tests ran. There was no training round. The
OWNER's private benchmark was not touched. No third-party pixels are in the repository. Every label of a real image is
an agent label, not human-verified.

**Verdict: `RESEARCH_PARTIAL`.**

A second look inside a classical OpenCV mask is cheap, offline and weight-free. It cuts the near-frontal perspectives
that reach the facade extractor from 5 to 2 on the new control set. It loses no elevation and does not change any
correctly captioned image. But 2 confirmed non-elevations still get through, so criterion K1 is missed.

## 1. The two IU-03A failures (development data)

| | `s3t-h028` near-frontal render with trees | negative N7-1 (test seed) |
|---|---|---|
| camera / scene | yaw −5.3°, pitch −0.4°; one gable plane fronto-parallel, no side wall visible | near-frontal, trees in front |
| segments (LSD) | 41 total: 26 on the building (GT), 7 on occluders (GT), 7 vegetation colour, 8 background | trunks add false verticals |
| full image | `INCONCLUSIVE` | `INCONCLUSIVE` (horizontals too few; verticals z 3.9, 10 px) |
| GT building mask | `INCONCLUSIVE` (verticals z 6–7 but only 1.4–2.1 px, under the 4 px bar) | `INCONCLUSIVE` (26 % non-parallel) |
| classical mask (B) | `INCONCLUSIVE` (verticals z 6.1, 1.4 px) | **`PERSPECTIVE_EVIDENT`** (verticals z 6.5, 10.3 px) |
| UperNet mask (D) | `INCONCLUSIVE` | `PERSPECTIVE_EVIDENT` (z 6.85) |
| classifier p(elevation) | 0.57 (veto needs P(not elev) ≥ 0.60) | 0.50 |

What each failure needs:

- **N7-1** is a segment-selection problem. Removing sky and foliage is enough. No AI segmentation is needed: the
  classical mask fixes it just as well as UperNet.
- **h028** is not a vegetation problem. Even inside its ground-truth building mask the image carries only ~1.4–2 px of
  convergence. A fronto-parallel view of one plane is close to a scaled orthographic view, so no mask can supply
  evidence the pixels do not hold.
- A more sensitive threshold (z ≥ 5, ≥ 1 px) would stop h028. But an agent-labelled Commons elevation on dev has a
  *stronger* vertical drift (z 6.9, 3.8 px). No threshold separates the two, so it was not adopted. That would be
  fitting to one image.

## 2. Variants (dev: 2 258 already-seen images, `dev-variants.json`)

| variant | elevations kept | non-elevations routed | stage-2 runs | note |
|---|---|---|---|---|
| A — IU-03A VETO_ONLY | 507/581 | 2/1 677 (h028, N7-1) | 0 | |
| B — + classical mask, all cues | 506/581 | 1/1 677 | 509 | loses 1 RENDER elevation via the oblique-base cue (the mask bottom is not the ground) |
| **B1 — + classical mask, no oblique-base cue** | **507/581** | **1/1 677** | 509 | frozen form |
| B1_T — B1 with triggers (**FROZEN**) | 507/581 | 1/1 677 | **323** | same decisions, 37 % fewer runs |
| B_S(z5, d1) — sensitive | 505/581 | 0/1 677 | 509 | rejected (see §1) |
| C — light learned segmenter | not run | | | B fixes the only mask-dependent failure; GT and UperNet masks also leave the rest INCONCLUSIVE |
| D — UperNet mask (reference, 516 stage-2 images) | 507/507 | 1/9 | 509 | identical to B1 on the same images (`B1@D`) |

**C was skipped deliberately.** The brief allows C "only if B fails". B does not fail on any case a mask can fix. The
remaining failures stay `INCONCLUSIVE` even with a perfect (GT) mask and with UperNet, so a segmenter has nothing to
supply.

## 3. Good elevations: confirmed / orthographic / inconclusive (control set, `control-results.json → projectionStates`)

| truth / style | n | full image: perspective / ortho / inconclusive | inside mask: perspective / ortho / inconclusive |
|---|---|---|---|
| elevation FLAT | 30 | 0 / 28 / 2 | 0 / 29 / 1 |
| elevation RENDER (trees, reflections) | 30 | 0 / 16 / 14 | 0 / 19 / 11 |
| elevation LINE | 30 | 0 / 30 / 0 | 0 / 30 / 0 |
| elevation ARCHON | 16 | 0 / 4 / 12 | 0 / 2 / 14 |
| elevation negatives (white-on-white, tree before window, reflection, gate, dark-on-dark, rail, no ground) | 14 | 0 / 14 / 0 | 0 / 14 / 0 |
| near-frontal FLAT | 30 | 23 / 0 / 7 | 29 / 0 / 1 |
| near-frontal RENDER | 30 | 19 / 0 / 11 | 16 / 0 / 14 |
| near-frontal LINE | 30 | 30 / 0 / 0 | 30 / 0 / 0 |
| near-frontal ARCHON | 8 | 5 / 0 / 3 | 5 / 0 / 3 |

How good elevations fare:

- No elevation of any style was confirmed as a perspective inside the mask. That covers bright, flat, reflective and
  tree-covered elevations, the ones with few lines, and the unusual-roof elevations.
- `INCONCLUSIVE` never stops an image.
- Where it disagrees with the classifier (p(elevation) < 0.8), the disagreement is written as `CONFLICT_RECORDED` and
  the route stays as it was. There were 3 such cases on the control set: one FLAT elevation and both leaks.

## 4. Triggers and cost

The masked test runs only if one of these holds:

- p(elevation) < 0.95;
- the full image is `INCONCLUSIVE`;
- foliage ≥ 5 %;
- a full-image family has z ≥ 3.

**Do the triggers skip dangerous cases?** On dev every one of the 1 677 non-elevations fires a trigger (0 misses), and
186 of 581 elevations skip stage 2. On the control set there were 0 trigger misses on non-elevations, and 44 stage-2
runs under ADVERSE captions.

**What each decision returns.** `veto.decide` gives:

- the decision and its reason;
- `maskedRan` and the triggers that fired;
- the conflict, if any;
- the diagnostics, including the projection state, the families and the mask shares;
- the roles, returned untouched.

The mask used is always the classical one. There is no model version for stage 2 because it has no weights. Stage 1
uses the frozen IU-02 head (SHA-256 `0165566…`).

| component | weights | peak memory | time / image | measured where |
|---|---|---|---|---|
| stage 2: classical mask + LSD projection test | **none** (OpenCV, Apache-2.0) | **165 MB** RSS whole process, 44 MB after imports | median 0.15 s, p95 0.29 s, max 0.45 s (≤ 2.8 MP) | desktop Xeon 2.1 GHz, 1 thread (`bench-stage2.json`); **not measured on a phone** |
| stage 1 classifier (already in A) | OpenCLIP ViT-B/32 image tower ~350 MB fp32 (+ 44 KB head) | not re-measured | ~0.24–0.46 s/img batched, 4 threads | desktop; phone not measured |
| D reference: UperNet ConvNeXt-T | 230 MB | ~1.7 GB RSS per worker | 4.6–7 s | desktop; **excluded** (> 1 GB, not an Android candidate) |

The licences of code, weights and data were checked separately:

| component | code | weights | training data |
|---|---|---|---|
| stage 2 | OpenCV, Apache-2.0 | none | none |
| stage-1 classifier | OpenCLIP, MIT | MIT (model card) | LAION-2B, a separate provenance question already noted in IU-01 |
| UperNet (reference only) | MIT | MIT (card) | ADE20K, research-oriented terms |
| C | not chosen | not chosen | not chosen |

MobileCLIP and SegFormer stay excluded for their licences (IU-01/IU-02). "Mobile" in a name was taken as proof of
nothing.

## 5. Control set (new; built after the freeze; evaluated once)

The control set was built after the freeze from fresh seeds and new houses, split by project:

- **CTRL_SYNTH**, 210 images: 30 new synthetic houses; per house, an elevation and a near-frontal perspective in each of
  FLAT, RENDER and LINE, plus one corner view.
- **CTRL_NEG**, 18 images: a new seed of negatives N1–N9.
- **CTRL_ARCHON**, 81 images: 4 never-seen ARCHON families, run through the production `analysis:second-house`.
  Labelled from anonymised sheets before any model ran.

In total: 120 single elevations, 100 near-frontal perspectives. Intervals are Wilson 95 %.

| scenario | variant | elevations kept | non-elevations routed | near-frontal routed |
|---|---|---|---|---|
| ADVERSE (all 309 captioned "elevation") | A | 90/120 = 75 % [67, 82] | 5/189 [1.1 %, 6.0 %] | 5/100 |
| ADVERSE | **FROZEN** | **90/120 = 75 % [67, 82]** | **2/189 [0.3 %, 3.8 %]** | **2/100** |
| REAL (ARCHON production roles) | A | 16/16 [81, 100] | 0/65 [0, 5.6 %] | 0/8 |
| REAL | FROZEN | 16/16 [81, 100] | 0/65 [0, 5.6 %] | 0/8 |

How the near-frontal perspectives were handled:

- **Stopped by stage 2:** three synthetic FLAT near-frontal views that stage 1 had let through (p(elevation)
  0.50–0.70). The full image was `INCONCLUSIVE`; inside the mask the horizontals converge (z 5.2–6.9, 4.3–12 px).
- **Still routed (K1 miss):**
  - `s3b-h020` FLAT near-frontal, p 0.70. Inconclusive inside the classical mask (h z 4.7, 4.0 px) and also inside
    UperNet's.
  - N7-1 of the new seed, p 0.49, foliage 20 %. The mask removes the trunk verticals, and what is left has too few
    well-spread edges. UperNet is no better.
  - Both are recorded as `CONFLICT_RECORDED`. They are weak-evidence images, not mask failures.

Sections, plans and site plans: none was routed in either scenario (control ARCHON: 4 sections, 28 plans, 4 site
plans).

Correctly captioned images (REAL): there is no difference between A and FROZEN. All ARCHON colour-render elevations
with trees are kept, including the ones flagged as ambiguous.

**Limit of this control set.** All 30 synthetic RENDER elevations and all synthetic RENDER perspectives are already
vetoed by the stage-1 classifier (`REVIEW_MULTI_VIEW_OR_OTHER`). This is an IU-03A behaviour on this generator's
renders, not something stage 2 caused. As a result:

- On the synthetic part, stage 2 was barely exercised on the exact case the stage targets: renders with vegetation.
- The 75 % kept rate is carried by FLAT, LINE, ARCHON and the negatives: synthetic RENDER 0/30, ARCHON 16/16.
- K2's lower bound (67 %) sits under the 70 % bar.

Zero routed non-elevations on REAL (n = 65) still allows up to 5.6 % risk.

**Criteria (preregistered):**

| criterion | result | status |
|---|---|---|
| K1 — 0 non-elevations routed | 2/189 | **missed** |
| K2 — ≥ 70 % elevations kept (ADVERSE) | 75 % (CI 67–82) | met on the point estimate |
| K3 — no loss vs A on REAL | 16/16 = 16/16 | met |
| K4 — Android path | no weights, 165 MB, 0.15 s | met (desktop measurement) |

The rule gives K4 held, FROZEN better than A on K1 and equal on K3, K1 missed → `RESEARCH_PARTIAL`.

## 6. Requirements for a future `FacadeGeometryEvidence` integration (no code changed)

1. **The ridge is not the top of the outline.** The highest outline point is often a chimney or an antenna; IU-03A's
   adapter fed exactly that to the solver. The ridge must be its own reading, with its own evidence: the meeting line
   of two roof edges, or a long horizontal roof edge. It must also say how sure it is.
2. **A chimney has its own semantics.** It is a narrow vertical body above the roof surface, kept as a separate item
   with a box and a state. It never raises the ridge or the eaves, and the solver never treats it as roof geometry.
3. **The ground is not the bottom of the mask.** A sky/foliage-free mask, or a whole-building mask, ends at hedges,
   terraces, the sheet edge or the image edge. The ground line must come from its own evidence: a long horizontal
   segment with building above and terrain or plinth below, or a drawn ground line. Otherwise it is `MISSING`, and the
   adapter then adds nothing (IU-03A N9). The same reasoning made IU-03B drop the oblique-base cue inside masks.
4. **Every opening carries evidence, an occlusion state and coordinates.** That means:
   - a box in image pixels and in the facade's own frame;
   - the method that found it;
   - an `independentlyDetected` flag, false when the box is mostly occluded by vegetation;
   - an occlusion state (`VISIBLE`, `PARTLY_OCCLUDED`, `OCCLUDED`, `REFLECTION_SUSPECT`);
   - whether it reaches the ground (door or gate).

   An opening without coordinates is not an observation.
5. **Plan-derived openings are not facade truth.** Opening positions projected from a plan that may be wrong are a
   hypothesis to check against the facade, never independent confirmation of it. Agreement between the two counts only
   when the facade opening was detected independently. A plan opening "confirmed" by its own projection is circular and
   must be labelled as such.
6. Any facade evidence enters only after a projection check: the router's decision travels with it. An image stopped
   as a perspective feeds nothing. An `INCONCLUSIVE` one may feed geometry only in a form that admits a few pixels of
   convergence.

## 7. Independent review sample

`stage-reports/artifacts/iu-03b/review-sample.csv` lists 13 control cases:

- every recorded conflict;
- both routed non-elevations;
- every image where A and FROZEN differ;
- the ARCHON images whose label is ambiguous (colour-render elevations with trees, frontal villa views, thumbnails).

Each row has the sheet index or synthetic id, the label, p(elevation), both routes, and empty `humanLabel`/`humanNote`
columns. Pixels and sheets stay outside the repository (`/home/user/workiu03b/ctrl/archon/sheets`). Synthetic images
can be regenerated from the seed in the preregistration.

## 8. What would close the gap (not started; OWNER's decision)

The two remaining leaks have p(elevation) 0.49–0.70 and almost no convergence. Lowering the stage-1 veto threshold, or
the stage-2 drift bar, would catch them, but it would trade elevations that are equally weak. On dev, the Commons
elevation shows that the line test cannot separate the two.

Two directions are open:

- Route these to review instead of to the extractor. That is a new route for `INCONCLUSIVE` + conflict, which the brief
  forbids "on a guess" and would need an explicit decision.
- Accept the residual: a fronto-parallel single-plane view distorts geometry by only a few pixels.

Neither is a reason for a new training round. The stage-1 classifier's wholesale veto of synthetic RENDER elevations
should be investigated before any integration.

## Files

- `iu3b/masks.py` — the classical mask.
- `iu3b/veto.py` — the decision; stage 1 is IU-03A's unchanged `route.veto_only`.
- `iu3b/collect.py` — collects the evidence.
- `iu3b/analyse_dev.py` — the dev variants.
- `iu3b/bench.py` — the stage-2 cost.
- `iu3b/control_synth.py` and `iu3b/control_inputs.py` — the control set.
- `iu3b/evaluate_control.py` — the single evaluation.
- `data/labels-archon-iu03b.json` — the control ARCHON labels.
- `tests/architecture/research-isolation.test.ts` — the IU-03B block: no production import, writers refuse the
  repository, and the stage never adds a facade route. The targeted run passed 14 IU tests.

## Verdict

**`RESEARCH_PARTIAL`.** The masked veto is a viable, weight-free, offline improvement: 5 → 2 near-frontal leaks, no
elevation lost, no change on correctly captioned images. But it does not reach zero confirmed non-elevations routed,
and the control set did not exercise vegetation renders at stage 2. Work stops here; IU-04 and integration are not
started.
