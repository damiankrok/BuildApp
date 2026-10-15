# 005R preregistration — visual asset router + exterior semantic observations (RESEARCH ONLY)

Committed **before** role truth is derived (`truth.py` has not been run when this file is committed) and **before**
any contender runs on the real or the synthetic corpus (the only runs so far: V2 and V1 features on one throwaway
synthetic smoke image to prove the code loads). The architecture audit `current-pipeline-audit.md` is committed first
(`c1ab121`). Later changes go only into the timestamped addenda at the end; the body is never
edited after the commit that introduces it.

Base `39061dbed453d7af4e538b1fcbe4584496fa223e`; branch `analyzer/visual-asset-exterior-json-research-v1`, every push
mirrored to `claude/new-session-3kzcgh`. Production freeze: `freeze-manifest.mjs`, start manifest committed in `0d02e53`.

## 1. Questions (kept apart, brief §2)

- **Task A — image-asset routing.** For each source image: one of `FLOOR_PLAN`, `TECHNICAL_ELEVATION`, `SECTION`,
  `SITE_PLAN`, `EXTERIOR_RENDER`, `INTERIOR_RENDER`, `EXTERIOR_PHOTO`, `INTERIOR_PHOTO`, `DETAIL`, `OTHER`, `UNKNOWN`
  (research JSON only; never forced into the production `DocumentRole`, which has no interior/exterior or photo/render
  dimension). **`TECHNICAL_ELEVATION` means an orthographic facade view, whatever its shading**: ARCHON publishes
  photo-real orthographic elevations under "elewacja" (audit §3.0), and the brief's line is drawn between orthographic
  views and oblique marketing renders, not between line art and shading. The line-vs-shaded style split has no
  structural truth and is not measured. View side is **not** inferred from pixels by any contender; it is carried as the publisher's claim with
  `mirrorAmbiguous` set when the page offers a mirrored display.
- **Task B — exterior semantic observations**, only on assets a router sends to `EXTERIOR_RENDER`, `EXTERIOR_PHOTO` or
  `TECHNICAL_ELEVATION`: the 14 kinds of the brief, statuses `FEATURE_PRESENT` / `FEATURE_ABSENT_IF_VISIBLE` /
  `UNRESOLVED`, never absence without stated coverage.

## 2. Fixed corpus

### 2.1 Real (publisher) corpus
- **Edition universe (fixed rule, not hand-picked):** every distinct canonical page of the 48 development rows of
  005Q-CHAIN (`research/analyzer-005q-chain/cases.json` → sealed packages; 44 pages) **plus** every edition listed by
  ARCHON's own "family" endpoint of OWNER's anchor `projekt-dom-w-rarytasach-g2e-m3ea28300f9b3e` (17 Rarytasy
  editions, 15 new). 59 pages surveyed: 50 ARCHON, 8 DobreDomy, 1 republishing host of an ARCHON project. All are
  development material (Rarytasy is an excluded development family of the holdout pool; the others are already
  development rows); no holdout pool address is opened, and no fresh blind draw is made.
- **Source eligibility (brief §4), decided during the survey, before any image of the publisher was fetched:**
  DobreDomy's terms (§7.2) permit copying and use of the site's materials only with the seller's consent, so
  dobredomy.pl is **SOURCE_NOT_USABLE**; its 8 editions are excluded and its survey pages deleted. Two further
  publishers screened as replacements carry the same clause (Archipelag, Domy w Stylu); two others' terms could not be
  read without JavaScript (Z500, MG Projekt) and were not used. `stage-reports/artifacts/analyzer-005r/corpus/
  source-eligibility.json`. **The real corpus is single-publisher: 50 ARCHON editions + 1 republished ARCHON edition.
  Every real-image conclusion is ARCHON-scoped; a second publisher is NOT_MEASURED.**
- **Acquisition:** `acquire.py` (robots.txt honoured per host; no DobreDomy image is ever fetched (SOURCE_NOT_USABLE);
  1 request/s; allowlisted hosts only). Every product image of each page reachable through the page structure is
  fetched; bytes, HTML and captions stay in `/home/user/work005r/corpus` (outside Git).
