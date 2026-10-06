# Training routes for a BuildPlan Visual Referee (BUILDPLAN-ANALYZER-005J)

Three routes, each with data, compute, artifact, quantisation, Android runtime and the gate it must pass. **Times are
ranges with stated assumptions, not promises**: no GPU was available in this stage; only CPU numbers are measured
(marked **measured**). The brief's rule holds throughout: **synthetic generator truth is canonical**; a teacher model may
mine hard examples and propose candidates for human checking, never write ground truth.

Measured inputs to every estimate (this container: 4 shared x86-64 cores, no GPU):

| quantity | value | source |
| --- | --- | --- |
| synthetic scene generation (render + semantics) | **~29 scenes/s on one core** (1,152 scenes in 39 s) | `vrgen.py`, pilot corpus |
| question image composition | **~84 images/s on one core** | `compose.py`, pilot corpus |
| scene + wall/opening masks | 360 renders in 12.5 s | `wallproof/trainset.py` |
| generic small VLM, one closed question, desktop CPU (image path, not text-only) | see `vlm-bakeoff.json` → `latencyMs`; SmolVLM2-500M ≈ 1.2–3.7 s per question per read-out on 2–4 threads | `vlm_bench.py` |
| from-scratch wall networks, CPU training step (bs 8, 256²) | UNet-lite ≈ 0.8–1.3 s, MiT-B0 ≈ 2.1 s (1 thread, contended) | `wallproof/wallnet.py` |
| from-scratch micro-referee CNN (1.07 M params, bs 24, 256²) | **≈ 1.6 s per step on one contended core; 2,000 steps in 53 min** (measured) | `pilot/micro_referee.py` |
| UNet-lite / MiT-B0 full proof runs (1,500 steps, bs 8, 256²) | **20 min / 55 min** on 2 contended threads (measured) | `wallproof/wallnet.py` |

## Route A — fine-tune a small VLM on closed questions

