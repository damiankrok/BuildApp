# 005Q blind round 12 — draw, runs, sealed verdicts, diagnosis

The protocol is `holdout/README.md` § Round 12, fixed before the freeze (committed in `7eddd7b`, the freeze itself).
The exclusion manifest is `exclusion-manifest.json` (re-swept as the last step before the freeze, the stage report and
`PROJECT_STATUS.md` included; one family more than the first sweep, named by a review text).

## Freeze

- `PRE_HOLDOUT_12_SHA = 7eddd7bff5738924a07cc91daef68a560479f2c7` (pushed to the stage branch and its mirror).
- Its CI run 38514679088 (https://github.com/damiankrok/BuildApp/actions/runs/38514679088): attempt 1 — 38 jobs pass,
  2 skipped by design (the two APK publishing jobs), **1 failed: the Android UI evidence gate** (a Compose UI-test
  race, `SnapshotStateObserver` multithreaded access in `VerticalSliceDeviceTest`; all 77 screenshots valid). The stage
  touches no Android, app or workflow file (`production-diff-manifest.json`), and the same gate failed with a different
  Compose symptom (the 1.3× font journey's 5 s timeout) on the commit before, which changed only the preregistration
  text — the class 005P recorded. One re-run of the failed job: **attempt 2 green — 39 jobs pass, 2 skipped by design.**
- Reviews closed before the freeze (round 1: 0 P0 / 0 P1; round 2: 0 P0 / 2 P1, both fixed in the records).
- Nothing was committed between the freeze and the draw. After it: the ledger line and the sealed verdicts with the
  Evidence Pack JSON layers (`a673849`), then these records and the stage report. No production code changed.

## Draw — 2026-10-14T06:38:12Z, ledger line `BUILDPLAN-005Q-EXTERIOR-BOUNDARY-HOLDOUT`

- **Seed:** `SHA256(7eddd7bf… + "BUILDPLAN-005Q-EXTERIOR-BOUNDARY-HOLDOUT")` =
  `e0df87fea22201bc840ada6331c0b062be04ba6ce6bbe7a11f6a530a78ede0ad`, recomputed independently with `sha256sum`.
- **Pool:** `800c2a1e…2ed41`; **1468 drawable**, 1617 excluded.
- **Exclusions:** `excluded-families-round-12.txt`, SHA-256 `4a82986e8995a262e9c12be864301d8653c06170be24f6600cb6b0d326f74907`
  (147 families; `dom-w-rarytasach` among them). Neither drawn family is on it, and neither is named in any committed
  text except `holdout/pool.txt` and the ledger.
- **Pick 1, unstratified:** i1 = 1269 → `dom-w-tymianku` (`https://www.archon.pl/projekty-domow/projekt-dom-w-tymianku-5-t-m82a207b1b6d72`).
- **Pick 2, unstratified:** i2 = 344 over every other family → `dom-w-daliach`
  (`https://www.archon.pl/projekty-domow/projekt-dom-w-daliach-5-ge-me3c2885945467`).

## Runs (once each, NEW then OLD, pick 1 then pick 2, nothing else running)

- **NEW** — the frozen code (layout 1.2.0), live: `ANALYZER_EVIDENCE=1 TELEMETRY=1 npx vite-node
  packages/analysis-service/scripts/second-house.ts -- --url <address> --cache <scratch> --out <scratch>/new --recogniser`.
- **OLD** — the 005Q base `04d5568`'s `packages/reconstruction/src` (`research/analyzer-005q/variant.mjs`, outside the
  repository, aliased), solver only on the NEW run's sealed package, graph and metric evidence; the NEW run's
  `observation-graph.json` copied into the OLD output directory for the verdict (round 11's note).

| # | run | started → ended (UTC) | peak RSS | longest telemetry gap | outcome |
| --- | --- | --- | --- | --- | --- |
| 1 `dom-w-tymianku` | NEW | 06:40:36 → 06:46:53 | 897 MB | 2.7 s | COMPLETED: 3 bodies, 2 storeys, 44 walls, 36 openings, model `681a3825…` |
| 1 | OLD | 06:46:53 → 06:47:09 | — | — | COMPLETED, model `681a3825…` (**byte-identical**) |
| 2 `dom-w-daliach` | NEW | 06:47:09 → 06:55:23 | 1071 MB | 5.0 s | COMPLETED: 1 body, 2 storeys, 31 walls, 17 openings, model `bd67c813…` |
| 2 | OLD | 06:55:23 → 06:55:43 | — | — | COMPLETED, model `bd67c813…` (**byte-identical**) |

Committed of each pack: its JSON layers and `README.md` (`evidence/`). SVG layers, the preview PNG, cached pages and
drawings stay outside the repository.

## Verdicts (`holdout/verdict.mjs`, as frozen) — sealed 2026-10-14T06:56:10Z, before any diagnosis

| # | NEW | OLD | sealed `verdict-*.json` SHA-256 (as printed, before the scratch path was redacted) |
| --- | --- | --- | --- |
| 1 `dom-w-tymianku` | **PASS** (2 storeys = 2 plans; footprint 131.28 vs 138.89 m², −5.48 %; first reading held) | **PASS** | new `c38621f3…`, old `17ace371…` |
| 2 `dom-w-daliach` | **PASS** (2 storeys = 2 plans; footprint 127.46 vs 126.96 m², +0.39 %; first reading held) | **PASS** | new `49d0d24f…`, old `9f52b668…` |

**No fresh ALGORITHMIC_FAIL.**

## After the seal

- **TARGET_CLASS_EXERCISED = NO.** Neither NEW run names an outer-face gap ("the outer face of the building's … wall"),
  and OLD and NEW models are byte-identical on both houses. The round is whole-house evidence that the rule does not
  disturb two fresh houses; it is not evidence that the rule generalizes.
- **House 1 (tymianku):** no terrace, no recess; nothing in the model decides the outcome against the source.
- **House 2 (daliach) — a fabricated-feature finding, identical in OLD.** The walled envelope stops at the house's front
  wall line (y 660 px of 853) while the chains state the garage's front (689.5 px): the garage projects ≈ 0.64 m and its
  front is a 275 cm door between two piers, which leaves no long band — the **PIER** family (as krasnokwiatach). The
  strip between is read as a front recess: the two garage piers become 0.85 m "returns", and **two PAVED terraces**
  (`terrace-front-0`, 8.36 × 0.64 m, over a planting strip and the entrance porch; `terrace-front-921`, 2.73 × 0.64 m,
  over the garage floor behind its door) are emitted. The wall-strip rule correctly does not fire (no wall-thick band
  lies along that strip). The footprint verdict still passes (+0.39 %). Under the round-12 protocol a fabricated terrace
  in the NEW run caps the stage at PARTIAL. First bad decision: **PIER / EXTENT** (the long-band box), not FACE.
- Nothing was patched after the draw, and the draw is not repeated.
