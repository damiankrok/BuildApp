# VLM / referee bake-off — results (BUILDPLAN-ANALYZER-005J)

Pre-registered: confident = confidence ≥ 0.8; UNRESOLVED / invalid = unresolved (never wrong). Red metric: CONFIDENT_WRONG_RATE = confident wrong / total. USEFUL_COVERAGE = confident correct / total. Modes never pooled.

**Excluded for every arm:** `real-dom-w-gozdzikowcach-WALL_CONTINUATION-1` — post-review C2: the porch-mouth question's B flank (x 417-436) was drawn over the porch floor and the end of the vestibule wall, not over the pier (dark run x 435-463); the image tells every arm that 'wall piece B is in the blue box' when the box holds no wall - malformed for all arms. With B on the pier (436-455) both wall models answer TERMINATES (0.98 / 0.97).

**Wall-model rows (`wall-*-structured`) on REAL_DEV are the first, face-placed run** (strips on the 005I truth outline, half outside the building). The post-review re-measurement on the wall axis is in `wall-model-proof.json` → `*.axisRemeasure` (UNet: 61/63 openings OPENING, 47 at ≥ 0.8, none wrong). Pixel shares are not calibrated probabilities; the 0.80 bar is applied to them as fixed before the run.

## 1. Headline: CANDIDATE_OVERLAY, all sets

| model | read-out | n | answered | accuracy among answered | CONFIDENT_WRONG_RATE | USEFUL_COVERAGE | mirror consistency (pairs with an answer) | rotation consistency (pairs with an answer) | counterfactual: same answer to both | ECE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| server-oracle | ORACLE_JSON | 148 | 99.3 % | 98.0 % | **0.0 %** | 74.3 % | 100.0 % | — | 6.2 % | 0.1537 |
| wall-unet-structured | STRUCTURED | 508 | 54.9 % | 91.8 % | **2.9 %** | 26.4 % | 89.3 % | 92.1 % | 23.8 % | 0.195 |
| wall-segformer-structured | STRUCTURED | 508 | 62.4 % | 89.9 % | **4.7 %** | 28.9 % | 91.1 % | 91.0 % | 9.5 % | 0.1875 |
| micro-referee-pilot | ENUM_SCORE | 1300 | 100.0 % | 69.3 % | **16.5 %** | 51.9 % | 88.0 % | 89.7 % | 21.5 % | 0.16 |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | 967 | 71.9 % | 45.0 % | **7.2 %** | 3.2 % | 43.0 % | 44.5 % | 31.4 % | 0.1845 |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | 695 | 45.0 % | 58.8 % | **18.4 %** | 26.0 % | 32.8 % | 14.6 % | 17.1 % | 0.4155 |
| smolvlm2-500m-onnx-int8dec | GEN_STRICT | 695 | 2.0 % | 64.3 % | **0.6 %** | 0.9 % | 0.0 % | — | 0.0 % | 0.4317 |
| moondream-0.5b-int8 | ENUM_SCORE | 513 | 39.8 % | 46.1 % | **1.8 %** | 1.0 % | 73.0 % | 90.0 % | 43.5 % | 0.1299 |
| moondream-0.5b-int8 | GEN_LENIENT | 33 | 12.1 % | 50.0 % | **6.1 %** | 6.1 % | — | — | 0.0 % | 0.5 |
| moondream-0.5b-int8 | GEN_STRICT | 33 | 0.0 % | — | **0.0 %** | 0.0 % | — | — | 0.0 % | — |
| florence2-base | ENUM_SCORE | 95 | 39.0 % | 40.5 % | **23.2 %** | 15.8 % | 100.0 % | 100.0 % | — | 0.5902 |

## 2. By set and mode (ENUM_SCORE / ORACLE_JSON / STRUCTURED)

