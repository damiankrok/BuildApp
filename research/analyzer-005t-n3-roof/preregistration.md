# 005T-N3 roof datum recovery — preregistration (written before any production edit)

Base `ae63f12599fb2bc7c95bc591775e3fa20c3c7756`. Product case: `dom-w-gozdzikowcach` (`archon:m79923e950094d`),
replayed on the sealed N1v graph + the 005T-N2 metric evidence (`f747d8a4…4aaf`), offline.

## Facts measured before coding (solver debug, reverted)

- roof support: `GABLE`, pitch 40° (`PUBLISHED_SPECIFICATION`, evidence `metric-spec-roof-angle-…`), ridge axis X
  (the layout's own long-way default: "nothing measures the ridge height against the pitch").
- main body 0–13.82 × 0–9.50 m; span across an X ridge 9.50 m, half 4.75 m (plan, `SOURCE_DERIVED`).
- levels: one level marker on the section (2.46 m), so `levelsFrom` is `measured: false`; storeys are the convention
  0.00 / 2.80 (`ASSUMED_FOR_RENDERING`). `topDatum` undefined → no main roof → chimney height 0 → refusal.
- knee wall 115 cm (`metric-spec-knee-wall-…`, PUBLISHED_SPECIFICATION); `building_height` 8.68 m in `publishedFacts`.

## Rule (generic, only when the section prints no ridge)

Precedence: section ridge datum (`levels.topDatum`) > this approximate datum > none (unchanged behaviour).

Applies only if ALL hold, else no datum (behaviour as today):
1. `levels.topDatum` undefined.
2. main roof support kind is exactly `GABLE` (HIP, FLAT, UNKNOWN, MONO are never routed here), with a pitch whose
   authority is `PUBLISHED_SPECIFICATION` or `PRINTED_ANGLE`, 15–60°, and a ridge axis the layout already chose.
3. exactly one knee-wall specification value, 0.3–2.0 m.
4. a published `building_height` in metres, 3–20 m.
5. F = the top storey's floor the solver already uses; K = knee wall; h = half the main body's span across the
   layout's ridge axis (axis never changed here); R = F + K + h·tan(pitch).
6. Consistency with the published height H (above terrain): there must exist a roof build-up B ∈ [0, 0.28 m]
   (CONVENTIONS.roofThickness) and a terrain depth d with H − (R + B) = d, where d is the solver's printed terrain
   datum when one exists (|·| ≤ 0.05 m) and otherwise d ∈ [0.05, 1.5] m (the range the solver already accepts as
   terrain). I.e. without a terrain datum: H − R ∈ [0.05, 1.78]. Outside → no datum.
7. Adopted value: ridgeY = R (B = 0: the roof plane meets the outer wall face at knee-wall height), eaveY = F + K.

Labels: ridge and eave `ASSUMED_FOR_RENDERING` (F is a convention here, so the premise is not verified; never
`SOURCE_EXACT`, never "printed ridge"); roof kind and pitch keep their source authority but the roof feature is
`SOURCE_DERIVED`, not `SOURCE_EXACT`. One LIMITING warning `APPROXIMATE_ROOF_DATUM`. The datum feeds ONLY the roof and
the top storey's height; elevation registration stays on printed datums only (no render measured on an assumed scale).
Chimney: existing convention (top under the ridge, height `ASSUMED`), named in the warning; no new tip.

## Expected (Goździkowce)

R = 2.80 + 1.15 + 4.75·tan 40° = 7.936 m; H − R = 0.744 ∈ [0.05, 1.78] → adopt. (Axis Z would give R = 9.75,
H − R < 0 → incompatible; recorded, not used to choose the axis.)

## Acceptance

Goździkowce: COMPLETED, ≥1 GABLE roof with 2 planes, compiled scene round-trips, chimney present, warning LIMITING.
Controls `rarytasy-g2e`, `dom-w-cieszyniankach` (HIP), `marcowki`, A01: model SHA byte-identical (default fail on change).

## Rejection (synthetic negatives must refuse the datum)

no published height; height contradicting R (H − R < 0.05 or > 1.78); printed terrain contradicting; knee wall
missing / implausible / two different values; pitch missing or not source-authored; roof HIP / FLAT; section ridge
present (precedence: the section wins, the rule does nothing); implausible height (e.g. 87 m).
