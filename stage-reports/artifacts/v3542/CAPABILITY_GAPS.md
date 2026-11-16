# CAPABILITY_GAPS: after the first three houses (stage B, 2026-11-16)

**Run:** C1 (live, `claude-sonnet-5-5`, contract 0.1.0 / prompt 0.1.0) on Supertunie 2 E (numeric refusal, ARCHON), Kukliki (control, ARCHON) and Madera (decimal-metre labels / outline, domywstylu).
**Cost:** 10 answered requests, 0.43832 USD. One more request (0.146096 USD) was cut by the operator, see INTERVENTIONS.md.
**Raw events:** private, `/home/user/rd/v3542/C1/<house>/events.jsonl`.

## What the API tried to establish, and what became of it

| House | API task | What it saw / proposed | Analyzer outcome | First loss point |
|---|---|---|---|---|
| Supertunie | literal reading of 10 labels the analyzer could not settle | 10 readings, all legible and correct on the source:<br>• 1350 (bottom to top)<br>• 690 ("a closed-top 9; I do not read it as 640")<br>• 600, 327, 123, 305, 201, 104 and (round 2) 321<br>• two boxes straddled two labels (160/138 and 188/235): it named both and marked them MEDIUM/UNSURE | consumed:<br>• scale **INCONCLUSIVE → STRONG at 2.2425 cm/px** (the source's 690/1350 rectangle)<br>• the run is still refused, now `PLAN_NO_WALLED_ENVELOPE` (PARTIAL, twice) | none in the reading. The next blocker is plan resolution: the envelope/grid (the "archon" watermark on the sheet is read as wall bands, see the A′ probe overlay), which no correction family reaches |
| Kukliki (control) | literal reading of 10 boxes | • 6 readings, correct on the source: 257, 402, 362, 200, and the window tags' 120 and 140<br>• 4 boxes correctly called "no digits" (sink, cooktop, a line fragment, the dashed plan boundary)<br>• named the overall **756** that the analyzer never asked about | • 4 applied, model byte-identical (NO_CHANGE): the correct model was protected<br>• 402 and 200 refused (NO_READING_THAT_WAY): the analyzer holds those inks only the wrong way up | **NOT_SENT**: the overall dimensions 756 / 876 have no label in the analyzer, so they cannot be asked about or consumed<br>**VALIDATION_REJECTED**: no lattice in the direction read |
| Kukliki (4B) | plan + 4 elevations + model views | VERIFIED_IN_SCOPE:<br>• elevations bound to sides (front, right two 160/220 doors, rear 240/140, left)<br>• hip roof<br>• entrance at 0.41 width<br>• missing chimneys noted without a proposal<br>• lists checked / not checked | read-only | none (correct) |
| Madera | literal reading of 5 boxes | • **15,98** (decimal comma, metres) read correctly<br>• 3 boxes correctly called furniture / a column<br>• "2,56 m²" identified as a room area, not a length | • 15,98 applied, model byte-identical (NO_CHANGE)<br>• "2,56 m²" refused (UNPARSEABLE, correct) | **WRONG_BINDING upstream**: the analyzer's dimension-line reader found a 97 px fragment (ticks 246–343) of the ~340 px overall line, so the correct value binds to the wrong span and states 16.5 cm/px. The left overall 18,71 has no label at all (NOT_SENT) |
| Madera (4B) | plan + 1 elevation + model views | ISSUE_FOUND:<br>• garage missing (front right, sectional door, front-facing gable)<br>• roof: main ridge along the front plus a cross gable over the garage<br>• outline not a rectangle<br>• entrance on the wrong tile | recorded only | **CAPABILITY_MISSING** for MISSING_ELEMENT, ROOF_FORM, OUTLINE_REGION |

## Gaps, ranked by how many DEV houses they block (evidence from stage A + B)

1. **A printed dimension the analyzer did not find as a dimension.** The causes are:
   - no label lattice (Kukliki 756/876, Madera 18,71);
   - a fragment of its line (Madera 15,98);
   - no dimension line at all (plan23-504: 0 chains on its main plan);
   - labels unread in feet-inches (plan5-737: 0 labels on 21 lines).

   A correct literal reading cannot be consumed by READ_LABEL there.
   - **Needed operation:** `READ_DIMENSION`, the printed literal (cm, decimal metres or feet-inches) plus the two ends of the span it measures (plan pixels, the extension lines or arrow ends).
   - **Analyzer consumer:**
     - snaps each end to an ink stroke of the plan itself (the span is the analyzer's own measurement, not the model's);
     - parses the literal with its own parser (ft-in added);
     - admits the scale only when two such dimensions on different lines agree within DISTINCT_RATIO (3 %), the same standard the resolver applies to its own readings;
     - never overrules a STRONG/SUPPORTED local scale.
   - **Scene effect:** a verified plan scale where today the page vote or the published-area fallback stands (Kukliki, Madera, plan23-504, plan5-737).
2. **Plan resolution after the scale is right** (Supertunie: envelope/grid). No correction family reaches the wall-band / envelope decision.
   - **Needed:** `OUTLINE_REGION` (a plan region that is or is not building, such as a watermark) with a consumer in the boundary reader.
   - Not implemented in this pilot: it touches the shared boundary reader (regression across every house), and stage B has one case.
3. **Elements and roof form after the build** (Madera garage, cross gable). The model-level families (`MISSING_ELEMENT`, `ROOF_FORM`) need consumers in the composition and roof inference.
   - The roof axis has no per-mass override today (map: roof-systems.ts / ridge-axis.ts are house-wide).
   - Not implemented in this pilot.
4. **A label read the wrong way up by the analyzer** (Kukliki 402, 200). The validator refuses a reading for which the analyzer holds no lattice in that direction.
   - **Needed:** a token in the stated orientation.
   - The `READ_DIMENSION` consumer of gap 1 covers the same need for dimensions.
5. **Problem selection:**
   - round 2 asked again about labels already consulted (327, 104), which the fix excludes;
   - an ink box can straddle two printed labels (Supertunie 160/138, 188/235).
   - **Needed:** the ink grouping refuses boxes with two orientations' readings of different strings when their extents differ (kept as a recorded limitation).

## Minimal additions made after stage B (before stage C)

- `READ_DIMENSION` (gap 1): contract and prompt 0.2.0, validator, the analyzer's consumer (`source-metrics/consulted-spans.ts`) and an ft-in literal parser. Counter-trial tests:
  - a wrong digit (no agreement, so no scale);
  - a single dimension (refused: one witness);
  - an end off any stroke (SNAP_FAILED);
  - a span that is not axis-aligned;
  - a scale contradicting a settled local scale (refused);
  - a duplicate.
- Problem selection excludes labels already consulted (gap 5).
- Gaps 2 to 4 stay CAPABILITY_MISSING, recorded on every proposal of those families.
