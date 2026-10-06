# fpvec-lab — live audit (BUILDPLAN-ANALYZER-005J)

Access date: **2026-10-06**. Repository: `https://github.com/Cyprinus12138/fpvec-lab`.

## 1. What is actually published

Full-history clone (`/home/user/work005j/upstream/fpvec-lab-full`, not shallow, `git rev-list --all --count` = 2):

| | |
|---|---|
| refs (`git ls-remote`) | `HEAD` and `refs/heads/main` -> `f44a475a8c08333d75756fb08a1ace3a14e3b534`; **no tags, no other branches** |
| commits | `276066d6cf94594bac362dda92bafe6bb6cade58` 2026-08-26 10:04:14 +0800 "README: paper summary, components, benchmark tracks, licensing"; `f44a475a8c08333d75756fb08a1ace3a14e3b534` 2026-08-28 11:34:56 +0800 "README: arXiv 2608.25608, ResPlan reference link" — both by `cyprinus <cyprinus12138@gmail.com>` |
| tree at HEAD | **exactly one file: `README.md`, 3,864 bytes**, blob `dacc09052a8875293c39f3d3c6479f72ae49a5ca`, sha256 `0e26ec3d84d373a1d4b38e4574b6176a6cde2bc2998697f7525ee745d5c97f2f` |
| LICENSE file | **none** (the README's licence table is the only licence statement; no licence text is actually granted) |
| source code | **none** — `fpeval/`, `resplan-fp/`, `skv4/`, `fpgen/`, `paper/` are named in the README but do not exist in any commit |
| training / evaluation code | none |
| `fpgen` generator | none (PyPI `fpgen` is an unrelated browser-fingerprint package by daijro, Apache-2.0) |
| ResPlan-FP builder / splits / test-id list | none |
| checkpoints (.pt/.pth/.safetensors/.onnx) | none; no Git LFS (`.gitattributes` absent) |
| external artefact links in README | only `https://arxiv.org/abs/2608.25608` (200), `https://arxiv.org/abs/2508.14006` (200), `https://github.com/CubiCasa/CubiCasa5k` (403 from this container — GitHub HTML blocked; repo exists, `git ls-remote` HEAD `c34440266665a11f4484eb06cd2e4b7d72ad76c1`). No Hugging Face, Google Drive, Zenodo, or release links |
| README state | still contains `<!-- TODO: adjust directory names to the final layout before publishing -->`; the first commit had `arXiv:XXXX.XXXXX` placeholders |
| GitHub releases | page `https://github.com/Cyprinus12138/fpvec-lab/releases` returns **403** from this container and `gh api repos/…/releases` is refused (repo not in session); **not reachable — not verified directly**. Indirect evidence: the remote has no tags, and a published GitHub release requires a tag |
| Hugging Face | API searches (models/datasets/spaces) for `fpvec`, `fpvec-lab`, `ResPlan-FP`, `resplan-fp`, `skv4`, `fpgen`, `fpeval`, `Cyprinus12138`, `cyprinus`, `emit-detect`, `floorplan-vectorization`: no related artefact (only unrelated `FPEval/*` LeetCode datasets, `skv408/ppo-LunarLander-v2`, `Cyprinus-carpio/vits-api`); `huggingface.co/api/users/Cyprinus12138/overview` -> "This user does not exist" |
| PyPI | `fpeval`, `fpvec`, `fpvec-lab`, `resplan-fp`: 404 |

**Conclusion: the repository is a documentation placeholder (README only). Nothing claimed in it — code, benchmark,
corrected annotations, generator, checkpoints — is available at audit time.**

README licence claims (unbacked by any LICENSE file): fpeval MIT; resplan-fp code MIT, data CC BY 4.0; skv4 CC BY-NC-SA 4.0
("inherits CubiCasa5K"); fpgen MIT; it states ResPlan is "data CC BY 4.0, code MIT — redistributable". Note: the CubiCasa5K
GitHub LICENSE says CC BY-NC 4.0 and its Zenodo record says CC BY-NC-SA 4.0 (see mitunet.md); the ResPlan Kaggle licence
field says CC BY-NC-SA 4.0 (see resplan.md) — so the README's "redistribution-clean" claim for ResPlan-FP rests on a disputed licence.

## 2. Paper

"When Should a Network Emit Geometry, and When Should It Detect It? Readout, Reconciliation, and Representation in Floorplan
Vectorization", He Zhang (Independent Researcher), **arXiv:2608.25608 v1, 2026-08-26**, 21 pp., arXiv licence CC BY 4.0.
PDF sha256 `262f6c166f33d9df56cc699669bb139012201337ef0280e45fdb82fe7f562b81` (local copy `/home/user/work005j/papers/fpvec_2608.25608.pdf`).
Code link in abstract and in arXiv "Comments": `https://github.com/Cyprinus12138/fpvec-lab` — i.e. the README-only repo.

Model (from the paper; nothing released): Raster2Seq backbone (ResNet + deformable-attention encoder) on 256 px input; causal
autoregressive decoder, hidden 256, 32-bin coordinate quantisation, grammar type-mask (walls = start,end,thickness,type; rooms =
cycles of wall IDs with explicit open edges; openings = door/window intervals along a wall); dense branch of 3 heatmaps
(junction, wall centreline, opening) at 128×128 with sub-pixel offsets, trained jointly. All arms initialised from a model
pretrained on **Structured3D** layouts (non-commercial licence, per the paper's own related work) and trained on **CubiCasa5K**
(non-commercial) and a synthetic set; the room-centric arm continues the **released Raster2Seq checkpoint**. Any checkpoint
from this work would therefore inherit non-commercial training data — irrelevant today because none is published.

Synthetic generator: unit statistics fitted to **29,300 listing titles scraped/parsed from a Singapore property portal**
(18,203 yielded bed/bath counts); only aggregate statistics used.

## 3. Methodology findings (paper, CubiCasa5K official test unless stated)

- **Emit vs detect (same network).** Graph readout (detect) beats sequence decoding (emit) on real scans: wall F1@0.05 0.818 vs 0.790 (+2.7, CI [1.4,4.0]); @0.015 +5.1; watertightness r_val 0.956 vs 0.196. Readout wins on large plans (+8.7 on 32–70 walls), loses on small (−3.7 on 5–22 walls). On clean renders the decoder wins where its training covered the style (ResPlan finetuned 0.968 vs 0.915); under domain shift the readout wins only after threshold calibration (0.677 vs 0.640).
- **Wall-first vs room-first.** With matched data/recipe, a room-centric system + deterministic reconciliation matches/exceeds wall-first on wall structure (wall F1 0.781 vs 0.751, P 0.906, 0 double walls, r_val 0.92–0.94, edit cost ~30 % lower). Remaining representational effect is coverage: walls that bound no room (stubs, free-standing, exterior-only) cannot be recovered from rooms (recall 0.30 vs 0.66).
- **Output fusion, not input conditioning.** Deterministic fusion (keep reconciled room-derived walls as base; add non-overlapping donor walls that pass an ink gate) +7.1 wall F1 (0.853). Feeding a draft as an input channel/prefix gave 0/3 gains (pre-registered stop rule). Closed form: a donor helps iff its purity p > F1_base/2.
- **Opening heatmap readout.** Reading the never-used opening heatmap lifts opening F1 0.246 -> 0.644 (0.799 ignoring door/window family) without retraining; a 200K-parameter door/window head reaches 0.988 family accuracy.
- **Edit-cost metric.** Typed correction script from Hungarian matching: MOVE (×displacement/t), TYPE, CREATE, DELETE, CONVERT (phantom wall on open boundary); default weights 1,2,5,5,10 with the ordering w_MOVE ≪ w_TYPE < w_CREATE = w_DELETE ≪ w_CONVERT; openings OPEN-MOVE 0.5/t, OPEN-CREATE 4, OPEN-DELETE 4; move radius 4t. System ranking invariant over 21 admissible weightings.
- **Tolerance-based wall F1.** Frame: longer edge = 1024 units; t ∈ [0.015, 0.08] (0.05 ≈ 0.5 m on a 10 m plan; 0.015 ≈ 15 cm). Candidate pair if angle < 15°, mean distance of 7 sampled points (both directions) ≤ t, projection overlap ≥ 30 % of the shorter wall; Hungarian 1-to-1. Openings matched by centre within 2t per family; rooms IoU ≥ 0.5. r_val always reported with double-wall count (double = sin(angle) ≤ 0.2, separation ≤ 28/1024, overlap > 40 %).
- **ResPlan-FP** (described, not released): 16,998 plans (2 rejected > 512 tokens/80 walls), split 14,998/1,000/1,000 seed 42 with id-hash fingerprints; render = 256 px clean line drawing, median-thickness wall band, door swing arcs, window gaps with jamb lines; no near-duplicate removal.
- Zero-shot VLM (Gemini 3.1 Pro): wall F1 0.811 @0.05 but 0.472 @0.015 — coarse coordinates.

## 4. Ideas BuildPlan can implement independently (clean-room from the paper text)

All of these are algorithm descriptions, not code; none needs the unpublished repository.

| idea | where it fits in BuildPlan | ML needed? |
|---|---|---|
| Tolerance-swept wall F1 with the exact matcher above, plus double-wall count and r_val read together | `analyzer` evaluation tests on both evaluation houses | no |
| Edit-cost metric (typed operation script, ordering-constrained weights, weight-sweep invariance check) | evaluation; matches the "verify roots, not rows" philosophy — scores drafts by human correction effort | no |
| Untrained graph readout: NMS peaks of a junction map -> nodes; chord-coverage test on a centreline map (κ, θ_C, ℓ_min, no third node within ε) -> edges; **no edge chaining**; rooms = faces of the planar graph | can run on BuildPlan's own deterministic morphology outputs (skeleton junction/centreline maps), not only on network heatmaps; closed-by-construction walls | no |
| Openings as intervals on wall centrelines (door/window family kept) | wall/opening model (opening = hole in wall + separate element) | no |
| Room-polygon -> wall reconciliation: weld (≈0.022 frame), dedup shared edges, T-split, drop < 0.002 frame | deriving one shared wall element from two room boundaries | no |
| Deterministic output fusion with ink gate (binarise at 100/255, sample every 4 px, dark pixel within ±3 px perpendicular, keep if coverage ≥ 0.5) and the purity rule p > F1/2, enabled per domain | combining two candidate sources without letting the weaker invent walls | no |
| Calibration discipline: thresholds frozen on validation, grid extended until optimum is interior; frozen id-hash fingerprinted splits; leakage assertion | analyzer evaluation hygiene | no |
| Vector-dataset -> centreline GT conversion (union wall+opening bodies, rasterise, close, skeletonise, Douglas–Peucker, weld, axis-snap 0.35×wall depth) | turning ResPlan-like polygon walls into centreline ground truth | no |
| Procedural generator design (program tree, guillotine splits, rooms as wall-ID cycles, doors swing into entered room, BFS reachability, 4 style families, tracked similarity transform, appearance-only degradations with ≤1.5 px registration test, fpeval-gated GT) | synthetic training/eval corpus owned by BuildPlan | no (for generation) |
| Dense multi-head network (junction + centreline + opening heatmaps) | only if/when an on-device model is approved; would need clean training data | yes |

Caveats: the paper's numbers are self-reported, single-author, not reproducible today (no code/data/checkpoints). The
autoregressive decoder, Raster2Seq continuation and the VLM track are not useful for BuildPlan (no remote AI in the analyzer;
non-commercial training lineage).

## 5. Verdict

**REIMPLEMENT_FROM_PAPER** for the metrics/readout/fusion/reconciliation/generator ideas. As software or model the
repository is **not adoptable**: it contains no code, no licence file, no weights; commercial status UNKNOWN; re-audit if
the author publishes code (expected MIT per README) or ResPlan-FP data.

## 6. Evidence

- `git clone https://github.com/Cyprinus12138/fpvec-lab` (full history), HEAD `f44a475a8c08333d75756fb08a1ace3a14e3b534`, README sha256 `0e26ec3d…f2f`; first README version sha256 `8cb6b7b48335982fdd4ca8cf7991a58092174db877da4d22791462b3c263d0f7`
- https://arxiv.org/abs/2608.25608 (v1 2026-08-26), PDF sha256 `262f6c16…2b81`
- https://huggingface.co/api/{models,datasets,spaces}?search=… (2026-10-06): no related artefacts
- https://pypi.org/pypi/{fpeval,fpvec,fpvec-lab,resplan-fp}/json -> 404; https://pypi.org/pypi/fpgen/json -> unrelated package
- https://github.com/Cyprinus12138/fpvec-lab/releases -> 403 (not reachable from this container)