| model | read-out | mode | set | n | accuracy among answered | coverage | CONFIDENT_WRONG_RATE | USEFUL_COVERAGE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| server-oracle | ORACLE_JSON | CANDIDATE_OVERLAY | SYNTHETIC | 102 | 97.0 % | 99.0 % | 0.0 % | 67.7 % |
| server-oracle | ORACLE_JSON | CANDIDATE_OVERLAY | REAL_DEV | 30 | 100.0 % | 100.0 % | 0.0 % | 83.3 % |
| server-oracle | ORACLE_JSON | CANDIDATE_OVERLAY | REAL_BLIND8 | 16 | 100.0 % | 100.0 % | 0.0 % | 100.0 % |
| wall-unet-structured | STRUCTURED | CANDIDATE_OVERLAY | SYNTHETIC | 180 | 86.6 % | 82.8 % | 7.2 % | 60.6 % |
| wall-unet-structured | STRUCTURED | CANDIDATE_OVERLAY | REAL_DEV | 304 | 97.2 % | 35.2 % | 0.7 % | 3.3 % |
| wall-unet-structured | STRUCTURED | CANDIDATE_OVERLAY | REAL_BLIND8 | 24 | 100.0 % | 95.8 % | 0.0 % | 62.5 % |
| wall-segformer-structured | STRUCTURED | CANDIDATE_OVERLAY | SYNTHETIC | 180 | 94.6 % | 82.8 % | 0.0 % | 66.1 % |
| wall-segformer-structured | STRUCTURED | CANDIDATE_OVERLAY | REAL_DEV | 304 | 86.5 % | 48.7 % | 6.6 % | 4.6 % |
| wall-segformer-structured | STRUCTURED | CANDIDATE_OVERLAY | REAL_BLIND8 | 24 | 80.0 % | 83.3 % | 16.7 % | 58.3 % |
| micro-referee-pilot | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 672 | 85.4 % | 100.0 % | 2.7 % | 71.4 % |
| micro-referee-pilot | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 564 | 49.6 % | 100.0 % | 34.0 % | 29.8 % |
| micro-referee-pilot | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_BLIND8 | 64 | 73.4 % | 100.0 % | 7.8 % | 42.2 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | RAW | SYNTHETIC | 272 | 53.3 % | 71.7 % | 2.9 % | 5.1 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | RAW | REAL_BLIND8 | 48 | 58.6 % | 60.4 % | 4.2 % | 0.0 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 614 | 44.7 % | 72.2 % | 6.8 % | 2.6 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 289 | 47.4 % | 73.0 % | 6.6 % | 4.5 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_BLIND8 | 64 | 36.6 % | 64.1 % | 14.1 % | 3.1 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | SEMANTIC_OVERLAY | SYNTHETIC | 307 | 48.5 % | 78.5 % | 6.5 % | 2.9 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | SEMANTIC_OVERLAY | REAL_BLIND8 | 64 | 31.1 % | 70.3 % | 6.2 % | 3.1 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | RAW | SYNTHETIC | 34 | 50.0 % | 35.3 % | 17.6 % | 17.6 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | RAW | REAL_BLIND8 | 48 | 55.6 % | 37.5 % | 16.7 % | 20.8 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | CANDIDATE_OVERLAY | SYNTHETIC | 342 | 47.2 % | 47.1 % | 24.6 % | 21.3 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | CANDIDATE_OVERLAY | REAL_DEV | 289 | 73.4 % | 42.9 % | 11.4 % | 31.5 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | CANDIDATE_OVERLAY | REAL_BLIND8 | 64 | 60.7 % | 43.8 % | 17.2 % | 26.6 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | SEMANTIC_OVERLAY | SYNTHETIC | 34 | 50.0 % | 17.6 % | 8.8 % | 8.8 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | SEMANTIC_OVERLAY | REAL_BLIND8 | 64 | 51.6 % | 48.4 % | 23.4 % | 25.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | RAW | SYNTHETIC | 7 | 42.9 % | 100.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | RAW | REAL_BLIND8 | 3 | 0.0 % | 33.3 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 262 | 40.7 % | 53.4 % | 1.5 % | 1.5 % |
| moondream-0.5b-int8 | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 187 | 63.5 % | 27.8 % | 2.1 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_BLIND8 | 64 | 33.3 % | 18.8 % | 1.6 % | 1.6 % |
| moondream-0.5b-int8 | ENUM_SCORE | SEMANTIC_OVERLAY | SYNTHETIC | 6 | 33.3 % | 100.0 % | 16.7 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | SEMANTIC_OVERLAY | REAL_BLIND8 | 3 | 0.0 % | 33.3 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | GEN_LENIENT | RAW | REAL_BLIND8 | 3 | — | 0.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | GEN_LENIENT | CANDIDATE_OVERLAY | SYNTHETIC | 30 | 50.0 % | 13.3 % | 6.7 % | 6.7 % |
| moondream-0.5b-int8 | GEN_LENIENT | CANDIDATE_OVERLAY | REAL_BLIND8 | 3 | — | 0.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | GEN_LENIENT | SEMANTIC_OVERLAY | REAL_BLIND8 | 3 | — | 0.0 % | 0.0 % | 0.0 % |
| florence2-base | ENUM_SCORE | RAW | REAL_BLIND8 | 11 | 0.0 % | 9.1 % | 9.1 % | 0.0 % |
| florence2-base | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 2 | — | 0.0 % | 0.0 % | 0.0 % |
| florence2-base | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 29 | 60.0 % | 17.2 % | 6.9 % | 10.3 % |
| florence2-base | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_BLIND8 | 64 | 37.5 % | 50.0 % | 31.2 % | 18.8 % |
| florence2-base | ENUM_SCORE | SEMANTIC_OVERLAY | REAL_BLIND8 | 3 | 50.0 % | 66.7 % | 33.3 % | 33.3 % |
| florence2-base | STRUCTURED | RAW | REAL_BLIND8 | 8 | — | 0.0 % | 0.0 % | 0.0 % |

