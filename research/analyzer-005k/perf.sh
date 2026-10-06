#!/bin/bash
# perf.sh <out dir> <rows> — BUILDPLAN-ANALYZER-005K rule cost, the current sources against the pre-005K ones (RESEARCH ONLY).
# The pre-005K reconstruction sources (1314df7) are swapped in place for one timing pass and restored with
# `git checkout`; the tree is checked clean before and after. Nothing else may run from this tree meanwhile.
set -euo pipefail
OUT=$1; ROWS=$2; BASE=${BASE:-1314df729edc4eb6bb3af5a4e033727b364b4153}
cd "$(dirname "$0")/../.."
mkdir -p "$OUT"
FILES="packages/reconstruction/src/boundary-evidence.ts packages/reconstruction/src/plan-decomposition.ts packages/reconstruction/src/layout.ts packages/reconstruction/src/v2/reconstruct-v2.ts packages/reconstruction/src/failure.ts packages/reconstruction/src/plan-diagnostics.ts packages/reconstruction/src/index.ts"
[ -z "$(git status --porcelain -- packages)" ] || { echo "packages/ is not clean"; exit 1; }
for pass in 1 2; do
  npx vite-node research/analyzer-005k/perf.ts -- --rows "$ROWS" --repeat 3 --mode OFF --out "$OUT/new-off-$pass.json"
  npx vite-node research/analyzer-005k/perf.ts -- --rows "$ROWS" --repeat 3 --mode ON --out "$OUT/new-on-$pass.json"
  for f in $FILES; do git show "$BASE:$f" > "$f"; done
  npx vite-node research/analyzer-005k/perf.ts -- --rows "$ROWS" --repeat 3 --mode OFF --out "$OUT/old-$pass.json" || true
  git checkout -- $FILES
  [ -z "$(git status --porcelain -- packages)" ] || { echo "packages/ is not clean after restoring"; exit 1; }
done
echo PERF-DONE
