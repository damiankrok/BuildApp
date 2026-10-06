# Blind holdout round 7 — draw, runs, verdicts and diagnosis (005H)

The protocol is `holdout/README.md`, round 7. This directory seals what the draw produced, as text facts only. No
drawing, crop, overlay or render of a publisher drawing is committed. The raw plans were looked at locally for the
diagnosis below and stay outside the repository. The two Evidence Packs written during the runs are committed
unchanged (`evidence/blind-h1-dom-pod-jarzabem`, `evidence/blind-h2-dom-w-arkadiach`): SVG primitives in the frame's
own pixel coordinates, JSON, and for the completed run a 480 px render of the analyzer's own model.

## Draw

- **PRE_HOLDOUT_7_SHA** `5315ff8ff1cfbc1fd69d8fb5032374d2ed230733`.
  - Pushed to `analyzer/external-numeric-recogniser-v1` and `claude/new-session-3kzcgh` before the draw.
  - CI run 157 (`37393928441`, push) on it: every job green; the preview and OWNER APK jobs skipped by design (push).
  - The tree was clean.
  - The only commit between the freeze and the runs is the ledger line itself (`6e931ee`, `holdout/LEDGER.ndjson`, one
    line). The runs were made from the main worktree at `6e931ee`, whose code is the freeze's
    (`git diff 5315ff8 6e931ee -- packages apps` is empty).
- **The ledger** (`holdout/LEDGER.ndjson`, the line labelled `BUILDPLAN-005H-EXTERNAL-NUMERIC-RECOGNISER-HOLDOUT`,
  00:58:07Z):

