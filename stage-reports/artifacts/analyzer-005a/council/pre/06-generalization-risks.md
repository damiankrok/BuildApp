# 06 — Generalization risks (Council D red team, with A, B, C, E, F)

## 1. Verdict

The analyzer is **not generic yet**. It is a single-winner serial pipeline whose defaults were
settled on one publisher's 853 px DIMENSIONED plan sheets. No project slug, project code or
evaluation dimension appears in production `src/` (D §2.1, G §1), so the problem is not leakage of
names: it is **tuned constants and single-hypothesis choices on the default path**.

## 2. Measured symptoms (D, B, the orchestrator's replays)

| Invariant a generic analyzer must hold | Measured at HEAD |
| --- | --- |
| **Leave-one-copy-in**: each copy of the same ground-plan drawing, alone, completes or degrades honestly | 4 of 16 (4 projects × 4 copies) complete; every success is an 853 px copy; 550/400 px copies 0 of 8; e-OZE 0 of 4, each copy dying at a different stage (D E2) |
| **Resize invariance**: `cm/px × width_px` equal across copies of one drawing | violated in 4 of 4 projects, by 1.15× to 3.5× (e-OZE 610 / 1 222 / 2 134 / 2 134 cm against a true ≈ 1 895) (D E1) |
| **Image metamorphic stability** (0.75×, 1.25×, JPEG q75, contrast ±15 %, grayscale, 1–2 px crop) on the 853 px DIMENSIONED copies | scale wrong in 5 of 21 cells, extent wrong in a 6th; identical bytes of e-OZE give three scales (2.50, 2.22, 1.39) under harmless perturbations; Kosaćce and Marcówki lose the scale at 0.75× (B §5) |
| **URL-spelling invariance** | model identical, identity and every intermediate hash different (A) |
| **Phone = desktop on the same page** | two OWNER phone runs saw one plan copy where the desktop sees four; outcome class changed (A, orchestrator replays) |

## 3. Root assumptions that explain "one house passes, the next fails somewhere else"

Ranked by how much of the OWNER pattern each explains (D F1–F5, B F1–F5, C, A).

1. **One plan copy per storey, first success wins, copies never compared** (`layout.ts:177-246`).
   Families broken: every publisher that exposes several copies of one drawing (ARCHON: 4); every
   run where a copy is lost in transit (both phone failures).
2. **The plan's extent is the widest READ chain on each axis, and walls outside it are deleted**
   (`plan-decomposition.ts:698-811,1206-1213`). Broken by: any sheet whose overall dimension on one
   axis is unread (rotated text, small copies), where the widest read chain is an interior detail.
3. **One pooled scale per frame, with printed digits rewritten to fit it** (`chains.ts:395,611-630,
   690-723,780`; `extract.ts:765`). Broken by: any sheet where the vote is thin; rewritten readings
   then become registration anchors and confirm the wrong scale by construction.
4. **One page-level OCR orientation for all rotated text** (`ocr.ts:829-834`). Broken by: any sheet
   where a junk token tips the vote; about half the vertical numbers are read mirrored even when
   the vote does not flip (B §2.2).
5. **Hard single-value thresholds that sit inside the measured data** (D F4): the 0.35 wall-fraction
   cliff (the Kosaćce house body scores 0.289 on the area copy and 0.495 on the dimensioned copy of
   the SAME drawing), the 6 %/20 % footprint bands, 3.2 m / 8 m opening widths in metres, three
   literal copies of 0.62.
6. **Terminal gates on the first reading** (C): the `planFailureOf` ladder and `FOOTPRINT_AREA_WRONG`
   end the run although alternatives exist and cost seconds (E: solver 9–12 s of a 250–340 s run).

## 4. Other fixed assumptions with the families they break (D §3, C, F)

| Assumption | Where | Breaks |
| --- | --- | --- |
| front = bottom of the plan sheet | `v2/frame.ts` | plans drawn north-up with the entrance at the top; mirrored houses |
| storey index maps differ between layout and v2 (GROUND+UPPER+ATTIC collide on index 1) | `layout.ts:496-507` vs `reconstruct-v2.ts:265` | three-level houses — **latent bug, untested** |
| ARCHON floor fragment index 1→GROUND, 3→ATTIC only | `archon.ts:168-172` | basements, three storeys, split levels |
| ridge axis default `'Z'`; hip read as gable | `reconstruct-v2.ts`, `roof-systems.ts` | hip roofs, cross gables |
| wall thickness outside 0.15–0.7 m silently replaced by a convention | `reconstruct-v2.ts:230` | timber frame < 0.15 m, thick masonry |
| `CONVENTIONS` storey height 2.8 m, slab/roof thickness | `solve.ts` | any project without a section datum |
| the synthetic drawing fixtures use the pipeline's own dictionary and the tuned pixel density | `packages/synthetic-drawings` | every unseen drawing style (D §5.2) |

## 5. What the guards prove and miss (D §2.2, G)

The architecture tests forbid imports of the reference package and literal project names; they do
not detect tuned constants, one-sheet-style defaults, or success criteria written as "Marcówki's
structure" (`reconstruct:no-reference`, `reconstruct:no-benchmark`). CI runs the analyzer on real
houses only through sealed replays (determinism, not generality) and advisory live jobs.

## 6. Guard rails for 005A itself

- **No new tuned constant.** Every threshold the resolver uses is one that already exists in the code
  (0.06, 0.20, 0.35, 0.5, 0.62, 1.15, 0.5 m²) (C D3).
- **No selection on the answer.** Candidates are generated from drawing evidence only; the published
  footprint ranks and refuses, never generates (C D1, D2).
- **Frozen before the holdouts.** Holdouts are judged by rules fixed at `PRE_HOLDOUT_SHA`; a defect
  they expose is next-stage input, not a patch inside 005A.
