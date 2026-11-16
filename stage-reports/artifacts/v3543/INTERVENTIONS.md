# v3.54.3: manual interventions and development iterations (kept as they happen)

Everything here happened on DEV houses (known since v3.54.2 or earlier), before the candidate was frozen for the
confirmation set. No confirmation house was run before the freeze.

1. **2026-11-16 19:19–19:23, books corrected by journal (operator error in the runner).** Run C1 (Aksamitki,
   `--replay-metric`) reserved budget for six REPLAYED metric-round answers of the v3.54.2 recording: no request was sent
   for them, and a replayed answer carries no usage, so the reservations stood (0.985912 USD; books 7.280656). They were
   released through the ledger's own NOT_SENT path, each with the note `REPLAYED_NOT_SENT` (six `RELEASED` journal lines;
   nothing deleted). Books after: 6.294764 = 6.243534 + 0.05123 (the one look really sent). The runner now reserves
   nothing for an answer that comes from the recording, and reports replayed turns with zero usage.
2. **Aksamitki look 1 (run C1, live, 0.05123 USD).** The consultant, shown the final model, found the missing gable wall
   dormer over the entrance (CERTAIN) and proposed it. The analyzer bound it and REFUSED it (`OUT_OF_RANGE`): the
   proposal put the dormer's "own eaves" at the main roof's eaves line (1 % of the rise), i.e. the bottom of its wall.
   Change made: the prompt now says what a feature's own eaves are (where its own roof begins; never the bottom of its
   wall, a sill, a balcony or the main eaves), and that the facade's two ends are the ends of the wall under the main
   roof's eaves (the host body's wall, not a bay or wing beside it); the analyzer maps shares onto that body's wall.
   A correction the analyzer refuses with a reason now gets one more look, told why, while rounds remain.
3. **Aksamitki look 1 again (run C1b, live, 0.050436 USD).** The proposal bound to 35–65 % of the front side, eaves at
   31 % and top at 72 % of the rise (the operator's own reading of the same elevation: 34.8–65.3 %, 31.5 %, 71 %). The
   analyzer BUILT the dormer. The acceptance rule rolled it back: "the candidate also changed exteriorWalls". Cause: the
   four attic ring walls' NOMINAL height (5.22 → 5.72 m) is set by the emitter according to the roof's representation,
   and these walls' tops follow the roof (`FOLLOW_ROOF` → `FOLLOW_ROOF_PLANES`): the wall as built ends at the same roof
   surface. Change made: a wall whose top follows the roof is protected by its line, thickness, storey and base; its
   nominal reach is not compared. A wall with a top of its own is compared in full, as before.
4. **MANUAL_DIAGNOSTIC (no API, not counted as an automatic result).** Before the first look, the roof-feature consumer
   was exercised with shares typed by the operator (`/home/user/rd/v3543/aks-feature.json`): it showed that the model
   refuses a wall-flush dormer front (`WALLS_OVERLAP` with the attic's own wall, then with a partition meeting the
   facade). Changes made: a flush front stands directly behind the storey's own wall (said in the feature's record), and
   a dormer's front wall is a host the partitions of its storey are trimmed to, as they are to any exterior wall.
