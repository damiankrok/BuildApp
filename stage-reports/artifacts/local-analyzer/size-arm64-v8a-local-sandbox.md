| | bytes | MiB |
| --- | ---: | ---: |
| APK before this stage (app-arm64-v8a-debug.apk) | 13,609,795 | 12.98 |
| APK without the local analyzer (app-arm64-v8a-debug.apk, -PlocalAnalyzer=false) | 11,910,242 | 11.36 |
| APK with the local analyzer (app-arm64-v8a-debug.apk) | 29,890,567 | 28.51 |
| **delta** (with − without) | 17,980,325 | 17.15 |
| runtime libnode.so, compressed in the APK | 17,077,722 | 16.29 |
| runtime libnode.so, stripped (installed size) | 49,522,248 | 47.23 |
| analyzer JS (analyzer.mjs + main.mjs) | 1,411,349 | 1.35 |
| analyzer JS, compressed in the APK | 420,742 | 0.4 |
| other new entries (bridge, libc++_shared, manifest), compressed | 481,022 | 0.46 |
