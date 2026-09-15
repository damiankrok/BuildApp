# Marcówki source revision policy

*Dom w marcówkach (GE)* is published by ARCHON in more than one revision, and
the revisions disagree. This document states which source wins, why, and what
that is allowed to change. It exists because the failure mode it prevents is
silent: a model that quietly averages two revisions, or that nudges a wall to
make a published area come out right, looks finished and is worthless.

The data behind this prose is `packages/reference-marcowki/src/revision.ts`
(`REVISION_CONFLICTS`, `PAGE_FETCHED`) and
`packages/reference-marcowki/src/published.ts` (`PUBLISHED_CURRENT`,
`PUBLISHED_ROOMS`). `npm run audit:marcowki` prints the conflicts and the
model's figure beside each one.

## The two revisions

| | current project page | older project card |
| --- | --- | --- |
| fetched | 2026-09-15 | quoted in the stage brief; the download is behind a request form and was not retrievable in this session |
| house net area | **129.04 m²** | 129.15 m² |
| garage | **24.10 m²** | 23.85 m² |
| Schody (stairs) | **5.63 m²** | 5.62 m² |
| roof area | **150.57 m²** | 168.48 m² |

Every one of those four is a published **aggregate**. None of them is a
dimension. The dimensioned drawings — the ground plan, the attic plan, the
section and the four elevations — are the same in both revisions as far as
this stage could check, and every geometric figure in the model comes from
them.

## The three rules

1. **The current page is the reference for published room and area facts.**
   It is the live revision; a reader can open it and see the same numbers.
   Where the older card differs, both values are recorded in
   `REVISION_CONFLICTS` with the one the reference uses and why.
2. **A dimensioned technical drawing outranks any published figure**, current
   or older, for anything geometric. Where the page and a drawing disagree,
   the drawing wins and the difference is recorded as a contradiction, not
   resolved by preferring the rounder number.
3. **An aggregate area never moves a dimension.** No wall, room boundary,
   roof extent or storey height in this model was chosen to make a published
   total come out right. Where a published total and the transcribed geometry
   disagree, the disagreement is carried in the ledger
   (`packages/reference-marcowki/src/ledger.ts`) and printed by the audit.

Revisions are never mixed silently. A fact that exists in both revisions is
cited from the current page; a fact that exists in only one says so
(`olderCard: null`).

## What the difference actually costs

**Nothing geometric.** The four conflicting figures are aggregates the model
does not consume:

- *House net area, garage, Schody* are room totals measured to finished
  surfaces (the page prints a net and, for eight rooms, a gross). The model's
  rooms are plan polygons to structure. The two conventions differ by roughly
  the finish thickness per face whichever revision you take, so an 0.11 m²
  or 0.25 m² drift between revisions changes no boundary. The model's room
  polygons come from the printed chains and the plan raster.
- *Roof area* the model does not read at all: the roof is built from the
  printed 7.90 span, the printed 40°, the +7,95 ridge and the 14.60 m side
  silhouette.

The audit checks the published room table composes the way the page says it
does — the fifteen counted rooms' net areas plus the Schody give exactly the
published 129.04 m² — which is how we know the table was transcribed right
rather than merely copied.

## The roof area is the interesting one

The two revisions differ by 17.91 m² on the roof, which is far too big to be
a rounding or a convention. The current figure decides it:

```
7.90 m × 14.60 m ÷ cos 40°  =  150.566 m²      published (current): 150.57 m²
```

The model's own roof measures the same to within 4 mm² once the three
rooflights and the two flue penetrations cut out of it are added back
(`npm run audit:marcowki`, "roof area"). That is a genuine corroboration and
it is worth naming precisely: the published aggregate independently confirms
both that the roof runs the **full 14.60 m** characteristic extent — not the
12.60 m walled envelope — and that its pitch is **40°**. The older card's
168.48 m² matches neither the walled envelope nor the full extent at any
pitch the drawings support.

So the current page is not merely the newer revision here; it is the one that
agrees with the drawings. That is why it is the reference.

## Where a published figure and a drawing still disagree

Two cases survive, both recorded rather than closed:

- **Footprint.** The page prints 131.16 m². The printed chains
  790 + 415 across and 510 + 750 deep close on 130.665 m², 0.38 % below. The
  chains are used. The published figure may include the plinth or a
  projection; nothing in the drawings says which, so nothing is assumed
  (ledger `footprint-area`).
- **Schody.** The page prints 5.63 m². The stair compartment the attic plan
  draws is 8.31 m² gross, and the floor void the stair actually needs is
  4.158 m². The page evidently counts the stair by a projection no drawing
  shows. The plans are used (ledger `schody-area`).

Both are printed by the audit with the delta and the cause beside them, every
run.

## If a third revision turns up

Add its conflicting figures to `REVISION_CONFLICTS` with `uses` set by the
three rules above, and leave the geometry alone unless the *drawings*
changed. If a drawing changed, that is a new transcription, not a revision
note: re-read the affected chains, update `facts.ts` with the new locator,
and re-freeze the fixture in the same commit.
