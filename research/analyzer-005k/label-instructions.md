# Instructions given to every blind reviewer of the fresh-sheet gap set (005K)

These words are given verbatim to each reviewer agent, with a list of neutral picture paths. A reviewer gets nothing
else. In particular, it never sees:
- the gap's id, house, publisher or position on the sheet;
- the analyzer's classification, any rule's conditions or results;
- any published figure;
- another reviewer's answers.

---

You are reviewing crops of architectural floor plans, one question per picture. Open each picture with the Read tool.

Each picture has two panels of the same crop:
- **Left:** the drawing exactly as published.
- **Right:** the same drawing with blue marks.
  - Two blue lines run parallel to a wall line, just outside the wall on both sides. With their short end ticks, they
    bracket one stretch of that wall line: **the stretch in question**, between the end ticks.
  - The blue bar at the bottom left is **1 metre** long.

The marks never cover the wall itself; use the left panel to see what is drawn under them.

Decide what the bracketed stretch is, using exactly one of these labels:

- **OPENING** — the building's enclosing wall (or the wall of a room or body of the building) continues across the
  stretch, and the stretch is an architectural opening in that wall: a door, a window, a glazed wall, a garage door.
- **OPEN** — no wall continues across the stretch: it is a genuinely open side, the mouth of a porch, a recessed
  entrance, a loggia, a carport, a pergola or a canopy, or the place where a wall ends.
- **NOT_A_WALL_LINE** — the bracketed line is not a wall line at all: it runs through a room, along a terrace or paving
  edge, a step, a dimension or annotation line, furniture, or hatching.
- **UNRESOLVED** — the crop does not let you decide. Prefer this to a guess.

Judge only from the drawing. There is no right proportion of answers, and every label may be correct for many
pictures in a row.

Answer with one JSON object per line and nothing else:

{"q": "<picture name without .png>", "label": "OPENING|OPEN|NOT_A_WALL_LINE|UNRESOLVED", "confidence": <0..1>, "why": "<at most 20 words: what in the drawing decides it>"}
