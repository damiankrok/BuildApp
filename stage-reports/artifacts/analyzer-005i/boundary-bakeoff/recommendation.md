# 005I Track B — boundary observation bake-off: recommendation

**BEST_BOUNDARY_CANDIDATE: NONE**

**BOUNDARY_RECOMMENDATION: adopt no external vision provider for boundary observations.** On the seven real
development plans BuildPlan's own `source-cv` already sees every exterior wall and opening run that DeepLSD and ELSED
see. MobileSAM's box-prompted mask is, on average, no better than the box it is prompted with: against the production
extent rectangle BuildPlan already computes (`TRIVIAL-EXTENT`, a fixed comparator) it adds +0.005 mean region IoU
(−0.006 … +0.015 when the truth is displaced by its stated uncertainty; per house −0.05 … +0.08). It also brings false
evidence BuildPlan's own lines do not — 15 gap bridges outside the building against 7 for `SCV-LINES`, and terrace,
porch or leakage failures on 3 of 7 houses — at a deployment cost far above today's app. The documented boundary
failures on these houses are **interpretation** failures — which gap is an opening, which part is a body, which
outline to adopt — not missing perception. The next boundary work belongs in the resolver, not in a new detector.

Research only; nothing here changed production. Numbers: `development-results.json` (real, manual truth),
`synthetic-results.json` (exact truth), `fusion-replay.json`, `performance.json`, `failure-type-scorecard.md`.
Truth on the real plans is an agent's manual annotation (methodology §6.2) — a limitation. Every real-set number was
re-scored with the truth displaced by −u and +u, u = the house's largest stated vertex uncertainty (2–5 px)
(`development-results.json` → `truthBufferFragility`). The decisions below hold at −u, 0 and +u. What does not hold is
marked FRAGILE and is not used as evidence: the sign of the mean MSAM-BOX − `TRIVIAL-EXTENT` difference, MSAM-BOX vs
`SCV-BUILT` on zurawkach (a tie), and 10 scorecard cells, all in mask rows (`failure-type-scorecard.md`, †).

## 1. What the measurements say

### Line providers (ELSED, DeepLSD-MD, DeepLSD-WF, DeepLSD-MD-REFINE-SCV) — real set, 7 houses

- `SCV-LINES` alone covers **98–100 %** of the exterior solid-wall length and **92–100 %** of the exterior opening
  runs on every house; `SCV-UNION` (lines + wall bands + boundary pieces + bridged gaps) covers **≥ 99.8 %** of the
  solid length and **≥ 97.9 %** of the opening runs on every house.
- **Additional ink-supported exterior coverage beyond `SCV-UNION`: 0.00 m of solid wall on all 7 houses for every
  external line configuration**; additions on opening runs ≤ 0.31 m per house (zurawkach), below every scorecard
  threshold. The same holds against a stricter union — only ink-supported union segments, or the union without the
  resolver's bridged gaps (post-review sensitivity rows): 0.00 m solid on every house, opening additions ≤ 0.51–0.62 m
  (zurawkach) — and with the truth displaced by ±u (0.00 m solid at −u and +u; `SCV-UNION` solid coverage ≥ 96.9 %). No exterior edge ≥ 3 m is weakly covered by source-cv (< 60 %) on any house, so the "long weak exterior
  wall" class never applies.
- **Evidence availability** on the baseline TRUE_EXTERIOR / UNKNOWN gaps that lie on a truth exterior edge
  (4–16 per house): `SCV-LINES` bridges 4–13 of them (all of them on five houses); an external detector bridges a gap `SCV-LINES` does not on
  two houses only (zurawkach: 1 for ELSED, DeepLSD-MD and DeepLSD-WF; willa-miranda: 2 for each), and the same
  detectors also bridge gaps that lie outside the building (terrace / paving edges: up to 3 per house, as `SCV-LINES`
  does — up to 4).
