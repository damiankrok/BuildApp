| | bytes | MiB |
| --- | ---: | ---: |
| APK without the local analyzer (app-x86_64-debug.apk, -PlocalAnalyzer=false) | 12,032,468 | 11.48 |
| APK with the local analyzer (app-x86_64-debug.apk) | 31,822,052 | 30.35 |
| **delta** (with − without) | 19,789,584 | 18.87 |
| runtime libnode.so, compressed in the APK | 18,858,140 | 17.98 |
| runtime libnode.so, stripped (installed size) | 54,165,616 | 51.66 |
| analyzer JS (analyzer.mjs + main.mjs) | 1,456,154 | 1.39 |
| analyzer JS, compressed in the APK | 440,860 | 0.42 |
| other new entries (bridge, libc++_shared, manifest), compressed | 489,761 | 0.47 |
