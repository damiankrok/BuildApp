#!/usr/bin/env bash
# Check that preview APKs are signed with the preview key — the committed
# apps/android/keystore/preview.keystore, or whatever BUILDPLAN_PREVIEW_* points
# at — by comparing the certificate apksigner reads out of each APK with the one
# in the keystore. This is what makes a new APK install OVER the previous one;
# a build signed with any other key is refused by Android as an update.
#
# Usage:
#   tools/verify-preview-signature.sh              # every APK under app/build/preview-apks
#   tools/verify-preview-signature.sh a.apk b.apk  # specific files, e.g. a downloaded artifact
#
# Needs keytool (any JDK) and apksigner (Android SDK build-tools, found via
# ANDROID_HOME, ANDROID_SDK_ROOT or local.properties). Exit status 1 when any
# APK is signed by another key.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
android_dir="$(cd "$here/.." && pwd)"

keystore="${BUILDPLAN_PREVIEW_KEYSTORE:-$android_dir/keystore/preview.keystore}"
storepass="${BUILDPLAN_PREVIEW_KEYSTORE_PASSWORD:-buildplan-preview}"
alias="${BUILDPLAN_PREVIEW_KEY_ALIAS:-buildplan-preview}"

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk" && -f "$android_dir/local.properties" ]]; then
  sdk="$(sed -n 's/^sdk\.dir=//p' "$android_dir/local.properties" | tr -d '\r')"
fi
apksigner="$(ls -d "$sdk"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -n 1 || true)"
if [[ -z "$apksigner" || ! -x "$apksigner" ]]; then
  echo "apksigner not found under '${sdk:-<no SDK>}/build-tools'. Set ANDROID_HOME or sdk.dir in local.properties." >&2
  exit 2
fi

if [[ ! -f "$keystore" ]]; then
  echo "keystore not found: $keystore" >&2
  exit 2
fi

# apksigner prints the SHA-256 of the DER-encoded certificate; keytool exports exactly those bytes.
expected="$(keytool -exportcert -keystore "$keystore" -storepass "$storepass" -alias "$alias" 2>/dev/null | sha256sum | cut -d' ' -f1)"
if [[ -z "$expected" || "$expected" == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ]]; then
  echo "could not read alias '$alias' from $keystore (wrong password or alias?)" >&2
  exit 2
fi

if [[ $# -gt 0 ]]; then
  apks=("$@")
else
  apks=("$android_dir"/app/build/preview-apks/*.apk)
  if [[ ! -f "${apks[0]}" ]]; then
    echo "no APKs under $android_dir/app/build/preview-apks; run 'npm run android:assembleDebug' first" >&2
    exit 2
  fi
fi

echo "expected signer (from $keystore, alias '$alias'): $expected"
status=0
for apk in "${apks[@]}"; do
  actual="$("$apksigner" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
  if [[ "$actual" == "$expected" ]]; then
    printf 'ok    %s\n' "$(basename "$apk")"
  else
    printf 'FAIL  %s  signed by %s\n' "$(basename "$apk")" "${actual:-<unreadable>}"
    status=1
  fi
done
exit $status