- **Frozen manifest:** `stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json` (hashes, URLs, sizes,
  structural channel names, perceptual hashes, lineage groups, family, split — no pixels or captions). Its SHA-256 is
  in §10. Measured at freeze, before truth: 50 editions (the republished page merges into its ARCHON edition), 1 871 of
  1 871 eligible URLs fetched, **1 352 unique assets (1 220 scorable), 761 lineage groups, 64 assets published
  byte-identically by ≥ 2 editions**, 34 families, split **DEV 20 families / 36 editions, EVAL 14 families / 14
  editions**. The whole Rarytasy family (17 editions) fell in DEV by the hash rule, so every Rarytasy number is
  in-sample for the fitted contenders; that is reported, not repaired. Assets whose shorter side is < 256 px are kept in the manifest but are not scored (`scoredSize=false`).
- **Identity (brief §2):** edition = publisher-origin project code (`archon:<m-code>`, `dobredomy:<project>`); the
  republished page carrying an ARCHON code is the **same** edition on another host. Asset = one SHA-256 byte string;
  the same bytes on two editions are one asset with two memberships. Lineage group = connected component of
  perceptual near-duplicates (64-bit dHash Hamming ≤ 6, aspect within 5 %) — one witness.
- **Family split:** family by the holdout README rule (DobreDomy: name without trailing roman numeral); DEV if
  `int(sha256("005R-family-split-v1:" + family)[:8], 16) % 5 ∈ {0, 1}`, else EVAL. Fixed in `build_manifest.py`
  before any truth was derived. **All fitting (V0b stump, V1 rules, V2 abstention threshold) reads DEV rows only;
  headline numbers are EVAL.** DEV numbers are reported as in-sample.

### 2.2 Synthetic known-truth corpus
`synth.py --seed 5005 --houses 12` (code hash in §10): orthographic elevations, two oblique perspective renders,
plan, section, site plan, interior, details, mirrored / cropped / downscaled lineage copies, three edition pairs that
differ by one assembly, and the hard look-alikes of brief §2 (closed garage ≠ carport, roofed canopy ≠ pergola, eaves
≠ entrance canopy, at-grade terrace ≠ balcony, parapet ≠ railing, open parking bay ≠ carport/garage, dark window ≠
garage door). Truth is by construction (axis-aligned box of the drawn pixels; occlusion in renders not modelled).
Synthetic correctness is **not** real-source generalisation and is reported separately.

## 3. Contenders (all on the identical asset list)

| id | what | Task A | Task B | fitted on |
| --- | --- | --- | --- | --- |
| **V0a** | incumbent production acquisition (`npm run source:acquire`, unmodified; ARCHON online with a cache pre-seeded from the 005R bytes; DobreDomy is SOURCE_NOT_USABLE and not run) → `roles.document` mapped: FLOOR_PLAN, SECTION, SITE_PLAN, ELEVATION→TECHNICAL_ELEVATION, DETAIL; `PERSPECTIVE_RENDER` → unresolved (no interior/exterior dimension); CHROME→OTHER; UNKNOWN | metadata roles | **none**: the incumbent CV emits OPENING / LOGGIA / LINEAR_VOLUME_CANDIDATE / ROOF_EDGE … but none of the 14 kinds (audit §3.3, §4), and mapping OPENING→WINDOW would be a new rule, not the incumbent; its behaviour on interior frames is reported descriptively from the audit (§8.2 X) | — |
| **V0b** | V0a + best simple non-AI pixel heuristic: one Gini stump over scene features (`skyBlue, skyBright, skyEdge, vegetation, warm, ceilingSmooth`) splitting V0's `PERSPECTIVE_RENDER` into exterior / interior | metadata + stump | as V0a | DEV |
| **V1** | deterministic CV features (`v1/features.mjs`, 20 pixel features) + CART rules depth ≤ 4, min leaf 5, abstain when leaf purity < 0.9 or leaf n < 5 (`v1/tree.mjs`); never sees metadata | pixels only | narrow cues only where measurable (see §5.3) | DEV |
| **V2** | ONE compact local open-vocabulary detector, `google/owlvit-base-patch32` @ `cbc355fb…`, weights sha256 `4dbe0399…`; Task A = softmax over fixed class prompts (a classifier: no boxes); Task B = detection head with fixed queries (a localizer: boxes) | pixels only | boxes + UNVALIDATED_SCORE | abstention τ on DEV |
| **N1** | my intervention (§6): metadata claim (V0a) **AND** pixel router (V1) must agree; disagreement → UNKNOWN; `PERSPECTIVE_RENDER` resolved only by V1's pictorial decision | fusion | inherits V2 Task B only on N1-exterior assets | — |
| **V3** | **NOT_RUN_PREVIOUS_005M_SAFETY** — decided now, before any result: 005M measured 30.9 % confident-wrong for the best small VLM (Qwen3-VL-2B, mode D), 0 abstentions in 760 replies, ≥ 1.5 GB and ≤ 33 s per question on this CPU; 005R's tasks (role routing, presence/localisation) do not differ enough to justify re-downloading it, and the session has ~2 GB free disk. Not downloaded. | — | — | — |

