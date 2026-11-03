# STAGE BUILDPLAN — APK F1C do testu na telefonie OWNER-a

Status: **DONE — APK 1312, solver 2.20.0.** Etap wyłącznie pakujący: bez zmian kodu, bez nowej rekonstrukcji,
bez pełnego CI i regresji ośmiu domów. Telefon: **NOT_RUN** (w sesji nie było urządzenia ani emulatora).

## Źródło

- Gałąź `claude/new-session-3kzcgh`, commit **`b4aa5d2b0aa021a13544322e57d67a91c9190824`** (koniec LINK-F1C),
  czyste drzewo, HEAD = origin.
- Ostatnie opublikowane wersje: wydanie CI `preview-latest` = 1050; ostatnie OWNER APK w historii = **1311**
  (N7-PATCH-04A; brief podawał 1212, ale później wydano 1304–1311). Wybrany versionCode **1312**.

## Budowa

```
cd apps/android
node tools/fetch-nodejs-mobile.mjs          # już obecne: nodejs-mobile 18.20.4
rm -rf app/build/generated/local-analyzer app/build/local-analyzer app/build/preview-apks app/build/outputs/apk
ANDROID_HOME=/opt/android-sdk ./gradlew --no-daemon previewApks -PpreviewVersionCode=1312
```

Lokalny analizator włączony (domyślnie, bez `-PlocalAnalyzer=false`). Paczka analizatora jest zbudowana od nowa
z bieżącego kodu: przed budową usunięte są wygenerowane zasoby, a `bundleLocalAnalyzer` uruchamia
`apps/local-analyzer/build.mjs`. Nie wprowadzono zmian w procesie budowy.

## APK

| pole | wartość |
|---|---|
| plik | `BuildPlan-owner-preview-1312.apk` (= `BuildPlan-Model-Preview-arm64-v8a-debug.apk`), 39 958 890 B |
| SHA-256 | `2e0171f8146f0aef6491f6ba366f52fb102c887432622edf80a7dc1bb33429d5` |
| applicationId / versionCode / versionName | `com.buildplan.preview` / **1312** / `0.1312.0-owner` |
| ABI | `native-code: 'arm64-v8a'`; `lib/arm64-v8a/libnode.so`, `libbuildapp_node_bridge.so`, `libc++_shared.so`, `libfilament-jni.so` |
| podpis | `apksigner verify`: v2 OK, 1 podpisujący, cert SHA-256 `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da` (zgodny z oczekiwanym, ten sam co 1311) |
| uprawnienia | `INTERNET` + `com.buildplan.preview.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (jak w CI) |
| analizator w APK | `assets/local-analyzer/`: 8/8 plików zgodnych z `manifest.json` (SHA-256 i rozmiar); `analyzer.mjs` 3 052 199 B, SHA-256 `772244d8356a68ecbc8023f19ad555c7abc33cc641a25ebc6eb6b6e2b2e94a02` |
| znaczniki F1C w `analyzer.mjs` | `SOLVER_V2_VERSION = "2.20.0"`; `ROOF_CUT_WELD_M`, `CREASE_PROBE_M`, `CREASE_SAMPLES`, `CREASE_REACH_M`, `OPENING_END_JAMB_M`, `endJambs` obecne |

## Smoke test pakowanego analizatora

Zasoby wypakowane z gotowego APK, następnie
`node apps/local-analyzer/scripts/run-host.mjs --dir <apk>/assets/local-analyzer --url <Marcówki ARCHON>`
(host Node 22, ten sam krok co w CI dla paczki z APK). Wynik: `done`, exit 0, ~242 s, `analyzer.solver = 2.20.0`,
replay byte-identical. Wynik nie jest porównywalny hashami z regresją F1C, bo pakiet źródła z żywej strony ma inny hash
(`847a3d2c…` wobec zamrożonego `75370990…`). Nie badano tego w tym etapie.

## Dostawa i ograniczenia

- APK przekazany bezpośrednio jako załącznik w sesji (narzędzie do wydań GitHub niedostępne, jak od FIX-02).
- Nie uruchomiono na telefonie ani emulatorze (`adb devices`: pusto, brak emulatora w SDK). Udany build ≠ test na
  telefonie; ten wykonuje OWNER.
- Instalacja jako aktualizacja: ten sam klucz i wyższy versionCode niż 1311, więc dane aplikacji zostają.