- **False evidence:** the external detectors add terrace / pergola / porch outline lines that `SCV-LINES` lacks
  (DeepLSD up to 7.8 m per house, ELSED 2.5 m on azaliach and 7.8 m on willa-miranda) — the scorecard's only HURT cells
  for lines — and boundary-distractor lines (≥ 1 m, outside the building, parallel to a facade within 3 m, not in
  `SCV-LINES`): DeepLSD-MD up to 27.8 m per house, DeepLSD-WF up to 25.1 m, ELSED up to 17.9 m (willa-miranda).
- **Refinement:** DeepLSD's refiner on `SCV-LINES` leaves coverage and corner endpoint error unchanged on every real
  house, does not improve angles (length-weighted angular error 0.10–0.21° vs 0.05–0.17° for `SCV-LINES`; 0.09–0.21°
  in the first run — the refiner is not reproducible, §4), and raises the duplicate rate (0.36–0.81 vs 0.30–0.59).

### Line providers — synthetic corpus (23 cases, exact truth)

- `SCV-UNION` covers 100 % of the exterior solid-wall length on 21 of 23 cases. The exceptions: the **45° bay**
  (95.6 %: the band reader is axis-aligned) and the **partial crop** (70 % for every provider: the truth runs past the
  image edge).
- The **only** additional exterior coverage any external detector adds anywhere is on that bay: ELSED +0.69 m solid /
  +0.76 m opening, DeepLSD-MD +1.00 / +0.73 m, DeepLSD-WF +0.96 / +0.73 m. Everywhere else, including scan blur, JPEG
  (q30), low contrast, 1.5° skew and a 25° rotation, the addition is 0.00 m.
- Supported-line recall over every truth wall face (openings removed): `SCV-LINES` 0.990, DeepLSD-WF 0.989, ELSED
  0.982, refine 0.978, **DeepLSD-MD 0.753** (the MegaDepth checkpoint misses drawn faces; on the JPEG case its
  exterior coverage drops to 0.47 with 24 % of its lines unsupported by ink).
- The external detectors are geometrically tighter on these clean lines (mean angular error ELSED 0.14°, DeepLSD-WF
  0.08° vs `SCV-LINES` 0.49°) and draw far fewer lines (median 88–123 vs 456), hence fewer distractor hits (ELSED 718
  over the corpus vs 3 724) — but both the angle differences (all < 1.2°) and the raw line count are below anything
  the boundary layer reads; no coverage follows from them. On the real plans the order of angular error reverses
  (`SCV-LINES` 0.09° mean vs ELSED 0.19°, DeepLSD 0.31–0.39°).

### MobileSAM — real set

- **MSAM-BOX** (box = production plan extent + one wall): region IoU 0.69–0.97, mean 0.895. The fixed comparator is
  the extent rectangle the box is built from (`TRIVIAL-EXTENT`, mean 0.890: exactly the information already in the
  prompt). The mask scores below it on four houses (jarzabem −0.051, arkadiach −0.024, azaliach −0.034, helikoniach
  −0.025) and above it on the three non-rectangular ones (morelach +0.061, zurawkach +0.081, willa-miranda +0.023).
  Each house's sign holds under ±u; the sign of the mean (+0.005) does not (−0.006 … +0.015), so on average the mask
  and the rectangle are indistinguishable. Against BuildPlan's other regions the mask scores higher on average
  (`SCV-BUILT` 0.768, `PROD-MASSES-005H` 0.743, `SCV-OUTLINE` 0.615; robust under ±u), but that margin is the box's:
  the rectangle alone already has it. Architectural failures recorded: recess pocket filled and porch
  landing included (helikoniach), terrace and pergola included plus leakage through openings (dom-pod-jarzabem — where
  the box itself inherits the house's **metric** defect, an extent stretched over the north terrace: a box-prompted
  mask turns a metric defect into a visual one), porch and terrace included with leakage (willa-miranda).
  Prompt sensitivity is low (moving one box side by one wall leaves IoU with the base mask ≥ 0.93) — the mask follows
  the box.
- **MSAM-SOURCE-PROMPTS** (points from source-cv's BUILT cells): unstable (moving the positives by one wall leaves
  IoU with the base mask as low as 0.62; region IoU 0.15–0.86), fragmented, leaks through openings on five of seven houses, selects an internal room on
  azaliach. It depends on source-cv and adds its failures to MobileSAM's.
