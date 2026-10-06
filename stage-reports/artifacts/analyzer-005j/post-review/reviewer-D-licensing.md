# 005J post-review — Reviewer D: licensing, data provenance and supply chain

**Verdict: CONDITIONAL PASS.** There is no P0. The primary route (UNet-lite from scratch, BuildPlan synthetic data,
ORT-web) is licence-clean as far as the evidence reaches. The two P1 findings are documentation fixes:

- the SECONDARY route, as written, trains on publisher crops (D1);
- the licensing record certifies a "clean-room" process for the MiT-B0 that the code does not support (D2).

Before the stage closes, the P2 items should be corrected or stated.

Reviewed at commit `1c81b12` on `analyzer/floorplan-intelligence-audit-v1`. The worktree was clean when I checked.
Missing VLM numbers and ⟪…⟫ placeholders are out of scope, as instructed.

## What I recomputed (and found correct)

| check | result |
| --- | --- |
| Model pins (`research/analyzer-005j/models.json`) | `sha256sum` of the 5 local files (Florence port safetensors; SmolVLM2 `vision_encoder.onnx`, `embed_tokens_int8.onnx`, `decoder_model_merged_int8.onnx`; Moondream `0_5b-int8.mf.gz`) matches **5/5**. The 3 proof ONNX files (`unet-lite`, `segformer-b0`, `micro-referee`) match `wall-model-proof.json → wasm.*.sha256` **3/3** |
| ResPlan evidence | local clone `HEAD e2b78fe`. LICENSE sha256 `8193a93c…bf499` (CC BY 4.0 data section with the "facts" carve-out, MIT code section). `croissant.json` sha256 `a915ed5f…7c84` → `"CC BY-NC-SA 4.0"`. `kaggle_view.json` → `licenseName "CC BY-NC-SA 4.0"`, v12, 2026-07-28. All as reported |
| fpvec-lab | full clone: `git rev-list --all --count` = 2; tree = `README.md` only; no LICENSE. As reported |
| floorplan-to-3d | `@ccc1972`, MIT ("Copyright (c) 2026 Tuukka Yildirim"). As reported |
| NVIDIA code inside smp | smp 0.5.0 wheel sha256 `c34e0904…1a05` (= `mitunet.md`). `encoders/mix_transformer.py` opens "Copyright (c) 2021, NVIDIA … Licensed under the NVIDIA Source Code License". NVlabs LICENSE copy sha256 `f549820c…1a61` contains "non-commercially means for research or evaluation purposes only". As reported |
| SmolVLM2 data caveats | `vlm-audit.json` quotes the dataset cards: Vript "ACADEMIC USE ONLY / NO DISTRIBUTION", ShareGPT4Video `cc-by-nc-4.0`, LLaVA-Video-178K "academic research and education". Supported |
| No pretrained weight anywhere in the proofs | `grep` finds no `torchvision` / `timm` / `segmentation_models` / `torch.hub` / `hf_hub` in the proof code. `from_pretrained` appears only in the VLM runners. `wallnet.build()` and `MicroReferee()` construct from random init, and `torch.load` reads only the stage's own checkpoints. Step-0 losses of 2.056 / 2.119 are consistent with random init. Checkpoint metadata: `unet.pt` / `segformer.pt` `trainItems 360`, `data /home/user/work005j/wall/train`; `micro.pt` `trainItems 1792` |
| Training sets are synthetic only | `wall/train` = 360 scenes (18 families × 20, png+npz). Pilot `items.jsonl` = 1,792 items, all `set: SYNTHETIC`, all CANDIDATE_OVERLAY |
| What the commit tracks | 45 files under `research/analyzer-005j/` + `stage-reports/artifacts/analyzer-005j/`, all `.py/.ts/.cjs/.json/.md`. No data URL and no base64 run ≥ 120 chars in any of them. Largest numeric array: 40 values (`question-corpus.json`), 5 (`wall-model-proof.json`). No publisher URL in the corpus |
| `question-corpus.json` | 1,868 questions. Real records hold: frame id; source-byte, URL and decoded-RGBA SHA-256; metres/px; target rectangles; crop boxes; image/prompt SHA-256; enum and expected answer; a short "why". Coordinates and hashes only, as claimed |
| Root manifests and workspaces | `git diff 64b78b4 1c81b12` excluding `research/analyzer-005j`, `stage-reports` and the test is **empty**. Root `workspaces` = `tests/architecture, tests/benchmark, packages/*, apps/*` (research is not a workspace). No `package.json` under 005J |
| WASM probe dependencies | the probe borrows `research/analyzer-005g/node_modules` (git-ignored, last modified 2026-10-05, untouched by 005J) |
| Python environments | both live outside the repo: `/home/user/work005j/venv` and `/home/user/work005j/md-venv` |
| Runtime notices for 005K | `apps/android/app/src/main/assets/licenses/onnxruntime-LICENSE.txt` and `onnxruntime-ThirdPartyNotices.txt` are present. A BuildPlan-owned model on the same ORT-web 1.30.0 adds no third-party notice |
| Synthetic assets | textures, furniture, cars, stairs and walls are all procedural (`vrgen.py:117–170, 310–330, 133–141`). There are no image or texture files and no third-party pixels. The only external asset is the system DejaVu font (D7) |

