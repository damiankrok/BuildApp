# OWNER spot-review request (local, optional) — 005R-ROUTER

**Status: `NOT_RUN_HUMAN_TRUTH`.** No person has labelled any image for this stage. Claude did not open the images
and labelled nothing; repeated OCR or model runs do not count as a reviewer (brief §4). This file is a request, not a
result. Nothing in this stage's verdict depends on it being answered.

## What is prepared

`research/analyzer-005r-router/spot_review.py` built a seeded task list (seed `BUILDPLAN-005R-ROUTER-SPOT-REVIEW`, so
the draw cannot be re-rolled) from the 005R corpus that already sits on this machine:

| stratum | what | items |
| --- | --- | --- |
| S1 | every interiors-carousel item whose caption names a styling variant or all segments (005R C1) | 15 |
| S2 | every `widok-<n>` page image without structural truth (005R C2: 150 assets), one per lineage group | 95 |
| S3 | structural interiors (carousel position), at most 2 lineage groups per family | 34 |
| S4 | page-tab elevations (technical or photo-real orthographic), at most 2 lineage groups per family | 68 |
| S5 | every asset of OWNER's anchor edition `m3ea28300f9b3e` and of Rarytasy 5 (G2E) `m84f2903cb8e14` — **DEV only** | 88 |

- Committed: `spot-review-manifest.json` — asset SHA-256, edition ids, lineage group, split, stratum. No caption, no
  URL, no pixel.
- Private (outside Git): `/home/user/work005r-router/spot-review/spot-review-tasks.json` — the same rows with the local
  file path and empty answer slots.

## Questions per image (closed lists, `CANNOT_TELL` always allowed)

- **scene scope**: `INTERIOR` / `EXTERIOR` / `BOTH_VISIBLE` (an interior with the garden through a window counts here) /
  `NOT_A_SCENE` / `CANNOT_TELL`
- **projection**: `ORTHOGRAPHIC_FACADE` / `PERSPECTIVE` / `PLAN_OR_SECTION` / `CANNOT_TELL`
- **drawing kind**: `TECHNICAL_LINE_DRAWING` / `PHOTO_REAL_RENDER` / `PHOTOGRAPH` / `CANNOT_TELL`
- **same house as its edition** (S5 only matters): `YES` / `NO` / `CANNOT_TELL`

## Protocol, if OWNER chooses to answer

1. Open the private task file on this machine (or a copy on OWNER's own computer). The images are never uploaded,
   never sent to a model, and never committed.
2. The existing 005R label is stored with `shownToReviewer: false`. Hide it while answering; it is the publisher's
   filing, which is what is being checked.
3. Fill `answer`, `reviewer` (initials) and `reviewedAt`. One pass; no edits after a later stage has scored against
   the answers.
4. A second, independent reviewer on a seeded 20 % subset gives inter-rater agreement; without it the labels are
   `HUMAN_VERIFIED_SINGLE`.
5. A later stage freezes the answered file by hash **before** any router is scored on it. S1–S5 are 005R DEV / prior
   exposure; they can calibrate, never serve as a blind.

## Why it matters

Any future change that classifies *scenes* (interior vs exterior) and lets that classification change what reaches
geometry needs this truth (brief §6). The change this stage evaluates (N1) does not classify scenes; its claims are
bit-level and need none of these labels. That distinction is the reason the request is optional here.
