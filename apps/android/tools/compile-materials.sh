#!/usr/bin/env bash
# Compile the Filament material sources in app/src/main/materials into the
# .filamat packages the app loads from its assets.
#
# The compiled packages are committed, so an ordinary `./gradlew assembleDebug`
# needs no Filament toolchain and no network. Rerun this only when a .mat
# source changes, with matc from the SAME Filament version as the
# `filament` entry in gradle/libs.versions.toml — a mismatch is rejected by the
# runtime with "the material was built for a different version".
#
# Usage:
#   FILAMENT_TOOLS_DIR=/path/to/filament ./tools/compile-materials.sh
#   ./tools/compile-materials.sh              # uses matc from PATH
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/../app/src/main/materials"
out="$here/../app/src/main/assets/materials"

if [[ -n "${FILAMENT_TOOLS_DIR:-}" ]]; then
  matc="$FILAMENT_TOOLS_DIR/bin/matc"
else
  matc="$(command -v matc || true)"
fi

if [[ -z "$matc" || ! -x "$matc" ]]; then
  echo "matc not found. Download the Filament release matching gradle/libs.versions.toml" >&2
  echo "from https://github.com/google/filament/releases and set FILAMENT_TOOLS_DIR." >&2
  exit 1
fi

mkdir -p "$out"
for mat in "$src"/*.mat; do
  name="$(basename "$mat" .mat)"
  "$matc" --api opengl --platform mobile --feature-level 1 --optimize-size -o "$out/$name.filamat" "$mat"
  printf '%-14s %8s bytes\n' "$name.filamat" "$(stat -c%s "$out/$name.filamat")"
done
