# 005R recommendation

## NEXT_RECOMMENDATION: NO_SAFE_VISUAL_CANDIDATE

Exactly one enum (brief §8), chosen by the rule preregistered in `research/analyzer-005r/preregistration.md` §8
(`bdd50b8`, committed before truth was derived and before any contender ran). Scope: **ARCHON only**, the only
publisher whose terms allow this local processing (`corpus/source-eligibility.json`). No human labels exist
(`HUMAN_LABELS_NOT_RUN`). Every number below is measured against the publisher's page STRUCTURE, not against a person.

**This negative result is not permission or a mandate for anything.** 005S stays a separate OWNER/coordinator
stage, and nothing here starts it.

## Why not the other three enums

| enum | verdict | measured reason |
| --- | --- | --- |
| PROPOSE_005S_VISUAL_HANDOFF | **unreachable by design** | It needs independent real-image exterior-feature truth. None exists (HUMAN_LABELS_NOT_RUN), and pixels may not be shown to a remote model. On the only truth available, which is synthetic, the one localizer (V2, OWL-ViT B/32) finds **0** of 33 open pergolas, 0/19 carports, 0/41 entrance canopies, 0/36 covered terraces, 0/43 terraces at grade, 0/64 exterior steps and 0/254 posts. It finds 11/40 balconies and 2/51 railings. All of this is at its operating score with ideal routing (`features/feature-scores-synthetic.json`). |
| ROLE_ROUTER_ONLY_NEXT | **rejected** | The bar (§8) needs every one of: EXTERIOR_RENDER and TECHNICAL_ELEVATION coverage ≥ 70 % on EVAL, a family-bootstrap risk upper bound ≤ 5 %, interior→exterior 0, and identical replay. **Preregistered truth:** on the 20 EVAL exterior-render lineage groups, V0a, V0b, V2 and N1 get 0 correct. V1 gets 0 correct, with 2 resolved and both wrong (`roles/role-scores.json`). **Post-hoc corrected truth (Addendum C):** the reviews found two truth defects. Fixing them helps V1 alone. With both corrections (C12), V1 gets EXTERIOR_RENDER 46/46 and TECHNICAL_ELEVATION 49/53 at full coverage, with 0 interior→exterior. Its family-bootstrap risk upper bound, however, is **6.15 %**, so it fails the 5 % bar. With the interiors-carousel correction alone (C1), the upper bound is 8.81 %. With the view-slug correction alone (C2), V1 has a 0 % upper bound but only 60.9 % EXTERIOR_RENDER coverage. Every variant fails the bar (`addenda/addendum-c.json`). Separately, V1 also routes partly by image **format**. Letterboxing the same pixels to a square changes 58.6 % of its resolved outputs with white padding and 29.9 % with grey (A1). Elevations and interiors are the sensitive classes; drawings (plans, sections, site plans) never change. A router that passes a risk bound on one publisher's formats has not shown it reads the content. The C12-refitted V1 is worse on this control. Padding changes 97.7 % (white) and 63.6 % (grey) of its resolved outputs, and **all 93** of its correct exterior-render routes flip under either padding (`addenda/a1-v1-c12.json`). Its exterior coverage under corrected truth comes from the format, not the picture. It also abstains on every floor plan and site plan. |
| NOT_MEASURED | **not applicable** | The preregistered condition (< 8 ARCHON EVAL families with structural truth) does not hold: there are 14 EVAL families and 231 EVAL lineage groups, 20 of them exterior renders. The router question was measured, and the answer is negative. The *feature* question is NOT_MEASURED on real images, and this verdict reports it as such. |
| **NO_SAFE_VISUAL_CANDIDATE** | **chosen** | No router, detector or fusion meets the source, role and false-positive safeguards on the measured data. The hard gates held for every contender (0 authoritative assertions, 0 cross-edition mixing, 0 interior→exterior claims, 0 fabricated boxes), but **they held by abstention**. Under the preregistered truth, no contender produces a single correct exterior-render route on EVAL. Under the corrected truth, the one router that does (V1) misses the risk bound and has a format shortcut. |

A post-hoc truth correction cannot change a preregistered verdict. The sensitivity is reported so that nobody reads "0 of 20" as "V1 cannot see exteriors". The finding is narrower: V1 sees exteriors well enough on one publisher, but **not safely enough, and not for the right reason**.

## What 005R does establish (for whoever reopens this)

