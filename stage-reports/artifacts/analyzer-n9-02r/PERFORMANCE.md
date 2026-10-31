# N9-02R — runtime and memory beside N9-02A (same machine; the N9-02A runs had the same 2-way parallelism)

The research reader is not run in production: the cost below is the R5/registration change only. The reader alone took at most 176 ms per elevation in the probe (`reader/INDEX.md`).

| house | total ms N9-02A → N9-02R | peak RSS MB N9-02A → N9-02R | assessment phase ms (if reported) |
|---|---|---|---|
| a01 | 276551 → 235876 | 832 → 807 | [{"counters": {}, "durationMs": 3888, "maxTickGapMs": 1922, "peakRssBytes": 779288576, "phaseId": "VERIFY", "stage": "VE |
| gozd | 249271 → 214781 | 866 → 871 | [{"counters": {}, "durationMs": 2172, "maxTickGapMs": 1507, "peakRssBytes": 833421312, "phaseId": "VERIFY", "stage": "VE |
| marcowki | 199544 → 180905 | 820 → 890 | [{"counters": {}, "durationMs": 2255, "maxTickGapMs": 1387, "peakRssBytes": 846221312, "phaseId": "VERIFY", "stage": "VE |
| ciesz | 130571 → 115307 | 821 → 810 | [{"counters": {}, "durationMs": 2119, "maxTickGapMs": 1311, "peakRssBytes": 808558592, "phaseId": "VERIFY", "stage": "VE |
| rary | 175936 → 146775 | 892 → 881 | [{"counters": {}, "durationMs": 1264, "maxTickGapMs": 811, "peakRssBytes": 921477120, "phaseId": "VERIFY", "stage": "VER |
| trytomach | 182160 → 152151 | 833 → 836 | [{"counters": {}, "durationMs": 2443, "maxTickGapMs": 1540, "peakRssBytes": 825356288, "phaseId": "VERIFY", "stage": "VE |
| arganiach | 217598 → 183748 | 916 → 917 | [{"counters": {}, "durationMs": 3023, "maxTickGapMs": 1817, "peakRssBytes": 880304128, "phaseId": "VERIFY", "stage": "VE |
| sasankach3 | 204950 → 175133 | 861 → 888 | [{"counters": {}, "durationMs": 2339, "maxTickGapMs": 1731, "peakRssBytes": 830902272, "phaseId": "VERIFY", "stage": "VE |