- **MSAM-AUTO** (16×16 points; largest mask inside the extent grown by two walls): the fixed selection rule picks a
  room, a landing or a garage interior on every house (region IoU ≤ 0.08): the automatic masks inside the selection
  window are rooms and fixtures, not buildings.

### Fusion replay

There is **no seam**: the production boundary resolver takes only the ink mask (plus bands, chains, registration,
extent, options). The only probe is the out-of-contract mask-union replay (provider lines rasterised 1 px into the
mask). Its outline changes are large and inconsistent across houses (−0.74 … +0.81 region IoU). The
**no-external-information control** (`+SCV-LINES-CONTROL`: BuildPlan's own `SCV-LINES`, which the resolver does not
otherwise read, rasterised the same way) moves outlines by comparable amounts, on different houses: helikoniach −0.72
for the control vs +0.05 for ELSED, morelach +0.36 vs +0.01, and azaliach +0.76 vs +0.81 — the one spectacular "fix".
The control is one perturbation per house and its density is not matched (674–1 195 added segments vs 395–767 for
ELSED), so it is not a calibrated null distribution; it shows that ink density alone moves outlines by about ±0.7,
which is enough to refuse ELSED credit for the azaliach jump. Adding any provider's lines also raises (or, once,
leaves equal) the share of truth opening runs that the resolver reads as solid wall (`openingsReadAsWall`). The replay
measures the resolver's sensitivity to ink density, not new evidence. (The refine row moves between runs — azaliach
+0.86 in the first run, +0.76 in the re-run — because the refiner itself is not reproducible, §4.)

## 2. What this means for the boundary failure classes

| documented class | house(s) | what the bake-off shows |
| --- | --- | --- |
| interrupted walls around openings | willa-miranda, zurawkach, helikoniach | every opening run is already covered by source-cv lines and bridged gaps; the failure is the gap's classification / the outline choice |
| garage / front wing | zurawkach, morelach | no line provider adds a supported metre on garage edges; MSAM covers the garage because the box contains it |
| bay vs terrace | morelach, jarzabem | no line provider adds a supported metre on bay edges; MSAM covers the bay because the box contains it, and includes the terrace when the box does |
| glazed facade continuation | helikoniach, azaliach | glazing lines present in `SCV-LINES` (continuity 1.0); azaliach's outline selects an internal room although the production extent alone would score IoU 0.992 |
| attached body | morelach, willa-miranda, jarzabem | no line provider adds a single supported metre on attached-body edges |
| boundary leakage | jarzabem (metric control) | a box-prompted mask inherits the metric defect of the extent it is given |
| incomplete exterior envelope | helikoniach, azaliach | the evidence for the full envelope (extent, walls, glazing lines) is already in BuildPlan's own observations |

## 3. MobileSAM, fusion and evidence availability on the synthetic corpus

- **MSAM-BOX** (box = the production `planExtent` with no chains — the wall witness — grown by one wall; never the
  truth, §11 of the methodology): mean region IoU 0.895 (median 0.97), `OK` on 14 of 22 prompted cases. The bare
  extent rectangle scores 0.906 mean. The model beats the rectangle on concave and offset outlines (L-shape and its
  degraded variants 0.95–0.99 vs 0.80–0.82, narrow connector 0.95 vs 0.79) and loses to it on rectangles with annotation
  (dimension lines 0.90 vs 1.00, text crossing walls 0.84 vs 1.00). Architectural failures: **glazed facade → one
  internal room** (IoU 0.13), **bay dropped** (the wall-witness extent stops at the facade and the mask follows the
  box), courtyard filled, recess filled, dimension text included; 25° rotation 0.63. **Prompt sensitivity is high on
  clean sheets**: moving one side of the box in or out by one wall leaves IoU with the base mask as low as 0.74 on the
  L-shape and 0.12–0.14 on the glazed facade and the rotated plan.
- **MSAM-SOURCE-PROMPTS**: mean 0.62; leaks through openings on 13 of 21 cases, includes dimension text on 15.
  **MSAM-AUTO**: mean 0.32; the selection rule returns an internal room on all 22.
