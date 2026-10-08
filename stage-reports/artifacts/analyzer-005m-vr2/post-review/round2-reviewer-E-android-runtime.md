# 005M post-review, round 2: Reviewer E (Android deployment, storage and runtime)

Reviewed at HEAD `a7e1ece` (26 commits after base `47811e0`) on 2026-10-08, 14:30–15:00 UTC, with the CPU idle.
I ran `history_gate.sh`, `freeze_check.sh` and the isolation test. I regenerated the runtime matrix into my scratchpad
and probed the guards in a throw-away clone, since deleted. The only file I wrote in the repository is this report.

**Counts: P0 0 · P1 0 · P2 9** (new). Round-1 status: 7 RESOLVED, 2 PARTIAL (E-1, E-5), 0 NOT RESOLVED.

## 1. Round-1 findings: verified against the artifacts

| id | status | what I checked |
| --- | --- | --- |
| E-1 cache-aided D latency | **PARTIAL** | **Fixed:** `runtime-size-matrix.md` prints both columns, and `input-modes.md:111-116` is corrected. I regenerated the matrix with the committed script: byte-identical. **Left:** `bakeoff-tables.md` still has an unlabelled "median wall" column. It shows Qwen3-VL-2B D = **12.7 s** (l.186), with no "cache-aided" note anywhere in that file. `summarize.py` was not changed. The standalone-D estimate also has a bias of its own (E-R2-1) |
| E-2 deployment RAM | **RESOLVED** | **Formula:** "pack + peak anon" is gone. The matrix gives anon RSS after the first request and at its peak, plus RAM estimated from parts. **Arithmetic:** I re-derived all eight figures from bytes + KV(2,048) + 0.3 GB. **KV shapes:** 112 / 144 / 112 / 192 KiB per token, correct. **Context:** the 2,048-token context covers every prompt in the runs (max prompt + completion is 1,039 for Qwen D and 1,829 for InternVL E). One caveat on the mapped-file assumption is new: E-R2-2 |
| E-3 cgroup headroom | **RESOLVED** | **Limit and OOM:** `environment.md` states the limit and the 14:03 OOM. **InternVL phase 2:** it completed: 835 lines, 0 errors, 0 duplicate keys. Its cold medians match phase 1: A 14.5 / 13.4 s, C 47.4 / 47.7 s, E 57.0 / 58.4 s. Major faults stayed low: cgroup `total_pgmajfault` was 9,643 for the whole post-restart boot. The kernel log has no OOM during InternVL. **The round-1 baseline of 11,762 cannot be compared** because the counters reset at the restarts. **Stale text:** `environment.md` is out of date on the later OOMs and restarts (E-R2-3) |
| E-4 smallest pack and Play | **RESOLVED** in the matrix | **Matrix:** "quality unmeasured" on every smallest figure. Model files and libraries are reported apart (9.52 MB of libraries, in the APK). It states the compressed-download basis, the two-pack split and that `gguf-split` is untested. **Play page:** I re-read support.google.com/…/9859372 today. It gives 1.5 GB per asset pack, 4 GB for install-time content, 30 GB for fast-follow and on-demand, 500 MB for the base module, all as compressed download size. **Stage report:** it over-generalises the fit (E-R2-4) |
| E-5 weight guards | **PARTIAL** | **What I ran:** a throw-away clone with seven planted files. **What is caught:** a safetensors-structured blob named `runs/lora.jsonl` fails `history_gate.sh` (WEIGHT MAGIC BYTES) and two isolation tests (magic bytes, NUL byte). `chat_template.jinja` and `model.safetensors.index.json` fail the test. **What still passes both guards:** see E-R2-5. **Unsupported claim:** the "disguised-weight negative test" the report claims does not exist in the committed file |
| E-6 phone table | **RESOLVED** | **Cards:** I fetched both Qualcomm cards at the revisions pinned in `runtime_matrix.py`: `qualcomm/Qwen3-VL-2B-Instruct@cbab248c` and `-4B@dcc61618`. Every quoted row matches: 2B S25 47.6 / 41.0 / 36.1 tok/s with TTFT 0.35–1.40 / 0.18–0.71 / 0.05–0.22 s; 4B 512, 4096 and QAIRT rows. **Derived prefill:** recomputed (365 / 722 / 2,340; 115 / 250 / 1,040; 43 / 113 / 673; 1,490 / 1,330). **Vision encoder:** its rows really are empty. The removed 4B 149 ms figure is gone. A small balance point remains: E-R2-6 |
| E-7 matrix hygiene | **RESOLVED** | libraries 9.52 MB; load read from the "model loaded" line (3.9 s); InternVL "disk (page cache)"; "—, all cache-aided". The p1 fallback is still silent in code, but the fit table now names each run file and the record count shows 835 / 160 |
| E-8 quantised sizes | **RESOLVED** | **Committed with pins.** `quantised-sizes.json` is committed with repository@revision. **Re-verified today:** all seven listed byte counts match the HF tree API at those revisions: Qwen 2B, Qwen 4B, ggml-org SmolVLM2 and bartowski InternVL. The F16 mmproj difference is 320 B, as stated. **One wrong statement:** E-R2-7 |
| E-9 small doc errors | **RESOLVED** | 1.55 GB (decimal) in `student-training.md`; the teacher wording is now "after the bake-off". The teacher's memory reason itself is unsupported (E-R2-8) |

