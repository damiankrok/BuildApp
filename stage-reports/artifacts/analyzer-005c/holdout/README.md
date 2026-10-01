# Blind holdout round 3 — draw, runs and verdicts (005C)

The protocol is `holdout/README.md` (Round 3). This directory seals what the draw produced, as text facts only. No
drawing, overlay or render of a drawing is committed. The raw plans and the diagnostic overlays were looked at
locally, for the diagnosis and the source-limited check below, and stay outside the repository.

## Draw

- **PRE_HOLDOUT_3_SHA** `e328121b3aca2dfcec87db07db6277813eb04f34`.
  - Pushed to `analyzer/opening-aware-envelope-v1` and `claude/new-session-3kzcgh` before the draw. CI run 116
    (`36800959593`) on it: every job green, the Android UI evidence gate on its second attempt (the first failed on
    a Compose test-harness race, `Detected multithreaded access to SnapshotStateObserver`, in the Kosaćce slice's
    stage sheet, and then a 45 s renderer wait at the next test's launch; re-run once, green; the report's §AC).
  - The tree was clean, and nothing was committed between the freeze (CI green 02:48:17Z) and the draw
    (02:49:03Z).
- **The ledger** (`holdout/LEDGER.ndjson`, the line labelled `BUILDPLAN-005C-BLIND-HOLDOUT-ROUND-3`):

| | ARCHON | DobreDomy |
| --- | --- | --- |
| label | `BUILDPLAN-005C-ARCHON-HOLDOUT` | `BUILDPLAN-005C-DOBREDOMY-HOLDOUT` |
| pool sha256 | `800c2a1e…2ed41` | `42762070…8c5` |
| exclusions | `excluded-families-round-3.txt`, `330e7832…cf` | `excluded-families-dobredomy.txt`, `3122f477…4730` |
| seed | `7b4344ee19b52b20d0373935f7cae7fb12ff7803c128c462b6b81f570237a147` | `fc19c52c3b4780af5422cdf91126e74140b87c5cbf9bb8a017ee60b68805ce8b` |
| n / excluded | 2502 / 583 | 697 / 203 |
| i1 | 375 | 262 (eligible at the first draw: a plan heading and an elevation heading, each with an image) |
| address | `https://www.archon.pl/projekty-domow/projekt-dom-w-azaliach-3-ma6726144fab3e` | `https://www.dobredomy.pl/projekt/galaktykaI/` |
| family | `dom-w-azaliach` | `galaktyka` |

- **Recomputed independently.** `SHA256(PRE_HOLDOUT_3_SHA + label)` gives both seeds, and `seed mod n` gives
  375 and 262. Neither family is in any exclusion file of any round.

## Runs

Each address ran **once**, live, with the frozen code, one after the other: `analysis:second-house --url <address>
--cache <scratch> --out <scratch>` with `TELEMETRY=1`, which is production `runAnalysis`. Cache and output stayed
outside the repository.

| # | started (UTC) | wall | peak RSS | longest telemetry gap | longest tick gap (phase) |
| --- | --- | --- | --- | --- | --- |
| 1 | 02:49:15 | 280.0 s | 736 MB | 2.5 s | 2.4 s (`ACQUIRE_ASSETS`, network) |
| 2 | 02:54:01 | 140.5 s | 778 MB | 5.7 s | 4.8 s (`METRIC_FRAMES`, a 1625 × 1700 px plan) |

- **#1 acquisition** (ARCHON adapter): 21 assets, 8 floor-plan copies (GROUND and ATTIC, dimensioned and
  area-table), 9 published figures (footprint 69.69 m²); 14 failures, all guessed larger variants (HTTP 404) or
  byte-identical copies; no floor-plan asset lost.
- **#2 acquisition** (generic reader 1.2.0, no specialist for the host): 17 assets with roles (one GROUND and one
  ATTIC plan, a site plan, elevations, renders), **11 published figures** read from the page's own rows (usable area
  135.1 m², footprint 145.1 m², garage 23.2 m², height 8.9 m, pitch 42°, sloped roof 250.9 m², volume 496.9 m³,
  rooms 4, bathrooms 2, minimum plot 22.38 × 19.68 m), **4 documents** (the outline as PDF base, PDF mirrored and
  DWG — fetched, signature-checked and hashed, never parsed — and the energy certificate, recorded).