Abstention for V2 Task A (fixed procedure): top softmax probability τ = the smallest value in {0.30, 0.35, …, 0.95}
whose DEV selective risk (one row per lineage group) is ≤ 5 %; if none, τ = 1.0 (V2 abstains on everything). V2 Task B
operating threshold: **0.20**, fixed a priori (no tuning); curves at {0.05, 0.10, 0.20, 0.30, 0.50} are reported.

## 4. Ground truth (no self-scoring)

- **Role truth** = publisher page STRUCTURE (`truth.py`): carousel position `fancybox3Interiors` → INTERIOR_RENDER,
  floor fragments → FLOOR_PLAN, `fancybox3CrossSection` → SECTION, the elevation tab → TECHNICAL_ELEVATION, header
  image → EXTERIOR_RENDER, un-positioned carousel item captioned "widok N" (no interior word) → EXTERIOR_RENDER
  (basis STRUCTURE+CAPTION), DobreDomy page sections (Elewacje / Rzuty incl. "Rzut działki" → SITE_PLAN /
  Przekroje), slug "sytuacja" → SITE_PLAN (basis SLUG); everything else UNKNOWN; disagreeing channels →
  TRUTH_CONFLICT. Both excluded from scoring and counted. (The DobreDomy rules in `truth.py` — sections, and the
  slider as `PICTORIAL_UNSPECIFIED` because it holds up to 12 `_wN` visualisations without an interior/exterior split —
  stay in the code but apply to no asset, since DobreDomy is SOURCE_NOT_USABLE.)
- **Independence:** the pixel contenders (V0b's stump, V1, V2, N1's pixel half) never see a URL, caption or page
  position. V0a reads slugs and captions, so V0a's agreement with STRUCTURE+CAPTION or SLUG truth is reported as
  metadata agreement, **never as accuracy**; V0a accuracy is quoted only on basis = STRUCTURE.
- **No human labels exist: `HUMAN_LABELS_NOT_RUN`.** No contender output, no model explanation and no remote model is
  used as truth. I (the agent) never view publisher pixels; no publisher pixel reaches any remote API.
- **Exterior-feature truth on real images: none.** Without human-reviewed region labels, real-image feature accuracy,
  box IoU and recall are **NOT_MEASURED**. What is reported on real images: counts, routing-gated safety checks,
  duplicate/edition consistency, and *edition-level publisher-claim consistency* (the ARCHON product-category tags
  and description words such as "z pergolą" / "taras" — edition-level claims, not visible-region truth, never called
  accuracy).
- **Feature truth on synthetic images:** exact by construction.

## 5. Metrics

### 5.1 Task A (EVAL headline; DEV in-sample beside it)
Per contender, on scored assets with truth ∉ {UNKNOWN, TRUTH_CONFLICT}, one row per **lineage group** (the asset with
the smallest id), plus the same per asset for sensitivity:
- full confusion matrix (truth × output incl. UNKNOWN); per-class precision of resolved outputs, recall, coverage;
- **selective risk** = wrong / resolved, with Wilson 95 % and a **family-cluster bootstrap** (2 000 resamples,
  seed 5005) interval; risk–coverage curve over the contender's own score;
- **interior→exterior leakage** = INTERIOR_* truth routed to EXTERIOR_RENDER / EXTERIOR_PHOTO / TECHNICAL_ELEVATION
  (and, for V0a, the count that a consumer of `PERSPECTIVE_RENDER` would treat as exterior);
