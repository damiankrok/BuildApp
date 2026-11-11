# Kontrola APK 1328 i analizy lokalnej (LOCAL) — raport

Zlecenie OWNER-a z 11.11.2026: sprawdzić APK 1328, zainstalować na emulatorze, przejść ścieżkę „Analiza na tym
telefonie” od linku do sceny 3D; przy awarii ustalić przyczynę z logów, naprawić i powtórzyć. Gałąź
`claude/new-session-3kzcgh`, kod dostawy 1328 `80a866e`, poprawka `f8cbb1c` (+ strażnik `e22bf6c`).

| | wynik |
|---|---|
| **Pakowanie 1328** | **PASS** — manifest zgodny z bajtami, biblioteki natywne i most JNI obecne dla arm64-v8a |
| **Przyczyna RUNTIME_STOPPED** | **USTALONA** (źródła Node 18.20.4 + odtworzenie poza urządzeniem): ścisły `TextDecoder` resvg-wasm przy imporcie `analyzer.mjs` na runtime bez ICU |
| **Poprawka** | **APK 1329** (ten sam podpis), testy z kontrprzypadkiem |
| **Pełna próba w aplikacji (emulator)** | **NIE WYKONANA — konkretny brak**: w tym środowisku nie ma wirtualizacji (brak `/dev/kvm`, CPU bez `vmx`/`svm`), nie ma emulatora ani obrazów systemu, `adb devices` jest puste, nie ma podłączonego komputera OWNER-a; dysk 0,76 GB |
| **Galaxy S25 Ultra arm64** | **OTWARTE** — do potwierdzenia przez OWNER-a (§5) |

## 1. Sprawdzony plik

`BuildPlan-Model-Preview-arm64-v8a-debug.apk` z `apps/android/app/build/preview-apks/`, zbudowany w poprzedniej
sesji z `80a866e` i wysłany OWNER-owi (ten sam plik, nie odtworzony):

- SHA-256 `0e01a5c8be1c2a596f6ce914ac78d824a2f35402a2243f15a8955ecf22f03c7c`
- `com.buildplan.preview`, versionCode 1328, versionName `0.1328.0-owner`, targetSdk 35
- podpis v2, 1 podpisujący, `CN=BuildPlan Model Preview`, certyfikat SHA-256
  `6e48fac4afaa3d70e70de5bc608aa4c4194206a9e6bc993dab56382b921ca0da`
- ABI: `arm64-v8a`

`assets/local-analyzer/manifest.json`: 12 pozycji, **12/12 zgodnych co do bajtu i SHA-256**, brak plików spoza
manifestu. `analyzer.mjs` `c71148dac3892af3674277d16fc2485d7dbe3518c67060ab15299df0fff33b79` (3 431 181 B) — ten sam hash
co ze zrzutu z telefonu; `main.mjs` `f1a69daac12fba70c799edcd9aa5049db6f7a4bf6844ecebb45f0e8c08b06aaa`.

`lib/arm64-v8a/`: `libnode.so` (49,5 MB; NEEDED: libm, libdl, liblog, libc++_shared, libc),
`libbuildapp_node_bridge.so` (NEEDED: libnode, liblog, libm, libc++_shared, libdl, libc), `libc++_shared.so`,
`libfilament-jni.so`, `libandroidx.graphics.path.so` — wszystkie zależności spoza systemu są w APK.
Wyrównanie LOAD: `libnode.so` i most 4 KB, pozostałe 16 KB. Nie jest to przyczyna awarii: ten sam `libnode.so`
uruchamia na tym telefonie autotest OCR. Na urządzeniu ze stronami 16 KB byłoby to osobnym problemem (nie badane).

## 2. Przyczyna

1. nodejs-mobile 18.20.4 jest budowany z `--with-intl=none` (zapisane w `apps/local-analyzer/src/text.ts`).
   Jego `TextDecoder` to dekoder JS Node (`makeTextDecoderJS`), który dla `{ fatal: true }` rzuca
   `ERR_NO_ICU` (`lib/internal/encoding.js:484` w v18.20.4).
