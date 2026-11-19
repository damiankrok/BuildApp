# v3.54.15 — the freeze and the one fresh public control (written and committed before any candidate is opened)

## Freeze

From this commit the code, schemas, prompts and rules of the consultant path are frozen for the control:

| piece | version |
|---|---|
| dimension observation contract | 1.2.0 (ft-in) |
| metric read / verify prompts | `metric-read/3`, `metric-verify/2` |
| metric resolver | 1.2.0 (LEVEL_HANDED; FOOTPRINT only for two WHOLE_HOUSE overalls) |
| metric solver (LOCAL) | 1.9.0 (orientation by ratio to the other axis) |
| elevation sketch contract / parser | 1.1.0 / 4 |
| sketch step | 1.1.0 (ridge and eaves by role; per-property verdicts) |
| view registration | side labels believed; ridge-refused views fall back to the wall-band corners |
| transport | strict tools, opt-in 5-minute cache on tools + system |

Nothing above changes before the control's first result is recorded; that result is kept whatever it is, and a later
change is reported as a later change, never as the first result.

## Selection rule

The v3.54.14 rule (`../v35414/NEW_HOUSE_SELECTION.md`), applied by `select-control.py`, with two differences:

1. **Seed.** SHA-256 of "`49e8a9b97391564da95d5567e857b445e04acd49`:V35415-CONTROL" (the commit before this file); the
   walk starts at (seed as an integer) mod (pool size) over the same 460-address pool and goes forward cyclically; at
   most 25 candidates are opened.
2. **Excluded families** (`control-excluded.txt`, 27): every family seen in development before v3.54.14 and every
   candidate opened by the v3.54.14 selection, Ballina included — the families used for tuning are not the control.

Acceptance is unchanged (read from the acquired inventory and the page's facts only): a section, four labelled
elevations, a ground-floor plan (and an upper plan when the description names a storey above), footprint ≤ 160 m²,
pitch ≥ 20°, a gable roof named, no garage and no second roof form named. These cover the mechanisms v3.54.15 changed:
levels read on a section, side labels, four sketches.

The control runs once, live (L-MS: metric read + verify + four sketches, strict, 5-minute cache), and its L0 and L-M
at 0 USD from the same recorded turns.
