#!/bin/sh
# c_run.sh — 005R addendum C driver (POST-HOC, RESEARCH ONLY). For each truth variant from c_truth_variants.py:
# refit V1 and V0b on DEV under that truth, rebuild N1, and score V0a/V0b/V1/V2/N1 on it. V2 keeps its preregistered τ
# (its DEV curve is flat — every resolved DEV group is INTERIOR_RENDER up to τ=0.85 — so a refit would not move it).
#   sh c_run.sh <run-dir> <variants-dir>
set -eu
S=$(cd "$(dirname "$0")/.." && pwd)
R=$1; V=$2
for name in C1x C1r C2 C12; do
  T=$V/truth-$name.json; O=$V/$name; mkdir -p "$O"
  node "$S/v1/run.mjs" fit-v1 "$R/v1-feat-n22-r1.jsonl" "$T" "$O/v1-model.json" >/dev/null
  node "$S/v1/run.mjs" fit-v0b "$R/v1-feat-n22-r1.jsonl" "$T" "$R/V0a.json" "$O/v0b-model.json" >/dev/null
  node "$S/v1/run.mjs" predict "$R/v1-feat-n22-r1.jsonl" "$O/v1-model.json" "$O/v1-pred.jsonl" >/dev/null
  node "$S/v1/run.mjs" predict "$R/v1-feat-n22-r1.jsonl" "$O/v0b-model.json" "$O/v0b-pred.jsonl" >/dev/null
  python3 -I "$S/contenders.py" v1 "$O/v1-pred.jsonl" "$O/V1.json" >/dev/null
  python3 -I "$S/contenders.py" v0b "$R/V0a.json" "$O/v0b-pred.jsonl" "$O/V0b.json" >/dev/null
  python3 -I "$S/contenders.py" n1 "$R/V0a.json" "$O/V1.json" "$O/N1.json" >/dev/null
  echo "== $name"
  python3 -I "$S/score_roles.py" "$T" "$O/role-scores.json" "$R/V0a.json" "$O/V0b.json" "$O/V1.json" "$R/V2.json" "$O/N1.json"
done
