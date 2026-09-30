# Blind ARCHON holdout — draw, runs and verdicts (005A, T2–T4)

The protocol is `holdout/README.md`. This directory seals what the draw produced, as text facts only. No
drawing, overlay or render of a drawing is committed. The two overlays were looked at once, locally, for the
diagnosis below, and stay outside the repository.

## Draw (T2)

- **PRE_HOLDOUT_SHA** `56ca1e3a5bd68c72f3dc1fab6ebade426bcc8ac8`.
  - Pushed to both branches before the draw; CI run 96 on it was green.
  - The tree was clean, and nothing was committed between the freeze and the draw.
- **The ledger** (`holdout/LEDGER.ndjson`, one line):
  - drawn at 2026-09-30T03:30:03Z;
  - seed `5850abd93cdd8ce20286c3f481378cef94e09785030a772728d3361c50ffaac2`;
  - `n = 2765`, with 320 addresses excluded;
  - `i1 = 960`, `i2 = 2727`.

| # | address | family |
| --- | --- | --- |
| 1 | `https://www.archon.pl/projekty-domow/projekt-dom-w-jablonkach-22-mb0e2566e7cb18` | `dom-w-jablonkach` |
| 2 | `https://www.archon.pl/projekty-domow/projekt-willa-miranda-11-g2-m49324d69ef143` | `willa-miranda` |

- **Disclosure checked.** Neither family is one the dummy-SHA draw named (`dom-w-nawlociach`, `dom-w-renetach`).
- **Excluded families.** Neither family is in `holdout/excluded-families.txt`; that holds by construction.

## Runs (T3)

Each address ran **once**, live, with the frozen code. The command was
`analysis:second-house --url <address> --cache <scratch> --out <scratch>`, which is production `runAnalysis`
with telemetry on. The cache and output stayed outside the repository.

| # | started (UTC) | wall | peak RSS, process tree | longest telemetry gap | longest tick gap (phase) |
| --- | --- | --- | --- | --- | --- |
| 1 | 03:31:44 | 206.7 s | 908 MB | 2.1 s | 3.8 s (`ACQUIRE_ASSETS`, network) |
| 2 | 03:35:11 | 191.4 s | 873 MB | 2.2 s | 3.1 s (`ACQUIRE_ASSETS`, network) |

- **Acquisition.** Both packages were acquired whole: 34 assets and 8 floor-plan copies each (4 per storey), with
  no floor-plan address lost.
- **Failures.** Each package records 14 failures: 5 `BYTE_IDENTICAL` duplicates, and 9 guessed variant
  addresses that answered HTTP 404.
  - 4 of those guesses claimed a floor plan. A 404 on a guess is a definite absence, so none of the 14 is a lost
    plan (`planAddressesLost 0`).

## Verdicts (T4)

Computed by `holdout/verdict.mjs`, committed before the draw. `verdict.json` in each directory is that output.
Re-running it on the sealed files here gives the same verdict as on the original run directory; only the `run`
path differs.

### #1 `dom-w-jablonkach` — **ALGORITHMIC_FAIL**

- **Outcome.** `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`: the lowest storey covers 46.49 m², against the
  **99.4 m²** the publisher prints (53.2 % apart).
- **The resolver.** Its outcome was `INCONCLUSIVE` with the figure `SPENT`.
  - It weighed 71 readings: 4 copies, 18 decompositions, 23 distinct outlines, 0 compositions.
  - Every reading was `WRONG`. The best was 3 bodies at 48.1 m².
- **The source checklist.** No item holds:
  - the package has floor plans (GROUND and ATTIC, labelled);
  - the ground copy's walls are 20 px on 853 px;
  - OCR tokens on the ground copies are up to 59 px tall;
  - no floor-plan asset is lost.

  So the stop is not source-limited: the drawing is adequate.
