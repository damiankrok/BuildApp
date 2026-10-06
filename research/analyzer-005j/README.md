# research/analyzer-005j — floor-plan intelligence audit (BUILDPLAN-ANALYZER-005J)

**Research only.** Not a workspace, not typechecked, not collected by vitest, never imported by `packages/` or `apps/`
(`tests/architecture/research-isolation.test.ts`: the 005I gate covers all of `research/`, and its 005J block checks this directory and its artifacts for images, models and embedded image data). The TypeScript
scripts import production packages **read-only**; nothing here changes production behaviour, hashes or the APK.

**Publisher pixels never enter the repository.** Decoded frames, crops, composed question images, renders, masks,
checkpoints, model weights and virtual environments live in `$WORK` (default `/home/user/work005j`). The repository holds
code, pins, question records, coordinates, hashes and numbers only. No model file (`.pt`, `.onnx`, `.safetensors`, …) is
tracked.

Results and the stage's decision: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005J_FLOORPLAN_INTELLIGENCE_AUDIT.md` and
`stage-reports/artifacts/analyzer-005j/`.

## Files

| file | what |
| --- | --- |
| `opportunity_map.py` | merges the two read-only code audits into `visual-referee-opportunity-map.{json,md}` |
| `real-houses.json`, `extract-frames.ts` | decodes the blind-8 houses' selected ground-plan frames with the production decoder (bytes checked against the sealed package) |
| `synthetic/vrgen.py` | the synthetic Visual Referee corpus: 18 families as counterfactual pairs, 4 transforms, style axes; truth from scene semantics |
| `bands.ts` | the production `planSheet` wall bands on synthetic renders (the SEMANTIC_OVERLAY observations) |
| `realq.py` | real development questions: the 005I manual truth (7 houses) + the accepted 005I diagnosis of the 2 blind-8 houses |
| `compose.py` | one image + one prompt per question and overlay mode (RAW / CANDIDATE_OVERLAY / SEMANTIC_OVERLAY) |
| `select_items.py`, `subsets.py` | the fixed bake-off item selection and the per-model subsets (chosen before scoring) |
| `vlm_bench.py` | Florence-2-base, SmolVLM2-500M (ONNX), Moondream 0.5B (legacy ONNX client): GEN_JSON, ENUM_SCORE, STRUCTURED read-outs |
| `models.json` | revisions and SHA-256 of the model files the bake-off ran |
| `requirements-venv.lock.txt`, `requirements-md-venv.lock.txt` | the two research environments, frozen; font hashes |
| `score.py` | the pre-registered scorer (confident = p ≥ 0.80; CONFIDENT_WRONG_RATE; consistency; counterfactual sensitivity; majority floor and minority answers) |
| `summarize.py` | `vlm-bakeoff.md` from `vlm-bakeoff.json` |
| `technology_matrix.py` | `technology-matrix.{md,json}` (measured cells pulled from the bake-off and the wall proof) |
| `question_corpus.py` | writes the committed `question-corpus.json` (text facts only) |
| `wallproof/trainset.py`, `wallproof/wallnet.py`, `wallproof/realmasks.py` | the commercial-clean wall-model proof: synthetic masks, UNet-lite and an independently re-implemented MiT-B0 SegFormer (structure follows the Apache-2.0 PVTv2 / HF code; not clean-room) trained from scratch, synthetic + real exterior-wall evaluation against source-cv |
| `wallproof/blind8_regions.py` | pixel shares of a proof model inside the regions the 005I diagnosis names on the two round-8 frames |
| `wallproof/wall_referee.py` | a proof model read as a gap referee with pre-registered strip rules, scored by `score.py` like the VLMs |
| `wallproof/assemble_proof.py`, `wallproof/verdicts.json` | `wall-model-proof.json` from the measured files; the verdict strings written after reading the numbers |
| `pilot/micro_referee.py` | Route-C feasibility pilot: a from-scratch CNN trained on synthetic questions only |
| `wasm-probe.cjs` | onnxruntime-web (WASM, 1 thread) latency/RSS probe under Node 18.20.4 |

## Reproduce (from the BuildApp root; `W=/home/user/work005j`)

