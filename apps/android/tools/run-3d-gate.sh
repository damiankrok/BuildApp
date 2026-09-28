#!/usr/bin/env bash
# INTEGRATION-003C's 3D gate, run inside a booted emulator (CI) or against
# any device adb sees.
#
#   [OUT=<dir>] [STALL_SECONDS=300] apps/android/tools/run-3d-gate.sh
#
# 1. installs the app and the instrumentation APK;
# 2. streams logcat to OUT/logcat-live.txt from the first second, so a crash
#    of the app — or of the emulator — leaves its last lines behind;
# 3. runs ModelEntryDeviceTest with the app's default render surface: cold
#    start on Dom, `3D` in the navigation bar, back, `3D` again, and a direct
#    launch into 3D. This run decides the exit status;
# 4. if the device is still there, runs it again with each render surface
#    (SURFACE_VIEW, TEXTURE_VIEW) as comparison evidence;
# 5. pulls the test's PNGs and JSON (OUT/model-entry) and writes
#    OUT/status.txt: PASS, FAILED, or DEVICE_LOST (the emulator went away).
#
# Every adb call that can hang on a vanished device runs under a timeout, so
# a lost emulator ends this script in minutes instead of the job's limit.
set -uo pipefail

OUT="${OUT:-model-entry}"
mkdir -p "$OUT"
STALL="${STALL_SECONDS:-300}"
PKG="com.buildplan.preview"
RUNNER="$PKG.test/androidx.test.runner.AndroidJUnitRunner"
CLASS="$PKG.ModelEntryDeviceTest"
APKS="apps/android/app/build/outputs/apk"

online() { timeout 15 adb shell true >/dev/null 2>&1; }

timeout 120 adb wait-for-device || { echo "DEVICE_LOST" > "$OUT/status.txt"; exit 1; }
ABI="$(timeout 15 adb shell getprop ro.product.cpu.abi | tr -d '\r')"
case "$ABI" in
  x86_64) APP_APK="$APKS/debug/app-x86_64-debug.apk" ;;
  arm64-v8a) APP_APK="$APKS/debug/app-arm64-v8a-debug.apk" ;;
  *) echo "::error::no APK for ABI $ABI"; echo "FAILED" > "$OUT/status.txt"; exit 1 ;;
esac

{
  echo "abi=$ABI"
  echo "sdk=$(timeout 15 adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "model=$(timeout 15 adb shell getprop ro.product.model | tr -d '\r')"
  echo "egl=$(timeout 15 adb shell getprop ro.hardware.egl | tr -d '\r')"
  echo "opengles=$(timeout 15 adb shell getprop ro.opengles.version | tr -d '\r')"
  echo "screen=$(timeout 15 adb shell wm size | tr -d '\r' | tail -1)"
  echo "density=$(timeout 15 adb shell wm density | tr -d '\r' | tail -1)"
  timeout 30 adb shell dumpsys SurfaceFlinger 2>/dev/null | grep -i -m3 -E 'GLES:|OpenGL ES' | tr -d '\r'
} > "$OUT/device.txt"
cat "$OUT/device.txt"

timeout "$STALL" adb install -r -g "$APP_APK" || { echo "FAILED" > "$OUT/status.txt"; exit 1; }
timeout "$STALL" adb install -r -g "$APKS/androidTest/debug/app-debug-androidTest.apk" || { echo "FAILED" > "$OUT/status.txt"; exit 1; }

timeout 15 adb logcat -c || true
adb logcat -v time > "$OUT/logcat-live.txt" 2>&1 &
LOGCAT_PID=$!

# instrument <name> [extra am instrument args...] -> 0 pass, 1 fail, 2 device lost
instrument() {
  local name="$1"
  shift
  timeout "$STALL" adb shell am instrument -w -e class "$CLASS" "$@" "$RUNNER" > "$OUT/instrument-$name.txt" 2>&1
  local code=$?
  cat "$OUT/instrument-$name.txt"
  if ! online; then
    echo "the device went away during '$name' (am instrument exit $code)" | tee -a "$OUT/device-lost.txt"
    return 2
  fi
  if grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$OUT/instrument-$name.txt"; then return 1; fi
  grep -q "^OK (2 tests)" "$OUT/instrument-$name.txt" || return 1
  return 0
}

instrument default
GATE=$?
if [ "$GATE" != 2 ]; then
  for surface in SURFACE_VIEW TEXTURE_VIEW; do
    instrument "$surface" -e renderSurface "$surface"
    [ $? = 2 ] && break
  done
fi

if online; then
  timeout "$STALL" adb pull "/sdcard/Android/data/$PKG/files/model-entry" "$OUT/" || echo "no model-entry evidence to pull"
fi
kill "$LOGCAT_PID" 2>/dev/null || true
grep -E "BuildPlanRender|Filament|AndroidRuntime|FATAL|libc  " "$OUT/logcat-live.txt" > "$OUT/logcat-render.txt" 2>/dev/null || true

case "$GATE" in
  0) STATUS=PASS ;;
  2) STATUS=DEVICE_LOST ;;
  *) STATUS=FAILED ;;
esac
echo "$STATUS" | tee "$OUT/status.txt"
[ "$GATE" = 0 ] || { echo "::error::3D gate: $STATUS (see $OUT/)"; exit 1; }
echo "3D gate: PASS"
