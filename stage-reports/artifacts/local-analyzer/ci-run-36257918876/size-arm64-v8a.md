| | bytes | MiB |
| --- | ---: | ---: |
| APK without the local analyzer (app-arm64-v8a-debug.apk, -PlocalAnalyzer=false) | 11,911,438 | 11.36 |
| APK with the local analyzer (app-arm64-v8a-debug.apk) | 29,911,875 | 28.53 |
| **delta** (with − without) | 18,000,437 | 17.17 |
| runtime libnode.so, compressed in the APK | 17,077,722 | 16.29 |
| runtime libnode.so, stripped (installed size) | 49,522,248 | 47.23 |
| analyzer JS (analyzer.mjs + main.mjs) | 1,456,154 | 1.39 |
| analyzer JS, compressed in the APK | 440,860 | 0.42 |
| other new entries (bridge, libc++_shared, manifest), compressed | 481,016 | 0.46 |
