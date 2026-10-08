#!/usr/bin/env bash
# history_gate.sh - BUILDPLAN-ANALYZER-005M repository-size gate over Git HISTORY (brief section 20).
#
#   research/analyzer-005m/history_gate.sh [<base-commit>]     (default base: the 005L close, 47811e0)
#
# The architecture test sees only the current tree; this walks every commit in <base>..HEAD and fails if any of them
# ever added a model weight / checkpoint / adapter / hub tokenizer bundle by name or extension, a blob whose first bytes
# are a weight format whatever its name (GGUF, safetensors header, NumPy, HDF5, TFLite, pickle, a zip with a PyTorch
# payload), a blob whose first bytes are a picture (PNG, JPEG, GIF, WebP, TIFF) anywhere outside the
# publisher bytes committed before 005J (post-review F2-7), a NUL byte in a stage file, any blob over 2 MiB under the stage's paths, any blob over 5 MiB anywhere, or
# an LFS pointer. The extension list matches tests/architecture/research-isolation.test.ts. Exit 0 = clean.
set -euo pipefail
BASE=${1:-47811e0953834af3ade62d314b35fc00f94ea4c9}
cd "$(dirname "$0")/../.."
WEIGHT='\.(safetensors|bin|pt|pth|ptl|ckpt|gguf|ggml|onnx|ort|tflite|litertlm|task|mlmodel|mlpackage|npz|npy|pkl|pickle|h5|pb|mf|mf\.gz|tar|zst|7z|msgpack|pte|dlc|tiktoken|model|mnn|engine)$'
MAGIC_PY='import sys
b = sys.stdin.buffer.read(4096)
w = (b[:4] == b"GGUF" or (len(b) > 10 and b[8:10] == b"{\"" and int.from_bytes(b[:8], "little") < 10**8)
     or b[:6] == b"\x93NUMPY" or b[:8] == b"\x89HDF\r\n\x1a\n" or b[4:8] == b"TFL3" or (b[:1] == b"\x80" and b[1:2] in (b"\x02", b"\x03", b"\x04", b"\x05"))
     or (b[:4] == b"PK\x03\x04" and any(x in b for x in (b"data.pkl", b".safetensors", b".gguf"))))
pic = (b[:8] == b"\x89PNG\r\n\x1a\n" or b[:3] == b"\xff\xd8\xff" or b[:4] in (b"GIF8", b"II*\x00", b"MM\x00*")
       or (b[:4] == b"RIFF" and b[8:12] == b"WEBP"))
print("WEIGHT" if w else ("PICTURE" if pic else ("NUL" if b"\x00" in b else "OK")))'
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
    if echo "$path" | grep -qiE "$WEIGHT" && ! echo "$path" | grep -qE '^\.cache/source-bytes/[^/]*\.bin$'; then echo "WEIGHT-LIKE FILE $c $path"; fail=1; fi
    kind=$( (git cat-file -p "$blob" || true) | head -c 4096 | python3 -I -c "$MAGIC_PY")
    [ "$kind" = "WEIGHT" ] && { echo "WEIGHT MAGIC BYTES $c $path"; fail=1; }
    if [ "$kind" = "PICTURE" ] && ! echo "$path" | grep -qE '^\.cache/source-bytes/[^/]*\.bin$'; then echo "PICTURE $c $path"; fail=1; fi
    if echo "$path" | grep -qiE "$BUNDLE"; then echo "HUB BUNDLE FILE $c $path"; fail=1; fi
    case "$path" in
      research/analyzer-005m/*|stage-reports/artifacts/analyzer-005m-vr2/*)
        [ "$size" -gt 2097152 ] && { echo "OVER 2 MiB $c $path $size"; fail=1; }
        [ "$kind" = "NUL" ] && { echo "BINARY (NUL) IN STAGE PATH $c $path"; fail=1; } ;;
    esac
    [ "$size" -gt 5242880 ] && { echo "OVER 5 MiB $c $path $size"; fail=1; }
    if [ "$size" -lt 1024 ] && git cat-file -p "$blob" | head -c 40 | grep -q 'git-lfs'; then echo "LFS POINTER $c $path"; fail=1; fi
  done < <(git diff-tree --no-commit-id -r --root "$c" | sed 's/^://' | awk -F'\t' '{print $1"\t"$2}')
done
echo "commits checked: $n (range ${BASE:0:7}..HEAD)"
[ "$fail" -eq 0 ] && echo "HISTORY_GATE: PASS" || { echo "HISTORY_GATE: FAIL"; exit 1; }
