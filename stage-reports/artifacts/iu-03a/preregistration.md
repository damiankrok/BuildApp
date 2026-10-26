# IU-03A preregistration (written before any TEST image exists)

The commit adding this file is `FREEZE_SHA`; its push is the timestamp. The IU-02 FINAL images (890) are
**development data** for IU-03A from now on and are never again reported as a blind set.

## A. Routing — frozen

| item | value |
| --- | --- |
| LEGACY | production `archonRoleClaims → mergeRoleClaims → normalizeRoles → readsAsFacade` (`iu3/legacy_roles.ts`); on the TEST ARCHON houses the roles come from the real SourcePackage of a production `analysis:second-house` run |
| STRICT_IU02 | IU-02 frozen head `016556687dff3d79…`, τE 0.60, masked projection ORTHOGRAPHIC_SUPPORTED (unchanged) |
| VETO_ONLY | `iu3/route.py` (SHA-256 `d65a8312e91b01d6…` at freeze): keep LEGACY unless (a) unmasked projection PERSPECTIVE_EVIDENT → STOP, (b) NOT_SINGLE_FACADE → REVIEW, (c) P(not elevation) ≥ **t_veto = 0.60** (IU-02 head) → REVIEW naming the most likely class. INCONCLUSIVE never refuses; VETO_ONLY never adds a facade route and returns the roles it was given |
| t_veto rule | largest t on 0.40…0.95 with 0 non-elevations routed on the ADVERSE dev scenario (`evaluate.py dev`) |

Dev (890 IU-02 FINAL images, agent labels): REAL captions (268 ARCHON images in packages) — LEGACY 96/96 elevations,
0 non-elevations; VETO_ONLY 93/96, 0; STRICT 29/96, 0. ADVERSE (every image captioned "elewacja") — LEGACY 674
non-elevations routed; VETO_ONLY 173/216 elevations (80.1 %), 0 non-elevations; STRICT 107/216 (49.5 %), 0.
The single-class form (veto when one non-elevation class has p ≥ t) let 95 dev non-elevations through at 2 % loss and
was rejected on dev.

## B. Geometry evidence — frozen

`iu3/evidence.py` (SHA-256 `dfb24d35e50eeb1b…` at freeze) with its constants as committed; adapter
`iu3/extractor_variants.ts` (RAW, CLEAN, ANCHORED, RAW_FGE, ANCHORED_FGE); scoring `iu3/score_readings.py` (a reading is
correct when it overlaps a plan-placed opening on the same facade and storey by ≥ 50 % of the shorter interval).
Dev (5 houses): readings correct/total RAW 31/36, CLEAN 20/21, ANCHORED 20/21, RAW_FGE 40/44, ANCHORED_FGE 34/37;
facade views 15 / 10 / 11 / 17 / 17; unmatched readings 0 / 1 / 0 / 0 / 0. Dev negatives 16/18 pass (N5-0 dark
chimney on a dark roof: ridge 25 px high; N6-1: one opening added).

## TEST sets (made after this commit, from FREEZE_SHA)

1. **TEST_ARCHON** — `iu2_draw_archon.py FREEZE_SHA 6 <out> BUILDPLAN-IU03A-TEST-ARCHON` (excludes every family seen
   before, IU-02 FINAL included); each house through production `analysis:second-house --url`; every SourcePackage
   asset labelled from anonymised sheets **before** any model runs on it (labels committed first).
2. **TEST_SYNTH** — `iu2/synth3d.py --prefix s3t --houses 30 --seed int(sha256(FREEZE_SHA+"BUILDPLAN-IU03A-TEST-SYNTH")[:8],16)`.
3. **TEST_NEG** — `iu3/negatives.py --seed int(sha256(FREEZE_SHA+"BUILDPLAN-IU03A-TEST-NEG")[:6],16)`.

Scenarios: REAL captions (TEST_ARCHON packages) and ADVERSE captions (all TEST images). Part B runs on every
TEST_ARCHON house the production analysis completes.

## Integration criteria (brief)

0 confirmed non-elevations to the extractor; ≥ 70 % of correct elevations kept; no loss of registration or opening
detection; licences and resources fit offline Android. Any miss → `RESEARCH_PARTIAL`. Labels are agent labels: the
validation is **not** complete until the human review sample is checked.
