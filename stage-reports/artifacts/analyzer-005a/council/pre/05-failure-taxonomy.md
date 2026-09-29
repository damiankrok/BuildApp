# 05 — Failure taxonomy (Council A, B, C, E, F; OWNER phone cases re-classified)

Classes: **SOURCE** (the publisher does not provide it), **RUNTIME** (the device or network lost it),
**ALGORITHM** (an assumption in our code made it fail), **UNIMPLEMENTED** (a semantic we do not
have), **POLICY** (we refuse on purpose).

## 1. The OWNER's reported failures, re-classified with evidence

| Case | Reported as | Actual first cause | Class | Evidence |
| --- | --- | --- | --- | --- |
| Kosaćce tracked, phone | `PLAN_LAYOUT_REJECTED / FOOTPRINT_AREA_WRONG` 33.15 vs 164.47 m² | three of the four ground-plan copies were not available on the phone (`planFrames 1`); the remaining 853 px area-table copy was read as if it were the dimensioned sheet; on it the largest-first merge swallowed a covered terrace, the 0.35 wall cliff dropped the whole 149 m² body, and the gate refused the rest | RUNTIME (plan copies lost; cause not observable from the phone report) → ALGORITHM (one copy per storey; merge; terminal gate) | `before/kosacce-plan-copy-replays/`: area copy alone reproduces every number; the tracked URL on the desktop gives the clean model `5b5ffcf1…` |
| Kosaćce tracked vs clean | "URL variant" | the tracking query changes the package id / content hash and every downstream hash except model and scene; not the evidence | ALGORITHM (identity = URL spelling) | `before/kosacce-{clean,tracked}/result-summary.json` |
| Rarytasy e-OZE, phone | `PLAN_NO_WALLED_ENVELOPE`, grid 3×2 | again only the area-table copy (`planFrames 1`) | RUNTIME → ALGORITHM | `before/rarytasy-eoze-plan-copy-replays/only-area` reproduces every number |
| Rarytasy e-OZE, desktop (all copies) | `PLAN_NO_WALLED_ENVELOPE`, grid 15×2 | (1) the OCR orientation vote is page-level and a 19-glyph junk token flips it, discarding the correctly read rotated "760" (B); (2) the frame scale vote picks 2.5014 through a multiplicative corroboration bonus, and the outer "1601" (printed 1600) is rewritten to "1801" to fit it (B); (3) the plan extent is the longest READ chain on each axis — a 68 px interior chain — and the walls' vote cannot overrule it because its window is derived from that chain (B, C); (4) band-only boundary lines sit on wall axes, not faces (C) | ALGORITHM ×4 | `before/rarytasy-eoze/`; Council B counterfactual: with the correct turn the unchanged pipeline reads 2.2235 cm/px and a 720×342 extent |
| alternate Marcówki (generic publisher) | `PLAN_LAYOUT_REJECTED` 19.56 vs 131.16 m² | only 550 px thumbnails published; on them scale and extent are unreliable (B: every sub-853 copy gets a wrong scale) | SOURCE (low resolution) + ALGORITHM (small-copy reading) | `before/alt-marcowki/` |
| Marcówki "z ograniczeniami" | 2 unresolved + 4 warnings | see `../../marcowki-limitations-audit.md`: 3 informational warnings shown as limitations (UNIMPLEMENTED warning severity), 1 resolvable roof gap, 2 genuine uncertainties | mixed | |
| 63 % for minutes | "stuck?" | a 164–193 s synchronous metric pass with no event | UNIMPLEMENTED (telemetry) | `07-performance-progress-audit.md` |

## 2. Code-level taxonomy

| Code | Class | Stays / changes |
| --- | --- | --- |
| `INVALID_URL`, `SOURCE_UNSAFE`, `SOURCE_REFUSED` | POLICY | stays |
| `SOURCE_UNREACHABLE` | RUNTIME / SOURCE | stays; a user abort must no longer be recorded as a fetch `TIMEOUT` |
| `SOURCE_NOT_PROJECT`, `SOURCE_REQUIRES_RENDERING`, `NO_DRAWINGS`, `SOURCE_INCOMPLETE` | SOURCE | stays |
| fetch `HTTP_STATUS` on a resolution-convention guess | not a failure (evidence that no larger copy exists) | counted separately from exposed-asset failures |
| fetch `TIMEOUT`/`NETWORK`/5xx on an exposed asset | RUNTIME | one bounded retry; counted per claimed document role |
| `NETWORK` from a failed cache write | RUNTIME (storage) misattributed | its own code |
| `gap-undecodable` / analyze decode failure | RUNTIME (memory) or UNIMPLEMENTED (WebP) — conflated | counted by cause |
| `TEXT_NOT_SUPPORTED_ON_DEVICE` | RUNTIME caused by ALGORITHM (free-text `localeCompare`) | remove the cause upstream |
| `PLAN_NOT_FOUND`, `PLAN_NOT_DECODABLE`, `PLAN_NO_WALL_BANDS` on every copy | SOURCE | terminal (no candidate can be generated) |
| `PLAN_NO_DIMENSION_FRAME`, `PLAN_NO_WALLED_ENVELOPE`, `PLAN_GRID_EMPTY`, `PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS`, `PLAN_NO_MASSES`, `PLAN_LAYOUT_REJECTED` | ALGORITHM (single hypothesis) | per-candidate reasons; the run-level code becomes `PLAN_RESOLUTION_INCONCLUSIVE` when alternatives were attempted and all failed |
| **`PLAN_RESOLUTION_INCONCLUSIVE`** (new) | the honest outcome after bounded alternatives | carries attempted, best score, hard violations, strongest conflicts, missing evidence (incl. lost plan copies) |
| `PLAN_STOREY_ALIGNMENT_*`, `VIEW_REGISTRATION_*`, `ELEVATION_/SECTION_REGISTRATION_FAILED` | ALGORITHM (degrades today) | unchanged in 005A |
| `MODEL_EMISSION_FAILED` | ALGORITHM (emitter) — outside three opening codes any refused command aborts the run and discards the valid prefix (F) | the resolver may meet it on a candidate: keep the run's candidate list alive (fall back to the next accepted candidate) and carry the valid prefix ids in diagnostics; generalised drop-with-reason is next-stage debt |
| `SCENE_COMPILE_FAILED`, `VERIFY_*` | ALGORITHM | stays hard |
| `CANCELLED`, `TIMEOUT` | user / policy | honoured at checkpoints inside long loops, not only between stages |
