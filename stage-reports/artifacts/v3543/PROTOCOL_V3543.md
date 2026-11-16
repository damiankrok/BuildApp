# PROTOCOL_V3543: the full correction loop, source → analyzer → model

Written 2026-11-16 during DEV; the criteria of §4–§6 were fixed before any analyzer or API result existed for the confirmation set (§3). The seal (`PROTOCOL.seal`) is the SHA-256 of this file at the candidate freeze. Any change after sealing is an addendum below the line, with its time and reason.

## 1. Roles

- **The analyzer** builds every model and applies every change. A correction is a typed operation with its own consumer inside the analyzer; nothing writes the model's JSON.
- **The consultant (Claude API)** is asked three kinds of bounded question and answers through one tool schema:
  1. *metric* — which printed dimension bounds what (v3.54.2; unchanged);
  2. *boundary* — what the end of the plan is on a named sheet side, when the plan at a settled scale has no walled outline (`CLASSIFY_BOUNDARY`);
  3. *model check* — shown the source pictures and neutral views of the model **the analyzer just built**, what differs (`ROOF_FEATURE` and named operations without a consumer).
- It is never shown a reference, never asked to describe the house, and its answer never contains model geometry: a roof feature is four numbers in an elevation picture's own pixels, which the loop turns into shares of a wall.
- **The global house-description branch is not on this path** (`globalDescription: DISABLED` in every result).

## 2. Variants

