# Real-project regressions

| project | source | schema | model hash | roofs | primitives | assemblies | relationships | closure exterior errors | note |
|---|---|---|---|---|---|---|---|---|---|
| marcowki-auto-v3 | sealed candidate marcowki-auto-v3 | 1.6.0 | 731b045edcb18790 | roof-attached-0: FLAT [LEGACY_ROOF]; roof-main: GABLE [LEGACY_ROOF] | Wall 40, Slab 3, SurfaceRegion 3, Opening 21, Window 9, Door 11, GarageDoor 1, RoofOpening 5, Fascia 1, StairFlight 3, Landing 2, RailingRun 2, TerraceSurface 2, BalconySlab 2 | 0 | 0 | 0 | the production analyzer emits the legacy rectangular Roof; its plane graph is derived (LEGACY_ROOF), the model holds no assemblies yet |
| rarytasy | live run model (--rarytasy, outside the repository) | 1.6.0 | 88c514f5af227d2e | roof-attached-0: FLAT [LEGACY_ROOF]; roof-main: GABLE [LEGACY_ROOF] | Wall 20, Slab 2, SurfaceRegion 1, Opening 20, Window 9, Door 10, GarageDoor 1, RoofOpening 1, TerraceSurface 2 | 0 | 0 | 5 | the second regression house, live through the production pipeline; its exterior findings are the legacy flat garage roof and chimney joints the analyzer emits (see the stage report) |
