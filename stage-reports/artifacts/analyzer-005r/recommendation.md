# 005R recommendation

## NEXT_RECOMMENDATION: NO_SAFE_VISUAL_CANDIDATE

Exactly one enum (brief §8), chosen by the rule preregistered in `research/analyzer-005r/preregistration.md` §8
(`bdd50b8`, committed before truth was derived and before any contender ran). Scope: **ARCHON only** — the only
publisher whose terms allow the local processing (`corpus/source-eligibility.json`); no human labels exist
(`HUMAN_LABELS_NOT_RUN`); every number below is measured against the publisher's page STRUCTURE, not against a person.

**Even this negative result is not permission or a mandate for anything.** 005S stays a separate OWNER/coordinator
stage; nothing here starts it.

## Why not the other three enums

| enum | verdict | measured reason |
| --- | --- | --- |
| PROPOSE_005S_VISUAL_HANDOFF | **unreachable by design** | It needs independent real-image exterior-feature truth. None exists (HUMAN_LABELS_NOT_RUN), and pixels may not be shown to a remote model. On the only truth available — synthetic — the one localizer (V2, OWL-ViT B/32) finds **0** of 33 open pergolas, 0/19 carports, 0/41 entrance canopies, 0/36 covered terraces, 0/43 terraces at grade, 0/64 exterior steps, 0/254 posts, 11/40 balconies and 2/51 railings at its operating score, with ideal routing (`features/feature-scores-synthetic.json`). |
| ROLE_ROUTER_ONLY_NEXT | **rejected** | The bar (§8) needs ≥ 70 % EXTERIOR_RENDER coverage on EVAL with the risk bound ≤ 5 %. On the 20 EVAL exterior-render lineage groups: V0a 0, V0b 0, V1 0 correct (2 resolved, both wrong), V2 0, N1 0 (`roles/role-scores.json`). The router that looks good on the totals (V1: 90.5 % coverage, 1.9 % risk) routes by **image format, not content**: letterboxing the same pixels to a square flips almost every resolved output (A1, `addenda/a1-v1.jsonl`), and it sends all 54 synthetic exterior renders to INTERIOR_RENDER. V2's image classifier is degenerate (pairwise image-embedding cosine 0.997–1.000; B1), so its own threshold procedure leaves 6.9 % coverage. |
| NOT_MEASURED | **not applicable** | The preregistered condition (< 8 ARCHON EVAL families with structural truth) does not hold: 14 EVAL families, 231 EVAL lineage groups, 20 of them exterior renders. The router question was measured; the answer is negative. The *feature* question is NOT_MEASURED on real images and is reported as such inside this verdict. |
| **NO_SAFE_VISUAL_CANDIDATE** | **chosen** | No router, no detector and no fusion meets the source-, role- and false-positive safeguards on the measured data. The hard gates (0 authoritative assertions, 0 cross-edition mixing, 0 interior→exterior claims, 0 fabricated boxes) held for every contender — **but they held by abstention**: no contender produces a single correct exterior-render route on EVAL. |

## What 005R does establish (for whoever reopens this)

1. **The incumbent already loses interiors' identity, and the first bad operation is located** (audit §8.2 row X):
   `archon.ts:98` maps "wizualizacja" to `PERSPECTIVE_RENDER` (the schema has no interior class), and `analyze.ts:164`
   routes those frames into the facade extractors. MEASURED here: on full-size ARCHON images, every image the
   incumbent calls `PERSPECTIVE_RENDER` that has structural truth is an **interior** (70 of 70); the full-size exterior
   views come out `UNKNOWN` or are not acquired at all (0 of 78 exterior-render assets get `PERSPECTIVE_RENDER`).
2. **A free, deterministic, non-AI router signal exists and is better than any pixel model tried: the publisher's page
   structure** (ARCHON carousel position `fancybox3Interiors`, elevation tab, floor fragments, hotspot originals). It is
   what 005R used as truth, so 005R cannot score it — it is a metadata *channel* the production adapter ignores
   (`archon.ts` never reads `data-fancybox-position`). Using it is an adapter change, i.e. a production stage, not
   something 005R may do.
3. **Edition identity must be byte- and lineage-based.** 64 assets are published byte-identically by ≥ 2 editions (all
   interiors or untyped page images), one picture by 14 editions; 109 of 136 Rarytasy edition pairs share bytes. OWNER's
   anchor `m3ea28300f9b3e` shares 25 byte-identical assets with e-OZE and only 10 with the dev row called
   "rarytasy-g2e", which is actually **Dom w rarytasach 5 (G2E)** `m84f2903cb8e14`. No exterior render or elevation is
   shared between editions. The research JSON contract enforces this (EDITION_MIX, CORRELATION, mutation-tested).
4. **The research JSON contract works** (`schema/`, 16 unit tests, 12/12 mutations caught, 6 100 documents and 98
   edition summaries validated with 0 violations): grounded identity, no metric dimensions, UNVALIDATED_SCORE only,
   boxes only from a localizer, interior gate, absence only with coverage, correlated witnesses counted once.
5. **Detector behaviour on real interiors is the main hazard**: with no router in front, V2 puts 153 "exterior door",
   28 railing, 26 exterior-steps, 8 terrace and 4 carport boxes on interior renders at its operating score
   (`features/v2-oracle-real-counts.json`). Any future detector must sit behind a router that is right about interiors.

## Reopen conditions (all needed)

- A real, human-reviewed, region-level exterior-feature label set (or OWNER-approved off-device labelling) on ≥ 2
  lawfully usable publishers; DobreDomy, Archipelag and Domy w Stylu need consent first.
- A router that is invariant to image format (letterbox/crop controls) **and** right on exterior renders; the
  publisher-structure channel is the first candidate, as a production adapter stage.
- A detector that recognises the target assemblies at all on synthetic known truth before it is tried on real images;
  OWL-ViT B/32 does not.
- Licence clearance for any weights (OWL-ViT B/32: Apache-2.0 weights, partly undisclosed / partly non-commercial
  training data → LICENSE_BLOCKED for product).
