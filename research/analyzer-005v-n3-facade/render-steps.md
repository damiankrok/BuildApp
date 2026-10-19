# Odtworzenie porównania przed/po (005V-N3)

Wszystko poza repozytorium; brak pikseli wydawcy w wejściu i wyjściu.

1. Replay offline solvera (bez OCR i sieci) na zapieczętowanym grafie N1v A01:

   ```
   npx vite-node research/analyzer-005t-n2/replay-solver.ts -- \
     --run <N1v A01> --package <source-package.json> --cache <cache> --out <katalog>
   ```

   - baza: drzewo `b353729`, model `d93291577e2d…`;
   - kandydat: to samo po `git apply research/analyzer-005v-n3-facade/candidate-glazing-symbol.patch`, model
     `1a427304b56d…`.

2. Sceny: `compileBuilding` + `buildMobileSceneBundle`. Oba modele dają 0 błędów geometrii,
   0 `OPENING_ABOVE_WALL_TOP` i przechodzą round-trip.

3. Przeglądarka:

   ```
   npx vite build apps/web --outDir <dist>
   npx vite preview apps/web --outDir <dist> --port 4182
   ```

4. Zrzuty:

   ```
   CAPTION_COMMIT='b353729 + 005V-N3 (kandydat)' node research/analyzer-005v-facade/capture-preview.mjs <models.json> <out>
   ```

   - `models.json` wskazuje oba `model.json`;
   - widoki: `1-przod` (orto), `6-perspektywa` (¾), `3-lewa` (bok);
   - zestawienia przed | po: ta sama kamera (preset aplikacji).