- **technical vs marketing** confusions (TECHNICAL_ELEVATION ↔ EXTERIOR_RENDER) reported separately;
- **duplicate correlation**: share of lineage groups with ≥ 2 assets whose members received different outputs;
- per-family breakdown; per-host breakdown (ARCHON vs the republishing host).

### 5.2 Edition identity
- **cross-edition shared assets**: count of assets published byte-identically by ≥ 2 editions (and by ≥ 2 families);
- **edition-mixing rate** of the JSON assembler: supporting observations whose variant is not published by the
  summarised edition (must be 0; mutation-tested);
- the dev row named `rarytasy-g2e` vs OWNER's anchor: overlap of their published byte sets.

### 5.3 Task B
- **Synthetic** (exact truth): per kind precision / recall at IoU ≥ 0.5 at the operating threshold, look-alike
  confusions (a detection of kind K overlapping a look-alike whose `isNot` contains K, IoU ≥ 0.5), crop control
  (no detection of a kind the crop removed), mirror control, interior control (any exterior detection on an interior
  image), edition-pair control (does the swapped assembly change the output?).
- **Real**: per contender counts by kind on routed-exterior assets; hard safety gate checks (§7); edition-level claim
  consistency (descriptive); duplicate consistency across the lineage group.
- V1 Task B is limited to cues the rules can actually see; V1 emits no Task-B observation on perspective images.

### 5.4 Runtime and licence
Cold load, warm per-image p50 / p95, peak RSS, asset size, per-class time; V1 on Node 22 and Node 18.20.4 (bit
parity), V2 on CPU Python only (`NOT_RUN_NODE18` for V2). Physical ARM64: `PENDING` — no phone measurement is made or
extrapolated. Licence matrix for code, weights and documented training-data restrictions.

## 6. N1 (my intervention) and its falsifier
**Motivation (KNOWN, `current-pipeline-audit.md` §3.2, §3.3, §8.2 row X — committed in `c1ab121` before this file):** the production adapter has no interior/exterior dimension, so every
interior visualisation of an ARCHON page becomes `PERSPECTIVE_RENDER`, the same role as the exterior views; any future
consumer of renders would take interiors as facade evidence. **Intervention:** a router that accepts a role only when
the publisher claim (V0a) and the pixel router (V1) agree, resolves `PERSPECTIVE_RENDER` only with V1's pictorial
decision, and returns UNKNOWN on any disagreement. **Falsifier (preregistered):** N1 is rejected if on EVAL its
interior→exterior leakage is > 0, or its selective risk is not lower than V0b's, or its EXTERIOR_RENDER coverage is
below 50 %.

## 7. Hard safety gates (any failure → NO_SAFE_VISUAL_CANDIDATE for that contender)
On every measured run: 0 ungrounded authoritative feature assertions (validator: no SOURCE_EXACT / MEASURED /
CONFIRMED, metricDimensions null, UNVALIDATED_SCORE only); 0 cross-edition mixing; 0 interior→exterior *feature
claims* (validator ROUTING rule) and 0 interior→exterior *routes* on EVAL for the candidate router; 0 fabricated boxes
(boxes only from a LOCALIZER; Task-A outputs never carry a box). Limited samples cannot prove zero future risk; the
report says so.

## 8. Acceptance and stop rules → exactly one NEXT_RECOMMENDATION
- `PROPOSE_005S_VISUAL_HANDOFF` requires independent real-image exterior-feature truth. **None exists in 005R**
  (HUMAN_LABELS_NOT_RUN), so this enum is **unreachable by design** in this stage, whatever the scores.
- `ROLE_ROUTER_ONLY_NEXT` if some router (V1, V2 or N1) on ARCHON EVAL: selective risk upper family-bootstrap bound
  ≤ 5 %, interior→exterior leakage 0, EXTERIOR_RENDER and TECHNICAL_ELEVATION coverage ≥ 70 % each, ≥ 8 EVAL families
  with structural truth, deterministic replay identical — and all §7 gates hold. Because only one publisher is lawfully
  usable, this enum would be **ARCHON-scoped**: the FINAL_TOKEN must say so, and a second publisher stays NOT_MEASURED.
- `NO_SAFE_VISUAL_CANDIDATE` if every router fails the bar above on the measured data.
- `NOT_MEASURED` if ARCHON EVAL has < 8 families with structural truth for the gating classes.
- Even `ROLE_ROUTER_ONLY_NEXT` is **not** permission to ship visual AI; 005S stays a separate OWNER/coordinator stage.

