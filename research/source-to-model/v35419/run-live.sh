#!/usr/bin/env bash
# v3.54.19 (from v3.54.18) — one house, live, in the host's transport configuration (metric read and outline: Opus 5.5; sketches and review:
# Sonnet 5.5; strict tools with fallback; 5-minute prompt cache), through the runner of the tree given (so the frozen
# baseline tree and the working tree run the same command). Books into the ONE continuing ledger (R3's file).
#   run-live.sh <tree> <house> <url> <out dir> <byte cache dir> [extra runner flags]
# The key is read from the host's secret file into the process environment only; it is never an argument or a log line.
set -euo pipefail
TREE=$1; HOUSE=$2; URL=$3; OUT=$4; CACHE=$5; shift 5
LEDGER=/home/user/BuildApp/research/ai-assist/spend-ledger-v35417r3.json
cd "$TREE"
RUNNER=research/source-to-model/v35419/run.ts; [ -f "$RUNNER" ] || RUNNER=research/source-to-model/v35418/run.ts
BUILDPLAN_ANTHROPIC_API_KEY="$(cat /root/.config/buildplan/campaign-key)" npx vite-node "$RUNNER" -- \
  --url "$URL" --cache "$CACHE" --out "$OUT" --house "$HOUSE" \
  --live --sketch-live --check-live --check-model claude-sonnet-5-5 --outline-live --strict --prompt-cache 5m --geometry-rounds 2 \
  --ledger "$LEDGER" --opening 28.542857 --ceiling 68.542857 "$@"