## Findings

### D1 — P1: the SECONDARY route trains on publisher crops and uses a hosted teacher on them; it is not the "commercially clean" route the stage claims

**Evidence**

- `training-plan.md:59`, Route C data: "the Route-B corpus plus real-style rendering; **every verified real development
  crop**".
- `:58`: "truth … human-verified answers for real crops".
- `:57`: the teacher will "pre-label real development crops".
- `recommendation.md:99`: "distilled from a strong offline teacher whose real-crop answers are verified by a person".
- Against these, the stage report's legal statement (`STAGE_…AUDIT.md:222–223`): "Every route trains only on BuildPlan's
  own synthetic data … plus, **for evaluation and calibration only**, verified answers on real development crops".
- And `licensing-matrix.md:65`: "The only COMMERCIAL_CLEAN training route measured is BuildPlan's own synthetic drawings".
- `server-feasibility.md:58` calls sending a crop to a third party "a licensing question for counsel". Yet `:66` accepts
  SERVER for "development / teacher use", which sends exactly those crops.
- The licensing matrix has no row for a development-time teacher. The `SERVER_ORACLE` row (`:41`) says "measurement only".

**Fix (text).** Do one of the following:

- Restrict Route C's real crops to validation and calibration, as Route B does.
- Or mark Route C **CONDITIONAL** in `licensing-matrix.md` and name the residual questions:
  - (a) copyright in architectural drawings under Polish and EU law;
  - (b) the EU DSM Art. 4 commercial TDM exception, and whether the publisher's site carries a machine-readable opt-out;
  - (c) the publisher's terms of use;
  - (d) the teacher provider's terms on data sent and on using its answers to train a model.

Either way, add a "development-time teacher" row next to the oracle row.

The primary is not affected, because Route B uses real crops for evaluation and calibration only. That
evaluation/calibration use should still be named as a residual (see D6).

### D2 — P1: the "clean-room / written from the paper" claim for the MiT-B0 SegFormer is stronger than the code supports

`wallnet.py` contains no literal copy: identifiers differ, it uses `F.scaled_dot_product_attention`, and it has no
dropout, drop-path or init code. But it reproduces four implementation details that are **not in the SegFormer paper**
and are in the reference implementations:

1. **Patch embedding.** Class `OverlapPatchEmbed` with `proj`/`norm` (`wallnet.py:69`). The class name and attributes
   are identical in NVIDIA's `mix_transformer.py:227` and in PVTv2's `pvt_v2.py`.
2. **Attention projections.** Separate `q` and a fused `kv` Linear, with
   `.reshape(b, -1, 2, heads, c // heads).permute(2, 0, 3, 1, 4)` (`wallnet.py:88, 102`). This is identical to NVIDIA
   `mix_transformer.py:143/149` and PVTv2 `pvt_v2.py:107`.
3. **Fuse layer.** The decoder fuse is `Conv2d(4C→C, 1, bias=False) + BatchNorm + ReLU` (`wallnet.py:144`). The paper's
   decoder equation is `Linear(4C, C)`. HF `modeling_segformer.py:481–488` says of exactly these three layers: "implement
   the ConvModule of the original implementation".
