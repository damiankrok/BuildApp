#!/usr/bin/env bash
# INTEGRATION-003C's UI evidence gate, run inside a booted emulator (CI) or
# against any device adb sees.
#
#   [OUT=<dir>] [SLICES=1] [MARCOWKI_URL=…] [SECOND_HOUSE_URL=…] apps/android/tools/run-ui-evidence.sh
#
# 1. installs the app (with the embedded analyzer) and the instrumentation APK;
# 2. runs ProductFlowDeviceTest — the owner's journey through Dom, 3D, Etapy,
#    the time machine, the inspector, the analyzer page, Koszty and
#    Dokumenty, by the screens' own semantics — at font scale 1.0 and 1.3 —
#    and AdaptiveLayoutDeviceTest, the same places in landscape;
# 3. with SLICES=1, runs VerticalSliceDeviceTest on the Marcówki and Rarytasy
#    links: analysed on the phone through the analyzer page, then 3D, progress
#    and history for that house;
# 4. pulls every screenshot and manifest, and validates them: each required
#    PNG exists, is not empty, decodes, and has the screen's size;
# 5. writes OUT/status.txt: PASS, FAILED or DEVICE_LOST, and one status per
#    slice (PASS, SOURCE_UNREACHABLE, FAILED, NOT_RUN).
#
# Every adb call that can hang on a vanished device runs under a timeout.
set -uo pipefail

OUT="${OUT:-ui-evidence}"
mkdir -p "$OUT"
STALL="${STALL_SECONDS:-600}"
SLICE_STALL="${SLICE_STALL_SECONDS:-2700}"
SLICES="${SLICES:-1}"
PKG="com.buildplan.preview"
RUNNER="$PKG.test/androidx.test.runner.AndroidJUnitRunner"
APKS="apps/android/app/build/outputs/apk"
HERE="$(cd "$(dirname "$0")" && pwd)"

online() { timeout 15 adb shell true >/dev/null 2>&1; }

timeout 120 adb wait-for-device || { echo "DEVICE_LOST" > "$OUT/status.txt"; exit 1; }
ABI="$(timeout 15 adb shell getprop ro.product.cpu.abi | tr -d '\r')"
case "$ABI" in
  x86_64) APP_APK="$APKS/debug/app-x86_64-debug.apk" ;;
  arm64-v8a) APP_APK="$APKS/debug/app-arm64-v8a-debug.apk" ;;
  *) echo "::error::no APK for ABI $ABI"; echo "FAILED" > "$OUT/status.txt"; exit 1 ;;
esac
SIZE="$(timeout 15 adb shell wm size | tr -d '\r' | tail -1 | sed 's/.*: //')"
{
  echo "abi=$ABI"
  echo "sdk=$(timeout 15 adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "model=$(timeout 15 adb shell getprop ro.product.model | tr -d '\r')"
  echo "screen=$SIZE"
  echo "density=$(timeout 15 adb shell wm density | tr -d '\r' | tail -1)"
  echo "animator_duration_scale=$(timeout 15 adb shell settings get global animator_duration_scale | tr -d '\r')"
  timeout 30 adb shell dumpsys SurfaceFlinger 2>/dev/null | grep -i -m3 -E 'GLES:|OpenGL ES' | tr -d '\r'
} > "$OUT/device.txt"
cat "$OUT/device.txt"

timeout "$STALL" adb install -r -g "$APP_APK" || { echo "FAILED" > "$OUT/status.txt"; exit 1; }
timeout "$STALL" adb install -r -g "$APKS/androidTest/debug/app-debug-androidTest.apk" || { echo "FAILED" > "$OUT/status.txt"; exit 1; }
timeout 30 adb shell rm -rf "/sdcard/Android/data/$PKG/files/ui-evidence" || true

timeout 15 adb logcat -c || true
adb logcat -v time > "$OUT/logcat-live.txt" 2>&1 &
LOGCAT_PID=$!

# instrument <name> <class> <stall> [extra am instrument args...] -> 0 pass, 1 fail, 2 device lost
instrument() {
  local name="$1" class="$2" stall="$3"
  shift 3
  timeout "$stall" adb shell am instrument -w -e class "$class" "$@" "$RUNNER" > "$OUT/instrument-$name.txt" 2>&1
  local code=$?
  cat "$OUT/instrument-$name.txt"
  if ! online; then
    echo "the device went away during '$name' (am instrument exit $code)" | tee -a "$OUT/device-lost.txt"
    return 2
  fi
  if grep -q "FAILURES!!!\|INSTRUMENTATION_FAILED\|Process crashed" "$OUT/instrument-$name.txt"; then return 1; fi
  grep -q "^OK ([0-9]* tests\{0,1\})" "$OUT/instrument-$name.txt" || return 1
  return 0
}

