# ResPlan — live audit (BUILDPLAN-ANALYZER-005J)

Access date: **2026-10-06**. Everything below was read from the live repository, Kaggle API, arXiv, or from the
downloaded data file. Where a source claims something the data does not show, it is marked **NOT VERIFIED** or **CONTRADICTED**.

## 1. Canonical identity

| item | value (verified) |
|---|---|
| Paper | "ResPlan: A Large-Scale Vector-Graph Dataset of 17,000 Residential Floor Plans", arXiv:2508.14006, v1 2025-08-19 (18 pp.), **v2 2026-08-04** (11 pp.), submitted by Mohamed Abouagour; arXiv licence of the paper: CC BY 4.0 |
| Code/data repo | `https://github.com/m-agour/ResPlan`, branch `main`, HEAD **`e2b78fe069aee1ab1e1828a612743f308e3c32a7`** (2026-07-28, "per review commit"); tag `1.0.0` -> `ba874017082c3228a596a5187a857e853d0f0a6c` (2025-08-26) |
| Kaggle mirror | `https://www.kaggle.com/datasets/resplan/resplan`, dataset id 7489745, current version **12** (2026-07-28) |
| Paper PDFs (local, not in any repo) | `/home/user/work005j/papers/resplan_2508.14006v2.pdf` sha256 `c688d8ac156ec207c9b11c5d115d11d13011d28b7e05f5ecb9105296b880dcbd`; v1 sha256 `c62dd7dbd753799ef6c8b659c5701d2748db3f3dd57ad7bf7aa41e33a4d60f74` |

Commit history (`git log`, 14 commits): 2025-08-26 initial + dataset; 2025-09 README/citation; 2026-04-16 README cleanup;
2026-05-02 "dataset v7: cleaned geometries (fix_plans pipeline)"; 2026-05-03 "dataset v8: fix isolated bedroom in plan 15392";
2026-07-28 "per review commit" (adds new LICENSE text, TAKEDOWN.md, croissant.json, split.json, baselines/).

## 2. Repository contents (HEAD e2b78fe, 58 files)

`.gitignore`, `LICENSE` (2,832 B), `README.md` (7,122 B), `ResPlan.zip` (100,106,537 B), `ResPlan_demo.ipynb` (152,294 B),
`TAKEDOWN.md` (1,567 B), `assets/plan_graph.png`, `assets/sample_plan.png`, `baselines/` (≈40 Python/SLURM/shell files + 9 result JSONs),
`croissant.json` (7,052 B), `requirements.txt`, `resplan_utils.py` (28,948 B), `split.json` (177,059 B).

Not present although the v2 paper says they are released: trained baseline checkpoints, pinned Docker image,
deduplication-aware split (`split.json` has only keys `train`, `val`, `test`, `augmented`), per-record metric scale factor
(see §4). Source collection and OCR/vectorisation scripts are explicitly **not** released (paper v2 §3).
No raster renderings of the plans are distributed (only two README illustration PNGs); v1 promised "rendered image previews" — not present.

## 3. What was downloaded and inspected

| file | bytes | sha256 | notes |
|---|---|---|---|
| `/home/user/work005j/data/resplan/ResPlan.zip` (from `raw.githubusercontent.com/m-agour/ResPlan/e2b78fe…/ResPlan.zip`) | 100,106,537 | `f718de8865e51bbe93b49b584798e3c536ed6b4b8a5d32f01b56812f389aeb46` | git blob id `24d12b8739bdb55e0accc60ddd4cb460bcc9886c` = the blob in HEAD tree (verified with `git hash-object`) |
| inside: `ResPlan.pkl` | 258,453,658 (uncompressed, not extracted to disk) | – | zip entry date 2026-05-03 19:52 (= dataset v8) |
| `/home/user/work005j/data/resplan/kaggle_view.json` (Kaggle API `datasets/view/resplan/resplan`) | – | `55bc666df429eebb9a0524d31aaa9bee7cbc147c1d2b43952569ee0f39498610` | licence field, versions |
| `/home/user/work005j/data/resplan/kaggle_files.json` (Kaggle API `datasets/list/resplan/resplan`) | – | `c30a8767b888eaf87ac085ad3e989f589b34367344ced7ea1e7baf22f06bc84a` | file list of Kaggle v12 |

Safety: the pickle was first scanned statically with `pickletools` — it references only `shapely.io.from_wkb`,
`numpy._core.multiarray.scalar`, `numpy.dtype` — and then loaded with a restricted `Unpickler` that allows only those three.

## 4. Verified record structure

`pickle.load` -> `list` of **17,000** `dict`s; 17,000 unique integer `id`s (0…999,398).

