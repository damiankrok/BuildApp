# BEFORE → AFTER: old verdict vs the three axes (8 ARCHON houses, production runAnalysis)

Same sealed inputs (source package + observation graph) run twice through `runAnalysis`: at base `3a625f1` (service 1.2.0) and with N9-01 (service 1.3.0). Candidate, model, scene and metric-evidence hashes are identical in every house (column "model unchanged").

| house | old verdict (unchanged, now labelled reading completeness) | technical validity | source fidelity | R1 | R3 | R4 | R5 | unchecked items | model unchanged |
|---|---|---|---|---|---|---|---|---|---|
| Jarzmianki (A01) | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (1: CLOSURE) | **UNCHECKED** | PASS (1/0/0) | UNCHECKED (2/0/1) | PASS (2/0/0) | UNCHECKED (0/0/4) | 17 (none 12, partly 5) | yes |
| Goździkowce 3 | COMPLETE_WITH_OPEN_QUESTIONS | VALID | **UNCHECKED** | PASS (1/0/0) | UNCHECKED (2/0/4) | PASS (2/0/0) | UNCHECKED (0/0/4) | 27 (none 24, partly 3) | yes |
| Marcówki GE | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (4: CLOSURE) | **UNCHECKED** | PASS (1/0/0) | UNCHECKED (2/0/1) | PASS (2/0/0) | UNCHECKED (1/0/3) | 15 (none 8, partly 7) | yes |
| Cieszynianki 12 | COMPLETE_WITH_OPEN_QUESTIONS | VALID | **UNCHECKED** | PASS (1/0/0) | UNCHECKED (1/0/1) | PASS (1/0/0) | UNCHECKED (0/0/4) | 27 (none 23, partly 4) | yes |
| Rarytasy 5 | COMPLETE | ERRORS (2: CLOSURE) | **CONFLICT** | PASS (1/0/0) | PASS (1/0/0) | PASS (1/0/0) | CONFLICT (1/3/0) | 30 (none 20, partly 10) | yes |
| Trytomach | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (2: CLOSURE) | **CONFLICT** | PASS (1/0/0) | UNCHECKED (2/0/8) | PASS (2/0/0) | CONFLICT (0/1/3) | 19 (none 15, partly 4) | yes |
| Arganiach | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (3: CLOSURE) | **UNCHECKED** | PASS (1/0/0) | PASS (2/0/0) | PASS (2/0/0) | UNCHECKED (0/0/4) | 28 (none 19, partly 9) | yes |
| Sasanki 3 | COMPLETE_WITH_OPEN_QUESTIONS | ERRORS (1: CLOSURE) | **CONFLICT** | PASS (1/0/0) | UNCHECKED (2/0/2) | PASS (2/0/0) | CONFLICT (0/2/2) | 20 (none 16, partly 4) | yes |

Relation cells: status (items PASS/CONFLICT/UNCHECKED).

## Why, per house

### Jarzmianki (A01)

