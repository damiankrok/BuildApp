#!/usr/bin/env bash
# v3.54.18 — a recorded live run replayed at 0 USD on the tree given: the same answers, the code under test.
#   replay.sh <tree> <house> <url> <recorded live dir> <out dir> <byte cache dir> [extra flags]
set -euo pipefail
TREE=$1; HOUSE=$2; URL=$3; L=$4; OUT=$5; CACHE=$6; shift 6
cd "$TREE"
npx vite-node research/source-to-model/v35417/run.ts -- --url "$URL" --cache "$CACHE" --out "$OUT" --house "$HOUSE" \
  --replay "$L/turns.json" --sketch-replay "$L/sketch-turns.json" --sketch-map "$L/sketches.json" \
  $( [ -f "$L/check-turns.json" ] && echo --check-replay "$L/check-turns.json" ) $( [ -f "$L/outline-turns.json" ] && echo --outline-replay "$L/outline-turns.json" ) "$@"