## 2. Round-2 checks from my round-1 list

1. **InternVL phase 2.**
   - **Completeness:** 835 lines, 0 errors.
   - **No thrash:** cold C/E medians are within 3 % of phase 1, A is +8 %, and major faults are low. The kernel log shows no OOM during the run.
   - **Load time:** 297.1 s = 2.8 GB read cold from disk at about 9.4 MB/s. It is a storage figure and is labelled so.
2. **Matrix regenerated.**
   - `runtime_matrix.py` with the committed inputs reproduces `runtime-size-matrix.md` **byte for byte**.
   - Libraries are 9.52 MB, and p2 files were used for all three phase-2 models.
   - The standalone and RAM-from-parts sections are present.
3. **Stage report and recommendation.**
   - The D latency is the standalone 34.8 s, not 12.7 s.
   - Every 1.55 GB mention carries "quality unmeasured".
   - The Play arithmetic in the matrix uses model-file bytes, the compressed basis and the two-pack split.
   - Remaining issues: the "≈ 90 % vision tower", "exclude the image encoder", "the packs fit … as two files" and the 9–80 s citation (E-R2-1, E-R2-4, E-R2-6, E-R2-9).
4. **Teacher.**
   - Q4_K_M + F16 is stated beside every teacher table (`teacher-feasibility.md`, `teacher-summary.json`).
   - Its latency and RSS appear only in `teacher-feasibility.md`, and D is labelled "cache-aided". None of it enters the runtime matrix.
5. **Student probe.**
   - `student-probe.json` → `"adapterSaved": false`.
   - `git status --ignored` is clean of `adapter_*` and `*.safetensors`.
   - The ≈ 474 / 1,420 h figures are labelled estimates.
6. **Final gates** (run at `a7e1ece`).
   - `history_gate.sh` → **HISTORY_GATE: PASS** (26 commits).
   - `freeze_check.sh /home/user/work005m/freeze/start.txt` → **FREEZE: IDENTICAL**.
     - I also re-derived `start.txt` from `git ls-tree -r 47811e0` on my own. It matches, so the baseline really is the base commit.
     - `git diff --name-only 47811e0 HEAD` outside `research/analyzer-005m/` and `stage-reports/` lists only `PROJECT_STATUS.md` and `tests/architecture/research-isolation.test.ts`.
   - `vitest run tests/architecture/research-isolation.test.ts` → **22 / 22 passed**.
   - The largest stage blobs are `matched-bakeoff.json` at 1.58 MB (below the 2 MiB cap) and the p2 run files at 569–579 KB. `size-pack` is 49.8 MiB.
   - **Rerun all three after the round-2 reports and `resolution-round2.md` are committed.**

## 3. New findings

### E-R2-1 (P2). Standalone mode D is estimated above standalone E, which contains D's whole input. Qwen3-VL-4B is 17 % high, and "the vision tower is ≈ 90 %" is wrong

**Evidence.**
- **E contains D.** E sends the same two images as D, with the overlay drawn into the plan: the same image-token count (776 for Qwen). Its text is longer by a median of **30 tokens**.
- **So standalone D cannot exceed standalone E** by more than noise. Yet the D estimate from the fit exceeds the measured E-cold median for every model:

| model | D, fit (matrix and report) | E cold, measured (same 145 questions) | gap |
| --- | --- | --- | --- |
| qwen3-vl-2b | 34.8 s | 33.3 s | +5 % |
| qwen3-vl-4b | **57.4 s** | **49.1 s** | **+17 %** |
| internvl3.5-2b | 59.2 s | 57.0 s | +4 % |
| smolvlm2-2.2b | 63.1 s | 61.4 s | +3 % |