| Variant | Code | Consultant | Changes the model |
|---|---|---|---|
| A0 | v3.54.2 head (`258a3a9`; solver 2.43.0) as recorded in `/rd/v3542/A`, `A-confirm`, `C2-final`, `D-c4` | off | — |
| A1 | the frozen v3.54.3 candidate | off | — (must equal the `local` state of the same house's C run by model hash) |
| R | the frozen candidate | reads and checks | no — proposals recorded, none applied |
| C | the frozen candidate | reads, checks, proposes | yes, through the analyzer's consumers, each kept or rolled back |

## 3. Sets

- **DEV** (results seen, code changed on them): Aksamitki, sp318422, Kukliki, Supertunie 2 E, Madera, Torenie 3, plan23-504, plan5-737, Puszek, plan63-411 — the six DEV and four confirmation houses of v3.54.2; all are DEV here. DEV roof references: `research/source-to-model/v3543/refs-dev/roof-features-dev.json` (written by the operator who also wrote the code — DEV, not evidence of transfer).
- **CONFIRM8** (8 new families, 4 publishers, 6 non-ARCHON): `research/source-to-model/v3543/sources/INDEX.json`, references `refs-confirm/*.json` with `refs-confirm.sha256`.
  - Chosen and read by a separate reader that ran no analyzer on them and saw no analyzer output; committed in `d17652d` before any run.
  - Categories as the reader recorded them — R (a dormer on an elevation drawing): majeranku-2-g2, 39035st, gracja-i-mala-ii, 22192sl; B (printed overall dimensions with a trap): lille, 22192sl, zaglikach-g, majeranku, gracja, haga; N (hard negatives: no dormer, with a lookalike): delta, haga, lille, zaglikach.
  - Known limits of the set, recorded before results: 39035st and delta print no overall dimension (size has `NO_REFERENCE`); 22192sl has no front elevation drawing (its two front dormers are referenced from a render and are outside what the loop may place — a dormer is placed from an orthographic elevation only); ARCHON and dobredomy "elevations" are rendered orthographic pictures.
- **Host**: three jobs through `POST /v1/analyses` of the built server (§7).

## 4. Scorers (frozen)

| Scorer | Version | Reads | Self-test |
|---|---|---|---|
| `v3542/score.py` | 3542 (unchanged) | size class, fixed-frame IoU, ridge — DEV houses with v3.54.1 references | `--selftest` |
| `v3543/roof_features.py` | 3543.1 | dormers by side and share interval; wings, rooflights and chimneys counted, never matched as dormers | `--selftest` (14 checks) |
| `v3543/confirm_score.py` | 3543.1 | per house: size against printed overall dimensions, dormers, what the loop did | `--selftest` (8 checks) |

## 5. Criteria and tolerances

Every number below has one meaning and one place of use. "Frozen" is the date after which it was not changed.

| Criterion | Value | What it means | Where | Frozen |
|---|---|---|---|---|
| Size class | OK ≤ 3 %, NEAR ≤ 10 %, WRONG above, worse axis | model bounding box vs printed overall dimension | scorers | v3.54.1 (unchanged) |
| Dormer match | same side, interval IoU ≥ 0.3 | a model dormer answers a reference dormer | `roof_features.py` | 2026-11-16, before C1 |
| Outline tolerance | max(3 px, one wall thickness in px) | drawing resolution: a wall face and a dimension tick may differ by a wall | `outlineOf` (runtime) | 2026-11-16, Package B |
| Framing share | span ≥ 0.8 of the frame side | a consulted dimension that frames the plan (an overall, not a room) | `outlineOf` (runtime) | v3.54.2 (unchanged use) |
| Coherence | 3 px | a chain segment's printed value × active scale vs its own tick distance | `metricCoherence` | 2026-11-16, Package A |
| Feature bounds | width ≥ 0.8 m; own eaves ≤ 60 % of the rise; 0.3 m from a gable end; 0.15 m under the ridge; pitch 12–70° | what the dormer primitive can build without invention | `ROOF_FEATURE_BOUNDS` (runtime) | 2026-11-16, before C1 |
| Feature id step | centre in 5 % steps of the side | one feature keeps one id across rounds and reruns | `roofFeatureId` | 2026-11-16, before C1 |
| Uncertainty gate | `HIGH` is held | the consultant's own doubt stops application | `bindRoofFeature` | 2026-11-16 |

Removed in this stage (not criteria any more): the 5 % / 10 % extent shares of v3.54.2 candidates 2 and 4 (`EXTENT_TOLERANCE`), and the requirement that a scale gain accompany every accepted correction.

No threshold was chosen from a confirmation result. Changes made after seeing DEV results are listed in `INTERVENTIONS.md`.

## 6. What counts, per category (fixed before CONFIRM8 ran)

- **R — roof feature.** *Corrected*: C's model holds a dormer that `roof_features.py` matches to a reference dormer (same side, IoU ≥ 0.3), no false dormer, and the look after the rebuild did not reject it. *Detected, not built*: the consultant's proposal names the feature on the right side, and the loop held, rejected or refused it with a typed reason (reported as a named gap, not as success). *Missed*: no proposal. *Harm*: a false dormer in the delivered model, or a house that had a model in A1 and has none or a worse size class in C.
- **B — outline / binding.** *Corrected*: C's size class is better than A1's, or A1 refused and C delivers OK/NEAR. *Held*: equal. *Harm*: worse class, or an accepted model whose outline lies BEYOND a printed dimension. The outline statuses SHORT / BEYOND reported by the run itself are read as the product's own honesty: a NEAR/WRONG model must carry the matching known defect.
- **N — hard negative.** *Passed*: no dormer in the delivered model and no accepted roof correction. *Harm*: any applied feature.
- **Regression.** A1 must equal A0 by model hash on every DEV house where no v3.54.3 change is on the default path; any difference is explained per house.
- The first confirmation result is kept as it comes. A crash caused by a technical fault (process death, provider timeout) may be re-run once, recorded in `INTERVENTIONS.md`, with the first attempt's files kept.

Transfer statuses used in the report: `CONFIRMED` (≥ 2 new families of different publishers corrected, none harmed), `PARTLY_CONFIRMED` (≥ 1 corrected outside ARCHON, with misses), `ONE_HOUSE_ONLY`, `NOT_CONFIRMED`.

## 7. Host

`research/source-to-model/v3543/host-e2e.mjs` starts `apps/analyzer-api/dist/server.mjs` with the pilot on and a random in-memory token, and for each URL: `POST /v1/analyses` → status polling → result, scene, model. Checked per job: hashes of the served bytes against the summary, `consultation.globalDescription === 'DISABLED'`, no house-reader attempt, the source check in the consumed result, and the host's books holding CONSULTATION requests only. One more job without the token must run on the drawings' path and book nothing. The host's spend is added to the campaign books and ledger as its own phase.

## 8. Budget

Books at the start of v3.54.3: 6.243534 USD. Pilot ceiling (cumulative): 24.11036 USD. Project limit: 100 USD. First live batch ≤ 3 USD. Every request is reserved at its full possible cost before it is sent; a timeout keeps its reservation; replayed answers are not requests and are not reserved (INTERVENTIONS #1).