2. Glue wasm-bindgen biblioteki `@resvg/resvg-wasm` (w bundlu od `b208b39`, ANY-LINK-2, 2026-11-09) tworzy przy
   ewaluacji modułu `new TextDecoder("utf-8", { ignoreBOM: true, fatal: true })` (`analyzer.mjs:11049` w 1328).
3. Import `analyzer.mjs` w `main.mjs` się nie udaje → Node traktuje to jako błąd krytyczny
   (`TriggerUncaughtException` → `env->Exit(1)` → `DefaultProcessExitHandler` → `exit()`), co na Androidzie kończy
   **cały proces `:analyzer`** zanim program wyśle `hello`.
4. Aplikacja widzi śmierć bindera → `onProcessGone` → `RUNTIME_STOPPED` po 0,0 s, bez `hello` i bez pobierania.
5. Autotest OCR ładuje `ocr-self-test.mjs`, nie `analyzer.mjs` — dlatego na tym samym telefonie daje MATCH.

**Dotyczy 1324–1328, nie tylko 1328**: `b208b39` jest też w kodzie APK 1327 (`0fe410a`). Na Linuksie bajty działają,
bo Node z nodejs.org ma ICU. Testy „jak na Androidzie” tego nie złapały, bo symulacja braku ICU
(`test/support/no-icu.cjs`) odtwarzała `Intl`, `localeCompare` i `normalize`, ale nie `TextDecoder`.

**Odtworzenie** (Node 18.20.4 z nodejs.org + uzupełniona symulacja braku ICU — to symulacja, nie urządzenie):

```
TypeError: "fatal" option is not supported on Node.js compiled without ICU
    at new TextDecoder (…/no-icu.cjs:…)
    at file:///…/assets/local-analyzer/analyzer.mjs:11049:62
    at async file:///…/assets/local-analyzer/main.mjs:11:39 {
  code: 'ERR_NO_ICU'
}
exit 1, zero zdarzeń (brak hello)
```

Logcat z telefonu nie był dostępny. Przewidywany wpis dla 1328: `W BuildAppNode: TypeError [ERR_NO_ICU]: "fatal" option …`
w buforze głównym, a w `dumpsys activity exit-info` proces `com.buildplan.preview:analyzer` zakończony przez samego
siebie ze statusem 1. Do potwierdzenia na telefonie (§5).

## 3. Poprawka (`f8cbb1c`, `e22bf6c`)

- `apps/local-analyzer/src/utf8-decoder.ts` — pierwszy import `analyzer.ts`. Gdzie runtime odrzuca ścisły dekoder
  UTF-8 (i tylko tam), `TextDecoder` zastępuje podklasa sprawdzająca bajty wg reguł dekodera UTF-8 WHATWG; samo
  dekodowanie zostaje po stronie runtime'u. Z ICU nic się nie zmienia.
- `apps/local-analyzer/runtime/main.mjs` — błąd ładowania bundla trafia na stderr (logcat `BuildAppNode`) z exit 4
  (`EXIT.LOAD_FAILED`) zamiast `exit()` całego procesu. Kolejna taka usterka da `RUNTIME_EXITED (exit code 4)`
  z przyczyną w logu, a nie „proces zniknął”.
- `test/support/no-icu.cjs` odtwarza teraz także `TextDecoder` Node 18 bez ICU.
- Testy: `test/utf8-decoder.test.ts` (7, m.in. zgodność z ICU na >65 tys. sekwencji, strumień, launcher z exit 4);
  strażnik architektury: adapter wykonuje się przed każdym modułem biblioteki (przed nim tylko leniwe opakowania CJS).

Kontrprzypadek: bez poprawki oba testy „as on Android” padają z `ERR_NO_ICU`. Z poprawką przechodzą, podobnie jak
grupa na prawdziwym Node 18.20.4 (`LOCAL_ANALYZER_NODE18`), w tym „Node 18 WITHOUT ICU”: Larchfield i Holloway hash
w hash z desktopem. `apps/local-analyzer` + `tests/architecture`: 422 testy, 13 błędów historycznych z bazy, 0 nowych.
Android JVM: 459 testów, 4 błędy historyczne (sceny 005T, pliki bez zmian).

