# Plan resolver — sealed-evidence replays (005A)

Every run here is the production solver (`reconstructV2`, solver 2.2.0) on the metric evidence,
observation graph and package sealed at baseline (`../before/`), replayed with
`packages/analysis-service/scripts/second-house.ts --package --graph --metrics --cache
[--drop-frames]`. Only the **ground-storey plan copies** are varied; every other drawing is as
acquired. No drawing and no overlay of one is committed: the traces, summaries and plan digests are
text facts.

- `plan-copy-matrix.md` — 4 projects × 9 copy subsets, before (Council G §4e, measured on `7cd8e0c`)
  and after. Completed: **16/36 → 28/36**. Every row that completed before completes with the same
  model hash. The eight that still fail are small (550/400 px) or unscaled copies read alone — the
  reading-layer limit deferred in `../council/pre/09-council-disagreements.md` #2 — and each keeps its
  first-link code, with the readings weighed counted in its diagnostics.
- `kosacce-clean-only-853A/`: the OWNER's phone case, where only the area-table copy arrived.
  - Before: `PLAN_LAYOUT_REJECTED` at 33.15 m².
  - Under 1.1.0: `COMPLETED`, gate `STRUCTURAL_LAYOUT_PARTIAL`, at the registered scale with the walled-first
    tiling: 3 bodies, 171.0 m² (+4.0 % of 164.47).
  - **Under 1.2.0, which the record now holds:** `PLAN_RESOLUTION_INCONCLUSIVE`, with the readings named. See
    below.
- `rarytasy-eoze-all/`, `rarytasy-eoze-only-853A/` — before `PLAN_NO_WALLED_ENVELOPE` with every copy;
  after `COMPLETED` (partial): the wall-ink extent at 2.2236 cm/px, the scale the reader's own first
  reading of the 720 px overall dimension ("1601") implies, which the chain solver had rewritten to
  "1801": 1 body, 116.7 m² (−4.4 % of 122.07). The same model with all copies and with the area copy alone.
- `kosacce-clean-all/`, `marcowki-all/`, `rarytasy-g2e-all/` — the three accepted houses: the first
  reading holds, the resolver never runs, model hashes `5b5ffcf1…`, `6152770f…`, `8fa4a25b…` unchanged.

**Resolver 1.1.0 (the `mouths` axis).** A wide undrawn gap left open as a pocket mouth is also weighed as an
opening in the wall; see `../shape-families/README.md`. The 36-run matrix, replayed with it, is identical:
every outcome is unchanged and every completed row keeps its model hash.

**Resolver 1.2.0 (post-implementation Council).** Two rules, after the decoy-footprint control
(`../council/post/decoy-footprint/`):
- A corroboration is a witness the published figure is not. WALL_COVERAGE ranks but no longer corroborates, and
  ISOTROPY counts only for a lattice scale.
- A figure that refused the first reading is spent. It may still veto (WRONG), but may no longer choose.

Replayed on the same 36 subsets (`plan-copy-matrix.md`, third column), **28/36 → 24/36**:

| row | 1.1.0 | 1.2.0 | why |
| --- | --- | --- | --- |
| Kosaćce, area copy alone (`only-853A`, the OWNER's phone case) | resolved to `e4c7306f` | `PLAN_RESOLUTION_INCONCLUSIVE` | the figure refused the first reading, so it cannot also choose. Council C measured `e4c7306f`'s north wing about 2.1 m longer than the accepted reading |
| G2E `only-550D` and `without-853D` | resolved: 3 bodies, −17.6 % | refused | the house has 2 bodies, and the only support was WALL_COVERAGE |
| e-OZE `without-853D` | resolved: the correct building | refused | its first reading was refused by the figure, which is then spent |

- e-OZE with every copy, and with the area copy alone, still resolves to `b50b6e59`. That is the OWNER's second
  phone case, and its first reading stops on the drawing, not on the figure.
- Kosaćce `without-853D` (the area copy with the 550 and 400 px copies) still resolves to `e4c7306f`. Its first
  reading also stops on the drawing (`PLAN_NO_WALLED_ENVELOPE`), so the figure may choose. That is the residual
  `../council/post/decoy-footprint/` names.
- Every row that completed on its first reading keeps its model hash.
- A resolved candidate's solver version now reads `2.2.0+resolver.1.2.0`, so its model hash is unchanged and its
  candidate hash is not.