## 9. Reproducibility and leak tests (before any comparison)
- V0a replayed offline twice from the cache: sealed packages must be identical (content hash) — run before V1/V2.
- V1 features twice on Node 22 and once on Node 18.20.4: identical bytes. V2 twice: identical outputs.
- Leak tests: the routers' inputs are image bytes only (no path containing a slug: V1/V2 read `<sha256>.<ext>` files);
  the prompts file names no project, slug, caption, area or expected feature (hash below); validator forbids prompt,
  caption, truth, label and published-area fields and the edition slugs/titles as tokens.
- Mutations that must be caught: source swap, edition swap, fabricated box, class/name leakage, interior→exterior,
  false-confidence promotion, metric dimensions, correlated witnesses counted twice (`schema/test_schema.py`), plus a
  scorer mutation (truth/output swap) and a split mutation (EVAL row read by a fit).

## 10. Hashes (this commit)

| artifact | SHA-256 |
| --- | --- |
| `research/analyzer-005r/acquire.py` | `e7a78575768fa09234c30a8db2422d5865c7db2e9f3219699289fde2e04e37b3` |
| `research/analyzer-005r/assemble.py` | `912f5775db4a3aa0044120ae1ea9045ae2c49f44a05aa96ef456489291329985` |
| `research/analyzer-005r/build_manifest.py` | `fca254d52f12ee3b36aad6568596bc1499ba40d7b7f2fad2f9f7bf252b905cc7` |
| `research/analyzer-005r/contenders.py` | `1c3382da3c58c53eea9f4a9c9fb967777c6a1e1383da82729b5cc3d8c38a8c7c` |
| `research/analyzer-005r/freeze-manifest.mjs` | `e48ae2aa3092066f3ad6dbbea2861329297b861fdc603a9e5efc875117d8ec3e` |
| `research/analyzer-005r/schema/test_schema.py` | `7f44a3f0a8c75471cb6c2d578a402538188c4b7ec5e8f2cf91bdc94fb51b5b23` |
| `research/analyzer-005r/schema/validate.py` | `823dcd203e5f7503afca8c236dc75b018b3a3a9d95b4c91fa9dddfbafd9c7614` |
| `research/analyzer-005r/score_features.py` | `671516b483ae1306ea4c0ce5dc679448a7be88a60520a830d0a802e991125673` |
| `research/analyzer-005r/score_roles.py` | `31f9b9ce01bbc047d580de7079b62eae364b3914d85253038b30a33e6302cc7e` |
| `research/analyzer-005r/synth.py` | `02d2fd8ebb3512c9ec16e0b785a0384c323646c86bd19878c0af1179575c48dd` |
| `research/analyzer-005r/truth.py` | `d06c5662fb7db3474cb7f20fc5da6e76503b0f6fca3dcc1ca2761952e58ead7d` |
| `research/analyzer-005r/v0/seed_and_run.sh` | `c9a2d53df4b513b8839896cae2611861cbfbe2542e23cc1463e6f4c404c8663b` |
| `research/analyzer-005r/v0/seed_cache.py` | `093b369ba7f199c50f15394f4131c3ee478be6ee551cbe09408ded35f7872070` |
| `research/analyzer-005r/v1/cues.mjs` | `8d3846d84388b3862d02b619ca3724b4c4099adc8e69bd05a746a3a7479eda9d` |
| `research/analyzer-005r/v1/features.mjs` | `f70403c5f4744883bea3151291f36c8b6805bda59920ee6eda548517bad6f0f4` |
| `research/analyzer-005r/v1/run.mjs` | `eb114887717822d6d670d77e119fc85e56164c1695ddc5d652f2f03e3b23554b` |
| `research/analyzer-005r/v1/tree.mjs` | `6f6d0d087365a4732fcf325b21fd0de712e753454d5c832b719d3bc0cd8e7953` |
| `research/analyzer-005r/v2/run_owlvit.py` | `f88b91297da07b7f49b14a3f69a9b3a0530ae46851485abc0005dd9d7d8e2d14` |
| V2 prompts (canonical JSON of `PROMPTS`) | `cd48e664e9986fbda0085ed1b87a85a79825d5bba45bea1ea9835b3617ee15fc` |
| V2 weights `model.safetensors` (google/owlvit-base-patch32 @ cbc355fb…) | `4dbe0399f0b7d7c8dddf1535a98769cc30743bebc877aea681998c8d984ce52b` |
| `stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json` | `67dd756c1f83a9f51145820b3a4553cb216e32f2a0eb28909681ef7965bf61e3` |
| synthetic `manifest.json` (seed 5005, 12 houses) | `431e99d1efeede039aa775fbfbd96ee5399375b2ad6614ac47b3944a2efb0ae9` |
| synthetic `truth.json` | `e2bcec5e387eceddd91e4d09dd904953733c458116607284740fd2881babbd12` |