| item | plan |
| --- | --- |
| base | **SmolVLM-500M-Instruct (v1, image-only)** — Apache-2.0 weights, the cleanest documented training mixture in the family (Cauldron + Docmatix); SmolVLM2-500M only if its academic-only / CC-BY-NC video data is cleared. Florence-2-base is not a VQA model (no VQA task token; 005J measured it as unusable zero-shot) and is not a base for this route. Moondream 0.5B: vendor-deprecated as an end model; no current local runtime. |
| task | the 005J prompt format: crop + candidate overlay + a closed enum incl. UNRESOLVED; train the **answer token(s) only**, read out by enum likelihood (005J ENUM_SCORE) — never free text |
| data | synthetic counterfactual corpus at scale: 18+ families × ~1,000 seeds × 2 variants × 4 transforms ≈ **140k images / ~220k questions**; generation ≈ 1.3 h on one core (≈ 20 min on 4); plus **style families broadened toward real sheets** (generic watermarks, coloured fills, callout rings; fonts only under OFL / Bitstream Vera / Apache licences, never a publisher's typeface or logo). Real development questions (005J `question-corpus.json`, REAL_DEV / REAL_BLIND8) are **held out** for validation only |
| hard negatives | every pair differs by one fact; mine failures of the current model and of the in-session oracle disagreement set; add the families the oracle hedged on (open-fronted garages, porch vs patio) |
| compute | full fine-tune (bf16) of 0.5 B with 64 image tokens per sample: **single RTX 4090-class GPU** ≈ 15–40 samples/s → 220k × 3 epochs ≈ **5–12 h**; LoRA ≈ 2× faster. One datacenter GPU (A100/H100 class) ≈ **2–6 h**. Assumptions: batch 32, sequence ≈ 250 tokens, no image splitting |
| rented cost class | 4090-class ≈ USD 0.4–1/h; A100/H100 ≈ USD 2–4/h → **USD 10–50 per training run**, **USD 100–500** for a sweep of 10 runs + evaluation |
| evaluation | the 005J benchmark (2,582 items, all three modes) + REAL sets; on GPU minutes, on CPU ≈ 1–3 h |
| quantisation / export | ONNX (optimum) int8 decoder + fp32 vision (005J found the official int8 vision encoder uses `ConvInteger`, which ONNX Runtime's CPU provider does not implement) or q4; ≈ 0.3–0.5 h |
| artifact | ≈ 340–510 MB (ONNX q4/int8) or ≈ 360 MB (community LiteRT-LM bundle format) |
| Android runtime | onnxruntime-web WASM (already shipped; CPU, one thread) or LiteRT-LM (new 21.8 MB native library, CPU/GPU) |
| expected phone latency | **≈ 16 s per question in the shipped runtime** for the base model (measured, ORT-web WASM, one thread, Node 18, desktop core: vision encoder fp32 11.9 s + 210-token prefill 3.8 s + 0.15 s per scored token; ≥ 1.9 GiB RSS); a phone core is slower. LiteRT-LM GPU might cut this, unmeasured for images |
| main risk | inherits the base model's training-data question; large download; seconds per question; calibration of a generative model |

## Route B — train a specialised wall / opening observation model (**PRIMARY for 005K**)

| item | plan |
| --- | --- |
| architecture | **UNet-lite** (1.56 M params, stride-2 stem), written in 005J from the U-Net paper and **trained from scratch**. The MiT-B0 SegFormer (3.71 M; an independent re-implementation following the Apache-2.0 PVTv2 / HF structure, not clean-room) was measured beside it at the same budget and is DEFERRED (slower, fewer real openings, misses the gozdzikowcach garage door; `wall-model-proof.json`). No NVIDIA / smp encoder code, no ImageNet weights; a MiT fallback in 005K would be built on the Apache-2.0 PVTv2 / HF code with its notice |
| task | per-pixel BACKGROUND / WALL / OPENING. Read **only at a gap**: the analyzer's own gap rectangle (005J `wall_referee.py` strips) gives shares, and the shares become a typed observation, never a decision |
| what 005J measured | synthetic: wall IoU 0.924, opening IoU 0.804, boundary F1 0.985, continuity through openings 0.980, false WALL on terraces 0.7 % / dimension lines 3.8 % / text 0.2 % (false OPENING is larger: dimension-line ink 18 %, open gaps 44.5 % by pixel — post-review A3). Real (7 development sheets, never trained on): exterior-wall recall 0.91–1.00; with the strip on the **wall axis**, 61 of 63 openings read OPENING (47 at ≥ 0.8, none wrong) and 50 of 65 continuations CONTINUES (44 at ≥ 0.8, none wrong) — the first run placed strips on the outer face and got 23 of 63 (post-review A2 / C1). **Additional exterior wall over source-cv ≈ 0 (0–1.7 %).** Round-8: cyklamenach window 97 % opening; gozdzikowcach porch mouth 100 % background, pier 100 % wall (the first pier box was misplaced, C2), the 0.41 m LEAF_FACE gap ≈ 94 % opening on its axis. **Replay:** upgrading that one gap completes gozdzikowcach at −3.75 % (`recommendation.md` §3) |
| what it is not yet | a referee: (1) it over-reads open gaps (12 confident-wrong CONTINUES on synthetic open gaps; 40 open gaps in 360 training renders); (2) real evidence is small and one-sided (8 distinct minority targets, no real PATTERN question); (3) it must read on the jamb-band axis, which production does not store today (`BoundaryGap` has `linePx` only) |
| data (005K) | BuildPlan synthetic masks (exact) at 20–50k scenes from `vrgen.py` v2: **open-gap hard negatives** (porch mouths, carports, open sides, recesses with returns, gaps with nothing across), terrace kerbs and hatch with breaks, dimension lines and text across walls, piers between openings, coloured fills and watermarks; every family as a counterfactual pair. Real development sheets for evaluation only, with a **balanced, human-verified real gap set** (≥ 50 minority questions) built before calibration. **Not** ResPlan (licence conflict), **not** CubiCasa (NC), not scraped imagery |
| compute | CPU is enough for the proof scale (measured: 20 min for 1,500 steps); 50k tiles × 30 epochs: **4090-class ≈ 1–3 h**, datacenter ≈ 0.5–1.5 h, **< USD 20 per run** rented; a full CPU run on 4 cores is ≈ 1–2 days |
| artifact | ≈ 6 MB fp32 ONNX (measured 6.25 MB); int8 ≈ 1.5 MB only if 005H-style parity holds |
| Android runtime | **onnxruntime-web WASM, one thread — the runtime the app already ships**; measured under Node 18.20.4: **1.19 s per 864² frame** (median of 3, contended), load 2.8 s, ≥ 340 MiB RSS; a 256² gap crop ≈ 0.1 s. No new native library |
| main risk | the synthetic-to-real gap on openings in unfamiliar styles; false walls on hatch / dimension lines; a witness that is right in aggregate but wrong on the one gap that matters — hence a per-gap confident-wrong gate on a balanced real set, and a typed abstention |

## Route C — distilled micro-referee (**SECONDARY, later**)

| item | plan |
| --- | --- |
| architecture | a small CNN or tiny ViT (≈ 1–20 M params): shared trunk + one head per question class; **input channels = grey crop + binary masks for target / A / B + the Route-B wall/opening map** (no overlay colours); abstention by calibrated confidence |
| what 005J measured (pilot) | 1.07 M params, trained from scratch only on synthetic question images (seeds disjoint from the benchmark), CANDIDATE_OVERLAY input: synthetic held-out **85.4 %**, confident-wrong 2.7 % at 0.80 and **0 at ≥ 0.98**; **REAL_DEV 49.7 %** — below the 76 % a constant guesser gets — with **34 % confident-wrong at 0.80 and 1.2 % even at 0.999**; REAL_BLIND8 70.6 %, 7.4 % confident-wrong. **An image-level classifier trained on synthetic images alone does not transfer to real sheets**; the pixel-level Route-B model trained on the same generator does. On device it is trivial: **70 ms per question** in ORT-web WASM (median of 20), ≥ 214 MiB |
| teacher | a strong model used **offline, at development time only**, on **synthetic** images: mine hard examples and propose counterfactual families. Sending **real publisher crops** to a hosted teacher, even to pre-label them for human verification, is **CONDITIONAL on counsel** (drawing copyright; the EU text-and-data-mining exception and any opt-out; publisher terms; the teacher provider's terms) — 005J did read 47 publisher crops through this session's own model as development material (post-review D1, D6). The teacher is never a runtime dependency |
| truth | generator semantics for synthetic (the only training truth); human-verified answers on real development crops are **evaluation and calibration data only** |
| data | the Route-B corpus plus real-style rendering, **synthetic only for training**. Real development crops are held out for evaluation and calibration; training on publisher crops would be a separate, counsel-cleared decision (**CONDITIONAL**), never the default; real **blind** houses never |
| compute | CPU-feasible; one 4090-class GPU ≈ 0.5–2 h per run, **< USD 20** |
| artifact | ≈ 1–20 MB fp32 |
| when | after Route B is in production as an observation, for the region / outline seams it cannot answer (REC-02 pocket body, REC-14 outer A/B, REC-21 resolver, UP-H1/H2) |
| main risk | measured: synthetic-to-real transfer; overconfidence on real |

## Gates every route must pass before any production integration (proposed for 005K / later)

1. **CONFIDENT_WRONG_RATE ≤ 0.5 % (target ≤ 0.2 %)** on a **balanced** REAL set (development + verified crops; both answers of every class represented) **and** on the synthetic hard-negative pairs, per question class; the threshold frozen on a separate validation split.
2. **Mirror and rotation consistency ≥ 99 %** of answered pairs; **counterfactual sensitivity**: no pair answered the same way when the truth differs, at confident level.
3. **A/B position**: letters-swapped pairs agree in meaning on ≥ 99 % of answered pairs (Route C).
4. **Useful coverage** reported per class, and **minority-answer accuracy** reported beside it (a constant guesser passes one-sided sets).
5. **Determinism**: bit-identical outputs on Node 18 / Node 22, x86-64 / arm64 V8 (the 005G/005H bar), pinned model SHA-256.
6. **Non-circularity**: the witness reads pixels and the analyzer's own gap geometry only — never a published figure, never the resolver's choice.
7. A **fresh blind protocol** only in the stage that integrates it into production.

## Order

1. **Route B in 005K, split in two** (`recommendation.md` §5).
   - **005K-a** (research):
     - per-gap Evidence Pack records with `axisPx`;
     - generator v2 with open-gap negatives, faint-symbol positives and on-line patterns;
     - a balanced, human-verified real gap set;
     - UNet-lite to the gates;
     - a two-signal witness at **IP-01 only**, as a pre-pass;
     - a model-in-the-loop replay gate;
     - a stop rule.
   - **005K-b** (integration), only if 005K-a passes.
   - Why Route B first:
     - it is the only measured piece that transfers to real sheets;
     - in the 005J oracle replay, one correct gap reading completes gozdzikowcach at −3.75 % (the storey count still
       fails), and the proof model reads that gap ≈ 94 % OPENING on its axis.
   - Cyklamenach is not moved by any gap upgrade: its blockers (REC-17, TOO_LARGE) are deterministic work outside
     Route B.
2. **Route C later.** For region / outline seams, fed with Route B's map, trained on synthetic data only, real crops
   for evaluation.
3. **Route A not now.**
   - Generic small VLMs are at or below chance zero-shot (`vlm-bakeoff.md`).
   - They cost 0.4–0.8 GB and ≈ 16 s per question in the shipped runtime (SmolVLM2: vision encoder 11.9 s + prefill
     3.8 s, measured in WASM).
   - A fine-tune inherits their training-data questions.
   - Revisit only if Route C plateaus on real questions.
