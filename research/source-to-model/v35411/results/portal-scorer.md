# v3.54.11 — the portal head: what 2.78 measured and what 2.261 measures

Source truth (`research/marcowki-v2/marcowki-source-truth-v2.json`, unchanged): the band over the open front (entrance
+ garage) has its top at 3.07 m and its soffit at 2.28 m (a band 0.79 m deep). Tolerance 0.15 m (TOL_Y, unchanged).

Scorer v1 (`v3547/marcowki-features.py`, historical, kept): "the first flat roof whose plate reaches the front plane",
its plate top and plate bottom. In LOCAL the band IS the garage roof's thick edge (`roof-attached-0`, ROOF_TRIM,
2.321..3.06) — v1 measures the right object. In H since v3.54.8 the band is its own member (`portal-front-*`, FASCIA
linear solids) hanging below a thin garage roof plate (`roof-garage-flat`, 2.781..3.031); v1 still took the plate and
reported a soffit of 2.781 — a NO for a band built at 2.261.

Scorer v1.1 (`v35411/features-v1_1.py`, `--self-test` passes): every object whose bounds reach the front plane
(z0 ≤ 0.5 m) and cover ≥ 30 % of the portal span along x, soffit = lowest bottom, top = highest top, objects named.

| model | v1 soffit / top | v1.1 soffit / top | objects (cover) | v1.1 |
|---|---|---|---|---|
| H v3.54.10 (APK sc. 2) | 2.781 / 3.031 | 2.261 / 3.038 | portal-front-2-2 2.261..3.038 (0.82), roof-garage-flat (1.0) | OK |
| LOCAL delivered (APK sc. 3) | 2.321 / 3.06 | 2.321 / 3.06 | roof-attached-0 (1.0) | OK |
| H after repair v3.54.11 (APK sc. 1) | 2.781 / 3.031 | 2.261 / 3.038 | the same as H v3.54.10 (geometry unchanged; material only) | OK |

The historical 16-feature table stays as it was (H 15/16 with v1); v1.1 is a correction of the measurement, not of
any model, and both rows are printed side by side (`marcowki-apk-scenes-metrics.txt`). The band covers 0.82 of the
span: its last 0.75 m over the garage return is the garage roof plate's edge — named, not fixed in this stage.