Keys and frequencies (all 17,000 plans unless stated), values are Shapely geometries:

| key | type | present | meaning |
|---|---|---|---|
| `wall` | MultiPolygon (16,988) / Polygon | 17,000 | **union of wall bodies as filled polygons** (not centrelines). Median 9 parts/plan; 805 interior rings in total. Walls have **gaps at doors and windows** (door∩wall area ≈ 0, window∩wall area = 0; 99.8 % of doors touch the wall band) |
| `door` | MultiPolygon | 17,000 | door bodies = rectangles filling the wall gap (93 % have 4 vertices). Total 108,487 doors, median 6/plan. Short side = 1.0 × `wall_depth`; long side median 4.3 × `wall_depth`. **No hinge side, swing direction or leaf width field** |
| `front_door` | Polygon | 16,995 | entrance door body |
| `window` | MultiPolygon | 16,950 | window bodies filling wall gaps; total 123,479, median 7/plan |
| `living`, `bedroom`, `bathroom`, `kitchen`, `balcony`, `storage`, `stair` | Polygon/MultiPolygon | 17,000 / 16,997 / 17,000 / 16,875 / 13,066 / 1,781 / 685 | room regions grouped by class (a MultiPolygon holds all bedrooms etc. of the plan, **no per-room instance id**) |
| `garden`, `parking`, `pool` | (Multi)Polygon, mostly EMPTY | ~17,000 | secondary spaces |
| `inner` | MultiPolygon | 17,000 | inhabitable interior |
| `land` | (Multi)Polygon | 17,000 | plot/outer boundary layer |
| `neighbor` | tuple of 2 MultiPolygons | 17,000 | party-wall layer |
| `wall_depth` | float | 17,000 | one uniform wall thickness per plan (canvas units: min 2.22, median 4.14, max 7.18) |
| `area` | float | 17,000 | listed gross floor area, m² |
| `net_area` | float | 17,000 | |
| `id` | int | 17,000 | |
| `area_change_sqft` | float | 683 | only on the 683 augmented plans |

17-class taxonomy (verified as the 17 geometry keys): living, bedroom, bathroom, kitchen, balcony, storage, stair, garden,
parking, pool, wall, door, window, front_door, inner, land, neighbor.

**Coordinates are canvas units, not metres.** Coordinates span roughly −4…261 (5–95th pct) on a ~256-unit canvas
(`resplan_utils.DEFAULT_CANVAS_SIZE = (256, 256)`). No per-record scale factor key exists in the GitHub pickle, although the
README says "Metric-scale coordinates in metres" and paper v2 says "Each record stores the scale factor, wall thickness in
meters" — **CONTRADICTED for the GitHub pickle** (the Kaggle v12 pickle, 300,290,069 B, could not be downloaded without Kaggle
auth and was not checked). A metric scale can be derived per plan from `area`: sqrt(area / inner.area) has median
0.055 m/unit (5–95 %: 0.039–0.085); `wall_depth`×scale has median 0.225 m (paper: 21 cm). Outliers exist (min scale 0.001).

Sample (plan index 0, id 14433, area 120.77 m², wall_depth 4.503):
door `[(204.142,92.181),(199.639,92.181),(199.639,109.783),(204.142,109.783)]`;
window `[(259.815,59.841),(255.312,59.841),(255.312,87.678),(259.406,87.678),(259.815,87.678)]`;
first wall part has 11 vertices, starts `(178.352,92.181),(178.352,19.723),(255.312,19.723),(255.312,59.841),(259.815,59.841)…`
(the wall outline steps around the window gap).

**Graph structure.** The GitHub pickle carries **geometry only** — no `graph` key. Graphs are built on demand by
`resplan_utils.plan_to_graph` (strict: `via_door`, `via_window`, `via_opening`, `direct`, `fallback`) plus
`add_adjacency_edges` (paper/Kaggle definition: `via_door`, `adjacency`, `direct`, `via_window`). Nodes: rooms with
`geometry`, `type`, `area`. Kaggle v7+ embeds `plan["graph"]` (per Kaggle version notes).

**Split (verified against data):** train 13,053 / val 1,632 / test 1,632 / augmented 683 = 17,000; every split id exists in
the data, no plan is outside the splits. Paper v2 states 13,736/1,632/1,632 (= train + augmented).

Room polygon count by my definition (parts of the 7 room classes): 139,685 (README: 137,131 — definition differs, not reconciled).

## 5. Licences — verbatim and conflicting

