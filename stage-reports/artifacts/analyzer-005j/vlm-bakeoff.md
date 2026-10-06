# VLM / referee bake-off — results (BUILDPLAN-ANALYZER-005J)

Pre-registered: confident = confidence ≥ 0.8; UNRESOLVED / invalid = unresolved (never wrong). Red metric: CONFIDENT_WRONG_RATE = confident wrong / total. USEFUL_COVERAGE = confident correct / total. Modes never pooled.

**Excluded for every arm:** `real-dom-w-gozdzikowcach-WALL_CONTINUATION-1` — post-review C2: the porch-mouth question's B flank (x 417-436) was drawn over the porch floor and the end of the vestibule wall, not over the pier (dark run x 435-463); the image tells every arm that 'wall piece B is in the blue box' when the box holds no wall - malformed for all arms. (Anecdote only, post-review F13: a re-placement made after seeing results and measured on the wall arms only - with B on the pier (436-455) both wall models answer TERMINATES (0.98 / 0.97). It plays no part in any score.)

**Wall-model rows (`wall-*-structured`) on REAL_DEV are the first, face-placed run** (strips on the 005I truth outline, half outside the building). The post-review re-measurement on the wall axis is in `wall-model-proof.json` → `*.axisRemeasure` (UNet: 61/63 openings OPENING, 47 at ≥ 0.8, none wrong). Pixel shares are not calibrated probabilities; the 0.80 bar is applied to them as fixed before the run.

**ROUND8_DEV** is the data key `REAL_BLIND8`: questions authored from the accepted 005I diagnosis of the two round-8 houses. They are development evidence, not blind generalisation (post-review F14).

**Each arm ran on a different, non-random subset of one pool** (the runs were cut at a declared time); pooled rows therefore mix different questions. §8 scores every pair of arms on the questions both were asked (post-review B1).