- The synthetic `SCV-OUTLINE` / `SCV-BUILT` regions are cut on the wall-axis grid (no chain ticks on these sheets), so a
  correct reading scores ≈ 0.91 against outer-face truth (10 × 8 m rectangle: 9.6 × 7.6 / 10 × 8 = 0.912); compare
  their failure types (`OK` 14 of 22 for `SCV-BUILT`), not their raw IoU, with the masks'.
- **Mask-union replay**: on 19 of 22 clean sheets adding any provider's lines changes neither the outline nor the
  BUILT region; the three changes (scan blur outline +0.90, garage-door BUILT +0.26, recessed entrance outline +0.01)
  appear with the same values in the no-external-information control row (BuildPlan's own lines rasterised the same
  way), so none of them is provider evidence.
- **Evidence availability**: no external line detector bridges an exterior gap that `SCV-LINES` does not. MobileSAM
  masks bridge 7 (BOX; 9 under the first, gap-line-only implementation of the §9 rule) and 16 (SOURCE-PROMPTS)
  exterior gaps that `SCV-LINES` does not — every one a `BLANK` gap
  (nothing drawn across the wall; the generator draws door leaves inside the rooms), across which a region mask is
  continuous by construction — with no false bridge on the synthetic sheets. **On the real
  plans the same property cuts the other way**: MSAM-BOX bridges 4 exterior gaps `SCV-LINES` does not, and 15 gaps
  that lie outside the building (terrace, porch and paving edges), against 7 for `SCV-LINES` (14–18 against 7–11 with
  the truth displaced by ±u).

## 4. Decision matrix