4. **Concatenation order.** Reversed: `torch.cat(ups[::-1])` (`wallnet.py:163`), as in HF
   `torch.cat(all_hidden_states[::-1])` (`:518`) and NVIDIA `[_c4, _c3, _c2, _c1]`.

**Risk is low.** The encoder pattern is also in PVTv2, which is Apache-2.0 (`whai362/PVT@v2` LICENSE sha256
`b208c52b…a1a5`; `pvt_v2.py` sha256 `235dbf0b…c117`, fetched 2026-10-06). The decoder pattern is in HF transformers,
also Apache-2.0.

**The wording is still wrong.** "Clean-room" names a process: the implementer never saw the code. That cannot be asserted
for an implementer trained on these public repositories. It also contradicts the stage's own caution in `mitunet.md` §5.1
that even HF's port is a counsel question.

The claim appears at:

- `licensing-matrix.md:58` ("must be written clean-room (005J's `wallproof/wallnet.py` does)");
- the stage report `:101`, §F `:139–140`;
- `training-plan.md:41`;
- `wall-model-proof.json → licence.code`;
- `wallproof/verdicts.json:3`;
- the README `:32`;
- the `wallnet.py` docstring.

**Why it matters.** 005K's deliverable 3 keeps "MiT-B0 only if UNet cannot meet the false-wall gate" as a fallback, and
that fallback would inherit the overclaim.

**Fix.** Say "independent re-implementation, not clean-room; its structure follows public PVTv2 / HF (Apache-2.0)
implementations". If MiT is ever revived, either:

- build it on the Apache-2.0 PVTv2 or HF code and keep their notices; or
- run a documented clean-room.

UNet-lite is unaffected: it is a textbook U-Net with no smp-specific structure.

### D3 — P2: the Florence native port matches the Microsoft weights on a sample; the caveat can be narrowed

Stage report §O.8 and `licensing-matrix.md:35` say tensor identity was "not verified". I compared the two checkpoints:

- **Headers.** I range-read the header of `microsoft/Florence-2-base@5ca5edf` `model.safetensors` and compared it with
  `florence-community@00921df`. Microsoft has 666 F16 tensors and the port 665. There are three differences:
  - `final_logits_bias` (1×51,289) is absent from the port. It is **all zeros** in Microsoft's file.
  - `image_projection` is transposed.
  - The shared embedding is padded from 51,289 to 51,328 rows.
- **Tensor content.** I range-fetched 37 Microsoft tensors (89.4 MB), covering the vision convs and blocks, encoder and
  decoder layers, position and temporal embeddings, the projection and the shared embedding:
  - **35 are byte-identical** to port tensors;
  - `image_projection` is identical after transpose;
  - the shared embedding is identical on all 51,289 original rows.

This is a sample, not a full proof, but it supports "a faithful MIT-licensed conversion of the MIT weights". Record it.

One observation for the bake-off reviewers (not a licensing point): the 39 padding rows are **non-zero** (29,952
values), and `lm_head` is tied to that embedding. ENUM_SCORE should normalise over the enum tokens, not over the full
vocabulary.

### D4 — P2: "usable for internal research now" is a legal conclusion the evidence does not reach

- `resplan.md:153` says ResPlan is "usable for internal research/evaluation now". The `RESEARCH_ORACLE_ONLY` class
  (CubiCasa5K, floorplan-to-3d, Raster2Seq) assumes the same.
- Under CC BY-NC(-SA) 4.0, NonCommercial means "not primarily intended for or directed towards commercial advantage".
  R&D for a commercial app is arguably directed towards it, so this is itself a counsel question.
- 005J's actual use was minimal, which is acceptable as an audit:
  - ResPlan was parsed and two plans were rendered to scratch;
  - a CubiCasa checkpoint was fetched by accident and never loaded (survey "Method").
- Fix: reword to "inspected for the audit; any further internal use is a counsel question under the NC reading".

### D5 — P2: the upstream clones were not deleted

