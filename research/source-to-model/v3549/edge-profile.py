#!/usr/bin/env python3
"""v3.54.9 — does a read head lie on an edge of the picture? The mean vertical luminance step across a raked head line,
shifted −20…+12 px, in the ORIGINAL raster (no resize): a read on an edge peaks at 0; the row a structural height would
give is shown beside it.

    /usr/bin/python3 -I research/source-to-model/v3549/edge-profile.py <picture> <x0> <x1> <yLeft> <yRight> [<yLeftRef> <yRightRef>]
"""
import sys

from PIL import Image

pic, x0, x1, yl, yr = sys.argv[1], *map(float, sys.argv[2:6])
ref = list(map(float, sys.argv[6:8])) if len(sys.argv) >= 8 else None
im = Image.open(pic).convert('L')
W, H = im.size
px = im.load()
out = []
for dy in range(-20, 13):
    tot, n = 0, 0
    for i in range(10, 91, 4):
        t = i / 100
        x, y = x0 + (x1 - x0) * t, yl + (yr - yl) * t + dy
        xi, yi = int(round(x)), int(round(y))
        if 2 <= yi < H - 3 and 0 <= xi < W:
            tot += abs(px[xi, yi - 2] - px[xi, yi + 2])
            n += 1
    out.append((dy, tot / max(n, 1)))
peak = max(out, key=lambda q: q[1])
print(' '.join(f'{d}:{v:.1f}' for d, v in out))
print(f'peak at {peak[0]:+d} px ({peak[1]:.1f}); at the read line {dict(out)[0]:.1f}' + (f'; the reference rows lie {ref[0] - yl:+.1f} / {ref[1] - yr:+.1f} px off' if ref else ''))
