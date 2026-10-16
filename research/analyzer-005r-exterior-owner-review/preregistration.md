# 005R-EXTERIOR OWNER truth pack — preregistration (written before any queue-building or UI code)

Written 2026-10-16T11:38Z on `analyzer/exterior-owner-truth-review-pack-v1`, base
`47bafa6352df473f79992b7377d14ca1808ce767`. Nothing below was tuned on an answer: no OWNER answer exists, no publisher
image was opened by me or any model, and the only real inputs are the committed JSON of 005R / 005R-EXTERIOR.
`build_pack.py` records this file's SHA-256 in every pack it writes; a later change is an addendum at the end.

## 1. Purpose and non-goals

A small, offline review pack in which the OWNER — a person, on their own machine — labels what is visible on real
exterior source images of the 005R-EXTERIOR corpus. It is **not** a classifier: nothing in the pack assigns an answer.
It produces no accuracy number; until a completed OWNER review exists every class accuracy and gain is `NOT_MEASURED`.

## 2. Inputs (committed, read-only)

| input | use |
| --- | --- |
| `research/analyzer-005r-exterior/results/corpus-manifest.json` | assets, byte hashes, lineage groups, editions, purposes, memberships, claims, technical features |
| `research/analyzer-005r-exterior/results/proposals-B1.json` | the 19 abstained `FEATURE_VISIBILITY` questions; B1 scene roles; frame feature proposals |
| `research/analyzer-005r-exterior/results/addendum-e-strict.json` | strict recount (phase-2 display only) |
| `stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json` | 005R canonical project-page URL per edition, per-asset URL basename (variant matching, page locator) and byte size |

## 3. Question vocabulary

Feature classes (brief §1): `PERGOLA, CARPORT, ENTRANCE_CANOPY, COLUMN, BALCONY, LOGGIA, RAILING, TERRACE, GARAGE,
ROOFCOVER, OPENING_GLAZING, UNKNOWN_ASSEMBLY`, plus the scene question `SCENE_SCOPE` (interior vs exterior). Mapping to
B1: `COLUMN→COLUMNS_SUPPORTS`, `GARAGE→GARAGE_ENCLOSED`, `OPENING_GLAZING→LARGE_GLAZING`, others identical;
`ROOFCOVER` has no B1 class.

- Feature answer: `PRESENT | ABSENT | NOT_SHOWN | CANNOT_TELL`. `ABSENT` = the part of the house where it would be is
  visible and it is not there; `NOT_SHOWN` = that part is not in the picture; `CANNOT_TELL` = visible but undecidable.
  A visible interior is a negative for external architecture (window or column inside ⇒ not the exterior feature).
- Cover type (only `PERGOLA, CARPORT, ENTRANCE_CANOPY, TERRACE`, only when `PRESENT`): `OPEN_MEMBERS |
  CONTINUOUS_COVER | NO_COVER | UNKNOWN`. Assembly kind (only `UNKNOWN_ASSEMBLY`, only when `PRESENT`):
  `GARAGE | COVERED_TERRACE | ENTRANCE_CANOPY | CARPORT | OTHER | UNKNOWN`.
- Scene answer (reused from `research/analyzer-005r-router/spot_review.py` `sceneScope`): `EXTERIOR | INTERIOR |
  BOTH_VISIBLE | NOT_A_SCENE | CANNOT_TELL` (`NOT_A_SCENE` = technical drawing, plan, diagram).
- Optional, only when the reviewer is sure: region `[x0, y0, x1, y1]` normalised to [0, 1], `0 ≤ x0 < x1 ≤ 1`,
  `0 ≤ y0 < y1 ≤ 1`, rounded to 3 decimals; facade side `FRONT | GARDEN | LEFT | RIGHT`; mirrored `YES | NO`.
- No answer is pre-filled. A question without an explicit answer is `UNREVIEWED`, never `ABSENT`.

## 4. Queue rules (deterministic; `SEED = BUILDPLAN-005R-EXTERIOR-OWNER-REVIEW-V1`, `rank(k) = sha256(SEED:k)`)

Anchor asset of a (lineage group, edition): the asset of that group published by that edition (its `editions`
contains it); among several, prefer for a conflict control the one in the interiors carousel, for an elevation the one
in the elevations tab, otherwise 005R `structureRole005r` equal to the group's purpose, then the larger pixel area,
then the lowest byte hash. A question's **accepted bytes** are the anchor plus every other asset of the same lineage
group, published by the same edition, whose 005R URL basename names the same publisher file (32-hex token + `__id`,
or the whole basename when it has no token). Bytes of another edition are never accepted, even if the pixels are
near-identical (`lg-0ec5494a5b15`: OWNER `m3ea…` vs Rarytasy 5 (G2E) `m84f…`).

- **R1 (priority)** every B1 `FEATURE_VISIBILITY` proposal → one feature question on its own asset and edition (19).
- **R2 look-alike partners** on the same 5 frames, only for classes not already asked: `GARAGE ⇒ CARPORT`,
  `BALCONY ⇒ LOGGIA`, `TERRACE or ENTRANCE_CANOPY ⇒ COLUMN`. These are not publisher claims, so the question set is
  not a list of what the publisher says the house has.
