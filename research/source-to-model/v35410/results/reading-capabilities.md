| klucz | znaczenie / dokument / konsument / korekta |
|---|---|
| `DETAILS:elevations[].openings[].contour` | {"field":"which contour the opening box traces (FRAME / GLASS / EXPOSED)","document":"observations.elevations[].openings[].contour","consumer":"resolveHouse openings: an EXPOSED box gives no sill or low head; FRAME stays frame","correction":"SET_OPENING_DETAIL |
| `DETAILS:elevations[].openings[].hiddenBelowY` | {"field":"the row below which the opening is hidden","document":"observations.elevations[].openings[].hiddenBelowY","consumer":"resolveHouse openings: rows below are not read as sill/head","correction":"SET_OPENING_DETAIL"} |
| `DETAILS:elevations[].openings[].hiddenBy` | {"field":"what hides it","document":"observations.elevations[].openings[].hiddenBy","consumer":"resolveHouse openings (trace)","correction":"SET_OPENING_DETAIL"} |
| `DETAILS:elevations[].openings[].mullionsX` | {"field":"columns of the vertical profiles between panes","document":"geometry.openings[].divisions.mullions","consumer":"houseProgram: placeWindow divisions / placeDoor panel fractions","correction":"SET_OPENING_DETAIL"} |
| `DETAILS:elevations[].openings[].transomsY` | {"field":"rows of horizontal profiles","document":"geometry.openings[].divisions.transoms","consumer":"recorded; the kernel has no transom in a window (named REPRESENTATION_LIMIT)","correction":"SET_OPENING_DETAIL"} |
| `DETAILS:elevations[].openings[].doorLeaves` | {"field":"how many of its panes are doors","document":"geometry.openings[].divisions.doorLeaves","consumer":"houseProgram: GLAZED_DOOR panel kinds","correction":"SET_OPENING_DETAIL"} |
| `DETAILS:elevations[].openings[].id` | {"field":"the opening it speaks of (the id the program gave)","document":"binding","consumer":"documentFromReading","correction":"-"} |
| `DETAILS:elevations[].picture` | {"field":"which picture","document":"binding (stable picture id)","consumer":"documentFromReading","correction":"-"} |
| `DETAILS:elevations[].zones[].material` | {"field":"finish family of a zone","document":"geometry.zones[].material","consumer":"houseProgram: createSurfaceRegion with the style profile material","correction":"SET_ZONE"} |
| `DETAILS:elevations[].zones[].tone` | {"field":"its tone","document":"geometry.zones[].tone","consumer":"houseProgram style profile","correction":"SET_ZONE"} |
| `DETAILS:elevations[].zones[].box` | {"field":"its extent on the elevation","document":"geometry.zones[] host wall rect","consumer":"resolveHouse zones → createSurfaceRegion","correction":"SET_ZONE"} |
| `DETAILS:elevations[].zones[].bodyId` | {"field":"the body it is on","document":"geometry.zones[] host","consumer":"resolveHouse zones","correction":"SET_ZONE"} |
| `DETAILS:elevations[].zones[].certainty` | {"field":"how sure","document":"observations","consumer":"resolveHouse: UNSURE zones are not built","correction":"SET_ZONE"} |
| `DETAILS:elevations[].zones[].note` | {"field":"NOTE_ONLY","document":"observations","consumer":"none (explains uncertainty)","correction":"-"} |
| `DETAILS:elevations[].chimneys[].leftX` | {"field":"a chimney seen on this picture: its left column","document":"observations.elevations[].features[] CHIMNEY","consumer":"resolveHouse chimneys (fused across a gable and a side view)","correction":"NONE (SET_FEATURE has no CHIMNEY kind)"} |
| `DETAILS:elevations[].chimneys[].rightX` | {"field":"its right column","document":"same","consumer":"same","correction":"NONE (SET_FEATURE has no CHIMNEY kind)"} |
| `DETAILS:elevations[].chimneys[].topY` | {"field":"its top row","document":"same","consumer":"same","correction":"NONE (SET_FEATURE has no CHIMNEY kind)"} |
| `DETAILS:unknowns` | {"field":"NOTE_ONLY","document":"observations.unknowns","consumer":"none","correction":"-"} |
| `STOREY:storey` | {"field":"which storey this plan is","document":"observations.storeys[].level","consumer":"interiorFromStoreys","correction":"-"} |
| `STOREY:frontEdge` | {"field":"the plan edge the front lies along","document":"orientation of the storey reading","consumer":"interiorFromStoreys","correction":"-"} |
| `STOREY:outline` | {"field":"outer wall faces of this storey","document":"interior source footprint (registration)","consumer":"resolveInterior (register on this level)","correction":"-"} |
| `STOREY:partitions[].a` | {"field":"partition end","document":"interior partitions","consumer":"resolveInterior → createWall INTERIOR","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:partitions[].b` | {"field":"partition end","document":"interior partitions","consumer":"same","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:partitions[].thicknessPx` | {"field":"partition thickness","document":"interior partitions","consumer":"same (DEFAULT 0.12 m when null)","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:doors[].at` | {"field":"door centre","document":"interior doors","consumer":"resolveInterior → cutOpening + placeDoor","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:doors[].widthPx` | {"field":"door width","document":"interior doors","consumer":"same (DEFAULT 0.9 m when null)","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:rooms[].polygon` | {"field":"room or zone polygon","document":"interior rooms","consumer":"resolveInterior → createRoom","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:rooms[].name` | {"field":"room name (separate observation)","document":"interior rooms usage","consumer":"createRoom usage","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:rooms[].number` | {"field":"printed room number","document":"interior rooms (trace)","consumer":"trace","correction":"-"} |
| `STOREY:rooms[].areaLiteral` | {"field":"printed area (a check, never a fit)","document":"interior rooms (check)","consumer":"recorded only: no area check consumes it yet","correction":"-"} |
| `STOREY:rooms[].open` | {"field":"an open zone of a larger space (no wall around it)","document":"interior rooms","consumer":"merge: an open zone never adds a partition","correction":"NONE (a plan reading is corrected by reading the plan again)"} |
| `STOREY:stairs[]` | {"field":"stair run outline","document":"interior stairs (outline only)","consumer":"recorded only: the stair is built from LOCAL where placed, never from the plan reading","correction":"-"} |
| `STOREY:voids[]` | {"field":"floor openings","document":"interior voids","consumer":"createSlab holes","correction":"-"} |
| `STOREY:labels[].literal` | {"field":"printed opening callout (e.g. width/height)","document":"observations.labels[]","consumer":"resolveHouse binds it to an elevation opening: rough width/height PRINTED","correction":"NONE (an unbound callout is said; it is not forced)"} |
| `STOREY:labels[].at` | {"field":"where it is printed","document":"observations.labels[]","consumer":"binding by position on the wall","correction":"NONE (an unbound callout is said; it is not forced)"} |
| `STOREY:labels[].wall` | {"field":"which wall it sits on","document":"observations.labels[]","consumer":"binding","correction":"NONE (an unbound callout is said; it is not forced)"} |
| `STOREY:labels[].kind` | {"field":"window or door","document":"observations.labels[]","consumer":"binding (kind must agree)","correction":"NONE (an unbound callout is said; it is not forced)"} |
| `STOREY:unknowns` | {"field":"NOTE_ONLY","document":"observations.unknowns","consumer":"none","correction":"-"} |
