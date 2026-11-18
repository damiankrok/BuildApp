#!/bin/bash
# v3.54.12 — experiment B / B1 / B2 (SKETCH_PROTOCOL.md) in one command, once the OWNER's sketches are on disk.
#   research/source-to-model/v35412/run-sketch.sh <front sketch> <rear sketch> <out dir>
# A is the pinned v3.54.11 run (/home/user/rd/v35411/local/marcowki-ge-A). 0 USD: no request is sent.
set -euo pipefail
FRONT="$1"; REAR="$2"; OUT="$3"
for f in "$FRONT" "$REAR"; do [ -f "$f" ] || { echo "MISSING INPUT: $f"; exit 2; }; done
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
R=research/source-to-model
PKG=$R/v3546/sources/marcowki-ge.source-package.json
CACHE=/home/user/rd/v3546/marcowki/cache
A=/home/user/rd/v35411/local/marcowki-ge-A
FA=asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-fron-ee81d52db6
RA=asset-gotowy-projekt-dom-w-marcowkach-ge-elewacja-ogro-77ee09534e
mkdir -p "$OUT"
grep -q 0476d3531b1cf90aab15c0859136780398666313150cb966eb55ccff5759fb7c "$A.log" || { echo "A is not the pinned run"; exit 3; }
pk() { npx vite-node $R/v35412/sketch-package.ts -- --package $PKG --cache $CACHE --run-label "$1" --out "$OUT/pkg-$1" "${@:2}"; }
pk B --replace "$FA=$FRONT" --replace "$RA=$REAR"
pk B1 --replace "$FA=$FRONT"
pk B2 --replace "$RA=$REAR"
for v in B B1 B2; do
  TIMEFORMAT="%R s"
  { time timeout 1500 npx vite-node packages/analysis-service/scripts/second-house.ts -- --package "$OUT/pkg-$v/package.json" --cache "$OUT/pkg-$v/cache" --recogniser --out "$OUT/run-$v" > "$OUT/run-$v.log" 2>&1 ; } 2> "$OUT/run-$v.time" || echo "$v: run failed (see run-$v.log)"
  [ -f "$OUT/run-$v/model.json" ] && npx vite-node $R/v35411/model-scene.ts -- "$OUT/run-$v/model.json" "$OUT/run-$v/scene.json"
done
[ -f "$A/scene.json" ] || npx vite-node $R/v35411/model-scene.ts -- "$A/model.json" "$A/scene.json"
SPECS=("A=$A/model.json"); MODELS=(--model "A=$A/model.json"); SCENES=("A=$A/scene.json")
for v in B B1 B2; do [ -f "$OUT/run-$v/model.json" ] && { SPECS+=("$v=$OUT/run-$v/model.json"); MODELS+=(--model "$v=$OUT/run-$v/model.json"); SCENES+=("$v=$OUT/run-$v/scene.json"); }; done
T=research/marcowki-v2/marcowki-source-truth-v2.json
npx vite-node $R/v35411/measure-features.ts -- "$OUT/feat.json" "${SPECS[@]}"
/usr/bin/python3 -I $R/v35411/zone-refs.py $R/v35411/zone-refs-marcowki.json "$OUT/zones.json" "${SCENES[@]}" > "$OUT/zones.txt"
echo "== VISUAL_MINIATURE"; /usr/bin/python3 -I $R/v35412/visual-miniature.py $R/v35412/identity-marcowki.json "$OUT/feat.json" "$OUT/zones.json" "$OUT/miniature.json" "${MODELS[@]}" | tee "$OUT/miniature.txt"
echo "== METRIC_EVIDENCE (diagnostic)"
/usr/bin/python3 -I $R/v3547/marcowki-features.py "$OUT/feat.json" $T "$OUT/features16.json" 2>&1 | grep -E "^[A-Za-z]|NO" | tee "$OUT/features16.txt"
/usr/bin/python3 -I $R/v35411/features-v1_1.py "$OUT/feat.json" $T "$OUT/features-v1_1.json" | tee "$OUT/features-v1_1.txt"
/usr/bin/python3 -I $R/v3548/marcowki-detail.py "$OUT/feat.json" $T "$OUT/detail.json" 2>&1 | grep -E "^[A-Za-z]|NO " | tee "$OUT/detail.txt"
grep -E "^[A-Za-z]|NO" "$OUT/zones.txt"
for v in B B1 B2; do echo "$v $(grep -E 'modelHash|completed' "$OUT/run-$v.log" | tr '\n' ' ') $(tail -1 "$OUT/run-$v.time")"; done
