#!/usr/bin/env bash
# seed_and_run.sh — 005R V0: the UNMODIFIED production acquisition path, replayed on the 005R corpus bytes
# (RESEARCH ONLY; never imported by production).
#
#   research/analyzer-005r/v0/seed_and_run.sh <work-dir> <mode>
#     mode = online   ARCHON and the republishing host: production `source:acquire` with a byte cache pre-seeded from the
#                     005R survey (pages, carousel fragments, images). Cache misses are fetched by production itself
#                     (sequential; robots-permitted paths). DobreDomy is SOURCE_NOT_USABLE in 005R
#                     (source-eligibility.json) and is skipped entirely.
#     mode = offline  every edition replayed from the cache with --offline (the reproducibility runs V0r1, V0r2).
# Output: <work>/v0/<mode-or-run>/<edition>.json sealed packages + .log; nothing in the repository changes.
set -euo pipefail
WORK="$1"; MODE="$2"; RUN="${3:-$MODE}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
CACHE="$WORK/v0/cache"
OUT="$WORK/v0/$RUN"
mkdir -p "$CACHE" "$OUT"
python3 -I "$REPO/research/analyzer-005r/v0/seed_cache.py" "$WORK" "$CACHE"
python3 -I -c "import json,sys; [print(e['canonicalRequested'], e['editionKey'], e['publisher']) for e in json.load(open(sys.argv[1]))]" "$WORK/survey.json" |
while read -r URL KEY PUB; do
  [ "$PUB" = "dobredomy.pl" ] && continue
  NAME="${KEY/:/_}"; [ "$PUB" = "projektydomownowoczesnych.pl" ] && NAME="${NAME}_alt"
  FLAGS="--cache $CACHE --quiet --out $OUT/$NAME.json"
  if [ "$MODE" = "offline" ]; then FLAGS="$FLAGS --offline"; fi
  ( cd "$REPO" && timeout 900 npx --no-install vite-node packages/source-package/scripts/acquire.ts -- "$URL" $FLAGS ) > "$OUT/$NAME.log" 2>&1 || echo "FAILED $KEY" >> "$OUT/failures.txt"
  echo "$KEY done"
done