1. **The incumbent cannot tell interiors from exteriors, and the first bad operation is located** (audit §8.2 row X).
   `archon.ts:98` maps "wizualizacja" to `PERSPECTIVE_RENDER`, because the schema has no interior class, and
   `analyze.ts:164` routes those frames into the facade extractors. MEASURED through the carousel's
   original↔thumbnail anchors (Addendum C3), the incumbent gives `PERSPECTIVE_RENDER` to 134 interior and 39 exterior
   full-size carousel images alike. **All 107 EVAL interior lineage groups** therefore reach the facade extractors
   (54 when matched by bytes only, the draft's figure). The draft's "0 of 78 exterior renders get
   `PERSPECTIVE_RENDER`" was an artefact of byte-only matching and is withdrawn.
2. **The publisher's page structure is a free, deterministic, non-AI router signal, and it is better than any pixel
   model tried.** Examples are the ARCHON carousel position `fancybox3Interiors`, the elevation tab, floor fragments and
   hotspot originals. 005R used it as truth, so 005R cannot score it. It is a metadata *channel* that the production
   adapter ignores (`archon.ts` never reads `data-fancybox-position`). The B-1 truth defect shows its limit: 15 styling
   views sit in the interiors carousel. Using this channel is an adapter change, i.e. a production stage, which 005R may
   not do.
3. **Edition identity must be byte- and lineage-based.** 64 assets are published byte-identically by ≥ 2 editions,
   all of them interiors or untyped page images, and one picture appears in 14 editions. 109 of 136 Rarytasy edition
   pairs share bytes. OWNER's anchor `m3ea28300f9b3e` shares 25 byte-identical assets with e-OZE, and only 10 with the
   dev row called "rarytasy-g2e", which is actually **Dom w rarytasach 5 (G2E)** `m84f2903cb8e14`. No exterior render or
   elevation is byte-identical across editions. However, 13 *lineage groups* (near-duplicates) holding exterior renders
   or elevations do span editions, among them one shared by four editions including the anchor. Near-duplicate
   pictures are therefore no evidence that two editions differ or agree. The research JSON contract counts them as one
   witness (CORRELATION).
4. **The research JSON contract holds against a red team.** It has 18 unit tests, including the 25 bypass documents
   reviewer A wrote against the first validator, and 13/13 mutations are caught. 6 100 asset documents and 98 edition
   summaries (all contenders) validate with 0 violations. The contract enforces grounded identity, no metric
   dimensions, UNVALIDATED_SCORE only, boxes only from a localizer, exterior claims only on exterior-routed assets,
   absence only with coverage, and correlated witnesses counted once. Every keyset is closed.
5. **A detector's behaviour on real interiors is the main hazard.** With no router in front, V2 at its operating score
   puts 253 "window", 153 "exterior door", 28 railing, 26 exterior-steps, 8 terrace and 4 carport boxes on interior
   renders (`features/v2-oracle-real-counts.json`). On 12 synthetic interiors it finds 12 windows, and V1's drawing
   cues fire 31 times (ungated interior control). Any future detector must sit behind a router that is right about
   interiors.
6. **V2's routing is unusable as configured.** On real DEV images, V2 routes every resolved lineage group to
   INTERIOR_RENDER up to τ = 0.85 (DEV risk 72.8 %). Its own τ procedure therefore lands at 0.95 and 6.9 % EVAL
   coverage. On 20 synthetic images, its pooled image embeddings are nearly identical (pairwise cosine
   0.997–1.000, B1). The harness matches the library to 2·10⁻⁶. V2 is deterministic: two full runs are identical on
   1 537/1 537 assets.

## Reopen conditions (all needed)

- A real, human-reviewed, region-level exterior-feature label set (or OWNER-approved off-device labelling) on ≥ 2
  lawfully usable publishers. DobreDomy, Archipelag and Domy w Stylu need consent first.
- Truth that does not inherit the publisher's own filing mistakes. The interiors carousel holds exterior styling
  views, so a structural channel needs a human check before it becomes truth.
- A router that is invariant to image format (letterbox and crop controls) **and** passes the preregistered risk bound
  on exterior renders under that truth. The publisher-structure channel is the first candidate, as a production
  adapter stage. V1's features are the second.
- A detector that recognises the target assemblies at all on synthetic known truth before it is tried on real images.
  OWL-ViT B/32 does not.
- Licence clearance for any weights. For OWL-ViT B/32 the weights are Apache-2.0, but the training data is partly
  undisclosed and partly non-commercial, so it is LICENSE_BLOCKED for the product.
