# BUILDPLAN-INTEGRATION-003A — same-model presentation evidence

Evaluation material. Production code never reads it.

Every image here is the SAME compiled BuildApp scene bundle drawn three ways.
Nothing about the building differs between columns; only the presentation
does. The bundles:

| key | what it is | bundle `contentHash` |
| --- | --- | --- |
| `marcowki-auto-v3` | the BuildApp analyzer's Marcówki output (analyzer v2 + exterior closure, the sealed candidate the APK ships) | `5567f325ecd5e79a9d8c2a2c571bea362d9b727117a7fd053e44b191c21ec61c` |
| `second-house` | the second regression house, run live through the production pipeline for this stage (`npm run analysis:second-house`), model `88c514f5af227d2e…` — the same model the 03G regression summary records — exported with `buildMobileSceneBundle`; the bundle hash equals the analyzer's own `sceneContentHash`. The bundle itself is kept outside the repository. | `029f181e3e900e4840fbcdb0a3496181a92e3a724c1a4cc97f04991248486281` |
| `demo` | the BuildApp demo house (synthetic) | `80ec656b80e41417f1e39495251e55d574d394ec3d1256867591ed547a6985bf` |
| `fixture-roof-dormer-gable` | the 03G synthetic diversity fixture with a gable dormer: a roof interruption that is neither a rooflight nor a chimney | `615f683b1aa2e518a21ca239eaa9cd9c3b6c12bde236f64831c988cdc18257df` |

## Files

- `<key>-modes.png` — rows: three-quarter (the app's *Whole house* pose),
  rear three-quarter (yaw 215°, pitch 24°), front elevation (the app's
  orthographic *Front* preset). Columns: **MODEL**, **CLAY**, **LINE**.
- `<key>-layers.png` — rows: **CLAY**, **LINE**. Columns: layer *All*,
  *Roof off*, *Ground*. The overlays follow their objects: no tile and no roof
  line survives *Roof off*; the ground storey regains its top outline when the
  storey above is hidden.
- `<key>-close-clay.png`, `<key>-close-line.png` — a closer look at the roof
  covering and the lines.
- `presentation-evidence.json` — per scene: bundle hash, overlay statistics
  (entities, edge segments and classes, tiles, triangles, buffer bytes), JVM
  derivation time, and per roof batch the planes, tiles and tiles left out by
  reason.

## How they were made, and what they are not

```
BUILDAPP_PRESENTATION_EVIDENCE_DIR=<dir> \
BUILDAPP_PRESENTATION_EXTRA_SCENES=second-house=<second-house.scene.json> \
  ./gradlew testDebugUnitTest --tests '*PresentationEvidenceTest*'
```

`PresentationRaster` (in the Android unit tests) draws the exact buffers the
Filament renderer uploads — compiled surfaces, derived feature edges, derived
roof covering — with the app's own camera arithmetic, visibility rules, edge
rule and per-mode material values. **It is not Filament**: plain Lambert
light, no shadows, no SSAO, no tone-mapping curve, supersampling instead of
MSAA/FXAA. It shows geometry and ink. How CLAY's shadows and occlusion and
LINE's soft light actually look can only be judged on a phone; the build
environment has no GPU and no `/dev/kvm`.