**Configurations, as run (post-review B2, B8).** SmolVLM2-500M: `do_image_splitting=False`, one 512² tile = **64 image tokens** (the snapshot default is 16 tiles + a global view = 1,088 tokens), fp32 vision encoder, int8 decoder, forced JSON prefix — its deployable on-device configuration. Moondream 0.5B: at 512² the 0.0.6 client picks one 378² global view and no crops. Florence-2-base: no VQA task, so ENUM_SCORE measures its decoder's text prior.

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
| server-oracle | ORACLE_JSON | CANDIDATE_OVERLAY | ROUND8_DEV | 16 | 100.0 % | 100.0 % | 0.0 % | 100.0 % |
| wall-unet-structured | STRUCTURED | CANDIDATE_OVERLAY | SYNTHETIC | 180 | 86.6 % | 82.8 % | 7.2 % | 60.6 % |
| wall-unet-structured | STRUCTURED | CANDIDATE_OVERLAY | REAL_DEV | 304 | 97.2 % | 35.2 % | 0.7 % | 3.3 % |
| wall-unet-structured | STRUCTURED | CANDIDATE_OVERLAY | ROUND8_DEV | 24 | 100.0 % | 95.8 % | 0.0 % | 62.5 % |
| wall-segformer-structured | STRUCTURED | CANDIDATE_OVERLAY | SYNTHETIC | 180 | 94.6 % | 82.8 % | 0.0 % | 66.1 % |
| wall-segformer-structured | STRUCTURED | CANDIDATE_OVERLAY | REAL_DEV | 304 | 86.5 % | 48.7 % | 6.6 % | 4.6 % |
| wall-segformer-structured | STRUCTURED | CANDIDATE_OVERLAY | ROUND8_DEV | 24 | 80.0 % | 83.3 % | 16.7 % | 58.3 % |
| micro-referee-pilot | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 672 | 85.4 % | 100.0 % | 2.7 % | 71.4 % |
| micro-referee-pilot | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 564 | 49.6 % | 100.0 % | 34.0 % | 29.8 % |
| micro-referee-pilot | ENUM_SCORE | CANDIDATE_OVERLAY | ROUND8_DEV | 64 | 73.4 % | 100.0 % | 7.8 % | 42.2 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | RAW | SYNTHETIC | 272 | 53.3 % | 71.7 % | 2.9 % | 5.1 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | RAW | ROUND8_DEV | 48 | 58.6 % | 60.4 % | 4.2 % | 0.0 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 614 | 44.7 % | 72.2 % | 6.8 % | 2.6 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 289 | 47.4 % | 73.0 % | 6.6 % | 4.5 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | CANDIDATE_OVERLAY | ROUND8_DEV | 64 | 36.6 % | 64.1 % | 14.1 % | 3.1 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | SEMANTIC_OVERLAY | SYNTHETIC | 307 | 48.5 % | 78.5 % | 6.5 % | 2.9 % |
| smolvlm2-500m-onnx-int8dec | ENUM_SCORE | SEMANTIC_OVERLAY | ROUND8_DEV | 64 | 31.1 % | 70.3 % | 6.2 % | 3.1 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | RAW | SYNTHETIC | 34 | 50.0 % | 35.3 % | 17.6 % | 17.6 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | RAW | ROUND8_DEV | 48 | 55.6 % | 37.5 % | 16.7 % | 20.8 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | CANDIDATE_OVERLAY | SYNTHETIC | 342 | 47.2 % | 47.1 % | 24.6 % | 21.3 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | CANDIDATE_OVERLAY | REAL_DEV | 289 | 73.4 % | 42.9 % | 11.4 % | 31.5 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | CANDIDATE_OVERLAY | ROUND8_DEV | 64 | 60.7 % | 43.8 % | 17.2 % | 26.6 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | SEMANTIC_OVERLAY | SYNTHETIC | 34 | 50.0 % | 17.6 % | 8.8 % | 8.8 % |
| smolvlm2-500m-onnx-int8dec | GEN_LENIENT | SEMANTIC_OVERLAY | ROUND8_DEV | 64 | 51.6 % | 48.4 % | 23.4 % | 25.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | RAW | SYNTHETIC | 7 | 42.9 % | 100.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | RAW | ROUND8_DEV | 3 | 0.0 % | 33.3 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 262 | 40.7 % | 53.4 % | 1.5 % | 1.5 % |
| moondream-0.5b-int8 | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 187 | 63.5 % | 27.8 % | 2.1 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | CANDIDATE_OVERLAY | ROUND8_DEV | 64 | 33.3 % | 18.8 % | 1.6 % | 1.6 % |
| moondream-0.5b-int8 | ENUM_SCORE | SEMANTIC_OVERLAY | SYNTHETIC | 6 | 33.3 % | 100.0 % | 16.7 % | 0.0 % |
| moondream-0.5b-int8 | ENUM_SCORE | SEMANTIC_OVERLAY | ROUND8_DEV | 3 | 0.0 % | 33.3 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | GEN_LENIENT | RAW | ROUND8_DEV | 3 | — | 0.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | GEN_LENIENT | CANDIDATE_OVERLAY | SYNTHETIC | 30 | 50.0 % | 13.3 % | 6.7 % | 6.7 % |
| moondream-0.5b-int8 | GEN_LENIENT | CANDIDATE_OVERLAY | ROUND8_DEV | 3 | — | 0.0 % | 0.0 % | 0.0 % |
| moondream-0.5b-int8 | GEN_LENIENT | SEMANTIC_OVERLAY | ROUND8_DEV | 3 | — | 0.0 % | 0.0 % | 0.0 % |
| florence2-base | ENUM_SCORE | RAW | ROUND8_DEV | 11 | 0.0 % | 9.1 % | 9.1 % | 0.0 % |
| florence2-base | ENUM_SCORE | CANDIDATE_OVERLAY | SYNTHETIC | 2 | — | 0.0 % | 0.0 % | 0.0 % |
| florence2-base | ENUM_SCORE | CANDIDATE_OVERLAY | REAL_DEV | 29 | 60.0 % | 17.2 % | 6.9 % | 10.3 % |
| florence2-base | ENUM_SCORE | CANDIDATE_OVERLAY | ROUND8_DEV | 64 | 37.5 % | 50.0 % | 31.2 % | 18.8 % |
| florence2-base | ENUM_SCORE | SEMANTIC_OVERLAY | ROUND8_DEV | 3 | 50.0 % | 66.7 % | 33.3 % | 33.3 % |
| florence2-base | STRUCTURED | RAW | ROUND8_DEV | 8 | — | 0.0 % | 0.0 % | 0.0 % |

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