font() { timeout 15 adb shell settings put system font_scale "$1" >/dev/null 2>&1 || true; }

GATE=0
font 1.0
instrument journey-default "$PKG.ProductFlowDeviceTest" "$STALL" -e reportName default
r=$?; [ "$r" = 2 ] && GATE=2; [ "$r" = 1 ] && GATE=1
if [ "$GATE" != 2 ]; then
  font 1.3
  instrument journey-font-1.3 "$PKG.ProductFlowDeviceTest" "$STALL" -e reportName font-1.3
  r=$?; [ "$r" = 2 ] && GATE=2; { [ "$r" = 1 ] && [ "$GATE" = 0 ]; } && GATE=1
  font 1.0
fi
# 2b. The same product turned to landscape: Dom, 3D with the time machine, Etapy; the rotation keeps one engine.
if [ "$GATE" != 2 ]; then
  instrument landscape "$PKG.AdaptiveLayoutDeviceTest" "$STALL"
  r=$?; [ "$r" = 2 ] && GATE=2; { [ "$r" = 1 ] && [ "$GATE" = 0 ]; } && GATE=1
fi
# 2c. The release-candidate journeys: lifecycle, unhappy paths, interaction collisions (3 tests).
if [ "$GATE" != 2 ]; then
  instrument release-candidate "$PKG.ReleaseCandidateDeviceTest" "$STALL"
  r=$?; [ "$r" = 2 ] && GATE=2; { [ "$r" = 1 ] && [ "$GATE" = 0 ]; } && GATE=1
fi

pull() {
  online && timeout "$STALL" adb pull "/sdcard/Android/data/$PKG/files/ui-evidence" "$OUT/" >/dev/null 2>&1 || echo "no ui-evidence to pull yet"
}

REQUIRED="default:journey font-1.3:journey landscape:adaptive rc-c:lifecycle rc-d:unhappy rc-e:collisions"
slice() {
  local name="$1" url="$2"
  if [ "$SLICES" != 1 ] || [ -z "$url" ] || [ "$GATE" = 2 ]; then echo "NOT_RUN" > "$OUT/slice-$name-status.txt"; return; fi
  instrument "slice-$name" "$PKG.VerticalSliceDeviceTest" "$SLICE_STALL" -e sliceName "$name" -e sliceUrl "$url" -e sliceTimeoutMinutes 40
  local r=$?
  pull
  local manifest="$OUT/ui-evidence/slice-$name-manifest.json"
  if [ "$r" = 2 ]; then GATE=2; echo "DEVICE_LOST" > "$OUT/slice-$name-status.txt"
  elif [ "$r" = 0 ] && grep -q '"result": "PASS"' "$manifest" 2>/dev/null; then echo "PASS" > "$OUT/slice-$name-status.txt"; REQUIRED="$REQUIRED slice-$name:slice"
  elif grep -q 'SOURCE_UNREACHABLE\|Offline' "$manifest" 2>/dev/null; then echo "SOURCE_UNREACHABLE" > "$OUT/slice-$name-status.txt"; echo "::warning::$name: the publisher could not be reached"
  else echo "FAILED" > "$OUT/slice-$name-status.txt"; [ "$GATE" = 0 ] && GATE=1
  fi
}
slice marcowki "${MARCOWKI_URL:-}"
slice rarytasy "${SECOND_HOUSE_URL:-}"

pull
kill "$LOGCAT_PID" 2>/dev/null || true
grep -E "BuildPlanRender|BuildAppLocalAnalyzer|AndroidRuntime|FATAL|TestRunner" "$OUT/logcat-live.txt" > "$OUT/logcat-app.txt" 2>/dev/null || true

# Every required screenshot exists, is not empty, decodes, and has the screen's size.
node "$HERE/validate-ui-evidence.mjs" --dir "$OUT/ui-evidence" --size "$SIZE" --require $REQUIRED --out "$OUT/validation.json"
VALID=$?
if [ "$VALID" != 0 ] && [ "$GATE" = 0 ]; then GATE=1; fi

case "$GATE" in
  0) STATUS=PASS ;;
  2) STATUS=DEVICE_LOST ;;
  *) STATUS=FAILED ;;
esac
echo "$STATUS" | tee "$OUT/status.txt"
[ "$GATE" = 0 ] || { echo "::error::UI evidence gate: $STATUS (see $OUT/)"; exit 1; }
echo "UI evidence gate: PASS"
