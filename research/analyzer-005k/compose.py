#!/usr/bin/env python3
"""compose.py - BUILDPLAN-ANALYZER-005K: the pictures a reviewer labels (RESEARCH ONLY; pixels never enter the repo).

    python3 -I research/analyzer-005k/compose.py --manifest <gap-set-manifest.json> --runs <gapset/runs> \
        --cache <gapset/cache> --out <gapset/label>

For each gap of the sealed manifest: the frame's bytes from the offline byte cache (checked against the package's
byte hash), the crop the record names (at least 1.5 m of context on every side), and one picture:

    [ the crop as the source draws it ] [ the same crop, two red brackets outside the wall band, a 1 m bar ]

The brackets run parallel to the wall line one wall and three pixels beyond its axis on both sides, with short end
ticks pointing away from the wall: they mark where the gap begins and ends and cover nothing inside the wall band (the
005J B6 lesson: an overlay must not hide the evidence). File names are neutral (q###.png); the key is a separate file
a reviewer never sees. Pictures and key stay outside the repository.
"""
import argparse
import hashlib
import json
import os
from io import BytesIO

from PIL import Image, ImageDraw

PANEL = 480
RED = (220, 20, 20)


def cache_bytes(cache, url):
    base = os.path.join(cache, hashlib.sha256(url.encode('utf-8')).hexdigest()[:32])
    with open(base + '.bin', 'rb') as f:
        return f.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--runs', required=True)
    ap.add_argument('--cache', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    manifest = json.load(open(a.manifest))
    os.makedirs(os.path.join(a.out, 'img'), exist_ok=True)
    frames = {}
    key = {}
    for g in manifest['gaps']:
        fk = (g['project'], g['variantByteHash'])
        if fk not in frames:
            pkg = json.load(open(os.path.join(a.runs, g['project'], 'source-package.json')))
            variant = next(v for asset in pkg['assets'] for v in asset['variants'] if v['byteHash'] == g['variantByteHash'])
            data = cache_bytes(a.cache, variant['url'])
            assert hashlib.sha256(data).hexdigest() == g['variantByteHash'], 'cached bytes are not the sealed frame'
            frames[fk] = Image.open(BytesIO(data)).convert('RGB')
        im = frames[fk]
        c = g['crop']
        crop = im.crop((c['x0'], c['y0'], c['x1'] + 1, c['y1'] + 1))
        w, h = crop.size
        s = max(1.0, min(6.0, PANEL / max(w, h)))
        raw = crop.resize((round(w * s), round(h * s)), Image.BICUBIC)
        marked = raw.copy()
        d = ImageDraw.Draw(marked)
        off = g['wallPx'] + 3
        lw = max(2, round(s))
        tick = g['wallPx'] * 0.8
        def P(along, across):
            # frame pixels -> picture pixels; X lines run along y, Y lines along x
            x, y = (across, along) if g['axis'] == 'X' else (along, across)
            return ((x - c['x0'] + 0.5) * s, (y - c['y0'] + 0.5) * s)
        for side in (-1, 1):
            o = g['axisPx'] + side * off
            d.line([P(g['fromPx'], o), P(g['toPx'], o)], fill=RED, width=lw)
            for end in (g['fromPx'], g['toPx']):
                d.line([P(end, o), P(end, o + side * tick)], fill=RED, width=lw)
        # a 1 m bar along the bottom-left corner, in the line's direction
        mpp = g['mppAlong']
        bar = (1.0 / mpp) * s
        y0 = marked.size[1] - 8
        d.line([(8, y0), (8 + bar, y0)], fill=RED, width=lw)
        d.line([(8, y0 - 4), (8, y0 + 3)], fill=RED, width=lw)
        d.line([(8 + bar, y0 - 4), (8 + bar, y0 + 3)], fill=RED, width=lw)
        sheet = Image.new('RGB', (raw.size[0] * 2 + 16, raw.size[1]), (255, 255, 255))
        sheet.paste(raw, (0, 0))
        sheet.paste(marked, (raw.size[0] + 16, 0))
        path = os.path.join(a.out, 'img', g['qid'] + '.png')
        sheet.save(path)
        key[g['qid']] = {'key': g['key'], 'pngSha256': hashlib.sha256(open(path, 'rb').read()).hexdigest()}
    json.dump(key, open(os.path.join(a.out, 'key.json'), 'w'), indent=1, sort_keys=True)
    print(len(key), 'pictures')


if __name__ == '__main__':
    main()
