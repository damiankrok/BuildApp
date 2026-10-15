#!/bin/sh
# fg-run.sh — addendum B diagnostic: feature-graph content for R0 (base tree, sealed run outputs) and N1v (variant).
#   sh research/analyzer-005r-router-n1/fg-run.sh <work dir> <rows,comma,separated>
cd "$(dirname "$0")/../.." || exit 1
W=$1; ROWS=$2
mkdir -p "$W/fg"
for c in $(echo "$ROWS" | tr ',' ' '); do
  pkg=$(python3 -c "import json;print([x['package'] for x in json.load(open('research/analyzer-005q-chain/cases.json'))['cases'] if x['case']=='$c'][0])")
  cache=$(python3 -c "import json;print([x['cache'] for x in json.load(open('research/analyzer-005q-chain/cases.json'))['cases'] if x['case']=='$c'][0])")
  r0="$W/runs-prior/R0fix/$c"; [ -f "$r0/metric-evidence.json.gz" ] || r0="$W/runs-prior/R0/$c"
  npx vite-node research/analyzer-005r-router-n1/feature-graph.ts -- --package "$pkg" --cache "$cache" --run "$r0" --out "$W/fg/R0-$c.json.gz" 2>&1 | tail -1 | sed "s/^/$c R0 /"
  npx vite-node --config "$W/variant-N1v/vite.config.mjs" research/analyzer-005r-router-n1/feature-graph.ts -- --package "$pkg" --cache "$cache" --run "$W/runs/N1v/$c" --out "$W/fg/N1v-$c.json.gz" 2>&1 | tail -1 | sed "s/^/$c N1v /"
done
echo FG-DONE