**Repository `LICENSE` at HEAD e2b78fe (sha256 `8193a93c99a3c2c576ee8d508a0098d7c90ead3bc6c23caabdbd84b1f93bf499`)** — dual:
"DATA: ResPlan.pkl, split.json, croissant.json — Creative Commons Attribution 4.0 International (CC BY 4.0)" with scope:

> "The dataset consists of derived geometric representations (polygon coordinates and room-connectivity graphs) recovered by
> computer vision from publicly accessible real-estate listing renderings. This licence is granted over the contributions the
> authors hold rights in: the annotations, the semantic taxonomy, the room-connectivity graph construction, the metric-scale
> conversion, the curation and filtering decisions, and the canonical splits.
> The underlying spatial arrangement of a building is a matter of fact rather than creative expression, and facts are not
> subject to copyright. No licence is therefore asserted, required, or granted over the spatial arrangements themselves."

"CODE: resplan_utils.py, ResPlan_demo.ipynb, baselines/ — MIT License, Copyright (c) 2025 The ResPlan Authors".

**Before 2026-07-28** the only LICENSE (commit 844eb81, 2025-08-26, sha256 `ce81a54854401433d7937257070973bd23fdfb4ec2454ac8cb72f92c4cceeebd`)
was a plain **MIT License, "Copyright (c) 2025 Mohamed Abouagour"** covering the whole repo including ResPlan.zip; the
README carried no data licence. Paper v1 said only "All data and code are released under a permissive open-source license,
allowing free use for research and development."

