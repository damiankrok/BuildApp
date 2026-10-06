#!/bin/bash
# run-providers.sh <set> — every external provider configuration on every frame of a set (real | synthetic).
#
# RESEARCH ONLY. Reads $WORK/frames/<set>/<id>.{gray,rgb}.png + <id>.meta.json (written by extract-real.ts /
# synthetic.ts from the production decoder's pixels), writes $WORK/obs/<provider>/<set>/<id>[.<config>].json and
# MobileSAM masks under $WORK/out/msam/<set>/<id>/. One process per frame and configuration, sequentially, so peak RSS
# is per frame; THREADS (default 2) bounds the torch threads (the box is shared). Nothing is written to the repository.
set -uo pipefail
SET=$1
WORK=${WORK:-/home/user/work005i}
THREADS=${THREADS:-2}
ONLY=${ONLY:-ELSED,DEEPLSD-MD,DEEPLSD-WF,DEEPLSD-MD-REFINE-SCV,MSAM}
H=$(cd "$(dirname "$0")" && pwd)/providers
PY="$WORK/venv/bin/python -I -B"
export LD_LIBRARY_PATH=$WORK/upstream/DeepLSD/third_party/progressive-x/build
has() { [[ ",$ONLY," == *",$1,"* ]]; }
for meta in "$WORK"/frames/"$SET"/*.meta.json; do
  id=$(basename "$meta" .meta.json)
  [ -n "${IDS:-}" ] && [[ ",$IDS," != *",$id,"* ]] && continue
  fid=$($PY -c "import json,sys;print(json.load(open(sys.argv[1]))['frameId'])" "$meta")
  g="$WORK/frames/$SET/$id.gray.png"; c="$WORK/frames/$SET/$id.rgb.png"
  has ELSED && $PY "$H/elsed_run.py" --cli "$WORK/build/elsed/elsed_cli" --frame-id "$fid" --gray "$g" --out "$WORK/obs/elsed/$SET/$id.json"
  has DEEPLSD-MD && $PY "$H/deeplsd_run.py" --repo "$WORK/upstream/DeepLSD" --ckpt "$WORK/ckpt/deeplsd_md.tar" --config DEEPLSD-MD --frame-id "$fid" --gray "$g" --threads "$THREADS" --out "$WORK/obs/deeplsd/$SET/$id.md.json" 2>/dev/null
  has DEEPLSD-WF && $PY "$H/deeplsd_run.py" --repo "$WORK/upstream/DeepLSD" --ckpt "$WORK/ckpt/deeplsd_wireframe.tar" --config DEEPLSD-WF --frame-id "$fid" --gray "$g" --threads "$THREADS" --out "$WORK/obs/deeplsd/$SET/$id.wf.json" 2>/dev/null
  has DEEPLSD-MD-REFINE-SCV && $PY "$H/deeplsd_run.py" --repo "$WORK/upstream/DeepLSD" --ckpt "$WORK/ckpt/deeplsd_md.tar" --config DEEPLSD-MD-REFINE-SCV --frame-id "$fid" --gray "$g" --threads "$THREADS" --refine "$WORK/obs/source-cv/$SET/$id.json" --out "$WORK/obs/deeplsd/$SET/$id.md-refine-scv.json" 2>/dev/null
  has MSAM && $PY "$H/msam_run.py" --repo "$WORK/upstream/MobileSAM" --ckpt "$WORK/ckpt/mobile_sam.pt" --frame-id "$fid" --rgb "$c" --meta "$meta" --threads "$THREADS" --masks-dir "$WORK/out/msam/$SET/$id" --out "$WORK/obs/mobilesam/$SET/$id.json" ${MSAM_AUTO:---auto} 2>/dev/null
  echo "$(date +%T) $SET/$id done"
done
echo "PROVIDERS-DONE $SET"