- **R3 scene** one `SCENE_SCOPE` question for every exterior-render lineage group whose selected edition's B1 scene
  role abstained, plus OWNER's anchor frame.
- **R4 interiors and conflict controls** one `SCENE_SCOPE` question per interior-negative and structure-conflict
  lineage group, anchored to one edition: OWNER's `m3ea…` if selected for it, else the lowest-ranked selected edition.
  A byte-shared group selected for several editions gets **one** question; its answer is never copied to the others.
- **R5 elevations** one feature question per edition on its B1 `TECHNICAL_ELEVATION` frame (lowest hash if several).
  Class: the B1 frame-feature class on that frame if one exists; else, if R1 asked classes for that edition, the
  lowest-ranked of those that is distinctive (`PERGOLA, CARPORT, ENTRANCE_CANOPY, COLUMN, BALCONY, LOGGIA, RAILING`),
  or of all of them when none is; else the lowest-ranked distinctive class (`rank(edition:class)`).
- **Dedup** key (edition, lineage group, kind, class): a key produced twice keeps the first rule in the order above.
- **Tiers.** `PRIORITY` = R1 ∪ every question anchored to `m3ea28300f9b3e` ∪ the two structure-conflict controls.
  `SECONDARY` = the rest, in buckets S1 (R3) → S2 (R2) → S3 (R5) → S4 (R4), each ordered by `rank(questionId)`.
- **Cap** 60 questions; whatever falls beyond it is listed in `results/exclusions.json` with reason `CAP_60`, as are
  byte-shared and cross-edition non-propagations. Fewer than 60 is reported, never padded.
- **Display order** tier, then image `rank(imageId)`, then `rank(questionId)` within the image, so questions about one
  image follow each other and editions are interleaved.

`questionId = q-` + first 12 hex of `rank(edition:anchorByteHash:kind:class)`; `imageId = img-` + first 10 hex of
`rank(anchorByteHash)`. Both are neutral: neither names the house, the class source or the publisher's filing.

## 5. Files and schemas

- `pack/queue.json` (+ identical `pack/queue.js` wrapper for `file://`) — schema
  `research.005r-exterior.owner-review-queue.0.1`. Blind-safe: ids, anchors, accepted hashes, kind, class, tier, order,
  pixel size. **No** publisher channel, caption class, claim, B1 status, page URL or view hint.
- `pack/crosscheck.json` (+ `.js`) — schema `research.005r-exterior.owner-review-crosscheck.0.1`; phase-2 only: source
  kind, publisher channel, view hint from the URL token, B1 scene / frame / edition status, strict recount, claim
  polarity, schedule kinds, production features of the class, same-edition question ids, project page URL, page locator,
  page access check. The UI loads it only after the blind answers are sealed.
- `pack/labels-template-EMPTY.json` — every question `UNREVIEWED`.
- Labels export — schema `research.005r-exterior.owner-review-labels.0.1`: pack id, queue SHA-256, phase-1 seal
  digest; per question `questionId, projectEditionId, lineageGroup, anchorByteHash, reviewedByteHash, kind,
  featureClass, status (UNREVIEWED | REVIEWED_VISUAL | TECHNICALLY_CROSSCHECKED), metricAuthority (always NONE),
  reviewerOrigin (OWNER_LOCAL_REVIEW only after a click; SYNTHETIC_EXAMPLE only in the synthetic pack), viewingMode
  (LOCAL_BYTES_HASH_MATCHED | MANUAL_PAGE_FALLBACK_NOT_BLIND), phase1 {answer, cover, assembly, region, side,
  mirrored, notes, answeredAt (only if chosen)}, phase2 {technicalEvidence, evidenceSource, notes}, conflict`. No
  pixels, no URLs, no publisher prose, no cloud ids, no measurement. Keys sorted, questions in queue order, UTF-8, LF.
  CSV carries the same rows, one per question.

## 6. Phases

1. **Blind image-only.** Image (only from local bytes whose SHA-256 is in the accepted set), neutral id, question,
   answers. If no matching bytes: `SOURCE_IMAGE_UNAVAILABLE` and the answer buttons stay disabled, unless the reviewer
   explicitly switches that question to the manual page fallback, which is recorded as `MANUAL_PAGE_FALLBACK_NOT_BLIND`.
2. **Seal.** One global seal; the digest is SHA-256 over the canonical phase-1 answers. After it, phase-1 answers are
   read-only and unanswered questions stay `UNREVIEWED` (the blind window is closed for all of them).
3. **Technical cross-check.** Only then is `crosscheck.js` loaded. `technicalEvidence`: `TECHNICAL_SHOWS |
   TECHNICAL_DOES_NOT_SHOW | NO_TECHNICAL_EVIDENCE | CANNOT_TELL`; `evidenceSource`: `ELEVATION_IN_PACK |
   PLAN_OR_SECTION_ON_PAGE | ELEVATION_ON_PAGE | OTHER`. `conflict = true` when phase 1 says PRESENT and phase 2
   DOES_NOT_SHOW, or ABSENT and SHOWS. A conflict is kept, never resolved by overwriting. `TECHNICALLY_CROSSCHECKED`
   needs a phase-1 answer and a technical evidence value other than `CANNOT_TELL`. No metric value is ever recorded.
