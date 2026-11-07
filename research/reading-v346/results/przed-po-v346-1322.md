| skill (v3.46 scorer) | split | PRZED | PO-1321 | PO-1322 |
|---|---|---|---|---|
| view roles, graph macro F1 | DEV | 0.9749 (N=650) | 0.9749 (N=650) | 0.9749 (N=650) |
| view roles, pixels macro F1 on decided (coverage) | DEV | 0.9956 (608/650) | 0.9958 (629/650) | 0.9960 (650/650) |
| elevation side coarse F/R/S | DEV | 89/92 | 89/92 | 89/92 |
| elevation side exact L/R | DEV | 0/0 (not measured 92) | 0/0 (not measured 92) | 0/0 (not measured 92) |
| section levels: read at the sign | DEV | 49/110 | 107/110 | 108/110 |
| section levels: raw text exact | DEV | 30/110 | 107/110 | 108/110 |
| section levels: OCR token right at the sign (any reader) | DEV | 47/110 | 47/110 | 47/110 |
| section levels: conflicting claims / additions | DEV | 2 / 0 | 2 / 0 | 1 / 0 |
|   ridge: read at the sign | DEV | 11/22 | 21/22 | 21/22 |
|   eaves: read at the sign | DEV | 8/19 | 19/19 | 19/19 |
|   storey floor: read at the sign | DEV | 20/39 | 37/39 | 38/39 |
|   terrain: read at the sign | DEV | 6/22 | 22/22 | 22/22 |
| roof pitch: read at the sign | DEV | 0/22 | 12/22 | 12/22 |
| roof pitch: raw text exact | DEV | 0/22 | 12/22 | 12/22 |
| roof pitch: OCR token right at the sign (any reader) | DEV | 0/22 | 0/22 | 0/22 |
| roof pitch: conflicting claims / additions | DEV | 0 / 3 | 0 / 3 | 0 / 3 |
| vertical dimensions: read at the sign | DEV | 3/59 | 3/59 | 39/59 |
| vertical dimensions: raw text exact | DEV | 3/59 | 3/59 | 39/59 |
| vertical dimensions: OCR token right at the sign (any reader) | DEV | 38/59 | 38/59 | 38/59 |
| vertical dimensions: conflicting claims / additions | DEV | 0 / 5 | 0 / 5 | 0 / 5 |
| callout ring found | DEV | 42/67 | 55/67 | 55/67 |
| callout digits exact | DEV | 37/67 | 50/67 | 50/67 |
| callout → its own opening, complete (OK) | DEV | 28/67 | 43/67 | 43/67 |
|   merged / split / missing opening / no model | DEV | 0/0/1/0 | 0/0/1/0 | 0/0/1/0 |
|   not bound / wrong binding / wrong digits / wrong kind | DEV | 19/1/2/6 | 16/1/2/4 | 17/0/2/4 |
|   additions (bound gaps at no callout) | DEV | 1 | 1 | 1 |
| view roles, graph macro F1 | EVAL | 0.9747 (N=258) | 0.9747 (N=258) | 0.9747 (N=258) |
| view roles, pixels macro F1 on decided (coverage) | EVAL | 1.0000 (119/258) | 1.0000 (119/258) | 1.0000 (258/258) |
| elevation side coarse F/R/S | EVAL | 34/40 | 34/40 | 34/40 |
| elevation side exact L/R | EVAL | 0/0 (not measured 40) | 0/0 (not measured 40) | 0/0 (not measured 40) |
| section levels: read at the sign | EVAL | 24/46 | 44/46 | 44/46 |
| section levels: raw text exact | EVAL | 18/46 | 43/46 | 43/46 |
| section levels: OCR token right at the sign (any reader) | EVAL | 23/46 | 23/46 | 23/46 |
| section levels: conflicting claims / additions | EVAL | 0 / 0 | 0 / 0 | 0 / 0 |
|   ridge: read at the sign | EVAL | 4/10 | 10/10 | 10/10 |
|   eaves: read at the sign | EVAL | 4/7 | 7/7 | 7/7 |
|   storey floor: read at the sign | EVAL | 12/17 | 16/17 | 16/17 |
|   terrain: read at the sign | EVAL | 3/10 | 9/10 | 9/10 |
| roof pitch: read at the sign | EVAL | 0/7 | 2/7 | 2/7 |
| roof pitch: raw text exact | EVAL | 0/7 | 2/7 | 2/7 |
| roof pitch: OCR token right at the sign (any reader) | EVAL | 0/7 | 0/7 | 0/7 |
| roof pitch: conflicting claims / additions | EVAL | 0 / 2 | 0 / 2 | 0 / 2 |
| vertical dimensions: read at the sign | EVAL | 1/22 | 1/22 | 14/22 |
| vertical dimensions: raw text exact | EVAL | 1/22 | 1/22 | 14/22 |
| vertical dimensions: OCR token right at the sign (any reader) | EVAL | 10/22 | 10/22 | 10/22 |
| vertical dimensions: conflicting claims / additions | EVAL | 0 / 3 | 0 / 3 | 0 / 3 |
| callout ring found | EVAL | 63/81 | 66/81 | 66/81 |
| callout digits exact | EVAL | 57/81 | 61/81 | 61/81 |
| callout → its own opening, complete (OK) | EVAL | 22/81 | 24/81 | 24/81 |
|   merged / split / missing opening / no model | EVAL | 0/0/2/41 | 0/0/2/41 | 0/0/2/41 |
|   not bound / wrong binding / wrong digits / wrong kind | EVAL | 11/0/3/2 | 11/0/3/0 | 11/0/3/0 |
|   additions (bound gaps at no callout) | EVAL | 3 | 3 | 2 |
