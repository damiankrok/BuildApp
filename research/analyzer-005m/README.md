# research/analyzer-005m — Visual Referee v2 bake-off (RESEARCH ONLY)

BUILDPLAN-ANALYZER-005M. Nothing here is imported by production code. No weight, checkpoint, adapter, tokenizer
bundle, composed image or publisher pixel is written inside the repository. Three guards check this:

- `tests/architecture/research-isolation.test.ts` (the 005M block);
- `history_gate.sh` (every commit since the stage base);
- the `raise SystemExit(...)` guards in `compose5.py`, `synthetic/vrgen2.py`, `hfget.py` and `bands_prep.py`.

Results and their reading: `stage-reports/STAGE_BUILDPLAN_ANALYZER_005M_VISUAL_REFEREE_V2.md` and
`stage-reports/artifacts/analyzer-005m-vr2/`.

## Layout

| file | role |
| --- | --- |
| `common.py` | the question contract: classes, options, per-base letter order, prompts per mode, JSON schema, ROI / overlay colours |
| `synthetic/vrgen2.py` | BuildPlan-owned global-context generator. Eight families on 005J's rasteriser. Disjoint seed splits TRAIN / VAL / TEST |
| `corpus.py` | the question pool from 005J / 005K / 005L development material, murajach, the storey questions and the generator |
| `select_items.py` | the fixed PHASE1 (32) and PHASE2 (167) selections, chosen before any model ran |
| `bands_prep.py` | inputs for the mode-E analyzer overlay. 005J's read-only `bands.ts` runs the production wall-band pass |
| `compose5.py` | the five input modes A–E per question, with image hashes and crop-identity checks of context pairs |
| `run_model.sh`, `bench.py` | one model behind its own `llama-server`, every item, structured reply + option probabilities + tokens / time / RSS |
| `score.py`, `summarize.py` | the pre-registered scorer (rules in its docstring) and its markdown tables |
| `runtime_matrix.py` | bytes, size classes, latency, tokens and RSS per model and mode |
| `manifest.py`, `hfget.py` | pinned model manifest (text only); pinned, hash-checked downloads outside the repository |
| `question_corpus.py` | the committed text-only record of the corpus |
| `teacher_select.py`, `student_dataset.py`, `student_probe.py` | teacher mining items (TRAIN only), the student training format, a CPU LoRA step probe that saves nothing |
| `history_gate.sh`, `freeze_check.sh` | Git history weight gate; production freeze hashes |
| `requirements-venv.lock.txt` | the Python environment |

## Reproduce

`W` is a work directory **outside** the repository. Run these commands from the repository root.
`PY="$W/venv/bin/python -I -B"`.