| | |
| --- | --- |
| pool | `holdout/pool.txt`, sha256 `800c2a1ed9daee9efd2654c64b061e430094dc38fc459b805af27ff9fad2ed41` |
| exclusions | `excluded-families-round-7.txt`, sha256 `644243a6dab1a6ecd70e1cbbaef97e1c3b84a904513422d8cfef8bdade36e41d` (47 families: round 6's 45 + the two round-6 blind families) |
| seed | `7d7bce9bf8a9b28fcb3a648a751aae9a714b786017bc99f2a65e01d6e56325ad` |
| n / excluded | 2407 drawable / 678 excluded |
| i1, i2 | 59, 288 |
| #1 | `https://www.archon.pl/projekty-domow/projekt-dom-pod-jarzabem-15-g-mbad2613634abe` (family `dom-pod-jarzabem`) |
| #2 | `https://www.archon.pl/projekty-domow/projekt-dom-w-arkadiach-6-m168264238cc55` (family `dom-w-arkadiach`) |

- **Recomputed independently.** `SHA256(PRE_HOLDOUT_7_SHA + "BUILDPLAN-005H-EXTERNAL-NUMERIC-RECOGNISER-HOLDOUT")`
  gives the seed. Neither family is a development house or in any exclusion file of any round. The names occur in the
  repository only in `holdout/pool.txt`, and in two ignored local caches (a copy of the 005D pool list and a cached
  development page that links a different `dom-pod-jarzabem` variant) — neither is read by the analyzer.

## Runs

Each address ran **once**, live, with the frozen code, the recogniser **on** and the Evidence Pack on, one after the
other: `ANALYZER_EVIDENCE=1 TELEMETRY=1 analysis:second-house --url <address> --cache <scratch> --out <scratch>
--recogniser`, which is production `runAnalysis` with the worker recogniser the APK uses (one worker per plan, the
pinned model and WebAssembly, four reads per label). Cache and output stayed outside the repository, and nothing was
re-run. An unrelated arm64 emulation (parity, one core of four) was still running during part of run #1.

| # | started (UTC) | wall | analysis | metric phase | external OCR: workers · labels · OCR time | load (max) | per label mean / p95 / max | peak RSS | longest tick gap | longest telemetry gap | pack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 01:03:22 | 165 s | 160.9 s | 126.4 s | 4 · 259 · 26.6 s, all READ | 285 ms | 101 / 122 / 288 ms | 898 MB | 2.6 s | 2.0 s | 32 files, 419 decisions, 238 ms |
| 2 | 01:06:10 | 176 s | 172.4 s | 123.0 s | 8 · 228 · 23.9 s, all READ | 294 ms | 100 / 118 / 210 ms | 951 MB | 2.4 s | 1.9 s | 33 files, 331 decisions, 225 ms |

Every label the custom reader latticed was also read by the external reader (259 and 228); no worker failed, timed out
or was cancelled; telemetry carried `OCR_EXTERNAL` on both runs.

## Verdicts (`holdout/verdict.mjs`, as frozen)

| # | family | outcome | verdict |
| --- | --- | --- | --- |
| 1 | `dom-pod-jarzabem` | `RECONSTRUCTION_FAILED / BOUNDARY_RESOLUTION_INCONCLUSIVE` (B_STRICT 76.1 m², B_EXCLUSION 108.8 m², published 216.76 m²) | **ALGORITHMIC_FAIL** |
| 2 | `dom-w-arkadiach` | COMPLETED: 1 body, 2 storeys of 2, every printed opening built, 69.56 m² against 69.90 m² (**−0.49 %**), the first reading held, no challenge | **PASS** |

The verdict files are beside this README (`verdict-*.json`), as the script printed them.

## The external reader on the two selected plans

Checked label by label against the drawings (looked at locally, not committed):

| | #1 (94 lattices) | #2 (62 lattices) |
| --- | --- | --- |
| LEADS (external corroborating, lattice in doubt) | 4 — `1960`, `450`, `420`, `352`: all right | 5 — `940`, `740`, `260`, `273`, `380`: all right |
| AGREES (both, corroborating) | 8: all right | 3: all right |
| confident disagreement with a CLEAR/SUPPORTED lattice | 2 — `900` vs `400` CLEAR, `14` vs `10` CLEAR: external right both times | 2 — `149` vs `104` CLEAR, `150` vs `50` CLEAR: external right both times |
| disagreement without a confident external reading (doubt only, no candidate) | 4 — 3 on unbound ink; 1 bound (`75` CLEAR vs `375`: the external reading was right, the lattice had dropped a digit) | 3, all on unbound ink |
| external confident-wrong | **0** | **0** |

The whole runs (every plan copy): #1 — 15 LEADS, 18 AGREES, 6 CONTESTS, 4 CONTESTS_COUNT, 21 NOT_CORROBORATING,
37 NOT_COMPARABLE, 158 NO_VALUE; #2 — 28 LEADS, 6 AGREES, 4 CONTESTS, 5 CONTESTS_COUNT, 11 NOT_CORROBORATING,
42 NOT_COMPARABLE, 132 NO_VALUE.

## Diagnosis (brief §23)

### Diagnostic replays (after the runs; not part of the verdict)

To answer "did the external reader change the outcome", each run's sealed source package was replayed offline with the
frozen code (`analysis:second-house --package … --graph … --cache …`). The replay **with** the recogniser reproduces
blind run #2's metric evidence and model byte for byte (and the same candidate hash), so the replay is the run. The
replay **without** it is the same pipeline minus the external reader. No code was changed and nothing was re-scored.

| # | ON (the blind run) | OFF replay | first divergence (`evidence:diverge`) |
| --- | --- | --- | --- |
| 1 | BOUNDARY_RESOLUTION_INCONCLUSIVE | BOUNDARY_RESOLUTION_INCONCLUSIVE, the same message | `OCR_SEQUENCE_CANDIDATES` (which inks the pack lists), then readings and scales; the outline is identical |
| 2 | **PASS**, −0.49 % | `METRIC_RESOLUTION_INCONCLUSIVE` (would be ALGORITHMIC_FAIL) | `EXTERNAL_OCR_CANDIDATES` → `OCR_READING`, `LABEL_BINDING`, `SCALE_HYPOTHESIS`, `METRIC_RELATION`, … `FINAL` |

### #1 `dom-pod-jarzabem` — ALGORITHMIC_FAIL (class: metric — dimension topology / label binding; surfaces as boundary)

- **Did external OCR run?** Yes: 4 workers, 259 labels, 26.6 s, all READ.
- **Which disagreements mattered?** None decided the outcome; the OFF replay fails with the same outline. On the
  selected copy the external reader read both overalls right (`1960` LEADS over the lattice's `1060`; `1100` AGREES
  CLEAR) and contested one confident misread right (`900`, which the lattice read `400` CLEAR → AMBIGUOUS, rival `900`).
  It raised the selected copy's best alternative scale from 1.515 cm/px (1 reading, OFF) to 2.802 cm/px (3 readings,
  ON) — the drawing's own scale (`1960` over 699.5 px) — and turned another copy's scale from REPLACED/WEAK to
  REPLACED/SUPPORTED. The selected copy still kept the page vote (2.716 cm/px, WEAK, "does not outweigh it twice
  over"): 3 % short, not the cause of the failure.
- **The building.** A bungalow with a garage: `1960` = `450` + `1460` + `50` across, `1100` = `100` + `900` + `100`
  deep on the left margin, a `250` terrace strip above; published footprint 216.76 m², garage 33.53 m².
- **First bad decision:** `e00276` `LABEL_BINDING`. The left margin carries two parallel vertical lines 23.5 px apart:
  the overall line (x ≈ 31.5 px, label `1100` at x 12–27) and the inner chain (x ≈ 55 px, labels `250`, `100`, `900`,
  `100` at x 35–51). The `900` ink (35–51 × 388–412 px) lies 3.5 px right of the overall line and 4 px left of its own,
  and the two spans it could name are both centred at y ≈ 400. It was bound PRIMARY to the overall line
  (`chain-vertical-32`, 204–596.5 px, metric residual 247.8 px); the `1100` ink, read `1100` by both readers, was left
  with no binding on this copy. Earlier, `e00038`/`e00039` had accepted two "ticks" on the overall line at 396 and
  411 px, inside the `900` label's own extent — its glyph ink beside the line — so that line reads as three unread
  segments ("no number on this chain could be reconciled").
- **What it did.** With the overall line unread, the depth came from the inner chain alone, whose only read segment is
  the `250` (89.9 px): its two `100` segments (33.1 and 33.6 px, both read `100` CLEAR by both readers, residuals 3.0
  and 2.5 px) were left DERIVED, and the extent rule trims an unread end segment shorter than half the shortest read
  one. `e00398` `EXTENT` put the south side at 562.9 px; the drawn south wall of the main block lies at ≈ 580–597 px.
  The envelope box (`e00399`, 453 of 783 cells enclosed) cut the house above its own south wall; the main block's
  southern rooms opened onto the cut and became `RECESSED_ATTACHED` (43.6 m²) and `COVERED_TERRACE` (26.6 m²) bodies,
  not built (`e00407`–`e00416`). The first reading built 73.42 m²; the published figure refused it; the best of 95 other
  readings (191.4 m², −11.7 %) had only the spent figure behind it → `BOUNDARY_RESOLUTION_INCONCLUSIVE`.
- **Not a source limit:** the selected copy is 853 × 853, walls 12 px, the overalls legible (the external reader read
  them at p > 0.99).

### #2 `dom-w-arkadiach` — PASS (decided by the external reader)

- **Did external OCR run?** Yes: 8 workers, 228 labels, 23.9 s, all READ.
- **Which disagreements mattered?** The two overalls. The plan prints `740` across and `940` deep (9.40 × 7.40 m =
  69.56 m², the built footprint). The custom reader read them `700` / `140` and `440` / `410`, all AMBIGUOUS; the
  external reader read `740` and `940` at p ≥ 0.999, stable, its own greedy answer — LEADS → SUPPORTED, each with the
  lattice value of the same count kept as a candidate. `e00278` `METRIC_RELATION` then CONFIRMED the page vote
  1.845 cm/px STRONG by 2 independent readings on 2 chains. Without the recogniser the same bytes end
  `METRIC_RESOLUTION_INCONCLUSIVE` ("no reading that owes nothing to it supports it"). Two confident custom misreads
  (`104` for `149`, `50` for `150`) were demoted to AMBIGUOUS by the external reader, correctly.
- **First bad decision:** none that fails a verdict condition. Residuals: `RESIDUALS_OUTSIDE_TOLERANCE` (2 of 3
  source-view checks), 17 unresolved observations.

## What this round says

- On unseen houses the external reader made no confident-wrong reading on either selected plan; it led 9 labels the
  custom reader could not read, all right, and contested 4 confident custom misreads, all right.
- It turned one refusal into a PASS (#2) and did not touch the other failure (#1), which is a dimension-topology
  decision (two parallel lines, one label between them) upstream of any reading.
- Round 7 has an ALGORITHMIC_FAIL, so the stage is PARTIAL at best by the brief's rule. No patch was made after the
  draw.