## Addenda

### Addendum A — 2026-10-15T02:10Z (after the V0a/V0b/V1/N1 EVAL role scores and V1's fitted rules were seen; before any V2 output was read)

Two **post-hoc diagnostics**. They change no contender, no threshold, no truth and no decision rule of §8; they are
reported as diagnostics and never as headline numbers.

- **A1 — aspect-ratio shortcut control.** V1's fitted rules split mainly on `aspect` (publisher image formats: ARCHON
  elevations ≈ 2.5:1, interiors square or portrait). The synthetic set cannot expose this, because its sizes were
  specified to resemble ARCHON's before the rules existed. Metamorphic test: every scored, truth-bearing asset is
  letterboxed to a square canvas (padding white; and separately mid-grey 128) and V1 (features → the same fitted rules)
  and V2 (routing only) are re-run. Reported: share of resolved outputs that change, by truth class and split.
- **A2 — lineage-propagated truth (sensitivity).** The preregistered truth leaves page images reached only through the
  page body (e.g. the `widok-N` header copies) UNKNOWN, while their full-size near-duplicates carry STRUCTURE truth. A2
  gives an UNKNOWN-truth asset the truth of its lineage group when that group has exactly one structural truth role,
  and re-scores every contender per asset. The primary scores stay the preregistered ones.

### Addendum B — 2026-10-15T~04:10Z (after V2 run 1 was scored)

- **B1 — V2 implementation faithfulness (post-hoc check, synthetic images only).** V2 routed every real image to
  INTERIOR_RENDER. `addenda/b1_v2_faithfulness.py` compares V2's routing logits with the library's own
  `OwlViTModel(...).logits_per_image` on 20 synthetic images (max |Δ| 2·10⁻⁶) and measures the image-embedding spread
  (pairwise cosine 0.997–1.000). The collapse is therefore a property of the pinned model's pooled image embedding, not
  of the harness. Nothing is changed in V2; its preregistered τ procedure gave τ = 0.95.
- **Bug fix in `assemble.py` (no outcome change).** The first assembly run stopped with a KeyError: the V1/V2 routing
  files also hold the synthetic rows, which are not corpus assets. The fix skips ids absent from the corpus (they are
  scored by `score_features.py`). The documents and gates of V0a/V0b written before the stop were regenerated identically.
- **`claims.py` was written after the preregistration** (§5.3 named the measurement — edition-level publisher-claim
  consistency — but not its code). It reads the product's own category breadcrumb ("należy do kategorii") and its
  `#bottom-description` text; the first two selector versions found nothing and were corrected before any comparison was
  read. It is descriptive only and feeds no decision rule.
- **`mutations.py` M10** first looked for a V2 edition summary; V2 proposes nothing under its own routing, so M10 now uses
  the first contender that has a summary (N1). 12/12 mutations caught.

### Addendum C — written 2026-10-15T03:33Z (after the three reviews; every item is post-hoc)

Nothing in §8 changes. The preregistered truth, contenders and thresholds stay the headline; everything below is either
a correction of a defect in the research tooling or a **sensitivity** run reported next to the headline, never instead
of it.

**Erratum (reviewer B-9).** The headers of Addenda A and B carry wrong times. A was committed at 2026-10-15T01:54:14Z
(`cfe95ab`), not 02:10Z; B at 02:41:05Z (`da66e48`), not ~04:10Z. The ordering claim of A (before any V2 output was read) rests on file times outside Git: truth.json 01:36:23,
role-scores-partial.json 01:53:19, commit `cfe95ab` 01:54:14, and V2.json (the first file derived from V2 output, the
scored routes) written 02:28:39. V2 run 1 was already running before A (v2-run1.log created 01:36:28, last written
02:27:01; v2-run1.jsonl created 01:36:46, complete 02:28:04). File times show when V2 output was written, not when it
was read; the claim is that V2 was not scored before 02:28:39. The texts of A and B are left as committed.

