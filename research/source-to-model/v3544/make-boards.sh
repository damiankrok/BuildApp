#!/bin/bash
# v3.54.4 boards for a list: make-boards.sh <list> <H root> <LOCAL root> <private out dir> <title prefix>
# PRZED = LOCAL (A1) or "no model"; PO = the model that stood (the described house, or LOCAL kept). Private outputs.
set -u
LIST=$1; H=$2; L=$3; OUT=$4; PREFIX=$5
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT/tmp"
while read slug pkg cache; do
  [ -z "$slug" ] && continue
  acc=$(/usr/bin/python3 -I -c "import json,sys; print(json.load(open(sys.argv[1])).get('accepted') or 'NONE')" "$H/$slug/summary.json" 2>/dev/null || echo NONE)
  before="-"; after="-"
  if [ -f "$L/$slug/model.json" ]; then npx vite-node "$HERE/views.ts" -- --model "$L/$slug/model.json" --out "$OUT/tmp/$slug-local" >/dev/null 2>&1 && before="$OUT/tmp/$slug-local"; fi
  if [ "$acc" = "DESCRIBED" ] && [ -f "$H/$slug/model.json" ]; then npx vite-node "$HERE/views.ts" -- --model "$H/$slug/model.json" --out "$OUT/tmp/$slug-h" >/dev/null 2>&1 && after="$OUT/tmp/$slug-h"; else after="$before"; fi
  ref=$(/usr/bin/python3 -I -c "
import json,sys
try:
    g=json.load(open(sys.argv[1]))['geometry']
    b=[x for x in g['bodies'] if x['role']=='MAIN'] or g['bodies']
    r=b[0]['roof']['ridgeY']
    print(r['value'] if r['basis']=='PRINTED' else '')
except Exception: print('')" "$H/$slug/house.json")
  srcs=""; for f in $(ls "$OUT/src/$slug"/*.jpg 2>/dev/null | head -5); do srcs="$srcs --src $f"; done
  why=$(/usr/bin/python3 -I -c "import json,sys; print((json.load(open(sys.argv[1])).get('why') or '')[:150])" "$H/$slug/summary.json" 2>/dev/null)
  nb="LOCAL (A1, solver 2.45.0)"; [ "$before" = "-" ] && nb="LOCAL (A1): brak modelu"
  na="model przyjety: $acc"
  /usr/bin/python3 -I "$HERE/board.py" --title "$PREFIX $slug" --out "$OUT/$slug.png" $srcs --before "$before" --after "$after" --note-before "$nb" --note-after "$na — $why" ${ref:+--ref-height $ref --ref-label "kalenica wg przekroju +$ref"}
done < "$LIST"
