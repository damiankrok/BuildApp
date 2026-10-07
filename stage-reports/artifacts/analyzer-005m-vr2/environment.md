# 005M environment

Everything was measured in one Claude Code cloud container. **It is not a phone.** It has no GPU. Model weights never
entered the repository working tree.

## Hardware

| | |
| --- | --- |
| CPU | 4 vCPU, Intel Xeon @ 2.80 GHz. AVX-512 F/BW/CD/DQ/VL and AVX-512 VNNI; no AMX, no AVX-512 BF16 |
| RAM | 15.7 GiB (`MemTotal` 16,480,968 kB) in one memory cgroup. **tmpfs `/dev/shm` counts against it.** Weights placed in `/dev/shm` and the server's anonymous memory share the same 15.7 GiB |
| GPU | none |
| disk | a fixed per-session allowance. About 5 GB was free at the start of the stage and under 1 GB later. See "Storage" below |
| kernel | Linux 6.18.44 |

## Toolchain

| component | version |
| --- | --- |
| llama.cpp | `988190680d5a89fce97de3c20df2c2813731fd61` (2026-10-07), built here. Release, `BUILD_SHARED_LIBS=ON`, `GGML_NATIVE=ON` (so the AVX-512/VNNI kernels are compiled in), OpenMP, no BLAS, no curl |
| compilers | gcc 13.3.0 (Ubuntu 24.04), cmake 3.28.3 |
| Python | 3.11.15, in a venv outside the repository. Pinned lock: `research/analyzer-005m/requirements-venv.lock.txt` (torch 2.11.0+cpu, transformers 4.57.6, peft 0.17.1, accelerate 1.15.0, gguf from the llama.cpp tree, pillow, numpy, requests) |
| Node | 22.22.2 (repository tests only) |

The llama.cpp tools used were `llama-server` (every benchmark answer), `llama-mtmd-cli` (smoke checks only),
`convert_hf_to_gguf.py` (SmolVLM2-2.2B and InternVL3.5-2B, from the pinned safetensors) and `llama-quantize`.

## Server settings, identical for every model

```
llama-server -m <LLM.gguf> --mmproj <vision.gguf> -t 4 -tb 4 -c 8192 -np 1 --temp 0 --seed 0 --cache-ram 2048 --no-webui
```

- **One slot.** Questions run sequentially; no request competes with another.
- **Greedy and seeded.** `temperature 0`, `seed 0`, `max_tokens 40`, JSON-schema constrained output (`bench.py`).
- **Prompt cache capped at 2 GiB** (the default is 8 GiB). With weights in `/dev/shm`, the default cache drove the
  cgroup towards OOM.
  - The cache is what makes mode D cheap after C: they share the plan-image prefix.
  - It changes no answer by design, but llama.cpp does not promise bit-identical logits between cached and uncached
    evaluation. Latency tables therefore report cold-cache medians separately (`runtime-size-matrix.md`).
- **LLM Q8_0, vision projector F16** for the four bake-off models.
  - Q8_0 is the publisher's own quantisation for Qwen3-VL. It was converted here for SmolVLM2-2.2B and InternVL3.5-2B.
  - A quick check found the Q8_0 projector slower than F16 on this CPU, so F16 was kept.
  - The smaller Q4_K_M packs appear only as byte figures.
- **The teacher (Qwen3-VL-8B) runs as Q4_K_M + F16 projector.** Its Q8_0 (8.7 GB) does not fit in the memory cgroup
  beside the benchmark.
- **SmolVLM2-2.2B is given `--image-max-tokens 336`.** Each image becomes 2 × 2 tiles plus a global view, 419 tokens.
  - At its native 1,536 px, 1,417 tokens per image took about 100 s per image here, which would not have finished the
    matched run.
  - The cap is recorded with every result (`input-modes.md`).

## Network and accounts

- Outbound HTTPS goes through the session's agent proxy. Public, unauthenticated huggingface.co downloads at pinned
  revisions were reachable.
- `google/gemma-3n-E2B-it` and `-E4B-it` are gated. Their `config.json` returned **401**.
- **No account, token, credential or paid service was created or used.** No hosted inference was called.

## Storage (why weights never touched the repository)

- **Work directory: `/home/user/work005m`, outside the repository.** It holds:
  - the llama.cpp checkout and build;
  - the venv;
  - converted GGUFs;
  - every composed image (`items/img`, `items-train/img`);
  - synthetic renders (`sg-test`, `sg-trainval`);
  - raw benchmark logs.
- **The repository receives only text.** That means: ids, revisions, byte counts, hashes, structured answers
  (`runs/*.jsonl`), aggregates and scripts.
- **Two guards enforce it:**
  - `tests/architecture/research-isolation.test.ts` (005M block);
  - `research/analyzer-005m/history_gate.sh` (every commit from the stage base onward).
- **Weights in memory.** They were kept in `/dev/shm/models`, one model family at a time.
  - Pinned safetensors were deleted after conversion. These were files this stage downloaded.
- **Shared caches were not deleted.** Deleting other stages' caches (npm, Gradle, older work directories) to gain disk
  space was refused by the session's safety policy as irreversible, and was not pursued. The stage worked inside the
  remaining allowance instead.

## Production freeze

- **Baseline.** `research/analyzer-005m/freeze_check.sh` hashes `git ls-files -s` for every production path:
  `packages/*`, `apps`, `package.json`, `package-lock.json` and `.github`.
  - The baseline was taken at the stage base `47811e0953834af3ade62d314b35fc00f94ea4c9` and is stored outside the
    repository.
- **Re-checked before every push.** The result is quoted in the stage report.