**C1 — truth defect, interiors carousel (reviewer B-1, P1, confirmed).** 15 items of the ARCHON interiors carousel are
exterior views (their captions name a styling variant or "all segments"); the structural rule made them
INTERIOR_RENDER. All 15 are in DEV. `addenda/c_truth_variants.py` writes two variants: C1x (the 15 excluded as
TRUTH_CONFLICT) and C1r (relabelled EXTERIOR_RENDER). V1 and V0b are refitted on DEV under each (`addenda/c_run.sh`).

**C2 — page view copies without truth (reviewer B-2, P1, confirmed).** 150 assets whose file name is `widok-<n>` (a
page view of the house) carry no structural truth and were therefore not scored, although V1 routes many of them. C2
labels them EXTERIOR_RENDER from that slug (basis SLUG, independentOfV0 = false). C12 combines C1r and C2.

**C3 — V0a byte-only matching (reviewer C-2, P1, confirmed).** V0a joins the incumbent's output to 005R assets by exact
byte hash; the incumbent fetched carousel thumbnails, 005R scores the full-size originals, so the incumbent's
roles for those originals were reported NOT_ACQUIRED. `addenda/c3_v0a_lineage.py` maps them through the page's
carousel anchor (original ↔ thumbnail). This corrects a claim of the draft report (see the report §F).
Disclosure: the V0 run was offline only in its two replays. The first (seeding) run let the unmodified production
command fetch what the seeded cache lacked: the cache holds 1 205 entries not hard-linked from the 005R corpus, written
01:37–01:44Z (710 JPEG, 158 GIF, 337 HTML; about 100 of the HTML are survey/carousel pages, so roughly 1 100 are real
production cache-miss fetches). They went through the production URL-safety layer; the cache keeps no URLs, so their
hosts are not re-verified here. No such bytes enter Git.

**C4 — tooling corrections after the reviews (no rule change):**
- `schema/validate.py` (reviewer A-2, P1): closed key sets at every level, list elements walked, authority values
  case-insensitive, metric text in prose rejected, confidence range checked, exterior claims refused on assets not
  routed to exterior evidence, role evidence must agree with the role, the manifest's sizes and lineage groups are
  binding, witness counts are integers bounded by distinct lineage groups. 24 of reviewer A's 25 bypass documents are
  now unit tests; the 25th (a summary row naming an observation that does not exist) cannot be checked from a summary
  alone and is checked by the assembler (`DANGLING_SUPPORT`, mutation M13).
- `assemble.py` (reviewer A-4): V1 cues on assets V1 does not route to elevation evidence are kept as REJECTED records
  instead of being dropped.
- `score_roles.py` (reviewers A-3, B-8): V0a's consumer leakage (interiors the incumbent labels PERSPECTIVE_RENDER,
  which `analyze.ts:164` feeds to the facade extractors) is reported as its own field.
- `score_features.py` (reviewers B-3, B-7): the interior control is now also counted without the routing gate (the
  preregistered control); the edition-pair control maps the closed-garage look-alike to the kind it carries.
- `mutations.py` (reviewer C-10): M11/M12 count only when the unmutated baseline runs exactly one passing test; M13 added.

