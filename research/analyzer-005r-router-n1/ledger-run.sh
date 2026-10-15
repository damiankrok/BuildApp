#!/bin/sh
# ledger-run.sh — N1-ADOPT P8: ledger.ts on the N1v run of every camera row (RESEARCH ONLY; outputs outside Git).
#   sh research/analyzer-005r-router-n1/ledger-run.sh <work dir> <label> <rows,comma,separated>
# Baseline dumps are the sealed 005R-ROUTER R0/R0fix dumps in <work>/ledger-prior (preregistration §0).
cd "$(dirname "$0")/../.." || exit 1
W=$1; L=$2; ROWS=$3
mkdir -p "$W/ledger-$L"
for c in $(echo "$ROWS" | tr ',' ' '); do
  pkg=$(python3 -c "import json;print([x['package'] for x in json.load(open('research/analyzer-005q-chain/cases.json'))['cases'] if x['case']=='$c'][0])")
  cache=$(python3 -c "import json;print([x['cache'] for x in json.load(open('research/analyzer-005q-chain/cases.json'))['cases'] if x['case']=='$c'][0])")
  [ -f "$W/runs/$L/$c/metric-evidence.json.gz" ] || { echo "$c $L no-metrics"; continue; }
  npx vite-node --config "$W/variant-N1v/vite.config.mjs" research/analyzer-005r-router-n1/ledger.ts -- --package "$pkg" --cache "$cache" --run "$W/runs/$L/$c" --out "$W/ledger-$L/$L-$c.json.gz" 2>&1 | tail -1 | sed "s/^/$c $L /"
done
echo LEDGER-DONE
