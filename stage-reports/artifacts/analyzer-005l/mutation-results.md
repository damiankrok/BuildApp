# 005L mutation results (§22) and knob sweep (council D5L-8)

- **Harness:** `research/analyzer-005l/mutations.mjs`, run at `cee78c8`. That commit has the same production code as
  the freeze candidate.
- **Method:** each mutation is a temporary in-place patch to one production file. The patch is restored with
  `git checkout`, and the tree is checked clean before the next one. No mutation is committed.
- **Suites:** eight suites, 114 tests:
  - `storey-support`, `storey-council`, `storey-emission`, `storey-council-emission`;
  - `layout`, the §25 `fixtures` and `fixtures-v2`;
  - the architecture gate `tests/architecture/storey-support`.
- **Records:** `mutation-results.json` and `knob-results.json` hold the failing test names.

## Mutations: all 10 killed

| id | mutation | killed by (examples) | failed |
|---|---|---|---|
| M1 | the lower-mass 50 % rule restored as the only criterion (`inter / massArea ≥ 0.5`) | A5L-4 partial basement; A5L-6 contiguity; A5L-7 two-body ties; B5L-2 attic on its own level | 11 / 114 |
| M2 | every mass gets every storey (a body no region stands on is stacked over its whole ring) | §25 fixture B (garage gains no upper ring); v2 Coldharbour/Marlow wings; `layout` single-storey wing | 15 / 114 |
| M3 | the upper envelope stands for every walled region | corpus 9 (terrace), 10 (L-shaped storey), 11 (two disconnected regions); B5L-5 L outline | 4 / 114 |
| M4 | the published room list chooses support (stacks every mass when the page lists rooms) | the static non-circularity gate (support section names no published fact) | 1 / 114 |
| M5 | the first alignment candidate wins (no sort) | §25 fixture C set-back; A5L-1; B5L-2, B5L-5, B5L-6 emission | 17 / 114 |
| M6 | the ground ring copied upstairs (`rectAt(m, m.storeys[0])`) | `storey-emission` set-back storey; B5L-2, B5L-5 ×2, B5L-6 | 5 / 114 |
| M7 | incidental overlap accepted (any overlap supports) | corpus 5b (a sliver over the garage carries nothing) | 1 / 114 |
| M8 | the published footprint area read from the caller's options, past `layoutOptionsOnly`, to stack every mass | the static gate, the executed 1.25× / absent decoys, and the Proxy test (no non-layout key is read) | 3 / 114 |
| M9 | `structural.ts` hands the published areas to the layout inference | the `structural.ts` publish-use gate (exactly three lines) | 1 / 114 |
| M10 | v2 builds a storey's own rectangle only where the page lists rooms on it | the v2 `storeyRects` vocabulary gate; the executed room-list decoy; B5L-2, B5L-5 ×2, B5L-6 | 7 / 114 |

M4, M8, M9 and M10 are the published-fact choosers council C5L-1 named:
- in the layout, through `options` and through `given`;
- in the structural pass;
- in the v2 emitter.

Each is caught statically, and M8 and M10 are also caught by executed decoys.

## Knob sweep: which synthetic fixtures pin each 005L constant

Each constant was moved by about a quarter either way. `SAME_SCALE_OFFSETS_PER_AXIS` is an integer, so it moved by a
third. Only the behaviour suites were run (105 tests), because the architecture gate freezes every literal. Nothing
is tuned from this table; it records which values the corpus constrains.

| knob | value | − | + |
|---|---|---|---|
| `FACADE_WALL_SHARE` | 0.25 | 0.1875: not pinned | 0.3125: **pinned** (B5L-6, the basement under the garage only) |
| `WALL_PAIR_SCALE_AGREEMENT` | 0.02 | 0.015: not pinned | 0.025: not pinned |
| `STOREY_RIVAL_WINDOW` | 0.1 | 0.075: not pinned | 0.125: not pinned |
| `SAME_SCALE_OFFSETS_PER_AXIS` | 6 | 4: not pinned | 8: not pinned |
| `STOREY_WALL_SHARE` | 0.75 | 0.5625: not pinned | 0.9375: not pinned |
| `STATED_HOLDS_SHARE` | 0.5 | 0.375: **pinned** (A5L-1, the inset storey's printed scale) | 0.625: not pinned |
| `minSpanM` (SUPPORTS on both axes) | max(1, 2·wall + 0.2) | ×0.75: not pinned | ×1.25: not pinned |

**Reading.**
- The synthetic corpus pins two of the 14 moves. The other 12 change no synthetic outcome. A value the corpus does
  not pin rests on its stated reason (the comment at its definition) and on the development rows. The rows' margins
  are in `storey-registration.json`.
- Council D measured the development-row sensitivity of four of these knobs at +25 % (`post-review/D-generalization.md`
  D5L-8):
  - `FACADE_WALL_SHARE` moves A03's gate;
  - `WALL_PAIR_SCALE_AGREEMENT` moves Marcówki's garage;
  - `minSpanM` moves the A06 porch;
  - `STOREY_RIVAL_WINDOW` moves A03's gate.
- These knobs are therefore documented as unpinned by synthetic evidence and as close to a development-row edge. That
  is a residual risk the blind round tests, not one this stage tuned away.
- `STOREY_TIE` is not swept: it is only a 1e-6 floor under the pixel-derived resolution. `SAME_SUPPORT_IOU` was
  removed.
