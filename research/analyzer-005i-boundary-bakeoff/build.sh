#!/bin/bash
# build.sh — the research environment, CPU only, outside the repository (after fetch.sh).
#
# RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Mirrors exactly what was run for the bake-off.
#   * system packages (apt, research box only — NOT a statement about Android/production):
#       libopencv-dev libceres-dev libeigen3-dev (pulls libgoogle-glog-dev, libgflags-dev)
#   * a venv with CPU-only PyTorch; pip caches disabled (disk is tight)
#   * ELSED: the upstream library built unchanged; its pybind11 2.8.1 binding does not compile against CPython 3.11
#     (PyFrameObject is opaque), so providers/elsed_cli.cpp — which mirrors upstream PYAPI.cpp — drives the library
#   * pytlsd (DeepLSD's LSD on predicted fields): pinned sources, binding glue swapped to pybind11 v2.13.6
#   * DeepLSD line refinement: GC-RANSAC + Progressive-X libraries built in-tree, then the line_refinement module
set -euo pipefail
WORK=${WORK:-/home/user/work005i}
H=$(cd "$(dirname "$0")" && pwd)
U=$WORK/upstream
export PIP_NO_CACHE_DIR=1
[ -n "${SKIP_APT:-}" ] || { sudo -n true 2>/dev/null && S=sudo || S=; DEBIAN_FRONTEND=noninteractive $S apt-get install -y --no-install-recommends libopencv-dev libceres-dev libeigen3-dev; $S apt-get clean; }
python3 -m venv "$WORK/venv"
P=$WORK/venv/bin/pip
$P install -q --upgrade pip setuptools wheel
$P install -q torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
$P install -q numpy==1.26.4 opencv-python-headless==4.10.0.84 omegaconf==2.3.1 scikit-image==0.26.0 shapely==2.1.2 kornia==0.8.3 scipy==1.17.1 pyyaml tqdm psutil==7.2.2 scikit-build cmake pybind11==3.1.0 timm==0.9.16 matplotlib

# ELSED (library unchanged) + the research CLI
mkdir -p "$WORK/build/elsed"
( cd "$WORK/build/elsed" && cmake "$U/ELSED" -DCMAKE_BUILD_TYPE=Release -DPYTHON_EXECUTABLE="$WORK/venv/bin/python" >/dev/null && make -j4 elsed elsed_main >/dev/null )
g++ -O2 -std=c++14 -I"$U/ELSED/src" $(pkg-config --cflags opencv4) "$H/providers/elsed_cli.cpp" "$WORK/build/elsed/libelsed.a" $(pkg-config --libs opencv4) -o "$WORK/build/elsed/elsed_cli"

# pytlsd with the newer binding glue
rm -rf "$WORK/build/pytlsd-src"; cp -r "$U/DeepLSD/third_party/pytlsd" "$WORK/build/pytlsd-src"
rm -rf "$WORK/build/pytlsd-src/pybind11" "$WORK/build/pytlsd-src/.git"; ln -s "$U/pybind11-v2.13.6" "$WORK/build/pytlsd-src/pybind11"
$P install -q --no-build-isolation "$WORK/build/pytlsd-src"

# DeepLSD refinement: GC-RANSAC and Progressive-X libraries, then line_refinement
mkdir -p "$U/DeepLSD/third_party/progressive-x/build"
( cd "$U/DeepLSD/third_party/progressive-x/build" && cmake .. -DCMAKE_BUILD_TYPE=Release -DPYTHON_EXECUTABLE="$WORK/venv/bin/python" >/dev/null && make -j4 GraphCutRANSAC ProgressiveX >/dev/null )
$P install -q --no-build-isolation "$U/DeepLSD/line_refinement"
echo "BUILD-OK (export LD_LIBRARY_PATH=$U/DeepLSD/third_party/progressive-x/build before running DeepLSD refinement)"
