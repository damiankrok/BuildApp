#!/bin/bash
# fetch.sh — clone the three upstream repositories at their pinned commits (with the submodules inference needs),
# download the checkpoints and verify every SHA-256 against manifest.json. Refuses a mismatch.
#
# RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Everything lands in $WORK (default /home/user/work005i), never in
# the repository. Downloaded trees are untrusted: nothing here executes them; build.sh builds them explicitly.
set -euo pipefail
WORK=${WORK:-/home/user/work005i}
M=$(cd "$(dirname "$0")" && pwd)/manifest.json
mkdir -p "$WORK/upstream" "$WORK/ckpt"
py() { python3 -I -c "$1" "$M"; }

# repositories at pinned commits
py 'import json,sys; [print(r["dir"], r["url"], r["commit"]) for r in json.load(open(sys.argv[1]))["repositories"]]' |
while read -r dir url commit; do
  d="$WORK/upstream/$dir"
  if [ ! -d "$d/.git" ]; then mkdir -p "$d"; git -C "$d" init -q; git -C "$d" remote add origin "$url"; fi
  git -C "$d" fetch -q --depth 1 origin "$commit"
  git -C "$d" checkout -q FETCH_HEAD
  got=$(git -C "$d" rev-parse HEAD)
  [ "$got" = "$commit" ] || { echo "REFUSED: $dir is at $got, pinned $commit" >&2; exit 2; }
  echo "ok   $dir @ $commit"
done
# the submodules inference and refinement need (not the evaluation-only ones)
git -C "$WORK/upstream/DeepLSD" submodule update --init --depth 1 third_party/pytlsd third_party/progressive-x line_refinement/pybind11
git -C "$WORK/upstream/DeepLSD/third_party/progressive-x" submodule update --init --depth 1
git -C "$WORK/upstream/DeepLSD/third_party/pytlsd" submodule update --init --depth 1 pybind11
git -C "$WORK/upstream/ELSED" submodule update --init --depth 1 pybind11
py 'import json,sys
for r in json.load(open(sys.argv[1]))["repositories"]:
    for p,c in r["submodules"].items(): print(r["dir"], p, c)' |
while read -r dir path commit; do
  got=$(git -C "$WORK/upstream/$dir/$path" rev-parse HEAD)
  [ "$got" = "$commit" ] || { echo "REFUSED: $dir/$path is at $got, pinned $commit" >&2; exit 2; }
done
echo "ok   submodules"

# checkpoints, verified
py 'import json,sys; [print(c["file"], c["url"], c["sha256"], c["bytes"]) for c in json.load(open(sys.argv[1]))["checkpoints"]]' |
while read -r file url sha bytes; do
  f="$WORK/ckpt/$file"
  if [ ! -f "$f" ] || [ "$(sha256sum "$f" | cut -d' ' -f1)" != "$sha" ]; then
    curl -sS -L --fail -o "$f.part" "$url"
    mv "$f.part" "$f"
  fi
  got=$(sha256sum "$f" | cut -d' ' -f1)
  size=$(stat -c %s "$f")
  if [ "$got" != "$sha" ] || [ "$size" != "$bytes" ]; then
    rm -f "$f"; echo "REFUSED: $file sha256 $got ($size bytes), pinned $sha ($bytes bytes)" >&2; exit 3
  fi
  echo "ok   $file $sha"
done
echo FETCH-OK