4. **Export / import** deterministic; import refuses wrong schema/pack/queue hash, unknown or duplicate question,
   anchor/edition/lineage not matching the queue (forged cross-edition answer), reviewed bytes outside the accepted set,
   out-of-vocabulary answers, sub-answers where not allowed, malformed region, a phase-1 digest that does not match the
   phase-1 answers, a phase-2 entry without seal, a non-`UNREVIEWED` row without an allowed origin, pixels/URLs.

## 7. Cheap checks (synthetic only)

T1 19/19 B1 questions represented once or excluded with a reason. T2 no anchor crosses `m84f…`/`m3ea…`; same pixels in
two editions stay two questions or one non-propagated question. T3 no default answer; unanswered exports as
`UNREVIEWED`; `NOT_SHOWN`/`CANNOT_TELL` never become PRESENT/ABSENT. T4 the blind queue carries none of the phase-2
keys; sealing freezes phase 1. T5 normalisation, duplicate files, reordered inputs (queue byte-identical), export
determinism, import tampering, forged cross-edition answer. T6 exports carry no image, URL, publisher prose, cloud id or
measurement. T7 the page makes zero network requests in the blind phase (Chromium, synthetic images); missing bytes ⇒
`SOURCE_IMAGE_UNAVAILABLE`. T8 a clean-directory smoke run with synthetic images: open, load, answer, seal, cross-check,
export, re-import.

## Addenda

- **Addendum A (2026-10-16T11:55Z, after `build_pack.py`, before any review-page or core logic; no answer exists).**
  (1) Phase 2 of a `SCENE_SCOPE` question records `sourceContext: AGREES | DISAGREES | NO_CONTEXT` instead of
  `technicalEvidence`: the publisher's filing is not technical evidence, so a scene question never becomes
  `TECHNICALLY_CROSSCHECKED`; `conflict = true` on `DISAGREES`, and the phase-1 answer stands. A feature question's
  phase 2 needs `evidenceSource` whenever `technicalEvidence` is `TECHNICAL_SHOWS` or `TECHNICAL_DOES_NOT_SHOW`.
  (2) The per-question page locator (project page + gallery section + publisher image number) lives in its own file
  `pack/manual-locator.js`, loaded only when the reviewer explicitly switches a question to the manual page fallback;
  the cross-check keeps it too. (3) `results/page-access.json` (from `check_page_access.py`: page GETs, fancybox-page
  GETs and image HEADs only, zero image bytes) feeds `pageAccess` in the cross-check. (4) The single labels validator
  is the page's own `tool/review-core.js`, also run by Node (`tool/validate-labels.mjs`); there is no second validator
  in Python. (5) The demo is a separate synthetic pack (`examples/synthetic/`) with uncompressed BMP images written by
  `make_synthetic_demo.py` outside the repository, so its byte hashes do not depend on a compressor version.
- **Addendum B (2026-10-16, after the one independent static audit; still no answer exists; post-hoc).**
  (1) *Audit P0:* the tier is assigned per **image**: every question on a frame that carries an R1 question is
  `PRIORITY`, so a claim-derived R1 class and its non-claim R2 partner on the same picture can no longer be told apart
  by tier (PRIORITY 26 → 34, SECONDARY 34 → 26). The R5 elevation class is drawn from the edition's R1 **and** R2
  classes for the same reason. (2) *Audit P1:* the seal is an unkeyed SHA-256 over answers in the same file — it
  catches accidental or tool-side changes, **not** a deliberate edit by someone who recomputes it; the coordinator
  should record the sealed digest out of band before phase 2. The page now remembers (per browser) that phase 2 was
  shown and then refuses blind answering and unsealed imports there. (3) *Audit P1:* the OWNER interior question
  (`lg-086ff7389bb2`) accepts bytes that are byte-identical to files also published by `m738…` and `m84f…`; identical
  bytes cannot be told apart by origin. This is the one stated exception to "bytes of another edition are never
  accepted": the answer is about that picture, is recorded under `m3ea…` only, is never propagated, and the cross-check
  lists `acceptedBytesAlsoPublishedBy`. (4) R3 skips structure-conflict groups (they are asked once, by R4, on the
  interiors-carousel copy). (5) `TECHNICALLY_CROSSCHECKED` only with `TECHNICAL_SHOWS` or `TECHNICAL_DOES_NOT_SHOW`.
  (6) Determinism: B1 and strict rows are sorted before any lookup; dedup exclusions carry `b1ProposalId`. (7) Notes
  also refuse host-like text and image file names; CSV cells starting with `= + - @` are quoted. (8)
  `check_page_access.py` no longer follows redirects. The synthetic example's digest is still written by Python; its
  equality with the JS digest is tested (`core.test.mjs`), and synthetic regions avoid 0/1 (Python `1.0` vs JS `1`).