- **The cause for 4B: a pooled fit across four server processes that ran at different speeds** (R² 0.868). The 4B run file is the phase-1 copy (records 1–160) plus three phase-2 processes: 161–322, 323–431 and 432–835.

| 4B records | ms per prompt token, C mode | fit a / b | R² |
| --- | --- | --- | --- |
| 1–160 (p1) | 60 | 72.3 / 39.4 | 0.969 |
| 161–322 | 58 | 65.2 / 34.6 | 0.921 |
| 323–431 | **40** | 45.9 / 24.0 | 0.979 |
| 432–835 | 48 | 58.5 / 33.9 | 0.993 |

  The pooled fit's b = 35.7 ms per text token is 3.9× Qwen3-VL-2B's 9.1 ms, for a model about 2.4× larger.

  Rerun: `seg.py` / `fit.py` logic: `fit()` from `runtime_matrix.py` applied to `p2-qwen3-vl-4b.jsonl` slices `[0:160]`,
  `[160:322]`, `[322:431]`, `[431:835]`.
- **The vision-tower share.**
  - **The report's claim:** §5 says "**The vision tower is ≈ 90 % of a mode-D prompt.**"
  - **What the matrix column measures instead:** the share of *image tokens* (87–96 %). That share includes the LLM's own prefill of those tokens.
  - **The share that is the tower's alone:** per question it is (a − b) × image tokens ÷ fitted prompt time. The medians are **72 %** (Qwen3-VL-2B), **34 %** (Qwen3-VL-4B), **43 %** (InternVL3.5-2B) and **77 %** (SmolVLM2-2.2B).
  - **A wording slip:** the matrix sentence "the vision tower dominates (fit below)" points down, but the fit is above it.

**Why it matters.** Not for the recommendation: 2B's ≈ 35 s is within 5 %. But the 4B and InternVL rows in §5 overstate
cost, and the "≈ 90 % vision tower" line is the premise of the phone discussion. On 4B and InternVL the LLM prefill
is the larger part.

**Fix.**
- Standalone D = the E-cold median minus E's extra text tokens × b: 2B ≈ 33.0, 4B ≈ 48.0, InternVL ≈ 56.4 and SmolVLM ≈ 61.0 s. Alternatively, fit 4B per server process.
- Say "image tokens ≈ 90 % of prompt time; the vision tower alone 34–77 %".
- Label `bakeoff-tables.md`'s "median wall" as "with A→E cache reuse" in `summarize.py`. This is the remainder of E-1.
- State in `environment.md` that 4B per-token speed varied by about 30 % between server processes.

### E-R2-2 (P2). On a phone, llama.cpp at the pinned commit copies Q4_K / Q6_K / Q8_0 weights into anonymous memory. "LLM file (memory-mapped)" understates resident and non-reclaimable RAM

**Evidence.**
- **Repacking on arm64.** `ggml/src/ggml-cpu/repack.cpp` at `988190680d5a` (≈ l.5005–5115) repacks into `CPU_REPACK` buffers on any NEON core with dotprod or i8mm, which is every current phone:
  - `GGML_TYPE_Q4_K` → q4_K_8x8 or 8x4;
  - Q5_K and Q6_K → 8x8 or 8x4;
  - **Q8_0** → q8_0_4x8 or 4x4.

  It is on by default (`--no-repack` disables it, `common/arg.cpp:2425`).
- **Repacking on x86.** Q4_K is repacked; Q8_0 is not. That is why the bake-off's Q8_0 runs show no LLM bytes in anon: Qwen3-VL-2B anon after the first request is 2.02 GB = mmproj 0.82 + KV(8k) 0.94 + 0.26.
- **The stage's only Q4_K_M measurement agrees.** The teacher (Qwen3-VL-8B, `-c 4096 --cache-ram 0`, no prompt cache) has `RssAnon` **5.57–5.72 GB** (`teacher-p1-qwen3-vl-8b.jsonl`, records 28–120).
  - The parts model (mmproj 1.16 + KV 0.60 + 0.3 compute) predicts about 2.1 GB.
  - The ~3.5 GB excess is about the Q4_K share of the 5.03 GB file.
  - Meanwhile the whole file stayed mapped (`RssShmem` 4.99 GB). Total resident was 10.6 GB, against 7.1 GB from parts.

