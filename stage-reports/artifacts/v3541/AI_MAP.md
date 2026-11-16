# v3.54.1 — where the AI reader enters, what it gives, who consumes it

State at the frozen candidate (protocol addendum 2). Everything below is in the repository; nothing here is a plan.

## 1. When the reader is reached at all

| Place | Condition | Default |
|---|---|---|
| Host `apps/analyzer-api` (`wiring.ts` `houseReaderPlan`) | `ANALYZER_HOUSE_READER=live`, a cumulative ceiling `ANALYZER_HOUSE_READER_MAX_USD`, a pilot token `ANALYZER_HOUSE_READER_TOKEN` (≥ 24 chars), models with a known list price | off |
| Job (`executor.ts` `executeJob`) | the submission presented the pilot token (`describe: true`, `http.ts` `pilotAccess`) | drawings only |
| Every request (`house-reader-spend.ts` `spendGuardedStructuredVision`) | reservation fits under the cumulative ceiling and the day's counts; pictures/bytes/question within limits | — |
| Complete drawings model (`analyse-link.ts`, v3.54.1) | `ANALYZER_HOUSE_READER_EVERY_MODEL=on` → `readEveryModel` | off: a complete drawings model is not read |
| Phone (`apps/local-analyzer`, Android) | never: the phone runs LOCAL only and holds no key | — |

The provider key is read on the host by the SDK (`ANTHROPIC_API_KEY` there); no endpoint returns it, no client holds it.
The research campaign used the same adapter with an explicit key variable (`BUILDPLAN_ANTHROPIC_API_KEY`) and host.

## 2. Inputs (what is sent)

| Request | Model (default) | Pictures | Text | Answer held to |
|---|---|---|---|---|
| `HOUSE_TRIAGE` (`described.ts` `readHouse`) | claude-haiku-5-5 | every decodable page picture ≥ 120 px, 320 px JPEG, up to 40 a request | vocabulary of picture kinds | strict output format (`output_config.format` json_schema) |
| `HOUSE_DESCRIPTION` | claude-sonnet-5-5, effort medium | chosen by kind: ≤ 4 plans, 6 elevations, 1 section, 1 site plan, 4 exterior views; ≤ 1568 px (exterior 1100) | the description prompt + the page's published figures (no URL, no file name, no role) | one non-strict answer tool `record_answer` (v3.54.1: the strict format is refused by the API — compiled grammar too large); admission by the checker |

Every request is keyed (`structuredVisionKey`: reader version 0.3.0, purpose, system, text, schema, picture bytes);
a recorded answer replays only for the exact question and bytes.

## 3. Outputs (what comes back)

`HouseDescription` (source-vision, admission 0.2.1): frame (plan picture, front edge), overall size with its basis
(PRINTED_ON_DRAWING / SCALED_FROM_DRAWING / PUBLISHED_ON_PAGE / ESTIMATED) and the printed labels, storey and ridge
heights, bodies (rectangles in metres, role, storeys, roof kind/pitch/ridge), openings per side, dormers, rooflights,
chimneys, balconies, terraces, canopies, broad colours, sides no picture shows, unknowns, a picture inventory.

Admission (`checkHouseDescription`): shape, consistency, agreement with published figures. REJECT refuses the whole
description (e.g. BODIES_COINCIDE); WARN is carried. v3.54.1: a colour not stated as hex and a malformed inventory entry
are the item's loss, named (PALETTE_COLOUR_NOT_STATED / _INVALID_DROPPED, IMAGE_ENTRY_INVALID_DROPPED).

## 4. Consumers (who uses it, in order)

1. `analyseLink` (analysis-service) — decides whether a description is asked: after a describable refusal; after a weak
   drawings model (`drawingsWeaknesses`); v3.54.1 with `readEveryModel` after a complete one too, where
   `descriptionExceedsDrawings` decides DESCRIPTION_PREFERRED / DRAWINGS_KEPT (stated in `descriptionCheck`).
2. `anchorsOfDrawings` → `DescribedAnchors` — the only local→AI channel: whole outline (chain-framed or complete walls),
   bodies at a verified scale, storey height (v3.54.1: floor to floor only).
3. `buildingFromHouseDescription` (reconstruction, builder 0.8.0) — bodies, roofs, openings, features into `BuildingV2`;
   size: a whole-shape scale to the drawings, v3.54.1 per axis from complete walls (`perAxisFromWalls`), else published
   figures; every change a typed adjustment.
4. `emitBuilding` → `compileBuilding` → `buildMobileSceneBundle` — the same emitter, validator and compiler as the
   drawings' path; the result is the drawings' contract (`describedResult`), served to the app by the host.

Nothing from the reader enters the drawings' path itself (outline, metric, openings of LOCAL). The arbitration is
between whole candidates plus the size anchors above; a per-property merge of outline polygons is not implemented.

## 5. Research-only (not reached by the product)

`research/source-to-model/v3541/`: live runner and recorder, ledger, crops variant C (`crops.ts`, transforms with
rotation/mirror), H0/H1 runners, scorers. C is not adopted.