- The stage report says they were (`:41–42`, and §O.10 `:360–361`).
- `/home/user/work005j/upstream/` still holds 7 clones:

  | clone | size |
  | --- | --- |
  | CubiCasa5k | 1.4 MB |
  | MLStructFP | 4.5 MB |
  | floorplan-to-3d | 4.1 MB |
  | fpvec-lab | 0.2 MB |
  | fpvec-lab-full | 0.2 MB |
  | moondream | 3.3 MB |
  | resplan | 1.5 MB |

- `data/resplan/` (96 MB, including `ResPlan.zip`) is also still there.
- None of this is in the repo, so there is no licence exposure. The statement is false, though. Delete the clones or
  correct the text.
- Related editorial slip: `wallproof/trainset.py:11` points to "stage report section B" for the licence findings; they
  are in §C.

### D6 — P2: "No project byte was sent to a third-party service" needs a precise restatement

- Stage report `:22–25` makes this claim.
- The oracle key (`/home/user/work005j/oracle/key-DO-NOT-SHOW.json`) shows that **47 of the 149** oracle images are
  `real-*` composed crops of publisher drawings. The session's hosted model read them.
- That is the same channel the whole development session uses, and no BuildPlan component sent anything. Still, the
  stage's own `server-feasibility.md:58` treats a crop leaving the device as a counsel question, so say it plainly. For
  example: "47 publisher crops were read by the session's model as development material; no BuildPlan runtime sends
  anything."
- Add to `licensing-matrix.md` the residual for **evaluation and calibration** on publisher crops (Route B's balanced real
  gap set). This is long-standing project practice, but it belongs in the record next to "COMMERCIAL_CLEAN".

### D7 — P2: font provenance is unpinned, and generator v2 needs a font and watermark rule

The generator and the composer use system fonts:

| file | font | sha256 |
| --- | --- | --- |
| `vrgen.py:29` | `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` | `ae7b7855…7280` |
| `compose.py:25` | `DejaVuSans-Bold.ttf` | `5c1247ac…e895` |

- The fonts come from Debian `fonts-dejavu-core 2.37-8`.
- Licence (Debian copyright file): the **Bitstream Vera Fonts licence** for the base glyphs, with the DejaVu changes in
  the public domain. It is permissive. Rendered glyphs in training images carry no obligation. Vendoring the `.ttf` would
  require keeping the Vera notice.
- `licensing-matrix.md:29` calls it a "public-domain-style permissive font licence", which is imprecise, and omits the
  Bold weight used by `compose.py`.
- Neither the font hash nor the Pillow version that rasterises text (12.3.0) is recorded:
  - `synthetic-corpus.md` and `question-corpus.json → synthetic` carry only `version 1.0.0`;
  - so the "COMMERCIAL_CLEAN corpus" claim has no pinned asset list.
- For 005K:
  - pin the font SHA-256 and the generator's environment in the corpus manifest;
  - use only OFL / Vera / Apache fonts;
  - never use a publisher's typeface or logo for the planned "publisher-like fonts" (`training-plan.md:26`) or
    "watermarks" (`recommendation.md:60`);
  - check font EULAs for ML-training restrictions.

### D8 — P2: the 005J isolation test is adequate today but narrow

- The current tree passes my emulation of the block.
- Gaps:
  - **(a) Scope of the pixel regex.** It runs only on `.json/.md`. A base64 PNG inside a `.py/.ts/.cjs` passes.
  - **(b) Formats.** It detects only `data:image/`, PNG (`iVBORw0KGgo`) and JPEG (`/9j/4`). It misses WebP (`UklGR`),
    GIF (`R0lGOD`), `data:application/…;base64`, and pixel or mask data stored as JSON number arrays.
  - **(c) Size.** There is no per-file size cap.
  - **(d) Assets allowlist.** The Android assets check exempts any name containing `numeric-recogniser|ppocr|paddle`. Its
    extension list omits `.tflite/.litertlm/.ort/.bin/.npz/.npy/.pkl` (`.pt` is covered by the 005I block).
- Suggested additions:
  - a generic base64-run check (≥ 256 chars) over all audit files;
  - a cap on numeric-array length (e.g. ≤ 64 values);
  - a size cap (e.g. 4 MB);
  - the wider extension list.

### D9 — P2: the research environments are not locked

