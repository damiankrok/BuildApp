#!/usr/bin/env bash
# freeze_check.sh - production freeze hashes for BUILDPLAN-ANALYZER-005M (RESEARCH ONLY).
#
#   research/analyzer-005m/freeze_check.sh [start.txt]
#
# Prints, per production path: tracked file count and sha256 of `git ls-files -s` (mode, blob hash, path), i.e. of
# the committed index. With a start file (written by this same loop at the stage's first commit) it diffs and exits 1
# on any change. The stage branch starts at 47811e0953834af3ade62d314b35fc00f94ea4c9.
set -euo pipefail
cd "$(dirname "$0")/../.."
now=$(for t in packages packages/source-analyzer packages/reconstruction packages/source-cv packages/source-metrics packages/source-vision \
    packages/model packages/geometry apps package.json package-lock.json .github; do
  printf "%s\t%s\t%s\n" "$t" "$(git ls-files -- $t | wc -l)" "$(git ls-files -s -- $t | sha256sum | cut -c1-64)"
done)
echo "$now"
if [ $# -ge 1 ]; then
  if diff <(echo "$now") "$1"; then echo "FREEZE: IDENTICAL"; else echo "FREEZE: CHANGED"; exit 1; fi
fi