## 3. Per class, CANDIDATE_OVERLAY, all sets pooled per model (ENUM_SCORE; oracle: ORACLE_JSON)

| class | server-oracle acc / confWrong | wall-unet-structured acc / confWrong | wall-segformer-structured acc / confWrong | micro-referee-pilot acc / confWrong | smolvlm2-500m-onnx-int8dec acc / confWrong | moondream-0.5b-int8 acc / confWrong | florence2-base acc / confWrong |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BAY_OR_RISALIT | 10/10 of 10; cw 0 | — | — | 27/28 of 28; cw 0 | 14/24 of 26; cw 0 | 3/6 of 8; cw 0 | 0/0 of 1; cw 0 |
| BODY_REGION | 13/13 of 14; cw 0 | — | — | 188/242 of 242; cw 46 | 76/130 of 189; cw 2 | 26/59 of 105; cw 0 | 0/0 of 19; cw 0 |
| CANOPY_PERGOLA_VS_WALL | 12/12 of 12; cw 0 | 55/57 of 96; cw 1 | 64/64 of 96; cw 0 | 56/96 of 96; cw 35 | 33/69 of 72; cw 4 | 9/13 of 39; cw 0 | 0/1 of 1; cw 1 |
| COLUMN_VS_WALL | 8/8 of 8; cw 0 | — | — | 48/48 of 48; cw 0 | 20/44 of 48; cw 2 | 1/4 of 12; cw 0 | — |
| DIMENSION_LINE_VS_BUILDING_LINE | 6/6 of 6; cw 0 | — | — | 28/36 of 36; cw 2 | 3/4 of 36; cw 0 | 0/0 of 9; cw 0 | — |
| GARAGE_BODY | 10/13 of 13; cw 0 | — | — | 80/108 of 108; cw 8 | 31/65 of 94; cw 2 | 17/37 of 50; cw 0 | 0/0 of 6; cw 0 |
| OPENING_VS_PATTERN | 14/14 of 14; cw 0 | 83/84 of 170; cw 1 | 98/106 of 170; cw 8 | 77/170 of 170; cw 61 | 68/87 of 107; cw 0 | 0/0 of 56; cw 0 | 0/0 of 12; cw 0 |
| OPEN_SIDE_VS_OPENINGS | 9/9 of 9; cw 0 | 25/26 of 28; cw 0 | 18/18 of 28; cw 0 | 28/28 of 28; cw 0 | 2/3 of 28; cw 0 | 0/0 of 16; cw 0 | 0/4 of 4; cw 4 |
| OUTER_BOUNDARY_A_OR_B | 16/16 of 16; cw 0 | — | — | 72/148 of 148; cw 10 | 2/82 of 82; cw 35 | 6/15 of 64; cw 0 | 0/16 of 16; cw 16 |
| STOREY_COVERAGE | 8/8 of 8; cw 0 | — | — | 24/24 of 24; cw 0 | 8/15 of 24; cw 0 | 0/0 of 6; cw 0 | — |
| TERRACE_VS_BODY | 15/15 of 15; cw 0 | — | — | 66/134 of 134; cw 52 | 18/42 of 88; cw 3 | 29/59 of 60; cw 7 | 0/0 of 20; cw 0 |
| VOID_VS_OUTSIDE | 8/8 of 8; cw 0 | — | — | 24/24 of 24; cw 0 | 10/20 of 24; cw 3 | 3/6 of 6; cw 2 | — |
| WALL_CONTINUATION | 15/15 of 15; cw 0 | 93/112 of 214; cw 13 | 105/129 of 214; cw 16 | 183/214 of 214; cw 1 | 28/110 of 149; cw 19 | 0/5 of 82; cw 0 | 15/16 of 16; cw 1 |