```bash
# environments (outside the repo), locked in requirements-venv.lock.txt and requirements-md-venv.lock.txt (pip freeze):
# a CPU torch venv (torch 2.5.1+cpu, transformers 5.18.0, onnxruntime 1.23.2, Pillow 12.3.0, numpy 1.26.4, shapely 2.1.2);
# a separate venv with moondream==0.0.6 (the last client that runs the 0.5B .mf locally).
# fonts: Debian fonts-dejavu-core 2.37-8 — DejaVuSans.ttf (generator) and DejaVuSans-Bold.ttf (composer), SHA-256 in the lock file header
# models (pinned in research/analyzer-005j/models.json, copied into vlm-bakeoff.json "pins")
#   florence-community/Florence-2-base@00921df66db728a9ceb750f5eca43e5c203a2051
#   HuggingFaceTB/SmolVLM2-500M-Video-Instruct@7b375e1b73b11138ff12fe22c8f2822d8fe03467 onnx/{vision_encoder,embed_tokens_int8,decoder_model_merged_int8}.onnx
#   vikhyatk/moondream2@9dddae84d54db4ac56fe37817aeaeb502ed083e2 (branch onnx) moondream-0_5b-int8.mf.gz
npx vite-node research/analyzer-005j/extract-frames.ts -- --work $W
P="$W/venv/bin/python -I -B research/analyzer-005j"
$P/synthetic/vrgen.py --out $W/synth --seeds 3                      # benchmark corpus (seed base 50050)
npx vite-node research/analyzer-005j/bands.ts -- --dir $W/synth/renders --out $W/synth/bands.json
$P/realq.py --work $W --repo .
$P/compose.py --corpus $W/synth/corpus.json --bands $W/synth/bands.json --renders $W/synth/renders --out $W/qs
python3 research/analyzer-005j/select_items.py $W/synth/corpus.json $W/real/corpus.json $W/sel
$P/compose.py --corpus $W/real/corpus.json --bands $W/real/bands.json --renders $W/real/renders --out $W/qr --subset <(grep '^real-' $W/sel.all.txt)
# merge qs/qr items in the selection into $W/bench/items-all.jsonl (+ image links), then:
python3 research/analyzer-005j/subsets.py                             # items-core / items-florence / gen-sample keys
# the three VLM runs resume (they skip done items); before the declared cut-off their item files were re-ordered so the
# blind-8 and real CANDIDATE_OVERLAY questions came first (bench/items-*-ordered.jsonl, same records, new order)
$P/vlm_bench.py --backend smolvlm2 --model-path <smol snapshot> --items $W/bench/items-smol-ordered.jsonl --img $W/bench/img --out $W/bench/smolvlm2.jsonl --threads 2 --methods GEN_JSON,ENUM_SCORE --gen-subset $W/bench/core-blind8-keys.txt
$W/md-venv/bin/python -I -B research/analyzer-005j/vlm_bench.py --backend moondream05 --model-path <...>/moondream-0_5b-int8.mf.gz --items $W/bench/items-md-ordered.jsonl --img $W/bench/img --out $W/bench/moondream05.jsonl --threads 2 --methods ENUM_SCORE
$P/vlm_bench.py --backend florence2 --model-path <florence snapshot> --items $W/bench/items-flo-ordered.jsonl --img $W/bench/img --out $W/bench/florence2.jsonl --threads 2 --methods ENUM_SCORE,STRUCTURED
$P/score.py --items $W/bench/items-all.jsonl --runs $W/bench/{smolvlm2,moondream05,florence2,wall-unet,wall-segformer,micro}.jsonl (comma-separated) --oracle $W/oracle --pins research/analyzer-005j/models.json --out stage-reports/artifacts/analyzer-005j/vlm-bakeoff.json
$P/summarize.py --bakeoff stage-reports/artifacts/analyzer-005j/vlm-bakeoff.json --out stage-reports/artifacts/analyzer-005j/vlm-bakeoff.md
# wall proof
$P/wallproof/trainset.py --out $W/wall/train --seed-base 70000 --seeds 10
$P/wallproof/trainset.py --out $W/wall/test --seed-base 90000 --seeds 3
$P/wallproof/realmasks.py --repo . --work $W
$P/wallproof/wallnet.py train --arch unet --data $W/wall/train --out $W/wall/unet.pt --steps 1500 --threads 1
$P/wallproof/wallnet.py train --arch segformer --data $W/wall/train --out $W/wall/segformer.pt --steps 1500 --lr 1e-3 --threads 1
$P/wallproof/wallnet.py eval --ckpt $W/wall/unet.pt --data $W/wall/test --real $W/wall/real/real-eval.json --out $W/wall/unet-eval.json      # same for segformer
$P/wallproof/blind8_regions.py --ckpt $W/wall/unet.pt --work $W --out $W/wall/unet-blind8-regions.json
$P/wallproof/wall_referee.py --ckpt $W/wall/unet.pt --synth $W/synth/corpus.json --synth-renders $W/synth/renders --real $W/real/corpus.json --real-renders $W/real/renders --items $W/bench/items-all.jsonl --out $W/bench/wall-unet.jsonl
$P/wallproof/wallnet.py export --ckpt $W/wall/unet.pt --data none --out $W/onnx/unet-lite.onnx
# Route-C pilot
$P/synthetic/vrgen.py --out $W/pilot/synth --seeds 8 --seed-base 60060
$P/compose.py --corpus $W/pilot/synth/corpus.json --bands $W/synth/bands.json --renders $W/pilot/synth/renders --out $W/pilot/q --side 256 --modes CANDIDATE_OVERLAY
$P/pilot/micro_referee.py train --items $W/pilot/q/items.jsonl --img $W/pilot/q/img --out $W/pilot/micro.pt
$P/pilot/micro_referee.py predict --ckpt $W/pilot/micro.pt --items $W/bench/items-all.jsonl --img $W/bench/img --out $W/bench/micro.jsonl
$P/pilot/micro_referee.py export --ckpt $W/pilot/micro.pt --items none --img none --out $W/onnx/micro-referee.onnx
# the proof artefact
$P/wallproof/assemble_proof.py --bakeoff stage-reports/artifacts/analyzer-005j/vlm-bakeoff.json --eval unet=$W/wall/unet-eval.json,segformer=$W/wall/segformer-eval.json --regions unet=$W/wall/unet-blind8-regions.json,segformer=$W/wall/segformer-blind8-regions.json --wasm $W/onnx/wasm-unet.json,$W/onnx/wasm-segformer.json,$W/onnx/wasm-micro.json,$W/onnx/wasm-smolvlm2.json --pilot-ckpt $W/pilot/micro.pt --ckpts unet=$W/wall/unet.pt,segformer=$W/wall/segformer.pt --verdicts research/analyzer-005j/wallproof/verdicts.json --out stage-reports/artifacts/analyzer-005j/wall-model-proof.json
$P/technology_matrix.py --bakeoff stage-reports/artifacts/analyzer-005j/vlm-bakeoff.json --wall stage-reports/artifacts/analyzer-005j/wall-model-proof.json --out-md stage-reports/artifacts/analyzer-005j/technology-matrix.md --out-json stage-reports/artifacts/analyzer-005j/technology-matrix.json
# WASM latency (Node 18.20.4, onnxruntime-web 1.30.0 from research/analyzer-005g/node_modules)
<node18>/bin/node research/analyzer-005j/wasm-probe.cjs --ort research/analyzer-005g/node_modules/onnxruntime-web --spec <spec.json> --out <json>
#   specs: unet-lite 1×1×864×864, segformer-b0 1×1×864×864, micro-referee 1×3×256×256, SmolVLM2 vision 1×1×3×512×512 +
#   decoder prefill (210 tokens, empty cache) + one decode step (210-token cache); node --max-old-space-size=4096 for SmolVLM2
```

The oracle sample (`SERVER_ORACLE`) was answered by blind sub-agents of the session's own model, reading only the neutral
`oNNN.png` images and prompts; the key (`key-DO-NOT-SHOW.json`) maps them back for scoring. It is a measurement of
solvability, never a production dependency, and not reproducible bit-exact.
