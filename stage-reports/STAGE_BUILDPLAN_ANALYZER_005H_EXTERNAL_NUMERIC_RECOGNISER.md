# STAGE BUILDPLAN-ANALYZER-005H — external numeric recogniser ensemble, arm64 device parity, blind round 7

| verdict | result |
| --- | --- |
| EXTERNAL NUMERIC RECOGNISER INTEGRATION | **PASS**. PaddleOCR `PP-OCRv6_tiny_rec` (official ONNX, sha256 `9ef676d6…`, id `ocr.ppocrv6-tiny-rec@9ef676d6`) runs on ONNX Runtime Web 1.30.0 (WebAssembly, one thread, sha256 `3398c10d…`) in a worker per plan. It reads every latticed label a second time from the same pixels, beside the custom reader, which stays. There is no fallback: a recogniser failure ends the run as `EXTERNAL_RECOGNISER_FAILED`, typed. No new `.so`, no Gradle ML dependency, no runtime network (§B–§D, §J) |
| OCR ENSEMBLE NON-CIRCULARITY | **PASS**. The recogniser sees `{ key, gray, capPx }` only, cut before the frame's metric solve, keyed opaquely (`c0…`). `source-metrics` imports no runtime, and the reconstruction, geometry, model and source-CV/vision packages reach no recogniser. The architecture test enforces all of this. The P2 rule never lets a reading win for being external: a disagreement with CLEAR/SUPPORTED is AMBIGUOUS with both values, and a different digit count never contests a scale. On the 4602 development lattice records, the custom reader's output is byte-identical OFF and ON (§D, §G) |
| NUMERIC TARGET LABELS | **PARTIAL**. `tunbergiach` `1173` is now read (LEADS over `1171`). `modrzewnicy` `1950` and `pod-milorzebem` `648` are now contested with the right value as a candidate, but both still refuse METRIC_RESOLUTION_INCONCLUSIVE: no wrong building, and not fixed. `modrzewnicy` `2590` is read right by the model, at mean character p 0.8955 < 0.90, so it is NOT_CORROBORATING (the bound is the brief's, unchanged). `dabecjach` `1580`/`850` AGREE; the house still fails on its boundary (§G) |
| NODE PARITY | **PASS**. The OCR self-test on Node 22, Node 18 and Node 18 without ICU gives the same corpus and output hashes (`734300d2…` / `396c9f54…`, 92 of 96). The fixture analyses are hash-identical across all three; CI repeats both (§H) |
| X86 EMULATOR PARITY | **PASS**. CI run 157 runs the APK on an x86_64 emulator: self-test MATCH. Fixture analysis equals the desktop. Live Marcówki equals the desktop on every hash (metric evidence `9261b283…`, model `6152770f…`); the second house completes. Cancel takes 0.5 s / 1.0 s (§H) |
| ARM64 DEVICE PARITY | **PENDING**. No physical arm64 phone was reachable from this environment. Supplementary only: the APK's bundle on arm64 Node 18 under QEMU user-mode emulation gives MATCH, the same hashes, 92 of 96. That does not close the verdict. The OWNER checklist is in §R (§H) |
| OCR MEMORY / LIFECYCLE | **PASS** (desktop, emulator). A worker per plan: load ≤ 0.57 s, about 100 ms per label (p95 ≤ 133 ms), +24 to +36 s per analysis on desktop. Each worker adds ≤ 108 MB at load, and at least 44 MB comes back when it exits. Whole-run peak: 898 / 951 MB on the blind runs, 981 MiB at most on the emulator. Watchdog, cancel = terminate, every batch recorded with its outcome. Phone figures pending with arm64 (§I) |
| EVIDENCE PACK | **PASS**. `EXTERNAL_OCR_CANDIDATES` in the timeline; `07-ocr-labels.json` carries every external reading and decision; the manifest names recogniser, model, runtime and WASM hash. A replay's pack equals the blind run's apart from its run id (§K) |
| CURRENT e-OZE | **PASS**. `rarytasy-eoze` is MUST_COMPLETE: PASS at +1.51 % both OFF and ON. The ON model hash differs, the footprint does not; `eoze-legacy-*` rows are identical (§G) |
| BLIND ROUND 7 / PROJECT 1 (`dom-pod-jarzabem`) | **ALGORITHMIC_FAIL** (class: metric — dimension topology / label binding; surfaces as boundary). Refused `BOUNDARY_RESOLUTION_INCONCLUSIVE`, no building. First bad decision `LABEL_BINDING` `e00276`: the `900` label bound to the parallel `1100` overall line. The extent then cuts the house above its south wall. External OCR ran and read the overalls right; it did not change the outcome (OFF replay identical) (§N, §O) |
| BLIND ROUND 7 / PROJECT 2 (`dom-w-arkadiach`) | **PASS**. 1 body, 2 storeys of 2, every opening built, −0.49 %. Decided by the external reader: it read the overalls `740`/`940` that the custom reader could not. The OFF replay of the same bytes refuses `METRIC_RESOLUTION_INCONCLUSIVE` (§N, §O) |
| **Stage** | **PARTIAL**: `PARTIAL_BUILDPLAN_ANALYZER_005H_ARM64_PENDING_AND_BLIND_7_TOPOLOGY_FAIL`. The arm64 phone parity is pending, and blind project 1 fails algorithmically upstream of OCR; not patched (protocol) |

- **Branch:** `analyzer/external-numeric-recogniser-v1` (every push also to `claude/new-session-3kzcgh`), from
  `analyzer/open-source-technology-audit-v1` @ `c6fe17467debe30acba08a834da13ae6db5f45e1`.
- **Legacy:** `BuildPlan-PC-Legacy` was not touched.
- **What the repository holds:** no publisher drawing, PDF page, crop, glyph bitmap or overlay. Only text facts, hashes,
  numbers, the analyzer's own SVG primitives and model renders, and the pinned model's licence texts.
- **No remote model and no cloud OCR.** The model ships inside the APK, verified by SHA-256 before every load.

---

## A. Single-repository audit — PASS

- **Canonical repository.** `damiankrok/BuildApp` is canonical, and every 005H commit is in it.
- **Legacy, untouched.** The Legacy checkout (`damiankrok/BuildPlan-PC-Legacy`) is attached read-only. Its `HEAD` and
  `origin/main` are `b0e79675c7ebeacf718cd1392f62272fb400418b` with 0 local changes, at the start and at the end of
  the stage. Nothing in 005H reads from it, depends on it, writes to it, branches in it or pushes to it.
- **Git hygiene.** No history was merged, force-pushed, reset or rewritten.

## B. What was built

`artifacts/analyzer-005h/architecture.md` is the map. In one paragraph: in `metricEvidenceSteps`, per plan frame, after
the lattices exist and before `solveFrameMetric`, each latticed token is cut from its own pass field and handed, as
pixels only, to a `LabelRecogniser`. The one implementation is `@buildapp/numeric-recogniser-ort`:

1. verify the model, dictionary, WASM and loader bytes against the manifest pins;
2. open one ORT session in a worker, `fetch` forbidden;
3. four reads per label (BASE, PAD2, TRIM1, SCALE90): a digit-constrained CTC beam and a greedy reading over the
   whole alphabet;
4. release the session, answer, exit.

`ensemble.ts` (the P2 rule) turns the two readings into one decision per label; the metric resolver decides, as before.
The phone runs it on; the analyzer API (server) runs it off, and the same URL there gives the pre-005H hashes. With no
recogniser the generator never yields and the bytes are the sync path's.

| layer | files |
| --- | --- |
| `source-metrics` | `recogniser.ts` (types only), `ensemble.ts`, `extract.ts` (async seam, opaque keys), metric-solution reads `ensemble` |
| `numeric-recogniser-ort` (new) | `manifest.ts` (pins, verified bytes), `engine.ts` (the only ORT import), `paddle.ts`, `bracket.ts`, `worker.ts`, `client.ts` (worker per batch, watchdog, RSS samples), `inline.ts` (tests), `scripts/fetch-model.mjs`, `scripts/synthetic-gate.ts` |
| `analysis-service` | the recogniser option, `OCR_EXTERNAL` substage with heartbeats, typed `RecogniserFailure` → `EXTERNAL_RECOGNISER_FAILED`, the summary counts |
| `local-analyzer` / APK | bundle ships `ocr-worker.mjs`, the WASM and loader, `models/`, `ocr-self-test.mjs`, each hashed in the bundle manifest; Android: the OCR self-test card, `runtimeBusy`, Polish failure texts |
| `evidence-pack` | `EXTERNAL_OCR_CANDIDATES`, the recogniser record |
| tests / CI | `tests/architecture/recogniser.test.ts`; `source-metrics` ensemble tests; runtime, worker, watchdog, fetch-guard tests; the `Analyzer / external numeric recogniser` job; the self-test parity steps |

Versions: lattice reader `1.2.0`, metric-evidence schema `1.6.0`, extractor `metrics.ocr-ensemble@1.0.0`. Each appears
only when the recogniser read at least one label.

## C. Model and runtime integrity — PASS

`artifacts/analyzer-005h/model-runtime-integrity.json` (`allMatch: true`).

| what | pin |
| --- | --- |
| model | `PaddlePaddle/PP-OCRv6_tiny_rec_onnx` @ `2612ab37…`, `inference.onnx` → `PP-OCRv6_tiny_rec.onnx`, 4 462 639 bytes, sha256 `9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6`, Apache-2.0 (notice and licence shipped) |
| dictionary | from `inference.yml` (`66170210…`), 6904 entries / 6906 classes, `PP-OCRv6_tiny_rec.dict.json` sha256 `9a8199f8…` |
| runtime | `onnxruntime-web` 1.30.0 (lockfile-pinned), `ort-wasm-simd-threaded.wasm` sha256 `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2`, one thread, no proxy |

The pinned artifact was available and passed every technical gate; no other model was substituted. `fetch-model.mjs`
downloads once for build and CI, verifies the SHA-256 and refuses otherwise. The APK carries the files and never
fetches. Training data: PaddleOCR does not publish its recognition training sets (a named provenance residual, not a
licence finding).

## D. The P2 rule and non-circularity

The external reading **corroborates** only when all four hold:

- posterior ≥ 0.90;
- greedy mean p ≥ 0.90;
- stable by the bracket's own four variant records;
- the greedy reading over the whole alphabet *is* the digit string. A beam that turned `2·5` into `25` cannot
  corroborate.

| case | decision | class | candidate |
| --- | --- | --- | --- |
| same reading (separators included), corroborating | AGREES | CLEAR | — |
| lattice CLEAR/SUPPORTED, other digits, same count | CONTESTS | AMBIGUOUS | the external value, only if corroborating |
| lattice CLEAR/SUPPORTED, other count | CONTESTS_COUNT | AMBIGUOUS | never |
| lattice in doubt, corroborating dimension | LEADS | SUPPORTED | the lattice value of the same count stays one |
| decimal lattice, or the model's own answer is not bare digits | compared by form only; can doubt, never lead | — | never |
| otherwise | NOT_CORROBORATING / NO_VALUE / NOT_COMPARABLE | unchanged | — |

Non-circularity is enforced by `tests/architecture/recogniser.test.ts`:

- the crop fields are exactly `key`, `gray` and `capPx`;
- the crop is cut before the yield and the yield before `solveFrameMetric`;
- keys are opaque;
- the solver reads only `ensemble`;
- only `engine.ts` imports ONNX Runtime;
- the frozen packages never import the recogniser.

The OFF matrix (§F) is the byte-level proof that the seam changes nothing when no recogniser is wired.

## E. Synthetic quality gate — PASS (gate), production path recorded

`artifacts/analyzer-005h/synthetic-quality.json`.

| measurement | result |
| --- | --- |
| **gate** — 005G's drawn-box crops on the 672 bake-off labels (bounds: exact ≥ 650, confident-wrong ≤ 2) | **PASS**: exact 655, confident-wrong 1, top-3 671, top-5 672, false high confidence 4 (3 stable) |
| production path (the custom reader's token crops), 420 × 140 page | exact 632, confident-wrong 5. On that page the reader bounds a glyph at 6 % of the larger side (25.2 px), so no cap-25 stress label is tokenised |
| production path, 1260 × 420 page (same label pixels, more paper) | exact 664, confident-wrong **3** — one over the bound; not gated. Two are dimension values (`3567 → 3557`, `2406 → 2405`, external confident and stable, LEADS); one is a five-digit `41405` that never reaches a scale |
| fresh corpus (seed 7001, two-digit, every label also turned a quarter both ways; no policy chosen on it) | 237 / 240 exact, 0 confident-wrong, read in the orientation a correct page vote picks |

One rule change followed a measurement: a lattice reading with a spurious comma (`72,408`, `66,88`) had AGREED as
CLEAR with a model that read no comma. Agreement now needs the same reading, separators included. No constant was
changed.

## F. Development matrix, recogniser OFF — byte-identical

`artifacts/analyzer-005h/development-matrix-off.json`. 22 rows (005F's 20 and round 6's two houses), offline from their
sealed packages. They were compared with the frozen baseline (005F's final matrix at `41e26be`, and the sealed round-6
blind runs) on every summary hash and on the metric evidence's own content hash.

- **22 / 22 identical** at `d04ebc4` and again at `d14304c`.
- The Android contract `result.json` pins a pre-005H OFF metric-evidence hash and still passes.

## G. Development matrix, recogniser ON — every change explained

`artifacts/analyzer-005h/development-matrix-on.json`.

**Overall.** No outcome and no verdict changed. 4602 / 4602 lattice records are byte-identical apart from the
external reading, the ensemble decision and the reader version.

**Model changed (5):**

| row | before → after | note |
| --- | --- | --- |
| `dom-w-jablonkach` | PASS → PASS | footprint the same |
| `dom-w-modrzykach` | +0.16 % → +2.03 % | PASS |
| `dom-w-tunbergiach` | −0.54 % → −0.37 % | `1173` read; still ALGORITHMIC_FAIL on storeys |
| `rarytasy-eoze` | PASS +1.51 % → PASS +1.51 % | footprint the same |
| `willa-miranda` | −5.07 % → −1.49 % | still ALGORITHMIC_FAIL |

**Evidence only (14):** `alt-marcowki`, `aster-viii`, `dom-pod-milorzebem`, `dom-w-azaliach`, `dom-w-dabecjach`,
`dom-w-helikoniach`, `dom-w-modrzewnicy`, `dom-w-morelach`, `dom-w-zurawkach`, `galaktyka`, `kosacce-clean`,
`kosacce-tracked`, `marcowki`, `rarytasy-g2e`.

**Identical (3):** `eoze-legacy-area`, `eoze-legacy-every`, `kosacce-area-alone`.

**Targets:**

| house | label | custom reader | external | decision | effect |
| --- | --- | --- | --- | --- | --- |
| `dom-w-modrzewnicy` | `2590` | `1140` AMBIGUOUS | `2590` p 0.9998, stable, own reading, mean char p **0.8955** | NOT_CORROBORATING | none |
| `dom-w-modrzewnicy` | `1950` | `1410` SUPPORTED | `1950` p 0.9998, stable, own | CONTESTS → AMBIGUOUS, `1950` a candidate | still METRIC_RESOLUTION_INCONCLUSIVE (refusal, no wrong building) |
| `dom-pod-milorzebem` | `648` | `608` SUPPORTED | `648` p 0.9999, stable, own | CONTESTS → AMBIGUOUS, `648` a candidate | still METRIC_RESOLUTION_INCONCLUSIVE |
| `dom-w-dabecjach` | `1580` / `850` | CLEAR / CLEAR | the same, p ≥ 0.9999 | AGREES | still BOUNDARY_RESOLUTION_INCONCLUSIVE (not numeric) |
| `dom-w-tunbergiach` | `1173` | `1171` AMBIGUOUS | `1173` p 0.9994, stable, own | LEADS → SUPPORTED | `1173` selected |

**Real labels** (the 103 transcribed: 81 from 005E, 22 from 005G; text facts only; not blind — they were 005G's
bake-off labels), production crops:

| reader | exact | confident | confident-wrong |
| --- | --- | --- | --- |
| custom | 49 | 44 | **10** |
| external | **103** | 95 | **0** |
| ensemble | 89 | 88 | **0** |

## H. Parity

| platform | verdict | evidence |
| --- | --- | --- |
| Node 22 / Node 18 / Node 18 without ICU | **PASS** | `parity-node.json`: OCR self-test MATCH on all three (corpus `734300d2…`, output `396c9f54…`, 92 / 96); the Larchfield and Holloway fixture analyses equal on every hash; CI job `Local analyzer / Node 18 parity` repeats both |
| x86_64 Android emulator (CI) | **PASS** | `parity-emulator.json`, run 157 job `112045257065`: `ocrSelfTestMatchesTheDesktop` MATCH; fixture 12.4 s, 455 MiB, equal to the desktop; live Marcówki 297.9 s, 899 MiB, device == desktop on every hash but the page's own (two fetches of a live page); live second house 282.2 s, 981 MiB; cancel while downloading 0.5 s, while computing 1.0 s |
| arm64 phone | **PENDING** | `parity-arm64-device.json`: no physical phone reachable. Supplementary: the APK's bundle (built at `5315ff8`) on arm64 Node 18.20.4 under QEMU user-mode gives MATCH, the same hashes, 92 / 96. 7.7 s per label emulated, not a timing. The first attempt hit the production 120 s watchdog under emulation; the self-test-only `--watchdog-scale` (in the freeze, never passed by the app) was added for it |

Run 156 found the one platform bug of the stage. On Android, `os.tmpdir()` resolves to the missing `/tmp`, so the worker
could not write its private loader copy, and every analysis on the emulator ended `EXTERNAL_RECOGNISER_FAILED`. It was
fixed in `5315ff8`: `process.env.TMPDIR`, with the verified file in place as fallback, and the error's code carried
through. Run 157 was green.

## I. Performance and memory (brief §18)

`performance.json`, `memory.json`: four houses, serial, OFF then ON, offline, the recogniser in a worker per plan as on
the phone (x86-64, 4 vCPU, Node 22).

| house | OFF → ON | added | labels | load mean / max | per label mean / p95 / max | longest silence OFF → ON |
| --- | --- | --- | --- | --- | --- | --- |
| Marcówki | 144.1 → 179.2 s | +35.1 s | 300 | 277 / 307 ms | 102 / 128 / 237 ms | 2.4 → 2.4 s |
| `dom-w-modrzewnicy` | 150.8 → 181.5 s | +30.6 s | 272 | 275 / 322 ms | 100 / 132 / 330 ms | 3.5 → 3.6 s |
| `dom-w-dabecjach` | 173.3 → 197.8 s | +24.5 s | 310 | 284 / 318 ms | 101 / 133 / 191 ms | 1.8 → 1.7 s |
| `kosacce-clean` | 139.2 → 175.5 s | +36.3 s | 335 | 371 / 570 ms | 97 / 116 / 193 ms | 2.0 → 2.5 s |

| house | whole-run peak RSS OFF → ON | worker load Δ (max) | reclaimed at exit (min) | residue after exit (max) |
| --- | --- | --- | --- | --- |
| Marcówki | 871 → 983 MB | 93 MB | 48 MB | 67 MB |
| `dom-w-modrzewnicy` | 774 → 969 MB | 106 MB | 44 MB | 68 MB |
| `dom-w-dabecjach` | 764 → 981 MB | 108 MB | 49 MB | 60 MB |
| `kosacce-clean` | 881 → 1046 MB | 105 MB | 54 MB | 75 MB |

- **Progress.** The phone shows `odczyt wymiarów · rozpoznawanie N z M` from the worker's per-label progress. A
  `loading` tick follows each load step, and COMPUTE heartbeats run while a batch is in flight.
- **Telemetry silence.** The longest is under 3.6 s on every row.
- **Przerwij.** Cancel terminates the worker; the emulator measured 0.5 s and 1.0 s.
- **Residue after exit.** RSS stays 60–75 MB above the start after a worker exits; this is a named residual.

## J. Failure naming and lifecycle

Any recogniser failure is a typed `RecogniserFailure`, which ends the run as `ANALYSIS_FAILED /
EXTERNAL_RECOGNISER_FAILED` (stage `EXTRACTING_OBSERVATIONS`, substage `OCR_EXTERNAL`, diagnostics
`recogniserFailure`, `recogniserError`).

| kind | Polish wording on the phone |
| --- | --- |
| OUT_OF_MEMORY | own text |
| ASSETS_REFUSED | own text |
| TIMEOUT / WORKER_EXITED / FAILED | one shared text |

- **No fallback.** A failure is never a quiet lattice-only run.
- **Watchdog:** 300 s per load, 120 s per label.
- **Abort** terminates every live worker.
- **Messages:** late worker messages are ignored.
- **Failed loads** are not cached.
- **Release** never replaces the run's own error.
- **Self-test:** it publishes after its process is gone, sweeps stale folders, and shares one `runtimeBusy` guard with
  analyze, retry and mode.

## K. Evidence Pack — PASS

- **New layer.** `EXTERNAL_OCR_CANDIDATES` sits between `OCR_SEQUENCE_CANDIDATES` and `OCR_READING`, one event per
  latticed label: the reading, top 5, greedy, bracket and decision.
- **`07-ocr-labels.json`** carries `external` and `ensemble` on every lattice, plus the recogniser record.
- **`manifest.json`** names the recogniser, the model SHA-256, the runtime and the runtime SHA-256.
- **First-divergence artefacts.** `GLYPH_COUNT_HYPOTHESES` and `OCR_SEQUENCE_CANDIDATES` events are listed only for
  PRIMARY-bound inks, decided after the ensemble. A row whose first divergence is one of those stages has an ink
  present in one run and absent in the other — a listing difference, not a decision.
- **Determinism.** Blind run #2's pack and its replay differ only by the run id and the hashes of the files that print
  it.

## L. Post-implementation red team

Four read-only reviewers on `c6fe174..d04ebc4` (`post-review/A–D`, `resolution.md`):

- **A** — OCR evidence and non-circularity;
- **B** — deployment and parity;
- **C** — memory and lifecycle;
- **D** — generalization.

No P0. Every P1 was fixed before the freeze except two recorded as owner decisions.

| P1 | finding | fix |
| --- | --- | --- |
| A1 / D5 | an unconfident CONTESTS offered a full-strength candidate | candidate only when corroborating |
| A3 | the separator branch let a confident disagreement keep CLEAR | the branch compares digits and separators |
| D1 | the beam turned `2·5` into `25` at p ≈ 1 | corroboration also needs the model's own greedy reading |
| — (from the measurement) | the spurious-comma AGREES | agreement needs the same reading, separators included |
| C1 / B9 | named failure | typed `EXTERNAL_RECOGNISER_FAILED` |
| B1 | CI ran the bundle tests without the model | model fetch in the job |
| D2 | the production-path confident-wrong was never measured | measured, recorded, not gated |

The two owner decisions:

- **A2** — a disagreement demotes CLEAR with no confidence floor;
- **A4** — LEADS over a lattice in doubt.

Both are kept as the brief binds them. On blind 7, the 7 doubts raised without a confident external reading fell on
unbound ink, or on a label the external reader had right.

## M. Freeze — PRE_HOLDOUT_7_SHA

`5315ff8ff1cfbc1fd69d8fb5032374d2ed230733`, CI run 157 (`37393928441`) green on every job (preview and OWNER APK skipped
by design on push). Preconditions (brief §21):

| precondition | status |
| --- | --- |
| OFF unchanged | yes |
| synthetic gate green | yes |
| matrix complete | yes |
| e-OZE green | yes |
| Node / no-ICU parity | yes |
| x86 emulator parity | yes |
| memory safe | yes |
| Evidence Pack deterministic | yes |
| P0 / P1 closed | yes |
| CI green | yes |
| **real arm64 phone parity** | **not obtained → PENDING, which caps the stage at PARTIAL** |

No production file changed after the freeze.

## N. Blind round 7

`artifacts/analyzer-005h/blind-round/README.md` is the full record.

**Draw.** Ledger line `6e931ee`, 00:58:07Z.

- **Seed:** `SHA256(5315ff8… + "BUILDPLAN-005H-EXTERNAL-NUMERIC-RECOGNISER-HOLDOUT")` = `7d7bce9b…`, recomputed
  independently.
- **Pool:** 2407 drawable, 678 excluded; 47 excluded families, the round-6 blind houses among them.
- **Draws:** i1 59 → `dom-pod-jarzabem` (`…projekt-dom-pod-jarzabem-15-g-mbad2613634abe`); i2 288 →
  `dom-w-arkadiach` (`…projekt-dom-w-arkadiach-6-m168264238cc55`).

**Runs.** Each address ran once, live, recogniser ON, Evidence Pack ON, frozen code, no patch after the draw.

| # | wall | external OCR | peak RSS | longest telemetry gap | verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | 165 s | 4 workers, 259 labels, 26.6 s, all READ | 898 MB | 2.0 s | **ALGORITHMIC_FAIL** — `BOUNDARY_RESOLUTION_INCONCLUSIVE` |
| 2 | 176 s | 8 workers, 228 labels, 23.9 s, all READ | 951 MB | 1.9 s | **PASS** — 2/2 storeys, openings built, −0.49 % |

**The external reader on the two selected plans**, checked label by label against the drawings (locally):

| what | count | result |
| --- | --- | --- |
| LEADS | 9 | all right |
| AGREES | 11 | all right |
| confident disagreements with a CLEAR lattice | 4 | external right every time |
| external confident-wrong | **0** | — |

## O. Blind diagnosis (brief §23)

Diagnostic replays came after the runs: the sealed source package, offline, the frozen code, with and without the
recogniser. The ON replay reproduces blind #2's metric evidence and model byte for byte. Nothing was changed or
re-scored.

### #1 `dom-pod-jarzabem` — ALGORITHMIC_FAIL

- **Did the external OCR run?** Yes, and it read the overalls right: `1960` LEADS, `1100` AGREES. It contested the
  confident misread `400` with the right `900`.
- **Which disagreements mattered?** None decided the outcome: the OFF replay fails with the same outline message.
- **First bad decision:** `e00276` `LABEL_BINDING`. The left margin has two parallel vertical lines 23.5 px apart: the
  `1100` overall and the inner `250/100/900/100` chain. The `900` label lies between them, 3.5 px from the overall
  line, and both candidate spans centre at y ≈ 400. It was bound to the overall line (residual 247.8 px), and the
  `1100` label was left unbound on this copy. Before that, `e00038`/`e00039` had accepted two "ticks" on the overall
  line inside the `900` label's extent.
- **What it did.** The depth came from the inner chain alone, read only on its `250`. Its `100` end segment (33.6 px,
  read `100` by both readers, residual 2.5 px at the 3 %-low kept scale) stayed unread, and the extent trims such a
  stub. `e00398` put the south side at 562.9 px; the drawn south wall is at ≈ 580–597 px. The envelope cut the house
  above it, and the main block's southern rooms became unbuilt `RECESSED_ATTACHED` / `COVERED_TERRACE` bodies. The
  first reading built 73.42 m² against 216.76 m², and the refusal followed.
- **Class:** metric (dimension topology / label binding), surfacing as boundary. Not OCR, not source (853 px copy,
  12 px walls, legible overalls).

### #2 `dom-w-arkadiach` — PASS

- **Did the external OCR run?** Yes.
- **Which disagreements mattered?** The two overalls. The custom reader read `700`/`140` and `440`/`410`, all
  AMBIGUOUS. The external reader read `740` and `940` (9.40 × 7.40 m = 69.56 m², the built footprint): LEADS →
  SUPPORTED. The metric relation was CONFIRMED STRONG by 2 independent readings. The OFF replay of the same bytes
  refuses `METRIC_RESOLUTION_INCONCLUSIVE`. Two confident custom misreads (`104` for `149`, `50` for `150`) were
  demoted, correctly.
- **First bad decision:** none that fails a verdict condition. Residual: `RESIDUALS_OUTSIDE_TOLERANCE` (2 of 3
  source-view checks).

## P. CI

| run | event | commit | result |
| --- | --- | --- | --- |
| 154 | push | `c6fe174` (start) | green |
| 155 | push | `d04ebc4` | **red**: `Analyzer / progress` ran the bundle tests without the model → model cache and verified fetch added to the job |
| 156 | push | `d14304c` | **red**: the emulator jobs — every analysis `EXTERNAL_RECOGNISER_FAILED` (`os.tmpdir()` → `/tmp` on Android) → fixed in `5315ff8` |
| **157** | push | **`5315ff8`** = PRE_HOLDOUT_7_SHA | **green**, every job (preview / OWNER APK skipped by design) |
| 158 | push | `6e931ee` (the ledger line) | superseded by the report's push |

The final CI and the OWNER APK dispatch on the report's commit are recorded in §R.

## Q. Commits

On `analyzer/external-numeric-recogniser-v1` from `c6fe174`, each pushed to the branch and to `claude/new-session-3kzcgh`:

- `d04ebc4` — the recogniser, the seam, the rule, packaging, self-test, tests and CI;
- `d14304c` — the red team's fixes;
- `5315ff8` — the Android loader copy and coded failures (the freeze);
- `6e931ee` — the ledger line;
- `85ccf42` — blind round 7, parity, measurements;
- then this report and PROJECT_STATUS, and the OWNER APK record (§R).

## R. OWNER APK

Recorded in the commit after this report, from the `workflow_dispatch` (`owner_apk`) run on it: ABI, version, run and
commit, APK SHA-256, signer, model and WASM SHA-256, recogniser id, schema and lattice versions, native libraries and
permissions — each verified from the downloaded file.

### OWNER phone checklist

1. **arm64 parity (closes ARM64_DEVICE_PARITY).** Open "Dodaj dom z linku" → "Test zgodności odczytu wymiarów" →
   "Uruchom test", then copy the result ("Kopiuj wynik").
   - **Pass:** "Zgodny z komputerem", corpus `734300d2…`, output `396c9f54…`, 92 of 96, model `9ef676d6…`.
   - **Also send back** the time per label, the phone model and its RAM.
2. **Known houses.** Marcówki, Kosaćce and Rarytasy G2E still build. Model hashes may differ from the previous build
   (the recogniser is on), and the outcomes do not (§G).
3. **`dom-w-arkadiach`** builds two storeys at about its published size (69.9 m²). **`dom-pod-jarzabem`** stops by name
   (outline inconclusive), with no house built.
4. **Progress.** The line shows "rozpoznawanie N z M" during the dimension step, and "Przerwij" stops within seconds.
5. **A recogniser failure** names itself in Polish ("Odczyt wymiarów z rysunku zatrzymał się…", or the memory / damaged-files texts) and never falls back silently.

## S. Residual debt

| item | detail |
| --- | --- |
| arm64 phone parity and phone timings | pending (OWNER) |
| dimension topology on parallel chains | blind 7 #1: label binding between an overall line and its inner chain, label ink as ticks, the end-stub trim |
| `modrzewnicy` and `pod-milorzebem` | contested, not resolved |
| `2590` | NOT_CORROBORATING by 0.0045 of mean p |
| production-path confident-wrong | 3 / 672 on the realistic synthetic page |
| shared limits of both readers | the orientation vote they both inherit; the bracket's blind spots |
| per-plan worker cost | +24 to +36 s per analysis |
| post-exit RSS residue | 60–75 MB |
| supply chain | `protobufjs` postinstall; no size limit on the model fetch (SHA enforced) |
| PaddleOCR training data | undisclosed |

## T. Next step

Return to the coordinator. `artifacts/analyzer-005h/recommendation.md`:

1. **Keep** the recogniser and the P2 rule as they are.
2. **OWNER:** run the phone self-test.
3. **Next analyzer stage:** dimension topology on parallel chains, with blind 7 #1 as its input. Both round-7 families
   join the development set.
4. **Then** the PDF.js document-evidence pilot that 005G recommended and this brief deferred.