## Verdicts (`holdout/verdict.mjs`, unchanged)

### #1 `dom-w-azaliach` — ALGORITHMIC_FAIL

Completed: 1 body, 6 openings, model `2cfcc6e9…`. Footprint 67.26 m² against 69.69 (−3.48 %, holds); every printed
opening built (holds). Fails on two conditions:

- **storeys**: 1 of 2 (the attic plan registers onto no body: `LAYOUT_NO_MASS_REACHES_UP`);
- **resolved with a witness**: the plan was resolved by hypothesis (`LAYOUT_PLAN_RESOLVED_BY_HYPOTHESIS`) — copy
  area-table, wall-ink extent, scale 1.897 cm/px — and the chosen reading carries no corroboration but the
  published figure (`LAYOUT_SCALE_DISAGREEMENT`, `METRIC_SCALE_WEAK`).

**The first bad evidence decision** (in the metric layer, which 005C did not touch: no file under
`packages/source-metrics`, `source-cv` or `source-analyzer` differs from `d3235bf`). On the dimensioned ground copy
the first reading selected (`frame-asset-rzut-86bef468f3-19006df9bc`, 853 × 853 px):

1. The overall horizontal chain under the plan (baseline 645.5 px) is read with a third tick at x = 204.5 px, where
   no dimension tick is drawn; its true ticks are 77 and 633.
2. Its label, printed `1035` in italics (shear −10°), is read `1055` (third glyph `5` at 0.46, its runner-up `3` at
   0.33; token confidence 0.56) and attached to the segment 204.5–633 px (428.5 px), so the sheet scale is
   2.46 cm/px. The drawing's own two overall dimensions agree on 1.86 cm/px: 1035 over 556 px and 670 over 359.5 px.
3. The vertical overall chain (x = 24, 159.5–519 px) then reads nothing — "no number on this chain could be
   reconciled with the sheet scale" — and the plan extent becomes the chains' own span (204.5–633.5 × 172.5–375 px),
   a third of the house. The long-band box inside it holds no enclosed cell: `PLAN_NO_ENCLOSED_CELLS`.

The resolver then found the house on the area-table copy at a scale departure (1.897 cm/px), 3.5 % under the
published figure — the figure chose it, so by rule it is no witness. On that reading the 005C outline did what it was
built for: the box held 23.95 m² (the service rooms), the opening-aware outline continued the interior across the
glazed living-room side (a `PROJECTING_WING` by relation, 43.31 m²) and stopped at the pergola terrace beside it, which
is not built. Not patched (protocol); the family joins the development set.

### #2 `galaktykaI` — SOURCE_LIMITED_PARTIAL

Stopped by name: `METRIC_RESOLUTION_INCONCLUSIVE` in `REGISTERING_VIEWS` — "the floor plan's scale cannot be
established … What is missing: a dimension printed on the floor plan itself — it prints none."

**The checklist item, measured on the raw copy.** The package has one ground-floor copy (`galaktykaI_r1.jpg`,
1625 × 1700 px). Looked at whole and at full resolution in its four margins: it prints room names and room areas
(`29,7 m²`, `11,8 m²`, `garaż 23,2 m²` …), furniture and the terrace outline, and **no dimension at all** — no
dimension line, no tick, no overall figure. The metric layer finds 0 dimension chains on it; its 439 OCR candidates in
four orientations (145 kept by the page vote; `verdict.mjs` counts 32, the tallest 40 px) lie on room labels, area figures, hatching and furniture. So "no ground-floor copy prints an
overall dimension with glyphs 10 px tall or more" holds, and with the typed stop the verdict is
**SOURCE_LIMITED_PARTIAL** (`verdict.mjs` alone says ALGORITHMIC_FAIL, because it can only nominate legibility from
OCR heights and the room areas are tall). The publisher's scale lives in the outline PDF and DWG, which are recorded
and hashed, not parsed (no document reader in scope). The house's footprint is 145.1 m² as published; nothing was
built.

## Files

Per run: `source-package.json`, `observation-graph.json`, `metric-evidence.json`, `analysis-trace.json`,
`performance.json`, `telemetry.ndjson`, `plan-diagnostics/digest.json`, `verdict.json`; #1 also `model.json`,
`result-summary.json`, `source-hashes.json`; #2 `failure.json`, `diagnostics.json`. No image.
