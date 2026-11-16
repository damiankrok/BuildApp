# v3.54.2 — manual interventions and runs outside the protocol (kept as they happen)

1. 2026-11-16 14:5x — run C1 (stage B) started, then stopped by the operator (Claude Code) after the new validator test
   found that an evidence citation written "picture 2" (with a space) would be refused as FOREIGN_EVIDENCE. The fix
   widened the citation pattern (picture/pic/image/label/L with an optional separator; overview/plan). One request was
   in flight when the process was stopped (Kukliki, after LOCAL: step 1 of the label consultation — the restarted run
   shows Kukliki's LOCAL scale is LEGACY_UNCONFIRMED/INCONCLUSIVE, so its labels are asked about; same 11 pictures,
   same reservation); its reservation of 0.146096 USD
   stands in the books as an unknown cost (books 4.11036 -> 4.256456). Its local event record was deleted with the
   run directory before the restart — an operator error; the provider request id of that call is therefore not known.
2. Before any API call: a SYNTHETIC consumer probe on Supertunie (`/home/user/rd/v3542/probe`), where Claude Code copied
   the recogniser's own top reading "690" of one label into a consulted reading to test whether the consumer could move
   the scale. It is not an API answer and is not counted in any variant. It found the cross-axis loss (§ report).

# Notes for the report (not interventions)
- v3.54.1 fact check, IoU on the common group: reproduced 0.682 -> 0.784 (A -> H1) with the v3.54.1 scorer
  (score_outline.py: best of 4 rotations + translation search +-1.5 m), N = 4: Kukliki, Madera, Miodowy, plan23-504
  (the only FINAL houses with a LOCAL model and a reference polygon). Same four, v3.54.2 fixed frame (front-left corner
  alignment, no rotation/translation search): 0.615 -> 0.708 (medians 0.539 -> 0.702). v3.54.1's "0.68 (n=4) -> 0.86
  (n=11)" mixed denominators; the comparable figure is the N=4 one.
