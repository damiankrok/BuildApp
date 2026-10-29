# N9-00 — geometry vs room semantics: SpaceRegion and FunctionalRoom

This is an architecture design only. Nothing here is implemented and no schema is proposed for merge in N9-00.

## 1. Why the regions do not match the room counts (RO + CV)

`readInterior` (`packages/reconstruction/src/v2/interior.ts:187`) produces **regions**:
- a flood fill over a 5 cm grid;
- barriers are drawn partitions, door gaps closed by a drawn swing, solid blocks, and slab openings.

A region is "floor connected without crossing anything drawn". **CV**

The ARCHON table lists **functional rooms**: number, name and usable area, per storey.

| house, storey | regions (model, solver 2.17.0) | rooms in the ARCHON table | where they differ | what the plan draws there (RO, N8-03D2 overlays) |
|---|---|---|---|---|
| Arganiach attic | 6 | 8 | 2 Pokój + 3 Garderoba → one region; 1 Hol + 8 Schody → one region | No partition or door between 2 and 3: an open walk-in wardrobe. No wall between the stair and the hall. |
| Trytomach attic | 8 | 9 | 1 Schody + 2 Korytarz → one region | The stair opens onto the corridor; no wall drawn |

Both differences are **correct as geometry**. The drawing has no boundary, and inventing one would break the rule that every boundary comes from the drawing. They are **wrong as semantics**: the owner's "Garderoba 4.26 m²" and "Schody 5.97 m²" are real, named, priced spaces, and the model has no object for them.

The current schema has one concept, `Room`: a polygon plus `usage` (`packages/model/src/schema.ts` RoomSchema). It is used for both roles. So the pipeline must either:
- merge semantics into geometry (one Room "Hol" covering hall + stairs, one label lost); or
- split geometry by semantics (invent a wall).

N8-03D2 chose the first, which is the honest one. It still loses two named rooms.

## 2. Labels lost with the rotated-OCR rule (RO: `regression-8-houses.json` of N8-03D2)

Before N8-03D2, room numbers could come from rotated readings: dimension digits and watermark glyphs. N8-03D2 kept only upright readings (the rule a room number obeys). Effects across the 8 houses:
- **Correctly removed:**
  - Arganiach attic: "Hol" on the bathroom and on rooms 2+3 (rotated "1" of 271/273);
  - "Wiatrołap" on the Sasanki garage wing.
- **Lost although right by accident:**
  - Trytomach attic "Łazienka" (from a watermark glyph);
  - "Schody" in A01 and Goździkowce.
- **Remaining:** most attic regions in both houses have **no number**. The upright digits are mostly unread: the page orientation vote discards them, or they fall under the glyph-height gate (`interior.ts:857-861`, `medianHeight × 1.15`).

The upright rule is correct. The loss shows that the label reading is weak, not that the rule is wrong. A label from the wrong ink is a fabricated fact, and an absent label is an honest gap.

## 3. Proposed separation (design)

### SpaceRegion — geometry, from the drawing only

```
SpaceRegion {
  id; levelId
  polygon; holes              // as Room 1.7.0 today
  boundary: Array<{ segment; kind: DRAWN_WALL | DRAWN_DOOR | DRAWN_OPENING | NONE_DRAWN | SLAB_OPENING_EDGE }>
  evidence: SOURCE_DERIVED (plan raster, frame id, trace)
}
```

- It is what `readInterior` produces today, with the boundary explained.
- `NONE_DRAWN` segments are where it touches another SpaceRegion with nothing drawn between. In practice that never happens: a NONE_DRAWN boundary means the two would be one region.
- So the real value is in the next object.

### FunctionalRoom — identity, from the source's own statements

```
FunctionalRoom {
  id; levelId
  number?: string; name?: string        // as published
  publishedArea?: { m2; basis: USABLE | FLOOR | UNKNOWN }
  anchor?: { point; evidence: READ_UPRIGHT_LABEL | SET_ASIDE_LABEL | NONE }   // where its number is printed
  occupies: Array<{ spaceRegionId; share: WHOLE | PART | UNKNOWN }>
  status: LOCATED | LOCATED_SHARED | UNLOCATED
  why
}
```

**Rules:**
- **Existence.** A FunctionalRoom exists because the **published table** lists it. The table is an independent source statement of *existence, name and area*. It is **never** a source of geometry, and it never splits or merges a SpaceRegion.
- **Location.** A FunctionalRoom is LOCATED only by an upright room-number reading inside a SpaceRegion. Two numbers in one SpaceRegion give LOCATED_SHARED on both (Arganiach 2+3, 1+8; Trytomach 1+2). A number never read gives UNLOCATED. The room still exists and is listed as "in the model, place unknown", not guessed from area.
- **The area is a check, not a chooser.** For a WHOLE occupancy, the usable area must be ≤ the region's floor area, and within the slope rule for an attic. A violation is an open question on that pairing. The area never assigns a number (the existing `interior.ts` rule, kept).
- **Downstream.** Quantities and cost lines attach to FunctionalRoom (name, published area) or to SpaceRegion (floor, ceiling, wall faces), and say which.

### Independence of the evidence (relevant to §4 of the brief)

The plan's printed numbers, the published table and a label read by OCR are **not three confirmations**:
- the table and the printed number are the same author's statement;
- OCR is a *reading* of the printed number.

Independent pairs are:
- **(drawn walls → SpaceRegion) vs (printed number position → FunctionalRoom anchor):** different ink.
- **(published area) vs (region floor area):** a statement vs a measurement.

Two readings of the same ink, upright and rotated, are never two pieces of evidence.

## 4. What this would change, and what it would not (H)

- **Arganiach attic:** 6 SpaceRegions, 8 FunctionalRooms.
  - Today every attic number is unread or withheld (room 5's number is misread as "3" and its label withheld at 76 % off), so all 8 would be UNLOCATED. With better upright reading: 2 and 3 LOCATED_SHARED in one region; 1 and 8 shared; the others whole.
- **Trytomach attic:** 8 SpaceRegions, 9 FunctionalRooms.
  - 1 and 2 shared. Only 8 is located by a number read today; 5 (bath) lost its number to the 005U-N4 echo rule.
- **Geometry is unchanged**, so there is no regression risk to walls, slabs or roofs.
- **Cost:** a schema step (two collections, or `Room` → SpaceRegion plus a new FunctionalRoom), its migration, the Android bundle (rooms are only triangles there, so low), and the web inspector.
- Not proposed for N9-01; see `first-systemic-stage-proposal.md` for why it comes later.
