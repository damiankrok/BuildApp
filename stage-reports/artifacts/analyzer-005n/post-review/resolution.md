# 005N council — resolution

Five independent read-only reviewers (brief §33) reviewed `5957e3a..0e996b6`:

- A — facade topology;
- B — false-closure safety;
- C — evidence / non-circularity;
- D — generalization;
- E — regression / performance / Android.

Every P0/P1 they raised went to a separate agent instructed to refute it. That agent ran nothing and defaulted to "not real" when uncertain. Raw records, the verifiers' reasoning included: `council-findings.json`.

- **Raised:** 56 findings — 4 P0, 15 P1, 25 P2, 12 P3 as claimed.
- **Verified:** of the 19 P0/P1, 9 were confirmed at P0/P1, 5 downgraded to P2 and 5 refuted.
- **Fixed:** every confirmed P0/P1, in `65f0681` (plus `41d6395` for E1, and `M11` retargeted in the commit after `65f0681`).
- **Fixtures:** each fixed P0/P1 has a fixture that fails on the previous code; each has a mutation gate that a revert fails (`mutation-results.md`, M11–M14).

## Confirmed P0/P1 — fixed

| id | verified | defect | fix | gate |
| --- | --- | --- | --- | --- |
| B2 | P0 | a thin line or tile pattern between two returns read as the set-back wall; H1 shut it and the space behind became BUILT | between two returns' cross-sections a hole counts only as glazing standing alone (clear floor in front, nothing drawn a wall's breadth behind); beside a stretch of back wall as before; the scan starts no shallower than a return must run | A1/B2 fixture (one step; a flight); M12 |
| A1 | P1 | the same, shallowest hit winning: a phantom room filled the recess in front of its real back wall | as B2 | as B2 |
| B1 | P0 | the callout rule closed a recess or loggia whose back wall was not read ("deeper than a recess" never checked) | a callout closes a walled mouth only when both its walls run on deeper than a recess can be (`RECESS_MAX_DEPTH_M`) | B1/C1 fixture; M13 |
| C1 | P1 | the same seen from evidence: a loggia's back-glazing callout shut the loggia | as B1 | as B1 |
| A2 | P1 | the pocket test counted a sibling just shut in the next sibling's pocket: which of two mouths closed followed line order, so orientation | every undecided gap is weighed against the openings decided before the test; all own pockets are read before any decision is applied | A2 fixture (all five orientations); M11 |
| D1 | P1 | sibling mouths opening onto one space were each blind to it (it is reached through the other): an open-plan house behind two undrawn mouths stayed outside | the mouths that lead into a shared space (shutting one also takes away more than its own pocket) are weighed together, against the pocket their joint opening width allows (the pocket rule on the openings' total width; see round 2, R7) | D1 fixtures (open plan built; a pocket-sized shared space stays open); M14 |
| D2 | P1 | `infillRunsPast` looked past a short pier into the next window's glazing and called it a slab edge | glazing carrying on past a short pier into a window glazed between its own jambs is that window's, not a line running past — only when this mouth is itself glazing (a single line or a dashed one is never excused: the Kosaćce terrace stays open) | the 005N corpus (window–pier–window, fixture 5) and the Kosaćce rows unchanged |

## Downgraded to P2 by verification — fixed anyway

| id | defect | fix |
| --- | --- | --- |
| D3 / E4 / A8 | the separator bound took the first 8 candidates in drawing order | more candidates than the bound: the gap is left whole and recorded, never read in part |
| B4 | a recess mouth "glazed" by a line that runs past its jambs | a recess is shut by glazing or a leaf only when that line stops at its jambs |
| A6 | the mouth's signature read on a return cross-section's axis | read on the facade wall's own axis (its stretches along the line) |
| C2 | a gap whose candidates were all refused left no record (§19) | every facade gap the reader reads is on the record: cut, or left whole with what was found and why (`intervals: []`) |

Also fixed:

- **B3** (refuted): dashed or pattern infill never closes an interval. It costs nothing, and its fixture also guards the phantom back wall at a paving edge.
- **E1** (refuted only because it was already fixed): the reader skips unscaled plans (`41d6395`). That was also the source of the slowdown on unscaled rows.
- **E2** (refuted: §28 is covered by 005L's suite): a two-storey end-to-end fixture with a compound ground front was added anyway.
- **The adopted-outline record:** the box reading's spans stay on the digest when the outline is adopted, tagged `BOX`. I found this gap myself; no reviewer raised it.

## Refuted

| id | why (verifier) |
| --- | --- |
| A4 | the lintel edge the claim needs is missing its jamb on the grid the scenario produces; the recess stays open |
| B3 | the paving that triggers it also shuts the bay's edge in the untouched box closure at `5957e3a` — no regression; the residual is the incumbent per-edge rule (stage report) |
| B5 | `cornerJoined` does not take the joined band's whole run (`axisBox` uses its axis only), and murajach's extent/scale change follows the garage being in the plan, not the join's reach |
| E1 | already fixed at `41d6395` |
| E2 | §28's control exists; covered by 005L's storey suite (a fixture was added regardless) |

## P2/P3 left open, with reasons

- **A3, D6 — recess before infill; a recess shut only by glazing or a leaf on its axis.** Verified P2: a deliberate trade-off. One line at a face is a step, a slab edge or a sill as often as a door, which is the gozdzikowcach root. Shutting on it would bring back the false closures the stage removed. UNRESOLVED is never emitted; ambiguity is named in `why`.
- **A5, A9, A10, D14, E3 — grid granularity around recesses.** Back-wall lines only, no return lines; an added line spans the plan. Verified P2 and "the same as the starting code". Grid construction is outside 005N's scope.
- **A7 — WALL_RETURN on inward length alone.** A return must run ≥ max(0.9 m, 3 walls) of wall-thick ink from the facade's own wall. Requiring it to meet a back wall would refuse the garage's side walls, which meet nothing within 4.5 m.
- **A11, A15, D15, E6 — `cornerJoined` scope.** One hop only, a wall-thick band anchored in the chains' rect. Verified harmless for the detached case (§21.22). It applies to every weak-frame plan by design: the extent is a property of the drawing, not of a facade.
- **A12, E10 — order test shuffles.** Bands, chains and callouts are shuffled. Grid lines, separators and intervals are derived in coordinate order from those, never enumerated from an input order (A2's defect was the loop's own mutation, fixed and gated by M11).
- **A13, D5, D10 — measured from the grid line.** Return and depth are measured from the grid line, not the wall axis. A wall's thickness either way against thresholds of ≥ 0.9 m; no fixture flips.
- **B6.** The pocket test uses atomic widths by §16's design.
- **C3 — callout binding.** Tolerance max(35 cm, 12 %), no cross-separator slack, best confidence, id tie-break. Looser than `assignCallouts` but bound per interval; the callout alone now closes only a mouth walled deeper than a recess.
- **C4 — M4 is lexical.** Backed by the executed decoy (§20 end-to-end, published undefined / exact / 1.25×).
- **C5 — 12c covers only analysed copies.** Analysed copies are the selected storey's frames. The ground storey's compound spans are on its plan digest whenever the ground plan is read.
- **C6, E9 — extent join and bay relation not in 12c.** The extent's `why` names the join; bays are digested separately.
- **C7 — absent record.** An absent record now means "no wide gap on a facade". The pack version says whether the reader existed.
- **C8, E8 — counts.** Structural evidence is counted among H1's closed edges; diagnostic wording only.
- **C9 — gate coverage.** The frozen-number gate covers `compound-facade.ts` and the wiring functions, not `decomposeCore`'s own lines.
- **C10, D9 — tie-breaks.** Tie-breaks on equal starts / equal rows are deterministic but enumeration-derived; no fixture or row reaches them.
- **C11 — version registry.** `compound-facade` 1.0.0 and `plan-extent` 1.1.0 are in the run record's versions.
- **D4 — free narrow piers.** A free narrow pier reads POST; a pier tied into a wall body reads FACADE_PIER (fixture 5).
- **D7, D8 — back-wall edge cases.** Single column or stub, and glazing wider than 3.2 m: residual risks in the safe direction (no recess, so the pocket test decides). Recorded.
- **D11 — inner facades.** Inner facades of L/T/U plans are a stated limit (`architecture.md` §6).
- **D12, D13 — small edge cases.** Sub-0.6 m intervals between two separators; 64 reads at t/2 on thin-wall sheets.
- **E5 — the regression claim.** It compares models and refusal codes. The final development matrix adds the per-plan compound record of every row with a span (`compound-facade-evidence.json`).
- **E7 — redundant reads.** Bounded by `COMPOUND_BOUNDS`.

## Effect on the development rows

A05 returns to its starting verdict.

- Its earlier FAIL→PASS was produced by A2's re-count. A gap on another line (3.74 m, its own 52.6 m² behind it) was shut first. Its pocket was then counted again behind both of A05's compound mouths, which closed them.
- Weighed on its own, the 3.02 m mouth leads into a 10.9 m² pocket and the 0.99 m mouth into nothing.
- The compound reading itself (one WALL_RETURN, two intervals) is unchanged.

The stage gives up that development gain rather than keep a pass made by an order-dependent rule. Final matrix: `development-matrix.json`.

## Round 2 — the fixes reviewed again

Two more read-only reviewers looked at the fixes themselves (`0e996b6..c26799c`): R1 for false closures and openings, R2 for order, determinism, records and cost. As before, every P0/P1 was adversarially verified. Raw records: `council-round2-findings.json`.

| id | verified | defect in the fix | resolution |
| --- | --- | --- | --- |
| S1 | P0 | "glazing standing alone" still accepted two lines a pane apart (a drain, a two-riser step) and some three-tread flights between two returns as the set-back wall | the floor-clearance heuristic is gone. Between two returns' bare cross-sections, glazing is the set-back wall only where both returns **end** at it (their runs stop within −1 to +1.5 walls of the read). Lines across a recess whose returns run on past them are never its back, however they read. Fixture: A1/B2 with a drain and three treads, all orientations; M12 |
| R1 | P1 | the same heuristic refused a real glazed back when a dashed overhead outline crossed the recess floor | the heuristic is gone, so a dashed line vetoes nothing. **Trade-off, recorded:** a glazed back between returns that run on past it as interior walls (a T-junction) is no longer taken as a back wall. That mouth falls to the pocket test, the starting code's outcome, rather than risk S1's phantom room |
| R2 | P1 | the callout depth rule still shut a recess whose returns run on past an unread glazed back | a callout closes a mouth only when, besides walls deeper than a recess, no continuous line (glazing, a door, a wall not taken whole) is drawn across the bay within that depth. A dashed overhead line does not count. Fixture: R2 (glazed back, dashed outline, callout), all orientations |
| R3 | P1 | sharer membership was decided on round6'd area differences, so noise could sweep a mouth into its neighbour's shared space | decided on integer cell counts |
| S4 | P2 | as R3 | as R3 |
| S6 | P2 | a completions-only override tagged the outline grid's spans `BOX` | a decomposition cut on an override is tagged `OUTLINE` (`outlineReading`) |
| R9 | P3 | debug output left in a test | removed |

Refuted:

- **S2** — the A2 snapshot is the intended fix and is documented. Its effect on gaps with no separator is in the safe direction: a double-count false closure is removed.
- **S3** — whole-span records do consume the 24-span bound, but no realistic plan comes near it.

Left open (P2/P3):

- **R4** — same as S2.
- **R5** — the glazing excuse has no width check against a continuous double line along the facade. It needs this mouth to be glazing too, so Kosaćce's single or dashed line is unaffected.
- **R6, S7** — the callout rule refuses a garage whose side wall has a door or window within 4.5 m. The garage falls to the pocket test and its drawn door.
- **R7, S5** — the joint limit uses the sum of the openings' widths, not the merged span including its piers. The claim that it "never shuts more than the incumbent" is withdrawn. What holds: the joint limit is the pocket rule applied to the openings' total width.
- **R8** — same as S3.
- **S8** — floods per plan rise from N to about N + Σ(group + 2), linearly; measured in `performance.json`.
