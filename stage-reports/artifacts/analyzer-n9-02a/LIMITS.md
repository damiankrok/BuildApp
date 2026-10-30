# N9-02A — limits and uncertainties

**Diagnostic only.**
- The four-axis registration feeds nothing back into the solver: no `facadeAlignment`, `repairFromResiduals` or R5 check uses it.
- That is why candidates, models and scenes are byte-identical. It is also why no new view is compared with the model yet; that comparison is R6 / N9-02B.
- R5 keeps its N9-01 semantics. Its items now carry the view's axes (`axes`), and an unregistered view still never passes.

**The plan's walled and characteristic spans** are the reading the model is built from. Every ALONG axis anchored on them is marked `PLAN_WALLED_SPAN (shared with model)`. A facade width checked on such a view is not an independent check of the model's width. Positions along the facade and heights are.

**Same sheet size ≠ same scale.**
- Sheet size is only a grouping. A scale is transferred only where a band's width independently fits a plan span at it (3 %).
- Where the solver's own registrations of a sheet size disagree (Trytomach: front 0.01605, rear 0.01469), the reference is their agreeing majority, or nothing.

**Isotropy.**
- `VERIFIED_ISOTROPIC` needs a printed terrain datum.
- Without one, `ISOTROPY_PLAUSIBLE` only says the ground lands within a plinth (−0.9 … +0.1 m) below ±0.00. That range is a stated convention (the solver's own 0.9 m), not a measurement.

**The hand of two unlabelled side views** is never decided. They stay `LEFT_OR_RIGHT`, with the span and scale only (`SPAN_ONLY`). No position is read on them.

**Gross tests:**
- `EXTENT_HEIGHT_MIN_SHARE` (0.6 of the sibling sheets' outline height) and the clipped-band test only refuse.
- They can refuse a sound view: the Goździkowce side `…22c3`, whose band starts exactly at the outline's edge next to a grey downpipe. They cannot admit one.

**Real accuracy NOT_MEASURED.**
- There is no independent manual truth for the 8 houses or the 3 controls.
- Agreement with the solver's registration is a consistency check, not evidence. The one independent truth is synthetic (Larchfield, 38 px/m).

**Checkable slots** (a facade width, two wall ends, each opening's position and width, its sill and head, eaves and ridge) are counted from the emitted model's openings per facade. They are slots that could be checked, not checks.

**The solver's own registration errors found here** (Larchfield −9.5 %, the Trytomach front 8.5 % against two bands) are reported, not repaired. Repairing them would change the models.
