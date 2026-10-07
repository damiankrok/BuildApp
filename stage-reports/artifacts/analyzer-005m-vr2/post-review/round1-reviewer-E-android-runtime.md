# 005M post-review, round 1: Reviewer E (Android deployment, storage and runtime)

Reviewed at HEAD `f7bf93f` (11 commits after base `47811e0`), 2026-10-07, 23:00–23:25 UTC. The Qwen3-VL-4B phase-2 run
was in progress throughout. Every command was read-only and run under `nice -n 19`. No model or server was started.

**Counts: P0 0 · P1 3 · P2 6.**

## Findings

### E-1 (P1). Per-mode latency is measured with a prompt cache that only the benchmark has, so mode D looks 2.4–4.1× cheaper than it is

**Evidence.**
- `bench.py:18-19,124` runs each question's modes A→E in a row with `cache_prompt: True`. D's first image is C's
  marked plan, so every D record reuses C's prefix.
  - In `p2-qwen3-vl-2b`: `cachedTokens` = 581 in **all 167 D records**, and cold D n = 0.
  - B also reuses the identical plan of an earlier question in 64 of 167 records.
- `runtime_matrix.py:91-98` and `score.py:149-153` report a mode-level "median wall" over all records. The interim
  tables therefore print Qwen3-VL-2B D = **12.4 s** against A = 11.6 s (`score-tmp/runtime-size-matrix.md`,
  `score-interim/tables.md`).
