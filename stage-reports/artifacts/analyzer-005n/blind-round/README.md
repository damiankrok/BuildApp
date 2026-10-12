# 005N blind round 10 — draw, runs, sealed verdicts, diagnosis

The protocol is `holdout/README.md` § Round 10, fixed before the freeze. Supporting files in this folder:

- the exclusion manifest: `exclusion-manifest.json`;
- the garage-stratum calibration: `garage-calibration.json`.

## Freeze

- `PRE_HOLDOUT_10_SHA = d7873977aac89d6283e41f94ec1942b570adceaf`.
- That commit's CI run 38297543325 was green on attempt 1: 39 jobs pass, 2 skipped by design.
- Nothing was committed between the freeze and the draw. After the freeze the only commits are the ledger line, these records and the stage report. No production code has changed.

## Draw — 2026-10-12T19:57:12Z, ledger line `BUILDPLAN-005N-COMPOUND-FACADE-HOLDOUT`

- **Seed:** `SHA256(d7873977… + "BUILDPLAN-005N-COMPOUND-FACADE-HOLDOUT")` =
  `c2e1de895ae33dc3434e6c1027eaf488f41aeb5912c72ded1b214e9cf1c4c8cd`. I recomputed it independently with `sha256sum`.
- **Pool:** `800c2a1e…2ed41`. 1580 addresses are drawable and 1505 excluded.
- **Exclusions:** `excluded-families-round-10.txt`, SHA-256 `83d2aa04…c446`. Neither drawn family appears in it or anywhere in the repository's text.
- **Holdout 1, garage stratified:** k = 0, so the first candidate was eligible and none was burned.
  - `dom-w-glogownikach` (`https://www.archon.pl/projekty-domow/projekt-dom-w-glogownikach-g-ma772868ccf62c`).
  - Its page states a garage of 28.58 m². Only that figure of its markup was read.
- **Holdout 2, unstratified:** i1 = 137 → `dom-w-akebiach` (`https://www.archon.pl/projekty-domow/projekt-dom-w-akebiach-5-m44320b977e1a7`).

## Runs

Each address ran **once**, live, with the frozen code, one after the other, with nothing else running:

`ANALYZER_EVIDENCE=1 TELEMETRY=1 npx vite-node packages/analysis-service/scripts/second-house.ts -- --url <address> --cache <scratch> --out <scratch> --recogniser`

The external numeric recogniser was on, and so was the Evidence Pack (version 1.4.0, with `12c-compound-facades.json`). The 005K drawn-gap rule was never passed, so it was OFF.

| # | started (UTC) | wall | peak RSS | longest telemetry gap | outcome | pack |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `dom-w-glogownikach` | 19:57:26 | 207 s | 965 MB | 2.3 s | `RECONSTRUCTION_FAILED / PLAN_RESOLUTION_INCONCLUSIVE` | 37 files, 586 decisions |
| 2 `dom-w-akebiach` | 20:01:00 | 279 s | 1002 MB | 2.6 s | `RECONSTRUCTION_FAILED / PLAN_LAYOUT_REJECTED` | 37 files, 567 decisions |

What is committed of each pack: its JSON layers, `README.md` and `manifest.json` (numbers and ids, under `evidence/`). The analyzer's SVG layers and plan overlay stay outside the repository; each one's SHA-256 is in its `manifest.json`.

## Verdicts (`holdout/verdict.mjs`, as frozen) — sealed 20:05:53Z, before any diagnosis

| # | verdict | why | `verdict-*.json` SHA-256 (as printed, before the scratch path was redacted) |
| --- | --- | --- | --- |
| 1 `dom-w-glogownikach` | **ALGORITHMIC_FAIL** | a typed refusal: no model | `0857bf82…b136546` |
| 2 `dom-w-akebiach` | **ALGORITHMIC_FAIL** | a typed refusal: no model | `fd9079b6…4b270d9` |

Neither house meets a SOURCE_LIMITED_PARTIAL condition:

| # | floor plans | OCR tokens on the ground copies | tallest token | walls |
| --- | --- | --- | --- | --- |
| 1 | present | 162 | 242 px | 14.5 px |
| 2 | present | 189 | 49 px | 16 px |

