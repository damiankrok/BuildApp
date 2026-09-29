# 10 — Council synthesis

Inputs: the seven reviewer reports in `reviewers/` (A–G), the orchestrator's baseline runs and
plan-copy replays (`../../before/`), and documents 01–09 in this folder.

## The finding in one paragraph

The analyzer does not fail on unseen houses because of one bad threshold. It fails because it is a
**serial pipeline of single winners** — one plan copy per storey, one extent (the widest read chain),
one scale (a thin vote whose losers are rewritten to agree), one OCR orientation per page, one region
merge — and then a **terminal gate on the first reading**. Every house that passes does so because
each single winner happened to be right on it; every house that fails, fails at whichever winner was
wrong first, and fixing that one exposes the next. The two OWNER phone failures are the same event:
three of four ground-plan copies were not available on the phone, and the surviving area-table copy
was read as if it were the dimensioned sheet (reproduced number for number). The tracking query does
not change the evidence at all; it changes identity and every intermediate hash. And the 63 % screen
is a 164–193 s synchronous pass that emits nothing.

## Preserve (KEEP)

- The acquisition security fence and per-hop SSRF checks; decoded-size truth; the router; sealed
  replay and the content-addressed caches.
- The observation vocabulary and the deterministic CV (bands, masks, lines) as observation producers.
- The grid/cell decomposition, flood fill, H0/H1 enclosure and wide-opening logic — **unchanged as the
  incumbent family A**; the storey alignment search; the §21 projection audit; the layout gate's
  checks as *candidate* checks.
- Every canonical model validator, `WALLS_OVERLAP` at 1e-6 m², the wall-topology planner, command
  ordering, `verifyReplay`.
- The trace, the diagnostics bundle, typed failures.
- The model and scene of every accepted house, byte for byte.

## Refactor

- **Source identity** (A): logical identity (canonical link on the same site → normalised URL with
  tracking families removed); content hash over evidence (no `pageHash`); final URL stored with the
  cached page; acquisition losses counted by claimed document role; one retry on transient errors;
  a user abort is not a timeout; the asset loop stops on abort; the body read has a deadline.
- **The structural pass entry** (C): `composeStructuralLayout` is wrapped by `resolveStructuralLayout`;
  `readPlans`, `decomposePlan`, `axisLadder` and region formation accept an optional hypothesis whose
  absence means exactly today's behaviour.
- **Emission** (F #1): refused opening commands are dropped with a reason instead of aborting.
- **Warnings** (Marcówki audit): typed with a severity; only LIMITATION warnings make a model limited.
- **`SOLVER_V2_VERSION` → 2.2.0** (F): the candidate names the new rule set; model/scene unchanged.

## Delete

- Nothing on the production path in 005A. (Dead code found — `attachedCapIds`, `groupVariants`, the
  unreachable host-drop branch — is recorded; deleting it belongs with the fix that revives it.)

## Instrument

- `AnalysisProgressEvent` from a write-only `Checkpoint.tick()` at every long loop: acquisition per
  address, observation per asset and per preparation step, metric pass per frame and per callout ring,
  structural pass per plan copy, resolver per candidate, v2 per phase and per camera (E).
- A resolver trace in the plan diagnostics: every candidate with its hypothesis, score breakdown and
  rejection reason (C M8).
- Per-phase performance record (wall, CPU, ticks, max tick gap, RSS) outside every hash (E).
- Measurements (not gates) of D's invariants on the development set: leave-one-copy-in and
  cross-copy resize invariance.

## Make multi-hypothesis (bounded)

| Decision | Candidates | Bound |
| --- | --- | --- |
| plan copy | every decodable copy of the base storey | ≤ 4 |
| extent | CHAIN_RECT (today), WALL_MASS_CLUSTER (opened ink mask, components joined across opening-sized gaps) | 2 |
| scale | REGISTRATION (today); ≤ 2 LATTICE scales implied by the overall chains' own readings (exact first readings and their sealed alternatives), only when the registration is contradicted | ≤ 3 |
| merge | LARGEST_FIRST (today), WALLED_FIRST | 2 |
| faces | AS_GRIDDED (today), OUTER_FACE_FOR_BAND_ONLY_SIDES | 2 |

≤ 24 decompositions (copy × extent × scale) scored cheaply; merge and faces are post-processes;
≤ 4 distinct outlines composed in full. No wall-clock budget: bounds are counts, so a slow phone gets
the same answer.

## Gates that become scores

`FOOTPRINT_AREA_WRONG`, the `planFailureOf` ladder (`PLAN_NO_WALLED_ENVELOPE`, `PLAN_GRID_EMPTY`,
`PLAN_NO_ENCLOSED_CELLS`, `PLAN_NO_BUILT_REGIONS`, `PLAN_NO_MASSES`), the 0.35 wall-fraction cliff,
`STRUCTURE_SILHOUETTE_DISAGREES`. Ordering is lexicographic on buckets that are existing constants
(hard violations, gate refusals, footprint bucket AGREES ≤ 6 % < UNKNOWN < NEAR ≤ 20 % < WRONG,
refuted statements, wall coverage and corroborations, departures from the incumbent, id). The
published footprint ranks and refuses; it never generates. A non-incumbent candidate is accepted only
with AGREES, or NEAR plus ≥ 1 corroboration independent of the published figure, or UNKNOWN plus ≥ 2.
Otherwise the run ends `PLAN_RESOLUTION_INCONCLUSIVE` with the attempted count, the best candidate,
its hard violations, the strongest conflicts and the missing evidence.

## Validators that stay hard

See `04-hard-vs-soft-constraints.md` §1: the URL fence; decoded-size truth; every model validator
(`WALLS_OVERLAP`, referential, junction/ring, host, assembly honesty); `verifyReplay`; and per
candidate — no frame/envelope/body, degenerate geometry, anisotropy > 1.15, mass overlap at acceptance.

## What is NOT done in 005A (named, for the next stage)

The OCR orientation vote and the additive scale vote (B F1–F3); demand-driven metric evidence (E W8);
capping attached ring walls (F #4); planner junction records (F #3); front = sheet bottom and the two
storey-index maps (D); free-text `localeCompare` (A); resolving a PARTIAL incumbent.