- **Diagnosis, after the verdict, with nothing patched.** The first bad decision is the scale.
  1. The overall dimensions printed outside the outline agree with one another at **2.11 cm/px**:
     - 1100 over 519 px;
     - 900 over 426 px;
     - 380 over 180.5 px.

     Their product, 11.0 × 9.0 m, agrees with the published 99.4 m².
  2. The registration settled at **1.88 cm/px**, from 6 anchors:
     - Five are short interior spans (0.83–3.13 m).
     - The sixth is the 426 px overall span, entered as **8.06 m** (`metric-dimension-86e1fe96bf`).
  3. The OCR read the rotated label "900" as **"006"**, the digits it gives upside down. The chain solver then
     rewrote it as "806", with the note "the chain's scale endorses 806" (`origin: CHAIN_CORRECTED`,
     confidence 0.14). The correction made the misreading agree with the interior spans' scale, and it then
     became an anchor of the same scale, a circular witness.
  4. A second, separate miss: the walled envelope stops at the inner wall x = 206 px. The attached wing's walls
     (x ≈ 84–104 px, 21 px thick like the house's) lie outside the extent, and the extent's other side runs onto
     the terrace, to 704 px.
- **Bodies.** No model, so no body count.

### #2 `willa-miranda` — **ALGORITHMIC_FAIL**

- **Outcome.** `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED`: the lowest storey covers 0.55 m², against the
  **169.9 m²** the publisher prints.
- **The resolver.** Its outcome was `INCONCLUSIVE` with the figure `SPENT`.
  - It weighed 11 readings: 4 copies, 3 decompositions, 7 distinct outlines, 0 compositions.
  - Every reading was `WRONG`. The best, on the area-table copy with the chain extent, gave 2 bodies at
    101.3–103.8 m² (−39 to −40 %).
  - The dimensioned copy's wall-ink reading gave 4 bodies at 71.3 m², also `DEGENERATE_GEOMETRY`.
- **The source checklist.** No item holds:
  - the package has floor plans (GROUND and UPPER, labelled);
  - the ground copy's walls are 12 px on 853 px;
  - OCR tokens are up to 48 px tall;
  - no floor-plan asset is lost.
- **Diagnosis, after the verdict, with nothing patched.** The scale is right: 2.681 cm/px, from 6 anchors
  including 15.00 m over 559.5 px, and agreeing with the printed 800 and 700. The first bad decision is the
  plan's **depth**.
  1. The overall vertical chain in the left margin was never read. It prints 245 / 920 / 245 = 1410.
  2. Its rotated labels came back as "0111", "036", "502" and "535": the upside-down readings of 1410, 920 and
     245, again.
  3. With no overall chain on that axis, the Y extent was taken from a short interior chain at y = 355–449.5 px,
     about 2.5 m. It was marked **not weak**.
  4. The grid on that axis has 5 lines inside that strip. Of 52 cells, 2 enclose: 0.55 m².

## The common defect, named for the next stage

In both houses the overall vertical chain carries the building's full depth, and its rotated labels were read
the wrong way up. Those labels are 900 on #1, and 1410, 920 and 245 on #2.

- **The strings.** They are exactly what the digit templates give for the ink turned 180°: `900 → 006`,
  `1410 → 0111`, `920 → 036`.
- **The likely place.** The page-wide orientation vote in `packages/source-metrics/src/ocr.ts`
  (`dedupeOrientations`: "a sheet turns its vertical text one way, not both"). The sealed tokens do not record
  their orientation, so this is **not measured**, only consistent with every string.
- **Downstream.** Two further decisions turned the misreading into a wrong house:
  - on #1, the chain solver's digit correction, which fits a misreading to a scale the misreading then votes
    for;
  - on #2, an interior chain accepted as the plan extent without being marked weak.

Nothing in this stage touched those three places. Per the protocol they are **not patched here**: both
families now join the development set (T5), and a fix is the next stage's work, held to every house.

## Files, per house

| file | what |
| --- | --- |
| `verdict.json` | `holdout/verdict.mjs` output |
| `source-package.json` | the package: addresses, hashes, the publisher's text facts, the failures |
| `analysis-trace.json`, `failure.json`, `diagnostics.json` | the typed stop and its diagnostics |
| `plan-diagnostics/digest.json` | the plan reads: bands, chains, lines, masses, the resolver's summary |
| `metric-evidence.json`, `observation-graph.json` | the numbers `verdict.mjs` reads (OCR tokens, frames) |
| `performance.json`, `telemetry.ndjson`, `measure.json` | the progress record, the event stream, wall and peak RSS |