## 4. Blind-8 questions (development evidence), CANDIDATE_OVERLAY, NORMAL

| question | class | expected | server-oracle | wall-unet-structured | wall-segformer-structured | micro-referee-pilot | smolvlm2-500m-onnx-int8dec | moondream-0.5b-int8 | florence2-base |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dom-w-cyklamenach-BODY_REGION-0` | BODY_REGION | YES | YES (0.95) | — | — | YES (0.96) | NO (0.56) | UNRESOLVED (0.50) | UNRESOLVED (1.00) |
| `dom-w-cyklamenach-OPENING_VS_PATTERN-0` | OPENING_VS_PATTERN | OPENING | OPENING (0.95) | OPENING (0.97) | OPENING (0.97) | OPENING (0.92) | OPENING (0.75) | UNRESOLVED (0.87) | UNRESOLVED (0.99) |
| `dom-w-cyklamenach-OPENING_VS_PATTERN-1` | OPENING_VS_PATTERN | OPENING | OPENING (0.95) | OPENING (0.78) | OPENING (0.87) | PATTERN (0.67) | UNRESOLVED (0.52) | UNRESOLVED (0.83) | UNRESOLVED (0.99) |
| `dom-w-cyklamenach-OUTER_BOUNDARY_A_OR_B-0` | OUTER_BOUNDARY_A_OR_B | A | A (0.85) | — | — | A (0.70) | NEITHER (0.84) | UNRESOLVED (0.44) | NEITHER (0.99) |
| `dom-w-cyklamenach-OUTER_BOUNDARY_A_OR_B-1` | OUTER_BOUNDARY_A_OR_B | B | B (0.85) | — | — | A (0.62) | NEITHER (0.84) | UNRESOLVED (0.46) | NEITHER (0.99) |
| `dom-w-cyklamenach-TERRACE_VS_BODY-0` | TERRACE_VS_BODY | EXTERNAL | EXTERNAL (0.88) | — | — | ENCLOSED (0.85) | UNRESOLVED (0.74) | ENCLOSED (0.87) | UNRESOLVED (1.00) |
| `dom-w-cyklamenach-TERRACE_VS_BODY-1` | TERRACE_VS_BODY | ENCLOSED | ENCLOSED (0.95) | — | — | EXTERNAL (0.88) | UNRESOLVED (0.47) | ENCLOSED (0.66) | UNRESOLVED (1.00) |
| `dom-w-cyklamenach-WALL_CONTINUATION-0` | WALL_CONTINUATION | CONTINUES | CONTINUES (0.92) | CONTINUES (0.97) | CONTINUES (0.97) | CONTINUES (0.96) | TERMINATES (0.75) | UNRESOLVED (0.78) | CONTINUES (1.00) |
| `dom-w-cyklamenach-WALL_CONTINUATION-1` | WALL_CONTINUATION | CONTINUES | CONTINUES (0.92) | CONTINUES (0.78) | CONTINUES (0.87) | CONTINUES (0.80) | TERMINATES (0.42) | UNRESOLVED (0.72) | CONTINUES (1.00) |
| `dom-w-gozdzikowcach-BODY_REGION-0` | BODY_REGION | YES | YES (0.93) | — | — | YES (0.95) | YES (0.54) | UNRESOLVED (0.68) | UNRESOLVED (1.00) |
| `dom-w-gozdzikowcach-GARAGE_BODY-0` | GARAGE_BODY | YES | YES (0.90) | — | — | YES (0.58) | YES (0.70) | UNRESOLVED (0.69) | UNRESOLVED (1.00) |
| `dom-w-gozdzikowcach-OPEN_SIDE_VS_OPENINGS-0` | OPEN_SIDE_VS_OPENINGS | SEVERAL_OPENINGS | SEVERAL_OPENINGS (0.88) | SEVERAL_OPENINGS (0.39) | UNRESOLVED (1.00) | SEVERAL_OPENINGS (0.55) | UNRESOLVED (0.54) | UNRESOLVED (0.59) | ONE_OPEN_SIDE (1.00) |
| `dom-w-gozdzikowcach-OUTER_BOUNDARY_A_OR_B-0` | OUTER_BOUNDARY_A_OR_B | B | B (0.85) | — | — | A (0.71) | NEITHER (0.88) | UNRESOLVED (0.73) | NEITHER (0.99) |
| `dom-w-gozdzikowcach-OUTER_BOUNDARY_A_OR_B-1` | OUTER_BOUNDARY_A_OR_B | A | A (0.85) | — | — | A (0.82) | NEITHER (0.53) | UNRESOLVED (0.71) | NEITHER (0.99) |
| `dom-w-gozdzikowcach-TERRACE_VS_BODY-0` | TERRACE_VS_BODY | EXTERNAL | EXTERNAL (0.80) | — | — | EXTERNAL (0.84) | UNRESOLVED (0.81) | ENCLOSED (0.70) | UNRESOLVED (1.00) |
| `dom-w-gozdzikowcach-WALL_CONTINUATION-0` | WALL_CONTINUATION | CONTINUES | CONTINUES (0.88) | CONTINUES (0.83) | TERMINATES (0.80) | TERMINATES (0.63) | UNRESOLVED (0.40) | UNRESOLVED (0.77) | CONTINUES (1.00) |

## 5. Risk–coverage (ENUM_SCORE, CANDIDATE_OVERLAY, REAL sets): confident-wrong rate as the threshold rises

| model | ≥0.5 | ≥0.6 | ≥0.7 | ≥0.8 | ≥0.9 | ≥0.95 | ≥0.98 | ≥0.99 | ≥0.995 | ≥0.999 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| server-oracle (REAL_DEV) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| wall-unet-structured (REAL_DEV) | 1.0 % | 1.0 % | 1.0 % | 0.7 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| wall-segformer-structured (REAL_DEV) | 6.6 % | 6.6 % | 6.6 % | 6.6 % | 4.0 % | 0.7 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| micro-referee-pilot (REAL_DEV) | 49.5 % | 43.3 % | 38.5 % | 34.0 % | 25.9 % | 18.6 % | 12.2 % | 9.4 % | 6.2 % | 1.2 % |
| smolvlm2-500m-onnx-int8dec (REAL_DEV) | 28.7 % | 20.8 % | 13.2 % | 6.6 % | 2.1 % | 0.7 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 (REAL_DEV) | 10.2 % | 8.0 % | 7.0 % | 2.1 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| florence2-base (REAL_DEV) | 6.9 % | 6.9 % | 6.9 % | 6.9 % | 6.9 % | 6.9 % | 3.5 % | 3.5 % | 3.5 % | 3.5 % |

## 6. Majority baseline and minority answers (CANDIDATE_OVERLAY, primary read-out)

The real sets are one-sided in several classes (all 126 REAL_DEV OPENING_VS_PATTERN questions expect OPENING; 126 of 130 WALL_CONTINUATION expect CONTINUES). A constant guesser scores the majority share and gets every minority question wrong, so the minority columns are where a model shows it reads the drawing.

| model | set | majority-share floor (pooled) | minority n (imbalanced classes only) | minority right / answered | minority confident wrong |
| --- | --- | --- | --- | --- | --- |
| server-oracle | SYNTHETIC | 52.0 % | 9 | 8/8 | 0 |
| server-oracle | REAL_DEV | 83.3 % | 1 | 1/1 | 0 |
| server-oracle | REAL_BLIND8 | 81.3 % | 1 | 1/1 | 0 |
| wall-unet-structured | SYNTHETIC | 53.3 % | 12 | 5/6 | 1 |
| wall-unet-structured | REAL_DEV | 95.4 % | 14 | 10/12 | 1 |
| wall-unet-structured | REAL_BLIND8 | 100.0 % | 0 | 0/0 | 0 |
| wall-segformer-structured | SYNTHETIC | 53.3 % | 12 | 9/9 | 0 |
| wall-segformer-structured | REAL_DEV | 95.4 % | 14 | 14/14 | 0 |
| wall-segformer-structured | REAL_BLIND8 | 100.0 % | 0 | 0/0 | 0 |
| micro-referee-pilot | SYNTHETIC | 51.8 % | 72 | 64/72 | 3 |
| micro-referee-pilot | REAL_DEV | 76.2 % | 116 | 48/116 | 51 |
| micro-referee-pilot | REAL_BLIND8 | 81.3 % | 4 | 0/4 | 3 |
| smolvlm2-500m-onnx-int8dec | SYNTHETIC | 54.1 % | 114 | 25/75 | 2 |
| smolvlm2-500m-onnx-int8dec | REAL_DEV | 76.8 % | 58 | 8/40 | 6 |
| smolvlm2-500m-onnx-int8dec | REAL_BLIND8 | 81.3 % | 4 | 1/1 | 0 |
| moondream-0.5b-int8 | SYNTHETIC | 53.1 % | 48 | 35/36 | 0 |
| moondream-0.5b-int8 | REAL_DEV | 74.9 % | 41 | 8/26 | 4 |
| moondream-0.5b-int8 | REAL_BLIND8 | 81.3 % | 4 | 4/4 | 0 |
| florence2-base | SYNTHETIC | 100.0 % | 0 | 0/0 | 0 |
| florence2-base | REAL_DEV | 65.5 % | 1 | 0/1 | 1 |
| florence2-base | REAL_BLIND8 | 81.3 % | 4 | 0/0 | 0 |

## 7. Latency (desktop x86-64 CPU, image path, contended 4-core container)

| model / read-out | n | median ms | p95 ms |
| --- | --- | --- | --- |
| florence2-base|score | 109 | 23083.0 | 31300.4 |
| micro-referee-pilot|score | 1300 | 22.4 | 32.0 |
| moondream-0.5b-int8|gen | 39 | 16829.0 | 20777.4 |
| moondream-0.5b-int8|score | 532 | 15106.9 | 20959.9 |
| smolvlm2-500m-onnx-int8dec|gen | 875 | 3587.8 | 7895.9 |
| smolvlm2-500m-onnx-int8dec|score | 1658 | 2467.2 | 5323.4 |
