#!/usr/bin/env bash
# Screenshots of the product shell (INTEGRATION-003B), on a booted emulator.
#
#   [BEFORE_APK_DIR=<dir with an earlier preview APK>] [OUT=<dir>] apps/android/tools/capture-shell-screens.sh
#
# BEFORE: if BEFORE_APK_DIR holds an earlier preview build (the 003A APK from
# an earlier CI run), it is installed and its one screen is captured at font
# scale 1.0 and 1.3. That build has no places to open, so only its launch
# screen is captured.
# AFTER: this commit's APK, every place but 3D opened by its launch extra
# (com.buildplan.preview.PLACE: HOUSE, STAGES, COSTS, DOCUMENTS, ANALYZER), at
# font scale 1.0 and 1.3, with the emulator's animations off. 3D is not
# opened here: this job's emulator (gfxstream's SwiftShader GLES translator)
# goes away under Filament (INTEGRATION-003C, runs 56-57); the 3D screens
# come from the android-3d-gate job, on ANGLE, through the real navigation.
#
# It uninstalls the app between builds (the two are signed differently),
# so run it after any test that needs the app's data. Never fails the job:
# a screenshot is evidence, not a gate.
set -uo pipefail

OUT="${OUT:-shell-screens}"
mkdir -p "$OUT"
PKG="com.buildplan.preview"
ACTIVITY="$PKG/.MainActivity"
APKS="apps/android/app/build/outputs/apk"

adb wait-for-device
ABI="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
case "$ABI" in
  x86_64) APP_APK="$APKS/debug/app-x86_64-debug.apk" ;;
  arm64-v8a) APP_APK="$APKS/debug/app-arm64-v8a-debug.apk" ;;
  *) echo "no APK for ABI $ABI"; exit 0 ;;
esac

font() { adb shell settings put system font_scale "$1" >/dev/null 2>&1 || true; }
shot() {
  # Let the first frame of a 3D scene and the text settle; then capture the whole screen.
  sleep "$2"
  adb exec-out screencap -p > "$OUT/$1.png" || echo "screencap failed for $1"
}
launch() { adb shell am start -S -W -n "$ACTIVITY" "$@" >/dev/null 2>&1 || true; }

adb shell settings put global window_animation_scale 0 || true
adb shell settings put global transition_animation_scale 0 || true
adb shell settings put global animator_duration_scale 0 || true

if [ -n "${BEFORE_APK_DIR:-}" ]; then
  BEFORE_APK="$(ls "$BEFORE_APK_DIR"/*"$ABI"*.apk 2>/dev/null | head -1)"
  if [ -n "$BEFORE_APK" ]; then
    adb uninstall "$PKG" >/dev/null 2>&1 || true
    if adb install -r -g "$BEFORE_APK"; then
      for scale in 1.0 1.3; do
        font "$scale"; launch; shot "before-launch-font-$scale" 12
      done
    fi
  else
    echo "no earlier APK for $ABI in $BEFORE_APK_DIR"
  fi
fi

adb uninstall "$PKG" >/dev/null 2>&1 || true
adb install -r -g "$APP_APK" || { echo "could not install $APP_APK"; font 1.0; exit 0; }
for scale in 1.0 1.3; do
  font "$scale"
  for place in HOUSE STAGES COSTS DOCUMENTS ANALYZER; do
    launch --es "$PKG.PLACE" "$place"
    shot "after-$(echo "$place" | tr '[:upper:]' '[:lower:]')-font-$scale" 10
  done
done
font 1.0
ls -la "$OUT"
exit 0