Real = 7 development plans (manual truth); synthetic = 23 cases (exact truth). "Added coverage" = ink-supported
exterior coverage not already in `SCV-UNION`. Scorecard = HELPED / HURT cells (`failure-type-scorecard.md`). Every
number comes from the full provider re-run that records each output's input-frame hash (post-review B5); CPU times are
medians on a shared box (`performance.json` keeps the first run's beside them).

| provider / configuration | observation value | synthetic accuracy | difficult-real-plan benefit | false evidence risk | deterministic / reproducible | runtime (this box) | memory | package footprint | Android feasibility | Node 18 feasibility | code licence | weight licence | training-data provenance | integration complexity | recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BuildPlan source-cv + boundary evidence (baseline) | reference: `SCV-UNION` ≥ 99.8 % exterior solid, ≥ 97.9 % opening runs on every real plan | 100 % solid on 21/23; misses the 45° bay (95.6 %); the production boundary layer throws when handed an extent on a sheet with no wall-thick ink (reproduced with a retained log, §5; not reached in the scored runs) | — (its failures are interpretation, §2) | the most raw distractor lines; filtered downstream by wall-thick evidence | yes (gap tallies equal the frozen 005H runs on 7/7) | lines 0.35 s, sheet + solid 0.20 s, boundary 0.11 s (median) | in-process | 0 | shipped | shipped | own | none | none | none | — (baseline, shipped) |
| ELSED-DEFAULT | none on real (0.00 m added on 7/7); synthetic: +0.69 m on the oblique bay only | recall 0.98, fewest false lines (718), exterior coverage ≥ 0.96 (0.70 on the partial crop, as for every provider) | scorecard 0 HELPED / 2 HURT (terrace outlines) | low–medium: adds terrace / paving outlines (2.5 m, 7.8 m) and up to 17.9 m of boundary distractors on one house | yes (full re-run identical on 30/30 frames) | 13 ms detection (median) | 63 MB | algorithm ≈ 30 KB, but OpenCV (9.77 MB/ABI, rejected in 005G) unless ported | only via a TypeScript port (no OpenCV Android) | via a port / emscripten build (not attempted) | Apache-2.0 | none | none (classical) | medium (port of a ~1.5 k-line C++ core) | **DEFER** — revisit only if oblique / non-axis facades enter the development set; route = port the algorithm, never package OpenCV |
| DEEPLSD-MD (detect) | none on real (0.00 m); synthetic +1.00 m on the bay only | recall 0.75; JPEG coverage 0.47, 24 % unsupported lines | 0 HELPED / 5 HURT | high: up to 27.8 m of new boundary distractors, 7.8 m of terrace outlines per house | yes on CPU (full re-run identical on 30/30 frames); WASM differs from PyTorch by 4e-4 | 13.4 s CPU; 59.6 s WASM (fields only) | 2.0 GB CPU; ≥ 1.2 GB WASM (RSS after inference, a lower bound on the peak) | ONNX 34.3 MB (31.8 MB compressed, +81 % of the 39.4 MB APK) + an LSD step | no (memory, minutes per plan) | network yes via onnxruntime-web; the LSD step is AGPL C code | MIT + **AGPL-3.0+ (pytlsd LSD)** | MIT (stated) via an **unofficial mirror** (official server 403) | MegaDepth (Flickr images, own licences) | very high | **REJECT** |
| DEEPLSD-WF (detect) | none on real (0.00 m); synthetic +0.96 m on the bay only | recall 0.99; JPEG 29 % unsupported lines | 0 HELPED / 4 HURT | high: up to 25.1 m new boundary distractors per house | yes on CPU (30/30 identical) | 13.5 s CPU | 2.0 GB | as DEEPLSD-MD | no | as DEEPLSD-MD | MIT + AGPL-3.0+ | MIT (stated), unofficial mirror | Wireframe (MIT-stated; image provenance unstated) | very high | **REJECT** |
| DEEPLSD-MD-REFINE-SCV | none: identical coverage on every plan, in both runs | angles better than SCV on synthetic (0.34° vs 0.49°), worse on real (0.14° vs 0.09°); duplicates up | 0 HELPED / 1 HURT | low–medium (its moved source-cv lines add ≥ 2 m of terrace-edge lines on one house) | **no**: GC-RANSAC seeds from `std::random_device`; a full re-run moved 9–57 % of the refined lines by > 0.1 px on all 30 frames (coverage unchanged; its fusion row moves, §1) | 18.4 s CPU | 2.0 GB | + Ceres, Eigen, GC-RANSAC, Progressive-X | no | no (C++ optimiser) | MIT + BSD/MIT/MPL/Apache deps + gco-v3.0 (research-only, patent notice) in GC-RANSAC; distro Ceres → GPL-2+ SuiteSparse | MIT (stated), unofficial mirror (provenance unverified) | MegaDepth | very high | **REJECT** |
| MSAM-BOX | region proposals only; mean IoU 0.895 vs 0.890 for the extent rectangle it is prompted with (+0.005; the sign is FRAGILE under ±u; per house −0.05 … +0.08) | mean IoU 0.895 vs 0.906 for the bare extent; glazed facade → internal room; bay dropped; high prompt sensitivity | 12 HELPED / 8 HURT against `SCV-OUTLINE` (5 cells fragile under ±u), vs 10 / 11 for the extent rectangle alone (2 fragile) | high: terraces, porches, recess pockets, leakage through openings (3 of 7 houses); 15 false gap bridges on real vs 7 for `SCV-LINES`; inherits metric defects of its box | yes (full re-run identical on 30/30 frames, AUTO's full mask set included); WASM ≡ PyTorch to 2e-6 | encoder 2.4 s CPU, 7.7 s WASM | ≥ 0.64 GB WASM (encoder; RSS after inference, a lower bound on the peak) | ≈ 36.6 MB compressed (+93 % of the 39.4 MB APK) | high risk (memory, size) | yes via onnxruntime-web (measured) | Apache-2.0 (Meta SAM code, Microsoft TinyViT) | Apache-2.0 (SAM decoder stated by Meta; encoder by the repository) | SAM ViT-H teacher + ~1 % SA-1B images (research licence) | high | **REJECT** |
| MSAM-SOURCE-PROMPTS | worse than BOX; depends on source-cv | mean 0.62; leaks on 13/21; dims on 15/21 | 4 HELPED / 20 HURT | very high | yes | as BOX | as BOX | as BOX | as BOX | as BOX | as BOX | as BOX | as BOX | high | **REJECT** |
| MSAM-AUTO | none: selects rooms / landings | mean 0.32; internal room on 22/22 | 0 HELPED / 22 HURT | very high | yes | 52.1 s CPU (16×16 points) | 2.4 GB | as BOX | no | impractical (256 decodes) | as BOX | as BOX | as BOX | high | **REJECT** |

**ADOPT_NEXT: none.** No configuration shows a material, repeatable improvement on source-supported observations:
no repeated recovery of exterior-wall segments source-cv misses (0.00 m on every real plan), no continuation across
openings that source-cv lacks, no attached-body evidence beyond what the prompt box already carries, and every
external configuration adds false evidence near the boundary.

## 5. Side findings for the analyzer line (not acted on here)

- **dom-w-azaliach**: on the frozen 005H evidence the production extent rectangle alone scores IoU 0.992 against the
  traced outline, while the default reading's opening-aware outline selects an internal region (0.14) — a resolver
  decision with all its evidence present.
- **dom-pod-jarzabem** (metric control): the extent spans the north terrace (the documented label-binding defect); any
  box-prompted region proposal inherits it. A boundary witness built on the extent cannot separate a metric defect from
  a visual one.
- **Robustness**: given an extent and a scale but no wall-thick ink, the production boundary layer throws
  `TypeError: Cannot read properties of undefined (reading '0')` in `sidesOf` (`boundary-bodies.ts:157`, via
  `classifyBodies`, `:175`, ← `boundaryExtension`). First seen in the superseded pre-E6 synthetic run; reproduced after
  review with a retained log (`research/analyzer-005i-boundary-bakeoff/repro-sidesof.ts`; log
  `/home/user/work005i/repro/sidesof.log`, SHA-256 `c4e792a3…`, outside the repository) on the synthetic
  double-line-walls sheet (0 wall bands), with either the ink bounding box (a pixel-derived extent, no truth) or the
  truth bounding box the pre-E6 run used (ORACLE), and the generator scale. `planExtent` returns null on that sheet —
  in production and in the scored post-E6 run — so the path is not reached there; it is reachable whenever an extent
  comes from chains alone. Production code was imported read-only and not changed; the snapshot's
  `boundary-bodies.ts` equals HEAD's.
- **Resolver sensitivity**: adding 1-px lines that carry no external information (the control) moves real outlines by
  −0.72 … +0.76 region IoU; whatever the next boundary stage changes should be checked for this ink-density sensitivity.

## 6. What a future, legally controlled synthetic wall-segmentation model would need from the generator

Documentation only — nothing is trained. `packages/synthetic-drawings` and this study's generator draw clean walls,
openings, partitions, dimension chains and a few distractors with exact geometric truth. A training generator would
additionally need:

- **per-pixel semantic label maps** (wall body, wall face, opening infill: glazing / door leaf / vehicle door,
  partition, stair, furniture, terrace, pergola, porch, paving, planting, dimension line, extension line, tick, text,
  hatch, watermark, title block) and **instance ids** per wall, body and opening, exported in a standard polygon /
  RLE format alongside the image;
- **publisher style variation** measured from the development set: filled black, grey and hatched walls, double-line
  walls, coloured room numbers, grey floor fills, furniture symbols, door arcs, window frame conventions, the faint
  diagonal publisher watermark, legend boxes, north arrows and logos;
- **geometry variation**: non-axis and curved walls, chamfered and corner openings (corner windows were present in
  four of the seven real plans), shallow bays, recessed entrances, connectors, garages with piers, multi-body plans,
  attic plans with dashed roof lines and overhangs;
- **page variation**: several plans per sheet, cropped and partial plans, rotated pages, resolutions from 400 to
  2000 px, JPEG / scan / blur / low-contrast degradation (the corpus here has one instance of each);
- **context distractors** placed where they hurt: terraces and pergolas abutting glazed facades, paving and kerbs
  continuing wall lines, dimension chains within half a metre of a facade, text halos cutting walls;
- **licence hygiene**: only fonts, symbols and textures with redistribution rights; fixed seeds; a generator hash per
  sample; no publisher pixel ever used as a template.
