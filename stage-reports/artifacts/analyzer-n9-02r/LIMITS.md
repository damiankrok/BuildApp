# N9-02R — limitation register

1. **The research reader does not generalise to the ARCHON renders.** It is not enabled in production.
   - It reads every drawn facade of the frozen synthetic holdout (18/18) and refuses every undecidable one (12/12).
   - On the 32 real elevations it refuses nearly every view:
     - background trees behind the wall ends are read as occluders;
     - white walls merge with white clouds;
     - watermarks and soft shading break the end edges.
   - Telling a tree in front of a wall from a tree behind it needs depth or occlusion cues that colour alone does not
     give. This is the next problem, not something to tune.
2. **The holdout shares the generator's simplifications.** It has flat colours, crisp edges, no JPEG noise, no
   background vegetation, no clouds and no watermarks. Its score bounds the reader from above; it is not an accuracy
   on real sources.
3. **Roofs drawn as open lines (the synthetic Larchfield) and flush roofs with no overhang are refused by the reader.**
   It requires built pixels over a wall end's top. This is a false-refusal class that is not in the holdout.
4. **I (independent comparisons) is 0 everywhere.** Every R5 check is located near the model's prediction
   (MODEL_ANCHORED), and the along transform comes from the plan's span (shared with the model). No comparison in this
   stage is independent of the model. The scorecard counts I honestly instead of re-labelling model-anchored checks.
5. **R5 now sets aside checks in disputed axes.** A disputed vertical sets aside every height check. A view whose
   only valid checks agree becomes a model-anchored PASS on fewer checks. The raw residuals stay on the item.
6. **The width check (SILHOUETTE_WIDTH) is CIRCULAR on every span-registered view, and is no longer counted.**
   It would count again only on a view whose scale is anchored apart from the plan's span.
7. **No real ground truth on ARCHON.** The controls (Kruszczyki 22, Lipienniki 6, Skalnice 3) report gains, losses and
   source evidence, not accuracy. Skalnice 3 still fails at the solver.
8. **Not done:** R6 / N9-02B, a solver correction of its own registration (Trytomach FRONT, Larchfield FRONT/REAR), a
   model change, an APK, full CI.