**Why it matters.**
- **Steady state.** On a phone the total stays close to the matrix's ≈ 2.1 GB for Qwen3-VL-2B's smallest pack. But it is anonymous memory, which the low-memory killer charges and the kernel cannot drop.
- **During load.** The file's page cache and the repacked copy coexist: up to about 3.2 GB transiently.
- **The 0.3 GB compute buffer.** It is an assumption that no measurement in the stage validates.

**Fix.**
- In the matrix, change "LLM file (memory-mapped)" to "LLM weights (repacked into anonymous memory by default on arm64; memory-mapped only with `--no-repack`)".
- Add "transient load peak ≈ + LLM file size".
- When anyone measures `-c 2048 --cache-ram 0`, record both with and without `--no-repack`.

### E-R2-3 (P2). `environment.md` contradicts the runs: two later OOM kills and at least two restarts, not one

**Evidence.**
- **Two later OOM kills.** Current boot: `uptime` 13:03 at 14:32 UTC, so the boot was at about 01:29 UTC. The kernel log has two memcg OOM kills:

| time (UTC) | uptime | process | anon | shmem |
| --- | --- | --- | --- | --- |
| 10:46:25 | 33,443 s | `llama-server` pid 8480, the **teacher**, at 8k context with the 2 GiB cache | 7,888,648 kB | 4,876,424 kB |
| 10:48:34 | 33,572 s | `python` pid 8956, the **student probe** at 2,048 px | 11,971,868 kB | 314,416 kB |

  `runs/resume.log` agrees: "teacher settings -> -c 4096 --cache-ram 0 after an OOM kill at 27 records" and "probe exit 137".
  `teacher-feasibility.md:21` and `student-training.md:97` mention them.
- **But `environment.md` still says** "The cgroup did kill one process" and "**No benchmark server was killed**". The teacher server was.
- **Restarts.**
  - `environment.md` says the container "was restarted once" (00:38, at 322 records) and that the 4B run "spans two server processes".
  - `runs/chain_p2.log` gives `RESUME qwen3-vl-4b at 322 records 00:45`. `runs/resume.log` gives `01:31:52 launch` / `resume qwen3-vl-4b at 431`, and the boot was at about 01:29. That is a **second restart at 431 records**.
  - Commit `e4ede97` says "resumed across two container restarts". The stage report §1 says "**Three container restarts**".
- **A lost server log.** The 323–431 segment's server log was overwritten: `run_model.sh` writes `> …server.log`, and only the pre-00:38 log was saved by hand.
- **The cgroup limit.** In the current boot it is 14,345,019,392 B, 12 KiB less than the documented 14,345,031,680. It is still 13.36 GiB; immaterial.

**Fix.**
- Rewrite the restart section: 00:38 (322) and ≈ 01:29 (431). Reconcile with the report's "three", or name the third.
- Say the 4B run spans three phase-2 server processes, and that the 323–431 server log is lost.
- Add the two 10:46 / 10:48 OOM kills.
- Delete "No benchmark server was killed".

### E-R2-4 (P2). The report's "The packs fit Play's 1.5 GB AI-pack limit as two files" holds for three of the four smallest packs, not for Qwen3-VL-4B, and for none of the packs as run

**Evidence.**
- **Smallest packs.** Qwen3-VL-4B's smallest LLM file is **2.497 GB** (`quantised-sizes.json`). A Q4_K_M GGUF barely compresses, so it is over 1.5 GB as one pack.
- **Packs as run.** Every Q8_0 LLM file, the configuration whose accuracy was measured, is over 1.5 GB: 1.83, 4.28, 2.17 and 1.93 GB.
- **The matrix itself is correct.** It says `gguf-split` would be needed and is untested.

**Fix.** "Qwen3-VL-2B, InternVL3.5-2B and SmolVLM2-2.2B at Q4_K_M + Q8_0 vision fit as two AI packs. Qwen3-VL-4B at
Q4_K_M, and every configuration as run, needs `gguf-split` (untested)."

### E-R2-5 (P2). Remaining gaps in the weight guards (the rest of E-5)

**Evidence.** These were planted in a throw-away clone, committed, then checked by both guards; the clone is deleted. Each of the following **passed both**:
- `.cache/source-bytes/<32 hex>.bin` = `%PDF` followed by 1 MiB of random bytes. `publisherBytes()` accepts any file that starts with `%PDF` (or a JPEG, PNG, GIF or WEBP header).
- `docs/x/adapter.dat`, 1 MiB of raw headerless "fp16". The NUL and binary checks apply only to stage paths. The test has no size cap outside them; the gate caps at 5 MiB.
- `student.ptl` (TorchScript Lite), `flax_model.msgpack` and `weights.7z`. None of these extensions is in either list.

