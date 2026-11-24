#!/usr/bin/env bash
# v3.54.19 (from v3.54.18) — a recorded live run replayed at 0 USD on the tree given: the same answers, the code under test.
#   replay.sh <tree> <house> <url> <recorded live dir> <out dir> <byte cache dir> [extra flags]
set -euo pipefail
TREE=$1; HOUSE=$2; URL=$3; L=$4; OUT=$5; CACHE=$6; shift 6
cd "$TREE"
# a replay may still need ONE live read the recording does not hold (e.g. --outline-live for the body arbitration):
# the key then comes from the host's secret file, and the request is booked in the one continuing ledger
LIVE=()
case " $* " in *-live*) export BUILDPLAN_ANTHROPIC_API_KEY="$(cat /root/.config/buildplan/campaign-key)"; LIVE=(--ledger /home/user/BuildApp/research/ai-assist/spend-ledger-v35417r3.json --opening 28.542857 --ceiling 68.542857 --strict --prompt-cache 5m);; esac
RUNNER=research/source-to-model/v35419/run.ts; [ -f "$RUNNER" ] || RUNNER=research/source-to-model/v35418/run.ts
npx vite-node "$RUNNER" -- --url "$URL" --cache "$CACHE" --out "$OUT" --house "$HOUSE" \
  --replay "$L/turns.json" --sketch-replay "$L/sketch-turns.json" $( [ -f "$L/sketches.json" ] && echo --sketch-map "$L/sketches.json" ) \
  $( [ -f "$L/check-turns.json" ] && echo --check-replay "$L/check-turns.json" ) $( [ -f "$L/outline-turns.json" ] && echo --outline-replay "$L/outline-turns.json" ) "${LIVE[@]}" "$@"