**005N has a fresh ALGORITHMIC_FAIL, so the stage is PARTIAL** (brief §38).

## Diagnosis (brief §39) — read from the sealed Evidence Packs and plan diagnostics after the seal

Nothing was changed, re-scored or re-run as a verdict. The plan overlays were looked at locally, outside the repository.

### #1 `dom-w-glogownikach`: FIRST_BAD_DECISION = METRIC

The plan is a 19.30 × 9.20 m rectangle. The garage sits inside it at the right end. The front facade is flush: three windows, the entrance door (170/210) and the garage door (300/225). There is no recess.

1. **The selected scale is right.** It is 2.629 cm/px (`09-scale-hypotheses.json`): 541 cm over 206 px, corroborated on both axes. The printed 1930 overall over about 717 px gives about 2.69.
2. **The cause is two misreads.** The recogniser read the 541 label as **501** and the 870 label as **810**. Read on their own lines, the two misreads agree on a second scale, 2.432 cm/px (501/206 px, 810/333 px).
3. **The resolver refuses.** It found that scale contradicted by the drawing: 56 % of the stated chain length is contradicted, against 79 % for the other reading. No second printed dimension states either scale, and the published footprint verifies neither reading (−20.7 % and −8.0 %). So it refused with `PLAN_RESOLUTION_INCONCLUSIVE`, a SOURCE_CONFLICT. Withholding a model here is the correct, safe outcome.
4. **The compound reader played no part.** It read one facade gap: the rear wall's two 270/230 terrace doors, 5.70 m in all. It refused the 11 px block between them as a separator (a POST, no wall behind it). The incumbent then decided the gap an opening, glazing across 100 % of it plus a 542 cm callout. That is correct.

### #2 `dom-w-akebiach`: FIRST_BAD_DECISION = EXTENT

The plan is an L/T house, 19.90 × 16.45 m overall.

- **Central zone:** living room, kitchen, hall and entrance.
- **Two wings:** bedrooms on the right, utility rooms on the left.
- **Rear projection:** the living room projects 0.97 m beyond the wings at the rear, and its back wall is a 4.00 m terrace door.
- **Garage:** a double garage projects 3.01 m forward at the front-left, with a 485/220 door.
- **Entrance:** the door (140/220) sits in the main body's front, in the inside corner beside the garage's side wall.

How the plan was lost:

1. **The walled envelope stops short on both sides the chains state.** It is y 227–656 px. At the rear it stops at the wings' back walls, because the living room's projection has no long band: its back wall is one 4 m door. At the front it stops at the main body's front, leaving out the garage projection.
2. **005F's extent-conflict completions are refused.** On the N side the chains state 0.96 m past the box, on the S side 4.30 m. Both completions fail the attached-room guards, so nothing is built there.
3. **The house core floods.** On the envelope's rear side, the 6.86 m mouth into the living room's projection lies between the wings' back walls. The compound reader read that gap and correctly left it whole: no wall-thick ink inside. The incumbent read it as OPEN_SIDE (28 % drawn across). The pocket test then allows a 6.86 m mouth 117.6 m², so the 67.5 m² core behind it reads as a pocket.
4. **Everything else follows.** The core and the garage stay OUTSIDE, and the ground storey covers 96.9 m² of the 249.42 m² printed. The resolver weighed 63 readings and none survived (`PLAN_LAYOUT_REJECTED`).

The first decision that broke the plan is the envelope and extent, before any body relation or compound decision. It is not a PLAN_RESOLUTION refusal: that came last.

### TARGET_CLASS_EXERCISED = NO

Neither house has a compound facade relation of the kind 005N targets, a recessed entrance beside another mouth on one facade line:

- #1's front is flush.
- #2's entrance sits in the inside corner beside a projecting garage. The entrance and the garage door are not on one facade line.

The reader ran on both houses and read 5 facade gaps in all, cutting none. It correctly refused #1's mullion block, and correctly left #2's projection mouth whole. Both failures come before any compound decision.

This round is valid whole-house evidence: two fresh failures, METRIC and EXTENT. It is **not** evidence that the target topology generalizes, and the stage does not claim it is.