```bash
# 0. runtime: llama.cpp at the stage's commit, CPU build; Python venv from the lock
git clone https://github.com/ggml-org/llama.cpp $W/llama.cpp && git -C $W/llama.cpp checkout 988190680d5a89fce97de3c20df2c2813731fd61
cmake -S $W/llama.cpp -B $W/llama.cpp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON -DGGML_NATIVE=ON -DLLAMA_CURL=OFF
cmake --build $W/llama.cpp/build -j4 --target llama-server llama-mtmd-cli llama-quantize
python3 -m venv $W/venv && $W/venv/bin/pip install -r research/analyzer-005m/requirements-venv.lock.txt   # gguf: pip install -e $W/llama.cpp/gguf-py

# 1. models (pinned; revisions and hashes in stage-reports/artifacts/analyzer-005m-vr2/model-manifest.json)
#    Qwen3-VL-2B/4B/8B: the publisher's own GGUF repositories, fetched by resolve/<revision>/<file>
#    SmolVLM2-2.2B and InternVL3.5-2B: download the pinned safetensors and convert at the runtime commit
$PY research/analyzer-005m/hfget.py OpenGVLab/InternVL3_5-2B-Instruct a1e50c526faea805730148e7b1f2af18abe9e4b2 /dev/shm/hf/internvl
#    InternVL3.5 ships no preprocessor_config.json: write the model card's ImageNet mean/std and size 448 next to it
$W/venv/bin/python $W/llama.cpp/convert_hf_to_gguf.py /dev/shm/hf/internvl --outtype q8_0 --outfile <out>/InternVL3_5-2B-Instruct-Q8_0.gguf
$W/venv/bin/python $W/llama.cpp/convert_hf_to_gguf.py /dev/shm/hf/internvl --mmproj --outtype f16 --outfile <out>/mmproj-InternVL3_5-2B-Instruct-F16.gguf
#    (the same two steps for HuggingFaceTB/SmolVLM2-2.2B-Instruct@482adb537c021c86670beed01cd58990d01e72e4)

# 2. synthetic global-context corpus (renders stay in $W)
$PY research/analyzer-005m/synthetic/vrgen2.py --out $W/sg-test --splits TEST --pairs 5
$PY research/analyzer-005m/synthetic/vrgen2.py --out $W/sg-trainval --splits TRAIN,VAL --pairs 22,5

# 3. pool and fixed selections (needs the 005J / 005K / 005L work directories and publisher caches)
$PY research/analyzer-005m/corpus.py --work $W --repo . --synth-global $W/sg-test/corpus.json
$PY research/analyzer-005m/select_items.py --pool $W/corpus/pool.json --out $W/corpus

# 4. analyzer overlay (mode E) and the five modes
$PY research/analyzer-005m/bands_prep.py link --pool $W/corpus/pool.json --selection $W/corpus/selection.json --dir $W/bands/src
npx vite-node research/analyzer-005j/bands.ts -- --dir $W/bands/src --out $W/bands/raw.json
$PY research/analyzer-005m/bands_prep.py index --raw $W/bands/raw.json --out $W/bands/bands.json
$PY research/analyzer-005m/compose5.py --pool $W/corpus/pool.json --selection $W/corpus/selection.json --bands $W/bands/bands.json --out $W/items

# 5. bake-off: phase 1 (32 questions x 5 modes), every mandatory model; phase 2 (167 x 5), the best three
research/analyzer-005m/run_model.sh qwen3-vl-2b <Q8_0.gguf> <mmproj F16.gguf> 1 $W/runs/p1-qwen3-vl-2b.jsonl
research/analyzer-005m/run_model.sh smolvlm2-2.2b <Q8_0.gguf> <mmproj F16.gguf> 1 $W/runs/p1-smolvlm2-2.2b.jsonl --image-max-tokens 336
research/analyzer-005m/run_model.sh qwen3-vl-2b <Q8_0.gguf> <mmproj F16.gguf> 2 $W/runs/p2-qwen3-vl-2b.jsonl
#    ... the same for qwen3-vl-4b and internvl3.5-2b-instruct

# 6. scoring and tables
$PY research/analyzer-005m/score.py --items $W/items/items.jsonl --runs $W/runs/p1-smolvlm2-2.2b.jsonl,$W/runs/p2-qwen3-vl-2b.jsonl,... \
    --out-dir stage-reports/artifacts/analyzer-005m-vr2 --old-smol <W005J>/bench/smolvlm2.jsonl --old-items <W005J>/bench/items-all.jsonl
$PY research/analyzer-005m/summarize.py --dir stage-reports/artifacts/analyzer-005m-vr2 --out stage-reports/artifacts/analyzer-005m-vr2/bakeoff-tables.md
$PY research/analyzer-005m/runtime_matrix.py --manifest stage-reports/artifacts/analyzer-005m-vr2/model-manifest.json --runs $W/runs \
    --libs $W/llama.cpp/build/bin --quant $W/manifests/quantised-sizes.json --out stage-reports/artifacts/analyzer-005m-vr2/runtime-size-matrix.md

# 7. teacher lane (TRAIN split only) and student format / probe
$PY research/analyzer-005m/corpus.py --work $W --repo . --synth-global $W/sg-test/corpus.json --synth-train $W/sg-trainval/corpus.json --pool-name pool-with-train.json
$PY research/analyzer-005m/teacher_select.py --pool $W/corpus/pool-with-train.json --out $W/corpus/selection-train.json
#    bands for the TRAIN renders exactly as in step 4 (src-train / raw-train / bands-train), then:
$PY research/analyzer-005m/compose5.py --pool $W/corpus/pool-with-train.json --selection $W/corpus/selection-train.json --bands $W/bands/bands-train.json --out $W/items-train
research/analyzer-005m/run_model.sh qwen3-vl-8b-teacher <Q4_K_M.gguf> <mmproj F16.gguf> 1 $W/runs/teacher-p1-qwen3-vl-8b.jsonl
ITEMS=<balanced TRAIN slice>.jsonl MODES=D_MARKED_ROI_PLUS_CROP research/analyzer-005m/run_model.sh qwen3-vl-8b-teacher <...> <...> 2 $W/runs/teacher-train-qwen3-vl-8b.jsonl
$PY research/analyzer-005m/student_dataset.py --pool $W/corpus/pool-with-train.json --sg-trainval $W/sg-trainval/corpus.json --out $W/student --teacher $W/runs/teacher-train-qwen3-vl-8b.jsonl
$PY research/analyzer-005m/student_probe.py --model <SmolVLM2-500M snapshot> --items <TRAIN items.jsonl> --img $W/items-train/img --steps 8 --out $W/student/probe.json

# 8. gates
research/analyzer-005m/history_gate.sh
research/analyzer-005m/freeze_check.sh <start.txt taken at the stage base>
npx vitest run tests/architecture/research-isolation.test.ts
```

Runs are resumable: `bench.py` skips every (question, mode) already in its output file. Run one model at a time. On a
4-core CPU, phase 2 takes about 4 h for Qwen3-VL-2B, 8 h for Qwen3-VL-4B and 6.5 h for InternVL3.5-2B.
