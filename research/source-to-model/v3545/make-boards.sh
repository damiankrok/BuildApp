#!/bin/bash
# v3.54.5 boards: make-boards.sh <list> <score-detail json> <refs dir> <src dir> <out dir> <title prefix> <label=run name=run root> …
# One board per house: ŹRÓDŁO, then one row per named run (same camera, one scale), with the detailed scorer's markers.
set -u
LIST=$1; SCORE=$2; REFS=$3; SRC=$4; OUT=$5; PREFIX=$6; shift 6
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT/tmp"
while read slug pkg cache; do
  [ -z "$slug" ] && continue
  rows=()
  for spec in "$@"; do
    label=${spec%%=*}; rest=${spec#*=}; run=${rest%%=*}; root=${rest#*=}
    d="-"; m="-"
    if [ -f "$root/$slug/model.json" ]; then
      npx vite-node "$HERE/../v3544/views.ts" -- --model "$root/$slug/model.json" --out "$OUT/tmp/$slug-$run" >/dev/null 2>&1 && d="$OUT/tmp/$slug-$run"
      /usr/bin/python3 -I "$HERE/marks.py" "$SCORE" "$slug" "$run" "$REFS/$slug.json" "$root/$slug" "$OUT/tmp/$slug-$run.marks.json" 2>/dev/null && m="$OUT/tmp/$slug-$run.marks.json"
    fi
    rows+=(--row "$label|$d|$m")
  done
  ref=$(/usr/bin/python3 -I -c "import json,sys; print((json.load(open(sys.argv[1])).get('levels') or {}).get('ridgeAboveZeroM') or '')" "$REFS/$slug.json" 2>/dev/null)
  srcs=(); for f in $(ls "$SRC/$slug"/*.jpg "$SRC/$slug"/*.png 2>/dev/null | head -6); do srcs+=(--src "$f"); done
  notes=(); if [ -f "$OUT/notes/$slug.txt" ]; then while IFS= read -r line; do notes+=(--note "$line"); done < "$OUT/notes/$slug.txt"; fi
  /usr/bin/python3 -I "$HERE/board3.py" --title "$PREFIX $slug" --out "$OUT/$slug.png" "${srcs[@]}" "${rows[@]}" "${notes[@]}" ${ref:+--ref-height $ref --ref-label "kalenica wg źródła +$ref"}
done < "$LIST"