- The README pins only `transformers==5.18.0` and `onnxruntime==1.23.2`.
- Not recorded:
  - torch `2.5.1+cpu`, Pillow `12.3.0`, numpy `1.26.4` and shapely in `venv`;
  - in `md-venv`, onnxruntime `1.30.0` and numpy `2.4.6`;
  - the SHA-256 of the `.pt` checkpoints (the ONNX files are hashed).
- For 005K, ship a hashed requirements lock with the model manifest. Add the generator version, seed ranges and font hash.

### D10 — P2: MitUNet's "non-commercial on three independent grounds" should name which three

- Three grounds hold for the three CubiCasa-lineage checkpoints:
  - the authors' CC BY-NC statement;
  - CubiCasa5K data;
  - NVIDIA SCL ImageNet initialisation.
- The regional-only checkpoint `mitunet_mit_b4_tversky_a6_8784_30E.pth` was not trained on CubiCasa (`mitunet.md` §4).
  The README's CC BY-NC statement, whose stated basis is CubiCasa, still covers it, along with the NVIDIA init.
- The NVIDIA SCL on the **code** (`mix_transformer.py`) is a separate fourth ground. `floorplan-models.md` lists all four
  layers but says "three".
- The conclusion is unchanged; the wording should be precise.

### D11 — P2: SmolVLM-500M v1 as "the cleanest base" is relative only

- The Cauldron card (fetched 2026-10-06) says only: "Each of the publicly available sub-datasets … governed by specific
  licensing conditions".
- 005J did not enumerate those ~50 sub-dataset licences.
- "Cleaner than SmolVLM2" is supported; "clean" is not. Keep it CONDITIONAL and add "sub-dataset licences unaudited".
- Route A is rejected, so nothing changes.

## Position on the primary recommendation

From a licensing and provenance standpoint, **TRAIN_BUILDPLAN_WALL_MODEL is the right primary, and it is the cleanest
route on the table.**

**What I verified:**

- The code is BuildPlan's own, and UNet-lite is generic.
- The weights were trained here from random initialisation.
- The training data is procedurally generated, with no third-party pixels.
- Its only external asset is a permissively licensed font.
- Training used PyTorch (BSD, training only).
- The runtime is the MIT ORT-web the app already ships, with its LICENSE and ThirdPartyNotices in place.
- No pretrained weight, NC dataset or scraped image entered either proof.
- Nothing in the repository holds a publisher pixel or a model file.

**What remains:**

- Name the evaluation/calibration use of publisher crops as a residual (D6).
- Pin the font and environment (D7, D9).
- Stop calling the MiT-B0 fallback clean-room (D2).

**Not clean as written:** the SECONDARY (TRAIN_BUILDPLAN_VISUAL_REFEREE). It trains on publisher crops and uses a hosted
teacher on them, and must either drop those or be relabelled CONDITIONAL with counsel questions before the
recommendation calls it legally clean (D1).

## Summary

| ID | severity | one line |
| --- | --- | --- |
| D1 | **P1** | Route C trains on publisher crops and uses a hosted teacher on them; this contradicts §H and licensing-matrix §4.5. Restrict real crops to evaluation, or mark Route C CONDITIONAL with counsel questions; add a teacher row |
| D2 | **P1** | The "clean-room" MiT-B0 claim is unsupported (4 non-paper implementation fingerprints). Low risk (PVTv2 and HF are Apache-2.0) but must be reworded; it affects 005K's fallback |
| D3 | P2 | Florence port sample-verified identical (37 tensors). Narrow the caveat; check ENUM_SCORE normalisation against the non-zero pad rows |
| D4 | P2 | "Usable for internal research now" for NC material is a counsel question |
| D5 | P2 | Upstream clones and ResPlan.zip were not deleted, although the report says they were; section cross-reference slip |
| D6 | P2 | "No project byte sent" needs restating: 47 publisher crops were read by the session model; evaluation-on-publisher-crops residual |
| D7 | P2 | DejaVu (Bitstream Vera licence) unpinned; generator v2 needs a font and watermark rule |
| D8 | P2 | Isolation test: regex only on json/md, image formats only, no size cap, narrow asset extensions |
| D9 | P2 | Research environments not locked; `.pt` files not hashed |
| D10 | P2 | MitUNet "three grounds" imprecise |
| D11 | P2 | The Cauldron's sub-dataset licences are unaudited |
