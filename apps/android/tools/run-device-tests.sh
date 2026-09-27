#!/usr/bin/env bash
# The local analyzer's device gate, run inside a booted emulator (CI) or
# against any device adb sees.
#
#   DESKTOP_FIXTURE=<desktop-hashes.json> [LIVE_URL=<url>] [SECOND_LIVE_URL=<url>] [OUT=<dir>] apps/android/tools/run-device-tests.sh
#
# 1. installs the x86_64 (or arm64) app APK and the instrumentation test APK;
# 2. runs LocalAnalyzerDeviceTest — the runtime installed, the synthetic
#    fixture through the PRODUCTION analyzer.mjs with the desktop pipeline's
#    hashes required, cancel during a download, cancel during compute;
# 3. if LIVE_URL is set, runs the live test (the production launcher on a real
#    URL) — reported separately, because it depends on a third-party site;
#    SECOND_LIVE_URL does the same for a second project, under its own report
#    name (`live-second-house`) and status file (BUILDAPP-03Y2G);
# 4. pulls the per-test JSON reports and the relevant logcat into OUT.
#
# Before the analyzer, INTEGRATION-003C's 3D gate: ModelEntryDeviceTest opens
# the 3D place the way the owner does (cold start on Dom, a tap on `3D`, back,
# `3D` again) and directly, with the app's default render surface — that run
# decides the job — and then once more with each render surface explicitly,
# as comparison evidence (PNGs of the surface and the screen, JSON counters,
# pulled into OUT/model-entry).
#
# Exits non-zero if step 2 or the 3D gate fails. The live result is written to OUT/live-status.txt.
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

MODEL_CLASS="$PKG.ModelEntryDeviceTest"
adb shell am instrument -w -e class "$MODEL_CLASS" "$RUNNER" | tee "$OUT/instrument-model-entry.txt"
MODEL_OK=1
grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$OUT/instrument-model-entry.txt" && MODEL_OK=0
grep -q "^OK (2 tests)" "$OUT/instrument-model-entry.txt" || MODEL_OK=0
for surface in SURFACE_VIEW TEXTURE_VIEW; do
  adb shell am instrument -w -e class "$MODEL_CLASS" -e renderSurface "$surface" "$RUNNER" | tee "$OUT/instrument-model-entry-$surface.txt" || true
done
adb pull "/sdcard/Android/data/$PKG/files/model-entry" "$OUT/" || echo "no model-entry evidence to pull"
adb logcat -d -v time -s BuildPlanRender:V Filament:V AndroidRuntime:E > "$OUT/logcat-render.txt" 2>&1 || true
echo "3D gate (default surface): $([ "$MODEL_OK" = 1 ] && echo OK || echo FAILED)" | tee "$OUT/model-entry-status.txt"

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

SECOND="LIVE_ANDROID_ANALYSIS_NOT_RUN"
if [ -n "${SECOND_LIVE_URL:-}" ]; then
  adb shell am instrument -w -e class "$CLASS#liveUrlThroughTheProductionLauncher" -e liveUrl "$SECOND_LIVE_URL" -e liveReportName live-second-house -e liveTimeoutMinutes "${LIVE_TIMEOUT_MINUTES:-40}" "$RUNNER" | tee "$OUT/instrument-live-second-house.txt"
  if grep -q "^OK (1 test)" "$OUT/instrument-live-second-house.txt"; then SECOND="LIVE_ANDROID_ANALYSIS_PASS"; else SECOND="LIVE_ANDROID_ANALYSIS_FAILED"; fi
fi
echo "$SECOND" > "$OUT/live-second-house-status.txt"
echo "live (second house): $SECOND"

adb pull "/sdcard/Android/data/$PKG/files/local-analyzer-reports" "$OUT/" || echo "no reports to pull"
adb logcat -d -v time -s BuildAppLocalAnalyzer:V BuildAppNode:V AndroidRuntime:E lowmemorykiller:V ActivityManager:I > "$OUT/logcat.txt" 2>&1 || true
adb logcat -d -v time > "$OUT/logcat-full.txt" 2>&1 || true

STATUS=0
if [ "$FIXTURE_OK" != "1" ]; then
  echo "::error::the local analyzer device tests failed (see $OUT/instrument-fixture.txt)"
  STATUS=1
else
  echo "local analyzer device tests: OK"
fi
if [ "$MODEL_OK" != "1" ]; then
  echo "::error::the 3D gate failed: Dom -> 3D, back, 3D again, or a direct launch did not draw the house (see $OUT/instrument-model-entry.txt and $OUT/model-entry/)"
  STATUS=1
else
  echo "3D gate: OK"
fi
exit "$STATUS"
