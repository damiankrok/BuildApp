# 005M environment

Everything was measured in one Claude Code cloud container. **It is not a phone.** It has no GPU. Model weights never
entered the repository working tree.

## Hardware

| | |
| --- | --- |
| CPU | 4 vCPU, Intel Xeon @ 2.80 GHz. AVX-512 F/BW/CD/DQ/VL and AVX-512 VNNI; no AMX, no AVX-512 BF16 |
| RAM | 15.7 GiB host (`MemTotal` 16,480,968 kB). **Every process of the session runs in one memory cgroup limited to 14,345,031,680 bytes (13.36 GiB), and tmpfs `/dev/shm` counts against it.** Weights in `/dev/shm`, the server's anonymous memory and the page cache share that limit |
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
- **Prompt cache capped at 2 GiB** (the default is 8 GiB).
  - With weights in `/dev/shm`, the default cache drove the cgroup towards OOM.
  - The cgroup killed three processes in the stage (post-review E2-3):
    - a `llama-mtmd-cli` smoke check at about 14:03 UTC on Oct 7 (anon 5.78 GB + shmem 1.79 GB), before the context and
      the cache were capped;
    - the teacher's server at 10:46 UTC on Oct 8, after 27 comparison records (anon 7.9 GB + shmem 4.9 GB); it was rerun
      with `-c 4096 --cache-ram 0` (`teacher-feasibility.md`);
    - the student CPU probe at 10:48 (exit 137, at the default 2,048 px); it was rerun at 1,024 px (`student-training.md`).
  - Apart from the SmolVLM2-2.2B server crash below, no bake-off server died, every run file is complete, and failures
    are counted per record.
  - **The first 16 SmolVLM2-2.2B phase-1 records ran under the server's default 8 GiB prompt cache**, before the 2 GiB
    cap was set. That server crashed after 16 records and was restarted with `--cache-ram 2048`, and the run resumed by
    key (`runs/p1-smolvlm2-2.2b.out`). Record 15 has a token-split error: its answer is valid, its image-token count is
    missing; the scorer and the runtime matrix leave it out rather than counting 0 (post-review A-10).
  - The cache is what makes mode D cheap after C: they share the plan-image prefix.
  - **The cache can change an answer** (post-review A2-4). llama.cpp does not promise bit-identical logits between cached
    and uncached evaluation. On the 17 mode-A item pairs whose images and prompt are byte-identical, Qwen3-VL-2B,
    Qwen3-VL-4B and SmolVLM2-2.2B gave identical answers (largest probability shift 0.025, 0.030, 0.036). InternVL3.5-2B
    answered **3 of 17** differently between the cold record (4 cached tokens) and the warm one (453–460 cached), each
    time between UNRESOLVED and A at a near tie (largest shift 0.037); two of the three are in the amended set. So
    "the same answer is forced on byte-identical crops" holds only up to this cache nondeterminism. Latency tables
    report cold-cache medians separately (`runtime-size-matrix.md`).
- **LLM Q8_0, vision projector F16** for the four bake-off models.
  - Q8_0 is the publisher's own quantisation for Qwen3-VL. It was converted here for SmolVLM2-2.2B and InternVL3.5-2B.
  - A quick check found the Q8_0 projector slower than F16 on this CPU, so F16 was kept.
  - The smaller Q4_K_M packs appear only as byte figures.
- **The teacher (Qwen3-VL-8B) runs as Q4_K_M + F16 projector.** It runs alone, after the bake-off. Q8_0 (8.7 GB) was
  not attempted, for memory headroom; reviewer E estimates it would have needed ≈ 12.1 GB at the final settings, so it
  might have fit (post-review E2-8).
- **SmolVLM2-2.2B is given `--image-max-tokens 336`.** Each image becomes 2 × 2 tiles plus a global view, 419 tokens.
  - At its native 1,536 px, 1,417 tokens per image took about 100 s per image here, which would not have finished the
    matched run.
  - The cap is recorded with every result (`input-modes.md`).

## Container restarts (2026-10-08, 00:38 and ≈ 01:29 UTC)

The session's container was restarted twice, both times during Qwen3-VL-4B phase 2: at 00:38 after 322 of its 835
records, and at about 01:29 (the current boot) after 431. There was no later restart; the stage report's earlier
"three" was wrong (post-review E2-3).
- **Lost.** tmpfs (`/dev/shm`) was wiped; the work directory and every run file survived.
- **Weights re-fetched.** The pinned Qwen3-VL-4B GGUFs were downloaded again from the same revision, and both files
  matched the SHA-256 values recorded before the restart (`manifests/qwen3vl-4b.gguf.sha256`).
- **Run resumed.** The run continued from record 323 and then from record 432 (`bench.py` skips answered keys;
  `runs/resume.log`), under the same server settings and the same 13.36 GiB cgroup limit.
- **Caveats for the 4B run.** It spans server processes on two boots. The first request after each restart ran with
  an empty prompt cache, and per-token speed differed between processes (by about 30 %, reviewer E), which is why the
  latency fit over-estimates a standalone mode D. Its peak-RSS figure is the largest of the processes.

## Network and accounts

- Outbound HTTPS goes through the session's agent proxy. Public, unauthenticated huggingface.co downloads at pinned
  revisions were reachable.
- `google/gemma-3n-E2B-it` and `-E4B-it` are gated. Their `config.json` returned **401**.
- **No account, token or paid service was created or used, and no Hugging Face credential exists in the
  environment.** The platform sets its own session tokens, which nothing here used. No hosted inference was called.

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
  - The exception is InternVL3.5-2B, which ran from its converted GGUF on disk (`$W/gguf`, through the page cache).
  - A finished model's files were removed from `/dev/shm` before the next large run, so the next run had memory
    headroom (post-review E-3).
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