## 4. ROUND8_DEV questions (the two round-8 houses; development evidence), CANDIDATE_OVERLAY, NORMAL

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
| server-oracle | ROUND8_DEV | 81.3 % | 1 | 1/1 | 0 |
| wall-unet-structured | SYNTHETIC | 53.3 % | 12 | 5/6 | 1 |
| wall-unet-structured | REAL_DEV | 95.4 % | 14 | 10/12 | 1 |
| wall-unet-structured | ROUND8_DEV | 100.0 % | 0 | 0/0 | 0 |
| wall-segformer-structured | SYNTHETIC | 53.3 % | 12 | 9/9 | 0 |
| wall-segformer-structured | REAL_DEV | 95.4 % | 14 | 14/14 | 0 |
| wall-segformer-structured | ROUND8_DEV | 100.0 % | 0 | 0/0 | 0 |
| micro-referee-pilot | SYNTHETIC | 51.8 % | 72 | 64/72 | 3 |
| micro-referee-pilot | REAL_DEV | 76.2 % | 116 | 48/116 | 51 |
| micro-referee-pilot | ROUND8_DEV | 81.3 % | 4 | 0/4 | 3 |
| smolvlm2-500m-onnx-int8dec | SYNTHETIC | 54.1 % | 114 | 25/75 | 2 |
| smolvlm2-500m-onnx-int8dec | REAL_DEV | 76.8 % | 58 | 8/40 | 6 |
| smolvlm2-500m-onnx-int8dec | ROUND8_DEV | 81.3 % | 4 | 1/1 | 0 |
| moondream-0.5b-int8 | SYNTHETIC | 53.1 % | 48 | 35/36 | 0 |
| moondream-0.5b-int8 | REAL_DEV | 74.9 % | 41 | 8/26 | 4 |
| moondream-0.5b-int8 | ROUND8_DEV | 81.3 % | 4 | 4/4 | 0 |
| florence2-base | SYNTHETIC | 100.0 % | 0 | 0/0 | 0 |
| florence2-base | REAL_DEV | 65.5 % | 1 | 0/1 | 1 |
| florence2-base | ROUND8_DEV | 81.3 % | 4 | 0/0 | 0 |

## 7. Latency (desktop x86-64 CPU, image path, contended 4-core container)

| model / read-out | n | median ms | p95 ms |
| --- | --- | --- | --- |
| florence2-base|score | 109 | 23083.0 | 31300.4 |
| micro-referee-pilot|score | 1300 | 22.4 | 32.0 |
| moondream-0.5b-int8|gen | 39 | 16829.0 | 20777.4 |
| moondream-0.5b-int8|score | 532 | 15106.9 | 20959.9 |
| smolvlm2-500m-onnx-int8dec|gen | 875 | 3587.8 | 7895.9 |
| smolvlm2-500m-onnx-int8dec|score | 1658 | 2467.2 | 5323.4 |

## 8. Matched subsets (post-review B1, B7)

The arms were stopped at a declared cut-off and cover different, non-random subsets of one pool, so §1 compares different question mixes (SmolVLM2: 63 % synthetic; Florence-2: 67 % blind-8; oracle: 69 % stratified synthetic). Here each pair of arms is scored on the questions both were asked (primary read-out, CANDIDATE_OVERLAY; cw = confident wrong at ≥ 0.80). The small VLMs' mirror / rotation figures in §1 are almost entirely synthetic plus 16 blind-8 base questions.

