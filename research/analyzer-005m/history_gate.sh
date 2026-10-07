#!/usr/bin/env bash
# history_gate.sh - BUILDPLAN-ANALYZER-005M repository-size gate over Git HISTORY (brief section 20).
#
#   research/analyzer-005m/history_gate.sh [<base-commit>]     (default base: the 005L close, 47811e0)
#
# The architecture test sees only the current tree; this walks every commit in <base>..HEAD and fails if any of them
# ever added a model weight / checkpoint / adapter / hub tokenizer bundle by name or extension, any blob over 2 MiB
# under the stage's paths, any blob over 5 MiB anywhere, or an LFS pointer. Exit 0 = clean.
set -euo pipefail
BASE=${1:-47811e0953834af3ade62d314b35fc00f94ea4c9}
cd "$(dirname "$0")/../.."
WEIGHT='\.(safetensors|bin|pt|pth|ckpt|gguf|ggml|onnx|ort|tflite|litertlm|task|mlmodel|npz|npy|pkl|pickle|h5|pb|mf|tar|zst)$'
BUNDLE='(^|/)(tokenizer\.json|tokenizer\.model|tokenizer_config\.json|special_tokens_map\.json|added_tokens\.json|vocab\.json|merges\.txt|preprocessor_config\.json|processor_config\.json|generation_config\.json|adapter_config\.json|adapter_model\.[a-z]+)$'
fail=0
commits=$(git rev-list "$BASE"..HEAD)
n=0
for c in $commits; do
  n=$((n + 1))
  while IFS=$'\t' read -r meta path; do
    [ -z "${path:-}" ] && continue
    blob=$(echo "$meta" | awk '{print $4}')
    status=$(echo "$meta" | awk '{print $5}')
    [ "$status" = "D" ] && continue
    size=$(git cat-file -s "$blob")
    if echo "$path" | grep -qiE "$WEIGHT" && ! echo "$path" | grep -q '^\.cache/source-bytes/'; then echo "WEIGHT-LIKE FILE $c $path"; fail=1; fi
    if echo "$path" | grep -qiE "$BUNDLE"; then echo "HUB BUNDLE FILE $c $path"; fail=1; fi
    case "$path" in
      research/analyzer-005m/*|stage-reports/artifacts/analyzer-005m-vr2/*) [ "$size" -gt 2097152 ] && { echo "OVER 2 MiB $c $path $size"; fail=1; } ;;
    esac
    [ "$size" -gt 5242880 ] && { echo "OVER 5 MiB $c $path $size"; fail=1; }
    if [ "$size" -lt 1024 ] && git cat-file -p "$blob" | head -c 40 | grep -q 'git-lfs'; then echo "LFS POINTER $c $path"; fail=1; fi
  done < <(git diff-tree --no-commit-id -r --root "$c" | sed 's/^://' | awk -F'\t' '{print $1"\t"$2}')
done
echo "commits checked: $n (range ${BASE:0:7}..HEAD)"
[ "$fail" -eq 0 ] && echo "HISTORY_GATE: PASS" || { echo "HISTORY_GATE: FAIL"; exit 1; }
