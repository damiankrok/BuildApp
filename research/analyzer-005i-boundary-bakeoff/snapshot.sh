#!/bin/bash
# snapshot.sh [<commit>] — a frozen copy of the production packages at <commit> (default HEAD), outside the worktree.
#
# RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). The bake-off imports production code read-only; running it against a
# `git archive` snapshot keeps the measurement stable while the worktree changes under it. Uses only read-only git.
#   WORK (default /home/user/work005i)   REPO (default: this checkout)
set -euo pipefail
REPO=${REPO:-$(cd "$(dirname "$0")/../.." && pwd)}
WORK=${WORK:-/home/user/work005i}
SHA=$(git -C "$REPO" rev-parse "${1:-HEAD}")
S=$WORK/snapshot
rm -rf "$S"; mkdir -p "$S/node_modules/@buildapp" "$S/research"
git -C "$REPO" archive "$SHA" packages tsconfig.base.json tsconfig.json package.json | tar -x -C "$S"
# third-party deps: the checkout's own install, linked; workspace packages: the snapshot's copies
for e in "$REPO"/node_modules/* "$REPO"/node_modules/.bin; do
  b=$(basename "$e"); [ "$b" = "@buildapp" ] && continue; ln -s "$e" "$S/node_modules/$b"
done
for p in "$S"/packages/*; do
  n=$(node -e "console.log(require('$p/package.json').name)"); ln -s "$p" "$S/node_modules/$n"
done
# the numeric recogniser's pinned model (fetched, not in git): copied so the run reads labels as the phone does
cp "$REPO"/packages/numeric-recogniser-ort/models/PP-OCRv6_tiny_rec.* "$S/packages/numeric-recogniser-ort/models/" 2>/dev/null || true
cp -r "$REPO/research/analyzer-005i-boundary-bakeoff" "$S/research/"
echo "$SHA" > "$S/SNAPSHOT_SHA"
echo "snapshot $SHA -> $S"
