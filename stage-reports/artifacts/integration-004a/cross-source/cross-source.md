# Cross-source comparison

archon.pl: `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/runs/marcowki-baseline`
projektydomownowoczesnych.pl: `/tmp/claude-0/-home-user/5eccf0e3-4ef3-5405-aafb-08cd5094f39b/scratchpad/runs/alt-marcowki`

| aspect | archon.pl | projektydomownowoczesnych.pl | verdict |
| --- | --- | --- | --- |
| title (normalized) | dom w marcowkach ge | dom w marcowkach ge | MATCH (weak evidence) |
| project code | m2fa281446a8ca | m2fa281446a8ca | MATCH |
| fact boiler_room_area | 5.8 m2 | 5.8 m2 | MATCH |
| fact building_height | 8.27 m | 8.27 m | MATCH |
| fact floor_area | 170.62 m2 | 170.62 m2 | MATCH |
| fact footprint_area | 131.16 m2 | 131.16 m2 | MATCH |
| fact garage_area | 24.1 m2 | 24.1 m2 | MATCH |
| fact house_net_area | 129.04 m2 | 129.04 m2 | MATCH |
| fact plot_min_depth | — | 20.6 m | ONE_SIDED |
| fact plot_min_width | — | 19.05 m | ONE_SIDED |
| fact roof_area | 150.57 m2 | — | ONE_SIDED |
| fact total_area | 231.11 m2 | — | ONE_SIDED |
| fact usable_area_without_stairs | 153.31 m2 | — | ONE_SIDED |
| fact volume | 779.94 none | 779.94 none | MATCH |
| roof pitch (stated) | 40° | 40° | MATCH |
| roof pitch (reconstructed) | 40° | — | ONE_SIDED |
| roof kind (stated) | GABLE | GABLE | MATCH |
| room schedule | 18 rooms | 18 rooms | MATCH (18 identical (storey, label, area)) |
| drawings floor plan | 8 | 4 | DIFFER (coverage, not identity) |
| drawings elevation | 4 | 4 | MATCH (coverage, not identity) |
| drawings section | 1 | 1 | MATCH (coverage, not identity) |
| drawings site plan | 1 | 1 | MATCH (coverage, not identity) |
| drawings perspective render | 4 | 4 | MATCH (coverage, not identity) |
| footprint (reconstructed) | 12.05 × 16.71 × 8.29 m | — | ONE_SIDED |
| wall topology (count) | 40 walls | — | ONE_SIDED |
| openings (count) | 21 | — | ONE_SIDED |
| roofs (count) | 2 | — | ONE_SIDED |
| geometry fingerprint | 7ee12c37066900b8 | — | ONE_SIDED |

**SOURCE_PARTIAL_EQUIVALENT** — 12 aspects agree and none disagrees, but the geometry is not identical (one side has no reconstruction)