**Other disclosures.** Six lineage groups cross the DEV/EVAL split (reviewer B-5; dHash connected components chain
different families' drawings; none is in a gating class). V0b's stump on scene features is the constant
"IF TRUE THEN INTERIOR" on DEV (reviewer C-2), so V0b equals "V0a, and INTERIOR_RENDER for everything V0a leaves
UNKNOWN"; it is reported as such.

**Order deviation (reviewer C-6).** §9 asked for the V0a offline replays before V1/V2. The actual order (file times):
preregistration commit 01:36:09 → V2 run 1 started ≈ 01:36:37 (ended 02:28:04) → V1 features r1 written 01:42:11 →
V0 offline r1 finished 01:46:55, r2 01:49:04 → V1/V0b fit and scores → Addendum A (01:54:14) → V2 scored (V2.json 02:28:39) → V2 run 2 (determinism) started
≈ 02:28:40, right after run 1, and ran until 03:27:43, through Addendum B (02:41:05) and the reviews (≈ 02:43–03:14) →
its comparison written 03:32:17 → A1 for V2 started 03:32:25 → Addendum C written 03:33Z. Harmless for the results: V0 never reads V1 or
V2 output, and no V2 output was read before Addendum A.

**Wording corrections.** (C-7) V1's three feature files are not byte-identical: they differ in the per-image timing
field `ms`. The feature payloads (width, height, features) are identical on 1 537/1 537 images across Node 22 ×2 and
Node 18.20.4, and the fitted model and predictions are byte-identical from any of the three. (C-8) A1 for V2 — routing
with WHITE padding — was not run before the reviews; it runs after V2 run 2 and is reported in the stage report. A grey
letterbox is V2's own preprocessing, so the grey variant is the identity for V2.

**Files created or changed after `bdd50b8` (reviewer C-5): research files, plus the 005R block of the repository
isolation test.** None feeds a §8 decision input except through
the scorers named in §5; all are diagnostics, sensitivity runs, tooling fixes or tests. SHA-256 at the commit that
carries this addendum:

| file | status vs `bdd50b8` | first commit | SHA-256 (first 16) | role |
| --- | --- | --- | --- | --- |
| `acquire.py` | changed | `5e9bc93` | `23a9d14cd7760bf9` | acquisition (ran before; fix for future runs) |
| `addenda/a1_aspect_v1.mjs` | added | `30dd205` | `2e917280c6b36fa3` | diagnostic / sensitivity (addendum) |
| `addenda/a1_aspect_v2.py` | added | `30dd205` | `6be85c7fc71a76cb` | diagnostic / sensitivity (addendum) |
| `addenda/a2_propagate.py` | added | `30dd205` | `c7377d16099abc79` | diagnostic / sensitivity (addendum) |
| `addenda/b1_v2_faithfulness.py` | added | `da66e48` | `39abc1f4e38e2c00` | diagnostic / sensitivity (addendum) |
| `addenda/c3_v0a_lineage.py` | added | `b98927b` | `8bbde289c7ff4c49` | diagnostic / sensitivity (addendum) |
| `addenda/c_run.sh` | added | `b98927b` | `86404827acf3aeac` | diagnostic / sensitivity (addendum) |
| `addenda/c_truth_variants.py` | added | `b98927b` | `9008eaf97b1bfb4b` | diagnostic / sensitivity (addendum) |
| `assemble.py` | changed | `5e9bc93` | `22e9a38de1732416` | scorer / assembler / validator (fixes in addenda B, C) |
| `bench.py` | added | `30dd205` | `64430c3236d936d7` | measurement code named in §5 |
| `claims.py` | added | `da66e48` | `9aa125d3af21dd35` | measurement code named in §5 |
| `edition_identity.py` | added | `cfe95ab` | `41dd867905fe927e` | measurement code named in §5 |
| `licensing.md` | changed | `5e9bc93` | `035d65b9b6a67475` | prose (licence matrix; C-9 corrections) |
| `mutations.py` | added | `30dd205` | `be35152b63f7a93f` | safeguard suite (§9 named the mutations, not their code; written whole after `bdd50b8`) |
| `schema/examples/example-manifest.json` | changed | `5e9bc93` | `1ac99b26654f8d79` | test |
| `schema/test_schema.py` | changed | `5e9bc93` | `b0aa0c226ff118b2` | test |
| `schema/validate.py` | changed | `5e9bc93` | `f929ee0ec7d05278` | scorer / assembler / validator (fixes in addenda B, C) |
| `score_features.py` | changed | `80b455d` | `878a8dfd879e6f2d` | scorer / assembler / validator (fixes in addenda B, C) |
| `score_roles.py` | changed | `5e9bc93` | `53745b6123a7c1f0` | scorer / assembler / validator (fixes in addenda B, C) |
| `tests/architecture/research-isolation.test.ts` (005R block; path from the repository root) | changed | `20fffbd` | `7545d6da6efd3514` | test (isolation; A-10 strengthening; run by mutations M11/M12) |

The preregistration file itself carries the addenda.
