# v3.54.4: hand-off (final state; text only; no key, no publisher image)

Report: `stage-reports/SOURCE_TO_MODEL_V3544.md`. OWNER index: `stage-reports/README_V3544.md`.
Protocol and seal: `stage-reports/artifacts/v3544/PROTOCOL_V3544.md`, `PROTOCOL.seal`.

## Base and state
- Base commit: `0d4a057ff1ffe5dec07dd04e543ed39a308c4ee1` (delivery of v3.54.3). Branch `claude/new-session-3kzcgh`, no merge, no PR.
- Frozen code commit of the confirmation: `3c531aee…` (sealed in `PROTOCOL.seal`); first result kept in `ee89085`.
- After the confirmation one change was made to the reader (a single follow-up request for elevation pictures that were
  sent and not described, `readFacades`, recorded as `FACADES` round 1). It was tried on three confirmation houses as a
  post-confirmation trial and is NOT confirmed on new houses.
- Statuses: IMPLEMENTATION_COMPLETE; BUILDER_VERIFIED_IN_SCOPE; HOST_INTEGRATION_VERIFIED (local); QUALITY_GAIN on DEV;
  TRANSFER_EVIDENCE by the frozen criterion (improved 5/8, 4 publishers, 0 critical regressions; faithful 1/8);
  ANDROID NOT_VERIFIED (no APK, app unchanged).

## Books
- Books directory: `/home/user/rd/v3542/books` (continued, never reset). Ledger in Git: `research/ai-assist/spend-ledger-v3544.json`.
- Start 9.963222 USD; now 14.453496 USD of the 24.11036 USD ceiling; remaining 9.656864 USD.
- This campaign: 4.490274 USD, 95 requests (smoke 0.311212/5, dev 1.508186/36, host-e2e 0.673052/12, confirm 1.563904/34,
  post-confirm 0.433920/8). No open reservation.
- Key: environment secret read from `/root/.config/buildplan/campaign-key` into `BUILDPLAN_ANTHROPIC_API_KEY` for one
  command at a time; never printed, never in Git, ZIP or logs.

## Where things are
- Document, resolver, builder: `packages/reconstruction/src/house/{document,resolve,program,poly}.ts`.
- Reading, conversion, decision, review, kernel build loop, scene measure, host path:
  `packages/analysis-service/src/house/{read,pictures,describe,review,build,measure,link}.ts`.
- Host: `apps/analyzer-api/src/{executor,wiring,store,http}.ts` (`ANALYZER_HOUSE_DESCRIPTION=pilot`, `/v1/analyses/:id/house`).
- LOCAL fix: `packages/reconstruction/src/v2/roof-datum.ts` (`levelDatumsAbovePublishedHeight`), solver 2.45.0.
- Tests: `packages/analysis-service/test/house-v3544.test.ts` (25).
- Private work (outside Git): `/home/user/rd/v3544/` — `M/` manual builds, `H1` DEV live answers (replay root), `H6` latest
  DEV replay, `CONFIRM/` frozen confirmation, `POST/` post-confirmation trial, `boards/`, `host*/`, `report/`.

## Commands
- Build a house from a document (no network): `npx tsx research/source-to-model/v3544/build-house.ts --doc <house.json> --out <dir>`.
- Run the described path on a list of source packages:
  `npx tsx research/source-to-model/v3544/house-run.ts --list <file> --out <dir> --phase <name> --max-usd <n> [--local <dir>] [--replay <dir>] [--no-review] [--plan-only]`.
  `--replay <dir>` uses saved answers and spends nothing; a changed picture list is refused (STALE_DEPENDENCY).
- Score against references: `npx tsx research/source-to-model/v3544/score.ts --list <file> --refs <dir> --h <runs dir> --local <dir> --out <json>`.
- Tables: `/usr/bin/python3 -I research/source-to-model/v3544/tables.py {houses|proposals|transfer} …`; boards: `make-boards.sh`.
- Host E2E (local, paid with a key, free without): `node research/source-to-model/v3544/host-e2e.mjs --out <dir> --data <host data dir> --max-usd <cumulative ceiling>`.

## Open, in order of value
1. Confirm the follow-up request for missing elevations on eight NEW families (est. 1.6–2 USD).
2. Level marks of the section as a fact in the decision against LOCAL (Oslo: LOCAL 17 m tall was kept because no height is published).
3. Shed and box dormers, sloped canopies in the builder (CAPABILITY_MISSING today).
4. Plans without printed dimensions (Abakus, Pallas, 51853hz): scale stays ESTIMATED or there is no geometry.
5. Front elevation registration when the plan is drawn rotated (Frizea).
6. Show the house document and the decision in the Android app (needs a new APK).
