# N9-02R — R5 and SOURCE_UNCHECKED before / after (same sealed inputs)

- R5 items over 32 elevations: {'PASS': 2, 'CONFLICT': 6, 'UNCHECKED': 24} → {'PASS': 2, 'CONFLICT': 2, 'UNCHECKED': 28}.
- R1, R3 and R4 are unchanged in every house; so are technical validity and completeness; so are the candidate, model, scene and metric hashes.

## Every R5 status that changed, and the evidence for it

| house | view | before | after | along / vertical | why |
|---|---|---|---|---|---|
| a01 | …7854cc828b | UNCHECKED DISAGREEMENT_NOT_STABLE | UNCHECKED REGISTRATION_DISPUTED | VALID / DISPUTED | LEFT elevation frame-asset-gotowy-projekt-dom-w-jarzmiankach-elewacja-7854cc828b: its vertical registration is disputed (SOLVER_REFUSED_LOW_HEIGHTS: the solver’s own check put its ground off the house’s other views): the 4 residual(s) measured in it (1 outside tolerance, worst ROOF_EDGE 0.45154 m) a |
| marcowki | …9a66c9827c | UNCHECKED DISAGREEMENT_NOT_STABLE | PASS ELEVATION_AGREES_MODEL_ANCHORED | VALID / VALID | LEFT elevation frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-9a66c9827c: all 3 observed checks within tolerance (ROOF_EDGE); 2 of 2 facade openings not checked |
| rary | …1417866f23 | CONFLICT ELEVATION_DISAGREES | UNCHECKED REGISTRATION_DISPUTED | VALID / DISPUTED | LEFT elevation frame-asset-gotowy-projekt-dom-w-rarytasach-5-g2e-elew-1417866f23: its vertical registration is disputed (SOLVER_REFUSED_LOW_HEIGHTS: the solver’s own check put its ground off the house’s other views): the 4 residual(s) measured in it (3 outside tolerance, worst OPENING_SILL -0.678186 |
| rary | …8abaf52877 | PASS ELEVATION_AGREES_MODEL_ANCHORED | UNCHECKED REGISTRATION_DISPUTED | VALID / DISPUTED | RIGHT elevation frame-asset-gotowy-projekt-dom-w-rarytasach-5-g2e-elew-8abaf52877: its vertical registration is disputed (SOLVER_REFUSED_LOW_HEIGHTS: the solver’s own check put its ground off the house’s other views): the 2 residual(s) measured in it (0 outside tolerance) are kept, but are not evide |
| trytomach | …7b061554b1 | CONFLICT ELEVATION_DISAGREES | UNCHECKED REGISTRATION_DISPUTED | DISPUTED / UNAVAILABLE | FRONT elevation frame-asset-gotowy-projekt-dom-w-trytomach-g-elewacja-7b061554b1: its along registration is disputed (SOLVER_REGISTRATION_CONTESTED: solver 0.016046 m/px against this view's wall band 0.014677 m/px and the opposite view's 0.014694 m/px): the 7 residual(s) measured in it (4 outside to |
| sasankach3 | …a66bd73cb2 | CONFLICT ELEVATION_DISAGREES | UNCHECKED REGISTRATION_DISPUTED | VALID / DISPUTED | FRONT elevation frame-asset-gotowy-projekt-dom-w-sasankach-3-g-elewacj-a66bd73cb2: its vertical registration is disputed (SOLVER_REFUSED_LOW_HEIGHTS: the solver’s own check put its ground off the house’s other views): the 11 residual(s) measured in it (8 outside tolerance, worst ROOF_EDGE -0.50104 m |
| sasankach3 | …e411b09da9 | CONFLICT ELEVATION_DISAGREES | UNCHECKED REGISTRATION_DISPUTED | VALID / DISPUTED | REAR elevation frame-asset-gotowy-projekt-dom-w-sasankach-3-g-elewacj-e411b09da9: its vertical registration is disputed (SOLVER_REFUSED_LOW_HEIGHTS: the solver’s own check put its ground off the house’s other views): the 18 residual(s) measured in it (8 outside tolerance, worst ROOF_EDGE -0.594864 m |

Genuine conflicts kept (views with valid axes on both): Rarytasy FRONT …5de5935285 and REAR …c383df2964 (sills up to −1.97 m, roof edges about −0.5 m), and the controls' Lipienniki 6 …5a629d94cb and …7c623015a5.

## SOURCE_UNCHECKED, elevations

| house | items before → after | elevation items now (frame: axes along/height, extent) |
|---|---|---|
| Jarzmianki (A01) | 17 → 17 | …37ded6: FULL/DISPUTED, PARTIAL; …cc828b: FULL/DISPUTED, NONE; …d1a56b: SPAN_ONLY/DISPUTED, NONE; …d2020b: FULL/DISPUTED, PARTIAL |
| Goździkowce 3 | 27 → 27 | …997a33: NONE/NONE, NONE; …e616c4: NONE/NONE, NONE; …f059cb: NONE/NONE, NONE; …450fd1: NONE/NONE, NONE |
| Marcówki GE | 15 → 14 | …552876: FULL/FULL, PARTIAL; …2d58b4: FULL/FULL, PARTIAL |
| Cieszynianki 12 | 27 → 27 | …eef8f3: SPAN_ONLY/DISPUTED, NONE; …9c3488: FULL/FULL, PARTIAL; …ca6930: FULL/DISPUTED, PARTIAL; …14d452: FULL/FULL, PARTIAL |
| Rarytasy 5 | 30 → 32 | …866f23: FULL/DISPUTED, NONE; …f52877: FULL/DISPUTED, NONE |
| Trytomach | 19 → 20 | …572da1: DISPUTED/NONE, NONE; …1554b1: DISPUTED/NONE, NONE; …ead831: FULL/DISPUTED, PARTIAL; …112fb3: NONE/NONE, NONE |
| Arganiach | 28 → 28 | …61073d: FULL/FULL, PARTIAL; …8fb30b: NONE/NONE, NONE; …1cf71a: NONE/NONE, NONE; …1dfc86: FULL/FULL, PARTIAL |
| Sasanki 3 | 20 → 22 | …ae540e: SPAN_ONLY/DISPUTED, NONE; …02ddb2: DISPUTED/DISPUTED, NONE; …d73cb2: FULL/DISPUTED, NONE; …b09da9: FULL/DISPUTED, NONE |