## 4. APK 1329 i próba poza urządzeniem

`-PpreviewVersionCode=1329`, kod `f8cbb1c`, ten sam keystore i certyfikat `6e48fac4…` (aktualizacja na miejscu).

| plik | SHA-256 |
|---|---|
| `BuildPlan-Model-Preview-arm64-v8a-debug.apk` | `762ca4394a17c9d054c66b67af49a665d054a0fd2b9e0b59fd565ce23232390f` |
| `BuildPlan-Model-Preview-x86_64-debug.apk` | `b3c1b76f4b467638f2766ff0c71c9c6fdad3c8908486739c937297c35954e609` |
| `BuildPlan-Model-Preview-universal-debug.apk` | `0ccd974894a66a15c5e85909ca286d157d7f6f700a054679fbf61fe56dcd464a` |
| `BuildPlan-Model-Preview-armeabi-v7a-debug.apk` | `d3ba4398d9a058ea44b3cc31fd97ddffe9b570d63e5d72fbbb2e5ff6999c3599` |
| `app-debug-androidTest.apk` (dla `LocalAnalyzerDeviceTest`) | `2d7c0f0fc495a88234fd759fd81487c00a7ff81c70bced349f04f760b16d5eab` |

Manifest 1329: 12/12 zgodnych; `analyzer.mjs` `7b7a26080b959ffa312a3ff0fba5423abc990aba2f53121697d6b81d2f4e3ffd`,
`main.mjs` `f8bccb1c513390feb8a908f53510908fe578ea132254e9a1ebcdd3b2064cc52f`; adapter instalowany w linii 4930,
dekoder resvg tworzony w linii 11138.

**Próba poza urządzeniem** — `assets/local-analyzer/` wyjęte z APK 1329, produkcyjny `main.mjs` z produkcyjnymi
wydawcami, Node 18.20.4 x86-64 Linux + symulacja braku ICU, link
`https://www.archon.pl/projekty-domow/projekt-dom-w-bakopach-g2e-mbb9288266b05e`:

- `hello` jako pierwsze zdarzenie (`node v18.20.4`, `text: embedded-tables`, `collatorLocale: none (no Intl)`),
  potem `ACQUIRING_SOURCE — fetching the project page` po 79 ms;
- 557 zdarzeń (1 hello, 62 progress, 379 telemetry, 114 source, 1 done), exit 0, 416 s, szczyt RSS ok. 1 GB;
- wynik „Dom w bakopach (G2E)”, `sceneSha256` `6a1798e36bab15ed6818a237aa14ba65ce322bcdc68a4165a97632464a97b058`,
  443 874 B; scena wczytuje się (`loadBundle`: 163 siatki).

To nie jest próba w aplikacji: JNI, proces `:analyzer` i przeglądarka 3D nie brały w niej udziału.

## 5. Do wykonania na telefonie (OWNER)

```
adb install -r BuildPlan-Model-Preview-arm64-v8a-debug.apk        # 1329, aktualizacja na miejscu
adb logcat -c
adb logcat -v time BuildAppNode:V BuildAppLocalAnalyzer:V AndroidRuntime:E DEBUG:V *:S
#   w aplikacji: Analiza na tym telefonie → link Bakop → Analizuj → otwórz scenę
adb logcat -b crash -d
adb shell dumpsys activity exit-info com.buildplan.preview
# ta sama ścieżka bez UI:
adb install -r app-debug-androidTest.apk
adb shell am instrument -w -e class com.buildplan.preview.LocalAnalyzerDeviceTest#liveUrlThroughTheProductionLauncher \
  -e liveUrl https://www.archon.pl/projekty-domow/projekt-dom-w-bakopach-g2e-mbb9288266b05e -e liveTimeoutMinutes 20 \
  com.buildplan.preview.test/androidx.test.runner.AndroidJUnitRunner
adb pull /sdcard/Android/data/com.buildplan.preview/files/local-analyzer-reports/live.json
```

PASS pełnej próby = scena otwarta w aplikacji. Na 1328 te same polecenia powinny pokazać `ERR_NO_ICU` w logu `BuildAppNode`.