- summary: 1 technical error; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity UNCHECKED: 0 conflict(s), 5 pass, 5 unchecked; 17 source item(s) not compared; the 3D model is shown in every case
- technical error: CLOSURE: EXTERIOR_INTERSECTION pergola-west-beam-1 + ring-main-0-w3
- R3_WALL_INK **UNCHECKED** `THIN_LINES_ONLY`: ring-main-1-w2: 9.3 m (the whole wall) stands on thin strokes only (9.3 m) — glazing, a slab edge or a line of the sheet; R3 cannot tell which
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_PARTLY_REGISTERED`: REAR elevation frame-asset-gotowy-projekt-dom-w-jarzmiankach-elewacja-19da37ded6: registered on its wall band: read for its facade’s openings, never compared for silhouette or heights (on its walls’ band: 617 px across is the 10.50 m walled width (the walls' drawn span under the roof), so 0.017018 m/px; the apex at row 123 is the ridge datum 8.16 and the silhouette's bottom then lan)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `DISAGREEMENT_NOT_STABLE`: LEFT elevation frame-asset-gotowy-projekt-dom-w-jarzmiankach-elewacja-7854cc828b: 1 of 4 observed checks outside tolerance on 1 feature — one feature only: named, not a stable disagreement
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-jarzmiankach-elewacja-ad8fd1a56b: not registered: nothing on it was compared (the silhouette is 16.1925 m across, which is 5.6925 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_PARTLY_REGISTERED`: FRONT elevation frame-asset-gotowy-projekt-dom-w-jarzmiankach-elewacja-b74ed2020b: registered on its wall band: read for its facade’s openings, never compared for silhouette or heights (on its walls’ band: 616 px across is the 10.50 m walled width (the walls' drawn span under the roof), so 0.017045 m/px; the apex at row 122 is the ridge datum 8.16 and the silhouette's bottom then lan)

### Goździkowce 3

- summary: technically valid; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity UNCHECKED: 0 conflict(s), 5 pass, 8 unchecked; 27 source item(s) not compared; the 3D model is shown in every case
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-z-7 (0.398682 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-z-2 (0.37533 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-x-11 (0.228096 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-x-5 (0.228096 m) is all openings or shorter than its tolerance: no station to read
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-gozdzikowcach-3-elewa-22c3997a33: not registered: nothing on it was compared (the silhouette is 13.991642 m across, which is 0.171642 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: REAR elevation frame-asset-gotowy-projekt-dom-w-gozdzikowcach-3-elewa-9a3be616c4: not registered: nothing on it was compared (no ridge datum to hang it from, and no band of wall across its silhouette to register its walls’ ends on)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-gozdzikowcach-3-elewa-9fc0f059cb: not registered: nothing on it was compared (the silhouette is 41.611111 m across, which is 27.791111 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: FRONT elevation frame-asset-gotowy-projekt-dom-w-gozdzikowcach-3-elewa-df2d450fd1: not registered: nothing on it was compared (no ridge datum to hang it from, and no band of wall across its silhouette to register its walls’ ends on)

### Marcówki GE

- summary: 4 technical errors; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity UNCHECKED: 0 conflict(s), 6 pass, 4 unchecked; 15 source item(s) not compared; the 3D model is shown in every case
- technical error: CLOSURE: EXTERIOR_COPLANAR_DUPLICATE balcony-front-1 + roof-attached-0:fascia-min-z
- technical error: CLOSURE: EXTERIOR_GAP ring-main-0-w1-party-attached-0 + slab-main-1
- technical error: CLOSURE: EXTERIOR_GAP ring-main-0-w1-party-attached-0 + slab-attached-0-0
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-z-3 (0.962729 m) is all openings or shorter than its tolerance: no station to read
- R5_REGISTERED_ELEVATIONS **PASS** `ELEVATION_AGREES_MODEL_ANCHORED`: RIGHT elevation frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-62c53f7671: all 6 observed checks within tolerance (OPENING_HEAD, OPENING_SILL, ROOF_EDGE, SILHOUETTE_WIDTH); 0 of 1 facade openings not checked
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `DISAGREEMENT_NOT_STABLE`: LEFT elevation frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-9a66c9827c: 1 of 4 observed checks outside tolerance on 1 feature — one feature only: named, not a stable disagreement
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `DISAGREEMENT_NOT_STABLE`: REAR elevation frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-f3a4552876: 8 of 27 observed checks outside tolerance on 5 features — under the third (0.296296) the cross-view summary calls DISAGREES: named, not a stable disagreement
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `DISAGREEMENT_NOT_STABLE`: FRONT elevation frame-asset-gotowy-projekt-dom-w-marcowkach-ge-elewacj-f8462d58b4: 3 of 29 observed checks outside tolerance on 2 features — under the third (0.103448) the cross-view summary calls DISAGREES: named, not a stable disagreement

### Cieszynianki 12

- summary: technically valid; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity UNCHECKED: 0 conflict(s), 3 pass, 5 unchecked; 27 source item(s) not compared; the 3D model is shown in every case
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: pocket-main-0-1-back (2.194383 m) is all openings or shorter than its tolerance: no station to read
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: RIGHT elevation frame-asset-gotowy-projekt-dom-w-cieszyniankach-12-ge-20f0eef8f3: not registered: nothing on it was compared (registered on its walls' band it puts the ground at 0.79 m against -0.17 m from the house's other views)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_PARTLY_REGISTERED`: REAR elevation frame-asset-gotowy-projekt-dom-w-cieszyniankach-12-ge-61de9c3488: registered on its wall band: read for its facade’s openings, never compared for silhouette or heights (on its walls’ band: 685 px across is the 11.66 m walled width (the walls' drawn span under the roof), so 0.017022 m/px; the apex at row 183.174757 is the ridge datum 7.2 and the silhouette's bottom th)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_PARTLY_REGISTERED`: LEFT elevation frame-asset-gotowy-projekt-dom-w-cieszyniankach-12-ge-85fbca6930: registered on its wall band: read for its facade’s openings, never compared for silhouette or heights (on its walls’ band: 971 px across is the 16.60 m walled depth (the walls' drawn span under the roof), so 0.017096 m/px; the apex at row 176 is the ridge datum 7.2 and the silhouette's bottom then land)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_PARTLY_REGISTERED`: FRONT elevation frame-asset-gotowy-projekt-dom-w-cieszyniankach-12-ge-a35814d452: registered on its wall band: read for its facade’s openings, never compared for silhouette or heights (on its walls’ band: 686 px across is the 11.66 m walled width (the walls' drawn span under the roof), so 0.016997 m/px; the apex at row 182.586538 is the ridge datum 7.2 and the silhouette's bottom th)

### Rarytasy 5

- summary: 2 technical errors; reading completeness COMPLETE; source fidelity CONFLICT: 3 conflict(s), 4 pass, 0 unchecked; 30 source item(s) not compared; the 3D model is shown in every case
- technical error: CLOSURE: EXTERIOR_INTERSECTION ring-main-0-w0-1 + roof-attached-0-plane-high
- technical error: CLOSURE: EXTERIOR_INTERSECTION ring-main-0-w0-1 + roof-main-plane-low
- R5_REGISTERED_ELEVATIONS **CONFLICT** `ELEVATION_DISAGREES`: LEFT elevation frame-asset-gotowy-projekt-dom-w-rarytasach-5-g2e-elew-1417866f23: 3 of 4 observed checks on 2 features stand outside tolerance (worst OPENING_SILL -0.678186 m): the registered view and the model disagree
- R5_REGISTERED_ELEVATIONS **CONFLICT** `ELEVATION_DISAGREES`: FRONT elevation frame-asset-gotowy-projekt-dom-w-rarytasach-5-g2e-elew-5de5935285: 6 of 9 observed checks on 2 features stand outside tolerance (worst OPENING_SILL -1.974471 m): the registered view and the model disagree
- R5_REGISTERED_ELEVATIONS **PASS** `ELEVATION_AGREES_MODEL_ANCHORED`: RIGHT elevation frame-asset-gotowy-projekt-dom-w-rarytasach-5-g2e-elew-8abaf52877: all 2 observed checks within tolerance (ROOF_EDGE, SILHOUETTE_WIDTH); 3 of 3 facade openings not checked
- R5_REGISTERED_ELEVATIONS **CONFLICT** `ELEVATION_DISAGREES`: REAR elevation frame-asset-gotowy-projekt-dom-w-rarytasach-5-g2e-elew-c383df2964: 7 of 8 observed checks on 2 features stand outside tolerance (worst OPENING_SILL -1.000492 m): the registered view and the model disagree

### Trytomach

- summary: 2 technical errors; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity CONFLICT: 1 conflict(s), 5 pass, 11 unchecked; 19 source item(s) not compared; the 3D model is shown in every case
- technical error: CLOSURE: EXTERIOR_INTERSECTION pergola-rear-beam-0 + pergola-rear-post-3
- technical error: CLOSURE: EXTERIOR_INTERSECTION pergola-rear-beam-2 + pergola-rear-post-1
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-x-3 (0.405593 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-0-x-0 (0.379982 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: return-east-1-0 (0.224144 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: return-east-1-1 (0.224144 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: return-east-1-2 (0.224144 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: return-west-1-0 (0.234817 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: return-west-1-1 (0.234817 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: return-west-1-2 (0.234817 m) is all openings or shorter than its tolerance: no station to read
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: LEFT elevation frame-asset-gotowy-projekt-dom-w-trytomach-g-elewacja-4db3572da1: not registered: nothing on it was compared (registered on its walls' band it puts the ground at -0.35 m against 0.47 m from the house's other views)
- R5_REGISTERED_ELEVATIONS **CONFLICT** `ELEVATION_DISAGREES`: FRONT elevation frame-asset-gotowy-projekt-dom-w-trytomach-g-elewacja-7b061554b1: 4 of 7 observed checks on 2 features stand outside tolerance (worst ROOF_EDGE -0.603589 m): the registered view and the model disagree
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_PARTLY_REGISTERED`: REAR elevation frame-asset-gotowy-projekt-dom-w-trytomach-g-elewacja-957bead831: registered on its wall band: read for its facade’s openings, never compared for silhouette or heights (on its walls’ band: 884 px across is the 12.99 m walled width (the walls' drawn span under the roof), so 0.014694 m/px; the apex at row 158 is the ridge datum 7.62 and the silhouette's bottom then lan)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-trytomach-g-elewacja-a91e112fb3: not registered: nothing on it was compared (the silhouette is 19.345603 m across, which is 6.356285 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)

### Arganiach

- summary: 3 technical errors; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity UNCHECKED: 0 conflict(s), 5 pass, 4 unchecked; 28 source item(s) not compared; the 3D model is shown in every case
- technical error: CLOSURE: EXTERIOR_COPLANAR_DUPLICATE ring-attached-0-0-w0 + roof-attached-0
- technical error: CLOSURE: EXTERIOR_COPLANAR_DUPLICATE ring-attached-0-0-w1 + roof-attached-0
- technical error: CLOSURE: EXTERIOR_COPLANAR_DUPLICATE ring-attached-0-0-w3 + roof-attached-0
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `DISAGREEMENT_NOT_STABLE`: REAR elevation frame-asset-gotowy-projekt-dom-w-arganiach-g2e-elewacj-134561073d: 4 of 5 observed checks outside tolerance on 1 feature — one feature only: named, not a stable disagreement
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-arganiach-g2e-elewacj-15d78fb30b: not registered: nothing on it was compared (the silhouette is 8.850318 m across, shorter than either wall of a 14.2 by 12.321694 m building)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-arganiach-g2e-elewacj-3fca1cf71a: not registered: nothing on it was compared (the silhouette is 16.494603 m across, which is 2.294603 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `DISAGREEMENT_NOT_STABLE`: FRONT elevation frame-asset-gotowy-projekt-dom-w-arganiach-g2e-elewacj-42881dfc86: 3 of 5 observed checks outside tolerance on 1 feature — one feature only: named, not a stable disagreement

### Sasanki 3

- summary: 1 technical error; reading completeness COMPLETE_WITH_OPEN_QUESTIONS; source fidelity CONFLICT: 2 conflict(s), 5 pass, 4 unchecked; 20 source item(s) not compared; the 3D model is shown in every case
- technical error: CLOSURE: EXTERIOR_INTERSECTION ring-main-1-w1-party-attached-0 + roof-main-plane-high-1
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: ring-attached-0-0-w0 (3.85 m) is all openings or shorter than its tolerance: no station to read
- R3_WALL_INK **UNCHECKED** `NOTHING_TO_READ`: main-iwall-1-z-0-b (0.386391 m) is all openings or shorter than its tolerance: no station to read
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-sasankach-3-g-elewacj-1c45ae540e: not registered: nothing on it was compared (the silhouette is 12.257701 m across, which is 0.657701 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)
- R5_REGISTERED_ELEVATIONS **UNCHECKED** `VIEW_NOT_REGISTERED`: SIDE_UNSPECIFIED elevation frame-asset-gotowy-projekt-dom-w-sasankach-3-g-elewacj-9b7902ddb2: not registered: nothing on it was compared (the silhouette is 12.147977 m across, which is 0.547977 m more than the footprint width — the overhang of a roof, on the only axis it can be, but both walls on that axis are already assigned)
- R5_REGISTERED_ELEVATIONS **CONFLICT** `ELEVATION_DISAGREES`: FRONT elevation frame-asset-gotowy-projekt-dom-w-sasankach-3-g-elewacj-a66bd73cb2: 8 of 11 observed checks on 2 features stand outside tolerance (worst ROOF_EDGE -0.50104 m): the registered view and the model disagree
- R5_REGISTERED_ELEVATIONS **CONFLICT** `ELEVATION_DISAGREES`: REAR elevation frame-asset-gotowy-projekt-dom-w-sasankach-3-g-elewacj-e411b09da9: 8 of 18 observed checks on 4 features stand outside tolerance (worst ROOF_EDGE -0.594864 m): the registered view and the model disagree
