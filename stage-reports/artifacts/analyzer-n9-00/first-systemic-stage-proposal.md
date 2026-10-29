# N9-00 — proposal for the first systemic stage (N9-01, for the owner's decision; not started)

## Choice

**N9-01: technical/fidelity split and a three-relation source check.** Wire what is already computed into the outcome, and add the three cheapest model↔source relations. Do not change any reading, geometry or the model schema.

| part | content | catches (H) | why first |
|---|---|---|---|
| A. TECHNICAL_PASS | Compiler ERROR diagnostics and closure exterior ERRORs become part of the technical verdict (today `run.ts:440-454` ignores `scene.diagnostics`, CV) | #1 Sasanki (4 × OPENING_ABOVE_WALL_TOP); the 005T owner scenes (RV: 8 + 1 errors) | Zero new reading. Today a model with compiler errors reports COMPLETE_WITH_OPEN_QUESTIONS. |
| B. SOURCE_UNCHECKED budget | From `viewAudit`, registrations and per-storey frames: list every elevation, section and storey that no relation compared. Unregistered ≠ silent. | Goździkowce 4/4 elevations, Cieszynianka 1, Trytomach 2, Arganiach 2, Sasanki 2 (RV); E-4 | The data exists and is unconsumed (CV) |
| C. R5 registered-elevation verdict | crossView DISAGREES → FAIL on that view, with the named residuals | Rarytasy: COMPLETE today with 4/4 DISAGREES (RV); #8 | Wiring only |
| D. R1 single roof layer | Vertical rays over the footprint: > 1 roof plate → FAIL | #2 roof-in-roof (Sasanki 15.60 m², Rarytasy 11.45 m² before N8-03C) | Pure model invariant; the N8-03C probe is the prototype. **RV:** on the pre-N8-03C models it reports 15.60 m² (Sasanki) and 11.45 m² (Rarytasy) of double roof, and 0 on today's (`r1-roof-layer-replay.json`). |
| E. R3 wall ink support | Each emitted wall stretch: share of plan positions with ink in the wall's band on its storey's frame; below a tolerance from the frame's own resolution → FAIL | #6 open contact (two walls on blank paper), #5 double walls (thickness), F-R1, phantom pieces | Uses only the plan raster and the frame the solver already registered |
| F. R4 storey outline | Drawn outer-wall outline per storey sheet vs modelled storey footprint (area ratio, max distance) | #3 Trytomach extent, #4 Arganiach scale, #1 wing seam | Same inputs as E |

**Deliverable:** a `sourceFidelity` block in the result (additive API member; Android DTOs tolerate unknown members, CV `AnalyzerDtos.kt:18`), and a headline derived from it.

`modelCompleteness` stays as it is, renamed in the UI to what it is: "decomposition completeness".

## Why this and not the alternatives

| alternative | why not first |
|---|---|
| Another reader fix (labels, voids, glazing panes) | Fixes one class per stage; that is N8's pattern. None of N8's 10 classes would have been *detected* by the pipeline. |
| SpaceRegion / FunctionalRoom schema | Correct and needed (`semantic-space-room-analysis.md`), but it is a schema step, and its value depends on room-number reading (weak today). It catches one class. |
| Section as a registered view (R7) | Catches the void and storey levels, but needs a new registration. Medium cost, one or two classes. |
| Image layers (`target-architecture.md` §4) | Improves inputs, not judgement. Without the relations there is no way to tell whether a layer helped, which is exactly IU-02's lesson (36 → 21 went unnoticed until counted by hand). |
| Learned model or AI | Forbidden in this phase; also not testable without independent truth |

N9-01 parts A–F would have flagged, on the code of their time, at least 7 of the 10 N8 classes (#1, #2, #3, #4, #5, #6, #8) plus F-R1 and E-4 from N7 (H, to be shown by replaying the pre-fix models through the relations). The three it would not have caught, #9 void, #10 rooms and #7 gate semantics, need R7, R8, R6 and R9. Those follow once the outcome can carry them.

## Dependencies, cost, risks

**Dependencies (all present, CV):**
- compiled scene in `run.ts`;
- `viewAudit` and `crossViewResiduals` on `reconstruction`;
- per-storey `PlanFrameV2` and the plan rasters (they are in `reconstructV2`; the relation must run there or receive them).

**Cost:** one module (relations), result and API additive fields, Android and web display of the new headline, synthetic tests.

**Risks:**
- *False failures from registration error or watermark ink (R3/R4).* Tolerance from the frame's own uncertainty. A relation over pixels whose frame confidence is low is UNCHECKED, never FAIL. Never tuned on the 8 houses.
- *Every corpus verdict changes.* That is the point. Before/after is shown as relation tables, and no house's numbers are tuned.
- *The phone headline gets worse for all houses.* It is already LIMITED for all 8, because unresolved gaps are non-empty (CV, `AnalyzerScreen.kt:680-684`). The new headline is more specific, not more alarming.
- *Contract:* a new additive result member; the stale analyzer-contract fixtures (solver 2.3.0) must be re-captured deliberately in that stage and the Kotlin tests run (`schema-android-contract-audit.md` §4).

## Acceptance tests (universal relations, not hashes)

Synthetic drawings and models, each violating exactly one relation by construction, no house names:
- a model with two roof plates over one point → R1 FAIL, other relations unchanged;
- a model wall over a stretch of blank plan → R3 FAIL with that wall named; the same wall over inked band → PASS;
- a storey sheet whose outer walls extend 3 m beyond the modelled storey → R4 FAIL with the distance;
- a registered elevation whose opening row the model lacks → R5 FAIL; the same elevation unregistered → R5 UNCHECKED and listed in the SOURCE_UNCHECKED budget;
- a model with a compiler ERROR → TECHNICAL_PASS false;
- a fully consistent synthetic house → all PASS, budget empty.

On the corpus: the 8 houses replayed with the relations reported, not gated.
- A holdout is needed for the false-failure rate. It is NOT_AVAILABLE locally; the owner would have to provide an annotated control set.

**Stop rule (as N8):** N9-01 is not started before the owner decides.
