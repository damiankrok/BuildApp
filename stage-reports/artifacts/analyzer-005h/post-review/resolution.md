# 005H post-implementation red team — resolution

Four read-only reviewers on `c6fe174..d04ebc4` (A OCR evidence / non-circularity, B deployment / parity,
C memory / lifecycle, D generalization). Their reports are beside this file. Every P0/P1 is fixed; P2/P3 are fixed
where small and in scope, otherwise named as residual risk. No P0 was found.

## P1 — fixed

| id | finding | fix |
| --- | --- | --- |
| A1 / D5 | `CONTESTS` offered an unconfident external value as a full-strength scale candidate | `rival` only when the external reading corroborates; otherwise AMBIGUOUS, doubt only (`ensemble.ts`) |
| A3 | the separator branch let a confident disagreement with a stray dot keep CLEAR | the branch compares digits *and* separators; a different reading of a CLEAR/SUPPORTED lattice is CONTESTS / CONTESTS_COUNT without candidate; it never leads |
| D1 | corroboration never checked the model's own answer: a digit-only beam turns `2·5` into `25` at p ≈ 1, `/12` into `112` | corroborating also requires the greedy reading over the whole alphabet to *be* the digit string; otherwise the reading is compared by its form and can only doubt |
| — (found by the production-path measurement after D1) | a lattice reading with a spurious comma (`72,408`, `66,88`) AGREED as CLEAR with a model that read no comma | agreement needs the same reading, separators included; never CLEAR on digits alone |
| C1 / B9 | any recogniser failure ended the run as ANALYSIS_FAILED / INTERNAL_ERROR | a typed `RecogniserFailure` → ANALYSIS_FAILED / `EXTERNAL_RECOGNISER_FAILED` in EXTRACTING_OBSERVATIONS / OCR_EXTERNAL with its kind (OUT_OF_MEMORY, WORKER_EXITED, ASSETS_REFUSED, TIMEOUT, FAILED); Polish wording on the phone. No fallback to the lattice alone (the brief: no fallback) |
| B1 | CI "Analyzer / progress" ran the bundle tests without the model | model cache + verified fetch added to that job |
| D2 | the confident-wrong bound was never measured on production (token) crops | measured and recorded in CI on two page sizes; **not gated** — on the realistic page it is 3, one over the bound (see residuals) |

## P1 — owner decision, recorded

| id | finding | disposition |
| --- | --- | --- |
| A4 | `LEADS` over a LOW_QUALITY / empty lattice makes the external reading alone SUPPORTED | kept: it is 005G's P2 as scored and as the brief binds it ("external-led + stability bracket"); 005G's "fallback" (OCR-3) is BuildPlan-first, never consulting the external reader on BuildPlan's confident reads, which P2 does. Now narrower: a LEADS needs the model's own reading (D1) |
| A2 | a disagreement demotes CLEAR to AMBIGUOUS with no confidence floor | kept as the brief writes it ("disagrees with a CLEAR/SUPPORTED reading → AMBIGUOUS"); 005G scored BuildPlan's own confident reads as 10 wrong in 44 on real labels and never counted them confident without the external reader. Since D1, only the model's own reading (or a form disagreement) can doubt; a beam artefact cannot |

## P2 / P3 — fixed

A5 opaque crop keys (`c0…`) · A6 versions / schema / recogniser record only when at least one label was read ·
A7 summary counts (`corroborating` = confident + stable + own reading; `disagreements` = CONTESTS(_COUNT); `leads`
apart) · A8 stability derived from the four variant records · A9 tests strengthened (opaque keys, read-gated
versions, test title no longer claims chain invariance; a pre-005H OFF hash is already pinned by the Android contract
`result.json`) · B2 the loader runs from a private copy of the verified bytes · B3 an unknown WASM hash is a MISMATCH ·
B4 `fetch` throws inside the worker, tested · B5 / C6 the self-test publishes after the process is gone, sweeps
stale folders · B6 / C5 one `runtimeBusy` guard for analyze, retry, mode and the buttons; self-test failures in
strings.xml · C2 late worker messages ignored · C3 per-batch watchdog (`RecogniserTimeout`), COMPUTE heartbeats while
a batch runs · C4 the worker says `loading` after each load step (ticks) · C7 every batch recorded with its outcome
and the RSS samples it reached · C8 a failed load is not cached; release never replaces the run's error ·
C9 every live worker tracked; release cancels all · C10 the worker releases its session before answering ·
D9 the self-test and its corpus sources are scanned for development fingerprints · D10 "zgodne z korpusem testowym
(to nie miara dokładności)".

## Residual risks — named, not fixed in 005H

- **Production-path confident-wrong 3 / 672** on the realistic page (2 on dimension values: `3567→3557`, `2406→2405`,
  BROKEN stratum, external confident and stable; 1 five-digit `41405` that can never reach a scale). The 005G
  drawn-box gate is 1 / 672.
- **Orientation (D7).** Both readers inherit the page's orientation vote; an upside-down vote would let both agree on
  `91 → 16`. Shown on the fresh stratum when the vote is wrong; with the vote right, 237 / 240 exact, 0 confident-wrong.
- **Bracket (D4).** SCALE90 is a blur after the 48 px resize, PAD2/TRIM1 change paper only: the bracket cannot catch
  truncation, a neighbouring tick or a wrong orientation.
- **Posterior (D3).** Normalised over non-empty digit strings, as 005G calibrated it; the model's own reading (D1) now
  stands between a beam artefact and a decision.
- **One worker per plan (B8)** re-verifies ~19 MB and recompiles the WASM per plan; measured on desktop and emulator,
  pending on an arm64 phone.
- **Phone vs service (B10).** The phone reads with the recogniser, the analyzer API does not: one URL gives different
  evidence and candidate hashes by mode. Intended; stated in the report.
- **Supply chain (B11).** `protobufjs` postinstall (not bundled); `fetch-model.mjs` has no size limit (SHA-256 still
  enforced).
- **Training data.** PaddleOCR does not publish its recognition training sets; licence is Apache-2.0.
