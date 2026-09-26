#!/usr/bin/env bash
# The local analyzer's device gate, run inside a booted emulator (CI) or
# against any device adb sees.
#
#   DESKTOP_FIXTURE=<desktop-hashes.json> [LIVE_URL=<url>] [OUT=<dir>] apps/android/tools/run-device-tests.sh
#
# 1. installs the x86_64 (or arm64) app APK and the instrumentation test APK;
# 2. runs LocalAnalyzerDeviceTest — the runtime installed, the synthetic
#    fixture through the PRODUCTION analyzer.mjs with the desktop pipeline's
#    hashes required, cancel during a download, cancel during compute;
# 3. if LIVE_URL is set, runs the live test (the production launcher on a real
#    URL) — reported separately, because it depends on a third-party site;
# 4. pulls the per-test JSON reports and the relevant logcat into OUT.
#
# Exits non-zero if step 2 fails. The live result is written to OUT/live-status.txt.
set -uo pipefail

OUT="${OUT:-device-reports}"
mkdir -p "$OUT"
APKS="apps/android/app/build/outputs/apk"
PKG="com.buildplan.preview"
RUNNER="$PKG.test/androidx.test.runner.AndroidJUnitRunner"
CLASS="$PKG.LocalAnalyzerDeviceTest"

adb wait-for-device
ABI="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
echo "device ABI: $ABI"
case "$ABI" in
  x86_64) APP_APK="$APKS/debug/app-x86_64-debug.apk" ;;
  arm64-v8a) APP_APK="$APKS/debug/app-arm64-v8a-debug.apk" ;;
  *) echo "::error::no local analyzer runtime for ABI $ABI"; exit 1 ;;
esac

{
  echo "abi=$ABI"
  echo "sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "model=$(adb shell getprop ro.product.model | tr -d '\r')"
  adb shell cat /proc/meminfo | head -3 | tr -d '\r'
  echo "cpus=$(adb shell nproc 2>/dev/null | tr -d '\r')"
} > "$OUT/device.txt"
cat "$OUT/device.txt"

adb install -r -g "$APP_APK" || exit 1
adb install -r -g "$APKS/androidTest/debug/app-debug-androidTest.apk" || exit 1
adb logcat -c || true

EXPECT=()
if [ -n "${DESKTOP_FIXTURE:-}" ] && [ -f "$DESKTOP_FIXTURE" ]; then
  for key in candidateHash modelHash sceneContentHash sceneSha256; do
    value="$(node -e "process.stdout.write(require(require('path').resolve('$DESKTOP_FIXTURE'))['$key'])")"
    cap="$(printf '%s' "${key:0:1}" | tr '[:lower:]' '[:upper:]')${key:1}"
    EXPECT+=(-e "expected$cap" "$value")
  done
  echo "requiring the desktop pipeline's hashes: ${EXPECT[*]}"
fi

TESTS="$CLASS#theRuntimeIsInstalledForThisDevice,$CLASS#fixtureRunsTheProductionAnalyzerAndMatchesTheDesktop,$CLASS#cancelWhileDownloadingStopsAtOnceAndLeavesNothing,$CLASS#cancelWhileComputingEndsTheProcessAndLeavesNothing"
adb shell am instrument -w -e class "$TESTS" "${EXPECT[@]}" "$RUNNER" | tee "$OUT/instrument-fixture.txt"
FIXTURE_OK=1
grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$OUT/instrument-fixture.txt" && FIXTURE_OK=0
grep -q "^OK (4 tests)" "$OUT/instrument-fixture.txt" || FIXTURE_OK=0

LIVE="LIVE_ANDROID_ANALYSIS_NOT_RUN"
if [ -n "${LIVE_URL:-}" ]; then
  adb shell am instrument -w -e class "$CLASS#liveUrlThroughTheProductionLauncher" -e liveUrl "$LIVE_URL" -e liveTimeoutMinutes "${LIVE_TIMEOUT_MINUTES:-40}" "$RUNNER" | tee "$OUT/instrument-live.txt"
  if grep -q "^OK (1 test)" "$OUT/instrument-live.txt"; then LIVE="LIVE_ANDROID_ANALYSIS_PASS"; else LIVE="LIVE_ANDROID_ANALYSIS_FAILED"; fi
fi
echo "$LIVE" > "$OUT/live-status.txt"
echo "live: $LIVE"

adb pull "/sdcard/Android/data/$PKG/files/local-analyzer-reports" "$OUT/" || echo "no reports to pull"
adb logcat -d -v time -s BuildAppLocalAnalyzer:V BuildAppNode:V AndroidRuntime:E lowmemorykiller:V ActivityManager:I > "$OUT/logcat.txt" 2>&1 || true
adb logcat -d -v time > "$OUT/logcat-full.txt" 2>&1 || true

if [ "$FIXTURE_OK" != "1" ]; then
  echo "::error::the local analyzer device tests failed (see $OUT/instrument-fixture.txt)"
  exit 1
fi
echo "local analyzer device tests: OK"
