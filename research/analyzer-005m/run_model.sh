#!/usr/bin/env bash
# run_model.sh - one model through bench.py behind its own llama-server (RESEARCH ONLY, BUILDPLAN-ANALYZER-005M).
#
#   research/analyzer-005m/run_model.sh <label> <model.gguf> <mmproj.gguf> <phase 1|2> <out.jsonl> [extra llama-server args...]
#
# Weights are read from outside the repository (/dev/shm/models or $W/gguf). The server is started and stopped by PID;
# its log goes next to the run file. CPU only: 4 threads, 8k context, one slot, greedy.
set -euo pipefail
LABEL=$1; MODEL=$2; MMPROJ=$3; PHASE=$4; OUT=$5; shift 5
W=${W:-/home/user/work005m}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
PORT=${PORT:-8090}
"$W/llama.cpp/build/bin/llama-server" -m "$MODEL" --mmproj "$MMPROJ" -t 4 -tb 4 -c 8192 -np 1 --port "$PORT" --host 127.0.0.1 \
  --no-webui --temp 0 --seed 0 "$@" > "${OUT%.jsonl}.server.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 300); do
  if curl -s "127.0.0.1:$PORT/health" | grep -q '"ok"'; then break; fi
  sleep 1
done
"$W/venv/bin/python" -I -B "$REPO/research/analyzer-005m/bench.py" --items "$W/items/items.jsonl" --img "$W/items/img" \
  --out "$OUT" --model "$LABEL" --server "http://127.0.0.1:$PORT" --phase "$PHASE" --pid "$PID" ${LIMIT:+--limit $LIMIT}