| arms | n (by set) | first arm | second arm |
| --- | --- | --- | --- |
| florence2-base ∩ micro-referee-pilot | 95 (ROUND8_DEV 64, REAL_DEV 29, SYNTHETIC 2) | 15/37 answered right, cw 22 | 63/95 answered right, cw 16 |
| florence2-base ∩ moondream-0.5b-int8 | 95 (ROUND8_DEV 64, REAL_DEV 29, SYNTHETIC 2) | 15/37 answered right, cw 22 | 8/22 answered right, cw 1 |
| florence2-base ∩ server-oracle | 21 (ROUND8_DEV 16, REAL_DEV 5) | 3/8 answered right, cw 5 | 21/21 answered right, cw 0 |
| florence2-base ∩ smolvlm2-500m-onnx-int8dec | 95 (ROUND8_DEV 64, REAL_DEV 29, SYNTHETIC 2) | 15/37 answered right, cw 22 | 25/58 answered right, cw 10 |
| florence2-base ∩ wall-segformer-structured | 33 (ROUND8_DEV 24, REAL_DEV 9) | 15/21 answered right, cw 6 | 21/25 answered right, cw 4 |
| florence2-base ∩ wall-unet-structured | 33 (ROUND8_DEV 24, REAL_DEV 9) | 15/21 answered right, cw 6 | 30/30 answered right, cw 0 |
| micro-referee-pilot ∩ moondream-0.5b-int8 | 513 (ROUND8_DEV 64, REAL_DEV 187, SYNTHETIC 262) | 369/513 answered right, cw 75 | 94/204 answered right, cw 9 |
| micro-referee-pilot ∩ server-oracle | 148 (ROUND8_DEV 16, REAL_DEV 30, SYNTHETIC 102) | 109/148 answered right, cw 16 | 144/147 answered right, cw 0 |
| micro-referee-pilot ∩ smolvlm2-500m-onnx-int8dec | 967 (ROUND8_DEV 64, REAL_DEV 289, SYNTHETIC 614) | 740/967 answered right, cw 116 | 313/695 answered right, cw 70 |
| micro-referee-pilot ∩ wall-segformer-structured | 508 (ROUND8_DEV 24, REAL_DEV 304, SYNTHETIC 180) | 344/508 answered right, cw 97 | 285/317 answered right, cw 24 |
| micro-referee-pilot ∩ wall-unet-structured | 508 (ROUND8_DEV 24, REAL_DEV 304, SYNTHETIC 180) | 344/508 answered right, cw 97 | 256/279 answered right, cw 15 |
| moondream-0.5b-int8 ∩ server-oracle | 127 (ROUND8_DEV 16, REAL_DEV 25, SYNTHETIC 86) | 23/49 answered right, cw 5 | 123/126 answered right, cw 0 |
| moondream-0.5b-int8 ∩ smolvlm2-500m-onnx-int8dec | 499 (ROUND8_DEV 64, REAL_DEV 187, SYNTHETIC 248) | 91/195 answered right, cw 9 | 150/353 answered right, cw 39 |
| moondream-0.5b-int8 ∩ wall-segformer-structured | 193 (ROUND8_DEV 24, REAL_DEV 94, SYNTHETIC 75) | 9/18 answered right, cw 0 | 117/129 answered right, cw 9 |
| moondream-0.5b-int8 ∩ wall-unet-structured | 193 (ROUND8_DEV 24, REAL_DEV 94, SYNTHETIC 75) | 9/18 answered right, cw 0 | 117/125 answered right, cw 5 |
| server-oracle ∩ smolvlm2-500m-onnx-int8dec | 142 (ROUND8_DEV 16, REAL_DEV 30, SYNTHETIC 96) | 138/141 answered right, cw 0 | 46/100 answered right, cw 7 |
| server-oracle ∩ wall-segformer-structured | 50 (ROUND8_DEV 6, REAL_DEV 12, SYNTHETIC 32) | 50/50 answered right, cw 0 | 32/37 answered right, cw 4 |
| server-oracle ∩ wall-unet-structured | 50 (ROUND8_DEV 6, REAL_DEV 12, SYNTHETIC 32) | 50/50 answered right, cw 0 | 34/36 answered right, cw 1 |
| smolvlm2-500m-onnx-int8dec ∩ wall-segformer-structured | 356 (ROUND8_DEV 24, REAL_DEV 152, SYNTHETIC 180) | 131/269 answered right, cw 23 | 219/241 answered right, cw 14 |
| smolvlm2-500m-onnx-int8dec ∩ wall-unet-structured | 356 (ROUND8_DEV 24, REAL_DEV 152, SYNTHETIC 180) | 131/269 answered right, cw 23 | 204/226 answered right, cw 14 |
| wall-segformer-structured ∩ wall-unet-structured | 508 (ROUND8_DEV 24, REAL_DEV 304, SYNTHETIC 180) | 285/317 answered right, cw 24 | 256/279 answered right, cw 15 |

Modes on the questions a model has in all three modes (ENUM_SCORE):

| model | n (by set) | RAW | CANDIDATE_OVERLAY | SEMANTIC_OVERLAY |
| --- | --- | --- | --- | --- |
| smolvlm2-500m-onnx-int8dec | 319 (ROUND8_DEV 48, SYNTHETIC 271) | 121/224 answered right, cw 10 | 105/213 answered right, cw 10 | 123/237 answered right, cw 13 |
| moondream-0.5b-int8 | 9 (ROUND8_DEV 3, SYNTHETIC 6) | 2/7 answered right, cw 0 | 2/6 answered right, cw 0 | 2/7 answered right, cw 1 |
| florence2-base | 3 (ROUND8_DEV 3) | 0/1 answered right, cw 1 | 1/2 answered right, cw 1 | 1/2 answered right, cw 1 |

The majority floor on the **answered** subset (a constant per-class guesser over the questions the model chose to answer, classes pooled across sets), and counterfactual pairs whose truth differs and which **both** members answered:

| model | answered | floor on answered | right among answered | cf. pairs both answered | both right | same answer to both |
| --- | --- | --- | --- | --- | --- | --- |
| server-oracle | 147 | 60.5 % | 98.0 % | 47 | 93.6 % | 6.4 % |
| wall-unet-structured | 279 | 72.4 % | 91.8 % | 54 | 63.0 % | 37.0 % |
| wall-segformer-structured | 317 | 76.3 % | 89.9 % | 53 | 84.9 % | 15.1 % |
| micro-referee-pilot | 1300 | 63.7 % | 69.3 % | 288 | 76.4 % | 21.5 % |
| smolvlm2-500m-onnx-int8dec | 695 | 62.7 % | 45.0 % | 142 | 19.0 % | 57.0 % |
| moondream-0.5b-int8 | 204 | 54.4 % | 46.1 % | 50 | 0.0 % | 94.0 % |
| florence2-base | 37 | 75.7 % | 40.5 % | — | — | — |
