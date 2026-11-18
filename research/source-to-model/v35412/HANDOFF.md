# v3.54.12 hand-off

Base `8119d85` (v3.54.11, APK 1342). This stage: research tools and documents only; production code unchanged; 0 USD.
**Blocked on inputs:** the four OWNER images named in the prompt (`1000090696.jpg`, `1000090699.jpg`, `Uproszczona
elewacja domu z garażem.png`, `Kolorowa tylna elewacja domu z balkonem.png`) were not in the session.

## When the images arrive

1. Pair by content: `/usr/bin/python3 -I research/source-to-model/v35412/match-picture.py
   research/source-to-model/v3546/sources/marcowki-ge.source-package.json /home/user/rd/v3546/marcowki/cache <images…>`
   (front = asset `…elewacja-fron-ee81d52db6`, rear = `…elewacja-ogro-77ee09534e`; the selected 1280-px variants).
2. Register each sketch on building points (ground ends, outer corners, ridge apex, frame breaks as ANCHOR; garage
   door left edge, portal end, frame band, rear raked glazings as CHECK): write `points.json`, then
   `register-sketch.py points.json <dir> --warp` (front original 0.017 m/px in the board frame; give `mPerPxOriginal`).
3. `research/source-to-model/v35412/run-sketch.sh "<front sketch>" "<rear sketch>" /home/user/rd/v35412/B` — B, B1, B2,
   scenes, VISUAL_MINIATURE (`identity-marcowki.json`) and the metric diagnostics in one go (~20 min, 0 USD).
4. Boards: `v3548/board-frames.ts --frames /home/user/rd/v35411/HM4/marcowki-ge/house.json …` with A and B models, then
   compose source | sketch | A | B | chosen as in v3.54.11 (`/home/user/rd/v35411/boards`).
5. If B is worse: trace the first wrong LOCAL decision (frame reader on the elevation first — the synthetic smoke run
   shows the frame comes from the elevation only), then one MANUAL_DIAGNOSTIC with the right contour at that boundary.

## Private data (outside Git, `/home/user/rd/v35412/`)

- `metric/`: baseline features, zone points and miniature scores (A, delivered LOCAL, H v3.54.10/11, v3.54.11 controls).
- `SMOKE/` + `SMOKE.log`: the full pipeline on explicitly SYNTHETIC stand-ins (not OWNER sketches; not a result).
- `typecheck.log`.
