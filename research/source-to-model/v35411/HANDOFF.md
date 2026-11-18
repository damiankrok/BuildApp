# v3.54.11 hand-off

Revisions: `38592f7` (sealed scenes H v3.54.10 + LOCAL delivered; scene-list tests read the index; Master Plan
v3.54.11), `caecb9a` (D53 element finish; scorer v1.1; zone references + ray-cast scorer), `84de494` (band cut under
a balcony slab; image-layer tooling, protocol, capability matrix), `d88f13c` (third scene "H po naprawie v3.54.11";
APK 1342 built from it), then the report commit. Base: `62350cc` (code/host v3.54.10), `0cbe5c6` (plan). 0 USD.

## Private data (outside Git, `/home/user/rd/v35411/`)

- `HM1`…`HM4`: the v3.54.10 live recording (`/home/user/rd/v35410/HOST-src`) replayed on the new code; models
  identical; `HM4/marcowki-ge` is the source of the sealed `marcowki-h-v35411.model.json`.
- `R-DEV`, `R-CNEW`, `LAr`: regression replays (all SAME as v3.54.10 apart from the portal material).
- `metric/`: features (v1 / v1.1 / 27 rows), zone references for the APK scenes and the layer runs.
- `layers/`: derived packages (`marcowki-ge-{auto,mask,auto-sky,mask-sky}`, `c4-*-auto`): `package.json`,
  `record.json`, `derived/*.png` + `*.mask.png`, own `cache/`.
- `local/`: LOCAL runs A / B-auto / B-mask (+ sky-fill causal trial) with `.log`, `.time`, `scene.json`.
- `score/`: `score-detail.py` inputs/outputs for the non-Marcówki houses.
- `boards/`: elevations, portal close-up, storeys, oblique, layers board.
- APK: `/home/user/deliver-1342/` (APK, VERSION, SHA256, extract), `/home/user/deliver-1341/`.

## Commands

- Scenes: add `sealedOwnerModel(key, sha256, dir)` in `packages/mobile-scene/scripts/scenes.ts`, then
  `npm run mobile:export-scenes`; APK: `cd apps/android && ./gradlew --no-daemon testDebugUnitTest previewApks
  -PpreviewVersionCode=<n>`; verify with build-tools 35.0.0 (`apksigner verify --print-certs -v`, `aapt2 dump badging`,
  `zipalign -c -P 16 4`, `readelf -lW` on `lib/arm64-v8a/*.so`) and `cmp` of the extracted `assets/scenes/*`.
- Derived packages: `npx vite-node research/source-to-model/v35411/layers.ts -- --package <pkg> --cache <dir> --mode
  auto|mask [--masks research/source-to-model/v35411/masks-marcowki-manual.json] [--fill r,g,b] --out <dir>`; LOCAL:
  `npx vite-node packages/analysis-service/scripts/second-house.ts -- --package <dir>/package.json --cache <dir>/cache
  --recogniser --out <run>`.
- Scene of a saved model: `research/source-to-model/v35411/model-scene.ts -- <model.json> <scene.json>`.
- Marcówki metrics: `v35411/measure-features.ts` → `v3547/marcowki-features.py` (16, v1), `v35411/features-v1_1.py`
  (portal v1.1), `v3548/marcowki-detail.py` (27 rows); `v35411/zone-refs.py zone-refs-marcowki.json <out> label=<scene>…`.
- Other houses: `v3545/measure-scene.ts -- <run dir>…`, then `v3545/score-detail.py --list <list> --refs
  research/source-to-model/v3545/refs-detail-dev --runs NAME=<root>… --out <json>` (root/<house> → run dir).

## Books

Unchanged: 23.808382 of 24.11036 USD (0.301978 USD left). No request was sent in v3.54.11.