- A standalone D (C's cold prompt + D's increment + D's decode, per question; rerunnable from the run files) is
  2.4–4.1× higher:

| model | D "median wall" as reported | standalone D (median) | E cold (proxy) |
| --- | --- | --- | --- |
| qwen3-vl-2b (p2, n=163) | 12.7 s | **34.9 s** (p10 20.9, p90 41.0) | 33.3 s |
| qwen3-vl-4b (p1) | 29.0 s | **70.7 s** | 66.1 s |
| internvl3.5-2b (p1) | 14.8 s | **60.2 s** | 58.4 s |
| smolvlm2-2.2b (p1, capped) | 35.2 s | **65.5 s** | 61.4 s |

- A least-squares fit over the 557 cold Qwen3-VL-2B records (R² 0.977) gives **40.1 ms per image token** and **9.1 ms
  per text token** on this CPU. That predicts a standalone mode-D prompt of 32.8 s, which matches.
- `input-modes.md:86-87` says "D/E … about the same wall time as C, because the plan prefix is reused". This is wrong
  for both:
  - D ≈ 0.5 × C (cached);
  - E ≈ 1.3 × C and is **not** cached (145 of 167 E records are cold).
- `environment.md` (prompt-cache bullets) discloses the mechanism. The matrix's cold column for D, however, prints
  "nan s (n=0)", so no table gives a deployable D latency.

**Why it matters.** D is the leading mode. In a deployment that asks one D question per ROI, nothing precedes it in the
cache: the marked plan differs per ROI, so cross-question reuse is impossible. Any latency or utility statement, and the
deployability verdict, would start from a number 2.8× too low for Qwen3-VL-2B and 4.1× too low for InternVL3.5-2B.
The phase-1 ranking does not use latency (`score.py:169`), so selection is unaffected.

**Fix.**
- Add a "standalone" column per mode to `runtime_matrix.py` and `summarize.py`: cold records where they exist; for D,
  C-cold `promptMs` + D `promptMs` + D `predictedMs`. Alternatively, run 20–30 D items with `cache_prompt: false`.
- Label the current column "with A→E prompt-cache reuse (benchmark artefact)".
- Correct `input-modes.md:86-87`.

### E-2 (P1). "Peak RAM of a deployment ≈ pack bytes + peak anon RSS" overstates deployment RAM about 3×

**Evidence.** The formula is in `runtime_matrix.py:99-100`. For `p2-qwen3-vl-2b`, the `rss` fields read:
- `RssShmem` = 1.83 GB, exactly the Q8_0 LLM file mapped from tmpfs;
- `RssAnon` 2.02 GB after the first request, growing about 0.1 GB per request to **4.50 GB**;
- `VmHWM` 6.35 GB, which equals 4.50 + 1.83 + 0.02, so the "peak" read-out itself is correct.

The log shows the 2 GiB prompt cache full and evicting ("making room for prompt cache entry", from about 12 min in).
`RssAnon` therefore contains:
- the **F16 mmproj weights**, 0.82 GB. Clip loads them into anonymous buffers; they are not in `RssShmem`.
- an **8k-context KV cache**, about 0.94 GB. This assumes 28 layers × 8 KV heads × 128 × f16 = 112 KiB per token.
- **the 2 GiB prompt cache**;
- compute buffers, about 0.3 GB.

The footnote names the cache, but the formula adds pack + anon:
- it counts the mmproj twice;
- it keeps a cache that a one-shot question does not need;
- it keeps a context 8× larger than a 965-token prompt needs.

For the Qwen3-VL-2B smallest pack the formula gives 1.57 + 4.45 ≈ **6.0 GB**. A defensible estimate (stated
assumptions, not measured) is **≈ 2.1–2.3 GB** resident:
- LLM Q4_K_M 1.11 GB, mmap;
- mmproj Q8_0 0.45 GB;
- KV at 2k context 0.23 GB;
- compute buffers about 0.3 GB;
- no prompt cache.

**Why it matters.** 6 GB rules out most phones; about 2.2 GB fits an 8 GB phone. This number feeds the deployability
verdict directly.

**Fix.**
- Report anon RSS as "after the first request" (cache nearly empty) and as the peak, and say that the difference is
  the 2 GiB cache.
- Replace the formula with: LLM bytes (mmap) + mmproj bytes + KV(ctx) + compute.
- State the context used, or measure once with `-c 2048 --cache-ram 0`.

### E-3 (P1, time-sensitive). The memory cgroup limit is 14.35 GB, not 15.7 GiB, and InternVL phase 2 will run with ≈ 0.2 GB of headroom

**Evidence.**
- `llama-server` (pid 14980) is in memcg `/process_api/<uuid>/claude-code-bash`. That cgroup has:
  - `memory.limit_in_bytes` = **14,345,031,680** (13.36 GiB);
  - `max_usage` = the limit;
  - `failcnt` 884,694.
- `dmesg` records a memcg **OOM kill** at uptime 849 s (about 14:03 UTC): `llama-mtmd-cli`, anon 5.78 GB +
  shmem 1.79 GB. It is not mentioned in `environment.md`.
- `environment.md` (Hardware table) says "15.7 GiB … in one memory cgroup". `student-training.md:3` and
  `run_model.sh:8` say 16 GB.
- `/dev/shm/models` now holds `qwen3vl-2b` (2.5 GiB) **and** `qwen3vl-4b` (4.8 GiB); cgroup shmem = 7.77 GB.
  - `tools/chain_p2.sh` starts InternVL3.5-2B phase 2 right after 4B.
  - `tools/chain_teacher.sh` deletes the Qwen directories only **after** `P2-DONE`.
- InternVL p1 used anon up to 4.18 GB, and its Q8_0 LLM (2.17 GB) is mmapped from **disk** (`$W/gguf`).
- Predicted InternVL p2 footprint: 7.77 shmem + 4.18 anon + 2.17 hot file pages = 14.12 GB against 14.35 GB.
  - There is no swap.
  - Every agent's bash commands run in the same memcg.

**Why it matters.**
- With about 0.2 GB left, the kernel will evict InternVL's mapped weights. Each decode step then faults them back from
  disk, which inflates InternVL's phase-2 latencies.
- Any anonymous allocation by another process in the cgroup can trigger an OOM kill. The largest process, the server,
  is the likely victim. `bench.py` then dies on a connection error, and the chain moves on with a partial InternVL
  phase 2. `runtime_matrix.py:85` then silently falls back to the p1 file when fewer than 835 lines exist.

**Fix.**
- **Now** (coordinator decision): remove `/dev/shm/models/qwen3vl-2b`. Its phase 2 is complete and no later step
  uses it; the teacher chain's `rm -rf` simply no-ops. This frees about 2.65 GB.
- Do not edit the running `chain_p2.sh`: bash reads scripts incrementally.
- Correct the cgroup figure in the three documents and record the 14:03 OOM kill. It was a smoke check, not a benchmark
  process; the run files contain 0 HTTP-error records.
- Round-2 baseline: cgroup `total_pgmajfault` = 11,762 at 23:18 UTC.

### E-4 (P2, becomes P1 if the report gets it wrong). The "smallest pack" and the Play 1.5 GB limit need four qualifications

**Evidence and reasoning** (Qwen3-VL-2B: 1,107,409,952 + 445,053,216 = **1,552,463,168 B**, i.e. 1.552 GB or
1.446 GiB):

1. **Accuracy at that pack is unmeasured.** The bake-off ran Q8_0 LLM + F16 projector. `environment.md` says "the
   smaller Q4_K_M packs appear only as byte figures", which is correct. A BEST_DEPLOYABLE_SIZE of 1.55 GB must not
   carry the Q8_0 CONFIDENT_WRONG_RATE: Q4_K_M on a 1.7 B LLM and a Q8_0 ViT can move a tail metric.
2. **Libraries are not in an AI pack.** The matrix adds runtime libraries into the "smallest pack" for the 1.5 GB
   comparison. Those libraries are an x86-64 build; arm64 was not measured. On Android they go in the base module
   (500 MB limit).
3. **The 1.5 GB limit is on compressed download size, and "GB" is undefined.** Both points are confirmed on
   support.google.com/googleplay/android-developer/answer/9859372 (read 2026-10-07).
   - Under a 1.5 GiB reading, 1.55 GB already fits.
   - In any case the two GGUF files go naturally into **two** AI packs (1.11 GB and 0.45 GB), both under the limit,
     with a cumulative 1.55 GB under 4 GB.
   - "A pack above 1.5 GB has to be split" is true but not a blocker. For a single file above 1.5 GB (Qwen3-VL-2B
     Q8_0 at 1.83 GB, Qwen3-VL-4B Q4_K_M at 2.50 GB), llama.cpp loads `gguf-split` shards natively. This is untested
     here; say so.
4. **AI packs and llama.cpp.**
   - developer.android.com/google/play/on-device-ai names only LiteRT and MediaPipe.
   - Install-time AI packs "will be installed as an APK", so llama.cpp needs an uncompressed, aligned asset or a
     copy-out.
   - Fast-follow and on-demand packs land in internal storage, which llama.cpp can mmap.
   - Play's size page gives 30 GB cumulative for fast-follow/on-demand, while the AI-pack page says "4GB" cumulative
     app size. Quote both.

**Fix.** In `runtime_matrix.py` and the stage report:
- report model-file bytes and library bytes separately;
- state the compressed-size basis and the two-pack split;
- mark the 1.55 GB configuration "quality unmeasured; re-run the 167 × 5 items on it before any claim". Phase 1 alone
  is 160 records, about 45 min here.

### E-5 (P2). The weight gate checks names, extensions and size, not content. A small disguised binary passes both guards

**Evidence.** I reproduced this in a throw-away repository under the scratchpad (since deleted) with a copy of
`history_gate.sh`. One commit added:
- a 1 MiB **safetensors-structured** blob named `stage-reports/artifacts/analyzer-005m-vr2/runs/lora.jsonl`;
- the same blob as `.cache/source-bytes/deadbeef.bin`;
- `docs/adapter.pte` (ExecuTorch);
- `docs/student.dlc` (Qualcomm SNPE);
- `docs/qwen.tiktoken`;
- `docs/sentencepiece.bpe.model`;
- an LFS pointer.

**Only the LFS pointer was flagged.** The 005M test (`research-isolation.test.ts`, 005M block) would also pass the
`.jsonl` blob: the extension is allowed, it has no long base64 run, no 64-number array, and it is ≤ 2 MiB.

Other gaps:
- The gate and the test have drifted. The gate lacks `mlpackage`, `mf.gz`, `chat_template.(json|jinja)` and
  `model.safetensors.index.json`, all of which the test has.
- Neither lists `.pte .ptl .dlc .msgpack (Flax) .tiktoken *.model .mnn .engine .zip .gz .7z .xz`.
- The `.cache/source-bytes/` prefix exempts any file name.
- Extensionless HF-cache blobs (`blobs/<sha>`) pass if they are small.

The size caps (5 MiB anywhere, 2 MiB on stage paths) do stop any real weight and the planned LoRA:
`student_probe.py` uses r=16 on 7 projections, about 8.7 M params, 17–35 MB. A small adapter (r=4, two projections,
about 1–2 MB) would not be stopped.

**Fix.**
- Sniff content in both guards:
  - reject NUL bytes in stage "text" files;
  - reject the magics `GGUF`, `PK\x03\x04`, pickle `\x80\x0[2-5]`, `TFL3` at offset 4;
  - reject a safetensors header (8-byte LE length followed by `{"`).
- Add the missing extensions and one shared regex.
- Restrict the exemption to `^\.cache/source-bytes/[0-9a-f]{32}\.(bin|type)$` plus the magic check.
- Optionally use `realpath` instead of `abspath` in the `startswith(REPO)` guards.

### E-6 (P2). The published phone-figure table needs provenance labels; two rows could not be verified

Checked against huggingface.co/qualcomm/Qwen3-VL-2B-Instruct and the Gemma LiteRT-LM card.
- **Qwen3-VL-2B rows.**
  - The S25 rows ("Snapdragon 8 Elite For Galaxy", GENIEX_LLAMACPP, q4_0, 512 ctx) are **three**:
    - 47.60 tok/s, TTFT 0.351–1.404 s;
    - 40.99 tok/s, TTFT 0.177–0.709 s;
    - 36.11 tok/s, TTFT 0.055–0.219 s.
  - The HF card labels **none of them** CPU or NPU. The matrix calls the first "CPU" and the third "NPU", and omits
    the middle row.
  - The "prefill tok/s" values 365 and 2,356 are the stage's own derivation (512 / TTFT max), not published figures.
  - TTFT is defined by prompt length; nothing says an image is included.
  - aihub.qualcomm.com/mobile/models/qwen3_vl_2b_instruct currently renders "This model is currently not supported on
    any Mobile chipset".
- **Qwen3-VL-4B row** ("w4a16 (QAIRT) … ≈ 15.5 tok/s, ≈ 1,300 prefill, vision encoder 149 ms"): not found.
  - The HF mirror lists only GENIEX_LLAMACPP q4_0 rows: S25 at 512 ctx gives 21.0, 19.8 and 17.2 tok/s.
  - Its 4096-context rows show TTFT up to 94.7 s. That is direct evidence of the long-context prefill penalty the
    stage's floor ignores.
  - The AI Hub page is JavaScript-rendered and was not readable here.
- **Gemma 3n E2B** (S24 Ultra CPU 110.5/16.1, GPU 816.4/15.6): **verified**.
- **MediaPipe LLM Inference "maintenance-only" → LiteRT-LM**: **verified**. One wording note: "Pixel 8 and Samsung
  S23 or later" is said of the MediaPipe API, not LiteRT-LM (`gemma-matformer.md` §4).

**Fix.**
- Mark derived columns as derived.
- Quote all three S25 rows without CPU/NPU labels, or cite the page element that gives the labels.
- Save the read-out text of each source (with its timestamp) in `$W/manifests`.
- Add the measured split on this CPU so the reader sees what the "≈ 3 s floor" leaves out (see Deployability below).

### E-7 (P2). The interim matrix is stale, and the script has small presentation issues

- `score-tmp/runtime-size-matrix.md` shows runtime libraries of **19.0 MB**. The committed `runtime_matrix.py:59-60`
  yields **9.52 MB** on the same directory:
  - libllama 4.92 MB;
  - libmtmd 1.97 MB;
  - libggml-cpu 1.62 MB;
  - libggml-base 0.95 MB;
  - libggml 0.06 MB.
- 19.05 MB is exactly double. The interim was produced before the `islink` filter, counting each symlink's target
  again. **Regenerate.** The smallest-pack totals drop by 0.01 GB.
- "load (warm)" parses the mmproj-loaded line (3.3 s), not `llama_server: model loaded` (3.9 s).
- The docstring says the weights were in tmpfs. **InternVL3.5-2B ran from disk** (`$W/gguf`): `RssFile` 1.86–2.18 GB,
  `RssShmem` 0. `environment.md`'s "kept in `/dev/shm/models`" needs the same exception.
- "nan s (n=0)" should print "—, all cache-aided".
- The p2-file fallback (`< 835` lines) is silent. Print which file was used.

### E-8 (P2). The quantised-size inputs are uncommitted and partly unpinned

- `$W/manifests/quantised-sizes.json` is hand-made: no script writes it, and it is not in the repository. Qwen's
  Q4_K_M and mmproj Q8_0 bytes are in the committed manifest, and I verified them against the pinned GGUF snapshot
  `52d6c8ff…`.
- **SmolVLM2** ggml-org sizes: I verified today against `ggml-org/SmolVLM2-2.2B-Instruct-GGUF@1bc3c9f7…` (Q4_K_M
  1,112,602,656; mmproj Q8_0 592,523,200), but the revision is recorded nowhere.
- **InternVL** "ESTIMATE" (1.307 GB) could be a listing instead. `bartowski/OpenGVLab_InternVL3_5-2B-GGUF@09023986…`
  has Q4_K_M = 1,282,436,192. That is the RL'd sibling with identical tensor shapes: its Q8_0 matches the local file to
  within 3.6 kB. The ratio estimate is 1.9 % high.

**Fix.** Commit the JSON (it is text) with each repository and revision, and keep "ESTIMATE" only where no listing
exists (the InternVL mmproj Q8_0).

### E-9 (P2). Smaller documentation inaccuracies

- `environment.md` and `model-manifest.json`: "Q8_0 does not fit … beside the benchmark" reads as if the teacher runs
  concurrently with the bake-off. The chains are sequential (`chain_teacher.sh` waits for `P2-DONE`). Say "with its
  runtime memory inside the 14.35 GB cgroup".
- `student-training.md` route B: 1.107 + 0.445 = 1.552, which is "1.55 GB", not 1.56.
- The `history_gate.sh` guard is manual and not wired into CI (`.github` is frozen). The stage report should quote its
  output at the final HEAD.

## Deployability ingredients (estimates; assumptions stated; nothing measured on a phone)

**Measured on this x86 CPU** (Qwen3-VL-2B, Q8_0 + F16, 4 threads):
- 40.1 ms per image token and 9.1 ms per text token (about 110 tok/s text prefill);
- decode 9.2 tok/s;
- standalone mode D about **35 s**.

The vision encoder is about **73 %** of a mode-D prompt: (40.1 − 9.1) × 776 = 24 s of 33 s. The ≈ 3 s phone floor in
`runtime_matrix.py` leaves this term out.

**Plausible per-question mode-D latency** (965 prompt tokens of which 776 are image tokens, 17 output tokens):

| device class | assumption | Qwen3-VL-2B | InternVL3.5-2B / Qwen3-VL-4B |
| --- | --- | --- | --- |
| flagship CPU (S25 class, llama.cpp + libmtmd) | LLM prefill 365 tok/s at 512 ctx, up to 2× slower at ~1k ctx (the 4B 4096-ctx rows show 2.2–2.7×); ViT 2–4× faster than this x86; decode 47.6 tok/s | **≈ 9–17 s** (ViT 6–12 s + prefill 2.6–5 s + decode 0.4 s) | ≈ 1.7× / 2× that: ≈ 15–30 s / 18–35 s |
| mid-range CPU (A78/A55 class) | 3–5× slower than flagship | **≈ 30–80 s** | ≈ 50–150 s |
| vendor NPU (Qualcomm GenieX/QNN, not upstream libmtmd) | text prefill about 2,300 tok/s; ViT on NPU (149 ms quoted for 4B, input size unstated, unverified) | ≈ 1–3 s, Snapdragon only, with a vendor-specific export of any fine-tune | — |

- A plan with N ROI questions costs N times this. There is no cross-question cache, because the marker is drawn into
  the plan.
- Under sustained use, thermal throttling lengthens the times.
- Raising image tokens (llama.cpp warns that Qwen-VL "require[s] at minimum 1024 image tokens … on grounding tasks")
  would roughly double them.

**On "BEST_DEPLOYABLE_SIZE" for Qwen3-VL-2B:**
- **1.55 GB** (Q4_K_M + mmproj Q8_0) is a byte figure from the publisher's own GGUFs. It is size class 1–2 GB and
  deliverable as two AI packs. Its quality and latency are **unmeasured**.
- The measured configuration is **2.65 GB** (class 2–4 GB). Its 1.83 GB LLM file exceeds one pack and needs
  `gguf-split`.
- Estimated runtime RAM for the 1.55 GB pack: about **2.1–2.3 GB** (E-2), not about 6 GB.

## Checked and OK

- **History gate.**
  - `history_gate.sh` → `HISTORY_GATE: PASS`, 11 commits (`47811e0..f7bf93f`); no merge commits.
  - 41 blobs added, 1.49 MiB raw, 0.31 MiB on disk. The largest is `runs/p2-qwen3-vl-2b.jsonl` at 569 KB.
  - No blob contains NUL bytes or GGUF/ZIP/TFL magics.
  - `count-objects`: size-pack 49.8 MiB. Projected 005M total after the remaining runs: about 3 MB.
- **Isolation test (emulated, not run).** The 005M checks pass on the current tree: no weight extension, no hub bundle,
  36 stage files all text, all ≤ 2 MiB, no base64 or number-array runs, no `.gitattributes` LFS, no `.lfsconfig`.
- **Production freeze.** `freeze_check.sh start.txt` → `FREEZE: IDENTICAL`.
  - `git diff --stat 47811e0 HEAD -- apps packages package.json package-lock.json .github` is empty.
  - All 36 changed files are under `research/analyzer-005m`, `stage-reports/artifacts` and
    `tests/architecture/research-isolation.test.ts`.
  - `apps/android` (Gradle, assets, JNI `cpp`) is untouched. `git grep` finds no 005M model or runtime names in
    `apps/` or `packages/`.
- **Output guards.**
  - `hfget.py`, `compose5.py`, `bands_prep.py` and `vrgen2.py` refuse output paths in the repository.
  - `student_probe.py` writes `adapterSaved: false` and saves no adapter.
  - `run_model.sh` reads weights only from `/dev/shm` or `$W`.
- **Byte sources.**
  - Every as-run GGUF size and hash is in `model-manifest.json`.
  - Qwen Q4_K_M and mmproj Q8_0 sizes match the pinned HF snapshot.
  - BF16 sizes equal params × 2 (2.128 B, 4.438 B and 2.348 B params).
  - SmolVLM2-2.2B is F32 on the hub (2,246,784,880 params), so halving to 4.49 GB is correct and labelled.
  - The InternVL estimates are labelled "ESTIMATE".
- **Wall time.**
  - `bench.py` measures one HTTP round trip: PNG decode, ViT, prefill, decode. Base64 encoding and the tokenizer split
    are excluded; server overhead outside prompt and predict is 60–180 ms.
  - It is stable across server processes: cold medians of the p1-copied versus new Qwen3-VL-2B records differ by
    ≤ 3.5 % in A, C and E. B, where the copied 20 cold records are slower, differs by about 10 %.
  - There are 0 HTTP errors and 0 parse errors in all 1,663 run-file lines as of about 23:10 UTC. That is 1,343
    distinct records, because each p2 file starts with a copy of its model's 160 p1 records.
- **Peak anon RSS.** It is read correctly (max of post-request `RssAnon` = `VmHWM` − shmem − file), and the footnote
  says it includes the 2 GiB prompt cache. Only the deployment formula is wrong (E-2).
- **Environment facts.**
  - `/dev/shm` is charged to the memcg (shmem 7.77 GB in `memory.stat`).
  - The `--cache-ram` default is 8192 MiB at `988190680d5a` (`common/common.h:638`).
  - The CPU flags (AVX-512 F/DQ/CD/BW/VL + VNNI, no AMX or BF16) and the 4 vCPUs match `environment.md`.
- **Mobile claims.**
  - The llama.cpp Android sample at the pinned commit has no `mtmd` code (text-only), as `student-training.md` says.
  - Play limits are verified: 1.5 GB per asset or AI pack, 4 GB install-time cumulative, AI packs in beta.
  - The Gemma `.litertlm` above 1.5 GB per pack (`gemma-matformer.md`) is consistent with the AI-pack page.
  - No phone latency is claimed as measured anywhere. The "≈ 2.6 s + 0.4 s" is explicitly an "optimistic floor".

## Round-2 checks (when the remaining runs land)

1. **InternVL phase 2.**
   - It must reach 835 lines with no `EXIT-P2 … ≠ 0`.
   - Compare its new cold medians with p1: C 47.7 s, E 58.4 s, A 13.3 s. More than +15 % suggests page-cache thrash.
   - Compare cgroup `total_pgmajfault` against 11,762.
   - Check `dmesg` for a new memcg OOM.
2. **Regenerate `runtime-size-matrix.md`** with the committed script.
   - Libraries should be 9.5 MB.
   - Use the p2 files for all three models and confirm which file each row used.
   - Check that the E-1 standalone column and the E-2 RAM correction are present.
3. **Stage report and `recommendation.md`.**
   - No D latency taken from the cache-aided median.
   - No phone latency that omits the ViT term.
   - BEST_DEPLOYABLE_SIZE states that its quality is unmeasured, or a Q4_K_M phase-1 re-run backs it.
   - The Play arithmetic uses model-file bytes, the compressed-size basis and the two-pack split.
4. **Teacher.** It ran Q4_K_M + F16 on CPU, not Q8_0. Its latency and RSS must not enter the student-deployability
   matrix, and its quantisation must be stated next to its answers.
5. **Student probe.**
   - `probe.json` has `adapterSaved: false`.
   - No `adapter_*` or `*.safetensors` exists under the repository (`git status --ignored`).
   - The extrapolated GPU hours are labelled as estimates.
6. **Final gates.**
   - At the final HEAD, rerun `history_gate.sh`, `freeze_check.sh start.txt` and the vitest 005M block.
   - Recheck the largest blobs: each committed run file stays < 2 MiB; p2 runs are about 570 KB each.
   - Confirm the post-review `.md` files are the only new stage-path files besides the planned reports.