Also:
- `history_gate.sh` still lacks `chat_template.(json|jinja)` and `model.safetensors.index.json`, which the test has.
- The stage report's header says the isolation test has "22 checks, **including a disguised-weight negative test**". No such test is in `tests/architecture/research-isolation.test.ts`: there is no `it()` that feeds a synthetic buffer to `weightMagic`. The 22 are the file's whole `it()` count (005J, 005K, 005L, §42 and 005M).

**Why it matters.** These are residual, low-likelihood paths; the size caps still stop any real weight. But the report claims a test that does not
exist.

**Fix.**
- Add a self-test, `it('the detectors catch disguised weights')`, over in-memory buffers: a safetensors header, GGUF, a pickle, a zip with `data.pkl`.
- Require `publisherBytes` files to decode as their declared image or PDF format, or pin them by hash.
- Add `ptl|msgpack|zip|gz|7z|xz` and the two bundle names to the gate.
- Or delete "including a disguised-weight negative test" from the report.

### E-R2-6 (P2). The phone paragraph claims more than the cards say, and quotes the long-context penalty selectively

**Evidence.**
- **"Exclude the image encoder."** Report §5: "The only published figures are Qualcomm's Qwen3-VL-2B rows at a 512-token context. **They exclude the image encoder**."
  - The cards do not say whether an image is in the prompt. The matrix itself correctly says "the cards do not say that an image was included".
  - They are also not the only figures: the matrix quotes the 4B rows and Gemma rows.
- **"The long-prompt penalty."** The matrix's "4096-context rows show the long-prompt penalty" is true for GENIEX_LLAMACPP: 94.7 s for 4B on the S25.
  - The same card's GENIEX_QAIRT 4B rows show **no** such penalty: S25 2048 ctx TTFT 0.10–1.56 s, 4096 ctx 0.10–3.14 s (`qualcomm/Qwen3-VL-4B-Instruct@dcc61618` README l.135-136).
  - So the penalty belongs to the runtime, not to the model.

**Fix.**
- "They do not say whether an image is included."
- Add the QAIRT 2048 and 4096 rows, and say that the penalty is llama.cpp-specific on that card.

### E-R2-7 (P2). A Q8_0 mmproj listing for InternVL3.5-2B does exist

**Evidence.**
- **The listing.** `mradermacher/InternVL3_5-2B-GGUF@f39c95772b3c…` (created 2025-09-01) lists `InternVL3_5-2B.mmproj-Q8_0.gguf` at **342,398,560 B**. Its f16 is 636,106,336 B, within 128 B of ours.
- **The committed claim.** `quantised-sizes.json` says "no Q8_0 listing exists" and uses an ESTIMATE of 345,534,522 B.
  - That is 0.9 % high.
  - It is also not exactly "× 0.543": the stated ratio gives 345.4 MB and the exact ratio gives 345.50 MB.
- **Smallest InternVL pack.** 1.628 → **1.625 GB**.

**Fix.** Use the listing as REFERENCE with its revision, and drop the last ESTIMATE.

### E-R2-8 (P2). "The teacher's Q8_0 plus runtime memory would not fit the cgroup" is not supported by the stage's own memory figures

**Evidence.**
- **Where it is claimed:** `environment.md` and `model-manifest.json:391`.
- **Q8_0 is not repacked on x86** (E-R2-2). So anon memory holds the mmproj, the KV cache and compute buffers, as it did for the Q8_0 bake-off.
- **Estimate at the settings the teacher finally used** (`-c 4096 --cache-ram 0`):

| part | GB |
| --- | --- |
| tmpfs files: Q8_0 8.71 + mmproj F16 1.16 | 9.87 |
| anon: mmproj 1.16 + KV 4k 0.60 + 0.3–0.5 compute | ≈ 2.1–2.3 |
| **total** | **≈ 12.0–12.2** |

  That is against **14.35 GB**. The Q4_K_M teacher actually used 10.6 GB resident at those settings, because repacking doubled its LLM bytes.
- **What does not fit** is the bake-off's 8k context + 2 GiB cache (≈ 14.6 GB). Even the Q4_K_M teacher was OOM-killed under those settings.

