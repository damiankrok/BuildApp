# v3.54.5 — detailed source reference (per side, per opening)

A reference is read from the publisher's pictures and page text only. Whoever writes one has not seen any analyzer,
solver, API reading or model output for the house. It is the yardstick of `score-detail.ts`; it never enters production.

File: `<house>.json`, schema `buildapp.v3545.detail-reference`, version 1.

```json
{
  "schema": "buildapp.v3545.detail-reference", "version": 1,
  "house": "<id>", "packageContentHash": "<contentHash of the source package>",
  "reader": "who read it and from what", "readOn": "YYYY-MM-DD",
  "frontPlanEdge": "BOTTOM|TOP|LEFT|RIGHT", "frontHow": "why this is the front",
  "overall": { "widthM": 0, "depthM": 0, "basis": "PRINTED_ON_PLAN|PAGE_TEXT|NOT_GIVEN", "includes": "what the two numbers span" },
  "levels": {
    "ridgeAboveZeroM": 0, "ridgeBasis": "PRINTED_ON_SECTION|PAGE_HEIGHT_MINUS_TERRAIN|NOT_GIVEN",
    "terrainBelowZeroM": 0, "upperFloorLevelsM": [0], "garageRidgeAboveZeroM": null
  },
  "sides": {
    "FRONT": {
      "status": "PUBLISHED|NOT_PUBLISHED|UNREADABLE",
      "asset": "<asset id in the source package>", "file": "<exported file>", "pictureWidthPx": 0, "pictureHeightPx": 0,
      "mirroredAgainstPlan": false,
      "wallLeftPx": 0, "wallRightPx": 0,
      "sideLengthM": 0, "sideLengthBasis": "PRINTED_ON_PLAN|DERIVED_FROM_PLAN|UNKNOWN",
      "zeroRowPx": 0, "zeroRowHow": "printed ±0,00 mark | floor line | ground row and the printed terrain offset",
      "ridgeRowPx": 0,
      "blind": false,
      "openings": [
        { "id": "F1", "kind": "WINDOW|DOOR|GLAZED_DOOR|GARAGE_DOOR|ROOF_WINDOW", "level": 0, "body": "MAIN|GARAGE|WING|BAY|OTHER",
          "inDormer": false, "boxPx": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 }, "panels": 1, "uncertainPx": 6, "occluded": false, "note": "" }
      ],
      "dormers": [ { "id": "FD1", "kind": "WALL_GABLE|ROOF_GABLE|SHED|BOX|CROSS_GABLE", "boxPx": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 } } ],
      "otherFeatures": [ { "kind": "BALCONY|CANOPY|PORTICO|CHIMNEY|LOGGIA|TERRACE_ROOF", "boxPx": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 }, "note": "" } ]
    },
    "RIGHT": {}, "REAR": {}, "LEFT": {}
  },
  "uncertain": ["what could be read two ways"]
}
```

## Meaning

- **Sides** are FRONT, RIGHT, REAR, LEFT of the building: the side a viewer standing outside looks at. RIGHT is the side
  on the right hand of someone standing in front of the house and looking at its front. Compass names are not used.
- **Pixels** are pixels of the published picture named in `file` (the largest published variant), x to the right, y down.
- `wallLeftPx` / `wallRightPx`: the outermost outer WALL faces of the building on this elevation (not the roof overhang,
  not a terrace, not a porch on posts). `sideLengthM` is the real distance between those two faces, from the plan's
  printed dimensions (`PRINTED_ON_PLAN`), or added up from printed parts (`DERIVED_FROM_PLAN`). If it is not known the
  side is still described and `sideLengthBasis` is `UNKNOWN`: its openings are then scored for presence and order only.
- `zeroRowPx`: the row of the finished ground floor (±0,00). `ridgeRowPx`: the row of the main ridge (a check anchor).
- `status`: `NOT_PUBLISHED` when the page has no elevation of this side (then nothing else is given for it);
  `UNREADABLE` when one is published and too small or too covered to read. A side with a published elevation and no
  opening is `PUBLISHED` with `"blind": true` and an empty list.
- **One opening** is one hole in the wall, bounded by wall on every side. Sashes, mullions and glazing bars inside one
  frame are `panels` of one opening. Two frames with wall between them (a pier one can see) are two openings. A door with
  a sidelight in one frame is one opening. `GLAZED_DOOR` is a door or sliding door that is mostly glass and reaches the
  floor; `DOOR` is an entrance or service door; `GARAGE_DOOR` a vehicle door; `ROOF_WINDOW` lies in a roof slope.
- `boxPx` is the hole itself (outer edge of the frame), not shutters, sills or lintels drawn around it.
- `level`: the storey the opening belongs to (0 ground, 1 the next). An opening in a dormer or a gable belongs to the
  storey it lights; `inDormer` says it stands in a dormer.
- `body`: the part of the house whose wall holds it.
- `occluded`: true when part of the opening is hidden (behind a post, a porch, planting); it is then scored for presence
  and position only. `uncertainPx`: how far each edge of the box may be off.
- An opening that cannot be seen on any published elevation is not invented. Symmetry is not a source.

## Version 1.1 — additional top-level fields (confirmation references)

So that the historical six-group scorer of v3.54.4 can be fed from the same file, a confirmation reference also gives:

```json
{
  "version": 1.1,
  "publisher": "<host>", "url": "<page url>",
  "heights": { "buildingHeightM": null, "buildingHeightBasis": "PAGE_TEXT|SECTION|NOT_GIVEN" },
  "outlineShape": "RECTANGLE|L|T|U|STEPPED|OTHER", "outlineNote": "one sentence",
  "bodies": [
    { "name": "main", "role": "MAIN|GARAGE|WING|BAY|OTHER", "sideOfMain": "NA|FRONT|RIGHT|REAR|LEFT", "position": "where it stands",
      "levels": 2, "roof": "GABLE|HIP|SHED|FLAT|OTHER", "ridge": "ALONG_FRONT|FRONT_TO_BACK|NA", "lowerThanMain": false }
  ],
  "chimneys": 0
}
```

`levels` counts storeys with rooms (a habitable attic is a level). `buildingHeightM` is the height above the terrain the
page or the section states; `levels.ridgeAboveZeroM` stays the ridge above ±0,00. They are different quantities.