**Conflicting declarations, same authors, same day:**
- `croissant.json` in the GitHub repo (added 2026-07-28): `"license": {"name": "CC BY-NC-SA 4.0", "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"}` (it is Kaggle's auto-generated metadata for Kaggle version 6).
- **Kaggle API, live: `"licenseName": "CC BY-NC-SA 4.0"`** for the current version 12 (lastUpdated 2026-07-28T08:06:59Z), while the LICENSE file shipped inside that same Kaggle version (2,832 B) is the CC BY 4.0 text.
- README badge, LICENSE, TAKEDOWN.md, paper v2 Table 1 + §3: CC BY 4.0.

`TAKEDOWN.md` (sha256 `bbf1a963957c6a815f6e1a33e189c11d7cc3061a9ecdd949c0d896d25dc452fd`): rights holders may request
removal; acknowledgement within 7 days, removal "from the next dataset release within 30 days"; removed ids to be tracked in
`REMOVED.md` (file does not exist yet); "does not cover third-party reproductions, mirrors, or derivative works".

## 6. Provenance — verbatim, and inconsistent across versions

- README (HEAD): "Plans derive from publicly accessible real-estate listing pages. Only public, non-paywalled pages were accessed, with no circumvention of rate limits, login walls or other access controls, and after review of platform terms of service. Source platform identities are withheld to comply with those terms."
- croissant.json `dataCollection`: "Derived from publicly accessible online real-estate listing pages serving South Asian residential markets … Rendered listing images were converted to vector geometry by a computer-vision pipeline (colour/texture segmentation, OCR of printed room labels, contour tracing, and geometric post-processing). Approximately 27,000 raw plans were collected … leaving 17,000 plans (37% rejection rate)."
- Paper v2 §3: "Source plans come from public real-estate listings rendered as stylized rasters … The transformation removes all copyrightable artistic expression, preserving only factual geometric topology." and Limitations: "collection and OCR/vectorization scripts are not redistributed. This limits independent auditing …".
- **Paper v1 (2025-08-19) gave a different account:** "The floor plans were sourced from publicly available real-estate listing documents, which often provided architectural drawings in CAD or PDF formats. We developed a custom parser to extract polygonal geometries and textual labels from these drawings." v1 Table 1 Source column: "Real estate listings / Asian real estate".
- Indirect signal (inference, not proof): `baselines/error_analysis.py` groups results by `unitType` ∈ {Apartment, BuilderFloor, Villa, IndependentHouse} — terminology of Indian listing portals; `unitType` is **not** in the released pickle, so the authors hold listing-level metadata that is not published.

Not derived from RPLAN (RPLAN is only a comparison/transfer baseline). Not derived from CubiCasa5K.

## 7. Technical suitability for BuildPlan-style synthetic plan sheets

Verified by rendering two plans (ids 14433, 7067) to black-on-white PNG with PIL from the vectors
(scratch output, not a deliverable): filled black wall bands with real gaps, windows as jamb rectangle + centre line, doors as
leaf + quarter arc. Works technically, with these limits:

- Walls are polygon bands, not centrelines; centreline/graph ground truth needs a conversion (fpvec-lab paper Appendix D describes one: union wall+opening bodies, rasterise, close, skeletonise, Douglas–Peucker, weld, axis-snap 0.35×wall depth).
- **Door hinge side and swing direction are absent** — any arc is a rendering assumption (must be labelled as such; the rendered arc is not a fact from the source).
- One uniform wall thickness per plan (normalised) — no load-bearing vs partition distinction, unlike Polish drawings.
- No dimension chains, text, furniture, hatching, stairs detail, or scale bar; these would all be synthetic additions.
- Mostly Manhattan; South-Asian unit layouts (single-floor units, no multi-storey, no attic/roof).
- Room instances are not separated within a class (all bedrooms in one MultiPolygon) — per-room instances are recoverable as polygon parts only.
- Metric scale is approximate (derived from listed gross area).
- 6.9 % near-duplicates (authors' figure); 154 test plans have a near-duplicate in train.

## 8. Can ResPlan become part of a BuildPlan-owned training corpus? (evidence, not legal advice)

Technically: yes (vectors render cleanly; 100 MB; MIT code). Licence evidence is **not clean**:

1. **Conflicting licence declarations** by the same publisher: GitHub LICENSE/README/paper v2 = CC BY 4.0 (since 2026-07-28) vs Kaggle dataset licence field and repo `croissant.json` = **CC BY-NC-SA 4.0**. Until resolved in writing by the authors, a commercial user cannot rely on either.
2. The CC BY 4.0 grant is **expressly limited** to the authors' own contributions; for the underlying layouts the authors assert "no licence is … granted" because they consider them facts. That is the authors' legal position, not a grant; it does not bind the original rights holders (architects/developers who drew the plans, listing platforms).
3. **Upstream source undisclosed** (platform identities withheld); terms of service "reviewed" but not published; two different extraction stories (v1 CAD/PDF parser vs v2 CV on rendered images). No way to audit upstream rights.
4. Residual questions for counsel: (a) whether traced floor plans are protected expression/technical drawings under Polish/EU law (architectural works and plans are protected subject matter in many EU jurisdictions); (b) EU sui-generis database right of the listing platforms over a substantial extraction (~27,000 plans); (c) platform ToS/contract claims against downstream users (normally only against the scraper, but a takedown could force corpus/model rebuilds); (d) whether a model trained on ResPlan-derived renders is "Adapted Material" (relevant if the NC-SA declaration is the operative one); (e) attribution mechanics under CC BY 4.0 for a shipped model/app; (f) takedown churn — removed ids must be removable from the corpus (keep per-plan provenance).

**Verdict: DATA_CANDIDATE_WITH_COUNSEL** — inspected for this audit only (parsed, two plans rendered to scratch); any further internal use is itself a counsel question under the NonCommercial reading (post-review D4); inclusion in a BuildPlan-owned
commercial training corpus only after (i) written clarification from the authors that CC BY 4.0 (not CC BY-NC-SA 4.0) applies
to the current release, and (ii) counsel review of points 2–4. Keep plan ids and dataset version (v8 / commit e2b78fe) per
training sample so takedowns can be honoured.

## 9. Evidence list

- https://github.com/m-agour/ResPlan @ `e2b78fe069aee1ab1e1828a612743f308e3c32a7` (git clone, accessed 2026-10-06); LICENSE sha256 `8193a93c…bf499`; README sha256 `e81d51083e366b99493373f1ed047a4480e167467735d8ca6602e70643674007`; croissant.json sha256 `a915ed5f14902e099c361e9a7d9da1acbf012bb0036bdc979755ad6422757c84`; split.json sha256 `7761df4ad4c860d7e89d1ef9c7004737cd407615b66ed9cde676d7087108c9a7`; resplan_utils.py sha256 `485c97b114d84189a95b7e11b82786d599e6e155167ed3942b0402388b250fd1`
- https://raw.githubusercontent.com/m-agour/ResPlan/e2b78fe069aee1ab1e1828a612743f308e3c32a7/ResPlan.zip — sha256 `f718de88…aeb46`
- https://www.kaggle.com/api/v1/datasets/view/resplan/resplan and …/datasets/list/resplan/resplan (licenseName "CC BY-NC-SA 4.0", v12)
- https://arxiv.org/abs/2508.14006 (v1 2025-08-19, v2 2026-08-04)

Note on download budget: ResPlan.zip (100 MB) is the only intended dataset download. An inspection command
(`git log --find-object`) on the initial partial clone lazily fetched historic `ResPlan.zip` blobs (~390 MB of packs); that clone
was deleted and replaced by a lean clone (`/home/user/work005j/upstream/resplan`, 916 KB). Total network for this task therefore
exceeded the 300 MB guidance; nothing above 400 MB was fetched as one file.
