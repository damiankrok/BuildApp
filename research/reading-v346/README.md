# v3.46 measurement (research, no production effect by itself)

The v3.45 scorers stay in `../reading-v345/scoring` with their 1321 tables, unchanged, as history. From v3.46 on the
tables are produced by the scorers here. Audit 1321 showed two gaps in the v3.45 method with synthetic counter-probes;
both are reproduced in `scoring/test_counterprobes.py` against the old scorers and fail against the new ones.

| v3.45 scorer | flaw (audit 1321 / own review) | v3.46 scorer | what changed |
|---|---|---|---|
| `score_levels.py` | one image's multiset of normalised values; ridge/eaves/floor/terrain merged into LEVEL; swapped values with wrong raw text pass 3/3 | `score_section_signs.py` | every printed sign has a place (`annotations/section-signs.txt`); it is scored only by what the reader emitted at that place, matched by geometry; raw text, raw value, final value, origin and kind apart; two different claims on one sign = conflict; R/T/F checked against the model's datums and storeys |
| `score_callouts.py` | first gap within ~90 px and half-overlap; `used` never excluded reuse; one merged gap passes two openings | `score_callouts_v2.py` | one-to-one, geometry-only assignment (along-wall IoU >= 0.5); MERGED_GAP and SPLIT_GAP; callout readings one per ring; the bound callout must be this ring's; a run without openings is NO_MODEL, still in the denominator, its rings still scored |
| `score_views.py` + `score_content.py` | graph roles and pixel classifier reported apart but pixel non-decisions counted as misses without a reason; LEFT/RIGHT merged into SIDE | `score_views_v2.py` | graph, pixels (with coverage and the reason for each undecided image) and side (coarse F/R/S, exact L/R) as separate layers; L/R exact is scored only where the reference states L/R (none of the v3.45 annotations does: reported as not measured) |

Run the probes: `python3 -m unittest -v research/reading-v346/scoring/test_counterprobes.py`.

Tables: `scoring/przed_po_v346.py <config.json> <out.json> <out.md>` (config names the run roots of each column).

Results of delivery 1322 (PRZED = E13/1320, PO-1321, PO-1322 from the frozen tree `572b875`):
`results/przed-po-v346-1322.md`; discussion in `stage-reports/STAGE_BUILDPLAN_EXTERIOR_COMPLETE.md` §11 and
`stage-reports/EXTERIOR_COMPLETE_LOG.md` E15. Per-sign, per-callout and per-image outputs stay in the private ZIP.

Coverage after v3.46 (addendum to `../reading-v345/COVERAGE.md`, which stays as the v3.45 snapshot):
- Numbers: every legible section sign (266 on 32 sections) has a place; levels, pitch and vertical dimensions are scored
  at that place, raw / normalised / corrected / origin apart.
- Binding: callout → its own opening one-to-one; 16 section dimension end pairs (text → line → ends) and 4
  source-checked relations (`annotations/dev-links.json`, frozen before scoring).
- Still without a measure: walls vs furniture, columns, balconies, dormers, mixed-sheet regions, exact L/R side.