**Why it matters.**
- **A weaker reason:** the teacher's quantisation was chosen for a reason the numbers do not support.
- **A caveat on "the only teacher that could run here"** (`recommendation.md`).
- **The teacher verdict is not overturned.** Q4_K_M versus Q8_0 is unlikely to explain one answer for 20 of 21 pairs.

**Fix.** Say "Q8_0 was estimated at ≈ 12.1 GB of 14.35 GB at `-c 4096 --cache-ram 0` and was not tried; Q4_K_M was used
for disk and time". Or run Q8_0 on the 42 TRAIN items as a check on the quantisation confound.

### E-R2-9 (P2). Small provenance and number slips

- **The 9–80 s phone range.** `recommendation.md` says "On a phone it would plausibly be 9–80 s (`runtime-size-matrix.md`)". The matrix contains no such estimate.
  - The range is my round-1 estimate: flagship 9–17 s, mid-range 30–80 s. Its assumptions are a ViT 2–4× faster than this x86 CPU, and prefill at the card's 365 tok/s, slowed up to 2× at about 1,000 tokens.
  - Fix: cite `post-review/round1-reviewer-E-android-runtime.md`, or copy the estimate with its assumptions into the matrix.
  - Note also that 9–80 s merges two device classes.
- **SmolVLM2's smallest pack.** Report §5 gives 1.70 GB. The matrix gives 1.705 (1,705,125,856 B), which rounds to **1.71 GB**.
- **Student-probe headroom.** `student-training.md`: "peak RSS 13.1 GB: just inside the 13.36 GiB cgroup" mixes units. 13.09 GB is 12.19 GiB, against a limit of 14.35 GB / 13.36 GiB, so the headroom is 1.26 GB (about 9 %).
- **Disk space.** The root filesystem had **408 MB free** (99 % used) at 14:45 UTC. My scratch clone briefly filled it; I deleted the clone at once.
  - The final commits, CI checkout or vitest caches can fail with ENOSPC.
  - The largest reclaimable stage-owned item is `$W/gguf` (2.7 GB of converted GGUFs). Deleting it is a coordinator decision.

## 4. Numbers in my area checked and found correct

- **§5 table.**
  - Files as run: 2.65 / 5.12 / 2.80 / 2.80 GB.
  - Smallest files: 1.55 / 2.95 / 1.63 GB (SmolVLM2: see E-R2-9).
  - Deployment RAM: 2.1 / 3.6 / 2.2 / 2.4 GB.
  - Qwen3-VL-2B standalone D 34.8 s. My independent per-question C-cold + D-increment method gives 34.9 s; the E-cold bound gives 33.3 s.
- **Fit coefficients.** "35–60 ms per image token, 9–36 per text token, R² 0.87–0.98" matches the three phase-2 fits.
- **Teacher.**
  - Bytes: 5,027,784,800 and 1,159,029,824 match the HF tree at `f982a075`.
  - "Killed at 12.9 GB resident" is the last record's `VmRSS`, 12.90 GB.
  - Medians 28.6 / 60.7 / 58.1 / 30.7 (D, cache-aided) / 75.0 s, peak anon 5.7 GB (5.72).
- **Every as-run GGUF** in `model-manifest.json` matches the local files or the HF listings.
- **Run files.**
  - The four p1 files have 160 lines each, the three p2 files 835 each, and the teacher files 120 and 42.
  - 0 HTTP or parse errors and 0 duplicate keys in every file.
  - The committed p2 files are byte-identical to the work directory's.
- **`recommendation.md` deployability line** (≈ 1.55 GB, quality unmeasured; ≈ 2.1 GB RAM estimated; ≈ 35 s on this CPU): correct. The repack caveat in E-R2-2 applies to the RAM figure.

## 5. Does the recommendation follow from the runtime evidence?

**Yes, from my side.** On this CPU a standalone mode-D question takes about 33–35 s for Qwen3-VL-2B and 48–61 s for the
others. Nothing measured here argues for ADOPT_LOCAL_VLM_PILOT.

There is no phone measurement, and none is claimed. The smallest deliverable configuration (1.55 GB, about 2.1 GB of
RAM) has unmeasured quality. A plan with N regions of interest costs N such calls with no shared cache, because the
marker is drawn into the plan.

RETURN_TO_DETERMINISTIC_BODY_RELATION carries no deployment cost and no deployment risk. None of the P2s above changes
a headline number in a way that would favour another enum.
